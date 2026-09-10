import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { logPedidoEstadoChange } from "@/lib/audit"
import { createNotification, newDeliveryNotification, waitingDriverNotification } from "@/lib/push"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { CANONICAL_WAITING_DRIVER_STATE } from "@/lib/order-transitions"

// ============================================
// DeliGO Operaciones — PyR personal: buscar repartidor (P2-T42, reemplaza "marcar en camino")
// ============================================
// Acción FIJA (no un endpoint genérico de estados): transición única
//   preparando → esperando_repartidor  para un pedido de DOMICILIO del negocio autorizado.
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) con área efectiva
// "pyr". No usa cookie/APIs/scopes de terminal.
//
// El `id` del pedido viene SOLO del parámetro de ruta. El estado destino es fijo en
// servidor ("esperando_repartidor"). El `slug` (query) solo selecciona el negocio a
// autorizar; no autoriza por sí solo: el resolver valida sesión → cuenta → negocio(slug) →
// empleado vinculado → área efectiva "pyr". Nunca se aceptan estado/negocioId/pedidoId/
// clienteId/empleadoId/terminalId/metodoEntrega/repartidorId/mesaId desde body/query/
// headers.
//
// P2-T42: reemplaza al retirado `.../pedidos/[id]/en-camino/route.ts` — ese endpoint hacía
// preparando→en_camino directo (PyR "marcaba en camino" manualmente y notificaba a TODOS
// los repartidores activos a la vez), el mismo modelo pre-P2-T29C que Negocio ya dejó atrás:
// avanzar a `en_camino` es ahora EXCLUSIVO de la aceptación atómica real de un Repartidor
// (`POST /api/repartidor/pedidos/[id]/aceptar`, single-winner CAS), nunca una acción manual
// de quien gestiona el pedido. El paso correcto para quien gestiona el pedido es hacerlo
// DISPONIBLE (`esperando_repartidor`) — mismo modelo canónico que ya usa Negocio desde
// P2-T29B/C (ver `src/lib/order-transitions.ts`, `CANONICAL_WAITING_DRIVER_STATE`). El
// endpoint terminal equivalente (`operaciones/pyr/pedidos/[id]/estado`) sigue aceptando
// además, a nivel de API, la arista legacy preparando→en_camino directa (rollout) — pero
// esta ruta personal fija es de UN SOLO destino posible, así que se actualiza al destino
// canónico nuevo sin necesidad de aceptar ambos.
//
// Fuente terminal reutilizada (ver CODEX_REPORT.md): el único endpoint terminal real que
// gestiona esta transición para PyR no-mesa es un PATCH genérico multi-estado. Esta ruta
// personal reutiliza EXACTAMENTE, para el caso fijo preparando→esperando_repartidor de
// domicilio: el mismo CAS (id + negocioId + metodoEntrega: "domicilio" + estado="preparando"),
// la misma auditoría (logPedidoEstadoChange, best-effort, actor personal), la misma
// notificación A REPARTIDORES ACTIVOS del negocio (misma consulta
// db.repartidorNegocio.findMany({ where: { negocioId } }) + filtro repartidor.activo en el
// loop, mismo helper newDeliveryNotification + createNotification, best-effort, tipo
// "new_delivery") y, para el cliente, el mismo copy dedicado que ya usa Negocio para este
// estado (waitingDriverNotification — nunca el genérico orderUpdateNotification, que no
// tiene copy para "esperando_repartidor"). Sin crear ningún helper, tipo, payload ni canal
// nuevo.

const CONFLICT_MESSAGE = "El pedido ya no está disponible para buscar un repartidor."

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

    // 3) Lectura mínima acotada al negocio y a DOMICILIO: solo para los efectos posteriores
    //    (auditoría/notificación) si el CAS gana. No decide la mutación y nunca se expone al
    //    cliente. Inexistente / ajeno / mesa / retiro → mismo conflicto genérico que el CAS.
    const pedido = await db.pedido.findFirst({
      where: { id, negocioId, metodoEntrega: "domicilio" },
      select: { clienteId: true, negocioNombre: true, direccion: true },
    })
    if (!pedido) return noStore(conflict())

    // 4) CAS atómico: solo si sigue en "preparando" y es de domicilio. La decisión final es
    //    SIEMPRE el resultado de updateMany (nunca una lectura previa + update libre).
    const result = await db.pedido.updateMany({
      where: {
        id,
        negocioId,
        metodoEntrega: "domicilio",
        estado: "preparando",
      },
      data: { estado: CANONICAL_WAITING_DRIVER_STATE },
    })

    if (result.count !== 1) {
      // Ya no está en "preparando" (carrera perdida) o cambió entre la lectura y el CAS.
      return noStore(conflict())
    }

    // 5) Auditoría best-effort (mismo helper que el flujo terminal). Un fallo no revierte
    //    la transición ya confirmada. Actor = cuenta operativa personal (nunca terminal).
    try {
      await logPedidoEstadoChange({
        pedidoId: id,
        estadoNuevo: CANONICAL_WAITING_DRIVER_STATE,
        estadoAnterior: "preparando",
        userId: auth.cuenta.id,
        userType: "cuenta_operativa",
      })
    } catch {
      console.error("[OperativoPyR] Falló la auditoría de búsqueda de repartidor")
    }

    // 6) Notificación existente al cliente (best-effort), reutilizando exactamente el mismo
    //    copy dedicado que ya usa Negocio para este estado (nunca el genérico, que no tiene
    //    texto para "esperando_repartidor"). Solo al cliente del pedido; nunca a mozos,
    //    terminales, empleados ni al negocio.
    if (pedido.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        const payload = waitingDriverNotification(id)
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
        console.error("[OperativoPyR] Falló la notificación de búsqueda de repartidor")
      }
    }

    // 7) Notificación existente a repartidores activos del negocio (best-effort),
    //    reutilizando exactamente la misma consulta y el mismo helper de payload que el
    //    flujo terminal. Solo corre tras el CAS exitoso de un pedido de domicilio del
    //    negocio autorizado; un fallo no revierte el CAS, la auditoría ni la notificación
    //    al cliente, y no cambia la respuesta de éxito.
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
            // 19-B0.2E1: el cuerpo embebe la dirección de entrega del Cliente.
            sourceClienteId: pedido.clienteId,
            pushSubscription: rn.repartidor.pushSubscription,
            pushPayload: payload,
            cleanupExpired: { model: "repartidor", id: rn.repartidor.id },
          })
        }
      }
    } catch {
      console.error("[OperativoPyR] Falló la notificación a repartidores de búsqueda de repartidor")
    }

    // 8) Respuesta mínima: nunca se devuelve el pedido completo.
    return noStore(NextResponse.json({ ok: true, pedido: { id } }))
  } catch (error) {
    console.error("[OperativoPyR] Error al buscar repartidor:", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
