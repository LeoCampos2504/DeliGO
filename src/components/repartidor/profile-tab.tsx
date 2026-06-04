"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  User,
  Mail,
  Phone,
  Lock,
  Save,
  Loader2,
  Shield,
  Calendar,
  Bike,
  Bell,
  BellOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/store/auth-store"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface PerfilData {
  id: string
  nombre: string
  email: string
  telefono: string
  activo: boolean
  fechaRegistro: string
  negocios: Array<{
    id: string
    negocioId: string
    negocioNombre: string
    negocioLogoUrl: string | null
    codigoAcceso: string
  }>
}

interface ProfileTabProps {
  perfil: PerfilData | undefined
  isLoading: boolean
}

// ============================================
// Profile Tab
// ============================================
export function ProfileTab({ perfil, isLoading }: ProfileTabProps) {
  const authUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const push = usePushNotifications()

  const [nombre, setNombre] = useState(perfil?.nombre ?? "")
  const [telefono, setTelefono] = useState(perfil?.telefono ?? "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      nombre?: string
      telefono?: string
      currentPassword?: string
      newPassword?: string
    }) => {
      const res = await fetch("/api/repartidor/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Error al actualizar")
      return result
    },
    onSuccess: (data) => {
      toast.success("Perfil actualizado")
      setCurrentPassword("")
      setNewPassword("")
      setShowPasswordForm(false)
      queryClient.invalidateQueries({ queryKey: ["repartidor-perfil"] })
    },
    onError: (error: Error) => {
      toast.error("Error al actualizar", { description: error.message })
    },
  })

  const handleSaveProfile = () => {
    const data: Record<string, string> = {}
    if (nombre.trim() && nombre !== perfil?.nombre) data.nombre = nombre.trim()
    if (telefono !== perfil?.telefono) data.telefono = telefono

    if (Object.keys(data).length === 0) {
      toast.info("No hay cambios para guardar")
      return
    }

    updateMutation.mutate(data)
  }

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      toast.error("Completá ambos campos de contraseña")
      return
    }
    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres")
      return
    }
    updateMutation.mutate({ currentPassword, newPassword })
  }

  if (isLoading) {
    return <ProfileSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-3">
          <Bike className="h-10 w-10 text-blue-500" />
        </div>
        <h2 className="font-bold text-xl">{perfil?.nombre ?? authUser?.nombre}</h2>
        <p className="text-sm text-muted-foreground">{perfil?.email}</p>
        <div className="flex items-center gap-2 mt-2">
          {perfil?.activo ? (
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-0 text-xs gap-1">
              <Shield className="h-3 w-3" />
              Cuenta activa
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs gap-1">
              Cuenta desactivada
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs gap-1 border-0">
            <Calendar className="h-3 w-3" />
            Registrado {new Date(perfil?.fechaRegistro ?? "").toLocaleDateString("es-AR", {
              month: "short",
              year: "numeric",
            })}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Edit profile form */}
      <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Datos personales
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Nombre
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="pl-10 rounded-xl"
                placeholder="Tu nombre"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={perfil?.email ?? ""}
                className="pl-10 rounded-xl bg-muted/30"
                disabled
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">El email no se puede cambiar</p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Teléfono
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="pl-10 rounded-xl"
                placeholder="Tu teléfono"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSaveProfile}
          disabled={updateMutation.isPending}
          className="w-full gap-2 rounded-xl"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar cambios
        </Button>
      </div>

      {/* Password change */}
      <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Cambiar contraseña
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowPasswordForm(!showPasswordForm)}
          >
            {showPasswordForm ? "Cancelar" : "Cambiar"}
          </Button>
        </div>

        {showPasswordForm && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Contraseña actual
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-10 rounded-xl"
                  placeholder="Contraseña actual"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 rounded-xl"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={updateMutation.isPending || !currentPassword || !newPassword}
              variant="outline"
              className="w-full gap-2 rounded-xl"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Actualizar contraseña
            </Button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {push.isSupported && (
        <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            {push.isSubscribed ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            Notificaciones
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Notificaciones push</p>
              <p className="text-xs text-muted-foreground">
                {push.isSubscribed
                  ? "Recibí alertas de nuevos pedidos"
                  : "Activá para recibir alertas de entregas"}
              </p>
            </div>
            <Switch
              checked={push.isSubscribed}
              onCheckedChange={(checked) => {
                if (checked) {
                  push.subscribe()
                } else {
                  push.unsubscribe()
                }
              }}
              disabled={push.loading}
            />
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="rounded-2xl bg-muted/40 p-4">
        <h3 className="font-semibold text-sm mb-3">Resumen</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-xl bg-background">
            <p className="text-2xl font-bold text-primary">
              {perfil?.negocios?.length ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Locales</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-background">
            <p className="text-2xl font-bold text-emerald-600">🛵</p>
            <p className="text-xs text-muted-foreground">Repartidor</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex flex-col items-center py-4">
        <div className="w-20 h-20 rounded-2xl bg-muted/50 mb-3" />
        <div className="h-6 w-32 rounded bg-muted/50" />
        <div className="h-3 w-40 rounded bg-muted/30 mt-1" />
      </div>
      <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-3">
        <div className="h-4 w-32 rounded bg-muted/30" />
        <div className="h-10 rounded-xl bg-muted/30" />
        <div className="h-10 rounded-xl bg-muted/30" />
        <div className="h-10 rounded-xl bg-muted/30" />
        <div className="h-10 rounded-xl bg-muted/30" />
      </div>
    </div>
  )
}
