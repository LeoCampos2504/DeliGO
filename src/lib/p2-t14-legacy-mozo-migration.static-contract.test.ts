import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, ...relativePath.split("/")), "utf8")

describe("P2-T14 — retiro de autenticación legacy de mozo", () => {
  test("/m/[token] es sólo deprecación neutral", () => {
    const source = read("src/app/m/[token]/page.tsx")
    expect(source).toContain("Este acceso fue reemplazado por DeliGO Operaciones")
    expect(source).toContain('href="/operaciones/ingresar"')
    for (const forbidden of ["useParams", "fetch(", "sessionStorage", "localStorage", "Authorization", "mozoToken"]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("las APIs legacy no tienen acceso a Prisma ni aceptan Bearer/body token", () => {
    for (const relativePath of [
      "src/app/api/mozo/route.ts",
      "src/app/api/mozos/route.ts",
      "src/app/api/mozo/push/subscribe/route.ts",
      "src/app/api/mozo/push/unsubscribe/route.ts",
    ]) {
      const source = read(relativePath)
      expect(source).not.toContain("@/lib/db")
      expect(source).not.toContain("Authorization")
      expect(source).not.toContain("mozoToken")
      expect(source).toContain("status: 410")
    }
  })

  test("el catálogo público no conserva el bridge legacy ni el componente selector basado en token", () => {
    const catalog = read("src/app/n/[slug]/page.tsx")
    expect(catalog).not.toContain("sessionStorage")
    expect(catalog).not.toContain("mozoToken")
    expect(catalog).not.toContain("/api/mozo")
    expect(catalog).not.toContain("MesaSelectorSheet")
  })

  test("mesas-assign queda restringido a sesión de negocio y el reemplazo personal es operativo", () => {
    const assignment = read("src/app/api/negocio/mesas-assign/route.ts")
    expect(assignment).not.toContain("mozoToken")
    expect(assignment).toContain("SESSION_COOKIE_NAME")
    expect(assignment).toContain('user?.type === "negocio"')

    const operativePanel = read("src/app/api/operativo/mozo/panel/[slug]/route.ts")
    expect(operativePanel).toContain("resolveOperativoMozoForSlug")
    expect(operativePanel).toContain('accion === "tomar_mesa"')
    expect(operativePanel).toContain('["tomar_mesa", "liberar_mesa"].includes(accion)')
  })

  test("Push operativo ya usa sesión personal y repositorio owner/channel", () => {
    const source = read("src/app/api/operativo/mozo/panel/[slug]/push-subscription/route.ts")
    expect(source).toContain("resolveOperativoMozoForSlug")
    expect(source).toContain('ownerType: "empleado"')
    expect(source).toContain('channel: "default"')
    expect(source).not.toContain("mozoToken")
  })

  test("no se expone ningún token legacy desde las APIs administrativas de empleados", () => {
    for (const relativePath of [
      "src/app/api/negocio/empleados/route.ts",
      "src/app/api/negocio/empleados/[id]/route.ts",
    ]) {
      const source = read(relativePath)
      expect(source).toContain("token: null")
      expect(source).toContain("tokenMasked: null")
      expect(source).not.toContain("token: true")
      expect(source).not.toContain("maskToken(")
    }
  })
})
