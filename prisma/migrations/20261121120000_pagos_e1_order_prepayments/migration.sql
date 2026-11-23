-- Rediseño de pagos a proveedores — ETAPA 1 (operador 2026-11-20): transferencia anticipada desde un pedido.
-- Sólo desarrollo local. Habilita la columna RESERVADA desde F5-A `creditos_proveedor.compraReferenciaId` (hasta hoy
-- forzada a NULL por CHECK) como vínculo estructural del pago con su pedido. No modifica filas existentes: todas
-- tienen NULL. La guarda F5-A ya impide cambiar la columna después de creada (inmutable).
--   * sólo pagos declarados (transferencia) en esta etapa;
--   * clave foránea compuesta: el pedido es del MISMO proveedor y negocio que el pago (sin cruces).

ALTER TABLE "creditos_proveedor" DROP CONSTRAINT "creditos_proveedor_compra_check";
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_compra_check" CHECK ("compraReferenciaId" IS NULL OR "origen" = 'PAGO_DECLARADO');
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_compraReferenciaId_proveedorId_negocioId_fkey"
  FOREIGN KEY ("compraReferenciaId", "proveedorId", "negocioId") REFERENCES "compras"("id", "proveedorId", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE INDEX "creditos_proveedor_compraReferenciaId_idx" ON "creditos_proveedor"("compraReferenciaId");
