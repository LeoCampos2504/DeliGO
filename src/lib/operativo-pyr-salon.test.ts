/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests permanentes: PyR personal sin Salón (Tarea 20, corrección 3)
// ============================================
// Integración real contra PostgreSQL TESTING, sin mocks de Prisma. La guardia
// inicial exige una URL de testing explícita antes de crear cualquier fixture.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  createOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
} from "@/lib/auth"
import { GET as getOperativoMe } from "@/app/api/operativo/me/route"
import { GET as getPedidosPyr } from "@/app/api/operativo/pyr/pedidos/route"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"

// OPERATIVO_PYR_SALON_TEST_ISOLATION_DEBT: integración real contra
// PostgreSQL TESTING remoto — el `beforeAll` de este archivo hace ~28
// escrituras secuenciales reales (5 Negocio + 11 CuentaOperativa + 11
// Empleado + 1 Pedido) más 11 creaciones de sesión en paralelo, cada
// round-trip real ~200-300ms — supera ampliamente el default de bun:test
// (5000ms, aplica también a hooks, no sólo a tests). Sin este valor, el
// `beforeAll` quedaba abortado a mitad de camino: bun lo marca como fallido
// y avanza a `afterAll` (que borra, correctamente scopeado, los Negocio ya
// creados hasta ese punto), mientras la promesa abandonada del `beforeAll`
// sigue corriendo en segundo plano y intenta crear más Empleado referenciando
// un Negocio que la limpieza ya borró — de ahí el P2003 en
// `empleados_negocioId_fkey`, un síntoma en cascada del timeout, no una FK
// faltante real. Mismo criterio ya aplicado en todos los demás archivos
// `*.integration.test.ts`/de integración real de este proyecto.
setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

type NegocioFixture = { id: string; slug: string }

async function crearNegocio(
  overrides: Partial<{ aprobado: boolean; suspendido: boolean; salonActivo: boolean; empleadosActivos: boolean }> = {}
): Promise<NegocioFixture> {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-20-pyr-sin-salon-${suffix}`,
      nombre: `Test T20 PyR ${suffix}`,
      usuario: `test20pyr_${suffix}`,
      email: `test20pyr-${suffix}@example.com`,
      password: "no-usado-en-estos-tests",
      aprobado: overrides.aprobado ?? true,
      suspendido: overrides.suspendido ?? false,
      salonActivo: overrides.salonActivo ?? false,
      empleadosActivos: overrides.empleadosActivos ?? true,
      horarioMode: "simple",
      abiertoManual: true,
    },
  })
  return { id: negocio.id, slug: negocio.slug }
}

async function crearCuentaOperativa() {
  const cuenta = await db.cuentaOperativa.create({
    data: {
      nombre: `Cuenta T20 PyR ${randomUUID()}`,
      email: `test20-pyr-${randomUUID()}@example.com`,
      activo: true,
      eliminado: false,
    },
  })
  return cuenta.id
}

async function crearEmpleado(
  negocioId: string,
  cuentaOperativaId: string,
  areaOperativa: "mozo" | "salon" | "pyr",
  activo = true
) {
  await db.empleado.create({
    data: {
      nombre: `Empleado T20 PyR ${randomUUID()}`,
      codigo: randomUUID().slice(0, 8),
      negocioId,
      cuentaOperativaId,
      areaOperativa,
      activo,
      eliminado: false,
    },
  })
}

function requestConSesion(url: string, token: string): NextRequest {
  return new NextRequest(url, {
    headers: { cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${token}` },
  })
}

const negocios: NegocioFixture[] = []
const cuentas: string[] = []
const cuentasConSesion: string[] = []

