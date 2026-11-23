-- Catálogo — importación masiva de productos desde Excel/CSV (operador 2026-11-21). Sólo desarrollo local.
-- ADITIVA: no modifica filas existentes.
--   empleados.catalogoImportar: permiso «Importar productos», deshabilitado por defecto y sujeto a catalogoHasta.
--   importaciones_productos: registro idempotente por confirmación (clave del navegador única por negocio).
--   No toca stock ni inventario (R3A): la importación nunca escribe stockCantidad ni movimientos.

ALTER TABLE "empleados" ADD COLUMN "catalogoImportar" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "importaciones_productos" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "archivo" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'EN_CURSO',
    "totalGrupos" INTEGER NOT NULL DEFAULT 0,
    "resultados" JSONB NOT NULL DEFAULT '{}',
    "resumen" JSONB,
    "bloqueadaHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "importaciones_productos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "importaciones_productos_actor_check" CHECK ("actorTipo" IN ('NEGOCIO', 'EMPLEADO')),
    CONSTRAINT "importaciones_productos_estado_check" CHECK ("estado" IN ('EN_CURSO', 'COMPLETADA'))
);

CREATE UNIQUE INDEX "importaciones_productos_negocioId_clave_key" ON "importaciones_productos"("negocioId", "clave");
CREATE INDEX "importaciones_productos_negocioId_createdAt_idx" ON "importaciones_productos"("negocioId", "createdAt");

ALTER TABLE "importaciones_productos" ADD CONSTRAINT "importaciones_productos_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
