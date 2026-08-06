/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests: identidad Superadmin Google-only (24-A)
// ============================================
// Puros: sin red, sin DB, sin mocks de Prisma. Cubren la sección 21 del
// prompt 24-A (16 casos mínimos) sobre resolverIdentidadSuperadminGoogle y
// la lectura/normalización de configuración desde variables de entorno.

import { describe, test, expect } from "bun:test"
import {
  resolverIdentidadSuperadminGoogle,
  normalizeSuperadminEmail,
  readSuperadminIdentityConfigFromEnv,
  type SuperadminIdentityConfig,
  type SuperadminRowSnapshot,
} from "./superadmin-identity"

const noPin: SuperadminIdentityConfig = { pinnedSub: null, bootstrapEnabled: true, bootstrapEmail: "admin@example.com" }
const noRows: SuperadminRowSnapshot[] = []

function claims(overrides: Partial<{ sub: string | null; email: string | null; emailVerified: boolean }> = {}) {
  return { sub: "sub-123", email: "admin@example.com", emailVerified: true, ...overrides }
}

describe("24-A — resolverIdentidadSuperadminGoogle", () => {
  test("1. claims sin sub -> rechazo", () => {
    const r = resolverIdentidadSuperadminGoogle(claims({ sub: null }), noPin, noRows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("sub_ausente")
  })

  test("1b. sub vacío tras trim -> rechazo (mismo tratamiento que ausente)", () => {
    const r = resolverIdentidadSuperadminGoogle(claims({ sub: "   " }), noPin, noRows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("sub_ausente")
  })

  test("2. email no verificado -> rechazo (bootstrap por email)", () => {
    const r = resolverIdentidadSuperadminGoogle(claims({ emailVerified: false }), noPin, noRows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("email_no_verificado")
  })

  test("3. sub configurado (pin) coincide -> éxito (autentica fila ya vinculada)", () => {
    const pin: SuperadminIdentityConfig = { pinnedSub: "sub-123", bootstrapEnabled: false, bootstrapEmail: null }
    const rows: SuperadminRowSnapshot[] = [{ id: "admin-1", googleSub: "sub-123", activo: true }]
    const r = resolverIdentidadSuperadminGoogle(claims(), pin, rows)
    expect(r.action).toBe("authenticate")
    if (r.action === "authenticate") expect(r.id).toBe("admin-1")
  })

  test("3b. sub configurado (pin) coincide + base vacía -> crea (bootstrap por pin, sin exigir flag/email)", () => {
    const pin: SuperadminIdentityConfig = { pinnedSub: "sub-123", bootstrapEnabled: false, bootstrapEmail: null }
    const r = resolverIdentidadSuperadminGoogle(claims({ emailVerified: false, email: null }), pin, noRows)
    expect(r.action).toBe("create")
    if (r.action === "create") expect(r.googleSub).toBe("sub-123")
  })

  test("4. sub configurado (pin) no coincide -> rechazo", () => {
    const pin: SuperadminIdentityConfig = { pinnedSub: "otro-sub", bootstrapEnabled: false, bootstrapEmail: null }
    const r = resolverIdentidadSuperadminGoogle(claims(), pin, noRows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("sub_no_coincide")
  })

  test("5. bootstrap deshabilitado -> rechazo", () => {
    const cfg: SuperadminIdentityConfig = { ...noPin, bootstrapEnabled: false }
    const r = resolverIdentidadSuperadminGoogle(claims(), cfg, noRows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("bootstrap_deshabilitado")
  })

  test("6. bootstrap habilitado pero email distinto -> rechazo", () => {
    const r = resolverIdentidadSuperadminGoogle(claims({ email: "otro@example.com" }), noPin, noRows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("bootstrap_email_no_coincide")
  })

  test("7. bootstrap habilitado y email correcto + base vacía -> crea", () => {
    const r = resolverIdentidadSuperadminGoogle(claims(), noPin, noRows)
    expect(r.action).toBe("create")
    if (r.action === "create") {
      expect(r.googleSub).toBe("sub-123")
      expect(r.email).toBe("admin@example.com")
    }
  })

  test("7b. bootstrap habilitado y email correcto + exactamente un legacy sin sub -> vincula esa fila", () => {
    const rows: SuperadminRowSnapshot[] = [{ id: "legacy-1", googleSub: null, activo: true }]
    const r = resolverIdentidadSuperadminGoogle(claims(), noPin, rows)
    expect(r.action).toBe("link")
    if (r.action === "link") expect(r.id).toBe("legacy-1")
  })

  test("8. registro vinculado y mismo sub -> éxito", () => {
    const rows: SuperadminRowSnapshot[] = [{ id: "admin-1", googleSub: "sub-123", activo: true }]
    const r = resolverIdentidadSuperadminGoogle(claims(), noPin, rows)
    expect(r.action).toBe("authenticate")
    if (r.action === "authenticate") expect(r.id).toBe("admin-1")
  })

  test("9. registro vinculado y distinto sub -> rechazo", () => {
    const rows: SuperadminRowSnapshot[] = [{ id: "admin-1", googleSub: "otro-sub", activo: true }]
    const r = resolverIdentidadSuperadminGoogle(claims(), noPin, rows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("ya_vinculado_a_otro_sub")
  })

  test("10. mismo email con distinto sub -> rechazo (el email nunca reemplaza al sub)", () => {
    const rows: SuperadminRowSnapshot[] = [{ id: "admin-1", googleSub: "otro-sub", activo: true }]
    const r = resolverIdentidadSuperadminGoogle(claims({ email: "admin@example.com" }), noPin, rows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("ya_vinculado_a_otro_sub")
  })

  test("11. configuración incompleta (bootstrap habilitado sin email configurado) -> fail closed", () => {
    const cfg: SuperadminIdentityConfig = { pinnedSub: null, bootstrapEnabled: true, bootstrapEmail: null }
    const r = resolverIdentidadSuperadminGoogle(claims(), cfg, noRows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("bootstrap_config_incompleta")
  })

  test("12. múltiples registros incompatibles (más de un legacy sin sub) -> fail closed, nunca elige uno", () => {
    const rows: SuperadminRowSnapshot[] = [
      { id: "legacy-1", googleSub: null, activo: true },
      { id: "legacy-2", googleSub: null, activo: true },
    ]
    const r = resolverIdentidadSuperadminGoogle(claims(), noPin, rows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("multiples_registros_incompatibles")
  })

  test("12b. múltiples registros incompatibles también fail-closed en modo pin", () => {
    const pin: SuperadminIdentityConfig = { pinnedSub: "sub-123", bootstrapEnabled: false, bootstrapEmail: null }
    const rows: SuperadminRowSnapshot[] = [
      { id: "legacy-1", googleSub: null, activo: true },
      { id: "legacy-2", googleSub: null, activo: true },
    ]
    const r = resolverIdentidadSuperadminGoogle(claims(), pin, rows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("multiples_registros_incompatibles")
  })

  test("15. email se normaliza de forma segura (trim + lowercase)", () => {
    expect(normalizeSuperadminEmail("  Admin@Example.COM  ")).toBe("admin@example.com")
    expect(normalizeSuperadminEmail(null)).toBeNull()
    expect(normalizeSuperadminEmail(undefined)).toBeNull()
    expect(normalizeSuperadminEmail("   ")).toBeNull()

    const r = resolverIdentidadSuperadminGoogle(
      claims({ email: "  Admin@Example.COM  " }),
      noPin,
      noRows
    )
    expect(r.action).toBe("create")
    if (r.action === "create") expect(r.email).toBe("admin@example.com")
  })

  test("16. nunca se sobrescribe un googleSub existente: 'link' solo apunta a filas sin sub", () => {
    // Una fila ya vinculada a OTRO sub + una fila legacy sin sub: el bootstrap
    // no "ayuda" vinculando la legacy — se detiene por completo (fail closed)
    // en cuanto hay una identidad activa incompatible, sin importar que haya
    // una fila candidata disponible.
    const rows: SuperadminRowSnapshot[] = [
      { id: "admin-vinculado", googleSub: "otro-sub", activo: true },
      { id: "legacy-1", googleSub: null, activo: true },
    ]
    const r = resolverIdentidadSuperadminGoogle(claims(), noPin, rows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("ya_vinculado_a_otro_sub")
  })

  test("registro vinculado pero inactivo -> rechazo (superadmin_inactivo)", () => {
    const rows: SuperadminRowSnapshot[] = [{ id: "admin-1", googleSub: "sub-123", activo: false }]
    const r = resolverIdentidadSuperadminGoogle(claims(), noPin, rows)
    expect(r.action).toBe("reject")
    if (r.action === "reject") expect(r.reason).toBe("superadmin_inactivo")
  })
})

describe("24-A — readSuperadminIdentityConfigFromEnv", () => {
  const ORIGINAL = {
    sub: process.env.SUPERADMIN_GOOGLE_SUB,
    enabled: process.env.SUPERADMIN_BOOTSTRAP_ENABLED,
    email: process.env.SUPERADMIN_GOOGLE_EMAIL,
  }

  function restoreEnv() {
    for (const [key, value] of Object.entries({
      SUPERADMIN_GOOGLE_SUB: ORIGINAL.sub,
      SUPERADMIN_BOOTSTRAP_ENABLED: ORIGINAL.enabled,
      SUPERADMIN_GOOGLE_EMAIL: ORIGINAL.email,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }

  test('13. SUPERADMIN_BOOTSTRAP_ENABLED="TRUE" (mayúsculas) -> deshabilitado', () => {
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "TRUE"
    try {
      expect(readSuperadminIdentityConfigFromEnv().bootstrapEnabled).toBe(false)
    } finally {
      restoreEnv()
    }
  })

  test('14. solo el valor exacto "true" habilita bootstrap', () => {
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    try {
      expect(readSuperadminIdentityConfigFromEnv().bootstrapEnabled).toBe(true)
    } finally {
      restoreEnv()
    }

    for (const value of ["1", "yes", "True", " true", "true ", ""]) {
      process.env.SUPERADMIN_BOOTSTRAP_ENABLED = value
      try {
        expect(readSuperadminIdentityConfigFromEnv().bootstrapEnabled).toBe(false)
      } finally {
        restoreEnv()
      }
    }
  })

  test("SUPERADMIN_BOOTSTRAP_ENABLED no seteado -> deshabilitado", () => {
    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    expect(readSuperadminIdentityConfigFromEnv().bootstrapEnabled).toBe(false)
    restoreEnv()
  })

  test("SUPERADMIN_GOOGLE_SUB vacío/whitespace -> pinnedSub null (no configurado)", () => {
    process.env.SUPERADMIN_GOOGLE_SUB = "   "
    try {
      expect(readSuperadminIdentityConfigFromEnv().pinnedSub).toBeNull()
    } finally {
      restoreEnv()
    }
  })

  test("SUPERADMIN_GOOGLE_EMAIL se normaliza al leerse del entorno", () => {
    process.env.SUPERADMIN_GOOGLE_EMAIL = "  Owner@Example.COM "
    try {
      expect(readSuperadminIdentityConfigFromEnv().bootstrapEmail).toBe("owner@example.com")
    } finally {
      restoreEnv()
    }
  })
})
