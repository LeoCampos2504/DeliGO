// ============================================
// F10-B0 — single Caja sale engine (server only)
// ============================================
// The ONE place where a Caja sale is written. Today it is called by
// POST /api/negocio/caja/ventas (owner session); the future cashier route
// (F10-B1) must call this same function — never a second sales engine.
//
// Guarantees preserved verbatim from the original route (P2-T56-R1/R2C/R3A-I3):
//   - tenant-scoped product/variant read (negocioId from the caller's session),
//   - server-side prices and totals (computeSaleFromAuthoritativeProducts),
//   - R3A stock: plan aggregated per key against físico − ACTIVA
//     (planificarStockVentaCaja) BEFORE creating the Venta, then the single
//     write path (registrarStockVentaCaja),
//   - one Serializable transaction with the shared bounded P2034 retry.
// Added by F10-B0, inside that same transaction (all-or-nothing):
//   - idempotency (Idempotency-Key + content fingerprint, unique per negocio):
//     exact replay returns the original sale, a reused key with different
//     content is a 409, concurrent duplicates resolve to one sale;
//   - actor authorship derived by the caller from the verified session;
//   - exactly one CobroVenta per new sale (D7: multi-payment-ready);
//   - EFECTIVO only: one VENTA_COBRO operation + one +importe leg on the
//     negocio's system cash account (no physical register exists yet).
// Not done here on purpose: no Mercado Pago account or balance, no shifts,
// no cashier access, no mixed payments.

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import {
  canonicalVentaCajaRequest,
  computeSaleFromAuthoritativeProducts,
  estadoConciliacionInicial,
  type MetodoPagoVenta,
  type ServerSaleLineInput,
} from "@/lib/caja-venta"
import {
  planificarStockVentaCaja,
  registrarStockVentaCaja,
  runStockSerializable,
  type VentaCajaStockLine,
} from "@/lib/stock-lifecycle"

/** System cash account used until physical registers exist (F10-B2). */
export const CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR = "efectivo_caja_sin_asignar"
export const TIPO_OPERACION_VENTA_COBRO = "VENTA_COBRO"

/**
 * Who registers the sale — ALWAYS derived from the verified server session by
 * the caller, never from the request body.
 *   NEGOCIO  = owner (negocio session): actorId = negocioId.
 *   EMPLEADO = cashier (F10-B1+): must belong to this negocio, active.
 */
export type VentaCajaActor = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }

export interface RegistrarVentaCajaInput {
  negocioId: string
  actor: VentaCajaActor
  metodoPago: MetodoPagoVenta
  lines: ServerSaleLineInput[]
  /** null = legacy client without Idempotency-Key (owner route transition only). */
  idempotencyKey: string | null
}

export type VentaCajaConItems = Prisma.VentaGetPayload<{ include: { items: true } }>

export type RegistrarVentaCajaResult =
  | { ok: true; replayed: boolean; venta: VentaCajaConItems }
  | { ok: false; status: 400 | 403 | 409; error: string; code?: string }

export const IDEMPOTENCY_KEY_REUSED_CODE = "IDEMPOTENCY_KEY_REUSED"

type SaleDb = Pick<PrismaClient, "$transaction" | "venta" | "cuentaFinanciera">

/** sha256 of the canonical request, namespaced by negocio. */
export function fingerprintVentaCaja(negocioId: string, metodoPago: string, lines: ServerSaleLineInput[]): string {
  return createHash("sha256").update(`${negocioId}\n${canonicalVentaCajaRequest(metodoPago, lines)}`).digest("hex")
}

function replayOrConflict(existing: VentaCajaConItems, fingerprint: string | null): RegistrarVentaCajaResult {
  if (existing.idempotencyFingerprint && existing.idempotencyFingerprint === fingerprint) {
    return { ok: true, replayed: true, venta: existing }
  }
  return {
    ok: false,
    status: 409,
    code: IDEMPOTENCY_KEY_REUSED_CODE,
    error: "Este intento de cobro ya se usó para otra venta. Volvé a intentar el cobro.",
  }
}

function isIdempotencyUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false
  const target = (error.meta as { target?: unknown } | undefined)?.target
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "")
  return text.includes("idempotencyKey") || text.includes("ventas_caja_negocioId_idempotencyKey_key")
}

/**
 * Ensures the negocio's system cash account exists, OUTSIDE the sale
 * transaction (INSERT … ON CONFLICT DO NOTHING in autocommit) so concurrent
 * first sales never fight over it and the Serializable sale transaction that
 * follows always sees it committed.
 */
export async function asegurarCuentaEfectivoCaja(db: Pick<PrismaClient, "cuentaFinanciera">, negocioId: string): Promise<string> {
  await db.cuentaFinanciera.createMany({
    data: [
      {
        negocioId,
        clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR,
        tipo: "EFECTIVO",
        nombre: "Efectivo de Caja (sin caja física asignada)",
      },
    ],
    skipDuplicates: true,
  })
  const cuenta = await db.cuentaFinanciera.findUniqueOrThrow({
    where: { negocioId_clave: { negocioId, clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR } },
    select: { id: true },
  })
  return cuenta.id
}

