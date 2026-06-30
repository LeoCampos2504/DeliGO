import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesArea, hasTerminalScope } from "@/lib/operaciones-terminal-access"
import { logPedidoEstadoChange } from "@/lib/audit"
import { notifyMesaOrderReadyForMozo } from "@/lib/mesa-order-ready-notification"
import type { OperacionesScope } from "@/lib/operaciones-terminal-permissions"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
// Mensaje genérico de conflicto: no revela negocio, IDs, estados de otros pedidos ni concurrencia.
const CONFLICT_MESSAGE = "El pedido ya cambió o no puede actualizarse. Actualizá el panel."

// Transición → estado actual requerido (subset estricto de pedidos de mesa).
// Coincide con VALID_TRANSITIONS del proyecto para mesa:
//   recibido → preparando · preparando → listo_para_retirar · listo_para_retirar → entregado
const REQUIRED_CURRENT: Record<string, string> = {
  preparando: "recibido",
  listo_para_retirar: "preparando",
  entregado: "listo_para_retirar",
}

// Transición → scope requerido.
const REQUIRED_SCOPE: Record<string, OperacionesScope> = {
  preparando: "salon.pedidos.cambiar_estado",
  listo_para_retirar: "salon.pedidos.cambiar_estado",
  entregado: "salon.pedidos.marcar_entregado",
}

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function conflict() {
  return NextResponse.json({ ok: false, error: CONFLICT_MESSAGE }, { status: 409, headers: NO_STORE_HEADERS })
}

function forbidden() {
  return NextResponse.json(
    { ok: false, error: "Esta terminal no tiene permiso para realizar esa acción." },
    { status: 403, headers: NO_STORE_HEADERS }
  )
}

// PATCH — Avanza el estado de un pedido de mesa desde una Terminal Operativa.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1) Sesión válida de terminal + acceso al área Salón (401 / 403). Nunca confía en la UI.
    const auth = await requireOperacionesArea(req, "salon")
    if (!auth.ok) return auth.response
    const ctx = auth.context
    const negocioId = ctx.negocio.id

    const { id } = await params

    // Solo se acepta `estado` del body. Cualquier otro campo se ignora.
    const body = await req.json().catch(() => null)
    const estado = body && typeof body.estado === "string" ? body.estado : ""
    if (!estado) {
      return noStore(NextResponse.json({ ok: false, error: "estado es obligatorio" }, { status: 400 }))
    }

    // 2) Transición soportada por esta ruta operativa.
    const requiredCurrent = REQUIRED_CURRENT[estado]
    const requiredScope = REQUIRED_SCOPE[estado]
    if (!requiredCurrent || !requiredScope) {
      return conflict()
    }

    // 3) Scope según el estado objetivo (la validación real vive en el servidor).
    if (!hasTerminalScope(ctx, requiredScope)) {
      return forbidden()
    }

    // 4) Buscar el pedido SIEMPRE acotado al negocio de la terminal y a método mesa.
    const pedido = await db.pedido.findFirst({
      where: { id, negocioId, metodoEntrega: "mesa" },
      select: {
        id: true,
        estado: true,
        negocioSlug: true,
        mesaId: true,
        mesaNumero: true,
        empleadoId: true,
      },
    })
    // Inexistente / de otro negocio / no-mesa → 409 genérico.
    if (!pedido) return conflict()
    if (pedido.estado !== requiredCurrent) return conflict()

    // 5) Actualización condicional atómica: gana una sola operación.
    const updateData: Record<string, unknown> = { estado }
    if (estado === "entregado") {
      updateData.entregadoFecha = new Date()
    }

    const result = await db.pedido.updateMany({
      where: { id, negocioId, metodoEntrega: "mesa", estado: requiredCurrent },
      data: updateData,
    })
    if (result.count !== 1) return conflict()

    // 6) Notificación al mozo SOLO en preparando → listo_para_retirar, reutilizando el helper
    //    existente. Best-effort: si falla, no se revierte el cambio ya confirmado.
    if (estado === "listo_para_retirar") {
      try {
        await notifyMesaOrderReadyForMozo({
          pedido: {
            id: pedido.id,
            negocioId,
            negocioSlug: pedido.negocioSlug,
            metodoEntrega: "mesa",
            mesaId: pedido.mesaId,
            mesaNumero: pedido.mesaNumero,
            empleadoId: pedido.empleadoId,
          },
          estadoAnterior: requiredCurrent,
        })
      } catch {
        console.error("[OperacionesSalon] Falló la notificación al mozo")
      }
    }

    // 7) Auditoría best-effort con el mecanismo existente (sin secretos).
    try {
      await logPedidoEstadoChange({
        pedidoId: pedido.id,
        estadoNuevo: estado,
        estadoAnterior: requiredCurrent,
        userId: ctx.terminal.id,
        userType: "terminal_operativa",
      })
    } catch {
      console.error("[OperacionesSalon] Falló la auditoría del cambio de estado")
    }

    return NextResponse.json(
      { ok: true, pedido: { id: pedido.id, estado } },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesSalon] Falló el cambio de estado del pedido")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
