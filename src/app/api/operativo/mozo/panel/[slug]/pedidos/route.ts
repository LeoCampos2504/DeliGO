import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { createHash } from "node:crypto"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoMozoForSlug } from "@/lib/operativo-mozo"
import { createNotification, newOrderNotification, salonNewOrderNotification } from "@/lib/push"
import { getClientIp } from "@/lib/rate-limit"
import { isNegocioOpen } from "@/lib/utils"

const MAX_ITEMS_PER_ORDER = 50
const MAX_QUANTITY_PER_ITEM = 99
const MAX_AGREGADOS_PER_ITEM = 40
const MAX_SECCIONES_PER_ITEM = 30
const MAX_OPTION_QUANTITY = 99
const MAX_TEXT_LENGTH = 500
const SERIALIZATION_RETRY_LIMIT = 3
const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SectionSelection = string | Record<string, number>

interface IncomingPedidoItem {
  productoId: string
  cantidad: number
  agregados: Array<{ id: string }>
  secciones: Record<string, SectionSelection>
  ingredientesQuitados: string[]
  talle: string
  color: string
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

interface ManualOrderPedido {
  id: string
  negocioId: string
  metodoEntrega: string
  estado: string
  total: number
  totalProductos: number
  mesaId: string | null
  mesaNumero: number | null
  empleadoId: string | null
  empleadoNombre: string | null
  idempotencyFingerprint: string | null
  items: Array<{
    id: string
    nombre: string
    cantidad: number
    precio: number
  }>
}

type ManualOrderResult =
  | { status: "created"; pedido: ManualOrderPedido }
  | { status: "idempotent"; pedido: ManualOrderPedido }

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value }
}

function fail<T = never>(error: string): ValidationResult<T> {
  return { ok: false, error }
}

function authErrorResponse(auth: Extract<Awaited<ReturnType<typeof resolveOperativoMozoForSlug>>, { ok: false }>) {
  const response = NextResponse.json(
    {
      ok: false,
      estado: auth.state,
      error: auth.status === 401 ? "No autenticado" : "Acceso no disponible",
    },
    { status: auth.status }
  )
  if (auth.clearSession) {
    response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
  }
  return noStore(response)
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

function readOptionalText(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, MAX_TEXT_LENGTH)
}

function readIdempotencyKey(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") return fail("Clave de idempotencia requerida")
  const normalized = value.trim().toLowerCase()
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    return fail("Clave de idempotencia invalida")
  }
  return ok(normalized)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isPlainObject(value)) return value

  const result: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    result[key] = canonicalize(value[key])
  }
  return result
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function normalizeSectionSelectionForFingerprint(selection: SectionSelection): SectionSelection {
  if (typeof selection === "string") return selection
  return Object.fromEntries(
    Object.entries(selection)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([option, quantity]) => [option, quantity])
  )
}

function createManualOrderFingerprint(params: {
  negocioId: string
  empleadoId: string
  mesaId: string
  metodoPago: string
  notas: string | null
  items: IncomingPedidoItem[]
}): string {
  const items = params.items
    .map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      agregados: item.agregados.map((agregado) => agregado.id).sort(),
      secciones: Object.fromEntries(
        Object.entries(item.secciones)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([section, selection]) => [
            section,
            normalizeSectionSelectionForFingerprint(selection),
          ])
      ),
      ingredientesQuitados: item.ingredientesQuitados.slice().sort(),
      talle: item.talle,
      color: item.color,
    }))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)))

  const payload = {
    negocioId: params.negocioId,
    empleadoId: params.empleadoId,
    mesaId: params.mesaId,
    metodoPago: params.metodoPago,
    notas: params.notas || "",
    items,
  }

  return createHash("sha256").update(stableStringify(payload)).digest("hex")
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

