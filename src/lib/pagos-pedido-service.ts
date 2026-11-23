// ============================================
// Rediseño de pagos a proveedores — ETAPA 1: transferencia anticipada desde un pedido
// ============================================
// Diseño: codex-reports/F10_C2_F5_COMPRAS_RECEPCION_DISENO.md §16. Un pago del pedido es un crédito F5
// `PAGO_DECLARADO` (medio TRANSFERENCIA) con `compraReferenciaId` = el pedido (vínculo estructural, mismo proveedor y
// negocio, inmutable). «Ya la hice» (realizada) = el dueño lo declara realizado y nace CONFIRMADO_DUENO en la misma
// operación; «programada» = queda DECLARADO y NO cuenta como pagado hasta que el dueño la confirme (endpoint F5).
// Es una declaración del dueño, no una verificación bancaria. Nunca toca la Caja (F10-C1) ni mueve dinero.
// Al aprobar una recepción de ESE pedido, lo disponible se aplica solo a la obligación de esa recepción (después del
// efectivo pagado al recibir); el sobrante sigue ligado al pedido. Nunca se aplica solo a deudas de otros pedidos.

import { Prisma, type PrismaClient } from "@prisma/client"
import { asignadoVigente, esCreditoEfectivo, registrarCredito, type AuditoriaEnTx, type CuentaResult } from "@/lib/cuenta-proveedor-service"
import { moneyToNumber } from "@/lib/money"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
type Dec = Prisma.Decimal
const CERO = new Prisma.Decimal(0)
const n = (v: Dec) => moneyToNumber(v)

