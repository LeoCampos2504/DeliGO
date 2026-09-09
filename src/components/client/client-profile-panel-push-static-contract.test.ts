/// <reference types="bun-types" />
// P2-T05 Hardening H3B (F-P2-T05-23): static-contract test — proves the
// Cliente personal Push switch consumer (`SettingsSection` in
// client-profile-panel.tsx) no longer re-reads a stale closed-over
// `push.isSubscribed` after an `await push.subscribe()/unsubscribe()` to
// decide its own outcome, and instead uses the hook's fresh
// `PushMutationResult`. This repo has neither jsdom nor React Testing
// Library (see use-push-notifications-static-contract.test.ts), so this is
// a strict static-contract test on the real product source — the real
// external-browser reproduction of F-P2-T05-23/F18 already exists
// (Hardening H3, Claude external Chrome+CDP session) and the deployed fix
// will receive a post-deploy real-browser re-confirmation.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("F-P2-T05-23 — Cliente SettingsSection no longer re-reads a stale push.isSubscribed after await", () => {
  const src = read("src/components/client/client-profile-panel.tsx")
  const sectionStart = src.indexOf("function SettingsSection(")
  const sectionEnd = src.indexOf("\n}\n", src.indexOf("</SectionCard>", sectionStart))
  const section = src.slice(sectionStart, sectionEnd)
  const handlerStart = section.indexOf("const handleToggleNotifications")
  const handler = section.slice(handlerStart, section.indexOf("\n  }\n", handlerStart))

  test("the regressed pattern never reappears: no post-await `if (!push.isSubscribed)` / `if (push.isSubscribed)` inside the handler", () => {
    expect(handler).not.toMatch(/if\s*\(\s*!?\s*push\.isSubscribed\s*\)/)
  })

  test("subscribe()/unsubscribe() results are captured and gated by `result.current` before touching local state", () => {
    expect(handler).toContain("const result = await push.subscribe()")
    expect(handler).toContain("const result = await push.unsubscribe()")
    const resultUsages = handler.match(/if\s*\(result\.current\)\s*\{\s*setNotifications\(result\.subscribed\)/g) ?? []
    expect(resultUsages.length).toBe(2) // once for the enable branch, once for the disable branch
  })

  test("a stale mutation result (current:false) is never used to set local state — no unconditional setNotifications after either await", () => {
    // Every `setNotifications(` call inside the handler other than the
    // synchronous optimistic one at the top must be inside the
    // `if (result.current)` guard — i.e. the ONLY unguarded call is the
    // optimistic `setNotifications(enabled)` before any await.
    const allCalls = [...handler.matchAll(/setNotifications\(([^)]*)\)/g)].map((m) => m[1].trim())
    expect(allCalls).toEqual(["enabled", "result.subscribed", "result.subscribed"])
  })

  test("render-time reconciliation mirrors the already-certified config-tab.tsx pattern (prevIsSubscribed sync)", () => {
    expect(section).toContain("const [prevIsSubscribed, setPrevIsSubscribed] = useState(push.isSubscribed)")
    expect(section).toContain("if (push.isSubscribed !== prevIsSubscribed) {")
    expect(section).toContain("setPrevIsSubscribed(push.isSubscribed)")
    expect(section).toContain("setNotifications(push.isSubscribed)")
  })

  test("P2-T31: SettingsSection no longer seeds from the untrustworthy `pushEnabled` prop (stale React Query cache of the legacy DB column)", () => {
    // Root cause of the reported Android desync (P2_T31_...md): `pushEnabled`
    // came from `perfil.pushSubscription` (queryKey "cliente-perfil"), never
    // invalidated after subscribe()/unsubscribe(), so a stale cached value
    // could seed `notifications` wrong on remount — and the render-time
    // reconciliation below could never self-correct a false-positive "ON"
    // because its own tracking var also defaults to `push.isSubscribed`'s
    // initial `false`. The seed must come ONLY from the hook.
    const codeOnly = section
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
    expect(codeOnly).not.toContain("pushEnabled")
    expect(section).toContain("function SettingsSection() {")
    expect(section).toContain("const [notifications, setNotifications] = useState(push.isSubscribed)")
  })

  test("P2-T31: the call site no longer passes a pushEnabled prop", () => {
    expect(src).toContain("<SettingsSection />")
    expect(src).not.toMatch(/<SettingsSection\s+pushEnabled=/)
  })
})

describe("F-P2-T05-23 — scope purity: Negocio/Repartidor consumers untouched by this fix", () => {
  test("config-tab.tsx (Negocio) keeps its own pre-existing reconciliation pattern, unmodified by H3B", () => {
    const businessSrc = read("src/components/business/config-tab.tsx")
    expect(businessSrc).toContain("const [prevIsSubscribed, setPrevIsSubscribed] = useState(push.isSubscribed)")
  })

  test("profile-tab.tsx (Repartidor) still binds directly to push.isSubscribed, unmodified by H3B", () => {
    const repartidorSrc = read("src/components/repartidor/profile-tab.tsx")
    expect(repartidorSrc).toContain("checked={push.isSubscribed}")
  })
})
