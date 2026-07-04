"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  RefreshCw,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/shared/logo"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import { cn } from "@/lib/utils"
import {
  AttachmentPreviewModal,
  AttachmentUnavailableNotice,
  type AttachmentPreview,
} from "@/components/chat/attachment-preview-modal"

// ============================================
// DeliGO Operaciones — Panel personal de PyR: mensajes de un pedido (Operaciones UX-2)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal. Usa solo GET/POST
// /api/operativo/pyr/pedidos/[id]/mensajes?slug=... y, para adjuntos,
// GET /api/operativo/pyr/pedidos/[id]/mensajes/[messageId]/adjunto?slug=... (proxy
// autorizado — nunca la URL cruda de storage). No usa APIs de terminal ni de cuenta
// completa, no consulta módulos de Salón o Mozo. Única mutación: enviar un mensaje de
// texto como negocio (sin adjuntos desde el personal en esta etapa). Refresco automático
// estándar (1G.1): 15 s con pestaña visible + focus + visibilitychange, sin solapamiento,
// AbortController + guardia de generación contra respuestas fuera de orden. Sin
// actualización optimista: tras enviar, la conversación se vuelve a pedir al servidor.
// Scroll estable: solo se hace auto-scroll al final si el usuario ya estaba cerca del
// final antes del refresco (o es la carga inicial) — nunca se lo saca de donde está
// leyendo mensajes anteriores.

const MENSAJES_REFRESH_INTERVAL_MS = 15000
const MAX_TEXTO_LEN = 2000
const SCROLL_BOTTOM_THRESHOLD_PX = 80

interface AdjuntoInfo {
  disponible: true
  tipo: "imagen" | "pdf" | "archivo"
  nombre: string
}

interface Mensaje {
  id: string
  emisor: "cliente" | "negocio"
  contenido: string | null
  fecha: string
  adjunto: AdjuntoInfo | null
}

interface PedidoInfo {
  id: string
  estado: string
  metodoEntrega: string
  clienteNombre: string | null
}

interface MensajesData {
  pedido: PedidoInfo
  mensajes: Mensaje[]
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: MensajesData }
  | { status: "unavailable" }
  | { status: "error" }

