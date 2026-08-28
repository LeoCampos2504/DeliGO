// P2-T18-BLOCKER-AUTH2-R8 (Phase 2) — auth-store.ts: familia activa
// (función pura, sin DOM) + persistencia namespaced por familia (localStorage
// real vía happy-dom, mismo patrón que src/hooks/use-repartidor-tracking.test.ts).
// Contrato congelado en codex-reports/archive/P2-T18-BLOCKER-AUTH2-R7.md:
// ACTIVE_FAMILY_SOURCE_OF_TRUTH=window.location.pathname,
// PHASE2_SELECTED_STORAGE_DESIGN_ID=B_FAMILY_NAMESPACED_LOCALSTORAGE_KEYS,
// PUBLIC_AUTH_STORE_SHAPE_CHANGED=NO.

import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()

afterAll(() => {
  GlobalRegistrator.unregister()
})

const { activeSessionFamily, useAuthStore } = await import("./auth-store")

function setPathname(pathname: string): void {
  ;(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
    `http://localhost${pathname}`
  )
}

function readKey(key: string): { user: { id: string; type: string } | null } | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  return (JSON.parse(raw) as { state: { user: { id: string; type: string } | null } }).state
}

describe("activeSessionFamily — función pura, sin almacenamiento ni red", () => {
  test("prefijo /cliente resuelve cliente", () => {
    expect(activeSessionFamily("/cliente")).toBe("cliente")
    expect(activeSessionFamily("/cliente/pedidos/123")).toBe("cliente")
  })

  test("prefijo /negocio resuelve negocio", () => {
    expect(activeSessionFamily("/negocio")).toBe("negocio")
    expect(activeSessionFamily("/negocio/dashboard")).toBe("negocio")
  })

  test("prefijo /repartidor resuelve repartidor", () => {
    expect(activeSessionFamily("/repartidor")).toBe("repartidor")
    expect(activeSessionFamily("/repartidor/entregas")).toBe("repartidor")
  })

  test("cualquier otro pathname (admin, raíz, desconocido) resuelve null — sin namespacing, comportamiento legacy preservado", () => {
    expect(activeSessionFamily("/admin")).toBeNull()
    expect(activeSessionFamily("/")).toBeNull()
    expect(activeSessionFamily("/operaciones")).toBeNull()
    expect(activeSessionFamily("/clientevil")).toBeNull() // boundary-safe, mismo patrón que pathFamily() server-side
  })
})

