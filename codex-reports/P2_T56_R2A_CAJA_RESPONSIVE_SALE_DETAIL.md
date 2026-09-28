# P2-T56-R2A — Caja Responsive Checkout + Sale Detail

Date: 2026-09-28
Branch: `work/p2-t56-r2`
Branch base: `6c501e4780725bd87e7eb2f0a69a0d410837a8ae` (== `origin/testing-codex` tip at branch creation, the R1 deploy)

## 1. Finding A — checkout/cart too wide

### Audit (section 3)

```text
CHECKOUT_COMPONENT=MIXED — desktop cart is a sticky sidebar panel (no Sheet/Dialog);
  mobile cart is a Sheet (side="bottom"); payment confirmation and the
  post-sale success screen are both Dialog. All three live in
  src/components/business/caja-tab.tsx; no shared component was modified.
```

`FULL_WIDTH_CAUSE` — two distinct, concrete causes, one per platform:

1. **Desktop/tablet (`CheckoutDialog` / `SuccessDialog`).** The shared
   `src/components/ui/dialog.tsx` `DialogContent` ships its own defaults:
   an unscoped `max-w-[calc(100%-2rem)]` **and** a separately-slotted
   `sm:max-w-lg` (512px). `cn()` is `twMerge(clsx(...))`, and tailwind-merge
   only overrides a Tailwind "slot" that the override string actually
   occupies. The R1 code passed only an **unscoped** `max-w-xs` — it
   correctly replaced the unscoped default (so phones under 640px got a
   true 320px cap), but it did **not** touch the `sm:` slot, so on any
   viewport ≥640px — the overwhelming majority of real desktop/laptop
   browser windows, not just very wide monitors — the dialog silently fell
   back to the shared component's own 512px default. That's why it read as
   "too wide" on both a real desktop window and a phone in landscape/larger
   phones, while looking fine on a narrow portrait phone.
2. **Mobile (`Sheet` cart body).** `src/components/ui/sheet.tsx`'s
   `side="bottom"` variant is intentionally `inset-x-0` (a full-width
   bottom-sheet frame is the correct pattern — matches how bottom sheets
   work everywhere). The bug was that the **body** rendered directly inside
   `<SheetContent>` with zero horizontal padding — only `<SheetHeader>`
   (used just for the title) carries the shared component's own `p-4`. Cart
   line items, the total row, and the "Cobrar" button therefore touched the
   screen edges directly, which is what reads as "loses the modal/cart
   look" even though the outer sheet frame was never literally wrong.

Neither shared component (`dialog.tsx`, `sheet.tsx`) was touched — both
fixes are entirely local to `caja-tab.tsx`, per this task's explicit
preference ("preferir corregir Caja localmente").

### Fixes (sections 4/5)

```text
DESKTOP_CHECKOUT_FIX=
  - CheckoutDialog/SuccessDialog/new VentaDetailDialog: className changed
    from "max-w-xs" to "max-w-xs sm:max-w-sm" — now correctly capped at
    24rem/384px from 640px up, matching this task's suggested band via the
    design system's own max-w-sm token (no hardcoded pixel value).
  - Desktop cart sidebar column: `lg:grid-cols-[1fr_360px]` ->
    `lg:grid-cols-[1fr_440px]` (within the task's suggested ~440-520px
    band), sidebar padding p-3 -> p-4 for a touch more breathing room.
MOBILE_CHECKOUT_FIX=
  - Sheet cart body wrapped in `mx-auto w-full max-w-md px-4 pb-2` — the
    outer sheet frame stays the correct edge-to-edge bottom-sheet shape
    (safe-area padding, rounded top corners, and the existing 85vh scroll
    cap were already correct and are unchanged), but the cart content
    itself is now properly padded/contained instead of touching the edges.
  - The sticky bottom "Ver carrito" bar and its safe-area handling were
    already correct in R1 and are unchanged.
```

