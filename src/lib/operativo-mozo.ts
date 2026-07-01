import type { NextRequest, NextResponse } from "next/server"
import {
  deleteOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
  validateOperationalSession,
} from "@/lib/auth"
import { db } from "@/lib/db"
import {
  resolveAreaOperativaEfectiva,
  type AreaOperativa,
} from "@/lib/area-operativa"

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
      // Área operativa administrada por el negocio y área efectiva derivada
      // (fuente de verdad del acceso personal). Aditivo: no reemplaza campos previos.
      areaOperativa: string
      areaOperativaEfectiva: AreaOperativa
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
      state: "sin_sesion" | "acceso_no_disponible" | "area_no_habilitada"
      clearSession?: boolean
    }

export function noStore<T extends Response | NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

// Resolver personal general por ÁREA (Operaciones-1I). El área esperada es una
// constante fijada por cada endpoint (nunca viene del cliente/body/query/header).
// Valida por request: sesión → CuentaOperativa → negocio (slug) → Empleado vinculado
// → área efectiva === área esperada. Devuelve el mismo contrato que Mozo.
export async function resolveOperativoAreaForSlug(
  req: NextRequest,
  slug: string,
  areaEsperada: "mozo" | "salon"
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

  // El acceso personal ya NO se filtra por rol:"mozo" en la consulta. Se resuelve el
  // empleado vinculado y luego se deriva el área efectiva (fuente de verdad).
  const empleado = await db.empleado.findFirst({
    where: {
      cuentaOperativaId: account.id,
      negocioId: negocio.id,
      activo: true,
      eliminado: false,
    },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      rol: true,
      activo: true,
      negocioId: true,
      areaOperativa: true,
    },
  })

  if (!empleado) {
    return { ok: false, status: 403, state: "acceso_no_disponible" }
  }

  const areaOperativaEfectiva = resolveAreaOperativaEfectiva({
    areaOperativa: empleado.areaOperativa,
    rol: empleado.rol,
  })

  // Solo se habilita el área ESPERADA por el endpoint. Cualquier otra área efectiva
  // (incluida sin_asignar) → respuesta segura, sin cerrar sesión ni revelar el área
  // actual, otras áreas, scopes ni datos de terminal.
  if (areaOperativaEfectiva !== areaEsperada) {
    return { ok: false, status: 403, state: "area_no_habilitada" }
  }

  const { areaOperativa: _areaOperativa, ...empleadoBase } = empleado

  return {
    ok: true,
    cuenta: account,
    empleado: empleadoBase,
    areaOperativa: empleado.areaOperativa,
    areaOperativaEfectiva,
    negocio,
  }
}

// Wrapper de compatibilidad: mantiene la firma pública usada por /api/operativo/mozo/**
// y el árbol personal de Mozo. Equivale a exigir área efectiva "mozo".
export async function resolveOperativoMozoForSlug(
  req: NextRequest,
  slug: string
): Promise<OperativoMozoAuth> {
  return resolveOperativoAreaForSlug(req, slug, "mozo")
}
