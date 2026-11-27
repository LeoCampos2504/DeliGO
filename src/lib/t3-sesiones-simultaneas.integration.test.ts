/// <reference types="bun-types" />
// ============================================
// T3 — sesiones simultáneas de dueño y empleado en el MISMO navegador (PostgreSQL efímero REAL)
// ============================================
// Reproduce lo que cada handler recibe cuando conviven la cookie de familia del dueño
// (`deligo_session_negocio`) y la de la cuenta operativa (`deligo_operativo_session`): el proxy no copia ninguna a la
// cookie legacy `deligo_session`, así que sólo llegan las cookies de familia (mismo enfoque que BUG-002).
// Comprueba, por superficie de P1-09, que cada operación usa EXCLUSIVAMENTE la identidad de su contexto, sin
// fallback entre familias, con aislamiento entre negocios y SIN efectos cuando se rechaza:
//   cierre comercial de mesa · cancelación de pedido de mesa · notificaciones · destacado · denuncias · mozos/stats.

import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, getFamilySessionCookieName, hashSessionToken, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { getTerminalSessionExpiry, sha256Hex, TERMINAL_SESSION_COOKIE_NAME } from "@/lib/operaciones-terminal-auth"

setDefaultTimeout(180_000)
if (!process.env.DELIGO_TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.DELIGO_TEST_DATABASE_URL || process.env.DELIGO_ENVIRONMENT !== "TESTING" || process.env.DELIGO_EPHEMERAL_TEST_DB !== "1") throw new Error("T3 requiere PostgreSQL efímero declarado")

const { GET: getCuenta, POST: postCuenta } = await import("@/app/api/operaciones/ocupaciones/[id]/cuenta/route")
const { POST: postCancelar } = await import("@/app/api/operaciones/pedidos/[id]/cancelar/route")
const { GET: getNotificaciones, PATCH: patchNotificaciones } = await import("@/app/api/notificaciones/route")
const { GET: getDestacado, POST: postDestacado } = await import("@/app/api/destacado-solicitud/route")
const { GET: getDenuncias, POST: postDenuncia } = await import("@/app/api/denuncias/route")
const { GET: getMozoStats } = await import("@/app/api/mozos/stats/route")

const FAMILIA_DUENO = getFamilySessionCookieName("negocio")
const FAMILIA_CLIENTE = getFamilySessionCookieName("cliente")

async function vencerSesion(token: string) {
  await db.sesion.update({ where: { token: hashSessionToken(token) }, data: { expiresAt: new Date(Date.now() - 60_000) } })
}

