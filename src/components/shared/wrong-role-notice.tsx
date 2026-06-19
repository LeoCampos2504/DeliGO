"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { AlertTriangle, LogOut, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { useAuthStore } from "@/store/auth-store"
import { ROLE_CONFIGS, type DeliGORole } from "@/lib/role-config"
import type { UserType } from "@/lib/auth"

/**
 * Shown when a user is authenticated as one role but opened the PWA of a
 * different role. For example: a negocio session is active and the user opens
 * the cliente PWA. Instead of rendering the negocio panel inside the cliente
 * PWA (session-mixing bug), we show a clear notice with a link to the correct
 * PWA and a logout button.
 *
 * This is the "Option A" fix for BUG 3 (session mixing between PWAs that share
 * the same origin/cookie/localStorage). It does NOT use separate cookies per
 * role — it just prevents the wrong panel from rendering.
 */
function userTypeToRole(userType: UserType): DeliGORole {
  switch (userType) {
    case "negocio":
      return "negocio"
    case "repartidor":
      return "repartidor"
    case "superadmin":
      return "admin"
    default:
      return "cliente"
  }
}

interface WrongRoleNoticeProps {
  /** The role this PWA expects (e.g. "cliente" for /cliente/). */
  expectedRole: DeliGORole
  /** The user's actual authenticated type from the store. */
  currentType: UserType
}

export function WrongRoleNotice({ expectedRole, currentType }: WrongRoleNoticeProps) {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const [loggingOut, setLoggingOut] = useState(false)

  const currentRole = userTypeToRole(currentType)
  const currentConfig = ROLE_CONFIGS[currentRole]
  const expectedConfig = ROLE_CONFIGS[expectedRole]

  const handleLogout = async () => {
    setLoggingOut(true)
    // Clear the Zustand store first so the UI updates immediately.
    logout()
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Ignore — store is already cleared, session will expire server-side.
    }
    // Reload to reset any server-rendered state.
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  const goToCorrectPwa = () => {
    router.push(currentConfig.startUrl)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-amber-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-foreground">
                Sesión de {currentConfig.name}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tenés una sesión activa como{" "}
                <span className="font-semibold text-foreground">
                  {currentConfig.name}
                </span>
                . Esta app ({expectedConfig.name}) requiere una sesión de
                cliente.
              </p>
              <p className="text-xs text-muted-foreground">
                Para usar la app de cliente, cerrá sesión primero. O abrí el
                panel correcto.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <Button
                onClick={goToCorrectPwa}
                className="w-full"
                size="lg"
              >
                Ir a {currentConfig.name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
                size="lg"
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cerrando sesión...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
