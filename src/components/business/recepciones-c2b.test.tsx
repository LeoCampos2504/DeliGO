import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const editor = await import("./recepcion-editor")
const pago = await import("./recepcion-pago-efectivo")
const compras = await import("./owner-compras")
const originalFetch = globalThis.fetch

type Llamada = { url: string; method: string; key: string | null; body: Record<string, any> | null }
let llamadas: Llamada[] = []
let responder: (l: Llamada) => Response | Promise<Response> | null = () => null

const catalogo = [
  { id: "p-yerba", nombre: "Yerba 1kg", marca: null, sku: "YER", codigoBarras: "779001", categoria: null, unidadMedida: "unidad", fraccionable: false, controlStock: true, variantes: [] },
  { id: "p-queso", nombre: "Queso", marca: null, sku: null, codigoBarras: "779002", categoria: null, unidadMedida: "kg", fraccionable: true, controlStock: true, variantes: [] },
  { id: "p-remera", nombre: "Remera", marca: null, sku: null, codigoBarras: null, categoria: null, unidadMedida: "unidad", fraccionable: false, controlStock: false, variantes: [{ id: "v-m", nombre: "M", sku: null, codigoBarras: "779003", activo: true, controlStock: true }] },
]

beforeEach(() => {
  llamadas = []
  responder = () => null
  try { window.localStorage.clear() } catch { /* */ }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    const body = init?.body ? JSON.parse(String(init.body)) : null
    const l = { url, method, key: init?.headers ? new Headers(init.headers).get("Idempotency-Key") : null, body }
    llamadas.push(l)
    const r = await responder(l)
    if (r) return r
    if (url.includes("catalogo")) return new Response(JSON.stringify({ ok: true, productos: catalogo }), { status: 200 })
    if (url.endsWith("/recepciones-datos")) return new Response(JSON.stringify({ ok: true, proveedores: [{ id: "prov-1", nombre: "Distribuidora Uno" }], comprasAbiertas: [] }), { status: 200 })
    if (url.endsWith("/egresos") && method === "GET") return new Response(JSON.stringify({ ok: true, turnoAbierto: true, egresos: [] }), { status: 200 })
    if (url.endsWith("/pagos") && method === "GET") return new Response(JSON.stringify({ ok: true, pagos: [] }), { status: 200 })
    throw new Error(`unexpected fetch ${method} ${url}`)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 30) { await act(async () => { await new Promise((r) => setTimeout(r, ms)) }) }
async function montar(el: React.ReactElement) {
  const c = document.createElement("div")
  document.body.appendChild(c)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => createRoot(c).render(<QueryClientProvider client={client}>{el}</QueryClientProvider>))
  await flush()
}
const boton = (t: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(t)) as HTMLButtonElement | undefined
async function click(el: Element | null | undefined) { if (!el) throw new Error("no encontrado"); await act(async () => (el as HTMLElement).click()); await flush() }
async function escribir(el: Element | null, v: string) {
  if (!el) throw new Error("campo no encontrado")
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })) })
  await flush(5)
}
const posts = () => llamadas.filter((l) => l.method !== "GET")