async function fixture() {
  const s = randomUUID().slice(0, 10)
  const neg = (k: string) => db.negocio.create({ data: { slug: `t3-${k}-${s}`, nombre: `T3 ${k} ${s}`, usuario: `t3-${k}-${s}`, email: `t3-${k}-${s}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true } })
  const a = await neg("a")
  const b = await neg("b")
  const cuenta = (k: string, activo = true) => db.cuentaOperativa.create({ data: { nombre: `T3 ${k}`, email: `t3-${k}-${s}@example.test`, activo, eliminado: false } })
  const emp = (negocioId: string, cuentaId: string, area: string, k: string, activo = true) =>
    db.empleado.create({ data: { nombre: `Empleado ${k}`, codigo: `${k}${s.slice(0, 6)}`.toUpperCase(), rol: area === "mozo" ? "mozo" : "cajero", areaOperativa: area, negocioId, cuentaOperativaId: cuentaId, activo, eliminado: false } })
  const [cSalon, cCaja, cPyr, cMozo, cOtro, cInactivo] = await Promise.all([cuenta("salon"), cuenta("caja"), cuenta("pyr"), cuenta("mozo"), cuenta("otro"), cuenta("inactivo")])
  const salon = await emp(a.id, cSalon.id, "salon", "S")
  await emp(a.id, cCaja.id, "caja", "K")
  await emp(a.id, cPyr.id, "pyr", "P")
  const mozo = await emp(a.id, cMozo.id, "mozo", "M")
  await emp(b.id, cOtro.id, "salon", "O")
  await emp(a.id, cInactivo.id, "salon", "I", false)
  const terminal = await db.terminalOperativa.create({ data: { negocioId: a.id, nombre: `t3-terminal-${s}`, estado: "activo", perfil: "salon_completo", areas: JSON.stringify(["salon"]), scopes: JSON.stringify(["salon.ver"]) } })
  const tokenTerminal = `t-${randomUUID()}`
  await db.sesionTerminalOperativa.create({ data: { terminalSalonId: terminal.id, tokenHash: sha256Hex(tokenTerminal), expiresAt: getTerminalSessionExpiry() } })
  const tokenDuenoA = await createSession(a.id, "negocio")
  return {
    s, a, b, salon, mozo,
    tokenDuenoA,
    duenoA: `${FAMILIA_DUENO}=${tokenDuenoA}`,
    duenoALegacy: `${SESSION_COOKIE_NAME}=${await createSession(a.id, "negocio")}`,
    duenoB: `${FAMILIA_DUENO}=${await createSession(b.id, "negocio")}`,
    opSalon: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cSalon.id)}`,
    opCaja: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cCaja.id)}`,
    opPyr: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cPyr.id)}`,
    opMozo: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cMozo.id)}`,
    opOtro: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cOtro.id)}`,
    opInactivo: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cInactivo.id)}`,
    terminal: `${TERMINAL_SESSION_COOKIE_NAME}=${tokenTerminal}`,
  }
}

let mesaSeq = 0
async function mesaConOcupacion(negocioId: string, empleadoId: string | null = null) {
  mesaSeq += 1
  const mesa = await db.mesa.create({ data: { negocioId, numero: 500 + mesaSeq, nombre: `Mesa ${500 + mesaSeq}`, empleadoId } })
  const ocupacion = await db.sesionOcupacionMesa.create({ data: { negocioId, mesaId: mesa.id, estado: "activa" } })
  return { mesa, ocupacion }
}

async function pedidoMesa(negocioId: string, mesaId: string, ocupacionMesaId: string, estado = "recibido") {
  return db.pedido.create({
    data: { negocioId, negocioSlug: "t3", negocioNombre: "T3", clienteNombre: "Cliente T3", total: 1000, totalProductos: 1000, metodoEntrega: "mesa", mesaId, mesaNumero: 1, ocupacionMesaId, estado, idempotencyKey: `t3-${randomUUID()}` },
  })
}

const conCookies = (cookies: string[]): Record<string, string> => (cookies.length ? { cookie: cookies.join("; ") } : {})

async function cuenta(ocupacionId: string, cookies: string[], familia: string | null, method: "GET" | "POST" = "GET") {
  const url = `http://localhost/api/operaciones/ocupaciones/${ocupacionId}/cuenta${familia ? `?actorFamily=${familia}` : ""}`
  const ctx = { params: Promise.resolve({ id: ocupacionId }) }
  return method === "GET"
    ? getCuenta(new NextRequest(url, { headers: conCookies(cookies) }), ctx)
    : postCuenta(new NextRequest(url, { method: "POST", headers: { ...conCookies(cookies), "content-type": "application/json" }, body: "{}" }), ctx)
}

async function cancelar(pedidoId: string, cookies: string[], familia: string | null) {
  const url = `http://localhost/api/operaciones/pedidos/${pedidoId}/cancelar${familia ? `?actorFamily=${familia}` : ""}`
  return postCancelar(new NextRequest(url, { method: "POST", headers: { ...conCookies(cookies), "content-type": "application/json" }, body: JSON.stringify({ motivo: "Pedido cargado por error T3" }) }), { params: Promise.resolve({ id: pedidoId }) })
}

const estadoOcupacion = (id: string) => db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id }, select: { estado: true, cerradaPorTipo: true, cerradaPorId: true, pagoConfirmadoEn: true, metodoPago: true } })
const estadoPedido = (id: string) => db.pedido.findUniqueOrThrow({ where: { id }, select: { estado: true, canceladoPor: true } })

