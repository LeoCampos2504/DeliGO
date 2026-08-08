/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  createPrivateEvidenceStorage,
  generatePrivateEvidenceStorageKey,
  PrivateEvidenceStorageError,
  type PrivateEvidenceStorageClient,
} from "./private-evidence-storage"

const config = {
  cloudName: "test-cloud",
  apiKey: "test-key",
  apiSecret: "test-secret",
}

function createClient() {
  const uploads: Array<{ source: string; options: Record<string, unknown> }> = []
  const destroys: Array<{ storageKey: string; options: Record<string, unknown> }> = []
  const downloadOptions: Array<Record<string, unknown>> = []
  const client: PrivateEvidenceStorageClient = {
    uploader: {
      upload: async (source, options) => {
        uploads.push({ source, options })
        return { public_id: String(options.public_id) }
      },
      destroy: async (storageKey, options) => {
        destroys.push({ storageKey, options })
        return { result: "ok" }
      },
    },
    utils: {
      private_download_url: (_storageKey, _format, options) => {
        downloadOptions.push(options)
        return "https://internal.example.test/download"
      },
    },
  }

  return { client, uploads, destroys, downloadOptions }
}

describe("private evidence storage", () => {
  test("generates opaque review-moderation keys without environment input", () => {
    const first = generatePrivateEvidenceStorageKey()
    const second = generatePrivateEvidenceStorageKey()

    expect(first).toStartWith("review-moderation/")
    expect(second).toStartWith("review-moderation/")
    expect(first).not.toBe(second)
  })

  test("puts raw authenticated bytes without returning a delivery reference", async () => {
    const { client, uploads } = createClient()
    const storage = createPrivateEvidenceStorage(config, { client })

    const result = await storage.put({
      bytes: new Uint8Array([1, 2, 3]),
      storageKey: "review-moderation/opaque-key",
      mimeType: "image/png",
    })

    expect(result).toEqual({ storageKey: "review-moderation/opaque-key" })
    expect(Object.keys(result)).toEqual(["storageKey"])
    expect(uploads).toHaveLength(1)
    expect(uploads[0].source).toStartWith("data:image/png;base64,")
    expect(uploads[0].options).toMatchObject({
      cloud_name: "test-cloud",
      api_key: "test-key",
      api_secret: "test-secret",
      resource_type: "raw",
      type: "authenticated",
      public_id: "review-moderation/opaque-key",
      overwrite: false,
      unique_filename: false,
      use_filename: false,
    })
  })

  test("gets bytes through an internal short-lived signed request", async () => {
    const { client, downloadOptions } = createClient()
    let requestedUrl = ""
    const storage = createPrivateEvidenceStorage(config, {
      client,
      now: () => 1_700_000_000_000,
      fetcher: async (url) => {
        requestedUrl = String(url)
        return new Response(new Uint8Array([9, 8, 7]), { status: 200 })
      },
    })

    await expect(storage.get({ storageKey: "review-moderation/opaque-key" })).resolves.toEqual(new Uint8Array([9, 8, 7]))
    expect(requestedUrl).toBe("https://internal.example.test/download")
    expect(downloadOptions[0]).toMatchObject({
      cloud_name: "test-cloud",
      resource_type: "raw",
      type: "authenticated",
      expires_at: 1_700_000_060,
      attachment: false,
    })
  })

  test("deletes exactly one authenticated raw object and accepts an idempotent missing result", async () => {
    const { client, destroys } = createClient()
    client.uploader.destroy = async (storageKey, options) => {
      destroys.push({ storageKey, options })
      return { result: "not found" }
    }
    const storage = createPrivateEvidenceStorage(config, { client })

    await expect(storage.delete({ storageKey: "review-moderation/opaque-key" })).resolves.toBeUndefined()
    expect(destroys).toEqual([
      {
        storageKey: "review-moderation/opaque-key",
        options: expect.objectContaining({ resource_type: "raw", type: "authenticated", invalidate: true }),
      },
    ])
  })

  test("sanitizes provider and retrieval failures", async () => {
    const { client } = createClient()
    client.uploader.upload = async () => {
      throw new Error("provider detail")
    }
    const storage = createPrivateEvidenceStorage(config, { client })

    await expect(
      storage.put({ bytes: new Uint8Array([1]), storageKey: "review-moderation/opaque-key", mimeType: "image/png" }),
    ).rejects.toBeInstanceOf(PrivateEvidenceStorageError)
    await expect(
      storage.put({ bytes: new Uint8Array([1]), storageKey: "review-moderation/opaque-key", mimeType: "image/png" }),
    ).rejects.toThrow("Private evidence storage put failed")
  })
})
