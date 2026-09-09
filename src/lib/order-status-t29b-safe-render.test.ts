/// <reference types="bun-types" />

// ============================================
// P2-T29B — render seguro para los 2 estados nuevos
// ============================================
// `aceptado`/`esperando_repartidor` pasan a ser estados realmente
// alcanzables desde T29B — este contrato prueba que la UI existente
// (statusLabel/statusEmoji, StatusBadge) nunca muestra el string raw con
// guión bajo, ni cae en el estilo "desconocido" (bg-muted) que usaría para
// un estado verdaderamente no mapeado. No es un rediseño (T29D) — es el
// mínimo hardening de render seguro que exige la tarea (§21).

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { statusEmoji, statusLabel } from "./utils"

const STATUS_BADGE_SOURCE = join(process.cwd(), "src", "components", "shared", "status-badge.tsx")

describe("P2-T29B — statusLabel/statusEmoji conocen los 2 estados nuevos", () => {
  test("aceptado tiene label y emoji propios, nunca el string raw", () => {
    expect(statusLabel("aceptado")).toBe("Aceptado")
    expect(statusLabel("aceptado")).not.toBe("aceptado")
    expect(statusEmoji("aceptado")).not.toBe("📋") // no cae en el fallback genérico
  })

  test("esperando_repartidor tiene label legible, nunca el string con guión bajo", () => {
    expect(statusLabel("esperando_repartidor")).toBe("Buscando repartidor")
    expect(statusLabel("esperando_repartidor")).not.toContain("_")
    expect(statusEmoji("esperando_repartidor")).not.toBe("📋")
  })

  test("estados legacy conservan su label exacto (sin regresión)", () => {
    expect(statusLabel("recibido")).toBe("Recibido")
    expect(statusLabel("preparando")).toBe("Preparando")
    expect(statusLabel("en_camino")).toBe("En camino")
    expect(statusLabel("listo_para_retirar")).toBe("Listo para retirar")
    expect(statusLabel("entregado")).toBe("Entregado")
    expect(statusLabel("cancelado")).toBe("Cancelado")
  })

  test("un estado verdaderamente desconocido sigue devolviendo el string raw (comportamiento de fallback preservado)", () => {
    expect(statusLabel("estado_inventado_xyz")).toBe("estado_inventado_xyz")
  })
})

describe("P2-T29B — StatusBadge no usa el color 'desconocido' (bg-muted) para los estados nuevos", () => {
  test("el mapa de colores incluye aceptado y esperando_repartidor explícitamente", () => {
    const source = readFileSync(STATUS_BADGE_SOURCE, "utf-8")
    expect(source).toMatch(/aceptado:\s*"bg-/)
    expect(source).toMatch(/esperando_repartidor:\s*"bg-/)
  })
})
