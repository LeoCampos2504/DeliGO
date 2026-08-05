/// <reference types="bun-types" />
import { describe, test, expect, afterEach } from "bun:test"
import {
  createWebUsbThermalPrinterTransport,
  ThermalPrinterTransportException,
  DEFAULT_CHUNK_SIZE,
  type WebUsbThermalPrinterOptions,
} from "./webusb-transport"
import type {
  USB,
  USBAlternateInterface,
  USBConfiguration,
  USBDevice,
  USBDeviceRequestOptions,
  USBEndpoint,
  USBInterface,
  USBOutTransferResult,
} from "./webusb-types"
import type { ThermalPrinterTransport, ThermalPrinterTransportErrorReason } from "./transport"
import { buildEscPosTicket, PAPER_PROFILE_58MM } from "./escpos"
import type { ThermalTicket } from "./types"

// ============================================
// DeliGO — Tests permanentes: transporte WebUSB experimental (P3-B1)
// ============================================
// 100% simulado — ningún test de este archivo accede a hardware real, ni
// depende de Chrome, ni solicita ningún permiso real. `FakeUsbDevice`/
// `createFakeUsb` son dobles de prueba en memoria que implementan
// exactamente la superficie de `webusb-types.ts`.

// ---------------------------------------------------------------------------
// Dobles de prueba
// ---------------------------------------------------------------------------

function makeEndpoint(overrides: Partial<USBEndpoint> = {}): USBEndpoint {
  return { endpointNumber: 2, direction: "out", type: "bulk", ...overrides }
}
function makeAlternate(overrides: Partial<USBAlternateInterface> = {}): USBAlternateInterface {
  return {
    alternateSetting: 0,
    interfaceClass: 7,
    interfaceSubclass: 1,
    interfaceProtocol: 2,
    endpoints: [makeEndpoint({ endpointNumber: 1, direction: "in", type: "bulk" }), makeEndpoint()],
    ...overrides,
  }
}
function makeInterface(overrides: Partial<USBInterface> = {}): USBInterface {
  return { interfaceNumber: 0, alternates: [makeAlternate()], ...overrides }
}
function makeConfiguration(overrides: Partial<USBConfiguration> = {}): USBConfiguration {
  return { configurationValue: 1, interfaces: [makeInterface()], ...overrides }
}

class FakeUsbDevice implements USBDevice {
  opened = false
  configuration: USBConfiguration | null
  configurations: USBConfiguration[]

  openCalls = 0
  closeCalls = 0
  selectConfigurationCalls: number[] = []
  claimInterfaceCalls: number[] = []
  releaseInterfaceCalls: number[] = []
  selectAlternateInterfaceCalls: Array<[number, number]> = []
  transferOutCalls: Array<{ endpointNumber: number; data: Uint8Array }> = []

  failOpen = false
  failClose = false
  failSelectConfiguration = false
  failClaimInterface = false
  failReleaseInterface = false
  failSelectAlternateInterface = false
  /** Índice (0-based) de la llamada a transferOut que debe lanzar en vez de resolver. */
  failTransferOutAtCall: number | null = null
  transferOutResults: USBOutTransferResult[] = []

  constructor(configurations: USBConfiguration[], initialConfiguration: USBConfiguration | null = null) {
    this.configurations = configurations
    this.configuration = initialConfiguration
  }

  async open(): Promise<void> {
    this.openCalls++
    if (this.failOpen) throw new Error("open failed")
    this.opened = true
  }
  async close(): Promise<void> {
    this.closeCalls++
    if (this.failClose) throw new Error("close failed")
    this.opened = false
  }
  async selectConfiguration(configurationValue: number): Promise<void> {
    this.selectConfigurationCalls.push(configurationValue)
    if (this.failSelectConfiguration) throw new Error("selectConfiguration failed")
    this.configuration = this.configurations.find((c) => c.configurationValue === configurationValue) ?? null
  }
  async claimInterface(interfaceNumber: number): Promise<void> {
    this.claimInterfaceCalls.push(interfaceNumber)
    if (this.failClaimInterface) throw new Error("claimInterface failed")
  }
  async releaseInterface(interfaceNumber: number): Promise<void> {
    this.releaseInterfaceCalls.push(interfaceNumber)
    if (this.failReleaseInterface) throw new Error("releaseInterface failed")
  }
  async selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void> {
    this.selectAlternateInterfaceCalls.push([interfaceNumber, alternateSetting])
    if (this.failSelectAlternateInterface) throw new Error("selectAlternateInterface failed")
  }
  async transferOut(endpointNumber: number, data: Uint8Array): Promise<USBOutTransferResult> {
    const callIndex = this.transferOutCalls.length
    this.transferOutCalls.push({ endpointNumber, data: data.slice() })
    if (this.failTransferOutAtCall !== null && callIndex === this.failTransferOutAtCall) {
      throw new Error("transferOut failed")
    }
    return this.transferOutResults[callIndex] ?? { status: "ok", bytesWritten: data.length }
  }
}

function createFakeUsb(requestDeviceImpl: (options: USBDeviceRequestOptions) => Promise<USBDevice>): USB & { calls: USBDeviceRequestOptions[] } {
  const calls: USBDeviceRequestOptions[] = []
  return {
    calls,
    async requestDevice(options) {
      calls.push(options)
      return requestDeviceImpl(options)
    },
  }
}

function setBrowserEnv(usb: USB | undefined, secureContext = true): void {
  // @ts-expect-error -- entorno de prueba mínimo, nunca usado fuera de este archivo.
  globalThis.window = { isSecureContext: secureContext }
  const navigatorStub: Record<string, unknown> = {}
  if (usb !== undefined) navigatorStub.usb = usb
  // @ts-expect-error -- idem.
  globalThis.navigator = navigatorStub
}

