// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — cookie jars locales por actor
// ============================================
// CRÍTICO (Fase A §27-28 / Fase B §13, corregido en esta revisión focal):
// Cliente, Negocio y Repartidor comparten el mismo nombre de cookie
// `deligo_session`. Un flujo que actúa como más de un rol dentro de la
// misma iteración (checkout de Cliente + transición de Negocio) necesita
// DOS sesiones de "navegador" simuladas completamente independientes.
//
// CORRECCIÓN respecto de la revisión anterior de este archivo: ese diseño
// usaba `http.cookieJar()` (el único jar default por VU) + `jar.clear(url)`
// para "cambiar de actor", basado en la conclusión (incorrecta) de que
// `new http.CookieJar()` no estaba documentado oficialmente. Se releyó la
// guía oficial vigente `grafana.com/docs/k6/latest/using-k6/cookies/`, que
// tiene una sección explícita "Local cookie jars" con exactamente:
//   const jar = new http.CookieJar()
//   jar.set(url, name, value, options)
//   http.get(url, { jar })
// — confirmando que SÍ es una API oficial y soportada. `jar.clear(url)`
// además tiene un problema real más allá de "no documentado": borra TODAS
// las cookies de esa URL en el jar, incluida cualquier cookie que el propio
// actor haya recibido del servidor (p.ej. `deligo_device`, seteada por
// checkout cuando la identidad de dispositivo es nueva) — perdiéndola al
// cambiar de actor y de vuelta. Un jar LOCAL e independiente por actor no
// tiene ese problema: nunca se toca, nunca se limpia, conserva cualquier
// cookie que el servidor le haya seteado durante toda la iteración.

import http from "k6/http"
import { TARGET_URL } from "../../config/environments.js"

export const SESSION_COOKIE_NAME = "deligo_session"

/** Crea un CookieJar LOCAL e independiente para un actor, con su session token ya seteado. Nunca se comparte entre actores. */
export function createActorJar(identity) {
  const jar = new http.CookieJar()
  jar.set(TARGET_URL, SESSION_COOKIE_NAME, identity.sessionToken)
  return jar
}

/**
 * true/false ÚNICAMENTE — nunca expone el valor de la cookie. Usado para
 * validar que una cookie recibida por el servidor (p.ej. deligo_device)
 * sigue presente en el jar del actor después de que OTRO actor (con su
 * propio jar independiente) hizo requests intermedias.
 */
export function jarHasCookie(jar, cookieName) {
  const cookies = jar.cookiesForURL(TARGET_URL)
  return Boolean(cookies && cookies[cookieName] && cookies[cookieName].length > 0)
}

/** Headers estándar para mutaciones protegidas por Origin (ver src/proxy.ts ORIGIN_PROTECTED_PREFIXES). */
export function mutationHeaders(extra) {
  return Object.assign(
    {
      "Content-Type": "application/json",
      Origin: TARGET_URL,
    },
    extra || {}
  )
}
