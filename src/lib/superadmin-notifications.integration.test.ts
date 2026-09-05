/// <reference types="bun-types" />

// ============================================
// P2-T26-R2 — SuperAdmin notification remediation
// ============================================
// Certifies 4 of the 5 notification types P2-T26-R1 found missing
// (negocio_pendiente, denuncia_nueva, negocio_deuda, destacado_solicitud),
// the shared notifySuperadmins() helper they all use, and the debt-alert
// crossing-detection contract. Every trigger is exercised through its REAL
// HTTP endpoint (not by calling the producer helper directly).
//
// P2-T26-R2B: the 5th candidate, superadmin_identidad_nueva, was
// implemented in R2 and its wiring certified in R2A — which proved, from
// resolverIdentidadSuperadminGoogle()'s own logic (src/lib/superadmin-identity.ts),
// that "create"/"link" are only ever reachable when the existing-admin
// snapshot is empty (create) or contains exactly the target being linked
// (link) — meaning notification recipients are MATHEMATICALLY always empty
// in this codebase's current single-identity model. R2B removed that
// notification (and the test-only seam added in R2A to certify it) as
// dead-by-design rather than keep a "feature" that can never have an
// observable effect — see codex-reports/
// P2_T26_R2B_SUPERADMIN_NOTIFICATION_CATALOG_NORMALIZATION.md. The identity
// create/link/authenticate logic itself, and its existing security audit
// log (auditLog calls in bootstrapOrAuthenticateSuperadmin), are completely
// unaffected — src/lib/superadmin-auth.ts is back to byte-identical with
// its pre-T26 state.
//
// Does NOT touch src/lib/review-moderation-notifications.ts or its tests —
// those two pre-existing notification types are left completely untouched;
// regression for them is covered by the existing
// review-moderation-notifications.integration.test.ts and
// review-moderation-superadmin*.test.ts files, re-run separately.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createSuperadminSession, SUPERADMIN_SESSION_COOKIE_NAME } from "@/lib/superadmin-auth"
import { notifySuperadmins, crossedDebtAlertThreshold } from "@/lib/superadmin-notifications"
import { resolveSuperadminNotificationTarget } from "@/lib/superadmin-notification-navigation"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"
import { GET as verifyEmail } from "@/app/api/auth/verify-email/route"
import { POST as crearDenuncia } from "@/app/api/denuncias/route"
import { POST as crearDestacadoSolicitud } from "@/app/api/destacado-solicitud/route"
import { PUT as confirmarPedido } from "@/app/api/cliente/pedidos/[id]/route"
import { POST as abonarDeuda } from "@/app/api/superadmin/deuda/[id]/abonar/route"
import { hashVerificationToken, generateVerificationToken, getVerificationTokenExpiresAt } from "@/lib/email"

setDefaultTimeout(60_000)

const prefix = "test-t26-r2-"

async function ensureNegocio(suffix: string, extra: Partial<Parameters<typeof db.negocio.create>[0]["data"]> = {}) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      horarioMode: "simple",
      abiertoManual: true,
      ofreceRetiro: true,
      ...extra,
    },
  })
}

async function ensureProducto(negocioId: string) {
  const producto = await db.producto.create({ data: { nombre: `${prefix}producto`, precio: 100, negocioId } })
  return producto.id
}

async function ensureCliente(suffix: string) {
  return db.cliente.create({ data: { nombre: `${prefix}${suffix}`, email: `${prefix}${suffix}@example.test`, telefono: "" } })
}

async function ensureSuperadmin(suffix: string, activo = true) {
  return db.superAdmin.create({
    data: { email: `${prefix}${suffix}@example.test`, googleSub: `${prefix}gsub-${suffix}-${randomUUID()}`, activo },
  })
}

