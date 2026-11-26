// ============================================
// Catálogo para negocios reales — carga y edición de productos por EMPLEADOS con permisos temporales
// ============================================
// El dueño habilita a un empleado con una VIGENCIA (catalogoHasta) y permisos independientes: crear, editar datos
// descriptivos, asociar proveedores, precios de venta y costos (estos dos desactivados por defecto). La vigencia y cada
// permiso se verifican en CADA operación (sin procesos programados): vencido o revocado, el servidor rechaza aunque
// la pestaña siga abierta. Nunca otorga stock (R3A: el empleado no toca stockCantidad ni controlStock) ni permisos
// financieros. Reutiliza las validaciones existentes (códigos de barras únicos con runBarcodeGuardedWrite, unidades,
// imágenes, variantes) y el historial de precios (conPrecioDeCatalogoEnTx). Cada alta y modificación queda auditada a
// nombre del empleado. Un producto creado sin permiso de precios queda «sin precio» (precio 0, no disponible online)
// y Caja rechaza venderlo hasta que alguien autorizado cargue el precio.

import { Prisma, type PrismaClient } from "@prisma/client"
import { auditLogWithClient } from "@/lib/audit"
import { barcodeLookupKey, normalizeBarcodeForStorage } from "@/lib/barcode"
import { runBarcodeGuardedWrite, type BarcodeClaim } from "@/lib/barcode-uniqueness"
import { isValidUnidadMedida } from "@/lib/inventario"
import { validateOptionalImageUrl } from "@/lib/resource-url"
import { conPrecioDeCatalogoEnTx } from "@/lib/etiquetas-precio-service"
import { EMPLEADO_NOMBRE_SELECT, mapaNombresVisibles, nombreVisibleEmpleado } from "@/lib/empleado-identidad"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
type Fallo = { ok: false; status: 400 | 403 | 404 | 409; error: string; code: string }
const fail = (status: Fallo["status"], error: string, code: string): Fallo => ({ ok: false, status, error, code })
export type PermisosCatalogo = { vigente: boolean; hasta: Date | null; crear: boolean; editar: boolean; proveedores: boolean; precios: boolean; costos: boolean; importar: boolean }

export async function permisosCatalogo(client: Db | Tx, negocioId: string, empleadoId: string): Promise<PermisosCatalogo> {
  const e = await client.empleado.findFirst({ where: { id: empleadoId, negocioId, activo: true, eliminado: false }, select: { catalogoHasta: true, catalogoCrear: true, catalogoEditar: true, catalogoProveedores: true, catalogoPrecios: true, catalogoCostos: true, catalogoImportar: true } })
  const vigente = Boolean(e?.catalogoHasta && e.catalogoHasta.getTime() > Date.now())
  return { vigente, hasta: e?.catalogoHasta ?? null, crear: vigente && !!e?.catalogoCrear, editar: vigente && !!e?.catalogoEditar, proveedores: vigente && !!e?.catalogoProveedores, precios: vigente && !!e?.catalogoPrecios, costos: vigente && !!e?.catalogoCostos, importar: vigente && !!e?.catalogoImportar }
}
const SIN_PERMISO = fail(403, "Tu permiso para el catálogo no está vigente o no incluye esta acción. Pedíselo al dueño.", "CATALOGO_SIN_PERMISO")

const precioValido = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e9
const costoValido = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e9)
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

export async function listarCatalogoEmpleado(db: Db, negocioId: string, p: PermisosCatalogo) {
  const productos = await db.producto.findMany({
    where: { negocioId, eliminado: false }, orderBy: [{ categoria: "asc" }, { nombre: "asc" }], take: 2000,
    select: { id: true, nombre: true, categoria: true, codigoBarras: true, marca: true, unidadMedida: true, imagenUrl: true, precio: true, costo: true, variantes: { orderBy: { createdAt: "asc" }, select: { id: true, nombre: true, precio: true, codigoBarras: true, activo: true } } },
  })
  return {
    categorias: [...new Set(productos.map((x) => x.categoria))].sort(),
    // Sin permiso de costos el empleado no ve costos.
    productos: productos.map((x) => ({ ...x, costo: p.costos ? x.costo : undefined })),
  }
}

type VarianteNueva = { nombre: string; codigoBarras: string | null; precio: number }

