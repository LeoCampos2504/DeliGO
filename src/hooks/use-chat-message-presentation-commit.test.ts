import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
// Type-only import: erased entirely at compile time, so it carries no
// runtime evaluation and cannot violate the ESM-safe sequencing below.
import type { ChatMessagePresentationCandidate } from "./use-chat-message-presentation-commit"

// D2 — this is the one test file in the repo that needs a real DOM commit
// cycle (React effects/layout-effects actually firing, in the real
// ordering, across real renders). happy-dom is registered HERE, per-file,
// rather than repo-wide (bunfig.toml), to keep every other — currently
// DOM-free — test file completely unaffected.
GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// GlobalRegistrator.register() replaces process-wide globals (Request,
// Response, Headers, fetch, navigator, document, ...) with happy-dom's
// implementations. bun test runs every file given on one command line in
// the SAME process, so leaving those swapped after this file's tests finish
// corrupts any later file that depends on Node/Bun's native Web-standard
// globals — e.g. a route test constructing a real next/server NextRequest.
// Restoring them here is this file's own cleanup responsibility.
afterAll(() => {
  GlobalRegistrator.unregister()
})

// Deliberately NOT mock.module()-ing the SW bridge here: Bun's mock.module
// patches the module registry for the whole test PROCESS, not just this
// file — when the focal D2 suite runs as one combined `bun test` command,
// that would leak into chat-push-dedupe-bridge.test.ts's own unmocked
// import of the same module and silently replace the real implementation
// it's trying to test. Instead, this file lets the hook call through to
// the REAL bridge (itself exhaustively unit-tested in
// chat-push-dedupe-bridge.test.ts) and spies one level lower, on
// navigator.serviceWorker.controller.postMessage — the same technique
// chat-push-dedupe-bridge.test.ts uses, just driven from the hook's side.
const postMessageMock = mock((_msg: unknown) => {})

// ESM-safe sequencing: happy-dom must be registered BEFORE react/
// react-dom/client/the production hook are ever evaluated — a static
// top-level import would run before that step. Dynamic import, after it,
// guarantees the right order regardless of how the bundler/runtime would
// otherwise hoist static imports.
const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { useChatMessagePresentationCommit } = await import("./use-chat-message-presentation-commit")

const { act } = React

