-- P2-T56-R2C: additive product variants (ProductoVariante). No existing
-- table/column is altered destructively, no column dropped, no data
-- rewritten. Every existing Producto/VentaItem/MovimientoInventario row is
-- unaffected — productoVarianteId/varianteNombre are nullable and default to
-- NULL, which is a no-op for every row created before this migration
-- (Restaurante/Ropa/existing generic-business products never read these
-- columns and continue to use Producto's own precio/costo/stockCantidad as
-- before).
-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "productoVarianteId" TEXT;

-- AlterTable
ALTER TABLE "venta_items" ADD COLUMN     "productoVarianteId" TEXT,
ADD COLUMN     "varianteNombre" TEXT;

-- CreateTable
CREATE TABLE "producto_variantes" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "costo" DOUBLE PRECISION,
    "sku" TEXT,
    "codigoBarras" TEXT,
    "controlStock" BOOLEAN NOT NULL DEFAULT false,
    "stockCantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producto_variantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "producto_variantes_productoId_idx" ON "producto_variantes"("productoId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_productoVarianteId_idx" ON "movimientos_inventario"("productoVarianteId");

-- AddForeignKey
ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