function pedidoBody(negocioId: string, productoId: string) {
  return {
    negocioId,
    items: [{ productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" }],
    metodoEntrega: "retiro",
    metodoPago: "efectivo",
    notas: null,
    direccion: null,
    referencia: null,
    lat: null,
    lng: null,
    mesaId: null,
    mesaNumero: null,
    empleadoCodigo: null,
    fingerprint: null,
    mesaGeolocation: null,
  }
}

function pedidoReq(body: unknown, ip: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": ip }
  if (cookie) headers["cookie"] = `${SESSION_COOKIE_NAME}=${cookie}`
  return new NextRequest("http://localhost/api/pedidos", { method: "POST", body: JSON.stringify(body), headers })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)
  const superadmins = await db.superAdmin.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const superadminIds = superadmins.map((s) => s.id)

  if (negocioIds.length) {
    await db.denuncia.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.destacadoSolicitud.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.deudaHistorial.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.producto.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
  if (superadminIds.length) {
    await db.notificacion.deleteMany({ where: { userId: { in: superadminIds }, userType: "superadmin" } })
    await db.sesion.deleteMany({ where: { userId: { in: superadminIds } } })
    await db.superAdmin.deleteMany({ where: { id: { in: superadminIds } } })
  }
}

beforeAll(async () => {
  await cleanup()
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  const remaining = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(remaining).toBe(0)
})

describe("P2-T26-R2 — notifySuperadmins() generic helper", () => {
  test("1. resolves all activo:true admins by default, skips inactive, no-ops with zero recipients", async () => {
    const active = await ensureSuperadmin("helper-active")
    const inactive = await ensureSuperadmin("helper-inactive", false)

    const count = await notifySuperadmins(db, {
      tipo: "test_generic",
      titulo: "t",
      cuerpo: "c",
      datos: { entityId: "x" },
    })
    expect(count).toBeGreaterThanOrEqual(1) // at least our fixture — shared DB may have other real active admins too

    const activeRows = await db.notificacion.findMany({ where: { userId: active.id, userType: "superadmin", tipo: "test_generic" } })
    expect(activeRows.length).toBe(1)
    const inactiveRows = await db.notificacion.count({ where: { userId: inactive.id, userType: "superadmin", tipo: "test_generic" } })
    expect(inactiveRows).toBe(0)

    await db.notificacion.deleteMany({ where: { tipo: "test_generic" } })
  })

  test("2. recipientIds override bypasses the activo:true resolution entirely", async () => {
    const target = await ensureSuperadmin("helper-override")
    const count = await notifySuperadmins(db, {
      tipo: "test_generic_override",
      titulo: "t",
      cuerpo: "c",
      datos: {},
      recipientIds: [target.id],
    })
    expect(count).toBe(1)
    const rows = await db.notificacion.count({ where: { userId: target.id, userType: "superadmin", tipo: "test_generic_override" } })
    expect(rows).toBe(1)
    await db.notificacion.deleteMany({ where: { tipo: "test_generic_override" } })
  })

  test("3. zero recipients (empty override) creates nothing and never throws", async () => {
    const count = await notifySuperadmins(db, { tipo: "test_zero", titulo: "t", cuerpo: "c", datos: {}, recipientIds: [] })
    expect(count).toBe(0)
  })
})

describe("P2-T26-R2 — debt-alert crossing detection (pure)", () => {
  test("4. crosses 80% threshold, does not re-fire while staying above, re-fires after a dip", () => {
    expect(crossedDebtAlertThreshold(0, 700, 1000)).toBe(false) // below threshold (800)
    expect(crossedDebtAlertThreshold(700, 850, 1000)).toBe(true) // crosses 800
    expect(crossedDebtAlertThreshold(850, 900, 1000)).toBe(false) // already above — no repeat
    expect(crossedDebtAlertThreshold(0, 850, 1000)).toBe(true) // after a payment reset to 0, a fresh cross fires again
    expect(crossedDebtAlertThreshold(500, 500, 0)).toBe(false) // guard against limiteDeuda<=0
  })
})

describe("P2-T26-R2 — navigation resolver (pure)", () => {
  test("5. tolerates the legacy review_moderation shape and the new flat shape, falls back safely", () => {
    expect(resolveSuperadminNotificationTarget(JSON.stringify({ solicitudId: "s1", navigateTo: { superadmin: "moderacion-resenas" } })))
      .toEqual({ tab: "moderacion-resenas", entityId: "s1" })
    expect(resolveSuperadminNotificationTarget(JSON.stringify({ entityId: "n1", navigateTo: "pendientes" })))
      .toEqual({ tab: "pendientes", entityId: "n1" })
    expect(resolveSuperadminNotificationTarget("not json").tab).toBe("overview")
    expect(resolveSuperadminNotificationTarget(JSON.stringify({ navigateTo: "not-a-real-tab" })).tab).toBe("overview")
    expect(resolveSuperadminNotificationTarget(JSON.stringify({ navigateTo: "denuncias", denunciaId: "d1" })))
      .toEqual({ tab: "denuncias", entityId: "d1" })
  })
})

describe("P2-T26-R2 — negocio_pendiente (real event: email verification)", () => {
  test("6. verifying an unapproved negocio's email notifies superadmins exactly once, a replay does not duplicate", async () => {
    const admin = await ensureSuperadmin("pendiente-admin")
    const rawToken = generateVerificationToken()
    const negocio = await ensureNegocio("pendiente", {
      aprobado: false,
      emailVerified: null,
      verificationToken: hashVerificationToken(rawToken),
      verificationTokenExpiresAt: getVerificationTokenExpiresAt(),
    })

    const req1 = new NextRequest(`http://localhost/api/auth/verify-email?token=${rawToken}`)
    const res1 = await verifyEmail(req1)
    expect(res1.status).toBe(200)

    const rows = await db.notificacion.findMany({ where: { userId: admin.id, userType: "superadmin", tipo: "negocio_pendiente" } })
    expect(rows.length).toBe(1)
    const datos = JSON.parse(rows[0].datos)
    expect(datos.entityId).toBe(negocio.id)
    expect(datos.navigateTo).toBe("pendientes")

    // Replay of the same (now-consumed) verification link — CAS must reject
    // it and must NOT create a second notification.
    const res2 = await verifyEmail(new NextRequest(`http://localhost/api/auth/verify-email?token=${rawToken}`))
    expect(res2.status).toBe(200) // invalid/expired-link page, not a 500
    const rowsAfterReplay = await db.notificacion.count({ where: { userId: admin.id, userType: "superadmin", tipo: "negocio_pendiente" } })
    expect(rowsAfterReplay).toBe(1)
  })

  test("7. verifying an ALREADY-approved negocio's email does not notify (not a pending event)", async () => {
    const admin = await ensureSuperadmin("pendiente-approved-admin")
    const rawToken = generateVerificationToken()
    await ensureNegocio("pendiente-approved", {
      aprobado: true,
      emailVerified: null,
      verificationToken: hashVerificationToken(rawToken),
      verificationTokenExpiresAt: getVerificationTokenExpiresAt(),
    })

    await verifyEmail(new NextRequest(`http://localhost/api/auth/verify-email?token=${rawToken}`))
    const rows = await db.notificacion.count({ where: { userId: admin.id, userType: "superadmin", tipo: "negocio_pendiente" } })
    expect(rows).toBe(0)
  })
})

describe("P2-T26-R2 — denuncia_nueva (real event)", () => {
  test("8. a new denuncia notifies superadmins with a minimal, non-sensitive body", async () => {
    const admin = await ensureSuperadmin("denuncia-admin")
    const negocio = await ensureNegocio("denuncia")
    const productoId = await ensureProducto(negocio.id)
    const cliente = await ensureCliente("denuncia-cliente")
    const clienteSession = await createSession(cliente.id, "cliente")
    const negocioSession = await createSession(negocio.id, "negocio")
    const ip = `198.51.100.${randomUUID().slice(0, 2)}`

    const pedidoRes = await crearPedido(pedidoReq(pedidoBody(negocio.id, productoId), ip, clienteSession), {})
    const pedido = await pedidoRes.json()

    const req = new NextRequest("http://localhost/api/denuncias", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${negocioSession}` },
      body: JSON.stringify({ clienteId: cliente.id, pedidoId: pedido.id, motivoTipo: "no_retiro", motivo: "No retiró el pedido (test T26-R2)" }),
    })
    const res = await crearDenuncia(req)
    expect(res.status).toBe(201)

    const rows = await db.notificacion.findMany({ where: { userId: admin.id, userType: "superadmin", tipo: "denuncia_nueva" } })
    expect(rows.length).toBe(1)
    expect(rows[0].cuerpo).not.toContain(cliente.nombre) // cuerpo minimizado — sin nombre del cliente
    expect(rows[0].cuerpo).not.toContain("No retiró el pedido") // sin el motivo textual
    const datos = JSON.parse(rows[0].datos)
    expect(datos.navigateTo).toBe("denuncias")
    expect(datos.autoBloqueo).toBe(false)
  })

  test("9. the 3rd denuncia (auto-block) still creates exactly one notification, flagged as auto-blocked", async () => {
    const admin = await ensureSuperadmin("denuncia-block-admin")
    const cliente = await ensureCliente("denuncia-block-cliente")
    const clienteSession = await createSession(cliente.id, "cliente")

    for (let i = 0; i < 3; i++) {
      const negocio = await ensureNegocio(`denuncia-block-${i}`)
      const productoId = await ensureProducto(negocio.id)
      const negocioSession = await createSession(negocio.id, "negocio")
      const ip = `198.51.100.${randomUUID().slice(0, 2)}${i}`
      const pedidoRes = await crearPedido(pedidoReq(pedidoBody(negocio.id, productoId), ip, clienteSession), {})
      const pedido = await pedidoRes.json()
      const req = new NextRequest("http://localhost/api/denuncias", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${negocioSession}` },
        body: JSON.stringify({ clienteId: cliente.id, pedidoId: pedido.id, motivoTipo: "comportamiento", motivo: `Denuncia ${i} (test T26-R2)` }),
      })
      const res = await crearDenuncia(req)
      expect(res.status).toBe(201)
    }

    const rows = await db.notificacion.findMany({ where: { userId: admin.id, userType: "superadmin", tipo: "denuncia_nueva" } })
    expect(rows.length).toBe(3) // one per distinct denuncia — never artificially deduplicated
    const lastDatos = JSON.parse(rows[rows.length - 1].datos)
    expect(lastDatos.autoBloqueo).toBe(true)
    expect(rows[rows.length - 1].cuerpo).toMatch(/bloqueado/i)
  })
})

