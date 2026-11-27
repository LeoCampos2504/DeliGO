import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  closeMesaOccupancyComercial,
  logMesaOccupancyCloseEvent,
  parseMesaOccupancyActorFamily,
  resolveMesaOccupancyActor,
  type MesaOccupancyActorFamily,
  type MesaOccupancyCloseActor,
} from "@/lib/mesa-occupancy"
import { buildCuentaMesa, METODOS_PAGO_MESA, withCuentaMesaPayment, type CuentaPedidoInput, type MetodoPagoMesa } from "@/lib/mesa-cuenta"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO — Cuenta de mesa (P2): vista previa y cierre comercial
// ============================================
// Ruta clave: `[id]` es SIEMPRE el id de la SesionOcupacionMesa concreta —
// nunca una mesa ni un número de mesa (P2, sección 7: nunca depender
// únicamente de mesaNumero, nunca cerrar "todos los pedidos históricos de la
// mesa"). GET calcula la cuenta (solo lectura, funciona con la ocupación
// activa o ya cerrada). POST cierra la cuenta: delega TODO (comprobación de
// pedidos pendientes + cierre técnico) a `closeMesaOccupancyComercial`
// (`src/lib/mesa-occupancy.ts`), que ejecuta ambas cosas dentro de UNA ÚNICA
// transacción Serializable real — este endpoint NUNCA hace su propia
// comprobación de pendientes en una consulta separada (P2 corrección,
// Bloqueo 1: eso era exactamente el bug que dejaba una ventana de carrera
// entre "contar pendientes" y "cerrar").
//
// Autorización: exactamente el mismo actor que ya resuelve el cierre técnico
// (`resolveMesaOccupancyCloseActor` — Negocio dueño, Cuenta Operativa de
// área Salón, Terminal Operativa de área Salón, o Mozo restringido a sus
// mesas asignadas). No se amplía ni se inventa un permiso nuevo.
//
// T3 (sesiones simultáneas): la pantalla declara su familia (`?actorFamily=negocio|cuenta_operativa|terminal`,
// fijada por cada host, nunca por el usuario) y se valida EXCLUSIVAMENTE esa credencial con el resolvedor de
// BUG-002 (`resolveMesaOccupancyActor`, mismas reglas: negocio exacto, área efectiva, asignación de mesas).
// Antes, con el dueño y una cuenta operativa en el mismo navegador, el orden fijo dueño → operativa → terminal
// hacía que el cierre del dueño se registrara como el empleado de Salón (`cerradaPorTipo/Id`) o fallara con 401,
// y una cookie legacy del dueño podía elevar la pantalla de un empleado. En esta ruta (mueve el cierre comercial,
// el método de pago y el ticket) el selector es OBLIGATORIO: sin él → 400, nunca un orden de prueba entre
// familias. Códigos: 401 sin credencial válida de esa familia · 403 credencial del negocio sin permiso ·
// 404 credencial de otro negocio u ocupación inexistente (no revela la ocupación).

type ActorDeCuenta = { ok: true; actor: MesaOccupancyCloseActor } | { ok: false; response: NextResponse }

function familiaDeCuenta(request: NextRequest): MesaOccupancyActorFamily | NextResponse {
  const family = parseMesaOccupancyActorFamily(request.nextUrl.searchParams.get("actorFamily"))
  if (family === null || family === "invalid") {
    return jsonNoStore({ error: "actorFamily requerido o inválido", code: "MESA_CUENTA_ACTOR_FAMILY_REQUIRED" }, { status: 400 })
  }
  return family
}

async function resolverActorDeCuenta(request: NextRequest, negocioId: string, family: MesaOccupancyActorFamily): Promise<ActorDeCuenta> {
  const resolved = await resolveMesaOccupancyActor(request, negocioId, family)
  if (resolved.ok) return { ok: true, actor: resolved.actor }
  if (resolved.status === 404) return { ok: false, response: jsonNoStore({ error: "Ocupación no encontrada" }, { status: 404 }) }
  if (resolved.status === 403) return { ok: false, response: jsonNoStore({ error: "No autorizado para esta mesa", code: "MESA_CUENTA_FORBIDDEN" }, { status: 403 }) }
  return { ok: false, response: jsonNoStore({ error: "No autenticado" }, { status: 401 }) }
}

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status, headers: NO_STORE_HEADERS })
}

