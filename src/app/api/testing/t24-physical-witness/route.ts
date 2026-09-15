import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

export const dynamic = "force-dynamic"

const MAX_EVENT_LENGTH = 80
const ALLOWED_SOURCES = new Set(["MATCHED", "RAW", "HTTP", "REALTIME"])

function isTestingRuntime(): boolean {
  return process.env.DELIGO_ENVIRONMENT === "TESTING"
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store")
  return response
}

function finiteCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 48
    ? value
    : undefined
}

function safeVersion(value: unknown): number | string | null | undefined {
  if (value === null) return null
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === "string" && value.length <= 40 && /^[0-9]+$/.test(value)) return value
  return undefined
}

export async function POST(req: NextRequest) {
  if (!isTestingRuntime()) return noStore(NextResponse.json({ error: "Not found" }, { status: 404 }))

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))

  const user = await getUserFromToken(token)
  if (!user || user.type !== "cliente") {
    return noStore(NextResponse.json({ error: "Acceso denegado" }, { status: 403 }))
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const pedidoId = typeof body?.pedidoId === "string" ? body.pedidoId : ""
  const event = typeof body?.event === "string" ? body.event : ""
  if (!pedidoId || event.length === 0 || event.length > MAX_EVENT_LENGTH) {
    return noStore(NextResponse.json({ error: "Evento inválido" }, { status: 400 }))
  }

  const pedido = await db.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      clienteId: true,
      negocio: { select: { nombre: true } },
    },
  })
  if (!pedido || pedido.clienteId !== user.id || !pedido.negocio.nombre.startsWith("TEST_T24_PHYSICAL_")) {
    return noStore(NextResponse.json({ error: "Witness no autorizado" }, { status: 403 }))
  }

  const source = typeof body?.source === "string" && ALLOWED_SOURCES.has(body.source) ? body.source : undefined
  const revision = safeVersion(body?.revision)
  const queueState = typeof body?.queueState === "string" ? body.queueState.slice(0, 160) : undefined
  const acceptance = typeof body?.acceptance === "string" ? body.acceptance.slice(0, 40) : undefined
  const snapOccurred = typeof body?.snapOccurred === "boolean" ? body.snapOccurred : undefined
  const staleRecovery = typeof body?.staleRecovery === "boolean" ? body.staleRecovery : undefined

  console.info("[T24 Physical Witness]", JSON.stringify({
    event,
    pedidoId,
    receivedAt: new Date().toISOString(),
    ...(revision !== undefined ? { revision } : {}),
    ...(source ? { source } : {}),
    ...(finiteCount(body?.trajectoryPoints) !== undefined ? { trajectoryPoints: finiteCount(body?.trajectoryPoints) } : {}),
    ...(finiteCount(body?.matchedTrajectoryPoints) !== undefined ? { matchedTrajectoryPoints: finiteCount(body?.matchedTrajectoryPoints) } : {}),
    ...(queueState ? { queueState } : {}),
    ...(acceptance ? { acceptance } : {}),
    ...(snapOccurred !== undefined ? { snapOccurred } : {}),
    ...(staleRecovery !== undefined ? { staleRecovery } : {}),
  }))

  return noStore(new NextResponse(null, { status: 204 }))
}
