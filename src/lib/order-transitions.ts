// P2-T29A — Order Transition Authority
// ============================================
// Autoridad compartida MÍNIMA y pura (sin DB/HTTP/Prisma/notificaciones/UI)
// para validar transiciones de `Pedido.estado`. Extraída para eliminar la
// duplicación real encontrada en la auditoría P2-T29 (al menos 3 copias
// independientes de reglas de transición: `VALID_TRANSITIONS` en
// negocio/pedidos/[id]/estado, `TRANSICIONES` en operaciones/pyr/pedidos/
// [id]/estado, `REQUIRED_CURRENT` en operaciones/salon/pedidos/[id]/estado).
//
// Esta autoridad expone DOS grafos deliberadamente distintos:
//   - ACTIVE_FORWARD_TRANSITIONS: el grafo REALMENTE vigente hoy en las APIs
//     productivas (sin `aceptado`/`esperando_repartidor`). Es lo único que
//     los endpoints consumen en T29A.
//   - TARGET_FORWARD_TRANSITIONS: el grafo objetivo de P2-T29
//     (codex-reports/P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md),
//     con `aceptado`/`esperando_repartidor` ya incluidos. NINGÚN endpoint lo
//     consume todavía — sólo existe para tests puros y como base lista para
//     T29B/T29C. Activarlo en una API productiva es explícitamente trabajo
//     de T29B/T29C, no de T29A.
//
// No es una state machine genérica ni usa ninguna librería externa — son
// tablas planas + funciones puras, deliberadamente pequeñas y legibles.

export type MetodoEntrega = "domicilio" | "retiro" | "mesa"

export const CANONICAL_ACCEPTED_STATE = "aceptado" as const
export const CANONICAL_WAITING_DRIVER_STATE = "esperando_repartidor" as const

// Decisiones de producto ya cerradas (P2-T29 audit + operador) — no abiertas,
// no re-preguntar. Documentadas aquí como valores nombrados y cubiertas por
// test puro, aunque T29A no las active todavía en ninguna API.
export const CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO = true
export const MESA_PASA_POR_ACEPTADO = false

export const TERMINAL_ESTADOS = ["entregado", "cancelado"] as const

export function isTerminalEstado(estado: string): boolean {
  return (TERMINAL_ESTADOS as readonly string[]).includes(estado)
}

type ForwardGraph = Record<MetodoEntrega, Record<string, string[]>>

// Grafo ACTIVO — exactamente el comportamiento real vigente hoy, reconstruido
// de las 3 tablas existentes (nunca más permisivo que la unión real de las
// combinaciones que la UI de cada rol efectivamente puede disparar):
//   - domicilio: recibido→preparando→en_camino (en_camino→entregado lo maneja
//     el repartidor, no Negocio/Operaciones — fuera de esta autoridad)
//   - retiro: recibido→preparando→listo_para_retirar→entregado
//   - mesa: recibido→preparando→listo_para_retirar→entregado
export const ACTIVE_FORWARD_TRANSITIONS: ForwardGraph = {
  domicilio: {
    recibido: ["preparando"],
    preparando: ["en_camino"],
  },
  retiro: {
    recibido: ["preparando"],
    preparando: ["listo_para_retirar"],
    listo_para_retirar: ["entregado"],
  },
  mesa: {
    recibido: ["preparando"],
    preparando: ["listo_para_retirar"],
    listo_para_retirar: ["entregado"],
  },
}

// Grafo OBJETIVO (P2-T29) — con `aceptado`/`esperando_repartidor`. MESA
// deliberadamente NO recibe `aceptado` (MESA_PASA_POR_ACEPTADO=false): no
// existe la ventana de decisión remota que ese estado expone en
// domicilio/retiro (ver el audit, §2). Sin uso productivo en T29A.
export const TARGET_FORWARD_TRANSITIONS: ForwardGraph = {
  domicilio: {
    recibido: [CANONICAL_ACCEPTED_STATE],
    [CANONICAL_ACCEPTED_STATE]: ["preparando"],
    preparando: [CANONICAL_WAITING_DRIVER_STATE],
    [CANONICAL_WAITING_DRIVER_STATE]: ["en_camino"],
    en_camino: ["entregado"],
  },
  retiro: {
    recibido: [CANONICAL_ACCEPTED_STATE],
    [CANONICAL_ACCEPTED_STATE]: ["preparando"],
    preparando: ["listo_para_retirar"],
    listo_para_retirar: ["entregado"],
  },
  mesa: {
    recibido: ["preparando"],
    preparando: ["listo_para_retirar"],
    listo_para_retirar: ["entregado"],
  },
}

/**
 * Valida una transición NO-cancelación contra un grafo dado (activo u
 * objetivo). Cancelación se valida por separado (ver canTransitionToCancelled)
 * porque cualquier estado no-terminal puede cancelarse, independientemente
 * del grafo "hacia adelante".
 */
export function isValidForwardTransition(
  graph: ForwardGraph,
  metodoEntrega: MetodoEntrega,
  estadoActual: string,
  estadoNuevo: string
): boolean {
  const allowed = graph[metodoEntrega]?.[estadoActual]
  return Array.isArray(allowed) && allowed.includes(estadoNuevo)
}

// Estados no-terminales desde los que hoy se permite cancelar (idéntico para
// las 3 modalidades: cualquier no-terminal). `target` agrega los 2 estados
// nuevos, reflejando CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO — sin uso productivo
// en T29A, sólo para test puro.
const CANCELLABLE_STATES_ACTIVE = ["recibido", "preparando", "en_camino", "listo_para_retirar"]
const CANCELLABLE_STATES_TARGET = [
  ...CANCELLABLE_STATES_ACTIVE,
  CANONICAL_ACCEPTED_STATE,
  CANONICAL_WAITING_DRIVER_STATE,
]

export function canTransitionToCancelled(estado: string, graph: "active" | "target" = "active"): boolean {
  const list = graph === "target" ? CANCELLABLE_STATES_TARGET : CANCELLABLE_STATES_ACTIVE
  return list.includes(estado)
}
