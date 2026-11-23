-- F5 / F10-C2b — productos y variantes que entrega cada proveedor (muchos a muchos). Operador 2026-11-20, sólo
-- desarrollo local. ADITIVA: una tabla nueva con su guarda; no modifica filas ni tablas existentes.
-- Es configuración (qué proveedor entrega qué): no mueve stock, costos, deuda ni dinero. Un producto o variante
-- nunca se duplica: la asociación sólo referencia el producto/variante existente del MISMO negocio.

CREATE TABLE "proveedor_productos" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoVarianteId" TEXT,
    "origen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedor_productos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "proveedor_productos_origen_check" CHECK ("origen" IN ('MANUAL', 'RECEPCION'))
);

-- Una sola asociación por (proveedor, producto) sin variante y por (proveedor, variante).
CREATE UNIQUE INDEX "proveedor_productos_producto_unico" ON "proveedor_productos" ("negocioId", "proveedorId", "productoId") WHERE "productoVarianteId" IS NULL;
CREATE UNIQUE INDEX "proveedor_productos_variante_unica" ON "proveedor_productos" ("negocioId", "proveedorId", "productoVarianteId") WHERE "productoVarianteId" IS NOT NULL;
CREATE INDEX "proveedor_productos_negocioId_proveedorId_idx" ON "proveedor_productos" ("negocioId", "proveedorId");
CREATE INDEX "proveedor_productos_productoId_idx" ON "proveedor_productos" ("productoId");

ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aislamiento por negocio: el producto es del negocio y la variante es de ese producto. Inmutable (se borra y se crea).
CREATE OR REPLACE FUNCTION "guard_proveedor_producto"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'supplier product association is immutable';
  END IF;
  PERFORM 1 FROM "productos" WHERE "id" = NEW."productoId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN RAISE EXCEPTION 'supplier product must belong to the same business'; END IF;
  IF NEW."productoVarianteId" IS NOT NULL THEN
    PERFORM 1 FROM "producto_variantes" WHERE "id" = NEW."productoVarianteId" AND "productoId" = NEW."productoId";
    IF NOT FOUND THEN RAISE EXCEPTION 'supplier product variant must belong to the product'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "proveedor_productos_guard_trigger" BEFORE INSERT OR UPDATE ON "proveedor_productos" FOR EACH ROW EXECUTE FUNCTION "guard_proveedor_producto"();
