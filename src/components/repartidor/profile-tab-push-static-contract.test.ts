/// <reference types="bun-types" />
// P2-T31 (NOTIFICATION-SWITCH-PERSISTENCE-STATE-SYNC): static-contract test
// locking in that Repartidor's push notification switch in profile-tab.tsx
// has NO local shadow state at all — `Switch checked` binds directly to
// `push.isSubscribed` and `onCheckedChange` calls `push.subscribe()` /
// `push.unsubscribe()` without ever reading back a result or a stale
// closure. This makes it structurally immune to both bug classes found and
// fixed for Cliente (stale-seed/no-self-correction local state, see
// client-profile-panel-push-static-contract.test.ts) and Negocio
// (stale-closure post-await read, see
// config-tab-push-static-contract.test.ts). This test exists only to
// prevent a future regression from introducing local shadow state here
// without equivalent hardening — Repartidor had zero push-specific test
// coverage before P2-T31.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("P2-T31 — Repartidor push switch has no local shadow state to desync", () => {
  const src = read("src/components/repartidor/profile-tab.tsx")
  const sectionStart = src.indexOf("{/* Notifications */}")
  const sectionEnd = src.indexOf("\n      )}", sectionStart)
  const section = src.slice(sectionStart, sectionEnd)

  test("the Switch `checked` prop binds directly to push.isSubscribed (no useState mirror)", () => {
    expect(section).toContain("checked={push.isSubscribed}")
  })

  test("no local boolean state is declared for the notifications switch in this component", () => {
    expect(src).not.toMatch(/useState[^\n]*[Nn]otif/)
    expect(src).not.toMatch(/useState\(push\.isSubscribed\)/)
  })

  test("onCheckedChange calls subscribe()/unsubscribe() directly, without reading a result or push.isSubscribed afterwards to set state", () => {
    const handlerStart = section.indexOf("onCheckedChange={")
    const handlerEnd = section.indexOf("}}", handlerStart) + 2
    const handler = section.slice(handlerStart, handlerEnd)
    expect(handler).toContain("push.subscribe()")
    expect(handler).toContain("push.unsubscribe()")
    expect(handler).not.toMatch(/=\s*(await\s+)?push\.(subscribe|unsubscribe)\(\)/)
    expect(handler).not.toContain("setEnabled")
    expect(handler).not.toContain("setNotifications")
  })
})
