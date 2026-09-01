import Link from "next/link"
import { ArrowRight, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Legacy-Cleanup-2A: este path queda únicamente como pantalla neutral de
// deprecación. El parámetro dinámico nunca se lee, consulta, persiste, registra
// ni se reenvía; el acceso productivo vive en CuentaOperativa.
export default function LegacyMozoDeprecationPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-sm">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <UserRound className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Acceso actualizado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este acceso fue reemplazado por DeliGO Operaciones.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Para continuar, ingresá con tu cuenta operativa.
            </p>
          </div>
          <Button asChild className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600">
            <Link href="/operaciones/ingresar">
              Ingresar a DeliGO Operaciones
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
