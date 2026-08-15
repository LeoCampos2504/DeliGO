import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { revertirTarifaSiCorresponde } from "@/lib/pedido-cancelacion-financiera"
import { createNotification, orderUpdateNotification } from "@/lib/push"
import { notifyOperationsOrderCancelled } from "@/lib/operations-cancellation-notification"
import { safeErrorForLog } from "@/lib/log-safe-error"

const DEFAULT_AUTO_CANCEL_MINUTES = 30
const MIN_AUTO_CANCEL_MINUTES = 5
const MAX_AUTO_CANCEL_MINUTES = 180

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type MaxMinutesResult =
  | { ok: true; value: number }
  | { ok: false }

// Valida el body crudo sin ninguna coerción (nada de `||`, `Number(...)`,
// `parseInt`/`parseFloat`, ni strings numéricos aceptados). Solo un `number` real de
// JSON, finito, entero, dentro de [MIN, MAX], y ninguna clave extra. Se ejecuta antes
// de tocar la base de datos (asociaciones, pedidos o cualquier mutación).
function parseMaxMinutes(rawBody: string): MaxMinutesResult {
  let body: unknown = {}
  const trimmed = rawBody.trim()
  if (trimmed) {
    try {
      body = JSON.parse(trimmed)
    } catch {
      return { ok: false }
    }
  }

  if (!isPlainObject(body)) {
    return { ok: false }
  }

  const allowedKeys = new Set(["maxMinutes"])
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return { ok: false }
  }

  if (body.maxMinutes === undefined) {
    return { ok: true, value: DEFAULT_AUTO_CANCEL_MINUTES }
  }

  const raw = body.maxMinutes
  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    !Number.isInteger(raw) ||
    raw < MIN_AUTO_CANCEL_MINUTES ||
    raw > MAX_AUTO_CANCEL_MINUTES
  ) {
    return { ok: false }
  }

  return { ok: true, value: raw }
}

