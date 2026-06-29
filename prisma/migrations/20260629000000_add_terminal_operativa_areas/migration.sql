-- Forward-only additive migration: agrega `areas` (áreas permitidas) a las terminales
-- operativas. El renombre de modelos Prisma (TerminalSalon -> TerminalOperativa, etc.)
-- es solo lógico: las tablas y columnas físicas se conservan vía @@map/@map, por lo que
-- NO genera cambios de SQL ni renombres de tablas/columnas/índices/constraints.
-- La columna NOT NULL lleva DEFAULT, así las filas existentes quedan compatibles sin backfill.

-- AlterTable: TerminalOperativa (tabla física "terminales_salon") → areas (JSON array)
ALTER TABLE "terminales_salon"
  ADD COLUMN "areas" TEXT NOT NULL DEFAULT '[]';

-- Defaults coherentes con "Terminal Operativa": una terminal nueva nace "pendiente"
-- hasta su futura activación. SET DEFAULT solo afecta inserts futuros; NO actualiza
-- filas existentes ni renombra columnas/constraints.
ALTER TABLE "terminales_salon"
  ALTER COLUMN "nombre" SET DEFAULT 'Terminal Operativa',
  ALTER COLUMN "estado" SET DEFAULT 'pendiente';
