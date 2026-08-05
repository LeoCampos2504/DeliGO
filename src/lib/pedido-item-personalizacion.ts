// ============================================
// DeliGO — Normalizador puro de personalizaciones de PedidoItem (P1-A)
// ============================================
// `PedidoItem.agregados` / `.secciones` / `.ingredientesQuitados` se guardan
// como JSON serializado en columnas `String` (ver prisma/schema.prisma). Cada
// superficie que los muestra (Salón, PyR, este helper) necesita parsearlos de
// forma segura antes de renderizar — este módulo es la única fuente
// compartida para eso: sin React, sin fetch, sin Prisma, 100% puro y
// testeable. No decide textos ni colores (eso es responsabilidad de
// src/components/operativo/pedido-detalle.tsx) — solo garantiza que, sin
// importar qué tan mal formado venga el dato (pedido histórico, JSON
// corrupto, `null`), el resultado sea siempre una forma segura y consistente,
// nunca un throw.
//
// No reconstruye grupos por coincidencia de texto ni heurísticas: si el dato
// estructurado no está, simplemente no aparece — nunca se inventa un grupo
// ni se reclasifica una elección normal como "quitada".

export interface PedidoItemAgregadoParsed {
  id?: string
  nombre: string
  precio: number
}

export type PedidoItemSeccionSeleccion = string | Record<string, number>

export interface ParsedPedidoItemPersonalizaciones {
  agregados: PedidoItemAgregadoParsed[]
  secciones: Record<string, PedidoItemSeccionSeleccion>
  ingredientesQuitados: string[]
}

function parseJsonMaybeString(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeAgregado(raw: unknown): PedidoItemAgregadoParsed | null {
  if (!isPlainObject(raw)) return null
  const nombre = typeof raw.nombre === "string" ? raw.nombre.trim() : ""
  if (!nombre) return null
  const precio = typeof raw.precio === "number" && Number.isFinite(raw.precio) ? raw.precio : 0
  const id = typeof raw.id === "string" && raw.id ? raw.id : undefined
  return { id, nombre, precio }
}

/** `agregados`: JSON de un array `[{id?, nombre, precio}]`. Nunca lanza. */
export function parsePedidoItemAgregados(raw: unknown): PedidoItemAgregadoParsed[] {
  const parsed = parseJsonMaybeString(raw)
  if (!Array.isArray(parsed)) return []
  const result: PedidoItemAgregadoParsed[] = []
  for (const entry of parsed) {
    const agregado = normalizeAgregado(entry)
    if (agregado) result.push(agregado)
  }
  return result
}

function normalizeSeccionSeleccion(raw: unknown): PedidoItemSeccionSeleccion | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    return trimmed ? trimmed : null
  }
  if (isPlainObject(raw)) {
    const result: Record<string, number> = {}
    for (const [optionName, quantity] of Object.entries(raw)) {
      const name = optionName.trim()
      if (!name) continue
      if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) continue
      result[name] = quantity
    }
    return Object.keys(result).length > 0 ? result : null
  }
  return null
}

/**
 * `secciones`: JSON de un objeto `{ nombreDeGrupo: opciónElegida }`. El
 * nombre del grupo es exactamente la clave guardada al crear el pedido (el
 * mismo nombre configurado por el negocio en `Producto.secciones` en ese
 * momento) — nunca se reconstruye ni se adivina acá. El orden de las claves
 * es el orden de inserción original del objeto (determinista para un mismo
 * input), preservado por `Object.entries` más abajo en el renderer.
 */
export function parsePedidoItemSecciones(raw: unknown): Record<string, PedidoItemSeccionSeleccion> {
  const parsed = parseJsonMaybeString(raw)
  if (!isPlainObject(parsed)) return {}
  const result: Record<string, PedidoItemSeccionSeleccion> = {}
  for (const [groupNameRaw, selectionRaw] of Object.entries(parsed)) {
    const groupName = groupNameRaw.trim()
    if (!groupName) continue // sin nombre de grupo -> se descarta, nunca se inventa uno
    const selection = normalizeSeccionSeleccion(selectionRaw)
    if (selection !== null) result[groupName] = selection
  }
  return result
}