describe("F10-C2b — validación pura del editor", () => {
  test("enteros para productos por unidad; decimales sólo en unidades fraccionables", () => {
    expect(editor.parseCantidad("12", false)).toMatchObject({ ok: true, valor: "12.000" })
    expect(editor.parseCantidad("1,5", false).ok).toBe(false)
    expect(editor.parseCantidad("1,5", true)).toMatchObject({ ok: true, valor: "1.500", milesimas: 1500 })
    expect(editor.parseCantidad("0", true).ok).toBe(false)
    expect(editor.parseCantidad("0", true, true).ok).toBe(true)
    expect(editor.esFraccionable("kg")).toBe(true)
    expect(editor.esFraccionable("caja")).toBe(false)
  })

  test("rechazo exige motivo; aceptado no supera lo recibido; arma el cuerpo exacto de la API", () => {
    const base = editor.formularioVacio()
    const linea = { uid: "a", productoId: "p-yerba", productoVarianteId: null, compraLineaId: null, nombre: "Yerba", variante: null, unidadMedida: "unidad", fraccionable: false, recibida: "10", aceptada: "8", motivoRechazo: "", detalleRechazo: "", costoUnitario: "1500,5", descuentoPct: "10", alicuotaPct: "21", pendientePedido: null }
    let v = editor.validarFormulario({ ...base, proveedorId: "prov-1", lineas: [linea] })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errores["linea.a.motivoRechazo"]).toBeTruthy()
    v = editor.validarFormulario({ ...base, proveedorId: "prov-1", lineas: [{ ...linea, aceptada: "11" }] })
    if (!v.ok) expect(v.errores["linea.a.aceptada"]).toBe("No puede superar lo recibido.")
    v = editor.validarFormulario({ ...base, proveedorId: "prov-1", comprobanteTipo: "Factura A", comprobanteNumero: "0001-77", lineas: [{ ...linea, motivoRechazo: "DANADO" }] })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.body).toMatchObject({ proveedorId: "prov-1", comprobanteTipo: "Factura A", lineas: [{ productoId: "p-yerba", cantidadRecibida: "10.000", cantidadAceptada: "8.000", costoUnitario: "1500.5", descuentoPct: "10", alicuotaImpuestoPct: "21", motivoRechazo: "DANADO" }] })
    // 8 × 1500,50 = 12004 − 10 % = 10803,60 + 21 % = 13072,36
    expect(editor.estimarTotal({ ...base, lineas: [{ ...linea, motivoRechazo: "DANADO" }] })).toBe(13072.36)
  })
})

describe("F10-C2b — editor del cajero", () => {
  const props = (extra: Partial<Parameters<typeof editor.RecepcionEditor>[0]> = {}) => ({
    scope: "test", detalle: null, catalogoUrl: "/api/x/recepciones-datos?catalogo=1",
    cargarDatos: () => editor.leerJson<any>("/api/x/recepciones-datos"), compraUrl: (id: string) => `/api/x/compra/${id}`,
    crearUrl: "/api/x/recepciones", recepcionUrl: (id: string) => `/api/x/recepciones/${id}`, accionUrl: (id: string, a: string) => `/api/x/recepciones/${id}/${a}`,
    permiteEnviar: true, onGuardado: () => undefined, onEnviado: () => undefined, onCancelar: () => undefined, ...extra,
  })

  test("buscar y agregar; variante obligatoria; error de red conserva lo cargado y reintenta con la MISMA clave", async () => {
    let caida = true
    const guardados: string[] = []
    responder = (l) => {
      if (l.method === "POST" && l.url === "/api/x/recepciones") {
        if (caida) { caida = false; throw new TypeError("network") }
        return new Response(JSON.stringify({ ok: true, recepcionId: "r-1", numero: 7, version: 1 }), { status: 201 })
      }
      return null
    }
    await montar(<editor.RecepcionEditor {...props({ onGuardado: (r) => guardados.push(`${r.id}:${r.version}`) })} />)
    await escribir(document.getElementById("rec-proveedor"), "prov-1")
    await escribir(document.querySelector('[aria-label="Buscar producto para recibir"]'), "remera")
    await click(boton("Remera"))
    expect(document.querySelector('[aria-label="Elegir variante"]')).toBeTruthy()
    await click([...document.querySelectorAll('[aria-label="Elegir variante"] button')].find((b) => b.textContent === "M"))
    const uidRemera = (document.querySelector('[data-testid="renglon"] input') as HTMLInputElement).id.split(".")[1]
    await escribir(document.getElementById(`linea.${uidRemera}.recibida`), "1,5")
    await escribir(document.getElementById(`linea.${uidRemera}.costoUnitario`), "4000")
    await click(boton("Guardar borrador"))
    expect(document.body.textContent).toContain("usá números enteros")
    expect(posts().length).toBe(0)
    await escribir(document.getElementById(`linea.${uidRemera}.recibida`), "3")
    await click(boton("Guardar borrador"))
    expect(document.body.textContent).toContain("quedó guardado en este dispositivo")
    expect(window.localStorage.getItem(editor.claveBorradorLocal("test", null))).toContain("p-remera")
    await click(boton("Guardar borrador"))
    const envios = posts()
    expect(envios.length).toBe(2)
    expect(envios[0].key).toBe(envios[1].key)
    expect(envios[1].body?.lineas[0]).toMatchObject({ productoId: "p-remera", productoVarianteId: "v-m", cantidadRecibida: "3.000", cantidadAceptada: "3.000" })
    expect(guardados).toEqual(["r-1:1"])
    expect(document.body.textContent).toContain("recepción N° 7")
    expect(window.localStorage.getItem(editor.claveBorradorLocal("test", null))).toBeNull()
    // nunca muestra datos de la cuenta del proveedor
    expect(document.body.textContent).not.toMatch(/saldo|anticipo|deuda exigible|esperado/i)
  })

  test("un borrador recuperado de este dispositivo se avisa y se puede enviar", async () => {
    window.localStorage.setItem(editor.claveBorradorLocal("test", null), JSON.stringify({ ...editor.formularioVacio(), proveedorId: "prov-1", lineas: [{ uid: "z", productoId: "p-queso", productoVarianteId: null, compraLineaId: null, nombre: "Queso", variante: null, unidadMedida: "kg", fraccionable: true, recibida: "2,5", aceptada: "2,5", motivoRechazo: "", detalleRechazo: "", costoUnitario: "9000", descuentoPct: "", alicuotaPct: "21", pendientePedido: null }] }))
    responder = (l) => {
      if (l.method === "POST" && l.url === "/api/x/recepciones") return new Response(JSON.stringify({ ok: true, recepcionId: "r-2", numero: 8, version: 1 }), { status: 201 })
      if (l.method === "POST" && l.url.endsWith("/envio")) return new Response(JSON.stringify({ ok: true }), { status: 201 })
      return null
    }
    let enviado = ""
    await montar(<editor.RecepcionEditor {...props({ onEnviado: (id) => { enviado = id } })} />)
    expect(document.body.textContent).toContain("Recuperamos lo que habías cargado")
    await click(boton("Enviar recepción"))
    expect(posts().map((p) => [p.url, p.body?.version])).toEqual([["/api/x/recepciones", undefined], ["/api/x/recepciones/r-2/envio", 1]])
    expect(posts()[0].body?.lineas[0].cantidadRecibida).toBe("2.500")
    expect(enviado).toBe("r-2")
  })
})

