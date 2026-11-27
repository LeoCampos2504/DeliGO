// ============================================
// F10-C2b — actualización OPCIONAL del precio de venta al aprobar una recepción
// ============================================
// Regla: se CONSERVA el recargo que hoy tiene el producto sobre su costo (no es un margen sobre la venta):
//   recargo = precioActual / costoAnterior − 1        precioPropuesto = costoNuevo × precioActual / costoAnterior
// Se calcula con Decimal y en un solo paso (sin redondear el recargo antes), y el precio se redondea al centavo.
// Base de costos: el costo guardado del producto/variante (último costo aprobado, en el tratamiento de IVA del
// negocio) contra el costo unitario de inventario de esta recepción (mismo tratamiento). Los datos se leen ANTES de
// actualizar el costo, dentro de la transacción de la aprobación. Nunca es obligatorio: sólo se aplica lo que el
// dueño eligió, y sólo si coincide con lo que vio (si algo cambió en el medio, se aborta todo y se vuelve a revisar).
// No toca descuentos/promociones (son campos aparte) ni ventas ya hechas (cada venta guarda su precio).
// F10-C2c: lo autorizado NO cambia el precio en el acto: queda como etiqueta de góndola PENDIENTE (se sigue cobrando
// el precio anterior) hasta que se confirma la etiqueta (etiquetas-precio-service). Si el producto no tiene etiqueta
// física o se vende sólo online, el dueño elige SIN_ETIQUETA y se activa al aprobar. La base del recargo es el último
// precio AUTORIZADO (si hay una etiqueta pendiente, ese precio), para no recalcular sobre un precio que ya se reemplazó.

import { Prisma, type PrismaClient } from "@prisma/client"
import { claveStock, esMasReciente } from "@/lib/compras-calculo"
import { bloquearPrecioYEtiquetasEnTx } from "@/lib/etiquetas-precio-service"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
type Dec = Prisma.Decimal
const D = Prisma.Decimal

export type EstadoPropuestaPrecio = "PROPUESTO" | "SIN_COSTO_ANTERIOR" | "PRECIO_BAJO_COSTO" | "SIN_PRECIO" | "SIN_CAMBIO_DE_COSTO" | "HAY_UNA_RECEPCION_MAS_RECIENTE"

export interface PropuestaPrecio {
  clave: string
  recepcionLineaId: string
  productoId: string
  productoVarianteId: string | null
  producto: string
  variante: string | null
  costoAnterior: Dec | null
  costoNuevo: Dec
  precioActual: Dec | null
  /** F10-C2c: precio que se cobra hoy (puede diferir de precioActual si hay una etiqueta pendiente). */
  precioVigente: Dec | null
  etiquetaPendiente: { id: string; precioNuevo: Dec } | null
  recargoPct: Dec | null
  precioPropuesto: Dec | null
  diferencia: Dec | null
  estado: EstadoPropuestaPrecio
  descuentoActivo: boolean
}

const dec = (v: number | null | undefined, decimales: number) => (v === null || v === undefined || !Number.isFinite(v) ? null : new D(v.toFixed(decimales)))

/**
 * Propuestas por clave de stock (si una recepción trae dos renglones del mismo producto, vale el último, igual que
 * el «último costo»). `candidato` es el orden real de esta recepción: si ya hay un costo vigente más reciente, no se
 * propone nada (una recepción atrasada nunca pisa un precio más nuevo).
 */
