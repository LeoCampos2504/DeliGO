import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string) {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("P2-T44-R1D account-level Push UX static contract", () => {
  const src = read("src/hooks/use-operativo-pyr-push.ts")
  const page = read("src/app/operaciones/mi-panel/[slug]/pyr/pedidos/page.tsx")

  test("encapsulates all normal Push states and the PyR endpoint", () => {
    for (const state of ["checking", "unsupported", "needs-install", "idle", "activating", "active", "blocked", "error"]) {
      expect(src).toContain(`"${state}"`)
    }
    expect(src).toContain("/api/operativo/pyr/panel/${encodeURIComponent(slug)}/push-subscription")
    expect(src).toContain("Notification.requestPermission()")
    expect(src).toContain("getCurrentOperativePushSubscription")
  })

  test("PyR page does not expose an area-level Push toggle", () => {
    expect(page).not.toContain("useOperativoPyrPush")
    expect(page).not.toContain("push-subscription")
    expect(page).not.toContain("Activar avisos de pedidos y reseñas")
    expect(page).not.toContain("Desactivar avisos de pedidos y reseñas")
    expect(page).not.toContain("Enviar prueba")
  })
})
