import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"

// ============================================
// DeliGO Operaciones - PyR personal: pedidos activos (SOLO LECTURA - Operaciones-1O + 1S.1)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) via
// resolveOperativoAreaForSlug(..., "pyr"). No usa cookie/APIs/scopes de terminal. Solo GET,
// con slug como query param tecnico para evitar colisiones de rutas dinamicas en Next.js.
// No hay filtros, paginacion ni orden provenientes del cliente. El negocio se deriva
// SIEMPRE del contexto seguro (auth.negocio.id); el slug/cliente nunca autorizan por si
// solos. Sin mutaciones de ningun tipo (no hay POST/PATCH/PUT/DELETE en este archivo).
//
// Definicion de "pedido activo" y filtro reutilizados EXACTOS del panel terminal existente
// de PyR (ESTADOS_ACTIVOS_NO_MESA/PANEL_LIMIT/orden, endpoint de gestion con scopes de
// terminal, no personal): estados recibido/preparando/en_camino/listo_para_retirar,
// metodoEntrega != "mesa", orden fecha asc + id asc (FIFO operativo), limite fijo 100. Ver
// detalle en CODEX_REPORT.md.
//
// Operaciones-1S.1: se selecciona internamente clienteConfirmaRecibido (nunca devuelto en
// crudo) solo para derivar el booleano seguro puedeConfirmarEntrega - refleja exactamente la
// misma condicion que ya exige el CAS de POST /api/operativo/pyr/pedidos/[id]/entregar
// (metodoEntrega:"retiro" + estado:"listo_para_retirar" + clienteConfirmaRecibido:true), sin
// debilitar ni duplicar esa autoridad: el POST sigue siendo la unica fuente final de verdad
// frente a carreras o datos obsoletos entre la lectura y la mutacion.
const ESTADOS_ACTIVOS_NO_MESA = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const
const PEDIDOS_LIMIT = 100

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim()
    if (!slug) {
      return noStore(
        NextResponse.json({ ok: false, error: "Slug requerido" }, { status: 400 })
      )
    }

    // 401 sin sesion - 403 area_no_habilitada (area efectiva != pyr) - 403 acceso_no_disponible.
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

    // El negocio SIEMPRE del contexto seguro; nunca del cliente. Sin query params de filtro.
    const negocioId = auth.negocio.id

    const where = {
      negocioId,
      metodoEntrega: { not: "mesa" },
      estado: { in: [...ESTADOS_ACTIVOS_NO_MESA] },
    }

    // Total y listado se calculan en DB (conteo real, no se cargan todos los pedidos en
    // memoria solo para el resumen). Orden y limite: los mismos fijos del flujo terminal.
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
          // Solo el nombre visible del cliente (nunca id, telefono, direccion ni otros
          // datos personales); mismo campo ya expuesto por el flujo terminal de PyR.
          clienteNombre: true,
          total: true,
          // Seleccionado SOLO para derivar puedeConfirmarEntrega mas abajo; nunca se
          // devuelve en crudo en la respuesta (ver mapeo).
          clienteConfirmaRecibido: true,
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
          // Indicador derivado y seguro: refleja exactamente la condicion que ya exige el
          // CAS de POST .../entregar. Nunca se expone clienteConfirmaRecibido en crudo.
          puedeConfirmarEntrega:
            p.metodoEntrega === "retiro" &&
            p.estado === "listo_para_retirar" &&
            p.clienteConfirmaRecibido === true,
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
