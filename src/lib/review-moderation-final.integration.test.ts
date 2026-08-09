/// <reference types="bun-types" />

// ============================================
// DeliGO — 19-H: cierre final de moderación de reseñas
// ============================================
// Usa los cores/rutas REALES de 19-A→19-G contra PostgreSQL TESTING real —
// nunca mockea Prisma. Todo fixture usa el prefijo `test-t19h-` y se limpia
// en `afterAll`. Cubre lo que ningún test anterior probaba en un solo lugar:
// la privacidad/neutralidad del Cliente autor a través de TODO el ciclo de
// vida (creación real → solicitud real → decisiones reales → terminal
// real), más la compatibilidad con una cuenta de Cliente ya eliminada
// (19-B0). No repite las carreras de concurrencia genéricas (19-B/C/D) ni
// las de vencimiento (19-G) — esas ya están cubiertas con PostgreSQL real
// en sus propios archivos.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createSuperadminSession, SUPERADMIN_SESSION_COOKIE_NAME } from "@/lib/superadmin-auth"
import { ANONYMIZED_REVIEW_CLIENT_NAME } from "@/lib/client-account-deletion"
import { createReviewModerationRequest, recomputePublicReviewRating } from "@/lib/review-moderation-server"
import { mutateReviewModerationRequest } from "@/lib/review-moderation-superadmin"
import { addBusinessReviewModerationInformation } from "@/lib/review-moderation-business"
import { expireReviewModerationRequests } from "@/lib/review-moderation-expiry"
import { GET as getClienteResenaHistory } from "@/app/api/cliente/pedidos/route"
import { GET as getBusinessHistory } from "@/app/api/negocio/resenas/[id]/solicitudes-revision/route"
import { GET as getSuperadminDetail } from "@/app/api/superadmin/solicitudes-revision-resenas/[id]/route"
import { GET as downloadBusinessEvidence } from "@/app/api/negocio/solicitudes-revision-resenas/[id]/evidencias/[evidenciaId]/route"
import { GET as downloadSuperadminEvidence } from "@/app/api/superadmin/solicitudes-revision-resenas/[id]/evidencias/[evidenciaId]/route"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"

setDefaultTimeout(60_000)

const prefix = "test-t19h-"

let negocioId = ""
let negocioSlug = ""
let negocioNombre = ""
let clienteId = ""
let clienteToken = ""
let superadminId = ""

function cookieHeader(name: string, token: string) {
  return { cookie: `${name}=${token}` }
}

async function ensureNegocio(suffix: string) {
  return db.negocio.create({
    data: { nombre: `${prefix}${suffix}`, slug: `${prefix}${suffix}`, usuario: `${prefix}${suffix}`, email: `${prefix}${suffix}@example.test`, password: "fixture", aprobado: true, suspendido: false },
  })
}

async function createDeliveredPedido(suffix: string, opts?: { clienteIdOverride?: string | null; clienteNombreOverride?: string; negocio?: { id: string; slug: string; nombre: string } }) {
  const negocio = opts?.negocio ?? { id: negocioId, slug: negocioSlug, nombre: negocioNombre }
  return db.pedido.create({
    data: {
      negocioId: negocio.id,
      negocioSlug: negocio.slug,
      negocioNombre: negocio.nombre,
      clienteId: opts?.clienteIdOverride === undefined ? clienteId : opts.clienteIdOverride,
      clienteNombre: opts?.clienteNombreOverride ?? `${prefix}cliente`,
      total: 100,
      totalProductos: 100,
      estado: "entregado",
      metodoEntrega: "retiro",
      metodoPago: "efectivo",
      notas: `${prefix}${suffix}`,
    },
  })
}

