/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSuperadminSession, SUPERADMIN_SESSION_COOKIE_NAME } from "@/lib/superadmin-auth"
import { recomputePublicReviewRating } from "@/lib/review-moderation-server"
import {
  getReviewModerationRequestDetail,
  isReviewModerationSuperadminConflict,
  listReviewModerationRequests,
  mutateReviewModerationRequest,
  ReviewModerationSuperadminConflictError,
} from "@/lib/review-moderation-superadmin"
import { GET as getList } from "@/app/api/superadmin/solicitudes-revision-resenas/route"
import { GET as getDetail } from "@/app/api/superadmin/solicitudes-revision-resenas/[id]/route"
import { POST as postTake } from "@/app/api/superadmin/solicitudes-revision-resenas/[id]/tomar/route"
import { POST as postApprove } from "@/app/api/superadmin/solicitudes-revision-resenas/[id]/aprobar/route"

const prefix = "test-t19c-"
setDefaultTimeout(30_000)

let negocioId = ""
let clienteId = ""
let adminAId = ""
let adminBId = ""
let adminToken = ""

async function review(score: number, suffix: string, status: "PUBLICADA" | "OCULTA_EN_REVISION" = "PUBLICADA") {
  const negocio = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { id: true, slug: true, nombre: true } })
  const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { id: true, nombre: true } })
  const pedido = await db.pedido.create({ data: { negocioId: negocio.id, negocioSlug: negocio.slug, negocioNombre: negocio.nombre, clienteId: cliente.id, clienteNombre: cliente.nombre, total: 100, totalProductos: 100, estado: "entregado", metodoEntrega: "retiro", metodoPago: "efectivo", notas: `${prefix}${suffix}` } })
  return db.resena.create({ data: { negocioId, clienteId, clienteNombre: cliente.nombre, pedidoId: pedido.id, puntuacion: score, comentario: `${prefix}${suffix}`, estadoModeracion: status, moderadaEn: status === "OCULTA_EN_REVISION" ? new Date() : null } })
}

async function requestFor(resenaId: string, suffix: string) {
  return db.solicitudRevisionResena.create({ data: { resenaId, negocioId, motivo: "FALSA", explicacionOriginal: `${prefix}${suffix}`, estado: "PENDIENTE", activeKey: resenaId, venceEn: new Date(Date.now() + 86_400_000) } })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const admins = await db.superAdmin.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((row) => row.id)
  const adminIds = admins.map((row) => row.id)
  const clienteIds = clientes.map((row) => row.id)
  await db.sesion.deleteMany({ where: { userId: { in: [...adminIds, ...clienteIds] } } })
  await db.auditLog.deleteMany({ where: { userId: { in: adminIds } } })
  await db.notificacion.deleteMany({ where: { userId: { in: [...negocioIds, ...adminIds, ...clienteIds] } } })
  if (negocioIds.length) {
    await db.evidenciaSolicitudRevisionResena.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResenaEvento.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.resena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  await db.superAdmin.deleteMany({ where: { id: { in: adminIds } } })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const [cliente, negocio, adminA, adminB] = await Promise.all([
    db.cliente.create({ data: { nombre: `${prefix}cliente`, email: `${prefix}cliente@example.test`, telefono: "" } }),
    db.negocio.create({ data: { nombre: `${prefix}negocio`, slug: `${prefix}negocio`, usuario: `${prefix}usuario`, email: `${prefix}negocio@example.test`, password: "fixture", aprobado: true, suspendido: false } }),
    db.superAdmin.create({ data: { email: `${prefix}admin-a@example.test`, googleSub: `${prefix}sub-a`, activo: true } }),
    db.superAdmin.create({ data: { email: `${prefix}admin-b@example.test`, googleSub: `${prefix}sub-b`, activo: true } }),
  ])
  clienteId = cliente.id
  negocioId = negocio.id
  adminAId = adminA.id
  adminBId = adminB.id
  adminToken = await createSuperadminSession(adminA.id)
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  expect(await Promise.all([
    db.negocio.count({ where: { slug: { startsWith: prefix } } }),
    db.cliente.count({ where: { email: { startsWith: prefix } } }),
    db.superAdmin.count({ where: { email: { startsWith: prefix } } }),
  ])).toEqual([0, 0, 0])
}, { timeout: 30_000 })

