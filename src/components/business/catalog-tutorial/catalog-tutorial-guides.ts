// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R3 §12-19 — workflow-level guide phases
// ============================================
// Pure content: for a tutorial step that drives a contextual guide, the
// ordered list of phases it walks through. Each phase names ONE real
// workflow AREA to highlight (never an individual field, task §5) plus a
// short coach message. Guide id == tutorial step id — one guide per step
// that has an "Ir a..." action, no separate id namespace to keep in sync.
//
// Phase count is deliberately small (1-4, task §12: "NOT 10+"). The
// product-creation guide's phase list depends on the panel's real Simple/
// Expert mode (task §12, §14) — "Opciones avanzadas" only exists as a
// real form step in Expert mode, so it's simply absent from the Simple
// phase list rather than shown pointing at nothing.

import type { CatalogTutorialTargetKey } from "./catalog-tutorial-targets"

export interface CatalogTutorialGuidePhase {
  id: string
  targetKey: CatalogTutorialTargetKey
  title: string
  // May contain "\n\n" for a short paragraph break, and the same
  // {producto}/{Producto} tokens as step text (resolved by resolveStepCopy).
  body: string
}

export interface CatalogTutorialGuideContext {
  mode: "simple" | "expert"
}

const PRODUCT_ADD_BUTTON: CatalogTutorialGuidePhase = {
  id: "add-button",
  targetKey: "add-product",
  title: "Creá tu primer {producto}",
  body: "Empezá tocando Agregar {producto}.",
}

const PRODUCT_BASIC_INFO: CatalogTutorialGuidePhase = {
  id: "basic-info",
  targetKey: "product-basic-info-area",
  title: "Información básica",
  body:
    "Acá cargás los datos principales de tu {producto}: nombre, precio, categoría, imágenes y disponibilidad.\n\nCompletá los datos que necesites y después tocá Siguiente.",
}

const PRODUCT_ADVANCED_OPTIONS: CatalogTutorialGuidePhase = {
  id: "advanced-options",
  targetKey: "product-advanced-options-area",
  title: "Opciones avanzadas",
  body:
    "Acá podés completar descripción, descuentos y personalizaciones como ingredientes, agregados, secciones de opciones y opciones compartidas.\n\nUsá únicamente las que necesite tu {producto}.",
}

const PRODUCT_REVIEW: CatalogTutorialGuidePhase = {
  id: "review",
  targetKey: "product-review-area",
  title: "Revisá antes de guardar",
  body: "Revisá los datos antes de guardar.\n\nCuando esté todo correcto, tocá Guardar {producto}.",
}

const PRODUCT_EDIT_BUTTON: CatalogTutorialGuidePhase = {
  id: "edit-button",
  targetKey: "product-edit",
  title: "Editá un {producto}",
  body: "Elegí el {producto} que quieras modificar y tocá Editar.",
}

const MODE_EXPERT: CatalogTutorialGuidePhase = {
  id: "mode-toggle",
  targetKey: "mode-expert",
  title: "Modo Experto",
  body: "Activá Modo Experto para sumar herramientas avanzadas. No convierte tu {producto} ni borra lo que ya cargaste.",
}

const CATEGORY_CONTROL: CatalogTutorialGuidePhase = {
  id: "category-control",
  targetKey: "category-control",
  title: "Creá una categoría",
  body: "Tocá la pastilla Categoría y escribí el nombre.",
}

const INGREDIENT_ADD: CatalogTutorialGuidePhase = {
  id: "add-button",
  targetKey: "ingredient-add",
  title: "Creá ingredientes",
  body:
    "Los ingredientes son elementos que ya incluye el {producto} y que el cliente puede quitar.\n\nEmpezá tocando Agregar ingrediente.",
}

const INGREDIENT_FORM: CatalogTutorialGuidePhase = {
  id: "form",
  targetKey: "ingredient-form-area",
  title: "Nuevo ingrediente",
  body: "Acá cargás la información del ingrediente, como nombre, categoría e imagen.\n\nGuardalo cuando esté listo.",
}

const ADDITION_ADD: CatalogTutorialGuidePhase = {
  id: "add-button",
  targetKey: "addition-add",
  title: "Creá agregados",
  body:
    "Los agregados son extras que el cliente puede sumar a un {producto}. Pueden tener un precio adicional o no tener recargo.\n\nEmpezá tocando Agregar agregado.",
}

const ADDITION_FORM: CatalogTutorialGuidePhase = {
  id: "form",
  targetKey: "addition-form-area",
  title: "Nuevo agregado",
  body: "Acá cargás la información y el precio del extra.\n\nGuardalo cuando esté listo.",
}

