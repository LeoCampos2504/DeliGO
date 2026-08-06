// ============================================
// DeliGO — Sesión y autorización Superadmin (24-A)
// ============================================
// Sesión completamente aislada de cliente/negocio/repartidor/operativo:
// cookie propia, y aunque reutiliza la tabla `Sesion` ya existente (mismo
// patrón hash-only que src/lib/auth.ts usa para todos los demás roles —
// preferencia explícita de la etapa: reutilizar infraestructura revocable
// existente antes que inventar una nueva), el token nunca viaja bajo el
// nombre de cookie compartido (`deligo_session`), así que ninguna sesión de
// otro rol puede autorizar acá y viceversa.
//
// No se agrega un mecanismo paralelo de revocación por versión
// (`authVersion`): la tabla `Sesion` ya es revocable fila por fila
// (`deleteSession` borra la fila; expira sola por `expiresAt`), así que un
// segundo mecanismo no tiene justificación clara en esta etapa.

import { randomBytes } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { hashSessionToken, findSesionByToken, deleteSession } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import {
  resolverIdentidadSuperadminGoogle,
  readSuperadminIdentityConfigFromEnv,
  type SuperadminGoogleClaims,
  type SuperadminIdentityRejectReason,
} from "@/lib/superadmin-identity"

// ---------------------------------------------------------------------------
// Cookies — nombres únicos, nunca compartidos con otro rol.
// ---------------------------------------------------------------------------

export const SUPERADMIN_SESSION_COOKIE_NAME = "deligo_superadmin_session"
export const SUPERADMIN_OAUTH_STATE_COOKIE = "deligo_superadmin_oauth_state"
export const SUPERADMIN_OAUTH_NONCE_COOKIE = "deligo_superadmin_oauth_nonce"
export const SUPERADMIN_OAUTH_PKCE_COOKIE = "deligo_superadmin_oauth_pkce"

// Deliberadamente más corta que SESSION_DURATION_HOURS (12h) del resto de la
// app — es la cuenta de mayor privilegio de la plataforma.
export const SUPERADMIN_SESSION_DURATION_HOURS = 8
export const SUPERADMIN_OAUTH_COOKIE_MAX_AGE_SECONDS = 600 // 5-10 min

const SUPERADMIN_USER_TYPE = "superadmin"

// ---------------------------------------------------------------------------
// Sesión: creación / validación / revocación
// ---------------------------------------------------------------------------

/** Token opaco de 256 bits — nunca se guarda crudo, solo su hash SHA-256. */
function generateSuperadminSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export async function createSuperadminSession(superadminId: string): Promise<string> {
  const token = generateSuperadminSessionToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + SUPERADMIN_SESSION_DURATION_HOURS)

  await db.sesion.create({
    data: {
      token: hashSessionToken(token),
      userId: superadminId,
      userType: SUPERADMIN_USER_TYPE,
      expiresAt,
    },
  })

  return token
}

export interface SuperadminIdentity {
  id: string
  email: string | null
}

/** Revalida server-side: sesión no expirada, fila SuperAdmin activa y con googleSub. */
export async function validateSuperadminSession(token: string): Promise<SuperadminIdentity | null> {
  const session = await findSesionByToken(token)
  if (!session) return null
  if (session.userType !== SUPERADMIN_USER_TYPE) return null
  if (session.expiresAt.getTime() < Date.now()) return null

  const admin = await db.superAdmin.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, activo: true, googleSub: true },
  })
  if (!admin || !admin.activo || !admin.googleSub) return null

  return { id: admin.id, email: admin.email }
}

export async function revokeSuperadminSession(token: string): Promise<void> {
  await deleteSession(token)
}

/**
 * Helper único que TODA ruta bajo /api/superadmin (excepto inicio OAuth,
 * callback OAuth y logout) debe usar. Rechaza por defecto: nunca acepta rol
 * desde el body, negocioId como autoridad, header/query param inventado, ni
 * la cookie legacy compartida.
 */
export async function requireSuperadminSession(
  req: NextRequest
): Promise<{ ok: true; admin: SuperadminIdentity } | { ok: false; status: 401 }> {
  const token = req.cookies.get(SUPERADMIN_SESSION_COOKIE_NAME)?.value
  if (!token) return { ok: false, status: 401 }

  const admin = await validateSuperadminSession(token)
  if (!admin) return { ok: false, status: 401 }

  return { ok: true, admin }
}

