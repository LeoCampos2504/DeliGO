/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { REVIEW_MODERATION_TTL_MS } from "@/lib/review-moderation-policy"
import {
  ReviewModerationNotFoundError,
  createReviewModerationRequest,
  isReviewModerationConflict,
  parseCreateReviewModerationRequestBody,
  recomputePublicReviewRating,
} from "@/lib/review-moderation-server"
import { POST as postClientReview } from "@/app/api/cliente/resenas/route"
import { POST as postBusinessRequest } from "@/app/api/negocio/resenas/[id]/solicitudes-revision/route"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"

const prefix = "test-t19b-"
const ownedRequestBody = { motivo: "FALSA", explicacion: "Fixture de moderación para validar el contrato transaccional." } as const

// PostgreSQL TESTING remoto puede exceder el default de Bun sin indicar un fallo funcional.
setDefaultTimeout(30_000)

let negocioAId = ""
let negocioBId = ""
let clienteId = ""
let reviewAId = ""
let reviewBId = ""
let reviewOtherId = ""
let negocioToken = ""
let clienteToken = ""

function request(url: string, body?: unknown, token?: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function createDeliveredOrder(negocio: { id: string; slug: string; nombre: string }, cliente: { id: string; nombre: string }, suffix: string) {
  return db.pedido.create({
    data: {
      negocioId: negocio.id,
      negocioSlug: negocio.slug,
      negocioNombre: negocio.nombre,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      total: 100,
      totalProductos: 100,
      estado: "entregado",
      metodoEntrega: "retiro",
      metodoPago: "efectivo",
      notas: `${prefix}${suffix}`,
    },
  })
}

async function createReview(negocio: { id: string; slug: string; nombre: string }, cliente: { id: string; nombre: string }, score: number, suffix: string) {
  const pedido = await createDeliveredOrder(negocio, cliente, suffix)
  return db.resena.create({
    data: {
      negocioId: negocio.id,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      pedidoId: pedido.id,
      puntuacion: score,
      comentario: `${prefix}${suffix}`,
      rapidez: score,
      calidad: score,
      precio: score,
    },
  })
}

async function cleanupFixtures() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((negocio) => negocio.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((cliente) => cliente.id)

  if (negocioIds.length) {
    await db.auditLog.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.evidenciaSolicitudRevisionResena.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResenaEvento.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.resena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
  }
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: [...negocioIds, ...clienteIds] } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
  if (negocioIds.length) await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  const existing = await Promise.all([
    db.negocio.count({ where: { slug: { startsWith: prefix } } }),
    db.cliente.count({ where: { email: { startsWith: prefix } } }),
  ])
  expect(existing).toEqual([0, 0])

  const cliente = await db.cliente.create({
    data: { nombre: `${prefix}cliente`, email: `${prefix}cliente@example.test`, telefono: "" },
  })
  const negocioA = await db.negocio.create({
    data: { nombre: `${prefix}negocio-a`, slug: `${prefix}negocio-a`, usuario: `${prefix}usuario-a`, email: `${prefix}a@example.test`, password: "fixture", aprobado: true, suspendido: false },
  })
  const negocioB = await db.negocio.create({
    data: { nombre: `${prefix}negocio-b`, slug: `${prefix}negocio-b`, usuario: `${prefix}usuario-b`, email: `${prefix}b@example.test`, password: "fixture", aprobado: true, suspendido: false },
  })

  clienteId = cliente.id
  negocioAId = negocioA.id
  negocioBId = negocioB.id
  reviewAId = (await createReview(negocioA, cliente, 5, "publica-a")).id
  reviewBId = (await createReview(negocioA, cliente, 1, "publica-b")).id
  reviewOtherId = (await createReview(negocioB, cliente, 3, "ajena")).id
  await db.$transaction((tx) => recomputePublicReviewRating(tx, negocioA.id))
  negocioToken = await createSession(negocioA.id, "negocio")
  clienteToken = await createSession(cliente.id, "cliente")
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanupFixtures()
  const remaining = await Promise.all([
    db.negocio.count({ where: { slug: { startsWith: prefix } } }),
    db.cliente.count({ where: { email: { startsWith: prefix } } }),
  ])
  expect(remaining).toEqual([0, 0])
}, { timeout: 30_000 })