let negocioSinSalon: NegocioFixture
let negocioConSalon: NegocioFixture
let negocioEmpleadosInactivos: NegocioFixture
let negocioSuspendido: NegocioFixture
let negocioNoAprobado: NegocioFixture
let tokenPyrSinSalon: string
let tokenSalonSinSalon: string
let tokenMozoSinSalon: string
let tokenPyrConSalon: string
let tokenSalonConSalon: string
let tokenMozoConSalon: string
let tokenPyrAjeno: string
let tokenPyrEmpleadosInactivos: string
let tokenPyrSuspendido: string
let tokenPyrNoAprobado: string
let tokenPyrEmpleadoInactivo: string

beforeAll(async () => {
  negocioSinSalon = await crearNegocio({ salonActivo: false })
  negocioConSalon = await crearNegocio({ salonActivo: true })
  negocioEmpleadosInactivos = await crearNegocio({ empleadosActivos: false })
  negocioSuspendido = await crearNegocio({ suspendido: true })
  negocioNoAprobado = await crearNegocio({ aprobado: false })
  negocios.push(negocioSinSalon, negocioConSalon, negocioEmpleadosInactivos, negocioSuspendido, negocioNoAprobado)

  const cuentaPyrSinSalon = await crearCuentaOperativa()
  const cuentaSalonSinSalon = await crearCuentaOperativa()
  const cuentaMozoSinSalon = await crearCuentaOperativa()
  const cuentaPyrConSalon = await crearCuentaOperativa()
  const cuentaSalonConSalon = await crearCuentaOperativa()
  const cuentaMozoConSalon = await crearCuentaOperativa()
  const cuentaPyrAjeno = await crearCuentaOperativa()
  const cuentaPyrEmpleadosInactivos = await crearCuentaOperativa()
  const cuentaPyrSuspendido = await crearCuentaOperativa()
  const cuentaPyrNoAprobado = await crearCuentaOperativa()
  const cuentaPyrEmpleadoInactivo = await crearCuentaOperativa()
  cuentas.push(
    cuentaPyrSinSalon,
    cuentaSalonSinSalon,
    cuentaMozoSinSalon,
    cuentaPyrConSalon,
    cuentaSalonConSalon,
    cuentaMozoConSalon,
    cuentaPyrAjeno,
    cuentaPyrEmpleadosInactivos,
    cuentaPyrSuspendido,
    cuentaPyrNoAprobado,
    cuentaPyrEmpleadoInactivo
  )

  await crearEmpleado(negocioSinSalon.id, cuentaPyrSinSalon, "pyr")
  await crearEmpleado(negocioSinSalon.id, cuentaSalonSinSalon, "salon")
  await crearEmpleado(negocioSinSalon.id, cuentaMozoSinSalon, "mozo")
  await crearEmpleado(negocioConSalon.id, cuentaPyrConSalon, "pyr")
  await crearEmpleado(negocioConSalon.id, cuentaSalonConSalon, "salon")
  await crearEmpleado(negocioConSalon.id, cuentaMozoConSalon, "mozo")
  await crearEmpleado(negocioConSalon.id, cuentaPyrAjeno, "pyr")
  await crearEmpleado(negocioEmpleadosInactivos.id, cuentaPyrEmpleadosInactivos, "pyr")
  await crearEmpleado(negocioSuspendido.id, cuentaPyrSuspendido, "pyr")
  await crearEmpleado(negocioNoAprobado.id, cuentaPyrNoAprobado, "pyr")
  await crearEmpleado(negocioConSalon.id, cuentaPyrEmpleadoInactivo, "pyr", false)

  await db.pedido.create({
    data: {
      negocioId: negocioSinSalon.id,
      negocioSlug: negocioSinSalon.slug,
      negocioNombre: "Negocio PyR sin Salón",
      clienteNombre: "Cliente de prueba",
      metodoEntrega: "retiro",
      estado: "recibido",
      total: 100,
      totalProductos: 100,
      idempotencyKey: `test-20-pyr-${randomUUID()}`,
    },
  })

  const cuentasParaSesion = [
    cuentaPyrSinSalon,
    cuentaSalonSinSalon,
    cuentaMozoSinSalon,
    cuentaPyrConSalon,
    cuentaSalonConSalon,
    cuentaMozoConSalon,
    cuentaPyrAjeno,
    cuentaPyrEmpleadosInactivos,
    cuentaPyrSuspendido,
    cuentaPyrNoAprobado,
    cuentaPyrEmpleadoInactivo,
  ]
  cuentasConSesion.push(...cuentasParaSesion)
  ;[
    tokenPyrSinSalon,
    tokenSalonSinSalon,
    tokenMozoSinSalon,
    tokenPyrConSalon,
    tokenSalonConSalon,
    tokenMozoConSalon,
    tokenPyrAjeno,
    tokenPyrEmpleadosInactivos,
    tokenPyrSuspendido,
    tokenPyrNoAprobado,
    tokenPyrEmpleadoInactivo,
  ] = await Promise.all(cuentasParaSesion.map((cuentaId) => createOperationalSession(cuentaId)))
})

