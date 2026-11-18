-- F10-C1a — Egresos de efectivo de Caja (operador, 2026-11-18: sólo entorno local).
-- ADITIVA: tres tablas nuevas (egresos, historial de revisiones/confirmaciones,
-- compensaciones preparadas), una columna nueva opcional en negocios (umbral de
-- aviso) y guardas SQL. No modifica filas existentes, ni la fórmula del esperado
-- del turno, ni cierres, entregas, traspasos, ventas, devoluciones o cambios.
-- Tipos nuevos de operación del libro: GASTO, PAGO_PROVEEDOR, RETIRO_DUENO
-- (una pata negativa en la cuenta de efectivo de la caja, turno ABIERTO) y
-- REVERSION (compensación total de un egreso; ejecución en F10-C1c).

-- AlterTable
ALTER TABLE "negocios" ADD COLUMN     "cajaEgresoAvisoUmbralDecimal" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "egresos_caja" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "turnoCajaId" TEXT NOT NULL,
    "cajaFisicaId" TEXT NOT NULL,
    "naturaleza" TEXT NOT NULL,
    "categoria" TEXT,
    "medio" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "empleadoId" TEXT,
    "proveedorNombre" TEXT,
    "proveedorIdentificacion" TEXT,
    "comprobanteReferencia" TEXT,
    "destinatarioTipo" TEXT,
    "destinatarioNombre" TEXT,
    "confirmacionRetiroEstado" TEXT,
    "confirmacionRetiroEn" TIMESTAMP(3),
    "confirmacionRetiroActorId" TEXT,
    "esperadoPrevioDecimal" DECIMAL(13,2) NOT NULL,
    "excedeEsperado" BOOLEAN NOT NULL DEFAULT false,
    "umbralAvisoDecimal" DECIMAL(12,2),
    "superaUmbral" BOOLEAN NOT NULL DEFAULT false,
    "justificacion" TEXT,
    "estadoRevision" TEXT NOT NULL DEFAULT 'SIN_REVISAR',
    "revisadoEn" TIMESTAMP(3),
    "revisadoPorId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egresos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisiones_egresos_caja" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "egresoId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "observacion" TEXT,
    "actorTipo" TEXT NOT NULL DEFAULT 'NEGOCIO',
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisiones_egresos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensaciones_egresos_caja" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "egresoId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "momento" TEXT NOT NULL,
    "turnoCajaId" TEXT,
    "cajaFisicaId" TEXT NOT NULL,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "actorTipo" TEXT NOT NULL DEFAULT 'NEGOCIO',
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensaciones_egresos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "egresos_caja_operacionId_key" ON "egresos_caja"("operacionId");

