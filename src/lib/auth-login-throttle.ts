import { createHash } from "crypto"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO — Login throttle por cuenta/identificador (AUTH-LOGIN-THROTTLE-HARDENING)
// ============================================
// Segunda dimensión de defensa contra fuerza bruta/credential stuffing,
// independiente del límite por IP existente (src/lib/rate-limit.ts, que
// permanece en memoria de proceso sin cambios de arquitectura). Esta
// dimensión vive en PostgreSQL (modelo LoginThrottle) para ser compartida
// entre réplicas y sobrevivir a restart/deploy — precisamente lo que la
// dimensión IP no puede garantizar.
//
// Reglas invariantes de este módulo:
// - Cuenta EXCLUSIVAMENTE fallos de login (cuenta inexistente o contraseña
//   incorrecta) — nunca intentos exitosos, nunca estados de negocio
//   posteriores a la verificación de contraseña (email no verificado,
//   negocio no aprobado/suspendido, repartidor inactivo, etc.).
// - El pre-check (checkLoginAccountThrottle) NUNCA incrementa el contador —
//   sólo lee. Sólo recordLoginFailure() escribe un fallo.
// - La clave (throttleKey) es opaca: SHA-256 de "accountType:identifier",
//   nunca el identificador en claro, nunca la contraseña, nunca la IP. Este
//   módulo NO normaliza el identificador — cada ruta de login debe pasar
//   exactamente el mismo valor normalizado que usa para su propio lookup de
//   cuenta (mismo .toLowerCase().trim() que ya usa hoy), para que la clave
//   de throttle y el lookup real nunca diverjan.
// - Ventana fija (no sliding window): al expirar, el siguiente fallo abre
//   una ventana nueva; mientras esté activa, el reset_at existente se
//   preserva tal cual.
// - Ningún error de este store (Postgres caído, timeout, etc.) bloquea un
//   login legítimo: todas las operaciones fallan "abierto" (permiten que el
//   login siga su curso normal) pero SIEMPRE logueando el error de forma
//   sanitizada — nunca un fallo silencioso e invisible, sólo no-bloqueante.
//   La dimensión IP sigue protegiendo en ese escenario degradado (es
//   exactamente el nivel de protección que existía antes de este hardening).

export type LoginAccountType = "cliente" | "negocio" | "repartidor" | "cuenta_operativa"

export const ACCOUNT_FAILURE_LIMIT = 10
export const ACCOUNT_WINDOW_MS = 10 * 60 * 1000

// PRE-COMMIT FINAL CORRECTION: mensaje 429 único, compartido por AMBAS
// dimensiones (IP y cuenta) en los endpoints de password login. Antes, cada
// dimensión tenía su propio texto ("en 5 minutos" vs "más tarde"), lo que
// permitía inferir cuál de las dos había disparado el bloqueo con sólo leer
// el body. Centralizado acá para que las dos rutas de login lo importen del
// mismo lugar y nunca puedan volver a divergir. Nunca menciona "IP",
// "cuenta", conteos ni el identificador — sólo el genérico ya usado en el
// resto de la base (ver rate-limit.ts, reset-password, forgot-password,
// superadmin/auth/google, operativo/mozos/unirse).
export const LOGIN_THROTTLE_MESSAGE = "Demasiados intentos. Intentá de nuevo más tarde."

/** SHA-256(accountType + ":" + normalizedIdentifier) — nunca el identificador en claro. */
export function loginThrottleKey(accountType: LoginAccountType, normalizedIdentifier: string): string {
  return createHash("sha256").update(`${accountType}:${normalizedIdentifier}`).digest("hex")
}

export interface LoginThrottleRowSnapshot {
  count: number
  resetAt: Date
}

export interface LoginThrottleDecision {
  allowed: boolean
  /** true si existe una ventana activa (aunque todavía esté por debajo del límite) — usado para saber si un éxito posterior debe limpiar la fila. */
  hadActiveFailures: boolean
  retryAfterMs?: number
}

/**
 * Lógica pura de decisión — sin DB, testeable en aislamiento. No incrementa
 * nada; sólo interpreta el estado ya leído.
 */
export function decideLoginThrottle(row: LoginThrottleRowSnapshot | null, now: Date): LoginThrottleDecision {
  if (!row || row.resetAt.getTime() <= now.getTime()) {
    return { allowed: true, hadActiveFailures: false }
  }
  if (row.count >= ACCOUNT_FAILURE_LIMIT) {
    return { allowed: false, hadActiveFailures: true, retryAfterMs: row.resetAt.getTime() - now.getTime() }
  }
  return { allowed: true, hadActiveFailures: true }
}