async function createReview(suffix: string, opts?: { clienteIdOverride?: string | null; clienteNombreOverride?: string; respuestaNegocio?: string; negocio?: { id: string; slug: string; nombre: string } }) {
  const pedido = await createDeliveredPedido(suffix, opts)
  const negocio = opts?.negocio ?? { id: negocioId }
  return db.resena.create({
    data: {
      negocioId: negocio.id,
      clienteId: opts?.clienteIdOverride === undefined ? clienteId : opts.clienteIdOverride,
      clienteNombre: opts?.clienteNombreOverride ?? `${prefix}cliente`,
      pedidoId: pedido.id,
      puntuacion: 3,
      comentario: `${prefix}${suffix}`,
      rapidez: 3,
      calidad: 3,
      precio: 3,
      respuestaNegocio: opts?.respuestaNegocio ?? null,
      fechaRespuesta: opts?.respuestaNegocio ? new Date() : null,
    },
  })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)
  const admins = await db.superAdmin.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const adminIds = admins.map((a) => a.id)
  const solicitudes = negocioIds.length
    ? await db.solicitudRevisionResena.findMany({ where: { negocioId: { in: negocioIds } }, select: { id: true } })
    : []

  if (solicitudes.length) {
    await db.notificacion.deleteMany({ where: { OR: solicitudes.map((s) => ({ datos: { contains: s.id } })) } })
  }
  if (negocioIds.length || clienteIds.length || adminIds.length) {
    await db.notificacion.deleteMany({ where: { userId: { in: [...negocioIds, ...clienteIds, ...adminIds] } } })
  }
  if (negocioIds.length) {
    await db.auditLog.deleteMany({ where: { recursoId: { in: solicitudes.map((s) => s.id) } } })
    await db.evidenciaSolicitudRevisionResena.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResenaEvento.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.resena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  // Reseñas/pedidos de la fixture "cuenta eliminada" ya no tienen negocioId
  // propio distinto — quedan cubiertas arriba porque comparten negocioId.
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
  if (adminIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: adminIds } } })
    await db.superAdmin.deleteMany({ where: { id: { in: adminIds } } })
  }
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  const existing = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(existing).toBe(0)

  const negocio = await db.negocio.create({
    data: { nombre: `${prefix}negocio`, slug: `${prefix}negocio`, usuario: `${prefix}negocio`, email: `${prefix}negocio@example.test`, password: "fixture", aprobado: true, suspendido: false },
  })
  negocioId = negocio.id
  negocioSlug = negocio.slug
  negocioNombre = negocio.nombre

  const cliente = await db.cliente.create({ data: { nombre: `${prefix}cliente`, email: `${prefix}cliente@example.test`, telefono: "" } })
  clienteId = cliente.id
  clienteToken = await createSession(clienteId, "cliente")

  const admin = await db.superAdmin.create({ data: { email: `${prefix}admin@example.test`, googleSub: `${prefix}sub`, activo: true } })
  superadminId = admin.id
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  const remaining = await Promise.all([
    db.negocio.count({ where: { slug: { startsWith: prefix } } }),
    db.cliente.count({ where: { email: { startsWith: prefix } } }),
    db.superAdmin.count({ where: { email: { startsWith: prefix } } }),
    db.solicitudRevisionResena.count({ where: { explicacionOriginal: { startsWith: prefix } } }),
  ])
  console.log(`[19-H] TEST_T19H_FIXTURES=${remaining.reduce((a, b) => a + b, 0)}`)
  expect(remaining).toEqual([0, 0, 0, 0])
}, { timeout: 30_000 })

// ---------------------------------------------------------------------------
// Privacidad del Cliente autor (secciones 4-11)
// ---------------------------------------------------------------------------