const OWN_SECTION_AREA: CatalogTutorialGuidePhase = {
  id: "own-section-area",
  targetKey: "product-own-sections",
  title: "Secciones de opciones",
  body:
    "Usalas cuando esta elección pertenece solamente a este {producto}.\n\nPor ejemplo: Tamaño de esta pizza, Punto de cocción de esta hamburguesa.",
}

const SHARED_OPTION_ADD: CatalogTutorialGuidePhase = {
  id: "add-button",
  targetKey: "shared-option-add",
  title: "Creá una opción compartida",
  body:
    "Las opciones compartidas sirven cuando querés reutilizar la misma elección en varios {productos}.\n\nPor ejemplo: bebidas, salsas, sabores.",
}

const SHARED_OPTION_FORM: CatalogTutorialGuidePhase = {
  id: "form",
  targetKey: "shared-option-form-area",
  title: "Nueva opción compartida",
  body: "Cargá el nombre del grupo y sus opciones.\n\nGuardala cuando esté lista.",
}

const REUSE_SHARED_OPTION_AREA: CatalogTutorialGuidePhase = {
  id: "reuse-area",
  targetKey: "product-shared-options",
  title: "Reutilizá una opción compartida",
  body: "Seleccioná una opción compartida ya creada para vincularla a este {producto}. No hace falta volver a crearla.",
}

const STOCK_AREA: CatalogTutorialGuidePhase = {
  id: "stock-area",
  targetKey: "product-basic-info-area",
  title: "Stock y disponibilidad",
  body:
    "Stock activo: el {producto} se puede comprar normalmente. Stock inactivo: sigue apareciendo marcado \"Sin stock\", sin poder agregarse al carrito.",
}

const CATALOG_SECTION_ADD: CatalogTutorialGuidePhase = {
  id: "add-button",
  targetKey: "catalog-section-add",
  title: "Organizá tu catálogo",
  body: "Las secciones del catálogo agrupan {productos} en la vista pública.\n\nEmpezá tocando Agregar sección.",
}

const CATALOG_SECTION_FORM: CatalogTutorialGuidePhase = {
  id: "form",
  targetKey: "catalog-section-form-area",
  title: "Nueva sección",
  body:
    "Cargá nombre, orientación, color y elegí los {productos} de esta sección.\n\nGuardala cuando esté lista.",
}

const PREVIEW_BUTTON: CatalogTutorialGuidePhase = {
  id: "preview-button",
  targetKey: "preview-button",
  title: "Revisá tu catálogo",
  body:
    "En Vista previa podés abrir {productos}, probar ingredientes, agregados y opciones como los verá el cliente.\n\nNo se puede realizar un pedido desde Vista previa.",
}

// Guide id === tutorial step id (catalog-tutorial-steps.ts). Steps not
// listed here (intro, description-discounts, edit-reusable-safely,
// delete-safely, final-checklist) are purely informational — no guide.
const GUIDE_PHASES_BY_STEP_ID: Record<string, (ctx: CatalogTutorialGuideContext) => CatalogTutorialGuidePhase[]> = {
  "create-category": () => [CATEGORY_CONTROL],
  "create-simple-product": (ctx) => [
    PRODUCT_ADD_BUTTON,
    PRODUCT_BASIC_INFO,
    ...(ctx.mode === "expert" ? [PRODUCT_ADVANCED_OPTIONS] : []),
    PRODUCT_REVIEW,
  ],
  "edit-product": () => [PRODUCT_EDIT_BUTTON],
  "simple-vs-expert": () => [MODE_EXPERT],
  "create-ingredients": () => [INGREDIENT_ADD, INGREDIENT_FORM],
  "create-additions": () => [ADDITION_ADD, ADDITION_FORM],
  "own-product-section": () => [OWN_SECTION_AREA],
  "create-shared-options": () => [SHARED_OPTION_ADD, SHARED_OPTION_FORM],
  "reuse-shared-options": () => [REUSE_SHARED_OPTION_AREA],
  stock: () => [STOCK_AREA],
  "catalog-sections": () => [CATALOG_SECTION_ADD, CATALOG_SECTION_FORM],
  preview: () => [PREVIEW_BUTTON],
}

export function hasGuide(stepId: string): boolean {
  return stepId in GUIDE_PHASES_BY_STEP_ID
}

export function getGuidePhases(stepId: string, ctx: CatalogTutorialGuideContext): CatalogTutorialGuidePhase[] {
  const build = GUIDE_PHASES_BY_STEP_ID[stepId]
  return build ? build(ctx) : []
}

export function getFirstGuidePhase(
  stepId: string,
  ctx: CatalogTutorialGuideContext
): CatalogTutorialGuidePhase | null {
  return getGuidePhases(stepId, ctx)[0] ?? null
}
