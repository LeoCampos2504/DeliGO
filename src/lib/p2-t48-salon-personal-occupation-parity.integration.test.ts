import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  createOperationalSession,
  deleteOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
} from "@/lib/auth"
import { getMesaOccupancyStatus } from "@/lib/mesa-occupancy"
import { GET as getMesaOccupancy } from "@/app/api/operaciones/mesas/[id]/ocupacion/route"

// P2-T48: integración real contra PostgreSQL TESTING. La ocupación es la
// autoridad: los pedidos son datos ortogonales y se crean sólo para probar que
// no cambian el resultado de la lectura de ocupación.
setDefaultTimeout(60_000)

const prefix = `test-p2-t48-occupation-${randomUUID()}-`
let negocioId: string
let negocioAjenoId: string
let cuentaSalonId: string
let cuentaMozoId: string
let cuentaPyrId: string
let cuentaOtroMozoId: string
let salonEmpleadoId: string
let mozoEmpleadoId: string
let otroMozoEmpleadoId: string
let salonToken: string
let mozoToken: string
let pyrToken: string

function requestFor(token: string, url = "http://localhost/api/operaciones/mesas/test/ocupacion") {
  return new NextRequest(url, {
    headers: { cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${token}` },
  })
}

async function createMesa(negocio: string, empleadoId?: string) {
  return db.mesa.create({
    data: {
      negocioId: negocio,
      numero: 4800 + Math.floor(Math.random() * 1000),
      empleadoId,
      activa: true,
    },
  })
}

async function createOccupation(mesaId: string, negocio: string, estado: "activa" | "cerrada" = "activa") {
  const ocupacion = await db.sesionOcupacionMesa.create({
    data: {
      negocioId: negocio,
      mesaId,
      estado,
      cerradaEn: estado === "cerrada" ? new Date() : null,
    },
  })
  if (estado === "activa") {
    await db.mesa.update({ where: { id: mesaId }, data: { ocupacionActualId: ocupacion.id } })
  }
  return ocupacion
}

async function createMesaOrder(negocio: string, mesaId: string, ocupacionId: string | null, estado: string) {
  const mesa = await db.mesa.findUniqueOrThrow({ where: { id: mesaId }, select: { numero: true } })
  return db.pedido.create({
    data: {
      negocioId: negocio,
      negocioSlug: `${prefix}slug`,
      negocioNombre: "P2-T48 Test",
      clienteNombre: "P2-T48 Cliente",
      mesaId,
      mesaNumero: mesa.numero,
      ocupacionMesaId: ocupacionId,
      metodoEntrega: "mesa",
      estado,
      total: 100,
      totalProductos: 100,
    },
  })
}

async function readOccupation(mesaId: string, token = salonToken) {
  const response = await getMesaOccupancy(requestFor(token, `http://localhost/api/operaciones/mesas/${mesaId}/ocupacion`), {
    params: Promise.resolve({ id: mesaId }),
  })
  return { response, body: await response.json() }
}

beforeAll(async () => {
  const negocio = await db.negocio.create({
    data: {
      slug: `${prefix}negocio`,
      nombre: "P2-T48 Negocio",
      usuario: `${prefix}usuario`,
      email: `${prefix}negocio@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
      empleadosActivos: true,
    },
  })
  negocioId = negocio.id

  const negocioAjeno = await db.negocio.create({
    data: {
      slug: `${prefix}ajeno`,
      nombre: "P2-T48 Negocio Ajeno",
      usuario: `${prefix}ajeno`,
      email: `${prefix}ajeno@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
      empleadosActivos: true,
    },
  })
  negocioAjenoId = negocioAjeno.id

  const cuentas = await Promise.all([
    db.cuentaOperativa.create({ data: { nombre: "P2-T48 Salón", email: `${prefix}salon@example.test` } }),
    db.cuentaOperativa.create({ data: { nombre: "P2-T48 Mozo", email: `${prefix}mozo@example.test` } }),
    db.cuentaOperativa.create({ data: { nombre: "P2-T48 PyR", email: `${prefix}pyr@example.test` } }),
    db.cuentaOperativa.create({ data: { nombre: "P2-T48 Otro Mozo", email: `${prefix}otro-mozo@example.test` } }),
  ])
  ;[cuentaSalonId, cuentaMozoId, cuentaPyrId, cuentaOtroMozoId] = cuentas.map((cuenta) => cuenta.id)

  const empleados = await Promise.all([
    db.empleado.create({
      data: { nombre: "P2-T48 Salón", codigo: `${prefix}SL`, negocioId, cuentaOperativaId: cuentaSalonId, areaOperativa: "salon" },
    }),
    db.empleado.create({
      data: { nombre: "P2-T48 Mozo", codigo: `${prefix}MZ`, negocioId, cuentaOperativaId: cuentaMozoId, areaOperativa: "mozo" },
    }),
    db.empleado.create({
      data: { nombre: "P2-T48 PyR", codigo: `${prefix}PY`, negocioId, cuentaOperativaId: cuentaPyrId, areaOperativa: "pyr" },
    }),
    db.empleado.create({
      data: { nombre: "P2-T48 Otro Mozo", codigo: `${prefix}OM`, negocioId, cuentaOperativaId: cuentaOtroMozoId, areaOperativa: "mozo" },
    }),
  ])
  ;[salonEmpleadoId, mozoEmpleadoId, otroMozoEmpleadoId] = [empleados[0].id, empleados[1].id, empleados[3].id]
  salonToken = await createOperationalSession(cuentaSalonId)
  mozoToken = await createOperationalSession(cuentaMozoId)
  pyrToken = await createOperationalSession(cuentaPyrId)
})

afterAll(async () => {
  for (const token of [salonToken, mozoToken, pyrToken]) {
    if (token) await deleteOperationalSession(token)
  }
  await db.sesion.deleteMany({ where: { userId: { in: [cuentaSalonId, cuentaMozoId, cuentaPyrId, cuentaOtroMozoId] } } })
  await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: [negocioId, negocioAjenoId] } } } })
  await db.pedido.deleteMany({ where: { negocioId: { in: [negocioId, negocioAjenoId] } } })
  await db.sesionOcupacionMesa.deleteMany({ where: { negocioId: { in: [negocioId, negocioAjenoId] } } })
  await db.mesa.deleteMany({ where: { negocioId: { in: [negocioId, negocioAjenoId] } } })
  await db.empleado.deleteMany({ where: { id: { in: [salonEmpleadoId, mozoEmpleadoId, otroMozoEmpleadoId] } } })
  await db.cuentaOperativa.deleteMany({ where: { id: { in: [cuentaSalonId, cuentaMozoId, cuentaPyrId, cuentaOtroMozoId] } } })
  await db.negocio.deleteMany({ where: { id: { in: [negocioId, negocioAjenoId] } } })
})

