/// <reference types="bun-types" />

// ============================================
// P2T01-19 — config-tab.tsx: contrato estático focal
// ============================================
// Igual que deliveries-tab.test.tsx: este componente es enorme y montarlo
// completo requeriría un mock de todas las secciones de configuración de
// Negocio, ajeno a lo que P2-T01 cambia acá. Prueba de texto sobre el
// código fuente real: el switch sigue atado al mismo campo vivo
// (seguimientoDeliveryActivo, sin cambios de comportamiento — sólo el aviso
// es nuevo) y el aviso explica el corte "future-orders-only" exacto
// (DECISION-TRACK-01) en vez del texto genérico anterior.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const SOURCE = readFileSync(join(process.cwd(), "src", "components", "business", "config-tab.tsx"), "utf-8")

describe("P2T01-19 — config-tab.tsx: future-orders-only tracking notice", () => {
  test("the switch is still bound to the same live field, unchanged", () => {
    expect(SOURCE).toContain("checked={mergedDelivery.seguimientoDeliveryActivo ?? true}")
    expect(SOURCE).toContain("setDelivery((p) => ({ ...p, seguimientoDeliveryActivo: v }))")
  })

  test("exact approved wording is present (explains the snapshot is immutable per-order: future orders only, not orders already en route)", () => {
    const normalized = SOURCE.replace(/\s+/g, " ")
    expect(normalized).toContain(
      "Los clientes podrán ver al repartidor en el mapa. Se aplica a los pedidos que inicien después de activarlo, no a los que ya están en camino."
    )
  })

  test("no modal/confirmation dialog was introduced for this switch (design section 24)", () => {
    const switchBlockStart = SOURCE.indexOf("Seguimiento en tiempo real")
    const switchBlockEnd = SOURCE.indexOf("</div>", SOURCE.indexOf("</div>", switchBlockStart) + 1)
    const block = SOURCE.slice(switchBlockStart, switchBlockEnd)
    expect(block).not.toMatch(/Dialog|Modal|confirm\(/)
  })
})
