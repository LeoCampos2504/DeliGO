"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowRight, Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { useAuth } from "@/hooks/use-auth"
import { getRoleConfig, getRoleForUserType } from "@/lib/role-config"
import type { UserType } from "@/lib/auth"

interface WrongRoleNoticeProps {
  expectedRole: "cliente"
  currentType: UserType
}

export function WrongRoleNotice({ expectedRole, currentType }: WrongRoleNoticeProps) {
  const router = useRouter()
  const { logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const currentConfig = getRoleConfig(getRoleForUserType(currentType))
  const expectedConfig = getRoleConfig(expectedRole)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
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
                <span className="font-semibold text-foreground">{currentConfig.name}</span>.
                Esta app ({expectedConfig.name}) requiere una sesión de cliente.
              </p>
              <p className="text-xs text-muted-foreground">
                Abrí la experiencia correcta para continuar.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <Button
                onClick={() => router.push(currentConfig.startUrl)}
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
