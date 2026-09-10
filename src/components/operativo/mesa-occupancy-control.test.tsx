import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { MesaOccupancyControl } = await import("./mesa-occupancy-control")

const originalFetch = globalThis.fetch

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

async function flushEffects() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

function renderControl(refreshKey: number) {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)

  act(() => {
    root.render(
      React.createElement(MesaOccupancyControl, {
        mesaId: "mesa-1",
        mesaNumero: 1,
        allowClose: false,
        refreshKey,
      })
    )
  })

  return {
    host,
    root,
    rerender(nextRefreshKey: number) {
      act(() => {
        root.render(
          React.createElement(MesaOccupancyControl, {
            mesaId: "mesa-1",
            mesaNumero: 1,
            allowClose: false,
            refreshKey: nextRefreshKey,
          })
        )
      })
    },
    cleanup() {
      act(() => root.unmount())
      host.remove()
    },
  }
}

beforeEach(() => {
  document.body.innerHTML = ""
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("P2-T48 — MesaOccupancyControl refresh de ocupación canónica", () => {
  test("revalida cuando el polling del Salón cambia refreshKey: none stale → active", async () => {
    const fetchMock = mock()
      .mockResolvedValueOnce(response({ hasActiveOccupancy: false, occupancy: null }))
      .mockResolvedValueOnce(
        response({
          hasActiveOccupancy: true,
          occupancy: {
            id: "ocupacion-1",
            startedAt: "2026-09-10T12:00:00.000Z",
            lastActivityAt: "2026-09-10T12:01:00.000Z",
          },
        })
      )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const control = renderControl(0)
    await flushEffects()
    expect(control.host.textContent).toContain("Sin ocupación activa")

    control.rerender(1)
    await flushEffects()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(control.host.textContent).toContain("Ocupación activa")
    expect(control.host.textContent).not.toContain("Sin ocupación activa")
    control.cleanup()
  })

  test("una ocupación activa sigue visible aunque la respuesta posterior tenga cero pedidos", async () => {
    const fetchMock = mock().mockResolvedValue(
      response({
        hasActiveOccupancy: true,
        occupancy: {
          id: "ocupacion-1",
          startedAt: "2026-09-10T12:00:00.000Z",
          lastActivityAt: "2026-09-10T12:01:00.000Z",
        },
      })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const control = renderControl(0)
    await flushEffects()
    control.rerender(1)
    await flushEffects()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(control.host.textContent).toContain("Ocupación activa")
    expect(control.host.textContent).not.toContain("Sin ocupación activa")
    control.cleanup()
  })

  test("no entra en ciclo de refresh si un 403 persiste durante la revalidación", async () => {
    const onAccessDenied = mock()
    const fetchMock = mock().mockResolvedValue(response({ error: "forbidden" }, 403))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)

    function render(refreshKey: number) {
      act(() => {
        root.render(
          React.createElement(MesaOccupancyControl, {
            mesaId: "mesa-1",
            mesaNumero: 1,
            allowClose: false,
            refreshKey,
            onAccessDenied,
          })
        )
      })
    }

    render(0)
    await flushEffects()
    render(1)
    await flushEffects()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onAccessDenied).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
    host.remove()
  })
})
