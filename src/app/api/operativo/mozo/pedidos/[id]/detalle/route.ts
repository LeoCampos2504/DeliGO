import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import {
  parsePedidoItemAgregados,
  parsePedidoItemSecciones,
  parseIngredientesQuitadosPersistidos,
  enrichIngredientesQuitadosConGrupoReal,
  groupIngredientesQuitados,
  type ProductoIngredienteRef,
  type IngredienteQuitadoGrupo,
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
// P1-A.2B/P1-A.2B.1 — grupo real de ingredientes quitados, con dos fuentes
// según el ORIGEN de cada entrada (nunca según si su `grupo` es `null`):
// - Entradas SNAPSHOT (origen === "snapshot", P1-A.2B en adelante):
//   `PedidoItem.ingredientesQuitados` ya persiste el snapshot estructurado
//   autoritativo (`IngredienteQuitadoCanonico[]`, ver
//   buildIngredientesQuitadosSnapshot en src/lib/pedido-item-personalizacion.ts)
//   — el `grupo` de cada entrada ya es el real, congelado en el momento de
//   crear el pedido. Estas entradas se agrupan directamente con
//   `groupIngredientesQuitados`, SIN volver a consultar el producto — incluso
//   cuando `grupo` quedó en `null` porque el ingrediente no tenía categoría
//   en ese momento (P1-A.2B.1: `grupo === null` NUNCA es el criterio para
//   decidir si hace falta reconsultar; un snapshot con `grupo: null` es un
//   dato final, no una entrada legacy sin resolver — reconsultar acá
//   sobrescribiría ese `null` histórico si el negocio le asigna una
//   categoría al ingrediente más adelante). El origen se obtiene de
//   `parseIngredientesQuitadosPersistidos`, que distingue string vs. objeto
//   en el JSON crudo, nunca por el valor de `grupo`.
// - Entradas LEGACY (origen === "legacy", string plano histórico): el grupo
//   real se sigue DERIVANDO en el momento de la lectura, cruzando el nombre
//   contra la lista real de ingredientes del producto (Producto ->
//   ProductoIngrediente -> Ingrediente) vía `enrichIngredientesQuitadosConGrupoReal`
//   — nunca se migran ni se reescriben, siguen funcionando sin backfill.
// - Formato MIXTO dentro de un mismo ítem (defensivo, no debería ocurrir en
//   la práctica ya que cada ítem se persiste atómicamente en un solo
//   formato): las entradas snapshot se agrupan directamente, las legacy se
//   enriquecen por consulta batched, y ambos resultados se combinan.
// Ver CLAUDE_REPORT.md para la justificación arquitectónica completa.

const ACTIVE_MESA_ORDER_STATES = ["recibido", "preparando", "listo_para_retirar"] as const

/**
 * Combina grupos ya armados por dos fuentes distintas (snapshot estructurado
 * + enriquecimiento legacy) en una sola lista — si ambas fuentes producen un
 * grupo con el mismo nombre (ej. "Vegetales" tanto en una entrada nueva como
 * en una legacy enriquecida), sus ingredientes se unen sin duplicar. Orden
 * final: alfabético por nombre de grupo (ninguna de las dos fuentes declara
 * un `grupoOrden` real hoy — ver comentario de `buildIngredientesQuitadosSnapshot`).
 */
function mergeIngredienteGrupos(...listas: IngredienteQuitadoGrupo[][]): IngredienteQuitadoGrupo[] {
  const porGrupo = new Map<string, Set<string>>()
  for (const lista of listas) {
    for (const { grupo, ingredientes } of lista) {
      if (!porGrupo.has(grupo)) porGrupo.set(grupo, new Set())
      for (const ingrediente of ingredientes) porGrupo.get(grupo)!.add(ingrediente)
    }
  }
  return [...porGrupo.entries()]
    .map(([grupo, ingredientes]) => ({
      grupo,
      ingredientes: [...ingredientes].sort((a, b) => a.localeCompare(b, "es")),
    }))
    .sort((a, b) => a.grupo.localeCompare(b.grupo, "es"))
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

    // P1-A.2B.1: se parsea una sola vez por ítem (reutilizado más abajo tanto
    // para decidir qué productos consultar como para el mapeo final).
    // `parseIngredientesQuitadosPersistidos` distingue el ORIGEN real de cada
    // entrada (string legacy vs. objeto snapshot) — nunca se infiere a partir
    // de `grupo !== null`, porque un snapshot legítimo puede tener
    // `grupo: null`.
    const persistidosPorItem = new Map(
      pedido.items.map((item) => [item.id, parseIngredientesQuitadosPersistidos(item.ingredientesQuitados)])
    )

    // Solo se consulta el producto para los ítems que todavía tienen alguna
    // entrada de origen LEGACY — un pedido 100% estructurado (todas sus
    // entradas ya vinieron como snapshot desde P1-A.2B, tengan o no `grupo`)
    // no dispara ninguna consulta acá. Una sola consulta adicional, agrupada
    // por producto (nunca una consulta por ítem). `negocioId` se incluye en
    // el `where` para nunca cruzar accidentalmente contra un producto de
    // otro negocio.
    const productoIds = [
      ...new Set(
        pedido.items
          .filter((item) => (persistidosPorItem.get(item.id) ?? []).some((entry) => entry.origen === "legacy"))
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
            const persistidos = persistidosPorItem.get(item.id) ?? []
            // Entradas snapshot (origen real, no inferido por `grupo`): su
            // `grupo` persistido ES el real (incluso si es `null`) — se
            // agrupan directamente, sin volver a tocar la DB.
            const resueltos = persistidos
              .filter((entry) => entry.origen === "snapshot")
              .map((entry) => entry.ingrediente)
            // Entradas legacy (string plano histórico): se resuelven contra
            // el producto real, igual que antes de P1-A.2B.
            const nombresLegacy = persistidos
              .filter((entry) => entry.origen === "legacy")
              .map((entry) => entry.ingrediente.nombre)

            const gruposResueltos = groupIngredientesQuitados(resueltos)
            const gruposLegacy = enrichIngredientesQuitadosConGrupoReal(
              nombresLegacy,
              (item.productoId && ingredientesRefPorProducto.get(item.productoId)) || []
            )
            const ingredientesQuitados = mergeIngredienteGrupos(gruposResueltos, gruposLegacy)

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
