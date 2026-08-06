"use client"

// ============================================
// DeliGO — Cliente compartido de cancelación de pedidos de mesa (23-A2)
// ============================================
// Lógica pura de fetch/clasificación para el endpoint canónico
// POST /api/operaciones/pedidos/[id]/cancelar (23-A1). Sin React, sin estado
// propio — mismo patrón que src/lib/mesa-occupancy-client.ts. El body
// enviado contiene EXCLUSIVAMENTE `motivo`: nunca negocioId/rol/mesaId/
// ocupacionMesaId/estado/identidad — toda la autoridad sigue siendo del
// servidor. No duplicar este fetch en cada superficie (Mozo/Salón
// personal/Salón terminal/Negocio); todas deben reusar este módulo.
//
// Mensajes SIEMPRE propios (allowlist cerrada) — nunca se interpola
// ciegamente `error` de la respuesta del servidor, salvo el discriminador
// `code` para distinguir el 409 de "sin_ocupacion" del 409 genérico.

export interface CancelarPedidoMesaExito {
  id: string
  estado: string
  canceladoEn: string
  motivoCancelacion: string
}

export type CancelarPedidoMesaErrorOutcome =
  | { kind: "bad_request" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "sin_ocupacion" }
  | { kind: "conflict" }
  | { kind: "server_error" }
  | { kind: "network_error" }

export type CancelarPedidoMesaOutcome =
  | { kind: "ok"; pedido: CancelarPedidoMesaExito }
  | CancelarPedidoMesaErrorOutcome

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Único punto de llamada al endpoint 23-A1. El `id` va solo en la ruta
 * (`encodeURIComponent`), el body es exactamente `{ motivo }` — ya
 * normalizado (trim aplicado) por el llamador antes de invocar esto.
 */
export async function cancelarPedidoMesaRequest(
  pedidoId: string,
  motivo: string,
  signal?: AbortSignal
): Promise<CancelarPedidoMesaOutcome> {
  let res: Response
  try {
    res = await fetch(`/api/operaciones/pedidos/${encodeURIComponent(pedidoId)}/cancelar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return { kind: "network_error" }
  }

  const data: unknown = await res.json().catch(() => null)

  if (res.status === 200) {
    if (isRecord(data) && data.ok === true && isRecord(data.pedido)) {
      const p = data.pedido
      if (
        typeof p.id === "string" &&
        typeof p.estado === "string" &&
        typeof p.canceladoEn === "string" &&
        typeof p.motivoCancelacion === "string"
      ) {
        return {
          kind: "ok",
          pedido: {
            id: p.id,
            estado: p.estado,
            canceladoEn: p.canceladoEn,
            motivoCancelacion: p.motivoCancelacion,
          },
        }
      }
    }
    // 200 con forma inesperada: nunca se trata como éxito sin confirmar el shape.
    return { kind: "server_error" }
  }

  if (res.status === 400) return { kind: "bad_request" }
  if (res.status === 401) return { kind: "unauthorized" }
  if (res.status === 403) return { kind: "forbidden" }
  if (res.status === 404) return { kind: "not_found" }
  if (res.status === 409) {
    if (isRecord(data) && data.code === "sin_ocupacion") {
      return { kind: "sin_ocupacion" }
    }
    return { kind: "conflict" }
  }

  return { kind: "server_error" }
}

/**
 * Allowlist cerrada de mensajes — nunca texto del servidor. `switch`
 * exhaustivo: si se agrega un nuevo `kind` sin mapearlo acá, TypeScript
 * marca error de compilación (nunca cae a un `default` silencioso).
 */
export function mensajeCancelarPedidoMesa(outcome: CancelarPedidoMesaErrorOutcome): string {
  switch (outcome.kind) {
    case "bad_request":
      return "Revisá el motivo ingresado."
    case "unauthorized":
      return "Tu sesión venció. Volvé a iniciar sesión."
    case "forbidden":
      return "No tenés permiso para cancelar este pedido."
    case "not_found":
      return "El pedido ya no está disponible."
    case "sin_ocupacion":
      return "Este pedido no está vinculado a una ocupación activa y no se puede cancelar desde acá."
    case "conflict":
      return "El pedido cambió y ya no puede cancelarse. Actualizamos la información."
    case "server_error":
    case "network_error":
      return "No se pudo cancelar el pedido. Intentá nuevamente."
  }
}

/**
 * Los únicos `kind` donde tiene sentido dejar el diálogo ABIERTO con el
 * motivo conservado para corregir/reintentar. En el resto (401/403/404) el
 * pedido/sesión ya no son válidos para esta operación — no hay nada que
 * reintentar acá.
 */
export function esErrorRecuperable(outcome: CancelarPedidoMesaErrorOutcome): boolean {
  return (
    outcome.kind === "bad_request" ||
    outcome.kind === "sin_ocupacion" ||
    outcome.kind === "conflict" ||
    outcome.kind === "server_error" ||
    outcome.kind === "network_error"
  )
}
