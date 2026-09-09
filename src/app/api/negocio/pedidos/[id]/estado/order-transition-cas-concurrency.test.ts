/// <reference types="bun-types" />

// ============================================
// P2-T29A — CAS de concurrencia real para transiciones NO-cancelación
// ============================================
// La auditoría P2-T29 encontró que sólo la rama `cancelado` de este
// endpoint usaba `updateMany` CAS + transacción — el resto de las
// transiciones (recibido→preparando, preparando→en_camino/listo_para_
// retirar) dependía ÚNICAMENTE del lock process-local (`acquireLock`) para
// exclusión mutua. Ese lock es un `Map` en memoria de UN SOLO proceso Node
// — no protege contra múltiples instancias/workers de Railway atendiendo
// requests concurrentes para el MISMO pedido. Esta tarea (T29A) agregó CAS
// real (`updateMany` con `estado: currentEstado` en el WHERE) a esas
// transiciones — este archivo demuestra, con evidencia ejecutable, que el
// single-winner se sostiene incluso si el lock process-local no existiera.
//
// Tests 1-2 llaman la primitiva CAS DIRECTAMENTE (el mismo WHERE/DATA que
// el endpoint ahora ejecuta) vía `Promise.all`, deliberadamente SIN pasar
// por el endpoint — así se prueba la garantía de la DB en aislamiento,
// simulando el escenario real de dos instancias/procesos distintos donde el
// lock in-memory de este proceso no aplicaría. Test 3 sí pasa por el
// endpoint completo (`PATCH_FOR_TESTS`) para confirmar que, con AMBOS
// guards activos (lock + CAS), el resultado end-to-end sigue siendo
// single-winner con exactamente 1 PedidoEvento y 0 side effects del
// perdedor — el lock process-local es quien serializa este caso específico
// (mismo proceso de test), lo cual es exactamente el comportamiento
// esperado: PROCESS_LOCAL_LOCK=SUPPLEMENTARY_GUARD,
// DATABASE_CAS=FINAL_AUTHORITY (ver src/lib/order-transitions.ts y
// codex-reports/P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS.md).
//
// Fixtures: prefijo único por archivo, cleanup acotado EXCLUSIVAMENTE a las
// filas creadas por este archivo (nunca deleteMany global) — disciplina
// exigida por F-PRE-T29-03 (contaminación de datos preexistente en la DB
// compartida de TESTING encontrada en la promoción PRE-T29 R2).

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"
import { PATCH_FOR_TESTS as cambiarEstado } from "@/app/api/negocio/pedidos/[id]/estado/route"

setDefaultTimeout(60_000)

const prefix = "test-t29a-cas-"

async function ensureNegocio(suffix: string) {
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
      ofreceDelivery: true,
    },
  })
}

async function ensureProducto(negocioId: string) {
  const producto = await db.producto.create({ data: { nombre: `${prefix}producto`, precio: 100, negocioId } })
  return producto.id
}

