// ============================================
// F4-B — corrección administrativa de ventas de Caja (sólo dueño, server only)
// ============================================
// The ONE writer of sale corrections. The caller is the owner route; the actor
// is always the owner of the session's business (NEGOCIO). A correction is an
// immutable event holding the state of EVERY line before and after; the sale,
// its lines, cobro, ledger operation, author, date, shift and closures are
// never modified. Approved rules (operator, 2026-10-15):
//   - lines may change product, variant and quantity; each line keeps its
//     VentaItem and the unit price actually charged — a replacement product
//     inherits it (never the current catalog price, never editable);
//   - the corrected total must be EXACTLY the total charged: otherwise the
//     request is refused before writing anything (F4-B never moves money and
//     never changes the payment method);
//   - sales with returns/voids (F4-A) cannot be corrected; old sales and sales
//     of closed shifts can (the closure stays identical);
//   - stock is adjusted with CORRECCION_ENTRADA / CORRECCION_SALIDA movements
//     per product/variant (net per key), validated against physical stock minus
//     active order reservations like a Caja sale.
// Price rule revised by the operator (2026-11-05): a line keeps the unit price
// actually charged, and the product it names must be JUSTIFIED at that price —
// the same product/variant of the original line, or one that appears in
// another original line of the same sale at exactly that price, or (operator
// decision 2026-11-04) a product/variant of this business enabled for Caja
// whose CURRENT catalog price equals the charged price exactly. For the latter
// the catalog price consulted and the moment of the check are stored with the
// line: a coincidence at correction time, never presented as proof of the
// price at sale time (historical catalog prices are not recorded). An unchanged
// line keeps the evidence of the previous correction. A replacement never
// silently takes another product's price. Real exchanges with money differences
// and combinations belong to F4-C. Also enforced in SQL.
// Concurrency: the same sale-row lock as F4-A (no-op UPDATE) + Serializable
// retries; an expected sequence number rejects edits made on a stale view;
// Idempotency-Key + content fingerprint makes retries safe.

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { lineSubtotalCaja, moneyToNumber, storedMoney } from "@/lib/money"
import { isStockSerializationConflict, leerDisponibilidadStock } from "@/lib/stock-lifecycle"
import { resolveNextStock } from "@/lib/inventario"
import { parseMotivoDevolucion, referenciaVenta, runSerializable } from "@/lib/caja-devoluciones-service"
import { lineaVigente, nombreLinea, ULTIMA_CORRECCION_INCLUDE, type LineaVigente } from "@/lib/caja-venta-vigente"
import { stockKey } from "@/lib/stock-authority"

type Db = PrismaClient
type Tx = Prisma.TransactionClient

export const MOVIMIENTO_TIPO_CORRECCION_ENTRADA = "CORRECCION_ENTRADA"
export const MOVIMIENTO_TIPO_CORRECCION_SALIDA = "CORRECCION_SALIDA"
export const CORRECCION_LINEAS_MAX = 200
export type CriterioPrecio = "MISMO_PRODUCTO" | "MISMA_VENTA" | "PRECIO_CATALOGO_ACTUAL"

/**
 * Sale-based justification of a product on a sale line at the price charged on
 * that line: it is the line's own product, or it appears in another original
 * line of the same sale at exactly that unit price. null = the sale alone does
 * not justify it (the service then checks the current catalog price).
 */
export function criterioPrecioLinea(
  originales: ReadonlyArray<{ productoId: string | null; productoVarianteId: string | null; precio: number }>,
  linea: { productoId: string | null; productoVarianteId: string | null; precio: number },
  productoId: string | null,
  varianteId: string | null
): CriterioPrecio | null {
  if (productoId === linea.productoId && varianteId === linea.productoVarianteId) return "MISMO_PRODUCTO"
  return originales.some((o) => o.productoId === productoId && o.productoVarianteId === varianteId && o.precio === linea.precio) ? "MISMA_VENTA" : null
}

export type CorreccionResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string; code?: string }

