import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { parseStoredGrant } from "@/lib/operaciones-terminal-permissions"

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

async function getNegocioAuth(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const user = await getUserFromToken(token)
  if (!user || user.type !== "negocio") return null

  return user
}

const SAFE_SELECT = {
  id: true,
  nombre: true,
  estado: true,
  perfil: true,
  areas: true,
  scopes: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

type TerminalRow = {
  id: string
  nombre: string
  estado: string
  perfil: string
  areas: string
  scopes: string
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function serializeTerminal(terminal: TerminalRow) {
  const grant = parseStoredGrant(terminal.areas, terminal.scopes)
  return {
    id: terminal.id,
    nombre: terminal.nombre,
    estado: terminal.estado,
    perfil: terminal.perfil,
    areas: grant.areas,
    scopes: grant.scopes,
    lastUsedAt: terminal.lastUsedAt,
    revokedAt: terminal.revokedAt,
    createdAt: terminal.createdAt,
    updatedAt: terminal.updatedAt,
  }
}

// POST — Revocar una terminal (idempotente). No borra la fila; revoca sus sesiones.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getNegocioAuth(req)
    if (!user) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const { id } = await params

    const existing = await db.terminalOperativa.findFirst({
      where: { id, negocioId: user.id },
      select: { id: true, revokedAt: true },
    })
    if (!existing) {
      return noStore(NextResponse.json({ error: "Terminal no encontrada" }, { status: 404 }))
    }

    // Idempotente: si ya está revocada, devolver el estado actual sin cambios.
    if (existing.revokedAt) {
      const current = await db.terminalOperativa.findUnique({ where: { id }, select: SAFE_SELECT })
      return noStore(
        NextResponse.json({ ok: true, terminal: current ? serializeTerminal(current) : null })
      )
    }

    const now = new Date()

    // Revoca la terminal y cualquier sesión de terminal asociada todavía vigente.
    const [terminal] = await db.$transaction([
      db.terminalOperativa.update({
        where: { id },
        data: { estado: "revocado", revokedAt: now },
        select: SAFE_SELECT,
      }),
      db.sesionTerminalOperativa.updateMany({
        where: { terminalSalonId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ])

    await auditLog({
      userId: user.id,
      userType: "negocio",
      accion: "terminal_operativa.revocada",
      recurso: "terminal_operativa",
      recursoId: terminal.id,
      detalle: { nombre: terminal.nombre },
    })

    return noStore(NextResponse.json({ ok: true, terminal: serializeTerminal(terminal) }))
  } catch (error) {
    console.error("[TerminalesOperativas] Error revoking:", error)
    return noStore(NextResponse.json({ error: "Error al revocar la terminal" }, { status: 500 }))
  }
}
