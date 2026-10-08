"use client"

// ============================================
// P2-T56-R1 — Caja (in-person POS)
// ============================================
// A sale here is a Venta/VentaItem, deliberately independent of Pedido —
// see the P2-T56-R1 report for the architecture decision. The cart lives as
// local component state; totals are pure (src/lib/caja-venta.ts) and are
// always re-validated/recomputed server-side on checkout — the client
// total shown here is only a preview.

import { useEffect, useMemo, useRef, useState } from "react"
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
  ScanBarcode,
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
import { matchesCategoryFilter, mergeManagedCategories, SIN_CATEGORIA } from "@/lib/category-normalization"
import { matchesCajaSearch } from "@/lib/product-variant-search"
import {
  barcodeLookupKey,
  describeScanStockWarning,
  resolveBarcodeMatch,
  resolveScannedBarcode,
  type BarcodeMatch,
  type ResolvedScan,
} from "@/lib/barcode"
import { primeScanAudio } from "@/lib/scan-feedback"
import { BarcodeScanner, type ScanFeedback } from "@/components/business/barcode-scanner"
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

// P2-T56-R2C: a product with >=1 variant sells THROUGH its variants only —
// see VenderView's addProduct/handleProductTap for the exact selection
// rules (sections 19/20).
interface CajaVariante {
  id: string
  nombre: string
  precio: number
  activo: boolean
  controlStock: boolean
  stockCantidad: number
  // P2-T56-R3B: already present in the GET /api/negocio/productos response
  // (full Prisma include) — just not previously declared/read here.
  sku: string | null
  codigoBarras: string | null
  // F9 (D5): físico − reservas ACTIVA, present only for controlled rows of a
  // generic business (GET /api/negocio/productos). Warning input only — the
  // checkout stays the stock authority.
  stockDisponible?: number | null
}

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
  variantes: CajaVariante[]
  // P2-T56-R3B: same note as CajaVariante above.
  marca: string | null
  sku: string | null
  codigoBarras: string | null
  // F9 (D5): same note as CajaVariante.stockDisponible.
  stockDisponible?: number | null
}

// P2-T56-R2A: snapshot line, exactly as persisted on VentaItem — never
// recomputed from the live Producto (section 11). Both GET and POST
// /api/negocio/caja/ventas already include these; no backend change needed.
interface VentaItemSnapshot {
  id: string
  productoId: string | null
  varianteNombre: string | null
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

