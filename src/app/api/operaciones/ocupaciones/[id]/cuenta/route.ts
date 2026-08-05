import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  resolveMesaOccupancyCloseActor,
  closeMesaOccupancyComercial,
  logMesaOccupancyCloseEvent,
} from "@/lib/mesa-occupancy"
import { buildCuentaMesa, type CuentaPedidoInput } from "@/lib/mesa-cuenta"

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
    select: { id: true, negocioId: true, mesaId: true, estado: true, iniciadaEn: true, cerradaEn: true },
  })
  if (!ocupacion) return null

  const mesa = await db.mesa.findUnique({
    where: { id: ocupacion.mesaId },
    select: { id: true, numero: true, negocioId: true },
  })
  if (!mesa || mesa.negocioId !== ocupacion.negocioId) return null

  return { ocupacion, mesa }
}

async function loadCuenta(ocupacionId: string, negocioId: string) {
  const pedidos = await db.pedido.findMany({
    where: { ocupacionMesaId: ocupacionId, negocioId, metodoEntrega: "mesa" },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
    select: {
      id: true,
      estado: true,
      fecha: true,
      total: true,
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
        },
      },
    },
  })

  const input: CuentaPedidoInput[] = pedidos.map((pedido) => ({
    id: pedido.id,
    estado: pedido.estado,
    fecha: pedido.fecha,
    total: pedido.total,
    items: pedido.items,
  }))

  return buildCuentaMesa(input)
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

  const context = await resolveOcupacionContext(ocupacionId)
  if (!context) {
    return jsonNoStore({ error: "Ocupación no encontrada" }, { status: 404 })
  }
  const { ocupacion, mesa } = context

  const actor = await resolveMesaOccupancyCloseActor(request, ocupacion.negocioId)
  if (!actor) {
    return jsonNoStore({ error: "No autenticado" }, { status: 401 })
  }
  if (actor.type === "mozo" && !actor.assignedMesaIds.includes(mesa.id)) {
    return jsonNoStore({ error: "No autorizado para esta mesa", code: "MESA_CUENTA_FORBIDDEN" }, { status: 403 })
  }

  const negocio = await db.negocio.findUnique({ where: { id: ocupacion.negocioId }, select: { nombre: true } })
  const cuenta = await loadCuenta(ocupacionId, ocupacion.negocioId)

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

  const context = await resolveOcupacionContext(ocupacionId)
  if (!context) {
    return jsonNoStore({ error: "Ocupación no encontrada" }, { status: 404 })
  }
  const { ocupacion, mesa } = context

  const actor = await resolveMesaOccupancyCloseActor(request, ocupacion.negocioId)
  if (!actor) {
    return jsonNoStore({ error: "No autenticado" }, { status: 401 })
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
    const cuenta = await loadCuenta(ocupacionId, ocupacion.negocioId)

    return jsonNoStore({
      ok: true,
      closed: true,
      ocupacion: await serializeOcupacion(ocupacionId, ocupacion),
      mesa: { numero: mesa.numero },
      negocio: { nombre: negocio?.nombre ?? "" },
      ...cuenta,
    })
  } catch (error) {
    console.error("[MesaCuenta] Error cerrando cuenta:", error)
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
