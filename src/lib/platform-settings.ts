import { Prisma } from "@prisma/client"

export const PLATFORM_CONFIG_KEY = "platform" as const

export class PlatformServiceFeeConfigError extends Error {
  readonly code = "PLATFORM_SERVICE_FEE_CONFIG_INVALID"

  constructor() {
    super("La configuración de tarifa de servicio no está disponible o es inválida")
    this.name = "PlatformServiceFeeConfigError"
  }
}

type PlatformSettingsReader = Pick<Prisma.TransactionClient, "configPlataforma">
type PlatformServiceFeeMutationTx = Pick<Prisma.TransactionClient, "configPlataforma" | "auditLog">

export function validatePlatformServiceFee(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new PlatformServiceFeeConfigError()
  }
  return value
}

export async function getPlatformServiceFee(
  tx: PlatformSettingsReader
): Promise<number> {
  const config = await tx.configPlataforma.findUnique({
    where: { clave: PLATFORM_CONFIG_KEY },
    select: { tarifaServicio: true },
  })

  if (!config) throw new PlatformServiceFeeConfigError()
  return validatePlatformServiceFee(config.tarifaServicio)
}

export async function getPlatformConfig(
  tx: PlatformSettingsReader
) {
  const config = await tx.configPlataforma.findUnique({
    where: { clave: PLATFORM_CONFIG_KEY },
    select: {
      id: true,
      clave: true,
      promocionadosActivos: true,
      tarifaServicio: true,
      updatedAt: true,
    },
  })

  if (!config) throw new PlatformServiceFeeConfigError()
  validatePlatformServiceFee(config.tarifaServicio)
  return config
}

export async function updatePlatformServiceFeeWithAudit(
  tx: PlatformServiceFeeMutationTx,
  input: { adminId: string; requestedFee: number; ip: string }
) {
  const requestedFee = validatePlatformServiceFee(input.requestedFee)
  const current = await getPlatformConfig(tx)

  if (current.tarifaServicio === requestedFee) {
    return {
      changed: false,
      previousTarifaServicio: current.tarifaServicio,
      tarifaServicio: current.tarifaServicio,
      updatedAt: current.updatedAt,
    }
  }

  const updated = await tx.configPlataforma.update({
    where: { clave: PLATFORM_CONFIG_KEY },
    data: { tarifaServicio: requestedFee },
    select: { tarifaServicio: true, updatedAt: true },
  })

  await tx.auditLog.create({
    data: {
      userId: input.adminId,
      userType: "superadmin",
      accion: "platform.service_fee_updated",
      recurso: "config_plataforma",
      recursoId: current.id,
      detalle: JSON.stringify({
        oldValue: current.tarifaServicio,
        newValue: updated.tarifaServicio,
        setting: "tarifaServicio",
        unit: "ARS",
        source: "superadmin",
      }),
      ip: input.ip,
    },
  })

  return {
    changed: true,
    previousTarifaServicio: current.tarifaServicio,
    ...updated,
  }
}
