// P2-T05 Stage2: tests unitarios del repositorio normalizado de push
// subscriptions — DB reemplazada por un fake en memoria vía mock.module
// (mismo patrón que src/app/api/operativo/mozo/panel/[slug]/push-subscription/route.test.ts).
// Sin DB real, sin migration aplicada, sin escritura en TESTING.
//
// La concurrencia real entre procesos/conexiones (dos requests HTTP
// concurrentes) sólo puede certificarse contra una DB real con la migration
// aplicada — fuera de alcance de Stage2 (§30/§31 del prompt). Los tests
// MD11/MD52 de esta suite demuestran en cambio dos cosas por separado:
// (a) "call-shape proof": qué argumentos exactos recibe cada llamada a
//     `db.pushSubscription.*` (nunca un `deleteMany`/`delete` cross-actor);
// (b) el comportamiento del repositorio bajo `Promise.all` concurrente
//     contra el fake (JS de un solo hilo: el fake nunca intercala su propia
//     mutación a mitad de camino, así que esto prueba la FORMA de la llamada
//     y la ausencia de duplicados lógicos, no la atomicidad real de Postgres
//     — esa la garantiza `UNIQUE(ownerType,ownerId,channel,endpoint)` +
//     `ON CONFLICT DO UPDATE`, ya verificado estáticamente contra el
//     migration.sql en el test "DB invariant static proof" de abajo).
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

type Row = {
  id: string
  ownerType: string
  ownerId: string
  channel: string
  endpoint: string
  p256dh: string
  auth: string
  expirationTime: Date | null
  createdAt: Date
  updatedAt: Date
}

let rows: Row[]
let idCounter: number
let deleteManyCalls: Array<{ where: Record<string, unknown> }>
let upsertCalls: Array<{ where: Record<string, unknown> }>

function matchesWhere(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)
}

// `mock.module` reemplaza @/lib/db ANTES de que el repositorio lo importe
// (import dinámico más abajo), mismo patrón ya usado en el resto del repo
// para este tipo de test.
mock.module("@/lib/db", () => ({
  db: {
    pushSubscription: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { ownerType_ownerId_channel_endpoint: { ownerType: string; ownerId: string; channel: string; endpoint: string } }
        create: Omit<Row, "id" | "createdAt" | "updatedAt">
        update: Partial<Row>
      }) => {
        const key = where.ownerType_ownerId_channel_endpoint
        upsertCalls.push({ where: key })
        const existing = rows.find(
          (r) => r.ownerType === key.ownerType && r.ownerId === key.ownerId && r.channel === key.channel && r.endpoint === key.endpoint
        )
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() })
          return existing
        }
        idCounter += 1
        const row: Row = {
          id: `row-${idCounter}`,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        rows.push(row)
        return row
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matchesWhere(r, where)),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => matchesWhere(r, where)) ?? null,
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        deleteManyCalls.push({ where })
        const before = rows.length
        rows = rows.filter((r) => !matchesWhere(r, where))
        return { count: before - rows.length }
      },
    },
  },
}))

const {
  registerPushSubscription,
  getPushSubscriptionsForOwner,
  detachPushSubscriptionByEndpoint,
  sweepDeadPushSubscriptionEndpoint,
  deletePushSubscriptionsForOwner,
  hasPushSubscriptionForOwnerEndpoint,
} = await import("./push-subscription-repository")
const { PushSubscriptionOwnerType, PushSubscriptionChannel } = await import("@prisma/client")

beforeEach(() => {
  rows = []
  idCounter = 0
  deleteManyCalls = []
  upsertCalls = []
})

function owner(ownerType: string, ownerId: string, channel: string = "default") {
  return { ownerType: ownerType as never, ownerId, channel: channel as never }
}

function sub(endpoint: string, p256dh = "p256dh-value", auth = "auth-value") {
  return { endpoint, p256dh, auth, expirationTime: null }
}

