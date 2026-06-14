"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import Autoplay from "embla-carousel-autoplay"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Badge } from "@/components/ui/badge"
import { Star, Bike, Clock, Flame, ChevronRight, ShoppingCart, Sparkles, Store } from "lucide-react"
import { formatPrice, isNegocioOpen } from "@/lib/utils"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface ProductoItem {
  id: string
  nombre: string
  precio: number
  imagenUrl: string | null
  descuentoActivo: boolean
  valorDescuento: number
  tipoDescuento: "porcentaje" | "fijo"
  categoria?: string
  totalPedidos?: number
}

interface NegocioPromocionado {
  id: string
  slug: string
  nombre: string
  logoUrl: string | null
  bannerUrl: string | null
  colorPrincipal: string
  rubro: string
  ofreceDelivery: boolean
  precioDelivery: number
  tiempoEntrega: number
  puntuacionPromedio: number
  totalResenas: number
  horarios: string
  horarioMode?: string
  abiertoManual?: boolean
  categorias: string
  zonaDeliveryActiva?: boolean
  productosTop: ProductoItem[]
  productosGenerales: ProductoItem[]
  totalProductos: number
}

interface DeliveryPrecio {
  precioDelivery: number
  zonaNombre?: string
  mode: string
  delivery?: boolean
  reason?: string
}

interface PromocionadosResponse {
  activo: boolean
  negocios: NegocioPromocionado[]
}

// ============================================
// Helpers
// ============================================
function getRubroEmoji(rubro: string): string {
  const map: Record<string, string> = {
    restaurante: "🍔",
    ropa: "👕",
    negocio: "🏪",
  }
  return map[rubro] || "🏪"
}

function getRubroLabel(rubro: string): string {
  const map: Record<string, string> = {
    restaurante: "Restaurante",
    ropa: "Indumentaria",
    negocio: "Negocio",
  }
  return map[rubro] || "Negocio"
}

function getDiscountedPrice(
  precio: number,
  valorDescuento: number,
  tipoDescuento: "porcentaje" | "fijo"
): number {
  if (tipoDescuento === "porcentaje") {
    return precio * (1 - valorDescuento / 100)
  }
  return Math.max(0, precio - valorDescuento)
}

// ============================================
// Main Component
// ============================================
interface PromotedBusinessesSectionProps {
  deliveryPrecios?: Record<string, DeliveryPrecio>
  hasDeliveryAddress?: boolean
}

