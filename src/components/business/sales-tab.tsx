"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
} from "recharts"
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Package,
  Truck,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Minus,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn, formatPrice } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface SalesTabProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
}

interface AnalyticsData {
  dailyData: { date: string; revenue: number; orders: number }[]
  topProducts: { nombre: string; cantidad: number; ingresos: number; pedidos: number }[]
  paymentDistribution: { metodo: string; label: string; cantidad: number; ingresos: number }[]
  deliveryDistribution: { metodo: string; label: string; cantidad: number; ingresos: number }[]
  hourlyData: { hour: number; label: string; pedidos: number }[]
  weeklyData: { day: string; label: string; pedidos: number; ingresos: number }[]
  metrics: {
    totalRevenue: number
    totalOrders: number
    avgTicket: number
    bestDay: { date: string; revenue: number } | null
    revenueChange: number
    ordersChange: number
    prevRevenue: number
    prevOrders: number
  }
}

type Period = 7 | 15 | 30 | 90

// ============================================
// Chart configs
// ============================================
const revenueChartConfig: ChartConfig = {
  revenue: {
    label: "Ingresos",
    color: "var(--color-primary, #FB8C00)",
  },
}

const ordersChartConfig: ChartConfig = {
  orders: {
    label: "Pedidos",
    color: "var(--color-primary, #FB8C00)",
  },
}

const hourlyChartConfig: ChartConfig = {
  pedidos: {
    label: "Pedidos",
    color: "var(--color-primary, #FB8C00)",
  },
}

const weeklyChartConfig: ChartConfig = {
  pedidos: {
    label: "Pedidos",
    color: "var(--color-primary, #FB8C00)",
  },
  ingresos: {
    label: "Ingresos",
    color: "#10B981",
  },
}

