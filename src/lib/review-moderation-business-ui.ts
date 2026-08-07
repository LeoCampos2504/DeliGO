export type BusinessReviewModerationStatus = "PENDIENTE" | "EN_REVISION" | "REQUIERE_INFORMACION" | "APROBADA" | "RECHAZADA" | "RESTAURADA_AUTOMATICAMENTE"

const ACTIVE = new Set<BusinessReviewModerationStatus>(["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"])

export function getBusinessModerationStatusCopy(status: BusinessReviewModerationStatus) {
  return {
    PENDIENTE: { label: "Pendiente", description: "La solicitud fue enviada y está pendiente de revisión." },
    EN_REVISION: { label: "En revisión", description: "La solicitud está siendo revisada." },
    REQUIERE_INFORMACION: { label: "Se requiere información", description: "Se necesita información adicional para continuar." },
    APROBADA: { label: "Aprobada", description: "La solicitud fue aprobada y la reseña dejó de publicarse." },
    RECHAZADA: { label: "Rechazada", description: "La solicitud fue rechazada y la reseña volvió a publicarse." },
    RESTAURADA_AUTOMATICAMENTE: { label: "Restaurada", description: "La revisión no se resolvió dentro del plazo y la reseña volvió a publicarse." },
  }[status]
}

export function canBusinessRequestReview(estadoModeracion: string, status?: BusinessReviewModerationStatus | null) {
  return estadoModeracion === "PUBLICADA" && (!status || !ACTIVE.has(status))
}

export function getBusinessModerationEventLabel(tipo: string) {
  return {
    SOLICITUD_CREADA: "Solicitud enviada",
    TOMADA_EN_REVISION: "En revisión",
    INFORMACION_REQUERIDA: "El equipo solicitó más información",
    INFORMACION_APORTADA: "Información adicional enviada",
    APROBADA: "Solicitud aprobada",
    RECHAZADA: "Solicitud rechazada",
    RESTAURADA_AUTOMATICAMENTE: "Solicitud restaurada",
  }[tipo] ?? "Actualización de la solicitud"
}