interface FakeGeometry {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

interface HookProps {
  presentationCandidate: ChatMessagePresentationCandidate | null
  currentEpisodeGeneration: number
  currentMessages: Array<{ id: string }>
  pedidoId: string
  actorKey: string
  isSheetOpen: boolean
}

type HookApi = ReturnType<typeof useChatMessagePresentationCommit>

function candidate(overrides: Partial<ChatMessagePresentationCandidate> = {}) {
  return {
    messageId: "msg-1",
    pedidoId: "pedido-1",
    actorKey: "cliente:1",
    generation: 1,
    episodeGeneration: 1,
    ...overrides,
  }
}

function baseProps(overrides: Partial<HookProps> = {}): HookProps {
  return {
    presentationCandidate: candidate(),
    currentEpisodeGeneration: 1,
    currentMessages: [{ id: "msg-1" }],
    pedidoId: "pedido-1",
    actorKey: "cliente:1",
    isSheetOpen: true,
    ...overrides,
  }
}

function createController(useStrictMode = false) {
  const containerRef: { current: FakeGeometry | null } = {
    current: { scrollHeight: 1000, scrollTop: 900, clientHeight: 480 }, // at the live edge by default
  }
  let latestApi: HookApi | null = null
  const hostDiv = document.createElement("div")
  document.body.appendChild(hostDiv)
  const root = createRoot(hostDiv)

  function Harness({ hookProps }: { hookProps: HookProps }) {
    const api = useChatMessagePresentationCommit({
      ...hookProps,
      // Cast: the hook only ever reads scrollHeight/scrollTop/clientHeight
      // off `.current` — a real HTMLElement is not required for this.
      messagesContainerRef: containerRef as unknown as React.RefObject<HTMLElement | null>,
    })
    // Capturing the latest API for the test harness's own assertions is not
    // a production concern — done in an effect (not during render) so it
    // stays a pure render from React's own perspective.
    React.useEffect(() => {
      latestApi = api
    })
    return null
  }

  function render(hookProps: HookProps) {
    const tree = useStrictMode ? (
      React.createElement(React.StrictMode, null, React.createElement(Harness, { hookProps }))
    ) : (
      React.createElement(Harness, { hookProps })
    )
    act(() => {
      root.render(tree)
    })
  }

  function setGeometry(geometry: FakeGeometry | null) {
    containerRef.current = geometry
  }

  function scroll(geometry: FakeGeometry) {
    containerRef.current = geometry
    act(() => {
      latestApi?.notifyContainerScrolled(geometry)
    })
  }

  function invalidate() {
    act(() => {
      latestApi?.invalidatePendingPresentation()
    })
  }

  function unmount() {
    act(() => {
      root.unmount()
    })
    hostDiv.remove()
  }

  return {
    render,
    setGeometry,
    scroll,
    invalidate,
    unmount,
    getApi: () => latestApi as HookApi,
  }
}

beforeEach(() => {
  postMessageMock.mockClear()
  Object.defineProperty(globalThis, "navigator", {
    value: { serviceWorker: { controller: { postMessage: postMessageMock } } },
    configurable: true,
    writable: true,
  })
  // Default to visible + focused unless a test overrides these.
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
  document.hasFocus = () => true
})

function expectPresented(messageId: string) {
  expect(postMessageMock).toHaveBeenCalledWith({ type: "CHAT_MESSAGE_PRESENTED", messageId })
}

let controller: ReturnType<typeof createController> | null = null

afterEach(() => {
  controller?.unmount()
  controller = null
})

describe("useChatMessagePresentationCommit — P4B commit + live-edge", () => {
  test("committed candidate, visible+focused, at the live edge: notifies exactly once on the post-commit effect", () => {
    controller = createController()
    controller.render(baseProps())
    expect(postMessageMock).toHaveBeenCalledTimes(1)
    expectPresented("msg-1")
  })

  // Layer 2 eligibility is a single combined gate (identity fields AND
  // commit state) whose failure is unconditionally terminal — this is
  // deliberate, not an oversight: in production, ChatSheet only ever
  // creates a candidate in the SAME synchronous handler that already called
  // addMessage() first, and React 18/19's automatic batching guarantees
  // both land in the same commit — so a candidate is never, in practice,
  // first-evaluated with isMessageCommitted still false. If that invariant
  // were ever broken, fail-open (never suppress that candidate) is exactly
  // the correct safe behavior, not a bug to route around.
  test("a candidate first evaluated before its message is committed settles terminally and never notifies, even after it later commits", () => {
    controller = createController()
    controller.render(baseProps({ currentMessages: [] }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    controller.render(baseProps({ currentMessages: [{ id: "msg-1" }] }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("not at the live edge on commit: no notify; a later scroll-to-edge event succeeds (second attempt point)", () => {
    controller = createController()
    controller.setGeometry({ scrollHeight: 2000, scrollTop: 0, clientHeight: 480 })
    controller.render(baseProps())
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    controller.scroll({ scrollHeight: 2000, scrollTop: 1550, clientHeight: 480 })
    expect(postMessageMock).toHaveBeenCalledTimes(1)
  })

  test("container not yet mounted (null geometry) on commit does not throw and does not notify; a later scroll succeeds", () => {
    controller = createController()
    controller.setGeometry(null)
    expect(() => controller!.render(baseProps())).not.toThrow()
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    controller.scroll({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
    expect(postMessageMock).toHaveBeenCalledTimes(1)
  })

  test("a pending (not-yet-qualifying) candidate stays consumable across multiple failed geometry attempts", () => {
    controller = createController()
    controller.setGeometry({ scrollHeight: 2000, scrollTop: 0, clientHeight: 480 })
    controller.render(baseProps())
    controller.scroll({ scrollHeight: 2000, scrollTop: 100, clientHeight: 480 })
    controller.scroll({ scrollHeight: 2000, scrollTop: 300, clientHeight: 480 })
    expect(postMessageMock).toHaveBeenCalledTimes(0)
    controller.scroll({ scrollHeight: 2000, scrollTop: 1550, clientHeight: 480 })
    expect(postMessageMock).toHaveBeenCalledTimes(1)
  })
})

describe("useChatMessagePresentationCommit — live visibility/focus (terminal, non-retryable)", () => {
  test("document not visible at consumption time: terminal-settles, never notifies even if visibility returns for the SAME candidate generation", () => {
    controller = createController()
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
    controller.render(baseProps())
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
    controller.scroll({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("document not focused at consumption time: terminal-settles, never notifies for the SAME candidate generation", () => {
    controller = createController()
    document.hasFocus = () => false
    controller.render(baseProps())
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    document.hasFocus = () => true
    controller.scroll({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })
})

describe("useChatMessagePresentationCommit — Layer 2 eligibility (terminal on mismatch)", () => {
  test("pedido mismatch: never notifies for a candidate whose pedidoId no longer matches the current one", () => {
    controller = createController()
    controller.render(baseProps({ pedidoId: "pedido-2" }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("actor mismatch: never notifies for a candidate whose actorKey no longer matches the current one", () => {
    controller = createController()
    controller.render(baseProps({ actorKey: "negocio:9" }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("sheet closed: never notifies while isSheetOpen is false", () => {
    controller = createController()
    controller.render(baseProps({ isSheetOpen: false }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("episode-generation mismatch alone (direct fields still matching): never notifies", () => {
    controller = createController()
    controller.render(baseProps({ currentEpisodeGeneration: 2 }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("Correction #7's exact same-commit gap: direct pedido mismatch alone must block even when episodeGeneration still numerically matches", () => {
    // Simulates the one-render window where a parent's episode-generation
    // ref has NOT yet incremented (it lags one layout effect behind a
    // direct pedido/actor/sheet transition within the same commit) — proves
    // the direct-field check is not redundant with the episode check.
    controller = createController()
    controller.render(baseProps({ pedidoId: "pedido-2", currentEpisodeGeneration: 1 }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("cross-mount return to the same pedido: a stale candidate from an earlier episode is still blocked by episode-generation, even once direct fields realign", () => {
    controller = createController()
    // First: pedido A, episode 1 — candidate created, not yet consumed (not at edge).
    controller.setGeometry({ scrollHeight: 2000, scrollTop: 0, clientHeight: 480 })
    controller.render(baseProps({ pedidoId: "pedido-1", currentEpisodeGeneration: 1 }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    // Transition away: pedido B, episode 2 — same (now-stale) candidate object.
    controller.render(baseProps({ pedidoId: "pedido-2", currentEpisodeGeneration: 2 }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    // Return to pedido A, episode 3 (never re-equals the candidate's original
    // episodeGeneration of 1) — direct fields realign, but episode does not.
    controller.setGeometry({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
    controller.render(baseProps({ pedidoId: "pedido-1", currentEpisodeGeneration: 3 }))
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })
})

describe("useChatMessagePresentationCommit — candidate supersession and generation monotonicity", () => {
  test("a newer candidate replacing an older, still-pending one is the only one ever consumed", () => {
    controller = createController()
    controller.setGeometry({ scrollHeight: 2000, scrollTop: 0, clientHeight: 480 })
    controller.render(
      baseProps({
        presentationCandidate: candidate({ messageId: "msg-A", generation: 1 }),
        currentMessages: [{ id: "msg-A" }],
      }),
    )
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    controller.setGeometry({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
    controller.render(
      baseProps({
        presentationCandidate: candidate({ messageId: "msg-B", generation: 2 }),
        currentMessages: [{ id: "msg-A" }, { id: "msg-B" }],
      }),
    )
    expect(postMessageMock).toHaveBeenCalledTimes(1)
    expectPresented("msg-B")
  })

  test("a lower-generation candidate can never re-trigger after a higher generation has already settled", () => {
    controller = createController()
    controller.render(
      baseProps({
        presentationCandidate: candidate({ messageId: "msg-B", generation: 2 }),
        currentMessages: [{ id: "msg-B" }],
      }),
    )
    expect(postMessageMock).toHaveBeenCalledTimes(1)

    // Re-render with an OLDER generation candidate (should never happen from
    // ChatSheet in practice, but the hook's own monotonic guard must hold).
    controller.render(
      baseProps({
        presentationCandidate: candidate({ messageId: "msg-A", generation: 1 }),
        currentMessages: [{ id: "msg-B" }, { id: "msg-A" }],
      }),
    )
    expect(postMessageMock).toHaveBeenCalledTimes(1)
  })
})

describe("useChatMessagePresentationCommit — invalidatePendingPresentation", () => {
  test("invalidating a pending candidate (tab hidden/blur) prevents a later scroll-to-edge from notifying", () => {
    controller = createController()
    controller.setGeometry({ scrollHeight: 2000, scrollTop: 0, clientHeight: 480 })
    controller.render(baseProps())
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    controller.invalidate()
    controller.scroll({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("invalidating with no candidate at all is a safe no-op", () => {
    controller = createController()
    controller.render(baseProps({ presentationCandidate: null }))
    expect(() => controller!.invalidate()).not.toThrow()
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })
})

describe("useChatMessagePresentationCommit — K2 callback freshness", () => {
  test("a stale closure captured from an earlier render can never notify after a newer render has taken over", () => {
    controller = createController()
    controller.setGeometry({ scrollHeight: 2000, scrollTop: 0, clientHeight: 480 })
    controller.render(baseProps())
    const staleNotify = controller.getApi().notifyContainerScrolled

    // A genuine context transition — new invocationToken, activeTokenRef now
    // points elsewhere.
    controller.render(baseProps({ pedidoId: "pedido-2", currentEpisodeGeneration: 2 }))

    act(() => {
      staleNotify({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
    })
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })

  test("a stale invalidatePendingPresentation callback captured before a context change cannot terminally settle the new candidate", () => {
    controller = createController()
    controller.setGeometry({ scrollHeight: 2000, scrollTop: 0, clientHeight: 480 })
    controller.render(baseProps())
    const staleInvalidate = controller.getApi().invalidatePendingPresentation

    // New context: a new candidate (msg-B, generation 2), still pending
    // (not at the live edge yet). If the STALE invalidate below could
    // settle it, it would never notify even once scrolled to the edge.
    controller.render(
      baseProps({
        presentationCandidate: candidate({ messageId: "msg-B", generation: 2 }),
        currentMessages: [{ id: "msg-1" }, { id: "msg-B" }],
      }),
    )
    expect(postMessageMock).toHaveBeenCalledTimes(0)

    act(() => {
      staleInvalidate()
    })

    // The new candidate must still be consumable — proving the stale
    // invalidate callback (gated by its own K2 check) never touched it.
    controller.scroll({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
    expect(postMessageMock).toHaveBeenCalledTimes(1)
    expectPresented("msg-B")
  })

  test("after unmount, a previously-captured callback can never notify (layout-effect cleanup nulls the active token)", () => {
    controller = createController()
    controller.setGeometry({ scrollHeight: 2000, scrollTop: 0, clientHeight: 480 })
    controller.render(baseProps())
    const capturedNotify = controller.getApi().notifyContainerScrolled

    controller.unmount()
    controller = null

    expect(() => {
      act(() => {
        capturedNotify({ scrollHeight: 1000, scrollTop: 900, clientHeight: 480 })
      })
    }).not.toThrow()
    expect(postMessageMock).toHaveBeenCalledTimes(0)
  })
})

describe("useChatMessagePresentationCommit — React Strict Mode", () => {
  test("under StrictMode's dev double-invoke, a qualifying candidate still notifies exactly once (not zero, not twice)", () => {
    controller = createController(true)
    controller.render(baseProps())
    expect(postMessageMock).toHaveBeenCalledTimes(1)
  })
})