describe("T3-01 · cierre comercial de mesa (/api/operaciones/ocupaciones/[id]/cuenta)", () => {
  test("dueño y empleado de Salón en el mismo navegador: cada pantalla cierra con SU identidad", async () => {
    const f = await fixture()
    const ambas = [f.duenoA, f.opSalon]

    // Pantalla del dueño: antes el orden fijo resolvía al empleado de Salón (cerradaPorTipo "salon").
    const m1 = await mesaConOcupacion(f.a.id)
    expect((await cuenta(m1.ocupacion.id, ambas, "negocio")).status).toBe(200)
    expect((await cuenta(m1.ocupacion.id, ambas, "negocio", "POST")).status).toBe(200)
    expect(await estadoOcupacion(m1.ocupacion.id)).toMatchObject({ estado: "cerrada", cerradaPorTipo: "negocio", cerradaPorId: f.a.id })

    // Pantalla del empleado con la sesión del dueño presente: identidad del empleado.
    const m2 = await mesaConOcupacion(f.a.id)
    expect((await cuenta(m2.ocupacion.id, ambas, "cuenta_operativa", "POST")).status).toBe(200)
    expect(await estadoOcupacion(m2.ocupacion.id)).toMatchObject({ estado: "cerrada", cerradaPorTipo: "salon", cerradaPorId: f.salon.id })
  })

  test("dueño + cajero: el dueño ya no recibe 401; el cajero (sin permiso de Salón) nunca cierra aunque el dueño esté conectado", async () => {
    const f = await fixture()
    const ambas = [f.duenoA, f.opCaja]
    const m = await mesaConOcupacion(f.a.id)
    const antes = await estadoOcupacion(m.ocupacion.id)

    const empleado = await cuenta(m.ocupacion.id, ambas, "cuenta_operativa", "POST")
    expect(empleado.status).toBe(403)
    expect((await empleado.json()).code).toBe("MESA_CUENTA_FORBIDDEN")
    expect((await cuenta(m.ocupacion.id, ambas, "cuenta_operativa")).status).toBe(403)
    expect(await estadoOcupacion(m.ocupacion.id)).toEqual(antes)

    expect((await cuenta(m.ocupacion.id, ambas, "negocio")).status).toBe(200)
  })

  test("sin selector o selector inválido → 400; familia sin credencial → 401; sin fallback ni efectos", async () => {
    const f = await fixture()
    const m = await mesaConOcupacion(f.a.id)
    const antes = await estadoOcupacion(m.ocupacion.id)

    for (const familia of [null, "superadmin", "cliente"]) {
      const r = await cuenta(m.ocupacion.id, [f.duenoA, f.opSalon], familia, "POST")
      expect(r.status).toBe(400)
      expect((await r.json()).code).toBe("MESA_CUENTA_ACTOR_FAMILY_REQUIRED")
    }
    // La familia pedida no tiene credencial aunque otra sí: nunca se usa la otra.
    expect((await cuenta(m.ocupacion.id, [f.opSalon], "negocio", "POST")).status).toBe(401)
    expect((await cuenta(m.ocupacion.id, [f.duenoA], "cuenta_operativa", "POST")).status).toBe(401)
    expect((await cuenta(m.ocupacion.id, [f.duenoA], "terminal", "POST")).status).toBe(401)
    expect((await cuenta(m.ocupacion.id, [], "negocio")).status).toBe(401)
    // Credencial del dueño vencida con un empleado de Salón válido al lado: 401, nunca el empleado.
    await vencerSesion(f.tokenDuenoA)
    expect((await cuenta(m.ocupacion.id, [f.duenoA, f.opSalon], "negocio", "POST")).status).toBe(401)
    expect(await estadoOcupacion(m.ocupacion.id)).toEqual(antes)
  })

  test("aislamiento, actor inactivo, mozo y terminal", async () => {
    const f = await fixture()
    const m = await mesaConOcupacion(f.a.id)
    const asignada = await mesaConOcupacion(f.a.id, f.mozo.id)
    const antes = await estadoOcupacion(m.ocupacion.id)

    // Otro negocio (dueño u operativo): 404 sin revelar la ocupación; ocupación inexistente: mismo 404.
    expect((await cuenta(m.ocupacion.id, [f.duenoB], "negocio", "POST")).status).toBe(404)
    expect((await cuenta(m.ocupacion.id, [f.opOtro], "cuenta_operativa", "POST")).status).toBe(404)
    expect((await cuenta(`inexistente-${randomUUID()}`, [f.duenoA], "negocio")).status).toBe(404)
    // Empleado inactivo del negocio: nunca resuelve.
    expect((await cuenta(m.ocupacion.id, [f.opInactivo], "cuenta_operativa", "POST")).status).toBe(404)
    // Mozo: sólo su mesa asignada; con el dueño presente no se eleva.
    expect((await cuenta(m.ocupacion.id, [f.duenoA, f.opMozo], "cuenta_operativa", "POST")).status).toBe(403)
    expect((await cuenta(asignada.ocupacion.id, [f.duenoA, f.opMozo], "cuenta_operativa")).status).toBe(200)
    // Terminal de Salón: ve la cuenta, nunca la cierra (P2-T41).
    expect((await cuenta(m.ocupacion.id, [f.terminal, f.duenoA], "terminal")).status).toBe(200)
    expect((await cuenta(m.ocupacion.id, [f.terminal, f.duenoA], "terminal", "POST")).status).toBe(403)
    expect(await estadoOcupacion(m.ocupacion.id)).toEqual(antes)
  })

  test("una cookie legacy del dueño nunca eleva la pantalla del empleado sin permiso", async () => {
    const f = await fixture()
    const m = await mesaConOcupacion(f.a.id)
    const antes = await estadoOcupacion(m.ocupacion.id)
    expect((await cuenta(m.ocupacion.id, [f.duenoALegacy, f.opPyr], "cuenta_operativa", "POST")).status).toBe(403)
    expect(await estadoOcupacion(m.ocupacion.id)).toEqual(antes)
    // La misma cookie legacy sigue sirviendo a la pantalla del dueño (compatibilidad dentro de la misma familia).
    expect((await cuenta(m.ocupacion.id, [f.duenoALegacy], "negocio")).status).toBe(200)
  })
})

