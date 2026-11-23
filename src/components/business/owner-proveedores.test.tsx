import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { OwnerProveedores, accionesCredito, centavos, textoSaldo, validarRenglones, tituloObligacion, obligacionAnulable } = await import("./owner-proveedores")
const originalFetch = globalThis.fetch

type Llamada = { url: string; method: string; key: string | null; body: Record<string, unknown> | null }
let llamadas: Llamada[] = []
let responder: (l: Llamada) => Response | Promise<Response> | null

const totales = (extra: Record<string, unknown> = {}) => ({ deudaVigente: 1500, obligacionesPendientes: 1500, creditosConfirmados: 0, creditosAsignados: 0, anticiposDisponibles: 0, pagosDeclaradosPendientes: 600, saldoNeto: 1500, deudaExigible: 1500, saldoAFavor: 0, identidadOk: true, ...extra })
const proveedor = { id: "prov-1", nombre: "Distribuidora Sur", cuit: "20123456786", cuitFormateado: "20-12345678-6", telefono: null, email: null, notas: null, activo: true }
const cuenta = () => ({
  totales: totales({ creditosConfirmados: 1000, anticiposDisponibles: 1000, saldoNeto: 500, deudaExigible: 500 }),
  obligaciones: [
    { id: "ob-1", origen: "SALDO_INICIAL", naturalezaAjuste: null, importe: 1000, asignado: 0, pendiente: 1000, fecha: "2026-10-31T12:00:00.000Z", descripcion: "Saldo libreta", comprobante: null, estado: "VIGENTE", anuladaEn: null, createdAt: "2026-11-01T10:00:00.000Z" },
    { id: "ob-2", origen: "AJUSTE_DEUDA", naturalezaAjuste: "RECARGO", importe: 500, asignado: 0, pendiente: 500, fecha: "2026-11-05T12:00:00.000Z", descripcion: "Recargo", comprobante: null, estado: "VIGENTE", anuladaEn: null, createdAt: "2026-11-05T10:00:00.000Z" },
  ],
  creditos: [
    { id: "cr-dec", origen: "PAGO_DECLARADO", estado: "DECLARADO", efectivo: false, importe: 600, asignado: 0, disponible: 0, medio: "TRANSFERENCIA", referencia: "TRX-9", fechaPago: "2026-11-06T12:00:00.000Z", cuentaOrigenDeclarada: null, naturalezaAjuste: null, motivo: null, confirmadoEn: null, cerradoEn: null, egresoCaja: null, createdAt: "2026-11-06T10:00:00.000Z" },
    { id: "cr-caja", origen: "PAGO_CAJA", estado: "VIGENTE", efectivo: true, importe: 1000, asignado: 0, disponible: 1000, medio: null, referencia: null, fechaPago: null, cuentaOrigenDeclarada: null, naturalezaAjuste: null, motivo: null, confirmadoEn: null, cerradoEn: null, egresoCaja: { id: "egr-1", createdAt: "2026-11-07T10:00:00.000Z", motivo: "Pago mercadería", proveedorNombre: "Distribuidora Sur", comprobante: null, caja: "Caja principal" }, createdAt: "2026-11-07T10:00:00.000Z" },
  ],
  asignaciones: [],
  operaciones: [],
  eventos: [],
})

