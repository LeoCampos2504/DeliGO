/// <reference types="bun-types" />

// ============================================
// OWN-PRODUCT-OPTION-PRICES-R1 — end-to-end wiring contract
// ============================================
// Static source-text contract proving the price-delta feature is wired
// consistently across every boundary (business editor, public catalog
// API, order-pricing API, public ProductDetail, Business Preview, cart)
// without duplicating the normalizer, and that the server never trusts a
// client-supplied price. Matches this codebase's established
// static-contract convention (no RTL anywhere in this repo).

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const PRODUCTS_TAB = readFileSync(
  join(process.cwd(), "src", "components", "business", "products-tab.tsx"),
  "utf8"
)
const PUBLIC_API = readFileSync(join(process.cwd(), "src", "app", "api", "negocios", "[slug]", "route.ts"), "utf8")
const PRODUCTOS_POST = readFileSync(
  join(process.cwd(), "src", "app", "api", "negocio", "productos", "route.ts"),
  "utf8"
)
const PRODUCTOS_PUT = readFileSync(
  join(process.cwd(), "src", "app", "api", "negocio", "productos", "[id]", "route.ts"),
  "utf8"
)
const PEDIDOS_API = readFileSync(join(process.cwd(), "src", "app", "api", "pedidos", "route.ts"), "utf8")
const PAGE = readFileSync(join(process.cwd(), "src", "app", "n", "[slug]", "page.tsx"), "utf8")
const CART_STORE = readFileSync(join(process.cwd(), "src", "store", "cart-store.ts"), "utf8")
const CART_PANEL = readFileSync(join(process.cwd(), "src", "components", "cart", "cart-panel.tsx"), "utf8")
const SHARED = readFileSync(join(process.cwd(), "src", "lib", "product-own-sections.ts"), "utf8")

