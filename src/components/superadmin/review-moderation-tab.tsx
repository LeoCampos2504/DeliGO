"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, FileText, Loader2, MessageSquareWarning, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { evidenceTimelineEntry } from "@/lib/review-moderation-evidence-ui"

type Status = "PENDIENTE" | "EN_REVISION" | "REQUIERE_INFORMACION" | "APROBADA" | "RECHAZADA" | "RESTAURADA_AUTOMATICAMENTE"
type Evidence = { id: string; nombrePresentacion: string; mimeType: string; bytes: number; createdAt: string }
type Event = { id: string; tipo: string; actorTipo: string; mensaje: string | null; createdAt: string; evidencias: Evidence[] }
type Item = { id: string; estado: Status; motivo: string; venceEn: string; createdAt: string; negocio: { nombre: string; slug: string }; resena: { puntuacion: number; comentario: string } }
type Detail = Item & { explicacionOriginal: string; resueltaEn: string | null; motivoDecision: string | null; updatedAt: string; resena: Item["resena"] & { rapidez: number | null; calidad: number | null; precio: number | null; respuestaNegocio: string | null; fecha: string; fechaRespuesta: string | null; estadoModeracion: string }; eventos: Event[] }

const labels: Record<Status, string> = { PENDIENTE: "Pendiente", EN_REVISION: "En revisión", REQUIERE_INFORMACION: "Esperando información", APROBADA: "Aprobada", RECHAZADA: "Rechazada", RESTAURADA_AUTOMATICAMENTE: "Restaurada automáticamente" }
const eventLabels: Record<string, string> = { SOLICITUD_CREADA: "Solicitud enviada", TOMADA_EN_REVISION: "Tomada en revisión", INFORMACION_REQUERIDA: "Se solicitó información", INFORMACION_APORTADA: "Información aportada", APROBADA: "Solicitud aprobada", RECHAZADA: "Solicitud rechazada", RESTAURADA_AUTOMATICAMENTE: "Solicitud restaurada" }
const terminal = new Set<Status>(["APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"])

