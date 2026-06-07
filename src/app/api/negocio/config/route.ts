import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

// GET - Get negocio config
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id

    const negocio = await db.negocio.findUnique({
      where: { id: negocioId },
      include: {
        secciones: {
          orderBy: { orden: "asc" },
          include: {
            productos: {
              include: {
                producto: {
                  select: { id: true, nombre: true, imagenUrl: true },
                },
              },
              orderBy: { orden: "asc" },
            },
          },
        },
      },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
    }

    // Parse JSON fields
    const parsed = {
      ...negocio,
      categorias: safeParseJSON(negocio.categorias, []),
      agregadosCategorias: safeParseJSON(negocio.agregadosCategorias, []),
      ingredientesCategorias: safeParseJSON(negocio.ingredientesCategorias, []),
      seccionesCatalogo: safeParseJSON(negocio.seccionesCatalogo, []),
      horarios: safeParseJSON(negocio.horarios, {}),
      zonasDelivery: safeParseJSON(negocio.zonasDelivery, []),
      zonasSalon: safeParseJSON(negocio.zonasSalon, []),
      secciones: negocio.secciones.map((s) => ({
        ...s,
      })),
    }

    // Remove sensitive fields
    const { password: _, pushSubscription: __, ...safeData } = parsed

    return NextResponse.json(safeData)
  } catch (error) {
    console.error("Error getting config:", error)
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    )
  }
}

