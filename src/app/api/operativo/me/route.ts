import { NextRequest, NextResponse } from "next/server"
import {
  getOperationalAccountFromRequest,
  OPERATIONAL_SESSION_COOKIE_NAME,
} from "@/lib/auth"

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function GET(req: NextRequest) {
  try {
    const account = await getOperationalAccountFromRequest(req)
    if (!account) {
      const response = NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
      response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
      return noStore(response)
    }

    return noStore(
      NextResponse.json({
        ok: true,
        cuenta: {
          id: account.id,
          nombre: account.nombre,
          email: account.email,
          activo: account.activo,
        },
        vinculos: account.empleados.map((empleado) => ({
          empleado: {
            id: empleado.id,
            nombre: empleado.nombre,
            codigo: empleado.codigo,
            rol: empleado.rol,
            activo: empleado.activo,
          },
          negocio: empleado.negocio,
        })),
      })
    )
  } catch (error) {
    console.error("[OperativoMe] Error:", error)
    return noStore(
      NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      )
    )
  }
}
