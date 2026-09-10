/// <reference types="bun-types" />

// ============================================
// P2T01-17 — deliveries-tab.tsx: contrato estático focal
// ============================================
// Este componente monta useRepartidorTracking(mios) para decidir cuándo
// mostrar el badge "en vivo". No hay entorno DOM configurado repo-wide (sin
// happy-dom/jsdom por defecto) y montar este componente completo requeriría
// duplicar mocks de negocio/pedido/items ajenos a P2-T01 — igual que el
// resto de los contratos estáticos IOS-24/ANDROID-PWA de este repo, esto es
// lectura de texto sobre el código fuente real: prueba que el badge está
// atado a `trackingActive` (server-derived vía isTrackingCoreEligible en
// use-repartidor-tracking.ts, ya exhaustivamente probado en
// use-repartidor-tracking.test.ts) y no a un cálculo local propio ni a un
// texto obsoleto que prometía más de lo real.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const SOURCE = readFileSync(join(process.cwd(), "src", "components", "repartidor", "deliveries-tab.tsx"), "utf-8")

describe("P2T01-17 — deliveries-tab.tsx badge: truthful, server-derived eligibility only", () => {
  test("trackingActive and gpsPermissionDenied come from useRepartidorTracking(mios) — not a locally reimplemented boolean", () => {
    expect(SOURCE).toContain('import { useRepartidorTracking } from "@/hooks/use-repartidor-tracking"')
    expect(SOURCE).toContain("const { trackingActive, gpsPermissionDenied, latestPosition } = useRepartidorTracking(mios)")
  })

  test("the badge renders only when filter is 'mios' AND trackingActive is true", () => {
    expect(SOURCE).toContain('{filter === "mios" && trackingActive && (')
  })

  test("badge wording reflects real eligibility state, not the old overclaiming text", () => {
    expect(SOURCE).not.toContain("Compartiendo ubicación con el cliente")
    expect(SOURCE).toContain("Seguimiento en vivo habilitado")
  })

  test("PedidoDelivery carries the server-resolved trackingEligibleNow flag (P2-T01 mios payload)", () => {
    expect(SOURCE).toMatch(/interface PedidoDelivery[\s\S]*?trackingEligibleNow\?:\s*boolean/)
  })

  // P2-T02-B3 (OPTION-C, §12): BEST_EFFORT_BACKGROUND_TRACKING wording —
  // never "seguimiento garantizado en segundo plano", and a distinct,
  // correctly-worded state when the GPS permission itself is denied.
  test("the badge discloses the best-effort nature of background tracking", () => {
    expect(SOURCE).not.toContain("Android puede pausarla en segundo plano")
    expect(SOURCE).toContain("Tu dispositivo puede pausarla en segundo plano")
  })

  test("gpsPermissionDenied renders a distinct, non-alarmist state instead of the live badge", () => {
    expect(SOURCE).toContain("gpsPermissionDenied ?")
    expect(SOURCE).toContain("Ubicación no disponible")
  })
})
