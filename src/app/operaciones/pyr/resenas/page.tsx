"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Star,
  MessageSquare,
  Send,
  CheckCircle2,
  ShieldAlert,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Límite de longitud de la respuesta (mismo tope que la API; ver CODEX_REPORT).
const MAX_RESPUESTA_LEN = 1000

// ============================================
// Tipos (espejo del panel seguro de reseñas)
// ============================================
interface ResenaItem {
  id: string
  clienteNombre: string | null
  puntuacion: number
  comentario: string | null
  fecha: string
  respuestaNegocio: string | null
  fechaRespuesta: string | null
}

interface Resumen {
  total: number
  promedio: number | null
  sinResponder: number
  distribucion: Record<number, number>
}

interface PanelData {
  terminal: { nombre: string }
  negocio: { nombre: string; colorPrincipal: string }
  capacidades: { puedeResponderResena: boolean }
  resumen: Resumen
  resenas: ResenaItem[]
}

type Phase =
  | { kind: "loading" }
  | { kind: "no-session" }
  | { kind: "no-permission" }
  | { kind: "error" }
  | { kind: "ready"; data: PanelData; stale: boolean }

type Filtro = "todas" | "sin_responder" | "respondidas"

const FILTRO_OPTIONS: { value: Filtro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "sin_responder", label: "Sin responder" },
  { value: "respondidas", label: "Respondidas" },
]

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toResumen(raw: unknown): Resumen {
  const r = (raw ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
  const dRaw = (r.distribucion ?? {}) as Record<string, unknown>
  const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (let i = 1; i <= 5; i++) distribucion[i] = num(dRaw[i])
  return {
    total: num(r.total),
    promedio: typeof r.promedio === "number" && Number.isFinite(r.promedio) ? r.promedio : null,
    sinResponder: num(r.sinResponder),
    distribucion,
  }
}

// ============================================
// Página
// ============================================
export default function OperacionesPyRResenasPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actingIds, setActingIds] = useState<Set<string>>(() => new Set())

  const stoppedRef = useRef(false)
  const acRef = useRef<AbortController | null>(null)
  const genRef = useRef(0)
  const actingIdsRef = useRef<Set<string>>(new Set())

  const applyTransientError = useCallback(() => {
    setPhase((prev) => (prev.kind === "ready" ? { ...prev, stale: true } : { kind: "error" }))
  }, [])

  const refresh = useCallback(async () => {
    if (stoppedRef.current) return
    // Nunca disparar un request con la pestaña oculta (p.ej. refresh posterior a una
    // mutación cuando el usuario ya cambió de pestaña). La mutación en curso no se altera.
    if (document.visibilityState !== "visible") return
    acRef.current?.abort()
    const ac = new AbortController()
    acRef.current = ac
    const gen = ++genRef.current

    try {
      const res = await fetch("/api/operaciones/pyr/resenas", { cache: "no-store", signal: ac.signal })
      if (gen !== genRef.current) return

      if (res.status === 401) {
        stoppedRef.current = true
        setPhase({ kind: "no-session" })
        return
      }
      if (res.status === 403) {
        stoppedRef.current = true
        setPhase({ kind: "no-permission" })
        return
      }
      if (!res.ok) {
        applyTransientError()
        return
      }

      const data = await res.json().catch(() => null)
      if (gen !== genRef.current) return
      if (!data || !data.ok || !data.negocio || !data.terminal) {
        applyTransientError()
        return
      }

      setPhase({
        kind: "ready",
        data: {
          terminal: { nombre: data.terminal.nombre },
          negocio: {
            nombre: data.negocio.nombre,
            colorPrincipal: data.negocio.colorPrincipal || "#FB8C00",
          },
          capacidades: { puedeResponderResena: data.capacidades?.puedeResponderResena === true },
          resumen: toResumen(data.resumen),
          resenas: Array.isArray(data.resenas) ? data.resenas : [],
        },
        stale: false,
      })
      setLastUpdated(Date.now())
    } catch {
      if (ac.signal.aborted) return
      if (gen !== genRef.current) return
      applyTransientError()
    }
  }, [applyTransientError])

  // Acción: responder una reseña. Control por reseña (Set + ref) para evitar doble clic.
  const handleResponder = useCallback(
    async (resenaId: string, respuesta: string) => {
      if (actingIdsRef.current.has(resenaId)) return
      actingIdsRef.current.add(resenaId)
      setActingIds((prev) => {
        const next = new Set(prev)
        next.add(resenaId)
        return next
      })
      try {
        const res = await fetch(
          `/api/operaciones/pyr/resenas/${encodeURIComponent(resenaId)}/responder`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ respuesta }),
          }
        )

        if (res.status === 401) {
          stoppedRef.current = true
          setPhase({ kind: "no-session" })
          return
        }
        if (res.status === 403) {
          toast.error("Esta terminal no tiene permiso para realizar esa acción.")
          await refresh()
          return
        }
        if (res.status === 409) {
          toast.error("La reseña cambió en otro dispositivo. Actualizando panel.")
          await refresh()
          return
        }
        if (res.status === 429) {
          toast.error("Demasiados intentos. Esperá un momento.")
          return
        }
        if (res.status === 400) {
          toast.error("La respuesta no es válida. Revisá e intentá de nuevo.")
          return
        }
        if (!res.ok) {
          toast.error("No se pudo enviar la respuesta. Intentá de nuevo.")
          return
        }
        const data = await res.json().catch(() => null)
        if (!data || !data.ok) {
          toast.error("No se pudo enviar la respuesta. Intentá de nuevo.")
          return
        }

        toast.success("Respuesta enviada")
        await refresh()
      } catch {
        toast.error("No se pudo enviar la respuesta. Intentá de nuevo.")
      } finally {
        actingIdsRef.current.delete(resenaId)
        setActingIds((prev) => {
          const next = new Set(prev)
          next.delete(resenaId)
          return next
        })
      }
    },
    [refresh]
  )

  // Sin polling. Carga al abrir (solo si visible) + foco/visibilidad.
  // NUNCA se ejecutan requests automáticas con la pestaña oculta.
  useEffect(() => {
    if (document.visibilityState === "visible") void refresh()

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      acRef.current?.abort()
    }
  }, [refresh])

  if (phase.kind === "loading") {
    return (
      <CenteredShell>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando reseñas…</p>
      </CenteredShell>
    )
  }

  if (phase.kind === "no-session") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta terminal no está vinculada o su sesión ya no está vigente.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href="/operaciones">
            <ArrowLeft className="h-4 w-4" />
            Volver a Operaciones
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  if (phase.kind === "no-permission") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta terminal no tiene permiso para acceder a Reseñas.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href="/operaciones/pyr">
            <ArrowLeft className="h-4 w-4" />
            Volver a Pedidos y reseñas
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  if (phase.kind === "error") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <WifiOff className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          No se pudieron cargar las reseñas. Revisá la conexión e intentá de nuevo.
        </p>
        <Button className="rounded-xl gap-2 font-semibold" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </CenteredShell>
    )
  }

  return (
    <ResenasView
      data={phase.data}
      stale={phase.stale}
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      selectedId={selectedId}
      onSelect={setSelectedId}
      actingIds={actingIds}
      onResponder={handleResponder}
    />
  )
}

