-- Forward-only Testing migration for persistent idempotency of manual mozo orders.
-- Adds nullable columns so existing pedidos do not need a backfill.
ALTER TABLE "pedidos"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "idempotencyFingerprint" TEXT;

-- PostgreSQL allows multiple NULL values in a unique index, so historical
-- pedidos and non-idempotent flows remain compatible.
CREATE UNIQUE INDEX "pedidos_negocioId_idempotencyKey_key"
  ON "pedidos"("negocioId", "idempotencyKey");
