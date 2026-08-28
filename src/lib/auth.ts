import { randomUUID, createHash } from "crypto"
import type { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

// ============================================
// Password utilities (using Web Crypto API - native, no bcryptjs)
// ============================================
// PASSWORD-HASH-WORKFACTOR-MIGRATION: dos formatos conviven a propósito.
// LEGACY (`<saltHex>:<keyHex>`, PBKDF2-HMAC-SHA256, 100000 iteraciones) sigue
// verificándose exactamente como siempre — nunca se le exige un reset. Toda
// escritura NUEVA (hashPassword) emite únicamente el formato versionado v2
// (`v2$pbkdf2-sha256$<iterations>$<saltHex>$<keyHex>`, 600000 iteraciones
// hoy). Un hash legacy verificado con éxito se re-hashea de forma oportunista
// SÓLO desde el punto de login correspondiente (ver auth/login/route.ts y
// operativo/login/route.ts) vía `src/lib/password-hash-upgrade.ts` — nunca
// acá, este archivo permanece sin ninguna dependencia de Prisma en esta
// sección, exactamente como antes de esta migración.
//
// Deliberadamente SIN aplicar la política central de contraseñas
// (longitud/blocklist, definida en otro módulo) — nunca en este archivo, y
// es lo que permite seguir re-hasheando passwords legacy de 6-9 caracteres
// sin romper su login.

const PBKDF2_ITERATIONS_LEGACY = 100000
const PBKDF2_ITERATIONS_CURRENT = 600000
const SALT_LENGTH = 16
const KEY_LENGTH = 32
const PASSWORD_HASH_VERSION_CURRENT = "v2"
const PASSWORD_HASH_ALGORITHM_CURRENT = "pbkdf2-sha256"
// Cota defensiva contra un valor de iteraciones corrupto/manipulado en la
// columna DB — nunca confiar ciegamente en un costo leído de storage antes
// de derivar PBKDF2 con él (evita un costo arbitrariamente alto por una fila
// dañada). 100000 = piso (nunca más débil que legacy); 2000000 = techo.
const MIN_SUPPORTED_V2_ITERATIONS = 100000
const MAX_SUPPORTED_V2_ITERATIONS = 2000000

// Forma legacy EXACTA: 32 hex (salt de 16 bytes) + ":" + 64 hex (key de 32
// bytes), nada más — un tercer ":", hex inválido o longitud distinta no
// matchea (los grupos capturados ya vienen validados como hex por el regex).
const LEGACY_HASH_PATTERN = /^([0-9a-fA-F]{32}):([0-9a-fA-F]{64})$/
const V2_ITERATIONS_PATTERN = /^[1-9][0-9]*$/
const V2_SALT_HEX_PATTERN = /^[0-9a-fA-F]{32}$/
const V2_KEY_HEX_PATTERN = /^[0-9a-fA-F]{64}$/

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8
  )
  return new Uint8Array(bits)
}

function toHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

// Comparación en tiempo constante respecto del CONTENIDO de ambos buffers.
// El único early-return no-constante-en-tiempo es por longitud, que nunca es
// un secreto (es un parámetro de protocolo fijo por formato).
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS_CURRENT)
  return `${PASSWORD_HASH_VERSION_CURRENT}$${PASSWORD_HASH_ALGORITHM_CURRENT}$${PBKDF2_ITERATIONS_CURRENT}$${toHex(salt)}$${toHex(key)}`
}

export interface PasswordHashEvaluation {
  /** true si `password` matchea `storedHash` (en cualquiera de los 2 formatos soportados). */
  valid: boolean
  /**
   * true sólo si `valid===true` Y el hash almacenado está por debajo del
   * costo actual (legacy siempre; v2 con iterations < PBKDF2_ITERATIONS_CURRENT).
   * Nunca true para un hash inválido/no reconocido, ni para un v2 con costo
   * igual o mayor al actual (nunca degradar un hash más fuerte).
   */
  needsUpgrade: boolean
}

const INVALID_EVALUATION: PasswordHashEvaluation = { valid: false, needsUpgrade: false }