// Ocupación + mesa SIEMPRE resueltas server-side por id — nunca se confía en
// negocioId/mesaId enviados por el cliente. Un 404 genérico evita revelar si
// la ocupación existe en otro negocio.
async function resolveOcupacionContext(ocupacionId: string) {
  const ocupacion = await db.sesionOcupacionMesa.findUnique({
    where: { id: ocupacionId },
    select: {
      id: true, negocioId: true, mesaId: true, estado: true, iniciadaEn: true, cerradaEn: true,
      metodoPago: true, pagoConfirmadoEn: true,
    },
  })
  if (!ocupacion) return null

  const mesa = await db.mesa.findUnique({
    where: { id: ocupacion.mesaId },
    select: { id: true, numero: true, negocioId: true },
  })
  if (!mesa || mesa.negocioId !== ocupacion.negocioId) return null

  return { ocupacion, mesa }
}

async function loadCuenta(ocupacionId: string, negocioId: string, payment: { metodoPago: string | null; pagoConfirmadoEn: Date | null }) {
  const pedidos = await db.pedido.findMany({
    where: { ocupacionMesaId: ocupacionId, negocioId, metodoEntrega: "mesa" },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
    select: {
      id: true,
      estado: true,
      fecha: true,
      total: true,
      notas: true,
      items: {
        select: {
          id: true,
          nombre: true,
          precio: true,
          cantidad: true,
          agregados: true,
          secciones: true,
          ingredientesQuitados: true,
          talle: true,
          color: true,
          // P2-T56-R3A-P0-F1: snapshot de la variante para la cuenta y el ticket.
          varianteNombre: true,
        },
      },
    },
  })

  const input: CuentaPedidoInput[] = pedidos.map((pedido) => ({
    id: pedido.id,
    estado: pedido.estado,
    fecha: pedido.fecha,
    total: pedido.total,
    notas: pedido.notas,
    items: pedido.items,
  }))

  return withCuentaMesaPayment(buildCuentaMesa(input), payment)
}

