import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"

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
        select: {
          id: true,
          mesaNumero: true,
          estado: true,
          total: true,
        },
      }),
    ])

    // Mapa mesaNumero → pedidos activos.
    const ordersByMesa = new Map<number, { id: string; estado: string; total: number }[]>()
    for (const order of orders) {
      if (order.mesaNumero === null || order.mesaNumero === undefined) continue
      if (!ordersByMesa.has(order.mesaNumero)) ordersByMesa.set(order.mesaNumero, [])
      ordersByMesa.get(order.mesaNumero)!.push({ id: order.id, estado: order.estado, total: order.total })
    }

    const mesasOut = mesas.map((mesa) => {
      const pedidosActivos = ordersByMesa.get(mesa.numero) ?? []
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
          pedidosActivos: orders.length,
        },
        mesas: mesasOut,
      })
    )
  } catch (error) {
    console.error("[OperativoSalon] Error loading panel:", error)
    return noStore(
      NextResponse.json({ ok: false, error: "No se pudo cargar el salón" }, { status: 500 })
    )
  }
}
