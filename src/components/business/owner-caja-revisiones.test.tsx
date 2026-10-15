import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { OwnerCajaRevisiones } = await import("./owner-caja-revisiones")
const originalFetch = globalThis.fetch
const reviewKeys: Array<string | null> = []
let submittedNote = ""
let submittedCustody: Record<string, unknown> | null = null
let custodyEvents: Record<string, unknown>[] = []
let custodyPostCount = 0
let custodyPostStatus = 201
let custodyPostFailure: string | null = null
let deferCustodyPost = false
let finishDeferredCustodyPost: (() => void) | null = null

const initialTurno = () => ({
  id: "turno-d-1", caja: { id: "caja-1", nombre: "Caja principal" }, responsableNombre: "Cristian",
  abiertoEn: "2026-10-13T12:00:00.000Z", cerradoEn: "2026-10-13T18:00:00.000Z", estado: "CERRADO_DECLARADO",
  fondoInicial: 10, efectivoEsperado: 30, efectivoContado: 29.99, diferencia: -0.01,
  resultado: "FALTANTE", estadoRevision: "PENDIENTE_REVISION",
  efectivoContadoExacto: "29.99", estadoEntrega: "PENDIENTE_ENTREGA", entregaActual: null as Record<string, unknown> | null,
})
let mockedTurno = initialTurno()

function successfulCustodyResponse(body: Record<string, unknown>) {
  const delivered = Number(body.efectivoEntregado)
  const retained = Number(body.fondoRemanente)
  const event = {
    id: `custody-${custodyEvents.length + 1}`, tipo: body.tipo, estado: "CONFIRMADA", actor: "Dueño",
    efectivoContado: mockedTurno.efectivoContado, efectivoEsperado: mockedTurno.efectivoEsperado,
    diferencia: mockedTurno.diferencia, efectivoEntregado: delivered, fondoRemanente: retained,
    destinoTipo: body.destinoTipo, destinoNombre: body.destinoNombre ?? null,
    confirmadoEn: "2026-10-14T12:00:00.000Z", observacion: body.observacion ?? null,
  }
  custodyEvents.push(event)
  mockedTurno = {
    ...mockedTurno,
    estadoEntrega: "ENTREGA_CONFIRMADA",
    entregaActual: {
      efectivoEntregado: delivered, fondoRemanente: retained,
      destinoTipo: body.destinoTipo, destinoNombre: body.destinoNombre ?? null,
      actor: "Dueño", confirmadoEn: event.confirmadoEn, observacion: event.observacion,
    },
  }
  return new Response(JSON.stringify({ entrega: event, replayed: custodyPostStatus === 200 }), { status: custodyPostStatus })
}

beforeEach(() => {
  reviewKeys.length = 0
  submittedNote = ""
  submittedCustody = null
  custodyEvents = []
  custodyPostCount = 0
  custodyPostStatus = 201
  custodyPostFailure = null
  deferCustodyPost = false
  finishDeferredCustodyPost = null
  mockedTurno = initialTurno()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/turnos/cerrados")) return new Response(JSON.stringify({ turnos: [mockedTurno] }), { status: 200 })
    if (url.endsWith("/revisiones") && init?.method === "POST") {
      reviewKeys.push(new Headers(init.headers).get("Idempotency-Key"))
      submittedNote = (JSON.parse(String(init.body)) as { observacion: string }).observacion
      return new Response(JSON.stringify({ replayed: false, revision: { id: "revision-1" } }), { status: 201 })
    }
    if (url.endsWith("/revisiones")) return new Response(JSON.stringify({ revisiones: [] }), { status: 200 })
    if (url.endsWith("/entregas") && init?.method === "POST") {
      custodyPostCount++
      submittedCustody = JSON.parse(String(init.body)) as Record<string, unknown>
      if (custodyPostFailure) return new Response(JSON.stringify({ error: custodyPostFailure }), { status: 409 })
      if (deferCustodyPost) return new Promise<Response>((resolve) => {
        finishDeferredCustodyPost = () => resolve(successfulCustodyResponse(submittedCustody!))
      })
      return successfulCustodyResponse(submittedCustody!)
    }
    if (url.endsWith("/entregas")) return new Response(JSON.stringify({ entregas: custodyEvents }), { status: 200 })
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function renderPanel() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(<QueryClientProvider client={client}><OwnerCajaRevisiones negocioId="neg-1" /></QueryClientProvider>))
  await flush()
  return root
}

