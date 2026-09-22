"use client"

import { useState } from "react"
import { Loader2, LogOut } from "lucide-react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const TERMINAL_SURFACE_PREFIXES = ["/operaciones/terminal", "/operaciones/salon", "/operaciones/pyr"]

// P2-T49-R1: el chat de Terminal PyR trae su propio acceso de logout
// compacto en el header (ver page.tsx de .../pyr/mensajes/[pedidoId]) —
// el botón flotante global chocaba con el composer ahí. En cualquier
// otra superficie Terminal (incluida /operaciones/pyr sin subruta) el
// flotante sigue exactamente igual que siempre.
const CHAT_ROUTE_PREFIX = "/operaciones/pyr/mensajes/"

function isTerminalSurface(pathname: string | null): boolean {
  if (!pathname) return false
  return TERMINAL_SURFACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Lógica de logout de Terminal compartida por el botón flotante global y
 * por cualquier acceso equivalente que una pantalla puntual (ej. el chat)
 * necesite renderizar en su propio layout — mismo endpoint, mismo manejo
 * de error, misma navegación posterior, una sola implementación.
 */
export function useTerminalLogout() {
  const [pending, setPending] = useState(false)

  const logout = async () => {
    if (pending) return
    setPending(true)
    try {
      const response = await fetch("/api/operaciones/terminal/logout", { method: "POST", cache: "no-store" })
      if (!response.ok) throw new Error("logout_failed")
      window.location.assign("/operaciones/activar")
    } catch {
      setPending(false)
      toast.error("No se pudo cerrar la terminal. Revisá la conexión e intentá de nuevo.")
    }
  }

  return { pending, logout }
}

/** Visible only on current TerminalOperativa surfaces, never personal legacy pages, and never on the chat route (which renders its own compact logout in-header, see page.tsx). */
export function TerminalLogoutButton() {
  const pathname = usePathname()
  const { pending, logout } = useTerminalLogout()

  if (!isTerminalSurface(pathname) || pathname?.startsWith(CHAT_ROUTE_PREFIX)) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="fixed bottom-4 right-4 z-50 rounded-xl gap-1.5 bg-background/95 text-xs shadow-md backdrop-blur"
      onClick={logout}
      disabled={pending}
      aria-label="Cerrar terminal"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      Cerrar terminal
    </Button>
  )
}
