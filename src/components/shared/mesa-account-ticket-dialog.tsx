"use client"

import { Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatPrice } from "@/lib/utils"
import { buildMesaAccountThermalTicket, type MesaAccountTicketInput } from "@/lib/thermal-print/mesa-account-ticket"

function formatDate(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
}
function paymentLabel(value: "efectivo" | "transferencia" | null | undefined): string {
  if (value === "efectivo") return "Efectivo"
  if (value === "transferencia") return "Transferencia"
  return "No registrado"
}

/** Preview histórico read-only basado en el mismo modelo que el ticket canónico. */
export function MesaAccountTicketDialog({
  input,
  label = "Ver ticket",
}: {
  input: MesaAccountTicketInput
  label?: string
}) {
  const ticket = buildMesaAccountThermalTicket(input)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs">
          <Receipt className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Ticket de cuenta</DialogTitle>
          <DialogDescription>Consulta histórica de solo lectura.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4 text-sm">
          <div className="space-y-0.5 text-center">
            <p className="font-semibold">{ticket.negocio.nombre}</p>
            <p className="text-muted-foreground">Mesa {ticket.mesa.numero}</p>
            {ticket.ocupacion.cerradaEn ? (
              <p className="text-xs text-muted-foreground">Cierre: {formatDate(ticket.ocupacion.cerradaEn)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Apertura: {formatDate(ticket.ocupacion.iniciadaEn)}</p>
            )}
          </div>

          <div className="space-y-3">
            {ticket.pedidos.map((pedido, index) => {
              const sourcePedido = input.cuenta.pedidos[index]
              return (
                <section key={pedido.numero} className="space-y-1.5 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Pedido {pedido.numero} · {formatDate(pedido.fecha)}</span>
                    {pedido.cancelado ? <span className="font-medium text-destructive">Cancelado</span> : pedido.pendiente ? <span>Pendiente</span> : null}
                  </div>
                  {pedido.items.map((item, itemIndex) => (
                    <div key={`${pedido.numero}-${itemIndex}`} className="flex items-start justify-between gap-3">
                      <div>
                        <p>{item.cantidad}× {item.nombre}</p>
                        {item.agregados.length > 0 && <p className="pl-3 text-xs text-muted-foreground">+ {item.agregados.join(", ")}</p>}
                        {item.secciones.length > 0 && <p className="pl-3 text-xs text-muted-foreground">{item.secciones.join(" · ")}</p>}
                        {item.ingredientesQuitados.length > 0 && <p className="pl-3 text-xs text-muted-foreground">Sin: {item.ingredientesQuitados.join(", ")}</p>}
                        {(item.talle || item.color) && <p className="pl-3 text-xs text-muted-foreground">{[item.talle, item.color].filter(Boolean).join(" · ")}</p>}
                      </div>
                      <span className="shrink-0 text-muted-foreground">{formatPrice(item.subtotal)}</span>
                    </div>
                  ))}
                  {sourcePedido?.notas && <p className="text-xs text-muted-foreground">Nota: {sourcePedido.notas}</p>}
                  <div className="flex justify-between text-xs font-medium">
                    <span>Subtotal pedido</span>
                    <span>{formatPrice(pedido.subtotal)}</span>
                  </div>
                </section>
              )
            })}
          </div>

          <div className="flex justify-between border-t pt-3 font-bold">
            <span>Total</span>
            <span>{formatPrice(ticket.totalGeneral)}</span>
          </div>
          <p className="text-center text-xs text-muted-foreground">Pago: {paymentLabel(ticket.metodoPago)}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