// POST - Auto-cancel old unclaimed delivery orders
// Called by the repartidor app periodically or manually
// Cancels orders that are "en_camino" + delivery + no repartidor assigned + older than threshold
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const rawBody = await req.text()
    const parsedMaxMinutes = parseMaxMinutes(rawBody)
    if (!parsedMaxMinutes.ok) {
      return NextResponse.json(
        { error: `maxMinutes debe ser un entero entre ${MIN_AUTO_CANCEL_MINUTES} y ${MAX_AUTO_CANCEL_MINUTES}` },
        { status: 400 }
      )
    }
    const maxMinutes = parsedMaxMinutes.value

    // Only cancel orders from negocios the repartidor is associated with
    const asociaciones = await db.repartidorNegocio.findMany({
      where: { repartidorId: user.id },
      select: { negocioId: true },
    })
    const negocioIds = asociaciones.map((a) => a.negocioId)

    if (negocioIds.length === 0) {
      return NextResponse.json({ cancelled: 0 })
    }

    // Find old unclaimed delivery orders
    const threshold = new Date(Date.now() - maxMinutes * 60 * 1000)

    const oldUnclaimed = await db.pedido.findMany({
      where: {
        negocioId: { in: negocioIds },
        estado: "en_camino",
        metodoEntrega: "domicilio",
        repartidorId: null,
        fecha: { lt: threshold },
      },
      select: { id: true, negocioId: true },
    })

    if (oldUnclaimed.length === 0) {
      return NextResponse.json({ cancelled: 0, message: "No hay pedidos viejos sin responder" })
    }

    // Seguridad-2C: una operación masiva (updateMany) no puede revertir deuda
    // correctamente por pedido. Cada pedido se cancela en su propia transacción con CAS
    // + reversión condicional; un pedido fallido (p.ej. sin cupo de deuda para revertir)
    // no afecta a los demás ni deja cambios parciales.
    const motivo = `Pedido cancelado automáticamente: sin respuesta de repartidor por más de ${maxMinutes} minutos`
    let cancelledCount = 0

    for (const candidato of oldUnclaimed) {
      try {
        // La transacción devuelve true solo si el CAS ganó y la reversión/evento se
        // completaron; false si el CAS no afectó una fila. El contador se incrementa
        // DESPUÉS de que `$transaction` resuelve true — nunca dentro del callback, para
        // no contar un pedido cuya transacción termine revirtiéndose.
        const cancelled = await db.$transaction(async (tx) => {
          const cas = await tx.pedido.updateMany({
            where: {
              id: candidato.id,
              negocioId: candidato.negocioId,
              estado: "en_camino",
              metodoEntrega: "domicilio",
              repartidorId: null,
            },
            data: {
              estado: "cancelado",
              canceladoPor: "sistema",
              canceladoMotivo: motivo,
              canceladoFecha: new Date(),
            },
          })
          if (cas.count !== 1) return false

          // El helper relee tarifaServicio/deudaAcumulada frescos DESPUÉS de este CAS,
          // dentro de la misma transacción (Seguridad-2C.1).
          await revertirTarifaSiCorresponde(tx, {
            id: candidato.id,
            negocioId: candidato.negocioId,
          })

          await tx.pedidoEvento.create({
            data: {
              pedidoId: candidato.id,
              estado: "cancelado",
              estadoAnterior: "en_camino",
              userType: "sistema",
              nota: `Auto-cancelado: sin respuesta por ${maxMinutes} min`,
            },
          })

          return true
        })

        if (cancelled) {
          cancelledCount += 1

          try {
            const pedido = await db.pedido.findUnique({
              where: { id: candidato.id },
              select: {
                negocioId: true,
                negocioNombre: true,
                clienteId: true,
                metodoEntrega: true,
              },
            })
            if (!pedido) continue

            const cancellationPushEndpoints = new Set<string>()
            const payload = orderUpdateNotification(candidato.id, pedido.negocioNombre, "cancelado")
            if (pedido.clienteId) {
              const cliente = await db.cliente.findUnique({
                where: { id: pedido.clienteId },
                select: { pushSubscription: true },
              })
              await createNotification({
                userId: pedido.clienteId,
                userType: "cliente",
                tipo: "order_update",
                titulo: payload.title,
                cuerpo: payload.body,
                pedidoId: candidato.id,
                negocioId: pedido.negocioId,
                pushSubscription: cliente?.pushSubscription ?? null,
                pushPayload: payload,
                reservedPushEndpoints: cancellationPushEndpoints,
                cleanupExpired: { model: "cliente", id: pedido.clienteId },
              })
            }

            const negocio = await db.negocio.findUnique({
              where: { id: pedido.negocioId },
              select: { pushSubscription: true },
            })
            await createNotification({
              userId: pedido.negocioId,
              userType: "negocio",
              tipo: "order_update",
              titulo: payload.title,
              cuerpo: payload.body,
              pedidoId: candidato.id,
              negocioId: pedido.negocioId,
              pushSubscription: negocio?.pushSubscription ?? null,
              pushPayload: payload,
              reservedPushEndpoints: cancellationPushEndpoints,
              cleanupExpired: { model: "negocio", id: pedido.negocioId },
            })

            await notifyOperationsOrderCancelled({
              pedidoId: candidato.id,
              negocioId: pedido.negocioId,
              metodoEntrega: pedido.metodoEntrega,
              canceladoPor: "sistema",
              reservedPushEndpoints: cancellationPushEndpoints,
            })
          } catch (pushError) {
            console.error("[Push] Failed to send auto-cancellation notifications:", safeErrorForLog(pushError))
          }
        }
      } catch (error) {
        console.error(`Error auto-cancelling pedido ${candidato.id}:`, safeErrorForLog(error))
      }
    }

    return NextResponse.json({
      cancelled: cancelledCount,
      message: `${cancelledCount} pedido(s) cancelado(s) automáticamente`,
    })
  } catch (error) {
    console.error("Error auto-cancelling pedidos:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al cancelar pedidos viejos" },
      { status: 500 }
    )
  }
}
