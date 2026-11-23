// Catálogo — capa HTTP de la importación masiva (dueño y empleado). Identidad SIEMPRE desde la sesión.
// POST { modo: "vista_previa", ... } = sólo lectura · POST { modo: "confirmar", clave, ... } = escribe (idempotente)
// GET ?clave= = estado de una importación (para retomar tras un corte de conexión).

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { ejecutarImportacion, estadoImportacion, previsualizarImportacion, type ActorImportacion } from "@/lib/importacion-productos-service"

const NO_STORE = { "Cache-Control": "private, no-store" }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function importacionHttp(req: NextRequest, negocioId: string, actor: ActorImportacion) {
  try {
    if (req.method === "GET") {
      const clave = req.nextUrl.searchParams.get("clave") ?? ""
      const r = clave ? await estadoImportacion(db, negocioId, clave) : null
      return r ? json({ ok: true, ...r }) : json({ ok: false, error: "Importación no encontrada.", code: "IMPORTACION_NO_ENCONTRADA" }, 404)
    }
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const r = body.modo === "confirmar" ? await ejecutarImportacion(db, { negocioId, actor, body }) : await previsualizarImportacion(db, { negocioId, actor, body })
    return r.ok ? json({ ok: true, ...r.value }) : json({ ok: false, error: r.error, code: r.code }, r.status)
  } catch (error) {
    console.error("[Importación] productos", safeErrorForLog(error))
    return json({ ok: false, error: "No se pudo completar la importación. Volvé a confirmar: lo ya guardado no se repite." }, 500)
  }
}
