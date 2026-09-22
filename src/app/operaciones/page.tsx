import Link from "next/link"
import { Monitor, UserRound, ChevronRight, type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"

// ============================================
// DeliGO Operaciones — Punto de acceso unificado (Operaciones-1B)
// ============================================
// Selector NEUTRAL: el usuario elige explícitamente el modo. Esta pantalla no
// resuelve, mezcla ni expone identidad: no consulta el contexto de terminal ni
// la sesión personal. Cada modo usa exclusivamente su propia identidad en su
// ruta dedicada (/operaciones/ingresar → cuenta personal; /operaciones/terminal
// → terminal compartida).
//
// P2-T51-R1: paridad visual con el resto de DeliGO (Cliente/Negocio/
// Operaciones-ingresar) — decoración de fondo + accent por opción, SIN tocar
// ruta, copy, ni la neutralidad de sesión de esta pantalla. El accent
// "amber" reutiliza el ya establecido por /operaciones/ingresar; el accent
// "slate" es fijo y genérico para Terminal (nunca `negocio.colorPrincipal`,
// desconocido antes de autenticar la terminal).
export default function OperacionesEntryPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-slate-400/10 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md rounded-2xl border-border/60 shadow-lg shadow-black/5 dark:shadow-black/20">
        <CardContent className="p-6 space-y-6">
          {/* Identidad */}
          <div className="space-y-3">
            <Logo size="sm" />
            <div>
              <h1 className="text-lg font-extrabold leading-tight">DeliGO Operaciones</h1>
              <p className="text-sm text-muted-foreground">Elegí cómo querés entrar.</p>
            </div>
          </div>

          {/* Opciones de acceso */}
          <nav className="space-y-3" aria-label="Modo de acceso">
            <EntryOptionCard
              href="/operaciones/ingresar"
              icon={UserRound}
              title="Ingresar con mi cuenta"
              description="Para trabajar con tu usuario y los permisos asignados por tu negocio."
              accent="amber"
            />
            <EntryOptionCard
              href="/operaciones/terminal"
              icon={Monitor}
              title="Usar o activar esta terminal"
              description="Para una tablet, PC o pantalla vinculada al negocio."
              accent="slate"
            />
          </nav>
        </CardContent>
      </Card>
    </main>
  )
}

type EntryOptionAccent = "amber" | "slate"

const ENTRY_OPTION_ACCENT_CLASSES: Record<EntryOptionAccent, { badge: string; hover: string }> = {
  amber: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    hover: "hover:border-amber-400/40 hover:shadow-md",
  },
  slate: {
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
    hover: "hover:border-slate-400/40 hover:shadow-md",
  },
}

function EntryOptionCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
  accent: EntryOptionAccent
}) {
  const accentClasses = ENTRY_OPTION_ACCENT_CLASSES[accent]
  return (
    <Link
      href={href}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={cn("rounded-2xl border border-border/60 bg-card p-4 transition-all", accentClasses.hover)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0", accentClasses.badge)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    </Link>
  )
}
