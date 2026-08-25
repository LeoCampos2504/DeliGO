// Ownership-B2 (P0 Legacy Mozo Push Unsubscribe Exact-Match Hardening): fully
// isolated unit tests for POST /api/mozo/push/unsubscribe — no real DB. Only
// @/lib/db is replaced via mock.module before the route is imported (same
// pattern as src/app/api/operativo/mozo/panel/[slug]/push-subscription/route.test.ts).
// @/lib/area-operativa and @/lib/rate-limit are real (pure, no I/O), matching
// this route's own dependency shape.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

type EmpleadoRow = {
  id: string
  token: string
  activo: boolean
  eliminado: boolean
  rol: string
  areaOperativa: string
  pushSubscription: string | null
}

type PushRow = { id: string; ownerType: string; ownerId: string; channel: string; endpoint: string }

let empleadoRows: EmpleadoRow[]
let updateManyCalls: Array<{ where: Record<string, unknown> }>
let updateManyThrows: Error | null
let pushRows: PushRow[]
let singletonDeleteManyCalls: number
let txDeleteManyCalls: number

function pushDeleteManyImpl(where: Record<string, unknown>) {
  const before = pushRows.length
  pushRows = pushRows.filter((r) => !Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
  return { count: before - pushRows.length }
}

function makeDbClient(kind: "singleton" | "tx") {
  return {
    empleado: {
      findFirst: async ({ where }: { where: { token: string; activo: boolean; eliminado: boolean } }) => {
        const row = empleadoRows.find(
          (r) => r.token === where.token && r.activo === where.activo && r.eliminado === where.eliminado
        )
        if (!row) return null
        return { id: row.id, rol: row.rol, areaOperativa: row.areaOperativa }
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: { pushSubscription: string | null }
      }) => {
        updateManyCalls.push({ where })
        if (updateManyThrows) throw updateManyThrows
        let count = 0
        for (const row of empleadoRows) {
          const matches =
            row.id === where.id &&
            (!("pushSubscription" in where) || row.pushSubscription === where.pushSubscription)
          if (matches) {
            row.pushSubscription = data.pushSubscription
            count += 1
          }
        }
        return { count }
      },
    },
    pushSubscription: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (kind === "singleton") singletonDeleteManyCalls += 1
        else txDeleteManyCalls += 1
        return pushDeleteManyImpl(where)
      },
    },
  }
}

const singletonDbClient = makeDbClient("singleton")
const txDbClient = makeDbClient("tx")

mock.module("@/lib/db", () => ({
  db: {
    ...singletonDbClient,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(txDbClient),
  },
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { POST } = await import("./route")

function callPost(body?: unknown, rawBody?: string, ip?: string) {
  const headers: Record<string, string> = { "x-forwarded-for": ip ?? "203.0.113.1" }
  let requestBody: string | undefined
  if (rawBody !== undefined) {
    headers["content-type"] = "application/json"
    requestBody = rawBody
  } else if (body !== undefined) {
    headers["content-type"] = "application/json"
    requestBody = JSON.stringify(body)
  }
  return POST(
    new NextRequest("http://localhost/api/mozo/push/unsubscribe", {
      method: "POST",
      headers,
      body: requestBody,
    })
  )
}

beforeEach(() => {
  empleadoRows = []
  updateManyCalls = []
  updateManyThrows = null
  pushRows = []
  singletonDeleteManyCalls = 0
  txDeleteManyCalls = 0
})

let pushIdCounter = 0
function pushRow(ownerId: string, endpoint: string): PushRow {
  pushIdCounter += 1
  return { id: `push-${pushIdCounter}`, ownerType: "empleado", ownerId, channel: "default", endpoint }
}
function subJson(endpoint: string) {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } })
}

