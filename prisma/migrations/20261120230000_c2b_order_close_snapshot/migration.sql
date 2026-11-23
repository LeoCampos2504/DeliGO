-- F10-C2b — cerrar un pedido CON pendientes: se guarda qué quedó sin recibir. Operador 2026-11-20, sólo local.
-- ADITIVA: una columna opcional en eventos_compra_recepcion (que ya es append-only por su guarda de C2a).
-- En el evento CIERRE_COMPRA guarda, en JSON, el motivo elegido y por renglón: pedido, aceptado y pendiente al
-- cerrar. No toca stock, costos, pagos ni deuda; los eventos y recepciones anteriores quedan intactos.

ALTER TABLE "eventos_compra_recepcion" ADD COLUMN "detalle" TEXT;
ALTER TABLE "eventos_compra_recepcion" ADD CONSTRAINT "eventos_compra_recepcion_detalle_check" CHECK ("detalle" IS NULL OR "tipo" = 'CIERRE_COMPRA');
