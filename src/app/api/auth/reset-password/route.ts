import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import {
  hashPasswordResetToken,
  PASSWORD_RESET_ACCOUNT_TYPES,
  type PasswordResetAccountType,
} from "@/lib/password-reset"

// ============================================
// POST /api/auth/reset-password — Bugfix-5D
// ============================================
// Body: { token, password, confirmPassword }. El token resuelve la cuenta
// exclusivamente en el backend (userType + userId guardados junto al hash) —
// el frontend nunca sabe ni envía a qué cuenta pertenece.
//
// Mensaje único para token inexistente/vencido/usado/revocado — nunca se
// distingue cuál de los cuatro casos ocurrió.

const GENERIC_INVALID = "El enlace es inválido o ya venció. Solicitá uno nuevo."

// Construido siempre server-side por allowlist — nunca tomado del cliente.
const LOGIN_PATH: Record<PasswordResetAccountType, string> = {
  cliente: "/login",
  negocio: "/negocio",
  repartidor: "/repartidor",
  cuenta_operativa: "/operaciones/ingresar",
}

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function invalidResponse() {
  return noStore(NextResponse.json({ error: GENERIC_INVALID }, { status: 400 }))
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  try {
    const rl = checkRateLimit("password", ip)
    if (!rl.allowed) {
      return noStore(rateLimitResponse(rl, "Demasiados intentos. Intentá de nuevo más tarde."))
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return noStore(NextResponse.json({ error: "Solicitud inválida" }, { status: 400 }))
    }

    const token = typeof (body as Record<string, unknown>).token === "string"
      ? ((body as Record<string, unknown>).token as string).trim()
      : ""
    const password = typeof (body as Record<string, unknown>).password === "string"
      ? ((body as Record<string, unknown>).password as string)
      : ""
    const confirmPassword = typeof (body as Record<string, unknown>).confirmPassword === "string"
      ? ((body as Record<string, unknown>).confirmPassword as string)
      : ""

    if (!token) {
      return invalidResponse()
    }

    // Misma política de contraseña que registro/login existentes — no se
    // introduce una política distinta solo para el reset (deuda documentada
    // en el reporte: hoy es únicamente un mínimo de 6 caracteres).
    if (password.length < 6) {
      return noStore(
        NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
      )
    }
    if (password !== confirmPassword) {
      return noStore(NextResponse.json({ error: "Las contraseñas no coinciden" }, { status: 400 }))
    }

    const tokenHash = hashPasswordResetToken(token)
    const hashedPassword = await hashPassword(password)
    const now = new Date()

    // Transacción única: reclama el token de forma atómica (updateMany
    // condicionado — el UPDATE de Postgres ya serializa dos intentos
    // concurrentes sobre la misma fila por su propio bloqueo de fila; si
    // count !== 1, alguien más ya lo consumió, venció, o nunca existió — se
    // trata todo igual, como inválido) y, solo si tuvo éxito, actualiza la
    // contraseña, borra sesiones anteriores y revoca los demás tokens
    // activos de esa misma cuenta.
    const result = await db.$transaction(async (tx) => {
      const claim = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (claim.count !== 1) return null

      const record = await tx.passwordResetToken.findUnique({ where: { tokenHash } })
      if (!record) return null

      const accountType = record.userType
      if (!(PASSWORD_RESET_ACCOUNT_TYPES as readonly string[]).includes(accountType)) return null
      const resolvedType = accountType as PasswordResetAccountType

      // updateMany (no update): si la cuenta ya no existe, o —para
      // Repartidor/CuentaOperativa— ya no está activa/eliminada, count queda
      // en 0 sin lanzar, y se trata como token inválido sin más detalle.
      let updatedCount = 0
      if (resolvedType === "cliente") {
        updatedCount = (await tx.cliente.updateMany({
          where: { id: record.userId },
          data: { password: hashedPassword },
        })).count
      } else if (resolvedType === "negocio") {
        updatedCount = (await tx.negocio.updateMany({
          where: { id: record.userId },
          data: { password: hashedPassword },
        })).count
      } else if (resolvedType === "repartidor") {
        updatedCount = (await tx.repartidor.updateMany({
          where: { id: record.userId, activo: true, eliminado: false },
          data: { password: hashedPassword },
        })).count
      } else {
        updatedCount = (await tx.cuentaOperativa.updateMany({
          where: { id: record.userId, activo: true, eliminado: false },
          data: { password: hashedPassword },
        })).count
      }

      if (updatedCount !== 1) return null

      // Invalidar todas las sesiones anteriores de esa cuenta — nunca las de
      // otra cuenta que casualmente tenga el mismo email en otra tabla
      // (userType las distingue), y nunca las de terminal (tabla separada,
      // no tocada acá).
      await tx.sesion.deleteMany({ where: { userId: record.userId, userType: resolvedType } })

      // Revocar cualquier otro token activo de esta misma cuenta.
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, userType: resolvedType, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      })

      return { accountType: resolvedType, userId: record.userId }
    })

    if (!result) {
      return invalidResponse()
    }

    await auditLog({
      userId: result.userId,
      userType: result.accountType,
      accion: "password.reset_completado",
      recurso: "password_reset",
      detalle: {},
      ip,
    })

    return noStore(
      NextResponse.json({ success: true, loginPath: LOGIN_PATH[result.accountType] })
    )
  } catch (error) {
    console.error("[ResetPassword] Error:", error)
    return invalidResponse()
  }
}
