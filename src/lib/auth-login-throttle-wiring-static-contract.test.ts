/// <reference types="bun-types" />

// ============================================
// AUTH-LOGIN-THROTTLE-HARDENING — contrato estático de wiring
// ============================================
// Protege que los 4 flujos de login (Cliente/Negocio/Repartidor vía
// auth/login/route.ts + CuentaOperativa vía operativo/login/route.ts) usen
// la dimensión de cuenta (src/lib/auth-login-throttle.ts); que el pre-check
// nunca incremente; que el fallo se registre en cuenta inexistente y en
// password incorrecta pero NUNCA en los estados posteriores (email no
// verificado, negocio no aprobado/suspendido, repartidor inactivo); que el
// éxito limpie fallos previos; y que login siga sin importar la política de
// contraseñas (PASSWORD-POLICY-HARDENING). Lectura de texto (readFileSync),
// mismo estilo que el resto de los contratos estáticos de este repo.
// Los archivos leídos usan CRLF — se normaliza a LF antes de cualquier match
// multilínea para que los patrones no dependan del line ending real.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()
const p = (...parts: string[]) => join(ROOT, ...parts)

const AUTH_LOGIN_ROUTE = p("src", "app", "api", "auth", "login", "route.ts")
const OPERATIVO_LOGIN_ROUTE = p("src", "app", "api", "operativo", "login", "route.ts")
const THROTTLE_LIB = p("src", "lib", "auth-login-throttle.ts")

function read(path: string): string {
  return readFileSync(path, "utf-8").replace(/\r\n/g, "\n")
}

/** Excluye líneas de comentario (//, *) antes de matchear código real — evita falsos positivos contra la propia documentación del archivo. */
function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n")
}

describe("AUTH-LOGIN-THROTTLE-HARDENING — los 4 flujos usan la dimensión de cuenta", () => {
  test("auth/login/route.ts importa el módulo de throttle por cuenta", () => {
    const source = read(AUTH_LOGIN_ROUTE)
    expect(source).toContain('from "@/lib/auth-login-throttle"')
    expect(source).toContain("checkLoginAccountThrottle")
    expect(source).toContain("recordLoginFailure")
    expect(source).toContain("clearLoginFailures")
    expect(source).toContain("loginThrottleKey")
  })

  test("operativo/login/route.ts importa el mismo módulo de throttle por cuenta", () => {
    const source = read(OPERATIVO_LOGIN_ROUTE)
    expect(source).toContain('from "@/lib/auth-login-throttle"')
    expect(source).toContain("checkLoginAccountThrottle")
    expect(source).toContain("recordLoginFailure")
    expect(source).toContain("clearLoginFailures")
    expect(source).toContain('loginThrottleKey("cuenta_operativa"')
  })

  test("auth/login/route.ts deriva la key para los 3 tipos de cuenta reales (cliente, negocio, repartidor)", () => {
    const source = read(AUTH_LOGIN_ROUTE)
    expect(source).toContain('loginThrottleKey("cliente"')
    expect(source).toContain('loginThrottleKey("negocio"')
    expect(source).toContain('loginThrottleKey("repartidor"')
  })

  test("Negocio usa el identificador normalizado SIN lowercase forzado (usuario.trim(), no .toLowerCase())", () => {
    const source = read(AUTH_LOGIN_ROUTE)
    const negocioFnMatch = source.match(/async function loginNegocio[\s\S]*?\n}\n/)
    expect(negocioFnMatch).not.toBeNull()
    const body = negocioFnMatch?.[0] ?? ""
    expect(body).toContain("const normalizedUsuario = usuario.trim()")
    expect(body).not.toContain("normalizedUsuario.toLowerCase")
    expect(body).toContain('loginThrottleKey("negocio", normalizedUsuario)')
  })
})

describe("AUTH-LOGIN-THROTTLE-HARDENING — pre-check nunca incrementa", () => {
  test("PREAUTH_CHECK_INCREMENTS_FAILURES=NO: checkLoginAccountThrottle no invoca recordLoginFailure ni escribe (sólo findUnique)", () => {
    const source = read(THROTTLE_LIB)
    const fnMatch = source.match(/export async function checkLoginAccountThrottle[\s\S]*?\n}\n/)
    expect(fnMatch).not.toBeNull()
    const body = fnMatch?.[0] ?? ""
    expect(body).toContain("findUnique")
    expect(body).not.toContain("recordLoginFailure")
    expect(body).not.toMatch(/\.(create|update|upsert|\$queryRaw|\$executeRaw)\(/)
  })
})

