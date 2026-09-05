import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSessionWithClient, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth"
import { hashVerificationToken } from "@/lib/email"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { notifySuperadmins } from "@/lib/superadmin-notifications"

function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
  })
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")

    if (!token) {
      return renderHtmlPage({
        success: false,
        title: "Token inválido",
        message: "El enlace de verificación no es válido.",
      })
    }

    const tokenHash = hashVerificationToken(token)
    const now = new Date()

    // New verification tokens are stored as hashes. There is deliberately no
    // plaintext fallback: legacy rows without freshness metadata fail closed
    // and the user must request a new email.
    const clienteOutcome = await db.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { verificationToken: tokenHash } })
      if (!cliente || !cliente.verificationTokenExpiresAt || cliente.verificationTokenExpiresAt <= now) return null

      const claimed = await tx.cliente.updateMany({
        where: {
          id: cliente.id,
          verificationToken: tokenHash,
          verificationTokenExpiresAt: { gt: now },
          emailVerified: null,
        },
        data: { emailVerified: now, verificationToken: null, verificationTokenExpiresAt: null },
      })
      if (claimed.count !== 1) return null
      return { sessionToken: await createSessionWithClient(tx, cliente.id, "cliente") }
    })
    if (clienteOutcome) {
      const sessionToken = clienteOutcome.sessionToken

      const response = renderHtmlPage({
        success: true,
        title: "¡Email verificado!",
        message: "Tu email fue verificado correctamente. Ya podés usar tu cuenta.",
        autoLogin: true,
        redirectUrl: "/cliente/",
      })
      setSessionCookie(response, sessionToken)
      return response
    }

    const negocioOutcome = await db.$transaction(async (tx) => {
      const negocio = await tx.negocio.findUnique({ where: { verificationToken: tokenHash } })
      if (!negocio || !negocio.verificationTokenExpiresAt || negocio.verificationTokenExpiresAt <= now) return null

      const claimed = await tx.negocio.updateMany({
        where: {
          id: negocio.id,
          verificationToken: tokenHash,
          verificationTokenExpiresAt: { gt: now },
          emailVerified: null,
        },
        data: { emailVerified: now, verificationToken: null, verificationTokenExpiresAt: null },
      })
      if (claimed.count !== 1) return null

      // P2-T26-R2: "negocio pendiente de aprobación" — R1 encontró que este
      // evento (email verificado, aún sin aprobar) nunca notificaba a
      // SuperAdmin, a pesar de ser estructuralmente idéntico a
      // review_moderation (una acción externa que espera revisión) y de
      // coincidir EXACTAMENTE con la definición de "pendiente" que ya usa
      // el propio dashboard (aprobado:false && emailVerified:{not:null},
      // src/app/api/superadmin/dashboard/route.ts). Se dispara acá, no en
      // el registro: un negocio que nunca verifica su email nunca aparece
      // en el tab "pendientes", así que notificar antes sería ruido.
      // Participa de esta misma transacción (igual que la creación de la
      // cuenta+LegalAcceptance más arriba): el CAS de `claimed` ya garantiza
      // que este bloque corre como máximo una vez por negocio — un segundo
      // click sobre el mismo link de verificación falla el CAS (count 0) y
      // nunca vuelve a notificar.
      if (!negocio.aprobado) {
        await notifySuperadmins(tx, {
          tipo: "negocio_pendiente",
          titulo: "Nuevo negocio pendiente",
          cuerpo: `${negocio.nombre} verificó su email y espera aprobación.`,
          datos: { entityId: negocio.id, navigateTo: "pendientes" },
        })
      }

      return {
        approved: negocio.aprobado,
        sessionToken: negocio.aprobado
          ? await createSessionWithClient(tx, negocio.id, "negocio")
          : null,
      }
    })
    if (negocioOutcome) {
      const sessionToken = negocioOutcome.sessionToken

      if (!negocioOutcome.approved) {
        return renderHtmlPage({
          success: true,
          title: "¡Email verificado!",
          message: "Tu email fue verificado correctamente. Un administrador aprobará tu local pronto.",
          isNegocioPendingApproval: true,
        })
      }

      if (!sessionToken) return invalidVerificationPage()

      const response = renderHtmlPage({
        success: true,
        title: "¡Email verificado!",
        message: "Tu email fue verificado correctamente. Ya podés usar tu cuenta.",
        autoLogin: true,
        redirectUrl: "/negocio",
      })
      setSessionCookie(response, sessionToken)
      return response
    }

    const repartidorOutcome = await db.$transaction(async (tx) => {
      const repartidor = await tx.repartidor.findUnique({ where: { verificationToken: tokenHash } })
      if (!repartidor || !repartidor.verificationTokenExpiresAt || repartidor.verificationTokenExpiresAt <= now) return null

      const claimed = await tx.repartidor.updateMany({
        where: {
          id: repartidor.id,
          verificationToken: tokenHash,
          verificationTokenExpiresAt: { gt: now },
          emailVerified: null,
        },
        data: { emailVerified: now, verificationToken: null, verificationTokenExpiresAt: null },
      })
      if (claimed.count !== 1) return null
      if (!repartidor.activo) return { inactive: true, sessionToken: null }
      return { inactive: false, sessionToken: await createSessionWithClient(tx, repartidor.id, "repartidor") }
    })
    if (repartidorOutcome) {
      if (repartidorOutcome.inactive) {
        return renderHtmlPage({
          success: true,
          title: "Email verificado",
          message: "Tu email fue verificado. Tu cuenta está pendiente de activación por un administrador.",
          redirectUrl: "/repartidor",
        })
      }

      const sessionToken = repartidorOutcome.sessionToken
      if (!sessionToken) return invalidVerificationPage()

      const response = renderHtmlPage({
        success: true,
        title: "¡Email verificado!",
        message: "Tu email fue verificado correctamente. Ya podés usar tu cuenta.",
        autoLogin: true,
        redirectUrl: "/repartidor",
      })
      setSessionCookie(response, sessionToken)
      return response
    }

    return invalidVerificationPage()
  } catch (error) {
    console.error("Verify email error:", safeErrorForLog(error))
    return invalidVerificationPage()
  }
}

