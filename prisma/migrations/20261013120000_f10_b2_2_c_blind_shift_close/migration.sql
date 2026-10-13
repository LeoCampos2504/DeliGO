-- F10-B2.2-C — blind declared shift close (additive; no historical rewrites).
ALTER TABLE "cajas_fisicas"
  ADD COLUMN "turnoLockRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "turnos_caja"
  ADD COLUMN "cerradoEn" TIMESTAMP(3),
  ADD COLUMN "efectivoContadoDecimal" DECIMAL(12,2),
  ADD COLUMN "cierreIdempotencyKey" TEXT,
  ADD COLUMN "cierreIdempotencyFingerprint" TEXT;

CREATE UNIQUE INDEX "turnos_caja_negocioId_cierreIdempotencyKey_key"
  ON "turnos_caja"("negocioId", "cierreIdempotencyKey");

ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_conteo_cierre_check" CHECK (
  ("cerradoEn" IS NULL AND "efectivoContadoDecimal" IS NULL)
  OR
  ("cerradoEn" IS NOT NULL AND "efectivoContadoDecimal" IS NOT NULL AND "efectivoContadoDecimal" >= 0)
);
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_estado_cerrado_declarado_check" CHECK (
  "estado" <> 'CERRADO_DECLARADO'
  OR ("cerradoEn" IS NOT NULL AND "efectivoContadoDecimal" IS NOT NULL)
);
