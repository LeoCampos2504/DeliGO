/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import {
  REVIEW_MODERATION_TTL_DAYS, canReviewModerationTransition, canUseReviewModerationInformationExtension,
  getReviewModerationActiveKey, getReviewModerationExpiry, getReviewModerationTransition,
  isReviewModerationExpiryCandidate, isReviewModerationRequestActive, isReviewPublic, summarizePublicReviewRating,
} from "./review-moderation-policy"

describe("19-A — contrato puro de moderación de reseñas", () => {
  test("visibilidad pública", () => {
    expect(isReviewPublic("PUBLICADA")).toBe(true)
    expect(isReviewPublic("OCULTA_EN_REVISION")).toBe(false)
    expect(isReviewPublic("ELIMINADA_POR_MODERACION")).toBe(false)
  })

  test("transiciones permitidas", () => {
    expect(getReviewModerationTransition(null, "CREAR")).toBe("PENDIENTE")
    expect(getReviewModerationTransition("PENDIENTE", "TOMAR_EN_REVISION")).toBe("EN_REVISION")
    expect(getReviewModerationTransition("PENDIENTE", "PEDIR_INFORMACION")).toBe("REQUIERE_INFORMACION")
    expect(getReviewModerationTransition("EN_REVISION", "PEDIR_INFORMACION")).toBe("REQUIERE_INFORMACION")
    expect(getReviewModerationTransition("REQUIERE_INFORMACION", "APORTAR_INFORMACION")).toBe("EN_REVISION")
    for (const status of ["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"] as const) {
      expect(getReviewModerationTransition(status, "APROBAR")).toBe("APROBADA")
      expect(getReviewModerationTransition(status, "RECHAZAR")).toBe("RECHAZADA")
      expect(getReviewModerationTransition(status, "EXPIRAR")).toBe("RESTAURADA_AUTOMATICAMENTE")
    }
  })

  test("terminales e inválidas no transicionan", () => {
    expect(canReviewModerationTransition("PENDIENTE", "APORTAR_INFORMACION")).toBe(false)
    expect(canReviewModerationTransition("EN_REVISION", "TOMAR_EN_REVISION")).toBe(false)
    expect(canReviewModerationTransition("REQUIERE_INFORMACION", "PEDIR_INFORMACION")).toBe(false)
    for (const status of ["APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"] as const) {
      expect(canReviewModerationTransition(status, "APROBAR")).toBe(false)
      expect(canReviewModerationTransition(status, "RECHAZAR")).toBe(false)
      expect(isReviewModerationRequestActive(status)).toBe(false)
    }
  })

  test("activeKey, TTL y prórroga única", () => {
    for (const status of ["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"] as const) {
      expect(getReviewModerationActiveKey("review-1", status)).toBe("review-1")
      expect(isReviewModerationRequestActive(status)).toBe(true)
    }
    for (const status of ["APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"] as const) {
      expect(getReviewModerationActiveKey("review-1", status)).toBeNull()
    }
    expect(getReviewModerationExpiry(new Date("2026-08-07T00:00:00.000Z")).toISOString()).toBe("2026-08-21T00:00:00.000Z")
    expect(REVIEW_MODERATION_TTL_DAYS).toBe(14)
    expect(canUseReviewModerationInformationExtension("REQUIERE_INFORMACION", false)).toBe(true)
    expect(canUseReviewModerationInformationExtension("REQUIERE_INFORMACION", true)).toBe(false)
    expect(canUseReviewModerationInformationExtension("EN_REVISION", false)).toBe(false)
  })

  test("19-G — candidatura de vencimiento automático usa venceEn persistido, nunca un conteo recalculado", () => {
    const now = new Date("2026-08-09T12:00:00.000Z")
    const vencida = new Date("2026-08-09T11:59:59.999Z")
    const exacta = now
    const futura = new Date("2026-08-09T12:00:00.001Z")
    const prorrogaFutura = new Date("2026-09-01T00:00:00.000Z")

    for (const estado of ["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"] as const) {
      expect(isReviewModerationExpiryCandidate({ estado, venceEn: vencida }, now)).toBe(true)
      // fecha exactamente igual a `now` = vencida (`<=`)
      expect(isReviewModerationExpiryCandidate({ estado, venceEn: exacta }, now)).toBe(true)
      expect(isReviewModerationExpiryCandidate({ estado, venceEn: futura }, now)).toBe(false)
      // Una prórroga ya aplicada (19-D) mueve `venceEn` hacia el futuro — la
      // política sólo mira ese valor persistido, nunca recalcula desde
      // `createdAt`, así que una solicitud "conceptualmente vieja" con
      // prórroga futura NO es candidata.
      expect(isReviewModerationExpiryCandidate({ estado, venceEn: prorrogaFutura }, now)).toBe(false)
    }

    for (const estado of ["APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"] as const) {
      expect(isReviewModerationExpiryCandidate({ estado, venceEn: vencida }, now)).toBe(false)
    }
  })

  test("rating público incluye solamente PUBLICADA sin nuevo rounding", () => {
    const before = summarizePublicReviewRating([
      { puntuacion: 5, estadoModeracion: "PUBLICADA" }, { puntuacion: 2, estadoModeracion: "PUBLICADA" }, { puntuacion: 4, estadoModeracion: "PUBLICADA" },
    ])
    expect(before).toEqual({ total: 3, promedio: 11 / 3, distribucion: { 1: 0, 2: 1, 3: 0, 4: 1, 5: 1 } })
    const hidden = summarizePublicReviewRating([
      { puntuacion: 5, estadoModeracion: "PUBLICADA" }, { puntuacion: 2, estadoModeracion: "OCULTA_EN_REVISION" }, { puntuacion: 4, estadoModeracion: "ELIMINADA_POR_MODERACION" },
    ])
    expect(hidden).toEqual({ total: 1, promedio: 5, distribucion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } })
    expect(summarizePublicReviewRating([
      { puntuacion: 5, estadoModeracion: "PUBLICADA" }, { puntuacion: 2, estadoModeracion: "PUBLICADA" }, { puntuacion: 4, estadoModeracion: "PUBLICADA" },
    ])).toEqual(before)
    expect(summarizePublicReviewRating([])).toEqual({ total: 0, promedio: 0, distribucion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  })
})

describe("19-A — contrato estático de schema y migración", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync("prisma/migrations/20260807000000_add_review_moderation_contract/migration.sql", "utf8")

  test("schema declara default, relación compuesta, activeKey e índices", () => {
    expect(schema).toContain("estadoModeracion EstadoModeracionResena @default(PUBLICADA)")
    expect(schema).toContain("@@unique([id, negocioId])")
    expect(schema).toContain("activeKey                String?                       @unique")
    expect(schema).toContain("fields: [resenaId, negocioId], references: [id, negocioId], onDelete: Restrict")
    expect(schema).toContain("@@index([estado, venceEn])")
    expect(schema).toContain("@@index([solicitudId, createdAt])")
  })

  test("migración es aditiva y contiene unique/check/FKs restrict", () => {
    expect(migration).toContain('CREATE TYPE "EstadoModeracionResena"')
    expect(migration).toContain('CREATE TABLE "solicitudes_revision_resena"')
    expect(migration).toContain('CREATE TABLE "solicitudes_revision_resena_eventos"')
    expect(migration).toContain('CREATE TABLE "evidencias_solicitud_revision_resena"')
    expect(migration).toContain('"solicitudes_revision_resena_activeKey_estado_check" CHECK')
    expect(migration).toContain('CREATE UNIQUE INDEX "solicitudes_revision_resena_activeKey_key"')
    expect(migration).toContain('FOREIGN KEY ("resenaId", "negocioId") REFERENCES "resenas"("id", "negocioId")')
    expect(migration).toContain("ON DELETE RESTRICT")
    expect(migration).not.toMatch(/DROP\s+TABLE\s+"?resenas"?/i)
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(migration).not.toMatch(/\bTRUNCATE\b/i)
  })
})