describe("AUTH-LOGIN-THROTTLE-HARDENING — failure-only (§39 del pedido)", () => {
  test("ACCOUNT_FAILURE_RECORDED_ON_INVALID_ACCOUNT + ON_BAD_PASSWORD: los 4 flujos llaman accountLoginFailureResponse en ambas ramas", () => {
    const authSource = read(AUTH_LOGIN_ROUTE)
    // "return accountLoginFailureResponse(" cuenta sólo los call-sites reales,
    // no la línea "async function accountLoginFailureResponse(...)" que la
    // declara.
    const matches = authSource.match(/return accountLoginFailureResponse\(/g) ?? []
    // Cliente + Negocio + Repartidor = 2 llamadas cada uno (cuenta inexistente + password incorrecta) = 6
    expect(matches.length).toBe(6)

    const operativoSource = read(OPERATIVO_LOGIN_ROUTE)
    // "await accountLoginFailureResponse(throttleKey" excluye la línea de
    // declaración ("async function accountLoginFailureResponse(throttleKey:
    // string, ...)"), que no lleva "await" delante.
    const opMatches = operativoSource.match(/await accountLoginFailureResponse\(throttleKey/g) ?? []
    expect(opMatches.length).toBe(2)
  })

  test("ACCOUNT_FAILURE_RECORDED_ON_SUCCESS=NO: ningún camino de éxito llama accountLoginFailureResponse/recordLoginFailure", () => {
    // Por función (no por archivo completo): cada función de login tiene su
    // PROPIO punto de éxito, y el código de OTRA función que aparece después
    // en el archivo (con sus propios fallos legítimos) no debe confundirse
    // con una violación de esta función.
    const authSource = read(AUTH_LOGIN_ROUTE)
    const functionBoundaries = [
      /async function loginCliente[\s\S]*?\nasync function loginNegocio/,
      /async function loginNegocio[\s\S]*?\nasync function loginRepartidor/,
      /async function loginRepartidor[\s\S]*$/,
    ]
    for (const boundary of functionBoundaries) {
      const body = authSource.match(boundary)?.[0] ?? ""
      const successPointIdx = body.indexOf("if (throttle.hadActiveFailures)")
      expect(successPointIdx).toBeGreaterThan(-1)
      const afterSuccess = body.slice(successPointIdx)
      expect(afterSuccess).not.toContain("accountLoginFailureResponse(throttleKey")
      expect(afterSuccess).not.toContain("await recordLoginFailure(")
    }

    const opSource = read(OPERATIVO_LOGIN_ROUTE)
    const opSuccessIdx = opSource.indexOf("if (throttle.hadActiveFailures)")
    expect(opSuccessIdx).toBeGreaterThan(-1)
    const opAfterSuccess = opSource.slice(opSuccessIdx)
    expect(opAfterSuccess).not.toContain("accountLoginFailureResponse(throttleKey")
    expect(opAfterSuccess).not.toContain("await recordLoginFailure(")
  })

  test("SUCCESS_WITH_PRIOR_FAILURES_RESETS_COUNTER=SI: clearLoginFailures se llama condicionado a hadActiveFailures, antes de continuar la lógica existente", () => {
    for (const file of [AUTH_LOGIN_ROUTE, OPERATIVO_LOGIN_ROUTE]) {
      const source = read(file)
      expect(source).toMatch(/if \(throttle\.hadActiveFailures\) \{\s*\n\s*await clearLoginFailures\(throttleKey\)/)
    }
  })

  test("SUCCESS_WITHOUT_PRIOR_FAILURES_DB_WRITE=NO: clearLoginFailures nunca se llama incondicionalmente (siempre detrás de un if)", () => {
    for (const file of [AUTH_LOGIN_ROUTE, OPERATIVO_LOGIN_ROUTE]) {
      const source = read(file)
      const lines = source.split("\n")
      lines.forEach((line, i) => {
        if (line.includes("await clearLoginFailures(")) {
          const prevLine = lines[i - 1] ?? ""
          expect(prevLine).toContain("if (throttle.hadActiveFailures)")
        }
      })
    }
  })
})

describe("AUTH-LOGIN-THROTTLE-HARDENING — status gates NO cuentan como fallo (§40 del pedido)", () => {
  test("Cliente: el chequeo emailVerified está DESPUÉS del clear de éxito — no puede disparar un fallo de password", () => {
    const source = read(AUTH_LOGIN_ROUTE)
    const clienteFnMatch = source.match(/async function loginCliente[\s\S]*?\nasync function loginNegocio/)
    const body = clienteFnMatch?.[0] ?? ""
    const clearIdx = body.indexOf("await clearLoginFailures(throttleKey)")
    const emailVerifiedIdx = body.indexOf("!cliente.emailVerified")
    expect(clearIdx).toBeGreaterThan(-1)
    expect(emailVerifiedIdx).toBeGreaterThan(clearIdx)
  })

  test("Negocio: aprobado/suspendido están DESPUÉS del clear de éxito", () => {
    const source = read(AUTH_LOGIN_ROUTE)
    const negocioFnMatch = source.match(/async function loginNegocio[\s\S]*?\nasync function loginRepartidor/)
    const body = negocioFnMatch?.[0] ?? ""
    const clearIdx = body.indexOf("await clearLoginFailures(throttleKey)")
    const aprobadoIdx = body.indexOf("!negocio.aprobado")
    const suspendidoIdx = body.indexOf("negocio.suspendido")
    expect(clearIdx).toBeGreaterThan(-1)
    expect(aprobadoIdx).toBeGreaterThan(clearIdx)
    expect(suspendidoIdx).toBeGreaterThan(clearIdx)
  })

  test("Repartidor: activo está DESPUÉS del clear de éxito", () => {
    const source = read(AUTH_LOGIN_ROUTE)
    const repartidorFnMatch = source.match(/async function loginRepartidor[\s\S]*$/)
    const body = repartidorFnMatch?.[0] ?? ""
    const clearIdx = body.indexOf("await clearLoginFailures(throttleKey)")
    const activoIdx = body.indexOf("!repartidor.activo")
    expect(clearIdx).toBeGreaterThan(-1)
    expect(activoIdx).toBeGreaterThan(clearIdx)
  })

  test("CuentaOperativa: activo/eliminado están comprobados ANTES de comparePassword (secuencia real preservada, documentada explícitamente en el código)", () => {
    const source = read(OPERATIVO_LOGIN_ROUTE)
    const eliminadoIdx = source.indexOf("account.eliminado || !account.activo")
    const comparePasswordIdx = source.indexOf("comparePassword(password, account.password)")
    expect(eliminadoIdx).toBeGreaterThan(-1)
    expect(comparePasswordIdx).toBeGreaterThan(eliminadoIdx)
    // El comentario que documenta esta secuencia real debe seguir presente.
    expect(source).toMatch(/secuencia real/)
  })
})

describe("AUTH-LOGIN-THROTTLE-HARDENING — cuentas inexistentes protegidas igual (pre-auth)", () => {
  test("NONEXISTENT_ACCOUNT_THROTTLED=SI: el pre-check ocurre ANTES del lookup de cuenta en los 4 flujos", () => {
    const authSource = read(AUTH_LOGIN_ROUTE)
    const boundaries: Record<string, RegExp> = {
      loginCliente: /async function loginCliente[\s\S]*?\nasync function loginNegocio/,
      loginNegocio: /async function loginNegocio[\s\S]*?\nasync function loginRepartidor/,
      loginRepartidor: /async function loginRepartidor[\s\S]*$/,
    }
    for (const [fn, lookupCall] of [
      ["loginCliente", "db.cliente.findUnique"],
      ["loginNegocio", "db.negocio.findUnique"],
      ["loginRepartidor", "db.repartidor.findUnique"],
    ] as const) {
      const fnMatch = authSource.match(boundaries[fn])
      const body = fnMatch?.[0] ?? ""
      const checkIdx = body.indexOf("checkLoginAccountThrottle(throttleKey)")
      const lookupIdx = body.indexOf(lookupCall)
      expect(checkIdx).toBeGreaterThan(-1)
      expect(lookupIdx).toBeGreaterThan(checkIdx)
    }

    const opSource = read(OPERATIVO_LOGIN_ROUTE)
    const opCheckIdx = opSource.indexOf("checkLoginAccountThrottle(throttleKey)")
    const opLookupIdx = opSource.indexOf("db.cuentaOperativa.findUnique")
    expect(opCheckIdx).toBeGreaterThan(-1)
    expect(opLookupIdx).toBeGreaterThan(opCheckIdx)
  })
})

describe("AUTH-LOGIN-THROTTLE-HARDENING — login sigue sin la política de contraseñas nuevas ni bloqueado por dispositivo", () => {
  test("login no importa password-policy (regresión de PASSWORD-POLICY-HARDENING)", () => {
    for (const file of [AUTH_LOGIN_ROUTE, OPERATIVO_LOGIN_ROUTE]) {
      const source = read(file)
      expect(source).not.toContain("password-policy")
      expect(source).not.toContain("validatePassword")
    }
  })

  test("BLOCKED_CLIENT_LOGIN_PRESERVED: el enriquecimiento de ClienteBloqueado sigue sin condicionar el login (no está detrás de ningún chequeo de throttle)", () => {
    const source = read(AUTH_LOGIN_ROUTE)
    expect(source).toContain("ensureClienteBloqueadoRecordForDevice")
    expect(source).toMatch(/if \(cliente\.bloqueado\) \{/)
  })

  test("DEVICE_SECURITY_CHANGED=NO: getOrCreateDeviceIdentity sigue presente sin cambios estructurales evidentes", () => {
    const source = read(AUTH_LOGIN_ROUTE)
    expect(source).toContain("getOrCreateDeviceIdentity(req)")
  })
})

describe("AUTH-LOGIN-THROTTLE-HARDENING — atomicidad y seguridad SQL", () => {
  test("RAW_SQL_UNSAFE_USED=NO: recordLoginFailure usa un tagged template ($queryRaw), nunca *Unsafe ni concatenación", () => {
    // codeOnly() excluye comentarios — el propio comentario del código
    // menciona "$queryRawUnsafe" en prosa para explicar qué NO se usa, lo
    // que de otro modo coincidiría con un grep global ingenuo.
    const code = codeOnly(read(THROTTLE_LIB))
    expect(code).not.toContain("$queryRawUnsafe")
    expect(code).not.toContain("$executeRawUnsafe")
    expect(code).toMatch(/db\.\$queryRaw<[^>]*>`/)
  })

  test("el upsert usa INSERT ... ON CONFLICT ... RETURNING (atómico, una sola sentencia)", () => {
    const source = read(THROTTLE_LIB)
    expect(source).toMatch(/INSERT INTO "login_throttle"/)
    expect(source).toMatch(/ON CONFLICT \("throttle_key"\) DO UPDATE SET/)
    expect(source).toMatch(/RETURNING "count", "reset_at"/)
  })

  test("no hay ningún patrón SELECT-luego-UPDATE en el módulo (race-prone, prohibido explícitamente)", () => {
    const source = read(THROTTLE_LIB)
    // Sólo debe existir un SELECT real: el findUnique de checkLoginAccountThrottle (lectura pura, nunca seguida de un write sobre el mismo dato).
    const findUniqueCount = (source.match(/findUnique\(/g) ?? []).length
    expect(findUniqueCount).toBe(1)
  })
})

describe("AUTH-LOGIN-THROTTLE-HARDENING — pureza", () => {
  test("THROTTLE_KEY_CONTAINS_PII=NO: cada console.error del módulo pasa el error por safeErrorForLog, nunca interpola throttleKey/identifier", () => {
    const source = read(THROTTLE_LIB)
    const errorCallSites = source.match(/console\.error\(/g) ?? []
    expect(errorCallSites.length).toBe(4) // check / cleanup / recordLoginFailure / clear
    // Cada línea que abre un console.error debe cerrar pasando el error por
    // safeErrorForLog en esa misma línea (todas las llamadas de este módulo
    // caben en una sola línea de código).
    const lines = source.split("\n")
    for (const line of lines) {
      if (line.includes("console.error(")) {
        expect(line).toContain("safeErrorForLog(error)")
        expect(line).not.toMatch(/throttleKey/)
      }
    }
  })

  test("sanity check: codeOnly() elimina una línea de comentario sintética", () => {
    const synthetic = "const x = 1\n// $queryRawUnsafe mentioned only in prose\nconst y = 2"
    expect(codeOnly(synthetic)).not.toContain("$queryRawUnsafe")
    expect(codeOnly(synthetic)).toContain("const y = 2")
  })
})
