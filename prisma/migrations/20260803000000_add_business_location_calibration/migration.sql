-- P0-B: calibración explícita de la ubicación central del negocio.
--
-- Columna aditiva y nullable, sin default, sobre una tabla existente
-- ("negocios", @@map de Negocio) — no se crean tablas nuevas, no se toca
-- ninguna otra columna, no requiere backfill. Los negocios existentes
-- (incluidos los que ya tienen "lat"/"lng" cargados por otro motivo, p. ej.
-- delivery) quedan con "ubicacionCalibradaEn" = NULL: esas coordenadas no
-- fueron confirmadas deliberadamente para validar pedidos de mesa, y esta
-- migración no las marca como calibradas automáticamente.
--
-- Se completa únicamente cuando una sesión de Negocio confirma la ubicación
-- de forma explícita (acción "Confirmar ubicación del local" / "Recalibrar
-- ubicación", ver src/app/api/negocio/config/route.ts).

ALTER TABLE "negocios" ADD COLUMN "ubicacionCalibradaEn" TIMESTAMP(3);
