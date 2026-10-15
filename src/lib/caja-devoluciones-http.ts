// ============================================
// F4-A — HTTP glue shared by the owner and cashier return routes
// ============================================
// Each route authenticates first (owner session or personal cashier session)
// and passes the negocio + actor it DERIVED from that session; nothing in the
// body or URL can choose them. These helpers only parse, delegate to the single
// writer (caja-devoluciones-service.ts), audit and shape the response.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import type { CajaActor } from "@/lib/caja-turnos-service"
import {
  detalleVentaConDevoluciones,
  devolucionParaRespuesta,
  listarVentasConDevoluciones,
  parseDevolucionBody,
  parseFiltroHistorial,
  registrarDevolucionVenta,
  registrarReintegroDevolucion,
} from "@/lib/caja-devoluciones-service"

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
    const result = await registrarDevolucionVenta(db, { negocioId, actor, ventaId, solicitud: parsed.value, idempotencyKey: key })
    if (!result.ok) return failure(result)
    const { devolucion, replayed } = result.value
    if (!replayed) {
      await auditLog({
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
        },
      })
    }
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
    const result = await registrarReintegroDevolucion(db, { negocioId, actor, devolucionId, medio: body?.medio, cajaFisicaId: typeof caja === "string" ? caja : null, idempotencyKey: key })
    if (!result.ok) return failure(result)
    const { devolucion, replayed } = result.value
    if (!replayed) {
      await auditLog({
        ...audit(negocioId, actor),
        accion: "venta.devolucion_reintegro_registrado",
        recurso: "venta",
        recursoId: devolucion.ventaId,
        detalle: { negocioId, devolucionId: devolucion.id, importe: devolucion.importeDecimal.toString(), reintegroMedio: devolucion.reintegroMedio, reintegroTurnoCajaId: devolucion.reintegroTurnoCajaId },
      })
    }
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
