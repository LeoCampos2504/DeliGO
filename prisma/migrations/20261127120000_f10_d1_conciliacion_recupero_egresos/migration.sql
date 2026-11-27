-- F10-D1 — conciliación y recupero de egresos de Caja descubiertos DESPUÉS del cierre.
-- Diseño aprobado: codex-reports/F10_D1_CONCILIACION_EGRESOS_DISENO.md (DF-1, DF-2 y DF-3 resueltas por el
-- operador el 2026-11-27).
--
-- ADITIVA: crea dos tablas, funciones y triggers NUEVOS. No modifica ninguna tabla, columna, fila, función ni
-- trigger existente. En particular NO toca 20261118150000: la compensación POSTERIOR_AL_CIERRE (una REVERSION
-- sin turno) sigue bloqueada en la API y en la base. F10-D1 usa mecanismos distintos:
--
--   (a) CONCILIACIÓN — el efectivo NO salió (o salió menos de lo registrado). Ese efectivo ya apareció como
--       SOBRANTE en el cierre congelado. Se registra una fila que EXPLICA esa parte del sobrante. NO se crea
--       ninguna operación ni pata: la cuenta de efectivo, el turno cerrado, sus entregas y revisiones quedan
--       intactos. Tope por turno: lo conciliado de TODOS sus egresos no supera su sobrante (contado − esperado
--       congelados); un turno sin sobrante no admite conciliaciones (no se inventa dinero ni se oculta un faltante).
--   (b) RECUPERO — el efectivo SÍ salió y vuelve más tarde. Operación nueva RECUPERO_EGRESO con UNA pata
--       POSITIVA en la cuenta de efectivo de la caja que lo recibe, atribuida a su turno ABIERTO (su esperado
--       sube con la fórmula existente). No es venta ni cobro.
--
-- Tope por egreso (ambos mecanismos): Σ conciliado + Σ recuperado ≤ importe del egreso. Un egreso compensado no
-- admite correcciones. Un PAGO_PROVEEDOR vinculado (crédito PAGO_CAJA VIGENTE) exige, en la misma transacción,
-- su ajuste de deuda del motor de F5 (AJUSTE_DEUDA: ERROR_DE_CARGA para la conciliación, DIFERENCIA_ACORDADA para
-- el recupero — DF-2); un egreso con correcciones ya no se vincula ni se desvincula, y su ajuste no se anula
-- (evita ajustes duplicados o huérfanos). Todas las filas son inmutables (también frente a DELETE, salvo la
-- cascada al eliminar el negocio completo).

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
CREATE TABLE "conciliaciones_egresos_caja" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "egresoId" TEXT NOT NULL,
    "turnoCajaId" TEXT NOT NULL,
    "cajaFisicaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "obligacionAjusteId" TEXT,
    "actorTipo" TEXT NOT NULL DEFAULT 'NEGOCIO',
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliaciones_egresos_caja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recuperos_egresos_caja" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "egresoId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "turnoCajaId" TEXT NOT NULL,
    "cajaFisicaId" TEXT NOT NULL,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "obligacionAjusteId" TEXT,
    "actorTipo" TEXT NOT NULL DEFAULT 'NEGOCIO',
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuperos_egresos_caja_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conciliaciones_egresos_caja_negocioId_idempotencyKey_key" ON "conciliaciones_egresos_caja"("negocioId", "idempotencyKey");
CREATE INDEX "conciliaciones_egresos_caja_negocioId_egresoId_idx" ON "conciliaciones_egresos_caja"("negocioId", "egresoId");
CREATE INDEX "conciliaciones_egresos_caja_turnoCajaId_idx" ON "conciliaciones_egresos_caja"("turnoCajaId");
CREATE INDEX "conciliaciones_egresos_caja_negocioId_createdAt_idx" ON "conciliaciones_egresos_caja"("negocioId", "createdAt");
CREATE UNIQUE INDEX "conciliaciones_egresos_caja_obligacionAjusteId_key" ON "conciliaciones_egresos_caja"("obligacionAjusteId");

