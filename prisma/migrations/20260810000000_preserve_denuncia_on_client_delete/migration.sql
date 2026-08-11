-- Tarea 19-B0.2C: conservar el expediente de Denuncia al eliminar una cuenta
-- Cliente denunciada. La pseudonimización del nombre (clienteNombre ->
-- "Usuario eliminado") se hace explícitamente en la transacción de
-- aplicación (src/lib/client-account-deletion.ts); esta FK sólo garantiza
-- que un borrado directo de Cliente no destruya la fila Denuncia ni deje un
-- clienteId inválido. No se lee, altera ni borra ningún dato existente.

ALTER TABLE "denuncias" DROP CONSTRAINT "denuncias_clienteId_fkey";

ALTER TABLE "denuncias" ALTER COLUMN "clienteId" DROP NOT NULL;

ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
