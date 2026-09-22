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

  test("recovers route after returning from external maps", () => {
    const navigation = fromSrc("components/repartidor/delivery-navigation.tsx")
    expect(navigation).toContain("visibilitychange")
    expect(navigation).toContain('window.addEventListener("focus"')
    expect(navigation).toContain('window.addEventListener("pageshow"')
    expect(navigation).toContain("foregroundRecoveryPendingRef")
    expect(navigation).toContain("foregroundRecoveryNonce")
    expect(navigation).toContain("shouldRecoverRouteOnForeground")
  })

  test("route fetch has an explicit timeout and terminal error UI", () => {
    const navigation = fromSrc("components/repartidor/delivery-navigation.tsx")
    const helpers = fromSrc("lib/delivery-navigation.ts")
    expect(helpers).toContain("ROUTE_FETCH_TIMEOUT_MS = 10_000")
    expect(helpers).toContain('"TIMEOUT"')
    expect(helpers).toContain('"ABORTED"')
    expect(navigation).toContain("fetchDeliveryRoute")
    expect(navigation).toContain("routeLoading")
    expect(navigation).toContain("finally")
    expect(navigation).toContain("No se pudo calcular la ruta en este momento")
  })

  test("stale route responses cannot overwrite a newer request", () => {
    const navigation = fromSrc("components/repartidor/delivery-navigation.tsx")
    expect(navigation).toContain("routeRequestGenerationRef")
    expect(navigation).toContain("generation !== routeRequestGenerationRef.current")
    expect(navigation).toContain("routeRequestControllerRef.current?.abort()")
  })

  test("closing navigation resets transient state and the parent performs a real unmount", () => {
    const navigation = fromSrc("components/repartidor/delivery-navigation.tsx")
    const deliveries = fromSrc("components/repartidor/deliveries-tab.tsx")
    expect(navigation).toContain("return () => cancelRouteRequest()")
    expect(navigation).toContain("routeRequestGenerationRef.current += 1")
    expect(deliveries).toContain("{navigationOpen ? (")
    expect(deliveries).toContain(") : null}")
  })

  test("route failures expose a user-triggered retry without opening a second GPS watcher", () => {
    const navigation = fromSrc("components/repartidor/delivery-navigation.tsx")
    expect(navigation).toContain("function retryRoute()")
    expect(navigation).toContain('>Reintentar</Button>')
    expect(navigation).toContain("startRouteRequest(currentCoordinate, destinationCoordinate, true)")
    expect(navigation).not.toContain("watchPosition")
  })

  test("route requests preserve the existing public OSRM driving endpoint", () => {
    const helpers = fromSrc("lib/delivery-navigation.ts")
    expect(helpers).toContain('https://router.project-osrm.org/route/v1/driving')
    expect(helpers).toContain('url.searchParams.set("overview", "full")')
    expect(helpers).toContain('url.searchParams.set("geometries", "geojson")')
  })
})
