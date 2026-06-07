"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  PackageOpen,
  ImageIcon,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Layers,
  Shirt,
  Sparkles,
  ListChecks,
  Palette,
  Ruler,
  Tag,
  Wand2,
  Settings2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { ImageUpload, MultiImageUpload } from "@/components/shared/image-upload"
import type { PanelMode } from "./business-panel"
import { AgregadosSection } from "./agregados-section"
import { IngredientesSection } from "./ingredientes-section"
import { SeccionesSection } from "./secciones-section"
import { OpcionesCompartidasSection } from "./opciones-compartidas-section"
import { SectionErrorBoundary } from "@/components/shared/section-error-boundary"

// ============================================
// Types
// ============================================
type CatalogSubTab = "productos" | "agregados" | "ingredientes" | "secciones" | "opciones"

interface ProductsTabProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
  mode: PanelMode
}

interface Producto {
  id: string
  nombre: string
  precio: number
  categoria: string
  imagenUrl: string | null
  stock: boolean
  descripcion: string | null
  descuentoActivo: boolean
  tipoDescuento: string
  valorDescuento: number
  secciones: string
  talles: string
  colores: string
  material: string
  genero: string
  recomendados: string
  imagenesExtra: string
  agregados: { agregadoId: string; agregado: { id: string; nombre: string; precio: number } }[]
  ingredientes: { ingredienteId: string; ingrediente: { id: string; nombre: string } }[]
  opcionesCompartidasIds?: string
}

interface Agregado {
  id: string
  nombre: string
  precio: number
  categoria: string
}

interface Ingrediente {
  id: string
  nombre: string
  categoria: string
}

interface ProductFormData {
  nombre: string
  precio: number
  categoria: string
  tipoPrenda: string
  imagenUrl: string
  imagenesExtra: string[]
  stock: boolean
  descuentoActivo: boolean
  tipoDescuento: string
  valorDescuento: number
  descripcion: string
  talles: string
  colores: string
  material: string
  genero: string
  secciones: string
  agregadosIds: string[]
  ingredientesIds: string[]
  opcionesCompartidasIds: Array<{ id: string; obligatorio: boolean; maximo: number }>
}

const defaultFormData: ProductFormData = {
  nombre: "",
  precio: 0,
  categoria: "Sin Categoria",
  tipoPrenda: "",
  imagenUrl: "",
  imagenesExtra: [],
  stock: true,
  descuentoActivo: false,
  tipoDescuento: "porcentaje",
  valorDescuento: 0,
  descripcion: "",
  talles: "[]",
  colores: "[]",
  material: "",
  genero: "sin-especificar",
  secciones: "[]",
  agregadosIds: [],
  ingredientesIds: [],
  opcionesCompartidasIds: [],
}

const generoOptions = [
  { value: "sin-especificar", label: "Sin especificar" },
  { value: "hombre", label: "Hombre" },
  { value: "mujer", label: "Mujer" },
  { value: "unisex", label: "Unisex" },
  { value: "ninos", label: "Niños" },
]

// Common color presets for quick-add
const coloresPresets = ["Negro", "Blanco", "Rojo", "Azul", "Verde", "Rosa", "Gris", "Beige", "Naranja", "Amarillo", "Marrón", "Violeta"]

// Smart talles presets based on tipo de prenda (clothing category)
const tallesByTipo: Record<string, string[]> = {
  remera: ["XS", "S", "M", "L", "XL", "XXL"],
  remeras: ["XS", "S", "M", "L", "XL", "XXL"],
  camisa: ["XS", "S", "M", "L", "XL", "XXL"],
  camisas: ["XS", "S", "M", "L", "XL", "XXL"],
  camiseta: ["XS", "S", "M", "L", "XL", "XXL"],
  camisetas: ["XS", "S", "M", "L", "XL", "XXL"],
  musculosa: ["XS", "S", "M", "L", "XL", "XXL"],
  musculosas: ["XS", "S", "M", "L", "XL", "XXL"],
  top: ["XS", "S", "M", "L", "XL", "XXL"],
  tops: ["XS", "S", "M", "L", "XL", "XXL"],
  blusa: ["XS", "S", "M", "L", "XL", "XXL"],
  blusas: ["XS", "S", "M", "L", "XL", "XXL"],
  sweater: ["XS", "S", "M", "L", "XL", "XXL"],
  sweaters: ["XS", "S", "M", "L", "XL", "XXL"],
  pulover: ["XS", "S", "M", "L", "XL", "XXL"],
  puloveres: ["XS", "S", "M", "L", "XL", "XXL"],
  buzo: ["XS", "S", "M", "L", "XL", "XXL"],
  buzos: ["XS", "S", "M", "L", "XL", "XXL"],
  campera: ["XS", "S", "M", "L", "XL", "XXL"],
  camperas: ["XS", "S", "M", "L", "XL", "XXL"],
  chaleco: ["XS", "S", "M", "L", "XL", "XXL"],
  chalecos: ["XS", "S", "M", "L", "XL", "XXL"],
  pantalon: ["36", "38", "40", "42", "44", "46", "48"],
  pantalones: ["36", "38", "40", "42", "44", "46", "48"],
  jean: ["36", "38", "40", "42", "44", "46", "48"],
  jeans: ["36", "38", "40", "42", "44", "46", "48"],
  jogger: ["36", "38", "40", "42", "44", "46", "48"],
  joggers: ["36", "38", "40", "42", "44", "46", "48"],
  short: ["XS", "S", "M", "L", "XL", "XXL"],
  shorts: ["XS", "S", "M", "L", "XL", "XXL"],
  bermuda: ["XS", "S", "M", "L", "XL", "XXL"],
  bermudas: ["XS", "S", "M", "L", "XL", "XXL"],
  pollera: ["XS", "S", "M", "L", "XL", "XXL"],
  polleras: ["XS", "S", "M", "L", "XL", "XXL"],
  falda: ["XS", "S", "M", "L", "XL", "XXL"],
  faldas: ["XS", "S", "M", "L", "XL", "XXL"],
  vestido: ["XS", "S", "M", "L", "XL", "XXL"],
  vestidos: ["XS", "S", "M", "L", "XL", "XXL"],
  zapatilla: ["38", "39", "40", "41", "42", "43", "44", "45"],
  zapatillas: ["38", "39", "40", "41", "42", "43", "44", "45"],
  zapato: ["38", "39", "40", "41", "42", "43", "44", "45"],
  zapatos: ["38", "39", "40", "41", "42", "43", "44", "45"],
  ojota: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  ojotas: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  sandalia: ["36", "37", "38", "39", "40", "41", "42"],
  sandalias: ["36", "37", "38", "39", "40", "41", "42"],
  gorra: ["Única"],
  gorras: ["Única"],
  sombrero: ["S", "M", "L"],
  sombreros: ["S", "M", "L"],
  corbata: ["Única"],
  corbatas: ["Única"],
  cinto: ["S", "M", "L", "XL"],
  cintos: ["S", "M", "L", "XL"],
  medias: ["36-39", "40-43"],
  media: ["36-39", "40-43"],
}

const tallesPresetsDefault = ["XS", "S", "M", "L", "XL", "XXL", "Único"]

// Predefined garment types for ropa businesses — grouped for the Select dropdown
const tipoPrendaOptions = [
  {
    group: "Torso",
    items: [
      { value: "remera", label: "Remera" },
      { value: "camisa", label: "Camisa" },
      { value: "camiseta", label: "Camiseta" },
      { value: "musculosa", label: "Musculosa" },
      { value: "top", label: "Top" },
      { value: "blusa", label: "Blusa" },
      { value: "sweater", label: "Sweater" },
      { value: "pulover", label: "Pulóver" },
      { value: "buzo", label: "Buzo" },
      { value: "campera", label: "Campera" },
      { value: "chaleco", label: "Chaleco" },
    ],
  },
  {
    group: "Piernas",
    items: [
      { value: "pantalon", label: "Pantalón" },
      { value: "jean", label: "Jean" },
      { value: "jogger", label: "Jogger" },
      { value: "short", label: "Short" },
      { value: "bermuda", label: "Bermuda" },
      { value: "pollera", label: "Pollera" },
      { value: "falda", label: "Falda" },
      { value: "vestido", label: "Vestido" },
    ],
  },
  {
    group: "Calzado",
    items: [
      { value: "zapatilla", label: "Zapatilla" },
      { value: "zapato", label: "Zapato" },
      { value: "ojota", label: "Ojota" },
      { value: "sandalia", label: "Sandalia" },
    ],
  },
  {
    group: "Accesorios",
    items: [
      { value: "gorra", label: "Gorra" },
      { value: "sombrero", label: "Sombrero" },
      { value: "corbata", label: "Corbata" },
      { value: "cinto", label: "Cinto" },
      { value: "medias", label: "Medias" },
    ],
  },
]

