import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { OwnerCajaEgresos, inicioDiaLocal, queryFiltros, FILTROS_VACIOS } = await import("./owner-caja-egresos")
const originalFetch = globalThis.fetch

type Llamada = { url: string; method: string; key: string | null; body: Record<string, unknown> | null }
let llamadas: Llamada[] = []
let respuestaRegistro: (body: Record<string, unknown>) => Response | Promise<Response>
let respuestaAccion: (url: string, body: Record<string, unknown>) => Response | Promise<Response>
// F10-D1: the closed shift's surplus returned by the outflow detail (GET /api/negocio/caja/egresos/[id]).
let contextoCorreccion: Record<string, unknown> | null = null

const egresoBase = (extra: Record<string, unknown> = {}) => ({
  id: "egr-00000001", operacionId: "op-1", naturaleza: "GASTO", categoria: "INSUMOS", importe: 1500.5, motivo: "Bolsas", turnoCajaId: "turno-a", cajaFisicaId: "caja-a", cajaNombre: "Caja principal",
  registradoPor: { tipo: "EMPLEADO", empleadoId: "emp-1", nombre: "Cajera A" }, proveedorNombre: null, proveedorIdentificacion: null, comprobanteReferencia: null, destinatarioTipo: null, destinatarioNombre: null,
  confirmacionRetiro: null, alertas: { excedeEsperado: false, efectivoEsperadoPrevio: 5000, efectivoEsperadoResultante: 3499.5, superaUmbral: false, umbralAviso: null }, justificacion: null,
  revision: { estado: "SIN_REVISAR", en: null }, historial: [], compensacion: null, turnoAbierto: true, compensacionDisponible: true, compensacionBloqueada: null,
  pendienteSupervision: true, pendiente: { confirmacion: false, revision: true }, createdAt: "2026-11-18T13:00:00.000Z", ...extra,
})
let egresos: Array<Record<string, unknown>> = []
const cajas = () => [
  { id: "caja-a", nombre: "Caja principal", descripcion: null, esPredeterminada: true, activa: true, turnoAbierto: { id: "turno-a", responsableTipo: "EMPLEADO", responsableNombre: "Cajera A", abiertoEn: "2026-11-18T12:00:00.000Z", fondoInicial: 10000 }, fondoTransferible: null },
  { id: "caja-b", nombre: "Caja B", descripcion: null, esPredeterminada: false, activa: true, turnoAbierto: null, fondoTransferible: null },
]

