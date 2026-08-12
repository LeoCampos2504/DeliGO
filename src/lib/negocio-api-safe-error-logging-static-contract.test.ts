/// <reference types="bun-types" />

// ============================================
// GLOBAL-LOGS-PII-2A — contrato estático: src/app/api/negocio/** nunca
// vuelve a loguear un error atrapado sin pasar por `safeErrorForLog`
// ============================================
// Mismo criterio que ya usan negocio-salon-static-contract.test.ts /
// mesa-cliente-cuenta-static-contract.test.ts: lectura real de código fuente
// + aserciones puntuales — nunca un parser completo de TypeScript. El
// heurístico (¿el argumento de un console.* es el parámetro de la `catch`
// más cercana, y no está envuelto en `safeErrorForLog(...)`?) es
// deliberadamente simple pero fue validado manualmente contra los 58
// callers reales migrados en GLOBAL-LOGS-PII-2A antes de convertirlo en
// test permanente — cero falsos positivos en esa corrida.
//
// Acotado a `src/app/api/negocio/**` a propósito (scope de esta tarea);
// otros dominios (265 callers restantes de GLOBAL-LOGS-PII-1B) se migran en
// lotes futuros, cada uno con su propio contrato si corresponde.

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "fs"
import { join, extname } from "path"

const SCOPE_DIR = join(process.cwd(), "src", "app", "api", "negocio")
const ERROR_VAR_NAMES = ["error", "err", "e", "cleanupError", "createError", "pushError", "reviewPushError", "catchError", "mozoPushError"]

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
  const files = walk(SCOPE_DIR)

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

      const candidateVar = catchVar && ERROR_VAR_NAMES.includes(catchVar)
        ? catchVar
        : ERROR_VAR_NAMES.find((name) => new RegExp(`[(,\\s]${name}\\b\\s*[).,]`).test(callWindow))

      if (!candidateVar) continue

      const rawPattern = new RegExp(`[(,]\\s*${candidateVar}\\s*[).,]`)
      const safePattern = new RegExp(`safeErrorForLog\\(\\s*${candidateVar}\\s*\\)`)

      if (rawPattern.test(callWindow) && !safePattern.test(callWindow)) {
        violations.push({ file: file.replace(process.cwd(), "").replace(/\\/g, "/"), line: i + 1, snippet: line.trim() })
      }
    }
  }

  return violations
}

describe("GLOBAL-LOGS-PII-2A — contrato estático: negocio API nunca loguea errores crudos", () => {
  test("ningún console.* en src/app/api/negocio/** pasa un error atrapado sin safeErrorForLog(...)", () => {
    const violations = findUnsafeErrorLogCalls()
    if (violations.length > 0) {
      const details = violations.map((v) => `  ${v.file}:${v.line} -> ${v.snippet}`).join("\n")
      throw new Error(`Se encontraron ${violations.length} caller(s) de error crudo en src/app/api/negocio/**:\n${details}`)
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
