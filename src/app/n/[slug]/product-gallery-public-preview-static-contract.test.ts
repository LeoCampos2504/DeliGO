import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const page = readFileSync(join(process.cwd(), "src/app/n/[slug]/page.tsx"), "utf8")
const gallery = readFileSync(join(process.cwd(), "src/components/client/product-image-gallery.tsx"), "utf8")

describe("PRODUCT-GALLERY-PUBLIC-RENDER-HOTFIX-R1 — public/Preview wiring", () => {
  test("public catalog and business Preview share /n/[slug] and ProductDetailSheet", () => {
    expect(page).toContain('const isBusinessPreview = isPreview && previewSource === "business"')
    expect(page).toContain("<ProductDetailSheet")
    expect(page).toContain("isPreview={isPreview}")
    expect(page).toContain("<ProductImageGallery")
    expect(page).toContain('key={`${product.id}:${product.imagenUrl ?? ""}:${product.imagenesExtra.join("\\u0000")}`}')
  })

  test("the shared detail surface no longer gates gallery rendering on the business rubro", () => {
    expect(page).not.toContain("isRopa && product.imagenesExtra && product.imagenesExtra.length > 0")
    expect(gallery).toContain("buildProductDisplayImages")
    expect(gallery).toContain('aria-label="Imagen siguiente"')
    expect(gallery).toContain('aria-label="Imagen anterior"')
    expect(gallery).toContain("onTouchStart")
  })
})
