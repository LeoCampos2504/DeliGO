/// <reference types="bun-types" />
import { expect, test } from "bun:test"
import { addEvidenceSelection, evidenceDownloadPath, evidenceTimelineEntry, formatEvidenceBytes, submitInformationWithEvidence, uploadEvidenceSequentially } from "./review-moderation-evidence-ui"

const png = { name: "e.png", size: 1200, type: "image/png" }
test("selects allowed files, limits selection, removes by caller and formats bytes", () => {
  expect(addEvidenceSelection([], [png]).files).toEqual([png])
  expect(addEvidenceSelection([], Array.from({ length: 6 }, () => png)).error).toContain("5")
  expect(addEvidenceSelection([], [{ ...png, size: 5 * 1024 * 1024 + 1 }]).error).toContain("5 MB")
  expect(addEvidenceSelection([], [{ ...png, name: "x.svg", type: "image/svg+xml" }]).error).toContain("JPG")
  expect(formatEvidenceBytes(850)).toBe("850 B"); expect(formatEvidenceBytes(120 * 1024)).toBe("120 KB"); expect(formatEvidenceBytes(1.4 * 1024 * 1024)).toBe("1.4 MB")
})
test("uploads sequentially, preserves successes and exposes only failures for retry", async () => {
  const calls: string[] = []
  const result = await uploadEvidenceSequentially(["a", "b", "c"], async (file) => { calls.push(file); if (file === "b") throw new Error("fail") })
  expect(calls).toEqual(["a", "b", "c"]); expect(result.uploaded).toEqual(["a", "c"]); expect(result.failed).toEqual(["b"])
})
test("uses only internal download paths", () => {
  expect(evidenceDownloadPath("negocio", "s", "e")).toBe("/api/negocio/solicitudes-revision-resenas/s/evidencias/e")
  expect(evidenceDownloadPath("superadmin", "s", "e")).toContain("/api/superadmin/")
})

test("builds safe timeline metadata under its event for business and superadmin", () => {
  const evidence = { id: "evidence-1", nombrePresentacion: "documento.pdf", mimeType: "application/pdf", bytes: 2048 }
  const business = evidenceTimelineEntry("negocio", "request-1", "event-business", evidence)
  const superadmin = evidenceTimelineEntry("superadmin", "request-1", "event-superadmin", evidence)
  expect(business).toEqual({ eventoId: "event-business", nombre: "documento.pdf", tamano: "2 KB", tipo: "application/pdf", descarga: "/api/negocio/solicitudes-revision-resenas/request-1/evidencias/evidence-1" })
  expect(superadmin.eventoId).toBe("event-superadmin")
  expect(superadmin.descarga).toBe("/api/superadmin/solicitudes-revision-resenas/request-1/evidencias/evidence-1")
  expect(JSON.stringify({ business, superadmin })).not.toContain("storageKey")
  expect(JSON.stringify({ business, superadmin })).not.toContain("cloudinary")
})

test("submits information before sequential uploads and retries only pending files", async () => {
  const calls: string[] = []
  const result = await submitInformationWithEvidence(
    async () => { calls.push("information"); return { eventoId: "event-1" } },
    ["first", "second"],
    async (eventoId, file) => {
      calls.push(`${eventoId}:${file}`)
      if (file === "second") throw new Error("upload failed")
    },
  )

  expect(calls).toEqual(["information", "event-1:first", "event-1:second"])
  expect(result.uploaded).toEqual(["first"])
  expect(result.failed).toEqual(["second"])

  const retry = await uploadEvidenceSequentially(result.failed, async (file) => { calls.push(`retry:${file}`) })
  expect(retry.uploaded).toEqual(["second"])
  expect(calls).not.toContain("retry:first")
})
