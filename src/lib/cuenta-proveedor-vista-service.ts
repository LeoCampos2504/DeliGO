// ============================================
// Rediseño de pagos — ETAPA 2: cuenta corriente por pedidos y facturas + «Pagar deudas seleccionadas»
// ============================================
// Diseño: codex-reports/F10_C2_F5_COMPRAS_RECEPCION_DISENO.md §16.3 / §16.9. Sólo PRESENTACIÓN sobre el motor F5:
// los importes salen de las obligaciones (deuda) y de las asignaciones vigentes (lo pagado de CADA obligación), así un
// pago repartido entre varias facturas nunca se cuenta dos veces. «Pagar deudas seleccionadas» = un crédito
// PAGO_DECLARADO (transferencia realizada por el dueño, confirmada al registrar) + sus asignaciones, en UNA transacción
// del motor F5 (registrarCredito + operarAsignacionesEnTx): idempotente, con candado por proveedor y los topes del
// motor (nunca más que el pago ni que el saldo de cada obligación). Lo no repartido queda a favor, visible.

import { Prisma, type PrismaClient } from "@prisma/client"
import { createHash } from "node:crypto"
import { estadoCuenta, operarAsignacionesEnTx, registrarCredito, type AuditoriaEnTx, type CuentaResult } from "@/lib/cuenta-proveedor-service"

type Db = PrismaClient
const D = Prisma.Decimal
const CERO = new D(0)
const r2 = (x: number) => Math.round(x * 100) / 100

export type EstadoFactura = "PENDIENTE" | "PARCIAL" | "PAGADA"
const estadoDe = (importe: number, pagado: number): EstadoFactura => (pagado <= 0.004 ? "PENDIENTE" : importe - pagado <= 0.004 ? "PAGADA" : "PARCIAL")

