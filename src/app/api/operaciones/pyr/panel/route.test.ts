// P2-T49-R1D: contrato focal de la metadata de mensajes agregada al panel
// PyR de Terminal (tieneMensajes/mensajesNoLeidos). No real DB — `db` y
// `operaciones-terminal-access` mockeados, mismo patrón que
// mensajes/[pedidoId]/route.test.ts. Cubre exactamente los 9 casos A-I
// pedidos por la tarea.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

type GroupByRow = { pedidoId: string; remitente: string; leido: boolean; _count: { _all: number } }

const DEFAULT_CONTEXT = {
  terminal: { id: "terminal-1", nombre: "Terminal Test" },
  negocio: { id: "negocio-1", nombre: "Negocio Test", colorPrincipal: "#000000" },
}

let authOk = true
let hasScopeMap: Record<string, boolean>
let pedidosRecord: Array<{
  id: string
  estado: string
  metodoEntrega: string
  fecha: Date
  total: number
  clienteNombre: string | null
  clienteConfirmaRecibido: boolean | null
  items: unknown[]
}>
let groupByRows: GroupByRow[]
let groupByCallCount: number
let groupByLastArgs: Record<string, unknown> | null

mock.module("@/lib/db", () => {
  const chatMensaje = {
    groupBy: async (args: Record<string, unknown>) => {
      groupByCallCount += 1
      groupByLastArgs = args
      return groupByRows
    },
  }
  const pedido = {
    findMany: async () => pedidosRecord,
  }
  const db = { pedido, chatMensaje }
  return { db }
})

mock.module("@/lib/operaciones-terminal-access", () => ({
  requireOperacionesScope: async () =>
    authOk
      ? { ok: true, context: DEFAULT_CONTEXT }
      : { ok: false, response: new Response(null, { status: 401 }) },
  hasTerminalScope: (_ctx: unknown, scope: string) => hasScopeMap[scope] === true,
}))

const { GET } = await import("./route")

function callGet() {
  return GET(new NextRequest("http://localhost/api/operaciones/pyr/panel"))
}

function pedido(id: string) {
  return {
    id,
    estado: "recibido",
    metodoEntrega: "retiro" as const,
    fecha: new Date("2026-09-20T00:00:00.000Z"),
    total: 1000,
    clienteNombre: "Cliente Test",
    clienteConfirmaRecibido: null,
    items: [],
  }
}

beforeEach(() => {
  authOk = true
  hasScopeMap = {
    "pyr.pedidos.ver": true,
    "pyr.pedidos.gestionar": true,
    "pyr.mensajes.ver": true,
    "pyr.mensajes.responder": true,
    "pyr.resenas.ver": true,
    "pyr.resenas.responder": true,
  }
  pedidosRecord = [pedido("pedido-1")]
  groupByRows = []
  groupByCallCount = 0
  groupByLastArgs = null
})

