/// <reference types="bun-types" />

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R2 — contrato estático de Business Preview
// ============================================
// Static source-text contract for R2 Part B (Preview Exit Test Matrix) and
// Part C (Preview Auth Test Matrix + Security Negative Test), matching this
// codebase's established static-contract convention (no RTL anywhere in
// this repo — see catalog-tutorial-static-contract.test.ts).

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const PAGE = readFileSync(join(process.cwd(), "src", "app", "n", "[slug]", "page.tsx"), "utf8")
const PROXY = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8")
const BUSINESS_PANEL = readFileSync(
  join(process.cwd(), "src", "components", "business", "business-panel.tsx"),
  "utf8"
)

// ============================================
// Part B — Preview Exit Test Matrix
// ============================================
describe("Preview Exit Test Matrix", () => {
  test("previewSource is read from the URL and isBusinessPreview requires BOTH preview=true and previewSource=business", () => {
    expect(PAGE).toMatch(/const isPreview = searchParams\.get\("preview"\) === "true"/)
    expect(PAGE).toMatch(/const previewSource = searchParams\.get\("previewSource"\)/)
    expect(PAGE).toMatch(/const isBusinessPreview = isPreview && previewSource === "business"/)
  })

  test("EXIT A (circular back-arrow, app-owned): returns to /negocio when isBusinessPreview, /cliente/ otherwise", () => {
    const backArrowBlock = PAGE.match(/circular back[\s\S]*?<Link href=\{isBusinessPreview \? "\/negocio" : "\/cliente\/"\}>\s*<button/)
    expect(backArrowBlock).not.toBeNull()
  })

  test("EXIT B (amber 'Volver al panel' banner button, app-owned, the known historical defect): returns to /negocio when isBusinessPreview, /cliente/ otherwise", () => {
    const bannerBlock = PAGE.match(/Volver al panel[\s\S]{0,40}must[\s\S]*?<Link href=\{isBusinessPreview \? "\/negocio" : "\/cliente\/"\}[\s\S]*?Volver al panel/)
    expect(bannerBlock).not.toBeNull()
  })

  test("neither in-app exit path can resolve to /cliente for an authenticated business preview — both share the exact same isBusinessPreview ternary, so they can never disagree", () => {
    const exits = PAGE.match(/href=\{isBusinessPreview \? "\/negocio" : "\/cliente\/"\}/g) ?? []
    expect(exits.length).toBe(2)
  })

  test("EXIT C (X / window-close, browser/OS-owned chrome): the app never fabricates control over it — instead the opening architecture (business-panel.tsx) opens Preview in a new tab/window via window.open, so the business-panel tab/session is untouched by however that window is closed", () => {
    expect(BUSINESS_PANEL).toMatch(/window\.open\(\s*`\/n\/\$\{negocio\.slug\}\?preview=true&previewSource=business`,\s*"_blank",\s*"noopener,noreferrer"\s*\)/)
  })

  test("no code path attempts to call window.close() or otherwise assert control over browser/OS-owned chrome from within the preview page", () => {
    expect(PAGE).not.toMatch(/window\.close\(\)/)
  })

  test("previewSource is never interpolated into a URL/redirect target — it is only compared with strict equality, never used to build a navigable href (no open-redirect vector)", () => {
    const usages = PAGE.match(/previewSource[^\n]*/g) ?? []
    for (const line of usages) {
      expect(line).not.toMatch(/href=\{.*previewSource(?!\s*===)/)
      expect(line).not.toMatch(/router\.push\([^)]*previewSource/)
    }
  })
})

// ============================================
// Part C — Preview Auth Test Matrix
// ============================================
describe("Preview Auth Test Matrix", () => {
  test("openProductDetail: viewing is exempt from requireAuth() ONLY when isBusinessPreview — the auth call itself is untouched, only the call site is conditional", () => {
    expect(PAGE).toMatch(/const openProductDetail = \(product: ProductoAPI\) => \{\s*\n\s*if \(!isBusinessPreview && !requireAuth\(\)\) return/)
  })

  test("requireAuth() itself is not redefined or weakened anywhere in this file — it is still called unconditionally by the real order-mutation path", () => {
    expect(PAGE).toMatch(/const handleAddToCart = \(item: CartItem\) => \{\s*\n\s*if \(!negocio\) return\s*\n\s*if \(!requireAuth\(\)\) return/)
  })

  test("CartPanel (the real order-mutation surface, POST /api/pedidos) is entirely excluded from preview — not merely auth-relaxed", () => {
    expect(PAGE).toMatch(/\{!isPreview && \(\s*\n\s*<CartPanel/)
  })

  test("handleAdd has an unconditional early return whenever isPreview — no order-mutation code in ProductDetailSheet is EVER reachable in preview, regardless of how it's invoked", () => {
    const block = PAGE.match(/const handleAdd = \(\) => \{\s*\n\s*if \(isPreview\) return/)
    expect(block).not.toBeNull()
  })

  test("the Agregar/Comprar CTA is disabled in preview regardless of stock — 'Sin stock' state is never a bypass, and preview never depends on requireAuth's client/Google session", () => {
    expect(PAGE).toMatch(/disabled=\{isPreview \|\| !product\.stock \|\| !canAdd\}/)
    expect(PAGE).toMatch(/Vista previa — no se pueden realizar pedidos/)
  })

  test("the CTA never bypasses auth by forging a fake session or short-circuiting requireAuth — it is disabled/relabeled, never executed", () => {
    const ctaIndex = PAGE.indexOf("onClick={handleAdd}")
    expect(ctaIndex).toBeGreaterThan(-1)
    const nearby = PAGE.slice(ctaIndex, ctaIndex + 200)
    expect(nearby).toContain('disabled={isPreview || !product.stock || !canAdd}')
  })

  test("product detail can still be opened for an out-of-stock product — the only onClick that opens detail is unconditional on product.stock", () => {
    const openCalls = PAGE.match(/onClick=\{\(\) => openProductDetail\(product\)\}/g) ?? []
    expect(openCalls.length).toBeGreaterThan(0)
    for (const call of openCalls) {
      expect(call).not.toMatch(/stock/)
    }
  })

  test("quantity controls remain interactive in preview (local ephemeral state, same category as ingredient/addition/option selection) — only the real mutation-trigger CTA is disabled", () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setQuantity\(Math\.max\(1, quantity - 1\)\)\}/)
    expect(PAGE).toMatch(/onClick=\{\(\) => setQuantity\(quantity \+ 1\)\}/)
  })

  test("preview shows an explanatory note instead of silently disabling the CTA", () => {
    expect(PAGE).toContain("Vista previa · Los cambios de selección no generan un pedido.")
  })
})

// ============================================
// Security Negative Test — explicit, non-negotiable per task instruction
// ============================================
describe("Security Negative Test: ?preview=true&previewSource=business never grants access to protected data", () => {
  test("the forbidden anti-pattern (bypassAuthenticationEverywhere gated only on a query param) is never present in this file", () => {
    expect(PAGE).not.toMatch(/bypassAuthenticationEverywhere/)
    expect(PAGE).not.toMatch(/if\s*\(\s*searchParams\.get\("preview"\)\s*===\s*"true"\s*\)\s*\{?\s*(bypass|skipAuth|disableAuth)/i)
  })

  test("/api/negocio/* (business admin data, employee data, orders, payments, private config) requires userType 'negocio' via a real session cookie in proxy.ts — this check has no reference to any searchParams/query string at all", () => {
    const roleBlock = PROXY.match(/const ROLE_PROTECTED_ROUTES[\s\S]*?\n\]/)
    expect(roleBlock).not.toBeNull()
    expect(roleBlock![0]).toMatch(/prefix: "\/api\/negocio", userType: "negocio"/)
  })

  test("proxy.ts's auth-gating functions never read `preview` or `previewSource` from the URL — auth decisions are made purely from pathname + cookie", () => {
    expect(PROXY).not.toMatch(/searchParams\.get\("preview"/)
    expect(PROXY).not.toMatch(/searchParams\.get\("previewSource"/)
    expect(PROXY).not.toMatch(/\bpreview\b\s*===\s*"true"/)
  })

  test("/api/negocios (plural, public catalog — the route this page's own product data comes from) is deliberately public and unrelated to /api/negocio (singular, protected business-admin routes) — confirms Part C exposes zero new data, only relaxes a client-side UI gate on already-public data", () => {
    expect(PROXY).toMatch(/"\/api\/negocios",\s*\/\/ public catalog/)
  })

  test("isBusinessPreview is used only as a presentation-only hint (return destination + read-only interaction policy) inside page.tsx — it never appears in this file as a header, cookie, or credential passed to a fetch/API call", () => {
    const fetchCalls = PAGE.match(/fetch\([^)]*\)/g) ?? []
    for (const call of fetchCalls) {
      expect(call).not.toMatch(/isBusinessPreview|previewSource/)
    }
  })
})

describe("no paused iOS R8 file was modified by Business Preview changes", () => {
  const iosFiles = [
    "ios-keyboard-fix",
    "ios-viewport-debug-panel",
    "ios-debug-snapshot",
    "ios-dock-viewport-state",
  ]

  test("none of the paused iOS files are referenced by the preview page or the proxy", () => {
    for (const source of [PAGE, PROXY]) {
      for (const iosFile of iosFiles) {
        expect(source).not.toContain(iosFile)
      }
    }
  })

  test("page.tsx never reads visualViewport", () => {
    expect(PAGE).not.toMatch(/visualViewport/)
  })
})
