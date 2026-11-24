import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  getMesaOccupancyStatus,
  closeMesaOccupancy,
  parseMesaOccupancyActorFamily,
  resolveMesaOccupancyActor,
  logMesaOccupancyCloseEvent,
  type MesaOccupancyActorResolution,
} from "@/lib/mesa-occupancy"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO — Endpoint canónico de ocupación de mesa para personal (P0-D.3A)
// ============================================
// Ruta elegida: /api/operaciones/mesas/[id]/ocupacion. Es un recurso neutral
// bajo el área general "Operaciones" (no bajo /operaciones/salon ni
// /operaciones/pyr, que son de un solo actor) porque Negocio, Salón (Cuenta
// Operativa o Terminal Operativa) y Mozo necesitan llegar los tres al mismo
// helper y a la misma política central — nunca a tres implementaciones
// distintas. GET consulta el estado técnico actual; POST cierra la
// ocupación esperada. Ninguno abre una ocupación nueva (eso sigue siendo
// exclusivo de la comprobación pública de geocerca, P0-D.1).
//
// Cierre técnico, no comercial: nunca toca pedidos, totales, pagos, tickets
// ni el cierre de cuenta — ver src/lib/mesa-occupancy.ts.

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status, headers: NO_STORE_HEADERS })
}

// BUG-002: el llamador declara su familia de sesión (?actorFamily=negocio|cuenta_operativa|terminal). Ver
// resolveMesaOccupancyActor: el selector sólo elige qué credencial se valida; nunca otorga permisos.
type ActorDeLaPeticion = { ok: true; resolucion: MesaOccupancyActorResolution } | { ok: false; response: NextResponse }
async function actorDeLaPeticion(request: NextRequest, negocioId: string): Promise<ActorDeLaPeticion> {
  const family = parseMesaOccupancyActorFamily(request.nextUrl.searchParams.get("actorFamily"))
  if (family === "invalid") return { ok: false, response: jsonNoStore({ error: "actorFamily inválido", code: "MESA_OCCUPANCY_BAD_ACTOR_FAMILY" }, { status: 400 }) }
  return { ok: true, resolucion: await resolveMesaOccupancyActor(request, negocioId, family) }
}
function respuestaSinActor(status: 401 | 403 | 404) {
  if (status === 401) return jsonNoStore({ error: "Sesión no válida o vencida", code: "MESA_OCCUPANCY_UNAUTHENTICATED" }, { status: 401 })
  if (status === 403) return jsonNoStore({ error: "No tenés permiso para la ocupación de esta mesa", code: "MESA_OCCUPANCY_FORBIDDEN" }, { status: 403 })
  return jsonNoStore({ error: "Mesa no encontrada" }, { status: 404 })
}