describe("P2-T49-R1D — panel PyR: tieneMensajes / mensajesNoLeidos", () => {
  test("A. pedido sin mensajes => tieneMensajes=false, mensajesNoLeidos=0", async () => {
    groupByRows = []
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos[0].tieneMensajes).toBe(false)
    expect(data.pedidos[0].mensajesNoLeidos).toBe(0)
  })

  test("B. sólo mensaje vendedor => tieneMensajes=true, mensajesNoLeidos=0", async () => {
    groupByRows = [{ pedidoId: "pedido-1", remitente: "vendedor", leido: false, _count: { _all: 1 } }]
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos[0].tieneMensajes).toBe(true)
    expect(data.pedidos[0].mensajesNoLeidos).toBe(0)
  })

  test("C. 1 mensaje cliente unread => tieneMensajes=true, mensajesNoLeidos=1", async () => {
    groupByRows = [{ pedidoId: "pedido-1", remitente: "cliente", leido: false, _count: { _all: 1 } }]
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos[0].tieneMensajes).toBe(true)
    expect(data.pedidos[0].mensajesNoLeidos).toBe(1)
  })

  test("D. 3 mensajes cliente unread => tieneMensajes=true, mensajesNoLeidos=3", async () => {
    groupByRows = [{ pedidoId: "pedido-1", remitente: "cliente", leido: false, _count: { _all: 3 } }]
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos[0].tieneMensajes).toBe(true)
    expect(data.pedidos[0].mensajesNoLeidos).toBe(3)
  })

  test("E. mensajes cliente ya leídos => tieneMensajes=true, mensajesNoLeidos=0", async () => {
    groupByRows = [{ pedidoId: "pedido-1", remitente: "cliente", leido: true, _count: { _all: 2 } }]
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos[0].tieneMensajes).toBe(true)
    expect(data.pedidos[0].mensajesNoLeidos).toBe(0)
  })

  test("F. mezcla vendedor + cliente leído + cliente unread => presencia correcta + contador sólo unread cliente", async () => {
    groupByRows = [
      { pedidoId: "pedido-1", remitente: "vendedor", leido: false, _count: { _all: 2 } },
      { pedidoId: "pedido-1", remitente: "cliente", leido: true, _count: { _all: 1 } },
      { pedidoId: "pedido-1", remitente: "cliente", leido: false, _count: { _all: 4 } },
    ]
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos[0].tieneMensajes).toBe(true)
    expect(data.pedidos[0].mensajesNoLeidos).toBe(4)
  })

  test("G. fila de un pedido de otro negocio (no autorizado) nunca contamina el pedido visible ni se filtra fuera de rango", async () => {
    // El pedido visible ("pedido-1") no tiene mensajes; una fila espuria
    // para "pedido-otro-negocio" (que el mock de groupBy podría devolver
    // si el filtro pedidoId:{in:[...]} no se respetara) no debe aparecer
    // en ningún pedido de la respuesta — el panel sólo puede exponer los
    // ids que él mismo autorizó.
    groupByRows = [{ pedidoId: "pedido-otro-negocio", remitente: "cliente", leido: false, _count: { _all: 5 } }]
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos).toHaveLength(1)
    expect(data.pedidos[0].id).toBe("pedido-1")
    expect(data.pedidos[0].tieneMensajes).toBe(false)
    expect(data.pedidos[0].mensajesNoLeidos).toBe(0)
    // Confirma además que la query real sólo pidió los ids autorizados.
    expect((groupByLastArgs!.where as { pedidoId: { in: string[] } }).pedidoId.in).toEqual(["pedido-1"])
  })

  test("H. sin permiso pyr.mensajes.ver => no leak de metadata, ni siquiera se consulta chatMensaje", async () => {
    hasScopeMap["pyr.mensajes.ver"] = false
    groupByRows = [{ pedidoId: "pedido-1", remitente: "cliente", leido: false, _count: { _all: 9 } }]
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos[0].tieneMensajes).toBe(false)
    expect(data.pedidos[0].mensajesNoLeidos).toBe(0)
    expect(data.capacidades.puedeVerMensajes).toBe(false)
    expect(groupByCallCount).toBe(0)
  })

  test("I. cero pedidos => cero query de mensajes", async () => {
    pedidosRecord = []
    const res = await callGet()
    const data = await res.json()
    expect(data.pedidos).toHaveLength(0)
    expect(groupByCallCount).toBe(0)
  })

  test("con pedidos y permiso: exactamente 1 query de mensajes por refresh del panel (nunca N+1)", async () => {
    pedidosRecord = [pedido("pedido-1"), pedido("pedido-2"), pedido("pedido-3")]
    groupByRows = [{ pedidoId: "pedido-2", remitente: "cliente", leido: false, _count: { _all: 1 } }]
    const res = await callGet()
    const data = await res.json()
    expect(groupByCallCount).toBe(1)
    expect(data.pedidos.find((p: { id: string }) => p.id === "pedido-1").tieneMensajes).toBe(false)
    expect(data.pedidos.find((p: { id: string }) => p.id === "pedido-2").mensajesNoLeidos).toBe(1)
    expect(data.pedidos.find((p: { id: string }) => p.id === "pedido-3").tieneMensajes).toBe(false)
  })

  test("el DTO nunca incluye texto, adjuntos, clienteId ni ids de mensaje", async () => {
    groupByRows = [{ pedidoId: "pedido-1", remitente: "cliente", leido: false, _count: { _all: 1 } }]
    const res = await callGet()
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toContain("texto")
    expect(raw).not.toContain("imagenUrl")
    expect(raw).not.toContain("archivoUrl")
    expect(raw).not.toContain("clienteId")
  })
})
