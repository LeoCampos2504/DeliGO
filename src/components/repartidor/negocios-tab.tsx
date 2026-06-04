"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  X,
  Store,
  Key,
  Calendar,
  Search,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn, formatPrice } from "@/lib/utils"
import { useRepartidorStore } from "@/store/repartidor-store"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface NegocioAsociado {
  id: string
  negocioId: string
  negocioSlug: string
  negocioNombre: string
  negocioLogoUrl: string | null
  codigoAcceso: string
  fechaAsociacion: string
  negocio?: {
    id: string
    nombre: string
    slug: string
    logoUrl: string | null
    ofreceDelivery: boolean
    suspendido: boolean
  }
}

interface NegociosTabProps {
  negocios: NegocioAsociado[]
  isLoading: boolean
}

// ============================================
// Negocios Tab
// ============================================
export function NegociosTab({ negocios, isLoading }: NegociosTabProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [code, setCode] = useState("")
  const queryClient = useQueryClient()
  const triggerRefresh = useRepartidorStore((s) => s.triggerRefresh)

  // Add negocio mutation
  const addMutation = useMutation({
    mutationFn: async (codigo: string) => {
      const res = await fetch("/api/repartidor/negocios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al asociar")
      return data
    },
    onSuccess: (data) => {
      toast.success("Local asociado", {
        description: `Ahora estás asociado a ${data.negocio.negocioNombre}`,
      })
      setCode("")
      setShowAddForm(false)
      triggerRefresh()
      queryClient.invalidateQueries({ queryKey: ["repartidor-perfil"] })
    },
    onError: (error: Error) => {
      toast.error("Error al asociar", { description: error.message })
    },
  })

  // Remove negocio mutation
  const removeMutation = useMutation({
    mutationFn: async (negocioId: string) => {
      const res = await fetch("/api/repartidor/negocios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al desasociar")
      return data
    },
    onSuccess: () => {
      toast.success("Local desasociado")
      triggerRefresh()
      queryClient.invalidateQueries({ queryKey: ["repartidor-perfil"] })
    },
    onError: (error: Error) => {
      toast.error("Error al desasociar", { description: error.message })
    },
  })

  const handleAdd = () => {
    if (!code.trim()) return
    addMutation.mutate(code.trim())
  }

  if (isLoading) {
    return <NegociosSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">Mis Locales</h2>
          <p className="text-sm text-muted-foreground">
            {negocios.length} local{negocios.length !== 1 ? "es" : ""} asociado{negocios.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* Add negocio form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-card border border-primary/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Ingresá el código del local</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Pedile al local su código de acceso (formato NF-XXXXXX) para poder ver sus deliveries.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="NF-XXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl uppercase"
                  maxLength={10}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <Button
                  onClick={handleAdd}
                  disabled={addMutation.isPending || !code.trim()}
                  className="rounded-xl gap-2"
                >
                  {addMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Asociar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Negocios list */}
      {negocios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-5xl mb-4">🏪</span>
          <h3 className="font-bold text-lg">Sin locales asociados</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Agregá un local usando su código de acceso para empezar a recibir deliveries.
          </p>
          <Button
            size="sm"
            className="mt-4 gap-2 rounded-xl"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4" />
            Agregar local
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {negocios.map((negocio) => (
              <motion.div
                key={negocio.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                className="rounded-2xl bg-card border border-border/50 p-4"
              >
                <div className="flex items-center gap-3">
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted/50 flex items-center justify-center shrink-0">
                    {negocio.negocioLogoUrl ? (
                      <img
                        src={negocio.negocioLogoUrl}
                        alt={negocio.negocioNombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">
                        {negocio.negocioNombre}
                      </h3>
                      {negocio.negocio?.suspendido && (
                        <Badge variant="destructive" className="text-[10px] shrink-0">
                          Suspendido
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Key className="h-3 w-3" />
                        {negocio.codigoAcceso}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(negocio.fechaAsociacion).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => {
                      if (confirm(`¿Desasociarte de ${negocio.negocioNombre}?`)) {
                        removeMutation.mutate(negocio.negocioId)
                      }
                    }}
                    disabled={removeMutation.isPending}
                    title="Desasociar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info box */}
      <div className="rounded-2xl bg-blue-500/5 border border-blue-500/10 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            ¿Cómo obtengo el código?
          </p>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
            El dueño del local puede encontrar el código de repartidor en la sección de configuración de su panel. El formato es NF-XXXXXX.
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function NegociosSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div>
          <div className="h-5 w-28 rounded bg-muted/50 animate-pulse" />
          <div className="h-3 w-36 rounded bg-muted/30 animate-pulse mt-1" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-muted/50 animate-pulse" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-card border border-border/50 p-4 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted/30" />
              <div className="h-3 w-24 rounded bg-muted/20" />
            </div>
            <div className="w-8 h-8 rounded-full bg-muted/30" />
          </div>
        </div>
      ))}
    </div>
  )
}