// Mesa SIEMPRE resuelta server-side por id — nunca se confía en negocioId
// enviado por el cliente. 404 genérico evita revelar si la mesa existe en
// otro negocio.
async function resolveMesaContext(mesaId: string) {
  return db.mesa.findUnique({
    where: { id: mesaId },
    select: { id: true, numero: true, negocioId: true },
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await getOcupacion(request, params)
  } catch (error) {
    console.error("[MesaOccupancy] Error consultando ocupación:", safeErrorForLog(error))
    return jsonNoStore({ error: "Error interno del servidor" }, { status: 500 })
  }
}

async function getOcupacion(request: NextRequest, params: Promise<{ id: string }>) {
  const { id: mesaId } = await params

  const mesa = await resolveMesaContext(mesaId)
  if (!mesa) {
    return jsonNoStore({ error: "Mesa no encontrada" }, { status: 404 })
  }

  const peticion = await actorDeLaPeticion(request, mesa.negocioId)
  if (!peticion.ok) return peticion.response
  if (!peticion.resolucion.ok) return respuestaSinActor(peticion.resolucion.status)
  const actor = peticion.resolucion.actor
  if (actor.type === "mozo" && !actor.assignedMesaIds.includes(mesa.id)) {
    return jsonNoStore({ error: "No autorizado para esta mesa", code: "MESA_OCCUPANCY_CLOSE_FORBIDDEN" }, { status: 403 })
  }

  const result = await getMesaOccupancyStatus({ negocioId: mesa.negocioId, mesaId: mesa.id })

  if (result.status === "inconsistent") {
    return jsonNoStore({ error: "Estado de ocupación inconsistente" }, { status: 409 })
  }
  if (result.status === "none") {
    // P2 corrección (Bloqueo 4): además de "sin ocupación activa", informa
    // el id de la última ocupación CERRADA de esta mesa (si existe), para
    // que la UI pueda ofrecer reabrir/reimprimir ese ticket ya cerrado vía
    // GET /api/operaciones/ocupaciones/[id]/cuenta — nunca autoriza nada por
    // sí solo, ese endpoint revalida todo de nuevo.
    return jsonNoStore({
      hasActiveOccupancy: false,
      occupancy: null,
      lastClosedOcupacionId: result.lastClosedOcupacionId,
    })
  }
  return jsonNoStore({
    hasActiveOccupancy: true,
    occupancy: {
      id: result.occupancy.id,
      startedAt: result.occupancy.startedAt.toISOString(),
      lastActivityAt: result.occupancy.lastActivityAt.toISOString(),
      status: "activa",
    },
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: mesaId } = await params

  const mesa = await resolveMesaContext(mesaId)
  if (!mesa) {
    return jsonNoStore({ error: "Mesa no encontrada" }, { status: 404 })
  }

  let peticion: ActorDeLaPeticion
  try {
    peticion = await actorDeLaPeticion(request, mesa.negocioId)
  } catch (error) {
    console.error("[MesaOccupancy] Error resolviendo el actor:", safeErrorForLog(error))
    return jsonNoStore({ error: "Error interno del servidor" }, { status: 500 })
  }
  if (!peticion.ok) return peticion.response
  if (!peticion.resolucion.ok) return respuestaSinActor(peticion.resolucion.status)
  const actor = peticion.resolucion.actor
  if (actor.type === "mozo" && !actor.assignedMesaIds.includes(mesa.id)) {
    logMesaOccupancyCloseEvent({
      negocioId: mesa.negocioId,
      mesaNumero: mesa.numero,
      actorType: actor.type,
      outcome: "forbidden",
      revokedCredentials: 0,
    })
    return jsonNoStore({ error: "No autorizado para esta mesa", code: "MESA_OCCUPANCY_CLOSE_FORBIDDEN" }, { status: 403 })
  }

  // `expectedOcupacionId` es el único dato aceptado del body — obligatorio,
  // nunca se cierra "la ocupación actual" sin comparar contra ella. Ningún
  // otro campo del body (negocioId, mesaId, estado, actorType, actorId,
  // cerradaPorId, cerradaPorTipo, revocadaEn) se lee en ningún punto.
  const body = await request.json().catch(() => null)
  const expectedOcupacionId =
    body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).expectedOcupacionId === "string"
      ? ((body as Record<string, unknown>).expectedOcupacionId as string).trim()
      : ""
  if (!expectedOcupacionId) {
    return jsonNoStore({ error: "expectedOcupacionId es requerido" }, { status: 400 })
  }

  try {
    const result = await closeMesaOccupancy({
      negocioId: mesa.negocioId,
      mesaId: mesa.id,
      expectedOcupacionId,
      actorType: actor.type,
      actorId: actor.actorId,
    })

    logMesaOccupancyCloseEvent({
      negocioId: mesa.negocioId,
      mesaNumero: mesa.numero,
      actorType: actor.type,
      outcome: result.status,
      revokedCredentials: result.status === "closed" ? result.revokedCredentials : 0,
    })

    if (result.status === "closed" || result.status === "no_active") {
      return jsonNoStore({ success: true, status: result.status })
    }

    if (result.status === "occupancy_changed") {
      // Nunca se revela el id actual — solo que cambió.
      return jsonNoStore(
        {
          error: "La ocupación de esta mesa cambió. Actualizá el panel antes de volver a intentarlo.",
          code: "MESA_OCCUPANCY_CHANGED",
        },
        { status: 409 }
      )
    }

    if (result.status === "pending_orders") {
      return jsonNoStore(
        { error: "Hay pedidos de esta ocupación todavía no entregados ni cancelados.", code: "MESA_OCCUPANCY_CLOSE_PENDING_ORDERS", pedidosPendientes: result.pendingCount },
        { status: 409 }
      )
    }
    if (result.status === "billable_account") {
      return jsonNoStore(
        { error: "La cuenta tiene consumo y requiere cierre comercial.", code: "MESA_OCCUPANCY_CLOSE_BILLABLE_ACCOUNT" },
        { status: 409 }
      )
    }

    // "inconsistent"
    return jsonNoStore({ error: "Estado de ocupación inconsistente" }, { status: 409 })
  } catch (error) {
    console.error("[MesaOccupancy] Error cerrando ocupación:", safeErrorForLog(error))
    logMesaOccupancyCloseEvent({
      negocioId: mesa.negocioId,
      mesaNumero: mesa.numero,
      actorType: actor.type,
      outcome: "error",
      revokedCredentials: 0,
    })
    return jsonNoStore({ error: "Error interno del servidor" }, { status: 500 })
  }
}
