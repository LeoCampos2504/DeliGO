"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Check,
  X,
  Store,
  Calendar,
  Truck,
  Loader2,
  Mail,
  MailCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSuperAdminStore } from "@/store/superadmin-store"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface NegocioPendiente {
  id: string
  nombre: string
  slug: string
  rubro: string
  usuario: string
  email: string
  logoUrl: string | null
  createdAt: string
  ofreceDelivery: boolean
  whatsapp: string
  emailVerified: string | null
}

interface PendientesTabProps {
  pendientes: NegocioPendiente[]
  isLoading: boolean
}

// ============================================
// Pendientes Tab
// ============================================
export function PendientesTab({ pendientes, isLoading }: PendientesTabProps) {
  if (isLoading) return <PendientesSkeleton />

  if (pendientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl mb-4">✅</span>
        <h3 className="font-bold text-lg">Todo al día</h3>
        <p className="text-sm text-muted-foreground mt-1">
          No hay negocios pendientes de aprobación.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">Pendientes de aprobación</h2>
          <p className="text-sm text-muted-foreground">
            {pendientes.length} negocio{pendientes.length !== 1 ? "s" : ""} esperando revisión
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {pendientes.map((negocio) => (
            <PendienteCard key={negocio.id} negocio={negocio} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ============================================
// Pendiente Card
// ============================================
function PendienteCard({ negocio }: { negocio: NegocioPendiente }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const triggerRefresh = useSuperAdminStore((s) => s.triggerRefresh)
  const queryClient = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/superadmin/negocios/${negocio.id}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onMutate: () => setActionLoading("approve"),
    onSuccess: (data) => {
      toast.success("Negocio aprobado", { description: data.mensaje })
      triggerRefresh()
    },
    onError: (error: Error) => {
      toast.error("Error al aprobar", { description: error.message })
    },
    onSettled: () => setActionLoading(null),
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/superadmin/negocios/${negocio.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onMutate: () => setActionLoading("reject"),
    onSuccess: (data) => {
      toast.success("Negocio rechazado", { description: data.mensaje })
      triggerRefresh()
    },
    onError: (error: Error) => {
      toast.error("Error al rechazar", { description: error.message })
    },
    onSettled: () => setActionLoading(null),
  })

  const rubroLabels: Record<string, string> = {
    restaurante: "🍔 Restaurante",
    ropa: "👕 Indumentaria",
    negocio: "🏪 Negocio",
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="rounded-2xl bg-card border border-amber-500/20 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 overflow-hidden">
            {negocio.logoUrl ? (
              <img src={negocio.logoUrl} alt={negocio.nombre} className="w-full h-full object-cover" />
            ) : (
              <Store className="h-5 w-5 text-amber-500" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate">{negocio.nombre}</h3>
              <Badge variant="secondary" className="text-[10px] shrink-0 border-0">
                {rubroLabels[negocio.rubro] || negocio.rubro}
              </Badge>
              {negocio.emailVerified && (
                <Badge variant="secondary" className="text-[10px] shrink-0 border-0 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 gap-1">
                  <MailCheck className="h-3 w-3" />
                  Email verificado
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">/{negocio.slug}</p>
            {negocio.email && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {negocio.email}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(negocio.createdAt).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {negocio.ofreceDelivery && (
                <span className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Delivery
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Button
            className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            onClick={() => approveMutation.mutate()}
            disabled={!!actionLoading}
          >
            {actionLoading === "approve" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Aprobar
          </Button>
          <Button
            variant="destructive"
            className="flex-1 gap-2 rounded-xl font-semibold"
            onClick={() => {
              if (confirm(`¿Rechazar y eliminar "${negocio.nombre}"? Esta acción no se puede deshacer.`)) {
                rejectMutation.mutate()
              }
            }}
            disabled={!!actionLoading}
          >
            {actionLoading === "reject" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            Rechazar
          </Button>
          {negocio.whatsapp && (
            <a
              href={`https://wa.me/${negocio.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="gap-2 rounded-xl h-10 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/5 border-green-500/20"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </Button>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function PendientesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div>
          <div className="h-5 w-48 rounded bg-muted/50 animate-pulse" />
          <div className="h-3 w-36 rounded bg-muted/30 animate-pulse mt-1" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card border border-border/50 p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted/30" />
              <div className="h-3 w-20 rounded bg-muted/20" />
              <div className="h-3 w-40 rounded bg-muted/20" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <div className="flex-1 h-9 rounded-xl bg-muted/30" />
            <div className="flex-1 h-9 rounded-xl bg-muted/30" />
          </div>
        </div>
      ))}
    </div>
  )
}
