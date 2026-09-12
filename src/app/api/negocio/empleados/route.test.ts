/// <reference types="bun-types" />

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET, POST } from "./route"
import { DELETE, PUT } from "./[id]/route"
import { GET as GET_BY_CODIGO } from "@/app/api/empleados/by-codigo/route"

setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

const createdBusinesses: string[] = []
const createdSessions: string[] = []

async function createBusiness(prefix: string) {
  const suffix = randomUUID()
  const business = await db.negocio.create({
    data: {
      slug: `${prefix}-${suffix}`,
      nombre: `${prefix} ${suffix}`,
      usuario: `${prefix}-${suffix}`,
      email: `${prefix}-${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
      empleadosActivos: true,
    },
  })
  createdBusinesses.push(business.id)
  return business
}

async function businessCookie(businessId: string) {
  const token = await createSession(businessId, "negocio")
  createdSessions.push(token)
  return `${SESSION_COOKIE_NAME}=${token}`
}

function request(url: string, method: string, cookie: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

afterAll(async () => {
  for (const token of createdSessions) await deleteSession(token)
  await db.empleado.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("P2-T43-R1 — GET/POST /api/negocio/empleados", () => {
  test("CASE I/K: modern POST accepts no personal name and GET projects pending state", async () => {
    const business = await createBusiness("test-p2-t43-r1-admin")
    const cookie = await businessCookie(business.id)
    const code = `T43R1${randomUUID().slice(0, 6).toUpperCase()}`
    const createResponse = await POST(request("/api/negocio/empleados", "POST", cookie, {
      codigo: code,
      rol: "mozo",
      areaOperativa: "mozo",
    }))
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json()
    expect(created.nombre).toBe("Pendiente de vinculación")

    const listResponse = await GET(request("/api/negocio/empleados", "GET", cookie))
    expect(listResponse.status).toBe(200)
    const row = (await listResponse.json()).find((employee: { id: string }) => employee.id === created.id)
    expect(row.identityLinked).toBe(false)
    expect(row.displayName).toBeNull()
    expect(row.nombre).toBe("Pendiente de vinculación")
    expect(row.areaOperativa).toBe("mozo")
    expect(row.activo).toBe(true)
  })

  test("CASE H/N: linked identity is projected from CuentaOperativa, not Empleado.nombre", async () => {
    const business = await createBusiness("test-p2-t43-r1-projection")
    const account = await db.cuentaOperativa.create({
      data: { nombre: "Nombre declarado por empleado", email: `projection-${randomUUID()}@example.test` },
    })
    const employee = await db.empleado.create({
      data: {
        nombre: "Nombre administrativo legacy",
        codigo: `T43R1${randomUUID().slice(0, 6).toUpperCase()}`,
        negocioId: business.id,
        cuentaOperativaId: account.id,
        rol: "mozo",
        areaOperativa: "salon",
      },
    })
    const response = await GET(request("/api/negocio/empleados", "GET", await businessCookie(business.id)))
    const row = (await response.json()).find((candidate: { id: string }) => candidate.id === employee.id)
    expect(row.identityLinked).toBe(true)
    expect(row.displayName).toBe("Nombre declarado por empleado")
    expect(row.cuentaOperativa.nombre).toBe("Nombre declarado por empleado")
    await db.cuentaOperativa.delete({ where: { id: account.id } })
  })

  test("CASE J: business scope prevents admin A from reading business B employees", async () => {
    const businessA = await createBusiness("test-p2-t43-r1-scope-a")
    const businessB = await createBusiness("test-p2-t43-r1-scope-b")
    const employeeB = await db.empleado.create({
      data: {
        nombre: "B employee",
        codigo: `T43R1${randomUUID().slice(0, 6).toUpperCase()}`,
        negocioId: businessB.id,
        rol: "mozo",
        areaOperativa: "mozo",
      },
    })
    const response = await GET(request("/api/negocio/empleados?negocioId=${businessB.id}", "GET", await businessCookie(businessA.id)))
    expect((await response.json()).some((candidate: { id: string }) => candidate.id === employeeB.id)).toBe(false)
  })

  test("P2-T43-R2 CASE C1-C9: internal code reuses only after soft-delete and stays business-scoped", async () => {
    const businessA = await createBusiness("test-p2-t43-r2-code-a")
    const cookieA = await businessCookie(businessA.id)
    const code = "ABC"

    const firstResponse = await POST(request("/api/negocio/empleados", "POST", cookieA, { codigo: code, rol: "mozo" }))
    expect(firstResponse.status).toBe(201)
    const first = await firstResponse.json() as { id: string }

    const duplicateResponse = await POST(request("/api/negocio/empleados", "POST", cookieA, { codigo: code, rol: "mozo" }))
    expect(duplicateResponse.status).toBe(409)

    const deactivateResponse = await PUT(
      request(`/api/negocio/empleados/${first.id}`, "PUT", cookieA, { activo: false }),
      { params: Promise.resolve({ id: first.id }) }
    )
    expect(deactivateResponse.status).toBe(200)
    const inactiveDuplicateResponse = await POST(request("/api/negocio/empleados", "POST", cookieA, { codigo: code, rol: "mozo" }))
    expect(inactiveDuplicateResponse.status).toBe(409)

    const historicalPedido = await db.pedido.create({
      data: {
        negocioId: businessA.id,
        negocioSlug: businessA.slug,
        negocioNombre: businessA.nombre,
        clienteNombre: "Historial T43",
        total: 100,
        totalProductos: 100,
        metodoEntrega: "mesa",
        estado: "entregado",
        empleadoId: first.id,
        empleadoNombre: "Empleado histórico ABC",
      },
    })

    const deleteResponse = await DELETE(
      request(`/api/negocio/empleados/${first.id}`, "DELETE", cookieA),
      { params: Promise.resolve({ id: first.id }) }
    )
    expect(deleteResponse.status).toBe(200)

    const historical = await db.empleado.findUnique({ where: { id: first.id } })
    expect(historical?.eliminado).toBe(true)
    expect(historical?.activo).toBe(false)
    expect(historical?.codigo).toBe(code)
    expect((await db.pedido.findUnique({ where: { id: historicalPedido.id }, select: { empleadoId: true, empleadoNombre: true } }))).toEqual({
      empleadoId: first.id,
      empleadoNombre: "Empleado histórico ABC",
    })

    const reusedResponse = await POST(request("/api/negocio/empleados", "POST", cookieA, { codigo: code, rol: "mozo" }))
    expect(reusedResponse.status).toBe(201)
    const reused = await reusedResponse.json() as { id: string }
    expect(reused.id).not.toBe(first.id)

    const byCodigoResponse = await GET_BY_CODIGO(new NextRequest(`http://localhost/api/empleados/by-codigo?codigo=${code}&negocioId=${businessA.id}`))
    expect(byCodigoResponse.status).toBe(200)
    expect((await byCodigoResponse.json()).id).toBe(reused.id)

    await DELETE(
      request(`/api/negocio/empleados/${reused.id}`, "DELETE", cookieA),
      { params: Promise.resolve({ id: reused.id }) }
    )
    const secondCycleResponse = await POST(request("/api/negocio/empleados", "POST", cookieA, { codigo: code, rol: "mozo" }))
    expect(secondCycleResponse.status).toBe(201)
    const secondCycle = await secondCycleResponse.json() as { id: string }
    await DELETE(
      request(`/api/negocio/empleados/${secondCycle.id}`, "DELETE", cookieA),
      { params: Promise.resolve({ id: secondCycle.id }) }
    )
    const thirdCycleResponse = await POST(request("/api/negocio/empleados", "POST", cookieA, { codigo: code, rol: "mozo" }))
    expect(thirdCycleResponse.status).toBe(201)

    const businessB = await createBusiness("test-p2-t43-r2-code-b")
    const cookieB = await businessCookie(businessB.id)
    const crossBusinessResponse = await POST(request("/api/negocio/empleados", "POST", cookieB, { codigo: code, rol: "mozo" }))
    expect(crossBusinessResponse.status).toBe(201)
  })
})
