"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BadgeCheck, CircleSlash, Plus, RefreshCw, Star, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Turno = { id: string; responsableTipo: "NEGOCIO" | "EMPLEADO"; responsableNombre: string; abiertoEn: string }
export type CajaFisicaResumen = {
  id: string
  nombre: string
  descripcion: string | null
  esPredeterminada: boolean
  activa: boolean
  turnoAbierto: Turno | null
}
type CajaResponse = { modoTurnos: "OPCIONAL" | "OBLIGATORIO"; cajas: CajaFisicaResumen[] }

export const ownerRegisterQueryKey = (negocioId: string) => ["negocio-caja-registros-turnos", negocioId] as const

export function OwnerCajaTurnosPanel({ negocioId }: { negocioId: string }) {
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState("")
  const [nombresEditados, setNombresEditados] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const query = useQuery<CajaResponse>({
    queryKey: ownerRegisterQueryKey(negocioId),
    queryFn: async () => {
      const response = await fetch("/api/negocio/caja/cajas", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudieron cargar las cajas.")
      return json
    },
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ownerRegisterQueryKey(negocioId) })
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/negocio/caja/cajas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim() }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudo crear la caja.")
      return json
    },
    onSuccess: () => { setNombre(""); setMessage("Caja creada."); void refresh() },
    onError: (error) => setMessage(error.message),
  })
  const update = useMutation({
    mutationFn: async ({ caja, patch }: { caja: CajaFisicaResumen; patch: Record<string, unknown> }) => {
      const response = await fetch(`/api/negocio/caja/cajas/${encodeURIComponent(caja.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudo actualizar la caja.")
      return { caja, json }
    },
    onSuccess: ({ caja }) => { setNombresEditados((current) => { const next = { ...current }; delete next[caja.id]; return next }); setMessage("Caja actualizada."); void refresh() },
    onError: (error) => setMessage(error.message),
  })

  if (query.isLoading) return <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Cargando cajas…</p>
  if (query.isError) return <div className="rounded-xl border bg-card p-5"><p role="alert" className="text-sm text-destructive">{query.error.message}</p><Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div>

  const cajas = query.data?.cajas ?? []
  return (
    <section className="space-y-4" aria-label="Administración de cajas y turnos">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-base font-bold">Cajas y turnos</h3><p className="text-sm text-muted-foreground">Los turnos abiertos se muestran sin datos de recaudación.</p></div>
        <Button variant="ghost" size="icon" aria-label="Actualizar cajas y turnos" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cajas.map((caja) => {
          const nombreActual = nombresEditados[caja.id] ?? caja.nombre
          const ocupada = Boolean(caja.turnoAbierto)
          return (
            <article key={caja.id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h4 className="truncate font-bold">{caja.nombre}{caja.esPredeterminada ? " · Principal" : ""}</h4><p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${ocupada ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : caja.activa ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>{ocupada ? "Turno abierto" : caja.activa ? "Disponible" : "Inactiva"}</p></div>
                {caja.esPredeterminada && <Star className="h-4 w-4 shrink-0 fill-current text-primary" aria-label="Predeterminada" />}
              </div>
              {caja.turnoAbierto && <div className="rounded-xl bg-muted/50 p-3 text-sm"><p className="flex items-center gap-1.5 font-semibold"><UserRound className="h-4 w-4" />Responsable: {caja.turnoAbierto.responsableNombre}</p><p className="mt-1 text-xs text-muted-foreground">Abierto {new Date(caja.turnoAbierto.abiertoEn).toLocaleString("es-AR")}</p></div>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input aria-label={`Nombre de ${caja.nombre}`} value={nombreActual} onChange={(event) => setNombresEditados((current) => ({ ...current, [caja.id]: event.target.value }))} className="h-11 min-w-0 rounded-xl" />
                <Button variant="outline" className="h-11 rounded-xl" disabled={update.isPending || !nombreActual.trim() || nombreActual.trim() === caja.nombre} onClick={() => update.mutate({ caja, patch: { nombre: nombreActual.trim() } })}>Renombrar</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {!caja.esPredeterminada && <Button variant="outline" size="sm" className="min-h-10 rounded-xl" disabled={update.isPending || !caja.activa} onClick={() => update.mutate({ caja, patch: { esPredeterminada: true } })}><Star className="mr-1 h-4 w-4" />Predeterminada</Button>}
                {!caja.esPredeterminada && <Button variant="outline" size="sm" className="min-h-10 rounded-xl" disabled={update.isPending || ocupada} onClick={() => update.mutate({ caja, patch: { activa: !caja.activa } })}>{caja.activa ? <><CircleSlash className="mr-1 h-4 w-4" />Desactivar</> : <><BadgeCheck className="mr-1 h-4 w-4" />Activar</>}</Button>}
              </div>
            </article>
          )
        })}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); setMessage(null); create.mutate() }} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 sm:flex-row">
        <Input aria-label="Nombre de la nueva caja" value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={80} placeholder="Nombre de la caja adicional" className="h-11 min-w-0 rounded-xl" />
        <Button type="submit" disabled={!nombre.trim() || create.isPending} className="h-11 rounded-xl"><Plus className="mr-1 h-4 w-4" />{create.isPending ? "Creando…" : "Crear caja"}</Button>
      </form>
      {query.data?.modoTurnos === "OPCIONAL" && <p className="text-xs text-muted-foreground">Los turnos siguen en modo opcional. Las ventas sin turno mantienen el flujo actual.</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </section>
  )
}
