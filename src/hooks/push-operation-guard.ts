// P2-T05 Stage3R2 (F-P2-T05-14): pure, framework-agnostic latest-operation
// guard. No React, no browser APIs, no I/O — deliberately small and directly
// unit-testable without a DOM/React Testing Library harness (this repo has
// neither).
//
// Model: PERSONAL_PUSH_ASYNC_MODEL=LATEST_RELEVANT_OPERATION_WINS. Every
// operation that may eventually apply a result (a status read, an
// enable/disable mutation, an actor/endpoint change, an unmount) calls
// `begin()` to obtain its own monotonically increasing id — and starting a
// NEW operation immediately makes every previously-issued id stale, even
// before that older operation's own async work has resolved. Before applying
// any result, the caller must check `isCurrent(id)`; a `false` means a newer
// operation has since started and this result must be discarded silently.
// `invalidate()` bumps the generation without minting a new "current"
// operation of its own — used when something relevant changed (actor
// identity, unmount) without there being a new applyable result to protect.
export interface LatestOperationGate {
  begin(): number
  isCurrent(id: number): boolean
  invalidate(): void
}

export function createLatestOperationGate(): LatestOperationGate {
  let generation = 0

  return {
    begin() {
      generation += 1
      return generation
    },
    isCurrent(id: number) {
      return id === generation
    },
    invalidate() {
      generation += 1
    },
  }
}
