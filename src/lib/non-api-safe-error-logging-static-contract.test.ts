/// <reference types="bun-types" />

// ============================================
// GLOBAL-LOGS-PII-2D-B — contrato estático: runtime fuera de src/app/api/**
// (páginas no-API, componentes compartidos, hooks de push y helpers de
// src/lib/** que no pertenecen a ningún batch previo) nunca vuelve a loguear
// un error atrapado — ni su `.message` — sin pasar por `safeErrorForLog`.
// ============================================
// Mismo criterio de lectura real de código fuente (nunca un parser completo
// de TypeScript) que negocio-api/cliente-auth-chat-client-order/operativo-
// operaciones/remaining-api-safe-error-logging-static-contract.test.ts
// (2A/2B/2C/2D-A).
//
// A diferencia de esos contratos, el scope de 2D-B NO son directorios
// completos (src/lib/**, src/hooks/**, src/components/** y src/app/**
// contienen muchos archivos ajenos a este batch) sino una lista explícita
// de los archivos realmente migrados en 2D-B (originalmente 13; 12 desde
// P2-T15, que retiró use-shared-push-notifications.ts por código muerto —
// sin consumidores tras el retiro de los paneles /e/[token] y /s/[token]).
//
// El heurístico de "variable de error" se extiende respecto de los
// contratos anteriores para cubrir los 2 patrones reales encontrados en
// 2D-B que el scanner estructural (basado sólo en `catch(x)`/`.catch(x=>)`)
// no detecta porque no son un catch: el callback de un event emitter
// (`socket.on("connect_error", (err) => ...)` en chat-sheet.tsx) y el
// parámetro de un lifecycle method de React
// (`componentDidCatch(error, errorInfo)` en section-error-boundary.tsx).

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const SCOPE_FILES = [
  join(process.cwd(), "src", "app", "m", "[token]", "page.tsx"),
  join(process.cwd(), "src", "app", "mozo", "[slug]", "page.tsx"),
  join(process.cwd(), "src", "components", "chat", "chat-sheet.tsx"),
  join(process.cwd(), "src", "components", "shared", "image-upload.tsx"),
  join(process.cwd(), "src", "components", "shared", "permission-prompt.tsx"),
  join(process.cwd(), "src", "components", "shared", "section-error-boundary.tsx"),
  join(process.cwd(), "src", "hooks", "use-push-notifications.ts"),
  join(process.cwd(), "src", "lib", "audit.ts"),
  join(process.cwd(), "src", "lib", "cloudinary.ts"),
  join(process.cwd(), "src", "lib", "mesa-pedido-cancelacion.ts"),
  join(process.cwd(), "src", "lib", "register-sw.ts"),
  join(process.cwd(), "src", "lib", "salon-new-order-notification.ts"),
]

type Violation = { file: string; line: number; snippet: string }

function findGuardVariable(lines: string[], callLineIdx: number): string | null {
  for (let j = callLineIdx; j >= Math.max(0, callLineIdx - 25); j--) {
    const catchMatch = lines[j].match(/catch\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)/)
    if (catchMatch) return catchMatch[1]

    const promiseCatchMatch = lines[j].match(/\.catch\(\s*\(?\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)?\s*=>/)
    if (promiseCatchMatch) return promiseCatchMatch[1]

    const eventHandlerMatch = lines[j].match(/\.on\(\s*["'][^"']+["']\s*,\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)\s*=>/)
    if (eventHandlerMatch) return eventHandlerMatch[1]

    const componentDidCatchMatch = lines[j].match(/componentDidCatch\(\s*([A-Za-z_$][A-Za-z0-9_$]*)/)
    if (componentDidCatchMatch) return componentDidCatchMatch[1]

    if (/^\s*(export async function|export function|async function|export const|function)\s/.test(lines[j])) break
  }
  return null
}

function findUnsafeErrorLogCalls(): Violation[] {
  const violations: Violation[] = []

  for (const file of SCOPE_FILES) {
    const content = readFileSync(file, "utf-8")
    const lines = content.split(/\r\n|\n/)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!/console\.(log|error|warn|info|debug)\(/.test(line)) continue

      const callWindow = lines.slice(i, Math.min(i + 6, lines.length)).join("\n")
      const guardVar = findGuardVariable(lines, i)
      if (!guardVar) continue

      const rawPattern = new RegExp(`[(,]\\s*${guardVar}\\s*[).,]|${guardVar}\\.message\\b|${guardVar}\\.stack\\b|${guardVar}\\.cause\\b`)
      const safePattern = new RegExp(`safeErrorForLog\\(\\s*${guardVar}\\s*\\)`)

      if (rawPattern.test(callWindow) && !safePattern.test(callWindow)) {
        violations.push({ file: file.replace(process.cwd(), "").replace(/\\/g, "/"), line: i + 1, snippet: line.trim() })
      }
    }
  }

  return violations
}

