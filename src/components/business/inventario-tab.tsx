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
  Pencil,
  Plus,
  Search,
  Tags,
  X,
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
import {
  computeStockStatus,
  summarizeVariantes,
  UNIDADES_MEDIDA,
  validateProductoMinimo,
  validateVarianteMinimo,
  type StockStatus,
} from "@/lib/inventario"
import { matchesCategoryFilter, mergeManagedCategories, SIN_CATEGORIA } from "@/lib/category-normalization"
import { AdministrarCategoriasDialog } from "./administrar-categorias-dialog"

// P2-T56-R2C: a product WITH >=1 variant keeps this shape too (nombre/
// categoria/imagenUrl etc. are still read from Producto), but its own
// precio/costo/controlStock/stockCantidad/stockMinimo become dormant for
// sale/stock purposes — see BASE_PRODUCT_WITHOUT_VARIANTS_BEHAVIOR /
// BASE_TO_VARIANTS_STOCK_BEHAVIOR in the R2C report.
interface InventarioVariante {
  id: string
  nombre: string
  precio: number
  costo: number | null
  sku: string | null
  codigoBarras: string | null
  controlStock: boolean
  stockCantidad: number
  stockMinimo: number
  activo: boolean
}

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
  variantes: InventarioVariante[]
}

interface MovimientoInventario {
  id: string
  productoVarianteId: string | null
  tipo: string
  cantidad: number
  stockAntes: number
  stockDespues: number
  motivo: string | null
  createdAt: string
}

// P2-T56-R2C: local draft shape for an unsaved variant row in
// ProductoFormDialog's inline creation editor (section 12) — never sent
// as-is, always parsed/validated into the API's plain numeric shape first.
interface VarianteDraftRow {
  key: string
  nombre: string
  precio: string
  costo: string
  sku: string
  codigoBarras: string
  controlStock: boolean
  stockCantidad: string
  stockMinimo: string
  showMore: boolean
}

