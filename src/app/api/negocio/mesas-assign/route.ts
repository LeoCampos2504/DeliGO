import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth"

type AssignmentAuth =
  | { kind: "negocio" | "shared" }
  | { kind: "mozo"; empleado: { id: string; codigo: string; nombre: string; negocioId: string } }

// POST — Assign a mozo to a mesa (or unassign)
// Public endpoint used from the mozo link flow
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mesaId, empleadoCodigo, unassign } = body
    const empleadoCodigoInput =
      typeof empleadoCodigo === "string" ? empleadoCodigo.trim().toUpperCase() : ""

    if (!mesaId) {
      return NextResponse.json({ error: "mesaId requerido" }, { status: 400 })
    }

    // Authentication: derive the negocio from session or from the validated token.
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value
    let auth: AssignmentAuth | null = null
    let negocioId: string | null = null

    // 1) Check negocio session cookie
    if (sessionCookie) {
      const session = await validateSession(sessionCookie)
      if (session && session.userType === "negocio") {
        auth = { kind: "negocio" }
        negocioId = session.userId
      }
    }

    // 2) Check tokenSalon or tokenEmpleados
    if (!auth && typeof body.token === "string") {
      const negocioByToken = await db.negocio.findFirst({
        where: {
          OR: [
            { tokenSalon: body.token },
            { tokenEmpleados: body.token },
          ],
        },
        select: { id: true },
      })
      if (negocioByToken) {
        auth = { kind: "shared" }
        negocioId = negocioByToken.id
      }
    }

    // 3) Check mozo token (empleado.token) — allows mozos to assign/unassign from their phone
    if (!auth && typeof body.mozoToken === "string") {
      const empleado = await db.empleado.findFirst({
        where: {
          token: body.mozoToken,
          activo: true,
          eliminado: false,
          rol: "mozo",
        },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          negocioId: true,
        },
      })
      if (empleado) {
        auth = { kind: "mozo", empleado }
        negocioId = empleado.negocioId
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
          ...(auth.kind === "mozo" ? { empleadoId: auth.empleado.id } : {}),
        },
        data: { empleadoId: null },
      })

      if (unassignResult.count === 0) {
        return NextResponse.json(
          { error: auth.kind === "mozo" ? "Sin acceso a este recurso" : "Mesa no encontrada" },
          { status: auth.kind === "mozo" ? 403 : 404 }
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
        mozoAsignado: null,
      })
    }

    // Assigning — need empleadoCodigo
    if (auth.kind !== "mozo" && !empleadoCodigoInput) {
      return NextResponse.json({ error: "empleadoCodigo requerido para asignar" }, { status: 400 })
    }

    // Find the empleado by codigo using Prisma ORM (avoids PostgreSQL case-sensitivity issues)
    const mozo =
      auth.kind === "mozo"
        ? auth.empleado
        : await db.empleado.findFirst({
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

    if (auth.kind === "mozo" && empleadoCodigoInput && empleadoCodigoInput !== auth.empleado.codigo) {
      return NextResponse.json({ error: "Sin acceso a este recurso" }, { status: 403 })
    }

    const assignResult = await db.mesa.updateMany({
      where: {
        id: mesaId,
        negocioId,
        OR: [
          { empleadoId: null },
          { empleadoId: mozo.id },
        ],
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
    console.error("Error assigning mozo to mesa:", error)
    return NextResponse.json(
      { error: "Error al asignar mozo a mesa" },
      { status: 500 }
    )
  }
}
