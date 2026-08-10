/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { pointInPolygon, resolveDeliveryCoverage, parseDiscoveryCoordinates, isValidCoordinatePair } from "./delivery-coverage"

const triangulo = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 10 },
  { lat: 10, lng: 0 },
]

describe("T20-DK2 — pointInPolygon", () => {
  test("punto dentro del triángulo", () => {
    expect(pointInPolygon(1, 1, triangulo)).toBe(true)
  })

  test("punto fuera del triángulo", () => {
    expect(pointInPolygon(20, 20, triangulo)).toBe(false)
  })
})

describe("T20-DK2 — resolveDeliveryCoverage", () => {
  test("negocio sin delivery -> delivery=false, reason=no_delivery", () => {
    const result = resolveDeliveryCoverage(
      { ofreceDelivery: false, deliveryMode: "", precioDelivery: 0, precioDeliveryDefault: 0, zonaDeliveryActiva: false, zonasDelivery: "[]" },
      1,
      1
    )
    expect(result.delivery).toBe(false)
    expect(result.reason).toBe("no_delivery")
  })

  test("modo simple (sin zona activa) -> siempre disponible, precio plano", () => {
    const result = resolveDeliveryCoverage(
      { ofreceDelivery: true, deliveryMode: "", precioDelivery: 500, precioDeliveryDefault: 0, zonaDeliveryActiva: false, zonasDelivery: "[]" },
      1,
      1
    )
    expect(result.mode).toBe("simple")
    expect(result.precioDelivery).toBe(500)
    expect(result.delivery).toBeUndefined()
  })

  test("modo experto sin zonas configuradas -> usa precio default, sin bloquear", () => {
    const result = resolveDeliveryCoverage(
      { ofreceDelivery: true, deliveryMode: "expert", precioDelivery: 0, precioDeliveryDefault: 300, zonaDeliveryActiva: true, zonasDelivery: "[]" },
      1,
      1
    )
    expect(result.mode).toBe("expert")
    expect(result.precioDelivery).toBe(300)
    expect(result.delivery).toBeUndefined()
  })

  test("modo experto con zonas: punto dentro -> delivery disponible con precio de zona", () => {
    const zonasDelivery = JSON.stringify([{ nombre: "Zona A", precio: 200, puntos: triangulo }])
    const result = resolveDeliveryCoverage(
      { ofreceDelivery: true, deliveryMode: "expert", precioDelivery: 0, precioDeliveryDefault: 0, zonaDeliveryActiva: true, zonasDelivery },
      1,
      1
    )
    expect(result.delivery).toBeUndefined() // no se marca false cuando SÍ hay cobertura
    expect(result.zonaNombre).toBe("Zona A")
    expect(result.precioDelivery).toBe(200)
  })

  test("modo experto con zonas: punto fuera -> delivery=false, reason=outside_zones", () => {
    const zonasDelivery = JSON.stringify([{ nombre: "Zona A", precio: 200, puntos: triangulo }])
    const result = resolveDeliveryCoverage(
      { ofreceDelivery: true, deliveryMode: "expert", precioDelivery: 0, precioDeliveryDefault: 0, zonaDeliveryActiva: true, zonasDelivery },
      50,
      50
    )
    expect(result.delivery).toBe(false)
    expect(result.reason).toBe("outside_zones")
  })

  test("zonasDelivery ya viene como array (no string) -> se procesa igual", () => {
    const result = resolveDeliveryCoverage(
      {
        ofreceDelivery: true,
        deliveryMode: "expert",
        precioDelivery: 0,
        precioDeliveryDefault: 0,
        zonaDeliveryActiva: true,
        zonasDelivery: [{ nombre: "Zona B", precio: 150, puntos: triangulo }],
      },
      1,
      1
    )
    expect(result.zonaNombre).toBe("Zona B")
  })
})

describe("T20-DK2 — parseDiscoveryCoordinates", () => {
  test("lat/lng ausentes -> null (ubicación desconocida)", () => {
    expect(parseDiscoveryCoordinates({ lat: null, lng: null })).toBeNull()
  })

  test("lat/lng vacíos -> null", () => {
    expect(parseDiscoveryCoordinates({ lat: "", lng: "" })).toBeNull()
  })

  test("lat/lng válidos -> objeto parseado", () => {
    expect(parseDiscoveryCoordinates({ lat: "-34.6", lng: "-58.4" })).toEqual({ lat: -34.6, lng: -58.4 })
  })

  test("NaN-like -> null", () => {
    expect(parseDiscoveryCoordinates({ lat: "abc", lng: "-58.4" })).toBeNull()
  })

  test("Infinity -> null", () => {
    expect(parseDiscoveryCoordinates({ lat: "Infinity", lng: "-58.4" })).toBeNull()
  })

  test("fuera de rango -> null", () => {
    expect(parseDiscoveryCoordinates({ lat: "999", lng: "-58.4" })).toBeNull()
    expect(parseDiscoveryCoordinates({ lat: "-34.6", lng: "999" })).toBeNull()
  })

  test("sólo lat sin lng -> null", () => {
    expect(parseDiscoveryCoordinates({ lat: "-34.6", lng: null })).toBeNull()
  })

  test("array/objeto serializado como string malformado -> null", () => {
    expect(parseDiscoveryCoordinates({ lat: "[1,2]", lng: "-58.4" })).toBeNull()
  })
})

describe("T20-DK2A — isValidCoordinatePair (validación numérica, usada antes del batch POST)", () => {
  test("lat/lng numéricos válidos -> true", () => {
    expect(isValidCoordinatePair(-34.6, -58.4)).toBe(true)
  })

  test("lat/lng ausentes -> false (ubicación desconocida)", () => {
    expect(isValidCoordinatePair(undefined, undefined)).toBe(false)
    expect(isValidCoordinatePair(-34.6, undefined)).toBe(false)
  })

  test("NaN/Infinity -> false", () => {
    expect(isValidCoordinatePair(NaN, -58.4)).toBe(false)
    expect(isValidCoordinatePair(-34.6, Infinity)).toBe(false)
  })

  test("fuera de rango -> false", () => {
    expect(isValidCoordinatePair(999, -58.4)).toBe(false)
    expect(isValidCoordinatePair(-34.6, 999)).toBe(false)
  })
})
