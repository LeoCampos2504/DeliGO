/// <reference types="bun-types" />

// ============================================
// DeliGO — 19-G: vencimiento automático de solicitudes de revisión
// ============================================
// Usa el core REAL (expireReviewModerationRequests) contra PostgreSQL
// TESTING real — nunca mockea Prisma para las carreras. Todo fixture usa el
// prefijo `test-t19g-` y se limpia en `afterAll`. No repite las carreras de
// concurrencia genéricas ya cubiertas por 19-B/C/D — sólo las específicas de
// vencimiento vs. decisión humana que exige 19-G.

import { randomUUID } from "crypto"
import { readFileSync } from "fs"
import { join } from "path"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { recomputePublicReviewRating } from "@/lib/review-moderation-server"
import { mutateReviewModerationRequest } from "@/lib/review-moderation-superadmin"
import { addBusinessReviewModerationInformation } from "@/lib/review-moderation-business"
import { expireReviewModerationRequests } from "@/lib/review-moderation-expiry"
import { getExpirationExitCode } from "../../scripts/expire-review-moderation"

setDefaultTimeout(60_000)

const prefix = "test-t19g-"
const HOUR = 60 * 60 * 1000

let negocioId = ""
let negocioSlug = ""
let negocioNombre = ""
let superadminId = ""

function pastDate(msAgo = HOUR) {
  return new Date(Date.now() - msAgo)
}

function futureDate(msAhead = HOUR) {
  return new Date(Date.now() + msAhead)
}

async function ensureNegocio(suffix: string) {
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
  return negocio
}

async function createSolicitudFixture(opts: {
  negocio: { id: string; slug: string; nombre: string }
  suffix: string
  estado: "PENDIENTE" | "EN_REVISION" | "REQUIERE_INFORMACION" | "APROBADA" | "RECHAZADA" | "RESTAURADA_AUTOMATICAMENTE"
  venceEn: Date
  prorrogaInformacionUsada?: boolean
  resenaEstado?: "PUBLICADA" | "OCULTA_EN_REVISION" | "ELIMINADA_POR_MODERACION"
  puntuacion?: number
}) {
  const activeStates = new Set(["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"])
  const isActive = activeStates.has(opts.estado)
  const resenaEstado = opts.resenaEstado ?? (isActive ? "OCULTA_EN_REVISION" : "PUBLICADA")

  const pedido = await db.pedido.create({
    data: {
      negocioId: opts.negocio.id,
      negocioSlug: opts.negocio.slug,
      negocioNombre: opts.negocio.nombre,
      clienteNombre: `${prefix}cliente`,
      total: 100,
      totalProductos: 100,
      estado: "entregado",
      metodoEntrega: "retiro",
      metodoPago: "efectivo",
      notas: `${prefix}${opts.suffix}`,
    },
  })
  const resena = await db.resena.create({
    data: {
      negocioId: opts.negocio.id,
      clienteNombre: `${prefix}cliente`,
      pedidoId: pedido.id,
      puntuacion: opts.puntuacion ?? 3,
      comentario: `${prefix}${opts.suffix}`,
      estadoModeracion: resenaEstado,
      moderadaEn: resenaEstado !== "PUBLICADA" ? new Date() : null,
    },
  })
  const solicitud = await db.solicitudRevisionResena.create({
    data: {
      resenaId: resena.id,
      negocioId: opts.negocio.id,
      motivo: "FALSA",
      explicacionOriginal: `${prefix}${opts.suffix}`,
      estado: opts.estado,
      activeKey: isActive ? resena.id : null,
      venceEn: opts.venceEn,
      resueltaEn: isActive ? null : new Date(),
      prorrogaInformacionUsada: opts.prorrogaInformacionUsada ?? false,
    },
  })
  await db.solicitudRevisionResenaEvento.create({
    data: { solicitudId: solicitud.id, tipo: "SOLICITUD_CREADA", actorTipo: "NEGOCIO", actorId: opts.negocio.id },
  })
  return { pedido, resena, solicitud }
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((row) => row.id)
  const admins = await db.superAdmin.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const adminIds = admins.map((row) => row.id)
  const solicitudes = negocioIds.length
    ? await db.solicitudRevisionResena.findMany({ where: { negocioId: { in: negocioIds } }, select: { id: true } })
    : []
  if (solicitudes.length) {
    await db.notificacion.deleteMany({ where: { OR: solicitudes.map((solicitud) => ({ datos: { contains: solicitud.id } })) } })
  }
  if (negocioIds.length) {
    await db.notificacion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.auditLog.deleteMany({ where: { userId: { in: [...negocioIds, "sistema"] }, recursoId: { in: solicitudes.map((s) => s.id) } } })
    await db.evidenciaSolicitudRevisionResena.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResenaEvento.deleteMany({ where: { solicitud: { negocioId: { in: negocioIds } } } })
    await db.solicitudRevisionResena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.resena.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
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

  const negocio = await ensureNegocio("negocio")
  negocioId = negocio.id
  negocioSlug = negocio.slug
  negocioNombre = negocio.nombre

  const admin = await db.superAdmin.create({ data: { email: `${prefix}admin@example.test`, googleSub: `${prefix}sub`, activo: true } })
  superadminId = admin.id
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  const remaining = await Promise.all([
    db.negocio.count({ where: { slug: { startsWith: prefix } } }),
    db.superAdmin.count({ where: { email: { startsWith: prefix } } }),
    db.solicitudRevisionResena.count({ where: { explicacionOriginal: { startsWith: prefix } } }),
    db.notificacion.count({ where: { datos: { contains: prefix } } }),
  ])
  console.log(`[19-G] TEST_T19G_FIXTURES=${remaining.reduce((a, b) => a + b, 0)}`)
  expect(remaining).toEqual([0, 0, 0, 0])
}, { timeout: 30_000 })

