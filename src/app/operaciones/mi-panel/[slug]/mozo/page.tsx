"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  Loader2,
  PackageCheck,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"

// ============================================
// DeliGO Operaciones — Panel personal de Mozo: pedidos listos (1L.1 + 1M)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal. Usa solo GET
// /api/operativo/mozo/pedidos-listos/[slug] (ruta aislada, distinta del endpoint legacy
// /api/operativo/mozo/panel/[slug], que no se toca ni se llama desde aquí) y POST
// /api/operativo/mozo/pedidos/[id]/entregar. No llama /api/operaciones/** ni
// /api/negocio/** ni /api/operativo/salon/**. Existe UNA sola acción de mutación, fija:
// listo_para_retirar → entregado (por pedido). Refresco automático estándar (1G.1): 15 s
// con pestaña visible + focus + visibilitychange, sin solapamiento, salida atómica ante
// pérdida de área/sesión, guardia de generación contra respuestas fuera de orden. Mismas
// protecciones de concurrencia validadas en el panel personal de Salón: guardia síncrona
// por pedido, barrera global de refresh, mutationContextGenRef para descartar respuestas
// tardías tras una salida global.

const MOZO_REFRESH_INTERVAL_MS = 15000

interface MesaPedidoListo {
  id: string
  numero: number
  nombre: string
  zona: string
}

interface PedidoListo {
  id: string
  estado: string
  total: number
  mesa: MesaPedidoListo
}

interface MozoData {
  negocio: { nombre: string; slug: string; colorPrincipal: string }
  resumen: { pedidosListos: number; mesasConPedidosListos: number }
  pedidos: PedidoListo[]
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: MozoData }
  | { status: "unavailable" }
  | { status: "error" }

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-AR")}`
}

