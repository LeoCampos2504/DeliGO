// ============================================
// P2-T56-R1 — pure Caja (POS) cart + sale-total helpers
// ============================================
// No DOM, no Prisma, no React, no fetch. The cart lives client-side as
// plain data; the server independently recomputes totals from its own
// DB-fetched product prices (src/app/api/negocio/caja/ventas/route.ts) and
// never trusts a client-supplied total — same principle as
// src/app/api/pedidos/route.ts for Cliente checkout. This module is shared
// by both sides so the arithmetic itself is defined exactly once and
// tested directly (see src/lib/caja-venta.test.ts).

export const METODOS_PAGO_VENTA = ["EFECTIVO", "TRANSFERENCIA", "OTRO"] as const
export type MetodoPagoVenta = (typeof METODOS_PAGO_VENTA)[number]

export function isValidMetodoPagoVenta(value: unknown): value is MetodoPagoVenta {
  return typeof value === "string" && (METODOS_PAGO_VENTA as readonly string[]).includes(value)
}

// P2-T56-R2C: a cart LINE's identity is producto + variante (section 21) —
// two different variants of the same product must never merge into one
// line just because they share a productoId. `varianteId` is optional/
// nullable throughout so every existing non-variant call site (still the
// overwhelming majority of products) is completely unaffected: omitting it
// behaves exactly as before.
export interface CartLine {
  productoId: string
  varianteId?: string | null
  nombre: string
  varianteNombre?: string | null
  precio: number
  cantidad: number
}

function sameCartLineIdentity(
  a: Pick<CartLine, "productoId" | "varianteId">,
  b: Pick<CartLine, "productoId" | "varianteId">
): boolean {
  return a.productoId === b.productoId && (a.varianteId ?? null) === (b.varianteId ?? null)
}

export function cartLineSubtotal(line: Pick<CartLine, "precio" | "cantidad">): number {
  return roundMoney(line.precio * line.cantidad)
}

export function cartTotal(lines: ReadonlyArray<Pick<CartLine, "precio" | "cantidad">>): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.precio * line.cantidad, 0))
}

export function cartItemCount(lines: ReadonlyArray<Pick<CartLine, "cantidad">>): number {
  return lines.reduce((sum, line) => sum + line.cantidad, 0)
}

/** Adds a product (or a specific variant of it) to the cart, merging into an existing line only when producto AND variante match. */
export function addCartLine(lines: readonly CartLine[], product: CartLine): CartLine[] {
  const existingIndex = lines.findIndex((l) => sameCartLineIdentity(l, product))
  if (existingIndex === -1) return [...lines, product]
  return lines.map((line, index) =>
    index === existingIndex ? { ...line, cantidad: line.cantidad + product.cantidad } : line
  )
}

/** Sets an exact quantity for a line (identified by producto + variante); a quantity <= 0 removes it. */
export function setCartLineQuantity(
  lines: readonly CartLine[],
  productoId: string,
  cantidad: number,
  varianteId?: string | null
): CartLine[] {
  if (cantidad <= 0) return removeCartLine(lines, productoId, varianteId)
  return lines.map((line) => (sameCartLineIdentity(line, { productoId, varianteId }) ? { ...line, cantidad } : line))
}

export function removeCartLine(lines: readonly CartLine[], productoId: string, varianteId?: string | null): CartLine[] {
  return lines.filter((line) => !sameCartLineIdentity(line, { productoId, varianteId }))
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export interface ServerSaleLineInput {
  productoId: string
  varianteId?: string | null
  cantidad: number
}

export interface ResolvedSaleLine {
  productoId: string
  varianteId?: string | null
  nombre: string
  varianteNombre?: string | null
  precio: number
  cantidad: number
  subtotal: number
}

// P2-T56-R2C: the authoritative product map's value gained an optional
// `variantes` sub-map (varianteId -> its own nombre/precio). A caller that
// never deals with variants can keep constructing the old
// `{nombre, precio}` shape unchanged — `variantes` being absent is
// structurally valid, and computeSaleFromAuthoritativeProducts falls back
// to the product's own precio exactly as it always has whenever a
// requested line doesn't carry a varianteId.
export interface AuthoritativeProduct {
  nombre: string
  precio: number
  variantes?: ReadonlyMap<string, { nombre: string; precio: number }>
}

// ============================================
// P2-T56-R2A — sale-summary quantity semantics (section 7)
// ============================================
// A Venta's `cantidadItems` field counts DISTINCT LINES, not units sold — 3
// units of one product is 1 line. The "how many were sold" figure shown to
// the merchant must always be SUM(item.cantidad) over the sale's real
// VentaItem snapshots, never item count and never the persisted
// `cantidadItems` field (kept as-is in the schema; simply not used for this
// display — see the R2A report for why no schema/migration change is
// needed).

export function totalUnidadesVenta(items: ReadonlyArray<Pick<CartLine, "cantidad">>): number {
  return items.reduce((sum, item) => sum + item.cantidad, 0)
}

/** Renders a unit count without truncating a fractional quantity (section 10). */
export function formatUnidadesVenta(totalUnidades: number): string {
  const isWhole = Number.isInteger(totalUnidades)
  const formatted = isWhole
    ? String(totalUnidades)
    : totalUnidades.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })
  const label = totalUnidades === 1 ? "unidad" : "unidades"
  return `${formatted} ${label}`
}