export async function cuentaPorPedidos(db: Db, negocioId: string, proveedorId: string) {
  const cuenta = await estadoCuenta(db, negocioId, proveedorId)
  if (!cuenta) return null
  const [oblExtra, credExtra, compras] = await Promise.all([
    db.obligacionProveedor.findMany({ where: { negocioId, proveedorId }, select: { id: true, recepcionId: true, recepcionCargoId: true, actorId: true } }),
    db.creditoProveedor.findMany({ where: { negocioId, proveedorId }, select: { id: true, compraReferenciaId: true, egresoCaja: { select: { actorTipo: true, empleadoId: true } } } }),
    db.compra.findMany({ where: { negocioId, proveedorId }, orderBy: { createdAt: "desc" }, take: 300, select: { id: true, numero: true, estado: true, fechaPedido: true, lineas: { orderBy: { orden: "asc" }, select: { productoNombre: true, varianteNombre: true, cantidadPedidaDecimal: true } } } }),
  ])
  const cargoIds = oblExtra.flatMap((o) => (o.recepcionCargoId ? [o.recepcionCargoId] : []))
  const cargos = cargoIds.length ? await db.recepcionCargo.findMany({ where: { id: { in: cargoIds } }, select: { id: true, recepcionId: true, concepto: true } }) : []
  const recIds = [...new Set([...oblExtra.flatMap((o) => (o.recepcionId ? [o.recepcionId] : [])), ...cargos.map((c) => c.recepcionId)])]
  const recepciones = recIds.length ? await db.recepcion.findMany({
    where: { id: { in: recIds }, negocioId },
    select: { id: true, numero: true, compraId: true, fechaRecepcion: true, aprobadaEn: true, comprobanteTipo: true, comprobanteNumero: true, lineas: { orderBy: { orden: "asc" }, select: { productoNombre: true, varianteNombre: true, cantidadAceptadaDecimal: true, costoUnitarioDecimal: true } } },
  }) : []
  const empleadoIds = [...new Set(credExtra.flatMap((c) => (c.egresoCaja?.empleadoId ? [c.egresoCaja.empleadoId] : [])))]
  const empleados = empleadoIds.length ? await db.empleado.findMany({ where: { negocioId, id: { in: empleadoIds } }, select: { id: true, nombre: true } }) : []

  const extraObl = new Map(oblExtra.map((o) => [o.id, o]))
  const extraCred = new Map(credExtra.map((c) => [c.id, c]))
  const recPorId = new Map(recepciones.map((r) => [r.id, r]))
  const cargoPorId = new Map(cargos.map((c) => [c.id, c]))
  const nombreEmpleado = new Map(empleados.map((e) => [e.id, e.nombre]))
  const creditoPorId = new Map(cuenta.creditos.map((c) => [c.id, c]))
  const compraPorId = new Map(compras.map((c) => [c.id, c]))

  const pagoVista = (creditoId: string) => {
    const c = creditoPorId.get(creditoId)
    const ex = extraCred.get(creditoId)
    if (!c) return null
    const responsable = c.origen === "PAGO_CAJA" ? (ex?.egresoCaja?.actorTipo === "EMPLEADO" ? nombreEmpleado.get(ex.egresoCaja.empleadoId ?? "") ?? "Empleado" : "Dueño") : "Dueño"
    const medio = c.origen === "PAGO_CAJA" ? "Efectivo de Caja" : c.origen === "AJUSTE_A_FAVOR" ? "Ajuste a favor" : c.medio === "TRANSFERENCIA" ? "Transferencia" : c.medio === "MERCADO_PAGO" ? "Mercado Pago" : "Otro medio"
    const origenFondos = c.origen === "PAGO_CAJA" ? (c.egresoCaja?.caja ?? "Caja") : c.cuentaOrigenDeclarada ?? null
    const pedido = ex?.compraReferenciaId ? compraPorId.get(ex.compraReferenciaId)?.numero ?? null : null
    return { creditoId, medio, estado: c.estado, importeTotal: c.importe, referencia: c.referencia, fecha: c.fechaPago ?? c.egresoCaja?.createdAt ?? c.createdAt, responsable, origenFondos, pedido }
  }

  const facturas = cuenta.obligaciones.filter((o) => o.estado === "VIGENTE").map((o) => {
    const ex = extraObl.get(o.id)
    const cargo = ex?.recepcionCargoId ? cargoPorId.get(ex.recepcionCargoId) : null
    const rec = ex?.recepcionId ? recPorId.get(ex.recepcionId) : cargo ? recPorId.get(cargo.recepcionId) : null
    const asign = cuenta.asignaciones.filter((a) => a.obligacionId === o.id)
    const pagos = asign.filter((a) => a.vigente).map((a) => ({ asignacionId: a.id, aplicado: a.importe, aplicadoEn: a.createdAt, ...pagoVista(a.creditoId) }))
    const pagado = r2(o.importe - o.pendiente)
    const comprobante = rec && (rec.comprobanteTipo || rec.comprobanteNumero) ? [rec.comprobanteTipo, rec.comprobanteNumero].filter(Boolean).join(" ") : o.comprobante ? [o.comprobante.tipo, o.comprobante.numero].filter(Boolean).join(" ") : null
    return {
      obligacionId: o.id,
      tipo: o.origen,
      titulo: o.origen === "RECEPCION" && rec ? `Recepción N° ${rec.numero}` : o.origen === "CARGO_ACCESORIO" ? `Cargo «${cargo?.concepto ?? ""}»${rec ? ` · Recepción N° ${rec.numero}` : ""}` : o.origen === "SALDO_INICIAL" ? "Saldo inicial" : "Ajuste de deuda",
      comprobante,
      descripcion: o.descripcion,
      fecha: rec?.fechaRecepcion ?? o.fecha,
      compraId: rec?.compraId ?? null,
      recepcion: rec ? { id: rec.id, numero: rec.numero, aprobadaEn: rec.aprobadaEn } : null,
      importe: o.importe, pagado, pendiente: o.pendiente, estado: estadoDe(o.importe, pagado),
      productos: o.origen === "RECEPCION" && rec ? rec.lineas.filter((l) => l.cantidadAceptadaDecimal.gt(0)).map((l) => ({ producto: l.productoNombre, variante: l.varianteNombre, cantidad: Number(l.cantidadAceptadaDecimal.toString()), costoUnitario: l.costoUnitarioDecimal ? Number(l.costoUnitarioDecimal.toString()) : null })) : [],
      pagos,
      // Historial completo (incluye aplicaciones desafectadas), inmutable.
      historial: asign.map((a) => ({ id: a.id, tipo: a.tipo, importe: a.importe, fecha: a.createdAt, vigente: a.vigente, ...pagoVista(a.creditoId) })),
    }
  })

  // Pedidos: agrupan SUS facturas (cada una con su propio saldo) y muestran el anticipo del pedido aparte.
  const anticipoPedido = new Map<string, { disponible: number; programado: number }>()
  for (const c of cuenta.creditos) {
    const compraId = extraCred.get(c.id)?.compraReferenciaId
    if (!compraId) continue
    const a = anticipoPedido.get(compraId) ?? { disponible: 0, programado: 0 }
    if (c.efectivo) a.disponible = r2(a.disponible + c.disponible)
    if (c.estado === "DECLARADO") a.programado = r2(a.programado + c.importe)
    anticipoPedido.set(compraId, a)
  }
  const pedidos = compras
    .map((c) => {
      const fs = facturas.filter((f) => f.compraId === c.id)
      const total = r2(fs.reduce((t, f) => t + f.importe, 0))
      const pagado = r2(fs.reduce((t, f) => t + f.pagado, 0))
      return {
        compraId: c.id, numero: c.numero, fecha: c.fechaPedido, estadoPedido: c.estado,
        productos: c.lineas.map((l) => ({ producto: l.productoNombre, variante: l.varianteNombre, cantidad: Number(l.cantidadPedidaDecimal.toString()) })),
        facturas: fs, total, pagado, pendiente: r2(total - pagado), estado: fs.length ? estadoDe(total, pagado) : "PENDIENTE" as EstadoFactura,
        anticipo: anticipoPedido.get(c.id) ?? { disponible: 0, programado: 0 },
      }
    })
    .filter((p) => p.facturas.length > 0 || p.anticipo.disponible > 0 || p.anticipo.programado > 0)
  const sinPedido = facturas.filter((f) => !f.compraId)

  const credVista = (c: (typeof cuenta.creditos)[number]) => ({ ...pagoVista(c.id)!, importe: c.importe, asignado: c.asignado, disponible: c.disponible })
  // Pagos con dinero disponible y SIN pedido abierto que los reciba (los del pedido abierto se ven en su pedido).
  const sinAsignar = cuenta.creditos.filter((c) => {
    if (!c.efectivo || c.disponible <= 0) return false
    const compraId = extraCred.get(c.id)?.compraReferenciaId
    return !compraId || compraPorId.get(compraId)?.estado !== "ABIERTA"
  }).map(credVista)
  const programadas = cuenta.creditos.filter((c) => c.estado === "DECLARADO").map((c) => ({ ...credVista(c), importe: c.importe }))
  const anticiposPedidosAbiertos = r2([...anticipoPedido.entries()].filter(([id]) => compraPorId.get(id)?.estado === "ABIERTA").reduce((t, [, a]) => t + a.disponible, 0))
  const sinAsignarTotal = r2(sinAsignar.reduce((t, c) => t + c.disponible, 0))

  return {
    resumen: {
      deudaPendiente: cuenta.totales.obligacionesPendientes,
      pagosAplicados: cuenta.totales.creditosAsignados,
      aFavor: r2(sinAsignarTotal + anticiposPedidosAbiertos),
      aFavorGeneral: sinAsignarTotal,
      anticiposPedidos: anticiposPedidosAbiertos,
      programadas: cuenta.totales.pagosDeclaradosPendientes,
    },
    pedidos, sinPedido, otras: facturas.filter((f) => !f.recepcion), sinAsignar, programadas,
  }
}

