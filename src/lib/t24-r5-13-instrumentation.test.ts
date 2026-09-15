import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { classifyT24RevisionGap } from "@/lib/t24-witness-revision"
import { isT24PhysicalWitnessEnabled } from "@/lib/t24-physical-witness"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)

describe("P2-T24-R5.13 witness-only contracts", () => {
  test("revision gap classification remains server-authoritative and explicit", () => {
    expect(classifyT24RevisionGap(true, false, false)).toBe("SERVER_REVISION_NOT_OBSERVED_BY_CLIENT")
    expect(classifyT24RevisionGap(true, false, true)).toBe("SERVER_REVISION_RECEIVED_HTTP_ONLY")
    expect(classifyT24RevisionGap(true, true, false)).toBe("SERVER_REVISION_NOT_RECEIVED_REALTIME")
    expect(classifyT24RevisionGap(false, false, false)).toBeNull()
  })

  test("Testing witness is fail-closed outside the exact opted-in order", () => {
    const previousEnv = { ...process.env }
    process.env.NEXT_PUBLIC_T24_PHYSICAL_WITNESS_ENABLED = "1"
    process.env.NEXT_PUBLIC_T24_PHYSICAL_WITNESS_ORDER_ID = "TEST_ORDER"
    expect(isT24PhysicalWitnessEnabled("TEST_ORDER")).toBe(true)
    expect(isT24PhysicalWitnessEnabled("OTHER_ORDER")).toBe(false)
    process.env.NEXT_PUBLIC_T24_PHYSICAL_WITNESS_ENABLED = "0"
    expect(isT24PhysicalWitnessEnabled("TEST_ORDER")).toBe(false)
    process.env = previousEnv
  })

  test("producer instrumentation is observational and preserves the real tracking path", () => {
    const source = readFileSync(fromSrc("hooks/use-repartidor-tracking.ts"), "utf8")
    expect(source).toContain("navigator.geolocation.watchPosition")
    expect(source).toContain('fetch("/api/repartidor/ubicacion"')
    expect(source).toContain("gps_callback_received")
    expect(source).toContain("raw_buffer_append")
    expect(source).toContain("trajectory_batch_flush")
    expect(source).toContain("tracking_post_started")
    expect(source).toContain("tracking_post_completed")
    expect(source).toContain("createT24PhysicalWitnessHeaders")
  })

  test("client lifecycle/realtime/map instrumentation is Testing witness-only", () => {
    const source = readFileSync(fromSrc("components/tracking/delivery-tracking-map.tsx"), "utf8")
    expect(source).toContain("client_realtime_connection_state")
    expect(source).toContain("client_delivery_map_lifecycle")
    expect(source).toContain("client_revision_observed")
    expect(source).toContain("recordT24PhysicalWitness")
    expect(source).not.toContain("localStorage.setItem")
  })

  test("Production fail-closed guard remains present at the witness boundary", () => {
    const route = readFileSync(fromSrc("app/api/testing/t24-physical-witness/route.ts"), "utf8")
    expect(route).toContain('process.env.DELIGO_ENVIRONMENT === "TESTING"')
    expect(route).toContain('NextResponse.json({ error: "Not found" }, { status: 404 })')
    expect(route).toContain("!pedido.negocio.nombre.startsWith(\"TEST_T24_PHYSICAL_\")")
  })
})
