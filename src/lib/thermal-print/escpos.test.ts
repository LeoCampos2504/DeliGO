/// <reference types="bun-types" />
import { describe, test, expect, afterEach } from "bun:test"
import { sanitizeText, wrapText, formatNameAmountLine, makeDivider, padLeft } from "./text-layout"
import {
  buildEscPosTicket,
  formatCurrencyForTicket,
  formatDateForTicket,
  PAPER_PROFILE_58MM,
  PAPER_PROFILE_80MM,
  PAPER_PROFILE_NO_CUT,
} from "./escpos"
import { detectThermalPrinterCapabilities } from "./browser-capabilities"
import type { ThermalTicket } from "./types"

// ============================================
// DeliGO — Tests permanentes: layout, ESC/POS y capacidades (P3-A, grupos B-E)
// ============================================
// Puros: sin DB, sin red, sin React. Ejecutables con `bun test` directo.
// Los tests de capacidades manipulan `globalThis.window`/`globalThis.navigator`
// manualmente (Bun no los define por defecto — eso mismo es lo que prueba el
// caso "SSR sin window") y los restauran en `afterEach`, sin dejar estado
// entre tests.

function countByte(bytes: Uint8Array, value: number): number {
  let count = 0
  for (const byte of bytes) if (byte === value) count++
  return count
}

// Solo para BUSCAR subcadenas de texto legible en la salida en tests de
// integración (nunca para medir anchos exactos de línea — eso se hace
// directamente sobre las funciones puras de `text-layout.ts`). Los bytes de
// comando (ESC/GS + su byte de datos) son todos < 0x7F igual que el texto,
// por lo que decodificar byte a char es una forma válida de confirmar que
// una subcadena de TEXTO contiguo (como "CANCELADO") sigue intacta.
function rawDecode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("")
}

const SAMPLE_TICKET: ThermalTicket = {
  negocio: { nombre: "Restaurante Demo" },
  mesa: { numero: 5 },
  ocupacion: { iniciadaEn: "2026-08-05T18:00:00.000Z", cerradaEn: null, estado: "activa" },
  pedidos: [
    {
      numero: 1,
      fecha: "2026-08-05T18:10:00.000Z",
      cancelado: false,
      pendiente: false,
      items: [
        {
          cantidad: 2,
          nombre: "Hamburguesa",
          subtotal: 2000,
          agregados: ["Queso"],
          secciones: [],
          ingredientesQuitados: ["Cebolla"],
          talle: "",
          color: "",
        },
      ],
      subtotal: 2000,
    },
  ],
  totalGeneral: 2000,
  leyenda: "vista_previa",
}

// ---------------------------------------------------------------------------
// Grupo C — Seguridad: sanitizeText (casos 26-32)
// ---------------------------------------------------------------------------
describe("P3-A — sanitizeText (grupo C: seguridad)", () => {
  test("26. Texto con byte ESC (0x1B) -> se elimina, nunca sobrevive", () => {
    const result = sanitizeText("Pizza\x1Bxx")
    expect(result.includes("\x1B")).toBe(false)
    expect(result).toBe("Pizzaxx")
  })

  test("27. Texto con saltos múltiples -> se normalizan a un único espacio", () => {
    expect(sanitizeText("Linea1\n\n\nLinea2")).toBe("Linea1 Linea2")
  })

  test("28. Texto con tabulaciones -> se normalizan a espacio", () => {
    expect(sanitizeText("A\tB")).toBe("A B")
  })

  test("29. Texto con secuencias que parecen comandos ESC/POS -> los bytes de control desaparecen, solo queda texto literal inofensivo", () => {
    const result = sanitizeText("\x1B@INIT\x1DV\x00CUT")
    expect(result.includes("\x1B")).toBe(false)
    expect(result.includes("\x1D")).toBe(false)
    expect(result.includes("\x00")).toBe(false)
    expect(result).toBe("@INITVCUT")
  })

  test("30. Texto con NUL (0x00) -> se elimina sin reemplazo visible", () => {
    expect(sanitizeText("A\x00B")).toBe("AB")
  })

  test("31. Texto con GS (0x1D) -> se elimina sin reemplazo visible", () => {
    expect(sanitizeText("A\x1DB")).toBe("AB")
  })

  test("32. Texto con emoji -> se reemplaza por '?' (carácter no soportado), nunca se deja crudo", () => {
    expect(sanitizeText("Pizza 🍕")).toBe("Pizza ?")
  })

  test("Caracteres acentuados/ñ se transliteran a ASCII (á/é/í/ó/ú/ü/ñ)", () => {
    expect(sanitizeText("Ñoquis con salsa á é í ó ú ü")).toBe("Noquis con salsa a e i o u u")
  })

  test("BEL (0x07) y otros C0/C1 también se eliminan (sin reemplazo visible, a diferencia de \\f/\\v que se normalizan a espacio)", () => {
    expect(sanitizeText("A\x07\x1fB")).toBe("AB")
  })

  test("Entrada no-string o vacía -> cadena vacía, nunca excepción", () => {
    expect(sanitizeText(undefined)).toBe("")
    expect(sanitizeText(null)).toBe("")
    expect(sanitizeText(42)).toBe("")
    expect(sanitizeText("")).toBe("")
  })
})

