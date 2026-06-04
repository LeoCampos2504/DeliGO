"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Store,
  Calendar,
  Package,
  ShoppingCart,
  Ban,
  Eye,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useSuperAdminStore } from "@/store/superadmin-store"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"

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
  planTipo: string
  planVencimiento: string | null
  deudaTarifa: number
  limiteDeudaCalculado: number
  porcentajeDeuda: number
  ofreceDelivery: boolean
  createdAt: string
  totalProductos: number
  totalPedidos: number
  diasRestantes: number | null
  estadoSuscripcion: string
  whatsapp: string
}

interface ActivosTabProps {
  negocios: NegocioActivo[]
  isLoading: boolean
}

const planLabels: Record<string, string> = {
  prueba: "Prueba",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  vitalicio: "Vitalicio",
}

// ============================================
// Activos Tab
// ============================================
export function ActivosTab({ negocios, isLoading }: ActivosTabProps) {
  if (isLoading) return <ActivosSkeleton />

  if (negocios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl mb-4">🏪</span>
        <h3 className="font-bold text-lg">Sin negocios activos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Aprobá negocios pendientes para que aparezcan acá.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-lg">Negocios activos</h2>
        <p className="text-sm text-muted-foreground">
          {negocios.length} negocio{negocios.length !== 1 ? "s" : ""} con plan vigente
        </p>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {negocios.map((negocio) => (
            <NegocioActivoCard key={negocio.id} negocio={negocio} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ============================================
// Negocio Activo Card
// ============================================
function NegocioActivoCard({ negocio }: { negocio: NegocioActivo }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const triggerRefresh = useSuperAdminStore((s) => s.triggerRefresh)

  const suspenderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/superadmin/negocios/${negocio.id}/suspender`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onMutate: () => setActionLoading("suspender"),
    onSuccess: (data) => {
      toast.success("Suspendido", { description: data.mensaje })
      triggerRefresh()
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
    onSettled: () => setActionLoading(null),
  })

  const rubroLabels: Record<string, string> = {
    restaurante: "🍔",
    ropa: "👕",
    negocio: "🏪",
  }

  const diasRestantes = negocio.diasRestantes

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="rounded-2xl bg-card border border-border/50 p-4"
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            background: negocio.logoUrl ? undefined : `${negocio.colorPrincipal}18`,
          }}
        >
          {negocio.logoUrl ? (
            <img src={negocio.logoUrl} alt={negocio.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold" style={{ color: negocio.colorPrincipal }}>
              {negocio.nombre.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm truncate">{negocio.nombre}</h3>
            <Badge variant="secondary" className="text-[10px] shrink-0 border-0 capitalize">
              {planLabels[negocio.planTipo] || negocio.planTipo}
            </Badge>
            {diasRestantes !== null && (
              <Badge
                className={cn(
                  "text-[10px] shrink-0 border-0",
                  diasRestantes <= 7
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                )}
              >
                {diasRestantes}d restantes
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rubroLabels[negocio.rubro] || ""} /{negocio.slug}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {negocio.totalProductos} productos
            </span>
            <span className="flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" />
              {negocio.totalPedidos} pedidos
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {negocio.planVencimiento
                ? `Vence ${new Date(negocio.planVencimiento).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`
                : "Sin vencimiento"}
            </span>
          </div>

          {/* Debt bar (if any) */}
          {negocio.deudaTarifa > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Deuda</span>
                <span className="font-semibold">
                  {formatPrice(negocio.deudaTarifa)} / {formatPrice(negocio.limiteDeudaCalculado)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    negocio.porcentajeDeuda >= 100 ? "bg-red-500" :
                    negocio.porcentajeDeuda >= 80 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(negocio.porcentajeDeuda, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
        <Link href={`/n/${negocio.slug}`} className="flex-1" target="_blank">
          <Button variant="outline" className="w-full gap-2 rounded-xl h-9 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Ver catálogo
          </Button>
        </Link>

        <RenovarDialog negocioId={negocio.id} negocioNombre={negocio.nombre} planVencimiento={negocio.planVencimiento} />

        <Button
          variant="outline"
          className="gap-2 rounded-xl h-9 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/5 border-amber-500/20"
          onClick={() => {
            if (confirm(`¿Suspender "${negocio.nombre}"?`)) suspenderMutation.mutate()
          }}
          disabled={!!actionLoading}
        >
          {actionLoading === "suspender" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
          Suspender
        </Button>

        {negocio.whatsapp && (
          <a
            href={`https://wa.me/${negocio.whatsapp.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              className="gap-2 rounded-xl h-9 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/5 border-green-500/20"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </Button>
          </a>
        )}
      </div>
    </motion.div>
  )
}

// ============================================
// Renovar Dialog
// ============================================
export function RenovarDialog({ negocioId, negocioNombre, planVencimiento }: {
  negocioId: string
  negocioNombre: string
  planVencimiento: string | null
}) {
  const [open, setOpen] = useState(false)
  const [periodo, setPeriodo] = useState(30)
  const [planTipo, setPlanTipo] = useState("mensual")
  const [customDate, setCustomDate] = useState("")
  const triggerRefresh = useSuperAdminStore((s) => s.triggerRefresh)

  const renovarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/superadmin/negocios/${negocioId}/renovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo,
          planTipo,
          fechaVencimientoCustom: customDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onSuccess: (data) => {
      toast.success("Suscripción renovada", { description: data.mensaje })
      setOpen(false)
      triggerRefresh()
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  })

  const quickPeriods = [
    { dias: 15, label: "15 días" },
    { dias: 30, label: "30 días" },
    { dias: 90, label: "90 días" },
    { dias: 365, label: "1 año" },
  ]

  const planTypes = [
    { value: "prueba", label: "Prueba" },
    { value: "mensual", label: "Mensual" },
    { value: "trimestral", label: "Trimestral" },
    { value: "semestral", label: "Semestral" },
    { value: "anual", label: "Anual" },
    { value: "vitalicio", label: "Vitalicio" },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-xl h-9 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5 border-emerald-500/20">
          <RefreshCw className="h-3.5 w-3.5" />
          Renovar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Renovar {negocioNombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick periods */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Período</label>
            <div className="grid grid-cols-4 gap-2">
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
              onChange={(e) => setCustomDate(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Plan type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo de plan</label>
            <div className="grid grid-cols-3 gap-2">
              {planTypes.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setPlanTipo(pt.value)}
                  className={cn(
                    "rounded-xl py-1.5 text-xs font-semibold transition-colors border capitalize",
                    planTipo === pt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                  )}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {planVencimiento && (
            <p className="text-xs text-muted-foreground">
              Vence actualmente: {new Date(planVencimiento).toLocaleDateString("es-AR")}
            </p>
          )}

          <Button
            className="w-full gap-2 rounded-xl font-semibold"
            onClick={() => renovarMutation.mutate()}
            disabled={renovarMutation.isPending}
          >
            {renovarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Renovar suscripción
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Skeleton
// ============================================
function ActivosSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <div className="h-5 w-32 rounded bg-muted/50 animate-pulse" />
        <div className="h-3 w-48 rounded bg-muted/30 animate-pulse mt-1" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card border border-border/50 p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded bg-muted/30" />
              <div className="h-3 w-48 rounded bg-muted/20" />
              <div className="h-2 w-full rounded-full bg-muted/20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
