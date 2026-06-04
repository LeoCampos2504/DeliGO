"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  DollarSign,
  Wallet,
  TrendingDown,
  History,
  Loader2,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useSuperAdminStore } from "@/store/superadmin-store"
import { useAuthStore } from "@/store/auth-store"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface NegocioDeuda {
  id: string
  nombre: string
  slug: string
  logoUrl: string | null
  colorPrincipal: string
  deudaTarifa: number
  limiteDeudaCalculado: number
  porcentajeDeuda: number
  deudaAlcanzada: boolean
  planTipo: string
  suspendido: boolean
  whatsapp: string
}

interface DeudasTabProps {
  negocios: NegocioDeuda[]
  isLoading: boolean
  constants?: {
    tarifaServicio: number
    limiteSemanalDeuda: number
    limiteMinimoDeuda: number
    porcentajeAlertaDeuda: number
  }
}

// ============================================
// Deudas Tab
// ============================================
export function DeudasTab({ negocios, isLoading, constants }: DeudasTabProps) {
  const authUser = useAuthStore((s) => s.user)

  // Filter negocios with debt
  const conDeuda = negocios
    .filter((n) => n.deudaTarifa > 0)
    .sort((a, b) => b.deudaTarifa - a.deudaTarifa)

  // Debt history
  const [historyPage, setHistoryPage] = useState(1)
  const { data: historyData } = useQuery({
    queryKey: ["deuda-historial", historyPage],
    queryFn: async () => {
      const res = await fetch(`/api/superadmin/deuda-historial?page=${historyPage}&limit=10`)
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    enabled: !!authUser?.id,
  })

  if (isLoading) return <DeudasSkeleton />

  const totalDeuda = conDeuda.reduce((sum, n) => sum + n.deudaTarifa, 0)
  const limiteGlobal = constants?.limiteSemanalDeuda ?? 10000
  const tarifaServicio = constants?.tarifaServicio ?? 250

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-blue-500/10 border border-blue-500/10 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Gestión de deudas</h2>
            <p className="text-xs text-muted-foreground">Tarifa por servicio: {formatPrice(tarifaServicio)} por pedido entregado</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-background/50 p-3 text-center">
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatPrice(totalDeuda)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Deuda total</p>
          </div>
          <div className="rounded-xl bg-background/50 p-3 text-center">
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{conDeuda.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Con deuda</p>
          </div>
          <div className="rounded-xl bg-background/50 p-3 text-center">
            <p className="text-xl font-bold text-red-700 dark:text-red-300">
              {conDeuda.filter((n) => n.deudaAlcanzada).length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Límite alcanzado</p>
          </div>
        </div>
      </div>

      {/* Business debt list */}
      {conDeuda.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-5xl mb-4">💰</span>
          <h3 className="font-bold text-lg">Sin deudas pendientes</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Todos los negocios están al día con sus pagos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">Negocios con deuda</h3>
          <AnimatePresence>
            {conDeuda.map((negocio) => (
              <DeudaCard key={negocio.id} negocio={negocio} limiteGlobal={limiteGlobal} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Debt history */}
      <Separator />
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          Historial de pagos
        </h3>

        {(historyData?.historial ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin registros de pagos</p>
        ) : (
          <div className="space-y-2">
            {(historyData?.historial ?? []).map((pago: {
              id: string
              negocioNombre: string
              montoAbonado: number
              deudaAnterior: number
              fechaAbono: string
              tipo: string
            }) => (
              <div
                key={pago.id}
                className="rounded-xl bg-muted/40 p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">{pago.negocioNombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(pago.fechaAbono).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">-{formatPrice(pago.montoAbonado)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Deuda previa: {formatPrice(pago.deudaAnterior)}
                  </p>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {historyData?.pagination?.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                  disabled={historyPage <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {historyPage} / {historyData.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setHistoryPage(Math.min(historyData.pagination.totalPages, historyPage + 1))}
                  disabled={historyPage >= historyData.pagination.totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Deuda Card
// ============================================
function DeudaCard({ negocio, limiteGlobal }: { negocio: NegocioDeuda; limiteGlobal: number }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editingLimit, setEditingLimit] = useState(false)
  const [newLimit, setNewLimit] = useState(String(negocio.limiteDeudaCalculado))
  const triggerRefresh = useSuperAdminStore((s) => s.triggerRefresh)

  const abonarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/superadmin/deuda/${negocio.id}/abonar`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onMutate: () => setActionLoading("abonar"),
    onSuccess: (data) => {
      toast.success("Deuda saldada", { description: data.mensaje })
      triggerRefresh()
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
    onSettled: () => setActionLoading(null),
  })

  const updateLimitMutation = useMutation({
    mutationFn: async (limite: number) => {
      const res = await fetch(`/api/superadmin/deuda/${negocio.id}/limite`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nuevoLimite: limite }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onMutate: () => setActionLoading("limite"),
    onSuccess: (data) => {
      toast.success("Límite actualizado", { description: data.mensaje })
      setEditingLimit(false)
      triggerRefresh()
    },
    onError: (error: Error) => toast.error("Error", { description: error.message }),
    onSettled: () => setActionLoading(null),
  })

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={cn(
        "rounded-2xl bg-card border p-4",
        negocio.deudaAlcanzada ? "border-red-500/30" : "border-border/50"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            background: negocio.logoUrl ? undefined : `${negocio.colorPrincipal}18`,
          }}
        >
          {negocio.logoUrl ? (
            <img src={negocio.logoUrl} alt={negocio.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold" style={{ color: negocio.colorPrincipal }}>
              {negocio.nombre.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm truncate">{negocio.nombre}</h3>
            {negocio.deudaAlcanzada && (
              <Badge className="text-[10px] shrink-0 border-0 bg-red-500/10 text-red-700 dark:text-red-300">
                🚫 Oculto
              </Badge>
            )}
          </div>

          {/* Debt bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold">{formatPrice(negocio.deudaTarifa)}</span>
              <span className="text-muted-foreground">/ {formatPrice(negocio.limiteDeudaCalculado)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  negocio.porcentajeDeuda >= 100 ? "bg-red-500" :
                  negocio.porcentajeDeuda >= 80 ? "bg-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(negocio.porcentajeDeuda, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {(negocio.porcentajeDeuda ?? 0).toFixed(0)}% del límite
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              className="gap-2 rounded-xl h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (confirm(`¿Confirmar pago de deuda de ${formatPrice(negocio.deudaTarifa)} para ${negocio.nombre}?`)) {
                  abonarMutation.mutate()
                }
              }}
              disabled={!!actionLoading}
            >
              {actionLoading === "abonar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
              Abonar deuda
            </Button>

            {editingLimit ? (
              <div className="flex gap-1.5 items-center">
                <Input
                  type="number"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className="h-8 w-28 rounded-xl text-xs"
                  min={5000}
                  step={500}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => updateLimitMutation.mutate(Number(newLimit))}
                  disabled={actionLoading === "limite"}
                >
                  {actionLoading === "limite" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setEditingLimit(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="gap-2 rounded-xl h-8 text-xs"
                onClick={() => setEditingLimit(true)}
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Cambiar límite
              </Button>
            )}

            {negocio.whatsapp && (
              <a
                href={`https://wa.me/${negocio.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/5 border-green-500/20"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function DeudasSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-blue-500/5 border border-blue-500/10 p-5">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-background/50 p-3 text-center">
              <div className="h-6 w-16 rounded bg-muted/30 mx-auto" />
              <div className="h-3 w-12 rounded bg-muted/20 mx-auto mt-1" />
            </div>
          ))}
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card border border-border/50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 rounded bg-muted/30" />
              <div className="h-2.5 w-full rounded-full bg-muted/20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