// Flat list for quick lookup
const tipoPrendaFlat = tipoPrendaOptions.flatMap((g) => g.items)

function getTallesForTipoPrenda(tipoPrenda: string): string[] {
  if (!tipoPrenda) return tallesPresetsDefault
  const normalized = tipoPrenda.toLowerCase().trim()
  // Direct match in tallesByTipo
  if (tallesByTipo[normalized]) return tallesByTipo[normalized]
  // Match by label
  const found = tipoPrendaFlat.find((t) => t.value === normalized)
  if (found && tallesByTipo[found.value]) return tallesByTipo[found.value]
  return tallesPresetsDefault
}

function getTallesForCategory(categoria: string): string[] {
  const normalized = categoria.toLowerCase().trim()
  // Direct match
  if (tallesByTipo[normalized]) return tallesByTipo[normalized]
  // Partial match (e.g. "Remeras de algodón" → "remeras")
  for (const key of Object.keys(tallesByTipo)) {
    if (normalized.includes(key)) return tallesByTipo[key]
  }
  return tallesPresetsDefault
}

// ============================================
// Chip Input Component (for talles/colores)
// ============================================
function ChipInput({
  chips,
  onChange,
  placeholder,
  presets,
  presetLabel,
}: {
  chips: string[]
  onChange: (chips: string[]) => void
  placeholder: string
  presets?: string[]
  presetLabel?: string
}) {
  const [inputValue, setInputValue] = useState("")

  const addChip = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (chips.includes(trimmed)) {
      setInputValue("")
      return
    }
    onChange([...chips, trimmed])
    setInputValue("")
  }, [chips, onChange])

  const removeChip = useCallback((index: number) => {
    onChange(chips.filter((_, i) => i !== index))
  }, [chips, onChange])

  const togglePreset = useCallback((preset: string) => {
    if (chips.includes(preset)) {
      onChange(chips.filter((c) => c !== preset))
    } else {
      onChange([...chips, preset])
    }
  }, [chips, onChange])

  return (
    <div className="space-y-2">
      {/* Input field */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addChip(inputValue)
            }
            if (e.key === "," || e.key === "Tab") {
              e.preventDefault()
              addChip(inputValue)
            }
            // Backspace removes last chip if input is empty
            if (e.key === "Backspace" && !inputValue && chips.length > 0) {
              removeChip(chips.length - 1)
            }
          }}
          placeholder={placeholder}
          className="rounded-xl flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl h-auto px-3 shrink-0"
          onClick={() => addChip(inputValue)}
          disabled={!inputValue.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Current chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip, i) => (
            <span
              key={`${chip}-${i}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
            >
              {chip}
              <button
                type="button"
                onClick={() => removeChip(i)}
                className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Presets quick-add */}
      {presets && presets.length > 0 && (
        <div>
          {presetLabel && (
            <p className="text-[10px] text-muted-foreground mb-1.5">{presetLabel}</p>
          )}
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => {
              const isSelected = chips.includes(preset)
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => togglePreset(preset)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border",
                    isSelected
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {preset}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Products Tab Component
// ============================================
export function ProductsTab({ negocio, mode }: ProductsTabProps) {
  const queryClient = useQueryClient()
  const isRopa = negocio.rubro === "ropa"
  const isNegocio = negocio.rubro === "negocio"
  const [subTab, setSubTab] = useState<CatalogSubTab>("productos")
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("todos")
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null)
  const [formStep, setFormStep] = useState(0)
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData)
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null)
  const [categoryInput, setCategoryInput] = useState("")
  const [showCategoryInput, setShowCategoryInput] = useState(false)

  // Sub-tab items — customize based on rubro
  const subTabItems: { id: CatalogSubTab; label: string; icon: typeof PackageOpen }[] = useMemo(() => {
    const items: { id: CatalogSubTab; label: string; icon: typeof PackageOpen }[] = [
      { id: "productos", label: isRopa ? "Prendas" : "Productos", icon: isRopa ? Shirt : PackageOpen },
    ]
    if (mode === "expert" && !isRopa && !isNegocio) {
      items.push(
        { id: "agregados", label: "Agregados", icon: Plus },
        { id: "ingredientes", label: "Ingredientes", icon: Sparkles },
      )
    }
    items.push({ id: "secciones", label: "Secciones", icon: Layers })
    items.push({ id: "opciones", label: "Opciones", icon: Settings2 })
    return items
  }, [mode, isRopa, isNegocio])

  // Fetch products
  const { data: productos = [], isLoading: loadingProducts } = useQuery<Producto[]>({
    queryKey: ["negocio-productos", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/productos?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando productos")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Fetch agregados (only for non-ropa)
  const { data: agregados = [] } = useQuery<Agregado[]>({
    queryKey: ["negocio-agregados", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/agregados?negocioId=${negocio.id}`)
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? json
    },
    enabled: !isRopa && !isNegocio,
  })

  // Fetch ingredientes (only for restaurante)
  const { data: ingredientes = [] } = useQuery<Ingrediente[]>({
    queryKey: ["negocio-ingredientes", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/ingredientes?negocioId=${negocio.id}`)
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? json
    },
    enabled: !isRopa && !isNegocio,
  })

  // Fetch config categories
  const { data: configCategorias = [] } = useQuery<string[]>({
    queryKey: ["negocio-categorias", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/categorias?negocioId=${negocio.id}`)
      if (!res.ok) return []
      const json = await res.json()
      return json.categorias ?? []
    },
  })

  // Fetch opciones compartidas (for product form)
  const { data: opcionesCompartidas = [] } = useQuery<{ id: string; nombre: string; opciones: string; obligatorio: boolean; maximo: number }[]>({
    queryKey: ["negocio-opciones-compartidas", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/opciones-compartidas?negocioId=${negocio.id}`)
      if (!res.ok) return []
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Update categories mutation (persist to DB)
  const updateCategoriasMutation = useMutation({
    mutationFn: async (categorias: string[]) => {
      const res = await fetch(`/api/negocio/categorias`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorias, negocioId: negocio.id }),
      })
      if (!res.ok) throw new Error("Error guardando categorías")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-categorias", negocio.id] })
    },
  })

  // Derived data — merge config categories + product-derived categories
  const categories = useMemo(() => {
    const catSet = new Set<string>()
    for (const c of configCategorias) catSet.add(c)
    for (const p of productos) catSet.add(p.categoria)
    catSet.delete("Sin Categoria")
    return Array.from(catSet).sort()
  }, [configCategorias, productos])

  // Handle adding a new category
  const handleAddCategory = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const updated = [...new Set([...configCategorias, trimmed])].sort()
    updateCategoriasMutation.mutate(updated)
    setActiveCategory(trimmed)
    setCategoryInput("")
    setShowCategoryInput(false)
  }

  // Handle deleting a category
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState<string | null>(null)

  // Handle renaming a category
  const [renameCategoryDialog, setRenameCategoryDialog] = useState<string | null>(null)
  const [renameCategoryInput, setRenameCategoryInput] = useState("")
  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const res = await fetch(`/api/negocio/categorias`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName, negocioId: negocio.id }),
      })
      if (!res.ok) throw new Error("Error renombrando categoría")
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["negocio-categorias", negocio.id] })
      queryClient.invalidateQueries({ queryKey: ["negocio-productos", negocio.id] })
      toast.success(`Categoría renombrada a "${variables.newName}"`)
      if (activeCategory === variables.oldName) setActiveCategory(variables.newName)
      setRenameCategoryDialog(null)
      setRenameCategoryInput("")
    },
    onError: () => {
      toast.error("Error al renombrar la categoría")
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (cat: string) => {
      const updated = configCategorias.filter((c) => c !== cat)
      const res = await fetch(`/api/negocio/categorias`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorias: updated, negocioId: negocio.id }),
      })
      if (!res.ok) throw new Error("Error eliminando categoría")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-categorias", negocio.id] })
      queryClient.invalidateQueries({ queryKey: ["negocio-productos", negocio.id] })
      toast.success("Categoría eliminada")
      setDeleteCategoryDialog(null)
      if (activeCategory === deleteCategoryDialog) setActiveCategory("todos")
    },
  })

  // Save product mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ProductFormData & { id?: string }) => {
      // If the product's category is new, persist it to config first
      if (data.categoria && data.categoria !== "Sin Categoria" && !configCategorias.includes(data.categoria) && !categories.includes(data.categoria)) {
        const updated = [...new Set([...configCategorias, data.categoria])].sort()
        await fetch(`/api/negocio/categorias`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categorias: updated, negocioId: negocio.id }),
        })
      }
      const url = data.id
        ? `/api/negocio/productos/${data.id}`
        : `/api/negocio/productos`
      const method = data.id ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          negocioId: negocio.id,
          tipoPrenda: undefined, // UI-only field, don't send to API
          secciones: (() => { try { return JSON.parse(data.secciones) } catch { return [] } })(),
          talles: (() => { try { return JSON.parse(data.talles) } catch { return [] } })(),
          colores: (() => { try { return JSON.parse(data.colores) } catch { return [] } })(),
          imagenesExtra: data.imagenesExtra,
          agregadoIds: data.agregadosIds,
          ingredienteIds: data.ingredientesIds,
          opcionesCompartidasIds: data.opcionesCompartidasIds,
          agregadosIds: undefined,
          ingredientesIds: undefined,
        }),
      })
      if (!res.ok) throw new Error("Error guardando producto")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-productos", negocio.id] })
      queryClient.invalidateQueries({ queryKey: ["negocio-secciones", negocio.id] })
      queryClient.invalidateQueries({ queryKey: ["negocio-categorias", negocio.id] })
      toast.success(isRopa ? "Prenda guardada correctamente" : "Producto guardado correctamente")
      closeForm()
    },
    onError: () => {
      toast.error(isRopa ? "Error al guardar la prenda" : "Error al guardar el producto")
    },
  })

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/productos/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando producto")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-productos", negocio.id] })
      toast.success(isRopa ? "Prenda eliminada" : "Producto eliminado")
      setDeleteDialog(null)
    },
    onError: () => {
      toast.error(isRopa ? "Error al eliminar la prenda" : "Error al eliminar el producto")
    },
  })

  const filteredProducts = useMemo(() => {
    let filtered = productos
    if (activeCategory !== "todos") {
      filtered = filtered.filter((p) => p.categoria === activeCategory)
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((p) => p.nombre.toLowerCase().includes(q))
    }
    return filtered
  }, [productos, activeCategory, search])

  // Form handlers
  const openNewForm = () => {
    setEditingProduct(null)
    setFormData(defaultFormData)
    setFormStep(0)
    setFormOpen(true)
  }

  const openEditForm = (product: Producto) => {
    setEditingProduct(product)
    setFormData({
      nombre: product.nombre,
      precio: product.precio,
      categoria: product.categoria,
      tipoPrenda: (() => {
        // Try to match the category against known tipoPrenda values
        const cat = product.categoria.toLowerCase().trim()
        const match = tipoPrendaFlat.find((t) => t.value === cat || t.label.toLowerCase() === cat)
        return match ? match.value : ""
      })(),
      imagenUrl: product.imagenUrl ?? "",
      imagenesExtra: (() => {
        try { return JSON.parse(product.imagenesExtra || "[]") as string[] }
        catch { return [] }
      })(),
      stock: product.stock,
      descuentoActivo: product.descuentoActivo,
      tipoDescuento: product.tipoDescuento,
      valorDescuento: product.valorDescuento,
      descripcion: product.descripcion ?? "",
      talles: (() => {
        try {
          const val = product.talles
          if (Array.isArray(val)) return JSON.stringify(val)
          if (typeof val === "string") { JSON.parse(val); return val }
          return "[]"
        } catch { return "[]" }
      })(),
      colores: (() => {
        try {
          const val = product.colores
          if (Array.isArray(val)) return JSON.stringify(val)
          if (typeof val === "string") { JSON.parse(val); return val }
          return "[]"
        } catch { return "[]" }
      })(),
      material: product.material,
      genero: product.genero || "sin-especificar",
      secciones: (() => {
        try {
          const val = product.secciones
          if (Array.isArray(val)) return JSON.stringify(val)
          if (typeof val === "string") {
            JSON.parse(val)
            return val
          }
          return "[]"
        } catch {
          return "[]"
        }
      })(),
      agregadosIds: product.agregados?.map((a) => a.agregadoId) ?? [],
      ingredientesIds: product.ingredientes?.map((i) => i.ingredienteId) ?? [],
      opcionesCompartidasIds: (() => {
        const raw = (product as Record<string, unknown>).opcionesCompartidasIds
        let parsed: unknown[] = []
        if (Array.isArray(raw)) parsed = raw
        else { try { parsed = JSON.parse((raw as string) || "[]") } catch { parsed = [] } }
        // Handle both old format (string[]) and new format ({id, obligatorio, maximo}[])
        return parsed.map((item: unknown) => {
          if (typeof item === "string") return { id: item, obligatorio: false, maximo: 0 }
          const obj = item as { id?: string; obligatorio?: boolean; maximo?: number }
          return { id: obj.id ?? "", obligatorio: obj.obligatorio ?? false, maximo: obj.maximo ?? 0 }
        }).filter((c) => c.id)
      })(),
    })
    setFormStep(0)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingProduct(null)
    setFormData(defaultFormData)
    setFormStep(0)
  }

  const handleSave = () => {
    saveMutation.mutate({ ...formData, id: editingProduct?.id })
  }

  const discountedPrice = useMemo(() => {
    if (!formData.descuentoActivo || formData.valorDescuento <= 0) return formData.precio
    if (formData.tipoDescuento === "porcentaje") {
      return formData.precio * (1 - formData.valorDescuento / 100)
    }
    return Math.max(0, formData.precio - formData.valorDescuento)
  }, [formData.precio, formData.descuentoActivo, formData.tipoDescuento, formData.valorDescuento])

  // If on a non-productos sub-tab, render the respective section (after all hooks)
  if (subTab === "agregados" && mode === "expert" && !isRopa && !isNegocio) {
    return (
      <div className="space-y-4">
        <CatalogSubNav subTab={subTab} setSubTab={setSubTab} items={subTabItems} colorPrincipal={negocio.colorPrincipal} />
        <SectionErrorBoundary>
          <AgregadosSection negocio={negocio} />
        </SectionErrorBoundary>
      </div>
    )
  }
  if (subTab === "ingredientes" && mode === "expert" && !isRopa && !isNegocio) {
    return (
      <div className="space-y-4">
        <CatalogSubNav subTab={subTab} setSubTab={setSubTab} items={subTabItems} colorPrincipal={negocio.colorPrincipal} />
        <SectionErrorBoundary>
          <IngredientesSection negocio={negocio} />
        </SectionErrorBoundary>
      </div>
    )
  }
  if (subTab === "secciones") {
    return (
      <div className="space-y-4">
        <CatalogSubNav subTab={subTab} setSubTab={setSubTab} items={subTabItems} colorPrincipal={negocio.colorPrincipal} />
        <SectionErrorBoundary>
          <SeccionesSection negocio={negocio} />
        </SectionErrorBoundary>
      </div>
    )
  }
  if (subTab === "opciones") {
    return (
      <div className="space-y-4">
        <CatalogSubNav subTab={subTab} setSubTab={setSubTab} items={subTabItems} colorPrincipal={negocio.colorPrincipal} />
        <SectionErrorBoundary>
          <OpcionesCompartidasSection negocio={negocio} />
        </SectionErrorBoundary>
      </div>
    )
  }

  // For ropa: in simple mode, use 2 steps ["Prenda", "Guardar"]
  // In expert mode, use 3 steps ["Info básica", "Detalles", "Revisar"]
  // For restaurant: same as before
  const stepLabels = isRopa
    ? (mode === "expert"
      ? ["Info básica", "Detalles", "Revisar"]
      : ["Prenda", "Guardar"])
    : (mode === "expert"
      ? ["Info básica", "Opciones avanzadas", "Revisar"]
      : ["Info", "Guardar"])

  const maxStep = mode === "expert" ? 2 : 1

  return (
    <div className="space-y-4">
      {/* ===== CATALOG SUB-TABS ===== */}
      <CatalogSubNav subTab={subTab} setSubTab={setSubTab} items={subTabItems} colorPrincipal={negocio.colorPrincipal} />

      {/* ===== SEARCH BAR ===== */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={isRopa ? "Buscar prendas..." : "Buscar productos..."}
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
          Todos ({productos.length})
        </button>
        {categories.map((cat) => (
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
            {cat} ({productos.filter((p) => p.categoria === cat).length})
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setRenameCategoryDialog(cat); setRenameCategoryInput(cat) }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setRenameCategoryDialog(cat); setRenameCategoryInput(cat) } }}
              className="ml-0.5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-primary/10 hover:text-primary"
              title="Renombrar categoría"
            >
              <Edit3 className="h-3 w-3" />
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setDeleteCategoryDialog(cat) }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setDeleteCategoryDialog(cat) } }}
              className="ml-0.5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive"
              title="Eliminar categoría"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
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
                  if (e.key === "Enter" && categoryInput.trim()) {
                    handleAddCategory(categoryInput)
                  }
                }}
              />
              <Button
                size="sm"
                className="h-8 rounded-lg"
                style={{ backgroundColor: negocio.colorPrincipal }}
                onClick={() => {
                  if (categoryInput.trim()) {
                    handleAddCategory(categoryInput)
                  }
                }}
                disabled={updateCategoriasMutation.isPending}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => { setShowCategoryInput(false); setCategoryInput("") }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== ADD PRODUCT BUTTON ===== */}
      <Button
        onClick={openNewForm}
        className="w-full rounded-xl h-11 gap-2 font-semibold"
        style={{ backgroundColor: negocio.colorPrincipal }}
      >
        <Plus className="h-4 w-4" />
        {isRopa ? "Agregar prenda" : "Agregar producto"}
      </Button>

      {/* ===== PRODUCT GRID ===== */}
      {loadingProducts ? (
        <ProductGridSkeleton />
      ) : filteredProducts.length === 0 ? (
        <EmptyProducts isRopa={isRopa} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              colorPrincipal={negocio.colorPrincipal}
              onEdit={() => openEditForm(product)}
              onDelete={() => setDeleteDialog(product.id)}
              delay={i * 0.03}
              isRopa={isRopa}
            />
          ))}
        </div>
      )}

      {/* ===== PRODUCT FORM DRAWER ===== */}
      <Drawer open={formOpen} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              {editingProduct ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  {isRopa ? "Editar prenda" : "Editar producto"}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {isRopa ? "Nueva prenda" : "Nuevo producto"}
                </>
              )}
            </DrawerTitle>
          </DrawerHeader>

          {/* Step indicator */}
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2">
              {stepLabels.map((label, i) => (
                <div key={i} className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                      formStep === i
                        ? "bg-primary text-primary-foreground"
                        : formStep > i
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {formStep > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={cn(
                    "text-xs font-medium hidden sm:inline truncate",
                    formStep === i ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                  {i < maxStep && <div className="flex-1 h-px bg-border" />}
                </div>
              ))}
            </div>
          </div>

          {/* Form content — scrollable area */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
            <AnimatePresence mode="wait">
              {formStep === 0 && (
                <StepBasicInfo
                  key="step0"
                  formData={formData}
                  setFormData={setFormData}
                  categories={categories}
                  slug={negocio.slug}
                  onAddCategory={handleAddCategory}
                  isRopa={isRopa}
                  isNegocio={isNegocio}
                />
              )}
              {mode === "expert" && formStep === 1 && (
                isRopa ? (
                  <StepRopaDetails
                    key="step1-ropa"
                    formData={formData}
                    setFormData={setFormData}
                    opcionesCompartidas={opcionesCompartidas}
                  />
                ) : isNegocio ? (
                  <StepNegocioDetails
                    key="step1-negocio"
                    formData={formData}
                    setFormData={setFormData}
                    opcionesCompartidas={opcionesCompartidas}
                  />
                ) : (
                  <StepOptions
                    key="step1-rest"
                    formData={formData}
                    setFormData={setFormData}
                    mode={mode}
                    agregados={agregados}
                    ingredientes={ingredientes}
                    opcionesCompartidas={opcionesCompartidas}
                  />
                )
              )}
              {((mode === "expert" && formStep === 2) || (mode === "simple" && formStep === 1)) && (
                <StepReview
                  key="step2"
                  formData={formData}
                  discountedPrice={discountedPrice}
                  mode={mode}
                  agregados={agregados}
                  ingredientes={ingredientes}
                  isRopa={isRopa}
                  isNegocio={isNegocio}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Navigation footer */}
          <DrawerFooter className="border-t pt-3">
            <div className="flex gap-2">
              {formStep > 0 && (
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setFormStep((s) => s - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
              )}
              {formStep < maxStep ? (
                <Button
                  className="flex-1 rounded-xl"
                  style={{ backgroundColor: negocio.colorPrincipal }}
                  onClick={() => setFormStep((s) => s + 1)}
                  disabled={formStep === 0 && (!formData.nombre || formData.precio <= 0 || (isRopa && !formData.tipoPrenda && formData.categoria === "Sin Categoria"))}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  className="flex-1 rounded-xl"
                  style={{ backgroundColor: negocio.colorPrincipal }}
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "Guardando..." : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      {isRopa ? "Guardar prenda" : "Guardar producto"}
                    </>
                  )}
                </Button>
              )}
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
              {isRopa ? "Eliminar prenda" : "Eliminar producto"}
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog)}
              disabled={deleteMutation.isPending}
            >
              Eliminar
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
              ¿Eliminar la categoría <strong>{deleteCategoryDialog}</strong>? Los productos en esta categoría se moverán a "Sin categoría".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteCategoryDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => deleteCategoryDialog && deleteCategoryMutation.mutate(deleteCategoryDialog)}
              disabled={deleteCategoryMutation.isPending}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== RENAME CATEGORY DIALOG ===== */}
      <Dialog open={!!renameCategoryDialog} onOpenChange={(open) => { if (!open) { setRenameCategoryDialog(null); setRenameCategoryInput("") } }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Renombrar categoría
            </DialogTitle>
            <DialogDescription>
              Cambiar el nombre de <strong>{renameCategoryDialog}</strong>. Todos los productos en esta categoría se actualizarán automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameCategoryInput}
              onChange={(e) => setRenameCategoryInput(e.target.value)}
              placeholder="Nuevo nombre..."
              className="rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameCategoryDialog && renameCategoryInput.trim() && renameCategoryInput.trim() !== renameCategoryDialog) {
                  renameCategoryMutation.mutate({ oldName: renameCategoryDialog, newName: renameCategoryInput.trim() })
                }
              }}
              autoFocus
            />
            {renameCategoryDialog && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {productos.filter((p) => p.categoria === renameCategoryDialog).length} productos serán actualizados
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setRenameCategoryDialog(null); setRenameCategoryInput("") }}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              style={{ backgroundColor: negocio.colorPrincipal }}
              onClick={() => {
                if (renameCategoryDialog && renameCategoryInput.trim() && renameCategoryInput.trim() !== renameCategoryDialog) {
                  renameCategoryMutation.mutate({ oldName: renameCategoryDialog, newName: renameCategoryInput.trim() })
                }
              }}
              disabled={renameCategoryMutation.isPending || !renameCategoryInput.trim() || renameCategoryInput.trim() === renameCategoryDialog}
            >
              {renameCategoryMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Product Card
// ============================================
function ProductCard({
  product,
  colorPrincipal,
  onEdit,
  onDelete,
  delay,
  isRopa,
}: {
  product: Producto
  colorPrincipal: string
  onEdit: () => void
  onDelete: () => void
  delay: number
  isRopa: boolean
}) {
  const hasDiscount = product.descuentoActivo && product.valorDescuento > 0
  const finalPrice = hasDiscount
    ? product.tipoDescuento === "porcentaje"
      ? product.precio * (1 - product.valorDescuento / 100)
      : Math.max(0, product.precio - product.valorDescuento)
    : product.precio

  // Parse talles/colores for ropa cards
  const talles: string[] = useMemo(() => {
    try { return JSON.parse(product.talles) as string[] }
    catch { return [] }
  }, [product.talles])

  const colores: string[] = useMemo(() => {
    try { return JSON.parse(product.colores) as string[] }
    catch { return [] }
  }, [product.colores])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="rounded-2xl border-border/50 overflow-hidden hover:shadow-md transition-shadow group">
        {/* Image */}
        <div
          className="relative h-36 overflow-hidden bg-muted/30"
          style={{
            background: product.imagenUrl
              ? undefined
              : `linear-gradient(135deg, ${colorPrincipal}15, ${colorPrincipal}05)`,
          }}
        >
          {product.imagenUrl ? (
            <img
              src={product.imagenUrl}
              alt={product.nombre}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isRopa ? (
                <Shirt className="h-8 w-8 text-muted-foreground/20" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
              )}
            </div>
          )}

          {/* Stock badge */}
          <div className="absolute top-2 left-2">
            <Badge
              className={cn(
                "text-[10px] font-bold border-0",
                product.stock
                  ? "bg-green-500/90 text-white"
                  : "bg-red-500/90 text-white"
              )}
            >
              {product.stock ? "En stock" : "Sin stock"}
            </Badge>
          </div>

          {/* Discount badge */}
          {hasDiscount && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-red-500 text-white border-0 text-[10px] font-bold">
                {product.tipoDescuento === "porcentaje"
                  ? `-${product.valorDescuento}%`
                  : `-${formatPrice(product.valorDescuento)}`}
              </Badge>
            </div>
          )}

          {/* Actions overlay - desktop hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors items-center justify-center gap-2 opacity-0 group-hover:opacity-100 hidden sm:flex">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Info */}
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold truncate">{product.nombre}</h4>
              <Badge
                variant="secondary"
                className="mt-1 text-[10px] font-medium border-0"
                style={{ backgroundColor: `${colorPrincipal}12`, color: colorPrincipal }}
              >
                {product.categoria}
              </Badge>
            </div>
            <div className="text-right shrink-0">
              {hasDiscount ? (
                <div>
                  <span className="text-xs line-through text-muted-foreground">
                    {formatPrice(product.precio)}
                  </span>
                  <p className="text-sm font-bold text-red-600">{formatPrice(finalPrice)}</p>
                </div>
              ) : (
                <p className="text-sm font-bold">{formatPrice(product.precio)}</p>
              )}
            </div>
          </div>

          {/* Ropa-specific details */}
          {isRopa && (talles.length > 0 || colores.length > 0) && (
            <div className="mt-2 space-y-1">
              {talles.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Ruler className="h-3 w-3 text-muted-foreground shrink-0" />
                  {talles.slice(0, 5).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground">
                      {t}
                    </span>
                  ))}
                  {talles.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{talles.length - 5}</span>
                  )}
                </div>
              )}
              {colores.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Palette className="h-3 w-3 text-muted-foreground shrink-0" />
                  {colores.slice(0, 4).map((c) => (
                    <span key={c} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground">
                      {c}
                    </span>
                  ))}
                  {colores.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{colores.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mobile action buttons - always visible */}
          <div className="flex gap-2 mt-2 sm:hidden">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 rounded-lg text-xs gap-1.5"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
            >
              <Edit3 className="h-3 w-3" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Step 1: Basic Info
// ============================================
function StepBasicInfo({
  formData,
  setFormData,
  categories,
  slug,
  onAddCategory,
  isRopa,
  isNegocio,
}: {
  formData: ProductFormData
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>
  categories: string[]
  slug: string
  onAddCategory: (name: string) => void
  isRopa: boolean
  isNegocio: boolean
}) {
  const [newCatInput, setNewCatInput] = useState("")
  const [showNewCat, setShowNewCat] = useState(false)

  const handleCreateCategory = () => {
    const trimmed = newCatInput.trim()
    if (!trimmed) return
    onAddCategory(trimmed)
    setFormData((p) => ({ ...p, categoria: trimmed }))
    setNewCatInput("")
    setShowNewCat(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="prod-nombre" className="text-sm font-semibold mb-1.5 block">
          {isRopa ? "Nombre de la prenda *" : "Nombre *"}
        </Label>
        <Input
          id="prod-nombre"
          value={formData.nombre}
          onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
          placeholder={isRopa ? "Ej: Remera oversize" : "Ej: Hamburguesa doble"}
          className="rounded-xl"
        />
      </div>

      <div>
        <Label htmlFor="prod-precio" className="text-sm font-semibold mb-1.5 block">Precio *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
          <Input
            id="prod-precio"
            type="number"
            min={0}
            step={0.01}
            value={formData.precio || ""}
            onChange={(e) => setFormData((p) => ({ ...p, precio: parseFloat(e.target.value) || 0 }))}
            placeholder="0.00"
            className="rounded-xl pl-7"
          />
        </div>
      </div>

      {isRopa ? (
        /* ===== ROPA: Tipo de prenda (predefined) ===== */
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
              <Shirt className="h-3.5 w-3.5" />
              Tipo de prenda *
            </Label>
            <Select
              value={formData.tipoPrenda}
              onValueChange={(v) => {
                if (v === "__otro__") {
                  // Show custom input, don't set tipoPrenda yet
                  setShowNewCat(true)
                  return
                }
                const selected = tipoPrendaFlat.find((t) => t.value === v)
                const label = selected?.label ?? v
                setFormData((p) => ({
                  ...p,
                  tipoPrenda: v,
                  categoria: label,
                }))
                setShowNewCat(false)
              }}
            >
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue placeholder="Seleccioná el tipo de prenda..." />
              </SelectTrigger>
              <SelectContent>
                {tipoPrendaOptions.map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {group.group}
                    </SelectLabel>
                    {group.items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Otro
                  </SelectLabel>
                  <SelectItem value="__otro__">Otra categoría...</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Custom category input (shown when "Otra categoría" is selected) */}
          {showNewCat && (
            <div className="flex gap-2">
              <Input
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="Ej: Buzos, Pantalones..."
                className="h-8 text-sm rounded-lg flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleCreateCategory() }
                }}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg shrink-0"
                onClick={handleCreateCategory}
                disabled={!newCatInput.trim()}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg shrink-0"
                onClick={() => { setShowNewCat(false); setNewCatInput("") }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Show selected category label if tipoPrenda is set */}
          {formData.tipoPrenda && !showNewCat && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/15">
              <Wand2 className="h-3 w-3 text-primary" />
              <span className="text-xs text-primary font-medium">
                Talles inteligentes para {tipoPrendaFlat.find((t) => t.value === formData.tipoPrenda)?.label ?? formData.tipoPrenda}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ===== RESTAURANT & NEGOCIO: Categoría (free-form) ===== */
        <div>
          <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
            Categoría
            <button
              type="button"
              onClick={() => setShowNewCat(!showNewCat)}
              className="p-0.5 rounded-md hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </Label>
          {showNewCat && (
            <div className="flex gap-2 mb-2">
              <Input
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder={isNegocio ? "Ej: Herramientas, Lubricantes..." : "Nueva categoría..."}
                className="h-8 text-sm rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleCreateCategory() }
                }}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg shrink-0"
                onClick={handleCreateCategory}
                disabled={!newCatInput.trim()}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg shrink-0"
                onClick={() => { setShowNewCat(false); setNewCatInput("") }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Select
            value={formData.categoria}
            onValueChange={(v) => setFormData((p) => ({ ...p, categoria: v }))}
          >
            <SelectTrigger className="rounded-xl w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sin Categoria">Sin categoría</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Ropa: Talles, colores, género in step 1 (simple mode doesn't have step 2) */}
      {isRopa && (
        <div className="space-y-4">
          {/* Talles — smart presets based on tipo de prenda */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5" />
              Talles disponibles
            </Label>
            <ChipInput
              chips={(() => { try { return JSON.parse(formData.talles) as string[] } catch { return [] } })()}
              onChange={(chips) => setFormData((p) => ({ ...p, talles: JSON.stringify(chips) }))}
              placeholder="Escribí un talle y presioná Enter"
              presets={getTallesForTipoPrenda(formData.tipoPrenda)}
              presetLabel={formData.tipoPrenda
                ? `Talles para ${tipoPrendaFlat.find((t) => t.value === formData.tipoPrenda)?.label ?? formData.tipoPrenda} (tocá para agregar)`
                : "Seleccioná un tipo de prenda para ver talles sugeridos"}
            />
          </div>

          {/* Colores */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              Colores disponibles
            </Label>
            <ChipInput
              chips={(() => { try { return JSON.parse(formData.colores) as string[] } catch { return [] } })()}
              onChange={(chips) => setFormData((p) => ({ ...p, colores: JSON.stringify(chips) }))}
              placeholder="Escribí un color y presioná Enter"
              presets={coloresPresets}
              presetLabel="Colores comunes (tocá para agregar)"
            />
          </div>

          {/* Género */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Género</Label>
            <Select
              value={formData.genero}
              onValueChange={(v) => setFormData((p) => ({ ...p, genero: v }))}
            >
              <SelectTrigger className="rounded-xl w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generoOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Material */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Material
            </Label>
            <Input
              value={formData.material}
              onChange={(e) => setFormData((p) => ({ ...p, material: e.target.value }))}
              placeholder="Algodón, Polyester, Lycra..."
              className="rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Imagen principal */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 block">Imagen principal</Label>
        <ImageUpload
          value={formData.imagenUrl || null}
          onChange={(url) => setFormData((p) => ({ ...p, imagenUrl: url }))}
          onRemove={() => setFormData((p) => ({ ...p, imagenUrl: "" }))}
          category="productos"
          slug={slug}
          variant="square"
          placeholder={isRopa ? "Subir foto de la prenda" : "Subir imagen principal"}
        />
      </div>

      {/* Galería de imágenes */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 block">
          {isRopa ? "Más fotos de la prenda" : "Galería de imágenes"}
        </Label>
        <MultiImageUpload
          value={formData.imagenesExtra}
          onChange={(urls) => setFormData((p) => ({ ...p, imagenesExtra: urls }))}
          category="productos"
          slug={slug}
          max={6}
        />
      </div>

      {/* Stock toggle in simple mode for ropa */}
      {isRopa && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
          <div>
            <p className="text-sm font-semibold">Stock disponible</p>
            <p className="text-xs text-muted-foreground">
              {formData.stock ? "La prenda aparece en el catálogo" : "Oculta del catálogo"}
            </p>
          </div>
          <Switch
            checked={formData.stock}
            onCheckedChange={(v) => setFormData((p) => ({ ...p, stock: v }))}
          />
        </div>
      )}
    </motion.div>
  )
}

// ============================================
// Step 2 for Ropa: Details (Expert Mode)
// ============================================
function StepRopaDetails({
  formData,
  setFormData,
  opcionesCompartidas,
}: {
  formData: ProductFormData
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>
  opcionesCompartidas: { id: string; nombre: string; opciones: string; obligatorio: boolean; maximo: number }[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      {/* Stock */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
        <div>
          <p className="text-sm font-semibold">Stock disponible</p>
          <p className="text-xs text-muted-foreground">
            {formData.stock ? "La prenda aparece en el catálogo" : "Oculta del catálogo"}
          </p>
        </div>
        <Switch
          checked={formData.stock}
          onCheckedChange={(v) => setFormData((p) => ({ ...p, stock: v }))}
        />
      </div>

      {/* Discount */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Descuento</p>
          <Switch
            checked={formData.descuentoActivo}
            onCheckedChange={(v) => setFormData((p) => ({ ...p, descuentoActivo: v }))}
          />
        </div>
        {formData.descuentoActivo && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={formData.tipoDescuento}
              onValueChange={(v) => setFormData((p) => ({ ...p, tipoDescuento: v }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="porcentaje">Porcentaje %</SelectItem>
                <SelectItem value="monto">Monto fijo $</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              value={formData.valorDescuento || ""}
              onChange={(e) => setFormData((p) => ({ ...p, valorDescuento: parseFloat(e.target.value) || 0 }))}
              placeholder="0"
              className="rounded-xl"
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Talles (smart presets based on tipo de prenda) */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5" />
          Talles disponibles
        </Label>
        <ChipInput
          chips={(() => { try { return JSON.parse(formData.talles) as string[] } catch { return [] } })()}
          onChange={(chips) => setFormData((p) => ({ ...p, talles: JSON.stringify(chips) }))}
          placeholder="Escribí un talle y presioná Enter"
          presets={getTallesForTipoPrenda(formData.tipoPrenda)}
          presetLabel={formData.tipoPrenda
            ? `Talles para ${tipoPrendaFlat.find((t) => t.value === formData.tipoPrenda)?.label ?? formData.tipoPrenda} (tocá para agregar)`
            : "Seleccioná un tipo de prenda para ver talles sugeridos"}
        />
      </div>

      {/* Colores */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5" />
          Colores disponibles
        </Label>
        <ChipInput
          chips={(() => { try { return JSON.parse(formData.colores) as string[] } catch { return [] } })()}
          onChange={(chips) => setFormData((p) => ({ ...p, colores: JSON.stringify(chips) }))}
          placeholder="Escribí un color y presioná Enter"
          presets={coloresPresets}
          presetLabel="Colores comunes (tocá para agregar)"
        />
      </div>

      {/* Material */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          Material
        </Label>
        <Input
          value={formData.material}
          onChange={(e) => setFormData((p) => ({ ...p, material: e.target.value }))}
          placeholder="Algodón, Polyester, Lycra..."
          className="rounded-xl"
        />
      </div>

      {/* Género */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 block">Género</Label>
        <Select
          value={formData.genero}
          onValueChange={(v) => setFormData((p) => ({ ...p, genero: v }))}
        >
          <SelectTrigger className="rounded-xl w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {generoOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 block">Descripción</Label>
        <Textarea
          value={formData.descripcion}
          onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
          placeholder="Describí la prenda: fit, estilo, recomendaciones de lavado..."
          className="rounded-xl min-h-[80px] resize-none"
        />
      </div>

      {/* Secciones de opciones del producto */}
      <ProductOptionSectionsEditor
        formData={formData}
        setFormData={setFormData}
        isRopa={true}
        opcionesCompartidas={opcionesCompartidas}
      />
    </motion.div>
  )
}

// ============================================
// Step 2 for Negocio: Simple Details (Expert Mode)
// ============================================
function StepNegocioDetails({
  formData,
  setFormData,
  opcionesCompartidas,
}: {
  formData: ProductFormData
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>
  opcionesCompartidas: { id: string; nombre: string; opciones: string; obligatorio: boolean; maximo: number }[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      {/* Stock */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
        <div>
          <p className="text-sm font-semibold">Stock disponible</p>
          <p className="text-xs text-muted-foreground">
            {formData.stock ? "El producto aparece en el catálogo" : "Oculto del catálogo"}
          </p>
        </div>
        <Switch
          checked={formData.stock}
          onCheckedChange={(v) => setFormData((p) => ({ ...p, stock: v }))}
        />
      </div>

      {/* Discount */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Descuento</p>
          <Switch
            checked={formData.descuentoActivo}
            onCheckedChange={(v) => setFormData((p) => ({ ...p, descuentoActivo: v }))}
          />
        </div>
        {formData.descuentoActivo && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={formData.tipoDescuento}
              onValueChange={(v) => setFormData((p) => ({ ...p, tipoDescuento: v }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="porcentaje">Porcentaje %</SelectItem>
                <SelectItem value="monto">Monto fijo $</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              value={formData.valorDescuento || ""}
              onChange={(e) => setFormData((p) => ({ ...p, valorDescuento: parseFloat(e.target.value) || 0 }))}
              placeholder="0"
              className="rounded-xl"
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Description */}
      <div>
        <Label className="text-sm font-semibold mb-1.5 block">Descripción</Label>
        <Textarea
          value={formData.descripcion}
          onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
          placeholder="Describí el producto: características, usos, especificaciones..."
          className="rounded-xl min-h-[80px] resize-none"
        />
      </div>

      {/* Secciones de opciones del producto */}
      <ProductOptionSectionsEditor
        formData={formData}
        setFormData={setFormData}
        isRopa={false}
        opcionesCompartidas={opcionesCompartidas}
      />
    </motion.div>
  )
}

// ============================================
// Step 2 for Restaurant: Options (Expert Mode)
// ============================================
function StepOptions({
  formData,
  setFormData,
  mode,
  agregados,
  ingredientes,
  opcionesCompartidas,
}: {
  formData: ProductFormData
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>
  mode: PanelMode
  agregados: Agregado[]
  ingredientes: Ingrediente[]
  opcionesCompartidas: { id: string; nombre: string; opciones: string; obligatorio: boolean; maximo: number }[]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-5"
    >
      {/* Stock - Always shown */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
        <div>
          <p className="text-sm font-semibold">Stock disponible</p>
          <p className="text-xs text-muted-foreground">
            {formData.stock ? "El producto aparece en el catálogo" : "Oculto del catálogo"}
          </p>
        </div>
        <Switch
          checked={formData.stock}
          onCheckedChange={(v) => setFormData((p) => ({ ...p, stock: v }))}
        />
      </div>

      {/* Discount - Always shown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Descuento</p>
          <Switch
            checked={formData.descuentoActivo}
            onCheckedChange={(v) => setFormData((p) => ({ ...p, descuentoActivo: v }))}
          />
        </div>
        {formData.descuentoActivo && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={formData.tipoDescuento}
              onValueChange={(v) => setFormData((p) => ({ ...p, tipoDescuento: v }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="porcentaje">Porcentaje %</SelectItem>
                <SelectItem value="monto">Monto fijo $</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              value={formData.valorDescuento || ""}
              onChange={(e) => setFormData((p) => ({ ...p, valorDescuento: parseFloat(e.target.value) || 0 }))}
              placeholder="0"
              className="rounded-xl"
            />
          </div>
        )}
      </div>

      {/* ===== EXPERT MODE FIELDS ===== */}
      {mode === "expert" && (
        <>
          <Separator />

          {/* Description */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Descripción</Label>
            <Textarea
              value={formData.descripcion}
              onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Descripción del producto..."
              className="rounded-xl min-h-[80px] resize-none"
            />
          </div>

          {/* Agregados */}
          {agregados.length > 0 && (
            <div>
              <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Agregados
              </Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {agregados.map((ag) => (
                  <label
                    key={ag.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                      formData.agregadosIds.includes(ag.id)
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted/40 hover:bg-muted/60 border border-transparent"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={formData.agregadosIds.includes(ag.id)}
                      onChange={() => {
                        const ids = formData.agregadosIds.includes(ag.id)
                          ? formData.agregadosIds.filter((i) => i !== ag.id)
                          : [...formData.agregadosIds, ag.id]
                        setFormData((p) => ({ ...p, agregadosIds: ids }))
                      }}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      formData.agregadosIds.includes(ag.id)
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}>
                      {formData.agregadosIds.includes(ag.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="text-sm flex-1">{ag.nombre}</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      +{formatPrice(ag.precio)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Ingredientes */}
          {ingredientes.length > 0 && (
            <div>
              <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                🥬 Ingredientes
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {ingredientes.map((ing) => (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() => {
                      const ids = formData.ingredientesIds.includes(ing.id)
                        ? formData.ingredientesIds.filter((i) => i !== ing.id)
                        : [...formData.ingredientesIds, ing.id]
                      setFormData((p) => ({ ...p, ingredientesIds: ids }))
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                      formData.ingredientesIds.includes(ing.id)
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    {ing.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Secciones de opciones del producto */}
          <ProductOptionSectionsEditor
            formData={formData}
            setFormData={setFormData}
            opcionesCompartidas={opcionesCompartidas}
          />
        </>
      )}
    </motion.div>
  )
}

// ============================================
// Product Option Sections Editor
// ============================================
interface ProductOptionSection {
  nombre: string
  opciones: string[]
  obligatorio: boolean
  maximo: number // 0 = single select (default), >1 = multi-select with per-option quantity
}

function ProductOptionSectionsEditor({
  formData,
  setFormData,
  isRopa = false,
  opcionesCompartidas = [],
}: {
  formData: ProductFormData
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>
  isRopa?: boolean
  opcionesCompartidas?: { id: string; nombre: string; opciones: string; obligatorio: boolean; maximo: number }[]
}) {
  const sections: ProductOptionSection[] = useMemo(() => {
    try {
      const parsed = JSON.parse(formData.secciones)
      if (!Array.isArray(parsed)) return []
      // Normalize each section to ensure all properties exist (handles old/incomplete formats)
      return parsed.map((s: Record<string, unknown>) => ({
        nombre: typeof s?.nombre === "string" ? s.nombre : String(s ?? ""),
        opciones: Array.isArray(s?.opciones) ? s.opciones as string[] : [],
        obligatorio: s?.obligatorio === true,
        maximo: typeof s?.maximo === "number" ? s.maximo : 0,
      }))
    } catch {
      return []
    }
  }, [formData.secciones])

  const updateSections = (updated: ProductOptionSection[]) => {
    setFormData((p) => ({ ...p, secciones: JSON.stringify(updated) }))
  }

  const addSection = () => {
    updateSections([...sections, { nombre: "", opciones: [], obligatorio: false, maximo: 0 }])
  }

  const removeSection = (index: number) => {
    updateSections(sections.filter((_, i) => i !== index))
  }

  const updateSection = (index: number, field: Partial<ProductOptionSection>) => {
    const updated = [...sections]
    updated[index] = { ...updated[index], ...field }
    updateSections(updated)
  }

  const addOption = (sectionIndex: number) => {
    const updated = [...sections]
    updated[sectionIndex] = {
      ...updated[sectionIndex],
      opciones: [...updated[sectionIndex].opciones, ""],
    }
    updateSections(updated)
  }

  const removeOption = (sectionIndex: number, optionIndex: number) => {
    const updated = [...sections]
    updated[sectionIndex] = {
      ...updated[sectionIndex],
      opciones: updated[sectionIndex].opciones.filter((_, i) => i !== optionIndex),
    }
    updateSections(updated)
  }

  const updateOption = (sectionIndex: number, optionIndex: number, value: string) => {
    const updated = [...sections]
    const newOpciones = [...updated[sectionIndex].opciones]
    newOpciones[optionIndex] = value
    updated[sectionIndex] = { ...updated[sectionIndex], opciones: newOpciones }
    updateSections(updated)
  }

  // Shared options toggle — stores per-product obligatorio/maximo config
  const toggleOpcionCompartida = (id: string) => {
    setFormData((p) => {
      const existing = p.opcionesCompartidasIds.find((c) => c.id === id)
      if (existing) {
        // Deselect: remove from list
        return { ...p, opcionesCompartidasIds: p.opcionesCompartidasIds.filter((c) => c.id !== id) }
      }
      // Select: add with defaults from the shared option definition
      const sharedOpt = opcionesCompartidas.find((o) => o.id === id)
      return {
        ...p,
        opcionesCompartidasIds: [
          ...p.opcionesCompartidasIds,
          { id, obligatorio: sharedOpt?.obligatorio ?? false, maximo: sharedOpt?.maximo ?? 0 },
        ],
      }
    })
  }

  // Update per-product config for a shared option
  const updateOpcionCompartidaConfig = (id: string, field: "obligatorio" | "maximo", value: boolean | number) => {
    setFormData((p) => ({
      ...p,
      opcionesCompartidasIds: p.opcionesCompartidasIds.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    }))
  }

  const sectionLabel = "Secciones de opciones"
  const sectionPlaceholder = isRopa ? "Nombre de la sección (ej: Tiro, Estilo)" : "Nombre de la sección (ej: Punto de cocción)"
  const sectionHelp = isRopa
    ? 'Secciones de opciones del producto (ej: "Tiro" → Alto, Bajo). Usá "Max. elecciones" para permitir varias elecciones.'
    : 'Elegibles del producto (ej: "Punto de cocción" → Medio, Bien cocido). Usá "Max. elecciones" para permitir varias elecciones en una misma sección.'

  return (
    <div>
      {/* ===== Shared Options Selector ===== */}
      {opcionesCompartidas.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-sm font-semibold">Opciones compartidas</Label>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            Seleccioná secciones de opciones pre-creadas para este producto
          </p>
          <div className="flex flex-wrap gap-2">
            {opcionesCompartidas.map((op) => {
              const config = formData.opcionesCompartidasIds.find((c) => c.id === op.id)
              const isSelected = !!config
              const opcionCount = (() => {
                try { return (JSON.parse(op.opciones) as unknown[]).length }
                catch { return 0 }
              })()
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => toggleOpcionCompartida(op.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                    isSelected
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all",
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  {op.nombre}
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({opcionCount} {opcionCount === 1 ? "opción" : "opciones"})
                  </span>
                </button>
              )
            })}
          </div>
          {/* Per-product config for selected shared options */}
          {formData.opcionesCompartidasIds.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {formData.opcionesCompartidasIds.map((cfg) => {
                const sharedOpt = opcionesCompartidas.find((o) => o.id === cfg.id)
                if (!sharedOpt) return null
                return (
                  <div key={cfg.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/30 border border-border/50">
                    <span className="text-xs font-semibold flex-1 truncate">{sharedOpt.nombre}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-[10px] text-muted-foreground">Obligatorio</span>
                        <Switch
                          checked={cfg.obligatorio}
                          onCheckedChange={(v) => updateOpcionCompartidaConfig(cfg.id, "obligatorio", v)}
                          className="scale-75"
                        />
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Max.</span>
                        <Input
                          type="number"
                          min={0}
                          value={cfg.maximo}
                          onChange={(e) => updateOpcionCompartidaConfig(cfg.id, "maximo", parseInt(e.target.value) || 0)}
                          className="h-6 w-12 text-xs text-center p-0 border-border/50"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              <Separator />
            </div>
          )}
        </div>
      )}

      {/* ===== Custom Option Sections ===== */}
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          {sectionLabel}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 rounded-lg"
          onClick={addSection}
        >
          <Plus className="h-3 w-3" />
          Agregar
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">{sectionHelp}</p>

      {sections.length === 0 ? (
        <div className="flex flex-col items-center py-4 rounded-xl border-2 border-dashed border-border/50 bg-muted/20">
          <ListChecks className="h-6 w-6 text-muted-foreground/30 mb-1.5" />
          <p className="text-xs text-muted-foreground">Sin secciones</p>
          <button
            type="button"
            onClick={addSection}
            className="text-xs text-primary font-medium mt-1 hover:underline"
          >
            Agregar una sección
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section, si) => (
            <div
              key={si}
              className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5"
            >
              {/* Section header */}
              <div className="flex items-center gap-2">
                <Input
                  value={section.nombre}
                  onChange={(e) => updateSection(si, { nombre: e.target.value })}
                  placeholder={sectionPlaceholder}
                  className="rounded-lg text-sm h-8 flex-1"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                    <Switch
                      checked={section.obligatorio}
                      onCheckedChange={(v) => updateSection(si, { obligatorio: v })}
                      className="scale-75"
                    />
                    Oblig.
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                    onClick={() => removeSection(si)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Max selections */}
              <div className="flex items-center gap-2 px-1">
                <label className="text-[10px] text-muted-foreground shrink-0">
                  Max. elecciones
                </label>
                <Input
                  type="number"
                  min={0}
                  value={section.maximo || 0}
                  onChange={(e) => updateSection(si, { maximo: parseInt(e.target.value) || 0 })}
                  className="rounded-lg text-sm h-7 w-20"
                  placeholder="0"
                />
                <span className="text-[10px] text-muted-foreground">
                  {section.maximo === 0
                    ? "1 sola opción (radio)"
                    : `${section.maximo} elecciones (puede repetir)`}
                </span>
              </div>

              {/* Options */}
              <div className="space-y-1.5 pl-1">
                {(section.opciones ?? []).map((option, oi) => (
                  <div key={oi} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/20 shrink-0" />
                    <Input
                      value={option}
                      onChange={(e) => updateOption(si, oi, e.target.value)}
                      placeholder={`Opción ${oi + 1}`}
                      className="rounded-lg text-sm h-7 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500"
                      onClick={() => removeOption(si, oi)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(si)}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline pl-4 py-0.5"
                >
                  <Plus className="h-3 w-3" />
                  Agregar opción
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// Step 3: Review
// ============================================
function StepReview({
  formData,
  discountedPrice,
  mode,
  agregados,
  ingredientes,
  isRopa,
  isNegocio,
}: {
  formData: ProductFormData
  discountedPrice: number
  mode: PanelMode
  agregados: Agregado[]
  ingredientes: Ingrediente[]
  isRopa: boolean
  isNegocio: boolean
}) {
  const selectedAgregados = agregados.filter((a) => formData.agregadosIds.includes(a.id))
  const selectedIngredientes = ingredientes.filter((i) => formData.ingredientesIds.includes(i.id))

  // Parse talles/colores for ropa
  const talles: string[] = useMemo(() => {
    try { return JSON.parse(formData.talles) as string[] }
    catch { return [] }
  }, [formData.talles])

  const colores: string[] = useMemo(() => {
    try { return JSON.parse(formData.colores) as string[] }
    catch { return [] }
  }, [formData.colores])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Product preview card */}
      <Card className="rounded-2xl border-border/50 overflow-hidden">
        <div
          className="h-28 flex items-center justify-center bg-muted/30"
          style={{
            background: formData.imagenUrl
              ? undefined
              : "linear-gradient(135deg, #FB8C0015, #FB8C0005)",
          }}
        >
          {formData.imagenUrl ? (
            <img src={formData.imagenUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            isRopa ? <Shirt className="h-8 w-8 text-muted-foreground/20" /> : <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
          )}
        </div>
        <CardContent className="p-4">
          <h4 className="font-bold text-base">{formData.nombre || "Sin nombre"}</h4>
          <Badge variant="secondary" className="mt-1 text-[10px] border-0">
            {formData.categoria}
          </Badge>
          <div className="mt-2 flex items-baseline gap-2">
            {formData.descuentoActivo && formData.valorDescuento > 0 ? (
              <>
                <span className="text-sm line-through text-muted-foreground">
                  {formatPrice(formData.precio)}
                </span>
                <span className="text-xl font-bold text-red-600">
                  {formatPrice(discountedPrice)}
                </span>
              </>
            ) : (
              <span className="text-xl font-bold">{formatPrice(formData.precio)}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details list */}
      <div className="space-y-2">
        <ReviewRow label="Stock" value={formData.stock ? "✅ Disponible" : "❌ Sin stock"} />
        {formData.descuentoActivo && (
          <ReviewRow
            label="Descuento"
            value={formData.tipoDescuento === "porcentaje"
              ? `${formData.valorDescuento}%`
              : formatPrice(formData.valorDescuento)}
          />
        )}
        {isRopa && talles.length > 0 && (
          <ReviewRow label="Talles" value={talles.join(", ")} />
        )}
        {isRopa && colores.length > 0 && (
          <ReviewRow label="Colores" value={colores.join(", ")} />
        )}
        {isRopa && formData.material && (
          <ReviewRow label="Material" value={formData.material} />
        )}
        {isRopa && formData.genero && formData.genero !== "sin-especificar" && (
          <ReviewRow label="Género" value={generoOptions.find(g => g.value === formData.genero)?.label ?? formData.genero} />
        )}
        {isRopa && formData.tipoPrenda && (
          <ReviewRow label="Tipo de prenda" value={tipoPrendaFlat.find(t => t.value === formData.tipoPrenda)?.label ?? formData.tipoPrenda} />
        )}
        {mode === "expert" && formData.descripcion && (
          <ReviewRow label="Descripción" value={formData.descripcion} />
        )}
        {!isRopa && mode === "expert" && selectedAgregados.length > 0 && (
          <ReviewRow
            label="Agregados"
            value={selectedAgregados.map((a) => a.nombre).join(", ")}
          />
        )}
        {!isRopa && mode === "expert" && selectedIngredientes.length > 0 && (
          <ReviewRow
            label="Ingredientes"
            value={selectedIngredientes.map((i) => i.nombre).join(", ")}
          />
        )}
      </div>
    </motion.div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-muted-foreground min-w-[80px] shrink-0">{label}</span>
      <span className="text-sm font-medium flex-1">{value}</span>
    </div>
  )
}

// ============================================
// Empty State
// ============================================
function EmptyProducts({ isRopa }: { isRopa: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {isRopa ? (
        <>
          <Shirt className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-bold text-lg">Sin prendas</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Agregá tu primera prenda para empezar a vender
          </p>
        </>
      ) : (
        <>
          <span className="text-5xl mb-4">📦</span>
          <h3 className="font-bold text-lg">Sin productos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Agregá tu primer producto para empezar a vender
          </p>
        </>
      )}
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-border/50 overflow-hidden">
          <Skeleton className="h-36 w-full rounded-none" />
          <CardContent className="p-3">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/3 mb-2" />
            <Skeleton className="h-4 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Catalog Sub-Navigation
// ============================================
function CatalogSubNav({
  subTab,
  setSubTab,
  items,
  colorPrincipal,
}: {
  subTab: CatalogSubTab
  setSubTab: (tab: CatalogSubTab) => void
  items: { id: CatalogSubTab; label: string; icon: typeof PackageOpen }[]
  colorPrincipal: string
}) {
  return (
    <div className="flex bg-muted/60 rounded-xl p-1 gap-1">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = subTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => setSubTab(item.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
              isActive
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={isActive ? { color: colorPrincipal } : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