describe("POST /api/mozo/push/unsubscribe — exact-match ownership hardening (Ownership-B2)", () => {
  test("S1: stored EA + request EA -> removed:true, DB cleared", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EA" },
    ]

    const res = await callPost({ mozoToken: "tok-a", subscription: "EA" }, undefined, "198.51.100.1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(updateManyCalls[0].where.pushSubscription).toBe("EA")
  })

  test("S2: multi-device — stored EB + request EA -> removed:false, EB survives byte-for-byte", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EB" },
    ]

    const res = await callPost({ mozoToken: "tok-a", subscription: "EA" }, undefined, "198.51.100.2")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(updateManyCalls[0].where.pushSubscription).toBe("EA")
    expect(empleadoRows[0].pushSubscription).toBe("EB")
  })

  test("S3: idempotency — stored null + request EA -> removed:false, no unexpected write", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: null },
    ]

    const res = await callPost({ mozoToken: "tok-a", subscription: "EA" }, undefined, "198.51.100.3")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(empleadoRows[0].pushSubscription).toBeNull()
  })

  test("S4: missing subscription -> 400, DB untouched", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EA" },
    ]

    const res = await callPost({ mozoToken: "tok-a" }, undefined, "198.51.100.4")
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ error: "subscription es obligatorio" })
    expect(updateManyCalls.length).toBe(0)
    expect(empleadoRows[0].pushSubscription).toBe("EA")
  })

  test("S5: empty/wrong-type subscription -> 400, DB untouched", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EA" },
    ]

    const resEmpty = await callPost({ mozoToken: "tok-a", subscription: "   " }, undefined, "198.51.100.5")
    expect(resEmpty.status).toBe(400)

    const resWrongType = await callPost({ mozoToken: "tok-a", subscription: 42 }, undefined, "198.51.100.6")
    expect(resWrongType.status).toBe(400)

    expect(updateManyCalls.length).toBe(0)
    expect(empleadoRows[0].pushSubscription).toBe("EA")
  })

  test("S6: malformed JSON body -> fail-closed (500, existing outer catch), DB untouched", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EA" },
    ]

    const res = await callPost(undefined, "{not-json", "198.51.100.7")

    expect(res.status).toBe(500)
    expect(updateManyCalls.length).toBe(0)
    expect(empleadoRows[0].pushSubscription).toBe("EA")
  })

  test("S7: cross-actor — subscription value from a different mozoToken's row can never affect this actor's row", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EA" },
      { id: "empleado-2", token: "tok-b", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EOTHER" },
    ]

    const res = await callPost({ mozoToken: "tok-a", subscription: "EOTHER" }, undefined, "198.51.100.8")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(updateManyCalls[0].where.id).toBe("empleado-1")
    expect(empleadoRows[1].pushSubscription).toBe("EOTHER")
  })

  test("S8: invalid mozoToken -> 401, exact same as before this fix, subscription never inspected", async () => {
    empleadoRows = []

    const res = await callPost({ mozoToken: "not-a-real-token", subscription: "EA" }, undefined, "198.51.100.9")
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: "Token de mozo invalido" })
    expect(updateManyCalls.length).toBe(0)
  })

  test("S8b: token belongs to a non-mozo area -> 401, unchanged guard", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "salon", areaOperativa: "salon", pushSubscription: "EA" },
    ]

    const res = await callPost({ mozoToken: "tok-a", subscription: "EA" }, undefined, "198.51.100.10")
    expect(res.status).toBe(401)
    expect(updateManyCalls.length).toBe(0)
  })

  test("S9: DB failure during updateMany -> 500, existing error contract unchanged", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EA" },
    ]
    updateManyThrows = new Error("simulated DB failure")

    const res = await callPost({ mozoToken: "tok-a", subscription: "EA" }, undefined, "198.51.100.11")
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: "Error al eliminar la suscripcion" })
  })

  test("missing mozoToken -> 400, unchanged, subscription never inspected", async () => {
    const res = await callPost({ subscription: "EA" }, undefined, "198.51.100.12")
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ error: "mozoToken es obligatorio" })
    expect(updateManyCalls.length).toBe(0)
  })
})

describe("POST /api/mozo/push/unsubscribe — dual-detach (Stage3 §17, §27)", () => {
  test("legacy + normalized removed in the SAME transaction, never the singleton", async () => {
    const e1 = subJson("https://push.example/E1")
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: e1 },
    ]
    pushRows = [pushRow("empleado-1", "https://push.example/E1")]

    const res = await callPost({ mozoToken: "tok-a", subscription: e1 }, undefined, "198.51.100.30")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
    expect(txDeleteManyCalls).toBe(1)
    expect(singletonDeleteManyCalls).toBe(0)
  })

  test("stale device: normalized E1 detaches even though legacy already holds newer E2 (STALE_DEVICE_CAN_CLEAR_NEWER_LEGACY_BINDING=NO)", async () => {
    const e1 = subJson("https://push.example/E1")
    const e2 = subJson("https://push.example/E2")
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: e2 },
    ]
    pushRows = [pushRow("empleado-1", "https://push.example/E1"), pushRow("empleado-1", "https://push.example/E2")]

    const res = await callPost({ mozoToken: "tok-a", subscription: e1 }, undefined, "198.51.100.31")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true }) // normalized removal alone makes removed:true
    expect(empleadoRows[0].pushSubscription).toBe(e2) // legacy untouched — never matched
    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/E2"])
  })

  test("cross-actor: never touches another empleado's normalized binding on the same endpoint", async () => {
    const shared = subJson("https://push.example/SHARED")
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: shared },
    ]
    pushRows = [pushRow("empleado-1", "https://push.example/SHARED"), pushRow("empleado-OTHER", "https://push.example/SHARED")]

    await callPost({ mozoToken: "tok-a", subscription: shared }, undefined, "198.51.100.32")

    expect(pushRows.length).toBe(1)
    expect(pushRows[0].ownerId).toBe("empleado-OTHER")
  })
})
