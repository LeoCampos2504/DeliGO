/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSuperadminSession, SUPERADMIN_SESSION_COOKIE_NAME } from "@/lib/superadmin-auth"
import { createReviewModerationRequest } from "@/lib/review-moderation-server"
import { mutateReviewModerationRequest } from "@/lib/review-moderation-superadmin"
import { addBusinessReviewModerationInformation } from "@/lib/review-moderation-business"
import { GET, PATCH } from "@/app/api/superadmin/notificaciones/route"

const prefix = "test-t19e-"
setDefaultTimeout(30_000)

let negocioId = ""
let clienteId = ""
let adminAId = ""
let adminBId = ""
let adminAToken = ""

async function createReview(suffix: string) {
  const [negocio, cliente] = await Promise.all([
    db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { slug: true, nombre: true } }),
    db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { nombre: true } }),
  ])
  const pedido = await db.pedido.create({
    data: {
      negocioId,
      negocioSlug: negocio.slug,
      negocioNombre: negocio.nombre,
      clienteId,
      clienteNombre: cliente.nombre,
      total: 100,
      totalProductos: 100,
      estado: "entregado",
      metodoEntrega: "retiro",
      metodoPago: "efectivo",
      notas: `${prefix}${suffix}`,
    },
  })
  return db.resena.create({
    data: {
      negocioId,
      clienteId,
      clienteNombre: cliente.nombre,
      pedidoId: pedido.id,
      puntuacion: 2,
      comentario: `${prefix}${suffix}`,
      rapidez: 2,
      calidad: 2,
      precio: 2,
    },
  })
}

async function cleanup() {
  const [negocios, clientes, admins] = await Promise.all([
    db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } }),
    db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } }),
    db.superAdmin.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } }),
  ])
  const negocioIds = negocios.map((row) => row.id)
  const clientIds = clientes.map((row) => row.id)
  const adminIds = admins.map((row) => row.id)
  const solicitudes = negocioIds.length
    ? await db.solicitudRevisionResena.findMany({ where: { negocioId: { in: negocioIds } }, select: { id: true } })
    : []
  if (solicitudes.length) {
    await db.notificacion.deleteMany({ where: { OR: solicitudes.map((solicitud) => ({ datos: { contains: solicitud.id } })) } })
  }
  await db.notificacion.deleteMany({ where: { userId: { in: [...negocioIds, ...clientIds, ...adminIds] } } })
  await db.sesion.deleteMany({ where: { userId: { in: [...clientIds, ...adminIds] } } })
  await db.auditLog.deleteMany({ where: { userId: { in: [...negocioIds, ...adminIds] } } })
  if (negocioIds.length) {
    await db.evidenciaSolicitudRevisionResena.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResenaEvento.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.resena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  await db.cliente.deleteMany({ where: { id: { in: clientIds } } })
  await db.superAdmin.deleteMany({ where: { id: { in: adminIds } } })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const [negocio, cliente, adminA, adminB] = await Promise.all([
    db.negocio.create({ data: { nombre: `${prefix}negocio`, slug: `${prefix}negocio`, usuario: `${prefix}usuario`, email: `${prefix}negocio@example.test`, password: "fixture", aprobado: true, suspendido: false } }),
    db.cliente.create({ data: { nombre: `${prefix}cliente`, email: `${prefix}cliente@example.test`, telefono: "" } }),
    db.superAdmin.create({ data: { email: `${prefix}admin-a@example.test`, googleSub: `${prefix}sub-a`, activo: true } }),
    db.superAdmin.create({ data: { email: `${prefix}admin-b@example.test`, googleSub: `${prefix}sub-b`, activo: true } }),
  ])
  negocioId = negocio.id
  clienteId = cliente.id
  adminAId = adminA.id
  adminBId = adminB.id
  adminAToken = await createSuperadminSession(adminAId)
})

afterAll(async () => {
  await cleanup()
  expect(await Promise.all([
    db.negocio.count({ where: { slug: { startsWith: prefix } } }),
    db.cliente.count({ where: { email: { startsWith: prefix } } }),
    db.superAdmin.count({ where: { email: { startsWith: prefix } } }),
    db.notificacion.count({ where: { datos: { contains: prefix } } }),
  ])).toEqual([0, 0, 0, 0])
})

