import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

class ReorderValidationError extends Error {
  status = 400
}

function invalidList(message = "La lista de productos no coincide con el catálogo activo") {
  return new ReorderValidationError(message)
}

function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034"
  return error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01")
}

/**
 * Reindex the complete global product list for the authenticated business.
 * Product.orden is intentionally owned only by this endpoint.
 */
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
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
    if (!Array.isArray(rawProductIds) || rawProductIds.some((id) => typeof id !== "string" || !id.trim())) {
      return NextResponse.json({ error: "productIds debe ser un array de IDs no vacíos" }, { status: 400 })
    }

    const productIds = rawProductIds as string[]
    if (new Set(productIds).size !== productIds.length) {
      return NextResponse.json({ error: "productIds no puede contener IDs duplicados" }, { status: 400 })
    }

    const reordered = await db.$transaction(async (tx) => {
      const current = await tx.producto.findMany({
        where: { negocioId: user.id, eliminado: false },
        select: { id: true },
      })

      if (current.length === 0 && productIds.length > 0) throw invalidList()
      if (current.length > 0 && productIds.length === 0) throw invalidList()

      const currentIds = new Set(current.map((product) => product.id))
      if (currentIds.size !== productIds.length || productIds.some((id) => !currentIds.has(id))) {
        throw invalidList()
      }

      for (const [orden, id] of productIds.entries()) {
        await tx.producto.update({
          where: { id },
          data: { orden },
        })
      }

      return tx.producto.findMany({
        where: { negocioId: user.id, eliminado: false },
        select: { id: true, orden: true },
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
        { error: "El catálogo cambió mientras se ordenaba. Volvé a cargar e intentá de nuevo." },
        { status: 409 }
      )
    }
    console.error("Error reordering productos:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al ordenar productos" }, { status: 500 })
  }
}