export type ComputeSaleResult =
  | { ok: true; items: ResolvedSaleLine[]; total: number; cantidadItems: number }
  | { ok: false; error: string }

/**
 * Server-side sale-total authority (section 19): given the requested lines
 * and a map of authoritative product data freshly read from the DB (never
 * client-supplied price/name), rebuilds every line's snapshot and the sale
 * total from scratch. Rejects a request with no lines, a non-positive
 * quantity, or a product missing from the authoritative map (deleted,
 * inactive, or not owned by this tenant — the caller is expected to have
 * already scoped that map to the authenticated negocioId).
 */
export function computeSaleFromAuthoritativeProducts(
  requested: ReadonlyArray<ServerSaleLineInput>,
  productsById: ReadonlyMap<string, AuthoritativeProduct>,
): ComputeSaleResult {
  if (requested.length === 0) {
    return { ok: false, error: "La venta no tiene productos" }
  }

  const items: ResolvedSaleLine[] = []
  for (const line of requested) {
    if (!Number.isFinite(line.cantidad) || line.cantidad <= 0) {
      return { ok: false, error: "La cantidad debe ser mayor a 0" }
    }
    const product = productsById.get(line.productoId)
    if (!product) {
      return { ok: false, error: "Uno de los productos ya no está disponible" }
    }

    let precio = product.precio
    let varianteNombre: string | undefined
    if (line.varianteId) {
      const variante = product.variantes?.get(line.varianteId)
      if (!variante) {
        return { ok: false, error: "Una de las variantes ya no está disponible" }
      }
      precio = variante.precio
      varianteNombre = variante.nombre
    }

    const subtotal = roundMoney(precio * line.cantidad)
    items.push({
      productoId: line.productoId,
      varianteId: line.varianteId ?? null,
      nombre: product.nombre,
      varianteNombre: varianteNombre ?? null,
      precio,
      cantidad: line.cantidad,
      subtotal,
    })
  }

  return {
    ok: true,
    items,
    total: roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0)),
    cantidadItems: items.length,
  }
}

// ============================================
// F10-B0 — checkout idempotency (pure, shared by client and server)
// ============================================
// Same key format as POST /api/pedidos (Seguridad-5C): a UUID per checkout
// ATTEMPT. The client binds the key to the exact request content
// (canonicalVentaCajaRequest) and reuses it only to retry that same content;
// the server hashes the same canonical form into Venta.idempotencyFingerprint.

export const VENTA_IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidVentaIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && VENTA_IDEMPOTENCY_KEY_PATTERN.test(value)
}

/**
 * Canonical, order-insensitive representation of "which sale is this":
 * payment method + every requested line (repeated lines are kept, the
 * server aggregates them). Never includes prices, totals or identities —
 * the server derives those itself.
 */
export function canonicalVentaCajaRequest(
  metodoPago: string,
  lines: ReadonlyArray<Pick<ServerSaleLineInput, "productoId" | "varianteId" | "cantidad">>
): string {
  const items = lines
    .map((line) => [line.productoId, line.varianteId ?? null, line.cantidad] as const)
    .sort((a, b) => (a[0] + "|" + (a[1] ?? "") + "|" + a[2]).localeCompare(b[0] + "|" + (b[1] ?? "") + "|" + b[2]))
  return JSON.stringify({ metodoPago, items })
}

// ============================================
// F10-B0 — cobros per sale (D7: multi-payment-ready, single method in the UI)
// ============================================
// A TRANSFERENCIA cobro starts DECLARADO: it records what the seller declared,
// never a verified Mercado Pago credit. EFECTIVO/OTRO: NO_APLICA.
export type EstadoConciliacionCobro = "NO_APLICA" | "DECLARADO"

export function estadoConciliacionInicial(metodo: MetodoPagoVenta): EstadoConciliacionCobro {
  return metodo === "TRANSFERENCIA" ? "DECLARADO" : "NO_APLICA"
}

export interface CobroVentaResumen {
  metodo: string
  importe: number
  estadoConciliacion: string
  /** true = sale created before F10-B0: derived from Venta.metodoPago, never persisted. */
  legacy: boolean
}

/**
 * Read-compatibility for historical sales: a sale without CobroVenta rows
 * (pre-F10-B0) is read as ONE cobro of its own metodoPago for its total.
 * Nothing is written back — historical rows are never migrated blindly.
 */
export function resolveCobrosVenta(
  venta: { metodoPago: string; total: number },
  cobros: ReadonlyArray<{ metodo: string; importe: number; estadoConciliacion: string }>
): CobroVentaResumen[] {
  if (cobros.length > 0) return cobros.map((c) => ({ ...c, legacy: false }))
  return [
    {
      metodo: venta.metodoPago,
      importe: venta.total,
      estadoConciliacion: venta.metodoPago === "TRANSFERENCIA" ? "DECLARADO" : "NO_APLICA",
      legacy: true,
    },
  ]
}
