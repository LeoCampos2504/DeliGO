-- T20-DK1: capacidad de Retiro independiente de Delivery.
-- Aditiva y mínima: agrega una única columna con default true, que conserva
-- el comportamiento actual de todos los negocios existentes (retiro estaba
-- siempre disponible antes de este campo). No toca ninguna otra columna.
ALTER TABLE "negocios" ADD COLUMN "ofreceRetiro" BOOLEAN NOT NULL DEFAULT true;