/**
 * Parsea y verifica `storedHash` UNA sola vez, devolviendo tanto si la
 * contraseña es correcta como si el hash debería re-hashearse a v2 actual.
 * Fail-closed ante cualquier formato desconocido/malformado — nunca lanza.
 */
export async function evaluatePasswordHash(password: string, storedHash: string): Promise<PasswordHashEvaluation> {
  if (storedHash.startsWith("v2$")) {
    const parts = storedHash.split("$")
    if (parts.length !== 5) return INVALID_EVALUATION
    const [version, algorithm, iterationsRaw, saltHex, keyHex] = parts
    if (version !== PASSWORD_HASH_VERSION_CURRENT) return INVALID_EVALUATION
    if (algorithm !== PASSWORD_HASH_ALGORITHM_CURRENT) return INVALID_EVALUATION
    if (!V2_ITERATIONS_PATTERN.test(iterationsRaw)) return INVALID_EVALUATION
    const iterations = Number(iterationsRaw)
    if (!Number.isSafeInteger(iterations)) return INVALID_EVALUATION
    if (iterations < MIN_SUPPORTED_V2_ITERATIONS || iterations > MAX_SUPPORTED_V2_ITERATIONS) return INVALID_EVALUATION
    if (!V2_SALT_HEX_PATTERN.test(saltHex)) return INVALID_EVALUATION
    if (!V2_KEY_HEX_PATTERN.test(keyHex)) return INVALID_EVALUATION

    const salt = fromHex(saltHex)
    const storedKey = fromHex(keyHex)
    const derivedKey = await deriveKey(password, salt, iterations)
    if (!constantTimeEqual(derivedKey, storedKey)) return INVALID_EVALUATION

    return { valid: true, needsUpgrade: iterations < PBKDF2_ITERATIONS_CURRENT }
  }

  // Versión desconocida (cualquier prefijo que no sea "v2$" pero que tampoco
  // matchee la forma legacy exacta de abajo) cae acá y falla cerrado igual.
  const legacyMatch = LEGACY_HASH_PATTERN.exec(storedHash)
  if (!legacyMatch) return INVALID_EVALUATION
  const [, saltHex, keyHex] = legacyMatch

  const salt = fromHex(saltHex)
  const storedKey = fromHex(keyHex)
  const derivedKey = await deriveKey(password, salt, PBKDF2_ITERATIONS_LEGACY)
  if (!constantTimeEqual(derivedKey, storedKey)) return INVALID_EVALUATION

  return { valid: true, needsUpgrade: true }
}

/** Wrapper delgado sobre evaluatePasswordHash — preserva la API/firma existente para todos los call-sites que sólo necesitan el booleano. */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return (await evaluatePasswordHash(password, hash)).valid
}

// ============================================
// Session token generation
// ============================================

export function generateSessionToken(): string {
  return randomUUID()
}

// ============================================
// Session token hashing (Seguridad-5D)
// ============================================
// El token real (el que recibe el cliente) solo vive en la cookie httpOnly.
// En base de datos, Sesion.token guarda únicamente su hash SHA-256 — así, un
// acceso de lectura a la base (backup filtrado, dump expuesto, etc.) nunca
// alcanza para usar una sesión ajena directamente, a diferencia de guardar el
// token en texto plano.

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

// Busca la fila de Sesion para el token real de una cookie: primero por su
// hash (formato actual), y si no aparece, por el token en texto plano
// (compatibilidad con sesiones creadas antes de Seguridad-5D). Si encuentra
// una fila legacy, la migra oportunísticamente a hash antes de devolverla.
// Nunca lanza: ante una carrera concurrente migrando la misma fila (P2025) o
// una colisión de unique (P2002, extremadamente improbable con SHA-256), se
// prefiere reintentar la búsqueda por hash (la sesión ya migrada por la otra
// request en curso) antes de tratar la legacy como inválida — nunca un 500.
export async function findSesionByToken(token: string) {
  const hashed = hashSessionToken(token)
  const byHash = await db.sesion.findUnique({ where: { token: hashed } })
  if (byHash) return byHash

  const legacy = await db.sesion.findUnique({ where: { token } })
  if (!legacy) return null

  try {
    return await db.sesion.update({ where: { token }, data: { token: hashed } })
  } catch {
    return db.sesion.findUnique({ where: { token: hashed } }).catch(() => null)
  }
}

