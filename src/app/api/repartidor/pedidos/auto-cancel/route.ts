import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { revertirTarifaSiCorresponde } from "@/lib/pedido-cancelacion-financiera"

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

    const body = await req.json().catch(() => ({}))
    const maxMinutes = body.maxMinutes || 30 // default: 30 minutes

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
        }
      } catch (error) {
        console.error(`Error auto-cancelling pedido ${candidato.id}:`, error)
      }
    }

    return NextResponse.json({
      cancelled: cancelledCount,
      message: `${cancelledCount} pedido(s) cancelado(s) automáticamente`,
    })
  } catch (error) {
    console.error("Error auto-cancelling pedidos:", error)
    return NextResponse.json(
      { error: "Error al cancelar pedidos viejos" },
      { status: 500 }
    )
  }
}
