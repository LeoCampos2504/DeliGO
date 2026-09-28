"use client"

// ============================================
// P2-T56-R1 — Caja (in-person POS)
// ============================================
// A sale here is a Venta/VentaItem, deliberately independent of Pedido —
// see the P2-T56-R1 report for the architecture decision. The cart lives as
// local component state; totals are pure (src/lib/caja-venta.ts) and are
// always re-validated/recomputed server-side on checkout — the client
// total shown here is only a preview.

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  History,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "sonner"
import { cn, formatPrice } from "@/lib/utils"
import { computeStockStatus, isProductSellable } from "@/lib/inventario"
import { mergeManagedCategories } from "@/lib/category-normalization"
import {
  addCartLine,
  cartItemCount,
  cartTotal,
  formatUnidadesVenta,
  isValidMetodoPagoVenta,
  removeCartLine,
  setCartLineQuantity,
  totalUnidadesVenta,
  type CartLine,
  type MetodoPagoVenta,
} from "@/lib/caja-venta"

interface CajaProducto {
  id: string
  nombre: string
  precio: number
  categoria: string
  imagenUrl: string | null
  eliminado: boolean
  controlStock: boolean
  stockCantidad: number
  stockMinimo: number
}

// P2-T56-R2A: snapshot line, exactly as persisted on VentaItem — never
// recomputed from the live Producto (section 11). Both GET and POST
// /api/negocio/caja/ventas already include these; no backend change needed.
interface VentaItemSnapshot {
  id: string
  productoId: string | null
  nombre: string
  precio: number
  cantidad: number
  subtotal: number
}

interface VentaResumen {
  id: string
  total: number
  metodoPago: string
  cantidadItems: number
  items: VentaItemSnapshot[]
  createdAt: string
}

type CajaSubTab = "vender" | "resumen"

export function CajaTab({ negocio }: { negocio: { id: string } }) {
  const [subTab, setSubTab] = useState<CajaSubTab>("vender")

  return (
    <div className="space-y-3">
      <div className="flex bg-muted/60 rounded-xl p-1 gap-1">
        <SubTabButton active={subTab === "vender"} icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Vender" onClick={() => setSubTab("vender")} />
        <SubTabButton active={subTab === "resumen"} icon={<Receipt className="h-3.5 w-3.5" />} label="Resumen" onClick={() => setSubTab("resumen")} />
      </div>
      {subTab === "vender" ? <VenderView negocioId={negocio.id} /> : <ResumenView negocioId={negocio.id} />}
    </div>
  )
}

function SubTabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all",
        active ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// ============================================
