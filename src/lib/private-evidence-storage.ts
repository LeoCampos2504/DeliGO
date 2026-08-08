import { randomUUID } from "crypto"
import { v2 as cloudinary } from "cloudinary"

const PRIVATE_RESOURCE_TYPE = "raw"
const PRIVATE_DELIVERY_TYPE = "authenticated"
const PRIVATE_DOWNLOAD_TTL_SECONDS = 60

export type PrivateEvidenceStorageConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
}

type CloudinaryOperationOptions = {
  cloud_name: string
  api_key: string
  api_secret: string
  secure: true
  resource_type: typeof PRIVATE_RESOURCE_TYPE
  type: typeof PRIVATE_DELIVERY_TYPE
}

export type PrivateEvidenceStorageClient = {
  uploader: {
    upload: (source: string, options: Record<string, unknown>) => Promise<{ public_id: string }>
    destroy: (storageKey: string, options: Record<string, unknown>) => Promise<{ result?: string }>
  }
  utils: {
    private_download_url: (storageKey: string, format: string, options: Record<string, unknown>) => string
  }
}

type PrivateEvidenceStorageFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type PrivateEvidenceStorageDependencies = {
  client?: PrivateEvidenceStorageClient
  fetcher?: PrivateEvidenceStorageFetcher
  now?: () => number
}

export class PrivateEvidenceStorageError extends Error {
  constructor(operation: "put" | "get" | "delete", options?: { cause?: unknown }) {
    super(`Private evidence storage ${operation} failed`, options)
    this.name = "PrivateEvidenceStorageError"
  }
}

export function generatePrivateEvidenceStorageKey() {
  return `review-moderation/${randomUUID()}`
}

function operationOptions(config: PrivateEvidenceStorageConfig): CloudinaryOperationOptions {
  return {
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
    resource_type: PRIVATE_RESOURCE_TYPE,
    type: PRIVATE_DELIVERY_TYPE,
  }
}

export function createPrivateEvidenceStorage(
  config: PrivateEvidenceStorageConfig,
  dependencies: PrivateEvidenceStorageDependencies = {},
) {
  const client = dependencies.client ?? (cloudinary as unknown as PrivateEvidenceStorageClient)
  const fetcher = dependencies.fetcher ?? fetch
  const now = dependencies.now ?? Date.now
  const options = operationOptions(config)

  return {
    async put({ bytes, storageKey, mimeType }: { bytes: Uint8Array; storageKey: string; mimeType: string }) {
      try {
        const result = await client.uploader.upload(`data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`, {
          ...options,
          public_id: storageKey,
          overwrite: false,
          unique_filename: false,
          use_filename: false,
        })

        if (result.public_id !== storageKey) {
          throw new Error("Unexpected private storage key")
        }

        return { storageKey }
      } catch (error) {
        throw new PrivateEvidenceStorageError("put", { cause: error })
      }
    },

    async get({ storageKey }: { storageKey: string }): Promise<Uint8Array> {
      try {
        const privateDownloadUrl = client.utils.private_download_url(storageKey, "", {
          ...options,
          expires_at: Math.floor(now() / 1000) + PRIVATE_DOWNLOAD_TTL_SECONDS,
          attachment: false,
        })
        const response = await fetcher(privateDownloadUrl, { redirect: "follow" })

        if (!response.ok) {
          throw new Error(`Private storage retrieval returned HTTP ${response.status}`)
        }

        return new Uint8Array(await response.arrayBuffer())
      } catch (error) {
        throw new PrivateEvidenceStorageError("get", { cause: error })
      }
    },

    async delete({ storageKey }: { storageKey: string }) {
      try {
        const result = await client.uploader.destroy(storageKey, {
          ...options,
          invalidate: true,
        })

        if (result.result !== "ok" && result.result !== "not found") {
          throw new Error("Unexpected private storage delete result")
        }
      } catch (error) {
        throw new PrivateEvidenceStorageError("delete", { cause: error })
      }
    },
  }
}
