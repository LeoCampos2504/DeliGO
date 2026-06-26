import { db } from "@/lib/db"

type IdListResult = { ok: true; ids: string[] } | { ok: false; error: string }

type NegocioResourceRefs = {
  productos?: string[]
  agregados?: string[]
  ingredientes?: string[]
  opcionesCompartidas?: string[]
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids))
}

export function readStringIdList(value: unknown, fieldName: string): IdListResult {
  if (value === undefined) return { ok: true, ids: [] }
  if (!Array.isArray(value)) {
    return { ok: false, error: `${fieldName} debe ser un array de IDs` }
  }

  const ids: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      return { ok: false, error: `${fieldName} contiene IDs invalidos` }
    }
    ids.push(item.trim())
  }

  return { ok: true, ids: uniqueIds(ids) }
}

export function readSharedOptionIdList(value: unknown, fieldName: string): IdListResult {
  if (value === undefined) return { ok: true, ids: [] }
  if (!Array.isArray(value)) {
    return { ok: false, error: `${fieldName} debe ser un array de IDs` }
  }

  const ids: string[] = []
  for (const item of value) {
    if (typeof item === "string") {
      if (!item.trim()) return { ok: false, error: `${fieldName} contiene IDs invalidos` }
      ids.push(item.trim())
      continue
    }

    if (item && typeof item === "object") {
      const id = (item as { id?: unknown }).id
      if (typeof id === "string" && id.trim()) {
        ids.push(id.trim())
        continue
      }
    }

    return { ok: false, error: `${fieldName} contiene IDs invalidos` }
  }

  return { ok: true, ids: uniqueIds(ids) }
}

async function ownsAllProductos(negocioId: string, ids: string[]) {
  if (ids.length === 0) return true
  const count = await db.producto.count({ where: { id: { in: ids }, negocioId } })
  return count === ids.length
}

async function ownsAllAgregados(negocioId: string, ids: string[]) {
  if (ids.length === 0) return true
  const count = await db.agregado.count({ where: { id: { in: ids }, negocioId } })
  return count === ids.length
}

async function ownsAllIngredientes(negocioId: string, ids: string[]) {
  if (ids.length === 0) return true
  const count = await db.ingrediente.count({ where: { id: { in: ids }, negocioId } })
  return count === ids.length
}

async function ownsAllOpcionesCompartidas(negocioId: string, ids: string[]) {
  if (ids.length === 0) return true
  const count = await db.opcionesCompartidas.count({ where: { id: { in: ids }, negocioId } })
  return count === ids.length
}

export async function validateNegocioResourceOwnership(
  negocioId: string,
  refs: NegocioResourceRefs
) {
  const checks = await Promise.all([
    ownsAllProductos(negocioId, refs.productos ?? []),
    ownsAllAgregados(negocioId, refs.agregados ?? []),
    ownsAllIngredientes(negocioId, refs.ingredientes ?? []),
    ownsAllOpcionesCompartidas(negocioId, refs.opcionesCompartidas ?? []),
  ])

  return checks.every(Boolean)
}
