"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Star,
  Settings,
  Sparkles,
  Zap,
  LogOut,
  Eye,
  BarChart3,
  UtensilsCrossed,
  Shirt,
  DoorOpen,
  DoorClosed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Logo } from "@/components/shared/logo"
import { NotificationBell } from "@/components/shared/notification-center"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import type { NotificationItem } from "@/store/notification-store"
import { DashboardTab } from "./dashboard-tab"
import { ProductsTab } from "./products-tab"
import { OrdersTab } from "./orders-tab"
import { ConfigTab } from "./config-tab"
import { ReviewsTab } from "./reviews-tab"
import { SalesTab } from "./sales-tab"
import { SalonTab } from "./salon-tab"

// ============================================
// Types
// ============================================
export type PanelMode = "simple" | "expert"
export type PanelTab = "dashboard" | "ventas" | "productos" | "pedidos" | "resenas" | "salon" | "config"

/** Shared query key so child components can invalidate tab counts */
export const TAB_COUNTS_KEY = "negocio-tab-counts"

interface BusinessPanelProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
    aprobado: boolean
    horarioMode?: string
    abiertoManual?: boolean
  }
}

// Tab items are now dynamic based on rubro - see getTabItems() below
function getTabItems(rubro: string): { id: PanelTab; label: string; icon: typeof LayoutDashboard }[] {
  const isRopa = rubro === "ropa"
  const isNegocio = rubro === "negocio"
  const items: { id: PanelTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "ventas", label: "Ventas", icon: BarChart3 },
    { id: "productos", label: isRopa ? "Prendas" : "Productos", icon: isRopa ? Shirt : Package },
    { id: "pedidos", label: "Pedidos", icon: ClipboardList },
    { id: "resenas", label: "Reseñas", icon: Star },
  ]
  // Only show Salon tab for restaurants
  if (!isRopa && !isNegocio) {
    items.push({ id: "salon", label: "Salón", icon: UtensilsCrossed })
  }
  items.push({ id: "config", label: "Config", icon: Settings })
  return items
}

