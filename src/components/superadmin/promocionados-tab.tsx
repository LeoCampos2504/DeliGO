"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Star,
  Flame,
  ToggleLeft,
  ToggleRight,
  Loader2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Store,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface NegocioActivo {
  id: string
  nombre: string
  slug: string
  rubro: string
  logoUrl: string | null
  colorPrincipal: string
  promocionado: boolean
  ordenPromocion: number
  totalProductos: number
  totalPedidos: number
  puntuacionPromedio: number
  ofreceDelivery: boolean
  whatsapp: string
}

// ============================================
// Promocionados Tab
// ============================================
export function PromocionadosTab() {
  const queryClient = useQueryClient()

  // Fetch platform config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["superadmin-config"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/config")
      if (!res.ok) throw new Error("Error")
      return res.json() as Promise<{ promocionadosActivos: boolean }>
    },
  })

  // Fetch all negocios (with promocionado field) - use todosLosNegocios to include all statuses
  const { data: negociosData, isLoading: negociosLoading } = useQuery({
    queryKey: ["superadmin-negocios-promocionados"],
    queryFn: async () => {
      // Re-use dashboard data which has ALL negocios (including vencido, por_vencer, etc.)
      const res = await fetch("/api/superadmin/dashboard")
      if (!res.ok) throw new Error("Error")
      const data = await res.json()
      return (data.todosLosNegocios ?? []) as NegocioActivo[]
    },
  })

  // Toggle promocionadosActivos
  const toggleMutation = useMutation({
    mutationFn: async (promocionadosActivos: boolean) => {
      const res = await fetch("/api/superadmin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promocionadosActivos }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-config"] })
      toast.success(
        data.promocionadosActivos
          ? "Sección promocionados activada"
          : "Sección promocionados desactivada"
      )
    },
    onError: (error: Error) =>
      toast.error("Error", { description: error.message }),
  })

  // Toggle negocio promocionado
  const promocionarMutation = useMutation({
    mutationFn: async ({
      negocioId,
      promocionado,
      ordenPromocion,
    }: {
      negocioId: string
      promocionado: boolean
      ordenPromocion?: number
    }) => {
      const res = await fetch(`/api/superadmin/negocios/${negocioId}/promocionar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promocionado, ordenPromocion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-negocios-promocionados"] })
      toast.success(
        data.promocionado
          ? `"${data.nombre}" ahora es destacado ⭐`
          : `"${data.nombre}" ya no es destacado`
      )
    },
    onError: (error: Error) =>
      toast.error("Error", { description: error.message }),
  })

  const isLoading = configLoading || negociosLoading

  if (isLoading) return <PromocionadosSkeleton />

  const promocionadosActivos = config?.promocionadosActivos ?? false
  const negocios = negociosData ?? []
  const promocionados = negocios.filter((n) => n.promocionado).sort((a, b) => a.ordenPromocion - b.ordenPromocion)
  const noPromocionados = negocios.filter((n) => !n.promocionado)

  return (
    <div className="space-y-6">
      {/* Header + Toggle */}
      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Flame className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">Locales destacados</h2>
              <p className="text-xs text-muted-foreground">
                Activá la sección para mostrar negocios promocionados en el home
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-xs font-semibold",
              promocionadosActivos ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}>
              {promocionadosActivos ? "Activa" : "Inactiva"}
            </span>
            <Switch
              checked={promocionadosActivos}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
          </div>
        </div>

        {/* Status bar */}
        <div className={cn(
          "mt-3 rounded-xl p-3 flex items-center gap-2 text-xs",
          promocionadosActivos
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-muted/50 text-muted-foreground"
        )}>
          {promocionadosActivos ? (
            <>
              <ToggleRight className="h-4 w-4 shrink-0" />
              La sección de destacados está visible en el home con {promocionados.length} local{promocionados.length !== 1 ? "es" : ""}
            </>
          ) : (
            <>
              <ToggleLeft className="h-4 w-4 shrink-0" />
              La sección está desactivada. Los locales destacados no se muestran en el home.
            </>
          )}
        </div>
      </div>

      {/* Promoted businesses list */}
      {promocionados.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <h3 className="font-bold text-sm">Locales destacados ({promocionados.length})</h3>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {promocionados.map((negocio, index) => (
                <NegocioPromocionadoCard
                  key={negocio.id}
                  negocio={negocio}
                  index={index}
                  totalPromocionados={promocionados.length}
                  onTogglePromocionar={(id, prom) =>
                    promocionarMutation.mutate({
                      negocioId: id,
                      promocionado: prom,
                    })
                  }
                  onMoveOrder={(id, direction) => {
                    const newOrder = direction === "up" ? Math.max(0, index - 1) : index + 1
                    promocionarMutation.mutate({
                      negocioId: id,
                      promocionado: true,
                      ordenPromocion: newOrder,
                    })
                  }}
                  isPending={promocionarMutation.isPending}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Available businesses to promote */}
      {noPromocionados.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-bold text-sm">Disponibles para destacar</h3>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {noPromocionados.map((negocio) => (
                <NegocioDisponibleCard
                  key={negocio.id}
                  negocio={negocio}
                  onPromocionar={(id) =>
                    promocionarMutation.mutate({
                      negocioId: id,
                      promocionado: true,
                      ordenPromocion: promocionados.length,
                    })
                  }
                  isPending={promocionarMutation.isPending}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state */}
      {negocios.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-4">🏪</span>
          <h3 className="font-bold text-lg">Sin negocios activos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Aprobá negocios para poder promocionarlos.
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Negocio Promocionado Card (already promoted)
// ============================================
function NegocioPromocionadoCard({
  negocio,
  index,
  totalPromocionados,
  onTogglePromocionar,
  onMoveOrder,
  isPending,
}: {
  negocio: NegocioActivo
  index: number
  totalPromocionados: number
  onTogglePromocionar: (id: string, promocionado: boolean) => void
  onMoveOrder: (id: string, direction: "up" | "down") => void
  isPending: boolean
}) {
  const rubroEmojis: Record<string, string> = {
    restaurante: "🍔",
    ropa: "👕",
    negocio: "🏪",
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="rounded-2xl bg-card border border-primary/20 p-4"
    >
      <div className="flex items-center gap-3">
        {/* Order indicator + Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => onMoveOrder(negocio.id, "up")}
              disabled={index === 0 || isPending}
              className={cn(
                "p-0.5 rounded hover:bg-muted/50 transition-colors",
                index === 0 ? "opacity-20 cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onMoveOrder(negocio.id, "down")}
              disabled={index === totalPromocionados - 1 || isPending}
              className={cn(
                "p-0.5 rounded hover:bg-muted/50 transition-colors",
                index === totalPromocionados - 1 ? "opacity-20 cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
          <div className="text-center">
            <span className="text-xs font-bold text-primary">#{index + 1}</span>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-border/30"
            style={{
              backgroundColor: negocio.logoUrl ? undefined : `${negocio.colorPrincipal}18`,
            }}
          >
            {negocio.logoUrl ? (
              <img src={negocio.logoUrl} alt={negocio.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold" style={{ color: negocio.colorPrincipal }}>
                {negocio.nombre.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm truncate">{negocio.nombre}</h3>
            <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-bold shrink-0">
              ⭐ Destacado
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rubroEmojis[negocio.rubro] || ""} /{negocio.slug} · {negocio.totalProductos} productos · {negocio.totalPedidos} pedidos
          </p>
          {negocio.puntuacionPromedio > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {negocio.puntuacionPromedio.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Remove button */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/5 border-red-500/20"
            onClick={() => onTogglePromocionar(negocio.id, false)}
            disabled={isPending}
          >
            Quitar
          </Button>
          {negocio.whatsapp && (
            <a
              href={`https://wa.me/${negocio.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-500/5 border-green-500/20"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </Button>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// Negocio Disponible Card (not yet promoted)
// ============================================
function NegocioDisponibleCard({
  negocio,
  onPromocionar,
  isPending,
}: {
  negocio: NegocioActivo
  onPromocionar: (id: string) => void
  isPending: boolean
}) {
  const rubroEmojis: Record<string, string> = {
    restaurante: "🍔",
    ropa: "👕",
    negocio: "🏪",
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="rounded-2xl bg-card border border-border/50 p-4"
    >
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-border/30 shrink-0"
          style={{
            backgroundColor: negocio.logoUrl ? undefined : `${negocio.colorPrincipal}18`,
          }}
        >
          {negocio.logoUrl ? (
            <img src={negocio.logoUrl} alt={negocio.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold" style={{ color: negocio.colorPrincipal }}>
              {negocio.nombre.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate">{negocio.nombre}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rubroEmojis[negocio.rubro] || ""} /{negocio.slug} · {negocio.totalProductos} productos · {negocio.totalPedidos} pedidos
          </p>
        </div>

        {/* Promote button + WhatsApp */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="gap-1.5 rounded-xl h-8 text-xs font-semibold"
            onClick={() => onPromocionar(negocio.id)}
            disabled={isPending}
          >
            <Star className="h-3.5 w-3.5" />
            Destacar
          </Button>
          {negocio.whatsapp && (
            <a
              href={`https://wa.me/${negocio.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-500/5 border-green-500/20"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </Button>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function PromocionadosSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card border border-border/50 p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/50" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted/50" />
              <div className="h-3 w-48 rounded bg-muted/30" />
            </div>
          </div>
          <div className="h-6 w-10 rounded bg-muted/50" />
        </div>
        <div className="mt-3 h-10 rounded-xl bg-muted/30" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border/50 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 rounded bg-muted/50" />
                <div className="h-3 w-48 rounded bg-muted/30" />
              </div>
              <div className="h-8 w-20 rounded-xl bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
