"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  Power,
  PowerOff,
  Pencil,
  Check,
  X,
  UserCog,
  Link2,
  ClipboardList,
  MessageSquare,
  Copy,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface Empleado {
  id: string
  nombre: string
  codigo: string
  rol: string
  activo: boolean
  negocioId: string
  token: string | null
}

interface EmpleadosTabProps {
  negocio: {
    id: string
    slug: string
    nombre: string
    colorPrincipal: string
    empleadosActivos?: boolean
  }
}

const ROLES = [
  { value: "mozo", label: "Mozo" },
] as const

const roleLabel = (rol: string) => ROLES.find((r) => r.value === rol)?.label ?? rol

const roleColor = (rol: string) => {
  switch (rol) {
    case "mozo": return "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
    default: return "bg-muted text-muted-foreground"
  }
}

// ============================================
// Empleados Tab Component
// ============================================
export function EmpleadosTab({ negocio }: EmpleadosTabProps) {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Add form state
  const [formNombre, setFormNombre] = useState("")
  const [formCodigo, setFormCodigo] = useState("")

  // Edit form state
  const [editNombre, setEditNombre] = useState("")
  const [editCodigo, setEditCodigo] = useState("")

  // Copied link state
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  // Shared employee access token
  const [tokenEmpleados, setTokenEmpleados] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    fetch("/api/negocio/access-tokens")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setTokenEmpleados(data.tokenEmpleados) })
      .catch(() => {})
  }, [])

  const regenerateToken = async () => {
    setRegenerating(true)
    try {
      const res = await fetch("/api/negocio/access-tokens", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setTokenEmpleados(data.tokenEmpleados)
        toast.success("Link regenerado. El link anterior ya no funciona.")
      } else {
        toast.error("Error al regenerar el link")
      }
    } catch {
      toast.error("Error al regenerar el link")
    } finally {
      setRegenerating(false)
    }
  }

  // Fetch empleados
  const { data: empleados, isLoading } = useQuery<Empleado[]>({
    queryKey: ["empleados", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/empleados")
      if (!res.ok) throw new Error("Error cargando empleados")
      return res.json()
    },
  })

  // Toggle empleados activo
  const toggleMutation = useMutation({
    mutationFn: async (empleadosActivos: boolean) => {
      const res = await fetch("/api/negocio/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empleadosActivos }),
      })
      if (!res.ok) throw new Error("Error actualizando configuración")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
      toast.success("Configuración actualizada")
    },
    onError: () => {
      toast.error("Error al actualizar la configuración")
    },
  })

  // Add empleado mutation
  const addMutation = useMutation({
    mutationFn: async (data: { nombre: string; codigo: string; rol: string }) => {
      const res = await fetch("/api/negocio/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error creando empleado")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados", negocio.id] })
      toast.success("Empleado creado correctamente")
      resetAddForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Edit empleado mutation
  const editMutation = useMutation({
    mutationFn: async (data: { id: string; nombre: string; codigo: string; rol: string }) => {
      const res = await fetch(`/api/negocio/empleados/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: data.nombre, codigo: data.codigo, rol: data.rol }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error actualizando empleado")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados", negocio.id] })
      toast.success("Empleado actualizado")
      setEditingId(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete empleado mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/empleados/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando empleado")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados", negocio.id] })
      toast.success("Empleado eliminado")
      setDeleteConfirm(null)
    },
    onError: () => {
      toast.error("Error al eliminar el empleado")
    },
  })

  // Toggle activo mutation
  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const res = await fetch(`/api/negocio/empleados/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo }),
      })
      if (!res.ok) throw new Error("Error actualizando empleado")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados", negocio.id] })
    },
    onError: () => {
      toast.error("Error al actualizar el empleado")
    },
  })

  const resetAddForm = () => {
    setFormNombre("")
    setFormCodigo("")
    setShowAddForm(false)
  }

  const handleAddEmpleado = () => {
    if (!formNombre.trim()) {
      toast.error("Ingresá el nombre del empleado")
      return
    }
    if (!formCodigo.trim()) {
      toast.error("Ingresá el código del empleado")
      return
    }
    addMutation.mutate({
      nombre: formNombre.trim(),
      codigo: formCodigo.trim(),
      rol: "mozo",
    })
  }

  const startEditing = (empleado: Empleado) => {
    setEditingId(empleado.id)
    setEditNombre(empleado.nombre)
    setEditCodigo(empleado.codigo)
  }

  const handleSaveEdit = (id: string) => {
    if (!editNombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    if (!editCodigo.trim()) {
      toast.error("El código es obligatorio")
      return
    }
    editMutation.mutate({
      id,
      nombre: editNombre.trim(),
      codigo: editCodigo.trim(),
      rol: "mozo",
    })
  }

  const empleadosActivos = negocio.empleadosActivos ?? false

  if (isLoading) {
    return <EmpleadosSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* ===== TOGGLE EMPLEADOS ===== */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-muted/20">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${negocio.colorPrincipal}15` }}>
                <Users className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
              </div>
              <h3 className="font-semibold text-sm">Empleados</h3>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <p className="text-sm font-semibold">Activar empleados</p>
                  <p className="text-xs text-muted-foreground">
                    Gestioná los mozos del local
                  </p>
                </div>
                <Switch
                  checked={empleadosActivos}
                  onCheckedChange={(v) => toggleMutation.mutate(v)}
                  disabled={toggleMutation.isPending}
                />
              </div>

              {!empleadosActivos ? (
                <div className="text-center py-8 px-4">
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: `${negocio.colorPrincipal}12` }}
                  >
                    <UserCog className="h-8 w-8" style={{ color: negocio.colorPrincipal }} />
                  </div>
                  <h4 className="font-semibold text-base mb-2">Gestión de Empleados</h4>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Activá esta función para registrar mozos.
                    Podrás asignar códigos cortos a cada mozo y rastrear quién atiende cada mesa o pedido.
                  </p>
                  <Button
                    className="mt-4 rounded-xl gap-2 font-semibold"
                    style={{ backgroundColor: negocio.colorPrincipal }}
                    onClick={() => toggleMutation.mutate(true)}
                    disabled={toggleMutation.isPending}
                  >
                    <Power className="h-4 w-4" />
                    Activar empleados
                  </Button>
                </div>
              ) : (
                <>
                  {/* Info banner */}
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Empleados activados
                        </p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500">
                          Compartí el link de empleados para que puedan ver pedidos y responder reseñas.
                          Si un empleado se va, regenerá el link para invalidar el anterior.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Shared employee link */}
                  <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${negocio.colorPrincipal}15` }}>
                        <Link2 className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">Link de empleados</p>
                        <p className="text-[11px] text-muted-foreground">Pedidos + Reseñas en un solo link</p>
                      </div>
                    </div>
                    {tokenEmpleados && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 rounded-lg bg-background border border-border/50 text-xs font-mono text-muted-foreground truncate">
                          {window?.location?.origin || ""}/e/{tokenEmpleados}
                        </div>
                        <Button
                          size="icon"
                          variant="outline"
                          className={cn(
                            "h-9 w-9 rounded-lg shrink-0 transition-all",
                            copiedLink === "empleados"
                              ? "border-emerald-300 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                              : ""
                          )}
                          onClick={async () => {
                            const url = `${window.location.origin}/e/${tokenEmpleados}`
                            try {
                              await navigator.clipboard.writeText(url)
                              setCopiedLink("empleados")
                              toast.success("Link de empleados copiado")
                              setTimeout(() => setCopiedLink(null), 2000)
                            } catch {
                              toast.error("No se pudo copiar")
                            }
                          }}
                          title="Copiar link de empleados"
                        >
                          {copiedLink === "empleados" ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl gap-2 font-semibold border-dashed"
                      style={{ borderColor: `${negocio.colorPrincipal}40`, color: negocio.colorPrincipal }}
                      onClick={regenerateToken}
                      disabled={regenerating}
                    >
                      {regenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Regenerar link
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Al regenerar, el link anterior deja de funcionar inmediatamente
                    </p>
                  </div>

                  {/* Add empleado button / form */}
                  <AnimatePresence mode="wait">
                    {!showAddForm ? (
                      <motion.div
                        key="add-button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Button
                          variant="outline"
                          className="w-full rounded-xl gap-2 border-dashed font-semibold"
                          style={{ borderColor: `${negocio.colorPrincipal}40`, color: negocio.colorPrincipal }}
                          onClick={() => setShowAddForm(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Agregar mozo
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="add-form"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3"
                      >
                        <p className="text-sm font-semibold">Nuevo mozo</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-semibold mb-1 block">Nombre *</Label>
                            <Input
                              value={formNombre}
                              onChange={(e) => setFormNombre(e.target.value)}
                              className="rounded-xl h-9"
                              placeholder="Juan Pérez"
                              autoFocus
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold mb-1 block">Código *</Label>
                            <Input
                              value={formCodigo}
                              onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
                              className="rounded-xl h-9 font-mono"
                              placeholder="JUAN"
                              maxLength={10}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-xl gap-2 font-semibold flex-1"
                            style={{ backgroundColor: negocio.colorPrincipal }}
                            onClick={handleAddEmpleado}
                            disabled={addMutation.isPending}
                          >
                            {addMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            Crear mozo
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={resetAddForm}
                            disabled={addMutation.isPending}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Empleados list */}
                  {empleados && empleados.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                      {empleados.map((empleado) => (
                        <motion.div
                          key={empleado.id}
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "p-3 rounded-xl border transition-colors",
                            empleado.activo
                              ? "border-border/50 bg-background"
                              : "border-border/30 bg-muted/30 opacity-60"
                          )}
                        >
                          {editingId === empleado.id ? (
                            /* Edit mode */
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-semibold mb-1 block">Nombre</Label>
                                  <Input
                                    value={editNombre}
                                    onChange={(e) => setEditNombre(e.target.value)}
                                    className="rounded-xl h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold mb-1 block">Código</Label>
                                  <Input
                                    value={editCodigo}
                                    onChange={(e) => setEditCodigo(e.target.value.toUpperCase())}
                                    className="rounded-xl h-8 text-sm font-mono"
                                    maxLength={10}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="rounded-xl gap-1.5 font-semibold h-7 text-xs"
                                  style={{ backgroundColor: negocio.colorPrincipal }}
                                  onClick={() => handleSaveEdit(empleado.id)}
                                  disabled={editMutation.isPending}
                                >
                                  {editMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Guardar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl h-7 text-xs gap-1.5"
                                  onClick={() => setEditingId(null)}
                                  disabled={editMutation.isPending}
                                >
                                  <X className="h-3 w-3" />
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* View mode */
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
                                style={{
                                  backgroundColor: empleado.activo ? `${negocio.colorPrincipal}15` : "transparent",
                                  color: empleado.activo ? negocio.colorPrincipal : "hsl(var(--muted-foreground))",
                                  border: empleado.activo ? "none" : "1px solid hsl(var(--border))",
                                }}
                              >
                                {empleado.codigo.substring(0, 2)}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate">{empleado.nombre}</p>
                                  {!empleado.activo && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                      Inactivo
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <code className="text-xs font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                                    {empleado.codigo}
                                  </code>
                                  <Badge className={cn("text-[10px] px-1.5 py-0 h-4 border-0 font-semibold", roleColor(empleado.rol))}>
                                    {roleLabel(empleado.rol)}
                                  </Badge>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => startEditing(empleado)}
                                  title="Editar empleado"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => toggleActivoMutation.mutate({ id: empleado.id, activo: !empleado.activo })}
                                  title={empleado.activo ? "Desactivar empleado" : "Activar empleado"}
                                  disabled={toggleActivoMutation.isPending}
                                >
                                  {empleado.activo ? (
                                    <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5 text-emerald-500" />
                                  )}
                                </Button>

                                {deleteConfirm === empleado.id ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                                      onClick={() => deleteMutation.mutate(empleado.id)}
                                      disabled={deleteMutation.isPending}
                                    >
                                      {deleteMutation.isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 rounded-lg"
                                      onClick={() => setDeleteConfirm(null)}
                                    >
                                      <span className="text-xs">×</span>
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500"
                                    onClick={() => setDeleteConfirm(empleado.id)}
                                    title="Eliminar empleado"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground">
                        No hay mozos registrados. Agregá tu primer mozo para empezar.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function EmpleadosSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-muted/20">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="p-4 space-y-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
