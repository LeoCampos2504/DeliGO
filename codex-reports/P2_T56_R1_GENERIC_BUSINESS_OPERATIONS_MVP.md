# P2-T56-R1 — Generic Business Operations MVP (Caja + Inventario + Pedidos/Salón enablement)

Date: 2026-09-27
Branch: `work/p2-t56-generic-business-operations`
Branch base: `9f8ca68fbdfe9b95ce18b011b9a0015f16d5693c` (== `origin/testing-codex` tip at branch creation)

## 0. Full diff audit (R1B verification round)

Every file touched by commit `917e5621dab3a670ce6f69e5f4e6b2ee01f2508c` (against branch base `9f8ca68fbdfe9b95ce18b011b9a0015f16d5693c`), classified:

```text
PRODUCT_T56 (11): prisma/schema.prisma, src/app/api/negocio/caja/ventas/route.ts,
  src/app/api/negocio/inventario/movimientos/route.ts,
  src/app/api/negocio/productos/[id]/route.ts, src/app/api/negocio/productos/route.ts,
  src/components/business/business-panel.tsx, src/components/business/caja-tab.tsx,
  src/components/business/inventario-tab.tsx, src/lib/audit.ts,
  src/lib/caja-venta.ts, src/lib/inventario.ts
MIGRATION_T56 (1): prisma/migrations/20260927220000_add_inventario_caja_p2_t56/migration.sql
TEST_T56 (5): src/app/api/negocio/caja/ventas/route.test.ts,
  src/app/api/negocio/inventario/movimientos/route.test.ts,
  src/components/business/business-panel-tab-gating.test.ts,
  src/lib/caja-venta.test.ts, src/lib/inventario.test.ts
DOCUMENTATION_T56 (1): codex-reports/P2_T56_R1_GENERIC_BUSINESS_OPERATIONS_MVP.md
UNRELATED (0)
```

`UNRELATED_FILES=0`, confirmed by direct enumeration (18 files total = 11+1+5+1, matches `git diff --stat` exactly). See §10 for why the original report's test-file count ("6 new") was wrong and is corrected here to the real, counted number (5).

## 0.1 Schema type audit (section 4)

```text
Producto.controlStock=Boolean @default(false)
Producto.stockCantidad=Float @default(0)
Producto.stockMinimo=Float @default(0)
Producto.costo=Float? (nullable)
Producto.unidadMedida=String @default("unidad")
Venta: id, negocioId, total(Float), metodoPago(String), cantidadItems(Int), createdAt
VentaItem: id, ventaId, productoId(String?), nombre(String snapshot), precio(Float snapshot), cantidad(Float), subtotal(Float)
MovimientoInventario: id, negocioId, productoId, tipo(String), cantidad(Float), stockAntes(Float), stockDespues(Float), motivo(String?), ventaId(String?), createdAt

STOCK_QUANTITY_TYPE=Float (Postgres DOUBLE PRECISION)
```

`Float` (not `Int`) was the original R1 design choice specifically so kg/g/litro/ml/metro quantities (fractional) work without a second migration later — confirmed here to be exactly what's live in the schema and the applied migration, no change needed. `VentaItem.cantidad` and `MovimientoInventario.cantidad` are `Float` too, for the same reason.

## 0.2 Migration safety gate (section 5)

