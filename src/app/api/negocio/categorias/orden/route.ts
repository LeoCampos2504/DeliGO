import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

class ReorderValidationError extends Error {
  status = 400
}

function invalidList(message = "La lista de categorías no coincide con las categorías configuradas") {
  return new ReorderValidationError(message)
}

function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034"
  return error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01")
}

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

// CATALOG-CATEGORY-PILL-REORDER-R1: reindex the complete, persisted order of
// Negocio.categorias (the JSON string[] source of truth for category pills —
// there is no Category entity). Pure reorder only: the submitted array must
// be an exact permutation of the currently-configured categories, never a
// partial list, duplicate, or unknown/foreign string. Create/delete/rename
// still go through PUT/PATCH /api/negocio/categorias — this endpoint never
// adds or removes a category, only reorders the existing set. Same
// session-authoritative, full-set, Serializable-transaction contract as
// PATCH /api/negocio/productos/orden and PATCH /api/negocio/secciones/orden.
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
      return NextResponse.json({ error: "Se esperaba { categorias: string[] }" }, { status: 400 })
    }

    const rawCategorias = (body as { categorias?: unknown }).categorias
    if (!Array.isArray(rawCategorias) || rawCategorias.some((c) => typeof c !== "string" || !c.trim())) {
      return NextResponse.json({ error: "categorias debe ser un array de strings no vacíos" }, { status: 400 })
    }

    const categorias = rawCategorias as string[]
    if (new Set(categorias).size !== categorias.length) {
      return NextResponse.json({ error: "categorias no puede contener duplicados" }, { status: 400 })
    }

    const updated = await db.$transaction(
      async (tx) => {
        const negocio = await tx.negocio.findUnique({
          where: { id: user.id },
          select: { categorias: true },
        })
        if (!negocio) throw invalidList("Negocio no encontrado")

        const current = safeParseJSON(negocio.categorias, [])
        const currentCategorias: string[] = Array.isArray(current)
          ? current.filter((c): c is string => typeof c === "string")
          : []

        // Full-set validation: the submitted array must be an exact
        // permutation of what's currently persisted — same multiset, same
        // size. A category "belongs" to this negocio by being in this
        // array, never by a client-sent negocioId.
        const currentSet = new Set(currentCategorias)
        if (currentSet.size !== categorias.length || categorias.some((c) => !currentSet.has(c))) {
          throw invalidList()
        }

        return tx.negocio.update({
          where: { id: user.id },
          data: { categorias: JSON.stringify(categorias) },
          select: { categorias: true },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    return NextResponse.json({ categorias: safeParseJSON(updated.categorias, []) })
  } catch (error) {
    if (error instanceof ReorderValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (isTransactionConflict(error)) {
      return NextResponse.json(
        { error: "Las categorías cambiaron mientras se ordenaban. Volvé a cargar e intentá de nuevo." },
        { status: 409 }
      )
    }
    console.error("Error reordering categorias:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al ordenar categorías" }, { status: 500 })
  }
}
