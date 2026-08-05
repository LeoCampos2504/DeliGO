// ============================================
// DeliGO — Ajuste de texto para ticket térmico (P3-A)
// ============================================
// Helpers puros de layout de texto monoespaciado. Sin DOM, sin React, sin
// bytes ESC/POS — `escpos.ts` es el único módulo que traduce las líneas
// producidas acá a comandos de impresora. Ninguna función de este archivo
// escribe ni conoce el hardware.
//
// Garantía de seguridad central de P3-A: `sanitizeText` es la ÚNICA puerta
// de entrada de texto proveniente de datos de negocio/producto hacia el
// ticket — reduce cualquier cadena a un subconjunto ASCII imprimible
// (0x20-0x7E). Como ESC (0x1B), GS (0x1D), NUL (0x00), BEL (0x07) y el resto
// de los controles C0/C1 (0x00-0x1F, 0x7F, 0x80-0x9F) quedan TODOS fuera de
// ese rango, ningún texto externo puede sobrevivir como un byte de control
// real — los únicos bytes de control que puede emitir el generador
// (`escpos.ts`) son los que ese mismo módulo agrega explícitamente, nunca
// los que vengan de `nombre`, `agregados`, `secciones`, etc.

// Reemplazos de puntuación "tipográfica" que la normalización Unicode (NFKD)
// no reduce a ASCII por sí sola — aplicados ANTES de normalizar/filtrar.
const PUNCTUATION_FALLBACK: ReadonlyArray<readonly [string, string]> = [
  ["‘", "'"], // '
  ["’", "'"], // '
  ["“", '"'], // "
  ["”", '"'], // "
  ["–", "-"], // en dash
  ["—", "-"], // em dash
  ["…", "..."], // …
  [" ", " "], // espacio no separable (Intl.NumberFormat es-AR lo usa entre "$" y el número)
]

// Saltos de línea, tabulaciones y otros espacios de control se normalizan a
// un único espacio — nunca se eliminan sin dejar rastro, para no pegar
// palabras que estaban separadas por un salto (casos "texto con saltos
// múltiples"/"texto con tabulaciones").
const LINE_BREAK_OR_TAB = /[\r\n\t\v\f]/g

// Marcas diacríticas combinantes (U+0300-U+036F) que quedan tras descomponer
// (NFKD) un carácter acentuado — al removerlas, á/é/í/ó/ú/ü/ñ quedan
// reducidos a a/e/i/o/u/u/n sin necesitar una tabla manual por carácter.
// Se usa el escape \u explícito (en vez de los caracteres combinantes
// literales) para que el archivo fuente no contenga marcas invisibles que
// un editor/git pudiera normalizar o corromper.
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g

function isControlCodePoint(code: number): boolean {
  return (code >= 0x00 && code <= 0x1f) || code === 0x7f || (code >= 0x80 && code <= 0x9f)
}

/**
 * Reduce cualquier texto (nombre de negocio, producto, agregado, sección,
 * ingrediente quitado, talle, color) a una única línea de ASCII imprimible
 * seguro (0x20-0x7E). Nunca deja pasar un carácter de control real — ver
 * comentario de cabecera. Determinista: misma entrada, misma salida.
 *
 * Estrategia (sección 10, opción A — ASCII seguro con transliteración
 * documentada):
 *   1) Normaliza saltos de línea/tabulaciones a espacio.
 *   2) Reemplaza puntuación tipográfica común por su equivalente ASCII.
 *   3) Descompone (NFKD) y elimina marcas diacríticas.
 *   4) Elimina SIN reemplazo visible cualquier control C0/C1 restante
 *      (ESC, GS, NUL, BEL, etc. — nunca sobreviven, ni siquiera como "?").
 *   5) Cualquier otro carácter fuera de 0x20-0x7E (emojis, otros alfabetos,
 *      símbolos no cubiertos) se reemplaza por "?" — nunca se deja pasar
 *      tal cual, nunca se lanza una excepción.
 *   6) Colapsa espacios repetidos y recorta los extremos.
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) return ""

  let text = input.replace(LINE_BREAK_OR_TAB, " ")
  for (const [from, to] of PUNCTUATION_FALLBACK) {
    text = text.split(from).join(to)
  }
  text = text.normalize("NFKD").replace(COMBINING_DIACRITICS, "")

  let safe = ""
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (isControlCodePoint(code)) continue
    safe += code >= 0x20 && code <= 0x7e ? char : "?"
  }

  return safe.replace(/ {2,}/g, " ").trim()
}

/** Rellena a la derecha con espacios hasta `width` — nunca trunca, nunca usa ancho negativo. */
export function padRight(text: string, width: number): string {
  if (width <= 0 || text.length >= width) return text
  return text + " ".repeat(width - text.length)
}