async function serializeOcupacion(ocupacionId: string, fallback: {
  estado: string
  iniciadaEn: Date
  cerradaEn: Date | null
}) {
  const fresh = await db.sesionOcupacionMesa.findUnique({
    where: { id: ocupacionId },
    select: { estado: true, iniciadaEn: true, cerradaEn: true },
  })
  const source = fresh ?? fallback
  return {
    id: ocupacionId,
    estado: source.estado,
    iniciadaEn: source.iniciadaEn.toISOString(),
    cerradaEn: source.cerradaEn ? source.cerradaEn.toISOString() : null,
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ocupacionId } = await params

  const family = familiaDeCuenta(request)
  if (family instanceof NextResponse) return family

  const context = await resolveOcupacionContext(ocupacionId)
  if (!context) {
    return jsonNoStore({ error: "Ocupación no encontrada" }, { status: 404 })
  }
  const { ocupacion, mesa } = context

  const resolved = await resolverActorDeCuenta(request, ocupacion.negocioId, family)
  if (!resolved.ok) return resolved.response
  const actor = resolved.actor
  if (actor.type === "mozo" && !actor.assignedMesaIds.includes(mesa.id)) {
    return jsonNoStore({ error: "No autorizado para esta mesa", code: "MESA_CUENTA_FORBIDDEN" }, { status: 403 })
  }

  const negocio = await db.negocio.findUnique({ where: { id: ocupacion.negocioId }, select: { nombre: true } })
  const cuenta = await loadCuenta(ocupacionId, ocupacion.negocioId, ocupacion)

  return jsonNoStore({
    ok: true,
    // P2 corrección: refleja el estado REAL de la ocupación (relevante para
    // "Ver último ticket cerrado", Bloqueo 4) — antes esto quedaba
    // hardcodeado en `false` incluso para una ocupación ya cerrada.
    closed: ocupacion.estado !== "activa",
    ocupacion: await serializeOcupacion(ocupacionId, ocupacion),
    mesa: { numero: mesa.numero },
    negocio: { nombre: negocio?.nombre ?? "" },
    ...cuenta,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ocupacionId } = await params

  const family = familiaDeCuenta(request)
  if (family instanceof NextResponse) return family

  const context = await resolveOcupacionContext(ocupacionId)
  if (!context) {
    return jsonNoStore({ error: "Ocupación no encontrada" }, { status: 404 })
  }
  const { ocupacion, mesa } = context

  const resolved = await resolverActorDeCuenta(request, ocupacion.negocioId, family)
  if (!resolved.ok) return resolved.response
  const actor = resolved.actor
  // P2-T41: Terminal Operativa nunca puede ejecutar el cierre COMERCIAL
  // (esta ruta) — mueve dinero/pedidos/tickets. Conserva sí, sin cambios,
  // el cierre TÉCNICO (`mesas/[id]/ocupacion`), que no toca nada de eso.
  if (actor.type === "salon_terminal") {
    logMesaOccupancyCloseEvent({
      negocioId: ocupacion.negocioId,
      mesaNumero: mesa.numero,
      actorType: actor.type,
      outcome: "forbidden",
      revokedCredentials: 0,
    })
    return jsonNoStore({ error: "No autorizado para cerrar la cuenta", code: "MESA_CUENTA_FORBIDDEN" }, { status: 403 })
  }
  if (actor.type === "mozo" && !actor.assignedMesaIds.includes(mesa.id)) {
    logMesaOccupancyCloseEvent({
      negocioId: ocupacion.negocioId,
      mesaNumero: mesa.numero,
      actorType: actor.type,
      outcome: "forbidden",
      revokedCredentials: 0,
    })
    return jsonNoStore({ error: "No autorizado para esta mesa", code: "MESA_CUENTA_FORBIDDEN" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const rawMetodoPago = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).metodoPago
    : undefined
  if (rawMetodoPago !== undefined && (typeof rawMetodoPago !== "string" || !METODOS_PAGO_MESA.includes(rawMetodoPago as MetodoPagoMesa))) {
    return jsonNoStore({ error: "Método de pago inválido", code: "MESA_CUENTA_METODO_PAGO_INVALIDO" }, { status: 400 })
  }
  const metodoPago = rawMetodoPago as MetodoPagoMesa | undefined

  try {
    // P2 corrección (Bloqueo 1): la comprobación de pedidos pendientes y el
    // cierre técnico ocurren dentro de esta ÚNICA llamada — una sola
    // transacción Serializable real (ver closeMesaOccupancyComercial en
    // src/lib/mesa-occupancy.ts). No hay ninguna consulta de pendientes
    // separada antes ni después: si hay pedidos mutables, esta llamada
    // revierte cualquier escritura tentativa y devuelve "pending_orders".
    const result = await closeMesaOccupancyComercial({
      negocioId: ocupacion.negocioId,
      mesaId: mesa.id,
      expectedOcupacionId: ocupacionId,
      actorType: actor.type,
      actorId: actor.actorId,
      paymentMethod: metodoPago,
    })

    logMesaOccupancyCloseEvent({
      negocioId: ocupacion.negocioId,
      mesaNumero: mesa.numero,
      actorType: actor.type,
      outcome: result.status,
      revokedCredentials: result.status === "closed" ? result.revokedCredentials : 0,
    })

    if (result.status === "pending_orders") {
      return jsonNoStore(
        {
          error: "Hay pedidos de esta mesa que todavía no fueron entregados ni cancelados.",
          code: "MESA_CUENTA_PEDIDOS_PENDIENTES",
          pedidosPendientes: result.pendingCount,
        },
        { status: 409 }
      )
    }
    if (result.status === "billable_account") {
      return jsonNoStore({ error: "La cuenta tiene consumo y requiere cierre comercial.", code: "MESA_CUENTA_FACTURABLE" }, { status: 409 })
    }
    if (result.status === "payment_required") {
      return jsonNoStore({ error: "Seleccioná un método de pago para cerrar una cuenta con consumo.", code: "MESA_CUENTA_METODO_PAGO_REQUERIDO" }, { status: 400 })
    }
    if (result.status === "occupancy_changed") {
      return jsonNoStore(
        {
          error: "La ocupación de esta mesa cambió. Actualizá la cuenta antes de volver a intentarlo.",
          code: "MESA_OCCUPANCY_CHANGED",
        },
        { status: 409 }
      )
    }
    if (result.status === "inconsistent") {
      return jsonNoStore({ error: "Estado de ocupación inconsistente" }, { status: 409 })
    }

    // "closed" (recién cerrada acá) o "no_active" (ya estaba cerrada — doble
    // solicitud/segundo click): en ambos casos se devuelve la cuenta final
    // tal cual quedó, para que el cliente muestre/imprima el ticket sin un
    // segundo round-trip.
    const negocio = await db.negocio.findUnique({ where: { id: ocupacion.negocioId }, select: { nombre: true } })
    const finalPayment = await db.sesionOcupacionMesa.findUnique({
      where: { id: ocupacionId },
      select: { metodoPago: true, pagoConfirmadoEn: true },
    })
    const cuenta = await loadCuenta(ocupacionId, ocupacion.negocioId, finalPayment ?? ocupacion)

    return jsonNoStore({
      ok: true,
      closed: true,
      ocupacion: await serializeOcupacion(ocupacionId, ocupacion),
      mesa: { numero: mesa.numero },
      negocio: { nombre: negocio?.nombre ?? "" },
      ...cuenta,
    })
  } catch (error) {
    console.error("[MesaCuenta] Error cerrando cuenta:", safeErrorForLog(error))
    logMesaOccupancyCloseEvent({
      negocioId: ocupacion.negocioId,
      mesaNumero: mesa.numero,
      actorType: actor.type,
      outcome: "error",
      revokedCredentials: 0,
    })
    return jsonNoStore({ error: "Error interno del servidor" }, { status: 500 })
  }
}
