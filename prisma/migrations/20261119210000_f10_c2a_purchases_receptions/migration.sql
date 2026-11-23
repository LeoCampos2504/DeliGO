-- ============================================
-- F10-C2a — compras y recepciones de mercadería (ADITIVA)
-- ============================================
-- Diseño: codex-reports/F10_C2_F5_COMPRAS_RECEPCION_DISENO.md v2 §4.4, §6, §7, §8 (implementación §13).
-- Crea 8 tablas (configuracion_compras, compras, compra_lineas, recepciones, recepcion_lineas,
-- recepcion_cargos, eventos_compra_recepcion, costos_vigentes) y agrega, sin tocar filas existentes:
--   * movimientos_inventario.recepcionLineaId (único: una entrada RECEPCION por línea aprobada)
--   * obligaciones_proveedor.recepcionCargoId (único: una obligación por cargo accesorio)
--   * se amplía el CHECK de origen de obligaciones_proveedor (F5-A) a RECEPCION / CARGO_ACCESORIO
-- No modifica migraciones aplicadas. Excluye la deriva preexistente de nombres (11 RENAME).

-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "recepcionLineaId" TEXT;

-- AlterTable
ALTER TABLE "obligaciones_proveedor" ADD COLUMN     "recepcionCargoId" TEXT;

