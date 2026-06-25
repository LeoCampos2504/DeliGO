import { NextRequest, NextResponse } from "next/server"

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])
const DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

function normalizeOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === "*") return null

  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

function splitOrigins(value: string | null | undefined): string[] {
  return (value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin))
}

export function getAllowedOrigins(request?: NextRequest): string[] {
  const configuredOrigins = [
    ...splitOrigins(process.env.ALLOWED_ORIGINS),
    ...splitOrigins(process.env.CLIENT_URLS),
    ...splitOrigins(process.env.CLIENT_URL),
    ...splitOrigins(process.env.NEXT_PUBLIC_APP_URL),
    ...splitOrigins(process.env.APP_URL),
    ...splitOrigins(process.env.NEXTAUTH_URL),
  ]

  const requestOrigin = normalizeOrigin(request?.nextUrl.origin)
  if (requestOrigin) configuredOrigins.push(requestOrigin)

  if (process.env.NODE_ENV !== "production") {
    configuredOrigins.push(...DEV_ORIGINS)
  }

  return [...new Set(configuredOrigins)]
}

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase())
}

export function getAllowedCorsOrigin(request: NextRequest): string | null {
  const origin = normalizeOrigin(request.headers.get("origin"))
  if (!origin) return null

  return getAllowedOrigins(request).includes(origin) ? origin : null
}

export function hasDisallowedCorsOrigin(request: NextRequest): boolean {
  const rawOrigin = request.headers.get("origin")
  if (!rawOrigin) return false

  const origin = normalizeOrigin(rawOrigin)
  return !origin || !getAllowedOrigins(request).includes(origin)
}

export function validateMutationOrigin(
  request: NextRequest
): NextResponse | null {
  if (!isMutatingMethod(request.method)) return null

  const rawOrigin = request.headers.get("origin")
  const rawReferer = request.headers.get("referer")
  const sourceOrigin = normalizeOrigin(rawOrigin || rawReferer)

  if (sourceOrigin && getAllowedOrigins(request).includes(sourceOrigin)) {
    return null
  }

  return NextResponse.json(
    { error: "Origen no permitido" },
    { status: 403 }
  )
}
