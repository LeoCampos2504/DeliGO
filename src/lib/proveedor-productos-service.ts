// ============================================
// F5 / F10-C2b — productos y variantes que entrega cada proveedor (muchos a muchos)
// ============================================
// Sólo configuración: sirve para mostrar primero, al pedir o recibir, lo que entrega ese proveedor.
// Nunca crea ni duplica productos o inventario: referencia el producto/variante existente del MISMO
// negocio (lo repite una guarda SQL). Asociar es idempotente (ON CONFLICT DO NOTHING sobre los únicos
// parciales); desasociar borra sólo la fila de configuración, con auditoría. Las recepciones aprobadas
// suman sus productos (origen RECEPCION) dentro de la misma transacción de la aprobación.

import { randomUUID } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
export type AuditoriaAsociacion = (tx: Tx, e: { accion: string; recurso: string; recursoId: string; detalle: Record<string, unknown> }) => Promise<void>
type Resultado<T> = { ok: true; value: T } | { ok: false; status: number; error: string; code: string }

const fail = (status: number, error: string, code: string) => ({ ok: false as const, status, error, code })
export const claveAsociacion = (productoId: string, varianteId: string | null | undefined) => (varianteId ? `${productoId}:${varianteId}` : productoId)

export async function listarProductosDeProveedor(db: Db, negocioId: string, proveedorId: string) {
  const filas = await db.proveedorProducto.findMany({
    where: { negocioId, proveedorId },
    orderBy: [{ createdAt: "asc" }],
    take: 2000,
    select: { id: true, productoId: true, productoVarianteId: true, origen: true, createdAt: true, producto: { select: { nombre: true, eliminado: true } }, productoVariante: { select: { nombre: true } } },
  })
  return filas
    .filter((f) => !f.producto.eliminado)
    .map((f) => ({ id: f.id, productoId: f.productoId, productoVarianteId: f.productoVarianteId, producto: f.producto.nombre, variante: f.productoVariante?.nombre ?? null, origen: f.origen, createdAt: f.createdAt }))
}

/** Claves `productoId` / `productoId:varianteId` del proveedor (para ordenar el catálogo; sin precios). */
export async function clavesDeProveedor(client: Db | Tx, negocioId: string, proveedorId: string): Promise<string[]> {
  const filas = await client.proveedorProducto.findMany({ where: { negocioId, proveedorId }, select: { productoId: true, productoVarianteId: true }, take: 5000 })
  return filas.map((f) => claveAsociacion(f.productoId, f.productoVarianteId))
}

/** Inserción idempotente dentro de una transacción existente (importación de productos). */
export async function asociarEnTx(tx: Tx, negocioId: string, proveedorId: string, items: Array<{ productoId: string; productoVarianteId: string | null }>) {
  return insertar(tx, negocioId, proveedorId, items, "MANUAL")
}

async function insertar(tx: Tx, negocioId: string, proveedorId: string, items: Array<{ productoId: string; productoVarianteId: string | null }>, origen: "MANUAL" | "RECEPCION") {
  let creadas = 0
  for (const it of items) {
    // ON CONFLICT DO NOTHING sin destino cubre los dos índices únicos parciales.
    creadas += await tx.$executeRaw`
      INSERT INTO "proveedor_productos" ("id", "negocioId", "proveedorId", "productoId", "productoVarianteId", "origen")
      VALUES (${randomUUID()}, ${negocioId}, ${proveedorId}, ${it.productoId}, ${it.productoVarianteId}, ${origen})
      ON CONFLICT DO NOTHING`
  }
  return creadas
}

