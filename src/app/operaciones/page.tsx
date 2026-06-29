"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Loader2,
  Monitor,
  UtensilsCrossed,
  ClipboardList,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"

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
  | { status: "no-session" }
  | { status: "error" }
  | { status: "ready"; terminal: TerminalContext; negocio: NegocioContext }

export default function OperacionesPage() {
  const [state, setState] = useState<PageState>({ status: "loading" })

  const load = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const res = await fetch("/api/operaciones/terminal/contexto", { cache: "no-store" })
      if (res.status === 401) {
        setState({ status: "no-session" })
        return
      }
      if (!res.ok) {
        setState({ status: "error" })
        return
      }
      const data = await res.json().catch(() => null)
      if (!data || !data.ok || !data.terminal || !data.negocio) {
        setState({ status: "error" })
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
      })
    } catch {
      setState({ status: "error" })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando terminal…</p>
        </div>
      </Shell>
    )
  }

  if (state.status === "no-session") {
    return (
      <Shell>
        <div className="text-center space-y-4 py-4">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold">Terminal no vinculada</h1>
            <p className="text-sm text-muted-foreground">
              Esta terminal no está vinculada o su sesión ya no está vigente. Pedile al
              administrador un nuevo QR o código temporal.
            </p>
          </div>
          <Button asChild className="rounded-xl w-full gap-2 font-semibold">
            <Link href="/operaciones/activar">
              <Monitor className="h-4 w-4" />
              Activar terminal
            </Link>
          </Button>
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
            <p className="text-sm text-muted-foreground">
              Revisá la conexión e intentá de nuevo.
            </p>
          </div>
          <Button className="rounded-xl w-full gap-2 font-semibold" onClick={() => load()}>
            <Loader2 className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </Shell>
    )
  }

  // ── Terminal válida ──
  const { terminal, negocio } = state
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
// AreaCard — tarjeta de área (módulo de la próxima etapa)
// ============================================
function AreaCard({ area, accent }: { area: string; accent: string }) {
  const Icon = area === "salon" ? UtensilsCrossed : ClipboardList
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">{AREA_LABELS[area] ?? area}</p>
          <p className="text-xs text-muted-foreground truncate">{AREA_DESCRIPTIONS[area] ?? ""}</p>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2">
        <p className="text-[11px] text-muted-foreground">Módulo disponible en la próxima etapa.</p>
      </div>
    </div>
  )
}
