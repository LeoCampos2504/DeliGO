-- F10-B2.1 — physical cash registers, cash shifts and financial attribution (additive).
-- New tables cajas_fisicas / turnos_caja, nullable attribution columns on
-- ventas_caja / cuentas_financieras / operaciones_financieras, and the per-business
-- shift-enforcement flag (default OPCIONAL = F10-B1 behaviour unchanged).
-- Nothing existing is rewritten: no UPDATE of historical rows, no DROP, no ALTER COLUMN.

-- AlterTable
ALTER TABLE "negocios" ADD COLUMN     "cajaTurnosModo" TEXT NOT NULL DEFAULT 'OPCIONAL';

-- AlterTable
ALTER TABLE "ventas_caja" ADD COLUMN     "turnoCajaId" TEXT;

-- AlterTable
ALTER TABLE "cuentas_financieras" ADD COLUMN     "cajaFisicaId" TEXT;

-- AlterTable
ALTER TABLE "operaciones_financieras" ADD COLUMN     "turnoCajaId" TEXT;

-- CreateTable
CREATE TABLE "cajas_fisicas" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esPredeterminada" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cajas_fisicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos_caja" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "cajaFisicaId" TEXT NOT NULL,
    "responsableTipo" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "empleadoId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "abiertoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fondoInicialDecimal" DECIMAL(12,2) NOT NULL,
    "idempotencyKey" TEXT,
    "idempotencyFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cajas_fisicas_negocioId_idx" ON "cajas_fisicas"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "cajas_fisicas_id_negocioId_key" ON "cajas_fisicas"("id", "negocioId");

-- CreateIndex
CREATE INDEX "turnos_caja_negocioId_abiertoEn_idx" ON "turnos_caja"("negocioId", "abiertoEn");

-- CreateIndex
CREATE INDEX "turnos_caja_cajaFisicaId_idx" ON "turnos_caja"("cajaFisicaId");

-- CreateIndex
CREATE INDEX "turnos_caja_empleadoId_idx" ON "turnos_caja"("empleadoId");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_caja_negocioId_idempotencyKey_key" ON "turnos_caja"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ventas_caja_turnoCajaId_idx" ON "ventas_caja"("turnoCajaId");

-- CreateIndex
CREATE INDEX "operaciones_financieras_turnoCajaId_idx" ON "operaciones_financieras"("turnoCajaId");

-- AddForeignKey
ALTER TABLE "ventas_caja" ADD CONSTRAINT "ventas_caja_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_financieras" ADD CONSTRAINT "cuentas_financieras_cajaFisicaId_fkey" FOREIGN KEY ("cajaFisicaId") REFERENCES "cajas_fisicas"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_financieras" ADD CONSTRAINT "operaciones_financieras_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas_fisicas" ADD CONSTRAINT "cajas_fisicas_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (the shift and its register always belong to the same business)
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_cajaFisicaId_negocioId_fkey" FOREIGN KEY ("cajaFisicaId", "negocioId") REFERENCES "cajas_fisicas"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Invariants not representable in schema.prisma (Prisma 6.19.2 has no DSL for
-- partial / expression unique indexes or CHECK constraints) — they live here,
-- in the versioned SQL, like sesiones_ocupacion_mesa_mesaId_activa_key.
-- ---------------------------------------------------------------------------

-- Shift-enforcement flag: only the two documented values.
ALTER TABLE "negocios" ADD CONSTRAINT "negocios_cajaTurnosModo_check" CHECK ("cajaTurnosModo" IN ('OPCIONAL', 'OBLIGATORIO'));

-- A default register is always active; names are present and bounded.
ALTER TABLE "cajas_fisicas" ADD CONSTRAINT "cajas_fisicas_predeterminada_activa_check" CHECK (NOT "esPredeterminada" OR "activa");
ALTER TABLE "cajas_fisicas" ADD CONSTRAINT "cajas_fisicas_nombre_check" CHECK (length(btrim("nombre")) BETWEEN 1 AND 60);

-- No two registers of one business with the same name (case/space-insensitive).
CREATE UNIQUE INDEX "cajas_fisicas_negocioId_nombre_ci_key" ON "cajas_fisicas"("negocioId", lower(btrim("nombre")));

-- At most one default register among the active ones of a business.
CREATE UNIQUE INDEX "cajas_fisicas_negocioId_predeterminada_key" ON "cajas_fisicas"("negocioId") WHERE "esPredeterminada" AND "activa";

-- The responsible person is unambiguous: an employee of the shift, or the business owner.
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_responsable_check" CHECK (
  ("responsableTipo" = 'EMPLEADO' AND "empleadoId" IS NOT NULL AND "responsableId" = "empleadoId")
  OR
  ("responsableTipo" = 'NEGOCIO' AND "empleadoId" IS NULL AND "responsableId" = "negocioId")
);

-- Opening cash is never negative.
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_fondoInicial_check" CHECK ("fondoInicialDecimal" >= 0);

-- One open shift per register.
CREATE UNIQUE INDEX "turnos_caja_cajaFisicaId_abierto_key" ON "turnos_caja"("cajaFisicaId") WHERE "estado" = 'ABIERTO';

-- One open shift per employee per business, and one per owner, so every sale maps to a single shift.
CREATE UNIQUE INDEX "turnos_caja_empleado_abierto_key" ON "turnos_caja"("negocioId", "empleadoId") WHERE "estado" = 'ABIERTO' AND "empleadoId" IS NOT NULL;
CREATE UNIQUE INDEX "turnos_caja_negocio_responsable_abierto_key" ON "turnos_caja"("negocioId") WHERE "estado" = 'ABIERTO' AND "responsableTipo" = 'NEGOCIO';

-- One cash account per physical register.
CREATE UNIQUE INDEX "cuentas_financieras_cajaFisicaId_efectivo_key" ON "cuentas_financieras"("cajaFisicaId") WHERE "cajaFisicaId" IS NOT NULL AND "tipo" = 'EFECTIVO';
