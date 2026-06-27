import type { NextRequest, NextResponse } from "next/server"
import {
  deleteOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
  validateOperationalSession,
} from "@/lib/auth"
import { db } from "@/lib/db"

export type OperativoMozoAuth =
  | {
      ok: true
      cuenta: {
        id: string
        nombre: string
      }
      empleado: {
        id: string
        nombre: string
        codigo: string
        rol: string
        activo: boolean
        negocioId: string
      }
      negocio: {
        id: string
        nombre: string
        slug: string
        colorPrincipal: string
        logoUrl: string | null
        salonActivo: boolean
        empleadosActivos: boolean
      }
    }
  | {
      ok: false
      status: 401 | 403
      state: "sin_sesion" | "acceso_no_disponible"
      clearSession?: boolean
    }

export function noStore<T extends Response | NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function resolveOperativoMozoForSlug(
  req: NextRequest,
  slug: string
): Promise<OperativoMozoAuth> {
  const token = req.cookies.get(OPERATIONAL_SESSION_COOKIE_NAME)?.value
  if (!token) {
    return { ok: false, status: 401, state: "sin_sesion" }
  }

  const session = await validateOperationalSession(token)
  if (!session) {
    return { ok: false, status: 401, state: "sin_sesion", clearSession: true }
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
    },
  })

  if (!account) {
    await deleteOperationalSession(token)
    return { ok: false, status: 401, state: "sin_sesion", clearSession: true }
  }

  const negocio = await db.negocio.findFirst({
    where: {
      slug,
      aprobado: true,
      suspendido: false,
      salonActivo: true,
      empleadosActivos: true,
    },
    select: {
      id: true,
      nombre: true,
      slug: true,
      colorPrincipal: true,
      logoUrl: true,
      salonActivo: true,
      empleadosActivos: true,
    },
  })

  if (!negocio) {
    return { ok: false, status: 403, state: "acceso_no_disponible" }
  }

  const empleado = await db.empleado.findFirst({
    where: {
      cuentaOperativaId: account.id,
      negocioId: negocio.id,
      activo: true,
      eliminado: false,
      rol: "mozo",
    },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      rol: true,
      activo: true,
      negocioId: true,
    },
  })

  if (!empleado) {
    return { ok: false, status: 403, state: "acceso_no_disponible" }
  }

  return {
    ok: true,
    cuenta: account,
    empleado,
    negocio,
  }
}
