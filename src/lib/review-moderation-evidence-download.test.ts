/// <reference types="bun-types" />

import { expect, test } from "bun:test"
import { reviewModerationEvidenceDownloadHeaders } from "./review-moderation-evidence-download"

test("download headers are private, attachment-only and safe against filename injection", () => {
  const headers = reviewModerationEvidenceDownloadHeaders({ mimeType: "application/pdf", nombrePresentacion: "bad\"\r\n/\\name.pdf" })
  expect(headers).toEqual({
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=\"bad_____name.pdf\"",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  })
  expect(JSON.stringify(headers)).not.toContain("storageKey")
  expect(JSON.stringify(headers)).not.toContain("http")
})
