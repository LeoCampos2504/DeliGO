/// <reference types="bun-types" />

import { expect, test } from "bun:test"
import { PrivateEvidenceStorageNotConfiguredError, getPrivateEvidenceStorage } from "./private-evidence-storage-runtime"

test("private evidence runtime never falls back to the public Cloudinary environment", () => {
  const names = ["PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME", "PRIVATE_EVIDENCE_CLOUDINARY_API_KEY", "PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const
  const previous = names.map((name) => process.env[name])
  try {
    delete process.env.PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME
    delete process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_KEY
    delete process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET
    process.env.CLOUDINARY_CLOUD_NAME = "public-cloud"
    process.env.CLOUDINARY_API_KEY = "public-key"
    process.env.CLOUDINARY_API_SECRET = "public-secret"
    expect(() => getPrivateEvidenceStorage()).toThrow(PrivateEvidenceStorageNotConfiguredError)
  } finally {
    names.forEach((name, index) => { if (previous[index]) process.env[name] = previous[index]; else delete process.env[name] })
  }
})

test("private evidence runtime is lazy and creates an adapter only with its dedicated variables", () => {
  const names = ["PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME", "PRIVATE_EVIDENCE_CLOUDINARY_API_KEY", "PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET"] as const
  const previous = names.map((name) => process.env[name])
  try {
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME = "private-cloud"
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_KEY = "private-key"
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET = "private-secret"
    const storage = getPrivateEvidenceStorage()
    expect(storage).toHaveProperty("put")
    expect(storage).toHaveProperty("get")
    expect(storage).toHaveProperty("delete")
  } finally {
    names.forEach((name, index) => { if (previous[index]) process.env[name] = previous[index]; else delete process.env[name] })
  }
})
