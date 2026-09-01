import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

class ReorderValidationError extends Error {
  status = 400
}

function invalidList(message = "La lista de productos no coincide con los miembros de la sección") {
  return new ReorderValidationError(message)
}

function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034"
  return error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01")
}

/**
 * Reindex SeccionProducto.orden for ONE section — the products-within-a-
 * section scope, distinct from SeccionCatalogo.orden (order of sections)
 * and Producto.orden (global product order), neither of which this touches.
 * Mirrors productos/orden/route.ts and secciones/orden/route.ts exactly,
 * scoped to a single section's current membership instead of the business's
 * full product/section list. This is the ONLY endpoint that may write
 * SeccionProducto.orden — the generic section PUT
 * (src/app/api/negocio/secciones/[id]/route.ts) treats membership changes
 * as a set operation and never reorders existing members.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { id: seccionId } = await params

    // Section ownership is checked before anything else, and a foreign
    // section is reported the same way as a missing one (404) so this
    // endpoint never confirms whether a given ID belongs to another business.
    const seccion = await db.seccionCatalogo.findUnique({ where: { id: seccionId }, select: { negocioId: true } })
    if (!seccion || seccion.negocioId !== user.id) {
      return NextResponse.json({ error: "Sección no encontrada" }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Se esperaba { productIds: string[] }" }, { status: 400 })
    }

    const rawProductIds = (body as { productIds?: unknown }).productIds
    if (!Array.isArray(rawProductIds) || rawProductIds.some((productId) => typeof productId !== "string" || !productId.trim())) {
      return NextResponse.json({ error: "productIds debe ser un array de IDs no vacíos" }, { status: 400 })
    }

    const productIds = rawProductIds as string[]
    if (new Set(productIds).size !== productIds.length) {
      return NextResponse.json({ error: "productIds no puede contener IDs duplicados" }, { status: 400 })
    }

    const reordered = await db.$transaction(async (tx) => {
      const current = await tx.seccionProducto.findMany({
        where: { seccionId },
        select: { productoId: true },
      })

      if (current.length === 0 && productIds.length > 0) throw invalidList()
      if (current.length > 0 && productIds.length === 0) throw invalidList()

      const currentIds = new Set(current.map((item) => item.productoId))
      if (currentIds.size !== productIds.length || productIds.some((productId) => !currentIds.has(productId))) {
        throw invalidList()
      }

      for (const [orden, productoId] of productIds.entries()) {
        await tx.seccionProducto.update({
          where: { seccionId_productoId: { seccionId, productoId } },
          data: { orden },
        })
      }

      return tx.seccionProducto.findMany({
        where: { seccionId },
        select: { productoId: true, orden: true },
        orderBy: { orden: "asc" },
      })
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    return NextResponse.json({ products: reordered })
  } catch (error) {
    if (error instanceof ReorderValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (isTransactionConflict(error)) {
      return NextResponse.json(
        { error: "La sección cambió mientras se ordenaba. Volvé a cargar e intentá de nuevo." },
        { status: 409 }
      )
    }
    console.error("Error reordering seccion productos:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al ordenar los productos de la sección" }, { status: 500 })
  }
}
