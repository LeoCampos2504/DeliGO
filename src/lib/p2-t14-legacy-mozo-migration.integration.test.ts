/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  createOperationalSession,
  deleteOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
} from "@/lib/auth"
import { GET as legacyMozoGet } from "@/app/api/mozo/route"
import { POST as legacyPushSubscribe } from "@/app/api/mozo/push/subscribe/route"
import { POST as legacyPushUnsubscribe } from "@/app/api/mozo/push/unsubscribe/route"
import { POST as legacyMesaAssign } from "@/app/api/negocio/mesas-assign/route"
import {
  GET as operativePanelGet,
  POST as operativePanelPost,
} from "@/app/api/operativo/mozo/panel/[slug]/route"

setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

type NegocioFixture = { id: string; slug: string }
type CuentaFixture = { id: string; sessionToken: string }
type EmpleadoFixture = { id: string; codigo: string }
type MesaFixture = { id: string; numero: number }

async function crearNegocio(prefix: string): Promise<NegocioFixture> {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `${prefix}-${suffix}`,
      nombre: `Test P2-T14 ${prefix} ${suffix}`,
      usuario: `test-p2-t14-${prefix}-${suffix}`,
      email: `test-p2-t14-${prefix}-${suffix}@example.com`,
      password: "no-usado-en-estos-tests",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
      empleadosActivos: true,
      horarioMode: "simple",
      abiertoManual: true,
    },
  })
  return { id: negocio.id, slug: negocio.slug }
}

async function crearCuenta(): Promise<CuentaFixture> {
  const suffix = randomUUID()
  const cuenta = await db.cuentaOperativa.create({
    data: {
      nombre: `Cuenta P2-T14 ${suffix}`,
      email: `test-p2-t14-${suffix}@example.com`,
      activo: true,
      eliminado: false,
    },
  })
  const sessionToken = await createOperationalSession(cuenta.id)
  return { id: cuenta.id, sessionToken }
}