function validateAgregados(value: unknown): ValidationResult<Array<{ id: string }>> {
  if (value === undefined || value === null) return ok([])
  if (!Array.isArray(value)) return fail("agregados debe ser una lista")
  if (value.length > MAX_AGREGADOS_PER_ITEM) return fail("Demasiados agregados en un item")

  const seen = new Set<string>()
  const result: Array<{ id: string }> = []
  for (const raw of value) {
    if (!isPlainObject(raw) || typeof raw.id !== "string") return fail("Agregado invalido")
    const id = raw.id.trim()
    if (!id) return fail("Agregado invalido")
    if (!seen.has(id)) {
      seen.add(id)
      result.push({ id })
    }
  }
  return ok(result)
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

function validateIncomingItems(value: unknown): ValidationResult<IncomingPedidoItem[]> {
  if (!Array.isArray(value) || value.length === 0) return fail("Debe contener al menos un producto")
  if (value.length > MAX_ITEMS_PER_ORDER) return fail("El pedido tiene demasiados items")

  const result: IncomingPedidoItem[] = []
  for (const rawItem of value) {
    if (!isPlainObject(rawItem)) return fail("Item invalido")
    if (typeof rawItem.productoId !== "string" || !rawItem.productoId.trim()) {
      return fail("productoId es requerido")
    }
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

    result.push({
      productoId: rawItem.productoId.trim(),
      cantidad: rawItem.cantidad,
      agregados: agregados.value,
      secciones: secciones.value,
      ingredientesQuitados: ingredientesQuitados.value,
      talle: readOptionalText(rawItem.talle),
      color: readOptionalText(rawItem.color),
    })
  }

  return ok(result)
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

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

function isUniqueConstraintConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

function isSafeIdempotentMatch(params: {
  pedido: ManualOrderPedido | null
  negocioId: string
  fingerprint: string
  mesaId: string
  empleadoId: string
}): params is {
  pedido: ManualOrderPedido
  negocioId: string
  fingerprint: string
  mesaId: string
  empleadoId: string
} {
  return Boolean(
    params.pedido &&
      params.pedido.negocioId === params.negocioId &&
      params.pedido.metodoEntrega === "mesa" &&
      params.pedido.idempotencyFingerprint === params.fingerprint &&
      params.pedido.mesaId === params.mesaId &&
      params.pedido.empleadoId === params.empleadoId
  )
}

function buildPedidoResponse(result: ManualOrderResult) {
  return {
    ok: true,
    idempotent: result.status === "idempotent",
    pedido: {
      id: result.pedido.id,
      estado: result.pedido.estado,
      total: result.pedido.total,
      totalProductos: result.pedido.totalProductos,
      mesaId: result.pedido.mesaId,
      mesaNumero: result.pedido.mesaNumero,
      items: result.pedido.items.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
      })),
    },
  }
}

async function findExistingIdempotentPedido(params: {
  negocioId: string
  idempotencyKey: string
  fingerprint: string
  mesaId: string
  empleadoId: string
}): Promise<ManualOrderResult> {
  const existing = await db.pedido.findFirst({
    where: {
      negocioId: params.negocioId,
      idempotencyKey: params.idempotencyKey,
      metodoEntrega: "mesa",
    },
    include: {
      items: true,
    },
  })

  if (!existing) {
    throw new Error("IDEMPOTENCY_CONFLICT")
  }

  if (
    existing.negocioId !== params.negocioId ||
    existing.metodoEntrega !== "mesa" ||
    existing.idempotencyFingerprint !== params.fingerprint ||
    existing.mesaId !== params.mesaId ||
    existing.empleadoId !== params.empleadoId
  ) {
    throw new Error("IDEMPOTENCY_CONFLICT")
  }

  return { status: "idempotent", pedido: existing }
}

