import { describe, expect, test } from "bun:test"
import { parseProductImageList } from "./product-gallery"

describe("PRODUCT-GALLERY-PERSISTENCE-HOTFIX-R1 — editor image normalization", () => {
  test("keeps the ordered array returned by the Product API", () => {
    expect(parseProductImageList(["MAIN?", "/uploads/productos/gallery-a.webp", "/uploads/productos/gallery-b.webp"]))
      .toEqual(["MAIN?", "/uploads/productos/gallery-a.webp", "/uploads/productos/gallery-b.webp"])
  })

  test("supports the persisted JSON-string representation", () => {
    expect(parseProductImageList(JSON.stringify(["/uploads/productos/gallery-a.webp", "/uploads/productos/gallery-b.webp"])))
      .toEqual(["/uploads/productos/gallery-a.webp", "/uploads/productos/gallery-b.webp"])
  })

  test("fails closed for malformed or non-array values", () => {
    expect(parseProductImageList("not-json")).toEqual([])
    expect(parseProductImageList("/uploads/productos/gallery-a.webp")).toEqual([])
    expect(parseProductImageList(null)).toEqual([])
  })
})