// ---------------------------------------------------------------------------
// P1-A.1 — Parser retrocompatible de `ingredientesQuitados`
// ---------------------------------------------------------------------------
// `PedidoItem.ingredientesQuitados` es, HOY, siempre un array plano de
// nombres (`["Cebolla", "Mayonesa"]") — así lo escribe `POST /api/pedidos`
// para todo pedido, histórico o nuevo (ver CLAUDE_REPORT.md, sección
// "Persistencia", para la justificación de por qué esta corrección NO cambia
// esa escritura). Este parser igual acepta, de forma defensiva y adelantada,
// un formato estructurado por entrada (`{nombre, grupo?, accion?,
// grupoOrden?, opcionOrden?}`) para el día en que algo empiece a escribirlo,
// sin asumir que exista todavía. En ambos casos, el `grupo`/`orden` que
// pudiera venir en el dato NUNCA es la fuente final que ve el Mozo — la
// fuente real es siempre `enrichIngredientesQuitadosConGrupoReal` (más abajo),
// que cruza contra el producto real. Este parser solo extrae "qué nombres
// pidió quitar el cliente", nunca decide su grupo definitivo.

export type IngredienteQuitadoAccion = "quitar"

export interface IngredienteQuitadoEntry {
  nombre: string
  /** Grupo declarado en el propio dato (si lo hubiera) — NUNCA autoritativo, ver comentario de arriba. */
  grupoDeclarado: string | null
  accion: IngredienteQuitadoAccion
}

// ---------------------------------------------------------------------------
// P1-A.2A-i — Parser interno compartido
// ---------------------------------------------------------------------------
// Única función que efectivamente recorre y valida el JSON crudo de
// `ingredientesQuitados` — todo lo demás en este archivo (Entries legacy,
// nombres planos, canónico, agrupado, serialización legacy) se arma a partir
// de acá, para no repetir las mismas reglas de validación/dedup en cuatro
// lugares distintos. Su forma interna (con grupoOrden/opcionOrden ya
// normalizados) es un detalle de implementación — no se exporta.
interface IngredienteQuitadoRawEntry {
  nombre: string
  grupo: string | null
  grupoOrden: number | null
  opcionOrden: number | null
}

function normalizeOrdenField(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null
}

function rawEntryDedupKey(nombre: string, grupo: string | null): string {
  // JSON.stringify de la tupla en vez de un separador de texto: un nombre que
  // contenga cualquier caracter (incluida una coma o una barra) nunca puede
  // colisionar por accidente con el valor de grupo.
  return JSON.stringify([nombre, grupo])
}

/**
 * Acepta `["Cebolla"]` (histórico) y
 * `[{"nombre":"Cebolla","grupo":"Vegetales","accion":"quitar","grupoOrden":1,"opcionOrden":2}]`
 * (estructurado), incluso mezclados en el mismo array. Nunca lanza. Deduplica
 * por identidad semántica nombre+grupo: dos entradas con el mismo nombre pero
 * grupo distinto se conservan ambas; el mismo nombre repetido con el mismo
 * grupo (o ambos sin grupo) se colapsa en una sola, quedándose con la
 * primera. No muta `raw`.
 */