describe("19-B body y autorización", () => {
  test("allowlist estricto, motivo y explicación devuelven 400 en la ruta", async () => {
    expect(parseCreateReviewModerationRequestBody(ownedRequestBody)).toEqual(ownedRequestBody)
    const invalidBodies = [
      { motivo: "OTRO", explicacion: "x" },
      { motivo: "FALSA" },
      { motivo: "FALSA", explicacion: "   " },
      { motivo: "FALSA", explicacion: "x".repeat(2001) },
      { ...ownedRequestBody, estado: "PENDIENTE" },
      { ...ownedRequestBody, negocioId: "x" },
      { ...ownedRequestBody, activeKey: "x" },
      { ...ownedRequestBody, evidencias: [] },
    ]
    for (const body of invalidBodies) {
      expect(parseCreateReviewModerationRequestBody(body)).toBeNull()
      const response = await postBusinessRequest(request(`http://localhost/api/negocio/resenas/${reviewAId}/solicitudes-revision`, body, negocioToken), { params: Promise.resolve({ id: reviewAId }) })
      expect(response.status).toBe(400)
    }
  })

  test("sin sesión y sesión cliente no autorizan", async () => {
    const anonymous = await postBusinessRequest(request(`http://localhost/api/negocio/resenas/${reviewAId}/solicitudes-revision`, ownedRequestBody), { params: Promise.resolve({ id: reviewAId }) })
    expect(anonymous.status).toBe(401)
    const client = await postBusinessRequest(request(`http://localhost/api/negocio/resenas/${reviewAId}/solicitudes-revision`, ownedRequestBody, clienteToken), { params: Promise.resolve({ id: reviewAId }) })
    expect(client.status).toBe(401)
  })

  test("foreign-business e inexistente responden el mismo 404", async () => {
    const foreign = await postBusinessRequest(request(`http://localhost/api/negocio/resenas/${reviewOtherId}/solicitudes-revision`, ownedRequestBody, negocioToken), { params: Promise.resolve({ id: reviewOtherId }) })
    const absent = await postBusinessRequest(request("http://localhost/api/negocio/resenas/cuid-inexistente/solicitudes-revision", ownedRequestBody, negocioToken), { params: Promise.resolve({ id: "cuid-inexistente" }) })
    expect(foreign.status).toBe(404)
    expect(absent.status).toBe(404)
    expect(await foreign.json()).toEqual(await absent.json())
  })
})

