// ============================================
// F10-C1b — «Salidas de Caja» of the cashier (happy-dom, fetch simulated)
// ============================================
// Proves: pure validation (exact cents, fields per type); the button needs an
// open shift; each type sends exactly its C1a body to the cashier endpoint only
// (never a register, a shift or a justification); confirmation before sending;
// double click → one POST; network error / 5xx keep the attempt key (retry =
// replay), 4xx drops it; rejected answers show fixed texts only (never the
// server's wording or amounts); the receipt shows amount, date, type and id;
// the shift history lists individual outflows without totals; nothing in the
// rendered screen hints at expected cash, balance or difference; the floating
// chat steps aside while the form is open.
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => {
  GlobalRegistrator.unregister()
})

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const mod = await import("./caja-salidas-cajero")
const { CajaSalidasCajero, parseImporteArs, validarSalida, mensajeErrorSalida, FORMULARIO_VACIO, MENSAJE_SIN_TURNO, MENSAJE_CONEXION, MENSAJE_SERVIDOR, MENSAJE_TURNO_YA_NO_ABIERTO } = mod

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const URL_EGRESOS = "/api/operativo/caja/kiosco-1/egresos"
// Words that would reveal (or let a cashier deduce) the expected cash.
const PRIVADO = /esperad|saldo|diferencia|insuficiente|faltante|sobrante|alerta|umbral|justific|total/i

type Post = { url: string; key: string | null; body: Record<string, unknown> }
let turnoAbierto = true
let historial: unknown[] = []
let posts: Post[] = []
let gets: string[] = []
let nextPost: Array<"network" | { status: number; body: unknown }> = []
let accesos: Array<[number, string | undefined]> = []
const originalFetch = globalThis.fetch

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const egresoDe = (body: Record<string, unknown>, id = "cmegreso000000000abcd1234") => ({
  id, naturaleza: body.naturaleza, categoria: body.categoria ?? null, importe: Number(body.importe), motivo: body.motivo,
  proveedorNombre: body.proveedorNombre ?? null, comprobanteReferencia: body.comprobanteReferencia ?? null,
  destinatarioTipo: body.destinatarioTipo ?? null, destinatarioNombre: body.destinatarioNombre ?? null,
  estadoAdministrativo: body.naturaleza === "RETIRO_DUENO" ? "PENDIENTE" : null, registradoPor: "PROPIO", createdAt: "2026-11-18T13:45:00.000Z",
})

beforeEach(() => {
  window.sessionStorage.clear()
  turnoAbierto = true
  historial = []
  posts = []
  gets = []
  nextPost = []
  accesos = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url !== URL_EGRESOS) throw new Error(`unexpected fetch ${url}`)
    if ((init?.method ?? "GET") === "GET") {
      gets.push(url)
      return json({ ok: true, turnoAbierto, egresos: turnoAbierto ? historial : [] })
    }
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    posts.push({ url, key: new Headers(init?.headers).get("Idempotency-Key"), body })
    const next = nextPost.shift() ?? { status: 201, body: { ok: true, replayed: false, egreso: egresoDe(body) } }
    if (next === "network") throw new TypeError("Failed to fetch")
    if (next.status < 300) historial = [(next.body as { egreso: unknown }).egreso, ...historial]
    return json(next.body, next.status)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
  delete document.body.dataset.cajaSalidaActiva
})

