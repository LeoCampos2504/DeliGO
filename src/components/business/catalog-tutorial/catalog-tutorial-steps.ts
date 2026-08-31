// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R1 — pure step content
// ============================================
// Content and ordering for the restaurant-priority guided catalog
// tutorial (task §11, STEP 0-16). Every fact here is grounded in
// codex-reports/BUSINESS_CATALOG_TUTORIAL_AUDIT_R1.md — this file must
// never teach a feature the audit found does not exist (product
// cloning, guaranteed full stock-hiding, per-ingredient
// non-removability, price delta on a product's own sections, a global
// unsaved-changes guard). Where the audit found a UI/copy inconsistency
// (stock switch's "Oculto del catálogo" helper vs. the real "Sin stock,
// no comprable" public behavior — audit §13.1), the tutorial states the
// REAL observable behavior, not the misleading helper text.

import type { CatalogTutorialRubro, CatalogTutorialStep } from "./catalog-tutorial-types"

// The host app's `negocio.rubro` is an untyped `string` (business-panel.tsx
// gates on `rubro === "ropa"` / `rubro === "negocio"` directly, no shared
// enum). This mirrors that exact same two-check fallback so the tutorial
// can never disagree with the real UI about which rubro is active.
export function normalizeRubro(rawRubro: string): CatalogTutorialRubro {
  if (rawRubro === "ropa") return "ropa"
  if (rawRubro === "negocio") return "negocio"
  return "restaurante"
}

// Only these two chapters are gated by rubro (audit §2.4: "Agregados e
// Ingredientes, sólo para restaurante en modo experto") — every other
// step applies across rubros with its noun swapped by resolveRubroCopy.
const RESTAURANT_ONLY: CatalogTutorialRubro[] = ["restaurante"]

export interface RubroCopy {
  productSingular: string // "producto" | "prenda"
  productSingularCap: string // "Producto" | "Prenda"
  productPlural: string // "productos" | "prendas"
  productsTabLabel: string // "Productos" | "Prendas"
}

// Audit §2.4/§4.3: the panel swaps "Productos"->"Prendas" and
// "producto"->"prenda" for the ropa rubro; every other rubro (including
// any future generic one) keeps the restaurant/default wording, since
// the audit did not find a third distinct labeling convention.
export function resolveRubroCopy(rubro: CatalogTutorialRubro): RubroCopy {
  if (rubro === "ropa") {
    return {
      productSingular: "prenda",
      productSingularCap: "Prenda",
      productPlural: "prendas",
      productsTabLabel: "Prendas",
    }
  }
  return {
    productSingular: "producto",
    productSingularCap: "Producto",
    productPlural: "productos",
    productsTabLabel: "Productos",
  }
}

// Resolves the {producto}/{Producto}/{productos}/{Productos} tokens a
// step's title/description/details may contain. Never resolves anything
// else — plain string substitution only, no HTML, no markdown.
export function resolveStepCopy(text: string, rubro: CatalogTutorialRubro): string {
  const copy = resolveRubroCopy(rubro)
  return text
    .replaceAll("{Productos}", copy.productsTabLabel)
    .replaceAll("{Producto}", copy.productSingularCap)
    .replaceAll("{productos}", copy.productPlural)
    .replaceAll("{producto}", copy.productSingular)
}

