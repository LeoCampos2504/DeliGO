-- F10-C2c — etiquetas de góndola y precios protegidos por inicio de venta.
-- Operador 2026-11-20, sólo desarrollo local. ADITIVA: tres tablas nuevas con sus guardas; no modifica filas ni
-- tablas existentes.
--   etiquetas_precio          precio autorizado por el dueño que espera el cambio físico de la etiqueta.
--   activaciones_precio_venta cada cambio efectivo del precio de venta (append-only).
--   inicios_venta             hora de inicio de una venta de Caja (fijada por el servidor, un solo uso, vence).

-- ============ etiquetas_precio ============
CREATE TABLE "etiquetas_precio" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoVarianteId" TEXT,
    "cambioPrecioVentaId" TEXT NOT NULL,
    "precioAnteriorDecimal" DECIMAL(12,2) NOT NULL,
    "precioNuevoDecimal" DECIMAL(12,2) NOT NULL,
    "modo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "reemplazaAId" TEXT,
    "autorizadaPorTipo" TEXT NOT NULL,
    "autorizadaPorId" TEXT NOT NULL,
    "autorizadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolucion" TEXT,
    "resueltaEn" TIMESTAMP(3),
    "resueltaPorTipo" TEXT,
    "resueltaPorId" TEXT,

    CONSTRAINT "etiquetas_precio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "etiquetas_precio_importes_check" CHECK ("precioAnteriorDecimal" > 0 AND "precioNuevoDecimal" > 0),
    CONSTRAINT "etiquetas_precio_modo_check" CHECK ("modo" IN ('ETIQUETA', 'SIN_ETIQUETA')),
    CONSTRAINT "etiquetas_precio_autoriza_check" CHECK ("autorizadaPorTipo" = 'NEGOCIO'),
    CONSTRAINT "etiquetas_precio_estado_check" CHECK (
      ("estado" = 'PENDIENTE' AND "resolucion" IS NULL AND "resueltaEn" IS NULL AND "resueltaPorTipo" IS NULL AND "resueltaPorId" IS NULL)
      OR ("estado" <> 'PENDIENTE' AND "resueltaEn" IS NOT NULL AND "resueltaPorTipo" IN ('NEGOCIO', 'EMPLEADO') AND "resueltaPorId" IS NOT NULL AND (
        ("estado" = 'ACTIVADA' AND ("resolucion" = 'ACTIVADA_POR_DUENO' OR ("resolucion" = 'ETIQUETA_CONFIRMADA' AND "modo" = 'ETIQUETA') OR ("resolucion" = 'SIN_ETIQUETA' AND "modo" = 'SIN_ETIQUETA')))
        OR ("estado" = 'REEMPLAZADA' AND "resolucion" IN ('REEMPLAZADA_POR_NUEVA', 'REEMPLAZADA_POR_CATALOGO'))
        OR ("estado" = 'DESCARTADA' AND "resolucion" = 'DESCARTADA')
      ))
    ),
    -- Sólo el dueño activa sin etiqueta, reemplaza o descarta; el empleado sólo confirma la etiqueta.
    CONSTRAINT "etiquetas_precio_resuelve_check" CHECK ("resueltaPorTipo" IS NULL OR "resueltaPorTipo" = 'NEGOCIO' OR "resolucion" = 'ETIQUETA_CONFIRMADA')
);

CREATE UNIQUE INDEX "etiquetas_precio_cambioPrecioVentaId_key" ON "etiquetas_precio"("cambioPrecioVentaId");
CREATE UNIQUE INDEX "etiquetas_precio_reemplazaAId_key" ON "etiquetas_precio"("reemplazaAId");
CREATE INDEX "etiquetas_precio_negocioId_estado_idx" ON "etiquetas_precio"("negocioId", "estado");
-- A lo sumo UNA etiqueta pendiente por producto (sin variante) o por variante.
CREATE UNIQUE INDEX "etiquetas_precio_pendiente_producto" ON "etiquetas_precio" ("productoId") WHERE "estado" = 'PENDIENTE' AND "productoVarianteId" IS NULL;
CREATE UNIQUE INDEX "etiquetas_precio_pendiente_variante" ON "etiquetas_precio" ("productoVarianteId") WHERE "estado" = 'PENDIENTE' AND "productoVarianteId" IS NOT NULL;

ALTER TABLE "etiquetas_precio" ADD CONSTRAINT "etiquetas_precio_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "etiquetas_precio" ADD CONSTRAINT "etiquetas_precio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "etiquetas_precio" ADD CONSTRAINT "etiquetas_precio_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "etiquetas_precio" ADD CONSTRAINT "etiquetas_precio_cambioPrecioVentaId_fkey" FOREIGN KEY ("cambioPrecioVentaId") REFERENCES "cambios_precio_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
    IF FOUND THEN RAISE EXCEPTION 'price labels are never deleted'; END IF;
    RETURN OLD;
  END IF;
  -- UPDATE: sólo PENDIENTE → resuelta, una vez; lo autorizado no cambia nunca.
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

CREATE TRIGGER "etiquetas_precio_guard_trigger" BEFORE INSERT OR UPDATE OR DELETE ON "etiquetas_precio" FOR EACH ROW EXECUTE FUNCTION "guard_etiqueta_precio"();