describe("registerPushSubscription — multi-device same owner (MD01-MD03)", () => {
  test("MD01: A registra E1 -> 1 row", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    expect(rows.length).toBe(1)
    expect(rows[0].ownerId).toBe("A")
    expect(rows[0].endpoint).toBe("E1")
  })

  test("MD02: A registra E1 otra vez -> sigue 1 row, idempotente", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1", "keys-v1", "auth-v1"))
    await registerPushSubscription(owner("cliente", "A"), sub("E1", "keys-v2", "auth-v2"))
    expect(rows.length).toBe(1)
    expect(rows[0].p256dh).toBe("keys-v2")
    expect(rows[0].auth).toBe("auth-v2")
  })

  test("MD03: A registra E2 -> E1 + E2 coexisten (nunca reemplaza)", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    await registerPushSubscription(owner("cliente", "A"), sub("E2"))
    expect(rows.length).toBe(2)
    const endpoints = rows.map((r) => r.endpoint).sort()
    expect(endpoints).toEqual(["E1", "E2"])
  })

  test("MULTI_DEVICE_STORAGE_MODEL: E2 nunca reemplaza a E1 en la misma fila", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    const afterFirst = [...rows]
    await registerPushSubscription(owner("cliente", "A"), sub("E2"))
    expect(rows.find((r) => r.endpoint === "E1")).toEqual(afterFirst[0])
  })
})

describe("dead endpoint cleanup (MD05-MD06)", () => {
  test("MD05: cleanup de E1 elimina TODAS las rows de E1 sin importar owner", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    await registerPushSubscription(owner("negocio", "B"), sub("E1"))
    await registerPushSubscription(owner("empleado", "C"), sub("E1"))
    const result = await sweepDeadPushSubscriptionEndpoint("E1")
    expect(result.count).toBe(3)
    expect(rows.filter((r) => r.endpoint === "E1").length).toBe(0)
  })

  test("MD06: E2 sobrevive al cleanup de E1", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    await registerPushSubscription(owner("cliente", "A"), sub("E2"))
    await sweepDeadPushSubscriptionEndpoint("E1")
    expect(rows.length).toBe(1)
    expect(rows[0].endpoint).toBe("E2")
  })

  test("DEAD_ENDPOINT_CLEANUP_SCOPE=ALL_BINDINGS_BY_ENDPOINT: el where del deleteMany es solo {endpoint}", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    await sweepDeadPushSubscriptionEndpoint("E1")
    expect(deleteManyCalls).toEqual([{ where: { endpoint: "E1" } }])
  })
})

describe("exact detach (MD07-MD08)", () => {
  test("MD07: A detach E1 -> sólo A:E1 desaparece, A:E2 permanece", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    await registerPushSubscription(owner("cliente", "A"), sub("E2"))
    const result = await detachPushSubscriptionByEndpoint(owner("cliente", "A"), "E1")
    expect(result.detached).toBe(true)
    expect(rows.length).toBe(1)
    expect(rows[0].endpoint).toBe("E2")
  })

  test("MD08 / EXACT_DETACH_CROSS_ACTOR_DELETE=NO: detach de A no borra el binding de B sobre el mismo E1", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    await registerPushSubscription(owner("negocio", "B"), sub("E1"))
    await detachPushSubscriptionByEndpoint(owner("cliente", "A"), "E1")
    expect(rows.length).toBe(1)
    expect(rows[0].ownerType).toBe("negocio")
    expect(rows[0].ownerId).toBe("B")
  })

  test("detach de un endpoint inexistente no rompe y reporta detached=false", async () => {
    const result = await detachPushSubscriptionByEndpoint(owner("cliente", "A"), "E-nunca-existio")
    expect(result.detached).toBe(false)
  })
})

describe("cross-actor same-endpoint coexistence — NO_TRANSFER_MULTI_BIND (MD10, MD39-MD41, MD51, MD55-MD56)", () => {
  test("MD10: Cliente A y Cliente B (mismo ownerType, distinto ownerId) registran el mismo E -> ambas rows sobreviven", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E"))
    await registerPushSubscription(owner("cliente", "B"), sub("E"))
    expect(rows.length).toBe(2)
  })

  test("MD39: same-type personal A/B mismo E bajo policy C1 -> ambos sobreviven", async () => {
    await registerPushSubscription(owner("negocio", "N1"), sub("E"))
    await registerPushSubscription(owner("negocio", "N2"), sub("E"))
    expect(rows.length).toBe(2)
  })

  test("MD40 / MD56: Empleado A + Empleado B + Empleado C comparten un mismo endpoint (terminal compartida) -> las 3 filas sobreviven", async () => {
    await registerPushSubscription(owner("empleado", "E1"), sub("E"))
    await registerPushSubscription(owner("empleado", "E2"), sub("E"))
    await registerPushSubscription(owner("empleado", "E3"), sub("E"))
    expect(rows.length).toBe(3)
  })

  test("MD41 / MD55: Personal (Negocio) + Empleado mismo E -> ambos bindings sobreviven", async () => {
    await registerPushSubscription(owner("negocio", "N1"), sub("E"))
    await registerPushSubscription(owner("empleado", "EMP1"), sub("E"))
    expect(rows.length).toBe(2)
  })

  test("MD51: B registra el endpoint+keys REALES de A (replay) sin ninguna prueba de posesión -> A NO pierde su row", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E-victima", "keys-de-A", "auth-de-A"))
    const snapshotA = { ...rows[0] }

    await registerPushSubscription(owner("cliente", "B"), sub("E-victima", "keys-de-A", "auth-de-A"))

    const rowA = rows.find((r) => r.ownerId === "A")
    expect(rowA).toBeDefined()
    expect(rowA?.endpoint).toBe(snapshotA.endpoint)
    expect(rowA?.p256dh).toBe(snapshotA.p256dh)
    expect(rows.length).toBe(2)
  })

  test("REGISTER_CROSS_ACTOR_DELETE_COUNT=0: ningún register (propio o de otro owner sobre el mismo endpoint) dispara jamás un deleteMany", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E"))
    await registerPushSubscription(owner("negocio", "B"), sub("E"))
    await registerPushSubscription(owner("empleado", "C"), sub("E"))
    await registerPushSubscription(owner("cliente", "A"), sub("E")) // re-registro idempotente
    expect(deleteManyCalls.length).toBe(0)
  })
})

