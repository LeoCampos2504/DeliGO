import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { OwnerCajaRecuperacion, tiempoTranscurrido } = await import("./owner-caja-recuperacion")
const originalFetch = globalThis.fetch
let responses: Array<{ status: number; body: Record<string, unknown> } | "network"> = []
const posts: Array<{ key: string | null; body: Record<string, unknown> }> = []
let notices: string[] = []

beforeEach(() => {
  responses = []
  posts.length = 0
  notices = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/recuperacion") && init?.method === "POST") {
      posts.push({ key: new Headers(init.headers).get("Idempotency-Key"), body: JSON.parse(String(init.body)) })
      const next = responses.shift() ?? { status: 201, body: { ok: true, turno: { id: "turno-g", diferencia: -1000 } } }
      if (next === "network") throw new TypeError("network lost")
      await new Promise((resolve) => setTimeout(resolve, 10))
      return new Response(JSON.stringify(next.body), { status: next.status })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function render() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <OwnerCajaRecuperacion negocioId="neg-1" registerQueryKey={["registers", "neg-1"]} caja={{ id: "caja-1", nombre: "Caja principal" }}
        turno={{ id: "turno-g", responsableNombre: "Cristian", abiertoEn: new Date(Date.now() - 3 * 3_600_000).toISOString(), fondoInicial: 5000, cantidadVentas: 2, ultimaVentaEn: new Date().toISOString() }}
        onRecovered={(message) => notices.push(message)} />
    </QueryClientProvider>
  ))
  await flush()
  return root
}
const button = (text: string) => [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(text)) as HTMLButtonElement | undefined
async function type(selector: string, value: string) {
  const input = document.querySelector(selector) as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function fillForm(amount = "24000", reason = "El empleado se retiró sin cerrar") {
  await act(async () => button("Recuperar turno")!.click())
  await type("#recuperar-contado-turno-g", amount)
  await type("#recuperar-motivo-turno-g", reason)
  await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click())
}

