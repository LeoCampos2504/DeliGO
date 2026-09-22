// P2-T40-R1 — unit tests for the device-scoped M2 manual opt-out marker.
// Covers exactly the guarantees the R1 prompt required: scoped by both
// ownerType and ownerId (never leaks across accounts or across actor
// families), never throws when storage is unavailable (private browsing),
// and its key never embeds anything beyond the two identifiers.
import { afterEach, beforeEach, describe, expect, test } from "bun:test"

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

// Bun runs every test file in the SAME process — a `globalThis.window` shim
// left behind here would leak into whichever file loads next in a combined
// `bun test` invocation (confirmed: it broke src/hooks/use-install-prompt.ts,
// which checks `typeof window !== "undefined"` at module-load time and then
// calls the real browser `window.matchMedia`, absent from this bare shim).
// Always restore the pristine (undefined) globals afterward.
beforeEach(() => {
  ;(globalThis as unknown as { window: unknown }).window = globalThis
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
})

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage
})

describe("push-manual-optout", () => {
  test("set then has returns true, scoped by ownerType+ownerId", async () => {
    const { setPushManualOptOut, hasPushManualOptOut } = await import("./push-manual-optout")
    setPushManualOptOut("cliente", "cliente-A")
    expect(hasPushManualOptOut("cliente", "cliente-A")).toBe(true)
  })

  test("never returns true for a different ownerId (no cross-account leak)", async () => {
    const { setPushManualOptOut, hasPushManualOptOut } = await import("./push-manual-optout")
    setPushManualOptOut("cliente", "cliente-A")
    expect(hasPushManualOptOut("cliente", "cliente-B")).toBe(false)
  })

  test("never returns true for a different ownerType with the same id (no cross-family leak)", async () => {
    const { setPushManualOptOut, hasPushManualOptOut } = await import("./push-manual-optout")
    setPushManualOptOut("cliente", "shared-id")
    expect(hasPushManualOptOut("cuenta_operativa", "shared-id")).toBe(false)
  })

  test("clear removes only that owner's marker", async () => {
    const { setPushManualOptOut, clearPushManualOptOut, hasPushManualOptOut } = await import("./push-manual-optout")
    setPushManualOptOut("cliente", "cliente-A")
    setPushManualOptOut("negocio", "negocio-A")
    clearPushManualOptOut("cliente", "cliente-A")
    expect(hasPushManualOptOut("cliente", "cliente-A")).toBe(false)
    expect(hasPushManualOptOut("negocio", "negocio-A")).toBe(true)
  })

  test("key never embeds anything beyond ownerType and ownerId", async () => {
    const { pushManualOptOutKey } = await import("./push-manual-optout")
    expect(pushManualOptOutKey("repartidor", "r-1")).toBe("deligo-push-optout:repartidor:r-1")
  })

  test("hasPushManualOptOut never throws when localStorage.getItem throws (private browsing)", async () => {
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: () => {
        throw new Error("SecurityError: storage blocked")
      },
    }
    const { hasPushManualOptOut } = await import("./push-manual-optout")
    expect(hasPushManualOptOut("cliente", "cliente-A")).toBe(false)
  })

  test("setPushManualOptOut never throws when localStorage is entirely absent", async () => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage
    const { setPushManualOptOut, hasPushManualOptOut } = await import("./push-manual-optout")
    expect(() => setPushManualOptOut("cliente", "cliente-A")).not.toThrow()
    expect(hasPushManualOptOut("cliente", "cliente-A")).toBe(false)
  })
})
