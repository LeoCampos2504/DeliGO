import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { validateSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

// ============================================
// Allowed file types
// ============================================
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
])

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  ...ALLOWED_IMAGE_TYPES,
])

const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10MB
const MAX_FILE_SIZE = 5 * 1024 * 1024     // 5MB

// Category → folder mapping
const CATEGORY_FOLDERS: Record<string, string> = {
  productos: "productos",
  agregados: "agregados",
  ingredientes: "ingredientes",
  logos: "logos",
  banners: "banners",
  fondos: "fondos",
  chat: "chat",
}

// ============================================
// Try Cloudinary upload (if configured)
// ============================================
async function tryCloudinaryUpload(
  file: File,
  category: string,
  slug: string,
  type: string
): Promise<{ url: string; publicId: string } | null> {
  try {
    // Check if Cloudinary is configured
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return null // Not configured, fall back to local
    }

    const { CloudinaryFolders, uploadImage, uploadFile } = await import("@/lib/cloudinary")

    const folderFn = CloudinaryFolders[category as keyof typeof CloudinaryFolders]
    const folder = folderFn ? folderFn(slug) : `${category}/${slug}`

    if (type === "file") {
      return await uploadFile(file, folder)
    } else {
      return await uploadImage(file, folder)
    }
  } catch (error) {
    console.error("[Upload] Cloudinary upload failed, falling back to local:", error)
    return null
  }
}

// ============================================
// Local file upload (fallback)
// ============================================
async function uploadToLocal(
  file: File,
  category: string,
  slug: string,
  type: string
): Promise<{ url: string; publicId: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())

  // Generate unique filename
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin"
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const filename = `${timestamp}_${random}.${ext}`

  // Build folder path
  const categoryFolder = CATEGORY_FOLDERS[category] || category
  const relativePath = `uploads/${categoryFolder}/${slug}`
  const absolutePath = join(process.cwd(), "public", relativePath)

  // Ensure directory exists
  if (!existsSync(absolutePath)) {
    await mkdir(absolutePath, { recursive: true })
  }

  // Write file
  const filePath = join(absolutePath, filename)
  await writeFile(filePath, buffer)

  const url = `/${relativePath}/${filename}`
  const publicId = `${categoryFolder}/${slug}/${filename}`

  return { url, publicId }
}

// ============================================
// POST /api/upload — Upload a file (image or PDF)
// ============================================
export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const token = req.cookies.get("deligo_session")?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const session = await validateSession(token)
    if (!session) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    // Rate limit
    const ip = getClientIp(req)
    const rl = checkRateLimit("upload", `${ip}:${session.userId}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Estás subiendo archivos muy rápido. Esperá un momento.")
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const category = (formData.get("category") as string) || "chat"
    const slug = (formData.get("slug") as string) || "general"
    const type = (formData.get("type") as string) || "image"

    // Ownership verification: negocio users can only upload to their own slug
    if (session.userType === "negocio") {
      const negocio = await db.negocio.findUnique({
        where: { id: session.userId },
        select: { slug: true },
      })
      if (!negocio || negocio.slug !== slug) {
        return NextResponse.json({ error: "No tenés permiso para subir archivos a este negocio" }, { status: 403 })
      }
    }
    // Clientes can only upload to chat category
    if (session.userType === "cliente" && category !== "chat") {
      return NextResponse.json({ error: "No autorizado para esta categoría" }, { status: 403 })
    }

    if (!file) {
      return NextResponse.json({ error: "No se seleccionó ningún archivo" }, { status: 400 })
    }

    // Validate file type
    const isFileType = type === "file" || file.type === "application/pdf"
    const allowedTypes = isFileType ? ALLOWED_FILE_TYPES : ALLOWED_IMAGE_TYPES

    if (!allowedTypes.has(file.type)) {
      const allowedList = isFileType
        ? "PDF, PNG, JPG, GIF, WEBP"
        : "PNG, JPG, GIF, WEBP"
      return NextResponse.json(
        { error: `Tipo de archivo no permitido. Permitidos: ${allowedList}` },
        { status: 400 }
      )
    }

    // Validate file size
    const maxSize = isFileType ? MAX_FILE_SIZE : MAX_IMAGE_SIZE
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024))
      return NextResponse.json(
        { error: `El archivo es muy grande. Máximo ${maxMB}MB.` },
        { status: 400 }
      )
    }

    // Try Cloudinary first, fall back to local storage
    let result = await tryCloudinaryUpload(file, category, slug, type)

    if (!result) {
      result = await uploadToLocal(file, category, slug, type)
    }

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
    })
  } catch (error) {
    console.error("[Upload] Error:", error)
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 })
  }
}
