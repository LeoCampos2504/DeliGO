-- Catálogo — un cambio de precio hecho desde el catálogo por un EMPLEADO con permiso de precios queda en el historial
-- de activaciones a su nombre (antes sólo el dueño editaba precios). ADITIVA: sólo amplía el CHECK; no modifica filas.
ALTER TABLE "activaciones_precio_venta" DROP CONSTRAINT "activaciones_precio_venta_origen_check";
ALTER TABLE "activaciones_precio_venta" ADD CONSTRAINT "activaciones_precio_venta_origen_check" CHECK (
  ("origen" = 'CATALOGO' AND "etiquetaPrecioId" IS NULL AND "actorTipo" IN ('NEGOCIO', 'EMPLEADO'))
  OR ("origen" = 'ETIQUETA' AND "etiquetaPrecioId" IS NOT NULL AND "actorTipo" IN ('NEGOCIO', 'EMPLEADO'))
  OR ("origen" IN ('DUENO_SIN_ETIQUETA', 'APROBACION_SIN_ETIQUETA') AND "etiquetaPrecioId" IS NOT NULL AND "actorTipo" = 'NEGOCIO')
);
