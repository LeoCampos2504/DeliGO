-- P2-T07: bounded, hash-only email verification bearer lifecycle.
ALTER TABLE "clientes" ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "negocios" ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "repartidores" ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);
