-- F4-C4 — Servicio de cambios comerciales y ventas adicionales vinculadas.
-- Decisiones del operador (2026-11-09): D2 (devoluciones de ventas CAMBIO),
-- D3/P1 (umbrales de advertencias configurables por negocio), D4/P2 (sin
-- venta adicional vinculada a una venta anulada o devuelta por completo).
-- No modifica ninguna migración aplicada. Toda fila existente sigue siendo
-- válida; no se reescribe ningún dato. Reglas: codex-reports/F4_C_SALE_EXCHANGES.md.

-- ---------------------------------------------------------------------------
-- 1. D2 — una devolución (o un cambio) de una venta CAMBIO guarda el medio
--    resumen real de esa venta. La restricción de F4-A sólo se AMPLÍA:
--    EFECTIVO / TRANSFERENCIA / OTRO siguen admitidos y se agrega CAMBIO. El
--    medio del reintegro (reintegroMedio) NO cambia: siempre un medio real.
-- ---------------------------------------------------------------------------
ALTER TABLE "devoluciones_venta" DROP CONSTRAINT "devoluciones_venta_metodo_check";
ALTER TABLE "devoluciones_venta"
  ADD CONSTRAINT "devoluciones_venta_metodo_check" CHECK ("metodoPagoVenta" IN ('EFECTIVO', 'TRANSFERENCIA', 'OTRO', 'CAMBIO'));

-- metodoPagoVenta es la copia del medio resumen de SU venta (nunca otro valor;
-- CAMBIO sólo para ventas CAMBIO). Sólo al insertar: las filas existentes ya
-- son inmutables (F4-A) y no se revalidan.
CREATE FUNCTION "guard_devolucion_metodo_venta"() RETURNS trigger AS $$
DECLARE
  metodo TEXT;
BEGIN
  SELECT "metodoPago" INTO metodo FROM "ventas_caja" WHERE "id" = NEW."ventaId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND OR metodo IS DISTINCT FROM NEW."metodoPagoVenta" THEN
    RAISE EXCEPTION 'sale return payment method must match its sale';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "devoluciones_venta_metodo_venta_trigger"
  BEFORE INSERT ON "devoluciones_venta"
  FOR EACH ROW EXECUTE FUNCTION "guard_devolucion_metodo_venta"();

-- ---------------------------------------------------------------------------
-- 2. D4/P2 — una venta ADICIONAL vinculada sólo se registra sobre una venta
--    del mismo negocio que no fue anulada y que todavía conserva unidades sin
--    devolver (línea vigente: la última corrección F4-B, si existe). En esos
--    casos corresponde una venta nueva e independiente.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_venta_adicional_origen"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "ventas_caja" WHERE "id" = NEW."ventaOrigenId" AND "negocioId" = NEW."negocioId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'linked sale must reference a sale of the same business';
  END IF;
  PERFORM 1 FROM "devoluciones_venta" WHERE "ventaId" = NEW."ventaOrigenId" AND "tipo" = 'ANULACION';
  IF FOUND THEN
    RAISE EXCEPTION 'additional sale cannot be linked to a voided sale';
  END IF;
  PERFORM 1 FROM "venta_items" vi
    WHERE vi."ventaId" = NEW."ventaOrigenId"
      AND ROUND(COALESCE(
            (SELECT l."cantidad" FROM "correcciones_venta_lineas" l
               JOIN "correcciones_venta" c ON c."id" = l."correccionId"
              WHERE l."ventaItemId" = vi."id"
              ORDER BY c."secuencia" DESC LIMIT 1),
            vi."cantidad")::numeric, 3)
        > ROUND(COALESCE(
            (SELECT SUM(d."cantidad") FROM "devoluciones_venta_items" d WHERE d."ventaItemId" = vi."id"),
            0)::numeric, 3);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'additional sale cannot be linked to a fully returned sale';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sin origen, el CHECK ventas_caja_vinculo_check (F4-C3) es el que rechaza.
CREATE TRIGGER "ventas_caja_adicional_origen_trigger"
  BEFORE INSERT ON "ventas_caja"
  FOR EACH ROW WHEN (NEW."vinculoTipo" = 'ADICIONAL' AND NEW."ventaOrigenId" IS NOT NULL)
  EXECUTE FUNCTION "guard_venta_adicional_origen"();

-- ---------------------------------------------------------------------------
-- 3. D3/P1 — umbrales de las advertencias informativas de un cambio,
--    configurables por negocio. NULL = valor predeterminado (30 días, 3
--    cambios anteriores en la cadena). Nunca bloquean una operación.
-- ---------------------------------------------------------------------------
ALTER TABLE "negocios" ADD COLUMN "cambioAvisoAntiguedadDias" INTEGER,
ADD COLUMN "cambioAvisoCadenaCambios" INTEGER;

ALTER TABLE "negocios"
  ADD CONSTRAINT "negocios_cambio_aviso_umbrales_check" CHECK (
    ("cambioAvisoAntiguedadDias" IS NULL OR "cambioAvisoAntiguedadDias" BETWEEN 1 AND 3650)
    AND ("cambioAvisoCadenaCambios" IS NULL OR "cambioAvisoCadenaCambios" BETWEEN 1 AND 1000)
  );

-- Forma versionada de las advertencias registradas en cada cambio.
ALTER TABLE "cambios_venta"
  ADD CONSTRAINT "cambios_venta_advertencias_check" CHECK (
    "advertencias" IS NULL
    OR (jsonb_typeof("advertencias") = 'object' AND jsonb_typeof("advertencias" -> 'items') = 'array'
        AND ("advertencias" ->> 'version') IS NOT NULL)
  );
