import { NextRequest, NextResponse } from "next/server"
import {
  deleteOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
  validateOperationalSession,
} from "@/lib/auth"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

// Logout-B1: `subscription`, si viene, identifica UNICAMENTE que endpoint de
// ESTE navegador desconectar — nunca autoridad de actor. La cuenta se deriva
// exclusivamente de la sesion operativa ya autenticada (validateOperationalSession),
// nunca del cuerpo del request.
function parseLogoutSubscription(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null
  return value
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(OPERATIONAL_SESSION_COOKIE_NAME)?.value

    if (token) {
      // Logout-B1: detach exacto best-effort ANTES de destruir la sesion,
      // mientras la cuenta autenticada todavia se puede derivar server-side.
      // Un fallo de parseo/DB acá nunca debe impedir el logout normal.
      const session = await validateOperationalSession(token)
      if (session) {
        const body = await req.json().catch(() => null)
        const subscription =
          body && typeof body === "object"
            ? parseLogoutSubscription((body as { subscription?: unknown }).subscription)
            : null

        if (subscription) {
          try {
            await db.empleado.updateMany({
              where: {
                cuentaOperativaId: session.cuentaOperativaId,
                pushSubscription: subscription,
              },
              data: { pushSubscription: null },
            })
          } catch (error) {
            console.error("[OperativoLogout] Push detach failed:", safeErrorForLog(error))
          }
        }
      }

      await deleteOperationalSession(token)
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
    return noStore(response)
  } catch (error) {
    console.error("[OperativoLogout] Error:", safeErrorForLog(error))
    const response = NextResponse.json({ ok: true })
    response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
    return noStore(response)
  }
}