// ============================================
// Sales Tab Component
// ============================================
export function SalesTab({ negocio }: SalesTabProps) {
  const [period, setPeriod] = useState<Period>(30)
  const color = negocio.colorPrincipal

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["negocio-analytics", negocio.id, period],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/analytics?negocioId=${negocio.id}&days=${period}`)
      if (!res.ok) throw new Error("Error cargando analytics")
      const json = await res.json()
      return json.data
    },
    refetchInterval: 60000,
  })

  if (isLoading) return <SalesSkeleton />

  const d = data ?? {
    dailyData: [],
    topProducts: [],
    paymentDistribution: [],
    deliveryDistribution: [],
    hourlyData: [],
    weeklyData: [],
    metrics: {
      totalRevenue: 0, totalOrders: 0, avgTicket: 0,
      bestDay: null, revenueChange: 0, ordersChange: 0,
      prevRevenue: 0, prevOrders: 0,
    },
  }

  const hasData = d.metrics.totalOrders > 0

  // Format daily data for charts
  const dailyChartData = d.dailyData.map((item) => ({
    ...item,
    dateLabel: formatDateShort(item.date),
  }))

  return (
    <div className="space-y-5">
      {/* ===== PERIOD SELECTOR ===== */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Historial de ventas</h2>
        <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
          {([7, 15, 30, 90] as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "ghost"}
              className={cn(
                "h-7 px-2.5 text-xs font-semibold rounded-lg",
                period === p && "shadow-sm"
              )}
              style={period === p ? { backgroundColor: color } : undefined}
              onClick={() => setPeriod(p)}
            >
              {p}d
            </Button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-8 text-center">
            <span className="text-4xl block mb-3">📊</span>
            <p className="font-semibold text-base mb-1">Sin datos de ventas</p>
            <p className="text-sm text-muted-foreground">
              Los gráficos aparecerán cuando tengas pedidos entregados en este período
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ===== KEY METRICS ===== */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Ingresos totales"
              value={formatPrice(d.metrics.totalRevenue)}
              change={d.metrics.revenueChange}
              color={color}
              delay={0}
            />
            <MetricCard
              icon={<ShoppingCart className="h-4 w-4" />}
              label="Pedidos entregados"
              value={d.metrics.totalOrders.toString()}
              change={d.metrics.ordersChange}
              color={color}
              delay={0.05}
            />
            <MetricCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Ticket promedio"
              value={formatPrice(d.metrics.avgTicket)}
              color={color}
              delay={0.1}
            />
            <MetricCard
              icon={<Trophy className="h-4 w-4" />}
              label="Mejor día"
              value={d.metrics.bestDay ? formatPrice(d.metrics.bestDay.revenue) : "—"}
              subtext={d.metrics.bestDay ? formatDateLong(d.metrics.bestDay.date) : undefined}
              color={color}
              delay={0.15}
            />
          </div>

          {/* ===== REVENUE CHART ===== */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                      <DollarSign className="h-4 w-4" style={{ color }} />
                    </div>
                    <span className="text-sm font-semibold">Ingresos por día</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Período anterior: {formatPrice(d.metrics.prevRevenue)}</span>
                </div>
                <ChartContainer config={revenueChartConfig} className="h-[200px] w-full" style={{ "--color-revenue": color } as React.CSSProperties}>
                  <AreaChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      interval={period <= 15 ? 1 : Math.floor(period / 7)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatPrice(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={color}
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: color }}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* ===== ORDERS CHART ===== */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                    <ShoppingCart className="h-4 w-4" style={{ color }} />
                  </div>
                  <span className="text-sm font-semibold">Pedidos por día</span>
                </div>
                <ChartContainer config={ordersChartConfig} className="h-[180px] w-full" style={{ "--color-orders": color } as React.CSSProperties}>
                  <BarChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      interval={period <= 15 ? 1 : Math.floor(period / 7)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="orders" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* ===== TWO COLUMN: HOURLY + WEEKLY ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Hourly distribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="rounded-2xl border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-teal-500/10">
                      <Clock className="h-4 w-4 text-teal-600" />
                    </div>
                    <span className="text-sm font-semibold">Horarios pico</span>
                  </div>
                  <ChartContainer config={hourlyChartConfig} className="h-[180px] w-full" style={{ "--color-pedidos": color } as React.CSSProperties}>
                    <BarChart data={d.hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                        interval={2}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="pedidos" radius={[3, 3, 0, 0]} maxBarSize={16}>
                        {d.hourlyData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.pedidos > 0 ? color : `${color}20`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Weekly distribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="rounded-2xl border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-violet-500/10">
                      <Calendar className="h-4 w-4 text-violet-600" />
                    </div>
                    <span className="text-sm font-semibold">Ventas por día</span>
                  </div>
                  <ChartContainer config={weeklyChartConfig} className="h-[180px] w-full">
                    <BarChart data={d.weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="pedidos" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ===== TWO COLUMN: TOP PRODUCTS + PAYMENT/DELIVERY ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Top products */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="rounded-2xl border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-amber-500/10">
                      <Package className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="text-sm font-semibold">Productos más vendidos</span>
                  </div>
                  {d.topProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
                      {d.topProducts.map((product, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span
                            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{
                              backgroundColor: i < 3 ? color : "hsl(var(--muted))",
                              color: i < 3 ? "white" : "hsl(var(--muted-foreground))",
                            }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.nombre}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {product.cantidad} vendidos · {product.pedidos} pedidos
                            </p>
                          </div>
                          <span className="text-sm font-semibold shrink-0">
                            {formatPrice(product.ingresos)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Payment + Delivery distribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Card className="rounded-2xl border-border/50">
                <CardContent className="p-4 space-y-5">
                  {/* Payment methods */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold">Métodos de pago</span>
                    </div>
                    {d.paymentDistribution.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">Sin datos</p>
                    ) : (
                      <div className="space-y-2">
                        {d.paymentDistribution.map((item) => {
                          const pct = d.metrics.totalOrders > 0
                            ? Math.round((item.cantidad / d.metrics.totalOrders) * 100)
                            : 0
                          return (
                            <div key={item.metodo}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">{item.label}</span>
                                <span className="text-xs text-muted-foreground">{pct}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: color,
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Delivery methods */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-blue-500/10">
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold">Métodos de entrega</span>
                    </div>
                    {d.deliveryDistribution.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">Sin datos</p>
                    ) : (
                      <div className="space-y-2">
                        {d.deliveryDistribution.map((item) => {
                          const pct = d.metrics.totalOrders > 0
                            ? Math.round((item.cantidad / d.metrics.totalOrders) * 100)
                            : 0
                          return (
                            <div key={item.metodo}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">{item.label}</span>
                                <span className="text-xs text-muted-foreground">{pct}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: color,
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// Metric Card
// ============================================
function MetricCard({
  icon,
  label,
  value,
  subtext,
  change,
  color,
  delay,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtext?: string
  change?: number
  color: string
  delay: number
}) {
  const changePositive = change !== undefined && change > 0
  const changeNegative = change !== undefined && change < 0

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
            {change !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                  changePositive && "bg-emerald-500/10 text-emerald-600",
                  changeNegative && "bg-red-500/10 text-red-600",
                  !changePositive && !changeNegative && "bg-muted/60 text-muted-foreground"
                )}
              >
                {changePositive && <ArrowUpRight className="h-3 w-3" />}
                {changeNegative && <ArrowDownRight className="h-3 w-3" />}
                {!changePositive && !changeNegative && <Minus className="h-3 w-3" />}
                {changePositive && "+"}{change}%
              </div>
            )}
          </div>
          <p className="text-xl font-bold leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          {subtext && (
            <p className="text-[11px] font-medium mt-0.5" style={{ color }}>
              {subtext}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Helpers
// ============================================
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
}

// ============================================
// Skeleton
// ============================================
function SalesSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-2xl border-border/50">
            <CardContent className="p-4">
              <Skeleton className="h-6 w-6 rounded-lg mb-2" />
              <Skeleton className="h-7 w-24 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-5 w-32 mb-3" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-5 w-28 mb-3" />
          <Skeleton className="h-[180px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )
}