// ============================================
// Main Business Panel
// ============================================
export function BusinessPanel({ negocio }: BusinessPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("dashboard")
  const [mode, setMode] = useState<PanelMode>("simple")
  const [modeLoaded, setModeLoaded] = useState(false)
  const [horarioMode, setHorarioMode] = useState(negocio.horarioMode ?? "experto")
  const [abiertoManual, setAbiertoManual] = useState(negocio.abiertoManual !== false)
  const { logout } = useAuth()
  const queryClient = useQueryClient()

  // Fetch negocio config to get accurate horarioMode/abiertoManual from the database
  const { data: configData } = useQuery({
    queryKey: ["negocio-config", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/config?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error")
      const json = await res.json()
      return json.data ?? json
    },
    staleTime: 0,
  })

  // Handle notification click → navigate to correct tab
  const handleNotificationNavigate = useCallback((tab: string, _notif: NotificationItem) => {
    // Map notification tab names to PanelTab
    const tabMap: Record<string, PanelTab> = {
      pedidos: "pedidos",
      resenas: "resenas",
      config: "config",
      dashboard: "dashboard",
      ventas: "ventas",
      productos: "productos",
      salon: "salon",
    }
    const target = tabMap[tab]
    if (target) setActiveTab(target)
  }, [])

  // Sync horario state with negocio prop changes AND config query data
  useEffect(() => {
    // Prefer configData (from negocio-config query) as it's the most authoritative source
    const sourceMode = configData?.horarioMode ?? negocio.horarioMode
    const sourceAbierto = configData?.abiertoManual ?? negocio.abiertoManual
    if (sourceMode !== undefined) setHorarioMode(sourceMode)
    if (sourceAbierto !== undefined) setAbiertoManual(sourceAbierto !== false)
  }, [configData?.horarioMode, configData?.abiertoManual, negocio.horarioMode, negocio.abiertoManual])

  // Handler for horario changes from config-tab or header toggle
  const handleHorarioChange = useCallback(async (changes: { horarioMode?: string; abiertoManual?: boolean }) => {
    if (changes.horarioMode !== undefined) setHorarioMode(changes.horarioMode)
    if (changes.abiertoManual !== undefined) setAbiertoManual(changes.abiertoManual)
    try {
      await fetch("/api/negocio/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      // Invalidate negocio-profile so page.tsx stays in sync
      queryClient.invalidateQueries({ queryKey: ["negocio-profile"] })
      queryClient.invalidateQueries({ queryKey: ["negocio-config"] })
    } catch {}
  }, [queryClient])

  // Tab counters — real-time via TanStack Query with fast polling
  // Child components (OrdersTab, ReviewsTab) also invalidate this query after mutations
  const { data: tabCounts } = useQuery({
    queryKey: [TAB_COUNTS_KEY, negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/dashboard/counts")
      if (!res.ok) return { activeOrders: 0, resenasSinRespuesta: 0 }
      return res.json() as Promise<{ activeOrders: number; resenasSinRespuesta: number }>
    },
    refetchInterval: 8000, // fast polling — new orders show up in ~8s
    staleTime: 0,
  })

  const activeOrders = tabCounts?.activeOrders ?? 0
  const resenasSinRespuesta = tabCounts?.resenasSinRespuesta ?? 0

  // Track badge count changes for bounce animation
  const prevOrdersRef = useRef(0)
  const prevResenasRef = useRef(0)
  const [ordersBounce, setOrdersBounce] = useState(false)
  const [resenasBounce, setResenasBounce] = useState(false)

  useEffect(() => {
    if (activeOrders > prevOrdersRef.current && prevOrdersRef.current !== 0) {
      setOrdersBounce(true)
      const t = setTimeout(() => setOrdersBounce(false), 600)
      return () => clearTimeout(t)
    }
    prevOrdersRef.current = activeOrders
  }, [activeOrders])

  useEffect(() => {
    if (resenasSinRespuesta > prevResenasRef.current && prevResenasRef.current !== 0) {
      setResenasBounce(true)
      const t = setTimeout(() => setResenasBounce(false), 600)
      return () => clearTimeout(t)
    }
    prevResenasRef.current = resenasSinRespuesta
  }, [resenasSinRespuesta])

  // Load panelMode from database on mount
  useEffect(() => {
    async function loadMode() {
      try {
        const res = await fetch("/api/negocio/dashboard")
        if (res.ok) {
          const json = await res.json()
          const saved = json.negocio?.panelMode ?? json.panelMode
          if (saved === "expert" || saved === "simple") {
            setMode(saved)
          }
        }
      } catch {
        // Fallback: try localStorage
        if (typeof window !== "undefined") {
          const local = localStorage.getItem("deligo-panel-mode")
          if (local === "expert" || local === "simple") {
            setMode(local)
          }
        }
      } finally {
        setModeLoaded(true)
      }
    }
    loadMode()
  }, [])

  // Handle URL tab parameter (from push notification click)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get("tab")
    if (tabParam) {
      const tabMap: Record<string, PanelTab> = {
        dashboard: "dashboard",
        ventas: "ventas",
        productos: "productos",
        pedidos: "pedidos",
        resenas: "resenas",
        salon: "salon",
        config: "config",
      }
      const target = tabMap[tabParam]
      if (target) {
        setActiveTab(target)
        // Clean URL without reload
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
  }, [])

  const handleModeChange = useCallback((newMode: PanelMode) => {
    setMode(newMode)
    // Save to database (fire and forget)
    fetch("/api/negocio/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelMode: newMode }),
    }).catch(() => {})
    // Also save to localStorage as quick fallback
    if (typeof window !== "undefined") {
      localStorage.setItem("deligo-panel-mode", newMode)
    }
  }, [])

  const rubroLabels: Record<string, string> = {
    restaurante: "Restaurante",
    ropa: "Indumentaria",
    negocio: "Negocio",
  }

  const tabItems = useMemo(() => getTabItems(negocio.rubro), [negocio.rubro])
  const isRopa = negocio.rubro === "ropa"
  const isNegocio = negocio.rubro === "negocio"
  // Mode toggle only makes sense for restaurantes (agregados, ingredientes, etc.)
  const showModeToggle = !isRopa && !isNegocio

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Top row: Logo + Actions */}
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-1.5">
              <NotificationBell onNavigate={handleNotificationNavigate} />
              {/* Simple mode: Open/Closed toggle */}
              {horarioMode === "simple" && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 rounded-full text-xs font-semibold transition-all",
                    abiertoManual
                      ? "border-emerald-500/40 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                      : "border-red-500/40 text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                  )}
                  onClick={() => handleHorarioChange({ abiertoManual: !abiertoManual })}
                  title={abiertoManual ? "Marcar como cerrado" : "Marcar como abierto"}
                >
                  {abiertoManual ? (
                    <><DoorOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline">Abierto</span></>
                  ) : (
                    <><DoorClosed className="h-3.5 w-3.5" /><span className="hidden sm:inline">Cerrado</span></>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => window.location.href = `/n/${negocio.slug}?preview=true`}
                title="Ver cómo ven los clientes tu catálogo"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vista previa</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={logout}
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Business info + Mode toggle */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg truncate">{negocio.nombre}</h1>
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px] font-semibold border-0"
                  style={{ backgroundColor: `${negocio.colorPrincipal}18`, color: negocio.colorPrincipal }}
                >
                  {isRopa ? <Shirt className="h-3 w-3 mr-0.5" /> : null}
                  {rubroLabels[negocio.rubro] || negocio.rubro}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">/{negocio.slug}</p>
            </div>

            {/* Mode toggle — only for restaurantes */}
            {showModeToggle && (
              <div className="flex items-center gap-2 shrink-0 bg-muted/60 rounded-full px-3 py-1.5">
                <Sparkles className={cn("h-3.5 w-3.5 transition-colors", mode === "simple" ? "text-primary" : "text-muted-foreground")} />
                <Switch
                  checked={mode === "expert"}
                  onCheckedChange={(checked) => handleModeChange(checked ? "expert" : "simple")}
                  className="scale-90"
                />
                <Zap className={cn("h-3.5 w-3.5 transition-colors", mode === "expert" ? "text-primary" : "text-muted-foreground")} />
              </div>
            )}
          </div>

          {/* Mode label with prominent badge — only for restaurantes */}
          {showModeToggle && (
            <div className="mt-1 flex items-center gap-2">
              {mode === "expert" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <Zap className="h-3 w-3" />
                  Modo Experto
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                  <Sparkles className="h-3 w-3" />
                  Modo Simple
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ===== TAB NAVIGATION ===== */}
      <div className="sticky top-[104px] z-30 bg-background/95 backdrop-blur-md border-b border-border/30">
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex gap-1 py-1.5 overflow-x-auto scrollbar-none" aria-label="Panel navigation">
            {tabItems.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const badgeCount = tab.id === "pedidos" ? activeOrders : tab.id === "resenas" ? resenasSinRespuesta : 0
              const isBouncing = tab.id === "pedidos" ? ordersBounce : tab.id === "resenas" ? resenasBounce : false
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {badgeCount > 0 && (
                    <motion.div
                      key={`badge-${tab.id}-${badgeCount}`}
                      initial={isBouncing ? { scale: 1.6 } : { scale: 1 }}
                      animate={{ scale: 1 }}
                      transition={isBouncing ? { type: "spring", stiffness: 300, damping: 10 } : { duration: 0 }}
                    >
                      <Badge className={cn(
                        "text-[10px] h-4 min-w-4 px-1 border-0",
                        tab.id === "pedidos" ? "bg-primary text-primary-foreground" : "bg-amber-500 text-white"
                      )}>
                        {badgeCount}
                      </Badge>
                    </motion.div>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="business-tab-indicator"
                      className="absolute inset-0 bg-primary/10 rounded-xl -z-10"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* ===== TAB CONTENT ===== */}
      <main className="flex-1 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            {activeTab === "dashboard" && (
              <DashboardTab negocio={negocio} onNavigate={(tab) => setActiveTab(tab as PanelTab)} />
            )}
            {activeTab === "ventas" && (
              <SalesTab negocio={negocio} />
            )}
            {activeTab === "productos" && (
              <ProductsTab negocio={negocio} mode={showModeToggle ? mode : "simple"} />
            )}
            {activeTab === "pedidos" && (
              <OrdersTab negocio={negocio} />
            )}
            {activeTab === "resenas" && (
              <ReviewsTab negocio={negocio} />
            )}
            {activeTab === "salon" && (
              <SalonTab negocio={negocio} />
            )}
            {activeTab === "config" && (
              <ConfigTab negocio={negocio} horarioMode={horarioMode} abiertoManual={abiertoManual} onHorarioChange={handleHorarioChange} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
