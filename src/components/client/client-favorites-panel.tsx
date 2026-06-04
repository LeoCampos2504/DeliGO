"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import Link from "next/link"
import {
  Heart,
  Star,
  Clock,
  Bike,
  Store,
  ShoppingBag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatPrice, isNegocioOpen } from "@/lib/utils"
import { HorariosPopover } from "@/components/shared/horarios-popover"

// ============================================
// Types
// ============================================
interface NegocioFavorito {
  id: string
  favoritoId: string
  nombre: string
  slug: string
  rubro: string
  logoUrl: string | null
  bannerUrl: string | null
  colorPrincipal: string
  puntuacionPromedio: number
  totalResenas: number
  ofreceDelivery: boolean
  precioDelivery: number
  tiempoEntrega: number
  horarios: string
  horarioMode?: string
  abiertoManual?: boolean
  suspendido: boolean
  aprobado: boolean
  mostrarVentas: boolean
  totalVentas: number
}

// ============================================
// Main Component
// ============================================
export function ClientFavoritesPanel() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-favoritos"],
    queryFn: async () => {
      const res = await fetch("/api/cliente/favoritos")
      if (!res.ok) throw new Error("Error al cargar favoritos")
      const json = await res.json()
      return json.favoritos as NegocioFavorito[]
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (negocioId: string) => {
      const res = await fetch("/api/cliente/favoritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId }),
      })
      if (!res.ok) throw new Error("Error al actualizar favorito")
      return res.json()
    },
    onSuccess: (result, negocioId) => {
      queryClient.invalidateQueries({ queryKey: ["cliente-favoritos"] })
      queryClient.invalidateQueries({ queryKey: ["cliente-perfil"] })
      if (result.action === "removed") {
        toast.success("Eliminado de favoritos")
      } else {
        toast.success("Agregado a favoritos")
      }
    },
    onError: () => {
      toast.error("No se pudo actualizar el favorito")
    },
  })

  const favoritos = data ?? []

  return (
    <div className="flex-1 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Mis Favoritos</h1>
                {!isLoading && (
                  <p className="text-xs text-muted-foreground">
                    {favoritos.length} local{favoritos.length !== 1 ? "es" : ""}
                  </p>
                )}
              </div>
            </div>
            {!isLoading && favoritos.length > 0 && (
              <Badge variant="secondary" className="text-xs font-semibold">
                {favoritos.length}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        {isLoading ? (
          <FavoritesSkeleton />
        ) : favoritos.length === 0 ? (
          <EmptyFavorites />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {favoritos.map((negocio) => (
                <FavoriteCard
                  key={negocio.id}
                  negocio={negocio}
                  onToggle={() => toggleMutation.mutate(negocio.id)}
                  isToggling={toggleMutation.isPending}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Favorite Card
// ============================================
function FavoriteCard({
  negocio,
  onToggle,
  isToggling,
}: {
  negocio: NegocioFavorito
  onToggle: () => void
  isToggling: boolean
}) {
  const isOpen = isNegocioOpen(negocio.horarios, negocio.horarioMode, negocio.abiertoManual)
  const rubroLabel =
    negocio.rubro === "restaurante"
      ? "Restaurante"
      : negocio.rubro === "ropa"
      ? "Indumentaria"
      : negocio.rubro === "negocio"
      ? "Negocio"
      : "Negocio"
  const rubroEmoji =
    negocio.rubro === "restaurante"
      ? "🍽️"
      : negocio.rubro === "ropa"
      ? "👕"
      : negocio.rubro === "negocio"
      ? "🏪"
      : "🏪"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
    >
      <Link href={`/n/${negocio.slug}`} className="block group">
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          {/* Banner */}
          <div
            className="relative h-24 overflow-hidden"
            style={{
              background: negocio.bannerUrl
                ? undefined
                : `linear-gradient(135deg, ${negocio.colorPrincipal}22, ${negocio.colorPrincipal}08)`,
            }}
          >
            {negocio.bannerUrl ? (
              <img
                src={negocio.bannerUrl}
                alt={`Banner de ${negocio.nombre}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl opacity-15">{rubroEmoji}</span>
              </div>
            )}

            {/* Open/Closed/Suspended overlay with hours on tap */}
            {negocio.suspendido ? (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-20">
                <Badge
                  variant="secondary"
                  className="bg-black/60 text-white border-0 text-xs font-bold"
                >
                  Suspendido
                </Badge>
              </div>
            ) : (
              <HorariosPopover
                horarios={negocio.horarios}
                horarioMode={negocio.horarioMode}
                abiertoManual={negocio.abiertoManual}
                variant="overlay"
              />
            )}

            {/* Heart toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute top-2 right-2 h-8 w-8 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors z-10",
                isToggling && "pointer-events-none"
              )}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggle()
              }}
              disabled={isToggling}
            >
              <Heart className="h-4 w-4 text-white fill-rose-500 transition-transform hover:scale-110" />
            </Button>
          </div>

          {/* Logo */}
          <div className="absolute top-[3.5rem] left-3 z-10">
            <div
              className="w-12 h-12 rounded-xl border-[3px] border-background shadow-md overflow-hidden flex items-center justify-center"
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
                  className="text-lg font-extrabold"
                  style={{ color: negocio.colorPrincipal }}
                >
                  {negocio.nombre.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="pt-7 pb-3 px-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate leading-tight">
                  {negocio.nombre}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {rubroLabel}
                </p>
              </div>

              {/* Rating */}
              {negocio.puntuacionPromedio > 0 && (
                <div className="flex items-center gap-1 shrink-0 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    {(negocio.puntuacionPromedio ?? 0).toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Delivery info */}
            <div className="flex items-center gap-3 mt-2">
              {negocio.ofreceDelivery && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Bike className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-foreground">
                    {negocio.precioDelivery > 0
                      ? formatPrice(negocio.precioDelivery)
                      : "Gratis"}
                  </span>
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {negocio.tiempoEntrega} min
              </span>
              {negocio.mostrarVentas && negocio.totalVentas > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShoppingBag className="h-3 w-3" />
                  {negocio.totalVentas}+ ventas
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ============================================
// Empty State
// ============================================
function EmptyFavorites() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-24 h-24 rounded-full bg-rose-500/10 flex items-center justify-center mb-5">
        <Heart className="h-10 w-10 text-rose-300" />
      </div>
      <h3 className="font-bold text-lg">Sin favoritos aún</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[260px]">
        Explorá los locales disponibles y tocá el corazón para guardar tus
        preferidos acá.
      </p>
      <Link href="/">
        <Button
          size="sm"
          className="mt-5 gap-2 rounded-full"
        >
          <Store className="h-4 w-4" />
          Explorar locales
        </Button>
      </Link>
    </motion.div>
  )
}

// ============================================
// Loading Skeleton
// ============================================
function FavoritesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-card border border-border/50 overflow-hidden"
        >
          <Skeleton className="h-24 w-full rounded-none" />
          <div className="px-3 pb-3 pt-7">
            <Skeleton className="h-4 w-3/4 mb-1.5" />
            <Skeleton className="h-3 w-1/3 mb-3" />
            <div className="flex gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