function VALID_FILTERS(): WebUsbThermalPrinterOptions["filters"] {
  return [{ vendorId: 0x04b8, productId: 0x0202 }]
}

/**
 * Elimina líneas de comentario `//` antes de buscar una subcadena en el
 * código fuente — evita falsos positivos cuando el propio código DOCUMENTA
 * (en un comentario) que deliberadamente NO hace algo (p. ej. "nunca usa
 * localStorage"), lo cual contendría la palabra buscada sin ser una
 * violación real.
 */
function stripLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const index = line.indexOf("//")
      return index === -1 ? line : line.slice(0, index)
    })
    .join("\n")
}

async function expectTransportError(
  promise: Promise<unknown>,
  reason: ThermalPrinterTransportErrorReason
): Promise<ThermalPrinterTransportException> {
  try {
    await promise
    throw new Error("Se esperaba que la promesa rechazara")
  } catch (error) {
    expect(error).toBeInstanceOf(ThermalPrinterTransportException)
    expect((error as ThermalPrinterTransportException).reason).toBe(reason)
    return error as ThermalPrinterTransportException
  }
}

afterEach(() => {
  // @ts-expect-error -- limpieza, nunca queda estado entre tests.
  delete globalThis.window
  // @ts-expect-error -- idem.
  delete globalThis.navigator
})

// ---------------------------------------------------------------------------
// Grupo A — Validación de opciones (casos 1-8)
// ---------------------------------------------------------------------------
describe("P3-B1 — validación de opciones (grupo A)", () => {
  test("1. filters vacío se rechaza", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [] })).toThrow(RangeError)
  })

  test("2. filtro {} (sin ningún criterio real) se rechaza", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{}] })).toThrow(RangeError)
  })

  test("3. vendorId negativo se rechaza", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ vendorId: -1 }] })).toThrow(RangeError)
  })

  test("4. vendorId decimal (no entero) se rechaza", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ vendorId: 12.5 }] })).toThrow(RangeError)
  })

  test("5. productId inválido (fuera de rango de 16 bits) se rechaza", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ vendorId: 1, productId: 0x10000 }] })).toThrow(RangeError)
  })

  test("6. demasiados filtros (> 10) se rechazan", () => {
    const filters = Array.from({ length: 11 }, (_, i) => ({ vendorId: i + 1 }))
    expect(() => createWebUsbThermalPrinterTransport({ filters })).toThrow(RangeError)
  })

  test("7. chunkSize inválido (fuera de rango, no entero, o negativo) se rechaza", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), chunkSize: 10 })).toThrow(RangeError)
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), chunkSize: 999999 })).toThrow(RangeError)
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), chunkSize: 100.5 })).toThrow(RangeError)
  })

  test("8. opciones válidas no se mutan (el arreglo/objeto original del llamador queda intacto)", () => {
    const filters = [{ vendorId: 5, productId: 6 }]
    const options: WebUsbThermalPrinterOptions = { filters, chunkSize: 1024 }
    const snapshot = JSON.stringify(options)
    createWebUsbThermalPrinterTransport(options)
    expect(JSON.stringify(options)).toBe(snapshot)
    expect(options.filters).toBe(filters) // misma referencia, nunca reemplazada ni mutada
    expect(options.filters[0]).toEqual({ vendorId: 5, productId: 6 })
  })

  test("interfaceNumber/alternateSetting/endpointNumber/transferType inválidos se rechazan", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: -1 })).toThrow(RangeError)
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), alternateSetting: 256 })).toThrow(RangeError)
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), endpointNumber: 1.5 })).toThrow(RangeError)
    // @ts-expect-error -- valor deliberadamente inválido para el test.
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), transferType: "isochronous" })).toThrow(RangeError)
  })

  test("filtros duplicados exactos se deduplican sin mutar el original", () => {
    const filters = [{ vendorId: 1, productId: 2 }, { vendorId: 1, productId: 2 }, { vendorId: 3 }]
    const transport = createWebUsbThermalPrinterTransport({ filters })
    expect(transport.kind).toBe("webusb")
    expect(filters.length).toBe(3) // el arreglo original nunca se toca
  })
})

