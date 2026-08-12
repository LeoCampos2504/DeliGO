import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { logPedidoEstadoChange } from "@/lib/audit"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO Operaciones — Mozo personal: marcar entregado (Operaciones-1M + 1M.1)
// ============================================
// Acción FIJA (no un endpoint genérico de estados): transición única
//   listo_para_retirar → entregado  para un pedido de mesa cuyo destinatario efectivo sea
// el mozo autenticado. Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session)
// con área efectiva "mozo". No usa cookie/APIs/scopes de terminal.
//
// El `id` del pedido viene SOLO del parámetro de ruta. El estado destino es fijo en
// servidor ("entregado"). El `slug` (query) solo selecciona el negocio a autorizar; no
// autoriza por sí solo. No se lee body. Nunca se aceptan negocioId/empleadoId/mesaId/
// estado/estadoDestino/rol/scope desde body/query/headers.
//
// Regla de destinatario efectivo IDÉNTICA a resolveMozoDestino (usada por
// notifyMesaOrderReadyForMozo en src/lib/mesa-order-ready-notification.ts): asignación
// directa del pedido (pedido.empleadoId) tiene prioridad absoluta si ese empleado es un
// mozo válido (mismo negocio, areaOperativa==="mozo", activo, no eliminado); solo si no hay
// asignación directa válida se usa como fallback el mozo asignado a la mesa (mesa activa,
// mismo negocio, empleado con areaOperativa==="mozo", activo, no eliminado). Solo el mozo
// autenticado puede entregar cuando ES ese destinatario efectivo — nunca por pertenecer al
// mismo negocio, por conocer el id, ni por empleadoId enviado por el cliente.
// Bugfix-Mozo-1A: la resolución de destinatario ya no usa el campo histórico `rol`.
//
// Operaciones-1M.1: la revalidación del mozo autenticado, la resolución del destinatario
// efectivo y el CAS ahora ocurren TODOS dentro de una única transacción serializable
// (mismo patrón db.$transaction(..., { isolationLevel: Serializable }) ya usado por
// mesa-order-ready-notification.ts y por el endpoint legacy de mozo). Esto cierra la
// ventana de carrera donde una reasignación de pedido.empleadoId o Mesa.empleadoId entre
// la resolución del destinatario y el CAS podía permitir una entrega indebida.
//
// No llama notifyMesaOrderReadyForMozo: ese helper corresponde a notificar que un pedido
// quedó listo, no a informar una entrega. No se crean notificaciones nuevas.

