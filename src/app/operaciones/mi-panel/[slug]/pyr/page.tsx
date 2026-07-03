"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import { cn } from "@/lib/utils"

// ============================================
// DeliGO Operaciones — Panel personal de PyR: reseñas (Operaciones-1N)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal. Usa solo GET /api/operativo/pyr/resenas?slug=...
// y POST /api/operativo/pyr/resenas/[id]/responder. No llama /api/operaciones/** ni
// /api/negocio/** ni /api/empleado/** ni /api/chat/** ni /api/operativo/mozo/** ni
// /api/operativo/salon/**. Existe UNA sola acción de mutación, fija: responder una reseña
// sin respuesta (nunca editar ni borrar). Refresco automático estándar (1G.1): 15 s con
// pestaña visible + focus + visibilitychange, sin solapamiento, salida atómica ante
// pérdida de área/sesión, guardia de generación contra respuestas fuera de orden. Mismas
// protecciones de concurrencia validadas en los paneles personales de Salón y Mozo:
// guardia síncrona por reseña, barrera global de refresh, mutationContextGenRef para
// descartar respuestas tardías tras una salida global.

const PYR_REFRESH_INTERVAL_MS = 15000
const MAX_RESPUESTA_LEN = 1000

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
  sinResponder: number
  promedio: number | null
  distribucion: Record<number, number>
}

interface PyRData {
  negocio: { nombre: string; slug: string; colorPrincipal: string }
  resumen: Resumen
  resenas: ResenaItem[]
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: PyRData }
  | { status: "unavailable" }
  | { status: "error" }

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
    sinResponder: num(r.sinResponder),
    promedio: typeof r.promedio === "number" && Number.isFinite(r.promedio) ? r.promedio : null,
    distribucion,
  }
}

