"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Armchair,
  Plus,
  Trash2,
  QrCode,
  Loader2,
  UserPlus,
  Power,
  PowerOff,
  Pencil,
  Check,
  X,
  Users,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface SalonConfigProps {
  negocio: {
    id: string
    slug: string
    colorPrincipal: string
  }
}

interface Mesa {
  id: string
  numero: number
  nombre: string
  capacidad: number
  activa: boolean
  negocioId: string
}

interface Empleado {
  id: string
  nombre: string
  codigo: string
  rol: string
  activo: boolean
  negocioId: string
}

interface NegocioSalonConfig {
  salonActivo: boolean
  empleadosActivos: boolean
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
// Salon Config Component
// ============================================
export function SalonConfig({ negocio }: SalonConfigProps) {
  const queryClient = useQueryClient()

  // ─── Config state ───
  const { data: config, isLoading: configLoading } = useQuery<NegocioSalonConfig>({
    queryKey: ["negocio-config", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/config?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando configuración")
      const json = await res.json()
      return json.data ?? json
    },
  })

  const salonActivo = config?.salonActivo ?? false
  const empleadosActivos = config?.empleadosActivos ?? false

  // ─── Toggle salon activo ───
  const toggleSalonMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch("/api/negocio/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonActivo: value }),
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

  // ─── Toggle empleados activos ───
  const toggleEmpleadosMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch("/api/negocio/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empleadosActivos: value }),
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

  if (configLoading) {
    return <SalonConfigSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* ===== MAIN TOGGLE ===== */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
        <div>
          <p className="text-sm font-semibold">Modo Salón</p>
          <p className="text-xs text-muted-foreground">
            Permitir que los clientes pidan desde una mesa con código QR
          </p>
        </div>
        <Switch
          checked={salonActivo}
          onCheckedChange={(v) => toggleSalonMutation.mutate(v)}
          disabled={toggleSalonMutation.isPending}
        />
      </div>

      {!salonActivo ? (
        /* Inactive state */
        <div className="text-center py-6 px-4">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: `${negocio.colorPrincipal}12` }}
          >
            <Armchair className="h-7 w-7" style={{ color: negocio.colorPrincipal }} />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Activá el modo salón para crear mesas, generar códigos QR y permitir que tus clientes
            hagan pedidos directamente desde su mesa.
          </p>
        </div>
      ) : (
        <>
          {/* Info banner */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-2">
              <QrCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Salón activado
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-500">
                  Cada mesa tiene un código QR único. Los clientes escanean el QR para ver la carta
                  y sus pedidos se asignan automáticamente a esa mesa.
                </p>
              </div>
            </div>
          </div>

          {/* ===== MESAS ===== */}
          <MesasSection negocio={negocio} />

          <Separator className="my-2" />

          {/* ===== EMPLEADOS TOGGLE ===== */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Registrar empleados</p>
                <p className="text-xs text-muted-foreground">
                  Gestioná los mozos del local
                </p>
              </div>
            </div>
            <Switch
              checked={empleadosActivos}
              onCheckedChange={(v) => toggleEmpleadosMutation.mutate(v)}
              disabled={toggleEmpleadosMutation.isPending}
            />
          </div>

          <AnimatePresence>
            {empleadosActivos && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <EmpleadosSection negocio={negocio} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

// ============================================
// Mesas Section
// ============================================
function MesasSection({ negocio }: { negocio: SalonConfigProps["negocio"] }) {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMesaId, setEditingMesaId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [qrModalMesa, setQrModalMesa] = useState<Mesa | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  // Add form state
  const [formNumero, setFormNumero] = useState("")
  const [formNombre, setFormNombre] = useState("")
  const [formCapacidad, setFormCapacidad] = useState("4")

  // Edit form state
  const [editNumero, setEditNumero] = useState("")
  const [editNombre, setEditNombre] = useState("")
  const [editCapacidad, setEditCapacidad] = useState("")

  // Fetch mesas
  const { data: mesas, isLoading: mesasLoading } = useQuery<Mesa[]>({
    queryKey: ["mesas", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/mesas")
      if (!res.ok) throw new Error("Error cargando mesas")
      return res.json()
    },
    enabled: true,
  })

  // Add mesa mutation
  const addMutation = useMutation({
    mutationFn: async (data: { numero: number; nombre: string; capacidad: number }) => {
      const res = await fetch("/api/negocio/mesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error creando mesa")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })
      toast.success("Mesa creada correctamente")
      resetAddForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Edit mesa mutation
  const editMutation = useMutation({
    mutationFn: async (data: { id: string; numero: number; nombre: string; capacidad: number }) => {
      const res = await fetch(`/api/negocio/mesas/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: data.numero, nombre: data.nombre, capacidad: data.capacidad }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error actualizando mesa")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })
      toast.success("Mesa actualizada")
      setEditingMesaId(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete mesa mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/mesas/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando mesa")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })
      toast.success("Mesa eliminada")
      setDeleteConfirm(null)
    },
    onError: () => {
      toast.error("Error al eliminar la mesa")
    },
  })

  // Toggle mesa activa mutation
  const toggleMesaMutation = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const res = await fetch(`/api/negocio/mesas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa }),
      })
      if (!res.ok) throw new Error("Error actualizando mesa")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas", negocio.id] })
    },
    onError: () => {
      toast.error("Error al actualizar la mesa")
    },
  })

  // Generate QR code (dynamic import to avoid breaking the component if qrcode fails to load)
  const generateQR = useCallback(async (mesa: Mesa) => {
    setQrLoading(true)
    setQrModalMesa(mesa)
    try {
      const QRCode = (await import("qrcode")).default
      const url = `${window.location.origin}/n/${negocio.slug}?mesa=${mesa.numero}`
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
      setQrDataUrl(dataUrl)
    } catch {
      toast.error("Error generando código QR")
      setQrModalMesa(null)
    } finally {
      setQrLoading(false)
    }
  }, [negocio.slug])

  // Download QR
  const downloadQR = useCallback(() => {
    if (!qrDataUrl || !qrModalMesa) return
    const link = document.createElement("a")
    link.download = `mesa-${qrModalMesa.numero}-qr.png`
    link.href = qrDataUrl
    link.click()
  }, [qrDataUrl, qrModalMesa])

  const resetAddForm = () => {
    setFormNumero("")
    setFormNombre("")
    setFormCapacidad("4")
    setShowAddForm(false)
  }

  const handleAddMesa = () => {
    const numero = parseInt(formNumero)
    if (isNaN(numero) || numero < 1) {
      toast.error("Ingresá un número de mesa válido")
      return
    }
    addMutation.mutate({
      numero,
      nombre: formNombre.trim(),
      capacidad: parseInt(formCapacidad) || 4,
    })
  }

  const startEditing = (mesa: Mesa) => {
    setEditingMesaId(mesa.id)
    setEditNumero(String(mesa.numero))
    setEditNombre(mesa.nombre)
    setEditCapacidad(String(mesa.capacidad))
  }

  const handleSaveEdit = (id: string) => {
    const numero = parseInt(editNumero)
    if (isNaN(numero) || numero < 1) {
      toast.error("Ingresá un número de mesa válido")
      return
    }
    editMutation.mutate({
      id,
      numero,
      nombre: editNombre.trim(),
      capacidad: parseInt(editCapacidad) || 4,
    })
  }

  if (mesasLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
        <div className="h-14 w-full bg-muted/50 rounded-xl animate-pulse" />
        <div className="h-14 w-full bg-muted/50 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <Armchair className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
        Mesas
      </p>

      {/* Add mesa button / form */}
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
              size="sm"
              className="w-full rounded-xl gap-2 border-dashed font-semibold"
              style={{ borderColor: `${negocio.colorPrincipal}40`, color: negocio.colorPrincipal }}
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4" />
              Agregar mesa
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="add-form"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-3"
          >
            <p className="text-xs font-semibold">Nueva mesa</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Número *</Label>
                <Input
                  type="number"
                  min={1}
                  value={formNumero}
                  onChange={(e) => setFormNumero(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                  placeholder="1"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Nombre</Label>
                <Input
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                  placeholder="Patio 1"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Capacidad</Label>
                <Input
                  type="number"
                  min={1}
                  value={formCapacidad}
                  onChange={(e) => setFormCapacidad(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                  placeholder="4"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-xl gap-1.5 font-semibold h-7 text-xs flex-1"
                style={{ backgroundColor: negocio.colorPrincipal }}
                onClick={handleAddMesa}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Crear mesa
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-7 text-xs"
                onClick={resetAddForm}
                disabled={addMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mesas list */}
      {mesas && mesas.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {mesas.map((mesa) => (
            <motion.div
              key={mesa.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-3 rounded-xl border transition-colors",
                mesa.activa
                  ? "border-border/50 bg-background"
                  : "border-border/30 bg-muted/30 opacity-60"
              )}
            >
              {editingMesaId === mesa.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[11px] font-semibold mb-1 block">Número</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editNumero}
                        onChange={(e) => setEditNumero(e.target.value)}
                        className="rounded-xl h-7 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold mb-1 block">Nombre</Label>
                      <Input
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="rounded-xl h-7 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold mb-1 block">Capacidad</Label>
                      <Input
                        type="number"
                        min={1}
                        value={editCapacidad}
                        onChange={(e) => setEditCapacidad(e.target.value)}
                        className="rounded-xl h-7 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl gap-1.5 font-semibold h-7 text-xs"
                      style={{ backgroundColor: negocio.colorPrincipal }}
                      onClick={() => handleSaveEdit(mesa.id)}
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
                      onClick={() => setEditingMesaId(null)}
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
                  {/* Mesa number badge */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: mesa.activa ? `${negocio.colorPrincipal}15` : "transparent",
                      color: mesa.activa ? negocio.colorPrincipal : "hsl(var(--muted-foreground))",
                      border: mesa.activa ? "none" : "1px solid hsl(var(--border))",
                    }}
                    onClick={() => startEditing(mesa)}
                    title="Editar mesa"
                  >
                    {mesa.numero}
                  </div>

                  {/* Mesa info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEditing(mesa)}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">
                        Mesa {mesa.numero}
                        {mesa.nombre && ` — ${mesa.nombre}`}
                      </p>
                      {!mesa.activa && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{mesa.capacidad} personas</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* QR button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => generateQR(mesa)}
                      title="Ver código QR"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>

                    {/* Toggle activa */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => toggleMesaMutation.mutate({ id: mesa.id, activa: !mesa.activa })}
                      title={mesa.activa ? "Desactivar mesa" : "Activar mesa"}
                      disabled={toggleMesaMutation.isPending}
                    >
                      {mesa.activa ? (
                        <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Power className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </Button>

                    {/* Delete */}
                    {deleteConfirm === mesa.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteMutation.mutate(mesa.id)}
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
                          <span className="text-xs">✕</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500"
                        onClick={() => setDeleteConfirm(mesa.id)}
                        title="Eliminar mesa"
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
        <p className="text-xs text-muted-foreground text-center py-4">
          No hay mesas creadas. Agregá tu primera mesa para empezar.
        </p>
      )}

      {/* QR Modal */}
      <Dialog open={!!qrModalMesa} onOpenChange={(open) => { if (!open) { setQrModalMesa(null); setQrDataUrl(null) } }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" style={{ color: negocio.colorPrincipal }} />
              Mesa {qrModalMesa?.numero}
              {qrModalMesa?.nombre && ` — ${qrModalMesa.nombre}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrLoading ? (
              <div className="w-[300px] h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : qrDataUrl ? (
              <>
                <img
                  src={qrDataUrl}
                  alt={`QR Mesa ${qrModalMesa?.numero}`}
                  className="w-[260px] h-[260px] rounded-xl border border-border/50"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Los clientes escanean este código para pedir desde la mesa {qrModalMesa?.numero}
                </p>
                <Button
                  className="rounded-xl gap-2 font-semibold w-full"
                  style={{ backgroundColor: negocio.colorPrincipal }}
                  onClick={downloadQR}
                >
                  <Download className="h-4 w-4" />
                  Descargar QR
                </Button>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Empleados Section
// ============================================
function EmpleadosSection({ negocio }: { negocio: SalonConfigProps["negocio"] }) {
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

  // Fetch empleados
  const { data: empleados, isLoading: empleadosLoading } = useQuery<Empleado[]>({
    queryKey: ["empleados", negocio.id],
    queryFn: async () => {
      const res = await fetch("/api/negocio/empleados")
      if (!res.ok) throw new Error("Error cargando empleados")
      return res.json()
    },
    enabled: true,
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

  if (empleadosLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="h-14 w-full bg-muted/50 rounded-xl animate-pulse" />
        <div className="h-14 w-full bg-muted/50 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <UserPlus className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
        Mozos
      </p>

      {/* Add mozo button / form */}
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
              size="sm"
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
            className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-3"
          >
            <p className="text-xs font-semibold">Nuevo mozo</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Nombre *</Label>
                <Input
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                  placeholder="Juan Pérez"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Código *</Label>
                <Input
                  value={formCodigo}
                  onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
                  className="rounded-xl h-8 text-sm font-mono"
                  placeholder="MOZO1"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-xl gap-1.5 font-semibold h-7 text-xs flex-1"
                style={{ backgroundColor: negocio.colorPrincipal }}
                onClick={handleAddEmpleado}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Crear mozo
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-7 text-xs"
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] font-semibold mb-1 block">Nombre</Label>
                      <Input
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="rounded-xl h-7 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold mb-1 block">Código</Label>
                      <Input
                        value={editCodigo}
                        onChange={(e) => setEditCodigo(e.target.value.toUpperCase())}
                        className="rounded-xl h-7 text-sm font-mono"
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
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
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
                          <span className="text-xs">✕</span>
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
        <p className="text-xs text-muted-foreground text-center py-4">
          No hay empleados registrados. Agregá tu primer empleado para empezar.
        </p>
      )}
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function SalonConfigSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-14 w-full bg-muted/50 rounded-xl animate-pulse" />
      <div className="h-14 w-full bg-muted/50 rounded-xl animate-pulse" />
      <div className="h-10 w-full bg-muted/50 rounded-xl animate-pulse" />
    </div>
  )
}
