"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  QrCode,
  Check,
  Loader2,
  Users,
  Link2,
  Power,
  PowerOff,
  X,
  UserPlus,
  Download,
  Clock,
  Flame,
  CheckCircle2,
  Armchair,
  Pencil,
  ChevronRight,
  CircleDot,
  AlertCircle,
  MapPin,
  Copy,
  RefreshCw,
  TrendingUp,
  UserCheck,
  BarChart3,
  DollarSign,
  ShoppingBag,
  Calendar,
  ClipboardList,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { TAB_COUNTS_KEY } from "./business-panel"

// ============================================
// Types
// ============================================
interface Mesa {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  activa: boolean
  negocioId: string
  empleadoId: string | null
  empleado?: { id: string; nombre: string; codigo: string } | null
}

interface Empleado {
  id: string
  nombre: string
  codigo: string
  rol: string
  activo: boolean
  negocioId: string
  token: string | null
  tokenMasked?: string | null
  tokenRevealed?: boolean
}

interface PedidoMesa {
  id: string
  clienteNombre: string
  total: number
  estado: string
  fecha: string
  metodoEntrega: string
  mesaNumero: number | null
  items: Array<{
    id: string
    nombre: string
    cantidad: number
    precio: number
    agregados: Array<{ id?: string; nombre: string; precio: number }>
    secciones: Record<string, string | Record<string, number>>
    seccionesPrecios: Record<string, number>
    ingredientes: string[]
    ingredientesQuitados: string[]
    talle?: string
    color?: string
  }>
}

interface NegocioSalonConfig {
  salonActivo: boolean
  empleadosActivos: boolean
}

interface SalonTabProps {
  negocio: {
    id: string
    slug: string
    nombre: string
    colorPrincipal: string
  }
}

interface SalonStatsResumen {
  totalMesaOrders: number
  totalMesaRevenue: number
  totalAllOrders: number
  totalAllRevenue: number
}

interface SalonStatsMozo {
  id: string
  nombre: string
  codigo: string
  mesasAsignadas: number
  pedidosHoy: number
  montoHoy: number
}

interface SalonStats {
  periodo: string
  resumen: SalonStatsResumen
  mozos: SalonStatsMozo[]
}

type SubTab = "mesas" | "mozos" | "estadisticas" | "historial"

const ROLES = [
  { value: "mozo", label: "Mozo" },
] as const

const roleLabel = (rol: string) => ROLES.find((r) => r.value === rol)?.label ?? rol

const roleColor = (rol: string) => {
  return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
}

