"use client"

import React, { useState, useMemo } from "react"
import { useChatStore } from "@/store/chat-store"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Banknote,
  CreditCard,
  Bike,
  Store,
  MapPin,
  X,
  Check,
  ArrowLeft,
  Sparkles,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn, formatPrice } from "@/lib/utils"
import { useCartStore, type CartItem, type DeliveryAddress } from "@/store/cart-store"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface NegocioAPI {
  id: string
  slug: string
  nombre: string
  rubro: string
  colorPrincipal: string
  logoUrl: string | null
  ofreceDelivery: boolean
  precioDelivery: number
  tiempoEntrega: number
  aceptaTransferencia: boolean
  aliasBancario: string
}

interface ModernCartSheetProps {
  negocio: NegocioAPI
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ============================================
// Step enum for cart flow
// ============================================
type CartStep = "items" | "checkout"

// ============================================
// Main Cart Sheet Component
// ============================================
export function ModernCartSheet({ negocio, open, onOpenChange }: ModernCartSheetProps) {
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const clearCart = useCartStore((s) => s.clearCart)
  const totalProductos = useCartStore((s) => s.totalProductos())
  const tarifaServicio = useCartStore((s) => s.tarifaServicio())

  const [step, setStep] = useState<CartStep>("items")
  const [metodoEntrega, setMetodoEntrega] = useState<"retiro" | "domicilio">(
    negocio.ofreceDelivery ? "domicilio" : "retiro"
  )
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo")
  const [notas, setNotas] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastPedidoId, setLastPedidoId] = useState<string | null>(null)

  const deliveryAddress = useCartStore((s) => s.deliveryAddress)
  const deliveryFee = metodoEntrega === "domicilio" ? negocio.precioDelivery : 0
  const finalTotal = totalProductos + tarifaServicio + deliveryFee
  const totalItems = items.reduce((sum, i) => sum + i.cantidad, 0)