// Autoridad de vigencia por Sesion.id (nunca por token) para el chequeo de
// sesión en connect-time del realtime socket (P2-T11). Misma regla que
// validateSession (fila existe + expiresAt futuro), pero de sólo lectura —
// nunca borra una fila vencida, a diferencia de validateSession, porque este
// helper responde una pregunta de otro proceso y no posee la sesión.
export async function isSesionActiveById(sid: string): Promise<boolean> {
  const session = await db.sesion.findUnique({
    where: { id: sid },
    select: { expiresAt: true },
  })
  return Boolean(session) && session!.expiresAt >= new Date()
}

// ============================================
// Cookie configuration
// ============================================

export const SESSION_COOKIE_NAME = "deligo_session"
export const OPERATIONAL_SESSION_COOKIE_NAME = "deligo_operativo_session"
export const SESSION_DURATION_HOURS = 12
export const OPERATIONAL_SESSION_USER_TYPE = "cuenta_operativa"

// P2-T18-BLOCKER-AUTH2-R2 (Phase 1): cookie con nombre por familia de actor,
// coexistiendo con SESSION_COOKIE_NAME (nunca reemplazada acá — sigue siendo
// la única cookie que los ~89 route handlers no tocados por esta fase leen).
// src/proxy.ts (Edge runtime) mantiene su PROPIA copia local de este mapeo
// (nunca importa este archivo, que carga Prisma vía @/lib/db) — ambas deben
// permanecer sincronizadas manualmente si esta lista cambia.
export type SessionFamily = "cliente" | "negocio" | "repartidor"

export const FAMILY_SESSION_COOKIE_NAMES: Record<SessionFamily, string> = {
  cliente: "deligo_session_cliente",
  negocio: "deligo_session_negocio",
  repartidor: "deligo_session_repartidor",
}

export function getFamilySessionCookieName(family: SessionFamily): string {
  return FAMILY_SESSION_COOKIE_NAMES[family]
}

// ============================================
// Session management (DB-backed)
// ============================================

// SESSION_LOGIN_ATOMICITY_DEBT: variante que acepta un Prisma.TransactionClient
// (además del singleton `db`, que lo satisface estructuralmente sin cast) para
// que loginCliente pueda insertar la Sesion dentro de la MISMA transacción que
// el backfill de dispositivoFingerprint y el enrichment SEC-BLOCK-1 — evita
// que un fallo posterior dentro de esa transacción deje una Sesion persistida
// sin que el cliente reciba la cookie que la referencia. Único lugar que
// genera el token, calcula expiresAt y hashea — createSession() de abajo es
// un wrapper delgado sobre esta función, nunca una implementación paralela.
export async function createSessionWithClient(
  client: Prisma.TransactionClient,
  userId: string,
  userType: UserType
): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS)

  await client.sesion.create({
    data: {
      token: hashSessionToken(token),
      userId,
      userType,
      expiresAt,
    },
  })

  // La cookie recibe el token real — nunca el hash.
  return token
}

export async function createSession(
  userId: string,
  userType: UserType
): Promise<string> {
  return createSessionWithClient(db, userId, userType)
}

export async function validateSession(
  token: string
): Promise<{ userId: string; userType: UserType } | null> {
  const session = await findSesionByToken(token)

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.sesion.delete({ where: { token: session.token } }).catch(() => {})
    return null
  }

  return { userId: session.userId, userType: session.userType as UserType }
}

export async function deleteSession(token: string): Promise<void> {
  // Cubre ambas representaciones posibles en una sola operación: el hash
  // (formato actual) y el token plano legacy, si todavía existiera.
  const hashed = hashSessionToken(token)
  await db.sesion.deleteMany({ where: { token: { in: [hashed, token] } } }).catch(() => {})
}