function parseIngredientesQuitadosRawEntries(raw: unknown): IngredienteQuitadoRawEntry[] {
  const parsed = parseJsonMaybeString(raw)
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  const result: IngredienteQuitadoRawEntry[] = []

  for (const entry of parsed) {
    if (typeof entry === "string") {
      const nombre = entry.trim()
      if (!nombre) continue
      const key = rawEntryDedupKey(nombre, null)
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ nombre, grupo: null, grupoOrden: null, opcionOrden: null })
      continue
    }

    if (isPlainObject(entry)) {
      const nombre = typeof entry.nombre === "string" ? entry.nombre.trim() : ""
      if (!nombre) continue
      // Cualquier acción declarada que no sea exactamente "quitar" se
      // rechaza — este campo solo representa quitados, nunca otra cosa.
      if (entry.accion !== undefined && entry.accion !== "quitar") continue
      const grupo = typeof entry.grupo === "string" && entry.grupo.trim() ? entry.grupo.trim() : null
      const key = rawEntryDedupKey(nombre, grupo)
      if (seen.has(key)) continue
      seen.add(key)
      result.push({
        nombre,
        grupo,
        grupoOrden: normalizeOrdenField(entry.grupoOrden),
        opcionOrden: normalizeOrdenField(entry.opcionOrden),
      })
      continue
    }
    // Cualquier otro tipo (número, boolean, array anidado, null) se ignora.
  }

  return result
}

/**
 * Acepta tanto `["Cebolla"]` (formato histórico) como
 * `[{"nombre":"Cebolla","grupo":"Vegetales","accion":"quitar"}]` (formato
 * estructurado). Una entrada con `accion` distinta de `"quitar"` se
 * descarta por completo (nunca se acepta como ingrediente quitado). Nunca
 * lanza ante JSON corrupto o tipos inesperados. Deduplica por nombre
 * únicamente (P1-A.2A-i: a diferencia de `parseIngredientesQuitadosCanonicos`
 * más abajo, esta función legacy nunca distingue por grupo — su único
 * consumidor, `enrichIngredientesQuitadosConGrupoReal`, vuelve a deduplicar
 * por nombre de todos modos, así que conservar ese comportamiento exacto no
 * cambia nada observable y evita romper el contrato ya documentado de
 * P1-A.1).
 */
export function parsePedidoItemIngredientesQuitadosEntries(raw: unknown): IngredienteQuitadoEntry[] {
  const seen = new Set<string>()
  const result: IngredienteQuitadoEntry[] = []
  for (const entry of parseIngredientesQuitadosRawEntries(raw)) {
    if (seen.has(entry.nombre)) continue
    seen.add(entry.nombre)
    result.push({ nombre: entry.nombre, grupoDeclarado: entry.grupo, accion: "quitar" })
  }
  return result
}

/** Conveniencia: solo los nombres, sin importar el formato de origen. */
export function parsePedidoItemIngredientesQuitados(raw: unknown): string[] {
  return getIngredientesQuitadosNombres(raw)
}

// ---------------------------------------------------------------------------
// P1-A.1 — Enriquecimiento server-side del grupo real (autoritativo)
// ---------------------------------------------------------------------------

export interface ProductoIngredienteRef {
  nombre: string
  categoria: string
}

export interface IngredienteQuitadoGrupo {
  grupo: string
  ingredientes: string[]
}

const GRUPO_NEUTRAL_INGREDIENTES = "Ingredientes"

/**
 * Deriva el grupo/categoría REAL de cada ingrediente quitado cruzando
 * exclusivamente contra la lista real de ingredientes del producto
 * (`ProductoIngrediente -> Ingrediente`, ya resuelta por el llamador) —
 * nunca contra un `grupo` que el propio dato pudiera declarar (ver
 * `IngredienteQuitadoEntry.grupoDeclarado`, que esta función ignora a
 * propósito). Un nombre que ya no puede resolverse contra el producto
 * (ingrediente eliminado, producto cambiado desde que se hizo el pedido)
 * cae al grupo neutral "Ingredientes" — nunca se inventa una categoría
 * específica ni se reconstruye por coincidencia de texto.
 *
 * Orden: NO existe en el schema actual un campo de orden configurado por el
 * negocio para `Ingrediente`/`ProductoIngrediente` (auditado: ninguno de los
 * dos modelos tiene una columna `orden`). Por lo tanto, el orden devuelto es
 * un FALLBACK determinista (categoría y nombre con `localeCompare`), nunca
 * el orden canónico que el negocio pudiera haber configurado visualmente —
 * distinción documentada explícitamente en CLAUDE_REPORT.md.
 */
