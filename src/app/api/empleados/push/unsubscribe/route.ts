import { NextRequest, NextResponse } from "next/server"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const LEGACY_GONE_MESSAGE =
  "El acceso por link legacy fue reemplazado. Iniciá sesión en DeliGO Operaciones."

// Seguridad-5G: acceso operativo por tokenEmpleados (secreto compartido de todo
// el negocio) retirado por completo — ver CLAUDE_REPORT.md.
export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: LEGACY_GONE_MESSAGE }, { status: 410, headers: NO_STORE_HEADERS })
}
