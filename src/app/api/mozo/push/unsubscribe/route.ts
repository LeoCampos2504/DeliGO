import { NextResponse } from "next/server"

// Legacy-Cleanup-2A: Push de mozo se gestiona únicamente por la superficie
// personal operativa, que deriva el propietario desde la sesión HttpOnly.
export async function POST(_request?: Request) {
  return NextResponse.json(
    { error: "Esta API fue reemplazada por DeliGO Operaciones" },
    { status: 410, headers: { "Cache-Control": "private, no-store" } }
  )
}
