/// <reference types="bun-types" />

import { createHash, randomUUID } from "crypto"
import { describe, expect, test } from "bun:test"
import { v2 as cloudinary } from "cloudinary"
import { createPrivateEvidenceStorage } from "./private-evidence-storage"

const tinyPng = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL3WAAAAABJRU5ErkJggg==",
    "base64",
  ),
)
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const config = {
  cloudName: process.env.CLOUDINARY_TEST_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_TEST_API_KEY,
  apiSecret: process.env.CLOUDINARY_TEST_API_SECRET,
}
const hasTestConfig = Boolean(config.cloudName && config.apiKey && config.apiSecret)

describe("private evidence storage integration", () => {
  test("uses only the isolated authenticated TESTING cloud and removes its exact fixture", async () => {
    if (!hasTestConfig) {
      throw new Error("CLOUDINARY_TEST_CONFIG_INCOMPLETA")
    }
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME === config.cloudName) {
      throw new Error("TEST_CLOUD_MUST_DIFFER_FROM_DEFAULT_CLOUD")
    }

    const storageKey = `test-t19f0-${randomUUID()}`
    const storage = createPrivateEvidenceStorage({
      cloudName: config.cloudName!,
      apiKey: config.apiKey!,
      apiSecret: config.apiSecret!,
    })
    const originalSha256 = sha256(tinyPng)
    let deleted = false

    try {
      await expect(storage.put({ bytes: tinyPng, storageKey, mimeType: "image/png" })).resolves.toEqual({ storageKey })

      const ordinaryPublicUrl = cloudinary.url(storageKey, {
        cloud_name: config.cloudName!,
        secure: true,
        resource_type: "raw",
        type: "upload",
      })
      const publicResponse = await fetch(ordinaryPublicUrl, { redirect: "follow" })
      const publicBytes = new Uint8Array(await publicResponse.arrayBuffer())
      const publicBytesExposed = publicResponse.status === 200 && sha256(publicBytes) === originalSha256

      expect(publicBytesExposed).toBe(false)
      expect(await storage.get({ storageKey })).toEqual(tinyPng)
      expect(sha256(await storage.get({ storageKey }))).toBe(originalSha256)

      await storage.delete({ storageKey })
      deleted = true
      await expect(storage.get({ storageKey })).rejects.toThrow("Private evidence storage get failed")
    } finally {
      if (!deleted) {
        await storage.delete({ storageKey })
      }
    }
  })
})
