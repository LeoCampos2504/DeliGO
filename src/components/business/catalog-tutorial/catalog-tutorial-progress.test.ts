/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  allKnownStepIds,
  buildTutorialStorageKey,
  CATALOG_TUTORIAL_PROGRESS_ALLOWED_KEYS,
  CATALOG_TUTORIAL_STORAGE_VERSION,
  computeProgressSummary,
  createInitialProgress,
  dismissIntroCard,
  isStepCompleted,
  isTutorialFinished,
  isTutorialStarted,
  markStepCompleted,
  parseTutorialProgress,
  resetTutorialProgress,
  serializeTutorialProgress,
  setCurrentStep,
} from "./catalog-tutorial-progress"

describe("buildTutorialStorageKey", () => {
  test("includes the business id and the current version, versioned per task §8", () => {
    expect(buildTutorialStorageKey("biz-123")).toBe(`deligo:catalog-tutorial:v${CATALOG_TUTORIAL_STORAGE_VERSION}:biz-123`)
  })
})

describe("createInitialProgress / whitelist", () => {
  test("has exactly the documented keys — never a password/token/email/customer/order id", () => {
    expect(Object.keys(createInitialProgress()).sort()).toEqual(CATALOG_TUTORIAL_PROGRESS_ALLOWED_KEYS)
    const forbidden = /password|token|email|customer|order|credential|cookie/i
    for (const key of CATALOG_TUTORIAL_PROGRESS_ALLOWED_KEYS) {
      expect(key).not.toMatch(forbidden)
    }
  })

  test("starts empty/unstarted", () => {
    const progress = createInitialProgress()
    expect(progress.currentStepId).toBeNull()
    expect(progress.completedStepIds).toEqual([])
    expect(progress.dismissedIntro).toBe(false)
    expect(progress.startedAt).toBeNull()
    expect(isTutorialStarted(progress)).toBe(false)
  })
})

describe("parseTutorialProgress — never throws, fails safe (task §26.I)", () => {
  test("null raw => initial progress", () => {
    expect(parseTutorialProgress(null)).toEqual(createInitialProgress())
  })

  test("empty string => initial progress", () => {
    expect(parseTutorialProgress("")).toEqual(createInitialProgress())
  })

  test("garbage/corrupted JSON => initial progress, no throw", () => {
    expect(() => parseTutorialProgress("{not valid json")).not.toThrow()
    expect(parseTutorialProgress("{not valid json")).toEqual(createInitialProgress())
  })

  test("valid JSON but wrong shape (e.g. an array, or missing fields) => initial progress", () => {
    expect(parseTutorialProgress("[1,2,3]")).toEqual(createInitialProgress())
    expect(parseTutorialProgress('{"foo":"bar"}')).toEqual(createInitialProgress())
    expect(parseTutorialProgress('{"version":1}')).toEqual(createInitialProgress())
  })

  test("a mismatched version (future schema, or a stale v0) => initial progress, never crashes trying to migrate", () => {
    const stored = JSON.stringify({
      version: 999,
      currentStepId: "intro",
      completedStepIds: [],
      dismissedIntro: false,
      startedAt: 1,
      updatedAt: 1,
    })
    expect(parseTutorialProgress(stored)).toEqual(createInitialProgress())
  })

  test("round-trips a valid progress object exactly", () => {
    const progress = markStepCompleted(createInitialProgress(), "intro", 1000)
    const roundTripped = parseTutorialProgress(serializeTutorialProgress(progress))
    expect(roundTripped).toEqual(progress)
  })

  test("a completely unrelated JSON payload (e.g. from a different app's key colliding) fails safe", () => {
    expect(parseTutorialProgress('{"user":{"email":"a@b.com","token":"xyz"}}')).toEqual(createInitialProgress())
  })
})

