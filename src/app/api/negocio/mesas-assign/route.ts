import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth"

// POST — Assign a mozo to a mesa (or unassign)
// Public endpoint used from the mozo link flow
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mesaId, empleadoCodigo, negocioId, unassign } = body

    if (!mesaId) {
      return NextResponse.json({ error: "mesaId requerido" }, { status: 400 })
    }

    if (!negocioId) {
      return NextResponse.json({ error: "negocioId requerido" }, { status: 400 })
    }

    // Authentication: require negocio session or valid access token
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    let isAuthorized = false

    if (token) {
      const session = await validateSession(token)
      if (session && session.userType === "negocio" && session.userId === negocioId) {
        isAuthorized = true
      }
    }

    // Also allow via tokenSalon or tokenEmpleados
    if (!isAuthorized && body.token) {
      const negocioByToken = await db.negocio.findFirst({
        where: {
          OR: [
            { tokenSalon: body.token },
            { tokenEmpleados: body.token },
          ],
          id: negocioId,
        },
      })
      if (negocioByToken) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
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
      // Only allow unassign if the same mozo or no auth needed
      const updated = await db.mesa.update({
        where: { id: mesaId },
        data: { empleadoId: null },
        include: {
          empleado: {
            select: { id: true, nombre: true, codigo: true },
          },
        },
      })
      return NextResponse.json({
        id: updated.id,
        numero: updated.numero,
        nombre: updated.nombre,
        zona: updated.zona,
        mozoAsignado: null,
      })
    }

    // Assigning — need empleadoCodigo
    if (!empleadoCodigo) {
      return NextResponse.json({ error: "empleadoCodigo requerido para asignar" }, { status: 400 })
    }

    // Find the empleado by codigo
    const empleados = await db.$queryRaw<
      Array<{ id: string; nombre: string; codigo: string; activo: number }>
    >`SELECT id, nombre, codigo, activo FROM empleados WHERE codigo = ${empleadoCodigo} AND negocioId = ${negocioId} LIMIT 1`

    if (empleados.length === 0) {
      return NextResponse.json({ error: "Mozo no encontrado" }, { status: 404 })
    }

    const mozo = empleados[0]
    if (!mozo.activo) {
      return NextResponse.json({ error: "Mozo inactivo" }, { status: 400 })
    }

    // Check if mesa already has a DIFFERENT mozo assigned
    if (mesa.empleadoId && mesa.empleadoId !== mozo.id) {
      return NextResponse.json(
        { error: "Esta mesa ya tiene otro mozo asignado" },
        { status: 409 }
      )
    }

    // Assign the mozo to the mesa
    const updated = await db.mesa.update({
      where: { id: mesaId },
      data: { empleadoId: mozo.id },
      include: {
        empleado: {
          select: { id: true, nombre: true, codigo: true },
        },
      },
    })

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