describe("clean logout / account switch (MD53-MD54)", () => {
  test("MD53: A hace detach explícito + B registra el mismo endpoint -> B funciona con su propia row", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E"))
    await detachPushSubscriptionByEndpoint(owner("cliente", "A"), "E")
    await registerPushSubscription(owner("cliente", "B"), sub("E"))
    expect(rows.length).toBe(1)
    expect(rows[0].ownerId).toBe("B")
  })

  test("MD54: A NO hace detach (logout fallido/bypassed) + B registra el mismo E -> ambos coexisten, nunca B destruye a A", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E"))
    await registerPushSubscription(owner("cliente", "B"), sub("E"))
    expect(rows.length).toBe(2)
    expect(rows.some((r) => r.ownerId === "A")).toBe(true)
    expect(rows.some((r) => r.ownerId === "B")).toBe(true)
  })
})

describe("key rotation (MD47)", () => {
  test("MD47 / SAME_ENDPOINT_KEY_ROTATION_UPDATES_ROW: mismo endpoint con p256dh/auth nuevos actualiza la misma row, nunca duplica", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E", "keys-viejas", "auth-vieja"))
    const idAntes = rows[0].id
    await registerPushSubscription(owner("cliente", "A"), sub("E", "keys-nuevas", "auth-nueva"))
    expect(rows.length).toBe(1)
    expect(rows[0].id).toBe(idAntes)
    expect(rows[0].p256dh).toBe("keys-nuevas")
    expect(rows[0].auth).toBe("auth-nueva")
  })
})

describe("concurrent register — call-shape proof (MD11 / MD52)", () => {
  test("dos register concurrentes del MISMO owner+endpoint con keys distintas -> 1 row final, sin duplicar, sin mezclar valores", async () => {
    const [rowA, rowB] = await Promise.all([
      registerPushSubscription(owner("cliente", "A"), sub("E", "keys-call-1", "auth-call-1")),
      registerPushSubscription(owner("cliente", "A"), sub("E", "keys-call-2", "auth-call-2")),
    ])

    expect(rows.length).toBe(1)
    // El estado final corresponde íntegramente a UNA de las dos llamadas
    // completas (nunca p256dh de una call mezclado con auth de la otra).
    const finalRow = rows[0]
    const matchesCall1 = finalRow.p256dh === "keys-call-1" && finalRow.auth === "auth-call-1"
    const matchesCall2 = finalRow.p256dh === "keys-call-2" && finalRow.auth === "auth-call-2"
    expect(matchesCall1 || matchesCall2).toBe(true)
    expect(rowA.id).toBe(rowB.id)
    expect(deleteManyCalls.length).toBe(0)
  })

  test("DB invariant static proof: el UNIQUE(ownerType,ownerId,channel,endpoint) existe en la migration expand-only, sin unique global/parcial sobre endpoint", () => {
    const migrationPath = join(
      import.meta.dir,
      "..",
      "..",
      "prisma",
      "migrations",
      "20260824220000_add_push_subscription_model",
      "migration.sql"
    )
    const sql = readFileSync(migrationPath, "utf8")
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "push_subscriptions_ownerType_ownerId_channel_endpoint_key" ON "push_subscriptions"("ownerType", "ownerId", "channel", "endpoint");'
    )
    // Nunca debe existir un unique index parcial ni un unique global sólo
    // sobre "endpoint" (retirado explícitamente en P2-T05 Stage1C).
    expect(sql).not.toMatch(/UNIQUE INDEX[^;]*\("endpoint"\)/)
    expect(sql.toUpperCase()).not.toContain("WHERE")
    expect(sql.toUpperCase()).not.toMatch(/\bDELETE\b|\bUPDATE\b|\bDROP\b|\bTRUNCATE\b/)
  })
})