// ---------------------------------------------------------------------------
// Grupo B — Formato: helpers puros de layout
// ---------------------------------------------------------------------------
describe("P3-A — helpers de layout (grupo B: formato)", () => {
  test("15. Nombre largo se envuelve sin superar el ancho configurado", () => {
    const lines = wrapText("Hamburguesa completa con doble cheddar y panceta ahumada", 20)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(20)
  })

  test("16. Importe largo -> la línea de importe puede superar el ancho (excepción documentada), nunca se trunca el valor", () => {
    const lines = formatNameAmountLine("Item", "$1.234.567.890,00", 10)
    const amountLine = lines[lines.length - 1]
    expect(amountLine).toContain("1.234.567.890,00")
  })

  test("18. Líneas dentro del ancho: nombre corto + importe corto -> una sola línea que respeta el ancho", () => {
    const [line] = formatNameAmountLine("Cafe", "$500,00", 32)
    expect(line.length).toBeLessThanOrEqual(32)
    expect(line.startsWith("Cafe")).toBe(true)
    expect(line.endsWith("$500,00")).toBe(true)
  })

  test("22. Separadores con ancho exacto (58mm y 80mm)", () => {
    expect(makeDivider(PAPER_PROFILE_58MM.columnas)).toBe("-".repeat(32))
    expect(makeDivider(PAPER_PROFILE_80MM.columnas)).toBe("-".repeat(48))
  })

  test("23. Nombre e importe que no caben juntos -> el nombre se envuelve y el importe queda en su propia línea, alineado a la derecha", () => {
    const lines = formatNameAmountLine("Hamburguesa completa con extras", "$1.000,00", 20)
    expect(lines.length).toBeGreaterThan(1)
    const lastLine = lines[lines.length - 1]
    expect(lastLine.trimEnd().endsWith("$1.000,00")).toBe(true)
    expect(lastLine.length).toBeLessThanOrEqual(20)
  })

  test("24. Total que no puede entrar junto a la etiqueta -> el importe nunca se pierde, aunque la línea final exceda el ancho", () => {
    const lines = formatNameAmountLine("TOTAL", "$999.999.999,99", 8)
    const lastLine = lines[lines.length - 1]
    expect(lastLine).toContain("999.999.999,99")
  })

  test("Producto sin personalización -> arreglo de personalizaciones sería vacío (wrapText de cadena vacía)", () => {
    expect(wrapText("", 32)).toEqual([])
  })

  test("Cantidad de dos o más dígitos no rompe el formateo de columnas", () => {
    const [line] = formatNameAmountLine("12x Empanada", "$6.000,00", 32)
    expect(line.startsWith("12x Empanada")).toBe(true)
  })

  test("padLeft nunca trunca ni usa ancho negativo", () => {
    expect(padLeft("$1,00", -5)).toBe("$1,00")
    expect(padLeft("$1,00", 3)).toBe("$1,00")
    expect(padLeft("$1,00", 10).length).toBe(10)
  })

  test("formatCurrencyForTicket produce separador de miles y coma decimal, ASCII puro", () => {
    expect(formatCurrencyForTicket(1234567.5)).toBe("$1.234.567,50")
    expect(formatCurrencyForTicket(0)).toBe("$0,00")
    expect(formatCurrencyForTicket(Number.NaN)).toBe("$0,00")
  })

  test("formatDateForTicket es determinista y nunca produce 'Invalid Date'", () => {
    expect(formatDateForTicket("")).toBe("")
    expect(formatDateForTicket("no-es-una-fecha")).toBe("")
    expect(formatDateForTicket("2026-08-05T18:30:00.000Z")).not.toContain("Invalid")
  })
})

