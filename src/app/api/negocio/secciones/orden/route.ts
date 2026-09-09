import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

class ReorderValidationError extends Error {
  status = 400
}

function invalidList(message = "La lista de secciones no coincide con el catálogo") {
  return new ReorderValidationError(message)
}

function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034"
  return error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01")
}

/**
 * Reindex the complete SeccionCatalogo list for the authenticated business
 * in a single atomic transaction. SeccionCatalogo.orden is intentionally
 * owned only by this endpoint — never by the generic PUT (see
 * src/app/api/negocio/secciones/[id]/route.ts). Mirrors
 * src/app/api/negocio/productos/orden/route.ts exactly; SeccionProducto.orden
 * (products within a section) is a separate scope and is never touched here.
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
      return NextResponse.json({ error: "Se esperaba { sectionIds: string[] }" }, { status: 400 })
    }

    const rawSectionIds = (body as { sectionIds?: unknown }).sectionIds
    if (!Array.isArray(rawSectionIds) || rawSectionIds.some((id) => typeof id !== "string" || !id.trim())) {
      return NextResponse.json({ error: "sectionIds debe ser un array de IDs no vacíos" }, { status: 400 })
    }

    const sectionIds = rawSectionIds as string[]
    if (new Set(sectionIds).size !== sectionIds.length) {
      return NextResponse.json({ error: "sectionIds no puede contener IDs duplicados" }, { status: 400 })
    }

    const reordered = await db.$transaction(async (tx) => {
      const current = await tx.seccionCatalogo.findMany({
        where: { negocioId: user.id },
        select: { id: true },
      })

      if (current.length === 0 && sectionIds.length > 0) throw invalidList()
      if (current.length > 0 && sectionIds.length === 0) throw invalidList()

      const currentIds = new Set(current.map((section) => section.id))
      if (currentIds.size !== sectionIds.length || sectionIds.some((id) => !currentIds.has(id))) {
        throw invalidList()
      }

      for (const [orden, id] of sectionIds.entries()) {
        await tx.seccionCatalogo.update({
          where: { id },
          data: { orden },
        })
      }

      return tx.seccionCatalogo.findMany({
        where: { negocioId: user.id },
        select: { id: true, orden: true },
        orderBy: { orden: "asc" },
      })
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    return NextResponse.json({ sections: reordered })
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
    console.error("Error reordering secciones:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al ordenar secciones" }, { status: 500 })
  }
}
