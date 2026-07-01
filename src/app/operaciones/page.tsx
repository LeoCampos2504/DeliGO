import Link from "next/link"
import { Monitor, UserRound, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"

// ============================================
// DeliGO Operaciones — Punto de acceso unificado (Operaciones-1B)
// ============================================
// Selector NEUTRAL: el usuario elige explícitamente el modo. Esta pantalla no
// resuelve, mezcla ni expone identidad: no consulta el contexto de terminal ni
// la sesión personal. Cada modo usa exclusivamente su propia identidad en su
// ruta dedicada (/operaciones/ingresar → cuenta personal; /operaciones/terminal
// → terminal compartida).
export default function OperacionesEntryPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-sm">
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
            <Link
              href="/operaciones/ingresar"
              className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-muted text-foreground">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight">Ingresar con mi cuenta</p>
                    <p className="text-xs text-muted-foreground">
                      Para trabajar con tu usuario y los permisos asignados por tu negocio.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </div>
            </Link>

            <Link
              href="/operaciones/terminal"
              className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-muted text-foreground">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight">Usar o activar esta terminal</p>
                    <p className="text-xs text-muted-foreground">
                      Para una tablet, PC o pantalla vinculada al negocio.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </div>
            </Link>
          </nav>
        </CardContent>
      </Card>
    </main>
  )
}
