// P2-T49-R1B: contrato puro del gate de montaje del Chat personal global
// (ChatFab + ChatSheet) — reproduce el finding físico del operador (burbuja
// naranja de Chat Cliente visible dentro de Terminal Operaciones/PyR) y
// confirma que la exclusión cubre TODA la superficie /operaciones/**, sin
// afectar ninguna ruta personal real. Función pura, sin montar React —
// ChatProvider en sí sigue llamando los hooks siempre (Reglas de los
// Hooks), sólo el render de ChatFab/ChatSheet queda gateado por esto.
import { describe, expect, test } from "bun:test"
import { shouldMountGlobalChat } from "./chat-provider"

describe("P2-T49-R1B — shouldMountGlobalChat: límite de rutas Operaciones/Terminal", () => {
  test("/operaciones (home Terminal) => NO", () => {
    expect(shouldMountGlobalChat("/operaciones")).toBe(false)
  })

  test("/operaciones/pyr (panel Terminal) => NO", () => {
    expect(shouldMountGlobalChat("/operaciones/pyr")).toBe(false)
  })

  test("/operaciones/pyr/mensajes/test (chat dedicado Terminal) => NO", () => {
    expect(shouldMountGlobalChat("/operaciones/pyr/mensajes/test")).toBe(false)
  })

  test("/operaciones/mi-panel/test/pyr (panel personal de cuenta operativa) => NO", () => {
    expect(shouldMountGlobalChat("/operaciones/mi-panel/test/pyr")).toBe(false)
  })

  test("/operaciones/salon => NO", () => {
    expect(shouldMountGlobalChat("/operaciones/salon")).toBe(false)
  })

  test("/operaciones/terminal => NO", () => {
    expect(shouldMountGlobalChat("/operaciones/terminal")).toBe(false)
  })
})

describe("P2-T49-R1B — shouldMountGlobalChat: rutas ya excluidas antes (sin cambio de comportamiento)", () => {
  test("/mozo => NO (preexistente)", () => {
    expect(shouldMountGlobalChat("/mozo")).toBe(false)
  })

  test("/mozo/panel/negocio => NO (preexistente)", () => {
    expect(shouldMountGlobalChat("/mozo/panel/negocio")).toBe(false)
  })
})

describe("P2-T49-R1B — shouldMountGlobalChat: rutas personales preservadas", () => {
  test("/cliente/ => SI", () => {
    expect(shouldMountGlobalChat("/cliente/")).toBe(true)
  })

  test("/negocio => SI", () => {
    expect(shouldMountGlobalChat("/negocio")).toBe(true)
  })

  test("/repartidor => SI (el gate propio de ChatFab, no tocado, sigue ocultando la FAB ahí — este helper sólo audita el nivel Provider)", () => {
    expect(shouldMountGlobalChat("/repartidor")).toBe(true)
  })

  test("null (pathname aún no resuelto) => SI (fail-open, igual que antes: sin gate no había pathname que excluyera nada)", () => {
    expect(shouldMountGlobalChat(null)).toBe(true)
  })

  test("una ruta que empieza con /operaciones-algo-distinto NO debe excluirse por coincidencia de prefijo laxa", () => {
    expect(shouldMountGlobalChat("/operaciones-publicas")).toBe(true)
  })
})