async function flush(ms = 30) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}
async function render(props: { turnoKey?: string | null } = {}) {
  const turnoKey = "turnoKey" in props ? props.turnoKey : "turno-1"
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const onAccessLost = (status: number, estado?: string) => { accesos.push([status, estado]) }
  await act(async () => {
    root.render(<CajaSalidasCajero slug="kiosco-1" negocioId="neg-1" empleadoId="emp-1" turnoKey={turnoKey} onAccessLost={onAccessLost} />)
  })
  await flush()
  return { container, root, rerender: async (turnoKey: string | null) => { await act(async () => { root.render(<CajaSalidasCajero slug="kiosco-1" negocioId="neg-1" empleadoId="emp-1" turnoKey={turnoKey} onAccessLost={onAccessLost} />) }); await flush() } }
}
const boton = (c: HTMLElement, texto: string) => {
  const b = [...c.querySelectorAll("button")].find((x) => x.textContent?.trim() === texto)
  if (!b) throw new Error(`no button «${texto}»; buttons: ${[...c.querySelectorAll("button")].map((x) => x.textContent).join(" | ")}`)
  return b as HTMLButtonElement
}
async function click(el: HTMLElement) {
  await act(async () => { el.click() })
  await flush()
}
// React-controlled inputs need the native value setter + an input event.
async function escribir(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, valor: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, valor)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }))
  })
}
const porId = <T extends HTMLElement>(c: HTMLElement, id: string) => c.querySelector(`#${id}`) as T
async function elegirTipo(c: HTMLElement, valor: string) {
  await click(c.querySelector(`input[name="naturaleza-salida"][value="${valor}"]`) as HTMLInputElement)
}
async function completarGasto(c: HTMLElement, importe = "1500,50") {
  await click(boton(c, "Registrar salida de Caja"))
  await elegirTipo(c, "GASTO")
  await escribir(porId<HTMLSelectElement>(c, "salida-categoria"), "INSUMOS")
  await escribir(porId<HTMLInputElement>(c, "salida-importe"), importe)
  await escribir(porId<HTMLTextAreaElement>(c, "salida-motivo"), "  Bolsas   y servilletas ")
  await click(boton(c, "Revisar salida"))
}

describe("F10-C1b — pure validation", () => {
  test("exact pesos and cents, never through a float", () => {
    expect(parseImporteArs("1500,5")).toEqual({ ok: true, valor: "1500.50" })
    expect(parseImporteArs("$ 1500.05")).toEqual({ ok: true, valor: "1500.05" })
    expect(parseImporteArs("0,01")).toEqual({ ok: true, valor: "0.01" })
    expect(parseImporteArs("007")).toEqual({ ok: true, valor: "7.00" })
    expect(parseImporteArs("9999999999,99")).toEqual({ ok: true, valor: "9999999999.99" })
    for (const malo of ["", "0", "0,00", "-5", "1.500,50", "1,234", "12,345", "abc", "10000000000", "1e3", "1 500"]) expect(parseImporteArs(malo).ok).toBe(false)
  })

  test("each type builds exactly its C1a body; never a register, a shift or a justification", () => {
    const base = { ...FORMULARIO_VACIO, importe: "10", motivo: "x" }
    const gasto = validarSalida({ ...base, naturaleza: "GASTO", categoria: "SERVICIOS", proveedorNombre: " Luz SA ", comprobanteReferencia: "F-1", proveedorIdentificacion: "no se envía", destinatarioNombre: "no se envía" })
    expect(gasto).toEqual({ ok: true, cuerpo: { naturaleza: "GASTO", categoria: "SERVICIOS", importe: "10.00", motivo: "x", proveedorNombre: "Luz SA", comprobanteReferencia: "F-1" } })
    const pago = validarSalida({ ...base, naturaleza: "PAGO_PROVEEDOR", categoria: "OTRO", proveedorIdentificacion: "30-1-9" })
    expect(pago).toEqual({ ok: true, cuerpo: { naturaleza: "PAGO_PROVEEDOR", importe: "10.00", motivo: "x", proveedorIdentificacion: "30-1-9" } })
    const retiro = validarSalida({ ...base, naturaleza: "RETIRO_DUENO", destinatarioTipo: "DUENO", destinatarioNombre: " Paula ", proveedorNombre: "no se envía" })
    expect(retiro).toEqual({ ok: true, cuerpo: { naturaleza: "RETIRO_DUENO", importe: "10.00", motivo: "x", destinatarioTipo: "DUENO", destinatarioNombre: "Paula" } })
    for (const r of [gasto, pago, retiro]) if (r.ok) expect(Object.keys(r.cuerpo).some((k) => ["cajaFisicaId", "turnoCajaId", "justificacion", "empleadoId", "negocioId"].includes(k))).toBe(false)
  })

  test("required fields per type", () => {
    const sinNada = validarSalida(FORMULARIO_VACIO)
    expect(sinNada.ok ? [] : Object.keys(sinNada.errores).sort()).toEqual(["importe", "motivo", "naturaleza"])
    const gasto = validarSalida({ ...FORMULARIO_VACIO, naturaleza: "GASTO", importe: "5", motivo: "m" })
    expect(gasto.ok ? [] : Object.keys(gasto.errores)).toEqual(["categoria"])
    const retiro = validarSalida({ ...FORMULARIO_VACIO, naturaleza: "RETIRO_DUENO", importe: "5", motivo: "m" })
    expect(retiro.ok ? [] : Object.keys(retiro.errores).sort()).toEqual(["destinatarioNombre", "destinatarioTipo"])
    expect(validarSalida({ ...FORMULARIO_VACIO, naturaleza: "GASTO", categoria: "OTRO", importe: "5", motivo: "m".repeat(501) }).ok).toBe(false)
  })

  test("rejected answers map to fixed texts with no figures", () => {
    for (const [status, code] of [[409, "TURNO_REQUERIDO"], [409, "TURNO_NO_DISPONIBLE"], [409, "IDEMPOTENCY_KEY_REUSED"], [400, "IMPORTE_EGRESO_INVALIDO"], [400, "DESTINATARIO_RETIRO_REQUERIDO"], [400, "CAMPOS_NO_PERMITIDOS"], [400, "DESCONOCIDO"], [500, undefined], [409, "JUSTIFICACION_REQUERIDA"]] as const) {
      const texto = mensajeErrorSalida(status, code)
      expect(texto).not.toMatch(/\$\s?\d|\d+[.,]\d{2}/)
      expect(texto).not.toMatch(PRIVADO)
    }
  })
})