describe("19-C - list/detail sanitizados", () => {
  test("rutas requieren sesion, paginan y no exponen PII", async () => {
    const hidden = await review(1, "list-hidden", "OCULTA_EN_REVISION")
    const solicitud = await requestFor(hidden.id, "list")
    const noAuth = await getList(new NextRequest("http://localhost/api/superadmin/solicitudes-revision-resenas"))
    expect(noAuth.status).toBe(401)
    const list = await getList(new NextRequest("http://localhost/api/superadmin/solicitudes-revision-resenas?estado=PENDIENTE&limit=20", { headers: { cookie: `${SUPERADMIN_SESSION_COOKIE_NAME}=${adminToken}` } }))
    expect(list.status).toBe(200)
    const listJson = await list.json() as { items: Array<{ id: string }> }
    expect(listJson.items.some((item) => item.id === solicitud.id)).toBe(true)
    const detail = await getDetail(new NextRequest(`http://localhost/api/superadmin/solicitudes-revision-resenas/${solicitud.id}`, { headers: { cookie: `${SUPERADMIN_SESSION_COOKIE_NAME}=${adminToken}` } }), { params: Promise.resolve({ id: solicitud.id }) })
    expect(detail.status).toBe(200)
    const serialized = JSON.stringify(await detail.json())
    for (const key of ["clienteId", "clienteNombre", "clienteTelefono", "email", "telefono", "googleId", "direccion", "latitud", "longitud", "fingerprint", "pushSubscription", "storageKey", "activeKey"]) expect(serialized).not.toContain(`"${key}"`)
    expect(await listReviewModerationRequests({ estado: "PENDIENTE", page: 1, limit: 20 })).toMatchObject({ page: 1, limit: 20 })
  })
})

