// ============================================
// DeliGO — Identidad Superadmin Google-only (24-A)
// ============================================
// Función de dominio pura (sin red, sin DB) que decide qué hacer con una
// identidad de Google ya verificada por el llamador (issuer/audience/
// expiración/firma ya validados en src/lib/superadmin-google-oauth.ts).
// Recibe únicamente claims verificados y un snapshot de las filas actuales
// de SuperAdmin — nunca consulta la base ni Google por sí misma, lo que la
// hace 100% testeable sin mocks de red ni de Prisma.
//
// La autoridad de identidad es SIEMPRE el claim `sub` de Google una vez que
// una fila quedó vinculada. El email solo tiene poder de decisión durante el
// bootstrap de una base sin ninguna identidad vinculada todavía — nunca
// después, y nunca si ya existe una fila vinculada a OTRO sub.

export interface SuperadminGoogleClaims {
  sub: string | null | undefined
  email: string | null | undefined
  emailVerified: boolean
}

export interface SuperadminIdentityConfig {
  /** SUPERADMIN_GOOGLE_SUB, ya recortado, o null si no está configurado. */
  pinnedSub: string | null
  /** true únicamente si SUPERADMIN_BOOTSTRAP_ENABLED === "true" (exacto). */
  bootstrapEnabled: boolean
  /** SUPERADMIN_GOOGLE_EMAIL ya normalizado, o null si no está configurado. */
  bootstrapEmail: string | null
}

export interface SuperadminRowSnapshot {
  id: string
  googleSub: string | null
  activo: boolean
}

export type SuperadminIdentityRejectReason =
  | "sub_ausente"
  | "email_no_verificado"
  | "sub_no_coincide"
  | "bootstrap_deshabilitado"
  | "bootstrap_email_no_coincide"
  | "bootstrap_config_incompleta"
  | "ya_vinculado_a_otro_sub"
  | "superadmin_inactivo"
  | "multiples_registros_incompatibles"

export type SuperadminIdentityDecision =
  | { action: "authenticate"; id: string }
  | { action: "create"; googleSub: string; email: string | null }
  | { action: "link"; id: string; googleSub: string; email: string | null }
  | { action: "reject"; reason: SuperadminIdentityRejectReason }

/** trim + lowercase; nunca elimina contenido válido, solo normaliza forma. */
export function normalizeSuperadminEmail(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

/**
 * Decide si esta identidad de Google puede autenticar, vincular (bootstrap
 * sobre una fila legacy sin sub) o crear el primer SuperAdmin — o si debe
 * rechazarse. Fail-closed en cualquier ambigüedad: nunca elige una fila
 * arbitrariamente entre varias candidatas.
 */
export function resolverIdentidadSuperadminGoogle(
  claims: SuperadminGoogleClaims,
  config: SuperadminIdentityConfig,
  existingRows: SuperadminRowSnapshot[]
): SuperadminIdentityDecision {
  const sub = claims.sub?.trim()
  if (!sub) {
    return { action: "reject", reason: "sub_ausente" }
  }

  const normalizedEmail = normalizeSuperadminEmail(claims.email)
  const vinculados = existingRows.filter((row) => row.googleSub !== null)
  const sinVincular = existingRows.filter((row) => row.googleSub === null)

  // ---------------------------------------------------------------------
  // Modo pin: SUPERADMIN_GOOGLE_SUB configurado tiene prioridad absoluta y
  // exclusiva. Ninguna otra cuenta puede ingresar, y el email nunca puede
  // sustituir esta comprobación.
  // ---------------------------------------------------------------------
  if (config.pinnedSub) {
    if (sub !== config.pinnedSub) {
      return { action: "reject", reason: "sub_no_coincide" }
    }

    const existente = vinculados.find((row) => row.googleSub === sub)
    if (existente) {
      if (!existente.activo) return { action: "reject", reason: "superadmin_inactivo" }
      return { action: "authenticate", id: existente.id }
    }

    // El sub coincide con el pin pero no hay fila para él todavía: solo se
    // permite crear/vincular si no hay NINGUNA otra identidad ya vinculada
    // (nunca se elige arbitrariamente entre varias).
    if (vinculados.length > 0) {
      return { action: "reject", reason: "ya_vinculado_a_otro_sub" }
    }
    if (sinVincular.length === 0) {
      return { action: "create", googleSub: sub, email: normalizedEmail }
    }
    if (sinVincular.length === 1) {
      return { action: "link", id: sinVincular[0].id, googleSub: sub, email: normalizedEmail }
    }
    return { action: "reject", reason: "multiples_registros_incompatibles" }
  }

  // ---------------------------------------------------------------------
  // Modo normal sin pin.
  // ---------------------------------------------------------------------

  // Un sub ya vinculado a ESTA identidad es autosuficiente — el email nunca
  // se vuelve a consultar una vez vinculado.
  const existente = vinculados.find((row) => row.googleSub === sub)
  if (existente) {
    if (!existente.activo) return { action: "reject", reason: "superadmin_inactivo" }
    return { action: "authenticate", id: existente.id }
  }

  // Ya existe una identidad vinculada y no es esta: rechazo, aunque el email
  // coincida con la de bootstrap. Nunca se transfiere la autoridad.
  if (vinculados.length > 0) {
    return { action: "reject", reason: "ya_vinculado_a_otro_sub" }
  }

  // Bootstrap por email — únicamente si TODAS las condiciones se cumplen.
  if (!config.bootstrapEnabled) {
    return { action: "reject", reason: "bootstrap_deshabilitado" }
  }
  if (!config.bootstrapEmail) {
    return { action: "reject", reason: "bootstrap_config_incompleta" }
  }
  if (!claims.emailVerified) {
    return { action: "reject", reason: "email_no_verificado" }
  }
  if (!normalizedEmail || normalizedEmail !== config.bootstrapEmail) {
    return { action: "reject", reason: "bootstrap_email_no_coincide" }
  }

  if (sinVincular.length === 0) {
    return { action: "create", googleSub: sub, email: normalizedEmail }
  }
  if (sinVincular.length === 1) {
    return { action: "link", id: sinVincular[0].id, googleSub: sub, email: normalizedEmail }
  }
  // Más de un registro legacy sin sub: nunca elegir uno arbitrariamente.
  return { action: "reject", reason: "multiples_registros_incompatibles" }
}

/** Lee y normaliza la configuración de identidad Superadmin desde el entorno. */
export function readSuperadminIdentityConfigFromEnv(): SuperadminIdentityConfig {
  const pinnedSubRaw = process.env.SUPERADMIN_GOOGLE_SUB?.trim()
  return {
    pinnedSub: pinnedSubRaw ? pinnedSubRaw : null,
    // Solo el texto exacto "true" habilita el bootstrap — cualquier otro
    // valor ("TRUE", "1", "yes", vacío, no seteado) lo deja deshabilitado.
    bootstrapEnabled: process.env.SUPERADMIN_BOOTSTRAP_ENABLED === "true",
    bootstrapEmail: normalizeSuperadminEmail(process.env.SUPERADMIN_GOOGLE_EMAIL),
  }
}
