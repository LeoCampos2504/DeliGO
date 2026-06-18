import { randomUUID } from "crypto"
import { Resend } from "resend"

// ============================================
// Email Configuration - Resend API
// ============================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM ||
  "DeliGO <no-reply@deligo.ar>"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Whether email sending is enabled (requires Resend API key)
const EMAIL_ENABLED = !!RESEND_API_KEY

const resend = EMAIL_ENABLED ? new Resend(RESEND_API_KEY) : null

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

export function generateVerificationToken(): string {
  return randomUUID()
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
    // In development, log the verification link instead of sending
    console.log(`\n📧 [EMAIL DEV MODE] Verification email for ${email} (${userType})`)
    console.log(`   Verification URL: ${verificationUrl}\n`)
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
      console.error(`[Email] Resend API error sending verification to ${email}:`, error)
      return false
    }

    console.log(`[Email] Verification sent to ${email}: ${data?.id}`)
    return true
  } catch (error) {
    console.error(`[Email] Failed to send verification to ${email}:`, error)
    return false
  }
}

// ============================================
// Send password reset email (future use)
// ============================================

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
    <p>Este enlace expira en 1 hora.</p>
  `

  const textBody = `Hola ${nombre},\n\nRestablecé tu contraseña con este enlace: ${resetUrl}\n\nEste enlace expira en 1 hora.`

  if (!EMAIL_ENABLED || !resend) {
    console.log(`\n📧 [EMAIL DEV MODE] Password reset email for ${email}`)
    console.log(`   Reset URL: ${resetUrl}\n`)
    return true
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
      console.error(`[Email] Resend API error sending password reset to ${email}:`, error)
      return false
    }

    console.log(`[Email] Password reset sent to ${email}: ${data?.id}`)
    return true
  } catch (error) {
    console.error(`[Email] Failed to send password reset to ${email}:`, error)
    return false
  }
}
