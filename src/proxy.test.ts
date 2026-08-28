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
const LEGACY_COOKIE = "deligo_session"

function uuid(): string {
  return crypto.randomUUID()
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
})
