import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { createNotification, newOrderNotification, salonNewOrderNotification, empleadosNewOrderNotification } from "@/lib/push"
import { isNegocioOpen } from "@/lib/utils"
import { acquireLock, releaseLock } from "@/lib/concurrency"

// Platform service fee used server-side. This must never come from the request body.
const SERVICE_FEE_FIXED = 250
const MESA_SERVICE_FEE_ENABLED = false
const MAX_ITEMS_PER_ORDER = 50
const MAX_QUANTITY_PER_ITEM = 99
const MAX_AGREGADOS_PER_ITEM = 40
const MAX_SECCIONES_PER_ITEM = 30
const MAX_OPTION_QUANTITY = 99
const MAX_TEXT_LENGTH = 500

type MetodoEntrega = "retiro" | "domicilio" | "mesa"
type MetodoPago = "efectivo" | "transferencia"
type SectionSelection = string | Record<string, number>

interface IncomingAgregado {
  id: string
}

interface IncomingPedidoItem {
  productoId: string
  cantidad: number
  agregados: IncomingAgregado[]
  secciones: Record<string, SectionSelection>
  ingredientesQuitados: string[]
  talle: string
  color: string
}

interface PedidoPayload {
  negocioId: string
  items: IncomingPedidoItem[]
  metodoEntrega: MetodoEntrega
  metodoPago: MetodoPago
  notas: string | null
  direccion: string | null
  referencia: string | null
  lat: number | null
  lng: number | null
  mesaId: string | null
  mesaNumero: number | null
  empleadoCodigo: string | null
  fingerprint: string | null
}

interface ValidatedPedidoItem {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  agregados: Array<{ id: string; nombre: string; precio: number; tipo: string }>
  secciones: Record<string, SectionSelection>
  ingredientesQuitados: string[]
  talle: string
  color: string
}

interface SharedOptionConfig {
  id: string
  obligatorio: boolean
  maximo: number
}

interface ProductSection {
  nombre: string
  opciones: string[]
  obligatorio: boolean
  maximo: number
}

interface SharedOption {
  id: string
  opciones: Array<{ nombre: string; precio: number }>
}

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

class DebtLimitExceededError extends Error {
  constructor() {
    super("DEBT_LIMIT_EXCEEDED")
  }
}

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value }
}

function fail<T = never>(error: string): ValidationResult<T> {
  return { ok: false, error }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function safeParseJSON<T>(value: unknown, fallback: T): T {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

function readRequiredText(value: unknown, field: string): ValidationResult<string> {
  if (typeof value !== "string") return fail(`${field} es requerido`)
  const trimmed = value.trim()
  if (!trimmed) return fail(`${field} es requerido`)
  if (trimmed.length > MAX_TEXT_LENGTH) return fail(`${field} es demasiado largo`)
  return ok(trimmed)
}

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, MAX_TEXT_LENGTH) : null
}

function readNullableCoordinate(value: unknown, field: string): ValidationResult<number | null> {
  if (value === undefined || value === null || value === "") return ok(null)
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(`${field} debe ser un numero valido`)
  }
  return ok(value)
}

function validateLatitude(value: number | null): ValidationResult<number | null> {
  if (value === null) return ok(null)
  if (value < -90 || value > 90) return fail("lat fuera de rango")
  return ok(value)
}

function validateLongitude(value: number | null): ValidationResult<number | null> {
  if (value === null) return ok(null)
  if (value < -180 || value > 180) return fail("lng fuera de rango")
  return ok(value)
}

function readOptionalPositiveInteger(value: unknown, field: string): ValidationResult<number | null> {
  if (value === undefined || value === null || value === "") return ok(null)
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fail(`${field} debe ser un entero positivo`)
  }
  return ok(value)
}

function validateAgregados(value: unknown): ValidationResult<IncomingAgregado[]> {
  if (value === undefined || value === null) return ok([])
  if (!Array.isArray(value)) return fail("agregados debe ser una lista")
  if (value.length > MAX_AGREGADOS_PER_ITEM) return fail("Demasiados agregados en un item")

  const seen = new Set<string>()
  const agregados: IncomingAgregado[] = []
  for (const raw of value) {
    if (!isPlainObject(raw)) return fail("Agregado invalido")
    const idResult = readRequiredText(raw.id, "agregado.id")
    if (!idResult.ok) return idResult
    if (seen.has(idResult.value)) return fail("Agregado duplicado")
    seen.add(idResult.value)
    agregados.push({ id: idResult.value })
  }
  return ok(agregados)
}

