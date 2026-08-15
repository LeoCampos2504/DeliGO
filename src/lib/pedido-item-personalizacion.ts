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

/**
 * Formats persisted order sections for UI display without discarding option
 * quantities. The section and option insertion order is preserved.
 */
export function formatPedidoItemSecciones(raw: unknown): string[] {
  const parsed = parsePedidoItemSecciones(raw)
  const lines: string[] = []

  for (const [section, selection] of Object.entries(parsed)) {
    if (typeof selection === "string") {
      lines.push(`${section}: ${selection}`)
      continue
    }

    const options = Object.entries(selection)
      .map(([option, quantity]) => quantity > 1 ? `${option} x${quantity}` : option)

    if (options.length > 0) lines.push(`${section}: ${options.join(", ")}`)
  }

  return lines
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
 * serializa objetos crudos.
 */
export function serializeIngredientesQuitadosLegacy(raw: unknown): string {
  return JSON.stringify(getIngredientesQuitadosNombres(raw))
}

// ---------------------------------------------------------------------------
// P1-A.2B.1 — Distinción de ORIGEN (legacy vs. snapshot estructurado)
// ---------------------------------------------------------------------------
// `parseIngredientesQuitadosRawEntries` (arriba) normaliza la FORMA de cada
// entrada pero descarta si venía como string plano o como objeto — eso alcanza
// para todos los consumidores de solo lectura (nombres planos, agrupado
// declarado), pero NO alcanza para decidir si una entrada ya es un snapshot
// autoritativo completo. Un snapshot estructurado con `grupo: null` (el
// ingrediente no tenía categoría al momento de crear el pedido) es un dato
// FINAL y congelado — no debe tratarse igual que un string legacy solo porque
// ambos comparten `grupo === null`. Por eso esta sección parsea de nuevo,
// preservando el origen real de cada entrada, en vez de reutilizar
// `parseIngredientesQuitadosRawEntries` (cuyo contrato de deduplicación
// "queda la primera" no debe alterarse — ver comentario de esa función).

export type IngredienteQuitadoOrigen = "legacy" | "snapshot"

interface IngredienteQuitadoRawEntryConOrigen extends IngredienteQuitadoRawEntry {
  origen: IngredienteQuitadoOrigen
}

/**
 * Mismo parseo que `parseIngredientesQuitadosRawEntries`, pero conservando de
 * qué tipo de dato vino cada entrada (`"legacy"` = string plano, `"snapshot"`
 * = objeto estructurado, sin importar si su `grupo` es `null` o no). Regla de
 * deduplicación DISTINTA a propósito: ante la misma identidad (nombre+grupo),
 * un snapshot estructurado siempre reemplaza a una entrada legacy ya vista
 * (nunca al revés); entre dos entradas del mismo origen, gana la primera
 * (mismo criterio determinista que el resto del archivo). No muta `raw`,
 * nunca lanza.
 */
function parseIngredientesQuitadosRawEntriesConOrigen(raw: unknown): IngredienteQuitadoRawEntryConOrigen[] {
  const parsed = parseJsonMaybeString(raw)
  if (!Array.isArray(parsed)) return []

  const byKey = new Map<string, IngredienteQuitadoRawEntryConOrigen>()
  const order: string[] = []

  for (const entry of parsed) {
    let candidate: IngredienteQuitadoRawEntryConOrigen | null = null

    if (typeof entry === "string") {
      const nombre = entry.trim()
      if (!nombre) continue
      candidate = { nombre, grupo: null, grupoOrden: null, opcionOrden: null, origen: "legacy" }
    } else if (isPlainObject(entry)) {
      const nombre = typeof entry.nombre === "string" ? entry.nombre.trim() : ""
      if (!nombre) continue
      if (entry.accion !== undefined && entry.accion !== "quitar") continue
      const grupo = typeof entry.grupo === "string" && entry.grupo.trim() ? entry.grupo.trim() : null
      candidate = {
        nombre,
        grupo,
        grupoOrden: normalizeOrdenField(entry.grupoOrden),
        opcionOrden: normalizeOrdenField(entry.opcionOrden),
        origen: "snapshot",
      }
    } else {
      continue
    }

    const key = rawEntryDedupKey(candidate.nombre, candidate.grupo)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, candidate)
      order.push(key)
      continue
    }
    if (existing.origen === "legacy" && candidate.origen === "snapshot") {
      byKey.set(key, candidate)
    }
  }

  return order.map((key) => byKey.get(key)!)
}

