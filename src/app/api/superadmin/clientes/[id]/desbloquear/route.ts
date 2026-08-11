import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"

// Seguridad-6B.4: acción superadmin sobre un cliente bloqueado — nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// POST - Unblock a cliente (superadmin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
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
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    if (!cliente.bloqueado) {
      return NextResponse.json({ error: "El cliente no está bloqueado" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    // Unblock the cliente
    await db.cliente.update({
      where: { id },
      data: {
        bloqueado: false,
        bloqueadoFecha: null,
      },
    })

    // SEC-BLOCK-1: recuperación completa, no solo la fila que coincide con el
    // snapshot ip/fingerprint ACTUAL de este cliente.
    // (a) Borra TODAS las filas ClienteBloqueado de este clienteId, sin
    //     condicionar a ip/fingerprint — cubre bloqueos históricos con un
    //     valor distinto al vigente hoy (incluidas filas ip-only sin
    //     fingerprint, creadas por el flujo de denuncias).
    await db.clienteBloqueado.deleteMany({
      where: { clienteId: id },
    })
    // (b) Además, borra cualquier fila de CUALQUIER clienteId (huérfana o de
    //     otra cuenta) cuyo fingerprint coincida con el dispositivo real de
    //     este cliente — limpia la fuente de evasión detectada por
    //     SEC-BLOCK-1 (findForeignDeviceBlockMatch en
    //     src/lib/client-block-security.ts), para que una futura cuenta
    //     legítima desde este mismo dispositivo no vuelva a auto-bloquearse.
    //     Nunca se borra por IP sola sin acotar a clienteId/fingerprint — la
    //     IP es compartible entre clientes reales.
    if (cliente.dispositivoFingerprint) {
      await db.clienteBloqueado.deleteMany({
        where: { fingerprint: cliente.dispositivoFingerprint },
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
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error unblocking cliente:", error)
    return NextResponse.json({ error: "Error al desbloquear el cliente" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