## 2. Finding B — sale summary quantity semantics

### Before / after (sections 6/7)

```text
SALE_SUMMARY_BEFORE="1 producto · TRANSFERENCIA" for a sale of 3 x Coca-Cola
  (Venta.cantidadItems counts DISTINCT LINES — 3 units in 1 line is
  cantidadItems=1 — and the UI rendered that number with the word
  "producto(s)", reading as "one item was sold" instead of "three were").
SALE_SUMMARY_AFTER="3 unidades · TRANSFERENCIA" — computed as
  SUM(VentaItem.cantidad) across the sale's real line snapshots, never the
  persisted cantidadItems field and never VentaItem.length.
```

`Venta.cantidadItems` itself was **not changed or removed** — it remains
exactly what it always was (a distinct-line count) and is simply no longer
used for this particular display. No schema/migration change, per this
task's explicit instruction.

### API audit (section 9)

```text
SALE_ITEMS_SOURCE=already returned by both endpoints, unchanged, no
  extension needed:
  - GET /api/negocio/caja/ventas -> db.venta.findMany({..., include: {
    items: true }}) already includes id/productoId/nombre/precio/cantidad/
    subtotal for every VentaItem.
  - POST /api/negocio/caja/ventas -> tx.venta.create({..., include: {
    items: true }}) returns the same shape immediately on checkout.
  The R1 frontend simply never read `items` from either response — its
  VentaResumen TypeScript interface omitted the field entirely. This round
  only extends that interface and the UI; zero backend/route changes.
```

### Formula + detail (sections 10/11)

```text
TOTAL_QUANTITY_FORMULA=SUM(VentaItem.cantidad) — src/lib/caja-venta.ts:
  totalUnidadesVenta(items) = items.reduce((sum, i) => sum + i.cantidad, 0)
  formatUnidadesVenta(n) renders "1 unidad" / "N unidades", and formats a
  fractional n (e.g. 1.5) via toLocaleString("es-AR", {minimumFractionDigits:1,
  maximumFractionDigits:3}) instead of truncating — "1,5 unidades". No new
  unit-of-measure semantics were added (VentaItem doesn't carry a unit yet,
  per this task's explicit R2A scope boundary); this only guarantees a
  fractional cantidad is never silently rounded off.
```

Sale detail (`VentaDetailDialog`, new) renders every line from its own
`VentaItem` snapshot fields only — `nombre`, `precio`, `cantidad`,
`subtotal` — never a live `Producto` lookup, so a price/name change
tomorrow can never rewrite yesterday's sale (section 11). Format:

```
Coca Cola
3 × $2.000                          $6.000

Cuaderno A4
2 × $1.500                          $3.000
──────────────────────────────────────────
Total                               $9.000
5 unidades
Método: Transferencia
Hora: 13:01
```

### Responsive behavior (section 12)

Recent-sales rows stay compact by default — total, real unit count (not
line count), method, and time only — and are now tap targets
(`<button onClick={() => setDetailSale(v)}>`) that open `VentaDetailDialog`
for the full per-line breakdown, on both desktop and mobile (the dialog
itself is responsive per the Finding-A fix above). No sale is pre-expanded;
the initial Resumen screen renders exactly as much as it did before, just
with the corrected unit count.

## 3. Scope discipline (section 13)

```text
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
```

Not touched this round, confirmed by the diff itself: Inventario (list/
form/stock UI), stock semantics, `Producto` schema, categories, variants,
Pedidos, Salón, Mercado Pago/Stripe, employee permissions, and every
existing migration. The entire diff is 3 modified files + 1 new test file,
all under `src/components/business/caja-tab.tsx` / `src/lib/caja-venta.ts`.

## 4. Files changed

