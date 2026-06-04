"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Search, Edit3, Trash2, X, Check, Leaf, Pencil } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ImageUpload } from "@/components/shared/image-upload"

// ============================================
// Types
// ============================================
interface IngredientesSectionProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
}

interface Ingrediente {
  id: string
  nombre: string
  categoria: string
  imagenUrl: string | null
  productos: { producto: { id: string; nombre: string } }[]
}

interface IngredienteFormData {
  nombre: string
  categoria: string
  imagenUrl: string
}

const defaultFormData: IngredienteFormData = {
  nombre: "",
  categoria: "",
  imagenUrl: "",
}

// ============================================
// Ingredientes Section Component
// ============================================
export function IngredientesSection({ negocio }: IngredientesSectionProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("todos")
  const [formOpen, setFormOpen] = useState(false)
  const [editingIngrediente, setEditingIngrediente] = useState<Ingrediente | null>(null)
  const [formData, setFormData] = useState<IngredienteFormData>(defaultFormData)
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null)
  const [categoryInput, setCategoryInput] = useState("")
  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingCategoryValue, setEditingCategoryValue] = useState("")
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState<string | null>(null)

  // Fetch ingredientes
  const { data: ingredientes = [], isLoading } = useQuery<Ingrediente[]>({
    queryKey: ["negocio-ingredientes", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/ingredientes?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando ingredientes")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Fetch config for categorias
  const { data: config } = useQuery<{ ingredientesCategorias: string[] }>({
    queryKey: ["negocio-config", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/config?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando configuración")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Save ingrediente mutation
  const saveMutation = useMutation({
    mutationFn: async (data: IngredienteFormData & { id?: string }) => {
      const url = data.id
        ? `/api/negocio/ingredientes/${data.id}`
        : `/api/negocio/ingredientes`
      const method = data.id ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, negocioId: negocio.id }),
      })
      if (!res.ok) throw new Error("Error guardando ingrediente")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-ingredientes", negocio.id] })
      toast.success("Ingrediente guardado correctamente")
      closeForm()
    },
    onError: () => {
      toast.error("Error al guardar el ingrediente")
    },
  })

  // Delete ingrediente mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/ingredientes/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando ingrediente")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-ingredientes", negocio.id] })
      toast.success("Ingrediente eliminado")
      setDeleteDialog(null)
    },
    onError: () => {
      toast.error("Error al eliminar el ingrediente")
    },
  })

  // Update config categorias mutation
  const updateCategoriasMutation = useMutation({
    mutationFn: async (newCategorias: string[]) => {
      const res = await fetch(`/api/negocio/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientesCategorias: newCategorias, negocioId: negocio.id }),
      })
      if (!res.ok) throw new Error("Error guardando categorías")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
    },
  })

  // Rename category mutation
  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const res = await fetch(`/api/negocio/config/categorias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "ingredientes", oldName, newName }),
      })
      if (!res.ok) throw new Error("Error renombrando categoría")
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
      queryClient.invalidateQueries({ queryKey: ["negocio-ingredientes", negocio.id] })
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

  // Delete category handler
  const handleDeleteCategory = (cat: string) => {
    setDeleteCategoryDialog(cat)
  }

  const confirmDeleteCategory = async () => {
    const cat = deleteCategoryDialog
    if (!cat) return

    // Move ingredientes to no category
    const ingredientesInCat = ingredientes.filter((i) => i.categoria === cat)
    const updates = ingredientesInCat.map((ing) =>
      fetch(`/api/negocio/ingredientes/${ing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria: "" }),
      })
    )
    await Promise.all(updates)

    // Remove category from config
    const newCategorias = configCategorias.filter((c: string) => c !== cat)
    updateCategoriasMutation.mutate(newCategorias, {
      onSuccess: () => {
        toast.success(`Categoría "${cat}" eliminada. Los ingredientes se movieron a sin categoría.`)
        if (activeCategory === cat) setActiveCategory("todos")
        setDeleteCategoryDialog(null)
        queryClient.invalidateQueries({ queryKey: ["negocio-ingredientes", negocio.id] })
      },
    })
  }

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
    if (allCategories.includes(trimmed)) {
      toast.error("Ya existe una categoría con ese nombre")
      return
    }
    renameCategoryMutation.mutate({ oldName: editingCategory, newName: trimmed })
  }

  // Derived data
  const configCategorias = config?.ingredientesCategorias ?? []

  const allCategories = (() => {
    // Merge config categories with categories found in ingredientes data
    const fromConfig = new Set(configCategorias)
    const fromData = new Set(ingredientes.map((i) => i.categoria).filter(Boolean))
    const merged = new Set([...fromConfig, ...fromData])
    return Array.from(merged).sort()
  })()

  const filteredIngredientes = (() => {
    let filtered = ingredientes
    if (activeCategory !== "todos") {
      filtered = filtered.filter((i) => i.categoria === activeCategory)
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((i) => i.nombre.toLowerCase().includes(q))
    }
    return filtered
  })()

  // Form handlers
  const openNewForm = () => {
    setEditingIngrediente(null)
    setFormData(defaultFormData)
    setFormOpen(true)
  }

  const openEditForm = (ingrediente: Ingrediente) => {
    setEditingIngrediente(ingrediente)
    setFormData({
      nombre: ingrediente.nombre,
      categoria: ingrediente.categoria || "",
      imagenUrl: ingrediente.imagenUrl || "",
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingIngrediente(null)
    setFormData(defaultFormData)
  }

  const handleSave = () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    saveMutation.mutate({ ...formData, id: editingIngrediente?.id })
  }

  const handleAddCategory = () => {
    const trimmed = categoryInput.trim()
    if (!trimmed) return
    if (allCategories.includes(trimmed)) {
      toast.error("La categoría ya existe")
      return
    }
    const newCategorias = [...configCategorias, trimmed]
    updateCategoriasMutation.mutate(newCategorias, {
      onSuccess: () => {
        toast.success("Categoría agregada")
        setActiveCategory(trimmed)
        setCategoryInput("")
        setShowCategoryInput(false)
      },
      onError: () => {
        toast.error("Error al agregar la categoría")
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
          placeholder="Buscar ingredientes..."
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
          <Leaf className="h-3 w-3" />
          Todos ({ingredientes.length})
        </button>
        {allCategories.map((cat) => (
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
                {cat} ({ingredientes.filter((i) => i.categoria === cat).length})
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
                disabled={updateCategoriasMutation.isPending}
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

      {/* ===== ADD INGREDIENTE BUTTON ===== */}
      <Button
        onClick={openNewForm}
        className="w-full rounded-xl h-11 gap-2 font-semibold"
        style={{ backgroundColor: negocio.colorPrincipal }}
      >
        <Plus className="h-4 w-4" />
        Agregar ingrediente
      </Button>

      {/* ===== INGREDIENTES GRID ===== */}
      {isLoading ? (
        <IngredientesGridSkeleton />
      ) : filteredIngredientes.length === 0 ? (
        <EmptyIngredientes
          hasSearch={!!search || activeCategory !== "todos"}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredIngredientes.map((ingrediente, i) => (
            <IngredienteCard
              key={ingrediente.id}
              ingrediente={ingrediente}
              colorPrincipal={negocio.colorPrincipal}
              onEdit={() => openEditForm(ingrediente)}
              onDelete={() => setDeleteDialog(ingrediente.id)}
              delay={i * 0.03}
            />
          ))}
        </div>
      )}

      {/* ===== INGREDIENTE FORM DRAWER ===== */}
      <Drawer open={formOpen} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              {editingIngrediente ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  Editar ingrediente
                </>
              ) : (
                <>
                  <Leaf className="h-4 w-4" />
                  Nuevo ingrediente
                </>
              )}
            </DrawerTitle>
          </DrawerHeader>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Nombre */}
              <div>
                <Label htmlFor="ing-nombre" className="text-sm font-semibold mb-1.5 block">
                  Nombre *
                </Label>
                <Input
                  id="ing-nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Sin cebolla"
                  className="rounded-xl"
                />
              </div>

              {/* Categoría */}
              <div>
                <Label htmlFor="ing-categoria" className="text-sm font-semibold mb-1.5 block">
                  Categoría
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.categoria || "_empty"}
                    onValueChange={(v) =>
                      setFormData((p) => ({
                        ...p,
                        categoria: v === "_empty" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-xl flex-1">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty">Sin categoría</SelectItem>
                      {allCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Imagen */}
              <div>
                <Label className="text-sm font-semibold mb-1.5 block">Imagen</Label>
                <ImageUpload
                  value={formData.imagenUrl || null}
                  onChange={(url) => setFormData((p) => ({ ...p, imagenUrl: url }))}
                  onRemove={() => setFormData((p) => ({ ...p, imagenUrl: "" }))}
                  category="ingredientes"
                  slug={negocio.slug}
                  variant="compact"
                  placeholder="Subir imagen"
                />
              </div>

              {/* Info note */}
              <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                <p className="text-xs text-muted-foreground">
                  <Leaf className="h-3 w-3 inline mr-1" />
                  Los ingredientes son opciones de &quot;remover&quot; para los productos. No tienen precio, el cliente simplemente los puede sacar de su pedido.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Footer */}
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
                className="flex-1 rounded-xl gap-2 font-semibold"
                style={{ backgroundColor: negocio.colorPrincipal }}
                onClick={handleSave}
                disabled={saveMutation.isPending || !formData.nombre.trim()}
              >
                {saveMutation.isPending ? (
                  "Guardando..."
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {editingIngrediente ? "Guardar cambios" : "Crear ingrediente"}
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
              Eliminar ingrediente
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Se eliminará de todos los productos asociados. Esta acción no se puede deshacer.
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
              ¿Eliminar la categoría &quot;{deleteCategoryDialog}&quot;? Los ingredientes
              en esta categoría se moverán a sin categoría.
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
              disabled={updateCategoriasMutation.isPending}
            >
              {updateCategoriasMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Ingrediente Card
// ============================================
function IngredienteCard({
  ingrediente,
  colorPrincipal,
  onEdit,
  onDelete,
  delay,
}: {
  ingrediente: Ingrediente
  colorPrincipal: string
  onEdit: () => void
  onDelete: () => void
  delay: number
}) {
  const productCount = ingrediente.productos?.length ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="rounded-2xl border-border/50 overflow-hidden hover:shadow-md transition-shadow group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${colorPrincipal}15` }}
            >
              <Leaf className="h-5 w-5" style={{ color: colorPrincipal }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold truncate">{ingrediente.nombre}</h4>
              <div className="flex items-center gap-2 mt-1">
                {ingrediente.categoria ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium border-0"
                    style={{ backgroundColor: `${colorPrincipal}12`, color: colorPrincipal }}
                  >
                    {ingrediente.categoria}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium border-0 bg-muted/50 text-muted-foreground"
                  >
                    Sin categoría
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {productCount} producto{productCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-muted"
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
                className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
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
function EmptyIngredientes({ hasSearch }: { hasSearch: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Leaf className="h-8 w-8 text-muted-foreground/40" />
      </div>
      {hasSearch ? (
        <>
          <p className="text-sm font-semibold text-muted-foreground">
            No se encontraron ingredientes
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Probá con otra búsqueda o categoría
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-muted-foreground">
            No hay ingredientes todavía
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Agregá ingredientes para que los clientes puedan personalizar sus pedidos
          </p>
        </>
      )}
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function IngredientesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
