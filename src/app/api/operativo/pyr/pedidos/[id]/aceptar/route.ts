import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { logPedidoEstadoChange } from "@/lib/audit"
import { createNotification, orderUpdateNotification } from "@/lib/push"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { CANONICAL_ACCEPTED_STATE } from "@/lib/order-transitions"

// ============================================
// DeliGO Operaciones — PyR personal: aceptar pedido (P2-T42)
// ============================================
// Acción FIJA (no un endpoint genérico de estados): transición única
//   recibido → aceptado  para un pedido no-mesa (domicilio/retiro) del negocio autorizado.
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) con área efectiva
// "pyr". No usa cookie/APIs/scopes de terminal.
//
// El `id` del pedido viene SOLO del parámetro de ruta. El estado destino es fijo en
// servidor ("aceptado"). El `slug` (query) solo selecciona el negocio a autorizar; no
// autoriza por sí solo: el resolver valida sesión → cuenta → negocio(slug) → empleado
// vinculado → área efectiva "pyr". Nunca se aceptan estado/negocioId/pedidoId/clienteId/
// empleadoId/terminalId/metodoEntrega/repartidorId/mesaId desde body/query/headers.
//
// P2-T42: inserta el paso de aceptación explícita que ya usa Negocio desde P2-T29B
// (recibido→aceptado→preparando en vez de recibido→preparando directo) — el modelo
// canónico vigente, ver `src/lib/order-transitions.ts` (`PYR_ROLLOUT_FORWARD_TRANSITIONS`,
// alias de `NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS`, reutilizado sin copiarlo por
// `operaciones/pyr/pedidos/[id]/estado`, el endpoint Terminal equivalente). Reutiliza
// EXACTAMENTE el mismo CAS (id + negocioId + metodoEntrega != "mesa" + estado="recibido"),
// la misma auditoría (logPedidoEstadoChange, best-effort, actor personal) y la misma
// notificación al cliente (orderUpdateNotification — ya tiene copy propio para "aceptado",
// ver push.ts P2-T29D — + createNotification, best-effort, tipo "order_update") que ya usan
// `preparar`/`buscar-repartidor`, sin crear ningún helper, tipo, payload ni canal nuevo.
// Sin notificación a repartidores en este paso (igual que Negocio: sólo
// preparando->esperando_repartidor dispara esa notificación).

const CONFLICT_MESSAGE = "El pedido ya no está disponible para aceptarlo."

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

    // 3) Lectura mínima acotada al negocio y NO-mesa: solo para los efectos posteriores
    //    (auditoría/notificación) si el CAS gana. No decide la mutación y nunca se expone
    //    al cliente. Inexistente / ajeno / mesa → mismo conflicto genérico que el CAS.
    const pedido = await db.pedido.findFirst({
      where: { id, negocioId, metodoEntrega: { not: "mesa" } },
      select: { clienteId: true, negocioNombre: true },
    })
    if (!pedido) return noStore(conflict())

    // 4) CAS atómico: solo si sigue en "recibido". La decisión final es SIEMPRE el
    //    resultado de updateMany (nunca una lectura previa + update libre).
    const result = await db.pedido.updateMany({
      where: {
        id,
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: "recibido",
      },
      data: { estado: CANONICAL_ACCEPTED_STATE },
    })

    if (result.count !== 1) {
      // Ya no está en "recibido" (carrera perdida) o cambió entre la lectura y el CAS.
      return noStore(conflict())
    }

    // 5) Auditoría best-effort (mismo helper que el flujo terminal). Un fallo no revierte
    //    la transición ya confirmada. Actor = cuenta operativa personal (nunca terminal).
    try {
      await logPedidoEstadoChange({
        pedidoId: id,
        estadoNuevo: CANONICAL_ACCEPTED_STATE,
        estadoAnterior: "recibido",
        userId: auth.cuenta.id,
        userType: "cuenta_operativa",
      })
    } catch {
      console.error("[OperativoPyR] Falló la auditoría de aceptación de pedido")
    }

    // 6) Notificación existente al cliente (best-effort), reutilizando exactamente el
    //    mismo helper de payload (ya tiene copy para "aceptado") y el mismo tipo que el
    //    flujo terminal. Solo al cliente del pedido; nunca a mozos, terminales, empleados
    //    ni al negocio.
    if (pedido.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        const payload = orderUpdateNotification(id, pedido.negocioNombre, CANONICAL_ACCEPTED_STATE)
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
        console.error("[OperativoPyR] Falló la notificación de aceptación de pedido")
      }
    }

    // 7) Respuesta mínima: nunca se devuelve el pedido completo.
    return noStore(NextResponse.json({ ok: true, pedido: { id } }))
  } catch (error) {
    console.error("[OperativoPyR] Error al aceptar pedido:", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
