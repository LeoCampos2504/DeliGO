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

type PushRow = { id: string; ownerType: string; ownerId: string; channel: string; endpoint: string; p256dh: string; auth: string }

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
      // P2-T05 Stage3H3R1 (F-P2-T05-17): requerido por el fallback semántico
      // CAS (lee el valor legacy actual antes del clear condicional).
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = empleadoRows.find((r) => r.id === where.id)
        return row ? { pushSubscription: row.pushSubscription } : null
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
    // P2-T05 Stage3H3R1 (F-P2-T05-17, M-R1-11): snapshot + rollback-on-throw,
    // mismo patrón ya certificado en push/subscribe/route.test.ts y
    // push/unsubscribe/route.test.ts — sin esto el mock no puede demostrar
    // honestamente que un fallo del detach normalizado revierte el clear
    // semántico legacy ya aplicado dentro de la misma transacción.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = {
        empleado: structuredClone(empleadoRows),
        push: structuredClone(pushRows),
      }
      try {
        return await fn(txDbClient)
      } catch (e) {
        empleadoRows = snapshot.empleado
        pushRows = snapshot.push
        throw e
      }
    },
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
  return { id: `push-${pushIdCounter}`, ownerType: "empleado", ownerId, channel: "default", endpoint, p256dh: "p", auth: "a" }
}
function subJson(endpoint: string, p256dh = "p", auth = "a") {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh, auth } })
}

// P2-T05 Stage3H3R1: representación OBJETO (nunca stringificada) de la
// misma subscription — para probar el contrato object→* de F-P2-T05-17.
function subObj(endpoint: string, p256dh = "p", auth = "a") {
  return { endpoint, expirationTime: null as number | null, keys: { p256dh, auth } }
}

