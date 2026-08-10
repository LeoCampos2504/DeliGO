// ============================================
// DeliGO — Al menos un canal de pedido (T20-DK1)
// ============================================
// Un Negocio necesita al menos una forma de recibir pedidos: Salón/Mesa,
// Delivery o Retiro. Las tres capacidades son independientes entre sí
// (Negocio.salonActivo, Negocio.ofreceDelivery, Negocio.ofreceRetiro) — esta
// función es la única fuente de verdad de la política "no dejar un negocio
// sin ningún canal habilitado", reutilizada tanto por la validación
// server-side de /api/negocio/config como por sus tests.

export interface NegocioCanalesPedido {
  salonActivo: boolean
  ofreceDelivery: boolean
  ofreceRetiro: boolean
}

export function tieneAlMenosUnCanalDePedido(negocio: NegocioCanalesPedido): boolean {
  return negocio.salonActivo || negocio.ofreceDelivery || negocio.ofreceRetiro
}

export const SIN_CANALES_PEDIDO_ERROR =
  "Dejá habilitado al menos un canal para recibir pedidos: Salón, Delivery o Retiro."
