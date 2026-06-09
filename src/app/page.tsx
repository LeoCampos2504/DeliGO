"use client"

import { useState, useMemo, useEffect, useRef, Suspense } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useHydrated } from "@/hooks/use-hydrated"
import { useSearchParams } from "next/navigation"

import {
  Search,
  Star,
  Clock,
  Bike,
  Tag,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  CheckCircle,
  Truck,
  LogIn,
  User,
  LogOut,
  MapPin,
  Heart,
  AlertTriangle,
  Phone,
  MessageCircle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"
import { BottomNav } from "@/components/shared/bottom-nav"
import { AuthModal } from "@/components/auth/auth-modal"
import { BusinessPanel } from "@/components/business/business-panel"
import { PromotedBusinessesSection } from "@/components/home/promoted-businesses-section"
import { cn, formatPrice, isNegocioOpen } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useAuthStore } from "@/store/auth-store"
import { useNavStore } from "@/store/nav-store"
import { useCartStore } from "@/store/cart-store"
import type { UserType } from "@/lib/auth"
import Link from "next/link"
import { toast } from "sonner"

// Dynamic imports to reduce initial bundle size
const ClientProfilePanel = dynamic(
  () => import("@/components/client/client-profile-panel").then((mod) => mod.ClientProfilePanel),
  { ssr: false, loading: () => <ProfilePanelSkeleton /> }
)

const ClientPromosPanel = dynamic(
  () => import("@/components/client/client-promos-panel").then((mod) => mod.ClientPromosPanel),
  { ssr: false, loading: () => <PromosPanelSkeleton /> }
)

const ClientFavoritesPanel = dynamic(
  () => import("@/components/client/client-favorites-panel").then((mod) => mod.ClientFavoritesPanel),
  { ssr: false, loading: () => <FavoritesPanelSkeleton /> }
)

const ClientOrdersPanel = dynamic(
  () => import("@/components/client/client-orders-panel").then((mod) => mod.ClientOrdersPanel),
  { ssr: false, loading: () => <OrdersPanelSkeleton /> }
)

const RepartidorPanel = dynamic(
  () => import("@/components/repartidor/repartidor-panel").then((mod) => mod.RepartidorPanel),
  { ssr: false, loading: () => <RepartidorPanelSkeleton /> }
)

const SuperAdminPanel = dynamic(
  () => import("@/components/superadmin/superadmin-panel").then((mod) => mod.SuperAdminPanel),
  { ssr: false, loading: () => <SuperAdminPanelSkeleton /> }
)

const LocationPickerModal = dynamic(
  () => import("@/components/location/location-picker-modal").then((mod) => mod.LocationPickerModal),
  { ssr: false }
)

const AddressSelectorSheet = dynamic(
  () => import("@/components/location/address-selector-sheet").then((mod) => mod.AddressSelectorSheet),
  { ssr: false }
)

// ============================================
// Types
// ============================================
interface DeliveryPrecio {
  precioDelivery: number
  zonaNombre?: string
  mode: string
  delivery?: boolean
  reason?: string
}

interface NegocioHome {
  id: string
  slug: string
  nombre: string
  rubro: string
  logoUrl: string | null
  bannerUrl: string | null
  colorPrincipal: string
  puntuacionPromedio: number
  totalResenas: number
  ofreceDelivery: boolean
  precioDelivery: number
  precioDeliveryDefault: number
  zonaDeliveryActiva: boolean
  tiempoEntrega: number
  horarios: string
  horarioMode?: string
  abiertoManual?: boolean
  totalPromociones: number
  mostrarVentas: boolean
  totalVentas: number
}

// ============================================
// Category pill data
// ============================================
const categories = [
  { id: "todos", label: "Todos", icon: "📋" },
  { id: "restaurante", label: "Restaurantes", icon: "🍔" },
  { id: "ropa", label: "Ropa", icon: "👕" },
  { id: "negocio", label: "Negocios", icon: "🏪" },
]

const sortOptions = [
  { id: "populares", label: "Más populares", icon: TrendingUp },
  { id: "calificados", label: "Mejor calificados", icon: CheckCircle },
  { id: "delivery", label: "Entrega rápida", icon: Truck },
]

// ============================================
// Main Home Component (with Suspense for useSearchParams)
// ============================================
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-background animate-pulse">
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
            <div className="max-w-4xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <Logo size="md" />
                <Skeleton className="h-9 w-20 rounded-full" />
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-4">
            <Skeleton className="h-11 w-full rounded-xl" />
          </main>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}

