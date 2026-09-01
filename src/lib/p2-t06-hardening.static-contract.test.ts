/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

const superadminMutationSurfaces = [
  ["src/app/api/superadmin/backup/route.ts", "superadminBackup"],
  ["src/app/api/superadmin/clientes/[id]/desbloquear/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/config/route.ts", "superadminConfigMutation"],
  ["src/app/api/superadmin/denuncias/[id]/route.ts", "superadminDestructiveMutation"],
  ["src/app/api/superadmin/deuda/[id]/abonar/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/deuda/[id]/limite/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/negocios/[id]/promocionar/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/negocios/[id]/reactivar/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/negocios/[id]/renovar/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/negocios/[id]/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/negocios/[id]/suspender/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/solicitudes-destacado/[id]/aprobar/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/solicitudes-destacado/[id]/rechazar/route.ts", "superadminPrivilegedMutation"],
  ["src/app/api/superadmin/solicitudes-revision-resenas/[id]/aprobar/route.ts", "superadminReviewModerationAction"],
  ["src/app/api/superadmin/solicitudes-revision-resenas/[id]/pedir-informacion/route.ts", "superadminReviewModerationAction"],
  ["src/app/api/superadmin/solicitudes-revision-resenas/[id]/rechazar/route.ts", "superadminReviewModerationAction"],
  ["src/app/api/superadmin/solicitudes-revision-resenas/[id]/tomar/route.ts", "superadminReviewModerationAction"],
] as const

const terminalAdminSurfaces = [
  "src/app/api/negocio/terminales-operativas/route.ts",
  "src/app/api/negocio/terminales-operativas/[id]/route.ts",
  "src/app/api/negocio/terminales-operativas/[id]/activacion/route.ts",
  "src/app/api/negocio/terminales-operativas/[id]/revocar/route.ts",
] as const

describe("P2-T06 F3/F6 — rate-limit coverage contracts", () => {
  test("las 4 rutas admin de terminal tienen bucket y placement después de auth", () => {
    for (const path of terminalAdminSurfaces) {
      const source = read(path)
      expect(source).toContain("checkRateLimit")
      expect(source).toContain("createRateLimitKey(getClientIp")
      expect(source.indexOf("const user = await getNegocioAuth")).toBeLessThan(source.indexOf("const limit = checkRateLimit"))
    }
  })

  test("las 17 superficies SuperAdmin tienen rate limit y audit path", () => {
    expect(superadminMutationSurfaces).toHaveLength(17)
    for (const [path, bucket] of superadminMutationSurfaces) {
      const source = read(path)
      expect(source).toContain("requireSuperadminSession")
      expect(source).toContain(bucket)
      expect(source).toMatch(/auditLog|auditLogWithClient|mutateReviewModerationRequest|updatePlatformServiceFeeWithAudit/)
    }
  })

  test("backup limita antes de crear directorio/spawn y hard-delete limita antes de leer objetivo", () => {
    const backup = read("src/app/api/superadmin/backup/route.ts")
    expect(backup.indexOf("checkRateLimit")).toBeLessThan(backup.indexOf("const BACKUP_DIR"))
    expect(backup.indexOf("checkRateLimit")).toBeLessThan(backup.indexOf("execAsync"))

    const hardDelete = read("src/app/api/superadmin/negocios/[id]/route.ts")
    const deleteSection = hardDelete.slice(hardDelete.indexOf("export async function DELETE"))
    expect(deleteSection.indexOf("checkRateLimit")).toBeLessThan(deleteSection.indexOf("tx.negocio.findUnique"))
    expect(deleteSection).toContain("auditLogWithClient")
  })
})

describe("P2-T06 F1/F2 — terminal authorization/UI contracts", () => {
  test("lifecycle gate is central and logout is isolated", () => {
    const auth = read("src/lib/operaciones-terminal-auth.ts")
    expect(auth).toContain("terminal.negocio.aprobado")
    expect(auth).toContain("terminal.negocio.suspendido")
    expect(auth).toContain("select: {")
    const logout = read("src/app/api/operaciones/terminal/logout/route.ts")
    expect(logout).toContain("updateMany")
    expect(logout).toContain("revokedAt: null")
    expect(logout).toContain("clearTerminalSessionCookie")
    expect(logout).not.toContain("terminalOperativa.update")
  })

  test("UI expone Cerrar terminal y separa esa acción de Volver", () => {
    const button = read("src/components/operativo/terminal-logout-button.tsx")
    const layout = read("src/app/operaciones/layout.tsx")
    expect(button).toContain("Cerrar terminal")
    expect(button).toContain("/api/operaciones/terminal/logout")
    expect(button).toContain("/operaciones/activar")
    expect(layout).toContain("TerminalLogoutButton")
  })
})
