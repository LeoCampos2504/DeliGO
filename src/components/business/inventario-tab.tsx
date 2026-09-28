"use client"

// ============================================
// P2-T56-R1 — Inventario (generic-business stock tracking)
// ============================================
// Reuses the existing Producto CRUD authority (GET/POST/PUT
// /api/negocio/productos[/[id]]) extended with additive stock fields —
// there is no separate "Inventario product" model. Only
// POST /api/negocio/inventario/movimientos is new API surface here, kept
// narrow (stock adjustments only, always traced).

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Boxes,
  ChevronDown,
  History,
  Package,
  Plus,
  Search,
  Tags,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { cn, formatPrice } from "@/lib/utils"
import { computeStockStatus, UNIDADES_MEDIDA, validateProductoMinimo, type StockStatus } from "@/lib/inventario"
import { mergeManagedCategories } from "@/lib/category-normalization"
import { AdministrarCategoriasDialog } from "./administrar-categorias-dialog"

interface InventarioProducto {
  id: string
  nombre: string
  precio: number
  categoria: string
  imagenUrl: string | null
  stock: boolean
  eliminado: boolean
  sku: string | null
  codigoBarras: string | null
  costo: number | null
  marca: string | null
  unidadMedida: string
  controlStock: boolean
  stockCantidad: number
  stockMinimo: number
}

interface MovimientoInventario {
  id: string
  tipo: string
  cantidad: number
  stockAntes: number
  stockDespues: number
  motivo: string | null
  createdAt: string
}

const STOCK_STATUS_META: Record<StockStatus, { label: string; className: string }> = {
  NO_CONTROLADO: { label: "Sin control", className: "bg-muted text-muted-foreground" },
  SIN_STOCK: { label: "Sin stock", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  STOCK_BAJO: { label: "Stock bajo", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  EN_STOCK: { label: "En stock", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
}

export function InventarioTab({ negocio }: { negocio: { id: string } }) {
  const [search, setSearch] = useState("")
  const [categoria, setCategoria] = useState<string>("todas")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InventarioProducto | null>(null)
  const [detailProduct, setDetailProduct] = useState<InventarioProducto | null>(null)
  const [categoriasDialogOpen, setCategoriasDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: productos, isLoading } = useQuery<InventarioProducto[]>({
    queryKey: ["negocio-inventario-productos", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/productos")
      if (!res.ok) throw new Error("Error al obtener productos")
      return res.json()
    },
  })

  // P2-T56-R2B: managed category authority (Negocio.categorias), the SAME
  // source Caja's VenderView reads — see the R2B report §14 for why this
  // must never be a second, independent list.
  const { data: categoriasManaged = [] } = useQuery<string[]>({
    queryKey: ["negocio-categorias", negocio.id],
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
      return (
        p.nombre.toLowerCase().includes(term) ||
        (p.sku ?? "").toLowerCase().includes(term) ||
        (p.codigoBarras ?? "").toLowerCase().includes(term)
      )
    })
  }, [activos, search, categoria])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["negocio-inventario-productos", negocio.id] })
  }

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Cargando inventario…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o código…"
            className="pl-9 rounded-xl"
          />
        </div>
        <Button className="gap-1.5 rounded-xl shrink-0" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuevo producto</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {categorias.length > 1 && (
          <div className="flex flex-1 min-w-0 gap-1.5 overflow-x-auto scrollbar-none pb-1">
            <CategoryPill active={categoria === "todas"} label="Todas" onClick={() => setCategoria("todas")} />
            {categorias.map((c) => (
              <CategoryPill key={c} active={categoria === c} label={c} onClick={() => setCategoria(c)} />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setCategoriasDialogOpen(true)}
          className="shrink-0 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground py-1.5"
        >
          <Tags className="h-3.5 w-3.5" />
          Administrar categorías
        </button>
      </div>

      {activos.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-10 w-10 text-muted-foreground" />}
          title="No tenés productos cargados"
          description="Cargá tu primer producto para empezar a usar Inventario y Caja."
          cta="Agregar primer producto"
          onCta={() => { setEditing(null); setFormOpen(true) }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10 text-muted-foreground" />}
          title="No encontramos productos"
          description="Probá con otra búsqueda o categoría."
        />
      ) : (
        <>
          {/* Mobile: compact cards */}
          <div className="space-y-2 sm:hidden">
            {filtered.map((p) => (
              <ProductoCardMobile key={p.id} producto={p} onClick={() => setDetailProduct(p)} />
            ))}
          </div>
          {/* Desktop: dense table */}
          <div className="hidden sm:block rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Producto</th>
                  <th className="text-left font-semibold px-3 py-2">Categoría</th>
                  <th className="text-right font-semibold px-3 py-2">Precio</th>
                  <th className="text-right font-semibold px-3 py-2">Stock</th>
                  <th className="text-left font-semibold px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const status = computeStockStatus(p.controlStock, p.stockCantidad, p.stockMinimo)
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-border/60 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setDetailProduct(p)}
                    >
                      <td className="px-3 py-2 font-medium">{p.nombre}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.categoria}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(p.precio)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.controlStock ? `${p.stockCantidad} ${p.unidadMedida}` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={cn("border-0 text-[10px] font-semibold", STOCK_STATUS_META[status].className)}>
                          {STOCK_STATUS_META[status].label}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {formOpen && (
        <ProductoFormDialog
          producto={editing}
          categorias={categorias}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); invalidate() }}
        />
      )}

      {detailProduct && (
        <ProductoDetailDialog
          producto={detailProduct}
          onClose={() => setDetailProduct(null)}
          onEdit={() => { setEditing(detailProduct); setDetailProduct(null); setFormOpen(true) }}
          onChanged={invalidate}
        />
      )}

      {categoriasDialogOpen && (
        <AdministrarCategoriasDialog
          negocioId={negocio.id}
          productos={activos}
          onClose={() => setCategoriasDialogOpen(false)}
        />
      )}
    </div>
  )
}

function CategoryPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}

function EmptyState({
  icon,
  title,
  description,
  cta,
  onCta,
}: {
  icon: React.ReactNode
  title: string
  description: string
  cta?: string
  onCta?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
      {icon}
      <h3 className="font-bold text-base mt-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">{description}</p>
      {cta && onCta && (
        <Button className="mt-3 gap-2 rounded-xl" onClick={onCta}>
          <Plus className="h-4 w-4" />
          {cta}
        </Button>
      )}
    </div>
  )
}

function ProductoCardMobile({ producto, onClick }: { producto: InventarioProducto; onClick: () => void }) {
  const status = computeStockStatus(producto.controlStock, producto.stockCantidad, producto.stockMinimo)
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left"
    >
      <div className="h-12 w-12 shrink-0 rounded-xl bg-muted overflow-hidden flex items-center justify-center">
        {producto.imagenUrl ? (
          <img src={producto.imagenUrl} alt={producto.nombre} className="h-full w-full object-cover" />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{producto.nombre}</p>
        <p className="text-xs text-muted-foreground">{formatPrice(producto.precio)} · {producto.categoria}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {producto.controlStock && (
          <span className="text-[11px] tabular-nums text-muted-foreground">{producto.stockCantidad} {producto.unidadMedida}</span>
        )}
        <Badge className={cn("border-0 text-[9px] font-semibold", STOCK_STATUS_META[status].className)}>
          {STOCK_STATUS_META[status].label}
        </Badge>
      </div>
    </button>
  )
}

// ============================================
// Product form (create/edit) — MINIMUM_REQUIRED_FIRST (section 8)
// ============================================
function ProductoFormDialog({
  producto,
  categorias,
  onClose,
  onSaved,
}: {
  producto: InventarioProducto | null
  categorias: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = producto !== null
  const [nombre, setNombre] = useState(producto?.nombre ?? "")
  const [precio, setPrecio] = useState(producto ? String(producto.precio) : "")
  const [showAdvanced, setShowAdvanced] = useState(isEdit)
  const [categoria, setCategoria] = useState(producto?.categoria ?? "Sin Categoria")
  const [sku, setSku] = useState(producto?.sku ?? "")
  const [codigoBarras, setCodigoBarras] = useState(producto?.codigoBarras ?? "")
  const [costo, setCosto] = useState(producto?.costo != null ? String(producto.costo) : "")
  const [marca, setMarca] = useState(producto?.marca ?? "")
  const [unidadMedida, setUnidadMedida] = useState(producto?.unidadMedida ?? "unidad")
  const [controlStock, setControlStock] = useState(producto?.controlStock ?? false)
  const [stockInicial, setStockInicial] = useState(producto ? String(producto.stockCantidad) : "0")
  const [stockMinimo, setStockMinimo] = useState(producto ? String(producto.stockMinimo) : "0")
  const [imagenUrl, setImagenUrl] = useState(producto?.imagenUrl ?? "")

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedPrecio = Number(precio)
      const validation = validateProductoMinimo({ nombre, precio: parsedPrecio })
      if (!validation.ok) throw new Error(validation.error)

      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        precio: parsedPrecio,
        categoria: categoria || "Sin Categoria",
        imagenUrl: imagenUrl.trim() || null,
        sku: sku.trim() || null,
        codigoBarras: codigoBarras.trim() || null,
        costo: costo.trim() ? Number(costo) : null,
        marca: marca.trim() || null,
        unidadMedida,
        controlStock,
        stockMinimo: stockMinimo.trim() ? Number(stockMinimo) : 0,
      }
      if (!isEdit) body.stockCantidad = stockInicial.trim() ? Number(stockInicial) : 0

      const url = isEdit ? `/api/negocio/productos/${producto!.id}` : "/api/negocio/productos"
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al guardar el producto")
      return data
    },
    onSuccess: () => {
      toast.success(isEdit ? "Producto actualizado" : "Producto creado")
      onSaved()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-nombre">Nombre *</Label>
            <Input id="inv-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Coca Cola 2.25L" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-precio">Precio de venta *</Label>
            <Input id="inv-precio" type="number" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0.00" />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground py-1"
          >
            Detalles avanzados (opcional)
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-xl bg-muted/40 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-categoria">Categoría</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger id="inv-categoria" className="rounded-xl w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sin Categoria">Sin categoría</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-imagen">Imagen (URL)</Label>
                <Input id="inv-imagen" value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-sku">SKU / código interno</Label>
                  <Input id="inv-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-barras">Código de barras</Label>
                  <Input id="inv-barras" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-costo">Costo</Label>
                  <Input id="inv-costo" type="number" min={0} step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-marca">Marca</Label>
                  <Input id="inv-marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Controlar stock</p>
                  <p className="text-[11px] text-muted-foreground">Activá esto para llevar cantidad y alertas de stock bajo</p>
                </div>
                <Switch checked={controlStock} onCheckedChange={setControlStock} />
              </div>

              {controlStock && (
                <div className="grid grid-cols-2 gap-2">
                  {!isEdit && (
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-stock-inicial">Stock inicial</Label>
                      <Input id="inv-stock-inicial" type="number" min={0} step="0.01" value={stockInicial} onChange={(e) => setStockInicial(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-stock-minimo">Stock mínimo</Label>
                    <Input id="inv-stock-minimo" type="number" min={0} step="0.01" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-unidad">Unidad</Label>
                    <Select value={unidadMedida} onValueChange={setUnidadMedida}>
                      <SelectTrigger id="inv-unidad"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNIDADES_MEDIDA.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 rounded-xl" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Product detail — view + ajustar stock + activar/inactivar (section 13)
// ============================================
function ProductoDetailDialog({
  producto,
  onClose,
  onEdit,
  onChanged,
}: {
  producto: InventarioProducto
  onClose: () => void
  onEdit: () => void
  onChanged: () => void
}) {
  const [adjustOpen, setAdjustOpen] = useState(false)
  const status = computeStockStatus(producto.controlStock, producto.stockCantidad, producto.stockMinimo)

  const { data: movimientos } = useQuery<MovimientoInventario[]>({
    queryKey: ["negocio-inventario-movimientos", producto.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/inventario/movimientos?productoId=${producto.id}`)
      if (!res.ok) return []
      return res.json()
    },
  })

  const toggleActivoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/negocio/productos/${producto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eliminado: true }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error")
    },
    onSuccess: () => { toast.success("Producto inactivado"); onChanged(); onClose() },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {producto.imagenUrl && <img src={producto.imagenUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
            {producto.nombre}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <InfoRow label="Precio" value={formatPrice(producto.precio)} />
            {producto.costo != null && <InfoRow label="Costo" value={formatPrice(producto.costo)} />}
            <InfoRow label="Categoría" value={producto.categoria} />
            {producto.sku && <InfoRow label="SKU" value={producto.sku} />}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
            <div>
              <p className="text-xs text-muted-foreground">Stock</p>
              <p className="font-semibold">
                {producto.controlStock ? `${producto.stockCantidad} ${producto.unidadMedida} (mín. ${producto.stockMinimo})` : "Sin control de stock"}
              </p>
            </div>
            <Badge className={cn("border-0 text-[10px] font-semibold", STOCK_STATUS_META[status].className)}>
              {STOCK_STATUS_META[status].label}
            </Badge>
          </div>

          {movimientos && movimientos.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <History className="h-3.5 w-3.5" /> Actividad reciente
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {movimientos.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{m.tipo} · {m.cantidad}</span>
                    <span>{m.stockAntes} → {m.stockDespues}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onEdit}>Editar</Button>
            {producto.controlStock && (
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAdjustOpen(true)}>Ajustar stock</Button>
            )}
          </div>
          <Button
            variant="ghost"
            className="w-full rounded-xl text-destructive hover:text-destructive"
            onClick={() => toggleActivoMutation.mutate()}
            disabled={toggleActivoMutation.isPending}
          >
            Inactivar producto
          </Button>
        </div>
      </DialogContent>

      {adjustOpen && (
        <AjusteStockDialog producto={producto} onClose={() => setAdjustOpen(false)} onAdjusted={() => { setAdjustOpen(false); onChanged() }} />
      )}
    </Dialog>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function AjusteStockDialog({
  producto,
  onClose,
  onAdjusted,
}: {
  producto: InventarioProducto
  onClose: () => void
  onAdjusted: () => void
}) {
  const [tipo, setTipo] = useState<"ENTRADA" | "SALIDA" | "AJUSTE">("ENTRADA")
  const [cantidad, setCantidad] = useState("")
  const [motivo, setMotivo] = useState("")

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/negocio/inventario/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId: producto.id, tipo, cantidad: Number(cantidad), motivo: motivo.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al ajustar el stock")
      return data
    },
    onSuccess: () => { toast.success("Stock actualizado"); onAdjusted() },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs rounded-2xl">
        <DialogHeader><DialogTitle>Ajustar stock</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {(["ENTRADA", "SALIDA", "AJUSTE"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-semibold border",
                  tipo === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                )}
              >
                {t === "ENTRADA" ? "Entrada" : t === "SALIDA" ? "Salida" : "Ajuste"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ajuste-cantidad">{tipo === "AJUSTE" ? "Nuevo stock (recuento físico)" : "Cantidad"}</Label>
            <Input id="ajuste-cantidad" type="number" min={0} step="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ajuste-motivo">Motivo (opcional)</Label>
            <Input id="ajuste-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <Button className="w-full rounded-xl" onClick={() => mutation.mutate()} disabled={mutation.isPending || !cantidad}>
            {mutation.isPending ? "Guardando…" : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
