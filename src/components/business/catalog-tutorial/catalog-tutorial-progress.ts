// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R1 — pure progress logic
// ============================================
// Pure, DOM-free state transitions + (de)serialization for the tutorial's
// client-only progress. The impure localStorage read/write shell lives in
// catalog-tutorial-storage.ts — same pure/impure split already established
// across this codebase (e.g. src/lib/ios-scroll-restore-decision.ts vs.
// its DOM shell).
//
// Only ever stores: version, currentStepId, completedStepIds,
// dismissedIntro, startedAt, updatedAt — never a password, token, email,
// customer id, or order id (task §8). Failing to read/parse/write this
// data must never break the Productos UI — every function here is total
// (never throws) and callers get a safe default on any corruption.

import { CATALOG_TUTORIAL_STEPS } from "./catalog-tutorial-steps"

export const CATALOG_TUTORIAL_STORAGE_VERSION = 1

export interface CatalogTutorialProgress {
  version: number
  currentStepId: string | null
  completedStepIds: string[]
  dismissedIntro: boolean
  startedAt: number | null
  updatedAt: number | null
}

export const CATALOG_TUTORIAL_PROGRESS_ALLOWED_KEYS = [
  "version",
  "currentStepId",
  "completedStepIds",
  "dismissedIntro",
  "startedAt",
  "updatedAt",
].sort()

export function createInitialProgress(): CatalogTutorialProgress {
  return {
    version: CATALOG_TUTORIAL_STORAGE_VERSION,
    currentStepId: null,
    completedStepIds: [],
    dismissedIntro: false,
    startedAt: null,
    updatedAt: null,
  }
}

// Task §8: "deligo:catalog-tutorial:v1:<business-scope>" — negocio.id is
// the stable, non-sensitive business-scope identifier used (a Prisma id,
// already the primary key threaded through every catalog query in this
// area — never an email/token/slug that could theoretically change).
export function buildTutorialStorageKey(businessId: string): string {
  return `deligo:catalog-tutorial:v${CATALOG_TUTORIAL_STORAGE_VERSION}:${businessId}`
}

function isValidProgressShape(value: unknown): value is CatalogTutorialProgress {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.version === "number" &&
    (obj.currentStepId === null || typeof obj.currentStepId === "string") &&
    Array.isArray(obj.completedStepIds) &&
    obj.completedStepIds.every((id) => typeof id === "string") &&
    typeof obj.dismissedIntro === "boolean" &&
    (obj.startedAt === null || obj.startedAt === undefined || typeof obj.startedAt === "number") &&
    (obj.updatedAt === null || obj.updatedAt === undefined || typeof obj.updatedAt === "number")
  )
}

// Never throws. Any parse failure, shape mismatch, or version mismatch
// safely falls back to a fresh initial progress — corrupted/missing
// localStorage must never break the Productos UI (task §26.I).
export function parseTutorialProgress(raw: string | null): CatalogTutorialProgress {
  if (!raw) return createInitialProgress()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isValidProgressShape(parsed)) return createInitialProgress()
    if (parsed.version !== CATALOG_TUTORIAL_STORAGE_VERSION) return createInitialProgress()
    return {
      version: parsed.version,
      currentStepId: parsed.currentStepId,
      completedStepIds: parsed.completedStepIds,
      dismissedIntro: parsed.dismissedIntro,
      startedAt: parsed.startedAt ?? null,
      updatedAt: parsed.updatedAt ?? null,
    }
  } catch {
    return createInitialProgress()
  }
}

export function serializeTutorialProgress(progress: CatalogTutorialProgress): string {
  return JSON.stringify(progress)
}

export function markStepCompleted(
  progress: CatalogTutorialProgress,
  stepId: string,
  now: number
): CatalogTutorialProgress {
  const alreadyCompleted = progress.completedStepIds.includes(stepId)
  return {
    ...progress,
    completedStepIds: alreadyCompleted ? progress.completedStepIds : [...progress.completedStepIds, stepId],
    startedAt: progress.startedAt ?? now,
    updatedAt: now,
  }
}

export function setCurrentStep(
  progress: CatalogTutorialProgress,
  stepId: string | null,
  now: number
): CatalogTutorialProgress {
  return {
    ...progress,
    currentStepId: stepId,
    startedAt: progress.startedAt ?? (stepId ? now : progress.startedAt),
    updatedAt: now,
  }
}

export function dismissIntroCard(progress: CatalogTutorialProgress, now: number): CatalogTutorialProgress {
  return { ...progress, dismissedIntro: true, updatedAt: now }
}

// task §9: resets ONLY tutorial progress — never touches catalog data,
// callers must never wire this to any product/category/ingredient
// mutation.
export function resetTutorialProgress(): CatalogTutorialProgress {
  return createInitialProgress()
}

export function isStepCompleted(progress: CatalogTutorialProgress, stepId: string): boolean {
  return progress.completedStepIds.includes(stepId)
}

// Counts completion against the CURRENTLY VISIBLE step list (already
// filtered by rubro) — never against the full unfiltered step catalog, so
// "X de N pasos" is always accurate for the business's own rubro.
export function computeProgressSummary(
  progress: CatalogTutorialProgress,
  visibleStepIds: string[]
): { completed: number; total: number } {
  const completed = visibleStepIds.filter((id) => progress.completedStepIds.includes(id)).length
  return { completed, total: visibleStepIds.length }
}

export function isTutorialStarted(progress: CatalogTutorialProgress): boolean {
  return progress.startedAt !== null || progress.completedStepIds.length > 0 || progress.currentStepId !== null
}

export function isTutorialFinished(progress: CatalogTutorialProgress, visibleStepIds: string[]): boolean {
  if (visibleStepIds.length === 0) return false
  return visibleStepIds.every((id) => progress.completedStepIds.includes(id))
}

// Only ever referenced by tests/tools that want the full known step id
// universe (e.g. to validate stored completedStepIds don't reference a
// removed step) — not used by the runtime UI itself.
export function allKnownStepIds(): string[] {
  return CATALOG_TUTORIAL_STEPS.map((step) => step.id)
}
