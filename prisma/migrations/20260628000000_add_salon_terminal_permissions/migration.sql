-- Forward-only additive migration: completa el scaffolding de terminales de salón.
-- Agrega perfil/scopes (autorización) a las terminales y vincula los emparejamientos
-- a una terminal específica. No borra columnas, tablas ni datos.
-- Las columnas NOT NULL llevan DEFAULT, por lo que las filas existentes quedan
-- compatibles sin necesidad de backfill.

-- AlterTable: TerminalSalon → perfil (etiqueta/preset UI) + scopes (fuente de verdad, JSON array)
ALTER TABLE "terminales_salon"
  ADD COLUMN "perfil" TEXT NOT NULL DEFAULT 'pantalla',
  ADD COLUMN "scopes" TEXT NOT NULL DEFAULT '[]';

-- AlterTable: VinculacionTerminalSalon → relación opcional hacia una terminal.
-- Nullable a propósito: no asumimos que la tabla esté vacía y evitamos un backfill.
ALTER TABLE "vinculaciones_terminal_salon"
  ADD COLUMN "terminalSalonId" TEXT;

-- CreateIndex: consultar emparejamientos por terminal
CREATE INDEX "vinculaciones_terminal_salon_terminalSalonId_idx"
  ON "vinculaciones_terminal_salon"("terminalSalonId");

-- AddForeignKey: borrar una terminal arrastra sus emparejamientos históricos.
-- PostgreSQL ignora la cascada para filas con terminalSalonId NULL (preexistentes).
ALTER TABLE "vinculaciones_terminal_salon"
  ADD CONSTRAINT "vinculaciones_terminal_salon_terminalSalonId_fkey"
  FOREIGN KEY ("terminalSalonId") REFERENCES "terminales_salon"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
