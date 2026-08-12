import { NextRequest, NextResponse } from "next/server"
import {
  cancelarPedidoMesa,
  resolverActorCancelacionMesa,
  validarMotivoCancelacionMesa,
} from "@/lib/mesa-pedido-cancelacion"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO Operaciones — Cancelar pedido de mesa (23-A1)
// ============================================
// POST /api/operaciones/pedidos/[id]/cancelar   body: { motivo: string }
//
// Único endpoint para cancelar un pedido de mesa COMPLETO cargado por
// error, desde Mozo, Salón (personal o terminal) o Negocio/admin. El actor
// se resuelve EXCLUSIVAMENTE desde la sesión (nunca desde negocioId/rol/
// área/mesaId/ocupacionId enviados por el cliente). Sin UI (23-A2). Origen
// ya validado centralmente por el middleware para todo `/api/operaciones/**`
// mutante (src/proxy.ts, ORIGIN_PROTECTED_PREFIXES) — no se duplica acá.
//
// No cacheable (Cache-Control: private, no-store, mismo patrón que el resto
// de /api/operaciones y /api/negocio/pedidos).

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

function noStoreJson(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS })
}

const ALLOWED_KEYS = new Set(["motivo"])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: pedidoId } = await params

    // 1) Body: JSON estricto, únicamente la clave `motivo` permitida. Nunca
    // se acepta negocioId/empleadoId/usuarioId/actorType/mesaId/rol/área/
    // ocupacionId/estado/fecha desde el cliente (sección 9).
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return noStoreJson({ ok: false, error: "Solicitud inválida" }, 400)
    }
    if (Object.keys(body as Record<string, unknown>).some((key) => !ALLOWED_KEYS.has(key))) {
      return noStoreJson({ ok: false, error: "Solicitud inválida" }, 400)
    }

    const motivoValidacion = validarMotivoCancelacionMesa((body as Record<string, unknown>).motivo)
    if (!motivoValidacion.ok) {
      return noStoreJson({ ok: false, error: motivoValidacion.error }, 400)
    }

    // 2) Actor EXCLUSIVAMENTE desde sesión, ya acotado al negocio real del
    // pedido (o 404 genérico si el pedido no existe / es de otro negocio —
    // misma respuesta para ambos casos, nunca se distingue por mensaje).
    const authResult = await resolverActorCancelacionMesa(req, pedidoId)
    if (!authResult.ok) {
      const mensaje =
        authResult.status === 401
          ? "No autenticado"
          : authResult.status === 403
            ? "No tenés permiso para cancelar este pedido"
            : "Pedido no encontrado"
      return noStoreJson({ ok: false, error: mensaje }, authResult.status)
    }

    // 3) Cancelación atómica (CAS + transacción Serializable, dentro de
    // cancelarPedidoMesa — ver src/lib/mesa-pedido-cancelacion.ts).
    const resultado = await cancelarPedidoMesa({
      pedidoId,
      motivo: motivoValidacion.motivo,
      actor: authResult.actor,
    })

    switch (resultado.kind) {
      case "not_found":
        return noStoreJson({ ok: false, error: "Pedido no encontrado" }, 404)
      case "forbidden":
        return noStoreJson({ ok: false, error: "No tenés permiso para cancelar este pedido" }, 403)
      case "invalid_estado":
      case "conflict":
        return noStoreJson(
          { ok: false, error: "El pedido cambió en otro dispositivo o ya no se puede cancelar. Actualizá el panel." },
          409
        )
      case "sin_ocupacion":
        return noStoreJson(
          {
            ok: false,
            code: "sin_ocupacion",
            error: "El pedido de mesa no está vinculado a una ocupación activa y no se puede cancelar de forma segura.",
          },
          409
        )
      case "server_error":
        return noStoreJson({ ok: false, error: "Error del servidor" }, 500)
      case "ok":
        break
    }

    // 4) Respuesta pequeña y segura: nunca negocio/cookies/tokens/sesión/otros
    // pedidos (sección 16).
    return noStoreJson(
      {
        ok: true,
        pedido: {
          id: pedidoId,
          estado: "cancelado",
          canceladoEn: resultado.canceladoFecha.toISOString(),
          motivoCancelacion: resultado.motivo,
        },
      },
      200
    )
  } catch (error) {
    console.error("[OperacionesCancelarPedido] Error al cancelar pedido de mesa:", safeErrorForLog(error))
    return noStoreJson({ ok: false, error: "Error del servidor" }, 500)
  }
}
