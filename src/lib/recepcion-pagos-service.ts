// ============================================
// F10-C2b / D-7 v2 — pagos en efectivo hechos AL RECIBIR, asociados a su recepción
// ============================================
// El dinero sale UNA vez, por la salida PAGO_PROVEEDOR de F10-C1 (registrarEgresoCaja: turno propio,
// Idempotency-Key, auditoría). En la MISMA transacción de esa salida se escribe la fila pagos_recepcion
// (negocio + recepción + proveedor + salida). Nada se busca por el texto «Recepción N° X».
// La fila no mueve dinero ni deuda. Al aprobar la recepción (compras-recepciones-service), dentro de la
// misma transacción: el pago se vincula como crédito PAGO_CAJA de F5 (si no lo estaba) y se aplica a la
// deuda de esa recepción hasta lo adeudado; el excedente queda como anticipo. El dueño puede «observar»
// un pago (deja de aplicarse solo; la salida de Caja no se toca). Asignar a mano queda para casos
// especiales (pagos anteriores, sin recepción, varias facturas, correcciones).

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { runSerializable } from "@/lib/caja-devoluciones-service"
import { parseEgresoBody, type EgresoSolicitud } from "@/lib/caja-egresos-service"
import { anticiposDisponibles, vincularPagoCajaEnTx, type AuditoriaEnTx } from "@/lib/cuenta-proveedor-service"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
type Dec = Prisma.Decimal
const D = Prisma.Decimal
const CERO = new D(0)
type Fallo = { ok: false; status: 400 | 403 | 404 | 409; error: string; code: string; detalle?: Record<string, unknown> }
type Resultado<T> = { ok: true; value: T } | Fallo
const fail = (status: Fallo["status"], error: string, code: string, detalle?: Record<string, unknown>): Fallo => ({ ok: false, status, error, code, ...(detalle ? { detalle } : {}) })
const huella = (partes: unknown[]) => createHash("sha256").update(JSON.stringify(partes)).digest("hex")
export type AuditoriaPagoRecepcion = (tx: Tx, e: { accion: string; recurso: string; recursoId: string; detalle: Record<string, unknown> }) => Promise<void>

/** Error de dominio lanzado DENTRO de la transacción de la salida de Caja: la revierte entera. */
export class PagoRecepcionError extends Error {
  constructor(readonly resultado: Fallo) {
    super(resultado.error)
  }
}

export const referenciaPagoRecepcion = (numero: number) => `Recepción N° ${numero}`

// ---------------------------------------------------------------------------
// Cajero: pagar al recibir
// ---------------------------------------------------------------------------

/** Valida la recepción (del cajero, abierta) y arma la salida PAGO_PROVEEDOR canónica de F10-C1. */
export async function prepararPagoAlRecibir(db: Db, input: { negocioId: string; empleadoId: string; recepcionId: string; body: unknown }): Promise<Resultado<{ solicitud: EgresoSolicitud; recepcion: { id: string; numero: number; proveedorId: string } }>> {
  const r = await db.recepcion.findFirst({
    where: { id: input.recepcionId, negocioId: input.negocioId, preparadaPorTipo: "EMPLEADO", preparadaPorEmpleadoId: input.empleadoId },
    select: { id: true, numero: true, estado: true, proveedorId: true, comprobanteTipo: true, comprobanteNumero: true, proveedor: { select: { nombre: true, cuit: true } } },
  })
  if (!r) return fail(404, "Recepción no encontrada.", "RECEPCION_NO_ENCONTRADA")
  if (r.estado !== "BORRADOR" && r.estado !== "PENDIENTE_APROBACION") return fail(409, "La recepción ya está cerrada: el pago se registra desde Salidas y lo resuelve el dueño.", "RECEPCION_CERRADA")
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  const comprobante = [r.comprobanteTipo, r.comprobanteNumero].filter(Boolean).join(" ")
  const parsed = parseEgresoBody({
    naturaleza: "PAGO_PROVEEDOR",
    importe: b.importe,
    motivo: `Pago de mercadería al recibir — ${referenciaPagoRecepcion(r.numero)}`,
    proveedorNombre: r.proveedor.nombre,
    ...(r.proveedor.cuit ? { proveedorIdentificacion: r.proveedor.cuit } : {}),
    comprobanteReferencia: comprobante ? `${referenciaPagoRecepcion(r.numero)} · ${comprobante}`.slice(0, 120) : referenciaPagoRecepcion(r.numero),
  }, "EMPLEADO")
  if (!parsed.ok) return fail(parsed.status === 400 ? 400 : 409, parsed.error, parsed.code ?? "PAGO_INVALIDO")
  return { ok: true, value: { solicitud: parsed.value, recepcion: { id: r.id, numero: r.numero, proveedorId: r.proveedorId } } }
}