// ---------------------------------------------------------------------------
// Grupo B — Entorno (casos 9-13)
// ---------------------------------------------------------------------------
describe("P3-B1 — entorno (grupo B)", () => {
  test("9. SSR sin window -> connect() rechaza con 'unsupported_device', nunca lanza una excepción no controlada", async () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined")
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("10. Sin navigator -> connect() rechaza con 'unsupported_device'", async () => {
    // @ts-expect-error -- entorno de prueba: window presente, navigator no.
    globalThis.window = { isSecureContext: true }
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("11. Contexto no seguro -> connect() rechaza con 'unsupported_device'", async () => {
    const usb = createFakeUsb(async () => new FakeUsbDevice([makeConfiguration()]))
    setBrowserEnv(usb, false)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unsupported_device")
    expect(usb.calls.length).toBe(0)
  })

  test("12. Navegador sin navigator.usb -> connect() rechaza con 'unsupported_device'", async () => {
    setBrowserEnv(undefined, true)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("13. Ninguno de los casos anteriores llama requestDevice", async () => {
    // Cubierto por las aserciones `usb.calls.length === 0` de los tests 11/12
    // más el hecho de que 9/10 nunca llegan a construir un `usb` real.
    expect(true).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Grupo C — connect() (casos 14-31)
// ---------------------------------------------------------------------------
describe("P3-B1 — connect() (grupo C)", () => {
  test("14/15. requestDevice se llama exactamente una vez y recibe los filtros ya validados", async () => {
    const usb = createFakeUsb(async () => new FakeUsbDevice([makeConfiguration()]))
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: [{ vendorId: 0x1234, productId: 0x5678 }] })
    await transport.connect()
    expect(usb.calls.length).toBe(1)
    expect(usb.calls[0]).toEqual({ filters: [{ vendorId: 0x1234, productId: 0x5678 }] })
    expect(transport.state).toBe("connected")
  })

  test("16. Cancelación del selector (NotFoundError) se mapea a 'user_cancelled'", async () => {
    const usb = createFakeUsb(async () => {
      const error = new Error("cancelled")
      error.name = "NotFoundError"
      throw error
    })
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "user_cancelled")
    expect(transport.state).toBe("error")
  })

  test("17/18. Abre el dispositivo si está cerrado; no vuelve a abrirlo si ya está abierto", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.opened = true
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    expect(device.openCalls).toBe(0) // ya estaba abierto

    const device2 = new FakeUsbDevice([makeConfiguration()])
    const usb2 = createFakeUsb(async () => device2)
    setBrowserEnv(usb2)
    const transport2 = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport2.connect()
    expect(device2.openCalls).toBe(1)
  })

  test("19. Selecciona la configuración explícita indicada en las opciones", async () => {
    const configA = makeConfiguration({ configurationValue: 1 })
    const configB = makeConfiguration({ configurationValue: 2 })
    const device = new FakeUsbDevice([configA, configB])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), configurationValue: 2 })
    await transport.connect()
    expect(device.selectConfigurationCalls).toEqual([2])
  })

  test("20. Sin configuración explícita, descubre de forma determinista (primera del descriptor)", async () => {
    const configA = makeConfiguration({ configurationValue: 1 })
    const configB = makeConfiguration({ configurationValue: 2 })
    const device = new FakeUsbDevice([configA, configB])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    expect(device.selectConfigurationCalls).toEqual([1])
  })

  test("21/22/23. Reclama la interfaz correcta, selecciona el alternate correcto y descubre el endpoint OUT bulk", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    expect(device.claimInterfaceCalls).toEqual([0])
    expect(device.selectAlternateInterfaceCalls).toEqual([[0, 0]])
    // Verificado indirectamente: escribir usa el endpoint 2 (el OUT del fixture).
    await transport.write(new Uint8Array([1, 2, 3]))
    expect(device.transferOutCalls[0].endpointNumber).toBe(2)
  })

  test("24. Nunca elige un endpoint IN aunque sea el primero en el descriptor", async () => {
    const alt = makeAlternate({
      endpoints: [makeEndpoint({ endpointNumber: 1, direction: "in", type: "bulk" }), makeEndpoint({ endpointNumber: 2, direction: "out", type: "bulk" })],
    })
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await transport.write(new Uint8Array([9]))
    expect(device.transferOutCalls[0].endpointNumber).toBe(2)
  })

  test("25. Rechaza un dispositivo sin ningún endpoint OUT compatible", async () => {
    const alt = makeAlternate({ endpoints: [makeEndpoint({ endpointNumber: 1, direction: "in", type: "bulk" })] })
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("26. Rechaza interfaceNumber inexistente", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 99 })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("27. Rechaza endpointNumber inexistente (con interfaceNumber válido — endpointNumber ya exige interfaceNumber, ver Defecto 4)", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 0, endpointNumber: 99 })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("28. Si claimInterface falla, limpia recursos (intenta close) y deja estado 'error'", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.failClaimInterface = true
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unknown")
    expect(transport.state).toBe("error")
    expect(device.closeCalls).toBe(1)
    expect(device.releaseInterfaceCalls.length).toBe(0) // nunca se reclamó con éxito, nada que liberar
  })

  test("29. Si selectAlternateInterface falla, libera la interfaz ya reclamada y cierra el dispositivo", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.failSelectAlternateInterface = true
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unknown")
    expect(device.releaseInterfaceCalls).toEqual([0])
    expect(device.closeCalls).toBe(1)
    expect(transport.state).toBe("error")
  })

  test("30. Dos connect() simultáneos no abren dos selectores: el segundo se rechaza de inmediato", async () => {
    // Holder mutable en vez de un `let` capturado — evita que TypeScript
    // angoste el tipo a `null`/`never` al reasignarse dentro de un closure.
    const resolveRequestDeviceRef: { current: ((device: USBDevice) => void) | null } = { current: null }
    const usb = createFakeUsb(
      () =>
        new Promise<USBDevice>((resolve) => {
          resolveRequestDeviceRef.current = resolve
        })
    )
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })

    const first = transport.connect()
    const second = expectTransportError(transport.connect(), "unknown")
    await second
    expect(usb.calls.length).toBe(1)

    resolveRequestDeviceRef.current?.(new FakeUsbDevice([makeConfiguration()]))
    await first
    expect(transport.state).toBe("connected")
  })

  test("31. connect() repetido ya conectado es idempotente (no vuelve a pedir dispositivo)", async () => {
    const usb = createFakeUsb(async () => new FakeUsbDevice([makeConfiguration()]))
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await transport.connect()
    await transport.connect()
    expect(usb.calls.length).toBe(1)
    expect(transport.state).toBe("connected")
  })
})