describe("markStepCompleted", () => {
  test("adds the step id once; startedAt is set on first completion", () => {
    let progress = createInitialProgress()
    progress = markStepCompleted(progress, "intro", 1000)
    expect(progress.completedStepIds).toEqual(["intro"])
    expect(progress.startedAt).toBe(1000)
    expect(progress.updatedAt).toBe(1000)
  })

  test("marking the same step twice does not duplicate it", () => {
    let progress = createInitialProgress()
    progress = markStepCompleted(progress, "intro", 1000)
    progress = markStepCompleted(progress, "intro", 2000)
    expect(progress.completedStepIds).toEqual(["intro"])
    expect(progress.updatedAt).toBe(2000) // updatedAt still advances
  })

  test("startedAt is preserved across later completions, never overwritten", () => {
    let progress = createInitialProgress()
    progress = markStepCompleted(progress, "intro", 1000)
    progress = markStepCompleted(progress, "create-category", 5000)
    expect(progress.startedAt).toBe(1000)
    expect(progress.completedStepIds).toEqual(["intro", "create-category"])
  })
})

describe("setCurrentStep", () => {
  test("sets currentStepId and updatedAt", () => {
    const progress = setCurrentStep(createInitialProgress(), "create-category", 1000)
    expect(progress.currentStepId).toBe("create-category")
    expect(progress.updatedAt).toBe(1000)
  })

  test("can be set back to null (e.g. tutorial closed without a step focused)", () => {
    let progress = setCurrentStep(createInitialProgress(), "intro", 1000)
    progress = setCurrentStep(progress, null, 2000)
    expect(progress.currentStepId).toBeNull()
  })
})

describe("dismissIntroCard", () => {
  test("sets dismissedIntro without starting the tutorial", () => {
    const progress = dismissIntroCard(createInitialProgress(), 1000)
    expect(progress.dismissedIntro).toBe(true)
    expect(isTutorialStarted(progress)).toBe(false)
  })
})

describe("resetTutorialProgress (task §9) — clears ONLY tutorial state", () => {
  test("returns a fresh initial progress regardless of prior state", () => {
    let progress = createInitialProgress()
    progress = markStepCompleted(progress, "intro", 1000)
    progress = setCurrentStep(progress, "create-category", 2000)
    progress = dismissIntroCard(progress, 3000)
    expect(resetTutorialProgress()).toEqual(createInitialProgress())
  })
})

describe("isStepCompleted / computeProgressSummary / isTutorialFinished", () => {
  test("isStepCompleted reflects completedStepIds", () => {
    const progress = markStepCompleted(createInitialProgress(), "intro", 1000)
    expect(isStepCompleted(progress, "intro")).toBe(true)
    expect(isStepCompleted(progress, "create-category")).toBe(false)
  })

  test("computeProgressSummary counts only against the given visible step ids, never the full unfiltered catalog", () => {
    let progress = createInitialProgress()
    progress = markStepCompleted(progress, "intro", 1000)
    progress = markStepCompleted(progress, "create-ingredients", 2000) // completed but NOT visible for this rubro
    const summary = computeProgressSummary(progress, ["intro", "create-category"])
    expect(summary.completed).toBe(1) // only "intro" is both completed AND visible
    expect(summary.total).toBe(2)
  })

  test("isTutorialFinished requires every visible step id to be completed", () => {
    let progress = createInitialProgress()
    progress = markStepCompleted(progress, "intro", 1000)
    expect(isTutorialFinished(progress, ["intro", "create-category"])).toBe(false)
    progress = markStepCompleted(progress, "create-category", 2000)
    expect(isTutorialFinished(progress, ["intro", "create-category"])).toBe(true)
  })

  test("isTutorialFinished is false for an empty visible list (never fabricates a finished state)", () => {
    expect(isTutorialFinished(createInitialProgress(), [])).toBe(false)
  })
})

describe("allKnownStepIds", () => {
  test("returns a non-empty list of unique ids", () => {
    const ids = allKnownStepIds()
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
