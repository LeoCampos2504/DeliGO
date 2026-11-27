-- T7-F1 — Retiros personales de mercadería desde Caja (operador, 2026-11-27).
-- Diseño: codex-reports/T7_F1_RETIROS_PERSONALES_DISENO.md.
-- ADITIVA: una columna con DEFAULT false en empleados (nadie queda habilitado), dos columnas NULL en
-- movimientos_inventario y siete tablas nuevas vacías. Sin backfill, sin cambios en datos existentes, sin DROP.
-- Un retiro NO es una venta ni un movimiento de dinero: ninguna tabla financiera se toca.

-- AlterTable
ALTER TABLE "empleados" ADD COLUMN     "retiroPersonalHabilitado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "devolucionRetiroId" TEXT,
ADD COLUMN     "retiroPersonalId" TEXT;

-- CreateTable
CREATE TABLE "familiares_retiro" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorTipo" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "familiares_retiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retiros_personales" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "beneficiarioTipo" TEXT NOT NULL,
    "beneficiarioEmpleadoId" TEXT,
    "beneficiarioFamiliarId" TEXT,
    "beneficiarioNombre" TEXT NOT NULL,
    "registradoPorTipo" TEXT NOT NULL,
    "registradoPorEmpleadoId" TEXT,
    "registradoPorNombre" TEXT NOT NULL,
    "turnoCajaId" TEXT,
    "valorComercialDecimal" DECIMAL(12,2) NOT NULL,
    "costoConocidoDecimal" DECIMAL(12,2) NOT NULL,
    "costoCompleto" BOOLEAN NOT NULL,
    "cantidadLineas" INTEGER NOT NULL,
    "observaciones" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retiros_personales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retiro_personal_lineas" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "retiroId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT,
    "productoVarianteId" TEXT,
    "nombre" TEXT NOT NULL,
    "varianteNombre" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitarioDecimal" DECIMAL(12,2) NOT NULL,
    "subtotalDecimal" DECIMAL(12,2) NOT NULL,
    "costoUnitarioDecimal" DECIMAL(14,4),
    "costoTotalDecimal" DECIMAL(12,2),
    "movioStock" BOOLEAN NOT NULL,

    CONSTRAINT "retiro_personal_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_retiro" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "retiroId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "registradoPorNombre" TEXT NOT NULL,
    "valorDecimal" DECIMAL(12,2) NOT NULL,
    "costoConocidoDecimal" DECIMAL(12,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_retiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_retiro_lineas" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "retiroLineaId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "valorDecimal" DECIMAL(12,2) NOT NULL,
    "costoDecimal" DECIMAL(12,2),
    "reingresoStock" BOOLEAN NOT NULL,

    CONSTRAINT "devolucion_retiro_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisiones_recupero_retiro" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "importeRecuperarDecimal" DECIMAL(12,2) NOT NULL,
    "valorElegibleDecimal" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT,
    "decididoPorNombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
    "reemplazaDecisionId" TEXT,
    "finalizadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisiones_recupero_retiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_recupero_retiro_items" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "retiroId" TEXT NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "elegibleAlDecidirDecimal" DECIMAL(12,2) NOT NULL,
    "asignadoDecimal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "decision_recupero_retiro_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "familiares_retiro_negocioId_nombreNormalizado_key" ON "familiares_retiro"("negocioId", "nombreNormalizado");

-- CreateIndex
CREATE INDEX "retiros_personales_negocioId_createdAt_idx" ON "retiros_personales"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "retiros_personales_negocioId_beneficiarioTipo_createdAt_idx" ON "retiros_personales"("negocioId", "beneficiarioTipo", "createdAt");

-- CreateIndex
CREATE INDEX "retiros_personales_beneficiarioEmpleadoId_idx" ON "retiros_personales"("beneficiarioEmpleadoId");

-- CreateIndex
CREATE INDEX "retiros_personales_beneficiarioFamiliarId_idx" ON "retiros_personales"("beneficiarioFamiliarId");

-- CreateIndex
CREATE UNIQUE INDEX "retiros_personales_negocioId_idempotencyKey_key" ON "retiros_personales"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "retiro_personal_lineas_retiroId_orden_key" ON "retiro_personal_lineas"("retiroId", "orden");

-- CreateIndex
CREATE INDEX "devoluciones_retiro_retiroId_idx" ON "devoluciones_retiro"("retiroId");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_retiro_negocioId_idempotencyKey_key" ON "devoluciones_retiro"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "devolucion_retiro_lineas_retiroLineaId_idx" ON "devolucion_retiro_lineas"("retiroLineaId");

-- CreateIndex
CREATE UNIQUE INDEX "devolucion_retiro_lineas_devolucionId_retiroLineaId_key" ON "devolucion_retiro_lineas"("devolucionId", "retiroLineaId");

-- CreateIndex
CREATE INDEX "decisiones_recupero_retiro_negocioId_empleadoId_createdAt_idx" ON "decisiones_recupero_retiro"("negocioId", "empleadoId", "createdAt");

-- CreateIndex
CREATE INDEX "decision_recupero_retiro_items_retiroId_idx" ON "decision_recupero_retiro_items"("retiroId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_recupero_retiro_items_decisionId_retiroId_key" ON "decision_recupero_retiro_items"("decisionId", "retiroId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_retiroPersonalId_idx" ON "movimientos_inventario"("retiroPersonalId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_devolucionRetiroId_idx" ON "movimientos_inventario"("devolucionRetiroId");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_retiroPersonalId_fkey" FOREIGN KEY ("retiroPersonalId") REFERENCES "retiros_personales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_devolucionRetiroId_fkey" FOREIGN KEY ("devolucionRetiroId") REFERENCES "devoluciones_retiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "familiares_retiro" ADD CONSTRAINT "familiares_retiro_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_personales" ADD CONSTRAINT "retiros_personales_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_personales" ADD CONSTRAINT "retiros_personales_beneficiarioEmpleadoId_fkey" FOREIGN KEY ("beneficiarioEmpleadoId") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_personales" ADD CONSTRAINT "retiros_personales_beneficiarioFamiliarId_fkey" FOREIGN KEY ("beneficiarioFamiliarId") REFERENCES "familiares_retiro"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_personales" ADD CONSTRAINT "retiros_personales_registradoPorEmpleadoId_fkey" FOREIGN KEY ("registradoPorEmpleadoId") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros_personales" ADD CONSTRAINT "retiros_personales_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiro_personal_lineas" ADD CONSTRAINT "retiro_personal_lineas_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiro_personal_lineas" ADD CONSTRAINT "retiro_personal_lineas_retiroId_fkey" FOREIGN KEY ("retiroId") REFERENCES "retiros_personales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiro_personal_lineas" ADD CONSTRAINT "retiro_personal_lineas_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiro_personal_lineas" ADD CONSTRAINT "retiro_personal_lineas_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_retiro" ADD CONSTRAINT "devoluciones_retiro_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_retiro" ADD CONSTRAINT "devoluciones_retiro_retiroId_fkey" FOREIGN KEY ("retiroId") REFERENCES "retiros_personales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_retiro_lineas" ADD CONSTRAINT "devolucion_retiro_lineas_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_retiro_lineas" ADD CONSTRAINT "devolucion_retiro_lineas_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_retiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_retiro_lineas" ADD CONSTRAINT "devolucion_retiro_lineas_retiroLineaId_fkey" FOREIGN KEY ("retiroLineaId") REFERENCES "retiro_personal_lineas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisiones_recupero_retiro" ADD CONSTRAINT "decisiones_recupero_retiro_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisiones_recupero_retiro" ADD CONSTRAINT "decisiones_recupero_retiro_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisiones_recupero_retiro" ADD CONSTRAINT "decisiones_recupero_retiro_reemplazaDecisionId_fkey" FOREIGN KEY ("reemplazaDecisionId") REFERENCES "decisiones_recupero_retiro"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_recupero_retiro_items" ADD CONSTRAINT "decision_recupero_retiro_items_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_recupero_retiro_items" ADD CONSTRAINT "decision_recupero_retiro_items_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decisiones_recupero_retiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_recupero_retiro_items" ADD CONSTRAINT "decision_recupero_retiro_items_retiroId_fkey" FOREIGN KEY ("retiroId") REFERENCES "retiros_personales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Invariantes en SQL (defensa en profundidad; el servicio ya las valida en una transacción Serializable)
-- ---------------------------------------------------------------------------

ALTER TABLE "familiares_retiro" ADD CONSTRAINT "familiares_retiro_nombre_chk"
  CHECK (length(btrim("nombre")) > 0 AND length(btrim("nombreNormalizado")) > 0 AND "creadoPorTipo" IN ('NEGOCIO', 'EMPLEADO'));

ALTER TABLE "retiros_personales" ADD CONSTRAINT "retiros_personales_beneficiario_chk" CHECK (
  ("beneficiarioTipo" = 'EMPLEADO' AND "beneficiarioEmpleadoId" IS NOT NULL AND "beneficiarioFamiliarId" IS NULL)
  OR ("beneficiarioTipo" = 'FAMILIAR' AND "beneficiarioFamiliarId" IS NOT NULL AND "beneficiarioEmpleadoId" IS NULL)
  OR ("beneficiarioTipo" = 'DUENO' AND "beneficiarioEmpleadoId" IS NULL AND "beneficiarioFamiliarId" IS NULL)
);
ALTER TABLE "retiros_personales" ADD CONSTRAINT "retiros_personales_registrante_chk" CHECK (
  ("registradoPorTipo" = 'NEGOCIO' AND "registradoPorEmpleadoId" IS NULL)
  OR ("registradoPorTipo" = 'EMPLEADO' AND "registradoPorEmpleadoId" IS NOT NULL)
);
ALTER TABLE "retiros_personales" ADD CONSTRAINT "retiros_personales_valores_chk" CHECK (
  "valorComercialDecimal" >= 0 AND "costoConocidoDecimal" >= 0 AND "cantidadLineas" > 0
  AND "estado" IN ('VIGENTE', 'ANULADO')
  AND length(btrim("beneficiarioNombre")) > 0 AND length(btrim("registradoPorNombre")) > 0
);

ALTER TABLE "retiro_personal_lineas" ADD CONSTRAINT "retiro_personal_lineas_valores_chk" CHECK (
  "cantidad" > 0 AND "precioUnitarioDecimal" >= 0 AND "subtotalDecimal" >= 0
  AND ("costoUnitarioDecimal" IS NULL) = ("costoTotalDecimal" IS NULL)
  AND ("costoUnitarioDecimal" IS NULL OR ("costoUnitarioDecimal" >= 0 AND "costoTotalDecimal" >= 0))
);

ALTER TABLE "devoluciones_retiro" ADD CONSTRAINT "devoluciones_retiro_chk" CHECK (
  "tipo" IN ('ANULACION', 'DEVOLUCION') AND length(btrim("motivo")) > 0
  AND "valorDecimal" >= 0 AND "costoConocidoDecimal" >= 0
);
ALTER TABLE "devolucion_retiro_lineas" ADD CONSTRAINT "devolucion_retiro_lineas_chk" CHECK (
  "cantidad" > 0 AND "valorDecimal" >= 0 AND ("costoDecimal" IS NULL OR "costoDecimal" >= 0)
);

ALTER TABLE "decisiones_recupero_retiro" ADD CONSTRAINT "decisiones_recupero_retiro_chk" CHECK (
  "estado" IN ('VIGENTE', 'REEMPLAZADA', 'ANULADA')
  AND "importeRecuperarDecimal" >= 0 AND "importeRecuperarDecimal" <= "valorElegibleDecimal"
  AND (("estado" = 'VIGENTE') = ("finalizadaEn" IS NULL))
);
ALTER TABLE "decision_recupero_retiro_items" ADD CONSTRAINT "decision_recupero_retiro_items_chk" CHECK (
  "asignadoDecimal" >= 0 AND "asignadoDecimal" <= "elegibleAlDecidirDecimal"
);
-- Un retiro pertenece a UNA sola decisión vigente (prevención de recuperaciones duplicadas).
CREATE UNIQUE INDEX "decision_recupero_retiro_items_vigente_key" ON "decision_recupero_retiro_items"("retiroId") WHERE "vigente";

-- El origen de un movimiento de inventario es inequívoco.
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_retiro_origen_chk" CHECK (
  ("retiroPersonalId" IS NULL OR "tipo" = 'RETIRO_PERSONAL')
  AND ("devolucionRetiroId" IS NULL OR "tipo" = 'RETIRO_PERSONAL_REINGRESO')
);

-- Lo devuelto/anulado de una línea nunca supera lo retirado (cuenta todas las devoluciones de la línea).
CREATE FUNCTION "t7_f1_devolucion_retiro_linea_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  retirado DOUBLE PRECISION;
  devuelto DOUBLE PRECISION;
BEGIN
  SELECT "cantidad" INTO retirado FROM "retiro_personal_lineas" WHERE "id" = NEW."retiroLineaId" AND "negocioId" = NEW."negocioId";
  IF retirado IS NULL THEN
    RAISE EXCEPTION 'T7_F1_DEVOLUCION_LINEA_AJENA' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM("cantidad"), 0) INTO devuelto FROM "devolucion_retiro_lineas" WHERE "retiroLineaId" = NEW."retiroLineaId";
  IF devuelto > retirado + 1e-9 THEN
    RAISE EXCEPTION 'T7_F1_DEVOLUCION_EXCEDE_RETIRADO' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER "t7_f1_devolucion_retiro_linea_guard" AFTER INSERT OR UPDATE ON "devolucion_retiro_lineas"
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "t7_f1_devolucion_retiro_linea_guard"();
