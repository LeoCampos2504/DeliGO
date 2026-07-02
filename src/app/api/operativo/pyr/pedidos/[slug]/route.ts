import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"

// ============================================
// DeliGO Operaciones — PyR personal: pedidos activos (SOLO LECTURA · Operaciones-1O)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) vía
// resolveOperativoAreaForSlug(..., "pyr"). No usa cookie/APIs/scopes de terminal. Solo GET,
// sin query params: no hay filtros, paginación ni orden provenientes del cliente. El negocio
// se deriva SIEMPRE del contexto seguro (auth.negocio.id); el slug/cliente nunca autorizan
// por sí solos. Sin mutaciones de ningún tipo (no hay POST/PATCH/PUT/DELETE en este archivo).
//
// Definición de "pedido activo" y filtro reutilizados EXACTOS del panel terminal existente
// de PyR (ESTADOS_ACTIVOS_NO_MESA/PANEL_LIMIT/orden, endpoint de gestión con scopes de
// terminal, no personal): estados recibido/preparando/en_camino/listo_para_retirar,
// metodoEntrega != "mesa", orden fecha asc + id asc (FIFO operativo), límite fijo 100. Ver
// detalle en CODEX_REPORT.md.
const ESTADOS_ACTIVOS_NO_MESA = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const
const PEDIDOS_LIMIT = 100

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

    const where = {
      negocioId,
      metodoEntrega: { not: "mesa" },
      estado: { in: [...ESTADOS_ACTIVOS_NO_MESA] },
    }

    // Total y listado se calculan en DB (conteo real, no se cargan todos los pedidos en
    // memoria solo para el resumen). Orden y límite: los mismos fijos del flujo terminal.
    const [totalActivos, pedidos] = await Promise.all([
      db.pedido.count({ where }),
      db.pedido.findMany({
        where,
        orderBy: [{ fecha: "asc" }, { id: "asc" }],
        take: PEDIDOS_LIMIT,
        select: {
          id: true,
          estado: true,
          metodoEntrega: true,
          fecha: true,
          // Solo el nombre visible del cliente (nunca id, teléfono, dirección ni otros
          // datos personales); mismo campo ya expuesto por el flujo terminal de PyR.
          clienteNombre: true,
          total: true,
        },
      }),
    ])

    return noStore(
      NextResponse.json({
        ok: true,
        negocio: {
          nombre: auth.negocio.nombre,
          slug: auth.negocio.slug,
          colorPrincipal: auth.negocio.colorPrincipal,
        },
        resumen: {
          totalActivos,
        },
        pedidos: pedidos.map((p) => ({
          id: p.id,
          estado: p.estado,
          metodoEntrega: p.metodoEntrega,
          fecha: p.fecha,
          clienteNombre: p.clienteNombre,
          total: p.total,
        })),
      })
    )
  } catch (error) {
    console.error("[OperativoPyR] Error loading pedidos activos:", error)
    return noStore(
      NextResponse.json({ ok: false, error: "No se pudieron cargar los pedidos" }, { status: 500 })
    )
  }
}