beforeEach(() => {
  llamadas = []
  egresos = [
    egresoBase(),
    egresoBase({ id: "egr-00000002", naturaleza: "PAGO_PROVEEDOR", categoria: null, importe: 2000, proveedorNombre: "Distribuidora Sur", pendienteSupervision: false, compensacionDisponible: false, turnoAbierto: false, compensacionBloqueada: "TURNO_CERRADO" }),
    egresoBase({ id: "egr-00000003", naturaleza: "RETIRO_DUENO", categoria: null, importe: 3000, destinatarioTipo: "DUENO", destinatarioNombre: "Paula", confirmacionRetiro: { estado: "PENDIENTE", en: null }, pendiente: { confirmacion: true, revision: true } }),
  ]
  respuestaRegistro = (body) => new Response(JSON.stringify({ ok: true, egreso: egresoBase({ id: "egr-nuevo-01", importe: Number(body.importe), cajaNombre: "Caja principal" }) }), { status: 201 })
  respuestaAccion = () => new Response(JSON.stringify({ ok: true, egreso: egresoBase() }), { status: 201 })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    llamadas.push({ url, method, key: init?.headers ? new Headers(init.headers).get("Idempotency-Key") : null, body })
    const detalle = /^\/api\/negocio\/caja\/egresos\/([^/?]+)$/.exec(url)
    if (detalle && method === "GET") return new Response(JSON.stringify({ ok: true, egreso: egresos.find((e) => e.id === detalle[1]), contextoCorreccion }), { status: 200 })
    if (url.startsWith("/api/negocio/caja/egresos") && method === "GET") return new Response(JSON.stringify({ ok: true, egresos, pendientes: { confirmacionRetiro: 1, revision: 2, total: 2 }, responsables: [{ id: "DUENO", nombre: "Dueño" }, { id: "emp-1", nombre: "Cajera A" }] }), { status: 200 })
    if (url === "/api/negocio/caja/cajas") return new Response(JSON.stringify({ modoTurnos: "OPCIONAL", cajas: cajas(), traspasos: [] }), { status: 200 })
    if (url === "/api/negocio/caja/configuracion-egresos") return new Response(JSON.stringify({ ok: true, umbralAviso: null }), { status: 200 })
    if (url === "/api/negocio/caja/egresos" && method === "POST") return respuestaRegistro(body!)
    if (/\/api\/negocio\/caja\/egresos\/[^/]+\/(compensacion|revision|confirmacion-retiro|conciliacion|recupero)$/.test(url)) return respuestaAccion(url, body!)
    throw new Error(`unexpected fetch ${method} ${url}`)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = ""; contextoCorreccion = null })

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function render() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(<QueryClientProvider client={client}><OwnerCajaEgresos negocioId="neg-1" /></QueryClientProvider>))
  await flush()
  return root
}
const boton = (texto: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().includes(texto)) as HTMLButtonElement | undefined
async function click(el: Element | undefined | null) { if (!el) throw new Error("element not found"); await act(async () => (el as HTMLElement).click()); await flush() }
async function escribir(el: Element | null, value: string) {
  if (!el) throw new Error("field not found")
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await flush(10)
}
const posts = () => llamadas.filter((l) => l.method === "POST")

async function completarGasto(importe = "1200") {
  await click(boton("Registrar egreso"))
  await click(document.getElementById("egreso-dueno-naturaleza-GASTO"))
  await escribir(document.getElementById("egreso-dueno-categoria"), "INSUMOS")
  await escribir(document.getElementById("egreso-dueno-importe"), importe)
  await escribir(document.getElementById("egreso-dueno-motivo"), "Compra de hielo")
}

