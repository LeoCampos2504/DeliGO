# P2-T46-R2 — Historical account grouping and ticket detail

## Alcance y autoridad

R2 remedia exclusivamente el finding físico de Historial de Salón: pedidos de una misma ocupación aparecían como tarjetas separadas, el detalle se reducía a un contador y faltaba `Ver ticket`. No modifica el flujo de pago/cierre R1, el aislamiento A→B, Terminal read-only, T02, schema ni Production.

G0 reconcilió el baseline de Testing: el único commit posterior a `2d8d52a...` fue `3fcd9c2`, documental y propio de la certificación R1. El tag `p2-t48-stable-2026-09-10` es `ANNOTATED`: su objeto es `e284759...` y su commit despejado es `946f8c2...`, coincidente con `origin/main`; no hubo mutación remota.

## Implementación

- `buildMesaHistorialAccounts` agrupa sólo por `Pedido.ocupacionMesaId` y reutiliza `buildCuentaMesa` + `withCuentaMesaPayment`.
- `ocupacionMesaId=NULL` conserva una entrada legacy individual y muestra `Sin ocupación vinculada`; no existe heurística por mesa, fecha o proximidad.
- Operaciones Salón y Negocio → Salón consumen el read-model agrupado, con todos los pedidos, notas, items, cantidades, personalizaciones, subtotales y total canónico.
- `MesaAccountTicketDialog` construye el preview mediante `buildMesaAccountThermalTicket`; es read-only y muestra cuenta, pedidos, items, cancelados, notas, total y pago confirmado.
- El pago histórico se lee exclusivamente de `SesionOcupacionMesa`; `Pedido.metodoPago` no se usa.

## Marcadores

