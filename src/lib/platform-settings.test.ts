import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { updatePlatformServiceFeeWithAudit, validatePlatformServiceFee } from "./platform-settings"

describe("platform service fee settings", () => {
  test("accepts safe non-negative integers, including zero", () => {
    expect(validatePlatformServiceFee(0)).toBe(0)
    expect(validatePlatformServiceFee(250)).toBe(250)
  })

  test("rejects values that cannot be a platform fee", () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "250", null, true, [], {}]) {
      expect(() => validatePlatformServiceFee(value)).toThrow()
    }
  })

  test("order creation no longer contains a productive SERVICE_FEE_FIXED source", () => {
    const source = readFileSync("src/app/api/pedidos/route.ts", "utf8")
    expect(source).not.toContain("SERVICE_FEE_FIXED")
    expect(source).toContain("getPlatformServiceFee(tx)")
    expect(source).toContain("tarifaServicio: snapshotTarifaServicio")
  })

  test("migration covers zero, empty-key and canonical states and aborts others", () => {
    const migration = readFileSync(
      "prisma/migrations/20260814000000_add_platform_service_fee_setting/migration.sql",
      "utf8"
    )
    expect(migration).toContain("total_rows = 0")
    expect(migration).toContain("empty_key_rows = 1")
    expect(migration).toContain("platform_rows = 1")
    expect(migration).toContain("CONFIG_PLATFORM_NORMALIZATION_AMBIGUOUS")
    expect(migration).toContain("ADD COLUMN \"tarifaServicio\" INTEGER NOT NULL DEFAULT 250")
  })

  test("rolls back the modeled setting when audit creation fails", async () => {
    const state = { tarifaServicio: 250, auditRows: 0 }
    const tx = {
      configPlataforma: {
        findUnique: async () => ({
          id: "platform-config",
          clave: "platform",
          promocionadosActivos: false,
          tarifaServicio: state.tarifaServicio,
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        update: async ({ data }: { data: { tarifaServicio: number } }) => {
          state.tarifaServicio = data.tarifaServicio
          return { tarifaServicio: state.tarifaServicio, updatedAt: new Date() }
        },
      },
      auditLog: {
        create: async () => {
          state.auditRows += 1
          throw new Error("AUDIT_FAILURE_FOR_TEST")
        },
      },
    }

    const transaction = async (callback: typeof updatePlatformServiceFeeWithAudit) => {
      const previous = state.tarifaServicio
      const previousAuditRows = state.auditRows
      try {
        return await callback(tx as never, { adminId: "fixture", requestedFee: 251, ip: "127.0.0.1" })
      } catch (error) {
        state.tarifaServicio = previous
        state.auditRows = previousAuditRows
        throw error
      }
    }

    await expect(transaction(updatePlatformServiceFeeWithAudit)).rejects.toThrow("AUDIT_FAILURE_FOR_TEST")
    expect(state.tarifaServicio).toBe(250)
    expect(state.auditRows).toBe(0)
  })
})
