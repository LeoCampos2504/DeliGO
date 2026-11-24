/// <reference types="bun-types" />
// ============================================
// BUG-001 — identidad visible de empleados vinculados (PostgreSQL efímero REAL, rutas reales)
// ============================================
// Una CuentaOperativa vinculada a DOS negocios (A: Empleado.nombre = marcador; B: nombre heredado distinto), un
// empleado REALMENTE pendiente en A y un tercer negocio C. Comprueba la regla única en permisos de catálogo,
// autoría, operativo/me, panel del mozo, mesas del dueño, pedidos nuevos y fotos históricas; el aislamiento entre
// negocios; y que nada se escribe (ids, vínculos, permisos, nombres guardados e historial intactos).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { conNombresHistoricosVisibles, mapaNombresVisibles, NOMBRE_EMPLEADO_PENDIENTE } from "@/lib/empleado-identidad"
import { autoriaProducto } from "@/lib/catalogo-empleado-service"
import { GET as getPermisosCatalogo } from "@/app/api/negocio/empleados/permisos-catalogo/route"
import { GET as getOperativoMe } from "@/app/api/operativo/me/route"
import { GET as getMesasDueno } from "@/app/api/negocio/mesas/route"
import { GET as getPanelMozo } from "@/app/api/operativo/mozo/panel/[slug]/route"
import { POST as postPedidoMozo } from "@/app/api/operativo/mozo/panel/[slug]/pedidos/route"