// PUT - Update negocio config
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const body = await req.json()

    const {
      nombre,
      whatsapp,
      mensajeBienvenida,
      colorPrincipal,
      ofreceDelivery,
      seguimientoDeliveryActivo,
      aceptaTransferencia,
      aliasBancario,
      toleranciaCancelacion,
      tiempoEntrega,
      horarios,
      zonasDelivery,
      categorias,
      agregadosCategorias,
      ingredientesCategorias,
      instagram,
      facebook,
      logoUrl,
      bannerUrl,
    } = body

    // Validate whatsapp format (digits, spaces, dashes, plus, optional)
    if (whatsapp !== undefined && whatsapp && !/^[\d\s\-+()]+$/.test(whatsapp)) {
      return NextResponse.json(
        { error: "Formato de WhatsApp inválido" },
        { status: 400 }
      )
    }

    // Validate color hex format
    if (colorPrincipal !== undefined && colorPrincipal && !/^#[0-9a-fA-F]{6}$/.test(colorPrincipal)) {
      return NextResponse.json(
        { error: "Formato de color inválido (debe ser #RRGGBB)" },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (nombre !== undefined) {
      const trimmed = nombre.trim()
      const existing = await db.negocio.findUnique({ where: { nombre: trimmed } })
      if (existing && existing.id !== negocioId) {
        return NextResponse.json(
          { error: "Ya existe un local con ese nombre" },
          { status: 409 }
        )
      }
      updateData.nombre = trimmed
    }
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp
    if (mensajeBienvenida !== undefined) updateData.mensajeBienvenida = mensajeBienvenida
    if (colorPrincipal !== undefined) updateData.colorPrincipal = colorPrincipal
    if (ofreceDelivery !== undefined) updateData.ofreceDelivery = ofreceDelivery
    if (seguimientoDeliveryActivo !== undefined) updateData.seguimientoDeliveryActivo = seguimientoDeliveryActivo
    if (aceptaTransferencia !== undefined) updateData.aceptaTransferencia = aceptaTransferencia
    if (aliasBancario !== undefined) updateData.aliasBancario = aliasBancario
    if (toleranciaCancelacion !== undefined) updateData.toleranciaCancelacion = toleranciaCancelacion
    if (tiempoEntrega !== undefined) updateData.tiempoEntrega = tiempoEntrega
    if (horarios !== undefined) updateData.horarios = JSON.stringify(horarios)
    if (zonasDelivery !== undefined) updateData.zonasDelivery = JSON.stringify(zonasDelivery)
    if (categorias !== undefined) updateData.categorias = JSON.stringify(categorias)
    if (agregadosCategorias !== undefined) updateData.agregadosCategorias = JSON.stringify(agregadosCategorias)
    if (ingredientesCategorias !== undefined) updateData.ingredientesCategorias = JSON.stringify(ingredientesCategorias)
    if (instagram !== undefined) updateData.instagram = instagram
    if (facebook !== undefined) updateData.facebook = facebook
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null
    if (bannerUrl !== undefined) updateData.bannerUrl = bannerUrl || null

    const updated = await db.negocio.update({
      where: { id: negocioId },
      data: updateData,
    })

    // Parse JSON fields for response
    const parsed = {
      ...updated,
      categorias: safeParseJSON(updated.categorias, []),
      agregadosCategorias: safeParseJSON(updated.agregadosCategorias, []),
      ingredientesCategorias: safeParseJSON(updated.ingredientesCategorias, []),
      seccionesCatalogo: safeParseJSON(updated.seccionesCatalogo, []),
      horarios: safeParseJSON(updated.horarios, {}),
      zonasDelivery: safeParseJSON(updated.zonasDelivery, []),
      zonasSalon: safeParseJSON(updated.zonasSalon, []),
    }

    // Remove sensitive fields
    const { password: _, pushSubscription: __, ...safeData } = parsed

    return NextResponse.json(safeData)
  } catch (error) {
    console.error("Error updating config:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    )
  }
}

// PATCH - Partial update of negocio config (for image uploads etc)
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    // Support all updatable fields in PATCH
    if (body.nombre !== undefined) {
      const trimmed = body.nombre.trim()
      const existing = await db.negocio.findUnique({ where: { nombre: trimmed } })
      if (existing && existing.id !== negocioId) {
        return NextResponse.json(
          { error: "Ya existe un local con ese nombre" },
          { status: 409 }
        )
      }
      updateData.nombre = trimmed
    }
    if (body.whatsapp !== undefined) updateData.whatsapp = body.whatsapp
    if (body.mensajeBienvenida !== undefined) updateData.mensajeBienvenida = body.mensajeBienvenida
    if (body.colorPrincipal !== undefined) updateData.colorPrincipal = body.colorPrincipal
    if (body.ofreceDelivery !== undefined) updateData.ofreceDelivery = body.ofreceDelivery
    if (body.seguimientoDeliveryActivo !== undefined) updateData.seguimientoDeliveryActivo = body.seguimientoDeliveryActivo
    if (body.aceptaTransferencia !== undefined) updateData.aceptaTransferencia = body.aceptaTransferencia
    if (body.aliasBancario !== undefined) updateData.aliasBancario = body.aliasBancario
    if (body.toleranciaCancelacion !== undefined) updateData.toleranciaCancelacion = body.toleranciaCancelacion
    if (body.tiempoEntrega !== undefined) updateData.tiempoEntrega = body.tiempoEntrega
    if (body.horarios !== undefined) updateData.horarios = JSON.stringify(body.horarios)
    if (body.zonasDelivery !== undefined) updateData.zonasDelivery = JSON.stringify(body.zonasDelivery)
    if (body.categorias !== undefined) updateData.categorias = JSON.stringify(body.categorias)
    if (body.agregadosCategorias !== undefined) updateData.agregadosCategorias = JSON.stringify(body.agregadosCategorias)
    if (body.ingredientesCategorias !== undefined) updateData.ingredientesCategorias = JSON.stringify(body.ingredientesCategorias)
    if (body.instagram !== undefined) updateData.instagram = body.instagram
    if (body.facebook !== undefined) updateData.facebook = body.facebook
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl || null
    if (body.bannerUrl !== undefined) updateData.bannerUrl = body.bannerUrl || null
    if (body.repartidorCodigo !== undefined) {
      // If the code is being changed, invalidate all existing repartidor associations
      // that used the old code so they can no longer access this negocio's orders
      const currentNegocio = await db.negocio.findUnique({
        where: { id: negocioId },
        select: { repartidorCodigo: true },
      })
      const oldCode = currentNegocio?.repartidorCodigo
      if (oldCode && oldCode !== body.repartidorCodigo) {
        // Delete all repartidor associations for this negocio
        // They will need to re-associate with the new code
        await db.repartidorNegocio.deleteMany({
          where: { negocioId },
        })
      }
      updateData.repartidorCodigo = body.repartidorCodigo
    }
    if (body.salonActivo !== undefined) updateData.salonActivo = body.salonActivo
    if (body.empleadosActivos !== undefined) updateData.empleadosActivos = body.empleadosActivos
    if (body.zonasSalon !== undefined) updateData.zonasSalon = JSON.stringify(body.zonasSalon)
    if (body.panelMode !== undefined) updateData.panelMode = body.panelMode
    if (body.horarioMode !== undefined) updateData.horarioMode = body.horarioMode
    if (body.abiertoManual !== undefined) updateData.abiertoManual = body.abiertoManual

    // Auto-generate repartidorCodigo when delivery is enabled and no code exists
    if (body.ofreceDelivery === true) {
      const current = await db.negocio.findUnique({
        where: { id: negocioId },
        select: { repartidorCodigo: true },
      })
      if (!current?.repartidorCodigo && !body.repartidorCodigo) {
        updateData.repartidorCodigo = `NF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      }
    }

    // When delivery is disabled, remove all repartidor associations
    if (body.ofreceDelivery === false) {
      await db.repartidorNegocio.deleteMany({
        where: { negocioId },
      })
    }

    const updated = await db.negocio.update({
      where: { id: negocioId },
      data: updateData,
    })

    // Audit log
    await auditLog({ userId: negocioId, userType: "negocio", accion: "negocio.config_cambiada", recurso: "negocio", recursoId: negocioId, detalle: { cambios: body } })

    // Parse JSON fields for response
    const parsed = {
      ...updated,
      categorias: safeParseJSON(updated.categorias, []),
      agregadosCategorias: safeParseJSON(updated.agregadosCategorias, []),
      ingredientesCategorias: safeParseJSON(updated.ingredientesCategorias, []),
      seccionesCatalogo: safeParseJSON(updated.seccionesCatalogo, []),
      horarios: safeParseJSON(updated.horarios, {}),
      zonasDelivery: safeParseJSON(updated.zonasDelivery, []),
      zonasSalon: safeParseJSON(updated.zonasSalon, []),
    }

    // Remove sensitive fields
    const { password: _, pushSubscription: __, ...safeData } = parsed

    return NextResponse.json(safeData)
  } catch (error) {
    console.error("Error patching config:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    )
  }
}
