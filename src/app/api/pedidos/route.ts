import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { SESSION_COOKIE_NAME, findSesionByToken, getOperationalAccountFromRequest } from "@/lib/auth"
import { resolveTerminalSession } from "@/lib/operaciones-terminal-auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { getOrCreateDeviceIdentity, setDeviceCookie } from "@/lib/device-identity"
import {
  applyDeviceEvasionAutoBlock,
  ensureClienteBloqueadoRecordForDevice,
  findForeignDeviceBlockMatch,
} from "@/lib/client-block-security"
import { createNotification, newOrderNotification, salonNewOrderNotification } from "@/lib/push"
import {
  notifySalonNewOrderForOperations,
  parseSubscriptionEndpoint,
} from "@/lib/salon-new-order-notification"
import {
  evaluateMesaGeofence,
  logMesaGeofenceObservation,
  MESA_GEOFENCE_MODE,
  type MesaGeofenceStatus,
} from "@/lib/mesa-geofence"
import {
  MESA_OCCUPANCY_COOKIE_NAME,
  resolveMesaOccupancyForOrder,
  heartbeatMesaOccupancyForOrder,
  logMesaOccupancyOrderEvent,
  openOrReuseMesaOccupancyForStaff,
  heartbeatOcupacionForStaffOrder,
  SalonDeshabilitadoError,
} from "@/lib/mesa-occupancy"
import { isNegocioOpen } from "@/lib/utils"
import { tieneSalonHabilitado } from "@/lib/negocio-salon-contract"
import { acquireLock, releaseLock } from "@/lib/concurrency"
import {
  buildIngredientesQuitadosSnapshot,
  type IngredienteQuitadoCanonico,
} from "@/lib/pedido-item-personalizacion"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// P0-C.2 — Geocerca obligatoria de mesa: mensajes/códigos de bloqueo
// ============================================
// Sanitizados a propósito: nunca distancia, coordenadas, radio ni precisión
// máxima. "inside" y "business_unconfigured" nunca aparecen acá (nunca
// bloquean).
const MESA_GEOFENCE_ERROR_BY_STATUS: Partial<Record<MesaGeofenceStatus, { message: string; code: string }>> = {
  outside: {
    message: "No pudimos confirmar que estés en el establecimiento.",
    code: "MESA_GEOFENCE_OUTSIDE",
  },
  missing: {
    message: "Necesitamos permiso de ubicación para aceptar pedidos desde esta mesa.",
    code: "MESA_GEOFENCE_MISSING",
  },
  inaccurate: {
    message: "No pudimos obtener una ubicación suficientemente precisa.",
    code: "MESA_GEOFENCE_INACCURATE",
  },
  invalid: {
    message: "No pudimos validar la ubicación del dispositivo.",
    code: "MESA_GEOFENCE_INVALID",
  },
}

// Identidad de personal autorizado que nunca se bloquea por geocerca de mesa
// — resuelta EXCLUSIVAMENTE desde cookies de sesión reales, nunca desde el
// body. `sessionUserType`/`sessionUserId` vienen de la sesión `deligo_session`
// ya resuelta más arriba en el handler (cliente/negocio/repartidor/superadmin);
// acá solo se usa el caso "negocio" (el dueño operando su propio negocio).
// Cuenta Operativa y Terminal Operativa usan cookies propias, completamente
// independientes de `deligo_session`.
async function isAuthenticatedStaffForNegocio(
  request: NextRequest,
  negocioId: string,
  sessionUserType: string | null,
  sessionUserId: string | null
): Promise<boolean> {
  if (sessionUserType === "negocio" && sessionUserId === negocioId) {
    return true
  }

  const cuentaOperativa = await getOperationalAccountFromRequest(request)
  if (
    cuentaOperativa?.empleados.some(
      (empleado) => empleado.activo && empleado.negocio.id === negocioId
    )
  ) {
    return true
  }

  const terminal = await resolveTerminalSession(request)
  if (terminal && terminal.negocio.id === negocioId) {
    return true
  }

  return false
}

// Platform service fee used server-side. This must never come from the request body.
const SERVICE_FEE_FIXED = 250
const MESA_SERVICE_FEE_ENABLED = false
const MAX_ITEMS_PER_ORDER = 50
const MAX_QUANTITY_PER_ITEM = 99
const MAX_AGREGADOS_PER_ITEM = 40
const MAX_SECCIONES_PER_ITEM = 30
const MAX_OPTION_QUANTITY = 99
const MAX_TEXT_LENGTH = 500
const MAX_IDEMPOTENCY_KEY_LENGTH = 100
// Mismo patrón ya usado y probado en manual mozo orders (Pedido.idempotencyKey /
// idempotencyFingerprint, migración 20260627000000_manual_order_idempotency) —
// formato de UUID v4, generado por el cliente una sola vez por intento de checkout.
const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  // P0-C.1: sin validar acá a propósito — una ubicación malformada nunca debe
  // rechazar el pedido completo (modo observación). Se evalúa de forma
  // tolerante más abajo, solo para pedidos de mesa, con evaluateMesaGeofence.
  mesaGeolocation: unknown
}

