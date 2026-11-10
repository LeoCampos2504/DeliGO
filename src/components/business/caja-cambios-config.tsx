"use client"

// ============================================
// F4-C5 (D3/D4) — owner ONLY: thresholds of the informative exchange warnings (P1)
// ============================================
// Empty = the default (30 days / 3 previous exchanges). The warnings never block
// an exchange: these numbers only decide when they are shown.

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Config = {
  configurados: { antiguedadDias: number | null; cadenaCambios: number | null }
  predeterminados: { antiguedadDias: number; cadenaCambios: number }
  vigentes: { antiguedadDias: number; cadenaCambios: number }
}
const URL = "/api/negocio/caja/configuracion-cambios"
const KEY = ["negocio-caja-config-cambios"] as const

function aValor(texto: string): number | null | "invalido" {
  const t = texto.trim()
  if (!t) return null
  return /^\d{1,4}$/.test(t) ? Number(t) : "invalido"
}

export function CajaCambiosConfig() {
  const queryClient = useQueryClient()
  const [edicion, setEdicion] = useState<{ antiguedadDias: string; cadenaCambios: string } | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const query = useQuery<Config>({
    queryKey: KEY,
    queryFn: async () => {
      const response = await fetch(URL, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No se pudo cargar la configuración.")
      return json
    },
  })
  const guardar = useMutation({
    mutationFn: async (valores: { antiguedadDias: number | null; cadenaCambios: number | null }) => {
      const response = await fetch(URL, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valores) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No pudimos guardar la configuración.")
      return json as Config
    },
    onSuccess: (data) => { queryClient.setQueryData(KEY, data); setEdicion(null); setMensaje("Configuración guardada.") },
    onError: (error: Error) => setMensaje(error.message),
  })
  if (query.isLoading) return null
  if (query.isError || !query.data) return <p role="alert" className="text-sm text-destructive">{(query.error as Error | null)?.message ?? "No se pudo cargar la configuración."}</p>
  const cfg = query.data
  const valores = edicion ?? { antiguedadDias: cfg.configurados.antiguedadDias?.toString() ?? "", cadenaCambios: cfg.configurados.cadenaCambios?.toString() ?? "" }
  const antiguedad = aValor(valores.antiguedadDias)
  const cadena = aValor(valores.cadenaCambios)
  const fueraDeRango = (v: number | null | "invalido", max: number) => v === "invalido" || (typeof v === "number" && (v < 1 || v > max))
  const invalido = fueraDeRango(antiguedad, 3650) || fueraDeRango(cadena, 1000)
  return (
    <section aria-label="Advertencias de cambios" className="mt-3 space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <h3 className="text-base font-bold">Cambios: advertencias</h3>
        <p className="text-sm text-muted-foreground">Son sólo informativas: nunca impiden un cambio. Dejá vacío para usar el valor predeterminado.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0 space-y-1 text-sm font-medium">
          <span>Avisar si la venta tiene más de … días (predeterminado {cfg.predeterminados.antiguedadDias})</span>
          <Input inputMode="numeric" aria-label="Días de antigüedad para avisar" value={valores.antiguedadDias} onChange={(e) => { setMensaje(null); setEdicion({ ...valores, antiguedadDias: e.target.value }) }} placeholder={String(cfg.predeterminados.antiguedadDias)} className="h-11 rounded-xl" />
        </label>
        <label className="block min-w-0 space-y-1 text-sm font-medium">
          <span>Avisar desde … cambios anteriores en la cadena (predeterminado {cfg.predeterminados.cadenaCambios})</span>
          <Input inputMode="numeric" aria-label="Cambios anteriores para avisar" value={valores.cadenaCambios} onChange={(e) => { setMensaje(null); setEdicion({ ...valores, cadenaCambios: e.target.value }) }} placeholder={String(cfg.predeterminados.cadenaCambios)} className="h-11 rounded-xl" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Vigentes: {cfg.vigentes.antiguedadDias} días · {cfg.vigentes.cadenaCambios} cambios.</p>
      {invalido && <p role="alert" className="text-xs text-destructive">Usá números enteros: días entre 1 y 3650, cambios entre 1 y 1000.</p>}
      {mensaje && <p role="status" className="text-sm text-muted-foreground">{mensaje}</p>}
      <Button type="button" disabled={!edicion || invalido || guardar.isPending} onClick={() => guardar.mutate({ antiguedadDias: antiguedad as number | null, cadenaCambios: cadena as number | null })}>
        {guardar.isPending ? "Guardando…" : "Guardar"}
      </Button>
    </section>
  )
}
