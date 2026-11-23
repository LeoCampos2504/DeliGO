-- F10-C2c — las guardas "nunca se borra" de los historiales de precio permiten también la cascada del PRODUCTO
-- (hasta ahora sólo la del negocio): borrar un producto del catálogo no debe quedar bloqueado por su historial.
-- Operador 2026-11-20, sólo desarrollo local. ADITIVA: reemplaza sólo el cuerpo de tres funciones de guarda.

CREATE OR REPLACE FUNCTION "guard_cambio_precio_venta"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND THEN
      PERFORM 1 FROM "productos" WHERE "id" = OLD."productoId";
      IF FOUND THEN RAISE EXCEPTION 'sale price history is never deleted'; END IF;
    END IF;
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

CREATE OR REPLACE FUNCTION "guard_etiqueta_precio"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."estado" NOT IN ('PENDIENTE', 'ACTIVADA') OR (NEW."estado" = 'ACTIVADA' AND NEW."resolucion" IS DISTINCT FROM 'SIN_ETIQUETA') THEN
      RAISE EXCEPTION 'a price label is born pending (or activated without label at approval)';
    END IF;
    PERFORM 1 FROM "cambios_precio_venta" WHERE "id" = NEW."cambioPrecioVentaId" AND "negocioId" = NEW."negocioId" AND "productoId" = NEW."productoId" AND "productoVarianteId" IS NOT DISTINCT FROM NEW."productoVarianteId" AND "precioNuevoDecimal" = NEW."precioNuevoDecimal";
    IF NOT FOUND THEN RAISE EXCEPTION 'price label must match the owner authorization'; END IF;
    IF NEW."reemplazaAId" IS NOT NULL THEN
      PERFORM 1 FROM "etiquetas_precio" WHERE "id" = NEW."reemplazaAId" AND "negocioId" = NEW."negocioId" AND "productoId" = NEW."productoId" AND "productoVarianteId" IS NOT DISTINCT FROM NEW."productoVarianteId" AND "estado" = 'REEMPLAZADA';
      IF NOT FOUND THEN RAISE EXCEPTION 'replaced price label must be the same product, already replaced'; END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND THEN
      PERFORM 1 FROM "productos" WHERE "id" = OLD."productoId";
      IF FOUND THEN RAISE EXCEPTION 'price labels are never deleted'; END IF;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."estado" <> 'PENDIENTE' OR NEW."estado" = 'PENDIENTE' THEN RAISE EXCEPTION 'a resolved price label is immutable'; END IF;
  IF NEW."id" <> OLD."id" OR NEW."negocioId" <> OLD."negocioId" OR NEW."productoId" <> OLD."productoId"
     OR NEW."productoVarianteId" IS DISTINCT FROM OLD."productoVarianteId" OR NEW."cambioPrecioVentaId" <> OLD."cambioPrecioVentaId"
     OR NEW."precioAnteriorDecimal" <> OLD."precioAnteriorDecimal" OR NEW."precioNuevoDecimal" <> OLD."precioNuevoDecimal"
     OR NEW."modo" <> OLD."modo" OR NEW."reemplazaAId" IS DISTINCT FROM OLD."reemplazaAId"
     OR NEW."autorizadaPorTipo" <> OLD."autorizadaPorTipo" OR NEW."autorizadaPorId" <> OLD."autorizadaPorId" OR NEW."autorizadaEn" <> OLD."autorizadaEn" THEN
    RAISE EXCEPTION 'the authorized price of a label never changes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "guard_activacion_precio_venta"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND THEN
      PERFORM 1 FROM "productos" WHERE "id" = OLD."productoId";
      IF FOUND THEN RAISE EXCEPTION 'price activations are never deleted'; END IF;
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'price activations are append-only'; END IF;
  PERFORM 1 FROM "productos" WHERE "id" = NEW."productoId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN RAISE EXCEPTION 'price activation must be for a product of the business'; END IF;
  IF NEW."productoVarianteId" IS NOT NULL THEN
    PERFORM 1 FROM "producto_variantes" WHERE "id" = NEW."productoVarianteId" AND "productoId" = NEW."productoId";
    IF NOT FOUND THEN RAISE EXCEPTION 'price activation variant must belong to the product'; END IF;
  END IF;
  IF NEW."etiquetaPrecioId" IS NOT NULL THEN
    PERFORM 1 FROM "etiquetas_precio" WHERE "id" = NEW."etiquetaPrecioId" AND "negocioId" = NEW."negocioId" AND "productoId" = NEW."productoId"
      AND "productoVarianteId" IS NOT DISTINCT FROM NEW."productoVarianteId" AND "estado" = 'ACTIVADA' AND "precioNuevoDecimal" = NEW."precioNuevoDecimal";
    IF NOT FOUND THEN RAISE EXCEPTION 'price activation must match an activated label'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