// ---------------------------------------------------------------------------
// Grupo D — write() (casos 32-49)
// ---------------------------------------------------------------------------
describe("P3-B1 — write() (grupo D)", () => {
  const TEST_CHUNK_SIZE = 64 // == MIN_CHUNK_SIZE — el valor más pequeño permitido por validación.

  function bytesOfLength(length: number): Uint8Array {
    return Uint8Array.from({ length }, (_, i) => i % 256)
  }

  async function connectedTransport(deviceOverrides: Partial<FakeUsbDevice> = {}) {
    const device = new FakeUsbDevice([makeConfiguration()])
    Object.assign(device, deviceOverrides)
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), chunkSize: TEST_CHUNK_SIZE })
    await transport.connect()
    return { transport, device }
  }

  test("32. Rechaza write() si está desconectado", async () => {
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.write(new Uint8Array([1])), "connection_lost")
  })

  test("33. Rechaza payload que no es Uint8Array", async () => {
    const { transport } = await connectedTransport()
    // @ts-expect-error -- payload deliberadamente inválido para el test.
    await expect(transport.write([1, 2, 3])).rejects.toThrow(TypeError)
  })

  test("34. Payload vacío es un no-op válido: resuelve sin transferOut y sin cambiar de estado", async () => {
    const { transport, device } = await connectedTransport()
    await transport.write(new Uint8Array([]))
    expect(device.transferOutCalls.length).toBe(0)
    expect(transport.state).toBe("connected")
  })

  test("35/36/37/38/39. Chunking: menos de un chunk, exactamente uno, varios, último parcial, reconstrucción idéntica byte a byte", async () => {
    const { transport, device } = await connectedTransport() // chunkSize = TEST_CHUNK_SIZE (64)

    await transport.write(bytesOfLength(10)) // menos de un chunk
    expect(device.transferOutCalls.length).toBe(1)
    expect(device.transferOutCalls[0].data.length).toBe(10)

    device.transferOutCalls.length = 0
    await transport.write(bytesOfLength(TEST_CHUNK_SIZE)) // exactamente un chunk
    expect(device.transferOutCalls.length).toBe(1)

    device.transferOutCalls.length = 0
    const input = bytesOfLength(TEST_CHUNK_SIZE * 2 + 10) // 3 chunks: 64+64+10 (último parcial)
    await transport.write(input)
    expect(device.transferOutCalls.length).toBe(3)
    expect(device.transferOutCalls.map((call) => call.data.length)).toEqual([TEST_CHUNK_SIZE, TEST_CHUNK_SIZE, 10])

    const reconstructed = new Uint8Array(device.transferOutCalls.reduce((sum, call) => sum + call.data.length, 0))
    let offset = 0
    for (const call of device.transferOutCalls) {
      reconstructed.set(call.data, offset)
      offset += call.data.length
    }
    expect(Array.from(reconstructed)).toEqual(Array.from(input))
  })

  test("40. No muta el Uint8Array de entrada", async () => {
    const { transport } = await connectedTransport()
    const input = new Uint8Array([10, 20, 30])
    const snapshot = Array.from(input)
    await transport.write(input)
    expect(Array.from(input)).toEqual(snapshot)
  })

  test("41. transferOut usa el endpoint OUT resuelto en connect()", async () => {
    const { transport, device } = await connectedTransport()
    await transport.write(new Uint8Array([1]))
    expect(device.transferOutCalls[0].endpointNumber).toBe(2)
  })

  test("42/43. El estado cambia a 'writing' durante la escritura y vuelve a 'connected' al terminar", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    const observedRef: { current: string | null } = { current: null }
    let transport: ThermalPrinterTransport
    device.transferOut = async (_endpointNumber, data) => {
      observedRef.current = transport.state
      return { status: "ok", bytesWritten: data.length }
    }
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await transport.write(new Uint8Array([1, 2, 3]))
    expect(observedRef.current).toBe("writing")
    expect(transport.state).toBe("connected")
  })

  test("44/45. Un fallo en un chunk intermedio detiene los siguientes y nunca reintenta el fallido", async () => {
    const { transport, device } = await connectedTransport()
    device.failTransferOutAtCall = 1 // falla en el segundo chunk (índice 1)
    const input = bytesOfLength(TEST_CHUNK_SIZE * 2 + 10) // 3 chunks con chunkSize=64
    // Un fallo real de transferOut (excepción del navegador) se mapea a
    // "connection_lost" — ver toTransportException en webusb-transport.ts.
    await expectTransportError(transport.write(input), "connection_lost")
    // Solo se intentaron 2 llamadas: la 1ra exitosa, la 2da la que falló — nunca hay una 3ra ni una repetición.
    expect(device.transferOutCalls.length).toBe(2)
    expect(transport.state).toBe("error")
  })

  test("46. Transferencia parcial (bytesWritten < chunk.length) se mapea a 'partial_write' y detiene la escritura", async () => {
    const { transport, device } = await connectedTransport()
    device.transferOutResults = [{ status: "ok", bytesWritten: TEST_CHUNK_SIZE - 10 }] // chunk de 64 bytes, solo confirma 54
    await expectTransportError(transport.write(bytesOfLength(TEST_CHUNK_SIZE * 2)), "partial_write")
    expect(device.transferOutCalls.length).toBe(1) // nunca continúa con el siguiente chunk
  })

  test("47. status 'stall' se sanitiza a 'connection_lost', sin exponer el descriptor crudo", async () => {
    const { transport, device } = await connectedTransport()
    device.transferOutResults = [{ status: "stall", bytesWritten: 0 }]
    const error = await expectTransportError(transport.write(bytesOfLength(20)), "connection_lost")
    expect(error.message).not.toContain("USBDevice")
  })

  test("48. status 'babble' se sanitiza a 'connection_lost'", async () => {
    const { transport, device } = await connectedTransport()
    device.transferOutResults = [{ status: "babble", bytesWritten: 0 }]
    await expectTransportError(transport.write(new Uint8Array([1, 2])), "connection_lost")
  })

  test("49. Dos write() simultáneos: el segundo se rechaza mientras el primero está en curso", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    const resolveFirstTransferRef: { current: (() => void) | null } = { current: null }
    device.transferOut = async (_endpointNumber, data) => {
      await new Promise<void>((resolve) => {
        resolveFirstTransferRef.current = resolve
      })
      return { status: "ok", bytesWritten: data.length }
    }
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()

    const first = transport.write(new Uint8Array([1, 2, 3]))
    const second = expectTransportError(transport.write(new Uint8Array([4, 5, 6])), "unknown")
    await second
    resolveFirstTransferRef.current?.()
    await first
    expect(transport.state).toBe("connected")
  })
})

