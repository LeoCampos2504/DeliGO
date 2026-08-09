/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { getClientReviewVisibility } from "./review-moderation-policy"
import { getClientReviewVisibilityCopy } from "./review-moderation-client-ui"

describe("19-H1 — estado y copy neutral del Cliente autor", () => {
  test("mapea el enum interno de moderación al estado sanitizado esperado", () => {
    expect(getClientReviewVisibility("PUBLICADA")).toBe("publicada")
    expect(getClientReviewVisibility("OCULTA_EN_REVISION")).toBe("en_revision")
    expect(getClientReviewVisibility("ELIMINADA_POR_MODERACION")).toBe("no_publicada")
  })

  test("copy neutral exacto por estado, sin mencionar actor/motivo/culpabilidad", () => {
    expect(getClientReviewVisibilityCopy("publicada")).toBe("Tu reseña")
    expect(getClientReviewVisibilityCopy("en_revision")).toBe("Tu reseña está temporalmente en revisión.")
    expect(getClientReviewVisibilityCopy("no_publicada")).toBe("Tu reseña ya no está publicada.")

    for (const visibility of ["en_revision", "no_publicada"] as const) {
      const copy = getClientReviewVisibilityCopy(visibility)
      expect(copy).not.toMatch(/negocio|solicit|denunci|superadmin|investig|cuenta|incumpl/i)
    }
  })
})
