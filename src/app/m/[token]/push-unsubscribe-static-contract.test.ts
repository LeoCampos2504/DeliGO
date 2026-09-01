import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const source = readFileSync(resolve(import.meta.dir, "page.tsx"), "utf8")

describe("/m/[token] legacy deprecation contract", () => {
  test("is a neutral page and does not read or transport the dynamic token", () => {
    expect(source).toContain("Este acceso fue reemplazado por DeliGO Operaciones")
    expect(source).toContain('href="/operaciones/ingresar"')
    for (const forbidden of [
      "useParams",
      "Empleado",
      "sessionStorage",
      "localStorage",
      "Authorization",
      "api/mozo",
      "mozoToken",
      "fetch(",
      "console.",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
