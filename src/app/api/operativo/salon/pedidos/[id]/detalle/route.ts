import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { groupIngredientesQuitados } from "@/lib/pedido-item-personalizacion"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO Operaciones - Salon personal: detalle de un pedido de mesa (SOLO LECTURA)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) via
// resolveOperativoAreaForSlug(..., "salon"). No usa cookie/APIs/scopes de terminal. Solo
// GET, con slug como query param tecnico (mismo patron que
// GET /api/operativo/salon/panel/[slug] y los POST .../preparar, .../listo). El negocio se
// deriva SIEMPRE del contexto seguro (auth.negocio.id); el slug/id nunca autorizan por si
// solos. Visibilidad IDENTICA al listado del panel (mismo where): negocio del contexto
// seguro, metodoEntrega "mesa", estado dentro de ACTIVE_MESA_ORDER_STATES. Un pedido que no
// cumple ese alcance responde 404 (no revela si existe en otro negocio, no-mesa o en otro
// estado). Sin mutaciones (no hay POST/PATCH/PUT/DELETE en este archivo).

// Mismos estados activos de pedido de mesa que src/app/api/operativo/salon/panel/[slug]/route.ts
const ACTIVE_MESA_ORDER_STATES = ["recibido", "preparando", "listo_para_retirar"] as const

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

    // 401 sin sesion - 403 area_no_habilitada (area efectiva != salon) - 403 acceso_no_disponible.
    const auth = await resolveOperativoAreaForSlug(req, slug, "salon")

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

    // Mismo alcance exacto que el listado del panel (GET /api/operativo/salon/panel/[slug]):
    // un pedido fuera de ese alcance (otro negocio, no-mesa, o en un estado ya no activo)
    // no existe para este endpoint. 404 generico, sin distinguir el motivo.
    const pedido = await db.pedido.findFirst({
      where: {
        id,
        negocioId,
        metodoEntrega: "mesa",
        estado: { in: [...ACTIVE_MESA_ORDER_STATES] },
      },
      select: {
        id: true,
        estado: true,
        metodoEntrega: true,
        fecha: true,
        total: true,
        mesaNumero: true,
        // Solo el nombre visible del mozo asignado al pedido (nunca id ni datos internos).
        empleadoNombre: true,
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
          mesaNumero: pedido.mesaNumero,
          empleadoNombre: pedido.empleadoNombre,
          items: pedido.items.map((item) => ({
            id: item.id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio: item.precio,
            agregados: safeParseJSON(item.agregados, []),
            secciones: safeParseJSON(item.secciones, {}),
            // P1-A.2B: los pedidos nuevos ya persisten `grupo` real (snapshot
            // estructurado autoritativo — ver buildIngredientesQuitadosSnapshot).
            // `groupIngredientesQuitados` usa ese grupo persistido para pedidos
            // nuevos, y el grupo neutral "Ingredientes" para pedidos históricos
            // (`string[]` plano, sin grupo declarado) — el único consumidor de
            // este endpoint es PedidoDetalleDrawer (vía
            // src/app/operaciones/mi-panel/[slug]/salon/page.tsx), que ya soporta
            // la forma agrupada desde P1-A.1.
            ingredientesQuitados: groupIngredientesQuitados(item.ingredientesQuitados),
            talle: item.talle || null,
            color: item.color || null,
          })),
        },
      })
    )
  } catch (error) {
    console.error("[OperativoSalon] Error loading pedido detalle:", safeErrorForLog(error))
    return noStore(
      NextResponse.json({ ok: false, error: "No se pudo cargar el detalle" }, { status: 500 })
    )
  }
}
