-- F4-C5 (D5, opción B, autorizada por el operador 2026-11-09) — verificación y
-- cierre definitivo de las claves de idempotencia de las operaciones
-- comerciales de Caja: cambios (cambios_venta) y ventas adicionales vinculadas
-- (ventas_caja con vinculoTipo = ADICIONAL).
--
-- Una sola tabla con clave primaria (negocioId, idempotencyKey) coordina a la
-- operación y a su verificación mediante el índice único, no mediante una
-- lectura previa seguida de una escritura:
--   * la operación, al insertar su fila, inserta aquí REGISTRADO (triggers
--     AFTER INSERT, independientes del código del servicio);
--   * la verificación, cuando no existe la operación, inserta aquí CERRADO;
--   * si ambas compiten, PostgreSQL hace esperar a la segunda hasta que la
--     primera confirma y entonces la rechaza (violación de unicidad, o fallo de
--     serialización bajo SERIALIZABLE, que el ejecutor reintenta): exactamente
--     una de las dos queda, nunca ambas;
--   * una solicitud original que llega después de un CERRADO falla al insertar
--     su fila: toda su transacción se revierte y no escribe nada.
-- No modifica ninguna migración aplicada ni reescribe datos existentes: las
-- operaciones ya registradas reciben su fila REGISTRADO (relleno).

CREATE TABLE "intentos_caja_comerciales" (
    "negocioId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "ventaOrigenId" TEXT NOT NULL,
    "cambioVentaId" TEXT,
    "ventaId" TEXT,
    "actorTipo" TEXT,
    "actorId" TEXT,
    "idempotencyFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_caja_comerciales_pkey" PRIMARY KEY ("negocioId","idempotencyKey"),
    CONSTRAINT "intentos_caja_comerciales_tipo_check" CHECK ("tipo" IN ('CAMBIO', 'ADICIONAL')),
    CONSTRAINT "intentos_caja_comerciales_forma_check" CHECK (
      (
        "estado" = 'REGISTRADO'
        AND "actorTipo" IS NULL AND "actorId" IS NULL AND "idempotencyFingerprint" IS NULL
        AND (
          ("tipo" = 'CAMBIO' AND "cambioVentaId" IS NOT NULL AND "ventaId" IS NULL)
          OR ("tipo" = 'ADICIONAL' AND "ventaId" IS NOT NULL AND "cambioVentaId" IS NULL)
        )
      )
      OR (
        "estado" = 'CERRADO'
        AND "cambioVentaId" IS NULL AND "ventaId" IS NULL
        AND "actorTipo" IN ('NEGOCIO', 'EMPLEADO') AND "actorId" IS NOT NULL
        AND "idempotencyFingerprint" IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX "intentos_caja_comerciales_cambioVentaId_key" ON "intentos_caja_comerciales"("cambioVentaId");
CREATE UNIQUE INDEX "intentos_caja_comerciales_ventaId_key" ON "intentos_caja_comerciales"("ventaId");
CREATE INDEX "intentos_caja_comerciales_ventaOrigenId_idx" ON "intentos_caja_comerciales"("ventaOrigenId");

ALTER TABLE "intentos_caja_comerciales" ADD CONSTRAINT "intentos_caja_comerciales_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intentos_caja_comerciales" ADD CONSTRAINT "intentos_caja_comerciales_ventaOrigenId_fkey" FOREIGN KEY ("ventaOrigenId") REFERENCES "ventas_caja"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "intentos_caja_comerciales" ADD CONSTRAINT "intentos_caja_comerciales_cambioVentaId_fkey" FOREIGN KEY ("cambioVentaId") REFERENCES "cambios_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intentos_caja_comerciales" ADD CONSTRAINT "intentos_caja_comerciales_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Relleno: cada operación comercial ya registrada reserva su clave.
INSERT INTO "intentos_caja_comerciales" ("negocioId", "idempotencyKey", "tipo", "estado", "ventaOrigenId", "cambioVentaId", "createdAt")
SELECT "negocioId", "idempotencyKey", 'CAMBIO', 'REGISTRADO', "ventaOrigenId", "id", "createdAt" FROM "cambios_venta";

INSERT INTO "intentos_caja_comerciales" ("negocioId", "idempotencyKey", "tipo", "estado", "ventaOrigenId", "ventaId", "createdAt")
SELECT "negocioId", "idempotencyKey", 'ADICIONAL', 'REGISTRADO', "ventaOrigenId", "id", "createdAt"
  FROM "ventas_caja"
 WHERE "vinculoTipo" = 'ADICIONAL' AND "idempotencyKey" IS NOT NULL AND "ventaOrigenId" IS NOT NULL;

-- La operación reserva su clave en la misma transacción que la registra.
CREATE FUNCTION "reservar_clave_cambio_venta"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "intentos_caja_comerciales" ("negocioId", "idempotencyKey", "tipo", "estado", "ventaOrigenId", "cambioVentaId")
  VALUES (NEW."negocioId", NEW."idempotencyKey", 'CAMBIO', 'REGISTRADO', NEW."ventaOrigenId", NEW."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cambios_venta_reservar_clave_trigger"
  AFTER INSERT ON "cambios_venta"
  FOR EACH ROW EXECUTE FUNCTION "reservar_clave_cambio_venta"();

CREATE FUNCTION "reservar_clave_venta_adicional"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "intentos_caja_comerciales" ("negocioId", "idempotencyKey", "tipo", "estado", "ventaOrigenId", "ventaId")
  VALUES (NEW."negocioId", NEW."idempotencyKey", 'ADICIONAL', 'REGISTRADO', NEW."ventaOrigenId", NEW."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ventas_caja_reservar_clave_adicional_trigger"
  AFTER INSERT ON "ventas_caja"
  FOR EACH ROW
  WHEN (NEW."vinculoTipo" = 'ADICIONAL' AND NEW."idempotencyKey" IS NOT NULL AND NEW."ventaOrigenId" IS NOT NULL)
  EXECUTE FUNCTION "reservar_clave_venta_adicional"();

-- Un cierre sólo nombra una venta del mismo negocio, y ninguna fila cambia
-- después (un CERRADO nunca vuelve a abrir su clave).
CREATE FUNCTION "guard_intento_caja_comercial"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'commercial attempt claims are immutable';
  END IF;
  PERFORM 1 FROM "ventas_caja" WHERE "id" = NEW."ventaOrigenId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'commercial attempt claim must reference a sale of the same business';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "intentos_caja_comerciales_guard_trigger"
  BEFORE INSERT OR UPDATE ON "intentos_caja_comerciales"
  FOR EACH ROW EXECUTE FUNCTION "guard_intento_caja_comercial"();
