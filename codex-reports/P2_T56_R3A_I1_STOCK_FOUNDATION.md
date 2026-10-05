# P2-T56-R3A-I1 — Schema aditivo + autoridad pura de stock

Fecha: 2026-10-05. Branch: `work/p2-t56-r3-stock-lifecycle-i1` (dedicada, NO integrada).
Autoridad de diseño: `codex-reports/P2_T56_R3A_ORDER_STOCK_LIFECYCLE_DESIGN.md` (A0.1-1 … A0.1-22).
Autorizado por el operador: branch dedicada, schema, UNA migración aditiva, autoridad pura,
tests, docs, commit y push sólo de esta branch. NO autorizado: integrar a `testing-codex`,
Railway, aplicar la migración a TESTING, Production, I2.

```text
I1_SCHEMA_EXISTS=YES
I1_PURE_AUTHORITY_EXISTS=YES
I1_RUNTIME_BEHAVIOR_CHANGED=NO
```

## 1. Preflight y base

```text
CURRENT_BRANCH (antes)=testing-codex
REMOTE_TESTING_CODEX_BEFORE=8b404f3a29775f4a6cb437dcf6c5beb9569145e5 (= esperado, sin drift)
ORIGIN_MAIN=42ca5005d2ecd412de87e454b52820f38aaec5c0
TRACKED_WORKTREE_CLEAN=YES · STAGED_FILES=0 · STASH_COUNT=0
UNTRACKED_COUNT=26737 (idéntico, archivo por archivo, al baseline auditado) · NEW_HIGH_RISK_UNTRACKED_FILES=0
I1_BRANCH=work/p2-t56-r3-stock-lifecycle-i1 (no existía local ni remota; creada con git switch -c)
I1_BASE_COMMIT=8b404f3a29775f4a6cb437dcf6c5beb9569145e5
P0_STATUS=CLOSED_TESTING_CERTIFIED (P0/F1 no se reabren)
```

## 2. Auditoría read-only previa

```text
CURRENT_CONFIG_MODEL=ConfigPlataforma (@@map config_plataforma): id, clave, valor, promocionadosActivos,
  tarifaServicio, updatedAt. Todos sus lectores/escritores usan select/data explícitos
  (platform-settings.ts getPlatformConfig/updatePlatformServiceFeeWithAudit, superadmin/config) →
  una columna nueva con default no altera ningún runtime.
CURRENT_MOVIMIENTO_MODEL=MovimientoInventario (@@map movimientos_inventario), tipo String
  (ENTRADA|SALIDA|AJUSTE|VENTA), ventaId opcional SetNull.
CURRENT_STOCK_TYPE_AUTHORITY=src/lib/inventario.ts MOVIMIENTO_TIPOS + isValidMovimientoTipo +
  resolveNextStock. isValidMovimientoTipo es la validación del endpoint MANUAL
  POST /api/negocio/inventario/movimientos (rechaza VENTA explícitamente).
CURRENT_RUBRO_AUTHORITY=no existía helper de rubro de stock (sólo comparaciones inline de UI)
CURRENT_MIGRATION_CONVENTION=prisma/migrations/<timestamp>_<snake>_p2_t56_<fase>/migration.sql con
  comentario de cabecera "additive-only" + SQL generado por Prisma
```

### Refinamiento de A0.1-13 (contradicción real con el código, resuelta sin rediseño)

A0.1-13 decía "tipo PEDIDO … se agrega a MOVIMIENTO_TIPOS". En el código real esa lista es la
validación del endpoint de movimientos MANUALES: agregarlo habría permitido que un cliente
registre manualmente movimientos PEDIDO (cambio de runtime, prohibido en I1, y contrario a la
intención de que PEDIDO —como VENTA— sólo lo escriba el servidor). Se resolvió en la misma
autoridad tipada, sin tocar la lista ni la validación:

