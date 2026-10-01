// P2-T56-R3A-P0 — contrato estático del selector de variantes del pedido
// manual de Mozo (compartido verbatim con /operaciones/mi-panel vía
// re-export). Mismo criterio que page.test.ts: montar el modal exigiría un
// harness enorme; la lógica de identidad de carrito se prueba de forma
// aislada en src/lib/mozo-order-item-key.test.ts y la autoridad de precio /
// validación en route.variantes.test.ts.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const source = readFileSync(
  join(process.cwd(), "src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx"),
  "utf8"
)

describe("P2-T56-R3A-P0 — selector de variantes Mozo", () => {
  test("MenuProduct conoce tieneVariantes/variantes con el tipo compartido de Cliente", () => {
    expect(source).toContain("tieneVariantes: boolean")
    expect(source).toContain("variantes: ClientProductoVariante[]")
    expect(source).toContain('from "@/lib/client-product-variants"')
  })

  test("selector propio 'Elegí una opción', obligatorio, separado de secciones/opciones", () => {
    expect(source).toContain('<OptionGroup title="Elegí una opción" obligatorio>')
    expect(source).toContain("const [selectedVarianteId, setSelectedVarianteId] = useState<string | null>")
    // La variante nunca se guarda dentro de las secciones del producto.
    expect(source).not.toMatch(/setSelectedSections\([^)]*variante/i)
  })

  test("variante sin stock visible pero no seleccionable", () => {
    expect(source).toContain("const disponible = isVarianteDisponible(variante)")
    expect(source).toContain("disabled={!disponible}")
    expect(source).toContain('{disponible ? formatPrice(variante.precio) : "Sin stock"}')
  })

  test("agregar exige una variante disponible y nunca usa el precio base dormido", () => {
    expect(source).toContain(
      "const varianteOk = !product.tieneVariantes || (selectedVariante !== null && isVarianteDisponible(selectedVariante))"
    )
    expect(source).toContain(
      "const basePrice = product.tieneVariantes ? (selectedVariante?.precio ?? 0) : (product.precioPromo ?? product.precio)"
    )
    expect(source).toContain("return sectionsOk && sharedOk && varianteOk")
  })

  test("identidad de línea: buildOrderItemKey compartido recibe varianteId", () => {
    expect(source).toContain('import { buildOrderItemKey } from "@/lib/mozo-order-item-key"')
    expect(source).toMatch(/buildOrderItemKey\(\{\s*productoId: product\.id,\s*varianteId,/)
    expect(source).not.toContain("function buildOrderItemKey(")
  })

  test("el POST envía varianteId por línea (nunca un precio)", () => {
    const bodyStart = source.indexOf("items: cart.map((item) => ({")
    const bodyBlock = source.slice(bodyStart, source.indexOf("})),", bodyStart))
    expect(bodyBlock).toContain("varianteId: item.varianteId,")
    expect(bodyBlock).not.toMatch(/\bprecio\b/)
  })

  test("la línea del carrito muestra la variante elegida", () => {
    expect(source).toContain("{item.varianteNombre && (")
  })

  test("card del menú: precio de variante / 'Desde' / 'Sin stock', nunca el precio base", () => {
    expect(source).toContain("{getMenuProductPriceLabel(product)}")
    expect(source).toContain('if (!isProductoConVariantesDisponible(product.variantes)) return "Sin stock"')
  })
})