function HomePageContent() {
  const hydrated = useHydrated()
  const searchParams = useSearchParams()
  const [activeCategory, setActiveCategory] = useState("todos")
  const [activeSort, setActiveSort] = useState("populares")
  const [searchQuery, setSearchQuery] = useState("")
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authInitialRole, setAuthInitialRole] = useState<UserType | undefined>(undefined)
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">("login")
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false)

  const { isAuthenticated, userType, userName, logout } = useAuth()
  const authUser = useAuthStore((s) => s.user)
  const { activeTab, setActiveTab, setOpenAddressForm } = useNavStore()
  const deliveryAddress = useCartStore((s) => s.deliveryAddress)
  const cartHasHydrated = useCartStore((s) => s._hasHydrated)
  const queryClient = useQueryClient()

  // Handle Google OAuth callback
  useEffect(() => {
    const authSuccess = searchParams.get("auth_success")
    const authError = searchParams.get("auth_error")

    if (authSuccess === "google") {
      const userId = searchParams.get("user_id")
      const userNameParam = searchParams.get("user_name")
      const userEmail = searchParams.get("user_email")
      const token = searchParams.get("token")

      if (userId && userNameParam && userEmail && token) {
        useAuthStore.getState().loginCliente({
          id: userId,
          nombre: decodeURIComponent(userNameParam),
          email: decodeURIComponent(userEmail),
          token,
        })
        toast.success(`🍔 ¡Bienvenido, ${decodeURIComponent(userNameParam)}!`)
      }

      // Clean URL
      window.history.replaceState({}, '', '/')
    }

    if (authError) {
      const errorMessages: Record<string, string> = {
        access_denied: "Cancelaste el inicio de sesión con Google",
        missing_params: "Error en la autenticación con Google",
        invalid_state: "Error de seguridad en la autenticación",
        token_exchange: "Error al conectar con Google",
        user_info: "No se pudo obtener tu información de Google",
        email_not_verified: "Tu email de Google no está verificado",
        server_error: "Error del servidor al autenticar con Google",
      }
      toast.error(errorMessages[authError] || "Error al iniciar sesión con Google")
      window.history.replaceState({}, '', '/')
    }

    // Handle ?register=negocio or ?register=repartidor query params
    const registerParam = searchParams.get("register")
    if (registerParam === "negocio" || registerParam === "repartidor") {
      setAuthInitialRole(registerParam)
      setAuthInitialMode("register")
      setAuthModalOpen(true)
      // Clean URL
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams])

  // Invalidate delivery-precios when switching to home tab so prices are always fresh
  useEffect(() => {
    if (activeTab === "inicio") {
      queryClient.invalidateQueries({ queryKey: ["delivery-precios"] })
      queryClient.invalidateQueries({ queryKey: ["negocios"] })
    }
  }, [activeTab, queryClient])

  // iOS PWA fix: invalidate queries when app becomes visible again.
  // In standalone PWA mode, refetchOnWindowFocus doesn't fire because
  // there's no window focus event. We use visibilitychange instead.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["delivery-precios"] })
        queryClient.invalidateQueries({ queryKey: ["negocios"] })
        queryClient.invalidateQueries({ queryKey: ["negocios-promocionados"] })
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [queryClient])

  // Invalidate delivery-precios when delivery address changes explicitly
  // This ensures the prices update immediately after the user picks a new address
  const prevAddressRef = useRef<string | null>(null)
  useEffect(() => {
    const addressKey = deliveryAddress ? `${deliveryAddress.lat},${deliveryAddress.lng}` : null
    if (addressKey !== prevAddressRef.current && prevAddressRef.current !== null) {
      queryClient.invalidateQueries({ queryKey: ["delivery-precios"] })
    }
    prevAddressRef.current = addressKey
  }, [deliveryAddress, queryClient])

  // Fetch negocio data for business panel (only when negocio user is logged in)
  const { data: negocioData } = useQuery({
    queryKey: ["negocio-profile", authUser?.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocios/${authUser?.slug}`)
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    enabled: hydrated && isAuthenticated() && userType() === "negocio" && !!authUser?.slug,
  })

  // Fetch negocios
  const { data: negocios = [], isLoading } = useQuery<NegocioHome[]>({
    queryKey: ["negocios", activeCategory, activeSort, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeCategory !== "todos") params.set("rubro", activeCategory)
      if (searchQuery) params.set("search", searchQuery)
      params.set("sort", activeSort)
      const res = await fetch(`/api/negocios?${params}`)
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    enabled: hydrated,
  })

  // Fetch zone-based delivery prices when user has a delivery address
  const { data: deliveryPrecios } = useQuery<Record<string, DeliveryPrecio>>({
    queryKey: [
      "delivery-precios",
      deliveryAddress?.lat,
      deliveryAddress?.lng,
      negocios.map((n) => n.id).join(","),
    ],
    queryFn: async () => {
      if (!deliveryAddress || negocios.length === 0) return {}
      const res = await fetch("/api/negocios/delivery-precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: deliveryAddress.lat,
          lng: deliveryAddress.lng,
          negocioIds: negocios.map((n) => n.id),
        }),
      })
      if (!res.ok) return {}
      const data = await res.json()
      return data.precios ?? {}
    },
    enabled:
      hydrated &&
      !!deliveryAddress &&
      isAuthenticated() &&
      userType() === "cliente" &&
      negocios.length > 0,
    staleTime: 1000 * 30, // 30 seconds — short staleTime for iOS PWA where visibility events may be delayed
  })

  // Filter out businesses that are out of delivery zone when user has a delivery address
  const filteredNegocios = useMemo(() => {
    if (!deliveryPrecios || !deliveryAddress) return negocios
    return negocios.filter((n) => {
      // If business doesn't offer delivery or doesn't use zone-based delivery, keep it
      if (!n.ofreceDelivery || !n.zonaDeliveryActiva) return true
      // If we have a delivery price for this business, check if it's in zone
      const precio = deliveryPrecios[n.id]
      if (!precio) return true // Still loading, keep it visible
      return precio.delivery !== false
    })
  }, [negocios, deliveryPrecios, deliveryAddress])

  const totalPromos = useMemo(
    () => filteredNegocios.reduce((sum, n) => sum + n.totalPromociones, 0),
    [filteredNegocios]
  )

  // Fetch client favorites (just IDs) for heart indicators
  const { data: favoritosData } = useQuery({
    queryKey: ["cliente-favoritos-ids"],
    queryFn: async () => {
      const res = await fetch("/api/cliente/favoritos")
      if (!res.ok) throw new Error("Error")
      const json = await res.json()
      return new Set<string>((json.favoritos ?? []).map((f: { id: string }) => f.id))
    },
    enabled: hydrated && isAuthenticated() && userType() === "cliente",
  })

  const favoriteIds = favoritosData ?? new Set<string>()

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (negocioId: string) => {
      const res = await fetch("/api/cliente/favoritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId }),
      })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["cliente-favoritos-ids"] })
      queryClient.invalidateQueries({ queryKey: ["cliente-favoritos"] })
      queryClient.invalidateQueries({ queryKey: ["cliente-perfil"] })
      if (result.action === "removed") {
        toast.success("Eliminado de favoritos")
      } else {
        toast.success("Agregado a favoritos ❤️")
      }
    },
    onError: () => {
      toast.error("No se pudo actualizar el favorito")
    },
  })

  const handleToggleFavorite = (negocioId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated() || userType() !== "cliente") {
      openAuthModal("cliente")
      return
    }
    toggleFavoriteMutation.mutate(negocioId)
  }

  const openAuthModal = (role?: UserType, mode?: "login" | "register") => {
    setAuthInitialRole(role)
    setAuthInitialMode(mode ?? "login")
    setAuthModalOpen(true)
  }

  // Auto-show address selector for clientes without delivery address
  // Using a ref + separate effect to avoid calling setState synchronously in effect
  const shouldShowAddressPicker = hydrated && cartHasHydrated && isAuthenticated() && userType() === "cliente" && !deliveryAddress && activeTab === "inicio"
  const prevShouldShowRef = useRef(false)

  useEffect(() => {
    if (shouldShowAddressPicker && !prevShouldShowRef.current) {
      // Only trigger when the condition transitions from false to true
      const timer = setTimeout(() => setAddressSelectorOpen(true), 500)
      prevShouldShowRef.current = true
      return () => clearTimeout(timer)
    }
    if (!shouldShowAddressPicker) {
      prevShouldShowRef.current = false
    }
  }, [shouldShowAddressPicker])

  const handleLogout = async () => {
    // Remember role before clearing store — cliente stays on home
    await logout()
    // Clear React Query cache so stale data doesn't persist
    queryClient.clear()
    // Reset tab to inicio
    setActiveTab("inicio")
  }

  // Prevent hydration mismatch: don't render auth-dependent UI
  // until Zustand stores have rehydrated from localStorage
  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <Logo size="md" />
              <Skeleton className="h-9 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48 mt-2 rounded" />
          </div>
        </header>
        <main className="flex-1 max-w-4xl mx-auto w-full">
          <div className="px-4 pt-4 pb-2">
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="px-4 py-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-full" />
              ))}
            </div>
          </div>
          <div className="px-4 pb-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // If the logged-in user is a negocio, show the Business Panel
  if (isAuthenticated() && userType() === "negocio" && authUser) {
    // If suspended, show suspended screen instead of panel
    if (authUser.suspendido) {
      return <NegocioSuspendedScreen nombre={authUser.nombre} />
    }
    return (
      <BusinessPanel
        negocio={{
          id: authUser.id,
          nombre: authUser.nombre,
          slug: authUser.slug ?? "",
          rubro: authUser.rubro ?? "restaurante",
          colorPrincipal: negocioData?.colorPrincipal ?? "#FB8C00",
          aprobado: authUser.aprobado ?? false,
          horarioMode: negocioData?.horarioMode,
          abiertoManual: negocioData?.abiertoManual,
        }}
      />
    )
  }

  // If the logged-in user is a repartidor, show the Repartidor Panel
  if (isAuthenticated() && userType() === "repartidor" && authUser) {
    return <RepartidorPanel />
  }

  // If the logged-in user is a superadmin, show the SuperAdmin Panel
  if (isAuthenticated() && userType() === "superadmin" && authUser) {
    return <SuperAdminPanel />
  }

  // If the logged-in user is a cliente and on a non-home tab, show the appropriate panel
  if (isAuthenticated() && userType() === "cliente" && activeTab !== "inicio") {
    if (activeTab === "perfil") {
      return (
        <div className="min-h-dvh flex flex-col bg-background">
          <ClientProfilePanel />
          <BottomNav />
        </div>
      )
    }

    if (activeTab === "promos") {
      return (
        <div className="min-h-dvh flex flex-col bg-background">
          <ClientPromosPanel deliveryPrecios={deliveryPrecios} hasDeliveryAddress={!!deliveryAddress} />
          <BottomNav />
        </div>
      )
    }

    if (activeTab === "favoritos") {
      return (
        <div className="min-h-dvh flex flex-col bg-background">
          <ClientFavoritesPanel />
          <BottomNav />
        </div>
      )
    }

    if (activeTab === "pedidos") {
      return (
        <div className="min-h-dvh flex flex-col bg-background">
          <ClientOrdersPanel />
          <BottomNav />
        </div>
      )
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              {isAuthenticated() ? (
                <div className="flex items-center gap-2">
                  {userType() === "cliente" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 rounded-full"
                      onClick={() => setActiveTab("perfil")}
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-semibold max-w-[80px] truncate">
                        {userName()?.split(" ")[0]}
                      </span>
                    </Button>
                  )}
                  {userType() === "negocio" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 rounded-full"
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <span className="text-sm">🏪</span>
                      </div>
                      <span className="text-sm font-semibold max-w-[80px] truncate">
                        {userName()?.split(" ")[0]}
                      </span>
                    </Button>
                  )}
                  {userType() === "repartidor" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 rounded-full"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <span className="text-sm">🛵</span>
                      </div>
                      <span className="text-sm font-semibold max-w-[80px] truncate">
                        {userName()?.split(" ")[0]}
                      </span>
                    </Button>
                  )}
                  {userType() === "superadmin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 rounded-full"
                    >
                      <div className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <span className="text-sm">🔐</span>
                      </div>
                      <span className="text-sm font-semibold">Admin</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={handleLogout}
                    title="Cerrar sesión"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => openAuthModal("cliente")}
                  className="gap-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                >
                  <LogIn className="h-4 w-4" />
                  Ingresar
                </Button>
              )}
            </div>
          </div>

          {/* Greeting + Delivery Address */}
          <div className="mt-2">
            {isAuthenticated() && userType() === "cliente" ? (
              <div>
                <p className="text-sm">
                  <span className="font-semibold">
                    ¡Hola, {userName()?.split(" ")[0]}! 👋
                  </span>{" "}
                  ¿Qué vas a pedir hoy?
                </p>
                {/* Delivery address indicator */}
                <button
                  onClick={() => {
                    if (deliveryAddress) {
                      setAddressSelectorOpen(true)
                    } else {
                      // No address set — go to profile to add one
                      setOpenAddressForm(true)
                      setActiveTab("perfil")
                    }
                  }}
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group"
                >
                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate max-w-[240px]">
                    {deliveryAddress
                      ? deliveryAddress.alias || deliveryAddress.direccion || `${deliveryAddress.lat.toFixed(4)}, ${deliveryAddress.lng.toFixed(4)}`
                      : "Tocá para setear tu dirección"}
                  </span>
                  {deliveryAddress && (
                    <ChevronDown className="h-3 w-3 text-primary/60 group-hover:text-primary transition-colors" />
                  )}
                </button>
              </div>
            ) : isAuthenticated() && userType() === "negocio" ? (
              <p className="text-sm">
                <span className="font-semibold">Panel de negocio</span> — Gestioná
                tu catálogo y pedidos
              </p>
            ) : isAuthenticated() && userType() === "repartidor" ? (
              <p className="text-sm">
                <span className="font-semibold">Panel de repartidor</span> —
                Consultá tus entregas
              </p>
            ) : isAuthenticated() && userType() === "superadmin" ? (
              <p className="text-sm">
                <span className="font-semibold">Panel de administración</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                ¡Buen provecho! 🍽️ Descubrí los mejores locales
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 max-w-4xl mx-auto w-full">
        {/* Search Bar */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar locales, comidas, ropa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 h-11 rounded-xl bg-muted/50 border-border/50 focus-visible:ring-primary/30 text-sm"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Promo Banner */}
        <div className="px-4 pb-3">
          <div
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-5 text-white animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {/* Decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 -right-8 w-20 h-20 rounded-full bg-white/5" />

            <div className="relative flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-extrabold text-lg">
                  Ofertas cerca tuyo 🔥
                </h3>
                <p className="text-white/80 text-sm mt-0.5">
                  Descuentos{" "}
                  <span className="font-bold text-white">imperdibles</span> en
                  tus locales favoritos
                </p>
                {totalPromos > 0 && (
                  <Badge className="mt-2 bg-white/20 text-white border-0 text-xs font-semibold">
                    {totalPromos} producto{totalPromos !== 1 ? "s" : ""} en
                    oferta
                  </Badge>
                )}
                <Button
                  size="sm"
                  className="mt-3 bg-white text-primary hover:bg-white/90 font-bold rounded-full gap-1.5 h-8 text-xs"
                  onClick={() => {
                    if (isAuthenticated() && userType() === "cliente") {
                      setActiveTab("promos")
                    } else {
                      openAuthModal("cliente")
                    }
                  }}
                >
                  Ver promociones
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-5xl ml-4 shrink-0">📢</div>
            </div>
          </div>
        </div>

        {/* Promoted Businesses Section */}
        <div className="px-4 pb-3">
          <PromotedBusinessesSection
            deliveryPrecios={deliveryPrecios}
            hasDeliveryAddress={!!deliveryAddress}
          />
        </div>

        {/* Sort Options */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {sortOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.id}
                  onClick={() => setActiveSort(opt.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 border",
                    activeSort === opt.id
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Section Header */}
        <div className="px-4 pb-2">
          <h2 className="font-bold text-base">Locales disponibles</h2>
        </div>

        {/* Business Grid */}
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : filteredNegocios.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {filteredNegocios.map((negocio) => (
                <div key={negocio.id}>
                  <BusinessCard
                    negocio={negocio}
                    isFavorite={favoriteIds.has(negocio.id)}
                    onToggleFavorite={(e) => handleToggleFavorite(negocio.id, e)}
                    isToggling={toggleFavoriteMutation.isPending}
                    deliveryPrecio={deliveryPrecios?.[negocio.id]}
                    hasDeliveryAddress={!!deliveryAddress}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trust Badges */}
        <div className="px-4 pb-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: "🛵", title: "Envío rápido", desc: "Seguimiento en vivo" },
              { icon: "🛡️", title: "Pago seguro", desc: "Datos protegidos" },
              {
                icon: "🏷️",
                title: "Promos exclusivas",
                desc: "Solo en la app",
              },
            ].map((badge) => (
              <div
                key={badge.title}
                className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/40"
              >
                <span className="text-2xl mb-1">{badge.icon}</span>
                <span className="text-xs font-bold">{badge.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {badge.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom spacer for nav — accounts for safe area on iPhone */}
        {isAuthenticated() && userType() === "cliente" && (
          <div className="h-bottom-nav-spacer" />
        )}
      </main>

      {/* Bottom Nav */}
      <BottomNav />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false)
          setAuthInitialRole(undefined)
          setAuthInitialMode("login")
        }}
        initialRole={authInitialRole}
        initialMode={authInitialMode}
      />

      {/* Location Picker Modal (kept for cart use) */}
      <LocationPickerModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        required={!deliveryAddress}
      />

      {/* Address Selector Sheet */}
      <AddressSelectorSheet
        open={addressSelectorOpen}
        onOpenChange={setAddressSelectorOpen}
        onAddNew={() => {
          setOpenAddressForm(true)
          setActiveTab("perfil")
        }}
      />
    </div>
  )
}

// ============================================
// Business Card Component
// ============================================
function BusinessCard({
  negocio,
  isFavorite = false,
  onToggleFavorite,
  isToggling = false,
  deliveryPrecio,
  hasDeliveryAddress = false,
}: {
  negocio: NegocioHome
  isFavorite?: boolean
  onToggleFavorite?: (e: React.MouseEvent) => void
  isToggling?: boolean
  deliveryPrecio?: DeliveryPrecio
  hasDeliveryAddress?: boolean
}) {
  const isOpen = isNegocioOpen(negocio.horarios, negocio.horarioMode, negocio.abiertoManual)

  // Determine delivery price display (zone-aware)
  const deliveryLabel = getDeliveryLabel(negocio, deliveryPrecio, hasDeliveryAddress)

  return (
    <Link href={`/n/${negocio.slug}`} className="block group cursor-pointer">
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
        {/* Banner */}
        <div
          className="relative h-28 overflow-hidden"
          style={{
            background: negocio.bannerUrl
              ? undefined
              : `linear-gradient(135deg, ${negocio.colorPrincipal}22, ${negocio.colorPrincipal}08)`,
          }}
        >
          {negocio.bannerUrl ? (
            <img
              src={negocio.bannerUrl}
              alt={`Banner de ${negocio.nombre}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl opacity-15">
                {negocio.rubro === "restaurante"
                  ? "🍽️"
                  : negocio.rubro === "ropa"
                  ? "👕"
                  : "🛒"}
              </span>
            </div>
          )}

          {/* Closed overlay */}
          {!isOpen && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
              <Badge
                variant="secondary"
                className="bg-black/60 text-white border-0 text-xs font-bold"
              >
                Cerrado
              </Badge>
            </div>
          )}

          {/* Favorite heart button */}
          {onToggleFavorite && (
            <button
              onClick={(e) => onToggleFavorite(e)}
              disabled={isToggling}
              className={cn(
                "absolute top-2 right-2 h-8 w-8 rounded-full flex items-center justify-center z-10 transition-all duration-200",
                isFavorite
                  ? "bg-black/30 backdrop-blur-sm hover:bg-black/50"
                  : "bg-black/20 backdrop-blur-sm hover:bg-black/40"
              )}
            >
              <Heart
                className={cn(
                  "h-4 w-4 transition-transform hover:scale-110",
                  isFavorite
                    ? "text-white fill-rose-500"
                    : "text-white/70 fill-transparent"
                )}
              />
            </button>
          )}
        </div>

        {/* Logo */}
        <div className="absolute top-[4.5rem] left-3 z-10">
          <div
            className="w-14 h-14 rounded-2xl border-[3px] border-background shadow-md overflow-hidden flex items-center justify-center"
            style={{
              backgroundColor: negocio.logoUrl
                ? undefined
                : `${negocio.colorPrincipal}18`,
            }}
          >
            {negocio.logoUrl ? (
              <img
                src={negocio.logoUrl}
                alt={`Logo de ${negocio.nombre}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                className="text-xl font-extrabold"
                style={{ color: negocio.colorPrincipal }}
              >
                {negocio.nombre.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="pt-8 pb-3 px-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate leading-tight">
                {negocio.nombre}
              </h3>
              <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                {negocio.rubro === "restaurante"
                  ? "Restaurante"
                  : negocio.rubro === "ropa"
                  ? "Indumentaria"
                  : negocio.rubro === "negocio"
                  ? "Negocio"
                  : "Negocio"}
              </p>
            </div>

            {/* Rating */}
            {negocio.puntuacionPromedio > 0 && (
              <div className="flex items-center gap-1 shrink-0 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  {negocio.puntuacionPromedio.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Delivery + Promos + Ventas info row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5">
            {negocio.ofreceDelivery && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Bike className="h-3.5 w-3.5 text-primary" />
                <span className={cn(
                  "font-semibold",
                  negocio.zonaDeliveryActiva && !deliveryPrecio ? "text-primary" : "text-foreground"
                )}>
                  {deliveryLabel}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {negocio.tiempoEntrega} min
            </span>
            {negocio.totalPromociones > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 font-semibold">
                <Tag className="h-3 w-3" />
                {negocio.totalPromociones} promo{negocio.totalPromociones > 1 ? "s" : ""}
              </span>
            )}
            {negocio.mostrarVentas && negocio.totalVentas > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                {negocio.totalVentas}+ ventas
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ============================================
// Delivery label helper (zone-aware)
// ============================================
function getDeliveryLabel(
  negocio: NegocioHome,
  deliveryPrecio?: DeliveryPrecio,
  hasDeliveryAddress?: boolean
): string {
  // Non-zone businesses: simple price
  if (!negocio.zonaDeliveryActiva) {
    return negocio.precioDelivery > 0
      ? formatPrice(negocio.precioDelivery)
      : "Gratis"
  }

  // Zone businesses without user address: show "Por zona"
  if (!hasDeliveryAddress || !deliveryPrecio) {
    return "Por zona"
  }

  // Zone businesses with calculated price
  if (deliveryPrecio.delivery === false) {
    return "Fuera de zona"
  }

  return deliveryPrecio.precioDelivery > 0
    ? formatPrice(deliveryPrecio.precioDelivery)
    : "Gratis"
}

// ============================================
// Skeleton loader
// ============================================
function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      <Skeleton className="h-28 w-full rounded-none" />
      <div className="px-3 pb-3 pt-8">
        <Skeleton className="h-4 w-3/4 mb-1.5" />
        <Skeleton className="h-3 w-1/3 mb-3" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
    </div>
  )
}

// ============================================
// Negocio Suspended Screen
// ============================================
function NegocioSuspendedScreen({ nombre }: { nombre: string }) {
  const { logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-red-500/5" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-red-500/3" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center gap-6">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center animate-in zoom-in-50 duration-300">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>

        {/* Text */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Local suspendido</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hola <span className="font-semibold">{nombre}</span>, tu local está temporalmente suspendido.
          </p>
        </div>

        {/* Card */}
        <Card className="w-full border-red-200 dark:border-red-900/50 shadow-lg shadow-red-500/10 animate-in slide-in-from-bottom-4 duration-300">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Si creés que es un error o querés más información, contactanos por WhatsApp.
            </p>

            <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm font-bold text-red-700 dark:text-red-400">
                  3886418011
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Horario de atención: Lunes a Viernes 9:00 - 18:00
              </p>
            </div>

            <a
              href="https://wa.me/5493886418011?text=Hola%2C%20mi%20local%20está%20suspendido%20y%20necesito%20más%20información"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button
                className="w-full rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white gap-2"
                size="lg"
              >
                <MessageCircle className="h-5 w-5" />
                Escribinos por WhatsApp
              </Button>
            </a>

            <div className="mt-3">
              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                variant="outline"
                className="w-full rounded-xl font-semibold"
              >
                {loggingOut ? "Cerrando..." : "Cerrar sesión"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================
// Empty state
// ============================================
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">😕</span>
      <h3 className="font-bold text-lg">Ups... sin resultados</h3>
      <p className="text-sm text-muted-foreground mt-1">
        No encontramos locales con ese filtro.
      </p>
    </div>
  )
}

// ============================================
// Profile Panel Skeleton (loading state)
// ============================================
function ProfilePanelSkeleton() {
  return (
    <div className="flex-1 bg-background animate-pulse">
      <div className="bg-primary/20 px-4 pt-12 pb-16">
        <div className="flex flex-col items-center">
          <div className="h-20 w-20 rounded-full bg-white/10" />
          <div className="mt-3 h-5 w-32 rounded bg-white/10" />
          <div className="mt-2 h-3 w-40 rounded bg-white/5" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 -mt-8 grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/50 border border-border/30" />
        ))}
      </div>
      <div className="max-w-2xl mx-auto px-4 pb-24 space-y-3 mt-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/50 border border-border/30" />
        ))}
      </div>
    </div>
  )
}

function FavoritesPanelSkeleton() {
  return (
    <div className="flex-1 bg-background animate-pulse">
      <div className="bg-rose-500/10 px-4 pt-10 pb-8">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20" />
          <div>
            <div className="h-5 w-32 rounded bg-rose-500/10" />
            <div className="mt-1 h-3 w-20 rounded bg-rose-500/5" />
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
              <Skeleton className="h-24 w-full rounded-none" />
              <div className="px-3 pb-3 pt-7">
                <Skeleton className="h-4 w-3/4 mb-1.5" />
                <Skeleton className="h-3 w-1/3 mb-3" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PromosPanelSkeleton() {
  return (
    <div className="flex-1 bg-background animate-pulse">
      <div className="bg-primary/20 px-4 pt-10 pb-8">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10" />
          <div>
            <div className="h-5 w-32 rounded bg-white/10" />
            <div className="mt-1 h-3 w-40 rounded bg-white/5" />
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-4 pb-24">
        <div className="h-16 rounded-xl bg-muted/50 border border-border/30" />
        <div className="h-11 rounded-xl bg-muted/50 border border-border/30" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OrdersPanelSkeleton() {
  return (
    <div className="flex-1 bg-background animate-pulse">
      <div className="bg-primary/20 px-4 pt-12 pb-8">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 rounded-full bg-white/10 mb-2" />
          <div className="h-5 w-28 rounded bg-white/10" />
          <div className="mt-1 h-3 w-40 rounded bg-white/5" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pb-24">
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
          <div className="flex-1 h-9 rounded-lg bg-background/50" />
          <div className="flex-1 h-9 rounded-lg" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-card border border-border/50 p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex gap-3 mb-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center justify-between gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-2 w-10" />
                </div>
              ))}
            </div>
            <div className="flex justify-between mb-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-7 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

function RepartidorPanelSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background animate-pulse">
      {/* Header skeleton */}
      <div className="bg-blue-500/10 px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="h-6 w-20 rounded bg-blue-500/10" />
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-500/10" />
            <div className="h-8 w-8 rounded-full bg-blue-500/10" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15" />
          <div>
            <div className="h-5 w-32 rounded bg-blue-500/10" />
            <div className="mt-1 h-3 w-24 rounded bg-blue-500/5" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="h-16 rounded-xl bg-amber-500/10" />
          <div className="h-16 rounded-xl bg-emerald-500/10" />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="px-4 py-1.5 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-20 rounded-xl bg-muted/30" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
            <div className="h-12 bg-muted/30" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-1/2 rounded bg-muted/20" />
              <div className="h-16 rounded-xl bg-muted/20" />
              <div className="flex gap-2">
                <div className="flex-1 h-10 rounded-xl bg-muted/20" />
                <div className="flex-1 h-10 rounded-xl bg-muted/20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SuperAdminPanelSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background animate-pulse">
      {/* Header skeleton */}
      <div className="bg-purple-500/10 px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="h-6 w-20 rounded bg-purple-500/10" />
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-full bg-purple-500/10" />
            <div className="h-8 w-8 rounded-full bg-purple-500/10" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15" />
          <div>
            <div className="h-5 w-32 rounded bg-purple-500/10" />
            <div className="mt-1 h-3 w-28 rounded bg-purple-500/5" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="h-16 rounded-xl bg-amber-500/10" />
          <div className="h-16 rounded-xl bg-emerald-500/10" />
          <div className="h-16 rounded-xl bg-red-500/10" />
          <div className="h-16 rounded-xl bg-blue-500/10" />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="px-4 py-1.5 flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-20 rounded-xl bg-muted/30" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-4 bg-muted/30">
              <div className="h-4 w-20 rounded bg-muted/50 mb-2" />
              <div className="h-8 w-16 rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
