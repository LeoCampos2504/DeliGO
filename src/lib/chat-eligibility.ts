import type { UserType } from "@/lib/auth"

/** Chat Cliente–Negocio is unavailable to delivery and admin actors. */
export function isChatEligibleUser(user: { type: UserType } | null): boolean {
  return user !== null && user.type !== "repartidor" && user.type !== "superadmin"
}
