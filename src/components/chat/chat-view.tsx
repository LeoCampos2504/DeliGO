"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Socket } from "socket.io-client"
import {
  ArrowLeft,
  Send,
  ImageIcon,
  Loader2,
  Store,
  User,
  Bike,
  Clock,
  CreditCard,
  Shield,
  Paperclip,
  FileText,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useChatStore, type ChatMessage, type PedidoInfo } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { PdfViewerModal } from "./pdf-viewer-modal"

// ============================================
// Types
// ============================================
interface ChatViewProps {
  pedidoId: string
  getSocket: () => Socket | null
  onBack: () => void
}

interface PendingAttachment {
  type: "image" | "file"
  url: string
  nombre: string
  fileType: string
  preview?: string // Data URL for image preview
  publicId?: string
}

// ============================================
// File size limits
// ============================================
const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10MB
const MAX_FILE_SIZE = 5 * 1024 * 1024     // 5MB

// ============================================
// Main ChatView Component
// ============================================
export function ChatView({ pedidoId, getSocket, onBack }: ChatViewProps) {
  const {
    messages,
    pedidoInfo,
    typingUsers,
    isLoadingMessages,
    isSending,
    setMessages,
    addMessage,
    setPedidoInfo,
    setLoadingMessages,
    setSending,
    updateConversationUnread,
    updateConversationLastMessage,
  } = useChatStore()

  const { user } = useAuthStore()

  const [messageText, setMessageText] = useState("")
  const [telefonoFiltrado, setTelefonoFiltrado] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [attachPopoverOpen, setAttachPopoverOpen] = useState(false)
  const [pdfViewer, setPdfViewer] = useState<{ open: boolean; url: string; fileName: string }>({
    open: false,
    url: "",
    fileName: "",
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isAtBottomRef = useRef(true)

  const currentMessages = messages[pedidoId] || []
  const currentPedidoInfo = pedidoInfo[pedidoId]
  const currentTyping = typingUsers[pedidoId] || []
  const isLoading = isLoadingMessages[pedidoId] || false
  const myRemitente =
    user?.type === "cliente"
      ? "cliente"
      : user?.type === "negocio"
      ? "vendedor"
      : "repartidor"

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      setLoadingMessages(pedidoId, true)
      try {
        const res = await fetch(`/api/chat/mensajes/${pedidoId}`)
        if (!res.ok) {
          toast.error("Error al cargar mensajes")
          return
        }
        const data = await res.json()
        setMessages(pedidoId, data.mensajes || [])
        setPedidoInfo(pedidoId, data.pedido)
        updateConversationUnread(pedidoId, 0)
      } catch {
        toast.error("Error al cargar mensajes")
      } finally {
        setLoadingMessages(pedidoId, false)
      }
    }
    loadMessages()
  }, [pedidoId, setMessages, setPedidoInfo, setLoadingMessages, updateConversationUnread])

  // Auto-scroll to bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (isAtBottomRef.current && container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
    }
  }, [currentMessages])

  // Detect if user is at bottom of messages
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    isAtBottomRef.current = atBottom
  }, [])

  // Upload file to Cloudinary
  const uploadFileToCloudinary = useCallback(
    async (file: File, type: "image" | "file"): Promise<{ url: string; publicId: string } | null> => {
      setIsUploading(true)
      setUploadProgress(0)

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("category", "chat")
        formData.append("slug", pedidoId)
        formData.append("type", type)

        // Use XMLHttpRequest for progress tracking
        const result = await new Promise<{ url: string; publicId: string } | null>(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open("POST", "/api/upload")

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100)
                setUploadProgress(pct)
              }
            }

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText)
                  resolve(data)
                } catch {
                  reject(new Error("Error al procesar respuesta"))
                }
              } else {
                try {
                  const data = JSON.parse(xhr.responseText)
                  reject(new Error(data.error || "Error al subir archivo"))
                } catch {
                  reject(new Error("Error al subir archivo"))
                }
              }
            }

            xhr.onerror = () => reject(new Error("Error de conexión"))
            xhr.send(formData)
          }
        )

        return result
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al subir archivo")
        return null
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    },
    [pedidoId]
  )

  // Handle image selection
  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""

      if (!file) return

      // Validate file size
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error("La imagen es muy grande. Máximo 10MB.")
        return
      }

      // Create preview
      const preview = await readFileAsDataUrl(file)

      // Upload to Cloudinary
      const result = await uploadFileToCloudinary(file, "image")
      if (!result) return

      setPendingAttachment({
        type: "image",
        url: result.url,
        nombre: file.name,
        fileType: file.type,
        preview,
        publicId: result.publicId,
      })

      inputRef.current?.focus()
    },
    [uploadFileToCloudinary]
  )

  // Handle PDF selection
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""

      if (!file) return

      // Validate it's a PDF
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        toast.error("Solo se permiten archivos PDF.")
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error("El archivo es muy grande. Máximo 5MB para PDFs.")
        return
      }

      // Upload to Cloudinary
      const result = await uploadFileToCloudinary(file, "file")
      if (!result) return

      setPendingAttachment({
        type: "file",
        url: result.url,
        nombre: file.name,
        fileType: file.type || "application/pdf",
        publicId: result.publicId,
      })

      inputRef.current?.focus()
    },
    [uploadFileToCloudinary]
  )

  // Remove pending attachment
  const removePendingAttachment = useCallback(() => {
    setPendingAttachment(null)
  }, [])

  // Send message (with or without attachment)
  const sendMessage = useCallback(async () => {
    const text = messageText.trim()
    const attachment = pendingAttachment

    if (!text && !attachment) return
    if (isSending || isUploading) return

    setSending(true)
    setTelefonoFiltrado(false)

    try {
      const body: Record<string, string> = {}

      if (text) {
        body.texto = text
      }

      if (attachment) {
        if (attachment.type === "image") {
          body.imagenUrl = attachment.url
        } else {
          body.archivoUrl = attachment.url
          body.archivoNombre = attachment.nombre
          body.archivoTipo = attachment.fileType
        }
      }

      const res = await fetch(`/api/chat/mensajes/${pedidoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Error al enviar mensaje")
        return
      }

      const data = await res.json()

      if (data.telefonoFiltrado) {
        setTelefonoFiltrado(true)
        toast("🔒 Por seguridad, los números de teléfono fueron filtrados", {
          duration: 4000,
        })
      }

      // Add message to local state
      if (data.mensaje) {
        addMessage(pedidoId, data.mensaje)
        updateConversationLastMessage(pedidoId, data.mensaje)

        // Broadcast via socket to other users in the room
        const socket = getSocket()
        if (socket) {
          socket.emit("message-sent", { pedidoId, message: data.mensaje })
        }
      }

      setMessageText("")
      setPendingAttachment(null)
      isAtBottomRef.current = true

      // Stop typing
      const socket = getSocket()
      if (socket) {
        socket.emit("stop-typing", pedidoId)
      }
    } catch {
      toast.error("Error al enviar mensaje")
    } finally {
      setSending(false)
    }
  }, [messageText, pendingAttachment, isSending, isUploading, pedidoId, addMessage, updateConversationLastMessage, setSending, getSocket])

  // Typing indicator
  const handleTyping = useCallback(
    (text: string) => {
      setMessageText(text)

      const socket = getSocket()
      if (!socket) return

      if (text.trim()) {
        socket.emit("typing", pedidoId)

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit("stop-typing", pedidoId)
        }, 3000)
      } else {
        socket.emit("stop-typing", pedidoId)
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
      }
    },
    [pedidoId, getSocket]
  )

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  // Clear telefono filtrado after 5 seconds
  useEffect(() => {
    if (telefonoFiltrado) {
      const timer = setTimeout(() => setTelefonoFiltrado(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [telefonoFiltrado])

  // Determine if send button should be enabled
  const canSend = (messageText.trim() || pendingAttachment) && !isSending && !isUploading

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {user?.type === "cliente" ? (
                <Store className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <User className="h-4 w-4 text-primary shrink-0" />
              )}
              <span className="font-semibold text-sm truncate">
                {currentPedidoInfo
                  ? user?.type === "cliente"
                    ? currentPedidoInfo.negocioNombre
                    : currentPedidoInfo.clienteNombre
                  : "Cargando..."}
              </span>
            </div>
            {currentPedidoInfo && (
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-4 font-semibold",
                    getEstadoColor(currentPedidoInfo.estado)
                  )}
                >
                  {getEstadoLabel(currentPedidoInfo.estado)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatPrice(currentPedidoInfo.total)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Order context banner */}
        {currentPedidoInfo && (
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              {currentPedidoInfo.metodoEntrega === "domicilio" ? (
                <>
                  <Bike className="h-3 w-3" /> Delivery
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" /> Retiro
                </>
              )}
            </span>
            <span className="flex items-center gap-0.5">
              <CreditCard className="h-3 w-3" />
              {currentPedidoInfo.metodoPago === "efectivo"
                ? "Efectivo"
                : "Transferencia"}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : currentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm font-semibold">Iniciá la conversación</p>
            <p className="text-xs text-muted-foreground">
              Enviale un mensaje para consultar sobre tu pedido
            </p>
          </div>
        ) : (
          <>
            {currentMessages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMine={msg.remitente === myRemitente}
                showSender={
                  msg.remitente !== myRemitente &&
                  (i === 0 || currentMessages[i - 1]?.remitente !== msg.remitente)
                }
                userType={user?.type || "cliente"}
                onOpenPdf={(url, name) => setPdfViewer({ open: true, url, fileName: name })}
              />
            ))}
          </>
        )}

        {/* Typing indicator */}
        {currentTyping.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-muted/60 max-w-[70%]">
              <div className="flex gap-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {getTypingLabel(currentTyping)}
              </span>
            </div>
          </div>
        )}

        {/* Phone filter warning */}
        {telefonoFiltrado && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
            <Shield className="h-4 w-4 shrink-0" />
            <span className="text-xs">
              Por seguridad, los números de teléfono fueron filtrados
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Upload progress bar */}
      {isUploading && (
        <div className="shrink-0 px-3 pt-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">Subiendo archivo...</span>
          </div>
          <Progress value={uploadProgress} className="h-1.5 mt-1" />
        </div>
      )}

      {/* Pending attachment preview */}
      {pendingAttachment && !isUploading && (
        <div className="shrink-0 px-3 pt-2">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/50 border border-border/50">
            {pendingAttachment.type === "image" && pendingAttachment.preview ? (
              <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img
                  src={pendingAttachment.preview}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <FileText className="h-6 w-6 text-red-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {pendingAttachment.type === "image" ? "📷 Imagen" : "📄 Archivo"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {pendingAttachment.nombre}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={removePendingAttachment}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-3 py-3 border-t border-border/50 bg-card">
        <div className="flex items-center gap-1.5">
          {/* Paperclip attachment popover */}
          <Popover open={attachPopoverOpen} onOpenChange={setAttachPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
                disabled={isSending || isUploading}
              >
                <Paperclip className="h-4.5 w-4.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="w-48 p-1 rounded-xl"
            >
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg hover:bg-muted/80 transition-colors text-left"
                onClick={() => {
                  setAttachPopoverOpen(false)
                  imageInputRef.current?.click()
                }}
              >
                <ImageIcon className="h-4 w-4 text-emerald-600" />
                <span>📷 Imagen</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg hover:bg-muted/80 transition-colors text-left"
                onClick={() => {
                  setAttachPopoverOpen(false)
                  fileInputRef.current?.click()
                }}
              >
                <FileText className="h-4 w-4 text-red-500" />
                <span>📄 Archivo (PDF)</span>
              </button>
            </PopoverContent>
          </Popover>

          {/* Quick image attach button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
            disabled={isSending || isUploading}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="h-4.5 w-4.5" />
          </Button>

          <Input
            ref={inputRef}
            value={messageText}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingAttachment ? "Agregá un mensaje (opcional)..." : "Escribí un mensaje..."}
            disabled={isSending || isUploading}
            className="flex-1 h-10 rounded-xl text-sm"
            maxLength={500}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!canSend}
            className="h-10 w-10 rounded-xl shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* PDF Viewer Modal */}
      <PdfViewerModal
        open={pdfViewer.open}
        onClose={() => setPdfViewer({ open: false, url: "", fileName: "" })}
        url={pdfViewer.url}
        fileName={pdfViewer.fileName}
      />
    </div>
  )
}

// ============================================
// Message Bubble
// ============================================
function MessageBubble({
  message,
  isMine,
  showSender,
  userType,
  onOpenPdf,
}: {
  message: ChatMessage
  isMine: boolean
  showSender: boolean
  userType: string
  onOpenPdf: (url: string, name: string) => void
}) {
  const time = new Date(message.fecha).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const senderLabel = getSenderLabel(message.remitente, userType)

  return (
    <div className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
      {/* Sender name */}
      {showSender && !isMine && (
        <span className="text-[10px] text-muted-foreground px-1 mb-0.5 flex items-center gap-1">
          {message.remitente === "vendedor" ? (
            <Store className="h-2.5 w-2.5" />
          ) : message.remitente === "repartidor" ? (
            <Bike className="h-2.5 w-2.5" />
          ) : (
            <User className="h-2.5 w-2.5" />
          )}
          {senderLabel}
        </span>
      )}

      <div
        className={cn(
          "max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
          isMine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        )}
      >
        {/* Image */}
        {message.imagenUrl && (
          <div className="mb-1.5">
            <img
              src={message.imagenUrl}
              alt="Imagen adjunta"
              className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.imagenUrl!, "_blank")}
            />
          </div>
        )}

        {/* File attachment */}
        {message.archivoUrl && (
          <button
            onClick={() => onOpenPdf(message.archivoUrl!, message.archivoNombre || "Documento PDF")}
            className="flex items-center gap-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors mb-1.5 w-full text-left"
          >
            <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {message.archivoNombre || "Archivo"}
              </p>
              <p className="text-[10px] opacity-60">
                {message.archivoTipo === "application/pdf" ? "PDF" : "Archivo"} — Tocá para ver
              </p>
            </div>
          </button>
        )}

        {/* Text */}
        {message.texto && <p className="whitespace-pre-wrap break-words">{message.texto}</p>}

        {/* Expired content notice (message had a file that was auto-cleaned) */}
        {!message.texto && !message.imagenUrl && !message.archivoUrl && (
          <p className="text-xs italic opacity-40 whitespace-pre-wrap break-words">
            Archivo ya no disponible
          </p>
        )}

        {/* Time and read status */}
        <div
          className={cn(
            "flex items-center gap-1 mt-0.5",
            isMine ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isMine
                ? "text-primary-foreground/60"
                : "text-muted-foreground"
            )}
          >
            {time}
          </span>
          {isMine && (
            <span
              className={cn(
                "text-[10px]",
                message.leido
                  ? "text-primary-foreground/80"
                  : "text-primary-foreground/40"
              )}
            >
              {message.leido ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Helpers
// ============================================
function getSenderLabel(remitente: string, userType: string): string {
  if (remitente === "vendedor") return "Negocio"
  if (remitente === "repartidor") return "Repartidor"
  if (remitente === "cliente") return "Cliente"
  return remitente
}

function getTypingLabel(users: Array<{ userName: string; userType: string }>): string {
  if (users.length === 1) {
    const u = users[0]
    return `${u.userName} está escribiendo...`
  }
  return "Alguien está escribiendo..."
}

function getEstadoColor(estado: string): string {
  switch (estado) {
    case "recibido":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "preparando":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    case "en_camino":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
    case "listo_para_retirar":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getEstadoLabel(estado: string): string {
  switch (estado) {
    case "recibido":
      return "Recibido"
    case "preparando":
      return "Preparando"
    case "en_camino":
      return "En camino"
    case "listo_para_retirar":
      return "Listo"
    case "entregado":
      return "Entregado"
    case "cancelado":
      return "Cancelado"
    default:
      return estado
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => resolve("")
    reader.readAsDataURL(file)
  })
}
