// P2-T50-R1: contrato focal de los helpers puros del filtro de fecha
// personalizado de estadísticas de Salón (día/mes/rango). No monta
// ningún componente React ni el Calendar de react-day-picker (harness
// innecesario para probar lógica pura) — mismo patrón de "contrato
// estático puro" ya aceptado en T45/T49 para lógica sin DOM.
import { describe, expect, test } from "bun:test"
import {
  buildStatsQuery,
  dateToIsoDateString,
  formatDayLabel,
  formatMonthLabel,
  getStatsFilterLabel,
  getStatsFilterQueryKey,
  isoDateStringToDate,
  validateStatsRangeDraft,
  type StatsFilter,
} from "./salon-tab"

describe("buildStatsQuery — mapeo filtro -> query string", () => {
  test("quick hoy", () => {
    expect(buildStatsQuery({ kind: "quick", periodo: "hoy" })).toBe("periodo=hoy")
  })
  test("quick semana", () => {
    expect(buildStatsQuery({ kind: "quick", periodo: "semana" })).toBe("periodo=semana")
  })
  test("quick mes", () => {
    expect(buildStatsQuery({ kind: "quick", periodo: "mes" })).toBe("periodo=mes")
  })
  test("quick todo", () => {
    expect(buildStatsQuery({ kind: "quick", periodo: "todo" })).toBe("periodo=todo")
  })
  test("day", () => {
    expect(buildStatsQuery({ kind: "day", fecha: "2026-09-20" })).toBe("fecha=2026-09-20")
  })
  test("month", () => {
    expect(buildStatsQuery({ kind: "month", mes: "2026-08" })).toBe("mes=2026-08")
  })
  test("range", () => {
    expect(buildStatsQuery({ kind: "range", desde: "2026-09-01", hasta: "2026-09-15" })).toBe(
      "desde=2026-09-01&hasta=2026-09-15"
    )
  })
})

describe("getStatsFilterQueryKey — nunca reutiliza la misma key entre filtros distintos", () => {
  const negocioId = "negocio-1"
  test("quick vs day vs month vs range son todas keys distintas", () => {
    const keys = [
      getStatsFilterQueryKey(negocioId, { kind: "quick", periodo: "hoy" }),
      getStatsFilterQueryKey(negocioId, { kind: "day", fecha: "2026-09-20" }),
      getStatsFilterQueryKey(negocioId, { kind: "month", mes: "2026-08" }),
      getStatsFilterQueryKey(negocioId, { kind: "range", desde: "2026-09-01", hasta: "2026-09-15" }),
    ].map((k) => JSON.stringify(k))
    expect(new Set(keys).size).toBe(keys.length)
  })

  test("dos periodos quick distintos generan keys distintas", () => {
    const a = getStatsFilterQueryKey(negocioId, { kind: "quick", periodo: "hoy" })
    const b = getStatsFilterQueryKey(negocioId, { kind: "quick", periodo: "mes" })
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  test("dos meses específicos distintos generan keys distintas (agosto vs septiembre)", () => {
    const a = getStatsFilterQueryKey(negocioId, { kind: "month", mes: "2026-08" })
    const b = getStatsFilterQueryKey(negocioId, { kind: "month", mes: "2026-09" })
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })
})

describe("getStatsFilterLabel", () => {
  test("quick labels", () => {
    expect(getStatsFilterLabel({ kind: "quick", periodo: "hoy" })).toBe("Hoy")
    expect(getStatsFilterLabel({ kind: "quick", periodo: "semana" })).toBe("Semana")
    expect(getStatsFilterLabel({ kind: "quick", periodo: "mes" })).toBe("Mes")
    expect(getStatsFilterLabel({ kind: "quick", periodo: "todo" })).toBe("Todo")
  })
  test("day label formato dd/mm/yyyy", () => {
    expect(getStatsFilterLabel({ kind: "day", fecha: "2026-09-20" })).toBe("20/09/2026")
  })
  test("month label muestra el mes elegido, no 'Mes actual'", () => {
    expect(getStatsFilterLabel({ kind: "month", mes: "2026-08" })).toBe("Agosto 2026")
    expect(getStatsFilterLabel({ kind: "month", mes: "2026-08" })).not.toBe("Mes")
  })
  test("range label muestra ambos extremos", () => {
    expect(getStatsFilterLabel({ kind: "range", desde: "2026-09-01", hasta: "2026-09-15" })).toBe(
      "01/09/2026 – 15/09/2026"
    )
  })
})

describe("formatDayLabel / formatMonthLabel", () => {
  test("formatDayLabel no depende del locale del servidor (formato fijo)", () => {
    expect(formatDayLabel("2026-01-05")).toBe("05/01/2026")
  })
  test("formatMonthLabel distingue diciembre de años distintos", () => {
    expect(formatMonthLabel("2025-12")).toBe("Diciembre 2025")
    expect(formatMonthLabel("2026-12")).toBe("Diciembre 2026")
  })
})

describe("dateToIsoDateString / isoDateStringToDate — roundtrip sin desplazamiento UTC", () => {
  test("roundtrip preserva año/mes/día locales", () => {
    const original = new Date(2026, 8, 20)
    const iso = dateToIsoDateString(original)
    expect(iso).toBe("2026-09-20")
    const back = isoDateStringToDate(iso)
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(8)
    expect(back.getDate()).toBe(20)
  })

  test("nunca usa toISOString (que desplazaría a UTC) — mediodía local no cruza de día", () => {
    const noon = new Date(2026, 0, 1, 12, 0, 0)
    expect(dateToIsoDateString(noon)).toBe("2026-01-01")
  })
})

describe("validateStatsRangeDraft", () => {
  test("desde y hasta ausentes => incomplete (no dispara fetch todavía)", () => {
    expect(validateStatsRangeDraft(undefined, undefined)).toEqual({ valid: false, reason: "incomplete" })
    expect(validateStatsRangeDraft("2026-09-01", undefined)).toEqual({ valid: false, reason: "incomplete" })
    expect(validateStatsRangeDraft(undefined, "2026-09-15")).toEqual({ valid: false, reason: "incomplete" })
  })

  test("desde > hasta => reversed", () => {
    expect(validateStatsRangeDraft("2026-09-15", "2026-09-01")).toEqual({ valid: false, reason: "reversed" })
  })

  test("desde === hasta => válido (equivale a un día)", () => {
    expect(validateStatsRangeDraft("2026-09-10", "2026-09-10")).toEqual({ valid: true })
  })

  test("desde < hasta => válido", () => {
    expect(validateStatsRangeDraft("2026-09-01", "2026-09-15")).toEqual({ valid: true })
  })
})

describe("switch custom -> quick (contrato de tipos)", () => {
  test("un StatsFilter sólo puede tener un kind activo a la vez (discriminated union)", () => {
    const filters: StatsFilter[] = [
      { kind: "quick", periodo: "hoy" },
      { kind: "day", fecha: "2026-09-20" },
      { kind: "month", mes: "2026-08" },
      { kind: "range", desde: "2026-09-01", hasta: "2026-09-15" },
    ]
    for (const f of filters) {
      expect(["quick", "day", "month", "range"]).toContain(f.kind)
    }
  })
})
