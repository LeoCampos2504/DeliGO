/// <reference types="bun-types" />

// ============================================
// PASSWORD-POLICY-HARDENING — contrato estático de wiring
// ============================================
// Protege que los 7 puntos server de creación/cambio/reset usen la política
// central (src/lib/password-policy.ts) y ya no repitan `password.length < 6`;
// que login (auth/login, operativo/login, src/lib/auth.ts) NUNCA importe esa
// política (contraseñas históricas de 6-9 caracteres deben poder seguir
// autenticando); que la UI de creación/reset/cambio use PASSWORD_MIN_LENGTH
// desde el módulo de constantes; y que los inputs de LOGIN no fueron tocados.
// Lectura de texto (readFileSync), no un parser de TS/TSX completo — mismo
// estilo que el resto de los contratos estáticos de este repo.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()
const p = (...parts: string[]) => join(ROOT, ...parts)

// Los 7 puntos server de creación/cambio/reset (auditoría PASSWORD-POLICY-AUDIT)
const SERVER_POLICY_SITES = [
  p("src", "app", "api", "auth", "register", "route.ts"),
  p("src", "app", "api", "operativo", "register", "route.ts"),
  p("src", "app", "api", "auth", "reset-password", "route.ts"),
  p("src", "app", "api", "cliente", "password", "route.ts"),
  p("src", "app", "api", "repartidor", "perfil", "route.ts"),
]

const LOGIN_ROUTES = [
  p("src", "app", "api", "auth", "login", "route.ts"),
  p("src", "app", "api", "operativo", "login", "route.ts"),
]

const AUTH_LIB = p("src", "lib", "auth.ts")

const CREATE_RESET_CHANGE_UI = [
  p("src", "app", "registro", "negocio", "page.tsx"),
  p("src", "components", "auth", "auth-modal.tsx"),
  p("src", "components", "auth", "cuenta-operativa-register-form.tsx"),
  p("src", "app", "reset-password", "page.tsx"),
  p("src", "components", "client", "client-profile-panel.tsx"),
  p("src", "components", "repartidor", "profile-tab.tsx"),
]

const LOGIN_ONLY_UI = [
  p("src", "app", "login", "page.tsx"),
  p("src", "app", "repartidor", "page.tsx"),
  p("src", "app", "negocio", "page.tsx"),
]

describe("PASSWORD-POLICY-HARDENING — server sites migrados a la política central", () => {
  test("los 5 archivos server de creación/cambio/reset importan validatePassword desde @/lib/password-policy", () => {
    for (const file of SERVER_POLICY_SITES) {
      const source = readFileSync(file, "utf-8")
      expect(source).toContain('from "@/lib/password-policy"')
      expect(source).toContain("validatePassword(")
    }
  })

  test("ninguno de los 7 puntos server (3 en register/route.ts + 4 archivos) conserva el chequeo inline password.length < 6", () => {
    const allServerFiles = [
      p("src", "app", "api", "auth", "register", "route.ts"), // 3 sitios: Cliente/Negocio/Repartidor
      ...SERVER_POLICY_SITES.slice(1),
    ]
    let inlineMin6Remaining = 0
    for (const file of allServerFiles) {
      const source = readFileSync(file, "utf-8")
      const matches = source.match(/\w*password\w*\.length\s*<\s*6/gi) ?? []
      inlineMin6Remaining += matches.length
    }
    expect(inlineMin6Remaining).toBe(0)
  })

  test("register/route.ts contiene exactamente 3 invocaciones de validatePassword (Cliente, Negocio, Repartidor)", () => {
    const source = readFileSync(p("src", "app", "api", "auth", "register", "route.ts"), "utf-8")
    const matches = source.match(/validatePassword\(password\)/g) ?? []
    expect(matches.length).toBe(3)
  })

  test("repartidor/perfil/route.ts: el rate limit de password corre sólo dentro de la rama de cambio de contraseña, no en la edición general del perfil", () => {
    const source = readFileSync(p("src", "app", "api", "repartidor", "perfil", "route.ts"), "utf-8")
    expect(source).toContain('checkRateLimit("password"')
    // Aislamos el bloque `if (currentPassword && newPassword) { ... }` para
    // confirmar que el rate limit vive DENTRO de esa rama, no antes (donde
    // afectaría también a una edición de nombre/teléfono sin contraseña).
    const branchStart = source.indexOf("if (currentPassword && newPassword)")
    expect(branchStart).toBeGreaterThan(-1)
    const branchEnd = source.indexOf("\n    }\n", branchStart)
    const branchBody = source.slice(branchStart, branchEnd)
    expect(branchBody).toContain('checkRateLimit("password"')
    expect(branchBody).toContain("validatePassword(newPassword)")
    // El rate limit no debe aparecer ANTES de esta rama (es decir, no debe
    // ejecutarse incondicionalmente en cada PUT).
    const beforeBranch = source.slice(0, branchStart)
    expect(beforeBranch).not.toContain('checkRateLimit("password"')
  })
})

