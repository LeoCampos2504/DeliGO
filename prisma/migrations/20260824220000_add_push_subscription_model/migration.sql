-- P2-T05 (F-P0-03): expand-only. Tabla normalizada de subscriptions push
-- multi-dispositivo. No borra, altera ni migra ninguna columna/dato legacy
-- existente (Cliente/Negocio/Repartidor/Empleado/SuperAdmin/TerminalOperativa
-- conservan sus campos `pushSubscription*` intactos). Sin backfill.
--
-- P2-T05 Stage1C (F-P2-T05-03): el UNIQUE de abajo es exclusivamente
-- (ownerType, ownerId, channel, endpoint) — deliberadamente NO existe ningun
-- unique global ni parcial sobre "endpoint" solo, y NO existe ninguna tabla
-- de cuarentena. Ver prisma/schema.prisma para la justificacion completa.

CREATE TYPE "PushSubscriptionOwnerType" AS ENUM ('cliente', 'negocio', 'repartidor', 'empleado');
CREATE TYPE "PushSubscriptionChannel" AS ENUM ('default', 'salon');

CREATE TABLE "push_subscriptions" (
  "id" TEXT NOT NULL,
  "ownerType" "PushSubscriptionOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "channel" "PushSubscriptionChannel" NOT NULL DEFAULT 'default',
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "expirationTime" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_ownerType_ownerId_channel_endpoint_key" ON "push_subscriptions"("ownerType", "ownerId", "channel", "endpoint");
CREATE INDEX "push_subscriptions_ownerType_ownerId_channel_idx" ON "push_subscriptions"("ownerType", "ownerId", "channel");
CREATE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions"("endpoint");
