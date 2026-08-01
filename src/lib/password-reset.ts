import { randomBytes, createHash } from "crypto"

// ============================================
// DeliGO - Recuperación de contraseña (Bugfix-5D)
// ============================================
// Helpers puros — sin acceso a DB, sin cookies. Mismo patrón de "generar +
// hashear al guardar + comparar por hash" que ya usan las sesiones
// (hashSessionToken en src/lib/auth.ts) y los códigos de incorporación de
// mozo (src/lib/mozo-invitations.ts).

/** El enlace de recuperación vive 1 hora — mismo texto que ya prometía el
 * email de sendPasswordResetEmail antes de que existiera este helper. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000

/**
 * Roles con email + contraseña reales, elegibles para recuperación.
 * Superadmin queda afuera a propósito (no tiene email, es una fila única con
 * password compartida). Terminal Operativa queda afuera a propósito (no es
 * una cuenta personal, no tiene password ni email).
 */
export const PASSWORD_RESET_ACCOUNT_TYPES = ["cliente", "negocio", "repartidor", "cuenta_operativa"] as const
export type PasswordResetAccountType = (typeof PASSWORD_RESET_ACCOUNT_TYPES)[number]

export function normalizePasswordResetAccountType(value: unknown): PasswordResetAccountType | null {
  return typeof value === "string" &&
    (PASSWORD_RESET_ACCOUNT_TYPES as readonly string[]).includes(value)
    ? (value as PasswordResetAccountType)
    : null
}

/**
 * Token real que recibe el usuario por email — nunca se guarda tal cual en
 * la base (ver hashPasswordResetToken). Aleatorio criptográficamente seguro
 * (crypto.randomBytes, nunca Math.random()), 32 bytes = 256 bits, codificado
 * base64url (URL-safe: no necesita encodeURIComponent en el enlace).
 */
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("base64url")
}

/** SHA-256 del token real — es lo único que se guarda en PasswordResetToken.tokenHash. */
export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
