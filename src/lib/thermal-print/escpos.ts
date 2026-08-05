// ============================================
// DeliGO — Generador ESC/POS puro (P3-A)
// ============================================
// Traduce un `ThermalTicket` (modelo puro, ver `types.ts`) a una secuencia
// de bytes ESC/POS determinista: misma entrada + mismo perfil -> mismos
// bytes, siempre. Este módulo NUNCA abre WebUSB/Web Serial, NUNCA escribe en
// hardware, NUNCA solicita permisos — solo construye un `Uint8Array` en
// memoria. La conexión real a una impresora queda para una etapa futura
// (P3-B/P3-C, ver CODEX_REPORT.md).
//
// Todos los bytes de CONTROL (inicialización, alineación, negrita, corte)
// están centralizados en las constantes de abajo — nunca se generan a
// partir de texto externo. El único texto que se convierte a bytes es el ya
// sanitizado por `text-layout.ts` (`sanitizeText`), que garantiza que ningún
// carácter fuera de 0x20-0x7E (imprimible ASCII) llegue a `textToBytes` —
// por lo tanto ESC (0x1B), GS (0x1D) y el resto de los controles nunca
// pueden originarse en `nombre`/`agregados`/`secciones`/etc.

import type { ThermalPaperProfile, ThermalTicket, ThermalTicketPedido } from "./types"
import { formatNameAmountLine, indentLines, makeDivider, sanitizeText, wrapText } from "./text-layout"

// ---------------------------------------------------------------------------
// Comandos ESC/POS centralizados (sección 8) — ningún número mágico disperso
// ---------------------------------------------------------------------------

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

/** ESC @ — reinicializa la impresora a su estado por defecto. */
const CMD_INIT: readonly number[] = [ESC, 0x40]
/** ESC a 0 — alineación izquierda. */
const CMD_ALIGN_LEFT: readonly number[] = [ESC, 0x61, 0x00]
/** ESC a 1 — alineación centrada. */
const CMD_ALIGN_CENTER: readonly number[] = [ESC, 0x61, 0x01]
/** ESC E 1 — negrita activada. */
const CMD_BOLD_ON: readonly number[] = [ESC, 0x45, 0x01]
/** ESC E 0 — negrita desactivada. */
const CMD_BOLD_OFF: readonly number[] = [ESC, 0x45, 0x00]
/**
 * GS V — corte de papel. `0x00` = corte completo, `0x01` = corte parcial.
 * Convención común (familia Epson TM-T/similares) — NO universal: el
 * comando de corte real varía entre fabricantes/firmwares (ver riesgos en
 * CODEX_REPORT.md). `escpos.ts` nunca afirma que un perfil concreto cortará
 * físicamente en un modelo no probado.
 */
function cmdCut(mode: "full" | "partial"): readonly number[] {
  return [GS, 0x56, mode === "full" ? 0x00 : 0x01]
}
const CMD_LF: readonly number[] = [LF]

// ---------------------------------------------------------------------------
// Perfiles de papel de referencia (sección 7) — valores iniciales, NUNCA una
// garantía universal. La cantidad real de columnas que entran en una línea
// depende de la fuente configurada, la densidad de impresión, el modelo de
// impresora, el firmware y el modo de caracteres activo.
// ---------------------------------------------------------------------------

export const PAPER_PROFILE_58MM: ThermalPaperProfile = {
  id: "58mm",
  nombre: "58 mm (referencia, no garantizado)",
  anchoMm: 58,
  columnas: 32,
  saltosAntesDeCorte: 3,
  corte: "full",
  estrategiaCaracteresNoSoportados: "transliterate-ascii",
  encoding: "ascii-safe",
}

export const PAPER_PROFILE_80MM: ThermalPaperProfile = {
  id: "80mm",
  nombre: "80 mm (referencia, no garantizado)",
  anchoMm: 80,
  columnas: 48,
  saltosAntesDeCorte: 3,
  corte: "full",
  estrategiaCaracteresNoSoportados: "transliterate-ascii",
  encoding: "ascii-safe",
}

/** Perfil neutral para pruebas/vista previa sin corte físico (útil cuando no se conoce el hardware real). */
export const PAPER_PROFILE_NO_CUT: ThermalPaperProfile = {
  ...PAPER_PROFILE_80MM,
  id: "no-cut",
  nombre: "80 mm sin corte automático",
  corte: "none",
}

function textLine(bytes: number[], text: string): void {
  for (const char of sanitizeText(text)) {
    bytes.push(char.codePointAt(0) ?? 0x3f)
  }
  bytes.push(...CMD_LF)
}

function pedidoEstadoSufijo(pedido: ThermalTicketPedido): string {
  if (pedido.cancelado) return " - CANCELADO"
  if (pedido.pendiente) return " - PENDIENTE"
  return ""
}

/**
 * Formato de fecha propio del ticket, determinista y ASCII puro
 * (YYYY-MM-DD HH:mm) — deliberadamente NO usa `toLocaleString`/`Intl`
 * (cuyo resultado exacto puede variar entre entornos de ejecución sin ICU
 * completo). Usa la zona horaria local del entorno donde se genera el
 * ticket, igual que el resto de la app (`formatFechaHora` en
 * `MesaCuentaDialog`). Fecha inválida o vacía -> cadena vacía, nunca
 * `"Invalid Date"` ni una excepción.
 */