describe("F10-C1c — owner «Egresos de Caja» panel", () => {
  test("pure helpers: local day bounds and the filter query", () => {
    expect(inicioDiaLocal("2026-11-18")).toBe(new Date(2026, 10, 18).toISOString())
    expect(inicioDiaLocal("2026-11-18", true)).toBe(new Date(2026, 10, 19).toISOString())
    expect(inicioDiaLocal("18/11/2026")).toBe(null)
    expect(queryFiltros({ ...FILTROS_VACIOS, naturaleza: "PAGO_PROVEEDOR", categoria: "INSUMOS", pendienteSupervision: true })).toBe("naturaleza=PAGO_PROVEEDOR&pendienteSupervision=true")
    expect(queryFiltros({ ...FILTROS_VACIOS, empleadoId: "DUENO", estadoRevision: "OBSERVADO" })).toBe("empleadoId=DUENO&estadoRevision=OBSERVADO")
  })

  test("shows what needs supervision and tells the three natures apart (label + icon, not color only)", async () => {
    await render()
    expect(document.querySelector('[data-testid="egresos-pendientes"]')?.textContent).toContain("2 salidas requieren supervisión")
    expect(document.querySelector('[data-testid="egresos-pendientes"]')?.textContent).toContain("1 retiro por confirmar · 2 sin revisar")
    const naturalezas = [...document.querySelectorAll("[data-naturaleza]")].map((el) => `${el.getAttribute("data-naturaleza")}:${el.textContent}`)
    expect(naturalezas).toEqual(["GASTO:Gasto operativo", "PAGO_PROVEEDOR:Pago a proveedor", "RETIRO_DUENO:Retiro del dueño"])
    await click(boton("Ver pendientes"))
    expect(llamadas.some((l) => l.method === "GET" && l.url.includes("pendienteSupervision=true"))).toBe(true)
  })

  test("the register is NEVER chosen automatically, even with one open register; the confirmation names it; one click = one POST with the shift the owner saw", async () => {
    await render()
    await completarGasto()
    expect((document.getElementById("egreso-dueno-caja") as HTMLSelectElement).value).toBe("")
    await click(boton("Revisar y confirmar"))
    expect(document.getElementById("egreso-dueno-caja-error")?.textContent).toBe("Elegí la caja de la que sale el efectivo.")
    expect(posts()).toHaveLength(0)
    // Only registers with an open shift are offered.
    expect([...document.querySelectorAll("#egreso-dueno-caja option")].map((o) => o.textContent)).toEqual(["Elegí una caja…", "Caja principal — turno de Cajera A"])
    await escribir(document.getElementById("egreso-dueno-caja"), "caja-a")
    await click(boton("Revisar y confirmar"))
    expect(document.body.textContent).toContain("Confirmá el egreso")
    expect(document.body.textContent).toContain("Caja principal — turno de Cajera A")
    const confirmar = boton("Confirmar egreso")!
    await act(async () => { confirmar.click(); confirmar.click() })
    await flush()
    expect(posts()).toHaveLength(1)
    expect(posts()[0].body).toEqual({ naturaleza: "GASTO", categoria: "INSUMOS", importe: "1200.00", motivo: "Compra de hielo", cajaFisicaId: "caja-a", turnoCajaId: "turno-a" })
    expect(posts()[0].key).toBeTruthy()
    expect(document.body.textContent).toContain("Egreso registrado")
  })

  test("accessible names: short type names with the explanation as description; every field has a label", async () => {
    await render()
    await click(boton("Registrar egreso"))
    const nombre = (el: Element, attr: string) => (el.getAttribute(attr) ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
    const radios = [...document.querySelectorAll('input[name="egreso-dueno-naturaleza"]')]
    expect(radios.map((r) => nombre(r, "aria-labelledby"))).toEqual(["Gasto operativo", "Pago a proveedor", "Retiro del dueño"])
    expect(nombre(radios[2], "aria-describedby")).toContain("persona autorizada por el dueño")
    for (const id of ["egreso-dueno-caja", "egreso-dueno-importe", "egreso-dueno-motivo"]) expect((document.getElementById(id) as HTMLInputElement).labels?.[0]?.textContent?.trim().length).toBeGreaterThan(3)
    expect(document.activeElement?.id).toBe("egreso-dueno-titulo")
  })

  test("negative expected cash: the owner sees the figures and must justify; the justified attempt is a NEW content with a NEW key", async () => {
    respuestaRegistro = (body) => body.justificacion
      ? new Response(JSON.stringify({ ok: true, egreso: egresoBase({ id: "egr-nuevo-02" }) }), { status: 201 })
      : new Response(JSON.stringify({ ok: false, code: "JUSTIFICACION_REQUERIDA", error: "x", detalle: { esperadoPrevio: "500.00", esperadoResultante: "-700.00" } }), { status: 409 })
    await render()
    await completarGasto()
    await escribir(document.getElementById("egreso-dueno-caja"), "caja-a")
    await click(boton("Revisar y confirmar"))
    await click(boton("Confirmar egreso"))
    expect(document.body.textContent).toMatch(/\$\s500,00 antes, -\$\s700,00 después/)
    expect(boton("Confirmar egreso")!.disabled).toBe(true)
    await escribir(document.getElementById("egreso-dueno-justificacion"), "Pago urgente al plomero")
    await click(boton("Confirmar egreso"))
    expect(posts()).toHaveLength(2)
    expect(posts()[1].body?.justificacion).toBe("Pago urgente al plomero")
    expect(posts()[1].key).not.toBe(posts()[0].key)
  })

  test("uncertain result (network error): editing is locked and the retry reuses the SAME key", async () => {
    let intentos = 0
    respuestaRegistro = (body) => { intentos++; if (intentos === 1) throw new TypeError("offline"); return new Response(JSON.stringify({ ok: true, egreso: egresoBase({ id: "egr-nuevo-03", importe: Number(body.importe) }) }), { status: 201 }) }
    await render()
    await completarGasto()
    await escribir(document.getElementById("egreso-dueno-caja"), "caja-a")
    await click(boton("Revisar y confirmar"))
    await click(boton("Confirmar egreso"))
    expect(document.body.textContent).toContain("problema de conexión")
    expect(boton("Volver a editar")!.disabled).toBe(true)
    await click(boton("Reintentar"))
    expect(posts()).toHaveLength(2)
    expect(posts()[1].key).toBe(posts()[0].key)
  })

  test("the shift of the register changed meanwhile: back to the form with the register cleared", async () => {
    respuestaRegistro = () => new Response(JSON.stringify({ ok: false, code: "TURNO_CAMBIO", error: "cambió" }), { status: 409 })
    await render()
    await completarGasto()
    await escribir(document.getElementById("egreso-dueno-caja"), "caja-a")
    await click(boton("Revisar y confirmar"))
    await click(boton("Confirmar egreso"))
    expect((document.getElementById("egreso-dueno-caja") as HTMLSelectElement).value).toBe("")
    expect(document.getElementById("egreso-dueno-caja-error")?.textContent).toContain("cambió")
  })

  test("compensation: motive + physical-cash confirmation + a second explicit confirmation; then «Registrar la salida correcta» is offered", async () => {
    respuestaAccion = (url) => {
      egresos = egresos.map((e) => (e.id === "egr-00000001" ? { ...e, compensacion: { id: "c1", operacionId: "op-r", momento: "TURNO_ABIERTO", importe: 1500.5, motivo: "Error de carga", createdAt: "2026-11-18T14:00:00.000Z" }, compensacionDisponible: false, pendienteSupervision: false } : e))
      return new Response(JSON.stringify({ ok: true, egreso: egresos[0] }), { status: url.endsWith("/compensacion") ? 201 : 400 })
    }
    await render()
    await click(document.querySelector('[data-egreso-id="egr-00000001"] button'))
    await click(boton("Corregir con compensación"))
    const continuar = boton("Continuar")!
    expect(continuar.disabled).toBe(true)
    await escribir(document.getElementById("compensacion-egr-00000001-motivo"), "Error de carga")
    expect(boton("Continuar")!.disabled).toBe(true)
    await click(document.querySelector('form[aria-labelledby="compensacion-egr-00000001-titulo"] input[type="checkbox"]'))
    await click(boton("Continuar"))
    expect(posts()).toHaveLength(0)
    expect(document.body.textContent).toContain("No se puede deshacer y se hace una sola vez")
    await click(boton("Confirmar compensación"))
    expect(posts()).toHaveLength(1)
    expect(posts()[0].url).toBe("/api/negocio/caja/egresos/egr-00000001/compensacion")
    expect(posts()[0].body).toEqual({ motivo: "Error de carga", confirmoEfectivoEnCaja: true })
    expect(document.body.textContent).toContain("La salida original se conserva")
    expect(boton("Registrar la salida correcta")).toBeTruthy()
  })

  test("while a financial form is open the floating chat and the install notice step aside; they come back when it closes", async () => {
    await render()
    expect(document.body.dataset.cajaSalidaActiva).toBeUndefined()
    await click(boton("Registrar egreso"))
    expect(document.body.dataset.cajaSalidaActiva).toBe("true")
    await click(boton("Cancelar"))
    expect(document.body.dataset.cajaSalidaActiva).toBeUndefined()
    await click(document.querySelector('[data-egreso-id="egr-00000001"] button'))
    await click(boton("Corregir con compensación"))
    expect(document.body.dataset.cajaSalidaActiva).toBe("true")
    await click(boton("Cancelar"))
    expect(document.body.dataset.cajaSalidaActiva).toBeUndefined()
  })

  test("closed shift: no compensation button, an explicit blocked notice; a review stays available", async () => {
    await render()
    await click(document.querySelector('[data-egreso-id="egr-00000002"] button'))
    expect(boton("Corregir con compensación")).toBeUndefined()
    expect(document.querySelector('[data-testid="compensacion-bloqueada"]')?.textContent).toContain("ya cerró")
    expect(boton("Revisar")).toBeTruthy()
    expect(document.body.textContent).toContain("no se suma como gasto de rentabilidad")
  })

  test("withdrawal receipt: «No lo recibí» needs an observation; the request carries no money", async () => {
    await render()
    await click(document.querySelector('[data-egreso-id="egr-00000003"] button'))
    await click(boton("Confirmar recepción del retiro"))
    await click([...document.querySelectorAll("label")].find((l) => l.textContent?.includes("No lo recibí"))?.querySelector("input") as HTMLElement)
    expect(boton("Registrar recepción")!.disabled).toBe(true)
    await escribir(document.getElementById("confirmacion-egr-00000003-obs"), "No me llegó")
    await click(boton("Registrar recepción"))
    expect(posts()[0].url).toBe("/api/negocio/caja/egresos/egr-00000003/confirmacion-retiro")
    expect(posts()[0].body).toEqual({ resultado: "NO_RECIBIDO", observacion: "No me llegó" })
  })
})


describe("F10-D1 — guided correction of an outflow of a CLOSED shift", () => {
  const correccion = (extra: Record<string, unknown> = {}) => ({ registrado: 2000, conciliado: 0, efectivo: 2000, recuperado: 0, neto: 2000, pendiente: 2000, disponible: true, bloqueo: null, sinSalidaDisponible: true, conciliacionMaxima: 2000, historial: [], ...extra })
  const opcion = (texto: string) => [...document.querySelectorAll('[data-testid="form-correccion-posterior"] label')].find((l) => l.textContent?.includes(texto))?.querySelector("input") as HTMLInputElement

  test("«salió menos»: the owner says how much really left; the conciliation (no money) carries the difference and announces the supplier adjustment", async () => {
    egresos[1] = { ...egresos[1], correccion: correccion(), vinculoProveedor: { creditoId: "cr-1", proveedorId: "prov-1", proveedorNombre: "Distribuidora Sur" } }
    contextoCorreccion = { turnoCerrado: { diferenciaOriginal: 500, conciliadoPorEgresos: 0, sinExplicar: 500, sobranteDisponible: 500 }, entrega: null, conciliacionPosible: 500 }
    await render()
    await click(document.querySelector('[data-egreso-id="egr-00000002"] button'))
    expect(document.querySelector('[data-testid="compensacion-bloqueada"]')?.textContent).toContain("Corregir egreso (turno cerrado)")
    await click(boton("Corregir egreso (turno cerrado)"))
    expect(document.querySelector('[data-testid="correccion-contexto-cierre"]')?.textContent).toContain("diferencia original")
    expect(document.querySelector('[data-testid="correccion-contexto-cierre"]')?.textContent).toContain("Todavía no se registró la entrega")
    // The whole outflow (2000) exceeds the surplus (500): «nunca salió» is not offered.
    expect(opcion("nunca salió").disabled).toBe(true)
    await click(opcion("Salió menos"))
    await escribir(document.getElementById("correccion-egr-00000002-real"), "1500")
    expect(document.getElementById("correccion-egr-00000002-real-ayuda")?.textContent).toContain("Se concilian")
    expect(document.querySelector('[data-testid="correccion-ajuste-proveedor"]')?.textContent).toContain("error de carga")
    await escribir(document.getElementById("correccion-egr-00000002-motivo"), "Se pagó 1500, no 2000")
    expect(boton("Continuar")!.disabled).toBe(true)
    await click(document.querySelector('[data-testid="form-correccion-posterior"] input[type="checkbox"]'))
    await click(boton("Continuar"))
    expect(posts()).toHaveLength(0)
    expect(document.body.textContent).toContain("No mueve dinero y no se puede deshacer")
    await click(boton("Confirmar corrección"))
    expect(posts()).toHaveLength(1)
    expect(posts()[0].url).toBe("/api/negocio/caja/egresos/egr-00000002/conciliacion")
    expect(posts()[0].body).toEqual({ tipo: "IMPORTE_EXCEDENTE", importe: "500.00", motivo: "Se pagó 1500, no 2000", confirmoSinSalida: true })
    expect(posts()[0].key).toBeTruthy()
  })

  test("a close without surplus offers no conciliation; «salió y volvió» enters an explicitly chosen open register", async () => {
    egresos[1] = { ...egresos[1], correccion: correccion() }
    contextoCorreccion = { turnoCerrado: { diferenciaOriginal: 0, conciliadoPorEgresos: 0, sinExplicar: 0, sobranteDisponible: 0 }, entrega: { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: 8000, fondoRemanente: 2000, destinoTipo: "DUENO", confirmadoEn: "2026-11-18T20:00:00.000Z" }, conciliacionPosible: 0 }
    await render()
    await click(document.querySelector('[data-egreso-id="egr-00000002"] button'))
    await click(boton("Corregir egreso (turno cerrado)"))
    expect(opcion("nunca salió").disabled).toBe(true)
    expect(opcion("Salió menos").disabled).toBe(true)
    expect(document.querySelector('[data-testid="correccion-sin-sobrante"]')).toBeTruthy()
    await click(opcion("salió y volvió"))
    // Never chosen automatically, even with one open register.
    expect((document.getElementById("correccion-egr-00000002-caja") as HTMLSelectElement).value).toBe("")
    await escribir(document.getElementById("correccion-egr-00000002-motivo"), "El proveedor devolvió el efectivo")
    await click(document.querySelector('[data-testid="form-correccion-posterior"] input[type="checkbox"]'))
    expect(boton("Continuar")!.disabled).toBe(true)
    await escribir(document.getElementById("correccion-egr-00000002-caja"), "caja-a")
    await click(boton("Continuar"))
    expect(document.body.textContent).toContain("Es un ingreso de efectivo y no se puede deshacer")
    await click(boton("Confirmar corrección"))
    expect(posts()).toHaveLength(1)
    expect(posts()[0].url).toBe("/api/negocio/caja/egresos/egr-00000002/recupero")
    expect(posts()[0].body).toEqual({ cajaFisicaId: "caja-a", turnoCajaId: "turno-a", importe: "2000.00", motivo: "El proveedor devolvió el efectivo", confirmoEfectivoRecibido: true })
  })

  test("an outflow of an OPEN shift or one already fully corrected offers no post-close correction", async () => {
    egresos[0] = { ...egresos[0], correccion: correccion({ disponible: false, bloqueo: "TURNO_ABIERTO" }) }
    egresos[1] = { ...egresos[1], correccion: correccion({ conciliado: 2000, efectivo: 0, neto: 0, pendiente: 0, disponible: false, bloqueo: "SIN_PENDIENTE", historial: [{ id: "c1", clase: "CONCILIACION", tipo: "SIN_SALIDA", importe: 2000, motivo: "Cargado por error", conAjusteProveedor: false, createdAt: "2026-11-19T10:00:00.000Z" }] }) }
    await render()
    expect(document.querySelector('[data-egreso-id="egr-00000002"] [data-testid="egreso-corregido"]')).toBeTruthy()
    await click(document.querySelector('[data-egreso-id="egr-00000001"] button'))
    expect(boton("Corregir egreso (turno cerrado)")).toBeUndefined()
    await click(document.querySelector('[data-egreso-id="egr-00000002"] button'))
    expect(boton("Corregir egreso (turno cerrado)")).toBeUndefined()
    expect(document.querySelector('[data-testid="egreso-correccion-resumen"]')?.textContent).toContain("Nunca salió (conciliado)")
    expect(document.body.textContent).toContain("nunca salieron de la caja")
  })
})