export function ReviewModerationTab() {
  const client = useQueryClient()
  const [status, setStatus] = useState<string>("todos")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [action, setAction] = useState<"PEDIR_INFORMACION" | "APROBAR" | "RECHAZAR" | null>(null)
  const [text, setText] = useState("")
  const list = useQuery<{ items: Item[]; total: number; page: number; limit: number }>({
    queryKey: ["moderation-list", status, page],
    queryFn: async () => {
      const query = new URLSearchParams({ page: String(page), limit: "20" })
      if (status !== "todos") query.set("estado", status)
      const response = await fetch(`/api/superadmin/solicitudes-revision-resenas?${query}`)
      if (!response.ok) throw new Error("No se pudo cargar moderación")
      return response.json()
    },
  })
  const detail = useQuery<Detail>({
    queryKey: ["moderation-detail", selected],
    enabled: !!selected,
    queryFn: async () => {
      const response = await fetch(`/api/superadmin/solicitudes-revision-resenas/${selected}`)
      if (!response.ok) throw new Error("No se pudo cargar el expediente")
      return response.json()
    },
  })
  const refresh = () => {
    client.invalidateQueries({ queryKey: ["moderation-list"] })
    client.invalidateQueries({ queryKey: ["moderation-detail", selected] })
  }
  const mutate = useMutation({
    mutationFn: async ({ kind, value }: { kind: string; value?: string }) => {
      const path = kind === "TOMAR_EN_REVISION" ? "tomar" : kind === "PEDIR_INFORMACION" ? "pedir-informacion" : kind === "APROBAR" ? "aprobar" : "rechazar"
      const body = kind === "PEDIR_INFORMACION" ? { mensaje: value } : kind === "TOMAR_EN_REVISION" ? {} : { motivoDecision: value }
      const response = await fetch(`/api/superadmin/solicitudes-revision-resenas/${selected}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(String(response.status))
    },
    onSuccess: () => {
      toast.success("Expediente actualizado")
      setAction(null)
      setText("")
      refresh()
    },
    onError: (error: Error) => {
      toast.error(error.message === "409" ? "La solicitud cambió. Actualizamos su estado." : "No se pudo actualizar el expediente.")
      refresh()
    },
  })
  const items = list.data?.items ?? []
  const active = detail.data && !terminal.has(detail.data.estado)

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-bold">Moderación de reseñas</h2><p className="text-sm text-muted-foreground">Solicitudes pendientes y su historial.</p></div>
      <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos los estados</SelectItem>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
    </div>
    {list.isLoading ? <p className="text-sm text-muted-foreground">Cargando solicitudes…</p> : <div className="grid gap-3">
      {items.map((item) => <button type="button" key={item.id} onClick={() => setSelected(item.id)} className="rounded-xl border p-4 text-left transition hover:bg-muted/40"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0 flex-1"><p className="break-words font-semibold">{item.negocio.nombre}</p><p className="text-xs text-muted-foreground">{item.motivo} · {new Date(item.createdAt).toLocaleDateString("es-AR")}</p></div><Badge variant="secondary">{labels[item.estado]}</Badge></div><p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">{item.resena.comentario}</p><p className="mt-2 text-xs text-muted-foreground">Puntuación: {item.resena.puntuacion}/5 · Vence: {new Date(item.venceEn).toLocaleDateString("es-AR")}</p></button>)}
      {!items.length && <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No hay solicitudes para este filtro.</div>}
    </div>}
    {(list.data?.total ?? 0) > 20 && <div className="flex justify-between"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="outline" disabled={items.length < 20} onClick={() => setPage(page + 1)}>Siguiente</Button></div>}
    <Dialog open={!!selected} onOpenChange={(isOpen) => { if (!isOpen) { setSelected(null); setAction(null); setText("") } }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Expediente de moderación</DialogTitle><DialogDescription>Datos de revisión, sin información personal del cliente.</DialogDescription></DialogHeader>
        {detail.isLoading ? <p>Cargando expediente…</p> : detail.data && <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><Badge>{labels[detail.data.estado]}</Badge><span className="min-w-0 break-words text-xs text-muted-foreground">{detail.data.negocio.nombre}</span></div>
          <section className="rounded-lg border p-3 text-sm"><p className="font-medium">Motivo: {detail.data.motivo}</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{detail.data.explicacionOriginal}</p></section>
          <section className="rounded-lg border p-3 text-sm"><p className="font-medium">Reseña · {detail.data.resena.puntuacion}/5</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{detail.data.resena.comentario}</p>{detail.data.resena.respuestaNegocio && <p className="mt-2 break-words text-muted-foreground">Respuesta del negocio: {detail.data.resena.respuestaNegocio}</p>}</section>
          {detail.data.motivoDecision && <section className="rounded-lg border p-3 text-sm"><p className="font-medium">Motivo de la decisión</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{detail.data.motivoDecision}</p></section>}
          <section className="space-y-3 border-l pl-3">{detail.data.eventos.map((event) => <div key={event.id} className="space-y-1 text-sm"><p className="font-medium">{eventLabels[event.tipo] ?? "Actualización"}</p>{event.mensaje && <p className="whitespace-pre-wrap break-words text-muted-foreground">{event.mensaje}</p>}<p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("es-AR")}</p><EvidenceList solicitudId={detail.data.id} eventId={event.id} evidencias={event.evidencias} /></div>)}</section>
          {active && <div className="flex flex-wrap gap-2">{detail.data.estado === "PENDIENTE" && <Button disabled={mutate.isPending} onClick={() => mutate.mutate({ kind: "TOMAR_EN_REVISION" })}><ShieldCheck className="mr-2 h-4 w-4" />Tomar revisión</Button>}<Button variant="outline" disabled={mutate.isPending} onClick={() => setAction("PEDIR_INFORMACION")}><MessageSquareWarning className="mr-2 h-4 w-4" />Pedir información</Button><Button variant="outline" disabled={mutate.isPending} onClick={() => setAction("APROBAR")}><Check className="mr-2 h-4 w-4" />Aprobar solicitud</Button><Button variant="destructive" disabled={mutate.isPending} onClick={() => setAction("RECHAZAR")}><X className="mr-2 h-4 w-4" />Rechazar solicitud</Button></div>}
          {terminal.has(detail.data.estado) && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Este expediente es terminal; no admite más acciones.</p>}
        </div>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!action} onOpenChange={(isOpen) => { if (!isOpen) { setAction(null); setText("") } }}><DialogContent><DialogHeader><DialogTitle>{action === "PEDIR_INFORMACION" ? "Pedir información" : action === "APROBAR" ? "Aprobar solicitud" : "Rechazar solicitud"}</DialogTitle><DialogDescription>{action === "APROBAR" ? "La reseña dejará de publicarse." : action === "RECHAZAR" ? "La reseña volverá a publicarse." : "El negocio verá este pedido dentro de su expediente."}</DialogDescription></DialogHeader><Label htmlFor="moderation-action-text">{action === "PEDIR_INFORMACION" ? "Información requerida" : "Motivo de la decisión"}</Label><Textarea id="moderation-action-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} className="min-h-28" /><p className="text-xs text-muted-foreground">{text.length}/2000</p><Button disabled={!text.trim() || mutate.isPending} onClick={() => mutate.mutate({ kind: action!, value: text.trim() })}>{mutate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar</Button></DialogContent></Dialog>
  </div>
}

function EvidenceList({ solicitudId, eventId, evidencias }: { solicitudId: string; eventId: string; evidencias: Evidence[] }) {
  if (!evidencias.length) return null
  return <div className="space-y-2 pt-1">{evidencias.map((evidencia) => {
    const item = evidenceTimelineEntry("superadmin", solicitudId, eventId, evidencia)
    return <div key={evidencia.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded border bg-muted/30 p-2"><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-all text-xs">{item.nombre} · {item.tamano} · {item.tipo}</span><a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={item.descarga} aria-label={`Descargar ${item.nombre}`}>Descargar</a></div>
  })}</div>
}
