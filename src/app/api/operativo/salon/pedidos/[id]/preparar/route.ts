import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { logPedidoEstadoChange } from "@/lib/audit"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO Operaciones — Salón personal: iniciar preparación (Operaciones-1J)
// ============================================
// Acción FIJA (no un endpoint genérico de estados): transición única
//   recibido → preparando  para un pedido de mesa del negocio del empleado.
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) con área
// efectiva "salon". No usa cookie/APIs/scopes de terminal.
//
// El `id` del pedido viene SOLO del parámetro de ruta. El estado destino es fijo en
// servidor ("preparando"). El `slug` (query) solo selecciona el negocio a autorizar;
// no autoriza por sí solo: el resolver valida sesión → cuenta → negocio(slug) →
// empleado vinculado → área efectiva "salon". Nunca se aceptan negocioId/estado/
// mesaNumero/empleadoId/pedidoId desde body/query/headers.

const NO_STORE = { "Cache-Control": "private, no-store" } as const

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

    // 3) Transición atómica (compare-and-swap): solo si sigue en "recibido".
    const result = await db.pedido.updateMany({
      where: {
        id,
        negocioId,
        metodoEntrega: "mesa",
        estado: "recibido",
      },
      data: { estado: "preparando" },
    })

    if (result.count !== 1) {
      // Distinguir 404 (inexistente / otro negocio / no-mesa) de 409 (ya no está en
      // "recibido" / carrera perdida). La consulta se acota al negocio: no revela ajenos.
      const existe = await db.pedido.findFirst({
        where: { id, negocioId, metodoEntrega: "mesa" },
        select: { id: true },
      })
      if (!existe) {
        return noStore(NextResponse.json({ ok: false, error: "Pedido no disponible" }, { status: 404 }))
      }
      return noStore(
        NextResponse.json(
          { ok: false, error: "El pedido ya no está disponible para iniciar preparación" },
          { status: 409 }
        )
      )
    }

    // 4) Auditoría best-effort (mismo helper que el resto del proyecto). Un fallo de
    //    logging NO revierte la transición ya confirmada. Actor = cuenta operativa.
    try {
      await logPedidoEstadoChange({
        pedidoId: id,
        estadoNuevo: "preparando",
        estadoAnterior: "recibido",
        userId: auth.cuenta.id,
        userType: "cuenta_operativa",
      })
    } catch {
      console.error("[OperativoSalon] Falló la auditoría de inicio de preparación")
    }

    return noStore(
      NextResponse.json({ ok: true, estado: "preparando", pedido: { id, estado: "preparando" } })
    )
  } catch (error) {
    console.error("[OperativoSalon] Error al iniciar preparación:", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