describe("19-B creación, ocultamiento y rating", () => {
  test("la API pública inicialmente contiene las dos reseñas publicadas", async () => {
    const response = await getPublicBusiness(new NextRequest(`http://localhost/api/negocios/test-t19b-negocio-a`), { params: Promise.resolve({ slug: "test-t19b-negocio-a" }) })
    const payload = await response.json() as { resenas: Array<{ id: string }>; totalResenas: number; puntuacionPromedio: number }
    expect(response.status).toBe(200)
    expect(payload.resenas.map((review) => review.id).sort()).toEqual([reviewAId, reviewBId].sort())
    expect(payload.totalResenas).toBe(2)
    expect(payload.puntuacionPromedio).toBe(3)
  })

  test("crea solicitud, oculta reseña, registra evento/audit y actualiza cache", async () => {
    const before = Date.now()
    const response = await postBusinessRequest(request(`http://localhost/api/negocio/resenas/${reviewBId}/solicitudes-revision`, ownedRequestBody, negocioToken), { params: Promise.resolve({ id: reviewBId }) })
    const payload = await response.json() as { ok: boolean; solicitud: { id: string; estado: string; motivo: string; venceEn: string; createdAt: string; activeKey?: string } }
    expect(response.status).toBe(201)
    expect(payload.ok).toBe(true)
    expect(payload.solicitud).toMatchObject({ estado: "PENDIENTE", motivo: "FALSA" })
    expect(payload.solicitud.activeKey).toBeUndefined()
    expect(Math.abs(new Date(payload.solicitud.venceEn).getTime() - (before + REVIEW_MODERATION_TTL_MS))).toBeLessThan(60_000)

    const [solicitud, resena, negocio, events, audits] = await Promise.all([
      db.solicitudRevisionResena.findUnique({ where: { id: payload.solicitud.id } }),
      db.resena.findUnique({ where: { id: reviewBId } }),
      db.negocio.findUnique({ where: { id: negocioAId } }),
      db.solicitudRevisionResenaEvento.findMany({ where: { solicitudId: payload.solicitud.id } }),
      db.auditLog.findMany({ where: { recursoId: payload.solicitud.id, accion: "resena.moderacion_solicitada" } }),
    ])
    expect(solicitud).toMatchObject({ negocioId: negocioAId, resenaId: reviewBId, estado: "PENDIENTE", activeKey: reviewBId, motivo: "FALSA", explicacionOriginal: ownedRequestBody.explicacion, prorrogaInformacionUsada: false })
    expect(resena?.estadoModeracion).toBe("OCULTA_EN_REVISION")
    expect(resena?.moderadaEn).not.toBeNull()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ tipo: "SOLICITUD_CREADA", actorTipo: "NEGOCIO", actorId: negocioAId })
    expect(audits).toHaveLength(1)
    expect(negocio).toMatchObject({ totalResenas: 1, puntuacionPromedio: 5 })
  })

  test("duplicado y estados no elegibles son conflictos 409", async () => {
    const response = await postBusinessRequest(request(`http://localhost/api/negocio/resenas/${reviewBId}/solicitudes-revision`, ownedRequestBody, negocioToken), { params: Promise.resolve({ id: reviewBId }) })
    expect(response.status).toBe(409)

    const negocio = await db.negocio.findUniqueOrThrow({ where: { id: negocioAId }, select: { id: true, slug: true, nombre: true } })
    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { id: true, nombre: true } })
    const eliminated = await createReview(negocio, cliente, 2, "eliminada")
    await db.resena.update({ where: { id: eliminated.id }, data: { estadoModeracion: "ELIMINADA_POR_MODERACION", moderadaEn: new Date() } })
    const eliminatedResponse = await postBusinessRequest(request(`http://localhost/api/negocio/resenas/${eliminated.id}/solicitudes-revision`, ownedRequestBody, negocioToken), { params: Promise.resolve({ id: eliminated.id }) })
    expect(eliminatedResponse.status).toBe(409)
  })

  test("API pública oculta la reseña y una reseña nueva no la reincorpora al cache", async () => {
    const publicAfter = await getPublicBusiness(new NextRequest("http://localhost/api/negocios/test-t19b-negocio-a"), { params: Promise.resolve({ slug: "test-t19b-negocio-a" }) })
    const payload = await publicAfter.json() as { resenas: Array<{ id: string }> }
    expect(payload.resenas.map((review) => review.id)).toEqual([reviewAId])

    const negocio = await db.negocio.findUniqueOrThrow({ where: { id: negocioAId }, select: { id: true, slug: true, nombre: true } })
    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { id: true, nombre: true } })
    const pedido = await createDeliveredOrder(negocio, cliente, "nueva-publicada")
    const response = await postClientReview(request("http://localhost/api/cliente/resenas", { pedidoId: pedido.id, comentario: "nueva", rapidez: 3, calidad: 3, precio: 3 }, clienteToken))
    expect(response.status).toBe(201)
    const cache = await db.negocio.findUniqueOrThrow({ where: { id: negocioAId }, select: { totalResenas: true, puntuacionPromedio: true } })
    expect(cache).toEqual({ totalResenas: 2, puntuacionPromedio: 4 })
  })
})