const negocioRef = () => ({ id: negocioId, slug: negocioSlug, nombre: negocioNombre })

// ---------------------------------------------------------------------------
// Casos reales de expiración (sección 21)
// ---------------------------------------------------------------------------

describe("19-G — casos reales de expiración (PostgreSQL real)", () => {
  test.each(["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"] as const)(
    "%s vencida expira atómicamente: solicitud, reseña, rating, evento, audit, notificación",
    async (estadoInicial) => {
      const { solicitud, resena } = await createSolicitudFixture({
        negocio: negocioRef(), suffix: `caso-${estadoInicial.toLowerCase()}`, estado: estadoInicial, venceEn: pastDate(),
      })
      await db.$transaction((tx) => recomputePublicReviewRating(tx, negocioId))

      const result = await expireReviewModerationRequests({ now: new Date() })
      expect(result.expired).toBeGreaterThanOrEqual(1)

      const [updated, updatedReview, events, audits, notifications] = await Promise.all([
        db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
        db.resena.findUniqueOrThrow({ where: { id: resena.id } }),
        db.solicitudRevisionResenaEvento.findMany({ where: { solicitudId: solicitud.id, tipo: "RESTAURADA_AUTOMATICAMENTE" } }),
        db.auditLog.findMany({ where: { recursoId: solicitud.id, accion: "resena.moderacion_vencimiento_automatico" } }),
        db.notificacion.findMany({ where: { userId: negocioId, userType: "negocio", datos: { contains: solicitud.id } } }),
      ])

      expect(updated.estado).toBe("RESTAURADA_AUTOMATICAMENTE")
      expect(updated.activeKey).toBeNull()
      expect(updated.resueltaEn).not.toBeNull()
      expect(updatedReview.estadoModeracion).toBe("PUBLICADA")
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ actorTipo: "SISTEMA", actorId: null })
      expect(audits).toHaveLength(1)
      expect(audits[0]).toMatchObject({ userId: "sistema", userType: "sistema" })
      expect(notifications).toHaveLength(1)
      expect(notifications[0].titulo).toBe("Solicitud de revisión vencida")
      // No leak: nunca evidencia, storageKey ni PII del cliente en la notificación.
      expect(notifications[0].cuerpo).not.toContain("storageKey")
      expect(notifications[0].datos).not.toContain("cliente")
    }
  )
})