describe("19-C - transiciones, rating y concurrencia PostgreSQL", () => {
  test("rutas de accion validan body y traducen la transicion", async () => {
    const hidden = await review(2, "route-action", "OCULTA_EN_REVISION")
    const solicitud = await requestFor(hidden.id, "route-action")
    const headers = { "content-type": "application/json", cookie: `${SUPERADMIN_SESSION_COOKIE_NAME}=${adminToken}` }
    const invalid = await postApprove(new NextRequest(`http://localhost/api/superadmin/solicitudes-revision-resenas/${solicitud.id}/aprobar`, { method: "POST", headers, body: JSON.stringify({ motivoDecision: "", extra: true }) }), { params: Promise.resolve({ id: solicitud.id }) })
    expect(invalid.status).toBe(400)
    const taken = await postTake(new NextRequest(`http://localhost/api/superadmin/solicitudes-revision-resenas/${solicitud.id}/tomar`, { method: "POST", headers, body: "{}" }), { params: Promise.resolve({ id: solicitud.id }) })
    expect(taken.status).toBe(200)
    expect((await taken.json()) as { solicitud: { estado: string } }).toMatchObject({ solicitud: { estado: "EN_REVISION" } })
    const repeated = await postTake(new NextRequest(`http://localhost/api/superadmin/solicitudes-revision-resenas/${solicitud.id}/tomar`, { method: "POST", headers, body: "{}" }), { params: Promise.resolve({ id: solicitud.id }) })
    expect(repeated.status).toBe(409)
  })

  test("tomar y pedir informacion preservan activeKey, resena oculta y rating", async () => {
    const hidden = await review(2, "take-info", "OCULTA_EN_REVISION")
    const solicitud = await requestFor(hidden.id, "take-info")
    const before = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { totalResenas: true, puntuacionPromedio: true } })
    await expect(mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId: adminAId, action: "TOMAR_EN_REVISION" })).resolves.toMatchObject({ solicitud: { estado: "EN_REVISION" } })
    await expect(mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId: adminAId, action: "PEDIR_INFORMACION", text: "  aportar contexto  " })).resolves.toMatchObject({ solicitud: { estado: "REQUIERE_INFORMACION" } })
    await expect(mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId: adminAId, action: "PEDIR_INFORMACION", text: "otra" })).rejects.toBeInstanceOf(ReviewModerationSuperadminConflictError)
    const [stored, event, cache] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.solicitudRevisionResenaEvento.findFirstOrThrow({ where: { solicitudId: solicitud.id, tipo: "INFORMACION_REQUERIDA" } }),
      db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { totalResenas: true, puntuacionPromedio: true } }),
    ])
    expect(stored).toMatchObject({ estado: "REQUIERE_INFORMACION", activeKey: hidden.id, revisadaPorSuperadminId: adminAId })
    expect(event.mensaje).toBe("aportar contexto")
    expect(cache).toEqual(before)
  })

  test("aprobar mantiene rating oculto y rechazar restaura rating", async () => {
    const publicReview = await review(5, "rating-public")
    const hiddenApprove = await review(1, "rating-approve", "OCULTA_EN_REVISION")
    await db.$transaction((tx) => recomputePublicReviewRating(tx, negocioId))
    const approveRequest = await requestFor(hiddenApprove.id, "approve")
    expect(await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { totalResenas: true, puntuacionPromedio: true } })).toEqual({ totalResenas: 1, puntuacionPromedio: 5 })
    await mutateReviewModerationRequest({ solicitudId: approveRequest.id, superadminId: adminAId, action: "APROBAR", text: "Motivo final" })
    expect(await db.resena.findUniqueOrThrow({ where: { id: hiddenApprove.id }, select: { estadoModeracion: true } })).toEqual({ estadoModeracion: "ELIMINADA_POR_MODERACION" })
    expect(await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { totalResenas: true, puntuacionPromedio: true } })).toEqual({ totalResenas: 1, puntuacionPromedio: 5 })
    const hiddenReject = await review(1, "rating-reject", "OCULTA_EN_REVISION")
    const rejectRequest = await requestFor(hiddenReject.id, "reject")
    await mutateReviewModerationRequest({ solicitudId: rejectRequest.id, superadminId: adminBId, action: "RECHAZAR", text: "No corresponde" })
    expect(await db.resena.findUniqueOrThrow({ where: { id: hiddenReject.id }, select: { estadoModeracion: true, moderadaEn: true } })).toEqual({ estadoModeracion: "PUBLICADA", moderadaEn: null })
    expect(await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { totalResenas: true, puntuacionPromedio: true } })).toEqual({ totalResenas: 2, puntuacionPromedio: 3 })
    expect(publicReview.id).toBeTruthy()
  })

  test("concurrencia tomar y aprobar-vs-rechazar deja una unica decision", async () => {
    const takeReview = await review(3, "concurrent-take", "OCULTA_EN_REVISION")
    const takeRequest = await requestFor(takeReview.id, "concurrent-take")
    const taking = await Promise.allSettled([
      mutateReviewModerationRequest({ solicitudId: takeRequest.id, superadminId: adminAId, action: "TOMAR_EN_REVISION" }),
      mutateReviewModerationRequest({ solicitudId: takeRequest.id, superadminId: adminBId, action: "TOMAR_EN_REVISION" }),
    ])
    expect(taking.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(taking.filter((result) => result.status === "rejected" && isReviewModerationSuperadminConflict(result.reason))).toHaveLength(1)
    expect(await db.solicitudRevisionResenaEvento.count({ where: { solicitudId: takeRequest.id, tipo: "TOMADA_EN_REVISION" } })).toBe(1)

    const decisionReview = await review(4, "concurrent-decision", "OCULTA_EN_REVISION")
    const decisionRequest = await requestFor(decisionReview.id, "concurrent-decision")
    const deciding = await Promise.allSettled([
      mutateReviewModerationRequest({ solicitudId: decisionRequest.id, superadminId: adminAId, action: "APROBAR", text: "Aprobada" }),
      mutateReviewModerationRequest({ solicitudId: decisionRequest.id, superadminId: adminBId, action: "RECHAZAR", text: "Rechazada" }),
    ])
    expect(deciding.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(deciding.filter((result) => result.status === "rejected" && isReviewModerationSuperadminConflict(result.reason))).toHaveLength(1)
    const [stored, events, audits, updatedReview] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: decisionRequest.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: decisionRequest.id, tipo: { in: ["APROBADA", "RECHAZADA"] } } }),
      db.auditLog.count({ where: { recursoId: decisionRequest.id, accion: { in: ["resena.moderacion_aprobada", "resena.moderacion_rechazada"] } } }),
      db.resena.findUniqueOrThrow({ where: { id: decisionReview.id } }),
    ])
    expect(["APROBADA", "RECHAZADA"]).toContain(stored.estado)
    expect(stored.activeKey).toBeNull()
    expect(events).toBe(1)
    expect(audits).toBe(1)
    expect(updatedReview.estadoModeracion).toBe(stored.estado === "APROBADA" ? "ELIMINADA_POR_MODERACION" : "PUBLICADA")
  })

  test("inconsistencia resena activa hace rollback completo", async () => {
    const publicReview = await review(4, "rollback")
    const solicitud = await requestFor(publicReview.id, "rollback")
    await expect(mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId: adminAId, action: "APROBAR", text: "decision" })).rejects.toBeInstanceOf(ReviewModerationSuperadminConflictError)
    expect(await db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id }, select: { estado: true, activeKey: true } })).toEqual({ estado: "PENDIENTE", activeKey: publicReview.id })
    expect(await db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id } })).toBe(0)
    expect(await db.auditLog.count({ where: { recursoId: solicitud.id } })).toBe(0)
    expect((await getReviewModerationRequestDetail(solicitud.id)).resena.estadoModeracion).toBe("PUBLICADA")
  })
})