// ---------------------------------------------------------------------------
// Bootstrap / autenticación — orquestación transaccional sobre la decisión
// pura de src/lib/superadmin-identity.ts
// ---------------------------------------------------------------------------

export type SuperadminAuthResult =
  | { ok: true; id: string; bootstrapped: boolean }
  | { ok: false; reason: SuperadminIdentityRejectReason | "db_conflict" }

function isGoogleSubUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray((error.meta as { target?: unknown })?.target) &&
    ((error.meta as { target: unknown[] }).target).includes("googleSub")
  )
}

/** Trunca el sub para correlación en auditoría sin exponerlo completo. */
function truncateSub(sub: string): string {
  return sub.length > 10 ? `${sub.slice(0, 10)}…` : sub
}

async function attemptBootstrapOrAuthenticate(
  claims: SuperadminGoogleClaims
): Promise<SuperadminAuthResult | null> {
  const config = readSuperadminIdentityConfigFromEnv()
  const rows = await db.superAdmin.findMany({
    select: { id: true, googleSub: true, activo: true },
  })
  const decision = resolverIdentidadSuperadminGoogle(claims, config, rows)

  switch (decision.action) {
    case "reject":
      return { ok: false, reason: decision.reason }

    case "authenticate":
      return { ok: true, id: decision.id, bootstrapped: false }

    case "create": {
      try {
        const created = await db.superAdmin.create({
          data: {
            googleSub: decision.googleSub,
            email: decision.email,
            activo: true,
            password: null,
          },
          select: { id: true },
        })
        return { ok: true, id: created.id, bootstrapped: true }
      } catch (error) {
        if (isGoogleSubUniqueViolation(error)) {
          // Otro request concurrente ya vinculó este mismo sub — no es un
          // error, es la carrera de bootstrap resolviéndose. Señal para
          // reintentar la decisión una vez con el estado ya consistente.
          return null
        }
        throw error
      }
    }

    case "link": {
      // CAS: solo vincula si la fila TODAVÍA no tiene googleSub en este
      // instante — mismo patrón que el CAS de cancelarPedidoMesa (23-A1).
      const cas = await db.superAdmin.updateMany({
        where: { id: decision.id, googleSub: null },
        data: { googleSub: decision.googleSub, email: decision.email, activo: true },
      })
      if (cas.count !== 1) {
        return null // perdió la carrera — reintentar una vez
      }
      return { ok: true, id: decision.id, bootstrapped: true }
    }
  }
}

/**
 * Punto de entrada único desde el callback OAuth. Nunca recibe un `sub` del
 * cliente — `claims` ya viene verificado por
 * src/lib/superadmin-google-oauth.ts. Reintenta la decisión como máximo una
 * vez ante una colisión de concurrencia genuina; dos colisiones seguidas
 * quedan fail-closed en vez de reintentar indefinidamente.
 */
export async function bootstrapOrAuthenticateSuperadmin(
  claims: SuperadminGoogleClaims,
  context: { ip: string } = { ip: "" }
): Promise<SuperadminAuthResult> {
  let result = await attemptBootstrapOrAuthenticate(claims)
  if (result === null) {
    result = await attemptBootstrapOrAuthenticate(claims)
  }
  if (result === null) {
    result = { ok: false, reason: "db_conflict" }
  }

  const truncatedSub = claims.sub ? truncateSub(claims.sub.trim()) : "sin_sub"

  if (result.ok) {
    await auditLog({
      userId: result.id,
      userType: SUPERADMIN_USER_TYPE,
      accion: result.bootstrapped ? "superadmin.google_bootstrap" : "superadmin.google_login",
      recurso: "superadmin",
      recursoId: result.id,
      detalle: { subRef: truncatedSub },
      ip: context.ip,
    })
  } else {
    await auditLog({
      userId: truncatedSub,
      userType: "superadmin_intento",
      accion:
        result.reason === "multiples_registros_incompatibles"
          ? "superadmin.anomalia_multiples_registros"
          : "superadmin.google_rechazado",
      recurso: "superadmin",
      recursoId: "",
      detalle: { reason: result.reason },
      ip: context.ip,
    })
  }

  return result
}

export async function auditSuperadminLogout(adminId: string, ip: string): Promise<void> {
  await auditLog({
    userId: adminId,
    userType: SUPERADMIN_USER_TYPE,
    accion: "superadmin.logout",
    recurso: "superadmin",
    recursoId: adminId,
    ip,
  })
}
