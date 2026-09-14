import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string) {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("P2-T44-R1 PyR personal Push UX static contract", () => {
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

  test("PyR page exposes status and activate/deactivate actions without adding a test action", () => {
    expect(page).toContain("useOperativoPyrPush")
    expect(page).toContain("Activar avisos de pedidos y reseñas")
    expect(page).toContain("Desactivar avisos de pedidos y reseñas")
    expect(page).not.toContain("Enviar prueba")
  })
})
