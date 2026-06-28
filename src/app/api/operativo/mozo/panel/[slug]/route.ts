import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { db } from "@/lib/db"
import {
  noStore,
  resolveOperativoMozoForSlug,
} from "@/lib/operativo-mozo"

const ACTIVE_MESA_ORDER_STATES = ["recibido", "preparando", "listo_para_retirar"]
const SERIALIZATION_RETRY_LIMIT = 3
const ACTIVE_ORDERS_RELEASE_MESSAGE =
  "No podés liberar una mesa que tiene pedidos activos. Finalizá o transferí los pedidos antes."

type MesaWithEmpleado = {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  activa: boolean
  empleadoId: string | null
}

type MesaOrder = {
  id: string
  mesaNumero: number | null
  estado: string
  total: number
}

function buildMesaOrdersMap(orders: MesaOrder[]) {
  const map = new Map<number, MesaOrder[]>()
  for (const order of orders) {
    if (!order.mesaNumero) continue
    if (!map.has(order.mesaNumero)) {
      map.set(order.mesaNumero, [])
    }
    map.get(order.mesaNumero)!.push(order)
  }
  return map
}

function serializeMesa(
  mesa: MesaWithEmpleado,
  empleadoId: string,
  ordersMap: Map<number, MesaOrder[]>
) {
  const orders = ordersMap.get(mesa.numero) ?? []
  return {
    id: mesa.id,
    numero: mesa.numero,
    nombre: mesa.nombre,
    zona: mesa.zona,
    capacidad: mesa.capacidad,
    activa: mesa.activa,
    asignadaAMi: mesa.empleadoId === empleadoId,
    asignadaAOtro: !!mesa.empleadoId && mesa.empleadoId !== empleadoId,
    pedidosActivos: orders.map((order) => ({
      id: order.id,
      estado: order.estado,
      total: order.total,
    })),
    pedidosActivosCount: orders.length,
    pedidosActivosTotal: orders.reduce((sum, order) => sum + order.total, 0),
  }
}