setDefaultTimeout(120_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const integracion = Boolean(testDatabaseUrl && process.env.DATABASE_URL === testDatabaseUrl && process.env.DELIGO_EPHEMERAL_TEST_DB === "1" && (process.env.DELIGO_ENVIRONMENT ?? "").toUpperCase() === "TESTING")
const ephemeralTest = integracion ? test : test.skip

afterAll(async () => {
  if (integracion) await db.$disconnect()
})

const NOMBRE_CUENTA = "Lucía Cuenta"

async function fixture() {
  const s = randomUUID().slice(0, 10)
  const neg = (k: string, extra: Record<string, unknown>) => db.negocio.create({ data: { slug: `bug001-${k}-${s}`, nombre: `BUG001 ${k} ${s}`, usuario: `bug001-${k}-${s}`, email: `bug001-${k}-${s}@example.test`, password: "fixture", aprobado: true, suspendido: false, empleadosActivos: true, ...extra } })
  // A: negocio genérico con Salón (como paola-vinal), abierto manualmente para recibir pedidos de mesa.
  const a = await neg("a", { rubro: "negocio", salonActivo: true, cajaTurnosModo: "OPCIONAL", horarioMode: "simple", abiertoManual: true })
  const b = await neg("b", { rubro: "negocio", salonActivo: false, cajaTurnosModo: "OPCIONAL" })
  const c = await neg("c", { rubro: "negocio", salonActivo: false })
  const cuenta = await db.cuentaOperativa.create({ data: { nombre: NOMBRE_CUENTA, email: `bug001-x-${s}@example.test`, activo: true, eliminado: false } })
  const otraCuenta = await db.cuentaOperativa.create({ data: { nombre: "Persona De C", email: `bug001-y-${s}@example.test`, activo: true, eliminado: false } })
  const hasta = new Date(Date.now() + 2 * 24 * 3600_000)
  const empA = await db.empleado.create({ data: { nombre: NOMBRE_EMPLEADO_PENDIENTE, codigo: `A${s.slice(0, 6)}`.toUpperCase(), rol: "mozo", areaOperativa: "mozo", negocioId: a.id, cuentaOperativaId: cuenta.id, catalogoHasta: hasta, catalogoCrear: true } })
  const empB = await db.empleado.create({ data: { nombre: "Lucia Heredada", codigo: `B${s.slice(0, 6)}`.toUpperCase(), rol: "cajero", areaOperativa: "caja", negocioId: b.id, cuentaOperativaId: cuenta.id, catalogoHasta: hasta, catalogoProveedores: true } })
  const pendiente = await db.empleado.create({ data: { nombre: NOMBRE_EMPLEADO_PENDIENTE, codigo: `P${s.slice(0, 6)}`.toUpperCase(), rol: "mozo", areaOperativa: "mozo", negocioId: a.id } })
  const empC = await db.empleado.create({ data: { nombre: "Empleado De C", codigo: `C${s.slice(0, 6)}`.toUpperCase(), rol: "cajero", areaOperativa: "caja", negocioId: c.id, cuentaOperativaId: otraCuenta.id } })
  const duenoA = `${SESSION_COOKIE_NAME}=${await createSession(a.id, "negocio")}`
  const duenoB = `${SESSION_COOKIE_NAME}=${await createSession(b.id, "negocio")}`
  const operativo = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
  return { a, b, c, cuenta, empA, empB, pendiente, empC, duenoA, duenoB, operativo }
}
const get = (url: string, cookie: string) => new NextRequest(`http://localhost${url}`, { headers: { cookie } })
type FilaPermiso = { id: string; nombre: string; crear: boolean; proveedores: boolean; hasta: string | null }

describe("BUG-001: identidad visible de empleados vinculados", () => {
  ephemeralTest("permisos de catálogo (casos 1, 2, 3, 4, 5, 7): nombre resuelto, mismo id, mismos permisos, aislamiento", async () => {
    const f = await fixture()
    const listaA = (await (await getPermisosCatalogo(get("/api/negocio/empleados/permisos-catalogo", f.duenoA))).json()).empleados as FilaPermiso[]
    const listaB = (await (await getPermisosCatalogo(get("/api/negocio/empleados/permisos-catalogo", f.duenoB))).json()).empleados as FilaPermiso[]
    const enA = listaA.find((e) => e.id === f.empA.id)!, pendA = listaA.find((e) => e.id === f.pendiente.id)!, enB = listaB.find((e) => e.id === f.empB.id)!
    // 1. marcador + vínculo → cuenta; 7. con su id y sus permisos de catálogo.
    expect(enA.nombre).toBe(NOMBRE_CUENTA)
    expect([enA.crear, enA.proveedores]).toEqual([true, false])
    // 2. nombre heredado distinto + vínculo → cuenta.
    expect(enB.nombre).toBe(NOMBRE_CUENTA)
    expect([enB.crear, enB.proveedores]).toEqual([false, true])
    // 3. realmente pendiente → sigue pendiente.
    expect(pendA.nombre).toBe(NOMBRE_EMPLEADO_PENDIENTE)
    // 4/5. la misma cuenta en dos negocios: dos filas distintas; cada dueño ve sólo la suya y nunca la de C.
    expect(f.empA.id).not.toBe(f.empB.id)
    expect(listaA.map((e) => e.id).sort()).toEqual([f.empA.id, f.pendiente.id].sort())
    expect(listaB.map((e) => e.id)).toEqual([f.empB.id])
    expect(JSON.stringify(listaA) + JSON.stringify(listaB)).not.toContain("Empleado De C")
    // Mapa por ids: sólo resuelve filas del negocio pedido.
    const mapa = await mapaNombresVisibles(db, f.a.id, [f.empA.id, f.empB.id, f.empC.id, f.pendiente.id])
    expect(Object.fromEntries(mapa)).toEqual({ [f.empA.id]: NOMBRE_CUENTA, [f.pendiente.id]: NOMBRE_EMPLEADO_PENDIENTE })
  })

  ephemeralTest("autoría de catálogo (presentación de auditoría) y operativo/me por negocio", async () => {
    const f = await fixture()
    const prod = await db.producto.create({ data: { nombre: "BUG001 Producto", precio: 100, negocioId: f.a.id } })
    await db.auditLog.create({ data: { userId: f.empA.id, userType: "empleado", accion: "producto.creado", recurso: "producto", recursoId: prod.id } })
    // Un evento con un empleado de OTRO negocio sobre este producto nunca muestra su nombre.
    await db.auditLog.create({ data: { userId: f.empB.id, userType: "empleado", accion: "producto.modificado", recurso: "producto", recursoId: prod.id } })
    const autoria = await autoriaProducto(db, f.a.id, prod.id)
    expect(autoria?.creado.por).toBe(NOMBRE_CUENTA)
    expect(autoria?.ultimaModificacion?.por).toBe("Empleado")
    const me = await (await getOperativoMe(get("/api/operativo/me", f.operativo))).json()
    const vinculos = JSON.stringify(me)
    expect(vinculos).not.toContain(NOMBRE_EMPLEADO_PENDIENTE)
    expect(vinculos).not.toContain("Lucia Heredada")
    expect(vinculos).toContain(f.empA.id)
  })

  ephemeralTest("Salón: mesas del dueño, panel del mozo y pedido nuevo guardan la identidad resuelta", async () => {
    const f = await fixture()
    const mesa = await db.mesa.create({ data: { negocioId: f.a.id, numero: 1, nombre: "Mesa 1", empleadoId: f.empA.id } })
    const mesas = await (await getMesasDueno(get("/api/negocio/mesas", f.duenoA))).json()
    expect(mesas.find((m: { id: string }) => m.id === mesa.id).empleado).toEqual({ id: f.empA.id, nombre: NOMBRE_CUENTA, codigo: f.empA.codigo })
    const ctx = { params: Promise.resolve({ slug: f.a.slug }) }
    const panel = await (await getPanelMozo(get(`/api/operativo/mozo/panel/${f.a.slug}`, f.operativo), ctx)).json()
    expect(JSON.stringify(panel)).toContain(NOMBRE_CUENTA)
    expect(JSON.stringify(panel)).not.toContain(NOMBRE_EMPLEADO_PENDIENTE)
    const producto = await db.producto.create({ data: { nombre: "BUG001 Café", precio: 1500, negocioId: f.a.id } })
    const r = await postPedidoMozo(new NextRequest(`http://localhost/api/operativo/mozo/panel/${f.a.slug}/pedidos`, { method: "POST", headers: { cookie: f.operativo, "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: randomUUID(), mesaId: mesa.id, items: [{ productoId: producto.id, cantidad: 1 }] }) }), ctx)
    const cuerpo = await r.json()
    expect([r.status, cuerpo.error ?? null]).toEqual([201, null])
    const guardado = await db.pedido.findFirstOrThrow({ where: { negocioId: f.a.id, mesaId: mesa.id }, select: { empleadoId: true, empleadoNombre: true } })
    expect(guardado).toEqual({ empleadoId: f.empA.id, empleadoNombre: NOMBRE_CUENTA })
  })

  ephemeralTest("fotos históricas: sólo el marcador con relación inequívoca se muestra resuelto; el dato no cambia", async () => {
    const f = await fixture()
    const filas = [
      { id: "p1", empleadoId: f.empA.id, empleadoNombre: NOMBRE_EMPLEADO_PENDIENTE },
      { id: "p2", empleadoId: f.empA.id, empleadoNombre: "Mozo Viejo" },
      { id: "p3", empleadoId: f.pendiente.id, empleadoNombre: NOMBRE_EMPLEADO_PENDIENTE },
      { id: "p4", empleadoId: f.empC.id, empleadoNombre: NOMBRE_EMPLEADO_PENDIENTE },
      { id: "p5", empleadoId: null, empleadoNombre: NOMBRE_EMPLEADO_PENDIENTE },
    ]
    const vis = await conNombresHistoricosVisibles(db, f.a.id, filas)
    expect(vis.map((v) => [v.id, v.empleadoNombre, v.empleadoNombreRegistrado, v.empleadoNombreResuelto])).toEqual([
      ["p1", NOMBRE_CUENTA, NOMBRE_EMPLEADO_PENDIENTE, true],
      ["p2", "Mozo Viejo", "Mozo Viejo", false],
      ["p3", NOMBRE_EMPLEADO_PENDIENTE, NOMBRE_EMPLEADO_PENDIENTE, false],
      ["p4", NOMBRE_EMPLEADO_PENDIENTE, NOMBRE_EMPLEADO_PENDIENTE, false],
      ["p5", NOMBRE_EMPLEADO_PENDIENTE, NOMBRE_EMPLEADO_PENDIENTE, false],
    ])
    expect(filas[0].empleadoNombre).toBe(NOMBRE_EMPLEADO_PENDIENTE)
  })

  ephemeralTest("6. conservación: lecturas no escriben; ids, vínculos, permisos, nombres guardados y auditoría intactos", async () => {
    const f = await fixture()
    const foto = async () => ({
      empleados: await db.empleado.findMany({ where: { id: { in: [f.empA.id, f.empB.id, f.pendiente.id, f.empC.id] } }, orderBy: { id: "asc" }, select: { id: true, nombre: true, negocioId: true, cuentaOperativaId: true, catalogoHasta: true, catalogoCrear: true, catalogoProveedores: true, activo: true, eliminado: true } }),
      cuentas: await db.cuentaOperativa.findMany({ where: { id: { in: [f.cuenta.id] } }, select: { id: true, nombre: true, activo: true, eliminado: true } }),
      auditoria: await db.auditLog.count({ where: { OR: [{ recursoId: { in: [f.empA.id, f.empB.id, f.pendiente.id] } }, { userId: { in: [f.empA.id, f.empB.id] } }] } }),
    })
    const antes = await foto()
    await getPermisosCatalogo(get("/api/negocio/empleados/permisos-catalogo", f.duenoA))
    await getPermisosCatalogo(get("/api/negocio/empleados/permisos-catalogo", f.duenoB))
    await getOperativoMe(get("/api/operativo/me", f.operativo))
    await getMesasDueno(get("/api/negocio/mesas", f.duenoA))
    await mapaNombresVisibles(db, f.a.id, [f.empA.id, f.pendiente.id])
    expect(await foto()).toEqual(antes)
    expect(antes.empleados.find((e) => e.id === f.empA.id)?.nombre).toBe(NOMBRE_EMPLEADO_PENDIENTE)
    expect(antes.empleados.find((e) => e.id === f.empB.id)?.nombre).toBe("Lucia Heredada")
  })
})