// Mismo contenido lógico que subJson pero con property order distinto del
// canónico — para probar que la comparación semántica ignora serialización.
function subJsonDifferentOrder(endpoint: string, p256dh = "p", auth = "a") {
  return JSON.stringify({ keys: { auth, p256dh }, endpoint, expirationTime: null })
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

describe("POST /api/mozo/push/unsubscribe — Stage3H3R1 symmetric semantic detach (F-P2-T05-17)", () => {
  test("M-R1-01: object subscribe contract -> object unsubscribe -> FULL DETACH", async () => {
    const endpoint = "https://push.example/M-OBJ-OBJ"
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: subJson(endpoint) },
    ]
    pushRows = [pushRow("empleado-1", endpoint)]

    const res = await callPost({ mozoToken: "tok-a", subscription: subObj(endpoint) }, undefined, "198.51.100.40")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })

  test("M-R1-02: object-subscribe canonical legacy -> string unsubscribe with different property order -> FULL DETACH", async () => {
    const endpoint = "https://push.example/M-OBJ-STR"
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: subJson(endpoint) },
    ]
    pushRows = [pushRow("empleado-1", endpoint)]

    const res = await callPost({ mozoToken: "tok-a", subscription: subJsonDifferentOrder(endpoint) }, undefined, "198.51.100.41")
    const body = await res.json()

    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })

  test("M-R1-03: non-canonical raw string legacy -> object unsubscribe -> FULL DETACH via semantic CAS", async () => {
    const endpoint = "https://push.example/M-STR-OBJ"
    const nonCanonical = subJsonDifferentOrder(endpoint)
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: nonCanonical },
    ]
    pushRows = [pushRow("empleado-1", endpoint)]

    const res = await callPost({ mozoToken: "tok-a", subscription: subObj(endpoint) }, undefined, "198.51.100.42")
    const body = await res.json()

    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBeNull() // OBJECT_UNSUBSCRIBE_CAN_LEAVE_ACTIVE_LEGACY_SEND_BINDING=NO after R1
    expect(pushRows.length).toBe(0)
  })

  test("M-R1-04: stale device (different endpoint) preserves the newer legacy binding", async () => {
    empleadoRows = [
      {
        id: "empleado-1",
        token: "tok-a",
        activo: true,
        eliminado: false,
        rol: "mozo",
        areaOperativa: "mozo",
        pushSubscription: subJson("https://push.example/M-NEWER"),
      },
    ]
    pushRows = [pushRow("empleado-1", "https://push.example/M-STALE"), pushRow("empleado-1", "https://push.example/M-NEWER")]

    const res = await callPost(
      { mozoToken: "tok-a", subscription: subObj("https://push.example/M-STALE") },
      undefined,
      "198.51.100.43"
    )
    const body = await res.json()

    expect(body).toEqual({ ok: true, removed: true }) // normalized own detach alone
    expect(empleadoRows[0].pushSubscription).toBe(subJson("https://push.example/M-NEWER")) // untouched
    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/M-NEWER"])
  })

  test("M-R1-05: same endpoint but rotated keys does not clear the newer legacy binding", async () => {
    const endpoint = "https://push.example/M-ROTATED"
    empleadoRows = [
      {
        id: "empleado-1",
        token: "tok-a",
        activo: true,
        eliminado: false,
        rol: "mozo",
        areaOperativa: "mozo",
        pushSubscription: subJson(endpoint, "NEW_P256DH", "NEW_AUTH"),
      },
    ]
    pushRows = [pushRow("empleado-1", endpoint)]

    const res = await callPost(
      { mozoToken: "tok-a", subscription: subObj(endpoint, "OLD_P256DH", "OLD_AUTH") },
      undefined,
      "198.51.100.44"
    )
    const body = await res.json()

    expect(body).toEqual({ ok: true, removed: false }) // stale generation cannot remove normalized or legacy binding
    expect(pushRows).toHaveLength(1)
    expect(empleadoRows[0].pushSubscription).not.toBeNull() // OLD_KEYS_CAN_CLEAR_NEWER_SAME_ENDPOINT_LEGACY=NO
  })

  test("M-R1-06: normalized E1 detaches while normalized E2 (different device) is preserved", async () => {
    empleadoRows = [
      {
        id: "empleado-1",
        token: "tok-a",
        activo: true,
        eliminado: false,
        rol: "mozo",
        areaOperativa: "mozo",
        pushSubscription: subJson("https://push.example/M-E2"),
      },
    ]
    pushRows = [pushRow("empleado-1", "https://push.example/M-E1"), pushRow("empleado-1", "https://push.example/M-E2")]

    await callPost({ mozoToken: "tok-a", subscription: subObj("https://push.example/M-E1") }, undefined, "198.51.100.45")

    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/M-E2"])
  })

  test("M-R1-07: actor authority remains mozoToken-derived — an object body cannot select a different empleado", async () => {
    const endpoint = "https://push.example/M-AUTH"
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: subJson(endpoint) },
      { id: "empleado-2", token: "tok-b", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: subJson(endpoint) },
    ]

    await callPost({ mozoToken: "tok-a", subscription: subObj(endpoint) }, undefined, "198.51.100.46")

    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(empleadoRows[1].pushSubscription).toBe(subJson(endpoint)) // empleado-2 untouched
  })

  test("M-R1-08: body-supplied ownerId/empleadoId-like extra properties on the object are ignored", async () => {
    const endpoint = "https://push.example/M-EXTRAS"
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: subJson(endpoint) },
    ]

    const withExtras = { ...subObj(endpoint), empleadoId: "attacker-controlled", ownerId: "attacker-controlled" }
    const res = await callPost({ mozoToken: "tok-a", subscription: withExtras }, undefined, "198.51.100.47")
    const body = await res.json()

    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBeNull()
  })

  test("M-R1-09: missing subscription still 400s (unchanged)", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EA" },
    ]

    const res = await callPost({ mozoToken: "tok-a" }, undefined, "198.51.100.48")
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ error: "subscription es obligatorio" })
    expect(empleadoRows[0].pushSubscription).toBe("EA")
  })

  test("M-R1-10: malformed object (missing required shape) fails closed with 400, no write attempted", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: "EA" },
    ]

    const res = await callPost({ mozoToken: "tok-a", subscription: { foo: "bar" } }, undefined, "198.51.100.49")
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ error: "subscription debe ser un JSON válido" })
    expect(updateManyCalls.length).toBe(0)
    expect(empleadoRows[0].pushSubscription).toBe("EA")
  })

  test("M-R1-11: transaction failure leaves no partial legacy clear (atomicity preserved)", async () => {
    const endpoint = "https://push.example/M-ROLLBACK"
    const nonCanonical = subJsonDifferentOrder(endpoint)
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: nonCanonical },
    ]
    pushRows = [pushRow("empleado-1", endpoint)]
    updateManyThrows = null

    const originalDeleteMany = txDbClient.pushSubscription.deleteMany
    txDbClient.pushSubscription.deleteMany = async () => {
      throw new Error("simulated normalized write failure (M-H3R1-11)")
    }
    try {
      const res = await callPost({ mozoToken: "tok-a", subscription: subObj(endpoint) }, undefined, "198.51.100.50")
      expect(res.status).toBe(500)
    } finally {
      txDbClient.pushSubscription.deleteMany = originalDeleteMany
    }

    expect(empleadoRows[0].pushSubscription).toBe(nonCanonical) // rolled back, never partially committed
    expect(pushRows.length).toBe(1)
  })

  test("M-R1-12: legacy value changed between CAS read and write is never blind-cleared", async () => {
    const endpoint = "https://push.example/M-RACE"
    const originalRaw = subJsonDifferentOrder(endpoint)
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: originalRaw },
    ]
    pushRows = [pushRow("empleado-1", endpoint)]

    const originalFindUnique = txDbClient.empleado.findUnique
    txDbClient.empleado.findUnique = async (...args: Parameters<typeof originalFindUnique>) => {
      const result = await originalFindUnique(...args)
      empleadoRows[0].pushSubscription = "RACED-IN-BY-ANOTHER-DEVICE"
      return result
    }
    try {
      const res = await callPost({ mozoToken: "tok-a", subscription: subObj(endpoint) }, undefined, "198.51.100.51")
      const body = await res.json()
      expect(body.removed).toBe(true) // normalized own detach still succeeds
    } finally {
      txDbClient.empleado.findUnique = originalFindUnique
    }

    expect(empleadoRows[0].pushSubscription).toBe("RACED-IN-BY-ANOTHER-DEVICE") // CAS never blind-clears
  })
})
