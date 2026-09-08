// P2-T31-R23A — reproduce, con un ciclo de commit de React real (happy-dom +
// react-dom/client, mismo patrón que use-repartidor-tracking.test.ts /
// auth-store.test.ts), la carrera probada en
// P2_T31_R23_CHAT_PUSH_NOTIFICATION_TAP_DEEPLINK_ROOT_CAUSE_AUDIT.md:
// `useChatDeepLink` leía `isAuthenticated()`/`userType()` de un store
// Zustand `persist` (hidratación asíncrona por diseño) sin esperar
// `_hasHydrated` y sin ningún reintento — en un arranque en frío, esto
// podía descartar el deep-link `?chat=<pedidoId>` para siempre, en
// silencio. El fix agrega `authHasHydrated` a las dependencias del efecto
// para que se re-evalúe exactamente cuando la hidratación termina.
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { useChatDeepLink } = await import("./chat-provider")
const { useChatStore } = await import("@/store/chat-store")
const { useAuthStore } = await import("@/store/auth-store")

const { act } = React

function setUrl(pathAndQuery: string) {
  ;(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
    `http://localhost${pathAndQuery}`
  )
}

function createHarness() {
  const hostDiv = document.createElement("div")
  document.body.appendChild(hostDiv)
  const root = createRoot(hostDiv)

  function Harness() {
    useChatDeepLink()
    return null
  }

  function mount() {
    act(() => {
      root.render(React.createElement(Harness))
    })
  }

  function unmount() {
    act(() => {
      root.unmount()
    })
    hostDiv.remove()
  }

  return { mount, unmount }
}

function chatState() {
  const s = useChatStore.getState()
  return { isSheetOpen: s.isSheetOpen, activePedidoId: s.activePedidoId }
}

function setAuth(user: { id: string; type: string; nombre: string } | null, hydrated: boolean) {
  useAuthStore.setState({ user: user as never, _hasHydrated: hydrated })
}

const NEGOCIO_USER = { id: "negocio-1", type: "negocio", nombre: "Negocio Uno" }
const CLIENTE_USER = { id: "cliente-1", type: "cliente", nombre: "Cliente Uno" }
const SUPERADMIN_USER = { id: "admin-1", type: "superadmin", nombre: "Admin" }

beforeEach(() => {
  useChatStore.getState().reset()
  setAuth(null, false)
})

afterEach(() => {
  localStorage.clear()
})

