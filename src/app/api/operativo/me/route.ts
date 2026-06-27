import { NextRequest, NextResponse } from "next/server"
import {
  deleteOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
  validateOperationalSession,
} from "@/lib/auth"
import { db } from "@/lib/db"

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(OPERATIONAL_SESSION_COOKIE_NAME)?.value
    if (!token) {
      const response = NextResponse.json(
        { ok: false, estado: "sin_sesion", error: "No autenticado" },
        { status: 401 }
      )
      return noStore(response)
    }

    const session = await validateOperationalSession(token)
    if (!session) {
      const response = NextResponse.json(
        { ok: false, estado: "sin_sesion", error: "No autenticado" },
        { status: 401 }
      )
      response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
      return noStore(response)
    }

    const account = await db.cuentaOperativa.findFirst({
      where: {
        id: session.cuentaOperativaId,
        activo: true,
        eliminado: false,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        empleados: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
            rol: true,
            activo: true,
            eliminado: true,
            negocio: {
              select: {
                id: true,
                nombre: true,
                slug: true,
                aprobado: true,
                suspendido: true,
                salonActivo: true,
                empleadosActivos: true,
              },
            },
          },
        },
      },
    })

    if (!account) {
      await deleteOperationalSession(token)
      const response = NextResponse.json(
        { ok: false, estado: "sin_sesion", error: "No autenticado" },
        { status: 401 }
      )
      response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
      return noStore(response)
    }

    const cuenta = {
      id: account.id,
      nombre: account.nombre,
      email: account.email,
      activo: account.activo,
    }

    const operationalLinks = account.empleados
      .filter((empleado) =>
        empleado.activo &&
        !empleado.eliminado &&
        empleado.rol === "mozo" &&
        empleado.negocio.aprobado &&
        !empleado.negocio.suspendido &&
        empleado.negocio.salonActivo &&
        empleado.negocio.empleadosActivos
      )
      .map((empleado) => ({
        empleado: {
          id: empleado.id,
          nombre: empleado.nombre,
          codigo: empleado.codigo,
          rol: empleado.rol,
          activo: empleado.activo,
        },
        negocio: {
          id: empleado.negocio.id,
          nombre: empleado.negocio.nombre,
          slug: empleado.negocio.slug,
        },
      }))

    if (operationalLinks.length > 0) {
      const primaryLink = operationalLinks[0]
      return noStore(
        NextResponse.json({
          ok: true,
          estado: "operativo",
          cuenta,
          mozo: primaryLink.empleado,
          negocio: primaryLink.negocio,
          vinculos: operationalLinks,
        })
      )
    }

    if (account.empleados.length > 0) {
      return noStore(
        NextResponse.json({
          ok: true,
          estado: "sin_vinculo_operativo",
          cuenta,
          mensaje: "Actualmente no tenés un vínculo activo como mozo.",
          vinculos: [],
        })
      )
    }

    return noStore(
      NextResponse.json({
        ok: true,
        estado: "sin_vinculo",
        cuenta,
        vinculos: [],
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
