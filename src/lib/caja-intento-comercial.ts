// ============================================
// F4-C5 (D5, option B) — commercial attempts kept on this device (client side)
// ============================================
// A confirmation of an exchange or a linked additional sale is an ATTEMPT with
// its own Idempotency-Key and its exact body. Rules (operator, 2026-11-09):
//   - the key and the minimal data are stored BEFORE the first request is sent
//     (if they cannot be stored, nothing is sent);
//   - a confirmed or definitively refused operation is removed afterwards;
//   - an uncertain one (no answer, 500, timeout, 503) is kept until a SAFE
//     result: «Verificar operación» resends the SAME key and body to the
//     verification endpoint, which never performs the operation;
//   - review period: 7 days — an unresolved attempt older than that is shown
//     as overdue, NEVER removed silently;
//   - isolated by business + actor (owner / employee) + origin sale: another
//     session never reuses someone else's attempt;
//   - no tokens, passwords, credentials or bank data: only ids, quantities,
//     the reason text and the quoted amounts.
// localStorage does NOT protect against manual clearing, another browser or
// another device — the server-side verification is the authority.

export const INTENTO_REVISION_DIAS = 7
const PREFIX = "deligo:caja:intento-comercial:v1:"

export type TipoIntentoComercial = "CAMBIO" | "ADICIONAL"
export interface ContextoIntentoComercial {
  negocioId: string
  /** "NEGOCIO" (owner) or "EMPLEADO:<id>". */
  actor: string
}

export interface IntentoComercial {
  v: 1
  tipo: TipoIntentoComercial
  negocioId: string
  actor: string
  ventaOrigenId: string
  ventaOrigenReferencia: string
  key: string
  /** The exact JSON body sent (resent byte for byte on verification). */
  cuerpo: string
  /** Display only. */
  resumen: { lineas: string[]; importes?: Record<string, string> }
  /** ENVIANDO = stored, request in flight (a reload finds it uncertain). */
  estado: "ENVIANDO" | "INCIERTO"
  createdAt: number
  updatedAt: number
}

export const contextoActor = (actor: { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }) => (actor.tipo === "NEGOCIO" ? "NEGOCIO" : `EMPLEADO:${actor.empleadoId}`)

const claveAlmacen = (ctx: ContextoIntentoComercial, ventaOrigenId: string) => `${PREFIX}${ctx.negocioId}:${ctx.actor}:${ventaOrigenId}`

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function valido(value: unknown, ctx: ContextoIntentoComercial): value is IntentoComercial {
  const i = value as Partial<IntentoComercial> | null
  return Boolean(
    i && i.v === 1 && (i.tipo === "CAMBIO" || i.tipo === "ADICIONAL") &&
    i.negocioId === ctx.negocioId && i.actor === ctx.actor &&
    typeof i.ventaOrigenId === "string" && i.ventaOrigenId.length > 0 &&
    typeof i.key === "string" && UUID.test(i.key) &&
    typeof i.cuerpo === "string" && (i.estado === "ENVIANDO" || i.estado === "INCIERTO") &&
    typeof i.createdAt === "number" && typeof i.updatedAt === "number"
  )
}

/** The attempt of THIS context for this origin sale (another business/actor is never returned). */
export function leerIntento(ctx: ContextoIntentoComercial, ventaOrigenId: string): IntentoComercial | null {
  try {
    const raw = storage()?.getItem(claveAlmacen(ctx, ventaOrigenId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return valido(parsed, ctx) && parsed.ventaOrigenId === ventaOrigenId ? parsed : null
  } catch {
    return null
  }
}

/** Every unresolved attempt of this context (newest first). */
export function listarIntentos(ctx: ContextoIntentoComercial): IntentoComercial[] {
  const s = storage()
  if (!s) return []
  const prefijo = `${PREFIX}${ctx.negocioId}:${ctx.actor}:`
  const out: IntentoComercial[] = []
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (!k || !k.startsWith(prefijo)) continue
      const intento = leerIntento(ctx, k.slice(prefijo.length))
      if (intento) out.push(intento)
    }
  } catch {
    return out
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

/** false = it could not be stored (then the confirmation must NOT be sent). */
export function guardarIntento(intento: IntentoComercial): boolean {
  try {
    const s = storage()
    if (!s) return false
    const k = claveAlmacen(intento, intento.ventaOrigenId)
    s.setItem(k, JSON.stringify(intento))
    return s.getItem(k) !== null
  } catch {
    return false
  }
}

/** Only after a confirmed or definitively refused result. */
export function retirarIntento(ctx: ContextoIntentoComercial, ventaOrigenId: string): void {
  try {
    storage()?.removeItem(claveAlmacen(ctx, ventaOrigenId))
  } catch {
    // ignore: the attempt then stays visible until removed — never a silent duplicate
  }
}

export function intentoVencido(intento: Pick<IntentoComercial, "createdAt">, ahora = Date.now()): boolean {
  return ahora - intento.createdAt > INTENTO_REVISION_DIAS * 86_400_000
}

/**
 * Answer to a CONFIRMATION. null status = no HTTP answer.
 * 2xx = registered · 5xx / no answer = uncertain (it may have committed) ·
 * any other 4xx = definitively refused (the transaction rolled back, nothing
 * written — including INTENTO_CERRADO and IDEMPOTENCY_KEY_REUSED).
 */
export function clasificarConfirmacion(status: number | null): "registrado" | "incierto" | "rechazado" {
  if (status === null || status >= 500) return "incierto"
  if (status >= 200 && status < 300) return "registrado"
  return "rechazado"
}

/**
 * Answer to a VERIFICATION. Only these are SAFE results:
 *   REGISTRADO → the original result;
 *   NO_REGISTRADO → the key is closed (the original can never register);
 *   IDEMPOTENCY_KEY_REUSED → the key belongs to another operation, so this
 *     attempt's content can never register with it.
 * Anything else (no answer, 5xx, 503 VERIFICACION_INCIERTA, 401/403/404/400)
 * keeps the attempt uncertain — never an invented final state.
 */
export function clasificarVerificacion(status: number | null, body: { estado?: unknown; code?: unknown } | null): "registrado" | "no_registrado" | "clave_usada" | "incierto" {
  if (status === 200 && body?.estado === "REGISTRADO") return "registrado"
  if (status === 200 && body?.estado === "NO_REGISTRADO") return "no_registrado"
  if (status === 409 && body?.code === "IDEMPOTENCY_KEY_REUSED") return "clave_usada"
  return "incierto"
}
