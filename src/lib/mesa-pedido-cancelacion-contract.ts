// ============================================
// DeliGO — Contrato client-safe de cancelación de pedidos de mesa (23-A2)
// ============================================
// Extracción mínima y puramente aditiva desde src/lib/mesa-pedido-cancelacion.ts
// (23-A1): sin Prisma, sin `next/server`, sin autenticación — solo las
// constantes/funciones puras que la UI necesita para decidir visibilidad y
// validar el motivo ANTES de enviarlo, sin duplicar la fuente de verdad.
// mesa-pedido-cancelacion.ts (server-only) reexporta estos mismos símbolos —
// route.ts y mesa-pedido-cancelacion.test.ts siguen importando desde ahí sin
// ningún cambio de comportamiento, status code ni autorización.
//
// La UI nunca es la autoridad: esta validación/visibilidad es solo una
// mejora de experiencia (evita mostrar una acción que el servidor rechazaría
// de entrada, o enviar un motivo que el servidor ya sabe que va a rechazar).
// La decisión real sigue siendo exclusiva de cancelarPedidoMesa/
// resolverActorCancelacionMesa en el servidor.

import { ESTADOS_PENDIENTES_MESA } from "@/lib/mesa-cuenta"

// Reexportado tal cual — misma allowlist que ya usa el CAS server-side
// (sección 7 de 23-A1) y buildCuentaMesa (P2). Nunca se duplica un array
// nuevo: importar de acá es importar la MISMA referencia que el servidor.
export { ESTADOS_PENDIENTES_MESA }

export const MOTIVO_CANCELACION_MIN_LEN = 5
export const MOTIVO_CANCELACION_MAX_LEN = 500

export type ValidacionMotivoCancelacion =
  | { ok: true; motivo: string }
  | { ok: false; error: string }

/**
 * Idéntica a la validación server-side (mesa-pedido-cancelacion.ts) — solo
 * hace `trim()` y valida longitud, nunca elimina/transforma contenido
 * válido del motivo.
 */
export function validarMotivoCancelacionMesa(value: unknown): ValidacionMotivoCancelacion {
  if (typeof value !== "string") {
    return { ok: false, error: "El motivo de cancelación es obligatorio." }
  }
  const motivo = value.trim()
  if (motivo.length < MOTIVO_CANCELACION_MIN_LEN) {
    return {
      ok: false,
      error: `El motivo debe tener al menos ${MOTIVO_CANCELACION_MIN_LEN} caracteres.`,
    }
  }
  if (motivo.length > MOTIVO_CANCELACION_MAX_LEN) {
    return {
      ok: false,
      error: `El motivo no puede superar los ${MOTIVO_CANCELACION_MAX_LEN} caracteres.`,
    }
  }
  return { ok: true, motivo }
}

/**
 * Decide únicamente si la UI debe OFRECER la acción — nunca autoriza nada.
 * Deny-by-default: allowlist cerrada de estados (misma que el CAS
 * server-side) + método de entrega exactamente "mesa". Un estado o método
 * desconocido/con forma inesperada siempre oculta la acción, nunca la
 * muestra "por si acaso".
 */
export function puedeMostrarCancelacionPedidoMesa(pedido: {
  estado: unknown
  metodoEntrega: unknown
}): boolean {
  if (pedido.metodoEntrega !== "mesa") return false
  if (typeof pedido.estado !== "string") return false
  return (ESTADOS_PENDIENTES_MESA as readonly string[]).includes(pedido.estado)
}

/**
 * Gate puro para el botón "Confirmar cancelación" del diálogo — nunca
 * autoriza nada, solo decide si tiene sentido dejar clickear el botón.
 * Deshabilitado cuando: falta `pedidoId`, el pedido dejó de ser elegible,
 * hay una solicitud en curso, o el motivo (ya con trim aplicado) no pasa la
 * validación mínima/máxima.
 */
export function puedeConfirmarCancelacionPedidoMesa(state: {
  pedidoId: string | null | undefined
  motivo: string
  submitting: boolean
  elegible: boolean
}): boolean {
  if (!state.pedidoId) return false
  if (!state.elegible) return false
  if (state.submitting) return false
  return validarMotivoCancelacionMesa(state.motivo).ok
}