interface ValidatedPedidoItem {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  agregados: Array<{ id: string; nombre: string; precio: number; tipo: string }>
  secciones: Record<string, SectionSelection>
  // P1-A.2B: snapshot autoritativo server-side (nombre/grupo derivados de
  // Producto -> ProductoIngrediente -> Ingrediente) — nunca los datos crudos
  // enviados por el cliente. Ver buildIngredientesQuitadosSnapshot.
  ingredientesQuitados: IngredienteQuitadoCanonico[]
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
    // SEC-DEVICE-1: `payload.fingerprint` (body arbitrario, client-controlled)
    // dejó de leerse — la identidad de dispositivo ahora se deriva
    // server-side desde la cookie `deligo_device` (ver getOrCreateDeviceIdentity).
    mesaGeolocation: payload.mesaGeolocation,
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

// ============================================
// IDEMPOTENCIA PERSISTENTE (Seguridad-5C)
// ============================================
// Reutiliza exactamente las columnas Pedido.idempotencyKey / idempotencyFingerprint
// y el índice único @@unique([negocioId, idempotencyKey]) ya existentes en el schema
// desde la migración 20260627000000_manual_order_idempotency (pedidos manuales de
// mozo) — no hace falta ninguna migración nueva para extender esta protección al
// flujo público. Postgres nunca considera dos NULL iguales, así que los pedidos que
// no envían clave (modo legacy) siguen sin restricción alguna entre sí, exactamente
// como hoy.

function canonicalizeForFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeForFingerprint)
  if (!isPlainObject(value)) return value
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    result[key] = canonicalizeForFingerprint(value[key])
  }
  return result
}

function stableStringifyForFingerprint(value: unknown): string {
  return JSON.stringify(canonicalizeForFingerprint(value))
}

function normalizeSectionSelectionForFingerprint(selection: SectionSelection): SectionSelection {
  if (typeof selection === "string") return selection
  return Object.fromEntries(Object.entries(selection).sort(([a], [b]) => a.localeCompare(b)))
}

// Hashea únicamente el contenido que define "qué pedido es este" (nunca datos de
// sesión/cookies/tokens) — permite distinguir un reintento legítimo (mismo body,
// misma key) de una key reutilizada por error con un pedido genuinamente distinto.
function createPedidoIdempotencyFingerprint(params: {
  negocioId: string
  clienteId: string | null
  clienteTelefono: string
  metodoEntrega: MetodoEntrega
  metodoPago: MetodoPago
  notas: string | null
  direccion: string | null
  referencia: string | null
  lat: number | null
  lng: number | null
  mesaId: string | null
  mesaNumero: number | null
  items: ValidatedPedidoItem[]
}): string {
  const items = params.items
    .map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      agregados: item.agregados.map((agregado) => agregado.id).sort(),
      secciones: Object.fromEntries(
        Object.entries(item.secciones)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([section, selection]) => [section, normalizeSectionSelectionForFingerprint(selection)])
      ),
      // El fingerprint identifica "qué pidió el cliente", no el snapshot
      // derivado — se hashean los nombres solicitados (deterministas dado el
      // mismo producto), nunca el grupo server-side, igual que el resto de
      // este fingerprint nunca incluye datos derivados (ej. precio).
      ingredientesQuitados: item.ingredientesQuitados.map((entry) => entry.nombre).sort(),
      talle: item.talle,
      color: item.color,
    }))
    .sort((a, b) => a.productoId.localeCompare(b.productoId))

  const payload = {
    negocioId: params.negocioId,
    clienteId: params.clienteId,
    clienteTelefono: params.clienteTelefono,
    metodoEntrega: params.metodoEntrega,
    metodoPago: params.metodoPago,
    notas: params.notas,
    direccion: params.direccion,
    referencia: params.referencia,
    lat: params.lat,
    lng: params.lng,
    mesaId: params.mesaId,
    mesaNumero: params.mesaNumero,
    items,
  }

  return createHash("sha256").update(stableStringifyForFingerprint(payload)).digest("hex")
}

// Lee y valida el header Idempotency-Key. `null` significa "no vino" (modo legacy:
// se preserva el comportamiento actual sin ninguna garantía persistente — deuda de
// frontend pendiente, documentada en CLAUDE_REPORT.md). Si el header vino pero no
// matchea el formato esperado, se rechaza explícitamente en vez de tratarlo en
// silencio como "sin key", para que un bug de frontend no pase desapercibido.
function readIdempotencyKeyHeader(request: NextRequest): ValidationResult<string | null> {
  const raw = request.headers.get("idempotency-key")
  if (raw === null) return ok(null)

  const trimmed = raw.trim()
  if (!trimmed) return fail("Idempotency-Key no puede estar vacío")
  if (trimmed.length > MAX_IDEMPOTENCY_KEY_LENGTH) return fail("Idempotency-Key es demasiado largo")
  if (!IDEMPOTENCY_KEY_PATTERN.test(trimmed)) return fail("Idempotency-Key tiene un formato inválido")

  return ok(trimmed.toLowerCase())
}

function isPedidoUniqueConstraintConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

// Error de dominio: la key ya existe pero para un pedido distinto (otro cliente,
// u otro contenido bajo el mismo cliente/negocio) — nunca se traduce en éxito ni en
// 500, siempre en 409 sin filtrar datos del pedido ajeno.
class PedidoIdempotencyConflictError extends Error {}

// P0-D.2: se lanza dentro de la transacción de creación cuando el pedido
// público de mesa requiere una ocupación válida y no la tiene (cookie
// ausente o cualquier otra causa inválida — nunca se distingue cuál al
// cliente). Nunca se crea desde datos del body. Aborta toda la transacción
// (nada se crea, nada se actualiza) y se traduce a un 403 sanitizado más
// abajo, sin exponer detalle ni stack.
class MesaOccupancyBlockedError extends Error {
  constructor(public readonly reason: "missing" | "invalid" | "unavailable") {
    super(
      reason === "missing"
        ? "Ocupación de mesa requerida"
        : reason === "invalid"
          ? "Ocupación de mesa inválida"
          : "No se pudo vincular el pedido a la ocupación de la mesa"
    )
  }
}

