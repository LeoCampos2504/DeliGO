// ============================================
// Rediseño de pagos — ETAPA 3: anticipo en EFECTIVO desde Caja para un pedido (dueño y empleado autorizado)
// ============================================
// El dinero sale UNA vez por F10-C1 (salida PAGO_PROVEEDOR: turno abierto, caja válida, idempotencia, auditoría; el
// dueño elige la caja con turno abierto y justifica si el efectivo esperado queda negativo, exactamente como en
// «Egresos»). En la MISMA transacción la salida se vincula al proveedor como crédito F5 PAGO_CAJA ligado al pedido
// (compraReferenciaId): al aprobar las recepciones de ese pedido se aplica solo, igual que una transferencia
// anticipada. Sin turno válido no hay salida (F10-C1 lo rechaza). El empleado necesita el permiso individual
// (deshabilitado por defecto) y respeta su límite por operación y por día (controlado dentro de la transacción, con
// la caja bloqueada). Nunca toca pagos existentes.

import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { auditLogWithClient } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { parseEgresoBody, registrarEgresoCaja } from "@/lib/caja-egresos-service"
import { detalleAuditoriaEgreso } from "@/lib/caja-egresos-http"
import { vincularPagoCajaEnTx } from "@/lib/cuenta-proveedor-service"
import { deudaAprobadaPendienteDePedido, mensajeDeudaAprobada } from "@/lib/pagos-pedido-service"

const NO_STORE = { "Cache-Control": "private, no-store" }
type Fallo = { status: number; error: string; code?: string; detalle?: Record<string, unknown> }
const failure = (r: Fallo) => NextResponse.json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}), ...(r.detalle ? { detalle: r.detalle } : {}) }, { status: r.status, headers: NO_STORE })
class AnticipoError extends Error { constructor(public resultado: Fallo) { super("anticipo") } }
type Actor = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }
const D = Prisma.Decimal

/** Inicio del día en Argentina (UTC−3) para el límite diario del empleado. */
function inicioDiaAR(ahora = new Date()) {
  const ar = new Date(ahora.getTime() - 3 * 3600_000)
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()) + 3 * 3600_000)
}

/** Lo que el empleado ya entregó HOY como anticipos de pedidos (salidas de Caja vinculadas a un pedido). */
async function usadoHoy(client: Pick<typeof db, "creditoProveedor">, negocioId: string, empleadoId: string) {
  const filas = await client.creditoProveedor.findMany({
    where: { negocioId, origen: "PAGO_CAJA", compraReferenciaId: { not: null }, egresoCaja: { empleadoId, createdAt: { gte: inicioDiaAR() } } },
    select: { importeDecimal: true },
  })
  return filas.reduce((t, f) => t.plus(f.importeDecimal), new D(0))
}

export async function permisoAnticipoEmpleado(negocioId: string, empleadoId: string) {
  const e = await db.empleado.findFirst({ where: { id: empleadoId, negocioId, activo: true, eliminado: false }, select: { anticipoProveedorHabilitado: true, anticipoProveedorLimiteOperacionDecimal: true, anticipoProveedorLimiteDiarioDecimal: true } })
  const habilitado = Boolean(e?.anticipoProveedorHabilitado && e.anticipoProveedorLimiteOperacionDecimal && e.anticipoProveedorLimiteDiarioDecimal)
  if (!habilitado || !e) return { habilitado: false as const }
  return { habilitado: true as const, limiteOperacion: Number(e.anticipoProveedorLimiteOperacionDecimal!.toFixed(2)), limiteDiario: Number(e.anticipoProveedorLimiteDiarioDecimal!.toFixed(2)), usadoHoy: Number((await usadoHoy(db, negocioId, empleadoId)).toFixed(2)) }
}

export async function registrarAnticipoEfectivoHttp(req: NextRequest, negocioId: string, actor: Actor, compraId: string) {
  const raw = req.headers.get("idempotency-key")?.trim() ?? ""
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
  return registrarAnticipoEfectivo(db, { negocioId, actor, compraId, body: b, idempotencyKey: raw })
}