CREATE UNIQUE INDEX "recuperos_egresos_caja_operacionId_key" ON "recuperos_egresos_caja"("operacionId");
CREATE UNIQUE INDEX "recuperos_egresos_caja_negocioId_idempotencyKey_key" ON "recuperos_egresos_caja"("negocioId", "idempotencyKey");
CREATE INDEX "recuperos_egresos_caja_negocioId_egresoId_idx" ON "recuperos_egresos_caja"("negocioId", "egresoId");
CREATE INDEX "recuperos_egresos_caja_turnoCajaId_idx" ON "recuperos_egresos_caja"("turnoCajaId");
CREATE INDEX "recuperos_egresos_caja_negocioId_createdAt_idx" ON "recuperos_egresos_caja"("negocioId", "createdAt");
CREATE UNIQUE INDEX "recuperos_egresos_caja_obligacionAjusteId_key" ON "recuperos_egresos_caja"("obligacionAjusteId");

-- Claves foráneas compuestas por negocio (el egreso, el turno, la caja y la deuda son del MISMO negocio).
ALTER TABLE "conciliaciones_egresos_caja" ADD CONSTRAINT "conciliaciones_egresos_caja_egresoId_negocioId_fkey" FOREIGN KEY ("egresoId", "negocioId") REFERENCES "egresos_caja"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conciliaciones_egresos_caja" ADD CONSTRAINT "conciliaciones_egresos_caja_turno_fkey" FOREIGN KEY ("turnoCajaId", "negocioId", "cajaFisicaId") REFERENCES "turnos_caja"("id", "negocioId", "cajaFisicaId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "conciliaciones_egresos_caja" ADD CONSTRAINT "conciliaciones_egresos_caja_obligacion_fkey" FOREIGN KEY ("obligacionAjusteId", "negocioId") REFERENCES "obligaciones_proveedor"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "recuperos_egresos_caja" ADD CONSTRAINT "recuperos_egresos_caja_egresoId_negocioId_fkey" FOREIGN KEY ("egresoId", "negocioId") REFERENCES "egresos_caja"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recuperos_egresos_caja" ADD CONSTRAINT "recuperos_egresos_caja_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "operaciones_financieras"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "recuperos_egresos_caja" ADD CONSTRAINT "recuperos_egresos_caja_turno_fkey" FOREIGN KEY ("turnoCajaId", "negocioId", "cajaFisicaId") REFERENCES "turnos_caja"("id", "negocioId", "cajaFisicaId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "recuperos_egresos_caja" ADD CONSTRAINT "recuperos_egresos_caja_obligacion_fkey" FOREIGN KEY ("obligacionAjusteId", "negocioId") REFERENCES "obligaciones_proveedor"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "conciliaciones_egresos_caja"
  ADD CONSTRAINT "conciliaciones_egresos_caja_tipo_check" CHECK ("tipo" IN ('SIN_SALIDA', 'IMPORTE_EXCEDENTE')),
  ADD CONSTRAINT "conciliaciones_egresos_caja_importe_check" CHECK ("importeDecimal" > 0),
  ADD CONSTRAINT "conciliaciones_egresos_caja_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 1 AND 500),
  ADD CONSTRAINT "conciliaciones_egresos_caja_actor_check" CHECK ("actorTipo" = 'NEGOCIO' AND "actorId" = "negocioId");

ALTER TABLE "recuperos_egresos_caja"
  ADD CONSTRAINT "recuperos_egresos_caja_importe_check" CHECK ("importeDecimal" > 0),
  ADD CONSTRAINT "recuperos_egresos_caja_motivo_check" CHECK (length(btrim("motivo")) BETWEEN 1 AND 500),
  ADD CONSTRAINT "recuperos_egresos_caja_actor_check" CHECK ("actorTipo" = 'NEGOCIO' AND "actorId" = "negocioId");

-- ---------------------------------------------------------------------------
-- Helpers (lectura)
-- ---------------------------------------------------------------------------
CREATE FUNCTION "f10d1_corregido_egreso"(p_egreso TEXT) RETURNS NUMERIC AS $$
  SELECT COALESCE((SELECT sum("importeDecimal") FROM "conciliaciones_egresos_caja" WHERE "egresoId" = p_egreso), 0)
       + COALESCE((SELECT sum("importeDecimal") FROM "recuperos_egresos_caja" WHERE "egresoId" = p_egreso), 0);
$$ LANGUAGE sql STABLE;

CREATE FUNCTION "f10d1_tiene_correcciones"(p_egreso TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM "conciliaciones_egresos_caja" WHERE "egresoId" = p_egreso)
      OR EXISTS (SELECT 1 FROM "recuperos_egresos_caja" WHERE "egresoId" = p_egreso);
$$ LANGUAGE sql STABLE;

-- El ajuste de deuda de F5 que exige una corrección de un PAGO_PROVEEDOR vinculado (o NULL si no está vinculado).
CREATE FUNCTION "f10d1_validar_ajuste_proveedor"(p_negocio TEXT, p_egreso TEXT, p_obligacion TEXT, p_importe NUMERIC, p_naturaleza TEXT) RETURNS VOID AS $$
DECLARE
  cr RECORD;
  ob RECORD;
BEGIN
  SELECT "id", "proveedorId" INTO cr FROM "creditos_proveedor"
   WHERE "negocioId" = p_negocio AND "egresoCajaId" = p_egreso AND "origen" = 'PAGO_CAJA' AND "estado" = 'VIGENTE';
  IF NOT FOUND THEN
    IF p_obligacion IS NOT NULL THEN
      RAISE EXCEPTION 'cash outflow correction supplier adjustment is inconsistent';
    END IF;
    RETURN;
  END IF;
  IF p_obligacion IS NULL THEN
    RAISE EXCEPTION 'linked cash outflow correction requires its supplier adjustment';
  END IF;
  SELECT "proveedorId", "origen", "naturalezaAjuste", "importeDecimal", "estado" INTO ob FROM "obligaciones_proveedor"
   WHERE "id" = p_obligacion AND "negocioId" = p_negocio;
  IF NOT FOUND OR ob."proveedorId" <> cr."proveedorId" OR ob."origen" <> 'AJUSTE_DEUDA' OR ob."naturalezaAjuste" <> p_naturaleza
     OR ob."importeDecimal" <> p_importe OR ob."estado" <> 'VIGENTE' THEN
    RAISE EXCEPTION 'cash outflow correction supplier adjustment is inconsistent';
  END IF;
  PERFORM 1 FROM "conciliaciones_egresos_caja" WHERE "obligacionAjusteId" = p_obligacion;
  IF FOUND THEN RAISE EXCEPTION 'cash outflow correction supplier adjustment is inconsistent'; END IF;
  PERFORM 1 FROM "recuperos_egresos_caja" WHERE "obligacionAjusteId" = p_obligacion;
  IF FOUND THEN RAISE EXCEPTION 'cash outflow correction supplier adjustment is inconsistent'; END IF;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Conciliación: turno CERRADO, egreso no compensado, topes por egreso y por turno, sin dinero.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_conciliacion_egreso_caja"() RETURNS trigger AS $$
DECLARE
  eg RECORD;
  turno RECORD;
  conciliado_turno NUMERIC;
  conciliado_egreso NUMERIC;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'cash outflow conciliation is immutable';
  END IF;
  -- Mismo candado que la compensación y la vinculación con F5: la fila del egreso.
  SELECT "turnoCajaId", "cajaFisicaId", "importeDecimal", "naturaleza", "confirmacionRetiroEstado" INTO eg
    FROM "egresos_caja" WHERE "id" = NEW."egresoId" AND "negocioId" = NEW."negocioId" FOR UPDATE;
  IF NOT FOUND OR eg."turnoCajaId" <> NEW."turnoCajaId" OR eg."cajaFisicaId" <> NEW."cajaFisicaId" THEN
    RAISE EXCEPTION 'cash outflow conciliation is inconsistent';
  END IF;
  PERFORM 1 FROM "compensaciones_egresos_caja" WHERE "egresoId" = NEW."egresoId" AND "negocioId" = NEW."negocioId";
  IF FOUND THEN RAISE EXCEPTION 'a compensated cash outflow cannot be corrected'; END IF;
  -- El turno cerrado se bloquea (sin modificarlo) para que dos conciliaciones del mismo turno se ordenen.
  SELECT "estado", "efectivoContadoDecimal", "efectivoEsperadoDecimal" INTO turno
    FROM "turnos_caja" WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" FOR UPDATE;
  IF NOT FOUND OR turno."estado" <> 'CERRADO_DECLARADO' OR turno."efectivoContadoDecimal" IS NULL OR turno."efectivoEsperadoDecimal" IS NULL THEN
    RAISE EXCEPTION 'cash outflow conciliation requires its closed shift';
  END IF;
  IF NEW."tipo" = 'SIN_SALIDA' AND (NEW."importeDecimal" <> eg."importeDecimal" OR "f10d1_tiene_correcciones"(NEW."egresoId")) THEN
    RAISE EXCEPTION 'cash outflow conciliation without outflow must cover the whole outflow';
  END IF;
  conciliado_egreso := COALESCE((SELECT sum("importeDecimal") FROM "conciliaciones_egresos_caja" WHERE "egresoId" = NEW."egresoId"), 0) + NEW."importeDecimal";
  IF eg."naturaleza" = 'RETIRO_DUENO' AND eg."confirmacionRetiroEstado" = 'CONFIRMADO'
     AND (NEW."tipo" <> 'IMPORTE_EXCEDENTE' OR conciliado_egreso >= eg."importeDecimal") THEN
    RAISE EXCEPTION 'a confirmed withdrawal can only be partially conciliated';
  END IF;
  IF "f10d1_corregido_egreso"(NEW."egresoId") + NEW."importeDecimal" > eg."importeDecimal" THEN
    RAISE EXCEPTION 'cash outflow corrections exceed the outflow amount';
  END IF;
  conciliado_turno := COALESCE((SELECT sum("importeDecimal") FROM "conciliaciones_egresos_caja" WHERE "turnoCajaId" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId"), 0);
  IF conciliado_turno + NEW."importeDecimal" > turno."efectivoContadoDecimal" - turno."efectivoEsperadoDecimal" THEN
    RAISE EXCEPTION 'cash outflow conciliation exceeds the closed shift surplus';
  END IF;
  PERFORM "f10d1_validar_ajuste_proveedor"(NEW."negocioId", NEW."egresoId", NEW."obligacionAjusteId", NEW."importeDecimal", 'ERROR_DE_CARGA');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "conciliaciones_egresos_caja_guard_trigger"
  BEFORE INSERT OR UPDATE ON "conciliaciones_egresos_caja"
  FOR EACH ROW EXECUTE FUNCTION "guard_conciliacion_egreso_caja"();

-- ---------------------------------------------------------------------------
-- Recupero: operación RECUPERO_EGRESO en el turno ABIERTO que recibe el efectivo, una sola pata positiva
-- en la cuenta de efectivo de esa caja; la fila del recupero la vincula con el egreso (tope compartido).
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_operacion_recupero_egreso"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."tipo" = 'RECUPERO_EGRESO' OR NEW."tipo" = 'RECUPERO_EGRESO' THEN
      IF NEW."tipo" IS DISTINCT FROM OLD."tipo"
         OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
         OR NEW."turnoCajaId" IS DISTINCT FROM OLD."turnoCajaId"
         OR NEW."revierteOperacionId" IS DISTINCT FROM OLD."revierteOperacionId"
         OR NEW."cobroVentaId" IS DISTINCT FROM OLD."cobroVentaId"
         OR NEW."actorTipo" IS DISTINCT FROM OLD."actorTipo"
         OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
         OR NEW."estado" IS DISTINCT FROM OLD."estado"
         OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
        RAISE EXCEPTION 'cash outflow recovery operation is immutable';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."tipo" = 'RECUPERO_EGRESO' THEN
    IF NEW."turnoCajaId" IS NULL OR NEW."revierteOperacionId" IS NOT NULL OR NEW."cobroVentaId" IS NOT NULL
       OR NEW."actorTipo" <> 'NEGOCIO' OR NEW."actorId" <> NEW."negocioId" THEN
      RAISE EXCEPTION 'cash outflow recovery requires an open shift';
    END IF;
    PERFORM 1 FROM "turnos_caja" WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" AND "estado" = 'ABIERTO';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cash outflow recovery requires an open shift';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "operaciones_financieras_recupero_egreso_guard_trigger"
  BEFORE INSERT OR UPDATE ON "operaciones_financieras"
  FOR EACH ROW EXECUTE FUNCTION "guard_operacion_recupero_egreso"();

CREATE FUNCTION "guard_movimiento_recupero_egreso"() RETURNS trigger AS $$
DECLARE
  op RECORD;
  cta RECORD;
  turno RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM 1 FROM "operaciones_financieras" WHERE "id" IN (OLD."operacionId", NEW."operacionId") AND "tipo" = 'RECUPERO_EGRESO';
    IF FOUND THEN
      RAISE EXCEPTION 'cash outflow recovery movement is immutable';
    END IF;
    RETURN NEW;
  END IF;
  SELECT "tipo", "negocioId", "turnoCajaId" INTO op FROM "operaciones_financieras" WHERE "id" = NEW."operacionId";
  IF NOT FOUND OR op."tipo" <> 'RECUPERO_EGRESO' THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM "movimientos_financieros" WHERE "operacionId" = NEW."operacionId";
  IF FOUND THEN
    RAISE EXCEPTION 'cash outflow recovery operation must have exactly one movement';
  END IF;
  SELECT "tipo", "negocioId", "cajaFisicaId" INTO cta FROM "cuentas_financieras" WHERE "id" = NEW."cuentaId";
  IF NOT FOUND OR cta."tipo" <> 'EFECTIVO' OR cta."cajaFisicaId" IS NULL OR cta."negocioId" <> NEW."negocioId" OR NEW."negocioId" <> op."negocioId" THEN
    RAISE EXCEPTION 'cash outflow recovery movement must use the receiving register cash account';
  END IF;
  SELECT "cajaFisicaId" INTO turno FROM "turnos_caja" WHERE "id" = op."turnoCajaId" AND "negocioId" = op."negocioId";
  IF NOT FOUND OR turno."cajaFisicaId" <> cta."cajaFisicaId" THEN
    RAISE EXCEPTION 'cash outflow recovery movement must use the receiving register cash account';
  END IF;
  IF NEW."importeDecimal" IS NULL OR NEW."importeDecimal" <= 0 THEN
    RAISE EXCEPTION 'cash outflow recovery movement must be positive and exact';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "movimientos_financieros_recupero_egreso_guard_trigger"
  BEFORE INSERT OR UPDATE ON "movimientos_financieros"
  FOR EACH ROW EXECUTE FUNCTION "guard_movimiento_recupero_egreso"();

CREATE FUNCTION "guard_recupero_egreso_caja"() RETURNS trigger AS $$
DECLARE
  eg RECORD;
  turno_original RECORD;
  op RECORD;
  patas RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'cash outflow recovery is immutable';
  END IF;
  SELECT "turnoCajaId", "importeDecimal" INTO eg
    FROM "egresos_caja" WHERE "id" = NEW."egresoId" AND "negocioId" = NEW."negocioId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cash outflow recovery is inconsistent'; END IF;
  PERFORM 1 FROM "compensaciones_egresos_caja" WHERE "egresoId" = NEW."egresoId" AND "negocioId" = NEW."negocioId";
  IF FOUND THEN RAISE EXCEPTION 'a compensated cash outflow cannot be corrected'; END IF;
  SELECT "estado" INTO turno_original FROM "turnos_caja" WHERE "id" = eg."turnoCajaId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND OR turno_original."estado" <> 'CERRADO_DECLARADO' THEN
    RAISE EXCEPTION 'cash outflow recovery requires the outflow shift to be closed';
  END IF;
  SELECT "tipo", "negocioId", "turnoCajaId" INTO op FROM "operaciones_financieras" WHERE "id" = NEW."operacionId";
  IF NOT FOUND OR op."tipo" <> 'RECUPERO_EGRESO' OR op."negocioId" <> NEW."negocioId" OR op."turnoCajaId" IS DISTINCT FROM NEW."turnoCajaId" THEN
    RAISE EXCEPTION 'cash outflow recovery is inconsistent';
  END IF;
  PERFORM 1 FROM "turnos_caja" WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" AND "cajaFisicaId" = NEW."cajaFisicaId" AND "estado" = 'ABIERTO';
  IF NOT FOUND THEN RAISE EXCEPTION 'cash outflow recovery requires an open shift'; END IF;
  SELECT count(*) AS n, COALESCE(sum(m."importeDecimal"), 0) AS total,
         COALESCE(bool_and(c."cajaFisicaId" = NEW."cajaFisicaId" AND c."tipo" = 'EFECTIVO'), false) AS misma_caja
    INTO patas
    FROM "movimientos_financieros" m JOIN "cuentas_financieras" c ON c."id" = m."cuentaId"
   WHERE m."operacionId" = NEW."operacionId";
  IF patas.n <> 1 OR patas.total <> NEW."importeDecimal" OR NOT patas.misma_caja THEN
    RAISE EXCEPTION 'cash outflow recovery ledger leg is inconsistent';
  END IF;
  IF "f10d1_corregido_egreso"(NEW."egresoId") + NEW."importeDecimal" > eg."importeDecimal" THEN
    RAISE EXCEPTION 'cash outflow corrections exceed the outflow amount';
  END IF;
  PERFORM "f10d1_validar_ajuste_proveedor"(NEW."negocioId", NEW."egresoId", NEW."obligacionAjusteId", NEW."importeDecimal", 'DIFERENCIA_ACORDADA');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recuperos_egresos_caja_guard_trigger"
  BEFORE INSERT OR UPDATE ON "recuperos_egresos_caja"
  FOR EACH ROW EXECUTE FUNCTION "guard_recupero_egreso_caja"();

-- Al confirmar la transacción: una operación RECUPERO_EGRESO nunca queda huérfana (sin su fila de recupero)
-- ni con patas incoherentes (exactamente una, igual al importe del recupero).
CREATE FUNCTION "guard_operacion_recupero_egreso_completa"() RETURNS trigger AS $$
DECLARE
  rec RECORD;
  patas RECORD;
BEGIN
  IF NEW."tipo" <> 'RECUPERO_EGRESO' THEN
    RETURN NULL;
  END IF;
  SELECT "importeDecimal" INTO rec FROM "recuperos_egresos_caja" WHERE "operacionId" = NEW."id";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cash outflow recovery operation requires its recovery row';
  END IF;
  SELECT count(*) AS n, COALESCE(sum("importeDecimal"), 0) AS total INTO patas FROM "movimientos_financieros" WHERE "operacionId" = NEW."id";
  IF patas.n <> 1 OR patas.total <> rec."importeDecimal" THEN
    RAISE EXCEPTION 'cash outflow recovery ledger leg is inconsistent';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "operaciones_financieras_recupero_egreso_completa_trigger"
  AFTER INSERT ON "operaciones_financieras"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "guard_operacion_recupero_egreso_completa"();

-- ---------------------------------------------------------------------------
-- Append-only frente a DELETE (salvo la cascada al eliminar el NEGOCIO completo, cuya fila ya no es visible).
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_delete_f10d1"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
  IF FOUND THEN
    RAISE EXCEPTION 'cash outflow correction history is append-only (%)', TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "conciliaciones_egresos_caja_delete_guard_trigger" BEFORE DELETE ON "conciliaciones_egresos_caja" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f10d1"();
CREATE TRIGGER "recuperos_egresos_caja_delete_guard_trigger" BEFORE DELETE ON "recuperos_egresos_caja" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f10d1"();

CREATE FUNCTION "guard_delete_operacion_recupero_egreso"() RETURNS trigger AS $$
BEGIN
  IF OLD."tipo" = 'RECUPERO_EGRESO' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND THEN
      RAISE EXCEPTION 'cash outflow recovery operation is immutable';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "operaciones_financieras_recupero_egreso_delete_guard_trigger" BEFORE DELETE ON "operaciones_financieras" FOR EACH ROW EXECUTE FUNCTION "guard_delete_operacion_recupero_egreso"();

CREATE FUNCTION "guard_delete_movimiento_recupero_egreso"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "operaciones_financieras" o
   WHERE o."id" = OLD."operacionId" AND o."tipo" = 'RECUPERO_EGRESO'
     AND EXISTS (SELECT 1 FROM "negocios" WHERE "id" = OLD."negocioId");
  IF FOUND THEN
    RAISE EXCEPTION 'cash outflow recovery movement is immutable';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "movimientos_financieros_recupero_egreso_delete_guard_trigger" BEFORE DELETE ON "movimientos_financieros" FOR EACH ROW EXECUTE FUNCTION "guard_delete_movimiento_recupero_egreso"();

-- ---------------------------------------------------------------------------
-- F5: un egreso con correcciones ya no se vincula ni se desvincula, y el ajuste de deuda de una corrección
-- no se anula (ajustes duplicados u huérfanos). Funciones y triggers NUEVOS: las guardas de F5 no cambian.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_credito_correccion_egreso_f10d1"() RETURNS trigger AS $$
BEGIN
  IF NEW."origen" <> 'PAGO_CAJA' OR NEW."egresoCajaId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF "f10d1_tiene_correcciones"(NEW."egresoCajaId") THEN
      RAISE EXCEPTION 'a cash outflow with post-close corrections cannot be linked to a supplier';
    END IF;
  ELSIF OLD."estado" = 'VIGENTE' AND NEW."estado" IS DISTINCT FROM OLD."estado" THEN
    IF "f10d1_tiene_correcciones"(NEW."egresoCajaId") THEN
      RAISE EXCEPTION 'a cash outflow with post-close corrections cannot be unlinked from its supplier';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "creditos_proveedor_correccion_egreso_f10d1_trigger"
  BEFORE INSERT OR UPDATE ON "creditos_proveedor"
  FOR EACH ROW EXECUTE FUNCTION "guard_credito_correccion_egreso_f10d1"();

CREATE FUNCTION "guard_obligacion_correccion_egreso_f10d1"() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" = 'VIGENTE' AND NEW."estado" IS DISTINCT FROM OLD."estado" THEN
    PERFORM 1 FROM "conciliaciones_egresos_caja" WHERE "obligacionAjusteId" = NEW."id";
    IF FOUND THEN RAISE EXCEPTION 'the supplier adjustment of a cash outflow correction cannot be cancelled'; END IF;
    PERFORM 1 FROM "recuperos_egresos_caja" WHERE "obligacionAjusteId" = NEW."id";
    IF FOUND THEN RAISE EXCEPTION 'the supplier adjustment of a cash outflow correction cannot be cancelled'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "obligaciones_proveedor_correccion_egreso_f10d1_trigger"
  BEFORE UPDATE ON "obligaciones_proveedor"
  FOR EACH ROW EXECUTE FUNCTION "guard_obligacion_correccion_egreso_f10d1"();
