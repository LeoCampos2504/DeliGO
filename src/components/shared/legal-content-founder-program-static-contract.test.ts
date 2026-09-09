import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

// ============================================
// FOUNDER-BUSINESS-PROGRAM-LEGAL-SPEC-R1
// ============================================
// Static source-text contract. Every assertion string is verified to sit
// within a single source line (no literal "\n" and no phrase that happens
// to straddle the JSX text-wrapping line-break) — the known CRLF-checkout
// artifact in this repo, and a prior line-wrap mistake caught in the
// pricing-disclosure test file, both come from exactly that class of
// fragility.

const LEGAL = readFileSync(join(process.cwd(), "src/components/shared/legal-content.tsx"), "utf8")

describe("Terms discloses the Founder Business Program", () => {
  test("a dedicated section exists and states the limited/undefined founder count", () => {
    expect(LEGAL).toContain("6. Programa Negocios Fundadores")
    expect(LEGAL).toContain("podrá otorgar a una cantidad limitada de los primeros negocios elegibles")
    expect(LEGAL).toContain("todavía no está definida")
  })

  test("no concrete founder count is published anywhere in the legal copy", () => {
    expect(LEGAL).not.toMatch(/primeros\s+\d+\s+negocios/i)
    expect(LEGAL).not.toContain("primeros 5")
    expect(LEGAL).not.toContain("primeros 10")
    expect(LEGAL).not.toContain("primeros 20")
    expect(LEGAL).not.toContain("primeros 50")
  })

  test("the 100% permanent discount on DeliGO's own charges is stated", () => {
    expect(LEGAL).toContain("bonificación permanente del 100% sobre los cargos propios")
    expect(LEGAL).toContain("mientras mantenga válidamente esa condición")
  })

  test("DeliGO's own charges are distinguished from third-party charges, which are not automatically covered", () => {
    expect(LEGAL).toContain("no comprende automáticamente impuestos")
    expect(LEGAL).toContain("comisiones de medios de pago")
  })

  test("the benefit is scoped to the specific business, not the owner's other businesses, and is not transferable", () => {
    expect(LEGAL).toContain("no se extiende automáticamente a otras sucursales")
    expect(LEGAL).toContain("No puede venderse ni transferirse de forma independiente al negocio")
  })

  test("DeliGO may verify continuity/identity to prevent fraud", () => {
    expect(LEGAL).toContain("verificar la continuidad e identidad del establecimiento")
    expect(LEGAL).toContain("uso fraudulento")
  })

  test("the public badge is optional and opting out never affects the economic benefit", () => {
    expect(LEGAL).toContain("podrá elegir libremente si desea mostrar públicamente")
    expect(LEGAL).toContain("No mostrar ningún distintivo no afecta de ninguna manera la bonificación")
  })

  test("the badge is described as recognition only — never paid advertising, ranking priority, or a quality endorsement", () => {
    expect(LEGAL).toContain("reconocimiento de adhesión temprana")
    expect(LEGAL).toContain("publicidad paga, prioridad de posicionamiento ni una recomendación de calidad")
  })
})

describe("Privacy Policy covers optional public founder identification", () => {
  test("a business that opts in is shown as Negocio Fundador; opting out shows nothing", () => {
    expect(LEGAL).toContain("Si un negocio participa del Programa Negocios Fundadores")
    expect(LEGAL).toContain("DeliGO exhibirá el reconocimiento")
    expect(LEGAL).toContain("esa condición no se exhibe públicamente")
  })

  test("economic terms of the founder benefit are never made public", () => {
    expect(LEGAL).toContain("porcentaje de bonificación")
  })
})

describe("provisional table-order pricing values still never appear as active tariff", () => {
  test("30/20/10/25.000 remain absent from the public legal copy after this change too", () => {
    expect(LEGAL).not.toContain("ARS 30")
    expect(LEGAL).not.toContain("ARS 20")
    expect(LEGAL).not.toContain("ARS 10")
    expect(LEGAL).not.toContain("25.000")
    expect(LEGAL).not.toContain("25000")
  })
})

describe("documents remain separate and no legal identity was invented", () => {
  test("Terms and Privacy are still two independent functions", () => {
    expect(LEGAL).toContain("export function TermsContent()")
    expect(LEGAL).toContain("export function PrivacyContent()")
  })

  test("no company legal name, CUIT, or specific street address was added", () => {
    expect(LEGAL).not.toMatch(/CUIT/i)
    expect(LEGAL).not.toMatch(/raz[oó]n social/i)
    expect(LEGAL).not.toMatch(/S\.A\.|S\.R\.L\.|SAS\b/)
  })
})
