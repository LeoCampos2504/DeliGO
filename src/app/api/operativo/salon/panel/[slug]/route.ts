import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO Operaciones — Panel personal de Salón (SOLO LECTURA · Operaciones-1I)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal (cookie deligo_operativo_session) vía
// resolveOperativoAreaForSlug(..., "salon"). No usa cookie/APIs/scopes de terminal.
// Solo GET: no hay mutaciones (tomar/liberar/reasignar mesa, cambiar estado, crear
// pedido, etc. quedan fuera de esta fase). El negocio se deriva del contexto seguro;
// el slug/cliente nunca autorizan por sí solos.

// Mismos estados activos de pedido de mesa que el panel de Salón existente.
const ACTIVE_MESA_ORDER_STATES = ["recibido", "preparando", "listo_para_retirar"] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    // 401 sin sesión · 403 area_no_habilitada (área efectiva ≠ salon) · 403 acceso_no_disponible.
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

    // El negocio se deriva SIEMPRE del contexto seguro; nunca del cliente.
    const negocioId = auth.negocio.id

    const [mesas, orders] = await Promise.all([
      db.mesa.findMany({
        where: { negocioId, activa: true },
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          nombre: true,
          zona: true,
          capacidad: true,
          activa: true,
          ocupacionActualId: true,
          // Solo el nombre/código visibles del mozo asignado (sin IDs internos).
          empleado: { select: { nombre: true, codigo: true } },
        },
      }),
      db.pedido.findMany({
        where: {
          negocioId,
          metodoEntrega: "mesa",
          estado: { in: [...ACTIVE_MESA_ORDER_STATES] },
        },
        // Orden estable (P1-B): más antiguos primero con `id` como desempate determinista,
        // mismo criterio FIFO operativo que src/app/api/operaciones/pyr/panel/route.ts.
        // Antes no tenía orderBy: el orden de `pedidosActivos` por mesa dependía del orden
        // de retorno de la base de datos, no garantizado entre queries idénticas.
        orderBy: [{ fecha: "asc" }, { id: "asc" }],
        select: {
          id: true,
          mesaId: true,
          ocupacionMesaId: true,
          mesaNumero: true,
          estado: true,
          total: true,
        },
      }),
    ])

    // La ocupación actual es la única superficie operativa de la mesa. Los
    // pedidos anteriores siguen visibles como revisión, pero nunca se
    // mezclan ni se reasignan a la ocupación nueva.
    const ordersByMesa = new Map<string, { id: string; estado: string; total: number }[]>()
    const previousByMesa = new Map<string, { id: string; estado: string; total: number; reason: string }[]>()
    const pedidosSinOcupacionVinculada: { id: string; mesaNumero: number | null; estado: string; total: number; reason: string }[] = []
    for (const order of orders) {
      const mesaId = order.mesaId
      const mesa = mesaId ? mesas.find((candidate) => candidate.id === mesaId) : undefined
      if (!mesa || !mesaId || !order.ocupacionMesaId) {
        pedidosSinOcupacionVinculada.push({ id: order.id, mesaNumero: order.mesaNumero, estado: order.estado, total: order.total, reason: "Sin ocupación vinculada" })
        continue
      }
      if (mesa.ocupacionActualId === order.ocupacionMesaId) {
        if (!ordersByMesa.has(mesaId)) ordersByMesa.set(mesaId, [])
        ordersByMesa.get(mesaId)!.push({ id: order.id, estado: order.estado, total: order.total })
      } else {
        if (!previousByMesa.has(mesaId)) previousByMesa.set(mesaId, [])
        previousByMesa.get(mesaId)!.push({ id: order.id, estado: order.estado, total: order.total, reason: "Pedido de ocupación anterior · requiere revisión" })
      }
    }

    const mesasOut = mesas.map((mesa) => {
      const pedidosActivos = ordersByMesa.get(mesa.id) ?? []
      const pedidosAnteriores = previousByMesa.get(mesa.id) ?? []
      return {
        id: mesa.id,
        numero: mesa.numero,
        nombre: mesa.nombre,
        zona: mesa.zona,
        capacidad: mesa.capacidad,
        activa: mesa.activa,
        mozoAsignado: mesa.empleado
          ? { nombre: mesa.empleado.nombre, codigo: mesa.empleado.codigo }
          : null,
        pedidosActivos,
        pedidosActivosCount: pedidosActivos.length,
        pedidosActivosTotal: pedidosActivos.reduce((sum, order) => sum + order.total, 0),
        pedidosAnteriores,
      }
    })

    return noStore(
      NextResponse.json({
        ok: true,
        estado: "operativo",
        // Datos mínimos del encabezado (sin scopes, capacidades, terminalId ni tokens).
        negocio: {
          nombre: auth.negocio.nombre,
          slug: auth.negocio.slug,
          colorPrincipal: auth.negocio.colorPrincipal,
        },
        resumen: {
          mesasActivas: mesasOut.length,
          mesasConPedidos: mesasOut.filter((mesa) => mesa.pedidosActivosCount > 0).length,
          pedidosActivos: orders.filter((order) => order.ocupacionMesaId && mesas.some((mesa) => mesa.id === order.mesaId && mesa.ocupacionActualId === order.ocupacionMesaId)).length,
          pedidosAnteriores: orders.length - orders.filter((order) => order.ocupacionMesaId && mesas.some((mesa) => mesa.id === order.mesaId && mesa.ocupacionActualId === order.ocupacionMesaId)).length,
        },
        mesas: mesasOut,
        pedidosSinOcupacionVinculada,
      })
    )
  } catch (error) {
    console.error("[OperativoSalon] Error loading panel:", safeErrorForLog(error))
    return noStore(
      NextResponse.json({ ok: false, error: "No se pudo cargar el salón" }, { status: 500 })
    )
  }
}
