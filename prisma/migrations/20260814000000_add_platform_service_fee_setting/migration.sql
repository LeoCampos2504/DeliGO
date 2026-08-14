-- PLATFORM SERVICE FEE — FASE 2B
-- The precondition is deliberately production-safe: only the three
-- deterministic ConfigPlataforma states are accepted.

BEGIN;

DO $$
DECLARE
  total_rows BIGINT;
  empty_key_rows BIGINT;
  platform_rows BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_rows
    FROM "config_plataforma";

  SELECT COUNT(*) INTO empty_key_rows
    FROM "config_plataforma"
   WHERE "clave" = '';

  SELECT COUNT(*) INTO platform_rows
    FROM "config_plataforma"
   WHERE "clave" = 'platform';

  IF NOT (
    total_rows = 0
    OR (total_rows = 1 AND empty_key_rows = 1)
    OR (total_rows = 1 AND platform_rows = 1)
  ) THEN
    RAISE EXCEPTION
      'CONFIG_PLATFORM_NORMALIZATION_AMBIGUOUS total=% empty=% platform=%',
      total_rows, empty_key_rows, platform_rows;
  END IF;
END $$;

ALTER TABLE "config_plataforma"
  ADD COLUMN "tarifaServicio" INTEGER NOT NULL DEFAULT 250;

DO $$
DECLARE
  total_rows BIGINT;
  empty_key_rows BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_rows
    FROM "config_plataforma";

  SELECT COUNT(*) INTO empty_key_rows
    FROM "config_plataforma"
   WHERE "clave" = '';

  IF total_rows = 0 THEN
    INSERT INTO "config_plataforma" (
      "id",
      "clave",
      "valor",
      "promocionadosActivos",
      "updatedAt"
    ) VALUES (
      'cmplatformservicefee00000001',
      'platform',
      '',
      false,
      CURRENT_TIMESTAMP
    );
  ELSIF total_rows = 1 AND empty_key_rows = 1 THEN
    UPDATE "config_plataforma"
       SET "clave" = 'platform';
  END IF;
END $$;

COMMIT;
