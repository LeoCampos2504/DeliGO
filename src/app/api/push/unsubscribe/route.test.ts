// P2-T05 Stage3 (F-P2-T05-03): fully isolated unit tests for
// POST /api/push/unsubscribe — no real DB. Same mock pattern as
// src/app/api/push/subscribe/route.test.ts, extended with a normalized
// push_subscriptions store that supports exact-match deleteMany (mirroring
// detachPushSubscriptionByEndpoint's real query shape).
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { authMockState, installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

type ActorRow = { id: string; pushSubscription: string | null }
type PushRow = {
  id: string
  ownerType: string
  ownerId: string
  channel: string
  endpoint: string
  p256dh: string
  auth: string
}

let clienteRows: ActorRow[]
let negocioRows: ActorRow[]
let repartidorRows: ActorRow[]
let superAdminRows: ActorRow[]
let pushRows: PushRow[]
let idCounter: number
let singletonDeleteManyCalls: number
let txDeleteManyCalls: number

function matchWhere(rows: ActorRow[], id: string, pushSubscription?: string) {
  return rows.find((r) => r.id === id && (pushSubscription === undefined || r.pushSubscription === pushSubscription))
}

function pushDeleteManyImpl(where: Record<string, unknown>) {
  const before = pushRows.length
  pushRows = pushRows.filter((r) => !Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
  return { count: before - pushRows.length }
}

// P2-T05 Stage3H3R1 (F-P2-T05-17): `findUnique` fue agregado para que el
// mock pueda modelar el fallback semántico CAS (leer el valor legacy actual
// antes del clear condicional) con la MISMA fidelidad que ya tenía
// `updateMany` para el exact-match — nunca se asume que el mock deba ser más
// permisivo que Prisma real. Recibe un GETTER (no el array directamente)
// porque `beforeEach` REASIGNA las variables `let` de nivel módulo en cada
// test — capturar el array por valor en `makeClient()` (llamado una única
// vez al cargar el módulo, antes del primer `beforeEach`) apuntaría para
// siempre al array vacío/undefined inicial.
function makeActorModelMock(getRows: () => ActorRow[]) {
  return {
    updateMany: async ({ where, data }: { where: { id: string; pushSubscription?: string }; data: { pushSubscription: string | null } }) => {
      const row = matchWhere(getRows(), where.id, where.pushSubscription)
      if (!row) return { count: 0 }
      row.pushSubscription = data.pushSubscription
      return { count: 1 }
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = getRows().find((r) => r.id === where.id)
      return row ? { pushSubscription: row.pushSubscription } : null
    },
  }
}

function makeClient(kind: "singleton" | "tx") {
  return {
    cliente: makeActorModelMock(() => clienteRows),
    negocio: makeActorModelMock(() => negocioRows),
    repartidor: makeActorModelMock(() => repartidorRows),
    superAdmin: makeActorModelMock(() => superAdminRows),
    pushSubscription: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (kind === "singleton") singletonDeleteManyCalls += 1
        else txDeleteManyCalls += 1
        return pushDeleteManyImpl(where)
      },
    },
  }
}

const singletonClient = makeClient("singleton")
const txClient = makeClient("tx")

mock.module("@/lib/db", () => ({
  db: {
    ...singletonClient,
    // P2-T05 Stage3H3R1 (F-P2-T05-17, G-R1-14): snapshot + rollback-on-throw,
    // mismo patrón ya certificado en push/subscribe/route.test.ts — sin esto
    // el mock no puede demostrar honestamente que un fallo del detach
    // normalizado revierte el clear semántico legacy ya aplicado dentro de
    // la misma transacción.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = {
        cliente: structuredClone(clienteRows),
        negocio: structuredClone(negocioRows),
        repartidor: structuredClone(repartidorRows),
        superAdmin: structuredClone(superAdminRows),
        push: structuredClone(pushRows),
      }
      try {
        return await fn(txClient)
      } catch (e) {
        clienteRows = snapshot.cliente
        negocioRows = snapshot.negocio
        repartidorRows = snapshot.repartidor
        superAdminRows = snapshot.superAdmin
        pushRows = snapshot.push
        throw e
      }
    },
  },
}))

