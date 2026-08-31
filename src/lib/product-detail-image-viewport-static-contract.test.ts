/// <reference types="bun-types" />

// ============================================
// PRODUCT-DETAIL-IMAGE-ASPECT-RATIO-HARDENING — contrato estático
// ============================================
// La imagen del detalle de producto (ProductDetailSheet en n/[slug]/page.tsx)
// ya no puede depender de su relación de aspecto intrínseca para determinar
// la altura del wrapper — la altura la fija un PRODUCT_IMAGE_VIEWPORT
// acotado por viewport (clamp con dvh), y la imagen entra completa vía
// object-contain, nunca se recorta. Este contrato protege esa propiedad sin
// atarse a la cadena Tailwind exacta completa (sólo a los fragmentos que
// importan: ausencia de aspect-ratio fijo + presencia de altura acotada +
// object-contain), y protege por separado el contrato del footer (cantidad
// +/-, botón Agregar, precio) para asegurar que el fix de imagen no lo tocó.

import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()
function read(relPath: string): string {
  return readFileSync(join(ROOT, ...relPath.split("/")), "utf-8").replace(/\r\n/g, "\n")
}

const PAGE_PATH = "src/app/n/[slug]/page.tsx"
const GALLERY_PATH = "src/components/client/product-image-gallery.tsx"

function stripJsxComments(code: string): string {
  return code.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
}

function imageBlock(src: string): string {
  const start = src.indexOf("{/* ===== TOP: Product image ===== */}")
  const end = src.indexOf("{/* ===== BOTTOM: Product options (scrollable) ===== */}")
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return stripJsxComments(src.slice(start, end))
}

describe("PRODUCT_IMAGE_VIEWPORT — altura acotada por viewport, nunca por aspect-ratio intrínseco", () => {
  test("A/C: el wrapper del media ya no usa aspect-[3/4]/aspect-[3/2] — la altura viene de un clamp() con dvh", () => {
    const block = imageBlock(read(PAGE_PATH))
    expect(block).not.toContain("aspect-[3/4]")
    expect(block).not.toContain("aspect-[3/2]")
    // Altura explícita, acotada por viewport (no por el ancho del sheet ni
    // por la relación de aspecto de la imagen cargada).
    expect(block).toMatch(/h-\[clamp\([^)]*dvh[^)]*\)\]/)
  })

  test("B: el componente compartido de galería usa object-contain y nunca recorta la imagen", () => {
    const gallery = read(GALLERY_PATH)
    const imgTags = gallery.match(/<img\b[^>]*>/g) ?? []
    expect(imgTags.length).toBe(1)
    expect(imgTags[0]).toContain("object-contain")
    expect(imgTags[0]).not.toContain("object-cover")
    expect(gallery).toContain("flex items-center justify-center")
  })

  test("las cards de la grilla (ProductCard) NO fueron tocadas — siguen usando su propio aspect-ratio + object-cover", () => {
    const src = read(PAGE_PATH)
    // Card de ropa (grid) y card regular (grid) — fuera del alcance de esta tarea.
    expect(src).toContain("aspect-[3/4] bg-muted/30 overflow-hidden")
    expect(src).toContain("aspect-[4/3] sm:aspect-square bg-muted/30 overflow-hidden")
  })

  test("el badge de descuento sigue dentro del componente visual y recibe el dato del detalle", () => {
    const page = read(PAGE_PATH)
    const gallery = read(GALLERY_PATH)
    expect(page).toContain("discountLabel={product.descuentoLabel}")
    expect(gallery).toContain("discountLabel &&")
    expect(gallery).toContain("absolute top-3 left-3")
  })
})

describe("PRODUCT_DETAIL_FOOTER — contrato de layout intacto (no tocado por el fix de imagen)", () => {
  test("el footer (cantidad -/+, botón Agregar, precio) conserva exactamente su estructura previa", () => {
    const src = read(PAGE_PATH)
    expect(src).toContain('<div className="shrink-0 bg-background/95 backdrop-blur-md border-t border-border p-4">')
    expect(src).toContain('`${isRopa ? "Agregar al carrito" : "Agregar"} · ${formatPrice(itemTotal)}`')
  })

  test("el área de opciones (nombre/precio/agregados/secciones) sigue siendo el único dueño del scroll (flex-1 overflow-y-auto)", () => {
    const src = read(PAGE_PATH)
    expect(src).toContain('<div className="flex-1 overflow-y-auto">')
  })

  test("el media viewport sigue siendo shrink-0 — no compite por espacio con el área scrolleable", () => {
    const block = imageBlock(read(PAGE_PATH))
    expect(block.trimStart().startsWith('<div className="shrink-0">')).toBe(true)
  })
})

describe("PUREZA — infraestructura global no tocada por este fix", () => {
  test("el fix es local a n/[slug]/page.tsx — la primitiva Drawer (drag handle, DrawerContent) no fue modificada", () => {
    const src = read("src/components/ui/drawer.tsx")
    expect(src).toContain('className="mx-auto mt-3 h-1.5 w-12 flex-shrink-0 rounded-full bg-muted"')
    expect(src).toContain("ios-keyboard-bottom fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-2xl border bg-background")
  })
})
