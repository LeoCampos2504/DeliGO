import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as Argentine Peso: "$1.234,56"
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

/**
 * Format meters into a human-readable distance: "1.2 km" or "350 m"
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

/**
 * Relative time in Spanish: "hace 5 min", "hace 2 horas", etc.
 */
export function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return "hace un momento"
  if (diffMinutes < 60) return `hace ${diffMinutes} min`
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`
  if (diffDays < 30) return `hace ${diffDays} día${diffDays > 1 ? "s" : ""}`

  return new Date(date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  })
}

/**
 * Generate a URL-safe slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Spaces to hyphens
    .replace(/-+/g, "-") // Multiple hyphens to one
    .replace(/^-|-$/g, "") // Trim hyphens
}

/**
 * Get emoji for order status
 */
export function statusEmoji(status: string): string {
  const map: Record<string, string> = {
    recibido: "📩",
    confirmado: "✅",
    preparando: "👨‍🍳",
    en_camino: "🛵",
    listo_para_retirar: "📦",
    entregado: "🎉",
    cancelado: "❌",
  }
  return map[status] || "📋"
}

/**
 * Get Spanish label for order status
 */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    recibido: "Recibido",
    confirmado: "Confirmado",
    preparando: "Preparando",
    en_camino: "En camino",
    listo_para_retirar: "Listo para retirar",
    entregado: "Entregado",
    cancelado: "Cancelado",
  }
  return map[status] || status
}

/**
 * Check if a business is currently open based on its horarios JSON string
 * horarios format: { "1": { abierto: true, apertura: "09:00", cierre: "22:00", turno2: false, apertura2: "", cierre2: "" }, ... }
 * Keys 1-7 = Monday-Sunday (ISO)
 *
 * If horarioMode is "simple", returns abiertoManual directly (no schedule check).
 */
export function isNegocioOpen(horarios: string, horarioMode?: string, abiertoManual?: boolean): boolean {
  // Simple mode: use manual toggle
  if (horarioMode === "simple") {
    return abiertoManual ?? true
  }

  // Expert mode: check schedule
  try {
    const horariosObj = JSON.parse(horarios)
    const now = new Date()
    const dayOfWeek = now.getDay() || 7 // Convert Sunday=0 to 7
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

    // Check today's schedule — for overnight shifts, only the evening part applies (>= apertura)
    const todaySchedule = horariosObj[String(dayOfWeek)]
    if (todaySchedule && todaySchedule.abierto !== false) {
      const checkTodayRange = (apertura: string, cierre: string): boolean => {
        if (!apertura || !cierre) return false
        if (cierre < apertura) {
          // Overnight: for today only check if we're in the evening part (past apertura)
          // The morning part (before cierre) is handled by checking yesterday's schedule
          return currentTime >= apertura
        }
        // Normal range
        return currentTime >= apertura && currentTime <= cierre
      }

      if (checkTodayRange(todaySchedule.apertura, todaySchedule.cierre)) return true
      if (todaySchedule.turno2 && checkTodayRange(todaySchedule.apertura2, todaySchedule.cierre2)) return true
    }

    // Check yesterday's schedule for overnight shifts extending into today's early morning
    const yesterday = dayOfWeek === 1 ? 7 : dayOfWeek - 1
    const yesterdaySchedule = horariosObj[String(yesterday)]
    if (yesterdaySchedule && yesterdaySchedule.abierto !== false) {
      const checkYesterdayOvernight = (apertura: string, cierre: string): boolean => {
        if (!apertura || !cierre) return false
        // Only overnight ranges from yesterday can extend into today
        if (cierre < apertura) {
          // We're in the morning part of yesterday's overnight shift
          return currentTime <= cierre
        }
        return false
      }

      if (checkYesterdayOvernight(yesterdaySchedule.apertura, yesterdaySchedule.cierre)) return true
      if (yesterdaySchedule.turno2 && checkYesterdayOvernight(yesterdaySchedule.apertura2, yesterdaySchedule.cierre2)) return true
    }

    return false
  } catch {
    return false
  }
}
