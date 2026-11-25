import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Mesas activas de un negocio por slug para la vista de mesa de `/n/[slug]` (customerMesaData).
//
// BUG-003 (2026-11-25). Pese a su nombre, esta ruta NO es anónima: vive bajo `/api/negocio/*`, que el proxy protege
// con sesión de dueño, así que hoy sólo la alcanza el propio dueño (p. ej. la vista previa de su negocio). Antes no
// validaba la sesión y CUALQUIER dueño podía leer, por slug, las mesas de otro negocio con el nombre y el código
// interno de sus mozos. Ahora:
//   - BUG-003B aislamiento: la sesión de dueño se valida en el servidor y debe ser la del negocio del slug; si no,
//     404 genérico (no revela si el negocio o sus mesas existen) y nada de datos.
//   - BUG-003B privacidad: no devuelve datos de empleados (ni código interno, ni nombres, ni nada de su cuenta
//     operativa o su vinculación).
//   - BUG-003A presentación: el modelo no tiene un nombre de atención destinado al público (Empleado.nombre no lo es
//     automáticamente: puede ser el marcador «Pendiente de vinculación» o un nombre heredado), así que `mozoAsignado`
//     es siempre null y la vista muestra «Tu pedido será servido en esta mesa». Se conserva la clave por compatibilidad.
// No convierte la ruta en anónima ni cambia qué mesas devuelve.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    const user = token ? await getUserFromToken(token) : null
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const slug = searchParams.get("slug")

    if (!slug) {
      return NextResponse.json({ error: "Slug requerido" }, { status: 400 })
    }

    // Find negocio by slug — sólo el negocio de la sesión; cualquier otro responde igual que uno inexistente.
    const negocio = await db.negocio.findUnique({
      where: { slug },
      select: { id: true, salonActivo: true },
    })

    if (!negocio || negocio.id !== user.id) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
    }

    if (!negocio.salonActivo) {
      return NextResponse.json({ error: "Salón no activo" }, { status: 400 })
    }

    const mesas = await db.mesa.findMany({
      where: {
        negocioId: negocio.id,
        activa: true,
      },
      orderBy: { numero: "asc" },
      select: { id: true, numero: true, nombre: true, zona: true, capacidad: true },
    })

    const formatted = mesas.map((m) => ({
      id: m.id,
      numero: m.numero,
      nombre: m.nombre,
      zona: m.zona,
      capacidad: m.capacidad,
      // BUG-003A: sin nombre de atención público en el modelo → nunca se expone un nombre de empleado.
      mozoAsignado: null,
    }))

    return NextResponse.json({ mesas: formatted })
  } catch (error) {
    console.error("Error fetching public mesas:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al obtener mesas" },
      { status: 500 }
    )
  }
}
