import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// POST - Unblock a cliente (superadmin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "superadmin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const eliminarDenuncias = searchParams.get("eliminarDenuncias") === "true"

    // Find the cliente
    const cliente = await db.cliente.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        bloqueado: true,
        ultimoIp: true,
        dispositivoFingerprint: true,
      },
    })

    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    if (!cliente.bloqueado) {
      return NextResponse.json({ error: "El cliente no está bloqueado" }, { status: 400 })
    }

    // Unblock the cliente
    await db.cliente.update({
      where: { id },
      data: {
        bloqueado: false,
        bloqueadoFecha: null,
      },
    })

    // Remove IP/fingerprint blocks
    if (cliente.ultimoIp) {
      await db.clienteBloqueado.deleteMany({
        where: { ip: cliente.ultimoIp, clienteId: id },
      })
    }
    if (cliente.dispositivoFingerprint) {
      await db.clienteBloqueado.deleteMany({
        where: { fingerprint: cliente.dispositivoFingerprint, clienteId: id },
      })
    }

    // Optionally delete all denuncias
    let denunciasEliminadas = 0
    if (eliminarDenuncias) {
      const result = await db.denuncia.deleteMany({
        where: { clienteId: id },
      })
      denunciasEliminadas = result.count
    }

    return NextResponse.json({
      ok: true,
      mensaje: eliminarDenuncias
        ? `${cliente.nombre} desbloqueado. Se eliminaron ${denunciasEliminadas} denuncia${denunciasEliminadas !== 1 ? "s" : ""}.`
        : `${cliente.nombre} desbloqueado. Las denuncias se mantuvieron.`,
      denunciasEliminadas: eliminarDenuncias ? denunciasEliminadas : undefined,
    })
  } catch (error) {
    console.error("Error unblocking cliente:", error)
    return NextResponse.json({ error: "Error al desbloquear el cliente" }, { status: 500 })
  }
}