describe("persistencia namespaced por familia (localStorage real vía happy-dom)", () => {
  beforeEach(() => {
    // Orden importa: reset del store PRIMERO (su propio side-effect de
    // persist puede escribir a la clave resuelta por el pathname que haya
    // quedado de un test anterior), clear() de localStorage DESPUÉS, para
    // garantizar un estado realmente limpio antes de que el cuerpo del test
    // llame a setPathname().
    useAuthStore.setState({ user: null, _hasHydrated: false })
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  test("login Cliente en pathname /cliente escribe SÓLO deligo-auth:cliente — nunca la clave plana ni deligo-auth:negocio", () => {
    setPathname("/cliente/pedidos")
    useAuthStore.getState().loginCliente({ id: "cliente-1", nombre: "Ana", email: "ana@example.test" })

    const clienteEntry = readKey("deligo-auth:cliente")
    expect(clienteEntry?.user?.id).toBe("cliente-1")
    expect(clienteEntry?.user?.type).toBe("cliente")
    expect(localStorage.getItem("deligo-auth")).toBeNull()
    expect(localStorage.getItem("deligo-auth:negocio")).toBeNull()
  })

  test("login Negocio en pathname /negocio escribe SÓLO deligo-auth:negocio — nunca deligo-auth:cliente ya existente", () => {
    setPathname("/cliente/pedidos")
    useAuthStore.getState().loginCliente({ id: "cliente-1", nombre: "Ana", email: "ana@example.test" })

    setPathname("/negocio/dashboard")
    useAuthStore.getState().loginNegocio({
      id: "negocio-1",
      nombre: "Kiosco Don José",
      slug: "kiosco-don-jose",
      rubro: "comida",
      aprobado: true,
    })

    const negocioEntry = readKey("deligo-auth:negocio")
    expect(negocioEntry?.user?.id).toBe("negocio-1")
    expect(negocioEntry?.user?.type).toBe("negocio")

    // LOGIN_OTHER_FAMILY_STORAGE_MUTATED=NO — la entrada de Cliente escrita
    // antes sigue exactamente igual, nunca fue tocada por el login de Negocio.
    const clienteEntry = readKey("deligo-auth:cliente")
    expect(clienteEntry?.user?.id).toBe("cliente-1")
  })

  test("logout en pestaña Cliente sólo limpia deligo-auth:cliente — deligo-auth:negocio permanece intacto", () => {
    setPathname("/cliente/pedidos")
    useAuthStore.getState().loginCliente({ id: "cliente-1", nombre: "Ana", email: "ana@example.test" })

    setPathname("/negocio/dashboard")
    useAuthStore.getState().loginNegocio({
      id: "negocio-1",
      nombre: "Kiosco Don José",
      slug: "kiosco-don-jose",
      rubro: "comida",
      aprobado: true,
    })

    // Vuelve a la pestaña Cliente y desloguea sólo esa familia.
    setPathname("/cliente/pedidos")
    useAuthStore.getState().logout()

    const clienteEntry = readKey("deligo-auth:cliente")
    expect(clienteEntry?.user).toBeNull()

    const negocioEntry = readKey("deligo-auth:negocio")
    expect(negocioEntry?.user?.id).toBe("negocio-1") // OTHER_FAMILY_COOKIE_CLEARED=NO equivalente client-side
  })

  test("pathname fuera del esquema de familias (/admin) usa la clave legacy plana deligo-auth, sin namespacing — comportamiento actual preservado", () => {
    setPathname("/admin")
    useAuthStore.getState().loginSuperAdmin({ id: "superadmin-1" })

    const legacyEntry = readKey("deligo-auth")
    expect(legacyEntry?.user?.id).toBe("superadmin-1")
    expect(legacyEntry?.user?.type).toBe("superadmin")
    // Nunca namespaced — superadmin queda fuera del esquema de familias (24-A).
    expect(localStorage.getItem("deligo-auth:cliente")).toBeNull()
    expect(localStorage.getItem("deligo-auth:negocio")).toBeNull()
    expect(localStorage.getItem("deligo-auth:repartidor")).toBeNull()
  })

  test("la forma pública del store permanece user: AuthUser | null — nunca un mapa/colección por familia", () => {
    setPathname("/cliente/pedidos")
    useAuthStore.getState().loginCliente({ id: "cliente-1", nombre: "Ana", email: "ana@example.test" })

    const state = useAuthStore.getState()
    expect(state.user).not.toBeNull()
    expect(state.user).toMatchObject({ id: "cliente-1", type: "cliente", nombre: "Ana" })
    expect(state.user instanceof Map).toBe(false)
    expect(Array.isArray(state.user)).toBe(false)
    expect(typeof state.isAuthenticated).toBe("function")
    expect(state.isAuthenticated()).toBe(true)
  })
})

// P2-T18-BLOCKER-AUTH2-R9-R1 — cierra el gap de cobertura encontrado por
// mutation testing en R9 (mutante #5): los tests anteriores sólo verifican
// lo que queda escrito en localStorage tras loginX()/logout(), nunca el
// camino de LECTURA (getItem) que persist ejerce al rehidratar una pestaña
// nueva/recargada. Un getItem hardcodeado a una familia fija pasaría todos
// los tests de arriba sin ser detectado — estos dos exigen que la lectura
// real, vía useAuthStore.persist.rehydrate(), resuelva el namespace de la
// familia activa de ESTA pestaña, nunca uno fijo.
describe("rehidratación fresca por familia (getItem real vía persist.rehydrate(), no sólo lo escrito por login)", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, _hasHydrated: false })
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  function seedBothFamilyFixtures(): void {
    localStorage.setItem(
      "deligo-auth:cliente",
      JSON.stringify({ state: { user: { id: "cliente-fixture", type: "cliente", nombre: "Ana" } }, version: 1 })
    )
    localStorage.setItem(
      "deligo-auth:negocio",
      JSON.stringify({ state: { user: { id: "negocio-fixture", type: "negocio", nombre: "Kiosco Don José" } }, version: 1 })
    )
  }

  test("rehidratar en pathname /cliente lee deligo-auth:cliente, nunca deligo-auth:negocio (Escenario A)", async () => {
    seedBothFamilyFixtures()
    setPathname("/cliente/pedidos")

    await useAuthStore.persist.rehydrate()

    const user = useAuthStore.getState().user
    expect(user?.id).toBe("cliente-fixture")
    expect(user?.type).toBe("cliente")
    expect(user?.id).not.toBe("negocio-fixture")
  })

  test("rehidratar en pathname /negocio lee deligo-auth:negocio, nunca deligo-auth:cliente (Escenario B, mismos fixtures que el Escenario A)", async () => {
    seedBothFamilyFixtures()
    setPathname("/negocio/dashboard")

    await useAuthStore.persist.rehydrate()

    const user = useAuthStore.getState().user
    expect(user?.id).toBe("negocio-fixture")
    expect(user?.type).toBe("negocio")
    expect(user?.id).not.toBe("cliente-fixture")
  })
})
