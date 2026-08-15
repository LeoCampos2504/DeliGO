import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { findSesionByToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { issueSocketActorToken } from "@/lib/realtime-auth"
import type { RealtimeUserType } from "@/lib/realtime-policy"

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

async function getRealtimeActor(req: NextRequest): Promise<{
  userId: string
  userType: RealtimeUserType
  sessionId: string
} | null> {
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!rawToken) return null

  const session = await findSesionByToken(rawToken)
  if (!session || session.expiresAt <= new Date()) return null
  if (!["cliente", "negocio", "repartidor"].includes(session.userType)) return null

  const userType = session.userType as RealtimeUserType
  if (userType === "cliente") {
    const account = await db.cliente.findUnique({
      where: { id: session.userId },
      select: { id: true, bloqueado: true },
    })
    if (!account || account.bloqueado) return null
  } else if (userType === "negocio") {
    const account = await db.negocio.findUnique({
      where: { id: session.userId },
      select: { id: true, aprobado: true, suspendido: true },
    })
    if (!account || !account.aprobado || account.suspendido) return null
  } else {
    const account = await db.repartidor.findUnique({
      where: { id: session.userId },
      select: { id: true, activo: true, eliminado: true },
    })
    if (!account || !account.activo || account.eliminado) return null
  }

  return { userId: session.userId, userType, sessionId: session.id }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getRealtimeActor(req)
    if (!actor) return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))

    const token = await issueSocketActorToken(actor)
    return noStore(NextResponse.json({ ok: true, token, expiresIn: 300 }))
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo autenticar realtime" }, { status: 401 }))
  }
}
