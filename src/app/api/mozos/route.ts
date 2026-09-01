import { NextResponse } from "next/server"

// Legacy-Cleanup-2A: la API plural bearer de Empleado.token queda retirada.
// El archivo se conserva temporalmente; P2-T15 decide su eliminación física.
export async function GET(_request?: Request) {
  return NextResponse.json(
    { error: "Esta API fue reemplazada por DeliGO Operaciones" },
    { status: 410, headers: { "Cache-Control": "private, no-store" } }
  )
}
