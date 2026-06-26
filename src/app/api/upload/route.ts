import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { validateSession } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { db } from "@/lib/db"

// ============================================
// Allowed file types
// ============================================
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
])

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
])

const MAX_BUSINESS_IMAGE_SIZE = 5 * 1024 * 1024  // 5MB
const MAX_CHAT_IMAGE_SIZE = 10 * 1024 * 1024     // 10MB
const MAX_FILE_SIZE = 5 * 1024 * 1024     // 5MB
type UploadCategory = "productos" | "agregados" | "ingredientes" | "logos" | "banners" | "fondos" | "chat"
type UploadType = "image" | "file"

// Category → folder mapping
const CATEGORY_FOLDERS: Record<UploadCategory, string> = {
  productos: "productos",
  agregados: "agregados",
  ingredientes: "ingredientes",
  logos: "logos",
  banners: "banners",
  fondos: "fondos",
  chat: "chat",
}

const BUSINESS_IMAGE_CATEGORIES = new Set<UploadCategory>([
  "productos",
  "agregados",
  "ingredientes",
  "logos",
  "banners",
  "fondos",
])

function parseUploadCategory(value: FormDataEntryValue | null): UploadCategory | null {
  if (typeof value !== "string") return null
  return Object.prototype.hasOwnProperty.call(CATEGORY_FOLDERS, value)
    ? value as UploadCategory
    : null
}

function parseUploadType(value: FormDataEntryValue | null): UploadType | null {
  return value === "image" || value === "file" ? value : null
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100)
}

function canonicalExtension(file: File, type: UploadType): string {
  if (type === "file") return "pdf"
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  return "jpg"
}

async function readHeader(file: File): Promise<Uint8Array> {
  const buffer = await file.slice(0, 16).arrayBuffer()
  return new Uint8Array(buffer)
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
}

async function hasAllowedSignature(file: File, type: UploadType): Promise<boolean> {
  const bytes = await readHeader(file)
  if (type === "file") return hasPdfSignature(bytes)
  if (file.type === "image/png") return hasPngSignature(bytes)
  if (file.type === "image/jpeg") return hasJpegSignature(bytes)
  if (file.type === "image/webp") return hasWebpSignature(bytes)
  return false
}

async function resolveUploadScope(
  session: { userId: string; userType: string },
  category: UploadCategory,
  requestedSlug: string | null,
  type: UploadType
): Promise<{ ok: true; category: UploadCategory; slug: string; type: UploadType } | { ok: false; status: number; error: string }> {
  if (category === "chat") {
    if (!requestedSlug) return { ok: false, status: 400, error: "Pedido requerido" }

    const pedido = await db.pedido.findUnique({
      where: { id: requestedSlug },
      select: { clienteId: true, negocioId: true, metodoEntrega: true },
    })
    if (!pedido || pedido.metodoEntrega === "mesa") {
      return { ok: false, status: 403, error: "Sin acceso a este chat" }
    }

    if (session.userType === "cliente" && pedido.clienteId !== session.userId) {
      return { ok: false, status: 403, error: "Sin acceso a este chat" }
    }
    if (session.userType === "negocio" && pedido.negocioId !== session.userId) {
      return { ok: false, status: 403, error: "Sin acceso a este chat" }
    }
    if (!["cliente", "negocio"].includes(session.userType)) {
      return { ok: false, status: 403, error: "Sin acceso a este chat" }
    }

    return { ok: true, category, slug: sanitizePathSegment(requestedSlug), type }
  }

  if (!BUSINESS_IMAGE_CATEGORIES.has(category)) {
    return { ok: false, status: 400, error: "Categoria invalida" }
  }
  if (session.userType !== "negocio") {
    return { ok: false, status: 403, error: "No autorizado para esta categoria" }
  }
  if (type !== "image") {
    return { ok: false, status: 400, error: "Tipo de upload invalido" }
  }

  const negocio = await db.negocio.findUnique({
    where: { id: session.userId },
    select: { slug: true },
  })
  if (!negocio) return { ok: false, status: 404, error: "Negocio no encontrado" }

  return { ok: true, category, slug: sanitizePathSegment(negocio.slug), type }
}

// ============================================
// Try Cloudinary upload (if configured)
// ============================================
async function tryCloudinaryUpload(
  file: File,
  category: UploadCategory,
  slug: string,
  type: UploadType
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

    const { uploadImage, uploadFile } = await import("@/lib/cloudinary")

    const folder = `${CATEGORY_FOLDERS[category]}/${slug}`

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
  category: UploadCategory,
  slug: string,
  type: UploadType
): Promise<{ url: string; publicId: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())

  // Generate unique filename
  const ext = canonicalExtension(file, type)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const filename = `${timestamp}_${random}.${ext}`

  // Build folder path
  const categoryFolder = CATEGORY_FOLDERS[category]
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
    const category = parseUploadCategory(formData.get("category"))
    const rawSlug = formData.get("slug")
    const requestedSlug = typeof rawSlug === "string" ? rawSlug.trim() : null
    const type = parseUploadType(formData.get("type"))

    if (!file) {
      return NextResponse.json({ error: "No se selecciono ningun archivo" }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Archivo invalido" }, { status: 400 })
    }
    if (!category) {
      return NextResponse.json({ error: "Categoria invalida" }, { status: 400 })
    }
    if (!type) {
      return NextResponse.json({ error: "Tipo de upload invalido" }, { status: 400 })
    }

    const scope = await resolveUploadScope(session, category, requestedSlug, type)
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    const allowedTypes = scope.type === "file" ? ALLOWED_FILE_TYPES : ALLOWED_IMAGE_TYPES
    if (!allowedTypes.has(file.type)) {
      const allowedList = scope.type === "file" ? "PDF" : "PNG, JPG, WEBP"
      return NextResponse.json(
        { error: `Tipo de archivo no permitido. Permitidos: ${allowedList}` },
        { status: 400 }
      )
    }

    const maxSize = scope.type === "file"
      ? MAX_FILE_SIZE
      : scope.category === "chat"
        ? MAX_CHAT_IMAGE_SIZE
        : MAX_BUSINESS_IMAGE_SIZE
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024))
      return NextResponse.json(
        { error: `El archivo es muy grande. Maximo ${maxMB}MB.` },
        { status: 413 }
      )
    }

    if (!(await hasAllowedSignature(file, scope.type))) {
      return NextResponse.json(
        { error: "Contenido de archivo invalido" },
        { status: 400 }
      )
    }

    // Try Cloudinary first, fall back to local storage
    let result = await tryCloudinaryUpload(file, scope.category, scope.slug, scope.type)

    if (!result) {
      result = await uploadToLocal(file, scope.category, scope.slug, scope.type)
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
