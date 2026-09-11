-- P2-T46-R1: additive payment authority for one table occupation.
-- No backfill: historical and legacy occupations remain nullable.
ALTER TABLE "sesiones_ocupacion_mesa"
  ADD COLUMN "metodoPago" TEXT,
  ADD COLUMN "pagoConfirmadoEn" TIMESTAMP(3),
  ADD COLUMN "pagoConfirmadoPorTipo" TEXT,
  ADD COLUMN "pagoConfirmadoPorId" TEXT;