const fail = (status: 400 | 403 | 404 | 409, error: string, code?: string) => ({ ok: false as const, status, error, ...(code ? { code } : {}) })
const D = (value: number | string) => new Prisma.Decimal(String(value))
const money = (value: Prisma.Decimal) => `$${moneyToNumber(value).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface CorreccionLineaSolicitada {
  ventaItemId: string
  /** null only to keep a line whose product no longer exists exactly as it is. */
  productoId: string | null
  varianteId: string | null
  cantidad: Prisma.Decimal
}

export interface CorreccionSolicitud {
  motivo: string
  /** Number of corrections the owner saw (0 = never corrected): a stale view is refused. */
  secuenciaEsperada: number
  lineas: CorreccionLineaSolicitada[]
}

const QUANTITY_PATTERN = /^\d{1,7}(\.\d{1,3})?$/

/** The client only chooses product, variant and quantity per line — never prices, amounts or the actor. */
export function parseCorreccionBody(body: unknown): CorreccionResult<CorreccionSolicitud> {
  const raw = (body ?? {}) as Record<string, unknown>
  if (!Array.isArray(raw.lineas) || raw.lineas.length === 0 || raw.lineas.length > CORRECCION_LINEAS_MAX) {
    return fail(400, "Indicá el estado corregido de cada producto de la venta.", "LINEAS_CORRECCION_INVALIDAS")
  }
  const vistos = new Set<string>()
  const lineas: CorreccionLineaSolicitada[] = []
  for (const item of raw.lineas as unknown[]) {
    const line = (item ?? {}) as { ventaItemId?: unknown; productoId?: unknown; varianteId?: unknown; cantidad?: unknown }
    if (typeof line.ventaItemId !== "string" || !line.ventaItemId.trim() || vistos.has(line.ventaItemId)) {
      return fail(400, "Línea de la venta inválida o repetida.", "LINEAS_CORRECCION_INVALIDAS")
    }
    if (line.productoId !== null && (typeof line.productoId !== "string" || !line.productoId.trim())) return fail(400, "Elegí el producto de cada línea.", "PRODUCTO_CORRECCION_INVALIDO")
    if (line.varianteId !== undefined && line.varianteId !== null && (typeof line.varianteId !== "string" || !line.varianteId.trim())) {
      return fail(400, "Variante inválida.", "PRODUCTO_CORRECCION_INVALIDO")
    }
    const text = typeof line.cantidad === "number" && Number.isFinite(line.cantidad) ? String(line.cantidad) : typeof line.cantidad === "string" ? line.cantidad.trim() : ""
    if (!QUANTITY_PATTERN.test(text)) return fail(400, "Ingresá una cantidad válida (0 o más) para cada línea.", "CANTIDAD_CORRECCION_INVALIDA")
    vistos.add(line.ventaItemId)
    lineas.push({ ventaItemId: line.ventaItemId, productoId: typeof line.productoId === "string" ? line.productoId : null, varianteId: typeof line.varianteId === "string" ? line.varianteId : null, cantidad: D(text) })
  }
  const motivo = parseMotivoDevolucion(raw.motivo)
  if (!motivo.ok) return fail(400, motivo.error, "MOTIVO_CORRECCION_REQUERIDO")
  if (typeof raw.secuenciaEsperada !== "number" || !Number.isInteger(raw.secuenciaEsperada) || raw.secuenciaEsperada < 0) {
    return fail(400, "Actualizá la venta antes de corregirla.", "SECUENCIA_CORRECCION_INVALIDA")
  }
  if (raw.confirmo !== true) return fail(400, "Confirmá la corrección para continuar.", "CONFIRMACION_CORRECCION_REQUERIDA")
  return { ok: true, value: { motivo: motivo.value, secuenciaEsperada: raw.secuenciaEsperada, lineas } }
}

export function fingerprintCorreccion(negocioId: string, ventaId: string, solicitud: CorreccionSolicitud): string {
  const canonical = JSON.stringify({
    negocioId,
    ventaId,
    motivo: solicitud.motivo,
    secuenciaEsperada: solicitud.secuenciaEsperada,
    lineas: [...solicitud.lineas]
      .sort((a, b) => (a.ventaItemId < b.ventaItemId ? -1 : a.ventaItemId > b.ventaItemId ? 1 : 0))
      .map((l) => [l.ventaItemId, l.productoId, l.varianteId, l.cantidad.toString()]),
  })
  return createHash("sha256").update(`F4-B\n${canonical}`).digest("hex")
}

/** Maps the SQL guard messages (defense in depth) to controlled answers. */
export function mapCorreccionDbError(error: unknown): { status: 409; error: string; code: string } | null {
  const text = error instanceof Error ? error.message : String(error)
  if (text.includes("sale correction must keep the charged total") || text.includes("must cover the sale and keep its total")) {
    return { status: 409, error: "La corrección no conserva el total cobrado.", code: "TOTAL_CORRECCION_DISTINTO" }
  }
  if (text.includes("sale correction is not allowed on a sale with returns")) {
    return { status: 409, error: "No se pueden corregir ventas con devoluciones o anulaciones.", code: "VENTA_CON_DEVOLUCIONES" }
  }
  if (text.includes("sale correction replacement price is not justified")) {
    return { status: 409, error: "El producto elegido no está justificado al precio cobrado de esa línea.", code: "PRECIO_NO_JUSTIFICADO" }
  }
  if (text.includes("sale correction must keep the charged unit price")) {
    return { status: 409, error: "La corrección debe conservar el precio cobrado de cada línea.", code: "PRECIO_CORRECCION_INVALIDO" }
  }
  return null
}

function isUniqueViolation(error: unknown, fragment: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false
  const target = (error.meta as { target?: unknown } | undefined)?.target
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "")
  return text.includes(fragment)
}

// ---------------------------------------------------------------------------
// Register a correction
// ---------------------------------------------------------------------------

const CORRECCION_INCLUDE = { lineas: true } satisfies Prisma.CorreccionVentaInclude
export type CorreccionConLineas = Prisma.CorreccionVentaGetPayload<{ include: typeof CORRECCION_INCLUDE }>

export interface RegistrarCorreccionInput {
  /** The owner's business, from the owner session (the only possible actor). */
  negocioId: string
  ventaId: string
  solicitud: CorreccionSolicitud
  idempotencyKey: string
}

type LineaNueva = {
  vigente: LineaVigente
  productoId: string | null
  productoVarianteId: string | null
  nombre: string
  varianteNombre: string | null
  cantidad: Prisma.Decimal
  subtotal: Prisma.Decimal
  cambia: boolean
  criterioPrecio: CriterioPrecio
  /** PRECIO_CATALOGO_ACTUAL only: catalog price consulted and when it was checked. */
  catalogo: { precio: number; consultadoEn: Date } | null
}

async function replayCorreccion(reader: Pick<Tx, "correccionVenta">, negocioId: string, key: string, fingerprint: string) {
  const existing = await reader.correccionVenta.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, include: CORRECCION_INCLUDE })
  if (!existing) return null
  if (existing.idempotencyFingerprint === fingerprint) return { ok: true as const, value: { correccion: existing, replayed: true } }
  return fail(409, "Este intento ya se usó para otra operación. Volvé a intentarlo.", "IDEMPOTENCY_KEY_REUSED")
}

export async function registrarCorreccionVenta(db: Db, input: RegistrarCorreccionInput): Promise<CorreccionResult<{ correccion: CorreccionConLineas; replayed: boolean }>> {
  const { negocioId, ventaId, solicitud, idempotencyKey } = input
  if (typeof ventaId !== "string" || !ventaId.trim()) return fail(400, "Venta inválida.", "VENTA_INVALIDA")
  const fingerprint = fingerprintCorreccion(negocioId, ventaId, solicitud)
  try {
    return await runSerializable(db, async (tx) => {
      const replay = await replayCorreccion(tx, negocioId, idempotencyKey, fingerprint)
      if (replay) return replay

      // Same sale-row lock as F4-A returns: a concurrent return or correction of
      // this sale fails its own lock with 40001 and retries on fresh data.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "ventas_caja" SET "cantidadItems" = "cantidadItems"
        WHERE "id" = ${ventaId} AND "negocioId" = ${negocioId}
        RETURNING "id"`
      if (!locked[0]) return fail(404, "Venta no encontrada.")

      const venta = await tx.venta.findFirstOrThrow({
        where: { id: ventaId, negocioId },
        include: { items: true, correcciones: ULTIMA_CORRECCION_INCLUDE, _count: { select: { devoluciones: true } } },
      })
      if (venta._count.devoluciones > 0) {
        return fail(409, "Esta venta tiene devoluciones o una anulación registradas: ya no se puede corregir.", "VENTA_CON_DEVOLUCIONES")
      }
      const secuenciaActual = venta.correcciones[0]?.secuencia ?? 0
      if (solicitud.secuenciaEsperada !== secuenciaActual) {
        return fail(409, "La venta cambió mientras la corregías. Actualizá e intentá de nuevo.", "VENTA_MODIFICADA")
      }

      const pedidas = new Map(solicitud.lineas.map((l) => [l.ventaItemId, l]))
      if (pedidas.size !== venta.items.length || venta.items.some((item) => !pedidas.has(item.id))) {
        return fail(400, "La corrección debe incluir exactamente las líneas de la venta.", "LINEAS_CORRECCION_INVALIDAS")
      }

      const ultima = venta.correcciones[0]?.lineas
      // One check moment per attempt for the catalog criterion.
      const verificadoEn = new Date()
      const nuevas: LineaNueva[] = []
      for (const item of venta.items) {
        const vigente = lineaVigente(item, ultima)
        const pedida = pedidas.get(item.id)!
        const igual = pedida.productoId === vigente.productoId && pedida.varianteId === vigente.productoVarianteId
        const cobradoLinea = money(D(item.precio))
        const noJustificado = (precioActual: number | null) => fail(409, igual
          ? `"${nombreLinea(vigente)}" quedó registrado con el precio cobrado de "${nombreLinea(item)}" (${cobradoLinea}) por la regla anterior. Para volver a corregir esta venta, esa línea debe tener un producto justificado a ese precio: el original, otro de la venta cobrado igual o uno cuyo precio de catálogo actual sea exactamente ${cobradoLinea}.`
          : `El producto elegido no puede registrarse al precio cobrado de "${nombreLinea(item)}" (${cobradoLinea})${precioActual !== null ? `: su precio de catálogo actual es ${money(D(precioActual))}` : ""}. Sólo se admite el mismo producto, otro de esta venta cobrado al mismo precio o uno cuyo precio de catálogo actual sea exactamente ${cobradoLinea}. Un cambio real de productos con diferencia de dinero no es una corrección.`,
        "PRECIO_NO_JUSTIFICADO")

        let criterioPrecio: CriterioPrecio | null = criterioPrecioLinea(venta.items, item, pedida.productoId, pedida.varianteId)
        let catalogo: { precio: number; consultadoEn: Date } | null = null
        // An unchanged line already justified by the catalog keeps that evidence
        // (the price consulted and when), never re-checked against a newer price.
        const previa = ultima?.find((l) => l.ventaItemId === item.id)
        if (!criterioPrecio && igual && previa?.criterioPrecio === "PRECIO_CATALOGO_ACTUAL" && previa.precioCatalogoConsultado !== null && previa.precioCatalogoConsultadoEn) {
          criterioPrecio = "PRECIO_CATALOGO_ACTUAL"
          catalogo = { precio: previa.precioCatalogoConsultado, consultadoEn: previa.precioCatalogoConsultadoEn }
        }
        let nombre = vigente.nombre
        let varianteNombre = vigente.varianteNombre
        if (!igual || !criterioPrecio) {
          if (pedida.productoId === null) return criterioPrecio ? fail(400, "Elegí el producto de cada línea.", "PRODUCTO_CORRECCION_INVALIDO") : noJustificado(null)
          // Tenant-scoped live read of a CHANGED (or not yet justified) product:
          // it must belong to this business and be enabled for Caja (not deleted,
          // active variant). Its current price is used ONLY to check the catalog
          // criterion — the line always keeps the price actually charged.
          const producto = await tx.producto.findFirst({
            where: { id: pedida.productoId, negocioId, eliminado: false },
            select: { id: true, nombre: true, precio: true, variantes: { where: { activo: true }, select: { id: true, nombre: true, precio: true } } },
          })
          if (!producto) return igual ? noJustificado(null) : fail(400, "Uno de los productos elegidos no existe en tu catálogo o no está habilitado.", "PRODUCTO_CORRECCION_INVALIDO")
          let precioActual = producto.precio
          if (producto.variantes.length > 0) {
            const variante = producto.variantes.find((v) => v.id === pedida.varianteId)
            if (!variante) return igual ? noJustificado(null) : fail(400, `Elegí una variante activa de "${producto.nombre}".`, "PRODUCTO_CORRECCION_INVALIDO")
            if (!igual) varianteNombre = variante.nombre
            precioActual = variante.precio
          } else {
            if (pedida.varianteId !== null) return igual ? noJustificado(null) : fail(400, `"${producto.nombre}" no tiene variantes.`, "PRODUCTO_CORRECCION_INVALIDO")
            if (!igual) varianteNombre = null
          }
          if (!igual) nombre = producto.nombre
          if (!criterioPrecio) {
            if (precioActual !== item.precio) return noJustificado(precioActual)
            criterioPrecio = "PRECIO_CATALOGO_ACTUAL"
            catalogo = { precio: precioActual, consultadoEn: verificadoEn }
          }
        }
        let subtotal: Prisma.Decimal
        try {
          subtotal = lineSubtotalCaja(item.precio, pedida.cantidad.toNumber())
        } catch {
          return fail(400, "Cantidad fuera de rango.", "CANTIDAD_CORRECCION_INVALIDA")
        }
        nuevas.push({
          vigente,
          productoId: pedida.productoId,
          productoVarianteId: pedida.varianteId,
          nombre,
          varianteNombre,
          cantidad: pedida.cantidad,
          subtotal,
          cambia: !igual || !pedida.cantidad.equals(D(vigente.cantidad)),
          criterioPrecio,
          catalogo,
        })
      }

      if (!nuevas.some((l) => l.cambia)) return fail(400, "No hay cambios para guardar.", "CORRECCION_SIN_CAMBIOS")
      const cobrado = storedMoney(venta.totalDecimal, venta.total)
      const corregido = nuevas.reduce((acc, l) => acc.plus(l.subtotal), new Prisma.Decimal(0))
      if (!corregido.equals(cobrado)) {
        return fail(409, `El total corregido (${money(corregido)}) no coincide con lo cobrado (${money(cobrado)}). Una corrección no cambia importes; para devolver dinero usá «Devolver productos».`, "TOTAL_CORRECCION_DISTINTO")
      }

      // Stock: net change per product/variant (repeated keys add up first).
      const neto = new Map<string, { productoId: string; productoVarianteId: string | null; delta: Prisma.Decimal; nombre: string }>()
      const sumar = (productoId: string | null, productoVarianteId: string | null, varianteBorrada: boolean, delta: Prisma.Decimal, nombre: string) => {
        if (!productoId || varianteBorrada || delta.isZero()) return
        const key = stockKey(productoId, productoVarianteId)
        const prev = neto.get(key)
        neto.set(key, { productoId, productoVarianteId, delta: (prev?.delta ?? new Prisma.Decimal(0)).plus(delta), nombre: prev?.nombre ?? nombre })
      }
      for (const linea of nuevas.filter((l) => l.cambia)) {
        const viejaBorrada = linea.vigente.varianteNombre !== null && linea.vigente.productoVarianteId === null
        sumar(linea.vigente.productoId, linea.vigente.productoVarianteId, viejaBorrada, D(linea.vigente.cantidad), nombreLinea(linea.vigente))
        sumar(linea.productoId, linea.productoVarianteId, false, linea.cantidad.negated(), nombreLinea(linea))
      }
      const plan: Array<{ productoId: string; productoVarianteId: string | null; tipo: string; cantidad: number; stockAntes: number; stockDespues: number }> = []
      for (const item of neto.values()) {
        if (item.delta.isZero()) continue
        const disponibilidad = await leerDisponibilidadStock(tx, { negocioId, key: { productoId: item.productoId, productoVarianteId: item.productoVarianteId } })
        if (!disponibilidad || !disponibilidad.controlStock) continue
        const cantidad = item.delta.abs().toNumber()
        if (item.delta.isNegative() && cantidad > disponibilidad.available) {
          return fail(409, disponibilidad.activeReserved > 0
            ? `"${item.nombre}": hay ${disponibilidad.physical} en stock pero ${disponibilidad.activeReserved} están reservadas para pedidos; sólo quedan ${disponibilidad.available} disponibles.`
            : `"${item.nombre}" no tiene stock suficiente para la corrección (disponible: ${disponibilidad.available}).`, "STOCK_INSUFICIENTE")
        }
        const tipo = item.delta.isNegative() ? MOVIMIENTO_TIPO_CORRECCION_SALIDA : MOVIMIENTO_TIPO_CORRECCION_ENTRADA
        const next = resolveNextStock(disponibilidad.physical, item.delta.isNegative() ? "SALIDA" : "ENTRADA", cantidad)
        if (!next.ok) return fail(409, `"${item.nombre}" no tiene stock suficiente para la corrección.`, "STOCK_INSUFICIENTE")
        plan.push({ productoId: item.productoId, productoVarianteId: item.productoVarianteId, tipo, cantidad, stockAntes: disponibilidad.physical, stockDespues: next.nextStock })
      }

      const correccion = await tx.correccionVenta.create({
        data: {
          negocioId,
          ventaId,
          secuencia: secuenciaActual + 1,
          motivo: solicitud.motivo,
          actorTipo: "NEGOCIO",
          actorId: negocioId,
          totalDecimal: cobrado,
          idempotencyKey,
          idempotencyFingerprint: fingerprint,
          lineas: {
            create: nuevas.map((l) => ({
              negocioId,
              ventaId,
              ventaItemId: l.vigente.ventaItemId,
              antesProductoId: l.vigente.productoId,
              antesProductoVarianteId: l.vigente.productoVarianteId,
              antesNombre: l.vigente.nombre,
              antesVarianteNombre: l.vigente.varianteNombre,
              antesCantidad: l.vigente.cantidad,
              productoId: l.productoId,
              productoVarianteId: l.productoVarianteId,
              nombre: l.nombre,
              varianteNombre: l.varianteNombre,
              cantidad: l.cantidad.toNumber(),
              precio: l.vigente.precio,
              subtotalDecimal: l.subtotal,
              criterioPrecio: l.criterioPrecio,
              precioCatalogoConsultado: l.catalogo?.precio ?? null,
              precioCatalogoConsultadoEn: l.catalogo?.consultadoEn ?? null,
            })),
          },
        },
        select: { id: true },
      })

      for (const mov of plan) {
        if (mov.productoVarianteId) await tx.productoVariante.update({ where: { id: mov.productoVarianteId }, data: { stockCantidad: mov.stockDespues } })
        else await tx.producto.update({ where: { id: mov.productoId }, data: { stockCantidad: mov.stockDespues } })
        await tx.movimientoInventario.create({
          data: {
            negocioId,
            productoId: mov.productoId,
            productoVarianteId: mov.productoVarianteId,
            tipo: mov.tipo,
            cantidad: mov.cantidad,
            stockAntes: mov.stockAntes,
            stockDespues: mov.stockDespues,
            motivo: `Corrección de venta #${referenciaVenta(ventaId)}`,
            ventaId,
            correccionVentaId: correccion.id,
          },
        })
      }

      const creada = await tx.correccionVenta.findUniqueOrThrow({ where: { id: correccion.id }, include: CORRECCION_INCLUDE })
      return { ok: true as const, value: { correccion: creada, replayed: false } }
    })
  } catch (error) {
    if (isUniqueViolation(error, "idempotencyKey")) {
      const replay = await replayCorreccion(db, negocioId, idempotencyKey, fingerprint)
      if (replay) return replay
    }
    if (isUniqueViolation(error, "secuencia")) return fail(409, "La venta cambió mientras la corregías. Actualizá e intentá de nuevo.", "VENTA_MODIFICADA")
    if (isStockSerializationConflict(error)) return fail(409, "La venta cambió mientras la corregías. Actualizá e intentá de nuevo.", "VENTA_MODIFICADA")
    const mapped = mapCorreccionDbError(error)
    if (mapped) return fail(mapped.status, mapped.error, mapped.code)
    throw error
  }
}
