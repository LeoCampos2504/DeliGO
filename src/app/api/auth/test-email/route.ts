import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/auth/test-email
 *
 * Diagnostic endpoint to check SMTP configuration and test email sending.
 * Only available in development mode.
 *
 * Usage:
 *   /api/auth/test-email              → Check SMTP config status
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

  const SMTP_HOST = process.env.SMTP_HOST || ""
  const SMTP_PORT = process.env.SMTP_PORT || "587"
  const SMTP_USER = process.env.SMTP_USER || ""
  const SMTP_PASS = process.env.SMTP_PASS || ""
  const SMTP_SECURE = process.env.SMTP_SECURE || ""
  const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "DeliGO"
  const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || ""
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

  const configured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS)

  const config = {
    EMAIL_ENABLED: configured,
    SMTP_HOST: SMTP_HOST || "(empty)",
    SMTP_PORT,
    SMTP_SECURE: SMTP_SECURE || "(not set)",
    SMTP_USER: SMTP_USER ? `${SMTP_USER.slice(0, 3)}***` : "(empty)",
    SMTP_PASS: SMTP_PASS ? "***hidden***" : "(empty)",
    SMTP_FROM: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL || SMTP_USER || "noreply@deligo.app"}>`,
    APP_URL,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY ? "✅ set" : "❌ not set",
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ? "✅ set" : "❌ not set",
    NOTE: "VAPID keys are for Web Push Notifications only, NOT for email. Email uses SMTP.",
  }

  const shouldSend = req.nextUrl.searchParams.get("send") === "1"
  const toEmail = req.nextUrl.searchParams.get("to")

  if (shouldSend && toEmail) {
    if (!configured) {
      return NextResponse.json({
        config,
        test: "FAILED",
        error: "SMTP no configurado. No se puede enviar el email de prueba.",
        hint: "Configurá SMTP_HOST, SMTP_USER y SMTP_PASS en tus variables de entorno.",
      })
    }

    try {
      const nodemailer = await import("nodemailer")
      const transporter = nodemailer.default.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10),
        secure: SMTP_SECURE === "true" || SMTP_PORT === "465",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      })

      const info = await transporter.sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL || SMTP_USER}>`,
        to: toEmail,
        subject: "DeliGO — Email de prueba (diagnóstico)",
        html: `<h2>¡Email de prueba!</h2><p>Si recibiste este email, la configuración SMTP funciona correctamente.</p><p>Enviado desde: ${APP_URL}</p>`,
        text: "¡Email de prueba! Si recibiste este email, la configuración SMTP funciona correctamente.",
      })

      transporter.close()

      return NextResponse.json({
        config,
        test: "SUCCESS ✅",
        messageId: info.messageId,
        response: info.response,
      })
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      const errCode = (error as Record<string, unknown>)?.code || ""

      let hint = ""
      if (errMsg.includes("EAUTH") || errMsg.includes("Invalid login")) {
        hint = "El usuario/contraseña SMTP es incorrecto. Verificá SMTP_USER y SMTP_PASS. Si usás Gmail, generá un App Password."
      } else if (errMsg.includes("ECONNECTION") || errMsg.includes("ETIMEDOUT") || errMsg.includes("connect")) {
        hint = "No se puede conectar al servidor SMTP. Verificá SMTP_HOST y SMTP_PORT. Muchos proveedores (Gmail) bloquean conexiones desde servidores cloud como Railway."
      } else if (errMsg.includes("self signed") || errMsg.includes("certificate") || errMsg.includes("SSL")) {
        hint = "Error de SSL/TLS. Probá SMTP_SECURE=true o cambiá el puerto a 465."
      }

      return NextResponse.json({
        config,
        test: "FAILED ❌",
        errorCode: errCode,
        errorMessage: errMsg,
        hint,
      })
    }
  }

  return NextResponse.json({
    config,
    message: configured
      ? "SMTP está configurado. Usá ?send=1&to=tu@email.com para enviar un email de prueba."
      : "SMTP NO está configurado. Los emails no se envían realmente. Configurá SMTP_HOST, SMTP_USER y SMTP_PASS.",
  })
}
