import { afterAll, afterEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { ProductImageGallery, buildProductDisplayImages } = await import("./product-image-gallery")
const { act } = React

let cleanup: (() => void) | null = null

function renderGallery(mainImage: string | null, extraImages: unknown) {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)

  act(() => {
    root.render(React.createElement(ProductImageGallery, {
      mainImage,
      extraImages,
      alt: "Producto de prueba",
      placeholder: "🍽️",
    }))
  })

  cleanup = () => {
    act(() => root.unmount())
    host.remove()
  }
  return host
}

function visibleImage(host: HTMLElement): string | null {
  return host.querySelector('[data-testid="product-gallery-image"]')?.getAttribute("src") ?? null
}

function click(host: HTMLElement, label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) throw new Error(`Missing gallery control: ${label}`)
  act(() => button.click())
}

afterEach(() => {
  cleanup?.()
  cleanup = null
})

describe("PRODUCT-GALLERY-PUBLIC-RENDER-HOTFIX-R1 — visible image gallery", () => {
  test("PRODUCT_GALLERY_PUBLIC_VISIBLE_RENDER_REPRO: MAIN=A and EXTRA=[B,C,D] are visibly navigable in order", () => {
    const host = renderGallery("A", ["B", "C", "D"])

    expect(visibleImage(host)).toBe("A")
    expect(host.querySelector('[aria-label="Imagen siguiente"]')).not.toBeNull()
    expect(host.querySelector('[aria-label="Imagen anterior"]')).not.toBeNull()

    click(host, "Imagen siguiente")
    expect(visibleImage(host)).toBe("B")
    click(host, "Imagen siguiente")
    expect(visibleImage(host)).toBe("C")
    click(host, "Imagen siguiente")
    expect(visibleImage(host)).toBe("D")
    click(host, "Imagen anterior")
    expect(visibleImage(host)).toBe("C")
  })

  test("PRODUCT_GALLERY_PREVIEW_VISIBLE_RENDER_REPRO: Preview uses the same shared visible component contract", () => {
    const host = renderGallery("A", ["B", "C", "D"])

    expect(host.querySelector('[data-testid="product-image-gallery"]')).not.toBeNull()
    click(host, "Imagen siguiente")
    expect(visibleImage(host)).toBe("B")
    click(host, "Imagen siguiente")
    click(host, "Imagen siguiente")
    expect(visibleImage(host)).toBe("D")
  })

  test("PRODUCT_GALLERY_NAVIGATION_CONTROLS_REPRO: controls change the current image and respect boundaries", () => {
    const host = renderGallery("A", ["B"])
    const previous = host.querySelector<HTMLButtonElement>('[aria-label="Imagen anterior"]')
    const next = host.querySelector<HTMLButtonElement>('[aria-label="Imagen siguiente"]')

    expect(previous?.disabled).toBe(true)
    expect(next?.disabled).toBe(false)
    click(host, "Imagen siguiente")
    expect(visibleImage(host)).toBe("B")
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Imagen anterior"]')?.disabled).toBe(false)
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Imagen siguiente"]')?.disabled).toBe(true)
  })

  test("deduplicates a legacy main image repeated in extras without mutating the source data", () => {
    const extras = ["A", "B", "C"]
    expect(buildProductDisplayImages("A", extras)).toEqual(["A", "B", "C"])
    expect(extras).toEqual(["A", "B", "C"])
  })

  test("keeps products without a main image safe and navigable", () => {
    const host = renderGallery(null, ["B", "C"])
    expect(visibleImage(host)).toBe("B")
    click(host, "Imagen siguiente")
    expect(visibleImage(host)).toBe("C")
  })

  test("supports mobile swipe while keeping visible button fallback", () => {
    const host = renderGallery("A", ["B"])
    const gallery = host.querySelector<HTMLElement>('[data-testid="product-image-gallery"]')
    if (!gallery) throw new Error("Missing gallery root")

    const touch = (type: "touchstart" | "touchend", clientX: number) => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperty(event, "changedTouches", {
        configurable: true,
        value: [{ clientX }],
      })
      act(() => gallery.dispatchEvent(event))
    }

    touch("touchstart", 240)
    touch("touchend", 160)
    expect(visibleImage(host)).toBe("B")
    expect(host.querySelector('[aria-label="Imagen anterior"]')).not.toBeNull()
  })

  test("keeps the single-image experience unchanged without useless controls", () => {
    const host = renderGallery("A", [])
    expect(visibleImage(host)).toBe("A")
    expect(host.querySelector('[data-testid="product-gallery-image"]')?.getAttribute("data-gallery-image-index")).toBe("0")
    expect(host.querySelector('[aria-label="Imagen siguiente"]')).toBeNull()
    expect(host.querySelector('[aria-label="Imagen anterior"]')).toBeNull()
  })
})
