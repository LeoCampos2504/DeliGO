"use client"

import type { CuentaMesaResult } from "@/lib/mesa-cuenta"
import { formatPrice } from "@/lib/utils"

/** Render canónico y pasivo del detalle de una cuenta de ocupación. */
export function MesaAccountDetail({ cuenta }: { cuenta: Pick<CuentaMesaResult, "pedidos" | "totalGeneral"> }) {
  return (
    <div className="space-y-3">
      {cuenta.pedidos.map((pedido, index) => (
        <div key={pedido.id} className="rounded-xl border border-border/60 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Pedido {index + 1}</span>
            <span>{pedido.excluido ? "Cancelado" : pedido.pendiente ? "Pendiente" : "Servido"}</span>
          </div>
          {pedido.items.map((item) => (
            <div key={item.id} className="py-1 text-sm">
              <div className="flex justify-between gap-2"><span>{item.cantidad}× {item.nombre}</span><span>{formatPrice(item.subtotalLineaAprox)}</span></div>
              {item.agregados.length > 0 && <p className="pl-3 text-xs text-muted-foreground">+ {item.agregados.map((a) => a.nombre).join(", ")}</p>}
              {item.secciones.length > 0 && <p className="pl-3 text-xs text-muted-foreground">{item.secciones.join(" · ")}</p>}
              {item.ingredientesQuitados.length > 0 && <p className="pl-3 text-xs text-muted-foreground">Sin: {item.ingredientesQuitados.join(", ")}</p>}
              {(item.talle || item.color) && <p className="pl-3 text-xs text-muted-foreground">{[item.talle, item.color].filter(Boolean).join(" · ")}</p>}
            </div>
          ))}
          {pedido.notas && <p className="mt-1 text-xs text-muted-foreground">Nota: {pedido.notas}</p>}
          <div className="mt-1 flex justify-between text-xs font-medium"><span>Subtotal pedido</span><span>{pedido.excluido ? formatPrice(0) : formatPrice(pedido.subtotalPedido)}</span></div>
        </div>
      ))}
      <div className="flex justify-between border-t pt-3 text-base font-bold"><span>Total</span><span>{formatPrice(cuenta.totalGeneral)}</span></div>
    </div>
  )
}
