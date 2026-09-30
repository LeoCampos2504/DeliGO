-- P2-T56-R2C-F2: additive-only — PedidoItem gains an optional reference to
-- ProductoVariante plus a name snapshot, mirroring the existing
-- VentaItem.productoVarianteId / VentaItem.varianteNombre pattern from
-- P2-T56-R2C. No existing column is touched; every existing PedidoItem row
-- keeps productoVarianteId/varianteNombre = NULL and behaves exactly as
-- before.

-- AlterTable
ALTER TABLE "pedido_items" ADD COLUMN     "productoVarianteId" TEXT,
ADD COLUMN     "varianteNombre" TEXT;

-- CreateIndex
CREATE INDEX "pedido_items_productoVarianteId_idx" ON "pedido_items"("productoVarianteId");

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