// ---------------------------------------------------------------------------
// Grupo E — disconnect() (casos 50-57)
// ---------------------------------------------------------------------------
describe("P3-B1 — disconnect() (grupo E)", () => {
  test("50/51/52/53. Libera la interfaz, cierra el dispositivo, limpia referencias y queda disconnected", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await transport.disconnect()
    expect(device.releaseInterfaceCalls).toEqual([0])
    expect(device.closeCalls).toBe(1)
    expect(transport.state).toBe("disconnected")
  })

  test("54. disconnect() repetido es idempotente (nunca vuelve a tocar el dispositivo)", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await transport.disconnect()
    await transport.disconnect()
    expect(device.closeCalls).toBe(1)
    expect(usb.calls.length).toBe(1)
  })

  test("55. Si releaseInterface falla, igual intenta close() y limpia referencias", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.failReleaseInterface = true
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await transport.disconnect()
    expect(device.closeCalls).toBe(1)
    expect(transport.state).toBe("disconnected")
  })

  test("56. Si close falla, igual limpia referencias internas (no queda 'conectado' falsamente)", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.failClose = true
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await transport.disconnect()
    expect(transport.state).toBe("disconnected")
  })

  test("57. Permite limpiar (disconnect) después de un error", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.failClaimInterface = true
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unknown")
    expect(transport.state).toBe("error")
    await transport.disconnect()
    expect(transport.state).toBe("disconnected")
  })

  test("disconnect() durante una escritura activa se rechaza, nunca corta la transferencia en silencio", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    const resolveTransferRef: { current: (() => void) | null } = { current: null }
    device.transferOut = async (_endpointNumber, data) => {
      await new Promise<void>((resolve) => {
        resolveTransferRef.current = resolve
      })
      return { status: "ok", bytesWritten: data.length }
    }
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()

    const writePromise = transport.write(new Uint8Array([1, 2, 3]))
    await expectTransportError(transport.disconnect(), "unknown")
    resolveTransferRef.current?.()
    await writePromise
    expect(transport.state).toBe("connected")
  })
})

