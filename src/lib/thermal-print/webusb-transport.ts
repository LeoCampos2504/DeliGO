// ============================================
// DeliGO — Transporte WebUSB experimental (P3-B1)
// ============================================
// Implementación REAL (a nivel de librería) del contrato
// `ThermalPrinterTransport` (P3-A, `transport.ts`) usando WebUSB. Este
// archivo NUNCA se integra con React/`MesaCuentaDialog`/botones — eso queda
// para P3-B2, después de validar esta base y de contar con una impresora
// física confirmada. `window.print()` no se toca en ningún punto.
//
// Nunca llama `navigator.usb.requestDevice()` fuera de `connect()`, nunca
// al importar el módulo, nunca automáticamente, nunca durante SSR, nunca
// enumera dispositivos (`getDevices()`), nunca persiste nada en
// localStorage/IndexedDB/cookies/DB. Los bytes ESC/POS los sigue generando
// exclusivamente `escpos.ts` (P3-A) — este módulo solo transmite los bytes
// que el llamador ya generó, nunca los construye ni los modifica.

import type {
  ThermalPrinterTransport,
  ThermalPrinterTransportError,
  ThermalPrinterTransportErrorReason,
  ThermalPrinterTransportState,
} from "./transport"
import type { USB, USBAlternateInterface, USBConfiguration, USBDevice, USBDeviceFilter, USBOutTransferResult } from "./webusb-types"

// ---------------------------------------------------------------------------
// Opciones (sección 7) — validadas y clonadas, nunca mutan el objeto del llamador
// ---------------------------------------------------------------------------

export interface WebUsbThermalPrinterOptions {
  /** Obligatorio — al menos un filtro con un criterio real (sección 8). */
  filters: USBDeviceFilter[]
  configurationValue?: number
  interfaceNumber?: number
  alternateSetting?: number
  endpointNumber?: number
  /** Preferencia de tipo de endpoint OUT a descubrir — nunca `"isochronous"`. Default: `"bulk"`. */
  transferType?: "bulk" | "interrupt"
  /** Tamaño de chunk para `write()`, en bytes. Default `4096`, entre `64` y `16384`. */
  chunkSize?: number
}

interface ValidatedWebUsbThermalPrinterOptions {
  filters: USBDeviceFilter[]
  configurationValue?: number
  interfaceNumber?: number
  alternateSetting?: number
  endpointNumber?: number
  transferType: "bulk" | "interrupt"
  chunkSize: number
}

const MAX_FILTERS = 10
const USB_ID_MIN = 0
const USB_ID_MAX = 0xffff // vendorId/productId son campos USB de 16 bits.
const USB_CLASS_MIN = 0
const USB_CLASS_MAX = 0xff // class/subclass/protocol son campos USB de 8 bits.
const INDEX_MIN = 0
const INDEX_MAX = 255
const MAX_SERIAL_NUMBER_LENGTH = 256

/** Default documentado — ver sección 14. Nunca una garantía de rendimiento físico. */
export const DEFAULT_CHUNK_SIZE = 4096
export const MIN_CHUNK_SIZE = 64
export const MAX_CHUNK_SIZE = 16384

function isValidUsbId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= USB_ID_MIN && value <= USB_ID_MAX
}
function isValidClassCode(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= USB_CLASS_MIN && value <= USB_CLASS_MAX
}
function isValidIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= INDEX_MIN && value <= INDEX_MAX
}

/**
 * Valida UN filtro y devuelve una copia nueva con solo los campos
 * reconocidos — nunca la referencia original. Rechaza `{}` (sección 8: "no
 * aceptar un filtro vacío") exigiendo al menos un criterio real.
 */
/** Copia local mutable de `USBDeviceFilter` — sus campos son `readonly` en el contrato público, nunca en esta construcción interna previa a devolverlos. */
type MutableUsbDeviceFilter = { -readonly [K in keyof USBDeviceFilter]?: USBDeviceFilter[K] }

