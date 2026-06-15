"use client"

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react"
import { motion } from "framer-motion"

import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Banknote,
  CreditCard,
  Bike,
  Store,
  ChevronUp,
  MapPin,
  X,
  Check,
  Sparkles,
  Pencil,
  ArrowLeft,
  Receipt,
  Clock,
  Armchair,
  UserCheck,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  deliveryMode?: string
  tiempoEntrega: number
  aceptaTransferencia: boolean
  aliasBancario: string
  lat?: number | null
  lng?: number | null
  direccion?: string | null
}

interface CartPanelProps {
  negocio: NegocioAPI
  isOpen?: boolean
  mesaNumero?: number | null  // If set, cart is in salon mode
  mozoCodigo?: string
  mozoNombre?: string
  canOrder?: boolean
  onRequireAuth?: () => boolean
  onRequireLocation?: () => boolean
}

type CartStep = "items" | "checkout"

// ============================================
// Custom hook: drag-to-dismiss from handle only
// Uses document-level move/end listeners so the
// scrollable content area is never blocked.
// ============================================
function useDragToDismiss(onDismiss: () => void) {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startYRef = useRef(0)
  const handleRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragYRef = useRef(0)

  // Attach document-level move/end when dragging starts
  useEffect(() => {
    if (!isDragging) return

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      const touch = e.touches[0]
      const delta = touch.clientY - startYRef.current
      // Only allow dragging DOWN (positive delta)
      const clampedDelta = Math.max(0, delta)
      dragYRef.current = clampedDelta
      setDragY(clampedDelta)
    }

    const onTouchEnd = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
      const threshold = Math.min(120, window.innerHeight * 0.25)
      if (dragYRef.current > threshold) {
        onDismiss()
      }
      dragYRef.current = 0
      setDragY(0)
    }

    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)

    return () => {
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [isDragging, onDismiss])

  // Handler for the drag handle only
  const onHandleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation() // prevent it from reaching scrollable content
    const touch = e.touches[0]
    startYRef.current = touch.clientY
    isDraggingRef.current = true
    setIsDragging(true)
  }, [])

  return { dragY, isDragging, handleRef, onHandleTouchStart }
}

