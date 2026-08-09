import { createHash } from "crypto"

export const REVIEW_MODERATION_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024
export const REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT = 5
export const REVIEW_MODERATION_EVIDENCE_MAX_PER_REQUEST = 15 * 1024 * 1024

const formats = {
  jpeg: { mimeType: "image/jpeg", extensions: [".jpg", ".jpeg"], magic: (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  png: { mimeType: "image/png", extensions: [".png"], magic: (bytes: Uint8Array) => bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value) },
  webp: { mimeType: "image/webp", extensions: [".webp"], magic: (bytes: Uint8Array) => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
  pdf: { mimeType: "application/pdf", extensions: [".pdf"], magic: (bytes: Uint8Array) => bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-" },
} as const

type EvidenceFormat = keyof typeof formats

export class ReviewModerationEvidenceFileError extends Error {
  constructor(readonly code: "too_large" | "unsupported") {
    super(code === "too_large" ? "Evidence file is too large" : "Evidence file is not supported")
    this.name = "ReviewModerationEvidenceFileError"
  }
}

function extensionOf(name: string) {
  const match = /\.[^.]+$/.exec(name.toLowerCase())
  return match?.[0] ?? ""
}

function detectFormat(bytes: Uint8Array): EvidenceFormat | null {
  for (const [format, definition] of Object.entries(formats) as Array<[EvidenceFormat, (typeof formats)[EvidenceFormat]]>) {
    if (definition.magic(bytes)) return format
  }
  return null
}

export function sanitizeReviewModerationEvidenceFilename(name: string, format: EvidenceFormat) {
  const cleaned = name.replace(/[\\/\0\r\n\t]/g, "").replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 180)
  const base = cleaned.replace(/\.+$/g, "") || "evidencia"
  const extension = formats[format].extensions[0]
  return extensionOf(base) === extension ? base : `${base.replace(/\.[^.]+$/, "") || "evidencia"}${extension}`
}

export function validateReviewModerationEvidenceFile(input: { bytes: Uint8Array; mimeType: string; filename: string }) {
  if (input.bytes.byteLength > REVIEW_MODERATION_EVIDENCE_MAX_BYTES) throw new ReviewModerationEvidenceFileError("too_large")
  const format = detectFormat(input.bytes)
  if (!format) throw new ReviewModerationEvidenceFileError("unsupported")
  const definition = formats[format]
  if (input.mimeType.toLowerCase() !== definition.mimeType || !definition.extensions.includes(extensionOf(input.filename) as never)) {
    throw new ReviewModerationEvidenceFileError("unsupported")
  }
  return {
    bytes: input.bytes,
    mimeType: definition.mimeType,
    nombrePresentacion: sanitizeReviewModerationEvidenceFilename(input.filename, format),
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
  }
}
