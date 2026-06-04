"use client"

import React from "react"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn, isNegocioOpen } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface DiaHorario {
  abierto: boolean
  apertura: string
  cierre: string
  turno2?: boolean
  apertura2?: string
  cierre2?: string
}

type HorariosData = Record<string, DiaHorario>

// ============================================
// Constants
// ============================================
const DIA_SHORT: Record<string, string> = {
  "1": "Lun",
  "2": "Mar",
  "3": "Mié",
  "4": "Jue",
  "5": "Vie",
  "6": "Sáb",
  "7": "Dom",
}

// ============================================
// Helpers
// ============================================
function parseHorarios(horarios: string | HorariosData | Record<string, unknown>): HorariosData {
  if (typeof horarios === "string") {
    try {
      return JSON.parse(horarios)
    } catch {
      return {}
    }
  }
  return horarios as HorariosData
}

function formatTimeRange(apertura: string, cierre: string): string {
  if (!apertura || !cierre) return ""
  // Convert "09:00" to "9:00" for cleaner display
  const fmt = (t: string) => {
    if (t.startsWith("0")) return t.slice(1)
    return t
  }
  return `${fmt(apertura)} - ${fmt(cierre)}`
}

function getCurrentDayKey(): string {
  const now = new Date()
  const day = now.getDay() || 7 // Convert Sunday=0 to 7
  return String(day)
}

function getCurrentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

/**
 * Get a short summary of today's hours, e.g. "9:00 - 22:00" or "Cerrado"
 */
export function getTodayHoursLabel(horarios: string | HorariosData | Record<string, unknown>): string {
  const parsed = parseHorarios(horarios)
  const todayKey = getCurrentDayKey()
  const today = parsed[todayKey]

  if (!today || !today.abierto) return "Cerrado"

  const parts: string[] = []
  const r1 = formatTimeRange(today.apertura, today.cierre)
  if (r1) parts.push(r1)

  if (today.turno2) {
    const r2 = formatTimeRange(today.apertura2 ?? "", today.cierre2 ?? "")
    if (r2) parts.push(r2)
  }

  return parts.length > 0 ? parts.join(" / ") : "Cerrado"
}

// ============================================
// Main Component
// ============================================
interface HorariosPopoverProps {
  /** horarios as JSON string or parsed object */
  horarios: string | HorariosData | Record<string, unknown>
  /** The badge variant to show: "badge" for the detail page, "overlay" for home/favorites cards */
  variant?: "badge" | "overlay"
  /** Whether the component is on a dark background (e.g. over banner image) */
  darkBg?: boolean
  /** Optional className for trigger */
  className?: string
  /** Schedule mode: "simple" = manual toggle, "experto" = schedule-based */
  horarioMode?: string
  /** Manual open/closed status (only used when horarioMode = "simple") */
  abiertoManual?: boolean
}