describe("F10-C2b / D-7 — pago en efectivo al recibir", () => {
  test("cuerpo exacto de F10-C1 con la referencia de la recepción; confirmación obligatoria; sin turno no se ofrece", async () => {
    expect(pago.cuerpoPagoRecepcion({ numero: 12, proveedorNombre: "Distribuidora Uno", comprobante: "Factura A 1" }, "15000,50")).toEqual({
      ok: true,
      cuerpo: { naturaleza: "PAGO_PROVEEDOR", importe: "15000.50", motivo: "Pago de mercadería al recibir — Recepción N° 12", proveedorNombre: "Distribuidora Uno", comprobanteReferencia: "Recepción N° 12 · Factura A 1" },
    })
    let respuesta: Response = new Response(JSON.stringify({ ok: false, code: "TURNO_REQUERIDO", error: "x" }), { status: 409 })
    responder = (l) => (l.method === "POST" ? respuesta : null)
    await montar(<pago.RecepcionPagoEfectivo pagosUrl="/api/x/recepciones/r-12/pagos" egresosUrl="/api/x/egresos" recepcion={{ numero: 12, proveedorNombre: "Distribuidora Uno" }} />)
    await click(boton("Registrar pago en efectivo"))
    await escribir(document.getElementById("pago-recepcion-importe"), "5000")
    await click(boton("Registrar salida de efectivo"))
    expect(document.body.textContent).toContain("Confirmá que entregaste ese efectivo")
    expect(posts().length).toBe(0)
    await click(document.getElementById("pago-recepcion-confirmo"))
    await click(boton("Registrar salida de efectivo"))
    expect(document.body.textContent).toContain("necesitás tener tu turno de Caja abierto")
    respuesta = new Response(JSON.stringify({ ok: true }), { status: 201 })
    await click(boton("Registrar salida de efectivo"))
    // D-7 v2: el pago se registra DESDE la recepción (el servidor arma la salida de F10-C1 y la asocia); mismo intento = misma clave.
    expect(posts().map((p) => [p.url, p.body?.importe, Object.keys(p.body ?? {}).length])).toEqual([["/api/x/recepciones/r-12/pagos", "5000.00", 1], ["/api/x/recepciones/r-12/pagos", "5000.00", 1]])
    expect(document.body.textContent).toContain("Pago registrado")
  })
})

