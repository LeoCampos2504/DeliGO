# P2-T56-R1 — Generic Business Operations MVP (Caja + Inventario + Pedidos/Salón enablement)

Date: 2026-09-27
Branch: `work/p2-t56-generic-business-operations`
Branch base: `9f8ca68fbdfe9b95ce18b011b9a0015f16d5693c` (== `origin/testing-codex` tip at branch creation)

## 1. Audit findings

Read the real Prisma schema (`prisma/schema.prisma`), the existing Producto/Pedido CRUD routes, the Negocio dashboard shell, the permission model, and the Salón data model directly (plus a background research pass) before designing anything.

```text
CURRENT_PRODUCT_AUTHORITY=Producto model (prisma/schema.prisma), CRUD at
  GET/POST /api/negocio/productos, GET/PUT/DELETE /api/negocio/productos/[id]
GENERIC_BUSINESS_GATE_BEFORE=Negocio.rubro (plain String, no enum) already
  supports a third value "negocio" (registered as "🏪 Otro negocio" in
  src/app/registro/negocio/page.tsx). The prisma schema's own inline comment
  ("restaurante, ropa, otro") is stale — the live, checked-everywhere value
  is "negocio", not "otro". business-panel.tsx already branches on
  rubro==="negocio" for cosmetic labels and to HIDE the Salón tab and the
  Simple/Expert mode toggle — but the Pedidos tab was never gated at all.
GENERIC_BUSINESS_GATE_AFTER=rubro==="negocio" now gets: Caja + Inventario
  tabs (replacing Productos), Salón tab (newly enabled), Pedidos unchanged
  (was already enabled). Restaurante/Ropa are byte-for-byte unaffected
  except for the one shared getTabItems() function, verified by
  src/components/business/business-panel-tab-gating.test.ts.
```

### A–J summary (full detail lives in this task's audit trail; key facts only)