export function HorariosPopover({
  horarios,
  variant = "badge",
  darkBg = false,
  className,
  horarioMode,
  abiertoManual,
}: HorariosPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const parsed = parseHorarios(horarios)
  const horariosStr = typeof horarios === "string" ? horarios : JSON.stringify(horarios)
  const isOpen = isNegocioOpen(horariosStr, horarioMode, abiertoManual)
  const isSimpleMode = horarioMode === "simple"
  const todayKey = getCurrentDayKey()
  const currentTime = getCurrentTime()

  // Build ordered day list (1-7)
  const days = ["1", "2", "3", "4", "5", "6", "7"]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "badge" ? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity",
              className
            )}
          >
            <Badge
              className={cn(
                "text-[10px] font-bold px-2 py-0 border-0",
                isOpen
                  ? "bg-emerald-500/90 text-white"
                  : "bg-red-500/90 text-white"
              )}
            >
              {isOpen ? "Abierto" : "Cerrado"}
            </Badge>
            <Clock
              className={cn(
                "h-3 w-3",
                darkBg ? "text-white/60" : "text-muted-foreground"
              )}
            />
          </button>
        ) : (
          // Overlay variant - for home/favorites cards
          // Closed: full overlay with "Cerrado" badge + clock (tappable for hours)
          // Open: small badge in bottom-left corner (tappable for hours)
          // Both prevent navigation to the business page when tapped
          isOpen ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
              className="absolute top-2 left-2 z-20 cursor-pointer hover:scale-105 transition-transform"
            >
              <Badge
                className="bg-emerald-500/80 text-white border-0 text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm shadow-sm"
              >
                Abierto
                <Clock className="h-2.5 w-2.5" />
              </Badge>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-20 cursor-pointer"
            >
              <Badge
                variant="secondary"
                className="bg-black/60 text-white border-0 text-xs font-bold flex items-center gap-1"
              >
                Cerrado
                <Clock className="h-3 w-3" />
              </Badge>
            </button>
          )
        )}
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="w-72 p-0 rounded-2xl overflow-hidden shadow-xl border-border/50"
      >
        {/* Header */}
        <div
          className={cn(
            "px-4 py-3 flex items-center gap-2.5",
            isOpen
              ? "bg-emerald-50 dark:bg-emerald-950/30"
              : "bg-red-50 dark:bg-red-950/30"
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              isOpen
                ? "bg-emerald-500/15"
                : "bg-red-500/15"
            )}
          >
            <Clock
              className={cn(
                "h-4 w-4",
                isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-bold",
                isOpen
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              )}
            >
              {isOpen ? "Abierto ahora" : "Cerrado"}
            </p>
            {isOpen && !isSimpleMode && (
              <p className="text-[11px] text-muted-foreground">
                Hasta las {(() => {
                  const today = parsed[todayKey]
                  if (!today || !today.abierto) return ""
                  // Check which shift we're in
                  const parts: string[] = []
                  if (today.cierre && today.cierre > currentTime) {
                    parts.push(today.cierre.startsWith("0") ? today.cierre.slice(1) : today.cierre)
                  }
                  if (today.turno2 && today.cierre2 && today.cierre2 > currentTime) {
                    parts.push(today.cierre2.startsWith("0") ? today.cierre2.slice(1) : today.cierre2)
                  }
                  return parts[0] ?? ""
                })()}
              </p>
            )}
            {isSimpleMode && (
              <p className="text-[11px] text-muted-foreground">
                Controlado manualmente
              </p>
            )}
          </div>
          <Badge
            className={cn(
              "text-[9px] font-bold px-1.5 py-0 border-0",
              isOpen
                ? "bg-emerald-500 text-white"
                : "bg-red-500 text-white"
            )}
          >
            {isOpen ? "ABIERTO" : "CERRADO"}
          </Badge>
        </div>

        {/* Day list — only show in expert mode */}
        {isSimpleMode ? (
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              Este negocio controla su estado de apertura manualmente.
            </p>
          </div>
        ) : (
        <div className="px-3 py-2 space-y-0.5">
          {days.map((dayKey) => {
            const dayData = parsed[dayKey]
            const isToday = dayKey === todayKey
            const dayOpen = dayData && dayData.abierto

            return (
              <div
                key={dayKey}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors",
                  isToday && "bg-muted/80 font-semibold"
                )}
              >
                {/* Day name */}
                <div className="flex items-center gap-2 min-w-0">
                  {isToday && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <span
                    className={cn(
                      "min-w-[3rem]",
                      isToday
                        ? "text-foreground font-bold"
                        : "text-muted-foreground"
                    )}
                  >
                    {isToday ? "Hoy" : DIA_SHORT[dayKey]}
                  </span>
                </div>

                {/* Hours */}
                <div className="flex items-center gap-1.5 text-right">
                  {dayOpen ? (
                    <span className={cn("tabular-nums", isToday ? "text-foreground font-bold" : "text-foreground/80")}>
                      {formatTimeRange(dayData.apertura, dayData.cierre)}
                      {dayData.turno2 && dayData.apertura2 && dayData.cierre2 && (
                        <>
                          {" / "}
                          {formatTimeRange(dayData.apertura2, dayData.cierre2)}
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Cerrado</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center">
            {isSimpleMode ? "El estado se controla manualmente" : "Los horarios pueden variar en feriados"}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
