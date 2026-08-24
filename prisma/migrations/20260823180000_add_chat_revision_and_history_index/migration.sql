-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "chatRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "chat_mensajes_pedidoId_fecha_idx" ON "chat_mensajes"("pedidoId", "fecha");
