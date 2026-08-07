/** Namespace que pertenece a la PWA Cliente. */
export const CLIENTE_CATALOGO_BASE_PATH = "/cliente/n/"

/** Construye la entrada al catálogo desde una superficie interna de Cliente. */
export function getClienteCatalogoPath(slug: string): string {
  return `${CLIENTE_CATALOGO_BASE_PATH}${encodeURIComponent(slug)}`
}

/** Conserva la URL pública para QR, enlaces compartidos y navegación externa. */
export function getPublicCatalogoPath(slug: string): string {
  return `/n/${encodeURIComponent(slug)}`
}

/** Determina si el pathname pertenece al catálogo dentro del scope Cliente. */
export function esRutaCatalogoCliente(pathname: string | null | undefined): boolean {
  return pathname === "/cliente/n" || !!pathname?.startsWith(CLIENTE_CATALOGO_BASE_PATH)
}

/** Reconoce cualquiera de las dos entradas válidas al mismo catálogo. */
export function esRutaCatalogoNegocio(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname.startsWith("/n/") || esRutaCatalogoCliente(pathname))
}

/** Mantiene la entrada actual al limpiar parámetros transitorios del catálogo. */
export function getCatalogoPathActual(pathname: string | null | undefined, slug: string): string {
  return esRutaCatalogoCliente(pathname) ? getClienteCatalogoPath(slug) : getPublicCatalogoPath(slug)
}