/**
 * Pre-auth check. CRÍTICO: sólo lee — nunca incrementa el contador. Falla
 * abierto (allowed:true) ante un error inesperado del store, degradando a la
 * protección IP-only que ya existía, nunca bloqueando el login por una falla
 * de infraestructura ajena al usuario.
 */
export async function checkLoginAccountThrottle(throttleKey: string): Promise<LoginThrottleDecision> {
  try {
    const row = await db.loginThrottle.findUnique({
      where: { throttleKey },
      select: { count: true, resetAt: true },
    })
    return decideLoginThrottle(row, new Date())
  } catch (error) {
    console.error("[LoginThrottle] check failed (failing open):", safeErrorForLog(error))
    return { allowed: true, hadActiveFailures: false }
  }
}

export interface LoginFailureResult {
  count: number
  resetAt: Date
  throttled: boolean
  retryAfterMs?: number
}

// Cleanup oportunista: acotado a un proceso, sin cron ni servicio nuevo. Se
// evalúa desde recordLoginFailure() (el único punto de escritura frecuente
// de esta tabla) como máximo una vez cada CLEANUP_INTERVAL_MS por proceso.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
// Retención: igual criterio que el sweep de src/lib/rate-limit.ts — no borra
// apenas expira, conserva 1h por si sirve para diagnóstico/soporte.
const CLEANUP_RETENTION_MS = 60 * 60 * 1000
let lastCleanupAt = 0

async function opportunisticCleanup(): Promise<void> {
  const now = Date.now()
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return
  lastCleanupAt = now
  try {
    await db.loginThrottle.deleteMany({
      where: { resetAt: { lt: new Date(now - CLEANUP_RETENTION_MS) } },
    })
  } catch (error) {
    console.error("[LoginThrottle] opportunistic cleanup failed (non-blocking):", safeErrorForLog(error))
    // Nunca debe corromper ni bloquear recordLoginFailure() — por eso es
    // fire-and-forget desde el llamador, nunca en el camino crítico.
  }
}

/**
 * Registra UN fallo de forma atómica (upsert nativo de Postgres —
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING, tagged template
 * parametrizado, nunca $queryRawUnsafe ni concatenación de strings).
 * Ventana fija: si la fila no existe o su ventana expiró, arranca una nueva
 * (count=1); si existe y sigue activa, incrementa preservando su resetAt
 * original. Falla abierto (retorna null) ante un error inesperado — el
 * llamador debe tratar null como "no throttled" (mismo criterio de
 * degradación que checkLoginAccountThrottle).
 */
export async function recordLoginFailure(throttleKey: string): Promise<LoginFailureResult | null> {
  void opportunisticCleanup()

  const now = new Date()
  const freshResetAt = new Date(now.getTime() + ACCOUNT_WINDOW_MS)

  try {
    const rows = await db.$queryRaw<{ count: number; reset_at: Date }[]>`
      INSERT INTO "login_throttle" ("throttle_key", "count", "reset_at", "updated_at")
      VALUES (${throttleKey}, 1, ${freshResetAt}, NOW())
      ON CONFLICT ("throttle_key") DO UPDATE SET
        "count" = CASE WHEN "login_throttle"."reset_at" <= NOW() THEN 1 ELSE "login_throttle"."count" + 1 END,
        "reset_at" = CASE WHEN "login_throttle"."reset_at" <= NOW() THEN EXCLUDED."reset_at" ELSE "login_throttle"."reset_at" END,
        "updated_at" = NOW()
      RETURNING "count", "reset_at"
    `
    const row = rows[0]
    if (!row) return null

    const throttled = row.count >= ACCOUNT_FAILURE_LIMIT
    return {
      count: row.count,
      resetAt: row.reset_at,
      throttled,
      retryAfterMs: throttled ? row.reset_at.getTime() - now.getTime() : undefined,
    }
  } catch (error) {
    console.error("[LoginThrottle] record failure failed (failing open):", safeErrorForLog(error))
    return null
  }
}

/**
 * Limpia los fallos previos de una cuenta tras un login exitoso. El
 * llamador sólo debe invocar esto cuando el pre-check ya reportó
 * hadActiveFailures=true — nunca en el camino normal (0 fallos previos), que
 * no debe escribir nada en esta tabla.
 */
export async function clearLoginFailures(throttleKey: string): Promise<void> {
  try {
    await db.loginThrottle.deleteMany({ where: { throttleKey } })
  } catch (error) {
    console.error("[LoginThrottle] clear failed (non-blocking):", safeErrorForLog(error))
    // Fail-open: como mucho deja una fila obsoleta que expirará sola — nunca
    // bloquea el login exitoso que ya ocurrió.
  }
}
