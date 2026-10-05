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
MIGRATION_EXECUTION_TEST=DEFERRED_TO_I1_TESTING_INTEGRATION (estado al commit I1 — superado por §13: aplicada en TESTING el 2026-10-05; entonces no se aplicó a ninguna DB: TESTING y
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
  DEFAULT_STOCK_RESERVATION_MODE="OFF" (sólo default explícito), isStockReservationMode,
  parseStockReservationMode (I1-F1: FAIL-CLOSED — sólo ON/DRAINING/OFF exactos; cualquier otro valor
  → null = inválido, nunca OFF; en el commit I1 original degradaba a OFF), modeCreatesReservations (sólo ON), modeRejectsNewControlledOrders (sólo DRAINING),
  evaluateStockModeTransition: ON→DRAINING ok · DRAINING→OFF sólo con 0 activas · ON→OFF prohibido ·
  OFF→ON ok · mismo modo y transiciones no definidas por A0.1 (DRAINING→ON, OFF→DRAINING) →
  INVALID_TRANSITION hasta que I4 decida
RESERVA_ESTADOS=ACTIVA|CONSUMIDA|LIBERADA · RESERVA_MOTIVOS_LIBERACION=CANCELADO_CLIENTE|
  CANCELADO_VENDEDOR|CANCELADO_MESA|CANCELADO_SISTEMA|ROLLBACK|PRODUCTO_ELIMINADO (+ type guards)
NO creado (I4+): updateStockReservationMode, endpoint, transacción Prisma, AuditLog de modo
```

## 6. Tests y gates (ejecutados en esta ronda)

```text
PURE_AUTHORITY_TESTS=PASS 25/25 en el commit I1 (28/28 tras I1-F1, ver §12) (src/lib/stock-authority.test.ts — I1-A…I1-O + Float, no-mutación,
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
STOCK_RESERVATION_MODE_CURRENT_EXPECTED_AFTER_MIGRATION=OFF (verificado OFF en TESTING tras la migración — §13)
TESTING_DB_TOUCHED=NO · RAILWAY_TOUCHED=NO · PRODUCTION_TOUCHED=NO
```

Al cierre de la implementación (commit I1) TESTING **no** tenía este schema. Superado por §13: la migración se aplicó en TESTING el 2026-10-05 (nunca en Production).

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

## 11. Markers (estado current: ver §13)

```text
P0_STATUS=CLOSED_TESTING_CERTIFIED
R3A_I1_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
R3A_I2_STARTED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_R3A_I1_TESTING_INTEGRATION_AUTHORIZATION
```

## 12. I1-F1 — hardening pre-integración del parseo de modo (2026-10-05; markers históricos — estado current en §13)

Hallazgo de revisión del operador: el commit I1 (`a28cf42`) hacía que
`parseStockReservationMode` degradara cualquier valor persistido desconocido a OFF. OFF sólo es
seguro con 0 reservas ACTIVA y ON→OFF directo está prohibido (A0.1-9): un valor corrupto leído
como OFF permitiría a un caller futuro saltarse esa semántica.

```text
INVALID_STOCK_RESERVATION_MODE_POLICY=FAIL_CLOSED_NOT_OFF
INVALID_MODE_FALLBACK_TO_OFF=NO
CAMBIO=parseStockReservationMode(value): StockReservationMode | null — "ON"/"DRAINING"/"OFF" exactos →
  ese modo; cualquier otro valor (null, undefined, "", minúsculas, espacios, números, objetos, basura)
  → null = INVÁLIDO. Los callers de I2/I4 deben tratar null como error explícito, nunca como OFF ni
  como ausencia de reservas. DEFAULT_STOCK_RESERVATION_MODE="OFF" se mantiene sólo para
  creación/default explícito (= @default del schema); DEFAULT ≠ valor persistido inválido.
SIN_CAMBIOS=schema, migración, runtime, endpoints, ConfigPlataforma runtime, DB (sigue sin callers)
DISEÑO_A0.1=sin cambios (A0.1-9 no definía la lectura de un valor inválido; la política queda en este
  reporte y en el doc-comment de la autoridad)
PURE_AUTHORITY_TESTS=PASS 28/28 (I1-K dividido + 3 tests I1-F1: ON/DRAINING/OFF exactos; valores
  inválidos → null y nunca OFF; null/undefined no se leen como OFF válido)
SCHEMA_CONTRACT_TESTS=PASS 8/8 · MIGRATION_CONTRACT_TESTS=PASS 7/7 · RUNTIME_GUARD_TESTS=PASS 4/4
  (src/lib/p2-t56-r3a-i1-schema-migration-contract.test.ts 19/19)
REGRESSION_TESTS=PASS — P0 focal 40 (6+26+8) · F1 31 (6+6+19) · inventario 30 · caja-venta 27
PRISMA_VALIDATE=PASS ("valid", DATABASE_URL dummy local) · PRISMA_GENERATE=PASS
TYPESCRIPT_TOTAL_ERRORS=33 (conjunto idéntico al baseline) · NEW_TYPESCRIPT_ERRORS=0
ESLINT_GATE=PASS (stock-authority.ts + test)
BUILD_GATE=PASS (npm run build exit 0: Compiled successfully, 160/160 páginas, copy-assets)
DIFF_CHECK=PASS
RUNTIME_ROUTES_CHANGED=0 · PRODUCTIVE_STOCK_AUTHORITY_CALLERS=0
TESTING_DB_TOUCHED=NO · RAILWAY_TOUCHED=NO · PRODUCTION_TOUCHED=NO
P0_STATUS=CLOSED_TESTING_CERTIFIED
R3A_I1_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
R3A_I2_STARTED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_R3A_I1_TESTING_INTEGRATION_AUTHORIZATION
```

## 13. Integración a TESTING + migración + verificación (2026-10-05)

Autorizado explícitamente por el operador: fast-forward a `testing-codex`, autodeploy TESTING y
aplicación de la migración I1 sólo en la DB TESTING. NO autorizado: Production, main, I2, modo
ON/DRAINING, reservas reales, cambios funcionales.

```text
REMOTE_TESTING_CODEX_BEFORE=8b404f3a29775f4a6cb437dcf6c5beb9569145e5 (= base de I1, sin drift)
REMOTE_I1_HEAD_FRESH=e0a0c0e1a4c0ef84e82c517eaafd21ec3acb9965 (git ls-remote)
TESTING_IS_ANCESTOR_FRESH=YES · COMMITS_TO_INTEGRATE=2 (a28cf42 I1 · e0a0c0e I1-F1) · UNRELATED_COMMITS=0
INTEGRATION_METHOD=FAST_FORWARD (git merge --ff-only; sin merge commit) · TESTING_LOCAL_AFTER_INTEGRATION=e0a0c0e1a4c0ef84e82c517eaafd21ec3acb9965
PRE_PUSH_TESTS=RUN_NOW — pure 28/28 · contract 19/19 (schema 8 · migración 7 · runtime-guard 4) · P0 40 ·
  F1 31 · inventario 30 · caja-venta 27 · prisma validate/generate PASS · TypeScript 33 = baseline, 0 nuevos ·
  ESLint PASS · git diff --check 8b404f3..HEAD PASS · npm run build PASS (160/160)
TESTING_PUSH_STATUS=SUCCESS (8b404f3..e0a0c0e; remoto re-verificado en 8b404f3 justo antes del push)
REMOTE_TESTING_CODEX_AFTER_PUSH=e0a0c0e1a4c0ef84e82c517eaafd21ec3acb9965
RAILWAY_PROJECT=amiable-rejoicing · RAILWAY_ENVIRONMENT=TESTING · RAILWAY_SERVICE=DeliGO Copy
FUNCTIONAL_DEPLOY_ID=c8888200-902c-4c12-9a23-faf63595c66e · STATUS=SUCCESS · BRANCH=testing-codex · COMMIT=e0a0c0e1a4c0ef84e82c517eaafd21ec3acb9965 · COMMIT_MATCH=YES
  (el poll en background se cortó por límite de tiempo en DEPLOYING; se re-consultó directamente hasta
  el estado final SUCCESS — DEPLOYING nunca se contó como éxito)
MIGRATION_APPLICATION_METHOD=DEPLOY_START_PRISMA_MIGRATE_DEPLOY (flujo normal del servicio; no se ejecutó a mano)
MIGRATION_NAME=20261005120000_add_order_stock_reservations_base_p2_t56_r3a_i1
MIGRATION_APPLY_STATUS=SUCCESS — log del deploy: "38 migrations found", "Applying migration
  `20261005120000_add_order_stock_reservations_base_p2_t56_r3a_i1`", "All migrations have been successfully applied", luego "Ready in 222ms"
TESTING_MIGRATION_STATUS=UP_TO_DATE (prisma migrate status read-only: "Database schema is up to date!")
I1_MIGRATION_APPLIED=YES (_prisma_migrations: finished, no rolled back, applied_steps_count=1, sin logs de
  error; 38 migraciones, 0 sin terminar)

DB VERIFICATION (sólo SELECT, dentro de SET TRANSACTION READ ONLY — transaction_read_only=on):
RESERVA_STOCK_SCHEMA_VERIFIED=YES — tabla reservas_stock con las 12 columnas y nulabilidad de A0.1-17;
  FKs: negocioId CASCADE · pedidoId NO ACTION · pedidoItemId NO ACTION · productoId SET NULL ·
  productoVarianteId SET NULL; índices: pkey, UNIQUE pedidoItemId, (negocioId, estado, productoId,
  productoVarianteId), (negocioId, productoVarianteId, estado), (pedidoId)
RESERVAS_STOCK_ROW_COUNT=0 (también re-verificado después de los tests real-DB)
CONFIG_STOCK_RESERVA_MODO_SCHEMA_VERIFIED=YES (text NOT NULL DEFAULT 'OFF')
CONFIG_STOCK_RESERVA_MODE_VALUES=[{"modo":"OFF","n":1}] · NON_OFF_CONFIG_ROWS=0
STOCK_RESERVATION_MODE_CURRENT=OFF · STOCK_RESERVATION_MODE_CHANGED=NO (sólo lectura)
MOVIMIENTO_PEDIDO_ID_SCHEMA_VERIFIED=YES · MOVIMIENTO_PEDIDO_ID_COLUMN=EXISTS_NULLABLE (FK SET NULL + índice)

POSTDEPLOY_LOGS=PASS (deploy: migración aplicada, Next.js Ready, sin errores/excepciones/Prisma/módulos/5xx;
  build remoto Compiled successfully, 160/160, 0 errores)
POSTDEPLOY_TESTS=RUN_NOW — pure 28 · contract 19 · P0 40 · F1 31 · real-DB TESTING (auto-limpiantes, ya usados
  antes): Cliente variantes 9/9 · API pública negocio 3/3 · repetir 5/5 · P2-T41 cuenta 7/7 (--timeout 60000)
HTTP_SMOKE=PASS_NO_5XX (sólo GET): /cliente 200 · /operaciones/salon 200 · /mozo/panel/…/pedido/… 200 ·
  /operaciones/mi-panel/…/salon 200 · /api/operaciones/salon/panel 401 · /api/operativo/mozo/panel/…/pedidos 401 ·
  /api/negocio/inventario/movimientos 401 · /api/negocios/<inexistente> 404
OTROS_SERVICIOS_TESTING (autodeploy por el cambio de schema): Mesa Occupancy Cron, Review Moderation Expiry y
  chat en vivo → SUCCESS en e0a0c0e
PRODUCTIVE_STOCK_AUTHORITY_CALLERS=0
RESERVATION_RUNTIME_IMPLEMENTED=NO · ORDER_STOCK_LIFECYCLE_RUNTIME_IMPLEMENTED=NO · AVAILABLE_STOCK_RUNTIME_IMPLEMENTED=NO
ORIGIN_MAIN_AFTER=42ca5005d2ecd412de87e454b52820f38aaec5c0 · PRODUCTION_DEPLOYMENT_AFTER=6bf1ee84-702e-41e1-80a8-d075e3ce9362
  (sin cambios) · PRODUCTION_TOUCHED=NO
POST_MIGRATION_ROLLBACK_STRATEGY=CODE_REVERT_KEEP_ADDITIVE_SCHEMA_MODE_OFF — un git revert del código es
  posible, pero la tabla vacía y las columnas aditivas permanecen en TESTING (sin down migration, sin borrado
  automático); con modo OFF el comportamiento es el previo
P0_STATUS=CLOSED_TESTING_CERTIFIED
R3A_I1_STATUS=CLOSED_TESTING_VERIFIED (I1 no requiere certificación manual del operador: no cambia ninguna pantalla ni flujo;
  por eso VERIFIED y no CERTIFIED)
R3A_I2_STARTED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_R3A_I2_AUTHORIZATION
```