function isSafeIdempotentPedido(params: {
  pedido: { negocioId: string; clienteId: string | null; idempotencyFingerprint: string | null } | null
  negocioId: string
  clienteId: string | null
  fingerprint: string
}): boolean {
  return Boolean(
    params.pedido &&
      params.pedido.negocioId === params.negocioId &&
      params.pedido.clienteId === params.clienteId &&
      params.pedido.idempotencyFingerprint === params.fingerprint
  )
}

// Tarea 20-CORRECCIÓN-1/2: puntos de pausa SOLO para tests deterministas de
// concurrencia real contra PostgreSQL (ver src/lib/negocio-salon.test.ts,
// Casos A/B). `POST` (exportado, HTTP-alcanzable) mantiene EXACTAMENTE la
// firma que Next.js espera (`(request: NextRequest)`, sin segundo parámetro)
// — el validador de rutas generado (`.next/types/validator.ts`,
// `RouteHandlerConfig<"/api/pedidos">`) tipa estructuralmente cada export
// HTTP (GET/POST/...) contra la firma real de Next; un segundo parámetro
// ahí rompe esa comprobación (confirmado: causó los 2 errores TypeScript
// nuevos de TAREA-20-CORRECCIÓN-1, ver CODEX_REPORT.md sección de
// reconciliación 34→36). La implementación real vive en
// `handlePedidoCreation` (nunca exportada como método HTTP), y el segundo
// export `POST_FOR_TESTS` — un nombre que Next.js nunca reconoce como
// método HTTP, así que su validador de rutas ni siquiera lo mira — es la
// única forma en que un test puede pasar `testHooks`.
export interface PedidoRouteTestHooks {
  beforeNegocioFetch?: () => Promise<void>
  beforeFinalSalonRevalidation?: () => Promise<void>
}

export async function POST(request: NextRequest) {
  return handlePedidoCreation(request)
}

export async function POST_FOR_TESTS(request: NextRequest, testHooks: PedidoRouteTestHooks) {
  return handlePedidoCreation(request, testHooks)
}

