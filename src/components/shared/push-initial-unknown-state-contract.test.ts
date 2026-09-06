// P2-T31-R7 (PUSH-INITIAL-UNKNOWN-STATE-FLICKER-FIX): certifies the SAME
// "never render a false OFF while unresolved" contract independently across
// Cliente/Negocio/Repartidor — sharing `usePushNotifications()` does NOT
// mean the three UIs necessarily render the same thing, so each is checked
// explicitly rather than assumed. No jsdom/React Testing Library in this
// repo (see use-push-notifications-static-contract.test.ts) — static-contract
// style on the real product source, same technique used throughout R6/R6A/R6B.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

function stripComments(src: string): string {
  return src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n")
}

describe("Cliente (client-profile-panel.tsx) — never renders a false OFF while unresolved", () => {
  const src = read("src/components/client/client-profile-panel.tsx")
  const code = stripComments(src)
  const sectionStart = code.indexOf("function SettingsSection(")
  const section = code.slice(sectionStart, code.indexOf("\n}\n", code.indexOf("</SectionCard>", sectionStart)))

  test("the real <Switch> is only reached when statusResolved is true (or push is unsupported) — gated by an explicit ternary, never rendered unconditionally", () => {
    const gateIdx = section.indexOf("push.isSupported && !push.statusResolved")
    expect(gateIdx).toBeGreaterThan(-1)
    const switchIdx = section.indexOf("<Switch", gateIdx)
    const loaderIdx = section.indexOf("Loader2", gateIdx)
    expect(loaderIdx).toBeGreaterThan(-1)
    expect(loaderIdx).toBeLessThan(switchIdx) // the neutral branch comes first in the ternary
  })

  test("the neutral branch never sets checked={false} or any OFF-implying prop — it's a Loader2, not a Switch", () => {
    const gateIdx = section.indexOf("push.isSupported && !push.statusResolved")
    const neutralBranchEnd = section.indexOf(") : (", gateIdx)
    const neutralBranch = section.slice(gateIdx, neutralBranchEnd)
    expect(neutralBranch).toContain("Loader2")
    expect(neutralBranch).not.toContain("<Switch")
  })

  test("status text distinguishes 'Comprobando estado...' from 'Desactivadas' — never collapses unresolved into the OFF label", () => {
    expect(section).toContain("Comprobando estado...")
    const textBlockStart = section.indexOf("push.loading")
    const textBlockEnd = section.indexOf("</p>", textBlockStart)
    const textBlock = section.slice(textBlockStart, textBlockEnd)
    // statusResolved check must appear BEFORE the notifications ? "Activadas" : "Desactivadas" branch
    expect(textBlock.indexOf("!push.statusResolved")).toBeLessThan(textBlock.indexOf('"Desactivadas"'))
  })
})

describe("Negocio (config-tab.tsx) — same contract, independently verified", () => {
  const src = read("src/components/business/config-tab.tsx")
  const code = stripComments(src)
  const sectionStart = code.indexOf("function PushNotificationsConfig(")
  const section = code.slice(sectionStart, code.indexOf("\nfunction ", sectionStart + 1))

  test("the real <Switch> is only reached when statusResolved is true (or push is unsupported)", () => {
    const gateIdx = section.indexOf("push.isSupported && !push.statusResolved")
    expect(gateIdx).toBeGreaterThan(-1)
    const switchIdx = section.indexOf("<Switch", gateIdx)
    const loaderIdx = section.indexOf("Loader2", gateIdx)
    expect(loaderIdx).toBeGreaterThan(-1)
    expect(loaderIdx).toBeLessThan(switchIdx)
  })

  test("the neutral branch is a Loader2, never a Switch with checked={false}", () => {
    const gateIdx = section.indexOf("push.isSupported && !push.statusResolved")
    const neutralBranchEnd = section.indexOf(") : (", gateIdx)
    const neutralBranch = section.slice(gateIdx, neutralBranchEnd)
    expect(neutralBranch).toContain("Loader2")
    expect(neutralBranch).not.toContain("<Switch")
  })

  test("the Bell/BellOff icon also avoids BellOff (an OFF-implying icon) while unresolved", () => {
    const iconGateIdx = section.indexOf("!push.statusResolved")
    expect(iconGateIdx).toBeGreaterThan(-1)
    const iconBranchEnd = section.indexOf(") : enabled ? (", iconGateIdx)
    const iconBranch = section.slice(iconGateIdx, iconBranchEnd)
    expect(iconBranch).not.toContain("BellOff")
  })

  test("status text distinguishes 'Comprobando estado...' from 'No recibirás notificaciones'", () => {
    expect(section).toContain("Comprobando estado...")
    const textBlockStart = section.indexOf("push.loading")
    const textBlockEnd = section.indexOf("</p>", textBlockStart)
    const textBlock = section.slice(textBlockStart, textBlockEnd)
    expect(textBlock.indexOf("!push.statusResolved")).toBeLessThan(textBlock.indexOf('"No recibirás notificaciones"'))
  })
})

