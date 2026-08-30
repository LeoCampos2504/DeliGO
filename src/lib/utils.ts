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

export { isNegocioOpen } from "./business-hours"
