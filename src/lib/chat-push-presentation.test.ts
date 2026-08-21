import { describe, expect, test } from "bun:test"
import {
  evaluateCommittedCandidateEligibility,
  evaluateReceiptEligibility,
  isContainerAtLiveEdge,
} from "@/lib/chat-push-presentation"

describe("evaluateReceiptEligibility", () => {
  const base = {
    isOwnMessage: false,
    isSheetOpen: true,
    messagePedidoId: "pedido-1",
    activePedidoId: "pedido-1",
    isDocumentVisible: true,
    isDocumentFocused: true,
  }

  test("true when every condition holds", () => {
    expect(evaluateReceiptEligibility(base)).toBe(true)
  })

  test("false for own message (echo of the sender's own send)", () => {
    expect(evaluateReceiptEligibility({ ...base, isOwnMessage: true })).toBe(false)
  })

  test("false when the sheet is closed", () => {
    expect(evaluateReceiptEligibility({ ...base, isSheetOpen: false })).toBe(false)
  })

  test("false when there is no active pedido at all", () => {
    expect(evaluateReceiptEligibility({ ...base, activePedidoId: null })).toBe(false)
  })

  test("false when the message belongs to a different pedido than the active one", () => {
    expect(evaluateReceiptEligibility({ ...base, messagePedidoId: "pedido-2" })).toBe(false)
  })

  test("false when the document is not visible", () => {
    expect(evaluateReceiptEligibility({ ...base, isDocumentVisible: false })).toBe(false)
  })

  test("false when the document is not focused", () => {
    expect(evaluateReceiptEligibility({ ...base, isDocumentFocused: false })).toBe(false)
  })
})

describe("evaluateCommittedCandidateEligibility", () => {
  const base = {
    candidatePedidoId: "pedido-1",
    currentPedidoId: "pedido-1",
    candidateActorKey: "cliente:1",
    currentActorKey: "cliente:1",
    candidateEpisodeGeneration: 3,
    currentEpisodeGeneration: 3,
    isSheetOpen: true,
    isMessageCommitted: true,
  }

  test("true when every field matches", () => {
    expect(evaluateCommittedCandidateEligibility(base)).toBe(true)
  })

  test("false on pedido mismatch alone", () => {
    expect(evaluateCommittedCandidateEligibility({ ...base, currentPedidoId: "pedido-2" })).toBe(false)
  })

  test("false on actor mismatch alone", () => {
    expect(evaluateCommittedCandidateEligibility({ ...base, currentActorKey: "cliente:2" })).toBe(false)
  })

  test("false on episode-generation mismatch alone", () => {
    expect(evaluateCommittedCandidateEligibility({ ...base, currentEpisodeGeneration: 4 })).toBe(false)
  })

  test("false when the sheet is closed", () => {
    expect(evaluateCommittedCandidateEligibility({ ...base, isSheetOpen: false })).toBe(false)
  })

  test("false when the candidate message is not (yet, or no longer) React-committed", () => {
    expect(evaluateCommittedCandidateEligibility({ ...base, isMessageCommitted: false })).toBe(false)
  })
})

describe("isContainerAtLiveEdge", () => {
  test("true when scrolled all the way to the bottom", () => {
    expect(isContainerAtLiveEdge({ scrollHeight: 1000, scrollTop: 520, clientHeight: 480 })).toBe(true)
  })

  test("true when within the default 100px threshold", () => {
    expect(isContainerAtLiveEdge({ scrollHeight: 1000, scrollTop: 450, clientHeight: 480 })).toBe(true)
  })

  test("false when exactly at the threshold boundary (strict less-than)", () => {
    expect(isContainerAtLiveEdge({ scrollHeight: 1000, scrollTop: 420, clientHeight: 480 })).toBe(false)
  })

  test("false when scrolled well away from the bottom", () => {
    expect(isContainerAtLiveEdge({ scrollHeight: 1000, scrollTop: 0, clientHeight: 480 })).toBe(false)
  })

  test("respects a custom threshold", () => {
    expect(
      isContainerAtLiveEdge({ scrollHeight: 1000, scrollTop: 400, clientHeight: 480, thresholdPx: 200 }),
    ).toBe(true)
  })

  // Correction #3's exact stale-ref counterexample: a container that grew by
  // 300px (a new message committed) while scrollTop stayed at the
  // pre-append value. Reading these FRESH numbers (not a cached "was at
  // bottom" flag) must correctly report "not at the live edge" here — the
  // whole reason P4B always re-reads geometry at consumption time.
  test("stale-ref counterexample: post-commit geometry correctly reports NOT at the live edge", () => {
    expect(isContainerAtLiveEdge({ scrollHeight: 1300, scrollTop: 500, clientHeight: 480 })).toBe(false)
  })

  test("the pre-commit geometry for the same counterexample WAS at the live edge", () => {
    expect(isContainerAtLiveEdge({ scrollHeight: 1000, scrollTop: 500, clientHeight: 480 })).toBe(true)
  })
})
