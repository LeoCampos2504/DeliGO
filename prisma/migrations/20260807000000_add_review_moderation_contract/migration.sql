-- Tarea 19-A: contrato aditivo de moderación de reseñas.
-- No hay operaciones destructivas, backfill destructivo ni cambio de caches.
-- Las reseñas históricas reciben el default PUBLICADA y conservan sus datos.

CREATE TYPE "EstadoModeracionResena" AS ENUM (
  'PUBLICADA', 'OCULTA_EN_REVISION', 'ELIMINADA_POR_MODERACION'
);
CREATE TYPE "EstadoSolicitudRevisionResena" AS ENUM (
  'PENDIENTE', 'EN_REVISION', 'REQUIERE_INFORMACION', 'APROBADA', 'RECHAZADA', 'RESTAURADA_AUTOMATICAMENTE'
);
CREATE TYPE "MotivoSolicitudRevisionResena" AS ENUM (
  'FALSA', 'ILEGAL', 'OFENSIVA', 'DISCRIMINATORIA', 'OTRA_INFRACCION'
);
CREATE TYPE "TipoEventoSolicitudRevisionResena" AS ENUM (
  'SOLICITUD_CREADA', 'TOMADA_EN_REVISION', 'INFORMACION_REQUERIDA', 'INFORMACION_APORTADA',
  'APROBADA', 'RECHAZADA', 'RESTAURADA_AUTOMATICAMENTE'
);
CREATE TYPE "ActorSolicitudRevisionResena" AS ENUM ('NEGOCIO', 'SUPERADMIN', 'SISTEMA');

ALTER TABLE "resenas"
  ADD COLUMN "estadoModeracion" "EstadoModeracionResena" NOT NULL DEFAULT 'PUBLICADA',
  ADD COLUMN "moderadaEn" TIMESTAMP(3);

-- Soporta la FK compuesta que impide resenaId de un negocio + negocioId de otro.
CREATE UNIQUE INDEX "resenas_id_negocioId_key" ON "resenas"("id", "negocioId");

CREATE TABLE "solicitudes_revision_resena" (
  "id" TEXT NOT NULL,
  "resenaId" TEXT NOT NULL,
  "negocioId" TEXT NOT NULL,
  "motivo" "MotivoSolicitudRevisionResena" NOT NULL,
  "explicacionOriginal" TEXT NOT NULL,
  "estado" "EstadoSolicitudRevisionResena" NOT NULL DEFAULT 'PENDIENTE',
  "activeKey" TEXT,
  "venceEn" TIMESTAMP(3) NOT NULL,
  "resueltaEn" TIMESTAMP(3),
  "revisadaPorSuperadminId" TEXT,
  "motivoDecision" TEXT,
  "prorrogaInformacionUsada" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "solicitudes_revision_resena_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "solicitudes_revision_resena_activeKey_estado_check" CHECK (
    (("estado" IN ('PENDIENTE', 'EN_REVISION', 'REQUIERE_INFORMACION')) AND "activeKey" = "resenaId")
    OR
    (("estado" IN ('APROBADA', 'RECHAZADA', 'RESTAURADA_AUTOMATICAMENTE')) AND "activeKey" IS NULL)
  )
);

CREATE TABLE "solicitudes_revision_resena_eventos" (
  "id" TEXT NOT NULL,
  "solicitudId" TEXT NOT NULL,
  "tipo" "TipoEventoSolicitudRevisionResena" NOT NULL,
  "actorTipo" "ActorSolicitudRevisionResena" NOT NULL,
  "actorId" TEXT,
  "mensaje" TEXT,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "solicitudes_revision_resena_eventos_pkey" PRIMARY KEY ("id")
);

-- Metadata privada preparada para 19-F; no URL pública, contenido ni path local.
CREATE TABLE "evidencias_solicitud_revision_resena" (
  "id" TEXT NOT NULL,
  "solicitudId" TEXT NOT NULL,
  "eventoId" TEXT,
  "uploaderTipo" "ActorSolicitudRevisionResena" NOT NULL,
  "uploaderId" TEXT,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "nombrePresentacion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidencias_solicitud_revision_resena_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitudes_revision_resena_activeKey_key" ON "solicitudes_revision_resena"("activeKey");
CREATE INDEX "solicitudes_revision_resena_negocioId_estado_createdAt_idx" ON "solicitudes_revision_resena"("negocioId", "estado", "createdAt");
CREATE INDEX "solicitudes_revision_resena_estado_venceEn_idx" ON "solicitudes_revision_resena"("estado", "venceEn");
CREATE INDEX "solicitudes_revision_resena_resenaId_createdAt_idx" ON "solicitudes_revision_resena"("resenaId", "createdAt");
CREATE INDEX "solicitudes_revision_resena_eventos_solicitudId_createdAt_idx" ON "solicitudes_revision_resena_eventos"("solicitudId", "createdAt");
CREATE UNIQUE INDEX "evidencias_solicitud_revision_resena_storageKey_key" ON "evidencias_solicitud_revision_resena"("storageKey");
CREATE INDEX "evidencias_solicitud_revision_resena_solicitudId_createdAt_idx" ON "evidencias_solicitud_revision_resena"("solicitudId", "createdAt");

-- RESTRICT conserva el expediente. El borrado legacy de cuenta de cliente sigue
-- funcionando con cero solicitudes; cuando existan, debe rediseñarse antes de
-- habilitar moderación real para no intentar borrar físicamente una reseña vinculada.
ALTER TABLE "solicitudes_revision_resena"
  ADD CONSTRAINT "solicitudes_revision_resena_resenaId_negocioId_fkey"
  FOREIGN KEY ("resenaId", "negocioId") REFERENCES "resenas"("id", "negocioId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitudes_revision_resena"
  ADD CONSTRAINT "solicitudes_revision_resena_negocioId_fkey"
  FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitudes_revision_resena"
  ADD CONSTRAINT "solicitudes_revision_resena_revisadaPorSuperadminId_fkey"
  FOREIGN KEY ("revisadaPorSuperadminId") REFERENCES "super_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitudes_revision_resena_eventos"
  ADD CONSTRAINT "solicitudes_revision_resena_eventos_solicitudId_fkey"
  FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_revision_resena"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidencias_solicitud_revision_resena"
  ADD CONSTRAINT "evidencias_solicitud_revision_resena_solicitudId_fkey"
  FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_revision_resena"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidencias_solicitud_revision_resena"
  ADD CONSTRAINT "evidencias_solicitud_revision_resena_eventoId_fkey"
  FOREIGN KEY ("eventoId") REFERENCES "solicitudes_revision_resena_eventos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