export async function proponerPreciosEnTx(
  client: Db | Tx,
  negocioId: string,
  lineas: ReadonlyArray<{ id: string; orden: number; productoId: string | null; productoVarianteId: string | null; productoNombre: string; varianteNombre: string | null; costoNuevo: Dec | null }>,
  candidato: { fechaRecepcion: Date; aprobadaEn: Date }
): Promise<PropuestaPrecio[]> {
  const ultimas = new Map<string, (typeof lineas)[number]>()
  for (const l of [...lineas].sort((a, b) => a.orden - b.orden)) {
    if (!l.productoId || !l.costoNuevo || !l.costoNuevo.gt(0)) continue
    ultimas.set(claveStock(l.productoId, l.productoVarianteId), l)
  }
  if (!ultimas.size) return []
  const productoIds = [...new Set([...ultimas.values()].map((l) => l.productoId!))]
  const varianteIds = [...ultimas.values()].flatMap((l) => (l.productoVarianteId ? [l.productoVarianteId] : []))
  const productos = await client.producto.findMany({ where: { negocioId, id: { in: productoIds } }, select: { id: true, nombre: true, precio: true, costo: true, descuentoActivo: true } })
  const variantes = varianteIds.length
    ? await client.productoVariante.findMany({ where: { id: { in: varianteIds }, productoId: { in: productoIds } }, select: { id: true, nombre: true, precio: true, costo: true } })
    : []
  // F10-C2c: etiquetas pendientes (precio autorizado y todavía sin activar) de estas claves.
  const pendientes = await client.etiquetaPrecio.findMany({ where: { negocioId, estado: "PENDIENTE", productoId: { in: productoIds } }, select: { id: true, productoId: true, productoVarianteId: true, precioNuevoDecimal: true } })
  const pendPorClave = new Map(pendientes.map((e) => [claveStock(e.productoId, e.productoVarianteId), e]))
  const vigentes = await client.costoVigente.findMany({ where: { negocioId, stockKey: { in: [...ultimas.keys()] } }, select: { stockKey: true, fechaRecepcion: true, aprobadaEn: true, recepcionLineaId: true } })
  const pPorId = new Map(productos.map((p) => [p.id, p]))
  const vPorId = new Map(variantes.map((v) => [v.id, v]))
  const vigPorClave = new Map(vigentes.map((v) => [v.stockKey, v]))
  const out: PropuestaPrecio[] = []
  for (const [clave, l] of ultimas) {
    const p = pPorId.get(l.productoId!)
    if (!p) continue
    const v = l.productoVarianteId ? vPorId.get(l.productoVarianteId) : null
    if (l.productoVarianteId && !v) continue
    const costoNuevo = l.costoNuevo!.toDecimalPlaces(4)
    // Precio y costo propios de la variante (cada variante tiene su precio); si no, los del producto.
    const costoAnterior = dec(v ? v.costo : p.costo, 4)
    const precioVigente = dec(v ? v.precio : p.precio, 2)
    const pend = pendPorClave.get(clave)
    const precioActual = pend ? pend.precioNuevoDecimal : precioVigente
    const etiquetaPendiente = pend ? { id: pend.id, precioNuevo: pend.precioNuevoDecimal } : null
    const base = { clave, recepcionLineaId: l.id, productoId: l.productoId!, productoVarianteId: l.productoVarianteId, producto: p.nombre, variante: v?.nombre ?? l.varianteNombre, costoAnterior, costoNuevo, precioActual, precioVigente, etiquetaPendiente, recargoPct: null, precioPropuesto: null, diferencia: null, descuentoActivo: p.descuentoActivo }
    const vigente = vigPorClave.get(clave)
    if (vigente && !esMasReciente({ ...candidato, recepcionLineaId: l.id }, vigente)) { out.push({ ...base, estado: "HAY_UNA_RECEPCION_MAS_RECIENTE" }); continue }
    if (!costoAnterior || !costoAnterior.gt(0)) { out.push({ ...base, estado: "SIN_COSTO_ANTERIOR" }); continue }
    if (!precioActual || !precioActual.gt(0)) { out.push({ ...base, estado: "SIN_PRECIO" }); continue }
    if (precioActual.lt(costoAnterior)) { out.push({ ...base, estado: "PRECIO_BAJO_COSTO" }); continue }
    if (costoNuevo.eq(costoAnterior)) { out.push({ ...base, estado: "SIN_CAMBIO_DE_COSTO" }); continue }
    // Un solo paso: costoNuevo × precio / costoAnterior (sin redondear el recargo en el medio), al centavo.
    const precioPropuesto = costoNuevo.times(precioActual).dividedBy(costoAnterior).toDecimalPlaces(2, D.ROUND_HALF_UP)
    const recargoPct = precioActual.dividedBy(costoAnterior).minus(1).times(100).toDecimalPlaces(2, D.ROUND_HALF_UP)
    out.push({ ...base, estado: "PROPUESTO", recargoPct, precioPropuesto, diferencia: precioPropuesto.minus(precioActual) })
  }
  return out.sort((a, b) => a.producto.localeCompare(b.producto) || (a.variante ?? "").localeCompare(b.variante ?? ""))
}

