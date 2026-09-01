import { NextResponse } from "next/server"

// Legacy-Cleanup-2A: la API bearer de Empleado.token queda retirada. El
// reemplazo canónico es /api/operativo/** con deligo_operativo_session.
export async function GET(_request?: Request) {
  return NextResponse.json(
    { error: "Esta API fue reemplazada por DeliGO Operaciones" },
    { status: 410, headers: { "Cache-Control": "private, no-store" } }
  )
}
