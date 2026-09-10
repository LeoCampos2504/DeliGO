import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (path: string) => readFileSync(resolve(import.meta.dir, "..", path), "utf8")

describe("P2-T02-B4 delivery navigation contracts", () => {
  test("navigation consumes the shared GPS sample and never creates a second watcher", () => {
    const navigation = fromSrc("components/repartidor/delivery-navigation.tsx")
    const deliveries = fromSrc("components/repartidor/deliveries-tab.tsx")
    expect(navigation).toContain("currentPosition: TrackingLocationSample | null")
    expect(navigation).not.toContain("watchPosition")
    expect(navigation).not.toContain("navigator.geolocation")
    expect(deliveries).toContain("latestPosition")
    expect(deliveries).toContain("<DeliveryNavigation")
  })

  test("missing coordinates show an honest fallback and do not draw a fake route", () => {
    const navigation = fromSrc("components/repartidor/delivery-navigation.tsx")
    expect(navigation).toContain("Este pedido no tiene coordenadas de destino")
    expect(navigation).toContain("no dibujamos una ruta inventada")
    expect(navigation).toContain("getDestinationCoordinate(destination)")
    expect(navigation).toContain("buildGoogleMapsDirectionsUrl(destination)")
  })

  test("mobile navigation controls preserve both safe-area insets", () => {
    const navigation = fromSrc("components/repartidor/delivery-navigation.tsx")
    expect(navigation).toContain("env(safe-area-inset-top,0px)")
    expect(navigation).toContain("env(safe-area-inset-bottom,0px)")
  })

  test("Wake Lock is feature-detected, visible-only, and released on lifecycle cleanup", () => {
    const wakeLock = fromSrc("hooks/use-screen-wake-lock.ts")
    expect(wakeLock).toContain('"wakeLock" in navigator')
    expect(wakeLock).toContain('request("screen")')
    expect(wakeLock).toContain('document.addEventListener("visibilitychange"')
    expect(wakeLock).toContain("release()")
    expect(wakeLock).toContain(".catch(() => undefined)")
    expect(wakeLock).not.toContain("userAgent")
  })
})
