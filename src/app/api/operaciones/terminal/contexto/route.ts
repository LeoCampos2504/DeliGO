import { NextRequest, NextResponse } from "next/server"
import {
  resolveTerminalSession,
  clearTerminalSessionCookie,
} from "@/lib/operaciones-terminal-auth"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// GET — Contexto seguro de la terminal a partir de la cookie de sesión.
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveTerminalSession(req)

    if (!ctx) {
      // Sesión ausente/inválida/vencida/revocada → 401 y limpiar la cookie.
      const response = NextResponse.json(
        { ok: false, error: "Sesión de terminal no válida" },
        { status: 401, headers: NO_STORE_HEADERS }
      )
      return clearTerminalSessionCookie(response)
    }

    return NextResponse.json(
      {
        ok: true,
        terminal: ctx.terminal,
        negocio: ctx.negocio,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    console.error("[OperacionesTerminal] Error obteniendo contexto:", error)
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
