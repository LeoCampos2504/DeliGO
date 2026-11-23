"use client"

// ============================================
// F10-C2c — «Etiquetas de góndola»: precios autorizados por el dueño que esperan el cambio físico de la etiqueta
// ============================================
// La usan el dueño (Caja → Etiquetas) y el cajero (Mi panel → Caja → Etiquetas) con sus propios endpoints. Marcar
// «Etiqueta actualizada» ACTIVA el precio nuevo para las ventas que empiecen desde ese momento (las ventas ya
// empezadas conservan el precio con el que arrancaron). Nadie elige ni escribe un precio acá: sólo se confirma lo
// que el dueño autorizó. El dueño además ve quién confirmó y cuándo, y puede activar sin etiqueta (producto sin
// etiqueta física o vendido sólo online) o descartar el precio autorizado.

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Search, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatoArs } from "@/components/business/caja-salidas-cajero"

export type EtiquetaPrecioFila = {
  id: string
  producto: string
  variante: string | null
  precioAnterior: string
  precioNuevo: string
  modo: "ETIQUETA" | "SIN_ETIQUETA"
  estado: "PENDIENTE" | "ACTIVADA" | "REEMPLAZADA" | "DESCARTADA"
  resolucion: string | null
  recepcion: number
  autorizadaEn: string
  resueltaEn: string | null
  resueltaPor?: string | null
}

type Filtro = "PENDIENTES" | "COMPLETADAS" | "TODAS"

const ESTADO_TEXTO: Record<EtiquetaPrecioFila["estado"], string> = { PENDIENTE: "Pendiente", ACTIVADA: "Actualizado", REEMPLAZADA: "Reemplazado", DESCARTADA: "Descartado" }
const RESOLUCION_TEXTO: Record<string, string> = {
  ETIQUETA_CONFIRMADA: "etiqueta confirmada",
  ACTIVADA_POR_DUENO: "activado por el dueño sin etiqueta",
  SIN_ETIQUETA: "activado al aprobar (sin etiqueta física)",
  REEMPLAZADA_POR_NUEVA: "se autorizó un precio más nuevo",
  REEMPLAZADA_POR_CATALOGO: "el dueño cambió el precio desde el catálogo",
  DESCARTADA: "descartado por el dueño",
}
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—")

export function etiquetasPendientesQueryKey(url: string) {
  return ["etiquetas-precio", url, "PENDIENTES", ""] as const
}

