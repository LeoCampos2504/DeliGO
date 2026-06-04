import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const nombre = req.nextUrl.searchParams.get("nombre")

  if (!nombre?.trim()) {
    return NextResponse.json({ available: true })
  }

  const existing = await db.negocio.findUnique({
    where: { nombre: nombre.trim() },
    select: { id: true },
  })

  return NextResponse.json({ available: !existing })
}