export const propuestaParaRespuesta = (x: PropuestaPrecio) => ({
  clave: x.clave, productoId: x.productoId, productoVarianteId: x.productoVarianteId, producto: x.producto, variante: x.variante, estado: x.estado, descuentoActivo: x.descuentoActivo,
  costoAnterior: x.costoAnterior ? Number(x.costoAnterior.toString()) : null, costoNuevo: Number(x.costoNuevo.toString()),
  precioActual: x.precioActual ? Number(x.precioActual.toFixed(2)) : null,
  precioVigente: x.precioVigente ? Number(x.precioVigente.toFixed(2)) : null, etiquetaPendiente: x.etiquetaPendiente ? Number(x.etiquetaPendiente.precioNuevo.toFixed(2)) : null,
  recargoPct: x.recargoPct ? Number(x.recargoPct.toString()) : null,
  precioPropuesto: x.precioPropuesto ? x.precioPropuesto.toFixed(2) : null, diferencia: x.diferencia ? Number(x.diferencia.toFixed(2)) : null,
})

export type ModoPrecio = "ETIQUETA" | "SIN_ETIQUETA"
export type SeleccionPrecio = { clave: string; precioPropuesto: string; modo: ModoPrecio }
export function parseSeleccionPrecios(raw: unknown): SeleccionPrecio[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw) || raw.length > 200) return null
  const out: SeleccionPrecio[] = []
  for (const x of raw) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>
    if (typeof o.clave !== "string" || !o.clave || typeof o.precioPropuesto !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(o.precioPropuesto)) return null
    if (out.some((y) => y.clave === o.clave)) return null
    // Por defecto requiere cambiar la etiqueta de góndola (lo seguro: nunca se cobra distinto de lo que dice la góndola).
    if (o.modo !== undefined && o.modo !== "ETIQUETA" && o.modo !== "SIN_ETIQUETA") return null
    out.push({ clave: o.clave, precioPropuesto: new D(o.precioPropuesto).toFixed(2), modo: o.modo === "SIN_ETIQUETA" ? "SIN_ETIQUETA" : "ETIQUETA" })
  }
  return out
}

export type PrecioAplicado = { clave: string; productoId: string; productoVarianteId: string | null; precioAnterior: string; precioNuevo: string; recargoPct: string; modo: ModoPrecio; estado: "PENDIENTE_ETIQUETA" | "ACTIVADO"; etiquetaId: string; reemplazaA: string | null }

/**
 * Registra SÓLO lo elegido, si coincide con lo que el dueño vio; deja el historial. Llamar con la recepción ya APROBADA.
 * F10-C2c: cada precio queda como etiqueta PENDIENTE (no cambia el precio que se cobra) o, en modo SIN_ETIQUETA, se
 * activa ahora. Una etiqueta pendiente anterior del mismo producto/variante queda REEMPLAZADA (nunca se activa).
 */