describe("F10-B2.2-G — owner recovery form", () => {
  test("shows the open shift, requires count + reason + confirmation, never pre-fills the count", async () => {
    const root = await render()
    expect(document.body.textContent).toContain("2 ventas")
    expect(document.body.textContent).toContain("3 h 0 min")
    await act(async () => button("Recuperar turno")!.click())
    expect(document.body.textContent).toContain("Recuperar turno — Caja principal")
    expect(document.body.textContent).toContain("Responsable original: Cristian")
    expect(document.body.textContent).toContain("El historial de ventas y el responsable original permanecerán registrados")
    expect(document.body.textContent).toContain("podría seguir operando")
    expect((document.querySelector("#recuperar-contado-turno-g") as HTMLInputElement).value).toBe("")
    expect(button("Confirmar recuperación")!.disabled).toBe(true)
    await type("#recuperar-contado-turno-g", "24000")
    expect(button("Confirmar recuperación")!.disabled).toBe(true)
    await type("#recuperar-motivo-turno-g", "Se retiró")
    expect(button("Confirmar recuperación")!.disabled).toBe(true)
    await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click())
    expect(button("Confirmar recuperación")!.disabled).toBe(false)
    await type("#recuperar-contado-turno-g", "-5")
    expect(button("Confirmar recuperación")!.disabled).toBe(true)
    expect(posts).toHaveLength(0)
    await act(async () => root.unmount())
  })

  test("the form keeps only count, reason and confirmation, with stacked full-width actions that cannot overflow", async () => {
    const root = await render()
    await act(async () => button("Recuperar turno")!.click())
    const form = document.querySelector("form") as HTMLFormElement
    expect([...form.querySelectorAll("input")].map((input) => input.type || "text")).toEqual(["text", "text", "checkbox"])
    expect(form.querySelector("#recuperar-contado-turno-g")).toBeTruthy()
    expect(form.querySelector("#recuperar-motivo-turno-g")).toBeTruthy()
    expect(form.textContent).not.toMatch(/entregado|remanente|destino|observación administrativa/i)
    const actions = form.querySelector('[data-testid="recuperacion-acciones"]') as HTMLDivElement
    expect(actions.className).toContain("flex-col")
    expect(actions.className).not.toContain("grid-cols-2")
    const [confirm, cancel] = [...actions.querySelectorAll("button")] as HTMLButtonElement[]
    expect(confirm.type).toBe("submit")
    expect(confirm.getAttribute("aria-label")).toBe("Confirmar recuperación del turno")
    expect(confirm.textContent).toBe("Confirmar recuperación")
    for (const cls of ["w-full", "whitespace-normal", "h-auto", "min-h-11"]) expect(confirm.className).toContain(cls)
    expect(cancel.textContent).toBe("Cancelar")
    expect(cancel.className).toContain("w-full")
    for (const id of ["#recuperar-contado-turno-g", "#recuperar-motivo-turno-g"]) {
      const cls = (form.querySelector(id) as HTMLInputElement).className
      expect(cls).toContain("w-full")
      expect(cls).toContain("min-w-0")
    }
    await act(async () => root.unmount())
  })

  test("success is unequivocal: one request on double click, notice shown and form closed", async () => {
    const root = await render()
    await fillForm()
    const submit = button("Confirmar recuperación")!
    await act(async () => { submit.click(); submit.click() })
    await flush()
    expect(posts).toHaveLength(1)
    expect(posts[0].key).toBeTruthy()
    expect(posts[0].body).toEqual({ cajaFisicaId: "caja-1", efectivoContado: "24000", motivo: "El empleado se retiró sin cerrar", confirmo: true })
    expect(notices.at(-1)).toContain("Turno recuperado correctamente")
    expect(document.querySelector("form")).toBeNull()
    expect(button("Recuperar turno")).toBeTruthy()
    await act(async () => root.unmount())
  })

  test("a server error keeps the form and its data, and the retry reuses the same key", async () => {
    responses = [{ status: 500, body: { ok: false, error: "internal" } }]
    const root = await render()
    await fillForm()
    await act(async () => button("Confirmar recuperación")!.click())
    await flush()
    expect(document.body.textContent).toContain("No pudimos recuperar el turno por un error del servidor")
    expect(document.body.textContent).not.toContain("internal")
    expect((document.querySelector("#recuperar-contado-turno-g") as HTMLInputElement).value).toBe("24000")
    expect((document.querySelector("#recuperar-motivo-turno-g") as HTMLInputElement).value).toBe("El empleado se retiró sin cerrar")
    await act(async () => button("Confirmar recuperación")!.click())
    await flush()
    expect(posts).toHaveLength(2)
    expect(posts[1].key).toBe(posts[0].key)
    expect(notices.at(-1)).toContain("Turno recuperado correctamente")
    await act(async () => root.unmount())
  })

  test("a shift already closed elsewhere is explained and the panel is refreshed", async () => {
    responses = [{ status: 409, body: { ok: false, error: "El turno ya fue cerrado.", code: "TURNO_NO_ABIERTO" } }]
    const root = await render()
    await fillForm()
    await act(async () => button("Confirmar recuperación")!.click())
    await flush()
    expect(document.body.textContent).toContain("El turno ya fue cerrado (por el empleado u otra recuperación)")
    expect(notices.at(-1)).toContain("El turno ya fue cerrado")
    expect(notices.some((notice) => notice.includes("recuperado correctamente"))).toBe(false)
    await act(async () => root.unmount())
  })

  test("elapsed time is formatted without inventing activity", () => {
    const now = Date.parse("2026-10-16T12:00:00.000Z")
    expect(tiempoTranscurrido("2026-10-16T11:35:00.000Z", now)).toBe("25 min")
    expect(tiempoTranscurrido("2026-10-16T08:00:00.000Z", now)).toBe("4 h 0 min")
    expect(tiempoTranscurrido("2026-10-14T10:00:00.000Z", now)).toBe("2 días 2 h")
  })
})