function validateFilter(filter: unknown, index: number): USBDeviceFilter {
  if (!filter || typeof filter !== "object") {
    throw new TypeError(`filters[${index}] debe ser un objeto`)
  }
  const raw = filter as USBDeviceFilter
  const validated: MutableUsbDeviceFilter = {}
  let hasCriterion = false

  if (raw.vendorId !== undefined) {
    if (!isValidUsbId(raw.vendorId)) throw new RangeError(`filters[${index}].vendorId inválido`)
    validated.vendorId = raw.vendorId
    hasCriterion = true
  }
  if (raw.productId !== undefined) {
    if (!isValidUsbId(raw.productId)) throw new RangeError(`filters[${index}].productId inválido`)
    validated.productId = raw.productId
    hasCriterion = true
  }
  if (raw.classCode !== undefined) {
    if (!isValidClassCode(raw.classCode)) throw new RangeError(`filters[${index}].classCode inválido`)
    validated.classCode = raw.classCode
    hasCriterion = true
  }
  if (raw.subclassCode !== undefined) {
    if (!isValidClassCode(raw.subclassCode)) throw new RangeError(`filters[${index}].subclassCode inválido`)
    validated.subclassCode = raw.subclassCode
    hasCriterion = true
  }
  if (raw.protocolCode !== undefined) {
    if (!isValidClassCode(raw.protocolCode)) throw new RangeError(`filters[${index}].protocolCode inválido`)
    validated.protocolCode = raw.protocolCode
    hasCriterion = true
  }
  if (raw.serialNumber !== undefined) {
    if (typeof raw.serialNumber !== "string" || raw.serialNumber.length === 0 || raw.serialNumber.length > MAX_SERIAL_NUMBER_LENGTH) {
      throw new RangeError(`filters[${index}].serialNumber inválido`)
    }
    validated.serialNumber = raw.serialNumber
    hasCriterion = true
  }

  if (!hasCriterion) {
    throw new RangeError(
      `filters[${index}] debe tener al menos un criterio real (vendorId/productId/classCode/subclassCode/protocolCode/serialNumber) — un filtro vacío equivaldría a un selector totalmente abierto, prohibido por diseño (sección 8)`
    )
  }

  // P3-B1 corrección (Defecto 1): dependencias estructurales que el propio
  // estándar WebUSB exige entre los campos de un filtro — nunca combinaciones
  // inventadas por este proyecto. Se aplican DESPUÉS de validar tipos/rangos
  // y ANTES de devolver el filtro, sobre el objeto ya `validated` (nunca
  // sobre `raw`, para no reintroducir campos no reconocidos). `vendorId`
  // solo, `classCode` solo, o `serialNumber` solo siguen siendo válidos —
  // nunca se exige `productId` solo por existir `vendorId`, ni se inventa
  // una dependencia de `serialNumber` que el estándar no exige en esta etapa.
  if (validated.productId !== undefined && validated.vendorId === undefined) {
    throw new RangeError(`filters[${index}].productId requiere vendorId`)
  }
  if (validated.subclassCode !== undefined && validated.classCode === undefined) {
    throw new RangeError(`filters[${index}].subclassCode requiere classCode`)
  }
  if (validated.protocolCode !== undefined && validated.subclassCode === undefined) {
    throw new RangeError(`filters[${index}].protocolCode requiere subclassCode`)
  }

  return validated
}

/** Valida el arreglo completo, elimina duplicados exactos, nunca muta `filters` del llamador. */
function validateFilters(filters: unknown): USBDeviceFilter[] {
  if (!Array.isArray(filters) || filters.length === 0) {
    throw new RangeError("filters es obligatorio y no puede estar vacío")
  }
  if (filters.length > MAX_FILTERS) {
    throw new RangeError(`filters no puede tener más de ${MAX_FILTERS} elementos`)
  }

  const validated = filters.map((filter, index) => validateFilter(filter, index))

  const seen = new Set<string>()
  const deduped: USBDeviceFilter[] = []
  for (const filter of validated) {
    const key = JSON.stringify(filter, Object.keys(filter).sort())
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(filter)
  }
  return deduped
}

function validateOptionalIndex(value: number | undefined, name: string): number | undefined {
  if (value === undefined) return undefined
  if (!isValidIndex(value)) throw new RangeError(`${name} inválido (debe ser un entero entre ${INDEX_MIN} y ${INDEX_MAX})`)
  return value
}

function validateChunkSize(value: number | undefined): number {
  if (value === undefined) return DEFAULT_CHUNK_SIZE
  if (!Number.isInteger(value) || value < MIN_CHUNK_SIZE || value > MAX_CHUNK_SIZE) {
    throw new RangeError(`chunkSize debe ser un entero entre ${MIN_CHUNK_SIZE} y ${MAX_CHUNK_SIZE}`)
  }
  return value
}

