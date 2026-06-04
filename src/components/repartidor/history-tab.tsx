"use client"

import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  CheckCircle2,
  MapPin,
  Clock,
  Store,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, formatPrice, timeAgo } from "@/lib/utils"
import { useAuthStore } from "@/store/auth-store"
import { useState } from "react"

// ============================================
// Types
// ============================================
interface PedidoHistorial {
  id: string
  negocioNombre: string
  clienteNombre: string
  total: number
  metodoPago: string
  direccion: string | null
  fecha: string
  entregadoFecha: string | null
  items: Array<{
    nombre: string
    cantidad: number
    precio: number
  }>
  negocio: {
    id: string
    nombre: string
    logoUrl: string | null
    colorPrincipal: string
  }
}

// ============================================
// History Tab
// ============================================
export function HistoryTab() {
  const authUser = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["repartidor-historial", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/repartidor/pedidos-entregados?history=true&page=${page}&limit=10`
      )
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    enabled: !!authUser?.id,
  })

  if (isLoading) {
    return <HistorySkeleton />
  }

  const pedidos = data?.pedidos ?? []
  const pagination = data?.pagination

  if (pedidos.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl mb-4">📋</span>
        <h3 className="font-bold text-lg">Sin historial</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Aún no marcaste ningún pedido como entregado.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-lg">Historial de entregas</h2>
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} entrega{(data?.total ?? 0) !== 1 ? "s" : ""} completada{(data?.total ?? 0) !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Date groups */}
      <div className="space-y-2">
        {pedidos.map((pedido: PedidoHistorial) => (
          <motion.div
            key={pedido.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-card border border-border/50 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-muted/50 flex items-center justify-center shrink-0">
                  {pedido.negocio?.logoUrl ? (
                    <img
                      src={pedido.negocio.logoUrl}
                      alt={pedido.negocio.nombre}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{pedido.negocioNombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {pedido.entregadoFecha
                      ? new Date(pedido.entregadoFecha).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : timeAgo(new Date(pedido.fecha))}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{formatPrice(pedido.total)}</p>
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-0 text-[10px] font-semibold gap-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                  Entregado
                </Badge>
              </div>
            </div>

            {/* Client + address */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>👤 {pedido.clienteNombre}</span>
              {pedido.direccion && (
                <>
                  <span>·</span>
                  <span className="truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {pedido.direccion}
                  </span>
                </>
              )}
            </div>

            {/* Items summary */}
            <div className="mt-2 text-xs text-muted-foreground">
              {pedido.items.map((item, idx) => (
                <span key={idx}>
                  {idx > 0 && ", "}
                  {item.cantidad}x {item.nombre}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page >= pagination.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function HistorySkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <div className="h-5 w-36 rounded bg-muted/50 animate-pulse" />
        <div className="h-3 w-28 rounded bg-muted/30 animate-pulse mt-1" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-card border border-border/50 p-4 animate-pulse"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-muted/50" />
              <div className="space-y-1.5">
                <div className="h-4 w-24 rounded bg-muted/30" />
                <div className="h-3 w-20 rounded bg-muted/20" />
              </div>
            </div>
            <div className="space-y-1.5 text-right">
              <div className="h-4 w-16 rounded bg-muted/30" />
              <div className="h-4 w-14 rounded bg-muted/20" />
            </div>
          </div>
          <div className="h-3 w-full rounded bg-muted/20 mt-2" />
        </div>
      ))}
    </div>
  )
}
