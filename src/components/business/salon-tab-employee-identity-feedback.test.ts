import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const source = readFileSync(join(process.cwd(), "src/components/business/salon-tab.tsx"), "utf8")

describe("P2-T43-R1 — EmpleadosSection identity and feedback contract", () => {
  test("uses server projection and bounded refresh for employees and invitations", () => {
    expect(source).toContain("displayName?: string | null")
    expect(source).toContain("identityLinked?: boolean")
    expect(source).toContain("refetchInterval: 15000")
    expect(source).toContain("refetchOnWindowFocus: true")
    expect(source).toContain("Pendiente de vinculación")
    expect(source).toContain("Cuenta vinculada")
  })

  test("modern admin creation sends only operational identity-independent data", () => {
    expect(source).toContain('mutationFn: async (data: { codigo: string; rol: string; areaOperativa: string })')
    expect(source).toContain('Label className="text-[11px] font-semibold mb-1 block">Código interno *</Label>')
    expect(source).not.toContain('Label className="text-[11px] font-semibold mb-1 block">Nombre *</Label>')
  })
})
