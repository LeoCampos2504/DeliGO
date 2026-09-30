# P2-T56-R3B — Búsqueda por variante, SKU y código de barras

Date: 2026-09-30
Branch: `work/p2-t56-r3-variant-search`
Branch base: `5c468a74e14f207969d3d06aa83127aa927ad9e6` (== `origin/testing-codex` tip at start — P2-T56-R2C closeout)

## 0. Auditoría previa (sección 1 del prompt)

```text
CURRENT_INVENTORY_SEARCH=
  Client-side `useMemo` filter (`filtered`, src/components/business/
  inventario-tab.tsx) over the full `GET /api/negocio/productos` response
  (already fetched for the whole tab, no separate search request).
  Previously matched ONLY the base Producto's `nombre`/`sku`/
  `codigoBarras` — never any `ProductoVariante` field, confirming
  VARIANT_SEARCH_IMPLEMENTED=NO exactly as described in the task.

CURRENT_CAJA_SEARCH=
  Same pattern (`filtered` in caja-tab.tsx), but narrower than
  Inventario's: matched ONLY `p.nombre` — not even the base product's own
  `sku`/`codigoBarras`, and `CajaProducto`/`CajaVariante`'s TypeScript
  interfaces didn't even declare those fields (even though the server
  response already included them — see below).

CURRENT_SEARCH_FIELDS=
  Inventario (before): nombre, sku, codigoBarras (base Producto only).
  Caja (before): nombre only (base Producto only).

CURRENT_SEARCH_NORMALIZATION=
  `search.trim().toLowerCase()` + `.includes()` substring match in both
  components — same convention as the existing category-normalization
  authority's `normalizeCategoryKey` (`value.trim().toLocaleLowerCase()`),
  though not literally shared code before this round. No accent-folding
  exists anywhere in this codebase for this kind of text, so none was
  introduced here either (section 8: never two competing normalization
  systems).

CATEGORY_FILTERING=
  `effectiveCategoria` (derived, stale-filter-safe) computed identically
  in both components via `matchesCategoryFilter`/`mergeManagedCategories`
  (shared authority, unchanged) — applied BEFORE the search term in both
  `filtered` useMemos. Preserved exactly.

BACKEND_RESPONSE_AUDIT=
  `GET /api/negocio/productos` (src/app/api/negocio/productos/route.ts)
  uses `db.producto.findMany({ include: { agregados, ingredientes,
  variantes: { orderBy: { createdAt: "asc" } } } })` — a full Prisma
  `include`, not a narrow `select`. Every scalar field of both `Producto`
  and `ProductoVariante` (sku, codigoBarras, marca, nombre, activo, ...)
  was ALREADY present in the JSON response for both Inventario and Caja.
  `InventarioProducto`/`InventarioVariante` (inventario-tab.tsx) already
  declared every needed field. `CajaProducto`/`CajaVariante` (caja-tab.tsx)
  did NOT declare `sku`/`codigoBarras`/`marca` — a frontend TypeScript gap
  only, never a missing backend field. Confirms SCHEMA_CHANGE_REQUIRED=NO
  and NO_NEW_ENDPOINT_NEEDED — pure frontend work.

RUBRO_GATING_AUDIT=
  `InventarioTab`/`CajaTab` are only rendered when `negocio.rubro ===
  "negocio"` (business-panel.tsx, `isNegocio` gate on the tab list) —
  Restaurante/Ropa never reach either component, so this round is
  structurally zero-risk for those verticals (not just "untested",
  literally unreachable code for them).
```

## 1. Decisión de arquitectura

```text
VARIANT_SEARCH_STRATEGY=SHARED_PURE_HELPER_NO_BACKEND_CHANGE
  New file src/lib/product-variant-search.ts — no DOM/Prisma/React, same
  separation convention as src/lib/inventario.ts and
  src/lib/category-normalization.ts. Exports `matchesInventorySearch`,
  `matchesCajaSearch`, and `findMatchingVariante`, each taking a plain
  `SearchableProducto` (nombre/marca/sku/codigoBarras + variantes[]) so
  neither component needs to import Prisma types. Both components now
  delegate their term-matching to one of these two functions instead of
  each rolling its own `.includes()` chain (section 15) — confirmed by a
  static-contract test that the old inline chains are gone.
```

## 2. Campos de búsqueda (sección 2/6/7/8)

