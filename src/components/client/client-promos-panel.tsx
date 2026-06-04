"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import {
  Tag,
  Search,
  Store,
  Flame,
  ArrowRight,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn, formatPrice } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface Promocion {
  id: string
  nombre: string
  imagenUrl: string | null
  precioOriginal: number
  precioPromo: number
  descuentoLabel: string
  tipoDescuento: string
  valorDescuento: number
  categoria: string
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    logoUrl: string | null
    colorPrincipal: string
  }
}

// ============================================
// Category pills (same as home page)
// ============================================
const categories = [
  { id: "todos", label: "Todos", icon: "📋" },
  { id: "restaurante", label: "Restaurantes", icon: "🍔" },
  { id: "ropa", label: "Ropa", icon: "👕" },
  { id: "negocio", label: "Negocios", icon: "🏪" },
]

// Category emoji fallback for product images
const categoryEmojis: Record<string, string> = {
  hamburguesas: "🍔",
  pizzas: "🍕",
  sushi: "🍣",
  empanadas: "🥟",
  milanesas: "🥩",
  pastas: "🍝",
  ensaladas: "🥗",
  postres: "🍰",
  bebidas: "🥤",
  helados: "🍦",
  ropa: "👕",
  accesorios: "💍",
  tecnologia: "📱",
  default: "🏷️",
}

function getCategoryEmoji(categoria: string): string {
  if (!categoria) return categoryEmojis.default
  const lower = categoria.toLowerCase()
  for (const [key, emoji] of Object.entries(categoryEmojis)) {
    if (lower.includes(key)) return emoji
  }
  return categoryEmojis.default
}

// ============================================
// Main Component
// ============================================
// ============================================
// Delivery zone filtering
// ============================================
interface DeliveryPrecio {
  precioDelivery: number
  zonaNombre?: string
  mode: string
  delivery?: boolean
  reason?: string
}

interface ClientPromosPanelProps {
  deliveryPrecios?: Record<string, DeliveryPrecio>
  hasDeliveryAddress?: boolean
}

