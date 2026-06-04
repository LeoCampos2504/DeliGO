import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

const LIMITE_MINIMO_DEUDA = 5000

async function verifySuperAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const user = await getUserFromToken(token)
  if (!user || user.type !== "superadmin") return null
  return user
}

// PUT - Update debt limit for a negocio
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { nuevoLimite } = body

    if (!nuevoLimite || nuevoLimite < LIMITE_MINIMO_DEUDA) {
      return NextResponse.json(
        { error: `El límite mínimo es $${LIMITE_MINIMO_DEUDA.toLocaleString("es-AR")}` },
        { status: 400 }
      )
    }

    const negocio = await db.negocio.findUnique({ where: { id } })
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })

    await db.negocio.update({
      where: { id },
      data: { limiteDeuda: nuevoLimite },
    })

    return NextResponse.json({
      ok: true,
      mensaje: `Límite actualizado a $${nuevoLimite.toLocaleString("es-AR")}`,
      nuevoLimite,
    })
  } catch (error) {
    console.error("Error updating debt limit:", error)
    return NextResponse.json({ error: "Error al actualizar límite" }, { status: 500 })
  }
}
