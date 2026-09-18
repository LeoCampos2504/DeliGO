// P2-T45-R1: cobertura mínima de la única lógica separable y testeable sin
// montar el componente — la derivación pura del conteo de "nuevos" que
// alimenta el badge de resumen y el dot pulsante por fila. No se agrega
// harness de efectos/React: el timer de polling replica mecánicamente el
// patrón ya en producción de src/app/operaciones/salon/page.tsx (mismo
// REFRESH_MS, misma guarda de visibilidad, mismo cleanup) y se revisa por
// lectura de código, no por un test nuevo.
import { describe, expect, test } from "bun:test"
import { countPedidosRecibidos } from "./page"

describe("P2-T45-R1 — countPedidosRecibidos", () => {
  test("[] => 0", () => {
    expect(countPedidosRecibidos([])).toBe(0)
  })

  test("[recibido] => 1", () => {
    expect(countPedidosRecibidos([{ estado: "recibido" }])).toBe(1)
  })

  test("[recibido, recibido] => 2", () => {
    expect(countPedidosRecibidos([{ estado: "recibido" }, { estado: "recibido" }])).toBe(2)
  })

  test("[aceptado, preparando] => 0", () => {
    expect(countPedidosRecibidos([{ estado: "aceptado" }, { estado: "preparando" }])).toBe(0)
  })

  test("[recibido, aceptado, cancelado] => 1", () => {
    expect(
      countPedidosRecibidos([{ estado: "recibido" }, { estado: "aceptado" }, { estado: "cancelado" }])
    ).toBe(1)
  })
})
