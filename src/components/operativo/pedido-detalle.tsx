"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPrice } from "@/lib/utils"

// ============================================
// DeliGO Operaciones — Detalle de pedido (personal PyR + Salón)
// ============================================
// Componente presentacional compartido: replica el mismo formato visual y los
// mismos campos ya usados por la terminal (src/app/operaciones/pyr/page.tsx y
// src/app/operaciones/salon/page.tsx) para el detalle de un pedido — productos,
// cantidades, agregados, ingredientes quitados y secciones/opciones (incluidas
// las "compartidas": una sección puede resolver a una única opción string o a
// un mapa opción→cantidad). No decide autorización ni hace fetch: solo
// renderiza el estado que le pasa cada página (loading/error/ready) y expone
// un callback de reintento. Cada llamador arma sus propios textos de
// estado/entrega con sus propios mapas de labels ya existentes, para no
// duplicar ni divergir esos mapas dentro de este componente compartido.

export interface PedidoDetalleItemDTO {
  id: string
  nombre: string
  cantidad: number
  precio: number
  agregados: Array<{ id?: string; nombre: string; precio: number }>
  secciones: Record<string, string | Record<string, number>>
  ingredientesQuitados: string[]
  talle?: string | null
  color?: string | null
}

export interface PedidoDetalleDTO {
  id: string
  estado: string
  metodoEntrega: string
  fecha: string
  total: number
  clienteNombre?: string | null
  mesaNumero?: number | null
  empleadoNombre?: string | null
  items: PedidoDetalleItemDTO[]
}

export type PedidoDetalleState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: PedidoDetalleDTO }

interface PedidoDetalleDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: PedidoDetalleState | null
  onRetry: () => void
  /** Título del drawer (ej. "Retiro", "Domicilio", "Mesa 5"). */
  title: string
  /** Subtítulo/estado ya traducido por el llamador (ej. "Preparando"). */
  estadoLabel: string
  /** Nombre a mostrar sobre el listado de productos (cliente o mozo asignado). */
  nombreMostrado?: string | null
}

export function PedidoDetalleDrawer({
  open,
  onOpenChange,
  state,
  onRetry,
  title,
  estadoLabel,
  nombreMostrado,
}: PedidoDetalleDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left shrink-0">
          <DrawerTitle className="flex flex-col gap-0.5">
            <span className="text-base font-bold">{title}</span>
            <span className="text-xs font-normal text-muted-foreground">{estadoLabel}</span>
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 overscroll-contain">
          {!state || state.status === "loading" ? (
            <div className="space-y-2.5 py-1">
              <Skeleton className="h-5 w-2/3 rounded" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : state.status === "error" ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center bg-muted text-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">
                No se pudo cargar el detalle del pedido.
              </p>
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{nombreMostrado || "—"}</span>
                <span className="text-sm font-bold">{formatPrice(state.data.total)}</span>
              </div>
              <div className="space-y-2 pt-1">
                {state.data.items.map((item) => (
                  <PedidoDetalleItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="border-t pt-3">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// ============================================
// Fila de producto: mismo formato visual exacto que la terminal
// (agregados, secciones/opciones compartidas, ingredientes quitados, talle/color)
// ============================================
function PedidoDetalleItemRow({ item }: { item: PedidoDetalleItemDTO }) {
  const hasDetails =
    (item.agregados?.length ?? 0) > 0 ||
    Object.keys(item.secciones || {}).length > 0 ||
    (item.ingredientesQuitados?.length ?? 0) > 0 ||
    item.talle ||
    item.color

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {item.cantidad > 1 && <span className="font-semibold">{item.cantidad}x </span>}
          {item.nombre}
        </span>
        <span className="text-muted-foreground font-medium">
          {formatPrice(item.precio * item.cantidad)}
        </span>
      </div>
      {hasDetails && (
        <div className="ml-4 mt-1 space-y-1">
          {(item.talle || item.color) && (
            <div className="flex flex-wrap gap-1">
              {item.talle && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium">
                  Talle: {item.talle}
                </span>
              )}
              {item.color && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium">
                  Color: {item.color}
                </span>
              )}
            </div>
          )}
          {Object.keys(item.secciones || {}).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(item.secciones).map(([k, v]) => {
                let display: string
                if (typeof v === "string") {
                  display = `${k}: ${v}`
                } else {
                  const parts = Object.entries(v as Record<string, number>)
                    .filter(([, qty]) => qty > 0)
                    .map(([opt, qty]) => (qty > 1 ? `${opt} x${qty}` : opt))
                  display = `${k}: ${parts.join(", ")}`
                }
                return (
                  <span
                    key={k}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium"
                  >
                    {display}
                  </span>
                )
              })}
            </div>
          )}
          {item.agregados?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.agregados.map((a, i) => (
                <span
                  key={a.id ?? i}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 font-medium"
                >
                  + {a.nombre}
                </span>
              ))}
            </div>
          )}
          {item.ingredientesQuitados?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.ingredientesQuitados.map((ing, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 font-medium"
                >
                  Sin {ing}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