const ESTADO_LABELS: Record<string, string> = {
  recibido: "Recibido",
  preparando: "Preparando",
  en_camino: "En camino",
  listo_para_retirar: "Listo para retirar",
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

function adjuntoHref(slug: string, pedidoId: string, mensajeId: string): string {
  const query = new URLSearchParams({ slug })
  return `/api/operativo/pyr/pedidos/${encodeURIComponent(pedidoId)}/mensajes/${encodeURIComponent(mensajeId)}/adjunto?${query.toString()}`
}

export default function PyRMensajesPage() {
  const params = useParams<{ slug: string; id: string }>()
  const router = useRouter()
  const nav = useOperativoNav()
  const slug = params.slug
  const pedidoId = params.id

  const [state, setState] = useState<PageState>({ status: "loading" })
  const [texto, setTexto] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AttachmentPreview>(null)

  const refreshAcRef = useRef<AbortController | null>(null)
  const refreshGenRef = useRef(0)
  const sendingRef = useRef(false)

  // Scroll estable: se guarda si el usuario estaba cerca del final ANTES de aplicar un
  // refresco, para decidir si corresponde auto-scroll al terminar de renderizar.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const wasNearBottomRef = useRef(true)
  const firstLoadRef = useRef(true)
  const lastMensajeIdRef = useRef<string | null>(null)

  const redirectToPersonalHomeAfterAreaLoss = useCallback(() => {
    refreshAcRef.current?.abort()
    refreshAcRef.current = null
    refreshGenRef.current += 1
    setState({ status: "loading" })
    router.replace(nav.homeHref)
  }, [router, nav.homeHref])

  const redirectToLoginAfterSessionLoss = useCallback(() => {
    refreshAcRef.current?.abort()
    refreshAcRef.current = null
    refreshGenRef.current += 1
    setState({ status: "loading" })
    router.replace(nav.loginHref)
  }, [router, nav.loginHref])

  const loadMensajes = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      if (silent && refreshAcRef.current) return
      refreshAcRef.current?.abort()
      const ac = new AbortController()
      refreshAcRef.current = ac
      const generation = ++refreshGenRef.current

      // Capturar si el usuario esta cerca del final ANTES de aplicar la nueva data.
      const el = scrollRef.current
      wasNearBottomRef.current = el
        ? el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD_PX
        : true

      if (!silent) setState({ status: "loading" })

      try {
        const query = new URLSearchParams({ slug })
        const res = await fetch(
          `/api/operativo/pyr/pedidos/${encodeURIComponent(pedidoId)}/mensajes?${query.toString()}`,
          { cache: "no-store", signal: ac.signal }
        )
        const data = await res.json().catch(() => ({}))
        if (generation !== refreshGenRef.current) return

        if (data.estado === "area_no_habilitada") {
          redirectToPersonalHomeAfterAreaLoss()
          return
        }
        if (res.status === 401 || data.estado === "sin_sesion") {
          redirectToLoginAfterSessionLoss()
          return
        }
        if (res.status === 403 || data.estado === "acceso_no_disponible") {
          setState({ status: "unavailable" })
          return
        }
        if (res.status === 404) {
          setState({ status: "unavailable" })
          return
        }
        if (!res.ok || !data.ok) {
          if (!silent) setState({ status: "error" })
          return
        }

        setState({
          status: "ready",
          data: {
            pedido: {
              id: data.pedido?.id ?? pedidoId,
              estado: data.pedido?.estado ?? "",
              metodoEntrega: data.pedido?.metodoEntrega ?? "",
              clienteNombre: data.pedido?.clienteNombre ?? null,
            },
            mensajes: Array.isArray(data.mensajes) ? data.mensajes : [],
          },
        })
      } catch {
        if (ac.signal.aborted || generation !== refreshGenRef.current) return
        if (!silent) setState({ status: "error" })
      } finally {
        if (refreshAcRef.current === ac) refreshAcRef.current = null
      }
    },
    [slug, pedidoId, redirectToPersonalHomeAfterAreaLoss, redirectToLoginAfterSessionLoss]
  )

  useEffect(() => {
    loadMensajes()
  }, [loadMensajes])

  // Refresco automático: 15 s (solo pestaña visible) + focus + visibilitychange.
  useEffect(() => {
    const silentRefresh = () => {
      if (document.visibilityState === "visible") void loadMensajes({ silent: true })
    }
    const interval = window.setInterval(silentRefresh, MENSAJES_REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") silentRefresh()
    }
    const onFocus = () => silentRefresh()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      refreshAcRef.current?.abort()
      refreshAcRef.current = null
      refreshGenRef.current += 1
    }
  }, [loadMensajes])

  // Auto-scroll al final SOLO si el usuario ya estaba cerca del final antes del refresco,
  // o es la carga inicial. Nunca lo saca de donde está leyendo mensajes anteriores.
  useEffect(() => {
    if (state.status !== "ready") return
    const mensajes = state.data.mensajes
    const lastId = mensajes.length > 0 ? mensajes[mensajes.length - 1].id : null
    if (lastId === lastMensajeIdRef.current && !firstLoadRef.current) return
    lastMensajeIdRef.current = lastId

    const shouldScroll = firstLoadRef.current || wasNearBottomRef.current
    firstLoadRef.current = false

    if (shouldScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [state])

  const handleSend = async () => {
    const value = texto.trim()
    if (!value || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setSendError(null)

    try {
      const query = new URLSearchParams({ slug })
      const res = await fetch(
        `/api/operativo/pyr/pedidos/${encodeURIComponent(pedidoId)}/mensajes?${query.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ mensaje: value }),
        }
      )
      const data = await res.json().catch(() => ({}))

      if (data.estado === "area_no_habilitada") {
        redirectToPersonalHomeAfterAreaLoss()
        return
      }
      if (res.status === 401 || data.estado === "sin_sesion") {
        redirectToLoginAfterSessionLoss()
        return
      }
      if (res.status === 403 || data.estado === "acceso_no_disponible" || res.status === 404) {
        setState({ status: "unavailable" })
        return
      }
      if (res.status === 429) {
        setSendError("Demasiados intentos. Esperá un momento.")
        return
      }
      if (!res.ok || !data.ok) {
        setSendError(data.error || "No se pudo enviar el mensaje.")
        return
      }

      // Sin actualización optimista: se limpia el borrador y se vuelve a pedir la
      // conversación completa al servidor.
      setTexto("")
      await loadMensajes({ silent: true })
    } catch {
      setSendError("No se pudo enviar el mensaje. Revisá la conexión.")
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  if (state.status === "loading") {
    return (
      <CenteredShell>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando mensajes…</p>
      </CenteredShell>
    )
  }

  if (state.status === "unavailable") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <MessageSquare className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Este pedido no está disponible para mensajes.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href={`/operaciones/mi-panel/${encodeURIComponent(slug)}/pyr/pedidos`}>
            <ArrowLeft className="h-4 w-4" />
            Volver a pedidos
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  if (state.status === "error") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          No se pudieron cargar los mensajes. Revisá la conexión e intentá de nuevo.
        </p>
        <Button className="rounded-xl gap-2 font-semibold" onClick={() => loadMensajes()}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
        <Button asChild variant="ghost" className="rounded-xl gap-2 text-muted-foreground">
          <Link href={`/operaciones/mi-panel/${encodeURIComponent(slug)}/pyr/pedidos`}>
            <ArrowLeft className="h-4 w-4" />
            Volver a pedidos
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  const { pedido, mensajes } = state.data
  const isDelivery = pedido.metodoEntrega === "domicilio"
  const EntregaIcon = isDelivery ? Bike : Package

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
            <Link
              href={`/operaciones/mi-panel/${encodeURIComponent(slug)}/pyr/pedidos`}
              aria-label="Volver a pedidos"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Mensajes del pedido
              </span>
            </div>
            {pedido.clienteNombre && (
              <p className="text-xs text-muted-foreground truncate">{pedido.clienteNombre}</p>
            )}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2 flex items-center gap-2 flex-wrap">
          <Badge className="text-[10px] h-5 px-1.5 border-0 bg-primary/10 text-primary gap-1">
            <EntregaIcon className="h-3 w-3" />
            {isDelivery ? "Domicilio" : "Retiro"}
          </Badge>
          <Badge className="text-[10px] h-5 px-1.5 border-0 bg-muted text-foreground">
            {ESTADO_LABELS[pedido.estado] ?? pedido.estado}
          </Badge>
        </div>
      </header>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 space-y-2 overflow-y-auto">
        {mensajes.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">Sin mensajes</p>
            <p className="text-xs text-muted-foreground mt-0.5">Todavía no hay mensajes en este pedido.</p>
          </div>
        ) : (
          mensajes.map((m) => (
            <Burbuja key={m.id} mensaje={m} slug={slug} pedidoId={pedidoId} onPreview={setPreview} />
          ))
        )}
      </div>

      {/* Compositor */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border/50">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-1.5">
          {sendError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {sendError}
            </div>
          )}
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

      {/* Visor interno de adjuntos: imagen en Dialog, PDF via PdfViewerModal reutilizado */}
      <AttachmentPreviewModal preview={preview} onClose={() => setPreview(null)} />
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

function Burbuja({
  mensaje,
  slug,
  pedidoId,
  onPreview,
}: {
  mensaje: Mensaje
  slug: string
  pedidoId: string
  onPreview: (preview: AttachmentPreview) => void
}) {
  const esNegocio = mensaje.emisor === "negocio"
  const href = mensaje.adjunto ? adjuntoHref(slug, pedidoId, mensaje.id) : null

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
        <span
          className={cn(
            "text-[10px] font-semibold block mb-0.5",
            esNegocio ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {esNegocio ? "Negocio" : "Cliente"}
        </span>

        {mensaje.contenido && (
          <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>
        )}

        {mensaje.adjunto && href && (
          <div className="mt-1.5">
            {mensaje.adjunto.tipo === "imagen" && (
              <img
                src={href}
                alt="Comprobante"
                className="max-w-full max-h-56 rounded-lg cursor-pointer border border-border/30"
                onClick={() => onPreview({ tipo: "imagen", src: href, nombre: mensaje.adjunto!.nombre })}
              />
            )}
            {mensaje.adjunto.tipo === "pdf" && (
              <button
                type="button"
                onClick={() => onPreview({ tipo: "pdf", src: href, nombre: mensaje.adjunto!.nombre })}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                  esNegocio
                    ? "bg-primary-foreground/10 text-primary-foreground"
                    : "bg-background text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                Abrir comprobante
              </button>
            )}
            {mensaje.adjunto.tipo === "archivo" && <AttachmentUnavailableNotice />}
          </div>
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