-- CreateIndex
CREATE INDEX "egresos_caja_negocioId_createdAt_idx" ON "egresos_caja"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "egresos_caja_turnoCajaId_idx" ON "egresos_caja"("turnoCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "egresos_caja_negocioId_idempotencyKey_key" ON "egresos_caja"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "egresos_caja_id_negocioId_key" ON "egresos_caja"("id", "negocioId");

-- CreateIndex
CREATE INDEX "revisiones_egresos_caja_negocioId_egresoId_createdAt_idx" ON "revisiones_egresos_caja"("negocioId", "egresoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "revisiones_egresos_caja_negocioId_idempotencyKey_key" ON "revisiones_egresos_caja"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "compensaciones_egresos_caja_egresoId_key" ON "compensaciones_egresos_caja"("egresoId");

-- CreateIndex
CREATE UNIQUE INDEX "compensaciones_egresos_caja_operacionId_key" ON "compensaciones_egresos_caja"("operacionId");

-- CreateIndex
CREATE UNIQUE INDEX "compensaciones_egresos_caja_negocioId_idempotencyKey_key" ON "compensaciones_egresos_caja"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "compensaciones_egresos_caja_egresoId_negocioId_key" ON "compensaciones_egresos_caja"("egresoId", "negocioId");

-- AddForeignKey
ALTER TABLE "egresos_caja" ADD CONSTRAINT "egresos_caja_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos_caja" ADD CONSTRAINT "egresos_caja_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "operaciones_financieras"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos_caja" ADD CONSTRAINT "egresos_caja_turnoCajaId_negocioId_cajaFisicaId_fkey" FOREIGN KEY ("turnoCajaId", "negocioId", "cajaFisicaId") REFERENCES "turnos_caja"("id", "negocioId", "cajaFisicaId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones_egresos_caja" ADD CONSTRAINT "revisiones_egresos_caja_egresoId_negocioId_fkey" FOREIGN KEY ("egresoId", "negocioId") REFERENCES "egresos_caja"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensaciones_egresos_caja" ADD CONSTRAINT "compensaciones_egresos_caja_egresoId_negocioId_fkey" FOREIGN KEY ("egresoId", "negocioId") REFERENCES "egresos_caja"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensaciones_egresos_caja" ADD CONSTRAINT "compensaciones_egresos_caja_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "operaciones_financieras"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- ===========================================================================
-- F10-C1a — invariantes (no representables en el DSL de Prisma)
-- ===========================================================================

ALTER TABLE "negocios"
  ADD CONSTRAINT "negocios_caja_egreso_umbral_check" CHECK ("cajaEgresoAvisoUmbralDecimal" IS NULL OR "cajaEgresoAvisoUmbralDecimal" > 0);

-- ---------------------------------------------------------------------------
-- Egreso: coherencia de cada fila
-- ---------------------------------------------------------------------------
ALTER TABLE "egresos_caja"
  ADD CONSTRAINT "egresos_caja_naturaleza_check" CHECK ("naturaleza" IN ('GASTO', 'PAGO_PROVEEDOR', 'RETIRO_DUENO')),
  ADD CONSTRAINT "egresos_caja_categoria_check" CHECK (
    ("naturaleza" = 'GASTO' AND "categoria" IN ('INSUMOS', 'SERVICIOS', 'TRANSPORTE', 'MANTENIMIENTO', 'OTRO'))
    OR ("naturaleza" <> 'GASTO' AND "categoria" IS NULL)
  ),
  ADD CONSTRAINT "egresos_caja_medio_check" CHECK ("medio" = 'EFECTIVO'),
  ADD CONSTRAINT "egresos_caja_importe_check" CHECK ("importeDecimal" > 0),
  ADD CONSTRAINT "egresos_caja_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 1 AND 500),
  ADD CONSTRAINT "egresos_caja_actor_check" CHECK (
    ("actorTipo" = 'NEGOCIO' AND "actorId" = "negocioId" AND "empleadoId" IS NULL)
    OR ("actorTipo" = 'EMPLEADO' AND "empleadoId" IS NOT NULL AND "actorId" = "empleadoId")
  ),
  ADD CONSTRAINT "egresos_caja_textos_check" CHECK (
    ("proveedorNombre" IS NULL OR length(btrim("proveedorNombre")) BETWEEN 1 AND 120)
    AND ("proveedorIdentificacion" IS NULL OR length(btrim("proveedorIdentificacion")) BETWEEN 1 AND 40)
    AND ("comprobanteReferencia" IS NULL OR length(btrim("comprobanteReferencia")) BETWEEN 1 AND 120)
    AND ("justificacion" IS NULL OR length(btrim("justificacion")) BETWEEN 1 AND 500)
  ),
  -- Retiro del dueño: destinatario identificado, sin proveedor/comprobante.
  -- Lo registra el dueño -> no requiere confirmación; lo registra un empleado ->
  -- PENDIENTE hasta que el dueño confirme (CONFIRMADO | NO_RECIBIDO). Nunca mueve dinero.
  ADD CONSTRAINT "egresos_caja_retiro_check" CHECK (
    (
      "naturaleza" = 'RETIRO_DUENO'
      AND "destinatarioTipo" IN ('DUENO', 'AUTORIZADO_POR_DUENO')
      AND "destinatarioNombre" IS NOT NULL AND length(btrim("destinatarioNombre")) BETWEEN 1 AND 120
      AND "proveedorNombre" IS NULL AND "proveedorIdentificacion" IS NULL AND "comprobanteReferencia" IS NULL
      AND (
        ("actorTipo" = 'NEGOCIO' AND "confirmacionRetiroEstado" = 'NO_REQUERIDA' AND "confirmacionRetiroEn" IS NULL AND "confirmacionRetiroActorId" IS NULL)
        OR ("actorTipo" = 'EMPLEADO' AND "confirmacionRetiroEstado" = 'PENDIENTE' AND "confirmacionRetiroEn" IS NULL AND "confirmacionRetiroActorId" IS NULL)
        OR ("actorTipo" = 'EMPLEADO' AND "confirmacionRetiroEstado" IN ('CONFIRMADO', 'NO_RECIBIDO') AND "confirmacionRetiroEn" IS NOT NULL AND "confirmacionRetiroActorId" = "negocioId")
      )
    )
    OR (
      "naturaleza" <> 'RETIRO_DUENO'
      AND "destinatarioTipo" IS NULL AND "destinatarioNombre" IS NULL
      AND "confirmacionRetiroEstado" IS NULL AND "confirmacionRetiroEn" IS NULL AND "confirmacionRetiroActorId" IS NULL
    )
  ),
  -- Esperado insuficiente: nunca bloquea. La marca es exacta; el dueño que
  -- registra un egreso que deja el esperado negativo deja una justificación.
  -- Un empleado nunca ve la advertencia (cierre ciego) y no justifica.
  ADD CONSTRAINT "egresos_caja_esperado_check" CHECK (
    "excedeEsperado" = ("esperadoPrevioDecimal" - "importeDecimal" < 0)
    AND ("actorTipo" <> 'NEGOCIO' OR NOT "excedeEsperado" OR "justificacion" IS NOT NULL)
    AND ("actorTipo" <> 'EMPLEADO' OR "justificacion" IS NULL)
  ),
  ADD CONSTRAINT "egresos_caja_umbral_check" CHECK (
    ("umbralAvisoDecimal" IS NULL AND NOT "superaUmbral")
    OR ("umbralAvisoDecimal" > 0 AND "superaUmbral" = ("actorTipo" = 'EMPLEADO' AND "importeDecimal" >= "umbralAvisoDecimal"))
  ),
  ADD CONSTRAINT "egresos_caja_revision_check" CHECK (
    ("estadoRevision" = 'SIN_REVISAR' AND "revisadoEn" IS NULL AND "revisadoPorId" IS NULL)
    OR ("estadoRevision" IN ('REVISADO', 'OBSERVADO') AND "revisadoEn" IS NOT NULL AND "revisadoPorId" = "negocioId")
  );

ALTER TABLE "revisiones_egresos_caja"
  ADD CONSTRAINT "revisiones_egresos_caja_resultado_check" CHECK (
    ("accion" = 'REVISION' AND "resultado" IN ('REVISADO', 'OBSERVADO'))
    OR ("accion" = 'CONFIRMACION_RETIRO' AND "resultado" IN ('CONFIRMADO', 'NO_RECIBIDO'))
  ),
  ADD CONSTRAINT "revisiones_egresos_caja_observacion_check" CHECK (
    ("observacion" IS NULL OR length(btrim("observacion")) BETWEEN 1 AND 500)
    AND ("resultado" NOT IN ('OBSERVADO', 'NO_RECIBIDO') OR "observacion" IS NOT NULL)
  ),
  ADD CONSTRAINT "revisiones_egresos_caja_actor_check" CHECK ("actorTipo" = 'NEGOCIO' AND "actorId" = "negocioId");

-- Un retiro se confirma (o se informa no recibido) a lo sumo una vez.
CREATE UNIQUE INDEX "revisiones_egresos_caja_una_confirmacion_idx" ON "revisiones_egresos_caja"("egresoId") WHERE "accion" = 'CONFIRMACION_RETIRO';

ALTER TABLE "compensaciones_egresos_caja"
  ADD CONSTRAINT "compensaciones_egresos_caja_momento_check" CHECK (
    ("momento" = 'TURNO_ABIERTO' AND "turnoCajaId" IS NOT NULL)
    OR ("momento" = 'POSTERIOR_AL_CIERRE' AND "turnoCajaId" IS NULL)
  ),
  ADD CONSTRAINT "compensaciones_egresos_caja_importe_check" CHECK ("importeDecimal" > 0),
  ADD CONSTRAINT "compensaciones_egresos_caja_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 1 AND 500),
  ADD CONSTRAINT "compensaciones_egresos_caja_actor_check" CHECK ("actorTipo" = 'NEGOCIO' AND "actorId" = "negocioId");

-- ---------------------------------------------------------------------------
-- Libro: operaciones de egreso y su reversión
-- ---------------------------------------------------------------------------
-- GASTO / PAGO_PROVEEDOR / RETIRO_DUENO: siempre atribuidas a un turno ABIERTO
-- del mismo negocio. REVERSION (de un egreso): en su mismo turno todavía
-- abierto, o SIN turno (posterior al cierre). Inmutables una vez creadas.
CREATE FUNCTION "guard_operacion_egreso_caja"() RETURNS trigger AS $$
DECLARE
  orig RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."tipo" IN ('GASTO', 'PAGO_PROVEEDOR', 'RETIRO_DUENO', 'REVERSION')
       OR NEW."tipo" IN ('GASTO', 'PAGO_PROVEEDOR', 'RETIRO_DUENO', 'REVERSION') THEN
      IF NEW."tipo" IS DISTINCT FROM OLD."tipo"
         OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
         OR NEW."turnoCajaId" IS DISTINCT FROM OLD."turnoCajaId"
         OR NEW."revierteOperacionId" IS DISTINCT FROM OLD."revierteOperacionId"
         OR NEW."cobroVentaId" IS DISTINCT FROM OLD."cobroVentaId"
         OR NEW."actorTipo" IS DISTINCT FROM OLD."actorTipo"
         OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
         OR NEW."estado" IS DISTINCT FROM OLD."estado"
         OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
        RAISE EXCEPTION 'cash outflow operation is immutable';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."tipo" IN ('GASTO', 'PAGO_PROVEEDOR', 'RETIRO_DUENO') THEN
    IF NEW."turnoCajaId" IS NULL OR NEW."revierteOperacionId" IS NOT NULL OR NEW."cobroVentaId" IS NOT NULL THEN
      RAISE EXCEPTION 'cash outflow requires an open shift';
    END IF;
    PERFORM 1 FROM "turnos_caja"
     WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" AND "estado" = 'ABIERTO';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cash outflow requires an open shift';
    END IF;
  ELSIF NEW."tipo" = 'REVERSION' THEN
    SELECT "tipo", "negocioId", "turnoCajaId" INTO orig FROM "operaciones_financieras" WHERE "id" = NEW."revierteOperacionId";
    IF NOT FOUND OR orig."negocioId" <> NEW."negocioId" OR orig."tipo" NOT IN ('GASTO', 'PAGO_PROVEEDOR', 'RETIRO_DUENO')
       OR NEW."cobroVentaId" IS NOT NULL OR NEW."actorTipo" <> 'NEGOCIO' OR NEW."actorId" <> NEW."negocioId" THEN
      RAISE EXCEPTION 'cash outflow reversion is inconsistent';
    END IF;
    IF NEW."turnoCajaId" IS NOT NULL THEN
      IF NEW."turnoCajaId" <> orig."turnoCajaId" THEN
        RAISE EXCEPTION 'cash outflow reversion must stay in its own shift or have no shift';
      END IF;
      PERFORM 1 FROM "turnos_caja"
       WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" AND "estado" = 'ABIERTO';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'cash outflow reversion cannot change a closed shift';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "operaciones_financieras_egreso_guard_trigger"
  BEFORE INSERT OR UPDATE ON "operaciones_financieras"
  FOR EACH ROW EXECUTE FUNCTION "guard_operacion_egreso_caja"();

-- Exactamente UNA pata por operación de egreso/reversión, exacta (Decimal), en
-- la cuenta de efectivo de una caja física: negativa para el egreso (la caja
-- de su turno), positiva por el mismo importe y en la misma cuenta para la
-- reversión. Inmutables.
CREATE FUNCTION "guard_movimiento_egreso_caja"() RETURNS trigger AS $$
DECLARE
  op RECORD;
  cta RECORD;
  turno RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM 1 FROM "operaciones_financieras"
     WHERE "id" IN (OLD."operacionId", NEW."operacionId") AND "tipo" IN ('GASTO', 'PAGO_PROVEEDOR', 'RETIRO_DUENO', 'REVERSION');
    IF FOUND THEN
      RAISE EXCEPTION 'cash outflow movement is immutable';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "tipo", "negocioId", "turnoCajaId", "revierteOperacionId" INTO op FROM "operaciones_financieras" WHERE "id" = NEW."operacionId";
  IF NOT FOUND OR op."tipo" NOT IN ('GASTO', 'PAGO_PROVEEDOR', 'RETIRO_DUENO', 'REVERSION') THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM "movimientos_financieros" WHERE "operacionId" = NEW."operacionId";
  IF FOUND THEN
    RAISE EXCEPTION 'cash outflow operation must have exactly one movement';
  END IF;
  SELECT "tipo", "negocioId", "cajaFisicaId" INTO cta FROM "cuentas_financieras" WHERE "id" = NEW."cuentaId";
  IF NOT FOUND OR cta."tipo" <> 'EFECTIVO' OR cta."cajaFisicaId" IS NULL OR cta."negocioId" <> NEW."negocioId" OR NEW."negocioId" <> op."negocioId" THEN
    RAISE EXCEPTION 'cash outflow movement must use the register cash account';
  END IF;
  IF NEW."importeDecimal" IS NULL THEN
    RAISE EXCEPTION 'cash outflow movement requires an exact amount';
  END IF;

  IF op."tipo" = 'REVERSION' THEN
    IF NEW."importeDecimal" <= 0 THEN
      RAISE EXCEPTION 'cash outflow reversion must return the exact amount to the same account';
    END IF;
    PERFORM 1 FROM "movimientos_financieros"
     WHERE "operacionId" = op."revierteOperacionId" AND "cuentaId" = NEW."cuentaId" AND "importeDecimal" = -NEW."importeDecimal";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cash outflow reversion must return the exact amount to the same account';
    END IF;
  ELSE
    IF NEW."importeDecimal" >= 0 THEN
      RAISE EXCEPTION 'cash outflow movement must be negative';
    END IF;
    SELECT "cajaFisicaId" INTO turno FROM "turnos_caja" WHERE "id" = op."turnoCajaId" AND "negocioId" = op."negocioId";
    IF NOT FOUND OR turno."cajaFisicaId" <> cta."cajaFisicaId" THEN
      RAISE EXCEPTION 'cash outflow movement must use the register cash account';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "movimientos_financieros_egreso_guard_trigger"
  BEFORE INSERT OR UPDATE ON "movimientos_financieros"
  FOR EACH ROW EXECUTE FUNCTION "guard_movimiento_egreso_caja"();

-- ---------------------------------------------------------------------------
-- Egreso: respaldo exacto en el libro, turno ABIERTO, esperado previo exacto;
-- inmutable salvo la revisión (con su fila de historial) y la confirmación
-- única de un retiro (PENDIENTE -> CONFIRMADO | NO_RECIBIDO).
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_egreso_caja"() RETURNS trigger AS $$
DECLARE
  op RECORD;
  turno RECORD;
  patas RECORD;
  esperado NUMERIC;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
       OR NEW."operacionId" IS DISTINCT FROM OLD."operacionId"
       OR NEW."turnoCajaId" IS DISTINCT FROM OLD."turnoCajaId"
       OR NEW."cajaFisicaId" IS DISTINCT FROM OLD."cajaFisicaId"
       OR NEW."naturaleza" IS DISTINCT FROM OLD."naturaleza"
       OR NEW."categoria" IS DISTINCT FROM OLD."categoria"
       OR NEW."medio" IS DISTINCT FROM OLD."medio"
       OR NEW."importeDecimal" IS DISTINCT FROM OLD."importeDecimal"
       OR NEW."motivo" IS DISTINCT FROM OLD."motivo"
       OR NEW."actorTipo" IS DISTINCT FROM OLD."actorTipo"
       OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
       OR NEW."empleadoId" IS DISTINCT FROM OLD."empleadoId"
       OR NEW."proveedorNombre" IS DISTINCT FROM OLD."proveedorNombre"
       OR NEW."proveedorIdentificacion" IS DISTINCT FROM OLD."proveedorIdentificacion"
       OR NEW."comprobanteReferencia" IS DISTINCT FROM OLD."comprobanteReferencia"
       OR NEW."destinatarioTipo" IS DISTINCT FROM OLD."destinatarioTipo"
       OR NEW."destinatarioNombre" IS DISTINCT FROM OLD."destinatarioNombre"
       OR NEW."esperadoPrevioDecimal" IS DISTINCT FROM OLD."esperadoPrevioDecimal"
       OR NEW."excedeEsperado" IS DISTINCT FROM OLD."excedeEsperado"
       OR NEW."umbralAvisoDecimal" IS DISTINCT FROM OLD."umbralAvisoDecimal"
       OR NEW."superaUmbral" IS DISTINCT FROM OLD."superaUmbral"
       OR NEW."justificacion" IS DISTINCT FROM OLD."justificacion"
       OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
       OR NEW."idempotencyFingerprint" IS DISTINCT FROM OLD."idempotencyFingerprint"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
      RAISE EXCEPTION 'cash outflow is immutable';
    END IF;
    IF NEW."confirmacionRetiroEstado" IS DISTINCT FROM OLD."confirmacionRetiroEstado"
       OR NEW."confirmacionRetiroEn" IS DISTINCT FROM OLD."confirmacionRetiroEn"
       OR NEW."confirmacionRetiroActorId" IS DISTINCT FROM OLD."confirmacionRetiroActorId" THEN
      IF OLD."confirmacionRetiroEstado" IS DISTINCT FROM 'PENDIENTE' OR NEW."confirmacionRetiroEstado" NOT IN ('CONFIRMADO', 'NO_RECIBIDO') THEN
        RAISE EXCEPTION 'cash outflow withdrawal confirmation already registered';
      END IF;
      PERFORM 1 FROM "revisiones_egresos_caja"
       WHERE "egresoId" = NEW."id" AND "negocioId" = NEW."negocioId" AND "accion" = 'CONFIRMACION_RETIRO'
         AND "resultado" = NEW."confirmacionRetiroEstado" AND "createdAt" = NEW."confirmacionRetiroEn";
      IF NOT FOUND THEN
        RAISE EXCEPTION 'cash outflow withdrawal confirmation requires its history row';
      END IF;
    END IF;
    IF NEW."estadoRevision" IS DISTINCT FROM OLD."estadoRevision"
       OR NEW."revisadoEn" IS DISTINCT FROM OLD."revisadoEn"
       OR NEW."revisadoPorId" IS DISTINCT FROM OLD."revisadoPorId" THEN
      PERFORM 1 FROM "revisiones_egresos_caja"
       WHERE "egresoId" = NEW."id" AND "negocioId" = NEW."negocioId" AND "accion" = 'REVISION'
         AND "resultado" = NEW."estadoRevision" AND "createdAt" = NEW."revisadoEn";
      IF NOT FOUND THEN
        RAISE EXCEPTION 'cash outflow review requires its history row';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."estadoRevision" <> 'SIN_REVISAR' THEN
    RAISE EXCEPTION 'cash outflow starts unreviewed';
  END IF;
  SELECT "tipo", "negocioId", "turnoCajaId", "actorTipo", "actorId" INTO op FROM "operaciones_financieras" WHERE "id" = NEW."operacionId";
  IF NOT FOUND OR op."negocioId" <> NEW."negocioId" OR op."tipo" <> NEW."naturaleza"
     OR op."turnoCajaId" IS DISTINCT FROM NEW."turnoCajaId" OR op."actorTipo" <> NEW."actorTipo" OR op."actorId" <> NEW."actorId" THEN
    RAISE EXCEPTION 'cash outflow operation is inconsistent';
  END IF;
  SELECT "estado", "fondoInicialDecimal" INTO turno FROM "turnos_caja"
   WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" AND "cajaFisicaId" = NEW."cajaFisicaId";
  IF NOT FOUND OR turno."estado" <> 'ABIERTO' THEN
    RAISE EXCEPTION 'cash outflow requires an open shift';
  END IF;
  IF NEW."actorTipo" = 'EMPLEADO' THEN
    PERFORM 1 FROM "empleados" WHERE "id" = NEW."empleadoId" AND "negocioId" = NEW."negocioId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cash outflow employee must belong to the business';
    END IF;
  END IF;
  SELECT count(*) AS n, COALESCE(sum(m."importeDecimal"), 0) AS total, COALESCE(bool_and(c."cajaFisicaId" = NEW."cajaFisicaId"), false) AS misma_caja
    INTO patas
    FROM "movimientos_financieros" m JOIN "cuentas_financieras" c ON c."id" = m."cuentaId"
   WHERE m."operacionId" = NEW."operacionId";
  IF patas.n <> 1 OR patas.total <> -NEW."importeDecimal" OR NOT patas.misma_caja THEN
    RAISE EXCEPTION 'cash outflow ledger leg is inconsistent';
  END IF;
  -- Esperado previo = fondo + patas de la cuenta de efectivo de la caja atribuidas
  -- al turno (misma fórmula que el cierre), sin contar este egreso.
  SELECT turno."fondoInicialDecimal" + COALESCE(sum(COALESCE(m."importeDecimal", round(m."importe"::numeric, 2))), 0) INTO esperado
    FROM "movimientos_financieros" m
    JOIN "operaciones_financieras" o ON o."id" = m."operacionId"
    JOIN "cuentas_financieras" c ON c."id" = m."cuentaId"
   WHERE o."turnoCajaId" = NEW."turnoCajaId" AND o."negocioId" = NEW."negocioId"
     AND c."cajaFisicaId" = NEW."cajaFisicaId" AND c."tipo" = 'EFECTIVO' AND c."negocioId" = NEW."negocioId"
     AND m."operacionId" <> NEW."operacionId";
  IF esperado IS DISTINCT FROM NEW."esperadoPrevioDecimal" THEN
    RAISE EXCEPTION 'cash outflow expected-cash snapshot is inconsistent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "egresos_caja_guard_trigger"
  BEFORE INSERT OR UPDATE ON "egresos_caja"
  FOR EACH ROW EXECUTE FUNCTION "guard_egreso_caja"();

-- Historial de revisiones / confirmaciones: append-only; la confirmación sólo
-- para un retiro registrado por un empleado y todavía PENDIENTE.
CREATE FUNCTION "guard_revision_egreso_caja"() RETURNS trigger AS $$
DECLARE
  egreso RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'cash outflow review history is immutable';
  END IF;
  SELECT "naturaleza", "confirmacionRetiroEstado" INTO egreso FROM "egresos_caja" WHERE "id" = NEW."egresoId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cash outflow review must reference an outflow of the same business';
  END IF;
  IF NEW."accion" = 'CONFIRMACION_RETIRO' AND (egreso."naturaleza" <> 'RETIRO_DUENO' OR egreso."confirmacionRetiroEstado" IS DISTINCT FROM 'PENDIENTE') THEN
    RAISE EXCEPTION 'cash outflow withdrawal confirmation already registered';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "revisiones_egresos_caja_guard_trigger"
  BEFORE INSERT OR UPDATE ON "revisiones_egresos_caja"
  FOR EACH ROW EXECUTE FUNCTION "guard_revision_egreso_caja"();

-- ---------------------------------------------------------------------------
-- Compensación (preparada en C1a, ejecutada por el dueño desde C1c): total,
-- una sola vez, con su operación REVERSION. TURNO_ABIERTO = el turno original
-- sigue abierto (el esperado vuelve a subir); POSTERIOR_AL_CIERRE = sin turno
-- (ningún cierre, esperado ni revisión cambia). Inmutable.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_compensacion_egreso_caja"() RETURNS trigger AS $$
DECLARE
  egreso RECORD;
  op RECORD;
  turno RECORD;
  patas RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'cash outflow compensation is immutable';
  END IF;
  SELECT "operacionId", "turnoCajaId", "cajaFisicaId", "importeDecimal" INTO egreso
    FROM "egresos_caja" WHERE "id" = NEW."egresoId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND OR NEW."importeDecimal" <> egreso."importeDecimal" OR NEW."cajaFisicaId" <> egreso."cajaFisicaId" THEN
    RAISE EXCEPTION 'cash outflow compensation is inconsistent';
  END IF;
  SELECT "tipo", "negocioId", "turnoCajaId", "revierteOperacionId" INTO op FROM "operaciones_financieras" WHERE "id" = NEW."operacionId";
  IF NOT FOUND OR op."tipo" <> 'REVERSION' OR op."negocioId" <> NEW."negocioId"
     OR op."revierteOperacionId" IS DISTINCT FROM egreso."operacionId" OR op."turnoCajaId" IS DISTINCT FROM NEW."turnoCajaId" THEN
    RAISE EXCEPTION 'cash outflow compensation is inconsistent';
  END IF;
  SELECT "estado" INTO turno FROM "turnos_caja" WHERE "id" = egreso."turnoCajaId" AND "negocioId" = NEW."negocioId";
  IF NEW."momento" = 'TURNO_ABIERTO' AND (turno."estado" <> 'ABIERTO' OR NEW."turnoCajaId" <> egreso."turnoCajaId") THEN
    RAISE EXCEPTION 'cash outflow compensation cannot change a closed shift';
  END IF;
  IF NEW."momento" = 'POSTERIOR_AL_CIERRE' AND turno."estado" = 'ABIERTO' THEN
    RAISE EXCEPTION 'cash outflow compensation while the shift is open must use that shift';
  END IF;
  SELECT count(*) AS n, COALESCE(sum(m."importeDecimal"), 0) AS total, COALESCE(bool_and(c."cajaFisicaId" = NEW."cajaFisicaId"), false) AS misma_caja
    INTO patas
    FROM "movimientos_financieros" m JOIN "cuentas_financieras" c ON c."id" = m."cuentaId"
   WHERE m."operacionId" = NEW."operacionId";
  IF patas.n <> 1 OR patas.total <> NEW."importeDecimal" OR NOT patas.misma_caja THEN
    RAISE EXCEPTION 'cash outflow compensation ledger leg is inconsistent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "compensaciones_egresos_caja_guard_trigger"
  BEFORE INSERT OR UPDATE ON "compensaciones_egresos_caja"
  FOR EACH ROW EXECUTE FUNCTION "guard_compensacion_egreso_caja"();
