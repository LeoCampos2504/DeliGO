-- F10-C2b — pedido con TOTAL informado por el proveedor y costos unitarios todavía desconocidos.
-- Operador 2026-11-20, sólo desarrollo local. ADITIVA: dos columnas opcionales en "compras" y una guarda; los
-- pedidos existentes quedan igual (NULL = sin total informado). El total es una referencia comercial: no genera
-- deuda ni mueve stock; los costos reales salen de la recepción aprobada. Los costos unitarios desconocidos quedan
-- NULL en compra_lineas (nunca cero ni un reparto inventado).

ALTER TABLE "compras" ADD COLUMN "totalInformadoDecimal" DECIMAL(12,2);
ALTER TABLE "compras" ADD COLUMN "totalInformadoIva" TEXT;
ALTER TABLE "compras" ADD CONSTRAINT "compras_total_informado_check" CHECK (
  ("totalInformadoDecimal" IS NULL AND "totalInformadoIva" IS NULL)
  OR ("totalInformadoDecimal" > 0 AND "totalInformadoIva" IN ('INCLUYE_IVA', 'SIN_IVA', 'NO_SE_SABE'))
);

-- El total informado es parte del pedido: inmutable como el resto (la guarda de C2a no conoce estas columnas).
CREATE OR REPLACE FUNCTION "guard_compra_total_informado"() RETURNS trigger AS $$
BEGIN
  IF NEW."totalInformadoDecimal" IS DISTINCT FROM OLD."totalInformadoDecimal" OR NEW."totalInformadoIva" IS DISTINCT FROM OLD."totalInformadoIva" THEN
    RAISE EXCEPTION 'purchase order reported total is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "compras_total_informado_guard_trigger" BEFORE UPDATE ON "compras" FOR EACH ROW EXECUTE FUNCTION "guard_compra_total_informado"();