function requestWithSession(url: string, sessionToken: string): NextRequest {
  return new NextRequest(url, {
    headers: {
      cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${sessionToken}`,
    },
  })
}

function jsonRequest(url: string, body: unknown, headers?: HeadersInit): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

let negocioA: NegocioFixture
let negocioB: NegocioFixture
let cuenta: CuentaFixture
let empleado: EmpleadoFixture
let mesaA: MesaFixture
let mesaB: MesaFixture

beforeAll(async () => {
  negocioA = await crearNegocio("test-p2-t14-a")
  negocioB = await crearNegocio("test-p2-t14-b")
  cuenta = await crearCuenta()

  const codigo = `MZ${randomUUID().slice(0, 8).toUpperCase()}`
  const employee = await db.empleado.create({
    data: {
      nombre: `Mozo legacy P2-T14 ${randomUUID()}`,
      codigo,
      negocioId: negocioA.id,
      cuentaOperativaId: cuenta.id,
      rol: "mozo",
      areaOperativa: "mozo",
      activo: true,
      eliminado: false,
      token: "known-legacy-token-p2-t14",
    },
  })
  empleado = { id: employee.id, codigo: employee.codigo }

  const [createdMesaA, createdMesaB] = await Promise.all([
    db.mesa.create({
      data: {
        negocioId: negocioA.id,
        numero: 914,
        nombre: "Mesa P2-T14 A",
      },
    }),
    db.mesa.create({
      data: {
        negocioId: negocioB.id,
        numero: 915,
        nombre: "Mesa P2-T14 B",
      },
    }),
  ])
  mesaA = { id: createdMesaA.id, numero: createdMesaA.numero }
  mesaB = { id: createdMesaB.id, numero: createdMesaB.numero }
})

afterAll(async () => {
  await deleteOperationalSession(cuenta.sessionToken)
  await db.mesa.deleteMany({ where: { id: { in: [mesaA.id, mesaB.id] } } })
  await db.empleado.deleteMany({ where: { id: empleado.id } })
  await db.negocio.deleteMany({ where: { id: { in: [negocioA.id, negocioB.id] } } })
  await db.cuentaOperativa.deleteMany({ where: { id: cuenta.id } })
})

describe("P2-T14 — migración completa del token M legacy", () => {
  test("los endpoints legacy rechazan el token conocido sin mutar Empleado", async () => {
    const before = await db.empleado.findUnique({
      where: { id: empleado.id },
      select: { token: true, pushSubscription: true },
    })

    const legacyGet = await legacyMozoGet(
      new NextRequest("http://localhost/api/mozo", {
        headers: { authorization: "Bearer known-legacy-token-p2-t14" },
      })
    )
    const subscribe = await legacyPushSubscribe(
      jsonRequest("http://localhost/api/mozo/push/subscribe", {
        mozoToken: "known-legacy-token-p2-t14",
        subscription: { endpoint: "https://example.test/legacy" },
      })
    )
    const unsubscribe = await legacyPushUnsubscribe(
      jsonRequest("http://localhost/api/mozo/push/unsubscribe", {
        mozoToken: "known-legacy-token-p2-t14",
      })
    )

    expect(legacyGet.status).toBe(410)
    expect(subscribe.status).toBe(410)
    expect(unsubscribe.status).toBe(410)
    expect(await db.empleado.findUnique({
      where: { id: empleado.id },
      select: { token: true, pushSubscription: true },
    })).toEqual(before)
  })

  test("la sesión operativa permite consultar y tomar una mesa del negocio vinculado", async () => {
    const panel = await operativePanelGet(
      requestWithSession(`http://localhost/api/operativo/mozo/panel/${negocioA.slug}`, cuenta.sessionToken),
      { params: Promise.resolve({ slug: negocioA.slug }) }
    )
    const panelBody = await panel.json() as {
      ok: boolean
      empleado: { codigo: string }
      mesas: Array<{ id: string; asignadaAMi: boolean }>
    }

    expect(panel.status).toBe(200)
    expect(panelBody.ok).toBe(true)
    expect(panelBody.empleado.codigo).toBe(empleado.codigo)
    expect(panelBody.mesas.some((mesa) => mesa.id === mesaA.id)).toBe(true)

    const take = await operativePanelPost(
      jsonRequest(
        `http://localhost/api/operativo/mozo/panel/${negocioA.slug}`,
        { accion: "tomar_mesa", mesaId: mesaA.id },
        { cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${cuenta.sessionToken}` }
      ),
      { params: Promise.resolve({ slug: negocioA.slug }) }
    )
    expect(take.status).toBe(200)
    expect((await take.json()).mesa.asignadaAMi).toBe(true)
    expect((await db.mesa.findUnique({ where: { id: mesaA.id }, select: { empleadoId: true } }))?.empleadoId)
      .toBe(empleado.id)
  })

  test("la autorización es cross-business y el endpoint viejo de asignación no acepta sesión operativa/token", async () => {
    const crossBusiness = await operativePanelGet(
      requestWithSession(`http://localhost/api/operativo/mozo/panel/${negocioB.slug}`, cuenta.sessionToken),
      { params: Promise.resolve({ slug: negocioB.slug }) }
    )
    expect(crossBusiness.status).toBe(403)
    expect((await crossBusiness.json()).estado).toBe("acceso_no_disponible")

    const legacyAssign = await legacyMesaAssign(
      jsonRequest("http://localhost/api/negocio/mesas-assign", {
        mesaId: mesaA.id,
        empleadoCodigo: empleado.codigo,
        mozoToken: "known-legacy-token-p2-t14",
      })
    )
    expect(legacyAssign.status).toBe(401)

    const spoofed = await operativePanelPost(
      jsonRequest(
        `http://localhost/api/operativo/mozo/panel/${negocioA.slug}`,
        {
          accion: "tomar_mesa",
          mesaId: mesaA.id,
          empleadoId: "empleado-spoof",
          negocioId: negocioB.id,
          areaOperativa: "pyr",
          role: "admin",
          mozoToken: "known-legacy-token-p2-t14",
        },
        { cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${cuenta.sessionToken}` }
      ),
      { params: Promise.resolve({ slug: negocioA.slug }) }
    )
    expect(spoofed.status).toBe(200)
    expect((await db.mesa.findUnique({ where: { id: mesaA.id }, select: { empleadoId: true } }))?.empleadoId)
      .toBe(empleado.id)
  })

  test("el resolver revoca el acceso cuando cambia el área o se elimina la sesión", async () => {
    await db.empleado.update({ where: { id: empleado.id }, data: { areaOperativa: "pyr" } })
    const wrongArea = await operativePanelGet(
      requestWithSession(`http://localhost/api/operativo/mozo/panel/${negocioA.slug}`, cuenta.sessionToken),
      { params: Promise.resolve({ slug: negocioA.slug }) }
    )
    expect(wrongArea.status).toBe(403)
    expect((await wrongArea.json()).estado).toBe("area_no_habilitada")

    await db.empleado.update({ where: { id: empleado.id }, data: { areaOperativa: "mozo" } })
    await db.empleado.update({ where: { id: empleado.id }, data: { activo: false } })
    const inactive = await operativePanelGet(
      requestWithSession(`http://localhost/api/operativo/mozo/panel/${negocioA.slug}`, cuenta.sessionToken),
      { params: Promise.resolve({ slug: negocioA.slug }) }
    )
    expect(inactive.status).toBe(403)
    expect((await inactive.json()).estado).toBe("acceso_no_disponible")

    await db.empleado.update({ where: { id: empleado.id }, data: { activo: true, eliminado: true } })
    const deleted = await operativePanelGet(
      requestWithSession(`http://localhost/api/operativo/mozo/panel/${negocioA.slug}`, cuenta.sessionToken),
      { params: Promise.resolve({ slug: negocioA.slug }) }
    )
    expect(deleted.status).toBe(403)
    expect((await deleted.json()).estado).toBe("acceso_no_disponible")

    await db.empleado.update({ where: { id: empleado.id }, data: { eliminado: false } })
    await deleteOperationalSession(cuenta.sessionToken)
    const noSession = await operativePanelGet(
      requestWithSession(`http://localhost/api/operativo/mozo/panel/${negocioA.slug}`, cuenta.sessionToken),
      { params: Promise.resolve({ slug: negocioA.slug }) }
    )
    expect(noSession.status).toBe(401)
    expect((await noSession.json()).estado).toBe("sin_sesion")
  })
})
