import { createHash, randomBytes } from "crypto"
import type { NextRequest, NextResponse } from "next/server"

// ============================================
// DeliGO — Identidad técnica de dispositivo SERVER-MANAGED (SEC-DEVICE-1)
// ============================================
// Reemplaza la confianza en `body.fingerprint` (arbitrario, controlado por el
// cliente — ver auditoría SEC-BLOCK-0) por un token opaco generado por el
// servidor, transportado únicamente en una cookie HttpOnly nunca legible
// desde JavaScript. Mismo patrón ya usado en el proyecto para
// `deligo_mesa_occupancy` (src/lib/mesa-occupancy.ts) y `deligo_session`
// (src/lib/auth.ts): el token crudo vive SOLO en la cookie; en DB únicamente
// se persiste su hash SHA-256 — nunca el valor original.
//
// Esta tarea establece la señal técnica. NO implementa enforcement
// anti-evasión (bloqueo automático por coincidencia) — eso es SEC-BLOCK-1.
//
// No es una credencial de autenticación, no es un dato biométrico ni un ID de
// hardware — es un identificador persistente del perfil de navegador. Borrar
// la cookie, usar modo incógnito o cambiar de navegador/dispositivo genera un
// identificador nuevo.

export const DEVICE_COOKIE_NAME = "deligo_device"

// 32 bytes de un CSPRNG (crypto.randomBytes) — 256 bits de entropía, muy por
// encima de lo necesario para hacer inviable la adivinanza/fuerza bruta.
const DEVICE_TOKEN_BYTES = 32

// base64url sin padding de 32 bytes = 43 caracteres exactos — se valida el
// formato de cualquier cookie entrante antes de confiar en ella (nunca se
// acepta un string arbitrario/ilimitado como token válido).
const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

// Mismo valor ya usado en el proyecto para `deligo_operativo_device`
// (src/lib/operativo-registration-limit.ts) — precedente reutilizable para
// una cookie de dispositivo de propósito de seguridad/anti-abuso, evita
// inventar una duración arbitraria nueva.
const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60 // ~1 año

function isProd(): boolean {
  return process.env.NODE_ENV === "production"
}

function generateDeviceToken(): string {
  return randomBytes(DEVICE_TOKEN_BYTES).toString("base64url")
}

function isValidDeviceToken(value: string | undefined | null): value is string {
  return typeof value === "string" && DEVICE_TOKEN_PATTERN.test(value)
}

// SHA-256 simple, sin secreto/HMAC: a diferencia de una IP (keyspace chico,
// requeriría HMAC con secreto dedicado para resistir fuerza bruta/rainbow
// tables — ver src/lib/operativo-registration-limit.ts), el token de acá ya
// tiene 256 bits de entropía criptográfica propios. Un hash simple ya es
// irreversible y no adivinable en la práctica, sin necesitar coordinar el
// despliegue de una variable de entorno nueva. Mismo patrón que
// `hashSessionToken` (src/lib/auth.ts) y el token de
// `deligo_mesa_occupancy`/`deligo_operaciones_terminal`.
function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export interface DeviceIdentity {
  /** Token crudo — SOLO para escribir la cookie. Nunca persistir en DB/logs. */
  token: string
  /** Derivado irreversible (SHA-256 hex) — el único valor seguro para persistir en DB. */
  deviceId: string
  /** true si no existía cookie válida y se generó un token nuevo — indica que debe setearse la cookie en la respuesta. */
  isNew: boolean
}

/**
 * Lee la cookie de dispositivo de la request. Si existe y tiene el formato
 * esperado, la reutiliza (cookie existente → mismo `deviceId` siempre). Si
 * falta o es inválida (manipulada, truncada, formato ajeno), genera un token
 * nuevo — nunca lanza, nunca produce un 500 por una cookie manipulada.
 */
export function getOrCreateDeviceIdentity(req: NextRequest): DeviceIdentity {
  const existing = req.cookies.get(DEVICE_COOKIE_NAME)?.value
  if (isValidDeviceToken(existing)) {
    return { token: existing, deviceId: hashDeviceToken(existing), isNew: false }
  }
  const token = generateDeviceToken()
  return { token, deviceId: hashDeviceToken(token), isNew: true }
}

/** Sólo debe llamarse cuando `isNew` es true — una cookie válida existente nunca se reemplaza. */
export function setDeviceCookie(response: NextResponse, token: string): void {
  response.cookies.set(DEVICE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  })
}
