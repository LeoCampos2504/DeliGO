import { createHash, randomBytes } from "crypto"
import { Resend } from "resend"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// Email Configuration - Resend API
// ============================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM ||
  "DeliGO <no-reply@deligo.ar>"

// Bugfix-5E.2: misma prioridad que ya usan las rutas de Google
// (src/app/api/auth/google/route.ts, src/app/api/operativo/auth/google/route.ts)
// para el origen público — evita que un enlace de email apunte a localhost en
// producción si Railway solo tiene APP_URL/NEXTAUTH_URL configurada y no
// NEXT_PUBLIC_APP_URL. El fallback a localhost queda únicamente para
// desarrollo local, cuando ninguna de las tres está configurada.
function resolvePublicOrigin(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
  ]

  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed) {
      // Elimina uno o más slashes finales para no producir "//reset-password".
      return trimmed.replace(/\/+$/, "")
    }
  }

  return "http://localhost:3000"
}

const APP_URL = resolvePublicOrigin()

// Whether email sending is enabled (requires Resend API key)
const EMAIL_ENABLED = !!RESEND_API_KEY

const resend = EMAIL_ENABLED ? new Resend(RESEND_API_KEY) : null

// GLOBAL-LOGS-PII-1: mismo criterio de enmascarado que ya usan las páginas
// cliente ("j***n@example.com") — nunca el email completo en logs runtime,
// aunque sí se sigue enviando completo al provider (Resend) y al propio
// destinatario en el cuerpo del email.
export function maskEmailForLog(email: string): string {
  const [local, domain] = email.split("@")
  if (!local || !domain) return "***"
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}***${local[local.length - 1]}@${domain}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

// ============================================
// Generate verification token
// ============================================

// A 24-hour window is intentionally more forgiving than password reset (1h)
// because registration links are commonly opened later, while remaining a
// bounded bearer credential with explicit server-side expiry.
export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export function generateVerificationToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function getVerificationTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_MS)
}

// ============================================
// Send verification email
// ============================================

export async function sendVerificationEmail(
  email: string,
  nombre: string,
  token: string,
  userType: "cliente" | "negocio" | "repartidor"
): Promise<boolean> {
  const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`

  const safeNombre = escapeHtml(nombre)

  const roleLabel =
    userType === "negocio"
      ? "tu local"
      : userType === "repartidor"
        ? "tu cuenta de repartidor"
        : "tu cuenta"

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FB8C00, #F57C00); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">DeliGO</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px; font-weight: 700;">¡Hola, ${safeNombre}! 👋</h2>
              <p style="margin: 0 0 24px; color: #666666; font-size: 16px; line-height: 1.5;">
                Para completar el registro de ${roleLabel}, necesitamos verificar tu email.
              </p>
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #FB8C00, #F57C00); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 14px 40px; border-radius: 12px; letter-spacing: 0.3px;">
                      Verificar mi email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #999999; font-size: 13px; line-height: 1.5;">
                Si el botón no funciona, copiá este enlace en tu navegador:<br>
                <a href="${verificationUrl}" style="color: #FB8C00; word-break: break-all;">${verificationUrl}</a>
              </p>
              <p style="margin: 16px 0 0; color: #999999; font-size: 13px;">
                Este enlace expira en 24 horas.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 20px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #aaaaaa; font-size: 12px;">
                © ${new Date().getFullYear()} DeliGO — Confirmación de registro
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  const textBody = `
DeliGO - Verificación de email

¡Hola, ${nombre}!

Para completar el registro de ${roleLabel}, verificá tu email con el siguiente enlace:

${verificationUrl}

Este enlace expira en 24 horas.

Si no creaste esta cuenta, ignorá este email.
  `

  if (!EMAIL_ENABLED || !resend) {
    // GLOBAL-LOGS-PII-1B: nunca imprimir la URL/token de verificación, ni
    // siquiera en modo desarrollo — un log compartido, CI, terminal history
    // o captura de pantalla puede exponerlo igual que en producción. Antes
    // se imprimía la URL completa acá; ahora sólo una señal de que el envío
    // fue simulado, sin URL ni token.
    console.log(`[Email] Verification email simulated (dev mode) for ${maskEmailForLog(email)} (${userType})`)
    return true
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [email],
      subject: "DeliGO — Verificá tu email",
      html: htmlBody,
      text: textBody,
    })

    if (error) {
      console.error(`[Email] Resend API error sending verification to ${maskEmailForLog(email)}:`, safeErrorForLog(error))
      return false
    }

    console.log(`[Email] Verification sent to ${maskEmailForLog(email)}: ${data?.id}`)
    return true
  } catch (error) {
    console.error(`[Email] Failed to send verification to ${maskEmailForLog(email)}:`, safeErrorForLog(error))
    return false
  }
}

// ============================================
// Send password reset email (Bugfix-5D)
// ============================================
// Seguridad obligatoria (a diferencia de sendVerificationEmail, que sí loguea
// su link en modo desarrollo — precedente ya aceptado para verificación de
// email, un token de bajo riesgo): esta función NUNCA imprime el token real
// ni la URL completa de reset, en ningún modo, ni en éxito ni en error. Y a
// diferencia de sendVerificationEmail, devuelve `false` real cuando el email
// no se pudo enviar de verdad (incluyendo "Resend no configurado") — el
// llamador (forgot-password) depende de esto para revocar el token recién
// creado si el envío falla, en vez de dejar un token válido que nunca pudo
// llegarle a nadie.

export async function sendPasswordResetEmail(
  email: string,
  nombre: string,
  token: string
): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`
  const safeNombre = escapeHtml(nombre)

  const htmlBody = `
    <p>Hola ${safeNombre},</p>
    <p>Hacé click <a href="${resetUrl}">acá</a> para restablecer tu contraseña.</p>
    <p>Este enlace expira en 1 hora. Si no pediste esto, ignorá este email.</p>
  `

  const textBody = `Hola ${nombre},\n\nRestablecé tu contraseña con este enlace: ${resetUrl}\n\nEste enlace expira en 1 hora. Si no pediste esto, ignorá este email.`

  if (!EMAIL_ENABLED || !resend) {
    // Nunca se imprime el token ni la URL — solo que no se pudo enviar.
    console.log("[Email] Password reset NOT sent — Resend no está configurado (RESEND_API_KEY ausente)")
    return false
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [email],
      subject: "DeliGO — Restablecé tu contraseña",
      html: htmlBody,
      text: textBody,
    })

    if (error) {
      console.error("[Email] Resend API error sending password reset:", safeErrorForLog(error))
      return false
    }

    console.log(`[Email] Password reset sent: ${data?.id}`)
    return true
  } catch (error) {
    console.error("[Email] Failed to send password reset:", safeErrorForLog(error))
    return false
  }
}
