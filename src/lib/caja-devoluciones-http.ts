// ============================================
// F4-A — HTTP glue shared by the owner and cashier return routes
// ============================================
// Each route authenticates first (owner session or personal cashier session)
// and passes the negocio + actor it DERIVED from that session; nothing in the
// body or URL can choose them. These helpers only parse, delegate to the single
// writer (caja-devoluciones-service.ts), audit and shape the response.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLogWithClient } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import type { CajaActor } from "@/lib/caja-turnos-service"
import {
  detalleVentaConDevoluciones,
  devolucionParaRespuesta,
  importeReintegrableDevolucion,
  lineasDevueltasConPrecioHeredado,
  listarVentasConDevoluciones,
  parseDevolucionBody,
  parseFiltroHistorial,
  registrarDevolucionVenta,
  registrarReintegroDevolucion,
  type DevolucionConItems,
} from "@/lib/caja-devoluciones-service"

// ---------------------------------------------------------------------------
// Audit of a refund paid later (venta.devolucion_reintegro_registrado)
// ---------------------------------------------------------------------------
// `importe` keeps the meaning it has had since F4-A: the COMMERCIAL value of
// the return (for every F4-A return it equals the money, nothing is
// compensated). Since F4-C an exchange compensates part of that value against
// the new products, so detalleVersion 2 adds — never replaces — the three exact
// amounts (returned / compensated / actually refunded) and the financial
// account the money left from. Describes what was registered; changes nothing.

export type CuentaReintegroAuditoria =
  | { evidencia: "SIN_MOVIMIENTO" } // not cash: DeliGO only records that it was refunded by that method
  | { evidencia: "VERIFICADA"; movimientos: Array<{ cuentaFinancieraId: string; clave: string; cajaFisicaId: string | null; importe: string }> }
  | { evidencia: "NO_DISPONIBLE" } // the account read failed: the audit is still written

export function detalleAuditoriaReintegro(negocioId: string, devolucion: DevolucionConItems, cuenta: CuentaReintegroAuditoria) {
  const reintegrado = importeReintegrableDevolucion({ importeDevuelto: devolucion.importeDecimal, importeCompensado: devolucion.importeCompensadoDecimal })
  return {
    negocioId,
    devolucionId: devolucion.id,
    importe: devolucion.importeDecimal.toString(), // historical field: commercial value returned (unchanged meaning)
    detalleVersion: 2,
    importeDevuelto: devolucion.importeDecimal.toFixed(2),
    importeCompensado: devolucion.importeCompensadoDecimal.toFixed(2),
    importeReintegrado: reintegrado.toFixed(2), // money actually handed back
    cambioId: devolucion.cambio?.id ?? null,
    reintegroMedio: devolucion.reintegroMedio,
    reintegroTurnoCajaId: devolucion.reintegroTurnoCajaId,
    reintegroOperacionId: devolucion.reintegroOperacionId,
    cuentaFinanciera: cuenta,
  }
}

async function movimientosDelReintegro(client: Pick<typeof db, "movimientoFinanciero">, operacionId: string) {
  const movimientos = await client.movimientoFinanciero.findMany({
    where: { operacionId },
    select: { cuentaId: true, importe: true, importeDecimal: true, cuenta: { select: { clave: true, cajaFisicaId: true } } },
    orderBy: { createdAt: "asc" },
  })
  return movimientos.map((m) => ({
    cuentaFinancieraId: m.cuentaId,
    clave: m.cuenta.clave,
    cajaFisicaId: m.cuenta.cajaFisicaId,
    importe: m.importeDecimal ? m.importeDecimal.toFixed(2) : m.importe.toFixed(2), // exact; Float only for pre-F10-B2.0 rows
  }))
}

type Vista = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }
const vistaDe = (actor: CajaActor): Vista => (actor.tipo === "EMPLEADO" ? { tipo: "EMPLEADO", empleadoId: actor.empleadoId } : { tipo: "NEGOCIO" })
const audit = (negocioId: string, actor: CajaActor) =>
  actor.tipo === "EMPLEADO" ? { userId: actor.empleadoId, userType: "empleado" } : { userId: negocioId, userType: "negocio" }