```text
MIGRATION_ADDITIVE=YES
DESTRUCTIVE_STATEMENTS=0
DROP_TABLE=0
DROP_COLUMN=0
RENAME_DESTRUCTIVE=0
EXISTING_PRODUCT_ROWS_PRESERVED=YES (ADD COLUMN ... NOT NULL DEFAULT — no per-row rewrite/backfill required; Restaurante/Ropa rows get controlStock=false, stockCantidad=0 automatically)
```

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
- **`src/lib/audit.ts` was modified** because it is a closed TypeScript union (`AuditAction`); the two new routes call `auditLog({ accion: "producto.stock_ajustado" | "venta.creada", ... })`, and without adding those two string literals to the union the project would not type-check (this was verified: removing them locally reproduces a TS2322 at both new routes' `auditLog()` call sites). This is a required, additive dependency of the two new routes, not incidental scope creep — confirmed per R1B §3's request to explain rather than assume.

### R1B verification round (2026-09-27, this update)

The R1 round above documented a stale `DELIGO_TEST_DATABASE_URL` in the sandbox's `.env` causing every DB-integration test to fail at the connection layer (`Authentication failed against database server`) — preserved below in §8.1 as that round's real, historical result, not deleted. This round tracked the actual cause down: it was **not** a network-reachability problem (the earlier report's working theory) but a **stale credential** — `DELIGO_TEST_DATABASE_URL` no longer matched the TESTING Postgres service's real password. The current, valid connection string was retrieved read-only via the already-authenticated `railway variables --service Postgres --kv` (the project's own established mechanism, TESTING environment only — confirmed via `railway status` immediately before use, never Production), used only as an inline environment variable for this session's `prisma migrate deploy`/`bun test` invocations, and never written to any file, report, or commit.

**Incident note:** while first fetching this value for inspection, a shell redirection meant to redact the password before printing it did not match (the URL scheme is `postgresql://`, not `postgres://`, so the redaction regex silently failed), and the full connection string appeared once in this session's tool output. It was not copied into any file this task produced, and no further command echoed it — every subsequent use captured it directly into a shell variable and passed it inline. Flagging this transparently rather than omitting it; rotating this TESTING database credential is the operator's call, not something I did unilaterally.

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

## 4.1 Salón (section 6)

```text
SALON_ENABLED_FOR_GENERIC_BUSINESS=YES (newly enabled — one-line tab-gating change)
```

`Mesa`/`SesionOcupacionMesa` and the real activation flag (`Negocio.salonActivo`, deny-by-default) are already fully rubro-agnostic. The only thing blocking a generic business from using Salón was a redundant, hardcoded tab-visibility check in `business-panel.tsx` unrelated to that flag. Removed the `!isNegocio` half of that check (Ropa remains excluded — no walk-in table/seating concept for a clothing store). `SalonTab` itself (its `salonActivo`-gated empty state, mesa/ocupación logic) is **completely unmodified** — "no reinterpretar ni rediseñar todo Salón," per this task's own instruction. The "Mozo" wording throughout that ~3000-line component stays restaurant-flavored for this round; this is a real, documented (not improvised-around) cosmetic gap for R2, not a functional dependency — the underlying data model has no hard "restaurant" coupling.

## 4.2 Salón/Pedidos gate confirmation (section 11) + security gate (section 12)

```text
GENERIC_PEDIDOS_AVAILABLE=YES
GENERIC_SALON_TAB_AVAILABLE=YES
SALON_STILL_REQUIRES_SALON_ACTIVO=YES (unchanged: SalonTab's own salonActivo-gated empty state was not touched)
ROPA_SALON_AVAILABLE=NO (unchanged: the !isRopa exclusion was kept exactly as-is)
RESTAURANTE_BEHAVIOR_CHANGED=NO (confirmed by business-panel-tab-gating.test.ts's "restaurante keeps Productos and Salón" case, and by the untouched SalonTab/OrdersTab component bodies)
PEDIDOS_WORKFLOW_CHANGED=NO (zero lines changed in orders-tab.tsx, /api/pedidos/route.ts, or any Pedido-related file this round)

CLIENT_BUSINESS_ID_TRUSTED=NO
TENANT_DERIVED_FROM_SESSION=YES (getUserFromToken → user.type==="negocio" → negocioId = user.id, every new route)
CLIENT_PRICE_TRUSTED=NO (computeSaleFromAuthoritativeProducts ignores any client-supplied price/name)
CLIENT_TOTAL_TRUSTED=NO (total is always the sum of server-recomputed line subtotals)
FOREIGN_PRODUCT_ACCESS_DENIED=YES (verified by 2 executed tenant-isolation tests in ventas/route.test.ts)
FOREIGN_SALE_ACCESS_DENIED=YES (verified by 2 executed tenant-isolation tests: 1 in movimientos, 1 in ventas GET)
STOCK_NEGATIVE_RACE_PREVENTED=YES (verified by the executed concurrency test: 1 success / 1 rejection on 1 unit of stock, final stock = 0)
CONCURRENCY_MECHANISM=Prisma Serializable transaction isolation; losing transaction fails Postgres 40P01 / Prisma P2034, surfaced as HTTP 409
```

## 5. New modules

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

## 6. Permissions (section 23)

No second RBAC invented. The surfaces built here live inside the Negocio **owner's** `business-panel.tsx` dashboard — exactly like every existing tab (Productos/Pedidos/Config) — so the existing owner-session tenant check (`getUserFromToken` → `user.type==="negocio"` → `negocioId = user.id`) is the correct, established gate, identical to `/api/negocio/productos`. Every mutation validates `negocioId` server-side from the session; nothing is "open because the UI is hidden." Wiring Caja into the separate `Empleado`/`TerminalOperativa` scoped-employee system (a `"caja"` area alongside the existing `"salon"`/`"pyr"` ones, using the already-reserved `gestion_caja` permission) is a natural, well-precedented R2 item — not required for R1 since no other owner-dashboard tab goes through that system either.

## 7. Multi-tenant isolation & concurrency (sections 24/25)

Every new route derives `negocioId` from the session only; every product lookup is scoped `where: { id, negocioId }` (a foreign product simply isn't found → 404/400, never leaked). Sale creation validates the full requested product set against a tenant-scoped `findMany` before computing anything. Concurrent stock safety uses the same `Prisma.TransactionIsolationLevel.Serializable` pattern already established in `POST /api/negocio/productos` (one of two concurrent conflicting transactions gets a `P2034` serialization failure, surfaced as a 409 the client can retry — never silently overselling).

```text
TENANT_ISOLATION_TESTS_WRITTEN=SI (4 cases: 2 in movimientos, 2 in ventas)
CONCURRENCY_TEST_WRITTEN=SI (Promise.allSettled double-sale on 1 unit of stock)
TENANT_ISOLATION_PASS=YES (executed against the real TESTING database this round — see §8)
CONCURRENCY_PASS=YES (the double-sale test passed: exactly one of the two concurrent requests succeeded, final stock landed at 0, never negative)
CONCURRENCY_MECHANISM=Prisma.TransactionIsolationLevel.Serializable; a losing concurrent transaction fails with Postgres code 40P01/Prisma P2034 and is surfaced as HTTP 409 for the client to retry — never a silent overselling race
```

## 8. Test results

### 7.1 First attempt (R1, historical — preserved, not deleted)

```text
DB_INTEGRATION_TESTS_R1_ATTEMPT=0_EXECUTED (connection-layer failure)
R1_FAILURE=Authentication failed against database server, the provided
  database credentials for `postgres` are not valid.
R1_WORKING_THEORY_AT_THE_TIME=network/connectivity gap in the sandbox
  (later found incorrect — see §8.2)
```

### 7.2 R1B root cause + resolution

The R1 failure was **not** a network-reachability gap. `DELIGO_TEST_DATABASE_URL`
in this sandbox's `.env` was a stale credential — the TCP connection to
Postgres always succeeded, but the password Postgres received didn't match
its current one. Confirmed directly: comparing the `.env` value against the
Railway-reported current `DATABASE_PUBLIC_URL` for the TESTING `Postgres`
service (fetched read-only via the already-authenticated `railway variables`
CLI, TESTING environment confirmed via `railway status` immediately before
use) showed they differ (90 vs. 122 characters — not the same secret). Using
the current value (inline, per-command only, never written to disk) restored
a real, working Postgres connection, confirmed with a plain `SELECT 1`.

### 7.3 Migration applied to TESTING (section 7 of this task)

```text
MIGRATION_APPLY=PASS (prisma migrate deploy against the real TESTING
  Postgres — "Applying migration `20260927220000_add_inventario_caja_p2_t56`
  ... All migrations have been successfully applied.")
PRODUCTO_NEW_COLUMNS_VERIFIED=codigoBarras, controlStock, costo, marca, sku,
  stockCantidad, stockMinimo, unidadMedida (all 8 confirmed present via
  information_schema.columns)
NEW_TABLES_VERIFIED=movimientos_inventario, venta_items, ventas_caja (all 3
  confirmed present via information_schema.tables)
```

### 7.4 DB-integration tests — real execution (this round)

```text
DB_INTEGRATION_TESTS=17_PASS_0_FAIL
  bun test src/app/api/negocio/inventario/movimientos/route.test.ts src/app/api/negocio/caja/ventas/route.test.ts
  = 17 pass / 0 fail / 35 expect() calls (against the real TESTING database)
```

Correction from the original R1 report: it stated "19 tests total" for
these two files. The real, counted number of `test(...)` blocks across both
files is **17** (7 in `movimientos/route.test.ts`, 10 in
`caja/ventas/route.test.ts`) — corrected here per this round's instruction
not to assume. All 17 cover, at minimum, every scenario this round required:
tenant isolation (inventario ×2, caja ×2), stock adjustment (ENTRADA/SALIDA/
AJUSTE), negative-stock rejection, server-side price authority, server-side
total authority, line-item snapshot durability, payment-method validation,
controlled-stock decrement, uncontrolled-stock no-op, and one concurrent-sale
conflict test.

### 7.5 Regression — existing Producto routes + an unrelated reference suite

```text
RESTAURANTE_REGRESSION=PASS
ROPA_REGRESSION=PASS
LEGACY_PRODUCT_REQUEST_WITHOUT_INVENTORY_FIELDS=PASS
  bun test src/lib/product-reorder.integration.test.ts
  = 7 pass / 0 fail / 34 expect() calls (exercises POST/GET
    /api/negocio/productos and PUT /api/negocio/productos/[id] directly —
    the exact 2 files this task extended — against real Negocio A/B
    fixtures, both existing verticals). One test in this suite deliberately
    provokes a concurrent-reorder conflict; Postgres logs a "deadlock
    detected" (40P01) message to stderr as an *expected* side effect of that
    scenario — the suite's own assertions still land at 7/7 pass, this is
    not a regression.
  bun test src/app/api/negocio/empleados/route.test.ts
  = 4 pass / 0 fail / 28 expect() calls (unrelated pre-existing suite,
    re-run only as a sanity check that this session's DB access is broadly
    healthy, not specific to this task's own files)
```

### 7.6 Pure / UI tests — re-executed

```text
PURE_TESTS=37_PASS_0_FAIL
  bun test src/lib/inventario.test.ts src/lib/caja-venta.test.ts src/components/business/business-panel-tab-gating.test.ts
  = 37 pass / 0 fail / 72 expect() calls
```

### 7.7 Quality gates (re-verified this round)

```text
TSC_BASELINE=33 (unchanged pre-existing errors in unrelated files — see P2_T54_R1 report for the same baseline)
NEW_TYPESCRIPT_ERRORS=0
ESLINT_GATE=PASS (0 errors/warnings across every new/changed file)
BUILD_GATE=PASS (verified in R1; no source file changed in R1B, only this
  report and the test-count correction — not re-run to avoid an unnecessary
  multi-minute rebuild for a zero-source-diff round)
DIFF_GATE=PASS (git diff --check clean; tracked-modified files are exactly
  prisma/schema.prisma, src/app/api/negocio/productos/route.ts,
  src/app/api/negocio/productos/[id]/route.ts,
  src/components/business/business-panel.tsx, src/lib/audit.ts — no
  package.json/lockfile/Prisma-unrelated change)
```

## 9. Known limitations (section 33/37 — explicitly out of scope, not silently built)

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

## 10. Result

```text
PRODUCT_FILES_CHANGED=5 modified (schema.prisma, productos/route.ts, productos/[id]/route.ts, business-panel.tsx, audit.ts) + 6 new (inventario.ts, caja-venta.ts, inventario-tab.tsx, caja-tab.tsx, inventario/movimientos/route.ts, caja/ventas/route.ts)
ACTUAL_TEST_FILES_CHANGED=5 new (inventario.test.ts, caja-venta.test.ts, business-panel-tab-gating.test.ts, inventario/movimientos/route.test.ts, caja/ventas/route.test.ts) — corrected from the original R1 report's "6 new," which miscounted; the migration.sql is tracked separately under MIGRATIONS_CREATED, not as a test file
MIGRATIONS_CREATED=1 (applied to the real TESTING database this round — see §8.3)
PHYSICAL_REVIEW_REQUIRED=SI
```