describe("19-H — privacidad y neutralidad del Cliente autor", () => {
  test("el historial de pedidos del Cliente nunca 'desaparece' y expone un estadoVisibilidad neutral y sanitizado (19-H1)", async () => {
    const review = await createReview("neutral")

    async function fetchEntry() {
      const response = await getClienteResenaHistory(new NextRequest("http://localhost/api/cliente/pedidos", { headers: cookieHeader(SESSION_COOKIE_NAME, clienteToken) }))
      const body = await response.json() as { pedidos: Array<{ id: string; resena: { id: string; puntuacion: number; estadoVisibilidad: string } | null }> }
      return { raw: JSON.stringify(body), entry: body.pedidos.find((p) => p.resena?.id === review.id) }
    }

    const published = await fetchEntry()
    expect(published.entry?.resena).toEqual({ id: review.id, puntuacion: 3, estadoVisibilidad: "publicada" })

    await db.resena.update({ where: { id: review.id }, data: { estadoModeracion: "OCULTA_EN_REVISION", moderadaEn: new Date() } })
    const hidden = await fetchEntry()
    // Nunca desaparece, nunca null — pasa a un estado neutral explícito, no
    // al enum interno.
    expect(hidden.entry?.resena).toEqual({ id: review.id, puntuacion: 3, estadoVisibilidad: "en_revision" })
    expect(hidden.raw).not.toContain("OCULTA_EN_REVISION")
    expect(hidden.raw).not.toContain("estadoModeracion")

    await db.resena.update({ where: { id: review.id }, data: { estadoModeracion: "ELIMINADA_POR_MODERACION" } })
    const removed = await fetchEntry()
    expect(removed.entry?.resena).toEqual({ id: review.id, puntuacion: 3, estadoVisibilidad: "no_publicada" })
    expect(removed.raw).not.toContain("ELIMINADA_POR_MODERACION")
    expect(removed.raw).not.toContain("estadoModeracion")
  })

  test("el Cliente nunca recibe motivo, explicación, evidencia ni identidad del Superadmin a través de ninguna ruta propia", async () => {
    const review = await createReview("sin-motivo")
    const request = await createReviewModerationRequest({ negocioId, resenaId: review.id, motivo: "OFENSIVA", explicacion: `${prefix}explicacion-interna-nunca-visible-para-cliente` })
    await mutateReviewModerationRequest({ solicitudId: request.id, superadminId, action: "TOMAR_EN_REVISION" })

    const response = await getClienteResenaHistory(new NextRequest("http://localhost/api/cliente/pedidos", { headers: cookieHeader(SESSION_COOKIE_NAME, clienteToken) }))
    const raw = await response.text()
    expect(raw).not.toContain("explicacion-interna-nunca-visible-para-cliente")
    expect(raw).not.toContain("OFENSIVA")
    expect(raw).not.toContain(request.id)
    expect(raw).not.toContain(superadminId)
    // `canceladoMotivo` es un campo propio y legítimo del pedido del Cliente
    // (motivo de cancelación de SU pedido, ajeno a moderación) — no se
    // considera una fuga; se verifica en cambio que no aparezca el
    // vocabulario específico del expediente de moderación.
    expect(raw).not.toContain("solicitudId")
    expect(raw).not.toContain("explicacionOriginal")
    expect(raw).not.toContain("motivoDecision")
    expect(raw).not.toContain("storageKey")
    expect(raw).not.toContain("SuperAdmin")
    expect(raw).not.toContain("activeKey")
  })

  test("el Cliente no puede acceder al expediente de Negocio, al detalle de Superadmin ni descargar evidencia por ninguna ruta", async () => {
    const review = await createReview("sin-acceso")
    const request = await createReviewModerationRequest({ negocioId, resenaId: review.id, motivo: "FALSA", explicacion: `${prefix}sin-acceso` })
    // Fixture de metadata directa (sin subir a Cloudinary real): el chequeo
    // de auth por tipo de sesión ocurre antes de tocar el storage, así que
    // alcanza con que la fila exista — evita una llamada real innecesaria
    // (sección 22: "No llamar Cloudinary real si no hace falta").
    const evidenciaFixture = await db.evidenciaSolicitudRevisionResena.create({
      data: {
        solicitudId: request.id,
        eventoId: request.eventoId,
        uploaderTipo: "NEGOCIO",
        uploaderId: negocioId,
        storageKey: `${prefix}sin-acceso-${randomUUID()}`,
        mimeType: "image/png",
        bytes: 1234,
        sha256: `${prefix}sha-sin-acceso`,
        nombrePresentacion: "evidencia.png",
      },
    })
    const evidenciaId = evidenciaFixture.id

    const clienteCookie = cookieHeader(SESSION_COOKIE_NAME, clienteToken)
    const [businessHistory, superadminDetail, businessDownload, superadminDownload] = await Promise.all([
      getBusinessHistory(new NextRequest(`http://localhost/api/negocio/resenas/${review.id}/solicitudes-revision`, { headers: clienteCookie }), { params: Promise.resolve({ id: review.id }) }),
      getSuperadminDetail(new NextRequest(`http://localhost/api/superadmin/solicitudes-revision-resenas/${request.id}`, { headers: clienteCookie }), { params: Promise.resolve({ id: request.id }) }),
      downloadBusinessEvidence(new NextRequest(`http://localhost/api/negocio/solicitudes-revision-resenas/${request.id}/evidencias/${evidenciaId}`, { headers: clienteCookie }), { params: Promise.resolve({ id: request.id, evidenciaId }) }),
      downloadSuperadminEvidence(new NextRequest(`http://localhost/api/superadmin/solicitudes-revision-resenas/${request.id}/evidencias/${evidenciaId}`, { headers: clienteCookie }), { params: Promise.resolve({ id: request.id, evidenciaId }) }),
    ])
    // 401 (sesión de tipo equivocado) en las 4 superficies — nunca 200, sin
    // diferenciar innecesariamente el motivo del rechazo.
    expect(businessHistory.status).toBe(401)
    expect(superadminDetail.status).toBe(401)
    expect(businessDownload.status).toBe(401)
    expect(superadminDownload.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// API pública (sección 12)
// ---------------------------------------------------------------------------

describe("19-H — API pública", () => {
  test("nunca expone reseñas no PUBLICADA ni ningún campo/valor interno de moderación", async () => {
    const publicada = await createReview("publica")
    const oculta = await createReview("oculta")
    const eliminada = await createReview("eliminada")
    await db.resena.update({ where: { id: oculta.id }, data: { estadoModeracion: "OCULTA_EN_REVISION", moderadaEn: new Date() } })
    await db.resena.update({ where: { id: eliminada.id }, data: { estadoModeracion: "ELIMINADA_POR_MODERACION", moderadaEn: new Date() } })
    void publicada

    const response = await getPublicBusiness(new NextRequest(`http://localhost/api/negocios/${negocioSlug}`), { params: Promise.resolve({ slug: negocioSlug }) })
    const payload = await response.json() as { resenas: Array<{ id: string }> }
    const ids = payload.resenas.map((r) => r.id)
    expect(ids).toContain(publicada.id)
    expect(ids).not.toContain(oculta.id)
    expect(ids).not.toContain(eliminada.id)
    const raw = JSON.stringify(payload)
    expect(raw).not.toContain("estadoModeracion")
    expect(raw).not.toContain("moderacion")
    expect(raw).not.toContain("solicitud")
    expect(raw).not.toContain("storageKey")
  })
})

// ---------------------------------------------------------------------------
// Rating consolidado (sección 13)
// ---------------------------------------------------------------------------

describe("19-H — rating público consolidado", () => {
  test("PUBLICADA cuenta; OCULTA/ELIMINADA no; RECHAZADA y RESTAURADA_AUTOMATICAMENTE restauran; APROBADA permanece fuera", async () => {
    // Negocio dedicado y aislado: el rating es un agregado por negocioId, así
    // que compartir el negocio de otros describe blocks haría el conteo
    // exacto frágil ante el orden de ejecución de los tests.
    const negocio = await ensureNegocio("rating")
    const ref = { id: negocio.id, slug: negocio.slug, nombre: negocio.nombre }
    const publicada = await createReview("rating-publicada", { negocio: ref })
    const rechazada = await createReview("rating-rechazada", { negocio: ref })
    const restaurada = await createReview("rating-restaurada", { negocio: ref })
    const aprobada = await createReview("rating-aprobada", { negocio: ref })
    void publicada

    // El flujo real oculta la reseña (PUBLICADA -> OCULTA_EN_REVISION) como
    // parte de la propia transacción de creación de la solicitud — nunca se
    // pre-oculta a mano, porque createReviewModerationRequest exige
    // PUBLICADA como precondición (igual que en producción).
    const reqRechazada = await createReviewModerationRequest({ negocioId: negocio.id, resenaId: rechazada.id, motivo: "FALSA", explicacion: `${prefix}rating-rechazada` })
    const reqRestaurada = await createReviewModerationRequest({ negocioId: negocio.id, resenaId: restaurada.id, motivo: "FALSA", explicacion: `${prefix}rating-restaurada` })
    const reqAprobada = await createReviewModerationRequest({ negocioId: negocio.id, resenaId: aprobada.id, motivo: "FALSA", explicacion: `${prefix}rating-aprobada` })

    const initial = await db.negocio.findUniqueOrThrow({ where: { id: negocio.id }, select: { totalResenas: true, puntuacionPromedio: true } })
    expect(initial).toEqual({ totalResenas: 1, puntuacionPromedio: 3 })

    await mutateReviewModerationRequest({ solicitudId: reqRechazada.id, superadminId, action: "RECHAZAR", text: "no aplica" })

    await db.solicitudRevisionResena.update({ where: { id: reqRestaurada.id }, data: { venceEn: new Date(Date.now() - 60_000) } })
    const expiryResult = await expireReviewModerationRequests({ now: new Date() })
    expect(expiryResult.expired).toBeGreaterThanOrEqual(1)

    await mutateReviewModerationRequest({ solicitudId: reqAprobada.id, superadminId, action: "APROBAR", text: "corresponde" })

    const final = await db.negocio.findUniqueOrThrow({ where: { id: negocio.id }, select: { totalResenas: true, puntuacionPromedio: true } })
    // publicada + rechazada + restaurada vuelven a contar; aprobada permanece
    // eliminada moderadamente y fuera del promedio.
    expect(final).toEqual({ totalResenas: 3, puntuacionPromedio: 3 })
  })
})

// ---------------------------------------------------------------------------
// Flujo E2E — rechazo (sección 14)
// ---------------------------------------------------------------------------

describe("19-H — flujo E2E completo: rechazo", () => {
  test("cliente crea -> negocio solicita -> SA toma+pide info -> negocio aporta -> SA rechaza -> PUBLICADA otra vez", async () => {
    const pedido = await createDeliveredPedido("e2e-rechazo")
    const clientReviewResponse = await (await import("@/app/api/cliente/resenas/route")).POST(new NextRequest("http://localhost/api/cliente/resenas", {
      method: "POST",
      headers: { ...cookieHeader(SESSION_COOKIE_NAME, clienteToken), "content-type": "application/json" },
      body: JSON.stringify({ pedidoId: pedido.id, comentario: `${prefix}e2e-rechazo`, rapidez: 4, calidad: 4, precio: 4 }),
    }))
    expect(clientReviewResponse.status).toBe(201)
    const review = await clientReviewResponse.json() as { id: string; respuestaNegocio: string | null }
    await db.resena.update({ where: { id: review.id }, data: { respuestaNegocio: `${prefix}gracias por tu pedido` } })

    const businessRequestResponse = await (await import("@/app/api/negocio/resenas/[id]/solicitudes-revision/route")).POST(
      new NextRequest(`http://localhost/api/negocio/resenas/${review.id}/solicitudes-revision`, {
        method: "POST",
        headers: { ...cookieHeader(SESSION_COOKIE_NAME, await createSession(negocioId, "negocio")), "content-type": "application/json" },
        body: JSON.stringify({ motivo: "FALSA", explicacion: `${prefix}e2e-rechazo-explicacion` }),
      }),
      { params: Promise.resolve({ id: review.id }) }
    )
    expect(businessRequestResponse.status).toBe(201)
    const solicitudPayload = await businessRequestResponse.json() as { solicitud: { id: string } }
    const solicitudId = solicitudPayload.solicitud.id

    // Reseña oculta: no pública, no rating.
    await db.$transaction((tx) => recomputePublicReviewRating(tx, negocioId))
    const hiddenPublic = await getPublicBusiness(new NextRequest(`http://localhost/api/negocios/${negocioSlug}`), { params: Promise.resolve({ slug: negocioSlug }) })
    const hiddenPayload = await hiddenPublic.json() as { resenas: Array<{ id: string }> }
    expect(hiddenPayload.resenas.map((r) => r.id)).not.toContain(review.id)

    await mutateReviewModerationRequest({ solicitudId, superadminId, action: "TOMAR_EN_REVISION" })
    await mutateReviewModerationRequest({ solicitudId, superadminId, action: "PEDIR_INFORMACION", text: `${prefix}necesitamos-mas-contexto` })
    await addBusinessReviewModerationInformation({ negocioId, solicitudId, mensaje: `${prefix}contexto-aportado` })
    const decision = await mutateReviewModerationRequest({ solicitudId, superadminId, action: "RECHAZAR", text: `${prefix}no-corresponde` })
    expect(decision.solicitud.estado).toBe("RECHAZADA")

    const [finalReview, finalNegocio, timeline, businessNotif] = await Promise.all([
      db.resena.findUniqueOrThrow({ where: { id: review.id } }),
      db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { totalResenas: true, puntuacionPromedio: true } }),
      db.solicitudRevisionResenaEvento.findMany({ where: { solicitudId }, orderBy: { createdAt: "asc" } }),
      db.notificacion.findMany({ where: { userId: negocioId, userType: "negocio", datos: { contains: solicitudId } } }),
    ])
    expect(finalReview.estadoModeracion).toBe("PUBLICADA")
    expect(finalReview.respuestaNegocio).toBe(`${prefix}gracias por tu pedido`) // sección 17: nunca se pierde
    expect(finalNegocio.totalResenas).toBeGreaterThanOrEqual(1)
    expect(timeline.map((e) => e.tipo)).toEqual(["SOLICITUD_CREADA", "TOMADA_EN_REVISION", "INFORMACION_REQUERIDA", "INFORMACION_APORTADA", "RECHAZADA"])
    expect(businessNotif.length).toBeGreaterThanOrEqual(1)

    const publicAfter = await getPublicBusiness(new NextRequest(`http://localhost/api/negocios/${negocioSlug}`), { params: Promise.resolve({ slug: negocioSlug }) })
    const publicAfterPayload = await publicAfter.json() as { resenas: Array<{ id: string; respuestaNegocio: string | null }> }
    const publicReview = publicAfterPayload.resenas.find((r) => r.id === review.id)
    expect(publicReview?.respuestaNegocio).toBe(`${prefix}gracias por tu pedido`)

    // El Cliente nunca ve nada interno del expediente en su propia superficie.
    const clientHistoryRaw = await (await getClienteResenaHistory(new NextRequest("http://localhost/api/cliente/pedidos", { headers: cookieHeader(SESSION_COOKIE_NAME, clienteToken) }))).text()
    expect(clientHistoryRaw).not.toContain("e2e-rechazo-explicacion")
    expect(clientHistoryRaw).not.toContain("necesitamos-mas-contexto")
    expect(clientHistoryRaw).not.toContain(solicitudId)
  })
})

// ---------------------------------------------------------------------------
// Flujo E2E — aprobación (sección 15)
// ---------------------------------------------------------------------------

describe("19-H — flujo E2E completo: aprobación", () => {
  test("cliente crea -> negocio solicita -> SA aprueba -> ELIMINADA_POR_MODERACION, sin público, sin rating, expediente preservado", async () => {
    const review = await createReview("e2e-aprobacion")
    const solicitud = await createReviewModerationRequest({ negocioId, resenaId: review.id, motivo: "ILEGAL", explicacion: `${prefix}e2e-aprobacion-explicacion` })
    const decision = await mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId, action: "APROBAR", text: `${prefix}corresponde-eliminar` })
    expect(decision.solicitud.estado).toBe("APROBADA")

    const [finalReview, publicCheck, clienteRaw, businessHistoryPayload, superadminDetailPayload] = await Promise.all([
      db.resena.findUniqueOrThrow({ where: { id: review.id } }),
      getPublicBusiness(new NextRequest(`http://localhost/api/negocios/${negocioSlug}`), { params: Promise.resolve({ slug: negocioSlug }) }),
      (await getClienteResenaHistory(new NextRequest("http://localhost/api/cliente/pedidos", { headers: cookieHeader(SESSION_COOKIE_NAME, clienteToken) }))).text(),
      getBusinessHistory(new NextRequest(`http://localhost/api/negocio/resenas/${review.id}/solicitudes-revision`, { headers: cookieHeader(SESSION_COOKIE_NAME, await createSession(negocioId, "negocio")) }), { params: Promise.resolve({ id: review.id }) }),
      getSuperadminDetail(new NextRequest(`http://localhost/api/superadmin/solicitudes-revision-resenas/${solicitud.id}`, { headers: cookieHeader(SUPERADMIN_SESSION_COOKIE_NAME, await createSuperadminSession(superadminId)) }), { params: Promise.resolve({ id: solicitud.id }) }),
    ])
    expect(finalReview.estadoModeracion).toBe("ELIMINADA_POR_MODERACION")

    const publicPayload = await publicCheck.json() as { resenas: Array<{ id: string }> }
    expect(publicPayload.resenas.map((r) => r.id)).not.toContain(review.id)
    expect(clienteRaw).not.toContain("e2e-aprobacion-explicacion")
    expect(clienteRaw).not.toContain("ILEGAL")

    // Expediente preservado para Negocio y Superadmin (nunca se borra).
    expect(businessHistoryPayload.status).toBe(200)
    const businessHistory = await businessHistoryPayload.json() as { solicitudes: Array<{ id: string; estado: string }> }
    expect(businessHistory.solicitudes.map((s) => s.id)).toContain(solicitud.id)
    expect(businessHistory.solicitudes.find((s) => s.id === solicitud.id)?.estado).toBe("APROBADA")

    expect(superadminDetailPayload.status).toBe(200)
    const superadminDetail = await superadminDetailPayload.json() as { estado: string }
    expect(superadminDetail.estado).toBe("APROBADA")
  })
})

// ---------------------------------------------------------------------------
// Flujo E2E — expiración (sección 16)
// ---------------------------------------------------------------------------

describe("19-H — flujo E2E completo: expiración", () => {
  test("solicitud vencida y aislada expira vía el core (no el runner) -> RESTAURADA_AUTOMATICAMENTE + PUBLICADA", async () => {
    const review = await createReview("e2e-expiracion")
    const solicitud = await createReviewModerationRequest({ negocioId, resenaId: review.id, motivo: "OTRA_INFRACCION", explicacion: `${prefix}e2e-expiracion` })
    await db.solicitudRevisionResena.update({ where: { id: solicitud.id }, data: { venceEn: new Date(Date.now() - 60_000) } })

    const result = await expireReviewModerationRequests({ now: new Date() })
    expect(result.expired).toBeGreaterThanOrEqual(1)

    const [finalSolicitud, finalReview, events, audits, notifications] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.resena.findUniqueOrThrow({ where: { id: review.id } }),
      db.solicitudRevisionResenaEvento.findMany({ where: { solicitudId: solicitud.id, tipo: "RESTAURADA_AUTOMATICAMENTE" } }),
      db.auditLog.findMany({ where: { recursoId: solicitud.id, accion: "resena.moderacion_vencimiento_automatico" } }),
      db.notificacion.findMany({ where: { userId: negocioId, userType: "negocio", datos: { contains: solicitud.id } } }),
    ])
    expect(finalSolicitud.estado).toBe("RESTAURADA_AUTOMATICAMENTE")
    expect(finalSolicitud.activeKey).toBeNull()
    expect(finalReview.estadoModeracion).toBe("PUBLICADA")
    expect(events).toHaveLength(1)
    expect(audits).toHaveLength(1)
    expect(notifications).toHaveLength(1)

    // El Cliente nunca ve nada interno del vencimiento (19-G explícitamente
    // no le notifica; su superficie propia tampoco expone el expediente).
    const clienteRaw = await (await getClienteResenaHistory(new NextRequest("http://localhost/api/cliente/pedidos", { headers: cookieHeader(SESSION_COOKIE_NAME, clienteToken) }))).text()
    expect(clienteRaw).not.toContain(solicitud.id)
    expect(clienteRaw).not.toContain("RESTAURADA_AUTOMATICAMENTE")
    const clienteNotifications = await db.notificacion.count({ where: { userId: clienteId, userType: "cliente", datos: { contains: solicitud.id } } })
    expect(clienteNotifications).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Cuenta Cliente eliminada (sección 18, regresión 19-B0)
// ---------------------------------------------------------------------------

describe("19-H — compatibilidad con cuenta de Cliente ya eliminada", () => {
  test("una reseña con clienteId null y nombre anonimizado sigue el flujo de moderación completo sin requerir Cliente existente", async () => {
    const review = await createReview("cuenta-eliminada", { clienteIdOverride: null, clienteNombreOverride: ANONYMIZED_REVIEW_CLIENT_NAME })
    expect(review.clienteId).toBeNull()
    expect(review.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)

    const solicitud = await createReviewModerationRequest({ negocioId, resenaId: review.id, motivo: "FALSA", explicacion: `${prefix}cuenta-eliminada` })
    const decision = await mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId, action: "RECHAZAR", text: `${prefix}no-corresponde-cuenta-eliminada` })
    expect(decision.solicitud.estado).toBe("RECHAZADA")

    const [finalReview, events, negocioRating] = await Promise.all([
      db.resena.findUniqueOrThrow({ where: { id: review.id } }),
      db.solicitudRevisionResenaEvento.findMany({ where: { solicitudId: solicitud.id } }),
      db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { totalResenas: true, puntuacionPromedio: true } }),
    ])
    expect(finalReview.estadoModeracion).toBe("PUBLICADA")
    expect(finalReview.clienteId).toBeNull()
    expect(finalReview.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(negocioRating.totalResenas).toBeGreaterThanOrEqual(1)

    // La API pública muestra el nombre anonimizado, nunca ningún dato real
    // de la cuenta eliminada (que ya no existe).
    const publicResponse = await getPublicBusiness(new NextRequest(`http://localhost/api/negocios/${negocioSlug}`), { params: Promise.resolve({ slug: negocioSlug }) })
    const publicPayload = await publicResponse.json() as { resenas: Array<{ id: string; clienteNombre: string }> }
    const publicEntry = publicPayload.resenas.find((r) => r.id === review.id)
    expect(publicEntry?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
  })
})
