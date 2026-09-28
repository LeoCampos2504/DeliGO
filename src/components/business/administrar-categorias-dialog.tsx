"use client"

// ============================================
// P2-T56-R2B — Administrar categorías (generic business)
// ============================================
// Thin management UI over the ALREADY-EXISTING category authority
// (Negocio.categorias, backed by GET/PUT/PATCH /api/negocio/categorias —
// the same endpoints products-tab.tsx already uses for Restaurante/Ropa).
// No new schema, no new API route. Only the client-side dedup check
// (findEquivalentCategory) and the 60-char-name UX hint are new here; the
// server-side blank/oversized-name validation lives in the shared route
// itself (see route.ts) so it protects every caller, not just this dialog.

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Tags, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { findEquivalentCategory } from "@/lib/category-normalization"

const CATEGORY_NAME_MAX_LENGTH = 60

export function AdministrarCategoriasDialog({
  negocioId,
  productos,
  onClose,
}: {
  negocioId: string
  productos: ReadonlyArray<{ categoria: string }>
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [newCategoryInput, setNewCategoryInput] = useState("")
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: categorias = [], isLoading } = useQuery<string[]>({
    queryKey: ["negocio-categorias", negocioId],
    queryFn: async () => {
      const res = await fetch("/api/negocio/categorias")
      if (!res.ok) return []
      const json = await res.json()
      return json.categorias ?? []
    },
  })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["negocio-categorias", negocioId] })
    queryClient.invalidateQueries({ queryKey: ["negocio-inventario-productos", negocioId] })
    queryClient.invalidateQueries({ queryKey: ["negocio-caja-productos", negocioId] })
  }

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/negocio/categorias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorias: [...categorias, name] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al crear la categoría")
      return data
    },
    onSuccess: () => {
      toast.success("Categoría creada")
      setNewCategoryInput("")
      invalidateAll()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const renameMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const res = await fetch("/api/negocio/categorias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al renombrar la categoría")
      return data
    },
    onSuccess: () => {
      toast.success("Categoría renombrada")
      setRenameTarget(null)
      setRenameInput("")
      invalidateAll()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/negocio/categorias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorias: categorias.filter((c) => c !== name) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al eliminar la categoría")
      return data
    },
    onSuccess: () => {
      toast.success("Categoría eliminada")
      setDeleteTarget(null)
      invalidateAll()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  function handleCreate() {
    const trimmed = newCategoryInput.trim()
    if (!trimmed) return
    if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
      toast.error(`El nombre no puede superar los ${CATEGORY_NAME_MAX_LENGTH} caracteres`)
      return
    }
    const existing = findEquivalentCategory(categorias, trimmed)
    if (existing) {
      toast.error(`Esa categoría ya existe ("${existing}")`)
      return
    }
    createMutation.mutate(trimmed)
  }

  function openRename(name: string) {
    setRenameTarget(name)
    setRenameInput(name)
  }

  function handleRename() {
    if (!renameTarget) return
    const trimmed = renameInput.trim()
    if (!trimmed) return
    if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
      toast.error(`El nombre no puede superar los ${CATEGORY_NAME_MAX_LENGTH} caracteres`)
      return
    }
    if (trimmed !== renameTarget) {
      const existing = findEquivalentCategory(categorias.filter((c) => c !== renameTarget), trimmed)
      if (existing) {
        toast.error(`Esa categoría ya existe ("${existing}")`)
        return
      }
    }
    renameMutation.mutate({ oldName: renameTarget, newName: trimmed })
  }

  function countProductos(categoria: string) {
    return productos.filter((p) => p.categoria === categoria).length
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            Administrar categorías
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nombre de categoría"
              className="rounded-xl"
            />
            <Button
              className="shrink-0 rounded-xl gap-1.5"
              onClick={handleCreate}
              disabled={createMutation.isPending || !newCategoryInput.trim()}
            >
              <Plus className="h-4 w-4" />
              Crear
            </Button>
          </div>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cargando categorías…</p>
          ) : categorias.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aún no creaste categorías</p>
          ) : (
            <div className="space-y-1.5">
              {categorias.map((cat) => (
                <div key={cat} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                  {renameTarget === cat ? (
                    <>
                      <Input
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename()}
                        className="h-8 rounded-lg"
                        autoFocus
                      />
                      <Button size="sm" className="h-8 shrink-0 rounded-lg" onClick={handleRename} disabled={renameMutation.isPending}>
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 rounded-lg p-0"
                        onClick={() => { setRenameTarget(null); setRenameInput("") }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{cat}</p>
                        <p className="text-[11px] text-muted-foreground">{countProductos(cat)} producto{countProductos(cat) === 1 ? "" : "s"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 rounded-lg p-0"
                        onClick={() => openRename(cat)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 rounded-lg p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(cat)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>

      {deleteTarget && (
        <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-xs sm:max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>Eliminar categoría</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {countProductos(deleteTarget) > 0
                ? `Esta categoría tiene ${countProductos(deleteTarget)} producto${countProductos(deleteTarget) === 1 ? "" : "s"}. Al eliminarla, quedarán sin categoría (no se borra ningún producto).`
                : "Esta categoría no tiene productos asociados."}
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className={cn("flex-1 rounded-xl")} onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl"
                onClick={() => deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
              >
                Eliminar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