beforeEach(() => {
  llamadas = []
  responder = () => null
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    const l = { url, method, key: init?.headers ? new Headers(init.headers).get("Idempotency-Key") : null, body }
    llamadas.push(l)
    const r = await responder(l)
    if (r) return r
    if (url.startsWith("/api/negocio/proveedores?") || url === "/api/negocio/proveedores") {
      if (method === "GET") return new Response(JSON.stringify({ ok: true, proveedores: [{ ...proveedor, totales: totales() }, { ...proveedor, id: "prov-2", nombre: "Panificadora", cuit: null, cuitFormateado: null, totales: totales({ saldoNeto: -200, deudaExigible: 0, saldoAFavor: 200, pagosDeclaradosPendientes: 0 }) }], pagosCajaSinVincular: 2 }), { status: 200 })
    }
    if (url === "/api/negocio/proveedores/prov-1" && method === "GET") return new Response(JSON.stringify({ ok: true, proveedor, historial: [] }), { status: 200 })
    if (url === "/api/negocio/proveedores/prov-1/cuenta") return new Response(JSON.stringify({ ok: true, cuenta: cuenta() }), { status: 200 })
    if (url.startsWith("/api/negocio/proveedores/prov-1/sugerencia")) return new Response(JSON.stringify({ ok: true, esSugerencia: true, sugerencia: { disponible: 1000, renglones: [{ obligacionId: "ob-1", importe: 1000, pendiente: 1000 }], quedaComoAnticipo: 0 } }), { status: 200 })
    if (method === "POST") return new Response(JSON.stringify({ ok: true, replayed: false }), { status: 201 })
    throw new Error(`unexpected fetch ${method} ${url}`)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function render() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(<QueryClientProvider client={client}><OwnerProveedores negocioId="neg-1" /></QueryClientProvider>))
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
const posts = () => llamadas.filter((l) => l.method !== "GET")
const abrirFicha = async () => { await render(); await click(boton("Distribuidora Sur")) }

describe("F5-A — helpers puros (centavos enteros, sin coma flotante)", () => {
  test("validarRenglones: topes por deuda y por pago, total y anticipo restante en centavos", () => {
    const r = validarRenglones([{ obligacionId: "a", pendiente: 0.3, valor: "0,1" }, { obligacionId: "b", pendiente: 1, valor: "0,2" }], 0.3)
    expect(r).toEqual({ ok: true, asignar: [{ obligacionId: "a", importe: "0.10" }, { obligacionId: "b", importe: "0.20" }], totalCentavos: 30, restanteCentavos: 0 })
    expect(validarRenglones([{ obligacionId: "a", pendiente: 100, valor: "100,01" }], 500)).toMatchObject({ ok: false, obligacionId: "a" })
    expect(validarRenglones([{ obligacionId: "a", pendiente: 100, valor: "60" }, { obligacionId: "b", pendiente: 100, valor: "60" }], 100)).toMatchObject({ ok: false })
    expect(validarRenglones([{ obligacionId: "a", pendiente: 100, valor: "" }], 100)).toMatchObject({ ok: false })
    expect(validarRenglones([{ obligacionId: "a", pendiente: 100, valor: "1.000" }], 100)).toMatchObject({ ok: false })
    expect(centavos(0.1 + 0.2)).toBe(30)
  })

  test("acciones por estado: un declarado se confirma o rechaza pero no se asigna; con asignaciones no se anula ni desvincula", () => {
    expect(accionesCredito({ origen: "PAGO_DECLARADO", estado: "DECLARADO", asignado: 0, disponible: 0 })).toEqual(["confirmacion", "rechazo"])
    expect(accionesCredito({ origen: "PAGO_DECLARADO", estado: "CONFIRMADO_DUENO", asignado: 0, disponible: 600 })).toEqual(["asignar", "anulacion"])
    expect(accionesCredito({ origen: "PAGO_CAJA", estado: "VIGENTE", asignado: 100, disponible: 900 })).toEqual(["asignar"])
    expect(accionesCredito({ origen: "PAGO_CAJA", estado: "VIGENTE", asignado: 0, disponible: 1000 })).toEqual(["asignar", "desvinculacion"])
    expect(accionesCredito({ origen: "PAGO_DECLARADO", estado: "RECHAZADO", asignado: 0, disponible: 0 })).toEqual([])
    expect(textoSaldo({ deudaExigible: 1500, saldoAFavor: 0 })).toMatchObject({ titulo: "Deuda exigible", tono: "deuda" })
    expect(textoSaldo({ deudaExigible: 0, saldoAFavor: 200 })).toMatchObject({ titulo: "Saldo a favor", tono: "favor" })
    expect(textoSaldo({ deudaExigible: 0.001, saldoAFavor: 0 }).tono).toBe("cero")
  })
})

describe("F10-C2a — deudas nacidas de recepciones en el panel de proveedores", () => {
  test("se titulan por su origen y no ofrecen «Anular» (se corrigen con ajuste o devolución)", () => {
    expect(tituloObligacion({ origen: "RECEPCION", naturalezaAjuste: null })).toBe("Recepción de mercadería")
    expect(tituloObligacion({ origen: "CARGO_ACCESORIO", naturalezaAjuste: null })).toBe("Cargo accesorio de una recepción")
    expect(obligacionAnulable({ origen: "RECEPCION", estado: "VIGENTE", asignado: 0 })).toBe(false)
    expect(obligacionAnulable({ origen: "CARGO_ACCESORIO", estado: "VIGENTE", asignado: 0 })).toBe(false)
    expect(obligacionAnulable({ origen: "AJUSTE_DEUDA", estado: "VIGENTE", asignado: 0 })).toBe(true)
    expect(obligacionAnulable({ origen: "SALDO_INICIAL", estado: "VIGENTE", asignado: 10 })).toBe(false)
  })
})

describe("F5-A — panel del dueño", () => {
  test("lista con saldos claros, declarados sin confirmar y aviso de pagos de Caja sin vincular", async () => {
    await render()
    const texto = document.body.textContent ?? ""
    expect(texto).toContain("Distribuidora Sur")
    expect(texto).toContain("CUIT 20-12345678-6")
    expect(texto).toMatch(/Le debés \$\s?1\.500,00/)
    expect(texto).toMatch(/Tenés \$\s?200,00 a favor/)
    expect(texto).toContain("declarados sin confirmar")
    expect(document.querySelector('[data-testid="aviso-sin-vincular"]')?.textContent).toContain("2 pagos a proveedor de Caja")
  })

  test("alta con nombre similar: muestra coincidencias y sólo crea si el dueño confirma (otra clave por otro contenido)", async () => {
    let n = 0
    responder = (l) => {
      if (l.url === "/api/negocio/proveedores" && l.method === "POST") {
        n++
        if (l.body?.confirmoNombreSimilar !== true) return new Response(JSON.stringify({ ok: false, code: "PROVEEDOR_NOMBRE_SIMILAR", error: "Ya tenés proveedores con un nombre parecido.", detalle: { coincidencias: [{ id: "prov-1", nombre: "Distribuidora Sur", cuit: "20123456786" }] } }), { status: 409 })
        return new Response(JSON.stringify({ ok: true, proveedor: { ...proveedor, id: "prov-9", nombre: "Distribuidora del Sur" } }), { status: 201 })
      }
      return null
    }
    await render()
    await click(boton("Nuevo proveedor"))
    await escribir(document.getElementById("prov-nombre"), "Distribuidora del Sur")
    await click(boton("Crear proveedor"))
    expect(document.querySelector('[data-testid="nombre-similar"]')?.textContent).toContain("Distribuidora Sur")
    await click(boton("Es otro proveedor"))
    const altas = posts()
    expect(altas.length).toBe(2)
    expect(altas[1].body?.confirmoNombreSimilar).toBe(true)
    expect(altas[0].key).not.toBe(altas[1].key)
    expect(n).toBe(2)
    expect(document.body.textContent).toContain("Proveedor «Distribuidora del Sur» creado.")
  })

  test("ficha: totales con fórmula explícita; el declarado no ofrece asignar; confirmar pasa por confirmación y no se duplica con doble clic", async () => {
    let liberar: () => void = () => {}
    responder = (l) => l.method === "POST" && l.url.endsWith("/confirmacion") ? new Promise<Response>((res) => { liberar = () => res(new Response(JSON.stringify({ ok: true, replayed: false }), { status: 201 })) }) : null
    await abrirFicha()
    expect(document.querySelector('[data-testid="saldo-exigible"]')?.textContent).toContain("Deuda vigente − pagos confirmados")
    expect(document.querySelector('[data-testid="declarados"]')?.textContent).toContain("No restan de la deuda")
    const declarado = [...document.querySelectorAll('[aria-label="Pagos y créditos"] li')].find((li) => li.textContent?.includes("TRX-9"))!
    expect(declarado.textContent).toContain("Declarado · sin confirmar")
    expect([...declarado.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Confirmar pago", "Rechazar"])
    await click([...declarado.querySelectorAll("button")].find((b) => b.textContent === "Confirmar pago"))
    expect(document.querySelector('[data-testid="confirmacion"]')?.textContent).toContain("No es una conciliación bancaria")
    const confirmar = [...document.querySelectorAll('[data-testid="confirmacion"] button')].find((b) => b.textContent === "Confirmar pago") as HTMLButtonElement
    await act(async () => { confirmar.click(); confirmar.click() })
    await flush()
    expect(posts().length).toBe(1)
    expect(posts()[0].url).toBe("/api/negocio/proveedores/creditos/cr-dec/confirmacion")
    expect(posts()[0].key).toMatch(/^[0-9a-f-]{36}$/i)
    await act(async () => liberar())
    await flush()
    expect(document.body.textContent).toContain("Pago confirmado. Ya resta de la deuda.")
  })

  test("asignar: la sugerencia FIFO sólo completa campos editables; total y anticipo en centavos; un error de red reintenta con la MISMA clave", async () => {
    let fallar = true
    responder = (l) => {
      if (l.method === "POST" && l.url.endsWith("/asignaciones") && fallar) { fallar = false; throw new TypeError("network down") }
      return null
    }
    await abrirFicha()
    const caja = [...document.querySelectorAll('[aria-label="Pagos y créditos"] li')].find((li) => li.textContent?.includes("Caja principal"))!
    await click([...caja.querySelectorAll("button")].find((b) => b.textContent === "Asignar a deudas"))
    expect(posts().length).toBe(0)
    await click(boton("Sugerir"))
    expect((document.getElementById("asig-ob-1") as HTMLInputElement).value).toBe("1000,00")
    expect(posts().length).toBe(0) // la sugerencia nunca escribe
    await escribir(document.getElementById("asig-ob-1"), "700")
    await escribir(document.getElementById("asig-ob-2"), "300,50")
    await click(boton("Continuar"))
    expect(document.querySelector('[data-testid="total-asignacion"]')?.textContent ?? "").toBe("")
    expect(document.body.textContent).toContain("supera lo disponible")
    await escribir(document.getElementById("asig-ob-2"), "300")
    expect(document.querySelector('[data-testid="total-asignacion"]')?.textContent).toMatch(/Total \$\s?1\.000,00 · queda sin asignar \$\s?0,00/)
    await click(boton("Continuar"))
    await click(boton("Asignar"))
    expect(document.body.textContent).toContain("no se va a registrar dos veces")
    await click(boton("Reintentar"))
    const envios = posts()
    expect(envios.length).toBe(2)
    expect(envios[0].key).toBe(envios[1].key)
    expect(envios[1].body).toEqual({ tipo: "ASIGNAR", asignar: [{ creditoId: "cr-caja", obligacionId: "ob-1", importe: "700.00" }, { creditoId: "cr-caja", obligacionId: "ob-2", importe: "300.00" }] })
    expect(document.body.textContent).toContain("Asignaste")
  })

  test("pago declarado: exige marcar que no salió de Caja; ante un posible duplicado muestra los candidatos y sólo registra si el dueño confirma (otra clave)", async () => {
    responder = (l) => {
      if (l.method === "POST" && l.url === "/api/negocio/proveedores/prov-1/creditos") {
        if (l.body?.confirmoNoDuplicado !== true) return new Response(JSON.stringify({ ok: false, code: "POSIBLE_PAGO_DUPLICADO", error: "Hay un pago a proveedor registrado en Caja por el mismo importe. Si es este mismo pago, vinculalo desde «Vincular pago de Caja».", detalle: { candidatos: [{ tipo: "PAGO_CAJA_SIN_VINCULAR", id: "egr-9", importe: 2500, fecha: "2026-11-19T15:00:00.000Z", referencia: null, estado: null, caja: "Caja principal", coincidencia: "IMPORTE_Y_FECHA" }] } }), { status: 409 })
        return new Response(JSON.stringify({ ok: true, replayed: false, creditoId: "cr-new" }), { status: 201 })
      }
      return null
    }
    await abrirFicha()
    await click(boton("Pago por transferencia o ajuste a favor"))
    await escribir(document.getElementById("cr-importe"), "2500")
    await click(boton("Continuar"))
    expect(document.body.textContent).toContain("Confirmá que este pago no salió del efectivo de la Caja")
    expect(posts().length).toBe(0)
    await escribir(document.getElementById("cr-medio"), "OTRO")
    await click(document.getElementById("cr-fuera-caja"))
    await click(boton("Continuar"))
    expect(document.body.textContent).toContain("indicá en la nota cuál fue")
    await escribir(document.getElementById("cr-motivo"), "Cheque")
    await click(boton("Continuar"))
    await click(boton("Registrar como declarado"))
    const aviso = document.querySelector('[data-testid="posible-duplicado"]')
    expect(aviso?.textContent).toContain("Pago de Caja sin vincular (Caja principal)")
    expect((boton("Registrar como declarado") as HTMLButtonElement).disabled).toBe(true)
    await click(boton("Es otro pago: registrarlo igual"))
    const envios = posts()
    expect(envios.length).toBe(2)
    expect(envios[0].body).toMatchObject({ origen: "PAGO_DECLARADO", medio: "OTRO", importe: "2500.00", motivo: "Cheque", confirmoNoSalioDeCaja: true })
    expect(envios[0].body?.confirmoNoDuplicado).toBeUndefined()
    expect(envios[1].body).toMatchObject({ confirmoNoDuplicado: true, confirmoNoSalioDeCaja: true })
    expect(envios[1].key).not.toBe(envios[0].key)
    expect(document.body.textContent).toContain("Pago declarado por")
  })

  test("saldo a favor: más pagos confirmados que deuda se muestra como saldo a favor, nunca como deuda negativa", async () => {
    responder = (l) => l.url === "/api/negocio/proveedores/prov-1/cuenta" ? new Response(JSON.stringify({ ok: true, cuenta: { ...cuenta(), totales: totales({ deudaVigente: 1000, creditosConfirmados: 1500, anticiposDisponibles: 1500, pagosDeclaradosPendientes: 0, saldoNeto: -500, deudaExigible: 0, saldoAFavor: 500 }) } }), { status: 200 }) : null
    await abrirFicha()
    const tarjeta = document.querySelector('[data-testid="saldo-exigible"]')?.textContent ?? ""
    expect(tarjeta).toContain("Saldo a favor")
    expect(tarjeta).toMatch(/Tenés \$\s?500,00 a favor/)
    expect(tarjeta).not.toContain("-")
    expect(document.querySelector('[data-testid="anticipos-sin-asignar"]')).toBeNull()
  })

  test("las acciones con motivo no se envían sin motivo (desvincular un pago de Caja)", async () => {
    await abrirFicha()
    const caja = [...document.querySelectorAll('[aria-label="Pagos y créditos"] li')].find((li) => li.textContent?.includes("Caja principal"))!
    await click([...caja.querySelectorAll("button")].find((b) => b.textContent === "Desvincular"))
    const enviar = [...document.querySelectorAll('[data-testid="confirmacion"] button')].find((b) => b.textContent === "Desvincular") as HTMLButtonElement
    expect(enviar.disabled).toBe(true)
    await escribir(document.getElementById("motivo-accion"), "Era de otro proveedor")
    await click([...document.querySelectorAll('[data-testid="confirmacion"] button')].find((b) => b.textContent === "Desvincular"))
    expect(posts().map((p) => [p.url, p.body])).toEqual([["/api/negocio/proveedores/creditos/cr-caja/desvinculacion", { motivo: "Era de otro proveedor" }]])
  })
})
