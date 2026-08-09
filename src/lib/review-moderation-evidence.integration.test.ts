/// <reference types="bun-types" />

// ============================================
// DeliGO — 19-F2B: cuotas de evidencia bajo concurrencia PostgreSQL real
// ============================================
// Usa el core REAL (createReviewModerationEvidence) contra PostgreSQL TESTING
// real — nunca mockea Prisma para las carreras. Solo el storage es fake
// (in-memory, con estado): nunca se llama a Cloudinary. Todo fixture usa el
// prefijo `test-t19f2b-` y se limpia en `afterAll`.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT,
  REVIEW_MODERATION_EVIDENCE_MAX_PER_REQUEST,
} from "@/lib/review-moderation-evidence-file"
import {
  ReviewModerationEvidenceConflictError,
  createReviewModerationEvidence,
  type ReviewModerationEvidenceStorage,
} from "@/lib/review-moderation-evidence"

// PostgreSQL TESTING remoto + Serializable + reintentos puede exceder el
// default de Bun sin indicar ningún fallo funcional.
setDefaultTimeout(60_000)

const prefix = "test-t19f2b-"
const MiB = 1024 * 1024

let negocioId = ""

// ---------------------------------------------------------------------------
// Fake storage con estado (sección 8) — nunca Cloudinary.
// ---------------------------------------------------------------------------

function createFakeStorage() {
  const active = new Set<string>()
  const calls = { put: 0, delete: 0, get: 0 }
  const storage: ReviewModerationEvidenceStorage = {
    put: async ({ storageKey }) => {
      calls.put += 1
      active.add(storageKey)
      return { storageKey }
    },
    get: async () => {
      calls.get += 1
      return new Uint8Array([1, 2, 3])
    },
    delete: async ({ storageKey }) => {
      calls.delete += 1
      active.delete(storageKey)
    },
  }
  return { storage, calls, active }
}

function storageKeyGenerator() {
  return `${prefix}storage-${randomUUID()}`
}

function file(bytes: number, suffix: string) {
  return {
    bytes: new Uint8Array(bytes),
    mimeType: "image/png",
    nombrePresentacion: `${prefix}${suffix}.png`,
    sha256: `${prefix}sha-${suffix}`,
  }
}

// ---------------------------------------------------------------------------
// Spy de transacciones (sección 13/19) — observa P2034 real sin alterar el
// comportamiento: reenvía la llamada real a Prisma, nunca la reemplaza.
// ---------------------------------------------------------------------------

function spyOnTransactions() {
  const original = db.$transaction.bind(db)
  let attempts = 0
  let p2034Observed = false
  ;(db as unknown as { $transaction: typeof db.$transaction }).$transaction = (async (...args: Parameters<typeof db.$transaction>) => {
    attempts += 1
    try {
      return await original(...args)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") p2034Observed = true
      throw error
    }
  }) as typeof db.$transaction
  return {
    attempts: () => attempts,
    p2034Observed: () => p2034Observed,
    restore: () => {
      ;(db as unknown as { $transaction: typeof db.$transaction }).$transaction = original
    },
  }
}

// ---------------------------------------------------------------------------
// Fixtures (sección 9) — únicamente lo que el core exige.
// ---------------------------------------------------------------------------

