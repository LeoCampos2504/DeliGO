// ============================================
// BUSINESS-CATALOG-UX-HARDENING-R1 — rubro capability authority
// ============================================
// One small, named authority for "does this rubro actually have feature X
// in the real UI today", instead of scattering `rubro === "restaurante"` /
// `!isRopa && !isNegocio` checks across more tutorial step definitions.
// Mirrors — never redefines — the app's own real gates:
//
// - business-panel.tsx: `showModeToggle = !isRopa && !isNegocio` hides the
//   Simple/Expert switch entirely for ropa/negocio and forces
//   `mode={showModeToggle ? mode : "simple"}` into ProductsTab regardless of
//   any stored preference — Expert mode is unreachable for those rubros.
// - products-tab.tsx: the Agregados/Ingredientes subtabs are gated
//   `mode === "expert" && !isRopa && !isNegocio`.
// - products-tab.tsx: the product form's expert-only step
//   (`mode === "expert" && formStep === 1`, which renders
//   description/discount/ProductOptionSectionsEditor for restaurante, or
//   StepRopaDetails/StepNegocioDetails for ropa/negocio) can never render
//   for ropa/negocio either, since mode is force-locked to "simple" for
//   them one level up — so those two components are unreachable through the
//   real UI today, not merely hidden behind a rubro check inside them.
//
// This file only READS that reality to decide what the tutorial may safely
// teach — it does not grant or change any capability itself. If a future
// task makes Expert mode reachable for another rubro, update it here once.
import type { CatalogTutorialRubro } from "./catalog-tutorial-types"

export interface CatalogRubroCapabilities {
  /** Whether the Simple/Expert switch exists and is reachable for this rubro. */
  supportsCatalogExpertMode: boolean
  /** Whether the Ingredientes subtab/feature is reachable for this rubro. */
  supportsIngredients: boolean
  /** Whether the Agregados subtab/feature is reachable for this rubro. */
  supportsAdditions: boolean
  /** Whether a product's own option sections (with priced options) are reachable for this rubro. */
  supportsRestaurantOwnOptions: boolean
}

export function getCatalogRubroCapabilities(rubro: CatalogTutorialRubro): CatalogRubroCapabilities {
  const isRestaurant = rubro === "restaurante"
  return {
    supportsCatalogExpertMode: isRestaurant,
    supportsIngredients: isRestaurant,
    supportsAdditions: isRestaurant,
    supportsRestaurantOwnOptions: isRestaurant,
  }
}