```text
src/lib/inventario.ts: MOVIMIENTO_TIPO_PEDIDO = "PEDIDO" (sistema-only) +
  MOVIMIENTO_TIPOS_PERSISTIBLES = [...MOVIMIENTO_TIPOS, "PEDIDO"]
MOVIMIENTO_TIPOS / isValidMovimientoTipo / resolveNextStock: sin cambios (PEDIDO sigue inválido
  para el POST manual — probado)
Pendiente para I2: resolveNextStock deberá restar para PEDIDO (hoy trata todo lo no-ENTRADA/AJUSTE
  como resta, pero su tipo no admite PEDIDO); el endpoint manual debe seguir rechazándolo.
```

Se agregó una nota breve en A0.1-13 del diseño apuntando a este refinamiento.

## 3. Schema (prisma/schema.prisma)

Diff = 52 líneas agregadas, 1 modificada (comentario de `tipo`), en 7 hunks, todos de I1:

```text
SCHEMA_RESERVA_STOCK=model ReservaStock (A0.1-17 exacto): id cuid, negocioId, pedidoId, pedidoItemId,
  productoId?, productoVarianteId?, cantidad Float, estado String, motivoLiberacion String?,
  createdAt default now(), consumidaEn?, liberadaEn?; @@unique([pedidoItemId]);
  @@index([negocioId, estado, productoId, productoVarianteId]); @@index([negocioId, productoVarianteId, estado]);
  @@index([pedidoId]); @@map("reservas_stock")
RESERVATION_FK_DELETE_STRATEGY=negocio Cascade · pedido NoAction · pedidoItem NoAction ·
  producto SetNull · productoVariante SetNull (ningún cascade adicional)
SCHEMA_MOVIMIENTO_PEDIDO_ID=MovimientoInventario.pedidoId String? + pedido Pedido? onDelete SetNull +
  @@index([pedidoId]) (+ comentario de tipo con PEDIDO)
SCHEMA_CONFIG_STOCK_RESERVA_MODO=ConfigPlataforma.stockReservaModo String @default("OFF")
SCHEMA_INVERSE_RELATIONS=Negocio.reservasStock[] · Pedido.reservasStock[] + Pedido.movimientosInventario[] ·
  PedidoItem.reservaStock? (1:1 por @@unique pedidoItemId — exigido por Prisma) ·
  Producto.reservasStock[] · ProductoVariante.reservasStock[]
SCHEMA_UNRELATED_CHANGES=0
ENUMS_NUEVOS=0 (estado/modo son String, como define A0.1)
```

`prisma format` sobre el archivo completo reformateaba ~20 modelos ajenos (el baseline nunca estuvo
formateado). Ese ruido se descartó: el schema se reconstruyó desde HEAD + sólo las ediciones de I1,
y se verificó que las 49 líneas agregadas por I1 son estables bajo `prisma format` (0 cambian).

## 4. Migración

```text
MIGRATION_FILE=prisma/migrations/20261005120000_add_order_stock_reservations_base_p2_t56_r3a_i1/migration.sql
GENERACIÓN=prisma migrate diff --from-schema-datamodel <schema HEAD> --to-schema-datamodel prisma/schema.prisma
  --script (offline, sin ninguna DB) + cabecera de comentario
TABLES_CREATED=reservas_stock
COLUMNS_ADDED=movimientos_inventario.pedidoId TEXT NULL · config_plataforma.stockReservaModo TEXT NOT NULL DEFAULT 'OFF'
INDEXES_CREATED=5 (reservas_stock: 2 compuestos multi-tenant, pedidoId, UNIQUE pedidoItemId;
  movimientos_inventario: pedidoId)
FOREIGN_KEYS_ADDED=6 — reservas_stock: negocioId ON DELETE CASCADE · pedidoId NO ACTION ·
  pedidoItemId NO ACTION · productoId SET NULL · productoVarianteId SET NULL;
  movimientos_inventario.pedidoId SET NULL (todas ON UPDATE CASCADE, convención Prisma idéntica a
  las migraciones previas)
DESTRUCTIVE_STATEMENTS=0 (sin DROP/TRUNCATE/DELETE/UPDATE/RENAME/ALTER COLUMN — test I1-T)
DATA_BACKFILL_REQUIRED=NO (las filas existentes de config_plataforma toman 'OFF' por el DEFAULT de la columna)
MIGRATION_EXECUTION_TEST=DEFERRED_TO_I1_TESTING_INTEGRATION (no se aplicó a ninguna DB: TESTING y
  Railway prohibidos en esta ronda; no existe DB local/efímera establecida en el repo)
```

