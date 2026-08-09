/// <reference types="bun-types" />

// ============================================
// DeliGO — 19-F3A: integración real PostgreSQL TESTING + Cloudinary TESTING
// ============================================
// Usa el runtime factory real (getPrivateEvidenceStorage), el core real
// (createReviewModerationEvidence) y los helpers reales de lectura de
// evidencia contra PostgreSQL TESTING real y Cloudinary TESTING real
// (authenticated/privado). Nunca reimplementa put/get/delete. Prefijo de
// fixtures DB y de storageKeys remotas: `test-t19f3a-`. No repite las
// carreras de concurrencia F2B: la concurrencia ya está probada con
// PostgreSQL real + storage fake con estado; aquí sólo se valida el
// upload/get/compensación reales contra el provider real.

import { createHash, randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { v2 as cloudinary } from "cloudinary"
import { db } from "@/lib/db"
import { getPrivateEvidenceStorage } from "@/lib/private-evidence-storage-runtime"
import { REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT, validateReviewModerationEvidenceFile } from "@/lib/review-moderation-evidence-file"
import {
  ReviewModerationEvidenceConflictError,
  createReviewModerationEvidence,
  getBusinessReviewModerationEvidence,
  type ReviewModerationEvidenceStorage,
} from "@/lib/review-moderation-evidence"
import { evidenceTimelineEntry } from "@/lib/review-moderation-evidence-ui"

setDefaultTimeout(60_000)

const prefix = "test-t19f3a-"

const testConfig = {
  cloudName: process.env.CLOUDINARY_TEST_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_TEST_API_KEY,
  apiSecret: process.env.CLOUDINARY_TEST_API_SECRET,
}
const hasTestConfig = Boolean(testConfig.cloudName && testConfig.apiKey && testConfig.apiSecret)

const tinyPng = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL3WAAAAABJRU5ErkJggg==",
    "base64",
  ),
)
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

let negocioId = ""
const remoteKeys = new Set<string>()
let previousPrivateEnv: Array<string | undefined> = []

function trackedKey(suffix: string) {
  const key = `${prefix}${suffix}-${randomUUID()}`
  remoteKeys.add(key)
  return key
}

function countingStorage(storage: ReviewModerationEvidenceStorage) {
  const calls = { put: 0, get: 0, delete: 0 }
  const wrapped: ReviewModerationEvidenceStorage = {
    put: async (input) => { calls.put += 1; return storage.put(input) },
    get: async (input) => { calls.get += 1; return storage.get(input) },
    delete: async (input) => { calls.delete += 1; return storage.delete(input) },
  }
  return { calls, storage: wrapped }
}

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

