import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const productsTab = readFileSync(join(process.cwd(), "src/components/business/products-tab.tsx"), "utf8")
const imageUpload = readFileSync(join(process.cwd(), "src/components/shared/image-upload.tsx"), "utf8")

describe("PRODUCT-GALLERY-PERSISTENCE-HOTFIX-R1 — UI contract", () => {
  test("keeps main image and gallery as separate controlled fields", () => {
    expect(productsTab).toContain('value={formData.imagenUrl || null}')
    expect(productsTab).toContain('value={formData.imagenesExtra}')
    expect(productsTab).toContain('onChange={(urls) => setFormData((p) => ({ ...p, imagenesExtra: urls }))}')
    expect(productsTab).toContain('imagenesExtra: data.imagenesExtra')
  })

  test("rehydrates API arrays without applying JSON.parse to an array", () => {
    expect(productsTab).toContain('imagenesExtra: parseProductImageList(product.imagenesExtra)')
    expect(productsTab).not.toContain('JSON.parse(product.imagenesExtra || "[]")')
  })

  test("does not label the first additional image as Principal", () => {
    expect(imageUpload).not.toContain("Primary badge")
    expect(imageUpload).not.toMatch(/\bPrincipal\b/)
    expect(imageUpload).toContain("Multi-Image Upload (for product gallery)")
  })
})
