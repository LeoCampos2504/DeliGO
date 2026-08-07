/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  REVIEW_MODERATION_DECISION_MAX_LENGTH,
  parseReviewModerationDecisionBody,
  parseReviewModerationListParams,
} from "./review-moderation-superadmin"

describe("19-C - contratos puros superadmin", () => {
  test("decisiones e informacion usan body estricto y texto normalizado", () => {
    expect(parseReviewModerationDecisionBody({ motivoDecision: "  decision  " }, "motivoDecision")).toBe("decision")
    expect(parseReviewModerationDecisionBody({ mensaje: "  mensaje  " }, "mensaje")).toBe("mensaje")
    for (const body of [{}, { motivoDecision: "" }, { motivoDecision: "x", extra: true }, { motivoDecision: "x".repeat(REVIEW_MODERATION_DECISION_MAX_LENGTH + 1) }, { mensaje: 1 }]) {
      expect(parseReviewModerationDecisionBody(body, "motivoDecision")).toBeNull()
    }
  })

  test("listado acepta solo estado enum, pagina positiva y limite acotado", () => {
    expect(parseReviewModerationListParams(new URLSearchParams())).toEqual({ page: 1, limit: 20, estado: undefined })
    expect(parseReviewModerationListParams(new URLSearchParams("estado=EN_REVISION&page=2&limit=50"))).toEqual({ estado: "EN_REVISION", page: 2, limit: 50 })
    for (const query of ["estado=OTRO", "page=0", "page=1.5", "limit=0", "limit=51", "limit=abc"]) {
      expect(parseReviewModerationListParams(new URLSearchParams(query))).toBeNull()
    }
  })
})
