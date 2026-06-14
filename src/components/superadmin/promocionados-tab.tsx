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
  ArrowUp,
  ArrowDown,
  Store,
  RefreshCw,
  Calendar,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
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
  destacadoHasta: string | null
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

  // Fetch all negocios (with promocionado field)
  const { data: negociosData, isLoading: negociosLoading } = useQuery({
    queryKey: ["superadmin-negocios-promocionados"],
    queryFn: async () => {
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
      destacadoHasta,
      periodoDestacado,
    }: {
      negocioId: string
      promocionado: boolean
      ordenPromocion?: number
      destacadoHasta?: string
      periodoDestacado?: number
    }) => {
      const res = await fetch(`/api/superadmin/negocios/${negocioId}/promocionar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promocionado, ordenPromocion, destacadoHasta, periodoDestacado }),
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

  // Count expired destacados
  const ahora = new Date()
  const expirados = promocionados.filter(
    (n) => n.destacadoHasta && new Date(n.destacadoHasta) < ahora
  )
  const vigentes = promocionados.filter(
    (n) => !n.destacadoHasta || new Date(n.destacadoHasta) >= ahora
  )

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
              La sección de destacados está visible en el home con {vigentes.length} local{vigentes.length !== 1 ? "es" : ""} vigente{vigentes.length !== 1 ? "s" : ""}
              {expirados.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  ({expirados.length} vencido{expirados.length !== 1 ? "s" : ""})
                </span>
              )}
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
                  onTogglePromocionar={(id, prom, destacadoHasta, periodoDestacado) =>
                    promocionarMutation.mutate({
                      negocioId: id,
                      promocionado: prom,
                      destacadoHasta,
                      periodoDestacado,
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
                  onPromocionar={(id, destacadoHasta, periodoDestacado) =>
                    promocionarMutation.mutate({
                      negocioId: id,
                      promocionado: true,
                      ordenPromocion: promocionados.length,
                      destacadoHasta,
                      periodoDestacado,
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
// Helper: format remaining time
// ============================================
function formatTiempoRestante(fecha: string): { texto: string; urgente: boolean } {
  const ahora = new Date()
  const vencimiento = new Date(fecha)
  const diffMs = vencimiento.getTime() - ahora.getTime()

  if (diffMs < 0) {
    return { texto: "Vencido", urgente: true }
  }

  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDias <= 3) {
    const diffHoras = Math.ceil(diffMs / (1000 * 60 * 60))
    if (diffHoras <= 24) {
      return { texto: `${diffHoras}h restantes`, urgente: true }
    }
    return { texto: `${diffDias}d restantes`, urgente: true }
  }
  if (diffDias <= 7) {
    return { texto: `${diffDias}d restantes`, urgente: false }
  }
  return { texto: vencimiento.toLocaleDateString("es-AR", { day: "numeric", month: "short" }), urgente: false }
}

// ============================================
// Renovar Destacado Dialog
// ============================================
function RenovarDestacadoDialog({
  negocioId,
  negocioNombre,
  destacadoHasta,
  onRenovar,
  isPending,
}: {
  negocioId: string
  negocioNombre: string
  destacadoHasta: string | null
  onRenovar: (id: string, destacadoHasta?: string, periodoDestacado?: number) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [periodo, setPeriodo] = useState(30)
  const [customDate, setCustomDate] = useState("")

  const quickPeriods = [
    { dias: 7, label: "7 días" },
    { dias: 15, label: "15 días" },
    { dias: 30, label: "30 días" },
    { dias: 90, label: "90 días" },
    { dias: 365, label: "1 año" },
  ]

  const handleRenovar = () => {
    if (customDate) {
      onRenovar(negocioId, customDate, undefined)
    } else {
      onRenovar(negocioId, undefined, periodo)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5 rounded-xl h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5 border-emerald-500/20">
          <RefreshCw className="h-3 w-3" />
          Renovar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            Renovar destacado de {negocioNombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current expiry */}
          {destacadoHasta && (
            <div className="rounded-xl bg-muted/50 p-3 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Vence actualmente: <span className="font-semibold text-foreground">
                  {new Date(destacadoHasta).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>
          )}

          {/* Quick periods */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Período</label>
            <div className="grid grid-cols-3 gap-2">
              {quickPeriods.map((p) => (
                <button
                  key={p.dias}
                  onClick={() => {
                    setPeriodo(p.dias)
                    setCustomDate("")
                  }}
                  className={cn(
                    "rounded-xl py-2 text-xs font-semibold transition-colors border",
                    periodo === p.dias && !customDate
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">O fecha personalizada</label>
            <Input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value)
                if (e.target.value) setPeriodo(0)
              }}
              className="rounded-xl"
            />
          </div>

          <Button
            className="w-full gap-2 rounded-xl font-semibold"
            onClick={handleRenovar}
            disabled={isPending || (!customDate && periodo === 0)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Renovar destacado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  onTogglePromocionar: (id: string, promocionado: boolean, destacadoHasta?: string, periodoDestacado?: number) => void
  onMoveOrder: (id: string, direction: "up" | "down") => void
  isPending: boolean
}) {
  const rubroEmojis: Record<string, string> = {
    restaurante: "🍔",
    ropa: "👕",
    negocio: "🏪",
  }

  const ahora = new Date()
  const estaExpirado = negocio.destacadoHasta && new Date(negocio.destacadoHasta) < ahora
  const tiempoRestante = negocio.destacadoHasta ? formatTiempoRestante(negocio.destacadoHasta) : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={cn(
        "rounded-2xl bg-card border p-4",
        estaExpirado ? "border-amber-500/30 bg-amber-500/5" : "border-primary/20"
      )}
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
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm truncate">{negocio.nombre}</h3>
            {estaExpirado ? (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0 text-[10px] font-bold shrink-0">
                ⚠️ Vencido
              </Badge>
            ) : (
              <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-bold shrink-0">
                ⭐ Destacado
              </Badge>
            )}
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

          {/* Expiry info */}
          {negocio.destacadoHasta && (
            <div className={cn(
              "flex items-center gap-1.5 mt-1.5 text-xs",
              tiempoRestante?.urgente ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            )}>
              <Clock className="h-3 w-3" />
              <span className={tiempoRestante?.urgente ? "font-semibold" : ""}>
                {tiempoRestante?.texto}
              </span>
            </div>
          )}
          {!negocio.destacadoHasta && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Sin fecha de vencimiento
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <RenovarDestacadoDialog
            negocioId={negocio.id}
            negocioNombre={negocio.nombre}
            destacadoHasta={negocio.destacadoHasta}
            onRenovar={onTogglePromocionar}
            isPending={isPending}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl h-7 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-500/5 border-red-500/20"
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
                className="h-7 w-7 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-500/5 border-green-500/20"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
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
// Destacar Dialog (for available businesses)
// ============================================
function DestacarDialog({
  negocioId,
  negocioNombre,
  onDestacar,
  isPending,
}: {
  negocioId: string
  negocioNombre: string
  onDestacar: (id: string, destacadoHasta?: string, periodoDestacado?: number) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [periodo, setPeriodo] = useState(30)
  const [customDate, setCustomDate] = useState("")

  const quickPeriods = [
    { dias: 7, label: "7 días" },
    { dias: 15, label: "15 días" },
    { dias: 30, label: "30 días" },
    { dias: 90, label: "90 días" },
    { dias: 365, label: "1 año" },
  ]

  const handleDestacar = () => {
    if (customDate) {
      onDestacar(negocioId, customDate, undefined)
    } else {
      onDestacar(negocioId, undefined, periodo)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 rounded-xl h-8 text-xs font-semibold"
          disabled={isPending}
        >
          <Star className="h-3.5 w-3.5" />
          Destacar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            Destacar {negocioNombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick periods */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">¿Hasta cuándo?</label>
            <div className="grid grid-cols-3 gap-2">
              {quickPeriods.map((p) => (
                <button
                  key={p.dias}
                  onClick={() => {
                    setPeriodo(p.dias)
                    setCustomDate("")
                  }}
                  className={cn(
                    "rounded-xl py-2 text-xs font-semibold transition-colors border",
                    periodo === p.dias && !customDate
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">O fecha personalizada</label>
            <Input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value)
                if (e.target.value) setPeriodo(0)
              }}
              className="rounded-xl"
            />
          </div>

          <Button
            className="w-full gap-2 rounded-xl font-semibold"
            onClick={handleDestacar}
            disabled={isPending || (!customDate && periodo === 0)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            Destacar negocio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  onPromocionar: (id: string, destacadoHasta?: string, periodoDestacado?: number) => void
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
          <DestacarDialog
            negocioId={negocio.id}
            negocioNombre={negocio.nombre}
            onDestacar={onPromocionar}
            isPending={isPending}
          />
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