// VENDER — product picker + cart (desktop two-pane / mobile sticky cart)
// ============================================
function VenderView({ negocioId }: { negocioId: string }) {
  const [search, setSearch] = useState("")
  const [categoria, setCategoria] = useState("todas")
  const [cart, setCart] = useState<CartLine[]>([])
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [successSale, setSuccessSale] = useState<VentaResumen | null>(null)
  const queryClient = useQueryClient()

  const { data: productos, isLoading } = useQuery<CajaProducto[]>({
    queryKey: ["negocio-caja-productos", negocioId],
    queryFn: async () => {
      const res = await fetch("/api/negocio/productos")
      if (!res.ok) throw new Error("Error al obtener productos")
      return res.json()
    },
  })

  // P2-T56-R2B: SAME managed-category authority Inventario reads — never a
  // second, independent derivation (see the R2B report §14).
  const { data: categoriasManaged = [] } = useQuery<string[]>({
    queryKey: ["negocio-categorias", negocioId],
    queryFn: async () => {
      const res = await fetch("/api/negocio/categorias")
      if (!res.ok) return []
      const json = await res.json()
      return json.categorias ?? []
    },
  })

  const activos = useMemo(() => (productos ?? []).filter((p) => !p.eliminado), [productos])
  const categorias = useMemo(
    () => mergeManagedCategories(categoriasManaged, activos.map((p) => p.categoria)),
    [categoriasManaged, activos]
  )
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return activos.filter((p) => {
      if (categoria !== "todas" && p.categoria !== categoria) return false
      if (!term) return true
      return p.nombre.toLowerCase().includes(term)
    })
  }, [activos, search, categoria])

  function addProduct(p: CajaProducto) {
    if (!isProductSellable({ activo: !p.eliminado, controlStock: p.controlStock, stockCantidad: p.stockCantidad })) {
      toast.error("Sin stock")
      return
    }
    setCart((prev) => addCartLine(prev, { productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }))
  }

  function updateQuantity(productoId: string, cantidad: number) {
    setCart((prev) => setCartLineQuantity(prev, productoId, cantidad))
  }

  const total = cartTotal(cart)
  const itemCount = cartItemCount(cart)

  const saleMutation = useMutation({
    mutationFn: async (metodoPago: MetodoPagoVenta) => {
      const res = await fetch("/api/negocio/caja/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodoPago, items: cart.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al registrar la venta")
      return data as VentaResumen
    },
    onSuccess: (venta) => {
      setCart([])
      setCheckoutOpen(false)
      setMobileCartOpen(false)
      setSuccessSale(venta)
      queryClient.invalidateQueries({ queryKey: ["negocio-caja-productos", negocioId] })
      queryClient.invalidateQueries({ queryKey: ["negocio-caja-ventas-hoy", negocioId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Cargando productos…</div>
  }

  if (activos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
        <Package className="h-10 w-10 text-muted-foreground" />
        <h3 className="font-bold text-base">No hay productos disponibles para vender</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">Cargá productos desde Inventario para empezar a vender.</p>
      </div>
    )
  }

  const productGrid = (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" className="pl-9 rounded-xl" />
      </div>
      {categorias.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
          <button onClick={() => setCategoria("todas")} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", categoria === "todas" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>Todas</button>
          {categorias.map((c) => (
            <button key={c} onClick={() => setCategoria(c)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", categoria === c ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>{c}</button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No encontramos productos</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map((p) => {
            const sellable = isProductSellable({ activo: !p.eliminado, controlStock: p.controlStock, stockCantidad: p.stockCantidad })
            const status = computeStockStatus(p.controlStock, p.stockCantidad, p.stockMinimo)
            return (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                disabled={!sellable}
                className={cn(
                  "flex flex-col rounded-2xl border border-border bg-card p-2 text-left transition-shadow hover:shadow-md",
                  !sellable && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="aspect-square w-full rounded-xl bg-muted overflow-hidden flex items-center justify-center mb-1.5">
                  {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground" />}
                </div>
                <p className="text-xs font-semibold line-clamp-2">{p.nombre}</p>
                <p className="text-sm font-bold mt-0.5">{formatPrice(p.precio)}</p>
                {status === "SIN_STOCK" && <span className="text-[10px] font-semibold text-red-600 mt-0.5">Sin stock</span>}
                {status === "STOCK_BAJO" && <span className="text-[10px] font-semibold text-amber-600 mt-0.5">Stock bajo</span>}
              </button>
            )
          })}
        </div>
      )}
    </>
  )

  const cartPanel = (
    <CartPanel
      cart={cart}
      onUpdateQuantity={updateQuantity}
      onRemove={(id) => setCart((prev) => removeCartLine(prev, id))}
      onCobrar={() => setCheckoutOpen(true)}
    />
  )

  return (
    <div>
      {/* Desktop: two-pane. Cart column is a fixed, compact width (not a
          flexible fraction) so it reads as a cart card, not a stretched
          panel, regardless of how wide the product grid's own column gets
          on a large monitor (R2A finding A). */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_440px] lg:gap-4 lg:items-start">
        <div className="space-y-3">{productGrid}</div>
        <div className="sticky top-4 rounded-2xl border border-border bg-card p-4">{cartPanel}</div>
      </div>

      {/* Mobile/tablet: product grid + sticky bottom cart bar */}
      <div className="lg:hidden space-y-3 pb-20">
        {productGrid}
        {itemCount > 0 && (
          <button
            onClick={() => setMobileCartOpen(true)}
            className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground shadow-xl"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <ShoppingCart className="h-4 w-4" /> Ver carrito · {itemCount} producto{itemCount === 1 ? "" : "s"}
            </span>
            <span className="text-sm font-bold">{formatPrice(total)}</span>
          </button>
        )}
      </div>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        {/* R2A finding A (mobile): the bottom-sheet frame itself is
            intentionally edge-to-edge (standard bottom-sheet pattern), but
            its body previously had no horizontal padding at all — only the
            header did — so cart lines/total/Cobrar touched the screen
            edges and lost the "carrito" card feel. A contained, padded,
            width-capped inner wrapper fixes that without touching the
            shared Sheet component (which other surfaces also use). */}
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <SheetHeader><SheetTitle>Carrito</SheetTitle></SheetHeader>
          <div className="mx-auto w-full max-w-md px-4 pb-2">{cartPanel}</div>
        </SheetContent>
      </Sheet>

      {checkoutOpen && (
        <CheckoutDialog
          total={total}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={(metodo) => saleMutation.mutate(metodo)}
          loading={saleMutation.isPending}
        />
      )}

      {successSale && (
        <SuccessDialog
          venta={successSale}
          onNuevaVenta={() => setSuccessSale(null)}
        />
      )}
    </div>
  )
}

function CartPanel({
  cart,
  onUpdateQuantity,
  onRemove,
  onCobrar,
}: {
  cart: CartLine[]
  onUpdateQuantity: (productoId: string, cantidad: number) => void
  onRemove: (productoId: string) => void
  onCobrar: () => void
}) {
  const total = cartTotal(cart)
  if (cart.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Agregá productos para empezar una venta</p>
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {cart.map((line) => (
          <div key={line.productoId} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{line.nombre}</p>
              <p className="text-xs text-muted-foreground">{formatPrice(line.precio)} c/u</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => onUpdateQuantity(line.productoId, line.cantidad - 1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.cantidad}</span>
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => onUpdateQuantity(line.productoId, line.cantidad + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground" onClick={() => onRemove(line.productoId)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-lg font-bold">{formatPrice(total)}</span>
      </div>
      <Button className="w-full h-11 rounded-xl font-bold" onClick={onCobrar}>Cobrar</Button>
    </div>
  )
}

function CheckoutDialog({
  total,
  onClose,
  onConfirm,
  loading,
}: {
  total: number
  onClose: () => void
  onConfirm: (metodo: MetodoPagoVenta) => void
  loading: boolean
}) {
  const [metodo, setMetodo] = useState<MetodoPagoVenta>("EFECTIVO")
  return (
    <Dialog open onOpenChange={(open) => !open && !loading && onClose()}>
      {/* R2A finding A (desktop): the shared DialogContent already ships an
          `sm:max-w-lg` (512px) default. An unscoped override like
          `max-w-xs` alone only wins below the `sm` breakpoint — tailwind-
          merge keeps both classes since they occupy different responsive
          slots, so any viewport >= 640px (most real desktop/laptop windows,
          not just very wide monitors) silently fell back to 512px. Matching
          the SAME `sm:` slot is what actually overrides it. */}
      <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle>Cobrar {formatPrice(total)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <MetodoButton label="Efectivo" icon={<Banknote className="h-4 w-4" />} active={metodo === "EFECTIVO"} onClick={() => setMetodo("EFECTIVO")} />
            <MetodoButton label="Transferencia" icon={<CreditCard className="h-4 w-4" />} active={metodo === "TRANSFERENCIA"} onClick={() => setMetodo("TRANSFERENCIA")} />
            <MetodoButton label="Otro" icon={<Receipt className="h-4 w-4" />} active={metodo === "OTRO"} onClick={() => setMetodo("OTRO")} />
          </div>
          <Button
            className="w-full h-11 rounded-xl font-bold"
            disabled={loading || !isValidMetodoPagoVenta(metodo)}
            onClick={() => onConfirm(metodo)}
          >
            {loading ? "Registrando…" : `Confirmar venta · ${formatPrice(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetodoButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function SuccessDialog({ venta, onNuevaVenta }: { venta: VentaResumen; onNuevaVenta: () => void }) {
  const unidades = totalUnidadesVenta(venta.items)
  return (
    <Dialog open onOpenChange={(open) => !open && onNuevaVenta()}>
      <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl text-center">
        <div className="flex flex-col items-center gap-2 py-2">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h3 className="font-bold text-lg">Venta registrada</h3>
          <p className="text-2xl font-bold">{formatPrice(venta.total)}</p>
          <p className="text-xs text-muted-foreground">
            {venta.metodoPago} · {formatUnidadesVenta(unidades)} · {new Date(venta.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[10px] text-muted-foreground">#{venta.id.slice(0, 8)}</p>
        </div>
        <Button className="w-full h-11 rounded-xl font-bold" onClick={onNuevaVenta}>Nueva venta</Button>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// RESUMEN — today's totals + recent sales (section 21)
// ============================================
function ResumenView({ negocioId }: { negocioId: string }) {
  const [detailSale, setDetailSale] = useState<VentaResumen | null>(null)
  const { data, isLoading } = useQuery<{ ventasHoy: VentaResumen[]; resumenHoy: Record<string, number> }>({
    queryKey: ["negocio-caja-ventas-hoy", negocioId],
    queryFn: async () => {
      const res = await fetch("/api/negocio/caja/ventas")
      if (!res.ok) throw new Error("Error al obtener las ventas")
      return res.json()
    },
    refetchInterval: 15000,
  })

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>

  const resumen = data?.resumenHoy
  const ventas = data?.ventasHoy ?? []

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard label="Total vendido hoy" value={formatPrice(resumen?.totalVendido ?? 0)} highlight />
        <SummaryCard label="Ventas" value={String(resumen?.cantidadVentas ?? 0)} />
        <SummaryCard label="Efectivo" value={formatPrice(resumen?.totalEfectivo ?? 0)} />
        <SummaryCard label="Transferencia" value={formatPrice(resumen?.totalTransferencia ?? 0)} />
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
          <History className="h-3.5 w-3.5" /> Ventas recientes
        </p>
        {ventas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Todavía no registraste ventas hoy</p>
        ) : (
          <div className="space-y-1.5">
            {/* P2-T56-R2A section 12: compact by default (total, real unit
                count — never line count, method, time); tap for the full
                per-line breakdown instead of pre-expanding every sale. */}
            {ventas.map((v) => {
              const unidades = totalUnidadesVenta(v.items)
              return (
                <button
                  key={v.id}
                  onClick={() => setDetailSale(v)}
                  className="flex w-full items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{formatPrice(v.total)}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{formatUnidadesVenta(unidades)} · {v.metodoPago}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {detailSale && (
        <VentaDetailDialog venta={detailSale} onClose={() => setDetailSale(null)} />
      )}
    </div>
  )
}

// P2-T56-R2A section 8: per-line breakdown from VentaItem's own snapshot
// fields — never recomputed from the live Producto (section 11), so a
// price/name change tomorrow never rewrites yesterday's sale.
function VentaDetailDialog({ venta, onClose }: { venta: VentaResumen; onClose: () => void }) {
  const unidades = totalUnidadesVenta(venta.items)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de venta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="max-h-[50vh] space-y-2.5 overflow-y-auto">
            {venta.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">{item.cantidad} × {formatPrice(item.precio)}</p>
                </div>
                <span className="shrink-0 font-semibold">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold">{formatPrice(venta.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{formatUnidadesVenta(unidades)}</p>
            <p className="text-xs text-muted-foreground">Método: {venta.metodoPago}</p>
            <p className="text-xs text-muted-foreground">Hora: {new Date(venta.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <Button variant="secondary" className="w-full rounded-xl" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-3", highlight ? "bg-primary/10" : "bg-muted/50")}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold", highlight && "text-primary")}>{value}</p>
    </div>
  )
}
