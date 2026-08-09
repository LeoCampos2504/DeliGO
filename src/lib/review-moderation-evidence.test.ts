/// <reference types="bun-types" />

import { expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT } from "./review-moderation-evidence-file"
import { ReviewModerationEvidenceConflictError, ReviewModerationEvidenceNotFoundError, createReviewModerationEvidence, getBusinessReviewModerationEvidence, getSuperadminReviewModerationEvidence, type ReviewModerationEvidenceStorage } from "./review-moderation-evidence"

const file = { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png", nombrePresentacion: "evidencia.png", sha256: "hash" }
const originalTransaction = db.$transaction
const evidenceDelegate = db.evidenciaSolicitudRevisionResena as unknown as { findFirst: (...args: unknown[]) => Promise<unknown> }
const originalEvidenceFindFirst = evidenceDelegate.findFirst

function storage(options?: { putError?: Error; deleteError?: Error }) {
  const calls = { put: 0, delete: 0, get: 0 }
  const value: ReviewModerationEvidenceStorage = {
    put: async () => { calls.put += 1; if (options?.putError) throw options.putError; return { storageKey: "private-key" } },
    get: async () => { calls.get += 1; return new Uint8Array([9, 8, 7]) },
    delete: async () => { calls.delete += 1; if (options?.deleteError) throw options.deleteError },
  }
  return { value, calls }
}

function transactionData(input?: { solicitud?: unknown; evento?: unknown; count?: number; bytes?: number }) {
  const created: unknown[] = []
  const solicitud = input?.solicitud === undefined ? { id: "request", estado: "EN_REVISION", resena: { estadoModeracion: "OCULTA_EN_REVISION" } } : input.solicitud
  const evento = input?.evento === undefined ? { id: "event", tipo: "SOLICITUD_CREADA", actorTipo: "NEGOCIO", actorId: "business" } : input.evento
  return {
    created,
    tx: {
      solicitudRevisionResena: { findFirst: async () => solicitud },
      solicitudRevisionResenaEvento: { findFirst: async () => evento },
      evidenciaSolicitudRevisionResena: {
        count: async () => input?.count ?? 0,
        aggregate: async () => ({ _sum: { bytes: input?.bytes ?? 0 } }),
        create: async () => {
          const evidence = { id: "evidence", eventoId: "event", nombrePresentacion: "evidencia.png", mimeType: "image/png", bytes: 3, createdAt: new Date("2026-01-01") }
          created.push(evidence)
          return evidence
        },
      },
    },
  }
}

function p2034() {
  return new Prisma.PrismaClientKnownRequestError("serialization", { code: "P2034", clientVersion: "test" })
}

async function withTransaction(transaction: typeof db.$transaction, run: () => Promise<void>) {
  ;(db as unknown as { $transaction: typeof db.$transaction }).$transaction = transaction
  try { await run() } finally { ;(db as unknown as { $transaction: typeof db.$transaction }).$transaction = originalTransaction }
}

test("core does not mutate metadata or compensate when storage put fails", async () => {
  const fake = storage({ putError: new Error("provider unavailable") })
  let transactions = 0
  await withTransaction((async () => { transactions += 1; throw new Error("must not transact") }) as unknown as typeof db.$transaction, async () => {
    await expect(createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })).rejects.toThrow("provider unavailable")
  })
  expect(fake.calls).toEqual({ put: 1, delete: 0, get: 0 })
  expect(transactions).toBe(0)
})

test("core compensates one upload when the database fails, including a failed compensating delete", async () => {
  const fake = storage({ deleteError: new Error("delete unavailable") })
  await withTransaction((async () => { throw new Error("database unavailable") }) as unknown as typeof db.$transaction, async () => {
    await expect(createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })).rejects.toThrow("database unavailable")
  })
  expect(fake.calls).toEqual({ put: 1, delete: 1, get: 0 })
})

test("core retries only the serializable database work and never reuploads", async () => {
  const fake = storage()
  const data = transactionData()
  let transactions = 0
  await withTransaction((async (callback: (tx: typeof data.tx) => Promise<unknown>) => {
    transactions += 1
    if (transactions === 1) throw p2034()
    return callback(data.tx)
  }) as unknown as typeof db.$transaction, async () => {
    const result = await createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })
    expect(result.evidencia).toEqual({ id: "evidence", eventoId: "event", nombrePresentacion: "evidencia.png", mimeType: "image/png", bytes: 3, createdAt: new Date("2026-01-01") })
  })
  expect(transactions).toBe(2)
  expect(data.created).toHaveLength(1)
  expect(fake.calls).toEqual({ put: 1, delete: 0, get: 0 })
})

test("core exhausts three P2034 attempts, compensates once and does not reupload", async () => {
  const fake = storage()
  let transactions = 0
  await withTransaction((async () => { transactions += 1; throw p2034() }) as unknown as typeof db.$transaction, async () => {
    await expect(createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })).rejects.toBeInstanceOf(ReviewModerationEvidenceConflictError)
  })
  expect(transactions).toBe(3)
  expect(fake.calls).toEqual({ put: 1, delete: 1, get: 0 })
})

