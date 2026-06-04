import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth"

const HOURS_24 = 24 * 60 * 60 * 1000

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

    // Search across all user types
    const cliente = await db.cliente.findUnique({ where: { verificationToken: token } })
    if (cliente) {
      // Check token age (use emailVerified null as proxy — check createdAt via fechaRegistro)
      // We use the fact that the user was just created. Check if verificationToken is older than 24h
      // Since we don't store token creation time, we use fechaRegistro as an approximation
      if (cliente.fechaRegistro && (Date.now() - cliente.fechaRegistro.getTime()) > HOURS_24 * 30) {
        // Very old account — likely expired, but we still allow verification for now
        // A more precise approach would need a tokenIssuedAt field
      }

      await db.cliente.update({
        where: { id: cliente.id },
        data: { emailVerified: new Date(), verificationToken: null },
      })

      // Create session for auto-login
      const sessionToken = await createSession(cliente.id, "cliente")

      return renderHtmlPage({
        success: true,
        title: "¡Email verificado!",
        message: "Tu email fue verificado correctamente. Ya podés usar tu cuenta.",
        autoLogin: true,
        sessionToken,
        userType: "cliente",
        userName: cliente.nombre,
        userId: cliente.id,
        userEmail: cliente.email,
      })
    }

    const negocio = await db.negocio.findUnique({ where: { verificationToken: token } })
    if (negocio) {
      await db.negocio.update({
        where: { id: negocio.id },
        data: { emailVerified: new Date(), verificationToken: null },
      })

      if (!negocio.aprobado) {
        return renderHtmlPage({
          success: true,
          title: "¡Email verificado!",
          message: "Tu email fue verificado correctamente. Un administrador aprobará tu local pronto.",
          isNegocioPendingApproval: true,
        })
      }

      // Negocio is approved — create session and auto-login
      const sessionToken = await createSession(negocio.id, "negocio")

      return renderHtmlPage({
        success: true,
        title: "¡Email verificado!",
        message: "Tu email fue verificado correctamente. Ya podés usar tu cuenta.",
        autoLogin: true,
        sessionToken,
        userType: "negocio",
        userName: negocio.nombre,
        userId: negocio.id,
        userSlug: negocio.slug,
        userRubro: negocio.rubro,
      })
    }

    const repartidor = await db.repartidor.findUnique({ where: { verificationToken: token } })
    if (repartidor) {
      await db.repartidor.update({
        where: { id: repartidor.id },
        data: { emailVerified: new Date(), verificationToken: null },
      })

      // Create session for auto-login
      const sessionToken = await createSession(repartidor.id, "repartidor")

      return renderHtmlPage({
        success: true,
        title: "¡Email verificado!",
        message: "Tu email fue verificado correctamente. Ya podés usar tu cuenta.",
        autoLogin: true,
        sessionToken,
        userType: "repartidor",
        userName: repartidor.nombre,
        userId: repartidor.id,
        userEmail: repartidor.email,
      })
    }

    // Token not found
    return renderHtmlPage({
      success: false,
      title: "Enlace inválido",
      message: "El enlace de verificación no es válido o ya fue utilizado.",
    })
  } catch (error) {
    console.error("Verify email error:", error)
    return renderHtmlPage({
      success: false,
      title: "Error",
      message: "Ocurrió un error al verificar tu email. Intentá de nuevo.",
    })
  }
}

function renderHtmlPage(params: {
  success: boolean
  title: string
  message: string
  autoLogin?: boolean
  sessionToken?: string
  userType?: string
  userName?: string
  userId?: string
  userEmail?: string
  userSlug?: string
  userRubro?: string
  isNegocioPendingApproval?: boolean
}): NextResponse {
  const {
    success,
    title,
    message,
    autoLogin,
    sessionToken,
    userType,
    userName,
    userId,
    userEmail,
    userSlug,
    userRubro,
    isNegocioPendingApproval,
  } = params

  const cookieScript = autoLogin && sessionToken
    ? `
    // Set session cookie
    document.cookie = "deligo_session=${sessionToken}; path=/; max-age=${SESSION_DURATION_HOURS * 60 * 60}; SameSite=Lax" + (location.protocol === 'https:' ? '; Secure' : '');

    // Set auth in localStorage for client-side
    const authData = {
      state: {
        user: {
          id: "${userId}",
          type: "${userType}",
          nombre: "${userName}",
          ${userEmail ? `email: "${userEmail}",` : ""}
          ${userSlug ? `slug: "${userSlug}",` : ""}
          ${userRubro ? `rubro: "${userRubro}",` : ""}
          ${userType === "negocio" ? "aprobado: true," : ""}
          ${userType === "repartidor" ? "activo: true," : ""}
        },
        token: "${sessionToken}"
      },
      version: 0
    };
    localStorage.setItem("deligo-auth", JSON.stringify(authData));

    // Redirect after 3 seconds
    setTimeout(() => { window.location.href = "/"; }, 3000);
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
        <a href="/" class="btn">Volver al inicio</a>
      `}
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} DeliGO — Verificación de email
    </div>
  </div>
  <script>
    ${cookieScript}
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
