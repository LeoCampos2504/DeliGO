"use client"

import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CuentaOperativaRegisterForm } from "@/components/auth/cuenta-operativa-register-form"

export default function MozoRegistroPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-xl border-border/60">
        <CardContent className="p-5 space-y-5">
          <div className="space-y-1">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UserPlus className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold">Crear cuenta de mozo</h1>
            <p className="text-sm text-muted-foreground">
              Registrá tu cuenta personal para vincularte a un negocio con código.
            </p>
          </div>

          <CuentaOperativaRegisterForm
            onSuccess={() => router.replace("/mozo")}
            loginHref="/mozo/iniciar-sesion"
          />
        </CardContent>
      </Card>
    </main>
  )
}
