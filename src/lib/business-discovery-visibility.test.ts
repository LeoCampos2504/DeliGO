/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { shouldShowBusinessInDiscovery } from "./business-discovery-visibility"

describe("T20-DK2 — shouldShowBusinessInDiscovery", () => {
  test("1. retiro=true, coverage desconocida -> visible", () => {
    expect(
      shouldShowBusinessInDiscovery({ ofreceDelivery: true, ofreceRetiro: true, coverageKnown: false, deliveryAvailable: false })
    ).toBe(true)
  })

  test("2. retiro=true, delivery fuera de zona -> visible (puede retirar)", () => {
    expect(
      shouldShowBusinessInDiscovery({ ofreceDelivery: true, ofreceRetiro: true, coverageKnown: true, deliveryAvailable: false })
    ).toBe(true)
  })

  test("3. solo delivery, coverage desconocida -> visible (nunca se asume fuera de zona)", () => {
    expect(
      shouldShowBusinessInDiscovery({ ofreceDelivery: true, ofreceRetiro: false, coverageKnown: false, deliveryAvailable: false })
    ).toBe(true)
  })

  test("4. solo delivery, dentro de zona -> visible", () => {
    expect(
      shouldShowBusinessInDiscovery({ ofreceDelivery: true, ofreceRetiro: false, coverageKnown: true, deliveryAvailable: true })
    ).toBe(true)
  })

  test("5. solo delivery, fuera de zona -> oculto", () => {
    expect(
      shouldShowBusinessInDiscovery({ ofreceDelivery: true, ofreceRetiro: false, coverageKnown: true, deliveryAvailable: false })
    ).toBe(false)
  })

  test("6. delivery OFF + retiro ON (solo retiro) -> visible, sin depender de zona", () => {
    expect(
      shouldShowBusinessInDiscovery({ ofreceDelivery: false, ofreceRetiro: true, coverageKnown: true, deliveryAvailable: false })
    ).toBe(true)
    expect(
      shouldShowBusinessInDiscovery({ ofreceDelivery: false, ofreceRetiro: true, coverageKnown: false, deliveryAvailable: false })
    ).toBe(true)
  })

  test("caso defensivo: ni delivery ni retiro (estado que el servidor ya impide alcanzar) -> visible, no explota", () => {
    expect(
      shouldShowBusinessInDiscovery({ ofreceDelivery: false, ofreceRetiro: false, coverageKnown: true, deliveryAvailable: false })
    ).toBe(true)
  })
})
