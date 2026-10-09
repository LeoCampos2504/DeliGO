-- F10-B2.0 — exact money columns (additive). NUMERIC(12,2), nullable.
-- The legacy Float columns stay untouched and keep being written (dual write)
-- by the single Caja engine; the new columns hold the exact cents amount.

-- AlterTable
ALTER TABLE "ventas_caja" ADD COLUMN     "totalDecimal" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "cobros_venta" ADD COLUMN     "importeDecimal" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "movimientos_financieros" ADD COLUMN     "importeDecimal" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "venta_items" ADD COLUMN     "subtotalDecimal" DECIMAL(12,2);

-- Backfill of historical rows: deterministic ROUND(x::numeric, 2) of the stored
-- Float (the quantization point of old values). Only fills NULLs, never
-- changes the Float columns. Values that do not fit NUMERIC(12,2) (or NaN /
-- Infinity) are left NULL on purpose, to be reported, never corrected silently.
UPDATE "ventas_caja" SET "totalDecimal" = ROUND("total"::numeric, 2)
WHERE "totalDecimal" IS NULL AND abs("total") < 9999999999.995;

UPDATE "venta_items" SET "subtotalDecimal" = ROUND("subtotal"::numeric, 2)
WHERE "subtotalDecimal" IS NULL AND abs("subtotal") < 9999999999.995;

UPDATE "cobros_venta" SET "importeDecimal" = ROUND("importe"::numeric, 2)
WHERE "importeDecimal" IS NULL AND abs("importe") < 9999999999.995;

UPDATE "movimientos_financieros" SET "importeDecimal" = ROUND("importe"::numeric, 2)
WHERE "importeDecimal" IS NULL AND abs("importe") < 9999999999.995;