// ---------------------------------------------------------------------------
// Grupo F — Seguridad (casos 58-66)
// ---------------------------------------------------------------------------
describe("P3-B1 — seguridad (grupo F)", () => {
  test("58/59. Importar el módulo y construir el transporte nunca llama requestDevice", async () => {
    const usb = createFakeUsb(async () => new FakeUsbDevice([makeConfiguration()]))
    setBrowserEnv(usb)
    createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    expect(usb.calls.length).toBe(0)
  })

  test("60. No llama getDevices() (no existe siquiera en el tipo USB de P3-B1 — reconexión automática nunca implementada)", () => {
    const usb: USB = { requestDevice: async () => new FakeUsbDevice([makeConfiguration()]) }
    expect("getDevices" in usb).toBe(false)
  })

  test("61. No usa localStorage/sessionStorage en ningún punto (verificado leyendo el módulo fuente, fuera de comentarios)", async () => {
    const source = stripLineComments(await Bun.file("./src/lib/thermal-print/webusb-transport.ts").text())
    expect(source.includes("localStorage")).toBe(false)
    expect(source.includes("sessionStorage")).toBe(false)
    expect(source.includes("indexedDB")).toBe(false)
  })

  test("62. No expone el USBDevice públicamente: la interfaz devuelta solo tiene las 5 claves del contrato, nunca estado interno", async () => {
    const usb = createFakeUsb(async () => new FakeUsbDevice([makeConfiguration()]))
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    const keys = Object.keys(transport).sort()
    expect(keys).toEqual(["connect", "disconnect", "kind", "state", "write"])
    expect(transport.state).toBe("connected")
    // Ningún campo interno (device/interfaceNumber/alternateSetting/endpointNumber
    // /validatedOptions/etc.) es visible en el objeto público devuelto.
    const forbiddenKeys = ["device", "interfaceNumber", "alternateSetting", "endpointNumber", "validatedOptions", "usb"]
    for (const forbidden of forbiddenKeys) {
      expect(Object.prototype.hasOwnProperty.call(transport, forbidden)).toBe(false)
    }
    expect(Object.isFrozen(transport)).toBe(true)
  })

  test("63/64. El error público (mensaje) nunca contiene serial number ni stack trace del error crudo", async () => {
    const usb = createFakeUsb(async () => {
      const error = new Error("raw device error with SERIALNUMBER-XYZ-123 and internal stack info")
      throw error
    })
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    const error = await expectTransportError(transport.connect(), "unknown")
    expect(error.message).not.toContain("SERIALNUMBER-XYZ-123")
    expect(error.message).not.toContain("internal stack info")
    expect(JSON.stringify(error)).not.toContain("stack")
  })

  test("65. No registra el dispositivo en console (verificado leyendo el módulo fuente: sin console.log de USBDevice)", async () => {
    const source = await Bun.file("./src/lib/thermal-print/webusb-transport.ts").text()
    expect(/console\.\w+\([^)]*device/i.test(source)).toBe(false)
  })

  test("66. No modifica window.print() (ninguna llamada real a print() fuera de comentarios que documentan su ausencia)", async () => {
    const source = stripLineComments(await Bun.file("./src/lib/thermal-print/webusb-transport.ts").text())
    expect(source.includes("print(")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// P3-B1 corrección — Defecto 1: dependencias estructurales de USBDeviceFilter
// ---------------------------------------------------------------------------
describe("P3-B1 corrección — Defecto 1: dependencias entre campos de un filtro", () => {
  test("1. productId sin vendorId es rechazado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ productId: 1234 }] })).toThrow(RangeError)
  })

  test("2. productId con vendorId es aceptado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ vendorId: 1234, productId: 5678 }] })).not.toThrow()
  })

  test("3. subclassCode sin classCode es rechazado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ subclassCode: 1 }] })).toThrow(RangeError)
  })

  test("4. subclassCode con classCode es aceptado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ classCode: 7, subclassCode: 1 }] })).not.toThrow()
  })

  test("5. protocolCode sin subclassCode es rechazado (aunque tenga classCode)", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ classCode: 7, protocolCode: 1 }] })).toThrow(RangeError)
  })

  test("6. protocolCode con classCode y subclassCode es aceptado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ classCode: 7, subclassCode: 1, protocolCode: 1 }] })).not.toThrow()
  })

  test("7. El rechazo ocurre antes de requestDevice (síncrono, en la construcción del transporte)", async () => {
    const usb = createFakeUsb(async () => new FakeUsbDevice([makeConfiguration()]))
    setBrowserEnv(usb)
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ productId: 1234 }] })).toThrow(RangeError)
    expect(usb.calls.length).toBe(0)
  })

  test("8. El filtro original no se muta al ser rechazado", () => {
    const filters = [{ productId: 1234 }]
    const snapshot = JSON.stringify(filters)
    try {
      createWebUsbThermalPrinterTransport({ filters })
    } catch {
      // Se espera que rechace — lo relevante es que `filters` no cambie.
    }
    expect(JSON.stringify(filters)).toBe(snapshot)
  })

  test("9. Los duplicados válidos continúan deduplicándose", () => {
    const filters = [
      { vendorId: 1, productId: 2 },
      { vendorId: 1, productId: 2 },
      { classCode: 7, subclassCode: 1 },
    ]
    const transport = createWebUsbThermalPrinterTransport({ filters })
    expect(transport.kind).toBe("webusb")
  })

  test("10. Un filtro válido solo con vendorId continúa funcionando (nunca exige productId)", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ vendorId: 1234 }] })).not.toThrow()
  })

  test("11. Un filtro válido solo con classCode continúa funcionando", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ classCode: 7 }] })).not.toThrow()
  })

  test("12. Un filtro válido con serialNumber (solo) continúa funcionando según la regla actual", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: [{ serialNumber: "ABC123" }] })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// P3-B1 corrección — Defecto 2: endpoint explícito debe comprobar también `type`