export function enrichIngredientesQuitadosConGrupoReal(
  nombresQuitados: string[],
  productoIngredientes: ProductoIngredienteRef[]
): IngredienteQuitadoGrupo[] {
  const categoriaPorNombre = new Map<string, string>()
  for (const ref of productoIngredientes) {
    const nombre = ref.nombre.trim()
    if (!nombre) continue
    categoriaPorNombre.set(nombre, ref.categoria.trim() || GRUPO_NEUTRAL_INGREDIENTES)
  }

  const categoriasOrdenadas = [...new Set(categoriaPorNombre.values())].sort((a, b) => a.localeCompare(b, "es"))
  const grupoOrdenPorCategoria = new Map(categoriasOrdenadas.map((categoria, index) => [categoria, index]))

  const seen = new Set<string>()
  const porGrupo = new Map<string, { grupoOrden: number; nombres: string[] }>()

  for (const nombreRaw of nombresQuitados) {
    const nombre = nombreRaw.trim()
    if (!nombre || seen.has(nombre)) continue
    seen.add(nombre)

    const categoria = categoriaPorNombre.get(nombre) ?? GRUPO_NEUTRAL_INGREDIENTES
    const grupoOrden = grupoOrdenPorCategoria.get(categoria) ?? categoriasOrdenadas.length

    if (!porGrupo.has(categoria)) {
      porGrupo.set(categoria, { grupoOrden, nombres: [] })
    }
    porGrupo.get(categoria)!.nombres.push(nombre)
  }

  const resultado = [...porGrupo.entries()].map(([grupo, data]) => ({
    grupo,
    grupoOrden: data.grupoOrden,
    ingredientes: [...data.nombres].sort((a, b) => a.localeCompare(b, "es")),
  }))

  resultado.sort((a, b) => a.grupoOrden - b.grupoOrden)
  return resultado.map(({ grupo, ingredientes }) => ({ grupo, ingredientes }))
}

// ---------------------------------------------------------------------------
// P1-A.2A-i — Contrato canónico compartido para consumidores UI
// ---------------------------------------------------------------------------
// A diferencia de `enrichIngredientesQuitadosConGrupoReal` (arriba), estas
// funciones NO consultan la base de datos: sirven para las superficies que no
// tienen a mano la lista real de ingredientes del producto (PyR, Salón,
// Negocio, Cliente, Repartidor). El grupo que exponen es el que el propio
// dato estructurado declara (o un fallback neutral) — nunca el grupo real
// derivado del producto. Esa agrupación "autoritativa" contra el producto
// real sigue siendo exclusiva del detalle de Mozo hasta P1-A.2B.

export interface IngredienteQuitadoCanonico {
  nombre: string
  grupo: string | null
  accion: IngredienteQuitadoAccion
  grupoOrden: number | null
  opcionOrden: number | null
}

/**
 * Forma canónica completa de cada ingrediente quitado, sin perder
 * `grupo`/`grupoOrden`/`opcionOrden` cuando el dato estructurado los trae.
 * Ver `parseIngredientesQuitadosRawEntries` para las reglas de validación y
 * deduplicación (por nombre+grupo: el mismo nombre en dos grupos distintos
 * se conserva como dos entradas).
 */
export function parseIngredientesQuitadosCanonicos(raw: unknown): IngredienteQuitadoCanonico[] {
  return parseIngredientesQuitadosRawEntries(raw).map((entry) => ({
    nombre: entry.nombre,
    grupo: entry.grupo,
    accion: "quitar" as const,
    grupoOrden: entry.grupoOrden,
    opcionOrden: entry.opcionOrden,
  }))
}

/**
 * Solo nombres, siempre `string[]`, siempre seguro para `.map`/`.join` en
 * JSX plano. A diferencia del canónico, acá sí se deduplica por nombre
 * únicamente (sin importar el grupo) — una superficie que solo puede
 * mostrar texto plano no debe repetir "Cebolla" dos veces solo porque el
 * dato estructurado la declaró en dos grupos.
 */
