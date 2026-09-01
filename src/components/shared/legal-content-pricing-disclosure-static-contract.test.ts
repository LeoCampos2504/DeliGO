import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

// ============================================
// BUSINESS-TABLE-ORDER-PRICING-METRICS-LEGAL-DISCLOSURE-R1
// ============================================
// Static source-text contract. No literal "\n" anywhere in any pattern —
// the known CRLF-checkout artifact affecting other static-contract files
// in this repo comes exactly from that, so every assertion here uses
// plain substring/regex matching that is line-ending agnostic.

const LEGAL = readFileSync(join(process.cwd(), "src/components/shared/legal-content.tsx"), "utf8")
const REGISTRO = readFileSync(join(process.cwd(), "src/app/registro/negocio/page.tsx"), "utf8")

describe("Terms and Privacy remain two independently accessible documents", () => {
  test("TermsContent and PrivacyContent are separate exported functions, not one merged document", () => {
    expect(LEGAL).toContain("export function TermsContent()")
    expect(LEGAL).toContain("export function PrivacyContent()")
  })

  test("LegalDialog renders the correct document by type, with distinct titles", () => {
    expect(LEGAL).toContain('"Términos y Condiciones" : "Política de Privacidad"')
    expect(LEGAL).toContain("type === \"terms\" ? <TermsContent /> : <PrivacyContent />")
  })
})

describe("business onboarding links to both documents without a pre-checked box", () => {
  test("registration starts with terms unaccepted and requires explicit consent before submit", () => {
    expect(REGISTRO).toContain("useState(false)")
    expect(REGISTRO).toContain("const [termsAccepted, setTermsAccepted] = useState(false)")
    expect(REGISTRO).toContain("disabled={loading || !termsAccepted}")
  })

  test("the consent checkbox links independently to Terms and to Privacy", () => {
    expect(REGISTRO).toContain('setLegalDialog({ open: true, type: "terms" })')
    expect(REGISTRO).toContain('setLegalDialog({ open: true, type: "privacy" })')
    expect(REGISTRO).toContain("Términos y Condiciones")
    expect(REGISTRO).toContain("Política de Privacidad")
  })
})

describe("Privacy Policy discloses operational/usage data and the pricing-analytics purpose expressly", () => {
  test("operational and usage data is listed among the data collected", () => {
    expect(LEGAL).toContain("Datos operativos y de uso:")
    expect(LEGAL).toContain("mesa/salón")
  })

  test("pricing-analytics purpose is its own labeled point, not folded into generic 'mejorar experiencia'", () => {
    expect(LEGAL).toContain("Análisis de uso, estadísticas y tarifas futuras")
    expect(LEGAL).toContain("diseñar, simular o revisar")
    expect(LEGAL).toContain("estructura de tarifas y planes comerciales")
    // The generic "improve experience" purpose exists but is a different bullet than the pricing one.
    expect(LEGAL).toContain("Mejorar la experiencia de usuario y personalizar contenido.")
  })

  test("collecting/analyzing data is explicitly stated to never mean an automatic charge", () => {
    expect(LEGAL).toContain("no genera automáticamente un cargo o cobro")
  })

  test("aggregation/anonymization is stated as the preferred output for this analysis", () => {
    expect(LEGAL).toContain("estadísticas agregadas o anonimizadas")
  })

  test("retention section covers the new operational-analytics category without inventing a new fixed period for it", () => {
    expect(LEGAL).toContain("Conservación de datos")
    expect(LEGAL).toContain("forma agregada o anonimizada más allá de estos plazos")
  })
})

describe("Terms discloses the table-order feature without publishing the provisional tariff as active", () => {
  test("a dedicated Pedidos de Mesa / Salón section exists", () => {
    expect(LEGAL).toContain("Pedidos de Mesa / Salón")
    expect(LEGAL).toContain("gratuita, promocional, de")
  })

  test("the provisional simulation values are never printed as a live/contractual price in the public-facing legal copy", () => {
    expect(LEGAL).not.toContain("ARS 30")
    expect(LEGAL).not.toContain("ARS 20")
    expect(LEGAL).not.toContain("ARS 10")
    expect(LEGAL).not.toContain("25.000")
    expect(LEGAL).not.toContain("25000")
  })

  test("no retroactive charging is explicitly stated", () => {
    expect(LEGAL).toContain("no aplicará cargos retroactivos")
  })

  test("price must be disclosed before it takes effect, and future changes route through the existing 15-day modification notice", () => {
    expect(LEGAL).toContain("informada al negocio de forma clara antes de aplicarse")
    expect(LEGAL).toContain("sección")
    expect(LEGAL).toContain("Modificaciones")
    expect(LEGAL).toContain("al menos 15 días")
  })
})

describe("no invented legal identity", () => {
  test("no company legal name, CUIT, or specific street address appears anywhere in the legal content", () => {
    expect(LEGAL).not.toMatch(/CUIT/i)
    expect(LEGAL).not.toMatch(/raz[oó]n social/i)
    expect(LEGAL).not.toMatch(/S\.A\.|S\.R\.L\.|SAS\b/)
  })

  test("the only contact address used across the legal documents is the real existing one", () => {
    expect(LEGAL).toContain("soporte@deligo.app")
  })
})
