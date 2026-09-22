/**
 * Ruta a conservar tras un login normal de Repartidor.
 *
 * El panel de Repartidor es una PWA cuyo manifest usa el namespace
 * `/repartidor/` (`start_url`/`scope` = `/repartidor`, ver
 * public/manifest-repartidor.json). Mantener este destino explícito evita
 * que el flujo de autenticación cruce por `/` (que redirige incondicionalmente
 * a Cliente, ver src/app/page.tsx) y abandone la ventana standalone —
 * mismo defecto y misma solución ya aplicada a Negocio
 * (src/lib/negocio-post-login-navigation.ts, "fix: keep business login
 * inside pwa scope") — P2-T02-B1 cierra el mismo hueco para Repartidor,
 * nunca detectado hasta una certificación física real en Android (login
 * por password, dentro de la PWA instalada, terminaba en DeliGO Cliente).
 */
export const REPARTIDOR_POST_LOGIN_PATH = "/repartidor/"

/**
 * Comprueba el namespace PWA de Repartidor, aceptando la forma canónica que
 * Next puede exponer sin slash final.
 */
export function esRutaPwaRepartidor(pathname: string): boolean {
  return pathname === "/repartidor" || pathname.startsWith(REPARTIDOR_POST_LOGIN_PATH)
}
