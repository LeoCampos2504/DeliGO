"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Armchair,
  ClipboardList,
  Loader2,
  Play,
  RefreshCw,
  UserCheck,
  UserX,
  UtensilsCrossed,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"

// ============================================
// DeliGO Operaciones — Panel personal de Salón (Operaciones-1I + 1J)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal. Usa solo GET /api/operativo/salon/panel/[slug]
// y POST /api/operativo/salon/pedidos/[id]/preparar. No llama /api/operaciones/** ni
// /api/negocio/** ni /api/operativo/mozo/**. Existe UNA sola acción de mutación, fija:
// recibido → preparando (por pedido de mesa). Refresco automático estándar (1G.1): 15 s
// con pestaña visible + focus + visibilitychange, sin solapamiento, salida atómica ante
// pérdida de área/sesión, guardia de generación contra respuestas fuera de orden.

const SALON_REFRESH_INTERVAL_MS = 15000

interface MozoAsignado {
  nombre: string
  codigo: string
}

interface PedidoActivo {
  id: string
  estado: string
  total: number
}

interface MesaSalon {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  activa: boolean
  mozoAsignado: MozoAsignado | null
  pedidosActivos: PedidoActivo[]
  pedidosActivosCount: number
  pedidosActivosTotal: number
}

interface SalonData {
  negocio: { nombre: string; slug: string; colorPrincipal: string }
  resumen: { mesasActivas: number; mesasConPedidos: number; pedidosActivos: number }
  mesas: MesaSalon[]
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: SalonData }
  | { status: "unavailable" }
  | { status: "error" }

const ESTADO_LABELS: Record<string, string> = {
  recibido: "Nuevo",
  preparando: "Preparando",
  listo_para_retirar: "Listo",
}

function estadoLabel(estado: string) {
  return ESTADO_LABELS[estado] ?? estado
}

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-AR")}`
}

