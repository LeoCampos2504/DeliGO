import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import {
  parsePedidoItemAgregados,
  parsePedidoItemSecciones,
  parsePedidoItemIngredientesQuitadosEntries,
  enrichIngredientesQuitadosConGrupoReal,
  type ProductoIngredienteRef,
} from "@/lib/pedido-item-personalizacion"

// ============================================
// DeliGO Operaciones — Mozo personal: detalle de un pedido de mesa (P1-A/P1-A.1, SOLO LECTURA)
// ============================================
// Mismo patrón exacto que src/app/api/operativo/salon/pedidos/[id]/detalle/route.ts
// (no se modifica ese archivo — este es el equivalente para Mozo, que hasta
// ahora no tenía ningún endpoint de detalle: GET /api/operativo/mozo/panel/[slug]
// solo devuelve {id, estado, total} por pedido, nunca sus items).
//
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) vía
// resolveOperativoAreaForSlug(..., "mozo"). Sin cookie/APIs/scopes de terminal.
// Solo GET, con slug como query param técnico (mismo patrón que el resto de
// las rutas operativas de mozo). El negocio se deriva SIEMPRE del contexto
// seguro (auth.negocio.id); el slug/id nunca autorizan por sí solos.
//
// Visibilidad IDÉNTICA al listado del panel de Mozo (GET .../mozo/panel/[slug],
// src/app/api/operativo/mozo/panel/[slug]/route.ts, función getActiveMesaOrders,
// líneas 70-84: mismo `where` exacto — negocioId del contexto seguro,
// metodoEntrega "mesa", estado dentro de ACTIVE_MESA_ORDER_STATES). Ese panel
// ya expone id/estado/total de TODOS los pedidos activos de mesa del negocio,
// no solo los de mesas asignadas a este mozo (no filtra por
// Mesa.empleadoId/pedido.empleadoId en ningún punto) — así que este detalle
// no amplía ninguna autorización ya existente: un pedido fuera de ese
// alcance exacto responde 404 genérico (no revela si existe en otro
// negocio, no-mesa, o en otro estado).
//
// Cierre técnico N/A acá: sin mutaciones (no hay POST/PATCH/PUT/DELETE).
//
// P1-A.1 — grupo real de ingredientes quitados (server-authoritative, sin
// tocar el formato persistido de PedidoItem.ingredientesQuitados): ese campo
// sigue siendo, para TODO pedido histórico o nuevo, un array plano de
// nombres — no se cambia esa escritura en POST /api/pedidos porque al menos
// otros 7 archivos fuera del alcance de esta corrección (paneles/vistas de
// Salón, PyR, Negocio y Cliente) leen y renderizan ese mismo campo asumiendo
// siempre `string[]`; escribir ahí un array de objetos los rompería (React
// no puede renderizar un objeto como hijo). En cambio, el grupo/categoría
// real se DERIVA en este endpoint, en el momento de la lectura, cruzando los
// nombres persistidos contra la lista real de ingredientes del producto
// (Producto -> ProductoIngrediente -> Ingrediente) — nunca contra un grupo
// que el propio dato pudiera declarar. Ver enrichIngredientesQuitadosConGrupoReal
// en src/lib/pedido-item-personalizacion.ts para el detalle completo y
// CLAUDE_REPORT.md para la justificación arquitectónica completa.

const ACTIVE_MESA_ORDER_STATES = ["recibido", "preparando", "listo_para_retirar"] as const

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

    // 401 sin_sesion - 403 area_no_habilitada (área efectiva != mozo) - 403 acceso_no_disponible.
    const auth = await resolveOperativoAreaForSlug(req, slug, "mozo")

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
        notas: true,
        // Solo el nombre visible del mozo asignado al pedido (nunca id ni datos internos).
        empleadoNombre: true,
        items: {
          select: {
            id: true,
            productoId: true,
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

    // P1-A.1: una sola consulta adicional, agrupada por producto (nunca una
    // consulta por ítem) — solo para los productos que efectivamente tienen
    // algo que enriquecer. `negocioId` se incluye en el `where` para nunca
    // cruzar accidentalmente contra un producto de otro negocio.
    const productoIds = [
      ...new Set(
        pedido.items
          .filter((item) => parsePedidoItemIngredientesQuitadosEntries(item.ingredientesQuitados).length > 0)
          .map((item) => item.productoId)
          .filter((productoId): productoId is string => Boolean(productoId))
      ),
    ]

    const productosConIngredientes = productoIds.length
      ? await db.producto.findMany({
          where: { id: { in: productoIds }, negocioId },
          select: {
            id: true,
            ingredientes: {
              select: { ingrediente: { select: { nombre: true, categoria: true } } },
            },
          },
        })
      : []

    const ingredientesRefPorProducto = new Map<string, ProductoIngredienteRef[]>(
      productosConIngredientes.map((producto) => [
        producto.id,
        producto.ingredientes.map((pi) => ({ nombre: pi.ingrediente.nombre, categoria: pi.ingrediente.categoria })),
      ])
    )

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
          notas: pedido.notas || null,
          items: pedido.items.map((item) => {
            const nombresQuitados = parsePedidoItemIngredientesQuitadosEntries(item.ingredientesQuitados).map(
              (entry) => entry.nombre
            )
            const ingredientesQuitados = enrichIngredientesQuitadosConGrupoReal(
              nombresQuitados,
              (item.productoId && ingredientesRefPorProducto.get(item.productoId)) || []
            )
            return {
              id: item.id,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precio: item.precio,
              agregados: parsePedidoItemAgregados(item.agregados),
              secciones: parsePedidoItemSecciones(item.secciones),
              ingredientesQuitados,
              talle: item.talle || null,
              color: item.color || null,
            }
          }),
        },
      })
    )
  } catch (error) {
    // P1-A.1: log mínimo y sanitizado — nunca el objeto Error completo (sin
    // stack, sin mensaje libre que pudiera incluir datos variables), nunca
    // el pedido, sus notas, ítems ni personalizaciones.
    console.error("[OperativoMozo] mozo_pedido_detalle_error", {
      errorName: error instanceof Error ? error.name : typeof error,
      prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    })
    return noStore(
      NextResponse.json({ ok: false, error: "No se pudo cargar el detalle" }, { status: 500 })
    )
  }
}