```text
VARIANT_SEARCH_FIELDS=NOMBRE_VARIANTE+SKU_VARIANTE+BARCODE_VARIANTE

BASE_PRODUCT_SEARCH_FIELDS_EXTENDED=
  `marca` added to both Inventario's and Caja's base-field search (the
  task's own section 2 explicitly lists it alongside nombre/sku/barcode
  as something the search "debe poder encontrar", even though it wasn't
  previously searched) — a real, additive, in-scope field addition, not
  invented scope. Restaurante/Ropa are unreachable for this code path
  (see RUBRO_GATING_AUDIT above), so this has zero observable effect
  outside negocio genérico even in principle.

SKU_CASE_WHITESPACE_SAFE=YES
  `fieldIncludes()` always does `.trim().toLowerCase()` on BOTH the
  stored value and the search term before `.includes()` — "coc500" and
  "COC500" behave identically (unit-tested).

BARCODE_HANDLING=STRING_SUBSTRING_NEVER_PARSED_AS_NUMBER
  No `parseInt`/`Number()` anywhere in the new helper — codigoBarras is
  always compared as a trimmed, lowercased string via `.includes()`.
  Leading zeros are preserved and distinguishable ("0079111" vs "79111"
  are different strings; unit-tested explicitly) — substring matching is
  used, consistent with the existing general search behavior (never
  exact-only), per section 7's stated preference.
```

## 3. No mostrar variantes como productos (sección 3)

```text
COLLAPSED_PRODUCT_DISPLAY_PRESERVED=YES
  A matching variant only ever makes the PARENT Producto's existing
  single collapsed row/card visible (the R2C collapse logic —
  `if (p.variantes.length > 0) { const resumen = summarizeVariantes(...) }`
  — was not touched at all, only the boolean feeding into `.filter()`
  changed). No new per-variant card/row was introduced anywhere.
```

## 4. Inventario — hint de coincidencia (sección 4)

```text
INVENTORY_MATCH_HINT_IMPLEMENTED=YES
  When a search term matches a product exclusively via one of its
  variants (never via a base field), both the desktop table row and the
  mobile card show a small, purely informational "Coincide: <nombre>"
  line under the product name (`findMatchingVariante(p, search,
  { allowInactive: true })`). It never auto-expands the row, never opens
  ProductoDetailDialog, never enters edit mode — confirmed by a
  static-contract test asserting `matchedVariante` is never adjacent to
  `setDetailProduct`/`setEditing`/`setFormOpen` in the render.
  Minimum-required behavior (the product simply appears) is satisfied
  regardless of whether the hint renders.
```

## 5. Caja (secciones 5/10/12)

```text
CAJA_SEARCH_BEHAVIOR=
  Searching "500 ml" now surfaces "Coca Cola" (the collapsed
  product row) exactly as it already does for a direct name match — the
  card/row itself is completely unchanged (R2C's own tap → variant
  selector flow, `varianteSelector` state, is untouched). Tapping the
  product still opens the normal variant selector; nothing in the search
  path calls `setCart`/`addCartLine`/`addProduct` (confirmed by a
  static-contract test inspecting the `filtered` useMemo body directly).

AUTO_ADD_ON_SEARCH_MATCH=NO
BARCODE_EXACT_MATCH_AUTO_ADD=NO (explicitly out of scope this round, per
  task section 5's own exception clause — not implemented)

VARIANT_STOCK_DISABLED_STATE_PRESERVED=YES
  `matchesCajaSearch` has no notion of stock at all — a variant without
  stock still matches search (unit-tested: "1,5 L" matches even though
  R2C's own selector would show it disabled if it had `controlStock` and
  zero `stockCantidad`). Search never changes vendibility/disponibilidad
  — that remains entirely R2C's own `isProductSellable`/selector logic,
  untouched.

CART_INDEPENDENT_FROM_SEARCH=YES
  Same evidence as AUTO_ADD_ON_SEARCH_MATCH — the search filter and the
  cart are fully separate state/memo, verified by static analysis of the
  `filtered` useMemo body.
```

## 6. Variantes inactivas — regla real (sección 9)

```text
INVENTORY_INACTIVE_VARIANT_SEARCH=YES
  `matchesInventorySearch` matches via ANY variant regardless of `activo`
  — an admin managing stock needs to find/reactivate a deactivated
  variant, and Inventario's own detail view already shows
  inactive variants (R2C). Unit-tested explicitly.

CAJA_INACTIVE_VARIANT_SEARCH=NO
  `matchesCajaSearch` only matches via variants where `activo === true`.
  Base-product fields (nombre/marca/sku/codigoBarras) still always match
  regardless — an inactive variant simply never being the SOLE reason a
  product surfaces in Caja, since that variant isn't sellable. Both rules
  are unit-tested with the identical fixture (a product whose only
  variant is inactive): Inventario finds it, Caja does not — until the
  product also has an active variant or a matching base field.
```

## 7. Categoría + búsqueda (sección 11)

```text
CATEGORY_AND_VARIANT_SEARCH_COMBINED=YES
  Both `filtered` useMemos still apply `effectiveCategoria` FIRST (an
  early `return false` before the search predicate ever runs) — a
  variant match can never override/bypass an active category filter.
  R2B-F1's own category+search combination behavior is completely
  unchanged; this round only replaced what the SECOND condition checks.
```

