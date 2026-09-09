/// <reference types="bun-types" />

// ============================================
// P2-T22B-R2 — Cliente headers safe-area hardening
// ============================================
// Prerequisite for flipping appleWebApp.statusBarStyle to
// "black-translucent" for the "cliente" PWA role only (src/lib/pwa-identity.ts).
// T22B-R1 found 5 top-anchored Cliente screens with zero safe-area-top
// protection. Auditing the actual render tree (not just the 5 already-known
// files) turned up TWO independent sets of top-anchored headers per screen:
// the real header (client-*-panel.tsx) AND a separate loading-skeleton
// header with its own hardcoded top padding — both `src/app/cliente/page.tsx`
// (used as each dynamic import's `loading:` fallback) and each panel file's
// own internal skeleton (shown while data is still fetching after the panel
// chunk has loaded). Both paint at document top before any data arrives, so
// both needed the same treatment; this file protects all of them.
//
// Same calc(env(safe-area-inset-top,0px)+Xrem) idiom T22A established for
// the hero controls (src/app/n/[slug]/hero-safe-area-static-contract.test.ts),
// always with an explicit 0px fallback so Android/desktop (no notch, inset
// always 0) render byte-for-byte the same spacing as before this task.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function read(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8")
}

const CLIENTE_HOME = read("src", "app", "cliente", "page.tsx")
const FAVORITES_PANEL = read("src", "components", "client", "client-favorites-panel.tsx")
const ORDERS_PANEL = read("src", "components", "client", "client-orders-panel.tsx")
const PROMOS_PANEL = read("src", "components", "client", "client-promos-panel.tsx")
const PROFILE_PANEL = read("src", "components", "client", "client-profile-panel.tsx")

function calcUsages(source: string): string[] {
  return source.match(/calc\(env\(safe-area-inset-top[^)]*\)[^)]*\)/g) ?? []
}

describe("Cliente Home (src/app/cliente/page.tsx) — every top-anchored header is safe-area-aware", () => {
  test("the 3 real sticky headers (Suspense fallback, !hydrated skeleton, main content) use +0.75rem", () => {
    const usages = CLIENTE_HOME.match(/px-4 pt-\[calc\(env\(safe-area-inset-top,0px\)\+0\.75rem\)\] pb-3/g) ?? []
    expect(usages.length).toBe(3)
  })

  test("the 4 dynamic-import loading skeletons (Profile/Favorites/Promos/Orders) declared in this file are also hardened", () => {
    expect(CLIENTE_HOME).toContain('bg-primary/20 px-4 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-16')
    expect(CLIENTE_HOME).toContain('bg-rose-500/10 px-4 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-8')
    expect(CLIENTE_HOME).toContain('bg-primary/20 px-4 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-8')
    expect(CLIENTE_HOME).toContain('bg-primary/20 px-4 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-8')
  })

  test("exactly 7 safe-area calc() usages total (3 real headers + 4 loading skeletons) — no unaccounted-for 8th header slipped through", () => {
    expect(calcUsages(CLIENTE_HOME).length).toBe(7)
  })

  test("the flat py-3 header padding this replaced is gone", () => {
    expect(CLIENTE_HOME).not.toMatch(/className="max-w-4xl mx-auto px-4 py-3"/)
  })

  test("every sticky header background still reaches the true top edge — only inner content padding changed, not the header's own positioning", () => {
    const headerMatches = CLIENTE_HOME.match(
      /className="sticky top-0 z-40 bg-background\/95 backdrop-blur-md border-b border-border\/50"/g
    ) ?? []
    expect(headerMatches.length).toBe(3)
  })
})

describe("Favoritos (client-favorites-panel.tsx) — sticky header safe-area-aware", () => {
  test("the header's top padding is safe-area-aware", () => {
    const usages = calcUsages(FAVORITES_PANEL)
    expect(usages.length).toBe(1)
    expect(usages[0]).toContain(",0px)")
    expect(usages[0]).toContain("+1rem")
  })

  test("the flat py-4 padding this replaced is gone, and the header background is still sticky top-0", () => {
    expect(FAVORITES_PANEL).not.toMatch(/className="max-w-2xl mx-auto px-4 py-4"/)
    expect(FAVORITES_PANEL).toContain(
      'className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50"'
    )
  })

  // FavoritesSkeleton (this file's internal loading state) renders inside the
  // already-hardened sticky header, not as a standalone top-of-document
  // block — confirmed by reading the component's control flow — so it does
  // not need its own calc() usage. This test pins that assumption so a
  // future refactor that changes FavoritesSkeleton into a standalone screen
  // fails loudly here instead of silently reopening the gap.
  test("FavoritesSkeleton itself carries no top padding of its own (it renders below the real sticky header, never standalone)", () => {
    expect(FAVORITES_PANEL).not.toMatch(/function FavoritesSkeleton[\s\S]{0,400}pt-\[calc/)
  })
})

describe("Pedidos (client-orders-panel.tsx) — both the real header and its own loading skeleton are safe-area-aware", () => {
  test("OrdersHeader's top padding is safe-area-aware", () => {
    expect(ORDERS_PANEL).toContain(
      'bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-4 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-8 overflow-hidden'
    )
  })

  test("OrdersSkeleton's own top padding is safe-area-aware too", () => {
    expect(ORDERS_PANEL).toContain('bg-primary/20 px-4 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-8')
  })

  test("exactly 2 calc() usages (header + skeleton); the flat pt-12 this replaced is gone", () => {
    expect(calcUsages(ORDERS_PANEL).length).toBe(2)
    expect(ORDERS_PANEL).not.toMatch(/px-4 pt-12 pb-8/)
  })
})

describe("Promos (client-promos-panel.tsx) — both the real header and its own loading skeleton are safe-area-aware", () => {
  test("the promos header's top padding is safe-area-aware", () => {
    expect(PROMOS_PANEL).toContain(
      'bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-4 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-8 overflow-hidden'
    )
  })

  test("PromosSkeleton's own top padding is safe-area-aware too", () => {
    expect(PROMOS_PANEL).toContain('bg-primary/20 px-4 pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] pb-8')
  })

  test("exactly 2 calc() usages (header + skeleton); the flat pt-10 this replaced is gone", () => {
    expect(calcUsages(PROMOS_PANEL).length).toBe(2)
    expect(PROMOS_PANEL).not.toMatch(/px-4 pt-10 pb-8/)
  })
})

describe("Perfil (client-profile-panel.tsx) — both ProfileHeader and its own loading skeleton are safe-area-aware", () => {
  test("ProfileHeader's top padding is safe-area-aware", () => {
    expect(PROFILE_PANEL).toContain(
      'bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-4 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-16 overflow-hidden'
    )
  })

  test("ProfileSkeleton's own top padding is safe-area-aware too", () => {
    expect(PROFILE_PANEL).toContain('bg-primary/20 px-4 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-16')
  })

  test("exactly 2 calc() usages (header + skeleton); the flat pt-12 this replaced is gone", () => {
    expect(calcUsages(PROFILE_PANEL).length).toBe(2)
    expect(PROFILE_PANEL).not.toMatch(/px-4 pt-12 pb-16/)
  })
})

describe("Cross-cutting: every calc() usage across the 5 hardened files always carries the 0px fallback", () => {
  test("no safe-area-inset-top usage anywhere in these 5 files omits the explicit 0px fallback", () => {
    for (const source of [CLIENTE_HOME, FAVORITES_PANEL, ORDERS_PANEL, PROMOS_PANEL, PROFILE_PANEL]) {
      for (const usage of calcUsages(source)) {
        expect(usage).toContain(",0px)")
      }
    }
  })
})
