import { v2 as cloudinary } from "cloudinary"
import { randomUUID } from "crypto"

// Configure Cloudinary from env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export { cloudinary }

// ============================================
// Allowed file extensions
// ============================================
const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"])
const ALLOWED_CHAT_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "pdf"])

// ============================================
// Folder constants (match Flask source)
// ============================================
export const CloudinaryFolders = {
  PRODUCTOS: (slug: string) => `productos/${slug}`,
  AGREGADOS: (slug: string) => `agregados/${slug}`,
  INGREDIENTES: (slug: string) => `ingredientes/${slug}`,
  LOGOS: (slug: string) => `logos/${slug}`,
  BANNERS: (slug: string) => `banners/${slug}`,
  FONDOS: (slug: string) => `fondos/${slug}`,
  CHAT: (pedidoId: string) => `chat/${pedidoId}`,
} as const

// ============================================
// Upload types
// ============================================
export type UploadCategory = "productos" | "agregados" | "ingredientes" | "logos" | "banners" | "fondos" | "chat"

export interface UploadResult {
  url: string
  publicId: string
}

// ============================================
// Helper: get file extension from filename
// ============================================
function getFileExtension(filename: string): string {
  const parts = filename.split(".")
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
}

function safePublicIdPart(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "")
  const cleaned = withoutExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return cleaned || "archivo"
}

// ============================================
// Upload image to Cloudinary
// ============================================
export async function uploadImage(
  file: File | Buffer,
  folder: string,
  filename?: string
): Promise<UploadResult | null> {
  try {
    let buffer: Buffer
    let originalName: string

    if (file instanceof File) {
      // Validate extension
      const ext = getFileExtension(file.name)
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        console.error(`Extension not allowed: ${ext}`)
        return null
      }
      buffer = Buffer.from(await file.arrayBuffer())
      originalName = file.name
    } else {
      // Buffer upload — no extension check possible
      buffer = file
      originalName = filename || "upload"
    }

    const result = await cloudinary.uploader.upload(
      `data:application/octet-stream;base64,${buffer.toString("base64")}`,
      {
        folder,
        overwrite: false,
        transformation: [{ width: 800, crop: "limit" }],
      }
    )

    return {
      url: result.secure_url,
      publicId: result.public_id,
    }
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error)
    return null
  }
}

// ============================================
// Upload file (PDF) to Cloudinary
// ============================================
export async function uploadFile(
  file: File | Buffer,
  folder: string,
  filename?: string
): Promise<UploadResult | null> {
  try {
    let buffer: Buffer
    let originalName: string

    if (file instanceof File) {
      const ext = getFileExtension(file.name)
      if (!ALLOWED_CHAT_EXTENSIONS.has(ext)) {
        console.error(`Extension not allowed: ${ext}`)
        return null
      }
      buffer = Buffer.from(await file.arrayBuffer())
      originalName = file.name
    } else {
      buffer = file
      originalName = filename || "upload"
    }

    const isPdf = originalName.toLowerCase().endsWith(".pdf")

    if (isPdf) {
      // Upload PDF as "raw" resource type — this is the correct way for non-image files
      // The URL returned will be directly accessible and downloadable
      const result = await cloudinary.uploader.upload(
        `data:application/pdf;base64,${buffer.toString("base64")}`,
        {
          folder,
          overwrite: false,
          resource_type: "raw",
          type: "upload",
          public_id: `${safePublicIdPart(originalName)}_${Date.now()}_${randomUUID().slice(0, 8)}`,
        }
      )

      return {
        url: result.secure_url,
        publicId: result.public_id,
      }
    } else {
      // Non-PDF file (image) — use standard image upload
      const result = await cloudinary.uploader.upload(
        `data:application/octet-stream;base64,${buffer.toString("base64")}`,
        {
          folder,
          overwrite: false,
          transformation: [{ width: 800, crop: "limit" }],
        }
      )

      return {
        url: result.secure_url,
        publicId: result.public_id,
      }
    }
  } catch (error) {
    console.error("Error uploading file to Cloudinary:", error)
    return null
  }
}

// ============================================
// Get a viewable URL for a PDF stored in Cloudinary
// Cloudinary raw URLs serve the PDF directly with correct content-type,
// so the browser/react-pdf can render them inline without any wrapper.
// ============================================
export function getPdfViewUrl(archivoUrl: string): string {
  if (!archivoUrl) return archivoUrl
  // Return the URL as-is — react-pdf fetches and renders it directly
  return archivoUrl
}

// ============================================
// Get a direct download URL for a PDF stored in Cloudinary
// ============================================
export function getPdfDownloadUrl(archivoUrl: string): string {
  if (!archivoUrl) return archivoUrl

  // For Cloudinary URLs, add fl_attachment flag to force download
  if (archivoUrl.includes("res.cloudinary.com") && archivoUrl.includes("/raw/upload/")) {
    return archivoUrl.replace("/raw/upload/", "/raw/upload/fl_attachment/")
  }

  return archivoUrl
}

// ============================================
// Delete image from Cloudinary by public_id
// ============================================
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId)
    return true
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error)
    return false
  }
}

// ============================================
// Extract public_id from a Cloudinary URL
// ============================================
export function extractPublicId(url: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com") return null
    if (parsed.username || parsed.password || parsed.port) return null

    const parts = parsed.pathname.split("/").filter(Boolean)
    if (parts.length < 4) return null

    const [cloudName, resourceType, action, ...resourceParts] = parts
    if (process.env.CLOUDINARY_CLOUD_NAME && cloudName !== process.env.CLOUDINARY_CLOUD_NAME) return null
    if ((resourceType !== "image" && resourceType !== "raw") || action !== "upload") return null

    const versionIndex = resourceParts.findIndex((part) => /^v\d+$/.test(part))
    const publicIdParts = versionIndex >= 0 ? resourceParts.slice(versionIndex + 1) : resourceParts
    if (publicIdParts.length === 0) return null

    const publicPath = publicIdParts.join("/")
    if (publicPath.includes("..") || publicPath.includes("\\")) return null

    const withoutExtension = publicPath.replace(/\.[^.]+$/, "")
    if (!withoutExtension.startsWith("chat/")) return null
    return withoutExtension
  } catch {
    return null
  }
}
