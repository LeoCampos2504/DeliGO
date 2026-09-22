"use client"

// P2-T39-R3: switch único ON/OFF de Web Push para SuperAdmin, sin
// preferencias por tipo (los 5 tipos de Notificacion.tipo comparten el mismo
// canal). La campana y el polling interno de /admin siguen siempre activos,
// independientemente de este switch — deshabilitarlo sólo detiene el canal
// adicional de Push. Reutiliza el hook compartido `usePushNotifications` con
// `actorFamily: "superadmin"` (mismo transporte `?actorFamily=` ya usado por
// CuentaOperativa) — nunca un hook dedicado nuevo.
import { Bell, BellOff, AlertCircle, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { usePushNotifications } from "@/hooks/use-push-notifications"

export function SuperadminPushSettings() {
  const push = usePushNotifications({ actorFamily: "superadmin", actorKey: "superadmin" })

  return (
    <section className="max-w-xl rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
            {!push.statusResolved ? (
              <Bell className="h-5 w-5 text-muted-foreground" />
            ) : push.isSubscribed ? (
              <Bell className="h-5 w-5 text-purple-600" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">Notificaciones push</p>
            <p className="text-xs text-muted-foreground">
              {push.loading
                ? "Procesando..."
                : !push.isSupported
                  ? "No disponibles en este navegador"
                  : !push.statusResolved
                    ? push.statusCheckError
                      ? "No se pudo comprobar"
                      : "Comprobando estado..."
                    : push.isSubscribed
                      ? "Recibirás avisos de negocios pendientes, denuncias, deudas, destacados y moderación"
                      : "No recibirás avisos push (la campana sigue activa)"}
            </p>
          </div>
        </div>
        {push.isSupported && !push.statusResolved ? (
          push.statusCheckError ? (
            <AlertCircle className="h-5 w-5 text-muted-foreground" aria-label="No se pudo comprobar el estado de notificaciones" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Comprobando estado de notificaciones" />
          )
        ) : (
          <Switch
            checked={push.isSubscribed}
            onCheckedChange={(val) => {
              if (val) push.subscribe()
              else push.unsubscribe()
            }}
            disabled={!push.isSupported || push.loading}
          />
        )}
      </div>

      {!push.isSupported && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Las notificaciones push no están disponibles en este navegador. Probá con Chrome o Firefox.
          </p>
        </div>
      )}

      {push.isSubscribed && push.permission !== "granted" && (
        <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Necesitás permitir las notificaciones en tu navegador. Hacé clic en el ícono de candado en la barra de direcciones.
          </p>
        </div>
      )}
    </section>
  )
}
