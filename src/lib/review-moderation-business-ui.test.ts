/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { canBusinessRequestReview, getBusinessModerationEventLabel, getBusinessModerationStatusCopy } from "./review-moderation-business-ui"

describe("19-D - mapeos UI de moderacion Negocio", () => {
  test("cubre todos los estados sin exponer enums al usuario", () => {
    for (const status of ["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION", "APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"] as const) {
      expect(getBusinessModerationStatusCopy(status).label).not.toBe(status)
      expect(getBusinessModerationStatusCopy(status).description.length).toBeGreaterThan(10)
    }
  })

  test("solo ofrece nueva solicitud si la resena es publica y no hay expediente activo", () => {
    expect(canBusinessRequestReview("PUBLICADA", null)).toBe(true)
    expect(canBusinessRequestReview("PUBLICADA", "RECHAZADA")).toBe(true)
    expect(canBusinessRequestReview("PUBLICADA", "PENDIENTE")).toBe(false)
    expect(canBusinessRequestReview("OCULTA_EN_REVISION", null)).toBe(false)
    expect(getBusinessModerationEventLabel("INFORMACION_APORTADA")).toBe("Información adicional enviada")
  })
})
