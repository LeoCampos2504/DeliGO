import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { logPedidoEstadoChange } from "@/lib/audit"
import { createNotification, orderUpdateNotification } from "@/lib/push"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"

// ============================================
// DeliGO Operaciones — PyR personal: confirmar entrega (Operaciones-1S)
// ============================================
// Acción FIJA (no un endpoint genérico de estados): transición única
//   listo_para_retirar → entregado  para un pedido de RETIRO del negocio autorizado.
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) con área efectiva
// "pyr". No usa cookie/APIs/scopes de terminal.
//
// El `id` del pedido viene SOLO del parámetro de ruta. El estado destino es fijo en
// servidor ("entregado"). El `slug` (query) solo selecciona el negocio a autorizar; no
// autoriza por sí solo: el resolver valida sesión → cuenta → negocio(slug) → empleado
// vinculado → área efectiva "pyr". Nunca se aceptan estado/negocioId/pedidoId/clienteId/
// empleadoId/terminalId/metodoEntrega/repartidorId/mesaId desde body/query/headers.
//
// Fuente terminal reutilizada (ver CODEX_REPORT.md): el único endpoint terminal real que
// gestiona esta transición para PyR no-mesa es un PATCH genérico multi-estado. Esta ruta
// personal reutiliza EXACTAMENTE, para el caso fijo listo_para_retirar→entregado de retiro:
// (1) la misma precondición del CAS — SOLO retiro Y con clienteConfirmaRecibido:true (el
// cliente ya confirmó la recepción por su propio flujo; el empleado nunca puede forzarla);
// (2) el mismo campo adicional entregadoFecha; (3) la misma auditoría (logPedidoEstadoChange,
// best-effort, actor personal); (4) la misma notificación al cliente
// (orderUpdateNotification + createNotification, best-effort, tipo "order_update"). La
// notificación a repartidores del flujo terminal (bloque separado, condicionado a
// estado==="en_camino") NO aplica a esta transición y por eso no se reutiliza aquí.
//
// Nota (Seguridad-2B): entregar ya no cobra tarifa de servicio. La única operación
// financiera del ciclo de vida del pedido es la confirmación de recepción del cliente
// (PUT /api/cliente/pedidos/[id] action=confirmar), precondición ya exigida por el CAS
// de abajo (clienteConfirmaRecibido:true).

const CONFLICT_MESSAGE = "El pedido ya no está disponible para confirmar la entrega."

function conflict() {
  return NextResponse.json({ ok: false, error: CONFLICT_MESSAGE }, { status: 409 })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const slug = req.nextUrl.searchParams.get("slug") ?? ""

    // 1) Autorización ANTES de tocar pedidos.
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

    // 2) Negocio SIEMPRE del contexto seguro.
    const negocioId = auth.negocio.id

    // 3) Lectura mínima acotada al negocio y a RETIRO: solo para los efectos posteriores
    //    (auditoría/notificación) si el CAS gana. No decide la mutación y nunca se expone
    //    al cliente. Inexistente / ajeno / mesa / domicilio → mismo conflicto genérico que
    //    el CAS.
    const pedido = await db.pedido.findFirst({
      where: { id, negocioId, metodoEntrega: "retiro" },
      select: { clienteId: true, negocioNombre: true },
    })
    if (!pedido) return noStore(conflict())

    // 4) CAS atómico en transacción: solo si sigue en "listo_para_retirar", es de retiro Y
    //    el cliente ya confirmó la recepción por su propio flujo (clienteConfirmaRecibido:
    //    true — nunca forzado por el empleado ni por la UI). La decisión final es SIEMPRE
    //    el resultado de updateMany (nunca una lectura previa + update libre).
    const won = await db.$transaction(async (tx) => {
      const result = await tx.pedido.updateMany({
        where: {
          id,
          negocioId,
          metodoEntrega: "retiro",
          estado: "listo_para_retirar",
          clienteConfirmaRecibido: true,
        },
        data: { estado: "entregado", entregadoFecha: new Date() },
      })
      return result.count === 1
    })

    if (!won) {
      // Ya no está en "listo_para_retirar" (carrera perdida), cambió entre la lectura y el
      // CAS, o el cliente todavía no confirmó la recepción por su propio flujo.
      return noStore(conflict())
    }

    // 5) Auditoría best-effort (mismo helper que el flujo terminal). Un fallo no revierte
    //    la transición ya confirmada. Actor = cuenta operativa personal (nunca terminal).
    try {
      await logPedidoEstadoChange({
        pedidoId: id,
        estadoNuevo: "entregado",
        estadoAnterior: "listo_para_retirar",
        userId: auth.cuenta.id,
        userType: "cuenta_operativa",
      })
    } catch {
      console.error("[OperativoPyR] Falló la auditoría de confirmación de entrega")
    }

    // 6) Notificación existente al cliente (best-effort), reutilizando exactamente el
    //    mismo helper de payload y el mismo tipo que el flujo terminal. Solo al cliente del
    //    pedido; nunca a mozos, repartidores, terminales, empleados ni al negocio. El flujo
    //    terminal no notifica a repartidores en esta transición (esa notificación está
    //    condicionada a estado==="en_camino"), por lo que aquí tampoco se reutiliza.
    if (pedido.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        const payload = orderUpdateNotification(id, pedido.negocioNombre, "entregado")
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
        console.error("[OperativoPyR] Falló la notificación de confirmación de entrega")
      }
    }

    // 7) Respuesta mínima: nunca se devuelve el pedido completo.
    return noStore(NextResponse.json({ ok: true, pedido: { id } }))
  } catch (error) {
    console.error("[OperativoPyR] Error al confirmar entrega:", error)
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
