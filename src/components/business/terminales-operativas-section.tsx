"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  Monitor,
  Plus,
  Pencil,
  Ban,
  Loader2,
  Check,
  Clock,
  Calendar,
  Link2,
  QrCode,
  Copy,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  OPERACIONES_AREAS,
  OPERACIONES_SCOPES,
  DEFAULT_OPERACIONES_PROFILE,
  resolveEffectiveGrant,
  type OperacionesProfile,
} from "@/lib/operaciones-terminal-permissions"

// ============================================
// Types
// ============================================
interface TerminalOperativa {
  id: string
  nombre: string
  estado: string
  perfil: string
  areas: string[]
  scopes: string[]
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

interface SectionProps {
  negocio: { id: string; colorPrincipal: string }
}

// ============================================
// Labels (presentación — la fuente de verdad es el backend)
// ============================================
const AREA_LABELS: Record<string, string> = {
  salon: "Salón",
  pyr: "Pedidos y reseñas",
}

const SCOPE_LABELS: Record<string, string> = {
  "salon.ver": "Ver salón y mesas",
  "salon.pedidos.ver": "Ver pedidos",
  "salon.pedidos.cambiar_estado": "Cambiar estado de pedidos",
  "salon.pedidos.marcar_entregado": "Marcar entregado",
  "salon.mesas.liberar": "Liberar mesas",
  "salon.mesas.reasignar": "Reasignar mesas",
  "salon.historial.ver": "Ver historial",
  "salon.estadisticas.ver": "Ver estadísticas",
  "pyr.ver": "Ver pedidos y reseñas",
  "pyr.pedidos.ver": "Ver pedidos de delivery",
  "pyr.pedidos.gestionar": "Gestionar pedidos de delivery",
  "pyr.resenas.ver": "Ver reseñas",
  "pyr.resenas.responder": "Responder reseñas",
  "pyr.mensajes.ver": "Ver mensajes",
  "pyr.mensajes.responder": "Responder mensajes",
}

const PROFILE_OPTIONS: Array<{ value: OperacionesProfile; label: string; desc: string }> = [
  { value: "pantalla", label: "Pantalla", desc: "Consulta mesas y pedidos del salón." },
  { value: "cocina", label: "Cocina", desc: "Consulta pedidos del salón y cambia su estado." },
  { value: "salon_completo", label: "Salón completo", desc: "Gestiona mesas, pedidos, reasignaciones e historial del salón." },
  { value: "pyr_completo", label: "Pedidos y reseñas", desc: "Gestiona pedidos de delivery, reseñas y mensajes." },
  { value: "personalizado", label: "Personalizado", desc: "Permite elegir manualmente áreas y permisos." },
]

const PROFILE_LABELS: Record<string, string> = Object.fromEntries(
  PROFILE_OPTIONS.map((p) => [p.value, p.label])
)

// Scopes agrupados por área (derivados del allowlist del helper).
const SCOPES_BY_AREA: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  for (const scope of OPERACIONES_SCOPES) {
    const area = scope.split(".")[0]
    ;(map[area] ||= []).push(scope)
  }
  return map
})()

const areaLabel = (area: string) => AREA_LABELS[area] ?? area
const scopeLabel = (scope: string) => SCOPE_LABELS[scope] ?? scope