describe("19-E - notificaciones persistentes de moderación", () => {
  test("la solicitud, información y decisión notifican una vez a los destinatarios correctos", async () => {
    // La DB TESTING es compartida y puede tener otros SuperAdmin activos
    // legítimos además de los fixtures adminA/adminB — la regla productiva es
    // "una notificación por cada SuperAdmin activo", no "exactamente 2". Se
    // toma el conjunto real de activos justo antes de la acción para no
    // depender de un conteo global fijo.
    const activeSuperadminIdsBefore = (await db.superAdmin.findMany({ where: { activo: true }, select: { id: true } })).map((row) => row.id).sort()
    expect(activeSuperadminIdsBefore).toContain(adminAId)
    expect(activeSuperadminIdsBefore).toContain(adminBId)

    const review = await createReview("flujo")
    const request = await createReviewModerationRequest({ negocioId, resenaId: review.id, motivo: "FALSA", explicacion: "Solicitud de prueba" })
    const initial = await db.notificacion.findMany({ where: { datos: { contains: request.id } }, orderBy: { createdAt: "asc" } })
    // Exactamente una notificación por cada SuperAdmin activo esperado, ni
    // más ni menos: comparar arrays ordenados detecta tanto destinatarios
    // faltantes/extra como duplicados hacia un mismo destinatario.
    expect(initial.map((row) => row.userId).sort()).toEqual(activeSuperadminIdsBefore)
    expect(initial.every((row) => row.userType === "superadmin" && row.titulo === "Nueva solicitud de revisión" && !row.cuerpo.includes("Solicitud de prueba") && !row.datos.includes(clienteId))).toBe(true)

    await mutateReviewModerationRequest({ solicitudId: request.id, superadminId: adminAId, action: "TOMAR_EN_REVISION" })
    await mutateReviewModerationRequest({ solicitudId: request.id, superadminId: adminAId, action: "PEDIR_INFORMACION", text: "Aportar contexto" })
    expect(await db.notificacion.count({ where: { userId: negocioId, userType: "negocio", datos: { contains: request.id } } })).toBe(1)

    await addBusinessReviewModerationInformation({ negocioId, solicitudId: request.id, mensaje: "Contexto aportado" })
    const reviewers = await db.notificacion.findMany({ where: { userType: "superadmin", datos: { contains: request.id }, titulo: "Información adicional recibida" } })
    expect(reviewers).toHaveLength(1)
    expect(reviewers[0].userId).toBe(adminAId)

    await mutateReviewModerationRequest({ solicitudId: request.id, superadminId: adminAId, action: "APROBAR", text: "Decisión de prueba" })
    const businessNotifications = await db.notificacion.findMany({ where: { userId: negocioId, userType: "negocio", datos: { contains: request.id } }, orderBy: { createdAt: "asc" } })
    expect(businessNotifications.map((row) => row.titulo)).toEqual(["Se necesita información adicional", "Solicitud de revisión aprobada"])
    expect(businessNotifications.every((row) => !row.cuerpo.includes("Aportar contexto") && !row.cuerpo.includes("Decisión de prueba"))).toBe(true)
  })

  test("la carrera de decisión confirma una sola notificación final", async () => {
    const review = await createReview("carrera")
    const request = await createReviewModerationRequest({ negocioId, resenaId: review.id, motivo: "FALSA", explicacion: "Solicitud concurrente" })
    const results = await Promise.allSettled([
      mutateReviewModerationRequest({ solicitudId: request.id, superadminId: adminAId, action: "APROBAR", text: "Aprobada" }),
      mutateReviewModerationRequest({ solicitudId: request.id, superadminId: adminBId, action: "RECHAZAR", text: "Rechazada" }),
    ])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    const final = await db.notificacion.findMany({ where: { userId: negocioId, userType: "negocio", datos: { contains: request.id } } })
    expect(final).toHaveLength(1)
    expect(["Solicitud de revisión aprobada", "Solicitud de revisión rechazada"]).toContain(final[0].titulo)
  })

  test("la bandeja superadmin usa su propia sesión y evita IDOR", async () => {
    const review = await createReview("idor")
    const request = await createReviewModerationRequest({ negocioId, resenaId: review.id, motivo: "FALSA", explicacion: "Solicitud IDOR" })
    const headers = { cookie: `${SUPERADMIN_SESSION_COOKIE_NAME}=${adminAToken}` }
    const response = await GET(new NextRequest("http://localhost/api/superadmin/notificaciones?limit=30", { headers }))
    expect(response.status).toBe(200)
    const payload = await response.json() as { notificaciones: Array<{ id: string; userId: string }> }
    expect(payload.notificaciones.some((notification) => notification.userId !== adminAId)).toBe(false)
    const adminBNotification = await db.notificacion.findFirstOrThrow({ where: { userId: adminBId, datos: { contains: request.id } } })
    const forbidden = await PATCH(new NextRequest("http://localhost/api/superadmin/notificaciones", { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ action: "mark_read", notificationId: adminBNotification.id }) }))
    expect(forbidden.status).toBe(404)
  })
})