// ============================================
// Vista principal de reseñas
// ============================================
function ResenasView({
  data,
  stale,
  lastUpdated,
  onRefresh,
  selectedId,
  onSelect,
  actingIds,
  onResponder,
}: {
  data: PanelData
  stale: boolean
  lastUpdated: number | null
  onRefresh: () => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  actingIds: Set<string>
  onResponder: (resenaId: string, respuesta: string) => void
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [replyMode, setReplyMode] = useState(false)
  const [respuesta, setRespuesta] = useState("")

  // Al cambiar de reseña seleccionada, salir del modo respuesta y limpiar el texto.
  useEffect(() => {
    setReplyMode(false)
    setRespuesta("")
  }, [selectedId])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const filtered = useMemo(() => {
    if (filtro === "sin_responder") return data.resenas.filter((r) => !r.respuestaNegocio)
    if (filtro === "respondidas") return data.resenas.filter((r) => !!r.respuestaNegocio)
    return data.resenas
  }, [data.resenas, filtro])

  const selected = selectedId != null ? data.resenas.find((r) => r.id === selectedId) ?? null : null
  const r = data.resumen

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
            <Link href="/operaciones/pyr" aria-label="Volver a Pedidos y reseñas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
                <Star className="h-3 w-3" />
                Reseñas
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {data.negocio.nombre} · {data.terminal.nombre}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stale ? (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <WifiOff className="h-3 w-3" />
                Sin actualizar
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {lastUpdated ? `Hace ${getTimeAgo(new Date(lastUpdated).toISOString())}` : "En vivo"}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 h-9 text-xs"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Actualizar ahora</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-24">
        {stale && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
            <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No se pudo actualizar. Mostrando los últimos datos.
            </p>
          </div>
        )}

        {/* Resumen operativo */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Stars value={r.promedio ?? 0} />
              <span className="text-lg font-extrabold">{r.promedio ?? "—"}</span>
            </div>
            <span className="text-xs text-muted-foreground">{r.total} {r.total === 1 ? "reseña" : "reseñas"}</span>
            {r.sinResponder > 0 && (
              <Badge className="text-[10px] h-5 px-1.5 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                {r.sinResponder} sin responder
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = r.distribucion[star] ?? 0
              const pct = r.total > 0 ? Math.round((count / r.total) * 100) : 0
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-3 text-right">{star}</span>
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Filtro local */}
        <div className="flex gap-2 flex-wrap">
          {FILTRO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFiltro(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                filtro === opt.value
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Listado */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">Sin reseñas</p>
            <p className="text-xs text-muted-foreground mt-0.5">No hay reseñas para este filtro.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((resena) => (
              <ResenaRow key={resena.id} resena={resena} onClick={() => onSelect(resena.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Detalle / respuesta (drawer) */}
      <Drawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) onSelect(null)
        }}
      >
        <DrawerContent className="max-h-[85vh]">
          {selected && (
            <>
              <DrawerHeader className="text-left shrink-0">
                <DrawerTitle className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Stars value={selected.puntuacion} />
                      {selected.respuestaNegocio ? (
                        <Badge className="text-[10px] h-5 px-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                          Respondida
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] h-5 px-1.5 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                          Sin responder
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{selected.clienteNombre || "Cliente"}</span>
                      <span>·</span>
                      <span>{formatDateTime(selected.fecha)}</span>
                    </div>
                  </div>
                </DrawerTitle>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 overscroll-contain space-y-3">
                {selected.comentario && (
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                    {selected.comentario}
                  </p>
                )}

                {selected.respuestaNegocio && (
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Respuesta del negocio
                      </span>
                      {selected.fechaRespuesta && (
                        <span className="text-[10px] text-muted-foreground">
                          · {formatDateTime(selected.fechaRespuesta)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                      {selected.respuestaNegocio}
                    </p>
                  </div>
                )}

                {/* Responder: solo con permiso y si no tiene respuesta */}
                {data.capacidades.puedeResponderResena && !selected.respuestaNegocio && (
                  <ResponderResena
                    resena={selected}
                    saving={actingIds.has(selected.id)}
                    replyMode={replyMode}
                    respuesta={respuesta}
                    onSetReplyMode={setReplyMode}
                    onSetRespuesta={setRespuesta}
                    onResponder={onResponder}
                  />
                )}
              </div>

              <DrawerFooter className="border-t pt-3">
                <Button variant="outline" className="rounded-xl" onClick={() => onSelect(null)}>
                  Cerrar
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </main>
  )
}

// ============================================
// Subcomponentes
// ============================================
function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center text-center gap-3">{children}</div>
    </main>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3.5 w-3.5",
            star <= Math.round(value)
              ? "text-amber-400 fill-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

function ResenaRow({ resena, onClick }: { resena: ResenaItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Stars value={resena.puntuacion} />
          <span className="text-[10px] text-muted-foreground">{getTimeAgo(resena.fecha)}</span>
          {resena.respuestaNegocio ? (
            <Badge className="text-[9px] h-4 px-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              Respondida
            </Badge>
          ) : (
            <Badge className="text-[9px] h-4 px-1.5 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Sin responder
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {resena.clienteNombre || "Cliente"}
          {resena.comentario ? ` · ${resena.comentario}` : ""}
        </p>
      </div>
    </button>
  )
}

function ResponderResena({
  resena,
  saving,
  replyMode,
  respuesta,
  onSetReplyMode,
  onSetRespuesta,
  onResponder,
}: {
  resena: ResenaItem
  saving: boolean
  replyMode: boolean
  respuesta: string
  onSetReplyMode: (v: boolean) => void
  onSetRespuesta: (v: string) => void
  onResponder: (resenaId: string, respuesta: string) => void
}) {
  if (!replyMode) {
    return (
      <Button
        className="w-full rounded-xl gap-1.5 h-10 text-sm font-semibold"
        disabled={saving}
        onClick={() => onSetReplyMode(true)}
      >
        <MessageSquare className="h-4 w-4" />
        Responder reseña
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
      <p className="text-xs font-semibold">Tu respuesta</p>
      <textarea
        value={respuesta}
        onChange={(e) => onSetRespuesta(e.target.value)}
        maxLength={MAX_RESPUESTA_LEN}
        rows={3}
        placeholder="Escribí tu respuesta…"
        disabled={saving}
        className="w-full px-3 py-2 rounded-lg text-sm border border-border/50 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {respuesta.length}/{MAX_RESPUESTA_LEN}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 rounded-xl"
          disabled={saving}
          onClick={() => {
            onSetReplyMode(false)
            onSetRespuesta("")
          }}
        >
          Cancelar
        </Button>
        <Button
          className="flex-1 rounded-xl gap-1.5"
          disabled={saving || !respuesta.trim()}
          onClick={() => onResponder(resena.id, respuesta.trim())}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar respuesta
        </Button>
      </div>
    </div>
  )
}
