// ============================================
// DeliGO - Operaciones Terminal Auth
// ============================================
// Centraliza credenciales de emparejamiento y la sesión opaca/revocable de las
// Terminales Operativas (dispositivos compartidos: PC caja, tablet, monitor…).
//
// Reglas de seguridad:
//   - Cookie propia, NUNCA `deligo_session`.
//   - El token de sesión y los secretos de emparejamiento son opacos; en DB solo
//     se guarda su SHA-256. Nunca se loguea el valor crudo.
//   - Los permisos NO viven en la sesión: se resuelven desde la TerminalOperativa
//     en cada request usando `parseStoredGrant`.

import { randomBytes, createHash } from "crypto"
import type { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseStoredGrant, type OperacionesArea, type OperacionesScope } from "@/lib/operaciones-terminal-permissions"

// ---------------------------------------------------------------------------
// Cookie
// ---------------------------------------------------------------------------

export const TERMINAL_SESSION_COOKIE_NAME = "deligo_operaciones_terminal"

const SESSION_TTL_DAYS = 90
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
const SESSION_COOKIE_MAX_AGE = SESSION_TTL_DAYS * 24 * 60 * 60 // seconds

// Throttle de escrituras de lastUsedAt: solo se actualiza si pasaron ≥ 5 min.
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000

// Vencimiento de las credenciales de emparejamiento (QR / código manual).
export const PAIRING_TTL_MS = 2 * 60 * 1000

function isProd(): boolean {
  return process.env.NODE_ENV === "production"
}

/** Opciones seguras de cookie. Path "/" porque las APIs viven bajo /api/operaciones/*. */
function terminalCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd(),
    path: "/",
    maxAge,
  }
}

export function setTerminalSessionCookie<T extends NextResponse>(response: T, rawToken: string): T {
  response.cookies.set(TERMINAL_SESSION_COOKIE_NAME, rawToken, terminalCookieOptions(SESSION_COOKIE_MAX_AGE))
  return response
}

export function clearTerminalSessionCookie<T extends NextResponse>(response: T): T {
  response.cookies.set(TERMINAL_SESSION_COOKIE_NAME, "", terminalCookieOptions(0))
  return response
}

// ---------------------------------------------------------------------------
// Tokens / hashing
// ---------------------------------------------------------------------------

/** Token opaco (sesión o secreto QR): 32 bytes aleatorios en base64url. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url")
}

/** SHA-256 (hex) del valor recibido. Solo se persiste el hash. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function getTerminalSessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS)
}

// ---------------------------------------------------------------------------
// Código manual (Crockford Base32, sin caracteres ambiguos: I, L, O, U)
// ---------------------------------------------------------------------------

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ" // 32 chars

/** Genera 16 caracteres Crockford Base32 (80 bits, sin sesgo: 256 % 32 === 0). */
export function generateManualCodeRaw(): string {
  const bytes = randomBytes(16)
  let out = ""
  for (let i = 0; i < 16; i++) {
    out += CROCKFORD_ALPHABET[bytes[i] % 32]
  }
  return out
}

/** Formato visual: ABCD-EFGH-JKLM-NPQR. */
export function formatManualCode(raw: string): string {
  return (raw.match(/.{1,4}/g) ?? [raw]).join("-")
}

/**
 * Normaliza un código manual ingresado: mayúsculas, sin guiones ni espacios, y
 * mapea confusiones comunes (O→0, I/L→1). Se acepta con o sin guiones/espacios.
 */
export function normalizeManualCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
}

// ---------------------------------------------------------------------------
// Resolución de sesión de terminal
// ---------------------------------------------------------------------------

export interface TerminalSessionContext {
  sessionId: string
  terminal: {
    id: string
    nombre: string
    estado: string
    perfil: string
    areas: OperacionesArea[]
    scopes: OperacionesScope[]
  }
  negocio: {
    id: string
    nombre: string
    slug: string
    colorPrincipal: string
  }
}

/**
 * Resuelve la sesión de terminal desde la cookie. Devuelve null si:
 * no hay cookie, la sesión no existe / venció / fue revocada, la terminal fue
 * revocada o no está en estado `activo`. Solo devuelve contexto seguro.
 */
export async function resolveTerminalSession(req: NextRequest): Promise<TerminalSessionContext | null> {
  const rawToken = req.cookies.get(TERMINAL_SESSION_COOKIE_NAME)?.value
  if (!rawToken) return null

  const tokenHash = sha256Hex(rawToken)

  const session = await db.sesionTerminalOperativa.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      terminalOperativa: {
        select: {
          id: true,
          nombre: true,
          estado: true,
          perfil: true,
          areas: true,
          scopes: true,
          revokedAt: true,
          negocio: {
            select: { id: true, nombre: true, slug: true, colorPrincipal: true },
          },
        },
      },
    },
  })

  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt <= new Date()) return null

  const terminal = session.terminalOperativa
  if (!terminal) return null
  if (terminal.revokedAt) return null
  if (terminal.estado !== "activo") return null

  // Refresca lastUsedAt como mucho cada 5 min (best-effort, no bloquea la respuesta).
  await touchLastUsed(session.id, terminal.id, session.lastUsedAt)

  const grant = parseStoredGrant(terminal.areas, terminal.scopes)

  return {
    sessionId: session.id,
    terminal: {
      id: terminal.id,
      nombre: terminal.nombre,
      estado: terminal.estado,
      perfil: terminal.perfil,
      areas: grant.areas,
      scopes: grant.scopes,
    },
    negocio: terminal.negocio,
  }
}

async function touchLastUsed(sessionId: string, terminalId: string, lastUsedAt: Date | null): Promise<void> {
  const now = new Date()
  if (lastUsedAt && now.getTime() - lastUsedAt.getTime() < LAST_USED_THROTTLE_MS) {
    return
  }
  try {
    await db.$transaction([
      db.sesionTerminalOperativa.update({ where: { id: sessionId }, data: { lastUsedAt: now } }),
      db.terminalOperativa.update({ where: { id: terminalId }, data: { lastUsedAt: now } }),
    ])
  } catch {
    // Best-effort: no fallar la request por el refresco de lastUsedAt.
  }
}
