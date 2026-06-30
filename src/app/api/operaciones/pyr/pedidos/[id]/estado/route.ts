import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope, hasTerminalScope } from "@/lib/operaciones-terminal-access"
import { logPedidoEstadoChange } from "@/lib/audit"
import { createNotification, orderUpdateNotification, newDeliveryNotification } from "@/lib/push"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Mensaje genérico de conflicto: no revela negocio, IDs, estado anterior ni concurrencia.
const CONFLICT_MESSAGE = "El pedido cambió en otro dispositivo. Actualizá el panel."

// Tarifa de servicio vigente del proyecto (mismo valor fijo que negocio/empleado/salón).
const SERVICE_FEE_FIXED = 250

// Sin límite real en el proyecto para `canceladoMotivo`; se aplica un tope seguro y se documenta.
const MAX_MOTIVO_LEN = 300

// Estados activos no-mesa elegibles para gestionar.
const ESTADOS_ACTIVOS = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const
// Estados destino aceptados en el body.
const ESTADOS_DESTINO = ["preparando", "en_camino", "listo_para_retirar", "entregado", "cancelado"] as const

// Transiciones permitidas por método de entrega (no-mesa). Confirmadas contra los
// endpoints existentes (domicilio no llega a listo/entregado; retiro no usa en_camino).
const TRANSICIONES: Record<"domicilio" | "retiro", Record<string, string[]>> = {
  domicilio: {
    recibido: ["preparando", "cancelado"],
    preparando: ["en_camino", "cancelado"],
    en_camino: ["cancelado"],
  },
  retiro: {
    recibido: ["preparando", "cancelado"],
    preparando: ["listo_para_retirar", "cancelado"],
    listo_para_retirar: ["entregado", "cancelado"],
  },
}

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function badRequest(error = "Operación no permitida") {
  return NextResponse.json({ ok: false, error }, { status: 400, headers: NO_STORE_HEADERS })
}

function forbidden() {
  return NextResponse.json(
    { ok: false, error: "Esta terminal no tiene permiso para realizar esa acción." },
    { status: 403, headers: NO_STORE_HEADERS }
  )
}

function conflict() {
  return NextResponse.json({ ok: false, error: CONFLICT_MESSAGE }, { status: 409, headers: NO_STORE_HEADERS })
}