async function createEligibleSolicitud(suffix: string) {
  const pedido = await db.pedido.create({
    data: {
      negocioId,
      negocioSlug: `${prefix}negocio`,
      negocioNombre: `${prefix}negocio`,
      clienteNombre: `${prefix}cliente`,
      total: 100,
      totalProductos: 100,
      estado: "entregado",
      metodoEntrega: "retiro",
      metodoPago: "efectivo",
      notas: `${prefix}${suffix}`,
    },
  })
  const resena = await db.resena.create({
    data: {
      negocioId,
      clienteNombre: `${prefix}cliente`,
      pedidoId: pedido.id,
      puntuacion: 3,
      comentario: `${prefix}${suffix}`,
      estadoModeracion: "OCULTA_EN_REVISION",
      moderadaEn: new Date(),
    },
  })
  const solicitud = await db.solicitudRevisionResena.create({
    data: {
      resenaId: resena.id,
      negocioId,
      motivo: "FALSA",
      explicacionOriginal: `${prefix}${suffix}`,
      estado: "EN_REVISION",
      activeKey: resena.id,
      venceEn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  return solicitud.id
}

async function createEvento(solicitudId: string) {
  const evento = await db.solicitudRevisionResenaEvento.create({
    data: { solicitudId, tipo: "SOLICITUD_CREADA", actorTipo: "NEGOCIO", actorId: negocioId },
  })
  return evento.id
}

async function seedEvidencias(solicitudId: string, eventoId: string, count: number, bytesEach: number, suffix: string) {
  for (let index = 0; index < count; index += 1) {
    await db.evidenciaSolicitudRevisionResena.create({
      data: {
        solicitudId,
        eventoId,
        uploaderTipo: "NEGOCIO",
        uploaderId: negocioId,
        storageKey: `${prefix}storage-fixture-${suffix}-${index}-${randomUUID()}`,
        mimeType: "image/png",
        bytes: bytesEach,
        sha256: `${prefix}sha-fixture-${suffix}-${index}`,
        nombrePresentacion: `${prefix}fixture-${suffix}-${index}.png`,
      },
    })
  }
}

async function eventEvidenceCount(eventoId: string) {
  return db.evidenciaSolicitudRevisionResena.count({ where: { eventoId } })
}

async function requestTotalBytes(solicitudId: string) {
  const aggregate = await db.evidenciaSolicitudRevisionResena.aggregate({ where: { solicitudId }, _sum: { bytes: true } })
  return aggregate._sum.bytes ?? 0
}

async function existingEvidenciaForKey(storageKey: string) {
  return db.evidenciaSolicitudRevisionResena.findUnique({ where: { storageKey }, select: { id: true } })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const existing = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(existing).toBe(0)
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}negocio`,
      slug: `${prefix}negocio`,
      usuario: `${prefix}negocio`,
      email: `${prefix}negocio@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
  negocioId = negocio.id
}, { timeout: 30_000 })

afterAll(async () => {
  if (negocioId) {
    await db.evidenciaSolicitudRevisionResena.deleteMany({ where: { solicitud: { negocioId } } })
    await db.solicitudRevisionResenaEvento.deleteMany({ where: { solicitud: { negocioId } } })
    await db.solicitudRevisionResena.deleteMany({ where: { negocioId } })
    await db.resena.deleteMany({ where: { negocioId } })
    await db.pedido.deleteMany({ where: { negocioId } })
    await db.negocio.deleteMany({ where: { id: negocioId } })
  }
  const remaining = await Promise.all([
    db.negocio.count({ where: { slug: { startsWith: prefix } } }),
    db.pedido.count({ where: { notas: { startsWith: prefix } } }),
    db.resena.count({ where: { comentario: { startsWith: prefix } } }),
    db.evidenciaSolicitudRevisionResena.count({ where: { storageKey: { startsWith: prefix } } }),
  ])
  expect(remaining).toEqual([0, 0, 0, 0])
}, { timeout: 30_000 })

// ---------------------------------------------------------------------------
// Sección 10-14: carrera real, 5 evidencias por evento
// ---------------------------------------------------------------------------

describe("19-F2B — cuota 5/evento bajo concurrencia PostgreSQL real", () => {
  test("cuatro evidencias existentes + dos intentos concurrentes -> exactamente 5, nunca 6", async () => {
    const ITERATIONS = 3
    let anyP2034 = false
    let totalTransactionAttempts = 0

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const solicitudId = await createEligibleSolicitud(`evento-race-${iteration}`)
      const eventoId = await createEvento(solicitudId)
      await seedEvidencias(solicitudId, eventoId, REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT - 1, 1000, `evento-race-${iteration}`)
      expect(await eventEvidenceCount(eventoId)).toBe(REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT - 1)

      const fake = createFakeStorage()
      const keyA = storageKeyGenerator()
      const keyB = storageKeyGenerator()
      const spy = spyOnTransactions()

      let results: PromiseSettledResult<unknown>[]
      try {
        results = await Promise.allSettled([
          createReviewModerationEvidence({
            negocioId,
            uploaderId: negocioId,
            solicitudId,
            eventoId,
            file: file(1000, `evento-race-${iteration}-a`),
            storage: fake.storage,
            generateStorageKey: () => keyA,
          }),
          createReviewModerationEvidence({
            negocioId,
            uploaderId: negocioId,
            solicitudId,
            eventoId,
            file: file(1000, `evento-race-${iteration}-b`),
            storage: fake.storage,
            generateStorageKey: () => keyB,
          }),
        ])
      } finally {
        totalTransactionAttempts += spy.attempts()
        if (spy.p2034Observed()) anyP2034 = true
        spy.restore()
      }

      const fulfilled = results.filter((result) => result.status === "fulfilled")
      const rejected = results.filter((result) => result.status === "rejected")
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ReviewModerationEvidenceConflictError)

      const finalCount = await eventEvidenceCount(eventoId)
      expect(finalCount).toBe(REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT) // EVENT_FINAL_COUNT=5, EVENT_LIMIT_BREACHED=NO

      // Storage: put exactamente una vez por operación (nunca reupload por retry).
      expect(fake.calls.put).toBe(2) // PUT_ONCE_PER_OPERATION=SI (2 operaciones = 2 puts)
      expect(fake.calls.delete).toBe(1) // LOSER_STORAGE_DELETED=SI

      // Correlación DB <-> storage fake (sección 12/22): el ganador permanece
      // activo y tiene metadata; el perdedor fue eliminado y no tiene metadata.
      const winnerKey = fake.active.has(keyA) ? keyA : keyB
      const loserKey = winnerKey === keyA ? keyB : keyA
      expect(fake.active.has(winnerKey)).toBe(true)
      expect(fake.active.has(loserKey)).toBe(false)
      expect(await existingEvidenciaForKey(winnerKey)).not.toBeNull()
      expect(await existingEvidenciaForKey(loserKey)).toBeNull()
      expect(fake.active.size).toBe(1) // FAKE_STORAGE_ORPHANS=0 (solo queda el objeto con metadata)
    }

    // REAL_P2034_OBSERVED según lo que realmente haya ocurrido — nunca falsificado.
    console.log(`[19-F2B] REAL_P2034_OBSERVED=${anyP2034 ? "SI" : "NO"} totalTransactionAttempts=${totalTransactionAttempts} iterations=${ITERATIONS}`)
    // La garantía que SÍ debe sostenerse siempre, con o sin P2034 visible.
    expect(totalTransactionAttempts).toBeGreaterThanOrEqual(ITERATIONS * 2)
  })

  test("quinto es permitido secuencialmente y el sexto es rechazado", async () => {
    const solicitudId = await createEligibleSolicitud("quinto-sexto")
    const eventoId = await createEvento(solicitudId)
    await seedEvidencias(solicitudId, eventoId, REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT - 1, 1000, "quinto-sexto")
    expect(await eventEvidenceCount(eventoId)).toBe(4)

    const fakeFifth = createFakeStorage()
    const fifthKey = storageKeyGenerator()
    const fifth = await createReviewModerationEvidence({
      negocioId,
      uploaderId: negocioId,
      solicitudId,
      eventoId,
      file: file(1000, "quinto"),
      storage: fakeFifth.storage,
      generateStorageKey: () => fifthKey,
    })
    expect(fifth.evidencia.eventoId).toBe(eventoId)
    expect(await eventEvidenceCount(eventoId)).toBe(5)
    expect(fakeFifth.calls).toEqual({ put: 1, delete: 0, get: 0 })

    const fakeSixth = createFakeStorage()
    const sixthKey = storageKeyGenerator()
    await expect(
      createReviewModerationEvidence({
        negocioId,
        uploaderId: negocioId,
        solicitudId,
        eventoId,
        file: file(1000, "sexto"),
        storage: fakeSixth.storage,
        generateStorageKey: () => sixthKey,
      })
    ).rejects.toBeInstanceOf(ReviewModerationEvidenceConflictError)
    expect(await eventEvidenceCount(eventoId)).toBe(5) // sigue en 5, el sexto nunca entró
    expect(fakeSixth.calls).toEqual({ put: 1, delete: 1, get: 0 }) // cleanup del rechazado (sección 35)
    expect(fakeSixth.active.has(sixthKey)).toBe(false)
    expect(await existingEvidenciaForKey(sixthKey)).toBeNull()
  })

  test("aislamiento entre eventos: evento A lleno no bloquea evento B de la misma solicitud", async () => {
    const solicitudId = await createEligibleSolicitud("aislamiento-eventos")
    const eventoA = await createEvento(solicitudId)
    const eventoB = await createEvento(solicitudId)
    await seedEvidencias(solicitudId, eventoA, REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT, 1000, "aislamiento-a")
    await seedEvidencias(solicitudId, eventoB, 2, 1000, "aislamiento-b")
    expect(await eventEvidenceCount(eventoA)).toBe(5)
    expect(await eventEvidenceCount(eventoB)).toBe(2)

    const fake = createFakeStorage()
    const result = await createReviewModerationEvidence({
      negocioId,
      uploaderId: negocioId,
      solicitudId,
      eventoId: eventoB,
      file: file(1000, "aislamiento-b-nuevo"),
      storage: fake.storage,
      generateStorageKey: storageKeyGenerator,
    })
    expect(result.evidencia.eventoId).toBe(eventoB)
    expect(await eventEvidenceCount(eventoB)).toBe(3)
    expect(await eventEvidenceCount(eventoA)).toBe(5) // el evento lleno no cambia

    // El evento A sigue lleno: un intento allí debe seguir rechazándose.
    const fakeBlocked = createFakeStorage()
    await expect(
      createReviewModerationEvidence({
        negocioId,
        uploaderId: negocioId,
        solicitudId,
        eventoId: eventoA,
        file: file(1000, "aislamiento-a-bloqueado"),
        storage: fakeBlocked.storage,
        generateStorageKey: storageKeyGenerator,
      })
    ).rejects.toBeInstanceOf(ReviewModerationEvidenceConflictError)
  })
})

