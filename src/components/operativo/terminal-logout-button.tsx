"use client"

import { useState } from "react"
import { Loader2, LogOut } from "lucide-react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const TERMINAL_SURFACE_PREFIXES = ["/operaciones/terminal", "/operaciones/salon", "/operaciones/pyr"]

/** Visible only on current TerminalOperativa surfaces, never personal legacy pages. */
export function TerminalLogoutButton() {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)

  if (!TERMINAL_SURFACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null
  }

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
