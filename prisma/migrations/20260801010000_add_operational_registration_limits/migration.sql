-- Bugfix-5F: límite de registro de CuentaOperativa (3 cuentas por ventana
-- móvil de 7 días, por IP y por dispositivo). Tabla nueva, no toca ninguna
-- tabla existente.
--
-- Nunca guarda la IP real ni el identificador de dispositivo — solo su
-- HMAC-SHA256 ("ipHash"/"deviceHash", con un secreto de servidor dedicado,
-- ver src/lib/operativo-registration-limit.ts). Un evento por cada
-- CuentaOperativa creada exitosamente vía POST /api/operativo/register — no
-- por email duplicado, validación fallida, request inválido, error del
-- servidor, ni límite ya alcanzado. Sin FK hacia cuentas_operativas a
-- propósito: es un contador de abuso, no una relación de dominio.
--
-- "ipHash" es NULLABLE (sin NOT NULL): cuando no puede determinarse una IP
-- fiable, la aplicación nunca hashea el valor "unknown" ni ningún otro valor
-- compartido — guarda NULL. Si "ipHash" fuera NOT NULL, todos los usuarios
-- sin IP detectable colapsarían en el mismo hash y compartirían un único
-- contador global, bloqueándose entre sí después de solo 3 registros ajenos.

CREATE TABLE "cuenta_operativa_registros" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT,
    "deviceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuenta_operativa_registros_pkey" PRIMARY KEY ("id")
);

-- Conteo de registros recientes por IP (ventana móvil de 7 días evaluada en la aplicación).
CREATE INDEX "cuenta_operativa_registros_ipHash_createdAt_idx" ON "cuenta_operativa_registros"("ipHash", "createdAt");

-- Conteo de registros recientes por dispositivo (misma ventana móvil).
CREATE INDEX "cuenta_operativa_registros_deviceHash_createdAt_idx" ON "cuenta_operativa_registros"("deviceHash", "createdAt");
