"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Edit3, Trash2, X, Check, Layers, ArrowUp, ArrowDown, LayoutGrid, List, Search, PackageOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface SeccionesSectionProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
}

interface SeccionProducto {
  id: string
  seccionId: string
  productoId: string
  orden: number
  producto: {
    id: string
    nombre: string
    imagenUrl: string | null
    precio: number
    categoria: string
  }
}

interface Seccion {
  id: string
  nombre: string
  orientacion: string
  orden: number
  color: string
  negocioId: string
  productos: SeccionProducto[]
}

interface Producto {
  id: string
  nombre: string
  precio: number
  categoria: string
  imagenUrl: string | null
  stock: boolean
}

interface SeccionFormData {
  nombre: string
  orientacion: string
  color: string
  orden: number
  productoIds: string[]
}

const defaultFormData: SeccionFormData = {
  nombre: "",
  orientacion: "vertical",
  color: "",
  orden: 0,
  productoIds: [],
}

// ============================================
// Main Component
// ============================================
export function SeccionesSection({ negocio }: SeccionesSectionProps) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingSeccion, setEditingSeccion] = useState<Seccion | null>(null)
  const [formData, setFormData] = useState<SeccionFormData>(defaultFormData)
  const [deleteDialog, setDeleteDialog] = useState<Seccion | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  // Fetch secciones
  const { data: secciones = [], isLoading } = useQuery<Seccion[]>({
    queryKey: ["negocio-secciones", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/secciones?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando secciones")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Fetch products (to assign to sections)
  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["negocio-productos", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/productos?negocioId=${negocio.id}`)
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Sorted secciones by orden
  const sortedSecciones = [...secciones].sort((a, b) => a.orden - b.orden)

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: SeccionFormData & { id?: string }) => {
      const url = data.id
        ? `/api/negocio/secciones/${data.id}`
        : `/api/negocio/secciones`
      const method = data.id ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, negocioId: negocio.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error guardando sección")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-secciones", negocio.id] })
      toast.success("Sección guardada correctamente")
      closeForm()
    },
    onError: (err) => {
      toast.error(err.message || "Error al guardar la sección")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/secciones/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando sección")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-secciones", negocio.id] })
      toast.success("Sección eliminada. Los productos no fueron afectados.")
      setDeleteDialog(null)
    },
    onError: () => {
      toast.error("Error al eliminar la sección")
    },
  })

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async ({ id, orden }: { id: string; orden: number }) => {
      const res = await fetch(`/api/negocio/secciones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orden }),
      })
      if (!res.ok) throw new Error("Error reordenando sección")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-secciones", negocio.id] })
      setReorderingId(null)
    },
    onError: () => {
      toast.error("Error al reordenar las secciones")
      setReorderingId(null)
    },
  })

  // Form handlers
  const openNewForm = () => {
    setEditingSeccion(null)
    setFormData({
      ...defaultFormData,
      orden: sortedSecciones.length,
      productoIds: [],
    })
    setFormOpen(true)
  }

  const openEditForm = (seccion: Seccion) => {
    setEditingSeccion(seccion)
    setFormData({
      nombre: seccion.nombre,
      orientacion: seccion.orientacion,
      color: seccion.color,
      orden: seccion.orden,
      productoIds: seccion.productos?.map((sp) => sp.productoId) ?? [],
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingSeccion(null)
    setFormData(defaultFormData)
  }

  const handleSave = () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    saveMutation.mutate({ ...formData, id: editingSeccion?.id })
  }

  const toggleProductInSeccion = (productoId: string) => {
    setFormData((prev) => ({
      ...prev,
      productoIds: prev.productoIds.includes(productoId)
        ? prev.productoIds.filter((id) => id !== productoId)
        : [...prev.productoIds, productoId],
    }))
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const current = sortedSecciones[index]
    const above = sortedSecciones[index - 1]
    setReorderingId(current.id)
    reorderMutation.mutate({ id: current.id, orden: above.orden })
    fetch(`/api/negocio/secciones/${above.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orden: current.orden }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["negocio-secciones", negocio.id] })
    })
  }

  const handleMoveDown = (index: number) => {
    if (index === sortedSecciones.length - 1) return
    const current = sortedSecciones[index]
    const below = sortedSecciones[index + 1]
    setReorderingId(current.id)
    reorderMutation.mutate({ id: current.id, orden: below.orden })
    fetch(`/api/negocio/secciones/${below.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orden: current.orden }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["negocio-secciones", negocio.id] })
    })
  }

  return (
    <div className="space-y-4">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${negocio.colorPrincipal}15` }}
          >
            <Layers
              className="h-4 w-4"
              style={{ color: negocio.colorPrincipal }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Secciones del catálogo</h3>
            <p className="text-xs text-muted-foreground">
              Organiza tus productos en secciones visibles
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="rounded-xl gap-1.5 font-semibold h-9"
          style={{ backgroundColor: negocio.colorPrincipal }}
          onClick={openNewForm}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>

      {/* ===== SECCIONES LIST ===== */}
      {isLoading ? (
        <SeccionesSkeleton />
      ) : sortedSecciones.length === 0 ? (
        <EmptySecciones onAdd={openNewForm} colorPrincipal={negocio.colorPrincipal} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {sortedSecciones.map((seccion, index) => (
              <SeccionCard
                key={seccion.id}
                seccion={seccion}
                index={index}
                total={sortedSecciones.length}
                colorPrincipal={negocio.colorPrincipal}
                isReordering={reorderingId === seccion.id}
                onEdit={() => openEditForm(seccion)}
                onDelete={() => setDeleteDialog(seccion)}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ===== ADD/EDIT DRAWER ===== */}
      <Drawer open={formOpen} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              {editingSeccion ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  Editar sección
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Nueva sección
                </>
              )}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Nombre */}
              <div>
                <Label htmlFor="sec-nombre" className="text-sm font-semibold mb-1.5 block">
                  Nombre de la sección *
                </Label>
                <Input
                  id="sec-nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Promociones, Bebidas, Destacados..."
                  className="rounded-xl"
                />
              </div>

              {/* Orientación */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Orientación en el catálogo
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, orientacion: "vertical" }))}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      formData.orientacion === "vertical"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/50 bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <LayoutGrid
                      className={cn(
                        "h-6 w-6",
                        formData.orientacion === "vertical"
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <div className="text-center">
                      <p className={cn(
                        "text-sm font-semibold",
                        formData.orientacion === "vertical" ? "text-primary" : "text-foreground"
                      )}>
                        Vertical
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Productos en grilla
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, orientacion: "horizontal" }))}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      formData.orientacion === "horizontal"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/50 bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <List
                      className={cn(
                        "h-6 w-6",
                        formData.orientacion === "horizontal"
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <div className="text-center">
                      <p className={cn(
                        "text-sm font-semibold",
                        formData.orientacion === "horizontal" ? "text-primary" : "text-foreground"
                      )}>
                        Horizontal
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Productos en fila
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Color */}
              <div>
                <Label className="text-sm font-semibold mb-1.5 block">
                  Color de la sección
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.color || negocio.colorPrincipal}
                    onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                    className="w-10 h-10 rounded-xl border border-border cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                    className="rounded-xl max-w-[140px]"
                    placeholder="#FF6B00"
                    maxLength={7}
                  />
                  {formData.color && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full shrink-0"
                      onClick={() => setFormData((p) => ({ ...p, color: "" }))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <div
                    className="w-8 h-8 rounded-full shrink-0 border ml-auto"
                    style={{ backgroundColor: formData.color || negocio.colorPrincipal }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Color identificatorio. Se usa en el título de la sección en el catálogo.
                </p>
              </div>

              {/* ===== PRODUCT PICKER ===== */}
              <div>
                <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <PackageOpen className="h-3.5 w-3.5" />
                  Productos en esta sección
                </Label>

                {/* Selected products count */}
                {formData.productoIds.length > 0 && (
                  <div className="mb-2 flex items-center gap-1.5">
                    <Badge
                      className="text-xs font-semibold border-0"
                      style={{ backgroundColor: `${negocio.colorPrincipal}18`, color: negocio.colorPrincipal }}
                    >
                      {formData.productoIds.length} {formData.productoIds.length === 1 ? "producto" : "productos"}
                    </Badge>
                    <button
                      onClick={() => setFormData((p) => ({ ...p, productoIds: [] }))}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Quitar todos
                    </button>
                  </div>
                )}

                {productos.length === 0 ? (
                  <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border/50 text-center">
                    <p className="text-xs text-muted-foreground">
                      No tenés productos creados aún.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Primero creá productos y después asignalos a secciones.
                    </p>
                  </div>
                ) : (
                  <ProductPicker
                    productos={productos}
                    selectedIds={formData.productoIds}
                    onToggle={toggleProductInSeccion}
                    colorPrincipal={negocio.colorPrincipal}
                  />
                )}
              </div>
            </motion.div>
          </div>

          <DrawerFooter className="border-t pt-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={closeForm}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 rounded-xl gap-1.5 font-semibold"
                style={{ backgroundColor: negocio.colorPrincipal }}
                onClick={handleSave}
                disabled={saveMutation.isPending || !formData.nombre.trim()}
              >
                {saveMutation.isPending ? (
                  "Guardando..."
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {editingSeccion ? "Guardar cambios" : "Crear sección"}
                  </>
                )}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ===== DELETE CONFIRMATION ===== */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="rounded-2xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Eliminar sección
            </DialogTitle>
            <DialogDescription>
              ¿Eliminás <strong>{deleteDialog?.nombre}</strong>? Los productos que
              pertenecen a esta sección no serán eliminados, solo se quitará la
              agrupación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeleteDialog(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Product Picker (organized by category)
// ============================================
function ProductPicker({
  productos,
  selectedIds,
  onToggle,
  colorPrincipal,
}: {
  productos: Producto[]
  selectedIds: string[]
  onToggle: (id: string) => void
  colorPrincipal: string
}) {
  const [search, setSearch] = useState("")
  const [manualExpandedCats, setManualExpandedCats] = useState<Set<string>>(new Set())

  // Group products by category
  const productsByCategory = useMemo(() => {
    const map = new Map<string, Producto[]>()
    let filtered = productos

    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = productos.filter((p) => p.nombre.toLowerCase().includes(q))
    }

    for (const p of filtered) {
      const cat = p.categoria || "Sin categoría"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(p)
    }
    return map
  }, [productos, search])

  const categories = Array.from(productsByCategory.keys())

  // Auto-expand categories that have selected products - derive during render
  const autoExpandedCats = useMemo(() => {
    const result = new Set<string>()
    for (const [cat, prods] of productsByCategory) {
      if (prods.some((p) => selectedIds.includes(p.id))) {
        result.add(cat)
      }
    }
    return result
  }, [productsByCategory, selectedIds])

  // Merge auto-expanded with manually toggled
  const expandedCats = useMemo(() => {
    const merged = new Set(autoExpandedCats)
    for (const cat of manualExpandedCats) {
      merged.add(cat)
    }
    return merged
  }, [autoExpandedCats, manualExpandedCats])

  const toggleCat = (cat: string) => {
    setManualExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const selectAllInCategory = (cat: string) => {
    const prods = productsByCategory.get(cat) ?? []
    const allSelected = prods.every((p) => selectedIds.includes(p.id))
    for (const p of prods) {
      if (allSelected) {
        // Deselect all in category
        if (selectedIds.includes(p.id)) onToggle(p.id)
      } else {
        // Select all in category
        if (!selectedIds.includes(p.id)) onToggle(p.id)
      }
    }
  }

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="pl-9 h-9 rounded-xl text-sm bg-muted/50 border-border/50"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Categories with products */}
      <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
        {categories.map((cat) => {
          const prods = productsByCategory.get(cat) ?? []
          const selectedInCat = prods.filter((p) => selectedIds.includes(p.id)).length
          const isExpanded = expandedCats.has(cat)

          return (
            <div key={cat} className="rounded-xl border border-border/40 overflow-hidden">
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
              >
                <ChevronIcon
                  className={cn(
                    "h-3.5 w-3.5 transition-transform shrink-0",
                    isExpanded && "rotate-90"
                  )}
                />
                <span className="text-xs font-semibold flex-1 truncate">{cat}</span>
                <span className="text-[10px] text-muted-foreground">
                  {selectedInCat}/{prods.length}
                </span>
                {selectedInCat > 0 && (
                  <Badge
                    className="text-[9px] px-1.5 py-0 border-0 shrink-0"
                    style={{ backgroundColor: `${colorPrincipal}18`, color: colorPrincipal }}
                  >
                    {selectedInCat}
                  </Badge>
                )}
              </button>

              {/* Products in category */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    {/* Select all row */}
                    <div className="px-3 pt-1.5 pb-0.5">
                      <button
                        type="button"
                        onClick={() => selectAllInCategory(cat)}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {selectedInCat === prods.length ? "Quitar todos" : "Seleccionar todos"}
                      </button>
                    </div>

                    <div className="px-2 pb-2 space-y-0.5">
                      {prods.map((p) => {
                        const isSelected = selectedIds.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onToggle(p.id)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-left",
                              isSelected
                                ? "bg-primary/8 border border-primary/20"
                                : "hover:bg-muted/50 border border-transparent"
                            )}
                            style={isSelected ? {
                              backgroundColor: `${colorPrincipal}08`,
                              borderColor: `${colorPrincipal}30`,
                            } : undefined}
                          >
                            {/* Checkbox */}
                            <div
                              className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                                isSelected
                                  ? "border-primary bg-primary"
                                  : "border-border"
                              )}
                              style={isSelected ? {
                                backgroundColor: colorPrincipal,
                                borderColor: colorPrincipal,
                              } : undefined}
                            >
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>

                            {/* Mini image */}
                            <div
                              className="w-7 h-7 rounded-md overflow-hidden bg-muted/60 shrink-0 flex items-center justify-center"
                              style={!p.imagenUrl ? { backgroundColor: `${colorPrincipal}10` } : undefined}
                            >
                              {p.imagenUrl ? (
                                <img src={p.imagenUrl} alt={p.nombre} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[9px] font-bold" style={{ color: colorPrincipal }}>
                                  {p.nombre.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Name & price */}
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-xs font-medium truncate",
                                isSelected ? "text-foreground" : "text-muted-foreground"
                              )}>
                                {p.nombre}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                              ${p.precio.toLocaleString("es-AR")}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Selected products summary */}
      {selectedIds.length > 0 && (
        <div className="mt-2 p-2.5 rounded-xl border border-border/40 bg-muted/20">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
            Productos seleccionados ({selectedIds.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {selectedIds.slice(0, 8).map((id) => {
              const prod = productos.find((p) => p.id === id)
              if (!prod) return null
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-border/40 bg-background"
                >
                  {prod.nombre}
                  <button
                    onClick={() => onToggle(id)}
                    className="hover:text-destructive transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )
            })}
            {selectedIds.length > 8 && (
              <span className="text-[10px] text-muted-foreground px-1">
                +{selectedIds.length - 8} más
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Simple chevron icon (inline)
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

// ============================================
// Seccion Card
// ============================================
function SeccionCard({
  seccion,
  index,
  total,
  colorPrincipal,
  isReordering,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  seccion: Seccion
  index: number
  total: number
  colorPrincipal: string
  isReordering: boolean
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const productCount = seccion.productos?.length ?? 0
  const sectionColor = seccion.color || colorPrincipal

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isReordering ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="rounded-2xl border-border/50 overflow-hidden hover:shadow-md transition-shadow group">
        <CardContent className="p-0">
          <div className="flex items-stretch">
            {/* Color indicator stripe */}
            <div
              className="w-1.5 shrink-0"
              style={{ backgroundColor: sectionColor }}
            />

            {/* Main content */}
            <div className="flex-1 p-3 min-w-0">
              <div className="flex items-center gap-3">
                {/* Order number badge */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{
                    backgroundColor: `${sectionColor}15`,
                    color: sectionColor,
                  }}
                >
                  {index + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold truncate">
                      {seccion.nombre}
                    </h4>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium border-0 shrink-0 px-1.5 py-0"
                      style={{
                        backgroundColor: `${sectionColor}12`,
                        color: sectionColor,
                      }}
                    >
                      {seccion.orientacion === "horizontal" ? "Horizontal" : "Vertical"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {productCount} {productCount === 1 ? "producto" : "productos"}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    disabled={index === 0}
                    onClick={onMoveUp}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    disabled={index === total - 1}
                    onClick={onMoveDown}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={onEdit}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Products preview (mini chips) */}
              {productCount > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {seccion.productos
                    .sort((a, b) => a.orden - b.orden)
                    .slice(0, 5)
                    .map((sp) => (
                      <span
                        key={sp.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/30"
                      >
                        {sp.producto.nombre}
                      </span>
                    ))}
                  {productCount > 5 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/40 text-muted-foreground">
                      +{productCount - 5} más
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Empty State
// ============================================
function EmptySecciones({
  onAdd,
  colorPrincipal,
}: {
  onAdd: () => void
  colorPrincipal: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="rounded-2xl border-border/50 border-dashed">
        <CardContent className="p-6 text-center">
          <div
            className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-3"
            style={{ backgroundColor: `${colorPrincipal}12` }}
          >
            <Layers
              className="h-6 w-6"
              style={{ color: colorPrincipal }}
            />
          </div>
          <h4 className="text-sm font-semibold mb-1">Sin secciones</h4>
          <p className="text-xs text-muted-foreground mb-4 max-w-[240px] mx-auto">
            Creá secciones para organizar tus productos en grupos dentro del
            catálogo. Por ejemplo: Promociones, Destacados, Bebidas...
          </p>
          <Button
            size="sm"
            className="rounded-xl gap-1.5 font-semibold"
            style={{ backgroundColor: colorPrincipal }}
            onClick={onAdd}
          >
            <Plus className="h-3.5 w-3.5" />
            Crear primera sección
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function SeccionesSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32 rounded-lg" />
                <Skeleton className="h-3 w-20 rounded-lg" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
