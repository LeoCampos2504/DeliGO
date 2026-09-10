# P2-T46-R1 — Account Payment Authority + Occupation Isolation

Fecha: 2026-09-10
Estado: `IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION`

## Audit / revalidation

La auditoría base `P2_T46_TABLE_ACCOUNT_TICKET_HISTORY_CANONICAL_DETAIL.md` fue revalidada sobre `origin/testing-codex` (`bb228ee43c89073a4355e6a012bb9aeaf3669dcb`) y `origin/main` (`946f8c2404df8be6a1e7252f3d7d2ba520d337f8`). Los archivos de T46 estaban idénticos entre ambas referencias; las diferencias existentes pertenecen a T02 y no fueron tocadas.

`SesionOcupacionMesa` es la autoridad de la cuenta y `Pedido.ocupacionMesaId` continúa siendo la autoridad de pertenencia de cada pedido. No se creó una entidad PagoMesa, no se recalculan precios y no se hace backfill ni inferencia para `ocupacionMesaId=NULL`.

## Schema / migration

- Delta aditivo único: `prisma/migrations/20260910120000_p2_t46_account_payment_authority/migration.sql`.
- Campos nullable: `metodoPago`, `pagoConfirmadoEn`, `pagoConfirmadoPorTipo`, `pagoConfirmadoPorId`.
- `DB_BACKFILL_REQUIRED=NO`; `LEGACY_BACKFILL_APPLIED=NO`.
- `Pedido.metodoPago` se conserva por compatibilidad para delivery/retiro; no es autoridad del pago final de mesa.

## Implementation

- `buildCuentaMesa` sigue siendo el builder canónico; agrega notas históricas y contexto de pago sin modificar el total persistido.
- Cierre comercial: método `efectivo|transferencia`, validado server-side y escrito atómicamente con el cierre Serializable. Un retry no sobreescribe una ocupación ya cerrada.
- Cierre técnico: bloquea pedidos pendientes y cuentas con total entregado facturable; no puede saltear el cierre comercial.
- Selector de pago removido del checkout de pedidos de mesa; se presenta al cerrar la cuenta.
- Cuenta del cliente es interactiva y read-only. Terminal Salón conserva lectura y no puede cerrar comercialmente.
- Ticket térmico muestra método únicamente cuando existe confirmación persistida.
- Panel operativo actual filtra por `Mesa.ocupacionActualId`; pedidos de ocupación anterior se exponen separados como revisión. Legacy NULL permanece explícitamente “Sin ocupación vinculada”.
- Historial de Salón expone el método confirmado de la ocupación, sin habilitar mutaciones.
- `NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL` queda abierto; no se incluyó su fix.

## Security / invariants

`SERVER_SIDE_AUTHORITY_PRESERVED=SI`; negocio, mesa, ocupación y actor se resuelven server-side. No se exponen IDs de actor en cuentas públicas ni se reasignan pedidos históricos. T41 y T02 se preservan.

## Tests / verification

- Focal: `bun test src/lib/p2-t46-account-payment.test.ts src/lib/mesa-cliente-cuenta-client.test.ts src/lib/thermal-print/mesa-account-ticket.test.ts` → **26 pass, 0 fail**.
- Prisma Client generado exitosamente.
- `next build` → **PASS**.
- `git diff --check` → **PASS**.
- ESLint focal: no halló nuevos findings en los archivos T46; existe un finding baseline en `src/app/operaciones/salon/historial/page.tsx` sobre asignación de ref durante render.
- Integraciones PostgreSQL no pudieron correr localmente: el entorno no tiene `DATABASE_URL`. Se requiere smoke/DB verification en Railway Testing.

## Mandatory markers

