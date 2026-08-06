/// <reference types="bun-types" />
// ============================================
// DeliGO — Test contractual estático: cuenta pública de mesa (23-B)
// ============================================
// Auditoría estática combinada con revisión estructural real (mismo
// criterio ya aplicado en mesa-pedido-cancelacion-ui-contract.test.ts de
// 23-A2): lee los archivos fuente reales y confirma patrones funcionales
// (no palabras sueltas — evita el mismo falso positivo ya documentado en
// 24-A/23-A2, donde un comentario explicativo contiene la palabra
// prohibida). No sustituye a los tests de comportamiento real (ver
// mesa-cliente-cuenta.test.ts contra PostgreSQL), los complementa.

import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()
function read(relPath: string): string {
  return readFileSync(join(ROOT, ...relPath.split("/")), "utf-8")
}

const SERVER_MODULE = "src/lib/mesa-cliente-cuenta.ts"
const CLIENT_MODULE = "src/lib/mesa-cliente-cuenta-client.ts"
const ROUTE = "src/app/api/public/mesa-cuenta/route.ts"
const PANEL = "src/components/shared/mesa-cliente-cuenta-panel.tsx"
const PUBLIC_PAGE = "src/app/n/[slug]/page.tsx"
const OCCUPANCY_MODULE = "src/lib/mesa-occupancy.ts"

