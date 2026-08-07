"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AlertCircle, FileText, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getBusinessModerationEventLabel, getBusinessModerationStatusCopy, type BusinessReviewModerationStatus } from "@/lib/review-moderation-business-ui"

type Moderacion = {
  id: string
  estado: BusinessReviewModerationStatus
  motivo: string
  venceEn: string
  resueltaEn: string | null
  motivoDecision: string | null
}

type Review = { id: string; comentario: string; moderacion: Moderacion | null }
type History = {
  solicitudes: Array<Moderacion & {
    explicacionOriginal: string
    createdAt: string
    updatedAt: string
    eventos: Array<{ tipo: string; actorTipo: string; mensaje: string | null; createdAt: string }>
  }>
}

const reasons = [
  ["FALSA", "Información falsa o que no corresponde"],
  ["ILEGAL", "Contenido ilegal"],
  ["OFENSIVA", "Contenido ofensivo"],
  ["DISCRIMINATORIA", "Contenido discriminatorio"],
  ["OTRA_INFRACCION", "Otra infracción"],
] as const

export function ReviewModerationDialog({ review, mode, open, onOpenChange, onChanged }: {
  review: Review | null
  mode: "create" | "history"
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const [reason, setReason] = useState<string>("FALSA")
  const [explanation, setExplanation] = useState("")
  const [information, setInformation] = useState("")
  const history = useQuery<History>({
    queryKey: ["negocio-review-moderation-history", review?.id],
    enabled: open && mode === "history" && !!review,
    queryFn: async () => {
      const response = await fetch(`/api/negocio/resenas/${encodeURIComponent(review!.id)}/solicitudes-revision`)
      if (!response.ok) throw new Error("No se pudo cargar el seguimiento")
      return response.json()
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/negocio/resenas/${encodeURIComponent(review!.id)}/solicitudes-revision`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: reason, explicacion: explanation.trim() }),
      })
      if (!response.ok) throw new Error(String(response.status))
    },
    onSuccess: () => { toast.success("Solicitud enviada. La reseña queda temporalmente oculta mientras se revisa."); onChanged(); onOpenChange(false) },
    onError: (error) => { toast.error(error.message === "409" ? "La reseña cambió. Actualizamos su estado." : error.message === "429" ? "Alcanzaste el límite temporal." : "No se pudo enviar la solicitud.") },
  })

  const additionalInformation = useMutation({
    mutationFn: async (solicitudId: string) => {
      const response = await fetch(`/api/negocio/solicitudes-revision-resenas/${encodeURIComponent(solicitudId)}/informacion-adicional`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensaje: information.trim() }),
      })
      if (!response.ok) throw new Error(String(response.status))
    },
    onSuccess: () => { toast.success("Información enviada. La solicitud volvió a revisión."); setInformation(""); history.refetch(); onChanged() },
    onError: (error) => toast.error(error.message === "409" ? "La solicitud cambió. Actualizamos su estado." : error.message === "429" ? "Alcanzaste el límite temporal." : "No se pudo enviar la información."),
  })

  const latest = useMemo(() => history.data?.solicitudes.at(-1) ?? null, [history.data])
  if (!review) return null

  return <Dialog open={open} onOpenChange={(nextOpen) => {
    if (!nextOpen) { setExplanation(""); setInformation("") }
    onOpenChange(nextOpen)
  }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5 sm:max-w-xl">
      {mode === "create" ? <>
        <DialogHeader>
          <DialogTitle>Solicitar revisión</DialogTitle>
          <DialogDescription>Explicá por qué esta reseña debería ser revisada. La decisión la toma el equipo de moderación.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="moderation-reason">Motivo</Label><Select value={reason} onValueChange={setReason}><SelectTrigger id="moderation-reason"><SelectValue /></SelectTrigger><SelectContent>{reasons.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><div className="flex justify-between gap-2"><Label htmlFor="moderation-explanation">Explicación</Label><span className="text-xs text-muted-foreground">{explanation.length}/2000</span></div><Textarea id="moderation-explanation" value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={2000} className="min-h-28 resize-y" placeholder="Contanos el contexto para revisar la reseña." /></div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={create.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" disabled={!explanation.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar solicitud</Button>
          </div>
        </div>
      </> : <>
        <DialogHeader><DialogTitle>Seguimiento de moderación</DialogTitle><DialogDescription>Expediente de revisión de esta reseña. No muestra información interna del equipo.</DialogDescription></DialogHeader>
        {history.isLoading ? <p className="text-sm text-muted-foreground">Cargando seguimiento…</p> : history.isError ? <p className="text-sm text-destructive">No se pudo cargar el seguimiento.</p> : <div className="space-y-5">
          {history.data?.solicitudes.map((solicitud) => {
            const copy = getBusinessModerationStatusCopy(solicitud.estado)
            const requestedInformation = solicitud.eventos.filter((event) => event.tipo === "INFORMACION_REQUERIDA").at(-1)?.mensaje
            return <section key={solicitud.id} className="space-y-3 rounded-xl border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{copy.label}</Badge><span className="text-xs text-muted-foreground">{new Date(solicitud.createdAt).toLocaleDateString("es-AR")}</span></div>
              <p className="text-sm text-muted-foreground">{copy.description}</p>
              <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Motivo: {reasons.find(([value]) => value === solicitud.motivo)?.[1] ?? solicitud.motivo}</p><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{solicitud.explicacionOriginal}</p></div>
              {solicitud.motivoDecision && <div className="rounded-lg border border-primary/20 p-3 text-sm"><p className="font-medium">Motivo de la decisión</p><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{solicitud.motivoDecision}</p></div>}
              {solicitud.estado === "REQUIERE_INFORMACION" && <div className="space-y-2 rounded-lg border border-amber-400/40 bg-amber-50/50 p-3 dark:bg-amber-950/20"><div className="flex gap-2 text-sm font-medium"><AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />Se necesita información adicional</div>{requestedInformation && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{requestedInformation}</p>}<Label htmlFor={`information-${solicitud.id}`}>Información adicional</Label><Textarea id={`information-${solicitud.id}`} value={information} onChange={(event) => setInformation(event.target.value)} maxLength={2000} className="min-h-24 resize-y" placeholder="Aportá el contexto solicitado." /><div className="flex justify-end"><Button size="sm" disabled={!information.trim() || additionalInformation.isPending} onClick={() => additionalInformation.mutate(solicitud.id)}>{additionalInformation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1.5 h-3.5 w-3.5" />Enviar información</>}</Button></div></div>}
              <div className="space-y-2 border-l pl-3">{solicitud.eventos.map((event, index) => <div key={`${event.createdAt}-${index}`} className="text-sm"><p className="font-medium">{getBusinessModerationEventLabel(event.tipo)}</p>{event.mensaje && <p className="text-muted-foreground whitespace-pre-wrap">{event.mensaje}</p>}<p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("es-AR")}</p></div>)}</div>
            </section>
          })}
          {!latest && <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground"><FileText className="h-4 w-4" />Todavía no hay solicitudes para esta reseña.</div>}
        </div>}
      </>}
    </DialogContent>
  </Dialog>
}
