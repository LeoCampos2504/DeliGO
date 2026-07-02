"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"

// ============================================
// DeliGO Operaciones — Panel personal de PyR: pedidos activos (Operaciones-1O + 1P.1 + 1Q)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal. Usa solo GET /api/operativo/pyr/pedidos/[slug],
// POST /api/operativo/pyr/pedidos/[id]/preparar y POST
// /api/operativo/pyr/pedidos/[id]/listo-para-retiro. No usa APIs de terminal ni APIs
// administrativas, no consulta módulos de Mozo o Salón, y no llama al endpoint personal de
// reseñas de PyR. Existen DOS acciones de mutación fijas: recibido → preparando (cualquier
// no-mesa) y, exclusivamente para retiro, preparando → listo_para_retirar (por pedido).
// Refresco automático estándar (1G.1): 15 s con pestaña visible + focus + visibilitychange,
// sin solapamiento, salida atómica ante pérdida de área/sesión, guardia de generación contra
// respuestas fuera de orden. Mismas protecciones de concurrencia validadas en los paneles
// personales de Salón y Mozo: guardia síncrona compartida por pedido (ambas acciones usan la
// MISMA barrera — un pedido no puede tener dos acciones en vuelo a la vez), barrera global de
// refresh, mutationContextGenRef para descartar respuestas tardías tras una salida global.
// Sin actualización optimista: el estado final siempre se vuelve a consultar desde el
// servidor tras la mutación.

const PEDIDOS_REFRESH_INTERVAL_MS = 15000

interface PedidoActivo {
  id: string
  estado: string
  metodoEntrega: string
  fecha: string
  clienteNombre: string | null
  total: number
}

interface PedidosData {
  negocio: { nombre: string; slug: string; colorPrincipal: string }
  resumen: { totalActivos: number }
  pedidos: PedidoActivo[]
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: PedidosData }
  | { status: "unavailable" }
  | { status: "error" }

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-AR")}`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const ESTADO_LABELS: Record<string, string> = {
  recibido: "Recibido",
  preparando: "Preparando",
  en_camino: "En camino",
  listo_para_retirar: "Listo para retirar",
}

const METODO_LABELS: Record<string, string> = {
  domicilio: "Domicilio",
  retiro: "Retiro",
}

// Únicas dos acciones personales de PyR (Operaciones-1P.1 + 1Q). El endpoint y el mensaje de
// error genérico se seleccionan SOLO desde este mapa literal y tipado — no se construye una
// API genérica de estados ni se acepta "action"/"estado" desde el cliente (URL, input, query,
// localStorage o props externas). El servidor sigue siendo la fuente final de autorización y
// transición (CAS por estado esperado en cada endpoint).
type PedidoAction = "preparar" | "listo_para_retiro"

const ACTION_CONFIG: Record<
  PedidoAction,
  { endpointSegment: "preparar" | "listo-para-retiro"; errorGenerico: string; labelEnCurso: string }
> = {
  preparar: {
    endpointSegment: "preparar",
    errorGenerico: "No se pudo iniciar la preparación.",
    labelEnCurso: "Iniciando…",
  },
  listo_para_retiro: {
    endpointSegment: "listo-para-retiro",
    errorGenerico: "No se pudo marcar el pedido listo para retirar.",
    labelEnCurso: "Marcando listo…",
  },
}