export const CATALOG_TUTORIAL_STEPS: CatalogTutorialStep[] = [
  {
    id: "intro",
    chapterTitle: "Introducción",
    title: "Cómo funciona tu catálogo",
    description:
      "Tu catálogo se organiza en Categorías, {Productos}, Ingredientes, Agregados, Secciones y Opciones compartidas.",
    details: [
      "Categorías agrupan tus {productos} para que sean más fáciles de encontrar.",
      "Ingredientes y Agregados son listas reutilizables (sólo para restaurante en modo experto).",
      "\"Secciones\" en la pestaña de {Productos} son agrupaciones visibles del catálogo público (por ejemplo \"Promociones\").",
      "\"Secciones de opciones\" dentro de un {producto} experto son personalizaciones propias de ESE {producto} — no son lo mismo.",
      "Opciones compartidas son grupos de personalización reutilizables entre varios {productos}.",
    ],
    actionKey: "none",
    completionLabel: "Entendido, continuar",
  },
  {
    id: "create-category",
    chapterTitle: "Categorías",
    title: "Creá una categoría",
    description:
      "Las categorías agrupan {productos} similares. Evitá crear una categoría distinta para cada {producto}.",
    details: [
      "Ejemplo: \"Hamburguesas\" para agrupar varias hamburguesas.",
      "Pulsá la pastilla \"Categoría\" en la tira de categorías y escribí el nombre.",
    ],
    actionLabel: "Ir a {Productos}",
    actionKey: "goToProducts",
    completionLabel: "Ya la creé",
    targetKey: "category-control",
  },
  {
    id: "create-simple-product",
    chapterTitle: "Tu primer {producto}",
    title: "Creá tu primer {producto} simple",
    description: "El modo Simple pide sólo la información básica para publicar un {producto}.",
    details: [
      "1. Nombre — ej: Hamburguesa Clásica",
      "2. Precio — un valor de ejemplo, mayor que 0",
      "3. Categoría — elegí Hamburguesas u otra existente",
      "4. Imagen principal — opcional",
      "5. Galería de imágenes — opcional",
      "6. Stock disponible — dejalo activo si querés aceptar compras",
      "Al guardar vas a ver el mensaje \"Producto guardado correctamente\". Esperá ese mensaje antes de continuar.",
    ],
    actionLabel: "Crear {producto} simple",
    actionKey: "openCreateProduct",
    completionLabel: "Ya lo creé y vi el mensaje de guardado",
    targetKey: "add-product",
    // R2 §9: the audited SIMPLE_PRODUCT_FIELD_COUNT=6, exactly this order.
    fieldGuide: [
      { id: "field-name", label: "Nombre", targetKey: "product-name" },
      { id: "field-price", label: "Precio", targetKey: "product-price" },
      { id: "field-category", label: "Categoría", targetKey: "product-category" },
      { id: "field-main-image", label: "Imagen principal", targetKey: "product-main-image" },
      { id: "field-gallery", label: "Galería de imágenes", targetKey: "product-gallery" },
      { id: "field-stock", label: "Stock disponible", targetKey: "product-stock" },
    ],
  },
  {
    id: "edit-product",
    chapterTitle: "Editar",
    title: "Editá un {producto} existente",
    description: "Buscá el {producto} que acabás de crear, tocá Editar y modificá algún dato.",
    details: [
      "Podés cambiar nombre, precio, categoría o imagen.",
      "Guardá y esperá el mensaje de confirmación.",
      "No cierres el formulario ni cambies de pantalla antes de guardar: hoy no hay un aviso de cambios sin guardar.",
    ],
    actionLabel: "Ir a {Productos}",
    actionKey: "goToProducts",
    completionLabel: "Ya lo edité y guardé",
    targetKey: "product-edit",
  },
  {
    id: "simple-vs-expert",
    chapterTitle: "Simple vs. Experto",
    title: "¿Cuándo usar Simple y cuándo Experto?",
    description: "Simple carga {productos} rápido con lo básico. Experto suma herramientas avanzadas.",
    details: [
      "Experto agrega: descripción, descuento, ingredientes, agregados, secciones propias y opciones compartidas.",
      "Modo Experto no convierte el {producto} ni borra lo que ya cargaste. Sólo muestra herramientas adicionales.",
      "Podés alternar entre Simple y Experto las veces que quieras sin perder datos.",
    ],
    actionLabel: "Pasar a Modo Experto",
    actionKey: "setModeExpert",
    completionLabel: "Listo, continuar",
    targetKey: "mode-expert",
  },
  {
    id: "description-discounts",
    chapterTitle: "Descripción y descuentos",
    title: "Descripción y descuentos",
    description: "En modo Experto podés agregar una descripción y, opcionalmente, un descuento.",
    details: [
      "Descripción: texto opcional que ven tus clientes.",
      "Descuento por porcentaje: ejemplo 15% (válido entre 1% y 100%).",
      "Descuento por monto fijo: ejemplo $800 (siempre debe quedar por debajo del precio base).",
      "No hace falta aplicar los dos — podés dejarlo como ejemplo educativo sin guardar un descuento real todavía.",
    ],
    actionKey: "none",
    completionLabel: "Entendido",
    fieldGuide: [
      { id: "field-description", label: "Descripción", targetKey: "product-description" },
      { id: "field-discount", label: "Descuento", targetKey: "product-discount" },
    ],
  },
  {
    id: "create-ingredients",
    chapterTitle: "Ingredientes",
    title: "Ingredientes que el cliente puede quitar",
    description: "Un ingrediente es algo que ya viene incluido en el {producto} y que el cliente puede sacar.",
    details: [
      "Ejemplos: Carne, Queso, Lechuga, Tomate, Cebolla.",
      "No tienen precio — quitarlos no cambia el total.",
      "Creá el ingrediente y después asignalo desde el {producto} experto, en la sección Ingredientes.",
      "Hoy todo ingrediente vinculado se puede quitar; no existe una opción para marcarlo como no removible.",
    ],
    actionLabel: "Ir a Ingredientes",
    actionKey: "goToIngredients",
    completionLabel: "Ya lo creé",
    supportedRubros: RESTAURANT_ONLY,
    targetKey: "ingredients-tab",
    fieldGuide: [
      { id: "field-ingredient-add", label: "Agregar ingrediente", targetKey: "ingredient-add" },
      { id: "field-product-ingredients", label: "Ingredientes del {producto}", targetKey: "product-ingredients" },
    ],
  },
  {
    id: "create-additions",
    chapterTitle: "Agregados",
    title: "Extras que el cliente puede agregar",
    description: "Un agregado es un extra que el cliente puede sumar, y puede tener costo o ser gratuito.",
    details: [
      "Ejemplos: Queso extra +$500, Panceta +$700, Huevo +$400, Salsa extra +$0.",
      "Precio 0 es válido: representa un extra gratuito.",
      "Creá el agregado y después asignalo desde el {producto} experto, en la sección Agregados.",
    ],
    actionLabel: "Ir a Agregados",
    actionKey: "goToAdditions",
    completionLabel: "Ya lo creé",
    supportedRubros: RESTAURANT_ONLY,
    targetKey: "additions-tab",
    fieldGuide: [
      { id: "field-addition-add", label: "Agregar agregado", targetKey: "addition-add" },
      { id: "field-product-additions", label: "Agregados del {producto}", targetKey: "product-additions" },
    ],
  },
  {
    id: "own-product-section",
    chapterTitle: "Secciones de opciones propias",
    title: "Creá una elección exclusiva de un {producto}",
    description:
      "Una sección de opciones propia pertenece a un solo {producto} y no se reutiliza en otros.",
    details: [
      "Ejemplo A — {Producto} Pizza Especial, sección \"Tamaño\": Individual / Familiar, Obligatoria, Máx. 1.",
      "Ejemplo B — {Producto} Papas Especiales, sección \"Salsas\": Opcional, Máx. 2.",
      "Obligatoria exige que el cliente elija al menos una opción antes de poder pedir.",
      "Máx. 0 se comporta como selección única (radio); un máximo mayor permite elegir varias.",
      "Las opciones propias hoy no tienen un precio individual distinto — a diferencia de las opciones compartidas.",
    ],
    actionLabel: "Ir a {Productos}",
    actionKey: "goToProducts",
    completionLabel: "Ya la creé",
    targetKey: "product-own-sections",
  },
  {
    id: "create-shared-options",
    chapterTitle: "Opciones compartidas",
    title: "Creá opciones que puedas reutilizar",
    description: "Una opción compartida es un grupo que podés usar en varios {productos} a la vez.",
    details: [
      "Ejemplo — \"Elegí tu bebida\": Coca-Cola +$0, Sprite +$0, Agua Mineral +$300. Obligatoria, Máx. 1.",
      "A diferencia de una sección propia, las opciones compartidas SÍ pueden tener precio por opción.",
    ],
    actionLabel: "Ir a Opciones",
    actionKey: "goToSharedOptions",
    completionLabel: "Ya la creé",
    targetKey: "shared-options-tab",
    fieldGuide: [{ id: "field-shared-option-add", label: "Agregar opción compartida", targetKey: "shared-option-add" }],
  },
  {
    id: "reuse-shared-options",
    chapterTitle: "Opciones compartidas",
    title: "Reutilizá una opción compartida en varios {productos}",
    description: "No vuelvas a crear la misma lista. Creala una sola vez y reutilizala.",
    details: [
      "Ejemplo: vinculá \"Elegí tu bebida\" a dos {productos} distintos (por ejemplo Lomito Completo y Combo Demo).",
      "Editar nombres, opciones o precios del grupo compartido afecta a TODOS los {productos} vinculados.",
      "Obligatorio y Máx. pueden configurarse distinto en cada {producto}, aunque el grupo sea el mismo.",
    ],
    actionLabel: "Ir a {Productos}",
    actionKey: "goToProducts",
    completionLabel: "Ya la reutilicé",
    targetKey: "product-shared-options",
  },
  {
    id: "stock",
    chapterTitle: "Disponibilidad",
    title: "Stock y disponibilidad",
    description: "Así se comporta hoy el catálogo público, más allá de lo que diga el texto de ayuda del switch.",
    details: [
      "Stock activo: el {producto} se puede comprar normalmente.",
      "Stock inactivo: el {producto} puede seguir apareciendo en el catálogo público, marcado \"Sin stock\", y no se puede agregar al carrito.",
      "No es un ocultamiento total garantizado — hoy no existe un control separado para ocultar completamente un {producto}.",
    ],
    actionLabel: "Ir a {Productos}",
    actionKey: "goToProducts",
    completionLabel: "Entendido",
    targetKey: "product-stock",
  },
  {
    id: "catalog-sections",
    chapterTitle: "Secciones del catálogo",
    title: "Organizá tus {productos} en secciones visibles",
    description: "\"Secciones\" en la pestaña de {Productos} agrupa {productos} en la página pública.",
    details: [
      "Esto NO es lo mismo que una \"sección de opciones\" dentro de un {producto} experto.",
      "Ejemplo: creá una sección \"Más elegidos\".",
      "Configurá nombre, orientación (vertical/grilla u horizontal/fila), color y elegí los {productos}.",
      "Podés reordenar las secciones con las flechas subir/bajar.",
    ],
    actionLabel: "Ir a Secciones",
    actionKey: "goToCatalogSections",
    completionLabel: "Ya la creé",
    targetKey: "catalog-sections-tab",
    fieldGuide: [{ id: "field-catalog-section-add", label: "Agregar sección", targetKey: "catalog-section-add" }],
  },
  {
    id: "preview",
    chapterTitle: "Vista previa",
    title: "Mirá tu catálogo como lo ve un cliente",
    description: "La vista previa muestra tu catálogo público sin permitir comprar.",
    details: [
      "Revisá: imágenes, nombre, descripción, categoría, precio, descuento, stock, ingredientes, agregados, secciones obligatorias y opciones compartidas.",
      "Vas a ver la banda \"Estás en modo vista previa\".",
      "La vista previa no monta el carrito ni el flujo real de pedido.",
      "Entrá a un {producto} y probá ingredientes, agregados y opciones como lo verá tu cliente. En Vista previa no se puede realizar un pedido.",
    ],
    actionLabel: "Abrir Vista previa",
    actionKey: "openPreview",
    completionLabel: "Ya la revisé",
    targetKey: "preview-button",
  },
  {
    id: "edit-reusable-safely",
    chapterTitle: "Edición segura",
    title: "Editá contenido reutilizable con cuidado",
    description: "Ingredientes, Agregados y Opciones compartidas se usan en varios {productos} a la vez.",
    details: [
      "Editar un ingrediente o agregado cambia esa entidad para todos los {productos} que la usan.",
      "Editar una opción compartida (por ejemplo cambiar \"Agua Mineral +$300\" a \"+$500\") se refleja en todos los {productos} vinculados.",
      "Antes de editar algo reutilizable, pensá en cuántos {productos} lo usan.",
    ],
    actionKey: "none",
    completionLabel: "Entendido",
  },
  {
    id: "delete-safely",
    chapterTitle: "Borrado seguro",
    title: "Eliminá con seguridad",
    description: "Este paso es educativo — no hace falta borrar nada para completarlo.",
    details: [
      "{Producto}: desaparece como entidad activa; el historial de pedidos conserva su snapshot.",
      "Ingrediente: se quita de todos los {productos} que lo usaban.",
      "Agregado: se quita de todos los {productos} que lo usaban.",
      "Sección del catálogo: desaparece la agrupación, los {productos} permanecen.",
      "Opción compartida: el grupo desaparece de todos los {productos} vinculados.",
      "Categoría: sus {productos} pasan a \"Sin categoría\".",
      "Antes de eliminar, revisá cuántos {productos} lo usan.",
    ],
    actionKey: "none",
    completionLabel: "Entendido",
  },
  {
    id: "final-checklist",
    chapterTitle: "Listo",
    title: "Tu catálogo está listo para revisar",
    description: "Repasá esta lista antes de considerar tu catálogo terminado.",
    details: [
      "Categorías claras",
      "{Productos} con nombre y precio",
      "Imágenes revisadas",
      "Stock correcto",
      "Descuentos correctos",
      "Ingredientes correctos",
      "Agregados correctos",
      "Secciones obligatorias probadas",
      "Opciones compartidas reutilizadas",
      "Vista previa revisada",
    ],
    actionKey: "none",
    completionLabel: "Finalizar tutorial",
  },
]