## 5. Autoridad pura — src/lib/stock-authority.ts

Sin Prisma, db, fetch, env ni efectos. Sin callers productivos.

```text
R3A_RUBRO_SCOPE=GENERIC_BUSINESS_ONLY — isGenericBusinessStockScope(rubro) === (rubro === "negocio")
ORDER_STOCK_QUANTITY_AGGREGATION=IMPLEMENTED_PURE — agregarCantidadesPorClave(items) por
  (productoId, productoVarianteId|null), suma Float, no muta, orden de primera aparición; stockKey()
AVAILABLE_STOCK_FORMULA=max(0, physical - activeReserved) — computeAvailableStock
RESERVATION_DEFICIT_FORMULA=max(0, activeReserved - physical) — computeReservationDeficit
resolveStockAvailability({controlStock, physical, activeReserved}) → {available|null, deficit}
  (controlStock=false → available null, deficit 0)
STOCK_RESERVATION_MODES=ON_DRAINING_OFF_PURE_SEMANTICS_ONLY — STOCK_RESERVATION_MODES,
  DEFAULT_STOCK_RESERVATION_MODE="OFF", isStockReservationMode, parseStockReservationMode
  (desconocido → OFF), modeCreatesReservations (sólo ON), modeRejectsNewControlledOrders (sólo DRAINING),
  evaluateStockModeTransition: ON→DRAINING ok · DRAINING→OFF sólo con 0 activas · ON→OFF prohibido ·
  OFF→ON ok · mismo modo y transiciones no definidas por A0.1 (DRAINING→ON, OFF→DRAINING) →
  INVALID_TRANSITION hasta que I4 decida
RESERVA_ESTADOS=ACTIVA|CONSUMIDA|LIBERADA · RESERVA_MOTIVOS_LIBERACION=CANCELADO_CLIENTE|
  CANCELADO_VENDEDOR|CANCELADO_MESA|CANCELADO_SISTEMA|ROLLBACK|PRODUCTO_ELIMINADO (+ type guards)
NO creado (I4+): updateStockReservationMode, endpoint, transacción Prisma, AuditLog de modo
```

## 6. Tests y gates (ejecutados en esta ronda)