-- ============ activaciones_precio_venta ============
CREATE TABLE "activaciones_precio_venta" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoVarianteId" TEXT,
    "precioAnteriorDecimal" DECIMAL(12,2) NOT NULL,
    "precioNuevoDecimal" DECIMAL(12,2) NOT NULL,
    "origen" TEXT NOT NULL,
    "etiquetaPrecioId" TEXT,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "activadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activaciones_precio_venta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activaciones_precio_venta_importes_check" CHECK ("precioAnteriorDecimal" > 0 AND "precioNuevoDecimal" > 0),
    CONSTRAINT "activaciones_precio_venta_origen_check" CHECK (
      ("origen" = 'CATALOGO' AND "etiquetaPrecioId" IS NULL AND "actorTipo" = 'NEGOCIO')
      OR ("origen" = 'ETIQUETA' AND "etiquetaPrecioId" IS NOT NULL AND "actorTipo" IN ('NEGOCIO', 'EMPLEADO'))
      OR ("origen" IN ('DUENO_SIN_ETIQUETA', 'APROBACION_SIN_ETIQUETA') AND "etiquetaPrecioId" IS NOT NULL AND "actorTipo" = 'NEGOCIO')
    )
);

CREATE UNIQUE INDEX "activaciones_precio_venta_etiquetaPrecioId_key" ON "activaciones_precio_venta"("etiquetaPrecioId");
CREATE INDEX "activaciones_precio_venta_negocioId_productoId_activadoEn_idx" ON "activaciones_precio_venta"("negocioId", "productoId", "activadoEn");

ALTER TABLE "activaciones_precio_venta" ADD CONSTRAINT "activaciones_precio_venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activaciones_precio_venta" ADD CONSTRAINT "activaciones_precio_venta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activaciones_precio_venta" ADD CONSTRAINT "activaciones_precio_venta_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activaciones_precio_venta" ADD CONSTRAINT "activaciones_precio_venta_etiquetaPrecioId_fkey" FOREIGN KEY ("etiquetaPrecioId") REFERENCES "etiquetas_precio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "guard_activacion_precio_venta"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND THEN RAISE EXCEPTION 'price activations are never deleted'; END IF;
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
    -- Activa exactamente lo autorizado de una etiqueta ya resuelta como ACTIVADA, del mismo producto/variante.
    PERFORM 1 FROM "etiquetas_precio" WHERE "id" = NEW."etiquetaPrecioId" AND "negocioId" = NEW."negocioId" AND "productoId" = NEW."productoId"
      AND "productoVarianteId" IS NOT DISTINCT FROM NEW."productoVarianteId" AND "estado" = 'ACTIVADA' AND "precioNuevoDecimal" = NEW."precioNuevoDecimal";
    IF NOT FOUND THEN RAISE EXCEPTION 'price activation must match an activated label'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "activaciones_precio_venta_guard_trigger" BEFORE INSERT OR UPDATE OR DELETE ON "activaciones_precio_venta" FOR EACH ROW EXECUTE FUNCTION "guard_activacion_precio_venta"();

-- ============ inicios_venta ============
CREATE TABLE "inicios_venta" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "iniciadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "ventaId" TEXT,
    "usadaEn" TIMESTAMP(3),

    CONSTRAINT "inicios_venta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inicios_venta_actor_check" CHECK ("actorTipo" IN ('NEGOCIO', 'EMPLEADO')),
    -- Nunca se puede sostener un precio viejo indefinidamente: plazo acotado.
    CONSTRAINT "inicios_venta_plazo_check" CHECK ("expiraEn" > "iniciadaEn" AND "expiraEn" <= "iniciadaEn" + INTERVAL '2 hours'),
    CONSTRAINT "inicios_venta_uso_check" CHECK (("ventaId" IS NULL) = ("usadaEn" IS NULL))
);

CREATE UNIQUE INDEX "inicios_venta_ventaId_key" ON "inicios_venta"("ventaId");
CREATE INDEX "inicios_venta_negocioId_iniciadaEn_idx" ON "inicios_venta"("negocioId", "iniciadaEn");

ALTER TABLE "inicios_venta" ADD CONSTRAINT "inicios_venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inicios_venta" ADD CONSTRAINT "inicios_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un solo uso: sólo se completa ventaId/usadaEn una vez; la hora de inicio y el plazo no cambian.
CREATE OR REPLACE FUNCTION "guard_inicio_venta"() RETURNS trigger AS $$
BEGIN
  IF OLD."ventaId" IS NOT NULL OR NEW."ventaId" IS NULL
     OR NEW."id" <> OLD."id" OR NEW."negocioId" <> OLD."negocioId" OR NEW."actorTipo" <> OLD."actorTipo" OR NEW."actorId" <> OLD."actorId"
     OR NEW."iniciadaEn" <> OLD."iniciadaEn" OR NEW."expiraEn" <> OLD."expiraEn" THEN
    RAISE EXCEPTION 'a sale start is used once and never changes';
  END IF;
  PERFORM 1 FROM "ventas_caja" WHERE "id" = NEW."ventaId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN RAISE EXCEPTION 'a sale start belongs to a sale of the same business'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inicios_venta_guard_trigger" BEFORE UPDATE ON "inicios_venta" FOR EACH ROW EXECUTE FUNCTION "guard_inicio_venta"();