/** Alta: sólo los campos permitidos; nunca stock. */
export async function crearProductoEmpleado(db: Db, input: { negocioId: string; empleadoId: string; body: unknown }) {
  const { negocioId, empleadoId } = input
  const p = await permisosCatalogo(db, negocioId, empleadoId)
  if (!p.crear) return SIN_PERMISO
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  if ("stockCantidad" in b || "controlStock" in b || "stockMinimo" in b) return fail(403, "El stock no se carga desde el catálogo (se registra por las operaciones de stock).", "STOCK_NO_PERMITIDO")
  if (b.precio !== undefined && b.precio !== null && !p.precios) return fail(403, "No tenés permiso para cargar precios de venta.", "PRECIO_SIN_PERMISO")
  if (b.costo !== undefined && b.costo !== null && !p.costos) return fail(403, "No tenés permiso para cargar costos.", "COSTO_SIN_PERMISO")
  const nombre = texto(b.nombre, 160)
  if (!nombre) return fail(400, "El nombre es obligatorio.", "NOMBRE_REQUERIDO")
  if (b.precio !== undefined && b.precio !== null && !precioValido(b.precio)) return fail(400, "El precio debe ser mayor a 0.", "PRECIO_INVALIDO")
  if (b.costo !== undefined && !costoValido(b.costo)) return fail(400, "El costo no es válido.", "COSTO_INVALIDO")
  const unidad = b.unidadMedida === undefined ? "unidad" : b.unidadMedida
  if (!isValidUnidadMedida(unidad)) return fail(400, "Unidad de medida inválida.", "UNIDAD_INVALIDA")
  const img = validateOptionalImageUrl(b.imagenUrl ?? null)
  if (!img.ok) return fail(400, img.error, "IMAGEN_INVALIDA")
  const cb = normalizeBarcodeForStorage(b.codigoBarras ?? null)
  if (!cb.ok) return fail(400, cb.error, "CODIGO_INVALIDO")
  const variantes: VarianteNueva[] = []
  for (const raw of Array.isArray(b.variantes) ? b.variantes.slice(0, 50) : []) {
    const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const vn = texto(v.nombre, 80)
    if (!vn) return fail(400, "Cada variante necesita un nombre.", "VARIANTE_INVALIDA")
    if (v.precio !== undefined && v.precio !== null && !p.precios) return fail(403, "No tenés permiso para cargar precios de venta.", "PRECIO_SIN_PERMISO")
    if (v.precio !== undefined && v.precio !== null && !precioValido(v.precio)) return fail(400, `Precio inválido en la variante «${vn}».`, "PRECIO_INVALIDO")
    const vcb = normalizeBarcodeForStorage(v.codigoBarras ?? null)
    if (!vcb.ok) return fail(400, vcb.error, "CODIGO_INVALIDO")
    variantes.push({ nombre: vn, codigoBarras: vcb.value, precio: typeof v.precio === "number" ? v.precio : 0 })
  }
  const precio = typeof b.precio === "number" ? b.precio : 0
  const sinPrecio = variantes.length ? variantes.some((v) => v.precio <= 0) : precio <= 0
  const claims: BarcodeClaim[] = [...(cb.value ? [{ code: cb.value }] : []), ...variantes.flatMap((v) => (v.codigoBarras ? [{ code: v.codigoBarras }] : []))]
  const producto = await runBarcodeGuardedWrite(db, { negocioId, claims }, async (tx) => {
    // Revalida dentro de la transacción: si el permiso venció o se revocó mientras tanto, no se crea nada.
    // Serializa frente a revocaciones y vuelve a verificar todos los permisos usados.
    await tx.$queryRaw`SELECT "id" FROM "empleados" WHERE "id" = ${empleadoId} AND "negocioId" = ${negocioId} FOR SHARE`
    const ahora = await permisosCatalogo(tx, negocioId, empleadoId)
    if (!ahora.crear || ((precio > 0 || variantes.some((v) => v.precio > 0)) && !ahora.precios) || (typeof b.costo === "number" && !ahora.costos)) throw new CatalogoError(SIN_PERMISO)
    const creado = await tx.producto.create({
      data: {
        negocioId, nombre, categoria: texto(b.categoria, 80) || "Sin Categoria", precio, costo: p.costos && typeof b.costo === "number" ? b.costo : null,
        codigoBarras: cb.value, marca: texto(b.marca, 80) || null, unidadMedida: unidad as string, imagenUrl: img.value,
        // Sin precio no se ofrece online; Caja también lo rechaza hasta que tenga precio.
        stock: !sinPrecio, controlStock: false, stockCantidad: 0, stockMinimo: 0,
        ...(variantes.length ? { variantes: { create: variantes.map((v) => ({ nombre: v.nombre, codigoBarras: v.codigoBarras, precio: v.precio })) } } : {}),
      },
      select: { id: true, nombre: true },
    })
    await auditLogWithClient(tx, { userId: empleadoId, userType: "empleado", accion: "producto.creado", recurso: "producto", recursoId: creado.id, detalle: { negocioId, nombre, precio: precio || null, sinPrecio, variantes: variantes.length, origen: "CATALOGO_EMPLEADO" } })
    return creado
  })
  return { ok: true as const, value: { producto, sinPrecio } }
}

