import { createPrivateEvidenceStorage } from "@/lib/private-evidence-storage"

export class PrivateEvidenceStorageNotConfiguredError extends Error {
  constructor() {
    super("Private evidence storage is not configured")
    this.name = "PrivateEvidenceStorageNotConfiguredError"
  }
}

export function getPrivateEvidenceStorage() {
  const cloudName = process.env.PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_KEY
  const apiSecret = process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new PrivateEvidenceStorageNotConfiguredError()
  }

  return createPrivateEvidenceStorage({ cloudName, apiKey, apiSecret })
}