function validateSecciones(value: unknown): ValidationResult<Record<string, SectionSelection>> {
  if (value === undefined || value === null) return ok({})
  if (!isPlainObject(value)) return fail("secciones debe ser un objeto")

  const entries = Object.entries(value)
  if (entries.length > MAX_SECCIONES_PER_ITEM) return fail("Demasiadas secciones en un item")

  const result: Record<string, SectionSelection> = {}
  for (const [rawSectionName, rawSelection] of entries) {
    const sectionName = rawSectionName.trim()
    if (!sectionName) return fail("Nombre de seccion invalido")
    if (sectionName.length > MAX_TEXT_LENGTH) return fail("Nombre de seccion demasiado largo")

    if (typeof rawSelection === "string") {
      const option = rawSelection.trim()
      if (option) result[sectionName] = option.slice(0, MAX_TEXT_LENGTH)
      continue
    }

    if (!isPlainObject(rawSelection)) return fail("Seleccion de seccion invalida")

    const selectedOptions: Record<string, number> = {}
    for (const [rawOptionName, rawQuantity] of Object.entries(rawSelection)) {
      const optionName = rawOptionName.trim()
      if (!optionName) return fail("Opcion de seccion invalida")
      if (
        typeof rawQuantity !== "number" ||
        !Number.isInteger(rawQuantity) ||
        rawQuantity <= 0 ||
        rawQuantity > MAX_OPTION_QUANTITY
      ) {
        return fail("Cantidad de opcion invalida")
      }
      selectedOptions[optionName.slice(0, MAX_TEXT_LENGTH)] = rawQuantity
    }

    if (Object.keys(selectedOptions).length > 0) {
      result[sectionName] = selectedOptions
    }
  }

  return ok(result)
}

function validateStringList(value: unknown, field: string): ValidationResult<string[]> {
  if (value === undefined || value === null) return ok([])
  if (!Array.isArray(value)) return fail(`${field} debe ser una lista`)
  if (value.length > MAX_AGREGADOS_PER_ITEM) return fail(`${field} tiene demasiados elementos`)

  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== "string") return fail(`${field} contiene un valor invalido`)
    const trimmed = item.trim()
    if (!trimmed) continue
    if (trimmed.length > MAX_TEXT_LENGTH) return fail(`${field} contiene un valor demasiado largo`)
    if (!seen.has(trimmed)) {
      seen.add(trimmed)
      result.push(trimmed)
    }
  }
  return ok(result)
}

function validatePedidoPayload(payload: unknown): ValidationResult<PedidoPayload> {
  if (!isPlainObject(payload)) return fail("Body invalido")

  const negocioId = readRequiredText(payload.negocioId, "negocioId")
  if (!negocioId.ok) return negocioId

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return fail("Debe contener al menos un producto")
  }
  if (payload.items.length > MAX_ITEMS_PER_ORDER) {
    return fail("El pedido tiene demasiados items")
  }

  const items: IncomingPedidoItem[] = []
  for (const rawItem of payload.items) {
    if (!isPlainObject(rawItem)) return fail("Item invalido")

    const productoId = readRequiredText(rawItem.productoId, "productoId")
    if (!productoId.ok) return productoId

    if (
      typeof rawItem.cantidad !== "number" ||
      !Number.isInteger(rawItem.cantidad) ||
      rawItem.cantidad <= 0 ||
      rawItem.cantidad > MAX_QUANTITY_PER_ITEM
    ) {
      return fail("Cantidad invalida")
    }

    const agregados = validateAgregados(rawItem.agregados)
    if (!agregados.ok) return agregados

    const secciones = validateSecciones(rawItem.secciones)
    if (!secciones.ok) return secciones

    const ingredientesQuitados = validateStringList(rawItem.ingredientesQuitados, "ingredientesQuitados")
    if (!ingredientesQuitados.ok) return ingredientesQuitados

    items.push({
      productoId: productoId.value,
      cantidad: rawItem.cantidad,
      agregados: agregados.value,
      secciones: secciones.value,
      ingredientesQuitados: ingredientesQuitados.value,
      talle: readOptionalText(rawItem.talle) || "",
      color: readOptionalText(rawItem.color) || "",
    })
  }

  if (
    payload.metodoEntrega !== "retiro" &&
    payload.metodoEntrega !== "domicilio" &&
    payload.metodoEntrega !== "mesa"
  ) {
    return fail("Metodo de entrega invalido")
  }
  const metodoEntrega: MetodoEntrega = payload.metodoEntrega

  if (payload.metodoPago !== "efectivo" && payload.metodoPago !== "transferencia") {
    return fail("Metodo de pago invalido")
  }
  const metodoPago: MetodoPago = payload.metodoPago

  const lat = readNullableCoordinate(payload.lat, "lat")
  if (!lat.ok) return lat
  const lng = readNullableCoordinate(payload.lng, "lng")
  if (!lng.ok) return lng
  const validLat = validateLatitude(lat.value)
  if (!validLat.ok) return validLat
  const validLng = validateLongitude(lng.value)
  if (!validLng.ok) return validLng

  const mesaNumero = readOptionalPositiveInteger(payload.mesaNumero, "mesaNumero")
  if (!mesaNumero.ok) return mesaNumero

  return ok({
    negocioId: negocioId.value,
    items,
    metodoEntrega,
    metodoPago,
    notas: readOptionalText(payload.notas),
    direccion: readOptionalText(payload.direccion),
    referencia: readOptionalText(payload.referencia),
    lat: validLat.value,
    lng: validLng.value,
    mesaId: readOptionalText(payload.mesaId),
    mesaNumero: mesaNumero.value,
    empleadoCodigo: readOptionalText(payload.empleadoCodigo),
    fingerprint: readOptionalText(payload.fingerprint),
  })
}