export async function asociarProductos(
  db: Db,
  input: { negocioId: string; proveedorId: string; body: unknown },
  opciones: { auditar?: AuditoriaAsociacion; autorizar?: (tx: Tx) => Promise<boolean> } = {}
): Promise<Resultado<{ creadas: number }>> {
  const { negocioId, proveedorId } = input
  const raw = (input.body && typeof input.body === "object" ? (input.body as Record<string, unknown>).items : null)
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return fail(400, "Elegí entre 1 y 200 productos.", "ITEMS_INVALIDOS")
  const items: Array<{ productoId: string; productoVarianteId: string | null }> = []
  for (const x of raw) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>
    if (typeof o.productoId !== "string" || !o.productoId) return fail(400, "Falta el producto.", "ITEMS_INVALIDOS")
    const v = typeof o.productoVarianteId === "string" && o.productoVarianteId ? o.productoVarianteId : null
    items.push({ productoId: o.productoId, productoVarianteId: v })
  }
  return db.$transaction(async (tx) => {
    if (opciones.autorizar && !(await opciones.autorizar(tx))) return fail(403, "Tu permiso para asociar proveedores ya no está vigente.", "PROVEEDORES_SIN_PERMISO")
    const prov = await tx.proveedor.findFirst({ where: { id: proveedorId, negocioId }, select: { id: true } })
    if (!prov) return fail(404, "Proveedor no encontrado.", "PROVEEDOR_NO_ENCONTRADO")
    const productos = await tx.producto.findMany({ where: { negocioId, eliminado: false, id: { in: [...new Set(items.map((i) => i.productoId))] } }, select: { id: true, variantes: { select: { id: true } } } })
    const porId = new Map(productos.map((p) => [p.id, new Set(p.variantes.map((v) => v.id))]))
    for (const it of items) {
      const variantes = porId.get(it.productoId)
      if (!variantes) return fail(404, "Ese producto no es de este negocio.", "PRODUCTO_NO_ENCONTRADO")
      if (it.productoVarianteId && !variantes.has(it.productoVarianteId)) return fail(400, "Esa variante no es del producto.", "VARIANTE_INVALIDA")
    }
    const creadas = await insertar(tx, negocioId, proveedorId, items, "MANUAL")
    if (opciones.auditar && creadas > 0) await opciones.auditar(tx, { accion: "proveedor.productos_asociados", recurso: "proveedor", recursoId: proveedorId, detalle: { negocioId, proveedorId, items, creadas } })
    return { ok: true as const, value: { creadas } }
  })
}

export async function desasociarProducto(
  db: Db,
  input: { negocioId: string; proveedorId: string; asociacionId: string },
  opciones: { auditar?: AuditoriaAsociacion; autorizar?: (tx: Tx) => Promise<boolean> } = {}
): Promise<Resultado<{ borradas: number }>> {
  const { negocioId, proveedorId, asociacionId } = input
  if (!asociacionId) return fail(400, "Falta la asociación.", "ASOCIACION_REQUERIDA")
  return db.$transaction(async (tx) => {
    if (opciones.autorizar && !(await opciones.autorizar(tx))) return fail(403, "Tu permiso para asociar proveedores ya no está vigente.", "PROVEEDORES_SIN_PERMISO")
    const fila = await tx.proveedorProducto.findFirst({ where: { id: asociacionId, negocioId, proveedorId }, select: { id: true, productoId: true, productoVarianteId: true, origen: true } })
    if (!fila) return { ok: true as const, value: { borradas: 0 } } // ya no estaba: idempotente
    await tx.proveedorProducto.delete({ where: { id: fila.id } })
    if (opciones.auditar) await opciones.auditar(tx, { accion: "proveedor.producto_desasociado", recurso: "proveedor", recursoId: proveedorId, detalle: { negocioId, proveedorId, ...fila } })
    return { ok: true as const, value: { borradas: 1 } }
  })
}

/** Dentro de la aprobación de una recepción: suma al proveedor los productos aceptados (nunca borra). */
export async function asociarProductosDeRecepcion(tx: Tx, negocioId: string, proveedorId: string, lineas: Array<{ productoId: string | null; productoVarianteId: string | null }>) {
  const vistos = new Set<string>()
  const items: Array<{ productoId: string; productoVarianteId: string | null }> = []
  for (const l of lineas) {
    if (!l.productoId) continue
    const k = claveAsociacion(l.productoId, l.productoVarianteId)
    if (vistos.has(k)) continue
    vistos.add(k)
    items.push({ productoId: l.productoId, productoVarianteId: l.productoVarianteId })
  }
  return insertar(tx, negocioId, proveedorId, items, "RECEPCION")
}

/** Catálogo → ficha del producto: sus proveedores asociados (por producto o variante) y los proveedores del negocio. */
export async function proveedoresDeProducto(db: Db, negocioId: string, productoId: string) {
  const producto = await db.producto.findFirst({ where: { id: productoId, negocioId, eliminado: false }, select: { id: true, variantes: { select: { id: true, nombre: true } } } })
  if (!producto) return null
  const [asociaciones, proveedores] = await Promise.all([
    db.proveedorProducto.findMany({ where: { negocioId, productoId }, orderBy: { createdAt: "asc" }, select: { id: true, proveedorId: true, productoVarianteId: true, origen: true, proveedor: { select: { nombre: true } } } }),
    db.proveedor.findMany({ where: { negocioId, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ])
  const nombreVariante = new Map(producto.variantes.map((v) => [v.id, v.nombre]))
  return {
    variantes: producto.variantes,
    proveedores,
    asociaciones: asociaciones.map((a) => ({ id: a.id, proveedorId: a.proveedorId, proveedor: a.proveedor.nombre, productoVarianteId: a.productoVarianteId, variante: a.productoVarianteId ? nombreVariante.get(a.productoVarianteId) ?? null : null, origen: a.origen })),
  }
}