export async function aplicarPreciosEnTx(
  tx: Tx,
  input: { negocioId: string; recepcionId: string; propuestas: PropuestaPrecio[]; seleccion: SeleccionPrecio[]; ahora: Date }
): Promise<{ ok: true; aplicados: PrecioAplicado[] } | { ok: false; status: 409; error: string; code: string; detalle?: Record<string, unknown> }> {
  const { negocioId, ahora } = input
  const aplicados: PrecioAplicado[] = []
  for (const s of input.seleccion) {
    const p = input.propuestas.find((x) => x.clave === s.clave)
    if (!p || p.estado !== "PROPUESTO" || !p.precioPropuesto || !p.precioActual || !p.precioVigente || !p.costoAnterior || !p.recargoPct) {
      return { ok: false, status: 409, error: "Uno de los precios elegidos ya no se puede actualizar automáticamente. Revisá la sección de precios.", code: "PRECIO_NO_ACTUALIZABLE", detalle: { clave: s.clave } }
    }
    if (p.precioPropuesto.toFixed(2) !== s.precioPropuesto) {
      return { ok: false, status: 409, error: "Los precios o costos cambiaron mientras revisabas. Volvé a mirar los precios propuestos.", code: "PRECIOS_CAMBIARON", detalle: { clave: s.clave } }
    }
    // Precio que se cobra hoy, con la fila bloqueada (una confirmación de etiqueta concurrente espera).
    const estadoPrecio = await bloquearPrecioYEtiquetasEnTx(tx, negocioId, p.productoId, p.productoVarianteId)
    const vigente = estadoPrecio.precio
    if (!vigente || !vigente.eq(p.precioVigente)) {
      return { ok: false, status: 409, error: "Los precios o costos cambiaron mientras revisabas. Volvé a mirar los precios propuestos.", code: "PRECIOS_CAMBIARON", detalle: { clave: s.clave } }
    }
    const cambio = await tx.cambioPrecioVenta.create({
      data: {
        negocioId, productoId: p.productoId, productoVarianteId: p.productoVarianteId, recepcionId: input.recepcionId, recepcionLineaId: p.recepcionLineaId,
        precioAnteriorDecimal: p.precioActual, precioNuevoDecimal: p.precioPropuesto, costoAnteriorDecimal: p.costoAnterior, costoNuevoDecimal: p.costoNuevo, recargoPctDecimal: p.recargoPct,
        actorTipo: "NEGOCIO", actorId: negocioId, createdAt: ahora,
      },
    })
    // La autorización nueva reemplaza a la pendiente anterior (que ya no se puede activar).
    let reemplazaA: string | null = null
    const pendiente = await tx.etiquetaPrecio.findFirst({ where: { negocioId, productoId: p.productoId, productoVarianteId: p.productoVarianteId, estado: "PENDIENTE" }, select: { id: true } })
    if (pendiente) {
      const r = await tx.etiquetaPrecio.updateMany({ where: { id: pendiente.id, estado: "PENDIENTE" }, data: { estado: "REEMPLAZADA", resolucion: "REEMPLAZADA_POR_NUEVA", resueltaEn: ahora, resueltaPorTipo: "NEGOCIO", resueltaPorId: negocioId } })
      if (r.count !== 1) return { ok: false, status: 409, error: "Una etiqueta de precio cambió mientras revisabas. Volvé a mirar los precios propuestos.", code: "PRECIOS_CAMBIARON", detalle: { clave: s.clave } }
      reemplazaA = pendiente.id
    }
    // Si el precio nuevo es el que ya se cobra, no hay etiqueta que cambiar.
    const activarAhora = s.modo === "SIN_ETIQUETA" || p.precioPropuesto.eq(vigente)
    const etiqueta = await tx.etiquetaPrecio.create({
      data: {
        negocioId, productoId: p.productoId, productoVarianteId: p.productoVarianteId, cambioPrecioVentaId: cambio.id, reemplazaAId: reemplazaA,
        precioAnteriorDecimal: vigente, precioNuevoDecimal: p.precioPropuesto, modo: activarAhora ? "SIN_ETIQUETA" : "ETIQUETA",
        autorizadaPorTipo: "NEGOCIO", autorizadaPorId: negocioId, autorizadaEn: ahora,
        ...(activarAhora ? { estado: "ACTIVADA", resolucion: "SIN_ETIQUETA", resueltaEn: ahora, resueltaPorTipo: "NEGOCIO", resueltaPorId: negocioId } : {}),
      },
    })
    if (activarAhora && !p.precioPropuesto.eq(vigente)) {
      const nuevo = Number(p.precioPropuesto.toFixed(2))
      if (p.productoVarianteId) await tx.productoVariante.update({ where: { id: p.productoVarianteId }, data: { precio: nuevo } })
      else await tx.producto.update({ where: { id: p.productoId }, data: { precio: nuevo } })
      await tx.activacionPrecioVenta.create({ data: { negocioId, productoId: p.productoId, productoVarianteId: p.productoVarianteId, precioAnteriorDecimal: vigente, precioNuevoDecimal: p.precioPropuesto, origen: "APROBACION_SIN_ETIQUETA", etiquetaPrecioId: etiqueta.id, actorTipo: "NEGOCIO", actorId: negocioId, activadoEn: ahora } })
    }
    aplicados.push({ clave: p.clave, productoId: p.productoId, productoVarianteId: p.productoVarianteId, precioAnterior: vigente.toFixed(2), precioNuevo: p.precioPropuesto.toFixed(2), recargoPct: p.recargoPct.toFixed(2), modo: activarAhora ? "SIN_ETIQUETA" : "ETIQUETA", estado: activarAhora ? "ACTIVADO" : "PENDIENTE_ETIQUETA", etiquetaId: etiqueta.id, reemplazaA })
  }
  return { ok: true, aplicados }
}
