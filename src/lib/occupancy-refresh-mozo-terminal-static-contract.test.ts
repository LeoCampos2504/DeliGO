/// <reference types="bun-types" />
// Revalidación de ocupación en el panel de mesas del mozo y en el Salón de terminal (incidencia de la certificación
// T1–T3, C5; preexistente respecto de T1–T3). Mismo patrón que el Salón personal (P2-T48) y el Salón del dueño
// (P2-T53): cada lectura exitosa del panel —sondeo o botón «Actualizar»— cambia un `refreshKey` que hace que
// MesaOccupancyControl vuelva a consultar su endpoint canónico. La ocupación nunca se deduce del panel ni de pedidos.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const read = (relPath: string) => readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8").replace(/\r\n/g, "\n")

const mozo = read("src/app/mozo/panel/[slug]/page.tsx")
const terminal = read("src/app/operaciones/salon/page.tsx")
const control = read("src/components/operativo/mesa-occupancy-control.tsx")

describe("panel de mesas del mozo", () => {
  test("cada lectura exitosa del panel (sondeo o «Actualizar») incrementa la señal de revalidación", () => {
    expect(mozo).toContain("const [occupationRefreshKey, setOccupationRefreshKey] = useState(0)")
    const load = mozo.slice(mozo.indexOf("const loadPanel = useCallback"), mozo.indexOf("}, [invalidateSilentRefresh, slug, syncReadyMesaOrders"))
    const ready = load.indexOf('setState({ status: "ready", data })')
    const bump = load.indexOf("setOccupationRefreshKey((current) => current + 1)")
    expect(ready).toBeGreaterThan(-1)
    expect(bump).toBeGreaterThan(ready)
    // Nunca en las ramas de error, sin sesión o sin acceso (están antes de la lectura exitosa).
    expect(load.slice(0, ready)).not.toContain("setOccupationRefreshKey")
    // El sondeo y el botón usan la misma función: no hay un segundo camino de refresco.
    expect(mozo).toContain("void loadPanel({ silent: true })")
  })

  test("la señal llega al control de cada mesa asignada, con la misma familia de sesión", () => {
    expect(mozo).toContain("occupationRefreshKey={occupationRefreshKey}")
    expect(mozo).toMatch(/<MesaOccupancyControl[\s\S]*?refreshKey=\{occupationRefreshKey\}[\s\S]*?actorFamily="cuenta_operativa"/)
    expect(mozo).toContain("allowClose={false}")
  })
})

describe("Salón de terminal", () => {
  test("cada lectura exitosa del panel incrementa la señal y llega al control de la mesa seleccionada", () => {
    expect(terminal).toContain("const [occupationRefreshKey, setOccupationRefreshKey] = useState(0)")
    const refresh = terminal.slice(terminal.indexOf("const refresh = useCallback"), terminal.indexOf("useEffect(", terminal.indexOf("const refresh = useCallback")))
    const ready = refresh.indexOf('kind: "ready"')
    const bump = refresh.indexOf("setOccupationRefreshKey((current) => current + 1)")
    expect(ready).toBeGreaterThan(-1)
    expect(bump).toBeGreaterThan(ready)
    expect(refresh.slice(0, ready)).not.toContain("setOccupationRefreshKey")
    expect(terminal).toContain("occupationRefreshKey={occupationRefreshKey}")
    expect(terminal).toMatch(/<MesaOccupancyControl[\s\S]*?refreshKey=\{occupationRefreshKey\}[\s\S]*?actorFamily="terminal"/)
  })
})

describe("autoridad de ocupación sin cambios", () => {
  test("el control sigue consultando sólo su endpoint canónico y se revalida por refreshKey", () => {
    expect(control).toContain("fetchMesaOccupancyStatus(mesaId, controller.signal, actorFamily)")
    expect(control).toContain("}, [mesaId, refreshKey, actorFamily])")
    // Una revalidación nueva aborta la consulta anterior en curso (sin solicitudes superpuestas).
    expect(control).toContain("controller.abort()")
  })

  test("los hosts no deducen la ocupación del panel ni de los pedidos", () => {
    for (const host of [mozo, terminal]) {
      expect(host).not.toMatch(/ocupacionActiva\s*=|hasActiveOccupancy/)
    }
  })
})