function calculateEffectiveProductPrice(product: {
  precio: number
  descuentoActivo: boolean
  tipoDescuento: string
  valorDescuento: number
}): number {
  let unitPrice = product.precio

  if (product.descuentoActivo && product.valorDescuento > 0) {
    if (product.tipoDescuento === "porcentaje") {
      unitPrice = unitPrice * (1 - product.valorDescuento / 100)
    } else {
      unitPrice = Math.max(0, unitPrice - product.valorDescuento)
    }
  }

  return roundMoney(unitPrice)
}

function normalizeSharedOptionConfigs(raw: unknown): SharedOptionConfig[] {
  const parsed = safeParseJSON<unknown[]>(raw, [])
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item): SharedOptionConfig | null => {
      if (typeof item === "string") {
        const id = item.trim()
        return id ? { id, obligatorio: false, maximo: 0 } : null
      }
      if (!isPlainObject(item) || typeof item.id !== "string") return null
      const id = item.id.trim()
      if (!id) return null
      return {
        id,
        obligatorio: item.obligatorio === true,
        maximo:
          typeof item.maximo === "number" && Number.isInteger(item.maximo) && item.maximo > 0
            ? item.maximo
            : 0,
      }
    })
    .filter((item): item is SharedOptionConfig => Boolean(item))
}

function normalizeProductSections(raw: unknown): ProductSection[] {
  const parsed = safeParseJSON<unknown[]>(raw, [])
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item): ProductSection | null => {
      if (!isPlainObject(item) || typeof item.nombre !== "string") return null
      const nombre = item.nombre.trim()
      const opciones = Array.isArray(item.opciones)
        ? item.opciones
            .filter((option): option is string => typeof option === "string" && option.trim().length > 0)
            .map((option) => option.trim())
        : []
      if (!nombre) return null
      return {
        nombre,
        opciones,
        obligatorio: item.obligatorio === true,
        maximo:
          typeof item.maximo === "number" && Number.isInteger(item.maximo) && item.maximo > 0
            ? item.maximo
            : 0,
      }
    })
    .filter((item): item is ProductSection => Boolean(item))
}

function normalizeSharedOption(raw: { id: string; opciones: string }): SharedOption {
  const parsed = safeParseJSON<unknown[]>(raw.opciones, [])
  const opciones = Array.isArray(parsed)
    ? parsed
        .map((option): { nombre: string; precio: number } | null => {
          if (!isPlainObject(option) || typeof option.nombre !== "string") return null
          const nombre = option.nombre.trim()
          const precio =
            typeof option.precio === "number" && Number.isFinite(option.precio)
              ? roundMoney(option.precio)
              : 0
          return nombre ? { nombre, precio } : null
        })
        .filter((option): option is { nombre: string; precio: number } => Boolean(option))
    : []

  return { id: raw.id, opciones }
}

function validateProductSections(
  selected: Record<string, SectionSelection>,
  sections: ProductSection[]
): ValidationResult<Record<string, SectionSelection>> {
  const sectionMap = new Map(sections.map((section) => [section.nombre, section]))
  const normalized: Record<string, SectionSelection> = {}

  for (const [sectionName, selection] of Object.entries(selected)) {
    const section = sectionMap.get(sectionName)
    if (!section) return fail("Opcion de producto invalida")

    if (typeof selection === "string") {
      if (!section.opciones.includes(selection)) return fail("Opcion de producto invalida")
      normalized[sectionName] = selection
      continue
    }

    const validSelection: Record<string, number> = {}
    let totalSelected = 0
    for (const [optionName, quantity] of Object.entries(selection)) {
      if (!section.opciones.includes(optionName)) return fail("Opcion de producto invalida")
      totalSelected += quantity
      validSelection[optionName] = quantity
    }
    if (section.maximo > 0 && totalSelected > section.maximo) {
      return fail("Seleccion de seccion excede el maximo permitido")
    }
    if (totalSelected > 0) normalized[sectionName] = validSelection
  }

  for (const section of sections) {
    if (!section.obligatorio) continue
    const selection = normalized[section.nombre]
    const selectedCount =
      typeof selection === "string"
        ? selection ? 1 : 0
        : selection
          ? Object.values(selection).reduce((sum, quantity) => sum + quantity, 0)
          : 0
    if (selectedCount < 1) return fail("Falta seleccionar una opcion obligatoria")
  }

  return ok(normalized)
}

