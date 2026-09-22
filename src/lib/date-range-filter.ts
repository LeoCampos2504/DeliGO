// P2-T55-R1: helper compartido de fechas, extraído verbatim de la lógica
// de filtro custom introducida en P2-T50-R1 (src/app/api/negocio/salon/stats/route.ts).
// Autoridad pequeña y pura — parseo seguro de "YYYY-MM-DD"/"YYYY-MM" por
// componentes (nunca `new Date(string)`, evita interpretación UTC) y
// resolución del filtro custom fecha/mes/desde+hasta con la MISMA
// precedencia y semántica que T50: fecha > mes > rango. No contiene
// lógica de quick filters (hoy/semana/mes/todo) — esa semántica difiere
// entre superficies (T50 vs T55) y permanece en cada route.ts.

export function parseIsoDateComponents(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const roundtrip = new Date(year, month - 1, day)
  if (roundtrip.getFullYear() !== year || roundtrip.getMonth() !== month - 1 || roundtrip.getDate() !== day) {
    return null
  }
  return { year, month, day }
}

export function parseIsoMonthComponents(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

export interface CustomDateFilterParams {
  fecha: string | null
  mes: string | null
  desde: string | null
  hasta: string | null
}

export type CustomDateFilterOutcome =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "custom"; from: Date; toExclusive: Date; periodo: "fecha" | "mes_especifico" | "rango" }

// Resuelve el filtro custom fecha/mes/desde+hasta con precedencia
// 1) fecha  2) mes  3) desde+hasta. Combinar más de un modo a la vez es
// ambiguo => "invalid" (el caller debe responder 400 genérico). Si
// ninguno de los cuatro parámetros llegó, "none" (el caller debe caer a
// su propia lógica de quick filters).
export function resolveCustomDateFilter(params: CustomDateFilterParams): CustomDateFilterOutcome {
  const { fecha, mes, desde, hasta } = params

  const customModeCount = [
    fecha !== null,
    mes !== null,
    desde !== null || hasta !== null,
  ].filter(Boolean).length

  if (customModeCount > 1) {
    return { status: "invalid" }
  }

  if (fecha !== null) {
    const parsed = parseIsoDateComponents(fecha)
    if (!parsed) return { status: "invalid" }
    const from = new Date(parsed.year, parsed.month - 1, parsed.day)
    const toExclusive = new Date(parsed.year, parsed.month - 1, parsed.day + 1)
    return { status: "custom", from, toExclusive, periodo: "fecha" }
  }

  if (mes !== null) {
    const parsed = parseIsoMonthComponents(mes)
    if (!parsed) return { status: "invalid" }
    const from = new Date(parsed.year, parsed.month - 1, 1)
    const toExclusive = new Date(parsed.year, parsed.month, 1)
    return { status: "custom", from, toExclusive, periodo: "mes_especifico" }
  }

  if (desde !== null || hasta !== null) {
    if (!desde || !hasta) return { status: "invalid" }
    const desdeParsed = parseIsoDateComponents(desde)
    const hastaParsed = parseIsoDateComponents(hasta)
    if (!desdeParsed || !hastaParsed) return { status: "invalid" }
    const desdeDate = new Date(desdeParsed.year, desdeParsed.month - 1, desdeParsed.day)
    const hastaDate = new Date(hastaParsed.year, hastaParsed.month - 1, hastaParsed.day)
    if (desdeDate.getTime() > hastaDate.getTime()) return { status: "invalid" }
    const toExclusive = new Date(hastaParsed.year, hastaParsed.month - 1, hastaParsed.day + 1)
    return { status: "custom", from: desdeDate, toExclusive, periodo: "rango" }
  }

  return { status: "none" }
}
