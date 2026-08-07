-- Tarea 19-B0.1: conservar reseñas y expedientes al eliminar una cuenta Cliente.
-- La anonimización del nombre se hace explícitamente en la transacción de aplicación;
-- esta FK solo garantiza que un borrado directo no conserve un clienteId inválido.

ALTER TABLE "resenas" DROP CONSTRAINT "resenas_clienteId_fkey";

ALTER TABLE "resenas" ALTER COLUMN "clienteId" DROP NOT NULL;

ALTER TABLE "resenas" ADD CONSTRAINT "resenas_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
