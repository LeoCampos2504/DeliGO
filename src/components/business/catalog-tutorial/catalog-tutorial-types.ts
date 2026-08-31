// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R1 — pure types
// ============================================
// Shared types for the optional, in-app business-catalog tutorial. Kept
// dependency-free (no React, no DOM) so catalog-tutorial-steps.ts and
// catalog-tutorial-progress.ts stay pure and unit-testable, mirroring the
// pure/impure split already established elsewhere in this codebase (e.g.
// src/lib/ios-scroll-restore-decision.ts vs its DOM shell).

import type { CatalogTutorialTargetKey } from "./catalog-tutorial-targets"

// Rubro values as they appear in the business panel today
// (src/components/business/business-panel.tsx: `negocio.rubro` is a
// plain `string`, gated via `isRopa = rubro === "ropa"` /
// `isNegocio = rubro === "negocio"`; anything else is treated as
// restaurant-like). Only "restaurante" currently exposes
// Ingredientes/Agregados as expert-mode subtabs (gated
// `mode === "expert" && !isRopa && !isNegocio` in products-tab.tsx) — so
// tutorial steps for those two chapters must never be shown outside
// "restaurante". normalizeRubro() below maps any other raw string to
// this closed set the exact same way the app's own isRopa/isNegocio
// checks already do.
export type CatalogTutorialRubro = "restaurante" | "ropa" | "negocio"

// The only actions a tutorial step may trigger in the host UI — always a
// real navigation/mode-switch through actual component state, never a DOM
// click. "none" means the step is purely informational (STEP 0, discount
// education, delete-safety education, etc.) and has no "Ir a..." button.
export type CatalogTutorialActionKey =
  | "goToProducts"
  | "goToIngredients"
  | "goToAdditions"
  | "goToCatalogSections"
  | "goToSharedOptions"
  | "setModeSimple"
  | "setModeExpert"
  | "openCreateProduct"
  | "openPreview"
  | "none"

// BUSINESS-CATALOG-INAPP-TUTORIAL-R2 §9-10: one entry in a step's optional
// compact field sub-guide (Simple product's 6 fields, or an Expert area's
// handful of relevant controls). Never a value/label the owner types —
// only a display label and which real target to highlight.
export interface CatalogTutorialFieldGuideEntry {
  id: string
  // May contain the same {producto}/{Producto} tokens as step text.
  label: string
  targetKey: CatalogTutorialTargetKey
}

export interface CatalogTutorialStep {
  id: string
  chapterTitle: string
  title: string
  // May contain the literal token "{producto}" / "{Producto}" /
  // "{productos}", resolved at render time via resolveRubroCopy() in
  // catalog-tutorial-steps.ts — the only per-rubro label adaptation this
  // R1 tutorial performs (task §10: "adapt labels", not a full rewrite of
  // every chapter's content per rubro).
  description: string
  // Extra bullet points / example content shown under the description.
  // Kept as plain strings (never HTML) — rendered as a simple list.
  details?: string[]
  // undefined/omitted = shown for every rubro. When present, the step is
  // hidden entirely for any rubro not listed — never rendered as a
  // disabled/impossible step (task §10, §34: "unsupported business types
  // do not see impossible steps").
  supportedRubros?: CatalogTutorialRubro[]
  actionLabel?: string
  actionKey?: CatalogTutorialActionKey
  // Label for the manual "I did it" confirmation button. Every step is
  // manually completed by the owner (task §16: reliability over fragile
  // auto-detection heuristics) — this R1 implementation never infers
  // completion from product counts, DOM state, or polling.
  completionLabel: string
  // R2 §5, §8: when set, a "Mostrarme" action highlights this single real
  // target. Mutually usable alongside fieldGuide below for steps that
  // have both a primary target and a multi-field sub-guide.
  targetKey?: CatalogTutorialTargetKey
  // R2 §9-10: when set, renders a compact "Campo X de N" sub-navigator
  // inside the step (Anterior / Siguiente campo / Mostrarme), each entry
  // highlighting a different real field — without adding new top-level
  // steps (task: "Keep the existing 17-step architecture").
  fieldGuide?: CatalogTutorialFieldGuideEntry[]
}

export interface CatalogTutorialChapterGroup {
  chapterTitle: string
  stepIds: string[]
}
