-- Bugfix-5D: recuperación segura de contraseña (Cliente, Negocio, Repartidor,
-- CuentaOperativa). Tabla nueva, no toca ninguna tabla existente.
--
-- Nunca guarda el token real — solo su hash SHA-256 ("tokenHash", único).
-- Resuelve la cuenta exclusivamente vía "userType" + "userId" (mismo patrón
-- ya usado por "sesiones".userType), evitando una FK polimórfica inválida
-- hacia cuatro tablas distintas (clientes, negocios, repartidores,
-- cuentas_operativas). "userType" solo acepta, a nivel de aplicación
-- (src/lib/password-reset.ts), los valores: cliente | negocio | repartidor |
-- cuenta_operativa — nunca superadmin (sin email) ni terminal (no es una
-- cuenta personal).

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- Un solo uso posible por token real (su hash es único).
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- Búsqueda de tokens activos de una cuenta puntual (para revocar los
-- anteriores al emitir uno nuevo, o al completar un reset).
CREATE INDEX "password_reset_tokens_userType_userId_idx" ON "password_reset_tokens"("userType", "userId");

-- Soporte de limpieza/expiración futura sin escanear toda la tabla.
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");