export class CatalogoError extends Error { constructor(public resultado: Fallo) { super("catalogo") } }

/** Edición: cada campo exige su permiso; stock nunca. Variantes existentes: nombre / código (editar) y precio (precios). */
export async function editarProductoEmpleado(db: Db, input: { negocioId: string; empleadoId: string; productoId: string; body: unknown }) {
  const { negocioId, empleadoId, productoId } = input
  const p = await permisosCatalogo(db, negocioId, empleadoId)
  if (!p.vigente) return SIN_PERMISO
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  if ("stockCantidad" in b || "controlStock" in b || "stockMinimo" in b || "eliminado" in b) return fail(403, "El stock y la baja de productos no se modifican desde el catálogo del empleado.", "STOCK_NO_PERMITIDO")
  const descriptivos = ["nombre", "categoria", "codigoBarras", "marca", "unidadMedida", "imagenUrl"].filter((k) => k in b)
  const variantes = Array.isArray(b.variantes) ? (b.variantes as Array<Record<string, unknown>>).slice(0, 100) : []
  if ((descriptivos.length || variantes.some((v) => "nombre" in v || "codigoBarras" in v)) && !p.editar) return fail(403, "No tenés permiso para editar datos del producto.", "EDITAR_SIN_PERMISO")
  if (("precio" in b || variantes.some((v) => "precio" in v)) && !p.precios) return fail(403, "No tenés permiso para modificar precios de venta.", "PRECIO_SIN_PERMISO")
  if ("costo" in b && !p.costos) return fail(403, "No tenés permiso para modificar costos.", "COSTO_SIN_PERMISO")
  const actual = await db.producto.findFirst({ where: { id: productoId, negocioId, eliminado: false }, select: { id: true, codigoBarras: true, precio: true, costo: true, variantes: { select: { id: true, codigoBarras: true } } } })
  if (!actual) return fail(404, "Producto no encontrado.", "PRODUCTO_NO_ENCONTRADO")
  const data: Record<string, unknown> = {}
  if ("nombre" in b) { const n = texto(b.nombre, 160); if (!n) return fail(400, "El nombre es obligatorio.", "NOMBRE_REQUERIDO"); data.nombre = n }
  if ("categoria" in b) data.categoria = texto(b.categoria, 80) || "Sin Categoria"
  if ("marca" in b) data.marca = texto(b.marca, 80) || null
  if ("unidadMedida" in b) { if (!isValidUnidadMedida(b.unidadMedida)) return fail(400, "Unidad de medida inválida.", "UNIDAD_INVALIDA"); data.unidadMedida = b.unidadMedida }
  if ("imagenUrl" in b) { const img = validateOptionalImageUrl(b.imagenUrl); if (!img.ok) return fail(400, img.error, "IMAGEN_INVALIDA"); data.imagenUrl = img.value }
  const claims: BarcodeClaim[] = []
  if ("codigoBarras" in b) {
    const cb = normalizeBarcodeForStorage(b.codigoBarras)
    if (!cb.ok) return fail(400, cb.error, "CODIGO_INVALIDO")
    data.codigoBarras = cb.value
    if (cb.value && barcodeLookupKey(cb.value) !== barcodeLookupKey(actual.codigoBarras)) claims.push({ code: cb.value, exclude: { productoId } })
  }
  if ("precio" in b) { if (!precioValido(b.precio)) return fail(400, "El precio debe ser mayor a 0.", "PRECIO_INVALIDO"); data.precio = b.precio; data.stock = true }
  if ("costo" in b) { if (!costoValido(b.costo)) return fail(400, "El costo no es válido.", "COSTO_INVALIDO"); data.costo = b.costo }
  const cambiosVariantes: Array<{ id: string; data: Record<string, unknown> }> = []
  const variantesIds = new Set(actual.variantes.map((v) => v.id))
  for (const v of variantes) {
    if (typeof v.id !== "string" || !variantesIds.has(v.id)) return fail(400, "Esa variante no es de este producto.", "VARIANTE_INVALIDA")
    const d: Record<string, unknown> = {}
    if ("nombre" in v) { const n = texto(v.nombre, 80); if (!n) return fail(400, "La variante necesita un nombre.", "VARIANTE_INVALIDA"); d.nombre = n }
    if ("codigoBarras" in v) {
      const cb = normalizeBarcodeForStorage(v.codigoBarras)
      if (!cb.ok) return fail(400, cb.error, "CODIGO_INVALIDO")
      d.codigoBarras = cb.value
      const previo = actual.variantes.find((x) => x.id === v.id)?.codigoBarras ?? null
      if (cb.value && barcodeLookupKey(cb.value) !== barcodeLookupKey(previo)) claims.push({ code: cb.value, exclude: { varianteId: v.id } })
    }
    if ("precio" in v) { if (!precioValido(v.precio)) return fail(400, "El precio debe ser mayor a 0.", "PRECIO_INVALIDO"); d.precio = v.precio }
    if (Object.keys(d).length) cambiosVariantes.push({ id: v.id, data: d })
  }
  if (!Object.keys(data).length && !cambiosVariantes.length) return fail(400, "No hay cambios para guardar.", "SIN_CAMBIOS")
  const tocaPrecio = "precio" in data || cambiosVariantes.some((c) => "precio" in c.data)
  if (tocaPrecio && (await db.etiquetaPrecio.count({ where: { negocioId, productoId, estado: "PENDIENTE" } }))) {
    return fail(409, "Este producto tiene un precio autorizado esperando el cambio de etiqueta. Que el dueño lo resuelva desde «Etiquetas» antes de cambiar el precio.", "ETIQUETA_PENDIENTE")
  }
  const actor = { tipo: "EMPLEADO" as const, id: empleadoId }
  await runBarcodeGuardedWrite(db, { negocioId, claims }, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "empleados" WHERE "id" = ${empleadoId} AND "negocioId" = ${negocioId} FOR SHARE`
    const ahora = await permisosCatalogo(tx, negocioId, empleadoId)
    const tocaDatos = descriptivos.length > 0 || variantes.some((v) => "nombre" in v || "codigoBarras" in v)
    if (!ahora.vigente || (tocaDatos && !ahora.editar) || (tocaPrecio && !ahora.precios) || ("costo" in data && !ahora.costos)) throw new CatalogoError(SIN_PERMISO)
    // El precio pasa por el historial de activaciones (protege las ventas ya iniciadas) a nombre del empleado.
    if (Object.keys(data).length) await conPrecioDeCatalogoEnTx(tx, { negocioId, productoId, varianteId: null }, () => tx.producto.update({ where: { id: productoId }, data }), actor)
    for (const c of cambiosVariantes) await conPrecioDeCatalogoEnTx(tx, { negocioId, productoId, varianteId: c.id }, () => tx.productoVariante.update({ where: { id: c.id }, data: c.data }), actor)
    await auditLogWithClient(tx, { userId: empleadoId, userType: "empleado", accion: tocaPrecio ? "producto.precio_cambiado" : "producto.modificado", recurso: "producto", recursoId: productoId, detalle: { negocioId, campos: Object.keys(data), variantes: cambiosVariantes.map((c) => ({ id: c.id, campos: Object.keys(c.data) })), ...("precio" in data ? { precioAnterior: actual.precio, precioNuevo: data.precio } : {}), ...("costo" in data ? { costoAnterior: actual.costo, costoNuevo: data.costo } : {}), origen: "CATALOGO_EMPLEADO" } })
  })
  return { ok: true as const, value: { productoId } }
}

/** Dueño: quién creó y quién modificó por última vez el producto (auditoría). */
export async function autoriaProducto(db: Db, negocioId: string, productoId: string) {
  const prod = await db.producto.findFirst({ where: { id: productoId, negocioId }, select: { id: true, createdAt: true } })
  if (!prod) return null
  const eventos = await db.auditLog.findMany({ where: { recurso: "producto", recursoId: productoId, accion: { in: ["producto.creado", "producto.modificado", "producto.precio_cambiado"] } }, orderBy: { fecha: "asc" }, select: { accion: true, userType: true, userId: true, fecha: true } })
  const ids = [...new Set(eventos.filter((e) => e.userType === "empleado").map((e) => e.userId))]
  const nombres = await mapaNombresVisibles(db, negocioId, ids)
  const quien = (e: { userType: string; userId: string }) => (e.userType === "empleado" ? nombres.get(e.userId) ?? "Empleado" : "Dueño")
  const alta = eventos.find((e) => e.accion === "producto.creado")
  const mods = eventos.filter((e) => e.accion !== "producto.creado")
  return {
    creado: alta ? { por: quien(alta), fecha: alta.fecha } : { por: null, fecha: prod.createdAt },
    ultimaModificacion: mods.length ? { por: quien(mods[mods.length - 1]), fecha: mods[mods.length - 1].fecha } : null,
    historial: eventos.slice(-20).reverse().map((e) => ({ accion: e.accion, por: quien(e), fecha: e.fecha })),
  }
}

// ---------- permisos (dueño) ----------
export async function listarPermisosCatalogo(db: Db, negocioId: string) {
  const empleados = await db.empleado.findMany({ where: { negocioId, activo: true, eliminado: false }, select: { id: true, ...EMPLEADO_NOMBRE_SELECT, catalogoHasta: true, catalogoCrear: true, catalogoEditar: true, catalogoProveedores: true, catalogoPrecios: true, catalogoCostos: true, catalogoImportar: true } })
  // Nombre visible (regla única de identidad) y orden por ese nombre; el id y los permisos son siempre los de la fila.
  return empleados
    .map((e) => ({ e, nombre: nombreVisibleEmpleado(e) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.e.id.localeCompare(b.e.id))
    .map(({ e, nombre }) => ({ id: e.id, nombre, hasta: e.catalogoHasta, vigente: Boolean(e.catalogoHasta && e.catalogoHasta.getTime() > Date.now()), crear: e.catalogoCrear, editar: e.catalogoEditar, proveedores: e.catalogoProveedores, precios: e.catalogoPrecios, costos: e.catalogoCostos, importar: e.catalogoImportar }))
}

/** body: { empleadoId, hasta (ISO) | null (revocar), crear, editar, proveedores, precios, costos, importar } */
export async function guardarPermisosCatalogo(db: Db, negocioId: string, body: unknown) {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  if (typeof b.empleadoId !== "string") return fail(400, "Falta el empleado.", "EMPLEADO_REQUERIDO")
  let hasta: Date | null = null
  if (b.hasta !== null && b.hasta !== undefined) {
    hasta = new Date(String(b.hasta))
    if (Number.isNaN(hasta.getTime())) return fail(400, "Fecha de vencimiento inválida.", "VENCIMIENTO_INVALIDO")
    if (hasta.getTime() <= Date.now()) return fail(400, "El vencimiento tiene que ser futuro (para quitar el acceso usá «Revocar»).", "VENCIMIENTO_INVALIDO")
    if (hasta.getTime() > Date.now() + 366 * 24 * 3600_000) return fail(400, "El plazo máximo es de un año.", "VENCIMIENTO_INVALIDO")
  }
  const flags = { catalogoCrear: b.crear === true, catalogoEditar: b.editar === true, catalogoProveedores: b.proveedores === true, catalogoPrecios: b.precios === true, catalogoCostos: b.costos === true, catalogoImportar: b.importar === true }
  return db.$transaction(async (tx) => {
    const e = await tx.empleado.findFirst({ where: { id: b.empleadoId as string, negocioId, eliminado: false }, select: { id: true, catalogoHasta: true, catalogoCrear: true, catalogoEditar: true, catalogoProveedores: true, catalogoPrecios: true, catalogoCostos: true, catalogoImportar: true } })
    if (!e) return fail(404, "Empleado no encontrado.", "EMPLEADO_NO_ENCONTRADO")
    const despues = hasta ? { catalogoHasta: hasta, ...flags } : { catalogoHasta: null, catalogoCrear: false, catalogoEditar: false, catalogoProveedores: false, catalogoPrecios: false, catalogoCostos: false, catalogoImportar: false }
    await tx.empleado.update({ where: { id: e.id }, data: despues })
    await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: hasta ? "empleado.permiso_catalogo" : "empleado.permiso_catalogo_revocado", recurso: "empleado", recursoId: e.id, detalle: { negocioId, empleadoId: e.id, antes: e, despues } })
    return { ok: true as const, value: { vigente: Boolean(hasta) } }
  })
}
