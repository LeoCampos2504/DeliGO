import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { getClientIp } from "@/lib/rate-limit"

// Preset denuncia reasons
const MOTIVOS_PRESET: Record<string, string> = {
  direccion_falsa: "Dirección falsa o incorrecta",
  no_retiro: "No retiró el pedido",
  no_pago: "No pagó el pedido",
  comportamiento: "Comportamiento inadecuado",
}

export { MOTIVOS_PRESET }

const MAX_DENUNCIAS_BEFORE_BLOCK = 3

// POST - Create a denuncia (business reports a customer)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Solo los negocios pueden denunciar clientes" }, { status: 403 })
    }

    const body = await req.json()
    const { clienteId, pedidoId, motivoTipo, motivo } = body

    if (!clienteId) {
      return NextResponse.json({ error: "clienteId es obligatorio" }, { status: 400 })
    }

    if (!motivoTipo || !motivo) {
      return NextResponse.json({ error: "El motivo es obligatorio" }, { status: 400 })
    }

    // Verify the cliente exists
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nombre: true, bloqueado: true, ultimoIp: true, dispositivoFingerprint: true },
    })

    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    // Check if already denounced by this negocio for this pedido (prevent duplicates)
    if (pedidoId) {
      const existing = await db.denuncia.findFirst({
        where: { clienteId, negocioId: user.id, pedidoId },
      })
      if (existing) {
        return NextResponse.json({ error: "Ya denunciaste a este cliente por este pedido" }, { status: 409 })
      }
    }

    // Create the denuncia
    const denuncia = await db.denuncia.create({
      data: {
        clienteId,
        negocioId: user.id,
        pedidoId: pedidoId || null,
        negocioNombre: user.nombre,
        clienteNombre: cliente.nombre,
        motivoTipo: motivoTipo || "otro",
        motivo,
      },
    })

    // Count total denuncias for this client
    const totalDenuncias = await db.denuncia.count({
      where: { clienteId },
    })

    // Auto-block if reached the limit
    let bloqueado = cliente.bloqueado
    if (totalDenuncias >= MAX_DENUNCIAS_BEFORE_BLOCK && !cliente.bloqueado) {
      await db.cliente.update({
        where: { id: clienteId },
        data: {
          bloqueado: true,
          bloqueadoFecha: new Date(),
        },
      })

      // Register IP block entry
      if (cliente.ultimoIp && cliente.ultimoIp !== "unknown") {
        // Check if this IP already has a block entry
        const existingIpBlock = await db.clienteBloqueado.findFirst({
          where: { ip: cliente.ultimoIp, clienteId },
        })
        if (!existingIpBlock) {
          await db.clienteBloqueado.create({
            data: {
              ip: cliente.ultimoIp,
              fingerprint: cliente.dispositivoFingerprint || "",
              clienteId,
              clienteNombre: cliente.nombre,
            },
          })
        }
      }

      // Register fingerprint block entry (if available)
      if (cliente.dispositivoFingerprint) {
        const existingFpBlock = await db.clienteBloqueado.findFirst({
          where: { fingerprint: cliente.dispositivoFingerprint, clienteId },
        })
        if (!existingFpBlock) {
          await db.clienteBloqueado.create({
            data: {
              ip: cliente.ultimoIp || "",
              fingerprint: cliente.dispositivoFingerprint,
              clienteId,
              clienteNombre: cliente.nombre,
            },
          })
        }
      }

      bloqueado = true
    }

    return NextResponse.json({
      ok: true,
      denuncia,
      totalDenuncias,
      bloqueado,
      mensaje: bloqueado
        ? `Cliente bloqueado automáticamente (${totalDenuncias} denuncias)`
        : `Denuncia registrada (${totalDenuncias}/${MAX_DENUNCIAS_BEFORE_BLOCK})`,
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating denuncia:", error)
    return NextResponse.json({ error: "Error al crear la denuncia" }, { status: 500 })
  }
}

// GET - List denuncias (for negocio or superadmin)
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || (user.type !== "negocio" && user.type !== "superadmin")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get("clienteId")

    const where: Record<string, unknown> = {}

    if (user.type === "negocio") {
      where.negocioId = user.id
    }

    if (clienteId) {
      where.clienteId = clienteId
    }

    const denuncias = await db.denuncia.findMany({
      where,
      orderBy: { fecha: "desc" },
      take: 100,
    })

    // If querying by clienteId, also include the cliente's block status
    let clienteInfo = null
    if (clienteId) {
      const cliente = await db.cliente.findUnique({
        where: { id: clienteId },
        select: { id: true, nombre: true, bloqueado: true, bloqueadoFecha: true, email: true },
      })
      if (cliente) {
        clienteInfo = cliente
      }
    }

    return NextResponse.json({ denuncias, clienteInfo })
  } catch (error) {
    console.error("Error fetching denuncias:", error)
    return NextResponse.json({ error: "Error al obtener denuncias" }, { status: 500 })
  }
}
