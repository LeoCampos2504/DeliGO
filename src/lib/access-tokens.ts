import { randomBytes } from "crypto"

// ============================================
// Access Token Utility
// ============================================
// Generates random tokens stored in the AccessToken table.
// Each negocio can have one token per type ("pedidos" | "resenas").
// Tokens are simple random strings — validation is done by DB lookup.
// ============================================

/** Generate a random 16-char hex token */
export function generateToken(): string {
  return randomBytes(8).toString("hex")
}
