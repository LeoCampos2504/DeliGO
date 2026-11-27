// ============================================
// Catálogo — IMPORTACIÓN MASIVA de productos desde Excel / CSV
// ============================================
// El navegador lee el archivo y relaciona columnas con campos; el servidor recibe filas ya mapeadas y decide todo:
//   1) `previsualizarImportacion`: SÓLO LECTURA. Valida cada fila, agrupa variantes, detecta códigos repetidos en el
//      archivo y contra el catálogo y clasifica cada grupo como NUEVO / EXISTENTE / ERROR con las acciones posibles.
//   2) `ejecutarImportacion`: con confirmación explícita por grupo (crear / omitir / actualizar). Vuelve a planificar
//      contra el catálogo actual (lo visto en la vista previa no se da por bueno) y escribe cada grupo en su propia
//      transacción reutilizando los mecanismos existentes: unicidad de códigos (runBarcodeGuardedWrite), historial de
//      precios (conPrecioDeCatalogoEnTx), asociación idempotente con proveedores y auditoría.
// Reglas: nunca sobrescribe un existente sin «actualizar» explícito; nunca toca stock ni inventario (R3A: stock 0, sin
// movimientos); precios y costos sólo con su permiso (el dueño siempre; el empleado con «Importar productos» + el
// permiso de cada operación, verificado de nuevo en cada grupo); celdas vacías no borran datos; no crea proveedores.
// Idempotencia: un registro por clave del navegador; el resultado de cada grupo se guarda en la MISMA transacción
// que su escritura, así un reintento (doble clic, corte, recarga) devuelve el mismo resultado o retoma lo que faltó.

import { createHash } from "node:crypto"
import type { Prisma, PrismaClient } from "@prisma/client"
import { auditLogWithClient } from "@/lib/audit"
import { barcodeLookupKey, normalizeBarcodeForStorage } from "@/lib/barcode"
import { mapBarcodeWriteError, runBarcodeGuardedWrite, type BarcodeClaim } from "@/lib/barcode-uniqueness"
import { conPrecioDeCatalogoEnTx } from "@/lib/etiquetas-precio-service"
import { permisosCatalogo } from "@/lib/catalogo-empleado-service"
import { asociarEnTx } from "@/lib/proveedor-productos-service"
import { MAX_FILAS_IMPORTACION } from "@/lib/importacion-limites"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
type Fallo = { ok: false; status: 400 | 403 | 404 | 409; error: string; code: string }
const fail = (status: Fallo["status"], error: string, code: string): Fallo => ({ ok: false, status, error, code })

export type ActorImportacion = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }
type Permisos = { crear: boolean; editar: boolean; proveedores: boolean; precios: boolean; costos: boolean }
export const CAMPOS_IMPORTACION = ["nombre", "descripcion", "categoria", "marca", "codigoBarras", "precio", "costo", "variante", "proveedores"] as const
type Campo = (typeof CAMPOS_IMPORTACION)[number]
// T1-09: el valor vive en importacion-limites (compartido con la pantalla); mismo nombre y mismo valor.
export { MAX_FILAS_IMPORTACION }
const LEASE_MS = 60_000
// Procesamiento por TANDAS: cada petición trabaja como máximo ~8 s (o 150 grupos) y devuelve el avance; el navegador
// vuelve a llamar con la MISMA clave hasta completar. Ninguna petición dura minutos (archivos grandes, proxies, celulares).
const TANDA_MS = 8_000
const TANDA_MAX_GRUPOS = 150

export type Accion = "crear" | "omitir" | "actualizar"
type Fila = {
  fila: number; nombre: string; descripcion: string | null; categoria: string | null; marca: string | null
  codigo: string | null; precio: number | null; costo: number | null; variante: string | null; proveedores: string[]
  errores: string[]; avisos: string[]
}
type CambioVariante = { varianteId: string; nombre: string; precio?: number; codigo?: string }
export type Grupo = {
  clave: string; filas: number[]; nombre: string; tipo: "NUEVO" | "EXISTENTE" | "ERROR"
  productoId: string | null; productoNombre: string | null
  acciones: Accion[]; sugerida: Accion
  errores: string[]; avisos: string[]; cambios: string[]
  // datos para ejecutar (no se muestran)
  nuevo?: { nombre: string; descripcion: string | null; categoria: string; marca: string | null; codigo: string | null; precio: number; costo: number | null; variantes: Array<{ nombre: string; codigo: string | null; precio: number }> }
  actualizar?: { data: { categoria?: string; marca?: string; descripcion?: string; codigoBarras?: string; precio?: number; costo?: number }; variantes: CambioVariante[] }
  proveedorIds: string[]
}

