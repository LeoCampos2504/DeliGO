export const REVIEW_EVIDENCE_MAX_FILES = 5
export const REVIEW_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"]
const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"]

export type EvidenceSelectionFile = { name: string; size: number; type: string }
export type EvidenceTimelineFile = { id: string; nombrePresentacion: string; mimeType: string; bytes: number }

export function formatEvidenceBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`
  return `${Math.round(bytes / (1024 * 1024) * 10) / 10} MB`
}

export function isAllowedEvidenceSelection(file: EvidenceSelectionFile) {
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0]
  return allowedTypes.includes(file.type) && !!extension && allowedExtensions.includes(extension)
}

export function addEvidenceSelection<T extends EvidenceSelectionFile>(current: T[], added: T[]) {
  if (current.length + added.length > REVIEW_EVIDENCE_MAX_FILES) return { files: current, error: "Podés adjuntar hasta 5 archivos." }
  const invalid = added.find((file) => file.size > REVIEW_EVIDENCE_MAX_BYTES || !isAllowedEvidenceSelection(file))
  if (invalid) return { files: current, error: invalid.size > REVIEW_EVIDENCE_MAX_BYTES ? "Cada archivo puede pesar hasta 5 MB." : "Sólo se aceptan JPG, PNG, WEBP o PDF." }
  return { files: [...current, ...added], error: null }
}

export async function uploadEvidenceSequentially<T>(files: T[], upload: (file: T, index: number) => Promise<void>, progress?: (completed: number, total: number) => void) {
  const uploaded: T[] = []
  const failed: T[] = []
  for (let index = 0; index < files.length; index += 1) {
    try { await upload(files[index], index); uploaded.push(files[index]) } catch { failed.push(files[index]) }
    progress?.(index + 1, files.length)
  }
  return { uploaded, failed }
}

export async function submitInformationWithEvidence<T>(
  submitInformation: () => Promise<{ eventoId: string }>,
  files: T[],
  upload: (eventoId: string, file: T, index: number) => Promise<void>,
  progress?: (completed: number, total: number) => void,
) {
  const { eventoId } = await submitInformation()
  const result = await uploadEvidenceSequentially(files, (file, index) => upload(eventoId, file, index), progress)
  return { eventoId, ...result }
}

export function evidenceDownloadPath(role: "negocio" | "superadmin", solicitudId: string, evidenciaId: string) {
  const root = role === "negocio" ? "/api/negocio/solicitudes-revision-resenas" : "/api/superadmin/solicitudes-revision-resenas"
  return `${root}/${encodeURIComponent(solicitudId)}/evidencias/${encodeURIComponent(evidenciaId)}`
}

export function evidenceTimelineEntry(role: "negocio" | "superadmin", solicitudId: string, eventoId: string, evidencia: EvidenceTimelineFile) {
  return {
    eventoId,
    nombre: evidencia.nombrePresentacion,
    tamano: formatEvidenceBytes(evidencia.bytes),
    tipo: evidencia.mimeType,
    descarga: evidenceDownloadPath(role, solicitudId, evidencia.id),
  }
}
