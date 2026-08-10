// ============================================
// DeliGO — Visibilidad de negocios en discovery (T20-DK2)
// ============================================
// Política pura: ¿un negocio debe aparecer en las superficies públicas de
// descubrimiento (listado principal, promocionados, búsqueda, categorías)
// para la ubicación actual del Cliente?
//
// Sólo afecta negocios "Solo delivery" (ofreceDelivery=true, ofreceRetiro=
// false) — Delivery+retiro y Solo retiro siempre son visibles, sin importar
// la ubicación, porque siempre tienen al menos un canal utilizable. Esta
// función NUNCA decide sobre historial/pedido activo/acceso directo — sólo
// sobre discovery (ver T20-DK2, sección 2).
//
// Deny-by-uncertainty-safe: si la cobertura no se conoce de forma confiable
// (`coverageKnown=false` — el Cliente todavía no tiene una ubicación
// resuelta), el negocio se mantiene VISIBLE. Nunca se oculta un negocio por
// una suposición.

export interface BusinessDiscoveryVisibilityInput {
  ofreceDelivery: boolean
  ofreceRetiro: boolean
  coverageKnown: boolean
  deliveryAvailable: boolean
}

export function shouldShowBusinessInDiscovery(input: BusinessDiscoveryVisibilityInput): boolean {
  const esSoloDelivery = input.ofreceDelivery && !input.ofreceRetiro
  if (!esSoloDelivery) return true
  if (!input.coverageKnown) return true
  return input.deliveryAvailable
}
