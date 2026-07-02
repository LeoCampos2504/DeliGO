import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"

// ============================================
// DeliGO Operaciones — PyR personal: reseñas y métricas (SOLO LECTURA · Operaciones-1N)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) vía
// resolveOperativoAreaForSlug(..., "pyr"). No usa cookie/APIs/scopes de terminal
// (requireOperacionesScope/requireOperacionesArea/hasTerminalScope quedan fuera). Solo
// GET, sin query params: no hay filtros, paginación ni orden provenientes del cliente.
// El negocio se deriva SIEMPRE del contexto seguro (auth.negocio.id); el slug/cliente
// nunca autorizan por sí solos.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    // 401 sin sesión · 403 area_no_habilitada (área efectiva ≠ pyr) · 403 acceso_no_disponible.
    const auth = await resolveOperativoAreaForSlug(req, slug, "pyr")

    if (!auth.ok) {
      const response = NextResponse.json(
        {
          ok: false,
          estado: auth.state,
          error: auth.status === 401 ? "No autenticado" : "Acceso no disponible",
        },
        { status: auth.status }
      )
      if (auth.clearSession) {
        response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
      }
      return noStore(response)
    }

    // El negocio SIEMPRE del contexto seguro; nunca del cliente. Sin query params.
    const negocioId = auth.negocio.id

    // Límite fijo y seguro del lado servidor (mismo valor confirmado en el flujo terminal
    // de PyR: src/app/api/operaciones/pyr/resenas/route.ts). Sin paginación de cliente.
    const RESENAS_LIMIT = 100

    // Orden fijo: fecha descendente, id descendente (desempate estable). Total,
    // sinResponder, promedio y distribución calculados en DB (agregaciones), nunca
    // cargando todas las reseñas en memoria solo para métricas.
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

    return noStore(
      NextResponse.json({
        ok: true,
        negocio: {
          nombre: auth.negocio.nombre,
          slug: auth.negocio.slug,
          colorPrincipal: auth.negocio.colorPrincipal,
        },
        resumen: {
          total,
          sinResponder,
          promedio,
          distribucion,
        },
        // Booleano de presentación derivado en servidor: cualquier cuenta que autoriza
        // esta ruta (área efectiva "pyr") puede responder reseñas — no hay un sub-permiso
        // más granular en esta etapa. Nunca se exponen roles, scopes ni permisos crudos.
        puedeResponderResena: true,
        resenas: resenas.map((r) => ({
          id: r.id,
          clienteNombre: r.clienteNombre,
          puntuacion: r.puntuacion,
          comentario: r.comentario,
          fecha: r.fecha,
          respuestaNegocio: r.respuestaNegocio,
          fechaRespuesta: r.fechaRespuesta,
        })),
      })
    )
  } catch (error) {
    console.error("[OperativoPyR] Error loading resenas:", error)
    return noStore(
      NextResponse.json({ ok: false, error: "No se pudieron cargar las reseñas" }, { status: 500 })
    )
  }
}