// ---------------------------------------------------------------------------
// No vencidas / prórroga / terminales (secciones 22-24)
// ---------------------------------------------------------------------------

describe("19-G — no candidatas", () => {
  test("solicitud activa con vencimiento futuro: sin cambios", async () => {
    const { solicitud, resena } = await createSolicitudFixture({
      negocio: negocioRef(), suffix: "no-vencida", estado: "EN_REVISION", venceEn: futureDate(),
    })
    const result = await expireReviewModerationRequests({ now: new Date() })
    expect(result.scanned).toBe(0)

    const [after, reviewAfter, events, audits, notifications] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.resena.findUniqueOrThrow({ where: { id: resena.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: "RESTAURADA_AUTOMATICAMENTE" } }),
      db.auditLog.count({ where: { recursoId: solicitud.id } }),
      db.notificacion.count({ where: { datos: { contains: solicitud.id } } }),
    ])
    expect(after.estado).toBe("EN_REVISION")
    expect(after.activeKey).toBe(resena.id)
    expect(reviewAfter.estadoModeracion).toBe("OCULTA_EN_REVISION")
    expect(events).toBe(0)
    expect(audits).toBe(0)
    expect(notifications).toBe(0)
  })

  test("prórroga ya aplicada con fecha futura NO expira; sólo tras vencer esa fecha real sí", async () => {
    const { solicitud, resena } = await createSolicitudFixture({
      negocio: negocioRef(), suffix: "prorroga", estado: "EN_REVISION", venceEn: futureDate(2 * HOUR), prorrogaInformacionUsada: true,
    })
    const firstPass = await expireReviewModerationRequests({ now: new Date() })
    expect(firstPass.scanned).toBe(0)
    const stillActive = await db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } })
    expect(stillActive.estado).toBe("EN_REVISION")

    // Sólo mover la fecha persistida real a vencida — nunca recalcular desde
    // createdAt. Esto confirma que 19-G respeta `venceEn` como autoridad.
    await db.solicitudRevisionResena.update({ where: { id: solicitud.id }, data: { venceEn: pastDate() } })
    const secondPass = await expireReviewModerationRequests({ now: new Date() })
    expect(secondPass.expired).toBeGreaterThanOrEqual(1)
    const [expired, reviewAfter] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.resena.findUniqueOrThrow({ where: { id: resena.id } }),
    ])
    expect(expired.estado).toBe("RESTAURADA_AUTOMATICAMENTE")
    expect(reviewAfter.estadoModeracion).toBe("PUBLICADA")
  })

  test.each(["APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"] as const)(
    "terminal %s con fecha histórica pasada: 0 mutaciones",
    async (estadoTerminal) => {
      const { solicitud } = await createSolicitudFixture({
        negocio: negocioRef(), suffix: `terminal-${estadoTerminal.toLowerCase()}`, estado: estadoTerminal, venceEn: pastDate(30 * 24 * HOUR),
        resenaEstado: estadoTerminal === "RECHAZADA" || estadoTerminal === "RESTAURADA_AUTOMATICAMENTE" ? "PUBLICADA" : "ELIMINADA_POR_MODERACION",
      })
      const before = await db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } })
      const result = await expireReviewModerationRequests({ now: new Date() })
      expect(result.scanned).toBe(0)
      const after = await db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } })
      expect(after).toEqual(before)
    }
  )
})

// ---------------------------------------------------------------------------
// Idempotencia (sección 13)
// ---------------------------------------------------------------------------

