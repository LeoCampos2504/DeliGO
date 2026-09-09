// ============================================
// P2-T32 — AddressForm: autoridad única de formulario/lógica de dirección
// ============================================
// Render real (happy-dom + react-dom/client, mismo patrón ya usado por
// product-image-gallery.test.tsx en este repo) del componente compartido
// que Perfil y el modal de checkout instancian. El mapa (AddressMapPicker,
// Leaflet real) se mockea para mantener el test focal en la lógica propia
// de AddressForm (validación, payload, submit, double-submit guard, modo
// edición) — Leaflet/GPS ya tienen su propia superficie de prueba fuera
// de este archivo y renderizar un mapa real dentro de happy-dom sería
// frágil sin aportar valor a lo que este archivo prueba.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

mock.module("@/components/location/address-map-picker", () => ({
  AddressMapPicker: (props: {
    onCoordsChange: (lat: number, lng: number) => void
    onDireccionChange: (dir: string) => void
  }) => {
    const React = require("react")
    return React.createElement(
      "div",
      { "data-testid": "mock-address-map-picker" },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            props.onCoordsChange(-26.1856, -58.1732)
            props.onDireccionChange("Calle Falsa 123, Barrio Test")
          },
        },
        "Simular selección de mapa"
      )
    )
  },
}))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { AddressForm } = await import("./address-form")
const { act } = React

const originalFetch = globalThis.fetch

function mockFetchOnce(status: number, body: unknown) {
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch
}

let cleanup: (() => void) | null = null

function renderForm(props: Partial<React.ComponentProps<typeof AddressForm>> & { mode: "create" | "edit" }) {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })

  act(() => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(AddressForm, {
          onSuccess: () => {},
          onCancel: () => {},
          ...props,
        } as React.ComponentProps<typeof AddressForm>)
      )
    )
  })

  cleanup = () => {
    act(() => root.unmount())
    host.remove()
  }
  return host
}

async function flush() {
  // Deja resolver las promesas de fetch/useMutation pendientes.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

// El botón del mock de mapa ("Simular selección de mapa") renderiza ANTES
// que el submit real en el DOM — nunca usar querySelector("button") a
// secas para el submit, siempre ubicarlo por su texto real.
function submitButton(host: HTMLElement): HTMLButtonElement {
  const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
  const found = buttons.find((b) => /Agregar dirección|Agregando\.\.\.|Guardar cambios|Guardando\.\.\./.test(b.textContent ?? ""))
  if (!found) throw new Error("Missing submit button")
  return found
}

// React trackea el valor previo de un input controlado en una propiedad
// oculta del propio nodo DOM — asignar `.value` directamente y disparar
// "input" no alcanza a notificar a React. Hay que pasar por el setter
// nativo, igual que haría un usuario real tipeando.
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  (globalThis as unknown as { HTMLInputElement: { prototype: HTMLInputElement } }).HTMLInputElement.prototype,
  "value"
)!.set!

function setInputValue(input: HTMLInputElement, value: string) {
  nativeInputValueSetter.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  globalThis.fetch = originalFetch
})

