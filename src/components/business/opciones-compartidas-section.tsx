"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  Settings2,
  ListChecks,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface OpcionesCompartidasSectionProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
}

interface OpcionItem {
  nombre: string
  precio: number
}

interface OpcionCompartida {
  id: string
  nombre: string
  opciones: string // JSON: OpcionItem[]
  obligatorio: boolean
  maximo: number
  negocioId: string
  createdAt: string
  updatedAt: string
}

interface FormData {
  nombre: string
  opciones: OpcionItem[]
  obligatorio: boolean
  maximo: number
}

const defaultFormData: FormData = {
  nombre: "",
  opciones: [],
  obligatorio: false,
  maximo: 0,
}

// ============================================
// Main Component
// ============================================
export function OpcionesCompartidasSection({ negocio }: OpcionesCompartidasSectionProps) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OpcionCompartida | null>(null)
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [deleteDialog, setDeleteDialog] = useState<OpcionCompartida | null>(null)

  // Fetch opciones compartidas
  const { data: opciones = [], isLoading } = useQuery<OpcionCompartida[]>({
    queryKey: ["negocio-opciones-compartidas", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/opciones-compartidas?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando opciones compartidas")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: FormData & { id?: string }) => {
      const url = data.id
        ? `/api/negocio/opciones-compartidas/${data.id}`
        : `/api/negocio/opciones-compartidas`
      const method = data.id ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, negocioId: negocio.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error guardando opción compartida")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-opciones-compartidas", negocio.id] })
      toast.success("Opción compartida guardada correctamente")
      closeForm()
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al guardar la opción compartida")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/opciones-compartidas/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando opción compartida")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-opciones-compartidas", negocio.id] })
      queryClient.invalidateQueries({ queryKey: ["negocio-productos", negocio.id] })
      toast.success("Opción compartida eliminada")
      setDeleteDialog(null)
    },
    onError: () => {
      toast.error("Error al eliminar la opción compartida")
    },
  })

  // Form handlers
  const openNewForm = () => {
    setEditingItem(null)
    setFormData(defaultFormData)
    setFormOpen(true)
  }

  const openEditForm = (item: OpcionCompartida) => {
    setEditingItem(item)
    let parsedOpciones: OpcionItem[] = []
    try {
      parsedOpciones = JSON.parse(item.opciones) as OpcionItem[]
    } catch {
      parsedOpciones = []
    }
    setFormData({
      nombre: item.nombre,
      opciones: parsedOpciones,
      obligatorio: item.obligatorio,
      maximo: item.maximo,
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingItem(null)
    setFormData(defaultFormData)
  }

  const handleSave = () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    if (formData.opciones.length === 0) {
      toast.error("Agregá al menos una opción")
      return
    }
    saveMutation.mutate({ ...formData, id: editingItem?.id })
  }

  const addOpcion = () => {
    setFormData((p) => ({
      ...p,
      opciones: [...p.opciones, { nombre: "", precio: 0 }],
    }))
  }

  const removeOpcion = (index: number) => {
    setFormData((p) => ({
      ...p,
      opciones: p.opciones.filter((_, i) => i !== index),
    }))
  }

  const updateOpcion = (index: number, field: "nombre" | "precio", value: string | number) => {
    setFormData((p) => {
      const updated = [...p.opciones]
      updated[index] = { ...updated[index], [field]: value }
      return { ...p, opciones: updated }
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
            <Settings2
              className="h-4 w-4"
              style={{ color: negocio.colorPrincipal }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Opciones compartidas</h3>
            <p className="text-xs text-muted-foreground">
              Secciones de opciones reutilizables para varios productos
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

      {/* ===== LIST ===== */}
      {isLoading ? (
        <OpcionesSkeleton />
      ) : opciones.length === 0 ? (
        <EmptyOpciones onAdd={openNewForm} colorPrincipal={negocio.colorPrincipal} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {opciones.map((opcion, index) => (
              <OpcionCard
                key={opcion.id}
                opcion={opcion}
                colorPrincipal={negocio.colorPrincipal}
                onEdit={() => openEditForm(opcion)}
                onDelete={() => setDeleteDialog(opcion)}
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
              {editingItem ? (
                <>
                  <Edit3 className="h-4 w-4" />
                  Editar opción compartida
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Nueva opción compartida
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
                <Label htmlFor="op-nombre" className="text-sm font-semibold mb-1.5 block">
                  Nombre de la sección *
                </Label>
                <Input
                  id="op-nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Sabores de helado, Salsas, Toppings..."
                  className="rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Este nombre aparecerá al configurar productos y en el catálogo del cliente
                </p>
              </div>

              {/* Obligatorio + Max selections (defaults — can be overridden per product) */}
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.obligatorio}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, obligatorio: v }))}
                  />
                  <div>
                    <Label className="text-xs font-medium">Obligatoria</Label>
                    <p className="text-[9px] text-muted-foreground">Valor por defecto</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground shrink-0 block">
                      Max. elecciones
                    </Label>
                    <p className="text-[9px] text-muted-foreground">Se puede cambiar por producto</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={formData.maximo || 0}
                    onChange={(e) => setFormData((p) => ({ ...p, maximo: parseInt(e.target.value) || 0 }))}
                    className="rounded-lg text-sm h-7 w-20"
                    placeholder="0"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formData.maximo === 0 ? "1 opción" : `${formData.maximo} elecciones`}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Opciones */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" />
                    Opciones
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 rounded-lg"
                    onClick={addOpcion}
                  >
                    <Plus className="h-3 w-3" />
                    Agregar
                  </Button>
                </div>

                {formData.opciones.length === 0 ? (
                  <div className="flex flex-col items-center py-6 rounded-xl border-2 border-dashed border-border/50 bg-muted/20">
                    <ListChecks className="h-6 w-6 text-muted-foreground/30 mb-1.5" />
                    <p className="text-xs text-muted-foreground">Sin opciones aún</p>
                    <button
                      type="button"
                      onClick={addOpcion}
                      className="text-xs text-primary font-medium mt-1 hover:underline"
                    >
                      Agregar la primera opción
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.opciones.map((opcion, oi) => (
                      <div
                        key={oi}
                        className="flex items-center gap-2 p-2 rounded-xl border border-border/50 bg-muted/20"
                      >
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/20 shrink-0" />
                        <Input
                          value={opcion.nombre}
                          onChange={(e) => updateOpcion(oi, "nombre", e.target.value)}
                          placeholder={`Opción ${oi + 1}`}
                          className="rounded-lg text-sm h-8 flex-1"
                        />
                        <div className="relative w-24 shrink-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            value={opcion.precio || ""}
                            onChange={(e) => updateOpcion(oi, "precio", parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="rounded-lg text-sm h-8 pl-5"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                          onClick={() => removeOpcion(oi)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}

                    {/* Quick add multiple */}
                    <button
                      type="button"
                      onClick={addOpcion}
                      className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline pl-4 py-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      Agregar otra opción
                    </button>
                  </div>
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
                disabled={saveMutation.isPending || !formData.nombre.trim() || formData.opciones.length === 0}
              >
                {saveMutation.isPending ? (
                  "Guardando..."
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {editingItem ? "Guardar cambios" : "Crear sección"}
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
              Eliminar opción compartida
            </DialogTitle>
            <DialogDescription>
              ¿Eliminás <strong>{deleteDialog?.nombre}</strong>? Los productos que usan esta sección de opciones serán actualizados automáticamente.
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
// Opcion Card
// ============================================
function OpcionCard({
  opcion,
  colorPrincipal,
  onEdit,
  onDelete,
}: {
  opcion: OpcionCompartida
  colorPrincipal: string
  onEdit: () => void
  onDelete: () => void
}) {
  const opciones: OpcionItem[] = useMemo(() => {
    try { return JSON.parse(opcion.opciones) as OpcionItem[] }
    catch { return [] }
  }, [opcion.opciones])

  const hasPrecio = opciones.some((o) => o.precio > 0)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="rounded-2xl border-border/50 overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${colorPrincipal}12`, color: colorPrincipal }}
            >
              <Settings2 className="h-5 w-5" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold truncate">{opcion.nombre}</h4>
                {opcion.obligatorio && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 border-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">
                    Oblig. (defecto)
                  </Badge>
                )}
                {opcion.maximo > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 border-0 bg-blue-500/10 text-blue-700 dark:text-blue-400 shrink-0">
                    Max {opcion.maximo} (defecto)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {opciones.length} {opciones.length === 1 ? "opción" : "opciones"}
                {hasPrecio ? " · Con precio" : ""}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={onEdit}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Options preview */}
          {opciones.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {opciones.slice(0, 6).map((op, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/30"
                >
                  {op.nombre}
                  {op.precio > 0 && (
                    <span className="text-primary font-semibold">
                      +${op.precio.toLocaleString("es-AR")}
                    </span>
                  )}
                </span>
              ))}
              {opciones.length > 6 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/40 text-muted-foreground">
                  +{opciones.length - 6} más
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Empty State
// ============================================
function EmptyOpciones({
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
            <Settings2
              className="h-6 w-6"
              style={{ color: colorPrincipal }}
            />
          </div>
          <h4 className="text-sm font-semibold mb-1">Sin opciones compartidas</h4>
          <p className="text-xs text-muted-foreground mb-4 max-w-[280px] mx-auto">
            Creá secciones de opciones reutilizables para varios productos. Por ejemplo: "Sabores de helado", "Salsas", "Toppings"...
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
function OpcionesSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40 rounded-lg" />
                <Skeleton className="h-3 w-24 rounded-lg" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
