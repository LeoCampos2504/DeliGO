-- F10-C2b / D-7 v2 — pago en efectivo hecho AL RECIBIR, asociado estructuralmente a la recepción.
-- Operador 2026-11-20, sólo desarrollo local. ADITIVA: una tabla nueva y su guarda; no modifica filas ni
-- tablas existentes (la salida de Caja de F10-C1 y los créditos de F5 quedan intactos e inmutables).
-- La fila vincula UNA salida PAGO_PROVEEDOR de Caja con la recepción que la originó (mismo negocio y mismo
-- proveedor). No mueve dinero: el dinero salió una sola vez por F10-C1. Al aprobar la recepción, el pago se
-- vincula como crédito de F5 (si no lo estaba) y se aplica a la deuda; el excedente queda como anticipo.

CREATE TABLE "pagos_recepcion" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "egresoCajaId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "creditoProveedorId" TEXT,
    "importeAplicadoDecimal" DECIMAL(12,2),
    "observacion" TEXT,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_recepcion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pagos_recepcion_origen_check" CHECK ("origen" IN ('CAJERO_AL_RECIBIR', 'ASOCIADO_DUENO')),
    CONSTRAINT "pagos_recepcion_estado_check" CHECK ("estado" IN ('PENDIENTE', 'OBSERVADO', 'ACREDITADO')),
    CONSTRAINT "pagos_recepcion_actor_check" CHECK ("actorTipo" IN ('NEGOCIO', 'EMPLEADO')),
    CONSTRAINT "pagos_recepcion_acreditado_check" CHECK (("estado" = 'ACREDITADO') = ("creditoProveedorId" IS NOT NULL)),
    CONSTRAINT "pagos_recepcion_observacion_check" CHECK ("estado" <> 'OBSERVADO' OR "observacion" IS NOT NULL)
);

-- Una salida de Caja pertenece a lo sumo a UNA recepción.
CREATE UNIQUE INDEX "pagos_recepcion_negocioId_egresoCajaId_key" ON "pagos_recepcion" ("negocioId", "egresoCajaId");
CREATE INDEX "pagos_recepcion_negocioId_recepcionId_idx" ON "pagos_recepcion" ("negocioId", "recepcionId");

ALTER TABLE "pagos_recepcion" ADD CONSTRAINT "pagos_recepcion_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagos_recepcion" ADD CONSTRAINT "pagos_recepcion_recepcionId_negocioId_fkey" FOREIGN KEY ("recepcionId", "negocioId") REFERENCES "recepciones"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagos_recepcion" ADD CONSTRAINT "pagos_recepcion_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagos_recepcion" ADD CONSTRAINT "pagos_recepcion_egresoCajaId_negocioId_fkey" FOREIGN KEY ("egresoCajaId", "negocioId") REFERENCES "egresos_caja"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "pagos_recepcion" ADD CONSTRAINT "pagos_recepcion_credito_fkey" FOREIGN KEY ("creditoProveedorId", "proveedorId", "negocioId") REFERENCES "creditos_proveedor"("id", "proveedorId", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Guarda: salida PAGO_PROVEEDOR no compensada del mismo negocio, proveedor = el de la recepción; identidad
-- inmutable; ACREDITADO es final; nunca se borra (salvo la cascada del negocio).
CREATE OR REPLACE FUNCTION "guard_pago_recepcion"() RETURNS trigger AS $$
DECLARE
  r RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
    IF FOUND THEN RAISE EXCEPTION 'reception payment link cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT "proveedorId", "estado" INTO r FROM "recepciones" WHERE "id" = NEW."recepcionId" AND "negocioId" = NEW."negocioId";
    IF NOT FOUND OR r."proveedorId" <> NEW."proveedorId" THEN RAISE EXCEPTION 'reception payment must use the reception supplier'; END IF;
    IF r."estado" NOT IN ('BORRADOR', 'PENDIENTE_APROBACION') THEN RAISE EXCEPTION 'reception payment requires an open reception'; END IF;
    PERFORM 1 FROM "egresos_caja" WHERE "id" = NEW."egresoCajaId" AND "negocioId" = NEW."negocioId" AND "naturaleza" = 'PAGO_PROVEEDOR';
    IF NOT FOUND THEN RAISE EXCEPTION 'reception payment must be a supplier payment outflow'; END IF;
    PERFORM 1 FROM "compensaciones_egresos_caja" WHERE "egresoId" = NEW."egresoCajaId";
    IF FOUND THEN RAISE EXCEPTION 'reception payment cannot use a compensated outflow'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."negocioId" <> OLD."negocioId" OR NEW."recepcionId" <> OLD."recepcionId" OR NEW."proveedorId" <> OLD."proveedorId"
     OR NEW."egresoCajaId" <> OLD."egresoCajaId" OR NEW."origen" <> OLD."origen" OR NEW."actorTipo" <> OLD."actorTipo" OR NEW."actorId" <> OLD."actorId"
     OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'reception payment identity is immutable';
  END IF;
  IF OLD."estado" = 'ACREDITADO' THEN RAISE EXCEPTION 'a credited reception payment is final'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "pagos_recepcion_guard_trigger" BEFORE INSERT OR UPDATE OR DELETE ON "pagos_recepcion" FOR EACH ROW EXECUTE FUNCTION "guard_pago_recepcion"();
