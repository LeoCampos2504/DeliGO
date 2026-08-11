-- 19-B0.2D1: outbox durable para el borrado físico de adjuntos de Chat.
-- Tabla nueva, no toca ninguna tabla existente. No tiene FK hacia ninguna
-- otra tabla (no se relaciona con Cliente ni con ChatMensaje) — es
-- deliberadamente una entidad interna aislada, nunca expuesta por API/UI.
--
-- "identifier" guarda únicamente el publicId de Cloudinary o un path
-- relativo bajo uploads/chat/ (nunca la URL completa ni el nombre de
-- archivo original) — se trata como dato interno potencialmente sensible:
-- nunca se loguea, nunca se expone, y la fila se borra apenas el borrado
-- remoto tiene éxito.
--
-- El unique constraint (provider, resourceType, identifier) evita jobs
-- duplicados para el mismo asset físico.

CREATE TABLE "chat_attachment_deletion_jobs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_attachment_deletion_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_attachment_deletion_jobs_provider_resourceType_identifier_key"
ON "chat_attachment_deletion_jobs"("provider", "resourceType", "identifier");
