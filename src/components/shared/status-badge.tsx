"use client"

import { Badge } from "@/components/ui/badge"
import { cn, statusEmoji, statusLabel } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  className?: string
  showEmoji?: boolean
}

const statusColorMap: Record<string, string> = {
  recibido: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  confirmado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  preparando: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  en_camino: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  listo_para_retirar: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  entregado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
}

export function StatusBadge({
  status,
  className,
  showEmoji = true,
}: StatusBadgeProps) {
  const colorClass = statusColorMap[status] || "bg-muted text-muted-foreground"

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-semibold px-2.5 py-0.5 border-0",
        colorClass,
        className
      )}
    >
      {showEmoji && <span className="mr-1">{statusEmoji(status)}</span>}
      {statusLabel(status)}
    </Badge>
  )
}
