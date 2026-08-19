import { describe, expect, test } from "bun:test"
import type { RealtimeResyncReason } from "./realtime-types"
import {
  applyForegroundEpisodeEvent,
  CONVERSATIONS_LIST_INTERVAL_MS,
  createForegroundEpisodeState,
  selectConversationsPollInterval,
  selectUnreadPollInterval,
  shouldResyncTriggerChatCatchup,
  UNREAD_VISIBLE_INTERVAL_MS,
} from "./chat-polling"

// Every scenario below is a pure function of its explicit inputs — no
// timers, no sleeps, no Date/clock reads, no fetch, no fake DOM. See
// CODEX_REPORT.md, "SHARED REALTIME — CHAT POLLING REDUCTION" (baseline
// design, focal correction, then this local implementation) for the full
// rationale each case is asserting against.

describe("selectUnreadPollInterval", () => {
  test("1. visible + canChat -> 15000ms", () => {
    expect(selectUnreadPollInterval({ canChat: true, documentVisible: true })).toBe(15000)
    expect(selectUnreadPollInterval({ canChat: true, documentVisible: true })).toBe(UNREAD_VISIBLE_INTERVAL_MS)
  })

  test("2. hidden -> suspended regardless of canChat", () => {
    expect(selectUnreadPollInterval({ canChat: true, documentVisible: false })).toBeNull()
  })

  test("3. canChat=false -> suspended regardless of visibility", () => {
    expect(selectUnreadPollInterval({ canChat: false, documentVisible: true })).toBeNull()
  })

  test("4. canChat=false and hidden -> suspended", () => {
    expect(selectUnreadPollInterval({ canChat: false, documentVisible: false })).toBeNull()
  })
})

describe("selectConversationsPollInterval", () => {
  test("5. sheet closed -> suspended", () => {
    expect(
      selectConversationsPollInterval({ isSheetOpen: false, activePedidoId: null, documentVisible: true }),
    ).toBeNull()
  })

  test("6. sheet open + list visible (activePedidoId null) + document visible -> 10000ms", () => {
    expect(
      selectConversationsPollInterval({ isSheetOpen: true, activePedidoId: null, documentVisible: true }),
    ).toBe(10000)
    expect(
      selectConversationsPollInterval({ isSheetOpen: true, activePedidoId: null, documentVisible: true }),
    ).toBe(CONVERSATIONS_LIST_INTERVAL_MS)
  })

  test("7. sheet open + active conversation (activePedidoId set) -> suspended, not merely slowed", () => {
    expect(
      selectConversationsPollInterval({ isSheetOpen: true, activePedidoId: "pedido-1", documentVisible: true }),
    ).toBeNull()
  })

  test("8. sheet open + list visible + document hidden -> suspended", () => {
    expect(
      selectConversationsPollInterval({ isSheetOpen: true, activePedidoId: null, documentVisible: false }),
    ).toBeNull()
  })

  test("9. sheet closed + hidden -> suspended (both conditions independently sufficient)", () => {
    expect(
      selectConversationsPollInterval({ isSheetOpen: false, activePedidoId: null, documentVisible: false }),
    ).toBeNull()
  })

  test("10. generic socket/connection state is not an accepted input and cannot alter the result", () => {
    const inputs = { isSheetOpen: true, activePedidoId: null, documentVisible: true }
    // TypeScript's structural typing already rejects an extra `state` field
    // at compile time for a typed call site; this asserts the runtime
    // behavior is identical whether or not such an (erased) field is
    // present, proving the function never reads it.
    const withExtraSocketField = { ...inputs, state: "idle" } as typeof inputs
    expect(selectConversationsPollInterval(withExtraSocketField)).toBe(
      selectConversationsPollInterval(inputs),
    )
  })
})

describe("shouldResyncTriggerChatCatchup", () => {
  test("11. foreground -> no catchup (Chat's own foreground-episode listener already owns this case)", () => {
    expect(shouldResyncTriggerChatCatchup("foreground")).toBe(false)
  })

  test("12. initial-connect -> catchup permitted", () => {
    expect(shouldResyncTriggerChatCatchup("initial-connect")).toBe(true)
  })

  test("13. reauth -> catchup permitted", () => {
    expect(shouldResyncTriggerChatCatchup("reauth")).toBe(true)
  })

  test("14. room-rejoin -> catchup permitted", () => {
    expect(shouldResyncTriggerChatCatchup("room-rejoin")).toBe(true)
  })

  test("15. online -> catchup permitted", () => {
    expect(shouldResyncTriggerChatCatchup("online")).toBe(true)
  })

  test("16. reserved-but-currently-unreachable reasons default to DENY — explicit allowlist, not a catch-all", () => {
    expect(shouldResyncTriggerChatCatchup("reconnect")).toBe(false)
    expect(shouldResyncTriggerChatCatchup("suspected-gap")).toBe(false)
    expect(shouldResyncTriggerChatCatchup("manual")).toBe(false)
  })

  test("17. exhaustive over the full current RealtimeResyncReason union — only the 4 justified+reachable reasons permit a catchup", () => {
    const allReasons: RealtimeResyncReason[] = [
      "initial-connect",
      "reconnect",
      "reauth",
      "room-rejoin",
      "foreground",
      "online",
      "suspected-gap",
      "manual",
    ]
    const permitted = allReasons.filter((reason) => shouldResyncTriggerChatCatchup(reason))
    const expected: RealtimeResyncReason[] = ["initial-connect", "reauth", "room-rejoin", "online"]
    expect(permitted.sort()).toEqual(expected.sort())
  })
})

