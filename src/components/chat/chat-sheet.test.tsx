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

// D2 — Foreground Push / Socket Dedupe. No DOM rendering dependency is
// introduced here either — same source-level assertion strategy as above.
// The pure eligibility/geometry predicates are exhaustively unit-tested in
// src/lib/chat-push-presentation.test.ts, and the commit/consumption logic
// in src/hooks/use-chat-message-presentation-commit.test.ts; this file
// verifies ChatSheet actually creates and threads the candidate correctly.
describe("ChatSheet — D2 presentation-candidate creation and threading", () => {
  test("imports evaluateReceiptEligibility from the pure presentation-predicates module", () => {
    const source = chatSheetSource()
    expect(source).toContain('from "@/lib/chat-push-presentation"')
    expect(source).toContain("evaluateReceiptEligibility")
  })

  test("candidate creation lives inside the new-message handler, after the existing unread-bump block", () => {
    const source = chatSheetSource()
    const unreadBlockIndex = source.indexOf("updateConversationUnread(message.pedidoId, conv.unreadCount + 1)")
    const eligibilityCallIndex = source.indexOf("evaluateReceiptEligibility({")
    const setCandidateIndex = source.indexOf("setPresentationCandidate({")
    expect(unreadBlockIndex).toBeGreaterThan(-1)
    expect(eligibilityCallIndex).toBeGreaterThan(-1)
    expect(setCandidateIndex).toBeGreaterThan(-1)
    expect(eligibilityCallIndex).toBeGreaterThan(unreadBlockIndex)
    expect(setCandidateIndex).toBeGreaterThan(eligibilityCallIndex)
  })

  test("history/catch-up loading never creates a presentation candidate — setPresentationCandidate appears exactly once, inside new-message only", () => {
    const source = chatSheetSource()
    const matches = source.match(/setPresentationCandidate\(/g)
    expect(matches?.length).toBe(1)
  })

  test("candidate shape carries exactly the frozen fields: messageId, pedidoId, actorKey, generation, episodeGeneration", () => {
    const source = chatSheetSource()
    const start = source.indexOf("setPresentationCandidate({")
    const block = source.slice(start, start + 260)
    for (const field of ["messageId: message.id", "pedidoId: message.pedidoId", "actorKey,", "generation: presentationGenerationRef.current", "episodeGeneration: presentationEpisodeGenerationRef.current"]) {
      expect(block).toContain(field)
    }
  })

  test("candidate generation is single-slot and monotonic via a dedicated ref, never an array/queue", () => {
    const source = chatSheetSource()
    expect(source).toContain("presentationGenerationRef.current += 1")
    expect(source).toContain("useState<ChatMessagePresentationCandidate | null>(null)")
    for (const forbidden of ["presentationCandidates", "candidateQueue", "candidates.push"]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("episode key/generation refs exist and are keyed on isSheetOpen, activePedidoId, actorKey", () => {
    const source = chatSheetSource()
    expect(source).toContain("presentationEpisodeGenerationRef")
    expect(source).toContain("presentationEpisodeKeyRef")
    expect(source).toContain('`${String(isSheetOpen)}:${activePedidoId ?? ""}:${actorKey ?? ""}`')
  })

  test("episode publication uses useLayoutEffect, not useEffect, and is commit-synchronous", () => {
    const source = chatSheetSource()
    const keyLineIndex = source.indexOf('const key = `${String(isSheetOpen)}:${activePedidoId ?? ""}:${actorKey ?? ""}`')
    expect(keyLineIndex).toBeGreaterThan(-1)
    const precedingSlice = source.slice(Math.max(0, keyLineIndex - 200), keyLineIndex)
    expect(precedingSlice).toContain("useLayoutEffect(() => {")
  })

  test("the very first render only seeds the episode key baseline — it never increments the generation", () => {
    const source = chatSheetSource()
    const layoutEffectStart = source.indexOf('const key = `${String(isSheetOpen)}:${activePedidoId ?? ""}:${actorKey ?? ""}`')
    const block = source.slice(layoutEffectStart, layoutEffectStart + 400)
    expect(block).toContain("presentationEpisodeKeyRef.current === null")
    expect(block).toContain("presentationEpisodeKeyRef.current = key\n      return")
  })

  test("ChatView receives presentationCandidate and currentEpisodeGeneration as typed props", () => {
    const source = chatSheetSource()
    expect(source).toContain("presentationCandidate={presentationCandidate}")
    expect(source).toContain("currentEpisodeGeneration={presentationEpisodeGenerationRef.current}")
  })

  test("ChatSheet never talks to the Service Worker directly — no postMessage, no navigator.serviceWorker", () => {
    const source = chatSheetSource()
    expect(source).not.toContain("postMessage")
    expect(source).not.toContain("navigator.serviceWorker")
    expect(source).not.toContain("notifyServiceWorkerMessagePresented")
  })

  test("ChatSheet never mutates read-receipt/unread state as part of candidate creation — the existing unread block is untouched", () => {
    const source = chatSheetSource()
    expect(source).toContain(
      "if (message.remitente !== getRemitenteForUserType(user.type)) {\n" +
        "          const conv = conversationsRef.current.find((conversation) => conversation.pedidoId === message.pedidoId)\n" +
        "          if (conv && activePedidoIdRef.current !== message.pedidoId) {\n" +
        "            updateConversationUnread(message.pedidoId, conv.unreadCount + 1)\n" +
        "          }\n" +
        "        }",
    )
  })

  test("isSheetOpenRef mirrors isSheetOpen, matching the existing activePedidoIdRef mirror pattern", () => {
    const source = chatSheetSource()
    expect(source).toContain("const isSheetOpenRef = useRef(isSheetOpen)")
    expect(source).toContain("isSheetOpenRef.current = isSheetOpen")
  })
})