/** Sólo el DUEÑO (la ruta lo garantiza). body: { realizada, importe, fechaPago, referencia?, nota?, confirmoNoDuplicado? } */
export async function registrarPagoPedido(
  db: Db,
  input: { negocioId: string; compraId: string; body: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ creditoId: string; replayed: boolean }>> {
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  if (typeof b.realizada !== "boolean") return { ok: false, status: 400, error: "Indicá si la transferencia ya se hizo o está programada.", code: "ESTADO_PAGO_REQUERIDO" }
  // Pagos E3: efectivo PROPIO del dueño (no sale de la Caja): otro medio, realizado; nunca una salida de Caja inventada.
  const propio = b.medio === "EFECTIVO_PROPIO"
  if (propio && b.realizada !== true) return { ok: false, status: 400, error: "El efectivo propio se registra cuando ya se pagó.", code: "ESTADO_PAGO_REQUERIDO" }
  const compra = await db.compra.findFirst({ where: { id: input.compraId, negocioId: input.negocioId }, select: { proveedorId: true } })
  if (!compra) return { ok: false, status: 404, error: "Pedido no encontrado.", code: "COMPRA_NO_ENCONTRADA" }
  const deuda = await deudaAprobadaPendienteDePedido(db, input.negocioId, input.compraId)
  if (deuda.gt(0)) return { ok: false, status: 409, error: mensajeDeudaAprobada(deuda, false), code: "PEDIDO_CON_DEUDA_APROBADA" }
  return registrarCredito(db, {
    negocioId: input.negocioId,
    proveedorId: compra.proveedorId,
    idempotencyKey: input.idempotencyKey,
    compraReferenciaId: input.compraId,
    confirmarAlRegistrar: b.realizada === true,
    body: {
      origen: "PAGO_DECLARADO", medio: propio ? "OTRO" : "TRANSFERENCIA", importe: b.importe, fechaPago: b.fechaPago, referencia: b.referencia,
      motivo: propio ? "Efectivo propio del dueño (no salió de la Caja)" : b.nota,
      // Una transferencia nunca sale del efectivo de la Caja.
      confirmoNoSalioDeCaja: true, confirmoNoDuplicado: b.confirmoNoDuplicado === true,
    },
  }, opciones)
}

/** Pagos ligados al pedido con lo aplicado y lo disponible (sólo los confirmados cuentan como pagados). */
export async function pagosDePedido(db: Db | Tx, negocioId: string, proveedorId: string, compraId: string) {
  const creditos = await db.creditoProveedor.findMany({
    where: { negocioId, proveedorId, compraReferenciaId: compraId },
    orderBy: [{ fechaPago: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, estado: true, medio: true, origen: true, importeDecimal: true, fechaPago: true, referencia: true, motivo: true, confirmadoEn: true, cerradoEn: true, createdAt: true },
  })
  const { porCredito } = creditos.length ? await asignadoVigente(db, negocioId, proveedorId) : { porCredito: new Map<string, Dec>() }
  let confirmado = CERO, aplicado = CERO, disponible = CERO, programado = CERO
  const pagos = creditos.map((c) => {
    const efectivo = esCreditoEfectivo(c.estado)
    const ap = porCredito.get(c.id) ?? CERO
    const disp = efectivo ? c.importeDecimal.minus(ap) : CERO
    if (efectivo) { confirmado = confirmado.plus(c.importeDecimal); aplicado = aplicado.plus(ap); disponible = disponible.plus(disp) }
    if (c.estado === "DECLARADO") programado = programado.plus(c.importeDecimal)
    return { ...c, efectivo, aplicadoDecimal: ap, disponibleDecimal: disp }
  })
  return { pagos, resumen: { confirmado, aplicado, disponible, programado } }
}

export const pagosDePedidoParaRespuesta = (r: Awaited<ReturnType<typeof pagosDePedido>>) => ({
  resumen: { confirmado: n(r.resumen.confirmado), aplicado: n(r.resumen.aplicado), disponible: n(r.resumen.disponible), programado: n(r.resumen.programado) },
  pagos: r.pagos.map((p) => ({
    id: p.id, estado: p.estado, origen: p.origen, medio: p.medio, importe: n(p.importeDecimal), aplicado: n(p.aplicadoDecimal), disponible: n(p.disponibleDecimal),
    fechaPago: p.fechaPago, referencia: p.referencia, nota: p.motivo, confirmadoEn: p.confirmadoEn, cerradoEn: p.cerradoEn, createdAt: p.createdAt,
  })),
})

/** Plan de aplicación de los pagos confirmados del pedido a UNA obligación, hasta `tope` (el más antiguo primero). */
export async function planAnticiposPedido(db: Db | Tx, input: { negocioId: string; proveedorId: string; compraId: string; tope: Dec }) {
  const { pagos } = await pagosDePedido(db, input.negocioId, input.proveedorId, input.compraId)
  let restante = input.tope
  const plan: Array<{ creditoId: string; importe: Dec }> = []
  for (const p of pagos) {
    if (!restante.gt(0)) break
    if (!p.efectivo || !p.disponibleDecimal.gt(0)) continue
    const importe = Prisma.Decimal.min(p.disponibleDecimal, restante)
    plan.push({ creditoId: p.id, importe })
    restante = restante.minus(importe)
  }
  return plan
}

/** Cajero: sólo cuánto se pagó por adelantado de cada pedido (para no pagar dos veces). Sin saldos del proveedor. */
export async function anticiposPorPedido(db: Db, negocioId: string, compraIds: string[]) {
  if (!compraIds.length) return new Map<string, { confirmado: number; programado: number }>()
  const filas = await db.creditoProveedor.findMany({ where: { negocioId, compraReferenciaId: { in: compraIds }, estado: { in: ["DECLARADO", "CONFIRMADO_DUENO", "VIGENTE"] } }, select: { compraReferenciaId: true, estado: true, importeDecimal: true } })
  const out = new Map<string, { confirmado: Dec; programado: Dec }>()
  for (const f of filas) {
    const a = out.get(f.compraReferenciaId!) ?? { confirmado: CERO, programado: CERO }
    if (f.estado === "CONFIRMADO_DUENO" || f.estado === "VIGENTE") a.confirmado = a.confirmado.plus(f.importeDecimal)
    else a.programado = a.programado.plus(f.importeDecimal)
    out.set(f.compraReferenciaId!, a)
  }
  return new Map([...out].map(([k, v]) => [k, { confirmado: n(v.confirmado), programado: n(v.programado) }]))
}

/**
 * Pagos E3: saldo pendiente de las facturas YA APROBADAS de este pedido. Si es > 0, ese saldo se paga desde la cuenta
 * del proveedor («Pagar deudas seleccionadas»); un anticipo sólo cubre mercadería todavía no aprobada (borradores,
 * recepciones enviadas o lo que falta recibir).
 */
export async function deudaAprobadaPendienteDePedido(client: Db | Tx, negocioId: string, compraId: string) {
  const obligaciones = await client.obligacionProveedor.findMany({ where: { negocioId, estado: "VIGENTE", recepcion: { compraId } }, select: { id: true, importeDecimal: true } })
  if (!obligaciones.length) return CERO
  const asignado = await client.asignacionPago.groupBy({ by: ["obligacionId"], where: { negocioId, obligacionId: { in: obligaciones.map((o) => o.id) }, tipo: "ASIGNACION", revertidaPor: { is: null } }, _sum: { importeDecimal: true } })
  const porObl = new Map(asignado.map((a) => [a.obligacionId, a._sum.importeDecimal ?? CERO]))
  return obligaciones.reduce((t, o) => t.plus(Prisma.Decimal.max(o.importeDecimal.minus(porObl.get(o.id) ?? CERO), CERO)), CERO)
}
export const mensajeDeudaAprobada = (saldo: Dec, cajero: boolean) =>
  `Este pedido ya tiene facturas aprobadas con saldo pendiente (${saldo.toFixed(2)}). Ese saldo se paga como deuda${cajero ? "; avisale al dueño" : " desde la cuenta del proveedor («Pagar deudas seleccionadas»)"}, no como anticipo.`
