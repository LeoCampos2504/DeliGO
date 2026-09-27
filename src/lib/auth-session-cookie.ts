import type { NextResponse } from "next/server"
import { getFamilySessionCookieName, SESSION_DURATION_HOURS, type SessionFamily } from "@/lib/auth"

/** Writes only the authenticated actor family's session cookie. */
export function setFamilySessionCookie(
  response: NextResponse,
  token: string,
  family: SessionFamily
): void {
  response.cookies.set(getFamilySessionCookieName(family), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
  })
}