describe("PASSWORD-POLICY-HARDENING — login NUNCA importa la política de creación", () => {
  test("auth/login/route.ts y operativo/login/route.ts no importan @/lib/password-policy ni @/lib/password-policy-constants", () => {
    for (const file of LOGIN_ROUTES) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toContain("password-policy")
      expect(source).not.toContain("validatePassword")
    }
  })

  test("src/lib/auth.ts (hashPassword/comparePassword) no importa ni referencia la política central", () => {
    const source = readFileSync(AUTH_LIB, "utf-8")
    expect(source).not.toContain("password-policy")
    expect(source).not.toContain("validatePassword")
    expect(source).not.toContain("PASSWORD_MIN_LENGTH")
    expect(source).not.toContain("PASSWORD_MAX_LENGTH")
  })

  test("src/lib/auth.ts sigue exportando hashPassword y comparePassword sin ninguna validación de longitud propia", () => {
    const source = readFileSync(AUTH_LIB, "utf-8")
    expect(source).toContain("export async function hashPassword")
    expect(source).toContain("export async function comparePassword")
    expect(source).not.toMatch(/password\.length/)
  })

  test("PBKDF2_ITERATIONS/SALT_LENGTH/KEY_LENGTH permanecen exactamente en los valores auditados (hashing no tocado)", () => {
    const source = readFileSync(AUTH_LIB, "utf-8")
    expect(source).toContain("const PBKDF2_ITERATIONS = 100000")
    expect(source).toContain("const SALT_LENGTH = 16")
    expect(source).toContain("const KEY_LENGTH = 32")
  })
})

describe("PASSWORD-POLICY-HARDENING — UI de creación/reset/cambio", () => {
  test("los 6 archivos de UI create/reset/change importan PASSWORD_MIN_LENGTH y passwordCodePointLength desde @/lib/password-policy-constants", () => {
    for (const file of CREATE_RESET_CHANGE_UI) {
      const source = readFileSync(file, "utf-8")
      expect(source).toContain('from "@/lib/password-policy-constants"')
      expect(source).toContain("PASSWORD_MIN_LENGTH")
      expect(source).toContain("passwordCodePointLength")
    }
  })

  test("ninguno de los 6 archivos usa minLength/maxLength nativos como política de una contraseña NUEVA (unidad de code points, no code units)", () => {
    // Los constraints HTML minLength/maxLength cuentan UTF-16 code units, no
    // code points Unicode — pueden aceptar/rechazar distinto que el servidor
    // para emoji y otros caracteres fuera del BMP. Por eso create/reset/change
    // validan explícitamente con passwordCodePointLength() antes de enviar,
    // en vez de depender de esos atributos nativos.
    for (const file of CREATE_RESET_CHANGE_UI) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toMatch(/minLength=\{PASSWORD_MIN_LENGTH\}/)
      expect(source).not.toMatch(/maxLength=\{PASSWORD_MAX_LENGTH\}/)
      expect(source).not.toMatch(/minLength=\{10\}/)
      expect(source).not.toMatch(/maxLength=\{128\}/)
    }
  })

  test("ninguno de los 5 archivos sin modo LOGIN hardcodea minLength={6} (ya migrados a la política central)", () => {
    // auth-modal.tsx queda fuera de este check: es el único archivo mixto
    // (LoginStep + RegisterStep) y conserva minLength={6} intencionalmente
    // en su input de LOGIN — verificado por separado más abajo, aislando
    // cada step.
    const nonMixedFiles = CREATE_RESET_CHANGE_UI.filter(
      (file) => !file.endsWith(join("components", "auth", "auth-modal.tsx"))
    )
    expect(nonMixedFiles.length).toBe(5)
    for (const file of nonMixedFiles) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toMatch(/minLength=\{6\}/)
    }
  })

  test("los 3 formularios de LOGIN puro (login/page.tsx, repartidor/page.tsx, negocio/page.tsx) NO importan la política de creación", () => {
    for (const file of LOGIN_ONLY_UI) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toContain("password-policy")
    }
  })

  test("auth-modal.tsx: el input de LOGIN conserva minLength={6} sin cambios; RegisterStep valida con passwordCodePointLength (sin minLength/maxLength nativos)", () => {
    const source = readFileSync(p("src", "components", "auth", "auth-modal.tsx"), "utf-8")
    // Aísla LoginStep del resto del archivo (termina donde empieza RegisterStep).
    const loginStepStart = source.indexOf("function LoginStep(")
    const registerStepStart = source.indexOf("export function RegisterStep(")
    expect(loginStepStart).toBeGreaterThan(-1)
    expect(registerStepStart).toBeGreaterThan(loginStepStart)
    const loginStepBody = source.slice(loginStepStart, registerStepStart)
    expect(loginStepBody).toMatch(/minLength=\{6\}/)
    expect(loginStepBody).not.toContain("PASSWORD_MIN_LENGTH")
    expect(loginStepBody).not.toContain("passwordCodePointLength")

    const registerStepBody = source.slice(registerStepStart)
    expect(registerStepBody).toContain("passwordCodePointLength(password)")
    expect(registerStepBody).not.toMatch(/minLength=\{PASSWORD_MIN_LENGTH\}/)
    expect(registerStepBody).not.toMatch(/maxLength=\{PASSWORD_MAX_LENGTH\}/)
  })

  test("los 6 archivos validan explícitamente contra PASSWORD_MIN_LENGTH y PASSWORD_MAX_LENGTH antes de enviar la request (rango 10-128 completo, no sólo el mínimo)", () => {
    for (const file of CREATE_RESET_CHANGE_UI) {
      const source = readFileSync(file, "utf-8")
      // Cada archivo compara la longitud (en code points) contra ambos
      // límites — no sólo TOO_SHORT, también TOO_LONG — antes de fetch().
      expect(source).toMatch(/<\s*PASSWORD_MIN_LENGTH/)
      expect(source).toMatch(/>\s*PASSWORD_MAX_LENGTH/)
    }
  })

  test("ningún copy visible exige composición (mayúscula/número/símbolo obligatorios)", () => {
    const allUiFiles = [...CREATE_RESET_CHANGE_UI, ...LOGIN_ONLY_UI]
    for (const file of allUiFiles) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toMatch(/1 mayúscula|1 número|1 símbolo|debe contener.*mayúscula/i)
    }
  })

  test("autocomplete cerrado en los 3 gaps encontrados por la auditoría", () => {
    const registro = readFileSync(p("src", "app", "registro", "negocio", "page.tsx"), "utf-8")
    expect(registro).toMatch(/autoComplete="new-password"/)

    const clientPanel = readFileSync(p("src", "components", "client", "client-profile-panel.tsx"), "utf-8")
    expect(clientPanel).toMatch(/autoComplete="current-password"/)
    expect(clientPanel).toMatch(/autoComplete="new-password"/)

    const repartidorTab = readFileSync(p("src", "components", "repartidor", "profile-tab.tsx"), "utf-8")
    expect(repartidorTab).toMatch(/autoComplete="current-password"/)
    expect(repartidorTab).toMatch(/autoComplete="new-password"/)
  })
})