// ============================================
// No duplicated normalizer across boundaries
// ============================================
describe("single shared normalizer — no boundary reimplements own-section option parsing", () => {
  test("every consumer imports from @/lib/product-own-sections rather than re-parsing the shape locally", () => {
    for (const [name, source] of [
      ["products-tab.tsx", PRODUCTS_TAB],
      ["negocios/[slug]/route.ts", PUBLIC_API],
      ["pedidos/route.ts", PEDIDOS_API],
      ["n/[slug]/page.tsx", PAGE],
    ] as const) {
      expect(source, name).toMatch(/from ["']@\/lib\/product-own-sections["']/)
    }
  })

  test("the public API's normalizeProductSections no longer filters out non-string options (the R1/R2-era bug that would have silently dropped every priced option)", () => {
    expect(PUBLIC_API).not.toMatch(/filter\(\(option\): option is string => typeof option === ["']string["']\)/)
    expect(PUBLIC_API).toMatch(/normalizeOwnSectionOptions\(section\.opciones\)/)
  })
})

// ============================================
// Editor: price input UI
// ============================================
describe("business editor: price input per own-section option (task §38)", () => {
  test("the editor's own-section options load through normalizeOwnSectionOptions (legacy strings upgrade to {nombre, precio: 0} automatically)", () => {
    expect(PRODUCTS_TAB).toMatch(/opciones: normalizeOwnSectionOptions\(s\?\.opciones\)/)
  })

  test("a numeric price input exists per option, with the 'Precio extra' label/title and the $0-blank helper copy", () => {
    expect(PRODUCTS_TAB).toContain('title="Precio extra"')
    expect(PRODUCTS_TAB).toContain("Dejalo en $0 si esta opción no cambia el precio.")
  })

  test("updateOptionPrice validates through validateOwnSectionOptionPrice before applying — a rejected (negative/NaN) value never mutates state", () => {
    const block = PRODUCTS_TAB.match(/const updateOptionPrice = [\s\S]*?\n  \}/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/validateOwnSectionOptionPrice/)
    expect(block![0]).toMatch(/if \(validated === null\) return/)
  })

  test("the price input has min={0} as a client-side nudge (defense in depth — the real enforcement is server-side)", () => {
    const inputBlock = PRODUCTS_TAB.match(/title="Precio extra"[\s\S]{0,200}/)
    expect(inputBlock).not.toBeNull()
  })
})

// ============================================
// Save-time API validation
// ============================================
describe("negocio/productos POST and PUT validate secciones prices before persisting (task §50)", () => {
  test("POST rejects a malformed secciones payload with 400 before ever calling db.producto.create", () => {
    expect(PRODUCTOS_POST).toMatch(/const validSecciones = validateProductSectionsForSave\(secciones\)/)
    expect(PRODUCTOS_POST).toMatch(/if \(!validSecciones\.ok\) \{\s*\n\s*return NextResponse\.json\(\{ error: validSecciones\.error \}, \{ status: 400 \}\)/)
    expect(PRODUCTOS_POST).toMatch(/secciones: JSON\.stringify\(validSecciones\.value\)/)
  })

  test("PUT validates secciones only when the field is actually present in the request (partial updates that don't touch secciones are unaffected)", () => {
    expect(PRODUCTOS_PUT).toMatch(/if \(secciones !== undefined\) \{\s*\n\s*validSecciones = validateProductSectionsForSave\(secciones\)/)
  })
})

// ============================================
// Server-authoritative pricing — the non-negotiable security core
// ============================================
describe("§48-51: server-authoritative pricing — CLIENT_SUPPLIED_OWN_OPTION_PRICE_TRUSTED=NO", () => {
  test("the order API's incoming item shape for secciones carries only option names/quantities — no price field is ever read from the client for it", () => {
    // IncomingPedidoItem.secciones is SectionSelection = string | Record<string, number>
    // — there's no field shape for a client to smuggle a price into.
    expect(PEDIDOS_API).toMatch(/type SectionSelection = string \| Record<string, number>/)
  })

  test("validateAndPriceProductSections (the actual pricing authority) is imported from the shared lib — pedidos/route.ts no longer maintains its own duplicate implementation", () => {
    expect(PEDIDOS_API).toMatch(/import \{ normalizeOwnSectionOptions, validateAndPriceProductSections \} from ["']@\/lib\/product-own-sections["']/)
  })

  test("the server total includes the own-section price contribution, scoped per real product quantity — same multiplication pattern already used for agregados", () => {
    expect(PEDIDOS_API).toMatch(/serverTotalProductos \+= \(unitPrice \+ agregadosTotal \+ validSections\.value\.seccionesTotal\) \* item\.cantidad/)
  })

  test("the persisted PedidoItem.seccionesPrecios is the server-computed map — no longer the hardcoded empty object from before this task", () => {
    expect(PEDIDOS_API).not.toMatch(/seccionesPrecios: JSON\.stringify\(\{\}\)/)
    expect(PEDIDOS_API).toMatch(/seccionesPrecios: JSON\.stringify\(item\.seccionesPrecios\)/)
  })

  test("the option-validity check resolves prices by looking up the option NAME in the product's own stored section config — never from anything client-supplied", () => {
    expect(SHARED).toMatch(/const optionMap = new Map\(section\.opciones\.map\(\(option\) => \[option\.nombre, option\.precio\]\)\)/)
  })
})

// ============================================
// Public ProductDetail + Business Preview
// ============================================
describe("public ProductDetail / Business Preview: zero-price display contract (task §32, §43-44)", () => {
  test("own-section option price is only rendered when > 0 — the zero case renders no price node at all", () => {
    const occurrences = PAGE.match(/optPrecio > 0 &&/g) ?? []
    expect(occurrences.length).toBeGreaterThanOrEqual(2) // single-select + multi-select rows
  })

  test("the rendered delta uses the shared formatOptionalPriceDelta + the page's own formatPrice — never a hand-rolled 'Gratis'/'$0' string for own-section options specifically", () => {
    // Scoped to the own-section blocks specifically via their unique
    // "ml-1.5 text-xs font-semibold text-muted-foreground" wrapper — the
    // pre-existing Shared Options block (unrelated to this task, also
    // named `optPrecio` locally) uses a different className and is
    // deliberately left untouched, so it must not be swept into this
    // assertion.
    const occurrences = PAGE.match(/optPrecio > 0 && \(\s*\n\s*<span className="ml-1\.5 text-xs font-semibold text-muted-foreground">[\s\S]{0,150}/g) ?? []
    expect(occurrences.length).toBe(2) // single-select + multi-select own-section rows
    for (const block of occurrences) {
      expect(block).toMatch(/formatOptionalPriceDelta\(optPrecio, formatPrice\)/)
      expect(block).not.toMatch(/Gratis/)
    }
  })

  test("itemTotal (shown in both public detail and Business Preview — same component, isPreview only gates the CTA) now includes the own-section price total", () => {
    const block = PAGE.match(/const itemTotal = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[[\s\S]*?\]\)/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/seccionesPricing\.total/)
  })

  test("seccionesPricing is computed purely from product.secciones (the same public, already-unauthenticated payload) and local selection state — no new API call, no new data exposure", () => {
    const block = PAGE.match(/const seccionesPricing = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[product\.secciones, selectedSecciones\]\)/)
    expect(block).not.toBeNull()
  })

  test("Business Preview never gains a NEW pricing/order code path — handleAdd's isPreview early-return (R2) still precedes everything else, untouched", () => {
    const handleAddIndex = PAGE.indexOf("const handleAdd = () => {")
    expect(handleAddIndex).toBeGreaterThan(-1)
    const nearby = PAGE.slice(handleAddIndex, handleAddIndex + 120)
    expect(nearby).toContain("if (isPreview) return")
  })
})

// ============================================
// Cart pricing
// ============================================
describe("cart: own-section price deltas included in totals (task §47)", () => {
  test("CartItem.seccionesPrecios is optional (never breaks an existing call site) and documented as display-only, never sent to the server as authoritative", () => {
    expect(CART_STORE).toMatch(/seccionesPrecios\?: Record<string, number>/)
  })

  test("cart-store totalProductos() sums seccionesPrecios the same way it sums agregados", () => {
    const block = CART_STORE.match(/totalProductos: \(\) => \{[\s\S]*?\n      \},/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/seccionesTotal/)
  })

  test("cart-panel's per-item total and the line-item detail chips both account for seccionesPrecios, with the same zero-renders-nothing rule", () => {
    expect(CART_PANEL).toMatch(/seccionesTotal/)
    expect(CART_PANEL).toMatch(/formatOptionalPriceDelta/)
  })

  test("only a positive stored delta produces a suffix — a zero/undefined delta renders an empty string, never a price of $0", () => {
    const block = CART_PANEL.match(/const seccionPriceSuffix = [\s\S]*?\n  \}/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/precio && precio > 0/)
  })
})

// ============================================
// Mozo manual-order channel — same authoritative pricing, no under-charge
// ============================================
describe("the Mozo manual-order channel (a separate order-creation surface) got the same fix — never under-charges for a priced own-option", () => {
  const MOZO_API = readFileSync(
    join(process.cwd(), "src", "app", "api", "operativo", "mozo", "panel", "[slug]", "pedidos", "route.ts"),
    "utf8"
  )
  const MOZO_PAGE = readFileSync(
    join(process.cwd(), "src", "app", "mozo", "panel", "[slug]", "pedido", "[mesaId]", "page.tsx"),
    "utf8"
  )

  test("the Mozo order API imports the same shared pricing authority — no independent duplicate implementation left behind", () => {
    expect(MOZO_API).toMatch(/import \{ normalizeOwnSectionOptions, validateAndPriceProductSections \} from ["']@\/lib\/product-own-sections["']/)
  })

  test("the Mozo order API's server total includes seccionesTotal, and persists the real seccionesPrecios (not the old hardcoded empty object)", () => {
    expect(MOZO_API).toMatch(/serverTotalProductos \+= \(unitPrice \+ agregadosTotal \+ validSections\.value\.seccionesTotal\) \* item\.cantidad/)
    expect(MOZO_API).not.toMatch(/seccionesPrecios: JSON\.stringify\(\{\}\)/)
    expect(MOZO_API).toMatch(/seccionesPrecios: JSON\.stringify\(item\.seccionesPrecios\)/)
  })

  test("the Mozo staff-facing order UI renders own-section option prices (own-section options are objects now, not plain strings) and includes them in the displayed unit/line total", () => {
    expect(MOZO_PAGE).toMatch(/formatOptionalPriceDelta/)
    expect(MOZO_PAGE).toMatch(/seccionesPricing\.total/)
    expect(MOZO_PAGE).toMatch(/seccionesTotal/) // getOrderItemTotal
  })
})

// ============================================
// No schema migration — confirms task §37/§69
// ============================================
describe("no Prisma schema migration required (task §37, §69)", () => {
  test("Producto.secciones remains a plain JSON string column — the price feature is a pure application-layer change", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8")
    expect(schema).toMatch(/secciones\s+String\s+@default\("\[\]"\)/)
  })

  test("PedidoItem.seccionesPrecios already existed in the schema before this task (was always written as an empty object) — this task only starts populating it", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8")
    expect(schema).toMatch(/seccionesPrecios\s+String\s+@default\("\{\}"\)/)
  })
})
