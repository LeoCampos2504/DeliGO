// ============================================
// F4-C4 — HTTP glue shared by the owner and cashier exchange routes
// ============================================
// Each route authenticates first (owner session or personal cashier session,
// área "caja") and passes the negocio + actor it DERIVED from that session;
// nothing in the body or URL can choose them. The cashier's shift is resolved
// here from the session and re-validated by the sale engine. These helpers
// only parse, delegate to caja-cambios-service.ts and shape the response;
// the audit record is written by the service inside its transaction.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { parseVentaCajaRequestBody } from "@/lib/caja-venta-service"
import { turnoAbiertoDeActor, type CajaActor } from "@/lib/caja-turnos-service"
import { detalleVentaConDevoluciones, referenciaVenta } from "@/lib/caja-devoluciones-service"
import {
  cotizarCambioVenta,
  describirAdvertencias,
  parseCambioBody,
  registrarCambioVenta,
  registrarVentaAdicional,
  type AdvertenciasCambio,
  type CambioRegistrado,
} from "@/lib/caja-cambios-service"

type Vista = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }
const vistaDe = (actor: CajaActor): Vista => (actor.tipo === "EMPLEADO" ? { tipo: "EMPLEADO", empleadoId: actor.empleadoId } : { tipo: "NEGOCIO" })

function readKey(req: NextRequest): string | null {
  const raw = req.headers.get("idempotency-key")?.trim() ?? ""
  return isValidVentaIdempotencyKey(raw) ? raw.toLowerCase() : null
}

const KEY_REQUIRED = () => NextResponse.json({ ok: false, error: "Falta una Idempotency-Key válida.", code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 })
const failure = (r: { status: number; error: string; code?: string }) => NextResponse.json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}) }, { status: r.status })
const SERVER_ERROR = (texto: string) => NextResponse.json({ ok: false, error: `${texto} Podés reintentar sin duplicarla.` }, { status: 500 })

async function turnoDeCajero(negocioId: string, actor: CajaActor): Promise<string | null | undefined> {
  if (actor.tipo !== "EMPLEADO") return undefined
  return (await turnoAbiertoDeActor(db, negocioId, actor))?.id ?? null
}

/** Public shape of an exchange; who did it follows the same privacy rule as returns. */
export function cambioParaRespuesta(c: CambioRegistrado, actor: CajaActor, nombreEmpleado: string | null = null) {
  const advertencias = (c.advertencias ?? { version: 1, items: [] }) as unknown as AdvertenciasCambio
  const registradoPor = actor.tipo === "NEGOCIO"
    ? (c.actorTipo === "NEGOCIO" ? "Dueño" : nombreEmpleado ?? "Empleado")
    : c.actorTipo === "EMPLEADO" && c.actorId === actor.empleadoId ? "Vos" : c.actorTipo === "NEGOCIO" ? "Responsable del negocio" : "Otro empleado"
  return {
    id: c.id,
    ventaOrigenId: c.ventaOrigenId,
    ventaOrigenReferencia: referenciaVenta(c.ventaOrigenId),
    devolucionId: c.devolucionId,
    ventaNuevaId: c.ventaNuevaId,
    ventaNuevaReferencia: referenciaVenta(c.ventaNuevaId),
    createdAt: c.createdAt,
    motivo: c.motivo,
    registradoPor,
    importes: {
      salida: c.importeSalidaDecimal.toFixed(2),
      entrada: c.importeEntradaDecimal.toFixed(2),
      credito: c.creditoAplicadoDecimal.toFixed(2),
      diferenciaCobrada: c.diferenciaCobradaDecimal.toFixed(2),
      diferenciaReintegro: c.diferenciaReintegroDecimal.toFixed(2),
    },
    liquidacion: c.liquidacion,
    advertencias: advertencias.items,
    advertenciasTexto: describirAdvertencias(advertencias),
  }
}

