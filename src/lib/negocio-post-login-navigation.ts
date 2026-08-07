/**
 * Ruta a conservar tras un login normal de Negocio.
 *
 * El panel de Negocio es una PWA cuyo manifest usa el namespace `/negocio/`.
 * Mantener este destino explícito evita que el flujo de autenticación cruce
 * por `/` (que redirige a Cliente) y abandone la ventana standalone.
 */
export const NEGOCIO_POST_LOGIN_PATH = "/negocio/"

/**
 * Comprueba el namespace PWA de Negocio, aceptando la forma canónica que
 * Next puede exponer sin slash final.
 */
export function esRutaPwaNegocio(pathname: string): boolean {
  return pathname === "/negocio" || pathname.startsWith(NEGOCIO_POST_LOGIN_PATH)
}