export function ClientPromosPanel({ deliveryPrecios, hasDeliveryAddress }: ClientPromosPanelProps = {}) {
  const [activeCategory, setActiveCategory] = useState("todos")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch promociones
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cliente-promociones", activeCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeCategory !== "todos") params.set("rubro", activeCategory)
      const res = await fetch(`/api/cliente/promociones?${params}`)
      if (!res.ok) throw new Error("Error al cargar promociones")
      const json = await res.json()
      return json.promociones as Promocion[]
    },
  })

  // Filter by delivery zone + search
  const promociones = useMemo(() => {
    if (!data) return []
    let filtered = data

    // Filter by delivery zone
    if (hasDeliveryAddress && deliveryPrecios) {
      filtered = filtered.filter((p) => {
        const precio = deliveryPrecios[p.negocio.id]
        // If no delivery zone info, keep visible (business may not offer delivery)
        if (!precio) return true
        // If explicitly outside zones, hide
        if (precio.delivery === false && precio.reason === "outside_zones") return false
        return true
      })
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.negocio.nombre.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [data, searchQuery, deliveryPrecios, hasDeliveryAddress])

  // Stats
  const uniqueNegocios = useMemo(() => {
    const ids = new Set(promociones.map((p) => p.negocio.id))
    return ids.size
  }, [promociones])

  // Group by business (optional)
  const grouped = useMemo(() => {
    const map = new Map<string, Promocion[]>()
    for (const p of promociones) {
      const key = p.negocio.id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return Array.from(map.entries()).map(([negocioId, promos]) => ({
      negocioId,
      negocio: promos[0].negocio,
      promos,
    }))
  }, [promociones])

  if (isLoading) {
    return <PromosSkeleton />
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <span className="text-5xl mb-4">😵</span>
        <h3 className="font-bold text-lg">Error al cargar</h3>
        <p className="text-sm text-muted-foreground mt-1">
          No pudimos obtener las promociones. Intentá de nuevo.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-background">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-4 pt-10 pb-8 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

        <div className="relative max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div>
              <motion.h1
                className="text-xl font-extrabold text-white"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                Promociones
              </motion.h1>
              <motion.p
                className="text-white/70 text-xs mt-0.5"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05 }}
              >
                Las mejores ofertas para vos
              </motion.p>
            </div>
            {promociones.length > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <Badge className="ml-auto bg-white/20 text-white border-0 text-xs font-bold">
                  {promociones.length}
                </Badge>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-4 pb-24">
        {/* Stats bar */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-border/50 shadow-md">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <Flame className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">
                  {promociones.length} producto{promociones.length !== 1 ? "s" : ""} en oferta
                </p>
                <p className="text-xs text-muted-foreground">
                  de {uniqueNegocios} negocio{uniqueNegocios !== 1 ? "s" : ""}
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                🔥 Ofertas
              </Badge>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search bar */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar ofertas o negocios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-muted/50 border-border/50 focus-visible:ring-primary/30 text-sm"
            />
          </div>
        </motion.div>

        {/* Category pills */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content */}
        {promociones.length === 0 ? (
          <EmptyState hasFilters={activeCategory !== "todos" || searchQuery.length > 0} />
        ) : grouped.length <= 2 ? (
          // Flat grid when few businesses
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {promociones.map((promo, i) => (
              <PromoCard key={promo.id} promo={promo} index={i} />
            ))}
          </div>
        ) : (
          // Grouped by business when many
          <div className="space-y-6">
            {grouped.map((group, gi) => (
              <motion.div
                key={group.negocioId}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: gi * 0.05 }}
              >
                {/* Business section header */}
                <Link
                  href={`/n/${group.negocio.slug}`}
                  className="flex items-center gap-2 mb-2 group"
                >
                  <div
                    className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: group.negocio.logoUrl
                        ? undefined
                        : `${group.negocio.colorPrincipal}18`,
                    }}
                  >
                    {group.negocio.logoUrl ? (
                      <img
                        src={group.negocio.logoUrl}
                        alt={group.negocio.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="text-xs font-extrabold"
                        style={{ color: group.negocio.colorPrincipal }}
                      >
                        {group.negocio.nombre.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                    {group.negocio.nombre}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                    {group.promos.length} oferta{group.promos.length > 1 ? "s" : ""}
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.promos.map((promo, pi) => (
                    <PromoCard key={promo.id} promo={promo} index={pi} />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Promo Card
// ============================================
function PromoCard({ promo, index }: { promo: Promocion; index: number }) {
  const discountColor =
    promo.tipoDescuento === "porcentaje"
      ? "bg-red-500 text-white"
      : "bg-orange-500 text-white"

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link href={`/n/${promo.negocio.slug}?productoId=${promo.id}`} className="block group">
        <Card className="border-border/50 shadow-sm overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          {/* Image area */}
          <div className="relative h-36 overflow-hidden bg-muted/30">
            {promo.imagenUrl ? (
              <img
                src={promo.imagenUrl}
                alt={promo.nombre}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${promo.negocio.colorPrincipal}22, ${promo.negocio.colorPrincipal}08)`,
                }}
              >
                <span className="text-5xl opacity-30">
                  {getCategoryEmoji(promo.categoria)}
                </span>
              </div>
            )}

            {/* Discount badge */}
            <div className="absolute top-2 left-2">
              <Badge
                className={cn(
                  "text-[11px] font-extrabold px-2 py-0.5 shadow-lg border-0",
                  discountColor
                )}
              >
                {promo.descuentoLabel}
              </Badge>
            </div>
          </div>

          <CardContent className="p-3 space-y-1.5">
            {/* Product name */}
            <h3 className="text-sm font-bold truncate leading-tight">
              {promo.nombre}
            </h3>

            {/* Business info */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: promo.negocio.logoUrl
                    ? undefined
                    : `${promo.negocio.colorPrincipal}18`,
                }}
              >
                {promo.negocio.logoUrl ? (
                  <img
                    src={promo.negocio.logoUrl}
                    alt={promo.negocio.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="text-[8px] font-extrabold"
                    style={{ color: promo.negocio.colorPrincipal }}
                  >
                    {promo.negocio.nombre.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate flex items-center gap-0.5">
                <Store className="h-3 w-3 shrink-0" />
                {promo.negocio.nombre}
              </span>
            </div>

            <Separator className="opacity-40 !my-1" />

            {/* Prices */}
            <div className="flex items-end gap-2">
              <span className="text-base font-extrabold text-primary">
                {formatPrice(promo.precioPromo)}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(promo.precioOriginal)}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

// ============================================
// Empty State
// ============================================
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{hasFilters ? "🔍" : "🏷️"}</span>
      <h3 className="font-bold text-lg">
        {hasFilters ? "Sin resultados" : "No hay promociones todavía"}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        {hasFilters
          ? "Probá con otro filtro o búsqueda. Las ofertas cambian todo el tiempo."
          : "Los negocios están preparando ofertas imperdibles. Volvé pronto."}
      </p>
    </div>
  )
}

// ============================================
// Loading Skeleton
// ============================================
function PromosSkeleton() {
  return (
    <div className="flex-1 bg-background animate-pulse">
      {/* Header skeleton */}
      <div className="bg-primary/20 px-4 pt-10 pb-8">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10" />
          <div>
            <div className="h-5 w-32 rounded bg-white/10" />
            <div className="mt-1 h-3 w-40 rounded bg-white/5" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-4 pb-24">
        {/* Stats skeleton */}
        <div className="h-16 rounded-xl bg-muted/50 border border-border/30" />

        {/* Search skeleton */}
        <div className="h-11 rounded-xl bg-muted/50 border border-border/30" />

        {/* Pills skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-card border border-border/50 overflow-hidden"
            >
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