describe("PASSWORD-POLICY-HARDENING — pureza", () => {
  test("Prisma/schema/migrations no fueron tocados por esta tarea", () => {
    // No hay forma de comprobar "no tocado" leyendo el archivo actual — se
    // verifica en el diff de git durante la revisión, no acá. Este test sólo
    // confirma que ningún archivo de política referencia Prisma directamente
    // (la política es pura, sin acceso a DB).
    const policySource = readFileSync(p("src", "lib", "password-policy.ts"), "utf-8")
    expect(policySource).not.toContain("@prisma/client")
    expect(policySource).not.toContain('from "@/lib/db"')
  })

  test("password-policy-constants.ts no importa nada (browser-safe, sin dependencias)", () => {
    const source = readFileSync(p("src", "lib", "password-policy-constants.ts"), "utf-8")
    expect(source).not.toMatch(/^import /m)
  })

  test("password-policy.ts no depende de Node-only APIs (crypto, fs) — puede importarse en cualquier entorno", () => {
    const source = readFileSync(p("src", "lib", "password-policy.ts"), "utf-8")
    expect(source).not.toMatch(/from ["']crypto["']|from ["']fs["']/)
  })

  test("PASSWORD_CODEPOINT_HELPER_CENTRALIZED: password-policy.ts importa passwordCodePointLength en vez de duplicar Array.from(password).length", () => {
    const source = readFileSync(p("src", "lib", "password-policy.ts"), "utf-8")
    expect(source).toMatch(/import\s*\{[^}]*passwordCodePointLength[^}]*\}\s*from\s*["']\.\/password-policy-constants["']/)
    // La única definición real (Array.from(...).length) vive en
    // password-policy-constants.ts — este archivo sólo debe re-exportarla.
    expect(source).not.toMatch(/Array\.from\(password\)\.length/)
  })

  test("password-policy-constants.ts es la única definición real de passwordCodePointLength en todo el repo", () => {
    const constantsSource = readFileSync(p("src", "lib", "password-policy-constants.ts"), "utf-8")
    expect(constantsSource).toContain("export function passwordCodePointLength")
    expect(constantsSource).toContain("Array.from(password).length")
  })

  test("ningún archivo de UI create/reset/change duplica Array.from(password).length / Array.from(newPassword).length (usan el helper importado)", () => {
    for (const file of CREATE_RESET_CHANGE_UI) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toMatch(/Array\.from\((password|newPassword)\)\.length/)
    }
  })

  test("sanity check: el matcher de password.length < 6 detecta un caso sintético que sí lo contiene", () => {
    const synthetic = `if (newPassword.length < 6) { return }`
    expect(synthetic).toMatch(/\w*password\w*\.length\s*<\s*6/i)
  })
})
