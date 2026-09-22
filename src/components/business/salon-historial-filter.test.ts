// P2-T55-R1: contrato focal de los helpers puros del filtro de fecha
// personalizado de Historial de Salón (día/mes/rango). Mismo patrón de
// "contrato estático puro" ya usado en salon-stats-filter.test.ts (T50).
// A diferencia de StatsFilter, HistorialFilter NO tiene un modo quick
// "todo" — decisión de producto explícita de P2-T55-R1 §2.
import { describe, expect, test } from "bun:test"
import {
  buildHistorialQuery,
  getHistorialFilterLabel,
  getHistorialFilterQueryKey,
  type HistorialFilter,
} from "./salon-tab"

describe("buildHistorialQuery — mapeo filtro -> query string", () => {
  test("quick hoy/semana/mes", () => {
    expect(buildHistorialQuery({ kind: "quick", periodo: "hoy" })).toBe("periodo=hoy")
    expect(buildHistorialQuery({ kind: "quick", periodo: "semana" })).toBe("periodo=semana")
    expect(buildHistorialQuery({ kind: "quick", periodo: "mes" })).toBe("periodo=mes")
  })
  test("day", () => {
    expect(buildHistorialQuery({ kind: "day", fecha: "2026-09-20" })).toBe("fecha=2026-09-20")
  })
  test("month", () => {
    expect(buildHistorialQuery({ kind: "month", mes: "2026-08" })).toBe("mes=2026-08")
  })
  test("range", () => {
    expect(buildHistorialQuery({ kind: "range", desde: "2026-09-01", hasta: "2026-09-15" })).toBe(
      "desde=2026-09-01&hasta=2026-09-15"
    )
  })
})

describe("getHistorialFilterQueryKey — nunca reutiliza la misma key entre filtros o mesas distintas", () => {
  const negocioId = "negocio-1"
  test("quick vs day vs month vs range son todas keys distintas", () => {
    const keys = [
      getHistorialFilterQueryKey(negocioId, 5, { kind: "quick", periodo: "hoy" }),
      getHistorialFilterQueryKey(negocioId, 5, { kind: "day", fecha: "2026-09-20" }),
      getHistorialFilterQueryKey(negocioId, 5, { kind: "month", mes: "2026-08" }),
      getHistorialFilterQueryKey(negocioId, 5, { kind: "range", desde: "2026-09-01", hasta: "2026-09-15" }),
    ].map((k) => JSON.stringify(k))
    expect(new Set(keys).size).toBe(keys.length)
  })

  test("mesas distintas con el mismo filtro generan keys distintas (no cruzan cache)", () => {
    const a = getHistorialFilterQueryKey(negocioId, 5, { kind: "quick", periodo: "hoy" })
    const b = getHistorialFilterQueryKey(negocioId, 6, { kind: "quick", periodo: "hoy" })
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  test("mesa undefined (ninguna mesa seleccionada) no colisiona con una mesa real", () => {
    const a = getHistorialFilterQueryKey(negocioId, undefined, { kind: "quick", periodo: "hoy" })
    const b = getHistorialFilterQueryKey(negocioId, 5, { kind: "quick", periodo: "hoy" })
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })
})

describe("getHistorialFilterLabel", () => {
  test("quick labels — sólo hoy/semana/mes, sin 'todo'", () => {
    expect(getHistorialFilterLabel({ kind: "quick", periodo: "hoy" })).toBe("Hoy")
    expect(getHistorialFilterLabel({ kind: "quick", periodo: "semana" })).toBe("Semana")
    expect(getHistorialFilterLabel({ kind: "quick", periodo: "mes" })).toBe("Mes")
  })
  test("day label formato dd/mm/yyyy", () => {
    expect(getHistorialFilterLabel({ kind: "day", fecha: "2026-09-20" })).toBe("20/09/2026")
  })
  test("month label muestra el mes elegido", () => {
    expect(getHistorialFilterLabel({ kind: "month", mes: "2026-08" })).toBe("Agosto 2026")
  })
  test("range label muestra ambos extremos", () => {
    expect(getHistorialFilterLabel({ kind: "range", desde: "2026-09-01", hasta: "2026-09-15" })).toBe(
      "01/09/2026 – 15/09/2026"
    )
  })
})

describe("HistorialFilter — contrato de tipos sin modo 'todo'", () => {
  test("un HistorialFilter sólo puede tener un kind activo a la vez, y 'todo' no es un kind válido", () => {
    const filters: HistorialFilter[] = [
      { kind: "quick", periodo: "hoy" },
      { kind: "quick", periodo: "semana" },
      { kind: "quick", periodo: "mes" },
      { kind: "day", fecha: "2026-09-20" },
      { kind: "month", mes: "2026-08" },
      { kind: "range", desde: "2026-09-01", hasta: "2026-09-15" },
    ]
    for (const f of filters) {
      expect(["quick", "day", "month", "range"]).toContain(f.kind)
      if (f.kind === "quick") {
        expect(["hoy", "semana", "mes"]).toContain(f.periodo)
      }
    }
  })
})