describe("Repartidor (profile-tab.tsx) — same contract, no local mirror but still never a false OFF", () => {
  const src = read("src/components/repartidor/profile-tab.tsx")
  const code = stripComments(src)
  const sectionStart = code.indexOf('{/* Notifications */}'.replace("{/* Notifications */}", "push.isSupported && ("))
  // Fallback: locate by the Notifications heading text if the exact marker above isn't found.
  const anchor = sectionStart > -1 ? sectionStart : code.indexOf("Notificaciones push")
  const section = code.slice(Math.max(anchor - 400, 0), anchor + 1200)

  test("the real <Switch> is gated behind push.statusResolved (not negated) — never rendered directly with push.isSubscribed alone", () => {
    expect(code).toContain("{push.statusResolved ? (")
    const gateIdx = code.indexOf("{push.statusResolved ? (")
    const switchIdx = code.indexOf("<Switch", gateIdx)
    const loaderIdx = code.indexOf("Loader2", gateIdx)
    expect(switchIdx).toBeGreaterThan(gateIdx)
    expect(loaderIdx).toBeGreaterThan(switchIdx) // Loader2 is the ELSE branch here (resolved ? Switch : Loader2)
  })

  test("the neutral (unresolved) branch is a Loader2, never a bare Switch bound to push.isSubscribed", () => {
    const gateIdx = code.indexOf("{push.statusResolved ? (")
    const elseIdx = code.indexOf(") : (", gateIdx)
    const neutralBranch = code.slice(elseIdx, code.indexOf(")}", elseIdx))
    expect(neutralBranch).toContain("Loader2")
    expect(neutralBranch).not.toContain("<Switch")
  })

  test("the Bell/BellOff icon avoids BellOff while unresolved", () => {
    expect(code).toContain("{!push.statusResolved ? (")
    const iconGateIdx = code.indexOf("{!push.statusResolved ? (")
    const iconBranchEnd = code.indexOf(") : push.isSubscribed ? (", iconGateIdx)
    const iconBranch = code.slice(iconGateIdx, iconBranchEnd)
    expect(iconBranch).not.toContain("BellOff")
  })

  test("status text distinguishes 'Comprobando estado...' from 'Activá para recibir alertas de entregas'", () => {
    expect(code).toContain("Comprobando estado...")
    const textIdx = code.indexOf("!push.statusResolved")
    const desactivadoIdx = code.indexOf("Activá para recibir alertas de entregas")
    expect(textIdx).toBeGreaterThan(-1)
    expect(textIdx).toBeLessThan(desactivadoIdx)
  })
})

describe("Consistency across all three roles", () => {
  test("all three import Loader2 from lucide-react (already used elsewhere in each file, reused rather than introducing a new spinner)", () => {
    for (const path of [
      "src/components/client/client-profile-panel.tsx",
      "src/components/business/config-tab.tsx",
      "src/components/repartidor/profile-tab.tsx",
    ]) {
      const src = read(path)
      expect(src).toContain("Loader2")
    }
  })

  test("all three reference push.statusResolved at least twice (icon/text + switch gating)", () => {
    for (const path of [
      "src/components/client/client-profile-panel.tsx",
      "src/components/business/config-tab.tsx",
      "src/components/repartidor/profile-tab.tsx",
    ]) {
      const src = read(path)
      const occurrences = [...src.matchAll(/push\.statusResolved/g)]
      expect(occurrences.length).toBeGreaterThanOrEqual(2)
    }
  })
})
