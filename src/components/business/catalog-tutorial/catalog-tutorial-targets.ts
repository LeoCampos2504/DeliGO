// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R2 §6 — stable target registry
// ============================================
// A closed, typed set of `data-catalog-tutorial-target` values. Kept as a
// plain string-literal registry (not a full React ref context) — task
// §6 explicitly allows this pattern and prefers it over a ref registry
// that would require touching every target component's internals just to
// register a ref. The DOM lookup this registry supports is used ONLY for
// visual discovery (scrollIntoView + bounding rect) — never to click,
// submit, or mutate anything (§7).

export const CATALOG_TUTORIAL_TARGET_KEYS = [
  "catalog-tutorial-button",
  "category-control",
  "add-product",
  "mode-simple",
  "mode-expert",
  "product-name",
  "product-price",
  "product-category",
  "product-main-image",
  "product-gallery",
  "product-stock",
  "product-description",
  "product-discount",
  "ingredients-tab",
  "ingredient-add",
  "product-ingredients",
  "additions-tab",
  "addition-add",
  "product-additions",
  "product-own-sections",
  "shared-options-tab",
  "shared-option-add",
  "product-shared-options",
  "catalog-sections-tab",
  "catalog-section-add",
  "preview-button",
  "product-edit",
] as const

export type CatalogTutorialTargetKey = (typeof CATALOG_TUTORIAL_TARGET_KEYS)[number]

export function buildTargetSelector(key: CatalogTutorialTargetKey): string {
  return `[data-catalog-tutorial-target="${key}"]`
}

export function isCatalogTutorialTargetKey(value: string): value is CatalogTutorialTargetKey {
  return (CATALOG_TUTORIAL_TARGET_KEYS as readonly string[]).includes(value)
}
