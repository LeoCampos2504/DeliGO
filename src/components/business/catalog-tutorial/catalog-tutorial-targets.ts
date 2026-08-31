// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R3 §8 — workflow-area target registry
// ============================================
// A closed, typed set of target keys the contextual guide can highlight.
// R2 had 27 field-level keys discovered via `document.querySelector` from
// a detached, fixed-position portal ring. That UX failed the operator's
// manual test (R2 report, operator feedback: highlight could appear
// visually detached from the real control). R3 replaces both the
// granularity (field-level -> workflow-AREA-level, task §5) and the
// mechanism (DOM query + portal -> a real wrapping component around the
// actual React element, see catalog-tutorial-target.tsx) — this registry
// only defines WHICH areas exist, never how they're found.

export const CATALOG_TUTORIAL_TARGET_KEYS = [
  "category-control",
  "add-product",
  "product-basic-info-area",
  "product-advanced-options-area",
  "product-review-area",
  "product-edit",
  "mode-expert",
  "ingredient-add",
  "ingredient-form-area",
  "addition-add",
  "addition-form-area",
  "product-own-sections",
  "shared-option-add",
  "shared-option-form-area",
  "product-shared-options",
  "catalog-section-add",
  "catalog-section-form-area",
  "preview-button",
] as const

export type CatalogTutorialTargetKey = (typeof CATALOG_TUTORIAL_TARGET_KEYS)[number]

export function isCatalogTutorialTargetKey(value: string): value is CatalogTutorialTargetKey {
  return (CATALOG_TUTORIAL_TARGET_KEYS as readonly string[]).includes(value)
}
