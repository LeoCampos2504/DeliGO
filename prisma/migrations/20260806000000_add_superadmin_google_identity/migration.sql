-- 24-A: identidad Google para SuperAdmin (Google-only con bootstrap seguro).
--
-- Puramente aditiva sobre una única tabla existente. Ningún DROP, DELETE,
-- TRUNCATE, ni backfill de filas existentes. No inserta ningún email ni
-- "sub" — la vinculación de la identidad Google ocurre en runtime (ver
-- src/lib/superadmin-auth.ts), nunca en una migración.
--
-- "password" pasa a ser nullable: las cuentas creadas por el bootstrap de
-- Google no tienen contraseña. La lectura/validación de "password" para
-- autenticar ya se retira del código en el mismo cambio que esta migración
-- acompaña (src/app/api/auth/login/route.ts) — la columna se conserva sin
-- destruir datos legacy, para una eliminación física futura fuera de esta
-- etapa.
--
-- "googleSub" es la autoridad estable de identidad (claim `sub` de Google).
-- @unique a nivel de base: si dos requests concurrentes intentan vincular o
-- crear un SuperAdmin al mismo tiempo (bootstrap concurrente), la restricción
-- única garantiza que como máximo una fila puede quedar vinculada a un
-- "googleSub" dado — la segunda escritura falla con una violación de
-- unicidad en vez de crear un duplicado.
--
-- "email" es solo informativo/auditable una vez vinculado el "sub" — nunca
-- vuelve a ser la autoridad de autenticación después del bootstrap.
--
-- "activo" permite desactivar administrativamente sin eliminar la fila ni
-- perder el "googleSub" vinculado.

ALTER TABLE "super_admins"
  ALTER COLUMN "password" DROP NOT NULL,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "googleSub" TEXT,
  ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "super_admins_googleSub_key" ON "super_admins"("googleSub");
