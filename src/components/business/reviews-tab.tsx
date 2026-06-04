"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Star, MessageSquare, Send, Filter, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, timeAgo } from "@/lib/utils"
import { toast } from "sonner"
import { TAB_COUNTS_KEY } from "./business-panel"

// ============================================
// Types
// ============================================
interface ReviewsTabProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
}

interface Resena {
  id: string
  clienteNombre: string
  puntuacion: number
  comentario: string
  rapidez: number | null
  calidad: number | null
  precio: number | null
  respuestaNegocio: string | null
  fechaRespuesta: string | null
  fecha: string
}

interface ReviewsStats {
  promedio: number
  total: number
  sinRespuesta: number
  distribucion: { 1: number; 2: number; 3: number; 4: number; 5: number }
}

interface ReviewsResponse {
  resenas: Resena[]
  stats: ReviewsStats
  pagination: { page: number; total: number; totalPages: number }
}

type FilterType = "todas" | "sin_respuesta" | "con_respuesta"

// ============================================
// Star Display Component
// ============================================
function StarRating({
  rating,
  size = "md",
  showValue = false,
}: {
  rating: number
  size?: "sm" | "md" | "lg" | "xl"
  showValue?: boolean
}) {
  const sizeMap = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
    xl: "h-7 w-7",
  }

  const iconSize = sizeMap[size]

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const diff = rating - i
          return (
            <div key={i} className="relative">
              <Star
                className={cn(iconSize, "text-muted/40")}
              />
              {diff > 0 && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    width: diff >= 1 ? "100%" : `${diff * 100}%`,
                  }}
                >
                  <Star
                    className={cn(iconSize, "fill-amber-400 text-amber-400")}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {showValue && (
        <span className={cn(
          "font-bold text-foreground",
          size === "xl" ? "text-3xl" : size === "lg" ? "text-lg" : "text-sm"
        )}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

// ============================================
// Sub-Rating Badge
// ============================================
function SubRating({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-2.5 w-2.5",
              i < value
                ? "fill-amber-400 text-amber-400"
                : "fill-muted/40 text-muted/40"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================
// Reviews Tab Component
// ============================================
export function ReviewsTab({ negocio }: ReviewsTabProps) {
  const queryClient = useQueryClient()
  const isRopa = negocio.rubro === "ropa"
  const isNegocio = negocio.rubro === "negocio"
  const [filter, setFilter] = useState<FilterType>("todas")
  const [page, setPage] = useState(1)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")

  // Fetch reviews
  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["negocio-resenas", negocio.id, filter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        negocioId: negocio.id,
        page: page.toString(),
        limit: "10",
        filter,
      })
      const res = await fetch(`/api/negocio/resenas?${params}`)
      if (!res.ok) throw new Error("Error cargando reseñas")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // When reviews stats change (new review from customer), also refresh tab counts
  const prevSinRespuestaRef = useRef(-1)
  useEffect(() => {
    const sinRespuesta = data?.stats?.sinRespuesta ?? 0
    if (prevSinRespuestaRef.current !== -1 && sinRespuesta !== prevSinRespuestaRef.current) {
      queryClient.invalidateQueries({ queryKey: [TAB_COUNTS_KEY] })
    }
    prevSinRespuestaRef.current = sinRespuesta
  }, [data, queryClient])

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({ resenaId, respuesta }: { resenaId: string; respuesta: string }) => {
      const res = await fetch(`/api/negocio/resenas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resenaId, respuesta }),
      })
      if (!res.ok) throw new Error("Error enviando respuesta")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio-resenas", negocio.id] })
      // Invalidate tab counts so Reseñas badge updates instantly
      queryClient.invalidateQueries({ queryKey: [TAB_COUNTS_KEY] })
      toast.success("Respuesta enviada")
      setReplyingTo(null)
      setReplyText("")
    },
    onError: () => {
      toast.error("Error al enviar la respuesta")
    },
  })

  const stats = data?.stats ?? { promedio: 0, total: 0, sinRespuesta: 0, distribucion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
  const resenas = data?.resenas ?? []
  const pagination = data?.pagination ?? { page: 1, total: 0, totalPages: 1 }

  const maxDistribution = Math.max(
    ...Object.values(stats.distribucion),
    1
  )

  return (
    <div className="space-y-5">
      {/* ===== REVIEWS OVERVIEW ===== */}
      {isLoading ? (
        <ReviewsOverviewSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="rounded-2xl border-border/50 overflow-hidden">
            <CardContent className="p-5">
              {stats.total === 0 ? (
                <div className="text-center py-6">
                  <span className="text-4xl block mb-3">⭐</span>
                  <p className="text-sm text-muted-foreground">
                    Todavía no tenés reseñas
                  </p>
                </div>
              ) : (
                <div className="flex gap-6">
                  {/* Average rating */}
                  <div className="flex flex-col items-center justify-center min-w-[100px]">
                    <span className="text-4xl font-bold leading-none">
                      {stats.promedio.toFixed(1)}
                    </span>
                    <div className="mt-1.5">
                      <StarRating rating={stats.promedio} size="md" />
                    </div>
                    <span className="text-xs text-muted-foreground mt-1.5">
                      {stats.total} reseña{stats.total !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Distribution bars */}
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = stats.distribucion[stars as keyof typeof stats.distribucion] ?? 0
                      const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground w-3 text-right">
                            {stars}
                          </span>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                          <div className="flex-1 h-2.5 bg-muted/60 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-amber-400 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.6, delay: (5 - stars) * 0.08, ease: "easeOut" }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ===== FILTER ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2 }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex bg-muted/60 rounded-xl p-1">
            {([
              { key: "todas", label: "Todas", count: stats.total },
              { key: "sin_respuesta", label: "Sin respuesta", count: stats.sinRespuesta },
              { key: "con_respuesta", label: "Con respuesta", count: stats.total - stats.sinRespuesta },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => { setFilter(key); setPage(1) }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                  filter === key
                    ? "bg-background shadow-sm text-foreground"
                    : key === "sin_respuesta" && count > 0 && filter !== key
                    ? "text-amber-600 hover:text-amber-700"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] px-1 py-0 rounded-full",
                    filter === key
                      ? "bg-foreground/10 text-foreground"
                      : key === "sin_respuesta"
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

        </div>
      </motion.div>

      {/* ===== REVIEWS LIST ===== */}
      {isLoading ? (
        <ReviewsListSkeleton />
      ) : resenas.length === 0 ? (
        <EmptyReviews filter={filter} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {resenas.map((resena, i) => (
              <ReviewCard
                key={resena.id}
                resena={resena}
                delay={i * 0.04}
                isReplying={replyingTo === resena.id}
                onReplyClick={() => {
                  setReplyingTo(replyingTo === resena.id ? null : resena.id)
                  setReplyText("")
                }}
                replyText={replyText}
                onReplyTextChange={setReplyText}
                onSubmitReply={() => {
                  if (!replyText.trim()) return
                  replyMutation.mutate({ resenaId: resena.id, respuesta: replyText.trim() })
                }}
                isSubmitting={replyMutation.isPending}
                onCancelReply={() => {
                  setReplyingTo(null)
                  setReplyText("")
                }}
                colorPrincipal={negocio.colorPrincipal}
                isRopa={isRopa}
                isNegocio={isNegocio}
              />
            ))}
          </AnimatePresence>

          {/* ===== PAGINATION ===== */}
          {pagination.totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 pt-2"
            >
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-8 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-8 text-xs"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Review Card
// ============================================
function ReviewCard({
  resena,
  delay,
  isReplying,
  onReplyClick,
  replyText,
  onReplyTextChange,
  onSubmitReply,
  isSubmitting,
  onCancelReply,
  colorPrincipal,
  isRopa,
  isNegocio,
}: {
  resena: Resena
  delay: number
  isReplying: boolean
  onReplyClick: () => void
  replyText: string
  onReplyTextChange: (val: string) => void
  onSubmitReply: () => void
  isSubmitting: boolean
  onCancelReply: () => void
  colorPrincipal: string
  isRopa: boolean
  isNegocio: boolean
}) {
  const hasReply = !!resena.respuestaNegocio
  const hasSubRatings = resena.rapidez !== null || resena.calidad !== null || resena.precio !== null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay, duration: 0.2 }}
    >
      <Card className={cn(
        "rounded-2xl overflow-hidden transition-all",
        hasReply
          ? "border-border/50"
          : "border-amber-300/60 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/10"
      )}>
        <CardContent className="p-4">
          {/* Header: name + date + rating */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold truncate">
                  {resena.clienteNombre}
                </h4>
                {hasReply ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-700 shrink-0"
                  >
                    <Check className="h-2.5 w-2.5 mr-0.5" />
                    Respondida
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700 shrink-0 animate-pulse"
                  >
                    <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                    Sin responder
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {timeAgo(new Date(resena.fecha))}
              </p>
            </div>
            <StarRating rating={resena.puntuacion} size="sm" />
          </div>

          {/* Comment */}
          <p className="text-sm text-foreground/90 leading-relaxed mb-2">
            {resena.comentario}
          </p>

          {/* Sub-ratings */}
          {hasSubRatings && (
            <div className="flex flex-wrap gap-3 mb-3 p-2.5 rounded-xl bg-muted/40">
              {resena.rapidez !== null && (
                <SubRating label={isRopa ? "Envío" : isNegocio ? "Atención" : "Rapidez"} value={resena.rapidez} />
              )}
              {resena.calidad !== null && (
                <SubRating label={isRopa ? "Calidad de prenda" : "Calidad"} value={resena.calidad} />
              )}
              {resena.precio !== null && (
                <SubRating label="Precio" value={resena.precio} />
              )}
            </div>
          )}

          {/* Business reply */}
          {hasReply && (
            <div className="ml-2 pl-3 border-l-2 pt-1 pb-0.5" style={{ borderColor: colorPrincipal }}>
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="h-3 w-3" style={{ color: colorPrincipal }} />
                <span className="text-xs font-semibold" style={{ color: colorPrincipal }}>
                  Tu respuesta
                </span>
                {resena.fechaRespuesta && (
                  <span className="text-[10px] text-muted-foreground">
                    · {timeAgo(new Date(resena.fechaRespuesta))}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {resena.respuestaNegocio}
              </p>
            </div>
          )}

          {/* Reply button / form */}
          {!hasReply && !isReplying && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 rounded-xl h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={onReplyClick}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Responder
            </Button>
          )}

          {/* Inline reply form */}
          <AnimatePresence>
            {isReplying && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2.5">
                  <Textarea
                    value={replyText}
                    onChange={(e) => onReplyTextChange(e.target.value)}
                    placeholder="Escribí tu respuesta..."
                    className="rounded-xl text-sm min-h-[80px] resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-8 text-xs gap-1"
                      onClick={onCancelReply}
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-xl h-8 text-xs gap-1"
                      style={{ backgroundColor: colorPrincipal }}
                      onClick={onSubmitReply}
                      disabled={!replyText.trim() || isSubmitting}
                    >
                      <Send className="h-3 w-3" />
                      {isSubmitting ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Empty State
// ============================================
function EmptyReviews({ filter }: { filter: FilterType }) {
  const messages: Record<FilterType, { emoji: string; title: string; subtitle: string }> = {
    todas: {
      emoji: "💬",
      title: "Todavía no tenés reseñas",
      subtitle: "Cuando los clientes dejen reseñas, las vas a ver acá",
    },
    sin_respuesta: {
      emoji: "✅",
      title: "¡Todo al día!",
      subtitle: "No tenés reseñas sin responder",
    },
    con_respuesta: {
      emoji: "📝",
      title: "Sin respuestas aún",
      subtitle: "Todavía no respondiste ninguna reseña",
    },
  }

  const { emoji, title, subtitle } = messages[filter]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="rounded-2xl border-border/50">
        <CardContent className="py-16 flex flex-col items-center justify-center text-center">
          <motion.span
            className="text-5xl mb-4 block"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          >
            {emoji}
          </motion.span>
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
            {subtitle}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Skeletons
// ============================================
function ReviewsOverviewSkeleton() {
  return (
    <Card className="rounded-2xl border-border/50">
      <CardContent className="p-5">
        <div className="flex gap-6">
          <div className="flex flex-col items-center justify-center min-w-[100px]">
            <Skeleton className="h-10 w-16 mb-2" />
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-4 rounded-sm" />
              ))}
            </div>
            <Skeleton className="h-3 w-16 mt-2" />
          </div>
          <div className="flex-1 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-3 rounded-sm" />
                <Skeleton className="h-2.5 flex-1 rounded-full" />
                <Skeleton className="h-3 w-4" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ReviewsListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-3 w-3 rounded-sm" />
                ))}
              </div>
            </div>
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