function splitSharedOptionId(value: string): { sharedId: string; optionName: string } | null {
  const separatorIndex = value.indexOf("::")
  if (separatorIndex <= 0 || separatorIndex === value.length - 2) return null
  return {
    sharedId: value.slice(0, separatorIndex),
    optionName: value.slice(separatorIndex + 2),
  }
}

// Point-in-polygon algorithm (ray casting) — same as delivery-zonas route
function pointInPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng
    const xj = polygon[j].lat, yj = polygon[j].lng
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export async function POST(request: NextRequest) {
  // Concurrency protection: compute lock key before try block so it's accessible in finally
  const ip = getClientIp(request)
  const rlKey = request.cookies.get(SESSION_COOKIE_NAME)?.value || ip
  const orderLockKey = `order:${rlKey}`

  try {
    // Rate limit orders
    const rl = checkRateLimit("order", rlKey)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Estás haciendo muchos pedidos. Esperá un momento.")
    }

    // Concurrency protection: prevent double orders from the same user/session
    if (!acquireLock(orderLockKey)) {
      return NextResponse.json(
        { error: "Ya hay un pedido en proceso. Esperá un momento." },
        { status: 409 }
      )
    }

    const rawPayload = await request.json().catch(() => null)
    const payloadResult = validatePedidoPayload(rawPayload)
    if (!payloadResult.ok) {
      return NextResponse.json({ error: payloadResult.error }, { status: 400 })
    }

    const pedidoInput = payloadResult.value
    const requestedNegocioId = pedidoInput.negocioId

    // ============================================
    // SERVER-SIDE PRICE VALIDATION (anti-manipulation)
    // ============================================
    const productoIds = [...new Set(pedidoInput.items.map((item) => item.productoId))]
    const dbProductos = await db.producto.findMany({
      where: { id: { in: productoIds } },
      include: {
        agregados: {
          include: {
            agregado: {
              select: { id: true, nombre: true, precio: true, negocioId: true },
            },
          },
        },
        ingredientes: {
          include: {
            ingrediente: {
              select: { id: true, nombre: true, negocioId: true },
            },
          },
        },
      },
    })

    const productoMap = new Map(dbProductos.map((producto) => [producto.id, producto]))
    for (const productoId of productoIds) {
      if (!productoMap.has(productoId)) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 400 })
      }
    }

    const negocioId = dbProductos[0]?.negocioId
    if (!negocioId || requestedNegocioId !== negocioId) {
      return NextResponse.json({ error: "Negocio del pedido invalido" }, { status: 400 })
    }

    if (dbProductos.some((producto) => producto.negocioId !== negocioId)) {
      return NextResponse.json(
        { error: "Todos los productos deben pertenecer al mismo negocio" },
        { status: 400 }
      )
    }

    const negocio = await db.negocio.findUnique({
      where: { id: negocioId },
    })

    if (!negocio || !negocio.aprobado || negocio.suspendido) {
      return NextResponse.json(
        { error: "Negocio no disponible" },
        { status: 400 }
      )
    }

    const allSharedOptionIds = [
      ...new Set(
        dbProductos.flatMap((producto) =>
          normalizeSharedOptionConfigs(producto.opcionesCompartidasIds).map((config) => config.id)
        )
      ),
    ]
    const sharedOptions = allSharedOptionIds.length > 0
      ? await db.opcionesCompartidas.findMany({
          where: { id: { in: allSharedOptionIds }, negocioId },
          select: { id: true, opciones: true },
        })
      : []
    const sharedOptionMap = new Map(
      sharedOptions.map((sharedOption) => [sharedOption.id, normalizeSharedOption(sharedOption)])
    )

    let serverTotalProductos = 0
    const validatedItems: ValidatedPedidoItem[] = []

    for (const item of pedidoInput.items) {
      const producto = productoMap.get(item.productoId)
      if (!producto || producto.eliminado || !producto.stock) {
        return NextResponse.json({ error: "Producto no disponible" }, { status: 400 })
      }

      const productSections = normalizeProductSections(producto.secciones)
      const validSections = validateProductSections(item.secciones, productSections)
      if (!validSections.ok) {
        return NextResponse.json({ error: validSections.error }, { status: 400 })
      }

      const ingredientesDisponibles = new Set(
        producto.ingredientes.map((pi) => pi.ingrediente.nombre)
      )
      for (const ingrediente of item.ingredientesQuitados) {
        if (!ingredientesDisponibles.has(ingrediente)) {
          return NextResponse.json({ error: "Ingrediente invalido" }, { status: 400 })
        }
      }

      const talles = safeParseJSON<string[]>(producto.talles, [])
      if (item.talle && (!Array.isArray(talles) || !talles.includes(item.talle))) {
        return NextResponse.json({ error: "Talle invalido" }, { status: 400 })
      }

      const colores = safeParseJSON<string[]>(producto.colores, [])
      if (item.color && (!Array.isArray(colores) || !colores.includes(item.color))) {
        return NextResponse.json({ error: "Color invalido" }, { status: 400 })
      }

      const allowedAgregados = new Map(
        producto.agregados.map((pa) => [pa.agregado.id, pa.agregado])
      )
      const sharedConfigs = normalizeSharedOptionConfigs(producto.opcionesCompartidasIds)
      const allowedSharedConfigs = new Map(sharedConfigs.map((config) => [config.id, config]))
      const selectedSharedCounts = new Map<string, number>()

      const unitPrice = calculateEffectiveProductPrice(producto)

      let agregadosTotal = 0
      const validatedAgregados: Array<{ id: string; nombre: string; precio: number; tipo: string }> = []
      for (const agregado of item.agregados) {
        if (agregado.id.includes("::")) {
          const parsedShared = splitSharedOptionId(agregado.id)
          if (!parsedShared) {
            return NextResponse.json({ error: "Opcion compartida invalida" }, { status: 400 })
          }

          const sharedConfig = allowedSharedConfigs.get(parsedShared.sharedId)
          const sharedOption = sharedOptionMap.get(parsedShared.sharedId)
          if (!sharedConfig || !sharedOption) {
            return NextResponse.json({ error: "Opcion compartida invalida" }, { status: 400 })
          }

          const selectedOption = sharedOption.opciones.find(
            (option) => option.nombre === parsedShared.optionName
          )
          if (!selectedOption) {
            return NextResponse.json({ error: "Opcion compartida invalida" }, { status: 400 })
          }

          const selectedCount = (selectedSharedCounts.get(parsedShared.sharedId) || 0) + 1
          selectedSharedCounts.set(parsedShared.sharedId, selectedCount)
          const maxSelected = sharedConfig.maximo > 0 ? sharedConfig.maximo : 1
          if (selectedCount > maxSelected) {
            return NextResponse.json({ error: "Seleccion de opcion excede el maximo" }, { status: 400 })
          }

          agregadosTotal += selectedOption.precio
          validatedAgregados.push({
            id: `${parsedShared.sharedId}::${selectedOption.nombre}`,
            nombre: selectedOption.nombre,
            precio: selectedOption.precio,
            tipo: "opcion_compartida",
          })
          continue
        }

        const dbAgregado = allowedAgregados.get(agregado.id)
        if (!dbAgregado) {
          return NextResponse.json({ error: "Agregado invalido" }, { status: 400 })
        }

        const precioAgregado = roundMoney(dbAgregado.precio)
        agregadosTotal += precioAgregado
        validatedAgregados.push({
          id: dbAgregado.id,
          nombre: dbAgregado.nombre,
          precio: precioAgregado,
          tipo: "agregado",
        })
      }

      for (const config of sharedConfigs) {
        const count = selectedSharedCounts.get(config.id) || 0
        if (config.obligatorio && count < 1) {
          return NextResponse.json({ error: "Falta seleccionar una opcion obligatoria" }, { status: 400 })
        }
      }

      serverTotalProductos += (unitPrice + agregadosTotal) * item.cantidad
      validatedItems.push({
        productoId: producto.id,
        nombre: producto.nombre,
        precio: unitPrice,
        cantidad: item.cantidad,
        agregados: validatedAgregados,
        secciones: validSections.value,
        ingredientesQuitados: item.ingredientesQuitados,
        talle: item.talle,
        color: item.color,
      })
    }

    serverTotalProductos = roundMoney(serverTotalProductos)


    // Check if business is open
    if (!isNegocioOpen(negocio.horarios, negocio.horarioMode, negocio.abiertoManual)) {
      return NextResponse.json(
        { error: "Este negocio está cerrado y no recibe pedidos en este momento" },
        { status: 400 }
      )
    }

    // Get session to find cliente
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    let clienteId: string | null = null
    let clienteNombre = "Invitado"
    let clienteTelefono = ""
    let clienteUpdateData: { ultimoIp: string; dispositivoFingerprint?: string } | null = null

    if (token) {
      const session = await db.sesion.findUnique({
        where: { token },
      })
      if (session && session.userType === "cliente") {
        const cliente = await db.cliente.findUnique({
          where: { id: session.userId },
        })
        if (cliente) {
          // Check if customer is blocked
          if (cliente.bloqueado) {
            return NextResponse.json(
              { error: "Tu cuenta ha sido bloqueada. Contactá a soporte para más información." },
              { status: 403 }
            )
          }
          clienteId = cliente.id
          clienteNombre = cliente.nombre
          clienteTelefono = cliente.telefono

          clienteUpdateData = {
            ultimoIp: getClientIp(request),
            ...(pedidoInput.fingerprint ? { dispositivoFingerprint: pedidoInput.fingerprint } : {}),
          }
        }
      }
    }

    // Require authentication for non-mesa orders
    if (pedidoInput.metodoEntrega !== "mesa" && !clienteId) {
      return NextResponse.json(
        { error: "Debés iniciar sesión para hacer un pedido" },
        { status: 401 }
      )
    }

    // Resolve mesa from numero if mesa order
    let mesaId: string | null = pedidoInput.mesaId
    let mesaNumero: number | null = pedidoInput.mesaNumero
    const isMesaOrder = pedidoInput.metodoEntrega === "mesa"

    // Resolve empleado from codigo if provided (or auto from mesa)
    let empleadoId: string | null = null
    let empleadoNombre: string | null = null

    if (isMesaOrder) {
      // mesaNumero or mesaId is required for mesa orders
      if (!mesaNumero && !mesaId) {
        return NextResponse.json(
          { error: "Mesa es requerida para pedidos en salón" },
          { status: 400 }
        )
      }

      // Look up the mesa using Prisma ORM (avoids PostgreSQL case-sensitivity issues with $queryRaw)
      let mesaRow: { id: string; numero: number; activa: boolean; empleadoId: string | null } | null = null

      if (mesaId) {
        // Direct lookup by ID
        const found = await db.mesa.findFirst({
          where: { id: mesaId, negocioId },
          select: { id: true, numero: true, activa: true, empleadoId: true },
        })
        if (found) mesaRow = found
      }

      if (!mesaRow && mesaNumero) {
        // Fallback: look up by negocioId + numero
        const found = await db.mesa.findFirst({
          where: { negocioId, numero: mesaNumero },
          select: { id: true, numero: true, activa: true, empleadoId: true },
        })
        if (found) mesaRow = found
      }

      if (!mesaRow) {
        return NextResponse.json(
          { error: "Mesa no encontrada" },
          { status: 400 }
        )
      }

      if (!mesaRow.activa) {
        return NextResponse.json(
          { error: "Mesa inactiva" },
          { status: 400 }
        )
      }

      mesaId = mesaRow.id
      mesaNumero = mesaRow.numero

      // Auto-resolve mozo from mesa assignment (always — this is the primary source of truth)
      const mesaEmpleadoId = mesaRow.empleadoId
      if (mesaEmpleadoId) {
        const mesaEmpleado = await db.empleado.findFirst({
          where: { id: mesaEmpleadoId, negocioId, activo: true },
          select: { id: true, nombre: true },
        })
        if (mesaEmpleado) {
          empleadoId = mesaEmpleado.id
          empleadoNombre = mesaEmpleado.nombre
        }
      }
    }

    // Resolve empleado from codigo if provided (overrides mesa auto-assignment)
    // This handles the mozo link flow where the mozo explicitly opened the order
    if (pedidoInput.empleadoCodigo && isMesaOrder) {
      const empleado = await db.empleado.findFirst({
        where: { codigo: pedidoInput.empleadoCodigo, negocioId, activo: true },
        select: { id: true, nombre: true },
      })
      if (empleado) {
        empleadoId = empleado.id
        empleadoNombre = empleado.nombre
      }
    }

    // Determine delivery-specific fields
    let finalPrecioDelivery = 0

    // Server-side delivery zone validation for delivery orders
    if (pedidoInput.metodoEntrega === "domicilio") {
      if (!negocio.ofreceDelivery) {
        return NextResponse.json(
          { error: "El negocio no ofrece delivery" },
          { status: 400 }
        )
      }
      if (!pedidoInput.direccion || pedidoInput.lat === null || pedidoInput.lng === null) {
        return NextResponse.json(
          { error: "Direccion y ubicacion son requeridas para delivery" },
          { status: 400 }
        )
      }

      if (negocio.zonaDeliveryActiva && negocio.deliveryMode === "expert") {
        // Expert mode: must be within a zone
        const zonas = safeParseJSON<
          Array<{ precio?: number; nombre?: string; puntos?: Array<{ lat: number; lng: number }> }>
        >(negocio.zonasDelivery, [])
        let foundZone: { precio?: number; nombre?: string } | null = null
        for (const zona of zonas) {
          if (
            Array.isArray(zona.puntos) &&
            zona.puntos.length >= 3 &&
            pointInPolygon(pedidoInput.lat, pedidoInput.lng, zona.puntos)
          ) {
            foundZone = zona
            break
          }
        }
        if (!foundZone && zonas.length > 0) {
          return NextResponse.json(
            { error: "Tu ubicación está fuera de la zona de delivery" },
            { status: 400 }
          )
        }
        // Use the server-validated zone price (don't trust client)
        finalPrecioDelivery = roundMoney(
          foundZone?.precio ?? negocio.precioDeliveryDefault ?? negocio.precioDelivery ?? 0
        )
      } else {
        // Simple mode: use the negocio's flat price
        finalPrecioDelivery = roundMoney(negocio.precioDelivery ?? 0)
      }
    }
    const finalDireccion = isMesaOrder ? null : pedidoInput.direccion
    const finalReferencia = isMesaOrder ? null : pedidoInput.referencia
    const finalLat = isMesaOrder ? null : pedidoInput.lat
    const finalLng = isMesaOrder ? null : pedidoInput.lng
    const serverTarifaServicio = isMesaOrder && !MESA_SERVICE_FEE_ENABLED ? 0 : SERVICE_FEE_FIXED
    const finalTotal = roundMoney(serverTotalProductos + finalPrecioDelivery + serverTarifaServicio)

    const pedido = await db.$transaction(async (tx) => {
      const negocioDebt = await tx.negocio.findUnique({
        where: { id: negocioId },
        select: { deudaTarifa: true, limiteDeuda: true },
      })
      if (!negocioDebt) {
        throw new DebtLimitExceededError()
      }

      const limiteDeuda = negocioDebt.limiteDeuda ?? 10000
      if (negocioDebt.deudaTarifa + serverTarifaServicio > limiteDeuda) {
        throw new DebtLimitExceededError()
      }

      if (serverTarifaServicio > 0) {
        const debtUpdate = await tx.negocio.updateMany({
          where: {
            id: negocioId,
            deudaTarifa: { lte: limiteDeuda - serverTarifaServicio },
          },
          data: {
            deudaTarifa: { increment: serverTarifaServicio },
          },
        })
        if (debtUpdate.count !== 1) {
          throw new DebtLimitExceededError()
        }
      }

      if (clienteId && clienteUpdateData) {
        await tx.cliente.update({
          where: { id: clienteId },
          data: clienteUpdateData,
        })
      }

      const created = await tx.pedido.create({
        data: {
          negocioId,
          negocioSlug: negocio.slug,
          negocioNombre: negocio.nombre,
          clienteId,
          clienteNombre,
          clienteTelefono,
          total: finalTotal,
          totalProductos: serverTotalProductos,
          tarifaServicio: serverTarifaServicio,
          precioDelivery: finalPrecioDelivery,
          metodoEntrega: pedidoInput.metodoEntrega,
          metodoPago: pedidoInput.metodoPago,
          notas: pedidoInput.notas,
          direccion: finalDireccion,
          referencia: finalReferencia,
          lat: finalLat,
          lng: finalLng,
          negocioLat: negocio.lat,
          negocioLng: negocio.lng,
          mesaId: isMesaOrder ? mesaId : null,
          mesaNumero: isMesaOrder ? mesaNumero : null,
          empleadoId,
          empleadoNombre,
          estado: "recibido",
          items: {
            create: validatedItems.map((item) => ({
              productoId: item.productoId,
              nombre: item.nombre,
              precio: item.precio,
              cantidad: item.cantidad,
              agregados: JSON.stringify(item.agregados),
              secciones: JSON.stringify(item.secciones),
              ingredientes: JSON.stringify([]),
              ingredientesQuitados: JSON.stringify(item.ingredientesQuitados),
              seccionesPrecios: JSON.stringify({}),
              talle: item.talle,
              color: item.color,
            })),
          },
        },
        include: {
          items: true,
        },
      })

      return created
    })

    // Send push notification to the business about the new order
    try {
      const negocioWithPush = await db.negocio.findUnique({
        where: { id: negocioId },
        select: { pushSubscription: true },
      })
      const payload = newOrderNotification(pedido.id, clienteNombre, finalTotal)
      await createNotification({
        userId: negocioId,
        userType: "negocio",
        tipo: "new_order",
        titulo: payload.title,
        cuerpo: payload.body,
        pedidoId: pedido.id,
        negocioId: negocioId,
        pushSubscription: negocioWithPush?.pushSubscription ?? null,
        pushPayload: payload,
        cleanupExpired: { model: "negocio", id: negocioId },
      })
    } catch (pushError) {
      console.error("[Push] Failed to send new order notification:", pushError)
    }

    // Send push notification to the shared-display PWA that handles this order.
    //  - Mesa orders      → salon PWA     (/s/[token])   via Negocio.pushSubscriptionSalon
    //  - Retiro/domicilio → empleados PWA (/e/[token])   via Negocio.pushSubscriptionEmpleados
    // Both subscriptions live on the Negocio model (separate fields) so multiple
    // shared devices can each be notified without wiping the owner's subscription.
    try {
      const sharedPush = await db.negocio.findUnique({
        where: { id: negocioId },
        select: { pushSubscriptionSalon: true, pushSubscriptionEmpleados: true },
      })

      if (isMesaOrder && mesaNumero) {
        // ── Salon PWA: mesa order ──
        if (sharedPush?.pushSubscriptionSalon) {
          const salonPayload = salonNewOrderNotification(
            pedido.id,
            mesaNumero,
            clienteNombre,
            finalTotal,
            empleadoNombre
          )
          await createNotification({
            userId: negocioId,
            userType: "negocio", // stored on Negocio row; salon PWA reads via token
            tipo: "salon_new_order",
            titulo: salonPayload.title,
            cuerpo: salonPayload.body,
            pedidoId: pedido.id,
            negocioId: negocioId,
            datos: { mesaNumero },
            pushSubscription: sharedPush.pushSubscriptionSalon,
            pushPayload: salonPayload,
            cleanupExpired: { model: "negocio", id: negocioId, field: "pushSubscriptionSalon" },
          })
        }
      } else {
        // ── Empleados PWA: retiro / domicilio order ──
        if (sharedPush?.pushSubscriptionEmpleados) {
          const empleadosPayload = empleadosNewOrderNotification(
            pedido.id,
            clienteNombre,
            finalTotal,
            pedidoInput.metodoEntrega
          )
          await createNotification({
            userId: negocioId,
            userType: "negocio", // stored on Negocio row; empleados PWA reads via token
            tipo: "empleados_new_order",
            titulo: empleadosPayload.title,
            cuerpo: empleadosPayload.body,
            pedidoId: pedido.id,
            negocioId: negocioId,
            pushSubscription: sharedPush.pushSubscriptionEmpleados,
            pushPayload: empleadosPayload,
            cleanupExpired: { model: "negocio", id: negocioId, field: "pushSubscriptionEmpleados" },
          })
        }
      }
    } catch (sharedPushError) {
      console.error("[Push] Failed to send shared-display notification:", sharedPushError)
    }

    return NextResponse.json(pedido, { status: 201 })
  } catch (error) {
    if (error instanceof DebtLimitExceededError) {
      return NextResponse.json(
        { error: "Este negocio no estÃ¡ recibiendo pedidos temporalmente" },
        { status: 400 }
      )
    }
    console.error("Error creating pedido:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  } finally {
    // Always release the lock, even on error
    releaseLock(orderLockKey)
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const session = await db.sesion.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryNegocioId = searchParams.get("negocioId")
    const queryClienteId = searchParams.get("clienteId")

    const where: Record<string, unknown> = {}

    // Security: only allow users to see their own data
    if (session.userType === "cliente") {
      where.clienteId = session.userId
    } else if (session.userType === "negocio") {
      where.negocioId = session.userId
    } else if (session.userType === "repartidor") {
      // Repartidor can only see assigned orders from their associated negocios
      const asociaciones = await db.repartidorNegocio.findMany({
        where: { repartidorId: session.userId },
        select: { negocioId: true },
      })
      const negocioIds = asociaciones.map(a => a.negocioId)
      if (queryNegocioId && !negocioIds.includes(queryNegocioId)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 })
      }
      where.negocioId = queryNegocioId || { in: negocioIds }
      where.repartidorId = session.userId
    } else if (session.userType === "superadmin") {
      // Superadmin can filter by any negocioId or clienteId
      if (queryNegocioId) where.negocioId = queryNegocioId
      if (queryClienteId) where.clienteId = queryClienteId
    }

    const pedidos = await db.pedido.findMany({
      where,
      include: { items: true },
      orderBy: { fecha: "desc" },
      take: 50,
    })

    return NextResponse.json(pedidos)
  } catch (error) {
    console.error("Error fetching pedidos:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