export function EtiquetasPrecioLista({ url, esDueno, onAccesoPerdido }: { url: string; esDueno: boolean; onAccesoPerdido?: (status: number) => void }) {
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>("PENDIENTES")
  const [q, setQ] = useState("")
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string; detalle?: string[] } | null>(null)
  const busqueda = q.trim()

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ pendientes: number; etiquetas: EtiquetaPrecioFila[] }>({
    queryKey: ["etiquetas-precio", url, filtro, busqueda],
    queryFn: async () => {
      const sp = new URLSearchParams({ estado: filtro, ...(busqueda ? { q: busqueda } : {}) })
      const res = await fetch(`${url}?${sp}`, { cache: "no-store" })
      if (res.status === 401 || res.status === 403) onAccesoPerdido?.(res.status)
      if (!res.ok) throw new Error("No se pudo cargar la lista.")
      return res.json()
    },
  })
  const filas = useMemo(() => data?.etiquetas ?? [], [data])
  const pendientesVisibles = filas.filter((f) => f.estado === "PENDIENTE")
  const elegidasVisibles = pendientesVisibles.filter((f) => elegidas.has(f.id)).map((f) => f.id)

  async function resolver(accion: "CONFIRMAR" | "ACTIVAR_SIN_ETIQUETA" | "DESCARTAR", ids: string[]) {
    if (!ids.length || enviando) return
    setEnviando(true)
    setAviso(null)
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion, ids }) })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; resueltas?: Array<{ producto: string }>; omitidas?: Array<{ motivo: string }> }
      if (res.status === 401 || res.status === 403) onAccesoPerdido?.(res.status)
      if (!res.ok || !json.ok) {
        setAviso({ tono: "error", texto: json.error ?? "No se pudo completar. Probá de nuevo." })
        return
      }
      const n = json.resueltas?.length ?? 0
      const verbo = accion === "DESCARTAR" ? (n === 1 ? "descartado" : "descartados") : n === 1 ? "activado: ya se cobra en las ventas nuevas" : "activados: ya se cobran en las ventas nuevas"
      setAviso({ tono: n > 0 ? "ok" : "error", texto: n > 0 ? `${n} ${n === 1 ? "precio" : "precios"} ${verbo}.` : "No se cambió nada.", detalle: (json.omitidas ?? []).map((o) => o.motivo) })
      setElegidas(new Set())
    } catch {
      // Sin respuesta: puede haberse aplicado. Releer la lista muestra el estado real (confirmar dos veces no duplica nada).
      setAviso({ tono: "error", texto: "No pudimos confirmar la respuesta. Actualizá la lista para ver el estado real." })
    } finally {
      setEnviando(false)
      void queryClient.invalidateQueries({ queryKey: ["etiquetas-precio", url] })
    }
  }

  const alternar = (id: string) => setElegidas((sel) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <section className="space-y-3" aria-labelledby="etiquetas-titulo" data-testid="etiquetas-precio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="etiquetas-titulo" className="flex items-center gap-1.5 text-base font-semibold">
          <Tag className="h-4 w-4" aria-hidden />
          Etiquetas de góndola
          <span className={cn("rounded-full px-2 py-0.5 text-xs", (data?.pendientes ?? 0) > 0 ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "bg-muted text-muted-foreground")} data-testid="etiquetas-pendientes">
            {data ? `${data.pendientes} ${data.pendientes === 1 ? "pendiente" : "pendientes"}` : "…"}
          </span>
        </h2>
        <Button variant="ghost" className="min-h-11 gap-1.5 rounded-xl" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden />Actualizar
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Precios nuevos autorizados por el dueño. Hasta que se cambie la etiqueta y se marque «Etiqueta actualizada», se sigue cobrando el precio anterior. Al confirmarla, el precio nuevo se cobra en las ventas que empiecen desde ese momento.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" className="min-h-11 rounded-xl pl-9" aria-label="Buscar producto" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0">Mostrar</span>
          <select className="min-h-11 rounded-xl border bg-background px-3 text-sm" value={filtro} onChange={(e) => { setFiltro(e.target.value as Filtro); setElegidas(new Set()) }} aria-label="Filtrar etiquetas">
            <option value="PENDIENTES">Pendientes</option>
            <option value="COMPLETADAS">Completadas</option>
            <option value="TODAS">Todas</option>
          </select>
        </label>
      </div>

      {pendientesVisibles.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 backdrop-blur">
          <label className="flex min-h-11 items-center gap-2 px-1 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={elegidasVisibles.length === pendientesVisibles.length} onChange={(e) => setElegidas(e.target.checked ? new Set(pendientesVisibles.map((f) => f.id)) : new Set())} aria-label="Elegir todas las pendientes" />
            Todas ({pendientesVisibles.length})
          </label>
          <Button className="min-h-11 rounded-xl" disabled={!elegidasVisibles.length || enviando} onClick={() => void resolver("CONFIRMAR", elegidasVisibles)} data-testid="confirmar-etiquetas">
            {enviando ? "Guardando…" : `Etiqueta actualizada${elegidasVisibles.length ? ` (${elegidasVisibles.length})` : ""}`}
          </Button>
          {esDueno && (
            <>
              <Button variant="outline" className="min-h-11 rounded-xl" disabled={!elegidasVisibles.length || enviando} onClick={() => void resolver("ACTIVAR_SIN_ETIQUETA", elegidasVisibles)}>Activar sin etiqueta</Button>
              <Button variant="ghost" className="min-h-11 rounded-xl text-rose-700" disabled={!elegidasVisibles.length || enviando} onClick={() => void resolver("DESCARTAR", elegidasVisibles)}>Descartar precio</Button>
            </>
          )}
        </div>
      )}

      {aviso && (
        <div role={aviso.tono === "error" ? "alert" : "status"} className={cn("rounded-xl p-3 text-sm", aviso.tono === "ok" ? "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100" : "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100")}>
          <p>{aviso.texto}</p>
          {aviso.detalle && aviso.detalle.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{aviso.detalle.map((d, i) => <li key={i}>{d}</li>)}</ul>}
        </div>
      )}

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-rose-700" role="alert">No se pudo cargar la lista.</p>
      ) : filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{filtro === "PENDIENTES" ? (busqueda ? "Ninguna etiqueta pendiente coincide con la búsqueda." : "No hay etiquetas pendientes.") : "No hay etiquetas para mostrar."}</p>
      ) : (
        <ul className="space-y-2" aria-label="Etiquetas">
          {filas.map((f) => {
            const pendiente = f.estado === "PENDIENTE"
            const nombre = `${f.producto}${f.variante ? ` — ${f.variante}` : ""}`
            return (
              <li key={f.id} className={cn("rounded-xl border p-3", pendiente && elegidas.has(f.id) && "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30", !pendiente && "bg-muted/30")} data-testid="etiqueta-precio">
                <label className={cn("flex items-start gap-3", pendiente && "cursor-pointer")}>
                  {pendiente ? <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={elegidas.has(f.id)} onChange={() => alternar(f.id)} aria-label={`Etiqueta de ${nombre} actualizada`} /> : <span className="mt-1 h-5 w-5 shrink-0" aria-hidden />}
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="break-words font-medium">{nombre}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", pendiente ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : f.estado === "ACTIVADA" ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100" : "bg-muted text-muted-foreground")}>{ESTADO_TEXTO[f.estado]}</span>
                    </span>
                    <span className="block text-sm tabular-nums">
                      <span className="text-muted-foreground line-through decoration-1">{formatoArs(Number(f.precioAnterior))}</span>
                      <span aria-hidden> → </span>
                      <strong>{formatoArs(Number(f.precioNuevo))}</strong>
                      <span className="sr-only"> precio anterior {formatoArs(Number(f.precioAnterior))}, nuevo precio autorizado {formatoArs(Number(f.precioNuevo))}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Autorizado {fecha(f.autorizadaEn)} · Recepción N° {f.recepcion}
                      {!pendiente && f.resolucion ? ` · ${RESOLUCION_TEXTO[f.resolucion] ?? f.resolucion}` : ""}
                      {!pendiente && esDueno && f.resueltaPor ? ` · ${f.resueltaPor}, ${fecha(f.resueltaEn)}` : !pendiente && f.resueltaEn ? ` · ${fecha(f.resueltaEn)}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