describe("P2-T26-R2 — destacado_solicitud (real event)", () => {
  test("10. a new destacado solicitud notifies superadmins", async () => {
    const admin = await ensureSuperadmin("destacado-admin")
    const negocio = await ensureNegocio("destacado")
    const negocioSession = await createSession(negocio.id, "negocio")

    const req = new NextRequest("http://localhost/api/destacado-solicitud", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${negocioSession}` },
      body: JSON.stringify({ meses: 1, dias: 0 }),
    })
    const res = await crearDestacadoSolicitud(req)
    expect(res.status).toBe(201)
    const body = await res.json()

    const rows = await db.notificacion.findMany({ where: { userId: admin.id, userType: "superadmin", tipo: "destacado_solicitud" } })
    expect(rows.length).toBe(1)
    const datos = JSON.parse(rows[0].datos)
    expect(datos.entityId).toBe(body.solicitud.id)
    expect(datos.navigateTo).toBe("solicitudes-destacado")
  })
})

describe("P2-T26-R2 — negocio_deuda alert crossing (real event)", () => {
  test("11. crossing 80% on a real delivery confirmation alerts once, stays silent while above, re-alerts after a real payment", async () => {
    const admin = await ensureSuperadmin("deuda-admin")
    const negocio = await ensureNegocio("deuda", { limiteDeuda: 1000, deudaTarifa: 0 })
    const productoId = await ensureProducto(negocio.id)
    const cliente = await ensureCliente("deuda-cliente")
    const clienteSession = await createSession(cliente.id, "cliente")
    const superadminToken = await createSuperadminSession(admin.id)
    const ip = `198.51.100.${randomUUID().slice(0, 2)}5`

    async function confirmarConTarifa(tarifaServicio: number) {
      const pedidoRes = await crearPedido(pedidoReq(pedidoBody(negocio.id, productoId), ip, clienteSession), {})
      const pedido = await pedidoRes.json()
      await db.pedido.update({ where: { id: pedido.id }, data: { estado: "listo_para_retirar", tarifaServicio, clienteConfirmaRecibido: false, deudaAcumulada: false } })
      const req = new NextRequest(`http://localhost/api/cliente/pedidos/${pedido.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${clienteSession}` },
        body: JSON.stringify({ action: "confirmar" }),
      })
      return confirmarPedido(req, { params: Promise.resolve({ id: pedido.id }) })
    }

    // 0 -> 700 (< 800 threshold): no alert.
    const r1 = await confirmarConTarifa(700)
    expect(r1.status).toBe(200)
    expect(await db.notificacion.count({ where: { userId: admin.id, userType: "superadmin", tipo: "negocio_deuda" } })).toBe(0)

    // 700 -> 850 (crosses 800): exactly one alert.
    const r2 = await confirmarConTarifa(150)
    expect(r2.status).toBe(200)
    expect(await db.notificacion.count({ where: { userId: admin.id, userType: "superadmin", tipo: "negocio_deuda" } })).toBe(1)

    // 850 -> 900 (already above): no second alert.
    const r3 = await confirmarConTarifa(50)
    expect(r3.status).toBe(200)
    expect(await db.notificacion.count({ where: { userId: admin.id, userType: "superadmin", tipo: "negocio_deuda" } })).toBe(1)

    // Real payment via the real superadmin endpoint resets deudaTarifa to 0.
    const abonarReq = new NextRequest(`http://localhost/api/superadmin/deuda/${negocio.id}/abonar`, {
      method: "POST",
      headers: { cookie: `${SUPERADMIN_SESSION_COOKIE_NAME}=${superadminToken}` },
    })
    const abonarRes = await abonarDeuda(abonarReq, { params: Promise.resolve({ id: negocio.id }) })
    expect(abonarRes.status).toBe(200)

    // 0 -> 850 again (fresh cross after the dip): a SECOND alert fires.
    const r4 = await confirmarConTarifa(850)
    expect(r4.status).toBe(200)
    const finalRows = await db.notificacion.findMany({ where: { userId: admin.id, userType: "superadmin", tipo: "negocio_deuda" } })
    expect(finalRows.length).toBe(2)
    for (const row of finalRows) {
      const datos = JSON.parse(row.datos)
      expect(datos.level).toBe("alert")
      expect(datos.entityId).toBe(negocio.id)
    }
  })
})

describe("P2-T26-R2 — role isolation for the new types", () => {
  test("12. the shared /api/notificaciones endpoint (cliente/negocio) never resolves superadmin rows", async () => {
    const admin = await ensureSuperadmin("isolation-admin")
    await notifySuperadmins(db, { tipo: "isolation_check", titulo: "t", cuerpo: "c", datos: {}, recipientIds: [admin.id] })

    const cliente = await ensureCliente("isolation-cliente")
    const clienteSession = await createSession(cliente.id, "cliente")
    const { GET: getGenericNotificaciones } = await import("@/app/api/notificaciones/route")
    const req = new NextRequest("http://localhost/api/notificaciones", { headers: { cookie: `${SESSION_COOKIE_NAME}=${clienteSession}` } })
    const res = await getGenericNotificaciones(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.notificaciones.some((n: { tipo: string }) => n.tipo === "isolation_check")).toBe(false)

    await db.notificacion.deleteMany({ where: { tipo: "isolation_check" } })
  })
})
