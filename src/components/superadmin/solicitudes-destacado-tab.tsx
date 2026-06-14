"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Flame,
  Check,
  X,
  Clock,
  Loader2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"

// ============================================
// Types
// ============================================
interface SolicitudDestacado {
  id: string
  negocioId: string
  meses: number
  dias: number
  precio: number
  estado: string
  comprobanteUrl: string | null
  notaAdmin: string | null
  createdAt: string
  updatedAt: string
  negocio: {
    id: string
    nombre: string
    slug: string
    logoUrl: string | null
    colorPrincipal: string
    destacadoHasta: string | null
    promocionado: boolean
  }
}

interface SolicitudesData {
  solicitudes: SolicitudDestacado[]
  total: number
  page: number
  pageSize: number
  stats: {
    pendientes: number
    aprobadas: number
    rechazadas: number
  }
}

// ============================================
// Solicitudes Destacado Tab
// ============================================
export function SolicitudesDestacadoTab() {
  const queryClient = useQueryClient()
  const [estadoFilter, setEstadoFilter] = useState<string>("pendiente")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<SolicitudesData>({
    queryKey: ["solicitudes-destacado", estadoFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (estadoFilter) params.set("estado", estadoFilter)
      params.set("page", page.toString())
      const res = await fetch(`/api/superadmin/solicitudes-destacado?${params}`)
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    refetchInterval: 15000,
  })

  const aprobarMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/superadmin/solicitudes-destacado/${id}/aprobar`, { method: "POST" })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      return d
    },
    onSuccess: (data) => {
      toast.success("Solicitud aprobada", { description: data.mensaje })
      queryClient.invalidateQueries({ queryKey: ["solicitudes-destacado"] })
      queryClient.invalidateQueries({ queryKey: ["superadmin-dashboard"] })
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  })

  const rechazarMutation = useMutation({
    mutationFn: async ({ id, nota }: { id: string; nota: string }) => {
      const res = await fetch(`/api/superadmin/solicitudes-destacado/${id}/rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notaAdmin: nota }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      return d
    },
    onSuccess: () => {
      toast.success("Solicitud rechazada")
      queryClient.invalidateQueries({ queryKey: ["solicitudes-destacado"] })
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  })

  if (isLoading) return <SolicitudesSkeleton />

  const stats = data?.stats ?? { pendientes: 0, aprobadas: 0, rechazadas: 0 }
  const solicitudes = data?.solicitudes ?? []
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-lg">Solicitudes destacado</h2>
        <p className="text-sm text-muted-foreground">
          {stats.pendientes} pendiente{stats.pendientes !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => { setEstadoFilter("pendiente"); setPage(1) }}
          className={cn(
            "rounded-xl px-3 py-2 text-left transition-colors border",
            estadoFilter === "pendiente" ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/30 border-transparent"
          )}
        >
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Pendientes</p>
          <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{stats.pendientes}</p>
        </button>
        <button
          onClick={() => { setEstadoFilter("aprobada"); setPage(1) }}
          className={cn(
            "rounded-xl px-3 py-2 text-left transition-colors border",
            estadoFilter === "aprobada" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted/30 border-transparent"
          )}
        >
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Aprobadas</p>
          <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{stats.aprobadas}</p>
        </button>
        <button
          onClick={() => { setEstadoFilter("rechazada"); setPage(1) }}
          className={cn(
            "rounded-xl px-3 py-2 text-left transition-colors border",
            estadoFilter === "rechazada" ? "bg-red-500/10 border-red-500/30" : "bg-muted/30 border-transparent"
          )}
        >
          <p className="text-[10px] text-red-700 dark:text-red-400 font-medium">Rechazadas</p>
          <p className="text-lg font-bold text-red-800 dark:text-red-300">{stats.rechazadas}</p>
        </button>
      </div>

      {/* List */}
      {solicitudes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-3">📭</span>
          <h3 className="font-bold text-sm">Sin solicitudes {estadoFilter === "pendiente" ? "pendientes" : estadoFilter === "aprobada" ? "aprobadas" : "rechazadas"}</h3>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {solicitudes.map((sol) => (
              <SolicitudCard
                key={sol.id}
                solicitud={sol}
                onAprobar={() => aprobarMutation.mutate(sol.id)}
                onRechazar={(nota) => rechazarMutation.mutate({ id: sol.id, nota })}
                isAprobando={aprobarMutation.isPending}
                isRechazando={rechazarMutation.isPending}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================
// Solicitud Card
// ============================================
function SolicitudCard({
  solicitud,
  onAprobar,
  onRechazar,
  isAprobando,
  isRechazando,
}: {
  solicitud: SolicitudDestacado
  onAprobar: () => void
  onRechazar: (nota: string) => void
  isAprobando: boolean
  isRechazando: boolean
}) {
  const [showRechazar, setShowRechazar] = useState(false)
  const [notaRechazo, setNotaRechazo] = useState("")
  const neg = solicitud.negocio

  const estadoConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pendiente: { label: "Pendiente", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-500/10" },
    aprobada: { label: "Aprobada", color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-500/10" },
    rechazada: { label: "Rechazada", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-500/10" },
  }

  const estado = estadoConfig[solicitud.estado] || estadoConfig.pendiente

  // Period description
  const periodParts: string[] = []
  if (solicitud.meses > 0) periodParts.push(`${solicitud.meses} mes${solicitud.meses > 1 ? "es" : ""}`)
  if (solicitud.dias > 0) periodParts.push(`${solicitud.dias} día${solicitud.dias > 1 ? "s" : ""}`)
  const periodDesc = periodParts.join(" + ")

  // Current destacado status
  const ahora = new Date()
  const destHasta = neg.destacadoHasta ? new Date(neg.destacadoHasta) : null
  const isCurrentlyDestacado = neg.promocionado && destHasta && destHasta > ahora

  // New end date if approved
  let nuevaFechaStr = ""
  if (solicitud.estado === "pendiente") {
    const fechaBase = isCurrentlyDestacado && destHasta ? new Date(destHasta) : new Date()
    const nuevaFecha = new Date(fechaBase)
    nuevaFecha.setMonth(nuevaFecha.getMonth() + solicitud.meses)
    nuevaFecha.setDate(nuevaFecha.getDate() + solicitud.dias)
    nuevaFechaStr = nuevaFecha.toLocaleDateString("es-AR")
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={cn(
        "rounded-2xl bg-card border overflow-hidden",
        solicitud.estado === "pendiente" ? "border-amber-500/20" :
        solicitud.estado === "aprobada" ? "border-emerald-500/20" : "border-red-500/20"
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: neg.logoUrl ? undefined : `${neg.colorPrincipal}18` }}
          >
            {neg.logoUrl ? (
              <img src={neg.logoUrl} alt={neg.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold" style={{ color: neg.colorPrincipal }}>
                {neg.nombre.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm truncate">{neg.nombre}</h3>
              <Badge className={cn("text-[10px] shrink-0 border-0 gap-1", estado.bgColor, estado.color)}>
                {solicitud.estado === "pendiente" && <Clock className="h-3 w-3" />}
                {solicitud.estado === "aprobada" && <Check className="h-3 w-3" />}
                {solicitud.estado === "rechazada" && <X className="h-3 w-3" />}
                {estado.label}
              </Badge>
              {isCurrentlyDestacado && (
                <Badge className="text-[10px] shrink-0 border-0 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  🔥 Ya destacado
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">/{neg.slug}</p>

            {/* Solicitud details */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  {periodDesc}
                </span>
                <span className="font-semibold text-foreground">{formatPrice(solicitud.precio)}</span>
              </div>
              {solicitud.estado === "pendiente" && nuevaFechaStr && (
                <p className="text-[10px] text-muted-foreground">
                  {isCurrentlyDestacado ? "Se extenderá hasta" : "Destacado hasta"}: {nuevaFechaStr}
                </p>
              )}
              {isCurrentlyDestacado && destHasta && (
                <p className="text-[10px] text-muted-foreground">
                  Actualmente destacado hasta: {destHasta.toLocaleDateString("es-AR")}
                </p>
              )}
            </div>

            {/* Rejection note */}
            {solicitud.estado === "rechazada" && solicitud.notaAdmin && (
              <div className="mt-2 rounded-lg bg-red-500/5 border border-red-500/10 p-2">
                <p className="text-[11px] text-red-700 dark:text-red-400">
                  <span className="font-semibold">Motivo:</span> {solicitud.notaAdmin}
                </p>
              </div>
            )}

            {/* Created date */}
            <p className="text-[10px] text-muted-foreground mt-2">
              Solicitado: {new Date(solicitud.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* Actions */}
        {solicitud.estado === "pendiente" && (
          <div className="mt-3 pt-3 border-t border-border/30">
            {showRechazar ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Motivo del rechazo (opcional)"
                  value={notaRechazo}
                  onChange={(e) => setNotaRechazo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl text-xs"
                    onClick={() => setShowRechazar(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 rounded-xl text-xs gap-1"
                    onClick={() => onRechazar(notaRechazo)}
                    disabled={isRechazando}
                  >
                    {isRechazando ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    Confirmar rechazo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href={`/n/${neg.slug}`} className="flex-1" target="_blank">
                  <Button variant="outline" className="w-full gap-2 rounded-xl h-9 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    Ver negocio
                  </Button>
                </Link>
                <Button
                  className="flex-1 gap-2 rounded-xl h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    if (confirm(`¿Aprobar solicitud de ${neg.nombre} por ${periodDesc} (${formatPrice(solicitud.precio)})?`)) {
                      onAprobar()
                    }
                  }}
                  disabled={isAprobando}
                >
                  {isAprobando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Aprobar
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl h-9 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/5 border-red-500/20"
                  onClick={() => setShowRechazar(true)}
                  disabled={isRechazando}
                >
                  <X className="h-3.5 w-3.5" />
                  Rechazar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function SolicitudesSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <div className="h-5 w-44 rounded bg-muted/50 animate-pulse" />
        <div className="h-3 w-28 rounded bg-muted/30 animate-pulse mt-1" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-muted/30 p-3 animate-pulse">
            <div className="h-3 w-16 rounded bg-muted/30" />
            <div className="h-6 w-8 rounded bg-muted/50 mt-1" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card border border-border/50 p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-28 rounded bg-muted/30" />
                <div className="h-4 w-16 rounded bg-amber-500/10" />
              </div>
              <div className="h-3 w-48 rounded bg-muted/20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
