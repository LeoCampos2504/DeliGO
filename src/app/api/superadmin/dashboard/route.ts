import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Constants matching Flask
const LIMITE_SEMANAL_DEUDA = 10000
const LIMITE_MINIMO_DEUDA = 5000
const PORCENTAJE_ALERTA_DEUDA = 0.8

function obtenerLimiteDeuda(negocio: { limiteDeuda: number | null }): number {
  if (negocio.limiteDeuda && negocio.limiteDeuda >= LIMITE_MINIMO_DEUDA) {
    return negocio.limiteDeuda
  }
  return LIMITE_SEMANAL_DEUDA
}

function calcularEstadoSuscripcion(negocio: {
  aprobado: boolean
  suspendido: boolean
  planVencimiento: string | null
}): string {
  if (!negocio.aprobado) return "pendiente"
  if (negocio.suspendido) return "suspendido"
  if (!negocio.planVencimiento) return "sin_plan"

  const vencimiento = new Date(negocio.planVencimiento)
  const ahora = new Date()
  const diasRestantes = Math.ceil(
    (vencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diasRestantes < 0) return "vencido"
  if (diasRestantes <= 7) return "por_vencer"
  return "activo"
}

// GET - SuperAdmin dashboard data
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "superadmin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    // Get all negocios with computed data
    const [pendientes, activosRaw, repartidoresCount, clientesCount, pedidosCount, denunciasCount, clientesBloqueadosCount] =
      await Promise.all([
        // Pending approval (only show email-verified negocios — unverified ones shouldn't appear yet)
        db.negocio.findMany({
          where: { aprobado: false, emailVerified: { not: null } },
          select: {
            id: true,
            nombre: true,
            slug: true,
            rubro: true,
            usuario: true,
            email: true,
            logoUrl: true,
            createdAt: true,
            ofreceDelivery: true,
            whatsapp: true,
            emailVerified: true,
          },
          orderBy: { createdAt: "desc" },
        }),

        // All approved negocios
        db.negocio.findMany({
          where: { aprobado: true },
          select: {
            id: true,
            nombre: true,
            slug: true,
            rubro: true,
            usuario: true,
            logoUrl: true,
            colorPrincipal: true,
            aprobado: true,
            suspendido: true,
            planTipo: true,
            planVencimiento: true,
            planFechaInicio: true,
            planFechaRenovacion: true,
            deudaTarifa: true,
            limiteDeuda: true,
            ofreceDelivery: true,
            promocionado: true,
            ordenPromocion: true,
            destacadoHasta: true,
            puntuacionPromedio: true,
            whatsapp: true,
            createdAt: true,
            _count: {
              select: {
                productos: true,
                pedidos: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),

        db.repartidor.count(),
        db.cliente.count(),
        db.pedido.count({
          where: { estado: "entregado" },
        }),
        db.denuncia.count(),
        db.cliente.count({ where: { bloqueado: true } }),
      ])

    // Compute subscription status and debt for each active negocio
    const activos = activosRaw.map((n) => {
      const estadoSuscripcion = calcularEstadoSuscripcion(n)
      const limite = obtenerLimiteDeuda(n)
      const deudaAlcanzada = n.deudaTarifa >= limite
      const porcentajeDeuda = limite > 0 ? (n.deudaTarifa / limite) * 100 : 0
      const diasRestantes = n.planVencimiento
        ? Math.ceil(
            (new Date(n.planVencimiento).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        : null

      return {
        ...n,
        estadoSuscripcion,
        limiteDeudaCalculado: limite,
        deudaAlcanzada,
        porcentajeDeuda: Math.min(porcentajeDeuda, 100),
        diasRestantes,
        totalProductos: n._count.productos,
        totalPedidos: n._count.pedidos,
      }
    })

    // Categorize activos
    const conAlerta = activos.filter(
      (n) =>
        n.estadoSuscripcion === "vencido" ||
        n.estadoSuscripcion === "por_vencer" ||
        n.estadoSuscripcion === "suspendido"
    )

    const soloActivos = activos.filter(
      (n) =>
        n.estadoSuscripcion === "activo" ||
        n.estadoSuscripcion === "sin_plan"
    )

    // Compute aggregates
    const deudaTotalPlataforma = activos.reduce(
      (sum, n) => sum + n.deudaTarifa,
      0
    )
    const negociosConDeuda = activos.filter(
      (n) => n.deudaTarifa > 0
    ).length

    // Stats
    const stats = {
      pendientes: pendientes.length,
      activos: activos.filter((n) => n.estadoSuscripcion === "activo").length,
      alertas: conAlerta.length,
      deudaTotal: deudaTotalPlataforma,
      negociosConDeuda,
      totalRepartidores: repartidoresCount,
      totalClientes: clientesCount,
      totalPedidosEntregados: pedidosCount,
      denuncias: denunciasCount,
      clientesBloqueados: clientesBloqueadosCount,
    }

    return NextResponse.json({
      stats,
      pendientes,
      activos: soloActivos,
      conAlerta,
      todosLosNegocios: activos,
      constants: {
        tarifaServicio: 250,
        limiteSemanalDeuda: LIMITE_SEMANAL_DEUDA,
        limiteMinimoDeuda: LIMITE_MINIMO_DEUDA,
        porcentajeAlertaDeuda: PORCENTAJE_ALERTA_DEUDA,
      },
    })
  } catch (error) {
    console.error("Error getting superadmin dashboard:", error)
    return NextResponse.json(
      { error: "Error al obtener dashboard" },
      { status: 500 }
    )
  }
}
