-- Catálogo para negocios reales — permisos TEMPORALES de empleados para cargar y editar productos (operador 2026-11-21).
-- Sólo desarrollo local. ADITIVA: columnas nuevas en empleados, todo deshabilitado por defecto. No modifica filas.
--   catalogoHasta: vigencia (NULL = sin permiso; vencido = sin permiso; se verifica en CADA operación del servidor).
--   catalogoCrear / catalogoEditar / catalogoProveedores / catalogoPrecios / catalogoCostos: permisos independientes.
--   Nunca otorgan stock (R3A) ni permisos financieros.

ALTER TABLE "empleados" ADD COLUMN "catalogoHasta" TIMESTAMP(3);
ALTER TABLE "empleados" ADD COLUMN "catalogoCrear" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "empleados" ADD COLUMN "catalogoEditar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "empleados" ADD COLUMN "catalogoProveedores" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "empleados" ADD COLUMN "catalogoPrecios" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "empleados" ADD COLUMN "catalogoCostos" BOOLEAN NOT NULL DEFAULT false;
