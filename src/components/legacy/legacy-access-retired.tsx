import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// ============================================
// DeliGO - Legacy-Cleanup-1B
// ============================================
// Pantalla informativa estática compartida por /e, /e/[token], /s y
// /s/[token]. Sin "use client": no tiene estado, efectos, fetch ni
// temporizadores — solo JSX server-rendered. Los tres destinos son fijos y
// nunca incluyen el token de la URL ni ningún otro dato de la request
// (nunca se le pasa el token/pathname/negocio/empleado a este componente).
//
// `label`/`badgeClassName` son puramente cosméticos (una letra y un color,
// para conservar la identidad visual que ya tenía cada acceso retirado) —
// nunca datos sensibles.
interface LegacyAccessRetiredProps {
  label: string
  badgeClassName?: string
}

export function LegacyAccessRetired({ label, badgeClassName }: LegacyAccessRetiredProps) {
  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-6 py-10">
      <Card className="w-full max-w-sm rounded-2xl border-border/60 shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold",
              badgeClassName ?? "bg-muted text-muted-foreground"
            )}
          >
            {label}
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-foreground">Este acceso fue reemplazado</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              El acceso mediante enlace ya no está disponible. Para trabajar con un negocio, iniciá
              sesión en DeliGO Operaciones con tu cuenta personal.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Si todavía no tenés una cuenta, podés crearla desde la pantalla de ingreso. Después
              necesitás el código de incorporación proporcionado por el negocio.
            </p>
          </div>

          <div className="w-full space-y-2 pt-2">
            <Button asChild className="w-full rounded-xl font-bold">
              <Link href="/operaciones/ingresar">Ir a DeliGO Operaciones</Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-xl font-semibold">
              <Link href="/operaciones/registro">Crear cuenta</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full rounded-xl text-muted-foreground">
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