describe("getPushSubscriptionsForOwner", () => {
  test("devuelve únicamente las filas del owner+channel exactos, nunca de otros owners", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    await registerPushSubscription(owner("cliente", "A"), sub("E2"))
    await registerPushSubscription(owner("negocio", "B"), sub("E3"))

    const result = await getPushSubscriptionsForOwner(owner("cliente", "A"))
    expect(result.length).toBe(2)
    expect(result.every((r) => r.ownerType === "cliente" && r.ownerId === "A")).toBe(true)
  })

  test("channel distinto del mismo owner no se mezcla (Negocio personal vs salon)", async () => {
    await registerPushSubscription(owner("negocio", "N1", "default"), sub("E-personal"))
    await registerPushSubscription(owner("negocio", "N1", "salon"), sub("E-salon"))

    const personal = await getPushSubscriptionsForOwner(owner("negocio", "N1", "default"))
    const salon = await getPushSubscriptionsForOwner(owner("negocio", "N1", "salon"))
    expect(personal.length).toBe(1)
    expect(personal[0].endpoint).toBe("E-personal")
    expect(salon.length).toBe(1)
    expect(salon[0].endpoint).toBe("E-salon")
  })
})

describe("SAME_OWNER_MULTI_CHANNEL_STORAGE — mismo owner, mismo endpoint físico, distinto channel", () => {
  test("Negocio N1/default/E + Negocio N1/salon/E -> 2 filas lógicas permitidas (el UNIQUE incluye channel)", async () => {
    await registerPushSubscription(owner("negocio", "N1", "default"), sub("E"))
    await registerPushSubscription(owner("negocio", "N1", "salon"), sub("E"))

    expect(rows.length).toBe(2)
    const defaultRows = await getPushSubscriptionsForOwner(owner("negocio", "N1", "default"))
    const salonRows = await getPushSubscriptionsForOwner(owner("negocio", "N1", "salon"))
    expect(defaultRows.length).toBe(1)
    expect(salonRows.length).toBe(1)
    expect(defaultRows[0].id).not.toBe(salonRows[0].id)
  })
})

describe("deletePushSubscriptionsForOwner", () => {
  test("borra todas las filas del owner a través de todos sus channels, sin tocar otros owners", async () => {
    await registerPushSubscription(owner("negocio", "N1", "default"), sub("E-personal"))
    await registerPushSubscription(owner("negocio", "N1", "salon"), sub("E-salon"))
    await registerPushSubscription(owner("cliente", "A"), sub("E-otro-actor"))

    const result = await deletePushSubscriptionsForOwner({ ownerType: "negocio" as never, ownerId: "N1" })
    expect(result.count).toBe(2)
    expect(rows.length).toBe(1)
    expect(rows[0].ownerId).toBe("A")
  })
})

describe("CHANNEL_ENUM_SCHEMA_CONTRACT (MD57)", () => {
  test("PushSubscriptionChannel generado por Prisma es exactamente {default, salon}", () => {
    expect(Object.values(PushSubscriptionChannel).sort()).toEqual(["default", "salon"])
  })

  test("PushSubscriptionOwnerType generado por Prisma es exactamente {cliente, negocio, repartidor, empleado}", () => {
    expect(Object.values(PushSubscriptionOwnerType).sort()).toEqual(["cliente", "empleado", "negocio", "repartidor"])
  })

  test("registerPushSubscription rechaza un channel fuera del enum (fail closed)", async () => {
    await expect(
      registerPushSubscription(owner("cliente", "A", "no-existe" as never), sub("E"))
    ).rejects.toThrow()
  })

  test("registerPushSubscription rechaza un ownerType fuera del enum (fail closed)", async () => {
    await expect(
      registerPushSubscription(owner("no-existe" as never, "A"), sub("E"))
    ).rejects.toThrow()
  })
})

