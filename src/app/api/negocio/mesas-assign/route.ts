import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

type AssignmentAuth = { kind: "negocio" }

// POST — Assign a mozo to a mesa (or unassign) for a business administrator.
// Personal mozo assignment uses the session-authoritative /api/operativo route.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mesaId, empleadoCodigo, unassign } = body
    const empleadoCodigoInput =
      typeof empleadoCodigo === "string" ? empleadoCodigo.trim().toUpperCase() : ""

    if (!mesaId) {
      return NextResponse.json({ error: "mesaId requerido" }, { status: 400 })
    }

    // Authentication: this administrative route is session-only. Personal mozo
    // assignment uses /api/operativo/mozo/panel/[slug], whose resolver derives
    // CuentaOperativa -> Empleado -> Negocio from deligo_operativo_session.
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value
    let auth: AssignmentAuth | null = null
    let negocioId: string | null = null

    // 1) Check negocio session cookie
    if (sessionCookie) {
      const user = await getUserFromToken(sessionCookie)
      if (user?.type === "negocio") {
        auth = { kind: "negocio" }
        negocioId = user.id
      }
    }

    if (!auth || !negocioId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Find the mesa
    const mesa = await db.mesa.findUnique({
      where: { id: mesaId },
    })

    if (!mesa || mesa.negocioId !== negocioId) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 })
    }

    if (!mesa.activa) {
      return NextResponse.json({ error: "Mesa inactiva" }, { status: 400 })
    }

    // If unassigning
    if (unassign) {
      const unassignResult = await db.mesa.updateMany({
        where: {
          id: mesaId,
          negocioId,
        },
        data: { empleadoId: null },
      })

      if (unassignResult.count === 0) {
        return NextResponse.json(
          { error: "Mesa no encontrada" },
          { status: 404 }
        )
      }

      const updated = await db.mesa.findUnique({
        where: { id: mesaId },
        include: {
          empleado: {
            select: { id: true, nombre: true, codigo: true },
          },
        },
      })

      if (!updated) {
        return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 })
      }

      return NextResponse.json({
        id: updated.id,
        numero: updated.numero,
        nombre: updated.nombre,
        zona: updated.zona,
        capacidad: updated.capacidad,
        mozoAsignado: null,
      })
    }

    // Assigning — need empleadoCodigo
    if (!empleadoCodigoInput) {
      return NextResponse.json({ error: "empleadoCodigo requerido para asignar" }, { status: 400 })
    }

    // Find the empleado by codigo using Prisma ORM (avoids PostgreSQL case-sensitivity issues)
    const mozo = await db.empleado.findFirst({
      where: {
        codigo: empleadoCodigoInput,
        negocioId,
        eliminado: false,
        rol: "mozo",
      },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        negocioId: true,
        activo: true,
      },
    })

    if (!mozo) {
      return NextResponse.json({ error: "Mozo no encontrado" }, { status: 404 })
    }

    if ("activo" in mozo && !mozo.activo) {
      return NextResponse.json({ error: "Mozo inactivo" }, { status: 400 })
    }

    // El negocio —dueño de sus propias mesas— puede reasignar directamente a
    // otro mozo. El self-service personal usa su propia ruta canónica y aplica
    // la restricción de ownership allí.
    const assignResult = await db.mesa.updateMany({
      where: {
        id: mesaId,
        negocioId,
      },
      data: { empleadoId: mozo.id },
    })

    if (assignResult.count === 0) {
      return NextResponse.json(
        { error: "Esta mesa ya tiene otro mozo asignado" },
        { status: 409 }
      )
    }

    const updated = await db.mesa.findUnique({
      where: { id: mesaId },
      include: {
        empleado: {
          select: { id: true, nombre: true, codigo: true },
        },
      },
    })

    if (!updated) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 })
    }

    return NextResponse.json({
      id: updated.id,
      numero: updated.numero,
      nombre: updated.nombre,
      zona: updated.zona,
      capacidad: updated.capacidad,
      mozoAsignado: updated.empleado
        ? { id: updated.empleado.id, nombre: updated.empleado.nombre, codigo: updated.empleado.codigo }
        : null,
    })
  } catch (error) {
    console.error("Error assigning mozo to mesa:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al asignar mozo a mesa" },
      { status: 500 }
    )
  }
}
