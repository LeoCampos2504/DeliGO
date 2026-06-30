import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope, hasTerminalScope } from "@/lib/operaciones-terminal-access"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Estados activos de pedidos de mesa (mismos que usa el Salón actual).
const ESTADOS_ACTIVOS_MESA = ["recibido", "preparando", "listo_para_retirar"] as const

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

// GET — Datos operativos de Salón para una Terminal Operativa con `salon.ver`.
// El negocio sale EXCLUSIVAMENTE del contexto seguro de la terminal (cookie).
export async function GET(req: NextRequest) {
  try {
    // 401 sin sesión válida de terminal · 403 sin scope `salon.ver`.
    const auth = await requireOperacionesScope(req, "salon.ver")
    if (!auth.ok) return auth.response

    // El negocio se deriva del contexto seguro: nunca del cliente.
    const negocioId = auth.context.negocio.id

    // Capacidades de mesa derivadas SOLO en servidor (nunca se devuelven scopes crudos).
    const puedeReasignarMesa = hasTerminalScope(auth.context, "salon.mesas.reasignar")
    const puedeLiberarMesa = hasTerminalScope(auth.context, "salon.mesas.liberar")

    const [mesas, pedidos, mozosAsignables] = await Promise.all([
      db.mesa.findMany({
        where: { negocioId, activa: true },
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          nombre: true,
          zona: true,
          capacidad: true,
          // Nombre visible del mozo asignado (necesario para operar). El `id` solo se
          // expone más abajo a terminales con reasignación (para preseleccionar el mozo).
          empleado: { select: { id: true, nombre: true } },
        },
      }),
      db.pedido.findMany({
        where: {
          negocioId,
          metodoEntrega: "mesa",
          estado: { in: [...ESTADOS_ACTIVOS_MESA] },
        },
        orderBy: { fecha: "desc" },
        select: {
          id: true,
          mesaNumero: true,
          estado: true,
          total: true,
          fecha: true,
          clienteNombre: true,
          empleadoNombre: true,
          items: {
            select: {
              id: true,
              nombre: true,
              cantidad: true,
              precio: true,
              agregados: true,
              secciones: true,
              seccionesPrecios: true,
              ingredientes: true,
              ingredientesQuitados: true,
              talle: true,
              color: true,
            },
          },
        },
      }),
      // Mozos elegibles para atender mesas, con la MISMA regla real del Salón existente
      // (mozo activo no eliminado del negocio). Solo se consulta/expone a terminales con
      // `salon.mesas.reasignar`; el resto recibe lista vacía. Datos mínimos: id + nombre.
      puedeReasignarMesa
        ? db.empleado.findMany({
            where: { negocioId, rol: "mozo", activo: true, eliminado: false },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true },
          })
        : Promise.resolve([] as { id: string; nombre: string }[]),
    ])

    const pedidosOut = pedidos.map((p) => ({
      id: p.id,
      mesaNumero: p.mesaNumero,
      estado: p.estado,
      total: p.total,
      fecha: p.fecha,
      clienteNombre: p.clienteNombre,
      empleadoNombre: p.empleadoNombre,
      items: p.items.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        agregados: safeParseJSON(item.agregados, []),
        secciones: safeParseJSON(item.secciones, {}),
        seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
        ingredientes: safeParseJSON(item.ingredientes, []),
        ingredientesQuitados: safeParseJSON(item.ingredientesQuitados, []),
        talle: item.talle,
        color: item.color,
      })),
    }))

    return NextResponse.json(
      {
        ok: true,
        // Capacidades booleanas derivadas SOLO en servidor desde el contexto seguro
        // (nunca se devuelven los scopes crudos).
        capacidades: {
          puedeCambiarEstadoPedido: hasTerminalScope(auth.context, "salon.pedidos.cambiar_estado"),
          puedeMarcarPedidoEntregado: hasTerminalScope(auth.context, "salon.pedidos.marcar_entregado"),
          puedeReasignarMesa,
          puedeLiberarMesa,
        },
        // Datos seguros del encabezado (sin IDs internos, scopes crudos ni tokens).
        terminal: { nombre: auth.context.terminal.nombre },
        negocio: {
          nombre: auth.context.negocio.nombre,
          colorPrincipal: auth.context.negocio.colorPrincipal,
        },
        mesas: mesas.map((m) => ({
          id: m.id,
          numero: m.numero,
          nombre: m.nombre,
          zona: m.zona,
          capacidad: m.capacidad,
          // El `id` del mozo asignado solo se expone a terminales que pueden reasignar
          // (para preseleccionarlo en el selector). El resto solo ve el nombre.
          empleado: m.empleado
            ? puedeReasignarMesa
              ? { id: m.empleado.id, nombre: m.empleado.nombre }
              : { nombre: m.empleado.nombre }
            : null,
        })),
        // Solo con `salon.mesas.reasignar`; en caso contrario, lista vacía (forma consistente).
        mozosAsignables: puedeReasignarMesa ? mozosAsignables : [],
        pedidos: pedidosOut,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesSalon] Falló la carga del panel de salón")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