describe("19-G — idempotencia", () => {
  test("expirar dos veces la misma solicitud: la segunda no duplica nada", async () => {
    const { solicitud } = await createSolicitudFixture({ negocio: negocioRef(), suffix: "idempotencia", estado: "PENDIENTE", venceEn: pastDate() })
    const first = await expireReviewModerationRequests({ now: new Date() })
    expect(first.expired).toBeGreaterThanOrEqual(1)
    const second = await expireReviewModerationRequests({ now: new Date() })

    const [events, audits, notifications] = await Promise.all([
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: "RESTAURADA_AUTOMATICAMENTE" } }),
      db.auditLog.count({ where: { recursoId: solicitud.id, accion: "resena.moderacion_vencimiento_automatico" } }),
      db.notificacion.count({ where: { datos: { contains: solicitud.id } } }),
    ])
    expect(events).toBe(1)
    expect(audits).toBe(1)
    expect(notifications).toBe(1)
    // La segunda corrida ni siquiera vuelve a escanearla: ya no es activa.
    const scannedAgain = await db.solicitudRevisionResena.count({ where: { id: solicitud.id, estado: { in: ["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"] } } })
    expect(scannedAgain).toBe(0)
    void second
  })
})

// ---------------------------------------------------------------------------
// Rating (sección 25)
// ---------------------------------------------------------------------------

describe("19-G — rating público", () => {
  test("expirar una OCULTA_EN_REVISION la reincorpora al promedio público sin nuevo redondeo", async () => {
    const negocio = await ensureNegocio("rating")
    const publicada = await createSolicitudFixture({ negocio, suffix: "rating-publicada", estado: "APROBADA", venceEn: pastDate(30 * 24 * HOUR), resenaEstado: "PUBLICADA", puntuacion: 5 })
    await createSolicitudFixture({ negocio, suffix: "rating-eliminada", estado: "APROBADA", venceEn: pastDate(30 * 24 * HOUR), resenaEstado: "ELIMINADA_POR_MODERACION", puntuacion: 1 })
    const oculta = await createSolicitudFixture({ negocio, suffix: "rating-oculta", estado: "EN_REVISION", venceEn: pastDate(), resenaEstado: "OCULTA_EN_REVISION", puntuacion: 3 })
    void publicada

    await db.$transaction((tx) => recomputePublicReviewRating(tx, negocio.id))
    const before = await db.negocio.findUniqueOrThrow({ where: { id: negocio.id }, select: { totalResenas: true, puntuacionPromedio: true } })
    expect(before).toEqual({ totalResenas: 1, puntuacionPromedio: 5 })

    const result = await expireReviewModerationRequests({ now: new Date() })
    expect(result.expired).toBeGreaterThanOrEqual(1)

    const [reviewAfter, after] = await Promise.all([
      db.resena.findUniqueOrThrow({ where: { id: oculta.resena.id } }),
      db.negocio.findUniqueOrThrow({ where: { id: negocio.id }, select: { totalResenas: true, puntuacionPromedio: true } }),
    ])
    expect(reviewAfter.estadoModeracion).toBe("PUBLICADA")
    expect(after).toEqual({ totalResenas: 2, puntuacionPromedio: 4 })
  })
})

// ---------------------------------------------------------------------------
// Concurrencia real vs. decisiones humanas (secciones 26-29)
// ---------------------------------------------------------------------------

