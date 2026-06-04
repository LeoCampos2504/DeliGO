import nodemailer from "nodemailer"
import { randomUUID } from "crypto"

// ============================================
// Email Configuration
// ============================================

const SMTP_HOST = process.env.SMTP_HOST || ""
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10)
const SMTP_USER = process.env.SMTP_USER || ""
const SMTP_PASS = process.env.SMTP_PASS || ""
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "DeliGO"
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER || "noreply@deligo.app"
const SMTP_FROM = `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Whether email sending is enabled (requires SMTP config)
const EMAIL_ENABLED = !!(SMTP_HOST && SMTP_USER && SMTP_PASS)

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  }
  return transporter
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
  const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${token}`

  const roleLabel =
    userType === "negocio" ? "tu local" : userType === "repartidor" ? "tu cuenta de repartidor" : "tu cuenta"

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
              <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px; font-weight: 700;">¡Hola, ${nombre}! 👋</h2>
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

  if (!EMAIL_ENABLED) {
    // In development, log the verification link instead of sending
    console.log(`\n📧 [EMAIL DEV MODE] Verification email for ${email} (${userType})`)
    console.log(`   Verification URL: ${verificationUrl}\n`)
    return true
  }

  try {
    const info = await getTransporter().sendMail({
      from: SMTP_FROM,
      to: email,
      subject: "DeliGO — Verificá tu email",
      html: htmlBody,
      text: textBody,
    })
    console.log(`[Email] Verification sent to ${email}: ${info.messageId}`)
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
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  if (!EMAIL_ENABLED) {
    console.log(`\n📧 [EMAIL DEV MODE] Password reset email for ${email}`)
    console.log(`   Reset URL: ${resetUrl}\n`)
    return true
  }

  try {
    const info = await getTransporter().sendMail({
      from: SMTP_FROM,
      to: email,
      subject: "DeliGO — Restablecé tu contraseña",
      html: `<p>Hola ${nombre},</p><p>Hacé click <a href="${resetUrl}">acá</a> para restablecer tu contraseña.</p><p>Este enlace expira en 1 hora.</p>`,
      text: `Hola ${nombre},\n\nRestablecé tu contraseña con este enlace: ${resetUrl}\n\nEste enlace expira en 1 hora.`,
    })
    console.log(`[Email] Password reset sent to ${email}: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`[Email] Failed to send password reset to ${email}:`, error)
    return false
  }
}