function emptyVarianteDraftRow(): VarianteDraftRow {
  return {
    key: Math.random().toString(36).slice(2),
    nombre: "",
    precio: "",
    costo: "",
    sku: "",
    codigoBarras: "",
    controlStock: false,
    stockCantidad: "0",
    stockMinimo: "0",
    showMore: false,
  }
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

  // P2-T56-R2B-F1: "Sin Categoria" is deliberately excluded from
  // mergeManagedCategories (it's a fallback, not a managed category), so it
  // needs its own conditional pill — only shown when at least one product
  // is actually uncategorized (section 7).
  const hasSinCategoria = useMemo(
    () => activos.some((p) => matchesCategoryFilter(p.categoria, SIN_CATEGORIA)),
    [activos]
  )

  // P2-T56-R2B-F1: if the selected filter's category was renamed or deleted
  // out from under it (e.g. via AdministrarCategoriasDialog), derive the
  // fallback to "todas" during render instead of a setState-in-effect
  // (React's own recommended pattern — https://react.dev/learn/you-might-not-need-an-effect —
  // avoids an extra cascading render). `categoria` itself is left
  // untouched; only the EFFECTIVE value used for filtering/highlighting
  // falls back (section 11).
  const effectiveCategoria = useMemo(() => {
    if (categoria === "todas") return "todas"
    const stillValid =
      categorias.some((c) => matchesCategoryFilter(c, categoria)) ||
      (hasSinCategoria && matchesCategoryFilter(categoria, SIN_CATEGORIA))
    return stillValid ? categoria : "todas"
  }, [categoria, categorias, hasSinCategoria])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return activos.filter((p) => {
      if (effectiveCategoria !== "todas" && !matchesCategoryFilter(p.categoria, effectiveCategoria)) return false
      if (!term) return true
      return (
        p.nombre.toLowerCase().includes(term) ||
        (p.sku ?? "").toLowerCase().includes(term) ||
        (p.codigoBarras ?? "").toLowerCase().includes(term)
      )
    })
  }, [activos, search, effectiveCategoria])

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
        {categorias.length + (hasSinCategoria ? 1 : 0) > 1 && (
          <div className="flex flex-1 min-w-0 gap-1.5 overflow-x-auto scrollbar-none pb-1">
            <CategoryPill active={effectiveCategoria === "todas"} label="Todas" onClick={() => setCategoria("todas")} />
            {categorias.map((c) => (
              <CategoryPill key={c} active={matchesCategoryFilter(effectiveCategoria, c)} label={c} onClick={() => setCategoria(c)} />
            ))}
            {hasSinCategoria && (
              <CategoryPill
                active={effectiveCategoria !== "todas" && matchesCategoryFilter(effectiveCategoria, SIN_CATEGORIA)}
                label="Sin categoría"
                onClick={() => setCategoria(SIN_CATEGORIA)}
              />
            )}
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
        // P2-T56-R2B-F1 §14: a managed category with zero products is a
        // valid, real state (it can exist before any product is assigned
        // to it) — distinguish that from "no search match" instead of
        // showing the same generic message for both.
        effectiveCategoria !== "todas" && !search.trim() ? (
          <EmptyState
            icon={<Search className="h-10 w-10 text-muted-foreground" />}
            title="No hay productos en esta categoría"
            description="Cargá un producto en esta categoría o elegí otra."
          />
        ) : (
          <EmptyState
            icon={<Search className="h-10 w-10 text-muted-foreground" />}
            title="No encontramos productos"
            description="Probá con otra búsqueda o categoría."
          />
        )
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
                  // P2-T56-R2C §15: a product WITH variants collapses into
                  // ONE row here — never one row per variant. Its own
                  // precio/stock columns are replaced by a summary; opening
                  // the row is the only way to see/manage each variant.
                  if (p.variantes.length > 0) {
                    const resumen = summarizeVariantes(p.variantes)
                    return (
                      <tr key={p.id} className="border-t border-border/60 hover:bg-muted/30 cursor-pointer" onClick={() => setDetailProduct(p)}>
                        <td className="px-3 py-2 font-medium">
                          {p.nombre}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{resumen.cantidadActivas} variante{resumen.cantidadActivas === 1 ? "" : "s"}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{p.categoria}</td>
                        <td className="px-3 py-2 text-right">{resumen.precioDesde != null ? `Desde ${formatPrice(resumen.precioDesde)}` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{resumen.stockTotal != null ? `Total ${resumen.stockTotal}` : "—"}</td>
                        <td className="px-3 py-2">
                          {resumen.cantidadActivas === 0 ? (
                            <Badge className="border-0 text-[10px] font-semibold bg-muted text-muted-foreground">Sin variantes activas</Badge>
                          ) : resumen.todasSinStock ? (
                            <Badge className="border-0 text-[10px] font-semibold bg-red-500/15 text-red-700 dark:text-red-400">Sin stock</Badge>
                          ) : resumen.variantesConStockBajo > 0 ? (
                            <Badge className="border-0 text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                              {resumen.variantesConStockBajo} variante{resumen.variantesConStockBajo === 1 ? "" : "s"} con stock bajo
                            </Badge>
                          ) : (
                            <Badge className="border-0 text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">En stock</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  }
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
  if (producto.variantes.length > 0) {
    const resumen = summarizeVariantes(producto.variantes)
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
          <p className="text-xs text-muted-foreground">
            {resumen.cantidadActivas} variante{resumen.cantidadActivas === 1 ? "" : "s"}
            {resumen.precioDesde != null ? ` · Desde ${formatPrice(resumen.precioDesde)}` : ""}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {resumen.stockTotal != null && (
            <span className="text-[11px] tabular-nums text-muted-foreground">Total {resumen.stockTotal}</span>
          )}
          {resumen.cantidadActivas === 0 ? (
            <Badge className="border-0 text-[9px] font-semibold bg-muted text-muted-foreground">Sin variantes activas</Badge>
          ) : resumen.todasSinStock ? (
            <Badge className="border-0 text-[9px] font-semibold bg-red-500/15 text-red-700 dark:text-red-400">Sin stock</Badge>
          ) : resumen.variantesConStockBajo > 0 ? (
            <Badge className="border-0 text-[9px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">{resumen.variantesConStockBajo} con stock bajo</Badge>
          ) : (
            <Badge className="border-0 text-[9px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">En stock</Badge>
          )}
        </div>
      </button>
    )
  }

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
  const productoHasVariantes = isEdit && producto.variantes.length > 0
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

  // P2-T56-R2C §11/12: inline variant creation exists ONLY for a brand new
  // product — managing variants on an EXISTING product happens exclusively
  // through ProductoDetailDialog's own "+ Agregar variante" (section 13),
  // to avoid two competing places that both claim to create variants.
  const [hasVariantes, setHasVariantes] = useState(false)
  const [variantRows, setVariantRows] = useState<VarianteDraftRow[]>([])

  function addVariantRow() {
    setVariantRows((rows) => [...rows, emptyVarianteDraftRow()])
  }
  function updateVariantRow(key: string, patch: Partial<VarianteDraftRow>) {
    setVariantRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function removeVariantRow(key: string) {
    setVariantRows((rows) => rows.filter((r) => r.key !== key))
  }
  function toggleHasVariantes(checked: boolean) {
    setHasVariantes(checked)
    if (checked && variantRows.length === 0) addVariantRow()
  }

  const mutation = useMutation({
    mutationFn: async () => {
      // A product opted into variants can leave the base precio blank —
      // it's a dormant DB column once variants exist (section 6), so we
      // fall back to the first variant's own precio rather than force a
      // second, redundant entry of the same number (section 10 spirit).
      let parsedPrecio = Number(precio)
      if (hasVariantes && (!precio.trim() || !(parsedPrecio > 0)) && variantRows.length > 0) {
        parsedPrecio = Number(variantRows[0].precio)
      }
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

      if (!isEdit && hasVariantes) {
        if (variantRows.length === 0) throw new Error("Agregá al menos una variante")
        const variantes: Array<{
          nombre: string; precio: number; costo: number | null; sku: string | null
          codigoBarras: string | null; controlStock: boolean; stockCantidad: number; stockMinimo: number
        }> = []
        for (const row of variantRows) {
          const rowPrecio = Number(row.precio)
          const rowValidation = validateVarianteMinimo({ nombre: row.nombre, precio: rowPrecio })
          if (!rowValidation.ok) throw new Error(rowValidation.error)
          variantes.push({
            nombre: row.nombre.trim(),
            precio: rowPrecio,
            costo: row.costo.trim() ? Number(row.costo) : null,
            sku: row.sku.trim() || null,
            codigoBarras: row.codigoBarras.trim() || null,
            controlStock: row.controlStock,
            stockCantidad: row.stockCantidad.trim() ? Number(row.stockCantidad) : 0,
            stockMinimo: row.stockMinimo.trim() ? Number(row.stockMinimo) : 0,
          })
        }
        body.variantes = variantes
      }

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

          {isEdit ? (
            productoHasVariantes && (
              <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Este producto usa variantes. El precio y el stock de acá no se usan para la venta — gestionalos desde "Variantes" en el detalle del producto.
              </p>
            )
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Este producto tiene variantes</p>
                <p className="text-[11px] text-muted-foreground">Ej: Coca Cola en 500 ml, 1,5 L, 2,25 L — cada una con su propio precio y stock</p>
              </div>
              <Switch checked={hasVariantes} onCheckedChange={toggleHasVariantes} />
            </div>
          )}

          {!isEdit && hasVariantes && (
            <div className="space-y-2">
              <Label>Variantes</Label>
              {variantRows.map((row) => (
                <VarianteDraftRowEditor
                  key={row.key}
                  row={row}
                  onChange={(patch) => updateVariantRow(row.key, patch)}
                  onRemove={() => removeVariantRow(row.key)}
                />
              ))}
              <Button type="button" variant="outline" className="w-full gap-1.5 rounded-xl" onClick={addVariantRow}>
                <Plus className="h-4 w-4" />
                Agregar variante
              </Button>
            </div>
          )}

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

              {!productoHasVariantes && !hasVariantes && (
                <>
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
                </>
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

function VarianteDraftRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: VarianteDraftRow
  onChange: (patch: Partial<VarianteDraftRow>) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <Input value={row.nombre} onChange={(e) => onChange({ nombre: e.target.value })} placeholder="Nombre (ej: 500 ml)" className="rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" min={0} step="0.01" value={row.precio} onChange={(e) => onChange({ precio: e.target.value })} placeholder="Precio" className="rounded-lg" />
            <Input type="number" min={0} step="0.01" value={row.costo} onChange={(e) => onChange({ costo: e.target.value })} placeholder="Costo (opcional)" className="rounded-lg" />
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <button
        type="button"
        onClick={() => onChange({ showMore: !row.showMore })}
        className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
      >
        Más opciones
        <ChevronDown className={cn("h-3 w-3 transition-transform", row.showMore && "rotate-180")} />
      </button>

      {row.showMore && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={row.sku} onChange={(e) => onChange({ sku: e.target.value })} placeholder="SKU" className="rounded-lg" />
            <Input value={row.codigoBarras} onChange={(e) => onChange({ codigoBarras: e.target.value })} placeholder="Código de barras" className="rounded-lg" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5">
            <p className="text-xs font-medium">Controlar stock</p>
            <Switch checked={row.controlStock} onCheckedChange={(v) => onChange({ controlStock: v })} />
          </div>
          {row.controlStock && (
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min={0} step="0.01" value={row.stockCantidad} onChange={(e) => onChange({ stockCantidad: e.target.value })} placeholder="Stock inicial" className="rounded-lg" />
              <Input type="number" min={0} step="0.01" value={row.stockMinimo} onChange={(e) => onChange({ stockMinimo: e.target.value })} placeholder="Stock mínimo" className="rounded-lg" />
            </div>
          )}
        </div>
      )}
    </div>
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
  const [adjustVariante, setAdjustVariante] = useState<InventarioVariante | null>(null)
  const [varianteForm, setVarianteForm] = useState<{ mode: "create" } | { mode: "edit"; variante: InventarioVariante } | null>(null)
  const status = computeStockStatus(producto.controlStock, producto.stockCantidad, producto.stockMinimo)
  const hasVariantes = producto.variantes.length > 0
  const varianteNombreById = useMemo(() => new Map(producto.variantes.map((v) => [v.id, v.nombre])), [producto.variantes])

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

  const toggleVarianteActivoMutation = useMutation({
    mutationFn: async (variante: InventarioVariante) => {
      const res = await fetch(`/api/negocio/productos/${producto.id}/variantes/${variante.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !variante.activo }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Error")
    },
    onSuccess: () => { toast.success("Variante actualizada"); onChanged() },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {producto.imagenUrl && <img src={producto.imagenUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />}
            {producto.nombre}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {!hasVariantes && <InfoRow label="Precio" value={formatPrice(producto.precio)} />}
            {!hasVariantes && producto.costo != null && <InfoRow label="Costo" value={formatPrice(producto.costo)} />}
            <InfoRow label="Categoría" value={producto.categoria} />
            {!hasVariantes && producto.sku && <InfoRow label="SKU" value={producto.sku} />}
          </div>

          {!hasVariantes && (
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
          )}

          {/* P2-T56-R2C §13: variants are managed here, in the product's own
              detail — never a second product row in the main listing. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Variantes {hasVariantes ? `(${producto.variantes.length})` : ""}</p>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 rounded-lg text-xs" onClick={() => setVarianteForm({ mode: "create" })}>
                <Plus className="h-3.5 w-3.5" /> Agregar variante
              </Button>
            </div>
            {producto.variantes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Este producto no tiene variantes.</p>
            ) : (
              <div className="space-y-1.5">
                {producto.variantes.map((v) => {
                  const vStatus = computeStockStatus(v.controlStock, v.stockCantidad, v.stockMinimo)
                  return (
                    <div key={v.id} className={cn("flex items-center gap-2 rounded-xl border border-border px-3 py-2", !v.activo && "opacity-50")}>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setVarianteForm({ mode: "edit", variante: v })}>
                        <p className="text-sm font-medium truncate">{v.nombre}{!v.activo && " (inactiva)"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(v.precio)}
                          {v.controlStock ? ` · ${v.stockCantidad} ${v.stockCantidad === 1 ? "unidad" : "unidades"}` : ""}
                        </p>
                      </button>
                      {v.controlStock && (
                        <Badge className={cn("border-0 text-[9px] font-semibold shrink-0", STOCK_STATUS_META[vStatus].className)}>
                          {STOCK_STATUS_META[vStatus].label}
                        </Badge>
                      )}
                      {v.controlStock && v.activo && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 rounded-lg text-xs" onClick={() => setAdjustVariante(v)}>
                          Ajustar
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 rounded-lg p-0 text-destructive hover:text-destructive"
                        onClick={() => toggleVarianteActivoMutation.mutate(v)}
                        disabled={toggleVarianteActivoMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {movimientos && movimientos.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                <History className="h-3.5 w-3.5" /> Actividad reciente
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {movimientos.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{m.tipo} · {m.cantidad}{m.productoVarianteId ? ` · ${varianteNombreById.get(m.productoVarianteId) ?? "variante"}` : ""}</span>
                    <span>{m.stockAntes} → {m.stockDespues}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onEdit}>Editar</Button>
            {!hasVariantes && producto.controlStock && (
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
      {adjustVariante && (
        <AjusteStockDialog
          producto={producto}
          variante={adjustVariante}
          onClose={() => setAdjustVariante(null)}
          onAdjusted={() => { setAdjustVariante(null); onChanged() }}
        />
      )}
      {varianteForm && (
        <VarianteFormDialog
          productoId={producto.id}
          variante={varianteForm.mode === "edit" ? varianteForm.variante : null}
          onClose={() => setVarianteForm(null)}
          onSaved={() => { setVarianteForm(null); onChanged() }}
        />
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
  variante,
  onClose,
  onAdjusted,
}: {
  producto: InventarioProducto
  // P2-T56-R2C §25: when present, the adjustment targets THIS variant's own
  // stock — never a fictitious product-level "total".
  variante?: InventarioVariante
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
        body: JSON.stringify({
          productoId: producto.id,
          productoVarianteId: variante?.id,
          tipo,
          cantidad: Number(cantidad),
          motivo: motivo.trim() || undefined,
        }),
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
        <DialogHeader><DialogTitle>{variante ? `Ajustar stock — ${variante.nombre}` : "Ajustar stock"}</DialogTitle></DialogHeader>
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

// ============================================
// Variant create/edit (P2-T56-R2C section 13) — stockCantidad is only
// accepted on CREATE (mirrors ProductoFormDialog); editing an existing
// variant's stock always goes through AjusteStockDialog so every change
// stays traced (section 25).
// ============================================
function VarianteFormDialog({
  productoId,
  variante,
  onClose,
  onSaved,
}: {
  productoId: string
  variante: InventarioVariante | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = variante !== null
  const [nombre, setNombre] = useState(variante?.nombre ?? "")
  const [precio, setPrecio] = useState(variante ? String(variante.precio) : "")
  const [costo, setCosto] = useState(variante?.costo != null ? String(variante.costo) : "")
  const [sku, setSku] = useState(variante?.sku ?? "")
  const [codigoBarras, setCodigoBarras] = useState(variante?.codigoBarras ?? "")
  const [controlStock, setControlStock] = useState(variante?.controlStock ?? false)
  const [stockInicial, setStockInicial] = useState(variante ? String(variante.stockCantidad) : "0")
  const [stockMinimo, setStockMinimo] = useState(variante ? String(variante.stockMinimo) : "0")

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedPrecio = Number(precio)
      const validation = validateVarianteMinimo({ nombre, precio: parsedPrecio })
      if (!validation.ok) throw new Error(validation.error)

      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        precio: parsedPrecio,
        costo: costo.trim() ? Number(costo) : null,
        sku: sku.trim() || null,
        codigoBarras: codigoBarras.trim() || null,
        controlStock,
        stockMinimo: stockMinimo.trim() ? Number(stockMinimo) : 0,
      }
      if (!isEdit) body.stockCantidad = stockInicial.trim() ? Number(stockInicial) : 0

      const url = isEdit
        ? `/api/negocio/productos/${productoId}/variantes/${variante!.id}`
        : `/api/negocio/productos/${productoId}/variantes`
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al guardar la variante")
      return data
    },
    onSuccess: () => {
      toast.success(isEdit ? "Variante actualizada" : "Variante creada")
      onSaved()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar variante" : "Nueva variante"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="var-nombre">Nombre *</Label>
            <Input id="var-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: 500 ml" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="var-precio">Precio *</Label>
              <Input id="var-precio" type="number" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="var-costo">Costo</Label>
              <Input id="var-costo" type="number" min={0} step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="var-sku">SKU</Label>
              <Input id="var-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="var-barras">Código de barras</Label>
              <Input id="var-barras" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-sm font-medium">Controlar stock</p>
            <Switch checked={controlStock} onCheckedChange={setControlStock} />
          </div>
          {controlStock && (
            <div className="grid grid-cols-2 gap-2">
              {!isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="var-stock-inicial">Stock inicial</Label>
                  <Input id="var-stock-inicial" type="number" min={0} step="0.01" value={stockInicial} onChange={(e) => setStockInicial(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="var-stock-minimo">Stock mínimo</Label>
                <Input id="var-stock-minimo" type="number" min={0} step="0.01" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 rounded-xl" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear variante"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
