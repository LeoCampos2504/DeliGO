-- Rediseño de pagos a proveedores — ETAPA 3 (operador 2026-11-20): anticipo en EFECTIVO desde Caja para un pedido.
-- Sólo desarrollo local. ADITIVA: no modifica filas existentes.
--   * El vínculo estructural pago → pedido (creditos_proveedor.compraReferenciaId, etapa 1) admite también PAGO_CAJA
--     (salida PAGO_PROVEEDOR de F10-C1). La clave foránea compuesta (pedido del mismo proveedor y negocio) y la
--     inmutabilidad de la guarda F5-A no cambian.
--   * Permiso INDIVIDUAL de anticipos del empleado, deshabilitado por defecto, con límite por operación y por día:
--     habilitado sólo con ambos límites (> 0) definidos.

ALTER TABLE "creditos_proveedor" DROP CONSTRAINT "creditos_proveedor_compra_check";
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_compra_check" CHECK ("compraReferenciaId" IS NULL OR "origen" IN ('PAGO_DECLARADO', 'PAGO_CAJA'));

ALTER TABLE "empleados" ADD COLUMN "anticipoProveedorHabilitado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "empleados" ADD COLUMN "anticipoProveedorLimiteOperacionDecimal" DECIMAL(12,2);
ALTER TABLE "empleados" ADD COLUMN "anticipoProveedorLimiteDiarioDecimal" DECIMAL(12,2);
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_anticipo_proveedor_check" CHECK (
  ("anticipoProveedorLimiteOperacionDecimal" IS NULL OR "anticipoProveedorLimiteOperacionDecimal" > 0)
  AND ("anticipoProveedorLimiteDiarioDecimal" IS NULL OR "anticipoProveedorLimiteDiarioDecimal" > 0)
  AND (NOT "anticipoProveedorHabilitado" OR ("anticipoProveedorLimiteOperacionDecimal" IS NOT NULL AND "anticipoProveedorLimiteDiarioDecimal" IS NOT NULL))
);
