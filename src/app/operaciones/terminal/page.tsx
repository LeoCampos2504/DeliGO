"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Monitor,
  UtensilsCrossed,
  ClipboardList,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  WifiOff,
  ChevronRight,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"

// ============================================
// DeliGO Operaciones — Modo terminal (Operaciones-1B)
// ============================================
// Reglas de aislamiento:
//   - Usa EXCLUSIVAMENTE el contexto de terminal: GET /api/operaciones/terminal/contexto
//     (cookie deligo_operaciones_terminal). No consulta /api/operativo/me ni datos
//     personales del empleado.
//   - Si no hay terminal válida (401: ausente/vencida/revocada — la API ya limpia la
//     cookie), se redirige al flujo de activación existente (/operaciones/activar).
//   - Ante error temporal se conserva el último contexto y se permite reintentar.
// No se crea sesión nueva ni se modifica el flujo de activación.

// Etiquetas legibles (presentación). La fuente de verdad es el contexto seguro del backend.
const AREA_LABELS: Record<string, string> = {
  salon: "Salón",
  pyr: "Pedidos y reseñas",
}

const AREA_DESCRIPTIONS: Record<string, string> = {
  salon: "Mesas y pedidos del salón.",
  pyr: "Pedidos de delivery, reseñas y mensajes.",
}

const AREA_BASE_SCOPE: Record<string, string> = {
  salon: "salon.ver",
  pyr: "pyr.ver",
}

const AREA_ORDER = ["salon", "pyr"] as const

const PROFILE_LABELS: Record<string, string> = {
  pantalla: "Pantalla",
  cocina: "Cocina",
  salon_completo: "Salón completo",
  pyr_completo: "Pedidos y reseñas",
  personalizado: "Personalizado",
}

const REFRESH_MS = 5000

interface TerminalContext {
  nombre: string
  estado: string
  perfil: string
  areas: string[]
  scopes: string[]
}

interface NegocioContext {
  nombre: string
  colorPrincipal: string
}

type PageState =
  | { status: "loading" }
  | { status: "redirecting" }
  | { status: "error" }
  | { status: "ready"; terminal: TerminalContext; negocio: NegocioContext; stale: boolean }

