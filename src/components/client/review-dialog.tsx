"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Star, X, Loader2, Zap, Utensils, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface ReviewDialogProps {
  isOpen: boolean
  onClose: () => void
  pedidoId: string
  negocioNombre: string
  onSuccess: () => void
}

export function ReviewDialog({
  isOpen,
  onClose,
  pedidoId,
  negocioNombre,
  onSuccess,
}: ReviewDialogProps) {
  const [rapidez, setRapidez] = useState(0)
  const [calidad, setCalidad] = useState(0)
  const [precio, setPrecio] = useState(0)
  const [comentario, setComentario] = useState("")
  const [loading, setLoading] = useState(false)

  // Calculate overall rating automatically
  const allRated = rapidez > 0 && calidad > 0 && precio > 0
  const puntuacionGeneral = useMemo(() => {
    if (!allRated) return 0
    return Math.round(((rapidez + calidad + precio) / 3) * 10) / 10
  }, [rapidez, calidad, precio, allRated])

  const ratingLabels = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"]

  const handleSubmit = async () => {
    if (!allRated) {
      toast.error("Por favor, calificá las 3 categorías")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/cliente/resenas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId,
          comentario,
          rapidez,
          calidad,
          precio,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al enviar la reseña")
        return
      }

      toast.success("¡Gracias por tu reseña! ⭐")
      onSuccess()
      onClose()
    } catch {
      toast.error("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setRapidez(0)
      setCalidad(0)
      setPrecio(0)
      setComentario("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" />
            Dejá tu reseña
          </DialogTitle>
          <DialogDescription>
            Calificá los 3 aspectos de tu experiencia con{" "}
            <span className="font-semibold text-foreground">{negocioNombre}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Sub-ratings — required */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">
              Calificá cada aspecto
            </p>
            <div className="grid grid-cols-3 gap-3">
              <SubRating
                icon={Zap}
                label="Rapidez"
                value={rapidez}
                onChange={setRapidez}
              />
              <SubRating
                icon={Utensils}
                label="Calidad"
                value={calidad}
                onChange={setCalidad}
              />
              <SubRating
                icon={DollarSign}
                label="Precio"
                value={precio}
                onChange={setPrecio}
              />
            </div>
          </div>

          {/* Auto-calculated overall rating */}
          {allRated && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-2 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50"
            >
              <p className="text-xs text-muted-foreground mb-1">Puntuación general</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {puntuacionGeneral}
                </span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-4 w-4",
                        puntuacionGeneral >= star
                          ? "fill-amber-400 text-amber-400"
                          : puntuacionGeneral >= star - 0.5
                          ? "fill-amber-400/50 text-amber-400"
                          : "text-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                Promedio de las 3 categorías
              </p>
            </motion.div>
          )}

          {/* Comment */}
          <div>
            <p className="text-sm font-semibold mb-2">
              Comentario <span className="text-muted-foreground font-normal">(opcional)</span>
            </p>
            <Textarea
              placeholder="Contanos tu experiencia..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value.slice(0, 500))}
              className="rounded-xl min-h-[80px] resize-none"
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground mt-1 text-right">
              {comentario.length}/500
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !allRated}
              className="flex-1 rounded-xl"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enviar reseña"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Sub-rating component
function SubRating({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ElementType
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/50 border border-border/50">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(star)}
            className="focus:outline-none"
          >
            <Star
              className={cn(
                "h-4 w-4 transition-colors",
                value >= star
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30"
              )}
            />
          </motion.button>
        ))}
      </div>
      {value > 0 && (
        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
          {ratingLabels[value]}
        </span>
      )}
    </div>
  )
}

const ratingLabels = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