describe("applyForegroundEpisodeEvent — foreground-episode coalescing", () => {
  test("18. blur marks pending, does not itself trigger a catchup", () => {
    const state = createForegroundEpisodeState(true)
    expect(applyForegroundEpisodeEvent(state, "blur", true).shouldCatchup).toBe(false)
    expect(state.pending).toBe(true)
  })

  test("19. hidden marks pending, does not itself trigger a catchup", () => {
    const state = createForegroundEpisodeState(true)
    expect(applyForegroundEpisodeEvent(state, "hidden", false).shouldCatchup).toBe(false)
    expect(state.pending).toBe(true)
  })

  test("20. visible after pending consumes it and triggers exactly one catchup", () => {
    const state = createForegroundEpisodeState(true)
    applyForegroundEpisodeEvent(state, "hidden", false)
    expect(applyForegroundEpisodeEvent(state, "visible", true).shouldCatchup).toBe(true)
    expect(state.pending).toBe(false)
  })

  test("21. focus after pending, while visible, consumes it and triggers exactly one catchup", () => {
    const state = createForegroundEpisodeState(true)
    applyForegroundEpisodeEvent(state, "blur", true)
    expect(applyForegroundEpisodeEvent(state, "focus", true).shouldCatchup).toBe(true)
    expect(state.pending).toBe(false)
  })

  test("22. focus while still hidden does not consume pending — the later visible event will", () => {
    const state = createForegroundEpisodeState(true)
    applyForegroundEpisodeEvent(state, "blur", false)
    expect(applyForegroundEpisodeEvent(state, "focus", false).shouldCatchup).toBe(false)
    expect(state.pending).toBe(true)
    expect(applyForegroundEpisodeEvent(state, "visible", true).shouldCatchup).toBe(true)
    expect(state.pending).toBe(false)
  })

  test("23. blur+hidden together, then visible+focus together (in either order) — exactly one catchup, whichever fires first wins", () => {
    // visible before focus
    const stateA = createForegroundEpisodeState(true)
    applyForegroundEpisodeEvent(stateA, "blur", true)
    applyForegroundEpisodeEvent(stateA, "hidden", false)
    const visibleResult = applyForegroundEpisodeEvent(stateA, "visible", true)
    const focusResultAfter = applyForegroundEpisodeEvent(stateA, "focus", true)
    expect(visibleResult.shouldCatchup).toBe(true)
    expect(focusResultAfter.shouldCatchup).toBe(false)

    // focus before visible
    const stateB = createForegroundEpisodeState(true)
    applyForegroundEpisodeEvent(stateB, "blur", true)
    applyForegroundEpisodeEvent(stateB, "hidden", false)
    const focusResult = applyForegroundEpisodeEvent(stateB, "focus", true)
    const visibleResultAfter = applyForegroundEpisodeEvent(stateB, "visible", true)
    expect(focusResult.shouldCatchup).toBe(true)
    expect(visibleResultAfter.shouldCatchup).toBe(false)
  })

  test("24. visible or focus with no pending catchup is a no-op", () => {
    const state = createForegroundEpisodeState(true)
    expect(applyForegroundEpisodeEvent(state, "visible", true).shouldCatchup).toBe(false)
    expect(applyForegroundEpisodeEvent(state, "focus", true).shouldCatchup).toBe(false)
  })

  test("25. repeated blur/hidden while already pending is idempotent", () => {
    const state = createForegroundEpisodeState(true)
    applyForegroundEpisodeEvent(state, "blur", true)
    applyForegroundEpisodeEvent(state, "hidden", false)
    applyForegroundEpisodeEvent(state, "blur", false)
    expect(state.pending).toBe(true)
    expect(applyForegroundEpisodeEvent(state, "visible", true).shouldCatchup).toBe(true)
  })

  test("26. a second full episode after the first resolves behaves identically (state is reusable, not one-shot)", () => {
    const state = createForegroundEpisodeState(true)
    applyForegroundEpisodeEvent(state, "hidden", false)
    expect(applyForegroundEpisodeEvent(state, "visible", true).shouldCatchup).toBe(true)
    // second episode
    applyForegroundEpisodeEvent(state, "blur", true)
    expect(applyForegroundEpisodeEvent(state, "focus", true).shouldCatchup).toBe(true)
  })

  test("27. seeded visible (normal mount) starts with nothing pending", () => {
    const state = createForegroundEpisodeState(true)
    expect(state.pending).toBe(false)
  })

  test("28. seeded hidden (mount that begins already-hidden, or a re-registration while hidden) starts pending — no hidden DOM event will ever fire to set it otherwise", () => {
    const state = createForegroundEpisodeState(false)
    expect(state.pending).toBe(true)
  })

  test("29. seeded-hidden mount: the FIRST visible event catches up even though no blur/hidden event was ever observed by this instance", () => {
    const state = createForegroundEpisodeState(false)
    expect(applyForegroundEpisodeEvent(state, "visible", true).shouldCatchup).toBe(true)
    expect(state.pending).toBe(false)
  })

  test("30. seeded-hidden mount: focus alone (while still visible at call time) also catches up, matching the normal focus-consumes rule", () => {
    const state = createForegroundEpisodeState(false)
    expect(applyForegroundEpisodeEvent(state, "focus", true).shouldCatchup).toBe(true)
    expect(state.pending).toBe(false)
  })

  test("31. seeded-hidden mount: focus while STILL hidden does not consume — same guard as the normal case", () => {
    const state = createForegroundEpisodeState(false)
    expect(applyForegroundEpisodeEvent(state, "focus", false).shouldCatchup).toBe(false)
    expect(state.pending).toBe(true)
  })
})
