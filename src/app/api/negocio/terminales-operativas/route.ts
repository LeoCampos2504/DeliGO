import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import {
  DEFAULT_OPERACIONES_PROFILE,
  isOperacionesProfile,
  resolveEffectiveGrant,
  parseStoredGrant,
} from "@/lib/operaciones-terminal-permissions"

const MAX_NOMBRE_LENGTH = 60

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

/** Devuelve solo datos seguros para la UI (sin hashes, tokens ni sesiones). */
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

// GET — Listar terminales operativas del negocio autenticado
export async function GET(req: NextRequest) {
  try {
    const user = await getNegocioAuth(req)
    if (!user) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const terminales = await db.terminalOperativa.findMany({
      where: { negocioId: user.id },
      orderBy: { createdAt: "desc" },
      select: SAFE_SELECT,
    })

    return noStore(
      NextResponse.json({ ok: true, terminales: terminales.map(serializeTerminal) })
    )
  } catch (error) {
    console.error("[TerminalesOperativas] Error listing:", error)
    return noStore(
      NextResponse.json({ error: "Error al obtener terminales" }, { status: 500 })
    )
  }
}

// POST — Crear una terminal (queda en estado "pendiente" hasta una futura activación)
export async function POST(req: NextRequest) {
  try {
    const user = await getNegocioAuth(req)
    if (!user) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return noStore(NextResponse.json({ error: "Body inválido" }, { status: 400 }))
    }

    // Solo se aceptan estos campos del frontend. Cualquier otro (negocioId, estado, etc.) se ignora.
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : ""
    if (!nombre) {
      return noStore(NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 }))
    }
    if (nombre.length > MAX_NOMBRE_LENGTH) {
      return noStore(
        NextResponse.json({ error: "El nombre es demasiado largo" }, { status: 400 })
      )
    }

    const perfil = isOperacionesProfile(body.perfil) ? body.perfil : DEFAULT_OPERACIONES_PROFILE
    // Áreas/scopes se recalculan/normalizan server-side (nunca se confía en el frontend;
    // `mozo` y delivery quedan descartados por el helper).
    const { areas, scopes } = resolveEffectiveGrant(perfil, body.areas, body.scopes)

    const terminal = await db.terminalOperativa.create({
      data: {
        negocioId: user.id,
        nombre,
        estado: "pendiente",
        perfil,
        areas: JSON.stringify(areas),
        scopes: JSON.stringify(scopes),
      },
      select: SAFE_SELECT,
    })

    await auditLog({
      userId: user.id,
      userType: "negocio",
      accion: "terminal_operativa.creada",
      recurso: "terminal_operativa",
      recursoId: terminal.id,
      detalle: { nombre: terminal.nombre, perfil: terminal.perfil, areas, scopesCount: scopes.length },
    })

    return noStore(NextResponse.json({ ok: true, terminal: serializeTerminal(terminal) }, { status: 201 }))
  } catch (error) {
    console.error("[TerminalesOperativas] Error creating:", error)
    return noStore(
      NextResponse.json({ error: "Error al crear la terminal" }, { status: 500 })
    )
  }
}