function pedidoBody(negocioId: string, productoId: string, metodoEntrega: string) {
  return {
    negocioId,
    items: [{ productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" }],
    metodoEntrega,
    metodoPago: "efectivo",
    notas: null,
    direccion: metodoEntrega === "domicilio" ? "Calle Falsa 123" : null,
    referencia: null,
    lat: metodoEntrega === "domicilio" ? -34.6 : null,
    lng: metodoEntrega === "domicilio" ? -58.4 : null,
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

function estadoReq(pedidoId: string, body: unknown, negocioSession: string): NextRequest {
  return new NextRequest(`http://localhost/api/negocio/pedidos/${pedidoId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${negocioSession}` },
  })
}

function cambiar(pedidoId: string, body: unknown, negocioSession: string) {
  return cambiarEstado(estadoReq(pedidoId, body, negocioSession), { params: Promise.resolve({ id: pedidoId }) }, {})
}

async function crearYObtenerPedido(negocioId: string, productoId: string, negocioSession: string, metodoEntrega: string, ip: string) {
  const clienteSession = await createSession((await ensureClienteUnico(ip)).id, "cliente")
  const res = await crearPedido(pedidoReq(pedidoBody(negocioId, productoId, metodoEntrega), ip, clienteSession), {})
  expect(res.status).toBe(201)
  return res.json()
}

async function ensureClienteUnico(suffix: string) {
  return db.cliente.create({
    data: { nombre: `${prefix}cliente-${suffix}`, email: `${prefix}cliente-${suffix.replace(/\./g, "-")}@example.test`, telefono: "" },
  })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)

  if (negocioIds.length) {
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
}

beforeAll(async () => {
  await cleanup()
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  const remaining = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(remaining).toBe(0)
})

describe("P2-T29A — DB CAS aislado (sin lock process-local, simula multi-instancia)", () => {
  test("race 1: recibido→preparando (retiro) — exactamente un CAS gana", async () => {
    const negocio = await ensureNegocio("race1")
    const productoId = await ensureProducto(negocio.id)
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "", "retiro", `198.51.100.${randomUUID().slice(0, 2)}`)
    expect(pedido.estado).toBe("recibido")

    const [a, b] = await Promise.all([
      db.pedido.updateMany({ where: { id: pedido.id, negocioId: negocio.id, estado: "recibido" }, data: { estado: "preparando" } }),
      db.pedido.updateMany({ where: { id: pedido.id, negocioId: negocio.id, estado: "recibido" }, data: { estado: "preparando" } }),
    ])

    const counts = [a.count, b.count].sort()
    expect(counts).toEqual([0, 1]) // exactamente un ganador (count=1), un perdedor (count=0) — nunca 2 ganadores, nunca 0

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("preparando")
  })

  test("race 2 (segunda transición no-cancel): preparando→en_camino (domicilio) — exactamente un CAS gana", async () => {
    const negocio = await ensureNegocio("race2")
    const productoId = await ensureProducto(negocio.id)
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "", "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "preparando" } })

    const [a, b] = await Promise.all([
      db.pedido.updateMany({ where: { id: pedido.id, negocioId: negocio.id, estado: "preparando" }, data: { estado: "en_camino" } }),
      db.pedido.updateMany({ where: { id: pedido.id, negocioId: negocio.id, estado: "preparando" }, data: { estado: "en_camino" } }),
    ])

    const counts = [a.count, b.count].sort()
    expect(counts).toEqual([0, 1])

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("en_camino")
  })

  test("cross-actor: la misma primitiva CAS (id + estado-origen en el WHERE) es la que usan Negocio Y Operaciones/PyR — Postgres serializa cualquier UPDATE concurrente sobre la misma fila sin importar qué endpoint lo emitió, por lo que la propiedad de single-winner se sostiene entre ambos sin necesitar un mega-test cruzado", async () => {
    // Documentado, no un mega-test: negocio/pedidos/[id]/estado y
    // operaciones/pyr/pedidos/[id]/estado ejecutan la MISMA forma de
    // updateMany({ where: { id, negocioId, estado: currentEstado }, data }) —
    // la garantía de atomicidad la da el motor de Postgres sobre la fila,
    // no el proceso/endpoint que la emite. Este test confirma, de forma
    // mínima, que dos llamadas con esa forma exacta (una "como Negocio",
    // otra "como si fuera Operaciones/PyR") sobre el mismo pedido siguen
    // produciendo un solo ganador.
    const negocio = await ensureNegocio("crossactor")
    const productoId = await ensureProducto(negocio.id)
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "", "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)

    const [comoNegocio, comoOperacionesPyR] = await Promise.all([
      db.pedido.updateMany({ where: { id: pedido.id, negocioId: negocio.id, estado: "recibido" }, data: { estado: "preparando" } }),
      db.pedido.updateMany({ where: { id: pedido.id, negocioId: negocio.id, metodoEntrega: { not: "mesa" }, estado: "recibido" }, data: { estado: "preparando" } }),
    ])

    const counts = [comoNegocio.count, comoOperacionesPyR.count].sort()
    expect(counts).toEqual([0, 1])
  })
})

describe("P2-T29A — endpoint completo (lock + CAS) — single winner end-to-end", () => {
  test("dos requests concurrentes recibido→preparando sobre el mismo pedido: un 200, un 409, un solo PedidoEvento", async () => {
    const negocio = await ensureNegocio("endpoint")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "", "retiro", `198.51.100.${randomUUID().slice(0, 2)}`)

    const [resA, resB] = await Promise.all([
      cambiar(pedido.id, { estado: "preparando" }, negocioSession),
      cambiar(pedido.id, { estado: "preparando" }, negocioSession),
    ])

    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 409]) // nunca [200,200] (dos ganadores) ni [409,409] (nadie gana)

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("preparando")

    const eventCount = await db.pedidoEvento.count({ where: { pedidoId: pedido.id } })
    expect(eventCount).toBe(1) // sólo el ganador generó PedidoEvento — el perdedor no genera evento ni notificación
  })

  test("legacy compat: domicilio preparando→en_camino sigue aceptado por el grafo activo (sin cambio de comportamiento)", async () => {
    const negocio = await ensureNegocio("legacy")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "", "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)

    const toPreparando = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(toPreparando.status).toBe(200)

    const toEnCamino = await cambiar(pedido.id, { estado: "en_camino" }, negocioSession)
    expect(toEnCamino.status).toBe(200)
    const body = await toEnCamino.json()
    expect(body.estado).toBe("en_camino")
  })

  test("retiro nunca alcanza en_camino vía este endpoint (grafo activo, sin regresión)", async () => {
    const negocio = await ensureNegocio("noregression")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "", "retiro", `198.51.100.${randomUUID().slice(0, 2)}`)

    await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    const res = await cambiar(pedido.id, { estado: "en_camino" }, negocioSession)
    expect(res.status).toBe(400)

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("preparando")
  })
})
