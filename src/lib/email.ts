import { randomUUID } from "crypto"

// ============================================
// Email Configuration (Resend API over HTTP)
// ============================================
//
// Email sending is handled via the Resend HTTP API:
//   POST https://api.resend.com/emails
//   Authorization: Bearer ${RESEND_API_KEY}
//
// Required environment variables:
//   - RESEND_API_KEY    : API key from Resend (re_...)
//   - EMAIL_FROM        : From address, e.g. "DeliGO <noreply@deligo.app>"
//   - NEXT_PUBLIC_APP_URL: Public app URL used to build verification links
//
// We intentionally do NOT use SMTP/Nodemailer. If RESEND_API_KEY is not set,
// email sending is disabled and the verification link is logged to the server
// console (useful for local development).

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  "DeliGO <noreply@deligo.app>"
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000"

// Whether email sending is enabled (requires Resend API key)
const EMAIL_ENABLED = !!RESEND_API_KEY

const RESEND_ENDPOINT = "https://api.resend.com/emails"

// ============================================
// Low-level Resend HTTP send
// ============================================

interface ResendSendParams {
  to: string
  subject: string
  html: string
  text: string
}

interface ResendSendResult {
  success: boolean
  messageId?: string
}

async function sendWithResend(params: ResendSendParams): Promise<ResendSendResult> {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    })

    if (!response.ok) {
      // Log only a generic marker + status; do not print the raw body which
      // may contain API-key echoes or PII.
      console.error(
        `[Email] Resend API returned status ${response.status} for recipient ending in "@${params.to.split("@").pop()}"`
      )
      return { success: false }
    }

    const data = (await response.json()) as { id?: string }
    return { success: true, messageId: data.id }
  } catch (error) {
    // Avoid printing the full error (may include network details).
    console.error("[Email] Resend request failed:", error instanceof Error ? error.name : "Unknown")
    return { success: false }
  }
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

  const result = await sendWithResend({
    to: email,
    subject: "DeliGO — Verificá tu email",
    html: htmlBody,
    text: textBody,
  })

  if (result.success) {
    console.log(`[Email] Verification sent to ${email}: ${result.messageId ?? "ok"}`)
    return true
  }
  return false
}

// ============================================
// Send password reset email
// ============================================

export async function sendPasswordResetEmail(
  email: string,
  nombre: string,
  token: string
): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

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
          <tr>
            <td style="background: linear-gradient(135deg, #FB8C00, #F57C00); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">DeliGO</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px; font-weight: 700;">¡Hola, ${nombre}! 👋</h2>
              <p style="margin: 0 0 24px; color: #666666; font-size: 16px; line-height: 1.5;">
                Recibimos una solicitud para restablecer tu contraseña.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #FB8C00, #F57C00); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 14px 40px; border-radius: 12px;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #999999; font-size: 13px; line-height: 1.5;">
                Si el botón no funciona, copiá este enlace en tu navegador:<br>
                <a href="${resetUrl}" style="color: #FB8C00; word-break: break-all;">${resetUrl}</a>
              </p>
              <p style="margin: 16px 0 0; color: #999999; font-size: 13px;">
                Este enlace expira en 1 hora. Si no solicitaste este cambio, ignorá este email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafafa; padding: 20px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #aaaaaa; font-size: 12px;">
                © ${new Date().getFullYear()} DeliGO — Restablecimiento de contraseña
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
DeliGO - Restablecé tu contraseña

¡Hola, ${nombre}!

Restablecé tu contraseña con el siguiente enlace:

${resetUrl}

Este enlace expira en 1 hora.

Si no solicitaste este cambio, ignorá este email.
  `

  if (!EMAIL_ENABLED) {
    console.log(`\n📧 [EMAIL DEV MODE] Password reset email for ${email}`)
    console.log(`   Reset URL: ${resetUrl}\n`)
    return true
  }

  const result = await sendWithResend({
    to: email,
    subject: "DeliGO — Restablecé tu contraseña",
    html: htmlBody,
    text: textBody,
  })

  if (result.success) {
    console.log(`[Email] Password reset sent to ${email}: ${result.messageId ?? "ok"}`)
    return true
  }
  return false
}
