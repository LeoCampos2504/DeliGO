// P2-T56-R2C-F2: contrato estático de la selección de ProductoVariante en
// Cliente (normal + Mesa comparten literalmente el mismo árbol de
// componentes en este archivo — ver el reporte). No hay entorno DOM en este
// repo, así que — igual que category-grouping-static-contract.test.ts y
// hero-safe-area-static-contract.test.ts — este archivo verifica el
// contrato por inspección de fuente (grep/string-assertion), no montaje.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const source = readFileSync(join(process.cwd(), "src/app/n/[slug]/page.tsx"), "utf8")

describe("P2-T56-R2C-F2 — ProductoAPI expone variantes públicas", () => {
  test("ProductoAPI declara tieneVariantes y variantes (ClientProductoVariante[])", () => {
    expect(source).toContain("tieneVariantes: boolean")
    expect(source).toContain("variantes: ClientProductoVariante[]")
  })

  test("importa la autoridad compartida de src/lib/client-product-variants (no reimplementa la lógica)", () => {
    expect(source).toMatch(/from "@\/lib\/client-product-variants"/)
    expect(source).toContain("isVarianteDisponible")
    expect(source).toContain("isProductoConVariantesDisponible")
    expect(source).toContain("precioDesdeVariantes")
    expect(source).toContain("resolveSingleActiveVariant")
    expect(source).toContain("type ClientProductoVariante")
  })
})

describe("P2-T56-R2C-F2 — ProductCard: disponibilidad y precio 'Desde' (sección 4/5)", () => {
  test("productoDisponible depende de isProductoConVariantesDisponible, nunca solo de product.stock cuando hay variantes", () => {
    expect(source).toContain("const algunaVarianteDisponible = !product.tieneVariantes || isProductoConVariantesDisponible(variantesActivas)")
    expect(source).toContain("const productoDisponible = product.stock && algunaVarianteDisponible")
  })

  test("un producto con >1 variante activa exige abrir el detalle (no quick-add directo)", () => {
    expect(source).toContain("variantesActivas.length > 1")
  })

  test("precio 'Desde' usa la autoridad compartida precioDesdeVariantes", () => {
    expect(source).toContain("const precioDesde = precioDesdeVariantes(variantesActivas)")
    expect(source).toMatch(/Desde \{formatPrice\(precioDesde\)\}/)
  })

  test("indicador de cantidad de variantes en la card (sección 4)", () => {
    expect(source).toMatch(/\{variantesActivas\.length\} variantes/)
  })

  test("precioPromo/descuentoLabel del producto base se ocultan una vez que tiene variantes (precios independientes)", () => {
    expect(source).toContain("const effectivePrecioPromo = product.tieneVariantes ? null : product.precioPromo")
    expect(source).toContain("const effectiveDescuentoLabel = product.tieneVariantes ? null : product.descuentoLabel")
  })

  test("el branch ROPA-STYLE CARD queda intacto (no referencia variantesActivas/productoDisponible)", () => {
    const ropaBlockMatch = source.match(/ROPA-STYLE CARD[\s\S]*?if \(isRopa\) \{([\s\S]*?)DEFAULT \(FOOD\) CARD/)
    expect(ropaBlockMatch).not.toBeNull()
    const ropaBlock = ropaBlockMatch![1]
    expect(ropaBlock).not.toContain("variantesActivas")
    expect(ropaBlock).not.toContain("productoDisponible")
    expect(ropaBlock).toContain("!product.stock")
  })
})

describe("P2-T56-R2C-F2 — quick-add de una sola variante activa identifica la variante (sección 7)", () => {
  test("resolveSingleActiveVariant decide el auto-select, nunca un [0] arbitrario", () => {
    expect(source).toContain("const singleActiveVariant = resolveSingleActiveVariant(variantesActivas)")
  })

  test("el toast de quick-add nombra la variante agregada, nunca un agregado silencioso", () => {
    expect(source).toMatch(/singleActiveVariant\s*\?\s*`\$\{product\.nombre\} — \$\{singleActiveVariant\.nombre\} agregado al carrito`/)
  })
})

describe("P2-T56-R2C-F2 — ProductDetailSheet: selector 'Elegí una opción' (sección 6/8/10/11)", () => {
  test("el selector solo aparece cuando product.tieneVariantes", () => {
    expect(source).toContain("{product.tieneVariantes && (")
    expect(source).toContain('<h4 className="font-bold text-sm mb-2">Elegí una opción</h4>')
  })

  test("usa el mismo patrón visual (border-2 + indicador circular) que las secciones propias de single-select — no un componente/lógica nuevos", () => {
    // Mismas clases base que el single-select radio de "secciones" (línea ya
    // existente, sección 8/9: reutilizar el lenguaje visual existente).
    expect(source).toContain('"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left text-sm transition-all"')
    expect(source).toContain('"w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"')
  })

  test("variante sin stock queda visible pero disabled con leyenda 'Sin stock' (sección 12) — nunca oculta", () => {
    expect(source).toContain("disabled={!disponible}")
    expect(source).toContain('<span className="text-xs font-semibold text-muted-foreground">Sin stock</span>')
  })

  test("selección de variante usa su propio estado (selectedVarianteId), nunca selectedSecciones (no se fusiona con Opciones del producto, sección 13)", () => {
    expect(source).toContain("const [selectedVarianteId, setSelectedVarianteId] = useState<string | null>")
    expect(source).toContain("onClick={() => setSelectedVarianteId(variante.id)}")
    const selectSectionOptionMatch = source.match(/const selectSectionOption = \(sectionName: string, option: string\) => \{([\s\S]*?)\n  \}/)
    expect(selectSectionOptionMatch).not.toBeNull()
    expect(selectSectionOptionMatch![1]).not.toContain("Variante")
  })
})

describe("P2-T56-R2C-F2 — precio/gate autoritativos derivan de la variante seleccionada", () => {
  test("itemTotal usa selectedVariante.precio en vez de product.precioPromo/precio cuando tieneVariantes", () => {
    expect(source).toContain("const basePrice = product.tieneVariantes")
    expect(source).toContain("? (selectedVariante?.precio ?? 0)")
  })

  test("canAdd exige una variante seleccionada y disponible cuando tieneVariantes", () => {
    expect(source).toContain("if (product.tieneVariantes && (!selectedVariante || !isVarianteDisponible(selectedVariante))) return false")
  })

  test("handleAdd nunca agrega sin variante resuelta cuando el producto tiene variantes", () => {
    expect(source).toContain("if (product.tieneVariantes && (!selectedVariante || !isVarianteDisponible(selectedVariante))) return")
  })

  test("el item agregado al carrito lleva varianteId/varianteNombre — precio nunca confiado desde el cliente (viene de selectedVariante, ya resuelto contra la API pública)", () => {
    expect(source).toContain("varianteId: selectedVariante?.id ?? null")
    expect(source).toContain("varianteNombre: selectedVariante?.nombre ?? null")
  })
})

describe("P2-T56-R2C-F2 — auto-selección de variante única solo si está disponible (sección 7)", () => {
  test("no auto-selecciona una variante única agotada", () => {
    expect(source).toContain("const unica = resolveSingleActiveVariant(variantesActivas)")
    expect(source).toContain("return unica && isVarianteDisponible(unica) ? unica.id : null")
  })
})