describe("runtime validation — inputs evidentemente inválidos", () => {
  test("rechaza ownerId vacío", async () => {
    await expect(registerPushSubscription(owner("cliente", ""), sub("E"))).rejects.toThrow()
  })

  test("rechaza endpoint vacío", async () => {
    await expect(registerPushSubscription(owner("cliente", "A"), sub(""))).rejects.toThrow()
  })

  test("rechaza p256dh vacío", async () => {
    await expect(registerPushSubscription(owner("cliente", "A"), sub("E", ""))).rejects.toThrow()
  })

  test("rechaza auth vacío", async () => {
    await expect(registerPushSubscription(owner("cliente", "A"), sub("E", "keys", ""))).rejects.toThrow()
  })

  test("detachPushSubscriptionByEndpoint rechaza endpoint vacío", async () => {
    await expect(detachPushSubscriptionByEndpoint(owner("cliente", "A"), "")).rejects.toThrow()
  })

  test("sweepDeadPushSubscriptionEndpoint rechaza endpoint vacío", async () => {
    await expect(sweepDeadPushSubscriptionEndpoint("")).rejects.toThrow()
  })
})

describe("REPOSITORY_ASSUMES_ENDPOINT_PROOF_OF_POSSESSION=NO (MD58)", () => {
  test("registerPushSubscription no exige ningún parámetro de desafío/posesión más allá de endpoint+keys — su firma es (owner, {endpoint,p256dh,auth,expirationTime})", async () => {
    // Prueba por construcción: dos owners distintos completan exitosamente
    // el registro del MISMO endpoint+keys sin que la función exija ningún
    // dato adicional de "prueba de control físico" — exactamente el mismo
    // input que P0 ya documentó como no-verificado en las 4 rutas HTTP.
    await registerPushSubscription(owner("cliente", "A"), sub("E", "k", "a"))
    await registerPushSubscription(owner("negocio", "B"), sub("E", "k", "a"))
    expect(rows.length).toBe(2)
  })
})

// P2-T05 Stage3 (§11/§27 del prompt): las rutas HTTP con dual-write
// necesitan que `registerPushSubscription`/`detachPushSubscriptionByEndpoint`
// participen en la MISMA transacción que su escritura legacy. Estos focales
// prueban DOS cosas por separado: (a) el default sigue siendo compatible
// (todos los 36+ tests de arriba ya lo prueban implícitamente, al no pasar
// un tercer argumento); (b) cuando SÍ se pasa un client explícito, la llamada
// aterriza en ESE objeto — nunca silenciosamente en el singleton `db` — vía
// dos contadores de llamadas completamente independientes (dbClient vs
// txClient), respaldados por el MISMO array `rows` subyacente.
describe("transaction client support (Stage3 §11/§27) — default vs injected", () => {
  let txUpsertCalls: number
  let txDeleteManyCalls: number

  function makeTxClient() {
    return {
      pushSubscription: {
        upsert: async (args: {
          where: { ownerType_ownerId_channel_endpoint: { ownerType: string; ownerId: string; channel: string; endpoint: string } }
          create: Omit<Row, "id" | "createdAt" | "updatedAt">
          update: Partial<Row>
        }) => {
          txUpsertCalls += 1
          return realDbUpsert(args)
        },
        deleteMany: async (args: { where: Record<string, unknown> }) => {
          txDeleteManyCalls += 1
          return realDbDeleteMany(args)
        },
        findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matchesWhere(r, where)),
      },
    }
  }

  // Re-implementa la MISMA lógica del mock de @/lib/db (arriba) para que el
  // txClient opere sobre el mismo `rows` array sin depender del objeto `db`
  // mockeado — así los dos contadores (upsertCalls del db-mock vs
  // txUpsertCalls de acá) son verdaderamente independientes.
  function realDbUpsert({
    where,
    create,
    update,
  }: {
    where: { ownerType_ownerId_channel_endpoint: { ownerType: string; ownerId: string; channel: string; endpoint: string } }
    create: Omit<Row, "id" | "createdAt" | "updatedAt">
    update: Partial<Row>
  }) {
    const key = where.ownerType_ownerId_channel_endpoint
    const existing = rows.find(
      (r) => r.ownerType === key.ownerType && r.ownerId === key.ownerId && r.channel === key.channel && r.endpoint === key.endpoint
    )
    if (existing) {
      Object.assign(existing, update, { updatedAt: new Date() })
      return existing
    }
    idCounter += 1
    const row: Row = { id: `tx-row-${idCounter}`, ...create, createdAt: new Date(), updatedAt: new Date() }
    rows.push(row)
    return row
  }

  function realDbDeleteMany({ where }: { where: Record<string, unknown> }) {
    const before = rows.length
    rows = rows.filter((r) => !matchesWhere(r, where))
    return { count: before - rows.length }
  }

  beforeEach(() => {
    txUpsertCalls = 0
    txDeleteManyCalls = 0
  })

  test("default client compatibility: omitting the 3rd arg still uses the @/lib/db singleton mock", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    expect(upsertCalls.length).toBe(1)
    expect(txUpsertCalls).toBe(0)
  })

  test("injected transaction client is used for register — never escapes to the default singleton", async () => {
    const tx = makeTxClient()
    await registerPushSubscription(owner("cliente", "A"), sub("E1"), tx as never)

    expect(txUpsertCalls).toBe(1)
    expect(upsertCalls.length).toBe(0) // NORMALIZED_WRITE_ESCAPES_TRANSACTION=NO
    expect(rows.length).toBe(1)
    expect(rows[0].endpoint).toBe("E1")
  })

  test("injected transaction client is used for detach — never escapes to the default singleton", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    expect(rows.length).toBe(1)

    const tx = makeTxClient()
    const result = await detachPushSubscriptionByEndpoint(owner("cliente", "A"), "E1", tx as never)

    expect(result.detached).toBe(true)
    expect(txDeleteManyCalls).toBe(1)
    expect(deleteManyCalls.length).toBe(0) // NORMALIZED_WRITE_ESCAPES_TRANSACTION=NO
    expect(rows.length).toBe(0)
  })

  test("register + detach semantics stay intact through an injected client (multi-device, exact-match)", async () => {
    const tx = makeTxClient()
    await registerPushSubscription(owner("cliente", "A"), sub("E1"), tx as never)
    await registerPushSubscription(owner("cliente", "A"), sub("E2"), tx as never)
    expect(rows.length).toBe(2)

    const detached = await detachPushSubscriptionByEndpoint(owner("cliente", "A"), "E1", tx as never)
    expect(detached.detached).toBe(true)
    expect(rows.length).toBe(1)
    expect(rows[0].endpoint).toBe("E2")
  })

  test("sweepDeadPushSubscriptionEndpoint semantics stay intact (no transaction client param — global by design)", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E_DEAD"))
    await registerPushSubscription(owner("negocio", "B"), sub("E_DEAD"))
    await registerPushSubscription(owner("cliente", "A"), sub("E_ALIVE"))

    const result = await sweepDeadPushSubscriptionEndpoint("E_DEAD")
    expect(result.count).toBe(2)
    expect(rows.length).toBe(1)
    expect(rows[0].endpoint).toBe("E_ALIVE")
  })
})