```text
BASELINE_TESTING_SHA=3fcd9c2656b1c94c912d860fd5826d7232332b8b
BASELINE_MAIN_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
P2_T46_R2_G0_VERDICT=DRIFT_RECONCILED_SAFE
TAG_TYPE=ANNOTATED
TAG_OBJECT=e284759ba92e06ef11f161c14f9987ee917461ed
TAG_PEELED_COMMIT=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
REMOTE_STABLE_TAG_MUTATED=NO
R1_IMPLEMENTATION_COMMIT=e09098548862c1225cb96d1ad25a87108c29c85a
R1_DEPLOYED_SHA=2d8d52a4346cdf7f14864145248ce3934dcd9b57
R2_BASELINE_SHA=3fcd9c2656b1c94c912d860fd5826d7232332b8b
T46_R2_WORK_BRANCH=work/p2-t46-r2-history-ticket
P2_T46_R2_TRIGGER=PHYSICAL_HISTORY_CANONICAL_DETAIL_FINDING
HISTORY_GROUPING_AUTHORITY=OCUPACION_MESA_ID
HISTORY_PAYMENT_AUTHORITY=SESION_OCUPACION_MESA
LEGACY_HISTORY_HEURISTIC_GROUPING=NO
HISTORY_ACCOUNT_GROUPING_AFTER=ONE_ACCOUNT_PER_OCCUPATION
HISTORY_FULL_ITEM_CONTENT_AFTER=VISIBLE
HISTORY_VIEW_TICKET_AFTER=AVAILABLE
HISTORY_TICKET_REUSES_CANONICAL_BUILDER=SI
TICKET_PERSISTED_MODEL_CREATED=NO
HISTORY_API_STRATEGY=EXTEND_EXISTING_READ_ENDPOINTS
WHY_THIS_API_STRATEGY=Both existing scoped history consumers now receive the same server-built grouped read-model; no new endpoint or duplicated economic authority was needed.
HISTORY_SURFACES_CHANGED=OPERACIONES_SALON_HISTORIAL,NEGOCIO_SALON_HISTORIAL
HISTORY_N_PLUS_ONE_INTRODUCED=NO
HISTORY_SERVER_SIDE_SCOPING=PASS
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATION=NO
DB_BACKFILL_REQUIRED=NO
CLIENT_TABLE_CHECKOUT_PAYMENT_SELECTOR=REMOVED
ACCOUNT_PAYMENT_AND_CLOSE_ATOMIC=SI
TERMINAL_COMMERCIAL_ACCOUNT_CLOSE=DENY
TECHNICAL_CLOSE_OPEN_ORDERS_GUARD=SI
TECHNICAL_CLOSE_BILLABLE_ACCOUNT_GUARD=SI
TECHNICAL_CLOSE_PHYSICAL_UI=N/A_NOT_EXPOSED_AS_OPERATOR_ACTION
NEW_OCCUPATION_ISOLATION_PHYSICAL=PASS
CURRENT_ACCOUNT_CROSS_OCCUPATION_ISOLATION_PHYSICAL=PASS
TERMINAL_SALON_READ_ONLY_PHYSICAL=PASS
ACCOUNT_PAYMENT_TRANSFERENCIA_PHYSICAL=PASS
ACCOUNT_PAYMENT_EFECTIVO_CLOSE_PHYSICAL=PASS
FOCAL_TEST_PASS=4
FOCAL_TEST_FAIL=0
REGRESSION_TEST_PASS=197
REGRESSION_TEST_FAIL=41_ENV_DATABASE_URL_MISSING_BASELINE
NEW_FAIL=0
TYPECHECK_BASELINE=31_EXPECTED_EXISTING_ERRORS
TYPECHECK_AFTER=31_EXPECTED_EXISTING_ERRORS
NEW_TYPECHECK_ERRORS=0
ESLINT_BASELINE_FINDINGS=1_KNOWN_HISTORIAL_REF_RENDER_FINDING
ESLINT_NEW_FINDINGS=0
DIFF_CHECK_PASS=PASS
BUILD_PASS=PASS
T46_R2_SCHEMA_FILES=0
T46_R2_MIGRATION_FILES=0
T02_FILES_CHANGED_BY_R2=0
T02_HUNKS_CHANGED_BY_R2=0
NEGOCIO_REFRESH_FIX_INCLUDED=NO
NEW_SECRET_OR_PII_FINDINGS=0
P2_T46_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_RECERTIFICATION
P2_T46_RELEASE_ELIGIBLE=NO_R2_PHYSICAL_CERTIFICATION_PENDING
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
P2_T46_R2_COMMIT=f303cf1234d0e3192312699616a355aedf369e4f
P2_T46_R2_DOC_HYGIENE_COMMIT=c3da04ef84dbd183956e78691a3b3da0f5dc2f68
TESTING_DEPLOYMENT_ID=fbdf45b6-9961-4549-9cb2-a68016173862
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_BRANCH=testing-codex
TESTING_DEPLOYMENT_COMMIT=c3da04ef84dbd183956e78691a3b3da0f5dc2f68
TESTING_DEPLOYMENT_COMMIT_MATCH=SI
TESTING_INSTANCE=327e4778-0334-4521-aae1-701084734b5e:RUNNING
TESTING_PENDING_MIGRATIONS=0
TESTING_DB_ERRORS=0
TESTING_LOGS_CLEAN=PASS_PRISMA_UPDATE_WARNING_ONLY
TESTING_FATAL_ERRORS=0
TESTING_HTTP_SMOKE=PASS_repartidor_200_public_mesa_cuenta_200
NEXT_ACTION=OPERATOR_P2_T46_R2_HISTORY_TICKET_RECERTIFICATION
```

## Recertificación física R2

1. Abrir Historial Salón y confirmar que A aparece como una sola cuenta con sus dos pedidos.
2. Abrir el detalle y confirmar nombres/cantidades reales, notas y subtotales.
3. Pulsar `Ver ticket` y confirmar ambos pedidos, total canónico y `Pago: Transferencia`.
4. Abrir B y confirmar cuenta separada con `Pago: Efectivo`, sin mezcla de productos/totales.
5. Control corto: una ocupación viva no muestra pedidos históricos A/B.

No repetir la certificación física completa de R1. No cerrar T46 como `CLOSED_TESTING_CERTIFIED` hasta contar con esta evidencia.
