import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { randomBytes } from "crypto"

function generateMozoToken(): string {
  return randomBytes(32).toString("hex")
}

function maskToken(token?: string | null) {
  if (!token) return null
  if (token.length <= 8) return "********"
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

function serializeEmpleado<T extends { token: string | null }>(empleado: T, revealToken = false) {
  return {
    ...empleado,
    token: revealToken ? empleado.token : null,
    tokenMasked: maskToken(empleado.token),
    tokenRevealed: revealToken,
  }
}

// PUT - Update empleado
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.empleado.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { nombre, codigo, rol, activo, regenerateToken } = body

    // If codigo is changing, check for duplicates
    if (codigo !== undefined) {
      const trimmedCode = codigo.trim().toUpperCase()
      if (trimmedCode !== existing.codigo) {
        const dup = await db.empleado.findUnique({
          where: { negocioId_codigo: { negocioId, codigo: trimmedCode } },
        })
        if (dup) {
          return NextResponse.json(
            { error: `Ya existe un empleado con el código "${trimmedCode}"` },
            { status: 409 }
          )
        }
      }
    }

    const updateData: Record<string, unknown> = {}
    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (codigo !== undefined) updateData.codigo = codigo.trim().toUpperCase()
    if (rol !== undefined) updateData.rol = rol
    if (activo !== undefined) updateData.activo = Boolean(activo)
    if (regenerateToken === true) {
      let newToken = generateMozoToken()
      while (await db.empleado.findFirst({ where: { token: newToken } })) {
        newToken = generateMozoToken()
      }
      updateData.token = newToken
    }
    if (regenerateToken === true || activo === false || (rol !== undefined && rol !== "mozo")) {
      updateData.pushSubscription = null
    }

    const updated = await db.empleado.update({
      where: { id },
      data: updateData,
      include: {
        cuentaOperativa: {
          select: {
            id: true,
            nombre: true,
            activo: true,
            eliminado: true,
          },
        },
      },
    })

    return NextResponse.json(serializeEmpleado(updated, regenerateToken === true))
  } catch (error) {
    console.error("Error updating empleado:", error)
    return NextResponse.json(
      { error: "Error al actualizar empleado" },
      { status: 500 }
    )
  }
}

// DELETE - Delete empleado
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.empleado.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      )
    }

    await db.$transaction([
      db.mesa.updateMany({
        where: { negocioId, empleadoId: id },
        data: { empleadoId: null },
      }),
      db.empleado.update({
        where: { id },
        data: {
          activo: false,
          eliminado: true,
          token: null,
          pushSubscription: null,
        },
      }),
    ])

    return NextResponse.json({ ok: true, message: "Empleado eliminado" })
  } catch (error) {
    console.error("Error deleting empleado:", error)
    return NextResponse.json(
      { error: "Error al eliminar empleado" },
      { status: 500 }
    )
  }
}
