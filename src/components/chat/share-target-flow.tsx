"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileText, ImageIcon, Loader2, CheckCircle2, AlertTriangle, Send, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/shared/logo"
import { cn, statusLabel, statusEmoji, timeAgo } from "@/lib/utils"
import { toast } from "sonner"
import { getPendingShare, deletePendingShare, type PendingShare } from "@/lib/share-target-store"

// ============================================
// Bugfix-4C: flujo común de "recibir comprobante compartido desde una app
// externa" para las 3 PWA con chat (Cliente, Negocio, Operaciones).
// ============================================
// Nunca envía nada automáticamente: siempre requiere que el usuario elija un
// chat/pedido exacto y confirme explícitamente. El archivo compartido vive
// solo en IndexedDB del navegador (ver src/lib/share-target-store.ts y el
// handler duplicado en public/sw.js) hasta ese momento.

type Role = "cliente" | "negocio" | "operaciones"

interface ChatTarget {
  pedidoId: string
  label: string
  sublabel: string
}

type Phase =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "rejected" }
  | { kind: "missing" }
  | { kind: "ready"; share: PendingShare; targets: ChatTarget[] }
  | { kind: "no-session" }
  | { kind: "error" }
  | { kind: "sending"; share: PendingShare; pedidoId: string }
  | { kind: "sent"; pedidoId: string }

const MAX_TARGETS = 50

async function loadTargets(role: Role): Promise<{ ok: true; targets: ChatTarget[] } | { ok: false; noSession: boolean }> {
  if (role === "operaciones") {
    const res = await fetch("/api/operaciones/pyr/mensajes", { cache: "no-store" })
    if (res.status === 401) return { ok: false, noSession: true }
    if (!res.ok) return { ok: false, noSession: false }
    const data = await res.json().catch(() => null)
    if (!data || !data.ok || !Array.isArray(data.pedidos)) return { ok: false, noSession: false }
    const targets: ChatTarget[] = data.pedidos.slice(0, MAX_TARGETS).map((p: { id: string; clienteNombre: string | null; estado: string; fecha: string }) => ({
      pedidoId: p.id,
      label: p.clienteNombre || "Cliente",
      sublabel: `${statusEmoji(p.estado)} ${statusLabel(p.estado)} · ${timeAgo(new Date(p.fecha))}`,
    }))
    return { ok: true, targets }
  }

  // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito de
  // familia — mismo transporte ?actorFamily= ya certificado en Fase 2,
  // requerido para que /api/chat/conversaciones resuelva sin ambigüedad
  // bajo 2+ cookies de familia coexistiendo. `role` es "cliente"/"negocio"
  // en este punto (la rama "operaciones" ya retornó arriba).
  const res = await fetch(`/api/chat/conversaciones?actorFamily=${role}`, { cache: "no-store" })
  if (res.status === 401) return { ok: false, noSession: true }
  if (!res.ok) return { ok: false, noSession: false }
  const data = await res.json().catch(() => null)
  if (!data || !Array.isArray(data.conversations)) return { ok: false, noSession: false }
  const targets: ChatTarget[] = data.conversations.slice(0, MAX_TARGETS).map((c: {
    pedidoId: string
    negocioNombre: string
    clienteNombre: string
    estado: string
    fecha: string
  }) => ({
    pedidoId: c.pedidoId,
    label: role === "cliente" ? c.negocioNombre : c.clienteNombre,
    sublabel: `${statusEmoji(c.estado)} ${statusLabel(c.estado)} · ${timeAgo(new Date(c.fecha))}`,
  }))
  return { ok: true, targets }
}