function validateTransferType(value: "bulk" | "interrupt" | undefined): "bulk" | "interrupt" {
  if (value === undefined) return "bulk"
  if (value !== "bulk" && value !== "interrupt") {
    throw new RangeError('transferType inválido: debe ser "bulk" o "interrupt" (nunca "isochronous" — sección 11)')
  }
  return value
}

/**
 * Valida TODAS las opciones y devuelve una copia nueva — el objeto/arreglo
 * original del llamador queda intacto (testeado explícitamente: "opciones
 * válidas no se mutan"). Lanza `TypeError`/`RangeError` planos (nunca un
 * `ThermalPrinterTransportError` sanitizado) porque esto es un error de
 * programación del llamador detectado ANTES de tocar cualquier API WebUSB
 * — nunca una falla de hardware/navegador en tiempo de ejecución.
 */
function validateOptions(options: WebUsbThermalPrinterOptions): ValidatedWebUsbThermalPrinterOptions {
  if (!options || typeof options !== "object") {
    throw new TypeError("Las opciones del transporte WebUSB son obligatorias")
  }

  const interfaceNumber = validateOptionalIndex(options.interfaceNumber, "interfaceNumber")
  const alternateSetting = validateOptionalIndex(options.alternateSetting, "alternateSetting")
  const endpointNumber = validateOptionalIndex(options.endpointNumber, "endpointNumber")

  // P3-B1 corrección (Defecto 3): `alternateSetting` sin `interfaceNumber`
  // se ignoraba silenciosamente en la búsqueda global de
  // `resolveInterfaceTarget` — una opción que el llamador cree explícita
  // pero que en realidad no hace nada. Se rechaza en la construcción del
  // transporte, antes de tocar `navigator.usb`.
  if (alternateSetting !== undefined && interfaceNumber === undefined) {
    throw new RangeError("alternateSetting requiere interfaceNumber")
  }
  // P3-B1 corrección (Defecto 4, sección 8): se prefiere rechazar
  // `endpointNumber` sin `interfaceNumber` en vez de conservar una búsqueda
  // global ambigua — los números de endpoint pueden repetirse entre
  // interfaces, y una configuración que "parece explícita" podría terminar
  // seleccionando una interfaz distinta de la que el llamador espera.
  if (endpointNumber !== undefined && interfaceNumber === undefined) {
    throw new RangeError("endpointNumber requiere interfaceNumber")
  }

  return {
    filters: validateFilters(options.filters),
    configurationValue: validateOptionalIndex(options.configurationValue, "configurationValue"),
    interfaceNumber,
    alternateSetting,
    endpointNumber,
    transferType: validateTransferType(options.transferType),
    chunkSize: validateChunkSize(options.chunkSize),
  }
}

// ---------------------------------------------------------------------------
// Errores sanitizados (sección 17) — reutiliza el contrato de P3-A sin
// agregar ningún motivo nuevo (los 6 existentes ya cubren todos los casos
// reales de esta implementación).
// ---------------------------------------------------------------------------

export class ThermalPrinterTransportException extends Error implements ThermalPrinterTransportError {
  constructor(public readonly reason: ThermalPrinterTransportErrorReason, message: string) {
    super(message)
    this.name = "ThermalPrinterTransportException"
  }
}

function isUserCancelledBrowserError(error: unknown): boolean {
  // El navegador reporta la cancelación del selector de dispositivo como un
  // `DOMException`/`Error` con `name === "NotFoundError"` — nunca se
  // inspecciona ni se expone ningún otro campo del error crudo.
  return error instanceof Error && error.name === "NotFoundError"
}

function isPermissionDeniedBrowserError(error: unknown): boolean {
  return error instanceof Error && error.name === "SecurityError"
}

/**
 * Traduce CUALQUIER error (crudo del navegador, o ya sanitizado) a un
 * `ThermalPrinterTransportException` seguro. Nunca copia `error.message`
 * del navegador al mensaje sanitizado — siempre usa un mensaje propio,
 * fijo y genérico. El error crudo nunca se adjunta al objeto devuelto (no
 * se expone en el contrato público, sección 17).
 */
