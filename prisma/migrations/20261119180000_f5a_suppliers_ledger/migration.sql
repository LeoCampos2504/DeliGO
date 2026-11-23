-- F5-A — proveedores y motor ÚNICO de cuenta corriente (operador, 2026-11-19: sólo desarrollo local).
-- ADITIVA: 7 tablas nuevas, funciones y triggers propios. No modifica filas existentes ni ninguna tabla
-- o función de F10-C1, ventas, stock o libro financiero. Único contacto con F10-C1 (D-8): un trigger
-- NUEVO sobre compensaciones_egresos_caja que impide compensar un egreso vinculado a un proveedor.
-- Diseño: codex-reports/F10_C2_F5_COMPRAS_RECEPCION_DISENO.md v2 §4, §5, §7, §10.

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreNormalizado" TEXT NOT NULL,
    "cuit" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor_cambios" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "campos" TEXT NOT NULL,
    "valoresAnteriores" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedor_cambios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligaciones_proveedor" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "naturalezaAjuste" TEXT,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "comprobanteTipo" TEXT,
    "comprobanteNumero" TEXT,
    "comprobanteFecha" TIMESTAMP(3),
    "recepcionId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
    "anuladaEn" TIMESTAMP(3),
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obligaciones_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos_proveedor" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL,
    "egresoCajaId" TEXT,
    "medio" TEXT,
    "referencia" TEXT,
    "fechaPago" TIMESTAMP(3),
    "cuentaOrigenDeclarada" TEXT,
    "naturalezaAjuste" TEXT,
    "motivo" TEXT,
    "confirmadoEn" TIMESTAMP(3),
    "confirmadoPorId" TEXT,
    "cerradoEn" TIMESTAMP(3),
    "conciliacionEstado" TEXT,
    "conciliadoEn" TIMESTAMP(3),
    "conciliacionRef" TEXT,
    "compraReferenciaId" TEXT,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creditos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_cuenta_proveedor" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "obligacionId" TEXT,
    "creditoId" TEXT,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_cuenta_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operaciones_asignacion" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_pago" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "creditoId" TEXT NOT NULL,
    "obligacionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "importeDecimal" DECIMAL(12,2) NOT NULL,
    "revierteAsignacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proveedores_negocioId_nombreNormalizado_idx" ON "proveedores"("negocioId", "nombreNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_negocioId_idempotencyKey_key" ON "proveedores"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_id_negocioId_key" ON "proveedores"("id", "negocioId");

-- CreateIndex
CREATE INDEX "proveedor_cambios_negocioId_proveedorId_createdAt_idx" ON "proveedor_cambios"("negocioId", "proveedorId", "createdAt");

-- CreateIndex
CREATE INDEX "obligaciones_proveedor_negocioId_proveedorId_estado_idx" ON "obligaciones_proveedor"("negocioId", "proveedorId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "obligaciones_proveedor_negocioId_idempotencyKey_key" ON "obligaciones_proveedor"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "obligaciones_proveedor_id_negocioId_key" ON "obligaciones_proveedor"("id", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "obligaciones_proveedor_id_proveedorId_negocioId_key" ON "obligaciones_proveedor"("id", "proveedorId", "negocioId");

-- CreateIndex
CREATE INDEX "creditos_proveedor_negocioId_proveedorId_estado_idx" ON "creditos_proveedor"("negocioId", "proveedorId", "estado");

-- CreateIndex
CREATE INDEX "creditos_proveedor_egresoCajaId_idx" ON "creditos_proveedor"("egresoCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "creditos_proveedor_negocioId_idempotencyKey_key" ON "creditos_proveedor"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "creditos_proveedor_id_negocioId_key" ON "creditos_proveedor"("id", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "creditos_proveedor_id_proveedorId_negocioId_key" ON "creditos_proveedor"("id", "proveedorId", "negocioId");

-- CreateIndex
CREATE INDEX "eventos_cuenta_proveedor_negocioId_obligacionId_idx" ON "eventos_cuenta_proveedor"("negocioId", "obligacionId");

-- CreateIndex
CREATE INDEX "eventos_cuenta_proveedor_negocioId_creditoId_idx" ON "eventos_cuenta_proveedor"("negocioId", "creditoId");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_cuenta_proveedor_negocioId_idempotencyKey_key" ON "eventos_cuenta_proveedor"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "operaciones_asignacion_negocioId_idempotencyKey_key" ON "operaciones_asignacion"("negocioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "operaciones_asignacion_id_proveedorId_negocioId_key" ON "operaciones_asignacion"("id", "proveedorId", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_pago_revierteAsignacionId_key" ON "asignaciones_pago"("revierteAsignacionId");

-- CreateIndex
CREATE INDEX "asignaciones_pago_negocioId_creditoId_idx" ON "asignaciones_pago"("negocioId", "creditoId");

-- CreateIndex
CREATE INDEX "asignaciones_pago_negocioId_obligacionId_idx" ON "asignaciones_pago"("negocioId", "obligacionId");

-- CreateIndex
CREATE INDEX "asignaciones_pago_operacionId_idx" ON "asignaciones_pago"("operacionId");

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor_cambios" ADD CONSTRAINT "proveedor_cambios_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_proveedor" ADD CONSTRAINT "obligaciones_proveedor_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligaciones_proveedor" ADD CONSTRAINT "obligaciones_proveedor_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_proveedor" ADD CONSTRAINT "creditos_proveedor_egresoCajaId_negocioId_fkey" FOREIGN KEY ("egresoCajaId", "negocioId") REFERENCES "egresos_caja"("id", "negocioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_cuenta_proveedor" ADD CONSTRAINT "eventos_cuenta_proveedor_obligacionId_negocioId_fkey" FOREIGN KEY ("obligacionId", "negocioId") REFERENCES "obligaciones_proveedor"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_cuenta_proveedor" ADD CONSTRAINT "eventos_cuenta_proveedor_creditoId_negocioId_fkey" FOREIGN KEY ("creditoId", "negocioId") REFERENCES "creditos_proveedor"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_asignacion" ADD CONSTRAINT "operaciones_asignacion_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_asignacion" ADD CONSTRAINT "operaciones_asignacion_proveedorId_negocioId_fkey" FOREIGN KEY ("proveedorId", "negocioId") REFERENCES "proveedores"("id", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_pago" ADD CONSTRAINT "asignaciones_pago_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_pago" ADD CONSTRAINT "asignaciones_pago_operacionId_proveedorId_negocioId_fkey" FOREIGN KEY ("operacionId", "proveedorId", "negocioId") REFERENCES "operaciones_asignacion"("id", "proveedorId", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_pago" ADD CONSTRAINT "asignaciones_pago_creditoId_proveedorId_negocioId_fkey" FOREIGN KEY ("creditoId", "proveedorId", "negocioId") REFERENCES "creditos_proveedor"("id", "proveedorId", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_pago" ADD CONSTRAINT "asignaciones_pago_obligacionId_proveedorId_negocioId_fkey" FOREIGN KEY ("obligacionId", "proveedorId", "negocioId") REFERENCES "obligaciones_proveedor"("id", "proveedorId", "negocioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_pago" ADD CONSTRAINT "asignaciones_pago_revierteAsignacionId_fkey" FOREIGN KEY ("revierteAsignacionId") REFERENCES "asignaciones_pago"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- ===========================================================================
-- F5-A — invariantes (no representables en el DSL de Prisma)
-- ===========================================================================

-- CUIT argentino: 11 dígitos, prefijo válido y dígito verificador módulo 11.
CREATE FUNCTION "f5a_cuit_valido"(c TEXT) RETURNS boolean AS $$
DECLARE
  pesos INT[] := ARRAY[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  suma INT := 0;
  dv INT;
BEGIN
  IF c IS NULL THEN RETURN true; END IF;
  IF c !~ '^[0-9]{11}$' THEN RETURN false; END IF;
  IF substr(c, 1, 2) NOT IN ('20', '23', '24', '25', '26', '27', '30', '33', '34') THEN RETURN false; END IF;
  FOR i IN 1..10 LOOP
    suma := suma + substr(c, i, 1)::INT * pesos[i];
  END LOOP;
  dv := 11 - (suma % 11);
  IF dv = 11 THEN dv := 0; END IF;
  IF dv = 10 THEN RETURN false; END IF;
  RETURN dv = substr(c, 11, 1)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Asignado VIGENTE de un crédito / de una obligación (asignaciones no desafectadas).
CREATE FUNCTION "f5a_asignado_credito"(p_credito TEXT) RETURNS NUMERIC AS $$
  SELECT COALESCE(sum(a."importeDecimal"), 0) FROM "asignaciones_pago" a
   WHERE a."creditoId" = p_credito AND a."tipo" = 'ASIGNACION'
     AND NOT EXISTS (SELECT 1 FROM "asignaciones_pago" d WHERE d."revierteAsignacionId" = a."id");
$$ LANGUAGE sql STABLE;

CREATE FUNCTION "f5a_asignado_obligacion"(p_obligacion TEXT) RETURNS NUMERIC AS $$
  SELECT COALESCE(sum(a."importeDecimal"), 0) FROM "asignaciones_pago" a
   WHERE a."obligacionId" = p_obligacion AND a."tipo" = 'ASIGNACION'
     AND NOT EXISTS (SELECT 1 FROM "asignaciones_pago" d WHERE d."revierteAsignacionId" = a."id");
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------------
ALTER TABLE "proveedores"
  ADD CONSTRAINT "proveedores_nombre_check" CHECK (length(btrim("nombre")) BETWEEN 1 AND 120 AND length("nombreNormalizado") BETWEEN 1 AND 120),
  ADD CONSTRAINT "proveedores_cuit_check" CHECK ("f5a_cuit_valido"("cuit")),
  ADD CONSTRAINT "proveedores_textos_check" CHECK (
    ("telefono" IS NULL OR length(btrim("telefono")) BETWEEN 1 AND 40)
    AND ("email" IS NULL OR length(btrim("email")) BETWEEN 3 AND 120)
    AND ("notas" IS NULL OR length(btrim("notas")) BETWEEN 1 AND 500)
  );
-- D-1: CUIT único por negocio cuando existe (otro negocio puede tener el mismo).
CREATE UNIQUE INDEX "proveedores_negocio_cuit_unico" ON "proveedores"("negocioId", "cuit") WHERE "cuit" IS NOT NULL;

CREATE FUNCTION "guard_proveedor_f5a"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'supplier identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "proveedores_guard_trigger" BEFORE UPDATE ON "proveedores" FOR EACH ROW EXECUTE FUNCTION "guard_proveedor_f5a"();

CREATE FUNCTION "guard_append_only_f5a"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'supplier ledger history is append-only (%)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "proveedor_cambios_guard_trigger" BEFORE UPDATE ON "proveedor_cambios" FOR EACH ROW EXECUTE FUNCTION "guard_append_only_f5a"();
CREATE TRIGGER "eventos_cuenta_proveedor_guard_trigger" BEFORE UPDATE ON "eventos_cuenta_proveedor" FOR EACH ROW EXECUTE FUNCTION "guard_append_only_f5a"();
CREATE TRIGGER "operaciones_asignacion_guard_trigger" BEFORE UPDATE ON "operaciones_asignacion" FOR EACH ROW EXECUTE FUNCTION "guard_append_only_f5a"();

-- ---------------------------------------------------------------------------
-- Obligaciones (lo que se le debe al proveedor)
-- ---------------------------------------------------------------------------
ALTER TABLE "obligaciones_proveedor"
  -- F5-A: sólo saldo inicial y ajustes del dueño. F10-C2a agregará RECEPCION / CARGO_ACCESORIO.
  ADD CONSTRAINT "obligaciones_proveedor_origen_check" CHECK ("origen" IN ('SALDO_INICIAL', 'AJUSTE_DEUDA')),
  ADD CONSTRAINT "obligaciones_proveedor_naturaleza_check" CHECK (
    ("origen" = 'AJUSTE_DEUDA' AND "naturalezaAjuste" IN ('ERROR_DE_CARGA', 'DIFERENCIA_ACORDADA', 'RECARGO', 'OTRO'))
    OR ("origen" <> 'AJUSTE_DEUDA' AND "naturalezaAjuste" IS NULL)
  ),
  ADD CONSTRAINT "obligaciones_proveedor_importe_check" CHECK ("importeDecimal" > 0),
  ADD CONSTRAINT "obligaciones_proveedor_textos_check" CHECK (
    length(btrim("descripcion")) BETWEEN 1 AND 500
    AND ("comprobanteTipo" IS NULL OR length(btrim("comprobanteTipo")) BETWEEN 1 AND 40)
    AND ("comprobanteNumero" IS NULL OR length(btrim("comprobanteNumero")) BETWEEN 1 AND 60)
  ),
  -- Reservado F10-C2a: ninguna obligación de F5-A viene de una recepción.
  ADD CONSTRAINT "obligaciones_proveedor_recepcion_check" CHECK ("recepcionId" IS NULL),
  ADD CONSTRAINT "obligaciones_proveedor_estado_check" CHECK (
    ("estado" = 'VIGENTE' AND "anuladaEn" IS NULL) OR ("estado" = 'ANULADA' AND "anuladaEn" IS NOT NULL)
  );
-- A lo sumo un saldo inicial VIGENTE por proveedor (anulado, puede registrarse otro).
CREATE UNIQUE INDEX "obligaciones_proveedor_saldo_inicial_unico" ON "obligaciones_proveedor"("proveedorId", "negocioId") WHERE "origen" = 'SALDO_INICIAL' AND "estado" = 'VIGENTE';
-- F10-C2a: una sola obligación por recepción aprobada.
CREATE UNIQUE INDEX "obligaciones_proveedor_recepcion_unica" ON "obligaciones_proveedor"("negocioId", "recepcionId") WHERE "recepcionId" IS NOT NULL;

CREATE FUNCTION "guard_obligacion_f5a"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."estado" <> 'VIGENTE' THEN RAISE EXCEPTION 'supplier obligation starts in force'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
     OR NEW."proveedorId" IS DISTINCT FROM OLD."proveedorId" OR NEW."origen" IS DISTINCT FROM OLD."origen"
     OR NEW."naturalezaAjuste" IS DISTINCT FROM OLD."naturalezaAjuste" OR NEW."importeDecimal" IS DISTINCT FROM OLD."importeDecimal"
     OR NEW."fecha" IS DISTINCT FROM OLD."fecha" OR NEW."descripcion" IS DISTINCT FROM OLD."descripcion"
     OR NEW."comprobanteTipo" IS DISTINCT FROM OLD."comprobanteTipo" OR NEW."comprobanteNumero" IS DISTINCT FROM OLD."comprobanteNumero"
     OR NEW."comprobanteFecha" IS DISTINCT FROM OLD."comprobanteFecha" OR NEW."recepcionId" IS DISTINCT FROM OLD."recepcionId"
     OR NEW."actorId" IS DISTINCT FROM OLD."actorId" OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."idempotencyFingerprint" IS DISTINCT FROM OLD."idempotencyFingerprint" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'supplier obligation is immutable';
  END IF;
  IF NEW."estado" IS DISTINCT FROM OLD."estado" OR NEW."anuladaEn" IS DISTINCT FROM OLD."anuladaEn" THEN
    IF OLD."estado" <> 'VIGENTE' OR NEW."estado" <> 'ANULADA' THEN RAISE EXCEPTION 'supplier obligation transition not allowed'; END IF;
    PERFORM 1 FROM "eventos_cuenta_proveedor" WHERE "obligacionId" = NEW."id" AND "negocioId" = NEW."negocioId" AND "tipo" = 'ANULACION' AND "createdAt" = NEW."anuladaEn";
    IF NOT FOUND THEN RAISE EXCEPTION 'supplier obligation cancellation requires its event'; END IF;
    IF "f5a_asignado_obligacion"(NEW."id") > 0 THEN RAISE EXCEPTION 'supplier obligation has active assignments'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "obligaciones_proveedor_guard_trigger" BEFORE INSERT OR UPDATE ON "obligaciones_proveedor" FOR EACH ROW EXECUTE FUNCTION "guard_obligacion_f5a"();

-- ---------------------------------------------------------------------------
-- Créditos (lo que reduce la deuda)
-- ---------------------------------------------------------------------------
ALTER TABLE "creditos_proveedor"
  ADD CONSTRAINT "creditos_proveedor_importe_check" CHECK ("importeDecimal" > 0),
  ADD CONSTRAINT "creditos_proveedor_origen_check" CHECK (
    ("origen" = 'PAGO_CAJA' AND "egresoCajaId" IS NOT NULL AND "medio" IS NULL AND "naturalezaAjuste" IS NULL AND "fechaPago" IS NULL
      AND "confirmadoEn" IS NULL AND "confirmadoPorId" IS NULL
      AND (("estado" = 'VIGENTE' AND "cerradoEn" IS NULL) OR ("estado" = 'DESVINCULADO' AND "cerradoEn" IS NOT NULL)))
    OR ("origen" = 'PAGO_DECLARADO' AND "egresoCajaId" IS NULL AND "medio" IN ('TRANSFERENCIA', 'MERCADO_PAGO', 'OTRO') AND "fechaPago" IS NOT NULL AND "naturalezaAjuste" IS NULL
      AND (("estado" = 'DECLARADO' AND "confirmadoEn" IS NULL AND "cerradoEn" IS NULL)
        OR ("estado" = 'CONFIRMADO_DUENO' AND "confirmadoEn" IS NOT NULL AND "confirmadoPorId" = "negocioId" AND "cerradoEn" IS NULL)
        OR ("estado" = 'RECHAZADO' AND "confirmadoEn" IS NULL AND "cerradoEn" IS NOT NULL)
        OR ("estado" = 'ANULADO' AND "confirmadoEn" IS NOT NULL AND "cerradoEn" IS NOT NULL)))
    OR ("origen" = 'AJUSTE_A_FAVOR' AND "egresoCajaId" IS NULL AND "medio" IS NULL AND "fechaPago" IS NULL
      AND "naturalezaAjuste" IN ('ERROR_DE_CARGA', 'BONIFICACION', 'DIFERENCIA_ACORDADA', 'OTRO') AND "motivo" IS NOT NULL
      AND "confirmadoEn" IS NULL AND "confirmadoPorId" IS NULL
      AND (("estado" = 'VIGENTE' AND "cerradoEn" IS NULL) OR ("estado" = 'ANULADO' AND "cerradoEn" IS NOT NULL)))
  ),
  ADD CONSTRAINT "creditos_proveedor_textos_check" CHECK (
    ("referencia" IS NULL OR length(btrim("referencia")) BETWEEN 1 AND 120)
    AND ("cuentaOrigenDeclarada" IS NULL OR length(btrim("cuentaOrigenDeclarada")) BETWEEN 1 AND 120)
    AND ("motivo" IS NULL OR length(btrim("motivo")) BETWEEN 1 AND 500)
  ),
  -- D-6: la confirmación del dueño NO es conciliación bancaria; F10-D llenará estas columnas.
  ADD CONSTRAINT "creditos_proveedor_conciliacion_check" CHECK ("conciliacionEstado" IS NULL AND "conciliadoEn" IS NULL AND "conciliacionRef" IS NULL),
  ADD CONSTRAINT "creditos_proveedor_compra_check" CHECK ("compraReferenciaId" IS NULL);
-- Un egreso de Caja es, a lo sumo, UN crédito vigente (I-1).
CREATE UNIQUE INDEX "creditos_proveedor_egreso_vigente_unico" ON "creditos_proveedor"("egresoCajaId") WHERE "origen" = 'PAGO_CAJA' AND "estado" = 'VIGENTE';

CREATE FUNCTION "guard_credito_f5a"() RETURNS trigger AS $$
DECLARE
  eg RECORD;
  evento TEXT;
  fecha_evento TIMESTAMP(3);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."origen" = 'PAGO_CAJA' THEN
      -- Mismo candado que la compensación de F10-C1: vincular y compensar se ordenan (I-8).
      SELECT "naturaleza", "importeDecimal", "negocioId" INTO eg FROM "egresos_caja"
       WHERE "id" = NEW."egresoCajaId" AND "negocioId" = NEW."negocioId" FOR UPDATE;
      IF NOT FOUND OR eg."naturaleza" <> 'PAGO_PROVEEDOR' THEN RAISE EXCEPTION 'only a supplier payment outflow can be linked'; END IF;
      IF eg."importeDecimal" <> NEW."importeDecimal" THEN RAISE EXCEPTION 'linked cash payment must keep the exact outflow amount'; END IF;
      PERFORM 1 FROM "compensaciones_egresos_caja" WHERE "egresoId" = NEW."egresoCajaId" AND "negocioId" = NEW."negocioId";
      IF FOUND THEN RAISE EXCEPTION 'a compensated cash outflow cannot be linked to a supplier'; END IF;
      IF NEW."estado" <> 'VIGENTE' THEN RAISE EXCEPTION 'linked cash payment starts in force'; END IF;
    ELSIF NEW."origen" = 'PAGO_DECLARADO' AND NEW."estado" <> 'DECLARADO' THEN
      RAISE EXCEPTION 'declared payment starts as declared';
    ELSIF NEW."origen" = 'AJUSTE_A_FAVOR' AND NEW."estado" <> 'VIGENTE' THEN
      RAISE EXCEPTION 'credit adjustment starts in force';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."negocioId" IS DISTINCT FROM OLD."negocioId"
     OR NEW."proveedorId" IS DISTINCT FROM OLD."proveedorId" OR NEW."origen" IS DISTINCT FROM OLD."origen"
     OR NEW."importeDecimal" IS DISTINCT FROM OLD."importeDecimal" OR NEW."egresoCajaId" IS DISTINCT FROM OLD."egresoCajaId"
     OR NEW."medio" IS DISTINCT FROM OLD."medio" OR NEW."referencia" IS DISTINCT FROM OLD."referencia"
     OR NEW."fechaPago" IS DISTINCT FROM OLD."fechaPago" OR NEW."cuentaOrigenDeclarada" IS DISTINCT FROM OLD."cuentaOrigenDeclarada"
     OR NEW."naturalezaAjuste" IS DISTINCT FROM OLD."naturalezaAjuste" OR NEW."motivo" IS DISTINCT FROM OLD."motivo"
     OR NEW."actorId" IS DISTINCT FROM OLD."actorId" OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."idempotencyFingerprint" IS DISTINCT FROM OLD."idempotencyFingerprint" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR NEW."conciliacionEstado" IS DISTINCT FROM OLD."conciliacionEstado" OR NEW."conciliadoEn" IS DISTINCT FROM OLD."conciliadoEn"
     OR NEW."conciliacionRef" IS DISTINCT FROM OLD."conciliacionRef" OR NEW."compraReferenciaId" IS DISTINCT FROM OLD."compraReferenciaId" THEN
    RAISE EXCEPTION 'supplier credit is immutable';
  END IF;
  IF NEW."estado" IS NOT DISTINCT FROM OLD."estado" THEN
    IF NEW."confirmadoEn" IS DISTINCT FROM OLD."confirmadoEn" OR NEW."confirmadoPorId" IS DISTINCT FROM OLD."confirmadoPorId" OR NEW."cerradoEn" IS DISTINCT FROM OLD."cerradoEn" THEN
      RAISE EXCEPTION 'supplier credit is immutable';
    END IF;
    RETURN NEW;
  END IF;
  -- Transiciones permitidas, cada una con su evento.
  IF OLD."origen" = 'PAGO_DECLARADO' AND OLD."estado" = 'DECLARADO' AND NEW."estado" = 'CONFIRMADO_DUENO' THEN
    evento := 'CONFIRMACION'; fecha_evento := NEW."confirmadoEn";
  ELSIF OLD."origen" = 'PAGO_DECLARADO' AND OLD."estado" = 'DECLARADO' AND NEW."estado" = 'RECHAZADO' THEN
    evento := 'RECHAZO'; fecha_evento := NEW."cerradoEn";
  ELSIF OLD."origen" = 'PAGO_DECLARADO' AND OLD."estado" = 'CONFIRMADO_DUENO' AND NEW."estado" = 'ANULADO' THEN
    evento := 'ANULACION'; fecha_evento := NEW."cerradoEn";
  ELSIF OLD."origen" = 'AJUSTE_A_FAVOR' AND OLD."estado" = 'VIGENTE' AND NEW."estado" = 'ANULADO' THEN
    evento := 'ANULACION'; fecha_evento := NEW."cerradoEn";
  ELSIF OLD."origen" = 'PAGO_CAJA' AND OLD."estado" = 'VIGENTE' AND NEW."estado" = 'DESVINCULADO' THEN
    evento := 'DESVINCULACION'; fecha_evento := NEW."cerradoEn";
  ELSE
    RAISE EXCEPTION 'supplier credit transition not allowed';
  END IF;
  IF OLD."confirmadoEn" IS NOT NULL AND NEW."confirmadoEn" IS DISTINCT FROM OLD."confirmadoEn" THEN RAISE EXCEPTION 'supplier credit is immutable'; END IF;
  PERFORM 1 FROM "eventos_cuenta_proveedor" WHERE "creditoId" = NEW."id" AND "negocioId" = NEW."negocioId" AND "tipo" = evento AND "createdAt" = fecha_evento;
  IF NOT FOUND THEN RAISE EXCEPTION 'supplier credit transition requires its event'; END IF;
  -- Salir del estado efectivo exige no tener asignaciones vigentes.
  IF OLD."estado" IN ('VIGENTE', 'CONFIRMADO_DUENO') AND "f5a_asignado_credito"(NEW."id") > 0 THEN
    RAISE EXCEPTION 'supplier credit has active assignments';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "creditos_proveedor_guard_trigger" BEFORE INSERT OR UPDATE ON "creditos_proveedor" FOR EACH ROW EXECUTE FUNCTION "guard_credito_f5a"();

-- ---------------------------------------------------------------------------
-- Eventos y operaciones
-- ---------------------------------------------------------------------------
ALTER TABLE "eventos_cuenta_proveedor"
  ADD CONSTRAINT "eventos_cuenta_proveedor_tipo_check" CHECK (
    ("obligacionId" IS NOT NULL AND "creditoId" IS NULL AND "tipo" = 'ANULACION')
    OR ("creditoId" IS NOT NULL AND "obligacionId" IS NULL AND "tipo" IN ('ANULACION', 'CONFIRMACION', 'RECHAZO', 'DESVINCULACION'))
  ),
  ADD CONSTRAINT "eventos_cuenta_proveedor_motivo_check" CHECK (
    ("motivo" IS NULL OR length(btrim("motivo")) BETWEEN 1 AND 500)
    AND ("tipo" = 'CONFIRMACION' OR "motivo" IS NOT NULL)
  );
CREATE UNIQUE INDEX "eventos_cuenta_proveedor_obligacion_unico" ON "eventos_cuenta_proveedor"("obligacionId", "tipo") WHERE "obligacionId" IS NOT NULL;
CREATE UNIQUE INDEX "eventos_cuenta_proveedor_credito_unico" ON "eventos_cuenta_proveedor"("creditoId", "tipo") WHERE "creditoId" IS NOT NULL;

ALTER TABLE "operaciones_asignacion"
  ADD CONSTRAINT "operaciones_asignacion_tipo_check" CHECK ("tipo" IN ('ASIGNAR', 'DESAFECTAR', 'REASIGNAR')),
  ADD CONSTRAINT "operaciones_asignacion_motivo_check" CHECK ("motivo" IS NULL OR length(btrim("motivo")) BETWEEN 1 AND 500);

-- ---------------------------------------------------------------------------
-- Asignaciones (motor único; append-only; topes I-3)
-- ---------------------------------------------------------------------------
ALTER TABLE "asignaciones_pago"
  ADD CONSTRAINT "asignaciones_pago_tipo_check" CHECK (
    ("tipo" = 'ASIGNACION' AND "revierteAsignacionId" IS NULL) OR ("tipo" = 'DESAFECTACION' AND "revierteAsignacionId" IS NOT NULL)
  ),
  ADD CONSTRAINT "asignaciones_pago_importe_check" CHECK ("importeDecimal" > 0);

CREATE FUNCTION "guard_asignacion_f5a"() RETURNS trigger AS $$
DECLARE
  op RECORD;
  cr RECORD;
  ob RECORD;
  orig RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'supplier payment assignment is immutable'; END IF;
  SELECT "tipo" INTO op FROM "operaciones_asignacion" WHERE "id" = NEW."operacionId" AND "negocioId" = NEW."negocioId";
  IF (op."tipo" = 'ASIGNAR' AND NEW."tipo" <> 'ASIGNACION') OR (op."tipo" = 'DESAFECTAR' AND NEW."tipo" <> 'DESAFECTACION') THEN
    RAISE EXCEPTION 'assignment row does not match its operation';
  END IF;
  -- Candados en orden fijo (crédito, luego obligación): asignaciones concurrentes se ordenan.
  SELECT "estado", "importeDecimal" INTO cr FROM "creditos_proveedor" WHERE "id" = NEW."creditoId" AND "negocioId" = NEW."negocioId" FOR UPDATE;
  SELECT "estado", "importeDecimal" INTO ob FROM "obligaciones_proveedor" WHERE "id" = NEW."obligacionId" AND "negocioId" = NEW."negocioId" FOR UPDATE;
  IF NEW."tipo" = 'ASIGNACION' THEN
    IF cr."estado" NOT IN ('VIGENTE', 'CONFIRMADO_DUENO') THEN RAISE EXCEPTION 'only an effective supplier credit can be assigned'; END IF;
    IF ob."estado" <> 'VIGENTE' THEN RAISE EXCEPTION 'only an obligation in force can receive an assignment'; END IF;
    IF "f5a_asignado_credito"(NEW."creditoId") + NEW."importeDecimal" > cr."importeDecimal" THEN RAISE EXCEPTION 'assignment exceeds the available credit'; END IF;
    IF "f5a_asignado_obligacion"(NEW."obligacionId") + NEW."importeDecimal" > ob."importeDecimal" THEN RAISE EXCEPTION 'assignment exceeds the pending obligation'; END IF;
  ELSE
    SELECT "tipo", "creditoId", "obligacionId", "importeDecimal", "negocioId", "proveedorId" INTO orig FROM "asignaciones_pago" WHERE "id" = NEW."revierteAsignacionId";
    IF NOT FOUND OR orig."tipo" <> 'ASIGNACION' OR orig."creditoId" <> NEW."creditoId" OR orig."obligacionId" <> NEW."obligacionId"
       OR orig."importeDecimal" <> NEW."importeDecimal" OR orig."negocioId" <> NEW."negocioId" OR orig."proveedorId" <> NEW."proveedorId" THEN
      RAISE EXCEPTION 'unassignment must reverse exactly one assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "asignaciones_pago_guard_trigger" BEFORE INSERT OR UPDATE ON "asignaciones_pago" FOR EACH ROW EXECUTE FUNCTION "guard_asignacion_f5a"();

-- ---------------------------------------------------------------------------
-- D-8 (único contacto con F10-C1, ADITIVO: no reemplaza ninguna función de C1):
-- un egreso con un crédito PAGO_CAJA vigente no puede compensarse. Toma el mismo
-- candado de la fila del egreso que la vinculación, así ambos órdenes son seguros.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_compensacion_credito_proveedor_f5a"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "egresos_caja" WHERE "id" = NEW."egresoId" AND "negocioId" = NEW."negocioId" FOR UPDATE;
  PERFORM 1 FROM "creditos_proveedor" WHERE "egresoCajaId" = NEW."egresoId" AND "negocioId" = NEW."negocioId" AND "origen" = 'PAGO_CAJA' AND "estado" = 'VIGENTE';
  IF FOUND THEN RAISE EXCEPTION 'cash outflow is linked to a supplier credit'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "compensaciones_egresos_caja_credito_proveedor_trigger" BEFORE INSERT ON "compensaciones_egresos_caja" FOR EACH ROW EXECUTE FUNCTION "guard_compensacion_credito_proveedor_f5a"();

-- ---------------------------------------------------------------------------
-- Append-only también frente a DELETE (mismo criterio que F4-C3): nada de F5 se borra.
-- La única excepción es la cascada al eliminar el NEGOCIO completo (la fila padre ya no
-- es visible para el trigger). Un proveedor no se borra: se desactiva.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "guard_delete_f5a"() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "negocios" WHERE "id" = OLD."negocioId";
  IF FOUND THEN
    RAISE EXCEPTION 'supplier ledger history is append-only (%)', TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "proveedores_delete_guard_trigger" BEFORE DELETE ON "proveedores" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f5a"();
CREATE TRIGGER "proveedor_cambios_delete_guard_trigger" BEFORE DELETE ON "proveedor_cambios" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f5a"();
CREATE TRIGGER "obligaciones_proveedor_delete_guard_trigger" BEFORE DELETE ON "obligaciones_proveedor" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f5a"();
CREATE TRIGGER "creditos_proveedor_delete_guard_trigger" BEFORE DELETE ON "creditos_proveedor" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f5a"();
CREATE TRIGGER "eventos_cuenta_proveedor_delete_guard_trigger" BEFORE DELETE ON "eventos_cuenta_proveedor" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f5a"();
CREATE TRIGGER "operaciones_asignacion_delete_guard_trigger" BEFORE DELETE ON "operaciones_asignacion" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f5a"();
CREATE TRIGGER "asignaciones_pago_delete_guard_trigger" BEFORE DELETE ON "asignaciones_pago" FOR EACH ROW EXECUTE FUNCTION "guard_delete_f5a"();