/** Dentro de la transacción de la salida: candado de la recepción, sigue abierta, se asocia el pago. */
export async function asociarPagoEnTx(tx: Tx, input: { negocioId: string; recepcionId: string; proveedorId: string; egresoCajaId: string; origen: "CAJERO_AL_RECIBIR" | "ASOCIADO_DUENO"; actorTipo: "NEGOCIO" | "EMPLEADO"; actorId: string }) {
  const filas = await tx.$queryRaw<Array<{ estado: string; proveedorId: string }>>`SELECT "estado", "proveedorId" FROM "recepciones" WHERE "id" = ${input.recepcionId} AND "negocioId" = ${input.negocioId} FOR UPDATE`
  const r = filas[0]
  if (!r) throw new PagoRecepcionError(fail(404, "Recepción no encontrada.", "RECEPCION_NO_ENCONTRADA"))
  if (r.estado !== "BORRADOR" && r.estado !== "PENDIENTE_APROBACION") throw new PagoRecepcionError(fail(409, "La recepción se cerró mientras registrabas el pago: no se registró nada. Volvé a abrirla.", "RECEPCION_CERRADA"))
  if (r.proveedorId !== input.proveedorId) throw new PagoRecepcionError(fail(409, "El proveedor de la recepción cambió.", "PROVEEDOR_DISTINTO"))
  return tx.pagoRecepcion.create({ data: { negocioId: input.negocioId, recepcionId: input.recepcionId, proveedorId: input.proveedorId, egresoCajaId: input.egresoCajaId, origen: input.origen, actorTipo: input.actorTipo, actorId: input.actorId }, select: { id: true } })
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export type EstadoAplicacion = "SE_APLICA" | "OBSERVADO" | "ANULADO_EN_CAJA" | "DE_OTRO_PROVEEDOR" | "SIN_DISPONIBLE" | "ACREDITADO"

/** Pagos asociados a una recepción, con su origen en Caja (cajero, fecha, caja, turno) y si se aplican solos. */
export async function pagosDeRecepcion(db: Db | Tx, negocioId: string, recepcionId: string, proveedorId: string) {
  const filas = await db.pagoRecepcion.findMany({
    where: { negocioId, recepcionId },
    orderBy: { createdAt: "asc" },
    include: {
      egreso: {
        select: {
          id: true, importeDecimal: true, createdAt: true, turnoCajaId: true, empleadoId: true, actorTipo: true, motivo: true, comprobanteReferencia: true,
          turno: { select: { abiertoEn: true, cajaFisica: { select: { nombre: true } } } },
          compensacion: { select: { id: true } },
          creditosProveedor: { where: { origen: "PAGO_CAJA", estado: "VIGENTE" }, select: { id: true, proveedorId: true, importeDecimal: true } },
        },
      },
    },
  })
  const empleados = [...new Set(filas.map((f) => f.egreso.empleadoId).filter((x): x is string => Boolean(x)))]
  const nombres = new Map((empleados.length ? await db.empleado.findMany({ where: { negocioId, id: { in: empleados } }, select: { id: true, nombre: true } }) : []).map((e) => [e.id, e.nombre]))
  // Disponible de cada crédito ya existente (un pago ya vinculado puede estar usado en parte): motor de F5.
  const disponibles = filas.some((f) => f.egreso.creditosProveedor.length)
    ? new Map((await anticiposDisponibles(db, negocioId, proveedorId)).map((c) => [c.id, c.disponible]))
    : new Map<string, Dec>()
  return filas.map((f) => {
    const credito = f.egreso.creditosProveedor[0] ?? null
    const importe = f.egreso.importeDecimal
    const disponible = credito ? disponibles.get(credito.id) ?? CERO : importe
    const estado: EstadoAplicacion =
      f.estado === "ACREDITADO" ? "ACREDITADO"
        : f.estado === "OBSERVADO" ? "OBSERVADO"
          : f.egreso.compensacion ? "ANULADO_EN_CAJA"
            : credito && credito.proveedorId !== proveedorId ? "DE_OTRO_PROVEEDOR"
              : disponible.lte(0) ? "SIN_DISPONIBLE"
                : "SE_APLICA"
    return {
      id: f.id, egresoCajaId: f.egresoCajaId, origen: f.origen, estadoVinculo: f.estado, estado, observacion: f.observacion,
      importe, disponible: D.max(disponible, CERO), creditoId: credito?.id ?? f.creditoProveedorId, importeAplicado: f.importeAplicadoDecimal,
      fecha: f.egreso.createdAt, cajero: f.egreso.empleadoId ? nombres.get(f.egreso.empleadoId) ?? "Empleado" : "Dueño",
      caja: f.egreso.turno?.cajaFisica?.nombre ?? null, turnoCajaId: f.egreso.turnoCajaId, turnoAbiertoEn: f.egreso.turno?.abiertoEn ?? null,
    }
  })
}

/** Totales para el dueño: mercadería, pagado, lo que se aplica solo, saldo pendiente y anticipo que queda. */
export function resumenPagos(totalMercaderia: Dec, pagos: Awaited<ReturnType<typeof pagosDeRecepcion>>) {
  const vigentes = pagos.filter((p) => p.estado === "SE_APLICA" || p.estado === "ACREDITADO")
  const pagado = vigentes.reduce((s, p) => s.plus(p.importe), CERO)
  const aplicable = pagos.filter((p) => p.estado === "SE_APLICA").reduce((s, p) => s.plus(p.disponible), CERO)
  const seAplica = D.min(aplicable, totalMercaderia)
  return { totalMercaderia, pagado, seAplica, saldoPendiente: D.max(totalMercaderia.minus(seAplica), CERO), anticipo: D.max(aplicable.minus(totalMercaderia), CERO) }
}

/**
 * Pagos de Caja registrados ANTES de esta versión (sólo con el texto de la referencia): se ofrecen al dueño
 * para asociarlos con un toque (no mueve dinero). Mismo proveedor por nombre, no compensados, sin asociar.
 */
export async function pagosSugeridos(db: Db, negocioId: string, recepcion: { id: string; numero: number; proveedorNombre: string }) {
  const ref = referenciaPagoRecepcion(recepcion.numero)
  const filas = await db.egresoCaja.findMany({
    where: { negocioId, naturaleza: "PAGO_PROVEEDOR", comprobanteReferencia: { startsWith: ref }, compensacion: { is: null }, pagoRecepcion: { none: {} } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, importeDecimal: true, createdAt: true, proveedorNombre: true, comprobanteReferencia: true, empleadoId: true, turno: { select: { cajaFisica: { select: { nombre: true } } } } },
  })
  const exacta = (t: string | null) => t === ref || (t ?? "").startsWith(`${ref} · `)
  return filas.filter((f) => exacta(f.comprobanteReferencia)).map((f) => ({ egresoCajaId: f.id, importe: f.importeDecimal, fecha: f.createdAt, proveedorNombre: f.proveedorNombre, caja: f.turno?.cajaFisica?.nombre ?? null, mismoProveedor: (f.proveedorNombre ?? "").trim().toLowerCase() === recepcion.proveedorNombre.trim().toLowerCase() }))
}

// ---------------------------------------------------------------------------
// Dueño: asociar un pago existente, observarlo o volver a incluirlo (nunca mueve dinero)
// ---------------------------------------------------------------------------

export async function asociarPagoExistente(db: Db, input: { negocioId: string; recepcionId: string; egresoCajaId: unknown }, opciones: { auditar?: AuditoriaPagoRecepcion } = {}): Promise<Resultado<{ pagoId: string; replayed: boolean }>> {
  const { negocioId, recepcionId } = input
  if (typeof input.egresoCajaId !== "string" || !input.egresoCajaId) return fail(400, "Elegí el pago de Caja.", "EGRESO_INVALIDO")
  const egresoCajaId = input.egresoCajaId
  try {
    return await runSerializable(db, async (tx) => {
      const previo = await tx.pagoRecepcion.findUnique({ where: { negocioId_egresoCajaId: { negocioId, egresoCajaId } }, select: { id: true, recepcionId: true } })
      if (previo) return previo.recepcionId === recepcionId ? { ok: true as const, value: { pagoId: previo.id, replayed: true } } : fail(409, "Ese pago ya está asociado a otra recepción.", "PAGO_DE_OTRA_RECEPCION")
      const r = await tx.recepcion.findFirst({ where: { id: recepcionId, negocioId }, select: { proveedorId: true } })
      if (!r) return fail(404, "Recepción no encontrada.", "RECEPCION_NO_ENCONTRADA")
      const e = await tx.egresoCaja.findFirst({ where: { id: egresoCajaId, negocioId }, select: { naturaleza: true, compensacion: { select: { id: true } }, creditosProveedor: { where: { origen: "PAGO_CAJA", estado: "VIGENTE" }, select: { proveedorId: true } } } })
      if (!e || e.naturaleza !== "PAGO_PROVEEDOR") return fail(404, "Pago de Caja no encontrado.", "EGRESO_NO_ENCONTRADO")
      if (e.compensacion) return fail(409, "Ese pago de Caja fue anulado (compensado).", "EGRESO_COMPENSADO")
      if (e.creditosProveedor.some((c) => c.proveedorId !== r.proveedorId)) return fail(409, "Ese pago ya está vinculado a otro proveedor.", "PAGO_DE_OTRO_PROVEEDOR")
      const p = await asociarPagoEnTx(tx, { negocioId, recepcionId, proveedorId: r.proveedorId, egresoCajaId, origen: "ASOCIADO_DUENO", actorTipo: "NEGOCIO", actorId: negocioId })
      if (opciones.auditar) await opciones.auditar(tx, { accion: "recepcion.pago_asociado", recurso: "recepcion", recursoId: recepcionId, detalle: { negocioId, recepcionId, pagoRecepcionId: p.id, egresoCajaId } })
      return { ok: true as const, value: { pagoId: p.id, replayed: false } }
    })
  } catch (error) {
    if (error instanceof PagoRecepcionError) return error.resultado
    throw error
  }
}

export async function cambiarEstadoPago(db: Db, input: { negocioId: string; recepcionId: string; pagoId: string; accion: unknown; motivo: unknown }, opciones: { auditar?: AuditoriaPagoRecepcion } = {}): Promise<Resultado<{ estado: string }>> {
  const { negocioId, recepcionId, pagoId } = input
  if (input.accion !== "observar" && input.accion !== "incluir") return fail(400, "Acción inválida.", "ACCION_INVALIDA")
  const motivo = typeof input.motivo === "string" ? input.motivo.trim().slice(0, 500) : ""
  if (input.accion === "observar" && !motivo) return fail(400, "Escribí qué tiene de raro este pago.", "MOTIVO_REQUERIDO")
  return runSerializable(db, async (tx) => {
    const filas = await tx.$queryRaw<Array<{ estado: string }>>`SELECT "estado" FROM "recepciones" WHERE "id" = ${recepcionId} AND "negocioId" = ${negocioId} FOR UPDATE`
    if (!filas[0]) return fail(404, "Recepción no encontrada.", "RECEPCION_NO_ENCONTRADA")
    const p = await tx.pagoRecepcion.findFirst({ where: { id: pagoId, negocioId, recepcionId }, select: { estado: true } })
    if (!p) return fail(404, "Pago no encontrado.", "PAGO_NO_ENCONTRADO")
    if (p.estado === "ACREDITADO") return fail(409, "Ese pago ya se aplicó al aprobar: corregilo desde la cuenta del proveedor.", "PAGO_YA_ACREDITADO")
    const destino = input.accion === "observar" ? "OBSERVADO" : "PENDIENTE"
    if (p.estado === destino) return { ok: true as const, value: { estado: destino } }
    await tx.pagoRecepcion.update({ where: { id: pagoId }, data: { estado: destino, observacion: destino === "OBSERVADO" ? motivo : null } })
    if (opciones.auditar) await opciones.auditar(tx, { accion: destino === "OBSERVADO" ? "recepcion.pago_observado" : "recepcion.pago_incluido", recurso: "recepcion", recursoId: recepcionId, detalle: { negocioId, recepcionId, pagoRecepcionId: pagoId, motivo: motivo || null } })
    return { ok: true as const, value: { estado: destino } }
  })
}

// ---------------------------------------------------------------------------
// Aprobación: vincular (si hace falta) y planificar la aplicación — SIEMPRE dentro de la transacción de la aprobación
// ---------------------------------------------------------------------------

/** Candados de caja → salida de cada pago, ANTES de los proveedores (mismo orden que F5 y la compensación de F10-C1). */
export async function bloquearPagosEnTx(tx: Tx, negocioId: string, recepcionId: string) {
  const filas = await tx.$queryRaw<Array<{ egresoCajaId: string; cajaFisicaId: string }>>`
    SELECT p."egresoCajaId", e."cajaFisicaId" FROM "pagos_recepcion" p JOIN "egresos_caja" e ON e."id" = p."egresoCajaId"
    WHERE p."recepcionId" = ${recepcionId} AND p."negocioId" = ${negocioId} AND p."estado" = 'PENDIENTE' ORDER BY e."cajaFisicaId", p."egresoCajaId"`
  for (const c of [...new Set(filas.map((f) => f.cajaFisicaId))]) await tx.$queryRaw`SELECT "id" FROM "cajas_fisicas" WHERE "id" = ${c} AND "negocioId" = ${negocioId} FOR UPDATE`
  for (const f of filas) await tx.$queryRaw`SELECT "id" FROM "egresos_caja" WHERE "id" = ${f.egresoCajaId} AND "negocioId" = ${negocioId} FOR UPDATE`
  await tx.$queryRaw`SELECT "id" FROM "pagos_recepcion" WHERE "recepcionId" = ${recepcionId} AND "negocioId" = ${negocioId} FOR UPDATE`
}

/**
 * Vincula como crédito PAGO_CAJA de F5 los pagos que se aplican (si no lo estaban) y devuelve qué aplicar
 * de cada uno, hasta `tope` (lo adeudado). Lo que sobra queda disponible en el crédito: anticipo.
 */
export async function planificarPagosEnTx(
  tx: Tx,
  input: { negocioId: string; recepcionId: string; proveedorId: string; tope: Dec; clave: string; confirmoNoDuplicado: boolean },
  opciones: { auditarCuenta?: AuditoriaEnTx } = {}
): Promise<Resultado<{ plan: Array<{ pagoId: string; creditoId: string; importe: Dec }>; acreditados: Array<{ pagoId: string; creditoId: string }> }>> {
  const pagos = await pagosDeRecepcion(tx, input.negocioId, input.recepcionId, input.proveedorId)
  let restante = input.tope
  const plan: Array<{ pagoId: string; creditoId: string; importe: Dec }> = []
  const acreditados: Array<{ pagoId: string; creditoId: string }> = []
  for (const p of pagos) {
    if (p.estado !== "SE_APLICA") continue
    let creditoId = p.creditoId
    if (!creditoId) {
      const v = await vincularPagoCajaEnTx(tx, {
        negocioId: input.negocioId, proveedorId: input.proveedorId, egresoCajaId: p.egresoCajaId,
        idempotencyKey: `${input.clave}:pago:${p.id}`, fingerprint: huella([input.negocioId, input.proveedorId, "PAGO_CAJA", p.egresoCajaId]), confirmoNoDuplicado: input.confirmoNoDuplicado,
      }, { auditar: opciones.auditarCuenta })
      if (!v.ok) return fail(v.status as Fallo["status"], v.error, v.code ?? "PAGO_NO_VINCULABLE", { ...(v.detalle ?? {}), pagoRecepcionId: p.id })
      creditoId = v.value.creditoId
    }
    acreditados.push({ pagoId: p.id, creditoId })
    const importe = D.min(p.disponible, restante)
    if (importe.gt(0)) {
      plan.push({ pagoId: p.id, creditoId, importe })
      restante = restante.minus(importe)
    }
  }
  return { ok: true, value: { plan, acreditados } }
}

/** Después de asignar: los pagos quedan ACREDITADOS (finales) con lo aplicado a esta recepción. */
export async function marcarAcreditadosEnTx(tx: Tx, acreditados: Array<{ pagoId: string; creditoId: string }>, plan: Array<{ pagoId: string; importe: Dec }>) {
  for (const a of acreditados) {
    const aplicado = plan.filter((x) => x.pagoId === a.pagoId).reduce((s, x) => s.plus(x.importe), CERO)
    await tx.pagoRecepcion.update({ where: { id: a.pagoId }, data: { estado: "ACREDITADO", creditoProveedorId: a.creditoId, importeAplicadoDecimal: aplicado } })
  }
}
