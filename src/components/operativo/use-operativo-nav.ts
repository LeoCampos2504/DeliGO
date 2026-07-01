"use client"

import { usePathname } from "next/navigation"

// ============================================
// DeliGO Operaciones — Navegación del modo personal (Operaciones-1D)
// ============================================
// El panel personal moderno de Mozo se sirve bajo DOS árboles de ruta que
// comparten exactamente el mismo componente (reutilización, no duplicación):
//   - /mozo/**                     (compatibilidad temporal)
//   - /operaciones/mi-panel/**     (DeliGO Operaciones)
//
// La ÚNICA diferencia funcional entre ambos es la navegación (rutas de destino y
// qué hacer cuando no hay sesión). Este helper deriva esa configuración del
// `pathname` actual, de modo que el mismo componente se comporta correctamente en
// cualquiera de los dos árboles sin duplicar lógica ni fetch ni autorización.
//
// No toca identidad ni sesión: ambas variantes usan exclusivamente el contrato
// personal (/api/operativo/** + cookie deligo_operativo_session).

export interface OperativoNav {
  /** Home del panel personal (selección de negocio). */
  homeHref: string
  /** Destino de login personal. */
  loginHref: string
  /** Alta de cuenta personal (solo el árbol /mozo la ofrece). null = no mostrar. */
  registroHref: string | null
  /** Panel de un negocio por slug. */
  panelHref: (slug: string) => string
  /** Pedido manual de una mesa. */
  pedidoHref: (slug: string, mesaId: string) => string
  /**
   * Qué hacer cuando NO hay sesión personal válida:
   *   - "buttons": mostrar accesos de login/registro (comportamiento /mozo).
   *   - "redirect": redirigir a `loginHref` (comportamiento /operaciones/mi-panel).
   */
  noSessionMode: "buttons" | "redirect"
}

const MI_PANEL_BASE = "/operaciones/mi-panel"

const MI_PANEL_NAV: OperativoNav = {
  homeHref: MI_PANEL_BASE,
  loginHref: "/operaciones/ingresar",
  registroHref: null,
  panelHref: (slug) => `${MI_PANEL_BASE}/${encodeURIComponent(slug)}`,
  pedidoHref: (slug, mesaId) =>
    `${MI_PANEL_BASE}/${encodeURIComponent(slug)}/pedido/${encodeURIComponent(mesaId)}`,
  noSessionMode: "redirect",
}

const MOZO_NAV: OperativoNav = {
  homeHref: "/mozo",
  loginHref: "/mozo/iniciar-sesion",
  registroHref: "/mozo/registro",
  panelHref: (slug) => `/mozo/panel/${encodeURIComponent(slug)}`,
  pedidoHref: (slug, mesaId) =>
    `/mozo/panel/${encodeURIComponent(slug)}/pedido/${encodeURIComponent(mesaId)}`,
  noSessionMode: "buttons",
}

/** Resuelve la configuración de navegación según el árbol de ruta actual. */
export function resolveOperativoNav(pathname: string | null | undefined): OperativoNav {
  return pathname && pathname.startsWith(MI_PANEL_BASE) ? MI_PANEL_NAV : MOZO_NAV
}

/** Hook: configuración de navegación del panel personal según el pathname. */
export function useOperativoNav(): OperativoNav {
  return resolveOperativoNav(usePathname())
}
