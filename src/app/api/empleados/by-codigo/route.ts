import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/empleados/by-codigo?codigo=XXX&negocioId=YYY — Find an empleado by their codigo
export async function GET(req: NextRequest) {
  try {
    const codigo = req.nextUrl.searchParams.get("codigo")
    const negocioId = req.nextUrl.searchParams.get("negocioId")

    if (!codigo || !negocioId) {
      return NextResponse.json({ error: "codigo y negocioId requeridos" }, { status: 400 })
    }

    const empleado = await db.empleado.findFirst({
      where: {
        negocioId,
        codigo: codigo.toUpperCase(),
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
      },
    })

    if (!empleado) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 })
    }

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error finding empleado by codigo:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
