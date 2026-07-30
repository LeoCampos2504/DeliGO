-- Seguridad-3B: persistent uniqueness guard for denuncias tied to a real pedido.
--
-- "pedidoId" is optional in prisma/schema.prisma (Denuncia.pedidoId String?), so this
-- is NOT represented as `@@unique` in the Prisma schema (Prisma cannot express a
-- partial unique index in the schema DSL, and a plain `@@unique` would still be
-- correct here only by relying on Postgres's NULL-distinctness — this migration makes
-- the intent explicit with a partial index instead).
--
-- PostgreSQL never considers NULL equal to NULL, so a plain composite unique index
-- would already let historical denuncias without pedidoId (NULL) coexist freely.
-- The WHERE clause below makes that intent explicit and future-proof: only rows that
-- cite a real pedido are protected by the uniqueness guarantee. No historical row is
-- read, altered, or deleted by this migration.
CREATE UNIQUE INDEX "denuncias_clienteId_negocioId_pedidoId_key"
ON "denuncias" ("clienteId", "negocioId", "pedidoId")
WHERE "pedidoId" IS NOT NULL;