async function sendManualOrderNotifications(params: {
  pedido: ManualOrderPedido
  negocioId: string
}) {
  const clienteNombre = `Mesa ${params.pedido.mesaNumero ?? ""}`.trim()
  const total = params.pedido.total

  try {
    const negocioWithPush = await db.negocio.findUnique({
      where: { id: params.negocioId },
      select: { pushSubscription: true },
    })
    const payload = newOrderNotification(params.pedido.id, clienteNombre, total)
    await createNotification({
      userId: params.negocioId,
      userType: "negocio",
      tipo: "new_order",
      titulo: payload.title,
      cuerpo: payload.body,
      pedidoId: params.pedido.id,
      negocioId: params.negocioId,
      pushSubscription: negocioWithPush?.pushSubscription ?? null,
      pushPayload: payload,
      cleanupExpired: { model: "negocio", id: params.negocioId },
    })
  } catch (pushError) {
    console.error("[OperativoPedidoManual] Failed business notification:", pushError)
  }

  try {
    const sharedPush = await db.negocio.findUnique({
      where: { id: params.negocioId },
      select: { pushSubscriptionSalon: true },
    })

    if (sharedPush?.pushSubscriptionSalon && params.pedido.mesaNumero) {
      const salonPayload = salonNewOrderNotification(
        params.pedido.id,
        params.pedido.mesaNumero,
        clienteNombre,
        total,
        params.pedido.empleadoNombre
      )
      await createNotification({
        userId: params.negocioId,
        userType: "negocio",
        tipo: "salon_new_order",
        titulo: salonPayload.title,
        cuerpo: salonPayload.body,
        pedidoId: params.pedido.id,
        negocioId: params.negocioId,
        datos: { mesaNumero: params.pedido.mesaNumero },
        pushSubscription: sharedPush.pushSubscriptionSalon,
        pushPayload: salonPayload,
        cleanupExpired: {
          model: "negocio",
          id: params.negocioId,
          field: "pushSubscriptionSalon",
        },
      })
    }
  } catch (sharedPushError) {
    console.error("[OperativoPedidoManual] Failed salon notification:", sharedPushError)
  }
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_LIMIT; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === SERIALIZATION_RETRY_LIMIT) {
        throw error
      }
    }
  }

  throw new Error("SERIALIZATION_RETRY_EXHAUSTED")
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoMozoForSlug(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const negocio = await db.negocio.findUnique({
      where: { id: auth.negocio.id },
      select: {
        rubro: true,
        categorias: true,
        aceptaTransferencia: true,
      },
    })

    if (!negocio) {
      return noStore(NextResponse.json({ error: "Acceso no disponible" }, { status: 403 }))
    }

    const productos = await db.producto.findMany({
      where: {
        negocioId: auth.negocio.id,
        eliminado: false,
        stock: true,
      },
      orderBy: [{ categoria: "asc" }, { orden: "asc" }, { nombre: "asc" }],
      include: {
        agregados: {
          include: {
            agregado: {
              select: {
                id: true,
                nombre: true,
                precio: true,
                categoria: true,
              },
            },
          },
        },
        ingredientes: {
          include: {
            ingrediente: {
              select: {
                id: true,
                nombre: true,
                categoria: true,
              },
            },
          },
        },
      },
    })

    const sharedOptionIds = [
      ...new Set(
        productos.flatMap((producto) =>
          normalizeSharedOptionConfigs(producto.opcionesCompartidasIds).map((config) => config.id)
        )
      ),
    ]

    const sharedOptions = sharedOptionIds.length
      ? await db.opcionesCompartidas.findMany({
          where: {
            id: { in: sharedOptionIds },
            negocioId: auth.negocio.id,
          },
          select: {
            id: true,
            nombre: true,
            opciones: true,
            obligatorio: true,
            maximo: true,
          },
        })
      : []
    const sharedOptionsMap = new Map(sharedOptions.map((option) => [option.id, option]))

    return noStore(
      NextResponse.json({
        ok: true,
        negocio: {
          nombre: auth.negocio.nombre,
          slug: auth.negocio.slug,
          colorPrincipal: auth.negocio.colorPrincipal,
          rubro: negocio.rubro,
          aceptaTransferencia: negocio.aceptaTransferencia,
        },
        categorias: safeParseJSON<string[]>(negocio.categorias, []),
        productos: productos.map((producto) => {
          const sharedConfigs = normalizeSharedOptionConfigs(producto.opcionesCompartidasIds)
          const precioPromo = producto.descuentoActivo && producto.valorDescuento > 0
            ? calculateEffectiveProductPrice(producto)
            : null

          return {
            id: producto.id,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            categoria: producto.categoria,
            precio: producto.precio,
            precioPromo,
            imagenUrl: producto.imagenUrl,
            stock: producto.stock,
            secciones: normalizeProductSections(producto.secciones),
            talles: safeParseJSON<string[]>(producto.talles, []),
            colores: safeParseJSON<string[]>(producto.colores, []),
            agregados: producto.agregados.map((pa) => ({
              id: pa.agregado.id,
              nombre: pa.agregado.nombre,
              precio: pa.agregado.precio,
              categoria: pa.agregado.categoria,
            })),
            ingredientes: producto.ingredientes.map((pi) => ({
              id: pi.ingrediente.id,
              nombre: pi.ingrediente.nombre,
              categoria: pi.ingrediente.categoria,
            })),
            opcionesCompartidas: sharedConfigs
              .map((config) => {
                const option = sharedOptionsMap.get(config.id)
                if (!option) return null
                return {
                  id: option.id,
                  nombre: option.nombre,
                  opciones: safeParseJSON<Array<{ nombre: string; precio?: number }>>(option.opciones, []),
                  obligatorio: config.obligatorio || option.obligatorio,
                  maximo: config.maximo || option.maximo,
                }
              })
              .filter(Boolean),
          }
        }),
      })
    )
  } catch (error) {
    console.error("[OperativoPedidoManual] Error loading menu:", error)
    return noStore(
      NextResponse.json(
        { ok: false, error: "No se pudo cargar el menu" },
        { status: 500 }
      )
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoMozoForSlug(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const body = await req.json().catch(() => null)
    if (!isPlainObject(body)) {
      return noStore(NextResponse.json({ error: "Body invalido" }, { status: 400 }))
    }

    const idempotencyKeyResult = readIdempotencyKey(body.idempotencyKey)
    if (!idempotencyKeyResult.ok) {
      return noStore(
        NextResponse.json({ error: idempotencyKeyResult.error }, { status: 400 })
      )
    }
    const idempotencyKey = idempotencyKeyResult.value

    const mesaId = typeof body.mesaId === "string" ? body.mesaId.trim() : ""
    if (!mesaId) {
      return noStore(NextResponse.json({ error: "Mesa es requerida" }, { status: 400 }))
    }

    if (body.metodoPago !== "transferencia" && body.metodoPago !== "efectivo") {
      return noStore(NextResponse.json({ error: "Metodo de pago invalido" }, { status: 400 }))
    }
    const metodoPago = body.metodoPago
    const notas = readOptionalText(body.notas) || null
    const itemsResult = validateIncomingItems(body.items)
    if (!itemsResult.ok) {
      return noStore(NextResponse.json({ error: itemsResult.error }, { status: 400 }))
    }
    const incomingItems = itemsResult.value
    const idempotencyFingerprint = createManualOrderFingerprint({
      negocioId: auth.negocio.id,
      empleadoId: auth.empleado.id,
      mesaId,
      metodoPago,
      notas,
      items: incomingItems,
    })

    const ip = getClientIp(req)
    const pedidoResult = await withSerializableRetry(() =>
      db.$transaction<ManualOrderResult>(
        async (tx) => {
          const cuenta = await tx.cuentaOperativa.findFirst({
            where: {
              id: auth.cuenta.id,
              activo: true,
              eliminado: false,
            },
            select: { id: true },
          })
          if (!cuenta) throw new Error("OPERATIVO_UNAVAILABLE")

          const empleado = await tx.empleado.findFirst({
            where: {
              id: auth.empleado.id,
              negocioId: auth.negocio.id,
              cuentaOperativaId: auth.cuenta.id,
              rol: "mozo",
              activo: true,
              eliminado: false,
            },
            select: { id: true, nombre: true },
          })
          if (!empleado) throw new Error("OPERATIVO_UNAVAILABLE")

          const existingPedido = await tx.pedido.findFirst({
            where: {
              negocioId: auth.negocio.id,
              idempotencyKey,
              metodoEntrega: "mesa",
            },
            include: {
              items: true,
            },
          })

          if (existingPedido) {
            if (
              !isSafeIdempotentMatch({
                pedido: existingPedido,
                negocioId: auth.negocio.id,
                fingerprint: idempotencyFingerprint,
                mesaId,
                empleadoId: empleado.id,
              })
            ) {
              throw new Error("IDEMPOTENCY_CONFLICT")
            }

            return { status: "idempotent", pedido: existingPedido }
          }

          const mesaLock = await tx.mesa.updateMany({
            where: {
              id: mesaId,
              negocioId: auth.negocio.id,
              activa: true,
              empleadoId: empleado.id,
            },
            data: {
              empleadoId: empleado.id,
            },
          })

          if (mesaLock.count !== 1) throw new Error("MESA_NOT_OWNED")

          const mesa = await tx.mesa.findUnique({
            where: {
              id: mesaId,
            },
            select: {
              id: true,
              numero: true,
              empleadoId: true,
            },
          })

          if (!mesa) throw new Error("MESA_NOT_FOUND")
          if (mesa.empleadoId !== empleado.id) throw new Error("MESA_NOT_OWNED")

          const negocio = await tx.negocio.findFirst({
            where: {
              id: auth.negocio.id,
              aprobado: true,
              suspendido: false,
              salonActivo: true,
              empleadosActivos: true,
            },
            select: {
              id: true,
              slug: true,
              nombre: true,
              lat: true,
              lng: true,
              horarios: true,
              horarioMode: true,
              abiertoManual: true,
              aceptaTransferencia: true,
            },
          })

          if (!negocio) throw new Error("NEGOCIO_UNAVAILABLE")
          if (metodoPago === "transferencia" && !negocio.aceptaTransferencia) {
            throw new Error("METODO_PAGO_INVALIDO")
          }
          if (!isNegocioOpen(negocio.horarios, negocio.horarioMode, negocio.abiertoManual)) {
            throw new Error("NEGOCIO_CERRADO")
          }

          const productoIds = [...new Set(incomingItems.map((item) => item.productoId))]
          const dbProductos = await tx.producto.findMany({
            where: {
              id: { in: productoIds },
              negocioId: auth.negocio.id,
            },
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
            if (!productoMap.has(productoId)) throw new Error("PRODUCTO_NOT_FOUND")
          }

          if (dbProductos.some((producto) => producto.negocioId !== auth.negocio.id)) {
            throw new Error("PRODUCTO_NOT_FOUND")
          }

          const allSharedOptionIds = [
            ...new Set(
              dbProductos.flatMap((producto) =>
                normalizeSharedOptionConfigs(producto.opcionesCompartidasIds).map((config) => config.id)
              )
            ),
          ]
          const sharedOptions = allSharedOptionIds.length
            ? await tx.opcionesCompartidas.findMany({
                where: {
                  id: { in: allSharedOptionIds },
                  negocioId: auth.negocio.id,
                },
                select: { id: true, opciones: true },
              })
            : []
          const sharedOptionMap = new Map(
            sharedOptions.map((option) => [option.id, normalizeSharedOption(option)])
          )

          let serverTotalProductos = 0
          const validatedItems: ValidatedPedidoItem[] = []

          for (const item of incomingItems) {
            const producto = productoMap.get(item.productoId)
            if (!producto || producto.eliminado || !producto.stock) {
              throw new Error("PRODUCTO_UNAVAILABLE")
            }

            const productSections = normalizeProductSections(producto.secciones)
            const validSections = validateProductSections(item.secciones, productSections)
            if (!validSections.ok) throw new Error(validSections.error)

            const ingredientesDisponibles = new Set(
              producto.ingredientes.map((pi) => pi.ingrediente.nombre)
            )
            for (const ingrediente of item.ingredientesQuitados) {
              if (!ingredientesDisponibles.has(ingrediente)) {
                throw new Error("INGREDIENTE_INVALIDO")
              }
            }

            const talles = safeParseJSON<string[]>(producto.talles, [])
            if (item.talle && (!Array.isArray(talles) || !talles.includes(item.talle))) {
              throw new Error("TALLE_INVALIDO")
            }

            const colores = safeParseJSON<string[]>(producto.colores, [])
            if (item.color && (!Array.isArray(colores) || !colores.includes(item.color))) {
              throw new Error("COLOR_INVALIDO")
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
                if (!parsedShared) throw new Error("OPCION_COMPARTIDA_INVALIDA")

                const sharedConfig = allowedSharedConfigs.get(parsedShared.sharedId)
                const sharedOption = sharedOptionMap.get(parsedShared.sharedId)
                if (!sharedConfig || !sharedOption) throw new Error("OPCION_COMPARTIDA_INVALIDA")

                const selectedOption = sharedOption.opciones.find(
                  (option) => option.nombre === parsedShared.optionName
                )
                if (!selectedOption) throw new Error("OPCION_COMPARTIDA_INVALIDA")

                const selectedCount = (selectedSharedCounts.get(parsedShared.sharedId) || 0) + 1
                selectedSharedCounts.set(parsedShared.sharedId, selectedCount)
                const maxSelected = sharedConfig.maximo > 0 ? sharedConfig.maximo : 1
                if (selectedCount > maxSelected) throw new Error("OPCION_MAXIMO_EXCEDIDO")

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
              if (!dbAgregado) throw new Error("AGREGADO_INVALIDO")

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
                throw new Error("OPCION_OBLIGATORIA_FALTANTE")
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
          const finalTotal = serverTotalProductos

          const pedido = await tx.pedido.create({
            data: {
              negocioId: negocio.id,
              negocioSlug: negocio.slug,
              negocioNombre: negocio.nombre,
              clienteId: null,
              clienteNombre: `Mesa ${mesa.numero}`,
              clienteTelefono: "",
              total: finalTotal,
              totalProductos: serverTotalProductos,
              tarifaServicio: 0,
              precioDelivery: 0,
              metodoEntrega: "mesa",
              metodoPago,
              notas,
              direccion: null,
              referencia: null,
              lat: null,
              lng: null,
              negocioLat: negocio.lat,
              negocioLng: negocio.lng,
              mesaId: mesa.id,
              mesaNumero: mesa.numero,
              empleadoId: empleado.id,
              empleadoNombre: empleado.nombre,
              idempotencyKey,
              idempotencyFingerprint,
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

          await tx.auditLog.create({
            data: {
              userId: auth.cuenta.id,
              userType: "cuenta_operativa",
              accion: "mozo.pedido_manual_creado",
              recurso: "pedido",
              recursoId: pedido.id,
              detalle: JSON.stringify({
                negocioId: negocio.id,
                empleadoId: empleado.id,
                mesaId,
                pedidoId: pedido.id,
                cantidadItems: pedido.items.reduce((sum, item) => sum + item.cantidad, 0),
                total: pedido.total,
              }),
              ip,
            },
          })

          return { status: "created", pedido }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    ).catch(async (error) => {
      if (isUniqueConstraintConflict(error)) {
        return findExistingIdempotentPedido({
          negocioId: auth.negocio.id,
          idempotencyKey,
          fingerprint: idempotencyFingerprint,
          mesaId,
          empleadoId: auth.empleado.id,
        })
      }
      throw error
    })

    if (pedidoResult.status === "created") {
      await sendManualOrderNotifications({
        pedido: pedidoResult.pedido,
        negocioId: auth.negocio.id,
      })
    }

    return noStore(
      NextResponse.json(
        buildPedidoResponse(pedidoResult),
        { status: pedidoResult.status === "created" ? 201 : 200 }
      )
    )
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "IDEMPOTENCY_CONFLICT") {
        return noStore(
          NextResponse.json(
            { error: "No se pudo procesar esta operacion. Volve a iniciar el pedido." },
            { status: 409 }
          )
        )
      }
      if (error.message === "OPERATIVO_UNAVAILABLE") {
        return noStore(NextResponse.json({ error: "Acceso no disponible" }, { status: 403 }))
      }
      if (error.message === "MESA_NOT_FOUND") {
        return noStore(NextResponse.json({ error: "Mesa no disponible" }, { status: 404 }))
      }
      if (error.message === "MESA_NOT_OWNED") {
        return noStore(
          NextResponse.json(
            { error: "Solo podes cargar pedidos en mesas asignadas a tu cuenta" },
            { status: 403 }
          )
        )
      }
      if (error.message === "NEGOCIO_UNAVAILABLE") {
        return noStore(NextResponse.json({ error: "Acceso no disponible" }, { status: 403 }))
      }
      if (error.message === "NEGOCIO_CERRADO") {
        return noStore(
          NextResponse.json(
            { error: "Este negocio esta cerrado y no recibe pedidos en este momento" },
            { status: 400 }
          )
        )
      }
      if (error.message === "METODO_PAGO_INVALIDO") {
        return noStore(NextResponse.json({ error: "Metodo de pago invalido" }, { status: 400 }))
      }
      if (
        error.message.includes("PRODUCTO") ||
        error.message.includes("OPCION") ||
        error.message.includes("AGREGADO") ||
        error.message.includes("INGREDIENTE") ||
        error.message.includes("TALLE") ||
        error.message.includes("COLOR") ||
        error.message.includes("seccion")
      ) {
        return noStore(NextResponse.json({ error: "Producto no disponible" }, { status: 400 }))
      }
    }

    if (isSerializationConflict(error)) {
      return noStore(
        NextResponse.json(
          { error: "No se pudo crear el pedido. Intenta nuevamente." },
          { status: 409 }
        )
      )
    }

    console.error("[OperativoPedidoManual] Error creating order:", error)
    return noStore(
      NextResponse.json(
        { ok: false, error: "No se pudo crear el pedido" },
        { status: 500 }
      )
    )
  }
}
