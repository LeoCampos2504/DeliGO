-- P2-T56-R1: additive Inventario (numeric stock on Producto) + Caja (Venta /
-- VentaItem / MovimientoInventario). No backfill needed: every existing
-- Producto row gets controlStock=false / stockCantidad=0, which is a no-op
-- for Restaurante/Ropa (they never read these columns). No existing table
-- is altered destructively, no column dropped, no data rewritten.
-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "codigoBarras" TEXT,
ADD COLUMN     "controlStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "costo" DOUBLE PRECISION,
ADD COLUMN     "marca" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "stockCantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "stockMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unidadMedida" TEXT NOT NULL DEFAULT 'unidad';

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "stockAntes" DOUBLE PRECISION NOT NULL,
    "stockDespues" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "ventaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_caja" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "cantidadItems" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_inventario_negocioId_productoId_createdAt_idx" ON "movimientos_inventario"("negocioId", "productoId", "createdAt");

-- CreateIndex
CREATE INDEX "movimientos_inventario_ventaId_idx" ON "movimientos_inventario"("ventaId");

-- CreateIndex
CREATE INDEX "ventas_caja_negocioId_createdAt_idx" ON "ventas_caja"("negocioId", "createdAt");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_caja" ADD CONSTRAINT "ventas_caja_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
