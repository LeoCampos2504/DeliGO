// P2-T44-R1P2 (gap G1): contrato PURO de navegación del Notification Center
// de Operaciones — extraído como `resolveNotificationNavigation` (sin
// React, sin DOM) para poder testearlo sin infraestructura de componentes
// (mismo criterio que mesa-cliente-cuenta-ui.ts). No se renderiza el
// componente — sólo se importan sus funciones puras exportadas.
import { describe, expect, test } from "bun:test"
import {
  isSafeInternalPath,
  parseNotificationData,
  getNavigateTab,
  resolveNotificationNavigation,
} from "./notification-center"
import type { NotificationItem } from "@/store/notification-store"

function notif(overrides: Partial<NotificationItem> & { datos: string }): NotificationItem {
  return {
    id: "n-1",
    userId: "u-1",
    userType: "empleado",
    tipo: "operaciones_pyr_new_order",
    titulo: "titulo",
    cuerpo: "cuerpo",
    leido: false,
    pedidoId: "pedido-1",
    negocioId: "negocio-1",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("isSafeInternalPath", () => {
  test("acepta una ruta interna simple", () => {
    expect(isSafeInternalPath("/operaciones/mi-panel/mi-negocio/pyr/pedidos")).toBe(true)
  })
  test("rechaza protocol-relative //evil.com", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false)
  })
  test("rechaza https://evil.com", () => {
    expect(isSafeInternalPath("https://evil.com")).toBe(false)
  })
  test("rechaza http://evil.com", () => {
    expect(isSafeInternalPath("http://evil.com")).toBe(false)
  })
  test("rechaza javascript:alert(1)", () => {
    expect(isSafeInternalPath("javascript:alert(1)")).toBe(false)
  })
  test("rechaza undefined/no-string", () => {
    expect(isSafeInternalPath(undefined)).toBe(false)
    expect(isSafeInternalPath(123)).toBe(false)
  })
})

describe("parseNotificationData", () => {
  test("JSON malformado -> objeto vacío, nunca lanza", () => {
    expect(parseNotificationData(notif({ datos: "{not-json" }))).toEqual({})
  })
  test("datos vacío -> objeto vacío", () => {
    expect(parseNotificationData(notif({ datos: "" }))).toEqual({})
  })
  test("JSON válido -> se parsea tal cual", () => {
    expect(parseNotificationData(notif({ datos: '{"url":"/x"}' }))).toEqual({ url: "/x" })
  })
})

describe("getNavigateTab (legacy, sin cambios de contrato)", () => {
  test("devuelve el nombre de pestaña del userType correspondiente", () => {
    const n = notif({ userType: "negocio", datos: '{"navigateTo":{"negocio":"pedidos"}}' })
    expect(getNavigateTab(n)).toBe("pedidos")
  })
  test("sin navigateTo -> null", () => {
    expect(getNavigateTab(notif({ datos: "{}" }))).toBeNull()
  })
  test("navigateTo de OTRO userType no aplica (nunca cross-role)", () => {
    const n = notif({ userType: "empleado", datos: '{"navigateTo":{"negocio":"pedidos"}}' })
    expect(getNavigateTab(n)).toBeNull()
  })
})

describe("resolveNotificationNavigation — precedencia real (P2-T44-R1P2 / R1P1A §18.3)", () => {
  test("datos.url interna segura -> decision url exacta", () => {
    const n = notif({ datos: '{"url":"/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1"}' })
    expect(resolveNotificationNavigation(n)).toEqual({
      kind: "url",
      url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1",
    })
  })

  test("datos.url = //evil.com -> rechazada, no navega por url", () => {
    const n = notif({ datos: '{"url":"//evil.com"}' })
    expect(resolveNotificationNavigation(n)).toEqual({ kind: "none" })
  })

  test("datos.url = https://evil.com -> rechazada", () => {
    const n = notif({ datos: '{"url":"https://evil.com"}' })
    expect(resolveNotificationNavigation(n)).toEqual({ kind: "none" })
  })

  test("datos.url = javascript:alert(1) -> rechazada", () => {
    const n = notif({ datos: '{"url":"javascript:alert(1)"}' })
    expect(resolveNotificationNavigation(n)).toEqual({ kind: "none" })
  })

  test("url inválida + navigateTo presente -> cae al contrato legacy (tab), NUNCA router.push del tab-name", () => {
    const n = notif({ userType: "negocio", datos: '{"url":"https://evil.com","navigateTo":{"negocio":"pedidos"}}' })
    expect(resolveNotificationNavigation(n)).toEqual({ kind: "tab", tab: "pedidos" })
  })

  test("navigateTo=\"pedidos\" nunca se confunde con una URL (no empieza con /)", () => {
    const n = notif({ userType: "negocio", datos: '{"navigateTo":{"negocio":"pedidos"}}' })
    const decision = resolveNotificationNavigation(n)
    expect(decision.kind).toBe("tab")
    if (decision.kind === "tab") {
      expect(isSafeInternalPath(decision.tab)).toBe(false) // nunca pasable a router.push como ruta
    }
  })

  test("sin url ni navigateTo -> none, sin crash", () => {
    expect(resolveNotificationNavigation(notif({ datos: "{}" }))).toEqual({ kind: "none" })
  })

  test("datos JSON malformado -> none, sin crash (fila histórica corrupta)", () => {
    expect(resolveNotificationNavigation(notif({ datos: "{not-json" }))).toEqual({ kind: "none" })
  })

  // Los 6 tipos modernos de Operaciones — todos deben resolver por url.
  for (const tipo of [
    "mesa_order_ready",
    "operaciones_salon_new_order",
    "operaciones_order_cancelled",
    "operaciones_pyr_new_order",
    "operaciones_pyr_new_review",
    "operaciones_pyr_chat",
  ]) {
    test(`tipo=${tipo} con datos.url -> navega por url (sin regresión, sin necesitar onNavigate del host)`, () => {
      const n = notif({ tipo, userType: "empleado", datos: '{"url":"/operaciones/mi-panel/mi-negocio/pyr/pedidos"}' })
      expect(resolveNotificationNavigation(n)).toEqual({
        kind: "url",
        url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos",
      })
    })
  }

  test("tipo Negocio existente (new_order) con navigateTo -> sigue usando el contrato legacy, sin regresión", () => {
    const n = notif({ tipo: "new_order", userType: "negocio", datos: '{"navigateTo":{"negocio":"pedidos"}}' })
    expect(resolveNotificationNavigation(n)).toEqual({ kind: "tab", tab: "pedidos" })
  })
})