  // Reset step when opening
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setStep("items")
      setShowSuccess(false)
    }
    onOpenChange(newOpen)
  }

  const handleCheckout = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocioId: negocio.id,
          items: items.map((item) => ({
            productoId: item.productoId,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad,
            agregados: item.agregados,
            secciones: item.secciones,
            ingredientesQuitados: item.ingredientesQuitados,
            talle: item.talle,
            color: item.color,
          })),
          metodoEntrega,
          metodoPago,
          notas,
          totalProductos,
          tarifaServicio,
          precioDelivery: deliveryFee,
          total: finalTotal,
          // Delivery address
          direccion: metodoEntrega === "domicilio" && deliveryAddress ? deliveryAddress.direccion : null,
          referencia: metodoEntrega === "domicilio" && deliveryAddress ? deliveryAddress.referencia : null,
          lat: metodoEntrega === "domicilio" && deliveryAddress ? deliveryAddress.lat : null,
          lng: metodoEntrega === "domicilio" && deliveryAddress ? deliveryAddress.lng : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al crear pedido")
      }
      const pedidoData = await res.json()
      setLastPedidoId(pedidoData.id)
      setShowSuccess(true)
      setTimeout(() => {
        clearCart()
        handleOpenChange(false)
        toast.success("¡Pedido realizado con éxito! 🎉", {
          description: `Tu pedido a ${negocio.nombre} fue recibido`,
          duration: 4000,
        })
        // Open chat after order
        if (pedidoData.id) {
          const chatStore = useChatStore.getState()
          chatStore.setSheetOpen(true)
          // Small delay to let sheet open
          setTimeout(() => {
            chatStore.openConversation(pedidoData.id)
          }, 300)
          // Create initial system message
          fetch(`/api/chat/mensajes/${pedidoData.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              texto: `¡Pedido recibido! 🎉 Tu pedido a ${negocio.nombre} está siendo procesado.`,
            }),
          }).catch(() => {}) // silently fail
        }
      }, 2200)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al procesar el pedido"
      toast.error("Error al procesar el pedido", { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success animation
  if (showSuccess) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="h-[100dvh] rounded-none border-0 md:max-w-2xl md:mx-auto md:rounded-2xl">
          <DrawerTitle className="sr-only">Pedido confirmado</DrawerTitle>
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30"
            >
              <Check className="h-12 w-12 text-white" strokeWidth={3} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl font-extrabold mb-2"
            >
              ¡Pedido confirmado!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-muted-foreground text-sm"
            >
              {negocio.nombre} ya lo recibió
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex gap-1 mt-4"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 1] }}
                  transition={{ delay: 0.9 + i * 0.15, duration: 0.4 }}
                  className="text-2xl"
                >
                  {["🎉", "🎊", "✨"][i]}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[95dvh] rounded-t-2xl md:max-w-2xl md:mx-auto md:rounded-2xl">
        <DrawerTitle className="sr-only">Carrito de compras</DrawerTitle>
        <div className="flex flex-col h-full bg-background">
          {/* ===== HEADER ===== */}
          <div className="shrink-0 border-b border-border px-4 pt-1 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {step === "checkout" ? (
                  <button
                    onClick={() => setStep("items")}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenChange(false)}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <h2 className="font-extrabold text-lg leading-tight">
                    {step === "items" ? "Tu pedido" : "Confirmar pedido"}
                  </h2>
                  <p className="text-xs text-muted-foreground">{negocio.nombre}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs font-bold">
                {totalItems} item{totalItems !== 1 ? "s" : ""}
              </Badge>
            </div>

            {/* Step indicator */}
            <div className="flex mt-3 gap-1">
              <div
                className="h-1 rounded-full flex-1 transition-all duration-300"
                style={{ backgroundColor: negocio.colorPrincipal }}
              />
              <div
                className={cn(
                  "h-1 rounded-full flex-1 transition-all duration-300",
                  step === "checkout" ? "bg-foreground" : "bg-muted"
                )}
                style={
                  step === "checkout"
                    ? { backgroundColor: negocio.colorPrincipal }
                    : undefined
                }
              />
            </div>
          </div>

          {/* ===== CONTENT - scrollable ===== */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <AnimatePresence mode="wait">
              {step === "items" ? (
                <CartItemsStep
                  key="items"
                  items={items}
                  negocio={negocio}
                  onRemove={removeItem}
                  onUpdateQuantity={updateQuantity}
                />
              ) : (
                <CartCheckoutStep
                  key="checkout"
                  negocio={negocio}
                  metodoEntrega={metodoEntrega}
                  setMetodoEntrega={setMetodoEntrega}
                  metodoPago={metodoPago}
                  setMetodoPago={setMetodoPago}
                  notas={notas}
                  setNotas={setNotas}
                  deliveryFee={deliveryFee}
                  deliveryAddress={deliveryAddress}
                />
              )}
            </AnimatePresence>
          </div>

          {/* ===== FOOTER ===== */}
          <div className="shrink-0 border-t border-border bg-card">
            {step === "items" ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold">{formatPrice(totalProductos)}</span>
                </div>
                <Button
                  onClick={() => setStep("checkout")}
                  className="w-full h-13 py-3.5 rounded-2xl font-bold text-white text-base shadow-lg"
                  style={{
                    backgroundColor: negocio.colorPrincipal,
                    boxShadow: `0 4px 20px ${negocio.colorPrincipal}35`,
                  }}
                  disabled={items.length === 0}
                >
                  Continuar · {formatPrice(totalProductos)}
                </Button>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(totalProductos)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Servicio</span>
                    <span>{formatPrice(tarifaServicio)}</span>
                  </div>
                  {metodoEntrega === "domicilio" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span>{deliveryFee > 0 ? formatPrice(deliveryFee) : "Gratis"}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Total</span>
                    <span>{formatPrice(finalTotal)}</span>
                  </div>
                </div>
                <Button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full h-13 py-3.5 rounded-2xl font-bold text-white text-base shadow-lg"
                  style={{
                    backgroundColor: negocio.colorPrincipal,
                    boxShadow: `0 4px 20px ${negocio.colorPrincipal}35`,
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="h-5 w-5" />
                      </motion.div>
                      Procesando...
                    </span>
                  ) : (
                    `Confirmar pedido · ${formatPrice(finalTotal)}`
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ============================================
// Cart Items Step
// ============================================
function CartItemsStep({
  items,
  negocio,
  onRemove,
  onUpdateQuantity,
}: {
  items: CartItem[]
  negocio: NegocioAPI
  onRemove: (key: string) => void
  onUpdateQuantity: (key: string, cantidad: number) => void
}) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4"
        >
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </motion.div>
        <h3 className="font-bold text-lg">Tu carrito está vacío</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Agregá productos desde el menú para empezar
        </p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="px-4 py-3 space-y-2"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, idx) => (
          <CartItemCard
            key={item.key}
            item={item}
            negocio={negocio}
            onRemove={() => onRemove(item.key)}
            onUpdateQuantity={(qty) => onUpdateQuantity(item.key, qty)}
            index={idx}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================
// Cart Item Card
// ============================================
function CartItemCard({
  item,
  negocio,
  onRemove,
  onUpdateQuantity,
  index,
}: {
  item: CartItem
  negocio: NegocioAPI
  onRemove: () => void
  onUpdateQuantity: (qty: number) => void
  index: number
}) {
  const [isRemoving, setIsRemoving] = useState(false)

  const itemTotalPrice = useMemo(
    () => (item.precio + item.agregados.reduce((s, a) => s + a.precio, 0)) * item.cantidad,
    [item.precio, item.agregados, item.cantidad]
  )

  const handleRemove = () => {
    setIsRemoving(true)
    setTimeout(() => onRemove(), 200)
  }

  // Collect all detail chips
  const details: string[] = []
  if (item.talle) details.push(`Talle: ${item.talle}`)
  if (item.color) details.push(`Color: ${item.color}`)
  item.agregados.forEach((a) => details.push(`+ ${a.nombre}`))
  Object.entries(item.secciones).forEach(([k, v]) => {
    if (!v) return
    if (typeof v === "string") {
      details.push(`${k}: ${v}`)
    } else {
      // Multi-select: { optionName: quantity }
      const parts = Object.entries(v as Record<string, number>)
        .filter(([, qty]) => qty > 0)
        .map(([opt, qty]) => qty > 1 ? `${opt} x${qty}` : opt)
      if (parts.length > 0) details.push(`${k}: ${parts.join(", ")}`)
    }
  })
  item.ingredientesQuitados.forEach((ing) => details.push(`Sin ${ing}`))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isRemoving ? 0 : 1,
        x: isRemoving ? -100 : 0,
        scale: isRemoving ? 0.9 : 1,
      }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="rounded-2xl bg-card border border-border/60 p-3.5 shadow-sm"
    >
      <div className="flex gap-3">
        {/* Product icon */}
        <div
          className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${negocio.colorPrincipal}18, ${negocio.colorPrincipal}08)`,
          }}
        >
          <span className="text-xl opacity-30">
            {negocio.rubro === "restaurante" ? "🍽️" : "🛍️"}
          </span>
        </div>

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-bold text-sm leading-tight">{item.nombre}</h4>
            <button
              onClick={handleRemove}
              className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Detail chips */}
          {details.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {details.map((d, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-muted/80 px-1.5 py-0.5 rounded-md text-muted-foreground"
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {item.notas && (
            <div className="flex items-center gap-1 mt-1">
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground italic truncate">
                {item.notas}
              </span>
            </div>
          )}

          {/* Quantity controls & price */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (item.cantidad <= 1) {
                    handleRemove()
                  } else {
                    onUpdateQuantity(item.cantidad - 1)
                  }
                }}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
              >
                {item.cantidad <= 1 ? (
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
              </button>
              <motion.span
                key={item.cantidad}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="font-bold text-sm w-7 text-center"
              >
                {item.cantidad}
              </motion.span>
              <button
                onClick={() => onUpdateQuantity(item.cantidad + 1)}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <span
              className="font-extrabold text-sm"
              style={{ color: negocio.colorPrincipal }}
            >
              {formatPrice(itemTotalPrice)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// Cart Checkout Step
// ============================================
function CartCheckoutStep({
  negocio,
  metodoEntrega,
  setMetodoEntrega,
  metodoPago,
  setMetodoPago,
  notas,
  setNotas,
  deliveryFee,
  deliveryAddress,
}: {
  negocio: NegocioAPI
  metodoEntrega: "retiro" | "domicilio"
  setMetodoEntrega: (v: "retiro" | "domicilio") => void
  metodoPago: "efectivo" | "transferencia"
  setMetodoPago: (v: "efectivo" | "transferencia") => void
  notas: string
  setNotas: (v: string) => void
  deliveryFee: number
  deliveryAddress: DeliveryAddress | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="px-4 py-4 space-y-5"
    >
      {/* ===== DELIVERY METHOD ===== */}
      <section>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          Método de entrega
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setMetodoEntrega("retiro")}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200",
              metodoEntrega === "retiro"
                ? "border-foreground shadow-md"
                : "border-border bg-card hover:border-foreground/20"
            )}
            style={
              metodoEntrega === "retiro"
                ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}08`, boxShadow: `0 4px 14px ${negocio.colorPrincipal}15` }
                : undefined
            }
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                metodoEntrega === "retiro" ? "bg-foreground/10" : "bg-muted"
              )}
              style={
                metodoEntrega === "retiro"
                  ? { backgroundColor: `${negocio.colorPrincipal}15` }
                  : undefined
              }
            >
              <Store
                className="h-5 w-5"
                style={
                  metodoEntrega === "retiro"
                    ? { color: negocio.colorPrincipal }
                    : undefined
                }
              />
            </div>
            <span
              className={cn(
                "font-bold text-sm",
                metodoEntrega === "retiro" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Retiro en local
            </span>
            <span className="text-[10px] text-muted-foreground">Gratis</span>
            {metodoEntrega === "retiro" && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: negocio.colorPrincipal }}
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </button>

          {negocio.ofreceDelivery && (
            <button
              onClick={() => setMetodoEntrega("domicilio")}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200",
                metodoEntrega === "domicilio"
                  ? "border-foreground shadow-md"
                  : "border-border bg-card hover:border-foreground/20"
              )}
              style={
                metodoEntrega === "domicilio"
                  ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}08`, boxShadow: `0 4px 14px ${negocio.colorPrincipal}15` }
                  : undefined
              }
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  metodoEntrega === "domicilio" ? "bg-foreground/10" : "bg-muted"
                )}
                style={
                  metodoEntrega === "domicilio"
                    ? { backgroundColor: `${negocio.colorPrincipal}15` }
                    : undefined
                }
              >
                <Bike
                  className="h-5 w-5"
                  style={
                    metodoEntrega === "domicilio"
                      ? { color: negocio.colorPrincipal }
                      : undefined
                  }
                />
              </div>
              <span
                className={cn(
                  "font-bold text-sm",
                  metodoEntrega === "domicilio" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Delivery
              </span>
              <span className="text-[10px] text-muted-foreground">
                {deliveryFee > 0 ? formatPrice(deliveryFee) : "Gratis"} · ~{negocio.tiempoEntrega} min
              </span>
              {metodoEntrega === "domicilio" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: negocio.colorPrincipal }}
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </motion.div>
              )}
            </button>
          )}
        </div>

        {/* Delivery address display — READ ONLY, cannot change from cart */}
        {metodoEntrega === "domicilio" && (
          <div
            className={cn(
              "w-full mt-3 flex items-center gap-3 p-3.5 rounded-2xl text-left",
              deliveryAddress
                ? "border-2 border-primary/20 bg-primary/5"
                : "border-2 border-dashed border-border bg-muted/30"
            )}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {deliveryAddress ? (
                <>
                  <p className="text-sm font-semibold truncate">
                    {deliveryAddress.direccion || "Ubicación seleccionada"}
                  </p>
                  {deliveryAddress.referencia && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {deliveryAddress.referencia}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">Sin dirección de entrega</p>
                  <p className="text-[10px] text-muted-foreground">
                    Volvé al inicio para setear tu ubicación
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ===== PAYMENT METHOD ===== */}
      <section>
        <h3 className="font-bold text-sm mb-3">Método de pago</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setMetodoPago("efectivo")}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200",
              metodoPago === "efectivo"
                ? "border-emerald-500 shadow-md bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-border bg-card hover:border-emerald-200 dark:hover:border-emerald-900"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                metodoPago === "efectivo" ? "bg-emerald-500/10" : "bg-muted"
              )}
            >
              <Banknote
                className={cn(
                  "h-5 w-5",
                  metodoPago === "efectivo" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                )}
              />
            </div>
            <span className={cn(
              "font-bold text-sm",
              metodoPago === "efectivo"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground"
            )}>
              Efectivo
            </span>
            {metodoPago === "efectivo" && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </button>

          {negocio.aceptaTransferencia && (
            <button
              onClick={() => setMetodoPago("transferencia")}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200",
                metodoPago === "transferencia"
                  ? "border-sky-500 shadow-md bg-sky-50/50 dark:bg-sky-950/20"
                  : "border-border bg-card hover:border-sky-200 dark:hover:border-sky-900"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  metodoPago === "transferencia" ? "bg-sky-500/10" : "bg-muted"
                )}
              >
                <CreditCard
                  className={cn(
                    "h-5 w-5",
                    metodoPago === "transferencia" ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground"
                  )}
                />
              </div>
              <span className={cn(
                "font-bold text-sm",
                metodoPago === "transferencia"
                  ? "text-sky-700 dark:text-sky-300"
                  : "text-muted-foreground"
              )}>
                Transferencia
              </span>
              {metodoPago === "transferencia" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center"
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </motion.div>
              )}
            </button>
          )}
        </div>

        {/* Transfer alias */}
        {metodoPago === "transferencia" && negocio.aliasBancario && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                  Alias bancario
                </p>
                <p className="text-sm font-bold text-sky-800 dark:text-sky-200 mt-0.5">
                  {negocio.aliasBancario}
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(negocio.aliasBancario)
                  toast.success("Alias copiado al portapapeles")
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-xs font-semibold hover:bg-sky-200 dark:hover:bg-sky-900 transition-colors"
              >
                Copiar
              </button>
            </div>
            <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 mt-2">
              Enviá el comprobante por mensaje directo al confirmar tu pedido
            </p>
          </motion.div>
        )}
      </section>

      {/* ===== ORDER NOTES ===== */}
      <section>
        <h3 className="font-bold text-sm mb-3">Notas del pedido</h3>
        <div className="relative">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Instrucciones especiales, alergias, sin cebolla..."
            className="w-full min-h-[80px] p-4 rounded-2xl border-2 border-border bg-card text-sm resize-none focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/60"
            rows={3}
          />
          <span className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/50">
            {notas.length}/200
          </span>
        </div>
      </section>
    </motion.div>
  )
}
