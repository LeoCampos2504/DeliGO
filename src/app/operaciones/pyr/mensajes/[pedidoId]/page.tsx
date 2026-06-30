"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Bike,
  Package,
  Paperclip,
  Send,
  ShieldAlert,
  WifiOff,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Mismo tope que la API (texto plano).
const MAX_TEXTO_LEN = 2000

// ============================================
// Tipos (espejo del endpoint seguro de mensajes)
// ============================================
interface Mensaje {
  id: string
  remitente: "cliente" | "vendedor"
  texto: string | null
  fecha: string
  tieneAdjunto: boolean
}

interface PedidoInfo {
  clienteNombre: string | null
  estado: string
  metodoEntrega: string
}

interface PanelData {
  terminal: { nombre: string }
  negocio: { nombre: string; colorPrincipal: string }
  pedido: PedidoInfo
  capacidades: { puedeResponderMensajes: boolean }
  mensajes: Mensaje[]
}

type Phase =
  | { kind: "loading" }
  | { kind: "no-session" }
  | { kind: "no-permission" }
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "ready"; data: PanelData; stale: boolean }

const ESTADO_LABELS: Record<string, string> = {
  recibido: "Recibido",
  preparando: "Preparando",
  en_camino: "En camino",
  listo_para_retirar: "Listo para retirar",
}

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