// ============================================
// Main Cart Panel Component
// ============================================
export function CartPanel({ negocio, isOpen = true, mesaNumero, mozoCodigo, mozoNombre, canOrder = true, onRequireAuth, onRequireLocation }: CartPanelProps) {
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const clearCart = useCartStore((s) => s.clearCart)
  const totalProductos = useCartStore((s) => s.totalProductos())
  const tarifaServicio = useCartStore((s) => s.tarifaServicio())
  const activeNegocioId = useCartStore((s) => s.activeNegocioId)

  const isMesaOrder = !!mesaNumero
  // Service fee disabled for mesa orders
  const displayTarifaServicio = isMesaOrder ? 0 : tarifaServicio

  const [sheetOpen, setSheetOpen] = useState(false)
  const [step, setStep] = useState<CartStep>("items")
  const [metodoEntrega, setMetodoEntrega] = useState<"retiro" | "domicilio" | "mesa">(
    isMesaOrder ? "mesa" : (negocio.ofreceDelivery ? "domicilio" : "retiro")
  )

  // Track whether delivery is unavailable due to zone
  const [deliveryUnavailable, setDeliveryUnavailable] = useState(false)
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo")
  const [empleadoCodigo, setEmpleadoCodigo] = useState(mozoCodigo ?? "")
  const [notas, setNotas] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Sync empleadoCodigo when mozoCodigo prop arrives asynchronously
  useEffect(() => {
    if (mozoCodigo) {
      setEmpleadoCodigo(mozoCodigo)
    }
  }, [mozoCodigo])

  const deliveryAddress = useCartStore((s) => s.deliveryAddress)
  const storePrecioDelivery = useCartStore((s) => s.precioDelivery)
  const setActiveNegocio = useCartStore((s) => s.setActiveNegocio)

  // Delivery zone check state
  const [deliveryZoneInfo, setDeliveryZoneInfo] = useState<{
    checked: boolean
    delivery: boolean
    precioDelivery: number
    zonaNombre: string | null
    reason: string | null
    mode: string | null
  } | null>(null)
  const [checkingZone, setCheckingZone] = useState(false)

  // Check delivery zone when address changes (check regardless of metodoEntrega so we know if delivery is available)
  useEffect(() => {
    if (!deliveryAddress?.lat || !deliveryAddress?.lng || !negocio.ofreceDelivery) {
      setDeliveryZoneInfo(null)
      setDeliveryUnavailable(false)
      return
    }
    let cancelled = false
    setCheckingZone(true)
    fetch(`/api/negocio/delivery-zonas?slug=${negocio.slug}&lat=${deliveryAddress.lat}&lng=${deliveryAddress.lng}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const zoneInfo = {
          checked: true,
          delivery: data.delivery ?? false,
          precioDelivery: data.precioDelivery ?? negocio.precioDelivery,
          zonaNombre: data.zonaNombre ?? null,
          reason: data.reason ?? null,
          mode: data.mode ?? null,
        }
        setDeliveryZoneInfo(zoneInfo)
        const outsideZone = zoneInfo.checked && !zoneInfo.delivery && zoneInfo.reason === "outside_zones"
        setDeliveryUnavailable(outsideZone)
        // If outside zone and currently on domicilio, switch to retiro
        if (outsideZone && metodoEntrega === "domicilio") {
          setMetodoEntrega("retiro")
        }
        // Update cart store with the zone-specific price
        if (data.delivery) {
          setActiveNegocio(negocio.id, negocio.slug, negocio.nombre, data.precioDelivery ?? negocio.precioDelivery)
        }
        setCheckingZone(false)
      })
      .catch(() => {
        if (cancelled) return
        setDeliveryZoneInfo(null)
        setDeliveryUnavailable(false)
        setCheckingZone(false)
      })
    return () => { cancelled = true }
  }, [deliveryAddress?.lat, deliveryAddress?.lng, negocio.slug, negocio.id, negocio.nombre, negocio.precioDelivery, setActiveNegocio, negocio.ofreceDelivery, metodoEntrega])

  const deliveryFee = metodoEntrega === "domicilio" ? storePrecioDelivery : 0
  const isOutsideDeliveryZone = deliveryZoneInfo?.checked && !deliveryZoneInfo.delivery && deliveryZoneInfo.reason === "outside_zones"
  const finalTotal = totalProductos + displayTarifaServicio + deliveryFee
  const totalItems = items.reduce((sum, i) => sum + i.cantidad, 0)

  // Only show when there are items for this negocio
  const hasItems = items.length > 0 && activeNegocioId === negocio.id

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [sheetOpen])

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStep("items")
      setShowSuccess(false)
      setIsVisible(true)
      // Small delay so the visibility triggers before animation
      requestAnimationFrame(() => {
        setSheetOpen(true)
      })
    } else {
      setSheetOpen(false)
      // Wait for animation to finish before hiding
      setTimeout(() => setIsVisible(false), 300)
    }
  }

  const { dragY, isDragging, handleRef, onHandleTouchStart } =
    useDragToDismiss(() => handleOpenChange(false))

  const handleCheckout = async () => {
    // Auth gate: require login before submitting order
    if (!canOrder && onRequireAuth) {
      if (!onRequireAuth()) return
    }
    // Location gate: require address before submitting order
    if (!canOrder && onRequireLocation) {
      if (!onRequireLocation()) return
    }
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
          tarifaServicio: displayTarifaServicio,
          precioDelivery: deliveryFee,
          deliveryMode: negocio.deliveryMode,
          total: finalTotal,
          direccion: metodoEntrega === "domicilio" && deliveryAddress ? deliveryAddress.direccion : null,
          referencia: metodoEntrega === "domicilio" && deliveryAddress ? deliveryAddress.referencia : null,
          lat: metodoEntrega === "domicilio" && deliveryAddress ? deliveryAddress.lat : null,
          lng: metodoEntrega === "domicilio" && deliveryAddress ? deliveryAddress.lng : null,
          mesaNumero: isMesaOrder ? mesaNumero : undefined,
          empleadoCodigo: isMesaOrder && empleadoCodigo.trim() ? empleadoCodigo.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al crear pedido")
      }
      setShowSuccess(true)
      setTimeout(() => {
        clearCart()
        handleOpenChange(false)
        toast.success("¡Pedido realizado con éxito! 🎉", {
          description: `Tu pedido a ${negocio.nombre} fue recibido`,
          duration: 4000,
        })
      }, 2200)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al procesar el pedido"
      toast.error("Error al procesar el pedido", { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!hasItems) return null

  return (
    <>
      {/* ===== COLLAPSED BAR - visible when drawer is closed ===== */}
      {!sheetOpen && (
        <div className="ios-keyboard-hide keyboard-hide-when-editing fixed bottom-0 left-0 right-0 z-40">
          <div className="max-w-lg md:max-w-2xl mx-auto px-3 pb-3">
            <button
              onClick={() => handleOpenChange(true)}
              className="w-full group relative overflow-hidden"
            >
              {/* Main bar */}
              <div
                className="relative flex items-center justify-between pl-4 pr-3 py-3.5 rounded-2xl text-white font-bold shadow-2xl hover:brightness-105 transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: negocio.colorPrincipal,
                  boxShadow: `0 8px 30px ${negocio.colorPrincipal}40`,
                }}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </div>

                <div className="relative flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <ShoppingBag className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-extrabold block leading-tight">
                      {totalItems} {totalItems === 1 ? "producto" : "productos"}
                    </span>
                    <span className="text-[11px] text-white/70 font-medium flex items-center gap-1">
                      Ver carrito
                      <ChevronUp className="h-3 w-3" />
                    </span>
                  </div>
                </div>
                <div className="relative flex items-center gap-2">
                  <span className="text-lg font-extrabold">
                    {formatPrice(totalProductos)}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ===== CUSTOM SHEET DRAWER ===== */}
      {isVisible && (
        <>
          {/* Backdrop - blocks all touches from reaching background */}
          <div
            className={cn(
              "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300",
              sheetOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={() => handleOpenChange(false)}
            onTouchStart={(e) => {
              // Prevent scroll from propagating to background
              e.preventDefault()
              handleOpenChange(false)
            }}
          />

          {/* Sheet panel */}
          <div
            className={cn(
              "ios-keyboard-bottom fixed inset-x-0 bottom-0 z-50 max-w-lg md:max-w-2xl mx-auto transition-transform duration-300 ease-out touch-none",
              sheetOpen && !isDragging ? "translate-y-0" : !sheetOpen ? "translate-y-full" : undefined
            )}
            style={isDragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
          >
            <div className="bg-background rounded-t-2xl border-t border-border shadow-2xl flex flex-col h-[96dvh] ios-viewport-height overflow-hidden">
              {/* Drag handle - only this area triggers drag-to-dismiss */}
              <div
                ref={handleRef}
                className="shrink-0 flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
                onTouchStart={onHandleTouchStart}
              >
                <div className="w-12 h-1.5 rounded-full bg-muted" />
              </div>

              {showSuccess ? (
                <SuccessAnimation negocioNombre={negocio.nombre} />
              ) : (
                <>
                  {/* ===== HEADER ===== */}
                  <div className="shrink-0 border-b border-border px-5 pt-1 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {step === "checkout" ? (
                          <button
                            onClick={() => setStep("items")}
                            disabled={isSubmitting}
                            className="p-1.5 rounded-full hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
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
                            {step === "items" ? "Tu pedido" : isMesaOrder ? "Pedir a la mesa" : "Confirmar pedido"}
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            {negocio.nombre}
                            {isMesaOrder && mesaNumero ? ` · Mesa ${mesaNumero}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs font-bold rounded-lg">
                        {totalItems} item{totalItems !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Step indicator */}
                    <div className="flex mt-3 gap-1.5">
                      <div
                        className="h-1 rounded-full flex-1 transition-all duration-500"
                        style={{ backgroundColor: negocio.colorPrincipal }}
                      />
                      <div
                        className={cn(
                          "h-1 rounded-full flex-1 transition-all duration-500",
                          step === "checkout" ? "" : "bg-muted"
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
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
                    {step === "items" ? (
                      <CartItemsStep
                        items={items}
                        negocio={negocio}
                        onRemove={removeItem}
                        onUpdateQuantity={updateQuantity}
                        disabled={isSubmitting}
                      />
                    ) : (
                      <CartCheckoutStep
                        negocio={negocio}
                        metodoEntrega={metodoEntrega}
                        setMetodoEntrega={setMetodoEntrega}
                        metodoPago={metodoPago}
                        setMetodoPago={setMetodoPago}
                        notas={notas}
                        setNotas={setNotas}
                        deliveryFee={deliveryFee}
                        deliveryAddress={deliveryAddress}
                        isMesaOrder={isMesaOrder}
                        mesaNumero={mesaNumero}
                        empleadoCodigo={empleadoCodigo}
                        mozoCodigo={mozoCodigo}
                        mozoNombre={mozoNombre}
                        deliveryZoneInfo={deliveryZoneInfo}
                        isOutsideDeliveryZone={isOutsideDeliveryZone ?? false}
                        checkingZone={checkingZone ?? false}
                        deliveryUnavailable={deliveryUnavailable}
                        disabled={isSubmitting}
                      />
                    )}
                  </div>

                  {/* ===== FOOTER (fixed at bottom) ===== */}
                  <div className="shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-md">
                    {step === "items" ? (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Receipt className="h-3.5 w-3.5" />
                            Subtotal
                          </span>
                          <span className="font-bold">{formatPrice(totalProductos)}</span>
                        </div>
                        {!isOpen ? (
                          <div className="w-full h-13 py-3.5 rounded-2xl font-bold text-base text-center bg-muted text-muted-foreground flex items-center justify-center gap-2">
                            <Clock className="h-4 w-4" />
                            Local cerrado
                          </div>
                        ) : (
                          <Button
                            onClick={() => {
                              if (!canOrder && onRequireAuth) {
                                if (!onRequireAuth()) return
                              }
                              if (!canOrder && onRequireLocation) {
                                if (!onRequireLocation()) return
                              }
                              setStep("checkout")
                            }}
                            className="w-full h-13 py-3.5 rounded-2xl font-bold text-white text-base shadow-lg transition-all hover:brightness-105 active:scale-[0.98]"
                            style={{
                              backgroundColor: negocio.colorPrincipal,
                              boxShadow: `0 6px 24px ${negocio.colorPrincipal}35`,
                            }}
                            disabled={items.length === 0}
                          >
                            {isMesaOrder && mesaNumero
                              ? `Pedir a la mesa ${mesaNumero} · ${formatPrice(totalProductos)}`
                              : `Continuar · ${formatPrice(totalProductos)}`
                            }
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{formatPrice(totalProductos)}</span>
                          </div>
                          {!isMesaOrder && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Servicio</span>
                              <span>{formatPrice(tarifaServicio)}</span>
                            </div>
                          )}
                          {metodoEntrega === "domicilio" && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Delivery
                              </span>
                              <span>{deliveryFee > 0 ? formatPrice(deliveryFee) : "Gratis"}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between font-extrabold text-base pt-1">
                            <span>Total</span>
                            <span style={{ color: negocio.colorPrincipal }}>
                              {formatPrice(finalTotal)}
                            </span>
                          </div>
                        </div>
                        {!isOpen ? (
                          <div className="w-full h-13 py-3.5 rounded-2xl font-bold text-base text-center bg-muted text-muted-foreground flex items-center justify-center gap-2">
                            <Clock className="h-4 w-4" />
                            Local cerrado
                          </div>
                        ) : isOutsideDeliveryZone && metodoEntrega === "domicilio" ? (
                          <div className="w-full h-13 py-3.5 rounded-2xl font-bold text-base text-center bg-destructive/10 text-destructive flex items-center justify-center gap-2">
                            <X className="h-4 w-4" />
                            Fuera de zona de delivery
                          </div>
                        ) : (
                          <Button
                            onClick={handleCheckout}
                            disabled={isSubmitting}
                            className="w-full h-13 py-3.5 rounded-2xl font-bold text-white text-base shadow-lg transition-all hover:brightness-105 active:scale-[0.98]"
                            style={{
                              backgroundColor: negocio.colorPrincipal,
                              boxShadow: `0 6px 24px ${negocio.colorPrincipal}35`,
                            }}
                          >
                            {isSubmitting ? (
                              <span className="flex items-center gap-2">
                                <span className="animate-spin">
                                  <Sparkles className="h-5 w-5" />
                                </span>
                                Procesando...
                              </span>
                            ) : (
                              isMesaOrder
                                ? `Confirmar pedido · Mesa ${mesaNumero}`
                                : `Confirmar pedido · ${formatPrice(finalTotal)}`
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}


    </>
  )
}

// ============================================
// Success Animation
// ============================================
function SuccessAnimation({ negocioNombre }: { negocioNombre: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6">
      <div
        className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30 animate-in zoom-in duration-300"
      >
        <Check className="h-12 w-12 text-white" strokeWidth={3} />
      </div>
      <h2
        className="text-2xl font-extrabold mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        ¡Pedido confirmado!
      </h2>
      <p
        className="text-muted-foreground text-sm animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150"
      >
        {negocioNombre} ya lo recibió
      </p>
      <div
        className="flex gap-1 mt-4 animate-in fade-in duration-300 delay-300"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="text-2xl"
          >
            {["🎉", "🎊", "✨"][i]}
          </span>
        ))}
      </div>
    </div>
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
  disabled,
}: {
  items: CartItem[]
  negocio: NegocioAPI
  onRemove: (key: string) => void
  onUpdateQuantity: (key: string, cantidad: number) => void
  disabled?: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div
          className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4 animate-in zoom-in duration-300"
        >
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-bold text-lg">Tu carrito está vacío</h3>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Agregá productos desde el menú para empezar
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 space-y-2.5">
      {items.map((item, idx) => (
        <CartItemCard
          key={item.key}
          item={item}
          negocio={negocio}
          onRemove={() => onRemove(item.key)}
          onUpdateQuantity={(qty) => onUpdateQuantity(item.key, qty)}
          index={idx}
          disabled={disabled}
        />
      ))}
    </div>
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
  disabled,
}: {
  item: CartItem
  negocio: NegocioAPI
  onRemove: () => void
  onUpdateQuantity: (qty: number) => void
  index: number
  disabled?: boolean
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
    <div
      className={cn(
        "rounded-2xl bg-card border border-border/60 p-3.5 shadow-sm transition-all duration-200",
        isRemoving && "opacity-0 -translate-x-24 scale-90"
      )}
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
              disabled={disabled}
              className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none"
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
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => {
                  if (item.cantidad <= 1) {
                    handleRemove()
                  } else {
                    onUpdateQuantity(item.cantidad - 1)
                  }
                }}
                disabled={disabled}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                {item.cantidad <= 1 ? (
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
              </button>
              <span
                className="font-bold text-sm w-8 text-center tabular-nums"
              >
                {item.cantidad}
              </span>
              <button
                onClick={() => onUpdateQuantity(item.cantidad + 1)}
                disabled={disabled}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
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
    </div>
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
  isMesaOrder,
  mesaNumero,
  empleadoCodigo,
  mozoCodigo,
  mozoNombre,
  deliveryZoneInfo,
  isOutsideDeliveryZone,
  checkingZone,
  deliveryUnavailable = false,
  disabled,
}: {
  negocio: NegocioAPI
  metodoEntrega: "retiro" | "domicilio" | "mesa"
  setMetodoEntrega: (v: "retiro" | "domicilio" | "mesa") => void
  metodoPago: "efectivo" | "transferencia"
  setMetodoPago: (v: "efectivo" | "transferencia") => void
  notas: string
  setNotas: (v: string) => void
  deliveryFee: number
  deliveryAddress: DeliveryAddress | null
  isMesaOrder?: boolean
  mesaNumero?: number | null
  empleadoCodigo?: string
  mozoCodigo?: string
  mozoNombre?: string
  deliveryZoneInfo: {
    checked: boolean
    delivery: boolean
    precioDelivery: number
    zonaNombre: string | null
    reason: string | null
    mode: string | null
  } | null
  isOutsideDeliveryZone: boolean
  checkingZone: boolean
  deliveryUnavailable?: boolean
  disabled?: boolean
}) {
  return (
    <div className="px-4 py-4 space-y-5">
      {/* ===== DELIVERY METHOD ===== */}
      {isMesaOrder ? (
        <section>
          <div
            className="p-4 rounded-2xl border-2 flex items-center gap-3"
            style={{
              borderColor: `${negocio.colorPrincipal}40`,
              backgroundColor: `${negocio.colorPrincipal}08`,
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${negocio.colorPrincipal}15` }}
            >
              <Armchair
                className="h-5 w-5"
                style={{ color: negocio.colorPrincipal }}
              />
            </div>
            <div>
              <p className="font-bold text-sm">
                Pedido para Mesa {mesaNumero ?? ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Te serviremos en esta mesa
              </p>
            </div>
          </div>
        </section>
      ) : (
      <section>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          Método de entrega
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setMetodoEntrega("retiro")}
            disabled={disabled}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
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
              <div
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center animate-in zoom-in duration-200"
                style={{ backgroundColor: negocio.colorPrincipal }}
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </div>
            )}
          </button>

          {negocio.ofreceDelivery && !deliveryUnavailable && (
            <button
              onClick={() => setMetodoEntrega("domicilio")}
              disabled={disabled}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
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
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center animate-in zoom-in duration-200"
                  style={{ backgroundColor: negocio.colorPrincipal }}
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          )}
        </div>

        {/* Outside zone notice — delivery not available */}
        {deliveryUnavailable && (
          <div className="mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <Store className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              Tu ubicación está fuera de la zona de delivery. Solo podés retirar en local.
            </p>
          </div>
        )}

        {/* Delivery address display — READ ONLY, cannot change from cart */}
        {metodoEntrega === "domicilio" && (
          <>
          <div
            className={cn(
              "w-full mt-3 flex items-center gap-3 p-3.5 rounded-2xl text-left animate-in fade-in slide-in-from-top-1 duration-200",
              isOutsideDeliveryZone
                ? "border-2 border-destructive/40 bg-destructive/5"
                : deliveryAddress
                  ? "border-2 border-primary/20 bg-primary/5"
                  : "border-2 border-dashed border-border bg-muted/30"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
              isOutsideDeliveryZone ? "bg-destructive/10" : "bg-primary/10"
            )}>
              {checkingZone ? (
                <span className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : isOutsideDeliveryZone ? (
                <X className="h-4 w-4 text-destructive" />
              ) : (
                <MapPin className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {deliveryAddress ? (
                <>
                  <p className={cn("text-sm font-semibold truncate", isOutsideDeliveryZone && "text-destructive")}>
                    {deliveryAddress.alias || deliveryAddress.direccion || "Ubicación seleccionada"}
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

          {/* Zone info / warning */}
          {deliveryAddress && deliveryZoneInfo?.checked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              {isOutsideDeliveryZone ? (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                  <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-destructive">
                      Fuera de la zona de delivery
                    </p>
                    <p className="text-[11px] text-destructive/70 mt-0.5">
                      Tu ubicación no está dentro de las zonas de cobertura. Elegí retirar en local o cambiá tu dirección desde el inicio.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Delivery: {deliveryZoneInfo.precioDelivery > 0 ? formatPrice(deliveryZoneInfo.precioDelivery) : "Gratis"}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Checking zone loading */}
          {deliveryAddress && checkingZone && (
            <div className="mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-muted/50">
              <span className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-[11px] text-muted-foreground">Verificando zona de delivery...</p>
            </div>
          )}
          </>
        )}
      </section>
      )}

      {/* Business location for retiro orders */}
      {metodoEntrega === "retiro" && negocio.lat && negocio.lng && (
        <section>
          <a
            href={`https://www.google.com/maps?q=${negocio.lat},${negocio.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Ver ubicación del local</p>
              <p className="text-[10px] text-muted-foreground">
                Tocá para abrir en Google Maps
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </a>
        </section>
      )}
      {isMesaOrder && mozoCodigo && (
        <section>
          <div
            className="p-4 rounded-2xl border-2 flex items-center gap-3"
            style={{
              borderColor: "#3b82f640",
              backgroundColor: "#3b82f608",
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
              <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-blue-700 dark:text-blue-300">
                {mozoNombre ?? "Mozo"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Este pedido se cargará a tus estadísticas
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===== PAYMENT METHOD ===== */}
      <section>
        <h3 className="font-bold text-sm mb-3">Método de pago</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setMetodoPago("efectivo")}
            disabled={disabled}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
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
              <div
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center animate-in zoom-in duration-200"
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </div>
            )}
          </button>

          {negocio.aceptaTransferencia && (
            <button
              onClick={() => setMetodoPago("transferencia")}
              disabled={disabled}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
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
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center animate-in zoom-in duration-200"
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          )}
        </div>

        {/* Transfer alias */}
        {metodoPago === "transferencia" && negocio.aliasBancario && (
          <div
            className="mt-3 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900 animate-in fade-in slide-in-from-top-1 duration-200"
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
              Enviá el comprobante por el chat de la app al confirmar tu pedido
            </p>
          </div>
        )}
      </section>

      {/* ===== ORDER NOTES ===== */}
      <section>
        <h3 className="font-bold text-sm mb-3">Notas del pedido</h3>
        <div className="relative">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value.slice(0, 200))}
            placeholder="Instrucciones especiales, alergias, sin cebolla..."
            disabled={disabled}
            className="w-full min-h-[80px] p-4 rounded-2xl border-2 border-border bg-card text-sm resize-none focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/60 disabled:opacity-50 disabled:cursor-not-allowed"
            rows={3}
          />
          <span className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/50">
            {notas.length}/200
          </span>
        </div>
      </section>
    </div>
  )
}