describe("T3-01 · cancelación de pedido de mesa (/api/operaciones/pedidos/[id]/cancelar)", () => {
  test("dueño + empleado de Salón: la cancelación y su auditoría quedan con la identidad de la pantalla", async () => {
    const f = await fixture()
    const ambas = [f.duenoA, f.opSalon]
    const m = await mesaConOcupacion(f.a.id)

    const p1 = await pedidoMesa(f.a.id, m.mesa.id, m.ocupacion.id)
    expect((await cancelar(p1.id, ambas, "negocio")).status).toBe(200)
    expect(await estadoPedido(p1.id)).toEqual({ estado: "cancelado", canceladoPor: "negocio_admin" })
    expect(await db.pedidoEvento.findMany({ where: { pedidoId: p1.id }, select: { userType: true, userId: true } })).toEqual([{ userType: "negocio_admin", userId: f.a.id }])

    const p2 = await pedidoMesa(f.a.id, m.mesa.id, m.ocupacion.id)
    expect((await cancelar(p2.id, ambas, "cuenta_operativa")).status).toBe(200)
    expect(await estadoPedido(p2.id)).toEqual({ estado: "cancelado", canceladoPor: "salon_personal" })
    expect(await db.pedidoEvento.findMany({ where: { pedidoId: p2.id }, select: { userType: true, userId: true } })).toEqual([{ userType: "salon_personal", userId: f.salon.id }])
  })

  test("empleado sin permiso (PyR / caja) con el dueño conectado: 403 y el pedido no cambia", async () => {
    const f = await fixture()
    const m = await mesaConOcupacion(f.a.id)
    const p = await pedidoMesa(f.a.id, m.mesa.id, m.ocupacion.id)
    for (const op of [f.opPyr, f.opCaja]) {
      expect((await cancelar(p.id, [f.duenoA, op], "cuenta_operativa")).status).toBe(403)
      expect((await cancelar(p.id, [f.duenoALegacy, op], "cuenta_operativa")).status).toBe(403)
    }
    expect(await estadoPedido(p.id)).toEqual({ estado: "recibido", canceladoPor: null })
    expect(await db.pedidoEvento.count({ where: { pedidoId: p.id } })).toBe(0)
  })

  test("selector obligatorio, sin fallback, aislamiento y terminal", async () => {
    const f = await fixture()
    const m = await mesaConOcupacion(f.a.id)
    const p = await pedidoMesa(f.a.id, m.mesa.id, m.ocupacion.id)

    for (const familia of [null, "cliente", "superadmin"]) {
      const r = await cancelar(p.id, [f.duenoA, f.opSalon], familia)
      expect(r.status).toBe(400)
      expect((await r.json()).code).toBe("ACTOR_FAMILY_REQUIRED")
    }
    expect((await cancelar(p.id, [f.opSalon], "negocio")).status).toBe(401)
    expect((await cancelar(p.id, [f.duenoA], "cuenta_operativa")).status).toBe(401)
    expect((await cancelar(p.id, [], "negocio")).status).toBe(401)
    // Otro negocio: 404 indistinguible de inexistente.
    const ajeno = await cancelar(p.id, [f.duenoB], "negocio")
    const inexistente = await cancelar(`inexistente-${randomUUID()}`, [f.duenoA], "negocio")
    expect(ajeno.status).toBe(404)
    expect(inexistente.status).toBe(404)
    expect((await ajeno.json()).error).toBe((await inexistente.json()).error)
    expect((await cancelar(p.id, [f.opOtro], "cuenta_operativa")).status).toBe(404)
    // Terminal nunca cancela (P2-T41), aunque el dueño esté en el navegador.
    expect((await cancelar(p.id, [f.terminal, f.duenoA], "terminal")).status).toBe(403)
    // Dueño vencido con Salón válido al lado: 401, nunca el empleado.
    await vencerSesion(f.tokenDuenoA)
    expect((await cancelar(p.id, [f.duenoA, f.opSalon], "negocio")).status).toBe(401)

    expect(await estadoPedido(p.id)).toEqual({ estado: "recibido", canceladoPor: null })
    expect(await db.pedidoEvento.count({ where: { pedidoId: p.id } })).toBe(0)
  })
})