async function handlePedidoCreation(request: NextRequest, testHooks?: PedidoRouteTestHooks) {
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

    // Idempotency-Key: validación barata de formato antes de cualquier trabajo
    // pesado. `null` = no vino (modo legacy, sin cambios de comportamiento).
    const idempotencyKeyResult = readIdempotencyKeyHeader(request)
    if (!idempotencyKeyResult.ok) {
      return NextResponse.json({ error: idempotencyKeyResult.error }, { status: 400 })
    }
    const idempotencyKey = idempotencyKeyResult.value

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
              select: { id: true, nombre: true, categoria: true, negocioId: true },
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

    await testHooks?.beforeNegocioFetch?.()
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

      // P1-A.2B.1: snapshot autoritativo server-side — nombre/grupo derivados
      // exclusivamente de la relación real Producto -> ProductoIngrediente ->
      // Ingrediente de ESTE producto, validando explícitamente que cada
      // referencia pertenezca al negocio autoritativo del pedido (`negocioId`,
      // ya validado más arriba contra `requestedNegocioId` y contra todos los
      // productos) — el schema no impide estructuralmente que
      // ProductoIngrediente apunte a un Ingrediente de otro negocio, así que
      // esta validación no puede quedar solo implícita en la consulta. Un
      // nombre inexistente, de otro producto/negocio, o ambiguo (dos
      // ingredientes reales con el mismo nombre en este producto) se rechaza
      // con el mismo error genérico, sin distinguir el motivo.
      const { snapshot: ingredientesQuitadosSnapshot, invalidNames } = buildIngredientesQuitadosSnapshot(
        item.ingredientesQuitados,
        producto.ingredientes.map((pi) => ({
          nombre: pi.ingrediente.nombre,
          categoria: pi.ingrediente.categoria,
          negocioId: pi.ingrediente.negocioId,
        })),
        negocioId
      )
      if (invalidNames.length > 0) {
        return NextResponse.json({ error: "Ingrediente invalido" }, { status: 400 })
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
        ingredientesQuitados: ingredientesQuitadosSnapshot,
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
    // SEC-DEVICE-1: identidad de dispositivo server-managed — reemplaza la
    // confianza en `payload.fingerprint` (arbitrario, client-controlled).
    // Sólo lectura de cookie acá (sin DB); la cookie se setea en la
    // respuesta final sólo si `isNew`.
    const deviceIdentity = getOrCreateDeviceIdentity(request)
    let clienteId: string | null = null
    let clienteNombre = "Invitado"
    let clienteTelefono = ""
    let clienteUpdateData: { ultimoIp: string; dispositivoFingerprint?: string } | null = null
    // P0-C.2: capturado para el bypass de geocerca de mesa de personal
    // autenticado (ver isAuthenticatedStaffForNegocio) — no cambia ningún
    // comportamiento existente del flujo de cliente de abajo.
    let sessionUserType: string | null = null
    let sessionUserId: string | null = null

    if (token) {
      const session = await findSesionByToken(token)
      if (session) {
        sessionUserType = session.userType
        sessionUserId = session.userId
      }
      if (session && session.userType === "cliente") {
        const cliente = await db.cliente.findUnique({
          where: { id: session.userId },
        })
        if (cliente) {
          // Check if customer is blocked
          if (cliente.bloqueado) {
            // SEC-BLOCK-1: cuenta ya bloqueada — se rechaza exactamente igual
            // que antes, pero además se enriquece el registro ClienteBloqueado
            // con el dispositivo actual (para detectar una futura cuenta nueva
            // evasora desde este mismo dispositivo) y, si la cookie de
            // dispositivo es nueva, se setea en esta misma respuesta 403 (si
            // no se hace acá, un cliente bloqueado que solo intenta pedir
            // nunca terminaría con la cookie seteada).
            await ensureClienteBloqueadoRecordForDevice(db, {
              clienteId: cliente.id,
              clienteNombre: cliente.nombre,
              deviceId: deviceIdentity.deviceId,
              ip: getClientIp(request),
            })
            const blockedResponse = NextResponse.json(
              { error: "Tu cuenta ha sido bloqueada. Contactá a soporte para más información." },
              { status: 403 }
            )
            if (deviceIdentity.isNew) {
              setDeviceCookie(blockedResponse, deviceIdentity.token)
            }
            return blockedResponse
          }

          // SEC-BLOCK-1: cuenta todavía no marcada bloqueada — chequeo
          // anti-evasión ANTES de cualquier efecto secundario del pedido
          // (stock, Pedido, PedidoEvento, notificaciones). Señal fuerte
          // únicamente: igualdad exacta de fingerprint contra una fila
          // ClienteBloqueado huérfana o de otra cuenta (ver
          // findForeignDeviceBlockMatch). La IP nunca dispara esto por sí
          // sola.
          const foreignBlockMatch = await findForeignDeviceBlockMatch(deviceIdentity.deviceId, cliente.id)
          if (foreignBlockMatch) {
            await applyDeviceEvasionAutoBlock({
              clienteId: cliente.id,
              clienteNombre: cliente.nombre,
              deviceId: deviceIdentity.deviceId,
              ip: getClientIp(request),
            })
            const blockedResponse = NextResponse.json(
              { error: "Tu cuenta ha sido bloqueada. Contactá a soporte para más información." },
              { status: 403 }
            )
            if (deviceIdentity.isNew) {
              setDeviceCookie(blockedResponse, deviceIdentity.token)
            }
            return blockedResponse
          }

          clienteId = cliente.id
          clienteNombre = cliente.nombre
          clienteTelefono = cliente.telefono

          clienteUpdateData = {
            ultimoIp: getClientIp(request),
            // SEC-DEVICE-1: siempre el id server-derived — nunca el
            // `payload.fingerprint` legacy (client-controlled, ya no se lee).
            dispositivoFingerprint: deviceIdentity.deviceId,
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

    // Resolve empleado from the mesa assignment, not from public URL/body data.
    let empleadoId: string | null = null
    let empleadoNombre: string | null = null

    // P0-D.2: calculados dentro del bloque de geocerca de abajo (una sola
    // vez), pero necesarios más adelante para decidir si se exige/vincula la
    // ocupación de mesa — declarados acá para que sobrevivan fuera del
    // bloque `if (isMesaOrder)`.
    let negocioCalibrado = false
    let isStaffOrder = false
    let requiresMesaOccupancy = false

    if (isMesaOrder) {
      // Tarea 20 (Dark Kitchen): mismo patrón que el chequeo de
      // `ofreceDelivery` para "domicilio" más abajo — rechazo temprano,
      // antes de resolver la mesa, para que un negocio sin Salón nunca
      // filtre si una mesa/mozo existen. La apertura de ocupación (paso
      // posterior, tanto vía dispositivo como vía personal) revalida esta
      // misma capacidad DENTRO de su propia transacción — este chequeo acá
      // es la respuesta rápida y clara para el caso común, no la única
      // defensa.
      if (!tieneSalonHabilitado(negocio)) {
        return NextResponse.json(
          { error: "El negocio no tiene Salón habilitado" },
          { status: 400 }
        )
      }

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

      // Auto-resolve mozo from mesa assignment. This is the only authority for
      // mesa order attribution; public ?mozo=CODIGO must not grant privileges.
      const mesaEmpleadoId = mesaRow.empleadoId
      if (mesaEmpleadoId) {
        const mesaEmpleado = await db.empleado.findFirst({
          where: { id: mesaEmpleadoId, negocioId, rol: "mozo", activo: true, eliminado: false },
          select: { id: true, nombre: true },
        })
        if (mesaEmpleado) {
          empleadoId = mesaEmpleado.id
          empleadoNombre = mesaEmpleado.nombre
        }
      }

      // P0-C.2: geocerca de mesa en modo enforce para negocios calibrados.
      // La decisión ocurre acá, ANTES de cualquier escritura (stock, pedido,
      // notificaciones, actualización de cliente) — un pedido bloqueado nunca
      // llega a crearse, así que no hace falta revertir nada ni se consume la
      // clave de idempotencia. El personal autenticado (Negocio, Cuenta
      // Operativa, Terminal Operativa) nunca se bloquea; esa identidad se
      // resuelve siempre server-side desde las cookies de sesión reales,
      // nunca desde un campo del body. Nunca se guardan las coordenadas del
      // cliente en ningún lado — solo un resultado sanitizado (ver
      // logMesaGeofenceObservation).
      let geofenceBlockResponse: NextResponse | null = null
      try {
        negocioCalibrado =
          negocio.lat != null && negocio.lng != null && negocio.ubicacionCalibradaEn != null

        const geofenceResult = evaluateMesaGeofence(
          { lat: negocio.lat, lng: negocio.lng, ubicacionCalibradaEn: negocio.ubicacionCalibradaEn },
          pedidoInput.mesaGeolocation
        )

        let blocked = false
        // P0-D.2: la misma resolución de personal autenticado sirve tanto
        // para el bypass de geocerca (ya existente) como para el bypass de
        // ocupación (nuevo) — se calcula una sola vez por request acá,
        // nunca se repite la consulta más abajo.
        if (MESA_GEOFENCE_MODE === "enforce" && negocioCalibrado) {
          isStaffOrder = await isAuthenticatedStaffForNegocio(
            request,
            negocioId,
            sessionUserType,
            sessionUserId
          )

          if (geofenceResult.status !== "inside") {
            blocked = !isStaffOrder
          } else {
            // Política P0-D.2: la ocupación solo se exige para un pedido
            // público de mesa de un negocio calibrado que ya resolvió
            // "inside" — nunca para personal autenticado (Negocio, Cuenta
            // Operativa, Terminal Operativa; Mozo real nunca llega a este
            // endpoint, usa su propia ruta operativa).
            requiresMesaOccupancy = !isStaffOrder
          }
        }

        logMesaGeofenceObservation("mesa_geofence_check_order", {
          negocioId,
          mesaNumero,
          result: geofenceResult,
          blocked,
        })

        if (blocked) {
          const errorInfo = MESA_GEOFENCE_ERROR_BY_STATUS[geofenceResult.status]
          if (errorInfo) {
            geofenceBlockResponse = NextResponse.json(
              {
                error: errorInfo.message,
                code: errorInfo.code,
                geofenceStatus: geofenceResult.status,
                canRetry: true,
              },
              { status: 403 }
            )
          }
        } else if (!requiresMesaOccupancy) {
          // Negocio sin calibrar (rollout de P0-C.2 preservado) o personal
          // autenticado — ninguno de los dos exige ocupación. No hay nada
          // más que resolver acá; se registra el motivo sanitizado.
          logMesaOccupancyOrderEvent({
            negocioId,
            mesaNumero,
            outcome: !negocioCalibrado ? "business_unconfigured" : "bypassed_staff",
            linked: false,
          })
        }
      } catch (geofenceError) {
        console.error("[MesaGeofence] Error evaluando geocerca en pedido:", safeErrorForLog(geofenceError))
      }

      if (geofenceBlockResponse) {
        return geofenceBlockResponse
      }
    }

    // P0-D.2: se lee acá (fuera de la transacción, junto al resto de datos
    // ya resueltos), pero la validación real y definitiva ocurre recién
    // dentro del camino transaccional seguro, más abajo — nunca se confía
    // en la sola presencia de la cookie. Solo se lee cuando efectivamente
    // hace falta (pedido público de mesa calibrado, geocerca "inside").
    // Nunca se toma del body, de un header propio, ni de query params.
    const mesaOccupancyToken = requiresMesaOccupancy
      ? request.cookies.get(MESA_OCCUPANCY_COOKIE_NAME)?.value ?? null
      : null

    // T20-DK1: mismo estilo que el gate de `ofreceDelivery` para "domicilio"
    // más abajo — la UI ya oculta el botón de Retiro cuando el negocio no lo
    // ofrece, pero nunca es la única defensa: un negocio "solo delivery"
    // nunca puede terminar con un Pedido metodoEntrega:"retiro", sin importar
    // qué envíe el body.
    if (pedidoInput.metodoEntrega === "retiro" && !negocio.ofreceRetiro) {
      return NextResponse.json(
        { error: "El negocio no ofrece retiro" },
        { status: 400 }
      )
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

    // Solo se calcula si vino una key válida — en modo legacy (sin key) se guarda
    // `null` en ambas columnas, exactamente el mismo comportamiento que hoy.
    const idempotencyFingerprint = idempotencyKey
      ? createPedidoIdempotencyFingerprint({
          negocioId,
          clienteId,
          clienteTelefono,
          metodoEntrega: pedidoInput.metodoEntrega,
          metodoPago: pedidoInput.metodoPago,
          notas: pedidoInput.notas,
          direccion: finalDireccion,
          referencia: finalReferencia,
          lat: finalLat,
          lng: finalLng,
          mesaId: isMesaOrder ? mesaId : null,
          mesaNumero: isMesaOrder ? mesaNumero : null,
          items: validatedItems,
        })
      : null

    // P0-D.2: mesaId/mesaNumero ya resueltos server-side (mesaRow.id/numero)
    // cuando isMesaOrder es true — capturados en constantes propias para que
    // el chequeo de nulidad de abajo los angoste correctamente dentro del
    // closure de la transacción (una variable `let` capturada por un closure
    // no conserva el angostamiento de TypeScript; una `const` sí).
    const resolvedMesaIdForOccupancy: string | null = isMesaOrder ? mesaId : null
    const resolvedMesaNumeroForOccupancy: number | null = isMesaOrder ? mesaNumero : null

    // P2 corrección final: cuando la ocupación NO se exige acá (personal
    // autenticado, o negocio todavía sin geocerca calibrada) pero el pedido
    // SIGUE siendo de mesa, se abre/reutiliza la ocupación ANTES de la
    // transacción principal, usando `openOrReuseMesaOccupancyForStaff` — la
    // variante para personal (nunca la de dispositivo): no genera token, no
    // calcula hash, y NUNCA crea/toca ninguna `CredencialOcupacionMesa` (a
    // diferencia de la variante de dispositivo, que sí crearía una
    // credencial nueva en cada llamada sin token — quedaría huérfana, ya que
    // el personal nunca la usa ni la cookie se configura). Dentro de la
    // transacción de creación, `heartbeatOcupacionForStaffOrder` revalida
    // esta MISMA ocupación con una escritura condicional real — si alguien
    // la cerró justo en el medio, la creación se rechaza por completo (nunca
    // se crea el pedido con `ocupacionMesaId: null`).
    let staffOcupacionId: string | null = null
    if (isMesaOrder && !requiresMesaOccupancy && resolvedMesaIdForOccupancy) {
      try {
        const outcome = await openOrReuseMesaOccupancyForStaff({
          negocioId,
          mesaId: resolvedMesaIdForOccupancy,
        })
        staffOcupacionId = outcome.ocupacionId
      } catch (error) {
        console.error("Error abriendo/reutilizando ocupación para pedido de personal/no calibrado:", safeErrorForLog(error))
        return NextResponse.json(
          {
            error: "No se pudo vincular el pedido a la ocupación de la mesa. Intentá de nuevo.",
            code: "MESA_OCCUPANCY_UNAVAILABLE",
            canRetry: true,
          },
          { status: 409 }
        )
      }
    }

    const pedidoCreateData = {
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
      idempotencyKey,
      idempotencyFingerprint,
      items: {
        create: validatedItems.map((item) => ({
          productoId: item.productoId,
          nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          agregados: JSON.stringify(item.agregados),
          secciones: JSON.stringify(item.secciones),
          ingredientes: JSON.stringify([]),
          // P1-A.2B: `item.ingredientesQuitados` ya es el snapshot canónico
          // (IngredienteQuitadoCanonico[]) armado por buildIngredientesQuitadosSnapshot
          // más arriba — persiste `[]` cuando no se pidió quitar nada, igual que antes.
          ingredientesQuitados: JSON.stringify(item.ingredientesQuitados),
          seccionesPrecios: JSON.stringify({}),
          talle: item.talle,
          color: item.color,
        })),
      },
    }

    const result = await db
      .$transaction(async (tx) => {
        // Idempotencia persistente: si ya vino una key, resolver PRIMERO si ya
        // existe un pedido con esa (negocioId, idempotencyKey) — antes de
        // cualquier efecto secundario (tx.cliente.update). Un replay idempotente
        // válido no debe tocar Cliente.ultimoIp/dispositivoFingerprint de nuevo,
        // y un conflicto de key tampoco debe dejar ese side effect aplicado antes
        // de fallar. Verificado dentro de la misma transacción para que la
        // comprobación y la creación sean atómicas entre sí — nunca se crea un
        // segundo pedido para la misma key.
        if (idempotencyKey && idempotencyFingerprint) {
          const existingPedido = await tx.pedido.findFirst({
            where: { negocioId, idempotencyKey },
            include: { items: true },
          })
          if (existingPedido) {
            if (
              !isSafeIdempotentPedido({
                pedido: existingPedido,
                negocioId,
                clienteId,
                fingerprint: idempotencyFingerprint,
              })
            ) {
              // Misma key, pero pedido de otro cliente o con contenido distinto —
              // nunca se devuelven sus datos, ni se crea un pedido nuevo, ni se
              // actualiza el cliente.
              throw new PedidoIdempotencyConflictError()
            }
            return { status: "idempotent" as const, pedido: existingPedido }
          }
        }

        // P0-D.2: la ocupación solo se exige/vincula en la rama de creación
        // nueva — nunca para un replay idempotente (ese pedido ya existe y
        // ya tuvo su propio heartbeat cuando se creó por primera vez).
        // Validación definitiva y heartbeat dentro del mismo camino
        // transaccional que el `pedido.create`, nunca en una transacción
        // separada — si cualquiera de los dos falla, toda la transacción se
        // revierte (Prisma hace rollback automático al propagarse el error)
        // y no se crea pedido, no se descuenta stock, no se envían
        // notificaciones, no se consume la idempotency key para un pedido
        // nuevo.
        let validatedOcupacionId: string | null = null
        if (requiresMesaOccupancy && resolvedMesaIdForOccupancy && resolvedMesaNumeroForOccupancy != null) {
          const occupancyResult = await resolveMesaOccupancyForOrder(tx, {
            negocioId,
            mesaId: resolvedMesaIdForOccupancy,
            token: mesaOccupancyToken,
          })

          if (occupancyResult.status !== "valid") {
            logMesaOccupancyOrderEvent({
              negocioId,
              mesaNumero: resolvedMesaNumeroForOccupancy,
              outcome: occupancyResult.status,
              linked: false,
            })
            throw new MesaOccupancyBlockedError(occupancyResult.status)
          }

          const heartbeatOk = await heartbeatMesaOccupancyForOrder(tx, {
            ocupacionId: occupancyResult.ocupacionId,
            credencialId: occupancyResult.credencialId,
            negocioId,
            mesaId: resolvedMesaIdForOccupancy,
            now: new Date(),
          })

          if (!heartbeatOk) {
            // La credencial era válida al leerla, pero algo cambió justo
            // antes de escribir (TOCTOU) — se trata igual que inválida, sin
            // distinguir el motivo al cliente.
            logMesaOccupancyOrderEvent({
              negocioId,
              mesaNumero: resolvedMesaNumeroForOccupancy,
              outcome: "invalid",
              linked: false,
            })
            throw new MesaOccupancyBlockedError("invalid")
          }

          validatedOcupacionId = occupancyResult.ocupacionId
          logMesaOccupancyOrderEvent({
            negocioId,
            mesaNumero: resolvedMesaNumeroForOccupancy,
            outcome: "valid",
            linked: true,
          })
        } else if (isMesaOrder && resolvedMesaIdForOccupancy && staffOcupacionId) {
          // P2 corrección (Bloqueos 3/5/8): revalida, DENTRO de esta misma
          // transacción, la ocupación ya abierta/reutilizada antes de entrar
          // acá (`staffOcupacionId`) con una escritura condicional real
          // (`heartbeatOcupacionForStaffOrder`). Si un cierre comercial
          // concurrente ya la cerró, esto devuelve "unavailable" y SE ABORTA
          // toda la transacción — nunca se crea el pedido con
          // `ocupacionMesaId: null` como fallback silencioso.
          const guard = await heartbeatOcupacionForStaffOrder(tx, {
            negocioId,
            mesaId: resolvedMesaIdForOccupancy,
            ocupacionId: staffOcupacionId,
            now: new Date(),
          })
          if (guard.status === "unavailable") {
            throw new MesaOccupancyBlockedError("unavailable")
          }
          validatedOcupacionId = guard.ocupacionId
        }

        // Tarea 20-CORRECCIÓN-1 (Caso C): el chequeo temprano (línea ~1062)
        // y la apertura/heartbeat de ocupación de arriba pueden haber leído
        // `salonActivo=true` un instante antes de que una desactivación
        // concurrente comitee — y para el camino de dispositivo/cliente
        // (`requiresMesaOccupancy`), la ocupación ya existía de una llamada
        // ANTERIOR y separada a POST /api/public/mesa-geofence, así que
        // `resolveMesaOccupancyForOrder`/`heartbeatMesaOccupancyForOrder` de
        // arriba NUNCA vuelven a mirar `salonActivo` por sí solos. Esta es
        // la revalidación definitiva y real: una lectura fresca, dentro de
        // esta MISMA transacción, en el último instante antes de escribir el
        // pedido — si una desactivación ganó la carrera en cualquier punto
        // anterior, esto la detecta y aborta toda la transacción (rollback
        // completo, igual que MesaOccupancyBlockedError).
        if (isMesaOrder) {
          await testHooks?.beforeFinalSalonRevalidation?.()
          const negocioFresco = await tx.negocio.findUnique({
            where: { id: negocioId },
            select: { salonActivo: true },
          })
          if (!tieneSalonHabilitado(negocioFresco)) {
            throw new SalonDeshabilitadoError()
          }
        }

        // Solo se llega acá si no hubo key, o si la key es nueva (sin pedido
        // previo) — recién ahí es seguro aplicar el side effect y crear.
        if (clienteId && clienteUpdateData) {
          await tx.cliente.update({
            where: { id: clienteId },
            data: clienteUpdateData,
          })
        }

        const created = await tx.pedido.create({
          data: { ...pedidoCreateData, ocupacionMesaId: validatedOcupacionId },
          include: { items: true },
        })

        return { status: "created" as const, pedido: created }
      })
      .catch(async (error) => {
        if (error instanceof PedidoIdempotencyConflictError) throw error
        if (error instanceof MesaOccupancyBlockedError) throw error
        if (error instanceof SalonDeshabilitadoError) throw error

        // Carrera: dos requests con la misma key pasaron el chequeo previo casi
        // al mismo tiempo — el índice único (negocioId, idempotencyKey) rechaza
        // la segunda inserción con P2002. Se busca el pedido ganador y, si es un
        // match seguro, se devuelve como si hubiera sido la respuesta idempotente
        // desde el principio — nunca un 500 para el perdedor de la carrera.
        if (idempotencyKey && idempotencyFingerprint && isPedidoUniqueConstraintConflict(error)) {
          const existingPedido = await db.pedido.findFirst({
            where: { negocioId, idempotencyKey },
            include: { items: true },
          })
          if (
            isSafeIdempotentPedido({
              pedido: existingPedido,
              negocioId,
              clienteId,
              fingerprint: idempotencyFingerprint,
            })
          ) {
            return { status: "idempotent" as const, pedido: existingPedido! }
          }
          throw new PedidoIdempotencyConflictError()
        }

        throw error
      })

    const pedido = result.pedido

    // Las notificaciones push solo tienen sentido para un pedido genuinamente
    // nuevo — un replay idempotente no debe volver a notificar al negocio/salón.
    if (result.status === "created") {
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
        // 19-B0.2E1: el cuerpo embebe clienteNombre — clienteId es null cuando
        // el pedido fue creado sin sesión de Cliente real (mesa/guest).
        sourceClienteId: clienteId || null,
        pushSubscription: negocioWithPush?.pushSubscription ?? null,
        pushPayload: payload,
        cleanupExpired: { model: "negocio", id: negocioId },
      })
    } catch (pushError) {
      console.error("[Push] Failed to send new order notification:", safeErrorForLog(pushError))
    }

    // Envío moderno a Salón: todas las cuentas operativas personales con
    // areaOperativa="salon" del negocio (Legacy-Cleanup-1C.2B). Se intenta
    // primero para poder deduplicar por endpoint contra el canal legacy.
    let modernSalonEndpoints: string[] = []
    if (isMesaOrder && mesaNumero) {
      try {
        const modernResult = await notifySalonNewOrderForOperations({
          pedidoId: pedido.id,
          negocioId,
          slug: negocio.slug,
          mesaNumero,
          clienteNombre,
          total: finalTotal,
          mozoNombre: empleadoNombre,
          clienteId: clienteId || null,
        })
        modernSalonEndpoints = modernResult.attemptedEndpoints
      } catch (modernSalonError) {
        console.error("[Push] Failed to send modern operaciones salon notification:", safeErrorForLog(modernSalonError))
      }
    }

    // Send push notification to the salon shared-display PWA for mesa orders.
    // Legacy-Cleanup-1C.1: el envío a la PWA de empleados (retiro/domicilio,
    // vía Negocio.pushSubscriptionEmpleados) se retiró — sin consumidor
    // moderno. El envío a Salón (Negocio.pushSubscriptionSalon) se conserva
    // intacto: src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts (el
    // alta manual de pedidos del panel moderno de Mozo) también depende de
    // esta misma notificación — no está en el alcance de archivos permitidos
    // de esta etapa, así que retirarla acá crearía una inconsistencia real
    // entre pedidos de cliente y pedidos manuales de mozo.
    // Legacy-Cleanup-1C.2B: se omite este envío legacy si su mismo endpoint ya
    // recibió el aviso moderno arriba (dedup cross-canal por endpoint).
    if (isMesaOrder && mesaNumero) {
      try {
        const sharedPush = await db.negocio.findUnique({
          where: { id: negocioId },
          select: { pushSubscriptionSalon: true },
        })

        if (sharedPush?.pushSubscriptionSalon) {
          const legacyEndpoint = parseSubscriptionEndpoint(sharedPush.pushSubscriptionSalon)
          const alreadyNotified =
            legacyEndpoint !== null && modernSalonEndpoints.includes(legacyEndpoint)

          if (!alreadyNotified) {
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
              // 19-B0.2E1: el cuerpo puede embeber clienteNombre (cuando no hay
              // mozo) — clienteId es null para pedidos de mesa sin sesión real.
              sourceClienteId: clienteId || null,
              datos: { mesaNumero },
              pushSubscription: sharedPush.pushSubscriptionSalon,
              pushPayload: salonPayload,
              cleanupExpired: { model: "negocio", id: negocioId, field: "pushSubscriptionSalon" },
            })
          }
        }
      } catch (sharedPushError) {
        console.error("[Push] Failed to send shared-display notification:", safeErrorForLog(sharedPushError))
      }
    }
    }

    // Mismo cuerpo de respuesta (el objeto pedido, sin envolver) tanto para una
    // creación nueva (201) como para un replay idempotente (200) — los clientes
    // que todavía no envían Idempotency-Key nunca ven el status 200 acá, siguen
    // recibiendo exactamente 201 como hoy.
    const pedidoResponse = NextResponse.json(pedido, { status: result.status === "created" ? 201 : 200 })
    // SEC-DEVICE-1: sólo setea la cookie cuando no existía una válida — una
    // cookie ya presente nunca se reemplaza en cada pedido.
    if (deviceIdentity.isNew) {
      setDeviceCookie(pedidoResponse, deviceIdentity.token)
    }
    return pedidoResponse
  } catch (error) {
    if (error instanceof PedidoIdempotencyConflictError) {
      return NextResponse.json(
        {
          error:
            "Ya existe un pedido distinto con esta clave de idempotencia. Generá una clave nueva e intentá de nuevo.",
        },
        { status: 409 }
      )
    }
    // Tarea 20-CORRECCIÓN-1 (Caso C): la desactivación de Salón ganó la
    // carrera entre el chequeo temprano y la revalidación final dentro de la
    // transacción de creación — el pedido nunca se creó (rollback completo).
    // Mismo mensaje y status que el chequeo temprano (línea ~1062): desde la
    // perspectiva del cliente es exactamente el mismo motivo de rechazo,
    // solo detectado más tarde.
    if (error instanceof SalonDeshabilitadoError) {
      return NextResponse.json(
        { error: "El negocio no tiene Salón habilitado" },
        { status: 400 }
      )
    }
    // P0-D.2: cookie ausente o credencial inválida — el código público nunca
    // distingue cuál de las causas ocurrió (revocada, cerrada, expirada, otra
    // mesa/negocio, puntero cambiado quedan todas colapsadas en "invalid").
    if (error instanceof MesaOccupancyBlockedError) {
      if (error.reason === "unavailable") {
        // P2 corrección: camino de personal autenticado/negocio no calibrado
        // — nunca es un problema de ubicación/geocerca del cliente, así que
        // nunca lleva `requiresLocationCheck`. El pedido nunca se creó (toda
        // la transacción se revirtió) — quien llama puede reintentar.
        return NextResponse.json(
          {
            error: "No se pudo vincular el pedido a la ocupación de la mesa. Intentá de nuevo.",
            code: "MESA_OCCUPANCY_UNAVAILABLE",
            canRetry: true,
          },
          { status: 409 }
        )
      }
      const info =
        error.reason === "missing"
          ? { error: "Necesitamos volver a validar tu acceso a esta mesa.", code: "MESA_OCCUPANCY_REQUIRED" }
          : {
              error: "Tu acceso a esta mesa ya no es válido. Volvé a comprobar la ubicación.",
              code: "MESA_OCCUPANCY_INVALID",
            }
      return NextResponse.json(
        { ...info, canRetry: true, requiresLocationCheck: true },
        { status: 403 }
      )
    }
    console.error("Error creating pedido:", safeErrorForLog(error))
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

    const session = await findSesionByToken(token)
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
    console.error("Error fetching pedidos:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