export default function PyRPedidosActivosPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const nav = useOperativoNav()
  const slug = params.slug

  const [state, setState] = useState<PageState>({ status: "loading" })

  // Pedidos con una acción personal ("preparar" o "listo_para_retiro") en curso.
  // `mutatingPedidoIds` (estado React) SOLO renderiza (spinner + disabled).
  // `mutatingPedidoIdsRef` es la fuente SÍNCRONA de verdad, COMPARTIDA por ambas acciones:
  // (1) guardia por pedido contra doble click y contra que coexistan dos acciones distintas
  // para el MISMO pedido (dos clicks en el mismo tick llegan antes del re-render); (2)
  // barrera GLOBAL de refresh — mientras su tamaño sea > 0 existe al menos una mutación de
  // PyR en curso (de cualquier tipo, sobre cualquier pedido) y ningún refresh puede iniciar
  // ni aplicar datos. Pedidos DISTINTOS pueden mutar en paralelo sin bloquearse entre sí.
  const mutatingPedidoIdsRef = useRef<Set<string>>(new Set())
  const [mutatingPedidoIds, setMutatingPedidoIds] = useState<Set<string>>(() => new Set())
  // Mensaje de error por pedido (no técnico, liberado junto con su propia mutación).
  const [pedidoErrors, setPedidoErrors] = useState<Record<string, string>>({})

  // Una sola solicitud activa (abort de la anterior) + guardia de generación contra
  // respuestas fuera de orden. refreshGenRef invalida respuestas de GET/polling; no
  // protege respuestas de POST en vuelo (ver mutationContextGenRef, más abajo).
  const refreshAcRef = useRef<AbortController | null>(null)
  const refreshGenRef = useRef(0)

  // Generación del contexto de MUTACIONES (POST /preparar o /listo-para-retiro),
  // independiente de refreshGenRef. Se incrementa EXCLUSIVAMENTE cuando una salida global
  // (pérdida de área, sesión o disponibilidad) invalida todas las mutaciones que sigan en
  // vuelo — nunca al iniciar una acción individual, por lo que pedidos distintos comparten
  // generación sin bloquearse.
  const mutationContextGenRef = useRef(0)

  const invalidatePanelRefresh = useCallback(() => {
    refreshGenRef.current += 1
    refreshAcRef.current?.abort()
    refreshAcRef.current = null
  }, [])

  // Invalida el contexto de mutaciones: toda respuesta POST (preparar o listo-para-retiro)
  // cuya generación capturada ya no coincida se descarta por completo (ver
  // handlePedidoAction). No navega, no cambia PageState, no inicia fetch y no toca
  // refreshAcRef/refreshGenRef.
  const invalidateMutationContext = useCallback(() => {
    mutationContextGenRef.current += 1
    mutatingPedidoIdsRef.current.clear()
  }, [])

  // Salida atómica: invalidar refresh y contexto de mutaciones, limpiar/ocultar datos ANTES
  // de navegar; solo skeleton en tránsito, sin botones ni estados de acción visibles.
  const redirectToPersonalHomeAfterAreaLoss = useCallback(() => {
    invalidatePanelRefresh()
    invalidateMutationContext()
    setMutatingPedidoIds(new Set())
    setPedidoErrors({})
    setState({ status: "loading" })
    router.replace(nav.homeHref)
  }, [invalidatePanelRefresh, invalidateMutationContext, router, nav.homeHref])

  const redirectToLoginAfterSessionLoss = useCallback(() => {
    invalidatePanelRefresh()
    invalidateMutationContext()
    setMutatingPedidoIds(new Set())
    setPedidoErrors({})
    setState({ status: "loading" })
    router.replace(nav.loginHref)
  }, [invalidatePanelRefresh, invalidateMutationContext, router, nav.loginHref])

  const loadPedidos = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      // Barrera global: mientras haya al menos una mutación de PyR en curso (pedido A y B en
      // paralelo, cualquier combinación de "preparar"/"listo_para_retiro"), ningún refresh
      // puede comenzar ni aplicar datos — ni interval, ni focus/visibilitychange, ni botón
      // manual. Sin abortar nada, sin subir generación, sin cambiar PageState, sin
      // AbortController, sin fetch: solo se retorna.
      if (mutatingPedidoIdsRef.current.size > 0) return
      // Sin solapamiento: un refresco silencioso no se inicia si ya hay una activa.
      if (silent && refreshAcRef.current) return
      refreshAcRef.current?.abort()
      const ac = new AbortController()
      refreshAcRef.current = ac
      const generation = ++refreshGenRef.current

      if (!silent) setState({ status: "loading" })

      try {
        const res = await fetch(`/api/operativo/pyr/pedidos/${encodeURIComponent(slug)}`, {
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
        // Salida atómica: invalidar refresh/mutaciones y limpiar spinners/errores ANTES de
        // mostrar el estado seguro (mismo patrón ya usado dentro del POST).
        if (res.status === 403 || data.estado === "acceso_no_disponible") {
          invalidatePanelRefresh()
          invalidateMutationContext()
          setMutatingPedidoIds(new Set())
          setPedidoErrors({})
          setState({ status: "unavailable" })
          return
        }
        if (!res.ok || !data.ok) {
          // Error de red/dominio: conservar datos visibles durante refresh silencioso; solo
          // mostrar pantalla de error en carga inicial o reintento manual.
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
              totalActivos:
                typeof data.resumen?.totalActivos === "number" ? data.resumen.totalActivos : 0,
            },
            pedidos: Array.isArray(data.pedidos) ? data.pedidos : [],
          },
        })
      } catch {
        // Abort/respuesta superada: no tocar estado. Error de red en silencioso: conservar
        // los datos visibles; en carga inicial/manual mostrar error.
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
    loadPedidos()
  }, [loadPedidos])

  // Refresco automático silencioso: 15 s (solo pestaña visible) + focus + visibility.
  useEffect(() => {
    const silentRefresh = () => {
      if (document.visibilityState === "visible") void loadPedidos({ silent: true })
    }
    const interval = window.setInterval(silentRefresh, PEDIDOS_REFRESH_INTERVAL_MS)
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
  }, [loadPedidos, invalidatePanelRefresh, invalidateMutationContext])

  // Handler interno único y tipado (Operaciones-1P.1 + 1Q). Las únicas acciones permitidas
  // en el cliente son "preparar" y "listo_para_retiro" (PedidoAction); el endpoint y los
  // mensajes se leen SOLO de ACTION_CONFIG, nunca se envían action/estado en el body ni se
  // aceptan desde URL/input/query. Solo /api/operativo/**.
  const handlePedidoAction = async (pedidoId: string, action: PedidoAction) => {
    // Guardia SÍNCRONA por pedido: la ref se consulta y marca antes de cualquier await, por
    // lo que un segundo click (mismo pedido, misma o distinta acción) aun antes de un
    // re-render no genera otro POST. Otros pedidos no quedan bloqueados.
    if (mutatingPedidoIdsRef.current.has(pedidoId)) return

    mutatingPedidoIdsRef.current.add(pedidoId)
    setMutatingPedidoIds((prev) => new Set(prev).add(pedidoId))
    setPedidoErrors((prev) => {
      if (!(pedidoId in prev)) return prev
      const next = { ...prev }
      delete next[pedidoId]
      return next
    })

    // Invalidar el polling: cualquier respuesta iniciada antes de la mutación queda
    // obsoleta por generación y no puede pisar el resultado local aunque llegue tarde.
    invalidatePanelRefresh()

    // Generación del contexto de mutaciones capturada ANTES de cualquier await. Si una
    // salida global (área/sesión/disponibilidad) invalida el contexto mientras este POST
    // sigue en vuelo (por ejemplo, disparada por otro pedido en paralelo), la respuesta
    // tardía de ESTA acción se descarta por completo más abajo, sin escribir nada en la UI.
    const mutationGeneration = mutationContextGenRef.current
    const config = ACTION_CONFIG[action]

    // Solo se confirma con el servidor tras éxito, 409, 429 o error de red/dominio no
    // crítico. Permanece en false ante area_no_habilitada, sin_sesion/401 o
    // acceso_no_disponible/403 (esos casos no deben disparar refresh posterior).
    let debeConfirmarEstadoReal = false

    try {
      const res = await fetch(
        `/api/operativo/pyr/pedidos/${encodeURIComponent(pedidoId)}/${config.endpointSegment}?slug=${encodeURIComponent(slug)}`,
        { method: "POST", cache: "no-store" }
      )
      const data = await res.json().catch(() => ({}))

      // Respuesta tardía: una salida global (de esta acción o de otra mutación paralela) ya
      // invalidó el contexto de mutaciones mientras este POST estaba en vuelo. No debe
      // actualizar pedidos, mostrar errores, alterar loading, navegar ni disparar refresh.
      if (mutationGeneration !== mutationContextGenRef.current) return

      // Cambio de área / sesión durante la acción: salida atómica (sin mostrar error, sin
      // refresh posterior).
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
        setMutatingPedidoIds(new Set())
        setPedidoErrors({})
        setState({ status: "unavailable" })
        return
      }

      if (res.ok && data.ok) {
        // Sin actualización optimista: no se inventa estado ni fecha. El pedido pasa al
        // estado nuevo recién cuando el refresh final lo confirme desde el servidor.
        debeConfirmarEstadoReal = true
      } else {
        // 409 / 429 / error de dominio: mensaje local, no técnico, sin redirigir.
        const mensaje =
          res.status === 429 ? "Demasiados intentos. Esperá un momento." : data.error || config.errorGenerico
        setPedidoErrors((prev) => ({ ...prev, [pedidoId]: mensaje }))
        debeConfirmarEstadoReal = true
      }
    } catch {
      // Misma comprobación de generación para el error de red: una mutación ya invalidada
      // por una salida global no debe mostrar mensaje de error.
      if (mutationGeneration !== mutationContextGenRef.current) return
      setPedidoErrors((prev) => ({
        ...prev,
        [pedidoId]: `${config.errorGenerico} Revisá la conexión.`,
      }))
      debeConfirmarEstadoReal = true
    } finally {
      // Si el contexto de mutaciones ya no coincide, esta acción quedó invalidada por una
      // salida global (que ya limpió mutatingPedidoIdsRef/mutatingPedidoIds por su cuenta):
      // no volver a tocar el estado React, no restaurar pedidoId en la ref y no disparar
      // refresh.
      const sigueVigente = mutationGeneration === mutationContextGenRef.current
      if (sigueVigente) {
        // Liberar SIEMPRE la guardia síncrona y el loading visual de este pedido (éxito,
        // 409, 429, error de red).
        mutatingPedidoIdsRef.current.delete(pedidoId)
        setMutatingPedidoIds((prev) => {
          const next = new Set(prev)
          next.delete(pedidoId)
          return next
        })

        // Solo la última mutación pendiente en terminar dispara la confirmación: si otro
        // pedido (p. ej. B) sigue mutando, ese pedido será el responsable del refresh
        // final. Sin esto, el refresh de A podría traer una foto donde B aún figura en un
        // estado anterior.
        if (debeConfirmarEstadoReal && mutatingPedidoIdsRef.current.size === 0) {
          void loadPedidos({ silent: true })
        }
      }
    }
  }

  const handleComenzarPreparacion = (pedidoId: string) => handlePedidoAction(pedidoId, "preparar")
  const handleMarcarListoParaRetiro = (pedidoId: string) =>
    handlePedidoAction(pedidoId, "listo_para_retiro")

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
            <h1 className="text-base font-bold">No se pudieron cargar los pedidos</h1>
            <p className="text-sm text-muted-foreground">Revisá la conexión e intentá de nuevo.</p>
          </div>
          <Button className="rounded-xl w-full gap-2 font-semibold" onClick={() => loadPedidos()}>
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

  const { negocio, resumen, pedidos } = state.data
  const accent = negocio.colorPrincipal
  const pyrHref = `${nav.homeHref}/${encodeURIComponent(slug)}/pyr`

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
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold leading-tight">Pedidos activos</h1>
              <p className="text-sm text-muted-foreground truncate">{negocio.nombre}</p>
            </div>
          </div>
          <Badge className="border-0" style={{ backgroundColor: `${accent}15`, color: accent }}>
            Pedidos y reseñas
          </Badge>
        </div>
        <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
          <Link href={pyrHref} aria-label="Volver al panel de reseñas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Aviso de vista informativa */}
      <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Podés iniciar la preparación de pedidos recibidos y marcar listos para retirar los
          pedidos de retiro en preparación. Las demás acciones todavía no están disponibles
          desde acá.
        </p>
      </div>

      {/* Resumen */}
      <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
        <p className="text-lg font-extrabold leading-none">{resumen.totalActivos}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {resumen.totalActivos === 1 ? "pedido activo" : "pedidos activos"}
        </p>
      </div>

      {/* Listado */}
      {pedidos.length === 0 ? (
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center bg-muted/30">
              <ClipboardList className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              No hay pedidos activos para mostrar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {pedidos.map((pedido) => (
            <Card key={pedido.id} className="rounded-xl border-border/60">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge
                    className="text-[10px] h-5 px-1.5 border-0"
                    style={{ backgroundColor: `${accent}15`, color: accent }}
                  >
                    {ESTADO_LABELS[pedido.estado] ?? pedido.estado}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(pedido.fecha)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {METODO_LABELS[pedido.metodoEntrega] ?? pedido.metodoEntrega}
                </p>
                {pedido.clienteNombre && (
                  <p className="text-sm font-semibold truncate">{pedido.clienteNombre}</p>
                )}
                <p className="text-sm font-semibold">{formatMoney(pedido.total)}</p>

                {pedidoErrors[pedido.id] && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                    {pedidoErrors[pedido.id]}
                  </div>
                )}

                {pedido.estado === "recibido" && (
                  <Button
                    size="sm"
                    className="h-8 w-full gap-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                    onClick={() => handleComenzarPreparacion(pedido.id)}
                    disabled={mutatingPedidoIds.has(pedido.id)}
                  >
                    {mutatingPedidoIds.has(pedido.id) ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {ACTION_CONFIG.preparar.labelEnCurso}
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Comenzar preparación
                      </>
                    )}
                  </Button>
                )}

                {pedido.metodoEntrega === "retiro" && pedido.estado === "preparando" && (
                  <Button
                    size="sm"
                    className="h-8 w-full gap-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                    onClick={() => handleMarcarListoParaRetiro(pedido.id)}
                    disabled={mutatingPedidoIds.has(pedido.id)}
                  >
                    {mutatingPedidoIds.has(pedido.id) ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {ACTION_CONFIG.listo_para_retiro.labelEnCurso}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Marcar listo para retirar
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  )
}

// ============================================
// Shell
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
