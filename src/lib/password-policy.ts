import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordCodePointLength } from "./password-policy-constants"

// ============================================
// DeliGO — Política central de contraseñas (PASSWORD-POLICY-HARDENING)
// ============================================
// Aplica ÚNICAMENTE a contraseñas NUEVAS: registro, cambio, reset. Nunca se
// importa desde /api/auth/login, /api/operativo/login ni desde comparePassword
// — el login debe seguir aceptando contraseñas históricas de 6-9 caracteres
// sin ninguna validación de longitud o blocklist adicional (ver
// LEGACY_6_TO_9_LOGIN_PRESERVED en CODEX_REPORT.md).
//
// validatePassword() es puro: nunca transforma la contraseña que finalmente
// llega a hashPassword. La canonicalización (normalize + lowercase) se usa
// EXCLUSIVAMENTE para comparar contra la blocklist local — el valor que la
// función recibe y que el llamador pasa a hashPassword sigue siendo
// exactamente el string original del usuario (sin trim, sin cambios de
// mayúscula/minúscula, sin normalización Unicode aplicada al hash).

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; code: "TOO_SHORT" | "TOO_LONG" | "COMMON_PASSWORD"; error: string }

const LENGTH_ERROR = `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`
const COMMON_PASSWORD_ERROR = "Esa contraseña es demasiado común. Elegí otra más difícil de adivinar."

// Lista LOCAL de contraseñas comunes/esperables — mantenida a mano en este
// repo, NO es una base de datos de brechas reales ni un corpus completo de
// contraseñas filtradas (no existe esa fuente integrada). Cubre familias
// obvias (secuencias, teclado, "password"/"contraseña"/"admin", variantes
// del nombre del servicio) ya alcanzadas a 10+ caracteres — cualquier
// variante más corta ya queda rechazada por TOO_SHORT antes de llegar acá.
// Comparación siempre por IGUALDAD EXACTA tras canonicalizar — nunca por
// substring, para no rechazar una passphrase legítima que sólo contenga una
// palabra común dentro de una frase más larga.
const COMMON_PASSWORDS: readonly string[] = [
  // Secuencias numéricas
  "1234567890",
  "0123456789",
  "12345678910",
  "123456789012",

  // Teclado (qwerty y variantes)
  "qwertyuiop",
  "qwerty12345",
  "qwerty123456",
  "1qaz2wsx3edc",
  "asdfghjklñ",
  "zxcvbnm1234",

  // Familia "password"
  "password123",
  "password1234",
  "passwords123",
  "passw0rd123",
  "iloveyou123",

  // Familia "contraseña"/"contrasena" (con y sin ñ, variantes de acento)
  "contraseña123",
  "contrasena123",
  "micontraseña1",
  "clavesecreta1",
  "clave1234567",

  // Familia "admin"
  "admin123456",
  "administrator",
  "adminadmin1",
  "admin12345678",

  // Marca del servicio
  "deligo123456",
  "deligo12345",
  "soydeligo123",
  "deligoadmin1",
  "deligo2024",
  "deligo2025",
  "deligo2026",

  // Genéricas ampliamente conocidas como débiles, extendidas a 10+ chars
  "letmein12345",
  "welcome12345",
  "sunshine123",
  "princess123",
  "football123",
  "baseball123",
  "trustno1234",
  "monkey123456",
  "dragon123456",
  "master123456",
  "shadow123456",
  "superman1234",
  "batman123456",
  "freedom12345",
  "whatever123",
  "hello1234567",
  "changeme123",
  "abcdefghij",
  "abcdefghijk",
  "1q2w3e4r5t",
] as const

function canonicalizeForBlocklist(password: string): string {
  return password.normalize("NFKC").toLowerCase()
}

const BLOCKLIST_SET = new Set(COMMON_PASSWORDS.map(canonicalizeForBlocklist))

/**
 * Valida una contraseña NUEVA (registro/cambio/reset). Nunca usar para
 * verificar el login — ver el comentario de cabecera del archivo.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const length = passwordCodePointLength(password)

  if (length < PASSWORD_MIN_LENGTH) {
    return { ok: false, code: "TOO_SHORT", error: LENGTH_ERROR }
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return { ok: false, code: "TOO_LONG", error: LENGTH_ERROR }
  }
  if (BLOCKLIST_SET.has(canonicalizeForBlocklist(password))) {
    return { ok: false, code: "COMMON_PASSWORD", error: COMMON_PASSWORD_ERROR }
  }

  return { ok: true }
}

export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, passwordCodePointLength }