// P2-T05 Hardening H4 (F-P2-T05-22): canonical superset mock — see the
// identical comment in src/app/api/push/subscribe/route.test.ts and
// src/lib/test-helpers/auth-mock.ts.
installAuthMock()

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { POST } = await import("./route")

function callUnsubscribe(subscription: unknown, ip: string) {
  return POST(
    new NextRequest("http://localhost/api/push/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip, cookie: "deligo_session=valid-token" },
      body: JSON.stringify({ subscription }),
    })
  )
}

function subJson(endpoint: string, p256dh = "p", auth = "a") {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh, auth } })
}

// P2-T05 Stage3H3R1: representación OBJETO (nunca stringificada por el test)
// de la misma subscription — usada para probar el contrato object→* de
// F-P2-T05-17.
function subObj(endpoint: string, p256dh = "p", auth = "a", expirationTime: number | null = null) {
  return { endpoint, expirationTime, keys: { p256dh, auth } }
}

// Mismo contenido lógico que subJson, pero con property order/whitespace
// deliberadamente distinto del orden canónico — para probar que la
// comparación semántica ignora la serialización, no sólo el valor.
function subJsonDifferentOrder(endpoint: string, p256dh = "p", auth = "a") {
  return JSON.stringify({ keys: { auth, p256dh }, endpoint, expirationTime: null })
}

let idc = 0
function pushRow(ownerType: string, ownerId: string, endpoint: string): PushRow {
  idc += 1
  return { id: `push-${idc}`, ownerType, ownerId, channel: "default", endpoint, p256dh: "p", auth: "a" }
}

beforeEach(() => {
  clienteRows = [{ id: "cliente-1", pushSubscription: null }]
  negocioRows = [{ id: "negocio-1", pushSubscription: null }]
  repartidorRows = [{ id: "repartidor-1", pushSubscription: null }]
  superAdminRows = [{ id: "superadmin-1", pushSubscription: null }]
  pushRows = []
  idCounter = 0
  idc = 0
  singletonDeleteManyCalls = 0
  txDeleteManyCalls = 0
  resetAuthMockState()
})

describe("POST /api/push/unsubscribe — multi-device stale-device semantics (§17)", () => {
  test("stale device E1 detaches its own normalized row without requiring legacy exact-match", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const e1 = subJson("https://push.example/E1")
    const e2 = subJson("https://push.example/E2")
    clienteRows[0].pushSubscription = e2 // legacy currently holds the NEWER device (last-write-wins)
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1"), pushRow("cliente", "cliente-1", "https://push.example/E2")]

    const res = await callUnsubscribe(e1, "203.0.113.40")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true }) // normalizedRemoved=true even though legacy didn't match
    expect(clienteRows[0].pushSubscription).toBe(e2) // STALE_DEVICE_CAN_CLEAR_NEWER_LEGACY_BINDING=NO
    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/E2"]) // E1 gone, E2 survives
  })

  test("cross-actor: unsubscribe from A never touches B's binding on the same endpoint", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const shared = subJson("https://push.example/SHARED")
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/SHARED"), pushRow("negocio", "negocio-1", "https://push.example/SHARED")]

    const res = await callUnsubscribe(shared, "203.0.113.41")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.removed).toBe(true)
    expect(pushRows.length).toBe(1)
    expect(pushRows[0].ownerType).toBe("negocio") // B's binding survives untouched
  })

  test("both legacy and normalized removed in the same transaction, never the singleton", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const e1 = subJson("https://push.example/E1")
    clienteRows[0].pushSubscription = e1
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1")]

    const res = await callUnsubscribe(e1, "203.0.113.42")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(clienteRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
    expect(txDeleteManyCalls).toBe(1)
    expect(singletonDeleteManyCalls).toBe(0) // NORMALIZED_WRITE_ESCAPES_TRANSACTION=NO
  })

  test("no subscription in body -> removed:false, no writes (unchanged legacy contract)", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callUnsubscribe(undefined, "203.0.113.43")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(pushRows.length).toBe(0)
  })

  test("neither legacy nor normalized match -> removed:false", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const other = subJson("https://push.example/UNKNOWN")
    const res = await callUnsubscribe(other, "203.0.113.44")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
  })

  test("USER_UNSUBSCRIBE_CAN_CALL_GLOBAL_DEAD_ENDPOINT_SWEEP=NO: only the caller's own owner scope is ever touched", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const shared = subJson("https://push.example/SHARED")
    pushRows = [
      pushRow("cliente", "cliente-1", "https://push.example/SHARED"),
      pushRow("cliente", "cliente-OTHER", "https://push.example/SHARED"),
      pushRow("negocio", "negocio-1", "https://push.example/SHARED"),
    ]
    await callUnsubscribe(shared, "203.0.113.45")
    expect(pushRows.length).toBe(2) // only cliente-1's own row is gone
    expect(pushRows.some((r) => r.ownerId === "cliente-OTHER")).toBe(true)
    expect(pushRows.some((r) => r.ownerType === "negocio")).toBe(true)
  })
})

