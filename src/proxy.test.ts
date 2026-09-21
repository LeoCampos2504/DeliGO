/// <reference types="bun-types" />

// ============================================
// P2-T18-BLOCKER-AUTH2-R2 (Phase 1) — actor-family session cookie resolution
// ============================================
// Cubre la matriz de seguridad de 16 casos congelada en el prompt de esta
// etapa (§17), adaptada a los nombres reales de esta implementación. Nunca
// toca DB (src/proxy.ts es Edge runtime, sin lookup a Sesion) — verifica
// exclusivamente el CONTRATO del resolver: qué cookie real se reenvía bajo
// el nombre legacy `deligo_session`, nunca qué actor "es verdaderamente"
// (eso sigue siendo responsabilidad exclusiva de los route handlers
// downstream, sin modificar, vía findSesionByToken/getUserFromToken —
// cubierto end-to-end en src/lib/actor-family-session-coexistence.integration.test.ts).

import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { proxy } from "@/proxy"

const CLIENTE_COOKIE = "deligo_session_cliente"
const NEGOCIO_COOKIE = "deligo_session_negocio"
const REPARTIDOR_COOKIE = "deligo_session_repartidor"
const CUENTA_OPERATIVA_COOKIE = "deligo_operativo_session"
const SUPERADMIN_COOKIE = "deligo_superadmin_session"
const LEGACY_COOKIE = "deligo_session"

function uuid(): string {
  return crypto.randomUUID()
}

/** 32 bytes hex — mismo formato exacto que generateSuperadminSessionToken
 * en src/lib/superadmin-auth.ts (nunca un UUID). */
function superadminToken(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
}

function req(
  path: string,
  cookiePairs: Record<string, string> = {},
  init: { method?: string; headers?: Record<string, string> } = {}
): NextRequest {
  const cookieHeader = Object.entries(cookiePairs)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
  return new NextRequest(`http://localhost${path}`, {
    ...init,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      // Origin same-origin — necesario para métodos mutantes (POST) por el
      // chequeo existente de validateMutationOrigin, sin relación con esta
      // tarea (ya existía antes de esta etapa, sin cambios).
      origin: "http://localhost",
      ...init.headers,
    },
  })
}

/** El header x-middleware-request-cookie es el mecanismo INTERNO documentado
 * de Next.js para exponer el override de request.headers hecho vía
 * `NextResponse.next({request:{headers}})` — ver
 * node_modules/next/dist/server/web/spec-extension/response.js
 * (handleMiddlewareField). Es la única forma de inspeccionar, en un test
 * unitario aislado, qué vería el route handler downstream. Desde
 * P2-T18-BLOCKER-AUTH2-R2-R2, proxy() SIEMPRE pasa requestInit (para
 * garantizar el saneamiento incondicional de RESOLVED_ACTOR_FAMILY_HEADER),
 * así que este header YA NO es null cuando no hay token resuelto — para
 * verificar "no se resolvió sesión" hay que comprobar la AUSENCIA de una
 * entrada real `deligo_session=`, no la ausencia del header entero (ver
 * hasResolvedSessionCookie). La cookie
 * resuelta convive ahí con las demás cookies de familia sin tocar (el
 * handler downstream sólo lee la entrada `deligo_session=`, nunca las
 * otras) — por eso las aserciones usan toContain, no igualdad exacta. */
function forwardedCookie(res: Response): string | null {
  return res.headers.get("x-middleware-request-cookie")
}

/** true sólo si el header Cookie reenviado downstream contiene una entrada
 * real `deligo_session=` — la única que los route handlers sin modificar
 * leen. No confundir con `forwardedCookie(res) !== null`, que desde
 * AUTH2-R2-R2 es casi siempre true (el header de override siempre existe
 * para poder sanear RESOLVED_ACTOR_FAMILY_HEADER), incluso cuando ningún
 * token de sesión fue resuelto. */
function hasResolvedSessionCookie(res: Response): boolean {
  const raw = forwardedCookie(res)
  if (!raw) return false
  return raw.split(";").some((part) => part.trim().startsWith(`${LEGACY_COOKIE}=`))
}

