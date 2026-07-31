import { NextRequest, NextResponse } from "next/server"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const LEGACY_GONE_MESSAGE =
  "El acceso por link legacy fue reemplazado. Iniciá sesión en DeliGO Operaciones."

// Seguridad-5G: cambio de estado de pedidos autenticado por tokenEmpleados
// (secreto compartido de todo el negocio) retirado por completo — incluía
// cancelación con reversión financiera, la acción más sensible de todo este
// mecanismo legacy. Ver CLAUDE_REPORT.md para el detalle de la migración
// (Seguridad-5E/5F/5G).
export async function PATCH(
  _req: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ error: LEGACY_GONE_MESSAGE }, { status: 410, headers: NO_STORE_HEADERS })
}