```text
PURE_AUTHORITY_TESTS=PASS 25/25 (src/lib/stock-authority.test.ts — I1-A…I1-O + Float, no-mutación,
  invariantes, estados/motivos)
SCHEMA_CONTRACT_TESTS=PASS 8/8 (I1-P ReservaStock campos/FKs/índices/relaciones inversas/sin enums;
  I1-Q default OFF; I1-R pedidoId SetNull+index, FKs previas intactas)
MIGRATION_CONTRACT_TESTS=PASS 7/7 (I1-S: única/última migración, exactamente 1 tabla + 2 columnas +
  5 índices + 6 FKs, columnas/índices exactos, ON DELETE por FK; I1-T: sin destructivos, CASCADE
  sólo en la FK de Negocio)
RUNTIME_GUARD_TESTS=PASS 4/4 (PEDIDO persistible pero inválido para el POST manual;
  PRODUCTIVE_STOCK_AUTHORITY_CALLERS=0; ningún archivo productivo usa reservaStock/stockReservaModo/
  MOVIMIENTO_TIPO_PEDIDO)
  (contrato total: src/lib/p2-t56-r3a-i1-schema-migration-contract.test.ts 19/19)
REGRESSION_TESTS=PASS — inventario 30 · caja-venta 27 · P0 focal 40 (6+26+8) · F1 31 (6+6+19) ·
  lectores de schema/migraciones: platform-settings 5, client-account-deletion 43,
  review-moderation-policy 8, product-own-sections-wiring 27 · product-variant-search 25 ·
  client-product-variants 14
PRISMA_FORMAT=PASS (ejecutado; ruido global del baseline descartado; líneas de I1 estables bajo format)
PRISMA_VALIDATE=PASS ("The schema is valid", con DATABASE_URL dummy local — validate exige la
  variable pero no conecta)
PRISMA_GENERATE=PASS (Prisma Client 6.19.2)
TYPESCRIPT_TOTAL_ERRORS=33 (conjunto idéntico al baseline) · NEW_TYPESCRIPT_ERRORS=0
ESLINT_GATE=PASS (stock-authority.ts, sus 2 tests, inventario.ts)
BUILD_GATE=PASS (npm run build exit 0: prisma generate + Compiled successfully + 160/160 páginas + copy-assets)
DIFF_CHECK=PASS
```

## 7. Runtime sin cambios

```text
RUNTIME_ROUTES_CHANGED=0 (ningún archivo bajo src/app ni src/components)
ORDER_CREATION_CHANGED=NO · ORDER_TRANSITIONS_CHANGED=NO · CAJA_RUNTIME_CHANGED=NO ·
INVENTORY_RUNTIME_CHANGED=NO (inventario.ts: sólo 2 exports nuevos, 0 líneas existentes modificadas)
PRODUCTIVE_STOCK_AUTHORITY_CALLERS=0
RESERVATION_RUNTIME_IMPLEMENTED=NO
ORDER_STOCK_LIFECYCLE_RUNTIME_IMPLEMENTED=NO
AVAILABLE_STOCK_RUNTIME_IMPLEMENTED=NO
STOCK_RESERVATION_MODE_CURRENT_EXPECTED_AFTER_MIGRATION=OFF
TESTING_DB_TOUCHED=NO · RAILWAY_TOUCHED=NO · PRODUCTION_TOUCHED=NO
```

TESTING **no** tiene este schema: la migración no fue aplicada en ninguna base.

## 8. Archivos

| Archivo | Clase |
|---|---|
| prisma/schema.prisma | I1_SCHEMA |
| prisma/migrations/20261005120000_add_order_stock_reservations_base_p2_t56_r3a_i1/migration.sql (nuevo) | I1_MIGRATION |
| src/lib/stock-authority.ts (nuevo) | I1_PURE_AUTHORITY |
| src/lib/inventario.ts (2 exports nuevos) | I1_PURE_AUTHORITY |
| src/lib/stock-authority.test.ts, src/lib/p2-t56-r3a-i1-schema-migration-contract.test.ts (nuevos) | I1_TEST |
| este reporte, CODEX_REPORT.md, codex-reports/ROADMAP.md, DELIGO_FULL_CONTEXT_LATEST.md, nota en A0.1-13 del diseño | I1_DOCUMENTATION |

## 9. Build

```text
BUILD_GATE=PASS (npm run build exit 0: prisma generate + Compiled successfully + 160/160 páginas + copy-assets)
```

## 10. Rollback

```text
IMPLEMENTATION_ROLLBACK=git revert del commit I1, o descartar la branch antes de integrar (nada se aplicó
  a ninguna DB).
Tras una futura aplicación de la migración: no se promete rollback destructivo automático; el schema es
  aditivo, la tabla queda vacía y el modo default es OFF (comportamiento previo). No se crea migración de
  rollback.
```

## 11. Markers

```text
P0_STATUS=CLOSED_TESTING_CERTIFIED
R3A_I1_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
R3A_I2_STARTED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_R3A_I1_TESTING_INTEGRATION_AUTHORIZATION
```
