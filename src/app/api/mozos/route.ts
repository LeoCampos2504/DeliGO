import { NextResponse } from "next/server"

// Legacy-Cleanup-2A: la API plural bearer de Empleado.token queda retirada.
// P2-T15 evaluó su eliminación física y decidió preservarla: es un tombstone
// 410 mínimo (sin DB, sin lógica), y borrarlo cambiaría la respuesta a un
// caller externo aún no descartado (viejo bearer/PWA cacheado) de 410
// explícito a 404 ambiguo, sin ningún beneficio de mantenimiento real.
export async function GET(_request?: Request) {
  return NextResponse.json(
    { error: "Esta API fue reemplazada por DeliGO Operaciones" },
    { status: 410, headers: { "Cache-Control": "private, no-store" } }
  )
}
