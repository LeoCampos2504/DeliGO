import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { notifySuperadmins } from "@/lib/superadmin-notifications"

const PRECIO_DIA = 500
const PRECIO_MES = 10000

// Descuentos por volumen
const DESCUENTOS_POR_MES: Record<number, number> = {
  3: 25000,  // 3 meses: $25.000 en vez de $30.000 (17% off)
  6: 45000,  // 6 meses: $45.000 en vez de $60.000 (25% off)
}

function calcularPrecio(meses: number, dias: number): number {
  if (DESCUENTOS_POR_MES[meses] && dias === 0) {
    return DESCUENTOS_POR_MES[meses]
  }
  return meses * PRECIO_MES + dias * PRECIO_DIA
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const body = await req.json()
    const { meses, dias } = body

    const mesesNum = Number(meses) || 0
    const diasNum = Number(dias) || 0

    if (mesesNum < 0 || diasNum < 0) {
      return NextResponse.json({ error: "Valores inválidos" }, { status: 400 })
    }

    if (mesesNum === 0 && diasNum === 0) {
      return NextResponse.json({ error: "Seleccioná al menos 1 día o 1 mes" }, { status: 400 })
    }

    const precio = calcularPrecio(mesesNum, diasNum)

    // Check if there's already a pending solicitud for this negocio
    const existingPending = await db.destacadoSolicitud.findFirst({
      where: { negocioId: user.id, estado: "pendiente" },
    })

    if (existingPending) {
      return NextResponse.json(
        { error: "Ya tenés una solicitud pendiente. Esperá a que sea procesada." },
        { status: 400 }
      )
    }

    const solicitud = await db.destacadoSolicitud.create({
      data: {
        negocioId: user.id,
        meses: mesesNum,
        dias: diasNum,
        precio,
        estado: "pendiente",
      },
    })

    // P2-T26-R2: notifica a SuperAdmin de la nueva solicitud — R1 encontró
    // este evento sin ninguna notificación pese al tab dedicado
    // "solicitudes-destacado". Este endpoint no usa una transacción (nunca
    // la usó, ni antes de este cambio), así que la notificación es
    // best-effort DESPUÉS de la creación real — un fallo acá nunca debe
    // impedir que la solicitud (ya persistida) se devuelva como exitosa al
    // negocio. El `existingPending` chequeado arriba ya garantiza que esta
    // solicitud es la única activa de este negocio — no hace falta dedupe
    // adicional.
    try {
      await notifySuperadmins(db, {
        tipo: "destacado_solicitud",
        titulo: "Nueva solicitud de destacado",
        cuerpo: `${user.nombre} solicitó destacar su local.`,
        datos: { entityId: solicitud.id, navigateTo: "solicitudes-destacado", negocioId: user.id },
      })
    } catch (notifyError) {
      console.error("[Notificaciones] Failed to notify superadmins of destacado solicitud:", safeErrorForLog(notifyError))
    }

    return NextResponse.json({ solicitud }, { status: 201 })
  } catch (error) {
    console.error("Error creating destacado solicitud:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al crear solicitud" },
      { status: 500 }
    )
  }
}

// GET - Get solicitudes for the current negocio
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

    const solicitudes = await db.destacadoSolicitud.findMany({
      where: { negocioId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    return NextResponse.json({ solicitudes })
  } catch (error) {
    console.error("Error getting destacado solicitudes:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al obtener solicitudes" },
      { status: 500 }
    )
  }
}
