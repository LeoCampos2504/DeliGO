import { describe, expect, test } from "bun:test"
import { transitionPwaInstallState } from "./pwa-install-state"

describe("P2-T38 — authoritative PWA install state transitions", () => {
  test("a fresh beforeinstallprompt opportunity enables the native CTA", () => {
    expect(transitionPwaInstallState("idle", "prompt-available")).toBe("available")
  })

  test("the native prompt can only be started from an available opportunity", () => {
    expect(transitionPwaInstallState("available", "prompt-started")).toBe("prompting")
    expect(transitionPwaInstallState("idle", "prompt-started")).toBe("idle")
  })

  test("acceptance enters indeterminate background installation, never installed", () => {
    expect(transitionPwaInstallState("prompting", "prompt-accepted")).toBe("installing-background")
    expect(transitionPwaInstallState("installing-background", "prompt-accepted")).toBe("installing-background")
  })

  test("dismissal and prompt failure clear transient states without claiming success", () => {
    expect(transitionPwaInstallState("prompting", "prompt-dismissed")).toBe("idle")
    expect(transitionPwaInstallState("prompting", "prompt-failed")).toBe("idle")
    expect(transitionPwaInstallState("idle", "prompt-dismissed")).toBe("idle")
  })

  test("appinstalled records a browser event but never confirms launcher-ready", () => {
    expect(transitionPwaInstallState("installing-background", "app-installed")).toBe("browser-install-event-received")
    expect(transitionPwaInstallState("idle", "app-installed")).toBe("browser-install-event-received")
    expect(transitionPwaInstallState("browser-install-event-received", "prompt-accepted")).toBe("browser-install-event-received")
  })

  test("physical-failure replay: accepted + early appinstalled never reaches installed-confirmed", () => {
    let state = transitionPwaInstallState("idle", "prompt-available")
    state = transitionPwaInstallState(state, "prompt-started")
    state = transitionPwaInstallState(state, "prompt-accepted")
    expect(state).toBe("installing-background")
    state = transitionPwaInstallState(state, "app-installed")
    expect(state).toBe("browser-install-event-received")
    expect(state).not.toBe("installed-confirmed")
  })

  test("only observing standalone confirms the PWA is running as an app", () => {
    expect(transitionPwaInstallState("idle", "standalone-detected")).toBe("installed-confirmed")
    expect(transitionPwaInstallState("browser-install-event-received", "standalone-detected")).toBe("installed-confirmed")
  })

  test("a delayed accepted result cannot downgrade standalone confirmation", () => {
    expect(transitionPwaInstallState("installed-confirmed", "prompt-accepted")).toBe("installed-confirmed")
    expect(transitionPwaInstallState("installed-confirmed", "prompt-available")).toBe("installed-confirmed")
  })

  test("a newly emitted beforeinstallprompt enables retry after a dismissed prompt", () => {
    const dismissed = transitionPwaInstallState("prompting", "prompt-dismissed")
    expect(transitionPwaInstallState(dismissed, "prompt-available")).toBe("available")
  })
})