// ============================================
// Página
// ============================================
export default function OperacionesPyRMensajesPage() {
  const params = useParams()
  const pedidoId = typeof params.pedidoId === "string" ? params.pedidoId : ""

  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  const stoppedRef = useRef(false)
  const acRef = useRef<AbortController | null>(null)
  const genRef = useRef(0)
  const sendingRef = useRef(false)

  const applyTransientError = useCallback(() => {
    setPhase((prev) => (prev.kind === "ready" ? { ...prev, stale: true } : { kind: "error" }))
  }, [])

  const refresh = useCallback(async () => {
    if (stoppedRef.current || !pedidoId) return
    // Nunca disparar un request con la pestaña oculta (p.ej. refresh posterior a una
    // mutación cuando el usuario ya cambió de pestaña). La mutación en curso no se altera.
    if (document.visibilityState !== "visible") return
    acRef.current?.abort()
    const ac = new AbortController()
    acRef.current = ac
    const gen = ++genRef.current

    try {
      const res = await fetch(`/api/operaciones/pyr/mensajes/${encodeURIComponent(pedidoId)}`, {
        cache: "no-store",
        signal: ac.signal,
      })
      if (gen !== genRef.current) return

      if (res.status === 401) {
        stoppedRef.current = true
        setPhase({ kind: "no-session" })
        return
      }
      if (res.status === 403) {
        stoppedRef.current = true
        setPhase({ kind: "no-permission" })
        return
      }
      if (res.status === 409) {
        stoppedRef.current = true
        setPhase({ kind: "unavailable" })
        return
      }
      if (!res.ok) {
        applyTransientError()
        return
      }

      const data = await res.json().catch(() => null)
      if (gen !== genRef.current) return
      if (!data || !data.ok || !data.negocio || !data.terminal || !data.pedido) {
        applyTransientError()
        return
      }

      setPhase({
        kind: "ready",
        data: {
          terminal: { nombre: data.terminal.nombre },
          negocio: {
            nombre: data.negocio.nombre,
            colorPrincipal: data.negocio.colorPrincipal || "#FB8C00",
          },
          pedido: {
            clienteNombre: data.pedido.clienteNombre ?? null,
            estado: data.pedido.estado,
            metodoEntrega: data.pedido.metodoEntrega,
          },
          capacidades: { puedeResponderMensajes: data.capacidades?.puedeResponderMensajes === true },
          mensajes: Array.isArray(data.mensajes) ? data.mensajes : [],
        },
        stale: false,
      })
      setLastUpdated(Date.now())
    } catch {
      if (ac.signal.aborted) return
      if (gen !== genRef.current) return
      applyTransientError()
    }
  }, [applyTransientError, pedidoId])

  const handleSend = useCallback(
    async (texto: string): Promise<boolean> => {
      if (sendingRef.current) return false
      sendingRef.current = true
      setSending(true)
      try {
        const res = await fetch(`/api/operaciones/pyr/mensajes/${encodeURIComponent(pedidoId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ texto }),
        })

        if (res.status === 401) {
          stoppedRef.current = true
          setPhase({ kind: "no-session" })
          return false
        }
        if (res.status === 403) {
          toast.error("Esta terminal no tiene permiso para realizar esa acción.")
          await refresh()
          return false
        }
        if (res.status === 409) {
          toast.error("Este pedido ya no está disponible para mensajes.")
          stoppedRef.current = true
          setPhase({ kind: "unavailable" })
          return false
        }
        if (res.status === 429) {
          toast.error("Demasiados intentos. Esperá un momento.")
          return false
        }
        if (res.status === 400) {
          toast.error("El mensaje no es válido. Revisá e intentá de nuevo.")
          return false
        }
        if (!res.ok) {
          toast.error("No se pudo enviar el mensaje. Intentá de nuevo.")
          return false
        }
        const data = await res.json().catch(() => null)
        if (!data || !data.ok) {
          toast.error("No se pudo enviar el mensaje. Intentá de nuevo.")
          return false
        }

        toast.success("Mensaje enviado")
        await refresh()
        return true
      } catch {
        toast.error("No se pudo enviar el mensaje. Intentá de nuevo.")
        return false
      } finally {
        sendingRef.current = false
        setSending(false)
      }
    },
    [pedidoId, refresh]
  )

  // Sin polling. Carga al abrir (solo si visible) + foco/visibilidad.
  useEffect(() => {
    if (document.visibilityState === "visible") void refresh()

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      acRef.current?.abort()
    }
  }, [refresh])

  if (phase.kind === "loading") {
    return (
      <CenteredShell>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando mensajes…</p>
      </CenteredShell>
    )
  }

  if (phase.kind === "no-session") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta terminal no está vinculada o su sesión ya no está vigente.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href="/operaciones">
            <ArrowLeft className="h-4 w-4" />
            Volver a Operaciones
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  if (phase.kind === "no-permission") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta terminal no tiene permiso para acceder a Mensajes.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href="/operaciones/pyr">
            <ArrowLeft className="h-4 w-4" />
            Volver a Pedidos y reseñas
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  if (phase.kind === "unavailable") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <MessageSquare className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Este pedido ya no está disponible para mensajes.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href="/operaciones/pyr">
            <ArrowLeft className="h-4 w-4" />
            Volver a Pedidos y reseñas
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  if (phase.kind === "error") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <WifiOff className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          No se pudieron cargar los mensajes. Revisá la conexión e intentá de nuevo.
        </p>
        <Button className="rounded-xl gap-2 font-semibold" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </CenteredShell>
    )
  }

  return (
    <MensajesView
      data={phase.data}
      stale={phase.stale}
      lastUpdated={lastUpdated}
      sending={sending}
      onRefresh={refresh}
      onSend={handleSend}
    />
  )
}

// ============================================
// Vista principal de mensajes
// ============================================
function MensajesView({
  data,
  stale,
  lastUpdated,
  sending,
  onRefresh,
  onSend,
}: {
  data: PanelData
  stale: boolean
  lastUpdated: number | null
  sending: boolean
  onRefresh: () => void
  onSend: (texto: string) => Promise<boolean>
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [texto, setTexto] = useState("")

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const handleSend = async () => {
    const value = texto.trim()
    if (!value || sending) return
    const ok = await onSend(value)
    if (ok) setTexto("")
  }

  const isDelivery = data.pedido.metodoEntrega === "domicilio"
  const EntregaIcon = isDelivery ? Bike : Package

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
            <Link href="/operaciones/pyr" aria-label="Volver a Pedidos y reseñas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Mensajes
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {data.negocio.nombre} · {data.terminal.nombre}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 h-9 text-xs shrink-0"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Actualizar ahora</span>
          </Button>
        </div>
        {/* Sub-encabezado del pedido */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex items-center gap-2 flex-wrap">
          <Badge className="text-[10px] h-5 px-1.5 border-0 bg-primary/10 text-primary gap-1">
            <EntregaIcon className="h-3 w-3" />
            {isDelivery ? "Delivery" : "Retiro"}
          </Badge>
          <Badge className="text-[10px] h-5 px-1.5 border-0 bg-muted text-foreground">
            {ESTADO_LABELS[data.pedido.estado] ?? data.pedido.estado}
          </Badge>
          {data.pedido.clienteNombre && (
            <span className="text-xs text-muted-foreground">{data.pedido.clienteNombre}</span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
            {stale ? (
              <>
                <WifiOff className="h-3 w-3 text-amber-500" /> Sin actualizar
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {lastUpdated ? `Hace ${getTimeAgo(new Date(lastUpdated).toISOString())}` : "En vivo"}
              </>
            )}
          </span>
        </div>
      </header>

      {/* Mensajes */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 space-y-2 overflow-y-auto">
        {data.mensajes.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">Sin mensajes</p>
            <p className="text-xs text-muted-foreground mt-0.5">Todavía no hay mensajes en este pedido.</p>
          </div>
        ) : (
          data.mensajes.map((m) => <Burbuja key={m.id} mensaje={m} />)
        )}
      </div>

      {/* Compositor — solo con permiso de respuesta */}
      {data.capacidades.puedeResponderMensajes && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border/50">
          <div className="max-w-3xl mx-auto px-4 py-3 space-y-1.5">
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={MAX_TEXTO_LEN}
                rows={1}
                placeholder="Escribí un mensaje…"
                disabled={sending}
                className="flex-1 px-3 py-2 rounded-xl text-sm border border-border/50 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[40px] max-h-32"
              />
              <Button
                className="rounded-xl gap-1.5 h-10 shrink-0"
                disabled={sending || !texto.trim()}
                onClick={handleSend}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">Enviar</span>
              </Button>
            </div>
            <div className="flex justify-end">
              <span className="text-[10px] text-muted-foreground">
                {texto.length}/{MAX_TEXTO_LEN}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ============================================
// Subcomponentes
// ============================================
function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center text-center gap-3">{children}</div>
    </main>
  )
}

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  const esNegocio = mensaje.remitente === "vendedor"
  return (
    <div className={cn("flex", esNegocio ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          esNegocio
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {mensaje.texto && <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>}
        {mensaje.tieneAdjunto && (
          <p
            className={cn(
              "text-[11px] italic flex items-center gap-1 mt-0.5",
              esNegocio ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            <Paperclip className="h-3 w-3" />
            Mensaje con adjunto no disponible en esta terminal
          </p>
        )}
        <p
          className={cn(
            "text-[10px] mt-0.5 text-right",
            esNegocio ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatTime(mensaje.fecha)}
        </p>
      </div>
    </div>
  )
}
