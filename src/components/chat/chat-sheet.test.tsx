import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// No DOM rendering dependency exists in this repository's test stack, and
// this task must not add one (see CODEX_REPORT.md, "SHARED REALTIME —
// CHAT ACTIVE-MESSAGE RESYNC — V6 LOCAL IMPLEMENTATION FINAL"). This file
// therefore proves the coverage-token publication contract structurally —
// exact call-site shape, ordering relative to the existing cancellation
// guard, and absence of forbidden behaviors — using the same source-level
// assertion strategy already established by
// src/lib/chat-consumer-static-contract.test.ts. The pure identity/
// baseline logic the token relies on (createCoverageToken,
// isFreshCoverageSignal, resolveCoverageBaseline) is exhaustively unit
// tested in src/lib/chat-history-resync.test.ts; this file verifies
// ChatSheet actually WIRES that logic in the required, safe place.

const chatSheetSource = () => readFileSync(resolve(import.meta.dir, "chat-sheet.tsx"), "utf8")

describe("ChatSheet — exact Chat room coverage token publication", () => {
  test("imports the coverage-token helper from the shared pure history-resync module", () => {
    const source = chatSheetSource()
    expect(source).toContain('from "@/lib/chat-history-resync"')
    expect(source).toContain("createCoverageToken")
  })

  test("computes actorKey using the same convention already used elsewhere in Chat's lifecycle guards", () => {
    const source = chatSheetSource()
    expect(source).toContain("const actorKey = user ? `${user.type}:${user.id}` : null")
  })

  test("publishes the token via a monotonic generation ref, never a raw boolean", () => {
    const source = chatSheetSource()
    expect(source).toContain("coverageGenerationRef")
    expect(source).toContain("coverageGenerationRef.current += 1")
    expect(source).toContain("useState<ChatRoomCoverageToken | null>(null)")
  })

  test("token creation call sits INSIDE the acquire success branch, after the existing cancelled guard, alongside markMessagesRead", () => {
    const source = chatSheetSource()
    const cancelledGuardIndex = source.indexOf("if (cancelled) {")
    const markReadIndex = source.indexOf("client.markMessagesRead(activePedidoId)")
    const tokenPublishIndex = source.indexOf("setCoverageToken(createCoverageToken(")
    expect(cancelledGuardIndex).toBeGreaterThan(-1)
    expect(markReadIndex).toBeGreaterThan(-1)
    expect(tokenPublishIndex).toBeGreaterThan(-1)
    // Publication must be textually AFTER both the cancelled-guard check
    // and the existing markMessagesRead call — i.e. it lives in exactly
    // the same "acquire is still current" branch, never before it.
    expect(tokenPublishIndex).toBeGreaterThan(cancelledGuardIndex)
    expect(tokenPublishIndex).toBeGreaterThan(markReadIndex)
  })

  test("a cancelled/stale acquire success releases the lease and returns BEFORE any token publication could run", () => {
    const source = chatSheetSource()
    const cancelledBranch = source.slice(
      source.indexOf("if (cancelled) {"),
      source.indexOf("if (cancelled) {") + 120,
    )
    expect(cancelledBranch).toContain("nextLease.release()")
    expect(cancelledBranch).toContain("return")
    expect(cancelledBranch).not.toContain("setCoverageToken")
  })

  test("the acquire lease effect still depends on retryNonce — manual retry produces a fresh acquire, and therefore a fresh token generation", () => {
    const source = chatSheetSource()
    expect(source).toContain("retryNonce")
    expect(source).toContain("setRetryNonce((current) => current + 1)")
  })

  test("coverageToken is passed to ChatView as a typed prop, never a raw lease/socket/capability", () => {
    const source = chatSheetSource()
    expect(source).toContain("coverageToken={coverageToken}")
    for (const forbidden of ["lease={lease}", "socket=", "capability=", "token={"]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("the acquireOrderRoom call site itself remains exactly unchanged by this focal correction", () => {
    const source = chatSheetSource()
    expect(source).toContain(
      'client.acquireOrderRoom(activePedidoId, ["chat:read", "chat:typing"], { signal: controller.signal })',
    )
  })

  test("no coverage-token/auth state is ever persisted to localStorage/sessionStorage", () => {
    const source = chatSheetSource()
    expect(source).not.toContain("localStorage")
    expect(source).not.toContain("sessionStorage")
  })

  test("ChatSheet still does not call client.ensureConnected() directly anywhere", () => {
    expect(chatSheetSource()).not.toContain("client.ensureConnected()")
  })
})
