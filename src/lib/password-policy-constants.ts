// ============================================
// DeliGO — Constantes + helper compartido de política de contraseña
// (PASSWORD-POLICY-HARDENING)
// ============================================
// Separado de src/lib/password-policy.ts a propósito: este archivo sólo
// exporta números planos y una función pura sin dependencias, SIN la
// blocklist ni el resto de la lógica de validación — para que un Client
// Component (formularios de registro/reset/cambio) pueda importar
// PASSWORD_MIN_LENGTH/PASSWORD_MAX_LENGTH/passwordCodePointLength sin
// arrastrar la blocklist (COMMON_PASSWORDS) al bundle del navegador.
//
// Aplica sólo a contraseñas NUEVAS (registro, cambio, reset) — nunca al
// login, que debe seguir aceptando contraseñas históricas de 6-9 caracteres
// sin ninguna validación de longitud adicional.
//
// PASSWORD_LENGTH_UNIT=UNICODE_CODE_POINTS — tanto el servidor
// (src/lib/password-policy.ts, que importa este mismo helper) como cada
// formulario de UI miden la longitud con passwordCodePointLength(), nunca
// con `.length` crudo (UTF-16 code units) ni con los atributos nativos
// `minLength`/`maxLength` del HTML, que cuentan code units y por lo tanto
// pueden aceptar/rechazar distinto que el servidor para caracteres Unicode
// fuera del BMP (ej. la mayoría de los emoji, que ocupan un par subrogado).

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

/**
 * Longitud en code points Unicode, no en unidades UTF-16. `"👍".length` es 2
 * en JS (un par subrogado) pero es un solo carácter real para el usuario —
 * Array.from() itera por code point y cuenta correctamente en ambos casos.
 * Única definición en todo el repo — src/lib/password-policy.ts (servidor)
 * y cada formulario de registro/reset/cambio (cliente) importan esta misma
 * función en vez de duplicar Array.from(password).length.
 */
export function passwordCodePointLength(password: string): number {
  return Array.from(password).length
}
