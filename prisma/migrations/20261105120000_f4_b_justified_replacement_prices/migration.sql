-- F4-B (2026-11-05) — justified prices for replacement products.
-- Operator decisions (2026-11-04): a correction may no longer silently give a
-- replacement product the unit price of another product. A corrected line keeps
-- the unit price actually charged on its sale line (unchanged rule) and the
-- product it names must be justified at that price:
--   MISMO_PRODUCTO         — the same product/variant of that original sale line;
--   MISMA_VENTA            — a product/variant of ANOTHER original line of the
--                            same sale charged at exactly that unit price;
--   PRECIO_CATALOGO_ACTUAL — a product/variant of the business, enabled for Caja
--                            (product not deleted, variant active), whose CURRENT
--                            catalog price equals the charged price exactly. The
--                            catalog price consulted and the moment of the check
--                            are stored. This records a coincidence at the time
--                            of the correction; it does NOT prove the price the
--                            product had when the sale was made.
-- An unchanged line keeps the catalog evidence of the previous correction
-- (carried forward), so a later catalog price change never blocks re-correcting
-- other lines. Anything else is refused.
-- Additive: three nullable columns (existing rows keep NULL = corrections made
-- under the earlier inherited-price rule, preserved as immutable history), one
-- CHECK and CREATE OR REPLACE of the line guard. No existing row is modified and
-- no applied migration is edited.

ALTER TABLE "correcciones_venta_lineas" ADD COLUMN "criterioPrecio" TEXT;
ALTER TABLE "correcciones_venta_lineas" ADD COLUMN "precioCatalogoConsultado" DOUBLE PRECISION;
ALTER TABLE "correcciones_venta_lineas" ADD COLUMN "precioCatalogoConsultadoEn" TIMESTAMP(3);

ALTER TABLE "correcciones_venta_lineas"
  ADD CONSTRAINT "correcciones_venta_lineas_criterio_precio_check"
  CHECK (
    ("criterioPrecio" IS NULL OR "criterioPrecio" IN ('MISMO_PRODUCTO', 'MISMA_VENTA', 'PRECIO_CATALOGO_ACTUAL'))
    AND (
      ("criterioPrecio" = 'PRECIO_CATALOGO_ACTUAL'
        AND "precioCatalogoConsultado" IS NOT NULL
        AND "precioCatalogoConsultadoEn" IS NOT NULL
        AND "precioCatalogoConsultado" = "precio")
      OR ("criterioPrecio" IS DISTINCT FROM 'PRECIO_CATALOGO_ACTUAL'
        AND "precioCatalogoConsultado" IS NULL
        AND "precioCatalogoConsultadoEn" IS NULL)
    )
  );

CREATE OR REPLACE FUNCTION "guard_correccion_venta_linea"() RETURNS trigger AS $$
DECLARE
  cab RECORD;
  item RECORD;
  previa RECORD;
  precio_actual DOUBLE PRECISION;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'sale correction line is immutable';
  END IF;

  SELECT "negocioId", "ventaId", "secuencia" INTO cab FROM "correcciones_venta" WHERE "id" = NEW."correccionId";
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
    NEW."precioCatalogoConsultado" := NULL;
    NEW."precioCatalogoConsultadoEn" := NULL;
    RETURN NEW;
  END IF;

  PERFORM 1 FROM "venta_items" AS v
   WHERE v."ventaId" = NEW."ventaId"
     AND v."productoId" IS NOT DISTINCT FROM NEW."productoId"
     AND v."productoVarianteId" IS NOT DISTINCT FROM NEW."productoVarianteId"
     AND v."precio" = NEW."precio";
  IF FOUND THEN
    NEW."criterioPrecio" := 'MISMA_VENTA';
    NEW."precioCatalogoConsultado" := NULL;
    NEW."precioCatalogoConsultadoEn" := NULL;
    RETURN NEW;
  END IF;

  -- Same product already justified by the catalog in the previous correction:
  -- keep that evidence (never re-dated, never re-checked against a newer price).
  SELECT l."precioCatalogoConsultado", l."precioCatalogoConsultadoEn" INTO previa
    FROM "correcciones_venta_lineas" AS l
    JOIN "correcciones_venta" AS c ON c."id" = l."correccionId"
   WHERE c."ventaId" = NEW."ventaId"
     AND c."secuencia" = cab."secuencia" - 1
     AND l."ventaItemId" = NEW."ventaItemId"
     AND l."productoId" IS NOT DISTINCT FROM NEW."productoId"
     AND l."productoVarianteId" IS NOT DISTINCT FROM NEW."productoVarianteId"
     AND l."criterioPrecio" = 'PRECIO_CATALOGO_ACTUAL';
  IF FOUND THEN
    NEW."criterioPrecio" := 'PRECIO_CATALOGO_ACTUAL';
    NEW."precioCatalogoConsultado" := previa."precioCatalogoConsultado";
    NEW."precioCatalogoConsultadoEn" := previa."precioCatalogoConsultadoEn";
    RETURN NEW;
  END IF;

  -- Current catalog price of a product/variant enabled for Caja in this business.
  precio_actual := NULL;
  IF NEW."productoId" IS NOT NULL THEN
    IF NEW."productoVarianteId" IS NULL THEN
      SELECT p."precio" INTO precio_actual
        FROM "productos" AS p
       WHERE p."id" = NEW."productoId" AND p."negocioId" = NEW."negocioId" AND p."eliminado" = false
         AND NOT EXISTS (SELECT 1 FROM "producto_variantes" AS pv WHERE pv."productoId" = p."id" AND pv."activo" = true);
    ELSE
      SELECT pv."precio" INTO precio_actual
        FROM "producto_variantes" AS pv
        JOIN "productos" AS p ON p."id" = pv."productoId"
       WHERE pv."id" = NEW."productoVarianteId" AND pv."productoId" = NEW."productoId" AND pv."activo" = true
         AND p."negocioId" = NEW."negocioId" AND p."eliminado" = false;
    END IF;
  END IF;
  IF precio_actual IS NULL OR precio_actual <> NEW."precio" THEN
    RAISE EXCEPTION 'sale correction replacement price is not justified';
  END IF;
  NEW."criterioPrecio" := 'PRECIO_CATALOGO_ACTUAL';
  NEW."precioCatalogoConsultado" := precio_actual;
  NEW."precioCatalogoConsultadoEn" := COALESCE(NEW."precioCatalogoConsultadoEn", CURRENT_TIMESTAMP);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
