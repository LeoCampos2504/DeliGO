import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// DELETE - Delete a denuncia (superadmin only)
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
    if (!user || user.type !== "superadmin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { id } = await params

    // Find the denuncia
    const denuncia = await db.denuncia.findUnique({
      where: { id },
      select: { id: true, clienteId: true, clienteNombre: true },
    })

    if (!denuncia) {
      return NextResponse.json({ error: "Denuncia no encontrada" }, { status: 404 })
    }

    // Delete the denuncia
    await db.denuncia.delete({ where: { id } })

    // Check if the cliente should be auto-unblocked
    const denunciasRestantes = await db.denuncia.count({
      where: { clienteId: denuncia.clienteId },
    })

    const MAX_DENUNCIAS_BEFORE_BLOCK = 3
    let desbloqueado = false
    if (denunciasRestantes < MAX_DENUNCIAS_BEFORE_BLOCK) {
      // Below threshold — auto-unblock the cliente if currently blocked
      const cliente = await db.cliente.findUnique({
        where: { id: denuncia.clienteId },
        select: { bloqueado: true, ultimoIp: true, dispositivoFingerprint: true },
      })

      if (cliente?.bloqueado) {
        await db.cliente.update({
          where: { id: denuncia.clienteId },
          data: {
            bloqueado: false,
            bloqueadoFecha: null,
          },
        })

        // Also remove IP/fingerprint blocks
        if (cliente.ultimoIp) {
          await db.clienteBloqueado.deleteMany({
            where: { ip: cliente.ultimoIp, clienteId: denuncia.clienteId },
          })
        }
        if (cliente.dispositivoFingerprint) {
          await db.clienteBloqueado.deleteMany({
            where: { fingerprint: cliente.dispositivoFingerprint, clienteId: denuncia.clienteId },
          })
        }

        desbloqueado = true
      }
    }

    return NextResponse.json({
      ok: true,
      mensaje: desbloqueado
        ? `Denuncia eliminada. ${denuncia.clienteNombre} fue desbloqueado automáticamente (le quedan ${denunciasRestantes} denuncia${denunciasRestantes !== 1 ? "s" : ""}).`
        : `Denuncia eliminada. Quedan ${denunciasRestantes} denuncia${denunciasRestantes !== 1 ? "s" : ""}.`,
      desbloqueado,
      denunciasRestantes,
    })
  } catch (error) {
    console.error("Error deleting denuncia:", error)
    return NextResponse.json({ error: "Error al eliminar la denuncia" }, { status: 500 })
  }
}