describe("19-G — concurrencia real: vencimiento vs. decisión humana", () => {
  test("expirar vs. aprobar: exactamente un ganador terminal, nunca estados mezclados", async () => {
    const { solicitud, resena } = await createSolicitudFixture({ negocio: negocioRef(), suffix: "vs-aprobar", estado: "EN_REVISION", venceEn: pastDate() })
    await Promise.allSettled([
      expireReviewModerationRequests({ now: new Date() }),
      mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId, action: "APROBAR", text: "Aprobada por superadmin" }),
    ])

    const [final, reviewFinal, events, audits] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.resena.findUniqueOrThrow({ where: { id: resena.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: { in: ["RESTAURADA_AUTOMATICAMENTE", "APROBADA"] } } }),
      db.auditLog.count({ where: { recursoId: solicitud.id, accion: { in: ["resena.moderacion_vencimiento_automatico", "resena.moderacion_aprobada"] } } }),
    ])
    expect(final.activeKey).toBeNull()
    expect(events).toBe(1)
    expect(audits).toBe(1)
    if (final.estado === "RESTAURADA_AUTOMATICAMENTE") {
      expect(reviewFinal.estadoModeracion).toBe("PUBLICADA")
    } else {
      expect(final.estado).toBe("APROBADA")
      expect(reviewFinal.estadoModeracion).toBe("ELIMINADA_POR_MODERACION")
    }
  })

  test("expirar vs. rechazar: exactamente una transición terminal, ambas restauran PUBLICADA", async () => {
    const { solicitud, resena } = await createSolicitudFixture({ negocio: negocioRef(), suffix: "vs-rechazar", estado: "PENDIENTE", venceEn: pastDate() })
    await Promise.allSettled([
      expireReviewModerationRequests({ now: new Date() }),
      mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId, action: "RECHAZAR", text: "Rechazada por superadmin" }),
    ])

    const [final, reviewFinal, events, audits] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.resena.findUniqueOrThrow({ where: { id: resena.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: { in: ["RESTAURADA_AUTOMATICAMENTE", "RECHAZADA"] } } }),
      db.auditLog.count({ where: { recursoId: solicitud.id, accion: { in: ["resena.moderacion_vencimiento_automatico", "resena.moderacion_rechazada"] } } }),
    ])
    expect(["RESTAURADA_AUTOMATICAMENTE", "RECHAZADA"]).toContain(final.estado)
    expect(final.activeKey).toBeNull()
    expect(reviewFinal.estadoModeracion).toBe("PUBLICADA")
    expect(events).toBe(1)
    expect(audits).toBe(1)
  })

  test("expirar vs. aporte de información del Negocio: gana uno solo, sin evento post-terminal", async () => {
    const { solicitud, resena } = await createSolicitudFixture({ negocio: negocioRef(), suffix: "vs-aporte", estado: "REQUIERE_INFORMACION", venceEn: pastDate() })
    await Promise.allSettled([
      expireReviewModerationRequests({ now: new Date() }),
      addBusinessReviewModerationInformation({ negocioId, solicitudId: solicitud.id, mensaje: "Contexto aportado por el negocio" }),
    ])

    const [final, reviewFinal, expiredEvents, aporteEvents] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.resena.findUniqueOrThrow({ where: { id: resena.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: "RESTAURADA_AUTOMATICAMENTE" } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: "INFORMACION_APORTADA" } }),
    ])

    if (final.estado === "RESTAURADA_AUTOMATICAMENTE") {
      // Ganó la expiración: terminal, reseña restaurada, y el aporte nunca
      // pudo registrar su evento después del cierre (perdió limpiamente).
      expect(final.activeKey).toBeNull()
      expect(reviewFinal.estadoModeracion).toBe("PUBLICADA")
      expect(expiredEvents).toBe(1)
      expect(aporteEvents).toBe(0)
    } else {
      // Ganó el aporte válido: la solicitud sigue activa EN_REVISION con su
      // fecha real (prorrogada) — nunca restaurada y activa a la vez.
      expect(final.estado).toBe("EN_REVISION")
      expect(final.activeKey).toBe(resena.id)
      expect(final.venceEn.getTime()).toBeGreaterThan(Date.now())
      expect(reviewFinal.estadoModeracion).toBe("OCULTA_EN_REVISION")
      expect(aporteEvents).toBe(1)
      expect(expiredEvents).toBe(0)
    }
  })

  test("expirar vs. pedir información: PEDIR_INFORMACION no extiende venceEn, la expiración revalida y termina ganando", async () => {
    const { solicitud, resena } = await createSolicitudFixture({ negocio: negocioRef(), suffix: "vs-pedir-info", estado: "EN_REVISION", venceEn: pastDate() })
    await Promise.allSettled([
      expireReviewModerationRequests({ now: new Date() }),
      mutateReviewModerationRequest({ solicitudId: solicitud.id, superadminId, action: "PEDIR_INFORMACION", text: "Necesitamos más contexto" }),
    ])

    // PEDIR_INFORMACION nunca toca `venceEn` (confirmado por auditoría de
    // review-moderation-superadmin.ts) — por lo tanto, sin importar el
    // orden de interleaving, la solicitud sigue vencida en cada relectura
    // dentro de la transacción de expiración, que termina ganando (posee
    // reintento P2034 acotado para revalidar tras perder una primera
    // carrera de serialización).
    const [final, reviewFinal, expiredEvents] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.resena.findUniqueOrThrow({ where: { id: resena.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: "RESTAURADA_AUTOMATICAMENTE" } }),
    ])
    expect(final.estado).toBe("RESTAURADA_AUTOMATICAMENTE")
    expect(final.activeKey).toBeNull()
    expect(reviewFinal.estadoModeracion).toBe("PUBLICADA")
    expect(expiredEvents).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// P2034 real (sección 30)
