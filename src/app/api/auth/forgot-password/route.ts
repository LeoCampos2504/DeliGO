import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"
import { auditLog } from "@/lib/audit"
import { checkRateLimit, createRateLimitKey, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  normalizePasswordResetAccountType,
  PASSWORD_RESET_TOKEN_TTL_MS,
  type PasswordResetAccountType,
} from "@/lib/password-reset"

// ============================================
// POST /api/auth/forgot-password — Bugfix-5D
// ============================================
// Body: { email, accountType }. accountType SIEMPRE explícito (allowlist:
// cliente | negocio | repartidor | cuenta_operativa) — nunca se busca el
// email en las cuatro tablas a la vez, nunca se elige automáticamente qué
// cuenta resetear. El mismo email puede existir en varias tablas sin
// interferir entre sí.
//
// Respuesta SIEMPRE genérica en los casos válidos (exista o no la cuenta,
// esté habilitada o no, se haya podido enviar el email o no) — nunca se
// diferencia por status, mensaje, estructura ni tiempo de respuesta
// intencional. Solo errores de FORMATO devuelven 400, y el rate limit 429
// (ninguno de los dos confirma si la cuenta existe).

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/

const GENERIC_MESSAGE =
  "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer la contraseña."

function genericResponse() {
  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE })
}

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

interface ResetEligibleAccount {
  id: string
  nombre: string
}

// Busca la cuenta ÚNICAMENTE en la tabla correspondiente a accountType.
// Cliente/Negocio no tienen un campo "activo"/"eliminado" real en el schema
// (ver CLAUDE_REPORT.md sección 10) — el login por contraseña tampoco los
// usa como condición de bloqueo, así que acá se mantiene la misma regla:
// cualquier fila existente es "habilitada". Repartidor/CuentaOperativa sí
// tienen activo/eliminado, y el login por contraseña YA los usa para
// rechazar el acceso — se replica exactamente esa misma condición.
async function findResetEligibleAccount(
  accountType: PasswordResetAccountType,
  email: string
): Promise<ResetEligibleAccount | null> {
  switch (accountType) {
    case "cliente": {
      return db.cliente.findUnique({ where: { email }, select: { id: true, nombre: true } })
    }
    case "negocio": {
      return db.negocio.findUnique({ where: { email }, select: { id: true, nombre: true } })
    }
    case "repartidor": {
      const repartidor = await db.repartidor.findUnique({
        where: { email },
        select: { id: true, nombre: true, activo: true, eliminado: true },
      })
      if (!repartidor || !repartidor.activo || repartidor.eliminado) return null
      return { id: repartidor.id, nombre: repartidor.nombre }
    }
    case "cuenta_operativa": {
      const cuenta = await db.cuentaOperativa.findUnique({
        where: { email },
        select: { id: true, nombre: true, activo: true, eliminado: true },
      })
      if (!cuenta || !cuenta.activo || cuenta.eliminado) return null
      return { id: cuenta.id, nombre: cuenta.nombre }
    }
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return noStore(NextResponse.json({ error: "Solicitud inválida" }, { status: 400 }))
    }

    const accountType = normalizePasswordResetAccountType((body as Record<string, unknown>).accountType)
    if (!accountType) {
      return noStore(NextResponse.json({ error: "Tipo de cuenta inválido" }, { status: 400 }))
    }

    const rawEmail = (body as Record<string, unknown>).email
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : ""
    if (!email || !EMAIL_REGEX.test(email)) {
      return noStore(NextResponse.json({ error: "Email inválido" }, { status: 400 }))
    }

    // Rate limit por IP, y una segunda clave derivada de email+accountType
    // (hash truncado — nunca el email en claro como clave visible).
    const rlIp = checkRateLimit("password", ip)
    if (!rlIp.allowed) {
      return noStore(rateLimitResponse(rlIp, "Demasiados intentos. Intentá de nuevo más tarde."))
    }
    const emailKey = hashPasswordResetToken(`${accountType}:${email}`).slice(0, 32)
    const rlEmail = checkRateLimit("password", createRateLimitKey(ip, emailKey))
    if (!rlEmail.allowed) {
      return noStore(rateLimitResponse(rlEmail, "Demasiados intentos. Intentá de nuevo más tarde."))
    }

    const account = await findResetEligibleAccount(accountType, email)

    if (!account) {
      // No se crea token, no se envía email, no se diferencia la respuesta.
      // Auditoría interna sin PII: nunca se guarda el email.
      await auditLog({
        userId: "-",
        userType: accountType,
        accion: "password.reset_solicitado",
        recurso: "password_reset",
        detalle: { encontrada: false },
        ip,
      })
      return noStore(genericResponse())
    }

    await auditLog({
      userId: account.id,
      userType: accountType,
      accion: "password.reset_solicitado",
      recurso: "password_reset",
      recursoId: account.id,
      detalle: { encontrada: true },
      ip,
    })

    // Revocar cualquier token anterior todavía activo de esta cuenta antes
    // de emitir uno nuevo.
    await db.passwordResetToken.updateMany({
      where: { userId: account.id, userType: accountType, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    const token = generatePasswordResetToken()
    const tokenHash = hashPasswordResetToken(token)
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS)

    const created = await db.passwordResetToken.create({
      data: { userId: account.id, userType: accountType, tokenHash, expiresAt },
      select: { id: true },
    })

    const sent = await sendPasswordResetEmail(email, account.nombre, token)

    if (!sent) {
      // Nunca dejar un token válido que nunca pudo enviarse.
      await db.passwordResetToken
        .update({ where: { id: created.id }, data: { revokedAt: new Date() } })
        .catch(() => {})
      await auditLog({
        userId: account.id,
        userType: accountType,
        accion: "password.reset_error",
        recurso: "password_reset",
        recursoId: created.id,
        detalle: { motivo: "envio_fallido" },
        ip,
      })
      return noStore(genericResponse())
    }

    await auditLog({
      userId: account.id,
      userType: accountType,
      accion: "password.reset_email_enviado",
      recurso: "password_reset",
      recursoId: created.id,
      detalle: {},
      ip,
    })

    return noStore(genericResponse())
  } catch (error) {
    console.error("[ForgotPassword] Error:", error)
    // Mismo mensaje genérico incluso ante un error inesperado — nunca
    // distinguir por status/mensaje si la cuenta existe o no.
    return noStore(genericResponse())
  }
}
