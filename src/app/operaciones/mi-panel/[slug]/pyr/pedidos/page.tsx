"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, ClipboardList, Info, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"

// ============================================
// DeliGO Operaciones — Panel personal de PyR: pedidos activos (SOLO LECTURA · Operaciones-1O)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal. Usa solo GET /api/operativo/pyr/pedidos/[slug].
// No usa APIs de terminal ni APIs administrativas, no consulta módulos de Mozo o Salón, y
// no llama al endpoint personal de reseñas de PyR. No existe ninguna mutación en esta
// página (sin POST/PATCH/PUT/DELETE, sin formularios de acción). Refresco automático
// estándar (1G.1): 15 s con pestaña visible + focus +
// visibilitychange, sin solapamiento, salida atómica ante pérdida de área/sesión, guardia de
// generación contra respuestas fuera de orden. Al no haber mutaciones no existe barrera
// global de refresh ni mutationContextGenRef: cada refresh silencioso puede aplicarse en
// cuanto llegue en orden.

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

export default function PyRPedidosActivosPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const nav = useOperativoNav()
  const slug = params.slug

  const [state, setState] = useState<PageState>({ status: "loading" })

  // Una sola solicitud activa (abort de la anterior) + guardia de generación contra
  // respuestas fuera de orden.
  const refreshAcRef = useRef<AbortController | null>(null)
  const refreshGenRef = useRef(0)

  const invalidatePanelRefresh = useCallback(() => {
    refreshGenRef.current += 1
    refreshAcRef.current?.abort()
    refreshAcRef.current = null
  }, [])

  // Salida atómica: invalidar refresh y limpiar/ocultar datos ANTES de navegar; solo
  // skeleton en tránsito.
  const redirectToPersonalHomeAfterAreaLoss = useCallback(() => {
    invalidatePanelRefresh()
    setState({ status: "loading" })
    router.replace(nav.homeHref)
  }, [invalidatePanelRefresh, router, nav.homeHref])

  const redirectToLoginAfterSessionLoss = useCallback(() => {
    invalidatePanelRefresh()
    setState({ status: "loading" })
    router.replace(nav.loginHref)
  }, [invalidatePanelRefresh, router, nav.loginHref])

  const loadPedidos = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

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
        // Negocio/vínculo no disponible: estado seguro (sin redirigir como cambio de área),
        // sin redirección automática. Invalidar refresh: descarta la request actual y
        // cualquier respuesta vieja en vuelo antes de ocultar los datos.
        if (res.status === 403 || data.estado === "acceso_no_disponible") {
          invalidatePanelRefresh()
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
      // No setState aquí (desmontaje): solo invalidar refresh para que una respuesta tardía
      // no escriba en un componente desmontado.
      invalidatePanelRefresh()
    }
  }, [loadPedidos, invalidatePanelRefresh])

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
          Esta vista es solo informativa. Todavía no podés modificar pedidos desde acá.
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