describe("T3-01/T3-02 · notificaciones (/api/notificaciones)", () => {
  test("campana del dueño con un empleado en el navegador: 200 con SUS avisos (antes 401 cada 10 s)", async () => {
    const f = await fixture()
    await db.notificacion.create({ data: { userId: f.a.id, userType: "negocio", tipo: "general", titulo: "Aviso dueño A", cuerpo: "a" } })
    await db.notificacion.create({ data: { userId: f.b.id, userType: "negocio", tipo: "general", titulo: "Aviso dueño B", cuerpo: "b" } })
    await db.notificacion.create({ data: { userId: f.salon.id, userType: "empleado", tipo: "general", titulo: "Aviso Salón", cuerpo: "s" } })
    const get = async (cookies: string[], query: string) => getNotificaciones(new NextRequest(`http://localhost/api/notificaciones?${query}`, { headers: conCookies(cookies) }))
    const titulos = async (r: Response) => ((await r.json()).notificaciones as Array<{ titulo: string }>).map((n) => n.titulo)
    const ambas = [f.duenoA, f.opSalon]

    const dueno = await get(ambas, "feed=cuenta&actorFamily=negocio&limit=50")
    expect(dueno.status).toBe(200)
    expect(await titulos(dueno)).toEqual(["Aviso dueño A"])
    const empleado = await get(ambas, "feed=operativo&limit=50")
    expect(await titulos(empleado)).toEqual(["Aviso Salón"])
    // Antes (sólo la cookie legacy, vacía con dos credenciales): 401 — se conserva para pestañas viejas sin selector.
    expect((await get(ambas, "feed=cuenta&limit=1&unread=true")).status).toBe(401)

    // Familia declarada sin su credencial (u otra familia presente): 401, nunca otro feed.
    expect((await get([f.opSalon], "feed=cuenta&actorFamily=negocio")).status).toBe(401)
    const cliente = await db.cliente.create({ data: { nombre: "Cliente T3", email: `t3-cli-${f.s}@example.test`, telefono: "" } })
    const clienteCookie = `${FAMILIA_CLIENTE}=${await createSession(cliente.id, "cliente")}`
    expect((await get([clienteCookie], "feed=cuenta&actorFamily=negocio")).status).toBe(401)
    expect((await get([clienteCookie, f.duenoA], "feed=cuenta&actorFamily=cliente")).status).toBe(200)
    expect(await titulos(await get([clienteCookie, f.duenoA], "feed=cuenta&actorFamily=negocio&limit=50"))).toEqual(["Aviso dueño A"])
    expect((await get(ambas, "feed=cuenta&actorFamily=superadmin")).status).toBe(400)
    // Otro negocio no ve los avisos de A.
    expect(await titulos(await get([f.duenoB, f.opSalon], "feed=cuenta&actorFamily=negocio&limit=50"))).toEqual(["Aviso dueño B"])

    // Marcar como leído queda dentro del feed y del actor declarados.
    const avisoA = await db.notificacion.findFirstOrThrow({ where: { userId: f.a.id, titulo: "Aviso dueño A" } })
    const patch = async (cookies: string[], query: string) => patchNotificaciones(new NextRequest(`http://localhost/api/notificaciones?${query}`, { method: "PATCH", headers: { ...conCookies(cookies), "content-type": "application/json" }, body: JSON.stringify({ action: "mark_read", notificationId: avisoA.id }) }))
    expect((await patch([f.duenoB, f.opSalon], "feed=cuenta&actorFamily=negocio")).status).toBe(404)
    expect((await patch(ambas, "feed=operativo")).status).toBe(404)
    expect((await db.notificacion.findUniqueOrThrow({ where: { id: avisoA.id } })).leido).toBe(false)
    expect((await patch(ambas, "feed=cuenta&actorFamily=negocio")).status).toBe(200)
    expect((await db.notificacion.findUniqueOrThrow({ where: { id: avisoA.id } })).leido).toBe(true)

    // Credencial del dueño vencida: 401 aunque haya una cookie legacy válida del mismo dueño (sin fallback).
    await vencerSesion(f.tokenDuenoA)
    expect((await get([f.duenoA, f.duenoALegacy], "feed=cuenta&actorFamily=negocio")).status).toBe(401)
  })
})