// ---------------------------------------------------------------------------
// Sección 15-18, 21: carrera real, 15 MiB por solicitud
// ---------------------------------------------------------------------------

describe("19-F2B — cuota 15 MiB/solicitud bajo concurrencia PostgreSQL real", () => {
  test("13 MiB existentes + dos subidas concurrentes de 2 MiB -> como máximo una confirma, total <= 15 MiB", async () => {
    const solicitudId = await createEligibleSolicitud("bytes-race")
    const eventoId = await createEvento(solicitudId)
    await seedEvidencias(solicitudId, eventoId, 1, 13 * MiB, "bytes-race-base")
    expect(await requestTotalBytes(solicitudId)).toBe(13 * MiB)

    const fake = createFakeStorage()
    const keyA = storageKeyGenerator()
    const keyB = storageKeyGenerator()

    const results = await Promise.allSettled([
      createReviewModerationEvidence({
        negocioId,
        uploaderId: negocioId,
        solicitudId,
        eventoId,
        file: file(2 * MiB, "bytes-race-a"),
        storage: fake.storage,
        generateStorageKey: () => keyA,
      }),
      createReviewModerationEvidence({
        negocioId,
        uploaderId: negocioId,
        solicitudId,
        eventoId,
        file: file(2 * MiB, "bytes-race-b"),
        storage: fake.storage,
        generateStorageKey: () => keyB,
      }),
    ])

    const fulfilled = results.filter((result) => result.status === "fulfilled")
    expect(fulfilled.length).toBeLessThanOrEqual(1) // REQUEST_LIMIT_BREACHED=NO

    const totalBytes = await requestTotalBytes(solicitudId)
    expect(totalBytes).toBeLessThanOrEqual(REVIEW_MODERATION_EVIDENCE_MAX_PER_REQUEST)
    expect(totalBytes).toBeLessThanOrEqual(15_728_640)

    // Correlación DB <-> storage fake: exactamente los storageKeys con
    // metadata quedan activos; los demás fueron eliminados (sin huérfanos).
    for (const key of [keyA, keyB]) {
      const evidencia = await existingEvidenciaForKey(key)
      expect(fake.active.has(key)).toBe(evidencia !== null)
    }
    expect(fake.calls.put).toBe(2)
    expect(fake.calls.delete).toBe(2 - fulfilled.length)
  })

  test("exactamente 15 MiB es permitido; 15 MiB + 1 byte es rechazado (sin off-by-one)", async () => {
    const solicitudId = await createEligibleSolicitud("bytes-exact")
    const eventoId = await createEvento(solicitudId)
    await seedEvidencias(solicitudId, eventoId, 1, 14 * MiB, "bytes-exact-base")
    expect(await requestTotalBytes(solicitudId)).toBe(14 * MiB)

    const fakeExact = createFakeStorage()
    const exactResult = await createReviewModerationEvidence({
      negocioId,
      uploaderId: negocioId,
      solicitudId,
      eventoId,
      file: file(1 * MiB, "bytes-exact-fill"),
      storage: fakeExact.storage,
      generateStorageKey: storageKeyGenerator,
    })
    expect(exactResult.evidencia.bytes).toBe(1 * MiB)
    expect(await requestTotalBytes(solicitudId)).toBe(15 * MiB)
    expect(15 * MiB).toBe(15_728_640)

    const solicitudOverId = await createEligibleSolicitud("bytes-over")
    const eventoOverId = await createEvento(solicitudOverId)
    await seedEvidencias(solicitudOverId, eventoOverId, 1, 14 * MiB, "bytes-over-base")
    const fakeOver = createFakeStorage()
    const overKey = storageKeyGenerator()
    await expect(
      createReviewModerationEvidence({
        negocioId,
        uploaderId: negocioId,
        solicitudId: solicitudOverId,
        eventoId: eventoOverId,
        file: file(1 * MiB + 1, "bytes-over-fill"),
        storage: fakeOver.storage,
        generateStorageKey: () => overKey,
      })
    ).rejects.toBeInstanceOf(ReviewModerationEvidenceConflictError)
    expect(await requestTotalBytes(solicitudOverId)).toBe(14 * MiB) // no cambió
    expect(fakeOver.active.has(overKey)).toBe(false)
  })

  test("aislamiento entre solicitudes: solicitud A cerca de 15 MiB no bloquea solicitud B del mismo negocio", async () => {
    const solicitudAId = await createEligibleSolicitud("aislamiento-solicitud-a")
    const eventoAId = await createEvento(solicitudAId)
    await seedEvidencias(solicitudAId, eventoAId, 1, 14 * MiB + 900_000, "aislamiento-solicitud-a")
    const solicitudBId = await createEligibleSolicitud("aislamiento-solicitud-b")
    const eventoBId = await createEvento(solicitudBId)
    await seedEvidencias(solicitudBId, eventoBId, 1, 1000, "aislamiento-solicitud-b")

    const fake = createFakeStorage()
    const result = await createReviewModerationEvidence({
      negocioId,
      uploaderId: negocioId,
      solicitudId: solicitudBId,
      eventoId: eventoBId,
      file: file(2000, "aislamiento-solicitud-b-nuevo"),
      storage: fake.storage,
      generateStorageKey: storageKeyGenerator,
    })
    expect(result.evidencia.id).toBeTruthy()
    expect(await requestTotalBytes(solicitudBId)).toBe(3000)
    expect(await requestTotalBytes(solicitudAId)).toBe(14 * MiB + 900_000) // A no se tocó
  })
})