describe("CASE 1 — legacy cookie only, ruta family-specific: comportamiento actual preservado", () => {
  test("Cliente legacy -> /api/cliente resuelve y reenvía el mismo token bajo deligo_session", () => {
    const token = uuid()
    const res = proxy(req("/api/cliente/pedidos", { [LEGACY_COOKIE]: token }))
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
  })
})

describe("CASE 2/3 — cookie de familia única resuelve su propia ruta", () => {
  test("Cliente family cookie only -> /api/cliente resuelve Cliente", () => {
    const token = uuid()
    const res = proxy(req("/api/cliente/pedidos", { [CLIENTE_COOKIE]: token }))
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
  })

  test("Negocio family cookie only -> /api/negocio resuelve Negocio", () => {
    const token = uuid()
    const res = proxy(req("/api/negocio/dashboard", { [NEGOCIO_COOKIE]: token }))
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
  })
})

describe("CASE 4/5 — ambas cookies de familia presentes: cada path selecciona SÓLO la suya", () => {
  test("/api/cliente selecciona Cliente, nunca el token de Negocio", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(req("/api/cliente/pedidos", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken }))
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${negocioToken}`)
  })

  test("/api/negocio selecciona Negocio, nunca el token de Cliente", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(req("/api/negocio/dashboard", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken }))
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${negocioToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${clienteToken}`)
  })
})

