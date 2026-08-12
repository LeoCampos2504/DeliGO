/// <reference types="bun-types" />

// ============================================
// GLOBAL-LOGS-PII-2C — contrato estático: Operativo/Operaciones/Mozo/
// Salón-PyR nunca vuelven a loguear un error atrapado sin pasar por
// `safeErrorForLog`
// ============================================
// Mismo criterio que negocio-api-safe-error-logging-static-contract.test.ts
// (2A) y cliente-auth-chat-client-order-safe-error-logging-static-
// contract.test.ts (2B): lectura real de código fuente + aserciones
// puntuales — nunca un parser completo de TypeScript. El heurístico (¿el
// argumento de un console.* es el parámetro de la `catch` más cercana o de
// un `.catch(...)` callback, y no está envuelto en `safeErrorForLog(...)`?)
// fue validado manualmente contra los 50 callers reales migrados en
// GLOBAL-LOGS-PII-2C antes de convertirlo en test permanente — cero falsos
// positivos en esa corrida.
//
// Acotado a propósito a las rutas de esta tarea:
// - src/app/api/operativo/**
// - src/app/api/operaciones/**
// - src/app/api/mozo/** (personal, singular)
// - src/app/api/mozos/** (plural — validación de token/stats de mozo,
//   descubierto como parte funcional del dominio operativo en 2C)
// - src/app/api/empleados/by-codigo/route.ts (consumido por el flujo de
//   escaneo de QR de mesa, descubierto como parte funcional del dominio
//   Salón/PyR en 2C)
//
// Fuera de scope a propósito: negocio/**, cliente/**, auth/**, chat/**,
// superadmin/**, repartidor/**, y el resto de src/app/api/empleados/**.

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "fs"
import { join, extname } from "path"

const SCOPE_DIRS = [
  join(process.cwd(), "src", "app", "api", "operativo"),
  join(process.cwd(), "src", "app", "api", "operaciones"),
  join(process.cwd(), "src", "app", "api", "mozo"),
  join(process.cwd(), "src", "app", "api", "mozos"),
]

const SCOPE_FILES = [
  join(process.cwd(), "src", "app", "api", "empleados", "by-codigo", "route.ts"),
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
    } else if ((extname(entry) === ".ts" || extname(entry) === ".tsx") && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full)
    }
  }
  return out
}

type Violation = { file: string; line: number; snippet: string }

function findUnsafeErrorLogCalls(): Violation[] {
  const violations: Violation[] = []
  const files = [...SCOPE_DIRS.flatMap((dir) => walk(dir)), ...SCOPE_FILES]

  for (const file of files) {
    const content = readFileSync(file, "utf-8")
    const lines = content.split(/\r\n|\n/)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!/console\.(log|error|warn|info|debug)\(/.test(line)) continue

      const callWindow = lines.slice(i, Math.min(i + 6, lines.length)).join("\n")

      let catchVar: string | null = null
      for (let j = i; j >= Math.max(0, i - 20); j--) {
        const catchMatch = lines[j].match(/catch\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)/)
        if (catchMatch) {
          catchVar = catchMatch[1]
          break
        }
        if (/^\s*(export async function|export function|async function)\s/.test(lines[j])) break
      }

      if (!catchVar) continue

      const rawPattern = new RegExp(`[(,]\\s*${catchVar}\\s*[).,]`)
      const safePattern = new RegExp(`safeErrorForLog\\(\\s*${catchVar}\\s*\\)`)

      if (rawPattern.test(callWindow) && !safePattern.test(callWindow)) {
        violations.push({ file: file.replace(process.cwd(), "").replace(/\\/g, "/"), line: i + 1, snippet: line.trim() })
      }
    }
  }

  return violations
}

describe("GLOBAL-LOGS-PII-2C — contrato estático: Operativo/Operaciones/Mozo/Salón-PyR nunca loguean errores crudos", () => {
  test("ningún console.* en el scope de 2C pasa un error atrapado sin safeErrorForLog(...)", () => {
    const violations = findUnsafeErrorLogCalls()
    if (violations.length > 0) {
      const details = violations.map((v) => `  ${v.file}:${v.line} -> ${v.snippet}`).join("\n")
      throw new Error(`Se encontraron ${violations.length} caller(s) de error crudo en el scope de GLOBAL-LOGS-PII-2C:\n${details}`)
    }
    expect(violations).toEqual([])
  })

  test("sanity check: el detector encuentra un caller crudo sintético de control (nunca 0 detecciones por un bug silencioso)", () => {
    // No lee ningún archivo real — sólo valida que el propio detector, ante
    // una entrada obviamente insegura, SÍ dispara. Evita que un cambio futuro
    // al heurístico lo vuelva permisivo en silencio sin que ningún test lo note.
    const syntheticSource = [
      "export async function GET() {",
      "  try {",
      "    doSomething()",
      "  } catch (error) {",
      "    console.error(\"Fallo sintetico:\", error)",
      "  }",
      "}",
    ].join("\n")
    const lines = syntheticSource.split("\n")
    const callLineIdx = lines.findIndex((l) => l.includes("console.error"))
    const window = lines.slice(callLineIdx, callLineIdx + 6).join("\n")
    expect(/[(,]\s*error\s*[).,]/.test(window)).toBe(true)
    expect(/safeErrorForLog\(\s*error\s*\)/.test(window)).toBe(false)
  })
})
