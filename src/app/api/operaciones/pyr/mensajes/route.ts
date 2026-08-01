import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope } from "@/lib/operaciones-terminal-access"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const ESTADOS_ACTIVOS = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const
const LIST_LIMIT = 100

// ============================================
// GET — Bugfix-4C: lista liviana de pedidos PyR activos (no-mesa) del
// negocio de la terminal, para elegir el chat exacto al adjuntar un
// comprobante compartido desde una app externa.
// ============================================
// Usa el MISMO scope que el envío de adjuntos/mensajes (`pyr.mensajes.responder`),
// no el de gestión de pedidos (`pyr.pedidos.ver`) — una terminal puede tener
// permiso para responder mensajes sin tener permiso para gestionar pedidos, y
// este listado es exclusivamente para elegir un destino de mensaje, no para
// operar el pedido. El negocio se deriva SIEMPRE del contexto seguro de la
// terminal, nunca de un parámetro del cliente.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireOperacionesScope(req, "pyr.mensajes.responder")
    if (!auth.ok) return auth.response
    const negocioId = auth.context.negocio.id

    const pedidos = await db.pedido.findMany({
      where: {
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: { in: [...ESTADOS_ACTIVOS] },
      },
      orderBy: [{ fecha: "desc" }],
      take: LIST_LIMIT,
      select: {
        id: true,
        clienteNombre: true,
        estado: true,
        metodoEntrega: true,
        fecha: true,
      },
    })

    return NextResponse.json({ ok: true, pedidos }, { headers: NO_STORE_HEADERS })
  } catch {
    console.error("[OperacionesPyR] Falló el listado de pedidos para compartir")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