export async function registrarVentaCaja(db: SaleDb, input: RegistrarVentaCajaInput): Promise<RegistrarVentaCajaResult> {
  const { negocioId, actor, metodoPago, lines: requestedLines, idempotencyKey } = input
  const fingerprint = idempotencyKey ? fingerprintVentaCaja(negocioId, metodoPago, requestedLines) : null
  const cuentaEfectivoId = metodoPago === "EFECTIVO" ? await asegurarCuentaEfectivoCaja(db, negocioId) : null

  try {
    return await runStockSerializable(db, async (tx) => {
      // F10-B0: exact replay / reused key — BEFORE any validation or side
      // effect, so a retry of an already-committed sale never re-validates
      // stock and never writes anything.
      if (idempotencyKey) {
        const existing = await tx.venta.findUnique({
          where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } },
          include: { items: true },
        })
        if (existing) return replayOrConflict(existing, fingerprint)
      }

      // Actor: derived from the session by the caller; an EMPLEADO must be an
      // active employee of THIS negocio (defense in depth for F10-B1).
      let actorId: string = negocioId
      let empleadoId: string | null = null
      if (actor.tipo === "EMPLEADO") {
        const empleado = await tx.empleado.findFirst({
          where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false },
          select: { id: true },
        })
        if (!empleado) return { ok: false as const, status: 403 as const, error: "Acceso denegado" }
        actorId = empleado.id
        empleadoId = empleado.id
      }

      // Tenant-scoped, authoritative product+variant read — a productoId
      // that doesn't belong to this negocio (or is inactive) simply won't
      // be in this map, and computeSaleFromAuthoritativeProducts rejects
      // any requested line that isn't in it. Every active AND inactive
      // variant is fetched (never trust "activo" from the client either) so
      // an inactive variant is resolvable-but-rejectable below, not just
      // silently missing.
      const productos = await tx.producto.findMany({
        where: { id: { in: requestedLines.map((l) => l.productoId) }, negocioId, eliminado: false },
        include: { variantes: true },
      })
      const productsById = new Map(
        productos.map((p) => [
          p.id,
          {
            nombre: p.nombre,
            precio: p.precio,
            variantes: new Map(
              p.variantes.filter((v) => v.activo).map((v) => [v.id, { nombre: v.nombre, precio: v.precio }])
            ),
          },
        ])
      )

      const computed = computeSaleFromAuthoritativeProducts(requestedLines, productsById)
      if (!computed.ok) {
        return { ok: false as const, status: 400 as const, error: computed.error }
      }

      // P2-T56-R3A-I3: stock por clave AGREGADA (Decisión C: líneas repetidas
      // del mismo producto/variante suman antes de validar) contra el DISPONIBLE
      // = físico − reservas ACTIVA (Decisión B), leído en esta misma tx
      // Serializable por la autoridad compartida. Lanza 409
      // STOCK_RESERVED_FOR_ORDERS / STOCK_INSUFFICIENT antes de crear nada.
      const productsByIdFull = new Map(productos.map((p) => [p.id, p]))
      const variantesById = new Map(productos.flatMap((p) => p.variantes.map((v) => [v.id, v] as const)))
      const stockLines: VentaCajaStockLine[] = computed.items.map((line) => {
        const producto = productsByIdFull.get(line.productoId)!
        const variante = line.varianteId ? variantesById.get(line.varianteId)! : null
        return {
          productoId: line.productoId,
          productoVarianteId: line.varianteId ?? null,
          cantidad: line.cantidad,
          controlStock: variante ? variante.controlStock : producto.controlStock,
          nombre: variante ? `${producto.nombre} — ${variante.nombre}` : producto.nombre,
        }
      })
      const stockPlan = await planificarStockVentaCaja(tx, { negocioId, lines: stockLines })

      const venta = await tx.venta.create({
        data: {
          negocioId,
          total: computed.total,
          metodoPago,
          cantidadItems: computed.cantidadItems,
          idempotencyKey,
          idempotencyFingerprint: fingerprint,
          actorTipo: actor.tipo,
          actorId,
          empleadoId,
          items: {
            create: computed.items.map((item) => ({
              productoId: item.productoId,
              productoVarianteId: item.varianteId ?? null,
              nombre: item.nombre,
              varianteNombre: item.varianteNombre ?? null,
              precio: item.precio,
              cantidad: item.cantidad,
              subtotal: item.subtotal,
            })),
          },
        },
        include: { items: true },
      })

      // Un descuento + un MovimientoInventario VENTA por clave agregada, en la
      // misma tx: si algo falla no queda Venta, VentaItem, stock ni movimiento.
      await registrarStockVentaCaja(tx, { negocioId, ventaId: venta.id, plan: stockPlan })

      // F10-B0 — exactly one cobro for the whole sale (single method in the UI).
      const cobro = await tx.cobroVenta.create({
        data: {
          negocioId,
          ventaId: venta.id,
          metodo: metodoPago,
          importe: venta.total,
          estadoConciliacion: estadoConciliacionInicial(metodoPago),
        },
        select: { id: true },
      })

      // F10-B0 — minimal ledger: only cash enters it (one operation, one leg).
      // TRANSFERENCIA/OTRO: no financial movement (no MP account, no balance).
      if (cuentaEfectivoId) {
        await tx.operacionFinanciera.create({
          data: {
            negocioId,
            tipo: TIPO_OPERACION_VENTA_COBRO,
            cobroVentaId: cobro.id,
            actorTipo: actor.tipo,
            actorId,
            movimientos: { create: [{ negocioId, cuentaId: cuentaEfectivoId, importe: venta.total }] },
          },
          select: { id: true },
        })
      }

      return { ok: true as const, replayed: false, venta }
    })
  } catch (error) {
    // A concurrent request with the same key committed first: return that
    // sale (exact replay) or the controlled conflict — never a second sale.
    if (idempotencyKey && isIdempotencyUniqueViolation(error)) {
      const existing = await db.venta.findUnique({
        where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } },
        include: { items: true },
      })
      if (existing) return replayOrConflict(existing, fingerprint)
    }
    throw error
  }
}