export default function PyRPersonalPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const nav = useOperativoNav()
  const slug = params.slug

  const [state, setState] = useState<PageState>({ status: "loading" })

  // Reseñas con una respuesta en curso. `respondingIds` (estado React) SOLO renderiza
  // (spinner + disabled). `respondingIdsRef` es la fuente SÍNCRONA de verdad: (1) guardia
  // por reseña contra doble click (dos clicks en el mismo tick llegan antes del
  // re-render); (2) barrera GLOBAL de refresh — mientras su tamaño sea > 0 existe al
  // menos una respuesta en curso y ningún refresh puede iniciar ni aplicar datos. Reseñas
  // distintas pueden responderse en paralelo sin bloquearse entre sí.
  const respondingIdsRef = useRef<Set<string>>(new Set())
  const [respondingIds, setRespondingIds] = useState<Set<string>>(() => new Set())
  // Mensaje de error por reseña (no técnico, liberado junto con su propia respuesta).
  const [resenaErrors, setResenaErrors] = useState<Record<string, string>>({})

  // Borradores y formularios desplegados: estado puramente visual en memoria (nunca
  // localStorage/sessionStorage), independientes por reseña.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [openReplyIds, setOpenReplyIds] = useState<Set<string>>(() => new Set())
  const [filtro, setFiltro] = useState<Filtro>("todas")

  // Una sola solicitud activa (abort de la anterior) + guardia de generación contra
  // respuestas fuera de orden. refreshGenRef invalida respuestas de GET/polling; no
  // protege respuestas de POST /responder en vuelo (ver mutationContextGenRef, más abajo).
  const refreshAcRef = useRef<AbortController | null>(null)
  const refreshGenRef = useRef(0)

  // Generación del contexto de MUTACIONES (POST /responder), independiente de
  // refreshGenRef. Se incrementa EXCLUSIVAMENTE cuando una salida global (pérdida de
  // área, sesión o disponibilidad) invalida todas las respuestas que sigan en vuelo —
  // nunca al iniciar una acción individual, por lo que reseñas distintas comparten
  // generación sin bloquearse entre sí.
  const mutationContextGenRef = useRef(0)

  const invalidatePanelRefresh = useCallback(() => {
    refreshGenRef.current += 1
    refreshAcRef.current?.abort()
    refreshAcRef.current = null
  }, [])

  // Invalida el contexto de mutaciones: toda respuesta POST /responder cuya generación
  // capturada ya no coincida se descarta por completo (ver handleResponder). No navega,
  // no cambia PageState, no inicia fetch y no toca refreshAcRef/refreshGenRef.
  const invalidateMutationContext = useCallback(() => {
    mutationContextGenRef.current += 1
    respondingIdsRef.current.clear()
  }, [])

  // Salida atómica: invalidar refresh y contexto de mutaciones, limpiar/ocultar datos
  // ANTES de navegar; solo skeleton en tránsito, sin controles ni estados de acción.
  const redirectToPersonalHomeAfterAreaLoss = useCallback(() => {
    invalidatePanelRefresh()
    invalidateMutationContext()
    setRespondingIds(new Set())
    setResenaErrors({})
    setState({ status: "loading" })
    router.replace(nav.homeHref)
  }, [invalidatePanelRefresh, invalidateMutationContext, router, nav.homeHref])

  const redirectToLoginAfterSessionLoss = useCallback(() => {
    invalidatePanelRefresh()
    invalidateMutationContext()
    setRespondingIds(new Set())
    setResenaErrors({})
    setState({ status: "loading" })
    router.replace(nav.loginHref)
  }, [invalidatePanelRefresh, invalidateMutationContext, router, nav.loginHref])

  const loadPanel = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      // Barrera global: mientras haya al menos una respuesta en curso (reseña A y B en
      // paralelo, por ejemplo), ningún refresh puede comenzar ni aplicar datos — ni
      // interval, ni focus/visibilitychange, ni botón manual. Sin abortar nada, sin subir
      // generación, sin cambiar PageState, sin AbortController, sin fetch: solo se retorna.
      if (respondingIdsRef.current.size > 0) return
      // Sin solapamiento: un refresco silencioso no se inicia si ya hay una activa.
      if (silent && refreshAcRef.current) return
      refreshAcRef.current?.abort()
      const ac = new AbortController()
      refreshAcRef.current = ac
      const generation = ++refreshGenRef.current

      if (!silent) setState({ status: "loading" })

      try {
        const query = new URLSearchParams({ slug })
        const res = await fetch(`/api/operativo/pyr/resenas?${query.toString()}`, {
          cache: "no-store",
          signal: ac.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (generation !== refreshGenRef.current) return

        // Cambio de área: salida atómica al inicio personal.
        if (data.estado === "area_no_habilitada") {
          redirectToPersonalHomeAfterAreaLoss()
          return
        }
        // Sesión perdida: al login según árbol. Nunca al home por un 401.
        if (res.status === 401 || data.estado === "sin_sesion") {
          redirectToLoginAfterSessionLoss()
          return
        }
        // Negocio/vínculo no disponible: estado seguro (sin redirigir como cambio de
        // área). Salida atómica: invalidar refresh/mutaciones y limpiar spinners/errores
        // ANTES de mostrar el estado seguro (mismo patrón ya usado dentro del POST).
        if (res.status === 403 || data.estado === "acceso_no_disponible") {
          invalidatePanelRefresh()
          invalidateMutationContext()
          setRespondingIds(new Set())
          setResenaErrors({})
          setState({ status: "unavailable" })
          return
        }
        if (!res.ok || !data.ok) {
          if (!silent) setState({ status: "error" })
          return
        }

        setState({
          status: "ready",
          data: {
            negocio: {
              nombre: data.negocio?.nombre ?? "",
              slug: data.negocio?.slug ?? slug,
              colorPrincipal: data.negocio?.colorPrincipal || "#FB8C00",
            },
            resumen: toResumen(data.resumen),
            resenas: Array.isArray(data.resenas) ? data.resenas : [],
          },
        })
      } catch {
        // Abort/respuesta superada: no tocar estado. Error de red en silencioso:
        // conservar los datos visibles; en carga inicial/manual mostrar error.
        if (ac.signal.aborted || generation !== refreshGenRef.current) return
        if (!silent) setState({ status: "error" })
      } finally {
        if (refreshAcRef.current === ac) refreshAcRef.current = null
      }
    },
    [
      slug,
      redirectToPersonalHomeAfterAreaLoss,
      redirectToLoginAfterSessionLoss,
      invalidatePanelRefresh,
      invalidateMutationContext,
    ]
  )

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

  // Refresco automático silencioso: 15 s (solo pestaña visible) + focus + visibility.
  useEffect(() => {
    const silentRefresh = () => {
      if (document.visibilityState === "visible") void loadPanel({ silent: true })
    }
    const interval = window.setInterval(silentRefresh, PYR_REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") silentRefresh()
    }
    const onFocus = () => silentRefresh()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      // No setState aquí (desmontaje): solo invalidar refresh y respuestas en vuelo para
      // que un POST que responda después de salir de la página no escriba en un
      // componente desmontado.
      invalidatePanelRefresh()
      invalidateMutationContext()
    }
  }, [loadPanel, invalidatePanelRefresh, invalidateMutationContext])

  // Acción única (Operaciones-1N): responder una reseña sin respuesta. Solo
  // /api/operativo/**. Nunca edita ni borra una respuesta existente.
  const handleResponder = async (resenaId: string, respuestaTexto: string) => {
    // Guardia SÍNCRONA por reseña: la ref se consulta y marca antes de cualquier await,
    // por lo que un segundo click sobre la misma reseña (aun antes de un re-render) no
    // genera otro POST. Otras reseñas no quedan bloqueadas.
    if (respondingIdsRef.current.has(resenaId)) return
    const texto = respuestaTexto.trim()
    if (!texto) return

    respondingIdsRef.current.add(resenaId)
    setRespondingIds((prev) => new Set(prev).add(resenaId))
    setResenaErrors((prev) => {
      if (!(resenaId in prev)) return prev
      const next = { ...prev }
      delete next[resenaId]
      return next
    })

    // Invalidar el polling: cualquier respuesta iniciada antes de la mutación queda
    // obsoleta por generación y no puede pisar el resultado local aunque llegue tarde.
    invalidatePanelRefresh()

    // Generación del contexto de mutaciones capturada ANTES de cualquier await. Si una
    // salida global (área/sesión/disponibilidad) invalida el contexto mientras este POST
    // sigue en vuelo, la respuesta tardía de ESTA acción se descarta por completo más
    // abajo, sin escribir nada en la UI.
    const mutationGeneration = mutationContextGenRef.current

    // Solo se confirma con el servidor tras éxito, 400, 409, 429 o error de red/dominio
    // no crítico. Permanece en false ante area_no_habilitada, sin_sesion/401 o
    // acceso_no_disponible/403 (esos casos no deben disparar refresh posterior).
    let debeConfirmarEstadoReal = false

    try {
      const res = await fetch(
        `/api/operativo/pyr/resenas/${encodeURIComponent(resenaId)}/responder?slug=${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ respuesta: texto }),
        }
      )
      const data = await res.json().catch(() => ({}))

      // Respuesta tardía: una salida global (de esta acción o de otra respuesta paralela)
      // ya invalidó el contexto de mutaciones mientras este POST estaba en vuelo. No debe
      // actualizar reseñas, mostrar errores, alterar loading, navegar ni disparar refresh.
      if (mutationGeneration !== mutationContextGenRef.current) return

      // Cambio de área / sesión durante la acción: salida atómica (sin mostrar error,
      // sin refresh posterior).
      if (data.estado === "area_no_habilitada") {
        redirectToPersonalHomeAfterAreaLoss()
        return
      }
      if (res.status === 401 || data.estado === "sin_sesion") {
        redirectToLoginAfterSessionLoss()
        return
      }
      // Negocio/vínculo no disponible durante la acción: estado seguro INMEDIATO, sin
      // redirigir al home y sin refresh posterior.
      if (res.status === 403 || data.estado === "acceso_no_disponible") {
        invalidatePanelRefresh()
        invalidateMutationContext()
        setRespondingIds(new Set())
        setResenaErrors({})
        setState({ status: "unavailable" })
        return
      }

      if (res.ok && data.ok) {
        // Sin actualización optimista: no se inventa fecha ni contenido. Solo se limpia
        // el borrador y se cierra el formulario de ESA reseña; la respuesta confirmada
        // aparece recién con el refresh silencioso del servidor.
        setDrafts((prev) => {
          if (!(resenaId in prev)) return prev
          const next = { ...prev }
          delete next[resenaId]
          return next
        })
        setOpenReplyIds((prev) => {
          if (!prev.has(resenaId)) return prev
          const next = new Set(prev)
          next.delete(resenaId)
          return next
        })
        debeConfirmarEstadoReal = true
      } else {
        // 400 / 409 / 429 / error de dominio: mensaje local, no técnico, sin redirigir.
        const mensaje =
          res.status === 409
            ? "La reseña ya no está disponible para responder."
            : res.status === 429
              ? "Demasiados intentos. Esperá un momento."
              : data.error || "No se pudo enviar la respuesta."
        setResenaErrors((prev) => ({ ...prev, [resenaId]: mensaje }))
        debeConfirmarEstadoReal = true
      }
    } catch {
      // Misma comprobación de generación para el error de red: una mutación ya invalidada
      // por una salida global no debe mostrar mensaje de error.
      if (mutationGeneration !== mutationContextGenRef.current) return
      setResenaErrors((prev) => ({
        ...prev,
        [resenaId]: "No se pudo enviar la respuesta. Revisá la conexión.",
      }))
      debeConfirmarEstadoReal = true
    } finally {
      // Si el contexto de mutaciones ya no coincide, esta acción quedó invalidada por una
      // salida global (que ya limpió respondingIdsRef/respondingIds por su cuenta): no
      // volver a tocar el estado React, no restaurar resenaId en la ref y no disparar
      // refresh.
      const sigueVigente = mutationGeneration === mutationContextGenRef.current
      if (sigueVigente) {
        // Liberar SIEMPRE la guardia síncrona y el loading visual de esta reseña
        // (éxito, 400, 409, 429, error de red).
        respondingIdsRef.current.delete(resenaId)
        setRespondingIds((prev) => {
          const next = new Set(prev)
          next.delete(resenaId)
          return next
        })

        // Solo la última respuesta pendiente en terminar dispara la confirmación: si otra
        // reseña sigue respondiéndose, esa será la responsable del refresh final.
        if (debeConfirmarEstadoReal && respondingIdsRef.current.size === 0) {
          void loadPanel({ silent: true })
        }
      }
    }
  }

  const filteredResenas = useMemo(() => {
    if (state.status !== "ready") return [] as ResenaItem[]
    if (filtro === "sin_responder") return state.data.resenas.filter((r) => !r.respuestaNegocio)
    if (filtro === "respondidas") return state.data.resenas.filter((r) => !!r.respuestaNegocio)
    return state.data.resenas
  }, [state, filtro])

  if (state.status === "loading") {
    return (
      <Shell>
        <div className="space-y-3">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </Shell>
    )
  }

  if (state.status === "unavailable") {
    return (
      <Shell>
        <div className="text-center space-y-4 py-6">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-muted text-muted-foreground">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold">Pedidos y reseñas no disponible</h1>
            <p className="text-sm text-muted-foreground">
              No tenés acceso operativo a este panel en este momento.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl w-full gap-2">
            <Link href={nav.homeHref}>
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </Shell>
    )
  }

  if (state.status === "error") {
    return (
      <Shell>
        <div className="text-center space-y-4 py-6">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-muted text-muted-foreground">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold">No se pudieron cargar las reseñas</h1>
            <p className="text-sm text-muted-foreground">Revisá la conexión e intentá de nuevo.</p>
          </div>
          <Button className="rounded-xl w-full gap-2 font-semibold" onClick={() => loadPanel()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
          <Button asChild variant="ghost" className="rounded-xl w-full gap-2 text-muted-foreground">
            <Link href={nav.homeHref}>
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </Shell>
    )
  }

  const { negocio, resumen } = state.data
  const accent = negocio.colorPrincipal

  return (
    <Shell wide>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Logo size="sm" />
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              <Star className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold leading-tight">DeliGO Operaciones</h1>
              <p className="text-sm text-muted-foreground truncate">{negocio.nombre}</p>
            </div>
          </div>
          <Badge className="border-0" style={{ backgroundColor: `${accent}15`, color: accent }}>
            Pedidos y reseñas
          </Badge>
        </div>
        <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
          <Link href={nav.homeHref} aria-label="Volver a mi panel">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Navegación a pedidos activos (solo lectura, Operaciones-1O) */}
      <Link
        href={`/operaciones/mi-panel/${encodeURIComponent(slug)}/pyr/pedidos`}
        className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm font-semibold hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" style={{ color: accent }} />
          Ver pedidos activos
        </span>
        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
      </Link>

      {/* Resumen */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Stars value={resumen.promedio ?? 0} />
            <span className="text-lg font-extrabold">{resumen.promedio ?? "—"}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {resumen.total} {resumen.total === 1 ? "reseña" : "reseñas"}
          </span>
          {resumen.sinResponder > 0 && (
            <Badge className="text-[10px] h-5 px-1.5 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              {resumen.sinResponder} sin responder
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = resumen.distribucion[star] ?? 0
            const pct = resumen.total > 0 ? Math.round((count / resumen.total) * 100) : 0
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-3 text-right">{star}</span>
                <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: accent }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground w-8 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filtro (solo cliente, no se envía a la API) */}
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
      {filteredResenas.length === 0 ? (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center bg-muted/30">
              <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              Todavía no hay reseñas para mostrar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredResenas.map((resena) => (
            <ResenaCard
              key={resena.id}
              resena={resena}
              accent={accent}
              responding={respondingIds.has(resena.id)}
              error={resenaErrors[resena.id] ?? null}
              open={openReplyIds.has(resena.id)}
              draft={drafts[resena.id] ?? ""}
              onToggleOpen={() =>
                setOpenReplyIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(resena.id)) next.delete(resena.id)
                  else next.add(resena.id)
                  return next
                })
              }
              onDraftChange={(value) => setDrafts((prev) => ({ ...prev, [resena.id]: value }))}
              onResponder={() => handleResponder(resena.id, drafts[resena.id] ?? "")}
            />
          ))}
        </div>
      )}
    </Shell>
  )
}

// ============================================
// Tarjeta de reseña
// ============================================
function ResenaCard({
  resena,
  accent,
  responding,
  error,
  open,
  draft,
  onToggleOpen,
  onDraftChange,
  onResponder,
}: {
  resena: ResenaItem
  accent: string
  responding: boolean
  error: string | null
  open: boolean
  draft: string
  onToggleOpen: () => void
  onDraftChange: (value: string) => void
  onResponder: () => void
}) {
  return (
    <Card className="rounded-xl border-border/60">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
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
        </div>

        <p className="text-xs text-muted-foreground">
          {resena.clienteNombre || "Cliente"}
        </p>
        {resena.comentario && (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
            {resena.comentario}
          </p>
        )}

        {resena.respuestaNegocio && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Respuesta del negocio
              </span>
              {resena.fechaRespuesta && (
                <span className="text-[10px] text-muted-foreground">
                  · {formatDateTime(resena.fechaRespuesta)}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
              {resena.respuestaNegocio}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            {error}
          </div>
        )}

        {/* Formulario de respuesta: solo para reseñas sin respuesta */}
        {!resena.respuestaNegocio && (
          <>
            {!open ? (
              <Button
                size="sm"
                className="h-8 w-full gap-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: accent }}
                onClick={onToggleOpen}
                disabled={responding}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Responder reseña
              </Button>
            ) : (
              <div className="rounded-lg border border-border/50 bg-card p-2.5 space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  maxLength={MAX_RESPUESTA_LEN}
                  rows={3}
                  placeholder="Escribí tu respuesta…"
                  disabled={responding}
                  className="w-full px-2.5 py-2 rounded-lg text-sm border border-border/50 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {draft.length}/{MAX_RESPUESTA_LEN}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg text-xs"
                    disabled={responding}
                    onClick={onToggleOpen}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-lg gap-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                    disabled={responding || !draft.trim()}
                    onClick={onResponder}
                  >
                    {responding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Shell y subcomponentes compartidos
// ============================================
function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-background p-4">
      <div className={wide ? "mx-auto w-full max-w-3xl space-y-5" : "mx-auto w-full max-w-md space-y-5"}>
        {children}
      </div>
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
            star <= Math.round(value) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}
