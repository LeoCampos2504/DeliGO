"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Search, Edit3, Trash2, X, Check, Tag, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { ImageUpload } from "@/components/shared/image-upload"

// ============================================
// Types
// ============================================
interface AgregadosSectionProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
}

interface Agregado {
  id: string
  nombre: string
  precio: number
  categoria: string
  imagenUrl: string | null
  productos?: { agregadoId: string; producto: { id: string; nombre: string } }[]
}

interface AgregadoFormData {
  nombre: string
  precio: number
  categoria: string
  imagenUrl: string
}

const defaultFormData: AgregadoFormData = {
  nombre: "",
  precio: 0,
  categoria: "",
  imagenUrl: "",
}

const SIN_CATEGORIA = "Sin categoría"

// ============================================
// Agregados Section Component
// ============================================
export function AgregadosSection({ negocio }: AgregadosSectionProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("todos")
  const [formOpen, setFormOpen] = useState(false)
  const [editingAgregado, setEditingAgregado] = useState<Agregado | null>(null)
  const [formData, setFormData] = useState<AgregadoFormData>(defaultFormData)
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null)
  const [categoryInput, setCategoryInput] = useState("")
  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [newCategoryInForm, setNewCategoryInForm] = useState(false)
  const [formCategoryInput, setFormCategoryInput] = useState("")
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingCategoryValue, setEditingCategoryValue] = useState("")

  // Fetch agregados
  const { data: agregados = [], isLoading: loadingAgregados } = useQuery<Agregado[]>({
    queryKey: ["negocio-agregados", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/agregados?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando agregados")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Fetch config for categories
  const { data: config } = useQuery<{ agregadosCategorias?: string[] }>({
    queryKey: ["negocio-config", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/config?negocioId=${negocio.id}`)
      if (!res.ok) return {}
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Derived categories: merge config categories + categories found in agregados
  const categories = useMemo(() => {
    const configCats: string[] = config?.agregadosCategorias ?? []
    const agregadoCats = new Set(agregados.map((a) => a.categoria).filter(Boolean))
    const merged = new Set([...configCats, ...agregadoCats])
    return Array.from(merged).sort()
  }, [config, agregados])

  // Filtered agregados
  const filteredAgregados = useMemo(() => {
    let filtered = agregados
    if (activeCategory !== "todos") {
      filtered = filtered.filter((a) =>
        activeCategory === SIN_CATEGORIA
          ? !a.categoria
          : a.categoria === activeCategory
      )
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((a) => a.nombre.toLowerCase().includes(q))
    }
    return filtered
  }, [agregados, activeCategory, search])

  // Group filtered agregados by category for display
  const groupedAgregados = useMemo(() => {
    const groups: Record<string, Agregado[]> = {}
    for (const ag of filteredAgregados) {
      const cat = ag.categoria || SIN_CATEGORIA
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(ag)
    }
    return groups
  }, [filteredAgregados])

  // Save agregado mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AgregadoFormData & { id?: string }) => {
      const url = data.id
        ? `/api/negocio/agregados/${data.id}`
        : `/api/negocio/agregados`
      const method = data.id ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: data.nombre,
          precio: data.precio,
          categoria: data.categoria === SIN_CATEGORIA ? "" : data.categoria,
          imagenUrl: data.imagenUrl || null,
          negocioId: negocio.id,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error guardando agregado")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-agregados", negocio.id] })
      toast.success("Agregado guardado correctamente")
      closeForm()
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al guardar el agregado")
    },
  })

  // Delete agregado mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/agregados/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando agregado")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-agregados", negocio.id] })
      toast.success("Agregado eliminado")
      setDeleteDialog(null)
    },
    onError: () => {
      toast.error("Error al eliminar el agregado")
    },
  })

  // Update config mutation (for category management)
  const updateConfigMutation = useMutation({
    mutationFn: async (agregadosCategorias: string[]) => {
      const res = await fetch(`/api/negocio/config?negocioId=${negocio.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agregadosCategorias }),
      })
      if (!res.ok) throw new Error("Error actualizando categorías")
      const json = await res.json()
      return json.data ?? json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
    },
    onError: () => {
      toast.error("Error al actualizar las categorías")
    },
  })

  // Move agregados to "Sin categoría" when deleting a category
  const moveAgregadosMutation = useMutation({
    mutationFn: async (categoria: string) => {
      const agregadosInCat = agregados.filter((a) => a.categoria === categoria)
      const updates = agregadosInCat.map((ag) =>
        fetch(`/api/negocio/agregados/${ag.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoria: "" }),
        })
      )
      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-agregados", negocio.id] })
    },
  })

  // Form handlers
  const openNewForm = () => {
    setEditingAgregado(null)
    setFormData(defaultFormData)
    setNewCategoryInForm(false)
    setFormCategoryInput("")
    setFormOpen(true)
  }

  const openEditForm = (agregado: Agregado) => {
    setEditingAgregado(agregado)
    setFormData({
      nombre: agregado.nombre,
      precio: agregado.precio,
      categoria: agregado.categoria || SIN_CATEGORIA,
      imagenUrl: agregado.imagenUrl ?? "",
    })
    setNewCategoryInForm(false)
    setFormCategoryInput("")
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingAgregado(null)
    setFormData(defaultFormData)
    setNewCategoryInForm(false)
    setFormCategoryInput("")
  }

  const handleSave = () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    if (formData.precio < 0) {
      toast.error("El precio no puede ser negativo")
      return
    }
    saveMutation.mutate({ ...formData, id: editingAgregado?.id })
  }

  // Rename category mutation
  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const res = await fetch(`/api/negocio/config/categorias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "agregados", oldName, newName }),
      })
      if (!res.ok) throw new Error("Error renombrando categoría")
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
      queryClient.invalidateQueries({ queryKey: ["negocio-agregados", negocio.id] })
      if (activeCategory === variables.oldName) {
        setActiveCategory(variables.newName)
      }
      setEditingCategory(null)
      setEditingCategoryValue("")
      toast.success(`Categoría renombrada a "${variables.newName}"`)
    },
    onError: () => {
      toast.error("Error al renombrar la categoría")
    },
  })

  // Start editing a category
  const startEditingCategory = (cat: string) => {
    setEditingCategory(cat)
    setEditingCategoryValue(cat)
  }

  // Save category rename
  const saveCategoryRename = () => {
    const trimmed = editingCategoryValue.trim()
    if (!trimmed || !editingCategory) {
      setEditingCategory(null)
      setEditingCategoryValue("")
      return
    }
    if (trimmed === editingCategory) {
      setEditingCategory(null)
      setEditingCategoryValue("")
      return
    }
    if (categories.includes(trimmed)) {
      toast.error("Ya existe una categoría con ese nombre")
      return
    }
    renameCategoryMutation.mutate({ oldName: editingCategory, newName: trimmed })
  }

  // Add category from pills bar
  const handleAddCategory = () => {
    const trimmed = categoryInput.trim()
    if (!trimmed) return
    if (categories.includes(trimmed)) {
      toast.error("Esa categoría ya existe")
      return
    }
    const updatedCats = [...categories, trimmed]
    updateConfigMutation.mutate(updatedCats, {
      onSuccess: () => {
        toast.success(`Categoría "${trimmed}" creada`)
        setCategoryInput("")
        setShowCategoryInput(false)
        setActiveCategory(trimmed)
      },
    })
  }

  // Delete category
  const handleDeleteCategory = (cat: string) => {
    setDeleteCategoryDialog(cat)
  }

  const confirmDeleteCategory = async () => {
    const cat = deleteCategoryDialog
    if (!cat) return

    // Move agregados to "Sin categoría"
    await moveAgregadosMutation.mutateAsync(cat)

    // Remove category from config
    const configCats: string[] = config?.agregadosCategorias ?? []
    const updatedCats = configCats.filter((c) => c !== cat)
    updateConfigMutation.mutate(updatedCats, {
      onSuccess: () => {
        toast.success(`Categoría "${cat}" eliminada. Los agregados se movieron a "Sin categoría".`)
        if (activeCategory === cat) setActiveCategory("todos")
        setDeleteCategoryDialog(null)
      },
    })
  }

  // Add category inline in form
  const handleAddCategoryInForm = () => {
    const trimmed = formCategoryInput.trim()
    if (!trimmed) return
    if (categories.includes(trimmed)) {
      setFormData((p) => ({ ...p, categoria: trimmed }))
      setNewCategoryInForm(false)
      setFormCategoryInput("")
      return
    }
    const updatedCats = [...categories, trimmed]
    updateConfigMutation.mutate(updatedCats, {
      onSuccess: () => {
        setFormData((p) => ({ ...p, categoria: trimmed }))
        setNewCategoryInForm(false)
        setFormCategoryInput("")
        toast.success(`Categoría "${trimmed}" creada`)
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* ===== SEARCH BAR ===== */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar agregados..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted/50 border-border/50 text-sm"
        />
      </div>

      {/* ===== CATEGORY PILLS ===== */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveCategory("todos")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
            activeCategory === "todos"
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          Todos ({agregados.length})
        </button>
        {categories.map((cat) => (
          editingCategory === cat ? (
            <div key={cat} className="flex items-center gap-1 px-2 py-1 rounded-full border border-primary/30 bg-primary/5">
              <input
                autoFocus
                value={editingCategoryValue}
                onChange={(e) => setEditingCategoryValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCategoryRename()
                  if (e.key === "Escape") {
                    setEditingCategory(null)
                    setEditingCategoryValue("")
                  }
                }}
                className="h-5 w-20 text-xs font-semibold bg-transparent outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              <span
                className="h-3.5 w-3.5 rounded-full flex items-center justify-center hover:bg-primary/20 text-primary cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  saveCategoryRename()
                }}
              >
                <Check className="h-2.5 w-2.5" />
              </span>
              <span
                className="h-3.5 w-3.5 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingCategory(null)
                  setEditingCategoryValue("")
                }}
              >
                <X className="h-2.5 w-2.5" />
              </span>
            </div>
          ) : (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border group",
                activeCategory === cat
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <span>
                {cat} ({agregados.filter((a) => a.categoria === cat).length})
              </span>
              <span
                className="h-3.5 w-3.5 rounded-full flex items-center justify-center opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-primary/20 text-primary"
                onClick={(e) => {
                  e.stopPropagation()
                  startEditingCategory(cat)
                }}
              >
                <Pencil className="h-2.5 w-2.5" />
              </span>
              <span
                className="h-3.5 w-3.5 rounded-full flex items-center justify-center opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-destructive/20 text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteCategory(cat)
                }}
              >
                <X className="h-2.5 w-2.5" />
              </span>
            </button>
          )
        ))}
        {/* Sin categoría pill if there are uncategorized */}
        {agregados.some((a) => !a.categoria) && (
          <button
            onClick={() => setActiveCategory(SIN_CATEGORIA)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
              activeCategory === SIN_CATEGORIA
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {SIN_CATEGORIA} ({agregados.filter((a) => !a.categoria).length})
          </button>
        )}
        <button
          onClick={() => setShowCategoryInput(!showCategoryInput)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border border-dashed border-border text-muted-foreground hover:bg-muted/50"
        >
          <Plus className="h-3 w-3" />
          Categoría
        </button>
      </div>

      {/* Add category inline */}
      <AnimatePresence>
        {showCategoryInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2">
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="Nueva categoría..."
                className="h-8 text-sm rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory()
                }}
              />
              <Button
                size="sm"
                className="h-8 rounded-lg"
                style={{ backgroundColor: negocio.colorPrincipal }}
                onClick={handleAddCategory}
                disabled={updateConfigMutation.isPending}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => {
                  setShowCategoryInput(false)
                  setCategoryInput("")
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== ADD AGREGADO BUTTON ===== */}
      <Button
        onClick={openNewForm}
        className="w-full rounded-xl h-11 gap-2 font-semibold"
        style={{ backgroundColor: negocio.colorPrincipal }}
      >
        <Plus className="h-4 w-4" />
        Agregar agregado
      </Button>

      {/* ===== AGREGADO LIST GROUPED BY CATEGORY ===== */}
      {loadingAgregados ? (
        <AgregadoGridSkeleton />
      ) : filteredAgregados.length === 0 ? (
        <EmptyAgregados hasSearch={!!search || activeCategory !== "todos"} />
      ) : activeCategory !== "todos" ? (
        // Flat list when filtering by category
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAgregados.map((agregado, i) => (
            <AgregadoCard
              key={agregado.id}
              agregado={agregado}
              colorPrincipal={negocio.colorPrincipal}
              onEdit={() => openEditForm(agregado)}
              onDelete={() => setDeleteDialog(agregado.id)}
              delay={i * 0.03}
            />
          ))}
        </div>
      ) : (
        // Grouped by category
        <div className="space-y-5">
          {Object.entries(groupedAgregados)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, items]) => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <Tag
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                  <h3 className="text-sm font-semibold text-foreground">{cat}</h3>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium border-0"
                  >
                    {items.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((agregado, i) => (
                    <AgregadoCard
                      key={agregado.id}
                      agregado={agregado}
                      colorPrincipal={negocio.colorPrincipal}
                      onEdit={() => openEditForm(agregado)}
                      onDelete={() => setDeleteDialog(agregado.id)}
                      delay={i * 0.03}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ===== AGREGADO FORM DRAWER ===== */}
      <Drawer open={formOpen} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              {editingAgregado ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  Editar agregado
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Nuevo agregado
                </>
              )}
            </DrawerTitle>
          </DrawerHeader>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Nombre */}
              <div>
                <Label htmlFor="ag-nombre" className="text-sm font-semibold mb-1.5 block">
                  Nombre *
                </Label>
                <Input
                  id="ag-nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Queso extra"
                  className="rounded-xl"
                />
              </div>

              {/* Precio */}
              <div>
                <Label htmlFor="ag-precio" className="text-sm font-semibold mb-1.5 block">
                  Precio *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="ag-precio"
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.precio || ""}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, precio: parseFloat(e.target.value) || 0 }))
                    }
                    placeholder="0.00"
                    className="rounded-xl pl-7"
                  />
                </div>
              </div>

              {/* Categoría */}
              <div>
                <Label className="text-sm font-semibold mb-1.5 block">Categoría</Label>
                {!newCategoryInForm ? (
                  <div className="flex gap-2">
                    <Select
                      value={formData.categoria || SIN_CATEGORIA}
                      onValueChange={(v) =>
                        setFormData((p) => ({
                          ...p,
                          categoria: v === SIN_CATEGORIA ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger className="rounded-xl flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_CATEGORIA}>Sin categoría</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      onClick={() => setNewCategoryInForm(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={formCategoryInput}
                      onChange={(e) => setFormCategoryInput(e.target.value)}
                      placeholder="Nueva categoría..."
                      className="rounded-xl flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCategoryInForm()
                        if (e.key === "Escape") {
                          setNewCategoryInForm(false)
                          setFormCategoryInput("")
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      style={{ backgroundColor: negocio.colorPrincipal }}
                      onClick={handleAddCategoryInForm}
                      disabled={updateConfigMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-xl shrink-0"
                      onClick={() => {
                        setNewCategoryInForm(false)
                        setFormCategoryInput("")
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Imagen */}
              <div>
                <Label className="text-sm font-semibold mb-1.5 block">Imagen</Label>
                <ImageUpload
                  value={formData.imagenUrl || null}
                  onChange={(url) => setFormData((p) => ({ ...p, imagenUrl: url }))}
                  onRemove={() => setFormData((p) => ({ ...p, imagenUrl: "" }))}
                  category="agregados"
                  slug={negocio.slug}
                  variant="compact"
                  placeholder="Subir imagen"
                />
              </div>
            </motion.div>
          </div>

          {/* Save footer */}
          <DrawerFooter className="border-t pt-3">
            <Button
              className="w-full rounded-xl font-semibold"
              style={{ backgroundColor: negocio.colorPrincipal }}
              onClick={handleSave}
              disabled={saveMutation.isPending || !formData.nombre.trim()}
            >
              {saveMutation.isPending ? (
                "Guardando..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  {editingAgregado ? "Guardar cambios" : "Crear agregado"}
                </>
              )}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ===== DELETE AGREGADO CONFIRMATION ===== */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="rounded-2xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Eliminar agregado
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Esta acción no se puede deshacer. El agregado se
              eliminará de todos los productos asociados.
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
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CATEGORY CONFIRMATION ===== */}
      <Dialog open={!!deleteCategoryDialog} onOpenChange={() => setDeleteCategoryDialog(null)}>
        <DialogContent className="rounded-2xl max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Eliminar categoría
            </DialogTitle>
            <DialogDescription>
              ¿Eliminar la categoría &quot;{deleteCategoryDialog}&quot;? Los agregados
              en esta categoría se moverán a &quot;Sin categoría&quot;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeleteCategoryDialog(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={confirmDeleteCategory}
              disabled={updateConfigMutation.isPending || moveAgregadosMutation.isPending}
            >
              {updateConfigMutation.isPending || moveAgregadosMutation.isPending
                ? "Eliminando..."
                : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Agregado Card
// ============================================
function AgregadoCard({
  agregado,
  colorPrincipal,
  onEdit,
  onDelete,
  delay,
}: {
  agregado: Agregado
  colorPrincipal: string
  onEdit: () => void
  onDelete: () => void
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="rounded-2xl border-border/50 overflow-hidden hover:shadow-md transition-shadow group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Info */}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold truncate">{agregado.nombre}</h4>
              <div className="flex items-center gap-2 mt-1.5">
                {agregado.categoria ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium border-0"
                    style={{
                      backgroundColor: `${colorPrincipal}12`,
                      color: colorPrincipal,
                    }}
                  >
                    {agregado.categoria}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium border-0 bg-muted/60 text-muted-foreground"
                  >
                    Sin categoría
                  </Badge>
                )}
                {agregado.productos && agregado.productos.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    En {agregado.productos.length} producto
                    {agregado.productos.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Price & Actions */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <p className="text-sm font-bold">{formatPrice(agregado.precio)}</p>
              <div className="flex gap-1 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Loading Skeleton
// ============================================
function AgregadoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Empty State
// ============================================
function EmptyAgregados({ hasSearch }: { hasSearch: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12"
    >
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
        <Tag className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-1">
        {hasSearch ? "Sin resultados" : "Sin agregados"}
      </h3>
      <p className="text-xs text-muted-foreground/70 max-w-[250px] mx-auto">
        {hasSearch
          ? "No se encontraron agregados con los filtros actuales."
          : "Agregá complementos o extras para tus productos."}
      </p>
    </motion.div>
  )
}