// ---------- utilidades ----------
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : typeof v === "number" && Number.isFinite(v) ? String(v).slice(0, max) : "")
const pesos = (n: number | null) => (n === null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`)
/**
 * Importes del archivo. Formato argentino primero y SIN ambigüedades ni redondeos silenciosos:
 *   «520» · «2.315» / «1.234.567» (punto = miles) · «890,75» / «1.850,50» / «4.100,5» / «1.234.567,89» (coma = decimal)
 *   y, por compatibilidad, «1890.5» / «1234.56» (punto decimal con 1–2 decimales) y «1,234.56» (coma de miles + punto).
 * Se rechaza (fila con error, mostrando el valor original) todo lo demás: «2,315» o «2.3155» (¿miles o decimales?),
 * más de 2 decimales, separadores mezclados o mal agrupados, texto. Celdas numéricas de Excel: se aceptan si tienen
 * a lo sumo 2 decimales. Vacío = null (no se carga). Es la ÚNICA lectura de importes (vista previa y confirmación).
 */
export function parseNumero(v: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  const malo = (motivo: string) => ({ ok: false as const, error: motivo })
  if (v === null || v === undefined) return { ok: true, value: null }
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return malo("no es un número")
    return Math.abs(v * 100 - Math.round(v * 100)) > 1e-6 ? malo("tiene más de 2 decimales") : { ok: true, value: Math.round(v * 100) / 100 }
  }
  if (typeof v !== "string") return malo("no es un número")
  const s = v.trim().replace(/^ARS\s*/i, "").replace(/^\$\s*/, "").replace(/\s+/g, "")
  if (!s) return { ok: true, value: null }
  const neg = s.startsWith("-") ? -1 : 1
  const c = neg < 0 ? s.slice(1) : s
  let normal: string | null = null
  if (/^\d+$/.test(c)) normal = c
  else if (/^\d{1,3}(\.\d{3})+$/.test(c)) normal = c.replace(/\./g, "")
  else if (/^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(c)) normal = c.replace(/\./g, "").replace(",", ".")
  else if (/^\d+\.\d{1,2}$/.test(c)) normal = c
  else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(c)) normal = c.replace(/,/g, "")
  if (normal === null) {
    if (/^\d+,\d{3,}$/.test(c) || /^\d+\.\d{3,}$/.test(c)) return malo("es ambiguo o tiene más de 2 decimales (usá «2.315» para miles o «2,31» para decimales)")
    return malo("no tiene un formato de importe válido (ej.: 2.315 · 1.850,50 · 890,75)")
  }
  return { ok: true, value: neg * Number(normal) }
}
/** Códigos de barras: los números enteros de Excel llegan como número; la notación científica se rechaza. */
function codigoDe(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 ? { ok: true, value: String(v) } : { ok: false, error: "Código de barras inválido" }
  if (typeof v === "string" && /^\d+(\.\d+)?e\+?\d+$/i.test(v.trim())) return { ok: false, error: "El código de barras quedó en notación científica (formateá la columna como texto)" }
  const r = normalizeBarcodeForStorage(typeof v === "string" ? v : null)
  return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error }
}

async function permisosDe(client: Db | Tx, negocioId: string, actor: ActorImportacion): Promise<(Permisos & { importar: boolean }) | null> {
  if (actor.tipo === "NEGOCIO") return { crear: true, editar: true, proveedores: true, precios: true, costos: true, importar: true }
  const p = await permisosCatalogo(client, negocioId, actor.empleadoId)
  return p.vigente ? p : null
}
const SIN_PERMISO = fail(403, "Tu permiso para importar productos no está vigente. Pedíselo al dueño.", "IMPORTAR_SIN_PERMISO")

// ---------- planificación (sólo lectura) ----------
function leerFilas(body: unknown, permisos: Permisos): { filas: Fila[]; campos: Set<Campo> } | Fallo {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const campos = new Set((Array.isArray(b.campos) ? b.campos : []).filter((c): c is Campo => (CAMPOS_IMPORTACION as readonly string[]).includes(c as string)))
  if (!campos.has("nombre")) return fail(400, "Relacioná al menos la columna del nombre del producto.", "NOMBRE_SIN_COLUMNA")
  const raw = Array.isArray(b.filas) ? b.filas : []
  if (!raw.length) return fail(400, "El archivo no tiene filas para importar.", "SIN_FILAS")
  if (raw.length > MAX_FILAS_IMPORTACION) return fail(400, `Máximo ${MAX_FILAS_IMPORTACION} filas por importación. Dividí el archivo.`, "DEMASIADAS_FILAS")
  const filas: Fila[] = []
  for (const r of raw) {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>
    const fila = typeof o.fila === "number" && Number.isInteger(o.fila) ? o.fila : filas.length + 2
    const f: Fila = { fila, nombre: texto(o.nombre, 160), descripcion: null, categoria: null, marca: null, codigo: null, precio: null, costo: null, variante: null, proveedores: [], errores: [], avisos: [] }
    if (!f.nombre) f.errores.push("Falta el nombre.")
    if (campos.has("descripcion")) f.descripcion = texto(o.descripcion, 2000) || null
    if (campos.has("categoria")) f.categoria = texto(o.categoria, 80) || null
    if (campos.has("marca")) f.marca = texto(o.marca, 80) || null
    if (campos.has("variante")) f.variante = texto(o.variante, 80) || null
    if (campos.has("codigoBarras")) { const c = codigoDe(o.codigoBarras); if (c.ok) f.codigo = c.value; else f.errores.push(c.error) }
    if (campos.has("precio")) {
      const n = parseNumero(o.precio)
      if (!n.ok) f.errores.push(`Precio «${String(o.precio).trim()}» ${n.error}.`)
      else if (n.value !== null && (n.value <= 0 || n.value >= 1e9)) f.errores.push(`Precio «${String(o.precio).trim()}» inválido (tiene que ser mayor a 0).`)
      else if (n.value !== null && !permisos.precios) f.avisos.push("Precio ignorado: no tenés permiso de precios.")
      else f.precio = n.value
    }
    if (campos.has("costo")) {
      const n = parseNumero(o.costo)
      if (!n.ok) f.errores.push(`Costo «${String(o.costo).trim()}» ${n.error}.`)
      else if (n.value !== null && (n.value < 0 || n.value >= 1e9)) f.errores.push(`Costo «${String(o.costo).trim()}» inválido.`)
      else if (n.value !== null && !permisos.costos) f.avisos.push("Costo ignorado: no tenés permiso de costos.")
      else f.costo = n.value
    }
    if (campos.has("proveedores")) {
      const lista = texto(o.proveedores, 500).split(/[;|]/).map((x) => x.trim()).filter(Boolean)
      if (lista.length && !permisos.proveedores) f.avisos.push("Proveedores ignorados: no tenés permiso de proveedores.")
      else f.proveedores = lista
    }
    filas.push(f)
  }
  return { filas, campos }
}

async function planificar(client: Db | Tx, negocioId: string, permisos: Permisos, filas: Fila[]): Promise<Grupo[]> {
  // Códigos repetidos dentro del archivo.
  const porCodigo = new Map<string, number[]>()
  for (const f of filas) { const k = barcodeLookupKey(f.codigo); if (k) porCodigo.set(k, [...(porCodigo.get(k) ?? []), f.fila]) }
  for (const f of filas) { const k = barcodeLookupKey(f.codigo); const r = k ? porCodigo.get(k)! : []; if (r.length > 1) f.errores.push(`Código ${f.codigo} repetido en el archivo (filas ${r.join(", ")}).`) }

  // Agrupación: filas con variante del mismo producto forman un solo producto.
  const grupos = new Map<string, Fila[]>()
  const conVariante = new Set(filas.filter((f) => f.nombre && f.variante).map((f) => norm(f.nombre)))
  for (const f of filas) {
    const k = !f.nombre ? `x:${f.fila}` : conVariante.has(norm(f.nombre)) ? `v:${norm(f.nombre)}` : `p:${norm(f.nombre)}`
    const g = grupos.get(k)
    if (k.startsWith("p:") && g) { f.errores.push(`Nombre repetido en el archivo (fila ${g[0].fila}). Para variantes completá la columna «Variante».`); grupos.set(`x:${f.fila}`, [f]); continue }
    grupos.set(k, [...(g ?? []), f])
  }
  for (const [k, fs] of grupos) if (k.startsWith("v:")) {
    const vistos = new Map<string, number>()
    for (const f of fs) {
      if (!f.variante) { f.errores.push("Este producto tiene filas con variante: completá la variante también en esta fila."); continue }
      const vk = norm(f.variante)
      if (vistos.has(vk)) f.errores.push(`Variante «${f.variante}» repetida (fila ${vistos.get(vk)}).`)
      else vistos.set(vk, f.fila)
    }
  }

  // Catálogo actual y proveedores.
  const productos = await client.producto.findMany({ where: { negocioId, eliminado: false }, select: { id: true, nombre: true, categoria: true, marca: true, descripcion: true, codigoBarras: true, precio: true, costo: true, variantes: { select: { id: true, nombre: true, codigoBarras: true, precio: true } } } })
  const dueñoCodigo = new Map<string, { productoId: string; varianteId: string | null }>()
  const porNombre = new Map<string, string[]>()
  for (const p of productos) {
    const k = barcodeLookupKey(p.codigoBarras); if (k) dueñoCodigo.set(k, { productoId: p.id, varianteId: null })
    for (const v of p.variantes) { const kv = barcodeLookupKey(v.codigoBarras); if (kv) dueñoCodigo.set(kv, { productoId: p.id, varianteId: v.id }) }
    porNombre.set(norm(p.nombre), [...(porNombre.get(norm(p.nombre)) ?? []), p.id])
  }
  const porId = new Map(productos.map((p) => [p.id, p]))
  const provs = await client.proveedor.findMany({ where: { negocioId, activo: true }, select: { id: true, nombre: true } })
  const provPorNombre = new Map(provs.map((p) => [norm(p.nombre), p.id]))
  const existentesIds = [...new Set(productos.map((p) => p.id))]
  const asociadas = new Set((existentesIds.length ? await client.proveedorProducto.findMany({ where: { negocioId, productoVarianteId: null }, select: { proveedorId: true, productoId: true } }) : []).map((a) => `${a.proveedorId}:${a.productoId}`))
  const etiquetasPendientes = new Set((await client.etiquetaPrecio.findMany({ where: { negocioId, estado: "PENDIENTE" }, select: { productoId: true } })).map((e) => e.productoId))

  const salida: Grupo[] = []
  for (const [k, fs] of grupos) {
    const g: Grupo = { clave: `g${fs[0].fila}`, filas: fs.map((f) => f.fila), nombre: fs[0].nombre || `(fila ${fs[0].fila} sin nombre)`, tipo: "NUEVO", productoId: null, productoNombre: null, acciones: [], sugerida: "omitir", errores: [], avisos: [], cambios: [], proveedorIds: [] }
    const esVariantes = k.startsWith("v:")
    // Proveedores (nunca se crean).
    for (const nombre of [...new Set(fs.flatMap((f) => f.proveedores))]) {
      const id = provPorNombre.get(norm(nombre))
      if (id) g.proveedorIds.push(id); else g.avisos.push(`Proveedor «${nombre}» no existe: se omite esa asociación (cargalo primero en Proveedores).`)
    }
    const conError = fs.some((f) => f.errores.length)
    // ¿Existe? Primero por código de barras, después por nombre exacto.
    const dueños = new Set(fs.flatMap((f) => { const kk = barcodeLookupKey(f.codigo); const d = kk ? dueñoCodigo.get(kk) : null; return d ? [d.productoId] : [] }))
    let existente: (typeof productos)[number] | null = null
    if (dueños.size > 1) g.errores.push("Los códigos de estas filas pertenecen a productos distintos del catálogo.")
    else if (dueños.size === 1) existente = porId.get([...dueños][0]) ?? null
    else if (fs[0].nombre) {
      const ids = porNombre.get(norm(fs[0].nombre)) ?? []
      if (ids.length > 1) g.errores.push("Hay varios productos con ese nombre en el catálogo: agregá el código de barras para identificarlo.")
      else if (ids.length === 1) existente = porId.get(ids[0]) ?? null
    }

    if (!g.errores.length && !conError && existente) {
      g.tipo = "EXISTENTE"; g.productoId = existente.id; g.productoNombre = existente.nombre
      const data: NonNullable<Grupo["actualizar"]>["data"] = {}
      const variantes: CambioVariante[] = []
      const f0 = fs[0]
      if (norm(f0.nombre) !== norm(existente.nombre)) g.avisos.push(`En el catálogo se llama «${existente.nombre}»: el nombre no se cambia.`)
      const desc: string[] = []
      if (f0.categoria && f0.categoria !== existente.categoria) { data.categoria = f0.categoria; desc.push(`categoría: ${existente.categoria} → ${f0.categoria}`) }
      if (f0.marca && f0.marca !== (existente.marca ?? "")) { data.marca = f0.marca; desc.push(`marca: ${existente.marca ?? "—"} → ${f0.marca}`) }
      if (f0.descripcion && f0.descripcion !== (existente.descripcion ?? "")) { data.descripcion = f0.descripcion; desc.push("descripción") }
      if (!esVariantes) {
        if (existente.variantes.length && (f0.precio !== null || f0.codigo)) g.errores.push("En el catálogo tiene variantes: indicá la variante en la columna «Variante».")
        if (f0.codigo && !existente.codigoBarras) { data.codigoBarras = f0.codigo; desc.push(`código: — → ${f0.codigo}`) }
        else if (f0.codigo && barcodeLookupKey(f0.codigo) !== barcodeLookupKey(existente.codigoBarras)) g.errores.push(`El código ${f0.codigo} es distinto al del catálogo (${existente.codigoBarras}).`)
        if (f0.precio !== null && !existente.variantes.length && f0.precio !== existente.precio) { data.precio = f0.precio; g.cambios.push(`precio: ${pesos(existente.precio)} → ${pesos(f0.precio)}`) }
      } else {
        if (!existente.variantes.length) g.errores.push("En el catálogo no tiene variantes: agregalas desde la ficha del producto.")
        for (const f of fs) {
          const kk = barcodeLookupKey(f.codigo)
          const v = (kk ? existente.variantes.find((x) => barcodeLookupKey(x.codigoBarras) === kk) : null) ?? existente.variantes.find((x) => norm(x.nombre) === norm(f.variante ?? ""))
          if (!v) { if (existente.variantes.length) g.errores.push(`Fila ${f.fila}: la variante «${f.variante}» no existe en el catálogo (agregala desde la ficha).`); continue }
          const c: CambioVariante = { varianteId: v.id, nombre: v.nombre }
          if (f.codigo && !v.codigoBarras) { c.codigo = f.codigo; desc.push(`código de ${v.nombre}: — → ${f.codigo}`) }
          else if (f.codigo && barcodeLookupKey(f.codigo) !== barcodeLookupKey(v.codigoBarras)) g.errores.push(`Fila ${f.fila}: el código ${f.codigo} es distinto al de la variante ${v.nombre} (${v.codigoBarras}).`)
          if (f.precio !== null && f.precio !== v.precio) { c.precio = f.precio; g.cambios.push(`precio de ${v.nombre}: ${pesos(v.precio)} → ${pesos(f.precio)}`) }
          if (c.codigo || c.precio !== undefined) variantes.push(c)
        }
      }
      if (desc.length && !permisos.editar) { g.avisos.push("Sin permiso de edición: no se actualizan categoría, marca, descripción ni códigos."); delete data.categoria; delete data.marca; delete data.descripcion; delete data.codigoBarras; for (const v of variantes) delete v.codigo }
      else g.cambios.unshift(...desc)
      if (fs.some((f) => f.costo !== null)) {
        const costo = fs.find((f) => f.costo !== null)!.costo!
        if (costo !== existente.costo) { data.costo = costo; g.cambios.push(`costo: ${pesos(existente.costo)} → ${pesos(costo)}`) }
      }
      if (etiquetasPendientes.has(existente.id) && (data.precio !== undefined || variantes.some((v) => v.precio !== undefined))) {
        g.avisos.push("Tiene un precio esperando el cambio de etiqueta: el precio no se actualiza (resolvelo desde «Etiquetas»).")
        delete data.precio; for (const v of variantes) delete v.precio
        g.cambios = g.cambios.filter((c) => !c.startsWith("precio"))
      }
      const nuevosProv = g.proveedorIds.filter((id) => !asociadas.has(`${id}:${existente!.id}`))
      g.proveedorIds = nuevosProv
      if (nuevosProv.length) g.cambios.push(`asociar proveedor: ${nuevosProv.map((id) => provs.find((p) => p.id === id)?.nombre).join(", ")}`)
      g.actualizar = { data, variantes: variantes.filter((v) => v.codigo || v.precio !== undefined) }
      if (!g.errores.length) {
        g.acciones = g.cambios.length ? ["omitir", "actualizar"] : ["omitir"]
        g.sugerida = "omitir"
        if (!g.cambios.length) g.avisos.push("Ya existe y no hay cambios para aplicar.")
      }
    } else if (!g.errores.length && !conError) {
      g.tipo = "NUEVO"
      if (!permisos.crear) g.errores.push("No tenés permiso para crear productos.")
      else {
        const f0 = fs[0]
        const vs = esVariantes ? fs.map((f) => ({ nombre: f.variante!, codigo: f.codigo, precio: f.precio ?? 0 })) : []
        const precio = esVariantes ? 0 : f0.precio ?? 0
        if (esVariantes ? vs.some((v) => v.precio <= 0) : precio <= 0) g.avisos.push("Se crea sin precio de venta: no se puede vender hasta cargarlo.")
        g.nuevo = { nombre: f0.nombre, descripcion: f0.descripcion, categoria: f0.categoria ?? "Sin Categoria", marca: f0.marca, codigo: esVariantes ? null : f0.codigo, precio, costo: fs.find((f) => f.costo !== null)?.costo ?? null, variantes: vs }
        g.acciones = ["crear", "omitir"]; g.sugerida = "crear"
      }
    }
    for (const f of fs) { for (const e of f.errores) g.errores.push(fs.length > 1 ? `Fila ${f.fila}: ${e}` : e); for (const a of f.avisos) if (!g.avisos.includes(a)) g.avisos.push(a) }
    if (g.errores.length) { g.tipo = "ERROR"; g.acciones = []; g.sugerida = "omitir"; delete g.nuevo; delete g.actualizar }
    salida.push(g)
  }
  return salida.sort((a, b) => a.filas[0] - b.filas[0])
}

/** Importes EXACTOS que se guardarán al crear (mismos valores que usa la confirmación). */
function importesNuevo(n: NonNullable<Grupo["nuevo"]>) {
  const r: string[] = []
  if (n.variantes.length) r.push(...n.variantes.map((v) => `${v.nombre}: precio ${v.precio > 0 ? pesos(v.precio) : "sin precio"}`))
  else r.push(`precio ${n.precio > 0 ? pesos(n.precio) : "sin precio"}`)
  if (n.costo !== null) r.push(`costo ${pesos(n.costo)}`)
  return r
}
const publico = (g: Grupo) => ({ clave: g.clave, filas: g.filas, nombre: g.nombre, tipo: g.tipo, productoId: g.productoId, productoNombre: g.productoNombre, acciones: g.acciones, sugerida: g.sugerida, errores: g.errores, avisos: g.avisos, cambios: g.cambios, importes: g.nuevo ? importesNuevo(g.nuevo) : [], variantes: g.nuevo?.variantes.length ?? 0 })

/** Vista previa: SÓLO LECTURA (no escribe nada). */
export async function previsualizarImportacion(db: Db, input: { negocioId: string; actor: ActorImportacion; body: unknown }) {
  const p = await permisosDe(db, input.negocioId, input.actor)
  if (!p || !p.importar) return SIN_PERMISO
  const l = leerFilas(input.body, p)
  if ("ok" in l) return l
  const grupos = await planificar(db, input.negocioId, p, l.filas)
  const cuenta = (t: Grupo["tipo"]) => grupos.filter((g) => g.tipo === t).length
  return { ok: true as const, value: { permisos: { crear: p.crear, editar: p.editar, proveedores: p.proveedores, precios: p.precios, costos: p.costos }, resumen: { filas: l.filas.length, grupos: grupos.length, nuevos: cuenta("NUEVO"), existentes: cuenta("EXISTENTE"), errores: cuenta("ERROR") }, grupos: grupos.map(publico) } }
}

// ---------- ejecución (confirmación explícita, idempotente) ----------
export type ResultadoGrupo = { clave: string; filas: number[]; nombre: string; resultado: "CREADO" | "ACTUALIZADO" | "OMITIDO" | "ERROR"; detalle: string; productoId: string | null }
class ErrorGrupo extends Error {}
class YaProcesado extends Error {}

/** Dentro de la transacción del grupo: bloquea el registro y confirma que ese grupo no fue guardado por otro intento. */
async function reservarGrupo(tx: Tx, importacionId: string, clave: string) {
  const r = await tx.$queryRaw<Array<{ ya: boolean }>>`SELECT ("resultados" ? ${clave}) AS ya FROM "importaciones_productos" WHERE "id" = ${importacionId} FOR UPDATE`
  if (r[0]?.ya) throw new YaProcesado()
}

const auditor = (actor: ActorImportacion, negocioId: string) => ({ userId: actor.tipo === "NEGOCIO" ? negocioId : actor.empleadoId, userType: actor.tipo === "NEGOCIO" ? "negocio" : "empleado" })

async function guardarResultado(client: Db | Tx, importacionId: string, r: ResultadoGrupo) {
  await client.$executeRaw`UPDATE "importaciones_productos" SET "resultados" = "resultados" || ${JSON.stringify({ [r.clave]: r })}::jsonb, "bloqueadaHasta" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${LEASE_MS / 1000}), "updatedAt" = (now() AT TIME ZONE 'UTC') WHERE "id" = ${importacionId}`
}

function respuesta(reg: { id: string; estado: string; totalGrupos: number; resultados: Prisma.JsonValue; resumen: Prisma.JsonValue }, ocupada = false) {
  const resultados = Object.values((reg.resultados ?? {}) as Record<string, ResultadoGrupo>).sort((a, b) => a.filas[0] - b.filas[0])
  // Mientras está EN_CURSO sólo se informa el avance (los resultados completos van al terminar).
  return { importacionId: reg.id, estado: reg.estado as "EN_CURSO" | "COMPLETADA", procesados: resultados.length, totalGrupos: reg.totalGrupos, ocupada, resumen: reg.resumen, resultados: reg.estado === "COMPLETADA" ? resultados : [] }
}

export async function estadoImportacion(db: Db, negocioId: string, clave: string) {
  const reg = await db.importacionProductos.findUnique({ where: { negocioId_clave: { negocioId, clave } } })
  return reg ? respuesta(reg) : null
}

/** body: { clave (UUID del navegador), archivo, campos, filas, decisiones: { [claveGrupo]: "crear" | "omitir" | "actualizar" } } */
export async function ejecutarImportacion(db: Db, input: { negocioId: string; actor: ActorImportacion; body: unknown }) {
  const { negocioId, actor } = input
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  const clave = typeof b.clave === "string" ? b.clave : ""
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clave)) return fail(400, "Falta la clave de la importación.", "CLAVE_INVALIDA")
  const decisiones = (b.decisiones && typeof b.decisiones === "object" ? b.decisiones : {}) as Record<string, unknown>
  const huella = createHash("sha256").update(JSON.stringify({ campos: b.campos, filas: b.filas, decisiones })).digest("hex")
  const actorId = actor.tipo === "NEGOCIO" ? negocioId : actor.empleadoId

  // Registro idempotente (clave única por negocio). Una importación ya terminada devuelve su resultado tal cual.
  let reg = await db.importacionProductos.findUnique({ where: { negocioId_clave: { negocioId, clave } } })
  if (reg && reg.estado === "COMPLETADA" && reg.huella === huella && reg.actorId === actorId) return { ok: true as const, value: respuesta(reg) }
  const p = await permisosDe(db, negocioId, actor)
  if (!p || !p.importar) return SIN_PERMISO
  if (!reg) {
    const l0 = leerFilas(b, p)
    if ("ok" in l0) return l0
    try {
      reg = await db.importacionProductos.create({ data: { negocioId, clave, huella, actorTipo: actor.tipo, actorId, archivo: texto(b.archivo, 200), estado: "EN_CURSO", bloqueadaHasta: null } })
    } catch {
      reg = await db.importacionProductos.findUnique({ where: { negocioId_clave: { negocioId, clave } } })
      if (!reg) throw new Error("importacion")
    }
  }
  if (reg.huella !== huella || reg.actorId !== actorId) return fail(409, "Esta importación ya se confirmó con otros datos. Volvé a empezar desde el archivo.", "IMPORTACION_DISTINTA")
  if (reg.estado === "COMPLETADA") return { ok: true as const, value: respuesta(reg) }
  // Turno de procesamiento (horas en UTC, como las guarda Prisma): si otro intento está trabajando, se informa el progreso (sin procesar dos veces).
  const tomada = await db.$executeRaw`UPDATE "importaciones_productos" SET "bloqueadaHasta" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${LEASE_MS / 1000}) WHERE "id" = ${reg.id} AND "estado" = 'EN_CURSO' AND ("bloqueadaHasta" IS NULL OR "bloqueadaHasta" < (now() AT TIME ZONE 'UTC'))`
  if (!tomada) return { ok: true as const, value: respuesta((await db.importacionProductos.findUnique({ where: { id: reg.id } }))!, true) }
  reg = (await db.importacionProductos.findUnique({ where: { id: reg.id } }))!

  const l = leerFilas(b, p)
  if ("ok" in l) return l
  const grupos = await planificar(db, negocioId, p, l.filas)
  await db.importacionProductos.update({ where: { id: reg.id }, data: { totalGrupos: grupos.length } })
  const hechos = (reg.resultados ?? {}) as Record<string, unknown>
  const quien = auditor(actor, negocioId)
  const actorPrecio = actor.tipo === "NEGOCIO" ? { tipo: "NEGOCIO" as const, id: negocioId } : { tipo: "EMPLEADO" as const, id: actor.empleadoId }
  const base = (g: Grupo) => ({ clave: g.clave, filas: g.filas, nombre: g.nombre, productoId: g.productoId })

  const inicio = Date.now()
  let enTanda = 0, pendiente = false
  for (const g of grupos) {
    if (hechos[g.clave]) continue
    if (enTanda >= TANDA_MAX_GRUPOS || Date.now() - inicio > TANDA_MS) { pendiente = true; break }
    enTanda++
    const pedida = decisiones[g.clave]
    const accion: Accion | null = pedida === "crear" || pedida === "omitir" || pedida === "actualizar" ? pedida : null
    if (g.tipo === "ERROR") { await guardarResultado(db, reg.id, { ...base(g), resultado: "ERROR", detalle: g.errores.join(" ") }); continue }
    if (!accion || accion === "omitir") { await guardarResultado(db, reg.id, { ...base(g), resultado: "OMITIDO", detalle: accion ? "Omitido por decisión." : "Sin decisión confirmada." }); continue }
    if (!g.acciones.includes(accion)) {
      await guardarResultado(db, reg.id, { ...base(g), resultado: "OMITIDO", detalle: g.tipo === "EXISTENTE" && accion === "crear" ? "Ya existe en el catálogo (cambió desde la vista previa): no se crea un duplicado." : "La fila cambió desde la vista previa: no se aplicó." })
      continue
    }
    try {
      if (accion === "crear" && g.nuevo) {
        const n = g.nuevo
        const claims: BarcodeClaim[] = [...(n.codigo ? [{ code: n.codigo }] : []), ...n.variantes.flatMap((v) => (v.codigo ? [{ code: v.codigo }] : []))]
        await runBarcodeGuardedWrite(db, { negocioId, claims }, async (tx) => {
          await reservarGrupo(tx, reg!.id, g.clave)
          if (actor.tipo === "EMPLEADO") await tx.$queryRaw`SELECT "id" FROM "empleados" WHERE "id" = ${actor.empleadoId} AND "negocioId" = ${negocioId} FOR SHARE`
          const ahora = await permisosDe(tx, negocioId, actor)
          if (!ahora?.importar || !ahora.crear || (g.proveedorIds.length > 0 && !ahora.proveedores) || (n.costo !== null && !ahora.costos) || ((n.precio > 0 || n.variantes.some((v) => v.precio > 0)) && !ahora.precios)) throw new ErrorGrupo("Tu permiso cambió o venció durante la importación: no se creó.")
          if (await tx.producto.findFirst({ where: { negocioId, eliminado: false, nombre: { equals: n.nombre, mode: "insensitive" } }, select: { id: true } })) throw new ErrorGrupo("Ya existe un producto con ese nombre (se creó mientras tanto): no se duplica.")
          const sinPrecio = n.variantes.length ? n.variantes.some((v) => v.precio <= 0) : n.precio <= 0
          const creado = await tx.producto.create({
            data: {
              negocioId, nombre: n.nombre, descripcion: n.descripcion, categoria: n.categoria, marca: n.marca, codigoBarras: n.codigo, precio: n.precio, costo: n.costo, unidadMedida: "unidad",
              // R3A: la importación nunca carga stock ni genera movimientos.
              stock: !sinPrecio, controlStock: false, stockCantidad: 0, stockMinimo: 0,
              ...(n.variantes.length ? { variantes: { create: n.variantes.map((v) => ({ nombre: v.nombre, codigoBarras: v.codigo, precio: v.precio })) } } : {}),
            },
            select: { id: true },
          })
          await auditLogWithClient(tx, { ...quien, accion: "producto.creado", recurso: "producto", recursoId: creado.id, detalle: { negocioId, nombre: n.nombre, precio: n.precio || null, sinPrecio, variantes: n.variantes.length, origen: "IMPORTACION", importacionId: reg!.id, filas: g.filas } })
          for (const proveedorId of g.proveedorIds) {
            if (await asociarEnTx(tx, negocioId, proveedorId, [{ productoId: creado.id, productoVarianteId: null }])) await auditLogWithClient(tx, { ...quien, accion: "proveedor.productos_asociados", recurso: "proveedor", recursoId: proveedorId, detalle: { negocioId, proveedorId, items: [{ productoId: creado.id, productoVarianteId: null }], creadas: 1, origen: "IMPORTACION", importacionId: reg!.id } })
          }
          await guardarResultado(tx, reg!.id, { ...base(g), productoId: creado.id, resultado: "CREADO", detalle: `${n.variantes.length ? `${n.variantes.length} variantes` : "Producto creado"}${sinPrecio ? " · sin precio de venta" : ""}${g.proveedorIds.length ? ` · ${g.proveedorIds.length} proveedor(es)` : ""}.` })
        })
      } else if (accion === "actualizar" && g.actualizar && g.productoId) {
        const { data, variantes } = g.actualizar
        const productoId = g.productoId
        const claims: BarcodeClaim[] = [...(data.codigoBarras ? [{ code: data.codigoBarras, exclude: { productoId } }] : []), ...variantes.flatMap((v) => (v.codigo ? [{ code: v.codigo, exclude: { varianteId: v.varianteId } }] : []))]
        await runBarcodeGuardedWrite(db, { negocioId, claims }, async (tx) => {
          await reservarGrupo(tx, reg!.id, g.clave)
          if (actor.tipo === "EMPLEADO") await tx.$queryRaw`SELECT "id" FROM "empleados" WHERE "id" = ${actor.empleadoId} AND "negocioId" = ${negocioId} FOR SHARE`
          const ahora = await permisosDe(tx, negocioId, actor)
          const tocaPrecio = data.precio !== undefined || variantes.some((v) => v.precio !== undefined)
          const tocaDatos = ["categoria", "marca", "descripcion", "codigoBarras"].some((k) => k in data) || variantes.some((v) => v.codigo)
          if (!ahora?.importar || (tocaPrecio && !ahora.precios) || ("costo" in data && !ahora.costos) || (tocaDatos && !ahora.editar) || (g.proveedorIds.length && !ahora.proveedores)) throw new ErrorGrupo("Tu permiso cambió o venció durante la importación: no se actualizó.")
          if (!(await tx.producto.findFirst({ where: { id: productoId, negocioId, eliminado: false }, select: { id: true } }))) throw new ErrorGrupo("El producto ya no existe en el catálogo.")
          const d: Record<string, unknown> = { ...data }
          if (data.precio !== undefined) d.stock = true
          const camposAplicados = new Set<string>()
          const variantesAplicadas: Array<{ id: string; campos: string[] }> = []
          let precioProtegidoPorEtiqueta = false
          if (Object.keys(d).length) await conPrecioDeCatalogoEnTx(tx, { negocioId, productoId, varianteId: null }, (etiquetaPendiente) => {
            const aplicar = { ...d }
            if (etiquetaPendiente && "precio" in aplicar) {
              delete aplicar.precio
              // Este valor sólo acompaña al precio importado; conservarlo cambiaría stock indirectamente.
              delete aplicar.stock
              precioProtegidoPorEtiqueta = true
            }
            if (!Object.keys(aplicar).length) return Promise.resolve(null)
            Object.keys(aplicar).forEach((campo) => camposAplicados.add(campo))
            return tx.producto.update({ where: { id: productoId }, data: aplicar })
          }, actorPrecio, { etiquetas: "PRESERVAR" })
          for (const v of variantes) {
            const dv: Record<string, unknown> = {}
            if (v.precio !== undefined) dv.precio = v.precio
            if (v.codigo) dv.codigoBarras = v.codigo
            if (Object.keys(dv).length) await conPrecioDeCatalogoEnTx(tx, { negocioId, productoId, varianteId: v.varianteId }, (etiquetaPendiente) => {
              const aplicar = { ...dv }
              if (etiquetaPendiente && "precio" in aplicar) { delete aplicar.precio; precioProtegidoPorEtiqueta = true }
              if (!Object.keys(aplicar).length) return Promise.resolve(null)
              variantesAplicadas.push({ id: v.varianteId, campos: Object.keys(aplicar) })
              return tx.productoVariante.update({ where: { id: v.varianteId }, data: aplicar })
            }, actorPrecio, { etiquetas: "PRESERVAR" })
          }
          for (const proveedorId of g.proveedorIds) {
            if (await asociarEnTx(tx, negocioId, proveedorId, [{ productoId, productoVarianteId: null }])) await auditLogWithClient(tx, { ...quien, accion: "proveedor.productos_asociados", recurso: "proveedor", recursoId: proveedorId, detalle: { negocioId, proveedorId, items: [{ productoId, productoVarianteId: null }], creadas: 1, origen: "IMPORTACION", importacionId: reg!.id } })
          }
          if (camposAplicados.size || variantesAplicadas.length) await auditLogWithClient(tx, { ...quien, accion: tocaPrecio && !precioProtegidoPorEtiqueta ? "producto.precio_cambiado" : "producto.modificado", recurso: "producto", recursoId: productoId, detalle: { negocioId, campos: [...camposAplicados], variantes: variantesAplicadas, cambios: precioProtegidoPorEtiqueta ? g.cambios.filter((c) => !c.startsWith("precio")) : g.cambios, ...(precioProtegidoPorEtiqueta ? { precioProtegidoPorEtiqueta: true } : {}), origen: "IMPORTACION", importacionId: reg!.id, filas: g.filas } })
          const detalle = [g.cambios.filter((c) => !precioProtegidoPorEtiqueta || !c.startsWith("precio")).join(" · "), ...(precioProtegidoPorEtiqueta ? ["Precio conservado: hay una etiqueta pendiente; resolvela antes de importarlo."] : [])].filter(Boolean).join(" · ")
          await guardarResultado(tx, reg!.id, { ...base(g), resultado: "ACTUALIZADO", detalle })
        })
      }
    } catch (error) {
      if (error instanceof YaProcesado) continue
      const m = error instanceof ErrorGrupo ? error.message : mapBarcodeWriteError(error)?.body.error
      if (!m) console.error("[Importación] grupo", g.clave, error instanceof Error ? error.message : "error")
      await guardarResultado(db, reg.id, { ...base(g), resultado: "ERROR", detalle: m ?? "No se pudo guardar esta fila. Probá de nuevo con las filas con error." })
    }
  }

  if (pendiente) {
    // Tanda terminada: se libera el turno para que la próxima llamada (misma clave) continúe enseguida.
    await db.$executeRaw`UPDATE "importaciones_productos" SET "bloqueadaHasta" = NULL WHERE "id" = ${reg.id}`
    return { ok: true as const, value: respuesta((await db.importacionProductos.findUnique({ where: { id: reg.id } }))!) }
  }
  const fin = (await db.importacionProductos.findUnique({ where: { id: reg.id } }))!
  const res = Object.values((fin.resultados ?? {}) as Record<string, ResultadoGrupo>)
  const cuenta = (r: ResultadoGrupo["resultado"]) => res.filter((x) => x.resultado === r).length
  const resumen = { filas: l.filas.length, creados: cuenta("CREADO"), actualizados: cuenta("ACTUALIZADO"), omitidos: cuenta("OMITIDO"), errores: cuenta("ERROR"), filasConError: res.filter((x) => x.resultado === "ERROR").flatMap((x) => x.filas) }
  await db.$transaction(async (tx) => {
    // Sólo un intento cierra la importación (y deja un único evento de resumen).
    const cerro = await tx.importacionProductos.updateMany({ where: { id: reg!.id, estado: "EN_CURSO" }, data: { estado: "COMPLETADA", resumen, bloqueadaHasta: null } })
    if (!cerro.count) return
    await auditLogWithClient(tx, { ...quien, accion: "catalogo.importacion", recurso: "importacion_productos", recursoId: reg!.id, detalle: { negocioId, archivo: reg!.archivo, ...resumen, origen: "IMPORTACION" } })
  })
  return { ok: true as const, value: respuesta({ ...fin, estado: "COMPLETADA", resumen }) }
}
