"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldAlert,
  UserX,
  MapPinOff,
  PackageX,
  CreditCard,
  AlertOctagon,
  HelpCircle,
  Trash2,
  Loader2,
  Unlock,
  Filter,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSuperAdminStore } from "@/store/superadmin-store"
import { cn, timeAgo } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface Denuncia {
  id: string
  clienteId: string
  negocioId: string
  pedidoId: string | null
  negocioNombre: string
  clienteNombre: string
  motivoTipo: string
  motivo: string
  fecha: string
}

interface ClienteInfo {
  id: string
  nombre: string
  email: string
  bloqueado: boolean
  bloqueadoFecha: string | null
}

interface DenunciasStats {
  total: number
  clientesBloqueados: number
  porTipo: Record<string, number>
}

interface DenunciasResponse {
  denuncias: Denuncia[]
  clienteMap: Record<string, ClienteInfo>
  stats: DenunciasStats
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ============================================
// Motivo tipo config
// ============================================
const motivoConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof ShieldAlert }> = {
  direccion_falsa: {
    label: "Dirección falsa",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-500/10",
    icon: MapPinOff,
  },
  no_retiro: {
    label: "No retiró pedido",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-500/10",
    icon: PackageX,
  },
  no_pago: {
    label: "No pagó",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-500/10",
    icon: CreditCard,
  },
  comportamiento: {
    label: "Comportamiento inadecuado",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-500/10",
    icon: AlertOctagon,
  },
  otro: {
    label: "Otro",
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-500/10",
    icon: HelpCircle,
  },
}

const filterOptions: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "direccion_falsa", label: "Dirección falsa" },
  { value: "no_retiro", label: "No retiró" },
  { value: "no_pago", label: "No pagó" },
  { value: "comportamiento", label: "Comportamiento inadecuado" },
  { value: "otro", label: "Otro" },
]

