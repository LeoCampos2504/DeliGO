"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "@/providers/theme-provider"
import { toast } from "sonner"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Bell,
  Palette,
  Shield,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
  Star,
  Package,
  Heart,
  MessageSquare,
  Download,
  AlertTriangle,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  Building,
  Navigation,
  Copy,
  Info,
  Crosshair,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import L from "leaflet"
import { cn, formatPrice, timeAgo, statusLabel, statusEmoji } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useAuthStore } from "@/store/auth-store"
import { useCartStore } from "@/store/cart-store"
import { useNavStore } from "@/store/nav-store"
import { usePushNotifications } from "@/hooks/use-push-notifications"

// ============================================
// Types
// ============================================
interface Direccion {
  id: string
  alias: string
  direccion: string
  referencia: string
  lat: number | null
  lng: number | null
}

interface Favorito {
  id: string
  nombre: string
  slug: string
  logoUrl: string | null
  rubro: string
}

interface PedidoReciente {
  id: string
  negocioNombre: string
  total: number
  estado: string
  fecha: string
  metodoEntrega: string
}

interface PerfilData {
  id: string
  nombre: string
  email: string
  telefono: string
  googleId: string | null
  fechaRegistro: string
  pushSubscription: boolean
  direcciones: Direccion[]
  favoritos: Favorito[]
  totalPedidos: number
  totalFavoritos: number
  totalResenas: number
  pedidosRecientes: PedidoReciente[]
}

// ============================================
// Main Profile Panel Component
// ============================================
export function ClientProfilePanel() {
  const { logout } = useAuth()
  const authUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const openAddressForm = useNavStore((s) => s.openAddressForm)
  const setOpenAddressForm = useNavStore((s) => s.setOpenAddressForm)

  // Fetch profile data
  const { data: perfil, isLoading } = useQuery({
    queryKey: ["cliente-perfil"],
    queryFn: async () => {
      const res = await fetch("/api/cliente/perfil")
      if (!res.ok) throw new Error("Error al cargar perfil")
      const data = await res.json()
      return data.perfil as PerfilData
    },
  })

  const handleLogout = async () => {
    await logout()
    queryClient.clear()
  }

  if (isLoading) {
    return <ProfileSkeleton />
  }

  if (!perfil) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block">😕</span>
          <p className="text-muted-foreground">No se pudo cargar tu perfil</p>
        </div>
      </div>
    )
  }

  const initials = perfil.nombre
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex-1 bg-background">
      {/* Header */}
      <ProfileHeader perfil={perfil} initials={initials} />

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pb-24 space-y-3">
        {/* Stats */}
        <StatsRow perfil={perfil} />

        {/* Personal Info */}
        <PersonalInfoSection perfil={perfil} />

        {/* Direcciones */}
        <AddressesSection direcciones={perfil.direcciones} autoOpenForm={openAddressForm} onFormOpened={() => setOpenAddressForm(false)} />

        {/* Password */}
        {!perfil.googleId && <PasswordSection />}

        {/* Settings */}
        <SettingsSection pushEnabled={perfil.pushSubscription} />

        {/* Privacy & Legal */}
        <PrivacyLegalSection />

        {/* Help */}
        <HelpSection />

        {/* Account Management */}
        <AccountSection onLogout={handleLogout} />
      </div>
    </div>
  )
}