describe("19-B concurrencia PostgreSQL y rollback", () => {
  test("dos intentos reales concurrentes producen una creación y un conflicto", async () => {
    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { id: true, nombre: true } })
    const negocio = await db.negocio.create({ data: { nombre: `${prefix}concurrente`, slug: `${prefix}concurrente`, usuario: `${prefix}concurrente`, email: `${prefix}concurrente@example.test`, password: "fixture", aprobado: true } })
    const review = await createReview(negocio, cliente, 4, "concurrencia")
    await db.$transaction((tx) => recomputePublicReviewRating(tx, negocio.id))

    const results = await Promise.allSettled([
      createReviewModerationRequest({ negocioId: negocio.id, resenaId: review.id, ...ownedRequestBody }),
      createReviewModerationRequest({ negocioId: negocio.id, resenaId: review.id, ...ownedRequestBody }),
    ])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected" && isReviewModerationConflict(result.reason))).toHaveLength(1)

    const [requests, events, audits, updatedReview, cache] = await Promise.all([
      db.solicitudRevisionResena.count({ where: { negocioId: negocio.id, resenaId: review.id, activeKey: review.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitud: { negocioId: negocio.id, resenaId: review.id }, tipo: "SOLICITUD_CREADA" } }),
      db.auditLog.count({ where: { userId: negocio.id, accion: "resena.moderacion_solicitada" } }),
      db.resena.findUniqueOrThrow({ where: { id: review.id } }),
      db.negocio.findUniqueOrThrow({ where: { id: negocio.id } }),
    ])
    expect([requests, events, audits]).toEqual([1, 1, 1])
    expect(updatedReview.estadoModeracion).toBe("OCULTA_EN_REVISION")
    expect(cache).toMatchObject({ totalResenas: 0, puntuacionPromedio: 0 })
  })

  test("aislamiento bidireccional preserva ownership", async () => {
    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { id: true, nombre: true } })
    const [a, b] = await Promise.all([
      db.negocio.create({ data: { nombre: `${prefix}aislado-a`, slug: `${prefix}aislado-a`, usuario: `${prefix}aislado-a`, email: `${prefix}aislado-a@example.test`, password: "fixture", aprobado: true } }),
      db.negocio.create({ data: { nombre: `${prefix}aislado-b`, slug: `${prefix}aislado-b`, usuario: `${prefix}aislado-b`, email: `${prefix}aislado-b@example.test`, password: "fixture", aprobado: true } }),
    ])
    const [reviewA, reviewB] = await Promise.all([createReview(a, cliente, 4, "aislado-a"), createReview(b, cliente, 2, "aislado-b")])
    const own = await Promise.all([
      createReviewModerationRequest({ negocioId: a.id, resenaId: reviewA.id, ...ownedRequestBody }),
      createReviewModerationRequest({ negocioId: b.id, resenaId: reviewB.id, ...ownedRequestBody }),
    ])
    expect(own).toHaveLength(2)
    const cross = await Promise.allSettled([
      createReviewModerationRequest({ negocioId: a.id, resenaId: reviewB.id, ...ownedRequestBody }),
      createReviewModerationRequest({ negocioId: b.id, resenaId: reviewA.id, ...ownedRequestBody }),
    ])
    expect(cross.every((result) => result.status === "rejected" && result.reason instanceof ReviewModerationNotFoundError)).toBe(true)
  })

  test("P2002 real rollbackea la mutación parcial", async () => {
    const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { id: true, nombre: true } })
    const negocio = await db.negocio.create({ data: { nombre: `${prefix}rollback`, slug: `${prefix}rollback`, usuario: `${prefix}rollback`, email: `${prefix}rollback@example.test`, password: "fixture", aprobado: true } })
    const review = await createReview(negocio, cliente, 2, "rollback")
    await db.$transaction((tx) => recomputePublicReviewRating(tx, negocio.id))
    await db.solicitudRevisionResena.create({ data: { resenaId: review.id, negocioId: negocio.id, motivo: "FALSA", explicacionOriginal: "preexistente", estado: "PENDIENTE", activeKey: review.id, venceEn: new Date(Date.now() + REVIEW_MODERATION_TTL_MS) } })
    const [requestCountBefore, eventCountBefore, auditCountBefore, cacheBefore] = await Promise.all([
      db.solicitudRevisionResena.count({ where: { negocioId: negocio.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitud: { negocioId: negocio.id } } }),
      db.auditLog.count({ where: { userId: negocio.id } }),
      db.negocio.findUniqueOrThrow({ where: { id: negocio.id } }),
    ])

    const attempted = await Promise.allSettled([
      createReviewModerationRequest({ negocioId: negocio.id, resenaId: review.id, ...ownedRequestBody }),
    ])
    expect(attempted).toHaveLength(1)
    expect(attempted[0].status).toBe("rejected")
    if (attempted[0].status === "rejected") expect(isReviewModerationConflict(attempted[0].reason)).toBe(true)
    const [requestCountAfter, eventCountAfter, auditCountAfter, reviewAfter, cacheAfter] = await Promise.all([
      db.solicitudRevisionResena.count({ where: { negocioId: negocio.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitud: { negocioId: negocio.id } } }),
      db.auditLog.count({ where: { userId: negocio.id } }),
      db.resena.findUniqueOrThrow({ where: { id: review.id } }),
      db.negocio.findUniqueOrThrow({ where: { id: negocio.id } }),
    ])
    expect([requestCountAfter, eventCountAfter, auditCountAfter]).toEqual([requestCountBefore, eventCountBefore, auditCountBefore])
    expect(reviewAfter.estadoModeracion).toBe("PUBLICADA")
    expect(cacheAfter).toMatchObject({ totalResenas: cacheBefore.totalResenas, puntuacionPromedio: cacheBefore.puntuacionPromedio })
  })
})
