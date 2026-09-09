/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, ...path.split("/")), "utf8").replace(/\r\n/g, "\n")

describe("P2-T07 F-T07-02 — central inactive-courier contract", () => {
  test("getUserFromToken rejects inactive repartidores before any caller can authorize", () => {
    const auth = read("src/lib/auth.ts")
    expect(auth).toContain('select: { id: true, nombre: true, email: true, activo: true }')
    expect(auth).toContain("if (!user || !user.activo) return null")
  })

  test("all production repartidor API entry points use the central session helper", () => {
    const routes = [
      "src/app/api/repartidor/negocios/route.ts",
      "src/app/api/repartidor/pedidos/route.ts",
      "src/app/api/repartidor/pedidos-entregados/route.ts",
      "src/app/api/repartidor/pedidos/auto-cancel/route.ts",
      "src/app/api/repartidor/pedidos/[id]/aceptar/route.ts",
      "src/app/api/repartidor/pedidos/[id]/entregar/route.ts",
      "src/app/api/repartidor/perfil/route.ts",
      "src/app/api/repartidor/ubicacion/route.ts",
    ]
    for (const route of routes) {
      const source = read(route)
      expect(source).toContain("getUserFromToken")
      expect(source).toContain("SESSION_COOKIE_NAME")
    }
  })

  test("Google callback and consent cannot create a session for an inactive existing courier", () => {
    const callback = read("src/app/api/auth/google/callback/route.ts")
    const consent = read("src/app/api/auth/google/consent/route.ts")
    expect(callback).toContain('if (!repartidor.activo)')
    expect(callback).toContain('errorRedirect("account_unavailable")')
    expect(consent).toContain("select: { activo: true }")
    expect(consent).toContain("if (!existing || !existing.activo) throw new AccountVanishedError()")
  })
})
