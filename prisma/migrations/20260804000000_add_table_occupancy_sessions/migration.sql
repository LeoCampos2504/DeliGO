-- P0-D.1: fundación de sesiones rotativas de ocupación de mesa.
--
-- Puramente aditiva: dos tablas nuevas y dos columnas nullable sobre tablas
-- existentes ("mesas", "pedidos"). Ningún DROP, DELETE, UPDATE ni backfill.
-- Ninguna columna NOT NULL nueva sobre una tabla existente — todas las filas
-- actuales de "mesas" y "pedidos" quedan con las columnas nuevas en NULL, sin
-- ningún cambio de comportamiento hasta que una etapa futura (P0-D.2) empiece
-- a escribirlas.
--
-- El token real de cada credencial nunca se guarda — solo su hash SHA-256
-- ("tokenHash", único), mismo patrón que "sesiones".token,
-- "password_reset_tokens".tokenHash y "sesiones_terminal_salon".tokenHash.

-- CreateTable: ocupación rotativa compartida por una mesa (P0-D.1 solo abre;
-- el cierre/expiración real quedan para P0-D.3, por eso esas columnas son
-- nullable).
CREATE TABLE "sesiones_ocupacion_mesa" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "iniciadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaActividadEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradaEn" TIMESTAMP(3),
    "cerradaPorTipo" TEXT,
    "motivoCierre" TEXT,
    "cerradaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesiones_ocupacion_mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable: autorización opaca de un dispositivo/navegador para una
-- ocupación concreta. Nunca representa una cuenta de usuario.
CREATE TABLE "credenciales_ocupacion_mesa" (
    "id" TEXT NOT NULL,
    "ocupacionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "emitidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaActividadEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credenciales_ocupacion_mesa_pkey" PRIMARY KEY ("id")
);

-- AlterTable: puntero nullable a la ocupación activa. @unique en el schema
-- impide que la misma ocupación sea "la actual" de más de una mesa.
ALTER TABLE "mesas" ADD COLUMN "ocupacionActualId" TEXT;

-- AlterTable: vínculo nullable con la ocupación de mesa. Preparado para
-- P0-D.2 — ningún pedido (histórico ni nuevo de esta etapa) lo escribe todavía.
ALTER TABLE "pedidos" ADD COLUMN "ocupacionMesaId" TEXT;

-- CreateIndex: impide dos ocupaciones activas apuntadas como "actual" por la misma mesa.
CREATE UNIQUE INDEX "mesas_ocupacionActualId_key" ON "mesas"("ocupacionActualId");

-- CreateIndex: un solo uso posible por token real (su hash es único).
CREATE UNIQUE INDEX "credenciales_ocupacion_mesa_tokenHash_key" ON "credenciales_ocupacion_mesa"("tokenHash");

-- CreateIndex: búsquedas por negocio/mesa filtrando por estado (p. ej. "activa").
CREATE INDEX "sesiones_ocupacion_mesa_negocioId_estado_idx" ON "sesiones_ocupacion_mesa"("negocioId", "estado");
CREATE INDEX "sesiones_ocupacion_mesa_mesaId_estado_idx" ON "sesiones_ocupacion_mesa"("mesaId", "estado");

-- CreateIndex (P0-D.1A): índice único PARCIAL — garantiza a nivel de base de
-- datos que una mesa tenga como máximo una fila "activa" en esta tabla.
-- "Mesa.ocupacionActualId" @unique (arriba) NO garantiza esto: esa columna
-- solo impide que la MISMA ocupación sea "la actual" de más de una mesa;
-- nunca limita cuántas filas con estado='activa' puede tener una mesa en
-- sesiones_ocupacion_mesa (el puntero podría estar en NULL, desincronizado,
-- o simplemente no haber sido escrito por una operación manual futura).
-- Deliberadamente NO es "@@unique([mesaId, estado])" en Prisma: eso aplicaría
-- SIEMPRE (para cualquier valor de "estado"), impidiendo tener más de una
-- ocupación "cerrada" o "expirada" histórica para la misma mesa. El WHERE
-- limita la unicidad exclusivamente a las filas activas — cerradas/expiradas
-- quedan sin límite. No representable en "schema.prisma" (Prisma no soporta
-- índices únicos parciales/filtrados en su DSL en ninguna versión actual,
-- incluida 6.19.2) — existe únicamente acá, en el SQL versionado.
CREATE UNIQUE INDEX "sesiones_ocupacion_mesa_mesaId_activa_key" ON "sesiones_ocupacion_mesa"("mesaId") WHERE "estado" = 'activa';

-- CreateIndex: soporte de expiración por inactividad (P0-D.3, todavía no implementada).
CREATE INDEX "sesiones_ocupacion_mesa_ultimaActividadEn_idx" ON "sesiones_ocupacion_mesa"("ultimaActividadEn");

-- CreateIndex: listar/revocar credenciales de una ocupación.
CREATE INDEX "credenciales_ocupacion_mesa_ocupacionId_idx" ON "credenciales_ocupacion_mesa"("ocupacionId");

-- CreateIndex: soporte de consulta futura (P0-D.2) por ocupación desde pedidos.
CREATE INDEX "pedidos_ocupacionMesaId_idx" ON "pedidos"("ocupacionMesaId");

-- AddForeignKey: borrar un negocio arrastra sus ocupaciones (mismo patrón que
-- el resto de las relaciones de Negocio: mesas, empleados, terminales, etc.).
ALTER TABLE "sesiones_ocupacion_mesa" ADD CONSTRAINT "sesiones_ocupacion_mesa_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: una ocupación no tiene identidad propia sin su mesa.
ALTER TABLE "sesiones_ocupacion_mesa" ADD CONSTRAINT "sesiones_ocupacion_mesa_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "mesas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: si la ocupación apuntada se borra, la mesa vuelve a no tener
-- ocupación actual — nunca debe arrastrar el borrado de la mesa.
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_ocupacionActualId_fkey" FOREIGN KEY ("ocupacionActualId") REFERENCES "sesiones_ocupacion_mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: una credencial no tiene ningún significado fuera de su ocupación.
ALTER TABLE "credenciales_ocupacion_mesa" ADD CONSTRAINT "credenciales_ocupacion_mesa_ocupacionId_fkey" FOREIGN KEY ("ocupacionId") REFERENCES "sesiones_ocupacion_mesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: un pedido nunca debe borrarse por borrarse la ocupación que
-- lo vinculaba (mismo patrón que "pedidos_clienteId_fkey" → SET NULL).
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_ocupacionMesaId_fkey" FOREIGN KEY ("ocupacionMesaId") REFERENCES "sesiones_ocupacion_mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