function toTransportException(
  error: unknown,
  fallbackReason: ThermalPrinterTransportErrorReason,
  fallbackMessage: string
): ThermalPrinterTransportException {
  if (error instanceof ThermalPrinterTransportException) return error
  if (isUserCancelledBrowserError(error)) {
    return new ThermalPrinterTransportException("user_cancelled", "El usuario canceló la selección del dispositivo.")
  }
  if (isPermissionDeniedBrowserError(error)) {
    return new ThermalPrinterTransportException("permission_denied", "Permiso denegado por el navegador.")
  }
  return new ThermalPrinterTransportException(fallbackReason, fallbackMessage)
}

// ---------------------------------------------------------------------------
// Descubrimiento determinista de configuración/interfaz/alternate/endpoint
// (secciones 9-12) — funciones puras sobre los descriptors ya obtenidos,
// nunca llaman a ninguna API WebUSB por sí mismas.
// ---------------------------------------------------------------------------

function findConfiguration(device: USBDevice, configurationValue: number | undefined): USBConfiguration {
  if (configurationValue !== undefined) {
    const found = device.configurations.find((configuration) => configuration.configurationValue === configurationValue)
    if (!found) {
      throw new ThermalPrinterTransportException("unsupported_device", "La configuración indicada no existe en este dispositivo.")
    }
    return found
  }
  // Sin configuración explícita: se reutiliza la ya activa si el dispositivo
  // ya tiene una, o se elige la PRIMERA expuesta por el descriptor (orden
  // estable del navegador) — nunca se asume `configurationValue === 1`.
  if (device.configuration) return device.configuration
  const [first] = device.configurations
  if (!first) {
    throw new ThermalPrinterTransportException("unsupported_device", "El dispositivo no expone ninguna configuración USB.")
  }
  return first
}

interface ResolvedInterfaceTarget {
  interfaceNumber: number
  alternateSetting: number
  endpointNumber: number
}

/**
 * Busca un endpoint OUT compatible dentro de UN alternate. Si `endpointNumber`
 * fue indicado explícitamente, exige simultáneamente que exista, que sea de
 * salida Y que su `type` coincida con `transferType` (P3-B1 corrección,
 * Defecto 2) — nunca acepta un endpoint IN aunque el número coincida, y
 * NUNCA acepta un endpoint OUT de un tipo distinto al pedido (p. ej. pedir
 * `"bulk"` y que el endpoint explícito sea `"interrupt"` ya NO se acepta
 * silenciosamente). Si el endpoint existe pero su tipo no coincide, se trata
 * como dispositivo/configuración no compatible — el llamador de esta función
 * (`resolveInterfaceTarget`) ya traduce un resultado `null` a
 * `"unsupported_device"`, sin reclamar ni escribir sobre ese endpoint. Sin
 * número explícito, busca por dirección "out" + el tipo preferido (nunca
 * "isochronous", nunca elegido por defecto) — nunca hace un segundo intento
 * con otro tipo.
 */
function findOutEndpointInAlternate(
  alternate: USBAlternateInterface,
  endpointNumber: number | undefined,
  transferType: "bulk" | "interrupt"
) {
  if (endpointNumber !== undefined) {
    return (
      alternate.endpoints.find(
        (endpoint) => endpoint.endpointNumber === endpointNumber && endpoint.direction === "out" && endpoint.type === transferType
      ) ?? null
    )
  }
  return alternate.endpoints.find((endpoint) => endpoint.direction === "out" && endpoint.type === transferType) ?? null
}

/**
 * Resuelve la interfaz/alternate/endpoint objetivo de forma determinista.
 * Con `interfaceNumber` explícito, valida que exista y busca dentro de ESA
 * interfaz (alternate explícito si se indicó, o el primer alternate — en
 * orden estable — con un endpoint OUT compatible). Sin `interfaceNumber`,
 * recorre TODAS las interfaces/alternates en el orden que expone el
 * descriptor y toma el primer candidato válido en toda esa recorrida —
 * nunca elige un endpoint IN, nunca isochronous por defecto, nunca "el
 * primer número sin inspeccionar los descriptors" (sección 11).
 *
 * Invariante garantizado por `validateOptions` (P3-B1 corrección, Defectos
 * 3/4): en la rama SIN `interfaceNumber` (bloque de abajo), `options.
 * alternateSetting` y `options.endpointNumber` NUNCA están definidos — su
 * combinación con `interfaceNumber` ausente ya se rechazó al construir el
 * transporte, antes de llegar acá.
 */