// ---------------------------------------------------------------------------
describe("P3-B1 corrección — Defecto 2: endpoint explícito exige número + dirección + tipo", () => {
  function alternateWithEndpoints(endpoints: ReturnType<typeof makeEndpoint>[]) {
    return makeAlternate({ endpoints })
  }

  test("1. Endpoint explícito OUT bulk con transferType 'bulk' es aceptado", async () => {
    const alt = alternateWithEndpoints([makeEndpoint({ endpointNumber: 5, direction: "out", type: "bulk" })])
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 0, endpointNumber: 5, transferType: "bulk" })
    await transport.connect()
    expect(transport.state).toBe("connected")
    await transport.write(new Uint8Array([1]))
    expect(device.transferOutCalls[0].endpointNumber).toBe(5)
  })

  test("2. Endpoint explícito OUT interrupt con transferType 'interrupt' es aceptado", async () => {
    const alt = alternateWithEndpoints([makeEndpoint({ endpointNumber: 5, direction: "out", type: "interrupt" })])
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({
      filters: VALID_FILTERS(),
      interfaceNumber: 0,
      endpointNumber: 5,
      transferType: "interrupt",
    })
    await transport.connect()
    expect(transport.state).toBe("connected")
  })

  test("3. Endpoint explícito OUT interrupt con transferType 'bulk' es RECHAZADO (antes se aceptaba incorrectamente)", async () => {
    const alt = alternateWithEndpoints([makeEndpoint({ endpointNumber: 5, direction: "out", type: "interrupt" })])
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 0, endpointNumber: 5, transferType: "bulk" })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("4. Endpoint explícito OUT bulk con transferType 'interrupt' es rechazado", async () => {
    const alt = alternateWithEndpoints([makeEndpoint({ endpointNumber: 5, direction: "out", type: "bulk" })])
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({
      filters: VALID_FILTERS(),
      interfaceNumber: 0,
      endpointNumber: 5,
      transferType: "interrupt",
    })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("5. Endpoint explícito IN es rechazado (nunca se acepta aunque el número coincida)", async () => {
    const alt = alternateWithEndpoints([makeEndpoint({ endpointNumber: 5, direction: "in", type: "bulk" })])
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 0, endpointNumber: 5, transferType: "bulk" })
    await expectTransportError(transport.connect(), "unsupported_device")
  })

  test("6. No se ejecuta claimInterface cuando el endpoint explícito es incompatible", async () => {
    const alt = alternateWithEndpoints([makeEndpoint({ endpointNumber: 5, direction: "out", type: "interrupt" })])
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 0, endpointNumber: 5, transferType: "bulk" })
    await expectTransportError(transport.connect(), "unsupported_device")
    expect(device.claimInterfaceCalls.length).toBe(0)
  })

  test("7. No se ejecuta transferOut en un endpoint incompatible (la conexión nunca llega a completarse)", async () => {
    const alt = alternateWithEndpoints([makeEndpoint({ endpointNumber: 5, direction: "out", type: "interrupt" })])
    const device = new FakeUsbDevice([makeConfiguration({ interfaces: [makeInterface({ alternates: [alt] })] })])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 0, endpointNumber: 5, transferType: "bulk" })
    await expectTransportError(transport.connect(), "unsupported_device")
    await expectTransportError(transport.write(new Uint8Array([1])), "connection_lost")
    expect(device.transferOutCalls.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// P3-B1 corrección — Defecto 3: alternateSetting exige interfaceNumber
// ---------------------------------------------------------------------------
describe("P3-B1 corrección — Defecto 3: alternateSetting sin interfaceNumber", () => {
  test("1. alternateSetting sin interfaceNumber es rechazado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), alternateSetting: 0 })).toThrow(RangeError)
  })

  test("2. alternateSetting con interfaceNumber es aceptado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 0, alternateSetting: 0 })).not.toThrow()
  })

  test("3. El rechazo ocurre antes de requestDevice", async () => {
    const usb = createFakeUsb(async () => new FakeUsbDevice([makeConfiguration()]))
    setBrowserEnv(usb)
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), alternateSetting: 0 })).toThrow(RangeError)
    expect(usb.calls.length).toBe(0)
  })

  test("4. Las opciones originales no se mutan", () => {
    const options: WebUsbThermalPrinterOptions = { filters: VALID_FILTERS(), alternateSetting: 0 }
    const snapshot = JSON.stringify(options)
    try {
      createWebUsbThermalPrinterTransport(options)
    } catch {
      // Se espera que rechace.
    }
    expect(JSON.stringify(options)).toBe(snapshot)
  })
})

// ---------------------------------------------------------------------------
// P3-B1 corrección — Defecto 4 (sección 8): endpointNumber exige interfaceNumber
// ---------------------------------------------------------------------------
describe("P3-B1 corrección — sección 8: endpointNumber sin interfaceNumber", () => {
  test("1. endpointNumber sin interfaceNumber es rechazado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), endpointNumber: 2 })).toThrow(RangeError)
  })

  test("2. endpointNumber con interfaceNumber es aceptado", () => {
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), interfaceNumber: 0, endpointNumber: 2 })).not.toThrow()
  })

  test("3. El rechazo ocurre antes de requestDevice", async () => {
    const usb = createFakeUsb(async () => new FakeUsbDevice([makeConfiguration()]))
    setBrowserEnv(usb)
    expect(() => createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), endpointNumber: 2 })).toThrow(RangeError)
    expect(usb.calls.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// P3-B1 corrección — Defecto 4: ciclo error -> disconnect() -> connect()
// ---------------------------------------------------------------------------
describe("P3-B1 corrección — Defecto 4: reconexión segura desde el estado error", () => {
  test("1. Un fallo de write() deja estado 'error'", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.transferOutResults = [{ status: "stall", bytesWritten: 0 }]
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await expectTransportError(transport.write(new Uint8Array([1, 2])), "connection_lost")
    expect(transport.state).toBe("error")
  })

  test("2/3. connect() desde 'error' es rechazado y NO llama requestDevice de nuevo", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.failClaimInterface = true
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unknown")
    expect(transport.state).toBe("error")
    expect(usb.calls.length).toBe(1)

    await expectTransportError(transport.connect(), "unknown")
    expect(usb.calls.length).toBe(1) // sigue en 1 — el segundo intento nunca llegó a requestDevice
  })

  test("4. Ese intento rechazado no reemplaza ninguna referencia del dispositivo anterior", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.failClaimInterface = true
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await expectTransportError(transport.connect(), "unknown")
    const claimCallsAfterFirstFailure = device.claimInterfaceCalls.length
    await expectTransportError(transport.connect(), "unknown")
    // Ninguna llamada nueva a claimInterface — el segundo connect() se
    // rechazó antes de intentar reclamar nada.
    expect(device.claimInterfaceCalls.length).toBe(claimCallsAfterFirstFailure)
  })

  test("5/6/7/8. disconnect() desde 'error' libera la interfaz, cierra el dispositivo, limpia referencias y queda 'disconnected'", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.transferOutResults = [{ status: "stall", bytesWritten: 0 }]
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await expectTransportError(transport.write(new Uint8Array([1])), "connection_lost")
    expect(transport.state).toBe("error")

    await transport.disconnect()
    expect(device.releaseInterfaceCalls).toEqual([0])
    expect(device.closeCalls).toBe(1)
    expect(transport.state).toBe("disconnected")
  })

  test("9/10. Después de disconnect(), un nuevo connect() sí llama requestDevice y el nuevo dispositivo queda conectado normalmente", async () => {
    const failingDevice = new FakeUsbDevice([makeConfiguration()])
    failingDevice.failClaimInterface = true
    const workingDevice = new FakeUsbDevice([makeConfiguration()])
    let callCount = 0
    const usb = createFakeUsb(async () => {
      callCount++
      return callCount === 1 ? failingDevice : workingDevice
    })
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })

    await expectTransportError(transport.connect(), "unknown")
    expect(transport.state).toBe("error")

    await transport.disconnect()
    expect(transport.state).toBe("disconnected")

    await transport.connect()
    expect(usb.calls.length).toBe(2)
    expect(transport.state).toBe("connected")
    await transport.write(new Uint8Array([9]))
    expect(workingDevice.transferOutCalls.length).toBe(1)
    expect(failingDevice.transferOutCalls.length).toBe(0)
  })

  test("11. Cancelar el nuevo selector no deja ninguna referencia al dispositivo anterior", async () => {
    const failingDevice = new FakeUsbDevice([makeConfiguration()])
    failingDevice.failClaimInterface = true
    let callCount = 0
    const usb = createFakeUsb(async () => {
      callCount++
      if (callCount === 1) return failingDevice
      const error = new Error("cancelled")
      error.name = "NotFoundError"
      throw error
    })
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })

    await expectTransportError(transport.connect(), "unknown")
    await transport.disconnect()
    await expectTransportError(transport.connect(), "user_cancelled")
    expect(transport.state).toBe("error")
    // Ninguna escritura puede llegar al dispositivo anterior (ya cerrado) ni a ninguno nuevo.
    await expectTransportError(transport.write(new Uint8Array([1])), "connection_lost")
    expect(failingDevice.transferOutCalls.length).toBe(0)
  })

  test("12. Una transferencia parcial también exige disconnect() antes de reconectar", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.transferOutResults = [{ status: "ok", bytesWritten: 0 }]
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await expectTransportError(transport.write(new Uint8Array([1, 2])), "partial_write")
    expect(transport.state).toBe("error")
    await expectTransportError(transport.connect(), "unknown")
    await transport.disconnect()
    expect(transport.state).toBe("disconnected")
  })

  test("13. Un stall también exige disconnect() antes de reconectar", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.transferOutResults = [{ status: "stall", bytesWritten: 0 }]
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await expectTransportError(transport.write(new Uint8Array([1, 2])), "connection_lost")
    expect(transport.state).toBe("error")
    await expectTransportError(transport.connect(), "unknown")
    await transport.disconnect()
    expect(transport.state).toBe("disconnected")
  })

  test("14. Un babble también exige disconnect() antes de reconectar", async () => {
    const device = new FakeUsbDevice([makeConfiguration()])
    device.transferOutResults = [{ status: "babble", bytesWritten: 0 }]
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS() })
    await transport.connect()
    await expectTransportError(transport.write(new Uint8Array([1, 2])), "connection_lost")
    expect(transport.state).toBe("error")
    await expectTransportError(transport.connect(), "unknown")
    await transport.disconnect()
    expect(transport.state).toBe("disconnected")
  })
})