export function getIngredientesQuitadosNombres(raw: unknown): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of parseIngredientesQuitadosRawEntries(raw)) {
    if (seen.has(entry.nombre)) continue
    seen.add(entry.nombre)
    result.push(entry.nombre)
  }
  return result
}

/**
 * Agrupa por `grupo` declarado en el propio dato (nunca por el grupo real
 * del producto — ver comentario de la sección). Un ingrediente sin grupo
 * declarado (formato histórico, o estructurado sin `grupo`) cae en
 * `fallbackGroup` (por defecto "Ingredientes"). Nunca genera grupos vacíos.
 * Orden de grupos: por `grupoOrden` ascendente cuando está declarado; el
 * resto, alfabético (`localeCompare("es")`) por nombre de grupo. Orden
 * dentro de cada grupo: por `opcionOrden` ascendente cuando está declarado;
 * el resto, alfabético por nombre de ingrediente.
 */
export function groupIngredientesQuitados(
  raw: unknown,
  fallbackGroup: string = GRUPO_NEUTRAL_INGREDIENTES
): IngredienteQuitadoGrupo[] {
  const entries = parseIngredientesQuitadosRawEntries(raw)
  if (entries.length === 0) return []

  const porGrupo = new Map<
    string,
    { grupoOrden: number | null; miembros: Array<{ nombre: string; opcionOrden: number | null }> }
  >()

  for (const entry of entries) {
    const grupo = entry.grupo ?? fallbackGroup
    if (!porGrupo.has(grupo)) {
      porGrupo.set(grupo, { grupoOrden: entry.grupoOrden, miembros: [] })
    }
    const bucket = porGrupo.get(grupo)!
    if (bucket.grupoOrden === null && entry.grupoOrden !== null) bucket.grupoOrden = entry.grupoOrden
    bucket.miembros.push({ nombre: entry.nombre, opcionOrden: entry.opcionOrden })
  }

  const grupos = [...porGrupo.entries()].map(([grupo, data]) => ({
    grupo,
    grupoOrden: data.grupoOrden,
    ingredientes: [...data.miembros]
      .sort((a, b) => {
        if (a.opcionOrden !== null && b.opcionOrden !== null && a.opcionOrden !== b.opcionOrden) {
          return a.opcionOrden - b.opcionOrden
        }
        if (a.opcionOrden !== null && b.opcionOrden === null) return -1
        if (a.opcionOrden === null && b.opcionOrden !== null) return 1
        return a.nombre.localeCompare(b.nombre, "es")
      })
      .map((miembro) => miembro.nombre),
  }))

  grupos.sort((a, b) => {
    if (a.grupoOrden !== null && b.grupoOrden !== null && a.grupoOrden !== b.grupoOrden) {
      return a.grupoOrden - b.grupoOrden
    }
    if (a.grupoOrden !== null && b.grupoOrden === null) return -1
    if (a.grupoOrden === null && b.grupoOrden !== null) return 1
    return a.grupo.localeCompare(b.grupo, "es")
  })

  return grupos.map(({ grupo, ingredientes }) => ({ grupo, ingredientes }))
}

/**
 * JSON de `string[]` válido para flujos legacy que todavía esperan ese
 * contrato exacto (ej. hidratar el carrito al "repetir pedido"). Nunca
 * serializa objetos crudos. No se usa todavía para escribir
 * `PedidoItem.ingredientesQuitados` en la base de datos (eso es P1-A.2B).
 */
export function serializeIngredientesQuitadosLegacy(raw: unknown): string {
  return JSON.stringify(getIngredientesQuitadosNombres(raw))
}

/** Normaliza los tres campos de personalización de un PedidoItem a la vez. */
export function parsePedidoItemPersonalizaciones(item: {
  agregados?: unknown
  secciones?: unknown
  ingredientesQuitados?: unknown
}): ParsedPedidoItemPersonalizaciones {
  return {
    agregados: parsePedidoItemAgregados(item.agregados),
    secciones: parsePedidoItemSecciones(item.secciones),
    ingredientesQuitados: parsePedidoItemIngredientesQuitados(item.ingredientesQuitados),
  }
}
