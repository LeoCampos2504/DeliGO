// T7-F1 — formulario de Retiro personal en Caja (happy-dom): aviso sin dinero, confirmación explícita, familiares con
// el mismo nombre nunca se fusionan solos, cuerpo sin precios/costos, idempotencia del reintento y carrito intacto
// hasta la confirmación del servidor.
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { RetiroPersonalDialog, cuerpoRetiro } = await import("./caja-retiro-personal")
const { RETIRO_AVISO_SIN_DINERO, normalizarNombreFamiliar } = await import("@/lib/retiros-personales")
const originalFetch = globalThis.fetch

const cart = [
  { productoId: "p1", nombre: "Yerba", precio: 1000, cantidad: 2 },
  { productoId: "p2", varianteId: "v1", nombre: "Remera", varianteNombre: "Roja", precio: 2000, cantidad: 1 },
]
const contexto = {
  habilitado: true,
  propioEmpleadoId: "e1",
  empleados: [{ id: "e1", nombre: "Cajera Ana" }, { id: "e2", nombre: "Mozo Carlos" }],
  familiares: [{ id: "f1", nombre: "Ana Pérez" }],
  dueno: { nombre: "Mi Negocio" },
}
let posts: Array<{ key: string | null; body: Record<string, any> }> = []
let respuesta: () => Response | Promise<Response> = () => new Response("{}", { status: 500 })

beforeEach(() => {
  posts = []
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    posts.push({ key: new Headers(init?.headers).get("Idempotency-Key"), body: JSON.parse(String(init?.body)) })
    return respuesta()
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 30) { await act(async () => { await new Promise((r) => setTimeout(r, ms)) }) }
const $ = (testId: string) => document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null
function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value)
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }))
}
async function click(el: HTMLElement | null) { await act(async () => { el!.click() }); await flush() }

async function render() {
  const registrados: Array<{ id: string; replayed: boolean }> = []
  let cerrado = false
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(RetiroPersonalDialog, { retirosUrl: "/api/retiros", cart, contexto, onClose: () => { cerrado = true }, onRegistrado: (r: { id: string }, replayed: boolean) => registrados.push({ id: r.id, replayed }) }))
  })
  await flush()
  return { registrados, cerrado: () => cerrado }
}

describe("T7-F1 — formulario de Retiro personal", () => {
  test("muestra el aviso, el valor del carrito y exige confirmación explícita", async () => {
    await render()
    expect(document.body.textContent).toContain(RETIRO_AVISO_SIN_DINERO)
    expect(document.body.textContent).toContain("Valor comercial")
    expect(($("retiro-empleado") as HTMLSelectElement).value).toBe("e1") // el propio cajero preseleccionado
    expect(($("retiro-confirmar") as HTMLButtonElement).disabled).toBe(true)
    await click($("retiro-confirmo"))
    expect(($("retiro-confirmar") as HTMLButtonElement).disabled).toBe(false)
  })

  test("un nombre igual a un familiar registrado no se fusiona solo: el cajero elige o distingue", async () => {
    await render()
    await click([...document.querySelectorAll('[role="radio"]')].find((b) => b.textContent === "Familiar") as HTMLElement)
    await click($("retiro-confirmo"))
    await act(async () => setValue($("retiro-familiar-nuevo") as HTMLInputElement, "ANA perez"))
    await flush()
    expect($("retiro-familiar-coincide")).not.toBeNull()
    expect(($("retiro-confirmar") as HTMLButtonElement).disabled).toBe(true)
    await act(async () => setValue($("retiro-familiar-nuevo") as HTMLInputElement, "Ana Pérez (sobrina)"))
    await flush()
    expect($("retiro-familiar-coincide")).toBeNull()
    expect(($("retiro-confirmar") as HTMLButtonElement).disabled).toBe(false)
    await act(async () => setValue($("retiro-familiar-nuevo") as HTMLInputElement, "Ana Perez"))
    await flush()
    await click($("retiro-familiar-usar-existente"))
    expect(($("retiro-familiar") as HTMLSelectElement).value).toBe("f1")
  })

  test("envía sólo identidad, productos y cantidades; un reintento tras un error usa la misma clave; el éxito avisa una sola vez", async () => {
    const { registrados } = await render()
    await act(async () => setValue($("retiro-empleado") as HTMLSelectElement, "e2"))
    await act(async () => setValue($("retiro-observaciones") as HTMLTextAreaElement, "  para casa "))
    await click($("retiro-confirmo"))
    respuesta = () => new Response("{}", { status: 503 })
    await click($("retiro-confirmar"))
    expect(registrados).toHaveLength(0)
    expect(document.body.textContent).toContain("No sabemos si el retiro se registró")
    respuesta = () => new Response(JSON.stringify({ ok: true, retiro: { id: "r1", beneficiarioNombre: "Mozo Carlos", valorComercial: 4000, cantidadLineas: 2 } }), { status: 201 })
    await click($("retiro-confirmar"))
    expect(posts).toHaveLength(2)
    expect(posts[0].key).toBeTruthy()
    expect(posts[1].key).toBe(posts[0].key)
    expect(posts[0].body).toEqual({
      beneficiario: { tipo: "EMPLEADO", empleadoId: "e2" },
      items: [{ productoId: "p1", cantidad: 2 }, { productoId: "p2", varianteId: "v1", cantidad: 1 }],
      observaciones: "para casa",
      totalMostrado: 4000,
      confirmado: true,
    })
    expect(JSON.stringify(posts[0].body)).not.toMatch(/precio|costo|registrado/i)
    expect(registrados).toEqual([{ id: "r1", replayed: false }])
  })

  test("un rechazo definitivo descarta la clave: el siguiente intento es otra operación", async () => {
    await render()
    await click($("retiro-confirmo"))
    respuesta = () => new Response(JSON.stringify({ ok: false, error: "No hay stock suficiente", code: "STOCK_INSUFFICIENT" }), { status: 409 })
    await click($("retiro-confirmar"))
    await click($("retiro-confirmar"))
    expect(document.body.textContent).toContain("No hay stock suficiente")
    expect(posts[1].key).not.toBe(posts[0].key)
  })

  test("cuerpoRetiro y la normalización de nombres son puras", () => {
    const sel = { tipo: "FAMILIAR" as const, empleadoId: "", familiarId: "", nuevoFamiliar: "  José   Gómez " }
    expect(cuerpoRetiro(cart, sel, "").beneficiario).toEqual({ tipo: "FAMILIAR", nuevoNombre: "José Gómez" })
    expect(cuerpoRetiro(cart, { ...sel, tipo: "DUENO" }, "x").beneficiario).toEqual({ tipo: "DUENO" })
    expect(normalizarNombreFamiliar("  JOSÉ   gómez ")).toBe("jose gomez")
  })
})
