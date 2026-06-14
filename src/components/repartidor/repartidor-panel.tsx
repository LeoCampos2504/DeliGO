"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import {
  Bike,
  Store,
  History,
  User,
  LogOut,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/shared/logo"
import { NotificationBell } from "@/components/shared/notification-center"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useAuthStore } from "@/store/auth-store"
import { useRepartidorStore, type RepartidorTab } from "@/store/repartidor-store"
import type { NotificationItem } from "@/store/notification-store"
import { DeliveriesTab } from "./deliveries-tab"
import { NegociosTab } from "./negocios-tab"
import { HistoryTab } from "./history-tab"
import { ProfileTab } from "./profile-tab"

// ============================================
// Types
// ============================================
const tabItems: { id: RepartidorTab; label: string; icon: typeof Bike; badge?: string }[] = [
  { id: "entregas", label: "Entregas", icon: Bike },
  { id: "negocios", label: "Locales", icon: Store },
  { id: "historial", label: "Historial", icon: History },
  { id: "perfil", label: "Perfil", icon: User },
]

// ============================================
// Main Repartidor Panel
// ============================================
export function RepartidorPanel() {
  const { activeTab, setActiveTab, setStats, refreshKey } = useRepartidorStore()
  const { logout } = useAuth()
  const authUser = useAuthStore((s) => s.user)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Handle notification click → navigate to correct tab
  const handleNotificationNavigate = useCallback((tab: string, _notif: NotificationItem) => {
    const tabMap: Record<string, RepartidorTab> = {
      entregas: "entregas",
      negocios: "negocios",
      historial: "historial",
      perfil: "perfil",
    }
    const target = tabMap[tab]
    if (target) setActiveTab(target)
  }, [setActiveTab])

  // Handle URL tab parameter (from push notification click)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get("tab")
    if (tabParam) {
      const tabMap: Record<string, RepartidorTab> = {
        entregas: "entregas",
        negocios: "negocios",
        historial: "historial",
        perfil: "perfil",
      }
      const target = tabMap[tabParam]
      if (target) {
        setActiveTab(target)
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
  }, [setActiveTab])

  // Fetch repartidor profile
  const { data: perfil, isLoading: perfilLoading } = useQuery({
    queryKey: ["repartidor-perfil", authUser?.id, refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/repartidor/perfil")
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    enabled: !!authUser?.id,
    refetchInterval: 30000,
  })

  // Fetch active deliveries
  const { data: pedidosData, isLoading: pedidosLoading } = useQuery({
    queryKey: ["repartidor-pedidos", refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/repartidor/pedidos")
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    refetchInterval: 8000, // Auto-refresh every 8s (matching Flask behavior)
  })

  // Fetch today's delivered count
  const { data: entregadosData } = useQuery({
    queryKey: ["repartidor-entregados-hoy", refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/repartidor/pedidos-entregados")
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    refetchInterval: 15000,
  })

  // Update stats
  useEffect(() => {
    const pendientes = pedidosData?.pedidos?.length ?? 0
    const entregados = entregadosData?.total ?? 0
    setStats(pendientes, entregados)
  }, [pedidosData, entregadosData, setStats])

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    useRepartidorStore.getState().triggerRefresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }, [])

  const { pedidosPendientes, pedidosEntregadosHoy } = useRepartidorStore()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Top row: Logo + actions */}
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-1.5">
              <NotificationBell onNavigate={handleNotificationNavigate} />
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full text-muted-foreground hover:text-foreground",
                  isRefreshing && "animate-spin"
                )}
                onClick={handleRefresh}
                title="Actualizar"
              >
                <RefreshCw className="h-4 w-4" />
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

          {/* Repartidor info */}
          <div className="mt-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <span className="text-lg">🛵</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg truncate">
                {perfil?.nombre ?? authUser?.nombre ?? "Repartidor"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {perfil?.negocios?.length ?? 0} local{(perfil?.negocios?.length ?? 0) !== 1 ? "es" : ""} asociado{(perfil?.negocios?.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 px-3 py-2.5">
              <span className="text-lg">📦</span>
              <div>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Pendientes</p>
                <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{pedidosPendientes}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 px-3 py-2.5">
              <span className="text-lg">✅</span>
              <div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Entregados hoy</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{pedidosEntregadosHoy}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== TAB NAVIGATION ===== */}
      <div className="sticky top-[168px] z-30 bg-background/95 backdrop-blur-md border-b border-border/30">
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex gap-1 py-1.5 overflow-x-auto scrollbar-none" aria-label="Panel de repartidor">
            {tabItems.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
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
                  {tab.id === "entregas" && pedidosPendientes > 0 && (
                    <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground border-0">
                      {pedidosPendientes}
                    </Badge>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="repartidor-tab-indicator"
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
            {activeTab === "entregas" && (
              <DeliveriesTab
                pedidos={pedidosData?.pedidos ?? []}
                disponibles={pedidosData?.disponibles ?? []}
                mios={pedidosData?.mios ?? []}
                isLoading={pedidosLoading}
                onRefresh={handleRefresh}
              />
            )}
            {activeTab === "negocios" && (
              <NegociosTab
                negocios={perfil?.negocios ?? []}
                isLoading={perfilLoading}
              />
            )}
            {activeTab === "historial" && <HistoryTab />}
            {activeTab === "perfil" && (
              <ProfileTab perfil={perfil} isLoading={perfilLoading} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