// ============================================
// Profile Header
// ============================================
function ProfileHeader({ perfil, initials }: { perfil: PerfilData; initials: string }) {
  const memberSince = new Date(perfil.fechaRegistro).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-4 pt-12 pb-16 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
      <div className="absolute top-8 left-1/2 w-20 h-20 rounded-full bg-white/5" />

      <div className="relative flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Avatar className="h-20 w-20 border-4 border-white/25 shadow-xl">
            <AvatarFallback className="bg-white/20 text-white text-2xl font-bold backdrop-blur-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        <motion.h1
          className="mt-3 text-xl font-bold text-white"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {perfil.nombre}
        </motion.h1>

        <motion.div
          className="flex items-center gap-1.5 mt-1 text-white/70 text-sm"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <Mail className="h-3.5 w-3.5" />
          {perfil.email}
        </motion.div>

        <motion.div
          className="flex items-center gap-1.5 mt-1 text-white/50 text-xs"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Clock className="h-3 w-3" />
          Miembro desde {memberSince}
        </motion.div>

        {perfil.googleId && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <Badge className="mt-2 bg-white/15 text-white border-0 text-[10px] gap-1">
              <svg className="h-3 w-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Cuenta de Google
            </Badge>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Stats Row
// ============================================
function StatsRow({ perfil }: { perfil: PerfilData }) {
  const stats = [
    { icon: Package, value: perfil.totalPedidos, label: "Pedidos", color: "text-primary" },
    { icon: Heart, value: perfil.totalFavoritos, label: "Favoritos", color: "text-rose-500" },
    { icon: MessageSquare, value: perfil.totalResenas, label: "Reseñas", color: "text-amber-500" },
  ]

  return (
    <div className="relative z-10 grid grid-cols-3 gap-3 -mt-8">
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card border-border/50 shadow-md text-center py-3">
            <stat.icon className={cn("h-5 w-5 mx-auto mb-1", stat.color)} />
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

// ============================================
// Personal Info Section
// ============================================
function PersonalInfoSection({ perfil }: { perfil: PerfilData }) {
  const [isEditing, setIsEditing] = useState(false)
  const [nombre, setNombre] = useState(perfil.nombre)
  const [telefono, setTelefono] = useState(perfil.telefono)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: async (data: { nombre?: string; telefono?: string }) => {
      const res = await fetch("/api/cliente/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al actualizar")
      }
      return res.json()
    },
    onSuccess: (data) => {
      // Update auth store
      const store = useAuthStore.getState()
      if (store.user && data.perfil) {
        store.loginCliente({
          id: data.perfil.id,
          nombre: data.perfil.nombre,
          email: data.perfil.email,
          token: store.token ?? "synced",
        })
      }
      queryClient.invalidateQueries({ queryKey: ["cliente-perfil"] })
      setIsEditing(false)
      toast.success("Perfil actualizado")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSave = () => {
    const data: { nombre?: string; telefono?: string } = {}
    if (nombre !== perfil.nombre) data.nombre = nombre
    if (telefono !== perfil.telefono) data.telefono = telefono
    if (Object.keys(data).length === 0) {
      setIsEditing(false)
      return
    }
    updateMutation.mutate(data)
  }

  const handleCancel = () => {
    setNombre(perfil.nombre)
    setTelefono(perfil.telefono)
    setIsEditing(false)
  }

  return (
    <SectionCard
      icon={User}
      title="Información Personal"
      action={
        !isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-primary"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
        ) : null
      }
    >
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="h-9 text-sm"
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Teléfono</Label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="h-9 text-sm"
                placeholder="+54 9 11 1234-5678"
                type="tel"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs flex-1"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                {updateMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs flex-1"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="viewing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <InfoRow icon={User} label="Nombre" value={perfil.nombre} />
            <InfoRow icon={Mail} label="Email" value={perfil.email} />
            <InfoRow
              icon={Phone}
              label="Teléfono"
              value={perfil.telefono || "No configurado"}
              valueClass={perfil.telefono ? "" : "text-muted-foreground italic"}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </SectionCard>
  )
}

// ============================================
// Addresses Section
// ============================================
function AddressesSection({ direcciones, autoOpenForm, onFormOpened }: { direcciones: Direccion[]; autoOpenForm?: boolean; onFormOpened?: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [alias, setAlias] = useState("")
  const [direccion, setDireccion] = useState("")
  const [referencia, setReferencia] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const queryClient = useQueryClient()

  // Auto-open form when navigating from home page
  useEffect(() => {
    if (autoOpenForm && !showForm) {
      // Use microtask to avoid calling setState synchronously in effect
      const timer = setTimeout(() => {
        setShowForm(true)
        onFormOpened?.()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoOpenForm, showForm])

  const addMutation = useMutation({
    mutationFn: async (data: { alias: string; direccion: string; referencia: string; lat?: number | null; lng?: number | null }) => {
      const res = await fetch("/api/cliente/direcciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: (data, variables) => {
      // If no delivery address is set, auto-select the newly added one
      const currentAddress = useCartStore.getState().deliveryAddress
      if (!currentAddress && (variables.lat !== null && variables.lng !== null)) {
        const newId = data?.direccion?.id
        useCartStore.getState().setDeliveryAddress({
          lat: variables.lat ?? -26.1856,
          lng: variables.lng ?? -58.1732,
          direccion: variables.direccion,
          referencia: variables.referencia,
          alias: variables.alias,
          direccionId: newId,
        })
      }
      queryClient.invalidateQueries({ queryKey: ["cliente-perfil"] })
      queryClient.invalidateQueries({ queryKey: ["cliente-direcciones"] })
      resetForm()
      toast.success("Dirección agregada")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const editMutation = useMutation({
    mutationFn: async (data: { id: string; alias: string; direccion: string; referencia: string; lat?: number | null; lng?: number | null }) => {
      const res = await fetch("/api/cliente/direcciones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      // If the edited address is the currently selected delivery address, update the cart store
      const currentAddress = useCartStore.getState().deliveryAddress
      if (currentAddress?.direccionId === variables.id) {
        useCartStore.getState().setDeliveryAddress({
          lat: variables.lat ?? -26.1856,
          lng: variables.lng ?? -58.1732,
          direccion: variables.direccion,
          referencia: variables.referencia,
          alias: variables.alias,
          direccionId: variables.id,
        })
      }
      queryClient.invalidateQueries({ queryKey: ["cliente-perfil"] })
      queryClient.invalidateQueries({ queryKey: ["cliente-direcciones"] })
      resetForm()
      toast.success("Dirección actualizada")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cliente/direcciones?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: (_data, deletedId) => {
      // If the deleted address is the currently selected delivery address, clear it
      const currentAddress = useCartStore.getState().deliveryAddress
      if (currentAddress?.direccionId === deletedId) {
        useCartStore.getState().setDeliveryAddress(null)
      }
      queryClient.invalidateQueries({ queryKey: ["cliente-perfil"] })
      toast.success("Dirección eliminada")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setAlias("")
    setDireccion("")
    setReferencia("")
    setLat(null)
    setLng(null)
  }

  const startEdit = (dir: Direccion) => {
    setEditingId(dir.id)
    setAlias(dir.alias)
    setDireccion(dir.direccion)
    setReferencia(dir.referencia)
    setLat(dir.lat)
    setLng(dir.lng)
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (!alias.trim()) {
      toast.error("El alias es obligatorio")
      return
    }
    // Either direccion text or coordinates must be present (coords take priority)
    if (!direccion.trim() && (lat === null || lng === null)) {
      toast.error("Ingresá una dirección o seleccioná la ubicación en el mapa")
      return
    }
    if (editingId) {
      editMutation.mutate({ id: editingId, alias, direccion, referencia, lat, lng })
    } else {
      addMutation.mutate({ alias, direccion, referencia, lat, lng })
    }
  }

  const getAliasIcon = (alias: string) => {
    const lower = alias.toLowerCase()
    if (lower.includes("casa") || lower.includes("home")) return Home
    if (lower.includes("trabajo") || lower.includes("office") || lower.includes("oficina")) return Building
    return MapPin
  }

  return (
    <SectionCard
      icon={MapPin}
      title="Mis Direcciones"
      badge={direcciones.length > 0 ? String(direcciones.length) : undefined}
      action={
        !showForm ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-primary"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3 w-3" />
            Agregar
          </Button>
        ) : null
      }
    >
      {/* Address list */}
      {direcciones.length === 0 && !showForm && (
        <div className="text-center py-4">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">
            No tenés direcciones guardadas
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5 text-xs"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3 w-3" />
            Agregar dirección
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {direcciones.map((dir) => (
          <div
            key={dir.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 group"
          >
            {(() => {
              const Icon = getAliasIcon(dir.alias)
              return (
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              )
            })()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{dir.alias}</p>
                {dir.lat !== null && dir.lng !== null && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                    <Navigation className="h-2.5 w-2.5" />
                    GPS
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{dir.direccion}</p>
              {dir.referencia && (
                <p className="text-xs text-muted-foreground/70 truncate">
                  Ref: {dir.referencia}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => startEdit(dir)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar dirección?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará &quot;{dir.alias}&quot; ({dir.direccion}). Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate(dir.id)}
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 pt-3 border-t border-border/30"
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {editingId ? "Editar dirección" : "Nueva dirección"}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Alias *</Label>
              <Input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="h-9 text-sm"
                placeholder="Ej: Casa, Trabajo..."
              />
              <p className="text-[10px] text-muted-foreground">Este nombre aparecerá al seleccionar la dirección</p>
            </div>

            {/* Map picker for coordinates */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Navigation className="h-3 w-3 text-primary" />
                Ubicación en el mapa
              </Label>
              <AddressMapPicker
                lat={lat}
                lng={lng}
                direccion={direccion}
                onCoordsChange={(newLat, newLng) => { setLat(newLat); setLng(newLng) }}
                onDireccionChange={setDireccion}
              />
              {lat !== null && lng !== null && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/30">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-mono text-muted-foreground">
                    {lat.toFixed(6)}, {lng.toFixed(6)}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 dark:text-amber-300">
                  Las coordenadas del mapa tienen prioridad sobre la dirección escrita para calcular distancias de delivery.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dirección</Label>
              <Input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="h-9 text-sm"
                placeholder="Calle, número, barrio..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Referencia (opcional)</Label>
              <Input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="h-9 text-sm"
                placeholder="Piso, depto, entre calles..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs flex-1"
                onClick={handleSubmit}
                disabled={addMutation.isPending || editMutation.isPending}
              >
                <Check className="h-3.5 w-3.5" />
                {editingId
                  ? editMutation.isPending
                    ? "Guardando..."
                    : "Guardar cambios"
                  : addMutation.isPending
                  ? "Agregando..."
                  : "Agregar dirección"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={resetForm}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionCard>
  )
}

// ============================================
// Password Section
// ============================================
function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const mutation = useMutation({
    mutationFn: async (data: { passwordActual: string; passwordNueva: string }) => {
      const res = await fetch("/api/cliente/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Contraseña actualizada correctamente")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }
    mutation.mutate({ passwordActual: currentPassword, passwordNueva: newPassword })
  }

  return (
    <SectionCard icon={Lock} title="Cambiar Contraseña">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Contraseña actual</Label>
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-9 text-sm pr-10"
              placeholder="••••••"
              required
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowCurrent(!showCurrent)}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nueva contraseña</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-9 text-sm pr-10"
              placeholder="Mínimo 6 caracteres"
              required
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Confirmar nueva contraseña</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-9 text-sm"
            placeholder="Repetí la contraseña"
            required
          />
        </div>
        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
        )}
        <Button
          type="submit"
          size="sm"
          className="h-8 gap-1.5 text-xs w-full"
          disabled={mutation.isPending || !currentPassword || !newPassword || !confirmPassword}
        >
          <Lock className="h-3.5 w-3.5" />
          {mutation.isPending ? "Actualizando..." : "Cambiar contraseña"}
        </Button>
      </form>
    </SectionCard>
  )
}

// ============================================
// Settings Section
// ============================================
function SettingsSection({ pushEnabled }: { pushEnabled: boolean }) {
  const { theme, setTheme } = useTheme()
  const push = usePushNotifications()
  const [notifications, setNotifications] = useState(pushEnabled || push.isSubscribed)

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotifications(enabled)
    if (enabled) {
      await push.subscribe()
      if (!push.isSubscribed) {
        setNotifications(false) // Revert if failed
      }
    } else {
      await push.unsubscribe()
    }
  }

  return (
    <SectionCard icon={Palette} title="Configuración">
      <div className="space-y-4">
        {/* Theme */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Palette className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="text-xs text-muted-foreground">
                {theme === "dark" ? "Modo oscuro" : theme === "light" ? "Modo claro" : "Automático"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {[
              { value: "light", icon: "☀️" },
              { value: "system", icon: "💻" },
              { value: "dark", icon: "🌙" },
            ].map(({ value, icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-all",
                  theme === value
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <Separator className="opacity-50" />

        {/* Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Notificaciones push</p>
              <p className="text-xs text-muted-foreground">
                {push.loading
                  ? "Procesando..."
                  : !push.isSupported
                  ? "No disponibles en este navegador"
                  : notifications
                  ? "Activadas"
                  : "Desactivadas"}
              </p>
            </div>
          </div>
          <Switch
            checked={notifications}
            onCheckedChange={handleToggleNotifications}
            disabled={!push.isSupported || push.loading}
          />
        </div>
      </div>
    </SectionCard>
  )
}

// ============================================
// Privacy & Legal Section
// ============================================
function PrivacyLegalSection() {
  const [openDocument, setOpenDocument] = useState<string | null>(null)

  const legalDocs = [
    {
      id: "privacidad",
      icon: Shield,
      title: "Política de Privacidad",
      description: "Cómo protegemos tus datos personales",
      color: "text-emerald-500",
      content: <PrivacyPolicyContent />,
    },
    {
      id: "terminos",
      icon: FileText,
      title: "Términos y Condiciones",
      description: "Condiciones de uso de la plataforma",
      color: "text-primary",
      content: <TermsContent />,
    },
    {
      id: "cookies",
      icon: Navigation,
      title: "Política de Cookies",
      description: "Uso de cookies y datos de navegación",
      color: "text-violet-500",
      content: <CookiesContent />,
    },
  ]

  return (
    <SectionCard icon={Shield} title="Privacidad y Legal">
      <div className="space-y-1">
        {legalDocs.map((doc) => (
          <Dialog key={doc.id} open={openDocument === doc.id} onOpenChange={(open) => !open && setOpenDocument(null)}>
            <DialogTrigger asChild>
              <button
                onClick={() => setOpenDocument(doc.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <doc.icon className={cn("h-4 w-4", doc.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <doc.icon className={cn("h-5 w-5", doc.color)} />
                  {doc.title}
                </DialogTitle>
                <DialogDescription>{doc.description}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="text-sm text-muted-foreground leading-relaxed space-y-4">
                  {doc.content}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        ))}

        {/* Data rights */}
        <Separator className="opacity-50 my-2" />
        <div className="p-3 rounded-xl bg-muted/30">
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            Tus derechos
          </p>
          <div className="space-y-1.5">
            {[
              { label: "Acceso", desc: "Solicitar tus datos personales" },
              { label: "Rectificación", desc: "Corregir datos incorrectos" },
              { label: "Supresión", desc: "Eliminar tu cuenta y datos" },
              { label: "Portabilidad", desc: "Exportar tus datos" },
              { label: "Oposición", desc: "Oponerte al tratamiento de datos" },
            ].map((right) => (
              <div key={right.label} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-medium">{right.label}</span>
                  <span className="text-xs text-muted-foreground"> — {right.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

// ============================================
// Help Section
// ============================================
function HelpSection() {
  const faqs = [
    {
      q: "¿Cómo hago un pedido?",
      a: "Elegí un local desde el inicio, seleccioná los productos que querés, agregalos al carrito y confirmá tu pedido. Podés elegir retiro en local o delivery.",
    },
    {
      q: "¿Cómo cancelo un pedido?",
      a: "Podés cancelar tu pedido dentro de los primeros minutos desde la sección 'Mis Pedidos'. Una vez que el negocio lo confirma, la cancelación queda a discreción del local.",
    },
    {
      q: "¿Puedo pagar con tarjeta?",
      a: "Actualmente aceptamos pago en efectivo y transferencia bancaria. Estamos trabajando para incorporar pagos con tarjeta próximamente.",
    },
    {
      q: "¿Cómo funcionan las reseñas?",
      a: "Después de recibir tu pedido, podés calificar al negocio con una puntuación del 1 al 5 y dejar un comentario. Tu reseña ayuda a otros usuarios y al negocio a mejorar.",
    },
    {
      q: "¿Mis datos están seguros?",
      a: "Sí. Usamos encriptación para proteger tus datos personales y contraseñas. No compartimos tu información con terceros. Podés revisar nuestra Política de Privacidad para más detalles.",
    },
  ]

  return (
    <SectionCard icon={HelpCircle} title="Ayuda y Soporte">
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border/30">
            <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline text-left">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Separator className="opacity-50 my-2" />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs flex-1"
          onClick={() => toast.info("Funcionalidad disponible próximamente")}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat de soporte
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs flex-1"
          onClick={() => {
            navigator.clipboard.writeText("soporte@deligo.app")
            toast.success("Email copiado al portapapeles")
          }}
        >
          <Copy className="h-3.5 w-3.5" />
          Email soporte
        </Button>
      </div>
    </SectionCard>
  )
}

// ============================================
// Account Section
// ============================================
function AccountSection({ onLogout }: { onLogout: () => void }) {
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cliente/cuenta")
      if (!res.ok) throw new Error("Error al exportar datos")
      return res.blob()
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "deligo-datos.json"
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Datos exportados correctamente")
    },
    onError: () => toast.error("Error al exportar datos"),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cliente/cuenta", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacion: "ELIMINAR" }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Cuenta eliminada. Te extrañaremos. 💙")
      onLogout()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <SectionCard icon={User} title="Cuenta">
      <div className="space-y-2">
        {/* Export data */}
        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Download className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Exportar mis datos</p>
            <p className="text-xs text-muted-foreground">
              Descargá una copia de toda tu información
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>

        <Separator className="opacity-50" />

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <LogOut className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Cerrar sesión</p>
            <p className="text-xs text-muted-foreground">Salir de tu cuenta</p>
          </div>
        </button>

        <Separator className="opacity-50" />

        {/* Delete account */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/5 transition-colors text-left group">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Eliminar cuenta</p>
                <p className="text-xs text-muted-foreground">
                  Borrar tu cuenta permanentemente
                </p>
              </div>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                ¿Eliminar tu cuenta permanentemente?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Esta acción <strong>no se puede deshacer</strong>. Se eliminarán todos tus datos,
                    incluyendo pedidos, direcciones, favoritos y reseñas.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Escribí <span className="font-mono text-destructive">ELIMINAR</span> para confirmar
                    </Label>
                    <Input
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="ELIMINAR"
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteConfirm !== "ELIMINAR" || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar cuenta"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* App version */}
      <div className="mt-4 pt-3 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground">DeliGO v1.0.0</p>
        <p className="text-[10px] text-muted-foreground/60">Hecho con 💙 en Argentina</p>
      </div>
    </SectionCard>
  )
}

// ============================================
// Reusable Section Card
// ============================================
function SectionCard({
  icon: Icon,
  title,
  badge,
  action,
  children,
}: {
  icon: React.ElementType
  title: string
  badge?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">{title}</h2>
            {badge && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {badge}
              </Badge>
            )}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

// ============================================
// Info Row
// ============================================
function InfoRow({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn("text-sm truncate", valueClass)}>{value}</p>
      </div>
    </div>
  )
}

// ============================================
// Address Map Picker (Lightweight Leaflet for profile form)
// ============================================

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

function AddressMapPicker({
  lat,
  lng,
  direccion,
  onCoordsChange,
  onDireccionChange,
}: {
  lat: number | null
  lng: number | null
  direccion: string
  onCoordsChange: (lat: number, lng: number) => void
  onDireccionChange: (dir: string) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const coordsRef = useRef<[number, number]>(
    lat !== null && lng !== null ? [lat, lng] : [-26.1856, -58.1732]
  )

  // Reverse geocoding function — defined before useEffect so it can be used inside
  const reverseGeocode = async (latlng: [number, number]) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng[0]}&lon=${latlng[1]}&format=json&accept-language=es`,
        { headers: { "User-Agent": "DeliGO-App/1.0" } }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.display_name) {
          const parts = data.display_name.split(",")
          const simplified = parts.slice(0, Math.min(3, parts.length)).join(",").trim()
          onDireccionChange(simplified)
        }
      }
    } catch {
      // silently fail
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const initialCoords: [number, number] =
      lat !== null && lng !== null ? [lat, lng] : [-26.1856, -58.1732]

    const map = L.map(mapContainerRef.current, {
      center: initialCoords,
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const customIcon = L.divIcon({
      html: `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#FB8C00"/>
          <circle cx="14" cy="13" r="6" fill="white"/>
        </svg>
      </div>`,
      className: "custom-map-marker",
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    })

    const marker = L.marker(initialCoords, {
      icon: customIcon,
      draggable: true,
    }).addTo(map)

    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      const newCoords: [number, number] = [
        Math.round(pos.lat * 1000000) / 1000000,
        Math.round(pos.lng * 1000000) / 1000000,
      ]
      coordsRef.current = newCoords
      onCoordsChange(newCoords[0], newCoords[1])
      reverseGeocode(newCoords)
    })

    map.on("click", (e: L.LeafletMouseEvent) => {
      const newCoords: [number, number] = [
        Math.round(e.latlng.lat * 1000000) / 1000000,
        Math.round(e.latlng.lng * 1000000) / 1000000,
      ]
      marker.setLatLng(newCoords)
      coordsRef.current = newCoords
      onCoordsChange(newCoords[0], newCoords[1])
      reverseGeocode(newCoords)
    })

    setTimeout(() => map.invalidateSize(), 200)
    mapInstanceRef.current = map
    markerRef.current = marker
    setTimeout(() => setIsMapReady(true), 0)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  // Update marker position when lat/lng props change (e.g., editing an address)
  useEffect(() => {
    if (lat !== null && lng !== null && mapInstanceRef.current && markerRef.current) {
      const newCoords: [number, number] = [lat, lng]
      markerRef.current.setLatLng(newCoords)
      mapInstanceRef.current.setView(newCoords, 15)
      coordsRef.current = newCoords
    }
  }, [lat, lng])

  const handleGetLocation = () => {
    if (!navigator.geolocation) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords: [number, number] = [
          Math.round(position.coords.latitude * 1000000) / 1000000,
          Math.round(position.coords.longitude * 1000000) / 1000000,
        ]
        coordsRef.current = newCoords
        onCoordsChange(newCoords[0], newCoords[1])
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView(newCoords, 16)
          markerRef.current.setLatLng(newCoords)
        }
        reverseGeocode(newCoords)
        setIsLocating(false)
      },
      () => { setIsLocating(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border/50">
      <div
        ref={mapContainerRef}
        className="w-full h-[200px] bg-muted/30"
        style={{ zIndex: 0 }}
      />
      {/* GPS button */}
      <button
        onClick={handleGetLocation}
        disabled={isLocating}
        className="absolute top-2 right-2 z-[1000] w-8 h-8 rounded-lg bg-background border border-border shadow-md flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
        title="Mi ubicación"
      >
        <Crosshair className={cn("h-4 w-4 text-primary", isLocating && "animate-spin")} />
      </button>
      {!isMapReady && (
        <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}

// ============================================
// Profile Skeleton
// ============================================
function ProfileSkeleton() {
  return (
    <div className="flex-1 bg-background animate-pulse">
      {/* Header skeleton */}
      <div className="bg-primary/20 px-4 pt-12 pb-16">
        <div className="flex flex-col items-center">
          <div className="h-20 w-20 rounded-full bg-white/10" />
          <div className="mt-3 h-5 w-32 rounded bg-white/10" />
          <div className="mt-2 h-3 w-40 rounded bg-white/5" />
          <div className="mt-1 h-3 w-28 rounded bg-white/5" />
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="max-w-2xl mx-auto px-4 -mt-8 grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/50 border border-border/30" />
        ))}
      </div>
      {/* Sections skeleton */}
      <div className="max-w-2xl mx-auto px-4 pb-24 space-y-3 mt-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/50 border border-border/30" />
        ))}
      </div>
    </div>
  )
}

// ============================================
// LEGAL CONTENT — Privacy Policy
// ============================================
function PrivacyPolicyContent() {
  return (
    <>
      <p><strong>Última actualización:</strong> Marzo 2025</p>

      <h3 className="font-semibold text-foreground">1. Responsable del tratamiento</h3>
      <p>
        DeliGO es la plataforma responsable del tratamiento de los datos personales de los usuarios.
        Nuestro domicilio legal se encuentra en la República Argentina.
      </p>

      <h3 className="font-semibold text-foreground">2. Datos que recopilamos</h3>
      <p>Recopilamos los siguientes datos personales:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Datos de registro:</strong> Nombre, email, teléfono y contraseña (encriptada).</li>
        <li><strong>Datos de ubicación:</strong> Direcciones de entrega guardadas y coordenadas GPS cuando usás la función &quot;Mi ubicación&quot;.</li>
        <li><strong>Datos de pedidos:</strong> Historial de pedidos, productos solicitados, montos, métodos de pago.</li>
        <li><strong>Datos de reseñas:</strong> Calificaciones y comentarios sobre negocios.</li>
        <li><strong>Datos de dispositivo:</strong> Información del navegador, sistema operativo, y preferencias de notificaciones push.</li>
        <li><strong>Datos de autenticación Google:</strong> Si elegís ingresar con Google, recibimos tu nombre y email de Google.</li>
      </ul>

      <h3 className="font-semibold text-foreground">3. Finalidad del tratamiento</h3>
      <p>Usamos tus datos para:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Prestar el servicio de pedidos y delivery.</li>
        <li>Comunicarte el estado de tus pedidos.</li>
        <li>Mejorar la experiencia de usuario y personalizar contenido.</li>
        <li>Enviar notificaciones sobre tus pedidos y promociones relevantes.</li>
        <li>Cumplir con obligaciones legales y reglamentarias.</li>
        <li>Prevenir fraudes y garantizar la seguridad de la plataforma.</li>
      </ul>

      <h3 className="font-semibold text-foreground">4. Base legal</h3>
      <p>
        El tratamiento de tus datos se basa en tu consentimiento (al registrarte y usar la plataforma),
        en la ejecución del contrato de servicio, y en intereses legítimos de DeliGO para mejorar el servicio.
      </p>

      <h3 className="font-semibold text-foreground">5. Compartir datos con terceros</h3>
      <p>
        <strong>No vendemos tus datos personales.</strong> Compartimos información únicamente con:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Negocios asociados:</strong> Los datos necesarios para procesar tus pedidos (nombre, dirección de entrega, teléfono).</li>
        <li><strong>Proveedores de servicio:</strong> Servicios de hosting, almacenamiento de imágenes y autenticación (Google OAuth).</li>
        <li><strong>Autoridades competentes:</strong> Cuando lo exija la ley.</li>
      </ul>

      <h3 className="font-semibold text-foreground">6. Seguridad de los datos</h3>
      <p>
        Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Contraseñas encriptadas con algoritmo PBKDF2 (100,000 iteraciones).</li>
        <li>Comunicaciones protegidas con HTTPS/TLS.</li>
        <li>Cookies de sesión httpOnly y seguras.</li>
        <li>Acceso restringido a datos personales por personal autorizado.</li>
      </ul>

      <h3 className="font-semibold text-foreground">7. Conservación de datos</h3>
      <p>
        Conservamos tus datos mientras tengas una cuenta activa. Al eliminar tu cuenta, tus datos
        personales se eliminan dentro de los 30 días, excepto aquellos que debamos conservar por
        obligaciones legales (datos fiscales de pedidos durante 5 años).
      </p>

      <h3 className="font-semibold text-foreground">8. Derechos del titular</h3>
      <p>Tenés derecho a:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Acceder</strong> a tus datos personales.</li>
        <li><strong>Rectificar</strong> datos incorrectos.</li>
        <li><strong>Suprimir</strong> tu cuenta y datos.</li>
        <li><strong>Exportar</strong> tus datos en formato legible.</li>
        <li><strong>Oponerte</strong> al tratamiento de tus datos.</li>
        <li><strong>Revocar</strong> tu consentimiento en cualquier momento.</li>
      </ul>
      <p>
        Para ejercer tus derechos, podés usar las opciones de tu perfil o contactarnos a soporte@deligo.app.
      </p>

      <h3 className="font-semibold text-foreground">9. Menores de edad</h3>
      <p>
        DeliGO no está dirigido a menores de 13 años. No recopilamos conscientemente datos de menores.
      </p>

      <h3 className="font-semibold text-foreground">10. Cambios en la política</h3>
      <p>
        Podemos actualizar esta política. Te notificaremos por email o en la app cuando haya cambios significativos.
      </p>

      <h3 className="font-semibold text-foreground">11. Contacto</h3>
      <p>
        Para consultas sobre privacidad: <strong>soporte@deligo.app</strong>
      </p>
    </>
  )
}

// ============================================
// LEGAL CONTENT — Terms & Conditions
// ============================================
function TermsContent() {
  return (
    <>
      <p><strong>Última actualización:</strong> Marzo 2025</p>

      <h3 className="font-semibold text-foreground">1. Aceptación de los términos</h3>
      <p>
        Al registrarte y usar DeliGO, aceptás estos Términos y Condiciones. Si no estás de acuerdo,
        no debés usar la plataforma.
      </p>

      <h3 className="font-semibold text-foreground">2. Descripción del servicio</h3>
      <p>
        DeliGO es una plataforma que conecta clientes con negocios locales para realizar pedidos de
        comida, productos y servicios de delivery o retiro en local. DeliGO actúa como intermediario
        y no es responsable de la calidad de los productos vendidos por los negocios asociados.
      </p>

      <h3 className="font-semibold text-foreground">3. Registro de cuenta</h3>
      <p>
        Para usar DeliGO necesitás crear una cuenta con datos veraces. Sos responsable de mantener
        la confidencialidad de tu contraseña y de todas las actividades realizadas con tu cuenta.
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Debés ser mayor de 13 años para registrarte.</li>
        <li>No podés crear múltiples cuentas.</li>
        <li>Debés proporcionar datos reales y actualizados.</li>
      </ul>

      <h3 className="font-semibold text-foreground">4. Realización de pedidos</h3>
      <p>
        Al realizar un pedido, estás celebrando un contrato directamente con el negocio. DeliGO
        procesa el pago de la tarifa de servicio pero no es parte del contrato de compraventa.
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Los precios y disponibilidad son establecidos por cada negocio.</li>
        <li>Los tiempos de entrega son estimados y pueden variar.</li>
        <li>Podés cancelar un pedido dentro de los primeros minutos antes de que el negocio lo confirme.</li>
        <li>La tarifa de servicio ($250 fijos) se aplica a cada pedido para mantener la plataforma.</li>
      </ul>

      <h3 className="font-semibold text-foreground">5. Métodos de pago</h3>
      <p>
        Los pagos se realizan directamente al negocio mediante los métodos que este acepte (efectivo
        o transferencia bancaria). DeliGO no gestiona pagos ni realiza cobros en nombre del negocio.
      </p>

      <h3 className="font-semibold text-foreground">6. Reseñas y opiniones</h3>
      <p>
        Podés dejar reseñas sobre los negocios después de cada pedido. Las reseñas deben ser honestas
        y respetuosas. DeliGO se reserva el derecho de eliminar reseñas que contengan:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Contenido ofensivo, discriminatorio o difamatorio.</li>
        <li>Información personal de terceros.</li>
        <li>Spam o contenido publicitario.</li>
        <li>Contenido falso o engañoso.</li>
      </ul>

      <h3 className="font-semibold text-foreground">7. Conducta del usuario</h3>
      <p>No está permitido:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Usar la plataforma para fines ilícitos.</li>
        <li>Hacer pedidos falsos o con intención de no pagar.</li>
        <li>Acosar o amenazar a otros usuarios, negocios o repartidores.</li>
        <li>Manipular el sistema de reseñas o calificaciones.</li>
        <li>Intentar acceder a cuentas ajenas.</li>
      </ul>

      <h3 className="font-semibold text-foreground">8. Propiedad intelectual</h3>
      <p>
        El diseño, logos, marcas y contenido de DeliGO son propiedad de la plataforma. Los logos y
        nombres de los negocios son propiedad de sus respectivos dueños.
      </p>

      <h3 className="font-semibold text-foreground">9. Limitación de responsabilidad</h3>
      <p>
        DeliGO no se hace responsable por:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>La calidad, cantidad o estado de los productos vendidos por los negocios.</li>
        <li>Retrasos en la entrega causados por el negocio o el repartidor.</li>
        <li>Disponibilidad interrumpida del servicio por causas técnicas.</li>
        <li>Pérdidas indirectas derivadas del uso de la plataforma.</li>
      </ul>

      <h3 className="font-semibold text-foreground">10. Suspensión de cuenta</h3>
      <p>
        DeliGO puede suspender o cancelar tu cuenta si incumplís estos términos, sin perjuicio de
        otras acciones legales que correspondan.
      </p>

      <h3 className="font-semibold text-foreground">11. Modificaciones</h3>
      <p>
        Nos reservamos el derecho de modificar estos términos. Te notificaremos con al menos 15 días
        de anticipación antes de que entren en vigencia cambios significativos.
      </p>

      <h3 className="font-semibold text-foreground">12. Ley aplicable</h3>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa será
        resuelta por los tribunales competentes de Argentina.
      </p>
    </>
  )
}

// ============================================
// LEGAL CONTENT — Cookies Policy
// ============================================
function CookiesContent() {
  return (
    <>
      <p><strong>Última actualización:</strong> Marzo 2025</p>

      <h3 className="font-semibold text-foreground">1. ¿Qué son las cookies?</h3>
      <p>
        Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitás
        nuestro sitio. Nos ayudan a recordar tus preferencias y mejorar tu experiencia.
      </p>

      <h3 className="font-semibold text-foreground">2. Cookies que usamos</h3>

      <div className="space-y-3">
        <div>
          <p className="font-medium text-foreground">Cookies esenciales</p>
          <p>Necesarias para el funcionamiento de la plataforma:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><code className="bg-muted px-1 rounded text-xs">deligo_session</code> — Token de sesión httpOnly. Sin esta cookie, no podés estar logueado.</li>
            <li><code className="bg-muted px-1 rounded text-xs">deligo-auth</code> — Estado de autenticación (Zustand persist).</li>
            <li><code className="bg-muted px-1 rounded text-xs">deligo-nav</code> — Última pestaña activa en la navegación.</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-foreground">Cookies de preferencias</p>
          <p>Recordán tus configuraciones:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><code className="bg-muted px-1 rounded text-xs">deligo-cart</code> — Tu carrito de compras guardado.</li>
            <li><code className="bg-muted px-1 rounded text-xs">theme</code> — Tu preferencia de tema (claro/oscuro).</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-foreground">Cookies de terceros</p>
          <p>No usamos cookies de seguimiento de terceros (Google Analytics, Meta Pixel, etc.).</p>
        </div>
      </div>

      <h3 className="font-semibold text-foreground">3. Almacenamiento local</h3>
      <p>
        Además de cookies, usamos <code className="bg-muted px-1 rounded text-xs">localStorage</code> para:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Guardar datos del carrito de compras.</li>
        <li>Mantener la sesión del usuario entre recargas.</li>
        <li>Guardar preferencias de navegación.</li>
      </ul>

      <h3 className="font-semibold text-foreground">4. Gestión de cookies</h3>
      <p>
        Podés gestionar o eliminar cookies desde la configuración de tu navegador. Tené en cuenta que
        desactivar las cookies esenciales puede afectar el funcionamiento de la plataforma.
      </p>

      <h3 className="font-semibold text-foreground">5. Push notifications</h3>
      <p>
        Si activás las notificaciones push, almacenamos una suscripción de push en tu perfil. Podés
        desactivarla en cualquier momento desde Configuración en tu perfil.
      </p>

      <h3 className="font-semibold text-foreground">6. Contacto</h3>
      <p>
        Para consultas sobre cookies: <strong>soporte@deligo.app</strong>
      </p>
    </>
  )
}
