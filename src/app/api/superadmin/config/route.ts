import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { getClientIp, checkRateLimit, createRateLimitKey, rateLimitResponse } from "@/lib/rate-limit"
import {
  getPlatformConfig,
  PLATFORM_CONFIG_KEY,
  PlatformServiceFeeConfigError,
  updatePlatformServiceFeeWithAudit,
  validatePlatformServiceFee,
} from "@/lib/platform-settings"
import { safeErrorForLog } from "@/lib/log-safe-error"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

async function verifySuperAdmin(req: NextRequest) {
  const auth = await requireSuperadminSession(req)
  if (!auth.ok) return null
  return auth.admin
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function configMutationRateLimit(req: NextRequest, adminId: string) {
  return checkRateLimit(
    "superadminConfigMutation",
    createRateLimitKey(getClientIp(req), adminId)
  )
}

function invalidConfigResponse() {
  return NextResponse.json(
    { error: "Configuración de plataforma no disponible", code: "PLATFORM_SERVICE_FEE_CONFIG_INVALID" },
    { status: 500, headers: NO_STORE_HEADERS }
  )
}

export async function GET(req: NextRequest) {
  try {
    const admin = await verifySuperAdmin(req)
    if (!admin) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })
    }

    const config = await getPlatformConfig(db)
    return NextResponse.json(
      {
        promocionadosActivos: config.promocionadosActivos,
        tarifaServicio: config.tarifaServicio,
        updatedAt: config.updatedAt.toISOString(),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    if (error instanceof PlatformServiceFeeConfigError) return invalidConfigResponse()
    console.error("Error getting platform config:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

// PUT compatibility for the existing promocionadosActivos control.
export async function PUT(req: NextRequest) {
  try {
    const admin = await verifySuperAdmin(req)
    if (!admin) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })
    }

    const limit = configMutationRateLimit(req, admin.id)
    if (!limit.allowed) return rateLimitResponse(limit)

    const body = await req.json().catch(() => null)
    if (!isPlainObject(body) || !hasExactKeys(body, ["promocionadosActivos"]) || typeof body.promocionadosActivos !== "boolean") {
      return NextResponse.json(
        { error: "Body inválido: promocionadosActivos debe ser booleano" },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const current = await getPlatformConfig(db)
    const updated = await db.configPlataforma.update({
      where: { clave: PLATFORM_CONFIG_KEY },
      data: { promocionadosActivos: body.promocionadosActivos },
      select: { promocionadosActivos: true, tarifaServicio: true, updatedAt: true },
    })

    return NextResponse.json(
      {
        promocionadosActivos: updated.promocionadosActivos,
        tarifaServicio: updated.tarifaServicio,
        updatedAt: updated.updatedAt.toISOString(),
        changed: updated.promocionadosActivos !== current.promocionadosActivos,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    if (error instanceof PlatformServiceFeeConfigError) return invalidConfigResponse()
    console.error("Error updating platform config:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await verifySuperAdmin(req)
    if (!admin) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })
    }

    const limit = configMutationRateLimit(req, admin.id)
    if (!limit.allowed) return rateLimitResponse(limit)

    const body = await req.json().catch(() => null)
    if (!isPlainObject(body) || !hasExactKeys(body, ["tarifaServicio"])) {
      return NextResponse.json(
        { error: "Body inválido: solo se admite tarifaServicio" },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    let requestedFee: number
    try {
      requestedFee = validatePlatformServiceFee(body.tarifaServicio)
    } catch {
      return NextResponse.json(
        { error: "tarifaServicio debe ser un entero seguro mayor o igual a cero" },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const ip = getClientIp(req)
    const result = await db.$transaction((tx) => updatePlatformServiceFeeWithAudit(tx, {
      adminId: admin.id,
      requestedFee,
      ip,
    }))

    return NextResponse.json(
      { ok: true, ...result },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    if (error instanceof PlatformServiceFeeConfigError) return invalidConfigResponse()
    console.error("Error updating platform service fee:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al actualizar tarifa de servicio" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