// ---------- pagar deudas seleccionadas ----------
class AbortoPago extends Error {
  constructor(public resultado: CuentaResult<never>) { super("aborto-pago") }
}
const IMPORTE = /^\d{1,10}(\.\d{1,2})?$/

/** Sólo el DUEÑO. body: { importe, fechaPago, referencia?, nota?, renglones: [{ obligacionId, importe }], confirmoNoDuplicado? } */
export async function pagarDeudasSeleccionadas(
  db: Db,
  input: { negocioId: string; proveedorId: string; body: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ creditoId: string; replayed: boolean }>> {
  const { negocioId, proveedorId } = input
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  const fail = (error: string, code: string) => ({ ok: false as const, status: 400 as const, error, code })
  if (typeof b.importe !== "string" || !IMPORTE.test(b.importe) || !new D(b.importe).gt(0)) return fail("Escribí el importe de la transferencia.", "IMPORTE_INVALIDO")
  const importe = new D(b.importe)
  if (!Array.isArray(b.renglones) || b.renglones.length === 0 || b.renglones.length > 50) return fail("Elegí al menos una deuda e indicá cuánto aplicar.", "RENGLONES_INVALIDOS")
  const renglones: Array<{ obligacionId: string; importe: Prisma.Decimal }> = []
  for (const raw of b.renglones) {
    const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    if (typeof x.obligacionId !== "string" || !x.obligacionId || x.obligacionId.length > 64 || typeof x.importe !== "string" || !IMPORTE.test(x.importe)) return fail("Hay un importe a aplicar inválido.", "RENGLONES_INVALIDOS")
    if (renglones.some((r) => r.obligacionId === x.obligacionId)) return fail("La misma deuda aparece dos veces.", "RENGLONES_INVALIDOS")
    const imp = new D(x.importe)
    if (imp.gt(0)) renglones.push({ obligacionId: x.obligacionId, importe: imp })
  }
  if (!renglones.length) return fail("Indicá cuánto aplicar al menos a una deuda.", "RENGLONES_INVALIDOS")
  const repartido = renglones.reduce((t, r) => t.plus(r.importe), CERO)
  if (repartido.gt(importe)) return fail("Repartís más de lo que pagaste.", "REPARTO_EXCEDE_PAGO")
  const key = input.idempotencyKey
  const reparto = renglones.map((r) => [r.obligacionId, r.importe.toFixed(2)])
  try {
    return await registrarCredito(db, {
      negocioId, proveedorId, idempotencyKey: key, confirmarAlRegistrar: true, extraHuella: ["PAGO_DEUDAS", reparto],
      body: { origen: "PAGO_DECLARADO", medio: "TRANSFERENCIA", importe: importe.toFixed(2), fechaPago: b.fechaPago, referencia: b.referencia, motivo: b.nota, confirmoNoSalioDeCaja: true, confirmoNoDuplicado: b.confirmoNoDuplicado === true },
      // Misma transacción que el pago: si alguna aplicación no entra (saldo, otro proveedor, deuda anulada), no queda NADA.
      alCrearEnTx: async (tx, creditoId) => {
        const res = await operarAsignacionesEnTx(tx, {
          negocioId, proveedorId,
          solicitud: { tipo: "ASIGNAR", desafectar: [], asignar: renglones.map((r) => ({ creditoId, obligacionId: r.obligacionId, importe: r.importe })), motivo: "Pago de deudas seleccionadas" },
          idempotencyKey: `${key}:asignacion`, fingerprint: createHash("sha256").update(JSON.stringify([negocioId, proveedorId, creditoId, reparto])).digest("hex"),
        }, opciones)
        if (!res.ok) throw new AbortoPago(res as CuentaResult<never>)
      },
    }, opciones)
  } catch (error) {
    if (error instanceof AbortoPago) return error.resultado
    throw error
  }
}