/** Núcleo (el cliente de base se recibe: la ruta usa `db`). */
export async function registrarAnticipoEfectivo(client: typeof db, input: { negocioId: string; actor: Actor; compraId: string; body: Record<string, unknown>; idempotencyKey: string }) {
  const { negocioId, actor, compraId, body: b } = input
  try {
    if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return failure({ status: 400, error: "Falta una Idempotency-Key válida.", code: "IDEMPOTENCY_KEY_REQUIRED" })
    const key = input.idempotencyKey.toLowerCase()
    const compra = await client.compra.findFirst({ where: { id: compraId, negocioId }, select: { numero: true, estado: true, proveedorId: true, proveedor: { select: { nombre: true, cuit: true } } } })
    if (!compra) return failure({ status: 404, error: "Pedido no encontrado.", code: "COMPRA_NO_ENCONTRADA" })
    if (compra.estado !== "ABIERTA") return failure({ status: 409, error: "El pedido ya está cerrado o anulado: no admite anticipos.", code: "COMPRA_NO_ABIERTA" })
    const deuda = await deudaAprobadaPendienteDePedido(client, negocioId, compraId)
    if (deuda.gt(0)) return failure({ status: 409, error: mensajeDeudaAprobada(deuda, actor.tipo === "EMPLEADO"), code: "PEDIDO_CON_DEUDA_APROBADA" })
    let limites: { operacion: Prisma.Decimal; diario: Prisma.Decimal } | null = null
    if (actor.tipo === "EMPLEADO") {
      const e = await client.empleado.findFirst({ where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false }, select: { anticipoProveedorHabilitado: true, anticipoProveedorLimiteOperacionDecimal: true, anticipoProveedorLimiteDiarioDecimal: true } })
      if (!e?.anticipoProveedorHabilitado || !e.anticipoProveedorLimiteOperacionDecimal || !e.anticipoProveedorLimiteDiarioDecimal) {
        return failure({ status: 403, error: "No tenés permiso para registrar anticipos a proveedores. Pedíselo al dueño.", code: "ANTICIPO_NO_PERMITIDO" })
      }
      limites = { operacion: e.anticipoProveedorLimiteOperacionDecimal, diario: e.anticipoProveedorLimiteDiarioDecimal }
    }
    const solicitud = parseEgresoBody({
      naturaleza: "PAGO_PROVEEDOR", importe: b.importe,
      motivo: `Anticipo en efectivo del pedido N° ${compra.numero}`,
      proveedorNombre: compra.proveedor.nombre, ...(compra.proveedor.cuit ? { proveedorIdentificacion: compra.proveedor.cuit } : {}),
      comprobanteReferencia: `Pedido N° ${compra.numero}`,
      ...(actor.tipo === "NEGOCIO" ? { cajaFisicaId: b.cajaFisicaId ?? null, turnoCajaId: b.turnoCajaId ?? null, justificacion: b.justificacion ?? null } : {}),
    }, actor.tipo)
    if (!solicitud.ok) return failure(solicitud)
    if (limites && solicitud.value.importe.gt(limites.operacion)) {
      return failure({ status: 409, error: `Supera tu límite por operación (${limites.operacion.toFixed(2)}).`, code: "LIMITE_OPERACION" })
    }
    const usuario = actor.tipo === "NEGOCIO" ? { userId: negocioId, userType: "negocio" } : { userId: actor.empleadoId, userType: "empleado" }
    const result = await registrarEgresoCaja(client, { negocioId, actor, solicitud: solicitud.value, idempotencyKey: key }, {
      // DENTRO de la transacción de la salida (sólo una salida nueva): límite diario, vínculo al pedido y auditoría.
      auditar: async (tx, egreso) => {
        if (actor.tipo === "EMPLEADO" && limites) {
          const hoy = (await usadoHoy(tx, negocioId, actor.empleadoId)).plus(egreso.importeDecimal)
          if (hoy.gt(limites.diario)) throw new AnticipoError({ status: 409, error: `Supera tu límite diario de anticipos (${limites.diario.toFixed(2)}).`, code: "LIMITE_DIARIO" })
        }
        const movimientos = await tx.movimientoFinanciero.findMany({ where: { operacionId: egreso.operacionId }, select: { cuentaId: true, importeDecimal: true, cuenta: { select: { clave: true, cajaFisicaId: true } } } })
        await auditLogWithClient(tx, { ...usuario, accion: "caja.egreso_registrado", recurso: "egreso_caja", recursoId: egreso.id, detalle: detalleAuditoriaEgreso(negocioId, egreso, movimientos.map((m) => ({ cuentaFinancieraId: m.cuentaId, clave: m.cuenta.clave, cajaFisicaId: m.cuenta.cajaFisicaId, importe: m.importeDecimal?.toFixed(2) ?? null }))) })
        const v = await vincularPagoCajaEnTx(tx, {
          negocioId, proveedorId: compra.proveedorId, egresoCajaId: egreso.id, compraReferenciaId: compraId,
          idempotencyKey: `${key}:anticipo-pedido`, fingerprint: createHash("sha256").update(JSON.stringify([negocioId, compra.proveedorId, "PAGO_CAJA", egreso.id, compraId])).digest("hex"),
          confirmoNoDuplicado: b.confirmoNoDuplicado === true,
        }, { auditar: async (t, e) => { await auditLogWithClient(t, { ...usuario, accion: e.accion, recurso: "cuenta_proveedor", recursoId: e.recursoId, detalle: e.detalle }) } })
        if (!v.ok) throw new AnticipoError(v)
        await auditLogWithClient(tx, { ...usuario, accion: "compra.anticipo_efectivo", recurso: "compra", recursoId: compraId, detalle: { negocioId, compraId, numero: compra.numero, egresoCajaId: egreso.id, creditoId: v.value.creditoId, importe: egreso.importeDecimal.toFixed(2) } })
      },
    })
    if (!result.ok) return failure(result)
    const { egreso, replayed } = result.value
    return NextResponse.json({ ok: true, replayed, anticipo: { egresoId: egreso.id, importe: egreso.importeDecimal.toFixed(2), fecha: egreso.createdAt } }, { status: replayed ? 200 : 201, headers: NO_STORE })
  } catch (error) {
    if (error instanceof AnticipoError) return failure(error.resultado)
    console.error("[Pagos E3] anticipo en efectivo", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudo completar la operación. Probá de nuevo." }, { status: 500, headers: NO_STORE })
  }
}