export function getVisibleSteps(rubro: CatalogTutorialRubro): CatalogTutorialStep[] {
  return CATALOG_TUTORIAL_STEPS.filter((step) => !step.supportedRubros || step.supportedRubros.includes(rubro))
}

export function getStepById(stepId: string): CatalogTutorialStep | undefined {
  return CATALOG_TUTORIAL_STEPS.find((step) => step.id === stepId)
}

// §12 — "¿Qué debería usar?" quick-decision card, grounded in the same
// audited behavior (ingredient=removable-no-price,
// addition=extra-with/without-price, own section=product-exclusive,
// shared option=reusable).
export interface CatalogTutorialDecisionRow {
  need: string
  answer: string
}

export const CATALOG_TUTORIAL_DECISION_TABLE: CatalogTutorialDecisionRow[] = [
  { need: "Que el cliente pueda quitar tomate", answer: "Ingrediente" },
  { need: "Que agregue panceta por un precio extra", answer: "Agregado" },
  { need: "Que elija algo exclusivo de este {producto}", answer: "Sección de opciones propia" },
  { need: "Que la misma elección aparezca en varios {productos}", answer: "Opción compartida" },
]

// §13 — compact comparison, own product section vs. shared option.
export interface CatalogTutorialComparisonColumn {
  title: string
  points: string[]
}

export const CATALOG_TUTORIAL_OWN_VS_SHARED_COMPARISON: CatalogTutorialComparisonColumn[] = [
  {
    title: "Sección propia",
    points: [
      "Pertenece a un solo {producto}",
      "No es reutilizable",
      "Obligatoria u opcional",
      "Tiene un máximo de selecciones",
      "Las opciones no cambian el precio hoy",
    ],
  },
  {
    title: "Opción compartida",
    points: [
      "Reutilizable en varios {productos}",
      "Se puede vincular a varios {productos} a la vez",
      "Las opciones sí pueden tener precio",
      "El contenido compartido actualiza a todos los {productos} vinculados",
      "Obligatorio y máximo pueden variar por {producto}",
    ],
  },
]
