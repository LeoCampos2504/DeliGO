/// <reference types="bun-types" />
// ============================================
// Regression: a linked cashier created without a name must NOT appear as
// «Pendiente de vinculación» in the owner's shift views (REAL ephemeral PostgreSQL).
// ============================================
// Unit cases of nombreVisibleEmpleado + the real owner routes (closed shifts,
// shift detail, shift list, registers) for a shift opened and blind-closed by
// such a cashier. Display only: the stored Empleado.nombre is NOT changed.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { NOMBRE_EMPLEADO_PENDIENTE, nombreVisibleEmpleado } from "@/lib/caja-nombre-empleado"
import { GET as getCajas } from "@/app/api/negocio/caja/cajas/route"
import { GET as getTurnos } from "@/app/api/negocio/caja/turnos/route"
import { GET as getTurno } from "@/app/api/negocio/caja/turnos/[id]/route"
import { GET as getCerrados } from "@/app/api/negocio/caja/turnos/cerrados/route"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { POST as postDevolucionCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route"
import { POST as postReintegroCajero } from "@/app/api/operativo/caja/[slug]/devoluciones/[id]/reintegro/route"
import { POST as postCambioCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/cambios/route"
import { POST as postAdicionalCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/adicionales/route"
import { GET as getHistorialOwner } from "@/app/api/negocio/caja/ventas/historial/route"
import { GET as getCadenaOwner } from "@/app/api/negocio/caja/ventas/[id]/cadena/route"

setDefaultTimeout(120_000)

describe("nombreVisibleEmpleado (unit)", () => {
  test("a real own name always wins", () => {
    expect(nombreVisibleEmpleado({ nombre: "Beto", cuentaOperativa: { nombre: "Roberto Cuenta", eliminado: false } })).toBe("Beto")
  })
  test("placeholder + linked account → the account's name", () => {
    expect(nombreVisibleEmpleado({ nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: { nombre: "Ana Real", eliminado: false } })).toBe("Ana Real")
    expect(nombreVisibleEmpleado({ nombre: "  ", cuentaOperativa: { nombre: "Ana Real", eliminado: false } })).toBe("Ana Real")
  })
  test("placeholder without a usable linked account stays (it is then true)", () => {
    expect(nombreVisibleEmpleado({ nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: null })).toBe(NOMBRE_EMPLEADO_PENDIENTE)
    expect(nombreVisibleEmpleado({ nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: { nombre: "Borrada", eliminado: true } })).toBe(NOMBRE_EMPLEADO_PENDIENTE)
  })
  test("nothing known → «Empleado»", () => {
    expect(nombreVisibleEmpleado(null)).toBe("Empleado")
    expect(nombreVisibleEmpleado({ nombre: "", cuentaOperativa: null })).toBe("Empleado")
  })
})

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
const integracion = Boolean(testDatabaseUrl && process.env.DATABASE_URL === testDatabaseUrl && isEphemeralIntegrationDb && (process.env.DELIGO_ENVIRONMENT ?? "").toUpperCase() === "TESTING")
const ephemeralTest = integracion ? test : test.skip

afterAll(async () => {
  if (integracion) await db.$disconnect()
})

describe("owner shift views show the linked account's name for a placeholder-named cashier", () => {
  ephemeralTest("closed shifts, shift detail, shift list and registers", async () => {
    const suffix = randomUUID().slice(0, 12)
    const negocio = await db.negocio.create({
      data: { slug: `test-nombre-${suffix}`, nombre: `Test nombre ${suffix}`, usuario: `test-nombre-${suffix}`, email: `test-nombre-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
    })
    const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
    const cuenta = await db.cuentaOperativa.create({ data: { nombre: "Ana Real", email: `nombre-${suffix}@example.test`, activo: true, eliminado: false } })
    const empleado = await db.empleado.create({ data: { nombre: NOMBRE_EMPLEADO_PENDIENTE, codigo: `N${suffix.slice(0, 7)}`.toUpperCase(), negocioId: negocio.id, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
    process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
    process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS, empleado.id].filter(Boolean).join(",")
    const cajero = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
    const get = (url: string) => new NextRequest(`http://localhost${url}`, { headers: { cookie: owner } })
    const cajas = await (await getCajas(get("/api/negocio/caja/cajas"))).json()
    const cajaId: string = cajas.cajas[0].id
    const post = (body: unknown) => new NextRequest(`http://localhost/api/operativo/caja/${negocio.slug}/turno`, { method: "POST", headers: { cookie: cajero, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify(body) })
    const ctx = { params: Promise.resolve({ slug: negocio.slug }) }
    const abierto = await (await postTurnoCajero(post({ cajaFisicaId: cajaId, fondoInicial: "100.00" }), ctx)).json()
    const turnoId: string = abierto.turno.id

    // While open: shift list and registers name the real person.
    const lista = await (await getTurnos(get("/api/negocio/caja/turnos"))).json()
    expect(lista.turnos.find((t: { id: string }) => t.id === turnoId).responsableNombre).toBe("Ana Real")
    const conTurno = await (await getCajas(get("/api/negocio/caja/cajas"))).json()
    expect(conTurno.cajas.find((c: { id: string }) => c.id === cajaId).turnoAbierto.responsableNombre).toBe("Ana Real")

    // Blind close, then the owner's closed-shift views.
    const cierre = await postTurnoCajero(post({ action: "close", turnoCajaId: turnoId, efectivoContado: "100.00" }), ctx)
    expect(cierre.status).toBe(200)
    const cerrados = await (await getCerrados(get("/api/negocio/caja/turnos/cerrados"))).json()
    const fila = cerrados.turnos.find((t: { id: string }) => t.id === turnoId)
    expect([fila.responsableNombre, fila.cerradoPor]).toEqual(["Ana Real", "Ana Real"])
    const detalle = await (await getTurno(get(`/api/negocio/caja/turnos/${turnoId}`), { params: Promise.resolve({ id: turnoId }) })).json()
    expect(detalle.responsableNombre).toBe("Ana Real")
    const lineaPendiente = JSON.stringify({ lista, cerrados, detalle })
    expect(lineaPendiente).not.toContain(NOMBRE_EMPLEADO_PENDIENTE)

    // Display only: the stored employee name is unchanged.
    expect((await db.empleado.findUniqueOrThrow({ where: { id: empleado.id } })).nombre).toBe(NOMBRE_EMPLEADO_PENDIENTE)
  })
})

describe("owner notices, return history and exchange chain name the linked account (not the placeholder)", () => {
  ephemeralTest("cashier return, refund paid later, exchange and linked additional sale", async () => {
    const suffix = randomUUID().slice(0, 12)
    const negocio = await db.negocio.create({
      data: { slug: `test-aviso-${suffix}`, nombre: `Test aviso ${suffix}`, usuario: `test-aviso-${suffix}`, email: `test-aviso-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
    })
    const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
    const cuenta = await db.cuentaOperativa.create({ data: { nombre: "Ana Real", email: `aviso-${suffix}@example.test`, activo: true, eliminado: false } })
    const empleado = await db.empleado.create({ data: { nombre: NOMBRE_EMPLEADO_PENDIENTE, codigo: `A${suffix.slice(0, 7)}`.toUpperCase(), negocioId: negocio.id, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
    const cajero = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
    const alfajor = await db.producto.create({ data: { nombre: "Alfajor", precio: 1000, negocioId: negocio.id, controlStock: true, stockCantidad: 20 } })
    const bombon = await db.producto.create({ data: { nombre: "Bombon", precio: 1000, negocioId: negocio.id, controlStock: true, stockCantidad: 20 } })
    const slug = negocio.slug
    const post = async (url: string, body: unknown) => {
      const r = new NextRequest(`http://localhost${url}`, { method: "POST", headers: { cookie: cajero, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify(body) })
      return r
    }
    const sid = (id: string) => ({ params: Promise.resolve({ slug, id }) })
    const venta = await (await postVentaCajero(await post(`/api/operativo/caja/${slug}/ventas`, { metodoPago: "TRANSFERENCIA", items: [{ productoId: alfajor.id, cantidad: 3 }] }), { params: Promise.resolve({ slug }) })).json()
    const item = venta.items[0].id
    const dev = await postDevolucionCajero(await post(`/api/operativo/caja/${slug}/ventas/${venta.id}/devoluciones`, { tipo: "DEVOLUCION_PARCIAL", motivo: "nombre", items: [{ ventaItemId: item, cantidad: 1, reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true }), sid(venta.id))
    expect(dev.status).toBe(201)
    const devId: string = (await dev.json()).devolucion.id
    expect((await postReintegroCajero(await post(`/api/operativo/caja/${slug}/devoluciones/${devId}/reintegro`, { medio: "TRANSFERENCIA", confirmo: true }), sid(devId))).status).toBe(201)
    expect((await postCambioCajero(await post(`/api/operativo/caja/${slug}/ventas/${venta.id}/cambios`, { motivo: "nombre", salen: [{ ventaItemId: item, cantidad: 1, reingresaStock: true }], entran: [{ productoId: bombon.id, cantidad: 1 }], esperado: { salida: "1000.00", entrada: "1000.00" }, confirmo: true }), sid(venta.id))).status).toBe(201)
    expect((await postAdicionalCajero(await post(`/api/operativo/caja/${slug}/ventas/${venta.id}/adicionales`, { metodoPago: "TRANSFERENCIA", items: [{ productoId: bombon.id, cantidad: 1 }] }), sid(venta.id))).status).toBe(201)

    // Owner notices written for these operations: the real name, never the placeholder.
    const avisos = await db.notificacion.findMany({ where: { negocioId: negocio.id }, select: { titulo: true, cuerpo: true, datos: true } })
    expect(avisos.length).toBeGreaterThanOrEqual(4)
    for (const a of avisos) {
      expect(`${a.titulo} ${a.cuerpo} ${a.datos}`).not.toContain(NOMBRE_EMPLEADO_PENDIENTE)
    }
    expect(avisos.filter((a) => a.cuerpo.startsWith("Ana Real "))).toHaveLength(4)

    // Owner views: return history (who registered the return / the refund) and the exchange chain.
    const get = (url: string) => new NextRequest(`http://localhost${url}`, { headers: { cookie: owner } })
    const desde = new Date(Date.now() - 3_600_000).toISOString(), hasta = new Date(Date.now() + 3_600_000).toISOString()
    const historial = await (await getHistorialOwner(get(`/api/negocio/caja/ventas/historial?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`))).json()
    const cadena = await (await getCadenaOwner(get(`/api/negocio/caja/ventas/${venta.id}/cadena`), { params: Promise.resolve({ id: venta.id }) })).json()
    const vistas = JSON.stringify({ historial, cadena })
    expect(vistas).toContain("Ana Real")
    expect(vistas).not.toContain(NOMBRE_EMPLEADO_PENDIENTE)

    // Display only: the stored employee name is unchanged.
    expect((await db.empleado.findUniqueOrThrow({ where: { id: empleado.id } })).nombre).toBe(NOMBRE_EMPLEADO_PENDIENTE)
  })
})