function statusInfo(t: TerminalOperativa): { label: string; cls: string } {
  if (t.estado === "revocado" || t.revokedAt) {
    return { label: "Revocada", cls: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" }
  }
  if (t.estado === "activo") {
    return { label: "Activa", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" }
  }
  return { label: "Pendiente de activación", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" }
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value))
}

function formatRelative(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "recién"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

// ============================================
// Section
// ============================================
export function TerminalesOperativasSection({ negocio }: SectionProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TerminalOperativa | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<TerminalOperativa | null>(null)
  const [vincularTarget, setVincularTarget] = useState<TerminalOperativa | null>(null)

  const queryKey = useMemo<string[]>(
    () => ["terminales-operativas", negocio.id],
    [negocio.id]
  )

  // Solo mientras el diálogo de vinculación esté abierto para una terminal pendiente.
  const terminalVinculandoId = vincularTarget?.id ?? null

  const { data, isLoading, isError } = useQuery<{ terminales: TerminalOperativa[] }>({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/negocio/terminales-operativas", { cache: "no-store" })
      if (!res.ok) throw new Error("Error cargando terminales")
      return res.json()
    },
    // Polling temporal: cada ~2s SOLO durante la vinculación. Continúa aunque la
    // pestaña quede en segundo plano. No invalida credenciales ni regenera QR/código.
    refetchInterval: terminalVinculandoId ? 2000 : false,
    refetchIntervalInBackground: !!terminalVinculandoId,
  })

  const terminales = data?.terminales ?? []

  // Observa la terminal en vinculación y reacciona a su cambio de estado.
  useEffect(() => {
    if (!terminalVinculandoId) return
    const target = data?.terminales?.find((t) => t.id === terminalVinculandoId)
    if (!target) return

    if (target.estado === "revocado" || target.revokedAt) {
      setVincularTarget(null)
      toast.error("La terminal fue revocada antes de completar la vinculación.")
      return
    }
    if (target.estado === "activo") {
      setVincularTarget(null)
      toast.success("Terminal vinculada correctamente")
    }
    // `pendiente` → sigue esperando, sin acción.
  }, [terminalVinculandoId, data?.terminales])

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocio/terminales-operativas/${id}/revocar`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error revocando terminal")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success("Terminal revocada")
      setRevokeTarget(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Card className="rounded-2xl border-border/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-start gap-2.5 px-4 py-3 border-b border-border/30 bg-muted/20">
          <div className="hidden sm:flex p-1.5 rounded-lg items-center justify-center shrink-0" style={{ backgroundColor: `${negocio.colorPrincipal}15` }}>
            <Monitor className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Terminales operativas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gestioná los dispositivos compartidos que acceden a DeliGO Operaciones.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <Button
            size="sm"
            className="w-full rounded-xl gap-2 font-semibold text-white"
            style={{ backgroundColor: negocio.colorPrincipal }}
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva terminal
          </Button>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : isError ? (
            <div className="text-center py-6 px-4 rounded-2xl border border-border/50 bg-muted/10">
              <p className="text-sm text-muted-foreground">No se pudieron cargar las terminales.</p>
            </div>
          ) : terminales.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
              <Monitor className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">Sin terminales</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Creá una terminal para una caja, cocina, tablet o monitor compartido.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {terminales.map((t) => {
                const status = statusInfo(t)
                const isRevoked = t.estado === "revocado" || !!t.revokedAt
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3 rounded-xl border bg-card",
                      isRevoked ? "border-border/40 opacity-70" : "border-border/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${negocio.colorPrincipal}15`, color: negocio.colorPrincipal }}
                      >
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{t.nombre}</p>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {PROFILE_LABELS[t.perfil] ?? t.perfil}
                          </Badge>
                          <Badge className={cn("text-[9px] h-4 px-1.5 border-0", status.cls)}>{status.label}</Badge>
                        </div>

                        {/* Áreas */}
                        {t.areas.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {t.areas.map((a) => (
                              <span key={a} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                                {areaLabel(a)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-muted-foreground">
                          <span>{t.scopes.length} {t.scopes.length === 1 ? "permiso" : "permisos"}</span>
                          {t.lastUsedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Último uso: {formatRelative(t.lastUsedAt)}
                            </span>
                          )}
                          {t.createdAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Creada: {formatShortDate(t.createdAt)}
                            </span>
                          )}
                        </div>

                        {/* Pending notice */}
                        {!isRevoked && t.estado === "pendiente" && (
                          <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-2">
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-snug">
                              Generá el QR o código temporal para vincular el dispositivo a esta terminal.
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {!isRevoked && t.estado === "pendiente" && (
                            <Button
                              size="sm"
                              className="rounded-lg h-7 text-xs gap-1.5 font-semibold text-white"
                              style={{ backgroundColor: negocio.colorPrincipal }}
                              onClick={() => setVincularTarget(t)}
                            >
                              <Link2 className="h-3 w-3" />
                              Vincular
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg h-7 text-xs gap-1.5"
                            onClick={() => {
                              setEditing(t)
                              setDialogOpen(true)
                            }}
                            disabled={isRevoked}
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </Button>
                          {!isRevoked && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg h-7 text-xs gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              onClick={() => setRevokeTarget(t)}
                            >
                              <Ban className="h-3 w-3" />
                              Revocar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>

      {/* Create / Edit dialog (montado solo cuando está abierto → estado fresco) */}
      {dialogOpen && (
        <TerminalDialog
          negocio={negocio}
          editing={editing}
          queryKey={queryKey}
          onClose={() => setDialogOpen(false)}
        />
      )}

      {/* Vincular dialog (montado solo cuando hay terminal objetivo → estado fresco) */}
      {vincularTarget && (
        <VincularDialog
          negocio={negocio}
          terminal={vincularTarget}
          queryKey={queryKey}
          onClose={() => setVincularTarget(null)}
        />
      )}

      {/* Revoke confirm */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              Revocar terminal
            </DialogTitle>
            <DialogDescription>
              Se invalidarán de inmediato las sesiones asociadas. La terminal quedará revocada y no
              podrá editarse. Para volver a usarla deberá crearse y activarse una nueva terminal.
            </DialogDescription>
          </DialogHeader>
          {revokeTarget && <p className="text-sm font-semibold">{revokeTarget.nombre}</p>}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setRevokeTarget(null)}
              disabled={revokeMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl gap-1.5"
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Revocar terminal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ============================================
// Create / Edit dialog
// ============================================
function TerminalDialog({
  negocio,
  editing,
  queryKey,
  onClose,
}: {
  negocio: { id: string; colorPrincipal: string }
  editing: TerminalOperativa | null
  queryKey: (string)[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const isEdit = !!editing
  const [nombre, setNombre] = useState(editing?.nombre ?? "")
  const [perfil, setPerfil] = useState<OperacionesProfile>(
    (editing?.perfil as OperacionesProfile) ?? DEFAULT_OPERACIONES_PROFILE
  )
  const [customAreas, setCustomAreas] = useState<Set<string>>(
    () => new Set(editing?.perfil === "personalizado" ? editing.areas : [])
  )
  const [customScopes, setCustomScopes] = useState<Set<string>>(
    () => new Set(editing?.perfil === "personalizado" ? editing.scopes : [])
  )

  const isCustom = perfil === "personalizado"

  // Vista previa efectiva (el backend recalcula igual y es la fuente de verdad).
  const preview = useMemo(() => {
    if (isCustom) {
      return resolveEffectiveGrant("personalizado", [...customAreas], [...customScopes])
    }
    return resolveEffectiveGrant(perfil)
  }, [isCustom, perfil, customAreas, customScopes])

  const toggleArea = (area: string) => {
    const removing = customAreas.has(area)

    setCustomAreas((prev) => {
      const next = new Set(prev)
      if (removing) next.delete(area)
      else next.add(area)
      return next
    })

    // Al quitar un área, quitar sus scopes con un setState separado (sin anidar).
    if (removing) {
      setCustomScopes((prevScopes) => {
        const nextScopes = new Set(prevScopes)
        for (const scope of SCOPES_BY_AREA[area] ?? []) {
          nextScopes.delete(scope)
        }
        return nextScopes
      })
    }
  }

  const toggleScope = (scope: string) => {
    setCustomScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  const mutation = useMutation({
    mutationFn: async () => {
      // Enviar SOLO nombre/perfil/areas/scopes. El backend valida y normaliza.
      const payload: { nombre: string; perfil: string; areas?: string[]; scopes?: string[] } = {
        nombre: nombre.trim(),
        perfil,
      }
      if (perfil === "personalizado") {
        payload.areas = [...customAreas]
        payload.scopes = [...customScopes]
      }
      const res = await fetch(
        isEdit ? `/api/negocio/terminales-operativas/${editing!.id}` : "/api/negocio/terminales-operativas",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error guardando la terminal")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast.success(isEdit ? "Terminal actualizada" : "Terminal creada")
      onClose()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const customAreasMissing = isCustom && customAreas.size === 0

  const handleSubmit = () => {
    if (!nombre.trim()) {
      toast.error("Ingresá un nombre para la terminal")
      return
    }
    if (customAreasMissing) {
      toast.error("Habilitá al menos un área")
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" style={{ color: negocio.colorPrincipal }} />
            {isEdit ? "Editar terminal" : "Nueva terminal"}
          </DialogTitle>
          <DialogDescription>
            Configurá el dispositivo compartido. La autorización se valida en el servidor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4">
          {/* Nombre */}
          <div>
            <Label className="text-[11px] font-semibold mb-1 block">Nombre de la terminal *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded-xl h-9 text-sm"
              placeholder="PC Caja, Tablet Cocina, Monitor de Pedidos..."
              maxLength={60}
              autoFocus
            />
          </div>

          {/* Perfil */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold block">Perfil</Label>
            <div className="grid grid-cols-1 gap-2">
              {PROFILE_OPTIONS.map((p) => {
                const selected = perfil === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPerfil(p.value)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all",
                      selected ? "border-transparent" : "border-border/50 hover:bg-muted/40"
                    )}
                    style={
                      selected
                        ? { backgroundColor: `${negocio.colorPrincipal}12`, borderColor: `${negocio.colorPrincipal}40` }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{p.label}</span>
                      {selected && <Check className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Áreas + permisos (personalizado) */}
          {isCustom ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Para una PC Caja, habilitá Salón y Pedidos y reseñas.
                </p>
              </div>

              <div>
                <Label className="text-[11px] font-semibold mb-1.5 block">Áreas habilitadas</Label>
                <div className="grid grid-cols-2 gap-2">
                  {OPERACIONES_AREAS.map((area) => {
                    const active = customAreas.has(area)
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleArea(area)}
                        className={cn(
                          "flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all",
                          active ? "border-transparent" : "border-border/50 bg-card hover:bg-muted/40"
                        )}
                        style={
                          active
                            ? { backgroundColor: `${negocio.colorPrincipal}12`, borderColor: `${negocio.colorPrincipal}40` }
                            : undefined
                        }
                      >
                        <span className="text-xs font-semibold">{areaLabel(area)}</span>
                        <span
                          className={cn(
                            "w-4 h-4 rounded-md flex items-center justify-center shrink-0",
                            active ? "text-white" : "border border-border"
                          )}
                          style={active ? { backgroundColor: negocio.colorPrincipal } : undefined}
                        >
                          {active && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {customAreasMissing && (
                  <p className="text-[10px] text-red-500 mt-1">Habilitá al menos un área.</p>
                )}
              </div>

              {/* Permisos por área habilitada */}
              {OPERACIONES_AREAS.filter((area) => customAreas.has(area)).map((area) => (
                <div key={area}>
                  <Label className="text-[11px] font-semibold mb-1.5 block">Permisos · {areaLabel(area)}</Label>
                  <div className="space-y-1.5">
                    {(SCOPES_BY_AREA[area] ?? []).map((scope) => {
                      const active = customScopes.has(scope)
                      return (
                        <button
                          key={scope}
                          type="button"
                          onClick={() => toggleScope(scope)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all",
                            active ? "border-transparent" : "border-border/50 bg-card hover:bg-muted/40"
                          )}
                          style={
                            active
                              ? { backgroundColor: `${negocio.colorPrincipal}12`, borderColor: `${negocio.colorPrincipal}40` }
                              : undefined
                          }
                        >
                          <span className="text-xs font-medium">{scopeLabel(scope)}</span>
                          <span
                            className={cn(
                              "w-4 h-4 rounded-md flex items-center justify-center shrink-0",
                              active ? "text-white" : "border border-border"
                            )}
                            style={active ? { backgroundColor: negocio.colorPrincipal } : undefined}
                          >
                            {active && <Check className="h-3 w-3" />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Vista previa efectiva */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                  Permisos efectivos ({preview.scopes.length})
                </p>
                {preview.scopes.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Sin permisos asignados.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {preview.scopes.map((scope) => (
                      <span key={scope} className="text-[10px] px-1.5 py-0.5 rounded-md bg-card border border-border/50 text-muted-foreground">
                        {scopeLabel(scope)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Vista previa de perfil fijo (no editable) */
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Áreas</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.areas.map((area) => (
                    <span key={area} className="text-[10px] px-1.5 py-0.5 rounded-md bg-card border border-border/50 text-muted-foreground">
                      {areaLabel(area)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                  Permisos ({preview.scopes.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.scopes.map((scope) => (
                    <span key={scope} className="text-[10px] px-1.5 py-0.5 rounded-md bg-card border border-border/50 text-muted-foreground">
                      {scopeLabel(scope)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-5 pt-3 border-t border-border/50 shrink-0 gap-2">
          <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            className="rounded-xl gap-1.5 font-semibold text-white"
            style={{ backgroundColor: negocio.colorPrincipal }}
            onClick={handleSubmit}
            disabled={mutation.isPending || !nombre.trim() || customAreasMissing}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isEdit ? "Guardar cambios" : "Crear terminal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Vincular dialog (genera QR + código temporal)
// ============================================
interface ActivationCreds {
  qrToken: string
  manualCode: string
  expiresAt: string
}

function VincularDialog({
  negocio,
  terminal,
  queryKey,
  onClose,
}: {
  negocio: { id: string; colorPrincipal: string }
  terminal: TerminalOperativa
  queryKey: string[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [creds, setCreds] = useState<ActivationCreds | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [copied, setCopied] = useState<"link" | "code" | null>(null)

  // Enlace de activación: el secreto viaja SOLO en el fragmento (#), nunca en query.
  const activationUrl = creds
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/operaciones/activar#c=${encodeURIComponent(creds.qrToken)}`
    : null

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/negocio/terminales-operativas/${terminal.id}/activacion`, {
        method: "POST",
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo generar la activación")
      }
      setCreds({ qrToken: data.qrToken, manualCode: data.manualCode, expiresAt: data.expiresAt })
      queryClient.invalidateQueries({ queryKey })
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la activación")
      setCreds(null)
      setQrDataUrl(null)
    } finally {
      setGenerating(false)
    }
  }, [terminal.id, queryClient, queryKey])

  // Generar credenciales al abrir.
  useEffect(() => {
    void generate()
  }, [generate])

  // Render local del QR (sin servicios externos).
  useEffect(() => {
    let cancelled = false
    if (!activationUrl) {
      setQrDataUrl(null)
      return
    }
    ;(async () => {
      try {
        const QRCode = (await import("qrcode")).default
        const url = await QRCode.toDataURL(activationUrl, { width: 240, margin: 2 })
        if (!cancelled) setQrDataUrl(url)
      } catch {
        if (!cancelled) setQrDataUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activationUrl])

  // Contador regresivo.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const remainingMs = creds ? new Date(creds.expiresAt).getTime() - nowMs : 0
  const expired = !!creds && remainingMs <= 0
  const mm = Math.max(0, Math.floor(remainingMs / 60000))
  const ss = Math.max(0, Math.floor((remainingMs % 60000) / 1000))
  const countdown = `${mm}:${String(ss).padStart(2, "0")}`

  const copy = async (value: string, kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      toast.success(kind === "link" ? "Enlace copiado" : "Código copiado")
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" style={{ color: negocio.colorPrincipal }} />
            Vincular terminal
          </DialogTitle>
          <DialogDescription>{terminal.nombre}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4">
          {generating && !creds ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Generando credenciales…</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 text-center">
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          ) : creds ? (
            <>
              {/* QR */}
              <div className="flex flex-col items-center gap-2">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR de activación"
                    className={cn(
                      "w-[220px] h-[220px] rounded-xl border border-border/50 bg-white p-2",
                      expired && "opacity-40 grayscale"
                    )}
                  />
                ) : (
                  <div className="w-[220px] h-[220px] rounded-xl border border-border/50 flex items-center justify-center">
                    <QrCode className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground text-center">
                  Escaneá este QR desde el dispositivo a vincular.
                </p>
              </div>

              {/* Código manual */}
              <div>
                <Label className="text-[11px] font-semibold mb-1 block">Código temporal</Label>
                <div className="flex items-center gap-2">
                  <code className={cn(
                    "flex-1 px-3 py-2 rounded-xl bg-muted/40 border border-border/50 text-sm font-mono font-bold tracking-wider text-center",
                    expired && "opacity-40"
                  )}>
                    {creds.manualCode}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-xl shrink-0"
                    onClick={() => copy(creds.manualCode, "code")}
                    title="Copiar código"
                  >
                    {copied === "code" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {expired ? (
                  <span className="text-red-500 font-semibold">Credenciales vencidas</span>
                ) : (
                  <span className="text-muted-foreground">
                    Vence en <span className="font-semibold text-foreground">{countdown}</span>
                  </span>
                )}
              </div>

              {/* Security note */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Este QR y código se pueden usar una sola vez y vencen en 2 minutos. No los compartas
                  fuera del dispositivo que vas a vincular.
                </p>
              </div>

              {/* Copiar enlace / Regenerar */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5 text-xs"
                  onClick={() => activationUrl && copy(activationUrl, "link")}
                  disabled={!activationUrl || expired}
                >
                  {copied === "link" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
                  Copiar enlace
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5 text-xs"
                  onClick={() => generate()}
                  disabled={generating}
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Regenerar
                </Button>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="p-5 pt-3 border-t border-border/50 shrink-0">
          <Button variant="outline" className="rounded-xl w-full" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
