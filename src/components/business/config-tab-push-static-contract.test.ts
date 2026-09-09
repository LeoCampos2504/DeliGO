/// <reference types="bun-types" />
// P2-T31 (NOTIFICATION-SWITCH-PERSISTENCE-STATE-SYNC): static-contract test —
// proves the Negocio personal Push switch consumer (`PushNotificationsConfig`
// in config-tab.tsx) no longer re-reads a stale closed-over
// `push.isSubscribed` after an `await push.subscribe()/unsubscribe()` to
// decide its own outcome (the exact regressed pattern F-P2-T05-23 already
// eliminated for Cliente, but never ported here), and instead uses the
// hook's fresh `PushMutationResult` — same pattern as
// client-profile-panel-push-static-contract.test.ts. This repo has neither
// jsdom nor React Testing Library (see
// use-push-notifications-static-contract.test.ts), so this is a strict
// static-contract test on the real product source.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("P2-T31 — Negocio PushNotificationsConfig no longer re-reads a stale push.isSubscribed after await", () => {
  const src = read("src/components/business/config-tab.tsx")
  const sectionStart = src.indexOf("function PushNotificationsConfig(")
  const sectionEnd = src.indexOf("\n}\n", src.indexOf("</div>\n  )\n}", sectionStart))
  const section = src.slice(sectionStart, sectionEnd)
  const handlerStart = section.indexOf("const handleToggle")
  const handler = section.slice(handlerStart, section.indexOf("\n  }\n", handlerStart))

  test("the regressed pattern never reappears: no post-await `if (!push.isSubscribed)` / `if (push.isSubscribed)` inside the handler", () => {
    expect(handler).not.toMatch(/if\s*\(\s*!?\s*push\.isSubscribed\s*\)/)
  })

  test("subscribe()/unsubscribe() results are captured and gated by `result.current` before touching local state", () => {
    expect(handler).toContain("const result = await push.subscribe()")
    expect(handler).toContain("const result = await push.unsubscribe()")
    const resultUsages = handler.match(/if\s*\(result\.current\)\s*\{\s*setEnabled\(result\.subscribed\)/g) ?? []
    expect(resultUsages.length).toBe(2) // once for the enable branch, once for the disable branch
  })

  test("a stale mutation result (current:false) is never used to set local state — no unconditional setEnabled after either await", () => {
    // Every `setEnabled(` call inside the handler other than the synchronous
    // optimistic one at the top must be inside the `if (result.current)`
    // guard — i.e. the ONLY unguarded call is the optimistic
    // `setEnabled(val)` before any await.
    const allCalls = [...handler.matchAll(/setEnabled\(([^)]*)\)/g)].map((m) => m[1].trim())
    expect(allCalls).toEqual(["val", "result.subscribed", "result.subscribed"])
  })

  test("render-time reconciliation pattern is untouched by this fix (prevIsSubscribed sync)", () => {
    expect(section).toContain("const [prevIsSubscribed, setPrevIsSubscribed] = useState(push.isSubscribed)")
    expect(section).toContain("if (push.isSubscribed !== prevIsSubscribed) {")
    expect(section).toContain("setPrevIsSubscribed(push.isSubscribed)")
  })
})
