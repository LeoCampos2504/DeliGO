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
const { RetiroPersonalDialog, cuerpoRetiro, readPendingRetiro, writePendingRetiro, clearPendingRetiro } = await import("./caja-retiro-personal")
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
  window.sessionStorage.clear()
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

const SCOPE = "neg-test"
/** Host mínimo: guarda el intento pendiente como lo hace VenderView (sessionStorage por scope). */
function Host({ carrito, onRegistrado, onClose }: { carrito: typeof cart; onRegistrado: (r: { id: string }, replayed: boolean) => void; onClose: () => void }) {
  const [pendiente, setPendiente] = React.useState(() => readPendingRetiro(SCOPE))
  return React.createElement(RetiroPersonalDialog, {
    retirosUrl: "/api/retiros", cart: carrito, contexto, pendiente,
    onPendienteChange: (a: any) => { setPendiente(a); if (a) writePendingRetiro(SCOPE, a); else clearPendingRetiro(SCOPE) },
    onClose, onRegistrado,
  })
}
async function render(carrito = cart) {
  const registrados: Array<{ id: string; replayed: boolean }> = []
  let cerrado = false
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(Host, { carrito, onClose: () => { cerrado = true }, onRegistrado: (r: { id: string }, replayed: boolean) => registrados.push({ id: r.id, replayed }) }))
  })
  await flush()
  return { registrados, cerrado: () => cerrado, root }
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
    expect($("retiro-pendiente")).not.toBeNull()
    expect(readPendingRetiro(SCOPE)?.key).toBe(posts[0].key as string)
    respuesta = () => new Response(JSON.stringify({ ok: true, retiro: { id: "r1", beneficiarioNombre: "Mozo Carlos", valorComercial: 4000, cantidadLineas: 2 } }), { status: 201 })
    await click($("retiro-reintentar"))
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

  test("respuesta perdida: el intento queda guardado; al volver a montar (reapertura o recarga) se reenvía igual y con la misma clave", async () => {
    const primera = await render()
    await click($("retiro-confirmo"))
    respuesta = () => { throw new TypeError("Failed to fetch") }
    await click($("retiro-confirmar"))
    expect(primera.registrados).toHaveLength(0)
    const guardado = readPendingRetiro(SCOPE)!
    expect(guardado.key).toBe(posts[0].key as string)
    expect(guardado.canonical).toBe(JSON.stringify(posts[0].body))
    expect(window.sessionStorage.getItem(`deligo:caja:retiro-attempt:v1:${SCOPE}`)).not.toMatch(/costo|password|token|cookie/i)
    await act(async () => primera.root.unmount())
    document.body.innerHTML = ""
    // otro carrito en pantalla: el reintento usa SIEMPRE el contenido original
    const segunda = await render([{ productoId: "otro", nombre: "Otro", precio: 1, cantidad: 9 }])
    expect($("retiro-pendiente")).not.toBeNull()
    expect($("retiro-confirmar")).toBeNull() // no se puede editar un intento incierto
    respuesta = () => new Response(JSON.stringify({ ok: true, retiro: { id: "r9", beneficiarioNombre: "Cajera Ana", valorComercial: 4000, cantidadLineas: 2 } }), { status: 200, headers: { "Idempotency-Replayed": "true" } })
    await click($("retiro-reintentar"))
    expect(posts).toHaveLength(2)
    expect([posts[1].key, JSON.stringify(posts[1].body)]).toEqual([posts[0].key, guardado.canonical])
    expect(segunda.registrados).toEqual([{ id: "r9", replayed: true }])
    expect(readPendingRetiro(SCOPE)).toBeNull()
  })

  test("un rechazo definitivo (no de sesión) de un intento pendiente lo descarta y vuelve al formulario editable", async () => {
    await render()
    await click($("retiro-confirmo"))
    respuesta = () => new Response("{}", { status: 502 })
    await click($("retiro-confirmar"))
    expect(readPendingRetiro(SCOPE)).not.toBeNull()
    respuesta = () => new Response(JSON.stringify({ ok: false, error: "No hay stock suficiente", code: "STOCK_INSUFFICIENT" }), { status: 409 })
    await click($("retiro-reintentar"))
    expect(readPendingRetiro(SCOPE)).toBeNull()
    expect($("retiro-confirmar")).not.toBeNull()
    expect(document.body.textContent).toContain("No hay stock suficiente")
  })

  for (const status of [401, 403]) {
    test(`reintento de un intento incierto rechazado con ${status} (sesión vencida o permiso revocado): el intento se CONSERVA`, async () => {
      await render()
      await click($("retiro-confirmo"))
      respuesta = () => { throw new TypeError("Failed to fetch") }
      await click($("retiro-confirmar"))
      const guardado = readPendingRetiro(SCOPE)!
      respuesta = () => new Response(JSON.stringify({ ok: false, error: "Acceso no disponible" }), { status })
      await click($("retiro-reintentar"))
      expect(readPendingRetiro(SCOPE)?.key).toBe(guardado.key)
      expect($("retiro-pendiente")).not.toBeNull()
      expect(document.body.textContent).toContain("la sesión venció o el permiso cambió")
      // con la sesión recuperada, el mismo intento se resuelve con la misma clave y el mismo contenido
      respuesta = () => new Response(JSON.stringify({ ok: true, retiro: { id: "r1", beneficiarioNombre: "Cajera Ana", valorComercial: 4000, cantidadLineas: 2 } }), { status: 200, headers: { "Idempotency-Replayed": "true" } })
      await click($("retiro-reintentar"))
      expect(posts.map((x) => x.key)).toEqual([guardado.key, guardado.key, guardado.key])
      expect(posts.every((x) => JSON.stringify(x.body) === guardado.canonical)).toBe(true)
      expect(readPendingRetiro(SCOPE)).toBeNull()
    })
  }

  test("un 403 en el PRIMER envío es un rechazo definitivo: no queda ningún intento pendiente", async () => {
    await render()
    await click($("retiro-confirmo"))
    respuesta = () => new Response(JSON.stringify({ ok: false, error: "No tenés permiso para registrar retiros personales.", code: "RETIRO_NO_HABILITADO" }), { status: 403 })
    await click($("retiro-confirmar"))
    expect(readPendingRetiro(SCOPE)).toBeNull()
    expect($("retiro-pendiente")).toBeNull()
    expect(document.body.textContent).toContain("No tenés permiso")
  })

  test("descartar un intento incierto exige una segunda confirmación que advierte que podría estar registrado", async () => {
    const vista = await render()
    await click($("retiro-confirmo"))
    respuesta = () => new Response("{}", { status: 503 })
    await click($("retiro-confirmar"))
    await click($("retiro-descartar"))
    expect(readPendingRetiro(SCOPE)).not.toBeNull() // el primer toque sólo muestra el aviso
    expect($("retiro-descartar-aviso")!.textContent).toContain("podría estar registrado")
    expect($("retiro-descartar-aviso")!.textContent).toContain("verificá")
    await click([...$("retiro-descartar-aviso")!.querySelectorAll("button")].find((b) => b.textContent === "Volver") as HTMLElement)
    expect($("retiro-descartar-aviso")).toBeNull()
    expect(readPendingRetiro(SCOPE)).not.toBeNull()
    await click($("retiro-descartar"))
    await click($("retiro-descartar-confirmar"))
    expect(readPendingRetiro(SCOPE)).toBeNull()
    expect(vista.cerrado()).toBe(true)
  })

  test("los intentos se aíslan por negocio y contexto operativo; un registro inválido se ignora", () => {
    writePendingRetiro("operativo:e1:n1", { key: "8f14e45f-ceea-4e6b-9c2a-1a2b3c4d5e6f", canonical: JSON.stringify({ confirmado: true, items: [] }), cart: [cart[0]], beneficiarioNombre: "Ana", createdAt: 1 })
    expect(readPendingRetiro("operativo:e1:n1")?.beneficiarioNombre).toBe("Ana")
    expect(readPendingRetiro("operativo:e2:n1")).toBeNull()
    expect(readPendingRetiro("n1")).toBeNull()
    window.sessionStorage.setItem("deligo:caja:retiro-attempt:v1:roto", JSON.stringify({ key: "no-uuid", canonical: "{}", cart: [] }))
    expect(readPendingRetiro("roto")).toBeNull()
  })
})
