import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// P2-T02-B3 (OPTION-C, §11/§18): static-contract test mirroring the pattern
// already used for use-repartidor-tracking.ts
// (repartidor-tracking-static-contract.test.ts) — this component mounts a
// real Leaflet map instance (tiles, markers, CSS), which this repo does not
// otherwise unit-mount in tests; the freshness/staleness DECISION LOGIC
// itself is fully covered by pure tests in tracking-freshness.test.ts. This
// file verifies only that the component's JSX actually WIRES that decision
// in correctly — the live-socket badge can no longer, by itself, imply a
// fresh location.
const source = readFileSync(
  resolve(import.meta.dir, "delivery-tracking-map.tsx"),
  "utf8"
)

describe("DeliveryTrackingMap stale-location wiring contract (P2-T02-B3)", () => {
  test("isStale is computed from isTrackingLocationStale against repartidorLastUpdate, never from the socket", () => {
    expect(source).toContain("isTrackingLocationStale")
    expect(source).toContain("setIsStale(isTrackingLocationStale(trackingData.repartidorLastUpdate, Date.now()))")
  })

  test("isStale defaults to true — never assumes 'live' before the freshness check has run once", () => {
    expect(source).toContain("useState(true)")
  })

  test("the header live badge (\"En vivo\") is gated on !isStale, never rendered unconditionally", () => {
    const start = source.indexOf("{/* Live indicator")
    const end = source.indexOf("{/* Map container */}")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const headerBlock = source.slice(start, end)
    expect(headerBlock).toContain("trackingData && !isStale")
    expect(headerBlock).toContain("En vivo")
    // A distinct, non-pulsing "Pausado" state exists for the stale case —
    // never silently falls through to the live badge.
    expect(headerBlock).toContain("trackingData && isStale")
    expect(headerBlock).toContain("Pausado")
  })

  test("the bottom connection indicator treats staleness as higher priority than isLiveSocket", () => {
    const start = source.indexOf("{/* Connection indicator")
    const end = source.indexOf("</div>\n        </div>\n      </div>\n    </div>\n  )")
    expect(start).toBeGreaterThan(-1)
    const block = end > start ? source.slice(start, end) : source.slice(start, start + 1200)
    // isStale must be checked BEFORE isLiveSocket in this ternary chain —
    // a stale location must never be reported as "Tiempo real" just because
    // the socket happens to be connected.
    const staleIdx = block.indexOf("isStale ?")
    const liveSocketIdx = block.indexOf("isLiveSocket ?")
    expect(staleIdx).toBeGreaterThan(-1)
    expect(liveSocketIdx).toBeGreaterThan(-1)
    expect(staleIdx).toBeLessThan(liveSocketIdx)
  })

  test("the 'Última actualización: hace X' text keeps rendering unconditionally on staleness — never hidden or replaced", () => {
    expect(source).toContain("Última actualización:")
    // Rendered inside the same branch as the (optional) stale disclosure,
    // not behind an isStale-negated guard.
    const idx = source.indexOf("Última actualización:")
    const surrounding = source.slice(Math.max(0, idx - 400), idx)
    expect(surrounding).not.toContain("!isStale &&")
  })

  test("a stale location shows an explicit disclosure line, distinct from the timestamp text", () => {
    expect(source).toContain("Ubicación temporalmente pausada")
  })

  test("marker position rendering never references isStale — staleness is a display concern only, position/movement logic is untouched", () => {
    const markerEffectStart = source.indexOf("// Update repartidor marker when tracking data changes")
    const markerEffectEnd = source.indexOf("// Prevent body scroll when open")
    expect(markerEffectStart).toBeGreaterThan(-1)
    expect(markerEffectEnd).toBeGreaterThan(markerEffectStart)
    const markerEffect = source.slice(markerEffectStart, markerEffectEnd)
    expect(markerEffect).not.toContain("isStale")
  })
})