  const { data: productos, isLoading, refetch: refetchProductos } = useQuery<CajaProducto[]>({
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

  // P2-T56-R2B-F1: same "Sin Categoria" pill + stale-filter reconciliation
  // as InventarioTab — see that file's comments for why (sections 7/11).
  const hasSinCategoria = useMemo(
    () => activos.some((p) => matchesCategoryFilter(p.categoria, SIN_CATEGORIA)),
    [activos]
  )

  // P2-T56-R2B-F1: derived during render, not a setState-in-effect — see
  // the identical comment in InventarioTab for why.
  const effectiveCategoria = useMemo(() => {
    if (categoria === "todas") return "todas"
    const stillValid =
      categorias.some((c) => matchesCategoryFilter(c, categoria)) ||
      (hasSinCategoria && matchesCategoryFilter(categoria, SIN_CATEGORIA))
    return stillValid ? categoria : "todas"
  }, [categoria, categorias, hasSinCategoria])

  // P2-T56-R3B: a search term matching an ACTIVE variant's nombre/sku/
  // codigoBarras surfaces the parent Producto (never as a separate card) —
  // an inactive variant alone never does, since it isn't sellable (section
  // 9). Tapping the product still opens the normal variant selector; a
  // search match never auto-adds or auto-selects a variant (section 5).
  const filtered = useMemo(() => {
    return activos.filter((p) => {
      if (effectiveCategoria !== "todas" && !matchesCategoryFilter(p.categoria, effectiveCategoria)) return false
      return matchesCajaSearch(p, search)
    })
  }, [activos, search, effectiveCategoria])

  const [varianteSelector, setVarianteSelector] = useState<CajaProducto | null>(null)

  function addProduct(p: CajaProducto) {
    if (!isProductSellable({ activo: !p.eliminado, controlStock: p.controlStock, stockCantidad: p.stockCantidad })) {
      toast.error("Sin stock")
      return
    }
    setCart((prev) => addCartLine(prev, { productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }))
  }

  function addVariante(p: CajaProducto, variante: CajaVariante) {
    if (!isProductSellable({ activo: variante.activo, controlStock: variante.controlStock, stockCantidad: variante.stockCantidad })) {
      toast.error("Sin stock")
      return
    }
    setCart((prev) =>
      addCartLine(prev, {
        productoId: p.id,
        varianteId: variante.id,
        nombre: p.nombre,
        varianteNombre: variante.nombre,
        precio: variante.precio,
        cantidad: 1,
      })
    )
    setVarianteSelector(null)
  }

  // P2-T56-R2C §19/20: a product with no variants keeps the exact one-tap
  // add it always had. A product WITH variants opens a selector UNLESS
  // there is exactly one sellable active variant — then that ambiguity
  // simply doesn't exist, so it adds directly, same one-tap feel.
  function handleProductTap(p: CajaProducto) {
    if (p.variantes.length === 0) {
      addProduct(p)
      return
    }
    const activas = p.variantes.filter((v) => v.activo)
    if (activas.length === 0) return
    if (activas.length === 1) {
      addVariante(p, activas[0])
      return
    }
    setVarianteSelector(p)
  }

  function isCajaProductTappable(p: CajaProducto): boolean {
    if (p.variantes.length === 0) {
      return isProductSellable({ activo: !p.eliminado, controlStock: p.controlStock, stockCantidad: p.stockCantidad })
    }
    const activas = p.variantes.filter((v) => v.activo)
    if (activas.length === 0) return false
    if (activas.length > 1) return true // worth opening the selector even if some are sin stock
    return isProductSellable({ activo: true, controlStock: activas[0].controlStock, stockCantidad: activas[0].stockCantidad })
  }

  function updateQuantity(productoId: string, cantidad: number, varianteId?: string | null) {
    setCart((prev) => setCartLineQuantity(prev, productoId, cantidad, varianteId))
  }

  // ============================================
  // F9 — continuous barcode scanning into THIS cart
  // ============================================
  // The scanner never sells and never keeps its own cart: every accepted
  // read resolves an exact code against this business's catalog (already
  // tenant-scoped by GET /api/negocio/productos) and goes through the same
  // addCartLine as a tap. Quantities are then edited in the existing
  // CartPanel and the sale is confirmed by the existing checkout.
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanVarianteSelector, setScanVarianteSelector] = useState<CajaProducto | null>(null)
  const [scanAmbiguous, setScanAmbiguous] = useState<Array<BarcodeMatch<CajaProducto, CajaVariante>> | null>(null)
  const [scanAnnouncement, setScanAnnouncement] = useState<(ScanFeedback & { id: number }) | null>(null)
  const cartRef = useRef<CartLine[]>(cart)
  const scanRefetchedRef = useRef<Set<string>>(new Set())
  const announcementSeq = useRef(0)
  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  function openScanner() {
    primeScanAudio()
    scanRefetchedRef.current = new Set()
    setScannerOpen(true)
  }

  function announce(feedback: ScanFeedback) {
    announcementSeq.current += 1
    setScanAnnouncement({ ...feedback, id: announcementSeq.current })
  }

  function addScannedLine(p: CajaProducto, variante: CajaVariante | null): ScanFeedback {
    const line: CartLine = variante
      ? { productoId: p.id, varianteId: variante.id, nombre: p.nombre, varianteNombre: variante.nombre, precio: variante.precio, cantidad: 1 }
      : { productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }
    const next = addCartLine(cartRef.current, line)
    cartRef.current = next
    setCart(next)
    const cantidad = next.find((l) => l.productoId === p.id && (l.varianteId ?? null) === (variante?.id ?? null))?.cantidad ?? 1
    const authority = variante ?? p
    const warning = describeScanStockWarning({
      controlStock: authority.controlStock,
      stockCantidad: authority.stockCantidad,
      stockDisponible: authority.stockDisponible,
      cantidadEnCarrito: cantidad,
    })
    const label = variante ? `${p.nombre} — ${variante.nombre}` : p.nombre
    return warning
      ? { tone: "warning", title: `Agregado: ${label} (×${cantidad})`, detail: warning }
      : { tone: "success", title: `Agregado: ${label}`, detail: `Cantidad en carrito: ${cantidad} · ${formatPrice(line.precio)} c/u` }
  }

  // The scanner always calls the latest onCode (it keeps it in a ref), so
  // this reads the live catalog without memoization.
  async function handleScannedCode(code: string): Promise<ScanFeedback> {
    let resolution = resolveScannedBarcode<CajaVariante, CajaProducto>(activos, code)
    // Stale catalog (e.g. a product created moments ago in Inventario):
    // refetch ONCE per code per scanner session, then decide.
    const key = barcodeLookupKey(code)
    if (resolution.kind === "not_found" && key && !scanRefetchedRef.current.has(key)) {
      scanRefetchedRef.current.add(key)
      const fresh = await refetchProductos()
      resolution = resolveScannedBarcode<CajaVariante, CajaProducto>((fresh.data ?? []).filter((p) => !p.eliminado), code)
    }
    if (resolution.kind === "not_found") {
      return { tone: "error", title: "Producto no encontrado", detail: `Código ${code}` }
    }
    if (resolution.kind === "ambiguous") {
      setScanAmbiguous(resolution.matches)
      return { tone: "warning", title: "Código asignado a varios productos", detail: "Elegí el correcto" }
    }
    return applyScanResolution(resolution)
  }

  function applyScanResolution(resolution: ResolvedScan<CajaProducto, CajaVariante>): ScanFeedback {
    switch (resolution.kind) {
      case "unavailable":
        return {
          tone: "error",
          title: resolution.reason === "sin_stock" ? "Sin stock" : "Producto no disponible",
          detail: resolution.label,
        }
      case "add_producto":
        return addScannedLine(resolution.producto, null)
      case "add_variante":
        return addScannedLine(resolution.producto, resolution.variante)
      case "choose_variante":
        setScanVarianteSelector(resolution.producto)
        return { tone: "info", title: "Elegí la variante", detail: resolution.producto.nombre }
    }
  }

  function pickScannedVariante(p: CajaProducto, variante: CajaVariante) {
    setScanVarianteSelector(null)
    announce(addScannedLine(p, variante))
  }

  function pickAmbiguousMatch(match: BarcodeMatch<CajaProducto, CajaVariante>) {
    setScanAmbiguous(null)
    announce(applyScanResolution(resolveBarcodeMatch<CajaVariante, CajaProducto>(match)))
  }

  function viewCartFromScanner() {
    setScannerOpen(false)
    const desktop = typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches === true
    if (!desktop) setMobileCartOpen(true)
  }

  const total = cartTotal(cart)
  const itemCount = cartItemCount(cart)

  const saleMutation = useMutation({
    mutationFn: async (metodoPago: MetodoPagoVenta) => {
      const res = await fetch("/api/negocio/caja/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metodoPago, items: cart.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId ?? undefined, cantidad: l.cantidad })) }),
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
      <Button type="button" className="w-full h-11 rounded-xl font-bold gap-2" onClick={openScanner}>
        <ScanBarcode className="h-5 w-5" /> Escanear productos
      </Button>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" className="pl-9 rounded-xl" />
      </div>
      {categorias.length + (hasSinCategoria ? 1 : 0) > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
          <button onClick={() => setCategoria("todas")} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", effectiveCategoria === "todas" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>Todas</button>
          {categorias.map((c) => (
            <button key={c} onClick={() => setCategoria(c)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", matchesCategoryFilter(effectiveCategoria, c) ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>{c}</button>
          ))}
          {hasSinCategoria && (
            <button
              onClick={() => setCategoria(SIN_CATEGORIA)}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold", effectiveCategoria !== "todas" && matchesCategoryFilter(effectiveCategoria, SIN_CATEGORIA) ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}
            >
              Sin categoría
            </button>
          )}
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {effectiveCategoria !== "todas" && !search.trim() ? "No hay productos en esta categoría" : "No encontramos productos"}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map((p) => {
            const hasVariantes = p.variantes.length > 0
            const activasVariantes = p.variantes.filter((v) => v.activo)
            const tappable = isCajaProductTappable(p)
            const status = hasVariantes ? null : computeStockStatus(p.controlStock, p.stockCantidad, p.stockMinimo)
            const precioDesde = hasVariantes && activasVariantes.length > 0 ? Math.min(...activasVariantes.map((v) => v.precio)) : null
            return (
              <button
                key={p.id}
                onClick={() => handleProductTap(p)}
                disabled={!tappable}
                className={cn(
                  "flex flex-col rounded-2xl border border-border bg-card p-2 text-left transition-shadow hover:shadow-md",
                  !tappable && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="aspect-square w-full rounded-xl bg-muted overflow-hidden flex items-center justify-center mb-1.5">
                  {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground" />}
                </div>
                <p className="text-xs font-semibold line-clamp-2">{p.nombre}</p>
                {hasVariantes ? (
                  <>
                    <p className="text-sm font-bold mt-0.5">{precioDesde != null ? `Desde ${formatPrice(precioDesde)}` : "—"}</p>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {activasVariantes.length} variante{activasVariantes.length === 1 ? "" : "s"}
                    </span>
                    {!tappable && <span className="text-[10px] font-semibold text-red-600 mt-0.5">{activasVariantes.length === 0 ? "Sin variantes disponibles" : "Sin stock"}</span>}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold mt-0.5">{formatPrice(p.precio)}</p>
                    {status === "SIN_STOCK" && <span className="text-[10px] font-semibold text-red-600 mt-0.5">Sin stock</span>}
                    {status === "STOCK_BAJO" && <span className="text-[10px] font-semibold text-amber-600 mt-0.5">Stock bajo</span>}
                  </>
                )}
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
      onRemove={(productoId, varianteId) => setCart((prev) => removeCartLine(prev, productoId, varianteId))}
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

      {varianteSelector && (
        <VarianteSelectorDialog
          producto={varianteSelector}
          onClose={() => setVarianteSelector(null)}
          onSelect={(variante) => addVariante(varianteSelector, variante)}
        />
      )}

      {scannerOpen && (
        <BarcodeScanner
          mode="continuous"
          title="Escanear productos"
          onClose={() => setScannerOpen(false)}
          onCode={handleScannedCode}
          paused={scanVarianteSelector !== null || scanAmbiguous !== null}
          announcement={scanAnnouncement}
          footer={
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/70">{itemCount} producto{itemCount === 1 ? "" : "s"} en el carrito</p>
                <p className="text-base font-bold">{formatPrice(total)}</p>
              </div>
              <Button type="button" variant="secondary" className="rounded-xl font-semibold gap-1.5" onClick={viewCartFromScanner}>
                <ShoppingCart className="h-4 w-4" /> Ver carrito
              </Button>
            </div>
          }
        />
      )}

      {/* Rendered after the scanner so these Radix portals stack above it. */}
      {scanVarianteSelector && (
        <VarianteSelectorDialog
          producto={scanVarianteSelector}
          onClose={() => setScanVarianteSelector(null)}
          onSelect={(variante) => pickScannedVariante(scanVarianteSelector, variante)}
        />
      )}

      {scanAmbiguous && (
        <AmbiguousBarcodeDialog
          matches={scanAmbiguous}
          onClose={() => setScanAmbiguous(null)}
          onSelect={pickAmbiguousMatch}
        />
      )}
    </div>
  )
}

// F9 §6.4: a code shared by several articles (historical duplicates) is
// never resolved automatically — the cashier picks the right one.
function AmbiguousBarcodeDialog({
  matches,
  onClose,
  onSelect,
}: {
  matches: Array<BarcodeMatch<CajaProducto, CajaVariante>>
  onClose: () => void
  onSelect: (match: BarcodeMatch<CajaProducto, CajaVariante>) => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle>Elegí el producto</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Este código está asignado a más de un artículo.</p>
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {matches.map((match) => {
            const label = match.kind === "variante" ? `${match.producto.nombre} — ${match.variante.nombre}` : match.producto.nombre
            const precio = match.kind === "variante" ? match.variante.precio : match.producto.precio
            const key = match.kind === "variante" ? `v-${match.variante.id}` : `p-${match.producto.id}`
            return (
              <button
                key={key}
                onClick={() => onSelect(match)}
                className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left"
              >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-sm font-bold">{formatPrice(precio)}</span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function VarianteSelectorDialog({
  producto,
  onClose,
  onSelect,
}: {
  producto: CajaProducto
  onClose: () => void
  onSelect: (variante: CajaVariante) => void
}) {
  const activas = producto.variantes.filter((v) => v.activo)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle>Elegí una variante — {producto.nombre}</DialogTitle></DialogHeader>
        {activas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay variantes disponibles</p>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {activas.map((v) => {
              const sellable = isProductSellable({ activo: true, controlStock: v.controlStock, stockCantidad: v.stockCantidad })
              return (
                <button
                  key={v.id}
                  onClick={() => sellable && onSelect(v)}
                  disabled={!sellable}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left",
                    !sellable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="text-sm font-medium">{v.nombre}</span>
                  <span className="flex items-center gap-2">
                    {!sellable && <span className="text-[10px] font-semibold text-red-600">Sin stock</span>}
                    <span className="text-sm font-bold">{formatPrice(v.precio)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CartPanel({
  cart,
  onUpdateQuantity,
  onRemove,
  onCobrar,
}: {
  cart: CartLine[]
  onUpdateQuantity: (productoId: string, cantidad: number, varianteId?: string | null) => void
  onRemove: (productoId: string, varianteId?: string | null) => void
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
          <div key={`${line.productoId}-${line.varianteId ?? ""}`} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{line.nombre}{line.varianteNombre ? ` — ${line.varianteNombre}` : ""}</p>
              <p className="text-xs text-muted-foreground">{formatPrice(line.precio)} c/u</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => onUpdateQuantity(line.productoId, line.cantidad - 1, line.varianteId)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.cantidad}</span>
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => onUpdateQuantity(line.productoId, line.cantidad + 1, line.varianteId)}>
                <Plus className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground" onClick={() => onRemove(line.productoId, line.varianteId)}>
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
                  <p className="font-medium truncate">{item.nombre}{item.varianteNombre ? ` — ${item.varianteNombre}` : ""}</p>
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
