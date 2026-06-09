"use client"

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { useHydrated } from "@/hooks/use-hydrated"
import { useSearchParams } from "next/navigation"

import {
  ArrowLeft,
  Search,
  Star,
  Clock,
  Bike,
  X,
  Plus,
  Minus,
  ChevronRight,
  Share2,
  Info,
  MessageCircle,
  Banknote,
  CreditCard,
  Eye,
  ArrowRight,
  Instagram,
  Facebook,
  Settings2,
  Armchair,
  ShoppingBag,
  UserCheck,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn, formatPrice, isNegocioOpen } from "@/lib/utils"
import { useCartStore, type CartItem, type CartItemAgregado, type CartItemSecciones, generateCartItemKey } from "@/store/cart-store"
import { CartPanel } from "@/components/cart/cart-panel"
import { HorariosPopover, getTodayHoursLabel } from "@/components/shared/horarios-popover"
import { MesaSelectorSheet } from "@/components/business/mesa-selector-sheet"
import { AuthModal } from "@/components/auth/auth-modal"
import { useAuth } from "@/hooks/use-auth"
import dynamic from "next/dynamic"
import { toast } from "sonner"

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
interface ProductoAPI {
  id: string
  nombre: string
  precio: number
  categoria: string
  imagenUrl: string | null
  imagenesExtra: string[]
  stock: boolean
  descuentoActivo: boolean
  tipoDescuento: string
  valorDescuento: number
  descripcion: string | null
  secciones: Array<{ nombre: string; opciones: string[]; obligatorio: boolean; maximo: number }>
  recomendados: string[]
  talles: string[]
  colores: string[]
  material: string
  genero: string
  agregados: Array<{ id: string; nombre: string; precio: number; categoria: string; imagenUrl: string | null }>
  ingredientes: Array<{ id: string; nombre: string; categoria: string; imagenUrl: string | null }>
  precioPromo: number | null
  descuentoLabel: string | null
  opcionesCompartidasIds: Array<{ id: string; obligatorio: boolean; maximo: number }>
}

interface SeccionAPI {
  id: string
  nombre: string
  orientacion: string
  orden: number
  color: string
  productos: ProductoAPI[]
}

interface ResenaAPI {
  id: string
  clienteNombre: string
  puntuacion: number
  rapidez: number | null
  calidad: number | null
  precio: number | null
  comentario: string
  respuestaNegocio: string | null
  fechaRespuesta: string | null
  fecha: string
}

interface NegocioAPI {
  id: string
  slug: string
  nombre: string
  rubro: string
  colorPrincipal: string
  mensajeBienvenida: string
  logoUrl: string | null
  bannerUrl: string | null
  categorias: string[]
  horarios: Record<string, unknown>
  ofreceDelivery: boolean
  precioDelivery: number
  deliveryMode?: string
  tiempoEntrega: number
  puntuacionPromedio: number
  totalResenas: number
  aceptaTransferencia: boolean
  aliasBancario: string
  whatsapp: string
  instagram: string
  facebook: string
  salonActivo?: boolean
  mostrarVentas?: boolean
  totalVentas?: number
  opcionesCompartidas: Array<{ id: string; nombre: string; opciones: Array<{ nombre: string; precio: number }>; obligatorio: boolean; maximo: number }>
  lat?: number | null
  lng?: number | null
  productos: ProductoAPI[]
  productosSinSeccion: ProductoAPI[]
  secciones: SeccionAPI[]
  resenas: ResenaAPI[]
}

// ============================================
// Main Catalog Page
// ============================================
export default function CatalogoPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <div className="relative h-44">
            <Skeleton className="w-full h-full rounded-none" />
          </div>
          <div className="px-4 pt-4">
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <CatalogoPageContent params={params} />
    </Suspense>
  )
}

function CatalogoPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params)
  const hydrated = useHydrated()
  const searchParams = useSearchParams()
  const isPreview = searchParams.get("preview") === "true"
  const mesaParam = searchParams.get("mesa")
  const mesaNumero = mesaParam ? parseInt(mesaParam, 10) : null
  const isMesaOrder = !!mesaNumero
  const mozoParam = searchParams.get("mozo")

  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("Todas")
  const [selectedProduct, setSelectedProduct] = useState<ProductoAPI | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [showReviews, setShowReviews] = useState(false)

  // Auth & location gate state
  const { isAuthenticated, userType } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false)

  // Mozo mesa selection state
  const [mozoSelectedMesa, setMozoSelectedMesa] = useState<{ id: string; numero: number; nombre: string; zona: string; mozoAsignado: { id: string; nombre: string; codigo: string } | null } | null>(null)
  const [mesaSelectorOpen, setMesaSelectorOpen] = useState(false)

  // Check for auto-open product from URL (e.g. from promos)
  const autoOpenProductId = searchParams.get("productoId")

  // Fetch negocio data
  const { data: negocio, isLoading, error } = useQuery<NegocioAPI>({
    queryKey: ["negocio", slug],
    queryFn: async () => {
      const res = await fetch(`/api/negocios/${slug}`)
      if (!res.ok) throw new Error("Error al cargar el negocio")
      return res.json()
    },
    enabled: !!slug,
  })

  // Fetch mozo info when mozo param is present
  const { data: mozoData } = useQuery({
    queryKey: ["mozo-info", mozoParam, negocio?.id],
    queryFn: async () => {
      if (!mozoParam || !negocio?.id) return null
      const res = await fetch(`/api/empleados/by-codigo?codigo=${mozoParam}&negocioId=${negocio.id}`)
      if (!res.ok) return null
      return res.json() as Promise<{ id: string; nombre: string; codigo: string }>
    },
    enabled: !!mozoParam && !!negocio?.id,
  })

  // Auto-open mesa selector when mozo enters without a mesa
  const mozoAutoSelectRef = useRef(false)
  useEffect(() => {
    if (mozoData && !mesaNumero && !mozoSelectedMesa && !mozoAutoSelectRef.current) {
      mozoAutoSelectRef.current = true
      // Small delay to let page render first
      const timer = setTimeout(() => setMesaSelectorOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [mozoData, mesaNumero, mozoSelectedMesa])

  // Fetch mesa info when customer enters via ?mesa=X (to get mesaId and mozoAsignado)
  const { data: customerMesaData } = useQuery<{
    id: string
    numero: number
    nombre: string
    zona: string
    mozoAsignado: { id: string; nombre: string; codigo: string } | null
  } | null>({
    queryKey: ["customer-mesa", slug, mesaNumero],
    queryFn: async () => {
      if (!mesaNumero || !slug || mozoData) return null
      const res = await fetch(`/api/negocio/mesas-public?slug=${slug}`)
      if (!res.ok) return null
      const data = await res.json()
      const found = (data.mesas as Array<{ id: string; numero: number; nombre: string; zona: string; mozoAsignado: { id: string; nombre: string; codigo: string } | null }>).find((m: { numero: number }) => m.numero === mesaNumero)
      return found ?? null
    },
    enabled: !!mesaNumero && !!slug && !mozoData,
  })

  // Determine the effective mesa number and ID for cart
  const effectiveMesaNumero = mesaNumero ?? mozoSelectedMesa?.numero ?? null
  const effectiveMesaId = mozoSelectedMesa?.id ?? customerMesaData?.id ?? null
  const isEffectiveMesaOrder = !!effectiveMesaNumero



  const isOpen = negocio ? isNegocioOpen(JSON.stringify(negocio.horarios), negocio.horarioMode, negocio.abiertoManual) : false
  const isRopa = negocio?.rubro === "ropa"

  // Cart store
  const cartItems = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems())
  const activeNegocioId = useCartStore((s) => s.activeNegocioId)
  const setActiveNegocio = useCartStore((s) => s.setActiveNegocio)
  const addItem = useCartStore((s) => s.addItem)
  const cartTotal = useCartStore((s) => s.total())
  const deliveryAddress = useCartStore((s) => s.deliveryAddress)

  // Auth gate helper: check if user can interact with ordering (not for mesa/mozo)
  const canOrder = isMesaOrder || (isAuthenticated() && userType() === "cliente")

  const requireAuth = (): boolean => {
    if (isMesaOrder) return true // mesa orders don't need auth
    if (!isAuthenticated() || userType() !== "cliente") {
      setAuthModalOpen(true)
      return false
    }
    return true
  }

  const requireLocation = (): boolean => {
    if (isMesaOrder) return true // mesa orders don't need location
    if (!deliveryAddress) {
      setAddressSelectorOpen(true)
      return false
    }
    return true
  }

  // Delivery zone price based on client's location
  const [zoneDeliveryPrice, setZoneDeliveryPrice] = useState<number | null>(null)

  useEffect(() => {
    if (!negocio) return
    if (negocio.deliveryMode !== "expert" || !deliveryAddress?.lat || !deliveryAddress?.lng) {
      const resetTimer = window.setTimeout(() => setZoneDeliveryPrice(null), 0)
      return () => window.clearTimeout(resetTimer)
    }
    fetch(`/api/negocio/delivery-zonas?slug=${negocio.slug}&lat=${deliveryAddress.lat}&lng=${deliveryAddress.lng}`)
      .then(r => r.json())
      .then(data => {
        setZoneDeliveryPrice(data.delivery ? data.precioDelivery : null)
      })
      .catch(() => setZoneDeliveryPrice(null))
  }, [negocio?.slug, negocio?.deliveryMode, deliveryAddress?.lat, deliveryAddress?.lng])

  // Effective delivery price: zone price if available, otherwise negocio's base price
  const effectiveDeliveryPrice = zoneDeliveryPrice ?? negocio?.precioDelivery ?? 0

  // Set active negocio when data loads
  useEffect(() => {
    if (negocio && (!activeNegocioId || activeNegocioId !== negocio.id)) {
      if (cartItems.length === 0) {
        setActiveNegocio(negocio.id, negocio.slug, negocio.nombre, effectiveDeliveryPrice)
      }
    }
  }, [negocio?.id, activeNegocioId, cartItems.length, setActiveNegocio, negocio, effectiveDeliveryPrice])

  // All products combined (sin seccion + from secciones) for search/filter
  const allProducts = useMemo(() => {
    if (!negocio) return []
    const sectionProducts = negocio.secciones.flatMap((s) => s.productos)
    // Deduplicate by id (a product shouldn't be in multiple sections, but just in case)
    const seen = new Set<string>()
    const combined: ProductoAPI[] = []
    for (const p of [...negocio.productosSinSeccion, ...sectionProducts]) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        combined.push(p)
      }
    }
    return combined
  }, [negocio])

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!negocio) return []

    // When no search and no category filter, only show productosSinSeccion (sections shown separately)
    if (activeCategory === "Todas" && !searchQuery.trim()) {
      return negocio.productosSinSeccion
    }

    // When searching or filtering by category, search across ALL products (including sections)
    let products = allProducts

    if (activeCategory !== "Todas") {
      products = products.filter((p) => p.categoria === activeCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      products = products.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(q))
      )
    }

    return products
  }, [negocio, allProducts, activeCategory, searchQuery])

  // Category list
  const categories = useMemo(() => {
    if (!negocio) return ["Todas"]
    return ["Todas", ...negocio.categorias]
  }, [negocio])

  // Open product detail (with auth gate)
  const openProductDetail = (product: ProductoAPI) => {
    if (!requireAuth()) return
    setSelectedProduct(product)
    setDetailOpen(true)
  }

  // Auto-open product from URL param (e.g. from promos)
  const autoOpenRef = useRef(true)
  useEffect(() => {
    if (autoOpenProductId && negocio && autoOpenRef.current) {
      // Only auto-open for authenticated users or mesa orders
      if (!isMesaOrder && !isAuthenticated()) {
        autoOpenRef.current = false
        return
      }
      const allProducts = [
        ...negocio.productosSinSeccion,
        ...negocio.secciones.flatMap((s) => s.productos),
      ]
      const product = allProducts.find((p) => p.id === autoOpenProductId)
      if (product) {
        autoOpenRef.current = false
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: auto-open product from URL deep link
        setSelectedProduct(product)
        setDetailOpen(true)
        // Clean URL
        window.history.replaceState({}, '', `/n/${slug}`)
      }
    }
  }, [autoOpenProductId, negocio, slug])

  // Handle add to cart (with auth + location gate)
  const handleAddToCart = (item: CartItem) => {
    if (!negocio) return
    if (!requireAuth()) return
    if (!requireLocation()) return
    if (activeNegocioId !== negocio.id) {
      setActiveNegocio(negocio.id, negocio.slug, negocio.nombre, effectiveDeliveryPrice)
    }
    addItem(item)
  }

  // Loading state
  if (!hydrated || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative h-44">
          <Skeleton className="w-full h-full rounded-none" />
        </div>
        <div className="px-4 pt-4">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !negocio) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <span className="text-5xl mb-4">😕</span>
        <h2 className="font-bold text-xl mb-2">No encontramos este local</h2>
        <p className="text-muted-foreground text-sm mb-4 text-center">
          Puede que no exista o no esté disponible en este momento.
        </p>
        <Link href="/">
          <Button className="rounded-full gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ===== PREVIEW BANNER ===== */}
      {isPreview && (
        <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="h-4 w-4 shrink-0" />
            <span className="text-sm font-bold truncate">Estás en modo vista previa</span>
          </div>
          <Link href="/" className="shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 rounded-full text-xs font-bold gap-1 bg-white/20 text-white hover:bg-white/30 border-0"
            >
              Volver al panel
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* ===== HERO BANNER ===== */}
      <div className="relative h-44 sm:h-52 lg:h-64">
        {negocio.bannerUrl ? (
          <img
            src={negocio.bannerUrl}
            alt={`Banner de ${negocio.nombre}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${negocio.colorPrincipal}40, ${negocio.colorPrincipal}15)`,
            }}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Back button */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          {mozoParam ? (
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/">
              <button className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const shareUrl = `${window.location.origin}/n/${negocio.slug}`
                const rubroVerb = isRopa ? "Comprá" : "Pedí"
                const rubroNoun = isRopa ? "las mejores prendas" : "los mejores platos"
                const shareText = negocio.mensajeBienvenida
                  ? `${negocio.mensajeBienvenida}\n\n${rubroVerb} en ${negocio.nombre} por Deligo 👇`
                  : `${rubroVerb} ${rubroNoun} en ${negocio.nombre} por Deligo 👇`
                const shareData = {
                  title: negocio.nombre,
                  text: shareText,
                  url: shareUrl,
                }
                if (navigator.share) {
                  navigator.share(shareData).catch(() => {})
                } else {
                  const fullText = `${shareText}\n${shareUrl}`
                  navigator.clipboard.writeText(fullText).then(() => {
                    toast.success("Mensaje copiado al portapapeles")
                  }).catch(() => {
                    toast.error("No se pudo copiar el enlace")
                  })
                }
              }}
              className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Business info over banner */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 z-10">
          <div className="flex items-end gap-3">
            {/* Logo */}
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-[3px] border-white shadow-lg overflow-hidden shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: negocio.logoUrl ? undefined : `${negocio.colorPrincipal}20`,
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
                  className="text-2xl sm:text-3xl font-extrabold"
                  style={{ color: negocio.colorPrincipal }}
                >
                  {negocio.nombre.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 text-white">
              <h1 className="font-extrabold text-xl sm:text-2xl drop-shadow-sm truncate">
                {negocio.nombre}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <HorariosPopover
                  horarios={negocio.horarios}
                  horarioMode={negocio.horarioMode}
                  abiertoManual={negocio.abiertoManual}
                  variant="badge"
                  darkBg
                />
                {negocio.rubro && (
                  <span className="text-xs text-white/80 capitalize">
                    {negocio.rubro === "restaurante"
                      ? "Restaurante"
                      : negocio.rubro === "ropa"
                      ? "Indumentaria"
                      : negocio.rubro === "negocio"
                      ? "Negocio"
                      : "Negocio"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
      {/* ===== MOZO BANNER (with mesa selector) ===== */}
      {mozoData && (
        <div
          className="mx-4 mt-3 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-300"
          style={{
            border: `1.5px solid ${negocio.colorPrincipal}30`,
          }}
        >
          {/* Mozo info row */}
          <div
            className="flex items-center gap-2.5 px-4 py-2.5"
            style={{ backgroundColor: `${negocio.colorPrincipal}08` }}
          >
            <UserCheck className="h-4 w-4 shrink-0" style={{ color: negocio.colorPrincipal }} />
            <span className="text-sm font-semibold" style={{ color: negocio.colorPrincipal }}>
              Modo mozo — {mozoData.nombre}
            </span>
            {(mozoSelectedMesa || mesaNumero) && (
              <Badge
                className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg"
                style={{
                  backgroundColor: `${negocio.colorPrincipal}15`,
                  color: negocio.colorPrincipal,
                  border: `1px solid ${negocio.colorPrincipal}25`,
                }}
              >
                Mesa {mozoSelectedMesa?.numero ?? mesaNumero}
              </Badge>
            )}
          </div>

          {/* Mesa selection row — if mesaNumero is already set (from URL), show the mesa directly */}
          {mesaNumero && mozoData ? (
            <div
              className="w-full flex items-center gap-3 px-4 py-3"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${negocio.colorPrincipal}12` }}
              >
                <Armchair
                  className="h-5 w-5"
                  style={{ color: negocio.colorPrincipal }}
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold" style={{ color: negocio.colorPrincipal }}>
                  Mesa {mesaNumero}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pedido para esta mesa
                </p>
              </div>
            </div>
          ) : !mozoSelectedMesa ? (
            <button
              onClick={() => setMesaSelectorOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors active:scale-[0.99]"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${negocio.colorPrincipal}12` }}
              >
                <Armchair
                  className="h-5 w-5"
                  style={{ color: negocio.colorPrincipal }}
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold" style={{ color: negocio.colorPrincipal }}>
                  Seleccioná una mesa
                </p>
                <p className="text-xs text-muted-foreground">
                  Elegí la mesa para tomar el pedido
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <button
              onClick={() => setMesaSelectorOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${negocio.colorPrincipal}12` }}
              >
                <Armchair
                  className="h-5 w-5"
                  style={{ color: negocio.colorPrincipal }}
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold" style={{ color: negocio.colorPrincipal }}>
                  Mesa {mozoSelectedMesa.numero}
                  {mozoSelectedMesa.nombre ? ` — ${mozoSelectedMesa.nombre}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tocá para cambiar de mesa
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* ===== MESA BANNER (customer via QR, no mozo) ===== */}
      {isMesaOrder && mesaNumero && !mozoData && (
        <div
          className="mx-4 mt-3 p-3 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300"
          style={{
            backgroundColor: `${negocio.colorPrincipal}10`,
            borderColor: `${negocio.colorPrincipal}30`,
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${negocio.colorPrincipal}15` }}
          >
            <Armchair
              className="h-5 w-5"
              style={{ color: negocio.colorPrincipal }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-bold"
              style={{ color: negocio.colorPrincipal }}
            >
              Mesa {mesaNumero}
            </p>
            <p className="text-xs text-muted-foreground">
              {customerMesaData?.mozoAsignado
                ? `Tu mozo: ${customerMesaData.mozoAsignado.nombre}`
                : "Tu pedido será servido en esta mesa"}
            </p>
          </div>
        </div>
      )}

      {/* ===== CLOSED BANNER ===== */}
      {!isOpen && !isPreview && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700 dark:text-red-300">Local cerrado</p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70">
              Tocá "Cerrado" arriba para ver los horarios · Hoy: {getTodayHoursLabel(negocio.horarios)}
            </p>
          </div>
        </div>
      )}

      {/* ===== INFO BAR ===== */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap text-sm">
        {negocio.puntuacionPromedio > 0 && (
          <button
            onClick={() => setShowReviews(true)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                {negocio.puntuacionPromedio.toFixed(1)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              ({negocio.totalResenas})
            </span>
          </button>
        )}
        {negocio.ofreceDelivery && (
          <span className={cn("flex items-center gap-1 text-xs", isRopa ? "text-muted-foreground" : "text-muted-foreground")}>
            <Bike className="h-3.5 w-3.5 text-primary" />
            <span className={cn("font-semibold", isRopa ? "text-muted-foreground" : "text-foreground")}>
              {effectiveDeliveryPrice > 0 ? formatPrice(effectiveDeliveryPrice) : "Gratis"}
            </span>
          </span>
        )}
        {!isRopa && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {negocio.tiempoEntrega} min
          </span>
        )}
        {/* Payment method indicators */}
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Banknote className="h-3.5 w-3.5" />
            Efectivo
          </span>
          {negocio.aceptaTransferencia && (
            <span className="flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400">
              <CreditCard className="h-3.5 w-3.5" />
              Transferencia
            </span>
          )}
        </div>
        {negocio.mostrarVentas && (negocio.totalVentas ?? 0) > 0 && (
          <span className={cn("flex items-center gap-1 text-xs", isRopa ? "font-bold text-sm text-emerald-600 dark:text-emerald-400" : "font-semibold text-emerald-600 dark:text-emerald-400")}>
            <ShoppingBag className={cn("h-3.5 w-3.5", isRopa && "h-4 w-4")} />
            {negocio.totalVentas}+ ventas
          </span>
        )}
      </div>

      {/* ===== SOCIAL MEDIA ===== */}
      {(negocio.instagram || negocio.facebook) && (
        <div className="px-4 pb-2 flex items-center gap-2">
          {negocio.instagram && (
            <a
              href={negocio.instagram.startsWith("http") ? negocio.instagram : `https://instagram.com/${negocio.instagram.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-800/30 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:from-purple-500/20 hover:to-pink-500/20 transition-colors"
            >
              <Instagram className="h-3.5 w-3.5" />
              {negocio.instagram.startsWith("@") ? negocio.instagram : `@${negocio.instagram.replace("https://instagram.com/", "").replace("https://www.instagram.com/", "").replace("/", "")}`}
            </a>
          )}
          {negocio.facebook && (
            <a
              href={negocio.facebook.startsWith("http") ? negocio.facebook : `https://facebook.com/${negocio.facebook}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-200/50 dark:border-blue-800/30 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-500/15 transition-colors"
            >
              <Facebook className="h-3.5 w-3.5" />
              Facebook
            </a>
          )}
        </div>
      )}

      {/* Welcome message */}
      {negocio.mensajeBienvenida && (
        <div className="px-4 pb-2">
          <p
            className="text-sm font-medium px-3 py-2 rounded-xl"
            style={{
              backgroundColor: `${negocio.colorPrincipal}10`,
              color: negocio.colorPrincipal,
            }}
          >
            {negocio.mensajeBienvenida}
          </p>
        </div>
      )}

      {/* ===== SEARCH BAR ===== */}
      <div className="px-4 pb-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={isRopa ? "Buscar productos..." : "Buscar en el menú..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-muted/50 border-border/50 focus-visible:ring-primary/30 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ===== CATEGORY PILLS ===== */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200",
                activeCategory === cat
                  ? "text-white shadow-md"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
              style={
                activeCategory === cat
                  ? { backgroundColor: negocio.colorPrincipal, boxShadow: `0 4px 14px ${negocio.colorPrincipal}40` }
                  : undefined
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CATALOG SECTIONS ===== */}
      {negocio.secciones.length > 0 && activeCategory === "Todas" && !searchQuery && (
        <div className="space-y-5 mb-6">
          {negocio.secciones.map((seccion) => (
            <CatalogSection
              key={seccion.id}
              seccion={seccion}
              negocio={negocio}
              onProductClick={openProductDetail}
              isPreview={isPreview}
              isRopa={isRopa}
            />
          ))}
        </div>
      )}

      {/* ===== PRODUCT GRID ===== */}
      <div className="px-4">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <h3 className="font-bold text-base">Sin resultados</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No hay productos que coincidan con tu búsqueda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <div key={product.id}>
                <ProductCard
                  product={product}
                  negocio={negocio}
                  onClick={() => openProductDetail(product)}
                  onAddToCart={handleAddToCart}
                  isPreview={isPreview}
                  isRopa={isRopa}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== CART PANEL ===== */}
      {!isPreview && (
        <CartPanel
          negocio={negocio}
          isOpen={isOpen}
          mesaNumero={effectiveMesaNumero}
          mesaId={effectiveMesaId}
          mozoCodigo={mozoData?.codigo}
          mozoNombre={mozoData?.nombre}
          canOrder={canOrder}
          onRequireAuth={requireAuth}
          onRequireLocation={requireLocation}
        />
      )}

      {/* ===== MESA SELECTOR SHEET (for mozos) ===== */}
      {mozoData && negocio && (
        <MesaSelectorSheet
          open={mesaSelectorOpen}
          onOpenChange={setMesaSelectorOpen}
          negocioSlug={negocio.slug}
          negocioId={negocio.id}
          negocioNombre={negocio.nombre}
          colorPrincipal={negocio.colorPrincipal}
          mozoCodigo={mozoData.codigo}
          mozoNombre={mozoData.nombre}
          onMesaSelected={(mesa) => setMozoSelectedMesa(mesa)}
          selectedMesaId={mozoSelectedMesa?.id}
        />
      )}

      {/* ===== PRODUCT DETAIL DRAWER ===== */}
      <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
        <DrawerContent className="h-[92dvh] rounded-t-2xl md:max-w-2xl md:mx-auto md:rounded-2xl">
          <DrawerTitle className="sr-only">Detalle del producto</DrawerTitle>
          <DrawerDescription className="sr-only">Información y opciones del producto</DrawerDescription>
          {selectedProduct && (
            <ProductDetailSheet
              product={selectedProduct}
              negocio={negocio}
              onAddToCart={(item) => {
                handleAddToCart(item)
                setDetailOpen(false)
              }}
              isRopa={isRopa}
            />
          )}
        </DrawerContent>
      </Drawer>

      {/* ===== REVIEWS DRAWER ===== */}
      <Drawer open={showReviews} onOpenChange={setShowReviews}>
        <DrawerContent className="h-[70dvh] rounded-t-2xl md:max-w-2xl md:mx-auto md:rounded-2xl">
          <DrawerTitle className="sr-only">Reseñas</DrawerTitle>
          <DrawerDescription className="sr-only">Reseñas de clientes del local</DrawerDescription>
          <ReviewsSheet negocio={negocio} />
        </DrawerContent>
      </Drawer>

      {/* ===== AUTH MODAL ===== */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialRole="cliente"
      />

      {/* ===== LOCATION PICKER MODAL ===== */}
      <LocationPickerModal
        open={locationPickerOpen}
        onOpenChange={setLocationPickerOpen}
        required={!deliveryAddress}
        colorPrincipal={negocio?.colorPrincipal}
      />

      {/* ===== ADDRESS SELECTOR SHEET ===== */}
      <AddressSelectorSheet
        open={addressSelectorOpen}
        onOpenChange={setAddressSelectorOpen}
        onAddNew={() => {
          setAddressSelectorOpen(false)
          setLocationPickerOpen(true)
        }}
      />

      </div>{/* end max-w-5xl */}
    </div>
  )
}

// ============================================
// Catalog Section Component (horizontal/vertical)
// ============================================
function CatalogSection({
  seccion,
  negocio,
  onProductClick,
  isPreview = false,
  isRopa = false,
}: {
  seccion: SeccionAPI
  negocio: NegocioAPI
  onProductClick: (p: ProductoAPI) => void
  isPreview?: boolean
  isRopa?: boolean
}) {
  if (seccion.productos.length === 0) return null

  const isHorizontal = seccion.orientacion === "horizontal"
  const sectionColor = seccion.color || negocio.colorPrincipal

  return (
    <div>
      {/* Section header with color accent */}
      <div className="px-4 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-1 h-5 rounded-full shrink-0"
            style={{ backgroundColor: sectionColor }}
          />
          <h3 className="font-bold text-base" style={{ color: sectionColor }}>
            {seccion.nombre}
          </h3>
        </div>
        {seccion.productos.length > 3 && (
          <button
            className="text-xs font-semibold flex items-center gap-0.5"
            style={{ color: sectionColor }}
          >
            Ver todo <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {isHorizontal ? (
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
          {seccion.productos.map((product) => (
            <div key={product.id} className={cn("shrink-0", isRopa ? "w-36 sm:w-40" : "w-40 sm:w-44")}>
              <ProductCard
                product={product}
                negocio={negocio}
                onClick={() => onProductClick(product)}
                compact
                isPreview={isPreview}
                isRopa={isRopa}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {seccion.productos.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              negocio={negocio}
              onClick={() => onProductClick(product)}
              isPreview={isPreview}
              isRopa={isRopa}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// Product Card Component
// ============================================
// Helper: map color name to CSS color for ropa color circles
const COLOR_MAP: Record<string, string> = {
  rojo: "#EF4444", azul: "#3B82F6", verde: "#22C55E", amarillo: "#EAB308",
  negro: "#1F2937", blanco: "#F9FAFB", rosa: "#EC4899", violeta: "#8B5CF6",
  naranja: "#F97316", marron: "#92400E", gris: "#6B7280", celeste: "#67E8F9",
  beige: "#D2B48C", dorado: "#D4A843", plateado: "#A8A9AD", burdeos: "#800020",
  turquesa: "#40E0D0", mostaza: "#E1AD01", coral: "#FF7F50", lila: "#C8A2C8",
  arena: "#D4C5A9", camel: "#C19A6B", crema: "#FFFDD0", granate: "#800000",
}

function colorToCss(colorName: string): string {
  const lower = colorName.toLowerCase().trim()
  // If it looks like a hex color, use it directly
  if (lower.startsWith("#") && (lower.length === 4 || lower.length === 7)) return lower
  // Try known map
  if (COLOR_MAP[lower]) return COLOR_MAP[lower]
  // Fallback: use the string as-is (may render as named CSS color)
  return lower
}

function ProductCard({
  product,
  negocio,
  onClick,
  onAddToCart,
  compact = false,
  isPreview = false,
  isRopa = false,
}: {
  product: ProductoAPI
  negocio: NegocioAPI
  onClick: () => void
  onAddToCart?: (item: CartItem) => void
  compact?: boolean
  isPreview?: boolean
  isRopa?: boolean
}) {
  const cartItems = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)

  // Check if product is in cart
  const cartCount = cartItems
    .filter((i) => i.productoId === product.id)
    .reduce((sum, i) => sum + i.cantidad, 0)

  // For ropa: only agregados/talles/colores/shared options require detail, NOT ingredientes/secciones
  const hasOptionsForQuickAdd = isRopa
    ? (product.agregados && product.agregados.length > 0) ||
      (product.talles && product.talles.length > 0) ||
      (product.colores && product.colores.length > 0) ||
      (product.opcionesCompartidasIds && product.opcionesCompartidasIds.length > 0)
    : (product.secciones && product.secciones.length > 0) ||
      (product.agregados && product.agregados.length > 0) ||
      (product.ingredientes && product.ingredientes.length > 0) ||
      (product.talles && product.talles.length > 0) ||
      (product.colores && product.colores.length > 0) ||
      (product.opcionesCompartidasIds && product.opcionesCompartidasIds.length > 0)

  const quickAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!product.stock) return

    if (hasOptionsForQuickAdd) {
      onClick()
      return
    }

    const itemData = {
      productoId: product.id,
      nombre: product.nombre,
      precio: product.precioPromo ?? product.precio,
      cantidad: 1,
      agregados: [],
      secciones: {},
      ingredientesQuitados: [],
      talle: "",
      color: "",
      notas: "",
    }
    const item: CartItem = {
      ...itemData,
      key: generateCartItemKey(itemData),
    }
    if (onAddToCart) {
      onAddToCart(item)
    } else {
      addItem(item)
    }
    toast.success(`${product.nombre} agregado al carrito`, {
      duration: 2000,
    })
  }

  // ==================== ROPA-STYLE CARD ====================
  if (isRopa) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "group cursor-pointer bg-card overflow-hidden hover:shadow-lg transition-all duration-300",
          !product.stock && "opacity-60"
        )}
      >
        {/* Portrait image (3:4) */}
        <div className="relative aspect-[3/4] bg-muted/30 overflow-hidden">
          {product.imagenUrl ? (
            <img
              src={product.imagenUrl}
              alt={product.nombre}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${negocio.colorPrincipal}18, ${negocio.colorPrincipal}08)`,
              }}
            >
              <span className="text-4xl opacity-20">👕</span>
            </div>
          )}

          {/* Stock badge */}
          {!product.stock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Badge className="bg-black/70 text-white border-0 text-xs font-bold">
                Sin stock
              </Badge>
            </div>
          )}

          {/* Discount badge */}
          {product.descuentoLabel && product.stock && (
            <Badge
              className="absolute top-2 left-2 bg-red-500 text-white border-0 text-[10px] font-bold px-1.5 py-0.5 shadow-md"
            >
              {product.descuentoLabel}
            </Badge>
          )}

          {/* Quick-add with ShoppingBag icon */}
          {product.stock && !compact && !isPreview && (
            <button
              onClick={quickAdd}
              className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white dark:bg-card shadow-md flex items-center justify-center hover:scale-110 transition-transform"
              style={{ color: negocio.colorPrincipal }}
            >
              {hasOptionsForQuickAdd ? (
                <Settings2 className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <ShoppingBag className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          )}

          {/* Cart count badge */}
          {cartCount > 0 && (
            <div
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md"
              style={{ backgroundColor: negocio.colorPrincipal }}
            >
              {cartCount}
            </div>
          )}
        </div>

        {/* Info — clean, minimal, fashion e-commerce style */}
        <div className={cn("pt-2.5 pb-1", compact && "pt-2")}>
          <h4 className={cn("font-semibold leading-tight line-clamp-2", compact ? "text-[11px]" : "text-sm")}>
            {product.nombre}
          </h4>

          {/* Material & Gender as subtle text */}
          {!compact && (product.material || product.genero) && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
              {[product.material, product.genero].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="flex items-baseline gap-1.5 mt-1">
            {product.precioPromo ? (
              <>
                <span
                  className={cn("font-bold", compact ? "text-xs" : "text-sm")}
                  style={{ color: negocio.colorPrincipal }}
                >
                  {formatPrice(product.precioPromo)}
                </span>
                <span className="text-[10px] text-muted-foreground line-through">
                  {formatPrice(product.precio)}
                </span>
              </>
            ) : (
              <span className={cn("font-bold", compact ? "text-xs" : "text-sm")}>
                {formatPrice(product.precio)}
              </span>
            )}
          </div>

          {/* Color circles */}
          {Array.isArray(product.colores) && product.colores.length > 0 && !compact && (
            <div className="flex items-center gap-1.5 mt-2">
              {product.colores.slice(0, 5).map((c) => (
                <div
                  key={c}
                  className="w-4 h-4 rounded-full border border-border/60 shadow-sm"
                  style={{ backgroundColor: colorToCss(c) }}
                  title={c}
                />
              ))}
              {product.colores.length > 5 && (
                <span className="text-[9px] text-muted-foreground ml-0.5">
                  +{product.colores.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Talle badges — minimal row */}
          {Array.isArray(product.talles) && product.talles.length > 0 && !compact && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {product.talles.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/60 font-medium bg-background"
                >
                  {t}
                </span>
              ))}
              {product.talles.length > 4 && (
                <span className="text-[9px] px-0.5 text-muted-foreground">
                  +{product.talles.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==================== DEFAULT (FOOD) CARD ====================
  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-2xl bg-card border border-border/50 overflow-hidden hover:shadow-md transition-all duration-200",
        !product.stock && "opacity-60"
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] sm:aspect-square bg-muted/30 overflow-hidden">
        {product.imagenUrl ? (
          <img
            src={product.imagenUrl}
            alt={product.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${negocio.colorPrincipal}18, ${negocio.colorPrincipal}08)`,
            }}
          >
            <span className="text-3xl opacity-20">
              {negocio.rubro === "restaurante" ? "🍽️" : negocio.rubro === "ropa" ? "👕" : "🛒"}
            </span>
          </div>
        )}

        {/* Stock badge */}
        {!product.stock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge className="bg-black/70 text-white border-0 text-xs font-bold">
              Sin stock
            </Badge>
          </div>
        )}

        {/* Discount badge */}
        {product.descuentoLabel && product.stock && (
          <Badge
            className="absolute top-2 left-2 bg-red-500 text-white border-0 text-[10px] font-bold px-1.5 py-0.5 shadow-md"
          >
            {product.descuentoLabel}
          </Badge>
        )}

        {/* Quick add / Open detail button */}
        {product.stock && !compact && !isPreview && (
          <button
            onClick={quickAdd}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white dark:bg-card shadow-md flex items-center justify-center hover:scale-110 transition-transform"
            style={{ color: negocio.colorPrincipal }}
          >
            {hasOptionsForQuickAdd ? (
              <Settings2 className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <Plus className="h-4 w-4" strokeWidth={3} />
            )}
          </button>
        )}

        {/* Cart count badge */}
        {cartCount > 0 && (
          <div
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md"
            style={{ backgroundColor: negocio.colorPrincipal }}
          >
            {cartCount}
          </div>
        )}
      </div>

      {/* Info */}
      <div className={cn("p-2.5", compact && "p-2")}>
        <h4 className={cn("font-bold leading-tight line-clamp-2", compact ? "text-xs" : "text-sm")}>
          {product.nombre}
        </h4>

        {product.descripcion && !compact && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
            {product.descripcion}
          </p>
        )}

        <div className="flex items-baseline gap-1.5 mt-1.5">
          {product.precioPromo ? (
            <>
              <span
                className={cn("font-extrabold", compact ? "text-xs" : "text-sm")}
                style={{ color: negocio.colorPrincipal }}
              >
                {formatPrice(product.precioPromo)}
              </span>
              <span className="text-[10px] text-muted-foreground line-through">
                {formatPrice(product.precio)}
              </span>
            </>
          ) : (
            <span className={cn("font-extrabold", compact ? "text-xs" : "text-sm")}>
              {formatPrice(product.precio)}
            </span>
          )}
        </div>

        {/* Has options indicator */}
        {((Array.isArray(product.agregados) ? product.agregados.length : 0) > 0 || (Array.isArray(product.ingredientes) ? product.ingredientes.length : 0) > 0 || (Array.isArray(product.secciones) ? product.secciones.length : 0) > 0) && !compact && (
          <div className="flex items-center gap-1 mt-1">
            <Info className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {product.agregados.length > 0 && `${product.agregados.length} agregado${product.agregados.length > 1 ? "s" : ""}`}
              {product.agregados.length > 0 && product.ingredientes.length > 0 && " · "}
              {product.ingredientes.length > 0 && `${product.ingredientes.length} ingrediente${product.ingredientes.length > 1 ? "s" : ""}`}
            </span>
          </div>
        )}

        {/* Sizes/colors for ropa */}
        {Array.isArray(product.talles) && product.talles.length > 0 && !compact && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {product.talles.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-semibold"
              >
                {t}
              </span>
            ))}
            {product.talles.length > 4 && (
              <span className="text-[9px] px-1.5 py-0.5 text-muted-foreground">
                +{product.talles.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Product Detail Sheet
// ============================================
function ProductDetailSheet({
  product,
  negocio,
  onAddToCart,
  isRopa = false,
}: {
  product: ProductoAPI
  negocio: NegocioAPI
  onAddToCart: (item: CartItem) => void
  isRopa?: boolean
}) {
  const [quantity, setQuantity] = useState(1)
  const [selectedAgregados, setSelectedAgregados] = useState<Map<string, CartItemAgregado>>(new Map())
  const [removedIngredientes, setRemovedIngredientes] = useState<Set<string>>(new Set())
  const [selectedSecciones, setSelectedSecciones] = useState<CartItemSecciones>({})
  const [selectedTalle, setSelectedTalle] = useState("")
  const [selectedColor, setSelectedColor] = useState("")
  const [notas, setNotas] = useState("")
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [selectedOpcionesCompartidas, setSelectedOpcionesCompartidas] = useState<Map<string, CartItemAgregado>>(new Map())

  // Resolve shared options from product's opcionesCompartidasIds against negocio's opcionesCompartidas
  // Uses per-product obligatorio/maximo (not the shared option's defaults)
  const resolvedOpcionesCompartidas = useMemo(() => {
    if (!product.opcionesCompartidasIds || product.opcionesCompartidasIds.length === 0) return []
    const sharedList = negocio.opcionesCompartidas || []
    return product.opcionesCompartidasIds
      .map((cfg) => {
        const shared = sharedList.find(oc => oc.id === cfg.id)
        if (!shared) return null
        // opciones might still be a JSON string if API didn't parse it properly
        let opciones: Array<{ nombre: string; precio: number }> = []
        if (Array.isArray(shared.opciones)) {
          opciones = shared.opciones
        } else if (typeof shared.opciones === 'string') {
          try { opciones = JSON.parse(shared.opciones) } catch { opciones = [] }
          if (!Array.isArray(opciones)) opciones = []
        }
        return {
          id: shared.id,
          nombre: shared.nombre,
          opciones,
          obligatorio: cfg.obligatorio, // per-product override
          maximo: cfg.maximo,           // per-product override
        }
      })
      .filter(Boolean) as Array<{ id: string; nombre: string; opciones: Array<{ nombre: string; precio: number }>; obligatorio: boolean; maximo: number }>
  }, [product.opcionesCompartidasIds, negocio.opcionesCompartidas])

  // Group agregados by category
  const agregadosByCategory = useMemo(() => {
    const map = new Map<string, ProductoAPI["agregados"]>()
    for (const a of product.agregados || []) {
      const cat = a.categoria || "Sin categoría"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(a)
    }
    return map
  }, [product.agregados])

  // Group ingredientes by category
  const ingredientesByCategory = useMemo(() => {
    const map = new Map<string, ProductoAPI["ingredientes"]>()
    for (const i of product.ingredientes || []) {
      const cat = i.categoria || "Sin categoría"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(i)
    }
    return map
  }, [product.ingredientes])

  // Calculate item total
  const itemTotal = useMemo(() => {
    const basePrice = product.precioPromo ?? product.precio
    const agregadosTotal = Array.from(selectedAgregados.values()).reduce(
      (sum, a) => sum + a.precio,
      0
    )
    const opcionesCompartidasTotal = Array.from(selectedOpcionesCompartidas.values()).reduce(
      (sum, a) => sum + a.precio,
      0
    )
    return (basePrice + agregadosTotal + opcionesCompartidasTotal) * quantity
  }, [product.precio, product.precioPromo, selectedAgregados, selectedOpcionesCompartidas, quantity])

  // Toggle agregado
  const toggleAgregado = (a: { id: string; nombre: string; precio: number }) => {
    setSelectedAgregados((prev) => {
      const next = new Map(prev)
      if (next.has(a.id)) {
        next.delete(a.id)
      } else {
        next.set(a.id, { id: a.id, nombre: a.nombre, precio: a.precio })
      }
      return next
    })
  }

  // Toggle ingrediente removal
  const toggleIngrediente = (id: string) => {
    setRemovedIngredientes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Handle section option selection
  const selectSectionOption = (sectionName: string, option: string) => {
    setSelectedSecciones((prev) => ({
      ...prev,
      [sectionName]: prev[sectionName] === option ? "" : option,
    }))
  }

  // Handle multi-select section option quantity
  const adjustSectionOptionQty = (sectionName: string, option: string, delta: number, maximo: number) => {
    setSelectedSecciones((prev) => {
      const current = prev[sectionName]
      const qtyMap: Record<string, number> =
        current && typeof current === "object" ? { ...current } : {}

      const currentQty = qtyMap[option] || 0
      const newQty = currentQty + delta

      // Calculate total selected so far
      const totalSelected = Object.entries(qtyMap)
        .filter(([k]) => k !== option)
        .reduce((sum, [, v]) => sum + v, 0)

      if (newQty <= 0) {
        delete qtyMap[option]
      } else if (totalSelected + newQty <= maximo) {
        qtyMap[option] = newQty
      } else {
        return prev // would exceed max
      }

      return { ...prev, [sectionName]: qtyMap }
    })
  }

  // Get total selections for a multi-select section
  const getSectionTotal = (sectionName: string): number => {
    const val = selectedSecciones[sectionName]
    if (!val) return 0
    if (typeof val === "string") return val ? 1 : 0
    return Object.values(val).reduce((sum, v) => sum + v, 0)
  }

  // Get quantity of a specific option in a multi-select section
  const getOptionQty = (sectionName: string, option: string): number => {
    const val = selectedSecciones[sectionName]
    if (!val || typeof val === "string") return 0
    return val[option] || 0
  }

  // Handle add to cart
  const handleAdd = () => {
    // Validate required sections
    for (const section of product.secciones || []) {
      if (!section.obligatorio) continue
      const val = selectedSecciones[section.nombre]
      const maximo = section.maximo || 0
      if (!val) return // nothing selected
      if (typeof val === "object") {
        const total = Object.values(val).reduce((s, v) => s + v, 0)
        if (maximo > 1 && total < maximo) return // must reach max for multi-select
        if (total === 0) return
      }
    }

    // Validate required shared options
    for (const oc of resolvedOpcionesCompartidas) {
      if (!oc.obligatorio) continue
      const selectedCount = Array.from(selectedOpcionesCompartidas.keys()).filter(key => key.startsWith(`${oc.id}::`)).length
      const requiredCount = oc.maximo && oc.maximo > 1 ? oc.maximo : 1
      if (selectedCount < requiredCount) return
    }

    // Get removed ingredient names for display
    const removedNames = (product.ingredientes || [])
      .filter((i) => removedIngredientes.has(i.id))
      .map((i) => i.nombre)

    // Merge shared option selections as agregados
    const allAgregados = [
      ...Array.from(selectedAgregados.values()),
      ...Array.from(selectedOpcionesCompartidas.values()),
    ]

    const itemData = {
      productoId: product.id,
      nombre: product.nombre,
      precio: product.precioPromo ?? product.precio,
      cantidad: quantity,
      agregados: allAgregados,
      secciones: selectedSecciones,
      ingredientesQuitados: removedNames,
      talle: selectedTalle,
      color: selectedColor,
      notas,
    }

    const item: CartItem = {
      ...itemData,
      key: generateCartItemKey(itemData),
    }
    onAddToCart(item)
    toast.success(`${quantity}x ${product.nombre} agregado al carrito`, {
      duration: 2000,
    })
  }

  // Check if can add (required sections + shared options satisfied)
  const canAdd = (() => {
    const sectionsOk = (product.secciones || [])
      .filter((s) => s.obligatorio)
      .every((s) => {
        const val = selectedSecciones[s.nombre]
        const maximo = s.maximo || 0
        if (!val) return false
        if (typeof val === "object") {
          const total = Object.values(val).reduce((sum, v) => sum + v, 0)
          if (maximo > 1) return total >= maximo
          return total > 0
        }
        return !!val
      })

    if (!sectionsOk) return false

    const sharedOk = resolvedOpcionesCompartidas
      .filter(oc => oc.obligatorio)
      .every(oc => {
        const selectedCount = Array.from(selectedOpcionesCompartidas.keys()).filter(key => key.startsWith(`${oc.id}::`)).length
        const requiredCount = oc.maximo && oc.maximo > 1 ? oc.maximo : 1
        return selectedCount >= requiredCount
      })

    return sharedOk
  })()

  return (
    <div className="flex flex-col h-full relative">
      {/* ===== TOP: Product image ===== */}
      <div className="shrink-0">
        <div className={cn("relative bg-muted/30", isRopa ? "aspect-[3/4]" : "aspect-[3/2]")}>
          {isRopa && product.imagenesExtra && product.imagenesExtra.length > 0 ? (
            // Ropa: image gallery with thumbnails
            <div className="relative w-full h-full">
              <img
                src={activeImageIdx === 0 ? (product.imagenUrl || "") : product.imagenesExtra[activeImageIdx - 1]}
                alt={product.nombre}
                className="w-full h-full object-cover"
              />
              {product.descuentoLabel && (
                <Badge className="absolute top-3 left-3 bg-red-500 text-white border-0 text-sm font-bold px-3 py-1 shadow-lg">
                  {product.descuentoLabel}
                </Badge>
              )}
              {/* Image dots */}
              {((product.imagenUrl ? 1 : 0) + (product.imagenesExtra || []).length) > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {[product.imagenUrl, ...(product.imagenesExtra || [])].filter(Boolean).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        idx === activeImageIdx ? "bg-white w-5" : "bg-white/50"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : product.imagenUrl ? (
            <img
              src={product.imagenUrl}
              alt={product.nombre}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${negocio.colorPrincipal}25, ${negocio.colorPrincipal}10)`,
              }}
            >
              <span className="text-6xl opacity-20">
                {negocio.rubro === "restaurante" ? "🍽️" : negocio.rubro === "ropa" ? "👕" : "🛒"}
              </span>
            </div>
          )}
          {!isRopa && product.descuentoLabel && (
            <Badge className="absolute top-3 left-3 bg-red-500 text-white border-0 text-sm font-bold px-3 py-1 shadow-lg">
              {product.descuentoLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* ===== BOTTOM: Product options (scrollable) ===== */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-4 md:pb-24">
          {/* Product name & price */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-extrabold text-xl leading-tight">{product.nombre}</h2>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{product.categoria}</p>
            </div>
            <div className="text-right shrink-0">
              {product.precioPromo ? (
                <div>
                  <span
                    className="font-extrabold text-xl"
                    style={{ color: negocio.colorPrincipal }}
                  >
                    {formatPrice(product.precioPromo)}
                  </span>
                  <div className="text-xs text-muted-foreground line-through">
                    {formatPrice(product.precio)}
                  </div>
                </div>
              ) : (
                <span className="font-extrabold text-xl">{formatPrice(product.precio)}</span>
              )}
            </div>
          </div>

          {/* Description */}
          {product.descripcion && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              {product.descripcion}
            </p>
          )}

          {/* Material & Gender (ropa) — show as info badges for ropa, subtle for food */}
          {(product.material || product.genero) && (
            <div className="flex gap-2 mt-3">
              {product.material && (
                <Badge variant="secondary" className={cn("text-xs", isRopa && "border px-3 py-1 font-medium")}>
                  {isRopa ? `🧵 ${product.material}` : product.material}
                </Badge>
              )}
              {product.genero && (
                <Badge variant="secondary" className={cn("text-xs", isRopa && "border px-3 py-1 font-medium")}>
                  {isRopa ? `👤 ${product.genero}` : product.genero}
                </Badge>
              )}
            </div>
          )}

          <Separator className="my-5" />

          {/* ===== TALLES ===== */}
          {Array.isArray(product.talles) && product.talles.length > 0 && (
            <div className="mb-5">
              <h4 className="font-bold text-sm mb-2">Talle</h4>
              <div className={cn("flex gap-2 flex-wrap", isRopa && "gap-3")}>
                {product.talles.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTalle(selectedTalle === t ? "" : t)}
                    className={cn(
                      isRopa
                        ? "min-w-[44px] min-h-[44px] px-5 py-3 rounded-2xl text-sm font-bold border-2 transition-all"
                        : "px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                      selectedTalle === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-primary/30"
                    )}
                    style={
                      selectedTalle === t
                        ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}15`, color: negocio.colorPrincipal }
                        : undefined
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== COLORES ===== */}
          {Array.isArray(product.colores) && product.colores.length > 0 && (
            <div className="mb-5">
              <h4 className="font-bold text-sm mb-2">Color</h4>
              {isRopa ? (
                /* Ropa: colored circles with name labels — tappable */
                <div className="flex gap-3 flex-wrap">
                  {product.colores.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(selectedColor === c ? "" : c)}
                      className="flex flex-col items-center gap-1 group/color"
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center",
                          selectedColor === c
                            ? "border-foreground scale-110 shadow-md"
                            : "border-border group-hover/color:border-foreground/40"
                        )}
                        style={{ backgroundColor: colorToCss(c) }}
                      >
                        {selectedColor === c && (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] leading-tight",
                        selectedColor === c ? "font-bold text-foreground" : "text-muted-foreground"
                      )}>
                        {c}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                /* Default: text buttons */
                <div className="flex gap-2 flex-wrap">
                  {product.colores.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(selectedColor === c ? "" : c)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                        selectedColor === c
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:border-primary/30"
                      )}
                      style={
                        selectedColor === c
                          ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}15`, color: negocio.colorPrincipal }
                          : undefined
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== CUSTOM SECTIONS (hidden for ropa) ===== */}
          {!isRopa && Array.isArray(product.secciones) && product.secciones.length > 0 && (
            <div className="space-y-5 mb-5">
              {product.secciones.map((section) => {
                const maximo = section.maximo || 0
                const isMultiSelect = maximo > 1
                const sectionTotal = getSectionTotal(section.nombre)
                const isAtMax = isMultiSelect && sectionTotal >= maximo
                const isIncomplete = isMultiSelect && section.obligatorio && sectionTotal > 0 && sectionTotal < maximo

                return (
                  <div key={section.nombre}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-sm">{section.nombre}</h4>
                      {section.obligatorio && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          Obligatorio
                        </Badge>
                      )}
                      {isMultiSelect && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5",
                            isAtMax
                              ? "border-primary text-primary"
                              : isIncomplete
                                ? "border-orange-400 text-orange-600 dark:text-orange-400"
                                : "text-muted-foreground"
                          )}
                          style={isAtMax ? { borderColor: negocio.colorPrincipal, color: negocio.colorPrincipal } : undefined}
                        >
                          {sectionTotal}/{maximo}
                        </Badge>
                      )}
                    </div>

                    {isMultiSelect ? (
                      /* Multi-select with per-option quantity */
                      <div className="space-y-1.5">
                        {(section.opciones || []).map((option, optIdx) => {
                          const optLabel = typeof option === 'string' ? option : String(option ?? '')
                          const qty = getOptionQty(section.nombre, optLabel)
                          const isSelected = qty > 0
                          return (
                            <div
                              key={`${section.nombre}-opt-${optIdx}`}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-sm transition-all",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border bg-card"
                              )}
                              style={
                                isSelected
                                  ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}08` }
                                  : undefined
                              }
                            >
                              <span className="font-medium flex-1">{optLabel}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => adjustSectionOptionQty(section.nombre, optLabel, -1, maximo)}
                                  className={cn(
                                    "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
                                    isSelected
                                      ? "border-primary text-primary"
                                      : "border-muted-foreground/20 text-muted-foreground/30"
                                  )}
                                  style={isSelected ? { borderColor: negocio.colorPrincipal, color: negocio.colorPrincipal } : undefined}
                                  disabled={!isSelected}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span
                                  className={cn(
                                    "w-6 text-center font-bold text-sm",
                                    isSelected ? "text-primary" : "text-muted-foreground/40"
                                  )}
                                  style={isSelected ? { color: negocio.colorPrincipal } : undefined}
                                >
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustSectionOptionQty(section.nombre, optLabel, 1, maximo)}
                                  className={cn(
                                    "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
                                    isAtMax && !isSelected
                                      ? "border-muted-foreground/10 text-muted-foreground/20 cursor-not-allowed"
                                      : "border-primary text-primary"
                                  )}
                                  style={!isAtMax || isSelected ? { borderColor: negocio.colorPrincipal, color: negocio.colorPrincipal } : undefined}
                                  disabled={isAtMax && !isSelected}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      /* Single-select (radio) */
                      <div className="space-y-1.5">
                        {(section.opciones || []).map((option, optIdx) => {
                          const optLabel = typeof option === 'string' ? option : String(option ?? '')
                          return (
                          <button
                            key={`${section.nombre}-opt-${optIdx}`}
                            onClick={() => selectSectionOption(section.nombre, optLabel)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left text-sm transition-all",
                              selectedSecciones[section.nombre] === optLabel
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card hover:border-primary/20"
                            )}
                            style={
                              selectedSecciones[section.nombre] === optLabel
                                ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}08` }
                                : undefined
                            }
                          >
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                selectedSecciones[section.nombre] === optLabel
                                  ? "border-primary"
                                  : "border-muted-foreground/30"
                              )}
                              style={
                                selectedSecciones[section.nombre] === optLabel
                                  ? { borderColor: negocio.colorPrincipal }
                                  : undefined
                              }
                            >
                              {selectedSecciones[section.nombre] === optLabel && (
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: negocio.colorPrincipal }}
                                />
                              )}
                            </div>
                            <span className="font-medium">{optLabel}</span>
                          </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ===== SHARED OPTIONS (OPCIONES COMPARTIDAS) ===== */}
          {resolvedOpcionesCompartidas.length > 0 && (
            <div className="space-y-5 mb-5">
              {resolvedOpcionesCompartidas.map((oc) => {
                const maximo = oc.maximo || 0
                const isMultiSelect = maximo > 1
                const selectedCount = Array.from(selectedOpcionesCompartidas.keys()).filter(k => k.startsWith(`${oc.id}::`)).length
                const isAtMax = isMultiSelect && selectedCount >= maximo

                const toggleSharedOption = (optionNombre: string, optionPrecio: number) => {
                  const key = `${oc.id}::${optionNombre}`
                  setSelectedOpcionesCompartidas(prev => {
                    const next = new Map(prev)
                    if (next.has(key)) {
                      next.delete(key)
                    } else {
                      if (!isMultiSelect) {
                        for (const k of Array.from(next.keys())) {
                          if (k.startsWith(`${oc.id}::`)) next.delete(k)
                        }
                      }
                      if (isMultiSelect && isAtMax) return prev
                      next.set(key, { id: key, nombre: optionNombre, precio: optionPrecio })
                    }
                    return next
                  })
                }

                return (
                  <div key={oc.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-sm">{oc.nombre}</h4>
                      {oc.obligatorio && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          Obligatorio
                        </Badge>
                      )}
                      {isMultiSelect && (
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          {selectedCount}/{maximo}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {(oc.opciones || []).map((option, optIdx) => {
                        const optName = typeof option === 'object' && option !== null ? (option as { nombre?: string }).nombre || '' : String(option)
                        const optPrecio = typeof option === 'object' && option !== null ? (option as { precio?: number }).precio || 0 : 0
                        const selectionKey = `${oc.id}::${optName}`
                        const isSelected = selectedOpcionesCompartidas.has(selectionKey)
                        return (
                          <button
                            key={`shared-${oc.id}-opt-${optIdx}`}
                            onClick={() => toggleSharedOption(optName, optPrecio)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-sm transition-all text-left",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card"
                            )}
                            style={
                              isSelected
                                ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}08` }
                                : undefined
                            }
                          >
                            <span className="font-medium flex-1">{optName}</span>
                            {optPrecio > 0 && (
                              <span className={cn(
                                "text-xs font-semibold shrink-0",
                                isSelected ? "text-primary" : "text-muted-foreground"
                              )}
                              style={isSelected ? { color: negocio.colorPrincipal } : undefined}
                              >
                                +{formatPrice(optPrecio)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ===== INGREDIENTES (hidden for ropa) ===== */}
          {!isRopa && ingredientesByCategory.size > 0 && (
            <div className="mb-5">
              {Array.from(ingredientesByCategory.entries()).map(([cat, ings]) => (
                <div key={cat} className="mb-4">
                  <h4 className="font-bold text-sm mb-2">
                    Ingredientes{" "}
                    <span className="font-normal text-muted-foreground">— {cat}</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Tocá para quitar los que no quieras
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {ings.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => toggleIngrediente(i.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          removedIngredientes.has(i.id)
                            ? "border-red-200 bg-red-50 text-red-500 line-through dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                            : "border-border bg-card hover:border-primary/30"
                        )}
                      >
                        {i.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== AGREGADOS ===== */}
          {agregadosByCategory.size > 0 && (
            <div className="mb-5">
              {Array.from(agregadosByCategory.entries()).map(([cat, agrs]) => (
                <div key={cat} className="mb-4">
                  <h4 className="font-bold text-sm mb-2">
                    Agregados{" "}
                    <span className="font-normal text-muted-foreground">— {cat}</span>
                  </h4>
                  <div className="space-y-1.5">
                    {agrs.map((a) => {
                      const isSelected = selectedAgregados.has(a.id)
                      return (
                        <button
                          key={a.id}
                          onClick={() => toggleAgregado(a)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left text-sm transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/20"
                          )}
                          style={
                            isSelected
                              ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}08` }
                              : undefined
                          }
                        >
                          <div
                            className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                              isSelected
                                ? "border-primary"
                                : "border-muted-foreground/30"
                            )}
                            style={isSelected ? { borderColor: negocio.colorPrincipal } : undefined}
                          >
                            {isSelected && (
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                                style={{ color: negocio.colorPrincipal }}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <span className="font-medium flex-1">{a.nombre}</span>
                          {a.precio > 0 && (
                            <span className="text-xs font-semibold text-muted-foreground">
                              +{formatPrice(a.precio)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== NOTAS ===== */}
          <div className="mb-5">
            <h4 className="font-bold text-sm mb-2">Notas</h4>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={isRopa ? "Aclaraciones sobre tu compra..." : "Aclaraciones sobre tu pedido..."}
              className="w-full min-h-[80px] p-3 rounded-xl border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* ===== BOTTOM ACTION BAR ===== */}
      <div className="shrink-0 bg-background/95 backdrop-blur-md border-t border-border p-4">
        <div className="flex items-center gap-4">
          {/* Quantity controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-bold text-lg w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Add to cart button */}
          <button
            onClick={handleAdd}
            disabled={!product.stock || !canAdd}
            className="flex-1 py-3 rounded-2xl font-bold text-sm text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{
              backgroundColor: negocio.colorPrincipal,
              boxShadow: `0 4px 14px ${negocio.colorPrincipal}35`,
            }}
          >
            {product.stock ? (
              `${isRopa ? "Agregar al carrito" : "Agregar"} · ${formatPrice(itemTotal)}`
            ) : (
              "Sin stock"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}


// ============================================
// Reviews Sheet
// ============================================
function ReviewsSheet({ negocio }: { negocio: NegocioAPI }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        <h3 className="font-bold text-lg">Reseñas de {negocio.nombre}</h3>
      </div>

      <ScrollArea className="flex-1 px-5">
        {negocio.puntuacionPromedio > 0 ? (
          <>
            {/* Rating summary */}
            <div className="flex items-center gap-4 py-4">
              <div className="text-center">
                <div className="text-4xl font-extrabold">
                  {negocio.puntuacionPromedio.toFixed(1)}
                </div>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        "h-4 w-4",
                        s <= Math.round(negocio.puntuacionPromedio)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {negocio.totalResenas} reseña{negocio.totalResenas !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <Separator />

            {/* Reviews list */}
            <div className="py-4 space-y-4">
              {negocio.resenas.length > 0 ? (
                negocio.resenas.map((r) => (
                  <div key={r.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs font-bold">
                            {r.clienteNombre.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-sm">{r.clienteNombre}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={cn(
                                  "h-3 w-3",
                                  s <= r.puntuacion
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/20"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {r.comentario && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {r.comentario}
                      </p>
                    )}
                    {(r.rapidez || r.calidad || r.precio) && (
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        {r.rapidez && <span>⚡ Rapidez: {r.rapidez}/5</span>}
                        {r.calidad && <span>✨ Calidad: {r.calidad}/5</span>}
                        {r.precio && <span>💰 Precio: {r.precio}/5</span>}
                      </div>
                    )}
                    {/* Business reply */}
                    {r.respuestaNegocio && (
                      <div className="ml-2 pl-3 border-l-2 pt-1 pb-0.5" style={{ borderColor: negocio.colorPrincipal }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageCircle className="h-3 w-3" style={{ color: negocio.colorPrincipal }} />
                          <span className="text-xs font-semibold" style={{ color: negocio.colorPrincipal }}>
                            {negocio.nombre}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {r.respuestaNegocio}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <span className="text-3xl mb-2 block">📝</span>
                  <p className="text-sm text-muted-foreground">
                    Aún no hay reseñas con comentarios
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <span className="text-4xl mb-3 block">⭐</span>
            <h3 className="font-bold text-base">Sin reseñas aún</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Sé el primero en calificar este local
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