async function seedFixtureEvidencias(solicitudId: string, eventoId: string, count: number, suffix: string) {
  for (let index = 0; index < count; index += 1) {
    await db.evidenciaSolicitudRevisionResena.create({
      data: {
        solicitudId,
        eventoId,
        uploaderTipo: "NEGOCIO",
        uploaderId: negocioId,
        storageKey: `${prefix}fixture-${suffix}-${index}-${randomUUID()}`,
        mimeType: "image/png",
        bytes: 1000,
        sha256: `${prefix}sha-fixture-${suffix}-${index}`,
        nombrePresentacion: `${prefix}fixture-${suffix}-${index}.png`,
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  if (!hasTestConfig) throw new Error("CLOUDINARY_TEST_CONFIG_INCOMPLETA")
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME === testConfig.cloudName) {
    throw new Error("TEST_CLOUD_MUST_DIFFER_FROM_DEFAULT_CLOUD")
  }

  previousPrivateEnv = [
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME,
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_KEY,
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET,
  ]
  process.env.PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME = testConfig.cloudName
  process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_KEY = testConfig.apiKey
  process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET = testConfig.apiSecret

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
  // Red de seguridad final: cualquier storageKey remota rastreada que no
  // haya sido confirmada como eliminada dentro de un test se limpia aquí.
  const storage = getPrivateEvidenceStorage()
  for (const key of remoteKeys) {
    try {
      await storage.delete({ storageKey: key })
    } catch {
      // ya eliminado o nunca llegó a existir: no es un fallo de cleanup.
    }
  }
  let remainingRemote = 0
  for (const key of remoteKeys) {
    try {
      await storage.get({ storageKey: key })
      remainingRemote += 1
    } catch {
      // esperado: not found tras el delete.
    }
  }
  console.log(`[19-F3A] PRIVATE_EVIDENCE_19F3A_TEST_OBJECTS=${remainingRemote}`)
  expect(remainingRemote).toBe(0)

  if (negocioId) {
    await db.evidenciaSolicitudRevisionResena.deleteMany({ where: { solicitud: { negocioId } } })
    await db.solicitudRevisionResenaEvento.deleteMany({ where: { solicitud: { negocioId } } })
    await db.solicitudRevisionResena.deleteMany({ where: { negocioId } })
    await db.resena.deleteMany({ where: { negocioId } })
    await db.pedido.deleteMany({ where: { negocioId } })
    await db.negocio.deleteMany({ where: { id: negocioId } })
  }
  const remainingDb = await Promise.all([
    db.negocio.count({ where: { slug: { startsWith: prefix } } }),
    db.pedido.count({ where: { notas: { startsWith: prefix } } }),
    db.resena.count({ where: { comentario: { startsWith: prefix } } }),
    db.evidenciaSolicitudRevisionResena.count({ where: { storageKey: { startsWith: prefix } } }),
  ])
  console.log(`[19-F3A] TEST_T19F3A_FIXTURES=${remainingDb.reduce((total, value) => total + value, 0)}`)
  expect(remainingDb).toEqual([0, 0, 0, 0])

  const names = ["PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME", "PRIVATE_EVIDENCE_CLOUDINARY_API_KEY", "PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET"] as const
  names.forEach((name, index) => { if (previousPrivateEnv[index]) process.env[name] = previousPrivateEnv[index]; else delete process.env[name] })
}, { timeout: 30_000 })

// ---------------------------------------------------------------------------
// Escenario 1 (secciones 14-19): upload privado real, metadata DB real,
// descarga privada real, SHA-256 y negativo público real.
// ---------------------------------------------------------------------------

describe("19-F3A — Cloudinary TESTING authenticated real", () => {
  test("upload privado real + metadata DB + descarga privada + SHA-256 + negativo público + no leak", async () => {
    const solicitudId = await createEligibleSolicitud("upload-real")
    const eventoId = await createEvento(solicitudId)

    const validated = validateReviewModerationEvidenceFile({
      bytes: tinyPng,
      mimeType: "image/png",
      filename: `${prefix}upload-real.png`,
    })
    const originalSha256 = sha256(tinyPng)
    expect(validated.sha256).toBe(originalSha256)

    const storage = getPrivateEvidenceStorage() // runtime factory real (sin fallback)
    const storageKey = trackedKey("upload-real")
    let cleaned = false

    try {
      const result = await createReviewModerationEvidence({
        negocioId,
        uploaderId: negocioId,
        solicitudId,
        eventoId,
        file: validated,
        storage,
        generateStorageKey: () => storageKey,
      })

      // Metadata cruda de la fila DB real (más allá del select acotado del core).
      const row = await db.evidenciaSolicitudRevisionResena.findUnique({ where: { id: result.evidencia.id } })
      expect(row).not.toBeNull()
      expect(row?.solicitudId).toBe(solicitudId)
      expect(row?.eventoId).toBe(eventoId)
      expect(row?.uploaderTipo).toBe("NEGOCIO")
      expect(row?.uploaderId).toBe(negocioId)
      expect(row?.mimeType).toBe("image/png")
      expect(row?.bytes).toBe(tinyPng.byteLength)
      expect(row?.sha256).toBe(originalSha256)
      expect(row?.nombrePresentacion).toBe(validated.nombrePresentacion)
      expect(row?.storageKey).toBe(storageKey) // storageKey existe internamente, sólo server-side

      // Privacidad real: una URL pública ordinaria equivalente (type=upload)
      // no debe entregar los bytes del asset authenticated.
      const ordinaryPublicUrl = cloudinary.url(storageKey, {
        cloud_name: testConfig.cloudName!,
        secure: true,
        resource_type: "raw",
        type: "upload",
      })
      const publicResponse = await fetch(ordinaryPublicUrl, { redirect: "follow" })
      const publicBytes = new Uint8Array(await publicResponse.arrayBuffer())
      const publicBytesExposed = publicResponse.status === 200 && sha256(publicBytes) === originalSha256
      console.log(`[19-F3A] PUBLIC_UNSIGNED_STATUS=${publicResponse.status}`)
      console.log(`[19-F3A] PUBLIC_BYTES_EXPOSED=${publicBytesExposed ? "SI" : "NO"}`)
      expect(publicBytesExposed).toBe(false)

      // Get privado real vía el adapter del runtime factory.
      const recovered = await storage.get({ storageKey })
      expect(sha256(recovered)).toBe(originalSha256)
      expect(Array.from(recovered)).toEqual(Array.from(tinyPng))

      // Helper real de descarga: metadata DB real -> private adapter real -> bytes.
      const businessEvidence = await getBusinessReviewModerationEvidence({ negocioId, solicitudId, evidenciaId: result.evidencia.id })
      expect(businessEvidence.storageKey).toBe(storageKey)
      const downloaded = await storage.get({ storageKey: businessEvidence.storageKey })
      expect(sha256(downloaded)).toBe(originalSha256)
      expect(Array.from(downloaded)).toEqual(Array.from(tinyPng))

      // No leak: lo que el core/UI exponen no incluye storageKey ni campos del provider.
      const serializedCoreResult = JSON.stringify(result.evidencia)
      const timelineEntry = evidenceTimelineEntry("negocio", solicitudId, eventoId, result.evidencia)
      const serializedTimeline = JSON.stringify(timelineEntry)
      const forbidden = [storageKey, "storageKey", "publicId", "secure_url", "signedUrl", "private_download_url", testConfig.apiSecret!, testConfig.apiKey!]
      for (const needle of forbidden) {
        expect(serializedCoreResult).not.toContain(needle)
        expect(serializedTimeline).not.toContain(needle)
      }

      // Cleanup inmediato del objeto remoto + verificación post-delete.
      await storage.delete({ storageKey })
      cleaned = true
      await expect(storage.get({ storageKey })).rejects.toThrow("Private evidence storage get failed")
      remoteKeys.delete(storageKey)
    } finally {
      if (!cleaned) {
        try {
          await storage.delete({ storageKey })
        } catch {
          // best effort: el afterAll re-verifica igual.
        }
      }
    }
  })

  // -------------------------------------------------------------------------
  // Escenario 2 (secciones 20-21): compensación real DB->Cloudinary.
  // -------------------------------------------------------------------------

  test("compensación real: cuota de evento llena -> put remoto ocurre pero DB rechaza y storage.delete revierte el asset", async () => {
    const solicitudId = await createEligibleSolicitud("compensacion")
    const eventoId = await createEvento(solicitudId)
    await seedFixtureEvidencias(solicitudId, eventoId, REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT, "compensacion")
    expect(await db.evidenciaSolicitudRevisionResena.count({ where: { eventoId } })).toBe(REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT)

    const validated = validateReviewModerationEvidenceFile({
      bytes: tinyPng,
      mimeType: "image/png",
      filename: `${prefix}compensacion.png`,
    })

    const realStorage = getPrivateEvidenceStorage()
    const spy = countingStorage(realStorage)
    const storageKey = trackedKey("compensacion")

    await expect(
      createReviewModerationEvidence({
        negocioId,
        uploaderId: negocioId,
        solicitudId,
        eventoId,
        file: validated,
        storage: spy.storage,
        generateStorageKey: () => storageKey,
      })
    ).rejects.toBeInstanceOf(ReviewModerationEvidenceConflictError)

    console.log(`[19-F3A] REAL_COMPENSATION_PUT=${spy.calls.put}`)
    console.log(`[19-F3A] REAL_COMPENSATION_DELETE=${spy.calls.delete}`)
    expect(spy.calls.put).toBe(1)
    expect(spy.calls.delete).toBe(1)

    const metadataRow = await db.evidenciaSolicitudRevisionResena.findUnique({ where: { storageKey } })
    console.log(`[19-F3A] REAL_COMPENSATION_METADATA=${metadataRow ? 1 : 0}`)
    expect(metadataRow).toBeNull()

    // No conformarse con la respuesta de destroy: reintentar get real.
    await expect(realStorage.get({ storageKey })).rejects.toThrow("Private evidence storage get failed")
    console.log("[19-F3A] REAL_COMPENSATION_OBJECT_EXISTS_AFTER=NO")
    remoteKeys.delete(storageKey)

    // El evento sigue en el límite: la sexta metadata nunca entró.
    expect(await db.evidenciaSolicitudRevisionResena.count({ where: { eventoId } })).toBe(REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT)
  })
})