- **Producto.stock** is a `Boolean` (in-stock/out-of-stock toggle) — no numeric quantity exists anywhere today. Confirmed no other model tracks quantity either.
- **Pedido** already supports non-delivery, staff-initiated orders: `clienteId` is nullable, `metodoEntrega` already includes `"retiro"`/`"mesa"` (no repartidor involved), and `POST /api/pedidos` already has a business-initiated path (`isAuthenticatedStaffForNegocio()`, used today for mozo/terminal "mesa" orders). This is a real, legitimate precedent — see the architecture decision below for why Caja does **not** reuse it anyway.
- **Salón** (`Mesa`, `SesionOcupacionMesa`) is mechanically rubro-agnostic: the actual capability gate is `Negocio.salonActivo` (opt-in, checked by `tieneSalonHabilitado()`), completely independent of `rubro`. The dashboard tab visibility was a *separate*, redundant, hardcoded `!isRopa && !isNegocio` check with no relation to that flag. The only real restaurant flavor is UI wording ("Mozo" role/labels throughout `salon-tab.tsx`, ~3000 lines) — not a functional dependency.
- **Empleado.permisos** already reserves a `"gestion_caja"` string and a `cajero` role default (`src/lib/empleado-permissions.ts`) but it is dead code today — nothing imports/enforces it. The system that *is* actually enforced is `areaOperativa` + `TerminalOperativa.scopes` (salon/pyr areas only, no caja area yet).
- **Tenant isolation / server-side pricing** patterns are well established (`getUserFromToken` → `user.type==="negocio"` → `negocioId = user.id`, never trusting a client-supplied id/price; `Prisma.TransactionIsolationLevel.Serializable` for concurrent-write safety) — replicated verbatim for every new route below.
- **DB-integration tests need a live Postgres connection this sandbox cannot reach** (`Authentication failed against database server` — same failure mode confirmed against the pre-existing `empleados/route.test.ts`, matching this repo's own documented "DB-dependent tests" baseline gap). See §7.

## 2. Architecture decision (section 3)

```text
PRODUCT_MODEL_STRATEGY=EXTEND_EXISTING
ORDER_MODEL_STRATEGY=NEW_POS_SALE_REQUIRED
```

**Producto is extended** (additive columns: `sku`, `codigoBarras`, `costo`, `marca`, `unidadMedida`, `controlStock`, `stockCantidad`, `stockMinimo`) rather than duplicated — it already has `nombre`/`precio`/`categoria`/`imagenUrl`/`negocioId`, exactly what Inventario needs, and Restaurante/Ropa are unaffected (every new column defaults to a no-op value).

**A new `Venta`/`VentaItem` model is used for Caja instead of reusing `Pedido`**, despite the legitimate `isAuthenticatedStaffForNegocio()` precedent found in the audit. Reasoning: `Pedido` carries delivery/chat/tracking/notification/idempotency semantics built for "a customer places an order that then needs fulfillment" — none of which apply to an instant walk-in sale. Reusing it would require either (a) suppressing/adapting chat-thread eligibility, the "new order" push notification, the `activeOrders` dashboard badge count, the client-confirmation flow, and the idempotency-key contract for a case none of them were designed for, or (b) leaving them in place and shipping confusing/wrong behavior (e.g. the negocio getting a push notification about its own POS sale, POS sales mixed into the Pedidos history/badge count). Both are exactly the "acoplamiento incorrecto" / "modificar profundamente la semántica de pedidos" this task told me to avoid. A new, narrow `Venta`/`VentaItem` (+ `MovimientoInventario`) model is a smaller, safer, more correct diff — and matches this task's own suggested model names in §32. The valuable *patterns* from `/api/pedidos/route.ts` (never trust a client-supplied total; tenant-derived from session) are reused; the `Pedido` table itself is not.

## 3. Pedidos (section 5)

```text
PEDIDOS_ENABLED_FOR_GENERIC_BUSINESS=YES (already was — no code change needed)
```

The Pedidos tab was never gated by `rubro`, `Pedido.clienteId` is nullable, and `metodoEntrega` already supports non-delivery scenarios. A generic business can already receive/process/complete Pedidos today. The one gap found — a couple of restaurant/ropa-flavored copy strings in `orders-tab.tsx` (e.g. the "Mozo"/"Vendedor" empleado label, a restaurant-flavored reject-reason list with no "negocio" branch) — is cosmetic wording, not a functional block, and per this task's own priority order (§37: architecture/data-integrity/tenant-safety rank far above "apariencia DeliGO") it was deliberately left for a later round rather than spending this round's budget on label polish. Documented here, not silently expanded.

## 4. Salón (section 6)

```text
SALON_ENABLED_FOR_GENERIC_BUSINESS=YES (newly enabled — one-line tab-gating change)
```

`Mesa`/`SesionOcupacionMesa` and the real activation flag (`Negocio.salonActivo`, deny-by-default) are already fully rubro-agnostic. The only thing blocking a generic business from using Salón was a redundant, hardcoded tab-visibility check in `business-panel.tsx` unrelated to that flag. Removed the `!isNegocio` half of that check (Ropa remains excluded — no walk-in table/seating concept for a clothing store). `SalonTab` itself (its `salonActivo`-gated empty state, mesa/ocupación logic) is **completely unmodified** — "no reinterpretar ni rediseñar todo Salón," per this task's own instruction. The "Mozo" wording throughout that ~3000-line component stays restaurant-flavored for this round; this is a real, documented (not improvised-around) cosmetic gap for R2, not a functional dependency — the underlying data model has no hard "restaurant" coupling.

## 4. New modules

```text
CAJA_IMPLEMENTED=SI (desktop + mobile POS, cart, checkout, resumen)
INVENTORY_IMPLEMENTED=SI (list, create, detail, edit, stock, movements)
DESKTOP_POS_IMPLEMENTED=SI (two-pane: product grid + persistent cart sidebar)
MOBILE_POS_IMPLEMENTED=SI (product grid + sticky "Ver carrito" bar + cart Sheet)
```

### Schema (additive migration, no destructive change, no backfill)

`prisma/migrations/20260927220000_add_inventario_caja_p2_t56/migration.sql` — generated via `prisma migrate diff --from-schema-datamodel <pre-change schema> --to-schema-datamodel <new schema> --script` (engine-accurate SQL, no live DB/shadow-DB connection needed to produce it). Adds 8 nullable/defaulted columns to `productos` and creates `movimientos_inventario`, `ventas_caja`, `venta_items`. Every existing row gets `controlStock=false`/`stockCantidad=0`, a no-op for Restaurante/Ropa.

```text
SCHEMA_CHANGED=SI (additive only)
MIGRATIONS_CREATED=1
```

### Backend (new/extended API routes)

- Extended `POST`/`PUT /api/negocio/productos[/[id]]`: accepts the new inventory fields (all optional) plus an `eliminado` toggle on `PUT` (reused as Inventario's "Activo/Inactivo" — no new flag invented, no history broken, matches section 27). `stockCantidad` is deliberately **not** writable through this route — only through the movements endpoint, so every stock change stays traced (section 11).
- New `POST /api/negocio/inventario/movimientos` — ENTRADA/SALIDA/AJUSTE, `Serializable` transaction, rejects `tipo=VENTA` (only Caja may create those), rejects a movement that would push stock negative.
- New `GET /api/negocio/inventario/movimientos?productoId=` — recent activity feed for the product detail view (tenant/ownership-checked).
- New `POST /api/negocio/caja/ventas` — the sale-finalization authority (section 19): recomputes every line's price/name from a tenant-scoped DB read (never trusts a client price/total), rejects the whole sale atomically if any controlled line lacks stock, decrements stock only for `controlStock=true` products, and writes one `MovimientoInventario` per affected product — all inside one `Serializable` transaction.
- New `GET /api/negocio/caja/ventas` — today's sales + a payment-method summary (section 21).

### Frontend

- `src/lib/inventario.ts` / `src/lib/caja-venta.ts` — pure, DB/DOM-free helpers (stock status, sellability, cart math, server-total-shape). Same separation-of-concerns convention already used by `tracking-movement.ts`/`delivery-navigation-ux.ts`.
- `src/components/business/inventario-tab.tsx` — search + category pills, mobile compact cards / desktop dense table, empty states, a MINIMUM_REQUIRED_FIRST product form (nombre + precio required; SKU/barcode/cost/brand/stock-control collapsed behind "Detalles avanzados"), a detail view with recent-activity feed, "Ajustar stock" dialog, "Inactivar producto."
- `src/components/business/caja-tab.tsx` — Vender/Resumen sub-tabs. Vender: desktop two-pane (`lg:grid-cols-[1fr_360px]`, sticky cart) vs. mobile (product grid + sticky bottom bar "Ver carrito · N productos · $total" → cart `Sheet`). Checkout dialog (EFECTIVO/TRANSFERENCIA/OTRO) → success screen (total, method, item count, time, sale id, "Nueva venta"). Resumen: today's totals by method + recent sales list.
- `business-panel.tsx`: `getTabItems()` now returns Caja+Inventario (replacing Productos) and Salón for `rubro==="negocio"`; exported so the gating logic itself is directly unit-tested (`business-panel-tab-gating.test.ts`) instead of only grep-asserted.

## 5. Permissions (section 23)

No second RBAC invented. The surfaces built here live inside the Negocio **owner's** `business-panel.tsx` dashboard — exactly like every existing tab (Productos/Pedidos/Config) — so the existing owner-session tenant check (`getUserFromToken` → `user.type==="negocio"` → `negocioId = user.id`) is the correct, established gate, identical to `/api/negocio/productos`. Every mutation validates `negocioId` server-side from the session; nothing is "open because the UI is hidden." Wiring Caja into the separate `Empleado`/`TerminalOperativa` scoped-employee system (a `"caja"` area alongside the existing `"salon"`/`"pyr"` ones, using the already-reserved `gestion_caja` permission) is a natural, well-precedented R2 item — not required for R1 since no other owner-dashboard tab goes through that system either.

## 6. Multi-tenant isolation & concurrency (sections 24/25)

Every new route derives `negocioId` from the session only; every product lookup is scoped `where: { id, negocioId }` (a foreign product simply isn't found → 404/400, never leaked). Sale creation validates the full requested product set against a tenant-scoped `findMany` before computing anything. Concurrent stock safety uses the same `Prisma.TransactionIsolationLevel.Serializable` pattern already established in `POST /api/negocio/productos` (one of two concurrent conflicting transactions gets a `P2034` serialization failure, surfaced as a 409 the client can retry — never silently overselling).

```text
TENANT_ISOLATION_TESTS_WRITTEN=SI (7 cases across the 2 new routes)
CONCURRENCY_TEST_WRITTEN=SI (Promise.allSettled double-sale on 1 unit of stock)
TENANT_ISOLATION_PASS=NOT_VERIFIABLE_IN_THIS_SANDBOX (see §7 — same DB-connectivity gap as this repo's other DB-integration tests, not a new limitation)
```

## 7. Test results

```text
FOCAL_TEST_RESULTS (pure, executed and verified in this sandbox):
  bun test src/lib/inventario.test.ts src/lib/caja-venta.test.ts src/components/business/business-panel-tab-gating.test.ts
  = 68 pass / 0 fail / 123 expect() calls
REGRESSION_RESULTS: src/lib/delivery-navigation-ux.test.ts, src/components/business/config-tab.test.ts re-run clean (0 fail) as an adjacent sanity check
```

`src/app/api/negocio/inventario/movimientos/route.test.ts` and
`src/app/api/negocio/caja/ventas/route.test.ts` (19 tests total: tenant
isolation ×3, concurrency ×1, stock/snapshot/total-authority/payment-method
validation ×15) were **written** in this repo's established DB-integration
style (`db.negocio.create` + `createSession` + calling the route handler
directly, matching `src/app/api/negocio/empleados/route.test.ts` exactly)
but **could not be executed successfully**: `bun test` against
`DELIGO_TEST_DATABASE_URL` fails at the connection layer —
`Authentication failed against database server` — identical to the
pre-existing failure this sandbox already produces for the repo's *existing*
`empleados/route.test.ts` when run the same way. This is not a new gap
introduced by this task; it is the same DB-connectivity limitation
documented for this sandbox's DB-dependent test category. I am not claiming
these 19 tests pass — only that they exist, follow the correct established
pattern, and are ready to run wherever that database is reachable (e.g. the
next round, or CI).

`src/lib/product-reorder.integration.test.ts` directly exercises
`POST`/`GET /api/negocio/productos` and `PUT /api/negocio/productos/[id]`
(the two files this task extended) but is itself DB-dependent and could not
be re-run for the same reason. My changes to those two files are additive
only (new optional destructured fields, new `if (x !== undefined)` branches)
and do not alter any existing required-field validation, response shape
removal, or control flow for a request that omits the new fields — designed
to be a zero-behavior-change diff for Restaurante/Ropa, but this could not
be independently confirmed by re-running that suite.

```text
TSC_GATE: NEW_TYPESCRIPT_ERRORS=0 (baseline unchanged at 33 pre-existing
  errors in unrelated files — see P2_T54_R1 report for the same baseline)
ESLINT_GATE=PASS (0 errors/warnings across every new/changed file)
BUILD_GATE=PASS (npm run build succeeded; /negocio and dependent routes compiled)
DIFF_GATE=PASS (git diff --check clean; tracked-modified files are exactly
  prisma/schema.prisma, src/app/api/negocio/productos/route.ts,
  src/app/api/negocio/productos/[id]/route.ts,
  src/components/business/business-panel.tsx, src/lib/audit.ts — no
  package.json/lockfile/Prisma-unrelated change)
```

## 8. Known limitations (section 33/37 — explicitly out of scope, not silently built)

Proveedores/compras/depósitos múltiples/lotes/vencimientos/facturación
electrónica/Mercado Pago/Stripe/cuentas corrientes/devoluciones/apertura-
cierre-arqueo de caja/analytics avanzados — none implemented, per this
task's own explicit exclusion list. Additionally, not built in this round:
Pedidos/Salón wording polish for "negocio" (documented above), Empleado/
TerminalOperativa-scoped Caja permissions (R2), a demo/seed generic-business
fixture (see below — deliberately not added).

**Seed/demo data (section 36):** no fixture was added to `prisma/seed.ts`.
That script is a shared, already-large fixture file used by every existing
vertical's tests/dev setup; inserting a new "generic business + 8 products"
block into it risked exactly the kind of unrelated-file churn this task's
own diff gate (section 3/39) warns against, for a need ("let me try it")
that doesn't require a code change. To try Caja/Inventario: register a new
business at `/registro/negocio`, pick "🏪 Otro negocio," then load 5 test
products directly from the Inventario tab's "Agregar primer producto" (e.g.
Coca Cola 2.25L, Cuaderno A4, Auriculares Bluetooth, Detergente 750ml,
Lamparita LED 12W) — no DB/seed access needed, just the UI once deployed to
TESTING.

## 9. Result

```text
PRODUCT_FILES_CHANGED=5 (schema.prisma, productos/route.ts, productos/[id]/route.ts, business-panel.tsx, audit.ts) + 6 new (inventario.ts, caja-venta.ts, inventario-tab.tsx, caja-tab.tsx, inventario/movimientos/route.ts, caja/ventas/route.ts)
TEST_FILES_CHANGED=6 new (inventario.test.ts, caja-venta.test.ts, business-panel-tab-gating.test.ts, inventario/movimientos/route.test.ts, caja/ventas/route.test.ts) — plus the migration file
PHYSICAL_REVIEW_REQUIRED=SI
```