function invalidVerificationPage(): NextResponse {
  return renderHtmlPage({
    success: false,
    title: "Enlace inválido",
    message: "El enlace de verificación no es válido o expiró.",
  })
}

function renderHtmlPage(params: {
  success: boolean
  title: string
  message: string
  autoLogin?: boolean
  redirectUrl?: string
  isNegocioPendingApproval?: boolean
}): NextResponse {
  const {
    success,
    title,
    message,
    autoLogin,
    redirectUrl,
    isNegocioPendingApproval,
  } = params

  const redirectScript = autoLogin
    ? `
    setTimeout(() => { window.location.href = ${JSON.stringify(redirectUrl ?? "/cliente/")}; }, 3000);
  `
    : ""

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — DeliGO</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 24px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      max-width: 440px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #FB8C00, #F57C00);
      padding: 32px 40px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .body {
      padding: 40px 32px;
      text-align: center;
    }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }
    .icon-success {
      background: #e8f5e9;
      color: #4caf50;
      animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .icon-error {
      background: #fbe9e7;
      color: #f44336;
      animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes popIn {
      0% { transform: scale(0); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    .message {
      font-size: 15px;
      color: #666666;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .countdown {
      font-size: 13px;
      color: #999999;
      margin-top: 16px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #FB8C00, #F57C00);
      color: #ffffff;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      padding: 12px 32px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
    }
    .btn:hover { opacity: 0.9; }
    .pending-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #fff3e0;
      border-radius: 12px;
      padding: 12px 20px;
      margin-top: 16px;
      font-size: 13px;
      color: #e65100;
      font-weight: 600;
    }
    .footer {
      background: #fafafa;
      padding: 16px 32px;
      text-align: center;
      border-top: 1px solid #eeeeee;
      font-size: 12px;
      color: #aaaaaa;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>DeliGO</h1>
    </div>
    <div class="body">
      <div class="icon-wrapper ${success ? "icon-success" : "icon-error"}">
        ${success ? "✓" : "✕"}
      </div>
      <div class="title">${title}</div>
      <div class="message">${message}</div>
      ${isNegocioPendingApproval ? `
        <div class="pending-badge">
          ⏳ Esperando aprobación del admin
        </div>
      ` : ""}
      ${autoLogin ? `
        <div class="countdown">Redirigiendo en <span id="seconds">3</span> segundos...</div>
      ` : `
        <a href="/cliente/" class="btn">Volver al inicio</a>
      `}
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} DeliGO — Verificación de email
    </div>
  </div>
  <script>
    ${redirectScript}
    ${autoLogin ? `
    let secs = 3;
    const el = document.getElementById("seconds");
    const interval = setInterval(() => {
      secs--;
      if (el) el.textContent = secs;
      if (secs <= 0) clearInterval(interval);
    }, 1000);
    ` : ""}
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