// P2-T05 Stage3R1 (F-P2-T05-12/13): existence-check focal — usada por
// POST /api/push/status para responder únicamente sobre el owner+endpoint
// exactos, nunca "el actor tiene alguna subscription".
describe("hasPushSubscriptionForOwnerEndpoint (Stage3R1)", () => {
  test("true: exact owner/channel/endpoint match", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    expect(await hasPushSubscriptionForOwnerEndpoint(owner("cliente", "A"), "E1")).toBe(true)
  })

  test("false: different endpoint, same owner", async () => {
    await registerPushSubscription(owner("cliente", "A"), sub("E1"))
    expect(await hasPushSubscriptionForOwnerEndpoint(owner("cliente", "A"), "E2")).toBe(false)
  })

  test("false: different owner, same endpoint (cross-actor never leaks true)", async () => {
    await registerPushSubscription(owner("negocio", "B"), sub("E1"))
    expect(await hasPushSubscriptionForOwnerEndpoint(owner("cliente", "A"), "E1")).toBe(false)
  })

  test("false: different channel, same owner+endpoint", async () => {
    await registerPushSubscription({ ownerType: "negocio" as never, ownerId: "A", channel: "salon" as never }, sub("E1"))
    expect(await hasPushSubscriptionForOwnerEndpoint(owner("negocio", "A", "default"), "E1")).toBe(false)
  })

  test("false: no rows at all for this owner", async () => {
    expect(await hasPushSubscriptionForOwnerEndpoint(owner("cliente", "A"), "E1")).toBe(false)
  })

  test("rejects invalid owner/endpoint the same way as other primitives", async () => {
    await expect(hasPushSubscriptionForOwnerEndpoint(owner("cliente", ""), "E1")).rejects.toThrow()
    await expect(hasPushSubscriptionForOwnerEndpoint(owner("cliente", "A"), "")).rejects.toThrow()
  })
})
