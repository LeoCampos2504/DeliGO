-- F10-C2b — actualización OPCIONAL de precios de venta al aprobar una recepción (conserva el recargo sobre costo).
-- Operador 2026-11-20, sólo desarrollo local. ADITIVA: una tabla de historial (append-only) y su guarda; no modifica
-- filas ni tablas existentes. Cada fila = un precio de venta cambiado por la aprobación de UNA recepción, con el
-- precio y el costo anteriores y nuevos, el recargo conservado, quién lo autorizó y cuándo.

CREATE TABLE "cambios_precio_venta" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoVarianteId" TEXT,
    "recepcionId" TEXT NOT NULL,
    "recepcionLineaId" TEXT NOT NULL,
    "precioAnteriorDecimal" DECIMAL(12,2) NOT NULL,
    "precioNuevoDecimal" DECIMAL(12,2) NOT NULL,
    "costoAnteriorDecimal" DECIMAL(14,4) NOT NULL,
    "costoNuevoDecimal" DECIMAL(14,4) NOT NULL,
    "recargoPctDecimal" DECIMAL(12,4) NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'APROBACION_RECEPCION',
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambios_precio_venta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cambios_precio_venta_importes_check" CHECK ("precioAnteriorDecimal" > 0 AND "precioNuevoDecimal" > 0 AND "costoAnteriorDecimal" > 0 AND "costoNuevoDecimal" > 0 AND "recargoPctDecimal" >= 0),
    CONSTRAINT "cambios_precio_venta_origen_check" CHECK ("origen" = 'APROBACION_RECEPCION'),
    CONSTRAINT "cambios_precio_venta_actor_check" CHECK ("actorTipo" = 'NEGOCIO')
);

-- Un solo cambio por producto/variante y recepción (nunca duplicado).
CREATE UNIQUE INDEX "cambios_precio_venta_producto_unico" ON "cambios_precio_venta" ("recepcionId", "productoId") WHERE "productoVarianteId" IS NULL;
CREATE UNIQUE INDEX "cambios_precio_venta_variante_unica" ON "cambios_precio_venta" ("recepcionId", "productoVarianteId") WHERE "productoVarianteId" IS NOT NULL;
CREATE INDEX "cambios_precio_venta_negocioId_productoId_idx" ON "cambios_precio_venta" ("negocioId", "productoId");

ALTER TABLE "cambios_precio_venta" ADD CONSTRAINT "cambios_precio_venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cambios_precio_venta" ADD CONSTRAINT "cambios_precio_venta_recepcionId_negocioId_fkey" FOREIGN KEY ("recepcionId", "negocioId") REFERENCES "recepciones"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cambios_precio_venta" ADD CONSTRAINT "cambios_precio_venta_recepcionLineaId_fkey" FOREIGN KEY ("recepcionLineaId") REFERENCES "recepcion_lineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cambios_precio_venta" ADD CONSTRAINT "cambios_precio_venta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cambios_precio_venta" ADD CONSTRAINT "cambios_precio_venta_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Historial: sólo para recepciones APROBADAS del mismo negocio; nunca se modifica ni se borra (salvo cascada del negocio).
CREATE OR REPLACE FUNCTION "guard_cambio_precio_venta"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND THEN RAISE EXCEPTION 'sale price history is never deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'sale price history is append-only'; END IF;
  PERFORM 1 FROM "recepciones" WHERE "id" = NEW."recepcionId" AND "negocioId" = NEW."negocioId" AND "estado" = 'APROBADA';
  IF NOT FOUND THEN RAISE EXCEPTION 'sale price change requires an approved reception'; END IF;
  PERFORM 1 FROM "productos" WHERE "id" = NEW."productoId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN RAISE EXCEPTION 'sale price change must be for a product of the business'; END IF;
  IF NEW."productoVarianteId" IS NOT NULL THEN
    PERFORM 1 FROM "producto_variantes" WHERE "id" = NEW."productoVarianteId" AND "productoId" = NEW."productoId";
    IF NOT FOUND THEN RAISE EXCEPTION 'sale price change variant must belong to the product'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cambios_precio_venta_guard_trigger" BEFORE INSERT OR UPDATE OR DELETE ON "cambios_precio_venta" FOR EACH ROW EXECUTE FUNCTION "guard_cambio_precio_venta"();
