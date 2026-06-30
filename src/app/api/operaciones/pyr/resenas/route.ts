import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope, hasTerminalScope } from "@/lib/operaciones-terminal-access"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Límite fijo y seguro de reseñas devueltas (sin paginación de cliente en esta etapa).
const RESENAS_LIMIT = 100

// GET — Listado de reseñas + métricas operativas para una Terminal Operativa con
// `pyr.resenas.ver`. El negocio se deriva EXCLUSIVAMENTE del contexto seguro (cookie).
export async function GET(req: NextRequest) {
  try {
    // 401 sin sesión válida de terminal · 403 sin scope `pyr.resenas.ver`.
    // `pyr.resenas.ver` solo existe junto al área `pyr` + `pyr.ver` (grant normalizado),
    // por lo que también garantiza la pertenencia al área PyR.
    const auth = await requireOperacionesScope(req, "pyr.resenas.ver")
    if (!auth.ok) return auth.response

    // El negocio se deriva del contexto seguro: nunca del cliente. No se leen query params.
    const negocioId = auth.context.negocio.id

    // Resumen calculado sobre TODAS las reseñas del negocio (agregaciones, no sobre el truncado).
    const [total, sinResponder, avg, distRows, resenas] = await Promise.all([
      db.resena.count({ where: { negocioId } }),
      db.resena.count({ where: { negocioId, respuestaNegocio: null } }),
      db.resena.aggregate({ where: { negocioId }, _avg: { puntuacion: true } }),
      db.resena.groupBy({ by: ["puntuacion"], where: { negocioId }, _count: { id: true } }),
      db.resena.findMany({
        where: { negocioId },
        orderBy: [{ fecha: "desc" }, { id: "desc" }],
        take: RESENAS_LIMIT,
        select: {
          id: true,
          // Solo el nombre visible del cliente (nunca id, teléfono ni otros datos personales).
          clienteNombre: true,
          puntuacion: true,
          comentario: true,
          fecha: true,
          respuestaNegocio: true,
          fechaRespuesta: true,
        },
      }),
    ])

    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const row of distRows) {
      if (row.puntuacion >= 1 && row.puntuacion <= 5) {
        distribucion[row.puntuacion] = row._count.id
      }
    }

    const promedio = avg._avg.puntuacion != null ? Math.round(avg._avg.puntuacion * 10) / 10 : null

    return NextResponse.json(
      {
        ok: true,
        // Datos seguros del encabezado (sin IDs internos, scopes crudos ni tokens).
        terminal: { nombre: auth.context.terminal.nombre },
        negocio: {
          nombre: auth.context.negocio.nombre,
          colorPrincipal: auth.context.negocio.colorPrincipal,
        },
        // Capacidad booleana derivada SOLO en servidor (nunca scopes crudos).
        capacidades: {
          puedeResponderResena: hasTerminalScope(auth.context, "pyr.resenas.responder"),
        },
        resumen: {
          total,
          promedio,
          sinResponder,
          distribucion,
        },
        resenas: resenas.map((r) => ({
          id: r.id,
          clienteNombre: r.clienteNombre,
          puntuacion: r.puntuacion,
          comentario: r.comentario,
          fecha: r.fecha,
          respuestaNegocio: r.respuestaNegocio,
          fechaRespuesta: r.fechaRespuesta,
        })),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesPyR] Falló la carga del panel de reseñas")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