describe("P2-T31-R23A — la carrera de hidratación de auth ya NO descarta el deep-link ?chat=", () => {
  test("R23_AUTH_HYDRATION_RACE_REPRO: arranque en frío (sin hidratar) NO abre el chat; al completar la hidratación (Negocio), abre exactamente una vez y limpia el query param", () => {
    setUrl("/negocio?chat=pedido-r23")
    const harness = createHarness()

    // Momento del montaje: exactamente como un arranque en frío real —
    // el store de auth Zustand `persist` todavía no terminó de hidratarse.
    harness.mount()

    // R23_AUTH_HYDRATION_RACE_REPRO_BEFORE=FAIL_EXPECTED (comportamiento
    // histórico pre-fix: sin el trigger de hidratación, esto se quedaba
    // así para siempre)
    expect(chatState()).toEqual({ isSheetOpen: false, activePedidoId: null })
    expect(window.location.search).toBe("?chat=pedido-r23")

    // La hidratación del store de auth termina (Negocio autenticado).
    act(() => {
      setAuth(NEGOCIO_USER, true)
    })

    // R23_AUTH_HYDRATION_RACE_REPRO_AFTER=PASS
    expect(chatState()).toEqual({ isSheetOpen: true, activePedidoId: "pedido-r23" })
    expect(window.location.search).toBe("")

    harness.unmount()
  })

  test("A. auth ya hidratado ANTES del montaje + Negocio autenticado + ?chat=abc -> abre inmediatamente", () => {
    setAuth(NEGOCIO_USER, true)
    setUrl("/negocio?chat=abc")
    const harness = createHarness()
    harness.mount()

    expect(chatState()).toEqual({ isSheetOpen: true, activePedidoId: "abc" })
    expect(window.location.search).toBe("")
    harness.unmount()
  })

  test("B. auth inicialmente no hidratado -> hidrata Negocio -> abre EXACTAMENTE una vez (no doble apertura)", () => {
    setUrl("/negocio?chat=solo-una-vez")
    const harness = createHarness()
    harness.mount()
    expect(chatState().isSheetOpen).toBe(false)

    act(() => setAuth(NEGOCIO_USER, true))
    expect(chatState()).toEqual({ isSheetOpen: true, activePedidoId: "solo-una-vez" })

    // Cerrar la sheet manualmente (como haría el usuario) y disparar un
    // segundo evento que antes también gatillaba consumeChatParam() — no
    // debe reabrir porque el query param ya fue consumido/eliminado.
    act(() => useChatStore.getState().setSheetOpen(false))
    act(() => window.dispatchEvent(new Event("focus")))
    expect(chatState()).toEqual({ isSheetOpen: false, activePedidoId: "solo-una-vez" })

    harness.unmount()
  })

  test("C. auth inicialmente no hidratado -> hidrata Cliente -> abre exactamente una vez (misma ruta, dirección Negocio->Cliente)", () => {
    setUrl("/cliente/?chat=nego-a-cliente")
    const harness = createHarness()
    harness.mount()
    expect(chatState().isSheetOpen).toBe(false)

    act(() => setAuth(CLIENTE_USER, true))
    expect(chatState()).toEqual({ isSheetOpen: true, activePedidoId: "nego-a-cliente" })
    expect(window.location.search).toBe("")

    harness.unmount()
  })

  test("D. hidrata sin usuario (user=null, _hasHydrated=true) -> NO abre, y el query param NO se descarta (comportamiento seguro preservado)", () => {
    setUrl("/negocio?chat=sin-usuario")
    const harness = createHarness()
    harness.mount()

    act(() => setAuth(null, true))
    expect(chatState()).toEqual({ isSheetOpen: false, activePedidoId: null })
    // Comportamiento actual preservado: sin auth confiable, el parámetro
    // se deja intacto (permite un reintento futuro real, nunca se asume
    // "no autenticado para siempre").
    expect(window.location.search).toBe("?chat=sin-usuario")

    harness.unmount()
  })

  test("E. superadmin -> NO abre, incluso ya hidratado", () => {
    setUrl("/admin?chat=admin-no-chat")
    setAuth(SUPERADMIN_USER, true)
    const harness = createHarness()
    harness.mount()

    expect(chatState()).toEqual({ isSheetOpen: false, activePedidoId: null })
    harness.unmount()
  })

  test("F. sin ?chat= en la URL -> no hace nada, con o sin hidratación", () => {
    setUrl("/negocio?tab=pedidos")
    const harness = createHarness()
    harness.mount()
    expect(chatState()).toEqual({ isSheetOpen: false, activePedidoId: null })

    act(() => setAuth(NEGOCIO_USER, true))
    expect(chatState()).toEqual({ isSheetOpen: false, activePedidoId: null })
    expect(window.location.search).toBe("?tab=pedidos")

    harness.unmount()
  })

  test("G. un evento focus() después de ya haber consumido el deep-link no vuelve a abrir (idempotencia vía el propio query param)", () => {
    setAuth(NEGOCIO_USER, true)
    setUrl("/negocio?chat=focus-test")
    const harness = createHarness()
    harness.mount()
    expect(chatState()).toEqual({ isSheetOpen: true, activePedidoId: "focus-test" })

    act(() => useChatStore.getState().setSheetOpen(false))
    act(() => window.dispatchEvent(new Event("focus")))
    expect(chatState()).toEqual({ isSheetOpen: false, activePedidoId: "focus-test" })

    harness.unmount()
  })

  test("H. un visibilitychange después de ya haber consumido el deep-link no vuelve a abrir", () => {
    setAuth(NEGOCIO_USER, true)
    setUrl("/negocio?chat=visibility-test")
    const harness = createHarness()
    harness.mount()
    expect(chatState()).toEqual({ isSheetOpen: true, activePedidoId: "visibility-test" })

    act(() => useChatStore.getState().setSheetOpen(false))
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    expect(chatState()).toEqual({ isSheetOpen: false, activePedidoId: "visibility-test" })

    harness.unmount()
  })

  test("I. otros query params se preservan; sólo `chat` se elimina al consumir el deep-link", () => {
    setAuth(NEGOCIO_USER, true)
    setUrl("/negocio?tab=pedidos&chat=abc&foo=bar")
    const harness = createHarness()
    harness.mount()

    expect(chatState()).toEqual({ isSheetOpen: true, activePedidoId: "abc" })
    const params = new URLSearchParams(window.location.search)
    expect(params.get("chat")).toBeNull()
    expect(params.get("tab")).toBe("pedidos")
    expect(params.get("foo")).toBe("bar")

    harness.unmount()
  })
})