describe("P2-T48 — autoridad y paridad de ocupación personal de Salón", () => {
  test("Caso A: ocupación activa + pedido activo => ocupación visible", async () => {
    const mesa = await createMesa(negocioId)
    const ocupacion = await createOccupation(mesa.id, negocioId)
    await createMesaOrder(negocioId, mesa.id, ocupacion.id, "recibido")

    const { response, body } = await readOccupation(mesa.id)
    expect(response.status).toBe(200)
    expect(body.hasActiveOccupancy).toBe(true)
    expect(body.occupancy.id).toBe(ocupacion.id)
  })

  test("Caso B: ocupación activa + cero pedidos => ocupación visible", async () => {
    const mesa = await createMesa(negocioId)
    const ocupacion = await createOccupation(mesa.id, negocioId)

    const { response, body } = await readOccupation(mesa.id)
    expect(response.status).toBe(200)
    expect(body.hasActiveOccupancy).toBe(true)
    expect(body.occupancy.id).toBe(ocupacion.id)
  })

  test("Caso C: sin ocupación actual + sólo datos históricos => estado vacío", async () => {
    const mesa = await createMesa(negocioId)
    await createMesaOrder(negocioId, mesa.id, null, "entregado")

    const { response, body } = await readOccupation(mesa.id)
    expect(response.status).toBe(200)
    expect(body.hasActiveOccupancy).toBe(false)
    expect(body.occupancy).toBeNull()
  })

  test("pedido entregado no oculta una ocupación que sigue activa", async () => {
    const mesa = await createMesa(negocioId)
    const ocupacion = await createOccupation(mesa.id, negocioId)
    await createMesaOrder(negocioId, mesa.id, ocupacion.id, "entregado")

    const { body } = await readOccupation(mesa.id)
    expect(body.hasActiveOccupancy).toBe(true)
    expect(body.occupancy.id).toBe(ocupacion.id)
  })

  test("multiple occupations/history selecciona sólo la ocupación actual canónica", async () => {
    const mesa = await createMesa(negocioId)
    await createOccupation(mesa.id, negocioId, "cerrada")
    const actual = await createOccupation(mesa.id, negocioId, "activa")

    const result = await getMesaOccupancyStatus({ negocioId, mesaId: mesa.id })
    expect(result).toMatchObject({ status: "active", occupancy: { id: actual.id } })
  })

  test("ocupación de otra mesa queda inconsistente y no se expone como válida", async () => {
    const mesaReal = await createMesa(negocioId)
    const mesaApuntada = await createMesa(negocioId)
    const ocupacion = await createOccupation(mesaReal.id, negocioId)
    await db.mesa.update({ where: { id: mesaReal.id }, data: { ocupacionActualId: null } })
    await db.mesa.update({ where: { id: mesaApuntada.id }, data: { ocupacionActualId: ocupacion.id } })

    const { response, body } = await readOccupation(mesaApuntada.id)
    expect(response.status).toBe(409)
    expect(body.occupancy).toBeUndefined()
  })

  test("ocupación de otro empleado no se expone al Mozo sin asignación de mesa", async () => {
    const mesa = await createMesa(negocioId, otroMozoEmpleadoId)
    await createOccupation(mesa.id, negocioId)

    const { response } = await readOccupation(mesa.id, mozoToken)
    expect(response.status).toBe(403)
  })

  test("ocupación de otro negocio no se expone", async () => {
    const mesa = await createMesa(negocioAjenoId)
    await createOccupation(mesa.id, negocioAjenoId)

    const { response } = await readOccupation(mesa.id, mozoToken)
    expect(response.status).toBe(401)
  })

  test("área PyR no obtiene ocupación de Salón", async () => {
    const mesa = await createMesa(negocioId)
    await createOccupation(mesa.id, negocioId)

    const { response } = await readOccupation(mesa.id, pyrToken)
    expect(response.status).toBe(401)
  })

  test("aislamiento Personal/Terminal: la página personal sólo usa API y cookie operativa", async () => {
    const page = await Bun.file("src/app/operaciones/mi-panel/[slug]/salon/page.tsx").text()
    expect(page).toContain("/api/operativo/salon/panel/")
    expect(page).not.toContain("requireOperacionesScope")
    expect(page).not.toContain("terminal")
  })
})