/** Rellena a la izquierda con espacios hasta `width` — nunca trunca, nunca usa ancho negativo. */
export function padLeft(text: string, width: number): string {
  if (width <= 0 || text.length >= width) return text
  return " ".repeat(width - text.length) + text
}

/** Línea divisoria de exactamente `width` caracteres del carácter dado (por defecto "-"). */
export function makeDivider(width: number, char = "-"): string {
  return char.repeat(Math.max(0, width))
}

/** Indenta cada línea de `lines` con `spaces` espacios — usado para personalizaciones debajo del producto. */
export function indentLines(lines: string[], spaces: number): string[] {
  const prefix = " ".repeat(Math.max(0, spaces))
  return lines.map((line) => `${prefix}${line}`)
}

/**
 * Envuelve texto ya saneado en líneas de como máximo `width` caracteres,
 * partiendo por espacios cuando es posible. Una palabra individual más larga
 * que `width` se corta de forma dura, en fragmentos exactos de `width` — la
 * única excepción documentada a "nunca superar el ancho" es la línea final
 * de `formatNameAmountLine` cuando el importe por sí solo excede el ancho
 * (ver esa función); el corte duro de esta función SIEMPRE respeta el
 * ancho. Un texto vacío produce un arreglo vacío, nunca `[""]`.
 */
export function wrapText(text: string, width: number): string[] {
  const safeWidth = Math.max(1, width)
  const sanitized = sanitizeText(text)
  if (!sanitized) return []

  const words = sanitized.split(" ").filter((word) => word.length > 0)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    if (word.length > safeWidth) {
      if (current) {
        lines.push(current)
        current = ""
      }
      let rest = word
      while (rest.length > safeWidth) {
        lines.push(rest.slice(0, safeWidth))
        rest = rest.slice(safeWidth)
      }
      current = rest
      continue
    }

    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= safeWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  return lines
}

/**
 * Combina un nombre (posiblemente largo) y un importe ya formateado en una o
 * más líneas de como máximo `width` caracteres. Si ambos caben en la misma
 * línea (nombre + 1 espacio + importe), el importe queda alineado a la
 * derecha en esa única línea. Si no caben juntos, el nombre se envuelve en
 * tantas líneas como haga falta y el importe se coloca en su PROPIA línea
 * final, alineado a la derecha — nunca se elimina ni se trunca el importe.
 * Si el importe por sí solo ya excede `width`, esa última línea excede el
 * ancho configurado — EXCEPCIÓN documentada y testeada (caso "importe
 * largo"/"total que no entra junto a la etiqueta"): se prefiere mostrar el
 * valor completo a truncar un monto, que nunca debe perderse.
 */
export function formatNameAmountLine(name: string, amount: string, width: number): string[] {
  const safeWidth = Math.max(1, width)
  const sanitizedName = sanitizeText(name)
  const sanitizedAmount = sanitizeText(amount)

  const separatorWidth = sanitizedName ? 1 : 0
  const singleLineLength = sanitizedName.length + separatorWidth + sanitizedAmount.length

  if (singleLineLength <= safeWidth) {
    const gapWidth = safeWidth - sanitizedName.length - sanitizedAmount.length
    return [`${sanitizedName}${" ".repeat(Math.max(separatorWidth, gapWidth))}${sanitizedAmount}`]
  }

  const nameLines = sanitizedName ? wrapText(sanitizedName, safeWidth) : []
  const amountLine = padLeft(sanitizedAmount, safeWidth)
  return [...nameLines, amountLine]
}
