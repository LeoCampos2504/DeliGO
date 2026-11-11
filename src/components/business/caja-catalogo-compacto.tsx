"use client"

// ============================================
// «Gestionar venta» — compact product picker (search inside the same dialog)
// ============================================
// Lists the host's OWN catalog (owner or cashier endpoint, same data the
// selling view reads) and adds lines with the CURRENT catalog price for the
// screen only: the server always prices what comes in. Search by name, brand,
// SKU or code (same rule as Caja); Enter with an exact code adds it (a
// keyboard barcode reader types the code and Enter). Sellability follows
// Caja's physical-stock rule; the server re-checks stock and reservations.

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn, formatPrice } from "@/lib/utils"
import type { CartLine } from "@/lib/caja-venta"
import { matchesCajaSearch } from "@/lib/product-variant-search"
import { resolveScannedBarcode } from "@/lib/barcode"

export interface CatalogoFuente {
  productosUrl: string
  queryKey: readonly unknown[]
}

interface VarianteCatalogo {
  id: string
  nombre: string
  precio: number
  activo: boolean
  sku: string | null
  codigoBarras: string | null
  controlStock: boolean
  stockCantidad: number
}

interface ProductoCatalogo {
  id: string
  nombre: string
  precio: number
  eliminado: boolean
  marca: string | null
  sku: string | null
  codigoBarras: string | null
  controlStock: boolean
  stockCantidad: number
  variantes: VarianteCatalogo[]
}

const RESULTADOS_MAX = 8

function vendible(activo: boolean, controlStock: boolean, stockCantidad: number) {
  return activo && (!controlStock || stockCantidad > 0)
}

function textoStock(controlStock: boolean, stockCantidad: number) {
  if (!controlStock) return null
  return stockCantidad > 0 ? `stock ${stockCantidad}` : "sin stock"
}

export function CatalogoCompacto({ fuente, onAgregar, disabled }: { fuente: CatalogoFuente; onAgregar: (linea: CartLine) => void; disabled?: boolean }) {
  const [busqueda, setBusqueda] = useState("")
  const [aviso, setAviso] = useState<string | null>(null)
  const query = useQuery<ProductoCatalogo[]>({
    queryKey: fuente.queryKey,
    queryFn: async () => {
      const res = await fetch(fuente.productosUrl)
      if (!res.ok) throw new Error("No se pudo cargar el catálogo.")
      const json = await res.json()
      // owner: plain array · cashier: { productos } (same normalization as the selling view)
      return (Array.isArray(json) ? json : json.productos ?? []) as ProductoCatalogo[]
    },
  })
  const activos = useMemo(() => (query.data ?? []).filter((p) => !p.eliminado).map((p) => ({ ...p, variantes: p.variantes ?? [] })), [query.data])
  const termino = busqueda.trim()
  const resultados = useMemo(() => (termino ? activos.filter((p) => matchesCajaSearch(p, termino)).slice(0, RESULTADOS_MAX) : []), [activos, termino])

  // After adding, the search is cleared so the editor stays compact.
  function agregarProducto(p: ProductoCatalogo) {
    setAviso(null)
    setBusqueda("")
    onAgregar({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 })
  }
  function agregarVariante(p: ProductoCatalogo, v: VarianteCatalogo) {
    setAviso(null)
    setBusqueda("")
    onAgregar({ productoId: p.id, varianteId: v.id, nombre: p.nombre, varianteNombre: v.nombre, precio: v.precio, cantidad: 1 })
  }

  /** Enter: an exact code (scanner or typed) adds that article; otherwise nothing is guessed. */
  function porCodigo() {
    if (!termino) return
    const r = resolveScannedBarcode<VarianteCatalogo, ProductoCatalogo>(activos, termino)
    if (r.kind === "add_producto") { agregarProducto(r.producto); return }
    if (r.kind === "add_variante") { agregarVariante(r.producto, r.variante); return }
    if (r.kind === "unavailable") { setAviso(`${r.label}: no disponible (${r.reason === "sin_stock" ? "sin stock" : "inactivo"}).`); return }
    if (r.kind === "choose_variante") { setAviso(`Elegí la variante de ${r.producto.nombre}.`); return }
    if (r.kind === "ambiguous") { setAviso("Ese código corresponde a varios productos: elegilo de la lista."); return }
  }

  return (
    <div className="min-w-0 space-y-2" data-testid="catalogo-compacto">
      <label className="relative block min-w-0">
        <span className="sr-only">Buscar producto para agregar</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          disabled={disabled}
          onChange={(e) => { setBusqueda(e.target.value); setAviso(null) }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); porCodigo() } }}
          placeholder="Agregar producto: nombre, marca o código"
          aria-label="Buscar producto para agregar"
          className="h-10 w-full min-w-0 rounded-xl pl-9"
        />
      </label>
      {aviso && <p role="status" className="break-words text-xs text-amber-700 dark:text-amber-300">{aviso}</p>}
      {query.isError && <p role="alert" className="break-words text-xs text-destructive">No se pudo cargar el catálogo.</p>}
      {termino && query.isLoading && <p className="text-xs text-muted-foreground">Cargando catálogo…</p>}
      {termino && !query.isLoading && resultados.length === 0 && !query.isError && <p className="text-xs text-muted-foreground">No hay productos para «{termino}».</p>}
      {resultados.length > 0 && (
        <ul className="max-h-60 min-w-0 divide-y overflow-y-auto rounded-xl border" aria-label="Productos encontrados">
          {resultados.map((p) => {
            const variantes = p.variantes.filter((v) => v.activo)
            if (variantes.length === 0) {
              const ok = vendible(true, p.controlStock, p.stockCantidad)
              const stock = textoStock(p.controlStock, p.stockCantidad)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={disabled || !ok}
                    onClick={() => agregarProducto(p)}
                    aria-label={`Agregar ${p.nombre}`}
                    className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block break-words font-medium">{p.nombre}</span>
                      {stock && <span className={cn("block text-[11px]", ok ? "text-muted-foreground" : "text-destructive")}>{stock}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-semibold">{formatPrice(p.precio)}<Plus className="h-4 w-4 text-primary" /></span>
                  </button>
                </li>
              )
            }
            return (
              <li key={p.id} className="min-w-0 space-y-1.5 px-3 py-2">
                <p className="break-words text-sm font-medium">{p.nombre}</p>
                <div className="flex flex-wrap gap-1.5">
                  {variantes.map((v) => {
                    const ok = vendible(true, v.controlStock, v.stockCantidad)
                    const stock = textoStock(v.controlStock, v.stockCantidad)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={disabled || !ok}
                        onClick={() => agregarVariante(p, v)}
                        aria-label={`Agregar ${p.nombre} — ${v.nombre}`}
                        className="min-h-9 rounded-lg border px-2 py-1 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50"
                      >
                        {v.nombre} · {formatPrice(v.precio)}{stock ? <span className={cn("ml-1 font-normal", ok ? "text-muted-foreground" : "text-destructive")}>({stock})</span> : null}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