-- CreateTable
CREATE TABLE "configuracion_compras" (
    "negocioId" TEXT NOT NULL,
    "tratamientoImpuestos" TEXT NOT NULL DEFAULT 'IMPUESTOS_INTEGRAN_COSTO',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_compras_pkey" PRIMARY KEY ("negocioId")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "fechaPedido" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "cerradaEn" TIMESTAMP(3),
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra_lineas" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT,
    "productoVarianteId" TEXT,
    "productoNombre" TEXT NOT NULL,
    "varianteNombre" TEXT,
    "cantidadPedidaDecimal" DECIMAL(14,3) NOT NULL,
    "costoUnitarioAcordadoDecimal" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compra_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepciones" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "compraId" TEXT,
    "numero" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "preparadaPorTipo" TEXT NOT NULL,
    "preparadaPorEmpleadoId" TEXT,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL,
    "comprobanteTipo" TEXT,
    "comprobanteNumero" TEXT,
    "comprobanteFecha" TIMESTAMP(3),
    "comprobanteClave" TEXT,
    "descuentoGlobalDecimal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "percepcionesDecimal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contenidoHuella" TEXT NOT NULL,
    "enviadaEn" TIMESTAMP(3),
    "aprobadaEn" TIMESTAMP(3),
    "rechazadaEn" TIMESTAMP(3),
    "descartadaEn" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "tratamientoImpuestos" TEXT,
    "netoDecimal" DECIMAL(12,2),
    "descuentosDecimal" DECIMAL(12,2),
    "impuestosDecimal" DECIMAL(12,2),
    "cargosDecimal" DECIMAL(12,2),
    "totalObligacionDecimal" DECIMAL(12,2),
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recepciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepcion_lineas" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "compraLineaId" TEXT,
    "productoId" TEXT,
    "productoVarianteId" TEXT,
    "productoNombre" TEXT NOT NULL,
    "varianteNombre" TEXT,
    "cantidadRecibidaDecimal" DECIMAL(14,3) NOT NULL,
    "cantidadAceptadaDecimal" DECIMAL(14,3) NOT NULL,
    "cantidadRechazadaDecimal" DECIMAL(14,3) NOT NULL,
    "motivoRechazo" TEXT,
    "detalleRechazo" TEXT,
    "costoUnitarioDecimal" DECIMAL(14,4) NOT NULL,
    "descuentoPctDecimal" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "alicuotaImpuestoPctDecimal" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "controlStockAlAprobar" BOOLEAN,
    "subtotalDecimal" DECIMAL(12,2),
    "descuentoLineaDecimal" DECIMAL(12,2),
    "descuentoGlobalDecimal" DECIMAL(12,2),
    "netoDecimal" DECIMAL(12,2),
    "impuestosDecimal" DECIMAL(12,2),
    "percepcionDecimal" DECIMAL(12,2),
    "cargosDecimal" DECIMAL(12,2),
    "costoInventarioTotalDecimal" DECIMAL(12,2),
    "costoUnitarioInventarioDecimal" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recepcion_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepcion_cargos" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "distribucion" TEXT,
    "comprobanteTipo" TEXT,
    "comprobanteNumero" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recepcion_cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_compra_recepcion" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "recepcionId" TEXT,
    "compraId" TEXT,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_compra_recepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costos_vigentes" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "stockKey" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoVarianteId" TEXT,
    "recepcionLineaId" TEXT NOT NULL,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL,
    "aprobadaEn" TIMESTAMP(3) NOT NULL,
    "costoUnitarioDecimal" DECIMAL(14,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "costos_vigentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compras_negocioId_proveedorId_estado_idx" ON "compras"("negocioId", "proveedorId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "compras_negocioId_numero_key" ON "compras"("negocioId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "compras_negocioId_idempotencyKey_key" ON "compras"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "compras_id_negocioId_key" ON "compras"("id", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "compras_id_proveedorId_negocioId_key" ON "compras"("id", "proveedorId", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "compra_lineas_id_negocioId_key" ON "compra_lineas"("id", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "compra_lineas_compraId_orden_key" ON "compra_lineas"("compraId", "orden");

-- CreateIndex
CREATE INDEX "recepciones_negocioId_estado_createdAt_idx" ON "recepciones"("negocioId", "estado", "createdAt");

-- CreateIndex
CREATE INDEX "recepciones_negocioId_proveedorId_idx" ON "recepciones"("negocioId", "proveedorId");

-- CreateIndex
CREATE INDEX "recepciones_compraId_idx" ON "recepciones"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_negocioId_numero_key" ON "recepciones"("negocioId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_negocioId_idempotencyKey_key" ON "recepciones"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_id_negocioId_key" ON "recepciones"("id", "negocioId");

-- CreateIndex
CREATE INDEX "recepcion_lineas_compraLineaId_idx" ON "recepcion_lineas"("compraLineaId");

-- CreateIndex
CREATE UNIQUE INDEX "recepcion_lineas_id_negocioId_key" ON "recepcion_lineas"("id", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "recepcion_lineas_recepcionId_orden_key" ON "recepcion_lineas"("recepcionId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "recepcion_cargos_id_negocioId_key" ON "recepcion_cargos"("id", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "recepcion_cargos_recepcionId_orden_key" ON "recepcion_cargos"("recepcionId", "orden");

-- CreateIndex
CREATE INDEX "eventos_compra_recepcion_negocioId_recepcionId_idx" ON "eventos_compra_recepcion"("negocioId", "recepcionId");

-- CreateIndex
CREATE INDEX "eventos_compra_recepcion_negocioId_compraId_idx" ON "eventos_compra_recepcion"("negocioId", "compraId");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_compra_recepcion_negocioId_idempotencyKey_key" ON "eventos_compra_recepcion"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "costos_vigentes_negocioId_stockKey_key" ON "costos_vigentes"("negocioId", "stockKey");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_inventario_recepcionLineaId_key" ON "movimientos_inventario"("recepcionLineaId");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_recepcionLineaId_fkey" FOREIGN KEY ("recepcionLineaId") REFERENCES "recepcion_lineas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_proveedor" ADD CONSTRAINT "obligaciones_proveedor_recepcionId_negocioId_fkey" FOREIGN KEY ("recepcionId", "negocioId") REFERENCES "recepciones"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_proveedor" ADD CONSTRAINT "obligaciones_proveedor_recepcionCargoId_negocioId_fkey" FOREIGN KEY ("recepcionCargoId", "negocioId") REFERENCES "recepcion_cargos"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion_compras" ADD CONSTRAINT "configuracion_compras_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_lineas" ADD CONSTRAINT "compra_lineas_compraId_negocioId_fkey" FOREIGN KEY ("compraId", "negocioId") REFERENCES "compras"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_lineas" ADD CONSTRAINT "compra_lineas_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_lineas" ADD CONSTRAINT "compra_lineas_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_compraId_proveedorId_negocioId_fkey" FOREIGN KEY ("compraId", "proveedorId", "negocioId") REFERENCES "compras"("id", "proveedorId", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_lineas" ADD CONSTRAINT "recepcion_lineas_recepcionId_negocioId_fkey" FOREIGN KEY ("recepcionId", "negocioId") REFERENCES "recepciones"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_lineas" ADD CONSTRAINT "recepcion_lineas_compraLineaId_negocioId_fkey" FOREIGN KEY ("compraLineaId", "negocioId") REFERENCES "compra_lineas"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_lineas" ADD CONSTRAINT "recepcion_lineas_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_lineas" ADD CONSTRAINT "recepcion_lineas_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_cargos" ADD CONSTRAINT "recepcion_cargos_recepcionId_negocioId_fkey" FOREIGN KEY ("recepcionId", "negocioId") REFERENCES "recepciones"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_cargos" ADD CONSTRAINT "recepcion_cargos_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_compra_recepcion" ADD CONSTRAINT "eventos_compra_recepcion_recepcionId_negocioId_fkey" FOREIGN KEY ("recepcionId", "negocioId") REFERENCES "recepciones"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_compra_recepcion" ADD CONSTRAINT "eventos_compra_recepcion_compraId_negocioId_fkey" FOREIGN KEY ("compraId", "negocioId") REFERENCES "compras"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costos_vigentes" ADD CONSTRAINT "costos_vigentes_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costos_vigentes" ADD CONSTRAINT "costos_vigentes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costos_vigentes" ADD CONSTRAINT "costos_vigentes_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costos_vigentes" ADD CONSTRAINT "costos_vigentes_recepcionLineaId_negocioId_fkey" FOREIGN KEY ("recepcionLineaId", "negocioId") REFERENCES "recepcion_lineas"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- F10-C2a — invariantes en SQL (defensa en profundidad; el servicio es el único escritor)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Configuración
-- ---------------------------------------------------------------------------
ALTER TABLE "configuracion_compras"
  ADD CONSTRAINT "configuracion_compras_tratamiento_check" CHECK ("tratamientoImpuestos" IN ('IMPUESTOS_INTEGRAN_COSTO', 'IMPUESTOS_RECUPERABLES'));

-- ---------------------------------------------------------------------------
-- Compras (pedidos) y sus renglones
-- ---------------------------------------------------------------------------
ALTER TABLE "compras"
  ADD CONSTRAINT "compras_estado_check" CHECK (
    ("estado" = 'ABIERTA' AND "cerradaEn" IS NULL) OR ("estado" IN ('CERRADA_CON_FALTANTE', 'ANULADA') AND "cerradaEn" IS NOT NULL)
  ),
  ADD CONSTRAINT "compras_numero_check" CHECK ("numero" > 0),
  ADD CONSTRAINT "compras_notas_check" CHECK ("notas" IS NULL OR length(btrim("notas")) BETWEEN 1 AND 500);

ALTER TABLE "compra_lineas"
  ADD CONSTRAINT "compra_lineas_cantidad_check" CHECK ("cantidadPedidaDecimal" > 0),
  ADD CONSTRAINT "compra_lineas_costo_check" CHECK ("costoUnitarioAcordadoDecimal" IS NULL OR "costoUnitarioAcordadoDecimal" >= 0),
  ADD CONSTRAINT "compra_lineas_nombre_check" CHECK (length(btrim("productoNombre")) BETWEEN 1 AND 200);

CREATE FUNCTION "guard_compra_c2a"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."estado" <> 'ABIERTA' THEN RAISE EXCEPTION 'purchase order starts open'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId" OR NEW."proveedorId" IS DISTINCT FROM OLD."proveedorId"
     OR NEW."numero" IS DISTINCT FROM OLD."numero" OR NEW."fechaPedido" IS DISTINCT FROM OLD."fechaPedido" OR NEW."notas" IS DISTINCT FROM OLD."notas"
     OR NEW."actorId" IS DISTINCT FROM OLD."actorId" OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."idempotencyFingerprint" IS DISTINCT FROM OLD."idempotencyFingerprint" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'purchase order is immutable';
  END IF;
  IF NEW."estado" IS DISTINCT FROM OLD."estado" OR NEW."cerradaEn" IS DISTINCT FROM OLD."cerradaEn" THEN
    IF OLD."estado" <> 'ABIERTA' OR NEW."estado" NOT IN ('CERRADA_CON_FALTANTE', 'ANULADA') THEN RAISE EXCEPTION 'purchase order transition not allowed'; END IF;
    PERFORM 1 FROM "eventos_compra_recepcion" WHERE "compraId" = NEW."id" AND "negocioId" = NEW."negocioId"
      AND "tipo" = CASE NEW."estado" WHEN 'ANULADA' THEN 'ANULACION_COMPRA' ELSE 'CIERRE_COMPRA' END AND "createdAt" = NEW."cerradaEn";
    IF NOT FOUND THEN RAISE EXCEPTION 'purchase order transition requires its event'; END IF;
    PERFORM 1 FROM "recepciones" WHERE "compraId" = NEW."id" AND "negocioId" = NEW."negocioId" AND "estado" = 'PENDIENTE_APROBACION';
    IF FOUND THEN RAISE EXCEPTION 'purchase order has receptions pending approval'; END IF;
    IF NEW."estado" = 'ANULADA' THEN
      PERFORM 1 FROM "recepciones" WHERE "compraId" = NEW."id" AND "negocioId" = NEW."negocioId" AND "estado" = 'APROBADA';
      IF FOUND THEN RAISE EXCEPTION 'a purchase order with approved receptions cannot be cancelled'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "compras_guard_trigger" BEFORE INSERT OR UPDATE ON "compras" FOR EACH ROW EXECUTE FUNCTION "guard_compra_c2a"();

CREATE FUNCTION "guard_compra_linea_c2a"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."productoId" IS NULL THEN RAISE EXCEPTION 'purchase line requires a product'; END IF;
    PERFORM 1 FROM "productos" WHERE "id" = NEW."productoId" AND "negocioId" = NEW."negocioId";
    IF NOT FOUND THEN RAISE EXCEPTION 'purchase line product must belong to the business'; END IF;
    IF NEW."productoVarianteId" IS NOT NULL THEN
      PERFORM 1 FROM "producto_variantes" WHERE "id" = NEW."productoVarianteId" AND "productoId" = NEW."productoId";
      IF NOT FOUND THEN RAISE EXCEPTION 'purchase line variant must belong to its product'; END IF;
    END IF;
    RETURN NEW;
  END IF;
  -- Sólo la acción de FK al borrar un producto/variante (SET NULL); el resto es inmutable.
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId" OR NEW."compraId" IS DISTINCT FROM OLD."compraId"
     OR NEW."orden" IS DISTINCT FROM OLD."orden" OR NEW."productoNombre" IS DISTINCT FROM OLD."productoNombre" OR NEW."varianteNombre" IS DISTINCT FROM OLD."varianteNombre"
     OR NEW."cantidadPedidaDecimal" IS DISTINCT FROM OLD."cantidadPedidaDecimal" OR NEW."costoUnitarioAcordadoDecimal" IS DISTINCT FROM OLD."costoUnitarioAcordadoDecimal"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR (NEW."productoId" IS DISTINCT FROM OLD."productoId" AND NEW."productoId" IS NOT NULL)
     OR (NEW."productoVarianteId" IS DISTINCT FROM OLD."productoVarianteId" AND NEW."productoVarianteId" IS NOT NULL) THEN
    RAISE EXCEPTION 'purchase line is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "compra_lineas_guard_trigger" BEFORE INSERT OR UPDATE ON "compra_lineas" FOR EACH ROW EXECUTE FUNCTION "guard_compra_linea_c2a"();

-- ---------------------------------------------------------------------------
-- Recepciones
-- ---------------------------------------------------------------------------
ALTER TABLE "recepciones"
  ADD CONSTRAINT "recepciones_estado_check" CHECK ("estado" IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'DESCARTADA')),
  ADD CONSTRAINT "recepciones_preparada_check" CHECK (
    ("preparadaPorTipo" = 'NEGOCIO' AND "preparadaPorEmpleadoId" IS NULL) OR ("preparadaPorTipo" = 'EMPLEADO' AND "preparadaPorEmpleadoId" IS NOT NULL)
  ),
  ADD CONSTRAINT "recepciones_numero_check" CHECK ("numero" > 0 AND "version" > 0),
  ADD CONSTRAINT "recepciones_importes_check" CHECK ("descuentoGlobalDecimal" >= 0 AND "percepcionesDecimal" >= 0),
  ADD CONSTRAINT "recepciones_textos_check" CHECK (
    ("comprobanteTipo" IS NULL OR length(btrim("comprobanteTipo")) BETWEEN 1 AND 40)
    AND ("comprobanteNumero" IS NULL OR length(btrim("comprobanteNumero")) BETWEEN 1 AND 60)
    AND ("notas" IS NULL OR length(btrim("notas")) BETWEEN 1 AND 500)
    AND ("motivoRechazo" IS NULL OR length(btrim("motivoRechazo")) BETWEEN 1 AND 500)
  ),
  ADD CONSTRAINT "recepciones_marcas_check" CHECK (
    ("estado" = 'APROBADA') = ("aprobadaEn" IS NOT NULL)
    AND ("estado" = 'RECHAZADA') = ("rechazadaEn" IS NOT NULL AND "motivoRechazo" IS NOT NULL)
    AND ("estado" = 'DESCARTADA') = ("descartadaEn" IS NOT NULL)
    AND ("estado" <> 'PENDIENTE_APROBACION' OR "enviadaEn" IS NOT NULL)
  ),
  -- La instantánea de la aprobación existe sólo (y siempre) en una recepción APROBADA.
  ADD CONSTRAINT "recepciones_instantanea_check" CHECK (
    ("estado" = 'APROBADA') = (
      "tratamientoImpuestos" IN ('IMPUESTOS_INTEGRAN_COSTO', 'IMPUESTOS_RECUPERABLES') AND "netoDecimal" IS NOT NULL AND "descuentosDecimal" IS NOT NULL
      AND "impuestosDecimal" IS NOT NULL AND "cargosDecimal" IS NOT NULL AND "totalObligacionDecimal" IS NOT NULL
    )
    AND ("totalObligacionDecimal" IS NULL OR "totalObligacionDecimal" >= 0)
  );
-- D-5: un mismo comprobante (tipo + número) no se aprueba dos veces para el mismo proveedor.
CREATE UNIQUE INDEX "recepciones_comprobante_aprobado_unico" ON "recepciones"("negocioId", "proveedorId", "comprobanteClave")
  WHERE "estado" = 'APROBADA' AND "comprobanteClave" IS NOT NULL;

CREATE FUNCTION "guard_recepcion_c2a"() RETURNS trigger AS $$
DECLARE
  evento text;
  marca timestamp(3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."estado" <> 'BORRADOR' OR NEW."version" <> 1 THEN RAISE EXCEPTION 'reception starts as a draft'; END IF;
    RETURN NEW;
  END IF;
  IF OLD."estado" IN ('APROBADA', 'RECHAZADA', 'DESCARTADA') THEN RAISE EXCEPTION 'a closed reception is immutable'; END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId" OR NEW."numero" IS DISTINCT FROM OLD."numero"
     OR NEW."preparadaPorTipo" IS DISTINCT FROM OLD."preparadaPorTipo" OR NEW."preparadaPorEmpleadoId" IS DISTINCT FROM OLD."preparadaPorEmpleadoId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" OR NEW."idempotencyFingerprint" IS DISTINCT FROM OLD."idempotencyFingerprint"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'reception identity is immutable';
  END IF;
  IF NEW."estado" = OLD."estado" THEN
    -- Sólo un BORRADOR se edita, y cada edición sube la versión.
    IF OLD."estado" <> 'BORRADOR' THEN RAISE EXCEPTION 'only a draft reception can be edited'; END IF;
    IF NEW."version" <> OLD."version" + 1 THEN RAISE EXCEPTION 'reception edit must bump its version'; END IF;
    RETURN NEW;
  END IF;
  -- Transición de estado: el contenido no cambia en el mismo paso.
  IF NEW."proveedorId" IS DISTINCT FROM OLD."proveedorId" OR NEW."compraId" IS DISTINCT FROM OLD."compraId"
     OR NEW."fechaRecepcion" IS DISTINCT FROM OLD."fechaRecepcion" OR NEW."comprobanteTipo" IS DISTINCT FROM OLD."comprobanteTipo"
     OR NEW."comprobanteNumero" IS DISTINCT FROM OLD."comprobanteNumero" OR NEW."comprobanteFecha" IS DISTINCT FROM OLD."comprobanteFecha"
     OR NEW."comprobanteClave" IS DISTINCT FROM OLD."comprobanteClave" OR NEW."descuentoGlobalDecimal" IS DISTINCT FROM OLD."descuentoGlobalDecimal"
     OR NEW."percepcionesDecimal" IS DISTINCT FROM OLD."percepcionesDecimal" OR NEW."notas" IS DISTINCT FROM OLD."notas"
     OR NEW."contenidoHuella" IS DISTINCT FROM OLD."contenidoHuella" THEN
    RAISE EXCEPTION 'reception content cannot change together with its state';
  END IF;
  IF OLD."estado" = 'BORRADOR' AND NEW."estado" = 'PENDIENTE_APROBACION' THEN evento := 'ENVIO'; marca := NEW."enviadaEn";
  ELSIF OLD."estado" = 'PENDIENTE_APROBACION' AND NEW."estado" = 'BORRADOR' THEN evento := 'DEVOLUCION_A_BORRADOR'; marca := NULL;
  ELSIF OLD."estado" IN ('BORRADOR', 'PENDIENTE_APROBACION') AND NEW."estado" = 'APROBADA' THEN evento := 'APROBACION'; marca := NEW."aprobadaEn";
  ELSIF OLD."estado" IN ('BORRADOR', 'PENDIENTE_APROBACION') AND NEW."estado" = 'RECHAZADA' THEN evento := 'RECHAZO'; marca := NEW."rechazadaEn";
  ELSIF OLD."estado" = 'BORRADOR' AND NEW."estado" = 'DESCARTADA' THEN evento := 'DESCARTE'; marca := NEW."descartadaEn";
  ELSE RAISE EXCEPTION 'reception transition not allowed';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN RAISE EXCEPTION 'reception transition must bump its version'; END IF;
  IF marca IS NOT NULL THEN
    PERFORM 1 FROM "eventos_compra_recepcion" WHERE "recepcionId" = NEW."id" AND "negocioId" = NEW."negocioId" AND "tipo" = evento AND "createdAt" = marca;
  ELSE
    PERFORM 1 FROM "eventos_compra_recepcion" WHERE "recepcionId" = NEW."id" AND "negocioId" = NEW."negocioId" AND "tipo" = evento;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'reception transition requires its event'; END IF;
  IF NEW."estado" = 'APROBADA' THEN
    -- Toda línea aceptada tiene su costo congelado; la suma de las líneas coincide con la instantánea.
    PERFORM 1 FROM "recepcion_lineas" WHERE "recepcionId" = NEW."id" AND "negocioId" = NEW."negocioId"
      AND ("costoInventarioTotalDecimal" IS NULL OR "netoDecimal" IS NULL OR "impuestosDecimal" IS NULL OR "controlStockAlAprobar" IS NULL
           OR ("cantidadAceptadaDecimal" > 0 AND "costoUnitarioInventarioDecimal" IS NULL));
    IF FOUND THEN RAISE EXCEPTION 'approved reception lines must have frozen costs'; END IF;
    IF NEW."netoDecimal" <> COALESCE((SELECT sum("netoDecimal") FROM "recepcion_lineas" WHERE "recepcionId" = NEW."id" AND "negocioId" = NEW."negocioId"), 0) THEN
      RAISE EXCEPTION 'approved reception net amount does not match its lines';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recepciones_guard_trigger" BEFORE INSERT OR UPDATE ON "recepciones" FOR EACH ROW EXECUTE FUNCTION "guard_recepcion_c2a"();

-- ---------------------------------------------------------------------------
-- Líneas y cargos de una recepción: contenido sólo en BORRADOR; instantánea sólo antes de aprobar
-- ---------------------------------------------------------------------------
ALTER TABLE "recepcion_lineas"
  ADD CONSTRAINT "recepcion_lineas_cantidades_check" CHECK (
    "cantidadRecibidaDecimal" >= 0 AND "cantidadAceptadaDecimal" >= 0 AND "cantidadRechazadaDecimal" >= 0
    AND "cantidadAceptadaDecimal" + "cantidadRechazadaDecimal" = "cantidadRecibidaDecimal" AND "cantidadRecibidaDecimal" > 0
  ),
  ADD CONSTRAINT "recepcion_lineas_rechazo_check" CHECK (
    ("cantidadRechazadaDecimal" = 0 AND "motivoRechazo" IS NULL)
    OR ("cantidadRechazadaDecimal" > 0 AND "motivoRechazo" IN ('DANADO', 'VENCIDO', 'NO_PEDIDO', 'ERROR_PROVEEDOR', 'OTRO'))
  ),
  ADD CONSTRAINT "recepcion_lineas_costos_check" CHECK (
    "costoUnitarioDecimal" >= 0 AND "descuentoPctDecimal" BETWEEN 0 AND 100 AND "alicuotaImpuestoPctDecimal" BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT "recepcion_lineas_textos_check" CHECK (
    length(btrim("productoNombre")) BETWEEN 1 AND 200 AND ("detalleRechazo" IS NULL OR length(btrim("detalleRechazo")) BETWEEN 1 AND 300)
  ),
  ADD CONSTRAINT "recepcion_lineas_instantanea_check" CHECK (
    ("subtotalDecimal" IS NULL OR "subtotalDecimal" >= 0) AND ("descuentoLineaDecimal" IS NULL OR "descuentoLineaDecimal" >= 0)
    AND ("descuentoGlobalDecimal" IS NULL OR "descuentoGlobalDecimal" >= 0) AND ("netoDecimal" IS NULL OR "netoDecimal" >= 0)
    AND ("impuestosDecimal" IS NULL OR "impuestosDecimal" >= 0) AND ("percepcionDecimal" IS NULL OR "percepcionDecimal" >= 0)
    AND ("cargosDecimal" IS NULL OR "cargosDecimal" >= 0) AND ("costoInventarioTotalDecimal" IS NULL OR "costoInventarioTotalDecimal" >= 0)
    AND ("costoUnitarioInventarioDecimal" IS NULL OR "costoUnitarioInventarioDecimal" >= 0)
  );

ALTER TABLE "recepcion_cargos"
  ADD CONSTRAINT "recepcion_cargos_tipo_check" CHECK (
    ("tipo" = 'ATRIBUIBLE' AND "distribucion" IN ('VALOR', 'CANTIDAD')) OR ("tipo" = 'NO_ATRIBUIBLE' AND "distribucion" IS NULL)
  ),
  ADD CONSTRAINT "recepcion_cargos_importe_check" CHECK ("importeDecimal" > 0),
  ADD CONSTRAINT "recepcion_cargos_textos_check" CHECK (
    length(btrim("concepto")) BETWEEN 1 AND 120
    AND ("comprobanteTipo" IS NULL OR length(btrim("comprobanteTipo")) BETWEEN 1 AND 40)
    AND ("comprobanteNumero" IS NULL OR length(btrim("comprobanteNumero")) BETWEEN 1 AND 60)
  );

CREATE FUNCTION "f10c2a_estado_recepcion"(rid text, nid text) RETURNS text AS $$
  SELECT "estado" FROM "recepciones" WHERE "id" = rid AND "negocioId" = nid
$$ LANGUAGE sql STABLE;

CREATE FUNCTION "guard_recepcion_linea_c2a"() RETURNS trigger AS $$
DECLARE
  estado_padre text;
  compra_padre text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND AND COALESCE("f10c2a_estado_recepcion"(OLD."recepcionId", OLD."negocioId"), 'BORRADOR') <> 'BORRADOR' THEN
      RAISE EXCEPTION 'only draft reception lines can be removed';
    END IF;
    RETURN OLD;
  END IF;
  estado_padre := "f10c2a_estado_recepcion"(NEW."recepcionId", NEW."negocioId");
  IF TG_OP = 'INSERT' THEN
    IF estado_padre IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'lines can only be added to a draft reception'; END IF;
    IF NEW."productoId" IS NULL THEN RAISE EXCEPTION 'reception line requires a product'; END IF;
    PERFORM 1 FROM "productos" WHERE "id" = NEW."productoId" AND "negocioId" = NEW."negocioId";
    IF NOT FOUND THEN RAISE EXCEPTION 'reception line product must belong to the business'; END IF;
    IF NEW."productoVarianteId" IS NOT NULL THEN
      PERFORM 1 FROM "producto_variantes" WHERE "id" = NEW."productoVarianteId" AND "productoId" = NEW."productoId";
      IF NOT FOUND THEN RAISE EXCEPTION 'reception line variant must belong to its product'; END IF;
    END IF;
    IF NEW."compraLineaId" IS NOT NULL THEN
      SELECT "compraId" INTO compra_padre FROM "recepciones" WHERE "id" = NEW."recepcionId" AND "negocioId" = NEW."negocioId";
      PERFORM 1 FROM "compra_lineas" WHERE "id" = NEW."compraLineaId" AND "negocioId" = NEW."negocioId" AND "compraId" = compra_padre;
      IF NOT FOUND THEN RAISE EXCEPTION 'reception line must reference a line of its own purchase order'; END IF;
    END IF;
    IF NEW."subtotalDecimal" IS NOT NULL OR NEW."netoDecimal" IS NOT NULL OR NEW."costoInventarioTotalDecimal" IS NOT NULL OR NEW."controlStockAlAprobar" IS NOT NULL THEN
      RAISE EXCEPTION 'a draft line cannot carry approval figures';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId" OR NEW."recepcionId" IS DISTINCT FROM OLD."recepcionId"
     OR NEW."orden" IS DISTINCT FROM OLD."orden" OR NEW."compraLineaId" IS DISTINCT FROM OLD."compraLineaId"
     OR NEW."productoNombre" IS DISTINCT FROM OLD."productoNombre" OR NEW."varianteNombre" IS DISTINCT FROM OLD."varianteNombre"
     OR NEW."cantidadRecibidaDecimal" IS DISTINCT FROM OLD."cantidadRecibidaDecimal" OR NEW."cantidadAceptadaDecimal" IS DISTINCT FROM OLD."cantidadAceptadaDecimal"
     OR NEW."cantidadRechazadaDecimal" IS DISTINCT FROM OLD."cantidadRechazadaDecimal" OR NEW."motivoRechazo" IS DISTINCT FROM OLD."motivoRechazo"
     OR NEW."detalleRechazo" IS DISTINCT FROM OLD."detalleRechazo" OR NEW."costoUnitarioDecimal" IS DISTINCT FROM OLD."costoUnitarioDecimal"
     OR NEW."descuentoPctDecimal" IS DISTINCT FROM OLD."descuentoPctDecimal" OR NEW."alicuotaImpuestoPctDecimal" IS DISTINCT FROM OLD."alicuotaImpuestoPctDecimal"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR (NEW."productoId" IS DISTINCT FROM OLD."productoId" AND NEW."productoId" IS NOT NULL)
     OR (NEW."productoVarianteId" IS DISTINCT FROM OLD."productoVarianteId" AND NEW."productoVarianteId" IS NOT NULL) THEN
    RAISE EXCEPTION 'reception line content is immutable (replace the draft lines instead)';
  END IF;
  IF NEW."controlStockAlAprobar" IS DISTINCT FROM OLD."controlStockAlAprobar" OR NEW."subtotalDecimal" IS DISTINCT FROM OLD."subtotalDecimal"
     OR NEW."descuentoLineaDecimal" IS DISTINCT FROM OLD."descuentoLineaDecimal" OR NEW."descuentoGlobalDecimal" IS DISTINCT FROM OLD."descuentoGlobalDecimal"
     OR NEW."netoDecimal" IS DISTINCT FROM OLD."netoDecimal" OR NEW."impuestosDecimal" IS DISTINCT FROM OLD."impuestosDecimal"
     OR NEW."percepcionDecimal" IS DISTINCT FROM OLD."percepcionDecimal" OR NEW."cargosDecimal" IS DISTINCT FROM OLD."cargosDecimal"
     OR NEW."costoInventarioTotalDecimal" IS DISTINCT FROM OLD."costoInventarioTotalDecimal"
     OR NEW."costoUnitarioInventarioDecimal" IS DISTINCT FROM OLD."costoUnitarioInventarioDecimal" THEN
    -- La instantánea se escribe UNA vez, en la transacción de aprobación, antes de cerrar la recepción.
    IF estado_padre NOT IN ('BORRADOR', 'PENDIENTE_APROBACION') OR OLD."costoInventarioTotalDecimal" IS NOT NULL THEN
      RAISE EXCEPTION 'approved costs of a reception line are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recepcion_lineas_guard_trigger" BEFORE INSERT OR UPDATE OR DELETE ON "recepcion_lineas" FOR EACH ROW EXECUTE FUNCTION "guard_recepcion_linea_c2a"();

CREATE FUNCTION "guard_recepcion_cargo_c2a"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND AND COALESCE("f10c2a_estado_recepcion"(OLD."recepcionId", OLD."negocioId"), 'BORRADOR') <> 'BORRADOR' THEN
      RAISE EXCEPTION 'only draft reception charges can be removed';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'reception charges are immutable (replace the draft charges instead)'; END IF;
  IF "f10c2a_estado_recepcion"(NEW."recepcionId", NEW."negocioId") IS DISTINCT FROM 'BORRADOR' THEN
    RAISE EXCEPTION 'charges can only be added to a draft reception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recepcion_cargos_guard_trigger" BEFORE INSERT OR UPDATE OR DELETE ON "recepcion_cargos" FOR EACH ROW EXECUTE FUNCTION "guard_recepcion_cargo_c2a"();

-- ---------------------------------------------------------------------------
-- Eventos (append-only) y borrado: nada cerrado se borra (salvo la cascada del negocio completo)
-- ---------------------------------------------------------------------------
ALTER TABLE "eventos_compra_recepcion"
  ADD CONSTRAINT "eventos_compra_recepcion_tipo_check" CHECK (
    ("tipo" IN ('ENVIO', 'DEVOLUCION_A_BORRADOR', 'APROBACION', 'RECHAZO', 'DESCARTE') AND "recepcionId" IS NOT NULL AND "compraId" IS NULL)
    OR ("tipo" IN ('ANULACION_COMPRA', 'CIERRE_COMPRA') AND "compraId" IS NOT NULL AND "recepcionId" IS NULL)
  ),
  ADD CONSTRAINT "eventos_compra_recepcion_actor_check" CHECK ("actorTipo" IN ('NEGOCIO', 'EMPLEADO')),
  ADD CONSTRAINT "eventos_compra_recepcion_motivo_check" CHECK (
    ("motivo" IS NULL OR length(btrim("motivo")) BETWEEN 1 AND 500)
    AND ("tipo" NOT IN ('RECHAZO', 'ANULACION_COMPRA', 'CIERRE_COMPRA', 'DEVOLUCION_A_BORRADOR') OR "motivo" IS NOT NULL)
  ),
  -- Sólo el dueño aprueba, rechaza, devuelve, anula o cierra.
  ADD CONSTRAINT "eventos_compra_recepcion_dueno_check" CHECK ("tipo" IN ('ENVIO', 'DESCARTE') OR "actorTipo" = 'NEGOCIO');
CREATE UNIQUE INDEX "eventos_compra_recepcion_aprobacion_unica" ON "eventos_compra_recepcion"("recepcionId", "negocioId") WHERE "tipo" = 'APROBACION';

CREATE FUNCTION "guard_append_only_c2a"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF NOT FOUND THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'purchase/reception history is append-only (%)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "eventos_compra_recepcion_guard_trigger" BEFORE UPDATE OR DELETE ON "eventos_compra_recepcion" FOR EACH ROW EXECUTE FUNCTION "guard_append_only_c2a"();

CREATE FUNCTION "guard_delete_compra_recepcion_c2a"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
  IF FOUND THEN RAISE EXCEPTION 'purchases and receptions are never deleted (%)', TG_TABLE_NAME; END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "compras_delete_guard_trigger" BEFORE DELETE ON "compras" FOR EACH ROW EXECUTE FUNCTION "guard_delete_compra_recepcion_c2a"();
CREATE TRIGGER "compra_lineas_delete_guard_trigger" BEFORE DELETE ON "compra_lineas" FOR EACH ROW EXECUTE FUNCTION "guard_delete_compra_recepcion_c2a"();
CREATE TRIGGER "recepciones_delete_guard_trigger" BEFORE DELETE ON "recepciones" FOR EACH ROW EXECUTE FUNCTION "guard_delete_compra_recepcion_c2a"();

-- ---------------------------------------------------------------------------
-- Inventario: una entrada RECEPCION por línea aprobada (índice único ya creado), inmutable
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_movimiento_recepcion_c2a"() RETURNS trigger AS $$
DECLARE
  linea record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."recepcionLineaId" IS NOT NULL AND NEW."recepcionLineaId" IS NOT NULL
       AND (NEW."recepcionLineaId" <> OLD."recepcionLineaId" OR NEW."cantidad" IS DISTINCT FROM OLD."cantidad" OR NEW."tipo" IS DISTINCT FROM OLD."tipo") THEN
      RAISE EXCEPTION 'reception stock entry is immutable';
    END IF;
    IF OLD."recepcionLineaId" IS NULL AND NEW."recepcionLineaId" IS NOT NULL THEN RAISE EXCEPTION 'a stock movement cannot be attached to a reception later'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."recepcionLineaId" IS NULL THEN
    IF NEW."tipo" = 'RECEPCION' THEN RAISE EXCEPTION 'a RECEPCION stock entry requires its reception line'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."tipo" <> 'RECEPCION' THEN RAISE EXCEPTION 'only a RECEPCION movement references a reception line'; END IF;
  SELECT l."negocioId", l."productoId", l."productoVarianteId", l."cantidadAceptadaDecimal", l."recepcionId" INTO linea
    FROM "recepcion_lineas" l WHERE l."id" = NEW."recepcionLineaId";
  IF NOT FOUND OR linea."negocioId" <> NEW."negocioId" OR linea."productoId" IS DISTINCT FROM NEW."productoId"
     OR linea."productoVarianteId" IS DISTINCT FROM NEW."productoVarianteId" THEN
    RAISE EXCEPTION 'reception stock entry must match its line';
  END IF;
  IF linea."cantidadAceptadaDecimal" <= 0 OR round(NEW."cantidad"::numeric, 3) <> linea."cantidadAceptadaDecimal" THEN
    RAISE EXCEPTION 'reception stock entry must equal the accepted quantity';
  END IF;
  IF "f10c2a_estado_recepcion"(linea."recepcionId", linea."negocioId") IS DISTINCT FROM 'APROBADA' THEN
    RAISE EXCEPTION 'stock enters only for an approved reception';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "movimientos_inventario_recepcion_trigger" BEFORE INSERT OR UPDATE ON "movimientos_inventario" FOR EACH ROW EXECUTE FUNCTION "guard_movimiento_recepcion_c2a"();

-- ---------------------------------------------------------------------------
-- Obligaciones de F5 nacidas de una recepción (aditivo sobre F5-A: se amplía su CHECK)
-- ---------------------------------------------------------------------------
ALTER TABLE "obligaciones_proveedor" DROP CONSTRAINT "obligaciones_proveedor_origen_check";
ALTER TABLE "obligaciones_proveedor" DROP CONSTRAINT "obligaciones_proveedor_recepcion_check";
ALTER TABLE "obligaciones_proveedor"
  ADD CONSTRAINT "obligaciones_proveedor_origen_check" CHECK ("origen" IN ('SALDO_INICIAL', 'AJUSTE_DEUDA', 'RECEPCION', 'CARGO_ACCESORIO')),
  ADD CONSTRAINT "obligaciones_proveedor_recepcion_check" CHECK (
    (("origen" = 'RECEPCION') = ("recepcionId" IS NOT NULL))
    AND (("origen" = 'CARGO_ACCESORIO') = ("recepcionCargoId" IS NOT NULL))
  );
CREATE UNIQUE INDEX "obligaciones_proveedor_cargo_unico" ON "obligaciones_proveedor"("negocioId", "recepcionCargoId") WHERE "recepcionCargoId" IS NOT NULL;

CREATE FUNCTION "guard_obligacion_recepcion_c2a"() RETURNS trigger AS $$
DECLARE
  r record;
  c record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."recepcionCargoId" IS DISTINCT FROM OLD."recepcionCargoId" THEN RAISE EXCEPTION 'supplier obligation is immutable'; END IF;
    IF OLD."origen" IN ('RECEPCION', 'CARGO_ACCESORIO') AND NEW."estado" IS DISTINCT FROM OLD."estado" THEN
      RAISE EXCEPTION 'an obligation born from a reception cannot be cancelled (use an adjustment or a supplier return)';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."origen" = 'RECEPCION' THEN
    SELECT "estado", "proveedorId", "totalObligacionDecimal" INTO r FROM "recepciones" WHERE "id" = NEW."recepcionId" AND "negocioId" = NEW."negocioId";
    IF NOT FOUND OR r."estado" <> 'APROBADA' THEN RAISE EXCEPTION 'a reception obligation requires the approved reception'; END IF;
    IF r."proveedorId" <> NEW."proveedorId" OR r."totalObligacionDecimal" <> NEW."importeDecimal" THEN
      RAISE EXCEPTION 'a reception obligation must match its reception';
    END IF;
  ELSIF NEW."origen" = 'CARGO_ACCESORIO' THEN
    SELECT k."proveedorId", k."importeDecimal", k."tipo", rr."estado", rr."proveedorId" AS "proveedorRecepcion" INTO c
      FROM "recepcion_cargos" k JOIN "recepciones" rr ON rr."id" = k."recepcionId" AND rr."negocioId" = k."negocioId"
     WHERE k."id" = NEW."recepcionCargoId" AND k."negocioId" = NEW."negocioId";
    IF NOT FOUND OR c."estado" <> 'APROBADA' THEN RAISE EXCEPTION 'an accessory charge obligation requires the approved reception'; END IF;
    IF c."proveedorId" <> NEW."proveedorId" OR c."importeDecimal" <> NEW."importeDecimal" THEN
      RAISE EXCEPTION 'an accessory charge obligation must match its charge';
    END IF;
    IF c."tipo" = 'ATRIBUIBLE' AND c."proveedorId" = c."proveedorRecepcion" THEN
      RAISE EXCEPTION 'an attributable charge of the same supplier belongs to the reception obligation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "obligaciones_proveedor_recepcion_trigger" BEFORE INSERT OR UPDATE ON "obligaciones_proveedor" FOR EACH ROW EXECUTE FUNCTION "guard_obligacion_recepcion_c2a"();
