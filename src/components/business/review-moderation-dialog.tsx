"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AlertCircle, FileText, Loader2, Paperclip, Send, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getBusinessModerationEventLabel, getBusinessModerationStatusCopy, type BusinessReviewModerationStatus } from "@/lib/review-moderation-business-ui"
import { addEvidenceSelection, evidenceTimelineEntry, formatEvidenceBytes, submitInformationWithEvidence, uploadEvidenceSequentially } from "@/lib/review-moderation-evidence-ui"

type Moderacion = {
  id: string
  estado: BusinessReviewModerationStatus
  motivo: string
  venceEn: string
  resueltaEn: string | null
  motivoDecision: string | null
}
type Evidence = { id: string; nombrePresentacion: string; mimeType: string; bytes: number; createdAt: string }
type Event = { id: string; tipo: string; actorTipo: string; mensaje: string | null; createdAt: string; evidencias: Evidence[] }
type Review = { id: string; comentario: string; moderacion: Moderacion | null }
type History = { solicitudes: Array<Moderacion & { explicacionOriginal: string; createdAt: string; updatedAt: string; eventos: Event[] }> }

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
  const [createFiles, setCreateFiles] = useState<File[]>([])
  const [informationFiles, setInformationFiles] = useState<File[]>([])
  const [retryFiles, setRetryFiles] = useState<Record<string, File[]>>({})
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null)

  const history = useQuery<History>({
    queryKey: ["negocio-review-moderation-history", review?.id],
    enabled: open && mode === "history" && !!review,
    queryFn: async () => {
      const response = await fetch(`/api/negocio/resenas/${encodeURIComponent(review!.id)}/solicitudes-revision`)
      if (!response.ok) throw new Error("No se pudo cargar el seguimiento")
      return response.json()
    },
  })

  const selectFiles = (files: FileList | null, current: File[], setFiles: (files: File[]) => void) => {
    const result = addEvidenceSelection(current, files ? Array.from(files) : [])
    if (result.error) {
      setUploadWarning(result.error)
      return
    }
    setFiles(result.files)
  }

  const uploadToEvent = async (solicitudId: string, eventoId: string, files: File[]) => {
    setUploadWarning(null)
    const result = await uploadEvidenceSequentially(files, async (file) => {
      const form = new FormData()
      form.set("archivo", file)
      const response = await fetch(`/api/negocio/solicitudes-revision-resenas/${encodeURIComponent(solicitudId)}/eventos/${encodeURIComponent(eventoId)}/evidencias`, { method: "POST", body: form })
      if (!response.ok) throw new Error("upload")
    }, (completed, total) => setUploadStatus(`Subiendo evidencia ${completed} de ${total}`))
    setUploadStatus(null)
    if (result.failed.length) setUploadWarning("El mensaje fue guardado, pero algunos adjuntos no se pudieron cargar. Podés reintentarlos sin duplicar los exitosos.")
    await history.refetch()
    return result
  }

  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/negocio/resenas/${encodeURIComponent(review!.id)}/solicitudes-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: reason, explicacion: explanation.trim() }),
      })
      if (!response.ok) throw new Error(String(response.status))
      return response.json() as Promise<{ solicitud: { id: string; eventoId: string } }>
    },
    onSuccess: async (data) => {
      const result = await uploadToEvent(data.solicitud.id, data.solicitud.eventoId, createFiles)
      setCreateFiles(result.failed)
      setRetryFiles((current) => ({ ...current, [data.solicitud.eventoId]: result.failed }))
      toast.success(result.failed.length ? "Solicitud enviada; quedaron adjuntos pendientes de reintento." : "Solicitud enviada. La reseña queda temporalmente oculta mientras se revisa.")
      onChanged()
      onOpenChange(false)
    },
    onError: (error: Error) => toast.error(error.message === "409" ? "La reseña cambió. Actualizamos su estado." : error.message === "429" ? "Alcanzaste el límite temporal." : "No se pudo enviar la solicitud."),
  })

  const additionalInformation = useMutation({
    mutationFn: async (solicitudId: string) => submitInformationWithEvidence(
      async () => {
        const response = await fetch(`/api/negocio/solicitudes-revision-resenas/${encodeURIComponent(solicitudId)}/informacion-adicional`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensaje: information.trim() }),
        })
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<{ eventoId: string }>
      },
      informationFiles,
      async (eventoId, file) => {
        const form = new FormData()
        form.set("archivo", file)
        const response = await fetch(`/api/negocio/solicitudes-revision-resenas/${encodeURIComponent(solicitudId)}/eventos/${encodeURIComponent(eventoId)}/evidencias`, { method: "POST", body: form })
        if (!response.ok) throw new Error("upload")
      },
      (completed, total) => setUploadStatus(`Subiendo evidencia ${completed} de ${total}`),
    ),
    onSuccess: async (result) => {
      setUploadStatus(null)
      setInformationFiles(result.failed)
      setRetryFiles((current) => ({ ...current, [result.eventoId]: result.failed }))
      setInformation("")
      if (result.failed.length) setUploadWarning("La información fue enviada, pero algunos adjuntos quedaron pendientes de reintento.")
      toast.success(result.failed.length ? "Información enviada; quedaron adjuntos pendientes." : "Información enviada. La solicitud volvió a revisión.")
      await history.refetch()
      onChanged()
    },
    onError: (error: Error) => {
      setUploadStatus(null)
      toast.error(error.message === "409" ? "La solicitud cambió. Actualizamos su estado." : error.message === "429" ? "Alcanzaste el límite temporal." : "No se pudo enviar la información.")
    },
  })

  const retry = useMutation({
    mutationFn: async ({ solicitudId, eventId, files }: { solicitudId: string; eventId: string; files: File[] }) => uploadToEvent(solicitudId, eventId, files),
    onSuccess: (result, variables) => {
      setRetryFiles((current) => ({ ...current, [variables.eventId]: result.failed }))
      if (!result.failed.length) toast.success("Evidencia adjuntada.")
    },
  })

  const latest = useMemo(() => history.data?.solicitudes.at(-1) ?? null, [history.data])
  if (!review) return null

  return <Dialog open={open} onOpenChange={(nextOpen) => {
    if (!nextOpen) {
      setExplanation("")
      setInformation("")
      setUploadWarning(null)
    }
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
          <EvidencePicker id="review-evidence-create" files={createFiles} onPick={(files) => selectFiles(files, createFiles, setCreateFiles)} onRemove={(index) => setCreateFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))} />
          <UploadNotice warning={uploadWarning} status={uploadStatus} />
          <div className="flex gap-2"><Button variant="outline" className="flex-1" disabled={create.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="flex-1" disabled={!explanation.trim() || create.isPending || !!uploadStatus} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar solicitud</Button></div>
        </div>
      </> : <>
        <DialogHeader><DialogTitle>Seguimiento de moderación</DialogTitle><DialogDescription>Expediente de revisión de esta reseña. No muestra información interna del equipo.</DialogDescription></DialogHeader>
        {history.isLoading ? <p className="text-sm text-muted-foreground">Cargando seguimiento…</p> : history.isError ? <p className="text-sm text-destructive">No se pudo cargar el seguimiento.</p> : <div className="space-y-5">
          <UploadNotice warning={uploadWarning} status={uploadStatus} />
          {history.data?.solicitudes.map((solicitud) => {
            const copy = getBusinessModerationStatusCopy(solicitud.estado)
            const requestedInformation = solicitud.eventos.filter((event) => event.tipo === "INFORMACION_REQUERIDA").at(-1)?.mensaje
            return <section key={solicitud.id} className="space-y-3 rounded-xl border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{copy.label}</Badge><span className="text-xs text-muted-foreground">{new Date(solicitud.createdAt).toLocaleDateString("es-AR")}</span></div>
              <p className="text-sm text-muted-foreground">{copy.description}</p>
              <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Motivo: {reasons.find(([value]) => value === solicitud.motivo)?.[1] ?? solicitud.motivo}</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{solicitud.explicacionOriginal}</p></div>
              {solicitud.motivoDecision && <div className="rounded-lg border border-primary/20 p-3 text-sm"><p className="font-medium">Motivo de la decisión</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{solicitud.motivoDecision}</p></div>}
              {solicitud.estado === "REQUIERE_INFORMACION" && <div className="space-y-3 rounded-lg border border-amber-400/40 bg-amber-50/50 p-3 dark:bg-amber-950/20"><div className="flex gap-2 text-sm font-medium"><AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />Se necesita información adicional</div>{requestedInformation && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{requestedInformation}</p>}<Label htmlFor={`information-${solicitud.id}`}>Información adicional</Label><Textarea id={`information-${solicitud.id}`} value={information} onChange={(event) => setInformation(event.target.value)} maxLength={2000} className="min-h-24 resize-y" placeholder="Aportá el contexto solicitado." /><EvidencePicker id={`review-evidence-info-${solicitud.id}`} files={informationFiles} onPick={(files) => selectFiles(files, informationFiles, setInformationFiles)} onRemove={(index) => setInformationFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))} /><div className="flex justify-end"><Button size="sm" disabled={!information.trim() || additionalInformation.isPending || !!uploadStatus} onClick={() => additionalInformation.mutate(solicitud.id)}>{additionalInformation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1.5 h-3.5 w-3.5" />Enviar información</>}</Button></div></div>}
              <div className="space-y-3 border-l pl-3">{solicitud.eventos.map((event) => <div key={event.id} className="space-y-1 text-sm"><p className="font-medium">{getBusinessModerationEventLabel(event.tipo)}</p>{event.mensaje && <p className="whitespace-pre-wrap break-words text-muted-foreground">{event.mensaje}</p>}<p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("es-AR")}</p><EvidenceList role="negocio" solicitudId={solicitud.id} eventId={event.id} evidencias={event.evidencias} />{solicitud.estado !== "APROBADA" && solicitud.estado !== "RECHAZADA" && solicitud.estado !== "RESTAURADA_AUTOMATICAMENTE" && event.actorTipo === "NEGOCIO" && <div className="rounded-md border border-dashed p-2"><EvidencePicker id={`review-evidence-retry-${event.id}`} compact files={retryFiles[event.id] ?? []} onPick={(files) => selectFiles(files, retryFiles[event.id] ?? [], (next) => setRetryFiles((current) => ({ ...current, [event.id]: next })))} onRemove={(index) => setRetryFiles((current) => ({ ...current, [event.id]: (current[event.id] ?? []).filter((_, currentIndex) => currentIndex !== index) }))} />{(retryFiles[event.id] ?? []).length > 0 && <Button type="button" className="mt-2" size="sm" disabled={retry.isPending || !!uploadStatus} onClick={() => retry.mutate({ solicitudId: solicitud.id, eventId: event.id, files: retryFiles[event.id] })}>{retry.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-1.5 h-3.5 w-3.5" />}Adjuntar evidencia</Button>}</div>}</div>)}</div>
            </section>
          })}
          {!latest && <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground"><FileText className="h-4 w-4" />Todavía no hay solicitudes para esta reseña.</div>}
        </div>}
      </>}
    </DialogContent>
  </Dialog>
}

function UploadNotice({ warning, status }: { warning: string | null; status: string | null }) {
  return <>{warning && <p role="alert" className="text-sm text-amber-700">{warning}</p>}{status && <p className="text-sm text-muted-foreground">{status}</p>}</>
}

function EvidencePicker({ id, files, onPick, onRemove, compact = false }: { id: string; files: File[]; onPick: (files: FileList | null) => void; onRemove: (index: number) => void; compact?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={id}>{compact ? "Adjuntar evidencia" : "Adjuntar evidencia"}</Label><input id={id} aria-describedby={`${id}-help`} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { onPick(event.currentTarget.files); event.currentTarget.value = "" }} /><p id={`${id}-help`} className="text-xs text-muted-foreground">JPG, PNG, WEBP o PDF. Máximo 5 archivos, 5 MB cada uno.</p>{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex min-w-0 flex-wrap items-center gap-2 rounded border p-2 text-sm"><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-all">{file.name} · {formatEvidenceBytes(file.size)}</span><Button type="button" variant="ghost" size="sm" aria-label={`Quitar ${file.name}`} onClick={() => onRemove(index)}><X className="h-4 w-4" />Quitar</Button></div>)}</div>
}

function EvidenceList({ role, solicitudId, eventId, evidencias }: { role: "negocio"; solicitudId: string; eventId: string; evidencias: Evidence[] }) {
  if (!evidencias.length) return null
  return <div className="space-y-2 pt-1">{evidencias.map((evidencia) => { const item = evidenceTimelineEntry(role, solicitudId, eventId, evidencia); return <div key={evidencia.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded border bg-muted/30 p-2"><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-all text-xs">{item.nombre} · {item.tamano} · {item.tipo}</span><a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={item.descarga} aria-label={`Descargar ${item.nombre}`}>Descargar</a></div> })}</div>
}