function readKey(req: NextRequest): string | null {
  const raw = req.headers.get("idempotency-key")?.trim() ?? ""
  return isValidVentaIdempotencyKey(raw) ? raw.toLowerCase() : null
}

const KEY_REQUIRED = () => NextResponse.json({ ok: false, error: "Falta una Idempotency-Key válida.", code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 })
const failure = (r: { status: number; error: string; code?: string }) => NextResponse.json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}) }, { status: r.status })

export async function historialVentasHttp(req: NextRequest, negocioId: string, actor: CajaActor): Promise<NextResponse> {
  try {
    const filtro = parseFiltroHistorial(new URL(req.url).searchParams)
    if (!filtro.ok) return NextResponse.json({ ok: false, error: filtro.error }, { status: 400 })
    const ventas = await listarVentasConDevoluciones(db, negocioId, filtro, vistaDe(actor))
    return NextResponse.json({ ok: true, ventas })
  } catch (error) {
    console.error("Error listing ventas con devoluciones:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudieron cargar las ventas." }, { status: 500 })
  }
}

export async function detalleVentaHttp(negocioId: string, actor: CajaActor, ventaId: string): Promise<NextResponse> {
  try {
    const venta = await detalleVentaConDevoluciones(db, negocioId, ventaId, vistaDe(actor))
    if (!venta) return NextResponse.json({ ok: false, error: "Venta no encontrada." }, { status: 404 })
    return NextResponse.json({ ok: true, venta })
  } catch (error) {
    console.error("Error reading venta con devoluciones:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudo cargar la venta." }, { status: 500 })
  }
}

export async function crearDevolucionHttp(req: NextRequest, negocioId: string, actor: CajaActor, ventaId: string): Promise<NextResponse> {
  try {
    const key = readKey(req)
    if (!key) return KEY_REQUIRED()
    const parsed = parseDevolucionBody(await req.json().catch(() => null))
    if (!parsed.ok) return failure(parsed)
    // R1 (2026-11-13): the audit is written INSIDE the return's transaction
    // (only for a new return; a replay writes nothing). A failed audit rolls the
    // whole return back (no money, stock or return row without its audit) and
    // the client gets a 500 whose retry with the same key starts clean.
    const result = await registrarDevolucionVenta(db, { negocioId, actor, ventaId, solicitud: parsed.value, idempotencyKey: key }, {
      auditar: async (tx, devolucion) => {
        // F4-C4 (D6): explicit audit of returned lines whose price was inherited
        // through an earlier-rule F4-B correction (amounts unchanged). The audit
        // never depends on the detail read below; the evidence has its own read
        // and records VERIFICADA (with the ids, possibly none) or NO_DISPONIBLE
        // (an SQL failure here aborts the transaction, so the audit write fails
        // and the whole return rolls back: never a return without its audit).
        let precioHeredado: { evidencia: "VERIFICADA"; ventaItemIds: string[] } | { evidencia: "NO_DISPONIBLE" }
        try {
          precioHeredado = { evidencia: "VERIFICADA", ventaItemIds: await lineasDevueltasConPrecioHeredado(tx, negocioId, devolucion.ventaId, devolucion.items.map((i) => i.ventaItemId)) }
        } catch (error) {
          console.error("Error reading precio heredado evidence:", safeErrorForLog(error))
          precioHeredado = { evidencia: "NO_DISPONIBLE" }
        }
        await auditLogWithClient(tx, {
          ...audit(negocioId, actor),
          accion: devolucion.tipo === "ANULACION" ? "venta.anulada" : "venta.devolucion_parcial",
          recurso: "venta",
          recursoId: devolucion.ventaId,
          detalle: {
            negocioId,
            devolucionId: devolucion.id,
            importe: devolucion.importeDecimal.toString(),
            motivo: devolucion.motivo,
            reintegroEstado: devolucion.reintegroEstado,
            reintegroMedio: devolucion.reintegroMedio,
            reintegroTurnoCajaId: devolucion.reintegroTurnoCajaId,
            items: devolucion.items.map((i) => ({ ventaItemId: i.ventaItemId, cantidad: i.cantidad, importe: i.importeDecimal.toString(), stockResultado: i.stockResultado })),
            precioHeredado,
          },
        })
      },
    })
    if (!result.ok) return failure(result)
    const { devolucion, replayed } = result.value
    const venta = await detalleVentaConDevoluciones(db, negocioId, devolucion.ventaId, vistaDe(actor))
    const vista = actor.tipo === "EMPLEADO" ? { tipo: "EMPLEADO" as const, empleadoId: actor.empleadoId } : { tipo: "NEGOCIO" as const, nombres: new Map<string, string>() }
    return NextResponse.json(
      { ok: true, replayed, devolucion: venta?.devoluciones.find((d) => d.id === devolucion.id) ?? devolucionParaRespuesta(devolucion, vista), venta },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
    )
  } catch (error) {
    console.error("Error registering devolucion de venta:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos registrar la operación por un error del servidor. Podés reintentar sin duplicarla." }, { status: 500 })
  }
}