// ============================================
// Denuncias Tab
// ============================================
export function DenunciasTab() {
  const queryClient = useQueryClient()
  const triggerRefresh = useSuperAdminStore((s) => s.triggerRefresh)

  const [motivoFilter, setMotivoFilter] = useState("todos")
  const [page, setPage] = useState(1)
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null)
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false)
  const LIMIT = 20

  // Fetch denuncias
  const { data, isLoading, isFetching } = useQuery<DenunciasResponse>({
    queryKey: ["superadmin-denuncias", motivoFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(LIMIT))
      if (motivoFilter !== "todos") {
        params.set("motivoTipo", motivoFilter)
      }
      const res = await fetch(`/api/superadmin/denuncias?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al cargar denuncias")
      }
      return res.json()
    },
    refetchInterval: 30000,
  })

  // Fetch cliente detail for dialog
  const { data: clienteDetail, isLoading: clienteLoading } = useQuery<{
    denuncias: Denuncia[]
    clienteInfo: ClienteInfo
  }>({
    queryKey: ["superadmin-denuncias-cliente", selectedClienteId],
    queryFn: async () => {
      const res = await fetch(`/api/superadmin/denuncias?clienteId=${selectedClienteId}&limit=100`)
      if (!res.ok) throw new Error("Error al cargar detalle del cliente")
      return res.json()
    },
    enabled: !!selectedClienteId && clienteDialogOpen,
  })

  // Delete denuncia mutation
  const deleteMutation = useMutation({
    mutationFn: async (denunciaId: string) => {
      const res = await fetch(`/api/superadmin/denuncias/${denunciaId}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error al eliminar")
      return json as { ok: boolean; mensaje: string; desbloqueado: boolean; denunciasRestantes: number }
    },
    onSuccess: (result) => {
      toast.success("Denuncia eliminada", {
        description: result.desbloqueado
          ? "Cliente desbloqueado automáticamente (sin denuncias restantes)"
          : `Quedan ${result.denunciasRestantes} denuncia${result.denunciasRestantes !== 1 ? "s" : ""}`,
      })
      queryClient.invalidateQueries({ queryKey: ["superadmin-denuncias"] })
      triggerRefresh()
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  })

  // Desbloquear cliente mutation
  const desbloquearMutation = useMutation({
    mutationFn: async ({ clienteId, eliminarDenuncias }: { clienteId: string; eliminarDenuncias: boolean }) => {
      const params = new URLSearchParams()
      if (eliminarDenuncias) params.set("eliminarDenuncias", "true")
      const res = await fetch(`/api/superadmin/clientes/${clienteId}/desbloquear?${params.toString()}`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error al desbloquear")
      return json as { ok: boolean; mensaje: string; denunciasEliminadas?: number }
    },
    onSuccess: (result) => {
      const desc = result.denunciasEliminadas
        ? `Se eliminaron ${result.denunciasEliminadas} denuncia${result.denunciasEliminadas !== 1 ? "s" : ""}`
        : result.mensaje
      toast.success("Cliente desbloqueado", { description: desc })
      setClienteDialogOpen(false)
      setSelectedClienteId(null)
      queryClient.invalidateQueries({ queryKey: ["superadmin-denuncias"] })
      triggerRefresh()
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
  })

  const handleOpenCliente = useCallback((clienteId: string) => {
    setSelectedClienteId(clienteId)
    setClienteDialogOpen(true)
  }, [])

  // Reset page when filter changes
  const handleFilterChange = useCallback((value: string) => {
    setMotivoFilter(value)
    setPage(1)
  }, [])

  const denuncias = data?.denuncias ?? []
  const clienteMap = data?.clienteMap ?? {}
  const stats = data?.stats
  const pagination = data?.pagination

  if (isLoading) return <DenunciasSkeleton />

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          <div className="rounded-xl bg-red-500/10 px-3 py-2.5">
            <p className="text-[10px] text-red-700 dark:text-red-400 font-medium">Total denuncias</p>
            <p className="text-lg font-bold text-red-800 dark:text-red-300">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-orange-500/10 px-3 py-2.5">
            <p className="text-[10px] text-orange-700 dark:text-orange-400 font-medium">Bloqueados</p>
            <p className="text-lg font-bold text-orange-800 dark:text-orange-300">{stats.clientesBloqueados}</p>
          </div>
          {Object.entries(motivoConfig).map(([key, config]) => {
            const count = stats.porTipo[key] ?? 0
            return (
              <div
                key={key}
                className={cn("rounded-xl px-3 py-2.5", config.bgColor)}
              >
                <p className={cn("text-[10px] font-medium", config.color)}>
                  {config.label}
                </p>
                <p className={cn("text-lg font-bold", config.color)}>{count}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={motivoFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-full sm:w-[220px] rounded-xl text-sm">
            <SelectValue placeholder="Filtrar por motivo" />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {motivoFilter !== "todos" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => handleFilterChange("todos")}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Denuncias list */}
      {denuncias.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-4">📋</span>
          <h3 className="font-bold text-lg">Sin denuncias</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {motivoFilter !== "todos"
              ? "No hay denuncias con este filtro."
              : "No hay denuncias registradas en el sistema."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {denuncias.map((denuncia) => {
              const cliente = clienteMap[denuncia.clienteId]
              return (
                <DenunciaCard
                  key={denuncia.id}
                  denuncia={denuncia}
                  cliente={cliente}
                  onDelete={(id) => {
                    if (confirm("¿Eliminar esta denuncia?")) {
                      deleteMutation.mutate(id)
                    }
                  }}
                  onOpenCliente={handleOpenCliente}
                  isDeleting={deleteMutation.isPending}
                />
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            className="gap-2 rounded-xl h-9 text-xs"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isFetching || page <= 1}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            className="gap-2 rounded-xl h-9 text-xs"
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching || page >= pagination.totalPages}
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Siguiente
          </Button>
        </div>
      )}

      {/* Cliente detail dialog */}
      <Dialog open={clienteDialogOpen} onOpenChange={(open) => {
        setClienteDialogOpen(open)
        if (!open) setSelectedClienteId(null)
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-500" />
              Detalle del cliente
            </DialogTitle>
            {clienteDetail?.clienteInfo && (
              <DialogDescription>
                {clienteDetail.clienteInfo.nombre} — {clienteDetail.clienteInfo.email}
              </DialogDescription>
            )}
          </DialogHeader>

          {clienteLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clienteDetail ? (
            <div className="space-y-4">
              {/* Block status */}
              <div
                className={cn(
                  "rounded-xl p-3 flex items-center justify-between",
                  clienteDetail.clienteInfo.bloqueado
                    ? "bg-red-500/10 border border-red-500/20"
                    : "bg-emerald-500/10 border border-emerald-500/20"
                )}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {clienteDetail.clienteInfo.bloqueado ? "Bloqueado" : "Activo"}
                  </p>
                  {clienteDetail.clienteInfo.bloqueado && clienteDetail.clienteInfo.bloqueadoFecha && (
                    <p className="text-[10px] text-muted-foreground">
                      Desde {new Date(clienteDetail.clienteInfo.bloqueadoFecha).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                {clienteDetail.clienteInfo.bloqueado && (
                  <Badge className="text-[10px] border-0 bg-red-500/15 text-red-700 dark:text-red-300">
                    🚫 Bloqueado
                  </Badge>
                )}
              </div>

              {/* Denuncias list */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                  Denuncias ({clienteDetail.denuncias.length})
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {clienteDetail.denuncias.map((d) => {
                    const config = motivoConfig[d.motivoTipo] || motivoConfig.otro
                    const MotivoIcon = config.icon
                    return (
                      <div
                        key={d.id}
                        className="rounded-xl bg-muted/40 p-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <MotivoIcon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", config.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Badge className={cn("text-[9px] shrink-0 border-0", config.bgColor, config.color)}>
                                {config.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {timeAgo(new Date(d.fecha))}
                              </span>
                            </div>
                            <p className="text-xs mt-0.5 text-foreground/80 truncate">
                              {d.motivo}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Negocio: {d.negocioNombre}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Unblock actions */}
              {clienteDetail.clienteInfo.bloqueado && (
                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button
                    className="w-full gap-2 rounded-xl h-9 text-xs"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`¿Desbloquear a ${clienteDetail.clienteInfo.nombre}? Se mantendrán sus denuncias.`)) {
                        desbloquearMutation.mutate({
                          clienteId: clienteDetail.clienteInfo.id,
                          eliminarDenuncias: false,
                        })
                      }
                    }}
                    disabled={desbloquearMutation.isPending}
                  >
                    {desbloquearMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
                    )}
                    Desbloquear
                  </Button>
                  <Button
                    className="w-full gap-2 rounded-xl h-9 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => {
                      if (confirm(
                        `¿Desbloquear a ${clienteDetail.clienteInfo.nombre} y eliminar todas sus denuncias? Esta acción no se puede deshacer.`
                      )) {
                        desbloquearMutation.mutate({
                          clienteId: clienteDetail.clienteInfo.id,
                          eliminarDenuncias: true,
                        })
                      }
                    }}
                    disabled={desbloquearMutation.isPending}
                  >
                    {desbloquearMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Desbloquear y eliminar denuncias
                  </Button>
                </DialogFooter>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No se encontró información</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Denuncia Card
// ============================================
function DenunciaCard({
  denuncia,
  cliente,
  onDelete,
  onOpenCliente,
  isDeleting,
}: {
  denuncia: Denuncia
  cliente?: ClienteInfo
  onDelete: (id: string) => void
  onOpenCliente: (clienteId: string) => void
  isDeleting: boolean
}) {
  const config = motivoConfig[denuncia.motivoTipo] || motivoConfig.otro
  const MotivoIcon = config.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="rounded-2xl bg-card border overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Cliente avatar */}
          <button
            onClick={() => onOpenCliente(denuncia.clienteId)}
            className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 cursor-pointer hover:bg-orange-500/20 transition-colors"
            title="Ver detalle del cliente"
          >
            <UserX className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Cliente name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onOpenCliente(denuncia.clienteId)}
                className="font-bold text-sm truncate hover:underline cursor-pointer"
              >
                {denuncia.clienteNombre}
              </button>
              {cliente?.bloqueado && (
                <Badge className="text-[10px] shrink-0 border-0 bg-red-500/10 text-red-700 dark:text-red-300">
                  🚫 Bloqueado
                </Badge>
              )}
            </div>

            {/* Email */}
            {cliente?.email && (
              <div className="flex items-center gap-1 mt-0.5">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <p className="text-[11px] text-muted-foreground truncate">{cliente.email}</p>
              </div>
            )}

            {/* Negocio name */}
            <p className="text-xs text-muted-foreground mt-1">
              Denunciado por: <span className="font-medium text-foreground/80">{denuncia.negocioNombre}</span>
            </p>

            {/* Motivo tipo badge */}
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className={cn("text-[10px] shrink-0 border-0 gap-1", config.bgColor, config.color)}>
                <MotivoIcon className="h-3 w-3" />
                {config.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {timeAgo(new Date(denuncia.fecha))}
              </span>
            </div>

            {/* Motivo text */}
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {denuncia.motivo}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-xl h-9 text-xs text-muted-foreground hover:text-destructive ml-auto"
            onClick={() => onDelete(denuncia.id)}
            disabled={isDeleting}
            title="Eliminar denuncia"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Eliminar
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function DenunciasSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-muted/30 px-3 py-2.5">
            <div className="h-3 w-16 rounded bg-muted/40 mb-1" />
            <div className="h-6 w-8 rounded bg-muted/50" />
          </div>
        ))}
      </div>

      {/* Filter skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted/30" />
        <div className="h-9 w-[220px] rounded-xl bg-muted/30" />
      </div>

      {/* Cards skeleton */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card border border-border/50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-24 rounded bg-muted/30" />
                <div className="h-4 w-14 rounded bg-red-500/10" />
              </div>
              <div className="h-3 w-40 rounded bg-muted/20" />
              <div className="flex gap-2">
                <div className="h-5 w-20 rounded bg-muted/30" />
                <div className="h-3 w-16 rounded bg-muted/20" />
              </div>
              <div className="h-3 w-full rounded bg-muted/15" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
