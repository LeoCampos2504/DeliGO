// T7-F1 — Administración → Resumen → Retiros personales (happy-dom): períodos, resumen por persona, detalle con
// costos y decisión informativa, y permisos individuales.
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { OwnerRetirosPersonales, limitesPeriodo, estadoRetiro } = await import("./owner-retiros-personales")
const originalFetch = globalThis.fetch

const resumen = {
  valorComercial: 9000, costoConocido: 4800, retirosConCostoIncompleto: 1, cantidadRetiros: 5, cantidadAnulados: 0,
  porTipo: { EMPLEADO: 6000, FAMILIAR: 2000, DUENO: 1000 }, importeDecididoRecuperar: 2500, importePendienteDecision: 3500, importeRecuperadoRegistrado: null,
  personas: [{ clave: "EMPLEADO:e2", tipo: "EMPLEADO", nombre: "Mozo Carlos", cantidad: 3, valor: 6000, costo: 3600, decidido: 2500, pendiente: 3500 }],
}
const retiro = (id: string, valor: number, decision: unknown = null) => ({
  id, createdAt: "2026-11-27T12:00:00.000Z", estado: "VIGENTE", beneficiarioTipo: "EMPLEADO", beneficiarioId: "e2", beneficiarioNombre: "Mozo Carlos",
  registradoPorTipo: "EMPLEADO", registradoPorNombre: "Cajera Ana", observaciones: null, valorComercial: valor, costoConocido: valor * 0.6, costoCompleto: true,
  valorVigente: valor, costoVigente: valor * 0.6, valorDevuelto: 0, admiteDecision: true, decision,
  lineas: [{ id: `${id}-l`, nombre: "Yerba", varianteNombre: null, cantidad: valor / 1000, devuelto: 0, precioUnitario: 1000, subtotal: valor, costoUnitario: 600, costoTotal: valor * 0.6, movioStock: true }],
  devoluciones: [],
})
let llamadas: Array<{ url: string; method: string; body: any }> = []

beforeEach(() => {
  llamadas = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    llamadas.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null })
    const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    if (url.startsWith("/api/negocio/caja/retiros-personales/resumen")) return ok({ ok: true, resumen })
    if (url.startsWith("/api/negocio/caja/retiros-personales/decisiones?")) return ok({ ok: true, decisiones: [] })
    if (url === "/api/negocio/caja/retiros-personales/decisiones" && method === "POST") return ok({ ok: true, decisionId: "d1" }, 201)
    if (url.startsWith("/api/negocio/caja/retiros-personales?")) return ok({ ok: true, retiros: [retiro("r1", 2000, { id: "d0", importeRecuperar: 2500, asignado: 2000, motivo: null, decididoPorNombre: "Mi Negocio", createdAt: "2026-11-27T12:00:00.000Z" }), retiro("r2", 1000), retiro("r3", 3000)] })
    if (url === "/api/negocio/empleados/permisos-retiro" && method === "GET") return ok({ ok: true, empleados: [{ id: "e1", nombre: "Cajera Ana", habilitado: false, areaCaja: true }] })
    if (url === "/api/negocio/empleados/permisos-retiro" && method === "PUT") return ok({ ok: true })
    throw new Error(`unexpected fetch ${method} ${url}`)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 40) { await act(async () => { await new Promise((r) => setTimeout(r, ms)) }) }
const $ = (testId: string) => document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null
async function click(el: Element | null | undefined) { await act(async () => { (el as HTMLElement).click() }); await flush() }
function setValue(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}
async function render() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => { createRoot(container).render(React.createElement(QueryClientProvider, { client: qc }, React.createElement(OwnerRetirosPersonales))) })
  await flush()
  ;($("owner-retiros-personales") as HTMLDetailsElement).open = true
  await flush()
}

describe("T7-F1 — resumen de retiros del dueño", () => {
  test("límites de períodos en hora local (semana desde el lunes, rango con ambos días incluidos)", () => {
    const miercoles = new Date(2026, 10, 25, 15, 30)
    expect(limitesPeriodo("hoy", miercoles)).toEqual({ desde: new Date(2026, 10, 25), hasta: new Date(2026, 10, 26) })
    expect(limitesPeriodo("semana", miercoles)).toEqual({ desde: new Date(2026, 10, 23), hasta: new Date(2026, 10, 30) })
    expect(limitesPeriodo("mes", miercoles)).toEqual({ desde: new Date(2026, 10, 1), hasta: new Date(2026, 11, 1) })
    expect(limitesPeriodo("rango", miercoles, { desde: "2026-11-01", hasta: "2026-11-02" })).toEqual({ desde: new Date(2026, 10, 1), hasta: new Date(2026, 10, 3) })
    expect(limitesPeriodo("rango", miercoles, { desde: "2026-11-05", hasta: "2026-11-01" })).toBeNull()
    expect(estadoRetiro({ estado: "ANULADO", valorDevuelto: 0, valorComercial: 10 })).toBe("Anulado")
    expect(estadoRetiro({ estado: "VIGENTE", valorDevuelto: 4, valorComercial: 10 })).toBe("Devolución parcial")
  })

  test("muestra totales, aclara que no hay recuperado registrado y abre el detalle de una persona", async () => {
    await render()
    const texto = $("retiros-resumen")!.textContent!
    expect(texto).toContain("Valor comercial")
    expect(texto).toContain("Costo conocido")
    expect(texto).toContain("1 con costo desconocido")
    expect(texto).toContain("Pendiente de decisión")
    expect(texto).toContain("no registra cobros ni descuentos de sueldo")
    expect(llamadas.find((l) => l.url.includes("/resumen"))!.url).toMatch(/desde=.*&hasta=/)
    await click($("retiros-personas")!.querySelector("button"))
    expect($("retiros-detalle-persona")).not.toBeNull()
    expect(document.querySelectorAll('[data-testid="retiro-item"]')).toHaveLength(3)
    expect($("retiros-detalle-persona")!.textContent).toContain("Registró: Cajera Ana")
    expect($("retiros-detalle-persona")!.textContent).toContain("Volver a pendiente")
  })

  test("decisión parcial sobre retiros elegidos: sólo los que no tienen decisión, con su valor elegible", async () => {
    await render()
    await click($("retiros-personas")!.querySelector("button"))
    const checks = [...document.querySelectorAll('[data-testid="retiro-item"] input[type="checkbox"]')] as HTMLInputElement[]
    expect(checks.map((c) => c.disabled)).toEqual([true, false, false]) // r1 ya tiene decisión
    await click(checks[1])
    await click(checks[2])
    await click([...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Decidir recuperación")))
    const form = $("retiros-form-decision")!
    expect(form.textContent).toContain("valor $")
    await act(async () => setValue(form.querySelector("input") as HTMLInputElement, "2500"))
    await flush()
    await click([...form.querySelectorAll("button")].find((b) => b.textContent === "Guardar decisión"))
    const post = llamadas.find((l) => l.method === "POST")!
    expect(post.body).toEqual({ empleadoId: "e2", retiroIds: ["r2", "r3"], importe: "2500", motivo: null, reemplazaDecisionId: null })
  })

  test("permisos individuales: deshabilitados por defecto y se guardan por empleado", async () => {
    await render()
    ;($("permisos-retiro") as HTMLDetailsElement).open = true
    await flush()
    const box = $("permisos-retiro")!.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(box.checked).toBe(false)
    await click(box)
    expect(llamadas.find((l) => l.method === "PUT")!.body).toEqual({ empleadoId: "e1", habilitado: true })
  })
})