function resolveInterfaceTarget(
  configuration: USBConfiguration,
  options: ValidatedWebUsbThermalPrinterOptions
): ResolvedInterfaceTarget {
  if (options.interfaceNumber !== undefined) {
    const iface = configuration.interfaces.find((candidate) => candidate.interfaceNumber === options.interfaceNumber)
    if (!iface) {
      throw new ThermalPrinterTransportException("unsupported_device", "La interfaz indicada no existe en este dispositivo.")
    }

    if (options.alternateSetting !== undefined) {
      const alternate = iface.alternates.find((candidate) => candidate.alternateSetting === options.alternateSetting)
      if (!alternate) {
        throw new ThermalPrinterTransportException("unsupported_device", "El alternate indicado no existe en esta interfaz.")
      }
      const endpoint = findOutEndpointInAlternate(alternate, options.endpointNumber, options.transferType)
      if (!endpoint) {
        throw new ThermalPrinterTransportException("unsupported_device", "El endpoint OUT indicado no existe o no es compatible.")
      }
      return { interfaceNumber: iface.interfaceNumber, alternateSetting: alternate.alternateSetting, endpointNumber: endpoint.endpointNumber }
    }

    for (const alternate of iface.alternates) {
      const endpoint = findOutEndpointInAlternate(alternate, options.endpointNumber, options.transferType)
      if (endpoint) {
        return { interfaceNumber: iface.interfaceNumber, alternateSetting: alternate.alternateSetting, endpointNumber: endpoint.endpointNumber }
      }
    }
    throw new ThermalPrinterTransportException("unsupported_device", "La interfaz indicada no tiene ningún endpoint OUT compatible.")
  }

  for (const iface of configuration.interfaces) {
    for (const alternate of iface.alternates) {
      const endpoint = findOutEndpointInAlternate(alternate, options.endpointNumber, options.transferType)
      if (endpoint) {
        return { interfaceNumber: iface.interfaceNumber, alternateSetting: alternate.alternateSetting, endpointNumber: endpoint.endpointNumber }
      }
    }
  }
  throw new ThermalPrinterTransportException("unsupported_device", "No se encontró ninguna interfaz con un endpoint OUT compatible.")
}

/**
 * Acceso al `navigator.usb` real sin volver a declarar la propiedad global
 * — ver comentario de cabecera de `webusb-types.ts`. La intersección local
 * `Navigator & { usb?: USB }` combina con el `usb?: unknown` ya declarado
 * por P3-A (`unknown & USB` se simplifica a `USB`), sin ningún conflicto de
 * fusión de declaraciones y sin tocar `browser-capabilities.ts`.
 */
function getNavigatorUsb(): USB | undefined {
  if (typeof navigator === "undefined") return undefined
  return (navigator as Navigator & { usb?: USB }).usb
}

async function cleanupAfterFailedConnect(failedDevice: USBDevice | null, claimedInterfaceNumber: number | null): Promise<void> {
  if (!failedDevice) return
  if (claimedInterfaceNumber !== null) {
    try {
      await failedDevice.releaseInterface(claimedInterfaceNumber)
    } catch {
      // Best-effort — igual se intenta cerrar el dispositivo (sección 12).
    }
  }
  try {
    await failedDevice.close()
  } catch {
    // Best-effort — las referencias internas se limpian igual (sección 12).
  }
}

// ---------------------------------------------------------------------------
// Factoría del transporte (sección 9)
// ---------------------------------------------------------------------------
// Se eligió una factoría de función (no una `class`) por consistencia con el
// resto del proyecto (`src/lib/mesa-occupancy.ts`, `src/lib/thermal-print/
// escpos.ts`, etc. son módulos de funciones, sin clases de dominio). Todo el
// estado (`device`, `interfaceNumber`, etc.) vive en el closure — nunca se
// expone `USBDevice` públicamente, y código externo no tiene ninguna forma
// de escribir al dispositivo evitando `write()`.

/**
 * Crea un transporte WebUSB experimental que implementa
 * `ThermalPrinterTransport` (P3-A). Valida `options` de forma síncrona y
 * lanza inmediatamente (`TypeError`/`RangeError`) si son inválidas — nunca
 * toca `navigator.usb` en este punto. `requestDevice()` solo se llama
 * dentro de `connect()`, nunca al construir el transporte, nunca al
 * importar este módulo.
 */
