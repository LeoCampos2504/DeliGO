-- F4-B (2026-11-05) — justified prices for replacement products.
-- Operator decision: a correction may no longer silently give a replacement
-- product the unit price of another product. A corrected line keeps the unit
-- price actually charged on its sale line (unchanged rule) and may name:
--   MISMO_PRODUCTO — the same product/variant of that original sale line, or
--   MISMA_VENTA    — a product/variant that appears in ANOTHER original line
--                    of the same sale at exactly that charged unit price.
-- Anything else is refused (no reliable historical catalog price exists).
-- Additive: one nullable column (existing rows keep NULL = corrections made
-- under the earlier inherited-price rule, preserved as immutable history) and
-- CREATE OR REPLACE of the line guard. No existing row is modified.

ALTER TABLE "correcciones_venta_lineas" ADD COLUMN "criterioPrecio" TEXT;

ALTER TABLE "correcciones_venta_lineas"
  ADD CONSTRAINT "correcciones_venta_lineas_criterio_precio_check"
  CHECK ("criterioPrecio" IS NULL OR "criterioPrecio" IN ('MISMO_PRODUCTO', 'MISMA_VENTA'));

CREATE OR REPLACE FUNCTION "guard_correccion_venta_linea"() RETURNS trigger AS $$
DECLARE
  cab RECORD;
  item RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'sale correction line is immutable';
  END IF;

  SELECT "negocioId", "ventaId" INTO cab FROM "correcciones_venta" WHERE "id" = NEW."correccionId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale correction line must match its correction';
  END IF;
  IF cab."negocioId" <> NEW."negocioId" OR cab."ventaId" <> NEW."ventaId" THEN
    RAISE EXCEPTION 'sale correction line must match its correction';
  END IF;

  SELECT "precio", "productoId", "productoVarianteId" INTO item
    FROM "venta_items" WHERE "id" = NEW."ventaItemId" AND "ventaId" = NEW."ventaId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale correction line must reference a line of the same sale';
  END IF;
  IF item."precio" <> NEW."precio" THEN
    RAISE EXCEPTION 'sale correction must keep the charged unit price';
  END IF;

  -- The product named by the line must be justified at that charged price.
  IF NEW."productoId" IS NOT DISTINCT FROM item."productoId"
     AND NEW."productoVarianteId" IS NOT DISTINCT FROM item."productoVarianteId" THEN
    NEW."criterioPrecio" := 'MISMO_PRODUCTO';
  ELSE
    PERFORM 1 FROM "venta_items" AS v
     WHERE v."ventaId" = NEW."ventaId"
       AND v."productoId" IS NOT DISTINCT FROM NEW."productoId"
       AND v."productoVarianteId" IS NOT DISTINCT FROM NEW."productoVarianteId"
       AND v."precio" = NEW."precio";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale correction replacement price is not justified';
    END IF;
    NEW."criterioPrecio" := 'MISMA_VENTA';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