export interface IngredienteQuitadoPersistido {
  ingrediente: IngredienteQuitadoCanonico
  origen: IngredienteQuitadoOrigen
}

/**
 * Forma canónica de cada ingrediente quitado, junto con su origen real
 * (`"legacy"` | `"snapshot"`). A diferencia de `parseIngredientesQuitadosCanonicos`,
 * esta es la función que un endpoint de LECTURA con acceso al producto real
 * (el detalle de Mozo) debe usar para decidir si una entrada necesita
 * reconsultar el producto — nunca inferir el origen comparando
 * `entry.grupo !== null`, porque un snapshot legítimo puede tener
 * `grupo: null` (ingrediente sin categoría al momento de crear el pedido) y
 * eso NO lo convierte en legacy.
 */
export function parseIngredientesQuitadosPersistidos(raw: unknown): IngredienteQuitadoPersistido[] {
  return parseIngredientesQuitadosRawEntriesConOrigen(raw).map((entry) => ({
    ingrediente: {
      nombre: entry.nombre,
      grupo: entry.grupo,
      accion: "quitar" as const,
      grupoOrden: entry.grupoOrden,
      opcionOrden: entry.opcionOrden,
    },
    origen: entry.origen,
  }))
}

// ---------------------------------------------------------------------------
// P1-A.2B — Builder autoritativo del snapshot persistido
// ---------------------------------------------------------------------------
// A diferencia de todo lo demás en este archivo (que solo LEE/normaliza datos
// ya persistidos), esta función construye el dato que un endpoint de
// escritura (POST /api/pedidos, alta manual de Mozo) va a guardar. El cliente
// nunca es autoridad acá: `requested` se trata exclusivamente como "qué
// nombres pidió quitar" — cualquier `grupo`/`accion`/`orden` que el cliente
// hubiera enviado se descarta sin leerlo siquiera (extractRequestedNames solo
// mira `.nombre`). El `grupo` final sale SIEMPRE de `productoIngredientes`
// (la relación real Producto -> ProductoIngrediente -> Ingrediente, ya
// resuelta y scopeada al negocio/producto correctos por el llamador).

function extractRequestedNames(requested: unknown): string[] {
  const parsed = parseJsonMaybeString(requested)
  if (!Array.isArray(parsed)) return []
  const result: string[] = []
  for (const entry of parsed) {
    if (typeof entry === "string") {
      const nombre = entry.trim()
      if (nombre) result.push(nombre)
      continue
    }
    // Defensivo: si por error llega un objeto (el cliente nunca debería
    // enviar esta forma en el request), se extrae únicamente `.nombre` — el
    // resto de sus campos (grupo/accion/orden/id) se ignora sin leerlos.
    if (isPlainObject(entry) && typeof entry.nombre === "string") {
      const nombre = entry.nombre.trim()
      if (nombre) result.push(nombre)
    }
  }
  return result
}

export interface BuildIngredientesQuitadosSnapshotResult {
  snapshot: IngredienteQuitadoCanonico[]
  invalidNames: string[]
}

/**
 * Referencia de un ingrediente real de un producto, para el builder
 * autoritativo. Incluye `negocioId` a propósito (P1-A.2B.1): el schema NO
 * tiene una restricción compuesta de negocio en `ProductoIngrediente ->
 * Ingrediente` (`Ingrediente.negocioId` no está validado contra el negocio
 * del producto a nivel de base de datos), así que una relación
 * estructuralmente inconsistente (`Producto` del negocio A apuntando, vía
 * `ProductoIngrediente`, a un `Ingrediente` del negocio B) es posible aunque
 * las APIs administrativas nunca la creen. El builder valida esto de forma
 * EXPLÍCITA — nunca confía en que el llamador ya filtró correctamente.
 */
export interface ProductoIngredienteSnapshotRef {
  nombre: string
  categoria: string | null
  negocioId: string
}

