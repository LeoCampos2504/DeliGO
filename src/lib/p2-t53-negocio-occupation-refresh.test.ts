/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()

function read(relPath: string): string {
  return readFileSync(join(ROOT, ...relPath.split("/")), "utf-8")
}

const dialog = read("src/components/operativo/mesa-cuenta-dialog.tsx")
const salon = read("src/components/business/salon-tab.tsx")
const occupancyControl = read("src/components/operativo/mesa-occupancy-control.tsx")

describe("P2-T53-R1 — cierre comercial y refresh de ocupación en Negocio", () => {
  test("MesaCuentaDialog mantiene onClosed opcional para consumidores existentes", () => {
    expect(dialog).toContain("onClosed?: () => void")
    expect(dialog).toMatch(/export function MesaCuentaDialog\(\{[^}]*onClosed[^}]*canClose = true/)
  })

  test("el callback sólo ocurre una vez, después de actualizar la cuenta en el éxito", () => {
    expect((dialog.match(/onClosed\?\.\(\)/g) ?? []).length).toBe(1)
    const accountUpdate = dialog.indexOf("setCuenta(data)", dialog.indexOf("const data ="))
    const callback = dialog.indexOf("onClosed?.()")
    const successToast = dialog.indexOf('toast.success("Cuenta cerrada. La mesa quedó libre.")')
    expect(accountUpdate).toBeGreaterThan(-1)
    expect(callback).toBeGreaterThan(accountUpdate)
    expect(callback).toBeLessThan(successToast)
  })

  test("las respuestas inválidas o errores retornan antes del callback", () => {
    const callback = dialog.indexOf("onClosed?.()")
    const successStart = dialog.indexOf("const data = (await res.json().catch(() => null))")
    const successBlock = dialog.slice(successStart, callback)
    expect(successBlock).toContain("if (!data || data.ok !== true)")
    expect(successBlock).toContain("return")
    expect(dialog.slice(0, callback)).toContain("if (!res.ok)")
    expect(dialog.slice(0, callback)).toContain("if (res.status === 409)")
  })

  test("double close permanece bloqueado por el guard existente", () => {
    expect(dialog).toContain("if (!cuenta || closing) return")
    expect(dialog).toContain("setClosing(true)")
    expect(dialog).toContain("setClosing(false)")
  })

  test("Negocio invalida mesas y cambia refreshKey únicamente tras cierre comercial exitoso", () => {
    expect(salon).toContain("const [occupationRefreshKey, setOccupationRefreshKey] = useState(0)")
    expect(salon).toContain('void queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })')
    expect(salon).toContain("setOccupationRefreshKey((current) => current + 1)")
    expect(salon).toMatch(/<MesaCuentaDialog[^>]*onClosed=\{onOccupationClosed\}/)
    expect(salon).toMatch(/<MesaOccupancyControl[\s\S]*?refreshKey=\{occupationRefreshKey\}/)
    expect(salon).toContain("allowClose={false}")
  })

  test("el host no usa pedidos como autoridad y no agrega realtime/polling global", () => {
    const accountRefreshBlock = salon.slice(salon.indexOf("onOccupationClosed={() => {"), salon.indexOf("onClose={() =>", salon.indexOf("onOccupationClosed={() => {")))
    expect(accountRefreshBlock).toContain('queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })')
    expect(accountRefreshBlock).toContain("setOccupationRefreshKey")
    expect(accountRefreshBlock).not.toContain("mesa-orders")
    expect(accountRefreshBlock).not.toContain("socket")
    expect(accountRefreshBlock).not.toContain("refetchInterval")
  })

  test("MesaOccupancyControl conserva su contrato de revalidación por refreshKey", () => {
    expect(occupancyControl).toContain("}, [mesaId, refreshKey])")
    expect(occupancyControl).toContain("onClosed?.()")
  })
})
