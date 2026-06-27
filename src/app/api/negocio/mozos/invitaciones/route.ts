import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import {
  buildMozoInvitationCodePrefix,
  generateMozoInvitationCode,
  getMozoInvitationExpiresAt,
  hashMozoInvitationCode,
} from "@/lib/mozo-invitations"
import {
  checkRateLimit,
  createRateLimitKey,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

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

function getEstado(invitation: {
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
}) {
  const now = new Date()
  if (invitation.usedAt) return "usado"
  if (invitation.revokedAt) return "revocado"
  if (invitation.expiresAt <= now) return "vencido"
  return "pendiente"
}

export async function GET(req: NextRequest) {
  try {
    const user = await getNegocioAuth(req)
    if (!user) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const invitaciones = await db.codigoIncorporacionMozo.findMany({
      where: {
        negocioId: user.id,
        usedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        empleadoObjetivoId: true,
        codePrefix: true,
        expiresAt: true,
        createdAt: true,
        usedAt: true,
        revokedAt: true,
        empleadoObjetivo: {
          select: {
            nombre: true,
          },
        },
      },
    })

    return noStore(
      NextResponse.json({
        ok: true,
        invitaciones: invitaciones.map((invitation) => ({
          id: invitation.id,
          empleadoObjetivoId: invitation.empleadoObjetivoId,
          empleadoNombre: invitation.empleadoObjetivo?.nombre ?? "Mozo",
          codePrefix: invitation.codePrefix,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
          estado: getEstado(invitation),
        })),
      })
    )
  } catch (error) {
    console.error("[MozoInvitaciones] Error listing:", error)
    return noStore(
      NextResponse.json(
        { error: "Error al obtener invitaciones" },
        { status: 500 }
      )
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getNegocioAuth(req)
    if (!user) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const ip = getClientIp(req)
    const rl = checkRateLimit("operativoInvite", createRateLimitKey(ip, user.id))
    if (!rl.allowed) {
      return noStore(rateLimitResponse(rl, "Demasiadas invitaciones. Intentá de nuevo más tarde."))
    }

    const body = await req.json()
    const empleadoId = typeof body.empleadoId === "string" ? body.empleadoId.trim() : ""

    if (!empleadoId) {
      return noStore(
        NextResponse.json(
          { error: "Empleado requerido" },
          { status: 400 }
        )
      )
    }

    let codigo = generateMozoInvitationCode()
    let codeHash = hashMozoInvitationCode(codigo)
    while (await db.codigoIncorporacionMozo.findUnique({ where: { codeHash } })) {
      codigo = generateMozoInvitationCode()
      codeHash = hashMozoInvitationCode(codigo)
    }

    const now = new Date()
    const expiresAt = getMozoInvitationExpiresAt(now)
    const codePrefix = buildMozoInvitationCodePrefix(codigo)

    const invitation = await db.$transaction(async (tx) => {
      const empleado = await tx.empleado.findFirst({
        where: {
          id: empleadoId,
          negocioId: user.id,
          rol: "mozo",
          activo: true,
          eliminado: false,
          cuentaOperativaId: null,
        },
        select: {
          id: true,
          nombre: true,
        },
      })

      if (!empleado) {
        throw new Error("EMPLEADO_INVALIDO")
      }

      await tx.codigoIncorporacionMozo.updateMany({
        where: {
          negocioId: user.id,
          empleadoObjetivoId: empleado.id,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      })

      return tx.codigoIncorporacionMozo.create({
        data: {
          negocioId: user.id,
          empleadoObjetivoId: empleado.id,
          rol: "mozo",
          codeHash,
          codePrefix,
          expiresAt,
        },
        select: {
          id: true,
          empleadoObjetivoId: true,
          codePrefix: true,
          expiresAt: true,
          createdAt: true,
          empleadoObjetivo: {
            select: {
              nombre: true,
            },
          },
        },
      })
    })

    await auditLog({
      userId: user.id,
      userType: "negocio",
      accion: "mozo.invitacion_creada",
      recurso: "codigo_incorporacion_mozo",
      recursoId: invitation.id,
      detalle: {
        empleadoObjetivoId: invitation.empleadoObjetivoId,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      ip,
    })

    return noStore(
      NextResponse.json(
        {
          ok: true,
          invitacion: {
            id: invitation.id,
            empleadoObjetivoId: invitation.empleadoObjetivoId,
            empleadoNombre: invitation.empleadoObjetivo?.nombre ?? "Mozo",
            codePrefix: invitation.codePrefix,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
            estado: "pendiente",
            codigo,
          },
        },
        { status: 201 }
      )
    )
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLEADO_INVALIDO") {
      return noStore(
        NextResponse.json(
          { error: "Mozo no disponible para invitación" },
          { status: 400 }
        )
      )
    }

    console.error("[MozoInvitaciones] Error creating:", error)
    return noStore(
      NextResponse.json(
        { error: "Error al generar invitación" },
        { status: 500 }
      )
    )
  }
}
