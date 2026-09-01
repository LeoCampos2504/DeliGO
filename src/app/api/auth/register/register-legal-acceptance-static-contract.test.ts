import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const REGISTER = readFileSync(join(process.cwd(), "src/app/api/auth/register/route.ts"), "utf8")
const OAUTH_CALLBACK = readFileSync(join(process.cwd(), "src/app/api/auth/google/callback/route.ts"), "utf8")
const VERSIONS = readFileSync(join(process.cwd(), "src/lib/legal-versions.ts"), "utf8")

describe("LEGAL-TERMS-ACCEPTANCE-VERSIONING-R1 — static contracts", () => {
  test("account creation and its LegalAcceptance record are wrapped in one transaction for all three account types", () => {
    expect(REGISTER).toContain("await db.$transaction(async (tx) => {")
    expect(REGISTER).toContain("tx.cliente.create(")
    expect(REGISTER).toContain("tx.negocio.create(")
    expect(REGISTER).toContain("tx.repartidor.create(")
    expect(REGISTER).toContain("tx.legalAcceptance.create(")
  })

  test("terms/privacy versions come from the server constant, never from the request body", () => {
    expect(REGISTER).toContain('import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"')
    expect(REGISTER).toContain("termsVersion: CURRENT_TERMS_VERSION")
    expect(REGISTER).toContain("privacyVersion: CURRENT_PRIVACY_VERSION")
    // The route never destructures a client-sent version field at all.
    expect(REGISTER).not.toContain("data.termsVersion")
    expect(REGISTER).not.toContain("body.termsVersion")
  })

  test("acceptedAt is never taken from the request — the model's own server-side default is the only source", () => {
    expect(REGISTER).not.toContain("acceptedAt:")
    expect(VERSIONS).toContain('export const CURRENT_TERMS_VERSION = "2026-09"')
    expect(VERSIONS).toContain('export const CURRENT_PRIVACY_VERSION = "2026-09"')
  })

  test("userId for the acceptance record always comes from the just-created account, never the request body", () => {
    expect(REGISTER).toContain("userId: created.id")
    expect(REGISTER).not.toContain("data.userId")
  })

  test("the still-open Google OAuth acceptance gap is acknowledged in source, not silently hidden", () => {
    expect(OAUTH_CALLBACK).toContain("KNOWN GAP (LEGAL-TERMS-ACCEPTANCE-VERSIONING-R1)")
    expect(OAUTH_CALLBACK).toContain("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1")
  })
})
