/// <reference types="bun-types" />
// P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): static-contract test — same
// source-level assertion strategy as chat-sheet.test.tsx/chat-fab.test.tsx/
// chat-view.test.tsx (no React Testing Library exists in this repository's
// test stack).
//
// share-target-flow.tsx is a SECOND, previously undocumented productive
// caller of /api/chat/conversaciones and POST /api/chat/mensajes/[pedidoId]
// (discovered during P2-T18-BLOCKER-AUTH2-R13-R1's exhaustive caller
// inventory — chat-sheet.tsx's "sole owner" comment for conversaciones is
// stale, not a functional bug). Its trusted family source is the `role`
// prop itself ("cliente" | "negocio", the "operaciones" branch always
// returns before reaching either call site) — an even more direct source
// than useAuthStore().user?.type, since it's fixed at compile time by the
// page that renders the component (/cliente/share-target,
// /negocio/share-target), never derived at runtime.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const shareTargetFlowSource = () => readFileSync(resolve(import.meta.dir, "share-target-flow.tsx"), "utf8")

describe("ShareTargetFlow — F-P2-T18-AUTH02 actorFamily selector propagation", () => {
  test("loadTargets' conversaciones fetch carries an explicit actorFamily=<role> selector", () => {
    const source = shareTargetFlowSource()
    expect(source).toContain(
      'const res = await fetch(`/api/chat/conversaciones?actorFamily=${role}`, { cache: "no-store" })',
    )
  })

  test("sendToTarget's mensajes POST carries an explicit actorFamily=<role> selector", () => {
    const source = shareTargetFlowSource()
    expect(source).toContain(
      "const msgRes = await fetch(`/api/chat/mensajes/${encodeURIComponent(pedidoId)}?actorFamily=${role}`, {",
    )
  })

  test("both call sites are reached only after the operaciones branch has already returned (role is narrowed to \"cliente\" | \"negocio\" there)", () => {
    const source = shareTargetFlowSource()
    const loadTargetsStart = source.indexOf("async function loadTargets")
    const loadTargetsOperacionesReturn = source.indexOf("return { ok: true, targets }", loadTargetsStart)
    const loadTargetsConversacionesFetch = source.indexOf("/api/chat/conversaciones?actorFamily=", loadTargetsStart)
    expect(loadTargetsOperacionesReturn).toBeGreaterThan(-1)
    expect(loadTargetsConversacionesFetch).toBeGreaterThan(loadTargetsOperacionesReturn)

    const sendToTargetStart = source.indexOf("async function sendToTarget")
    const sendToTargetOperacionesReturn = source.indexOf('if (res.ok) return { ok: true }', sendToTargetStart)
    const sendToTargetMensajesFetch = source.indexOf("/api/chat/mensajes/${encodeURIComponent(pedidoId)}?actorFamily=", sendToTargetStart)
    expect(sendToTargetOperacionesReturn).toBeGreaterThan(-1)
    expect(sendToTargetMensajesFetch).toBeGreaterThan(sendToTargetOperacionesReturn)
  })

  test("the family source is the role prop, never useAuthStore or window.location.pathname", () => {
    const source = shareTargetFlowSource()
    expect(source).not.toContain("useAuthStore")
    expect(source).not.toContain("activeSessionFamily(")
    expect(source).not.toContain("window.location.pathname")
  })
})