export async function createOperationalSession(
  cuentaOperativaId: string
): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS)

  await db.sesion.create({
    data: {
      token: hashSessionToken(token),
      userId: cuentaOperativaId,
      userType: OPERATIONAL_SESSION_USER_TYPE,
      expiresAt,
    },
  })

  // La cookie recibe el token real — nunca el hash.
  return token
}

export async function validateOperationalSession(
  token: string
): Promise<{ cuentaOperativaId: string } | null> {
  const session = await findSesionByToken(token)

  if (!session || session.userType !== OPERATIONAL_SESSION_USER_TYPE) return null
  if (session.expiresAt < new Date()) {
    await db.sesion.delete({ where: { token: session.token } }).catch(() => {})
    return null
  }

  return { cuentaOperativaId: session.userId }
}

export async function deleteOperationalSession(token: string): Promise<void> {
  // Cubre ambas representaciones posibles en una sola operación: el hash
  // (formato actual) y el token plano legacy, si todavía existiera.
  const hashed = hashSessionToken(token)
  await db.sesion.deleteMany({ where: { token: { in: [hashed, token] } } }).catch(() => {})
}

export async function getOperationalAccountFromRequest(
  req: NextRequest
): Promise<OperationalAccount | null> {
  const token = req.cookies.get(OPERATIONAL_SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const session = await validateOperationalSession(token)
  if (!session) return null

  const account = await db.cuentaOperativa.findFirst({
    where: {
      id: session.cuentaOperativaId,
      activo: true,
      eliminado: false,
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      activo: true,
      empleados: {
        where: {
          eliminado: false,
        },
        select: {
          id: true,
          nombre: true,
          codigo: true,
          rol: true,
          activo: true,
          negocio: {
            select: {
              id: true,
              nombre: true,
              slug: true,
            },
          },
        },
      },
    },
  })

  return account
}

// ============================================
// Get current user from session token
// ============================================

export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  const session = await validateSession(token)
  if (!session) return null

  const { userId, userType } = session

  try {
    switch (userType) {
      case "cliente": {
        const user = await db.cliente.findUnique({
          where: { id: userId },
          select: { id: true, nombre: true, email: true, telefono: true },
        })
        if (!user) return null
        return { ...user, type: "cliente" as const }
      }
      case "negocio": {
        const user = await db.negocio.findUnique({
          where: { id: userId },
          select: {
            id: true,
            nombre: true,
            slug: true,
            rubro: true,
            aprobado: true,
            suspendido: true,
            usuario: true,
          },
        })
        if (!user) return null
        return { ...user, type: "negocio" as const }
      }
      case "repartidor": {
        const user = await db.repartidor.findUnique({
          where: { id: userId },
          select: { id: true, nombre: true, email: true, activo: true },
        })
        if (!user) return null
        return { ...user, type: "repartidor" as const }
      }
      case "superadmin": {
        const user = await db.superAdmin.findUnique({
          where: { id: userId },
          select: { id: true },
        })
        if (!user) return null
        return { id: user.id, type: "superadmin" as const, nombre: "SuperAdmin" }
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

// ============================================
// User types
// ============================================

export type UserType = "cliente" | "negocio" | "repartidor" | "superadmin"

export interface AuthUser {
  id: string
  type: UserType
  nombre: string
  email?: string
  telefono?: string
  slug?: string
  rubro?: string
  aprobado?: boolean
  suspendido?: boolean
  usuario?: string
  activo?: boolean
}

export interface UserSession {
  id: string
  type: UserType
  nombre: string
  email?: string
  token: string
}

export interface ClienteSession extends UserSession {
  type: "cliente"
  email: string
  telefono: string
}

export interface NegocioSession extends UserSession {
  type: "negocio"
  slug: string
  rubro: string
  aprobado: boolean
  suspendido?: boolean
}

export interface RepartidorSession extends UserSession {
  type: "repartidor"
  email: string
  activo: boolean
}

export interface SuperAdminSession extends UserSession {
  type: "superadmin"
}

export interface OperationalAccount {
  id: string
  nombre: string
  email: string
  activo: boolean
  empleados: Array<{
    id: string
    nombre: string
    codigo: string
    rol: string
    activo: boolean
    negocio: {
      id: string
      nombre: string
      slug: string
    }
  }>
}
