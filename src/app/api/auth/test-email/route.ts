import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/auth/test-email
 *
 * Diagnostic endpoint to check Resend email configuration and test sending.
 * Only available in development mode or with an admin secret.
 *
 * Usage:
 *   /api/auth/test-email              → Check Resend config status
 *   /api/auth/test-email?send=1       → Send a test email (requires ?to=email@example.com)
 *   /api/auth/test-email?send=1&to=test@gmail.com
 */
export async function GET(req: NextRequest) {
  // Security: only allow in development or with secret
  const isDev = process.env.NODE_ENV === "development"
  const secret = req.nextUrl.searchParams.get("secret")
  const adminSecret = process.env.ADMIN_SECRET || "deligo-test-2024"

  if (!isDev && secret !== adminSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
  const EMAIL_FROM = process.env.EMAIL_FROM || ""
  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"

  const configured = !!RESEND_API_KEY

  // Never echo back the API key — only show whether it is set.
  const config = {
    EMAIL_ENABLED: configured,
    PROVIDER: "Resend (HTTP API)",
    EMAIL_FROM: EMAIL_FROM || "(empty — using default)",
    APP_URL,
    RESEND_API_KEY: RESEND_API_KEY ? "✅ set" : "❌ not set",
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY ? "✅ set" : "❌ not set",
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ? "✅ set" : "❌ not set",
    NOTE: "Email is sent via the Resend HTTP API. VAPID keys are for Web Push Notifications only.",
  }

  const shouldSend = req.nextUrl.searchParams.get("send") === "1"
  const toEmail = req.nextUrl.searchParams.get("to")

  if (shouldSend && toEmail) {
    if (!configured) {
      return NextResponse.json({
        config,
        test: "FAILED",
        error: "Resend no está configurado. No se puede enviar el email de prueba.",
        hint: "Configurá RESEND_API_KEY y EMAIL_FROM en tus variables de entorno.",
      })
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM || "DeliGO <noreply@deligo.app>",
          to: [toEmail],
          subject: "DeliGO — Email de prueba (diagnóstico)",
          html: `<h2>¡Email de prueba!</h2><p>Si recibiste este email, la configuración de Resend funciona correctamente.</p><p>Enviado desde: ${APP_URL}</p>`,
          text: "¡Email de prueba! Si recibiste este email, la configuración de Resend funciona correctamente.",
        }),
      })

      if (!response.ok) {
        // Do not leak the raw error body to the client.
        let hint = "No se pudo enviar el email de prueba. Revisá los logs del servidor."
        if (response.status === 401 || response.status === 403) {
          hint = "La API key de Resend es inválida o no tiene permisos. Verificá RESEND_API_KEY."
        } else if (response.status === 422) {
          hint = "El dominio del EMAIL_FROM no está verificado en Resend, o el destinatario es inválido."
        }
        return NextResponse.json({
          config,
          test: "FAILED ❌",
          errorCode: `RESEND_HTTP_${response.status}`,
          hint,
        })
      }

      const data = (await response.json()) as { id?: string }
      return NextResponse.json({
        config,
        test: "SUCCESS ✅",
        messageId: data.id,
      })
    } catch (error: unknown) {
      // Network-level failure (DNS, timeout, etc.). Do not leak details.
      const errName = error instanceof Error ? error.name : "Unknown"
      let hint = "No se pudo conectar con la API de Resend. Revisá la conexión de red del servidor."
      if (errName === "AbortError" || /timeout/i.test(errName)) {
        hint = "La solicitud a Resend superó el tiempo límite. Reintentá en unos segundos."
      }
      return NextResponse.json({
        config,
        test: "FAILED ❌",
        errorCode: "RESEND_NETWORK_ERROR",
        hint,
      })
    }
  }

  return NextResponse.json({
    config,
    message: configured
      ? "Resend está configurado. Usá ?send=1&to=tu@email.com para enviar un email de prueba."
      : "Resend NO está configurado. Los emails no se envían realmente. Configurá RESEND_API_KEY y EMAIL_FROM.",
  })
}
