type UrlValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

const CLOUDINARY_HOST = "res.cloudinary.com"
const LOCAL_UPLOAD_PREFIX = "/uploads/"
const LOCAL_CHAT_UPLOAD_PREFIX = "/uploads/chat/"
const CHAT_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"])
const CHAT_PDF_EXTENSIONS = new Set(["pdf"])

function ok<T>(value: T): UrlValidationResult<T> {
  return { ok: true, value }
}

function fail<T = never>(error: string): UrlValidationResult<T> {
  return { ok: false, error }
}

function hasUnsafePathChars(pathname: string): boolean {
  const lower = pathname.toLowerCase()
  return (
    pathname.includes("\\") ||
    pathname.includes("..") ||
    lower.includes("%2e") ||
    lower.includes("%2f") ||
    lower.includes("%5c") ||
    lower.includes("%00")
  )
}

function validateCloudinaryUrl(value: string, resourceType: "image" | "raw"): UrlValidationResult<URL> {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return fail("URL de recurso invalida")
  }

  if (parsed.protocol !== "https:") return fail("URL de recurso invalida")
  if (parsed.username || parsed.password || parsed.port) return fail("URL de recurso invalida")
  if (parsed.hostname !== CLOUDINARY_HOST) return fail("URL de recurso no permitida")
  if (parsed.search || parsed.hash) return fail("URL de recurso invalida")
  if (hasUnsafePathChars(parsed.pathname)) return fail("URL de recurso invalida")

  const parts = parsed.pathname.split("/").filter(Boolean)
  if (parts.length < 4) return fail("URL de recurso invalida")

  const [cloudName, actualResourceType, action] = parts
  const expectedCloud = process.env.CLOUDINARY_CLOUD_NAME
  if (expectedCloud && cloudName !== expectedCloud) return fail("URL de recurso no permitida")
  if (actualResourceType !== resourceType || action !== "upload") {
    return fail("URL de recurso no permitida")
  }

  return ok(parsed)
}

function validateLocalUploadUrl(value: string): UrlValidationResult<string> {
  if (!value.startsWith(LOCAL_UPLOAD_PREFIX)) return fail("URL de recurso no permitida")
  if (value.startsWith("//") || hasUnsafePathChars(value) || value.includes("?") || value.includes("#")) {
    return fail("URL de recurso invalida")
  }
  return ok(value)
}

function validateLocalChatUploadUrl(
  value: string,
  pedidoId: string,
  allowedExtensions: Set<string>
): UrlValidationResult<string> {
  if (!value.startsWith(`${LOCAL_CHAT_UPLOAD_PREFIX}${pedidoId}/`)) {
    return fail("URL de adjunto no permitida")
  }
  if (value.startsWith("//") || hasUnsafePathChars(value) || value.includes("?") || value.includes("#")) {
    return fail("URL de adjunto invalida")
  }

  const parts = value.split("/").filter(Boolean)
  if (parts.length < 4 || parts[0] !== "uploads" || parts[1] !== "chat" || parts[2] !== pedidoId) {
    return fail("URL de adjunto no permitida")
  }

  const filename = parts[parts.length - 1]
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : ""
  if (!extension || !allowedExtensions.has(extension)) {
    return fail("URL de adjunto invalida")
  }

  return ok(value)
}

function getCloudinaryPublicPathParts(parsed: URL): string[] {
  const parts = parsed.pathname.split("/").filter(Boolean)
  const resourceParts = parts.slice(3)
  const versionIndex = resourceParts.findIndex((part) => /^v\d+$/.test(part))
  return versionIndex >= 0 ? resourceParts.slice(versionIndex + 1) : resourceParts
}

function validateCloudinaryChatUrl(
  value: string,
  pedidoId: string,
  resourceType: "image" | "raw"
): UrlValidationResult<URL> {
  const cloudinary = validateCloudinaryUrl(value, resourceType)
  if (!cloudinary.ok) return fail(cloudinary.error)

  const publicPathParts = getCloudinaryPublicPathParts(cloudinary.value)
  if (
    publicPathParts.length < 3 ||
    publicPathParts[0] !== "chat" ||
    publicPathParts[1] !== pedidoId
  ) {
    return fail("URL de adjunto no permitida")
  }

  return ok(cloudinary.value)
}

function hasAllowedPathExtension(pathname: string, allowedExtensions: Set<string>): boolean {
  const filename = pathname.split("/").filter(Boolean).pop() || ""
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : ""
  return !!extension && allowedExtensions.has(extension)
}

export function validateOptionalImageUrl(value: unknown): UrlValidationResult<string | null> {
  if (value === null || value === "") return ok(null)
  if (typeof value !== "string") return fail("URL de imagen invalida")

  const trimmed = value.trim()
  if (!trimmed) return ok(null)

  if (trimmed.startsWith("/")) {
    return validateLocalUploadUrl(trimmed)
  }

  const cloudinary = validateCloudinaryUrl(trimmed, "image")
  if (!cloudinary.ok) return fail(cloudinary.error)
  return ok(cloudinary.value.toString())
}

export function validateImageUrlArray(value: unknown): UrlValidationResult<string[]> {
  if (value === undefined || value === null) return ok([])
  if (!Array.isArray(value)) return fail("Lista de imagenes invalida")

  const urls: string[] = []
  for (const item of value) {
    const result = validateOptionalImageUrl(item)
    if (!result.ok) return result
    if (result.value) urls.push(result.value)
  }

  return ok(urls)
}

export function validateCloudinaryPdfUrl(value: unknown): UrlValidationResult<string> {
  if (typeof value !== "string" || !value.trim()) return fail("URL de PDF invalida")

  const cloudinary = validateCloudinaryUrl(value.trim(), "raw")
  if (!cloudinary.ok) return fail(cloudinary.error)

  return ok(cloudinary.value.toString())
}

export function validateChatImageUrl(value: unknown, pedidoId: string): UrlValidationResult<string> {
  if (typeof value !== "string" || !value.trim()) return fail("URL de imagen invalida")

  const trimmed = value.trim()
  if (trimmed.startsWith("/")) {
    return validateLocalChatUploadUrl(trimmed, pedidoId, CHAT_IMAGE_EXTENSIONS)
  }

  const cloudinary = validateCloudinaryChatUrl(trimmed, pedidoId, "image")
  if (!cloudinary.ok) return fail(cloudinary.error)
  if (!hasAllowedPathExtension(cloudinary.value.pathname, CHAT_IMAGE_EXTENSIONS)) {
    return fail("URL de imagen invalida")
  }

  return ok(cloudinary.value.toString())
}

export function validateChatPdfUrl(value: unknown, pedidoId: string): UrlValidationResult<string> {
  if (typeof value !== "string" || !value.trim()) return fail("URL de PDF invalida")

  const trimmed = value.trim()
  if (trimmed.startsWith("/")) {
    return validateLocalChatUploadUrl(trimmed, pedidoId, CHAT_PDF_EXTENSIONS)
  }

  const cloudinary = validateCloudinaryChatUrl(trimmed, pedidoId, "raw")
  if (!cloudinary.ok) return fail(cloudinary.error)

  return ok(cloudinary.value.toString())
}
