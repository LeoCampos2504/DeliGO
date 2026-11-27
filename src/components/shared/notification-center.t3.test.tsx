// T3-02 — consultas automáticas de la campana (happy-dom + React Query REAL; sólo `fetch` y el router simulados).
// Cubre: autenticación no resuelta, sesión válida, logout, cambio de actor, respuesta tardía del actor anterior,
// refetch al recuperar el foco y freno ante 401. Módulos reemplazados → proceso propio en CI.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

mock.module("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { QueryClient, QueryClientProvider, focusManager } = await import("@tanstack/react-query")
const { NotificationBell } = await import("./notification-center")
const { useAuthStore } = await import("@/store/auth-store")
const { useNotificationStore } = await import("@/store/notification-store")
const originalFetch = globalThis.fetch

type Pending = { url: string; resolve: (r: Response) => void }
let calls: string[] = []
let pending: Pending[] = []
let responder: ((url: string) => Response | null) | null = null

beforeEach(() => {
  calls = []
  pending = []
  responder = null
  useAuthStore.setState({ user: null, _hasHydrated: true })
  useNotificationStore.setState({ noLeidos: 0, isOpen: false })
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    const immediate = responder?.(url) ?? null
    if (immediate) return Promise.resolve(immediate)
    return new Promise<Response>((resolve) => pending.push({ url, resolve }))
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

async function flush(ms = 30) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

async function render(props: { operational?: boolean } = {}) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(QueryClientProvider, { client }, React.createElement(NotificationBell, props)))
  })
  await flush()
  return { root, client }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const unread = () => calls.filter((u) => u.includes("unread=true"))
const owner = (id: string) => ({ id, type: "negocio" as const, nombre: `Dueño ${id}` })

async function refocus() {
  await act(async () => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  await flush()
}

describe("T3-02 — campana: consultas sólo con un actor resuelto y ligadas a ese actor", () => {
  test("autenticación no resuelta (sin usuario en la pestaña): ninguna consulta", async () => {
    const { root } = await render()
    await refocus()
    expect(calls).toEqual([])
    await act(async () => root.unmount())
  })

  test("sesión válida del dueño: declara su familia, refetch al recuperar el foco; el logout detiene todo", async () => {
    responder = () => json({ noLeidos: 3 })
    useAuthStore.setState({ user: owner("neg-a") })
    const { root } = await render()
    expect(unread()).toEqual(["/api/notificaciones?feed=cuenta&actorFamily=negocio&limit=1&unread=true"])
    expect(useNotificationStore.getState().noLeidos).toBe(3)

    await refocus()
    expect(unread().length).toBe(2)

    await act(async () => useAuthStore.setState({ user: null }))
    await flush()
    const antes = calls.length
    await refocus()
    expect(calls.length).toBe(antes)
    expect(useNotificationStore.getState().noLeidos).toBe(0)
    await act(async () => root.unmount())
  })

  test("401 definitivo: no reintenta, no vuelve a consultar al recuperar el foco y limpia el contador", async () => {
    useNotificationStore.setState({ noLeidos: 7 })
    responder = () => json({ error: "No autenticado" }, 401)
    useAuthStore.setState({ user: owner("neg-a") })
    const { root } = await render()
    await flush(60)
    expect(unread().length).toBe(1)
    expect(useNotificationStore.getState().noLeidos).toBe(0)
    await refocus()
    await refocus()
    expect(unread().length).toBe(1)

    // Un actor nuevo vuelve a consultar con SU propia clave.
    responder = () => json({ noLeidos: 1 })
    await act(async () => useAuthStore.setState({ user: owner("neg-b") }))
    await flush()
    expect(unread().length).toBe(2)
    expect(useNotificationStore.getState().noLeidos).toBe(1)
    await act(async () => root.unmount())
  })

  test("cambio de actor: la respuesta tardía del actor anterior nunca se muestra para el actual", async () => {
    useAuthStore.setState({ user: owner("neg-a") })
    const { root } = await render()
    expect(pending.length).toBe(1)
    const tardiaA = pending[0]

    await act(async () => useAuthStore.setState({ user: owner("neg-b") }))
    await flush()
    expect(pending.length).toBe(2)
    const respuestaB = pending[1]

    await act(async () => respuestaB.resolve(json({ noLeidos: 2 })))
    await flush()
    expect(useNotificationStore.getState().noLeidos).toBe(2)

    // A responde DESPUÉS (datos de otra sesión): queda bajo la clave de A, el contador sigue siendo el de B.
    await act(async () => tardiaA.resolve(json({ noLeidos: 99 })))
    await flush()
    expect(useNotificationStore.getState().noLeidos).toBe(2)
    await act(async () => root.unmount())
  })

  test("campana operativa: feed del empleado, sin selector de familia personal", async () => {
    responder = () => json({ noLeidos: 0 })
    useAuthStore.setState({ user: owner("neg-a") })
    const { root } = await render({ operational: true })
    expect(unread()).toEqual(["/api/notificaciones?feed=operativo&limit=1&unread=true"])
    await act(async () => root.unmount())
  })

  test("pestaña de otro tipo de actor (SuperAdmin en la store): la campana personal no consulta", async () => {
    useAuthStore.setState({ user: { id: "sa", type: "superadmin", nombre: "SuperAdmin" } })
    const { root } = await render()
    expect(calls).toEqual([])
    await act(async () => root.unmount())
  })
})
