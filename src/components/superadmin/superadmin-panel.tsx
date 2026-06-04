"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield,
  Clock,
  Store,
  AlertTriangle,
  DollarSign,
  Users,
  Bike,
  Package,
  LogOut,
  RefreshCw,
  Flame,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useAuthStore } from "@/store/auth-store"
import { useSuperAdminStore, type SuperAdminTab } from "@/store/superadmin-store"
import { OverviewTab } from "./overview-tab"
import { PendientesTab } from "./pendientes-tab"
import { ActivosTab } from "./activos-tab"
import { AlertasTab } from "./alertas-tab"
import { DeudasTab } from "./deudas-tab"
import { PromocionadosTab } from "./promocionados-tab"

// ============================================
// Tab config
// ============================================
const tabItems: { id: SuperAdminTab; label: string; icon: typeof Shield }[] = [
  { id: "overview", label: "Resumen", icon: Shield },
  { id: "pendientes", label: "Pendientes", icon: Clock },
  { id: "activos", label: "Activos", icon: Store },
  { id: "promocionados", label: "Destacados", icon: Flame },
  { id: "alertas", label: "Alertas", icon: AlertTriangle },
  { id: "deudas", label: "Deudas", icon: DollarSign },
]

// ============================================
// Main SuperAdmin Panel
// ============================================
export function SuperAdminPanel() {
  const { activeTab, setActiveTab, refreshKey } = useSuperAdminStore()
  const { logout } = useAuth()
  const authUser = useAuthStore((s) => s.user)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch dashboard data
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin-dashboard", refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/dashboard")
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    enabled: !!authUser?.id,
    refetchInterval: 30000,
  })

  const handleRefresh = () => {
    setIsRefreshing(true)
    useSuperAdminStore.getState().triggerRefresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const stats = data?.stats

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-3">
          {/* Top row */}
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <div className="flex items-center gap-1.5">
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

          {/* Admin info */}
          <div className="mt-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg">SuperAdmin</h1>
              <p className="text-xs text-muted-foreground">Panel de administración</p>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <button onClick={() => setActiveTab("pendientes")} className="text-left">
              <div className="rounded-xl bg-amber-500/10 px-2.5 py-2 transition-colors hover:bg-amber-500/15">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Pendientes</p>
                <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{stats?.pendientes ?? "—"}</p>
              </div>
            </button>
            <button onClick={() => setActiveTab("activos")} className="text-left">
              <div className="rounded-xl bg-emerald-500/10 px-2.5 py-2 transition-colors hover:bg-emerald-500/15">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Activos</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{stats?.activos ?? "—"}</p>
              </div>
            </button>
            <button onClick={() => setActiveTab("alertas")} className="text-left">
              <div className="rounded-xl bg-red-500/10 px-2.5 py-2 transition-colors hover:bg-red-500/15">
                <p className="text-[10px] text-red-700 dark:text-red-400 font-medium">Alertas</p>
                <p className="text-lg font-bold text-red-800 dark:text-red-300">{stats?.alertas ?? "—"}</p>
              </div>
            </button>
            <button onClick={() => setActiveTab("deudas")} className="text-left">
              <div className="rounded-xl bg-blue-500/10 px-2.5 py-2 transition-colors hover:bg-blue-500/15">
                <p className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">Deuda</p>
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300 truncate">
                  {stats?.deudaTotal != null
                    ? `$${stats.deudaTotal.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`
                    : "—"}
                </p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ===== TAB NAVIGATION ===== */}
      <div className="sticky top-[196px] z-30 bg-background/95 backdrop-blur-md border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 py-1.5 overflow-x-auto scrollbar-none" aria-label="Admin navigation">
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
                      ? "text-purple-700 dark:text-purple-300"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.id === "pendientes" && (stats?.pendientes ?? 0) > 0 && (
                    <span className="ml-0.5 h-4 min-w-4 px-1 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                      {stats?.pendientes}
                    </span>
                  )}
                  {tab.id === "alertas" && (stats?.alertas ?? 0) > 0 && (
                    <span className="ml-0.5 h-4 min-w-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
                      {stats?.alertas}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="admin-tab-indicator"
                      className="absolute inset-0 bg-purple-500/10 rounded-xl -z-10"
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
      <main className="flex-1 max-w-5xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            {activeTab === "overview" && (
              <OverviewTab data={data} isLoading={isLoading} />
            )}
            {activeTab === "pendientes" && (
              <PendientesTab
                pendientes={data?.pendientes ?? []}
                isLoading={isLoading}
              />
            )}
            {activeTab === "activos" && (
              <ActivosTab
                negocios={data?.activos ?? []}
                isLoading={isLoading}
              />
            )}
            {activeTab === "alertas" && (
              <AlertasTab
                negocios={data?.conAlerta ?? []}
                isLoading={isLoading}
              />
            )}
            {activeTab === "deudas" && (
              <DeudasTab
                negocios={data?.todosLosNegocios ?? []}
                isLoading={isLoading}
                constants={data?.constants}
              />
            )}
            {activeTab === "promocionados" && (
              <PromocionadosTab />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