// ---------------------------------------------------------------------------

describe("19-G — P2034 real", () => {
  test("dos corridas de expiración concurrentes sobre la misma solicitud: una sola expira, sin duplicar side-effects", async () => {
    const { solicitud, resena } = await createSolicitudFixture({ negocio: negocioRef(), suffix: "p2034", estado: "PENDIENTE", venceEn: pastDate() })
    const original = db.$transaction.bind(db)
    let p2034Observed = false
    ;(db as unknown as { $transaction: typeof db.$transaction }).$transaction = (async (...args: Parameters<typeof db.$transaction>) => {
      try {
        return await original(...args)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") p2034Observed = true
        throw error
      }
    }) as typeof db.$transaction

    try {
      await Promise.allSettled([
        expireReviewModerationRequests({ now: new Date() }),
        expireReviewModerationRequests({ now: new Date() }),
      ])
    } finally {
      ;(db as unknown as { $transaction: typeof db.$transaction }).$transaction = original
    }

    console.log(`[19-G] REAL_P2034_OBSERVED=${p2034Observed ? "SI" : "NO"}`)
    const [events, audits, notifications, reviewFinal] = await Promise.all([
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: "RESTAURADA_AUTOMATICAMENTE" } }),
      db.auditLog.count({ where: { recursoId: solicitud.id, accion: "resena.moderacion_vencimiento_automatico" } }),
      db.notificacion.count({ where: { datos: { contains: solicitud.id } } }),
      db.resena.findUniqueOrThrow({ where: { id: resena.id } }),
    ])
    expect(events).toBe(1)
    expect(audits).toBe(1)
    expect(notifications).toBe(1)
    expect(reviewFinal.estadoModeracion).toBe("PUBLICADA")
  })
})

// ---------------------------------------------------------------------------
// Falla atómica controlada (sección 31)
// ---------------------------------------------------------------------------

describe("19-G — atomicidad ante falla controlada", () => {
  test("si el paso de reseña falla, la solicitud NO queda terminal (rollback completo)", async () => {
    const { solicitud, resena } = await createSolicitudFixture({ negocio: negocioRef(), suffix: "rollback", estado: "PENDIENTE", venceEn: pastDate() })
    // Fuerza el fallo de invariante: la reseña ya no está OCULTA_EN_REVISION
    // cuando la transacción intenta restaurarla (simula una inconsistencia
    // real sin debilitar la transacción ni el CAS).
    await db.resena.update({ where: { id: resena.id }, data: { estadoModeracion: "ELIMINADA_POR_MODERACION" } })

    const result = await expireReviewModerationRequests({ now: new Date() })
    expect(result.errors).toBeGreaterThanOrEqual(1)

    const [after, events, audits, notifications] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: solicitud.id } }),
      db.solicitudRevisionResenaEvento.count({ where: { solicitudId: solicitud.id, tipo: "RESTAURADA_AUTOMATICAMENTE" } }),
      db.auditLog.count({ where: { recursoId: solicitud.id } }),
      db.notificacion.count({ where: { datos: { contains: solicitud.id } } }),
    ])
    // Rollback completo: la solicitud sigue PENDIENTE/activa — nunca
    // "terminal + reseña sin restaurar".
    expect(after.estado).toBe("PENDIENTE")
    expect(after.activeKey).toBe(resena.id)
    expect(events).toBe(0)
    expect(audits).toBe(0)
    expect(notifications).toBe(0)

    // Esta candidata queda deliberadamente rota (siempre "errors", nunca
    // resuelve) para probar el rollback — si no se retira aquí, quedaría
    // vencida y activa para siempre y contaminaría el conteo de `scanned`
    // de cualquier corrida global posterior (p. ej. el test de batch).
    await db.solicitudRevisionResenaEvento.deleteMany({ where: { solicitudId: solicitud.id } })
    await db.solicitudRevisionResena.delete({ where: { id: solicitud.id } })
  })
})

