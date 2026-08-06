import type { MesaClienteCuentaActiva, MesaClienteCuentaOutcome } from "@/lib/mesa-cliente-cuenta-client"

// ============================================
// DeliGO — Máquina de estados pura de la cuenta pública de mesa (23-B)
// ============================================
// Sin React: decide qué debe mostrar la UI a partir del último resultado de
// fetch y del último dato bueno conocido — testeable sin infraestructura
// DOM (no hay React Testing Library/Playwright/Vitest en el repo, ver
// mesa-pedido-cancelacion-ui-contract.test.ts de 23-A2 para el mismo
// criterio ya aplicado antes).
//
// Reglas (sección 18/31 del prompt 23-B):
//   - "sin_sesion" nunca se muestra como error — la mayoría de las mesas
//     nunca tendrán una cuenta pública activa (geocerca no calibrada,
//     cliente que todavía no fue confirmado "inside"), así que no es un
//     estado alarmante: el panel simplemente no se muestra ("hidden").
//   - "cerrada" SIEMPRE se muestra (mensaje fijo), incluso si after un
//     fetch fallido posterior — una vez que sabemos que la sesión propia de
//     esta mesa terminó, no hay "dato más fresco" que la contradiga.
//   - Un fetch fallido con datos previos "activa" buenos: se conservan los
//     datos previos pero marcados `stale`, nunca se ocultan de golpe (no
//     queremos parpadeo por una falla de red transitoria) y nunca se
//     muestran como si fueran frescos (se expone `stale: true` para que la
//     UI lo indique).
//   - Un fetch fallido SIN dato previo bueno: estado "error" explícito con
//     reintento manual — nunca se inventa un total ni se asume "sin_sesion".
//   - Un cambio de `sessionKey` (slug+mesa) SIEMPRE resetea a "loading" —
//     nunca debe mostrarse la cuenta de una mesa anterior mientras se
//     valida la nueva (evita el parpadeo de datos obsoletos de OTRA mesa).

export interface MesaClienteCuentaUiInput {
  /** Identifica la mesa/negocio actuales (ej. `${slug}:${mesaNumero}`) — un cambio fuerza "loading". */
  sessionKey: string
  /** Clave de sesión con la que se obtuvo el último resultado bueno conocido, si existe. */
  lastGoodSessionKey: string | null
  /** Último resultado de fetch, o `null` si todavía no se completó ninguno para `sessionKey`. */
  lastOutcome: MesaClienteCuentaOutcome | null
  /** Última cuenta "activa" conocida (de cualquier fetch anterior con éxito) — para no perderla ante un error transitorio. */
  lastGoodCuenta: MesaClienteCuentaActiva | null
  /** Hay un fetch en curso ahora mismo (primer intento o reintento manual). */
  fetching: boolean
}

export type MesaClienteCuentaUiState =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "cerrada" }
  | { kind: "activa"; cuenta: MesaClienteCuentaActiva; stale: boolean }
  | { kind: "error"; stale: false }

export function computeMesaClienteCuentaUiState(input: MesaClienteCuentaUiInput): MesaClienteCuentaUiState {
  const { sessionKey, lastGoodSessionKey, lastOutcome, lastGoodCuenta, fetching } = input

  // Cambio de mesa/negocio: nunca mostrar el dato de la sesión anterior,
  // ni siquiera como "stale" — es una cuenta de OTRA ocupación.
  const goodCuentaApplies = lastGoodSessionKey === sessionKey ? lastGoodCuenta : null

  if (lastOutcome === null) {
    return { kind: "loading" }
  }

  if (lastOutcome.kind === "sin_sesion") {
    return { kind: "hidden" }
  }

  if (lastOutcome.kind === "cerrada") {
    return { kind: "cerrada" }
  }

  if (lastOutcome.kind === "activa") {
    return { kind: "activa", cuenta: lastOutcome.cuenta, stale: false }
  }

  // lastOutcome.kind === "error"
  if (goodCuentaApplies) {
    return { kind: "activa", cuenta: goodCuentaApplies, stale: true }
  }
  if (fetching) {
    return { kind: "loading" }
  }
  return { kind: "error", stale: false }
}