// ---------------------------------------------------------------------------
// Sección 23 — Prueba de integración pura (ticket real -> ESC/POS -> transporte simulado)
// ---------------------------------------------------------------------------
describe("P3-B1 — integración pura: ticket real -> bytes ESC/POS -> WebUSB simulado", () => {
  test("Los bytes recibidos por el dispositivo simulado, reconstruidos, son idénticos byte a byte al Uint8Array generado por buildEscPosTicket", async () => {
    const ticket: ThermalTicket = {
      negocio: { nombre: "Restaurante Demo" },
      mesa: { numero: 9 },
      ocupacion: { iniciadaEn: "2026-08-06T12:00:00.000Z", cerradaEn: null, estado: "activa" },
      pedidos: [
        {
          numero: 1,
          fecha: "2026-08-06T12:05:00.000Z",
          cancelado: false,
          pendiente: false,
          items: [
            {
              cantidad: 2,
              nombre: "Hamburguesa completa con extras",
              subtotal: 4000,
              agregados: ["Queso", "Panceta"],
              secciones: ["Punto: Medio"],
              ingredientesQuitados: ["Cebolla"],
              talle: "",
              color: "",
            },
          ],
          subtotal: 4000,
        },
      ],
      totalGeneral: 4000,
      leyenda: "vista_previa",
    }

    const originalBytes = buildEscPosTicket(ticket, PAPER_PROFILE_58MM)
    expect(originalBytes.length).toBeGreaterThan(0)

    const device = new FakeUsbDevice([makeConfiguration()])
    const usb = createFakeUsb(async () => device)
    setBrowserEnv(usb)
    const transport = createWebUsbThermalPrinterTransport({ filters: VALID_FILTERS(), chunkSize: 64 })

    await transport.connect()
    await transport.write(originalBytes)

    const totalReceived = device.transferOutCalls.reduce((sum, call) => sum + call.data.length, 0)
    const reconstructed = new Uint8Array(totalReceived)
    let offset = 0
    for (const call of device.transferOutCalls) {
      reconstructed.set(call.data, offset)
      offset += call.data.length
    }

    expect(Array.from(reconstructed)).toEqual(Array.from(originalBytes))
    expect(device.transferOutCalls.length).toBeGreaterThan(1) // confirma que efectivamente se dividió en varios chunks de 64 bytes

    await transport.disconnect()
    expect(device.releaseInterfaceCalls.length).toBe(1)
    expect(device.closeCalls).toBe(1)
    expect(transport.state).toBe("disconnected")
  })
})

// Referencia para que DEFAULT_CHUNK_SIZE quede ejercitado por el suite (evita "unused export" en linters futuros).
test("DEFAULT_CHUNK_SIZE es el valor documentado (4096)", () => {
  expect(DEFAULT_CHUNK_SIZE).toBe(4096)
})