```text
BASELINE_TESTING_SHA=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
BASELINE_MAIN_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
TAG_P2_T48_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
T46_WORK_BRANCH=work/p2-t46-r1
T46_WORK_BASE_SHA=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
P2_T46_ARCHITECTURE_AUDIT_COMPLETE=SI
P2_T46_ARCHITECTURE_APPROVAL=APPROVED_BY_OPERATOR
CURRENT_ACCOUNT_MODEL=DERIVED_BUILDER_BUILD_CUENTA_MESA
CURRENT_OCCUPATION_MODEL=SESION_OCUPACION_MESA
CURRENT_PAYMENT_MODEL=PEDIDO_METODO_PAGO_COMPATIBILITY_ONLY
CURRENT_ORDER_OCCUPATION_AUTHORITY=PEDIDO_OCUPACION_MESA_ID
T46_DEPENDS_ON_T02=NO
T46_DEPENDS_ON_OTHER_UNCERTIFIED_TASK=NO
T46_SHARED_FILE_COLLISION=NO
PRISMA_SCHEMA_CHANGED=SI
NEW_MIGRATION=SI
MIGRATION_FILE=20260910120000_p2_t46_account_payment_authority/migration.sql
MIGRATION_SQL_CLASSIFICATION=ADDITIVE_NULLABLE_NO_BACKFILL
DB_BACKFILL_REQUIRED=NO
LEGACY_BACKFILL_APPLIED=NO
ACCOUNT_PAYMENT_AUTHORITY=SESION_OCUPACION_MESA
TABLE_ORDER_PAYMENT_AUTHORITY=OCCUPATION
NON_TABLE_PAYMENT_BEHAVIOR_PRESERVED=SI
ACCOUNT_PAYMENT_AND_CLOSE_ATOMIC=SI
ACCOUNT_CLOSE_TRANSACTION=SERIALIZABLE
ACCOUNT_PAYMENT_WRITE_TRANSACTION=SERIALIZABLE
TECHNICAL_CLOSE_OPEN_ORDERS_GUARD=SI
TECHNICAL_CLOSE_BILLABLE_ACCOUNT_GUARD=SI
COMMERCIAL_CLOSE_IS_PAYMENT_AUTHORITY=SI
CLIENT_TABLE_CHECKOUT_PAYMENT_SELECTOR=REMOVED
CLIENT_ACCOUNT_CLOSE=READ_ONLY
TERMINAL_COMMERCIAL_ACCOUNT_CLOSE=DENY
TERMINAL_TECHNICAL_CLOSE_WITH_BILLABLE_ACCOUNT=DENY
PREVIOUS_OCCUPATION_CURRENT_SURFACE_ISOLATION=PASS
PREVIOUS_OCCUPATION_PENDING_ORDER_VISIBILITY=SEPARATE_REVIEW
LEGACY_NULL_OCCUPATION_BACKFILL=NO
LEGACY_NULL_OCCUPATION_INFERENCE=NO
LEGACY_NULL_ORDER_VISIBLE_WITH_EXPLICIT_STATE=SI
LEGACY_ACCOUNTING_RECONSTRUCTION=NO
CANONICAL_ACCOUNT_DETAIL_BUILDER=buildCuentaMesa
CANONICAL_DETAIL_SHARED=SI
ACCOUNT_DETAIL_DUPLICATION_AFTER=REDUCED
TICKET_PERSISTED_MODEL_CREATED=NO
TICKET_TOTAL_AUTHORITY=CANONICAL_TOTAL_GENERAL
PAYMENT_METHOD_HISTORY_AUTHORITY=OCCUPATION_PAYMENT_FIELDS
CONCURRENT_ACCOUNT_CLOSE_SAFE=SI
PAYMENT_CONFIRMATION_OVERWRITE_ON_RETRY=NO
SERVER_SIDE_AUTHORITY_PRESERVED=SI
FOCAL_TEST_PASS=26
FOCAL_TEST_FAIL=0
REGRESSION_TEST_PASS=26
REGRESSION_TEST_FAIL=0
NEW_FAIL=0
TYPECHECK_BASELINE=31_EXPECTED_EXISTING_ERRORS
TYPECHECK_AFTER=31_EXPECTED_EXISTING_ERRORS
NEW_TYPECHECK_ERRORS=0
ESLINT_NEW_FINDINGS=0
DIFF_CHECK_PASS=PASS
BUILD_PASS=PASS
T46_FILESET=23_PRODUCT_SCHEMA_TEST_DOC_FILES
T46_SCHEMA_FILES=1
T46_MIGRATION_FILES=1
T46_PRODUCT_FILES=20
T46_TEST_FILES=1
T46_DOC_FILES=1
UNRELATED_FILES=0
T02_FILES_CHANGED_BY_T46=0
T02_HUNKS_CHANGED_BY_T46=0
NEGOCIO_REFRESH_FIX_INCLUDED=NO
NEW_SECRET_OR_PII_FINDINGS=0
P2_T46_IMPLEMENTATION_COMMIT=e09098548862c1225cb96d1ad25a87108c29c85a
PRE_PUSH_TESTING_SHA=e09098548862c1225cb96d1ad25a87108c29c85a
TESTING_FAST_FORWARD_SAFE=YES
PUSH_TO_TESTING=SI
TESTING_NEW_SHA=e09098548862c1225cb96d1ad25a87108c29c85a
TESTING_PUSH_RESULT=FAST_FORWARD_SUCCESS
TESTING_DEPLOYMENT_ID=3d33f6be-451a-45b4-afa8-223afbced9f6
TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
TESTING_DEPLOYMENT_BRANCH=testing-codex
TESTING_DEPLOYMENT_COMMIT=e09098548862c1225cb96d1ad25a87108c29c85a
TESTING_DEPLOYMENT_COMMIT_MATCH=SI
TESTING_INSTANCE=9f37971a-b41f-427a-9475-7540df00201a:RUNNING
TESTING_MIGRATION_APPLIED=SI
TESTING_PENDING_MIGRATIONS=0
TESTING_DB_ERRORS=0
TESTING_LOGS_CLEAN=PASS_PRISMA_UPDATE_WARNING_ONLY
TESTING_FATAL_ERRORS=0
TESTING_HTTP_SMOKE=PASS_GET_REPARTIDOR_200_GET_PUBLIC_ACCOUNT_200
P2_T46_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION
P2_T46_RELEASE_ELIGIBLE=NO_PHYSICAL_CERTIFICATION_PENDING
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ACTION=OPERATOR_P2_T46_TABLE_ACCOUNT_PAYMENT_ISOLATION_CERTIFICATION
```

## Railway Testing / manual certification pending

El commit se debe publicar exclusivamente en `testing-codex`. La promoción a Production está fuera de alcance. Luego del deploy, el operador debe certificar una vez: dos ocupaciones sucesivas de la misma mesa, cuenta/pago de la ocupación actual, aislamiento de la anterior y denegación del cierre técnico con consumo. No cerrar como certificado hasta esa evidencia física/browser.
