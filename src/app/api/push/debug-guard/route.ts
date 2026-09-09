import { NextResponse } from "next/server"
import { isPushDebugAllowedEnvironment } from "@/lib/push-testing-guard"

// P2-T31-R6 (INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC): the ONLY
// server-side gate the push debug panel trusts before rendering anything.
// Outside TESTING this returns a plain 404 — indistinguishable from a route
// that was never defined — rather than `{ allowed: false }`, so nothing about
// this diagnostic surface's existence can be discovered by probing
// Production. Read-only: never touches the DB, never mutates anything.
export async function GET() {
  if (!isPushDebugAllowedEnvironment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ allowed: true })
}
