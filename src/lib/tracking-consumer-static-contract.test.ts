import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)
const trackingMap = () => readFileSync(fromSrc("components/tracking/delivery-tracking-map.tsx"), "utf8")

describe("Shared realtime client Tracking consumer contract", () => {
  test("DeliveryTrackingMap uses the shared provider, leases tracking:watch and subscribes through the registry", () => {
    const source = trackingMap()
    expect(source).toContain('from "@/hooks/use-realtime"')
    expect(source).toContain('client.acquireOrderRoom(pedidoId, ["tracking:watch"], { signal: controller.signal })')
    expect(source).toContain('client.subscribe("repartidor-location"')
    expect(source).toContain("new AbortController()")
    expect(source).toContain("controller.abort()")
    expect(source).toContain("{ signal: controller.signal }")
    expect(source).not.toContain("authorizeRealtimeRoom")
    expect(source).not.toContain("fetchRealtimeToken")
    expect(source).not.toContain("getRealtimeSocketUrl")
  })

  test("DeliveryTrackingMap exposes no raw Socket ownership or transport listeners", () => {
    const source = trackingMap()
    for (const forbidden of [
      "socket.io-client",
      "socketRef",
      "getSocket",
      "socket.on",
      "socket.off",
      "socket.emit",
      "leave-all-rooms",
      "join-order-room",
      "\"io(",
      " io(",
      "reconnectionAttempts",
      "reconnectionDelay",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("DeliveryTrackingMap releases the lease and unsubscribes on every cleanup path", () => {
    const source = trackingMap()
    expect(source).toContain("lease?.release()")
    expect(source).toContain("unsubscribe()")
    expect(source).toContain("cancelled = true")
  })

  test("DeliveryTrackingMap preserves the HTTP fetch/polling fallback", () => {
    const source = trackingMap()
    expect(source).toContain("fetchTracking")
    expect(source).toContain("/api/pedidos/${pedidoId}/tracking")
    expect(source).toContain("POLL_INTERVAL")
    expect(source).toContain("SOCKET_POLL_HEARTBEAT")
  })

  test("isLiveSocket reflects the shared transport's current connection state, not a one-shot lease flag", () => {
    const source = trackingMap()
    expect(source).toContain('const { client, snapshot } = useRealtime()')
    expect(source).toContain('isTrackingRoomJoined && snapshot.state === "connected"')
    expect(source).toContain("setIsTrackingRoomJoined(true)")
    expect(source).toContain("setIsTrackingRoomJoined(false)")
  })
})