## 8. Producto sin variantes (sección 16) / Restaurante-Ropa (sección 17)

```text
NON_VARIANT_PRODUCT_SEARCH_PRESERVED=YES
  `matchesInventorySearch`/`matchesCajaSearch` both operate on
  `producto.variantes` as a plain array — `.some()` over an empty array
  is always `false`, so a product with zero variants falls through to
  exactly the same base-field matching as before (unit-tested explicitly
  as a "regresión" case for both functions).

RESTAURANTE_BEHAVIOR_CHANGED=NO
ROPA_BEHAVIOR_CHANGED=NO
  Structural, not just observed: `InventarioTab`/`CajaTab` are rendered
  only when `negocio.rubro === "negocio"` (business-panel.tsx's
  `isNegocio` tab gate) — Restaurante/Ropa never mount either component,
  so this round's code is unreachable for them regardless of data shape.
```

## 9. Cliente público (sección 18)

```text
PUBLIC_CLIENT_SEARCH_CHANGED=NO
  src/app/n/[slug]/page.tsx and every other Cliente-facing file were not
  touched in this round at all.
```

## 10. Performance (sección 14)

```text
NO_NPLUS1_INTRODUCED=YES
  Both components already fetch the FULL product list (with variantes
  nested) in a single `useQuery` — search/filter run entirely in-memory
  over that already-loaded array, exactly as they did before. No new
  network request was added anywhere for search. If the generic-business
  catalog ever grows large enough to need server-side search, that is a
  distinct, unevidenced future concern — not addressed here, per the
  task's own "no sobrediseñar sin evidencia" instruction.
```

## 11. Schema (sección 23)

```text
SCHEMA_CHANGE_REQUIRED=NO
MIGRATION_REQUIRED=NO
  Every field this round reads (Producto.marca/sku/codigoBarras,
  ProductoVariante.nombre/sku/codigoBarras/activo) already exists in the
  schema and was already returned by GET /api/negocio/productos. No
  schema.prisma edit, no migration file, in this round.
```

## 12. Tests

```text
FOCAL_TESTS=
  25 pass — src/lib/product-variant-search.test.ts (pure unit tests: the
    exact 9 cases from the task's section 19, plus base-marca match,
    inactive-variant-found-by-Inventario, non-variant-product regression,
    whitespace/case normalization on both sides, and barcode-as-string
    leading-zero handling)
  10 pass — src/components/business/product-variant-search-static-contract.test.ts
    (both components delegate to the shared helper; category filter still
    runs first; no leftover inline search chain; CajaProducto/CajaVariante
    declare the new fields; search never touches cart/addProduct; the
    "Coincide" hint is purely informational)
  TOTAL FOCAL = 35 pass / 0 fail

REGRESSION_TESTS=
  170 pass — category-normalization.test.ts, caja/ventas route.test.ts,
    inventario/movimientos route.test.ts, product-variant-editor-ux-
    static-contract.test.ts (R2C-F1), product-variants-static-contract.test.ts
    (R2C), caja-venta.test.ts, inventario.test.ts, negocio/categorias
    route.test.ts — all re-run clean against real TESTING Postgres. (Two
    logged "Transaction failed due to a write conflict" lines are the
    caja/ventas suite's own intentional concurrency-race test forcing and
    observing a Serializable retry — expected noise, not a failure; final
    tally is 0 fail.)

QUALITY_GATES=
  NEW_TYPESCRIPT_ERRORS=0 (baseline 33 pre-existing errors, none in any
    file touched this round, confirmed before and after every edit)
  ESLINT_GATE=PASS
  BUILD_GATE=PASS
  DIFF_CHECK=PASS
```

## 13. Archivos cambiados

```text
R3B_SEARCH=
  M src/components/business/inventario-tab.tsx (delegates to
    matchesInventorySearch/findMatchingVariante; "Coincide" hint)
  M src/components/business/caja-tab.tsx (delegates to matchesCajaSearch;
    CajaProducto/CajaVariante gain sku/codigoBarras/marca)
  A src/lib/product-variant-search.ts (the shared pure helper itself —
    production code that both components above import; classified here,
    not under R3B_TEST, corrected from an earlier draft of this report)
R3B_TEST=
  A src/lib/product-variant-search.test.ts
  A src/components/business/product-variant-search-static-contract.test.ts
R3B_DOCUMENTATION=
  A codex-reports/P2_T56_R3B_VARIANT_SEARCH.md (this report)
  M codex-reports/ROADMAP.md (follow-up marker updated)
UNRELATED=0
```

```text
PHYSICAL_REVIEW_REQUIRED=SI
```