// Status config for mesa orders
const MESA_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  recibido: { label: "Recibido", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: AlertCircle },
  preparando: { label: "Preparando", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800", icon: Flame },
  listo_para_retirar: { label: "Listo para servir", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  entregado: { label: "Entregado", color: "text-muted-foreground", bg: "bg-muted/30 border-border/30", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800", icon: X },
}

// ============================================
// Salon Tab Component
// ============================================
export function SalonTab({ negocio }: SalonTabProps) {
  const queryClient = useQueryClient()
  const [subTab, setSubTab] = useState<SubTab>("mesas")

  // Salon shared link token
  const [tokenSalon, setTokenSalon] = useState<string | null>(null)
  const [tokenSalonMasked, setTokenSalonMasked] = useState<string | null>(null)
  const [regeneratingSalon, setRegeneratingSalon] = useState(false)
  const [copiedSalon, setCopiedSalon] = useState(false)
  const hasSalonLinkMetadata = !!tokenSalon || !!tokenSalonMasked

  useEffect(() => {
    fetch("/api/negocio/access-tokens")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          const revealed = data.tokenSalonRevealed === true
          setTokenSalon(revealed ? data.tokenSalon : null)
          setTokenSalonMasked(data.tokenSalonMasked ?? (revealed ? data.tokenSalon : null))
        }
      })
      .catch(() => {})
  }, [])

  const regenerateSalonToken = async () => {
    setRegeneratingSalon(true)
    try {
      const res = await fetch("/api/negocio/access-tokens?type=salon", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setTokenSalon(data.tokenSalon)
        setTokenSalonMasked(data.tokenSalonMasked ?? data.tokenSalon)
        toast.success("Link del salón regenerado. El link anterior ya no funciona.")
      } else {
        toast.error("Error al regenerar el link")
      }
    } catch {
      toast.error("Error al regenerar el link")
    } finally {
      setRegeneratingSalon(false)
    }
  }

  const { data: config, isLoading: configLoading } = useQuery<NegocioSalonConfig>({
    queryKey: ["negocio-config", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/config?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando configuración")
      const json = await res.json()
      return json.data ?? json
    },
  })

  const salonActivo = config?.salonActivo ?? false
  const empleadosActivos = config?.empleadosActivos ?? false

  const toggleSalonMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch("/api/negocio/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonActivo: value }),
      })
      if (!res.ok) throw new Error("Error actualizando configuración")
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["negocio-config", negocio.id], (old: NegocioSalonConfig | undefined) =>
        old ? { ...old, salonActivo: data.salonActivo } : data
      )
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
      toast.success(data.salonActivo ? "Salón activado" : "Salón desactivado")
    },
    onError: () => {
      toast.error("Error al actualizar la configuración")
    },
  })

  const toggleEmpleadosMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch("/api/negocio/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empleadosActivos: value }),
      })
      if (!res.ok) throw new Error("Error actualizando configuración")
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["negocio-config", negocio.id], (old: NegocioSalonConfig | undefined) =>
        old ? { ...old, empleadosActivos: data.empleadosActivos } : data
      )
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
      toast.success(data.empleadosActivos ? "Mozos activados" : "Mozos desactivados")
    },
    onError: () => {
      toast.error("Error al actualizar la configuración")
    },
  })

  if (configLoading) {
    return <SalonSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* ===== SUB-TAB BAR ===== */}
      <div className="flex bg-muted/60 rounded-xl p-1">
        <button
          onClick={() => setSubTab("mesas")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
            subTab === "mesas"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Armchair className="h-3.5 w-3.5" />
          Mesas
        </button>
        <button
          onClick={() => setSubTab("mozos")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
            subTab === "mozos"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Mozos
        </button>
        <button
          onClick={() => setSubTab("estadisticas")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
            subTab === "estadisticas"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Estadísticas
        </button>
        <button
          onClick={() => setSubTab("historial")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
            subTab === "historial"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Historial
        </button>
      </div>

      {/* ===== SUB-TAB CONTENT ===== */}
      <AnimatePresence mode="wait">
        {subTab === "mesas" && (
          <motion.div
            key="mesas"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            {/* Salon toggle at top */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${negocio.colorPrincipal}15` }}>
                  <UtensilsCrossed className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Activar salón</p>
                  <p className="text-xs text-muted-foreground">
                    Permite que los clientes pidan desde una mesa con QR
                  </p>
                </div>
              </div>
              <Switch
                checked={salonActivo}
                onCheckedChange={(v) => toggleSalonMutation.mutate(v)}
                disabled={toggleSalonMutation.isPending}
              />
            </div>

            {!salonActivo ? (
              <div className="text-center py-8 px-4">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${negocio.colorPrincipal}12` }}
                >
                  <UtensilsCrossed className="h-7 w-7" style={{ color: negocio.colorPrincipal }} />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Activá el salón para crear mesas, generar códigos QR y permitir que tus clientes
                  hagan pedidos directamente desde su mesa.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Salon shared link */}
                <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${negocio.colorPrincipal}15` }}>
                      <Link2 className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Link del salón</p>
                      <p className="text-[11px] text-muted-foreground">Vista de mesas y pedidos para el salón</p>
                    </div>
                  </div>
                  {hasSalonLinkMetadata && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg bg-background border border-border/50 text-xs font-mono text-muted-foreground truncate">
                        {tokenSalon
                          ? `${typeof window !== "undefined" ? window.location.origin : ""}/s/${tokenSalon}`
                          : "Link oculto por seguridad. Regeneralo para obtener uno nuevo."}
                        {!tokenSalon && tokenSalonMasked ? ` (${tokenSalonMasked})` : ""}
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        className={cn(
                          "h-9 w-9 rounded-lg shrink-0 transition-all",
                          copiedSalon
                            ? "border-emerald-300 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : ""
                        )}
                        onClick={async () => {
                          if (!tokenSalon) {
                            await regenerateSalonToken()
                            return
                          }
                          const url = `${window.location.origin}/s/${tokenSalon}`
                          try {
                            await navigator.clipboard.writeText(url)
                            setCopiedSalon(true)
                            toast.success("Link del salón copiado")
                            setTimeout(() => setCopiedSalon(false), 2000)
                          } catch {
                            toast.error("No se pudo copiar")
                          }
                        }}
                        title={tokenSalon ? "Copiar link del salón" : "Regenerar link del salón"}
                        disabled={regeneratingSalon}
                      >
                        {regeneratingSalon && !tokenSalon ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : copiedSalon ? (
                          <Check className="h-4 w-4" />
                        ) : tokenSalon ? (
                          <Copy className="h-4 w-4" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl gap-2 font-semibold border-dashed"
                    style={{ borderColor: `${negocio.colorPrincipal}40`, color: negocio.colorPrincipal }}
                    onClick={regenerateSalonToken}
                    disabled={regeneratingSalon}
                  >
                    {regeneratingSalon ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Regenerar link
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Al regenerar, el link anterior deja de funcionar inmediatamente
                  </p>
                </div>

                <SalonFloorPlan negocio={negocio} />
              </div>
            )}
          </motion.div>
        )}

        {subTab === "mozos" && (
          <motion.div
            key="mozos"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            {/* Mozos toggle at top */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${negocio.colorPrincipal}15` }}>
                  <Users className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Registrar mozos</p>
                  <p className="text-xs text-muted-foreground">
                    Gestioná los mozos del salón
                  </p>
                </div>
              </div>
              <Switch
                checked={empleadosActivos}
                onCheckedChange={(v) => toggleEmpleadosMutation.mutate(v)}
                disabled={toggleEmpleadosMutation.isPending}
              />
            </div>

            <AnimatePresence>
              {empleadosActivos ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <EmpleadosSection negocio={negocio} slug={negocio.slug} />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8 px-4"
                >
                  <div
                    className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ backgroundColor: `${negocio.colorPrincipal}12` }}
                  >
                    <Users className="h-7 w-7" style={{ color: negocio.colorPrincipal }} />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Activá esta función para registrar mozos. Cada mozo tiene un link propio para tomar pedidos.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {subTab === "estadisticas" && (
          <motion.div
            key="estadisticas"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            <EstadisticasSubTab negocio={negocio} />
          </motion.div>
        )}

        {subTab === "historial" && (
          <motion.div
            key="historial"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            <HistorialSubTab negocio={negocio} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// Estadísticas Sub-Tab
// ============================================
function EstadisticasSubTab({ negocio }: { negocio: SalonTabProps["negocio"] }) {
  const [periodo, setPeriodo] = useState<"hoy" | "semana" | "mes" | "todo">("hoy")

  const { data: stats, isLoading } = useQuery<SalonStats>({
    queryKey: ["salon-stats", negocio.id, periodo],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/salon/stats?periodo=${periodo}`)
      if (!res.ok) throw new Error("Error cargando estadísticas")
      return res.json()
    },
    refetchInterval: 30000,
  })

  const periodos = [
    { value: "hoy" as const, label: "Hoy" },
    { value: "semana" as const, label: "Semana" },
    { value: "mes" as const, label: "Mes" },
    { value: "todo" as const, label: "Todo" },
  ]

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    )
  }

  const resumen = stats?.resumen ?? { totalMesaOrders: 0, totalMesaRevenue: 0, totalAllOrders: 0, totalAllRevenue: 0 }
  const mozos = stats?.mozos ?? []

  return (
    <div className="space-y-4">
      {/* Period selector pills */}
      <div className="flex bg-muted/60 rounded-xl p-1">
        {periodos.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
              periodo === p.value
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl border border-border/50 bg-background">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${negocio.colorPrincipal}15` }}
            >
              <Armchair className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">Salón</span>
          </div>
          <p className="text-xl font-bold" style={{ color: negocio.colorPrincipal }}>
            {formatPrice(resumen.totalMesaRevenue)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {resumen.totalMesaOrders} {resumen.totalMesaOrders === 1 ? "pedido" : "pedidos"} en mesas
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-border/50 bg-background">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">Total</span>
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatPrice(resumen.totalAllRevenue)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {resumen.totalAllOrders} {resumen.totalAllOrders === 1 ? "pedido" : "pedidos"} totales
          </p>
        </div>
      </div>

      {/* Mesa share bar */}
      {resumen.totalAllRevenue > 0 && (
        <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Proporción del salón</span>
            <span className="text-xs font-bold" style={{ color: negocio.colorPrincipal }}>
              {Math.round((resumen.totalMesaRevenue / resumen.totalAllRevenue) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((resumen.totalMesaRevenue / resumen.totalAllRevenue) * 100)}%`,
                backgroundColor: negocio.colorPrincipal,
              }}
            />
          </div>
        </div>
      )}

      {/* Per-mozo stats */}
      {mozos.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground">Estadísticas por mozo</p>
          </div>
          <div className="space-y-2">
            {mozos.map((mozo) => (
              <motion.div
                key={mozo.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl border border-border/50 bg-background"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
                    style={{
                      backgroundColor: `${negocio.colorPrincipal}15`,
                      color: negocio.colorPrincipal,
                    }}
                  >
                    {mozo.codigo.substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{mozo.nombre}</p>
                      <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5">
                        {mozo.codigo}
                      </Badge>
                      {mozo.mesasAsignadas > 0 && (
                        <Badge className="text-[9px] h-4 px-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                          {mozo.mesasAsignadas} {mozo.mesasAsignadas === 1 ? "mesa" : "mesas"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3 text-muted-foreground/50" />
                        <span className={cn(
                          "text-[11px] font-semibold",
                          mozo.pedidosHoy > 0 ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {mozo.pedidosHoy} {mozo.pedidosHoy === 1 ? "pedido" : "pedidos"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-emerald-500" />
                        <span className={cn(
                          "text-[11px] font-bold",
                          mozo.montoHoy > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        )}>
                          {formatPrice(mozo.montoHoy)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-muted/30">
            <BarChart3 className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">Sin datos</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Las estadísticas aparecerán cuando haya pedidos en el salón
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Salon Floor Plan — Visual Mesa Map
// ============================================
function SalonFloorPlan({ negocio }: { negocio: SalonTabProps["negocio"] }) {
  const queryClient = useQueryClient()
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [qrModalMesa, setQrModalMesa] = useState<Mesa | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  // Add form state
  const [formNumero, setFormNumero] = useState("")
  const [formNombre, setFormNombre] = useState("")
  const [formZona, setFormZona] = useState("")
  const [newZoneInput, setNewZoneInput] = useState("")
  const [formCapacidad, setFormCapacidad] = useState("4")

  // Fetch mesas
  const { data: mesas = [], isLoading: mesasLoading } = useQuery<Mesa[]>({
    queryKey: ["mesas", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/mesas")
      if (!res.ok) throw new Error("Error cargando mesas")
      return res.json()
    },
  })

  // Fetch active mesa orders
  const { data: mesaOrdersData } = useQuery({
    queryKey: ["mesa-orders", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/pedidos?metodoEntrega=mesa&estado=activos&limit=100`)
      if (!res.ok) throw new Error("Error cargando pedidos")
      return res.json()
    },
    refetchInterval: 5000, // Auto-refresh every 5s
  })

  const mesaOrders: PedidoMesa[] = mesaOrdersData?.pedidos ?? []

  // Build a map of mesaNumero → active orders
  const mesaOrdersMap = useMemo(() => {
    const map = new Map<number, PedidoMesa[]>()
    for (const order of mesaOrders) {
      const num = order.mesaNumero
      if (!num) continue
      if (!map.has(num)) map.set(num, [])
      map.get(num)!.push(order)
    }
    return map
  }, [mesaOrders])

  // Get the worst (most urgent) status for a mesa
  const getMesaWorstStatus = (mesaNumero: number): string | null => {
    const orders = mesaOrdersMap.get(mesaNumero)
    if (!orders || orders.length === 0) return null
    const priority = ["recibido", "preparando", "listo_para_retirar"]
    for (const status of priority) {
      if (orders.some((o) => o.estado === status)) return status
    }
    return null
  }

  // Stats
  const mesasConPedidos = mesaOrdersMap.size

  // Add mesa mutation
  const addMutation = useMutation({
    mutationFn: async (data: { numero: number; nombre: string; zona: string; capacidad: number }) => {
      const res = await fetch("/api/negocio/mesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error creando mesa")
      }
      return res.json()
    },
    onSuccess: (newMesa) => {
      queryClient.setQueryData<Mesa[]>(["mesas", negocio.id], (old) =>
        old ? [...old, newMesa].sort((a, b) => a.numero - b.numero) : [newMesa]
      )
      queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })
      toast.success("Mesa creada correctamente")
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete mesa mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/mesas/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando mesa")
      return res.json()
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<Mesa[]>(["mesas", negocio.id], (old) =>
        old ? old.filter((m) => m.id !== deletedId) : []
      )
      queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })
      toast.success("Mesa eliminada")
      setDeleteConfirm(null)
    },
    onError: () => {
      toast.error("Error al eliminar la mesa")
    },
  })

  // Toggle mesa activa mutation
  const toggleMesaMutation = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const res = await fetch(`/api/negocio/mesas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa }),
      })
      if (!res.ok) throw new Error("Error actualizando mesa")
      return res.json()
    },
    onSuccess: (updatedMesa) => {
      queryClient.setQueryData<Mesa[]>(["mesas", negocio.id], (old) =>
        old ? old.map((m) => m.id === updatedMesa.id ? updatedMesa : m) : []
      )
      queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })
    },
    onError: () => {
      toast.error("Error al actualizar la mesa")
    },
  })

  // Generate QR code
  const generateQR = useCallback(async (mesa: Mesa) => {
    setQrLoading(true)
    setQrModalMesa(mesa)
    try {
      const QRCode = (await import("qrcode")).default
      const url = `${window.location.origin}/n/${negocio.slug}?mesa=${mesa.numero}`
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      })
      setQrDataUrl(dataUrl)
    } catch {
      toast.error("Error generando código QR")
      setQrModalMesa(null)
    } finally {
      setQrLoading(false)
    }
  }, [negocio.slug])

  const downloadQR = useCallback(() => {
    if (!qrDataUrl || !qrModalMesa) return
    const link = document.createElement("a")
    link.download = `mesa-${qrModalMesa.numero}-qr.png`
    link.href = qrDataUrl
    link.click()
  }, [qrDataUrl, qrModalMesa])

  const resetForm = () => {
    setFormNumero("")
    setFormNombre("")
    setFormZona("")
    setNewZoneInput("")
    setFormCapacidad("4")
    setAddFormOpen(false)
  }

  const handleAddMesa = () => {
    const numero = parseInt(formNumero)
    if (isNaN(numero) || numero < 1) {
      toast.error("Ingresá un número de mesa válido")
      return
    }
    addMutation.mutate({
      numero,
      nombre: formNombre.trim(),
      zona: formZona === "__none__" ? "" : formZona === "__new__" ? newZoneInput.trim() : formZona.trim(),
      capacidad: parseInt(formCapacidad) || 4,
    })
  }

  const copyMesaLink = async (mesaNumero: number, mesaId: string) => {
    const url = `${window.location.origin}/n/${negocio.slug}?mesa=${mesaNumero}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(mesaId)
      toast.success("Link copiado al portapapeles")
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("No se pudo copiar el link")
    }
  }

  // Open mesa detail
  const openMesaDetail = (mesa: Mesa) => {
    setSelectedMesa(mesa)
    setDetailOpen(true)
  }

  if (mesasLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const activeMesas = mesas.filter((m) => m.activa)
  const inactiveMesas = mesas.filter((m) => !m.activa)

  return (
    <div className="space-y-4">
      {/* Status summary bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {mesaOrders.filter(o => o.estado === "recibido").length} nuevos
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
            {mesaOrders.filter(o => o.estado === "preparando").length} preparando
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {mesaOrders.filter(o => o.estado === "listo_para_retirar").length} listos
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Armchair className="h-3.5 w-3.5" />
          {mesasConPedidos}/{activeMesas.length} mesas con pedidos
        </div>
      </div>

      {/* Visual floor plan — grouped by zona */}
      {activeMesas.length > 0 ? (
        (() => {
          // Group mesas by zona
          const zonaGroups = new Map<string, Mesa[]>()
          for (const mesa of activeMesas) {
            const key = mesa.zona || ""
            if (!zonaGroups.has(key)) zonaGroups.set(key, [])
            zonaGroups.get(key)!.push(mesa)
          }
          // Sort: named zones first, then "Sin zona"
          const sortedZonas = [...zonaGroups.keys()].sort((a, b) => {
            if (!a) return 1
            if (!b) return -1
            return a.localeCompare(b)
          })

          return (
            <div className="space-y-4">
              {sortedZonas.map((zona) => {
                const zoneMesas = zonaGroups.get(zona)!
                return (
                  <div key={zona || "__no_zona__"}>
                    {zona && (
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">{zona}</span>
                        <span className="text-[10px] text-muted-foreground/60">({zoneMesas.length})</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      <AnimatePresence mode="popLayout">
                        {zoneMesas.map((mesa) => {
                          const status = getMesaWorstStatus(mesa.numero)
                          const orders = mesaOrdersMap.get(mesa.numero) ?? []
                          const hasOrders = orders.length > 0

                          return (
                            <motion.button
                              key={mesa.id}
                              layout
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => openMesaDetail(mesa)}
                              className={cn(
                                "relative flex flex-col items-center justify-center aspect-square rounded-2xl border-2 transition-all duration-300 cursor-pointer group",
                                !status && "border-border/50 bg-card hover:border-primary/30 hover:shadow-md",
                                status === "recibido" && "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 shadow-md shadow-amber-200/50 dark:shadow-amber-900/30",
                                status === "preparando" && "border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/30 shadow-md shadow-orange-200/50 dark:shadow-orange-900/30",
                                status === "listo_para_retirar" && "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/30",
                              )}
                            >
                              {status === "recibido" && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                                </span>
                              )}
                              <span className={cn(
                                "text-2xl font-extrabold leading-none",
                                !status && "text-foreground/80",
                                status === "recibido" && "text-amber-700 dark:text-amber-300",
                                status === "preparando" && "text-orange-700 dark:text-orange-300",
                                status === "listo_para_retirar" && "text-emerald-700 dark:text-emerald-300",
                              )}>
                                {mesa.numero}
                              </span>
                              {mesa.nombre && (
                                <span className={cn(
                                  "text-[10px] font-medium mt-0.5 truncate max-w-[90%]",
                                  !status && "text-muted-foreground",
                                  status === "recibido" && "text-amber-600 dark:text-amber-400",
                                  status === "preparando" && "text-orange-600 dark:text-orange-400",
                                  status === "listo_para_retirar" && "text-emerald-600 dark:text-emerald-400",
                                )}>
                                  {mesa.nombre}
                                </span>
                              )}
                              {!hasOrders && !mesa.empleado && (
                                <span className="text-[9px] text-muted-foreground mt-1 flex items-center gap-0.5">
                                  <Users className="h-2.5 w-2.5" />
                                  {mesa.capacidad}
                                </span>
                              )}
                              {mesa.empleado && (
                                <span className="text-[9px] mt-1 flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-semibold">
                                  <UserCheck className="h-2.5 w-2.5" />
                                  {mesa.empleado.nombre.split(" ")[0]}
                                </span>
                              )}
                              {hasOrders && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                    status === "recibido" && "bg-amber-200/60 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200",
                                    status === "preparando" && "bg-orange-200/60 dark:bg-orange-800/40 text-orange-800 dark:text-orange-200",
                                    status === "listo_para_retirar" && "bg-emerald-200/60 dark:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200",
                                  )}>
                                    {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
                                  </span>
                                </div>
                              )}
                              <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
                                <span className="text-[9px] font-semibold text-muted-foreground flex items-center gap-0.5">
                                  Ver detalle <ChevronRight className="h-2.5 w-2.5" />
                                </span>
                              </div>
                            </motion.button>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()
      ) : (
        <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
          <Armchair className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">Sin mesas activas</p>
          <p className="text-xs text-muted-foreground mt-0.5">Agregá mesas para ver el mapa del salón</p>
        </div>
      )}

      {/* Inactive mesas */}
      {inactiveMesas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <PowerOff className="h-3 w-3" />
            Mesas inactivas ({inactiveMesas.length})
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {inactiveMesas.map((mesa) => (
              <button
                key={mesa.id}
                onClick={() => openMesaDetail(mesa)}
                className="flex flex-col items-center justify-center aspect-square rounded-2xl border border-border/30 bg-muted/20 opacity-50 hover:opacity-70 transition-opacity cursor-pointer"
              >
                <span className="text-lg font-bold text-muted-foreground">{mesa.numero}</span>
                {mesa.nombre && (
                  <span className="text-[9px] text-muted-foreground truncate max-w-[90%]">{mesa.nombre}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add mesa button */}
      <AnimatePresence mode="wait">
        {!addFormOpen ? (
          <motion.div key="add-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl gap-2 border-dashed font-semibold"
              style={{ borderColor: `${negocio.colorPrincipal}40`, color: negocio.colorPrincipal }}
              onClick={() => setAddFormOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Agregar mesa
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="add-form"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-3"
          >
            <p className="text-xs font-semibold">Nueva mesa</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Número *</Label>
                <Input
                  type="number" min={1}
                  value={formNumero}
                  onChange={(e) => setFormNumero(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                  placeholder="1"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Capacidad</Label>
                <Input
                  type="number" min={1}
                  value={formCapacidad}
                  onChange={(e) => setFormCapacidad(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                  placeholder="4"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Nombre</Label>
                <Input
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                  placeholder="Patio 1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Zona</Label>
                {(() => {
                  const existingZonas = [...new Set(mesas.map(m => m.zona).filter(Boolean))]
                  if (existingZonas.length === 0) {
                    return (
                      <Input
                        value={formZona}
                        onChange={(e) => setFormZona(e.target.value)}
                        className="rounded-xl h-8 text-sm"
                        placeholder="Patio, Adentro..."
                      />
                    )
                  }
                  return (
                    <div className="space-y-1.5">
                      <Select value={formZona === "__new__" ? "__new__" : formZona} onValueChange={(v) => { setFormZona(v); if (v !== "__new__") setNewZoneInput("") }}>
                        <SelectTrigger className="rounded-xl h-8 text-sm">
                          <SelectValue placeholder="Sin zona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin zona</SelectItem>
                          {existingZonas.map((z) => (
                            <SelectItem key={z} value={z}>{z}</SelectItem>
                          ))}
                          <SelectItem value="__new__">+ Nueva zona...</SelectItem>
                        </SelectContent>
                      </Select>
                      {formZona === "__new__" && (
                        <Input
                          value={newZoneInput}
                          onChange={(e) => setNewZoneInput(e.target.value)}
                          className="rounded-xl h-8 text-sm"
                          placeholder="Nombre de la zona"
                          autoFocus
                        />
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-xl gap-1.5 font-semibold h-7 text-xs flex-1"
                style={{ backgroundColor: negocio.colorPrincipal }}
                onClick={handleAddMesa}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Crear mesa
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={resetForm} disabled={addMutation.isPending}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MESA DETAIL DRAWER ===== */}
      <Drawer open={detailOpen} onOpenChange={(open) => { if (!open) { setDetailOpen(false); setSelectedMesa(null) } }}>
        <DrawerContent className="max-h-[85vh]">
          {selectedMesa && (
            <MesaDetailDrawer
              key={selectedMesa.id}
              mesa={selectedMesa}
              negocio={negocio}
              allMesas={mesas}
              orders={mesaOrdersMap.get(selectedMesa.numero) ?? []}
              onClose={() => { setDetailOpen(false); setSelectedMesa(null) }}
              onToggleActiva={(activa) => toggleMesaMutation.mutate({ id: selectedMesa.id, activa })}
              onDelete={() => deleteMutation.mutate(selectedMesa.id)}
              onGenerateQR={() => generateQR(selectedMesa)}
              onCopyLink={() => copyMesaLink(selectedMesa.numero, selectedMesa.id)}
              copiedId={copiedId}
              isToggling={toggleMesaMutation.isPending}
              isDeleting={deleteMutation.isPending}
            />
          )}
        </DrawerContent>
      </Drawer>

      {/* ===== QR MODAL ===== */}
      <Dialog open={!!qrModalMesa} onOpenChange={(open) => { if (!open) { setQrModalMesa(null); setQrDataUrl(null) } }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" style={{ color: negocio.colorPrincipal }} />
              Mesa {qrModalMesa?.numero}
              {qrModalMesa?.nombre && ` — ${qrModalMesa.nombre}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrLoading ? (
              <div className="w-[300px] h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : qrDataUrl ? (
              <>
                <img
                  src={qrDataUrl}
                  alt={`QR Mesa ${qrModalMesa?.numero}`}
                  className="w-[260px] h-[260px] rounded-xl border border-border/50"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Los clientes escanean este código para pedir desde la mesa {qrModalMesa?.numero}
                </p>
                <Button
                  className="rounded-xl gap-2 font-semibold w-full"
                  style={{ backgroundColor: negocio.colorPrincipal }}
                  onClick={downloadQR}
                >
                  <Download className="h-4 w-4" />
                  Descargar QR
                </Button>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRM DIALOG ===== */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-2xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Eliminar mesa
            </DialogTitle>
            <DialogDescription>
              ¿Seguro que querés eliminar esta mesa? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" className="rounded-xl" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Mesa Detail Drawer
// ============================================
function MesaDetailDrawer({
  mesa,
  negocio,
  allMesas,
  orders,
  onClose,
  onToggleActiva,
  onDelete,
  onGenerateQR,
  onCopyLink,
  copiedId,
  isToggling,
  isDeleting,
}: {
  mesa: Mesa
  negocio: SalonTabProps["negocio"]
  allMesas: Mesa[]
  orders: PedidoMesa[]
  onClose: () => void
  onToggleActiva: (activa: boolean) => void
  onDelete: () => void
  onGenerateQR: () => void
  onCopyLink: () => void
  copiedId: string | null
  isToggling: boolean
  isDeleting: boolean
}) {
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editNumero, setEditNumero] = useState(String(mesa.numero))
  const [editNombre, setEditNombre] = useState(mesa.nombre)
  const [editZona, setEditZona] = useState(mesa.zona || "__none__")
  const [editNewZoneInput, setEditNewZoneInput] = useState("")
  const [editCapacidad, setEditCapacidad] = useState(String(mesa.capacidad))

  // Note: key={mesa.id} on the component forces full remount when mesa changes,
  // so editing state is automatically reset and no useEffect is needed

  const activeOrders = orders.filter((o) => ["recibido", "preparando", "listo_para_retirar"].includes(o.estado))

  // Edit mesa mutation
  const editMesaMutation = useMutation({
    mutationFn: async (data: { numero: number; nombre: string; zona: string; capacidad: number }) => {
      const res = await fetch(`/api/negocio/mesas/${mesa.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error actualizando mesa")
      }
      return res.json()
    },
    onSuccess: (updatedMesa) => {
      queryClient.setQueryData<Mesa[]>(["mesas", negocio.id], (old) =>
        old ? old.map((m) => m.id === updatedMesa.id ? updatedMesa : m) : []
      )
      queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })
      toast.success("Mesa actualizada")
      setIsEditing(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSaveEdit = () => {
    const numero = parseInt(editNumero)
    if (isNaN(numero) || numero < 1) {
      toast.error("Ingresá un número de mesa válido")
      return
    }
    editMesaMutation.mutate({
      numero,
      nombre: editNombre.trim(),
      zona: editZona === "__none__" ? "" : editZona === "__new__" ? editNewZoneInput.trim() : editZona.trim(),
      capacidad: parseInt(editCapacidad) || 4,
    })
  }

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ pedidoId, estado }: { pedidoId: string; estado: string }) => {
      const res = await fetch("/api/negocio/pedidos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, estado }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error actualizando pedido")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesa-orders", negocio.id] })
      queryClient.invalidateQueries({ queryKey: ["negocio-pedidos", negocio.id] })
      // Invalidate tab counts so Pedidos badge updates instantly
      queryClient.invalidateQueries({ queryKey: [TAB_COUNTS_KEY] })
      // Invalidate mozo stats so mozo order counts update
      queryClient.invalidateQueries({ queryKey: ["mozo-stats", negocio.id] })
      // Invalidate salon stats so Estadísticas sub-tab updates instantly
      queryClient.invalidateQueries({ queryKey: ["salon-stats", negocio.id] })
      toast.success("Estado actualizado")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const getNextAction = (estado: string): { label: string; nextEstado: string; color: string } | null => {
    switch (estado) {
      case "recibido": return { label: "Preparar", nextEstado: "preparando", color: "bg-orange-500 hover:bg-orange-600" }
      case "preparando": return { label: "Listo para servir", nextEstado: "listo_para_retirar", color: "bg-emerald-500 hover:bg-emerald-600" }
      case "listo_para_retirar": return { label: "Entregado", nextEstado: "entregado", color: "bg-primary hover:bg-primary/90" }
      default: return null
    }
  }

  const status = activeOrders.length > 0
    ? (["recibido", "preparando", "listo_para_retirar"].find(s => activeOrders.some(o => o.estado === s)) ?? null)
    : null

  // Existing zonas from all mesas (for zone selector)
  const existingZonas = [...new Set(allMesas.map(m => m.zona).filter(Boolean))]

  return (
    <>
      <DrawerHeader className="text-left shrink-0">
        <DrawerTitle className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg shrink-0",
            !status && "bg-muted text-foreground",
            status === "recibido" && "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
            status === "preparando" && "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
            status === "listo_para_retirar" && "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
          )}>
            {mesa.numero}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-base font-bold">
              Mesa {mesa.numero}
              {mesa.nombre && ` — ${mesa.nombre}`}
            </span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Users className="h-3 w-3" />
              <span>{mesa.capacidad} personas</span>
              {mesa.zona && (
                <>
                  <MapPin className="h-3 w-3" />
                  <span>{mesa.zona}</span>
                </>
              )}
              {mesa.empleado && (
                <>
                  <UserCheck className="h-3 w-3 text-blue-500" />
                  <span className="text-blue-600 dark:text-blue-400 font-medium">{mesa.empleado.nombre}</span>
                </>
              )}
              {!mesa.activa && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Inactiva</Badge>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg shrink-0"
            onClick={() => {
              if (isEditing) {
                setIsEditing(false)
              } else {
                setEditNumero(String(mesa.numero))
                setEditNombre(mesa.nombre)
                setEditZona(mesa.zona || "__none__")
                setEditCapacidad(String(mesa.capacidad))
                setIsEditing(true)
              }
            }}
          >
            {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </DrawerTitle>
      </DrawerHeader>

      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
        {/* Edit form */}
        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-4 p-3 rounded-xl border border-border/50 bg-muted/20 space-y-3"
            >
              <p className="text-xs font-semibold">Editar mesa</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-semibold mb-1 block">Número *</Label>
                  <Input
                    type="number" min={1}
                    value={editNumero}
                    onChange={(e) => setEditNumero(e.target.value)}
                    className="rounded-xl h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold mb-1 block">Capacidad</Label>
                  <Input
                    type="number" min={1}
                    value={editCapacidad}
                    onChange={(e) => setEditCapacidad(e.target.value)}
                    className="rounded-xl h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-semibold mb-1 block">Nombre</Label>
                  <Input
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="rounded-xl h-8 text-sm"
                    placeholder="Patio 1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold mb-1 block">Zona</Label>
                  {existingZonas.length === 0 ? (
                    <Input
                      value={editZona === "__none__" ? "" : editZona}
                      onChange={(e) => setEditZona(e.target.value || "__none__")}
                      className="rounded-xl h-8 text-sm"
                      placeholder="Patio, Adentro..."
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <Select value={editZona === "__new__" ? "__new__" : editZona} onValueChange={(v) => { setEditZona(v); if (v !== "__new__") setEditNewZoneInput("") }}>
                        <SelectTrigger className="rounded-xl h-8 text-sm">
                          <SelectValue placeholder="Sin zona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin zona</SelectItem>
                          {existingZonas.map((z) => (
                            <SelectItem key={z} value={z}>{z}</SelectItem>
                          ))}
                          <SelectItem value="__new__">+ Nueva zona...</SelectItem>
                        </SelectContent>
                      </Select>
                      {editZona === "__new__" && (
                        <Input
                          value={editNewZoneInput}
                          onChange={(e) => setEditNewZoneInput(e.target.value)}
                          className="rounded-xl h-8 text-sm"
                          placeholder="Nombre de la zona"
                          autoFocus
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5 font-semibold h-7 text-xs flex-1"
                  style={{ backgroundColor: negocio.colorPrincipal }}
                  onClick={handleSaveEdit}
                  disabled={editMesaMutation.isPending}
                >
                  {editMesaMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Guardar cambios
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={() => setIsEditing(false)} disabled={editMesaMutation.isPending}>
                  Cancelar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mesa actions toolbar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs" onClick={onGenerateQR}>
            <QrCode className="h-3.5 w-3.5" />
            QR
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs" onClick={onCopyLink}>
            {copiedId === mesa.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
            {copiedId === mesa.id ? "Copiado" : "Link"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn("rounded-xl gap-1.5 h-8 text-xs", !mesa.activa && "text-emerald-600 border-emerald-200 dark:border-emerald-800")}
            onClick={() => onToggleActiva(!mesa.activa)}
            disabled={isToggling}
          >
            {mesa.activa ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            {mesa.activa ? "Desactivar" : "Activar"}
          </Button>
          {!deleteConfirm ? (
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="destructive" className="rounded-xl h-8 text-xs" onClick={onDelete} disabled={isDeleting}>
                {isDeleting ? "..." : "Confirmar"}
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => setDeleteConfirm(false)}>
                No
              </Button>
            </div>
          )}
        </div>

        {/* Active orders */}
        {activeOrders.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold">Pedidos activos</h4>
              <Badge className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-0">
                {activeOrders.length}
              </Badge>
            </div>

            {activeOrders.map((order) => {
              const config = MESA_STATUS_CONFIG[order.estado]
              const nextAction = getNextAction(order.estado)
              const StatusIcon = config?.icon ?? Clock
              const timeAgo = getTimeAgo(order.fecha)

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-xl border p-3 space-y-2.5",
                    config?.bg ?? "bg-card border-border/50"
                  )}
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={cn("h-4 w-4", config?.color ?? "text-muted-foreground")} />
                      <span className={cn("text-xs font-bold", config?.color ?? "text-muted-foreground")}>
                        {config?.label ?? order.estado}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                  </div>

                  {/* Client & total */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{order.clienteNombre || "Cliente"}</span>
                    <span className="text-sm font-bold">{formatPrice(order.total)}</span>
                  </div>

                  {/* Items detail */}
                  <div className="space-y-2">
                    {order.items.map((item) => {
                      const hasDetails = (item.agregados?.length > 0) || (Object.keys(item.secciones || {}).length > 0) || (item.ingredientesQuitados?.length > 0) || item.talle || item.color
                      return (
                        <div key={item.id}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {item.cantidad > 1 && <span className="font-semibold">{item.cantidad}x </span>}
                              {item.nombre}
                            </span>
                            <span className="text-muted-foreground font-medium">
                              {formatPrice(item.precio * item.cantidad)}
                            </span>
                          </div>
                          {hasDetails && (
                            <div className="ml-4 mt-1 space-y-1">
                              {(item.talle || item.color) && (
                                <div className="flex flex-wrap gap-1">
                                  {item.talle && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium">Talle: {item.talle}</span>}
                                  {item.color && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium">Color: {item.color}</span>}
                                </div>
                              )}
                              {Object.keys(item.secciones || {}).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(item.secciones).map(([k, v]) => {
                                    let display: string
                                    if (typeof v === "string") {
                                      display = `${k}: ${v}`
                                    } else {
                                      const parts = Object.entries(v as Record<string, number>)
                                        .filter(([, qty]) => qty > 0)
                                        .map(([opt, qty]) => qty > 1 ? `${opt} x${qty}` : opt)
                                      display = `${k}: ${parts.join(", ")}`
                                    }
                                    return <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{display}</span>
                                  })}
                                </div>
                              )}
                              {item.agregados?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {item.agregados.map((a, i) => (
                                    <span key={a.id ?? i} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 font-medium">+ {a.nombre}{a.precio > 0 ? ` ($${a.precio})` : ""}</span>
                                  ))}
                                </div>
                              )}
                              {item.ingredientesQuitados?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {item.ingredientesQuitados.map((ing, i) => (
                                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 font-medium">Sin {ing}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Action button */}
                  {nextAction && (
                    <Button
                      size="sm"
                      className={cn("w-full rounded-xl gap-1.5 font-semibold h-8 text-xs text-white", nextAction.color)}
                      onClick={() => updateStatusMutation.mutate({ pedidoId: order.id, estado: nextAction.nextEstado })}
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {nextAction.label}
                    </Button>
                  )}
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-muted/30">
              <Armchair className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Sin pedidos activos</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cuando un cliente haga un pedido desde esta mesa, aparecerá aquí
            </p>
          </div>
        )}

      </div>

      <DrawerFooter className="border-t pt-3">
        <Button variant="outline" className="rounded-xl" onClick={onClose}>
          Cerrar
        </Button>
      </DrawerFooter>
    </>
  )
}

// ============================================
// Historial Sub-Tab
// ============================================
function HistorialSubTab({ negocio }: { negocio: SalonTabProps["negocio"] }) {
  const [periodo, setPeriodo] = useState<"hoy" | "semana" | "mes">("hoy")
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null)
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)

  // Fetch mesas
  const { data: mesas = [], isLoading: mesasLoading } = useQuery<Mesa[]>({
    queryKey: ["mesas", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/mesas")
      if (!res.ok) throw new Error("Error cargando mesas")
      return res.json()
    },
  })

  // Fetch history for selected mesa
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["mesa-history", negocio.id, selectedMesa?.numero, periodo],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/pedidos?metodoEntrega=mesa&mesaNumero=${selectedMesa!.numero}&estado=historial&limit=50&periodo=${periodo}`)
      if (!res.ok) throw new Error("Error cargando historial")
      return res.json() as Promise<{ pedidos: PedidoMesa[]; pagination: { total: number } }>
    },
    enabled: !!selectedMesa && historyDrawerOpen,
  })

  const handleMesaClick = (mesa: Mesa) => {
    setSelectedMesa(mesa)
    setHistoryDrawerOpen(true)
  }

  if (mesasLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex gap-2">
        {(["hoy", "semana", "mes"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
              periodo === p
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {p === "hoy" ? "Hoy" : p === "semana" ? "Semana" : "Mes"}
          </button>
        ))}
      </div>

      {/* Mesa grid — grouped by zona */}
      {mesas.length === 0 ? (
        <div className="text-center py-12">
          <Armchair className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mt-2">No hay mesas creadas</p>
        </div>
      ) : (() => {
        // Group mesas by zona
        const zonaGroups = new Map<string, Mesa[]>()
        for (const mesa of mesas) {
          const key = mesa.zona || ""
          if (!zonaGroups.has(key)) zonaGroups.set(key, [])
          zonaGroups.get(key)!.push(mesa)
        }
        // Sort: named zones first, then "Sin zona"
        const sortedZonas = [...zonaGroups.keys()].sort((a, b) => {
          if (!a) return 1
          if (!b) return -1
          return a.localeCompare(b)
        })

        return (
          <div className="space-y-4">
            {sortedZonas.map((zona) => {
              const zoneMesas = zonaGroups.get(zona)!
              return (
                <div key={zona || "__no_zona__"}>
                  {zona && (
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">{zona}</span>
                      <span className="text-[10px] text-muted-foreground/60">({zoneMesas.length})</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {zoneMesas.map((mesa) => (
                      <button
                        key={mesa.id}
                        onClick={() => handleMesaClick(mesa)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all",
                          mesa.activa
                            ? "border-border/50 bg-card hover:bg-accent/50 hover:border-primary/30"
                            : "border-border/30 bg-muted/30 opacity-50"
                        )}
                      >
                        <Armchair className={cn("h-5 w-5", mesa.activa ? "text-foreground" : "text-muted-foreground/50")} />
                        <span className="text-sm font-bold">{mesa.numero}</span>
                        {mesa.nombre && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-full">{mesa.nombre}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* History Drawer */}
      <Drawer open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Armchair className="h-4 w-4" />
              Mesa {selectedMesa?.numero}{selectedMesa?.nombre ? ` · ${selectedMesa.nombre}` : ""}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : historyData?.pedidos && historyData.pedidos.length > 0 ? (
              <div className="space-y-2">
                {historyData.pedidos.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card/50 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{getTimeAgo(order.fecha)}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[9px] h-4 px-1.5 font-medium border-0",
                            order.estado === "entregado" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                            order.estado === "cancelado" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                          )}
                        >
                          {order.estado === "entregado" ? "Entregado" : "Cancelado"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {order.items.length} {order.items.length === 1 ? "item" : "items"}
                        {order.clienteNombre && ` · ${order.clienteNombre}`}
                      </p>
                    </div>
                    <span className="text-xs font-bold shrink-0">{formatPrice(order.total)}</span>
                  </div>
                ))}
                {historyData.pagination.total > 50 && (
                  <p className="text-[10px] text-muted-foreground text-center pt-1">
                    Mostrando los últimos 50 de {historyData.pagination.total} pedidos
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No hay pedidos anteriores</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

// ============================================
// Empleados Section
// ============================================
function EmpleadosSection({ negocio, slug }: { negocio: SalonTabProps["negocio"]; slug: string }) {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copiedMozoId, setCopiedMozoId] = useState<string | null>(null)
  const [regeneratingMozoId, setRegeneratingMozoId] = useState<string | null>(null)

  const [formNombre, setFormNombre] = useState("")
  const [formCodigo, setFormCodigo] = useState("")

  const [editNombre, setEditNombre] = useState("")
  const [editCodigo, setEditCodigo] = useState("")

  const { data: empleados, isLoading: empleadosLoading } = useQuery<Empleado[]>({
    queryKey: ["empleados", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/empleados")
      if (!res.ok) throw new Error("Error cargando mozos")
      return res.json()
    },
  })

  // Fetch mesas to show assigned mesas per mozo
  const { data: mesas = [] } = useQuery<Mesa[]>({
    queryKey: ["mesas", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/mesas")
      if (!res.ok) throw new Error("Error cargando mesas")
      return res.json()
    },
  })

  // Fetch mozo stats
  const { data: mozoStatsData } = useQuery<{ stats: Array<{ id: string; nombre: string; codigo: string; totalPedidos: number; pedidosHoy: number; pedidosSemana: number; totalRevenue: number }> }>({
    queryKey: ["mozo-stats", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/mozos/stats")
      if (!res.ok) throw new Error("Error cargando estadísticas")
      return res.json()
    },
    refetchInterval: 15000,
  })

  // Build map of empleadoId → assigned mesa numbers
  const mozoMesasMap = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const mesa of mesas) {
      if (mesa.empleadoId) {
        if (!map.has(mesa.empleadoId)) map.set(mesa.empleadoId, [])
        map.get(mesa.empleadoId)!.push(mesa.numero)
      }
    }
    return map
  }, [mesas])

  const addMutation = useMutation({
    mutationFn: async (data: { nombre: string; codigo: string; rol: string }) => {
      const res = await fetch("/api/negocio/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error creando mozo")
      }
      return res.json()
    },
    onSuccess: (newEmpleado) => {
      queryClient.setQueryData<Empleado[]>(["empleados", negocio.id], (old) =>
        old ? [...old, newEmpleado] : [newEmpleado]
      )
      queryClient.invalidateQueries({ queryKey: ["empleados", negocio.id] })
      toast.success("Mozo creado correctamente")
      resetAddForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const editMutation = useMutation({
    mutationFn: async (data: { id: string; nombre: string; codigo: string; rol: string }) => {
      const res = await fetch(`/api/negocio/empleados/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: data.nombre, codigo: data.codigo, rol: data.rol }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error actualizando mozo")
      }
      return res.json()
    },
    onSuccess: (updatedEmpleado) => {
      queryClient.setQueryData<Empleado[]>(["empleados", negocio.id], (old) =>
        old ? old.map((e) => e.id === updatedEmpleado.id ? updatedEmpleado : e) : []
      )
      queryClient.invalidateQueries({ queryKey: ["empleados", negocio.id] })
      toast.success("Mozo actualizado")
      setEditingId(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/empleados/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando mozo")
      return res.json()
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<Empleado[]>(["empleados", negocio.id], (old) =>
        old ? old.filter((e) => e.id !== deletedId) : []
      )
      queryClient.invalidateQueries({ queryKey: ["empleados", negocio.id] })
      toast.success("Mozo eliminado")
      setDeleteConfirm(null)
    },
    onError: () => {
      toast.error("Error al eliminar el mozo")
    },
  })

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const res = await fetch(`/api/negocio/empleados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo }),
      })
      if (!res.ok) throw new Error("Error actualizando mozo")
      return res.json()
    },
    onSuccess: (updatedEmpleado) => {
      queryClient.setQueryData<Empleado[]>(["empleados", negocio.id], (old) =>
        old ? old.map((e) => e.id === updatedEmpleado.id ? updatedEmpleado : e) : []
      )
      queryClient.invalidateQueries({ queryKey: ["empleados", negocio.id] })
    },
    onError: () => {
      toast.error("Error al actualizar el mozo")
    },
  })

  const regenerateMozoTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/empleados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateToken: true }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error regenerando link")
      }
      return res.json() as Promise<Empleado>
    },
    onMutate: (id) => {
      setRegeneratingMozoId(id)
    },
    onSuccess: async (updatedEmpleado) => {
      queryClient.setQueryData<Empleado[]>(["empleados", negocio.id], (old) =>
        old ? old.map((e) => e.id === updatedEmpleado.id ? updatedEmpleado : e) : []
      )

      if (!updatedEmpleado.token) {
        toast.success("Link del mozo regenerado")
        return
      }

      try {
        await navigator.clipboard.writeText(`${window.location.origin}/m/${updatedEmpleado.token}`)
        setCopiedMozoId(updatedEmpleado.id)
        toast.success("Link del mozo regenerado y copiado")
        setTimeout(() => setCopiedMozoId(null), 2000)
      } catch {
        toast.success("Link del mozo regenerado")
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
    onSettled: () => {
      setRegeneratingMozoId(null)
    },
  })

  const resetAddForm = () => {
    setFormNombre("")
    setFormCodigo("")
    setShowAddForm(false)
  }

  const copyMozoLink = async (empleadoToken: string | null, mozoId: string) => {
    if (!empleadoToken) {
      toast.error("Este mozo no tiene un link generado. Intentá crearlo de nuevo.")
      return
    }
    const url = `${window.location.origin}/m/${empleadoToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedMozoId(mozoId)
      toast.success("Link del mozo copiado")
      setTimeout(() => setCopiedMozoId(null), 2000)
    } catch {
      toast.error("No se pudo copiar el link")
    }
  }

  const handleAddEmpleado = () => {
    if (!formNombre.trim()) {
      toast.error("Ingresá el nombre del mozo")
      return
    }
    if (!formCodigo.trim()) {
      toast.error("Ingresá el código del mozo")
      return
    }
    addMutation.mutate({
      nombre: formNombre.trim(),
      codigo: formCodigo.trim(),
      rol: "mozo",
    })
  }

  const startEditing = (empleado: Empleado) => {
    setEditingId(empleado.id)
    setEditNombre(empleado.nombre)
    setEditCodigo(empleado.codigo)
  }

  const handleSaveEdit = (id: string) => {
    if (!editNombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    if (!editCodigo.trim()) {
      toast.error("El código es obligatorio")
      return
    }
    editMutation.mutate({
      id,
      nombre: editNombre.trim(),
      codigo: editCodigo.trim(),
      rol: "mozo",
    })
  }

  if (empleadosLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {!showAddForm ? (
          <motion.div key="add-button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl gap-2 border-dashed font-semibold"
              style={{ borderColor: `${negocio.colorPrincipal}40`, color: negocio.colorPrincipal }}
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4" />
              Agregar mozo
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="add-form"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-3"
          >
            <p className="text-xs font-semibold">Nuevo mozo</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Nombre *</Label>
                <Input
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                  placeholder="Juan Pérez"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Código *</Label>
                <Input
                  value={formCodigo}
                  onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
                  className="rounded-xl h-8 text-sm font-mono"
                  placeholder="JUAN"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-xl gap-1.5 font-semibold h-7 text-xs flex-1"
                style={{ backgroundColor: negocio.colorPrincipal }}
                onClick={handleAddEmpleado}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Crear mozo
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={resetAddForm} disabled={addMutation.isPending}>
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {empleados && empleados.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {empleados.map((empleado) => {
            const assignedMesas = mozoMesasMap.get(empleado.id) ?? []
            const stats = mozoStatsData?.stats?.find((s) => s.id === empleado.id)
            const totalPedidos = stats?.totalPedidos ?? 0
            const pedidosHoy = stats?.pedidosHoy ?? 0
            const mozoLink = empleado.token ? `/m/${empleado.token}` : null
            const hasMozoLinkMetadata = !!mozoLink || !!empleado.tokenMasked
            const hasFullMozoToken = !!empleado.token
            const isRegeneratingMozo = regeneratingMozoId === empleado.id

            return (
              <motion.div
                key={empleado.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-3 rounded-xl border transition-colors",
                  empleado.activo
                    ? "border-border/50 bg-background"
                    : "border-border/30 bg-muted/30 opacity-60"
                )}
              >
                {editingId === empleado.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] font-semibold mb-1 block">Nombre</Label>
                        <Input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="rounded-xl h-7 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold mb-1 block">Código</Label>
                        <Input
                          value={editCodigo}
                          onChange={(e) => setEditCodigo(e.target.value.toUpperCase())}
                          className="rounded-xl h-7 text-sm font-mono"
                          maxLength={10}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl gap-1.5 font-semibold h-7 text-xs"
                        style={{ backgroundColor: negocio.colorPrincipal }}
                        onClick={() => handleSaveEdit(empleado.id)}
                        disabled={editMutation.isPending}
                      >
                        {editMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Guardar
                      </Button>
                      <Button
                        size="sm" variant="outline" className="rounded-xl h-7 text-xs gap-1.5"
                        onClick={() => setEditingId(null)}
                        disabled={editMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: empleado.activo ? `${negocio.colorPrincipal}15` : "transparent",
                        color: empleado.activo ? negocio.colorPrincipal : "hsl(var(--muted-foreground))",
                        border: empleado.activo ? "none" : "1px solid hsl(var(--border))",
                      }}
                      onClick={() => startEditing(empleado)}
                      title="Editar mozo"
                    >
                      {empleado.codigo.substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{empleado.nombre}</p>
                        <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5">
                          {empleado.codigo}
                        </Badge>
                        {assignedMesas.length > 0 && (
                          <Badge className="text-[9px] h-4 px-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                            {assignedMesas.length} {assignedMesas.length === 1 ? "mesa" : "mesas"}
                          </Badge>
                        )}
                      </div>
                      {/* Assigned mesa numbers */}
                      {assignedMesas.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Armchair className="h-3 w-3 text-muted-foreground/50" />
                          {assignedMesas.sort((a, b) => a - b).map((num) => (
                            <span key={num} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground">
                              {num}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Mozo stats */}
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                          <span className={cn(
                            "text-[11px] font-semibold",
                            totalPedidos > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                          )}>
                            {totalPedidos} {totalPedidos === 1 ? "pedido" : "pedidos"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flame className={cn("h-3 w-3", pedidosHoy > 0 ? "text-orange-500" : "text-muted-foreground/50")} />
                          <span className={cn(
                            "text-[11px] font-semibold",
                            pedidosHoy > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                          )}>
                            {pedidosHoy} hoy
                          </span>
                        </div>
                      </div>
                      {/* Mozo link with copy button */}
                      {hasMozoLinkMetadata ? (
                        <div className="space-y-1 mt-1.5">
                          <div className="flex items-center gap-1.5">
                            <Link2 className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-[10px] text-muted-foreground/70 truncate max-w-[140px]">
                              {mozoLink ?? "Link oculto por seguridad. Regeneralo para obtener uno nuevo."}
                              {!mozoLink && empleado.tokenMasked ? ` (${empleado.tokenMasked})` : ""}
                            </span>
                            <button
                              onClick={() => {
                                if (hasFullMozoToken) {
                                  copyMozoLink(empleado.token, empleado.id)
                                  return
                                }
                                regenerateMozoTokenMutation.mutate(empleado.id)
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors shrink-0"
                              title={hasFullMozoToken ? "Copiar link del mozo" : "Regenerar link del mozo"}
                              disabled={isRegeneratingMozo}
                            >
                              {isRegeneratingMozo ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : copiedMozoId === empleado.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : hasFullMozoToken ? (
                                <Copy className="h-3 w-3" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              {isRegeneratingMozo
                                ? "Regenerando"
                                : copiedMozoId === empleado.id
                                  ? "Copiado"
                                  : hasFullMozoToken
                                    ? "Copiar"
                                    : "Regenerar"}
                            </button>
                          </div>

                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Link2 className="h-3 w-3 text-muted-foreground/30" />
                          <span className="text-[10px] text-muted-foreground/40">Sin link generado</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={cn("text-[9px] h-4 px-1.5 border-0", roleColor(empleado.rol))}>
                          {roleLabel(empleado.rol)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => toggleActivoMutation.mutate({ id: empleado.id, activo: !empleado.activo })}
                        title={empleado.activo ? "Desactivar" : "Activar"}
                        disabled={toggleActivoMutation.isPending}
                      >
                        {empleado.activo ? (
                          <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Power className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </Button>
                      {deleteConfirm === empleado.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon" variant="ghost"
                            className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteMutation.mutate(empleado.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => setDeleteConfirm(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500"
                          onClick={() => setDeleteConfirm(empleado.id)}
                          title="Eliminar mozo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          No hay mozos registrados. Agregá tu primer mozo.
        </p>
      )}
    </div>
  )
}

// ============================================
// Helpers
// ============================================
function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "Ahora"
  if (diffMins < 60) return `${diffMins} min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  return `${Math.floor(diffHours / 24)}d`
}

// ============================================
// Skeleton
// ============================================
function SalonSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-4 space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