describe("CASE 6 — el selector NUNCA anula la familia de path", () => {
  test("/api/cliente + ?actorFamily=negocio sigue resolviendo Cliente", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/cliente/pedidos?actorFamily=negocio", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken })
    )
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${negocioToken}`)
  })
})

describe("CASE 7/8 — endpoint compartido + selector explícito", () => {
  test("/api/auth/me?actorFamily=cliente selecciona sólo Cliente", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/auth/me?actorFamily=cliente", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken })
    )
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${negocioToken}`)
  })

  test("/api/auth/me?actorFamily=negocio selecciona sólo Negocio", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/auth/me?actorFamily=negocio", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken })
    )
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${negocioToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${clienteToken}`)
  })
})

describe("CASE 9 — selector desconocido: fail closed", () => {
  test("/api/auth/me?actorFamily=hacker con ambas cookies presentes -> ambiguo, sin reenvío", () => {
    const res = proxy(
      req("/api/auth/me?actorFamily=hacker", { [CLIENTE_COOKIE]: uuid(), [NEGOCIO_COOKIE]: uuid() })
    )
    expect(hasResolvedSessionCookie(res)).toBe(false)
  })
})

describe("CASE 10 — selector ausente en escenario ambiguo: comportamiento transicional exacto", () => {
  test("/api/auth/me sin selector, ambas cookies presentes -> ambiguo, sin reenvío (fail closed, nunca arbitrario)", () => {
    const res = proxy(req("/api/auth/me", { [CLIENTE_COOKIE]: uuid(), [NEGOCIO_COOKIE]: uuid() }))
    expect(hasResolvedSessionCookie(res)).toBe(false)
  })

  test("/api/auth/me sin selector, UNA sola cookie presente -> no ambiguo, se reenvía (preserva comportamiento actual de único actor)", () => {
    const token = uuid()
    const res = proxy(req("/api/auth/me", { [CLIENTE_COOKIE]: token }))
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
  })
})

describe("CASE 11 — cookie de familia inválida + otra familia válida: nunca cruza de familia", () => {
  test("/api/cliente con deligo_session_cliente malformada + deligo_session_negocio válida -> NO cae a Negocio", () => {
    const res = proxy(
      req("/api/cliente/pedidos", { [CLIENTE_COOKIE]: "not-a-uuid", [NEGOCIO_COOKIE]: uuid() })
    )
    // Resuelve family="cliente" (por path), cookie de esa familia inválida,
    // sin cookie legacy -> token=null. Nunca cae a la cookie de Negocio.
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(res.status).toBe(401)
  })
})

describe("CASE 13 — request-only: el handler downstream ve la cookie seleccionada", () => {
  test("el header x-middleware-request-cookie porta el token resuelto y el override queda declarado", () => {
    const token = uuid()
    const res = proxy(req("/api/negocio/dashboard", { [NEGOCIO_COOKIE]: token }))
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
    expect(res.headers.get("x-middleware-override-headers")).toContain("cookie")
  })
})

describe("CASE 14 — sin efecto secundario en la respuesta al navegador", () => {
  test("nunca se emite Set-Cookie sólo por resolver una familia", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/cliente/pedidos", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken })
    )
    expect(res.headers.get("set-cookie")).toBeNull()
    // x-middleware-set-cookie es la señal INTERNA de Next para
    // response.cookies.set()/.delete() — nunca la invocamos en este flujo.
    expect(res.headers.get("x-middleware-set-cookie")).toBeNull()
  })

  test("tampoco hay Set-Cookie en un 401 por familia inválida (CASE 11)", () => {
    const res = proxy(req("/api/cliente/pedidos", { [CLIENTE_COOKIE]: "not-a-uuid" }))
    expect(res.headers.get("set-cookie")).toBeNull()
  })
})

describe("Header de familia resuelta para logout", () => {
  test("/api/auth/logout con familia resuelta por selector adjunta x-resolved-actor-family", () => {
    const token = uuid()
    const res = proxy(req("/api/auth/logout?actorFamily=negocio", { [NEGOCIO_COOKIE]: token }, { method: "POST" }))
    expect(res.headers.get("x-middleware-request-x-resolved-actor-family")).toBe("negocio")
  })

  test("/api/auth/logout sin selector y sin ambigüedad NO adjunta el header (no hay familia resuelta)", () => {
    const token = uuid()
    const res = proxy(req("/api/auth/logout", { [LEGACY_COOKIE]: token }, { method: "POST" }))
    expect(res.headers.get("x-middleware-request-x-resolved-actor-family")).toBeNull()
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
  })

  test("otras rutas nunca adjuntan x-resolved-actor-family, aunque haya familia resuelta", () => {
    const res = proxy(req("/api/cliente/pedidos", { [CLIENTE_COOKIE]: uuid() }))
    expect(res.headers.get("x-middleware-request-x-resolved-actor-family")).toBeNull()
  })
})

describe("SANITIZACIÓN de x-resolved-actor-family (P2-T18-BLOCKER-AUTH2-R2-R2, corrección del hallazgo de AUTH2-R2-R1)", () => {
  test("escenario AMBIGUO (ambas cookies presentes, sin selector): un x-resolved-actor-family spoofeado por el cliente es removido, nunca llega downstream", () => {
    const res = proxy(
      req(
        "/api/auth/logout",
        { [CLIENTE_COOKIE]: uuid(), [NEGOCIO_COOKIE]: uuid() },
        { method: "POST", headers: { "x-resolved-actor-family": "negocio" } }
      )
    )
    // resolved.family=null (ambiguo), resolved.token=null -> el header
    // atacante debe ser eliminado incondicionalmente, no sólo "no agregado".
    expect(res.headers.get("x-middleware-request-x-resolved-actor-family")).toBeNull()
  })

  test("escenario NO AMBIGUO sin familia resuelta (sólo cookie legacy): un x-resolved-actor-family spoofeado también es removido", () => {
    const res = proxy(
      req(
        "/api/auth/logout",
        { [LEGACY_COOKIE]: uuid() },
        { method: "POST", headers: { "x-resolved-actor-family": "negocio" } }
      )
    )
    // resolved.family=null (sin path ni selector), resolved.token=<legacy> ->
    // headers SÍ se reescriben (rewriteResolvedSessionCookieHeaders), pero
    // el header spoofeado igual debe eliminarse incondicionalmente.
    expect(res.headers.get("x-middleware-request-x-resolved-actor-family")).toBeNull()
  })

  test("un valor spoofeado NUNCA sobrevive incluso cuando el resolver SÍ establece uno de confianza — el trusted value del servidor gana siempre", () => {
    const negocioToken = uuid()
    const res = proxy(
      req(
        "/api/auth/logout?actorFamily=negocio",
        { [NEGOCIO_COOKIE]: negocioToken },
        { method: "POST", headers: { "x-resolved-actor-family": "cliente" } }
      )
    )
    expect(res.headers.get("x-middleware-request-x-resolved-actor-family")).toBe("negocio")
  })

  test("el header de confianza generado por el resolver sigue funcionando sin regresión (caso legítimo ya cubierto arriba, re-verificado tras la corrección)", () => {
    const token = uuid()
    const res = proxy(req("/api/auth/logout?actorFamily=negocio", { [NEGOCIO_COOKIE]: token }, { method: "POST" }))
    expect(res.headers.get("x-middleware-request-x-resolved-actor-family")).toBe("negocio")
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
  })
})

describe("Superadmin: cookie propia, fuera de este mecanismo por completo", () => {
  test("/api/superadmin nunca es tocado por la resolución de familia (24-A, cookie aislada, sin cambio)", () => {
    // Sin deligo_superadmin_session -> 401 igual que siempre; el
    // resolver de familia (cliente/negocio/repartidor) es irrelevante acá.
    const res = proxy(req("/api/superadmin/panel", {}))
    expect(res.status).toBe(401)
  })

  // P2-T39-R3B: regresión explícita de que el fix de AUTH_REQUIRED_PREFIXES
  // (más abajo) nunca tocó esta ruta — ROLE_PROTECTED_ROUTES sigue leyendo
  // deligo_superadmin_session directamente, sin pasar por SessionFamily.
  test("/api/superadmin CON deligo_superadmin_session (formato real) -> nunca 401 en el middleware", () => {
    const res = proxy(req("/api/superadmin/dashboard", { [SUPERADMIN_COOKIE]: superadminToken() }))
    expect(res.status).not.toBe(401)
  })
})

// ============================================
// P2-T18-BLOCKER-AUTH2-R13-R2 (Fase 2, F-P2-T18-AUTH02)
// ============================================
// Cubre los 6 prefijos nuevos congelados por R13-R1: /api/chat/no-leidos,
// /api/chat/conversaciones, /api/chat/mensajes, /api/push/subscribe,
// /api/push/unsubscribe, /api/push/status. Mismo patrón exacto que CASE
// 7/8/9/10 (endpoint compartido + selector), aplicado a esta categoría —
// nunca reemplaza esos casos, los extiende. Ninguno de estos 6 prefijos
// está en ROLE_PROTECTED_ROUTES (nunca path-derivable), así que el único
// mecanismo de desambiguación posible es el selector.

describe("AUTH02 — Chat: selector explícito resuelve bajo coexistencia", () => {
  test("/api/chat/no-leidos?actorFamily=cliente con ambas cookies -> resuelve Cliente, nunca 401", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/chat/no-leidos?actorFamily=cliente", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken })
    )
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${negocioToken}`)
  })

  test("/api/chat/conversaciones?actorFamily=negocio con ambas cookies -> resuelve Negocio, nunca 401", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/chat/conversaciones?actorFamily=negocio", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken })
    )
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${negocioToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${clienteToken}`)
  })

  test("/api/chat/mensajes/<pedidoId>?actorFamily=cliente con ambas cookies -> resuelve Cliente (prefijo cubre el sub-path dinámico)", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/chat/mensajes/abc123?actorFamily=cliente", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken })
    )
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${negocioToken}`)
  })

  test("/api/chat/mensajes/<pedidoId>?mode=safety&actorFamily=cliente -> el selector convive con otros query params existentes", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/chat/mensajes/abc123?mode=safety&actorFamily=cliente", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken })
    )
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)
  })
})