export async function registrarReintegroHttp(req: NextRequest, negocioId: string, actor: CajaActor, devolucionId: string): Promise<NextResponse> {
  try {
    const key = readKey(req)
    if (!key) return KEY_REQUIRED()
    const body = (await req.json().catch(() => null)) as { medio?: unknown; cajaFisicaId?: unknown; confirmo?: unknown } | null
    if (body?.confirmo !== true) return NextResponse.json({ ok: false, error: "Confirmá que devolviste el dinero.", code: "CONFIRMACION_REINTEGRO_REQUERIDA" }, { status: 400 })
    const caja = body?.cajaFisicaId
    if (caja !== undefined && caja !== null && (typeof caja !== "string" || !caja.trim())) return NextResponse.json({ ok: false, error: "Caja inválida.", code: "CAJA_INVALIDA" }, { status: 400 })
    // R1 (2026-11-13): the refund audit is written INSIDE the refund's
    // transaction (new refunds only); a failed audit rolls the refund back.
    const result = await registrarReintegroDevolucion(db, { negocioId, actor, devolucionId, medio: body?.medio, cajaFisicaId: typeof caja === "string" ? caja : null, idempotencyKey: key }, {
      auditar: async (tx, devolucion) => {
        // Where the money left from (read in the same transaction): a JS failure
        // records NO_DISPONIBLE; an SQL failure aborts and rolls everything back.
        let cuenta: CuentaReintegroAuditoria = { evidencia: "SIN_MOVIMIENTO" }
        if (devolucion.reintegroOperacionId) {
          try {
            cuenta = { evidencia: "VERIFICADA", movimientos: await movimientosDelReintegro(tx, devolucion.reintegroOperacionId) }
          } catch (error) {
            console.error("Error reading reintegro account evidence:", safeErrorForLog(error))
            cuenta = { evidencia: "NO_DISPONIBLE" }
          }
        }
        await auditLogWithClient(tx, {
          ...audit(negocioId, actor),
          accion: "venta.devolucion_reintegro_registrado",
          recurso: "venta",
          recursoId: devolucion.ventaId,
          detalle: detalleAuditoriaReintegro(negocioId, devolucion, cuenta),
        })
      },
    })
    if (!result.ok) return failure(result)
    const { devolucion, replayed } = result.value
    const venta = await detalleVentaConDevoluciones(db, negocioId, devolucion.ventaId, vistaDe(actor))
    return NextResponse.json(
      { ok: true, replayed, venta },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
    )
  } catch (error) {
    console.error("Error registering reintegro de devolucion:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos registrar el reintegro por un error del servidor. Podés reintentar sin duplicarlo." }, { status: 500 })
  }
}
