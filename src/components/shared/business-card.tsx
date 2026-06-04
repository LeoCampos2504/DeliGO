"use client"

import Link from "next/link"
import { Heart, Star, Clock, Bike } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, formatDistance } from "@/lib/utils"
import { motion } from "framer-motion"

interface BusinessCardProps {
  id: string
  slug: string
  nombre: string
  rubro: string
  logoUrl?: string | null
  bannerUrl?: string | null
  puntuacionPromedio: number
  totalResenas: number
  ofreceDelivery: boolean
  precioDelivery: number
  tiempoEntrega: number
  distancia?: number
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
  isOpen?: boolean
  className?: string
}

export function BusinessCard({
  id,
  slug,
  nombre,
  rubro,
  logoUrl,
  bannerUrl,
  puntuacionPromedio,
  totalResenas,
  ofreceDelivery,
  precioDelivery,
  tiempoEntrega,
  distancia,
  isFavorite,
  onToggleFavorite,
  isOpen = true,
  className,
}: BusinessCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link href={`/n/${slug}`}>
        <Card
          className={cn(
            "overflow-hidden border-border/60 hover:shadow-md transition-shadow cursor-pointer group",
            !isOpen && "opacity-60",
            className
          )}
        >
          {/* Banner image */}
          <div className="relative h-28 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt={`Banner de ${nombre}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl opacity-20">🍽️</span>
              </div>
            )}

            {/* Favorite button */}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleFavorite(id)
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                <Heart
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isFavorite
                      ? "fill-red-500 text-red-500"
                      : "text-muted-foreground"
                  )}
                />
              </button>
            )}

            {/* Closed badge */}
            {!isOpen && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Badge variant="secondary" className="text-xs font-semibold">
                  Cerrado
                </Badge>
              </div>
            )}

            {/* Logo */}
            <div className="absolute -bottom-5 left-3">
              <div className="w-12 h-12 rounded-xl border-2 border-background bg-muted overflow-hidden shadow-sm">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`Logo de ${nombre}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                    {nombre.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <CardContent className="pt-7 pb-3 px-3">
            {/* Name and category */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate">{nombre}</h3>
                <p className="text-xs text-muted-foreground capitalize">{rubro}</p>
              </div>

              {/* Rating */}
              {puntuacionPromedio > 0 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold">
                    {puntuacionPromedio.toFixed(1)}
                  </span>
                  {totalResenas > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ({totalResenas})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Delivery info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {ofreceDelivery && (
                <span className="flex items-center gap-1">
                  <Bike className="h-3 w-3" />
                  {precioDelivery > 0
                    ? formatPrice(precioDelivery)
                    : "Gratis"}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {tiempoEntrega} min
              </span>
              {distancia !== undefined && (
                <span>{formatDistance(distancia)}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