describe("AUTH02 — Push: selector explícito resuelve bajo coexistencia", () => {
  test("/api/push/subscribe?actorFamily=negocio con ambas cookies -> resuelve Negocio, nunca 401", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/push/subscribe?actorFamily=negocio", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken }, { method: "POST" })
    )
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${negocioToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${clienteToken}`)
  })

  test("/api/push/unsubscribe?actorFamily=cliente con ambas cookies -> resuelve Cliente, nunca 401", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/push/unsubscribe?actorFamily=cliente", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken }, { method: "POST" })
    )
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${negocioToken}`)
  })

  test("/api/push/status?actorFamily=negocio con ambas cookies -> resuelve Negocio (fuera de AUTH_REQUIRED_PREFIXES, mismo mecanismo)", () => {
    const clienteToken = uuid()
    const negocioToken = uuid()
    const res = proxy(
      req("/api/push/status?actorFamily=negocio", { [CLIENTE_COOKIE]: clienteToken, [NEGOCIO_COOKIE]: negocioToken }, { method: "POST" })
    )
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${negocioToken}`)
    expect(forwardedCookie(res)).not.toContain(`${LEGACY_COOKIE}=${clienteToken}`)
  })
})

// ============================================
// P2-T44-R1G — Root cause de R1F (P2_T44_R1F_ACCOUNT_PUSH_SWITCH_FAILURE_AUDIT.md):
// "cuenta_operativa" (Personal Operaciones, R1D) nunca había sido agregada
// a este resolver — un ?actorFamily=cuenta_operativa real, con la cookie
// deligo_operativo_session real presente, se trataba como un selector
// desconocido (fail-closed): resolveActorSession devolvía token=null, y
// como /api/push/subscribe y /api/push/unsubscribe están en
// AUTH_REQUIRED_PREFIXES, el propio middleware devolvía 401 ANTES de que
// el request llegara a getOperationalAccountFromRequest (route handler
// real, que sí sabe autenticar esta familia vía esa misma cookie). Este
// bloque prueba el CONTRATO real del middleware — no una aserción frágil
// de substring — contra los 9 casos (A-I) que exige la tarea que
// implementó el fix.
// ============================================
describe("P2-T44-R1G — cuenta_operativa: el middleware ya no bloquea con 401 antes del route handler", () => {
  test("A: /api/push/subscribe?actorFamily=cuenta_operativa CON deligo_operativo_session -> nunca 401, cookie operativa reenviada bajo el nombre legacy", () => {
    const operativoToken = uuid()
    const res = proxy(
      req("/api/push/subscribe?actorFamily=cuenta_operativa", { [CUENTA_OPERATIVA_COOKIE]: operativoToken }, { method: "POST" })
    )
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${operativoToken}`)
  })

  test("B: /api/push/subscribe?actorFamily=cuenta_operativa SIN deligo_operativo_session -> 401 (el soft-check sigue exigiendo la cookie real, esto no es un bypass)", () => {
    const res = proxy(req("/api/push/subscribe?actorFamily=cuenta_operativa", {}, { method: "POST" }))
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(res.status).toBe(401)
  })

  test("C: /api/push/unsubscribe?actorFamily=cuenta_operativa CON deligo_operativo_session -> nunca 401", () => {
    const operativoToken = uuid()
    const res = proxy(
      req("/api/push/unsubscribe?actorFamily=cuenta_operativa", { [CUENTA_OPERATIVA_COOKIE]: operativoToken }, { method: "POST" })
    )
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${operativoToken}`)
  })

  test("D: /api/push/unsubscribe?actorFamily=cuenta_operativa SIN cookie -> 401", () => {
    const res = proxy(req("/api/push/unsubscribe?actorFamily=cuenta_operativa", {}, { method: "POST" }))
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(res.status).toBe(401)
  })

  test("E/F/G: cliente, negocio y repartidor siguen funcionando sin cambios (regresión de las 3 familias preexistentes)", () => {
    const clienteToken = uuid()
    const resCliente = proxy(req("/api/push/subscribe?actorFamily=cliente", { [CLIENTE_COOKIE]: clienteToken }, { method: "POST" }))
    expect(resCliente.status).not.toBe(401)
    expect(forwardedCookie(resCliente)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)

    const negocioToken = uuid()
    const resNegocio = proxy(req("/api/push/subscribe?actorFamily=negocio", { [NEGOCIO_COOKIE]: negocioToken }, { method: "POST" }))
    expect(resNegocio.status).not.toBe(401)
    expect(forwardedCookie(resNegocio)).toContain(`${LEGACY_COOKIE}=${negocioToken}`)

    const repartidorToken = uuid()
    const resRepartidor = proxy(
      req("/api/push/subscribe?actorFamily=repartidor", { [REPARTIDOR_COOKIE]: repartidorToken }, { method: "POST" })
    )
    expect(resRepartidor.status).not.toBe(401)
    expect(forwardedCookie(resRepartidor)).toContain(`${LEGACY_COOKIE}=${repartidorToken}`)
  })

  test("H: actorFamily desconocida/malformada (incluso pareciendo la real) no obtiene acceso accidental cuando hay ambigüedad real entre 2 cookies", () => {
    const negocioToken = uuid()
    const operativoToken = uuid()
    const res = proxy(
      req(
        "/api/push/subscribe?actorFamily=cuenta-operativa",
        { [NEGOCIO_COOKIE]: negocioToken, [CUENTA_OPERATIVA_COOKIE]: operativoToken },
        { method: "POST" }
      )
    )
    // "cuenta-operativa" (guión) !== "cuenta_operativa" (guión bajo, el
    // valor real) — un selector case/formato-sensible que casi coincide
    // nunca debe resolver ninguna familia. Con DOS cookies candidatas
    // presentes (Negocio + CuentaOperativa) y ninguna familia resuelta por
    // el selector, cae en el mismo fail-closed de siempre (CASE 9) — nunca
    // elige arbitrariamente cuál de las dos confiar.
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(res.status).toBe(401)
  })

  test("I: cookie de OTRA familia no satisface una request ?actorFamily=cuenta_operativa (nunca cruza de familia)", () => {
    const negocioToken = uuid()
    const res = proxy(
      req("/api/push/subscribe?actorFamily=cuenta_operativa", { [NEGOCIO_COOKIE]: negocioToken }, { method: "POST" })
    )
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(res.status).toBe(401)
  })

  test("Contrato explícito: si /api/push/subscribe|unsubscribe soportan actorFamily=cuenta_operativa, el middleware DEBE reconocer esa familia y su cookie real — nunca una aserción de substring aislada", () => {
    // Prueba el comportamiento real end-to-end contra el propio contrato
    // (no una constante interna): un selector legítimo con su cookie real
    // presente atraviesa AMBAS rutas protegidas por AUTH_REQUIRED_PREFIXES
    // sin 401, exactamente como cliente/negocio/repartidor ya lo hacían.
    const token = uuid()
    for (const path of ["/api/push/subscribe", "/api/push/unsubscribe"]) {
      const res = proxy(req(`${path}?actorFamily=cuenta_operativa`, { [CUENTA_OPERATIVA_COOKIE]: token }, { method: "POST" }))
      expect(res.status).not.toBe(401)
    }
  })
})

// ============================================
// P2-T39-R3B — Root cause de un 401 físico real:
// POST /api/push/subscribe?actorFamily=superadmin devolvía 401
// ("Se requiere autenticación") con deligo_superadmin_session presente y
// válida (GET /api/superadmin/dashboard, misma sesión física, sí devolvía
// 200). Causa raíz: "superadmin" NUNCA es un SessionFamily válido (a
// propósito — mezclarla con el selector multi-family compartido de
// cliente/negocio/repartidor/cuenta_operativa rompería la rama de
// ROLE_PROTECTED_ROUTES de /api/superadmin/*, que hoy funciona leyendo esa
// cookie directamente, sin pasar por resolveActorSession). Por eso
// resolveActorSession() nunca podía resolver family="superadmin" ni
// encontrar su cookie entre los candidatos legacy/family conocidos, y
// checkRouteProtection §4 (AUTH_REQUIRED_PREFIXES) bloqueaba con 401 ANTES
// de que el request llegara a requireSuperadminSession (route handler
// real, que sí sabe autenticar esta cookie). Mismo patrón de bug exacto
// que P2-T44-R1G ya documentó para cuenta_operativa — pero el fix acá es
// deliberadamente DISTINTO: nunca se agregó "superadmin" a SessionFamily
// (evita el riesgo de romper ROLE_PROTECTED_ROUTES); en cambio, §4 gana un
// chequeo aislado, sólo de presencia/formato de deligo_superadmin_session,
// activado únicamente cuando el selector explícito es "superadmin".
// ============================================
describe("P2-T39-R3B — superadmin: el middleware ya no bloquea con 401 antes de requireSuperadminSession", () => {
  test("A: /api/push/subscribe?actorFamily=superadmin CON deligo_superadmin_session (formato real) -> nunca 401", () => {
    const res = proxy(
      req("/api/push/subscribe?actorFamily=superadmin", { [SUPERADMIN_COOKIE]: superadminToken() }, { method: "POST" })
    )
    expect(res.status).not.toBe(401)
  })

  test("B: /api/push/subscribe?actorFamily=superadmin SIN deligo_superadmin_session -> 401 (el soft-check sigue exigiendo la cookie real, esto no es un bypass)", () => {
    const res = proxy(req("/api/push/subscribe?actorFamily=superadmin", {}, { method: "POST" }))
    expect(res.status).toBe(401)
  })

  test("C: /api/push/unsubscribe?actorFamily=superadmin CON cookie real -> nunca 401", () => {
    const res = proxy(
      req("/api/push/unsubscribe?actorFamily=superadmin", { [SUPERADMIN_COOKIE]: superadminToken() }, { method: "POST" })
    )
    expect(res.status).not.toBe(401)
  })

  test("D: /api/push/unsubscribe?actorFamily=superadmin SIN cookie -> 401", () => {
    const res = proxy(req("/api/push/unsubscribe?actorFamily=superadmin", {}, { method: "POST" }))
    expect(res.status).toBe(401)
  })

  test("E: cookie con formato inválido (UUID en vez de hex-64, o string corta) -> 401 — el chequeo es de FORMATO real, no sólo presencia", () => {
    const resUuidShaped = proxy(
      req("/api/push/subscribe?actorFamily=superadmin", { [SUPERADMIN_COOKIE]: uuid() }, { method: "POST" })
    )
    expect(resUuidShaped.status).toBe(401)

    const resTooShort = proxy(
      req("/api/push/subscribe?actorFamily=superadmin", { [SUPERADMIN_COOKIE]: "abc123" }, { method: "POST" })
    )
    expect(resTooShort.status).toBe(401)
  })

  test("F: sin ninguna cookie SuperAdmin real, y con AMBIGÜEDAD entre 2+ cookies de otra family, sigue fail-closed (401) — el chequeo nuevo de este fix nunca se activa con una cookie de forma/nombre distinto", () => {
    // Nota de layering: §4 (AUTH_REQUIRED_PREFIXES) es, por diseño
    // preexistente, un gate de "¿hay ALGÚN actor real autenticado?", no de
    // "¿coincide con el selector pedido?" (el propio comentario de
    // resolveActorSession documenta que el selector NUNCA es autoridad).
    // Con exactamente UNA cookie de otra family presente y sin ambigüedad,
    // ese fallback preexistente (candidates.length===1) ya dejaba pasar el
    // request ANTES de este fix — sin relación con SuperAdmin, y sin que
    // el aislamiento real se vea comprometido: requireSuperadminSession
    // downstream jamás lee otra cosa que deligo_superadmin_session (ver
    // superadmin-actor-family-contract.test.ts, test D). Este test verifica
    // el caso donde ese fallback preexistente NO aplica (2 cookies
    // candidatas, ambiguo) y confirma que el chequeo NUEVO de este fix
    // tampoco lo rescata — ninguna cookie que no sea deligo_superadmin_session
    // con formato hex-64 puede satisfacerlo.
    const res = proxy(
      req(
        "/api/push/subscribe?actorFamily=superadmin",
        { [NEGOCIO_COOKIE]: uuid(), [CUENTA_OPERATIVA_COOKIE]: uuid() },
        { method: "POST" }
      )
    )
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(res.status).toBe(401)
  })

  test("G: selector case/formato-sensible — 'Superadmin'/'super_admin' con la cookie real presente sigue siendo 401 (nunca un match aproximado)", () => {
    const token = superadminToken()
    for (const selector of ["Superadmin", "SUPERADMIN", "super_admin", "superadmin "]) {
      const res = proxy(
        req(`/api/push/subscribe?actorFamily=${encodeURIComponent(selector)}`, { [SUPERADMIN_COOKIE]: token }, { method: "POST" })
      )
      expect(res.status).toBe(401)
    }
  })

  test("H: cliente/negocio/repartidor/cuenta_operativa siguen funcionando sin cambios (regresión — este fix no tocó SessionFamily)", () => {
    const clienteToken = uuid()
    const resCliente = proxy(req("/api/push/subscribe?actorFamily=cliente", { [CLIENTE_COOKIE]: clienteToken }, { method: "POST" }))
    expect(resCliente.status).not.toBe(401)
    expect(forwardedCookie(resCliente)).toContain(`${LEGACY_COOKIE}=${clienteToken}`)

    const operativoToken = uuid()
    const resOperativo = proxy(
      req("/api/push/subscribe?actorFamily=cuenta_operativa", { [CUENTA_OPERATIVA_COOKIE]: operativoToken }, { method: "POST" })
    )
    expect(resOperativo.status).not.toBe(401)
    expect(forwardedCookie(resOperativo)).toContain(`${LEGACY_COOKIE}=${operativoToken}`)
  })

  test("I: la cookie SuperAdmin NUNCA se reenvía bajo el nombre legacy deligo_session (a diferencia de cuenta_operativa) — requireSuperadminSession sigue leyendo la cookie original directamente", () => {
    const token = superadminToken()
    const res = proxy(
      req("/api/push/subscribe?actorFamily=superadmin", { [SUPERADMIN_COOKIE]: token }, { method: "POST" })
    )
    expect(res.status).not.toBe(401)
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(forwardedCookie(res)).toContain(`${SUPERADMIN_COOKIE}=${token}`)
  })

  test("J: /api/push/status?actorFamily=superadmin (fuera de AUTH_REQUIRED_PREFIXES) nunca estuvo bloqueado — confirmado sin cambio", () => {
    const res = proxy(
      req("/api/push/status?actorFamily=superadmin", { [SUPERADMIN_COOKIE]: superadminToken() }, { method: "POST" })
    )
    expect(res.status).not.toBe(401)
  })
})

describe("AUTH02 — fail-closed preservado: selector ausente/malformado/desconocido bajo 2+ cookies", () => {
  test("/api/chat/no-leidos sin selector, ambas cookies presentes -> ambiguo, sin reenvío, 401 (sin cambio de comportamiento)", () => {
    const res = proxy(req("/api/chat/no-leidos", { [CLIENTE_COOKIE]: uuid(), [NEGOCIO_COOKIE]: uuid() }))
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(res.status).toBe(401)
  })

  test("/api/push/subscribe?actorFamily=hacker con ambas cookies -> selector desconocido, fail closed, 401", () => {
    const res = proxy(
      req("/api/push/subscribe?actorFamily=hacker", { [CLIENTE_COOKIE]: uuid(), [NEGOCIO_COOKIE]: uuid() }, { method: "POST" })
    )
    expect(hasResolvedSessionCookie(res)).toBe(false)
    expect(res.status).toBe(401)
  })

  test("/api/push/unsubscribe?actorFamily=cliente pero SIN cookie Cliente (sólo Negocio) -> no puede cruzar de familia, sin reenvío", () => {
    const res = proxy(
      req("/api/push/unsubscribe?actorFamily=cliente", { [NEGOCIO_COOKIE]: uuid() }, { method: "POST" })
    )
    expect(hasResolvedSessionCookie(res)).toBe(false)
  })
})

describe("AUTH02 — compatibilidad single-family preservada (regresión)", () => {
  test("/api/chat/no-leidos sin selector, UNA sola cookie de familia presente -> no ambiguo, se reenvía igual que antes de este fix", () => {
    const token = uuid()
    const res = proxy(req("/api/chat/no-leidos", { [CLIENTE_COOKIE]: token }))
    expect(res.status).not.toBe(401)
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
  })

  test("/api/push/status sin selector, UNA sola cookie de familia presente -> no ambiguo, se reenvía igual que antes de este fix", () => {
    const token = uuid()
    const res = proxy(req("/api/push/status", { [NEGOCIO_COOKIE]: token }, { method: "POST" }))
    expect(forwardedCookie(res)).toContain(`${LEGACY_COOKIE}=${token}`)
  })
})

describe("AUTH02 — /api/chat/cleanup permanece público, ajeno a este mecanismo", () => {
  test("/api/chat/cleanup nunca exige selector ni cookie de sesión (ruta pública, PUBLIC_API_PREFIXES)", () => {
    const res = proxy(req("/api/chat/cleanup", {}))
    // Público -> nunca 401 por ausencia de sesión; su propio auth (secreto
    // cron) es responsabilidad exclusiva del route handler, sin cambio.
    expect(res.status).not.toBe(401)
  })
})