export function PromotedBusinessesSection({
  deliveryPrecios,
  hasDeliveryAddress,
}: PromotedBusinessesSectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [api, setApi] = useState<CarouselApi | null>(null)
  const [current, setCurrent] = useState(0)
  const autoplayRef = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true, stopOnMouseEnter: true })
  )

  const { data, isLoading } = useQuery<PromocionadosResponse>({
    queryKey: ["negocios-promocionados"],
    queryFn: async () => {
      const res = await fetch("/api/negocios/promocionados")
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    staleTime: 1000 * 60 * 5,
  })

  // Compute outside-zone status for promoted businesses
  const negocioOutsideZone = useMemo(() => {
    const map: Record<string, boolean> = {}
    if (!hasDeliveryAddress || !deliveryPrecios) return map
    for (const negocio of (data?.negocios ?? [])) {
      if (negocio.zonaDeliveryActiva && deliveryPrecios[negocio.id]) {
        const precioInfo = deliveryPrecios[negocio.id]
        map[negocio.id] = precioInfo.delivery === false && precioInfo.reason === "outside_zones"
      } else {
        map[negocio.id] = false
      }
    }
    return map
  }, [data, hasDeliveryAddress, deliveryPrecios])

  // Show all promoted businesses (out-of-zone ones show as pickup-only)
  const filteredNegocios = useMemo(() => {
    if (!data?.activo || !data.negocios.length) return []
    return data.negocios
  }, [data])

  // Entrance animation
  useEffect(() => {
    if (data?.activo && filteredNegocios.length > 0) {
      const timer = setTimeout(() => setIsVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [data, filteredNegocios.length])

  // Track current slide
  const onSelect = useCallback(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
  }, [api])

  useEffect(() => {
    if (!api) return
    api.on("select", onSelect)
    return () => {
      api?.off("select", onSelect)
    }
  }, [api, onSelect])

  // Don't render if feature is off or no businesses
  if (isLoading) return <PromotedBusinessesSkeleton />
  if (!data || data.activo === false || filteredNegocios.length === 0) return null

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-bold text-base">Locales destacados</h2>
        </div>
        {/* Dots indicator */}
        {filteredNegocios.length > 1 && (
          <div className="flex items-center gap-1.5">
            {filteredNegocios.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === current
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-muted-foreground/25"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full-width carousel with autoplay */}
      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          slidesToScroll: 1,
          loop: filteredNegocios.length > 1,
        }}
        plugins={[autoplayRef.current]}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {filteredNegocios.map((negocio) => (
            <CarouselItem key={negocio.id} className="pl-0 basis-full">
              <NegocioFullSlide
                negocio={negocio}
                deliveryPrecio={deliveryPrecios?.[negocio.id]}
                hasDeliveryAddress={hasDeliveryAddress}
                isOutsideZone={!!negocioOutsideZone[negocio.id]}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {filteredNegocios.length > 1 && (
          <>
            <CarouselPrevious className="-left-2 top-1/2 -translate-y-1/2 h-9 w-9 border-primary/20 bg-background/95 hover:bg-background shadow-md z-20" />
            <CarouselNext className="-right-2 top-1/2 -translate-y-1/2 h-9 w-9 border-primary/20 bg-background/95 hover:bg-background shadow-md z-20" />
          </>
        )}
      </Carousel>
    </div>
  )
}

// ============================================
// Full-width Business Slide
// ============================================
function NegocioFullSlide({
  negocio,
  deliveryPrecio,
  hasDeliveryAddress,
  isOutsideZone,
}: {
  negocio: NegocioPromocionado
  deliveryPrecio?: DeliveryPrecio
  hasDeliveryAddress?: boolean
  isOutsideZone?: boolean
}) {
  const isOpen = isNegocioOpen(negocio.horarios, negocio.horarioMode, negocio.abiertoManual)
  const rubroEmoji = getRubroEmoji(negocio.rubro)
  const rubroLabel = getRubroLabel(negocio.rubro)
  const allProducts = [...negocio.productosTop, ...negocio.productosGenerales]
  const hasProducts = allProducts.length > 0

  // Delivery price logic
  const deliveryLabel = getDeliveryLabel(negocio, deliveryPrecio, hasDeliveryAddress)

  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      {/* ===== Header: Banner + Business Info ===== */}
      <div className="relative">
        {/* Banner background */}
        <div
          className="h-24 sm:h-28 relative overflow-hidden"
          style={{
            background: negocio.bannerUrl
              ? undefined
              : `linear-gradient(135deg, ${negocio.colorPrincipal}30, ${negocio.colorPrincipal}10)`,
          }}
        >
          {negocio.bannerUrl ? (
            <img
              src={negocio.bannerUrl}
              alt={`Banner de ${negocio.nombre}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl opacity-10">{rubroEmoji}</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card/80" />
        </div>

        {/* Business info overlay */}
        <div className="px-4 pb-3 -mt-10 relative z-10">
          <div className="flex items-end gap-3">
            {/* Logo */}
            <Link href={`/n/${negocio.slug}`} className="shrink-0 group/logo">
              <div
                className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl border-[3px] border-background shadow-lg overflow-hidden flex items-center justify-center transition-transform group-hover/logo:scale-105"
                style={{
                  backgroundColor: negocio.logoUrl
                    ? undefined
                    : `${negocio.colorPrincipal}18`,
                }}
              >
                {negocio.logoUrl ? (
                  <img
                    src={negocio.logoUrl}
                    alt={`Logo de ${negocio.nombre}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="text-2xl font-extrabold"
                    style={{ color: negocio.colorPrincipal }}
                  >
                    {negocio.nombre.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </Link>

            {/* Name + Info */}
            <div className="flex-1 min-w-0 pb-1">
              <Link href={`/n/${negocio.slug}`} className="group/name">
                <h3 className="font-bold text-base sm:text-lg truncate group-hover/name:text-primary transition-colors leading-tight">
                  {negocio.nombre}
                  <ChevronRight className="inline h-4 w-4 ml-0.5 opacity-0 -translate-x-1 group-hover/name:opacity-60 group-hover/name:translate-x-0 transition-all" />
                </h3>
              </Link>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {/* Rubro */}
                <span className="text-xs text-muted-foreground">
                  {rubroEmoji} {rubroLabel}
                </span>
                {/* Open/Closed */}
                <span className="flex items-center gap-1">
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isOpen ? "bg-emerald-500" : "bg-red-400"
                    )}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {isOpen ? "Abierto" : "Cerrado"}
                  </span>
                </span>
                {/* Rating */}
                {negocio.puntuacionPromedio > 0 && (
                  <span className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0 rounded-md">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      {negocio.puntuacionPromedio.toFixed(1)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Delivery info - right aligned */}
            <div className="flex flex-col items-end gap-1 pb-1 shrink-0">
              {negocio.ofreceDelivery && !isOutsideZone && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Bike className="h-3.5 w-3.5 text-primary" />
                  <span className={cn(
                    "font-semibold",
                    negocio.zonaDeliveryActiva ? "text-primary" : "text-foreground"
                  )}>
                    {deliveryLabel}
                  </span>
                </span>
              )}
              {isOutsideZone && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Store className="h-3.5 w-3.5" />
                  <span className="font-semibold">Solo retiro</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {negocio.tiempoEntrega} min
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Products Section ===== */}
      {hasProducts && (
        <div className="px-4 pb-4">
          {/* Top products */}
          {negocio.productosTop.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                  Más vendidos
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {negocio.productosTop.map((producto) => (
                  <ProductCard
                    key={producto.id}
                    producto={producto}
                    negocioSlug={negocio.slug}
                    rubroEmoji={rubroEmoji}
                    colorPrincipal={negocio.colorPrincipal}
                    isTop
                  />
                ))}
              </div>
            </div>
          )}

          {/* General products */}
          {negocio.productosGenerales.length > 0 && (
            <div className={cn(negocio.productosTop.length > 0 && "mt-4")}>
              <div className="flex items-center gap-1.5 mb-2">
                <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Productos
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {negocio.productosGenerales.map((producto) => (
                  <ProductCard
                    key={producto.id}
                    producto={producto}
                    negocioSlug={negocio.slug}
                    rubroEmoji={rubroEmoji}
                    colorPrincipal={negocio.colorPrincipal}
                  />
                ))}
              </div>
            </div>
          )}

          {/* "Ver menú completo" CTA */}
          <Link
            href={`/n/${negocio.slug}`}
            className="mt-3 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary text-sm font-semibold transition-colors group/cta"
          >
            Ver menú completo
            <ChevronRight className="h-4 w-4 group-hover/cta:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}

      {/* No products state */}
      {!hasProducts && (
        <div className="px-4 pb-4">
          <Link
            href={`/n/${negocio.slug}`}
            className="mt-2 flex items-center justify-center gap-1.5 w-full py-3 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary text-sm font-semibold transition-colors group/cta"
          >
            Visitar {negocio.nombre}
            <ChevronRight className="h-4 w-4 group-hover/cta:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ============================================
// Delivery label helper
// ============================================
function getDeliveryLabel(
  negocio: NegocioPromocionado,
  deliveryPrecio?: DeliveryPrecio,
  hasDeliveryAddress?: boolean
): string {
  // Non-zone businesses: simple price
  if (!negocio.zonaDeliveryActiva) {
    return negocio.precioDelivery > 0
      ? formatPrice(negocio.precioDelivery)
      : "Gratis"
  }

  // Zone businesses without user address: show "Por zona"
  if (!hasDeliveryAddress || !deliveryPrecio) {
    return "Por zona"
  }

  // Zone businesses with calculated price
  if (deliveryPrecio.delivery === false) {
    return "Fuera de zona"
  }

  return deliveryPrecio.precioDelivery > 0
    ? formatPrice(deliveryPrecio.precioDelivery)
    : "Gratis"
}

// ============================================
// Product Card
// ============================================
function ProductCard({
  producto,
  negocioSlug,
  rubroEmoji,
  colorPrincipal,
  isTop = false,
}: {
  producto: ProductoItem
  negocioSlug: string
  rubroEmoji: string
  colorPrincipal: string
  isTop?: boolean
}) {
  const hasDiscount = producto.descuentoActivo && producto.valorDescuento > 0
  const discountedPrice = hasDiscount
    ? getDiscountedPrice(
        producto.precio,
        producto.valorDescuento,
        producto.tipoDescuento
      )
    : null

  return (
    <Link
      href={`/n/${negocioSlug}`}
      className="group/product"
    >
      <div className={cn(
        "rounded-xl overflow-hidden border hover:shadow-sm transition-all duration-200",
        isTop
          ? "bg-orange-50/50 dark:bg-orange-950/10 border-orange-200/50 dark:border-orange-900/30 hover:border-orange-300 dark:hover:border-orange-800/50"
          : "bg-muted/20 border-border/30 hover:border-primary/20"
      )}>
        {/* Image */}
        <div
          className="aspect-square w-full overflow-hidden relative"
          style={{
            backgroundColor: producto.imagenUrl
              ? undefined
              : `${colorPrincipal}10`,
          }}
        >
          {producto.imagenUrl ? (
            <img
              src={producto.imagenUrl}
              alt={producto.nombre}
              className="w-full h-full object-cover group-hover/product:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl opacity-40">{rubroEmoji}</span>
            </div>
          )}

          {/* Top seller badge */}
          {isTop && producto.totalPedidos && producto.totalPedidos > 0 && (
            <Badge className="absolute bottom-1 left-1 bg-orange-500 text-white border-0 text-[9px] font-bold px-1.5 py-0 h-4 hover:bg-orange-500 gap-0.5">
              <Flame className="h-2.5 w-2.5" />
              {producto.totalPedidos}
            </Badge>
          )}

          {/* Discount badge */}
          {hasDiscount && (
            <Badge className="absolute top-1 right-1 bg-red-500 text-white border-0 text-[9px] font-bold px-1.5 py-0 h-4 hover:bg-red-500">
              -{producto.tipoDescuento === "porcentaje"
                ? `${producto.valorDescuento}%`
                : formatPrice(producto.valorDescuento)}
            </Badge>
          )}
        </div>

        {/* Info */}
        <div className="p-1.5">
          <p className="text-[11px] font-semibold truncate leading-tight">
            {producto.nombre}
          </p>
          <div className="mt-0.5">
            {hasDiscount && discountedPrice !== null ? (
              <div className="flex flex-col">
                <span className="text-[9px] text-muted-foreground line-through leading-tight">
                  {formatPrice(producto.precio)}
                </span>
                <span className="text-[11px] font-bold text-red-500 leading-tight">
                  {formatPrice(discountedPrice)}
                </span>
              </div>
            ) : (
              <span className="text-[11px] font-bold leading-tight">
                {formatPrice(producto.precio)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ============================================
// Skeleton
// ============================================
function PromotedBusinessesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 animate-pulse" />
          <div className="h-5 w-36 rounded bg-muted/50 animate-pulse" />
        </div>
        <div className="flex gap-1.5">
          <div className="w-5 h-1.5 rounded-full bg-muted/50 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted/30 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted/30 animate-pulse" />
        </div>
      </div>
      <div className="rounded-2xl bg-card border border-border/50 overflow-hidden animate-pulse">
        {/* Banner skeleton */}
        <div className="h-24 bg-muted/30" />
        {/* Info skeleton */}
        <div className="px-4 pb-3 -mt-8 flex items-end gap-3">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 border-2 border-background shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 rounded bg-muted/50" />
            <div className="h-3 w-20 rounded bg-muted/30" />
          </div>
        </div>
        {/* Products skeleton */}
        <div className="px-4 pb-4 space-y-3">
          <div className="h-3 w-24 rounded bg-muted/30" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/20 border border-border/10 overflow-hidden">
                <div className="aspect-square bg-muted/30" />
                <div className="p-1.5 space-y-1">
                  <div className="h-3 w-14 rounded bg-muted/30" />
                  <div className="h-3 w-8 rounded bg-muted/20" />
                </div>
              </div>
            ))}
          </div>
          <div className="h-10 w-full rounded-xl bg-muted/20" />
        </div>
      </div>
    </div>
  )
}