type ResultadoEntrega = "ok" | "not_available" | "state_conflict"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const slug = req.nextUrl.searchParams.get("slug") ?? ""

    // 1) Autorización ANTES de tocar pedidos.
    const auth = await resolveOperativoAreaForSlug(req, slug, "mozo")
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

    // 2) Negocio y empleado SIEMPRE del contexto seguro.
    const negocioId = auth.negocio.id
    const empleadoId = auth.empleado.id

    // 3) Revalidación del destinatario efectivo + CAS, todo dentro de una única
    // transacción serializable: ninguna lectura/escritura relevante usa `db.*` a partir de
    // acá, solo `tx.*`. Se devuelve un resultado interno seguro (nunca datos de Pedido,
    // Mesa ni Empleado) para que fuera de la transacción solo se decida el código HTTP.
    let resultado: ResultadoEntrega
    try {
      resultado = await db.$transaction(
        async (tx) => {
          // 3.1) Revalidar al empleado autenticado con los mismos cuatro criterios que
          // usa resolveMozoDestino — no confiar únicamente en el área resuelta antes de
          // la transacción (podría haber cambiado entre la autorización y acá).
          const mozoAutenticado = await tx.empleado.findFirst({
            where: {
              id: empleadoId,
              negocioId,
              areaOperativa: "mozo",
              activo: true,
              eliminado: false,
            },
            select: { id: true },
          })
          if (!mozoAutenticado) return "not_available" as const

          // 3.2) Pedido candidato acotado al negocio autorizado y a método mesa.
          const pedido = await tx.pedido.findFirst({
            where: { id, negocioId, metodoEntrega: "mesa" },
            select: { empleadoId: true, mesaId: true },
          })
          if (!pedido) return "not_available" as const

          // 3.3) Destinatario efectivo, misma semántica exacta que resolveMozoDestino:
          //    a) asignación directa a un mozo válido → único destinatario, sin fallback
          //       de mesa (aunque la mesa esté asignada al mozo autenticado);
          //    b) sin asignación directa válida → fallback: mozo de la mesa (activa,
          //       mismo negocio, areaOperativa mozo, activo, no eliminado).
          let soyDestinatario = false

          if (pedido.empleadoId) {
            if (pedido.empleadoId === empleadoId) {
              // Asignación directa a mí: válida (ya revalidada en 3.1).
              soyDestinatario = true
            } else {
              const otroEsMozoValido = await tx.empleado.findFirst({
                where: {
                  id: pedido.empleadoId,
                  negocioId,
                  areaOperativa: "mozo",
                  activo: true,
                  eliminado: false,
                },
                select: { id: true },
              })
              // Si el otro empleado es un mozo válido, tiene prioridad absoluta: nunca
              // entrego, aunque la mesa esté asignada a mí. Si NO es válido, cae al
              // fallback de mesa.
              if (!otroEsMozoValido && pedido.mesaId) {
                const mesa = await tx.mesa.findFirst({
                  where: { id: pedido.mesaId, negocioId, activa: true },
                  select: { empleadoId: true },
                })
                soyDestinatario = mesa?.empleadoId === empleadoId
              }
            }
          } else if (pedido.mesaId) {
            const mesa = await tx.mesa.findFirst({
              where: { id: pedido.mesaId, negocioId, activa: true },
              select: { empleadoId: true },
            })
            soyDestinatario = mesa?.empleadoId === empleadoId
          }

          if (!soyDestinatario) return "not_available" as const

          // 3.4) Transición atómica (compare-and-swap) DENTRO de la misma transacción
          // serializable que acaba de confirmar el destinatario: ninguna reasignación
          // concurrente entre la validación y el CAS puede colarse. Mismo campo adicional
          // que la transición canónica de terminal (entregadoFecha).
          const result = await tx.pedido.updateMany({
            where: {
              id,
              negocioId,
              metodoEntrega: "mesa",
              estado: "listo_para_retirar",
            },
            data: { estado: "entregado", entregadoFecha: new Date() },
          })

          return result.count === 1 ? ("ok" as const) : ("state_conflict" as const)
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (txError) {
      // Conflicto de serialización u otro error de la transacción: no convertir en éxito,
      // no entregar sin revalidación, no responder 404 (no reintenta: no existe en el
      // proyecto un patrón importable y reutilizable de retry para este caso, solo
      // helpers privados duplicados por archivo en otros endpoints). Se usa la conducta
      // genérica de error ya existente.
      console.error("[OperativoMozo] Error en la transacción de entrega:", safeErrorForLog(txError))
      return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
    }

    if (resultado === "not_available") {
      // No revela si el pedido existe, a quién pertenece ni su estado actual.
      return noStore(NextResponse.json({ ok: false, error: "Pedido no disponible" }, { status: 404 }))
    }

    if (resultado === "state_conflict") {
      return noStore(
        NextResponse.json(
          { ok: false, error: "El pedido ya no está disponible para marcar como entregado" },
          { status: 409 }
        )
      )
    }

    // 4) Auditoría best-effort (mismo helper que el resto del proyecto), SOLO tras una
    //    transición confirmada (resultado === "ok"). Un fallo de logging NO revierte la
    //    entrega ya confirmada. Actor = cuenta operativa.
    try {
      await logPedidoEstadoChange({
        pedidoId: id,
        estadoNuevo: "entregado",
        estadoAnterior: "listo_para_retirar",
        userId: auth.cuenta.id,
        userType: "cuenta_operativa",
      })
    } catch {
      console.error("[OperativoMozo] Falló la auditoría de entrega")
    }

    // No se llama notifyMesaOrderReadyForMozo: ese helper es exclusivamente para avisar
    // que un pedido quedó listo, no para informar una entrega. Sin notificaciones nuevas.

    return noStore(
      NextResponse.json({ ok: true, estado: "entregado", pedido: { id, estado: "entregado" } })
    )
  } catch (error) {
    console.error("[OperativoMozo] Error al marcar como entregado:", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