```text
FILES_CHANGED=
  M src/components/business/caja-tab.tsx (checkout/cart width fixes, sale
    quantity semantics, new VentaDetailDialog)
  M src/lib/caja-venta.ts (new pure helpers: totalUnidadesVenta,
    formatUnidadesVenta)
  M src/lib/caja-venta.test.ts (5 new unit tests for the two helpers above)
  A src/components/business/caja-tab-responsive-static-contract.test.ts
    (6 new source-level contract tests — no DOM env exists in this repo,
    same established convention as delivery-navigation-static-contract.test.ts)
```

## 5. Tests

```text
NEW_TESTS=PASS
  bun test src/lib/caja-venta.test.ts src/lib/inventario.test.ts
    src/components/business/business-panel-tab-gating.test.ts
    src/components/business/caja-tab-responsive-static-contract.test.ts
  = 48 pass / 0 fail / 95 expect() calls

DB_T56_REGRESSION=PASS (re-executed against the live TESTING database —
  same credential already verified working in R1B/R1C rounds)
  bun test src/app/api/negocio/inventario/movimientos/route.test.ts
  = 7 pass / 0 fail / 13 expect() calls
  bun test src/app/api/negocio/caja/ventas/route.test.ts
  = 10 pass / 0 fail / 22 expect() calls
  (7 + 10 = 17 pass / 0 fail total — unchanged from R1/R1B/R1C; the backend
  routes were not touched this round, this just re-confirms nothing on the
  server side regressed)
```

New coverage added this round, matching section 14's checklist exactly:
quantity total = SUM(items.cantidad); 3 units of one product is never
reported as "1 producto"; multiple distinct lines sum correctly (3+2=5, not
2 lines); fractional quantities (1.5) are not truncated; sale detail reads
from `VentaItem` snapshots only (asserted both as a pure-helper test and as
a static-contract assertion that the render path never calls
`db.producto.findUnique`); payment method stays visible in both the compact
row and the detail view; the existing route tests already cover
cross-tenant sale access denial (unchanged, re-run for regression); and the
new static-contract file asserts the responsive class names directly
(`sm:max-w-sm`, `lg:grid-cols-[1fr_440px]`, the padded Sheet wrapper) rather
than depending on rendered pixel measurements.

```text
TSC=NEW_TYPESCRIPT_ERRORS=0 (baseline unchanged at 33 pre-existing errors in unrelated files)
ESLINT=PASS (0 errors/warnings on all 4 changed/added files)
BUILD=PASS (npm run build succeeded)
DIFF_CHECK=PASS (git diff --check clean; only the 3 modified + 1 new file listed above)
```

## 6. Known limitations

Categories, variants, employee/cajero accounts, and open/close-register
flows remain entirely out of scope for R2A, as instructed — reserved for
R2B/R2C. The `sm:max-w-sm` (384px) checkout width is a deliberate,
conservative middle ground for a payment-method confirmation step (few
buttons, no dense content); the 440px cart sidebar is separately sized for
line-item lists. Neither was tuned against a live rendered screenshot in
this round (no interactive browser session was available here) — the fix
is verified as a correct, deterministic Tailwind/tailwind-merge class
resolution (see Finding A's root-cause analysis) and via the new static
contract test, not via a pixel-level visual diff; the operator's own manual
pass on TESTING remains the real confirmation.

## 7. Closeout (P2-T56-R2B preflight, per its §26)

```text
CHECKOUT_VISUAL_REVIEW=PASS
SALE_DETAIL_VISUAL_REVIEW=PASS
P2_T56_R2A_STATUS=CLOSED_TESTING_CERTIFIED
```

Confirmed by the operator's own manual review on TESTING after the R2A
fast-forward deploy (commit `9fbd8996db5e4177653aa56d5192b584ade09390`,
`TESTING_DEPLOYMENT_STATUS=SUCCESS`): the responsive checkout/cart fix and
the sale-detail/quantity-semantics fix both read correctly on the deployed
instance. This closeout entry is recorded here — not as a separate report —
per the P2-T56-R2B task's explicit instruction to avoid a
documentation-only commit/deploy.
