-- P2-T56-R3A-I1: additive-only foundation for the order stock lifecycle
-- (design: codex-reports/P2_T56_R3A_ORDER_STOCK_LIFECYCLE_DESIGN.md, A0.1-7,
-- A0.1-8, A0.1-9, A0.1-17). Creates the empty reservas_stock table, an
-- optional movimientos_inventario.pedidoId reference and
-- config_plataforma.stockReservaModo (default 'OFF' — every existing row gets
-- OFF from the column default, no separate backfill). No existing column,
-- row or constraint is modified or removed. No runtime reads or writes any of
-- these objects until R3A-I2; with stockReservaModo = 'OFF' behavior is
-- identical to before.

-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "pedidoId" TEXT;

-- AlterTable
ALTER TABLE "config_plataforma" ADD COLUMN     "stockReservaModo" TEXT NOT NULL DEFAULT 'OFF';

-- CreateTable
CREATE TABLE "reservas_stock" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "pedidoItemId" TEXT NOT NULL,
    "productoId" TEXT,
    "productoVarianteId" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL,
    "motivoLiberacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumidaEn" TIMESTAMP(3),
    "liberadaEn" TIMESTAMP(3),

    CONSTRAINT "reservas_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservas_stock_negocioId_estado_productoId_productoVariante_idx" ON "reservas_stock"("negocioId", "estado", "productoId", "productoVarianteId");

-- CreateIndex
CREATE INDEX "reservas_stock_negocioId_productoVarianteId_estado_idx" ON "reservas_stock"("negocioId", "productoVarianteId", "estado");

-- CreateIndex
CREATE INDEX "reservas_stock_pedidoId_idx" ON "reservas_stock"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_stock_pedidoItemId_key" ON "reservas_stock"("pedidoItemId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_pedidoId_idx" ON "movimientos_inventario"("pedidoId");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "pedido_items"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_productoVarianteId_fkey" FOREIGN KEY ("productoVarianteId") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