// ---------------------------------------------------------------------------
// Grupo B (integración) — perfiles de papel y estados visuales
// ---------------------------------------------------------------------------
describe("P3-A — buildEscPosTicket (grupo B: perfiles e integración)", () => {
  test("13. Papel 58 mm genera bytes válidos sin excepción", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    expect(bytes.length).toBeGreaterThan(0)
  })

  test("14. Papel 80 mm genera bytes válidos sin excepción", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_80MM)
    expect(bytes.length).toBeGreaterThan(0)
  })

  test("19. Total destacado: negrita se activa inmediatamente antes de la línea de TOTAL", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    const text = rawDecode(bytes)
    const totalIndex = text.indexOf("TOTAL")
    const boldOnIndex = text.lastIndexOf("\x1B\x45\x01", totalIndex)
    expect(boldOnIndex).toBeGreaterThan(-1)
    expect(boldOnIndex).toBeLessThan(totalIndex)
  })

  test("20. Pedido cancelado queda identificado como 'CANCELADO' en el ticket", () => {
    const ticket: ThermalTicket = {
      ...SAMPLE_TICKET,
      pedidos: [{ ...SAMPLE_TICKET.pedidos[0], cancelado: true, pendiente: false }],
    }
    const text = rawDecode(buildEscPosTicket(ticket, PAPER_PROFILE_58MM))
    expect(text).toContain("CANCELADO")
  })

  test("21. Pedido pendiente queda identificado como 'PENDIENTE' en el ticket, nunca como entregado", () => {
    const ticket: ThermalTicket = {
      ...SAMPLE_TICKET,
      pedidos: [{ ...SAMPLE_TICKET.pedidos[0], cancelado: false, pendiente: true }],
    }
    const text = rawDecode(buildEscPosTicket(ticket, PAPER_PROFILE_58MM))
    expect(text).toContain("PENDIENTE")
    expect(text).not.toContain("ENTREGADO")
  })

  test("25. Ticket sin pedidos genera bytes válidos con un mensaje explícito, nunca una excepción", () => {
    const ticket: ThermalTicket = { ...SAMPLE_TICKET, pedidos: [], totalGeneral: 0 }
    const text = rawDecode(buildEscPosTicket(ticket, PAPER_PROFILE_58MM))
    expect(text).toContain("no tiene pedidos")
  })

  test("17. Varias personalizaciones (agregado + ingrediente quitado) aparecen en el ticket", () => {
    const text = rawDecode(buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_80MM))
    expect(text).toContain("Queso")
    expect(text).toContain("Cebolla")
  })
})