async function getActiveMesaOrders(negocioId: string) {
  return db.pedido.findMany({
    where: {
      negocioId,
      metodoEntrega: "mesa",
      estado: { in: ACTIVE_MESA_ORDER_STATES },
    },
    select: {
      id: true,
      mesaNumero: true,
      estado: true,
      total: true,
    },
  })
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_LIMIT; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === SERIALIZATION_RETRY_LIMIT) {
        throw error
      }
    }
  }

  throw new Error("SERIALIZATION_RETRY_EXHAUSTED")
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoMozoForSlug(req, slug)

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

    const [mesas, orders] = await Promise.all([
      db.mesa.findMany({
        where: {
          negocioId: auth.negocio.id,
          activa: true,
        },
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          nombre: true,
          zona: true,
          capacidad: true,
          activa: true,
          empleadoId: true,
        },
      }),
      getActiveMesaOrders(auth.negocio.id),
    ])

    const ordersMap = buildMesaOrdersMap(orders)
    const mesasOperativas = mesas.map((mesa) =>
      serializeMesa(mesa, auth.empleado.id, ordersMap)
    )

    return noStore(
      NextResponse.json({
        ok: true,
        estado: "operativo",
        cuenta: {
          id: auth.cuenta.id,
          nombre: auth.cuenta.nombre,
        },
        empleado: {
          nombre: auth.empleado.nombre,
          codigo: auth.empleado.codigo,
          rol: auth.empleado.rol,
          activo: auth.empleado.activo,
        },
        negocio: {
          nombre: auth.negocio.nombre,
          slug: auth.negocio.slug,
          colorPrincipal: auth.negocio.colorPrincipal,
          logoUrl: auth.negocio.logoUrl,
          salonActivo: auth.negocio.salonActivo,
        },
        resumen: {
          mesasActivas: mesasOperativas.length,
          misMesas: mesasOperativas.filter((mesa) => mesa.asignadaAMi).length,
          mesasConPedidos: mesasOperativas.filter((mesa) => mesa.pedidosActivosCount > 0).length,
        },
        mesas: mesasOperativas,
        accionesDisponibles: ["tomar_mesa", "liberar_mesa"],
      })
    )
  } catch (error) {
    console.error("[OperativoMozoPanel] Error loading panel:", error)
    return noStore(
      NextResponse.json(
        { ok: false, error: "No se pudo cargar el salón" },
        { status: 500 }
      )
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoMozoForSlug(req, slug)

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

    const body = await req.json()
    const mesaId = typeof body.mesaId === "string" ? body.mesaId.trim() : ""
    const accion = typeof body.accion === "string" ? body.accion : ""

    if (!mesaId || !["tomar_mesa", "liberar_mesa"].includes(accion)) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Acción inválida" },
          { status: 400 }
        )
      )
    }

    const mesa = await db.mesa.findFirst({
      where: {
        id: mesaId,
        negocioId: auth.negocio.id,
        activa: true,
      },
      select: {
        id: true,
        numero: true,
        empleadoId: true,
      },
    })

    if (!mesa) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Mesa no disponible" },
          { status: 404 }
        )
      )
    }

    if (accion === "tomar_mesa") {
      if (mesa.empleadoId !== auth.empleado.id) {
        const result = await db.mesa.updateMany({
          where: {
            id: mesa.id,
            negocioId: auth.negocio.id,
            activa: true,
            empleadoId: null,
          },
          data: {
            empleadoId: auth.empleado.id,
          },
        })

        if (result.count === 0) {
          const currentMesa = await db.mesa.findFirst({
            where: {
              id: mesa.id,
              negocioId: auth.negocio.id,
              activa: true,
            },
            select: { empleadoId: true },
          })

          if (!currentMesa) {
            return noStore(
              NextResponse.json(
                { ok: false, error: "Mesa no disponible" },
                { status: 404 }
              )
            )
          }

          if (currentMesa.empleadoId !== auth.empleado.id) {
            return noStore(
              NextResponse.json(
                { ok: false, error: "Esta mesa ya está asignada" },
                { status: 409 }
              )
            )
          }
        } else {
          await auditLog({
            userId: auth.cuenta.id,
            userType: "cuenta_operativa",
            accion: "mozo.mesa_tomada",
            recurso: "mesa",
            recursoId: mesa.id,
            detalle: {
              negocioId: auth.negocio.id,
              empleadoId: auth.empleado.id,
              mesaId: mesa.id,
              numeroMesa: mesa.numero,
              accion: "tomar_mesa",
            },
          })
        }
      }
    } else {
      let releasedMesa: { id: string; numero: number }

      try {
        releasedMesa = await withSerializableRetry(() =>
          db.$transaction(
            async (tx) => {
              const currentMesa = await tx.mesa.findFirst({
                where: {
                  id: mesaId,
                  negocioId: auth.negocio.id,
                  activa: true,
                },
                select: {
                  id: true,
                  numero: true,
                  empleadoId: true,
                },
              })

              if (!currentMesa) {
                throw new Error("MESA_NOT_FOUND")
              }

              if (currentMesa.empleadoId !== auth.empleado.id) {
                throw new Error("MESA_NOT_OWNED")
              }

              const activeOrdersCount = await tx.pedido.count({
                where: {
                  negocioId: auth.negocio.id,
                  metodoEntrega: "mesa",
                  mesaNumero: currentMesa.numero,
                  estado: { in: ACTIVE_MESA_ORDER_STATES },
                },
              })

              if (activeOrdersCount > 0) {
                throw new Error("MESA_HAS_ACTIVE_ORDERS")
              }

              const result = await tx.mesa.updateMany({
                where: {
                  id: currentMesa.id,
                  negocioId: auth.negocio.id,
                  activa: true,
                  empleadoId: auth.empleado.id,
                },
                data: {
                  empleadoId: null,
                },
              })

              if (result.count !== 1) {
                throw new Error("MESA_NOT_OWNED")
              }

              return {
                id: currentMesa.id,
                numero: currentMesa.numero,
              }
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
          )
        )
      } catch (error) {
        if (error instanceof Error && error.message === "MESA_NOT_FOUND") {
          return noStore(
            NextResponse.json(
              { ok: false, error: "Mesa no disponible" },
              { status: 404 }
            )
          )
        }

        if (error instanceof Error && error.message === "MESA_NOT_OWNED") {
          return noStore(
            NextResponse.json(
              { ok: false, error: "Solo podés liberar mesas asignadas a tu cuenta" },
              { status: 403 }
            )
          )
        }

        if (error instanceof Error && error.message === "MESA_HAS_ACTIVE_ORDERS") {
          return noStore(
            NextResponse.json(
              { ok: false, error: ACTIVE_ORDERS_RELEASE_MESSAGE },
              { status: 409 }
            )
          )
        }

        if (isSerializationConflict(error)) {
          return noStore(
            NextResponse.json(
              { ok: false, error: "No se pudo liberar la mesa. Intentá nuevamente." },
              { status: 409 }
            )
          )
        }

        throw error
      }

      await auditLog({
        userId: auth.cuenta.id,
        userType: "cuenta_operativa",
        accion: "mozo.mesa_liberada",
        recurso: "mesa",
        recursoId: releasedMesa.id,
        detalle: {
          negocioId: auth.negocio.id,
          empleadoId: auth.empleado.id,
          mesaId: releasedMesa.id,
          numeroMesa: releasedMesa.numero,
          accion: "liberar_mesa",
        },
      })
    }

    const [updatedMesa, orders] = await Promise.all([
      db.mesa.findFirst({
        where: {
          id: mesa.id,
          negocioId: auth.negocio.id,
        },
        select: {
          id: true,
          numero: true,
          nombre: true,
          zona: true,
          capacidad: true,
          activa: true,
          empleadoId: true,
        },
      }),
      getActiveMesaOrders(auth.negocio.id),
    ])

    if (!updatedMesa) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Mesa no disponible" },
          { status: 404 }
        )
      )
    }

    return noStore(
      NextResponse.json({
        ok: true,
        mesa: serializeMesa(updatedMesa, auth.empleado.id, buildMesaOrdersMap(orders)),
      })
    )
  } catch (error) {
    console.error("[OperativoMozoPanel] Error applying action:", error)
    return noStore(
      NextResponse.json(
        { ok: false, error: "No se pudo completar la acción" },
        { status: 500 }
      )
    )
  }
}
