// P2-T47-R1: contrato estático del ProductConfigurator (compartido
// verbatim con /operaciones/mi-panel/[slug]/pedido/[mesaId] vía
// re-export literal). Montar el modal completo exigiría un harness
// enorme (fetch del menú, mutaciones, router de Next) para una tarea de
// puro rediseño visual que no cambia ninguna regla de producto — se
// verifica por assertions de código fuente, mismo patrón ya aceptado en
// T45/T49/T50 para lógica de presentación.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const source = readFileSync(
  join(process.cwd(), "src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx"),
  "utf8"
)

describe("P2-T47-R1 — Badge Obligatorio", () => {
  test("OptionGroup acepta `obligatorio` y renderiza Badge sólo cuando es true", () => {
    expect(source).toContain("obligatorio?: boolean")
    expect(source).toMatch(/\{obligatorio && \(\s*<Badge/)
  })

  test("grupo de secciones propias pasa `obligatorio={section.obligatorio}` (ya no sufijo ' *')", () => {
    expect(source).toContain("obligatorio={section.obligatorio}")
    expect(source).not.toContain('section.obligatorio ? " *" : ""')
  })

  test("grupo de opciones compartidas pasa `obligatorio={group.obligatorio}` (ya no sufijo ' *')", () => {
    expect(source).toContain("obligatorio={group.obligatorio}")
    expect(source).not.toContain('group.obligatorio ? " *" : ""')
  })

  test("Agregados y Quitar ingredientes NUNCA pasan `obligatorio` (siempre opcionales)", () => {
    expect(source).toMatch(/<OptionGroup title="Agregados">/)
    expect(source).toMatch(/<OptionGroup title="Quitar ingredientes">/)
  })
})

describe("P2-T47-R1 — contador de selección N/máximo", () => {
  test("secciones multi-select muestran `${selectedCount}/${section.maximo}`", () => {
    expect(source).toContain("description={section.maximo > 1 ? `${selectedCount}/${section.maximo}` : undefined}")
  })

  test("opciones compartidas muestran `${selectedCount}/${group.maximo}`", () => {
    expect(source).toContain("description={group.maximo > 0 ? `${selectedCount}/${group.maximo}` : undefined}")
  })

  test("el contador de opciones compartidas cuenta las keys seleccionadas de ESE grupo (mismo criterio que toggleShared)", () => {
    expect(source).toContain(
      "const selectedCount = Object.keys(selectedShared).filter((key) => key.startsWith(`${group.id}::`)).length"
    )
  })
})

describe("P2-T47-R1 — selección activa: check + aria-pressed", () => {
  test("ChoiceButton declara aria-pressed={active}", () => {
    expect(source).toContain("aria-pressed={active}")
  })

  test("ChoiceButton renderiza un ícono Check cuando está activo, no sólo color", () => {
    expect(source).toMatch(/\{active && <Check className="h-3\.5 w-3\.5 shrink-0" \/>\}/)
  })
})

describe("P2-T47-R1 — variante visual para quitar ingredientes", () => {
  test("ChoiceButton acepta variant 'default' | 'remove'", () => {
    expect(source).toContain('variant?: "default" | "remove"')
  })

  test("el grupo Quitar ingredientes pasa variant=\"remove\"", () => {
    expect(source).toMatch(/active=\{!!removedIngredientes\[ingrediente\.id\]\}\s*\n\s*variant="remove"/)
  })

  test("variant=remove activo usa tratamiento rojo/tachado (nunca el mismo estilo que agregar)", () => {
    expect(source).toContain("border-red-300 bg-red-50 text-red-600 line-through")
  })

  test("el texto 'Sin {nombre}' se preserva sin cambios", () => {
    expect(source).toContain("Sin {ingrediente.nombre}")
  })
})

describe("P2-T47-R1 — extras con precio: formato sin cambios", () => {
  test("agregados siguen usando +{formatPrice(agregado.precio)}", () => {
    expect(source).toContain('<span className="text-xs text-muted-foreground">+{formatPrice(agregado.precio)}</span>')
  })

  test("opciones compartidas siguen usando +{formatPrice(option.precio)}", () => {
    expect(source).toContain('<span className="text-xs text-muted-foreground">+{formatPrice(option.precio)}</span>')
  })

  test("secciones propias siguen usando formatOptionalPriceDelta sin cambios de firma", () => {
    expect(source).toContain("formatOptionalPriceDelta(opt.precio, formatPrice)")
  })
})

describe("P2-T47-R1 — QuantityStepper: papelera falsa eliminada del configurador", () => {
  test("QuantityStepper acepta allowRemoveAtMin (default false)", () => {
    expect(source).toContain("allowRemoveAtMin = false")
  })

  test("el botón de decrecer se deshabilita en el mínimo salvo que allowRemoveAtMin sea true", () => {
    expect(source).toContain("disabled={atMin && !allowRemoveAtMin}")
  })

  test("sólo se muestra la papelera cuando atMin && allowRemoveAtMin (nunca una promesa falsa)", () => {
    expect(source).toContain("const showTrash = atMin && allowRemoveAtMin")
    expect(source).toContain("{showTrash ? <Trash2 className=")
  })

  test("CONFIGURATOR_FAKE_TRASH_REMOVED: la instancia del modal (quantity/setQuantity) NO pasa allowRemoveAtMin", () => {
    const configuratorStepperMatch = source.match(
      /<QuantityStepper\s+value=\{quantity\}\s+onDecrease=\{\(\) => setQuantity\(\(current\) => Math\.max\(1, current - 1\)\)\}\s+onIncrease=\{\(\) => setQuantity\(\(current\) => Math\.min\(99, current \+ 1\)\)\}\s+\/>/
    )
    expect(configuratorStepperMatch).not.toBeNull()
  })

  test("CARTLINE_REAL_REMOVE_PRESERVED: CartLine SÍ pasa allowRemoveAtMin (bajar a 0 sigue eliminando la línea)", () => {
    const cartLineStepperMatch = source.match(
      /<QuantityStepper\s+value=\{item\.cantidad\}\s+onDecrease=\{\(\) => onQuantityChange\(item\.key, item\.cantidad - 1\)\}\s+onIncrease=\{\(\) => onQuantityChange\(item\.key, item\.cantidad \+ 1\)\}\s+allowRemoveAtMin\s+\/>/
    )
    expect(cartLineStepperMatch).not.toBeNull()
    // La papelera dedicada por línea (bajar a 0 directo) sigue existiendo sin cambios.
    expect(source).toContain('onClick={() => onQuantityChange(item.key, 0)}')
  })
})

describe("P2-T47-R1 — mobile: safe-area y touch targets", () => {
  test("el bottom bar del configurador incluye env(safe-area-inset-bottom)", () => {
    expect(source).toContain("pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]")
  })

  test("los botones de QuantityStepper miden 44px (h-11 w-11)", () => {
    expect(source).toContain('className="h-11 w-11 rounded-xl"')
    expect(source).not.toContain('className="h-8 w-8 rounded-xl"')
  })

  test("ChoiceButton usa min-h-11 (44px), ya no min-h-9 (36px)", () => {
    expect(source).toContain("min-h-11 items-center gap-2 rounded-xl border")
    expect(source).not.toContain("min-h-9 items-center justify-between gap-2 rounded-xl border")
  })
})

describe("P2-T47-R1 — reglas de producto y total: sin cambios", () => {
  test("CTA sigue disabled={!canAdd}", () => {
    expect(source).toContain("disabled={!canAdd}")
  })

  test("el total sigue siendo unitTotal * quantity", () => {
    expect(source).toContain("{formatPrice(unitTotal * quantity)}")
  })

  test("canAdd conserva exactamente su lógica de obligatoriedad (sectionsOk/sharedOk)", () => {
    expect(source).toContain("const sectionsOk = product.secciones")
    expect(source).toContain("const sharedOk = product.opcionesCompartidas")
    expect(source).toContain("return sectionsOk && sharedOk")
  })

  test("el payload del pedido (secciones/agregados/ingredientesQuitados) no cambia de forma", () => {
    expect(source).toContain("secciones: selectedSections")
  })
})

describe("P2-T47-R1 — Operaciones reutiliza el mismo ProductConfigurator (sin duplicar)", () => {
  test("el re-export de Operaciones sigue apuntando a este mismo archivo", () => {
    const reExportSource = readFileSync(
      join(process.cwd(), "src/app/operaciones/mi-panel/[slug]/pedido/[mesaId]/page.tsx"),
      "utf8"
    )
    expect(reExportSource).toContain('export { default } from "@/app/mozo/panel/[slug]/pedido/[mesaId]/page"')
  })
})