describe("GLOBAL-LOGS-PII-2D-B — contrato estático: runtime no-API nunca loguea errores crudos", () => {
  test("ningún console.* en el scope de 2D-B pasa un error atrapado (ni su .message/.stack/.cause) sin safeErrorForLog(...)", () => {
    const violations = findUnsafeErrorLogCalls()
    if (violations.length > 0) {
      const details = violations.map((v) => `  ${v.file}:${v.line} -> ${v.snippet}`).join("\n")
      throw new Error(`Se encontraron ${violations.length} caller(s) de error crudo en el scope de GLOBAL-LOGS-PII-2D-B:\n${details}`)
    }
    expect(violations).toEqual([])
  })

  test("sanity check: el detector encuentra un caller crudo sintético en un catch (control, nunca 0 detecciones por un bug silencioso)", () => {
    const syntheticSource = [
      "async function run() {",
      "  try {",
      "    doSomething()",
      "  } catch (error) {",
      "    console.error(\"Fallo sintetico:\", error)",
      "  }",
      "}",
    ].join("\n")
    const lines = syntheticSource.split("\n")
    const callLineIdx = lines.findIndex((l) => l.includes("console.error"))
    const guardVar = findGuardVariable(lines, callLineIdx)
    expect(guardVar).toBe("error")
    const window = lines.slice(callLineIdx, callLineIdx + 6).join("\n")
    expect(/[(,]\s*error\s*[).,]/.test(window)).toBe(true)
    expect(/safeErrorForLog\(\s*error\s*\)/.test(window)).toBe(false)
  })

  test("sanity check: el detector encuentra un caller crudo sintético en un event handler (gap real de chat-sheet.tsx)", () => {
    const syntheticSource = [
      "socket.on(\"connect_error\", (err) => {",
      "  console.warn(\"[Chat] Connection error:\", err.message)",
      "})",
    ].join("\n")
    const lines = syntheticSource.split("\n")
    const callLineIdx = lines.findIndex((l) => l.includes("console.warn"))
    const guardVar = findGuardVariable(lines, callLineIdx)
    expect(guardVar).toBe("err")
    const window = lines.slice(callLineIdx, callLineIdx + 6).join("\n")
    expect(/err\.message\b/.test(window)).toBe(true)
    expect(/safeErrorForLog\(\s*err\s*\)/.test(window)).toBe(false)
  })

  test("sanity check: el detector encuentra un caller crudo sintético en componentDidCatch (gap real de section-error-boundary.tsx)", () => {
    const syntheticSource = [
      "componentDidCatch(error, errorInfo) {",
      "  console.error(\"Section error:\", error, errorInfo)",
      "}",
    ].join("\n")
    const lines = syntheticSource.split("\n")
    const callLineIdx = lines.findIndex((l) => l.includes("console.error"))
    const guardVar = findGuardVariable(lines, callLineIdx)
    expect(guardVar).toBe("error")
    const window = lines.slice(callLineIdx, callLineIdx + 6).join("\n")
    expect(/[(,]\s*error\s*[).,]/.test(window)).toBe(true)
    expect(/safeErrorForLog\(\s*error\s*\)/.test(window)).toBe(false)
  })

  test("sanity check: el detector ignora un caller ya sanitizado (evita falsos positivos)", () => {
    const syntheticSource = [
      "try {",
      "  doSomething()",
      "} catch (error) {",
      "  console.error(\"Fallo ya sanitizado:\", safeErrorForLog(error))",
      "}",
    ].join("\n")
    const lines = syntheticSource.split("\n")
    const callLineIdx = lines.findIndex((l) => l.includes("console.error"))
    const guardVar = findGuardVariable(lines, callLineIdx)
    expect(guardVar).toBe("error")
    const window = lines.slice(callLineIdx, callLineIdx + 6).join("\n")
    expect(/safeErrorForLog\(\s*error\s*\)/.test(window)).toBe(true)
  })
})
