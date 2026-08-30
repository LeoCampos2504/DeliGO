-- BUSINESS-HOURS-TIMEZONE-FIX-R1: expand-only additive field.
-- Existing HH:MM values remain local business wall-clock values; no horarios
-- JSON is rewritten. The default makes existing and new businesses valid.
ALTER TABLE "negocios"
ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';
