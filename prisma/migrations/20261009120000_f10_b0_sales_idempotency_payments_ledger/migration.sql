-- F10-B0 (2026-10-09): additive only. Sale idempotency + actor columns on ventas_caja
-- (all NULLable; historical sales untouched), CobroVenta, and the minimal financial
-- ledger (cuentas/operaciones/movimientos financieros). No data backfill, no drops.

-- AlterTable
ALTER TABLE "ventas_caja" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "actorTipo" TEXT,
ADD COLUMN     "empleadoId" TEXT,
ADD COLUMN     "idempotencyFingerprint" TEXT,
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "cobros_venta" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "estadoConciliacion" TEXT NOT NULL DEFAULT 'NO_APLICA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobros_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_financieras" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_financieras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operaciones_financieras" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "cobroVentaId" TEXT,
    "revierteOperacionId" TEXT,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_financieras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cobros_venta_negocioId_createdAt_idx" ON "cobros_venta"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "cobros_venta_ventaId_idx" ON "cobros_venta"("ventaId");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_financieras_negocioId_clave_key" ON "cuentas_financieras"("negocioId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "operaciones_financieras_cobroVentaId_key" ON "operaciones_financieras"("cobroVentaId");

-- CreateIndex
CREATE UNIQUE INDEX "operaciones_financieras_revierteOperacionId_key" ON "operaciones_financieras"("revierteOperacionId");

-- CreateIndex
CREATE INDEX "operaciones_financieras_negocioId_createdAt_idx" ON "operaciones_financieras"("negocioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "operaciones_financieras_negocioId_idempotencyKey_key" ON "operaciones_financieras"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "movimientos_financieros_cuentaId_createdAt_idx" ON "movimientos_financieros"("cuentaId", "createdAt");

-- CreateIndex
CREATE INDEX "movimientos_financieros_negocioId_createdAt_idx" ON "movimientos_financieros"("negocioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_financieros_operacionId_cuentaId_key" ON "movimientos_financieros"("operacionId", "cuentaId");

-- CreateIndex
CREATE INDEX "ventas_caja_empleadoId_idx" ON "ventas_caja"("empleadoId");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_caja_negocioId_idempotencyKey_key" ON "ventas_caja"("negocioId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ventas_caja" ADD CONSTRAINT "ventas_caja_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_venta" ADD CONSTRAINT "cobros_venta_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros_venta" ADD CONSTRAINT "cobros_venta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_financieras" ADD CONSTRAINT "cuentas_financieras_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_financieras" ADD CONSTRAINT "operaciones_financieras_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_financieras" ADD CONSTRAINT "operaciones_financieras_cobroVentaId_fkey" FOREIGN KEY ("cobroVentaId") REFERENCES "cobros_venta"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_financieras" ADD CONSTRAINT "operaciones_financieras_revierteOperacionId_fkey" FOREIGN KEY ("revierteOperacionId") REFERENCES "operaciones_financieras"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "operaciones_financieras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_financieras"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