describe("F10-C2b — bandeja y aprobación del dueño", () => {
  test("prioridad visual, cuerpo de aprobación explícito y pagos al recibir de esa recepción", () => {
    const ahora = Date.parse("2026-11-20T12:00:00Z")
    expect(compras.prioridadPendiente("2026-11-17T12:00:00Z", ahora)).toBe("alta")
    expect(compras.prioridadPendiente("2026-11-19T06:00:00Z", ahora)).toBe("media")
    expect(compras.prioridadPendiente("2026-11-20T10:00:00Z", ahora)).toBe("normal")
    expect(compras.antiguedad("2026-11-18T12:00:00Z", ahora)).toBe("hace 2 días")
    const v = { version: 3, tratamientoImpuestos: "IMPUESTOS_INTEGRAN_COSTO", excedentes: [{} as never], diferenciasCosto: [], problemas: [] }
    expect(compras.puedeAprobar(v, { confirmoImportes: true, confirmoExcedentes: false, confirmoDiferencias: false })).toBe(false)
    expect(compras.puedeAprobar(v, { confirmoImportes: true, confirmoExcedentes: true, confirmoDiferencias: false })).toBe(true)
    expect(compras.puedeAprobar({ ...v, problemas: [{ code: "X", error: "x" }] }, { confirmoImportes: true, confirmoExcedentes: true, confirmoDiferencias: true })).toBe(false)
    expect(compras.cuerpoAprobacion(v, { confirmoExcedentes: true, confirmoDiferencias: false, anticipos: { "cr-1": "1000", "cr-2": "" } })).toEqual({ ok: true, body: { version: 3, tratamientoImpuestos: "IMPUESTOS_INTEGRAN_COSTO", confirmoExcedentes: true, aplicarAnticipos: [{ creditoId: "cr-1", importe: "1000.00" }] } })
    const pagos = [{ id: "e1", importe: 10, motivo: "", proveedorNombre: null, comprobante: "Recepción N° 12 · Fac", createdAt: "", registradoPor: "EMPLEADO", caja: "C" }, { id: "e2", importe: 10, motivo: "", proveedorNombre: null, comprobante: "Recepción N° 120", createdAt: "", registradoPor: "EMPLEADO", caja: "C" }, { id: "e3", importe: 10, motivo: "", proveedorNombre: null, comprobante: null, createdAt: "", registradoPor: "EMPLEADO", caja: "C" }]
    expect(compras.pagosDeLaRecepcion(pagos, 12).map((p) => p.id)).toEqual(["e1"]) // «N° 120» no es la recepción 12
    expect(compras.pagosDeLaRecepcion(pagos, 120).map((p) => p.id)).toEqual(["e2"])
  })

  test("aprobación: no se habilita sin confirmar importes y excedentes; envía la versión vista; doble clic = un envío", async () => {
    const detalle = { id: "r-9", numero: 9, estado: "PENDIENTE_APROBACION", version: 2, proveedor: { id: "prov-1", nombre: "Distribuidora Uno" }, compra: null, preparadaPor: { tipo: "EMPLEADO", nombre: "Ana" }, fechaRecepcion: "2026-11-19T12:00:00.000Z", comprobante: { tipo: "Factura A", numero: "1", fecha: null }, descuentoGlobal: 0, percepciones: 0, notas: null, motivoRechazo: null, lineas: [], cargos: [], totalesAprobacion: null, historial: [{ tipo: "ENVIO", motivo: null, actorTipo: "EMPLEADO", actorNombre: "Ana", createdAt: "2026-11-19T13:00:00.000Z" }] }
    const vista = { recepcionId: "r-9", version: 2, estado: "PENDIENTE_APROBACION", tratamientoImpuestos: "IMPUESTOS_INTEGRAN_COSTO", lineas: [{ id: "l1", orden: 1, producto: "Yerba", variante: null, aceptada: 10, rechazada: 0, controlStock: true, subtotal: 1000, descuentoLinea: 0, descuentoGlobal: 0, neto: 1000, impuestos: 210, percepcion: 0, cargos: 0, costoInventarioTotal: 1210, costoUnitarioInventario: 121 }], totales: { neto: 1000, descuentos: 0, impuestos: 210, percepciones: 0, cargosMismoProveedor: 0, cargosInventario: 0, totalObligacion: 1210, costoInventarioTotal: 1210 }, cargosConObligacionPropia: [], excedentes: [{ orden: 1, producto: "Yerba", compraLineaId: "cl", pedido: 8, yaRecibido: 0, pendiente: 8, aceptadaAhora: 10, excedente: 2 }], diferenciasCosto: [], umbralDiferenciaCostoPct: 20, problemas: [], anticiposDisponibles: [] }
    let liberar: () => void = () => undefined
    responder = (l) => {
      if (l.url === "/api/negocio/recepciones" && l.method === "GET") return new Response(JSON.stringify({ ok: true, recepciones: [{ id: "r-9", numero: 9, estado: "PENDIENTE_APROBACION", version: 2, fechaRecepcion: detalle.fechaRecepcion, comprobante: "Factura A 1", proveedor: detalle.proveedor, compra: null, lineas: 1, preparadaPorNombre: "Ana", enviadaEn: "2026-11-19T13:00:00.000Z", totalObligacion: null, ultimaObservacion: null, updatedAt: "" }] }), { status: 200 })
      if (l.url === "/api/negocio/recepciones/r-9" && l.method === "GET") return new Response(JSON.stringify({ ok: true, recepcion: detalle }), { status: 200 })
      if (l.url.startsWith("/api/negocio/recepciones/r-9/vista-previa")) return new Response(JSON.stringify({ ok: true, vistaPrevia: vista }), { status: 200 })
      if (l.url === "/api/negocio/proveedores/pagos-caja-sin-vincular") return new Response(JSON.stringify({ ok: true, pagos: [] }), { status: 200 })
      if (l.url.endsWith("/aprobacion")) return new Promise<Response>((res) => { liberar = () => res(new Response(JSON.stringify({ ok: true, obligacionId: "ob-1" }), { status: 201 })) })
      return null
    }
    await montar(<compras.OwnerCompras negocioId="neg-1" />)
    expect(document.body.textContent).toContain("Por aprobar (1)")
    expect(document.body.textContent).toContain("preparó Ana")
    await click(boton("N° 9"))
    expect(document.querySelector('[data-testid="excedentes"]')?.textContent).toContain("pendiente 8, aceptado 10 (+2)")
    const aprobar = () => boton("Aprobar recepción")!
    expect(aprobar().disabled).toBe(true)
    await click(document.querySelector('[data-testid="confirmacion-aprobacion"] input'))
    expect(aprobar().disabled).toBe(true) // falta confirmar el excedente
    await click(document.querySelector('[data-testid="excedentes"] input'))
    expect(aprobar().disabled).toBe(false)
    await act(async () => { aprobar().click(); aprobar().click() })
    await flush()
    const ap = posts().filter((p) => p.url.endsWith("/aprobacion"))
    expect(ap.length).toBe(1)
    expect(ap[0].body).toEqual({ version: 2, tratamientoImpuestos: "IMPUESTOS_INTEGRAN_COSTO", confirmoExcedentes: true })
    expect(ap[0].key).toMatch(/^[0-9a-f-]{36}$/i)
    await act(async () => liberar())
    await flush()
    expect(document.querySelector('[data-testid="aprobada"]')?.textContent).toContain("quedó registrada una sola vez")
  })
})
