import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"
import {
  GOOGLE_OAUTH_PENDING_COOKIE_NAME,
  verifyGoogleOAuthPendingIdentity,
  clearGoogleOAuthPendingCookie,
  type GoogleOAuthPendingClaims,
} from "@/lib/google-oauth-pending"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"

// GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — completes the consent gate that
// /api/auth/google/callback redirects into. Identity (sub/email/name/
// accountType/existingAccountId) always comes from the signed pending
// cookie, never from the request body — the client cannot spoof any of it.

class AccountVanishedError extends Error {}
class EmailAlreadyRegisteredError extends Error {}

// GET — used by the consent page on mount to render "vas a continuar como
// X" without ever putting the email in a URL/query param.
export async function GET(req: NextRequest) {
  const claims = await verifyGoogleOAuthPendingIdentity(
    req.cookies.get(GOOGLE_OAUTH_PENDING_COOKIE_NAME)?.value
  )
  if (!claims) {
    return NextResponse.json(
      { error: "Tu sesión de registro con Google expiró o no existe. Volvé a intentar." },
      { status: 400 }
    )
  }
  return NextResponse.json({
    email: claims.email,
    accountType: claims.accountType,
    isExistingAccount: claims.existingAccountId !== null,
  })
}

// POST — explicit acceptance. Creates the account (if it doesn't exist yet)
// and its LegalAcceptance record atomically, then a real session.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit("googleOauthConsentComplete", ip)
  if (!rl.allowed) {
    return rateLimitResponse(rl, "Demasiados intentos. Intentá de nuevo en unos minutos.")
  }

  // Mismo contrato que /api/auth/register: el cliente debe afirmar
  // explícitamente termsAccepted="true" en el body — la UI real
  // (src/app/auth/google/consentimiento/page.tsx) sólo lo envía cuando el
  // checkbox está tildado; un POST directo sin este campo falla igual que
  // un registro tradicional sin aceptar.
  const body = await req.json().catch(() => ({}) as Record<string, unknown>)
  if (body.termsAccepted !== "true") {
    return NextResponse.json(
      { error: "Debés aceptar los Términos y Condiciones y la Política de Privacidad para continuar" },
      { status: 400 }
    )
  }

  const claims = await verifyGoogleOAuthPendingIdentity(
    req.cookies.get(GOOGLE_OAUTH_PENDING_COOKIE_NAME)?.value
  )
  if (!claims) {
    return NextResponse.json(
      { error: "Tu sesión de registro con Google expiró o no existe. Volvé a intentar." },
      { status: 400 }
    )
  }

  try {
    const userId =
      claims.accountType === "repartidor"
        ? await acceptForRepartidor(claims)
        : await acceptForCliente(claims)

    const sessionToken = await createSession(userId, claims.accountType)
    const response = NextResponse.json({
      ok: true,
      redirect: claims.accountType === "repartidor" ? "/repartidor" : "/cliente/",
    })
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
    })
    clearGoogleOAuthPendingCookie(response)
    return response
  } catch (error) {
    if (error instanceof AccountVanishedError) {
      return NextResponse.json(
        { error: "La cuenta ya no existe. Volvé a iniciar sesión." },
        { status: 400 }
      )
    }
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email. Iniciá sesión normalmente." },
        { status: 409 }
      )
    }
    console.error("Google OAuth consent accept error:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// DELETE — explicit cancel. Never creates an account; only clears the
// pending cookie so a stale identity can't be replayed after "Cancelar".
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  clearGoogleOAuthPendingCookie(response)
  return response
}

async function acceptForRepartidor(claims: GoogleOAuthPendingClaims): Promise<string> {
  return db.$transaction(async (tx) => {
    let accountId = claims.existingAccountId

    if (accountId) {
      const existing = await tx.repartidor.findUnique({ where: { id: accountId }, select: { activo: true } })
      if (!existing || !existing.activo) throw new AccountVanishedError()
    } else {
      // googleId is @unique — Postgres resolves concurrent upserts on it
      // atomically, so a duplicate submit of the same pending token can
      // never create two accounts.
      try {
        const created = await tx.repartidor.upsert({
          where: { googleId: claims.sub },
          update: {},
          create: {
            nombre: claims.name,
            email: claims.email.toLowerCase(),
            password: null,
            googleId: claims.sub,
            telefono: "",
            emailVerified: new Date(),
          },
        })
        accountId = created.id
      } catch (err) {
        if (isUniqueConstraintViolation(err)) throw new EmailAlreadyRegisteredError()
        throw err
      }
    }

    await ensureLegalAcceptance(tx, accountId, "repartidor")
    return accountId
  })
}

async function acceptForCliente(claims: GoogleOAuthPendingClaims): Promise<string> {
  return db.$transaction(async (tx) => {
    let accountId = claims.existingAccountId

    if (accountId) {
      const existing = await tx.cliente.findUnique({ where: { id: accountId } })
      if (!existing) throw new AccountVanishedError()
    } else {
      try {
        const created = await tx.cliente.upsert({
          where: { googleId: claims.sub },
          update: {},
          create: {
            nombre: claims.name,
            email: claims.email.toLowerCase(),
            password: null,
            googleId: claims.sub,
            telefono: "",
            emailVerified: new Date(),
          },
        })
        accountId = created.id
      } catch (err) {
        if (isUniqueConstraintViolation(err)) throw new EmailAlreadyRegisteredError()
        throw err
      }
    }

    await ensureLegalAcceptance(tx, accountId, "cliente")
    return accountId
  })
}

async function ensureLegalAcceptance(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: string,
  userType: "cliente" | "repartidor"
): Promise<void> {
  const alreadyAccepted = await tx.legalAcceptance.findFirst({ where: { userId, userType } })
  if (alreadyAccepted) return
  await tx.legalAcceptance.create({
    data: {
      userId,
      userType,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      source: "google_oauth",
    },
  })
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: unknown }).code === "P2002"
  )
}