/**
 * Construye el snapshot autoritativo de `ingredientesQuitados` a partir de lo
 * que pidió el cliente (`requested`, tratado únicamente como una lista de
 * nombres) y la lista real de ingredientes del producto ya validado
 * (`productoIngredientes`). El llamador sigue siendo responsable de pasar
 * solo referencias del producto correcto — pero el negocio de cada
 * referencia se revalida acá mismo contra `expectedNegocioId`, sin depender
 * únicamente de esa responsabilidad externa (ver `ProductoIngredienteSnapshotRef`).
 *
 * Reglas:
 * - `nombre` y `grupo` (= `categoria.trim()`, o `null` si queda vacía) salen
 *   siempre de `productoIngredientes`, nunca de `requested`.
 * - `accion` es siempre `"quitar"`.
 * - `grupoOrden`/`opcionOrden` quedan siempre en `null` — ni `Ingrediente` ni
 *   `ProductoIngrediente` tienen una columna de orden real en el schema
 *   actual (auditado explícitamente), así que no hay ningún valor canónico
 *   que persistir; inventar uno violaría la regla de nunca fabricar datos
 *   que el negocio no configuró.
 * - Un nombre repetido en `requested` se deduplica (se conserva la primera
 *   aparición).
 * - Una referencia con `ref.negocioId !== expectedNegocioId` NUNCA es
 *   candidata válida: se descarta ANTES de participar en la resolución de
 *   nombre/categoría o en la detección de ambigüedad — nunca se persiste su
 *   `negocioId`, nunca se expone en ninguna respuesta.
 * - Un nombre que no resuelve contra ninguna referencia válida del negocio
 *   esperado (inexistente, pertenece a otro producto, o solo existe en una
 *   referencia de otro negocio) se agrega a `invalidNames`, nunca al
 *   snapshot.
 * - Si existen una referencia válida del negocio esperado Y otra de otro
 *   negocio con el mismo nombre, la referencia ajena se descarta por completo
 *   (regla anterior) antes de llegar a la detección de ambigüedad — por lo
 *   tanto NO se marca ambiguo; se usa únicamente la referencia válida. La
 *   ambigüedad real (dos `Ingrediente` distintos y AMBOS del negocio
 *   esperado comparten nombre — posible porque `Ingrediente` no tiene
 *   restricción de unicidad por nombre) sigue rechazándose: se agrega a
 *   `invalidNames`, porque el contrato público identifica ingredientes solo
 *   por nombre y no hay forma segura de elegir uno sin arriesgarse a
 *   fusionar dos ingredientes reales distintos. El llamador debe responder
 *   400 ante cualquier `invalidNames` no vacío — nunca crear el pedido con
 *   un snapshot parcial.
 * - No muta `requested` ni `productoIngredientes`. Nunca lanza.
 */
export function buildIngredientesQuitadosSnapshot(
  requested: unknown,
  productoIngredientes: ProductoIngredienteSnapshotRef[],
  expectedNegocioId: string
): BuildIngredientesQuitadosSnapshotResult {
  const requestedNames = extractRequestedNames(requested)

  const categoriaPorNombre = new Map<string, string | null>()
  const ambiguousNames = new Set<string>()
  const seenNombres = new Set<string>()
  for (const ref of productoIngredientes) {
    // Una referencia de otro negocio nunca es candidata — se descarta antes
    // de poder resolver un nombre o de poder disparar una falsa ambigüedad.
    if (ref.negocioId !== expectedNegocioId) continue
    const nombre = ref.nombre.trim()
    if (!nombre) continue
    if (seenNombres.has(nombre)) {
      ambiguousNames.add(nombre)
      continue
    }
    seenNombres.add(nombre)
    const categoria = (ref.categoria ?? "").trim()
    categoriaPorNombre.set(nombre, categoria || null)
  }

  const snapshot: IngredienteQuitadoCanonico[] = []
  const invalidNames: string[] = []
  const dedup = new Set<string>()

  for (const nombre of requestedNames) {
    if (dedup.has(nombre)) continue
    dedup.add(nombre)

    if (ambiguousNames.has(nombre) || !categoriaPorNombre.has(nombre)) {
      invalidNames.push(nombre)
      continue
    }

    snapshot.push({
      nombre,
      grupo: categoriaPorNombre.get(nombre) ?? null,
      accion: "quitar",
      grupoOrden: null,
      opcionOrden: null,
    })
  }

  return { snapshot, invalidNames }
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
