import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { logPedidoEstadoChange } from "@/lib/audit"
import { notifyMesaOrderReadyForMozo } from "@/lib/mesa-order-ready-notification"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"

// ============================================
// DeliGO Operaciones — Salón personal: marcar como listo (Operaciones-1K + 1K.1)
// ============================================
// Acción FIJA (no un endpoint genérico de estados): transición única
//   preparando → listo_para_retirar  para un pedido de mesa del negocio del empleado.
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) con área
// efectiva "salon". No usa cookie/APIs/scopes de terminal.
//
// El `id` del pedido viene SOLO del parámetro de ruta. El estado destino es fijo en
// servidor ("listo_para_retirar"). El `slug` (query) solo selecciona el negocio a
// autorizar; no autoriza por sí solo: el resolver valida sesión → cuenta → negocio(slug)
// → empleado vinculado → área efectiva "salon". Nunca se aceptan negocioId/estado/
// mesaNumero/empleadoId/pedidoId desde body/query/headers.
//
// Operaciones-1K.1: paridad con la terminal — reutiliza EXACTAMENTE el mismo helper de
// notificación al mozo (notifyMesaOrderReadyForMozo) que usa
// /api/operaciones/salon/pedidos/[id]/estado, con la misma firma y el mismo patrón
// best-effort. Se invoca únicamente después de confirmar el CAS (nunca ante 404/409).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const slug = req.nextUrl.searchParams.get("slug") ?? ""

    // 1) Autorización ANTES de tocar pedidos.
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

    // 2) Negocio SIEMPRE del contexto seguro.
    const negocioId = auth.negocio.id

    // 3) Transición atómica (compare-and-swap): solo si sigue en "preparando".
    const result = await db.pedido.updateMany({
      where: {
        id,
        negocioId,
        metodoEntrega: "mesa",
        estado: "preparando",
      },
      data: { estado: "listo_para_retirar" },
    })

    if (result.count !== 1) {
      // Distinguir 404 (inexistente / otro negocio / no-mesa) de 409 (ya no está en
      // "preparando" / carrera perdida). La consulta se acota al negocio: no revela ajenos.
      const existe = await db.pedido.findFirst({
        where: { id, negocioId, metodoEntrega: "mesa" },
        select: { id: true },
      })
      if (!existe) {
        return noStore(NextResponse.json({ ok: false, error: "Pedido no disponible" }, { status: 404 }))
      }
      return noStore(
        NextResponse.json(
          { ok: false, error: "El pedido ya no está disponible para marcar como listo" },
          { status: 409 }
        )
      )
    }

    // 4) Auditoría best-effort (mismo helper que el resto del proyecto). Un fallo de
    //    logging NO revierte la transición ya confirmada. Actor = cuenta operativa.
    try {
      await logPedidoEstadoChange({
        pedidoId: id,
        estadoNuevo: "listo_para_retirar",
        estadoAnterior: "preparando",
        userId: auth.cuenta.id,
        userType: "cuenta_operativa",
      })
    } catch {
      console.error("[OperativoSalon] Falló la auditoría de marcado como listo")
    }

    // 5) Notificación al mozo asignado, SOLO tras el CAS exitoso. Reutiliza exactamente el
    //    mismo helper que la terminal (mismos datos mínimos, mismo patrón best-effort): un
    //    fallo no revierte la transición ya confirmada ni cambia la respuesta HTTP. mesaId/
    //    mesaNumero/empleadoId no forman parte del contexto de autorización — se leen acá,
    //    acotados al pedido ya confirmado (id + negocioId + metodoEntrega:"mesa"), solo para
    //    completar los datos mínimos que exige la firma del helper.
    try {
      const pedidoParaNotificar = await db.pedido.findFirst({
        where: { id, negocioId, metodoEntrega: "mesa" },
        select: { mesaId: true, mesaNumero: true, empleadoId: true },
      })
      if (pedidoParaNotificar) {
        await notifyMesaOrderReadyForMozo({
          pedido: {
            id,
            negocioId,
            negocioSlug: auth.negocio.slug,
            metodoEntrega: "mesa",
            mesaId: pedidoParaNotificar.mesaId,
            mesaNumero: pedidoParaNotificar.mesaNumero,
            empleadoId: pedidoParaNotificar.empleadoId,
          },
          estadoAnterior: "preparando",
        })
      }
    } catch {
      console.error("[OperativoSalon] Falló la notificación al mozo")
    }

    return noStore(
      NextResponse.json({
        ok: true,
        estado: "listo_para_retirar",
        pedido: { id, estado: "listo_para_retirar" },
      })
    )
  } catch (error) {
    console.error("[OperativoSalon] Error al marcar como listo:", error)
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
