import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope, hasTerminalScope } from "@/lib/operaciones-terminal-access"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Estados activos reales de pedidos no-mesa (mismos que `ESTADOS_ACTIVOS` del proyecto).
// `en_camino` aplica solo a domicilio; mesa queda excluido por `metodoEntrega`.
const ESTADOS_ACTIVOS_NO_MESA = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const

// Límite fijo y seguro de pedidos activos devueltos (sin paginación de cliente en esta etapa).
const PANEL_LIMIT = 100

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

// GET — Panel PyR de SOLO LECTURA de pedidos activos no-mesa para una Terminal Operativa.
// El negocio se deriva EXCLUSIVAMENTE del contexto seguro de la terminal (cookie).
export async function GET(req: NextRequest) {
  try {
    // 401 sin sesión válida de terminal · 403 sin scope `pyr.pedidos.ver`.
    // El scope `pyr.pedidos.ver` solo puede existir junto al área `pyr` + `pyr.ver`
    // (normalización del grant), por lo que también garantiza la pertenencia al área PyR.
    const auth = await requireOperacionesScope(req, "pyr.pedidos.ver")
    if (!auth.ok) return auth.response

    // El negocio se deriva del contexto seguro: nunca del cliente.
    const negocioId = auth.context.negocio.id

    // Capacidad de gestión derivada en servidor (habilita acciones por pedido más abajo).
    const puedeGestionarPedido = hasTerminalScope(auth.context, "pyr.pedidos.gestionar")

    // Solo pedidos del negocio, NO-mesa y en estados activos. Orden FIFO operativo
    // (más antiguos primero) con `id` como desempate determinista. Límite fijo.
    const pedidos = await db.pedido.findMany({
      where: {
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: { in: [...ESTADOS_ACTIVOS_NO_MESA] },
      },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
      take: PANEL_LIMIT,
      select: {
        id: true,
        estado: true,
        metodoEntrega: true,
        fecha: true,
        total: true,
        // Solo el nombre visible del cliente (nunca teléfono, id, dirección, geo, notas, pago).
        clienteNombre: true,
        // Se lee SOLO para derivar la acción de entrega de retiro; nunca se devuelve crudo.
        clienteConfirmaRecibido: true,
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
    })

    const pedidosOut = pedidos.map((p) => ({
      id: p.id,
      estado: p.estado,
      metodoEntrega: p.metodoEntrega,
      fecha: p.fecha,
      total: p.total,
      clienteNombre: p.clienteNombre,
      // Acciones derivadas SOLO en servidor (UX). El PATCH revalida todo igualmente.
      // No se expone `clienteConfirmaRecibido` crudo ni datos financieros.
      acciones: {
        puedeIniciarPreparacion: puedeGestionarPedido && p.estado === "recibido",
        puedeMarcarEnCamino:
          puedeGestionarPedido && p.metodoEntrega === "domicilio" && p.estado === "preparando",
        puedeMarcarListoParaRetirar:
          puedeGestionarPedido && p.metodoEntrega === "retiro" && p.estado === "preparando",
        puedeMarcarEntregado:
          puedeGestionarPedido &&
          p.metodoEntrega === "retiro" &&
          p.estado === "listo_para_retirar" &&
          p.clienteConfirmaRecibido === true,
        puedeCancelar: puedeGestionarPedido,
      },
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
        // Capacidades booleanas derivadas SOLO en servidor (nunca scopes crudos).
        // No habilitan acciones en esta etapa; preparan futuras subetapas.
        capacidades: {
          puedeGestionarPedido: hasTerminalScope(auth.context, "pyr.pedidos.gestionar"),
          puedeVerResenas: hasTerminalScope(auth.context, "pyr.resenas.ver"),
          puedeResponderResena: hasTerminalScope(auth.context, "pyr.resenas.responder"),
          puedeVerMensajes: hasTerminalScope(auth.context, "pyr.mensajes.ver"),
          puedeResponderMensajes: hasTerminalScope(auth.context, "pyr.mensajes.responder"),
        },
        // Datos seguros del encabezado (sin IDs internos, scopes crudos ni tokens).
        terminal: { nombre: auth.context.terminal.nombre },
        negocio: {
          nombre: auth.context.negocio.nombre,
          colorPrincipal: auth.context.negocio.colorPrincipal,
        },
        pedidos: pedidosOut,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesPyR] Falló la carga del panel PyR")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
