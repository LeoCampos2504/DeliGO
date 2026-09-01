/// <reference types="bun-types" />

// P2-T08 F-T08-02 — integración real contra PostgreSQL TESTING.
// El fixture es acotado, usa un prefijo único y se limpia completamente en
// afterAll. No usa Production DATABASE_URL ni mocks de Prisma.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  createOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
  deleteOperationalSession,
} from "@/lib/auth"
import { resolveMesaOccupancyCloseActor } from "@/lib/mesa-occupancy"
import { resolverActorCancelacionMesa } from "@/lib/mesa-pedido-cancelacion"
import { POST as cancelarPedido } from "@/app/api/operaciones/pedidos/[id]/cancelar/route"
import { POST as cerrarOcupacion } from "@/app/api/operaciones/mesas/[id]/ocupacion/route"

setDefaultTimeout(60_000)

const prefix = `test-p2-t08-operational-account-${randomUUID()}-`
let negocioId: string
let negocioAjenoId: string
let cuentaOperativaId: string
let empleadoId: string
let operationalToken: string

function requestWithOperationalCookie(url = "http://localhost/api/operaciones/test") {
  return new NextRequest(url, {
    headers: { cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${operationalToken}` },
  })
}

async function crearPedidoMesaConOcupacion(): Promise<{ pedidoId: string; ocupacionId: string; mesaId: string }> {
  const mesa = await db.mesa.create({ data: { negocioId, numero: 7000 + Math.floor(Math.random() * 500) } })
  const ocupacion = await db.sesionOcupacionMesa.create({
    data: { negocioId, mesaId: mesa.id, estado: "activa" },
  })
  await db.mesa.update({ where: { id: mesa.id }, data: { ocupacionActualId: ocupacion.id } })
  const pedido = await db.pedido.create({
    data: {
      negocioId,
      negocioSlug: `${prefix}slug`,
      negocioNombre: "P2-T08 Test",
      clienteNombre: "P2-T08 Cliente",
      mesaId: mesa.id,
      mesaNumero: mesa.numero,
      ocupacionMesaId: ocupacion.id,
      metodoEntrega: "mesa",
      estado: "recibido",
      total: 100,
      totalProductos: 100,
    },
  })
  return { pedidoId: pedido.id, ocupacionId: ocupacion.id, mesaId: mesa.id }
}

async function restaurarCuentaYEmpleado() {
  await db.cuentaOperativa.update({ where: { id: cuentaOperativaId }, data: { activo: true, eliminado: false } })
  await db.empleado.update({
    where: { id: empleadoId },
    data: { activo: true, eliminado: false, areaOperativa: "salon" },
  })
}

beforeAll(async () => {
  const negocio = await db.negocio.create({
    data: {
      slug: `${prefix}negocio`,
      nombre: "P2-T08 Test",
      usuario: `${prefix}usuario`,
      email: `${prefix}negocio@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
    },
  })
  negocioId = negocio.id

  const negocioAjeno = await db.negocio.create({
    data: {
      slug: `${prefix}ajeno`,
      nombre: "P2-T08 Test Ajeno",
      usuario: `${prefix}ajeno`,
      email: `${prefix}ajeno@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
    },
  })
  negocioAjenoId = negocioAjeno.id

  const cuenta = await db.cuentaOperativa.create({
    data: { nombre: "P2-T08 Cuenta", email: `${prefix}cuenta@example.test`, activo: true, eliminado: false },
  })
  cuentaOperativaId = cuenta.id
  const empleado = await db.empleado.create({
    data: {
      nombre: "P2-T08 Empleado",
      codigo: `${prefix}codigo`,
      negocioId,
      cuentaOperativaId,
      areaOperativa: "salon",
      activo: true,
      eliminado: false,
    },
  })
  empleadoId = empleado.id
  operationalToken = await createOperationalSession(cuentaOperativaId)
})

afterAll(async () => {
  if (operationalToken) await deleteOperationalSession(operationalToken)
  await db.sesion.deleteMany({ where: { userId: cuentaOperativaId } })
  await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: [negocioId, negocioAjenoId] } } } })
  await db.pedido.deleteMany({ where: { negocioId: { in: [negocioId, negocioAjenoId] } } })
  await db.sesionOcupacionMesa.deleteMany({ where: { negocioId: { in: [negocioId, negocioAjenoId] } } })
  await db.mesa.deleteMany({ where: { negocioId: { in: [negocioId, negocioAjenoId] } } })
  await db.empleado.deleteMany({ where: { id: empleadoId } })
  await db.cuentaOperativa.deleteMany({ where: { id: cuentaOperativaId } })
  await db.negocio.deleteMany({ where: { id: { in: [negocioId, negocioAjenoId] } } })
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
})

describe("P2-T08 F-T08-02 — lifecycle de CuentaOperativa en ocupación y cancelación", () => {
  test("cuenta activa + empleado activo + área correcta autoriza cierre de mesa", async () => {
    await restaurarCuentaYEmpleado()
    const actor = await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioId)
    expect(actor).toMatchObject({ type: "salon", negocioId, actorId: empleadoId })
  })

  test("activo=false deniega la siguiente request y no muta la ocupación", async () => {
    await restaurarCuentaYEmpleado()
    const { ocupacionId, mesaId: mesaConOcupacionId } = await crearPedidoMesaConOcupacion()
    await db.cuentaOperativa.update({ where: { id: cuentaOperativaId }, data: { activo: false } })

    const actor = await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioId)
    expect(actor).toBeNull()

    const response = await cerrarOcupacion(requestWithOperationalCookie(), { params: Promise.resolve({ id: mesaConOcupacionId }) })
    expect(response.status).toBe(401)
    const ocupacion = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionId } })
    expect(ocupacion.estado).toBe("activa")
  })

  test("reactivación vuelve a autorizar con la sesión vigente", async () => {
    await restaurarCuentaYEmpleado()
    await db.cuentaOperativa.update({ where: { id: cuentaOperativaId }, data: { activo: false } })
    expect(await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioId)).toBeNull()
    await db.cuentaOperativa.update({ where: { id: cuentaOperativaId }, data: { activo: true } })
    expect(await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioId)).toMatchObject({ type: "salon" })
  })

  test("eliminado=true deniega aunque la Sesion siga vigente", async () => {
    await restaurarCuentaYEmpleado()
    await db.cuentaOperativa.update({ where: { id: cuentaOperativaId }, data: { eliminado: true } })
    expect(await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioId)).toBeNull()
  })

  test("preserva los gates de Empleado, área y negocio", async () => {
    await restaurarCuentaYEmpleado()
    await db.empleado.update({ where: { id: empleadoId }, data: { activo: false } })
    expect(await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioId)).toBeNull()

    await db.empleado.update({ where: { id: empleadoId }, data: { activo: true, eliminado: true } })
    expect(await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioId)).toBeNull()

    await db.empleado.update({ where: { id: empleadoId }, data: { eliminado: false, areaOperativa: "pyr" } })
    expect(await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioId)).toBeNull()

    await db.empleado.update({ where: { id: empleadoId }, data: { areaOperativa: "salon" } })
    expect(await resolveMesaOccupancyCloseActor(requestWithOperationalCookie(), negocioAjenoId)).toBeNull()
  })

  test("cancelación válida funciona y cuenta deshabilitada rechaza sin mutar Pedido", async () => {
    await restaurarCuentaYEmpleado()
    const valid = await crearPedidoMesaConOcupacion()
    const validAuth = await resolverActorCancelacionMesa(requestWithOperationalCookie(), valid.pedidoId)
    expect(validAuth.ok).toBe(true)

    const revoked = await crearPedidoMesaConOcupacion()
    await db.cuentaOperativa.update({ where: { id: cuentaOperativaId }, data: { activo: false } })
    const response = await cancelarPedido(
      new NextRequest(`http://localhost/api/operaciones/pedidos/${revoked.pedidoId}/cancelar`, {
        method: "POST",
        headers: { cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${operationalToken}`, "content-type": "application/json" },
        body: JSON.stringify({ motivo: "Cuenta revocada" }),
      }),
      { params: Promise.resolve({ id: revoked.pedidoId }) }
    )
    expect(response.status).toBe(401)
    const pedido = await db.pedido.findUniqueOrThrow({ where: { id: revoked.pedidoId } })
    expect(pedido.estado).toBe("recibido")
  })
})
