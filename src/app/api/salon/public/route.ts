import { NextRequest, NextResponse } from "next/server"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const LEGACY_GONE_MESSAGE =
  "El acceso por link legacy fue reemplazado. Iniciá sesión en DeliGO Operaciones."

// Seguridad-5G: panel de salón autenticado por tokenSalon (secreto compartido
// de todo el negocio) retirado por completo — exponía mesas, pedidos activos y
// empleados con una sola credencial nunca expirada. Ver CLAUDE_REPORT.md para
// el detalle de la migración (Seguridad-5E/5F/5G).
export async function GET(_req: NextRequest) {
  return NextResponse.json({ error: LEGACY_GONE_MESSAGE }, { status: 410, headers: NO_STORE_HEADERS })
}