describe("F10-C1b — screen", () => {
  test("without an open shift: registration is impossible and the reason is explained", async () => {
    turnoAbierto = false
    const { container } = await render({ turnoKey: null })
    expect(container.textContent).toContain(MENSAJE_SIN_TURNO)
    const b = boton(container, "Registrar salida de Caja")
    expect(b.disabled).toBe(true)
    expect(b.getAttribute("aria-describedby")).toBe("salida-sin-turno")
    expect(container.textContent).toContain("Sin turno abierto no hay salidas para mostrar.")
    expect(posts).toHaveLength(0)
  })

  test("expense: validation, confirmation before sending, ONE POST with a UUID key and the exact body, receipt and history", async () => {
    const { container } = await render()
    await click(boton(container, "Registrar salida de Caja"))
    expect(document.body.dataset.cajaSalidaActiva).toBe("true")
    expect(container.textContent).toContain("Efectivo de la caja")
    await click(boton(container, "Revisar salida"))
    expect(container.querySelector('[data-testid="mensaje-salida"]')?.textContent).toBe("Revisá los campos marcados.")
    expect(container.textContent).toContain("Elegí el tipo de salida.")
    await elegirTipo(container, "GASTO")
    await escribir(porId<HTMLInputElement>(container, "salida-importe"), "1.500,50")
    await click(boton(container, "Revisar salida"))
    expect(container.textContent).toContain("Elegí la categoría del gasto.")
    expect(porId<HTMLInputElement>(container, "salida-importe").getAttribute("aria-invalid")).toBe("true")
    expect(posts).toHaveLength(0)

    await escribir(porId<HTMLSelectElement>(container, "salida-categoria"), "INSUMOS")
    await escribir(porId<HTMLInputElement>(container, "salida-importe"), "1500,50")
    await escribir(porId<HTMLTextAreaElement>(container, "salida-motivo"), "Bolsas")
    await escribir(porId<HTMLInputElement>(container, "salida-comprobante"), "Ticket 0001-22")
    await click(boton(container, "Revisar salida"))
    expect(posts).toHaveLength(0) // confirmation step first
    expect(container.querySelector('[data-testid="salida-confirmar-importe"]')?.textContent?.replace(/\s/g, " ")).toMatch(/1\.500,50/)
    await click(boton(container, "Confirmar y registrar"))
    expect(posts).toHaveLength(1)
    expect(posts[0].key).toMatch(UUID)
    expect(posts[0].body).toEqual({ naturaleza: "GASTO", categoria: "INSUMOS", importe: "1500.50", motivo: "Bolsas", comprobanteReferencia: "Ticket 0001-22" })

    const recibo = container.querySelector('[data-testid="comprobante-salida"]') as HTMLElement
    expect(recibo.textContent).toContain("Salida registrada")
    expect(recibo.textContent).toContain("Gasto · Insumos")
    expect(recibo.textContent?.replace(/\s/g, " ")).toMatch(/1\.500,50/)
    expect(recibo.textContent).toContain("S-ABCD1234")
    expect(recibo.textContent).toContain("cmegreso000000000abcd1234")
    expect(recibo.textContent).toMatch(/18\/11\/(20)?26/)
    expect(document.activeElement).toBe(recibo)
    const lista = container.querySelector('[data-testid="historial-salidas"]') as HTMLElement
    expect(lista.querySelectorAll("li")).toHaveLength(1)
    expect(lista.textContent).toContain("Registrada por vos")
    expect(container.textContent).not.toMatch(PRIVADO)
    await click(boton(container, "Listo"))
    expect(document.body.dataset.cajaSalidaActiva).toBeUndefined()
  })

  test("double click on «Confirmar y registrar»: exactly one POST", async () => {
    const { container } = await render()
    await completarGasto(container)
    const confirmar = boton(container, "Confirmar y registrar")
    await act(async () => { confirmar.click(); confirmar.click(); confirmar.click() })
    await flush()
    expect(posts).toHaveLength(1)
  })

  test("network error and 5xx keep the key (retry replays); the replay receipt says it was not registered twice", async () => {
    nextPost = ["network", { status: 500, body: { ok: false, error: "x" } }]
    const { container } = await render()
    await completarGasto(container)
    await click(boton(container, "Confirmar y registrar"))
    expect(container.textContent).toContain(MENSAJE_CONEXION)
    await click(boton(container, "Confirmar y registrar"))
    expect(container.textContent).toContain(MENSAJE_SERVIDOR)
    nextPost = [{ status: 200, body: { ok: true, replayed: true, egreso: egresoDe({ naturaleza: "GASTO", categoria: "INSUMOS", importe: "1500.50", motivo: "Bolsas y servilletas" }) } }]
    await click(boton(container, "Confirmar y registrar"))
    expect(posts.map((p) => p.key)).toEqual([posts[0].key, posts[0].key, posts[0].key])
    expect(container.textContent).toContain("no se registró otra vez")
    // Next, different outflow: a fresh key.
    await click(boton(container, "Registrar otra salida"))
    await elegirTipo(container, "GASTO")
    await escribir(porId<HTMLSelectElement>(container, "salida-categoria"), "OTRO")
    await escribir(porId<HTMLInputElement>(container, "salida-importe"), "20")
    await escribir(porId<HTMLTextAreaElement>(container, "salida-motivo"), "Otra")
    await click(boton(container, "Revisar salida"))
    await click(boton(container, "Confirmar y registrar"))
    expect(posts[3].key).not.toBe(posts[0].key)
  })

  test("a rejected outflow shows a fixed text, never the server's wording or figures; 4xx drops the key", async () => {
    nextPost = [{ status: 400, body: { ok: false, code: "IMPORTE_EGRESO_INVALIDO", error: "Efectivo esperado $500,00: importe insuficiente" } }]
    const { container } = await render()
    await completarGasto(container)
    await click(boton(container, "Confirmar y registrar"))
    expect(container.textContent).toContain("Revisá el importe")
    expect(container.textContent).not.toContain("$500")
    expect(container.textContent).not.toMatch(PRIVADO)
    // Back on the form; the next confirmation uses a new key.
    await click(boton(container, "Revisar salida"))
    await click(boton(container, "Confirmar y registrar"))
    expect(posts).toHaveLength(2)
    expect(posts[1].key).not.toBe(posts[0].key)
  })

  test("shift closed meanwhile: clear message, back to the closed state, list re-read; nothing claims it was registered", async () => {
    nextPost = [{ status: 409, body: { ok: false, code: "TURNO_NO_DISPONIBLE", error: "El turno de Caja ya no está abierto." } }]
    const { container } = await render()
    await completarGasto(container)
    turnoAbierto = false
    const lecturas = gets.length
    await click(boton(container, "Confirmar y registrar"))
    expect(container.textContent).toContain(MENSAJE_TURNO_YA_NO_ABIERTO)
    expect(gets.length).toBeGreaterThan(lecturas)
    expect(boton(container, "Registrar salida de Caja").disabled).toBe(true)
    expect(container.querySelector('[data-testid="comprobante-salida"]')).toBeNull()
  })

  test("supplier payment: CUIT and receipt number optional; owner's withdrawal: recipient required and sent", async () => {
    const { container } = await render()
    await click(boton(container, "Registrar salida de Caja"))
    await elegirTipo(container, "PAGO_PROVEEDOR")
    expect(porId(container, "salida-categoria")).toBeNull()
    expect(porId(container, "salida-cuit")).not.toBeNull()
    await escribir(porId<HTMLInputElement>(container, "salida-importe"), "25000")
    await escribir(porId<HTMLTextAreaElement>(container, "salida-motivo"), "Mercadería del lunes")
    await escribir(porId<HTMLInputElement>(container, "salida-proveedor"), "Distribuidora Sur")
    await click(boton(container, "Revisar salida"))
    await click(boton(container, "Confirmar y registrar"))
    expect(posts[0].body).toEqual({ naturaleza: "PAGO_PROVEEDOR", importe: "25000.00", motivo: "Mercadería del lunes", proveedorNombre: "Distribuidora Sur" })

    await click(boton(container, "Registrar otra salida"))
    await elegirTipo(container, "RETIRO_DUENO")
    expect(porId(container, "salida-proveedor")).toBeNull()
    await escribir(porId<HTMLInputElement>(container, "salida-importe"), "3000")
    await escribir(porId<HTMLTextAreaElement>(container, "salida-motivo"), "Retiro del mediodía")
    await click(boton(container, "Revisar salida"))
    expect(container.textContent).toContain("Indicá quién recibe el efectivo.")
    expect(container.textContent).toContain("Escribí el nombre de quien recibe el efectivo.")
    await click(container.querySelector('input[name="destinatario-salida"][value="AUTORIZADO_POR_DUENO"]') as HTMLInputElement)
    await escribir(porId<HTMLInputElement>(container, "salida-destinatario"), "Martín")
    await click(boton(container, "Revisar salida"))
    await click(boton(container, "Confirmar y registrar"))
    expect(posts[1].body).toEqual({ naturaleza: "RETIRO_DUENO", importe: "3000.00", motivo: "Retiro del mediodía", destinatarioTipo: "AUTORIZADO_POR_DUENO", destinatarioNombre: "Martín" })
    const recibo = container.querySelector('[data-testid="comprobante-salida"]') as HTMLElement
    expect(recibo.textContent).toContain("Recibió")
    expect(recibo.textContent).toContain("Martín (Persona autorizada por el dueño)")
    // No owner confirmation is announced (C1c does not exist yet).
    expect(container.textContent).not.toMatch(/confirm(ó|ará|ar) la recepción|pendiente de confirmación/i)
    expect(container.textContent).not.toMatch(PRIVADO)
  })

  test("history: individual outflows only (own and the owner's), no totals; re-read when the shift changes; session loss follows the server", async () => {
    historial = [
      { ...egresoDe({ naturaleza: "GASTO", categoria: "TRANSPORTE", importe: "100", motivo: "Remis" }, "id-a-00000001"), registradoPor: "DUENO" },
      egresoDe({ naturaleza: "PAGO_PROVEEDOR", importe: "250.5", motivo: "Pan" }, "id-b-00000002"),
    ]
    const { container, rerender } = await render()
    const lista = container.querySelector('[data-testid="historial-salidas"]') as HTMLElement
    expect(lista.querySelectorAll("li")).toHaveLength(2)
    expect(lista.textContent).toContain("Registrada por el responsable del negocio")
    expect(lista.textContent).toContain("Registrada por vos")
    expect(container.textContent).not.toMatch(/350,50/) // never a sum
    expect(container.textContent).not.toMatch(PRIVADO)
    const antes = gets.length
    await rerender("turno-2")
    expect(gets.length).toBe(antes + 1)

    globalThis.fetch = (async () => json({ ok: false, estado: "sin_sesion" }, 401)) as unknown as typeof fetch
    await click(container.querySelector('button[aria-label="Actualizar salidas de Caja"]') as HTMLButtonElement)
    expect(accesos).toEqual([[401, "sin_sesion"]])
  })

  test("history is read once: nothing while the shift is unknown, one read when it becomes known, none for the same shift again", async () => {
    const { rerender } = await render({ turnoKey: undefined })
    expect(gets).toHaveLength(0)
    await rerender("turno-1")
    expect(gets).toHaveLength(1)
    await rerender("turno-1")
    expect(gets).toHaveLength(1)
  })

  test("uncertain attempt (connection lost): editing is locked until a retry with the same key settles it", async () => {
    nextPost = ["network"]
    const { container } = await render()
    await completarGasto(container)
    await click(boton(container, "Confirmar y registrar"))
    const volver = boton(container, "Volver a editar")
    expect(volver.disabled).toBe(true)
    expect(volver.getAttribute("aria-describedby")).toBe("salida-incierta")
    expect(container.textContent).toContain("Reintentá antes de cambiar los datos")
    await click(boton(container, "Confirmar y registrar"))
    expect(posts.map((p) => p.key)).toEqual([posts[0].key, posts[0].key])
    expect(container.querySelector('[data-testid="comprobante-salida"]')).not.toBeNull()
    // A definitive rejection (4xx) never locks editing.
    await click(boton(container, "Registrar otra salida"))
    nextPost = [{ status: 400, body: { ok: false, code: "MOTIVO_EGRESO_REQUERIDO" } }]
    await elegirTipo(container, "GASTO")
    await escribir(porId<HTMLSelectElement>(container, "salida-categoria"), "OTRO")
    await escribir(porId<HTMLInputElement>(container, "salida-importe"), "5")
    await escribir(porId<HTMLTextAreaElement>(container, "salida-motivo"), "x")
    await click(boton(container, "Revisar salida"))
    await click(boton(container, "Confirmar y registrar"))
    expect(container.querySelector('form[aria-label="Nueva salida de Caja"]')).not.toBeNull()
  })

  test("focus follows the step: first option on open, first invalid field on error, the summary at confirmation, the receipt at the end", async () => {
    const { container } = await render()
    await click(boton(container, "Registrar salida de Caja"))
    expect(document.activeElement?.id).toBe("salida-naturaleza-GASTO")
    await elegirTipo(container, "GASTO")
    await escribir(porId<HTMLSelectElement>(container, "salida-categoria"), "OTRO")
    await click(boton(container, "Revisar salida"))
    await flush()
    expect(document.activeElement?.id).toBe("salida-importe")
    await escribir(porId<HTMLInputElement>(container, "salida-importe"), "12")
    await escribir(porId<HTMLTextAreaElement>(container, "salida-motivo"), "Algo")
    await click(boton(container, "Revisar salida"))
    expect(document.activeElement?.id).toBe("salida-confirmar-titulo")
    await click(boton(container, "Confirmar y registrar"))
    expect((document.activeElement as HTMLElement | null)?.dataset.testid).toBe("comprobante-salida")
    // Closing the receipt (or cancelling the form) returns focus to the button, never to <body>.
    await click(boton(container, "Listo"))
    expect(document.activeElement?.textContent?.trim()).toBe("Registrar salida de Caja")
    await click(boton(container, "Registrar salida de Caja"))
    await click(boton(container, "Cancelar"))
    expect(document.activeElement?.textContent?.trim()).toBe("Registrar salida de Caja")
  })

  test("accessible names: every field has a label; type and recipient are radio groups with a legend", async () => {
    const { container } = await render()
    await click(boton(container, "Registrar salida de Caja"))
    await elegirTipo(container, "RETIRO_DUENO")
    for (const id of ["salida-importe", "salida-motivo", "salida-destinatario"]) expect(container.querySelector(`label[for="${id}"]`)?.textContent?.trim().length).toBeGreaterThan(3)
    const legends = [...container.querySelectorAll("fieldset legend")].map((l) => l.textContent)
    expect(legends).toEqual(["Tipo de salida", "¿Quién recibe el efectivo?"])
    // Short accessible names for the type options; the explanation is the description.
    const nombre = (el: Element, attr: string) => (el.getAttribute(attr) ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
    const opciones = [...container.querySelectorAll('input[name="naturaleza-salida"]')]
    expect(opciones.map((o) => nombre(o, "aria-labelledby"))).toEqual(["Gasto", "Pago a proveedor", "Retiro del dueño"])
    expect(nombre(opciones[2], "aria-describedby")).toContain("persona autorizada por el dueño")
    expect([...container.querySelectorAll('input[name="destinatario-salida"]')].map((o) => (o as HTMLInputElement).labels?.[0]?.textContent)).toEqual(["El dueño", "Persona autorizada por el dueño"])
    expect(container.querySelector('form[aria-label="Nueva salida de Caja"]')).not.toBeNull()
  })
})

const retiroBody = () => ({ naturaleza: "RETIRO_DUENO", importe: "300.00", motivo: "Retiro", destinatarioTipo: "DUENO", destinatarioNombre: "Paula" })

describe("F10-C1c — read-only administrative state in the cashier's history", () => {
  test("own withdrawals show Pendiente / Confirmado / Observado and a compensated outflow «Anulada por el dueño»; no action, no owner text", async () => {
    historial = [
      { ...egresoDe(retiroBody(), "cmegreso000000000aaaa0001"), estadoAdministrativo: "PENDIENTE" },
      { ...egresoDe(retiroBody(), "cmegreso000000000aaaa0002"), estadoAdministrativo: "CONFIRMADO" },
      { ...egresoDe(retiroBody(), "cmegreso000000000aaaa0003"), estadoAdministrativo: "OBSERVADO" },
      { ...egresoDe({ naturaleza: "GASTO", categoria: "INSUMOS", importe: "10.00", motivo: "Hielo" }, "cmegreso000000000aaaa0004"), estadoAdministrativo: "ANULADO" },
      { ...egresoDe({ naturaleza: "GASTO", categoria: "INSUMOS", importe: "20.00", motivo: "Bolsas" }, "cmegreso000000000aaaa0005"), estadoAdministrativo: null, registradoPor: "DUENO" },
    ]
    const { container } = await render()
    const chips = [...container.querySelectorAll('[data-testid="estado-administrativo"]')].map((el) => el.textContent)
    expect(chips).toEqual(["Estado: Pendiente", "Estado: Confirmado", "Estado: Observado", "Estado: Anulada por el dueño"])
    const lista = container.querySelector('[data-testid="historial-salidas"]')!
    expect(lista.querySelectorAll("button")).toHaveLength(0)
    expect(lista.textContent).not.toMatch(PRIVADO)
  })
})
