// P2-T51-R1: contrato estático del home de DeliGO Operaciones
// (src/app/operaciones/page.tsx). Se testea el SOURCE del archivo en vez
// de renderizarlo con DOM: `page.tsx` es un server component puro que
// compone <Link> de next/link (prefetch vía IntersectionObserver, sin
// contexto de App Router disponible fuera de Next) — mismo patrón de
// "contrato estático puro" ya aceptado en T45/T47/T49/T50 para lógica
// sin harness de componente, extendido acá a un chequeo de fuente para
// evitar el riesgo/; complejidad de montar un Server Component con
// next/link fuera del árbol real de Next (ver P2_T51_A0, §24 del task
// spec de R1: "o un contrato estático equivalente si renderizar... resulta
// innecesariamente complejo").
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const SOURCE = readFileSync(join(import.meta.dir, "page.tsx"), "utf-8")

describe("P2-T51-R1 — home de Operaciones — copy y rutas preservadas", () => {
  test("A. aparece 'Ingresar con mi cuenta'", () => {
    expect(SOURCE).toContain("Ingresar con mi cuenta")
  })

  test("B. aparece 'Usar o activar esta terminal'", () => {
    expect(SOURCE).toContain("Usar o activar esta terminal")
  })

  test("C. href personal exacto /operaciones/ingresar", () => {
    expect(SOURCE).toContain('href="/operaciones/ingresar"')
  })

  test("D. href terminal exacto /operaciones/terminal", () => {
    expect(SOURCE).toContain('href="/operaciones/terminal"')
  })

  test("E. descripción personal exacta", () => {
    expect(SOURCE).toContain(
      "Para trabajar con tu usuario y los permisos asignados por tu negocio."
    )
  })

  test("F. descripción terminal exacta", () => {
    expect(SOURCE).toContain("Para una tablet, PC o pantalla vinculada al negocio.")
  })

  test("G. exactamente 2 opciones de acceso (2 EntryOptionCard, 2 href de destino)", () => {
    const entryOptionCardCount = (SOURCE.match(/<EntryOptionCard/g) ?? []).length
    expect(entryOptionCardCount).toBe(2)
    const hrefCount = (SOURCE.match(/href="\/operaciones\/(ingresar|terminal)"/g) ?? []).length
    expect(hrefCount).toBe(2)
  })

  test("H. no aparece ningún link a /mozo", () => {
    expect(SOURCE).not.toContain("/mozo")
  })
})

describe("P2-T51-R1 — aislamiento de auth/sesión preservado", () => {
  test("I. no importa ni referencia auth/session/cookies/hooks de cliente", () => {
    expect(SOURCE).not.toContain("@/lib/auth")
    expect(SOURCE).not.toContain("@/lib/operaciones-terminal-auth")
    expect(SOURCE).not.toContain("next/headers")
    expect(SOURCE).not.toContain("cookies(")
    expect(SOURCE).not.toContain("useSession")
    expect(SOURCE).not.toContain("useEffect")
    expect(SOURCE).not.toContain("fetch(")
    expect(SOURCE).not.toContain('"use client"')
    expect(SOURCE).not.toContain("deligo_operativo_session")
    expect(SOURCE).not.toContain("deligo_operaciones_terminal")
  })
})

describe("P2-T51-R1 — identidad visual (accent Personal/Terminal + dark mode)", () => {
  test("J. accent amber presente en Personal", () => {
    expect(SOURCE).toContain("bg-amber-100")
    expect(SOURCE).toContain("text-amber-700")
  })

  test("K. accent slate presente en Terminal", () => {
    expect(SOURCE).toContain("bg-slate-100")
    expect(SOURCE).toContain("text-slate-700")
  })

  test("L. clases dark: presentes para ambos accents", () => {
    expect(SOURCE).toContain("dark:bg-amber-950/40")
    expect(SOURCE).toContain("dark:text-amber-300")
    expect(SOURCE).toContain("dark:bg-slate-800/60")
    expect(SOURCE).toContain("dark:text-slate-300")
  })

  test("accent es un valor fijo (className estático), nunca un style dinámico por negocio", () => {
    expect(SOURCE).not.toMatch(/style=\{\{[^}]*color/)
  })
})

describe("P2-T51-R1 — estructura/accesibilidad preservada", () => {
  test("M. nav aria-label=\"Modo de acceso\" preservado", () => {
    expect(SOURCE).toContain('aria-label="Modo de acceso"')
  })

  test("N. Logo y textos principales preservados", () => {
    expect(SOURCE).toContain('<Logo size="sm" />')
    expect(SOURCE).toContain("DeliGO Operaciones")
    expect(SOURCE).toContain("Elegí cómo querés entrar.")
  })

  test("focus-visible preservado en las opciones", () => {
    expect(SOURCE).toContain("focus-visible:ring-2")
    expect(SOURCE).toContain("focus-visible:ring-ring")
  })

  test("ChevronRight sigue siendo puramente decorativo (no un botón separado)", () => {
    expect(SOURCE).not.toMatch(/<button[^>]*>\s*<ChevronRight/)
  })
})
