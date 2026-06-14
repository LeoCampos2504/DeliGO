import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME, hashPassword, comparePassword } from "@/lib/auth"

// GET - Repartidor profile data
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const repartidor = await db.repartidor.findFirst({
      where: { id: user.id, eliminado: false },
      include: {
        negocios: {
          include: {
            negocio: {
              select: {
                id: true,
                nombre: true,
                slug: true,
                logoUrl: true,
                ofreceDelivery: true,
                repartidorCodigo: true,
              },
            },
          },
          orderBy: { fechaAsociacion: "desc" },
        },
      },
    })

    if (!repartidor) {
      return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      id: repartidor.id,
      nombre: repartidor.nombre,
      email: repartidor.email,
      googleId: repartidor.googleId,
      telefono: repartidor.telefono,
      activo: repartidor.activo,
      fechaRegistro: repartidor.fechaRegistro,
      negocios: repartidor.negocios.map((rn) => ({
        id: rn.id,
        negocioId: rn.negocioId,
        negocioSlug: rn.negocioSlug,
        negocioNombre: rn.negocioNombre,
        negocioLogoUrl: rn.negocioLogoUrl,
        codigoAcceso: rn.codigoAcceso,
        fechaAsociacion: rn.fechaAsociacion,
        negocio: rn.negocio,
      })),
    })
  } catch (error) {
    console.error("Error getting repartidor profile:", error)
    return NextResponse.json({ error: "Error al obtener perfil" }, { status: 500 })
  }
}

// PUT - Update repartidor profile
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const body = await req.json()
    const { nombre, telefono, currentPassword, newPassword } = body

    const updateData: Record<string, unknown> = {}

    if (nombre?.trim()) updateData.nombre = nombre.trim()
    if (telefono !== undefined) updateData.telefono = telefono

    // Password change
    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "La nueva contraseña debe tener al menos 6 caracteres" },
          { status: 400 }
        )
      }

      const repartidor = await db.repartidor.findFirst({ where: { id: user.id, eliminado: false } })
      if (!repartidor) {
        return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 })
      }

      // Google OAuth users can't change password (they don't have one)
      if (!repartidor.password) {
        return NextResponse.json(
          { error: "Tu cuenta usa Google. No tenés contraseña configurada." },
          { status: 400 }
        )
      }

      const valid = await comparePassword(currentPassword, repartidor.password)
      if (!valid) {
        return NextResponse.json(
          { error: "Contraseña actual incorrecta" },
          { status: 400 }
        )
      }

      updateData.password = await hashPassword(newPassword)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 })
    }

    const updated = await db.repartidor.update({
      where: { id: user.id },
      data: updateData,
    })

    return NextResponse.json({
      ok: true,
      nombre: updated.nombre,
      telefono: updated.telefono,
    })
  } catch (error) {
    console.error("Error updating repartidor profile:", error)
    return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 })
  }
}
