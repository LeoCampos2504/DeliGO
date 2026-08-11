-- 19-B0.2E1: provenance estructurada para Notificacion.
-- Agrega una columna nullable, sin FK, sin backfill. No toca ninguna otra
-- tabla ni fila existente — todas las filas legacy quedan con
-- "sourceClienteId" = NULL (sin cambios de comportamiento hasta que un
-- writer nuevo la complete explícitamente).
--
-- "sourceClienteId" identifica al Cliente cuyos datos (nombre/dirección/texto)
-- pueden estar embebidos en titulo/cuerpo cuando el DESTINATARIO (userId) es
-- otro actor (Negocio/Repartidor). Nunca representa al destinatario. Se deja
-- sin FK a propósito: la limpieza al eliminar una cuenta la gestiona la
-- aplicación (sanitiza el contenido y luego nulifica este campo dentro de la
-- misma transacción), no un onDelete de base de datos.

ALTER TABLE "notificaciones" ADD COLUMN "sourceClienteId" TEXT;

CREATE INDEX "notificaciones_sourceClienteId_idx" ON "notificaciones"("sourceClienteId");