export function formatDateForTicket(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Construye el cuerpo de un pedido dentro del ticket: encabezado con
 * correlativo/fecha/estado, cada ítem con nombre+cantidad+importe alineado,
 * personalizaciones indentadas debajo, y el subtotal del pedido. Nunca
 * imprime IDs internos — solo el correlativo `pedido.numero` dentro de este
 * ticket.
 */
function writePedido(bytes: number[], pedido: ThermalTicketPedido, columnas: number): void {
  const fecha = formatDateForTicket(pedido.fecha)
  textLine(bytes, `Pedido ${pedido.numero}${fecha ? ` - ${fecha}` : ""}${pedidoEstadoSufijo(pedido)}`)

  for (const item of pedido.items) {
    const nombre = `${item.cantidad}x ${item.nombre}`
    const importe = formatCurrencyForTicket(item.subtotal)
    for (const line of formatNameAmountLine(nombre, importe, columnas)) {
      textLine(bytes, line)
    }

    const personalizaciones: string[] = []
    if (item.agregados.length > 0) personalizaciones.push(`+ ${item.agregados.join(", ")}`)
    for (const seccion of item.secciones) personalizaciones.push(seccion)
    if (item.ingredientesQuitados.length > 0) {
      personalizaciones.push(`Sin: ${item.ingredientesQuitados.join(", ")}`)
    }
    const talleColor = [item.talle, item.color].filter((value) => value.trim().length > 0).join(" - ")
    if (talleColor) personalizaciones.push(talleColor)

    for (const linea of personalizaciones) {
      for (const wrapped of indentLines(wrapText(linea, columnas - 2), 2)) {
        textLine(bytes, wrapped)
      }
    }
  }

  const subtotalImporte = formatCurrencyForTicket(pedido.subtotal)
  for (const line of formatNameAmountLine("Subtotal pedido", subtotalImporte, columnas)) {
    textLine(bytes, line)
  }
}

/**
 * Formato de moneda propio del ticket térmico — deliberadamente NO reutiliza
 * `formatPrice` (que usa `Intl.NumberFormat`, cuyo símbolo/espacio no
 * separable depende del entorno de ejecución y no es ASCII puro). Este
 * formateador es determinista y ya produce solo caracteres ASCII seguros
 * (dígitos, coma, punto, "$"), sin pasar por `sanitizeText` para el símbolo
 * — aunque de todas formas sería inocuo si se sanitizara.
 */
export function formatCurrencyForTicket(amount: number): string {
  const safeAmount = typeof amount === "number" && Number.isFinite(amount) ? amount : 0
  const fixed = safeAmount.toFixed(2)
  const [integerPart, decimalPart] = fixed.split(".")
  const isNegative = integerPart.startsWith("-")
  const digits = isNegative ? integerPart.slice(1) : integerPart
  const withThousands = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${isNegative ? "-" : ""}$${withThousands},${decimalPart}`
}

/**
 * Genera los bytes ESC/POS de un ticket completo. Determinista: la misma
 * combinación de `ticket` + `profile` produce siempre el mismo `Uint8Array`
 * — no depende de `Date.now()`, `Math.random()` ni ningún estado externo
 * (las fechas ya vienen resueltas dentro de `ticket`).
 */
export function buildEscPosTicket(ticket: ThermalTicket, profile: ThermalPaperProfile): Uint8Array {
  const columnas = Math.max(8, profile.columnas)
  const bytes: number[] = []

  bytes.push(...CMD_INIT)
  bytes.push(...CMD_ALIGN_CENTER)
  bytes.push(...CMD_BOLD_ON)
  for (const line of wrapText(ticket.negocio.nombre, columnas)) {
    textLine(bytes, line)
  }
  bytes.push(...CMD_BOLD_OFF)
  textLine(bytes, `Mesa ${ticket.mesa.numero}`)
  textLine(bytes, `Apertura: ${formatDateForTicket(ticket.ocupacion.iniciadaEn)}`)
  if (ticket.ocupacion.cerradaEn) {
    textLine(bytes, `Cierre: ${formatDateForTicket(ticket.ocupacion.cerradaEn)}`)
  }
  bytes.push(...CMD_ALIGN_LEFT)
  textLine(bytes, makeDivider(columnas))

  if (ticket.pedidos.length === 0) {
    textLine(bytes, "Esta ocupacion no tiene pedidos.")
  }

  for (const pedido of ticket.pedidos) {
    writePedido(bytes, pedido, columnas)
    textLine(bytes, makeDivider(columnas))
  }

  bytes.push(...CMD_BOLD_ON)
  for (const line of formatNameAmountLine("TOTAL", formatCurrencyForTicket(ticket.totalGeneral), columnas)) {
    textLine(bytes, line)
  }
  bytes.push(...CMD_BOLD_OFF)

  bytes.push(...CMD_ALIGN_CENTER)
  textLine(bytes, ticket.leyenda === "cuenta_cerrada" ? "Cuenta cerrada" : "Vista previa")
  bytes.push(...CMD_ALIGN_LEFT)

  for (let i = 0; i < Math.max(0, profile.saltosAntesDeCorte); i++) {
    bytes.push(...CMD_LF)
  }
  if (profile.corte !== "none") {
    bytes.push(...cmdCut(profile.corte))
  }

  return Uint8Array.from(bytes)
}
