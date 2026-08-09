/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { REVIEW_MODERATION_EVIDENCE_MAX_BYTES, ReviewModerationEvidenceFileError, validateReviewModerationEvidenceFile } from "./review-moderation-evidence-file"

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00])
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const pdf = new TextEncoder().encode("%PDF-1.7")
const supportedFiles: Array<[Uint8Array, "image/jpeg" | "image/png" | "image/webp" | "application/pdf", string]> = [
  [jpeg, "image/jpeg", "archivo.jpeg"],
  [png, "image/png", "archivo.png"],
  [webp, "image/webp", "archivo.webp"],
  [pdf, "application/pdf", "archivo.pdf"],
]

describe("review moderation evidence file validation", () => {
  test.each(supportedFiles)("accepts the supported real signature", (bytes, mimeType, filename) => {
    expect(validateReviewModerationEvidenceFile({ bytes, mimeType, filename }).mimeType).toBe(mimeType)
  })

  test("rejects mismatched MIME, extension, unsafe names and arbitrary bytes", () => {
    expect(() => validateReviewModerationEvidenceFile({ bytes: png, mimeType: "image/jpeg", filename: "archivo.jpg" })).toThrow(ReviewModerationEvidenceFileError)
    expect(() => validateReviewModerationEvidenceFile({ bytes: new TextEncoder().encode("<html>"), mimeType: "application/pdf", filename: "../../x.pdf" })).toThrow(ReviewModerationEvidenceFileError)
    expect(() => validateReviewModerationEvidenceFile({ bytes: png, mimeType: "image/png", filename: "../a.png" })).not.toThrow()
  })

  test("enforces the exact five MiB boundary", () => {
    const exact = new Uint8Array(REVIEW_MODERATION_EVIDENCE_MAX_BYTES)
    exact.set(png)
    expect(validateReviewModerationEvidenceFile({ bytes: exact, mimeType: "image/png", filename: "e.png" }).bytes.byteLength).toBe(REVIEW_MODERATION_EVIDENCE_MAX_BYTES)
    const over = new Uint8Array(REVIEW_MODERATION_EVIDENCE_MAX_BYTES + 1)
    over.set(png)
    expect(() => validateReviewModerationEvidenceFile({ bytes: over, mimeType: "image/png", filename: "e.png" })).toThrow("too large")
  })
})
