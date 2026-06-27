import { createHash, randomBytes } from "crypto"

export const MOZO_INVITATION_EXPIRY_MINUTES = 15

export function generateMozoInvitationCode(): string {
  return randomBytes(32).toString("base64url")
}

export function hashMozoInvitationCode(code: string): string {
  return createHash("sha256").update(normalizeMozoInvitationCode(code)).digest("hex")
}

export function buildMozoInvitationCodePrefix(code: string): string {
  const normalized = normalizeMozoInvitationCode(code)
  if (normalized.length <= 10) return "********"
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`
}

export function normalizeMozoInvitationCode(code: string): string {
  return code.trim()
}

export function getMozoInvitationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + MOZO_INVITATION_EXPIRY_MINUTES * 60 * 1000)
}
