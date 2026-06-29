import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import {
  isOperacionesProfile,
  resolveEffectiveGrant,
  parseStoredAreas,
  parseStoredScopes,
  parseStoredGrant,
  type OperacionesProfile,
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

// PATCH — Editar nombre / perfil / areas / scopes. No reactiva ni cambia estado.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getNegocioAuth(req)
    if (!user) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const { id } = await params

    const existing = await db.terminalOperativa.findUnique({
      where: { id },
      select: { id: true, negocioId: true, perfil: true, areas: true, scopes: true, revokedAt: true },
    })
    if (!existing || existing.negocioId !== user.id) {
      return noStore(NextResponse.json({ error: "Terminal no encontrada" }, { status: 404 }))
    }
    if (existing.revokedAt) {
      return noStore(
        NextResponse.json({ error: "No se puede editar una terminal revocada" }, { status: 409 })
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return noStore(NextResponse.json({ error: "Body inválido" }, { status: 400 }))
    }

    const updateData: Record<string, unknown> = {}

    if (body.nombre !== undefined) {
      const nombre = typeof body.nombre === "string" ? body.nombre.trim() : ""
      if (!nombre) {
        return noStore(NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 }))
      }
      if (nombre.length > MAX_NOMBRE_LENGTH) {
        return noStore(NextResponse.json({ error: "El nombre es demasiado largo" }, { status: 400 }))
      }
      updateData.nombre = nombre
    }

    // El perfil objetivo determina cómo se recalculan áreas/scopes (siempre server-side).
    const targetPerfil: OperacionesProfile =
      body.perfil !== undefined && isOperacionesProfile(body.perfil)
        ? body.perfil
        : (existing.perfil as OperacionesProfile)

    if (body.perfil !== undefined || body.areas !== undefined || body.scopes !== undefined) {
      const areasSource =
        targetPerfil === "personalizado"
          ? body.areas !== undefined
            ? body.areas
            : parseStoredAreas(existing.areas)
          : undefined
      const scopesSource =
        targetPerfil === "personalizado"
          ? body.scopes !== undefined
            ? body.scopes
            : parseStoredScopes(existing.scopes)
          : undefined
      const { areas, scopes } = resolveEffectiveGrant(targetPerfil, areasSource, scopesSource)
      updateData.perfil = targetPerfil
      updateData.areas = JSON.stringify(areas)
      updateData.scopes = JSON.stringify(scopes)
    }

    if (Object.keys(updateData).length === 0) {
      return noStore(NextResponse.json({ error: "Nada para actualizar" }, { status: 400 }))
    }

    const updated = await db.terminalOperativa.update({
      where: { id },
      data: updateData,
      select: SAFE_SELECT,
    })

    await auditLog({
      userId: user.id,
      userType: "negocio",
      accion: "terminal_operativa.modificada",
      recurso: "terminal_operativa",
      recursoId: updated.id,
      detalle: {
        nombre: updated.nombre,
        perfil: updated.perfil,
        areas: parseStoredAreas(updated.areas),
        scopesCount: parseStoredScopes(updated.scopes).length,
      },
    })

    return noStore(NextResponse.json({ ok: true, terminal: serializeTerminal(updated) }))
  } catch (error) {
    console.error("[TerminalesOperativas] Error updating:", error)
    return noStore(NextResponse.json({ error: "Error al actualizar la terminal" }, { status: 500 }))
  }
}
