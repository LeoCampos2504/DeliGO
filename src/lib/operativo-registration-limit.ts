import { createHmac, randomBytes } from "crypto"
import type { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

// ============================================
// DeliGO - Límite de registro de CuentaOperativa (Bugfix-5F)
// ============================================
// Mitigación de abuso, no identificación infalible: un dispositivo se
// reconoce únicamente por una cookie opaca generada por el servidor (nunca
// user-agent, canvas, fuentes, resolución ni ningún fingerprint invasivo).
// Borrar la cookie o cambiar de navegador genera un identificador nuevo — el
// límite por IP sigue siendo la segunda barrera, independiente.

export const OPERATIVO_DEVICE_COOKIE_NAME = "deligo_operativo_device"
const DEVICE_TOKEN_BYTES = 32 // mínimo pedido: 32 bytes, aleatorio criptográficamente seguro
const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60 // ~1 año

export const WEEKLY_REGISTRATION_LIMIT = 3
export const REGISTRATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // ventana móvil de 7 días
export const REGISTRATION_CLEANUP_AGE_MS = 14 * 24 * 60 * 60 * 1000 // limpieza oportunista; no afecta la ventana de 7 días

// No existe en el proyecto ningún secreto estable ya usado que sea apropiado
// para esto: NEXTAUTH_SECRET/AUTH_SECRET no están referenciados en ningún
// archivo (a pesar de que `next-auth` figura como dependencia sin usarse para
// esto), y CLEANUP_SECRET/ADMIN_SECRET son secretos puntuales de un solo uso
// administrativo — reutilizarlos como clave HMAC de una función distinta
// mezclaría dominios de seguridad no relacionados. Por eso esta función exige
// una variable nueva y dedicada, y nunca cae a un hash débil sin secreto.
export class RegistrationLimitSecretMissingError extends Error {
  constructor() {
    super("REGISTRATION_LIMIT_SECRET no está configurada")
  }
}

export function getRegistrationLimitSecret(): string {
  const secret = process.env.REGISTRATION_LIMIT_SECRET
  if (!secret) {
    throw new RegistrationLimitSecretMissingError()
  }
  return secret
}

function hmac(secret: string, label: string, value: string): string {
  return createHmac("sha256", secret).update(`${label}:${value}`).digest("hex")
}

// Valores que el helper real (getClientIp, src/lib/rate-limit.ts) usa como
// sentinela de "no se pudo determinar una IP fiable", más cualquier variante
// vacía/nula que pudiera llegar por otra vía.
const UNRELIABLE_IP_VALUES = new Set(["unknown", "null", "undefined", "0.0.0.0", "::1", "::"])

/**
 * Corrección posterior a la versión inicial de Bugfix-5F: NUNCA hashear el
 * valor "unknown" (ni ningún otro sentinela de IP no confiable) — hacerlo
 * produciría el mismo hash para todos los usuarios sin IP detectable,
 * bloqueándolos entre sí globalmente después de solo 3 registros ajenos.
 * Devuelve la IP normalizada cuando es real y utilizable, o `null` cuando no
 * puede determinarse una IP fiable — nunca se deriva una IP falsa a partir
 * del user-agent, el email o el token de dispositivo.
 */
export function normalizeRegistrationIp(ip: string | null | undefined): string | null {
  const trimmed = ip?.trim().toLowerCase()
  if (!trimmed || UNRELIABLE_IP_VALUES.has(trimmed)) return null
  return trimmed
}

/** Solo debe llamarse con una IP ya normalizada y confirmada como real (ver `normalizeRegistrationIp`) — nunca con "unknown". */
export function hashIpForRegistrationLimit(ip: string, secret: string): string {
  return hmac(secret, "ip", ip)
}

export function hashDeviceForRegistrationLimit(deviceToken: string, secret: string): string {
  return hmac(secret, "device", deviceToken)
}

/** Lee la cookie de dispositivo existente, o genera un identificador nuevo (todavía no lo persiste en ninguna cookie). */
export function getOrCreateDeviceToken(req: NextRequest): { token: string; isNew: boolean } {
  const existing = req.cookies.get(OPERATIVO_DEVICE_COOKIE_NAME)?.value
  if (existing) {
    return { token: existing, isNew: false }
  }
  return { token: randomBytes(DEVICE_TOKEN_BYTES).toString("base64url"), isNew: true }
}

/** Solo se llama cuando `isNew` es true — una cookie existente no se reemplaza en cada request. */
export function setDeviceCookie(response: NextResponse, token: string): void {
  response.cookies.set(OPERATIVO_DEVICE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  })
}

/**
 * `ipHash` es `null` cuando no pudo determinarse una IP fiable (ver
 * `normalizeRegistrationIp`). En ese caso NUNCA se ejecuta una consulta
 * Prisma por IP — ni siquiera `where: { ipHash: null }`, que volvería a
 * agrupar globalmente a todos los eventos sin IP bajo un único contador
 * compartido. `byIp` queda directamente en 0 y solo el límite por
 * dispositivo puede bloquear el registro.
 */
export async function countRecentRegistrations(
  tx: Prisma.TransactionClient,
  ipHash: string | null,
  deviceHash: string,
  windowStart: Date
): Promise<{ byIp: number; byDevice: number }> {
  const [byIp, byDevice] = await Promise.all([
    ipHash
      ? tx.cuentaOperativaRegistro.count({
          where: { ipHash, createdAt: { gte: windowStart } },
        })
      : Promise.resolve(0),
    tx.cuentaOperativaRegistro.count({
      where: { deviceHash, createdAt: { gte: windowStart } },
    }),
  ])
  return { byIp, byDevice }
}

/** Limpieza oportunista de eventos viejos; el corte (14 días) queda siempre por fuera de la ventana de 7 días que se evalúa. */
export async function cleanupOldRegistrations(
  tx: Prisma.TransactionClient,
  cutoff: Date
): Promise<void> {
  await tx.cuentaOperativaRegistro.deleteMany({ where: { createdAt: { lt: cutoff } } })
}
