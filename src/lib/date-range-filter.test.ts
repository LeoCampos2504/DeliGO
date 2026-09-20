// P2-T55-R1: contrato puro del helper compartido de fechas, extraído de
// la lógica de filtro custom de P2-T50-R1. No monta nada — sólo
// funciones puras (parseo + resolución de precedencia).
import { describe, expect, test } from "bun:test"
import { parseIsoDateComponents, parseIsoMonthComponents, resolveCustomDateFilter } from "./date-range-filter"

describe("parseIsoDateComponents", () => {
  test("fecha válida", () => {
    expect(parseIsoDateComponents("2026-09-20")).toEqual({ year: 2026, month: 9, day: 20 })
  })
  test("rechaza 31 de febrero (roundtrip inválido, no normaliza en silencio)", () => {
    expect(parseIsoDateComponents("2026-02-31")).toBeNull()
  })
  test("rechaza mes 13", () => {
    expect(parseIsoDateComponents("2026-13-01")).toBeNull()
  })
  test("rechaza formato libre", () => {
    expect(parseIsoDateComponents("abc")).toBeNull()
    expect(parseIsoDateComponents("2026-9-1")).toBeNull()
  })
})

describe("parseIsoMonthComponents", () => {
  test("mes válido", () => {
    expect(parseIsoMonthComponents("2026-08")).toEqual({ year: 2026, month: 8 })
  })
  test("rechaza mes 13 y mes 0", () => {
    expect(parseIsoMonthComponents("2026-13")).toBeNull()
    expect(parseIsoMonthComponents("2026-00")).toBeNull()
  })
  test("rechaza formato libre / un solo dígito", () => {
    expect(parseIsoMonthComponents("abc")).toBeNull()
    expect(parseIsoMonthComponents("2026-9")).toBeNull()
  })
})

describe("resolveCustomDateFilter — precedencia fecha > mes > rango > none", () => {
  test("ninguno de los 4 params => none", () => {
    expect(resolveCustomDateFilter({ fecha: null, mes: null, desde: null, hasta: null })).toEqual({ status: "none" })
  })

  test("fecha sola => custom periodo=fecha", () => {
    const result = resolveCustomDateFilter({ fecha: "2026-09-20", mes: null, desde: null, hasta: null })
    expect(result.status).toBe("custom")
    if (result.status === "custom") {
      expect(result.periodo).toBe("fecha")
      expect(result.from.getTime()).toBe(new Date(2026, 8, 20, 0, 0, 0, 0).getTime())
      expect(result.toExclusive.getTime()).toBe(new Date(2026, 8, 21, 0, 0, 0, 0).getTime())
    }
  })

  test("mes solo => custom periodo=mes_especifico", () => {
    const result = resolveCustomDateFilter({ fecha: null, mes: "2026-08", desde: null, hasta: null })
    expect(result.status).toBe("custom")
    if (result.status === "custom") {
      expect(result.periodo).toBe("mes_especifico")
      expect(result.from.getTime()).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).getTime())
      expect(result.toExclusive.getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime())
    }
  })

  test("desde+hasta => custom periodo=rango", () => {
    const result = resolveCustomDateFilter({ fecha: null, mes: null, desde: "2026-09-01", hasta: "2026-09-15" })
    expect(result.status).toBe("custom")
    if (result.status === "custom") {
      expect(result.periodo).toBe("rango")
      expect(result.from.getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime())
      expect(result.toExclusive.getTime()).toBe(new Date(2026, 8, 16, 0, 0, 0, 0).getTime())
    }
  })

  test("desde === hasta => rango de un solo día", () => {
    const result = resolveCustomDateFilter({ fecha: null, mes: null, desde: "2026-09-10", hasta: "2026-09-10" })
    expect(result.status).toBe("custom")
    if (result.status === "custom") {
      expect(result.from.getTime()).toBe(new Date(2026, 8, 10, 0, 0, 0, 0).getTime())
      expect(result.toExclusive.getTime()).toBe(new Date(2026, 8, 11, 0, 0, 0, 0).getTime())
    }
  })

  test("desde > hasta => invalid", () => {
    expect(resolveCustomDateFilter({ fecha: null, mes: null, desde: "2026-09-15", hasta: "2026-09-01" }).status).toBe("invalid")
  })

  test("sólo desde o sólo hasta => invalid", () => {
    expect(resolveCustomDateFilter({ fecha: null, mes: null, desde: "2026-09-01", hasta: null }).status).toBe("invalid")
    expect(resolveCustomDateFilter({ fecha: null, mes: null, desde: null, hasta: "2026-09-15" }).status).toBe("invalid")
  })

  test("fecha inválida / mes inválido => invalid", () => {
    expect(resolveCustomDateFilter({ fecha: "2026-02-31", mes: null, desde: null, hasta: null }).status).toBe("invalid")
    expect(resolveCustomDateFilter({ fecha: null, mes: "2026-13", desde: null, hasta: null }).status).toBe("invalid")
  })

  test("combinar más de un modo custom a la vez => invalid (ambiguo)", () => {
    expect(resolveCustomDateFilter({ fecha: "2026-09-20", mes: "2026-09", desde: null, hasta: null }).status).toBe("invalid")
    expect(resolveCustomDateFilter({ fecha: "2026-09-20", mes: null, desde: "2026-09-01", hasta: "2026-09-15" }).status).toBe("invalid")
    expect(resolveCustomDateFilter({ fecha: null, mes: "2026-09", desde: null, hasta: "2026-09-15" }).status).toBe("invalid")
  })
})