export default function MozoPedidosListosPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const nav = useOperativoNav()
  const slug = params.slug

  const [state, setState] = useState<PageState>({ status: "loading" })
  // Pedidos con "Marcar entregado" en curso. `entregando` (estado React) SOLO renderiza
  // (spinner + disabled). `entregandoRef` es la fuente SÍNCRONA de verdad: (1) guardia por
  // pedido contra doble click (dos clicks en el mismo tick llegan antes del re-render); (2)
  // barrera GLOBAL de refresh — mientras su tamaño sea > 0 existe al menos una entrega en
  // curso y ningún refresh puede iniciar ni aplicar datos. Pedidos distintos pueden
  // entregarse en paralelo sin bloquearse entre sí.
  const entregandoRef = useRef<Set<string>>(new Set())
  const [entregando, setEntregando] = useState<Set<string>>(() => new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  // Una sola solicitud activa (abort de la anterior) + guardia de generación contra
  // respuestas fuera de orden. refreshGenRef invalida respuestas de GET/polling; no
  // protege respuestas de POST /entregar en vuelo (ver mutationContextGenRef, más abajo).
  const refreshAcRef = useRef<AbortController | null>(null)
  const refreshGenRef = useRef(0)

  // Generación del contexto de MUTACIONES (POST /entregar), independiente de refreshGenRef.
  // Se incrementa EXCLUSIVAMENTE cuando una salida global (pérdida de área, sesión o
  // disponibilidad) invalida todas las entregas que sigan en vuelo — nunca al iniciar una
  // acción individual, por lo que pedidos distintos comparten generación sin bloquearse.
  const mutationContextGenRef = useRef(0)

  const invalidatePanelRefresh = useCallback(() => {
    refreshGenRef.current += 1
    refreshAcRef.current?.abort()
    refreshAcRef.current = null
  }, [])

  // Invalida el contexto de mutaciones: toda respuesta POST /entregar cuya generación
  // capturada ya no coincida se descarta por completo (ver handleEntregar). No navega, no
  // cambia PageState, no inicia fetch y no toca refreshAcRef/refreshGenRef.
  const invalidateMutationContext = useCallback(() => {
    mutationContextGenRef.current += 1
    entregandoRef.current.clear()
  }, [])

  // Salida atómica: invalidar refresh y contexto de mutaciones, limpiar/ocultar datos
  // ANTES de navegar; solo skeleton en tránsito, sin botones ni estados de acción visibles.
  const redirectToPersonalHomeAfterAreaLoss = useCallback(() => {
    invalidatePanelRefresh()
    invalidateMutationContext()
    setEntregando(new Set())
    setActionError(null)
    setState({ status: "loading" })
    router.replace(nav.homeHref)
  }, [invalidatePanelRefresh, invalidateMutationContext, router, nav.homeHref])

  const redirectToLoginAfterSessionLoss = useCallback(() => {
    invalidatePanelRefresh()
    invalidateMutationContext()
    setEntregando(new Set())
    setActionError(null)
    setState({ status: "loading" })
    router.replace(nav.loginHref)
  }, [invalidatePanelRefresh, invalidateMutationContext, router, nav.loginHref])

  const loadPanel = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      // Barrera global: mientras haya al menos una entrega en curso (pedido A y B en
      // paralelo, por ejemplo), ningún refresh puede comenzar ni aplicar datos — ni
      // interval, ni focus/visibilitychange, ni botón manual. Sin abortar nada, sin subir
      // generación, sin cambiar PageState, sin AbortController, sin fetch: solo se retorna.
      if (entregandoRef.current.size > 0) return
      // Sin solapamiento: un refresco silencioso no se inicia si ya hay una activa.
      if (silent && refreshAcRef.current) return
      refreshAcRef.current?.abort()
      const ac = new AbortController()
      refreshAcRef.current = ac
      const generation = ++refreshGenRef.current

      if (!silent) setState({ status: "loading" })

      try {
        const res = await fetch(`/api/operativo/mozo/pedidos-listos/${encodeURIComponent(slug)}`, {
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
        // Negocio/vínculo no disponible: estado seguro (sin redirigir como cambio de área).
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
              pedidosListos: data.resumen?.pedidosListos ?? 0,
              mesasConPedidosListos: data.resumen?.mesasConPedidosListos ?? 0,
            },
            pedidos: Array.isArray(data.pedidos) ? data.pedidos : [],
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
    const interval = window.setInterval(silentRefresh, MOZO_REFRESH_INTERVAL_MS)
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
      // No setState aquí (desmontaje): solo invalidar refresh y entregas en vuelo para que
      // un POST que responda después de salir de la página no escriba en un componente
      // desmontado.
      invalidatePanelRefresh()
      invalidateMutationContext()
    }
  }, [loadPanel, invalidatePanelRefresh, invalidateMutationContext])

  // Acción única (Operaciones-1M): listo_para_retirar → entregado. Solo /api/operativo/**.
  const handleEntregar = async (pedidoId: string) => {
    // Guardia SÍNCRONA por pedido: la ref se consulta y marca antes de cualquier await,
    // por lo que un segundo click sobre el mismo pedido (aun antes de un re-render) no
    // genera otro POST. Otros pedidos no quedan bloqueados.
    if (entregandoRef.current.has(pedidoId)) return
    entregandoRef.current.add(pedidoId)
    setEntregando((prev) => new Set(prev).add(pedidoId))
    setActionError(null)

    // Invalidar el polling: cualquier respuesta iniciada antes de la mutación queda
    // obsoleta por generación y no puede pisar el resultado local aunque llegue tarde.
    invalidatePanelRefresh()

    // Generación del contexto de mutaciones capturada ANTES de cualquier await. Si una
    // salida global (área/sesión/disponibilidad) invalida el contexto mientras este POST
    // sigue en vuelo, la respuesta tardía de ESTA acción se descarta por completo más
    // abajo, sin escribir nada en la UI.
    const mutationGeneration = mutationContextGenRef.current

    // Solo se confirma con el servidor tras éxito, 404, 409 o error de red/dominio no
    // crítico. Permanece en false ante area_no_habilitada, sin_sesion/401 o
    // acceso_no_disponible/403 (esos casos no deben disparar refresh posterior).
    let debeConfirmarEstadoReal = false

    try {
      const res = await fetch(
        `/api/operativo/mozo/pedidos/${encodeURIComponent(pedidoId)}/entregar?slug=${encodeURIComponent(slug)}`,
        { method: "POST", cache: "no-store" }
      )
      const data = await res.json().catch(() => ({}))

      // Respuesta tardía: una salida global (de esta acción o de otra entrega paralela)
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
      // Negocio/vínculo no disponible durante la acción: estado seguro INMEDIATO, sin
      // redirigir al home y sin refresh posterior.
      if (res.status === 403 || data.estado === "acceso_no_disponible") {
        invalidatePanelRefresh()
        invalidateMutationContext()
        setEntregando(new Set())
        setActionError(null)
        setState({ status: "unavailable" })
        return
      }

      if (res.ok && data.ok) {
        // Actualización local: quitar solo ese pedido y recalcular el resumen a partir de
        // los pedidos restantes. No se inventan datos ni se tocan totales de otros pedidos.
        setState((current) => {
          if (current.status !== "ready") return current
          const pedidos = current.data.pedidos.filter((pedido) => pedido.id !== pedidoId)
          const mesasConPedidosListos = new Set(pedidos.map((pedido) => pedido.mesa.id)).size
          return {
            status: "ready",
            data: {
              ...current.data,
              pedidos,
              resumen: { pedidosListos: pedidos.length, mesasConPedidosListos },
            },
          }
        })
        debeConfirmarEstadoReal = true
      } else {
        // 404 / 409 / error de dominio: mensaje local, no técnico, sin redirigir.
        setActionError(
          res.status === 404
            ? "Ese pedido ya no está disponible."
            : res.status === 409
              ? "El pedido ya fue entregado o cambió de estado."
              : data.error || "No se pudo marcar como entregado."
        )
        debeConfirmarEstadoReal = true
      }
    } catch {
      // Misma comprobación de generación para el error de red: una mutación ya invalidada
      // por una salida global no debe mostrar mensaje de error.
      if (mutationGeneration !== mutationContextGenRef.current) return
      setActionError("No se pudo marcar como entregado. Revisá la conexión.")
      debeConfirmarEstadoReal = true
    } finally {
      // Si el contexto de mutaciones ya no coincide, esta acción quedó invalidada por una
      // salida global (que ya limpió entregandoRef/entregando por su cuenta): no volver a
      // tocar el estado React, no restaurar pedidoId en la ref y no disparar refresh.
      const sigueVigente = mutationGeneration === mutationContextGenRef.current
      if (sigueVigente) {
        // Liberar SIEMPRE la guardia síncrona y el loading visual de este pedido
        // (éxito, 404, 409, error de red).
        entregandoRef.current.delete(pedidoId)
        setEntregando((prev) => {
          const next = new Set(prev)
          next.delete(pedidoId)
          return next
        })

        // Solo la última entrega pendiente en terminar dispara la confirmación: si otro
        // pedido sigue entregándose, ese pedido será el responsable del refresh final.
        if (debeConfirmarEstadoReal && entregandoRef.current.size === 0) {
          void loadPanel({ silent: true })
        }
      }
    }
  }

  const pedidosPorZona = useMemo(() => {
    if (state.status !== "ready") return [] as [string, PedidoListo[]][]
    const groups = new Map<string, PedidoListo[]>()
    for (const pedido of state.data.pedidos) {
      const key = pedido.mesa.zona?.trim() ? pedido.mesa.zona : "Salón"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(pedido)
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
            <h1 className="text-base font-bold">Mozo no disponible</h1>
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
            <h1 className="text-base font-bold">No se pudieron cargar tus pedidos</h1>
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
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold leading-tight">DeliGO Operaciones</h1>
              <p className="text-sm text-muted-foreground truncate">{negocio.nombre}</p>
            </div>
          </div>
          <Badge className="border-0" style={{ backgroundColor: `${accent}15`, color: accent }}>
            Mozo
          </Badge>
        </div>
        <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
          <Link href={nav.homeHref} aria-label="Volver a mi panel">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Pedidos listos" value={String(resumen.pedidosListos)} />
        <Metric label="Mesas involucradas" value={String(resumen.mesasConPedidosListos)} />
      </div>

      {/* Error de dominio de la acción (no bloqueante) */}
      {actionError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {actionError}
        </div>
      )}

      {/* Pedidos por zona */}
      {pedidosPorZona.length === 0 ? (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center bg-muted/30">
              <ClipboardCheck className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              No tenés pedidos listos para retirar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {pedidosPorZona.map(([zona, pedidos]) => (
            <div key={zona} className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{zona}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pedidos.map((pedido) => (
                  <Card key={pedido.id} className="rounded-xl border-border/60">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-extrabold"
                          style={{ backgroundColor: `${accent}12`, color: accent }}
                        >
                          {pedido.mesa.numero}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">Mesa {pedido.mesa.numero}</p>
                          {pedido.mesa.nombre && (
                            <p className="text-xs text-muted-foreground truncate">{pedido.mesa.nombre}</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <ClipboardList className="h-3.5 w-3.5" />
                          Listo para retirar
                        </span>
                        <span className="text-xs font-semibold">{formatMoney(pedido.total)}</span>
                      </div>
                      <Button
                        size="sm"
                        className="h-8 w-full gap-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: accent }}
                        onClick={() => handleEntregar(pedido.id)}
                        disabled={entregando.has(pedido.id)}
                      >
                        {entregando.has(pedido.id) ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Entregando…
                          </>
                        ) : (
                          <>
                            <PackageCheck className="h-3.5 w-3.5" />
                            Marcar entregado
                          </>
                        )}
                      </Button>
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
