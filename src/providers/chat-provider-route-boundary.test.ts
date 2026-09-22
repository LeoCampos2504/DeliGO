// P2-T49-R1B/R1C: contrato puro del gate de montaje del Chat personal
// global (ChatFab + ChatSheet + useChatDeepLink + useChatActorReset) —
// reproduce el finding físico del operador (burbuja naranja de Chat
// Cliente visible dentro de Terminal Operaciones/PyR) y confirma que la
// exclusión cubre TODA la superficie /operaciones/**, sin afectar ninguna
// ruta personal real. `shouldMountGlobalChat` es función pura, sin montar
// React. R1C completó el aislamiento: los hooks personales ahora viven en
// un componente hijo separado (`GlobalChatRuntime`, no exportado) que
// ChatProvider monta o no monta por completo según este mismo gate — ya
// no corren incondicionalmente en /operaciones/** como en R1B. Se audita
// esa arquitectura con un contrato estático focal sobre el código fuente
// (mismo patrón ya usado en p2-t06-terminal-hardening para "Cerrar
// terminal"), sin montar ChatFab/ChatSheet en un harness de DOM real —
// ambos son `next/dynamic({ ssr:false })` con dependencias propias
// (stores, sockets) que un test liviano no debe arrastrar.
import { describe, expect, test } from "bun:test"
import fs from "fs"
import path from "path"
import { shouldMountGlobalChat } from "./chat-provider"

const CHAT_PROVIDER_SOURCE = fs.readFileSync(path.join(__dirname, "chat-provider.tsx"), "utf8")

describe("P2-T49-R1B — shouldMountGlobalChat: límite de rutas Operaciones/Terminal", () => {
  test("/operaciones (home Terminal) => NO", () => {
    expect(shouldMountGlobalChat("/operaciones")).toBe(false)
  })

  test("/operaciones/ (con barra final) => NO", () => {
    expect(shouldMountGlobalChat("/operaciones/")).toBe(false)
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

describe("P2-T49-R1C — arquitectura real: los hooks personales viven en GlobalChatRuntime, no en ChatProvider", () => {
  test("useChatDeepLink/useChatActorReset se llaman dentro de GlobalChatRuntime, no dentro del cuerpo de ChatProvider", () => {
    const runtimeMatch = CHAT_PROVIDER_SOURCE.match(/function GlobalChatRuntime\(\)\s*\{([\s\S]*?)\n\}/)
    const providerMatch = CHAT_PROVIDER_SOURCE.match(/export function ChatProvider\(\)\s*\{([\s\S]*?)\n\}/)
    expect(runtimeMatch).not.toBeNull()
    expect(providerMatch).not.toBeNull()
    const runtimeBody = runtimeMatch![1]
    const providerBody = providerMatch![1]

    expect(runtimeBody).toContain("useChatDeepLink()")
    expect(runtimeBody).toContain("useChatActorReset()")
    expect(providerBody).not.toContain("useChatDeepLink()")
    expect(providerBody).not.toContain("useChatActorReset()")
  })

  test("GlobalChatRuntime renderiza ChatFab y ChatSheet", () => {
    const runtimeMatch = CHAT_PROVIDER_SOURCE.match(/function GlobalChatRuntime\(\)\s*\{([\s\S]*?)\n\}/)
    const runtimeBody = runtimeMatch![1]
    expect(runtimeBody).toContain("<ChatFab />")
    expect(runtimeBody).toContain("<ChatSheet />")
  })

  test("ChatProvider aplica el route gate ANTES de montar GlobalChatRuntime, y GlobalChatRuntime no se monta incondicionalmente", () => {
    const providerMatch = CHAT_PROVIDER_SOURCE.match(/export function ChatProvider\(\)\s*\{([\s\S]*?)\n\}/)
    const providerBody = providerMatch![1]

    const gateIndex = providerBody.indexOf("shouldMountGlobalChat(pathname)")
    const mountIndex = providerBody.indexOf("<GlobalChatRuntime />")
    expect(gateIndex).toBeGreaterThan(-1)
    expect(mountIndex).toBeGreaterThan(-1)
    expect(gateIndex).toBeLessThan(mountIndex)
    // GlobalChatRuntime sólo debe aparecer una vez en ChatProvider, detrás
    // del `if (!shouldMountGlobalChat...) return null` — nunca renderizado
    // incondicionalmente en el mismo return que el null.
    expect(providerBody).toContain("return null")
  })
})
