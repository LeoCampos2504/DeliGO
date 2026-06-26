"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Armchair,
  Users,
  UserCheck,
  X,
  Loader2,
  MapPin,
  Check,
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface MesaPublica {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  mozoAsignado: { nombre: string; codigo: string } | null
}

interface MesaSelectorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  negocioSlug: string
  negocioId: string
  negocioNombre: string
  colorPrincipal: string
  mozoCodigo: string
  mozoNombre: string
  /** Employee auth token — required for API authorization when no session cookie is present */
  mozoToken?: string
  /** Called when the mozo confirms — returns the full list of mesas currently assigned to this mozo */
  onMesasChanged?: (mesas: MesaPublica[]) => void
  /** Backward compat: called with the last-toggled mesa (for cart panel to know which mesa to order for) */
  onMesaSelected?: (mesa: MesaPublica) => void
  /** Currently selected mesa id for the cart panel */
  selectedMesaId?: string | null
}

// ============================================
// Mesa Selector Sheet Component
// ============================================
export function MesaSelectorSheet({
  open,
  onOpenChange,
  negocioSlug,
  negocioId,
  negocioNombre,
  colorPrincipal,
  mozoCodigo,
  mozoNombre,
  mozoToken,
  onMesasChanged,
  onMesaSelected,
  selectedMesaId,
}: MesaSelectorSheetProps) {
  const queryClient = useQueryClient()
  const [lastToggledMesa, setLastToggledMesa] = useState<MesaPublica | null>(null)
  const [pendingMesaIds, setPendingMesaIds] = useState<Set<string>>(new Set())
  // Track optimistic overrides: mesa IDs added/removed locally before API refresh
  const [optimisticAdded, setOptimisticAdded] = useState<Set<string>>(new Set())
  const [optimisticRemoved, setOptimisticRemoved] = useState<Set<string>>(new Set())

  // Fetch available mesas
  const { data: mesasData, isLoading } = useQuery<{ mesas: MesaPublica[] }>({
    queryKey: ["mesas-public", negocioSlug],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/mesas-public?slug=${negocioSlug}`)
      if (!res.ok) throw new Error("Error cargando mesas")
      return res.json()
    },
    enabled: open,
  })

  const mesas = mesasData?.mesas ?? []

  // Derive the mozo's currently assigned mesas from API data + optimistic overrides
  const localMyMesas = useMemo(() => {
    // Start with server-truth: mesas assigned to this mozo from API
    const serverMyMesas = mesas.filter(
      (m) => m.mozoAsignado?.codigo === mozoCodigo
    )
    const serverMyIds = new Set(serverMyMesas.map((m) => m.id))

    // Add optimistically added mesas (not yet reflected in server data)
    const addedMesas = mesas.filter(
      (m) => optimisticAdded.has(m.id) && !serverMyIds.has(m.id)
    )

    // Remove optimistically removed mesas
    const result = [...serverMyMesas, ...addedMesas].filter(
      (m) => !optimisticRemoved.has(m.id)
    )

    return result
  }, [mesas, mozoCodigo, optimisticAdded, optimisticRemoved])

  // Assign mozo to mesa mutation (does NOT close sheet)
  const assignMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      const res = await fetch("/api/negocio/mesas-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mesaId,
          empleadoCodigo: mozoCodigo,
          negocioId,
          ...(mozoToken ? { mozoToken } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error asignando mesa")
      }
      return res.json() as Promise<MesaPublica>
    },
    onSuccess: (updatedMesa) => {
      queryClient.invalidateQueries({ queryKey: ["mesas-public", negocioSlug] })
      setPendingMesaIds((prev) => {
        const next = new Set(prev)
        next.delete(updatedMesa.id)
        return next
      })
      // Mark as optimistically added (will be confirmed when query refreshes)
      setOptimisticAdded((prev) => {
        const next = new Set(prev)
        next.add(updatedMesa.id)
        return next
      })
      setOptimisticRemoved((prev) => {
        const next = new Set(prev)
        next.delete(updatedMesa.id)
        return next
      })
      setLastToggledMesa(updatedMesa)
      onMesaSelected?.(updatedMesa)
      toast.success(`Mesa ${updatedMesa.numero} asignada`)
    },
    onError: (error: Error, mesaId) => {
      setPendingMesaIds((prev) => {
        const next = new Set(prev)
        next.delete(mesaId)
        return next
      })
      toast.error(error.message)
    },
  })

  // Unassign mozo from mesa mutation (does NOT close sheet)
  const unassignMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      const res = await fetch("/api/negocio/mesas-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mesaId,
          empleadoCodigo: mozoCodigo,
          negocioId,
          unassign: true,
          ...(mozoToken ? { mozoToken } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error desasignando mesa")
      }
      return res.json() as Promise<MesaPublica>
    },
    onSuccess: (updatedMesa) => {
      queryClient.invalidateQueries({ queryKey: ["mesas-public", negocioSlug] })
      setPendingMesaIds((prev) => {
        const next = new Set(prev)
        next.delete(updatedMesa.id)
        return next
      })
      // Mark as optimistically removed (will be confirmed when query refreshes)
      setOptimisticRemoved((prev) => {
        const next = new Set(prev)
        next.add(updatedMesa.id)
        return next
      })
      setOptimisticAdded((prev) => {
        const next = new Set(prev)
        next.delete(updatedMesa.id)
        return next
      })
      setLastToggledMesa(updatedMesa)
      onMesaSelected?.(updatedMesa)
      toast.success(`Mesa ${updatedMesa.numero} desasignada`)
    },
    onError: (error: Error, mesaId) => {
      setPendingMesaIds((prev) => {
        const next = new Set(prev)
        next.delete(mesaId)
        return next
      })
      toast.error(error.message)
    },
  })

  // Group mesas by zone
  const zonaGroups = useMemo(() => {
    const groups = new Map<string, MesaPublica[]>()
    for (const mesa of mesas) {
      const key = mesa.zona || ""
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(mesa)
    }
    // Sort: named zones first, then "Sin zona"
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b)
    })
    return sorted
  }, [mesas])

  // Build a set of my mesa IDs for quick lookup (use local state for immediate feedback)
  const myMesaIds = useMemo(() => {
    return new Set(localMyMesas.map((m) => m.id))
  }, [localMyMesas])

  const myMesasCount = localMyMesas.length

  const handleToggleMesa = (mesa: MesaPublica) => {
    const isMyMesa = myMesaIds.has(mesa.id)
    const isOccupied = !!mesa.mozoAsignado && mesa.mozoAsignado.codigo !== mozoCodigo

    // If assigned to another mozo, block
    if (isOccupied) {
      toast.error(`Esta mesa está asignada a ${mesa.mozoAsignado?.nombre}`)
      return
    }

    // If already my mesa → unassign
    if (isMyMesa) {
      setPendingMesaIds((prev) => {
        const next = new Set(prev)
        next.add(mesa.id)
        return next
      })
      unassignMutation.mutate(mesa.id)
      return
    }

    // Available mesa → assign
    setPendingMesaIds((prev) => {
      const next = new Set(prev)
      next.add(mesa.id)
      return next
    })
    assignMutation.mutate(mesa.id)
  }

  // Determine the "active" mesa for the cart panel:
  // - If selectedMesaId is one of our mesas, use it
  // - Otherwise use the last toggled mesa
  // - Otherwise use the first of our mesas
  const activeMesaForCart = useMemo(() => {
    if (selectedMesaId && myMesaIds.has(selectedMesaId)) {
      return localMyMesas.find((m) => m.id === selectedMesaId) ?? null
    }
    if (lastToggledMesa && myMesaIds.has(lastToggledMesa.id)) {
      return lastToggledMesa
    }
    return localMyMesas[0] ?? null
  }, [localMyMesas, myMesaIds, selectedMesaId, lastToggledMesa])

  // When confirming, also fire onMesaSelected with the active mesa for cart
  const handleConfirmClick = () => {
    if (activeMesaForCart) {
      onMesaSelected?.(activeMesaForCart)
    }
    onMesasChanged?.(localMyMesas)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 gap-0 overflow-hidden md:max-w-2xl md:left-1/2 md:right-auto md:-translate-x-1/2">
        <SheetTitle className="sr-only">Seleccionar mesas</SheetTitle>
        <SheetDescription className="sr-only">Elegí las mesas que estás atendiendo</SheetDescription>

        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="shrink-0 border-b border-border/50 px-5 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${colorPrincipal}15` }}
                >
                  <Armchair
                    className="h-5 w-5"
                    style={{ color: colorPrincipal }}
                  />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg leading-tight">
                    Tus mesas
                    {myMesasCount > 0 && (
                      <span
                        className="ml-2 text-sm font-bold"
                        style={{ color: colorPrincipal }}
                      >
                        ({myMesasCount})
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    {mozoNombre} · {negocioNombre}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" />
                Disponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md border-2 border-primary/40 bg-primary/5" />
                Tu mesa
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md border-2 border-muted bg-muted/30" />
                Ocupada
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-behavior-contain px-4 py-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-20" />
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-2xl" />
                  ))}
                </div>
              </div>
            ) : mesas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${colorPrincipal}10` }}
                >
                  <Armchair
                    className="h-8 w-8"
                    style={{ color: `${colorPrincipal}60` }}
                  />
                </div>
                <h3 className="font-bold text-base">No hay mesas disponibles</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  El negocio aún no creó mesas en el salón
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {zonaGroups.map(([zona, zoneMesas]) => (
                  <div key={zona || "__no_zona__"}>
                    {zona && (
                      <div className="flex items-center gap-2 mb-2.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">{zona}</span>
                        <span className="text-[10px] text-muted-foreground/60">({zoneMesas.length})</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      <AnimatePresence>
                        {zoneMesas.map((mesa) => {
                          const isMyMesa = myMesaIds.has(mesa.id)
                          const isOccupied = !!mesa.mozoAsignado && mesa.mozoAsignado.codigo !== mozoCodigo
                          const isPending = pendingMesaIds.has(mesa.id)
                          const isActive = selectedMesaId
                            ? mesa.id === selectedMesaId && isMyMesa
                            : false

                          return (
                            <motion.button
                              key={mesa.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileTap={!isOccupied ? { scale: 0.95 } : undefined}
                              onClick={() => handleToggleMesa(mesa)}
                              disabled={isPending || isOccupied}
                              className={cn(
                                "relative flex flex-col items-center justify-center aspect-square rounded-2xl border-2 transition-all duration-200",
                                // Available mesa (no mozo assigned)
                                !isMyMesa && !isOccupied && "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-400 hover:shadow-md active:scale-95 cursor-pointer",
                                // My mesa (assigned to this mozo)
                                isMyMesa && !isActive && "border-primary/40 bg-primary/5 hover:border-primary/60 hover:shadow-md active:scale-95 cursor-pointer",
                                // Currently "active" mesa (selected for cart)
                                isActive && "border-primary bg-primary/10 shadow-lg cursor-pointer",
                                // Occupied by another mozo — not tappable
                                isOccupied && "border-muted bg-muted/20 opacity-60 cursor-not-allowed",
                                // Pending (mutating)
                                isPending && "border-primary animate-pulse",
                              )}
                              style={isActive || isMyMesa ? {
                                borderColor: colorPrincipal,
                                backgroundColor: isMyMesa ? `${colorPrincipal}10` : undefined,
                                boxShadow: isActive ? `0 4px 14px ${colorPrincipal}25` : undefined,
                              } : undefined}
                            >
                              {/* Check mark for my mesas */}
                              {isMyMesa && !isPending && (
                                <div
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-200"
                                  style={{ backgroundColor: colorPrincipal }}
                                >
                                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                </div>
                              )}

                              {/* Pending spinner */}
                              {isPending && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/50">
                                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: colorPrincipal }} />
                                </div>
                              )}

                              <span className={cn(
                                "text-2xl font-extrabold leading-none",
                                !isMyMesa && !isOccupied && "text-emerald-700 dark:text-emerald-300",
                                isMyMesa && !isOccupied && "text-foreground",
                                isOccupied && "text-muted-foreground",
                              )}>
                                {mesa.numero}
                              </span>

                              {mesa.nombre && (
                                <span className="text-[10px] font-medium mt-0.5 truncate max-w-[90%] text-muted-foreground">
                                  {mesa.nombre}
                                </span>
                              )}

                              {/* Available mesa — show capacity */}
                              {!isOccupied && !isMyMesa && !mesa.mozoAsignado && (
                                <span className="text-[9px] text-muted-foreground mt-1 flex items-center gap-0.5">
                                  <Users className="h-2.5 w-2.5" />
                                  {mesa.capacidad}
                                </span>
                              )}

                              {/* My mesa — show "Tu mesa" label */}
                              {isMyMesa && (
                                <span className="text-[9px] mt-1 flex items-center gap-0.5 font-semibold" style={{ color: colorPrincipal }}>
                                  <UserCheck className="h-2.5 w-2.5" />
                                  Tu mesa
                                </span>
                              )}

                              {/* Occupied by other mozo — show name */}
                              {isOccupied && (
                                <span className="text-[9px] text-muted-foreground mt-1">
                                  {mesa.mozoAsignado?.nombre}
                                </span>
                              )}
                            </motion.button>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with confirm button */}
          <div className="shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-md px-5 py-3">
            {/* My mesas summary chips */}
            {localMyMesas.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[11px] text-muted-foreground shrink-0 mr-1">Tus mesas:</span>
                {localMyMesas.map((mesa) => (
                  <span
                    key={mesa.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0"
                    style={{
                      backgroundColor: `${colorPrincipal}15`,
                      color: colorPrincipal,
                      border: `1px solid ${colorPrincipal}25`,
                    }}
                  >
                    <Armchair className="h-3 w-3" />
                    {mesa.numero}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  {myMesasCount === 0
                    ? "Tocá una mesa disponible para asignártela"
                    : "Tocá una mesa disponible para asignarte, o tu mesa para desasignarte"}
                </p>
              </div>
              <Button
                onClick={handleConfirmClick}
                className="shrink-0 rounded-xl font-bold px-6"
                style={{
                  backgroundColor: colorPrincipal,
                  color: "white",
                }}
              >
                Listo
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
