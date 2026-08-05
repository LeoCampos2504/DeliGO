import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { groupIngredientesQuitados } from "@/lib/pedido-item-personalizacion"

// ============================================
// DeliGO Operaciones - PyR personal: detalle de un pedido activo (SOLO LECTURA)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) via
// resolveOperativoAreaForSlug(..., "pyr"). No usa cookie/APIs/scopes de terminal. Solo GET,
// con slug como query param tecnico (mismo patron que GET /api/operativo/pyr/pedidos). El
// negocio se deriva SIEMPRE del contexto seguro (auth.negocio.id); el slug/id nunca
// autorizan por si solos. Visibilidad IDENTICA al listado (mismo where): negocio del
// contexto seguro, metodoEntrega != "mesa", estado dentro de ESTADOS_ACTIVOS_NO_MESA. Un
// pedido que no cumple ese alcance responde 404 (no revela si existe en otro negocio, en
// otro estado o de mesa). Sin mutaciones (no hay POST/PATCH/PUT/DELETE en este archivo).

const ESTADOS_ACTIVOS_NO_MESA = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const

function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // El negocio SIEMPRE del contexto seguro; nunca del cliente.
    const negocioId = auth.negocio.id

    // Mismo alcance exacto que el listado (GET /api/operativo/pyr/pedidos): un pedido fuera
    // de ese alcance (otro negocio, de mesa, o en un estado ya no activo) no existe para
    // este endpoint. 404 generico, sin distinguir el motivo.
    const pedido = await db.pedido.findFirst({
      where: {
        id,
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: { in: [...ESTADOS_ACTIVOS_NO_MESA] },
      },
      select: {
        id: true,
        estado: true,
        metodoEntrega: true,
        fecha: true,
        total: true,
        // Solo el nombre visible del cliente (nunca id, telefono, direccion ni otros datos
        // personales) - mismo campo ya expuesto por el listado.
        clienteNombre: true,
        items: {
          select: {
            id: true,
            nombre: true,
            cantidad: true,
            precio: true,
            agregados: true,
            secciones: true,
            ingredientesQuitados: true,
            talle: true,
            color: true,
          },
        },
      },
    })

    if (!pedido) {
      return noStore(
        NextResponse.json({ ok: false, error: "Pedido no disponible" }, { status: 404 })
      )
    }

    return noStore(
      NextResponse.json({
        ok: true,
        pedido: {
          id: pedido.id,
          estado: pedido.estado,
          metodoEntrega: pedido.metodoEntrega,
          fecha: pedido.fecha,
          total: pedido.total,
          clienteNombre: pedido.clienteNombre,
          items: pedido.items.map((item) => ({
            id: item.id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio: item.precio,
            agregados: safeParseJSON(item.agregados, []),
            secciones: safeParseJSON(item.secciones, {}),
            // P1-A.2B: mismo razonamiento que el detalle operativo de Salón — los
            // pedidos nuevos ya persisten `grupo` real, y el único consumidor de
            // este endpoint es PedidoDetalleDrawer (vía
            // src/app/operaciones/mi-panel/[slug]/pyr/pedidos/page.tsx), que ya
            // soporta la forma agrupada desde P1-A.1.
            ingredientesQuitados: groupIngredientesQuitados(item.ingredientesQuitados),
            talle: item.talle || null,
            color: item.color || null,
          })),
        },
      })
    )
  } catch (error) {
    console.error("[OperativoPyR] Error loading pedido detalle:", error)
    return noStore(
      NextResponse.json({ ok: false, error: "No se pudo cargar el detalle" }, { status: 500 })
    )
  }
}