// ---------------------------------------------------------------------------
// Batch: límite, orden, continuación (sección 32)
// ---------------------------------------------------------------------------

describe("19-G — batch: límite y orden determinístico", () => {
  test("respeta batchLimit y procesa las más antiguas primero; la corrida siguiente continúa", async () => {
    const negocio = await ensureNegocio("batch")
    const oldest = await createSolicitudFixture({ negocio, suffix: "batch-1", estado: "PENDIENTE", venceEn: pastDate(3 * HOUR) })
    const middle = await createSolicitudFixture({ negocio, suffix: "batch-2", estado: "PENDIENTE", venceEn: pastDate(2 * HOUR) })
    const newest = await createSolicitudFixture({ negocio, suffix: "batch-3", estado: "PENDIENTE", venceEn: pastDate(HOUR) })

    const firstRun = await expireReviewModerationRequests({ now: new Date(), batchLimit: 2 })
    expect(firstRun.scanned).toBe(2)
    expect(firstRun.expired).toBe(2)

    const [oldestAfter, middleAfter, newestAfter] = await Promise.all([
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: oldest.solicitud.id } }),
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: middle.solicitud.id } }),
      db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: newest.solicitud.id } }),
    ])
    expect(oldestAfter.estado).toBe("RESTAURADA_AUTOMATICAMENTE")
    expect(middleAfter.estado).toBe("RESTAURADA_AUTOMATICAMENTE")
    expect(newestAfter.estado).toBe("PENDIENTE") // fuera del límite, sin tocar

    const secondRun = await expireReviewModerationRequests({ now: new Date(), batchLimit: 2 })
    expect(secondRun.scanned).toBe(1)
    expect(secondRun.expired).toBe(1)
    const newestFinal = await db.solicitudRevisionResena.findUniqueOrThrow({ where: { id: newest.solicitud.id } })
    expect(newestFinal.estado).toBe("RESTAURADA_AUTOMATICAMENTE")

    // Ninguna terminal ya procesada vuelve a aparecer en un tercer barrido.
    const thirdRun = await expireReviewModerationRequests({ now: new Date(), batchLimit: 50 })
    const scannedIds = await db.solicitudRevisionResena.count({
      where: { id: { in: [oldest.solicitud.id, middle.solicitud.id, newest.solicitud.id] }, estado: { in: ["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"] } },
    })
    expect(scannedIds).toBe(0)
    void thirdRun
  })
})

// ---------------------------------------------------------------------------
// Evidencias 19-F preservadas (sección 34)
// ---------------------------------------------------------------------------

