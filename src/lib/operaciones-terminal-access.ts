// ============================================
// DeliGO - Operaciones Terminal Access
// ============================================
// Helpers server-side de autorización para las futuras APIs operativas de terminal.
// La autoridad real es la TerminalOperativa (áreas + scopes) resuelta desde la cookie
// opaca por `resolveTerminalSession`. Nunca se confía en datos del cliente.
//
// Reglas:
//   - 401 si no hay sesión válida / vencida / revocada / terminal no activa.
//   - 403 si la sesión existe pero le falta el área o el scope requerido.
//   - Las respuestas de error nunca incluyen hashes, cookies, tokens, sesiones ni secretos.
//   - Siempre `Cache-Control: private, no-store`.
//   - Solo se aceptan áreas/scopes definidos en `operaciones-terminal-permissions.ts`.

import { NextResponse, type NextRequest } from "next/server"
import {
  resolveTerminalSession,
  type TerminalSessionContext,
} from "@/lib/operaciones-terminal-auth"
import {
  OPERACIONES_AREAS,
  OPERACIONES_SCOPES,
  type OperacionesArea,
  type OperacionesScope,
} from "@/lib/operaciones-terminal-permissions"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

export type OperacionesAuthResult =
  | { ok: true; context: TerminalSessionContext }
  | { ok: false; response: NextResponse }

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Sesión de terminal no válida" },
    { status: 401, headers: NO_STORE_HEADERS }
  )
}

function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "La terminal no tiene permiso para esta operación" },
    { status: 403, headers: NO_STORE_HEADERS }
  )
}

/** Scope base de lectura por área. Un área solo está disponible si su base está presente. */
const AREA_BASE_SCOPE: Record<OperacionesArea, OperacionesScope> = {
  salon: "salon.ver",
  pyr: "pyr.ver",
}

/**
 * Un área está disponible cuando está en `terminal.areas` y además tiene su scope base
 * de lectura (`salon.ver` / `pyr.ver`). El área `mozo` y cualquier otra fuera del
 * allowlist nunca cuentan como disponibles.
 *
 * Tarea 20 (Dark Kitchen): el área "salon" ADEMÁS exige que el negocio
 * tenga la capacidad de Salón habilitada en este mismo instante
 * (`context.negocio.salonActivo`) — revalidado en CADA request, nunca
 * confiado desde el momento de activación de la terminal ni desde ningún
 * dato guardado en el cliente. El área "pyr" es completamente independiente
 * de Salón y nunca se ve afectada por esta condición.
 */
export function hasTerminalArea(context: TerminalSessionContext, area: OperacionesArea): boolean {
  if (!(OPERACIONES_AREAS as readonly string[]).includes(area)) return false
  if (!context.terminal.areas.includes(area) || !context.terminal.scopes.includes(AREA_BASE_SCOPE[area])) {
    return false
  }
  if (area === "salon" && context.negocio.salonActivo !== true) return false
  return true
}

/**
 * True si la terminal tiene el scope exacto (solo scopes del allowlist).
 *
 * Tarea 20: cualquier scope con prefijo `"salon."` exige ADEMÁS
 * `context.negocio.salonActivo` — varios endpoints de Salón autorizan por
 * scope concreto (`requireOperacionesScope`) en vez de por área
 * (`requireOperacionesArea`/`hasTerminalArea`, ya gateada arriba); este es
 * el punto único que cubre ambos estilos de autorización sin duplicar la
 * condición. Los scopes `"pyr."` nunca se ven afectados.
 */
export function hasTerminalScope(context: TerminalSessionContext, scope: OperacionesScope): boolean {
  if (!(OPERACIONES_SCOPES as readonly string[]).includes(scope)) return false
  if (!context.terminal.scopes.includes(scope)) return false
  if (scope.startsWith("salon.") && context.negocio.salonActivo !== true) return false
  return true
}

/** Exige una sesión de terminal válida y activa. 401 en caso contrario. */
export async function requireOperacionesTerminal(req: NextRequest): Promise<OperacionesAuthResult> {
  const context = await resolveTerminalSession(req)
  if (!context) return { ok: false, response: unauthorizedResponse() }
  return { ok: true, context }
}

/** Exige sesión válida + área disponible. 401 sin sesión, 403 sin el área. */
export async function requireOperacionesArea(
  req: NextRequest,
  area: OperacionesArea
): Promise<OperacionesAuthResult> {
  const base = await requireOperacionesTerminal(req)
  if (!base.ok) return base
  if (!hasTerminalArea(base.context, area)) return { ok: false, response: forbiddenResponse() }
  return base
}

/** Exige sesión válida + scope concreto. 401 sin sesión, 403 sin el scope. */
export async function requireOperacionesScope(
  req: NextRequest,
  scope: OperacionesScope
): Promise<OperacionesAuthResult> {
  const base = await requireOperacionesTerminal(req)
  if (!base.ok) return base
  if (!hasTerminalScope(base.context, scope)) return { ok: false, response: forbiddenResponse() }
  return base
}