afterAll(async () => {
  await db.sesion.deleteMany({ where: { userId: { in: cuentasConSesion } } })
  await db.pedido.deleteMany({ where: { negocioId: { in: negocios.map((negocio) => negocio.id) } } })
  await db.empleado.deleteMany({ where: { negocioId: { in: negocios.map((negocio) => negocio.id) } } })
  await db.negocio.deleteMany({ where: { id: { in: negocios.map((negocio) => negocio.id) } } })
  await db.cuentaOperativa.deleteMany({ where: { id: { in: cuentas } } })
})

describe("Tarea 20 — PyR personal independiente de Salón", () => {
  test("/api/operativo/me muestra PyR con y sin Salón", async () => {
    for (const [token, negocio] of [
      [tokenPyrSinSalon, negocioSinSalon],
      [tokenPyrConSalon, negocioConSalon],
    ] as const) {
      const response = await getOperativoMe(requestConSesion("http://localhost/api/operativo/me", token))
      const body = (await response.json()) as {
        estado: string
        vinculos: Array<{ negocio: { id: string }; empleado: { areaOperativaEfectiva: string } }>
      }

      expect(response.status).toBe(200)
      expect(body.estado).toBe("operativo")
      expect(body.vinculos).toMatchObject([
        {
          negocio: { id: negocio.id },
          empleado: { areaOperativaEfectiva: "pyr" },
        },
      ])
    }
  })

  test("/api/operativo/me muestra salón y mozo solo si salonActivo=true", async () => {
    for (const [token, area] of [
      [tokenSalonConSalon, "salon"],
      [tokenMozoConSalon, "mozo"],
    ] as const) {
      const response = await getOperativoMe(requestConSesion("http://localhost/api/operativo/me", token))
      const body = (await response.json()) as {
        estado: string
        vinculos: Array<{ empleado: { areaOperativaEfectiva: string } }>
      }
      expect(response.status).toBe(200)
      expect(body.estado).toBe("operativo")
      expect(body.vinculos).toMatchObject([{ empleado: { areaOperativaEfectiva: area } }])
    }

    for (const token of [tokenSalonSinSalon, tokenMozoSinSalon]) {
      const response = await getOperativoMe(requestConSesion("http://localhost/api/operativo/me", token))
      const body = (await response.json()) as { estado: string; vinculos: unknown[] }
      expect(response.status).toBe(200)
      expect(body.estado).toBe("sin_vinculo_operativo")
      expect(body.vinculos).toEqual([])
    }
  })

  test("/api/operativo/me conserva empleados, aprobación, suspensión y empleado activo para PyR", async () => {
    for (const token of [
      tokenPyrEmpleadosInactivos,
      tokenPyrSuspendido,
      tokenPyrNoAprobado,
      tokenPyrEmpleadoInactivo,
    ]) {
      const response = await getOperativoMe(requestConSesion("http://localhost/api/operativo/me", token))
      const body = (await response.json()) as { estado: string; vinculos: unknown[] }
      expect(response.status).toBe(200)
      expect(body.estado).toBe("sin_vinculo_operativo")
      expect(body.vinculos).toEqual([])
    }
  })

  test("el resolver habilita PyR con y sin Salón y conserva el bloqueo de salón y mozo", async () => {
    for (const [token, negocio] of [
      [tokenPyrSinSalon, negocioSinSalon],
      [tokenPyrConSalon, negocioConSalon],
    ] as const) {
      const pyr = await resolveOperativoAreaForSlug(
        requestConSesion("http://localhost/api/operativo/pyr/pedidos", token),
        negocio.slug,
        "pyr"
      )
      expect(pyr.ok).toBe(true)
    }

    for (const [token, area] of [
      [tokenSalonConSalon, "salon"],
      [tokenMozoConSalon, "mozo"],
    ] as const) {
      const resultado = await resolveOperativoAreaForSlug(
        requestConSesion("http://localhost/api/operativo/pedidos", token),
        negocioConSalon.slug,
        area
      )
      expect(resultado.ok).toBe(true)
    }

    for (const [token, area] of [
      [tokenSalonSinSalon, "salon"],
      [tokenMozoSinSalon, "mozo"],
    ] as const) {
      const resultado = await resolveOperativoAreaForSlug(
        requestConSesion("http://localhost/api/operativo/pedidos", token),
        negocioSinSalon.slug,
        area
      )
      expect(resultado).toMatchObject({ ok: false, status: 403, state: "acceso_no_disponible" })
    }
  })

  test("el resolver conserva área efectiva, aislamiento cross-negocio y empleados activos", async () => {
    for (const area of ["salon", "mozo"] as const) {
      const areaIncorrecta = await resolveOperativoAreaForSlug(
        requestConSesion("http://localhost/api/operativo/pedidos", tokenPyrConSalon),
        negocioConSalon.slug,
        area
      )
      expect(areaIncorrecta).toMatchObject({ ok: false, status: 403, state: "area_no_habilitada" })
    }

    for (const token of [tokenSalonConSalon, tokenMozoConSalon]) {
      const pyrNoAutorizado = await resolveOperativoAreaForSlug(
        requestConSesion("http://localhost/api/operativo/pyr/pedidos", token),
        negocioConSalon.slug,
        "pyr"
      )
      expect(pyrNoAutorizado).toMatchObject({ ok: false, status: 403, state: "area_no_habilitada" })
    }

    for (const [token, negocio] of [
      [tokenPyrSinSalon, negocioConSalon],
      [tokenPyrAjeno, negocioSinSalon],
    ] as const) {
      const negocioAjeno = await resolveOperativoAreaForSlug(
        requestConSesion("http://localhost/api/operativo/pyr/pedidos", token),
        negocio.slug,
        "pyr"
      )
      expect(negocioAjeno).toMatchObject({ ok: false, status: 403, state: "acceso_no_disponible" })
    }

    const empleadosDesactivados = await resolveOperativoAreaForSlug(
      requestConSesion("http://localhost/api/operativo/pyr/pedidos", tokenPyrEmpleadosInactivos),
      negocioEmpleadosInactivos.slug,
      "pyr"
    )
    expect(empleadosDesactivados).toMatchObject({ ok: false, status: 403, state: "acceso_no_disponible" })
  })

  test("GET /api/operativo/pyr/pedidos responde con datos reales aunque Salón esté inactivo", async () => {
    const response = await getPedidosPyr(
      requestConSesion(
        `http://localhost/api/operativo/pyr/pedidos?slug=${encodeURIComponent(negocioSinSalon.slug)}`,
        tokenPyrSinSalon
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      negocio: { slug: string }
      resumen: { totalActivos: number }
      pedidos: Array<{ metodoEntrega: string }>
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.negocio.slug).toBe(negocioSinSalon.slug)
    expect(body.resumen.totalActivos).toBe(1)
    expect(body.pedidos).toHaveLength(1)
    expect(body.pedidos[0]?.metodoEntrega).toBe("retiro")
  })
})
