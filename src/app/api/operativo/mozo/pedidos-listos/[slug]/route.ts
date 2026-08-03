import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"

// ============================================
// DeliGO Operaciones — Mozo personal: pedidos listos asignados (Operaciones-1L.1)
// ============================================
// Vista EXCLUSIVAMENTE de lectura, en una ruta AISLADA y distinta del endpoint legacy
// src/app/api/operativo/mozo/panel/[slug]/route.ts (panel amplio de mesas + tomar/liberar
// mesa), que permanece intacto y sigue siendo consumido por /mozo/panel/[slug]/**. Esta
// ruta no lo modifica, no lo reemplaza ni migra a sus consumidores.
//
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) con área efectiva
// "mozo", vía resolveOperativoAreaForSlug(req, slug, "mozo"). No usa cookie/APIs/scopes de
// terminal. El negocio y el empleado se derivan SIEMPRE de auth.negocio.id/auth.empleado.id
// (contexto ya autorizado); el cliente nunca elige negocioId/empleadoId/mozoId/mesaId/
// pedidoId/rol/scope/estado.
//
// Solo GET, solo pedidos de mesa en "listo_para_retirar" cuyo destinatario efectivo (misma
// semántica exacta que notifyMesaOrderReadyForMozo en src/lib/mesa-order-ready-notification.ts)
// sea el empleado autenticado: (1) asignación directa del pedido (pedido.empleadoId) tiene
// prioridad absoluta si ese empleado es un mozo válido (mismo negocio, areaOperativa==="mozo",
// activo, no eliminado); (2) solo si no hay asignación directa válida, se usa como fallback el
// mozo asignado a la mesa del pedido (mesa activa, mismo negocio, empleado con
// areaOperativa==="mozo", activo, no eliminado). Sin mutaciones de ningún tipo.
// Bugfix-Mozo-1A: la resolución de destinatario ya no usa el campo histórico `rol`.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
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

    // El negocio y el empleado SIEMPRE del contexto seguro; nunca del cliente.
    const negocioId = auth.negocio.id
    const empleadoId = auth.empleado.id

    const respuestaVacia = () =>
      noStore(
        NextResponse.json({
          ok: true,
          negocio: {
            nombre: auth.negocio.nombre,
            slug: auth.negocio.slug,
            colorPrincipal: auth.negocio.colorPrincipal,
          },
          resumen: { pedidosListos: 0, mesasConPedidosListos: 0 },
          pedidos: [],
        })
      )

    // Bugfix-Mozo-1A: notifyMesaOrderReadyForMozo (y este endpoint, con la misma
    // semántica) ahora resuelven el destinatario efectivo por areaOperativa==="mozo",
    // no por el campo histórico rol. auth.empleado ya viene garantizado con área
    // efectiva "mozo" por resolveOperativoAreaForSlug — no hace falta revalidarlo acá.

    // Mesas activas de este negocio asignadas al mozo autenticado: fallback válido de
    // antemano (mesa + empleado ya verificados: activa, mismo negocio, área mozo vía
    // resolveOperativoAreaForSlug comprobado arriba).
    const misMesas = await db.mesa.findMany({
      where: { negocioId, activa: true, empleadoId },
      select: { id: true },
    })
    const misMesaIds = misMesas.map((mesa) => mesa.id)

    // Candidatos acotados en base de datos: pedidos de mesa, listos, de este negocio, que
    // potencialmente me pertenezcan (asignación directa a mí O mesa asignada a mí). El
    // filtrado final y exacto de prioridad/validez ocurre en servidor, no aproximado.
    const candidatos = await db.pedido.findMany({
      where: {
        negocioId,
        metodoEntrega: "mesa",
        estado: "listo_para_retirar",
        OR: [
          { empleadoId },
          ...(misMesaIds.length > 0 ? [{ mesaId: { in: misMesaIds } }] : []),
        ],
      },
      select: {
        id: true,
        total: true,
        empleadoId: true,
        mesaId: true,
        createdAt: true,
      },
    })

    if (candidatos.length === 0) {
      return respuestaVacia()
    }

    // De los candidatos, los asignados directamente a OTRO empleado deben verificarse:
    // si ese otro empleado es un mozo válido, tiene prioridad absoluta y el pedido NO me
    // pertenece, aunque su mesa esté asignada a mí.
    const otrosEmpleadoIds = Array.from(
      new Set(
        candidatos
          .map((pedido) => pedido.empleadoId)
          .filter((id): id is string => !!id && id !== empleadoId)
      )
    )
    const otrosMozosValidos = otrosEmpleadoIds.length
      ? await db.empleado.findMany({
          where: {
            id: { in: otrosEmpleadoIds },
            negocioId,
            areaOperativa: "mozo",
            activo: true,
            eliminado: false,
          },
          select: { id: true },
        })
      : []
    const otrosMozosValidosIds = new Set(otrosMozosValidos.map((empleado) => empleado.id))

    // Regla exacta de destinatario efectivo (misma semántica que resolveMozoDestino):
    // 1) asignación directa a mí → válida (mi área/activo/eliminado ya verificados por
    //    resolveOperativoAreaForSlug antes de llegar acá);
    // 2) asignación directa a otro mozo VÁLIDO → excluir siempre (prioridad ajena, sin
    //    fallback de mesa aunque la mesa sea mía);
    // 3) sin asignación directa válida (null, o a un empleado que no resuelve como mozo
    //    activo del negocio) → fallback: solo si la mesa está entre mis mesas activas.
    const misPedidos = candidatos.filter((pedido) => {
      if (pedido.empleadoId) {
        if (pedido.empleadoId === empleadoId) return true
        if (otrosMozosValidosIds.has(pedido.empleadoId)) return false
      }
      return !!pedido.mesaId && misMesaIds.includes(pedido.mesaId)
    })

    if (misPedidos.length === 0) {
      return respuestaVacia()
    }

    // Datos mínimos de mesa (id, número, nombre, zona) solo para los pedidos finales.
    const mesaIdsFinal = Array.from(
      new Set(misPedidos.map((pedido) => pedido.mesaId).filter((id): id is string => !!id))
    )
    const mesas = mesaIdsFinal.length
      ? await db.mesa.findMany({
          where: { id: { in: mesaIdsFinal }, negocioId },
          select: { id: true, numero: true, nombre: true, zona: true },
        })
      : []
    const mesaPorId = new Map(mesas.map((mesa) => [mesa.id, mesa]))

    // Orden final: zona (ascendente), luego número de mesa (ascendente), luego fecha de
    // creación del pedido (ascendente) como desempate estable.
    const pedidosOut = misPedidos
      .map((pedido) => {
        const mesa = pedido.mesaId ? mesaPorId.get(pedido.mesaId) : undefined
        // Seguridad: si la mesa referenciada ya no resuelve (borrada/de otro negocio),
        // no se muestra un pedido con datos de mesa inconsistentes.
        if (!mesa) return null
        return {
          id: pedido.id,
          estado: "listo_para_retirar" as const,
          total: pedido.total,
          mesa: { id: mesa.id, numero: mesa.numero, nombre: mesa.nombre, zona: mesa.zona },
          createdAt: pedido.createdAt,
        }
      })
      .filter((pedido): pedido is NonNullable<typeof pedido> => pedido !== null)
      .sort((a, b) => {
        const zonaCompare = a.mesa.zona.localeCompare(b.mesa.zona)
        if (zonaCompare !== 0) return zonaCompare
        if (a.mesa.numero !== b.mesa.numero) return a.mesa.numero - b.mesa.numero
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
      .map(({ createdAt: _createdAt, ...pedido }) => pedido)

    const mesasConPedidosListos = new Set(pedidosOut.map((pedido) => pedido.mesa.id)).size

    return noStore(
      NextResponse.json({
        ok: true,
        negocio: {
          nombre: auth.negocio.nombre,
          slug: auth.negocio.slug,
          colorPrincipal: auth.negocio.colorPrincipal,
        },
        resumen: {
          pedidosListos: pedidosOut.length,
          mesasConPedidosListos,
        },
        pedidos: pedidosOut,
      })
    )
  } catch (error) {
    console.error("[OperativoMozoPedidosListos] Error loading pedidos listos:", error)
    return noStore(
      NextResponse.json({ ok: false, error: "No se pudieron cargar los pedidos" }, { status: 500 })
    )
  }
}