export default function OperacionesTerminalPage() {
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: "loading" })

  const stoppedRef = useRef(false)
  const acRef = useRef<AbortController | null>(null)
  const genRef = useRef(0)

  const applyTransientError = useCallback(() => {
    // Error temporal: conservar el último contexto válido; nunca convertir en no-vinculada.
    setState((prev) => (prev.status === "ready" ? { ...prev, stale: true } : { status: "error" }))
  }, [])

  const refresh = useCallback(async () => {
    if (stoppedRef.current) return
    acRef.current?.abort()
    const ac = new AbortController()
    acRef.current = ac
    const gen = ++genRef.current

    try {
      const res = await fetch("/api/operaciones/terminal/contexto", { cache: "no-store", signal: ac.signal })
      if (gen !== genRef.current) return

      if (res.status === 401) {
        // Sin terminal válida (ausente/vencida/revocada; la API ya limpió la cookie).
        // Se deriva al flujo de activación existente. Sin más polling.
        stoppedRef.current = true
        setState({ status: "redirecting" })
        router.replace("/operaciones/activar")
        return
      }
      if (!res.ok) {
        applyTransientError()
        return
      }

      const data = await res.json().catch(() => null)
      if (gen !== genRef.current) return
      if (!data || !data.ok || !data.terminal || !data.negocio) {
        applyTransientError()
        return
      }

      setState({
        status: "ready",
        terminal: {
          nombre: data.terminal.nombre,
          estado: data.terminal.estado,
          perfil: data.terminal.perfil,
          areas: Array.isArray(data.terminal.areas) ? data.terminal.areas : [],
          scopes: Array.isArray(data.terminal.scopes) ? data.terminal.scopes : [],
        },
        negocio: {
          nombre: data.negocio.nombre,
          colorPrincipal: data.negocio.colorPrincipal || "#FB8C00",
        },
        stale: false,
      })
    } catch {
      if (ac.signal.aborted) return
      if (gen !== genRef.current) return
      applyTransientError()
    }
  }, [applyTransientError, router])

  // Refresco controlado: inmediato + cada 5s con pestaña visible + foco/visibilidad.
  useEffect(() => {
    void refresh()

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, REFRESH_MS)

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const onFocus = () => void refresh()

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      acRef.current?.abort()
    }
  }, [refresh])

  if (state.status === "loading" || state.status === "redirecting") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {state.status === "redirecting" ? "Redirigiendo a activación…" : "Cargando terminal…"}
          </p>
        </div>
      </Shell>
    )
  }

  if (state.status === "error") {
    return (
      <Shell>
        <div className="text-center space-y-4 py-4">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-muted text-muted-foreground">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold">No se pudo cargar la terminal</h1>
            <p className="text-sm text-muted-foreground">Revisá la conexión e intentá de nuevo.</p>
          </div>
          <Button className="rounded-xl w-full gap-2 font-semibold" onClick={() => refresh()}>
            <Loader2 className="h-4 w-4" />
            Reintentar
          </Button>
          <Button asChild variant="ghost" className="rounded-xl w-full gap-2 text-muted-foreground">
            <Link href="/operaciones">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </Shell>
    )
  }

  // ── Terminal válida ──
  const { terminal, negocio, stale } = state
  const accent = negocio.colorPrincipal

  // Un área está disponible solo si está en terminal.areas y tiene su scope base de lectura.
  const availableAreas = AREA_ORDER.filter(
    (area) => terminal.areas.includes(area) && terminal.scopes.includes(AREA_BASE_SCOPE[area])
  )

  return (
    <Shell wide={availableAreas.length > 1}>
      {/* Identidad */}
      <div className="space-y-3">
        <Logo size="sm" />
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}15`, color: accent }}
          >
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-tight">DeliGO Operaciones</h1>
            <p className="text-sm text-muted-foreground truncate">{negocio.nombre}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="gap-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Terminal activa
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            {PROFILE_LABELS[terminal.perfil] ?? terminal.perfil}
          </Badge>
          {stale && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <WifiOff className="h-3 w-3" />
              Sin actualizar
            </span>
          )}
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">Terminal:</span>{" "}
          <span className="font-semibold">{terminal.nombre}</span>
        </p>
      </div>

      {/* Áreas */}
      {availableAreas.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-center space-y-2">
          <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center bg-muted text-muted-foreground">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">Sin área operativa disponible</p>
          <p className="text-xs text-muted-foreground">
            Esta terminal no tiene un área operativa disponible. Pedile al administrador que
            revise su perfil y permisos.
          </p>
        </div>
      ) : availableAreas.length === 1 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Área de trabajo
          </p>
          <AreaCard area={availableAreas[0]} accent={accent} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-bold">Elegí un área de trabajo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableAreas.map((area) => (
              <AreaCard key={area} area={area} accent={accent} />
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}

// ============================================
// Shell — contenedor responsivo
// ============================================
function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className={cn("w-full rounded-2xl border-border/60 shadow-sm", wide ? "max-w-2xl" : "max-w-md")}>
        <CardContent className="p-6 space-y-6">{children}</CardContent>
      </Card>
    </main>
  )
}

// ============================================
// AreaCard — Salón y PyR navegables (la disponibilidad ya la deriva el servidor)
// ============================================
// El destino y la etiqueta del CTA dependen solo del área disponible (derivada del
// contexto seguro: `terminal.areas` + scope base). No se usan scopes crudos para
// decidir navegación; el endpoint de cada área revalida la autorización real.
const AREA_HREF: Record<string, string> = {
  salon: "/operaciones/salon",
  pyr: "/operaciones/pyr",
}

const AREA_CTA: Record<string, string> = {
  salon: "Abrir Salón",
  pyr: "Abrir Pedidos y reseñas",
}

function AreaCard({ area, accent }: { area: string; accent: string }) {
  const Icon = area === "salon" ? UtensilsCrossed : ClipboardList
  const href = AREA_HREF[area]
  const navigable = !!href

  const inner = (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 space-y-2 h-full transition-all",
        navigable ? "border-border/60 hover:border-primary/40 hover:shadow-md cursor-pointer" : "border-border/60"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">{AREA_LABELS[area] ?? area}</p>
          <p className="text-xs text-muted-foreground truncate">{AREA_DESCRIPTIONS[area] ?? ""}</p>
        </div>
        {navigable && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
      {navigable ? (
        <div
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          {AREA_CTA[area] ?? "Abrir"}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Módulo disponible en la próxima etapa.</p>
        </div>
      )}
    </div>
  )

  if (navigable) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    )
  }
  return inner
}