describe("23-B — contrato del endpoint público", () => {
  test("el endpoint nunca acepta negocioId/mesaId/ocupacionId como autoridad (ni de query, ni de body)", () => {
    const src = read(ROUTE)
    // No lee ningún body — es un GET puro sin `req.json()`.
    expect(src).not.toContain("req.json(")
    expect(src).not.toContain("request.json(")
    // Los únicos parámetros leídos del cliente son slug/mesa (públicos, ya
    // impresos en el QR) — nunca los ids internos como valor de autoridad.
    for (const forbidden of ["searchParams.get(\"negocioId\")", "searchParams.get(\"mesaId\")", "searchParams.get(\"ocupacionId\")"]) {
      expect(src).not.toContain(forbidden)
    }
  })

  test("negocioId/mesaId SIEMPRE se resuelven server-side (findUnique/findFirst por slug/numero), nunca se leen del cliente", () => {
    const src = read(ROUTE)
    expect(src).toContain("db.negocio.findUnique")
    expect(src).toContain("db.mesa.findFirst")
  })

  test("la cookie de sesión se lee por su nombre exacto — nunca un valor manual del cliente", () => {
    const src = read(ROUTE)
    expect(src).toContain("MESA_OCCUPANCY_COOKIE_NAME")
    expect(src).toContain("request.cookies.get(MESA_OCCUPANCY_COOKIE_NAME)")
  })

  test("toda respuesta usa Cache-Control: private, no-store — nunca cache pública", () => {
    const src = read(ROUTE)
    expect(src).toContain('"Cache-Control": "private, no-store"')
    // Se usa en TODOS los returns (vía el helper jsonNoStore), nunca un
    // NextResponse.json crudo que se salte el header.
    expect(src).not.toMatch(/NextResponse\.json\(\s*\{[^}]*\}\s*,\s*\{\s*status:/)
  })

  test("la respuesta nunca revela el motivo real de un 'sin_sesion' (mesa/negocio inexistente, token ausente, token de otra mesa colapsan al mismo status)", () => {
    const src = read(ROUTE)
    const sinSesionOccurrences = (src.match(/sinSesion\(\)/g) ?? []).length
    // Se reutiliza la MISMA función para los 3 casos (negocio no aprobado/
    // suspendido/sin salón, mesa inexistente, y acceso no autorizado) — no
    // hay 3 respuestas distintas que un atacante pudiera diferenciar.
    expect(sinSesionOccurrences).toBeGreaterThanOrEqual(3)
  })

  test("aplica rate limiting reutilizando el helper existente, con un bucket propio (no reutiliza 'mesaGeofence')", () => {
    const src = read(ROUTE)
    expect(src).toContain('checkRateLimit("mesaCuentaPublica"')
    expect(src).toContain("rateLimitResponse")
  })

  test("23-B-CORRECCIÓN-1: aplica también un límite grueso por IP sola, evaluado antes que el límite fino", () => {
    const src = read(ROUTE)
    const idxIp = src.indexOf('checkRateLimit("mesaCuentaPublicaIp"')
    const idxFino = src.indexOf('checkRateLimit("mesaCuentaPublica"')
    expect(idxIp).toBeGreaterThan(-1)
    expect(idxFino).toBeGreaterThan(-1)
    expect(idxIp).toBeLessThan(idxFino)
  })

  test("23-B-CORRECCIÓN-1: slug y mesa se validan/normalizan (charset y longitud acotados) ANTES de construir la clave del rate limit", () => {
    const src = read(ROUTE)
    const idxParseSlug = src.indexOf("function parseSlug")
    const idxParseMesa = src.indexOf("function parseMesaNumero")
    const idxRateLimit = src.indexOf("checkRateLimit(")
    expect(idxParseSlug).toBeGreaterThan(-1)
    expect(idxParseMesa).toBeGreaterThan(-1)
    expect(idxParseSlug).toBeLessThan(idxRateLimit)
    expect(idxParseMesa).toBeLessThan(idxRateLimit)
    expect(src).toMatch(/SLUG_PATTERN\s*=\s*\/\^\[a-z0-9-\]\{1,80\}\$\//)
    expect(src).toContain("MESA_NUMERO_MAX")
  })

  test("route.ts NUNCA pasa testHooks a resolveMesaClienteCuenta — la pausa inyectable es exclusiva de tests", () => {
    const src = read(ROUTE)
    expect(src).toContain("resolveMesaClienteCuenta({")
    expect(src).not.toContain("beforeLoadPedidos")
    expect(src).not.toContain("beforeFinalRevalidation")
  })
})

describe("23-B-CORRECCIÓN-1 — el TOCTOU original quedó eliminado a nivel estructural", () => {
  test("autorización y carga son un único punto de entrada (resolveMesaClienteCuenta) — ya no existen resolveMesaClienteCuentaAccess/loadMesaCuentaPublica separadas", () => {
    const src = read(SERVER_MODULE)
    expect(src).toContain("export async function resolveMesaClienteCuenta(")
    expect(src).not.toContain("export async function resolveMesaClienteCuentaAccess")
    expect(src).not.toContain("export async function loadMesaCuentaPublica")
  })

  test("existe una revalidación final que reutiliza la MISMA función de validación que la primera (nunca dos implementaciones distintas)", () => {
    const src = read(SERVER_MODULE)
    const ocurrencias = (src.match(/validarAccesoActual\(/g) ?? []).length
    // Se define una vez y se LLAMA al menos dos veces (primera validación +
    // revalidación final) — nunca una copia divergente de la lógica.
    expect(ocurrencias).toBeGreaterThanOrEqual(3) // 1 definición + >=2 llamadas
  })

  test("la respuesta 'activa' solo puede construirse DESPUÉS de la revalidación final en el código fuente", () => {
    const src = read(SERVER_MODULE)
    const idxRevalidacion = src.lastIndexOf("validarAccesoActual(")
    const idxRespuestaActiva = src.indexOf('status: "activa"', idxRevalidacion)
    expect(idxRevalidacion).toBeGreaterThan(-1)
    expect(idxRespuestaActiva).toBeGreaterThan(idxRevalidacion)
  })

  test("el tipo MesaClienteCuentaResultado impide a nivel de TypeScript que 'cerrada'/'sin_sesion' lleven campo `cuenta`", () => {
    const src = read(SERVER_MODULE)
    expect(src).toMatch(/\{\s*status:\s*"activa";\s*ocupacionId:\s*string;\s*cuenta:\s*CuentaMesaResult\s*\}/)
    expect(src).toMatch(/\{\s*status:\s*"cerrada"\s*\}/)
    expect(src).toMatch(/\{\s*status:\s*"sin_sesion"\s*\}/)
  })
})

describe("23-B — el resolver de autorización reutiliza el módulo de ocupación existente (nunca lo duplica)", () => {
  test("mesa-cliente-cuenta.ts importa hashMesaOccupancyToken de mesa-occupancy.ts — nunca redefine su propio hash", () => {
    const src = read(SERVER_MODULE)
    expect(src).toContain('from "@/lib/mesa-occupancy"')
    expect(src).toContain("hashMesaOccupancyToken")
    expect(src).not.toContain("createHash(")
  })

  test("mesa-occupancy.ts (P0-D, ya auditado y probado indirectamente) permanece intacto — 23-B no lo modifica", () => {
    // No es un assert de contenido — ver la sección 'archivos modificados'
    // del informe (git diff vacío para este archivo). Este test documenta
    // la intención: si algún día se edita, debe seguir exportando los
    // mismos símbolos que 23-B consume.
    const src = read(OCCUPANCY_MODULE)
    expect(src).toContain("export function hashMesaOccupancyToken")
    expect(src).toContain("export const MESA_OCCUPANCY_COOKIE_NAME")
    expect(src).toContain("export function clearMesaOccupancyCookie")
  })

  test("el cálculo financiero se reutiliza de mesa-cuenta.ts (buildCuentaMesa) — nunca se duplica la lógica de inclusión/exclusión", () => {
    const src = read(SERVER_MODULE)
    expect(src).toContain('from "@/lib/mesa-cuenta"')
    expect(src).toContain("buildCuentaMesa")
    // Nunca reimplementa el criterio incluido/excluido/pendiente.
    expect(src).not.toMatch(/estado\s*===\s*"entregado"/)
    expect(src).not.toMatch(/estado\s*===\s*"cancelado"/)
  })
})

describe("23-B — el cliente/panel nunca usa localStorage/sessionStorage como autoridad", () => {
  test("mesa-cliente-cuenta-client.ts no lee/escribe localStorage ni sessionStorage", () => {
    const src = read(CLIENT_MODULE)
    expect(src).not.toContain("localStorage")
    expect(src).not.toContain("sessionStorage")
  })

  test("mesa-cliente-cuenta-panel.tsx no lee/escribe localStorage ni sessionStorage, ni document.cookie", () => {
    const src = read(PANEL)
    expect(src).not.toContain("localStorage")
    expect(src).not.toContain("sessionStorage")
    expect(src).not.toContain("document.cookie")
  })

  test("el fetch del cliente usa cache: 'no-store' explícito", () => {
    const src = read(CLIENT_MODULE)
    expect(src).toMatch(/cache:\s*"no-store"/)
  })

  test("el panel nunca hace su propio fetch al endpoint — siempre pasa por el cliente compartido", () => {
    const src = read(PANEL)
    expect(src).toContain("fetchMesaClienteCuenta")
    expect(src).not.toMatch(/fetch\(\s*[`'"]\/api\/public\/mesa-cuenta/)
  })
})

describe("23-B — integración en la página pública", () => {
  test("la página importa y monta el panel, gateado a mesa de cliente real (no mozo)", () => {
    const src = read(PUBLIC_PAGE)
    expect(src).toContain('import { MesaClienteCuentaPanel } from "@/components/shared/mesa-cliente-cuenta-panel"')
    expect(src).toMatch(/<MesaClienteCuentaPanel[\s\S]*?\/>/)
    expect(src).toMatch(/isMesaOrder\s*&&\s*mesaNumero\s*&&\s*!isAuthenticatedMozo/)
  })

  test("la página nunca pasa negocioId/mesaId/ocupacionId al panel — solo slug/mesaNumero públicos", () => {
    const src = read(PUBLIC_PAGE)
    const usage = src.match(/<MesaClienteCuentaPanel[\s\S]*?\/>/g) ?? []
    expect(usage.length).toBe(1)
    for (const forbidden of ["negocioId=", "mesaId=", "ocupacionId="]) {
      expect(usage[0]).not.toContain(forbidden)
    }
  })
})
