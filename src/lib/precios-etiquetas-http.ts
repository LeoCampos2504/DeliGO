// F10-C2c — capa HTTP compartida (dueño y cajero) de inicio de venta y etiquetas de góndola.
// El negocio y la persona salen SIEMPRE de la sesión (las rutas los resuelven); el cuerpo nunca elige precios.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLogWithClient } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { crearInicioVenta, estadoInicioVenta, idInicioValido, type ActorInicio } from "@/lib/inicio-venta-service"
import { listarEtiquetas, resolverEtiquetas, type ActorEtiqueta } from "@/lib/etiquetas-precio-service"

const NO_STORE = { "Cache-Control": "private, no-store" }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })
function errorInterno(contexto: string, error: unknown) {
  console.error(`[F10-C2c] ${contexto}`, safeErrorForLog(error))
  return json({ ok: false, error: "No se pudo completar la operación. Probá de nuevo." }, 500)
}

export async function crearInicioVentaHttp(negocioId: string, actor: ActorInicio) {
  try {
    const r = await crearInicioVenta(db, negocioId, actor)
    return json({ ok: true, inicio: r }, 201)
  } catch (error) {
    return errorInterno("crear inicio de venta", error)
  }
}

export async function estadoInicioVentaHttp(negocioId: string, actor: ActorInicio, id: string) {
  if (!idInicioValido(id)) return json({ ok: false, error: "Inicio de venta inválido." }, 400)
  try {
    const r = await estadoInicioVenta(db, negocioId, actor, id)
    if (!r.ok) return json({ ok: false, error: r.error, code: r.code }, r.status)
    return json({ ok: true, inicio: r.value })
  } catch (error) {
    return errorInterno("leer inicio de venta", error)
  }
}

export async function listarEtiquetasHttp(req: NextRequest, negocioId: string, conActor: boolean) {
  try {
    const sp = req.nextUrl.searchParams
    const r = await listarEtiquetas(db, negocioId, { estado: sp.get("estado"), q: sp.get("q"), conActor })
    return json({ ok: true, ...r })
  } catch (error) {
    return errorInterno("listar etiquetas", error)
  }
}

export async function resolverEtiquetasHttp(req: NextRequest, negocioId: string, actor: ActorEtiqueta) {
  const body = (await req.json().catch(() => null)) as { accion?: unknown; ids?: unknown } | null
  if (!body || typeof body !== "object") return json({ ok: false, error: "Solicitud inválida." }, 400)
  const usuario = actor.tipo === "NEGOCIO" ? { userId: negocioId, userType: "negocio" } : { userId: actor.empleadoId, userType: "empleado" }
  try {
    const r = await resolverEtiquetas(db, { negocioId, actor, accion: body.accion, ids: body.ids }, {
      // Cada confirmación / activación / descarte queda auditado en la MISMA transacción.
      auditar: (tx, e) => auditLogWithClient(tx, { ...usuario, accion: e.accion, recurso: "etiqueta_precio", recursoId: e.recursoId, detalle: e.detalle }),
    })
    if (!r.ok) return json({ ok: false, error: r.error, code: r.code }, r.status)
    return json({ ok: true, ...r.value })
  } catch (error) {
    return errorInterno("resolver etiquetas", error)
  }
}