export default function SalonPersonalPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const nav = useOperativoNav()
  const slug = params.slug

  const [state, setState] = useState<PageState>({ status: "loading" })
  // Pedidos con "Iniciar preparación" en curso. `preparando` (estado React) SOLO renderiza
  // (spinner + disabled). `preparandoRef` cumple dos roles: (1) guardia SÍNCRONA por pedido
  // contra doble click (dos clicks en el mismo tick llegan antes del re-render, por lo que
  // el estado React no alcanza); (2) barrera GLOBAL de refresh — mientras su tamaño sea > 0
  // existe al menos una mutación de Salón en curso y ningún refresh (silencioso ni manual)
  // puede iniciar ni aplicar datos. Solo la última mutación en terminar dispara el refresh.
  const [preparando, setPreparando] = useState<Set<string>>(() => new Set())
  const preparandoRef = useRef<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  // Una sola solicitud activa (abort de la anterior) + guardia de generación.
  // refreshGenRef invalida respuestas de GET/polling (loadPanel); no protege respuestas
  // de POST /preparar en vuelo (ver mutationContextGenRef, más abajo).
  const refreshAcRef = useRef<AbortController | null>(null)
  const refreshGenRef = useRef(0)

  // Generación del contexto de MUTACIONES (POST /preparar), independiente de refreshGenRef.
  // Se incrementa EXCLUSIVAMENTE cuando una salida global (pérdida de área, sesión o
  // disponibilidad) invalida todas las mutaciones que sigan en vuelo — nunca al iniciar una
  // acción individual. Por eso pedidos distintos (A y B) capturan y comparten la misma
  // generación sin bloquearse entre sí; solo una salida global la mueve.
  const mutationContextGenRef = useRef(0)

  // Invalidación central del refresh: sube la generación (toda respuesta ya iniciada queda
  // obsoleta aunque llegue tarde) y aborta la request activa. No cambia PageState, no navega
  // y no inicia fetch: se reutiliza antes de una mutación y antes de una salida atómica.
  const invalidatePanelRefresh = useCallback(() => {
    refreshGenRef.current += 1
    refreshAcRef.current?.abort()
    refreshAcRef.current = null
  }, [])

  // Invalida el contexto de mutaciones: toda respuesta POST /preparar cuya generación
  // capturada ya no coincida con la actual se descarta por completo (ver handlePreparar).
  // No navega, no cambia PageState, no inicia fetch, no aborta el POST en vuelo (no hay
  // forma de cancelar fetch sin signal aquí) y no toca refreshAcRef/refreshGenRef — eso
  // sigue siendo responsabilidad exclusiva de invalidatePanelRefresh.
  const invalidateMutationContext = useCallback(() => {
    mutationContextGenRef.current += 1
    preparandoRef.current.clear()
  }, [])

  // Salida atómica: invalidar refresh y limpiar/ocultar datos ANTES de navegar; solo
  // skeleton en tránsito, sin botones ni estados de acción visibles.
  const redirectToPersonalHomeAfterAreaLoss = useCallback(() => {
    invalidatePanelRefresh()
    invalidateMutationContext()
    setPreparando(new Set())
    setActionError(null)
    setState({ status: "loading" })
    router.replace(nav.homeHref)
  }, [invalidatePanelRefresh, invalidateMutationContext, router, nav.homeHref])

  const redirectToLoginAfterSessionLoss = useCallback(() => {
    invalidatePanelRefresh()
    invalidateMutationContext()
    setPreparando(new Set())
    setActionError(null)
    setState({ status: "loading" })
    router.replace(nav.loginHref)
  }, [invalidatePanelRefresh, invalidateMutationContext, router, nav.loginHref])

  const loadPanel = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      // Barrera global: mientras haya al menos una mutación de Salón en curso (pedido A y
      // B en paralelo, por ejemplo), ningún refresh puede comenzar ni aplicar datos — ni
      // interval, ni focus/visibilitychange, ni botón manual. Sin abortar nada, sin subir
      // generación, sin cambiar PageState, sin AbortController, sin fetch: solo se retorna.
      if (preparandoRef.current.size > 0) return
      // Sin solapamiento: un refresco silencioso no se inicia si ya hay una activa.
      if (silent && refreshAcRef.current) return
      refreshAcRef.current?.abort()
      const ac = new AbortController()
      refreshAcRef.current = ac
      const generation = ++refreshGenRef.current

      if (!silent) setState({ status: "loading" })

      try {
        const res = await fetch(`/api/operativo/salon/panel/${encodeURIComponent(slug)}`, {
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
        // Sesión perdida: al login según árbol.
        if (res.status === 401 || data.estado === "sin_sesion") {
          redirectToLoginAfterSessionLoss()
          return
        }
        // Negocio/salón no disponible: estado seguro (sin redirigir como cambio de área).
        if (res.status === 403 || data.estado === "acceso_no_disponible") {
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
            resumen: {
              mesasActivas: data.resumen?.mesasActivas ?? 0,
              mesasConPedidos: data.resumen?.mesasConPedidos ?? 0,
              pedidosActivos: data.resumen?.pedidosActivos ?? 0,
            },
            mesas: Array.isArray(data.mesas) ? data.mesas : [],
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
    [slug, redirectToPersonalHomeAfterAreaLoss, redirectToLoginAfterSessionLoss]
  )

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

  // Refresco automático silencioso: 15 s (solo pestaña visible) + focus + visibility.
  useEffect(() => {
    const silentRefresh = () => {
      if (document.visibilityState === "visible") void loadPanel({ silent: true })
    }
    const interval = window.setInterval(silentRefresh, SALON_REFRESH_INTERVAL_MS)
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
      // No setState aquí (desmontaje): solo invalidar refresh y mutaciones en vuelo para
      // que un POST que responda después de salir de la página no escriba en un componente
      // desmontado.
      invalidatePanelRefresh()
      invalidateMutationContext()
    }
  }, [loadPanel, invalidatePanelRefresh, invalidateMutationContext])

  // Acción única (Operaciones-1J): recibido → preparando. Solo /api/operativo/**.
  const handlePreparar = async (pedidoId: string) => {
    // Guardia SÍNCRONA por pedido: la ref se consulta y marca antes de cualquier await,
    // por lo que un segundo click sobre el mismo pedido (aun antes de un re-render) no
    // genera otro POST. Otros pedidos no quedan bloqueados.
    if (preparandoRef.current.has(pedidoId)) return
    preparandoRef.current.add(pedidoId)
    setPreparando((prev) => new Set(prev).add(pedidoId))
    setActionError(null)

    // Invalidar el polling: cualquier respuesta iniciada antes de la mutación queda
    // obsoleta por generación y no puede pisar el resultado local aunque llegue tarde.
    invalidatePanelRefresh()

    // Generación del contexto de mutaciones capturada ANTES de cualquier await. Si una
    // salida global (área/sesión/disponibilidad) invalida el contexto mientras este POST
    // sigue en vuelo (por ejemplo, disparada por otro pedido en paralelo), la respuesta
    // tardía de ESTA acción se descarta por completo más abajo, sin escribir nada en la UI.
    const mutationGeneration = mutationContextGenRef.current

    // Solo se confirma con el servidor tras éxito, 404, 409 o error de red/dominio no
    // crítico. Permanece en false ante area_no_habilitada, sin_sesion/401 o
    // acceso_no_disponible/403 (esos casos no deben disparar refresh posterior).
    let debeConfirmarEstadoReal = false

    try {
      const res = await fetch(
        `/api/operativo/salon/pedidos/${encodeURIComponent(pedidoId)}/preparar?slug=${encodeURIComponent(slug)}`,
        { method: "POST", cache: "no-store" }
      )
      const data = await res.json().catch(() => ({}))

      // Respuesta tardía: una salida global (de esta acción o de otra mutación paralela)
      // ya invalidó el contexto de mutaciones mientras este POST estaba en vuelo. No debe
      // actualizar pedidos, mostrar errores, alterar loading, navegar ni disparar refresh.
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
      // Negocio/salón no disponible durante la acción: estado seguro INMEDIATO, sin
      // redirigir al home y sin refresh posterior.
      if (res.status === 403 || data.estado === "acceso_no_disponible") {
        invalidatePanelRefresh()
        invalidateMutationContext()
        setPreparando(new Set())
        setActionError(null)
        setState({ status: "unavailable" })
        return
      }

      if (res.ok && data.ok) {
        // Actualización local optimista: solo ese pedido "recibido" → "preparando".
        setState((current) => {
          if (current.status !== "ready") return current
          const mesas = current.data.mesas.map((mesa) => ({
            ...mesa,
            pedidosActivos: mesa.pedidosActivos.map((pedido) =>
              pedido.id === pedidoId ? { ...pedido, estado: "preparando" } : pedido
            ),
          }))
          return { status: "ready", data: { ...current.data, mesas } }
        })
        debeConfirmarEstadoReal = true
      } else {
        // 404 / 409 / error de dominio: mensaje local, no técnico, sin redirigir.
        setActionError(
          res.status === 404
            ? "Ese pedido ya no está disponible."
            : data.error || "No se pudo iniciar la preparación."
        )
        debeConfirmarEstadoReal = true
      }
    } catch {
      // Misma comprobación de generación para el error de red: una mutación ya invalidada
      // por una salida global no debe mostrar mensaje de error.
      if (mutationGeneration !== mutationContextGenRef.current) return
      setActionError("No se pudo iniciar la preparación. Revisá la conexión.")
      debeConfirmarEstadoReal = true
    } finally {
      // Si el contexto de mutaciones ya no coincide, esta acción quedó invalidada por una
      // salida global (que ya limpió preparandoRef/preparando por su cuenta): no volver a
      // tocar el Set React, no restaurar pedidoId en la ref y no disparar refresh.
      const sigueVigente = mutationGeneration === mutationContextGenRef.current
      if (sigueVigente) {
        // Liberar SIEMPRE la guardia síncrona y el loading visual de este pedido
        // (éxito, 404, 409, error de red).
        preparandoRef.current.delete(pedidoId)
        setPreparando((prev) => {
          const next = new Set(prev)
          next.delete(pedidoId)
          return next
        })

        // Solo la última mutación pendiente en terminar dispara la confirmación: si otro
        // pedido (p. ej. B) sigue mutando, ese pedido será el responsable del refresh
        // final. Sin esto, el refresh de A podría traer una foto donde B aún figura
        // "recibido".
        if (debeConfirmarEstadoReal && preparandoRef.current.size === 0) {
          void loadPanel({ silent: true })
        }
      }
    }
  }

  const mesasPorZona = useMemo(() => {
    if (state.status !== "ready") return [] as [string, MesaSalon[]][]
    const groups = new Map<string, MesaSalon[]>()
    for (const mesa of state.data.mesas) {
      const key = mesa.zona?.trim() ? mesa.zona : "Salón"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(mesa)
    }
    return Array.from(groups.entries())
  }, [state])

  if (state.status === "loading") {
    return (
      <Shell>
        <div className="space-y-3">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-16 w-full rounded-xl" />
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
            <h1 className="text-base font-bold">Salón no disponible</h1>
            <p className="text-sm text-muted-foreground">
              No tenés acceso operativo a este salón en este momento.
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
            <h1 className="text-base font-bold">No se pudo cargar el salón</h1>
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
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold leading-tight">DeliGO Operaciones</h1>
              <p className="text-sm text-muted-foreground truncate">{negocio.nombre}</p>
            </div>
          </div>
          <Badge className="border-0" style={{ backgroundColor: `${accent}15`, color: accent }}>
            Salón
          </Badge>
        </div>
        <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
          <Link href={nav.homeHref} aria-label="Volver a mi panel">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Mesas activas" value={String(resumen.mesasActivas)} />
        <Metric label="Con pedidos" value={String(resumen.mesasConPedidos)} />
        <Metric label="Pedidos activos" value={String(resumen.pedidosActivos)} />
      </div>

      {/* Error de dominio de la acción (no bloqueante) */}
      {actionError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {actionError}
        </div>
      )}

      {/* Mesas por zona */}
      {mesasPorZona.length === 0 ? (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center bg-muted/30">
              <Armchair className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No hay mesas activas</p>
            <p className="text-xs text-muted-foreground">El salón no tiene mesas activas por ahora.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {mesasPorZona.map(([zona, mesas]) => (
            <div key={zona} className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{zona}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mesas.map((mesa) => (
                  <Card key={mesa.id} className="rounded-xl border-border/60">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-extrabold"
                          style={{ backgroundColor: `${accent}12`, color: accent }}
                        >
                          {mesa.numero}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">Mesa {mesa.numero}</p>
                            {mesa.nombre && (
                              <span className="text-xs text-muted-foreground truncate">{mesa.nombre}</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                            {mesa.mozoAsignado ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <UserCheck className="h-3.5 w-3.5" />
                                {mesa.mozoAsignado.nombre}
                                <span className="text-muted-foreground">({mesa.mozoAsignado.codigo})</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <UserX className="h-3.5 w-3.5" />
                                Sin mozo asignado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {mesa.pedidosActivos.length > 0 ? (
                        <div className="space-y-1">
                          {mesa.pedidosActivos.map((pedido) => (
                            <div
                              key={pedido.id}
                              className="rounded-lg bg-muted/40 px-2.5 py-1.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs font-medium">
                                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                                  {estadoLabel(pedido.estado)}
                                </span>
                                <span className="text-xs font-semibold">{formatMoney(pedido.total)}</span>
                              </div>
                              {pedido.estado === "recibido" && (
                                <Button
                                  size="sm"
                                  className="h-8 w-full gap-1.5 rounded-lg text-xs font-semibold text-white"
                                  style={{ backgroundColor: accent }}
                                  onClick={() => handlePreparar(pedido.id)}
                                  disabled={preparando.has(pedido.id)}
                                >
                                  {preparando.has(pedido.id) ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Iniciando…
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3.5 w-3.5" />
                                      Iniciar preparación
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-2.5 pt-0.5 text-[11px] text-muted-foreground">
                            <span>{mesa.pedidosActivosCount} {mesa.pedidosActivosCount === 1 ? "pedido" : "pedidos"}</span>
                            <span className="font-semibold">{formatMoney(mesa.pedidosActivosTotal)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground px-1">Sin pedidos activos</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}

// ============================================
// Shell y métricas
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
      <p className="text-lg font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
