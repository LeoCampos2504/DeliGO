import { randomUUID } from "crypto"
import { db } from "@/lib/db"

// ============================================
// Password utilities (using Web Crypto API - native, no bcryptjs)
// ============================================

const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16
const KEY_LENGTH = 32

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
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
      iterations: PBKDF2_ITERATIONS,
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

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const key = await deriveKey(password, salt)
  return `${toHex(salt)}:${toHex(key)}`
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  const [saltHex, keyHex] = hash.split(":")
  if (!saltHex || !keyHex) return false

  const salt = fromHex(saltHex)
  const storedKey = fromHex(keyHex)
  const derivedKey = await deriveKey(password, salt)

  if (derivedKey.length !== storedKey.length) return false

  // Constant-time comparison
  let result = 0
  for (let i = 0; i < derivedKey.length; i++) {
    result |= derivedKey[i] ^ storedKey[i]
  }
  return result === 0
}

// ============================================
// Session token generation
// ============================================

export function generateSessionToken(): string {
  return randomUUID()
}

// ============================================
// Cookie configuration
// ============================================

export const SESSION_COOKIE_NAME = "deligo_session"
export const SESSION_DURATION_HOURS = 12

// ============================================
// Session management (DB-backed)
// ============================================

export async function createSession(
  userId: string,
  userType: UserType
): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS)

  await db.sesion.create({
    data: {
      token,
      userId,
      userType,
      expiresAt,
    },
  })

  return token
}

export async function validateSession(
  token: string
): Promise<{ userId: string; userType: UserType } | null> {
  const session = await db.sesion.findUnique({
    where: { token },
  })

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.sesion.delete({ where: { token } }).catch(() => {})
    return null
  }

  return { userId: session.userId, userType: session.userType as UserType }
}

export async function deleteSession(token: string): Promise<void> {
  await db.sesion.delete({ where: { token } }).catch(() => {})
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
