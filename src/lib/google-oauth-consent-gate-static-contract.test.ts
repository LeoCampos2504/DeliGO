import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const CALLBACK = readFileSync(
  join(process.cwd(), "src/app/api/auth/google/callback/route.ts"),
  "utf8"
)
const CONSENT = readFileSync(
  join(process.cwd(), "src/app/api/auth/google/consent/route.ts"),
  "utf8"
)
const PENDING = readFileSync(join(process.cwd(), "src/lib/google-oauth-pending.ts"), "utf8")

describe("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — static contracts", () => {
  test("no account is created directly in the callback for a brand-new Google identity — it always redirects to the consent gate first", () => {
    // The only db.cliente.create/db.repartidor.create calls left in the
    // codebase for this flow live in the consent accept endpoint, never in
    // the callback.
    expect(CALLBACK).not.toContain("db.cliente.create(")
    expect(CALLBACK).not.toContain("db.repartidor.create(")
    expect(CALLBACK).toContain("redirectToConsentGate({")
  })

  test("an existing account with zero LegalAcceptance rows is also routed through the consent gate, not logged in directly", () => {
    expect(CALLBACK).toContain("legalAcceptance.findFirst(")
    expect(CALLBACK).toContain("existingAccountId: repartidor.id")
    expect(CALLBACK).toContain("existingAccountId: cliente.id")
  })

  test("identity travels only in the signed pending cookie — never in a query param or the consent redirect URL", () => {
    expect(CALLBACK).toContain('new URL("/auth/google/consentimiento", APP_URL)')
    expect(CALLBACK).not.toMatch(/consentimiento[^)]*searchParams\.set/)
    expect(CALLBACK).toContain("setGoogleOAuthPendingCookie(response, token)")
  })

  test("account type comes from the already-validated google_oauth_role cookie, never re-derived from client input at accept time", () => {
    // accountType is baked into the signed claims at mint time in the
    // callback (role is coerced via the existing ternary allowlist before
    // this point) — the accept endpoint only ever reads it back out of the
    // verified token, never from req.json()/searchParams.
    expect(CONSENT).not.toContain("body.accountType")
    expect(CONSENT).not.toContain("searchParams.get(\"accountType\")")
    expect(CONSENT).toContain("claims.accountType")
  })

  test("account creation and its LegalAcceptance record are wrapped in one transaction, for both account types", () => {
    expect(CONSENT).toContain("db.$transaction(async (tx) => {")
    expect(CONSENT).toContain("tx.repartidor.upsert(")
    expect(CONSENT).toContain("tx.cliente.upsert(")
    expect(CONSENT).toContain("tx.legalAcceptance.create(")
    expect(CONSENT).toContain("ensureLegalAcceptance(tx,")
  })

  test("legal versions and source come from the server constant, never from the pending token or request body", () => {
    expect(CONSENT).toContain('import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"')
    expect(CONSENT).toContain("termsVersion: CURRENT_TERMS_VERSION")
    expect(CONSENT).toContain("privacyVersion: CURRENT_PRIVACY_VERSION")
    expect(CONSENT).toContain('source: "google_oauth"')
    expect(CONSENT).not.toContain("claims.termsVersion")
    expect(CONSENT).not.toContain("body.termsVersion")
  })

  test("acceptedAt is never taken from the request or the pending token — only the model's own server-side default", () => {
    expect(CONSENT).not.toContain("acceptedAt:")
  })

  test("userId for both the account and the acceptance record always comes from the verified claims/DB, never the request body", () => {
    expect(CONSENT).not.toContain("body.userId")
    expect(CONSENT).not.toContain("body.existingAccountId")
  })

  test("explicit acceptance is required in the body, same contract as /api/auth/register", () => {
    expect(CONSENT).toContain('body.termsAccepted !== "true"')
  })

  test("cancel never creates an account — DELETE only clears the pending cookie", () => {
    const deleteBody = CONSENT.match(/export async function DELETE\(\)[\s\S]{0,200}/)?.[0] ?? ""
    expect(deleteBody).toContain("clearGoogleOAuthPendingCookie")
    expect(deleteBody).not.toMatch(/\.(create|upsert)\(/)
  })

  test("the pending token is signed HS256 with a dedicated secret, short TTL, and a discriminating kind claim", () => {
    expect(PENDING).toContain("GOOGLE_OAUTH_PENDING_SECRET")
    expect(PENDING).toContain('.setProtectedHeader({ alg: "HS256" })')
    expect(PENDING).toContain("GOOGLE_OAUTH_PENDING_TTL_SECONDS = 600")
    expect(PENDING).toContain('kind: PENDING_KIND')
  })

  test("no provider access/refresh token is ever embedded in the pending claims or persisted to LegalAcceptance", () => {
    expect(PENDING).not.toContain("access_token")
    expect(PENDING).not.toContain("refresh_token")
    expect(CONSENT).not.toContain("access_token")
  })

  test("the Google OAuth acceptance gap is closed — negocio creation via OAuth remains unsupported (unchanged)", () => {
    expect(CALLBACK).not.toContain("db.negocio.create(")
    expect(CALLBACK).not.toContain('"negocio"')
  })
})
