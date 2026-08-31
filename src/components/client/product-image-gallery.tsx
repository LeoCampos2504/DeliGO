"use client"

import { useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export function buildProductDisplayImages(mainImage: string | null | undefined, extraImages: unknown): string[] {
  const candidates = [mainImage, ...(Array.isArray(extraImages) ? extraImages : [])]
  const seen = new Set<string>()

  return candidates.filter((image): image is string => {
    if (typeof image !== "string" || image.trim() === "" || seen.has(image)) return false
    seen.add(image)
    return true
  })
}

interface ProductImageGalleryProps {
  mainImage: string | null | undefined
  extraImages: unknown
  alt: string
  placeholder: string
  discountLabel?: string | null
  className?: string
}

export function ProductImageGallery({
  mainImage,
  extraImages,
  alt,
  placeholder,
  discountLabel,
  className,
}: ProductImageGalleryProps) {
  const displayImages = useMemo(
    () => buildProductDisplayImages(mainImage, extraImages),
    [mainImage, extraImages]
  )
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const safeIndex = displayImages.length > 0
    ? Math.min(currentImageIndex, displayImages.length - 1)
    : 0
  const hasNavigation = displayImages.length > 1

  const goToImage = (index: number) => {
    if (displayImages.length === 0) return
    setCurrentImageIndex(Math.max(0, Math.min(index, displayImages.length - 1)))
  }

  const goToPrevious = () => goToImage(safeIndex - 1)
  const goToNext = () => goToImage(safeIndex + 1)

  return (
    <div
      className={cn("relative bg-muted/30 w-full h-full overflow-hidden", className)}
      data-testid="product-image-gallery"
      onTouchStart={(event) => {
        if (hasNavigation) touchStartX.current = event.changedTouches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current
        touchStartX.current = null
        if (startX === null || !hasNavigation) return
        const endX = event.changedTouches[0]?.clientX
        if (endX === undefined) return
        const deltaX = endX - startX
        if (deltaX > 40) goToPrevious()
        if (deltaX < -40) goToNext()
      }}
    >
      {displayImages.length > 0 ? (
        <img
          src={displayImages[safeIndex]}
          alt={alt}
          className="w-full h-full object-contain object-center"
          data-testid="product-gallery-image"
          data-gallery-image-index={safeIndex}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          data-testid="product-gallery-placeholder"
        >
          <span className="text-6xl opacity-20">{placeholder}</span>
        </div>
      )}

      {discountLabel && (
        <span className="absolute top-3 left-3 rounded-md bg-red-500 px-3 py-1 text-sm font-bold text-white shadow-lg">
          {discountLabel}
        </span>
      )}

      {hasNavigation && (
        <>
          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={goToPrevious}
            disabled={safeIndex === 0}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl leading-none text-white shadow-md transition-opacity hover:bg-black/70 disabled:cursor-default disabled:opacity-35"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Imagen siguiente"
            onClick={goToNext}
            disabled={safeIndex === displayImages.length - 1}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl leading-none text-white shadow-md transition-opacity hover:bg-black/70 disabled:cursor-default disabled:opacity-35"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white">
            <span aria-live="polite">{safeIndex + 1}/{displayImages.length}</span>
            <div className="flex gap-1" aria-label="Seleccionar imagen">
              {displayImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  aria-label={`Ver imagen ${index + 1}`}
                  aria-current={index === safeIndex ? "true" : undefined}
                  onClick={() => goToImage(index)}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    index === safeIndex ? "w-5 bg-white" : "bg-white/55 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