describe("19-G — evidencias 19-F preservadas", () => {
  test("expirar una solicitud con evidencia no borra su metadata ni toca storage", async () => {
    const { solicitud, resena } = await createSolicitudFixture({ negocio: negocioRef(), suffix: "evidencia", estado: "EN_REVISION", venceEn: pastDate() })
    const evento = await db.solicitudRevisionResenaEvento.findFirstOrThrow({ where: { solicitudId: solicitud.id, tipo: "SOLICITUD_CREADA" } })
    const storageKey = `${prefix}evidencia-${randomUUID()}`
    await db.evidenciaSolicitudRevisionResena.create({
      data: {
        solicitudId: solicitud.id, eventoId: evento.id, uploaderTipo: "NEGOCIO", uploaderId: negocioId,
        storageKey, mimeType: "image/png", bytes: 1234, sha256: `${prefix}sha`, nombrePresentacion: "evidencia.png",
      },
    })

    await expireReviewModerationRequests({ now: new Date() })

    const evidencia = await db.evidenciaSolicitudRevisionResena.findUniqueOrThrow({ where: { storageKey } })
    expect(evidencia.solicitudId).toBe(solicitud.id)
    expect(evidencia.storageKey).toBe(storageKey)
    void resena
  })
})

// ---------------------------------------------------------------------------
// 19-G1: runner standalone (Railway Cron Service) — ya no hay superficie
// HTTP ni secreto que probar. Se valida el contrato del wrapper delgado por
// auditoría de su código fuente (mismo enfoque que
// review-moderation-evidence-contract.test.ts para las routes) más pruebas
// puras de su única función exportada — sin ejecutar un barrido real sobre
// toda la DB TESTING compartida sólo para probar el runner (eso ya lo cubre
// el core arriba, con fixtures aisladas).
// ---------------------------------------------------------------------------

describe("19-G1 — runner standalone del cron (scripts/expire-review-moderation.ts)", () => {
  const scriptSource = readFileSync(join(process.cwd(), "scripts", "expire-review-moderation.ts"), "utf8")

  test("importa el core real ya validado, sin reimplementar la expiración", () => {
    expect(scriptSource).toContain('from "@/lib/review-moderation-expiry"')
    expect(scriptSource).toContain("expireReviewModerationRequests()")
  })

  test("nunca acepta parámetros de selección peligrosos desde CLI/proceso: llama al core sin argumentos", () => {
    expect(scriptSource).not.toContain("process.argv")
    expect(scriptSource).not.toContain("Bun.argv")
    expect(scriptSource).toContain("expireReviewModerationRequests()") // paréntesis vacíos: sin batchLimit/negocioId/solicitudId/fechas inyectados
  })

  test("nunca lee ningún secreto ni expone superficie HTTP", () => {
    expect(scriptSource).not.toContain("SECRET")
    expect(scriptSource).not.toContain("NextRequest")
    expect(scriptSource).not.toContain("NextResponse")
    expect(scriptSource).not.toContain("export async function GET")
    expect(scriptSource).not.toContain("export async function POST")
  })

  test("cierra la conexión Prisma en finally, sin process.exit() abrupto antes del disconnect", () => {
    expect(scriptSource).toContain(".finally(async () => {")
    expect(scriptSource).toContain("await db.$disconnect()")
    expect(scriptSource).not.toContain("process.exit(")
    expect(scriptSource).toContain("process.exitCode = 1")
  })

  test("logging del fatal nunca interpola el error crudo (ni el objeto completo, ni .message, ni .stack) en el console.error", () => {
    const fatalLogCall = scriptSource.slice(scriptSource.indexOf("console.error("), scriptSource.indexOf("console.error(") + 400)
    expect(fatalLogCall).not.toContain("error.message")
    expect(fatalLogCall).not.toContain("error.stack")
    expect(fatalLogCall).not.toMatch(/console\.error\([^)]*,\s*error[,)]/)
  })

  test("import.meta.main evita efectos secundarios cuando otro módulo lo importa (p. ej. este test)", () => {
    expect(scriptSource).toContain("if (import.meta.main)")
  })

  test("getExpirationExitCode: sólo errors > 0 falla el proceso; conflicts/omitidas normales no", () => {
    expect(getExpirationExitCode({ errors: 0 })).toBe(0)
    expect(getExpirationExitCode({ errors: 1 })).toBe(1)
    expect(getExpirationExitCode({ errors: 5 })).toBe(1)
  })
})
