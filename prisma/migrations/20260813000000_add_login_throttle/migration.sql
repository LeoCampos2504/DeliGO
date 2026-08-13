-- AUTH-LOGIN-THROTTLE-HARDENING: tabla nueva, opaca, para la dimensión de
-- login throttle por cuenta/identificador. No toca ninguna tabla existente,
-- sin FK hacia ninguna otra tabla — deliberadamente aislada, nunca expuesta
-- por API/UI.
--
-- "throttle_key" guarda únicamente SHA-256(accountType + ":" +
-- normalizedIdentifier) — nunca el email/usuario en claro, nunca password,
-- nunca IP. "count" cuenta exclusivamente fallos de login (contraseña
-- incorrecta o cuenta inexistente) dentro de una ventana fija delimitada por
-- "reset_at"; un login exitoso con fallos previos por debajo del límite
-- borra la fila en vez de incrementarla. No hay estado "cuenta bloqueada"
-- persistente en ninguna tabla de cuentas — el cooldown vive únicamente acá
-- y expira solo.

CREATE TABLE "login_throttle" (
    "throttle_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "reset_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_throttle_pkey" PRIMARY KEY ("throttle_key")
);

CREATE INDEX "login_throttle_reset_at_idx" ON "login_throttle"("reset_at");