async function setInputValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

async function openTurnoDetails() {
  const details = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Ver detalle")) as HTMLButtonElement
  await act(async () => details.click())
  await flush()
}

describe("F10-B2.2-D — owner review interface", () => {
  test("shows exact owner figures and requires a note before reviewing a difference", async () => {
    const root = await renderPanel()
    expect(document.body.textContent).toContain("Pendiente de revisión")
    expect(document.body.textContent).toContain("Faltante")
    expect(document.body.textContent).toContain("29,99")
    await openTurnoDetails()
    const form = document.querySelector("form") as HTMLFormElement
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    const input = form.querySelector("input") as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Conteo verificado")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await flush()
    expect(submit.disabled).toBe(false)
    await act(async () => submit.click())
    await flush()
    expect(reviewKeys).toHaveLength(1)
    expect(reviewKeys[0]).toBeTruthy()
    expect(submittedNote).toBe("Conteo verificado")
    await act(async () => root.unmount())
  })
})

describe("F10-B2.2-E — owner cash custody interface", () => {
  test("shows pending disposition, suggests the exact remainder, and requires explicit confirmation", async () => {
    const root = await renderPanel()
    expect(document.body.textContent).toContain("Entrega pendiente")
    const details = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Ver detalle")) as HTMLButtonElement
    await act(async () => details.click())
    await flush()
    const deliveredInput = document.querySelector('input[aria-label="Importe entregado turno-d-1"]') as HTMLInputElement
    expect(deliveredInput.value).toBe("29.99")
    const remainder = document.querySelector('input[aria-label="Fondo remanente turno-d-1"]') as HTMLInputElement
    expect(remainder.value).toBe("0.00")
    await setInputValue(deliveredInput, "25.00")
    await flush()
    expect(remainder.value).toBe("4.99")
    const custodyForm = [...document.querySelectorAll("form")].find((form) => form.textContent?.includes("Confirmo que registré")) as HTMLFormElement
    const submit = custodyForm.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    const checkbox = custodyForm.querySelector('input[type="checkbox"]') as HTMLInputElement
    await act(async () => { checkbox.click() })
    await flush()
    expect(submit.disabled).toBe(false)
    await act(async () => submit.click())
    await flush()
    expect(submittedCustody).toMatchObject({ tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "25.00", fondoRemanente: "4.99", destinoTipo: "DUENO", confirmar: true })
    expect(document.body.textContent).toContain("Entrega registrada correctamente")
    expect([...document.querySelectorAll("form")].some((form) => form.textContent?.includes("Confirmo que registré"))).toBe(false)
    expect(document.body.textContent).toContain("25,00 entregado")
    expect(document.body.textContent).toContain("4,99 remanente")

    const rectify = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Registrar rectificación")) as HTMLButtonElement
    await act(async () => rectify.click())
    await flush()
    const rectificationForm = [...document.querySelectorAll("form")].find((form) => form.textContent?.includes("Confirmo que registré")) as HTMLFormElement
    const rectificationDelivered = rectificationForm.querySelector('input[aria-label="Importe entregado turno-d-1"]') as HTMLInputElement
    const rectificationCheckbox = rectificationForm.querySelector('input[type="checkbox"]') as HTMLInputElement
    const rectificationNote = rectificationForm.querySelector('input[placeholder="Detalle de la recepción o el destino"]') as HTMLInputElement
    expect(rectificationDelivered.value).toBe("25.00")
    expect(rectificationCheckbox.checked).toBe(false)
    expect(rectificationNote.value).toBe("")
    await setInputValue(rectificationDelivered, "24.00")
    await setInputValue(rectificationNote, "Corrección confirmada")
    await act(async () => rectificationCheckbox.click())
    await flush()
    const confirmRectification = rectificationForm.querySelector('button[type="submit"]') as HTMLButtonElement
    await act(async () => confirmRectification.click())
    await flush()
    expect(submittedCustody).toMatchObject({ tipo: "RECTIFICACION", efectivoEntregado: "24.00", fondoRemanente: "5.99", confirmar: true })
    expect(document.body.textContent).toContain("Rectificación registrada correctamente")
    expect([...document.querySelectorAll("form")].some((form) => form.textContent?.includes("Motivo de rectificación"))).toBe(false)
    expect(document.body.textContent).toContain("24,00 entregado")
    expect(document.body.textContent).toContain("5,99 remanente")
    expect(document.body.textContent).toContain("25,00 entregado")
    const reopen = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Registrar rectificación")) as HTMLButtonElement
    await act(async () => reopen.click())
    await flush()
    const reopenedForm = [...document.querySelectorAll("form")].find((form) => form.textContent?.includes("Motivo de rectificación")) as HTMLFormElement
    expect((reopenedForm.querySelector('input[aria-label="Importe entregado turno-d-1"]') as HTMLInputElement).value).toBe("24.00")
    expect((reopenedForm.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
    expect((reopenedForm.querySelector('input[placeholder="Detalle de la recepción o el destino"]') as HTMLInputElement).value).toBe("")
    await act(async () => root.unmount())
  })

  test("accepts a successful idempotent replay and resets the confirmation", async () => {
    custodyPostStatus = 200
    const root = await renderPanel()
    await openTurnoDetails()
    const custodyForm = [...document.querySelectorAll("form")].find((form) => form.textContent?.includes("Confirmo que registré")) as HTMLFormElement
    const checkbox = custodyForm.querySelector('input[type="checkbox"]') as HTMLInputElement
    await act(async () => checkbox.click())
    await flush()
    await act(async () => (custodyForm.querySelector('button[type="submit"]') as HTMLButtonElement).click())
    await flush()
    expect(document.body.textContent).toContain("Entrega registrada correctamente")
    expect([...document.querySelectorAll("form")].some((form) => form.textContent?.includes("Confirmo que registré"))).toBe(false)
    await act(async () => root.unmount())
  })

  test("keeps entered values on failure and prevents duplicate confirmation while pending", async () => {
    custodyPostFailure = "No se pudo confirmar la rectificación"
    const root = await renderPanel()
    await openTurnoDetails()
    const custodyForm = [...document.querySelectorAll("form")].find((form) => form.textContent?.includes("Confirmo que registré")) as HTMLFormElement
    const deliveredInput = custodyForm.querySelector('input[aria-label="Importe entregado turno-d-1"]') as HTMLInputElement
    const checkbox = custodyForm.querySelector('input[type="checkbox"]') as HTMLInputElement
    await setInputValue(deliveredInput, "25.00")
    await act(async () => checkbox.click())
    await flush()
    await act(async () => (custodyForm.querySelector('button[type="submit"]') as HTMLButtonElement).click())
    await flush()
    expect(custodyForm.querySelector('[role="alert"]')?.textContent).toContain("No se pudo confirmar la rectificación")
    expect(document.body.textContent).not.toContain("Entrega registrada correctamente")
    expect(document.body.textContent).not.toContain("Rectificación registrada correctamente")
    expect((custodyForm.querySelector('input[aria-label="Importe entregado turno-d-1"]') as HTMLInputElement).value).toBe("25.00")
    expect((custodyForm.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true)
    expect(document.body.textContent).toContain("Entrega pendiente")
    await act(async () => root.unmount())

    custodyPostFailure = null
    deferCustodyPost = true
    const pendingRoot = await renderPanel()
    await openTurnoDetails()
    const pendingForm = [...document.querySelectorAll("form")].find((form) => form.textContent?.includes("Confirmo que registré")) as HTMLFormElement
    const pendingCheckbox = pendingForm.querySelector('input[type="checkbox"]') as HTMLInputElement
    await act(async () => pendingCheckbox.click())
    await flush()
    const submit = pendingForm.querySelector('button[type="submit"]') as HTMLButtonElement
    await act(async () => submit.click())
    await flush(5)
    expect(submit.disabled).toBe(true)
    expect(submit.textContent).toContain("Registrando")
    await act(async () => submit.click())
    expect(custodyPostCount).toBe(1)
    await act(async () => finishDeferredCustodyPost?.())
    await flush()
    expect(document.body.textContent).toContain("Entrega registrada correctamente")
    await act(async () => pendingRoot.unmount())
  })
})
