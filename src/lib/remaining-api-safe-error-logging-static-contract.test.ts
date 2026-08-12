/// <reference types="bun-types" />

// ============================================
// GLOBAL-LOGS-PII-2D-A — contrato estático: el resto de src/app/api/**
// (denuncias, destacado-solicitud, negocios plural, notificaciones,
// pdf-proxy, push, repartidor, superadmin, upload) nunca vuelve a loguear
// un error atrapado sin pasar por `safeErrorForLog`
// ============================================
// Mismo criterio que negocio-api/cliente-auth-chat-client-order/operativo-
// operaciones-safe-error-logging-static-contract.test.ts (2A/2B/2C): lectura
// real de código fuente + aserciones puntuales — nunca un parser completo de
// TypeScript. El heurístico (¿el argumento de un console.* es el parámetro
// de la `catch` más cercana, y no está envuelto en `safeErrorForLog(...)`?)
// fue validado manualmente contra los 65 callers reales migrados en
// GLOBAL-LOGS-PII-2D-A (63 detectados por el scanner estructural + 2
// encontrados por el scan complementario de `error.message`) antes de
// convertirlo en test permanente.
//
// Acotado a propósito al resto real de src/app/api/** que NO pertenece a
// ningún batch previo (negocio/**, cliente/**, auth/** top-level, chat/**,
// operativo/**, operaciones/**, mozo/** singular — todos ya cubiertos por
// sus propios contratos de 2A/2B/2C). `src/app/api/mozos/**` y
// `src/app/api/empleados/**` tampoco se repiten acá (ya cubiertos por el
// contrato de 2C).

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "fs"
import { join, extname } from "path"

const SCOPE_DIRS = [
  join(process.cwd(), "src", "app", "api", "denuncias"),
  join(process.cwd(), "src", "app", "api", "destacado-solicitud"),
  join(process.cwd(), "src", "app", "api", "negocios"),
  join(process.cwd(), "src", "app", "api", "notificaciones"),
  join(process.cwd(), "src", "app", "api", "pdf-proxy"),
  join(process.cwd(), "src", "app", "api", "push"),
  join(process.cwd(), "src", "app", "api", "repartidor"),
  join(process.cwd(), "src", "app", "api", "superadmin"),
  join(process.cwd(), "src", "app", "api", "upload"),
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
  const files = SCOPE_DIRS.flatMap((dir) => walk(dir))

  for (const file of files) {
    const content = readFileSync(file, "utf-8")
    const lines = content.split(/\r\n|\n/)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!/console\.(log|error|warn|info|debug)\(/.test(line)) continue

      const callWindow = lines.slice(i, Math.min(i + 6, lines.length)).join("\n")

      // Detecta tanto `catch (x) {` como `error.message`/`err.message` sin
      // pasar por safeErrorForLog — cubre el mismo gap que encontró el
      // .message directo sobre un `error instanceof Error ? error.message : ...`.
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

      const rawPattern = new RegExp(`[(,]\\s*${catchVar}\\s*[).,]|${catchVar}\\.message\\b`)
      const safePattern = new RegExp(`safeErrorForLog\\(\\s*${catchVar}\\s*\\)`)

      if (rawPattern.test(callWindow) && !safePattern.test(callWindow)) {
        violations.push({ file: file.replace(process.cwd(), "").replace(/\\/g, "/"), line: i + 1, snippet: line.trim() })
      }
    }
  }

  return violations
}

describe("GLOBAL-LOGS-PII-2D-A — contrato estático: resto de src/app/api/** nunca loguea errores crudos", () => {
  test("ningún console.* en el scope de 2D-A pasa un error atrapado (ni su .message) sin safeErrorForLog(...)", () => {
    const violations = findUnsafeErrorLogCalls()
    if (violations.length > 0) {
      const details = violations.map((v) => `  ${v.file}:${v.line} -> ${v.snippet}`).join("\n")
      throw new Error(`Se encontraron ${violations.length} caller(s) de error crudo en el scope de GLOBAL-LOGS-PII-2D-A:\n${details}`)
    }
    expect(violations).toEqual([])
  })

  test("sanity check: el detector encuentra un caller crudo sintético de control (nunca 0 detecciones por un bug silencioso)", () => {
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

  test("sanity check: el detector también encuentra un error.message sintético sin envolver (gap encontrado en superadmin/auth)", () => {
    const syntheticSource = [
      "export async function GET() {",
      "  try {",
      "    doSomething()",
      "  } catch (error) {",
      "    console.error(\"Fallo sintetico:\", error instanceof Error ? error.message : \"unknown\")",
      "  }",
      "}",
    ].join("\n")
    const lines = syntheticSource.split("\n")
    const callLineIdx = lines.findIndex((l) => l.includes("console.error"))
    const window = lines.slice(callLineIdx, callLineIdx + 6).join("\n")
    expect(/error\.message\b/.test(window)).toBe(true)
    expect(/safeErrorForLog\(\s*error\s*\)/.test(window)).toBe(false)
  })
})