export function createWebUsbThermalPrinterTransport(options: WebUsbThermalPrinterOptions): ThermalPrinterTransport {
  const validatedOptions = validateOptions(options)

  let state: ThermalPrinterTransportState = "disconnected"
  let device: USBDevice | null = null
  let interfaceNumber: number | null = null
  let alternateSetting: number | null = null
  let endpointNumber: number | null = null

  async function connect(): Promise<void> {
    if (state === "connected") return // idempotente — nunca vuelve a pedir dispositivo (sección 10.2).
    if (state === "connecting" || state === "writing") {
      throw new ThermalPrinterTransportException("unknown", "Ya hay una operación en curso en este transporte.")
    }
    // P3-B1 corrección (Defecto 4): un fallo previo (en connect() o en
    // write()) puede haber dejado `device`/`interfaceNumber`/
    // `alternateSetting`/`endpointNumber` del intento anterior todavía en
    // el closure — `state === "error"` es la única señal de que esos
    // recursos podrían no estar liberados. Reconectar directamente desde
    // "error" arriesgaba: dispositivo anterior todavía abierto, interfaz
    // anterior todavía reclamada, reemplazo silencioso de esas referencias
    // al conectar OTRO dispositivo (fuga de recursos), o referencias
    // colgantes si el nuevo selector se cancela. Se exige explícitamente
    // `disconnect()` primero — que SÍ libera/cierra/limpia todo de forma
    // segura incluso viniendo de "error" (ver disconnect(), sin cambios en
    // esa garantía) — y solo entonces, desde "disconnected", un nuevo
    // `connect()` (idealmente disparado por un nuevo gesto del usuario en
    // P3-B2) vuelve a llamar `requestDevice()`. Nunca se hace esta limpieza
    // de forma asincrónica ACÁ dentro de connect(), para no interferir con
    // el requisito de activación del usuario de un click real. Se reutiliza
    // la razón "unknown" — ninguna de las 6 razones existentes describe
    // literalmente "hay que desconectar primero", y no se agrega una nueva.
    if (state === "error") {
      throw new ThermalPrinterTransportException("unknown", "Desconectá el transporte antes de volver a conectar.")
    }

    if (typeof window === "undefined" || typeof navigator === "undefined") {
      throw new ThermalPrinterTransportException("unsupported_device", "Este entorno no soporta WebUSB (sin navegador).")
    }
    if (window.isSecureContext !== true) {
      throw new ThermalPrinterTransportException("unsupported_device", "WebUSB requiere un contexto seguro (HTTPS).")
    }
    const usb = getNavigatorUsb()
    if (!usb) {
      throw new ThermalPrinterTransportException("unsupported_device", "WebUSB no está disponible en este navegador.")
    }

    state = "connecting"

    let acquiredDevice: USBDevice | null = null
    let claimedInterfaceNumber: number | null = null

    try {
      // Única llamada real a `requestDevice()` de todo el módulo — nunca se
      // invoca en otro punto, nunca automáticamente (sección 20).
      const requestedDevice = await usb.requestDevice({ filters: validatedOptions.filters })
      acquiredDevice = requestedDevice

      if (!requestedDevice.opened) {
        await requestedDevice.open()
      }

      const configuration = findConfiguration(requestedDevice, validatedOptions.configurationValue)
      if (!requestedDevice.configuration || requestedDevice.configuration.configurationValue !== configuration.configurationValue) {
        await requestedDevice.selectConfiguration(configuration.configurationValue)
      }

      const target = resolveInterfaceTarget(configuration, validatedOptions)

      // Orden real de WebUSB: `claimInterface()` primero, DESPUÉS
      // `selectAlternateInterface()` — confirmado por auditoría de la
      // especificación WebUSB (sección 12). Nunca al revés.
      await requestedDevice.claimInterface(target.interfaceNumber)
      claimedInterfaceNumber = target.interfaceNumber

      await requestedDevice.selectAlternateInterface(target.interfaceNumber, target.alternateSetting)

      device = requestedDevice
      interfaceNumber = target.interfaceNumber
      alternateSetting = target.alternateSetting
      endpointNumber = target.endpointNumber
      state = "connected"
    } catch (error) {
      const transportError = toTransportException(error, "unknown", "No se pudo completar la conexión WebUSB.")
      await cleanupAfterFailedConnect(acquiredDevice, claimedInterfaceNumber)
      state = "error"
      throw transportError
    }
  }

  async function write(data: Uint8Array): Promise<void> {
    if (state === "connecting") {
      throw new ThermalPrinterTransportException("unknown", "Todavía se está estableciendo la conexión.")
    }
    if (state === "writing") {
      throw new ThermalPrinterTransportException("unknown", "Ya hay una escritura en curso en este transporte.")
    }
    if (state !== "connected" || !device || interfaceNumber === null || endpointNumber === null) {
      throw new ThermalPrinterTransportException("connection_lost", "El transporte no está conectado.")
    }
    if (!(data instanceof Uint8Array)) {
      throw new TypeError("write() requiere un Uint8Array")
    }
    // Payload vacío: no-op válido, nunca un error — nada que transmitir,
    // nunca se transiciona a "writing" (sección 13.5).
    if (data.length === 0) return

    // Copia defensiva: nunca se muta el `Uint8Array` del llamador, y una
    // mutación posterior del llamador sobre su propio arreglo nunca afecta
    // los chunks ya calculados acá (sección 13.6).
    const payload = data.slice()
    const activeDevice = device
    const activeEndpoint = endpointNumber

    state = "writing"
    try {
      for (let offset = 0; offset < payload.length; offset += validatedOptions.chunkSize) {
        const chunk = payload.subarray(offset, Math.min(offset + validatedOptions.chunkSize, payload.length))

        let result: USBOutTransferResult
        try {
          result = await activeDevice.transferOut(activeEndpoint, chunk)
        } catch (error) {
          throw toTransportException(error, "connection_lost", "Se perdió la conexión durante la escritura.")
        }

        if (result.status === "stall" || result.status === "babble") {
          throw new ThermalPrinterTransportException(
            "connection_lost",
            result.status === "stall"
              ? "La transferencia fue interrumpida por el dispositivo (stall)."
              : "La transferencia fue interrumpida por el dispositivo (babble)."
          )
        }
        if (result.bytesWritten !== chunk.length) {
          // Transferencia parcial: se detiene de inmediato — NUNCA se
          // reintenta el chunk fallido ni se envían los siguientes
          // (sección 15). El llamador debe asumir que el ticket no se
          // imprimió completo.
          throw new ThermalPrinterTransportException("partial_write", "El dispositivo escribió menos bytes de los esperados.")
        }
      }
      state = "connected"
    } catch (error) {
      state = "error"
      throw error instanceof ThermalPrinterTransportException ? error : toTransportException(error, "unknown", "Error inesperado durante la escritura.")
    }
  }

  // P3-B1 corrección (Defecto 4): además de su rol normal, esta función es
  // ahora la ÚNICA forma de salir de `state === "error"` (`connect()` la
  // exige explícitamente primero — ver comentario ahí). Se auditó su
  // comportamiento existente y se conserva sin cambios porque ya cumple lo
  // necesario para ese caso: intenta `releaseInterface()` y, si falla,
  // igual intenta `close()`; si `close()` también falla, igual limpia las
  // 4 referencias internas y deja `state = "disconnected"` — nunca deja un
  // estado "conectado" falso, nunca oculta el error real de forma que
  // afecte el resultado final (el estado SIEMPRE termina limpio).
  async function disconnect(): Promise<void> {
    if (state === "connecting" || state === "writing") {
      // Nunca se corta una transferencia/conexión en curso de forma
      // silenciosa (sección 19) — el llamador debe esperar a que esa
      // operación resuelva o rechace primero.
      throw new ThermalPrinterTransportException("unknown", "No se puede desconectar mientras hay una operación en curso.")
    }
    if (state === "disconnected") return // idempotente — nunca vuelve a tocar el dispositivo.

    const currentDevice = device
    const currentInterface = interfaceNumber

    if (currentDevice) {
      if (currentInterface !== null) {
        try {
          await currentDevice.releaseInterface(currentInterface)
        } catch {
          // Se intenta close() igual (sección 16) — nunca se propaga este error.
        }
      }
      try {
        await currentDevice.close()
      } catch {
        // Las referencias internas se limpian igual (sección 16) — nunca se propaga este error.
      }
    }

    device = null
    interfaceNumber = null
    alternateSetting = null
    endpointNumber = null
    state = "disconnected"
  }

  return Object.freeze({
    kind: "webusb" as const,
    get state() {
      return state
    },
    connect,
    write,
    disconnect,
  })
}