async function sendToTarget(role: Role, pedidoId: string, share: PendingShare): Promise<{ ok: true } | { ok: false; error: string }> {
  const isPdf = share.type === "application/pdf"
  const file = new File([share.blob], share.name, { type: share.type })

  if (role === "operaciones") {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch(`/api/operaciones/pyr/mensajes/${encodeURIComponent(pedidoId)}/adjunto`, {
      method: "POST",
      cache: "no-store",
      body: formData,
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => null)
    return { ok: false, error: data?.error || "No se pudo enviar el archivo." }
  }

  // Cliente / Negocio: mismo flujo de dos pasos que ya usa ChatView.
  const uploadForm = new FormData()
  uploadForm.append("file", file)
  uploadForm.append("category", "chat")
  uploadForm.append("slug", pedidoId)
  uploadForm.append("type", isPdf ? "file" : "image")

  const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm })
  if (!uploadRes.ok) {
    const data = await uploadRes.json().catch(() => null)
    return { ok: false, error: data?.error || "No se pudo subir el archivo." }
  }
  const uploadData = await uploadRes.json().catch(() => null)
  if (!uploadData?.url) return { ok: false, error: "No se pudo subir el archivo." }

  const body: Record<string, string> = isPdf
    ? { archivoUrl: uploadData.url, archivoNombre: share.name, archivoTipo: "application/pdf" }
    : { imagenUrl: uploadData.url }

  // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito de
  // familia — mismo transporte ?actorFamily= ya certificado en Fase 2,
  // requerido para que POST /api/chat/mensajes/[pedidoId] resuelva sin
  // ambigüedad bajo 2+ cookies de familia coexistiendo.
  const msgRes = await fetch(`/api/chat/mensajes/${encodeURIComponent(pedidoId)}?actorFamily=${role}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!msgRes.ok) {
    const data = await msgRes.json().catch(() => null)
    return { ok: false, error: data?.error || "No se pudo enviar el mensaje." }
  }
  return { ok: true }
}

export function ShareTargetFlow({ role }: { role: Role }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const shareToken = searchParams.get("share")
      const unsupported = searchParams.get("unsupported") === "1"
      const rejected = searchParams.get("rejected") === "1"

      if (unsupported) {
        if (!cancelled) setPhase({ kind: "unsupported" })
        return
      }
      if (rejected) {
        if (!cancelled) setPhase({ kind: "rejected" })
        return
      }
      if (!shareToken) {
        if (!cancelled) setPhase({ kind: "missing" })
        return
      }

      const share = await getPendingShare(shareToken)
      if (cancelled) return
      if (!share) {
        setPhase({ kind: "missing" })
        return
      }

      const result = await loadTargets(role)
      if (cancelled) return
      if (!result.ok) {
        setPhase(result.noSession ? { kind: "no-session" } : { kind: "error" })
        return
      }

      setPhase({ kind: "ready", share, targets: result.targets })
    }

    run()

    return () => {
      cancelled = true
    }
  }, [role, searchParams])

  const handleConfirm = async () => {
    if (phase.kind !== "ready" || !selectedPedidoId) return
    const { share } = phase
    setPhase({ kind: "sending", share, pedidoId: selectedPedidoId })

    try {
      const result = await sendToTarget(role, selectedPedidoId, share)
      if (!result.ok) {
        toast.error(result.error)
        setPhase({ kind: "ready", share, targets: (phase as Extract<Phase, { kind: "ready" }>).targets })
        return
      }
      await deletePendingShare(share.token)
      toast.success("Comprobante enviado")
      setPhase({ kind: "sent", pedidoId: selectedPedidoId })
    } catch {
      toast.error("No se pudo enviar el archivo. Intentá de nuevo.")
      setPhase({ kind: "ready", share, targets: (phase as Extract<Phase, { kind: "ready" }>).targets })
    }
  }

  const goToChat = (pedidoId: string) => {
    if (role === "operaciones") {
      router.push(`/operaciones/pyr/mensajes/${pedidoId}`)
    } else {
      // Bugfix-4A: el ChatProvider global ya sabe abrir el chat exacto
      // cuando la URL trae `?chat=<pedidoId>`.
      router.push(`/${role}?chat=${pedidoId}`)
    }
  }

  return (
    <main className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-sm font-semibold">Adjuntar comprobante</span>
        </div>
      </header>

      <div className="flex-1 max-w-lg w-full mx-auto px-4 py-6">
        {phase.kind === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando…</p>
          </div>
        )}

        {(phase.kind === "unsupported" || phase.kind === "missing") && (
          <FallbackMessage
            title={phase.kind === "unsupported" ? "No se pudo recibir el archivo compartido" : "No hay ningún archivo para adjuntar"}
            description={
              phase.kind === "unsupported"
                ? "Tu dispositivo no permite compartir archivos directamente hacia esta app. Abrí el chat correspondiente y usá el botón Adjuntar comprobante."
                : "El enlace compartido ya no está disponible (puede haber vencido). Abrí el chat correspondiente y usá el botón Adjuntar comprobante."
            }
          />
        )}

        {phase.kind === "rejected" && (
          <FallbackMessage
            title="Ese archivo no se puede compartir"
            description="Solo se aceptan PDF, JPG, PNG o WEBP, hasta 10MB (imágenes) o 5MB (PDF). Probá compartir de nuevo con un archivo permitido, o adjuntalo manualmente desde el chat."
          />
        )}

        {phase.kind === "no-session" && (
          <FallbackMessage
            title="Iniciá sesión para continuar"
            description="Necesitás iniciar sesión en DeliGO para elegir un chat y enviar el comprobante."
          />
        )}

        {phase.kind === "error" && (
          <FallbackMessage
            title="No se pudo cargar tus chats"
            description="Revisá tu conexión e intentá de nuevo, o adjuntá el archivo manualmente desde el chat."
          />
        )}

        {(phase.kind === "ready" || phase.kind === "sending") && (
          <div className="space-y-4">
            <FilePreviewCard share={phase.share} />

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                El archivo todavía no fue enviado. Elegí el chat exacto y confirmá.
              </p>
            </div>

            {phase.kind === "ready" && phase.targets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No tenés chats disponibles en este momento.
              </p>
            )}

            {phase.kind === "ready" && phase.targets.length > 0 && (
              <RadioGroup value={selectedPedidoId ?? undefined} onValueChange={setSelectedPedidoId}>
                <div className="space-y-2">
                  {phase.targets.map((target) => (
                    <Label
                      key={target.pedidoId}
                      htmlFor={`target-${target.pedidoId}`}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                        selectedPedidoId === target.pedidoId ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/40"
                      )}
                    >
                      <RadioGroupItem value={target.pedidoId} id={`target-${target.pedidoId}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{target.label}</p>
                        <p className="text-xs text-muted-foreground">{target.sublabel}</p>
                      </div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            )}

            <Button
              className="w-full rounded-xl gap-2 font-semibold"
              disabled={!selectedPedidoId || phase.kind === "sending"}
              onClick={handleConfirm}
            >
              {phase.kind === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar al chat seleccionado
            </Button>
          </div>
        )}

        {phase.kind === "sent" && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold">Comprobante enviado</p>
            <Button className="rounded-xl gap-2 font-semibold" onClick={() => goToChat(phase.pedidoId)}>
              Ir al chat
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}

function FallbackMessage({ title, description }: { title: string; description: string }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <p className="text-sm font-semibold max-w-xs">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      <Button variant="outline" className="rounded-xl gap-2 font-semibold" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>
    </div>
  )
}

function FilePreviewCard({ share }: { share: PendingShare }) {
  const isPdf = share.type === "application/pdf"
  const sizeLabel = share.size >= 1024 * 1024
    ? `${(share.size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(share.size / 1024))} KB`

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          {isPdf ? <FileText className="h-5 w-5 text-primary" /> : <ImageIcon className="h-5 w-5 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{share.name}</p>
          <p className="text-xs text-muted-foreground">{isPdf ? "PDF" : "Imagen"} · {sizeLabel}</p>
        </div>
      </CardContent>
    </Card>
  )
}
