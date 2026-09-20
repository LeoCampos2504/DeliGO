// P2-T49-R1: contrato estático del layout del chat de Terminal PyR — mismo
// patrón ya usado en src/lib/p2-t06-terminal-hardening.integration.test.ts
// para el propio botón "Cerrar terminal" (expect(source).toContain(...)).
// Deliberadamente NO usa un harness de renderizado/DOM: el bug y su fix
// son de clases CSS/estructura, no de lógica — un test de presencia de
// clases en el código fuente es suficiente y no requiere DB ni React
// Testing Library. No se crea acá porque mezclarlo en el archivo de
// integración de T06 (que sí requiere DATABASE_URL) sería semánticamente
// confuso para un contrato puramente de layout.
import { describe, expect, test } from "bun:test"
import fs from "fs"
import path from "path"

const CHAT_PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8")
// __dirname = src/app/operaciones/pyr/mensajes/[pedidoId] — 5 niveles hasta src/.
const SRC_DIR = path.join(__dirname, "..", "..", "..", "..", "..")
const LOGOUT_BUTTON_SOURCE = fs.readFileSync(
  path.join(SRC_DIR, "components", "operativo", "terminal-logout-button.tsx"),
  "utf8"
)

describe("P2-T49-R1 — shell del chat de Terminal PyR (h-dvh, sin sticky, sin solape de logout)", () => {
  test("el <main> del chat usa h-dvh + overflow-hidden, ya no min-h-screen", () => {
    expect(CHAT_PAGE_SOURCE).toContain("h-dvh bg-background flex flex-col overflow-hidden")
    expect(CHAT_PAGE_SOURCE).not.toContain("min-h-screen bg-background flex flex-col")
  })

  test("el panel de mensajes combina flex-1, min-h-0 y overflow-y-auto", () => {
    expect(CHAT_PAGE_SOURCE).toContain("flex-1 min-h-0 max-w-3xl w-full mx-auto px-4 py-4 space-y-2 overflow-y-auto")
  })

  test("el composer ya no es sticky bottom-0 y usa shrink-0", () => {
    expect(CHAT_PAGE_SOURCE).not.toContain("sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border/50")
    expect(CHAT_PAGE_SOURCE).toContain('<div className="shrink-0 bg-background/95 backdrop-blur-md border-t border-border/50">')
  })

  test("el composer reserva safe-area-inset-bottom sin perder su padding base", () => {
    expect(CHAT_PAGE_SOURCE).toContain("pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]")
  })

  test("el header ya no es sticky top-0 (el padre está clamped, no scrollea)", () => {
    expect(CHAT_PAGE_SOURCE).not.toContain('<header className="sticky top-0')
  })

  test("el chat renderiza su propio acceso de logout compacto con aria-label accesible", () => {
    expect(CHAT_PAGE_SOURCE).toContain('aria-label="Cerrar terminal"')
    expect(CHAT_PAGE_SOURCE).toContain("useTerminalLogout")
  })

  test("no se agregó ningún manejo de teclado/viewport nuevo (visualViewport, resize, focusin/focusout, CSS var de altura)", () => {
    expect(CHAT_PAGE_SOURCE).not.toContain("visualViewport")
    expect(CHAT_PAGE_SOURCE).not.toContain("addEventListener(\"resize\"")
    expect(CHAT_PAGE_SOURCE).not.toContain("focusin")
    expect(CHAT_PAGE_SOURCE).not.toContain("focusout")
    expect(CHAT_PAGE_SOURCE).not.toContain("--visual-viewport-height")
  })

  test("no se tocó la lógica de adjuntos/preview ni sus componentes reutilizados", () => {
    expect(CHAT_PAGE_SOURCE).toContain("AttachmentPreviewModal")
    expect(CHAT_PAGE_SOURCE).toContain("AttachmentUnavailableNotice")
  })
})

describe("P2-T49-R1 — TerminalLogoutButton excluye la ruta de chat sin duplicar lógica", () => {
  test("el flotante global excluye explícitamente /operaciones/pyr/mensajes/", () => {
    expect(LOGOUT_BUTTON_SOURCE).toContain('"/operaciones/pyr/mensajes/"')
    expect(LOGOUT_BUTTON_SOURCE).toContain("pathname?.startsWith(CHAT_ROUTE_PREFIX)")
  })

  test("expone un hook reutilizable en vez de duplicar fetch/toast/redirect", () => {
    expect(LOGOUT_BUTTON_SOURCE).toContain("export function useTerminalLogout")
    const fetchOccurrences = LOGOUT_BUTTON_SOURCE.match(/fetch\("\/api\/operaciones\/terminal\/logout"/g) ?? []
    expect(fetchOccurrences.length).toBe(1)
  })

  test("no cambia el endpoint, ni la navegación posterior de logout", () => {
    expect(LOGOUT_BUTTON_SOURCE).toContain('fetch("/api/operaciones/terminal/logout"')
    expect(LOGOUT_BUTTON_SOURCE).toContain('window.location.assign("/operaciones/activar")')
  })
})

describe("P2-T49-R1 — regresión: las otras 7 pantallas Terminal no cambiaron su convención", () => {
  const OTHER_TERMINAL_PAGES = [
    "salon/page.tsx",
    "pyr/page.tsx",
    "pyr/historial/page.tsx",
    "pyr/resenas/page.tsx",
    "pyr/estadisticas/page.tsx",
    "salon/historial/page.tsx",
    "salon/estadisticas/page.tsx",
  ]

  for (const relPath of OTHER_TERMINAL_PAGES) {
    test(`${relPath} conserva min-h-screen y pb-24 (sin migrar al shell de chat)`, () => {
      // __dirname = src/app/operaciones/pyr/mensajes/[pedidoId] — 4 niveles hasta src/app.
      const source = fs.readFileSync(
        path.join(__dirname, "..", "..", "..", "..", "operaciones", relPath),
        "utf8"
      )
      expect(source).toContain("min-h-screen")
      expect(source).toContain("pb-24")
    })
  }
})
