// P1-C: construye el destino interno con el que el Service Worker navega al tocar
// una notificación de pedido de mesa. Función pura (sin `self`/DOM/clients/db) para
// poder probarla con Bun sin infraestructura de Service Worker real.
//
// Solo produce rutas relativas del mismo origen (`basePath` es siempre un literal
// interno construido por el caller, nunca un valor externo) — nunca acepta ni
// construye una URL absoluta. La autorización real de qué puede verse sigue
// ocurriendo server-side, en el endpoint de detalle del pedido que el panel llama
// al consumir este deep-link — este helper no otorga ningún acceso por sí mismo.
export function buildPedidoDeepLinkUrl(basePath: string, pedidoId: string): string {
  return `${basePath}?pedidoId=${encodeURIComponent(pedidoId)}`
}
