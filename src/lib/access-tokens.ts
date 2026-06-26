import { randomBytes } from "crypto"

// ============================================
// Access Token Utility
// ============================================
// Generates random tokens stored in the AccessToken table.
// Each negocio can have one token per type ("pedidos" | "resenas").
// Tokens are simple random strings — validation is done by DB lookup.
// ============================================

/** Generate a random 64-char hex token */
export function generateToken(): string {
  return randomBytes(32).toString("hex")
}

/** Parse a strict Authorization: Bearer <token> header. */
export function parseAuthorizationBearer(header: string | null): string | null {
  if (!header) return null
  const trimmed = header.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length !== 2) return null
  if (parts[0].toLowerCase() !== "bearer") return null
  if (!parts[1] || /\s/.test(parts[1])) return null
  return parts[1]
}