// PATCH — Cambia el estado de un pedido PyR no-mesa (domicilio/retiro) desde una Terminal
// Operativa. Negocio SIEMPRE desde el contexto seguro. Mutación atómica vía CAS + transacción.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1) Sesión válida de terminal + scope de gestión (401 / 403). Nunca confía en la UI.
    //    `pyr.pedidos.gestionar` solo existe junto al área `pyr` + `pyr.ver` (grant normalizado),
    //    por lo que también garantiza la pertenencia al área PyR.
    const auth = await requireOperacionesScope(req, "pyr.pedidos.gestionar")
    if (!auth.ok) return auth.response
    const ctx = auth.context
    if (!hasTerminalScope(ctx, "pyr.pedidos.gestionar")) return forbidden()
    const negocioId = ctx.negocio.id

    const { id } = await params

    // 2) Solo se aceptan `estado` (obligatorio) y `motivo` (solo para cancelar) del body.
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest("Solicitud inválida")
    // Allowlist estricta de claves: cualquier campo extra (negocioId, clienteConfirmaRecibido,
    // deudaTarifa, canceladoPor, estadoActual, etc.) hace rechazar el body con 400.
    const ALLOWED_KEYS = new Set(["estado", "motivo"])
    if (Object.keys(body as Record<string, unknown>).some((key) => !ALLOWED_KEYS.has(key))) {
      return badRequest("Solicitud inválida")
    }
    const estado = typeof (body as Record<string, unknown>).estado === "string"
      ? ((body as Record<string, unknown>).estado as string)
      : ""
    if (!estado || !(ESTADOS_DESTINO as readonly string[]).includes(estado)) {
      return badRequest("Estado inválido")
    }

    let motivo = ""
    if (estado === "cancelado") {
      const raw = (body as Record<string, unknown>).motivo
      motivo = typeof raw === "string" ? raw.trim() : ""
      if (!motivo) return badRequest("Debe indicar el motivo de cancelación")
      if (motivo.length > MAX_MOTIVO_LEN) return badRequest("El motivo es demasiado largo")
    }

    // 3) Lectura mínima acotada al negocio y NO-mesa. Inexistente / ajeno / mesa → 409 genérico.
    const pedido = await db.pedido.findFirst({
      where: { id, negocioId, metodoEntrega: { not: "mesa" } },
      select: {
        estado: true,
        metodoEntrega: true,
        clienteId: true,
        negocioNombre: true,
        direccion: true,
        deudaAcumulada: true,
      },
    })
    if (!pedido) return conflict()

    // Pedido ya finalizado o no elegible → 409 genérico (sin revelar el estado real).
    if (!(ESTADOS_ACTIVOS as readonly string[]).includes(pedido.estado)) return conflict()

    const metodo = pedido.metodoEntrega
    if (metodo !== "domicilio" && metodo !== "retiro") {
      // Cualquier método no soportado por PyR (incluida mesa, ya excluida) → conflicto.
      return conflict()
    }

    // 4) Validar que la transición sea estructuralmente permitida para el método.
    const allowed = TRANSICIONES[metodo][pedido.estado] ?? []
    if (!allowed.includes(estado)) return badRequest("Transición no permitida")

    const estadoAnterior = pedido.estado

    // 5) CAS + transacción: condición por id + negocio + no-mesa + estado anterior real.
    //    La entrega de retiro exige además la confirmación REAL del cliente (servidor),
    //    nunca un booleano de la UI. El incremento de tarifa lo hace solo el ganador del CAS.
    const casWhere: Record<string, unknown> = {
      id,
      negocioId,
      metodoEntrega: { not: "mesa" },
      estado: estadoAnterior,
    }
    const data: Record<string, unknown> = { estado }
    if (estado === "cancelado") {
      data.canceladoPor = "vendedor"
      data.canceladoMotivo = motivo
      data.canceladoFecha = new Date()
    }
    if (estado === "entregado") {
      // Solo retiro alcanza `entregado`; precondición de confirmación dentro del CAS.
      casWhere.metodoEntrega = "retiro"
      casWhere.clienteConfirmaRecibido = true
      data.entregadoFecha = new Date()
    }

    const won = await db.$transaction(async (tx) => {
      const result = await tx.pedido.updateMany({ where: casWhere, data })
      if (result.count !== 1) return false
      // Efecto financiero idéntico al actual, atado al ganador del CAS (sin doble incremento).
      if (estado === "entregado" && !pedido.deudaAcumulada) {
        await tx.negocio.update({
          where: { id: negocioId },
          data: { deudaTarifa: { increment: SERVICE_FEE_FIXED } },
        })
      }
      return true
    })

    if (!won) return conflict()

    // 6) Auditoría best-effort (actor terminal). Un fallo no revierte el cambio confirmado.
    try {
      await logPedidoEstadoChange({
        pedidoId: id,
        estadoNuevo: estado,
        estadoAnterior,
        userId: ctx.terminal.id,
        userType: "terminal_operativa",
      })
    } catch {
      console.error("[OperacionesPyR] Falló la auditoría de cambio de pedido")
    }

    // 7) Notificaciones best-effort, solo las ya existentes y aplicables a no-mesa.
    if (pedido.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        const payload = orderUpdateNotification(id, pedido.negocioNombre, estado)
        await createNotification({
          userId: pedido.clienteId,
          userType: "cliente",
          tipo: "order_update",
          titulo: payload.title,
          cuerpo: payload.body,
          pedidoId: id,
          negocioId,
          pushSubscription: cliente?.pushSubscription ?? null,
          pushPayload: payload,
          cleanupExpired: { model: "cliente", id: pedido.clienteId },
        })
      } catch {
        console.error("[OperacionesPyR] Falló una notificación de cambio de pedido")
      }
    }

    if (estado === "en_camino" && metodo === "domicilio") {
      try {
        const repartidores = await db.repartidorNegocio.findMany({
          where: { negocioId },
          include: { repartidor: { select: { id: true, pushSubscription: true, activo: true } } },
        })
        for (const rn of repartidores) {
          if (rn.repartidor.activo) {
            const payload = newDeliveryNotification(id, pedido.negocioNombre, pedido.direccion || "")
            await createNotification({
              userId: rn.repartidor.id,
              userType: "repartidor",
              tipo: "new_delivery",
              titulo: payload.title,
              cuerpo: payload.body,
              pedidoId: id,
              negocioId,
              pushSubscription: rn.repartidor.pushSubscription,
              pushPayload: payload,
              cleanupExpired: { model: "repartidor", id: rn.repartidor.id },
            })
          }
        }
      } catch {
        console.error("[OperacionesPyR] Falló una notificación de cambio de pedido")
      }
    }

    return NextResponse.json(
      { ok: true, pedido: { id, estado } },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesPyR] Falló el cambio de estado de pedido")
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