describe("P2-T32 — AddressForm (autoridad única de dirección)", () => {
  test("renderiza alias, dirección y referencia — el mismo contrato de campos sin importar quién lo instancia", () => {
    const host = renderForm({ mode: "create" })
    expect(host.querySelector('input[placeholder="Ej: Casa, Trabajo..."]')).not.toBeNull()
    expect(host.querySelector('input[placeholder="Calle, número, barrio..."]')).not.toBeNull()
    expect(host.querySelector('input[placeholder="Piso, depto, entre calles..."]')).not.toBeNull()
    expect(host.querySelector('[data-testid="mock-address-map-picker"]')).not.toBeNull()
  })

  test("alias vacío bloquea el submit con un error visible, sin llamar a fetch", async () => {
    let fetchCalled = false
    globalThis.fetch = (async () => {
      fetchCalled = true
      return new Response(JSON.stringify({ ok: true }), { status: 201 })
    }) as typeof fetch

    const host = renderForm({ mode: "create" })
    const submit = submitButton(host)
    act(() => submit.click())
    await flush()

    expect(fetchCalled).toBe(false)
    expect(host.textContent).toContain("El alias es obligatorio")
  })

  test("sin dirección de texto NI coordenadas -> bloquea el submit (coords o texto, al menos uno)", async () => {
    const host = renderForm({ mode: "create" })
    const aliasInput = host.querySelector<HTMLInputElement>('input[placeholder="Ej: Casa, Trabajo..."]')!
    act(() => setInputValue(aliasInput, "Casa"))
    const submit = submitButton(host)
    act(() => submit.click())
    await flush()

    expect(host.textContent).toContain("Ingresá una dirección o seleccioná la ubicación en el mapa")
  })

  test("crea correctamente con alias + ubicación de mapa — payload exacto vía POST, alias siempre incluido (paridad checkout/perfil)", async () => {
    let capturedBody: Record<string, unknown> | null = null
    let capturedMethod: string | null = null
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedMethod = init?.method ?? null
      capturedBody = JSON.parse(String(init?.body))
      return new Response(
        JSON.stringify({ ok: true, direccion: { id: "dir-1", ...capturedBody } }),
        { status: 201 }
      )
    }) as typeof fetch

    let created: { id: string } | null = null
    const host = renderForm({ mode: "create", onSuccess: (d) => { created = d } })

    const aliasInput = host.querySelector<HTMLInputElement>('input[placeholder="Ej: Casa, Trabajo..."]')!
    act(() => setInputValue(aliasInput, "Casa"))

    const mapButton = host.querySelector<HTMLButtonElement>('[data-testid="mock-address-map-picker"] button')!
    act(() => mapButton.click())

    const submit = submitButton(host)
    act(() => submit.click())
    await flush()

    expect(capturedMethod).toBe("POST")
    expect(capturedBody).not.toBeNull()
    expect((capturedBody as unknown as { alias: string }).alias).toBe("Casa")
    expect((capturedBody as unknown as { lat: number }).lat).toBe(-26.1856)
    expect((capturedBody as unknown as { lng: number }).lng).toBe(-58.1732)
    expect(created).not.toBeNull()
    expect((created as unknown as { id: string })?.id).toBe("dir-1")
  })

  test("modo edición: precarga los valores existentes y envía PUT con el id correcto", async () => {
    let capturedMethod: string | null = null
    let capturedBody: Record<string, unknown> | null = null
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedMethod = init?.method ?? null
      capturedBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ ok: true, direccion: { id: "dir-existing", ...capturedBody } }), { status: 200 })
    }) as typeof fetch

    const host = renderForm({
      mode: "edit",
      addressId: "dir-existing",
      initialValues: { alias: "Trabajo", direccion: "Av. Siempre Viva 742", referencia: "", lat: -26.2, lng: -58.2 },
    })

    const aliasInput = host.querySelector<HTMLInputElement>('input[placeholder="Ej: Casa, Trabajo..."]') as HTMLInputElement
    expect(aliasInput.value).toBe("Trabajo")
    const direccionInput = host.querySelector<HTMLInputElement>('input[placeholder="Calle, número, barrio..."]') as HTMLInputElement
    expect(direccionInput.value).toBe("Av. Siempre Viva 742")

    const submit = submitButton(host)
    expect(submit.textContent).toContain("Guardar cambios")
    act(() => submit.click())
    await flush()

    expect(capturedMethod).toBe("PUT")
    expect((capturedBody as unknown as { id: string })?.id).toBe("dir-existing")
  })

  test("double-submit: el botón se deshabilita mientras la mutación está pendiente (nunca dos creaciones por doble tap)", async () => {
    let fetchCallCount = 0
    let resolveFetch: (() => void) | null = null
    globalThis.fetch = (() => {
      fetchCallCount += 1
      return new Promise<Response>((resolve) => {
        resolveFetch = () => resolve(new Response(JSON.stringify({ ok: true, direccion: { id: "dir-1" } }), { status: 201 }))
      })
    }) as typeof fetch

    const host = renderForm({ mode: "create" })
    const aliasInput = host.querySelector<HTMLInputElement>('input[placeholder="Ej: Casa, Trabajo..."]')!
    act(() => setInputValue(aliasInput, "Casa"))
    const mapButton = host.querySelector<HTMLButtonElement>('[data-testid="mock-address-map-picker"] button')!
    act(() => mapButton.click())

    const submit = submitButton(host)
    act(() => submit.click())
    await flush()
    // Segundo tap mientras la primera mutación sigue pendiente (fetch no resuelto todavía)
    act(() => submit.click())
    await flush()

    expect(fetchCallCount).toBe(1) // el segundo tap no disparó un segundo fetch
    expect(submit.disabled).toBe(true)

    resolveFetch?.()
    await flush()
  })

  test("error del servidor: el formulario permanece montado con el mensaje visible (nunca se cierra solo)", async () => {
    mockFetchOnce(400, { error: "La dirección o las coordenadas son obligatorias" })

    const host = renderForm({ mode: "create" })
    const aliasInput = host.querySelector<HTMLInputElement>('input[placeholder="Ej: Casa, Trabajo..."]')!
    act(() => setInputValue(aliasInput, "Casa"))
    const mapButton = host.querySelector<HTMLButtonElement>('[data-testid="mock-address-map-picker"] button')!
    act(() => mapButton.click())

    const submit = submitButton(host)
    act(() => submit.click())
    await flush()

    expect(host.textContent).toContain("La dirección o las coordenadas son obligatorias")
    // El formulario sigue en el DOM (no se desmontó ni se llamó onCancel/onSuccess)
    expect(host.querySelector('input[placeholder="Ej: Casa, Trabajo..."]')).not.toBeNull()
  })

  test("cancelar no dispara ningún fetch", () => {
    let fetchCalled = false
    globalThis.fetch = (async () => { fetchCalled = true; return new Response("{}") }) as typeof fetch

    let cancelled = false
    const host = renderForm({ mode: "create", onCancel: () => { cancelled = true } })
    const buttons = host.querySelectorAll("button")
    const cancelButton = Array.from(buttons).find((b) => b.textContent?.includes("Cancelar"))!
    act(() => cancelButton.click())

    expect(cancelled).toBe(true)
    expect(fetchCalled).toBe(false)
  })
})