// ---------------------------------------------------------------------------
// Grupo D — Bytes (casos 35-44)
// ---------------------------------------------------------------------------
describe("P3-A — buildEscPosTicket (grupo D: bytes)", () => {
  test("35. La salida es un Uint8Array real", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  test("36. Inicia con el comando de inicialización esperado (ESC @)", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    expect(bytes[0]).toBe(0x1b)
    expect(bytes[1]).toBe(0x40)
  })

  test("37. Termina con los avances configurados y el corte del perfil", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    const tail = Array.from(bytes.slice(-6))
    expect(tail).toEqual([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00])
  })

  test("38. Mismo input produce mismos bytes (determinismo)", () => {
    const bytesA = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    const bytesB = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    expect(Array.from(bytesA)).toEqual(Array.from(bytesB))
  })

  test("39. Perfil sin corte no emite el comando de corte (GS V)", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_NO_CUT)
    expect(countByte(bytes, 0x1d)).toBe(0)
  })

  test("40. Perfil con corte sí emite exactamente un comando de corte (GS V)", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    expect(countByte(bytes, 0x1d)).toBe(1)
  })

  test("41. Negrita se activa y se desactiva la misma cantidad de veces (nunca queda encendida)", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    const text = rawDecode(bytes)
    const boldOnCount = text.split("\x1B\x45\x01").length - 1
    const boldOffCount = text.split("\x1B\x45\x00").length - 1
    expect(boldOnCount).toBe(boldOffCount)
    expect(boldOnCount).toBeGreaterThan(0)
  })

  test("42. Alineación centrada siempre vuelve a alineación izquierda después", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    const text = rawDecode(bytes)
    const centerCount = text.split("\x1B\x61\x01").length - 1
    const leftCount = text.split("\x1B\x61\x00").length - 1
    expect(centerCount).toBe(leftCount)
    // La ÚLTIMA alineación antes del corte final debe ser izquierda, nunca
    // queda centrada de forma abierta.
    const lastCenter = text.lastIndexOf("\x1B\x61\x01")
    const lastLeft = text.lastIndexOf("\x1B\x61\x00")
    expect(lastLeft).toBeGreaterThan(lastCenter)
  })

  test("43. No quedan comandos abiertos al final: el último byte es siempre el byte final de un comando/LF completo", () => {
    const withCut = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_58MM)
    expect(withCut[withCut.length - 1]).toBe(0x00) // último byte de GS V 0x00 (corte completo)

    const withoutCut = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_NO_CUT)
    expect(withoutCut[withoutCut.length - 1]).toBe(0x0a) // último byte es LF, nunca un ESC/GS colgante
  })

  test("44. No existen valores fuera de 0-255 en la salida", () => {
    const bytes = buildEscPosTicket(SAMPLE_TICKET, PAPER_PROFILE_80MM)
    for (const byte of bytes) {
      expect(byte).toBeGreaterThanOrEqual(0)
      expect(byte).toBeLessThanOrEqual(255)
      expect(Number.isInteger(byte)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Grupo C (continuación) — Seguridad estructural del generador (casos 33-34)
// ---------------------------------------------------------------------------
describe("P3-A — buildEscPosTicket (grupo C: seguridad estructural)", () => {
  // Con exactamente 1 pedido en el ticket, la cantidad de bytes ESC (0x1B)
  // emitidos por el ESQUELETO fijo del generador es siempre 9 (INIT x1,
  // ALIGN_CENTER x2, ALIGN_LEFT x2, BOLD_ON x2, BOLD_OFF x2) — NINGUNA de
  // esas emisiones depende del contenido de `nombre`/`agregados`/etc. Si un
  // texto malicioso pudiera inyectar un ESC/GS real, este conteo subiría
  // por encima del esperado — la prueba falla si eso ocurre.
  const EXPECTED_ESC_COUNT_ONE_PEDIDO = 9

  test("33. Solo el generador emite comandos de control: el conteo de ESC (0x1B) es el esperado del esqueleto fijo, sin importar el contenido del ticket", () => {
    const maliciousTicket: ThermalTicket = {
      ...SAMPLE_TICKET,
      negocio: { nombre: "\x1B@\x1BEHACKED\x1B" },
      pedidos: [
        {
          ...SAMPLE_TICKET.pedidos[0],
          items: [
            {
              cantidad: 1,
              nombre: "\x1B\x40\x1B\x45\x01Producto\x1B",
              subtotal: 100,
              agregados: ["\x1BGS\x1D"],
              secciones: ["\x1BSeccion"],
              ingredientesQuitados: ["\x1BIngrediente"],
              talle: "\x1BM",
              color: "\x1BRojo",
            },
          ],
          subtotal: 100,
        },
      ],
    }
    const bytes = buildEscPosTicket(maliciousTicket, PAPER_PROFILE_58MM)
    expect(countByte(bytes, 0x1b)).toBe(EXPECTED_ESC_COUNT_ONE_PEDIDO)
  })

  test("34. Texto externo no puede agregar un comando de corte adicional: el conteo de GS (0x1D) sigue determinado únicamente por el perfil", () => {
    const maliciousTicket: ThermalTicket = {
      ...SAMPLE_TICKET,
      negocio: { nombre: "\x1DV\x00\x1DV\x01intento de corte" },
    }
    const bytesWithCut = buildEscPosTicket(maliciousTicket, PAPER_PROFILE_58MM)
    expect(countByte(bytesWithCut, 0x1d)).toBe(1)

    const bytesNoCut = buildEscPosTicket(maliciousTicket, PAPER_PROFILE_NO_CUT)
    expect(countByte(bytesNoCut, 0x1d)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Grupo E — Capacidades del navegador (casos 45-54)
// ---------------------------------------------------------------------------
describe("P3-A — detectThermalPrinterCapabilities (grupo E: capacidades)", () => {
  afterEach(() => {
    // @ts-expect-error -- limpieza de globals de prueba, nunca queda estado entre tests.
    delete globalThis.window
    // @ts-expect-error -- idem.
    delete globalThis.navigator
  })

  function setBrowserEnv(options: { usb?: unknown; serial?: unknown; secureContext?: boolean }) {
    // @ts-expect-error -- entorno de prueba mínimo, nunca usado fuera de este archivo.
    globalThis.window = { isSecureContext: options.secureContext ?? true }
    const navigatorStub: Record<string, unknown> = {}
    if (options.usb !== undefined) navigatorStub.usb = options.usb
    if (options.serial !== undefined) navigatorStub.serial = options.serial
    // @ts-expect-error -- idem.
    globalThis.navigator = navigatorStub
  }

  test("45. SSR sin `window` (entorno real de este test runner) -> todo false, nunca lanza", () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined")
    const result = detectThermalPrinterCapabilities()
    expect(result).toEqual({
      webUsbSupported: false,
      webSerialSupported: false,
      secureContext: false,
      directPrintingPotentiallyAvailable: false,
    })
  })

  test("46. Navegador sin WebUSB ni Web Serial -> ambos false", () => {
    setBrowserEnv({ secureContext: true })
    const result = detectThermalPrinterCapabilities()
    expect(result.webUsbSupported).toBe(false)
    expect(result.webSerialSupported).toBe(false)
    expect(result.directPrintingPotentiallyAvailable).toBe(false)
  })

  test("47. Solo WebUSB disponible -> webUsbSupported true, directPrinting potencialmente disponible", () => {
    setBrowserEnv({ usb: {}, secureContext: true })
    const result = detectThermalPrinterCapabilities()
    expect(result.webUsbSupported).toBe(true)
    expect(result.webSerialSupported).toBe(false)
    expect(result.directPrintingPotentiallyAvailable).toBe(true)
  })

  test("48. Solo Web Serial disponible -> webSerialSupported true, directPrinting potencialmente disponible", () => {
    setBrowserEnv({ serial: {}, secureContext: true })
    const result = detectThermalPrinterCapabilities()
    expect(result.webSerialSupported).toBe(true)
    expect(result.webUsbSupported).toBe(false)
    expect(result.directPrintingPotentiallyAvailable).toBe(true)
  })

  test("49. Ambas APIs disponibles -> ambas true", () => {
    setBrowserEnv({ usb: {}, serial: {}, secureContext: true })
    const result = detectThermalPrinterCapabilities()
    expect(result.webUsbSupported).toBe(true)
    expect(result.webSerialSupported).toBe(true)
    expect(result.directPrintingPotentiallyAvailable).toBe(true)
  })

  test("50. Contexto no seguro -> directPrintingPotentiallyAvailable siempre false, aunque existan las APIs", () => {
    setBrowserEnv({ usb: {}, serial: {}, secureContext: false })
    const result = detectThermalPrinterCapabilities()
    expect(result.secureContext).toBe(false)
    expect(result.directPrintingPotentiallyAvailable).toBe(false)
  })

  test("51/52. Ningún detector solicita permisos ni llama requestDevice — si lo hiciera, este stub lanzaría", () => {
    let requestDeviceCalled = false
    setBrowserEnv({
      usb: {
        requestDevice: () => {
          requestDeviceCalled = true
          throw new Error("requestDevice nunca debe ser llamado por la detección de capacidades")
        },
      },
      secureContext: true,
    })
    expect(() => detectThermalPrinterCapabilities()).not.toThrow()
    expect(requestDeviceCalled).toBe(false)
  })

  test("53. Ningún detector llama requestPort — si lo hiciera, este stub lanzaría", () => {
    let requestPortCalled = false
    setBrowserEnv({
      serial: {
        requestPort: () => {
          requestPortCalled = true
          throw new Error("requestPort nunca debe ser llamado por la detección de capacidades")
        },
      },
      secureContext: true,
    })
    expect(() => detectThermalPrinterCapabilities()).not.toThrow()
    expect(requestPortCalled).toBe(false)
  })

  test("54. La función nunca lanza por propiedades ausentes (navigator sin isSecureContext, sin usb/serial)", () => {
    // @ts-expect-error -- entorno de prueba deliberadamente incompleto.
    globalThis.window = {}
    // @ts-expect-error -- idem.
    globalThis.navigator = {}
    expect(() => detectThermalPrinterCapabilities()).not.toThrow()
    const result = detectThermalPrinterCapabilities()
    expect(result.secureContext).toBe(false)
    expect(result.webUsbSupported).toBe(false)
    expect(result.webSerialSupported).toBe(false)
  })
})