test("core enforces ownership, event eligibility, active states and review consistency", async () => {
  const cases = [
    { name: "foreign request", data: transactionData({ solicitud: null }), error: ReviewModerationEvidenceNotFoundError },
    { name: "event from another request", data: transactionData({ evento: null }), error: ReviewModerationEvidenceNotFoundError },
    { name: "superadmin event", data: transactionData({ evento: { id: "event", tipo: "SOLICITUD_CREADA", actorTipo: "SUPERADMIN", actorId: "admin" } }), error: ReviewModerationEvidenceConflictError },
    { name: "ineligible event", data: transactionData({ evento: { id: "event", tipo: "APROBADA", actorTipo: "NEGOCIO", actorId: "business" } }), error: ReviewModerationEvidenceConflictError },
    { name: "terminal request", data: transactionData({ solicitud: { id: "request", estado: "APROBADA", resena: { estadoModeracion: "OCULTA_EN_REVISION" } } }), error: ReviewModerationEvidenceConflictError },
    { name: "inconsistent review", data: transactionData({ solicitud: { id: "request", estado: "EN_REVISION", resena: { estadoModeracion: "PUBLICADA" } } }), error: ReviewModerationEvidenceConflictError },
    { name: "event quota", data: transactionData({ count: REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT }), error: ReviewModerationEvidenceConflictError },
  ]
  for (const item of cases) {
    const fake = storage()
    await withTransaction((async (callback: (tx: typeof item.data.tx) => Promise<unknown>) => callback(item.data.tx)) as unknown as typeof db.$transaction, async () => {
      await expect(createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })).rejects.toBeInstanceOf(item.error)
    })
    expect(item.data.created).toHaveLength(0)
    expect(fake.calls).toEqual({ put: 1, delete: 1, get: 0 })
  }
})

test("core permits each active state and only the two negocio-owned event types", async () => {
  for (const estado of ["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"]) {
    for (const tipo of ["SOLICITUD_CREADA", "INFORMACION_APORTADA"]) {
      const fake = storage()
      const data = transactionData({ solicitud: { id: "request", estado, resena: { estadoModeracion: "OCULTA_EN_REVISION" } }, evento: { id: "event", tipo, actorTipo: "NEGOCIO", actorId: "business" } })
      await withTransaction((async (callback: (tx: typeof data.tx) => Promise<unknown>) => callback(data.tx)) as unknown as typeof db.$transaction, async () => {
        await expect(createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })).resolves.toHaveProperty("evidencia.id", "evidence")
      })
      expect(data.created).toHaveLength(1)
      expect(fake.calls).toEqual({ put: 1, delete: 0, get: 0 })
    }
  }
})

test("core rejects all terminal states, non-business actors and the request byte quota", async () => {
  const terminalStates = ["APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"]
  const ineligibleEvents = ["TOMADA_EN_REVISION", "INFORMACION_REQUERIDA", "APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"]
  for (const estado of terminalStates) {
    const fake = storage()
    const data = transactionData({ solicitud: { id: "request", estado, resena: { estadoModeracion: "OCULTA_EN_REVISION" } } })
    await withTransaction((async (callback: (tx: typeof data.tx) => Promise<unknown>) => callback(data.tx)) as unknown as typeof db.$transaction, async () => {
      await expect(createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })).rejects.toBeInstanceOf(ReviewModerationEvidenceConflictError)
    })
  }
  for (const tipo of ineligibleEvents) {
    const fake = storage()
    const data = transactionData({ evento: { id: "event", tipo, actorTipo: "NEGOCIO", actorId: "business" } })
    await withTransaction((async (callback: (tx: typeof data.tx) => Promise<unknown>) => callback(data.tx)) as unknown as typeof db.$transaction, async () => {
      await expect(createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })).rejects.toBeInstanceOf(ReviewModerationEvidenceConflictError)
    })
  }
  const fake = storage()
  const data = transactionData({ bytes: 15 * 1024 * 1024 })
  await withTransaction((async (callback: (tx: typeof data.tx) => Promise<unknown>) => callback(data.tx)) as unknown as typeof db.$transaction, async () => {
    await expect(createReviewModerationEvidence({ negocioId: "business", uploaderId: "user", solicitudId: "request", eventoId: "event", file, storage: fake.value, generateStorageKey: () => "private-key" })).rejects.toBeInstanceOf(ReviewModerationEvidenceConflictError)
  })
  expect(data.created).toHaveLength(0)
  expect(fake.calls).toEqual({ put: 1, delete: 1, get: 0 })
})

test("evidence lookup keeps business ownership and allows terminal historical downloads", async () => {
  const evidence = { storageKey: "private-key", mimeType: "image/png", nombrePresentacion: "e.png" }
  evidenceDelegate.findFirst = async () => evidence
  try {
    await expect(getBusinessReviewModerationEvidence({ negocioId: "business", solicitudId: "request", evidenciaId: "evidence" })).resolves.toEqual(evidence)
    await expect(getSuperadminReviewModerationEvidence({ solicitudId: "request", evidenciaId: "evidence" })).resolves.toEqual(evidence)
    evidenceDelegate.findFirst = async () => null
    await expect(getBusinessReviewModerationEvidence({ negocioId: "business", solicitudId: "foreign", evidenciaId: "evidence" })).rejects.toBeInstanceOf(ReviewModerationEvidenceNotFoundError)
  } finally {
    evidenceDelegate.findFirst = originalEvidenceFindFirst
  }
})
