export function reviewModerationEvidenceDownloadHeaders(input: { mimeType: string; nombrePresentacion: string }) {
  const safeName = input.nombrePresentacion.replace(/[\r\n"\\/]/g, "_") || "evidencia"
  return {
    "Content-Type": input.mimeType,
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  }
}
