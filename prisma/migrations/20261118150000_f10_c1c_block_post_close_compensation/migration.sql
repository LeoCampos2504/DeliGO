-- F10-C1c — compensación de egresos: bloqueo explícito de la compensación
-- POSTERIOR AL CIERRE (operador, 2026-11-18: sólo entorno local).
-- ADITIVA: no crea ni modifica tablas, columnas ni filas. Reemplaza el cuerpo de
-- dos funciones de guarda de F10-C1a (los triggers siguen siendo los mismos).
--
-- Motivo (D-C1c-1): después del cierre el efectivo declarado, el esperado y la
-- diferencia quedaron congelados y el efectivo pasó a custodia (la entrega NO es
-- un movimiento del libro). Una REVERSION sin turno sumaría efectivo a la cuenta
-- de la caja que ningún cajón tiene: dinero ficticio. La corrección posterior al
-- cierre necesita la conciliación de cierres / cuentas de custodia de F10-D y
-- queda BLOQUEADA también en la base (defensa en profundidad del 409 de la API).
-- La compensación con el turno ABIERTO (mismo turno, misma cuenta, importe total,
-- una sola vez) no cambia. F10-D deberá levantar este bloqueo con su propio diseño.

CREATE OR REPLACE FUNCTION "guard_operacion_egreso_caja"() RETURNS trigger AS $$
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
    -- F10-C1c: a shift-less reversion (after the close) is blocked until F10-D.
    IF NEW."turnoCajaId" IS NULL THEN
      RAISE EXCEPTION 'cash outflow compensation after the close is blocked until the closing reconciliation';
    END IF;
    IF NEW."turnoCajaId" <> orig."turnoCajaId" THEN
      RAISE EXCEPTION 'cash outflow reversion must stay in its own shift or have no shift';
    END IF;
    PERFORM 1 FROM "turnos_caja"
     WHERE "id" = NEW."turnoCajaId" AND "negocioId" = NEW."negocioId" AND "estado" = 'ABIERTO';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'cash outflow reversion cannot change a closed shift';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "guard_compensacion_egreso_caja"() RETURNS trigger AS $$
DECLARE
  egreso RECORD;
  op RECORD;
  turno RECORD;
  patas RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'cash outflow compensation is immutable';
  END IF;
  -- F10-C1c: only TURNO_ABIERTO is executable; POSTERIOR_AL_CIERRE stays in the
  -- schema for the F10-D design but cannot be written.
  IF NEW."momento" = 'POSTERIOR_AL_CIERRE' THEN
    RAISE EXCEPTION 'cash outflow compensation after the close is blocked until the closing reconciliation';
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
