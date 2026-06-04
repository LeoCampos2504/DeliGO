"use client"

import {
  Store,
  Clock,
  AlertTriangle,
  DollarSign,
  Users,
  Bike,
  Package,
  TrendingUp,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatPrice } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface DashboardData {
  stats?: {
    pendientes: number
    activos: number
    alertas: number
    deudaTotal: number
    negociosConDeuda: number
    totalRepartidores: number
    totalClientes: number
    totalPedidosEntregados: number
  }
  pendientes?: unknown[]
  activos?: unknown[]
  conAlerta?: unknown[]
}

interface OverviewTabProps {
  data: DashboardData | undefined
  isLoading: boolean
}

// ============================================
// Overview Tab
// ============================================
export function OverviewTab({ data, isLoading }: OverviewTabProps) {
  if (isLoading) return <OverviewSkeleton />

  const stats = data?.stats

  const cards = [
    {
      icon: Clock,
      label: "Pendientes de aprobación",
      value: stats?.pendientes ?? 0,
      color: "amber",
      bgColor: "bg-amber-500/10",
      textColor: "text-amber-700 dark:text-amber-300",
      iconColor: "text-amber-500",
    },
    {
      icon: Store,
      label: "Negocios activos",
      value: stats?.activos ?? 0,
      color: "emerald",
      bgColor: "bg-emerald-500/10",
      textColor: "text-emerald-700 dark:text-emerald-300",
      iconColor: "text-emerald-500",
    },
    {
      icon: AlertTriangle,
      label: "Con alerta",
      value: stats?.alertas ?? 0,
      color: "red",
      bgColor: "bg-red-500/10",
      textColor: "text-red-700 dark:text-red-300",
      iconColor: "text-red-500",
    },
    {
      icon: DollarSign,
      label: "Deuda total plataforma",
      value: formatPrice(stats?.deudaTotal ?? 0),
      color: "blue",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-700 dark:text-blue-300",
      iconColor: "text-blue-500",
    },
  ]

  const secondaryCards = [
    {
      icon: Users,
      label: "Clientes registrados",
      value: stats?.totalClientes ?? 0,
    },
    {
      icon: Bike,
      label: "Repartidores",
      value: stats?.totalRepartidores ?? 0,
    },
    {
      icon: Package,
      label: "Pedidos entregados",
      value: stats?.totalPedidosEntregados ?? 0,
    },
    {
      icon: TrendingUp,
      label: "Negocios con deuda",
      value: stats?.negociosConDeuda ?? 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Main stats */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={cn(
                "rounded-2xl p-4 border border-border/30",
                card.bgColor
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-5 w-5", card.iconColor)} />
                <span className={cn("text-xs font-medium", card.textColor)}>
                  {card.label}
                </span>
              </div>
              <p className={cn("text-2xl font-bold", card.textColor)}>
                {card.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Secondary stats */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Métricas generales</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {secondaryCards.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.label}
                className="rounded-xl bg-muted/40 p-3 text-center"
              >
                <Icon className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
                <p className="text-lg font-bold">{card.value}</p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl bg-card border border-border/50 p-4">
        <h3 className="font-semibold text-sm mb-3">Acciones rápidas</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 text-center">
            <p className="font-bold text-amber-700 dark:text-amber-300">{stats?.pendientes ?? 0}</p>
            <p className="text-xs text-muted-foreground">Por aprobar</p>
          </div>
          <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-3 text-center">
            <p className="font-bold text-red-700 dark:text-red-300">{stats?.alertas ?? 0}</p>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-4 bg-muted/30 animate-pulse">
            <div className="h-4 w-20 rounded bg-muted/50 mb-2" />
            <div className="h-8 w-16 rounded bg-muted/50" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-muted/30 p-3 animate-pulse">
            <div className="h-5 w-5 rounded-full bg-muted/50 mx-auto mb-1" />
            <div className="h-6 w-10 rounded bg-muted/50 mx-auto mb-1" />
            <div className="h-3 w-16 rounded bg-muted/30 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
