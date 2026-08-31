// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R1 — impure localStorage shell
// ============================================
// Thin, try/catch-guarded read/write around window.localStorage — same
// defensive pattern already used elsewhere in this codebase (e.g.
// src/components/pwa/install-prompt.tsx's wasDismissed/markDismissed).
// All the actual state logic lives in catalog-tutorial-progress.ts
// (pure, unit-tested); this file never contains a decision, only I/O.
// Never sends progress over the network — this is the only place that
// touches storage, and it touches localStorage exclusively (task §17: no
// telemetry, no new API endpoint).

import {
  buildTutorialStorageKey,
  createInitialProgress,
  parseTutorialProgress,
  serializeTutorialProgress,
  type CatalogTutorialProgress,
} from "./catalog-tutorial-progress"

export function readTutorialProgress(businessId: string): CatalogTutorialProgress {
  if (typeof window === "undefined") return createInitialProgress()
  try {
    const raw = window.localStorage.getItem(buildTutorialStorageKey(businessId))
    return parseTutorialProgress(raw)
  } catch {
    // Private browsing / storage disabled / quota errors must never break
    // the Productos UI — fall back to a fresh, in-memory-only progress.
    return createInitialProgress()
  }
}

export function writeTutorialProgress(businessId: string, progress: CatalogTutorialProgress): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(buildTutorialStorageKey(businessId), serializeTutorialProgress(progress))
  } catch {
    // Swallow — a failed write should never surface as a Productos error.
  }
}
