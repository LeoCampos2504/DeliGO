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

// POST - Abonar (clear) deuda for a negocio
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

    const { id } = await params
    const negocio = await db.negocio.findUnique({ where: { id } })
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })

    if (negocio.deudaTarifa <= 0) {
      return NextResponse.json({ error: "No hay deuda para abonar" }, { status: 400 })
    }

    const deudaAnterior = negocio.deudaTarifa

    // Record in history
    await db.deudaHistorial.create({
      data: {
        negocioId: negocio.id,
        negocioNombre: negocio.nombre,
        montoAbonado: deudaAnterior,
        deudaAnterior,
        tipo: "abono_total",
      },
    })

    // Reset debt
    await db.negocio.update({
      where: { id },
      data: { deudaTarifa: 0 },
    })

    return NextResponse.json({
      ok: true,
      mensaje: `Deuda de ${deudaAnterior.toLocaleString("es-AR", { style: "currency", currency: "ARS" })} saldada para ${negocio.nombre}`,
      montoAbonado: deudaAnterior,
    })
  } catch (error) {
    console.error("Error clearing debt:", error)
    return NextResponse.json({ error: "Error al abonar deuda" }, { status: 500 })
  }
}
