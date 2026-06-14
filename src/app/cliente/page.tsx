"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuthStore } from "@/store/auth-store"
import { useHydrated } from "@/hooks/use-hydrated"
import { useNavStore, type ClientTab } from "@/store/nav-store"
import { Skeleton } from "@/components/ui/skeleton"
import { BottomNav } from "@/components/shared/bottom-nav"
import { NotificationBell } from "@/components/shared/notification-center"
import type { NotificationItem } from "@/store/notification-store"

const ClientOrdersPanel = dynamic(
  () => import("@/components/client/client-orders-panel").then((mod) => mod.ClientOrdersPanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  }
)

const ClientProfilePanel = dynamic(
  () => import("@/components/client/client-profile-panel").then((mod) => mod.ClientProfilePanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  }
)

const ClientFavoritesPanel = dynamic(
  () => import("@/components/client/client-favorites-panel").then((mod) => mod.ClientFavoritesPanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  }
)

const ClientPromosPanel = dynamic(
  () => import("@/components/client/client-promos-panel").then((mod) => mod.ClientPromosPanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  }
)

const tabComponents: Record<string, React.ComponentType> = {
  pedidos: ClientOrdersPanel,
  perfil: ClientProfilePanel,
  favoritos: ClientFavoritesPanel,
  promos: ClientPromosPanel,
}

export default function ClientePage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userType = useAuthStore((s) => s.userType)
  const activeTab = useNavStore((s) => s.activeTab)
  const setActiveTab = useNavStore((s) => s.setActiveTab)

  useEffect(() => {
    if (!hydrated) return

    if (!isAuthenticated() || userType() !== "cliente") {
      router.replace("/")
    }
  }, [hydrated, isAuthenticated, userType, router])

  // Ensure cliente tab is active
  useEffect(() => {
    if (hydrated && isAuthenticated() && userType() === "cliente") {
      if (activeTab === "inicio") {
        setActiveTab("pedidos")
      }
    }
  }, [hydrated, isAuthenticated, userType, activeTab, setActiveTab])

  // Handle URL tab parameter (from push notification click)
  useEffect(() => {
    if (!hydrated || !isAuthenticated() || userType() !== "cliente") return

    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get("tab")
    if (tabParam) {
      const tabMap: Record<string, ClientTab> = {
        pedidos: "pedidos",
        perfil: "perfil",
        favoritos: "favoritos",
        promos: "promos",
      }
      const target = tabMap[tabParam]
      if (target) {
        setActiveTab(target)
        // Clean URL without reload
        window.history.replaceState({}, "", window.location.pathname)
      }
    }
  }, [hydrated, isAuthenticated, userType, setActiveTab])

  // Handle notification click → navigate to correct tab
  const handleNotificationNavigate = useCallback((tab: string, _notif: NotificationItem) => {
    const tabMap: Record<string, ClientTab> = {
      pedidos: "pedidos",
      perfil: "perfil",
      favoritos: "favoritos",
      promos: "promos",
      inicio: "pedidos",
    }
    const target = tabMap[tab]
    if (target) setActiveTab(target)
  }, [setActiveTab])

  // Wait for hydration
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 animate-pulse" />
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>
    )
  }

  // Not authorized
  if (!isAuthenticated() || userType() !== "cliente") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <span className="text-5xl">🔒</span>
          <h2 className="font-bold text-lg">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">
            No tenés permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    )
  }

  const ActiveComponent = tabComponents[activeTab] || ClientOrdersPanel

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Notification bell — fixed top-right */}
      <div className="fixed top-3 right-3 z-50">
        <NotificationBell onNavigate={handleNotificationNavigate} />
      </div>
      <ActiveComponent />
      <BottomNav />
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="flex-1 bg-background animate-pulse">
      <div className="bg-primary/20 px-4 pt-12 pb-8">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 rounded-full bg-white/10 mb-2" />
          <div className="h-5 w-28 rounded bg-white/10" />
          <div className="mt-1 h-3 w-40 rounded bg-white/5" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pb-24 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/50 border border-border/30" />
        ))}
      </div>
    </div>
  )
}