describe("T3-01/T3-02 · rutas exclusivas del dueño con sesiones simultáneas", () => {
  test("destacado: el dueño se reconoce con un empleado en el navegador; sin dueño se rechaza sin efectos", async () => {
    const f = await fixture()
    const get = async (cookies: string[]) => getDestacado(new NextRequest("http://localhost/api/destacado-solicitud", { headers: conCookies(cookies) }))
    const post = async (cookies: string[]) => postDestacado(new NextRequest("http://localhost/api/destacado-solicitud", { method: "POST", headers: { ...conCookies(cookies), "content-type": "application/json" }, body: JSON.stringify({ meses: 0, dias: 1 }) }))

    expect((await get([f.duenoA, f.opCaja])).status).toBe(200)
    expect((await get([f.opCaja])).status).toBe(401)
    expect((await post([f.opSalon])).status).toBe(401)
    expect(await db.destacadoSolicitud.count({ where: { negocioId: f.a.id } })).toBe(0)
    const creada = await post([f.duenoA, f.opSalon])
    expect(creada.status).toBe(201)
    expect((await creada.json()).solicitud.negocioId).toBe(f.a.id)
    expect(await db.destacadoSolicitud.count({ where: { negocioId: f.b.id } })).toBe(0)
    const listaB = await get([f.duenoB, f.opSalon])
    expect((await listaB.json()).solicitudes).toEqual([])
    // Contrato previo conservado: credencial legacy de otro tipo → 403; credencial del dueño vencida → 401.
    const cliente = await db.cliente.create({ data: { nombre: "Cliente T3 D", email: `t3-d-${f.s}@example.test`, telefono: "" } })
    expect((await get([`${SESSION_COOKIE_NAME}=${await createSession(cliente.id, "cliente")}`])).status).toBe(403)
    await vencerSesion(f.tokenDuenoA)
    expect((await get([f.duenoA, f.duenoALegacy])).status).toBe(401)
  })

  test("mozos/stats: dueño + empleado → sólo los mozos de SU negocio; sin dueño → 401", async () => {
    const f = await fixture()
    const get = async (cookies: string[]) => getMozoStats(new NextRequest("http://localhost/api/mozos/stats", { headers: conCookies(cookies) }))
    const r = await get([f.duenoA, f.opMozo])
    expect(r.status).toBe(200)
    const ids = ((await r.json()).stats as Array<{ id: string }>).map((m) => m.id)
    expect(ids).toEqual([f.mozo.id])
    expect((await get([f.opMozo])).status).toBe(401)
    const rb = await get([f.duenoB, f.opMozo])
    expect(((await rb.json()).stats as Array<{ id: string }>).map((m) => m.id)).not.toContain(f.mozo.id)
  })

  test("denuncias: el dueño denuncia y lista con un empleado en el navegador; el empleado nunca actúa como dueño", async () => {
    const f = await fixture()
    const cliente = await db.cliente.create({ data: { nombre: "Cliente T3 X", email: `t3-x-${f.s}@example.test`, telefono: "" } })
    const pedido = await db.pedido.create({ data: { negocioId: f.a.id, negocioSlug: "t3", negocioNombre: "T3", clienteId: cliente.id, clienteNombre: "Cliente T3 X", total: 1000, totalProductos: 1000, metodoEntrega: "retiro", estado: "entregado", idempotencyKey: `t3-den-${randomUUID()}` } })
    const post = async (cookies: string[]) => postDenuncia(new NextRequest("http://localhost/api/denuncias", { method: "POST", headers: { ...conCookies(cookies), "content-type": "application/json", "x-forwarded-for": randomUUID() }, body: JSON.stringify({ clienteId: cliente.id, pedidoId: pedido.id, motivoTipo: "no_pago", motivo: "No pagó el pedido" }) }))
    const get = async (cookies: string[]) => getDenuncias(new NextRequest(`http://localhost/api/denuncias?clienteId=${cliente.id}`, { headers: conCookies(cookies) }))

    expect((await post([f.opSalon])).status).toBe(401)
    expect(await db.denuncia.count({ where: { clienteId: cliente.id } })).toBe(0)
    // Dueño de otro negocio: el pedido no es suyo → 404, sin denuncia.
    expect((await post([f.duenoB, f.opSalon])).status).toBe(404)
    expect(await db.denuncia.count({ where: { clienteId: cliente.id } })).toBe(0)
    const creada = await post([f.duenoA, f.opSalon])
    expect(creada.status).toBe(201)
    expect(await db.denuncia.findMany({ where: { clienteId: cliente.id }, select: { negocioId: true } })).toEqual([{ negocioId: f.a.id }])

    const lista = await get([f.duenoA, f.opSalon])
    expect(lista.status).toBe(200)
    expect(((await lista.json()).denuncias as Array<{ negocioId: string }>).every((d) => d.negocioId === f.a.id)).toBe(true)
    const listaB = await get([f.duenoB, f.opSalon])
    const bodyB = await listaB.json()
    expect(bodyB.denuncias).toEqual([])
    expect(bodyB.clienteInfo).toBeNull()
    expect((await get([f.opSalon])).status).toBe(401)
  })
})