describe("POST /api/push/unsubscribe — Stage3H3R1 symmetric semantic detach (F-P2-T05-17)", () => {
  test("G-R1-01: object subscribe contract -> object unsubscribe -> FULL DETACH (Cliente)", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const endpoint = "https://push.example/OBJ-OBJ"
    clienteRows[0].pushSubscription = subJson(endpoint) // legacy stored as canonical (H3 object-subscribe outcome)
    pushRows = [pushRow("cliente", "cliente-1", endpoint)]

    const res = await callUnsubscribe(subObj(endpoint), "203.0.113.50")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(clienteRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })

  test("G-R1-02: object-subscribe canonical legacy -> string unsubscribe with different property order -> FULL DETACH", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const endpoint = "https://push.example/OBJ-STR"
    clienteRows[0].pushSubscription = subJson(endpoint) // canonical order
    pushRows = [pushRow("cliente", "cliente-1", endpoint)]

    const res = await callUnsubscribe(subJsonDifferentOrder(endpoint), "203.0.113.51")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(clienteRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })

  test("G-R1-03: non-canonical raw string legacy (byte-preserved by H3) -> object unsubscribe -> FULL DETACH via semantic CAS", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const endpoint = "https://push.example/STR-OBJ"
    const nonCanonical = subJsonDifferentOrder(endpoint) // what H3 would have preserved byte-for-byte
    clienteRows[0].pushSubscription = nonCanonical
    pushRows = [pushRow("cliente", "cliente-1", endpoint)]

    const res = await callUnsubscribe(subObj(endpoint), "203.0.113.52")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(clienteRows[0].pushSubscription).toBeNull() // OBJECT_UNSUBSCRIBE_CAN_LEAVE_ACTIVE_LEGACY_SEND_BINDING=NO after R1
    expect(pushRows.length).toBe(0)
  })

  test("G-R1-04: extra client-supplied properties on the object never block semantic detach", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const endpoint = "https://push.example/EXTRAS"
    clienteRows[0].pushSubscription = subJson(endpoint)
    pushRows = [pushRow("cliente", "cliente-1", endpoint)]

    const withExtras = { ...subObj(endpoint), ownerId: "attacker-controlled", channel: "salon", extra: { nested: true } }
    const res = await callUnsubscribe(withExtras, "203.0.113.53")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(clienteRows[0].pushSubscription).toBeNull()
  })

  test("G-R1-05: stale device (different endpoint) cannot clear the current newer legacy binding via semantic fallback", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    clienteRows[0].pushSubscription = subJson("https://push.example/NEWER")
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/STALE"), pushRow("cliente", "cliente-1", "https://push.example/NEWER")]

    const res = await callUnsubscribe(subObj("https://push.example/STALE"), "203.0.113.54")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true }) // normalized own detach still makes removed:true
    expect(clienteRows[0].pushSubscription).toBe(subJson("https://push.example/NEWER")) // STALE_DEVICE_CAN_CLEAR_NEWER_LEGACY_BINDING_AFTER_R1=NO
    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/NEWER"])
  })

  test("G-R1-06: same endpoint but rotated keys cannot clear the newer legacy binding (endpoint-only comparison would wrongly match)", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const endpoint = "https://push.example/ROTATED"
    clienteRows[0].pushSubscription = subJson(endpoint, "NEW_P256DH", "NEW_AUTH")
    pushRows = [pushRow("cliente", "cliente-1", endpoint)]

    const res = await callUnsubscribe(subObj(endpoint, "OLD_P256DH", "OLD_AUTH"), "203.0.113.55")
    const body = await res.json()

    expect(res.status).toBe(200)
    // La generación almacenada no coincide con la solicitada: ni el binding
    // normalizado ni el legacy más nuevo pueden ser retirados por keys viejas.
    expect(body).toEqual({ ok: true, removed: false })
    expect(pushRows).toHaveLength(1)
    expect(clienteRows[0].pushSubscription).toBe(subJson(endpoint, "NEW_P256DH", "NEW_AUTH")) // OLD_KEYS_CAN_CLEAR_NEWER_SAME_ENDPOINT_LEGACY=NO
  })

  test("G-R1-07: normalized own-device detach succeeds while a different device's legacy binding remains (multi-device)", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    clienteRows[0].pushSubscription = subJson("https://push.example/E2")
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1"), pushRow("cliente", "cliente-1", "https://push.example/E2")]

    await callUnsubscribe(subObj("https://push.example/E1"), "203.0.113.56")

    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/E2"]) // NEWER_LEGACY_DEVICE_PRESERVED_AFTER_R1=PASS
  })

  test("G-R1-08: cross-actor isolation preserved for object-contract unsubscribe on a shared endpoint", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const shared = "https://push.example/SHARED-OBJ"
    pushRows = [pushRow("cliente", "cliente-1", shared), pushRow("negocio", "negocio-1", shared)]

    await callUnsubscribe(subObj(shared), "203.0.113.57")

    expect(pushRows.length).toBe(1)
    expect(pushRows[0].ownerType).toBe("negocio") // CROSS_ACTOR_UNSUBSCRIBE_ISOLATION_AFTER_R1=PASS
  })

  test("G-R1-09: Negocio object subscribe/unsubscribe symmetry", async () => {
    authMockState.currentUser = { id: "negocio-1", type: "negocio" }
    const endpoint = "https://push.example/NEGOCIO-OBJ"
    negocioRows[0].pushSubscription = subJson(endpoint)
    pushRows = [pushRow("negocio", "negocio-1", endpoint)]

    const res = await callUnsubscribe(subObj(endpoint), "203.0.113.58")
    const body = await res.json()

    expect(body).toEqual({ ok: true, removed: true })
    expect(negocioRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })

  test("G-R1-10: Repartidor object subscribe/unsubscribe symmetry", async () => {
    authMockState.currentUser = { id: "repartidor-1", type: "repartidor" }
    const endpoint = "https://push.example/REPARTIDOR-OBJ"
    repartidorRows[0].pushSubscription = subJson(endpoint)
    pushRows = [pushRow("repartidor", "repartidor-1", endpoint)]

    const res = await callUnsubscribe(subObj(endpoint), "203.0.113.59")
    const body = await res.json()

    expect(body).toEqual({ ok: true, removed: true })
    expect(repartidorRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })

  test("G-R1-11: SuperAdmin object unsubscribe clears legacy-only, no normalized owner ever attempted", async () => {
    authMockState.currentUser = { id: "superadmin-1", type: "superadmin" }
    const endpoint = "https://push.example/SUPERADMIN-OBJ"
    superAdminRows[0].pushSubscription = subJson(endpoint)

    const res = await callUnsubscribe(subObj(endpoint), "203.0.113.60")
    const body = await res.json()

    expect(body).toEqual({ ok: true, removed: true })
    expect(superAdminRows[0].pushSubscription).toBeNull()
    expect(txDeleteManyCalls).toBe(0) // SUPERADMIN_NORMALIZED_WRITE_ATTEMPTED=NO
    expect(singletonDeleteManyCalls).toBe(0)
  })

  test("G-R1-12: missing subscription still preserves the generic no-op contract (unchanged)", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callUnsubscribe(undefined, "203.0.113.61")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
  })

  test("G-R1-13: malformed object (missing required shape) fails closed with 400, no write attempted", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    clienteRows[0].pushSubscription = subJson("https://push.example/UNTOUCHED")

    const res = await callUnsubscribe({ foo: "bar" }, "203.0.113.62")
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ error: "subscription debe ser un JSON válido" })
    expect(clienteRows[0].pushSubscription).toBe(subJson("https://push.example/UNTOUCHED"))
  })

  test("G-R1-14: normalized detach failure rolls back the legacy semantic clear (atomicity preserved)", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const endpoint = "https://push.example/ROLLBACK"
    const nonCanonical = subJsonDifferentOrder(endpoint)
    clienteRows[0].pushSubscription = nonCanonical
    pushRows = [pushRow("cliente", "cliente-1", endpoint)]

    const originalDeleteMany = txClient.pushSubscription.deleteMany
    txClient.pushSubscription.deleteMany = async () => {
      throw new Error("simulated normalized write failure (H3R1)")
    }
    try {
      const res = await callUnsubscribe(subObj(endpoint), "203.0.113.63")
      expect(res.status).toBe(500)
    } finally {
      txClient.pushSubscription.deleteMany = originalDeleteMany
    }

    expect(clienteRows[0].pushSubscription).toBe(nonCanonical) // legacy clear rolled back, never partially committed
    expect(pushRows.length).toBe(1)
  })

  test("G-R1-15: legacy value changed between read and write -> CAS does not blind-clear the new value", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const endpoint = "https://push.example/RACE"
    const originalRaw = subJsonDifferentOrder(endpoint)
    clienteRows[0].pushSubscription = originalRaw
    pushRows = [pushRow("cliente", "cliente-1", endpoint)]

    const originalFindUnique = txClient.cliente.findUnique
    txClient.cliente.findUnique = async (...args: Parameters<typeof originalFindUnique>) => {
      const result = await originalFindUnique(...args)
      clienteRows[0].pushSubscription = "RACED-IN-BY-ANOTHER-DEVICE"
      return result
    }
    try {
      const res = await callUnsubscribe(subObj(endpoint), "203.0.113.64")
      const body = await res.json()
      expect(body.removed).toBe(true) // normalized own detach still succeeds
    } finally {
      txClient.cliente.findUnique = originalFindUnique
    }

    expect(clienteRows[0].pushSubscription).toBe("RACED-IN-BY-ANOTHER-DEVICE") // LEGACY_SEMANTIC_CLEAR_USES_COMPARE_AND_SET=SI
  })

  test("G-R1-16: removed:true is truthful — no same-logical-subscription legacy binding survives after a full object detach", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const endpoint = "https://push.example/TRUTHFUL"
    clienteRows[0].pushSubscription = subJsonDifferentOrder(endpoint)
    pushRows = [pushRow("cliente", "cliente-1", endpoint)]

    const res = await callUnsubscribe(subObj(endpoint), "203.0.113.65")
    const body = await res.json()

    expect(body.removed).toBe(true)
    expect(clienteRows[0].pushSubscription).toBeNull() // REMOVED_TRUE_CAN_LEAVE_SAME_LOGICAL_ACTIVE_LEGACY_BINDING=NO
  })
})
