// ============================================
// F10-C1b — static contract: the cashier's «Salidas de Caja» screen (no database)
// ============================================
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const UI = "src/components/business/caja-salidas-cajero.tsx"
const PAGE = "src/app/operaciones/mi-panel/[slug]/caja/page.tsx"
const PANEL = "src/components/business/operational-shift-panel.tsx"
const CSS = "src/app/globals.css"

describe("F10-C1b — cashier outflow screen", () => {
  const ui = sinComentarios(read(UI))

  test("talks only to the cashier outflow endpoint; never to owner APIs", () => {
    expect(ui).toContain("const base = `/api/operativo/caja/${encodeURIComponent(slug)}/egresos`")
    expect(ui.match(/fetch\(/g)).toHaveLength(2)
    expect(ui).not.toMatch(/\/api\/negocio\/|configuracion-egresos|revision|confirmacion-retiro/)
  })

  test("never chooses a register or a shift, never justifies", () => {
    expect(ui).not.toMatch(/cajaFisicaId|turnoCajaId|justificacion/)
    // The request body is ONLY what validarSalida builds (never an identity field).
    const cuerpo = ui.slice(ui.indexOf("export function validarSalida"), ui.indexOf("export const MENSAJE_SIN_TURNO"))
    expect(cuerpo.length).toBeGreaterThan(200)
    expect(cuerpo).not.toMatch(/empleadoId|negocioId|actor/)
    expect(ui).toContain("body: canonico })")
    expect(ui).toContain("const canonico = JSON.stringify(cuerpo)")
  })

  test("blind close: no expected cash, balance, difference or insufficient-funds wording", () => {
    expect(ui).not.toMatch(/esperad|saldo|diferencia|insuficiente|faltante|sobrante|alerta|umbral|excede|total/i)
  })

  test("errors are fixed texts: the server's wording (json.error) is never rendered", () => {
    expect(ui).not.toMatch(/json\.error|\.detalle/)
    expect(ui).toContain("setMensaje(mensajeErrorSalida(res.status, code))")
  })

  test("idempotent attempts: one key per exact content, kept on network error / 5xx, dropped on 4xx and success", () => {
    expect(ui).toContain('"Idempotency-Key": claveIntento(scope, canonico)')
    expect(ui).toContain("if (res.status < 500) olvidarIntento(scope)")
    expect(ui).toContain("if (!cuerpo || enviandoRef.current) return")
  })

  test("F10-C1c: the cashier only READS a fixed administrative state of their own outflows (never the raw confirmation, never an action)", () => {
    expect(ui).not.toMatch(/confirmacionRetiroEstado|NO_RECIBIDO|confirmacion-retiro|\/compensacion|\/revision/)
    expect(ui).toContain('PENDIENTE: "Pendiente"')
    expect(ui).toContain('ANULADO: "Anulada por el dueño"')
    expect(ui).toContain("estadoAdministrativo?: EstadoAdministrativoSalida | null")
  })

  test("the page wires the section with the session-derived ids and keeps room above the floating chat", () => {
    const page = read(PAGE)
    expect(page).toContain("<CajaSalidasCajero")
    expect(page).toContain("empleadoId={state.ctx.empleado.id}")
    expect(page).toContain("onTurnoChange={setTurnoAbiertoId}")
    expect(page).toContain('\nconst PADDING_INFERIOR ="calc(max(7rem, var(--deligo-install-prompt-h, 0px) + 1rem) + env(safe-area-inset-bottom, 0px))"')
    expect(page).toContain("style={{ paddingBottom: PADDING_INFERIOR }}")
    expect(read(PANEL)).toContain("onTurnoChange?.(turnoIdMostrado)")
    const css = read(CSS)
    expect(css).toContain('body[data-caja-salida-activa="true"] .ios-chat-fab,\nbody[data-caja-salida-activa="true"] .deligo-install-prompt {'.replace("\n", css.includes("\r\n") ? "\r\n" : "\n"))
  })

  test("the PWA install notice keeps its flow and only publishes its height / steps aside", () => {
    const prompt = read("src/components/shared/install-prompt.tsx")
    // Every fixed notice (Android pending, native banner, manual guide, iOS banner) reserves its height.
    expect(prompt.match(/ref=\{reserva\}/g)).toHaveLength(4)
    expect(prompt.match(/className="deligo-install-prompt fixed/g)).toHaveLength(4)
    expect(prompt).toContain("className={`deligo-install-prompt fixed bottom-6 right-6")
    expect(prompt).toContain('export const INSTALL_PROMPT_HEIGHT_VAR = "--deligo-install-prompt-h"')
    expect(prompt).toContain("root.style.removeProperty(INSTALL_PROMPT_HEIGHT_VAR)")
    // Install logic untouched: native prompt, guides and dismissal are still there.
    for (const fragment of ["await promptInstall()", "onDismiss={() => setBannerDismissed(true)}", "<AndroidManualGuide", "<IOSInstallBanner", "<InstallFAB"]) expect(prompt).toContain(fragment)
  })
})
