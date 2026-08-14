"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Settings, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatPrice } from "@/lib/utils"

interface PlatformConfigResponse {
  tarifaServicio: number
  updatedAt: string
}

export function ConfiguracionTab() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const [pendingValue, setPendingValue] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const configQuery = useQuery<PlatformConfigResponse>({
    queryKey: ["superadmin-platform-config"],
    queryFn: async () => {
      const response = await fetch("/api/superadmin/config", { cache: "no-store" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "No se pudo cargar la configuración")
      return data
    },
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the editable draft with the server-fetched configuration
    if (configQuery.data) setDraft(String(configQuery.data.tarifaServicio))
  }, [configQuery.data])

  const mutation = useMutation({
    mutationFn: async (tarifaServicio: number) => {
      const response = await fetch("/api/superadmin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarifaServicio }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "No se pudo guardar la tarifa")
      return data as { tarifaServicio: number; changed: boolean }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-platform-config"] })
      queryClient.invalidateQueries({ queryKey: ["superadmin-dashboard"] })
      toast.success(data.changed ? "Tarifa actualizada" : "Sin cambios: la tarifa ya tenía ese valor")
      setConfirmOpen(false)
      setPendingValue(null)
    },
    onError: (error: Error) => toast.error("No se pudo guardar", { description: error.message }),
  })

  const openConfirmation = () => {
    const value = Number(draft)
    if (!Number.isSafeInteger(value) || value < 0) {
      toast.error("Ingresá un entero mayor o igual a cero")
      return
    }
    setPendingValue(value)
    setConfirmOpen(true)
  }

  if (configQuery.isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  if (configQuery.isError || !configQuery.data) {
    return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">No se pudo cargar la configuración de plataforma.</p>
  }

  const currentValue = configQuery.data.tarifaServicio

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Configuración de plataforma</h2>
        <p className="text-sm text-muted-foreground">Valores globales aplicados a los pedidos nuevos.</p>
      </div>

      <section className="max-w-xl rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
            <Settings className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold">Tarifa de servicio</h3>
            <p className="text-sm text-muted-foreground">Valor actual: {formatPrice(currentValue)} · ARS por pedido</p>
          </div>
        </div>

        <label className="space-y-2 text-sm font-medium">
          Nuevo valor (ARS por pedido)
          <Input
            type="number"
            min={0}
            step={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={mutation.isPending}
            inputMode="numeric"
          />
        </label>
        <Button className="mt-4 gap-2" onClick={openConfirmation} disabled={mutation.isPending}>
          <Save className="h-4 w-4" />
          Guardar cambio
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">Actualizado: {new Date(configQuery.data.updatedAt).toLocaleString("es-AR")}</p>
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar tarifa de servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Cambiar de {formatPrice(currentValue)} a {formatPrice(pendingValue ?? currentValue)}. Los pedidos nuevos usarán el nuevo valor; los existentes conservarán su snapshot y no se modifica deuda histórica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending || pendingValue === null}
              onClick={(event) => {
                event.preventDefault()
                if (pendingValue !== null) mutation.mutate(pendingValue)
              }}
            >
              {mutation.isPending ? "Guardando…" : "Confirmar cambio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
