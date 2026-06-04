"use client"

import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  ShoppingCart,
  Clock,
  Package,
  Star,
  Plus,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn, formatPrice, timeAgo } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface DashboardTabProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
  onNavigate?: (tab: string) => void
}

interface DashboardData {
  pedidosHoy: number
  ingresosHoy: number
  pedidosPendientes: number
  productosTotales: number
  puntuacionPromedio: number
  deudaTarifa: number
  limiteDeuda: number
  pedidosRecientes: RecentOrder[]
}

interface RecentOrder {
  id: string
  clienteNombre: string
  total: number
  estado: string
  metodoEntrega: string
  metodoPago: string
  fecha: string
  items: { nombre: string; cantidad: number }[]
}

// ============================================
// Dashboard Tab Component
// ============================================
export function DashboardTab({ negocio, onNavigate }: DashboardTabProps) {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["negocio-dashboard", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/dashboard?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando dashboard")
      const json = await res.json()
      const raw = json.data ?? json
      // Map API response safely — handle both old and new format
      return {
        pedidosHoy: Number(raw.pedidosHoy ?? raw.stats?.pedidosHoy?.count ?? 0),
        ingresosHoy: Number(raw.ingresosHoy ?? raw.stats?.pedidosHoy?.total ?? 0),
        pedidosPendientes: Number(raw.pedidosPendientes ?? raw.stats?.pedidosPendientes ?? 0),
        productosTotales: Number(raw.productosTotales ?? raw.stats?.productosTotal ?? 0),
        puntuacionPromedio: Number(raw.puntuacionPromedio ?? 0),
        deudaTarifa: Number(raw.deudaTarifa ?? raw.stats?.deudaTarifa ?? 0),
        limiteDeuda: Number(raw.limiteDeuda ?? raw.stats?.limiteDeuda ?? 10000),
        pedidosRecientes: Array.isArray(raw.pedidosRecientes ?? raw.recentOrders)
          ? (raw.pedidosRecientes ?? raw.recentOrders).map((o: any) => ({
              id: String(o.id ?? ""),
              clienteNombre: String(o.clienteNombre ?? "Cliente"),
              total: Number(o.total ?? 0),
              estado: String(o.estado ?? ""),
              metodoEntrega: String(o.metodoEntrega ?? ""),
              metodoPago: String(o.metodoPago ?? ""),
              fecha: String(o.fecha ?? new Date().toISOString()),
              items: Array.isArray(o.items) ? o.items : [],
            }))
          : [],
      } as DashboardData
    },
    refetchInterval: 30000,
  })

  if (isLoading) {
    return <DashboardSkeleton />
  }

  const d = data ?? {
    pedidosHoy: 0,
    ingresosHoy: 0,
    pedidosPendientes: 0,
    productosTotales: 0,
    puntuacionPromedio: 0,
    deudaTarifa: 0,
    limiteDeuda: 10000,
    pedidosRecientes: [],
  }

  const deudaRatio = d.limiteDeuda ? (d.deudaTarifa / d.limiteDeuda) * 100 : 0
  const deudaColor = deudaRatio >= 100
    ? "destructive"
    : deudaRatio > 80
    ? "orange"
    : deudaRatio > 50
    ? "amber"
    : "primary"
  const isBlocked = d.limiteDeuda !== null && deudaRatio >= 100

  return (
    <div className="space-y-5">
      {/* ===== STATS GRID ===== */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<ShoppingCart className="h-5 w-5" style={{ color: negocio.colorPrincipal }} />}
          label="Entregados hoy"
          value={d.pedidosHoy.toString()}
          subtext={formatPrice(d.ingresosHoy)}
          color={negocio.colorPrincipal}
          delay={0}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          label="Pendientes"
          value={d.pedidosPendientes.toString()}
          pulse={d.pedidosPendientes > 0}
          color="#F97316"
          delay={0.05}
        />
        <StatCard
          icon={<Package className="h-5 w-5 text-teal-600" />}
          label="Productos"
          value={d.productosTotales.toString()}
          color="#0D9488"
          delay={0.1}
        />
        <StatCard
          icon={<Star className="h-5 w-5 text-amber-500" />}
          label="Puntuación"
          value={d.puntuacionPromedio > 0 ? d.puntuacionPromedio.toFixed(1) : "—"}
          subtext={d.puntuacionPromedio > 0 ? "promedio" : "sin reseñas"}
          color="#F59E0B"
          delay={0.15}
          stars={d.puntuacionPromedio}
        />
      </div>

      {/* ===== DEUDA INDICATOR ===== */}
      {d.deudaTarifa > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className={cn(
            "rounded-2xl overflow-hidden",
            isBlocked ? "border-red-500/30" : "border-border/50"
          )}>
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isBlocked ? (
                    <Lock className="h-4 w-4 text-destructive" />
                  ) : (
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold">Deuda de tarifa</span>
                </div>
                {isBlocked && (
                  <Badge variant="destructive" className="text-[10px] font-bold animate-pulse">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    BLOQUEADO
                  </Badge>
                )}
              </div>

              {/* Amount + Progress */}
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-bold">{formatPrice(d.deudaTarifa)}</span>
                <span className="text-sm text-muted-foreground">
                  / {formatPrice(d.limiteDeuda)}
                </span>
              </div>

              <div className="relative mb-3">
                <Progress
                  value={Math.min(deudaRatio, 100)}
                  className={cn(
                    "h-2.5 rounded-full",
                    deudaRatio >= 100
                      ? "[&_[data-slot=progress-indicator]]:bg-destructive"
                      : deudaRatio > 80
                      ? "[&_[data-slot=progress-indicator]]:bg-orange-500"
                      : deudaRatio > 50
                      ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                      : undefined
                  )}
                />
                <span className="absolute right-0 -top-5 text-xs font-semibold text-muted-foreground">
                  {deudaRatio.toFixed(0)}%
                </span>
              </div>

              {/* Payment info */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Datos para el pago:</p>
                <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Alias</span>
                    <span className="text-sm font-bold">Deligo.bru</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Nombre</span>
                    <span className="text-xs font-semibold">LEONARDO FABIAN CAMPOS</span>
                  </div>
                </div>

                <a
                  href="https://wa.me/5493886418011"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2.5"
                >
                  <Button
                    className="w-full gap-2 rounded-xl h-10 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Enviar comprobante por WhatsApp
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ===== RECENT ORDERS ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">Pedidos recientes</h3>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>

        {d.pedidosRecientes.length === 0 ? (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 text-center">
              <span className="text-4xl block mb-2">📦</span>
              <p className="text-sm text-muted-foreground">
                Todavía no tenés pedidos
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {d.pedidosRecientes.slice(0, 5).map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ===== QUICK ACTIONS ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="grid grid-cols-3 gap-3">
          <Button
            className="rounded-xl h-12 gap-2 font-semibold"
            style={{ backgroundColor: negocio.colorPrincipal }}
            onClick={() => onNavigate?.("productos")}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar</span>
          </Button>
          <Button variant="outline" className="rounded-xl h-12 gap-2 font-semibold" onClick={() => onNavigate?.("ventas")}>
            <TrendingUp className="h-4 w-4" />
            Ventas
          </Button>
          <Button variant="outline" className="rounded-xl h-12 gap-2 font-semibold" onClick={() => onNavigate?.("pedidos")}>
            <ShoppingCart className="h-4 w-4" />
            Pedidos
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// ============================================
// Stat Card
// ============================================
function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
  pulse,
  stars,
  delay,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtext?: string
  color: string
  pulse?: boolean
  stars?: number
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="rounded-2xl border-border/50 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
              {icon}
            </div>
            {pulse && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
              </span>
            )}
          </div>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {subtext && (
            <p className="text-xs font-semibold mt-0.5" style={{ color }}>
              {subtext}
            </p>
          )}
          {stars !== undefined && stars > 0 && (
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-3 w-3",
                    i < Math.round(stars)
                      ? "fill-amber-400 text-amber-400"
                      : "fill-muted text-muted"
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Order Row
// ============================================
function OrderRow({ order }: { order: RecentOrder }) {
  return (
    <Card className="rounded-xl border-border/50 hover:shadow-sm transition-shadow">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold truncate">{order.clienteNombre}</span>
            <StatusBadge status={order.estado} className="text-[10px] px-1.5 py-0" showEmoji={false} />
          </div>
          <p className="text-xs text-muted-foreground">{timeAgo(new Date(order.fecha))}</p>
        </div>
        <span className="text-sm font-bold shrink-0">{formatPrice(order.total)}</span>
      </CardContent>
    </Card>
  )
}

// ============================================
// Skeleton
// ============================================
function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-2xl border-border/50">
            <CardContent className="p-4">
              <Skeleton className="h-8 w-8 rounded-lg mb-2" />
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </CardContent>
      </Card>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="rounded-xl border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