export async function crearCambioHttp(req: NextRequest, negocioId: string, actor: CajaActor, ventaId: string): Promise<NextResponse> {
  try {
    const key = readKey(req)
    if (!key) return KEY_REQUIRED()
    const parsed = parseCambioBody(await req.json().catch(() => null), "REGISTRAR")
    if (!parsed.ok) return failure(parsed)
    const result = await registrarCambioVenta(db, { negocioId, actor, ventaId, solicitud: parsed.value, idempotencyKey: key, turnoCajaId: await turnoDeCajero(negocioId, actor) })
    if (!result.ok) return failure(result)
    const { cambio, replayed } = result.value
    const vista = vistaDe(actor)
    const [ventaOrigen, ventaNueva, empleado] = await Promise.all([
      detalleVentaConDevoluciones(db, negocioId, cambio.ventaOrigenId, vista),
      detalleVentaConDevoluciones(db, negocioId, cambio.ventaNuevaId, vista),
      actor.tipo === "NEGOCIO" && cambio.empleadoId ? db.empleado.findFirst({ where: { id: cambio.empleadoId, negocioId }, select: { nombre: true } }) : null,
    ])
    return NextResponse.json(
      { ok: true, replayed, cambio: cambioParaRespuesta(cambio, actor, empleado?.nombre ?? null), ventaOrigen, ventaNueva },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
    )
  } catch (error) {
    console.error("Error registering cambio de venta:", safeErrorForLog(error))
    return SERVER_ERROR("No pudimos registrar el cambio por un error del servidor.")
  }
}

export async function cotizarCambioHttp(req: NextRequest, negocioId: string, actor: CajaActor, ventaId: string): Promise<NextResponse> {
  try {
    const parsed = parseCambioBody(await req.json().catch(() => null), "COTIZAR")
    if (!parsed.ok) return failure(parsed)
    const result = await cotizarCambioVenta(db, { negocioId, actor, ventaId, solicitud: parsed.value, turnoCajaId: await turnoDeCajero(negocioId, actor) })
    if (!result.ok) return failure(result)
    return NextResponse.json({ ok: true, cotizacion: { ...result.value, advertenciasTexto: describirAdvertencias(result.value.advertencias) } })
  } catch (error) {
    console.error("Error quoting cambio de venta:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos calcular el cambio por un error del servidor." }, { status: 500 })
  }
}

export async function crearVentaAdicionalHttp(req: NextRequest, negocioId: string, actor: CajaActor, ventaId: string): Promise<NextResponse> {
  try {
    const key = readKey(req)
    if (!key) return KEY_REQUIRED()
    const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const parsed = parseVentaCajaRequestBody(raw)
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
    const caja = raw?.cajaFisicaId
    if (caja !== undefined && caja !== null && (typeof caja !== "string" || !caja.trim())) return NextResponse.json({ ok: false, error: "Caja inválida.", code: "CAJA_INVALIDA" }, { status: 400 })
    const result = await registrarVentaAdicional(db, {
      negocioId,
      actor,
      ventaId,
      metodoPago: parsed.metodoPago,
      lines: parsed.lines,
      idempotencyKey: key,
      turnoCajaId: await turnoDeCajero(negocioId, actor),
      cajaFisicaId: actor.tipo === "NEGOCIO" && typeof caja === "string" ? caja : null,
    })
    if (!result.ok) return failure(result)
    const { venta, replayed } = result.value
    const vista = vistaDe(actor)
    const [detalle, ventaOrigen] = await Promise.all([
      detalleVentaConDevoluciones(db, negocioId, venta.id, vista),
      detalleVentaConDevoluciones(db, negocioId, ventaId, vista),
    ])
    return NextResponse.json(
      { ok: true, replayed, venta: detalle, vinculo: { tipo: "ADICIONAL", ventaOrigenId: ventaId, ventaOrigenReferencia: referenciaVenta(ventaId) }, ventaOrigen },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
    )
  } catch (error) {
    console.error("Error registering venta adicional vinculada:", safeErrorForLog(error))
    return SERVER_ERROR("No pudimos registrar la venta por un error del servidor.")
  }
}