// ---------- permisos (sólo dueño) ----------
export async function listarPermisosAnticipoHttp(negocioId: string) {
  const empleados = await db.empleado.findMany({ where: { negocioId, activo: true, eliminado: false }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, anticipoProveedorHabilitado: true, anticipoProveedorLimiteOperacionDecimal: true, anticipoProveedorLimiteDiarioDecimal: true } })
  return NextResponse.json({ ok: true, empleados: empleados.map((e) => ({ id: e.id, nombre: e.nombre, habilitado: e.anticipoProveedorHabilitado, limiteOperacion: e.anticipoProveedorLimiteOperacionDecimal?.toFixed(2) ?? null, limiteDiario: e.anticipoProveedorLimiteDiarioDecimal?.toFixed(2) ?? null })) }, { headers: NO_STORE })
}

const IMPORTE = /^\d{1,10}(\.\d{1,2})?$/
export async function guardarPermisoAnticipoHttp(req: NextRequest, negocioId: string) {
  try {
    const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    if (typeof b.empleadoId !== "string" || typeof b.habilitado !== "boolean") return failure({ status: 400, error: "Solicitud inválida.", code: "SOLICITUD_INVALIDA" })
    const lim = (v: unknown) => (v === null || v === undefined || v === "" ? null : typeof v === "string" && IMPORTE.test(v) && new D(v).gt(0) ? new D(v) : undefined)
    const op = lim(b.limiteOperacion), dia = lim(b.limiteDiario)
    if (op === undefined || dia === undefined) return failure({ status: 400, error: "Los límites deben ser importes mayores a cero.", code: "LIMITE_INVALIDO" })
    if (b.habilitado && (!op || !dia)) return failure({ status: 400, error: "Para habilitar anticipos definí el límite por operación y el diario.", code: "LIMITES_REQUERIDOS" })
    if (op && dia && op.gt(dia)) return failure({ status: 400, error: "El límite por operación no puede superar el diario.", code: "LIMITE_INVALIDO" })
    const r = await db.$transaction(async (tx) => {
      const e = await tx.empleado.findFirst({ where: { id: b.empleadoId as string, negocioId, eliminado: false }, select: { id: true, anticipoProveedorHabilitado: true, anticipoProveedorLimiteOperacionDecimal: true, anticipoProveedorLimiteDiarioDecimal: true } })
      if (!e) return null
      await tx.empleado.update({ where: { id: e.id }, data: { anticipoProveedorHabilitado: b.habilitado as boolean, anticipoProveedorLimiteOperacionDecimal: op, anticipoProveedorLimiteDiarioDecimal: dia } })
      await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: "empleado.permiso_anticipo_proveedor", recurso: "empleado", recursoId: e.id, detalle: { negocioId, empleadoId: e.id, antes: { habilitado: e.anticipoProveedorHabilitado, limiteOperacion: e.anticipoProveedorLimiteOperacionDecimal?.toFixed(2) ?? null, limiteDiario: e.anticipoProveedorLimiteDiarioDecimal?.toFixed(2) ?? null }, despues: { habilitado: b.habilitado, limiteOperacion: op?.toFixed(2) ?? null, limiteDiario: dia?.toFixed(2) ?? null } } })
      return e.id
    })
    if (!r) return failure({ status: 404, error: "Empleado no encontrado.", code: "EMPLEADO_NO_ENCONTRADO" })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (error) {
    console.error("[Pagos E3] permiso de anticipo", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudo guardar." }, { status: 500, headers: NO_STORE })
  }
}
