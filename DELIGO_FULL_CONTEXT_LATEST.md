# DELIGO — FULL CROSS-CHAT CONTEXT (LATEST)

## CURRENT AUTHORITATIVE STATE — P2-T44-R1D (2026-09-14)

Esta sección supersede los estados T44 R1/R1C de abajo, que se conservan como historial.

```text
CURRENT_PROJECT_STATE=P2_T44_R1D_IMPLEMENTED_TESTING_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION
CURRENT_BRANCH=work/p2-t43-r2
CURRENT_TESTING_SHA=c3bf576
CURRENT_TESTING_REMOTE=origin/testing-codex
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
P2_T44_STATUS=IMPLEMENTED_TESTING_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION
P2_T44_R1D_STATUS=IMPLEMENTED_TESTING_DEPLOYED_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION
P2_T44_R1D_COMMIT_SHA=c3bf576
P2_T44_R1D_REPORT=codex-reports/P2_T44_R1D_ACCOUNT_LEVEL_PERSONAL_PUSH.md
P2_T44_R1D_PUSH_OWNER=cuenta_operativa
P2_T44_R1D_ACCOUNT_SWITCH_PATH=/operaciones/cuenta
P2_T44_R1D_AREA_PUSH_TOGGLES=REMOVED
P2_T44_R1D_BELL_PURPOSE=VIEW_NOTIFICATIONS_ONLY
P2_T44_R1D_SCHEMA_CHANGE=AUTHORIZED_AND_IMPLEMENTED
P2_T44_R1D_MIGRATION=20260914100000_account_level_personal_push
P2_T44_R1D_TESTING_MIGRATION=APPLIED
P2_T44_R1D_PRODUCTION_MIGRATION=NOT_RUN
P2_T44_R1D_TESTING_DEPLOYMENT=AWAITING_TESTING_DEPLOY
P2_T44_R1D_PHYSICAL_CERTIFICATION=PENDING_OPERATOR
P2_T44_R1D_FIXTURE_PREFIX=TEST_T44_R1D_
P2_T44_R1D_PRECREATED_SUBSCRIPTIONS=0
P2_T44_R1D_NEXT_ACTION=OPERATOR_ENABLE_ACCOUNT_PUSH_AND_CERTIFY_CROSS_BUSINESS_DELIVERY
NEXT_TASK_CHAIN_AFTER_T44=P2-T45
```

## CURRENT AUTHORITATIVE STATE — P2-T44-R1C (2026-09-14)

Esta sección superior es la autoridad de continuidad más reciente y
supersede los estados operativos antiguos que permanecen debajo como
historial. No se elimina el contexto histórico.

```text
CURRENT_PROJECT_STATE=P2_T44_R1C_BLOCKED_ARCHITECTURE_DECISION
CURRENT_TESTING_SHA=201ae4f977001629fd99b8d3ee070cfc777380f0
CURRENT_TESTING_REMOTE=origin/testing-codex
CURRENT_BRANCH=work/p2-t43-r2
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO

P2_T02_STATUS=CLOSED_TESTING_CERTIFIED
P2_T23_STATUS=CLOSED_TESTING_CERTIFIED
P2_T23_RELEASE_ELIGIBLE=SI
P2_T24_STATUS=IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_NOT_RELEASE_ELIGIBLE
P2_T24_R5_STATUS=BLOCKED_TESTING_PROVIDER_DATASET
P2_T24_RELEASE_ELIGIBLE=NO
P2_T24_R6_AUTHORIZED=NO
P2_T54_STATUS=FUTURE_AFTER_T02_T23_T24

P2_T53_R1_STATUS=CLOSED_OPERATOR_PASS
P2_T53_R2_STATUS=CLOSED_OPERATOR_PASS
P2_T53_OPERATOR_EVIDENCE="quedó perfecto, ahora se ve bien"
P2_T53_R1_FIX=Negocio same-session occupation close invokes scoped refetch/refresh; no schema, migration, realtime or polling-global change
P2_T53_R2_FIX=mesa detail sheet sharpness fixed with local willChange:auto; Drawer global unchanged
P2_T53_R2_COMMIT=edcccd543f7bb1f06dc63f21839a4ce492694777
P2_T53_R2_CLOSEOUT_COMMIT=4988b49b4a78920148ab950efd94150b229844c8

P2_T24_PHYSICAL_REAL_GPS=COMPLETED_PENDING_ADDITIONAL_WITNESS
P2_T24_PHYSICAL_ACCEPTED_REAL_GPS_WRITES=48
P2_T24_PHYSICAL_REALTIME=OBSERVED
P2_T24_PHYSICAL_PROVIDER_ATTEMPTS=3
P2_T24_PHYSICAL_PROVIDER_ACCEPTED=1
P2_T24_PHYSICAL_PROVIDER_POLICY_REJECTED=2
P2_T24_PHYSICAL_RAW_FALLBACK=OBSERVED
P2_T24_PHYSICAL_VISUAL=MIXED_SMOOTH_STEPWISE_TELEPORT; TWO_BRIEF_INTERSECTION_DEVIATIONS_SELF_CORRECTED
P2_T24_ADDITIONAL_PHYSICAL_TEST=PENDING_WITH_WITNESS_PREPARED_BEFORE_DRIVING
P2_T24_PRODUCTION_RELEASE=NOT_ELIGIBLE
P2_T24_PRODUCTION_TOUCHED=NO

P2_T44_STATUS=BLOCKED_ARCHITECTURE_DECISION
P2_T44_SCOPE=Unified Personal Push Settings
P2_T44_REPORT=codex-reports/P2_T44_A0_OPERACIONES_PERSONAL_PUSH_PYR_AUDIT.md
P2_T44_R1_REPORT=codex-reports/P2_T44_R1_OPERACIONES_PERSONAL_PUSH_PYR.md
P2_T44_R1C_REPORT=codex-reports/P2_T44_R1C_UNIFIED_PERSONAL_PUSH_SETTINGS.md
P2_T44_R1_BASELINE_SHA=4988b49b4a78920148ab950efd94150b229844c8
P2_T44_R1_COMMIT_SHA=cee754289a1a30302f7c3dcd1a749213a051344f
P2_T44_R1_REMOTE_TESTING_SHA=cee754289a1a30302f7c3dcd1a749213a051344f (superseded UX; technical/security evidence retained)
P2_T44_R1C_STATUS=BLOCKED_ARCHITECTURE_DECISION
P2_T44_R1C_SCHEMA_DECISION_REQUIRED=SI
P2_T44_R1C_RECOMMENDED_PUSH_OWNER=PushSubscription ownerType cuenta_operativa, ownerId CuentaOperativa.id
P2_T44_R1C_DB_SCHEMA_CHANGED=NO
P2_T44_R1C_PRISMA_MIGRATION_CREATED=NO
P2_T44_R1_TESTING_DEPLOYMENT_ID=bbf365fa-180c-4cbd-b03b-3c07edea2fba
P2_T44_R1_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
P2_T44_R1_TESTING_DEPLOYMENT_COMMIT=cee754289a1a30302f7c3dcd1a749213a051344f
P2_T44_FINDING_1_SEND_TEST_UI=CONFIRMED_NEEDS_FIX
P2_T44_R1_SEND_TEST_VISIBLE_AFTER=NO
P2_T44_FINDING_2_MOBILE_POPOVER=NOT_REPRODUCED
P2_T44_FINDING_3_PYR_PUSH_COVERAGE=NEEDS_FIX_PARTIAL_UI_GAP_WITH_BACKEND_COVERAGE
P2_T44_FINDING_4_PUSH_NAVIGATION=ALREADY_CORRECT
P2_T44_FINDING_5_PUSH_SUBSCRIPTION_UX=NEEDS_FIX
P2_T44_R1_PUSH_TEST_ROUTE_TESTING_GUARD=SI
P2_T44_R1_PYR_PUSH_ENABLE_DISABLE_STATUS_UI=SI
P2_T44_R1_PYR_PUSH_ROUTE_AUTHORIZATION=PASS
P2_T44_R1_PYR_PUSH_BUSINESS_ISOLATION=PASS
P2_T44_R1_LEGACY_NORMALIZED_STATUS_MISMATCH_HANDLED=SI
P2_T44_R1_PYR_CANCELLATION_FANOUT_TEST=PASS
P2_T44_R1_PUSH_NAVIGATION_REGRESSION=PASS
P2_T44_R1_MOBILE_POPOVER_CHANGED=NO
P2_T44_R1_TESTS=FOCAL_18;MOZO_12;SALON_12;PYR_MESSAGING_20;CANCELLATION_10;SERVICE_WORKER_34;PYR_INTEGRATION_12;LINT_PASS;BUILD_PASS
P2_T44_R1_TYPECHECK=PREEXISTING_OUT_OF_SCOPE_ERRORS_ONLY
P2_T44_R1_FIXTURE=TEST_T44_24B0A1FC_NEGOCIO; no pedidos ni suscripciones precreadas
P2_T44_R1B_PHYSICAL_CERTIFICATION=STOPPED_SUPERSEDED_BY_R1C
P2_T44_R1_OPERATOR_MOZO_CONFIRMATION=NOT_REUSED
P2_T44_R1_OPERATOR_PYR_PUSH_CONFIRMATION=NOT_REUSED
P2_T44_R1_RELEASE_ELIGIBLE=NO
P2_T44_READY_FOR_R2=NO_BLOCKED_ARCHITECTURE
P2_T44_PERSONAL_PUSH_SCOPE=MOZO_PYR_SALON
P2_T44_PERSONAL_PUSH_SWITCH_COUNT=1
P2_T44_NOTIFICATION_BELL_PURPOSE=VIEW_NOTIFICATIONS
P2_T44_PERSONAL_PUSH_TOGGLE_REQUIRES_SELECTED_BUSINESS=NO (target; not implemented)
P2_T44_EVENT_AUTHORIZATION_REMAINS_EMPLOYEE_BUSINESS_SCOPED=SI
P2_T44_R1C_NEXT_ACTION=AUTHORIZE_SCHEMA_CHANGE_FOR_ACCOUNT_LEVEL_PUSH

P2_T40_ABSORBED=NO
P2_T45_ABSORBED=NO
P2_T40_STATUS=READY_FUTURE; session/login lifecycle remains separate
P2_T45_STATUS=SEPARATE_FUTURE; Terminal notification architecture remains separate
NEXT_TASK_CHAIN_AFTER_T44=P2-T44-R1; no T45 initiation
```

T24 sigue bloqueado para release: la corrida física fue del flujo GPS normal
desde iPhone, no un replay sintético, y confirmó escritura/realtime, pero la
experiencia visual fue mixta. No convierte esa evidencia en certificación de
Production ni autoriza R6. El reporte físico conserva el detalle sin
credenciales ni coordenadas completas.

T44 R1 quitó “Enviar prueba” de la UI normal de Mozo y dejó su ruta backend
únicamente como tooling diagnóstico fail-closed de Testing con opt-in
explícito. Agregó la suscripción Push normal de PyR Personal con autorización
por Empleado, aislamiento por negocio/área y lectura legacy/normalizada; no
creó eventos PyR nuevos. El commit R1 está desplegado en Testing y el fixture
`TEST_T44_24B0A1FC_NEGOCIO` queda disponible para la comprobación humana. La
confirmación física R1B queda detenida y no se reutiliza como certificación
final: la decisión R1C reemplaza la activación Push por panel con un único
switch de cuenta personal. R1 aporta backend/seguridad reutilizables, pero el
ownership actual por `Empleado` no representa correctamente una cuenta
multi-negocio sin duplicaciones.

## Permanent workflow rule — every future P2 task

Cada tarea P2 futura debe: (1) leer `DELIGO_FULL_CONTEXT_LATEST.md` al
iniciar; (2) crear o actualizar su reporte específico; (3) actualizar este
archivo al cerrar cada etapa significativa; (4) registrar estado, SHA, deploy,
pruebas, blockers y próxima acción; y (5) verificar consistencia antes de
STOP. T40, T44 y T45 mantienen alcances separados; esta regla no autoriza
iniciar tareas futuras automáticamente.

## CURRENT T23 AUTHORITY — P2-T23-R2A (2026-09-13)

```text
P2_T23_R1_PHYSICAL_SMOOTHNESS=FAIL
P2_T23_R2_PREVIOUS_FIX_STATUS=SUPERSEDED_BEFORE_COMMIT
A0_ARCHITECTURE_SUPERSEDED_BY_PRODUCT_CLARIFICATION=SI
P2_T23_STATUS=REDESIGNED_READY_FOR_IMPLEMENTATION
T23_BATCHING_REQUIRED=SI
T23_RECOMMENDED_ARCHITECTURE=BOUNDED_LOCAL_TRAJECTORY_BATCHING_PLUS_CLIENT_PLAYBACK
REALTIME_CONTRACT_CHANGE_REQUIRED=SI
T23_TRAJECTORY_PERSISTENCE_REQUIRED=NO
T23_SCHEMA_CHANGE_REQUIRED=NO
T23_MIGRATION_REQUIRED=NO
FUTURE_POSITION_EXTRAPOLATION_ALLOWED=NO
HEARTBEAT_IS_TRAJECTORY_POINT=NO
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
T23_MAP_MATCHING=NO
T23_ROUTE_SNAPPING=NO
TRACKING_SECURITY_GATES_PRESERVED=SI
T23_NEW_IMPLEMENTATION_SPLIT_REQUIRED=SI
NEXT_ACTION=IMPLEMENT_P2_T23_R3A_AFTER_OPERATOR_APPROVAL
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

Reporte: `codex-reports/P2_T23_R2A_TRAJECTORY_BATCHING_ARCHITECTURE_PIVOT.md`.

```
LAST_UPDATED_DATE=2026-09-10
LAST_UPDATED_BY_TASK=P2-T46-AUDIT-STOP-GATE
THIS_FILE_ROLE=SECONDARY_CROSS_CHAT_CONTEXT (síntesis — autoridad primaria: CODEX_REPORT.md + codex-reports/*)
```

## 0.84 ESTADO ACTUAL — P2-T48 cerrado en Production con alcance curado exacto

```text
P2_T46_STATUS=STOPPED_AUDIT_GATE_WAITING_FOR_APPROVAL
P2_T46_ARCHITECTURE_AUDIT_COMPLETE=SI
P2_T46_REPORT=codex-reports/P2_T46_TABLE_ACCOUNT_TICKET_HISTORY_CANONICAL_DETAIL.md
P2_T46_SCHEMA_CHANGE_REQUIRED=SI_FOR_ACCOUNT_PAYMENT_AUTHORITY
P2_T46_HISTORICAL_BACKFILL=AMBIGUOUS_FOR_LEGACY_NULL_OCCUPATION
ORDER_OCCUPATION_AUTHORITY=PARTIAL_DIRECT_ID_LEGACY_NULL_AMBIGUOUS
CURRENT_PAYMENT_AUTHORITY=PEDIDO_METODOPAGO_ONLY_NO_ACCOUNT_PAYMENT_AUTHORITY
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T48_OPERATOR_CERTIFICATION=PASS
P2_T48_RELEASE_ELIGIBLE=SI
P2_T48_SOURCE_COMMIT=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
P2_T48_RELEASE_COMMIT=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
P2_T48_RELEASE_BASE=46a1d55634e8bd848e160302cdb64a32be241c89
P2_T48_PRODUCTION_DEPLOYMENT=96ef5efc-4678-40cd-9a96-966c839201f1_SUCCESS_RUNNING_EXACT_COMMIT
P2_T48_STABLE_TAG=p2-t48-stable-2026-09-10
P2_T48_STABLE_TAG_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
T48_FILES_IN_RELEASE_DIFF=4
T02_FILES_IN_RELEASE_DIFF=0
T02_HUNKS_IN_RELEASE_DIFF=0
UNAUTHORIZED_POST_T48_DIFF=0
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATION=NO
DB_BACKFILL_REQUIRED=NO
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
P2_T23_STARTED=NO
P2_T24_STARTED=NO
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_REFRESH_ROOT_CAUSE=UNKNOWN_PENDING_AUDIT
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION=CONFIRMED_PHYSICAL
PREVIOUS_OCCUPATION_OPEN_ORDERS_PROVISIONAL_TARGET=P2-T46
TARGET_CONFIRMATION_REQUIRED_DURING_T46_AUDIT=SI
ORDER_OCCUPATION_AUTHORITY=UNKNOWN_PENDING_T46_AUDIT
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T46
PRODUCTION_TOUCHED=SI (sólo promoción exacta T48)
PUBLIC_RELEASE_AUTHORIZED=NO
```

T48 fue promovida desde una rama curada basada en el checkpoint T42; no se
promovió el HEAD completo de Testing ni ningún cambio T02. Los dos findings
físicos adyacentes permanecen abiertos y sin implementación.

## 0.83 ESTADO ACTUAL — P2-T48 cerrado por certificación física; dos findings nuevos abiertos

```text
P2_T48_STATUS=CLOSED_TESTING_CERTIFIED
P2_T48_OPERATOR_CERTIFICATION=PASS
P2_T48_PHYSICAL_CASE_A=PASS
P2_T48_PHYSICAL_CASE_B=PASS
P2_T48_PHYSICAL_CASE_C=PASS
SALON_PERSONAL_ACTIVE_WITH_ORDERS=PASS
SALON_PERSONAL_ACTIVE_WITH_ZERO_ORDERS=PASS
SALON_PERSONAL_AFTER_OCCUPATION_CLOSE=PASS
ORDER_PRESENCE_REQUIRED_FOR_OCCUPATION=NO
P2_T48_RELEASE_ELIGIBLE=SI
NEXT_RELEASE_CANDIDATE=P2-T48
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_REFRESH_ROOT_CAUSE=UNKNOWN_PENDING_AUDIT
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION=CONFIRMED_PHYSICAL
OLD_ORDERS_COUNTED_IN_NEW_CURRENT_ACCOUNT=NO_OBSERVED
OLD_ORDERS_PRESERVED_IN_NEGOCIO_HISTORY=SI_OBSERVED
DATA_LOSS_OBSERVED=NO
ACCOUNTING_OF_OLD_ORDER_AGAINST_ORIGINAL_OCCUPATION=NOT_YET_VERIFIED
NEW_OCCUPATION_MUST_NOT_INHERIT_PREVIOUS_OPEN_ORDERS=SI
PREVIOUS_OCCUPATION_OPEN_ORDERS_PROVISIONAL_TARGET=P2-T46
TARGET_CONFIRMATION_REQUIRED_DURING_T46_AUDIT=SI
ORDER_OCCUPATION_AUTHORITY=UNKNOWN_PENDING_T46_AUDIT
CLOSE_OCCUPATION_WITH_OPEN_ORDERS_GUARD=REQUIRED_FOR_FUTURE_DESIGN_REVIEW
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DATABASE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_RECOMMENDED_ACTION=P2_T48_CURATED_PRODUCTION_PROMOTION
```

El operador verificó que Salón Personal mantiene la ocupación con y sin
pedidos, y que refleja el cierre. Se registraron dos findings físicos
adyacentes sin implementar: refresh en vivo de Negocio→Salón y exposición
visual de pedidos abiertos de una ocupación anterior en una nueva ocupación.

## 0.82 ESTADO ACTUAL — P2-T48 implementada, Testing desplegado; certificación manual pendiente

```text
P2_T48_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_WAITING_OPERATOR
P2_T48_BASELINE_TESTING=fb3e584259cb2c57605c783543c7fdb1dc845454
P2_T48_BASELINE_MAIN=46a1d55634e8bd848e160302cdb64a32be241c89
P2_T48_COMMIT=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
P2_T48_TESTING_DEPLOYMENT=d5497cb8-34a0-4835-b2f8-4c117c23a325_SUCCESS_RUNNING_EXACT_COMMIT
P2_T48_FOCAL_TESTS=13_PASS_0_FAIL
P2_T48_REGRESSION_TESTS=51_PASS_0_FAIL
P2_T48_ROOT_CAUSE=shared occupation control only fetched on mount while Salon Personal panel polled without propagating refresh
P2_T48_OCCUPATION_AUTHORITY=Mesa.ocupacionActualId -> SesionOcupacionMesa estado=activa; independent of orders
P2_T48_SCHEMA_MIGRATION_BACKFILL=NO_NO_NO
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
P2_T23_STARTED=NO
P2_T24_STARTED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ACTION=one manual P2-T48 case-1 certification in Testing
```

T48 cambia sólo la revalidación de Salón Personal: su polling existente de
15 segundos/focus/visibility incrementa una señal que hace reconsultar la
autoridad server-side canónica. Mozo Personal, Negocio→Salón, sesiones,
Terminal y el modelo Prisma permanecen sin cambios.

## 0.81 ESTADO ACTUAL — P2-T42-R1 cerrado en Production; T02 preservada

```text
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T42_RELEASE_COMMIT=46a1d55634e8bd848e160302cdb64a32be241c89
P2_T42_PRODUCTION_DEPLOYMENT=08a9bc74-67df-4935-adb6-7de8e1a30c91_SUCCESS_RUNNING_EXACT_COMMIT
P2_T42_STABLE_TAG=p2-t42-stable-2026-09-10
T02_FILES_IN_PRODUCTION_DIFF=0
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T02_B4_IOS_STATUS=PASS
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
ANDROID_B3_PHYSICAL=PENDING_DEVICE_AVAILABILITY
ANDROID_B4_PHYSICAL=PENDING_DEVICE_AVAILABILITY
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T48
PUBLIC_RELEASE_AUTHORIZED=NO
```

T42 se promovió desde una rama de release basada en `origin/main` mediante
cherry-pick directo y fast-forward, con 0 paths de T02 en el delta. Production
confirmó migraciones pendientes `0`, logs limpios y smoke HTTP de lectura
PASS. P2-T48 queda como siguiente tarea recomendada, sin iniciarse aquí.

## 0.80 ESTADO ACTUAL — P2-T02-B4-R3-R1: cierre físico iOS PASS; Android y T02 global pendientes

```text
P2_T02_B4_R3_PHYSICAL_IOS_RETEST=PASS
P2_T02_B4_IOS_STATUS=PASS
IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY=RESOLVED_AND_PHYSICALLY_CERTIFIED_IOS
P2_T02_B4_STATUS=IOS_CERTIFIED_ANDROID_PHYSICAL_PENDING
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
P2_T02_B3_STATUS=IOS_SHORT_BACKGROUND_CERTIFIED_ANDROID_PENDING
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T02_IOS_INDOOR_STATUS=PASS_FOR_TESTED_SCENARIOS
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2_T42_FORMAL_CLOSEOUT_AND_CURATED_PROMOTION
P2_T23_STARTED=NO
P2_T24_STARTED=NO
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
```

El operador certificó ruta inicial, apertura de Google Maps, recuperación al
volver sin reiniciar la PWA y close/reopen. Se preservan sin reinterpretar
background `37→40`, 3 updates, gap máximo 62.30 s, `THROTTLED`; lock
`41→45`, 5 updates, gap observado 29.65 s y gap final 90.64 s no atribuible;
unlock first rev 46, latencia `UNKNOWN`, foreground recovery PASS.

P2-T02 sigue abierto por Android, movimiento exterior, T23/T24 y cierre de
entrega. El siguiente trabajo recomendado vuelve al backlog de software:
P2-T42 formal closeout y promoción curada, sin promover HEAD completo.

## 0.79 ESTADO ANTERIOR — P2-T02-B4-R3: fix de recuperación desde Google Maps listo para deploy Testing

```text
LAST_UPDATED_BY_TASK=P2-T02-B4-R3-IOS-MAPS-RETURN-ROUTE-RECOVERY
R3_BASELINE_TESTING=0c362895656d389de73fd0dd94a124fe3aac8dd1
R3_FOCAL_TEST_PASS=29
R3_FOCAL_TEST_FAIL=0
R3_ESLINT_FOCAL=PASS
R3_BUILD=PASS
TYPECHECK_RAW=31
NEW_TYPECHECK_ERRORS=0
R3_FIX=route_lifecycle_recovery_timeout_retry_real_unmount
R3_TESTING_DEPLOY=SUCCESS_EXACT_COMMIT_CONFIRMED
R3_COMMIT=fb3e584259cb2c57605c783543c7fdb1dc845454
R3_TESTING_DEPLOYMENT=b54f0214-69a0-4e93-8589-fc2f37054301
IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY=OPEN_PENDING_PHYSICAL_RETEST
PRODUCTION_TOUCHED=NO
```

La evidencia física previa se preserva sin reinterpretación: iOS background
37→40, 3 updates, max gap 62.30 s, `THROTTLED`; lock 41→45, 5 updates,
max gap observado 29.65 s; unlock first rev 46 y foreground recovery PASS.
El cierre del finding requiere retest físico del operador sobre el deploy R3.

## 0.78 ESTADO ACTUAL — P2-T02-B4-R2: deploy exacto de Testing confirmado; gate físico iOS habilitado

```text
RAILWAY_CLI_AUTHENTICATED=SI
RAILWAY_PROJECT=amiable-rejoicing
RAILWAY_ENVIRONMENT=TESTING
RAILWAY_SERVICE_CONTEXT=DeliGO Copy
B4_TESTING_DEPLOYMENT_ID=8b0fc718-f65e-4367-8210-07f12b8a5956
B4_TESTING_DEPLOYMENT_STATUS=SUCCESS
B4_TESTING_INSTANCE_STATUS=RUNNING
B4_TESTING_DEPLOYMENT_BRANCH=testing-codex
B4_TESTING_DEPLOYMENT_COMMIT=0c362895656d389de73fd0dd94a124fe3aac8dd1
B4_TESTING_DEPLOYMENT_COMMIT_MATCH=SI
B4_TESTING_LOGS=CLEAN
B4_TESTING_DEPLOY_CONFIRMED=SI
B4_HTTP_SMOKE=200
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE (secondary evidence)
P2_T02_B3_STATUS=WAITING_FOR_CROSS_PLATFORM_PHYSICAL_CERTIFICATION
P2_T02_B4_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_PENDING_PHYSICAL_CERTIFICATION
IOS_PHYSICAL_CERTIFICATION=ENABLED_NOT_STARTED
ANDROID_B3_PHYSICAL=PENDING_DEVICE_AVAILABILITY
ANDROID_B4_PHYSICAL=PENDING_DEVICE_AVAILABILITY
PRODUCTION_TOUCHED=NO
```

El CLI de Railway fue la autoridad primaria; no hubo redeploy ni cambios de
environment. La siguiente interacción debe ser únicamente la primera acción
física del operador en iPhone, una por vez.

## 0.77 ESTADO ACTUAL — P2-T02-B4-R1: autoridad de deploy no confirmada, roadmap reconciliado y certificación física pausada

```text
BASELINE_TESTING=0c362895656d389de73fd0dd94a124fe3aac8dd1
BASELINE_MAIN=bb17c7dd1eb9b8f4cb94d03de834019baf182987
B4_TESTING_DEPLOY_CONFIRMED=NO
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE
PUBLIC_REPARTIDOR_SMOKE=HTTP_200
RAILWAY_DASHBOARD=LOGIN_REQUIRED_FROM_AVAILABLE_BROWSER
TYPECHECK_RAW=31 / NEW_TYPECHECK_ERRORS=0
B4_FOCAL_TESTS=18_PASS_0_FAIL
OSRM_PUBLIC_ENDPOINT_ALLOWED_FOR_TESTING=SI
OSRM_PUBLIC_ENDPOINT_ACCEPTED_AS_FINAL_PRODUCTION_PROVIDER=NO_POR_AHORA
OSM_ATTRIBUTION_PRESENT=SI
OSRM_ROUTE_ATTRIBUTION_PRESENT=NO
PHYSICAL_IOS_AVAILABLE=SI
PHYSICAL_ANDROID_AVAILABLE=NO
CURRENT_PHYSICAL_CERTIFICATION_POLICY=IOS_NOW_ANDROID_DEFERRED_BATCH
P2_T02_B3_STATUS=WAITING_FOR_CROSS_PLATFORM_PHYSICAL_CERTIFICATION
P2_T02_B4_STATUS=IMPLEMENTED_TESTED_PUSHED_TESTING_PENDING_DEPLOY_CONFIRMATION_AND_PHYSICAL_CERTIFICATION
NATIVE_IMPLEMENTATION_STARTED=NO
PRODUCTION_TOUCHED=NO
```

R1 no declara deploy ni abre la prueba física iPhone porque no se pudo
demostrar que Railway Testing sirve exactamente `0c362895…`; el dashboard
requiere login y la build pública observada no expuso señales distinguibles de
B4. La documentación queda reconciliada sin cambios de producto/tests.

## 0.76 ESTADO ACTUAL — P2-T02-B2 (audit) + P2-T02-B3 (implementación) — DeliGO deja de cortar voluntariamente el tracking de Repartidor en background/screen-lock (OPTION-C reemplaza OPTION-V2), desplegado a TESTING, pendiente certificación física Android: la certificación indoor R2 había demostrado `RECOVERY_AFTER_FOREGROUND=PASS` pero `CONTINUOUS_BACKGROUND_TRACKING=NO` (0 updates server-side durante background/screen-lock) — el objetivo real de producto (tracking útil mientras el Repartidor usa Maps/Waze, atiende una llamada, o bloquea la pantalla por períodos razonables) exige más que "recuperar rápido al volver". Auditoría previa (B2, sin código): rastreó el origen de `OPTION-V2` al commit `0ad1562` (2026-08-24) — decisión de diseño deliberada (no bug), tomada por batería/determinismo/un supuesto de plataforma nunca verificado empíricamente, ANTES de que "tracking continuo en background" existiera como requisito de producto explícito. Capacidad real de la plataforma (fuentes oficiales citadas): PWA en background = `SUPPORTED_BUT_THROTTLED` (best-effort degradante: cadencia normal por tiempo no garantizado → ~1/min tras >5min oculto → freeze eventual); Service Worker/Background Sync/Periodic Sync = `NOT_SUPPORTED` para geolocalización (no existe `navigator.geolocation` en ese scope) — descartadas como opción. Gap adicional encontrado: `delivery-tracking-map.tsx` no tenía ningún concepto de "stale" — el badge "En vivo" se renderizaba **incondicionalmente**, sin relación con la antigüedad real del dato (bug preexistente, no introducido por esta tarea). Recomendación de B2: `PWA_BACKGROUND_FIX_RECOMMENDED_NOW` + `NATIVE_WRAPPER_FUTURE_OPTION` reservado — **el operador aprobó la Opción C** (`P2_T02_B2_PRODUCT_DECISION=OPTION_C_APPROVED`).

Implementación (B3): se identificaron y corrigieron **7 gates distintos** de `document.visibilityState` en `src/hooks/use-repartidor-tracking.ts` (no bastaba con quitar una sola llamada a `stopWatcher()`) — el branch `hidden` de `handleVisibilityChange` ya no detiene nada (sólo marca `pendingForegroundRecoveryRef=true`, preservando el reinicio duro defensivo al volver a foreground, Stage 6I/6J intacto y re-certificado por 90/90 tests de lifecycle); `startWatcherIfNeeded`, `scheduleWatchdog`, `checkWatchdog`, `firePendingSend`, `fireHeartbeat` y la reevaluación post-2xx dejaron de gatear en visibilidad. Nuevo helper puro `isTrackingLocationStale` (`src/lib/tracking-freshness.ts`, umbral 120000ms = dos heartbeats perdidos) corrige el bug del badge "En vivo" incondicional — ahora depende exclusivamente de la antigüedad de `repartidorLastUpdate`, nunca del socket; el marcador nunca se mueve/oculta/extrapola por staleness (verificado por contrato estático). Nuevo `gpsPermissionDenied` expuesto por el hook + disclosure best-effort no alarmista en `deliveries-tab.tsx` ("Android puede pausarla en segundo plano", nunca lenguaje de garantía). `refetchIntervalInBackground:true` agregado **exclusivamente** a la query `repartidor-pedidos` (misma cadencia 8s, sin tocar `defaultOptions` global) para que una falla de red transitoria en background se recupere sin depender de que el usuario vuelva a foreground. Deuda histórica resuelta: `repartidor-tracking-static-contract.test.ts` (4 FAIL documentados desde R1 por símbolos MODEL-G1 retirados) reescrito por completo contra el contrato MODEL-E1/B3 actual, 0 asserts borrados. 262 pass/0 fail combinados (90 lifecycle hook [9 reescritas contra el nuevo comportamiento + 4 nuevas] + 64 freshness puro [11 nuevas] + 25 movement + 12 static-contract reescrito + 18 tracking-consumer [1 aserción sobre-amplia corregida, el invariante real de que la autoridad de versión nunca usa reloj queda intacto] + 7 stale-contract nuevo + 22 ubicación route + 12 tracking route + 6 deliveries-tab + 3 T02-B1 focal + 3 negocio-post-login referencia). `TYPECHECK_RAW=31` (idéntico baseline, 0 nuevos), ESLint 0 nuevos, build limpio. `PRISMA_SCHEMA_CHANGED=NO`, `TRACKING_API_CONTRACT_CHANGED=NO`, `P2_T42_FILES_CHANGED=0`. Commit único `6769797ea835f0571e034185439e56530cc7e80a` en `testing-codex` (`489528c..6769797`) — `main` NO tocado (`bb17c7dd` sin cambios verificado antes/después). Autodeploy Git-triggered SUCCESS en TESTING en ambos servicios relevantes (DeliGO Copy + chat en vivo), commit exacto verificado en ambos, logs limpios ("No pending migrations to apply", boot en 83ms), smoke no-mutante 3/3 (`GET /repartidor→200`, `GET /→307`, `GET tracking sin auth→401`). No se implementó wrapper nativo — `NATIVE_WRAPPER_ESCALATION_REQUIRED=PENDING_PHYSICAL_EVIDENCE`, sólo reconsiderar con evidencia física real post-fix. `P2_T02_B3_STATUS=WAITING_FOR_OPERATOR_ANDROID_CERTIFICATION` — no se declara cerrado sin certificación física (Fase A indoor primero: foreground normal, background 120s pantalla encendida, screen lock 120s, recovery — guiado paso a paso, una instrucción concreta a la vez; fase exterior diferida hasta que el operador pueda salir). `P2_T02_STATUS` permanece `WAITING_FOR_OPERATOR_ADDITIONAL_EVIDENCE` (sin cambios). `PUBLIC_RELEASE_AUTHORIZED=NO`. Reportes completos: `codex-reports/P2_T02_B2_ANDROID_BACKGROUND_TRACKING_AUDIT_AND_DESIGN.md` (auditoría) y `codex-reports/P2_T02_B3_PWA_BEST_EFFORT_BACKGROUND_DELIVERY_TRACKING.md` (implementación) — próxima acción: `OPERATOR_ANDROID_BACKGROUND_TRACKING_CERTIFICATION_T02_B3` (2026-09-10)

## 0.75 ESTADO ACTUAL — P2-T02-B1 CERRADO POR CERTIFICACIÓN FÍSICA + P2-T02 CERTIFICACIÓN INDOOR COMPLETA (7/7 PASS), FASE EXTERIOR PENDIENTE: sesión de pruebas físicas guiadas por Claude en modo read-only/observación (polling de la DB de TESTING, sin pedir mediciones manuales al operador), retomando la certificación GPS de P2-T02 tras confirmar que el fix de P2-T02-B1 funciona ("ya funciona perfecto" — login ya no deriva a Cliente: `REPARTIDOR_PWA_LOGIN_REDIRECT=PASS`, `REPARTIDOR_PANEL_VISIBLE=PASS`, `TEST_T02_ORDER_VISIBLE=PASS`, `P2_T02_B1_STATUS=CLOSED_TESTING_CERTIFIED`). El operador estaba dentro de una casa y no podía generar movimiento físico controlado (5-10m/50-100m/100-300m) — el protocolo original de 10 fases con movimiento se adaptó, por instrucción explícita del operador, a 7 pruebas indoor-safe sin descuidar rigor: **7/7 PASS**. Login+fijación inicial: el hook arrancó solo al detectar el pedido elegible (`rev=4` real inmediato). Stationary/heartbeat (pantalla encendida confirmada): `rev 6→7→8` en ~100s, intervalos ~60.4s luego ~40.2s, consistente con `STATIONARY_HEARTBEAT_MS=60000`. Background sin bloqueo: detención total confirmada mientras oculto (0 updates en 110s, diseño `OPTION-V2` — batería), recuperación al volver a foreground en **~3s** (`rev 9→10`) — el hallazgo histórico de 9+ minutos de silencio (`FINDING_P2T02_STAGE6H_01`) NO se reprodujo para este escenario. Screen lock (probado por separado, sin mezclar con background): 0 updates durante 110s bloqueado, recuperación al desbloquear en **~7s** (`rev 13→14`), seguida de una ráfaga de 5 envíos más en ~25s con el teléfono confirmado quieto por el operador — clasificada `STRONGLY_INDICATED_MULTIPLE_RECOVERY_SENDS` (probablemente más de un ciclo de recuperación en sucesión), hallazgo menor no bloqueante, no `CONFIRMED` sin instrumentación cliente. Network loss/recovery: 0 updates offline, sin crash, recuperación en **~20s** tras reactivar red (`rev 21→23→24`) — causa exacta identificada leyendo el código: el POST fallido marca la entrega "no elegible" localmente y sólo se rehabilita cuando el panel del Repartidor vuelve a consultar `/api/repartidor/pedidos` (refetch cada 8s) — diseño, no bug. Permiso GPS denegado/restaurado: sin error visible al denegar (silencioso por diseño), y al restaurar el permiso **sin recargar la página** volvió a producir ubicación real en ~59s, confirmado independientemente server-side (`locationRevision 31→32`) — `GPS_PERMISSION_RECOVERY=PASS_AUTOMATIC_NO_RELOAD`, mecanismo probable (no confirmado) = watchdog de foreground/visibilidad de ~75s. Corrección de registro explícita durante la sesión: una inferencia previa no confirmada ("probablemente se apagó la pantalla sola") fue anulada por instrucción del operador — `PREVIOUS_SCREEN_OFF_INFERENCE=UNCONFIRMED`, `PREVIOUS_HEARTBEAT_GAP_CAUSE=UNKNOWN`. Pendiente deliberadamente para una fase exterior futura (NO marcado PASS/FAIL): movimiento menor/mayor al threshold, recorrido real 100-300m, comportamiento visual del marcador (evidencia T23), curva/esquina (evidencia T24), background con movimiento real simultáneo. `PREVIOUS_BACKGROUND_COORDINATE_ISSUE_STATUS=RESOLVED_IN_CURRENT_INDOOR_TEST_SCENARIOS` (calificado, no un "RESOLVED" absoluto — `EXTERIOR_MOVEMENT_CONFIRMATION_REQUIRED=SI`). El pedido TEST_T02 se dejó activo intencionalmente, SIN marcar como entregado, para retomar la fase exterior sin recrear fixtures (`TEST_T02_ORDER_LEFT_ACTIVE=SI`, `TEST_FIXTURES_CLEANED=NO`). Sesión íntegramente DOCUMENTATION-ONLY: `CODE_CHANGED=NO`, `COMMIT_CREATED=NO`, `PUSH_PERFORMED=NO`, `DEPLOY_PERFORMED=NO`, `PRODUCTION_TOUCHED=NO`. `P2_T02_STATUS=WAITING_FOR_OPERATOR_ADDITIONAL_EVIDENCE` (NO `CLOSED`, NO promovido). `PUBLIC_RELEASE_AUTHORIZED=NO`. Reporte completo con tabla temporal por fase (timestamps/revisiones reales del poller): `codex-reports/P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R2.md` — próxima acción: `OPERATOR_T02_EXTERIOR_ANDROID_GPS_CERTIFICATION` (2026-09-10)

## 0.74 ESTADO ANTERIOR — P2-T02-B1 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING (blocker de la certificación física GPS de P2-T02, sesión en curso): el operador reprodujo en Android real que el login por password de Repartidor autentica correctamente server-side (confirmado independientemente: DB muestra el fixture como repartidor real sin colisión de rol, HTTP directo confirma type="repartidor" y GET /api/repartidor/pedidos autorizado) pero navega a "/" — que redirige incondicionalmente a Cliente (src/app/page.tsx, diseño deliberado del aislamiento de PWA por rol) — sacando al repartidor recién autenticado de la PWA instalada DeliGO Delivery hacia DeliGO Cliente. Root cause: `router.replace("/")` en `src/app/repartidor/page.tsx`, única ocurrencia de ese patrón en todo el repo/historial, preexistente desde el commit `9684082` (el mismo que introdujo el aislamiento de PWA por rol) — nunca corregido para Repartidor pese a que Negocio ya tenía exactamente el mismo fix desde el commit `95ff272` ("fix: keep business login inside pwa scope"). El login por Google OAuth de Repartidor (mismo archivo) confirmado NO afectado — nunca navega, deja que el propio estado del componente renderice el panel; esto explica por qué nunca se detectó antes: sólo un login por password real, dentro de la PWA instalada, lo expone. Fix: nuevo `src/lib/repartidor-post-login-navigation.ts` (mismo patrón exacto ya establecido por Negocio — constante de ruta fija `REPARTIDOR_POST_LOGIN_PATH="/repartidor/"` + helper `esRutaPwaRepartidor`) — `router.replace(REPARTIDOR_POST_LOGIN_PATH)` en vez de `router.replace("/")`. `src/app/page.tsx` NO se tocó — su redirect a Cliente es arquitectura deliberada y correcta, el defecto estaba exclusivamente en el caller de Repartidor. Manifest/scope de la PWA de Repartidor confirmados correctos (start_url y scope ya apuntan a `/repartidor`), sin cambios. 6 pass focal + 97 pass regresión (OAuth callback, active-gate, tracking) + 4 fail preexistentes documentados desde R1 (contrato estático de arquitectura MODEL-G1 ya retirada, sin relación) — NEW_FAIL=0. TYPECHECK_RAW=31 (idéntico baseline, 0 nuevos), ESLint 0 nuevos, build limpio. GPS_TRACKING_FILES_CHANGED=0, P2_T42_FILES_CHANGED=0, P2_T41_FILES_CHANGED=0 — fixtures TEST_T02 permanecen intactos. Commit único `489528ca4ba315cd0873e4b270fcdf0b4e3094cd` en `testing-codex` (`eb2af3a..489528c`) — `main` NO tocado (`bb17c7dd` sin cambios verificado antes/después). Autodeploy Git-triggered SUCCESS en TESTING en ambos servicios relevantes (DeliGO Copy + chat en vivo incidental), commit exacto verificado en ambos, logs limpios, smoke no-mutante `GET /repartidor -> 200`. Auditoría breve de sesión/cookie (sin expandir el alcance): la PWA instalada puede pedir login de nuevo aunque ya hubiera sesión en una pestaña Chrome previa — registrado como nueva evidencia física para `P2-T34` (Android Cliente/Repartidor Session Isolation), NO investigado ni tocado acá. `P2_T02_B1_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — checklist corto pendiente en Android real (A: no vuelve a Cliente tras login; B: permanece en DeliGO Delivery; C: panel Repartidor visible; D: pedido TEST_T02 visible; E/F opcionales, evidencia adicional para T34). Sólo tras A-D PASS se retoma la medición GPS de las 10 fases de P2-T02 (la propia certificación de P2-T02 sigue `WAITING_FOR_OPERATOR`, no cerrada por esta tarea). `PUBLIC_RELEASE_AUTHORIZED=NO`. Reporte completo: `codex-reports/P2_T02_B1_REPARTIDOR_PWA_POST_LOGIN_ROUTING.md` — próxima acción: `OPERATOR_REPARTIDOR_PWA_LOGIN_CERTIFICATION_T02_B1` (2026-09-10)

## 0.73 ESTADO ACTUAL — P2-T42 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING: PyR (Employee y Terminal) ordenaba pedidos oldest-first (FIFO explícito, documentado como diseño intencional) y ofrecía saltar de "recibido" directo a preparar, luego "marcar en camino" manualmente con broadcast a TODOS los repartidores activos a la vez — evidencia física del operador (captura mostró pedidos de 33d/27d/9d arriba y recientes abajo). Root cause: PyR nunca fue migrado al modelo canónico aceptado/esperando_repartidor que Negocio adoptó completo en P2-T29B/T29C — el propio documento de diseño de esa tarea ya recomendaba "pyr: agregar aceptado como paso previo si el operador lo autoriza", pendiente hasta que el operador lo autorizó ahora. Fix: PyR reutiliza la MISMA autoridad de transición que ya usa Negocio (`PYR_ROLLOUT_FORWARD_TRANSITIONS`, alias de `NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS`, mismo objeto sin copiarlo) — recibido→aceptado→preparando→{esperando_repartidor(domicilio)|listo_para_retirar(retiro)}→entregado. Employee gana endpoints nuevos `aceptar` y `buscar-repartidor` (reemplaza al retirado `en-camino`, cuyo modelo pre-P2-T29C forzaba en_camino manualmente — hoy exclusivo de la aceptación atómica real de un Repartidor); `preparar` ahora exige "aceptado" como origen (única excepción sin arista legacy, riesgo aceptado y documentado). Terminal (PATCH genérico) adopta el mismo grafo preservando las aristas legacy para pedidos en vuelo. Ambos listados (panel Terminal, GET Employee) pasan de oldest-first a newest-first. 10 archivos que duplicaban byte-a-byte la misma lista de "estados activos" (paneles, listados, detalle, mensajes/adjuntos) se consolidan en un export compartido nuevo (`PYR_ACTIVE_ESTADOS_NO_MESA`). Terminal Salón (P2-T41, ya en Production) NO fue tocado — confirmado por fileset (0 archivos compartidos) y por regresión explícita de la autoridad que Salón sí comparte (`ACTIVE_FORWARD_TRANSITIONS.mesa`, endpoint distinto). 134 pass/0 fail combinados (11 nuevo focal sort+workflow real-DB + 13 mock-based transitions [6 preservados+7 nuevos] + 45 order-transitions puro sin cambios + 26 mensajes/aislamiento + 39 regresión Negocio/Salón). `TYPECHECK_RAW=31` (idéntico baseline, 0 nuevos — una medición intermedia de 32/33 se debió a caché stale de `.next/dev/` de un `next dev` en background apuntando al endpoint retirado, confirmado no-real y resuelto limpiando el caché gitignored). ESLint 0 nuevos en los 19 archivos del fileset. Commit único `eb2af3a598bf4e91ccd48b06092fb892a7ac0f9b` en `testing-codex` (`fb404a2..eb2af3a`) — `main` NO tocado (`bb17c7dd` sin cambios verificado antes/después). Autodeploy Git-triggered SUCCESS en TESTING en ambos servicios relevantes (DeliGO Copy + chat en vivo incidental), commit exacto verificado en ambos, logs limpios, 0 migrations pendientes. `P2_T44_TOUCHED=NO`, `P2_T45_TOUCHED=NO`, `MANUAL_REVIEW_POINT_15_REOPENED=NO`. Esta tarea SÍ cambia orden visual, botones y estados visibles en ambas superficies PyR — `P2_T42_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_OR_BROWSER_CERTIFICATION`, NO se declara `CLOSED_TESTING_CERTIFIED` sin control físico/browser del operador (checklist corto en el reporte). `PUBLIC_RELEASE_AUTHORIZED=NO`. Próxima tarea funcional recomendada (no iniciada): `P2-T48` (Salon Personal Occupation State Parity). Reporte completo: `codex-reports/P2_T42_PYR_EMPLOYEE_TERMINAL_ORDER_WORKFLOW_PARITY.md` — próxima acción: `OPERATOR_PYR_WORKFLOW_PARITY_CERTIFICATION_P2_T42` (2026-09-10)

## 0.72 ESTADO ACTUAL — CHECKPOINT PRODUCTION: P2-T41 (Terminal Read-Only Action Authorization) promovido de `testing-codex` a `main`/Production. `main` avanzado de `773664f8` a `bb17c7dd1eb9b8f4cb94d03de834019baf182987` (método `git commit-tree`, mismo patrón de las 6 promociones anteriores), tag `p2-t41-stable-2026-09-10` creado. Preflight auditó el delta real `origin/main..origin/testing-codex` ANTES de cualquier side effect: exactamente 8 archivos (5 producto + 3 test), todos clasificados `P2_T41`, ninguno ajeno — verificado byte a byte que el diff es idéntico al patch propio del commit `fb404a2` (sin drift acumulado). Quality gates re-ejecutados frescos sobre el source exacto: focal 140 pass+0 fail + regresión 103 pass+0 fail = **243 pass/0 fail total** — corrección aritmética respecto del "229" declarado en el reporte de implementación original (sumaba mal dos corridas de regresión separadas: 14+89). `TYPECHECK_RAW=31` (idéntico, 0 nuevos), ESLint 0 nuevos (1 preexistente ya documentado en `operaciones/salon/page.tsx`), build/diff-check limpios, 0 cambios de schema/migración, 0 secretos/PII nuevos. Autodeploy Git-triggered SUCCESS PRIMER intento en ambos servicios relevantes (DeliGO Production + chat en vivo, éste último redeploy incidental por compartir repo), commit exacto verificado (`bb17c7dd...`) vía `railway status --json`, logs limpios ("No pending migrations to apply"). Smoke no-mutante 4/4 PASS contra `https://deligo.ar` real y el chat-service (raíz, panel Terminal sin sesión, ocupación inexistente, health) — nunca se ejecutó POST cancelar/cerrar cuenta contra Production, nunca se fabricó sesión. `P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T41_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`. `P2-T42` (PyR Employee + Terminal Order Workflow Parity) preservada `READY_FUTURE`, NO iniciada, NO incluida en este release (`P2_T42_INCLUDED_IN_RELEASE=NO`). `T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI` preservado. `PUBLIC_RELEASE_AUTHORIZED=NO` (checkpoint técnico, no lanzamiento público). Reporte completo: `codex-reports/P2_T41_PROMOTION_TO_MAIN_AND_PRODUCTION.md` — próxima acción: iniciar `P2-T42` cuando el operador lo priorice (2026-09-10)

## 0.71 ESTADO ACTUAL — P2-T41 CERRADO POR CERTIFICACIÓN DEL OPERADOR: el operador ejecutó el checklist completo (5 pasos) contra TESTING con resultado TODO PASS — (A) "Cancelar pedido" NO aparece en ningún pedido de Terminal Salón; (B) "Ver cuenta" sigue funcionando; (C) "Cerrar cuenta" NO aparece dentro de "Ver cuenta"; (D) navegación/lectura de mesa, pedidos, historial y estadísticas de Terminal Salón funcionan con normalidad; (E) Terminal PyR conserva intactas sus acciones existentes (el workflow nuevo de PyR es P2-T42, explícitamente no exigido en este checklist). Tarea puramente documental — sin código/tests/commit/push/deploy/DB, HEAD sin cambios (`fb404a2d510998f53f305ba497b9c543ef4cee53`). Autoridad server-side de la implementación (tarea anterior) preservada exactamente: `TERMINAL_GLOBAL_MUTATION_BAN=NO`, `TERMINAL_READ_ONLY_CONTEXT_ENFORCEMENT=SI`, `CANCEL_BOLA_CHECK=PASS`, `CLOSE_ACCOUNT_BOLA_CHECK=PASS`, `PYR_TERMINAL_REGRESSION=PASS`, 229 pass/0 fail, `TYPECHECK_BASELINE_REAL=31` (no reabrir el `24` histórico), ESLint 0 nuevos (1 preexistente fuera de alcance) — el cierre se basa en UI + autorización server-side ya probada, nunca sólo en la certificación visual. `P2_T41_STATUS=CLOSED_TESTING_CERTIFIED`. `P2_T41_RELEASE_ELIGIBLE=SI`, `NEXT_RELEASE_CANDIDATE=P2-T41` — promoción a main/Production NO ejecutada en esta tarea (`main` permanece en `773664f8da80b2143cfd1443ed0467ace6c45a34`, sin cambios). Backlog preservado sin modificar scopes (P2-T42..T52 según autoridad ya registrada); `T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI` sigue vigente. `PUBLIC_RELEASE_AUTHORIZED=NO`. Reporte: `codex-reports/P2_T41_OPERATOR_CERTIFICATION_CLOSEOUT.md` — próxima acción: `P2_T41_PROMOTION_EVALUATION` (P2-T42 permanece `READY_FUTURE`, no iniciada) (2026-09-10)

## 0.70 ESTADO ACTUAL — P2-T41 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING: Terminal Operativa (área Salón, incluido el perfil default de solo lectura "pantalla") podía cancelar pedidos de mesa y cerrar la cuenta comercial igual que Cuenta Operativa personal — evidencia física real del operador (Terminal → mesa activa → cada pedido mostraba "Cancelar pedido"). Auditoría confirmó que NO es un bug accidental sino una reversión de política de producto sobre un diseño previo deliberado y probado ("23-A1", que autorizaba explícitamente 4 tipos de actor incluyendo `salon_terminal`) — decidida ahora por el operador. Root cause exacto: el resolver de cancelación usaba un chequeo de ÁREA base (`requireOperacionesArea`, solo lectura) en vez de un scope de mutación específico; el resolver de cierre de cuenta ni siquiera distinguía Terminal de Salón personal (ambos resolvían al mismo tipo genérico `"salon"`). Fix: Terminal ahora resuelve con su PROPIO tipo de actor (`salon_terminal`, nunca genérico) en ambos resolvers (`resolverActorCancelacionMesa` en `mesa-pedido-cancelacion.ts`, `resolveMesaOccupancyCloseActor` en `mesa-occupancy.ts`); ambos endpoints de mutación (`POST .../pedidos/[id]/cancelar`, `POST .../ocupaciones/[id]/cuenta`) lo deniegan 403 server-side; UI retira "Cancelar pedido" y oculta "Cerrar cuenta" en `/operaciones/salon` (prop nuevo `canClose` en `MesaCuentaDialog`, default `true`, no rompe a Mozo/Salón-personal/Negocio-admin). El cierre TÉCNICO de ocupación (`mesas/[id]/ocupacion`, nunca toca pedidos/pagos) y TODA la superficie PyR Terminal quedan sin cambios de comportamiento — confirmado con un test focal directo que prueba que Terminal SIGUE pudiendo hacer el cierre técnico (`TERMINAL_GLOBAL_MUTATION_BAN=NO`). 229 pass/0 fail real-DB combinados (72 tests existentes actualizados en `mesa-pedido-cancelacion.test.ts` + 61 contract/client/ui-contract + 7 nuevos en `p2-t41-terminal-cierre-cuenta.test.ts`, foco en BOLA/IDOR cross-negocio y legítimos actores intactos + 89 regresión dirigida: p2-t08, p2-t06, p2-t07, negocio-salon x3, operativo-pyr-salon, rate-limit-mesa-cuenta, order-transitions-authority x2). Corrección de baseline: `TYPECHECK_RAW` real medido fresco = `31` (no `24` como documentaban reportes previos desactualizados) — `NEW_TYPECHECK_ERRORS=0` en ambos casos. ESLint 0 errores nuevos (1 preexistente fuera de los hunks del diff, confirmado con `git stash`). Commit único `fb404a2d510998f53f305ba497b9c543ef4cee53` en `testing-codex` (`ea9edbc..fb404a2`) — `main` NO tocado (`773664f8` sin cambios verificado antes/después). Autodeploy Git-triggered SUCCESS en TESTING (DeliGO Copy), deployment `03774f34-75a1-493b-9bc2-0a6a7e4670bb`, `commitHash` verificado exacto vía `railway status --json`, logs de boot limpios, 0 migrations pendientes. `P2_T42_TOUCHED=NO`, `T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI` (autoridad ya disponible para el futuro rediseño de cuenta/ticket). Esta tarea SÍ cambia acciones visibles de Terminal — por regla explícita del prompt, `P2_T41_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION`, NO se declara `CLOSED_TESTING_CERTIFIED` sin control físico/browser del operador (checklist corto de 6 pasos en el reporte). `PUBLIC_RELEASE_AUTHORIZED=NO`. Reporte completo: `codex-reports/P2_T41_TERMINAL_READ_ONLY_ACTION_AUTHORIZATION.md` — próxima acción: `OPERATOR_TERMINAL_READ_ONLY_CERTIFICATION_P2_T41` (2026-09-10)

## 0.69 ESTADO ACTUAL — CHECKPOINT PRODUCTION: batch certificado `P2-T35+P2-T36` promovido de `testing-codex` a `main`/Production. `main` avanzado de `8011ee3` a `773664f8da80b2143cfd1443ed0467ace6c45a34` (método `git commit-tree`, mismo patrón de las 5 promociones anteriores), tag `p2-t35-t36-stable-2026-09-10` creado. Preflight corrigió primero una redacción ambigua del reporte de cierre T36 ("confirma en producción real") — `PHYSICAL_TEST_ENVIRONMENT=REAL_ANDROID_DEVICE_AGAINST_CERTIFIED_TESTING_BUILD`, nunca Production. Auditó el diff de árbol completo ANTES de cualquier side effect: exactamente 23 archivos (3 test-only T35 + 20 T36), ninguno inesperado, 0 archivos legacy de empleado/mozo/salon — P2-T52 confirmado fuera del batch. Quality gates re-ejecutados: T35 242 pass+0 fail, T36 focal 46 pass+0 fail (recontado fresco, corrige un 47 impreciso del reporte original de T36), regresión push/SW/PWA 36 pass+0 fail (combinado 82 sin duplicar), TYPECHECK_RAW=24 (idéntico baseline), build/lint/diff-check limpios. Los 11 assets binarios de T36 verificados byte-idénticos (mismo SHA256) contra los ya certificados — nada regenerado. Autodeploy Git-triggered SUCCESS PRIMER intento en ambos servicios relevantes (DeliGO + chat en vivo), commit exacto verificado, 0 migrations pendientes. Smoke 11/11 PASS contra `https://deligo.ar` real, incluyendo verificación byte-exacta de assets y `CACHE_NAME=deligo-v16`/badge servidos, sin mutaciones. `P2_T35_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T36_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T35_PLUS_P2_T36_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`. `P2-T52` preservada `READY_FUTURE`, sin cerrarse — la identidad separada de Mozo sigue pendiente, sin bloquear este checkpoint. `PUBLIC_RELEASE_AUTHORIZED=NO` (checkpoint técnico, no lanzamiento público). Próxima tarea funcional registrada, no iniciada: `P2-T41` (Terminal Read-Only Action Authorization, P0) (2026-09-10)

## 0.68 ESTADO ACTUAL — P2-T36 CERRADO POR CERTIFICACIÓN FÍSICA: operador ejecutó el checklist físico Android con resultado PASS global en los 4 controles pedidos — (A) ícono del launcher de DeliGO Operaciones correcto, sin recorte, sin exigir instalación separada de Empleado/Salón/PyR/Terminal; (B) ícono grande de Push de Cliente sigue role-specific + badge pequeño ya monocromático compartido; (C) control corto sobre un segundo rol (no especificado, no inventado) confirma el mismo patrón; (D) cierre completo + reapertura de la PWA sin branding viejo por caché. `P2_T36_STATUS=CLOSED_TESTING_CERTIFIED`, sin cambio de código ni redeploy (commit certificado ea9edbc ya estaba en TESTING). Preservada la autoridad corregida de identidad PWA única de Operaciones: `P2-T52` sigue `READY_FUTURE` (Operations PWA Identity Consolidation), `F-P2-T36-01=OPEN_FOLDED_INTO_P2_T52_CONSOLIDATION`, `P2_T36_BLOCKED_BY_T52=NO` — la consolidación pendiente de la identidad separada de Mozo es trabajo futuro, no un requisito de cierre. Registrado `P2_T35_PLUS_P2_T36_RELEASE_ELIGIBLE=SI`, `NEXT_RELEASE_CANDIDATE=P2_T35_PLUS_P2_T36` (promoción NO ejecutada) y `NEXT_FUNCTIONAL_TASK_AFTER_RELEASE=P2-T41` (Terminal Read-Only Action Authorization, P0). Tarea puramente documental — sin código/tests/commit/push/deploy/DB. `main`/Production SIN CAMBIOS (`8011ee3`) — próxima acción: `P2_T35_PLUS_P2_T36_PROMOTION_EVALUATION` (2026-09-09) — PROMOVIDO en 0.69

## 0.67 ESTADO ACTUAL — CORRECCIÓN DE AUTORIDAD: identidad PWA única de Operaciones. El operador aclaró que Empleado/Mozo/Salón fueron PWAs separadas en una arquitectura ANTERIOR, consolidadas después en la única identidad instalable "DeliGO Operaciones" (`OPERATIONS_SINGLE_PWA_IDENTITY=SI`) — la reconciliación previa había creado `P2-T52` asumiendo que había que "reparar arte" para esos 3 roles, lo cual era incorrecto. Auditoría real de código (no asumida) mostró un resultado MATIZADO: PyR y TerminalOperativa nunca tuvieron identidad separada; Empleado y Salón sí la tuvieron pero su único acceso (`/e`, `/e/[token]`, `/s`, `/s/[token]`) está 100% retirado (páginas estáticas `LegacyAccessRetired`, sin sesión/función real); **Mozo es la excepción real**: `/mozo` sigue siendo hoy un login/registro/unirse genuinamente activo (mismo backend CuentaOperativa/Operativo) que TODAVÍA emite su propia identidad separada ("DeliGO Mozos") vía `DynamicManifest`, con `icon-mozo-192x192.png` (el realmente usado, no sólo el 512 ya conocido) visiblemente cortado, mostrado hoy tanto en esa PWA activa como en notificaciones Push reales de `mesa_order_ready`. Confirmado que las 5 identidades PWA canónicas activas (cliente/negocio/repartidor/admin/operaciones) coinciden EXACTAMENTE con los 5 roles que P2-T36 ya arregló para maskable — reinterpretado correctamente de "5/8 incompleto" a "5/5 completo" sin falsear que los 8 manifests siguen existiendo en el repo. `P2-T52` retitulada a "Operations PWA Identity Consolidation / Legacy Artifact Cleanup" (`READY_FUTURE`, sin arte nuevo del operador en ningún escenario); `F-P2-T36-01` reencuadrado (`OPEN_FOLDED_INTO_P2_T52_CONSOLIDATION`) preservando el matiz honesto de que el defecto de Mozo es activo en producción hoy, no sólo legacy inerte. Checklist físico de T36 corregido: certificar Operaciones cubre PyR/Salón-personal/Terminal/Empleado, pero NO a "DeliGO Mozos" como PWA separada — documentado sin bloquear el checklist ni el cierre de T36. Íconos 192px de Mozo/Salón/Empleado preservados como uso legítimo independiente (notificaciones Push por área). P2-T41 a P2-T51 sin cambios de alcance. Badge compartido y SW cache-bypass sin cambios. Tarea puramente read-only/documental — sin código/tests/commit/push/deploy/DB. `P2_T36_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` sin cambios, sin redeploy — `main`/Production SIN CAMBIOS (`8011ee3`) — próxima acción sin cambios: `OPERATOR_ANDROID_PHYSICAL_BRANDING_CERTIFICATION_P2_T36` (2026-09-09) — CERRADO en 0.68

## 0.66 ESTADO ACTUAL — BACKLOG OPERACIONES/SALÓN CONSOLIDADO: 20 hallazgos de revisión manual física del operador (Operaciones/Mozo/PyR/Salón/TerminalOperativa/panel Negocio Salón/Cliente Mesa) agrupados en 12 tareas nuevas — `P2-T41` Terminal Read-only/Authorization (P0, Terminal en contexto sólo-consulta expone "Cancelar pedido") / `P2-T42` PyR Workflow Parity (P1_HIGH, agrupa 11+14+16) / `P2-T43` Employee Join Identity (P1, agrupa 2+10) / `P2-T44` Operaciones Personal Push (P1, agrupa 3+12, DISTINTA de T40) / `P2-T45` Terminal Notifications Architecture (P1, punto 19, preserva TERMINAL_OPERATIVA_PUSH=NO_ES_ACTOR_PUSH_POR_DISEÑO) / `P2-T46` Table Account+Ticket+History (P1, agrupa 4+6+7+8, requiere autoridad de T41) / `P2-T47` Product Personalization UX (P2_UX, punto 5) / `P2-T48` Salon Occupation Parity (P1, punto 13, confirmado con 2 casos) / `P2-T49` Terminal Mobile Shell+Chat (P1, agrupa 17+18) / `P2-T50` Salon Statistics Date Filtering (P2, punto 9) / `P2-T51` Operaciones Home Redesign (P2_UX, punto 1) / `P2-T52` Role Branding Asset Repair (formaliza F-P2-T36-01, BLOCKED_OPERATOR_ASSET_OR_REGENERATION_DECISION — SUPERADO en 0.67: retitulada a Operations PWA Identity Consolidation, sin arte nuevo requerido). IDs verificados libres por grep sobre TODO codex-reports/ antes de asignar (máximo previo T40). Punto 15 (historial Terminal) investigado y cerrado `NOT_A_BUG` — ya detallado y correcto, usado como referencia para T46, sin tarea propia. Dependencia registrada: `T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI`. Las 12 nuevas se insertan tras P2-T34, sin renumerar T38/T40/T39/T33/Support/T37. Tarea puramente documental — sin código/tests/commit/push/deploy/DB. `P2_T36_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` sin cambios, sin redeploy — `main`/Production SIN CAMBIOS (`8011ee3`) — próxima acción sin cambios: `OPERATOR_ANDROID_PHYSICAL_BRANDING_CERTIFICATION_P2_T36` (2026-09-09)

## 0.65 ESTADO ACTUAL — P2-T36 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING: los 3 findings agrupados (maskable safe-zone, badge Android monocromático, SW icon-cache-bypass) auditados contra código/assets reales — badge y cache-bypass 100% RESUELTOS; maskable RESUELTO para 5/8 roles (cliente/negocio/repartidor/admin/operaciones) mediante derivado 100% mecánico (mismo logo, mismo fondo ya existente muestreado del propio asset, escalado 70%+centrado, sin redibujar), verificado GEOMÉTRICAMENTE con `sharp` contra el círculo de seguridad real de Android (~30% de margen extra). Badge compartido `/badge-deligo-monochrome-96x96.png` extraído mecánicamente del glyph blanco "D" de Cliente (umbral de color, sin rediseño) — `sw.js`: `badge` ya NO hereda `icon`, override explícito preservado. Cache-bypass: el substring roto (`includes("icon-192")`, documentado desde R1, nunca corregido) reemplazado por patrón explícito de `pathname`; `CACHE_NAME` v15→v16. HALLAZGO NO PREVISTO: `icon-{empleado,mozo,salon}-512x512.png` son en realidad 2133x2133 y muestran sólo un fragmento recortado del logo — sin fuente en `branding-source/`, registrado como `F-P2-T36-01` (nuevo, requiere decisión del operador), NO bloquea el resto de T36. 47 tests focales + 82 regresión push/SW/PWA + 242 T35 (re-verificada intacta), 0 fallas nuevas. Commit `ea9edbc` en `testing-codex`, deploy TESTING SUCCESS ambos servicios, smoke completo. `P2_T36_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (checklist de 6 pasos, sólo branding) — `main`/Production SIN CAMBIOS (`8011ee3`) (2026-09-09)

## 0.64 ESTADO ACTUAL — P2-T35 CERRADO, TEST-ONLY: 6 fallas estáticas iOS/PWA preexistentes (no 5 como documentaba el historial — drift explicado, no forzado) resueltas sin ningún cambio de producto. Causa raíz de 5: `core.autocrlf=true` del checkout produce CRLF real en `ios-keyboard-fix.tsx`/`ios-viewport-debug-panel.tsx`, rompiendo regex que anclaban saltos de línea literales o presupuestos de caracteres ajustados — el runtime (única autoridad de modo, timeline post-teclado) está 100% intacto, verificado por lectura directa y por sanity-check (regex crudo=falla, normalizado=pasa) ANTES de editar. Causa de la 6ta: P2-T32 movió el mapa+GPS de Perfil a `address-map-picker.tsx` sin que el contrato iOS lo siguiera. Fix: normalización CRLF→LF en 2 archivos de test + corrección de ruta en 1 — 0 archivos de producto tocados. 236→242 pass, 0 fail, sin regresión. Las 4 fallas de tracking GPS (P2-T02, MODEL-G1 vs MODEL-E1) preservadas intactas, archivo no tocado. `P2_T35_STATUS=CLOSED_TESTING_CERTIFIED`, commit test-only `227ea27` en `testing-codex`, sin deploy TESTING necesario, sin certificación física requerida — `main`/Production SIN CAMBIOS (`8011ee3`). Próxima acción recomendada (no iniciada): P2-T36 (100% software) o P2-T34 si el operador prioriza Android — Operaciones/Salón sigue `PENDING_OPERATOR_FINDINGS` (2026-09-09)

## 0.63 ESTADO ACTUAL — CHECKPOINT PRODUCTION: batch certificado `P2-T30+P2-T32` promovido de `testing-codex` a `main`/Production. `main` avanzado de `44af4ec` a `8011ee3716c93e62b4a85ce82e3a9646ac5302a5` (método `git commit-tree`, mismo patrón de las 4 promociones anteriores del epic P2-T29), tag `p2-t30-t32-stable-2026-09-09` creado. Preflight auditó el diff de árbol completo ANTES de cualquier side effect: exactamente 8 archivos (1 test-only T30 + 7 T32), ninguno inesperado, 0 schema/migración — la larga lista de commits de `git log` fue ruido esperado (main es un snapshot curado sin ancestría lineal). Quality gates re-ejecutados sobre el source exacto: T30 48 pass+4 skip+0 fail, T32 focal 26 pass+0 fail, regresión 42 pass+0 fail, TYPECHECK_RAW=24 (idéntico baseline), build/lint/diff-check limpios. Autodeploy Git-triggered SUCCESS PRIMER intento en ambos servicios relevantes (DeliGO + chat en vivo), commit exacto verificado, 0 migrations pendientes. Smoke 8/8 PASS contra `https://deligo.ar` real, sin mutaciones. `P2_T30_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T30_PLUS_P2_T32_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`. `P2-T38`/`P2-T39`/`P2-T40` preservados `READY_FUTURE`, ninguno mezclado. `PUBLIC_RELEASE_AUTHORIZED=NO` (checkpoint técnico, no lanzamiento público). Operaciones/Salón sigue `PENDING_OPERATOR_FINDINGS` — próxima acción recomendada (no iniciada): P2-T35 o P2-T34 según prioridad del operador (2026-09-09) — CERRADO en 0.64

## 0.62 ESTADO ACTUAL — NUEVA TAREA REGISTRADA: `P2-T40` (Push Session Lifecycle + Login Re-Enrollment, `READY_FUTURE`), ID verificado libre por grep. Requisito nuevo del operador tras P2-T32: logout desvincula push (aceptable), pero re-login es inconsistente en si vuelve a preguntar, riesgo particular tras expiración de sesión por desuso. Invariante registrado: `NEW_AUTHENTICATED_SESSION+EFFECTIVE_PUSH_OFF=>USER_MUST_BE_INFORMED`, con anti-nag (máximo una intervención por sesión) y precedencia sobre el flag histórico `deligo-permissions-prompted` ("una vez por dispositivo"). Confirmado por lectura real (no inventado): el flag existe con ese diseño, `unlinkCurrentPushSubscription` está en Cliente/Negocio/Repartidor/Mozo, y Salón personal usa un hook de push SEPARADO (`use-operativo-salon-push.ts`) — no asumir simetría de hook entre actores. `P2_T31_STATUS=CLOSED` sin cambios, NO reabierto (lifecycle de sesión, no regresión de delivery ya certificado). Insertada en el backlog entre P2-T38 y P2-T39, antes de P2-T33/P2-T37. Batch `P2_T30_PLUS_P2_T32` sigue `RELEASE_ELIGIBLE=SI`, sin ejecutar — próxima acción: `P2_T30_PLUS_P2_T32_PROMOTION_EVALUATION` — `main`/Production SIN CAMBIOS (2026-09-09) — PROMOVIDO en 0.63

## 0.61 ESTADO ACTUAL — P2-T32 CERRADO POR CERTIFICACIÓN FÍSICA: operador reportó "TODAS LAS PRUEBAS SALIERON PERFECTAS" para los 4 casos (A-D) — `P2_T32_STATUS=CLOSED_TESTING_CERTIFIED`, sin cambios de código. Backlog ampliado con 2 tareas nuevas verificadas libres por grep: `P2-T38` (PWA Installation UX — Android completion-state + iOS guided tutorial, formaliza F-P2-T31-R23A-03) y `P2-T39` (Admin/SuperAdmin Functional Review, funcional/UX, distinta de y previa a P2-T33, NO reabre P2-T26), ambas `READY_FUTURE`. Operaciones/Salón queda como revisión manual del operador en curso, sin tarea nueva. Arquitectura de push documentada sin fix: Mozo/Salón con push moderno wireado, TerminalOperativa deliberadamente NO es actor Push (decisión P2-T12). Batch `P2_T30_PLUS_P2_T32` registrado `RELEASE_ELIGIBLE=SI`, promoción NO ejecutada — próxima acción: `P2_T30_PLUS_P2_T32_PROMOTION_EVALUATION` — `main`/Production SIN CAMBIOS (2026-09-09) — CONSOLIDADO en 0.62

## 0.60 ESTADO ACTUAL — P2-T32 IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING: modal de checkout divergente (sin persistencia real, sin alias) reemplazado por autoridad compartida con Perfil; deep-link determinista a "Mis Direcciones" — `P2_T32_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — `main`/Production SIN CAMBIOS (2026-09-09) — CERRADO en 0.61

```text
TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=2fb603bf4aa4b2c993b0a75078f29a259e036aca (nuevo commit) / origin/main=44af4ecedd245977f0a50eeeb5bb5b292519c370 (sin cambios)
HALLAZGO=el modal de checkout (LocationPickerModal) nunca llamaba a POST /api/cliente/direcciones — sólo escribía al store local del carrito, sin campo alias — confirmado leyendo el código real
FIX=extraída la autoridad de Perfil (mapa Leaflet+GPS+reverse-geocoding, formulario con validación/payload/submit) a address-map-picker.tsx + address-form.tsx, compartida por Perfil y el nuevo ClientAddressModal — nunca dos formularios divergentes
DEEP_LINK=scroll determinista a "Mis Direcciones" (id="mis-direcciones" + pendingScrollRef, dispara sólo tras showForm=true) reutilizando el mecanismo useNavStore.openAddressForm ya existente — navegación normal a Perfil sin cambios
AUTOSELECT=dirección recién creada en checkout seleccionada por su id real (nunca por posición), carrito preservado, cliente-direcciones invalidada
TESTS=26 focales nuevos (render real happy-dom + contrato estático) + 42 de regresión en archivos vecinos reales, 0 fallas nuevas
QUALITY=TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
COMMIT=2fb603bf4aa4b2c993b0a75078f29a259e036aca (parent 2fff459) / PUSH=testing-codex únicamente / TESTING_DEPLOY=SUCCESS ambos servicios (DeliGO Copy + chat en vivo), commit exacto, primer intento / SMOKE=8/8 200
PRISMA_SCHEMA_CHANGED=NO / NEW_MIGRATION=NO / PRODUCTION_TOUCHED=NO
P2_T32_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (checklist de 4 casos A-D en el reporte — Cliente sin dirección desde Inicio, desde carrito, Cliente con dirección existente, denegar geolocalización)
PROPOSED_RELEASE_BATCH=P2_T30_PLUS_P2_T32 (no ejecutado en esta tarea)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios)
Reporte: codex-reports/P2_T32_CLIENT_ADDRESS_UX_UNIFICATION_AND_PROFILE_DEEPLINK.md
```

## 0.59 ESTADO ACTUAL — BACKLOG P2 CONSOLIDADO AUTORITATIVAMENTE: nueva sección "CURRENT AUTHORITATIVE BACKLOG" al inicio de `ROADMAP.md` — 6 tareas nuevas formalizadas (P2-T32..T37), 3 correcciones mayores de premisas (P2-T18 ya CLOSED, Dark Kitchen implementación dedicada, Thermal Printing módulo ya wireado) — SIN cambios de código/tests/DB/Railway — `main`/Production SIN CAMBIOS — próxima acción: `P2-T32` (2026-09-09) — IMPLEMENTADO en 0.60

```text
TASK_STATUS=COMPLETE_BACKLOG_RECONCILED
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=2fff459b36ea459a9cb6603daf746c571562449d (sin cambios) / origin/main=44af4ecedd245977f0a50eeeb5bb5b292519c370 (sin cambios)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_TOUCHED=NO / RAILWAY_TOUCHED=NO / COMMIT_CREATED=NO / PUSH_PERFORMED=NO / PRODUCTION_TOUCHED=NO
NUEVAS_TAREAS=P2-T32 (Client Address UX Unification + Profile Deep-Link) / P2-T33 (Final Security Review — STRIDE + OWASP ASVS) / P2-T34 (Android Cliente/Repartidor Session Isolation) / P2-T35 (iOS/PWA Static-Contract Hygiene) / P2-T36 (PWA/Branding Hygiene agrupada) / P2-T37 (P2 Final Audit / Launch Readiness) — todas READY_TO_START, ninguna implementada, sin colisión de IDs
CORRECCION_1=P2_T18_STATUS=CLOSED (recertificación completa ya ejecutada — matriz actor/dispositivo/lifecycle PASS incluido typing; el estado "PAUSED_PENDING..." que aparecía en ROADMAP.md/FINDINGS.md estaba superado y nunca se había actualizado)
CORRECCION_2=DARK_KITCHEN_FUNCTIONAL_REQUIREMENT_STATUS=SATISFIED_DIRECTLY (T20-DK1/DK2A-C ya implementado y wireado, más fuerte que la premisa "indirecta")
CORRECCION_3=THERMAL_PRINTING tiene un módulo ya funcional (src/lib/thermal-print/ + mesa-cuenta-dialog.tsx) — contradice la premisa "no iniciado"; decisión del operador de mantenerlo POST_LAUNCH_DEFERRED preservada, discrepancia documentada
LEGACY_RECONCILIATION=19-G y 19-H(1) ABSORBED (código real: review-moderation-expiry.ts / client-ui.ts) / 19-B0.2(+D1/E1) ABSORBED (6+ archivos de producción) / 24-B DECISION_REQUIRED (ninguna evidencia encontrada)
GPS_REQUIRED_BY_OPERATOR=SI (P2-T02/T23/T24 preservados) / SUPPORT_INSTAGRAM=DEFERRED_TO_END_OF_CURRENT_BACKLOG / PAYMENTS-01..10=DEFERRED_PLANNED workstream separado / EMAIL_DIAGNOSTIC_DRIFT=KNOWN_NON_BLOCKING_HISTORICAL_DEBT (sacado del backlog activo)
P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T30_STATUS=CLOSED_TESTING_CERTIFIED / P2_T31_STATUS=CLOSED_TESTING_CERTIFIED / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (todos confirmados, sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_RECOMMENDED_ACTION=P2-T32 (Client Address UX Unification) — primer ítem del backlog activo sin dependencia dura pendiente (P2-T02 sigue bloqueada por hardware)
IMPORTANTE_PARA_HANDOFF_FUTURO=la autoridad primaria de estado VIGENTE del backlog ahora es la sección "CURRENT AUTHORITATIVE BACKLOG" al inicio de codex-reports/ROADMAP.md — nunca inferir estado de snapshots históricos por debajo de esa sección
Reporte: codex-reports/P2_CURRENT_AUTHORITATIVE_BACKLOG_RECONCILIATION.md
```

## 0.58 ESTADO ACTUAL — P2-T30 CERRADO: higiene de fixtures de `superadmin-auth.test.ts` — F-PRE-T29-03 resuelto con evidencia real (3 corridas limpias, 0 residuo, filas reales intactas), SIN cambios de código de producto — `P2_T30_STATUS=CLOSED_TESTING_CERTIFIED` — `main`/Production SIN CAMBIOS — sin otra tarea READY/QUEUED disponible salvo `P2-T02` (bloqueada) (2026-09-09) — CONSOLIDADO en 0.59

```text
TASK_STATUS=COMPLETE
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=2fff459b36ea459a9cb6603daf746c571562449d (nuevo commit) / origin/main=44af4ecedd245977f0a50eeeb5bb5b292519c370 (sin cambios)
ROOT_CAUSE=deleteMany({}) sin scope crasheaba contra 3 filas SuperAdmin reales vinculadas (2 referenciadas por FK Restrict de SolicitudRevisionResena) en la DB compartida de TESTING — confirmado empíricamente, no asumido
FIX=fixtures con id/sub/email únicos por corrida + cleanup exclusivamente por esos ids (nunca deleteMany({}) global) — único archivo modificado: src/lib/superadmin-auth.test.ts
HALLAZGO=4 tests dependían de "cero identidades vinculadas en TODA la tabla" (regla de negocio real, no un bug) — marcados test.skipIf() explícito (nunca se borró la fila real para forzar su PASS), cobertura preservada de forma permanente vía tests puros de la función de decisión
TESTS=48 pass + 4 skip + 0 fail, 3 corridas consecutivas idénticas + 77/77 en 7 archivos vecinos de SuperAdmin
QUALITY=TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
COMMIT=2fff459b36ea459a9cb6603daf746c571562449d (parent a5109b0) / PUSH=testing-codex únicamente / TESTING_DEPLOY_REQUIRED=NO (test-only) / PRODUCTION_TOUCHED=NO
F-PRE-T29-03=RESOLVED_BY_P2_T30 / F-P2-T30-01=OPEN_NON_BLOCKING (nuevo, 12 sesiones superadmin huérfanas preexistentes, no atribuibles a esta tarea, no tocadas)
P2_T27_STATUS=MERGED_CLOSED_BY_T29A confirmado sin conflicto real entre las 4 autoridades (fragmentos "QUEUED" del archivo son snapshot histórico anterior a T29A)
P2_T29A/B/C/D/E_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservados) / P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado)
P2_T30_STATUS=CLOSED_TESTING_CERTIFIED (era READY_TO_START)
NEXT_ROADMAP_TASK=P2-T02 (WAITING_FOR_OPERATOR — no accionable sin el operador). Ninguna otra tarea READY/QUEUED disponible: P2-T27 cerrado/fusionado, P2-T31 cerrado, Payments DEFERRED, P2-T19/23/24 fuera de secuencia o bloqueados.
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios)
Reporte: codex-reports/P2_T30_SUPERADMIN_AUTH_TEST_FIXTURE_HYGIENE.md
```

## 0.57 ESTADO ACTUAL — EPIC P2-T29 (A-E) CHECKPOINTED EN PRODUCTION: `main`/Production avanzados de `7a3a1dc` a `44af4ec` (source `testing-codex@a5109b0`), tag `p2-t29-stable-2026-09-09` creado, AMBOS servicios (DeliGO + chat en vivo) SUCCESS en el PRIMER intento — `P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED` — DeliGO SIGUE SIN LANZAMIENTO PÚBLICO — próxima tarea de roadmap: `P2-T30` (2026-09-09) — CERRADO en 0.58

```text
TASK_STATUS=COMPLETE
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
SOURCE_HEAD=testing-codex@a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (sin cambios) / RELEASE_COMMIT=44af4ecedd245977f0a50eeeb5bb5b292519c370 (parent 7a3a1dc)
DELTA=3 archivos (residual completo de T29D: order-transition-t29b-flow.test.ts, negocio/pedidos/[id]/estado/route.ts, push.ts) / T29E confirmado SIN código propio
PROMOTION_TESTS=163/163 (0 fallas) / TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
MIGRATIONS=0 ("No pending migrations to apply", 30 migrations found, confirmado en logs reales de Production)
PUSH=origin/main: 7a3a1dc..44af4ec (fast-forward, sin force) / origin/testing-codex sin cambios
PRODUCTION_DEPLOY=SUCCESS ambos servicios (DeliGO + chat en vivo), PRIMER intento, sin hiccup, commit exacto en ambos
SMOKE=8/8 rutas 200 (/,/cliente,/negocio,/repartidor,/operaciones,manifests,sw.js) contra el dominio real https://deligo.ar
TAG=p2-t29-stable-2026-09-09 -> 44af4ec
NOTA_OPERATIVA=CLI de Railway local linkeado por defecto a TESTING (no Production) — descubierto y corregido durante esta tarea; toda verificación de Production usó `-e production`/`-s` explícitos desde entonces (ver DECISIONS_AND_INVARIANTS.md)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (todos preservados)
P2_T29D_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T29E_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED)
P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (epic completo A-E, era CLOSED_TESTING_CERTIFIED)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios) / PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ROADMAP_TASK=P2-T30 (SUPERADMIN AUTH TEST FIXTURE HYGIENE — src/lib/superadmin-auth.test.ts, deleteMany({}) sin scope) — READY_TO_START, no iniciada
Findings preservados sin resolver: F-PRE-T29-03, F-P2-TESTINFRA-01, F-P2-T29A-02, Android session isolation (OPEN, public launch blocker), P2_T02_STATUS=WAITING_FOR_OPERATOR, deuda de íconos PWA.
Reporte: codex-reports/P2_T29D_T29E_PROMOTE_TO_MAIN_AND_PRODUCTION.md
```

## 0.56 ESTADO ACTUAL — EPIC P2-T29 CERRADO EN TESTING: certificación física final del operador PASS (Domicilio con dos repartidores reales/single-winner, Retiro, Mesa, sin notificaciones duplicadas) — `P2_T29_STATUS=CLOSED_TESTING_CERTIFIED`, `P2_T29E_STATUS=CLOSED_TESTING_CERTIFIED` — `main`/Production SIN CAMBIOS, tarea puramente documental — `RELEASE_BATCH=P2_T29D_PLUS_P2_T29E` LISTO PARA PROMOCIÓN (aún no ejecutada) (2026-09-09) — PROMOVIDO en 0.57

```text
TASK_STATUS=COMPLETE
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (sin drift) / origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (sin cambios)
PHYSICAL_CERTIFICATION_RESULT=PASS / ENVIRONMENT=TESTING / DATE=2026-09-09 / OPERATOR_CONFIRMED=SI
Domicilio: flujo canónico completo, notificaciones "aceptado"/"buscando delivery" únicas, dos repartidores reales compitiendo con single-winner confirmado, entrega final OK. Retiro: completo, sin buscando-delivery, sin Repartidor. Mesa: completo, sin aceptado, sin Repartidor. Sin duplicados de notificación en ningún caso.
CODE_CHANGES_REQUIRED_FOR_CLOSE=NO / CLOSE_COMMIT_SHA=N/A / PUSH_TO_TESTING=NO (tarea puramente documental, sin reejecutar los 218 tests ya certificados en la tarea automática previa)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (todos preservados)
P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (preservado, NO Production checkpoint todavía)
P2_T29E_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION)
P2_T29_STATUS=CLOSED_TESTING_CERTIFIED (epic completo, era IN_PROGRESS) — NO equivale a Production checkpoint ni a public launch ready
RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS / RELEASE_BATCH=P2_T29D_PLUS_P2_T29E / RELEASE_BATCH_READY_FOR_PROMOTION=SI / PROMOTION_EVALUATION_POINT=NOW
Findings preservados sin resolver: F-PRE-T29-03, F-P2-TESTINFRA-01 (recurrencia P2028 ya reproducida y descartada en T29E, no reabierta), F-P2-T29A-02, Android session isolation (OPEN, public launch blocker), P2_T02_STATUS=WAITING_FOR_OPERATOR, deuda de íconos PWA.
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios)
NEXT_RECOMMENDED_ACTION=PROMOTE_P2_T29D_PLUS_P2_T29E_TO_MAIN_AND_PRODUCTION (tarea separada, requiere autorización explícita del operador)
Reporte: codex-reports/P2_T29E_AND_T29_FINAL_PHYSICAL_CERTIFICATION_CLOSEOUT.md
```

## 0.55 ESTADO ACTUAL — P2-T29E: auditoría final + regresión completa del epic T29 — 218 tests reales, 0 fallas nuevas, SIN cambios de código — `P2_T29E_STATUS=WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION` — `main`/Production SIN CAMBIOS — epic P2-T29 (completo) sigue `IN_PROGRESS`, pendiente certificación física final (2026-09-09) — CERRADO en 0.56

```text
TASK_STATUS=AUTOMATED_FINAL_CERTIFICATION_COMPLETE_AWAITING_OPERATOR
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (sin drift) / origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (sin cambios)
AUDITORIA=autoridad de transición única confirmada (5 consumidores, sin tablas duplicadas), grafos canónico/legacy domicilio/retiro certificados por test real (no sólo diseño), UI Negocio nunca ofrece atajo legacy como CTA, timeline Cliente 5 pasos sin estado crudo visible, Mesa no pasa por el panel Cliente (flujo separado ya certificado)
BATERIA_FINAL=218 tests (122 puros + 24 mock-db + 72 integración DB real), 0 fallas nuevas — 1 fallo P2028 transitorio en archivo P2-T25 ajeno al diff, reproducido como recurrencia de F-P2-TESTINFRA-01 (no regresión, no reabre el finding)
QUALITY=TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
CODE_CHANGES_REQUIRED=NO / CLOSE_COMMIT_SHA=N/A / PUSH_TO_TESTING=NO (tarea puramente de auditoría/tests, sin código tocado)
P2_T29A/B/C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservados) / P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (preservado)
P2_T29E_STATUS=WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION (era READY_TO_START)
P2_T29_STATUS=IN_PROGRESS (epic completo NO se marca cerrado hasta la certificación física final del operador)
PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E (sin cambios) / PROMOTION_EVALUATION_POINT=AFTER_P2_T29E_CERTIFICATION
NEXT_RECOMMENDED_ACTION=OPERATOR_FINAL_PHYSICAL_CERTIFICATION_P2_T29E (checklist completo Domicilio/Retiro/Mesa en el reporte)
Reporte: codex-reports/P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION.md
```

## 0.54 ESTADO ACTUAL — P2-T29D CERRADO: certificación física del operador PASS (10/10 ítems — Domicilio 4/4, Retiro 3/3, Mesa 2/2, sin duplicados, timeline sin regresión) — `P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED`, `P2_T29E_STATUS=READY_TO_START` — `main`/Production SIN CAMBIOS, tarea puramente documental sin código tocado — `PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E` (2026-09-09) — auditoría final CERRADA en 0.55

```text
TASK_STATUS=COMPLETE
Repo: C:\Leo Campos\Trabajo\deligo-main-limpio / Branch: testing-codex
HEAD=origin/testing-codex=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (sin drift)
origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (sin cambios, checkpoint T29B+T29C intacto)
tag p2-t29b-t29c-stable-2026-09-09 -> 7a3a1dcbfa89bd63c96471290e936b979d74c5ce (verificado)
PHYSICAL_CERTIFICATION_RESULT=PASS / ENVIRONMENT=TESTING / DATE=2026-09-09 / OPERATOR_CONFIRMED=SI
Residual certificado: notificación Cliente recibido->aceptado ("<negocio> aceptó tu pedido"), Domicilio y Retiro; Mesa no participa (no aplica).
CODE_CHANGES_REQUIRED_FOR_CLOSE=NO / CLOSE_COMMIT_SHA=N/A / PUSH_TO_TESTING=NO (tarea puramente documental)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (todos preservados)
P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION)
P2_T29E_STATUS=READY_TO_START / P2_T29_STATUS=IN_PROGRESS (epic completo no se marca cerrado hasta T29E)
RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS / PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E / T29D_STANDALONE_PROMOTION_REQUIRED=NO / PROMOTION_EVALUATION_POINT=AFTER_P2_T29E_CERTIFICATION
NEXT_RECOMMENDED_ACTION=P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION
Reporte: codex-reports/P2_T29D_PHYSICAL_CERTIFICATION_CLOSEOUT.md
```

## 0.53 ESTADO ACTUAL — P2-T29D AUDITADO (scope histórico completo comparado requisito por requisito) + ÚNICO RESIDUAL REAL IMPLEMENTADO Y DESPLEGADO A TESTING: notificación Cliente "aceptado" (copy decidido por el operador, no inventado) — `P2_T29D_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (NO CERRADO, cambio user-visible) — `main`/Production SIN CAMBIOS (2026-09-09) — CERRADO en 0.54

```text
HEAD=origin/testing-codex=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (AVANZÓ desde 0c23008 — 1 commit nuevo)
origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (SIN CAMBIOS — checkpoint T29B+T29C preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=a5109b0... SUCCESS / chat en vivo TESTING también redeployado mismo commit, SUCCESS / Railway Production/DeliGO=7a3a1dc... SUCCESS (sin cambios) / tag p2-t29b-t29c-stable-2026-09-09 -> 7a3a1dc (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=AUDITED_RESIDUAL_IMPLEMENTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_GATE

CORRECCIÓN_DOCUMENTAL_PREVIA=conteo de tests de la promoción reconciliado: subtotal de order-status-t29b-safe-render.test.ts estaba transcrito como 8 (real: 5) desde el reporte de T29B-R1, propagado sin re-verificar a TEST_AUTHORITY.md, al reporte de T29C y al de la promoción — el total real (134) siempre fue correcto porque se midió ejecutando la batería completa, no sumando subtotales escritos. Corregido en los 4 documentos, sin reabrir la promoción.

FASE_A_AUDIT=matriz completa contra P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md §10/§11 (autoridad de diseño original completa, no sólo NEXT_RECOMMENDED_ACTION): 6 requisitos originales de T29D, 5 ya implementados+certificados+en Production (timeline Cliente 5 pasos, notificación "Buscando delivery", aviso a repartidores de nuevo delivery, notificación de asignación preexistente preservada sin cambios, mover-notificación-a-factory explícitamente marcado no-obligatorio en el diseño), 1 residual real = notificación Cliente recibido->aceptado (única fila de la matriz original marcada como requerida sin calificar de "opcional", y explícitamente suprimida por T29B/T29B-R1 con comentario "diferido a T29D")
PRODUCT_DECISION_HANDLED_CORRECTLY=SI — el copy de esa notificación nunca había sido cerrado por ninguna autoridad (sólo un "(propuesto)" de la auditoría original, read-only, sin poder de decisión de producto); se presentaron 3 opciones cortas al operador ANTES de escribir código, en vez de elegir unilateralmente
ACCEPTED_NOTIFICATION_TITLE=Actualización de pedido (genérico existente) / ACCEPTED_NOTIFICATION_BODY=${negocioNombre} aceptó tu pedido / ACCEPTED_NOTIFICATION_APPLIES_TO=domicilio + retiro (mesa nunca alcanza aceptado)

IMPLEMENTACION=fileset mínimo de 3 archivos — src/lib/push.ts (1 key nueva en el mapa ya existente de orderUpdateNotification, sin factory nueva, tal como el diseño original ya indicaba NEW_FACTORY_REQUIRED=NO) + negocio/pedidos/[id]/estado/route.ts (eliminada la supresión explícita isAcceptedWithoutClientCopy que T29B había dejado) + 1 test actualizado + 4 tests nuevos
TIMELINE_RESIDUAL_REQUIRED=NO (sin hueco real, no se tocó client-orders-panel.tsx) / RETIRO=misma notificación que domicilio por decisión del operador / MESA=0 notificaciones (nunca alcanza aceptado, estructural) / LEGACY=preservado, 0 notificaciones para recibido->preparando directo / SINGLE_WINNER=probado con CAS real (Promise.all, 1 winner/1 loser, 1 notificación)

TEST_MATRIX=134 puros + 33 DB reverificados sin cambios de comportamiento + 5 tests T29D nuevos (domicilio 1, retiro 1, mesa 0, CAS-loser 0/double-tap 1, legacy 0) = NEW_FAIL=0 (1 fallo no-determinístico observado en una corrida de order-transition-t29b-flow.test.ts, PRE-EXISTENTE y ajeno al fileset — colisión de email por randomUUID().slice(0,2) de baja entropía, reproducido: reejecución completa 18/18 PASS)
VERIFICACION_VISUAL_LOCAL=NO REALIZADA — cambio pequeño y acotado, cobertura de integración real (DB de TESTING) ya prueba el comportamiento exacto por modalidad/CAS; el gate determinante sigue siendo la certificación física pendiente
BUILD/LINT/SECRET_SCAN=todos PASS/limpios / TYPECHECK_RAW=24 (idéntico al baseline, mismos 14 archivos preexistentes, 0 nuevos)

T29D_COMMIT=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (parent 0c2300827ea09d149253b84bc43fa5bda6db29f2, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=SUCCESS (DeliGO Copy) commit match exacto / chat en vivo TESTING también SUCCESS mismo commit / SMOKE=/,/cliente,/negocio,/repartidor,/operaciones todos 200
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (sin cambios, verificado antes y después)

RELEASE_CADENCE_DECISION=sin cambios — RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS preservada / PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E (propuesta, no obligación) / P2_T29E_STATUS=QUEUED_AFTER_T29D

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios) / F-P2-T29B-R1-01/F-P2-T29C-01=RESOLVED (preservados)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29D_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (era READY_TO_START) / P2_T29_STATUS=IN_PROGRESS
NEXT_RECOMMENDED_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29D — checklist reducido entregado en el reporte (codex-reports/P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md sección 16). Sólo si PASS: cerrar T29D y evaluar P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION. NO main, NO Production, NO tag, NO T29E todavía.
```

Tarea de dos fases sobre P2-T29D: auditoría completa (no asumida) del
scope histórico original, comparado requisito por requisito contra la
implementación real de T29B/T29B-R1/T29C — confirmando que 5 de 6
requisitos ya estaban satisfechos, certificados físicamente, y en
Production. El único residual real (notificación Cliente para
`aceptado`) tenía un copy nunca cerrado por ninguna autoridad — se
presentaron opciones al operador antes de escribir código, siguiendo
exactamente el protocolo que la propia tarea exigía para evitar
inventar una decisión de producto.

Durante el audit se detectó y corrigió una discrepancia documental
(conteo de tests 134 vs 137 en el reporte de promoción) — causada por
un subtotal transcrito erróneamente en el reporte de T29B-R1 y
propagado sin re-verificar a 3 reportes más. Corregida en los 4
documentos; el total real (134) siempre fue correcto, la promoción no
se reabrió.

La implementación del residual fue mínima (3 archivos: 1 key nueva en
un mapa ya existente + 1 supresión eliminada + tests). Ningún otro
residual real quedó pendiente. Verificado con 134+33+5 tests (0 fallas
nuevas), build/lint/typecheck limpios, commit `a5109b0` pusheado a
`testing-codex`, deploy TESTING SUCCESS en el commit exacto, Production
verificada intacta. Por ser un cambio user-visible (nueva notificación
push), `P2_T29D_STATUS` permanece
`WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — no se cierra en esta
tarea. Detalle completo:
`codex-reports/P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md`.

## 0.52 ESTADO ACTUAL — P2-T29B + P2-T29C PROMOVIDOS A PRODUCTION: `main`/Production avanzados de `c45fd5e` a `7a3a1dc`, tag `p2-t29b-t29c-stable-2026-09-09` creado, AMBOS servicios (DeliGO + chat en vivo) SUCCESS en el PRIMER intento — `P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`, `P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED` — DeliGO SIGUE SIN LANZAMIENTO PÚBLICO (2026-09-09)

```text
HEAD=origin/testing-codex=0c2300827ea09d149253b84bc43fa5bda6db29f2 (SIN CAMBIOS)
origin/main=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (AVANZÓ desde c45fd5ec8cd771d68020f37d892be31d62fb54c5)
Railway Production/DeliGO=7a3a1dc... SUCCESS (primer intento, deployment a5a7ffd0-c38e-4c27-a967-94128e5f70e1) / Railway Production/chat en vivo=7a3a1dc... SUCCESS (primer intento, deployment 3794366d-7a62-47e7-8c3c-3bb37715610c — sin el hiccup que P2-T29A tuvo, sin redeploy necesario) / Railway TESTING/DeliGO Copy=0c23008... SUCCESS (sin cambios)
tag p2-t29b-t29c-stable-2026-09-09 -> 7a3a1dcbfa89bd63c96471290e936b979d74c5ce (nuevo, dereferenciado y confirmado)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios — esta promoción NO es lanzamiento público)

TASK_STATUS=COMPLETE

RELEASE_METHOD=git commit-tree (tree=testing-codex@0c2300827ea09d149253b84bc43fa5bda6db29f2, parent=origin/main@c45fd5ec8cd771d68020f37d892be31d62fb54c5) — mismo método curado validado 4 veces, sin merge genérico, sin tocar HEAD/branch local
BYTE_TREE_EQUIVALENT_TO_TESTING_HEAD=SI (verificado 2 veces)
PROMOTION_DIFF=22 archivos (8 added + 14 modified + 0 deleted), auditados uno por uno contra el fileset certificado de T29B+T29B-R1+T29C — sin sorpresas, sin T29D/T29E, mini-services/chat-service y prisma/ sin tocar
PROMOTION_TESTS=134 puros + 47 DB (0 fallas nuevas) — 1 fallo no-determinístico en order-transition-cas-concurrency.test.ts (archivo NO tocado por el diff), reproducido en aislamiento (6/6 PASS) y en la batería completa reejecutada (47/47 PASS), clasificado ruido de infraestructura de test compartida
BUILD/LINT/TYPECHECK/SECRET_SCAN=todos PASS/limpios (TYPECHECK_RAW=24, idéntico al baseline, 0 nuevos)

RELEASE_COMMIT=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (parent c45fd5ec8cd771d68020f37d892be31d62fb54c5)
MAIN_PUSH=SI (fast-forward, sin force) / TESTING_CODEX_UNCHANGED=SI
PRODUCTION_DEPLOYMENT=a5a7ffd0-c38e-4c27-a967-94128e5f70e1 (DeliGO) SUCCESS, commit match exacto / chat en vivo Production=3794366d-7a62-47e7-8c3c-3bb37715610c SUCCESS, commit match exacto, AMBOS EN EL PRIMER INTENTO
PRODUCTION_MIGRATIONS_APPLIED_COUNT=0 ("No pending migrations to apply")
SMOKE=/, /cliente, /negocio, /repartidor, /operaciones, 3 manifests, sw.js -> todos 200 (/ -> 307 redirect esperado) + verificación semántica del commit desplegado (esperando_repartidor canónico, timeline 5 pasos, waiting-driver-boundary de Negocio ausente)
MAIN_PRODUCTION_COMMIT_MATCH=SI

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T29_STATUS=IN_PROGRESS (T29D/T29E pendientes, epic completo no se marca cerrado) / P2_T29D_STATUS=READY_TO_START
P2_T29D_REQUIRES_RESIDUAL_SCOPE_RECONCILIATION=SI — parte del alcance histórico de T29D (timeline Cliente segura para aceptado/esperando_repartidor, notificación "Buscando delivery") ya fue implementada y certificada durante T29B-R1/T29C, y ahora está en Production — la próxima tarea DEBE auditar contra el diseño original qué falta realmente (p.ej. notificación de "aceptado", todavía diferida) antes de implementar, para no duplicar funcionalidad ya certificada
ROLLBACK_TRIGGERED=NO

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios) / F-P2-T29B-R1-01/F-P2-T29C-01=RESOLVED (preservados)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION — auditar primero qué queda pendiente del diseño T29D original antes de implementar. NO iniciada por esta tarea. NO lanzamiento público, NO tag adicional, NO tocar testing-codex.
```

Cuarta aplicación de `RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_
PROMOTIONS`: con T29B y T29C ambos certificados (incluida la
certificación física con dos repartidores reales), se promovió el
bloque funcional completo — antes retenido de Production deliberadamente
porque T29B solo dejaba pedidos "buscando repartidor" sin ningún
consumidor real. El diff de 22 archivos se auditó uno por uno contra el
fileset exacto certificado en las 3 tareas previas — sin sorpresas, sin
implementación adicional de T29D/T29E.

Durante la batería de tests de promoción apareció un único fallo no
determinístico en un archivo que NO forma parte de este diff — se aplicó
el protocolo exigido de infra flaky (reproducción en aislamiento +
reejecución completa) antes de descartarlo como ruido de test compartido,
nunca asumido automáticamente. A diferencia de la promoción de P2-T29A,
esta vez AMBOS servicios de Production desplegaron `SUCCESS` en el
primer intento — sin el hiccup transitorio de `chat en vivo` que
requirió un reintento manual la vez anterior.

`P2_T29B_STATUS` y `P2_T29C_STATUS` pasan a
`CLOSED_PRODUCTION_CHECKPOINTED`. `P2_T29_STATUS` permanece
`IN_PROGRESS` — T29D/T29E siguen pendientes, el epic completo no se
marca cerrado. Se deja registrado explícitamente que parte del alcance
histórico de T29D ya está en Production (certificado durante T29B-R1) —
la próxima tarea debe reconciliar ese alcance residual antes de
implementar cualquier cosa nueva. DeliGO permanece sin lanzamiento
público. Detalle completo:
`codex-reports/P2_T29B_T29C_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## 0.51 ESTADO ACTUAL — P2-T29C CERRADO: certificación física con DOS repartidores reales PASS (11/11 ítems) — `P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED` y `P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED`, bloque `RELEASE_BATCH=P2_T29B_PLUS_P2_T29C` queda `RELEASE_BATCH_READY_FOR_PROMOTION=SI` — `main`/Production SIN CAMBIOS, tarea puramente documental sin código tocado, PROMOCIÓN AÚN NO EJECUTADA (2026-09-09)

```text
HEAD=origin/testing-codex=0c2300827ea09d149253b84bc43fa5bda6db29f2 (SIN CAMBIOS — ningún commit nuevo, tarea de cierre puramente documental)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=0c23008... Online, sin build en curso (estable) / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=COMPLETE

PHYSICAL_CERTIFICATION_RESULT=PASS / PHYSICAL_CERTIFICATION_ENVIRONMENT=TESTING / PHYSICAL_CERTIFICATION_DATE=2026-09-09 / OPERATOR_CONFIRMED=SI
CHECKLIST_DOS_REPARTIDORES=11/11 PASS — mismo pedido visible a ambos, single-winner, perdedor no asignado y desaparece tras poll, Cliente avanza a En camino, Negocio deja de buscar, nunca dos asignados, segundo pedido disponible sin en_camino manual, Retiro/Mesa excluidos, notificaciones correctas sin duplicados
TWO_DRIVER_PHYSICAL_SINGLE_WINNER=SI / FINAL_ASSIGNED_DRIVER_COUNT=1 — complementa (no reemplaza) la evidencia automática ya probada (Promise.all contra Postgres real de TESTING)

CODE_CHANGES_REQUIRED_FOR_CLOSE=NO — ningún archivo de código tocado en esta tarea
CLOSE_COMMIT_SHA=N/A — los 8 archivos de autoridad/contexto están TODOS untracked en este repo — sin commit posible ni necesario
PUSH_TO_TESTING=NO (nada trackeado cambió) / ORIGIN_TESTING_MATCH_HEAD=SI / ORIGIN_MAIN_UNCHANGED=SI
PRODUCTION_TOUCHED=NO

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION) / P2_T29_STATUS=IN_PROGRESS (T29D/T29E pendientes, epic completo no se marca cerrado)
RELEASE_BATCH=P2_T29B_PLUS_P2_T29C / RELEASE_BATCH_READY_FOR_PROMOTION=SI / PROMOTION_EVALUATION_POINT=NOW / RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS (preservada)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público — no bloquea esta certificación) / F-PRE-T29-03/F-P2-TESTINFRA-01/F-P2-T29A-02=sin cambios / F-P2-T29B-R1-01/F-P2-T29C-01=RESOLVED (preservados)
NEXT_RECOMMENDED_ACTION=PROMOTE_P2_T29B_PLUS_P2_T29C_TO_MAIN_AND_PRODUCTION — tarea SEPARADA, NO iniciada por este cierre. NO main push, NO Production deploy, NO tag, NO migration en esta tarea.
```

Cierre formal de P2-T29C tras certificación física del operador con DOS
repartidores reales en TESTING: PASS en los 11 ítems del checklist —
ambos ven el mismo pedido `esperando_repartidor`, exactamente uno gana,
el perdedor no queda asignado y su pedido desaparece tras el siguiente
poll, Cliente avanza a "En camino", Negocio deja de mostrar "Buscando
repartidor...", nunca dos asignados, Retiro/Mesa nunca aparecen,
notificaciones correctas sin duplicados. Esta certificación COMPLEMENTA
— no reemplaza — la evidencia automática de concurrencia ya probada en
la implementación (`Promise.all` contra Postgres real). Tarea puramente
documental: no se tocó ningún archivo de código, `origin/testing-codex`
sigue exactamente en el commit certificado
(`0c2300827ea09d149253b84bc43fa5bda6db29f2`), `origin/main` permanece
intacto en `c45fd5ec8cd771d68020f37d892be31d62fb54c5`. Sin commit ni
push en este cierre (authority docs untracked).

Con T29B y T29C ambos `CLOSED_TESTING_CERTIFIED`, el bloque
`RELEASE_BATCH=P2_T29B_PLUS_P2_T29C` queda
`RELEASE_BATCH_READY_FOR_PROMOTION=SI` — **pero esta tarea NO promueve
nada a Production**. La ejecución de
`PROMOTE_P2_T29B_PLUS_P2_T29C_TO_MAIN_AND_PRODUCTION` queda como tarea
separada, explícitamente pendiente de autorización futura. `P2_T29_
STATUS` permanece `IN_PROGRESS` — T29D/T29E siguen pendientes según la
autoridad del roadmap. Detalle completo:
`codex-reports/P2_T29C_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## 0.50 ESTADO ACTUAL — P2-T29C IMPLEMENTADO, TESTEADO (incluye concurrencia real de 2 repartidores contra Postgres de TESTING) Y DESPLEGADO A TESTING: Repartidor ya consume `esperando_repartidor`, gap crítico de concurrencia de la auditoría original cerrado — `main`/Production SIN CAMBIOS, `P2_T29C_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (NO CERRADO, requiere certificación física con DOS repartidores reales) (2026-09-09)

```text
HEAD=origin/testing-codex=0c2300827ea09d149253b84bc43fa5bda6db29f2 (AVANZÓ desde 155b4c4 — 1 commit nuevo)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=0c23008... SUCCESS (138s) / chat en vivo TESTING también redeployado mismo commit, SUCCESS / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_TWO_DRIVER_PHYSICAL_GATE

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED (normalizado, preservado — 10/10 PASS físico) / P2_T29C_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (era READY_TO_START) / P2_T29_STATUS=IN_PROGRESS

SIGNIFICADO_FINAL=esperando_repartidor=disponible sin asignar (CANÓNICO); en_camino=ya asignado, en viaje (ya NO significa "buscando repartidor" — ese significado sobrecargado quedó resuelto)
AVAILABLE_QUERY=GET /api/repartidor/pedidos consulta esperando_repartidor (canónico) + en_camino (LEGACY_AVAILABLE_COMPAT, necesario porque NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS todavía acepta preparando->en_camino directo durante el rollout) — única autoridad: isAvailableForDriverAcceptance() en order-transitions.ts, consumida también por el CAS de aceptación y por auto-cancel
ACCEPT_CAS=repartidor/pedidos/[id]/aceptar/route.ts compara contra el ÚNICO valor exacto de estado leído (nunca estado:{in:[...]} en la escritura); PedidoEvento.estadoAnterior corregido de un hardcodeo a "en_camino" (F-P2-T29C-01, resuelto en la misma tarea) al valor real de origen
TWO_DRIVER_CONCURRENCY_PROVEN=SI — cierra el GAP CRÍTICO de la auditoría P2-T29 original ("sin ningún test de concurrencia real"): 2 tests con Promise.all contra Postgres real de TESTING (canónico + legacy), 1 winner/1 loser, exactamente 1 repartidor asignado, exactamente 1 PedidoEvento
CANCEL_ACCEPT_RACE_PROVEN=SI (Negocio cancela esperando_repartidor mientras Repartidor acepta — resultado siempre coherente, nunca corrupto)
AUTO_CANCEL=reconoce ambos estados, misma ventana de tiempo sin cambios, mismo fix de auditoría
NEW_DELIVERY_NOTIFICATION_BOUNDARY=movido de en_camino a preparando->esperando_repartidor (canónico), preparando->en_camino directo (legacy) preservado sin duplicar — la aceptación real de Repartidor (endpoint distinto) nunca re-dispara este aviso
ASSIGNMENT_NOTIFICATION_TO_CLIENTE=preexistente, preservada sin cambios ("Repartidor asignado 🛵")
CLIENT_WAITING_NOTIFICATION_PRESERVED=SI (T29B-R1, sin tocar) / CLIENT_TIMELINE=sin tocar
NEGOCIO_WAITING_TO_EN_CAMINO_ACTION=NO cambiado, reverificado (waiting driver boundary de T29B intacto)
REPARTIDOR_UI=sin cambios de frontend (deliveries-tab.tsx/repartidor-panel.tsx ya dependían 100% del split servidor, sin comparación de estado hardcodeada); polling 8s sin cambios
LEGACY_COMPATIBILITY=explícita y acotada, sin backfill, sin migration, Retiro/Mesa nunca elegibles (metodoEntrega gatea antes que estado)

FILESET=10 archivos (5 producto + 5 test: 1 modificado + 4 nuevos) — Prisma/migrations/SW/manifests/chat/branding/Cliente-redesign SIN TOCAR
TEST_MATRIX=~90 tests nuevos/extendidos (7 order-transitions + 4 available-query + 12 aceptar-CAS incl. 2 concurrencia real + 1 cancel-vs-accept-race + 4 auto-cancel + 4 new-delivery-boundary) + 142+27+12 reverificados sin cambios de comportamiento (T29B-R1, T29B/T29A flow, Operaciones PyR/Salón) = NEW_FAIL=0
VERIFICACION_VISUAL_LOCAL=NO REALIZADA en esta tarea (a diferencia de T29B) — Promise.all contra Postgres real de TESTING se consideró evidencia más rigurosa para el riesgo de concurrencia específico de esta tarea que un click manual de dos pestañas
BUILD/LINT/SECRET_SCAN=todos PASS/limpios / TYPECHECK_RAW=24 (idéntico al baseline, mismos 14 archivos preexistentes, 0 nuevos — 1 TS2769 real encontrado y corregido en un test nuevo durante esta misma tarea)

T29C_COMMIT=0c2300827ea09d149253b84bc43fa5bda6db29f2 (parent 155b4c4f0ce6426bea429f9aa400061e8a1e5455, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=22c337f9-773f-4478-8587-ee97cc626a26 (DeliGO Copy) SUCCESS, commit match exacto / chat en vivo TESTING también SUCCESS mismo commit / SMOKE=/repartidor,/negocio,/cliente,/operaciones todos 200
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (sin cambios, verificado antes y después)

RELEASE_CADENCE_DECISION=sin cambios — RELEASE_BATCH=P2_T29B_PLUS_P2_T29C, P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO, PROMOTION_EVALUATION_POINT=AFTER_P2_T29C_CERTIFICATION, sin promoción en esta tarea

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios) / F-P2-T29B-R1-01=RESOLVED (preservado) / F-P2-T29C-01=RESOLVED (PedidoEvento.estadoAnterior hardcodeado, corregido en esta tarea)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado — condiciona el setup físico de T29C: preferir 2 dispositivos/perfiles independientes, no bloquea la certificación)
NEXT_RECOMMENDED_ACTION=OPERATOR_TWO_DRIVER_PHYSICAL_CERTIFICATION_P2_T29C — checklist entregado en el reporte (codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md sección 17). Sólo si PASS: cerrar T29C (P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED) y recién ahí evaluar PROMOTE_P2_T29B_PLUS_P2_T29C_TO_MAIN_AND_PRODUCTION como tarea separada. NO main, NO Production, NO tag en esta tarea.
```

Tercera fase de Repartidor de P2-T29: hace que Repartidor consuma
realmente `esperando_repartidor` en vez del `en_camino`+
`repartidorId=null` legacy sobrecargado. La query de disponibilidad, el
CAS de aceptación, y auto-cancel migran a una única autoridad compartida
(`isAvailableForDriverAcceptance` en `order-transitions.ts`) que
reconoce el estado canónico Y preserva compatibilidad legacy explícita
(nunca ambigua — cada CAS compara contra el valor EXACTO leído, jamás un
`estado: { in: [...] }` en la escritura), necesaria porque
`NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS` todavía acepta la arista
directa `preparando->en_camino` durante el rollout de T29B.

El GAP CRÍTICO que la auditoría original de P2-T29 identificó
explícitamente ("la aceptación atómica del repartidor… no tiene NINGÚN
test de concurrencia real que lo demuestre") queda cerrado: dos
repartidores reales compitiendo vía `Promise.all` contra Postgres de
TESTING prueban single-winner (1×200/1×409, exactamente un
`repartidorId` final, exactamente 1 `PedidoEvento`). Un tercer test
cubre la carrera cancelación (Negocio) vs aceptación (Repartidor) —
resultado siempre coherente. Durante la implementación se corrigió un
hardcodeo de auditoría (`PedidoEvento.estadoAnterior` fijo a
`"en_camino"`, ya no siempre cierto) en ambos endpoints tocados.

El aviso a Repartidores de "nuevo delivery disponible" se movió de
`en_camino` a la transición canónica `preparando->esperando_repartidor`,
preservando el disparo legacy sin duplicar. Repartidor UI no requirió
ningún cambio de frontend — ya dependía 100% del split servidor.

A diferencia de T29B, esta tarea NO incluyó verificación visual en
navegador — la prueba de concurrencia real vía `Promise.all` contra
Postgres se consideró más fuerte que un click manual de dos pestañas
para el riesgo específico de esta tarea, y requería además mapear
`DATABASE_URL` en el entorno del dev server sin tocar `.env`. El gate
real y determinante sigue siendo la certificación física con DOS
repartidores reales, que continúa pendiente. `P2_T29C_STATUS` permanece
`WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION`. Detalle completo:
`codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md`.

## 0.49 ESTADO ACTUAL — P2-T29B CERRADO: certificación física del operador PASS (10/10 ítems — DOMICILIO 8/8, RETIRO 2/2) sobre el fix de P2-T29B-R1 — `P2_T29B_STATUS=CLOSED`, `P2_T29C_STATUS=READY_TO_START` (NO iniciada, operador pidió revisar el cierre primero) — `main`/Production SIN CAMBIOS, tarea puramente documental sin código tocado (2026-09-09)

```text
HEAD=origin/testing-codex=155b4c4f0ce6426bea429f9aa400061e8a1e5455 (SIN CAMBIOS — ningún commit nuevo, tarea de cierre puramente documental)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=155b4c4... SUCCESS (sin cambios) / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=CLOSED_DOCUMENTATION_ONLY

PHYSICAL_CERTIFICATION_DATE=2026-09-09 / PHYSICAL_CERTIFICATION_RESULT=PASS / PHYSICAL_CERTIFICATION_ENVIRONMENT=TESTING / PHYSICAL_CERTIFICATION_ITEMS_PASS=10 / PHYSICAL_CERTIFICATION_ITEMS_FAIL=0 / OPERATOR_CONFIRMED=SI
TIMELINE_DOMICILIO_CERTIFIED=SI (Recibido, Aceptado en el mismo primer nodo, Preparando, Buscando delivery, notificación única, En camino, Listo, nunca 6 pasos)
TIMELINE_RETIRO_CERTIFIED=SI (aceptado mantiene la timeline activa, nunca aparece "Buscando delivery")
WAITING_DRIVER_NOTIFICATION_CERTIFIED=SI / WAITING_DRIVER_NOTIFICATION_SINGLE_DELIVERY=SI
SIX_STEP_REGRESSION=NO / RETIRO_WAITING_DRIVER_REGRESSION=NO

CODE_CHANGES_REQUIRED_FOR_CLOSE=NO — ningún archivo de código tocado en esta tarea (client-orders-panel.tsx/push.ts/route.ts/repartidor/Prisma/migrations/sw/manifest/chat/branding sin tocar, git diff --stat vacío)
CLOSE_COMMIT_SHA=N/A — los 8 archivos de autoridad/contexto (CODEX_REPORT.md, ROADMAP.md, FINDINGS.md, TEST_AUTHORITY.md, DECISIONS_AND_INVARIANTS.md, GIT_DEPLOY_HISTORY.md, COMPLETED_TASKS.md, DELIGO_FULL_CONTEXT_LATEST.md) están TODOS untracked por git en este repo (confirmado con git ls-files) — actualizarlos no genera ningún commit posible ni necesario
PUSH_TO_TESTING=NO (nada trackeado cambió) / ORIGIN_TESTING_MATCH_HEAD=SI / ORIGIN_MAIN_UNCHANGED=SI
PRODUCTION_TOUCHED=NO

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=CLOSED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION) / P2_T29B_FINAL_RESULT=PASS / P2_T29C_STATUS=READY_TO_START (era QUEUED_AFTER_P2_T29B) / P2_T29_STATUS=IN_PROGRESS (epic completo requiere T29C)
RELEASE_CADENCE_DECISION=sin cambios — RELEASE_BATCH=P2_T29B_PLUS_P2_T29C preservado, P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO preservado (cerrar T29B no dispara promoción por sí solo — evaluación recién después de certificar T29C también)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_TASK_RECOMMENDED=P2-T29C (Repartidor consume esperando_repartidor: polling/visibilidad + aceptación real) — NO iniciada automáticamente, el operador pidió detenerse a revisar este cierre primero. NO main, NO Production, NO tag en esta tarea.
```

Cierre formal de P2-T29B tras `OPERATOR_PHYSICAL_CERTIFICATION=PASS`
(10/10 ítems, 0 fallas) reportado explícitamente por el operador:
domicilio (Recibido→Aceptado en el mismo primer nodo→Preparando→
Buscando delivery con notificación única→En camino→Listo, 5 pasos
exactos, nunca 6) y retiro (`aceptado` mantiene la timeline activa,
"Buscando delivery" nunca aparece) ambos PASS sin regresión. Esta
tarea fue puramente documental — no se tocó ningún archivo de código,
el commit certificado (`155b4c4`, P2-T29B-R1) ya estaba desplegado en
TESTING desde la tarea anterior. Los 8 archivos de autoridad/contexto
están todos `untracked` por git en este repositorio (confirmado con
`git ls-files`), consistente con el house style ya documentado del
proyecto — actualizarlos no genera ningún diff trackeado, por lo que
no hubo commit ni push en esta tarea.

`P2_T29B_STATUS` pasa a `CLOSED`. `P2_T29C_STATUS` pasa a
`READY_TO_START`, pero **NO se inicia automáticamente** — el operador
pidió detenerse explícitamente para revisar este cierre antes de
comenzar la siguiente etapa. `RELEASE_BATCH=P2_T29B_PLUS_P2_T29C` y
`P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO` se preservan sin
cambios: cerrar T29B no dispara ninguna promoción a Production por sí
solo, esa evaluación sigue diferida hasta certificar también T29C.
Detalle completo:
`codex-reports/P2_T29B_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## 0.48 ESTADO ACTUAL — P2-T29B-R1 FIX FOCAL IMPLEMENTADO Y DESPLEGADO A TESTING: timeline Cliente ya no se apaga en `aceptado`/`esperando_repartidor` (5 pasos domicilio, primer nodo dinámico Recibido→Aceptado), notificación dedicada "Buscando delivery" agregada — `main`/Production SIN CAMBIOS, `P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (SIGUE NO CERRADO — este fix es prerequisito de esa certificación) (2026-09-09)

```text
HEAD=origin/testing-codex=155b4c4f0ce6426bea429f9aa400061e8a1e5455 (AVANZÓ desde 3d9f3b3 — 1 commit nuevo)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado, verificado antes y después)
Railway TESTING/DeliGO Copy=155b4c4... SUCCESS (36s) / chat en vivo TESTING también redeployado mismo commit, RUNNING / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_GATE

MOTIVO=feedback físico del operador durante la certificación de T29B, ANTES de cerrarla: la timeline Cliente usaba un findIndex sobre un array literal sin `aceptado`/`esperando_repartidor` — al llegar a esos estados el índice caía en -1 y la barra de progreso se apagaba por completo (el badge/label sí eran correctos desde T29B, sólo la timeline visual estaba rota)
CLIENT_TIMELINE_FIX=mapping explícito estado->índice (DOMICILIO_STEP_INDEX/RETIRO_STEP_INDEX en client-orders-panel.tsx) reemplaza el findIndex — domicilio conserva EXACTAMENTE 5 posiciones (Recibido/Aceptado dinámico -> Preparando -> Buscando delivery -> En camino -> Listo), retiro conserva su layout de 4 nodos sin cambio de forma (sólo se corrige que aceptado no apague la barra), Mesa sin tocar
CLIENT_TIMELINE_DYNAMIC_FIRST_NODE=SI — "Recibido" se vuelve "Aceptado" en el MISMO nodo una vez que el negocio acepta (nunca 2 nodos separados, nunca 6 pasos)
CLIENT_WAITING_DRIVER_NOTIFICATION=SI — nueva factory waitingDriverNotification() en push.ts, TITLE="Buscando delivery" BODY="El local está esperando un delivery para tu pedido.", enviada SÓLO en la transición real preparando->esperando_repartidor de domicilio (no aceptado — sigue diferido a T29D sin cambios —, no retiro, no legacy preparando->en_camino directo, no CAS loser)
SINGLE_WINNER_REVERIFICADO=CAS ya existente de T29A/route.ts sin cambios — probado con carrera de concurrencia real: 1×200/1×409, exactamente 1 Notificacion con título "Buscando delivery", 0 duplicados
REPARTIDOR/NEW_DELIVERY_NOTIFICATION/PRISMA/MIGRATIONS/SW/MANIFEST/CHAT/BRANDING=SIN TOCAR (fileset acotado a 5 archivos: 3 producto + 2 test)

TEST_MATRIX=142 tests reales (13 timeline puro NUEVO + 8 safe-render + 35 authority + 59 push unit + 14 T29B-flow integración [incluye 3 NUEVOS de notificación] + 13 CAS-concurrency/CAS-mesa/client-cancel regresión) — NEW_FAIL=0
VERIFICACION_VISUAL_LOCAL=NO REALIZADA en esta tarea (a diferencia de T29B) — se consideró que la cobertura de tests puros exhaustiva por estado (incluyendo saltos legacy) era suficiente para este fix acotado de mapping; el gate determinante sigue siendo la certificación física pendiente
BUILD/LINT/SECRET_SCAN=todos PASS/limpios / TYPECHECK_RAW=24 (idéntico al baseline ya documentado en T29B, mismos 14 archivos preexistentes, 0 nuevos)

T29B_R1_COMMIT=155b4c4f0ce6426bea429f9aa400061e8a1e5455 (parent 3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=22c337f9-773f-4478-8587-ee97cc626a26 (DeliGO Copy) SUCCESS, commit match exacto / chat en vivo TESTING también SUCCESS mismo commit
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (sin cambios, verificado antes y después)

RELEASE_CADENCE_DECISION=sin cambios — RELEASE_BATCH=P2_T29B_PLUS_P2_T29C, P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO, evaluación recién después de certificar T29C

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios) / F-P2-T29B-R1-01=RESOLVED (timeline Cliente apagada, corregida en esta tarea)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (sin cambios, este fix es prerequisito de esa certificación) / P2_T29C_STATUS=QUEUED_AFTER_P2_T29B / P2_T29_STATUS=IN_PROGRESS
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29B — checklist reducido específico de este fix entregado en el reporte (codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md sección 10). Sólo si PASS: cerrar T29B (P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED) e iniciar P2-T29C como tarea separada. NO T29C todavía, NO main, NO Production, NO tag.
```

Corrección focal (`PHYSICAL_GATE_FIX`) descubierta durante la
certificación física de P2-T29B, ANTES de cerrarla: la timeline de
Cliente para pedidos domicilio/retiro se apagaba por completo al
llegar a `aceptado`/`esperando_repartidor` — un `findIndex` sobre un
array literal que nunca incluyó esos 2 estados nuevos de T29B.
Reemplazado por un mapping explícito estado→índice, preservando
exactamente 5 posiciones visuales para domicilio (decisión explícita
del operador: nunca 6) con el primer nodo dinámico ("Recibido" pasa a
mostrarse como "Aceptado" en el mismo lugar, nunca dos nodos
separados). Retiro conserva su layout de 4 nodos sin cambio de forma,
sólo se corrigió el mismo bug de fondo para `aceptado`. Mesa no se
tocó.

Se agregó también una notificación dedicada al Cliente para la
transición real `preparando -> esperando_repartidor` en domicilio
("Buscando delivery" / "El local está esperando un delivery para tu
pedido.") — T29B había dejado ese estado completamente mudo para el
Cliente (diferido a T29D). `aceptado` sigue sin notificación propia,
sin cambios respecto a T29B. El invariante single-winner (CAS real ya
existente de T29A) se reverificó con una carrera de concurrencia real:
exactamente 1 notificación, 0 duplicados.

A diferencia de T29B, esta tarea NO incluyó verificación visual en
navegador con clicks reales — se consideró que la cobertura de tests
puros exhaustiva (cada estado, incluyendo los saltos legacy) era
suficiente para un fix acotado de mapping, dado que el gate
determinante sigue siendo la certificación física del operador, que
continúa pendiente. `P2_T29B_STATUS` permanece
`WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` — este fix es un
prerequisito de esa certificación, no la reemplaza. Detalle completo:
`codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md`.

## 0.47 ESTADO ACTUAL — P2-T29B IMPLEMENTADO Y DESPLEGADO A TESTING: flujo aceptado/preparando/esperando_repartidor activo en Negocio, cancelación Cliente desde aceptado activada, `esperando_repartidor` sin consumidor todavía (T29C, esperado) — `main`/Production SIN CAMBIOS, `P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION` (NO CERRADO) (2026-09-09)

```text
HEAD=origin/testing-codex=3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce (AVANZÓ desde 4b19954 — 1 commit nuevo)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (SIN CAMBIOS — checkpoint P2-T29A preservado)
Railway TESTING/DeliGO Copy=3d9f3b3... SUCCESS / Railway Production/DeliGO=c45fd5e... SUCCESS (sin cambios) / tag p2-t29a-stable-2026-09-09 -> c45fd5e (sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=T29B_IMPLEMENTATION_COMPLETE_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION

ORDER_TRANSITION_AUTHORITY_FILE=src/lib/order-transitions.ts — gana NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS (grafo NUEVO, sólo para negocio/pedidos/[id]/estado domicilio/retiro: aceptado+esperando_repartidor NUEVOS + aristas legacy preservadas). ACTIVE_FORWARD_TRANSITIONS SIN CAMBIOS — Operaciones/PyR, Operaciones/Salón, negocio/pedidos PUT-mesa siguen ahí, cero impacto (reverificado con sus propias suites, 12/12 pass)
UX_NEGOCIO=DOMICILIO: "Aceptar pedido"(recibido->aceptado)->"Preparar"(->preparando)->"Buscar repartidor"(->esperando_repartidor, SIN botón después — boundary T29C). RETIRO: mismo aceptado/preparar, luego "Listo para retirar" sin cambios. MESA: sin aceptado, flujo intacto
CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO=activado como comportamiento real (endpoint cancellableStatuses + gate de UI canCancel, ambos actualizados — sin el segundo, el backend aceptaría la cancelación pero el botón nunca aparecería)
WAITING_DRIVER_BOUNDARY=esperando_repartidor NUNCA es origen de ninguna transición de Negocio — verificado por test puro + integración. T29B_WAITING_DRIVER_NOT_YET_CONSUMED_BY_DRIVER=EXPECTED (un pedido puede quedar "Buscando repartidor..." sin que Repartidor lo vea todavía — eso es T29C, no un bug)
CLIENT_SAFE_RENDER=labels/emoji/colores agregados (aceptado="Aceptado"/✅/azul, esperando_repartidor="Buscando repartidor"/🔍/índigo) — nunca raw underscore; timeline de Cliente (T29D) NO tocado, su guard preexistente ya maneja el caso con seguridad

TEST_MATRIX=93 tests reales (38 authority + 11 negocio-regresión + 6 domicilio/retiro/mesa-flow + 2 CAS-concurrency + 4 client-cancel + 1 negocio-cancel + 5 safe-render + 14 order-security + 12 pyr/salon-regresión) — NEW_FAIL=0
VERIFICACION_VISUAL_LOCAL=EN VIVO con clicks reales — flujo domicilio Y retiro completos, clic por clic, contra un Negocio sintético creado en TESTING (fixtures borradas inmediatamente después, .env.local y script temporal nunca commiteados)
BUILD/LINT/TYPECHECK/SECRET_SCAN=todos PASS/limpios, sin regresión

T29B_COMMIT=3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce (parent 4b199540c78ebe0a010c699f6fc2e63b43d162a0, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=1c00f674-0882-4785-91b6-2560e275fec0 (DeliGO Copy) SUCCESS, commit match exacto / chat en vivo TESTING también SUCCESS mismo commit
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (sin cambios)

RELEASE_CADENCE_DECISION=P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO — RELEASE_BATCH=P2_T29B_PLUS_P2_T29C (bloque funcional único: T29B hace alcanzable esperando_repartidor sin que Repartidor lo consuma todavía; evaluación de promoción recién después de certificar T29C — excepción explícita ya prevista en RELEASE_CADENCE_POLICY, no la contradice)

F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (sin cambios, no corregido — no fue necesario para T29B)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION / P2_T29C_STATUS=QUEUED_AFTER_P2_T29B / P2_T29_STATUS=IN_PROGRESS
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29B — checklist DOMICILIO/RETIRO/MESA/MOBILE entregado en el reporte (codex-reports/P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW.md sección 23). Sólo si PASS: cerrar T29B (P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED) e iniciar P2-T29C como tarea separada. NO T29C todavía, NO main, NO Production, NO tag.
```

Segunda fase de implementación de P2-T29 (T29B), sobre la autoridad y
el CAS que T29A dejó listos. El grafo de rollout de Negocio
(`NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS`) queda deliberadamente
separado del grafo activo que el resto de los actores sigue usando —
ni Operaciones/PyR, ni Operaciones/Salón, ni Repartidor cambian de
comportamiento en esta tarea, confirmado reverificando sus propias
suites de test sin modificarlas. La decisión de cancelación de Cliente
desde `aceptado`, ya cerrada como autoridad pura en T29A, pasa a ser
comportamiento real — con el cuidado explícito de actualizar tanto el
backend como el gate de UI que decide mostrar el botón (un cambio a
medias habría dejado la capacidad inutilizable).

Se estableció y probó el "waiting driver boundary": Negocio nunca
puede avanzar manualmente `esperando_repartidor` a `en_camino` — eso
es exclusivo de T29C. La verificación fue más allá de tests
automatizados: se levantó la app localmente, se creó un Negocio
sintético directamente en la base de TESTING, y se ejecutó el flujo
domicilio y retiro COMPLETO con clicks reales sobre la UI renderizada,
confirmando visualmente cada badge/botón/label en cada paso — no sólo
lectura de código ni sólo integración de API. **T29B no se cierra
todavía** — falta la certificación física del operador en un
dispositivo real (mismo rigor que P2-T31), con un checklist corto
entregado en el reporte. Como T29B hace alcanzable
`esperando_repartidor` sin que Repartidor lo consuma (T29C), la
promoción a Production de este bloque queda diferida hasta certificar
también T29C — decisión de cadencia de release explícita, registrada
en `DECISIONS_AND_INVARIANTS.md`, consistente con (no contradice) la
política de promociones frecuentes. Reporte completo:
`codex-reports/P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW.md`.

## 0.46 ESTADO ANTERIOR — CHECKPOINT P2-T29A EN PRODUCTION: `main`/Production promovidos a `c45fd5e` (source `testing-codex@4b19954`), 0 migrations, tag `p2-t29a-stable-2026-09-09` creado, NUEVA política `RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS` registrada — `P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED` (2026-09-09)

```text
HEAD=origin/testing-codex=4b199540c78ebe0a010c699f6fc2e63b43d162a0 (SIN CAMBIOS)
origin/main=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (AVANZÓ desde 969ea77 — checkpoint P2-T29A promovido)
Railway Production/DeliGO=c45fd5e... SUCCESS / Railway Production/chat en vivo=c45fd5e... SUCCESS (tras 1 reintento — ver incidente abajo)
TAG=p2-t29a-stable-2026-09-09 -> c45fd5e (nuevo) / tag pre-t29-stable-2026-09-08 -> 969ea77 (preservado, sin cambios)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios — este checkpoint NO es lanzamiento público)

RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS (NUEVA, registrada formalmente en DECISIONS_AND_INVARIANTS.md) — regla: cerrar+certificar un bloque grande o un lote lógico de tareas pequeñas implica EVALUAR promoción a main/Production antes de iniciar el siguiente bloque grande, salvo blocker real/gate físico pendiente/regresión nueva. Primera aplicación práctica: esta misma tarea (promovió T29A solo, sin esperar T29B-E).

PROMOTION_DIFF=exactamente los 10 archivos de T29A (6 A, 4 M, 0 D) / T29B_PRESENT=NO / T29C_PRESENT=NO / NEW_MIGRATIONS=0
RELEASE_METHOD=snapshot commit vía git commit-tree (tercera vez, mismo procedimiento) / BYTE_TREE_EQUIVALENT=SI
TEST_BATTERY=81 tests reales (30 authority + 23 CAS + 14 order-security + 14 cancelación, 2 fallos preexistentes reproducidos idénticos contra el commit fuente sin modificar) / PROMOTION_NEW_FAIL=0
BUILD/LINT/TYPECHECK/SECRET_SCAN=todos PASS/limpios, sin regresión

INCIDENTE_TRANSITORIO_RESUELTO=el servicio "chat en vivo" (subdirectorio mini-services/chat-service, CONFIRMADO sin cambios en el diff) falló su primer deploy en este commit (build OK, sin logs de runtime) — la versión anterior (969ea77) siguió sirviendo sin corte real durante todo el intervalo. Presentado al operador (AskUserQuestion) sin resolver unilateralmente; eligió reintentar el mismo commit vía `railway redeploy` — SUCCESS en el segundo intento. Sin relación con el código promovido, sin rollback necesario.

MAIN_PRODUCTION_COMMIT_MATCH=SI (ambos servicios) / TESTING_CODEX_UNCHANGED=SI

P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (avanzó desde CLOSED_TESTING_CERTIFIED) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado) / P2_T29B_STATUS=READY_TO_START
P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado — P2-T29 completo sigue abierto, NO se marca cerrado) / P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado)
F-PRE-T29-03=OPEN_NON_BLOCKING_TEST_INFRA (sin cambios) / F-P2-TESTINFRA-01=OPEN_DEFERRED (sin cambios) / F-P2-T29A-02=PREEXISTING_NON_BLOCKING_AUDIT_GAP (negocio/pedidos/route.ts PUT mesa nunca genera PedidoEvento, sin cambios)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW — activar recibido→aceptado→preparando→esperando_repartidor en la API/UI de Negocio, no implementado en esta tarea
```

Primera aplicación práctica de la nueva política de cadencia de
release de DeliGO: en vez de dejar `testing-codex` acumular T29B-E
completos antes de tocar `main` (patrón que llevó a la auditoría masiva
de la promoción PRE-T29 original, con 168+ archivos de múltiples epics
acumulados), se promovió el bloque pequeño y recién certificado de
T29A inmediatamente, con una batería de test proporcionalmente focal
(81 tests, no la masiva de 1177). El único incidente de la tarea —un
fallo transitorio de plataforma en el servicio de chat, en un
subdirectorio completamente ajeno al diff— se resolvió con un simple
reintento del mismo commit ya verificado, sin necesidad de rollback y
sin corte de servicio real en ningún momento. `main` y Production
quedan exactamente sincronizados en `c45fd5e`; `testing-codex` intacto
en `4b19954`. Reporte completo:
`codex-reports/P2_T29A_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## 0.45 ESTADO ANTERIOR — P2-T29A CERRADO: autoridad de transición compartida (`src/lib/order-transitions.ts`) creada, 4 tablas de reglas duplicadas eliminadas (una cuarta, no documentada, encontrada en `negocio/pedidos/route.ts`), Negocio (ambos endpoints) migrado a DB CAS real, single-winner probado en 3 niveles, push+deploy TESTING SUCCESS, `origin/main`/Production SIN CAMBIOS — `P2_T29B_STATUS=READY_TO_START` (2026-09-09)

```text
HEAD=origin/testing-codex=4b199540c78ebe0a010c699f6fc2e63b43d162a0 (AVANZÓ desde 6c6fc58 — 1 commit nuevo)
origin/main=969ea77ab1630b443fbc0e609397d9c45c5d7443 (SIN CAMBIOS — checkpoint PRE-T29 preservado)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRE_T29_TAG=pre-t29-stable-2026-09-08 -> 969ea77 (sin cambios)

TASK_STATUS=CLOSED_TESTING_CERTIFIED

ORDER_TRANSITION_AUTHORITY_FILE=src/lib/order-transitions.ts (100% puro, sin DB/HTTP/Prisma/notificaciones/UI) — ACTIVE_FORWARD_TRANSITIONS (grafo vigente hoy, consumido por 4 endpoints) vs TARGET_FORWARD_TRANSITIONS (grafo P2-T29 con aceptado/esperando_repartidor, CERO uso productivo — sólo 30 tests puros)
DUPLICACION_RESUELTA=4 copias eliminadas (negocio/pedidos/[id]/estado, negocio/pedidos PUT [4ta copia no documentada por la auditoría original, F-P2-T29A-01], operaciones/pyr/estado, operaciones/salon/estado)
NEGOCIO_NON_CANCEL_DB_CAS=SI (ambos endpoints) / DATABASE_CAS_FINAL_AUTHORITY=SI / PROCESS_LOCAL_LOCK_SUPPLEMENTARY=SI
CAS_SINGLE_WINNER_PROVEN=SI — 3 niveles: primitiva aislada sin lock (simula multi-instancia Railway), cross-actor (Negocio vs Operaciones/PyR), endpoint completo (1 solo PedidoEvento del ganador)
CANONICAL_ACCEPTED_STATE=aceptado / CANONICAL_WAITING_DRIVER_STATE=esperando_repartidor / CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO=true / MESA_PASA_POR_ACEPTADO=false — todos representados y testeados puros, CERO activados en ninguna API (USER_VISIBLE_STATE_FLOW_CHANGED=NO)
PRISMA_SCHEMA_CHANGED=NO / MIGRATION_CREATED=NO

TEST_MATRIX=30 authority + 11 negocio (lock+CAS+mesa) + 6 pyr + 6 salon + 14 cancelación (2 fail intermitente, preexistente, sin relación con el fileset — F-P2-TESTINFRA-01) + 14 order-security = NEW_FAIL=0
BUILD=PASS / ESLINT=PASS / TYPECHECK=24 raw idéntico al baseline, 0 nuevos / DIFF_CHECK=PASS / SECRET_SCAN=limpio

T29A_COMMIT=4b199540c78ebe0a010c699f6fc2e63b43d162a0 (parent 6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912, testing-codex)
PUSH_TO_TESTING=SI / MAIN_PUSH=NO
TESTING_DEPLOYMENT=e84a22e3-27f5-4863-944e-c559e03976e3 (DeliGO Copy) SUCCESS, commit match exacto, boot limpio / chat en vivo también SUCCESS mismo commit
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=969ea77ab1630b443fbc0e609397d9c45c5d7443 (mismo deployment b516194e, sin cambios)

FINDINGS_NUEVOS=F-P2-T29A-01 (4ta copia duplicada, RESUELTO en la misma tarea) / F-P2-T29A-02 (negocio/pedidos/route.ts PUT nunca genera PedidoEvento, OPEN_NON_BLOCKING, preexistente, fuera de alcance de T29A)

P2_T29A_STATUS=CLOSED_TESTING_CERTIFIED (era PAUSED_PENDING_PRE_T29_PROMOTION) / P2_T27_STATUS=MERGED_CLOSED_BY_T29A / P2_T29B_STATUS=READY_TO_START / P2_T29C_STATUS=QUEUED_AFTER_T29B
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado, diseño original)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, sigue bloqueando lanzamiento público)
NEXT_RECOMMENDED_ACTION=P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW — activar recibido→aceptado→preparando→esperando_repartidor en la API/UI de Negocio ("Aceptar pedido", "Preparar", "Buscar repartidor", "Buscando repartidor..."), no implementado en esta tarea
```

Primera fase real de implementación de P2-T29 (T29A), preparando la
base backend sin activar todavía ningún flujo visible. Se descubrió y
cerró, dentro de la misma tarea, una cuarta copia de las reglas de
transición no documentada por la auditoría original — un endpoint real
y en uso de Negocio (gestión de mesas propia, `salon-tab.tsx`) tenía
exactamente el mismo gap de CAS que su endpoint hermano. La evidencia de
concurrencia se construyó deliberadamente en 3 capas para evitar el
error metodológico de probar sólo a través de un endpoint con lock
síncrono (que en un único proceso de test siempre serializa antes de
llegar a la DB, nunca ejerciendo la garantía de CAS en aislamiento) —
ver la nueva entrada en `DECISIONS_AND_INVARIANTS.md` sobre este método.
`testing-codex` avanzó a `4b19954`; `main`/Production permanecen
exactamente en el checkpoint `969ea77` de la tarea anterior, sin tocar.
Reporte completo:
`codex-reports/P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS.md`.

## 0.44 ESTADO ANTERIOR — CHECKPOINT PRE-T29 COMPLETO: `main`/Production promovidos a `969ea77` (source `testing-codex@6c6fc58`), 2 migrations aplicadas, tag `pre-t29-stable-2026-09-08` creado y pusheado, `testing-codex` intacto, `P2_T29A_STATUS=READY_TO_START` — DeliGO SIGUE SIN PUBLICARSE (2026-09-09)

```text
HEAD=origin/testing-codex=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912 (SIN CAMBIOS desde el fix de F-PRE-T29-02)
origin/main=969ea77ab1630b443fbc0e609397d9c45c5d7443 (AVANZÓ desde 1de0d3c1 — checkpoint pre-T29 promovido)
Railway Production/DeliGO=969ea77... SUCCESS (deployment b516194e-83ec-4325-b0c7-8a2fac3b3b53, match exacto) / Railway Production/chat en vivo=969ea77... SUCCESS
PRE_T29_TAG=pre-t29-stable-2026-09-08 -> 969ea77 (creado y pusheado sólo tras SUCCESS+smoke)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios — este checkpoint NO es lanzamiento público)

F_PRE_T29_02_STATUS=CLOSED_TESTING_CERTIFIED (evidencia física del operador en iPhone real: instalación nueva sin panel por defecto, acceso manual /cliente?iosDebug=1 intacto) — el fix ya está en Production, confirmado en vivo (manifest-cliente.json start_url=/cliente, sin iosDebug)
F_PRE_T29_03_STATUS=OPEN_NON_BLOCKING (NUEVO — fila huérfana en super_admins de la DB compartida de TESTING bloquea el cleanup de superadmin-auth.test.ts vía FK RESTRICT; probado preexistente e independiente del código; requiere autorización separada para limpiar la fila, nunca hecho unilateralmente)

RELEASE_METHOD=snapshot commit vía git commit-tree (tree=testing-codex@6c6fc58, parent=origin/main tip), sin usar git reset/stash/clean/rebase en ningún momento — el worktree aislado se recreó desde cero para materializar el commit en vez de resetearlo (la tarea prohibía reset categóricamente, sin excepción para worktrees)
BYTE_TREE_EQUIVALENT_TO_TESTING_HEAD=SI / T29_PRODUCT_IMPLEMENTATION_PRESENT=NO

TEST_BATTERY=695 tests reales pasando, 6 fallos confirmados preexistentes (2 ios-standalone-post-keyboard-nav-occlusion-r6 + 4 tracking P2-T02) + 2 exclusiones de infraestructura externa (superadmin-auth.test.ts por F-PRE-T29-03; client-block-security.integration.test.ts por F-P2-TESTINFRA-01 ya documentado) — TODOS reproducidos idénticos contra testing-codex@6c6fc58 sin modificar. PROMOTION_NEW_FAIL=0.
BUILD=PASS / ESLINT=8 errores/3 warnings idénticos al HEAD sin modificar (pre-existentes) / TYPECHECK=25 raw (24 histórico +1, root-causado a un artefacto de node_modules del repo principal ajeno al código promovido) / DIFF_CHECK=PASS / SECRET_SCAN=limpio

MIGRATIONS_APPLIED_PRODUCTION=2 (legal_acceptance_versioning, email_verification_expiry) sin error
PRODUCTION_MANIFEST_CLIENTE_START_URL=/cliente (verificado en vivo contra deligo.ar) / PRODUCTION_MANIFEST_CLIENTE_IOSDEBUG_PRESENT=NO

PRODUCT_CODE_CHANGED=NO (en esta tarea — el código ya estaba en testing-codex) / COMMIT_PERFORMED=SI (1 release commit) / TAG_CREATED=SI / PUSH_PERFORMED=SI (main)
PRODUCTION_CODE_CHANGED=SI (avanzó a 969ea77) / PRODUCTION_TOUCHED=SI (deploy completo autorizado explícitamente)

P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=READY_TO_START (AVANZÓ desde PAUSED_PENDING_PRE_T29_PROMOTION)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado — sigue bloqueando un futuro lanzamiento público, no este checkpoint técnico)
NEXT_RECOMMENDED_ACTION=P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS
```

Checkpoint completo de promoción PRE-T29: `main`/Production quedan
como la última versión estable pre-T29; `testing-codex` es la rama
donde continuará T29A/T29B/T29C/etc. El único blocker que había
detenido el intento R1 (`F-PRE-T29-02`) se cerró con evidencia física
humana antes de reintentar. El método de release curado (snapshot
commit, nunca merge/fast-forward genérico de toda la historia) se
reutilizó exitosamente por segunda vez, esta vez sin usar `git reset`
en ningún momento. Un hang de 15+ minutos durante la reejecución de
tests (causado por una ruta de archivo de test inexistente en un
comando, no por el código) fue diagnosticado exhaustivamente a pedido
explícito del operador antes de continuar — se confirmó que no había
procesos huérfanos ni daño al repositorio/worktree. Con esa
autorización, la batería completa se reejecutó en grupos pequeños con
timeouts finitos, alcanzando **0 fallas nuevas** verificadas por
reproducción idéntica contra el HEAD sin modificar. Reporte completo:
`codex-reports/PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION_R2.md`.

## 0.43 ESTADO ANTERIOR — F-PRE-T29-02 CORREGIDO Y DESPLEGADO A TESTING: `public/manifest-cliente.json` start_url vuelve a `/cliente`, acceso manual `/cliente?iosDebug=1` preservado, `testing-codex` HEAD avanzó a `6c6fc58` (push+deploy TESTING SUCCESS), `origin/main`/Production SIN CAMBIOS — falta confirmación física en iPhone antes de reintentar la promoción (2026-09-08)

```text
HEAD=origin/testing-codex=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912 (AVANZÓ desde 818b627 — 1 commit nuevo)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (SIN CAMBIOS)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=IMPLEMENTED_COMMITTED_PUSHED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION

FINDING_FIXED=F-PRE-T29-02 (public/manifest-cliente.json start_url: "/cliente?iosDebug=1" -> "/cliente" — único campo tocado, root cause confirmado por lectura directa: manifest estático sin condicional de entorno, panel activado sólo por query param sin escritor runtime)
MANUAL_DEBUG_ACCESS_PRESERVED=SI (/cliente?iosDebug=1 sigue activando isIosDebugFlagEnabled sin cambios — verificado por código, test nuevo de comportamiento real, y smoke HTTP 200 contra TESTING desplegado)
OTHER_7_MANIFESTS_AUDITED=SI, sin hallazgos / SERVICE_WORKER_CHANGED=NO (auditado, nunca cachea URLs con "manifest") / BRANDING_CHANGED=NO

FIX_COMMIT=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912 (parent 818b627b472e03e80034c047a51dfd3491f3add3, testing-codex) / FILESET=public/manifest-cliente.json + 2 tests (ios-pwa-debug-launch-static-contract.test.ts, pwa-identity.test.ts)
QUALITY_GATE=11/11 tests de contrato de manifest PASS; 87/89 batería ampliada iOS/PWA (2 fallas 100% preexistentes, confirmadas idénticas antes/después vía git stash del HEAD sin cambios); typecheck 24 raw idéntico (0 nuevos); lint/diff-check/build limpios
PUSH_TO_TESTING=SI (818b627..6c6fc58) / MAIN_PUSH=NO
TESTING_DEPLOYMENT=d636ab54-7104-4e55-b9a6-6928ffc0817a (DeliGO Copy) SUCCESS, commit 6c6fc58 (match exacto), boot limpio, sin migraciones pendientes
SERVED_MANIFEST_VERIFIED=SI (GET .../manifest-cliente.json → 200, start_url=/cliente, sin iosDebug; GET /cliente=200; GET /cliente?iosDebug=1=200)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e (mismo deployment bf242d3b, sin cambios) / preDeployCommand y GOOGLE_OAUTH_PENDING_SECRET de Production sin releer/mutar

F_PRE_T29_02_STATUS=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION (bloquea la promoción y cualquier lanzamiento público hasta el PASS físico)
PRE_T29_PROMOTION_RETRY_READY=NO (pendiente confirmación física del operador en iPhone real)

P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=PAUSED_PENDING_PRE_T29_PROMOTION (sin cambio)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado)
NEXT_RECOMMENDED_ACTION=PHYSICAL_IOS_CLIENT_INSTALL_NO_DEFAULT_DEBUG_CONFIRMATION — operador instala la PWA Cliente en TESTING desde cero en un iPhone real, confirma que el panel NO aparece por defecto y que SÍ aparece navegando a /cliente?iosDebug=1; luego reintentar PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION usando 6c6fc58 como nuevo RC source
```

Corrección focal del único blocker que había detenido la promoción
curada anterior. El manifest de Cliente es un archivo estático sin
ningún mecanismo de detección de entorno — el panel de diagnóstico se
activa exclusivamente por el query param de la URL, sin ningún escritor
runtime, así que revertir el `start_url` fue suficiente y seguro. El
mecanismo manual de diagnóstico (necesario para trabajo futuro de
diagnóstico iOS real-device) quedó expresamente preservado y verificado
en tres niveles (código, test de comportamiento, smoke HTTP real).
Gate de calidad completo sin regresiones, commit único, push exclusivo a
`testing-codex`, deploy a Railway TESTING verificado `SUCCESS` con el
manifest servido confirmado en vivo. Production no fue tocada. Reporte
completo: `codex-reports/PRE_T29_FIX_MANIFEST_CLIENTE_IOSDEBUG_FLAG_TESTING.md`.

## 0.42 ESTADO ANTERIOR — PROMOCIÓN DETENIDA ANTES DEL PUSH por decisión explícita del operador: bug real encontrado (`?iosDebug=1` hardcodeado en `public/manifest-cliente.json`) — `testing-codex`/`main` SIN CAMBIOS, `preDeployCommand` de Production quedó agregado (fix independiente retenido) (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (SIN CAMBIOS)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (SIN CAMBIOS — nada se promovió)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios)

TASK_STATUS=STOPPED_BEFORE_PUSH_BY_OPERATOR_DECISION (ni CLOSED ni ROLLED_BACK_FAILED)

GAP_1_RESOLVED=preDeployCommand agregado a Production/"DeliGO" (railway api serviceInstanceUpdate, valor idéntico a TESTING: ["npx prisma migrate deploy --schema prisma/schema.prisma"]) — sin disparar deploy no deseado, APLICADO Y RETENIDO independientemente del código
GAP_2_OPEN=F-PRE-T29-02: public/manifest-cliente.json start_url="/cliente?iosDebug=1" hardcodeado, sin condicional de entorno — activaría el panel de diagnóstico iOS por defecto en instalaciones NUEVAS del Cliente PWA en Production (seguro, sin PII/secretos, pero no intencional). BLOQUEA esta promoción y cualquier lanzamiento público futuro hasta corregirse.

RELEASE_METHOD_VALIDATED=SI — commit snapshot (git commit-tree, tree=testing-codex@818b627, parent=origin/main tip, trailers Source-Head/Source-Merge-Base) construido y verificado byte-a-byte equivalente en un worktree aislado; T29_PRODUCT_IMPLEMENTATION_PRESENT=NO; SECRET_LEAK=NO. Commit local 245abcfa8 DESCARTADO sin pushear al detener la tarea — branch/worktree temporales eliminados, git worktree list y git branch --list confirmados limpios.

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_CHANGED=NO / COMMIT_PUSHED=NO / TAG_CREATED=NO
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_TOUCHED=SI (sólo preDeployCommand, config, sin deploy nuevo) / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e

P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=PAUSED_PENDING_PRE_T29_PROMOTION (SIN CAMBIO — la promoción no se completó, NO pasa a READY_TO_START)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado)
NEXT_RECOMMENDED_ACTION=corregir public/manifest-cliente.json en testing-codex (quitar ?iosDebug=1 del start_url o condicionarlo a detección real de entorno), re-certificar y desplegar a TESTING normalmente, luego reintentar PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION — el método de release ya está validado y es reutilizable
```

Tarea de promoción real, autorizada explícitamente en todos sus
aspectos (push a `main`, deploy a Production, tag), llegó lejos en su
ejecución siguiendo el método de release curado ya documentado
(`OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md`) antes de detenerse.
Durante la revisión focal de diagnósticos iOS que la propia tarea exige
antes de pushear, se encontraron 2 gaps no cubiertos por la
autorización original — el primero (migraciones sin mecanismo de
ejecución en Production) se resolvió con autorización explícita del
operador; el segundo (bug de manifest) llevó al operador a elegir la
opción MÁS conservadora posible: detener la promoción completa en vez
de un fix en vivo o promover tal cual. Git quedó exactamente en su
estado de partida — cero push, cero tag, cero deploy de código.
Reporte completo:
`codex-reports/PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION.md`.

## 0.41 ESTADO ANTERIOR — ÚNICO BLOCKER DE PROMOCIÓN RESUELTO: `GOOGLE_OAUTH_PENDING_SECRET` agregada a Railway Production, redeploy del mismo commit SUCCESS, `PRE_T29_PROMOTION_CAN_NOW_PROCEED=SI` (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios — sin código nuevo)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios de código; mismo commit, ahora servido por un deployment nuevo tras el cambio de variable de entorno)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT / PUBLIC_RELEASE_AUTHORIZED=NO (sin cambios — esta tarea no constituye lanzamiento público)

RAILWAY_TARGET_ENVIRONMENT=production / RAILWAY_TARGET_SERVICE=DeliGO (confirmado explícitamente ANTES de mutar — el contexto CLI enlazado por defecto en este entorno de trabajo apuntaba a TESTING/"DeliGO Copy", no a Production; cada comando usó --service/--environment explícitos, nunca el contexto por defecto)

GOOGLE_OAUTH_PENDING_SECRET_GENERATED=SI (CSPRNG local, openssl rand -hex 32, 64 caracteres hexadecimales — secret NUEVO y DEDICADO, nunca copiado de TESTING ni de ningún otro secret existente)
GOOGLE_OAUTH_PENDING_SECRET_VALUE_EXPOSED=NO (aplicado vía --stdin, sin argv, sin --json/--kv en la escritura, variable de shell destruida inmediatamente después — el valor nunca apareció en ningún output/reporte)
PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRESENT=SI / PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_MIN_LENGTH_VALID=SI (64 caracteres, validado aritméticamente con awk sin leer el valor)
TESTING_ENV_MUTATED=NO / NON_TARGET_ENV_VARS_MUTATED=NO (diff de nombres de variables de Production: 51->52, +1 exacto, 0 removidas/modificadas)

ENV_CHANGE_TRIGGERED_PRODUCTION_REDEPLOY=SI / PRODUCTION_ENV_REDEPLOYMENT_ID=bf242d3b-35e1-4d55-8bfb-71d121e2fc6d / PRODUCTION_ENV_REDEPLOY_STATUS=SUCCESS / PRODUCTION_ENV_REDEPLOY_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (idéntico — sin cambio de código, sólo rebuild para inyectar la variable)
PRODUCTION_POST_ENV_SMOKE_PASS=SI (GET /, /cliente, /negocio, /repartidor sobre deligo.ar — sin 500, boot sano, logs limpios "Ready in 122ms")

PREVIOUS_PROMOTION_BLOCKER=MISSING_PRODUCTION_ENV_VAR_GOOGLE_OAUTH_PENDING_SECRET / PREVIOUS_PROMOTION_BLOCKER_RESOLVED=SI
PROMOTION_ENV_PRECONDITION_READY=SI / PRE_T29_PROMOTION_CAN_NOW_PROCEED=SI (de las 17 condiciones de PROMOTION_READY de la auditoría anterior, todas quedan satisfechas ahora — la promoción de código real sigue sin ejecutarse, requiere su propia tarea con autorización explícita)

REALTIME_KEY_ID_PREEXISTING_GAP_PRESERVED=SI (sin tocar — ausente en Production pero ya referenciado por main hoy, sin relación con esta tarea)

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_CHANGED=NO / COMMIT_PERFORMED=NO / TAG_CREATED=NO / PUSH_PERFORMED=NO
PRODUCTION_CODE_CHANGED=NO / PRODUCTION_TOUCHED=SI (única mutación: 1 variable de entorno + redeploy consecuente del mismo commit, explícitamente autorizado) / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e

P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=NOT_STARTED (PAUSED_PENDING_PRE_T29_PROMOTION)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado — bloquea lanzamiento público, no esta precondición técnica)
NEXT_RECOMMENDED_ACTION=PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION (NO ejecutado en esta tarea)
```

Tarea operacional dirigida, resolviendo el ÚNICO blocker que
`PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md` había encontrado.
Antes de mutar cualquier cosa, se confirmó explícitamente el target
real: el contexto de Railway CLI enlazado por defecto en este entorno
de trabajo apuntaba a TESTING/"DeliGO Copy" — **no** a Production. Cada
comando de esta tarea pasó `--service DeliGO --environment production`
de forma explícita, nunca confiando en ese contexto por defecto, lo
que evitó el riesgo real de mutar el servicio equivocado.

Se generó un secret criptográficamente seguro, nuevo y dedicado (64
caracteres hexadecimales vía `openssl rand -hex 32` — muy por encima
del mínimo de 32 caracteres que el código exige, y nunca una copia de
ningún secret existente) y se envió a Railway en un único pipeline de
shell vía `--stdin`, evitando que el valor pasara por `argv` o
apareciera en cualquier output de confirmación — la variable de shell
que lo contuvo se destruyó inmediatamente después. Se evitó
deliberadamente `--json`/`--kv` en el comando de escritura porque la
propia documentación del CLI de Railway advierte que esos formatos
incluyen valores crudos. El valor nunca apareció en ningún lugar
mostrado, guardado o reportado por esta tarea.

La verificación posterior confirmó presencia y longitud **sin leer el
valor en ningún momento**: presencia por conteo del nombre de la
variable (`grep -c`), longitud calculada aritméticamente con `awk`
sobre la longitud total de la línea menos la del nombre de la clave.
Un diff de los NOMBRES de todas las variables de Production antes y
después (52 vs 51) confirmó exactamente **una** variable agregada y
**cero** removidas o modificadas — ninguna otra variable (`DATABASE_
URL`, secrets de `REALTIME_*`, `VAPID*`, `RESEND*`/`SMTP*`,
`REGISTRATION_LIMIT_SECRET`, credenciales de OAuth de Google,
variables automáticas de Railway) fue tocada. TESTING confirmado sin
cambios (51 variables, intacto).

El cambio de variable disparó, como estaba explícitamente autorizado
para este caso, un redeploy automático de Production del **mismo
commit** (`1de0d3c1` — mismo `Source-Commit` trailer, mismo branch
`main`, sólo un `imageDigest`/`patchId` nuevos por el rebuild).
Polling directo y finito (sin watcher en background) hasta confirmar
`status: SUCCESS` e instancia `RUNNING`; logs de boot limpios
(`Next.js 16.1.3`, `Ready in 122ms`, sin excepciones). Smoke tests no
mutantes contra el dominio real (`deligo.ar`) confirmaron `/`, `/cliente`,
`/negocio` y `/repartidor` respondiendo correctamente, sin crear
usuarios, sin OAuth real, sin pedidos, sin emails, sin Push.

**Blocker resuelto formalmente**: de las 17 condiciones de
`PROMOTION_READY` que la auditoría anterior evaluó, la única pendiente
(variables de entorno de Production listas) ahora se cumple. Esto NO
significa que la promoción de código ya ocurrió — `main` y Production
siguen exactamente en `1de0d3c1`, el mismo código de siempre. La
promoción real (release curado con trailer `Source-Commit:`, siguiendo
la convención ya documentada) sigue requiriendo su propia tarea futura,
con autorización explícita separada de commit/push/deploy.

Git permaneció completamente intacto durante toda la tarea — ningún
merge, commit, tag ni push. Archivo `32` no tocado. El finding de
`REALTIME_KEY_ID` (ausente en Production, pero ya preexistente en
`main` hoy) se preservó sin tocar, fuera de alcance. El finding de
aislamiento de sesión Android Cliente/Repartidor se preserva sin
cambios — sigue bloqueando un futuro lanzamiento público, no esta
precondición técnica. P2-T31 permanece `CLOSED_TESTING_CERTIFIED`,
P2-T29 permanece `AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION`, T29A
sigue `PAUSED_PENDING_PRE_T29_PROMOTION`. Reporte completo:
`codex-reports/PRE_T29_PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRECONDITION.md`.

## 0.40 ESTADO ANTERIOR — PRE-T29 PROMOTION READINESS AUDIT (READ-ONLY): `PROMOTION_READY=NO` — único blocker es 1 variable de entorno faltante en Production; historia Git divergida confirma convención de release curado ya establecida — BLOCKER RESUELTO POR LA TAREA DE ARRIBA (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios — tarea read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
RAILWAY_TESTING_COMMIT=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios) / RAILWAY_PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios, verificado también en el chat-service de Production)
MODE=READ_ONLY_PROMOTION_AUDIT / PRODUCT_DIFF=NONE / TEST_DIFF=NONE

DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / REAL_CUSTOMER_TRAFFIC_EXPECTED=NO / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT / PUBLIC_RELEASE_AUTHORIZED=NO
PRE_T29_STABLE_CHECKPOINT_DESIRED=SI

PROMOTION_READY=NO
PROMOTION_BLOCKER=GOOGLE_OAUTH_PENDING_SECRET ausente en las variables de Railway de Production — requerida sin fallback por src/lib/google-oauth-pending.ts (lanza Error si falta o mide <32 caracteres); confirmado por NOMBRE únicamente, sin leer ningún valor; afecta sólo el callback de Google OAuth para identidades nuevas o cuentas sin LegalAcceptance, no rompe boot/build/ninguna otra ruta
NEXT_RECOMMENDED_ACTION=agregar esa variable a Production (Railway env var, string aleatorio >=32 caracteres, dedicado) como primer paso de la futura tarea de promoción — una vez hecho, las 16 condiciones restantes de PROMOTION_READY ya se cumplen

MERGE_BASE=86609599bcbdf7979244c34298a27836e6452d3c / MAIN_IS_ANCESTOR_OF_TESTING=NO / DIVERGED_HISTORY=SI / COMMITS_MAIN_ONLY=4 / COMMITS_TESTING_ONLY=61
HALLAZGO_DE_ESTRATEGIA=los 4 commits exclusivos de main llevan trailers "Source-Commit:" explícitos apuntando a commits reales de testing-codex, uno de ellos documentando una exclusión deliberada de hunks — confirma, junto con el reporte histórico OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md, que DeliGO usa una convención YA ESTABLECIDA de "release curado" (verificado byte a byte, aplicado sobre el HEAD real de main, NUNCA un merge de toda la historia de testing-codex)
RECOMMENDED_MAIN_PROMOTION_METHOD=release curado con Source-Commit trailer, siguiendo exactamente esa convención — NO merge genérico, NO fast-forward (ninguno de los dos es viable dada la historia divergida)
MERGE_SIMULATION_METHOD=git merge-tree --write-tree (100% read-only, no toca working tree/index/HEAD) -> produce 4 conflictos textuales reales si se intentara un merge genérico (mozos/route.ts, pedidos/route.ts, n/[slug]/page.tsx, un add/add en p2-t07-repartidor-active-gate-static-contract.test.ts) -- verificado por contenido (no sólo conteo de líneas) en 2 de los 4 que testing-codex es una evolución estrictamente posterior del MISMO texto, nunca una divergencia semántica real

NEW_MIGRATIONS_PENDING_FOR_PRODUCTION=2 (20260901112243_add_legal_acceptance_versioning: CREATE TABLE nueva, append-only; 20260901130000_add_email_verification_expiry: ADD COLUMN nullable x3 tablas) / DESTRUCTIVE_MIGRATIONS_PRESENT=NO / PRODUCTION_MIGRATION_RISK=LOW / DB_BACKUP_BEFORE_PROMOTION_REQUIRED=NO
AMBAS_MIGRATIONS_YA_CERTIFICADAS=SI (LEGAL_TERMS_ACCEPTANCE_VERSIONING_R1.md y P2_T07_HARDENING_R1.md, ambas CLOSED sin gaps) — excluidas de la promoción anterior sólo por corte cronológico, recomendado incluirlas ahora
SCHEMA_DIFF_PRESENT=SI (coherente con las 2 migrations, sin drift)

DEPENDENCY_DIFF_PRESENT=NO (package.json/bun.lock/package-lock.json byte-idénticos entre main y testing-codex)
SECRET_LEAK_IN_PROMOTION_DIFF=NO (secret scan del diff completo de 222 archivos: sólo placeholders de test "fixture"/"CorrectHorseBattery42"; sin .env, sin API keys/JWTs/DATABASE_URL/VAPID private key)
TRACKED_CODEX_REPORTS_IN_PROMOTION_DIFF=DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md (único, 539 líneas, sin secretos/PII, promovible sin limpieza previa)

TESTING_DIAGNOSTICS_PRODUCTION_SAFE_AFTER_PROMOTION=SI (revalidado, no sólo citado de R21: RAILWAY_ENVIRONMENT_NAME confirmado "production" en Railway, gate fail-closed intacto, 404 indistinguible fuera de TESTING)
TESTING_ONLY_BEHAVIOR_PRODUCTION_LEAK=NONE / AUTH_PROMOTION_SAFETY=PASS / TEST_FIXTURE_CODE_PROMOTION_SAFE=SI
SERVICE_WORKER_PROMOTION_CACHE_RISK=LOW (CACHE_NAME ya subió de deligo-v14 a deligo-v15) / PWA_MANIFEST_PROMOTION_SAFETY=PASS (8 manifests de rol verificados)
PRODUCTION_REALTIME_DEPENDENCY_READY=SI (salvo REALTIME_KEY_ID, gap PREEXISTENTE ya en main hoy, sin relación con este diff — no es blocker de esta promoción)

RC_BUILD_PASS=SI / TYPECHECK_RAW=24 (0 nuevos) / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
PROMOTION_TEST_PASS=1177 (646 Push+chat+notificationclick+safe-area + 531 auth/PWA/legal/tracking) / PROMOTION_PREEXISTING_FAIL=9 (5 iOS + 4 P2-T02 MODEL-G1/E1, ya documentadas) / PROMOTION_NEW_FAIL=0

T29_PRODUCT_IMPLEMENTATION_PRESENT_IN_RC=NO (confirmado) / PRE_T29_RC_IS_EXACT_T31_CERTIFIED_HEAD=SI

PRE_T29_TAG_RECOMMENDED=SI / RECOMMENDED_TAG_NAME=pre-t29-stable-2026-09-08 (sin convención previa de tags en el repo — git tag --list vacío)
PRODUCTION_DEPLOY_TRIGGER=AUTODEPLOY_GIT / PRODUCTION_MIGRATION_EXECUTION_MECHANISM=preDeployCommand de Railway ("npx prisma migrate deploy") antes del boot de la nueva versión
PRODUCTION_ROLLBACK_CODE_PLAN=redeploy del commit conocido-bueno (1de0d3c1) vía autodeploy Git / PRODUCTION_ROLLBACK_DB_PLAN=ninguna acción necesaria para estas 2 migrations (puramente aditivas)

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_CHANGED=NO / COMMIT_PERFORMED=NO / TAG_CREATED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado) / P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado) / P2_T29A_STATUS=NOT_STARTED (PAUSED_PENDING_PRE_T29_PROMOTION)
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado — bloquea lanzamiento público, NO esta promoción técnica) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (preservado) / PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (preservado) / P2_IOS_STATIC_CONTRACT_HYGIENE_REQUIRED_BEFORE_P2_CLOSEOUT=SI (preservado)
```

Auditoría exhaustiva, estrictamente READ-ONLY, de si el HEAD certificado
de `testing-codex` (`818b627`, el mismo que cerró P2-T31) puede
promoverse TÉCNICAMENTE a `main`/Production antes de iniciar P2-T29A.
Aclaración de contexto explícita: DeliGO **no está publicado** — sin
tráfico de clientes reales, Production funciona hoy como entorno
pre-lanzamiento controlado. Esta auditoría distingue con cuidado
"puede desplegarse técnicamente" de "listo para abrir al público" — el
finding de aislamiento de sesión Android Cliente/Repartidor sigue
bloqueando lo segundo, nunca lo primero, y no se tocó ni se corrigió
aquí.

**Hallazgo central de estrategia de promoción**: `git merge-base`
reveló que la historia de `main` y `testing-codex` está DIVERGIDA (ni
fast-forward ni ancestro directo) — 4 commits exclusivos de `main`, 61
exclusivos de `testing-codex`. Investigando esos 4 commits se encontró
que cada uno lleva un trailer `Source-Commit:` explícito apuntando a un
commit real de `testing-codex`, y que uno de ellos documenta una
exclusión DELIBERADA de hunks ("out of scope for this curated
release"). Esto, junto con el reporte histórico ya existente
`OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md` (que describe
exactamente esa misma metodología: "una rama de release curada — no un
merge de testing-codex — ... aplicada sobre la base exacta de
Production... en un único fast-forward"), confirma que DeliGO ya tiene
una convención de promoción establecida: **release curado, verificado
byte a byte, con trailer de origen — nunca un merge genérico de toda
la historia**. Para validar esta conclusión sin comprometerse con
ninguna acción, se simuló un merge genérico de forma 100% read-only
(`git merge-tree --write-tree`, que sólo escribe objetos blob/tree
inofensivos sin tocar working tree/index/HEAD/ninguna referencia): el
resultado son **4 conflictos textuales reales** — confirmando que la
convención curada sigue siendo la estrategia correcta, no una
alternativa de conveniencia genérica. Verificación de contenido (no
sólo conteo de líneas) en 2 de los 4 archivos en conflicto mostró que
`testing-codex` contiene una evolución estrictamente posterior del
MISMO texto/lógica que `main` — nunca una divergencia semántica real;
recomendado que la tarea de promoción revise los 4 archivos completos
antes de decidir.

**Único blocker real encontrado, mecánico y acotado**:
`GOOGLE_OAUTH_PENDING_SECRET` — requerida sin fallback por
`src/lib/google-oauth-pending.ts` (lanza si falta o mide menos de 32
caracteres) — está AUSENTE en las variables de Railway de Production,
confirmado consultando únicamente los NOMBRES de las variables (nunca
sus valores) vía `railway variables`. El impacto es acotado: sólo
rompería el callback de Google OAuth para una identidad de Google
completamente nueva o una cuenta existente sin evidencia de
`LegalAcceptance` — no afecta boot, build, ni ninguna otra ruta de la
aplicación (Cliente/Negocio/Repartidor con sesión ya iniciada, Push,
Chat, pedidos, etc. seguirían funcionando exactamente igual). Se
descartó explícitamente `REALTIME_KEY_ID` (también ausente) como
blocker de ESTA promoción porque ya está referenciado en el propio
`main` actual — es un gap preexistente, sin relación con este diff.

**Migrations**: 2 nuevas, ambas puramente aditivas (`CREATE TABLE`
nueva sin consumidores previos; `ADD COLUMN` nullable en 3 tablas, sin
backfill, sin pérdida de datos posible) y ambas YA certificadas y
cerradas en TESTING (`LEGAL_TERMS_ACCEPTANCE_VERSIONING_R1.md`,
`P2_T07_HARDENING_R1.md`, sin gaps abiertos) — quedaron fuera de la
promoción anterior únicamente por venir después de su corte
cronológico, no por estar incompletas; se recomienda incluirlas ahora.

Dependencias 100% idénticas entre ambas ramas (`package.json`, `bun.
lock`, `package-lock.json` byte-idénticos). Secret scan del diff
completo (222 archivos, 23237 inserciones): limpio, sin ningún patrón
real de secreto — sólo placeholders de test ya conocidos ("fixture",
el clásico "CorrectHorseBattery42" de XKCD). Único reporte de
`codex-reports/` realmente tracked en git en todo el árbol
(`DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`) auditado y confirmado
seguro para promover sin limpieza previa.

Diagnósticos de TESTING (panel de Push, ver P2-T31-R21) revalidados
—no sólo citados de memoria— como seguros tras la promoción: el gate
`RAILWAY_ENVIRONMENT_NAME` sigue siendo server-side, fail-closed, y
Production reporta correctamente `"production"`. Ningún testing-only
guard adicional encontrado en todo el diff. Fixtures de test
confirmadas como código de test puro, sin ejecución en runtime de
producto. Cambios de auth en el diff (mesa, mozo legacy, terminal/
SuperAdmin) son endurecimientos, sin bypass ni credencial de prueba.

Gate de calidad completo corrido sobre el RC candidato (el HEAD real
`818b627`, sin ningún cambio introducido por esta auditoría): build
limpio, TypeScript 24 raw idéntico al baseline conocido (0 nuevos),
1177 tests pasando (646 de la batería Push/chat/safe-area + 531 de
auth/PWA/legal/tracking), exactamente 9 fallas — todas ya documentadas
como preexistentes (5 en el contrato estático iOS de teclado, 4 en el
contrato estático de tracking GPS de repartidor por la deuda MODEL-G1
vs MODEL-E1 de P2-T02, epic distinto) — **0 fallas nuevas**.

Diseño completo entregado, explícitamente NO ejecutado: estrategia de
release curado paso a paso, nombre de tag de checkpoint recomendado
(`pre-t29-stable-2026-09-08`, sin convención previa de tags en el repo),
mecanismo de deploy confirmado (autodeploy Git a ambos servicios de
Production — la app principal y el chat-service — más
`preDeployCommand` de Prisma para las migrations), checklist de smoke
tests no mutante, y plan de rollback (código: redeploy del commit
conocido-bueno vía el mismo autodeploy; DB: ninguna acción necesaria,
dado que ambas migrations son puramente aditivas).

Cero cambios de producto, tests, DB o variables de Railway en esta
tarea. Git estrictamente read-only — el único comando que escribió
algo fue `git merge-tree --write-tree`, que sólo agrega objetos
blob/tree inofensivos al object database sin tocar working tree,
index, HEAD ni ninguna referencia real; `git status`/`diff` idénticos
antes y después. Único archivo nuevo es el reporte de esta tarea
(local, untracked). Archivo `32` no tocado.

**`PROMOTION_READY=NO`** — de las 17 condiciones de cierre, 16 ya se
cumplen; la única pendiente (variables de entorno de Production listas)
requiere agregar una única variable, un paso mecánico y de bajo riesgo,
no una nueva auditoría ni un rediseño. P2-T31 permanece
`CLOSED_TESTING_CERTIFIED`, P2-T29 permanece `AUDITED_DESIGNED_
READY_FOR_IMPLEMENTATION`, T29A sigue `NOT_STARTED` — la promoción
(cuando se autorice) debe ocurrir ANTES de T29A, según el objetivo
explícito del operador de un checkpoint estable pre-rediseño de
estados. Reporte completo:
`codex-reports/PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md`.

## 0.39 ESTADO ANTERIOR — P2-T29 AUDITADO Y DISEÑADO (READ-ONLY, NO IMPLEMENTADO): `ACEPTADO`+`ESPERANDO_REPARTIDOR` diseñados; T27 fusionado a T29A; cero migration necesaria; gap crítico de test identificado en aceptación atómica del repartidor (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios — tarea read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (preservado, no reabierto)
MODE=READ_ONLY_AUDIT_PLUS_DESIGN / PRODUCT_DIFF=NONE / TEST_DIFF=NONE

CANONICAL_ACCEPTED_STATE=aceptado / CANONICAL_WAITING_DRIVER_STATE=esperando_repartidor (elegido sobre "buscando_repartidor" — el mecanismo real es polling pasivo de 8s, sin dispatch activo, confirmado leyendo repartidor-panel.tsx)
RECOMMENDED_ORDER_STATE_GRAPH=DOMICILIO: recibido->aceptado->preparando->esperando_repartidor->en_camino->entregado / RETIRO: recibido->aceptado->preparando->listo_para_retirar->entregado / MESA: recibido->preparando->listo_para_retirar->entregado (SIN aceptado, justificado por ausencia de ventana de decisión remota)
ORDER_STATUS_DB_TYPE=String Prisma, SIN enum Postgres, SIN CHECK constraint (verificado en schema.prisma y en todos los migration.sql) / MIGRATION_REQUIRED=NO / NEW_ACCEPTED_STATE_REQUIRES_MIGRATION=NO / NEW_WAITING_DRIVER_STATE_REQUIRES_MIGRATION=NO
DELIVERY_ASSIGNMENT_SOURCE_OF_TRUTH=Pedido.repartidorId (campo directo, sin tabla de asignación separada)
CURRENT_DRIVER_ACCEPTANCE_ATOMIC=SI (repartidor/pedidos/[id]/aceptar usa updateMany CAS real — condición de estado esperado en el propio WHERE, no findUnique+update) / CURRENT_DRIVER_ACCEPTANCE_RACE_RISK=BAJO
HALLAZGO_CENTRAL=en_camino está SOBRECARGADO hoy — significa tanto "negocio empezó a buscar repartidor" (momento del click, sin asignación aún) como "repartidor ya asignado en camino" — probado leyendo negocio/pedidos/[id]/estado/route.ts + repartidor/pedidos/[id]/aceptar/route.ts; evidencia de UI ambigua confirmada en orders-tab.tsx:1017-1020 ("Esperando confirmación del cliente" mostrado en ambas fases sin distinguirlas)

P2_T27_DISPOSITION_FOR_T29=MERGE_INTO_T29 (P2-T27 nunca se implementó — QUEUED desde su creación, sin código ni reporte; el patrón CAS que generalizaría ya está probado en 6+ endpoints reales del repo)
P2_T28_DISPOSITION_FOR_T29=reutilizar CAS-vía-updateMany + lock process-local (src/lib/concurrency.ts) + PedidoEvento como historial; cerrar el gap residual (sólo cancelado usa CAS hoy en negocio/estado) dentro de la misma fase T29A que reescribe ese archivo
ORDER_TRANSITION_SINGLE_AUTHORITY=NO (3 copias independientes: VALID_TRANSITIONS en negocio/estado, TRANSICIONES en operaciones/pyr/estado, N endpoints fijos hardcoded en operativo/{pyr,salon,mozo}) — recomendado extraer autoridad compartida mínima en T29A, sin mega-refactor

TEST_GAPS_FOR_T29=CRÍTICO: repartidor/pedidos/[id]/aceptar (endpoint de mayor riesgo de concurrencia del sistema) tiene CERO tests dedicados hoy pese a ser, por lectura de código, un CAS correcto — toda la confianza actual es por inspección manual, no ejecutable
CURRENT_TEST_COVERAGE_MATRIX=casi nula para transiciones de estado en general (sólo order-estado-lock-ownership.test.ts existe, verifica ownership del lock, no transiciones/CAS)

LEGACY_ORDER_COMPATIBILITY_PLAN=sin backfill, sin transformación retroactiva de filas existentes — pedidos creados antes del deploy completan su ciclo LEGACY tal cual (preparando->en_camino overloaded->entregado); sólo pedidos nuevos post-deploy usan el grafo con aceptado/esperando_repartidor
NOTIFICATION_MATRIX_DESIGNED=SI (10 transiciones, reutilizando orderUpdateNotification.statusMessages como punto de extensión, sin rediseñar la factory)
CANCELLATION_MATRIX_DESIGNED=SI (por estado x actor) / TIMEOUT_POLICY_AUDITED=SI (auto-cancel de 30 min YA EXISTE, disparo manual del repartidor, ya seguro vía CAS — sólo necesita el nuevo nombre de estado en su filtro)

IMPLEMENTATION_PHASES=T29A(autoridad de transición compartida+CAS extendido+tests de concurrencia) -> T29B(Negocio UI/API: aceptar+preparar) -> T29C(Repartidor: rename+aceptación atómica+test físico) -> T29D(Cliente: notificaciones+labels+timeline) -> T29E(compatibilidad legacy+regresión+certificación física TESTING)

PREGUNTAS_DE_PRODUCTO_ABIERTAS_NO_ASUMIDAS=(1) ¿puede el Cliente cancelar mientras el pedido está `aceptado`? recomendación: SÍ, mismo criterio que hoy (recibido); (2) ¿mesa también debe recibir `aceptado`? recomendación: NO, sin ventana de decisión remota que lo justifique — ninguna implementación empieza sin que el operador resuelva ambas

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_CHANGED=NO / MIGRATION_CREATED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
P2_T02_STATUS=WAITING_FOR_OPERATOR (preservado) / PAYMENTS_WORK_STATUS=DEFERRED (preservado)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (preservado, separado) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (preservado) / PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (preservado) / P2_IOS_STATIC_CONTRACT_HYGIENE_REQUIRED_BEFORE_P2_CLOSEOUT=SI (preservado)
NEXT_RECOMMENDED_ACTION=P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS (NO iniciado en esta tarea)
```

Auditoría profunda del lifecycle completo de pedidos, 100% desde código
real (schema Prisma, 3 copias independientes de reglas de transición,
el endpoint crítico de aceptación atómica de repartidor, factory de
notificaciones, UI de los 3 roles, cobertura de tests existente) — cero
suposiciones sin verificar, cero implementación.

Reconstruyó el grafo de estados ACTUAL leyendo cada endpoint que muta
`Pedido.estado` y probó, con evidencia directa, que `en_camino` está
sobrecargado hoy: el mismo string significa "Negocio acaba de pulsar
un botón, sin repartidor todavía" Y "un repartidor ya aceptó y está en
camino" — con una consecuencia de UI observable (`orders-tab.tsx`
muestra el mismo texto ambiguo en ambas fases). Diseñó el grafo
OBJETIVO por modalidad: domicilio y retiro reciben el nuevo estado
`aceptado`; mesa explícitamente NO (justificado, no asumido — un pedido
de mesa no tiene la ventana de decisión remota que `aceptado` resuelve
para delivery/pickup). El estado de espera de repartidor se recomienda
como `esperando_repartidor` (no "buscando_repartidor") porque el
mecanismo real, auditado, es un polling pasivo de 8 segundos sin ningún
dispatch/ranking activo del lado del servidor.

`estado` es un `String` Prisma plano, sin enum Postgres ni CHECK
constraint — agregar los 2 valores nuevos no requiere NINGUNA
migration, es 100% aditivo a nivel de esquema; todo el riesgo real vive
en el código (transiciones, filtros, UI), nunca en la base de datos.

La aceptación atómica del repartidor (`POST /api/repartidor/pedidos/
[id]/aceptar`) YA es segura hoy — usa un CAS real de Postgres (`update
Many` con la condición de estado/asignación esperada dentro del propio
`WHERE`, no un `findUnique`+`update` vulnerable a una carrera de
lectura-luego-escritura) — confirmado con una reconstrucción explícita
del timeline de dos repartidores compitiendo contra el código real. Sin
embargo, este endpoint —el de mayor riesgo de concurrencia de todo el
sistema— **no tiene ningún test que reproduzca esa concurrencia
ejecutablemente**; toda la confianza actual es por inspección manual.
Este es el gap más crítico identificado, y debe cerrarse en la primera
fase de implementación (T29A), antes de renombrar el estado comparado.

P2-T27 ("Order State DB-level CAS, no-cancellation transitions") nunca
se implementó — no existe ningún commit ni reporte con ese nombre,
permanece `QUEUED` en `ROADMAP.md` desde su creación. Se recomienda
`MERGE_INTO_T29` en vez de precederlo como tarea separada: el patrón de
CAS que generalizaría ya está probado y en producción en 6+ endpoints
reales de este mismo repo (no es una técnica nueva que necesite su
propio ciclo de validación), y T29 va a reescribir de todos modos el
archivo donde falta (`negocio/pedidos/[id]/estado/route.ts`) para
insertar los estados nuevos — cerrar el gap de CAS mientras se edita
ese archivo es prácticamente gratis, hacerlo dos veces sería
desperdicio. P2-T28 estableció formalmente (confirmado, no citado de
memoria) que sólo la transición a `cancelado` usa CAS hoy en ese
endpoint — T29A cierra ese residual.

Se encontraron y documentaron **3 copias independientes de reglas de
transición** (`VALID_TRANSITIONS` en el endpoint de Negocio,
`TRANSICIONES` en el endpoint de Operaciones-Terminal PyR, y varios
endpoints de transición única hardcoded en Operativo/{pyr,salon,mozo})
— `ORDER_TRANSITION_SINGLE_AUTHORITY=NO`. Recomendación acotada (no un
mega-refactor): extraer una autoridad de transición compartida mínima
en T29A, sin unificar los endpoints de transición fija que no la
necesitan.

Diseño completo entregado y documentado en el reporte: matriz de
notificaciones (10 transiciones, reutilizando la factory centralizada
existente `orderUpdateNotification.statusMessages`), matriz de UI por
rol (Negocio: botón/acción/cancelación por estado y modalidad; Cliente:
timeline de 6 pasos; Repartidor: sin cambios de comportamiento, sólo de
nombre de estado comparado), matriz de cancelación por estado y actor,
auditoría de timeouts (el mecanismo de auto-cancelación de 30 minutos
para pedidos sin repartidor YA EXISTE, ya es seguro vía CAS+transacción,
sólo necesita el nuevo nombre de estado en su filtro — no hace falta
construir nada nuevo), plan de compatibilidad con pedidos legacy
explícito (sin backfill, sin transformación retroactiva — los pedidos
existentes completan su ciclo tal cual, sólo los pedidos NUEVOS
posteriores al deploy usan el grafo con los estados nuevos), inventario
completo de tests actuales (prácticamente nulo para transiciones de
estado/concurrencia en todo el sistema), y 5 fases de implementación
con fileset, tests y dependencias explícitos por fase.

**2 preguntas de producto quedan explícitamente abiertas para el
operador, NO asumidas por esta auditoría**: (1) ¿puede el Cliente
cancelar mientras el pedido está `aceptado`? (recomendación: sí, mismo
criterio de hoy para `recibido`); (2) ¿mesa también debe recibir
`aceptado`? (recomendación: no). Ninguna fase de implementación debe
comenzar sin que el operador resuelva ambas explícitamente.

Cero cambios de producto, tests o base de datos en esta tarea. Git
estrictamente read-only (`git diff --name-status`/`--stat` vacíos antes
y después), único archivo nuevo es el reporte de esta tarea (local,
untracked). Archivo `32` no tocado. P2-T31 permanece
`CLOSED_TESTING_CERTIFIED`, no reabierto — ningún finding separado
(sesión Android, install UX, branding, deuda de contrato estático) fue
tocado. Reporte completo:
`codex-reports/P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`.

## 0.38 ESTADO ANTERIOR — P2-T31 CERRADO: `P2_T31_STATUS=CLOSED_TESTING_CERTIFIED` — R24 CONFIRMADO FÍSICAMENTE; DIAGNÓSTICOS R6/R6A/R6B RECLASIFICADOS PERMANENTES (SIN CLEANUP NECESARIO) (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (sin cambios — R21 es read-only, ningún commit nuevo)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
RAILWAY_TESTING_DEPLOYMENT=1f025eba-02ed-469c-9412-3c3c740d4550 (DeliGO Copy, SUCCESS, sin cambios)
RAILWAY_PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (verificado, sin cambios)
MODE=READ_ONLY_AUDIT_PLUS_CLOSEOUT_DECISION / PRODUCT_DIFF=NONE / TEST_DIFF=NONE

R24_PHYSICAL_CONFIRMATION=PASS / IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (CERRADO — listado, conversación, teclado en iPhone; control Android sin regresión)
PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (R23C, sin cambios, preservado)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (R22A, sin cambios, preservado)
PUSH_PHYSICAL_ROLE_DELIVERY_CERTIFICATION_COMPLETE=SI / PUSH_PHYSICAL_PLATFORM_CERTIFICATION_COMPLETE=SI / PUSH_CHAT_DEEPLINK_PHYSICAL_CERTIFICATION_COMPLETE=SI
MATRIZ_FISICA_FINAL=Cliente iPhone+Android CERTIFIED_TESTING / Negocio+Repartidor iPhone CERTIFIED_TESTING, Android PASS-short-smoke / iconos Android PASS los 3 roles / chat deep-link Android+iPhone cold+warm PASS
ANDROID_ABORTERROR_INCIDENTE_HISTORICO=STRONGLY_SUPPORTED_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE (nunca CONFIRMED, residual de dispositivo específico, no reabierto — MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION=2 congelado)

ANDROID_PHYSICAL_CERTIFICATION_COMPLETE=SI / PUSH_DIAGNOSTICS_POST_CERT_ACTION_TRIGGERED=SI / FINAL_PUSH_DIAGNOSTICS_DISPOSITION=RETAIN_SAFE_PERMANENT_ONLY
DIAGNOSTICS_INVENTORY=PushDebugPanel + push-debug-trace.ts + push-debug-snapshot.ts + push-debug-trace-bootstrap.tsx + wiring en 3 perfiles -> todos SAFE_TESTING_DIAGNOSTIC (gate server-side fail-closed 404 en Production vía RAILWAY_ENVIRONMENT_NAME, fingerprints no reversibles, sólo lectura, nunca sale de localStorage) verificado por lectura DIRECTA de push-testing-guard.ts/debug-guard/route.ts/push-debug-trace.ts en esta tarea; push-mutation-in-flight-registry.ts y logging de error estándar = PERMANENT_HARDENING
DIAGNOSTIC_SECRET_EXPOSURE_FINDING=NONE / PRODUCTION_USER_VISIBLE_PUSH_DIAGNOSTICS_PRESENT=NO / TEMPORARY_PUSH_LOGGING_REQUIRES_CLEANUP=NO
P2_T31_R21A_CLEANUP_REQUIRED=NO (no se diseñó ninguna tarea de cleanup — reclasificado a retención permanente en vez de retirar código seguro)

R21_READ_ONLY_TEST_RECHECK_PERFORMED=SI: chat-provider-deep-link-hydration 21/21, sw-notificationclick-target-routing 6/6, chat-ios-safe-area-static-contract 12/12, Push completa 607/607 (34 archivos) — todos sin regresión

ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (SEPARADO, no bloquea T31, sí production readiness general, causa raíz diferida) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (SEPARADO, no bloquea) / PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN / ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING / UNSUBSCRIBE_STALE_GUARD_FINDING=OPEN_NON_BLOCKING_QUEUED (todos preservados sin tocar)
P2_IOS_STATIC_CONTRACT_HYGIENE_REQUIRED_BEFORE_P2_CLOSEOUT=SI (5 fallas preexistentes en ios-standalone-post-keyboard-nav-occlusion-r6-static-contract.test.ts, no introducidas por ninguna tarea reciente) / P2_T31_BLOCKED_BY_STATIC_CONTRACT_DEBT=NO
DEUDA_MODEL_G1_VS_MODEL_E1=P2-T02 (GPS de repartidor, epic distinto, NO Push — 4 fallas en repartidor-tracking-static-contract.test.ts, no relacionado a T31)

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO / PRODUCTION_PROMOTION_AUTHORIZED=NO
P2_T31_TESTING_CERTIFICATION_COMPLETE=SI
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
P2_T29_STATUS=READY_TO_START (NO iniciado en esta tarea) / P2_T02_STATUS=WAITING_FOR_OPERATOR (valor más reciente/autoritativo: el propio reporte de certificación P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R1.md, corrige entradas más antiguas de ROADMAP.md) / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN (NO iniciado en esta tarea)
```

Auditoría FINAL, estrictamente READ-ONLY, del epic completo P2-T31.
Baseline verificado fresco e idéntico al esperado en Git y Railway (TESTING
y Production).

**R24 reconciliado**: confirmación física completa en las 4 áreas
obligatorias (listado, conversación, teclado en iPhone; control
Android). El finding queda `PHYSICALLY_CONFIRMED_FIXED_TESTING`,
CERRADO. R23/R23A/R23B/R23C/R24 no se reabren.

**Matriz física final de Push consolidada** sin duplicados en los 3
roles y 2 plataformas. El incidente histórico "Android A" (`AbortError`
de `PushManager.subscribe()`) se preserva sin reabrir — residual
específico de dispositivo, clasificación `STRONGLY_SUPPORTED` (nunca
`CONFIRMED`), hardening R13A/R19/R19R/R19R1 confirmado intacto por
lectura directa de código en esta tarea.

**Inventario exhaustivo de diagnósticos** (código real, no sólo
reportes): toda la instrumentación R6/R6A/R6B/R7/R19R1 verificada como
`SAFE_TESTING_DIAGNOSTIC` — gate server-side fail-closed (404
indistinguible en Production), fingerprints no reversibles/redacción
por patrón de nombre, nunca sale del origen, de sólo lectura (nunca
puede mutar una subscripción real). Sin exposición de secretos/PII, sin
nada visible a un usuario normal en ningún entorno.

**Decisión**: la condición de retención de R10 (hasta certificación
física de Android) ya se cumplió, pero como todo lo auditado ya es
seguro por diseño, se reclasifica a retención PERMANENTE en vez de
disparar un cleanup — `P2_T31_R21A_CLEANUP_REQUIRED=NO`, no se diseñó
ninguna tarea de cleanup adicional.

Las 8 condiciones de cierre de P2-T31 se verificaron cumplidas.
Findings preservados explícitamente SEPARADOS del cierre (no
pertenecen al pipeline de Push, no lo bloquean): sesión cruzada Android
Cliente/Repartidor (production readiness general, causa raíz diferida),
Android install UX, branding/ícono, deuda de contrato estático iOS/PWA
(5 fallas preexistentes) y deuda MODEL-G1/MODEL-E1 de P2-T02 (epic
distinto). Recheck read-only barato: 21/21 + 6/6 + 12/12 + 607/607,
todos sin regresión. Git estrictamente read-only (`git diff --name-
status`/`--stat` vacíos antes y después), único archivo nuevo es el
reporte de esta tarea (local, untracked). Archivo `32` no tocado.
Production confirmada sin cambios, ninguna promoción autorizada ni
realizada.

**`P2_T31_STATUS=CLOSED_TESTING_CERTIFIED`**. P2-T29 queda
`READY_TO_START` pero NO se inicia en esta tarea. P2-T02 sigue
`WAITING_FOR_OPERATOR`. Payments sigue `DEFERRED`. Reporte completo:
`codex-reports/P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md`.

## 0.37 ESTADO ANTERIOR — P2-T31-R24: R23C CONFIRMADO FÍSICAMENTE (CERRADO); FIX DE IOS CHAT SAFE-AREA DESPLEGADO EN TESTING (COMMIT 818B627) — CONFIRMADO FÍSICAMENTE Y CERRADO POR R21 ARRIBA (2026-09-08)

```text
HEAD=origin/testing-codex=818b627b472e03e80034c047a51dfd3491f3add3 (R24 — reemplaza a 1bd953a en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (R23C, 4/4 combinaciones Android/iPhone x cold/warm PASS — CERRADO, no se reabre)
CHAT_PUSH_DEEPLINK_PHYSICAL_CERTIFICATION_COMPLETE=SI

IOS_CHAT_SAFE_AREA_ROOT_CAUSE_CLASS=INTERACTIVE_HEADER_CONTAINER_TOP_0_WITHOUT_SAFE_AREA_PADDING / STATUS=PROVEN
FIX=header del listado (chat-sheet.tsx) y de la conversación (chat-view.tsx) reciben pt-[calc(env(safe-area-inset-top,0px)+Xrem)]; botón cerrar (X) built-in compartido de sheet.tsx recibe data-slot="sheet-close" inerte, reposicionado SÓLO para chat vía [data-ios-debug-role="chat-sheet"] en globals.css — ningún otro Sheet de la app afectado
IOS_CHAT_FULL_BLEED_PRESERVED=SI / GLOBAL_LAYOUT_CHANGED=NO / GLOBAL_VIEWPORT_POLICY_CHANGED=NO (viewportFit:"cover" intacto) / PLATFORM_BRANCH_ADDED=NO
R23C_CHAT_DEEPLINK_CODE_CHANGED=NO (useChatDeepLink/useChatActorReset/push routing/notificationclick sin tocar)
IOS_CHAT_SAFE_AREA_TEST_PASS=12 (nuevo) / CHAT_R23C_REGRESSION_PASS=21 (sin cambios) / NOTIFICATIONCLICK_TEST_PASS=6 (sin cambios) / PUSH_TEST_FINAL_PASS=607 (34 archivos, sin regresión)
IOS_PWA_PROXY_PASS=303 / IOS_PWA_PROXY_PREEXISTING_FAIL=5 (mismo archivo no tocado, ya documentado en R23C) / IOS_PWA_PROXY_NEW_FAIL=0
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
COMMIT_HASH=818b627b472e03e80034c047a51dfd3491f3add3 / COMMIT_PARENT=1bd953a6bc97fe5dffa993d1653ee55212f012d4 / COMMIT_MESSAGE=fix: keep chat controls below ios safe area
TESTING_DEPLOYMENT_ID=1f025eba-02ed-469c-9412-3c3c740d4550 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto, servicio "DeliGO Copy")
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION
PHYSICAL_IOS_CHAT_SAFE_AREA_RETEST_REQUIRED=SI (iPhone listado/conversación/teclado, Android control)

ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (sin cambios, causa raíz diferida)
ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (sin cambios, no bloquea)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (sin cambios, cerrado)

PRODUCT_CODE_CHANGED=SI (3 archivos: chat-sheet.tsx, chat-view.tsx, sheet.tsx + globals.css) / TEST_CODE_CHANGED=SI (1 nuevo) / COMMIT_PERFORMED=SI / PUSH_PERFORMED=SI / DEPLOY_PERFORMED=SI / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_PENDING_IOS_CHAT_SAFE_AREA_PHYSICAL_CONFIRMATION_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R24_PHYSICAL_IOS_CHAT_SAFE_AREA_CONFIRMATION
```

**R23C reconciliado primero**: nueva evidencia física confirmó el fix
en las 4 combinaciones obligatorias (Android/iPhone × cold/warm) — el
finding de tap de chat queda `PHYSICALLY_CONFIRMED_FIXED_TESTING`,
CERRADO. R23/R23A/R23B/R23C no se reabren.

Auditó el árbol completo de Chat por lectura de código: DOS headers en
flujo normal sin protección de safe-area (listado en `chat-sheet.tsx`,
conversación en `chat-view.tsx`) más un tercer control afectado — el
botón cerrar (X) built-in compartido de `sheet.tsx` (único cierre
disponible en la vista de listado). Root cause `PROVEN`: contenedores
en flujo normal/`top:0` sin `env(safe-area-inset-top)`, mientras el
fondo del Sheet ya hereda correctamente el full-bleed vía
`viewport-fit=cover` (global, sin tocar).

Fix con el mismo idioma ya establecido en el repo
(`mesa-cuenta-dialog.tsx`, `n/[slug]/page.tsx`, `cliente/page.tsx`):
los dos headers reciben `pt-[calc(env(safe-area-inset-top,0px)+Xrem)]`
en vez de `py-*` plano. El botón X compartido de `sheet.tsx` (usado por
TODOS los Sheets de la app) recibió `data-slot="sheet-close"` —
puramente inerte, misma convención que `dialog.tsx` ya usa — para poder
escoparlo en `globals.css` exclusivamente bajo `[data-ios-debug-role=
"chat-sheet"]` (marcador ya existente en `chat-sheet.tsx`): ningún otro
Sheet de la app se ve afectado. Sin branching por plataforma.

Gate completo: 12 tests nuevos, R23C 21/21 sin cambios,
`notificationclick` 6/6 sin cambios, Push 607/607 sin regresión, iOS/
PWA proxy con las mismas 5 fallas preexistentes de R23C (0 nuevas),
ESLint/TypeScript (24 raw, 0 nuevos)/build limpios. Un commit
(`818b627`, parent `1bd953a`), push a `testing-codex`, autodeploy a
"DeliGO Copy" con match exacto de commit, smokes no mutantes
(`/negocio`→200, `/cliente/`→308). Production intacta.

No se certifica físicamente todavía. Findings preservados sin tocar:
sesión cruzada Android Cliente/Repartidor (`OPEN`, causa diferida),
Android install UX (`OPEN`, no bloquea), badge/maskable/cache/
unsubscribe (sin cambios). **P2-T31 SIGUE ABIERTO** — "R21 final" no se
ejecuta hasta la confirmación física de este fix. P2-T29 `QUEUED`,
Payments `DEFERRED`. Reporte completo:
`codex-reports/P2_T31_R24_IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_AUDIT_FIX_TESTING_DEPLOY.md`.

## 0.36 ESTADO ANTERIOR — P2-T31-R23C: FIX DEL ROOT CAUSE PROVEN DE R23B DESPLEGADO EN TESTING (COMMIT 1BD953A) — CONFIRMADO FÍSICAMENTE POR R24 ARRIBA; FINDING CLIENTE/REPARTIDOR ANDROID CORREGIDO — GOOGLE DESCARTADO COMO TRIGGER (2026-09-08)

```text
HEAD=origin/testing-codex=1bd953a6bc97fe5dffa993d1653ee55212f012d4 (R23C — reemplaza a 23c038a en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
FIX=useChatActorReset (src/providers/chat-provider.tsx) agrega `previous !== null` a su guard de reset — null->primer actor real (primera hidratación) ya NO resetea el chat-store; real->null (logout) y real A->real B (incl. cambio de rol) SIGUEN reseteando sin cambios
R23A_AUTH_HYDRATION_FIX_STAYS_REQUIRED=SI (sin tocar) / R23B_ROOT_CAUSE_REPRO_WITH_OLD_RESET=FAIL_EXPECTED (5/21 confirmado) / R23C_ROOT_CAUSE_REPRO_WITH_NEW_RESET=PASS (21/21 confirmado)
MATRIZ_ACTOR_RESET_9_CASOS=PASS (A-I completos, ver reporte)
PUBLIC_SW_CHANGED=NO / AUTH_STORE_CHANGED=NO / CHAT_STORE_CHANGED=NO / PUSH_BACKEND_CHANGED=NO
CHAT_ACTOR_RESET_TEST_PASS=11 (nuevo) / CHAT_DEEPLINK_HYDRATION_TEST_PASS=10 (sin cambios, preservado) / NOTIFICATIONCLICK_TEST_PASS=6 (sin cambios) / PUSH_TEST_FINAL_PASS=607 (34 archivos, sin regresión)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
COMMIT_HASH=1bd953a6bc97fe5dffa993d1653ee55212f012d4 / COMMIT_PARENT=23c038af4406e7ee838d465e3d2023acf391fb5f / COMMIT_MESSAGE=fix: preserve chat state on initial auth hydration
TESTING_DEPLOYMENT_ID=e1fad4be-dacb-44c8-8721-48973bb18bdf / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto, servicio "DeliGO Copy")
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PHYSICAL_CHAT_RETEST_REQUIRED=SI (Android Negocio cold+warm, iPhone Negocio cold obligatorios; Negocio->Cliente recomendado)

GOOGLE_ACCOUNT_SPECIFIC_TRIGGER=RULED_OUT_BY_PHYSICAL_EVIDENCE (Android same-account FAIL Y different-account FAIL; iPhone same-account PASS control positivo)
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN (reemplaza al finding "misma cuenta Google" de R23B) / PLATFORM_SCOPE=ANDROID_ONLY_CONFIRMED / ROOT_CAUSE=NOT_AUDITED (diferido) / P2_T31_BLOCKER=NO / PRODUCTION_READINESS_BLOCKER=YES

IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=OPEN (sin cambios, bloquea P2-T31) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (sin cambios, no bloquea)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (sin cambios, cerrado)

PRODUCT_CODE_CHANGED=SI (1 archivo: src/providers/chat-provider.tsx) / TEST_CODE_CHANGED=SI (1 extendido) / COMMIT_PERFORMED=SI / PUSH_PERFORMED=SI / DEPLOY_PERFORMED=SI / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_PENDING_R23C_CHAT_TAP_PHYSICAL_CONFIRMATION_AND_IOS_SAFE_AREA_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R23C_PHYSICAL_CHAT_TAP_CONFIRMATION_ANDROID_AND_IPHONE
```

Implementó el fix mínimo del root cause `PROVEN` de R23B:
`useChatActorReset` distinguía mal la transición `null → primer actor
real` (resolución inicial de identidad durante la hidratación de
`auth-store`) de un cambio de actor genuino — ambas disparaban
`useChatStore.getState().reset()` en el mismo commit de React en que
`useChatDeepLink` acababa de abrir el chat. El fix agrega un chequeo
`previous !== null` al guard: la transición inicial ya NO resetea;
`real → null` (logout) y `real A → real B` (incluyendo cambio de rol)
siguen reseteando exactamente igual que antes — la seguridad
cross-actor no se debilitó. R23A no se tocó.

Reproducción rigurosa: se extendió
`chat-provider-deep-link-hydration.test.ts` con un `JointHarness` que
monta `useChatDeepLink()` + `useChatActorReset()` (ambas exportadas
sólo para test) en el mismo orden que `ChatProvider` real. Revirtiendo
temporalmente sólo `previous !== null`, 5/21 tests fallan; restaurado
de inmediato, 21/21 verdes. Matriz completa de 9 transiciones de actor
cubierta verificando el estado observable del store.

Gate completo: Push 607/607 sin regresión, `notificationclick` 6/6 sin
cambios, ESLint/TypeScript (24 raw, 0 nuevos)/build limpios.
`sw.js`/`auth-store.ts`/`chat-store.ts`/backend: ningún cambio.
Fileset exacto: `chat-provider.tsx` + su test. Un commit (`1bd953a`,
parent `23c038a`), push a `testing-codex`, autodeploy a "DeliGO Copy"
con match exacto de commit, logs de boot limpios, smokes no mutantes
(`/negocio`→200, `/cliente/`→308). Production intacta.

**Finding Cliente/Repartidor Android CORREGIDO**: evidencia física
nueva descarta que la cuenta de Google sea el factor discriminante —
en Android falla TANTO con la misma cuenta COMO con cuentas distintas;
en iPhone, la misma cuenta SÍ permite ambos roles simultáneos (control
positivo). Requisito de producto reafirmado: DeliGO debe permitir
Cliente+Repartidor simultáneos en Android con cualquier combinación de
identidad de Google. Causa raíz técnica diferida a tarea futura.

No se certifica físicamente todavía. Findings preservados sin tocar:
iOS chat safe-area (`OPEN`, bloquea P2-T31), Android install UX
(`OPEN`, no bloquea), ícono de Push (cerrado), badge/maskable/cache/
unsubscribe (sin cambios). Git: sólo 2 archivos de producto/test
modificados, todo lo demás (reporte, context docs) local/untracked.
Archivo `32` no tocado. **P2-T31 SIGUE ABIERTO** — "R21 final" no se
ejecuta. P2-T29 `QUEUED`, Payments `DEFERRED`. Reporte completo:
`codex-reports/P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

## 0.35 ESTADO ANTERIOR — P2-T31-R23B (READ-ONLY): CAUSA RAÍZ ADICIONAL PROBADA CON REPRODUCCIÓN DE CÓDIGO REAL (`useChatActorReset` borra el sheet que `useChatDeepLink` acaba de abrir); RETEST FÍSICO DE R23A FALLÓ EN ANDROID E IPHONE; NUEVO FINDING FORMAL DE SESIÓN GOOGLE CRUZADA MULTI-ROL (NO CORREGIDO, CORREGIDO POR R23C ARRIBA) (2026-09-08)

```text
HEAD=origin/testing-codex=23c038af4406e7ee838d465e3d2023acf391fb5f (sin cambios — R23B es read-only, ningún commit nuevo)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
MODE=READ_ONLY_AUDIT / PRODUCT_DIFF=NONE / TEST_DIFF=NONE / GIT_DEPLOY_HISTORY_UPDATED=NO
R23A_PHYSICAL_FIX_CONFIRMATION=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_ANDROID=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_IPHONE=FAIL
ANDROID_CHAT_TAP_WARM_APP=FAIL / ANDROID_CHAT_TAP_WARM_APP_FINAL_DESTINATION=DASHBOARD / ANDROID_CHAT_TAP_BACKGROUND_FOREGROUND_RETRY=FAIL (descarta la hidratación como causa ÚNICA — app ya autenticada/hidratada y aun así falla)
AUTH_HYDRATION_RACE_EXISTS=SI / AUTH_HYDRATION_RACE_WAS_COMPLETE_PHYSICAL_ROOT_CAUSE=NO / R23_PRIMARY_CAUSE_SUFFICIENT_FOR_PHYSICAL_BUG=NO (el fix de R23A NO se descarta — cerró una carrera real y sigue siendo necesario)
FINAL_ROOT_CAUSE_CLASSIFICATION=H_CHAT_SHEET_STATE_IS_RESET_AFTER_OPEN / FINAL_ROOT_CAUSE_STATUS=PROVEN
ROOT_CAUSE_MECHANISM=ChatProvider llama useChatDeepLink() y luego useChatActorReset(); ambos efectos corren, en ese orden, en el MISMO commit de React cuando auth-store rehidrata user+_hasHydrated sincrónicamente (onRehydrateStorage llama setHasHydrated(true) inmediatamente después del merge(), sin await); useChatActorReset trata null->usuario-real como cambio de actor y llama useChatStore.getState().reset(), borrando isSheetOpen/activePedidoId que useChatDeepLink acababa de fijar
ROOT_CAUSE_EVIDENCE=reproducción con happy-dom+react-dom/client+act() (script fuera del repo, nunca commiteado) que monta el useChatDeepLink REAL y exportado junto a una redeclaración fiel de useChatActorReset (no exportado), en el mismo orden real de ChatProvider — CASO A (un solo commit, el real) pierde el deep-link; CASO B (dos commits) lo preserva
URL_WRITER_INVENTORY=ningún archivo en app/negocio/**, app/cliente/**, components/business/**, providers/**, store/**, hooks/** escribe la URL fuera de los ya conocidos (login-form submit, el propio useChatDeepLink, 2 efectos de cliente/page.tsx gateados por auth_success/register ajenos a `chat`) -> descarta normalización/limpieza de query como causa
MANIFEST_START_URL_LAUNCH_HANDLER_PLAUSIBILITY=RULED_OUT (no interceptan URLs explícitas de notificationclick; el bug ocurre igual en iPhone sin WebAPK)
R23B_OUTCOME=A_ROOT_CAUSE_PROVEN / RUNTIME_INSTRUMENTATION_REQUIRED=NO / NEXT_RECOMMENDED_ACTION=P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_AND_TESTING_DEPLOY (fix diseñado, NO implementado en R23B)
CROSS_ROLE_SAME_GOOGLE_ACCOUNT_CONCURRENT_SESSION_FINDING=OPEN (NUEVO) / SAME_GOOGLE_ACCOUNT_CROSS_ROLE_CONCURRENCY=FAIL / DIFFERENT_GOOGLE_ACCOUNT_CROSS_ROLE_CONCURRENCY=PASS / SAME_IDENTITY_MULTI_ROLE_CONCURRENT_SESSION_REQUIRED=SI (requisito de producto explícito) / CROSS_ROLE_GOOGLE_SESSION_ROOT_CAUSE=NOT_AUDITED (diferido) / P2_T31_BLOCKER=NO / PRODUCTION_READINESS_BLOCKER=YES
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_TAP_R23C_FIX_AND_IOS_SAFE_AREA_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
```

Auditoría estrictamente READ-ONLY. Baseline verificado fresco e
idéntico al esperado. El retest físico del fix de hidratación de R23A
(ya desplegado en TESTING el mismo día, commit `23c038a`) volvió a
fallar en Android e iPhone. Evidencia "warm app" decisiva del
operador: con Negocio ya abierto, autenticado, sin hidratación
pendiente, el tap de un chat entrante sigue sin abrir el chat — esto
prueba que la carrera de hidratación no es la causa completa, porque
`Client.navigate()` (usado por `notificationclick` sobre una PWA ya
abierta) es, por spec, una navegación de documento real que reinicia el
runtime de JS igual que un arranque en frío, cayendo en la misma
carrera de todos modos.

Causa raíz adicional PROBADA (no sólo inferida): `ChatProvider`
(`src/providers/chat-provider.tsx`) llama `useChatDeepLink()` y luego,
en la misma función, `useChatActorReset()` — React corre los efectos
de ambos hooks, en ese orden, dentro del MISMO commit cuando la
rehidratación de `auth-store` actualiza `user` y `_hasHydrated`
sincrónicamente. `useChatActorReset` trata la transición `null ->
usuario real` (identidad recién hidratada) igual que un cambio real de
actor, y llama `useChatStore.getState().reset()` —el único call site
de producción de ese reset, confirmado por grep— borrando el
`isSheetOpen`/`activePedidoId` que `useChatDeepLink` acababa de fijar
segundos antes en el mismo commit. Se probó con un script de
reproducción FUERA del repo (nunca commiteado) que monta el
`useChatDeepLink` real y exportado junto a una redeclaración fiel de
`useChatActorReset`, en el mismo orden de `ChatProvider` real: el
escenario "un solo commit" (el real de `auth-store.ts`) pierde el
deep-link; el escenario "dos commits separados" lo preserva —
reproducción decisiva con código real, DOM real y React real.

**No se afirma que R23A introdujo una regresión ni se descarta su
fix**: cerró una carrera real (10/10 tests) y sigue siendo necesario —
sin él, ni el escenario de "dos commits" funcionaría en un arranque en
frío puro. Es una causa adicional e independiente, no detectada por
R23A porque su propio test nunca montó `useChatActorReset` junto a
`useChatDeepLink`. No se implementó ningún fix en esta tarea — se
dimensiona (no se codifica) el guard correcto para una futura `R23C`:
`useChatActorReset` debe ignorar la transición `null -> primer usuario
real tras el mount`, y sólo resetear cuando el actor anterior YA era un
usuario real distinto.

Inventario exhaustivo de escritores de URL en el árbol relevante
descartó cualquier hipótesis de normalización/limpieza de query o de
`start_url`/`launch_handler` del manifest como causa (ver marcadores
arriba) — ningún archivo bajo `app/negocio/**`, `components/business/**`,
`providers/**`, `store/**`, `hooks/**` toca la URL fuera de los casos ya
conocidos, y el mecanismo de lanzamiento de la PWA no intercepta URLs
explícitas que el propio Service Worker pasa a
`clients.openWindow()`/`client.navigate()`.

**Nuevo finding formal, no corregido, no mezclado con el de chat**:
usar la MISMA cuenta de Google para DeliGO Cliente y DeliGO Repartidor
hace que una sesión interfiera con la otra; con cuentas de Google
DISTINTAS, ambos roles permanecen autenticados simultáneamente sin
problema. Requisito de producto explícito del operador: una misma
persona con una misma identidad de Google debe poder tener Cliente y
Repartidor autenticados a la vez, sin necesitar cerrar sesión de uno ni
usar una cuenta distinta como workaround. La causa raíz (modelo de
identidad/sesión) queda explícitamente diferida a una tarea futura —
NO se afirma "Google causa el bug", NO se audita ni corrige aquí.

Findings preservados sin tocar: iOS chat safe-area (`OPEN`, bloquea
P2-T31), Android install UX (`OPEN`, no bloquea), ícono de Push
(`PHYSICALLY_CONFIRMED_FIXED_TESTING`, cerrado), badge monocromo
Android (pendiente), PWA maskable icon (`OPEN`), SW icon cache bypass
(`OPEN_NON_BLOCKING`), unsubscribe stale guard
(`OPEN_NON_BLOCKING_QUEUED`). Git estrictamente read-only (`git diff
--name-status`/`--stat` vacíos), único archivo nuevo es el reporte de
esta tarea (local, untracked). Archivo `32` no tocado. Production sin
cambios. **P2-T31 SIGUE ABIERTO** — "R21 final" no se ejecuta. P2-T29
`QUEUED`, Payments `DEFERRED`. Reporte completo:
`codex-reports/P2_T31_R23B_CHAT_PUSH_TAP_RUNTIME_URL_CONSUMPTION_ROOT_CAUSE_AUDIT.md`.

## 0.34 ESTADO ANTERIOR — P2-T31-R23A: FIX DE LA CARRERA DE HIDRATACIÓN DE CHAT DESPLEGADO EN TESTING (COMMIT 23C038A) — RETEST FÍSICO FALLÓ EN AMBAS PLATAFORMAS, CAUSA ADICIONAL PROBADA Y AUDITADA POR R23B ARRIBA; 2 FINDINGS NUEVOS (iOS chat safe-area — bloquea T31; Android install UX — no bloquea) (2026-09-08)

```text
HEAD=origin/testing-codex=23c038af4406e7ee838d465e3d2023acf391fb5f (R23A — reemplaza a ed58ca4 en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION (elevado desde STRONGLY_SUPPORTED)
AUTH_HYDRATION_GATE_IMPLEMENTED=SI / AUTH_HYDRATION_RETRY_IMPLEMENTED=SI
R23_AUTH_HYDRATION_RACE_REPRO_BEFORE=FAIL_EXPECTED (verificado: revirtiendo TEMPORALMENTE sólo la línea de dependencias del efecto, exactamente 3/10 tests fallan) / R23_AUTH_HYDRATION_RACE_REPRO_AFTER=PASS (10/10 con el fix restaurado)
PUBLIC_SW_CHANGED=NO / PUSH_BACKEND_CHANGED=NO / AUTH_STORE_CHANGED=NO
CHAT_DEEPLINK_TEST_PASS=10 / NOTIFICATIONCLICK_TEST_PASS=6 (nuevo, cierra el gap de R23) / PUSH_TEST_FINAL_PASS=607 (sin regresión) / PWA_FOCAL_TEST_PASS=52 (sin regresión)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
COMMIT_HASH=23c038af4406e7ee838d465e3d2023acf391fb5f / COMMIT_PARENT=ed58ca47a522b8190c41283818d1742887f24d31 / COMMIT_MESSAGE=fix: preserve chat deep links through auth hydration
TESTING_DEPLOYMENT_ID=96dc9cd8-b4d6-492b-a0e6-e6566127d38c / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto verificado)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PHYSICAL_CHAT_RETEST_REQUIRED=SI (Android Negocio + iPhone Negocio obligatorios, Negocio→Cliente recomendado)

IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=OPEN (NUEVO — full-bleed intencional preservado, pero controles de cerrar/volver del chat quedan dentro de la safe-area en iPhone; Android no lo presenta; ROOT_CAUSE=NOT_AUDITED) / P2_T31_CLOSEOUT_BLOCKED_BY_IOS_CHAT_SAFE_AREA_FIX=YES
ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (NUEVO — la UI muestra "instalada" antes de que el WebAPK termine en background; UX general, DETERMINATE_REAL_PROGRESS_BAR_SUPPORTED=NO, GET_INSTALLED_RELATED_APPS_FEASIBILITY=NOT_AUDITED) / P2_T31_CLOSEOUT_BLOCKED_BY_ANDROID_PWA_INSTALL_UX=NO (queued, tarea UX separada)

ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (sin cambios, cerrado, no se reabre)
ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI / PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING / UNSUBSCRIBE_STALE_GUARD_FINDING=OPEN_NON_BLOCKING_QUEUED (todos sin cambios)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios) / ANDROID_NEGOCIO_SHORT_SMOKE=PASS / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS (sin cambios, ninguna certificación funcional se revoca)

PRODUCT_CODE_CHANGED=SI (1 archivo: src/providers/chat-provider.tsx) / TEST_CODE_CHANGED=SI (2 nuevos) / COMMIT_PERFORMED=SI / PUSH_PERFORMED=SI / DEPLOY_PERFORMED=SI / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_TAP_PHYSICAL_CONFIRMATION_AND_IOS_CHAT_SAFE_AREA_FIX_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R23A_PHYSICAL_CHAT_TAP_CONFIRMATION_ANDROID_AND_IPHONE
```

Tarea TARGETED IMPLEMENTATION + REPRODUCTION TEST + REGRESSION TESTS +
CONTROLLED COMMIT + PUSH + TESTING DEPLOY, explícitamente autorizada.
Baseline verificado fresco (`HEAD=origin/testing-codex=ed58ca4`,
`origin/main=1de0d3c1`, coincidían exactamente).

**Fix implementado — diff mínimo**: `src/providers/chat-provider.tsx`
::`useChatDeepLink` ahora lee `authHasHydrated = useAuthStore((s) =>
s._hasHydrated)` —un campo YA EXISTENTE en `auth-store.ts`, sin crear
ningún sistema de hidratación paralelo— y lo agrega a las
dependencias del `useEffect` que consume `?chat=<pedidoId>`. Cuando la
hidratación del store de auth Zustand `persist` termina (transición de
`false` a `true`), React vuelve a ejecutar el efecto automáticamente
(que llama a `consumeChatParam()` de nuevo, ahora con
`isAuthenticated()` reflejando el usuario real) — cerrando la carrera
donde un arranque en frío (exactamente el escenario de un tap de
notificación de chat que abre la PWA recién cerrada) podía descartar
el deep-link para siempre, en silencio. `consumeChatParam()` en sí
**no cambió ni una línea**; el guard existente (`if (!chatPedidoId)
return` — el parámetro ya eliminado si se consumió antes) previene
cualquier doble apertura sin necesidad de un flag nuevo. El hook se
exportó (antes privado al módulo) exclusivamente para poder montarlo
aislado en tests reales de DOM.

**Reproducción rigurosa, no sólo asumida**: se construyó un test que
monta `useChatDeepLink` en un ciclo de commit de React REAL —
`happy-dom` (vía `@happy-dom/global-registrator`) + `react-dom/client`
+ `act()`, exactamente el mismo patrón ya establecido en
`src/store/auth-store.test.ts`/`src/hooks/use-repartidor-tracking.
test.ts` (ningún harness nuevo inventado). Para demostrar que la
carrera era real y no sólo teórica, se REVIRTIÓ TEMPORALMENTE sólo la
línea de dependencias del efecto (quitando `authHasHydrated`) y se
re-ejecutó la suite: **exactamente 3 de 10 tests fallaron** — la
reproducción de la carrera en sí, y los 2 casos de camino feliz que
dependen de una hidratación diferida (Negocio y Cliente,
respectivamente) — mientras los 7 tests que no dependen de ese trigger
siguieron en verde. Se restauró el fix inmediatamente después y se
reconfirmaron los 10/10 verdes antes de continuar con cualquier otro
paso de la tarea.

Matriz de tests completa (10, todos PASS con el fix): auth ya
hidratado antes del montaje (abre inmediato); hidratación diferida
para Negocio (abre exactamente una vez, verificado cerrando
manualmente y disparando un evento `focus` después — no reabre);
hidratación diferida para Cliente (misma verificación, dirección
Negocio→Cliente, mismo hook compartido); hidrata SIN usuario (no
abre, y el query param se preserva intacto para un reintento real
futuro — comportamiento seguro ya existente, sin cambios); superadmin
(no abre, ya hidratado); sin `?chat=` en la URL (no hace nada); un
`focus()` después de ya consumido (no reabre); un `visibilitychange`
después de ya consumido (no reabre); y preservación de otros query
params (`?tab=pedidos&chat=abc&foo=bar` → sólo `chat` se elimina).

Se agregó además un contrato de regresión PERMANENTE para
`notificationclick` (`src/lib/sw-notificationclick-target-routing.
test.ts`, 6 tests nuevos) — carga el `public/sw.js` REAL (misma
técnica de R22/R22A/R23: `vm.runInContext`) y prueba
`negocio+chat`/`cliente+chat` (PWA cerrada y abierta) junto a los 2
controles ya certificados físicamente (`cliente+order_update`,
`repartidor+new_delivery`) y un test explícito de que el
window-matching es role-safe (una ventana de Cliente abierta nunca se
reutiliza para un target de Negocio). Esto cierra el gap TOTAL de
cobertura que R23 había documentado (cero tests existían para
`notificationclick`/`buildPersonalNotificationTarget`/`ChatProvider`
antes de esta tarea) — no es el fix primario, pero convierte la
reproducción read-only de R23 en un contrato permanente.

Gate completo: suite Push 607/607 sin regresión (el nuevo archivo de
`notificationclick` se nombró deliberadamente fuera del patrón
`*push*.test.ts` para no confundirse con la suite funcional de Push,
se ejecutó por separado con éxito); PWA focal 52/52 sin regresión;
suite completa de Chat 285 pass/4 fail (los 4 fallos son
`.integration.test.ts` pre-existentes que requieren `DATABASE_URL` —
ambiental, confirmado explícitamente sin relación con
`chat-provider.tsx`); ESLint limpio; TypeScript 24 raw idéntico a la
baseline (0 nuevos, ninguno menciona los 3 archivos tocados); `git
diff --check` limpio; `next build` completo sin errores.
`public/sw.js`, `src/lib/push.ts`, `src/store/auth-store.ts`: **ningún
cambio** — no surgió ningún blocker que contradijera R23, no fue
necesario tocar el Service Worker ni el backend de Push ni la
semántica de auth.

Stage selectivo de EXACTAMENTE 3 archivos (`chat-provider.tsx`
modificado + 2 tests nuevos) — el reporte de esta tarea permanece
**untracked**, preservando la convención histórica, sin generalizar el
precedente puntual de Branding R1A. `branding-source/`,
`DELIGO_FULL_CONTEXT_LATEST.md` y `32` intactos. Un solo commit
(`23c038a`, parent `ed58ca4` verificado, sin `--amend`). Push
únicamente a `testing-codex` — `origin/testing-codex` confirmado en
`23c038a`.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets) —
deployment `96dc9cd8-b4d6-492b-a0e6-e6566127d38c` `SUCCESS`,
`meta.commitHash` == `23c038a` exacto (verificado vía `railway status
--json`, no asumido). Logs de boot limpios ("No pending migrations to
apply.", Next.js 16.1.3 "✓ Ready in 136ms"). Validación NO mutante
post-deploy: `GET /negocio` → 200, `GET /cliente/` → 308 (normalización
de slash, normal, sin cambios); se descargaron los chunks JS
referenciados por `/negocio` y se confirmó que el bundle desplegado
contiene la propiedad `_hasHydrated` (evidencia complementaria, no
autoritativa por sí sola — la confirmación autoritativa es el match
exacto de `commitHash` ya verificado). Ninguna suscripción Push fue
mutada. Ningún pedido/mensaje fue creado. Ningún Push real fue
enviado. Production ("DeliGO") confirmado sin cambios en el MISMO
`railway status --json`.

**Dos findings NUEVOS registrados formalmente, aportados físicamente
por el operador durante esta tarea — ninguno auditado ni corregido**:

1. **iOS Chat safe-area de controles interactivos**
   (`IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=OPEN`): el
   full-bleed de DeliGO en iPhone hasta la status bar es INTENCIONAL y
   debe preservarse (banners/backgrounds/hero content deben poder
   ocupar toda la pantalla) — pero en las vistas de chat, los
   CONTROLES INTERACTIVOS superiores (cerrar/volver del chat
   individual, cerrar/volver del listado) también quedan dentro/debajo
   de esa misma safe-area, pudiendo dejar al usuario sin forma de
   salir del chat (workaround físico actual del operador: cerrar y
   reabrir la PWA). Android no presenta este problema. Principio ya
   fijado para el futuro fix (no implementado): fondo/banner puede
   extenderse a `top:0`, pero los controles interactivos deben
   respetar `env(safe-area-inset-top)` (o abstracción equivalente) —
   nunca resolver con padding global a toda la pantalla, nunca romper
   el full-bleed general de iPhone ya establecido. **Este finding
   BLOQUEA el closeout de P2-T31.**
2. **Android PWA install completion UX**
   (`ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN`): en Android, tras
   aceptar el prompt de instalación de Chrome, la UI de DeliGO muestra
   inmediatamente "App instalada" — pero el WebAPK puede seguir
   generándose en segundo plano; el usuario vuelve al launcher,
   todavía no la ve, y parece que la instalación falló. Objetivo UX
   futuro (no implementado): máquina de estados `AVAILABLE →
   PROMPTING → ACCEPTED → INSTALLING_BACKGROUND →
   INSTALLED_CONFIRMED`, con progreso indeterminado ("Instalando
   DeliGO… puede tardar unos segundos" — la Web Platform NO expone un
   porcentaje real de instalación de WebAPK), evaluando
   `navigator.getInstalledRelatedApps()` sin asumir su viabilidad
   todavía. Es una mejora de UX GENERAL de instalación —
   **NO bloquea P2-T31**, queda `QUEUED` como tarea separada.

**Checklist de re-test físico — para el operador** (no ejecutado desde
Claude): **obligatorio** — Android Negocio con la PWA REALMENTE
cerrada, Cliente envía un mensaje de chat, tocar la notificación debe
abrir DeliGO Negocio con el `ChatSheet` YA mostrando la conversación
del pedido correcto (no sólo el dashboard); **obligatorio** — mismo
escenario en iPhone Negocio; **recomendado** — Negocio→Cliente, para
confirmar simetría (mismo código compartido). No se pide repetir la
matriz completa de Push.

**Ninguna certificación funcional de Push preexistente se revoca** —
iPhone los 3 roles, Android Cliente/Negocio/Repartidor: todos
`CERTIFIED_TESTING`/`PASS` sin cambios. `ANDROID_PUSH_NOTIFICATION_
ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING` (R22A) sigue
cerrado, no se reabre. Los findings preexistentes (`PWA_MASKABLE_
ICON_SAFE_ZONE_FINDING=OPEN`, `SW_ICON_CACHE_BYPASS_SUBSTRING_
FINDING=OPEN_NON_BLOCKING`, badge monocromático inadecuado,
`unsubscribe()` stale) quedan todos preservados sin tocar.

**P2-T31 SIGUE ABIERTO** — ahora bloqueado por DOS condiciones
explícitas: (1) confirmación física del fix de chat tap, y (2) el
nuevo finding de safe-area de chat en iOS. "R21 final"/closeout
explícitamente NO se ejecuta hasta ambas. P2-T29 sigue `QUEUED`, no se
inicia. Payments `DEFERRED`, no se inicia.
`ANDROID_PWA_INSTALL_COMPLETION_UX` queda en cola como tarea de UX
separada, explícitamente NO bloqueante. `GIT_DEPLOY_HISTORY.md`
actualizado con esta entrada (SÍ hubo deploy). Reporte completo:
`codex-reports/P2_T31_R23A_CHAT_NOTIFICATION_DEEPLINK_AUTH_HYDRATION_FIX_TESTING_DEPLOY.md`.

## 0.33 ESTADO ANTERIOR — P2-T31-R23: ROUTING DE ÍCONOS (R22A) CONFIRMADO FÍSICAMENTE Y CERRADO; NUEVO FINDING — TAP DE NOTIFICACIÓN DE CHAT FALLA EN ANDROID E IPHONE, CAUSA STRONGLY_SUPPORTED (2026-09-08) — FIX IMPLEMENTADO Y DESPLEGADO EN TESTING POR 0.34 ARRIBA

```text
HEAD=origin/testing-codex=ed58ca47a522b8190c41283818d1742887f24d31 (sin cambios — R23 es read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R23_STATUS=CHAT_TAP_ROOT_CAUSE_STRONGLY_SUPPORTED_FIX_DESIGNED_NOT_IMPLEMENTED

ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (CERRADO — no se reabre salvo evidencia nueva)
R22A_CLIENT_ICON_PHYSICAL=PASS / R22A_NEGOCIO_ICON_PHYSICAL=PASS / R22A_REPARTIDOR_ICON_PHYSICAL=PASS
R22A_ROLE_ICON_PHYSICAL_CONFIRMATION_COMPLETE=SI

PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=OPEN (NUEVO, independiente del routing de íconos)
PHYSICAL_CHAT_PUSH_DELIVERY=PASS / PHYSICAL_CHAT_PUSH_ICON_ROUTING=PASS / PHYSICAL_CHAT_PUSH_DUPLICATE=NO
PHYSICAL_CHAT_NOTIFICATION_TAP_ANDROID=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_IPHONE=FAIL
PHYSICAL_CHAT_FAILURE_SCOPE=CONFIRMED_ONLY_FOR_CLIENTE_TO_NEGOCIO_CHAT_TAP (no se asume que otros flujos también fallen)

ROOT_CAUSE_PRIMARY_CLASS=CLIENT_SIDE_AUTH_HYDRATION_RACE_SILENTLY_DROPS_ONE_SHOT_CHAT_DEEPLINK
ROOT_CAUSE_PRIMARY_STATUS=STRONGLY_SUPPORTED (7 de 9 categorías candidatas RULED_OUT con ejecución real del sw.js; no PROVEN por no reproducir timing en navegador real)
NOTIFICATIONCLICK_AUDITED=SI / BUILD_PERSONAL_TARGET_AUDITED=SI / WINDOW_FOCUS_ROUTING_ROLE_SAFE=SI / OPEN_WINDOW_TARGET_CORRECT=SI (el sw.js NO es la causa, probado)
CHAT_DATA_ROLE_PRESENT=SI / CHAT_DATA_ROLE_CORRECT=SI / CHAT_PAYLOAD_URL_STATUS=CORRECT / IDENTIFIER_MATCH=SI

CHAT_NOTIFICATION_TAP_FIX_REQUIRED=SI
RECOMMENDED_FIX_ARCHITECTURE=GATE_USECHATDEEPLINK_ON_AUTH_HASHYDRATED_WITH_RETRY_ON_HYDRATE_COMPLETE
BACKWARD_COMPATIBILITY_STATUS=SAFE_BY_DESIGN
PHYSICAL_RETEST_REQUIRED=SI (post-fix: Android + iPhone Negocio, Cliente→Negocio chat; recomendado también Negocio→Cliente)

PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (sin cambios) / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING (sin cambios) / ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI (sin cambios) / DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_AWAITING_PHYSICAL_VISUAL_CHECK (sin cambios)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios) / ANDROID_NEGOCIO_SHORT_SMOKE=PASS / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS (sin cambios, ninguna certificación funcional se revoca)
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_NOTIFICATION_TAP_ROUTING_FIX_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R23A_CHAT_NOTIFICATION_TAP_DEEPLINK_FIX
```

Tarea DEEP READ-ONLY PRODUCT AUDIT + ROOT-CAUSE CLASSIFICATION + FIX
DESIGN + PHYSICAL RETEST DESIGN — sin código, sin tests, sin commit/
push/deploy. Baseline verificado fresco (`HEAD=origin/testing-codex=
ed58ca4`, `origin/main=1de0d3c1`, coincidían exactamente).

**Reconciliación de R22A — CERRADO**: el operador confirmó físicamente
los 3 casos pendientes de la tarea anterior. Android Cliente
(`order_update`, cambio de estado de pedido): push llegó, ícono
naranja correcto, sin duplicado, **tap correcto**. Android Repartidor
(`new_delivery`): push llegó, ícono azul correcto, sin duplicado,
**tap correcto**. Android Negocio (`chat`, mensaje de Cliente): push
llegó, ícono turquesa correcto, sin duplicado, **tap INCORRECTO**. Con
esto, `ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING` pasa a
`PHYSICALLY_CONFIRMED_FIXED_TESTING` en los 3 roles — el routing de
íconos por rol (R22/R22A) queda **cerrado físicamente**, no se reabre
salvo evidencia nueva explícita. El `tap` incorrecto de Negocio+chat
es un finding COMPLETAMENTE NUEVO E INDEPENDIENTE — el operador
confirmó además que el mismo fallo ocurre en iPhone (no es Android-
only), y no se trata como regresión de R22A: R22A únicamente tocó el
cómputo de `icon`/`badge` dentro del `push` event de `sw.js`, un
bloque de código completamente distinto y anterior al de
`notificationclick`, donde vive este nuevo bug.

**Root cause del tap de chat — trazado end-to-end con evidencia de
código real en cada tramo**: `chatMessageNotification`
(`src/lib/push.ts:926-942`) → NO envía `url` por diseño (mismo patrón
que `orderUpdateNotification`, ya probado correcto) → `data.role`
agregado centralmente por `createNotification()` (sin exclusión para
`chat`) → `public/sw.js`::`notificationclick` extrae `type`/`role`/
`pedidoId` → `buildPersonalNotificationTarget` (función pura) → para
`type==="chat"` devuelve `${basePath}?chat=<pedidoId>` (basePath
resuelto por `role`, `/negocio` para Negocio) → `clients.matchAll`/
`navigate`/`openWindow`.

**Se ejecutó el `public/sw.js` REAL** (no una reimplementación) en un
sandbox VM de Node —misma técnica exacta de R22/R22A— disparando
`notificationclick` para `negocio+chat` en 2 escenarios (PWA cerrada,
PWA ya abierta en `/negocio`) y para los 2 controles positivos
(`cliente+order_update`, `repartidor+new_delivery`, ambos con tap ya
certificado físicamente). Resultado: **en los 4 casos, el Service
Worker calcula la URL/ventana EXACTA y correcta** —
`self.location.origin + "/negocio?chat=<pedidoId>"` para el caso de
chat, indistinguible en calidad de los 2 controles. **El bug NO está
en `sw.js`** — esto descarta con evidencia directa de ejecución 7 de
las 9 categorías de causa candidatas: fábrica con URL/identificador
incorrecto, mapping de target roto en `buildPersonalNotificationTarget`,
window-matching role-unsafe (el matching exige `pathname.startsWith(
"/negocio")`, probado), ruta de chat legacy (auditado el inventario de
rutas reales: Negocio NO tiene ninguna página de chat dedicada, usa el
MISMO widget global flotante que Cliente — `ChatFab`/`ChatSheet`,
montados en `src/app/layout.tsx` raíz), action-button handler
equivocado (el payload de chat no define `actions`, la evidencia física
es tap de cuerpo), y atribución multi-PWA same-origin (descartada, el
matching es explícitamente role-safe, probado en el escenario de app
ya abierta).

**La única diferencia real** — encontrada comparando campo por campo
el caso roto contra los 2 controles que sí funcionan —: `src/providers/
chat-provider.tsx`::`useChatDeepLink` es el ÚNICO consumidor de un
deep-link de notificación montado en el **LAYOUT RAÍZ** (antes de
cualquier gate de ruta específico de rol) que se auto-condiciona a
`isAuthenticated()`/`userType()` de `src/store/auth-store.ts` —un
store Zustand con middleware `persist`, cuya hidratación es
ASÍNCRONA por diseño de Zustand, incluso usando `localStorage` como
storage síncrono— **sin esperar `_hasHydrated`** y **sin ningún
reintento** cuando esa hidratación efectivamente termina. En un
arranque en frío (exactamente el escenario de abrir la PWA de Negocio
recién cerrada desde un tap de notificación — `self.clients.
openWindow(...)`), esto puede leer `isAuthenticated()===false` ANTES
de que el usuario persistido se rehidrate, descartando el deep-link
para siempre, silenciosamente, sin ningún mecanismo de recuperación.

Los 2 consumidores de deep-link que SÍ funcionan
(`src/components/business/orders-tab.tsx` para Negocio,
`src/components/client/client-orders-panel.tsx` para Cliente) **nunca
se auto-verifican auth** — leen su parámetro de query (`pedidoId`/
`focusPedido`) incondicionalmente, porque sólo se montan DENTRO de una
ruta que la app YA trata como autenticada a un nivel superior (el
shell del rol) — nunca antes. Este mismo patrón defensivo
(`_hasHydrated`/`authHasHydrated`) YA existe, activamente usado, en 6+
archivos reales de este mismo repositorio (`src/app/cliente/page.tsx`,
`src/hooks/use-push-notifications.ts`, `src/store/cart-store.ts`,
`src/store/nav-store.ts`, `src/components/shared/push-debug-panel.tsx`,
`src/components/shared/push-debug-trace-bootstrap.tsx`) —
`chat-provider.tsx` es una OMISIÓN de un patrón ya establecido en el
propio codebase, no una idea nueva a inventar. Coincide además,
explícitamente, con el `AUTH_HYDRATION_PUSH_RACE` ya documentado
(`AUTH_HYDRATION_PUSH_RACE_STATUS=OPEN_STRUCTURAL_GAP_PROVEN_IMPACT_
PLAUSIBLE_NOT_CONFIRMED`) en R6A de este mismo epic P2-T31, para un
escenario análogo distinto (una lectura de estado de Push, no de
chat) — nunca antes confirmado por falta de evidencia; R23 no lo
reclasifica, pero aporta evidencia adicional consistente de que esta
clase de race es real en este codebase. La causa es 100% cross-
platform por naturaleza (un problema de timing de JavaScript/
hidratación de estado persistido, no de renderizado específico de
Android/iOS) — coherente con que el operador confirmó el mismo fallo
en AMBAS plataformas.

`ROOT_CAUSE_PRIMARY_STATUS=STRONGLY_SUPPORTED` — deliberadamente NO
`PROVEN`: no se reprodujo el timing EXACTO de la carrera de
hidratación en un navegador real (lanzar un browser real para forzar
y cronometrar esa carrera está fuera del alcance de una auditoría
read-only de código sin producto/tests modificados). La eliminación de
las otras 7 categorías, en cambio, SÍ es `PROVEN` (por ejecución
directa de código real).

**Fix diseñado, NO implementado en R23** (tarea explícitamente
read-only): `useChatDeepLink` debe leer `authHasHydrated
(useAuthStore((s) => s._hasHydrated))` y volver a ejecutar
`consumeChatParam()` cuando esa bandera pase de `false` a `true` —
ADEMÁS de (no en reemplazo de) los triggers actuales de mount/focus/
visibilitychange. Un solo archivo, sin tocar `sw.js` (routing de
íconos R22A intacto), sin tocar `push.ts` (backend), sin tocar
`notificationclick`, sin tocar los targets de pedidos/`new_delivery`
ya certificados. Backward compatible por diseño: una app ya abierta
con hidratación ya completada hace tiempo se comporta EXACTAMENTE
igual que hoy (el trigger de mount ya funciona en ese caso); un SW
viejo no se ve afectado (el fix vive 100% en React/cliente); ningún
cambio de contrato de URL/query param.

**Re-test físico diseñado, no ejecutado**: obligatorio — Android
Negocio Y iPhone Negocio, con la PWA de Negocio REALMENTE cerrada
(cierre forzado, no sólo background), Cliente envía un mensaje de chat
→ tap sobre la notificación → debe abrir DeliGO Negocio con el
`ChatSheet` YA mostrando la conversación del pedido correcto (no sólo
el dashboard de Negocio). Recomendado: Negocio→Cliente, para confirmar
simetría (mismo código compartido). No se pide repetir la matriz
completa de Push — sólo estos 2-3 casos.

**Gap de tests confirmado**: cero tests en todo el repo cubren
`notificationclick`, `buildPersonalNotificationTarget`, o
`ChatProvider`/`useChatDeepLink` — ni siquiera para los casos que sí
funcionan hoy (`order_update`/`new_delivery`). Matriz completa de gaps
en el reporte.

**Ninguna certificación funcional de Push preexistente se revoca** —
iPhone los 3 roles, Android Cliente/Negocio/Repartidor: todos
`CERTIFIED_TESTING`/`PASS` sin cambios; el matiz explícito preservado
es que esas certificaciones cubren los eventos YA probados (entrega,
ícono, no-duplicado, y los taps de `order_update`/`new_delivery`
específicamente) — no una certificación exhaustiva de TODOS los
`notifType`/deep-links. Los findings preexistentes
(`PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN`, `SW_ICON_CACHE_BYPASS_
SUBSTRING_FINDING=OPEN_NON_BLOCKING`, badge monocromático inadecuado,
`DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_AWAITING_PHYSICAL_
VISUAL_CHECK`) quedan todos preservados sin tocar, ninguno mezclado
con este finding de chat.

**P2-T31 SIGUE ABIERTO** — bloqueado ahora específicamente por el fix
de tap de chat (R23A), no por el routing de íconos (cerrado). "R21
final"/closeout explícitamente NO se ejecuta hasta el fix +
confirmación física. P2-T29 sigue `QUEUED`, no se inicia. Payments
`DEFERRED`, no se inicia. `COMPLETED_TASKS.md` actualizado — se
registró una entrada de sub-etapa PASS para "P2-T31 — SUB-ETAPA R22/
R22A (Android Push Notification Icon Routing)" (routing de íconos
cerrado), dejando explícito en su propia nota que P2-T31 en sí sigue
abierto por el finding de chat. `GIT_DEPLOY_HISTORY.md` NO se
actualiza (sin commit/deploy en R23). Reporte completo:
`codex-reports/P2_T31_R23_CHAT_PUSH_NOTIFICATION_TAP_DEEPLINK_ROOT_CAUSE_AUDIT.md`.

## 0.32 ESTADO ANTERIOR — P2-T31-R22A: FIX DE ROUTING DE ÍCONO DE NOTIFICACIÓN DESPLEGADO EN TESTING (COMMIT ED58CA4), PENDIENTE CONFIRMACIÓN FÍSICA ANDROID (2026-09-08) — CONFIRMADO FÍSICAMENTE Y CERRADO; NUEVO FINDING DE CHAT TAP AUDITADO POR 0.33 ARRIBA

```text
HEAD=origin/testing-codex=ed58ca47a522b8190c41283818d1742887f24d31 (R22A — reemplaza a 1d3f58a en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R22A_STATUS=FIX_IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION
ROLE_FIRST_ICON_ROUTING_IMPLEMENTED=SI (public/sw.js, push event listener)
CLIENT_ROLE_ICON_PATH=/icon-cliente-192x192.png / NEGOCIO_ROLE_ICON_PATH=/icon-negocio-192x192.png / REPARTIDOR_ROLE_ICON_PATH=/icon-repartidor-192x192.png
LEGACY_NOTIFTYPE_FALLBACK_PRESERVED=SI / EXPLICIT_PAYLOAD_ICON_OVERRIDE_PRESERVED=SI
BACKEND_CODE_CHANGE_REQUIRED=NO / BACKEND_CODE_CHANGED=NO (data.role ya existía, sólo faltaba consultarlo en el SW)
NOTIFICATION_CLICK_CHANGED=NO / PUSH_DELIVERY_LOGIC_CHANGED=NO / PUSH_SUBSCRIPTION_LOGIC_CHANGED=NO
BADGE_ROLE_ROUTING_CORRECTED=SI / ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI (sin cambios, separado, no resuelto)
SW_CACHE_NAME_BUMP_REQUIRED_FOR_R22A=NO / SW_CACHE_NAME_CHANGED=NO (deligo-v15 sin cambios, justificado: el propio script SW no se sirve desde ese cache)
ROLE_ICON_ROUTING_TEST_PASS=26 (sw-push-role-icon-routing.test.ts, sw.js real en VM sandbox) + 4 (push.test.ts, data.role directo)
PUSH_TEST_BASELINE_PASS=577 / PUSH_TEST_FINAL_PASS=607 / PUSH_TEST_FINAL_FAIL=0
PWA_FOCAL_TEST_PASS=52 / PWA_FOCAL_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
R22_BUG_REPRO_BEFORE=FAIL_EXPECTED / R22_BUG_REPRO_AFTER=PASS (Cliente+order_update, Negocio+chat, Repartidor+new_delivery)
COMMIT_HASH=ed58ca47a522b8190c41283818d1742887f24d31 / COMMIT_PARENT=1d3f58a1ea5487d254b51fa8627b5935065bce3a / COMMIT_MESSAGE=fix: route push notification icons by recipient role
TESTING_DEPLOYMENT_ID=34f5cf79-25bd-4d7a-855c-287d8bacdc4a / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto verificado)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
POST_DEPLOY_SW_JS_CONTENT_VERIFIED_BYTE_IDENTICAL=SI (diff --strip-trailing-cr contra el archivo servido en TESTING) / ICON_FILES_STILL_200=SI (los 3 de rol)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION
REPORT_STAGED=NO / FULL_CONTEXT_STAGED=NO / BRANDING_SOURCE_STAGED=NO / FILE_32_TOUCHED=NO
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (sin cambios) / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING (sin cambios) / DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_AWAITING_PHYSICAL_VISUAL_CHECK (sin cambios, distinto de este finding)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3+1) / ANDROID_NEGOCIO_SHORT_SMOKE=PASS / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS (sin cambios, ninguna certificación funcional se revoca)
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_PHYSICAL_CONFIRMATION_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R22A_PHYSICAL_ANDROID_ROLE_ICON_CONFIRMATION
```

Tarea TARGETED IMPLEMENTATION + REGRESSION TESTS + CONTROLLED COMMIT +
PUSH + TESTING DEPLOY, explícitamente autorizada
(`PRODUCT_CODE_CHANGE_AUTHORIZED=SI`/`COMMIT_AUTHORIZED=SI`/
`PUSH_AUTHORIZED=SI`/`TESTING_DEPLOY_AUTHORIZED=SI`/
`PRODUCTION_DEPLOY_AUTHORIZED=NO`). Baseline verificado fresco
(`HEAD=origin/testing-codex=1d3f58a`, `origin/main=1de0d3c1`,
coincidían exactamente).

Implementó el fix diseñado por R22, dentro del `push` event de
`public/sw.js`: `icon`/`badge` se resuelven PRIMERO por
`data.data?.role` (cliente/negocio/repartidor → su propio ícono),
usando un nuevo mapa `ROLE_ICON`. El campo `data.role` **ya existía**
—agregado por `createNotification()`::`personalRoleFor` en
`src/lib/push.ts` desde "Bugfix-4 [17]", entregado de forma probada
end-to-end (mismo mecanismo que `notificationclick` ya usaba)— así que
**el backend no se tocó en absoluto**. El `if/else if` legacy completo
por `notifType` se preservó línea por línea, ahora como fallback
exclusivo dentro de un `else`, para cualquier payload sin `role`
reconocido (Salón/Mozo/Empleado/Operaciones, y pushes viejos ya
encolados). El override explícito `data.icon`/`data.badge` del payload
(usado hoy sólo por `operaciones_order_cancelled`) sigue ganando
siempre — esa línea no se tocó. `notificationclick`, delivery,
subscription, fan-out, dedupe, tag, actions, urgency, TTL, permission,
auth: **nada de esto se modificó**.

Se agregaron 26 tests nuevos
(`src/lib/sw-push-role-icon-routing.test.ts`) que cargan el
`public/sw.js` REAL en un sandbox VM de Node (misma técnica exacta que
`src/lib/sw-push-dedupe.test.ts`, nunca una reimplementación) —
cobertura completa: los 3 roles core (Cliente/Negocio/Repartidor) ×
sus notifType realmente compartidos (order_update/review/chat/
new_order/account_update/new_delivery); 11 casos de fallback legacy
SIN `role`, cada uno verificado IDÉNTICO al comportamiento anterior a
este fix (salon_new_order, operaciones_salon_new_order,
mesa_order_ready, operaciones_order_cancelled ×2 áreas, new_order,
order_update, review, account_update, chat, new_delivery); un `role`
desconocido (`"superadmin"`) y un `role` `null` explícito, ambos
cayendo al fallback SIN lanzar excepción; y 2 tests de precedencia que
confirman que el override explícito de `data.icon`/`data.badge` sigue
ganando incluso con `role` presente. Se agregaron además 4 tests
directos en `src/lib/push.test.ts` —extendiendo el mock YA EXISTENTE
de `web-push` para capturar el payload JSON real enviado a
`webpush.sendNotification`, sin ninguna fixture de DB nueva— que
verifican `data.role = "cliente"/"negocio"/"repartidor"` exactamente
para cada `userType`, y su ausencia para `empleado` (rol sin PWA
"personal" en el modelo actual).

**Reproducción antes/después del bug físico exacto de R22**:
`R22_BUG_REPRO_BEFORE=FAIL_EXPECTED` / `R22_BUG_REPRO_AFTER=PASS` — los
3 casos documentados como rotos en R22 (Cliente+order_update →
mostraba ícono de Negocio; Negocio+chat → mostraba ícono de Cliente;
Repartidor+new_delivery → mostraba ícono de Cliente) ahora resuelven
cada uno a su propio ícono, confirmado en tests con nombres explícitos
que citan el bug original. Regresión negativa también verificada:
Negocio+new_order, Salón, y Mozo siguen resolviendo exactamente igual
que antes del fix.

Gate completo: suite Push 607/607 (577 baseline + 30 nuevos), PWA
focal 52/52 sin cambios (branding/manifests/identidad PWA no se
tocaron), ESLint limpio, TypeScript 24 raw idéntico a la baseline (0
nuevos, ninguno menciona los 3 archivos tocados), `git diff --check`
limpio, `next build` completo sin errores. `bun test` global no se
re-ejecutó (antecedente ambiental de `DATABASE_URL` ya documentado,
sin señal nueva que aportar).

`SW_CACHE_NAME_BUMP_REQUIRED_FOR_R22A=NO`, justificado técnicamente:
`CACHE_NAME` versiona el cache INTERNO de assets estáticos
(`caches.open(CACHE_NAME)`) — el propio SCRIPT `sw.js` nunca se sirve
desde ese cache; el navegador lo re-descarga y compara por su cuenta en
cada registro/chequeo periódico, independiente de `CACHE_NAME`. Este
fix no agrega, quita ni renombra ningún asset estático — permanece en
`deligo-v15`, sin tocar.

Stage selectivo de EXACTAMENTE 3 archivos (`public/sw.js`,
`src/lib/push.test.ts`, `src/lib/sw-push-role-icon-routing.test.ts`) —
el reporte de esta tarea permanece **untracked**; se preservó
explícitamente la convención histórica de `codex-reports/` local, SIN
generalizar el precedente puntual de Branding R1A (que trackeó un solo
reporte por autorización explícita de esa tarea específica).
`branding-source/`, `DELIGO_FULL_CONTEXT_LATEST.md` y `32` intactos.
Un solo commit (`ed58ca4`, parent `1d3f58a` verificado, sin `--amend`).
Push únicamente a `testing-codex` — `origin/testing-codex` confirmado
en `ed58ca4`.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets) —
deployment `34f5cf79-25bd-4d7a-855c-287d8bacdc4a` `SUCCESS`,
`meta.commitHash` == `ed58ca4` exacto (verificado vía `railway status
--json`, no asumido). Logs de boot limpios ("No pending migrations to
apply.", Next.js 16.1.3 "✓ Ready in 59ms"). Validación NO mutante
post-deploy: `GET /sw.js` → 200, contenido descargado y comparado
byte a byte contra el archivo local commiteado (`diff
--strip-trailing-cr`) — **idéntico** (única diferencia CRLF/LF de
transporte, sin significado); confirmado estáticamente en el archivo
servido (no por inferencia) que contiene los 3 selectores de rol
(`cliente`/`negocio`/`repartidor` → sus propios paths de ícono) y el
bloque legacy completo por `notifType`. Los 3 íconos de rol
(`icon-cliente/negocio/repartidor-192x192.png`) siguen respondiendo
200 `image/png`. Ninguna suscripción Push fue mutada. Ningún pedido fue
creado. Ningún Push real fue enviado. Production ("DeliGO") confirmado
sin cambios en el MISMO `railway status --json`.

**No se certifica físicamente** — `ANDROID_PUSH_NOTIFICATION_ICON_
ROUTING_FINDING=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION`.
Checklist de re-test entregado al operador, 3 casos (no se pide repetir
la matriz completa de 12 tipos):

1. **Android Cliente (obligatorio)**: Cliente con Push activo y un
   pedido en curso → Negocio cambia el estado (ej. PREPARANDO o
   EN_CAMINO) → debe llegar una Push `order_update` → verificar entrega
   SÍ, ícono NARANJA de Cliente (NO turquesa de Negocio), sin
   duplicados, tap al pedido correcto.
2. **Android Negocio (recomendado)**: Cliente envía un mensaje de chat
   → Negocio debe ver su propio ícono TURQUESA (no el naranja de
   Cliente).
3. **Android Repartidor (recomendado)**: evento `new_delivery` actual →
   Repartidor debe ver su propio ícono AZUL (no el naranja de Cliente).

Ninguna certificación funcional de Push preexistente se revoca —
iPhone los 3 roles, Android Cliente/Negocio/Repartidor: todos
`CERTIFIED_TESTING`/`PASS` sin cambios. Los findings preexistentes
(`PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN`, `SW_ICON_CACHE_BYPASS_
SUBSTRING_FINDING=OPEN_NON_BLOCKING`, badge monocromático inadecuado
—`ANDROID_MONOCHROME_BADGE_UX_TASK_REQUIRED=SI`, separado y NO resuelto
por este fix—, `DELIGO_BRANDING_R1_TESTING_DEPLOY_STATUS=DEPLOYED_
AWAITING_PHYSICAL_VISUAL_CHECK` —launcher/ícono instalado, un check
DISTINTO al de notificaciones, no mezclado—, y el finding de
`unsubscribe()` stale de R19R) quedan todos preservados sin tocar.

**P2-T31 SIGUE ABIERTO** — "R21 final"/closeout explícitamente NO se
ejecuta hasta la confirmación física del checklist de arriba. P2-T29
sigue `QUEUED`, no se inicia. Payments `DEFERRED`, no se inicia.
`GIT_DEPLOY_HISTORY.md` actualizado (localmente, untracked) con esta
entrada (SÍ hubo deploy). Reporte completo:
`codex-reports/P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ROLE_ICON_ROUTING_FIX_TESTING_DEPLOY.md`.

## 0.31 ESTADO ANTERIOR — P2-T31-R22: CAUSA RAÍZ DEL ROUTING DE ÍCONO DE NOTIFICACIÓN ANDROID PROBADA (notifType compartido entre roles, ignora data.role ya existente); FIX DISEÑADO, NO IMPLEMENTADO (2026-09-08) — FIX IMPLEMENTADO Y DESPLEGADO EN TESTING POR 0.32 ARRIBA

```text
HEAD=origin/testing-codex=1d3f58a1ea5487d254b51fa8627b5935065bce3a (sin cambios — R22 es read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R22_STATUS=ROOT_CAUSE_PROVEN_FIX_DESIGNED_NOT_IMPLEMENTED
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PROVEN (elevado desde OPEN/NOT_AUDITED)
ROOT_CAUSE_PRIMARY_CLASS=SHARED_NOTIFTYPE_USED_BY_MULTIPLE_ROLES_WITH_ROLE_UNSAFE_ICON_MAPPING / STATUS=PROVEN
SHARED_NOTIFTYPE_LIST=order_update(cliente+negocio+repartidor), review(cliente+negocio), chat(cliente+negocio)
CLIENT_EVENT_USING_NEGOCIO_ICON_BRANCH_FOUND=SI (3 de 5 eventos Cliente reales)
PAYLOAD_ROLE_FIELD_EXISTS=SI / PAYLOAD_ROLE_FIELD_DELIVERED_RELIABLY=SI / PAYLOAD_ROLE_FIELD_USED_FOR_ICON_SELECTION=NO
WRONG_ICON_PATH_GENERATED=SI (probado ejecutando el sw.js real en VM sandbox con payloads de forma real de producción) / CACHE_ROOT_CAUSE_PLAUSIBILITY=NO_EVIDENCE
IPHONE_EQUIVALENT_NOTIFICATION_ICON_BEHAVIOR=CORRECT (explicado: WebKit/Safari ignora NotificationOptions.icon y usa siempre el ícono de manifest de la PWA instalada — enmascara el mismo bug, no lo desmiente)
ANDROID_BADGE_CURRENTLY_ROLE_SAFE=NO (badge hereda el mismo valor incorrecto que icon)
RECOMMENDED_FIX_ARCHITECTURE=SW_USES_DATA_ROLE_AS_PRIMARY_ICON_SELECTOR_WITH_NOTIFTYPE_FALLBACK / BACKWARD_COMPATIBILITY_STATUS=SAFE_WITH_FALLBACK
PHYSICAL_RETEST_REQUIRED=SI (post-fix, no ejecutado ahora) / PHYSICAL_RETEST_EVENT=negocio cambia estado de un pedido activo de Cliente / PHYSICAL_RETEST_EXPECTED_ICON=/icon-cliente-192x192.png
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN (sin cambios) / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING (sin cambios)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3+1) / ANDROID_NEGOCIO_SHORT_SMOKE=PASS / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS (sin cambios, ninguna certificación funcional se revoca)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_FIX
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FIX
```

Tarea DEEP READ-ONLY PRODUCT AUDIT + ROOT-CAUSE CLASSIFICATION + TEST/
DESIGN PLAN — sin código, sin tests tracked, sin commit/push/deploy.
Se reconstruyó el pipeline Push completo end-to-end con evidencia de
código real en cada tramo: productor (`src/lib/push.ts`, ~15 fábricas
de payload) → `createNotification()`/`enrichedPushPayload` →
`webpush.sendNotification()` → `push` event de `public/sw.js` →
`self.registration.showNotification()`. Se inventariaron
exhaustivamente los 12 valores reales de `NotificationType`
(`src/lib/push.ts:41-53`) contra más de 20 call sites reales,
determinando el/los recipient(s) verdadero(s) de cada uno.

**Causa raíz PROBADA** (no plausible, no inferida — probada por
ejecución de código real): `order_update` —el tipo MÁS FRECUENTE que
un Cliente recibe, cubriendo TODO el ciclo de vida visible de su
pedido ("confirmó tu pedido", "en camino", "listo para retirar",
"entregado")— se comparte entre Cliente, Negocio Y Repartidor.
`public/sw.js` lo mapea INCONDICIONALMENTE al ícono de Negocio (misma
rama que `new_order`/`review`/`account_update`). El mismo patrón
aplica a `review` (compartido Cliente+Negocio, rompe para Cliente) y,
en dirección opuesta, a `chat` (compartido Cliente+Negocio, cae al
default Cliente, rompe para Negocio).

El campo que YA RESUELVE esto correctamente **ya existe en el
código**: `createNotification()` (`src/lib/push.ts:608-622`, desde
"Bugfix-4 [17]") agrega `data.role = personalRoleFor(userType)` a
TODO payload personal (cliente/negocio/repartidor) — diseñado
originalmente sólo para que `notificationclick` supiera qué app
abrir/enfocar, entregado de forma end-to-end probada y confiable
(`webpush.sendNotification` serializa el payload completo sin
pérdida). El `push` event handler que selecciona `icon`/`badge`
simplemente **nunca consulta `data.role`** — sólo mira
`data.data?.type`.

**Evidencia de ejecución real**: se cargó el `public/sw.js` GENUINO
(no una reimplementación) en un sandbox VM de Node — reutilizando
exactamente la técnica ya usada por `src/lib/sw-push-dedupe.test.ts` —
y se le alimentaron payloads con la forma EXACTA que produce
`enrichedPushPayload` en producción. Resultado: Cliente+order_update →
ícono de Negocio (reproduce EXACTAMENTE el finding físico reportado);
Cliente+review → ícono de Negocio (instancia NUEVA confirmada);
Negocio+chat → ícono de Cliente (instancia NUEVA confirmada, dirección
opuesta); Negocio+new_order/review → correctos; Cliente+chat/
review_request → correctos por coincidencia del default. El script de
reproducción vivió exclusivamente en el scratchpad de la sesión, nunca
dentro del repositorio.

**Descartado con evidencia directa** (no por omisión): (A) notifType
equivocado en el backend — el tipo es semánticamente correcto, el
problema es que se comparte; (B) override de icon/badge en el payload
— sólo 1 de 12 tipos lo tiene (`operaciones_order_cancelled`, no
relacionado); (E) binding equivocado de destinatario — el `userId`/
`userType` de cada call site apunta correctamente al Cliente/Negocio/
Repartidor real, el bug es posterior a una entrega ya correcta; (G)
atribución multi-PWA de Android — cada notificación se procesa según
su propio payload, sin mezcla de contexto entre las PWA instaladas;
(H) caché/asset viejo — el path incorrecto se genera en tiempo de
ejecución, probado, no son bytes viejos de un path correcto.

**Explicación de "iPhone correcto" — con fuente citada**: foros
oficiales de Apple Developer (`developer.apple.com/forums/thread/
740688`, "iOS Web Push - Passing in Icon Doesn't Work") documentan que
WebKit/Safari en iOS/iPadOS **ignora estructuralmente** el campo
`icon` de `showNotification()` y sustituye siempre el ícono de
manifest de la PWA instalada del destinatario. Esto explica con
precisión por qué iPhone se ve correcto pese al MISMO bug de código —
no es que iOS enrute bien, es que iOS ignora cualquier valor de `icon`
(correcto o incorrecto) y muestra siempre el ícono ya instalado.
Android, en cambio, SÍ honra fielmente `NotificationOptions.icon`
— por eso expone el bug y iPhone no.

**`badge`**: siempre hereda el mismo valor que `icon`
(`badge: data.badge || icon`, nunca un cómputo independiente) — mismo
origen, no una causa independiente. `ANDROID_BADGE_CURRENTLY_ROLE_
SAFE=NO`. El finding preexistente de badge monocromático inadecuado
(`NOTIFICATION_BADGE_STATUS=LEGACY_INADEQUATE_PRESERVED_NOT_FIXED`)
se preserva sin cambios, explícitamente como tarea de UX separada, no
mezclada con este fix de routing.

**Fix diseñado, NO implementado en R22** (tarea explícitamente
read-only): el `push` event de `sw.js` debe usar `data.data?.role`
como criterio PRIMARIO de selección de ícono
(cliente/negocio/repartidor → su propio ícono), cayendo al `if/else if`
por `notifType` actual COMPLETO como fallback únicamente para los
tipos que hoy no llevan `role` (salon/mozo/empleado/operaciones/
general). Menor blast radius que las alternativas evaluadas (payload
con icon canónico explícito por notificación, o dividir cada notifType
compartido en variantes role-specific) — un solo archivo, reutiliza un
campo YA probado. Backward compatibility explícita y fail-safe: SW
nuevo + payload viejo/sin `role` → mismo comportamiento de hoy exacto,
nunca un ícono roto/ausente; ningún delivery se ve afectado, sólo qué
ícono se muestra. Re-test físico diseñado (no ejecutado): Negocio
cambia el estado de un pedido activo de Cliente, verificar ícono
naranja de Cliente en Android.

**Gap de tests confirmado**: cero tests en todo el repo cubren
notifType→icon o role→icon — el único test que carga el `sw.js` real
(`sw-push-dedupe.test.ts`) sólo cubre el registro de dedupe D2. Matriz
completa de gaps en el reporte.

**Ninguna certificación funcional de Push se revoca** — este finding
es de branding visual, no de entrega física (que ya está probada y
completa: iPhone los 3 roles, Android Cliente/Negocio/Repartidor).
`PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN` y `SW_ICON_CACHE_BYPASS_
SUBSTRING_FINDING=OPEN_NON_BLOCKING` preservados sin cambios; el
finding preexistente de `unsubscribe()` stale (R19R) preservado sin
tocar. **P2-T31 SIGUE ABIERTO** — el siguiente paso es implementar el
fix (R22A), explícitamente NO "R21 final"/closeout. P2-T29 sigue
`QUEUED`, no se inicia. Payments `DEFERRED`, no se inicia. Sin
commit/push/deploy en esta tarea — `GIT_DEPLOY_HISTORY.md` no se
actualiza. Reporte completo:
`codex-reports/P2_T31_R22_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_ROOT_CAUSE_AUDIT.md`.

## 0.30 ESTADO ANTERIOR — DELIGO-BRANDING-R1A: BRANDING DESPLEGADO EN TESTING (COMMIT 1D3F58A), NUEVO FINDING DE ROUTING DE ÍCONO DE NOTIFICACIÓN ANDROID (OPEN), P2-T31 SIGUE ABIERTO (2026-09-08) — CAUSA RAÍZ PROBADA POR 0.31 ARRIBA

```text
HEAD=origin/testing-codex=1d3f58a1ea5487d254b51fa8627b5935065bce3a (Branding R1A — reemplaza a 39566e6 en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
DELIGO_BRANDING_R1A_STATUS=DEPLOYED_TESTING_EXACT_COMMIT_PENDING_PHYSICAL_VISUAL_CHECK_AND_ICON_ROUTING_AUDIT
BRANDING_REVIEW_PASS=SI (comparado contra Git/archivos reales, no sólo el reporte R1)
COMMIT_HASH=1d3f58a1ea5487d254b51fa8627b5935065bce3a / COMMIT_PARENT=39566e69647fd2b19453721214563a7b9a0ccc5e / COMMIT_MESSAGE=feat: refresh DeliGO role icons
STAGED_FILE_COUNT=15 (14 producto/test + codex-reports/DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md — PRIMER archivo jamás trackeado bajo codex-reports/, explícitamente autorizado por esta tarea)
TESTING_DEPLOYMENT_ID=976a7fa7-b607-40e2-8cb4-22907f005d22 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto de commitHash verificado)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
SMOKES_HTTP_PASS=16/16 (app + 5 manifests + 10 íconos, bytes idénticos al commit; manifest-operaciones sin icon-negocio; sw.js sirviendo deligo-v15)
FOCAL_TEST_PASS=52 / PUSH_TEST_PASS=577 (re-ejecutada por tocar sw.js) / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN / MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_DESIGN_DECISION / BLOCKS_TESTING_DEPLOY=NO / BLOCKS_FUTURE_PRODUCTION_CERTIFICATION=YES_UNTIL_DESIGN_OR_PHYSICAL_DECISION
SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=OPEN (NUEVO — Android Cliente mostró el ícono de Negocio en una notificación Push; iPhone equivalente correcto; ROOT_CAUSE=NOT_AUDITED)
P2_T31_CLOSEOUT_BLOCKED_BY_ANDROID_NOTIFICATION_ICON_ROUTING_AUDIT=YES
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3+1)
ANDROID_NEGOCIO_SHORT_SMOKE=PASS (segundo Android) / ANDROID_A_ABORTERROR_RESIDUAL_STATUS=DEVICE_OR_BROWSER_PROFILE_SPECIFIC_STRONGLY_SUPPORTED_NOT_GENERAL_DELIGO_BLOCKER / ANDROID_REPARTIDOR_SHORT_SMOKE=PASS
PUSH_PHYSICAL_ROLE_DELIVERY_CERTIFICATION_COMPLETE=SI
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_AUDIT_AND_FINAL_DIAGNOSTICS_CLOSEOUT
P2_T29_STATUS=QUEUED / PAYMENTS_WORK_STATUS=DEFERRED
NEXT_RECOMMENDED_ACTION=P2_T31_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_AUDIT
```

Tarea FINAL REVIEW + CONTROLLED COMMIT + PUSH + RAILWAY TESTING DEPLOY
+ NON-MUTATING SMOKES + CONTEXT RECONCILIATION, explícitamente
autorizada (`COMMIT_AUTHORIZED=SI`/`PUSH_AUTHORIZED=SI`/
`TESTING_DEPLOY_AUTHORIZED=SI`/`PRODUCTION_DEPLOY_AUTHORIZED=NO`).
Baseline verificado fresco (`HEAD=origin/testing-codex=39566e6`,
`origin/main=1de0d3c1`, coincidían exactamente). Se comparó cada
afirmación del reporte de Branding R1 contra Git y archivos reales sin
confiar ciegamente en él: los 10 PNG re-verificados con firma/dimensión
reales, ningún `icon192`/`icon512` compartido entre roles,
`manifest-operaciones.json` sin `icon-negocio`, `sw.js` sirviendo
`deligo-v15` — todo confirmado antes de tocar nada.

Gate re-ejecutado fresco: 52 tests focales PWA/icon en 0 fail, suite
Push completa (577 tests) en 0 fail (re-ejecutada por tocar `sw.js`),
ESLint limpio, TypeScript 24 raw idéntico a la baseline (0 nuevos),
`git diff --check` limpio, `next build` completo sin errores. Ningún
blocker real encontrado durante la review. Stage selectivo individual
de EXACTAMENTE 15 archivos — 14 de producto/test más el reporte
`DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`, explícitamente
autorizado dos veces por el texto de esta tarea. **Se deja constancia
expresa**: esto es el PRIMER archivo jamás trackeado bajo
`codex-reports/` en todo este repositorio (`git ls-files
codex-reports/` devolvía 0 archivos antes de este commit) — un cambio
de precedente respecto a la convención histórica de mantener esa
carpeta 100% local, seguido tal cual estaba escrito en la tarea, no
por inferencia propia. Ningún otro archivo de `codex-reports/`
(`CODEX_REPORT.md`, `ROADMAP.md`, etc.) se stageó — todos siguen
exclusivamente locales. `branding-source/` (ya en `.gitignore` desde
antes de esta sesión) y `DELIGO_FULL_CONTEXT_LATEST.md` permanecen
untracked; `32` intacto. Un solo commit (`1d3f58a`, parent `39566e6`
verificado, sin `--amend`). Push únicamente a `testing-codex` —
`origin/testing-codex` confirmado en `1d3f58a`.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets) —
deployment `976a7fa7-b607-40e2-8cb4-22907f005d22` `SUCCESS`,
`meta.commitHash` == `1d3f58a` exacto (verificado vía `railway status
--json`, no asumido). Logs de boot limpios ("No pending migrations to
apply.", Next.js 16.1.3 "✓ Ready in 65ms"). 16 smokes HTTP no mutantes
(`GET /` + 5 `manifest-{rol}.json` + 10 `icon-{rol}-{192,512}.png`) —
todos con bytes idénticos al archivo local commiteado, verificado
programáticamente; `manifest-operaciones.json` confirmado sin
`icon-negocio`; `sw.js` confirmado sirviendo `deligo-v15`. Production
("DeliGO") confirmado sin cambios en el MISMO `railway status --json`.

**Findings registrados** — 3 en total, ninguno resuelto por este
deploy:

1. `PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN` (preexistente de R1 — no
   bloquea TESTING, sí bloquea certificación de Production futura
   hasta una decisión de diseño; no se intentó "arreglar"
   creativamente, no se redibujó ni se inventó padding).
2. `SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING`
   (preexistente de R1 — el bump `v14`→`v15` ya desplegado es
   suficiente para ESTE refresh; el bug del substring roto en `sw.js`
   en sí sigue sin corregirse).
3. **`ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=OPEN`** (NUEVO,
   reportado por el operador durante esta tarea): en Android, una
   notificación Push destinada a Cliente se mostró con el ícono de
   Negocio; en iPhone el comportamiento equivalente fue correcto.
   **No se investigó ni se corrigió** — sólo se documentó, junto con
   el wiring de `sw.js` como evidencia de código para la próxima
   auditoría (que deberá trazar backend → `notifType` → actor/
   recipient → service worker → `NotificationOptions.icon`/`badge` →
   render Android). Un refresh de branding cambia el CONTENIDO visual
   de un ícono, nunca la lógica de qué ícono se elige — no se asume
   que este deploy arregló ni empeoró este bug. **Este finding bloquea
   el closeout final de P2-T31.**

**Estado físico Push reconciliado** — Android Negocio en un SEGUNDO
dispositivo (`PASS` completo: activación, foreground/background push
sin duplicados, contenido correcto, tap al pedido correcto) y Android
Repartidor (`PASS` completo, mismo patrón) confirmados por el
operador. La historia del Android con `AbortError` persistente
(R13/R18/R19A/R20) se preserva intacta, sin borrar ni reinterpretar —
queda como residual específico de dispositivo/perfil de navegador,
`STRONGLY_SUPPORTED` (no `CONFIRMED`), explícitamente NO un blocker
general de producto. Con esto, `PUSH_PHYSICAL_ROLE_DELIVERY_
CERTIFICATION_COMPLETE=SI` — la matriz funcional de entrega física de
Push por rol (Cliente/Negocio/Repartidor, Android + iPhone) queda
completa — pero el finding #3 de arriba mantiene P2-T31 abierto.

**P2-T31 SIGUE ABIERTO** — bloqueado específicamente por la auditoría
de routing de ícono de notificación Android; "R21 final" explícitamente
NO se ejecuta todavía. P2-T29 sigue `QUEUED`, no se inicia. Payments
`DEFERRED`, no se inicia. `GIT_DEPLOY_HISTORY.md` actualizado con esta
entrada (SÍ hubo deploy). Reporte completo:
`codex-reports/DELIGO_BRANDING_R1A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

**Próximo paso — checklist visual manual para el operador** (Android:
íconos de Cliente/Negocio/Repartidor/Operaciones/Admin instalados
correctamente, sin recortes por maskable; iPhone: spot-check de
Cliente/Negocio/Repartidor) — Claude no puede certificar esto
físicamente. NO se prueba todavía el routing de ícono en
notificaciones — eso es la próxima auditoría formal, no un check
visual de instalación.

## 0.29 ESTADO ANTERIOR — DELIGO-BRANDING-R1: NUEVOS ÍCONOS DE ROL INSTALADOS LOCAL, OPERACIONES DEJA DE PRESTAR EL ÍCONO DE NEGOCIO (2026-09-08) — TAREA INDEPENDIENTE DE P2-T31 — DESPLEGADO EN TESTING POR 0.30 ARRIBA

```text
HEAD=origin/testing-codex=39566e69647fd2b19453721214563a7b9a0ccc5e (sin cambios — sin commit en esta tarea)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
DELIGO_BRANDING_R1_STATUS=IMPLEMENTED_LOCAL_TESTED_PENDING_COMMIT_REVIEW
ICON_SOURCE_ASSETS_AVAILABLE=SI (tras un STOP inicial por BLOCKED_MISSING_SOURCE_ASSETS — el operador colocó los 5 PNG en branding-source/)
CLIENT/NEGOCIO/REPARTIDOR/ADMIN_ICON_REFRESHED=SI (mismo path de archivo de siempre, sólo contenido binario)
OPERACIONES_ICON_REFRESHED=SI (paths NUEVOS: icon-operaciones-192x192.png/512x512.png — ya NO reusa icon-negocio-*)
MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_DESIGN_DECISION (preexistente desde antes de esta tarea, no es una regresión — assets fuente 100% opacos, texto de rol muy cerca del borde, fondo no extensible sin inventar píxeles)
NOTIFICATION_ICON_CHANGED=SI (contenido, CERO cambio de wiring en sw.js) / NOTIFICATION_BADGE_CHANGED=NO (limitación preexistente documentada, no corregida)
SW_CACHE_VERSION_CHANGED=SI (deligo-v14 -> deligo-v15) — evidencia directa: el bypass de red "icon-192"/"icon-512" de sw.js NUNCA matchea ningún nombre de archivo real de ícono de rol
FOCAL_TEST_PASS=52 / FOCAL_TEST_FAIL=0 / PUSH_TEST_PASS=577 / PUSH_TEST_FAIL=0 (re-ejecutada completa por tocar sw.js)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI / BUILD_PASS=SI / BUILD_NEW_ERRORS=0
STAGE_PERFORMED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ANDROID_NEGOCIO_PERSISTENT_PUSHMANAGER_ABORTERROR_PENDING_PLATFORM_DEVICE_DIAGNOSTIC (SIN CAMBIOS — ver 0.28 abajo, tarea completamente independiente)
NEXT_RECOMMENDED_ACTION=DELIGO_BRANDING_R1_REVIEW_BEFORE_COMMIT_AND_TESTING_DEPLOY
```

Tarea AUDIT + LOCAL IMPLEMENTATION + TESTS + LOCAL REVIEW ONLY —
completamente independiente del epic de Push (P2-T31, sin ningún
cambio, ver la sección 0.28 más abajo). El operador entregó 5 assets
nuevos (`deligo {cliente,negocio,repartidor,admin,operaciones}.png`,
naranja/turquesa/azul/violeta/rojo respectivamente, todos 1254x1254)
para refrescar el branding de las 5 superficies PWA de rol. Bloqueó
inicialmente (`ICON_SOURCE_ASSETS_AVAILABLE=NO`) porque los 5 PNG
adjuntos directamente al chat no eran accesibles desde el filesystem
de la sesión — el operador los colocó en
`branding-source/` y la tarea se retomó EXACTAMENTE desde la
auditoría de integridad de assets, sin reiniciar ni cambiar alcance.

Auditoría de integridad: escaneo píxel-a-píxel completo de los 5
assets confirmó que son 100% opacos (`minAlpha=255` en absolutamente
todos los píxeles) pese a declarar un canal alfa — las esquinas
redondeadas y la sombra ya vienen "horneadas" en negro opaco, no como
transparencia real. Mismo perfil estructural que los PNG legacy que
reemplazan (que tampoco tenían canal alfa). Auditoría de wiring ANTES
de tocar nada confirmó que `role-config.ts` es la fuente única de
verdad de `icon192`/`icon512`/`manifestFile` por rol, y que 4 de los 5
roles objetivo (Cliente/Negocio/Repartidor/Admin) YA apuntaban cada
uno a su propio archivo — sólo Operaciones prestaba el ícono de Negocio
desde su alta como PWA (comentario preexistente explícito lo
documentaba: "no se generaron imágenes nuevas").

Se generaron los 10 derivados (192x192 + 512x512 por rol) con `sharp`
(ya presente en `package.json` — CERO dependencias nuevas), resize
directo sin recorte ni deformación (el origen ya es un cuadrado
perfecto). Para Cliente/Negocio/Repartidor/Admin se sobrescribió
CONTENIDO en el mismo path de archivo de siempre — cero cambio de
wiring en manifests/`role-config.ts`/`layout.tsx`/`sw.js` para esos 4
roles. Para Operaciones se crearon 2 archivos NUEVOS
(`icon-operaciones-192x192.png`/`512x512.png`) y se actualizaron
`role-config.ts` + `manifest-operaciones.json` para dejar de prestar
el ícono de Negocio — verificado con un test focal explícito que
ningún manifest de Operaciones contiene ya el substring `icon-negocio`.

Maskable icons: `MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_
DESIGN_DECISION` — inspección visual confirmó que el texto de rol
(NEGOCIO/REPARTIDOR/ADMIN/OPERACIONES) queda muy cerca del borde
inferior, probablemente fuera del círculo de safe-zone del 80% que
exige un ícono maskable real; generar un derivado seguro exigiría
inventar/extender el fondo degradado más allá de la forma ya
"horneada" con esquinas negras opacas — eso cruza a rediseño,
explícitamente prohibido. Se preservó exactamente el mismo patrón
preexistente (mismo archivo reusado para `any` y `maskable` en los 5
manifests) sin bloquear los íconos `any` por esto — no es una
regresión, es idéntico al estado anterior con contenido nuevo.

Favicon/Apple: sin cambios de wiring — `favicon.ico` se dejó intacto
(regenerar el `.ico` multi-resolución está fuera de alcance de un
simple resize y no es necesario, ya que `icon-cliente-192x192.png` ya
está declarado como entrada adicional y SÍ se refresca); el
apple-touch-icon sigue reusando `icon192` sin una variante 180x180
dedicada, exactamente el mismo wiring ya certificado físicamente en
iPhone (Cliente/Negocio/Repartidor `CERTIFIED_TESTING`, P2-T31) — no se
tocó para no arriesgar esa certificación.

Notificaciones: `sw.js` referencia los MISMOS paths de archivo de
siempre para seleccionar el `icon` por `notifType` — CERO línea de esa
lógica se tocó. Como consecuencia, las notificaciones de Cliente y
Negocio (los 2 únicos roles con rama propia en esa selección)
refrescan su branding automáticamente sin ningún cambio de código. Se
auditó y NO se corrigió (preexistente, fuera de alcance): Repartidor/
Admin/Operaciones no tienen rama propia y caen al ícono de Cliente por
defecto; `badge` siempre reusa el mismo valor que `icon` (nunca existió
un asset monocromático dedicado) — misma limitación estructural que
antes, sólo con el logo nuevo en vez del viejo. No se cambió la acción
"ANULAR SUSCRIPCIÓN" ni ningún copy/action de notificación.

**Hallazgo con evidencia directa**: la regla de `sw.js` que pretende
servir "manifest files or PWA icons" siempre desde red
(`includes("icon-192")`/`("icon-512")`) NUNCA matchea ningún nombre de
archivo de ícono de rol real (`"icon-cliente-192x192.png".includes(
"icon-192")` es `false`) — sin bump de `CACHE_NAME`, un cliente con el
ícono viejo ya cacheado lo seguiría sirviendo indefinidamente pese al
refresh. Se subió `CACHE_NAME` (`deligo-v14`→`deligo-v15`) con un
comentario que documenta esta evidencia exacta; el bug del substring en
sí NO se corrigió (fuera de alcance de un refresh de branding, deuda
técnica documentada para el futuro).

Gates: se agregó `src/lib/pwa-role-icon-contract.test.ts` (5 tests
nuevos) — 52 tests focales en 0 fail junto con los tests de identidad/
scope PWA existentes. Como se tocó `sw.js`, se re-ejecutó la suite Push
completa por ser P2-T31 un epic abierto: 577/577 verde, idéntico al
baseline, cero regresiones. ESLint limpio; TypeScript 24 raw idéntico a
la baseline vigente (0 nuevos); `git diff --check` limpio; `next
build` completo sin errores. Un `bun test` global mostró 227 fallos/3
errores 100% pre-existentes y ambientales (`DATABASE_URL` no
configurado en este entorno local) — ninguno relacionado con archivos
de esta tarea.

**Git**: cero stage/commit/push/deploy. 8 PNG modificados in-place + 2
PNG nuevos + `manifest-operaciones.json`/`role-config.ts`/`sw.js`
modificados + 1 test nuevo, todo revisado línea por línea
(`git diff --name-status`/`--stat`/`--check`). `32` no fue tocado en
ningún momento. Reporte completo:
`codex-reports/DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`.

**P2-T31 SIN CAMBIOS** — esta tarea no tocó ninguna lógica de
suscripción/entrega/retry de Push, no avanza ni certifica nada del
epic. El estado de Android Negocio/Repartidor y el resto de marcadores
de P2-T31 se preservan literalmente como R20 los dejó (sección 0.28
abajo).

## 0.28 ESTADO ANTERIOR — R20: AMBOS INTENTOS FÍSICOS DE R19A FALLARON CON ABORTERROR, CAUSA DE PLATAFORMA ELEVADA A STRONGLY_SUPPORTED, PENDIENTE CONTROL EXTERNO (2026-09-08) — P2-T31 SIN CAMBIOS, VER 0.29 ARRIBA (TAREA DE BRANDING INDEPENDIENTE)

```text
HEAD=origin/testing-codex=39566e69647fd2b19453721214563a7b9a0ccc5e (sin cambios — R20 es read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R20_STATUS=ANDROID_NEGOCIO_PERSISTENT_ABORTERROR_AUDITED_SOURCE_LEVEL_RULED_OUT_PLATFORM_CAUSE_STRONGLY_SUPPORTED_PENDING_EXTERNAL_CONTROL_DIAGNOSTIC
R19A_RUNTIME_ON_DEVICE=CONFIRMED / R19A_ABORT_RECOVERY_EXECUTED=SI / R19A_POST_ABORT_RECHECK_RESULT=NO_SUBSCRIPTION_FOUND
R19A_SECOND_PHYSICAL_ATTEMPT_EXECUTED=SI / R19A_SECOND_PHYSICAL_ATTEMPT_RESULT=ABORTERROR / R19A_PHYSICAL_MITIGATION_RESULT=FAIL
BACKEND_SUBSCRIBE_REACHED=NO / R13A_FAILURE_STATE_CONTRACT_PHYSICAL_RESULT=PASS
MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION=2 (congelado, sin tercer retry)
VAPID_MALFORMATION_STILL_PLAUSIBLE=NO / VAPID_ENV_MISMATCH_STILL_PLAUSIBLE=NO (key en vivo: 87 chars b64url, 65 bytes, primer byte 0x04, sin rotación registrada jamás)
SERVICE_WORKER_APPLICATION_LEVEL_CAUSE_STATUS=NOT_PROVEN_LOW_PLAUSIBILITY
ABORTERROR_UNDERLYING_CAUSE_STATUS=STRONGLY_SUPPORTED_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE (elevado desde NOT_PROVEN_PLAUSIBLE, criterio de 4 niveles explícito — NO se declara CONFIRMED)
PWA_REINSTALL_ALREADY_TESTED=SI (no se pide otra reinstalación)
EXTERNAL_WEB_PUSH_CONTROL_TEST_RECOMMENDED=SI / EXTERNAL_CONTROL_EXPECTED_DISCRIMINATION=ALTA
FURTHER_DELIGO_CODE_CHANGE_JUSTIFIED_NOW=NO
NEXT_PHYSICAL_DIAGNOSTIC_ACTION=EXTERNAL_WEB_PUSH_CONTROL_TEST_VIA_WEB_PUSH_CODELAB_GLITCH_ME
NEXT_DELIGO_PUSH_TOGGLE_ACTION=BLOCKED_UNTIL_DIAGNOSTIC_RESULT
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3+1)
ANDROID_NEGOCIO_SMOKE=FAIL_PHYSICAL_SUBSCRIPTION_CREATE_ON_R19A_AFTER_TWO_ABORTERROR_ATTEMPTS / ANDROID_REPARTIDOR_SMOKE=NOT_STARTED
P2_T31_STATUS=IN_PROGRESS_ANDROID_NEGOCIO_PERSISTENT_PUSHMANAGER_ABORTERROR_PENDING_PLATFORM_DEVICE_DIAGNOSTIC
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO / PRODUCTION_TOUCHED=NO
```

Tarea DEEP READ-ONLY ROOT-CAUSE + PLATFORM/DEVICE DIAGNOSTIC DESIGN —
sin código, sin tests, sin commit/push/deploy. El primer retest físico
válido del build R19A (commit `39566e6`) ejecutó exactamente la
mitigación diseñada por R19/R19R: recheck defensivo
(`SUBSCRIBE_ABORT_RECHECK_RESULT found=false`) autorizó el único retry
permitido, y el retry TAMBIÉN falló con `AbortError` (~290ms el primer
intento, ~510ms el retry) — exactamente 2 llamadas reales a
`registration.pushManager.subscribe()`, el límite exacto respetado, sin
que ningún request HTTP saliera hacia el backend de DeliGO en ningún
momento. El contrato de failure-state de R13A se verificó PASS completo
de nuevo (`SUBSCRIBE_FINISH subscribed=false`, registry liberado, sin
éxito falso, switch final OFF).

Se reauditó exhaustivamente la matriz completa de precondiciones
source-level del punto exacto de `subscribe()` (forma/conversión/
longitud/contenido de la VAPID key, origen, `ServiceWorkerRegistration`,
scope, worker activo, secure context, permiso, user gesture, timing,
same-origin, ausencia de subscription previa ambigua) — todas PASS, con
evidencia directa de código/snapshot/spec, ninguna asumida. Se hizo un
`GET /api/push/vapid-key` real (lectura pública, no mutante) contra
TESTING y se decodificó la key vigente localmente SIN imprimirla: 87
caracteres base64url → 65 bytes decodificados, primer byte `0x04`
(formato EC P-256 sin comprimir canónico, exactamente el que exige
`PushManager.subscribe()`) — descarta malformación con evidencia
directa. `GIT_DEPLOY_HISTORY.md` no registra ninguna rotación de VAPID
jamás — descarta mismatch de entorno; la MISMA key sirvió con éxito
para Android Cliente y los 3 roles de iPhone, todos `CERTIFIED_TESTING`,
en el mismo periodo.

Investigación de Chromium/Push API con fuentes 2025-2026 (Opera forums,
`firebase/firebase-js-sdk#7748`/`#7764`, GitLab Gitter webapp#1892,
MDN): confirmado por múltiples fuentes independientes que
`PushManager.subscribe()` en Chrome/Android envía internamente una
solicitud HTTPS a `android.clients.google.com/c2dm/register3` (registro
FCM de Google) — un fallo en ESA solicitud interna es lo que Chrome
expone a la página como `AbortError`, nunca como `NetworkError` propio.
El issue `firebase-js-sdk#7748` documenta un caso completamente ajeno a
DeliGO (Pixel 6, Android 14, Chrome 118) con el MISMO síntoma exacto —
funciona en desktop, falla en mobile con el mismo código — cerrado sin
causa raíz aislada ni siquiera por el propio equipo de Firebase.

Con 4 ocurrencias totales de `AbortError` ya documentadas en todo el
epic (R13 Cliente, R18 Negocio, y estos 2 intentos de R19A — 3 de las 4
en el MISMO dispositivo/rol Negocio, pese a una reinstalación completa
de la PWA que, auditada en detalle, NO tiene razón estructural para
tocar la capa de Chrome/Play Services/FCM donde vive la causa
plausible), se introdujo un criterio explícito de 4 niveles
(`NOT_PROVEN`/`PLAUSIBLE`/`STRONGLY_SUPPORTED`/`CONFIRMED`, nuevo
invariante en `DECISIONS_AND_INVARIANTS.md`) y se elevó
`ABORTERROR_UNDERLYING_CAUSE_STATUS` de `NOT_PROVEN_PLAUSIBLE` a
`STRONGLY_SUPPORTED` — deliberadamente SIN llegar a `CONFIRMED`, que
exigiría una prueba de control independiente que todavía no se hizo.

`FURTHER_DELIGO_CODE_CHANGE_JUSTIFIED_NOW=NO` — la matriz de
precondiciones agotó lo auditable desde DeliGO sin ningún hallazgo, la
VAPID vigente es correcta y no rotada, y la mitigación de retry ya
implementada se ejecutó exactamente como fue diseñada y falló en el
mismo punto — cualquier cambio de código adicional ahora sería adivinar
una causa que la evidencia sitúa fuera de la aplicación. No se agrega
tercer retry, timeouts inventados, reset de SW/permisos, ni hacks
Android.

**Siguiente paso — UN solo diagnóstico físico, no un toggle de DeliGO**:
Leonardo debe abrir `https://web-push-codelab.glitch.me` (demo oficial
de `GoogleChromeLabs`, sin login, sin datos personales, sin instalar
ningún APK) en Chrome, en el MISMO dispositivo Android donde falló
Negocio, y tocar "Subscribe" una única vez. Si esa web —origin
completamente distinto, sin ninguna relación de código con DeliGO—
TAMBIÉN falla con `AbortError`, la causa quedaría `CONFIRMED` como de
plataforma/dispositivo. Si esa web suscribe con éxito, reabriría una
auditoría dirigida a algo específico del origin de DeliGO en ese
navegador (no una repetición ciega del mismo retry). Un checklist de
apoyo (fecha/hora automática, Google Play Services, restricciones de
batería/datos de Chrome, VPN/Private DNS/adblock) queda documentado
como respaldo, ordenado por poder de discriminación, pero el control
externo es el paso de mayor prioridad. `NEXT_DELIGO_PUSH_TOGGLE_ACTION=
BLOCKED_UNTIL_DIAGNOSTIC_RESULT` — no se le pide a Leonardo ningún otro
toggle de DeliGO antes de ese resultado.

**P2-T31 SIGUE ABIERTO** — ningún estado certificado previamente se
revoca (iPhone los 3 roles, Android Cliente). Android Negocio queda
`FAIL_PHYSICAL_SUBSCRIPTION_CREATE_ON_R19A_AFTER_TWO_ABORTERROR_
ATTEMPTS`; Android Repartidor sigue `NOT_STARTED`. P2-T29 y Mercado
Pago no se inician. Sin deploy en esta tarea —
`GIT_DEPLOY_HISTORY.md` no se actualiza. Reporte completo:
`codex-reports/P2_T31_R20_ANDROID_PERSISTENT_ABORTERROR_ROOT_CAUSE_DEVICE_DIAGNOSTIC.md`.

## 0.27 ESTADO ANTERIOR — R19A: MITIGACIÓN COMPLETA DE ABORTERROR DESPLEGADA EN TESTING (COMMIT 39566E6), PENDIENTE RETEST FÍSICO ÚNICO (2026-09-08) — AMBOS INTENTOS DEL RETEST FÍSICO FALLARON, VER 0.28 ARRIBA

```text
HEAD=origin/testing-codex=39566e69647fd2b19453721214563a7b9a0ccc5e (R19A — reemplaza a d7cc66d en TESTING)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R19A_STATUS=DEPLOYED_TESTING_EXACT_COMMIT_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
FINAL_DIFF_REVIEW_PASS=SI (coincide exactamente con R19/R19R/R19R1 auditados, cero cambios funcionales nuevos)
PRECOMMIT_PUSH_TEST_PASS=577 / PRECOMMIT_PUSH_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0
STAGED_FILE_COUNT=4 / UNEXPECTED_STAGED_FILES=0
COMMIT_HASH=39566e69647fd2b19453721214563a7b9a0ccc5e / COMMIT_PARENT=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 / COMMIT_MESSAGE=fix: harden push subscription recovery
TESTING_DEPLOYMENT_ID=425ff95a-5a2e-4d70-9dd1-fbae6df5ce19 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto de commitHash verificado)
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_UNCHANGED=SI (servicio "DeliGO", branch main, mismo commitHash, verificado en el mismo railway status --json)
TESTING_APP_HTTP_SMOKE=PASS / TESTING_NON_MUTATING_SMOKE=PASS / ANDROID_PHYSICAL_MITIGATION_CERTIFIED=NO
UNSUBSCRIBE_STALE_BIND_FINDING_PRESERVED=SI / UNSUBSCRIBE_CHANGED_IN_R19A=NO
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios) / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3)
ANDROID_NEGOCIO_SMOKE=FAIL_AT_ACTIVATION_ABORTERROR (histórico) / ANDROID_REPARTIDOR_SMOKE=NOT_STARTED
P2_T31_STATUS=IN_PROGRESS_R19A_DEPLOYED_TESTING_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST_AND_ANDROID_REPARTIDOR_SMOKE
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=ANDROID_NEGOCIO_SINGLE_ACTIVATION_RETEST_WITH_TRACE_ARMED_ON_R19A_BUILD
```

Tarea IMPLEMENTATION+COMMIT+PUSH+TESTING DEPLOY, explícitamente
autorizada por el operador (Production NO autorizada). Baseline
verificado fresco (`HEAD=origin/testing-codex=d7cc66d`,
`origin/main=1de0d3c1`, coincidían exactamente). Se leyó completo el
diff real de los 2 archivos tracked (`use-push-notifications.ts`,
`use-push-notifications-static-contract.test.ts`) y el contenido
íntegro de los 2 tests nuevos — confirmado punto por punto contra R19
(máx. 2 intentos, retry sólo `AbortError`, recheck obligatorio,
fail-closed ante ambigüedad, sin delay, sin rama de plataforma, backend
una vez, R13A preservado), R19R (guard `gate.isCurrent(opId)` sin
`await` de por medio, stale = backend 0/sin toast/subscription
intacta), y R19R1 (SET=1/RELEASE=1/entrada final ausente, flujo stale y
normal) — **cero cambios funcionales nuevos**.

Gate re-ejecutado fresco: 577 tests focales en 0 fail, ESLint limpio en
los 4 archivos exactos, TypeScript idéntico a la baseline (24 raw/18
distintos, 0 nuevos), `git diff --check` limpio. Stage selectivo
individual de exactamente 4 archivos — `git diff --cached
--name-status` confirmó el fileset exacto antes de commitear, sin
ningún archivo inesperado (ni reportes, ni `DELIGO_FULL_CONTEXT_
LATEST.md`, ni `.claude/skills/**`, ni `32`). Commit único (`39566e6`,
parent `d7cc66d` verificado, sin `--amend`, sin `Co-Authored-By`). Push
a `testing-codex` (nunca `main`, sin `--force`) — `origin/testing-codex`
confirmado en `39566e6`.

Autodeploy Git-triggered normal a "DeliGO Copy" (sin `railway up`, sin
mutar variables/domains/DB/service settings/replicas/VAPID/secrets),
poll directo y finito: deployment `425ff95a-5a2e-4d70-9dd1-fbae6df5ce19`
`SUCCESS`, instancia `RUNNING`, `meta.commitHash` == `39566e6` exacto
(verificado vía `railway status --json`, no asumido). Logs de build
(imagen exportada/pusheada sin error) y de boot ("No pending
migrations to apply.", Next.js "✓ Ready in 67ms") limpios, sin
error/fatal/unhandled/500. Smokes NO destructivos: `/` → 307 a
`/cliente/` (normal), `/cliente/` → 308 (normalización de slash,
normal), `/negocio` → 200, `/repartidor` → 200, `GET /api/push/
debug-guard` → `200 {"allowed":true}` (lectura), `GET /api/push/
vapid-key` → `200` (lectura pública) — deliberadamente NUNCA se
ejecutó `POST /api/push/subscribe` (sería una mutación). En el MISMO
`railway status --json`, el servicio Production ("DeliGO", `branch:
main`) confirmó `commitHash: 1de0d3c153eaf3be068adeb004ea43feb42fc40e`
— sin cambios.

**`ANDROID_PHYSICAL_MITIGATION_CERTIFIED=NO`** — este deploy pone la
mitigación completa (retry acotado + guard stale-actor + cobertura
explícita de registry) disponible en TESTING, pero NO la certifica
físicamente. El hallazgo lateral de `unsubscribe()` (mismo patrón de
fetch incondicional, sin retry que lo haga relevante hoy) se preservó
sin corregir, sin expandir este commit.

**Siguiente acción — UN solo retest físico**: Leonardo debe esperar
confirmación de este deploy exacto (`39566e6` en "DeliGO Copy") antes
de reintentar. Con la traza de diagnóstico armada, activar el switch de
Negocio UNA sola vez y observar uno de 3 caminos: (A) éxito directo sin
retry; (B) `AbortError` recuperado automáticamente vía el retry
(`SUBSCRIBE_ABORT_RECHECK_*` → `SUBSCRIBE_PHYSICAL_RETRY_*` → backend
success → switch ON); (C) ambos intentos fallan → `SUBSCRIBE_FINISH
subscribed=false` → switch OFF → error seguro (failure-state de R13A).
**El camino C NO sería una certificación** — requeriría una nueva
auditoría, no una repetición ciega del mismo retest. No se le pide a
Leonardo más de un intento en este paso.

**P2-T31 SIGUE ABIERTO** — por Android Negocio (pendiente el retest
físico único) y Android Repartidor (smoke `NOT_STARTED`), además de
las matrices de Android Negocio/Repartidor no ejecutadas formalmente
(iPhone de los 3 roles ya certificado, preservado sin cambios). P2-T29
y Mercado Pago no se inician. `codex-reports/GIT_DEPLOY_HISTORY.md`
actualizado con esta entrada (SÍ hubo deploy). Reporte completo:
`codex-reports/P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## 0.26 ESTADO ANTERIOR — R19R1: EVIDENCIA EXPLÍCITA DE MUTATION REGISTRY SET/RELEASE, CERO CAMBIOS DE PRODUCTO, TESTS VERDES (2026-09-08) — DESPLEGADO EN TESTING POR 0.27 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (sin cambios — R19R1 es TEST-ONLY)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R19R1_STATUS=EXPLICIT_MUTATION_REGISTRY_SET_RELEASE_COVERAGE_ADDED_TESTS_GREEN_PENDING_REVIEW_AND_DEPLOY
MUTATION_REGISTRY_SET_COUNT_STALE_ABORT_RETRY=1 / MUTATION_REGISTRY_RELEASE_COUNT_STALE_ABORT_RETRY=1 / MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_STALE_ABORT_RETRY=NO
MUTATION_REGISTRY_SET_COUNT_NORMAL_SUCCESS=1 / MUTATION_REGISTRY_RELEASE_COUNT_NORMAL_SUCCESS=1 / MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_NORMAL_SUCCESS=NO
STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0 (preservado)
PRODUCT_CODE_CHANGED_IN_R19R1=NO / TEST_CODE_CHANGED_IN_R19R1=SI (1 archivo existente extendido, sin archivos nuevos)
FOCAL_TEST_PASS=577 / FOCAL_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0
PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ABORTERROR_MITIGATION_AND_STALE_ACTOR_GUARD_IMPLEMENTED_LOCALLY_PENDING_COMMIT_DEPLOY_AND_ANDROID_ROLE_RETESTS (sin cambios)
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

TEST-ONLY LOCAL CLOSEOUT — **cero cambios de código de producto**. R19R
(0.25 abajo) había demostrado que `gate.begin()` se llama exactamente
1 vez en el flujo compuesto creación+bind — evidencia INDIRECTA de una
sola operación de alto nivel. El TEST 8 de su propio mandato pedía
explícitamente `MUTATION_REGISTRY_SET`/`MUTATION_REGISTRY_RELEASE`
contados DIRECTAMENTE en la ruta compuesta nueva
(stale-durante-el-retry-de-AbortError) — esa discrepancia de evidencia
queda cerrada en esta tarea.

Se extendió `use-push-notifications-stale-actor-backend-guard.test.ts`
(sin archivos nuevos) con un harness TEST-ONLY
(`runLikeSubscribeHighLevelOperation`) que compone, en el mismo orden
que `subscribe()` propio, las 3 funciones REALES ya exportadas:
`createPhysicalPushSubscriptionWithAbortRecovery` (R19),
`bindPhysicalPushSubscriptionToBackend` (R19R), y
`registerInFlightPersonalPushMutation` (R2, el registry REAL de
`push-mutation-in-flight-registry.ts` — **nunca mockeado**). No es un
mock que reproduce el resultado deseado — cada función interna es la
implementación real ya probada por su propia suite; el harness sólo
provee el mismo pegamento secuencial que el closure de `subscribe()`
ya provee gratis. Ningún export nuevo de producción fue necesario (las
3 funciones ya eran públicas).

Test 1 (el que faltaba): la operación arranca (SET síncrono
confirmado), primer intento físico → `AbortError`, recheck → `null`,
segundo intento físico queda GENUINAMENTE pendiente (confirmado con
`hasInFlightPersonalPushMutationForDebug === true` en ese instante), el
actor se invalida MIENTRAS sigue pendiente, el intento resuelve con
éxito DESPUÉS, el bind se salta por stale (`backend.calls.length===0`,
sin cambios) — resultado: `SET=1`, `RELEASE=1`, entrada final ausente.
Test 2: mismo harness para el camino normal exitoso, mismo contrato de
limpieza — sin duplicar toda la suite.

Ni `createPhysicalPushSubscriptionWithAbortRecovery` ni
`bindPhysicalPushSubscriptionToBackend` fueron tocadas — confirmado por
un `git diff --stat` de `use-push-notifications.ts` IDÉNTICO al que
R19R dejó (cero cambios netos de esta tarea). No apareció ningún bug
real durante esta cobertura. **577 tests focales en 0 fail** (575
previos + 2 nuevos, mismos 33 archivos, sin archivos nuevos), ESLint
limpio, TypeScript idéntico a la baseline (24 raw/18 distintos, 0
nuevos). Se preservó la misma precisión sobre `git diff --check` no
cubriendo contenido untracked — validado por ESLint + ejecución real +
revisión manual de whitespace.

**Hallazgo lateral de `unsubscribe()`** (documentado por R19R):
preservado sin corregir, fuera de alcance de esta tarea.

**P2-T31 SIGUE ABIERTO.** Ningún blocker nuevo se creó ni se resolvió
— esta tarea sólo cerró una discrepancia de evidencia sobre trabajo ya
implementado en R19/R19R. P2-T29 y Mercado Pago no se inician. Sin
commit/push/deploy en ningún momento; `COMPLETED_TASKS.md` y
`GIT_DEPLOY_HISTORY.md` no fueron tocados. Se preserva la corrección
documental de R19: "el contrato de failure-state de R13A quedó
físicamente confirmado en runtime real de TESTING, nunca en
Production." Reporte completo:
`codex-reports/P2_T31_R19R1_EXPLICIT_MUTATION_REGISTRY_COVERAGE.md`.

## 0.25 ESTADO ANTERIOR — R19R: GAP STALE-ACTOR/BACKEND CERRADO, RETRY DE R19 PRESERVADO, TESTS VERDES, SIN DEPLOY (2026-09-08) — EVIDENCIA DE TEST 8 COMPLETADA POR 0.26 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R19R es implementación LOCAL, sin commit)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R19R_STATUS=STALE_ACTOR_BACKEND_GUARD_IMPLEMENTED_TESTS_GREEN_PENDING_REVIEW_AND_DEPLOY
PRE_BACKEND_STALE_OPERATION_GUARD_EXISTS_BEFORE_R19R=NO / PREEXISTING_STALE_BACKEND_BIND_GAP_EXPOSED_DURING_R19_REVIEW=SI
STALE_ACTOR_GUARD_IMPLEMENTED=SI / STALE_ACTOR_GUARD_SOURCE=OP_ID_ONLY
STALE_DURING_ABORT_RETRY_TEST=PASS / STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0 / STALE_AFTER_FIRST_PHYSICAL_SUCCESS_BACKEND_CALL_COUNT=0
ABORTERROR_RETRY_MAX_ATTEMPTS=2 (sin cambios) / R13A_FAILURE_STATE_CONTRACT_PRESERVED=SI / DOUBLE_BACKEND_REGISTER_POSSIBLE=NO
FOCAL_TEST_PASS=575 / FOCAL_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0
PRODUCT_CODE_CHANGED=SI (local, sin commit) / BACKEND_CHANGED=NO / SCHEMA_CHANGED=NO / DEPENDENCIES_CHANGED=NO / PRODUCTION_TOUCHED=NO
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios) / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3)
P2_T31_STATUS=IN_PROGRESS_ABORTERROR_MITIGATION_AND_STALE_ACTOR_GUARD_IMPLEMENTED_LOCALLY_PENDING_COMMIT_DEPLOY_AND_ANDROID_ROLE_RETESTS
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

R19 (0.24 abajo) ya había reconocido honestamente un gap al validarse
a sí mismo: el `POST /api/push/subscribe` en `subscribe()` corría
**incondicionalmente** respecto al gate de operación — nada
verificaba `gate.isCurrent(opId)` ANTES del `fetch`; sólo
`finishMutation`, DESPUÉS de que el request ya había salido, decidía
si el resultado se aplicaba a la UI. Con la ventana de R19 (hasta 2
intentos físicos + un recheck defensivo, todos `await`-eados en
secuencia) esa ventana se hizo más larga — pero el gap en sí **no es
nuevo de R19**: existía ya para el caso de un solo intento, y se
reconoce honestamente como tal
(`PREEXISTING_STALE_BACKEND_BIND_GAP_EXPOSED_DURING_R19_REVIEW=SI`,
nunca presentado como bug introducido por R19).

Se implementó `bindPhysicalPushSubscriptionToBackend` (nueva,
exportada en `src/hooks/use-push-notifications.ts`, mismo patrón de
dependencias inyectadas que `checkPersonalPushStatus`): verifica
`gate.isCurrent(opId)` — la MISMA autoridad canónica que
`finishMutation` ya usa en todo el archivo (los cambios de actor
enrutan exclusivamente por `gate.invalidate()`, nunca por una
comparación de identidad separada — `STALE_ACTOR_GUARD_SOURCE=
OP_ID_ONLY`, sin duplicar autoridad) — como la ÚLTIMA sentencia
síncrona antes de construir la URL y llamar al backend, con **cero
`await`** entre el guard y el request de red (auditado explícitamente:
nada puede ceder el control al event loop en esa ventana). Si la
operación quedó stale: `posted:false` — **sin backend POST, sin toast,
sin estado ON, sin inventar un error técnico** — resuelve por el mismo
`finishMutation(opId, false)` que cualquier otra rama stale del
archivo ya usa. La `PushSubscription` física NUNCA se destruye por
quedar stale — pertenece al browser/origin, el actor que sucede a la
operación la reconcilia por su propio flujo normal.
`createPhysicalPushSubscriptionWithAbortRecovery` (R19) **no fue
tocada** — cero líneas modificadas; el retry (máximo 2 intentos, sólo
`AbortError`, recheck obligatorio, sin delay) queda exactamente igual.

**TEST 9 del mandato original de R19, ahora determinista** (nuevo
archivo `use-push-notifications-stale-actor-backend-guard.test.ts`):
compone el `LatestOperationGate` REAL con la función de retry REAL de
R19, controlando el timing exacto — el segundo intento físico queda
GENUINAMENTE pendiente (una promesa real, no simulada), el test invoca
`gate.invalidate()` mientras sigue pendiente, LUEGO el intento resuelve
con éxito, y se confirma `backend.calls.length === 0` — la operación
nunca escribe el binding aunque el segundo intento físico haya tenido
éxito. Un test adicional (`spyOnGateBegin`) prueba dinámicamente que
ni la creación ni el bind mintan una segunda operación de alto nivel
(`gate.begin()` llamado exactamente 1 vez en todo el flujo). Un test
paralelo prueba el mismo gap para el camino SIN `AbortError` (éxito
inmediato en el primer intento, actor stale antes del backend) — 6
conteos exactos de llamadas a backend quedan afirmados con tests
reales, no sólo grep.

**575 tests focales en 0 fail** (33 archivos `*push*.test.ts`), ESLint
limpio, TypeScript idéntico a la baseline vigente (24 raw/18
distintos, 0 nuevos), `git diff --check` limpio sobre los archivos
TRACKED. Se corrigieron 2 assertions preexistentes de
`use-push-notifications-static-contract.test.ts` cuya ubicación
literal cambió por el refactor (la invariante que protegen — URL
construida desde `actorType` con la misma forma ternaria, `fetch`
consume la variable calculada nunca un literal, guardia contra el
mutante histórico M9 — sigue exactamente igual, sólo cambió la
ubicación literal del código real). **Precisión documental explícita**:
`git diff --check` no cubre contenido untracked — el archivo de test
nuevo se validó por ESLint limpio + ejecución real con éxito +
revisión manual de whitespace, nunca declarado como cubierto por Git.

**Hallazgo lateral, no corregido**: `unsubscribe()` tiene el mismo
patrón de `fetch` incondicional respecto al gate, pero sin ningún
retry que lo haga relevante hoy (nunca reintenta nada) — documentado
para no perderlo, sin expandir el alcance de esta tarea.

Ningún test/deploy/prueba física certifica todavía que la mitigación
completa (retry + guard stale-actor) resuelve el `AbortError` real en
el dispositivo de Leonardo — sólo prueba que el algoritmo completo se
comporta exactamente como se diseñó. La certificación real requiere el
ciclo commit→deploy→smoke→retest físico de Android Negocio (tarea
separada, `R19A`, no ejecutada aquí). **P2-T31 SIGUE ABIERTO.** P2-T29
y Mercado Pago no se inician. Sin commit/push/deploy en ningún
momento; `COMPLETED_TASKS.md` y `GIT_DEPLOY_HISTORY.md` no fueron
tocados. Se preserva la corrección documental de R19: "el contrato de
failure-state de R13A quedó físicamente confirmado en runtime real de
TESTING, nunca en Production." Reporte completo:
`codex-reports/P2_T31_R19R_ABORTERROR_RETRY_STALE_ACTOR_BACKEND_GUARD.md`.

## 0.24 ESTADO ANTERIOR — R19: MITIGACIÓN DE RETRY ÚNICO PARA ABORTERROR IMPLEMENTADA LOCALMENTE, TESTS VERDES, SIN DEPLOY (2026-09-08) — GAP STALE-ACTOR/BACKEND CERRADO POR 0.25 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R19 es implementación LOCAL, sin commit)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R19_STATUS=ABORTERROR_SINGLE_RETRY_MITIGATION_IMPLEMENTED_LOCALLY_TESTS_GREEN_PENDING_REVIEW_AND_DEPLOY
ANDROID_NEGOCIO_MANUAL_RETRY_STATUS=FAIL_ABORTERROR (2da recurrencia consecutiva, proceso nuevo, backend nunca alcanzado)
MANUAL_RETRY_ONLY_STRATEGY=INSUFFICIENT / ANDROID_ABORTERROR_MITIGATION_REQUIRED_BEFORE_T31_CLOSEOUT=SI (corregido desde NO de 0.23)
ABORTERROR_RETRY_IMPLEMENTED=SI / ABORTERROR_RETRY_MAX_ATTEMPTS=2 / ABORTERROR_RETRY_ONLY_FOR_ABORTERROR=SI / ABORTERROR_POST_FAILURE_GETSUBSCRIPTION_RECHECK=SI / ABORTERROR_RETRY_DELAY_MS=0
DOUBLE_BACKEND_REGISTER_POSSIBLE=NO / POST_ABORT_RECHECK_FAILURE_FAILS_CLOSED=SI / R13A_FAILURE_STATE_CONTRACT_PRESERVED=SI
FOCAL_TEST_PASS=564 / FOCAL_TEST_FAIL=0 / ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios) / IPHONE_CLIENT/NEGOCIO/REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios, los 3)
PRODUCT_CODE_CHANGED=SI (local, sin stage/commit) / TEST_CODE_CHANGED=SI (local) / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ABORTERROR_MITIGATION_IMPLEMENTED_LOCALLY_PENDING_REVIEW_DEPLOY_AND_ANDROID_ROLE_RETESTS
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

El reintento manual único que 0.23 (abajo) había autorizado a Leonardo
en Android Negocio **también falló** con `AbortError` — en un PROCESO
NUEVO de la PWA (`proc=0dj6pj`, distinto del primer fallo
`proc=7sa51r`, descartando estado de memoria arrastrado, `opId` viejo,
o mutación en vuelo previa), ~1103ms, backend nunca alcanzado por
segunda vez consecutiva. La condición explícita que 0.23 había dejado
(si el retry manual también falla, implementar el recheck defensivo +
retry único) se cumplió — `MANUAL_RETRY_ONLY_STRATEGY=INSUFFICIENT`.

Se implementó `createPhysicalPushSubscriptionWithAbortRecovery` en
`src/hooks/use-push-notifications.ts`: envuelve la función YA
existente `createPhysicalPushSubscription` (sin modificarla) con,
como máximo, UN intento físico adicional — gateado exclusivamente por
`errorClass === "AbortError"` (cualquier otro error re-lanza de
inmediato, sin cambios respecto al comportamiento previo a R19). Ante
`AbortError`, relee OBLIGATORIAMENTE `getSubscription()` antes de
cualquier retry: si encuentra una subscription cuya VAPID key coincide
con la vigente (mismo `applicationServerKeyMatches` que el resto del
archivo ya usa), la reutiliza sin un segundo `subscribe()`; si el
recheck lanza, o encuentra una subscription ambigua/stale, FALLA
CERRADO con el `AbortError` ORIGINAL — nunca un retry a ciegas, nunca
destruye la subscription ambigua (esa decisión sigue siendo exclusiva
del flujo de remoción de key obsoleta ya existente al inicio de
`subscribe()`). Sólo un `null` confirmado autoriza el único retry
físico #2, con su propio trace distinguible
(`SUBSCRIBE_PHYSICAL_RETRY_START/RESULT/ERROR`, separado de
`SUBSCRIBE_ABORT_RECHECK_START/RESULT/ERROR`). Sin delay (`0ms`), sin
ninguna rama de browser/plataforma, sin tocar el mutation gate/registry
(cero referencias a `gate`/`opId=`/`begin(` dentro del wrapper), sin
tocar ningún endpoint de backend. Estructuralmente imposible una doble
subscription física o un doble registro backend — un único call site
de `fetch(subscribeUrl...)` en todo el archivo, alcanzado 0 ó 1 vez
según si el wrapper resuelve o lanza.

Si el segundo intento también falla, el wrapper simplemente re-lanza —
cae en el MISMO `catch` ya endurecido por R13A
(`reportMutationFailureSafely`) → `SUBSCRIBE_FINISH subscribed=false`
→ switch OFF, toast de error seguro, sin success feedback. **No se
reabre el bug de UI stale de R13.** Si el primer `AbortError` se
recupera automáticamente, el usuario NUNCA ve el toast de error del
primer intento.

10 tests deterministas nuevos (`use-push-notifications-abort-retry.
test.ts`) cubren los 7 escenarios físicos directamente; los 3
restantes (mutation registry, gate stale, consumidores de rol
Cliente/Negocio/Repartidor) quedan cubiertos por inspección estructural
explícita más la regresión verde de las suites R2/R7/R13A y los 3
static-contracts de rol, sin necesitar cambios en ellas. **564 tests
focales en 0 fail** (32 archivos `*push*.test.ts` del repo completo),
ESLint limpio, TypeScript idéntico a la baseline vigente (24 raw/18
distintos, 0 nuevos), `git diff --check` limpio. Fileset exacto: 1
archivo de producto modificado (`use-push-notifications.ts`) + 1 test
nuevo, nada stageado, sin commit.

**Corrección de wording de autoridad ACTUAL**: se encontró y corrigió
en `codex-reports/TEST_AUTHORITY.md` una frase incorrecta que decía
que el comportamiento de R13A quedaba "confirmado también en
producción real" — Production nunca estuvo involucrada. La formulación
correcta, ya aplicada: "confirmado también en runtime real de
TESTING". El reporte histórico de R18 no fue editado.

Ningún test/deploy/prueba física certifica todavía que esta mitigación
resuelve el `AbortError` real en el dispositivo de Leonardo — sólo
prueba que el algoritmo se comporta exactamente como se diseñó. La
certificación real requiere el ciclo commit→deploy→smoke→retest físico
de Android Negocio (tarea separada, `R19A`, no ejecutada aquí).
**P2-T31 SIGUE ABIERTO.** P2-T29 y Mercado Pago no se inician. Sin
commit/push/deploy en ningún momento; `COMPLETED_TASKS.md` y
`GIT_DEPLOY_HISTORY.md` no fueron tocados. Reporte completo:
`codex-reports/P2_T31_R19_ANDROID_PUSHMANAGER_ABORTERROR_SINGLE_RETRY_HARDENING.md`.

## 0.23 ESTADO ANTERIOR — R18: ABORTERROR RECURRIÓ EN NEGOCIO (MISMA CLASE QUE R13), FAILURE-STATE CONTRACT PASS, IPHONE NEGOCIO/REPARTIDOR CERTIFICADOS (2026-09-08) — MITIGACIÓN IMPLEMENTADA POR 0.24 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R18 fue sólo auditoría read-only)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R18_STATUS=ANDROID_ABORTERROR_RECURRENCE_AUDITED_CROSS_ROLE_FAILURE_STATE_CONTRACT_HELD_PENDING_SINGLE_RETEST
ANDROID_R18_MATCHES_R13_FAILURE_CLASS=SI (misma etapa: PushManager.subscribe() -> AbortError, ~290ms, antes de backend)
ANDROID_R18_ROLE_SPECIFIC_CODE_CAUSE_STATUS=NO_EVIDENCE (código bit-a-bit idéntico entre roles hasta el punto de fallo)
R13A_FAILURE_STATE_CONTRACT_CURRENT_PHYSICAL_RESULT=PASS (SUBSCRIBE_FINISH disparó, registry liberó, switch OFF — NO se reabre el bug de UI stale de R13)
ANDROID_PHYSICAL_CREATE_RELIABILITY_CURRENT_STATUS=HISTORICAL_3_OF_3_PASS_BUT_ABORTERROR_RECURRENCE_CONFIRMED (R14 preservado sin reescribir)
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios, R17 preservado)
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING / IPHONE_NEGOCIO_PUSH_MATRIX=CERTIFIED_TESTING / IPHONE_REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (los 3 roles iPhone certificados)
ANDROID_NEGOCIO_SMOKE=FAIL_AT_ACTIVATION_ABORTERROR / ANDROID_REPARTIDOR_SMOKE=NOT_STARTED
ANDROID_ABORTERROR_MITIGATION_REQUIRED_BEFORE_T31_CLOSEOUT=NO (2 ocurrencias totales, evidencia insuficiente para justificar retry automático)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_IPHONE_ALL_ROLES_CERTIFIED_ANDROID_CLIENT_CERTIFIED_PENDING_ANDROID_NEGOCIO_ABORTERROR_RESOLUTION_AND_ANDROID_REPARTIDOR_SMOKE
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=SINGLE_MANUAL_RETRY_ANDROID_NEGOCIO_ACTIVATION_WITH_TRACE_ARMED
```

Durante el smoke corto de Android Negocio (posterior a la
certificación física de Android Cliente en 0.22 abajo), la activación
de push falló con `PushManager.subscribe() → AbortError` (~297ms, sin
llegar a backend) — la misma clase de fallo que R13 había documentado
originalmente para Cliente (2026-09-06).

Comparado campo por campo contra R13: mismo `errorClass`, mismo orden
de magnitud de duración, mismo estado previo (`permission=granted`, SW
`activated`, VAPID fetch exitoso, sin subscription existente), mismo
punto exacto de rechazo (antes de cualquier contacto con backend). **No
se afirma la misma causa raíz de plataforma** (sigue `NOT_PROVEN_
PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE`, sin
cambios desde R13) — sólo se afirma la misma CLASE/ETAPA de fallo, que
sí está probada. La diferencia real y significativa es el MANEJO del
fallo: en R13, `SUBSCRIBE_FINISH` nunca se disparó (bug de UI stale que
R13 encontró y R13A corrigió) y el switch quedó stale en ON; en esta
recurrencia, `SUBSCRIBE_FINISH` se disparó correctamente
(`current=true subscribed=false errorClass=AbortError`), el registry
liberó, y el switch terminó OFF — el contrato de failure-state de R13A
se verificó `PASS` completo contra un fallo real, en un rol (Negocio)
distinto al que originalmente lo expuso (Cliente). **No se reabre el
bug de UI stale.**

Se auditó el código real de los 3 consumidores de rol (`client-
profile-panel.tsx`, `config-tab.tsx`, `profile-tab.tsx`) y se confirmó
con evidencia directa de código — no por asunción de "es compartido,
entonces es plataforma" — que los 3 llaman exactamente la misma función
`usePushNotifications()` sin ninguna rama condicionada por rol antes
del punto de fallo. Se probó, precondición por precondición, que auth
Negocio, backend ownership, rate limiter, DB y provider send no
pudieron ser causa de este intento — cero requests HTTP salieron del
browser (no se confunde SUBSCRIBE físico con SEND de notificación). El
`PASS_3_OF_3_CONSECUTIVE` de R14 se preserva histórico sin
reescribirse, reconciliado con un marcador de estado ACTUAL separado.
Android Cliente (R17) NO se invalida — la nueva falla es de creación en
Negocio, sin relación técnica con la matriz de entrega ya certificada
de Cliente.

**Nueva evidencia física del operador, posterior a 0.22**: las
matrices completas de iPhone Negocio (N1-N7: activación, rapid toggle,
remount, cold reopen ON, logout/login OFF esperado + re-enable + OFF
cold reopen, foreground real, closed-PWA real con tap correcto) e
iPhone Repartidor (R1-R7, mismo patrón) llegaron con PASS en todas sus
capas — **los 3 roles de iPhone quedan `CERTIFIED_TESTING`**.

Se evaluaron 9 opciones de mitigación de código (retry simple, retry
con delay, releer `getSubscription()` antes de reintentar, esperar
`registration.ready` de nuevo, unregister de SW, reset de permisos,
reload de página, mensaje de error más específico) sin implementar
ninguna — con sólo 2 ocurrencias documentadas en total (R13 Cliente,
R18 Negocio), no hay evidencia de frecuencia suficiente para justificar
un mecanismo de retry automático. Único siguiente paso físico
definido: un reintento manual único del switch de Negocio con la traza
de diagnóstico ya armada (sin reinstalar, sin tocar permisos, sin
cerrar la app) — seguro porque el contrato de failure-state ya deja el
gate/registry completamente liberados, y no pierde la evidencia de FAIL
ya preservada en este reporte.

**P2-T31 SIGUE ABIERTO** por Android Negocio (recurrencia de
AbortError en activación, pendiente el reintento manual) y Android
Repartidor (smoke `NOT_STARTED`). P2-T29 y Mercado Pago no se inician.
Sin commit/push/deploy en ningún momento; `COMPLETED_TASKS.md` y
`GIT_DEPLOY_HISTORY.md` no fueron tocados. Reporte completo:
`codex-reports/P2_T31_R18_ANDROID_ABORTERROR_CROSS_ROLE_RECURRENCE_AUDIT.md`.

## 0.22 ESTADO ANTERIOR — R17: ANDROID CLIENTE CERTIFICADO EN TESTING — CAUSA CONFIRMADA: NOTIFICACIONES DE CHROME DESHABILITADAS A NIVEL ANDROID (2026-09-08) — VER 0.23 ARRIBA PARA LA NUEVA RECURRENCIA EN NEGOCIO Y LA CERTIFICACIÓN COMPLETA DE IPHONE

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R17 fue sólo documentación/reconciliación)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R17_STATUS=ANDROID_CLIENT_PUSH_CERTIFIED_TESTING_PENDING_IPHONE_ROLE_MATRICES
ANDROID_DEVICE_NOTIFICATION_ROOT_CAUSE_STATUS=CONFIRMED_BY_OPERATOR_CONFIGURATION_CHANGE
ANDROID_DEVICE_NOTIFICATION_ROOT_CAUSE=CHROME_NOTIFICATIONS_DISABLED_AT_ANDROID_OS_LEVEL
ANDROID_PUSH_CODE_BUG_FOR_THIS_INCIDENT=NO_EVIDENCE
ANDROID_FOREGROUND_PUSH_STATUS=PASS / ANDROID_CLOSED_PWA_PUSH_STATUS=PASS / ANDROID_NOTIFICATION_TAP_STATUS=PASS / ANDROID_OFF_COLD_REOPEN_STATUS=PASS
ANDROID_ON_COLD_REOPEN_STATUS=PASS_POST_DEVICE_NOTIFICATION_CONFIGURATION_FIX (corregido desde la regresión de 0.21 — histórico preservado, ver aclaración abajo)
ANDROID_CLIENT_PUSH_MATRIX_STATUS=CERTIFIED_TESTING / ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING
R15A_URGENCY_MITIGATION_STATUS=DEPLOYED_COMPATIBLE_NOT_PROVEN_ROOT_CAUSE (R15A NO se le adjudica la causa raíz; no se revierte)
PRE_REPARTIDOR_ACCEPT_EN_CAMINO_MISSING_NOTIFICATION=NOT_CLASSIFIED_AS_PUSH_FAILURE / REPARTIDOR_ACCEPT_CLIENT_NOTIFICATION=PHYSICAL_PASS
P2_T29_CURRENT_IMPLEMENTATION_STATUS=REQUIRES_FULL_FLOW_AUDIT_BEFORE_REDESIGN (NO implementado, NO iniciado)
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado) / IPHONE_NEGOCIO_PUSH_MATRIX=PENDING / IPHONE_REPARTIDOR_PUSH_MATRIX=PENDING
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ANDROID_CLIENT_AND_IPHONE_CLIENT_CERTIFIED_PENDING_IPHONE_NEGOCIO_AND_REPARTIDOR_PHYSICAL_MATRICES
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=RUN_IPHONE_NEGOCIO_PUSH_PHYSICAL_MATRIX
```

Leonardo revisó su dispositivo Android tras 0.21 (abajo) y encontró la
causa real: **las notificaciones de Chrome estaban deshabilitadas a
nivel del sistema operativo Android** — exactamente el "platform-level"
que R16 había dejado plausible pero no probado (0.21 no tenía acceso
al dispositivo físico). Después de habilitarlas, sin ningún cambio de
código ni redeploy (mismo commit TESTING `d7cc66d` de R15A), Leonardo
confirmó físicamente las 4 capas pendientes: notificaciones con la app
ABIERTA funcionan (foreground PASS), notificaciones con la PWA CERRADA
de forma normal funcionan sin necesitar force-stop (closed-PWA/
background PASS), la notificación se puede tocar y abre correctamente
el pedido correspondiente (tap PASS, destino correcto), y el switch
apagado permanece apagado tras cerrar/reabrir sin auto-reactivarse
(OFF+cold-reopen PASS).

**Android Cliente queda `CERTIFIED_TESTING`** — las 6 capas de su
matriz física (creación 3/3 consecutiva, ON-persistence, foreground,
closed-PWA, notification tap, OFF) en PASS. Esto NO se extrapola a
Negocio ni a Repartidor en Android — esos actores nunca ejecutaron esta
matriz física.

**Reconciliación sin reescribir historia**: el archivo
`P2_T31_R16_ANDROID_PUSH_SUBSCRIPTION_PERSISTENCE_LOSS_ROOT_CAUSE_
AUDIT.md` NO fue editado — su clasificación `PLATFORM_LEVEL_PLAUSIBLE_
NOT_PROVEN` era la conclusión correcta con la evidencia disponible en
ese momento (sin acceso al dispositivo físico, sólo se podía probar
que NO era un bug de código DeliGO). La confirmación nueva vive
únicamente en las autoridades de estado ACTUAL. Tampoco se afirma que
Chrome o Android tengan un bug — fue una configuración externa del
dispositivo. `ANDROID_ON_COLD_REOPEN_STATUS` pasa de la regresión
documentada en 0.21 (`REGRESSION_REPRODUCED_POST_R15A_SUBSCRIPTION_
MISSING`, que a su vez había corregido el PASS histórico de R7/R8/R9)
a `PASS_POST_DEVICE_NOTIFICATION_CONFIGURATION_FIX` — ninguna de las 3
entradas se borra, cada una describe correctamente lo que se observó
en su momento.

**R15A no se le adjudica la causa raíz**: el hardening de urgency
(commit `d7cc66d`) sigue desplegado y compatible con lo observado —
ningún envío falló por sus opciones — pero la causa real confirmada
fue la configuración de notificaciones del dispositivo, no la
prioridad de entrega del servidor. R15A no se revierte.

**Hallazgo "en camino"**: Leonardo observó que una notificación de "en
camino" no llegó ANTES de que un repartidor aceptara el pedido, y que
SÍ llegó correctamente cuando el repartidor aceptó. Esto se clasificó
como comportamiento esperado del código actual (no existe hoy un
estado que dispare esa notificación antes de la aceptación), no como
fallo de push — la notificación al aceptar el repartidor queda
registrada como PASS físico. Esto es un dato PARCIAL a favor del
rediseño de flujo planificado (P2-T29 — Order Flow + Notification
Semantics Redesign: `RECIBIDO → ACEPTADO → PREPARANDO → BUSCANDO/
ESPERANDO REPARTIDOR → EN CAMINO (al aceptar repartidor) → ENTREGADO`),
pero **P2-T29 NO se declara implementado ni se inicia** — sigue
requiriendo una auditoría completa del flujo actual antes de cualquier
rediseño.

**P2-T31 SIGUE ABIERTO** por iPhone Negocio y iPhone Repartidor (y
Android Negocio/Repartidor, nunca ejecutados formalmente). Mercado
Pago sigue `PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT`. Sin commit/push/deploy
en ningún momento; `COMPLETED_TASKS.md` y `GIT_DEPLOY_HISTORY.md` no
fueron tocados. Reporte completo:
`codex-reports/P2_T31_R17_ANDROID_CLIENT_PUSH_PHYSICAL_CERTIFICATION_AND_CONTEXT_RECONCILIATION.md`.

## 0.21 ESTADO ANTERIOR — R16: PÉRDIDA FÍSICA REAL DE PUSHSUBSCRIPTION CONFIRMADA, PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN EN SU MOMENTO — CAUSA CONFIRMADA POR 0.22 ARRIBA (2026-09-07/08)

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, SIN CAMBIOS — R16 fue sólo auditoría)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
P2_T31_R16_STATUS=ROOT_CAUSE_AUDITED_PLATFORM_LEVEL_PLAUSIBLE_NO_CODE_FIX_NEEDED
ANDROID_R16_POST_REOPEN_PHYSICAL_SUBSCRIPTION=MISSING / ANDROID_R16_POST_REOPEN_PERMISSION=default
R16_PROVIDER_SEND_FOR_522C650F=SI, providerStatus=201 (01:28:46Z) luego 410 REAL (01:29:43Z, mismo endpoint, ~57s después)
R16_BACKEND_BINDING_AFTER_PHYSICAL_LOSS=ABSENT / R16_FAILURE_MODEL=SINGLE_CAUSE_PROVEN
ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE_STATUS=PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN
R15A_CHANGE_CAUSED_SUBSCRIPTION_LOSS=NO_EVIDENCE / FIX_IMPLEMENTED=NO
ANDROID_ON_COLD_REOPEN_STATUS=REGRESSION_REPRODUCED_POST_R15A_SUBSCRIPTION_MISSING (corregido desde el PASS histórico de R7/R8/R9 — ver aclaración abajo)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ANDROID_PUSH_PHYSICAL_SUBSCRIPTION_PERSISTENCE_LOSS_PLATFORM_LEVEL_PENDING_OPERATOR_DEVICE_CHECK
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=OPERATOR_CHECK_DEVICE_NOTIFICATION_PERMISSION_STATE_BEFORE_NEXT_ANDROID_RETEST
```

Leonardo ejecutó el retest físico post-R15A (0.20 abajo). Resultado:
la notificación closed-PWA siguió sin llegar, PERO ADEMÁS reportó que
tampoco llegaban notificaciones con la app ABIERTA en esta nueva
sesión, y que al reabrir la PWA el switch de notificaciones apareció
OFF. El trace autoritativo mostró una subscription física
(`endpointFingerprint=522c650f`) creada y confirmada correctamente
(`SUBSCRIBE_BACKEND_RESULT httpStatus=200`), verificada como presente
y atada al backend en un remount posterior, y luego AUSENTE
(`physicalPresent=false`) en un proceso nuevo tras cierre/reapertura,
con `permission=default` (no `denied`).

ROOT CAUSE AUDIT + inspección read-only de runtime/logs (sin commit,
push, deploy, mutación de DB, prueba física, ni rotación VAPID). Se
inventariaron TODOS los `.unsubscribe()` físicos del repo (hook
personal — `PERSONAL_MANUAL_DISABLE_PHYSICAL_UNSUBSCRIBE=NO`
certificado por static-contract test —, los 3 rollbacks de creación
fallida en permission-prompt/salón/mozo, la remoción de key stale,
logout operativo Policy A) — **ninguno coincide con el trace del
incidente**: no hay `UNSUBSCRIBE_START`, no hay
`SUBSCRIBE_STALE_REMOVE_START`, y el guardado backend fue exitoso
(httpStatus=200) así que ningún rollback pudo dispararse. Se auditaron
TODOS los lifecycle listeners (pagehide/visibilitychange/unmount, más
de 30 sitios en `src/`) — ninguno toca `PushManager`. Se auditó auth
bootstrap (`logout()` sólo limpia estado de React) y el Service Worker
(`unregisterServiceWorker()` existe pero sin ningún caller real en
producto; reemplazar el script del SW no invalida la subscription por
spec; R15A no tocó `public/sw.js`). `Notification.permission` no puede
resetearse programáticamente desde ningún código de DeliGO. Se
confirmó, vía el propio mecanismo de persistencia del trace
(`localStorage`, per-origin), que creación y reapertura ocurrieron en
el MISMO origin — evidencia empírica, no sólo de configuración.

**Hallazgo decisivo** (logs REALES de Railway TESTING, sólo lectura,
ventana exacta `01:25:00Z`–`01:45:00Z`): un envío real a `522c650f` a
las `01:28:46Z` (tipo `order_update`, con las opciones de R15A ya
vigentes) fue **aceptado por el proveedor (`providerStatus=201`)**. Un
segundo cambio de estado del MISMO pedido, 57 segundos después
(`01:29:43Z`), generó un segundo intento que recibió un **410
GENUINO** ("Subscription expired") para el MISMO endpoint — el backend
reaccionó exactamente como está diseñado (CAS-safe,
`safeClearLegacyIfMatches`), limpiando el binding legacy sin ninguna
inferencia. El mismo actor había sufrido una muerte idéntica de OTRO
endpoint apenas 90 segundos ANTES de siquiera empezar esta sesión — un
patrón que se repite para el mismo actor/dispositivo, no un evento
aislado.

Esto prueba que el pipeline de envío de R15A funcionó correctamente
(`R15A_CHANGE_CAUSED_SUBSCRIPTION_LOSS=NO_EVIDENCE`, R15A NO se
revierte) y que la pérdida es un evento REAL de plataforma
(browser/OS/permiso), confirmado por el proveedor, no una inferencia
ni un bug de código DeliGO. `R16_FAILURE_MODEL=SINGLE_CAUSE_PROVEN`:
ambos síntomas (foreground sin notificación visible + switch OFF al
reabrir) se explican por la MISMA muerte de subscription, no son dos
fallas independientes. El mecanismo EXACTO de esa muerte
(`ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE_STATUS=PLATFORM_LEVEL_
PLAUSIBLE_NOT_PROVEN`) no se pudo probar sin acceso al dispositivo
físico de Leonardo (chrome://settings, Ajustes de Android, logcat).

Sin bug de código probado, `FIX_IMPLEMENTED=NO` — se descartó
explícitamente cualquier re-subscribe automático silencioso (ocultaría
el problema en vez de seguir diagnosticándolo), cualquier prompt de
permiso automático, retry loop, o reset de Service Worker.
`ANDROID_ON_COLD_REOPEN_STATUS` se corrige de su PASS histórico (R7/
R8/R9 — que certificaba la persistencia del ESTADO DE UI tras un cold
reopen, nunca la supervivencia indefinida de la PushSubscription
física) a `REGRESSION_REPRODUCED_POST_R15A_SUBSCRIPTION_MISSING` — no
se borra esa evidencia histórica, pero ya no puede citarse sola sin
esta aclaración. **P2-T31 SIGUE ABIERTO.** Recomendación para la
siguiente tarea (NO ejecutada): pedirle a Leonardo que revise, en su
propio dispositivo, Ajustes de Android → Apps → DeliGO/Chrome →
Notificaciones/Permisos y `chrome://settings/content/notifications`,
antes de cualquier nuevo intento físico — reintentar ahora sin esa
información sólo reproduciría el mismo resultado. Mercado Pago sigue
`PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT`. Sin commit/push/deploy en ningún
momento. Reporte completo:
`codex-reports/P2_T31_R16_ANDROID_PUSH_SUBSCRIPTION_PERSISTENCE_LOSS_ROOT_CAUSE_AUDIT.md`.

## 0.20 ESTADO ANTERIOR — R15A: FIX R15R DESPLEGADO EN TESTING, PROTOCOLO FÍSICO CLOSED-PWA PREPARADO (2026-09-07) — RETEST FÍSICO REVELÓ LA REGRESIÓN DE 0.21 ARRIBA

```text
HEAD=origin/testing-codex=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 (R15A, parent 8b49756e76a32b2641bd1099c1e8382d3be32f25)
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios — PRODUCTION_TOUCHED=NO)
P2_T31_R15A_STATUS=DEPLOYED_TESTING_PENDING_ANDROID_CLOSED_PWA_PHYSICAL_RETEST
R15A_RAILWAY_DEPLOYMENT_ID=906d7960-10f5-449b-a1bd-a492feb91bab / R15A_RAILWAY_STATUS=SUCCESS / R15A_RAILWAY_COMMIT_MATCH=SI
R15A_FOCAL_PASS=240 / R15A_FOCAL_FAIL=0 / NEW_TYPECHECK_ERRORS=0
ANDROID_CLOSED_PWA_PUSH_STATUS=FAIL_REPRODUCED (sin cambios — pendiente reintento físico)
ANDROID_NOTIFICATION_TAP_STATUS=NOT_TESTABLE_DUE_TO_CLOSED_PWA_DELIVERY_FAILURE (sin cambios)
ANDROID_OFF_COLD_REOPEN_STATUS=PENDING (sin cambios)
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_PHYSICAL_TEST=ANDROID_CLOSED_PWA_PUSH_RETEST_POST_R15A
NEXT_RECOMMENDED_ACTION=OPERATOR_RUN_ANDROID_CLOSED_PWA_PUSH_RETEST
```

Deploy explícitamente autorizado por el operador
(`COMMIT_AUTHORIZED=SI`/`PUSH_AUTHORIZED=SI`/
`TESTING_DEPLOY_AUTHORIZED=SI`/`PRODUCTION_AUTHORIZED=NO`) del fix
R15R (0.19 abajo). Baseline verificado fresco
(`HEAD=origin/testing-codex=8b49756`, `origin/main=1de0d3c1...`
coincidían exactamente). Gate de calidad re-ejecutado fresco antes de
stagear: 240/240 tests focales, ESLint limpio, TypeScript 24/18
idéntico a la baseline de R15R (0 nuevos), `git diff --check` limpio.
Stage selectivo individual (`git add src/lib/push.ts`, `git add
src/lib/push.test.ts` — nunca `-A`/`.`); `git diff --cached
--name-status` confirmó exactamente esos 2 archivos antes de
commitear, sin ningún archivo de `.claude/skills/**`/`CLAUDE.md`/
`codex-reports/**`/`32`. Commit único `d7cc66d` (parent `8b49756`
verificado), push a `testing-codex` (nunca `main`, sin `--force`) —
`origin/testing-codex` confirmado en `d7cc66d`. Autodeploy Git-triggered
normal a "DeliGO Copy" (sin `railway up`), poll directo y finito:
deployment `906d7960...` `SUCCESS`, instancia `RUNNING`,
`meta.commitHash` == `d7cc66d` exacto (verificado vía `railway status
--json`). Logs de build (imagen exportada/pusheada sin error) y de
boot ("No pending migrations to apply", Next.js "Ready in 65ms", sin
fatal/unhandled/500) limpios. Smokes: `/` → 307 a `/cliente/` (normal),
`/cliente/` → 308 (normalización de slash, normal),
`GET /api/push/debug-guard` → `200 {"allowed":true}` (confirma en
runtime real que el guard TESTING-only reutilizado por el nuevo log de
éxito de push funciona correctamente en el entorno real). No se generó
tráfico de push real para forzar el log `[Push] Enviado OK` — no había
ningún pedido real disponible sin afectar datos reales.

`origin/main` verificado sin cambios antes y después
(`PRODUCTION_TOUCHED=NO`). El trabajo de Claude Code Project Skills
(0.18 abajo) no fue tocado por este commit — scope preservado. **P2-T31
SIGUE ABIERTO** — `DEPLOYED_TESTING` no es `PHYSICALLY_CERTIFIED`. El
protocolo físico `ANDROID_CLOSED_PWA_PUSH_RETEST_POST_R15A` queda
preparado para que Leonardo lo ejecute (PWA cerrada de forma normal de
usuario, NUNCA "Forzar detención"; generar UN `order_update` real;
esperar hasta 60s; reportar recepción/tiempo/duplicado/contenido) — no
se ejecutó ninguna prueba física desde Claude. Si el retest vuelve a
FAIL: NO reinstalar, NO unsubscribe, NO OFF, NO resetear permisos, NO
crear subscription nueva — reabrir sin tocar el switch y revisar logs
TESTING para `endpointFingerprint`/`providerStatus` del evento
correspondiente antes de declarar cualquier causa. Mercado Pago sigue
`PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT`. Reporte completo:
`codex-reports/P2_T31_R15A_COMMIT_DEPLOY_AND_CLOSED_PWA_RETEST_READY.md`.

## 0.19 ESTADO ANTERIOR — R15R: CORRECCIÓN PRE-DEPLOY DEL FIX R15 (TTL/URGENCY/OBSERVABILIDAD), SIN DEPLOY (2026-09-07) — DESPLEGADO POR 0.20 ARRIBA

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — local, sin commit)
P2_T31_R15R_STATUS=LOCAL_MITIGATION_AND_DIAGNOSTICS_CORRECTED_PENDING_TESTING_DEPLOY
WEB_PUSH_LIBRARY_VERSION=3.6.7 / WEB_PUSH_DEFAULT_TTL=2419200 (28 dias) / WEB_PUSH_DEFAULT_URGENCY=normal
MISSING_TTL_BEFORE_R15=NO
PROVEN_ROOT_CAUSE=NO
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE (corregido desde HIGH_CONFIDENCE_CODE_BUG de R15 en 0.17)
GLOBAL_HIGH_URGENCY_JUSTIFIED=NO (8/12 tipos time-sensitive, resto conserva default)
R15_TTL_CHANGE_SHORTENS_RETENTION=SI -> TTL de R15 (24h) revertido al default de la libreria (28 dias)
PUSH_PROVIDER_SUCCESS_LOG_PRODUCTION_ENABLED=NO (gateado TESTING-only con isPushDebugAllowedEnvironment) / PROVIDER_SUCCESS_STATUS_LOGGED=SI
R15R_FOCAL_PASS=240 / R15R_FOCAL_FAIL=0 / NEW_TYPECHECK_ERRORS=0
P2_T31_STATUS=IN_PROGRESS_ANDROID_CLOSED_PWA_DELIVERY_FAILURE_UNRESOLVED_MITIGATION_PENDING_TESTING_DEPLOY_THEN_OFF_PERSISTENCE_AND_IPHONE_BUSINESS_DELIVERY_MATRIX_PENDING
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
PRODUCT_CODE_CHANGED=SI (local, sin commit) / TEST_CODE_CHANGED=SI (local) / PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST
```

Revisión pre-deploy del fix local de R15 (0.17 abajo), antes de
cualquier commit/push/deploy, sin tocar el trabajo de Claude Code
Project Skills (0.18 arriba — scope preservado por separado, ambos
`src/lib/push.ts`/`push.test.ts` y `.claude/skills/**`/`CLAUDE.md`
siguen locales sin commit al mismo tiempo). Se auditó la versión REAL
instalada de `web-push` (3.6.7, leyendo
`node_modules/web-push/src/web-push-lib.js`, no sólo documentación):
`DEFAULT_TTL=2419200` (28 días) y `urgency` default `"normal"`. Esto
corrige el hallazgo de R15
(`MISSING_PUSH_URGENCY_AND_TTL_OPTIONS_ON_WEBPUSH_SEND`): el TTL NUNCA
estuvo ausente — la librería siempre lo aplicó por default, con mucha
más retención que cualquier valor que R15 fijara; el candidato real de
código era sólo `urgency`. La clasificación de causa raíz se corrige
de `HIGH_CONFIDENCE_CODE_BUG` a
`UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE` — R15
nunca tuvo una captura directa (request/response del proveedor, traza
del SW) que probara la causa para este incidente específico.

Se inventariaron los 12 `NotificationType` reales del pipeline y se
clasificaron en 8 time-sensitive (`order_update`, `new_order`,
`new_delivery`, `chat`, `mesa_order_ready`, `salon_new_order`,
`operaciones_salon_new_order`, `operaciones_order_cancelled`) vs 4
no-urgentes (`review`, `review_request`, `account_update`, `general`
— sin fábrica de payload real). `urgency:"high"` ahora se pide SÓLO
para los 8 time-sensitive (`isTimeSensitivePushType` en `push.ts`) —
nunca global. El `TTL: 60*60*24` que R15 había agregado se removió por
completo (acortaba la retención real de 28 días sin decisión de
producto separada). El log de éxito `[Push] Enviado OK` (R15 lo dejó
corriendo en TODOS los ambientes pese a que R15 lo había concebido
TESTING-only) ahora está gateado con el guard ya existente
(`isPushDebugAllowedEnvironment`, `src/lib/push-testing-guard.ts`,
`RAILWAY_ENVIRONMENT_NAME`) y agrega el `statusCode` real del
proveedor (nunca `body`/`headers`/endpoint completo).

240 tests focales (`push*.test.ts`, 8 archivos) en 0 fail. ESLint
limpio en los 2 archivos tocados. TypeScript: 24 raw / 18 distintos,
idéntico a la baseline de R15 — 0 nuevos. Preservado sin cambios:
hallazgo de `notificationclick` sin cobertura real (R15). NO se
commiteó, pusheó ni desplegó nada; Production intacta; P2-T31 sigue
abierto; Mercado Pago sigue pausado. Reporte completo:
`codex-reports/P2_T31_R15R_PREDEPLOY_EVIDENCE_CORRECTION_AND_PUSH_PRIORITY_SCOPE.md`.

## 0.18 ESTADO ANTERIOR — CLAUDE CODE PROJECT SKILLS: 3 SKILLS + ROUTER CREADOS (TOOLING PURO, 2026-09-07)

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — tarea de tooling puro, sin commit)
CLAUDE_SKILLS_TASK_STATUS=LOCAL_PROJECT_SKILLS_CREATED_VALIDATED_PENDING_OPERATOR_REVIEW
DELIGO_SAFE_TASK_CREATED=SI / DELIGO_CLOSEOUT_CREATED=SI / DELIGO_TESTING_DEPLOY_CREATED=SI
SKILLS_CONTAIN_LIVE_PROJECT_STATE=NO
DEPLOY_EXPLICIT_AUTHORIZATION_GATE_PRESENT=SI
CLAUDE_SESSION_RESTART_REQUIRED_FOR_DISCOVERY=SI
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
GIT_ADD_EXECUTED=NO / GIT_COMMIT_EXECUTED=NO / GIT_PUSH_EXECUTED=NO / DEPLOY_EXECUTED=NO
NEXT_RECOMMENDED_ACTION=OPERATOR_RESTART_CLAUDE_SESSION_IF_REQUIRED_AND_VERIFY_AUTO_SKILL_ROUTING
```

Tarea de infraestructura de Claude Code — NO continuó ningún trabajo de
roadmap (Android/R15/Mercado Pago quedaron exactamente donde estaban en
`0.17`). Se creó `.claude/skills/{deligo-safe-task,deligo-closeout,
deligo-testing-deploy}/SKILL.md` (108/82/103 líneas) y un `CLAUDE.md`
nuevo en la raíz (no existía ninguno antes) con una sección breve
"DeliGO Skill Routing". Sintaxis auditada contra la documentación
oficial de Claude Code (`code.claude.com/docs/en/skills`): `when_to_use`
es un campo real soportado; `disable-model-invocation:true` oculta la
skill del contexto de Claude por completo, así que — por diseño — NO se
usó en ninguna de las 3; `deligo-testing-deploy` gatea sus side effects
(commit/push/deploy) con un AUTHORIZATION GATE interno propio, exigiendo
autorización explícita de la tarea ACTUAL para cada operación —
ni tests en verde, ni un `NEXT_RECOMMENDED_ACTION=deploy` histórico, ni
"el fix está bien" cuentan como autorización, y una petición de deploy
a Production tampoco la satisface (Production tiene su propio flujo).
Las 3 skills están libres de estado vivo (sin hashes, sin deployment
IDs, sin tarea actual, sin estado de Android/Pagos/P2-T31) — ese estado
sigue viviendo exclusivamente en Git real y en `CODEX_REPORT.md` +
este archivo + el resto de `codex-reports/`. Nueva autoridad de tooling:
`codex-reports/CLAUDE_SKILLS.md`. `.claude/skills/` no existía cuando
esta sesión arrancó, así que probablemente se necesite una sesión nueva
de Claude Code para que el auto-routing quede activo. Sin commit, sin
push, sin deploy, sin tocar código/tests de producto. Reporte completo:
`DELIGO_CLAUDE_PROJECT_SKILLS_FOUNDATION_REPORT.md`.

## 0.17 ESTADO ANTERIOR — ANDROID RETOMADO: ROOT CAUSE AUDIT CLOSED-PWA, FIX LOCAL DE PRIORIDAD DE ENTREGA (R15, 2026-09-07) — CORREGIDO POR 0.19 ARRIBA

**CORREGIDO POR R15R (0.19 arriba)**: `HIGH_CONFIDENCE_CODE_BUG` baja a
`UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE`; el TTL
nunca estuvo ausente (`MISSING_TTL_BEFORE_R15=NO`, web-push 3.6.7 ya
aplica 28 días por default). Bloque original preservado sin editar:

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin commit — cambio local sin stage)
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=NO (Leonardo retomó Android para cerrar P2-T31 antes de Mercado Pago)
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=HIGH_CONFIDENCE_CODE_BUG (CORREGIDO POR 0.19)
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE=MISSING_PUSH_URGENCY_AND_TTL_OPTIONS_ON_WEBPUSH_SEND (CORREGIDO POR 0.19)
FIX_IMPLEMENTED=SI_LOCAL_SOLAMENTE_NO_DESPLEGADO
R15_FOCAL_PASS=235 / R15_FOCAL_FAIL=0
TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0
PRODUCT_CODE_CHANGED=SI (local) / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ANDROID_CLOSED_PWA_DELIVERY_FAILURE_UNDER_AUDIT_THEN_OFF_PERSISTENCE_AND_IPHONE_BUSINESS_DELIVERY_MATRIX_PENDING
PAYMENTS_WORK_STATUS=PAUSED_UNTIL_PUSH_P2_T31_CLOSEOUT
NEXT_RECOMMENDED_ACTION=P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST
```

Auditoría de causa raíz de punta a punta del fallo de entrega closed-PWA
(evento → server send → subscription lookup → web-push send → Service
Worker → showNotification → Android). Hallazgo clave de proceso: el
canal realtime (Socket.IO) de DeliGO **no tiene** ningún evento de
cambio de estado de pedido — todo el ciclo de vida de pedidos usa
EXCLUSIVAMENTE Web Push real (`src/lib/push.ts::createNotification`),
así que el test foreground (PASS) y el test closed-PWA (FAIL) corrieron
por el MISMO pipeline exacto, mismo endpoint físico, mismo código —
esto descarta que el foreground haya usado un mecanismo distinto que
enmascarara el problema real. Auditando cada frontera del pipeline
(lookup de subscription, Service Worker real vía VM harness existente,
branching foreground/background — sólo existe uno, exclusivo de chat y
fail-open, no puede explicar el fallo closed-PWA —, contrato de
payload, `event.waitUntil`, opciones de `showNotification`, dedupe por
`tag`, detección de clientes) se descartó código propio como causa
directa, salvo un hallazgo real: `sendPushNotification` nunca pedía
`urgency`/`TTL` explícitos a `webpush.sendNotification` — documentación
oficial de `web-push-libs/web-push` y de FCM/Android confirma que la
ausencia de `urgency:"high"` puede hacer que el push service DIFIERA la
entrega mientras el dispositivo está en Doze/ahorro de batería, patrón
exactamente compatible con "llega en foreground, no llega con la app
cerrada". No se declara `PROVEN` (no hay captura directa que lo pruebe
para este incidente específico) — se clasifica `HIGH_CONFIDENCE_CODE_BUG`
y se implementó el fix mínimo (`{ TTL: 86400, urgency: "high" }` en
`src/lib/push.ts`), spec-estándar, sin hacks. Se cerró además un gap de
observabilidad real y genuino: un envío EXITOSO no dejaba ningún rastro
en logs (sólo las fallas se logueaban) — se agregó un log simétrico
seguro (`fingerprintPushEndpoint`, reusando el helper ya existente de
`push-debug-snapshot.ts`, nunca el endpoint completo), corriendo en
todos los ambientes con la misma disciplina de redacción que el log de
falla ya existente. Como evidencia adicional (lectura, sin cambios),
`railway logs` de TESTING mostró 3 llamadas reales
`PATCH .../estado → 200` el 2026-09-07 con 3 limpiezas 410 reales
inmediatamente después de la primera — prueba de que el pipeline
ejecuta envíos reales y maneja respuestas reales del proveedor — pero
sin marca de tiempo del lado del operador no se pudo correlacionar con
certeza cuál PATCH corresponde a cuál prueba física. Tests: 235
focales (0 fail) en los 8 archivos `push*.test.ts`; suite completa del
repo 2915 pass / 227 fail, con el 100% de las fallas explicadas por
`DATABASE_URL` ausente en este sandbox (tests de integración, no
relacionados con push). ESLint limpio, TypeScript 24/24 sin cambios
(mismo error preexistente en `push.ts`, no relacionado con este
cambio). NO se commiteó, pusheó ni desplegó nada — sólo cambios locales
en `src/lib/push.ts` y `src/lib/push.test.ts`, pendientes de revisión
por Leonardo antes de R15A (commit + deploy TESTING + reintento físico
closed-PWA). Reporte completo:
`P2_T31_R15_ANDROID_CLOSED_PWA_BACKGROUND_PUSH_ROOT_CAUSE_AUDIT.md`.
Hallazgo secundario de cobertura (no corregido, fuera de alcance): un
comentario en `sw-push-dedupe.test.ts` afirma que `notificationclick`
está cubierto por tests existentes del SW — no existe ningún test así
en el repo.

## 0.16 ESTADO ANTERIOR — CORRECCIÓN DE CONTEXTO: DIAGNÓSTICO POST-FALLO CLOSED-PWA ANDROID ENTREGADO (2026-09-07) — ROOT CAUSE AUDITADA Y FIX LOCAL APLICADO POR R15 ARRIBA

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — tarea de documentación pura)
ORIGIN_TESTING=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=CAPTURED_POST_FAILURE_SUBSCRIPTION_AND_BACKEND_HEALTHY
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_DELIVERY_PATH_REQUIRES_AUDIT
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=CONTINUE_PAYMENTS_DESIGN_OR_MERCADOPAGO_SPIKE_WHEN_OPERATOR_AUTHORIZES
```

Esta ronda es sólo una corrección de contexto — NO se reabrieron
pruebas físicas, NO se auditó causa raíz. Leonardo entregó el
diagnóstico post-fallo que en `0.15` figuraba como
`PENDING_OPERATOR_CAPTURE`. Snapshot al reabrir DeliGO tras el fallo de
entrega closed-PWA: `permission=granted`, `physicalSubscription=true`
(`endpointFingerprint=a55ebad6`, `existingKeyPresent=true`),
`vapidFetched=true`/`vapidMatch=true`, `backendStatusHttp=200`/
`backendSubscribed=true`, `hookSubscribed=true`, `uiSwitch=true`,
`error=none`. Ese endpoint es el MISMO creado en
`ANDROID_POST_R13A_CREATE_3_OF_3` — no se creó ninguna subscription
nueva. Esto descarta, **sólo como causa simple**, pérdida de
subscription, detach de backend y revocación de permiso
(`RULED_OUT` los tres) — pero NO prueba nada sobre el resto del camino
de entrega (envío del backend, resultado del proveedor web-push,
evento `push` del Service Worker, `showNotification`, presentación en
Android), así que **no se declara causa**: ni Service Worker, ni FCM,
ni Chrome, ni Android, ni backend send, ni supresión del SO, ni capa de
permiso, ni VAPID, ni proveedor. Detalle completo en
`ANDROID_CLOSED_PWA_POST_FAILURE_DIAGNOSTIC_CONTEXT_CORRECTION.md` y en
`codex-reports/FINDINGS.md` (bloque `F-PAYMENTS-PAUSE-ANDROID-CLOSED-
PWA-01`). Todo lo demás de `0.15` permanece sin cambios: la pausa
operativa de Android sigue vigente
(`ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=SI`), el diseño de pagos
Mercado Pago sigue `DESIGN_RESEARCH_NOT_IMPLEMENTED` y no fue tocado, y
la matriz Android (`FOREGROUND=PASS`, `CLOSED_PWA=FAIL_REPRODUCED`,
`TAP=NOT_TESTABLE`, `OFF_COLD_REOPEN=PENDING`) queda igual — el fallo
de entrega sigue siendo un fallo, la salud posterior de la subscription
no lo revierte. Próxima tarea registrada (no iniciada):
`P2-T31-ANDROID-CLOSED-PWA-BACKGROUND-DELIVERY-ROOT-CAUSE-AUDIT`.

## 0.15 ESTADO ANTERIOR — DISEÑO DE PAGOS MERCADO PAGO PERSISTIDO; PRUEBAS FÍSICAS ANDROID PAUSADAS POR EL OPERADOR (2026-09-07) — DIAGNÓSTICO POST-FALLO CORREGIDO POR 0.16 ARRIBA

```text
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — tarea de documentación pura)
ORIGIN_TESTING=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=SI
ANDROID_PHYSICAL_TESTING_PAUSE_REASON=PAYMENTS_DESIGN_AND_DOCUMENTATION
ANDROID_PHYSICAL_TESTING_RESUME_REQUIRES_OPERATOR_DECISION=SI
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
P2_T31_STATUS=IN_PROGRESS_OPERATOR_PAUSED_PENDING_ANDROID_CLOSED_PWA_DELIVERY_INVESTIGATION_OFF_PERSISTENCE_AND_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / DB_SCHEMA_CHANGED=NO / MERCADOPAGO_INTEGRATION_CREATED=NO
PRODUCTION_TOUCHED=NO
PAYMENTS_DESIGN_DOCUMENT_CREATED=SI (codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md)
NEXT_RECOMMENDED_ACTION=MERCADOPAGO_SPLIT_DEFERRED_CAPTURE_COMPATIBILITY_SPIKE_WHEN_OPERATOR_AUTHORIZES (NO iniciado)
```

### Android — estado congelado EXACTAMENTE aquí (pausa operativa, NO cierre)

```text
ANDROID_POST_R13A_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
ANDROID_ON_COLD_REOPEN_STATUS=PASS
ANDROID_FOREGROUND_PUSH_STATUS=PASS (recibida SI, duplicada NO, contenido correcto SI, notificaciones Android habilitadas en Ajustes SI)
ANDROID_NATIVE_PERMISSION_PROMPT_STATUS=NO_RECUERDO_OPERATOR (nunca convertido en PASS)
ANDROID_CLOSED_PWA_PUSH_STATUS=FAIL_REPRODUCED (push real con PWA cerrada NO llegó — causa NO auditada, no se asume SW/FCM/Android/backend/permission)
ANDROID_NOTIFICATION_TAP_STATUS=NOT_TESTABLE_DUE_TO_CLOSED_PWA_DELIVERY_FAILURE
ANDROID_OFF_COLD_REOPEN_STATUS=PENDING
ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=PENDING_OPERATOR_CAPTURE (no solicitado activamente — pruebas pausadas)
```

Leonardo decidió PAUSAR, por decisión operativa (no técnica), las
pruebas físicas Android para priorizar primero el diseño de pagos con
Mercado Pago. La pausa **NO significa**: certificación de Android,
cierre de P2-T31, abandono del hallazgo de closed-PWA push
(`F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01`, nuevo, bloqueante para
certificación completa, investigación pausada), ni resolución del
`AbortError` histórico (que sigue `NOT_PROVEN`). **No se solicitó
ninguna prueba física nueva en esta tarea.** Los diagnósticos R6/R6A/
R6B se retienen sin cambios. Cuando Leonardo decida retomar, el próximo
paso físico es investigar la causa del fallo de entrega con PWA cerrada
(diagnóstico ya armado, sólo falta que Leonardo lo capture y copie) y,
después, la persistencia OFF tras cold reopen.

### Pagos — Mercado Pago (diseño completo, NADA implementado)

```text
PAYMENTS_DESIGN_AUTHORITY=codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md
MERCADOPAGO_BUSINESS_FEATURE_OPTIONAL=SI
PAYMENT_PROVIDER_V1=MERCADOPAGO / OTHER_WALLETS_STATUS=DEFERRED_UNTIL_DEMAND / QR_INTEROPERABLE_STATUS=FUTURE_NOT_V1
DELIVERY_FINANCIAL_OWNER=BUSINESS / DELIGO_MANAGES_DELIVERY_PAYOUTS=NO
DELIGO_SERVICE_FEE_PAYER=CLIENT / DELIGO_SERVICE_FEE_BUSINESS_COST=NO / DELIGO_SERVICE_FEE_CURRENT_AMOUNT_ARS=100 (parametrizable)
MP_SPLIT_DELIGO_FEE_GENERATES_BUSINESS_DEBT=NO / MP_SPLIT_DELIGO_FEE_COUNTS_TOWARD_BUSINESS_LIMIT=NO (efectivo SÍ genera deuda de la tarifa)
MP_PRICE_SUGGESTION_ENABLED_WHEN_CONNECTED=SI / MP_PRICE_SUGGESTION_IS_MANDATORY=NO / BUSINESS_RETAINS_FINAL_PRICE_CONTROL=SI
PRICE_SUGGESTION_PROTECTS_BUSINESS_NET=SI / PRICE_SUGGESTION_PROTECTS_DELIGO_FEE=SI / PRICE_SUGGESTION_GUARANTEED_NET=NO
CUSTOMER_VISIBLE_DELIGO_FEE_STAYS_CLEAN=SI / CUSTOMER_VISIBLE_MP_PROCESSING_FEE_LINE=NO
ONLINE_PAYMENTS_TERMS_REQUIRED=SI / ONLINE_PAYMENTS_EXPLICIT_ACCEPTANCE_REQUIRED=SI / LEGAL_REVIEW_BEFORE_PUBLIC_LAUNCH=REQUIRED
PAYMENT_PROOF_SCREENSHOTS_AUTHORITY=NO / PAYMENT_SERVER_VERIFICATION_REQUIRED=SI
ORDER_AND_PAYMENT_STATE_SEPARATION_REQUIRED=SI
PAYMENT_CAPTURE_POLICY=BUSINESS_ACCEPTED_AND_CUSTOMER_CANCEL_WINDOW_EXPIRED (AND, nunca OR) / CAPTURE_REQUIRES_BOTH=SI
PRE_CAPTURE_CANCELLATION_USES_REFUND=NO / PRE_CAPTURE_CANCELLATION_USES_AUTHORIZATION_CANCEL=SI
TARGET_PAYMENT_MODEL=MP_MARKETPLACE_SPLIT_1_TO_1 / DELIGO_HOLDS_FULL_SELLER_FUNDS=NO
MP_DEFERRED_CAPTURE_DOCUMENTED=SI (RESEARCHED) / MP_DEFERRED_CAPTURE_IMPLEMENTATION_CERTIFIED_FOR_DELIGO=NO
CREDIT/DEBIT/ACCOUNT_MONEY_DEFERRED_CAPTURE_STATUS=TO_VERIFY (spike obligatorio)
MP_SPLIT_DEFERRED_CAPTURE_COMBINATION_STATUS=REQUIRES_TECHNICAL_SPIKE
DELIGO_REFUND_SHORTFALL_50_PERCENT_POLICY=NOT_ADOPTED_PENDING_POST_CAPTURE_REFUND_RESEARCH (explícitamente rechazada por ahora, no descartada para siempre)
POST_CAPTURE_REFUND_STATUS=EXCEPTIONAL_FLOW_TO_DESIGN / POST_CAPTURE_REFUND_RESEARCH_REQUIRED=SI
PRE_CAPTURE_CANCELLATION_CUSTOMER_COPY_MUST_NOT_SAY_REFUND=SI
```

Leonardo definió el diseño económico y técnico completo de Mercado
Pago, persistido íntegro en
`codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md` (autoridad primaria de
detalle — este resumen es sólo síntesis) con 4 categorías estrictas:
DECIDED (decisión de negocio ya tomada), RESEARCHED (investigado, no
certificado contra DeliGO), TO_VERIFY (requiere spike/investigación
antes de decidir), y NOT_IMPLEMENTED (nada de esto existe en código
todavía). El punto crítico de esta ronda: Mercado Pago es opcional por
negocio, conectado vía OAuth one-click (nunca credenciales técnicas en
un formulario DeliGO); delivery pertenece económicamente al negocio;
la tarifa DeliGO ($100 ARS, parametrizable) la paga el cliente; un pago
en efectivo SÍ genera deuda de esa tarifa para el negocio, un pago vía
MP Split NUNCA la genera; el precio sugerido es una estimación (nunca
garantía) que protege tanto el neto del negocio como que "Servicio
DeliGO = $100" se muestre limpio, sin desglosar el costo de
procesamiento MP; la regla central de captura es
`BUSINESS_ACCEPTED AND CUSTOMER_CANCEL_WINDOW_EXPIRED` (condición AND,
nunca OR); la cancelación pre-capture usa cancelación de autorización,
nunca refund; el modelo objetivo es split marketplace 1:1; y la
propuesta de que DeliGO cubra el 50% de un shortfall de refund quedó
explícitamente `NOT_ADOPTED` (no una promesa, sólo una idea a
investigar más). La compatibilidad de deferred capture por medio de
pago (crédito/débito/dinero en cuenta) y la combinación Split+
`capture=false` end-to-end quedan `TO_VERIFY` — **spike técnico
obligatorio en sandbox** (`MERCADOPAGO_SPLIT_DEFERRED_CAPTURE_
COMPATIBILITY_SPIKE`) antes de implementar cualquier cosa. Nada de esto
tiene código todavía: sin rutas, sin modelos, sin webhooks, sin OAuth,
sin UI, sin migraciones. Reporte de esta tarea:
`PAYMENTS_CONTEXT_PERSISTENCE_AND_ANDROID_TEST_PAUSE_REPORT.md`.

## 0.14 ESTADO ANTERIOR — CREACIÓN FÍSICA ANDROID CERTIFICADA 3/3, MATRIZ DE ENTREGA/PERSISTENCIA PENDIENTE (2026-09-06/07) — EVIDENCIA POSTERIOR Y PAUSA REGISTRADAS ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_DELIVERY_PERSISTENCE_MATRIX
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ANDROID_POST_R13A_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
ABORTERROR_REPRODUCED_POST_R13A_3_OF_3=NO / ABORTERROR_FIXED_BY_DELIGO=NO_EVIDENCE
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
ANDROID_PERMISSION_DEFAULT_WITH_ACTIVE_SUBSCRIPTION_STATUS=OBSERVED_UNEXPLAINED_MULTIPLE_PLAUSIBLE_CAUSES_NOT_ISOLATED (no bloquea)
ANDROID_ON_COLD_REOPEN_STATUS=PASS / OFF_COLD_REOPEN/FOREGROUND_PUSH/CLOSED_PWA_PUSH/NOTIFICATION_TAP=PENDING
ANDROID_PUSH_STATUS=PARTIAL_CREATE_RELIABILITY_CERTIFIED_PENDING_DELIVERY_AND_PERSISTENCE_MATRIX
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_FOREGROUND_AND_CLOSED_PWA_PUSH_DELIVERY_PLUS_TAP_THEN_OFF_PERSISTENCE
```

Las 3 creaciones físicas post-R13A (sobre el build ya desplegado
`8b49756...`) ejercitaron el camino de creación real (sin reuso, con
backend 200 real) sin reproducir `AbortError` ninguna vez — el
reliability gate de creación física Android queda formalmente CERRADO.
Esto NO significa que la causa del `AbortError` original haya sido
identificada ni arreglada: certifica que el camino de código mostró
estabilidad suficiente bajo el criterio ya definido (3/3 consecutivos
post-fix), sin ningún retry/hack agregado. El hallazgo que antes
bloqueaba el avance (`F-P2-T31-R13-01`) se reclasifica a monitoreo no
bloqueante — se reabrirá si el `AbortError` reaparece en cualquier
prueba futura.

Se auditó, sin asumir, una anomalía real observada en el tercer
capture: `permission=default` simultáneo con subscription/backend/hook/
UI todos activos. Por auditoría de código se probó que esto es
lógicamente imposible como resultado de una revocación por JavaScript
(el permiso tuvo que ser `granted` en el instante exacto de esa misma
creación exitosa, y ninguna API de JS permite revertirlo). No se
identificó como bug de DeliGO — evidencia de plataforma (repositorios
oficiales de Google y de PWABuilder, citados explícitamente como
evidencia de un patrón real, no como spec formal) documenta que Android
mantiene dos capas de permiso de notificación independientes para PWAs
instaladas: el permiso de origen web (lo que `Notification.permission`
reporta a la página) y el permiso de sistema operativo
(`POST_NOTIFICATIONS`, Android 13+), que pueden divergir entre sí. No
se tocó ningún código. Esta anomalía NO bloquea las pruebas de entrega
pendientes — se resolverá empíricamente observando si la entrega real
de push funciona durante esas mismas pruebas.

Matriz Android Cliente actualizada: la persistencia de ON tras cold
reopen ya quedó certificada (evidencia ya obtenida en los ciclos 1/3 y
2/3, no se repite). Quedan pendientes: persistencia OFF tras cold
reopen, push real en foreground, push real con la PWA cerrada, tap de
notificación, y la confirmación explícita de que Leonardo vio el
diálogo nativo de permiso Android (no documentada todavía en ningún
ciclo — no se inventa ese `PASS`). Se preparó (sin ejecutar) el orden
mínimo recomendado: foreground → PWA cerrada (reutilizando la misma
notificación para el tap, igual que iPhone C7→C8) → persistencia OFF al
final, evitando reinstalar la PWA innecesariamente ahora que la
creación ya está certificada.

Cliente iPhone permanece `CERTIFIED_TESTING` sin reabrirse; Negocio/
Repartidor siguen exactamente como R11 los dejó; los diagnósticos se
retienen; P2-T31 no cierra. Reporte completo:
`P2_T31_R14_ANDROID_CREATE_RELIABILITY_CLOSEOUT_AND_REMAINING_MATRIX.md`.

## 0.13 ESTADO ANTERIOR — FIX DE UI STALE DESPLEGADO EN TESTING, RELIABILITY GATE ANDROID REINICIADO EN 0/3 (2026-09-06) — CREACIÓN FÍSICA CERTIFICADA POR R14 ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_ABORTERROR_ROOT_CAUSE_OR_MITIGATION
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ANDROID_PUSH_STATUS=FAIL_REPRODUCED_ABORTERROR_DURING_PHYSICAL_CREATE_PENDING_ROOT_CAUSE (sin cambios — no certificado)
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
STALE_UI_IS_DELIGO_BUG=SI (corregido y VERIFICADO EN TESTING)
SECONDARY_FAILURE_EXACT_THROW_SITE=NOT_DIRECTLY_OBSERVED (wording de R13 corregido)
INDEPENDENT_LOG_FAILURE_BOUNDARY=SI / INDEPENDENT_TOAST_FAILURE_BOUNDARY=SI
ANDROID_RELIABILITY_GATE_POST_FIX_START=0_OF_3
HEAD=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_TESTING=8b49756e76a32b2641bd1099c1e8382d3be32f25
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=SI (desplegado — hardening de reportMutationFailureSafely)
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_POST_R13A_CLEAN_CREATE_1_OF_3
```

Antes de commitear el fix de R13, se revisó en dos puntos exigidos por
esta tarea. Primero, la precisión de la causa secundaria: re-auditado el
`catch` exacto, se confirmó por eliminación (todas las demás expresiones
evaluadas en esa ventana son funciones puras, auditadas con certeza) que
una excepción secundaria SÍ ocurrió, pero se corrigió el wording de R13
para no afirmar CUÁL de las dos llamadas nativas/de terceros
(`console.error`/`toast.error`) fue la causante exacta — nunca observado
directamente. Segundo, el aislamiento de ambas llamadas: el helper de
R13 tenía un único `try/catch` compartido, suficiente para que
`finishMutation` siempre corriera pero insuficiente para garantizar que
el toast se intentara si el logging fallaba primero. Se separó en DOS
boundaries de excepción independientes, verificados con 5 tests
directos que cubren exactamente esa matriz: logger falla + toast SE
INTENTA igual, sólo el toast falla, ambos fallan, sin mensaje → sin
toast, camino normal.

581/581 tests en verde, ESLint limpio, TypeScript estable. Cero cambio
de comportamiento en el camino feliz, sin retry automático, sin rama
Android, sin cambios a backend/Service Worker/VAPID. Commiteado
(`8b49756...`, hijo de `085cc0b...`), pusheado a `testing-codex`,
desplegado en Railway TESTING (deployment `5de51131`, commit exacto
confirmado). Smokes HTTP/guard en verde, logs limpios. Production
intacta.

Android NO se certifica todavía. Se registró explícitamente el
contrato de evaluación para el próximo capture físico: si `AbortError`
reaparece, un `FAIL` de creación cuyo estado de fallo se mantiene
consistente (`hookSubscribed=false`, `uiSwitch=false`, sin backend, sin
success feedback falso) es un resultado VÁLIDO — `PASS` del
failure-state-contract, sin exigir que el `AbortError` en sí
desaparezca (no se implementó ningún retry/hack para "arreglarlo"). El
reliability gate Android se reinicia en `0/3` — no se reutiliza el
Clean Create 1/3 anterior, porque el código del error path cambió.
Cliente iPhone permanece `CERTIFIED_TESTING`; Negocio/Repartidor sin
cambios (R11); diagnósticos retenidos; P2-T31 no cierra. Reporte
completo: `P2_T31_R13A_PUSH_FAILURE_REPORTING_HARDENING_TESTING_DEPLOY.md`.

## 0.12 ESTADO ANTERIOR — ANDROID: ABORTERROR REAL REPRODUCIDO, BUG DE UI STALE ENCONTRADO Y CORREGIDO LOCALMENTE (2026-09-06) — DESPLEGADO Y ENDURECIDO POR R13A ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_ABORTERROR_ROOT_CAUSE_OR_MITIGATION
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ANDROID_RELIABILITY_GATE_RESULT=FAIL_ON_CYCLE_2_OF_3
ANDROID_PUSHMANAGER_SUBSCRIBE_ERROR_CLASS=AbortError
ANDROID_PHYSICAL_CREATE_HISTORY=FAIL_NO_SETTLE, PASS, PASS, FAIL_ABORTERROR
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
STALE_UI_IS_DELIGO_BUG=SI / FIX_IMPLEMENTED=SI
ANDROID_PUSH_STATUS=FAIL_REPRODUCED_ABORTERROR_DURING_PHYSICAL_CREATE_PENDING_ROOT_CAUSE
HEAD=085cc0b540f51a841115697eb25dbf98d3740023 (sin cambios — fix LOCAL, sin commit)
ORIGIN_TESTING=085cc0b540f51a841115697eb25dbf98d3740023
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=SI (fix local: reportMutationFailureSafely — cero cambio de comportamiento en el camino feliz)
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=P2-T31-R13A-ABORTERROR-UI-FIX-TESTING-DEPLOY
```

El reliability gate de 3 ciclos consecutivos (definido en R12B) falló en
el ciclo 2/3: esta vez `PushManager.subscribe()` sí se asentó, pero por
RECHAZO — `AbortError` en ~287ms, reemplazando para este intento la
hipótesis de "Promise pendiente" de los fallos anteriores. Auditoría
profunda consultó explícitamente el W3C Push API spec para clasificar
`AbortError` con precisión: es el rechazo GENÉRICO del propio servicio
push del navegador (permiso, Service Worker inactivo y VAPID inválido
tienen sus PROPIOS códigos de error distintos — `NotAllowedError`/
`InvalidStateError`/`NotSupportedError` — ninguno de esos aplica aquí).
La comunidad Chromium documenta que en Chrome esto suele originarse en
un fallo del registro interno del navegador con el servicio de FCM de
Google — plausible para este caso, pero **no confirmado**, nunca
observable desde código de aplicación. Permission/VAPID/backend quedaron
descartados con evidencia directa; el registro cross-remount de R2 se
comportó correctamente.

**Hallazgo independiente, real, y ya corregido**: la traza probó que
`SUBSCRIBE_FINISH` (documentado desde R12 como incondicional) nunca se
registró en este capture, y el snapshot mostró el hook correctamente en
`false` pero el switch visual quedando en `true` — una divergencia real.
Auditoría de código probó, por eliminación, que `console.error`/
`toast.error` (sin ninguna protección propia) podían lanzar dentro del
`catch`, saltándose `finishMutation` por completo — lo que rompía el
patrón de corrección optimista ya existente en Cliente
(`client-profile-panel.tsx`) y Negocio (`config-tab.tsx`): el switch
quedaba mostrando "activado" para siempre pese a que el hook sabía la
verdad. Repartidor no está expuesto a este patrón. Corregido con una
nueva función pura (`reportMutationFailureSafely`) que garantiza que la
traza y `finishMutation` corran siempre, sin importar qué falle en el
logging/feedback — cero cambio de comportamiento en el camino feliz,
R7/R8 intactos, sin retry/delay/hack Android, 580/580 tests en verde.

Android sigue sin certificar. El reliability gate NO se reanuda todavía
— este fix necesita su propio deploy y verificación en TESTING antes de
reiniciar el gate desde 0/3 (el código cambió). Cliente iPhone permanece
`CERTIFIED_TESTING`; Negocio/Repartidor sin cambios (R11); los
diagnósticos se retienen; P2-T31 no cierra. Reporte completo:
`P2_T31_R13_ANDROID_PUSHMANAGER_ABORTERROR_AND_STALE_UI_ROOT_CAUSE.md`.

## 0.11 ESTADO ANTERIOR — ANDROID: 1 FAIL + 1 PASS SOBRE EL MISMO BUILD, GATE DE CONFIABILIDAD DEFINIDO (2026-09-06) — SUBSCRIBE_FINISH Y UI STALE CORREGIDOS POR R13 ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_RELIABILITY_GATE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ORIGINAL_ANDROID_PHYSICAL_RESULT=FAIL
ANDROID_R12_RETEST_VISUAL_RESULT=ON
FUNCTIONAL_FIX_BETWEEN_FAIL_AND_PASS=NO
ROOT_CAUSE_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
ANDROID_PUSH_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
INTERMITTENCY_CONFIRMED=SI / UNDERLYING_CAUSE_CONFIRMED=NO
HEAD=085cc0b540f51a841115697eb25dbf98d3740023 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=085cc0b540f51a841115697eb25dbf98d3740023
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
ANDROID_OFF_REMOVES_PHYSICAL_SUBSCRIPTION=NO
ANDROID_RELIABILITY_REPEAT_COUNT_AUTHORITY=NINGUNA_ENCONTRADA (propuesto: 3 ciclos consecutivos de creación física genuina)
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_FIRST_SUBSCRIBE_RELIABILITY_GATE_3_CONSECUTIVE_CLEAN_CREATES
```

Leonardo repitió el retest físico Android sobre el MISMO build ya
desplegado (`085cc0b`, sólo instrumentación agregada en R12, cero
cambio de comportamiento) y esta vez el flujo de activación completó
limpio de punta a punta: creación física real en ~1910ms
(`SUBSCRIBE_PHYSICAL_CREATE_START`→`RESULT`), backend 200, switch final
ON. La traza probó con evidencia DIRECTA (no sólo por auditoría de
código, como antes) que el unmount de React nunca cancela la mutación
en curso: el ACK del backend llegó igual con el hook viejo ya
desmontado, y el registro cross-remount de R2 liberó la mutación
~1169ms antes de que el remount siquiera ocurriera — por eso el remount
correctamente no encontró nada pendiente que esperar (comportamiento
esperado, no un fallo de R2). La conexión propuesta con
`AUTH_HYDRATION_PUSH_RACE` sigue descartada para este incidente
específico; el hallazgo global permanece abierto para otros escenarios.

**Punto central, explícito**: no hubo ningún cambio de código entre el
FAIL original y este PASS — es el mismo build exacto. Por tanto no se
declara "bug arreglado" ni "causa confirmada" en ningún lugar. Existe
intermitencia CONFIRMADA (1 FAIL + 1 PASS sobre el mismo flujo), pero la
causa subyacente sigue sin confirmar — no se atribuye a suspensión de
Android en background, a un bug de Chrome, ni a ninguna otra teoría
específica sin evidencia directa de esa causa.

Auditando el código de `unsubscribe()` se confirmó que apagar
notificaciones NUNCA destruye la `PushSubscription` física del
navegador (`SERVER_DETACH_ONLY`, invariante de P2-T05 preservado) — por
lo que un simple ciclo OFF→ON no sirve para repetir el camino de
creación física que fue el que falló originalmente. Se diseñó, sin que
exista una autoridad previa que lo exija, un gate de confiabilidad
conservador: **3 ciclos consecutivos de creación física genuina** (con
un reset real de la subscription entre cada intento — reinstalar la PWA
o revocar el permiso de notificaciones del sitio, nunca sólo tocar el
switch) antes de poder considerar certificado el flujo de activación en
Android. Android NO se certifica todavía. Cliente iPhone permanece
`CERTIFIED_TESTING` sin reabrirse; Negocio/Repartidor siguen exactamente
como R11 los dejó; P2-T31 no cierra; los diagnósticos se retienen (esta
misma captura volvió a demostrar su valor). Reporte completo:
`P2_T31_R12B_ANDROID_FAIL_PASS_RECONCILIATION_AND_RELIABILITY_GATE.md`.

## 0.10 ESTADO ANTERIOR — DIAGNÓSTICO ANDROID DESPLEGADO EN TESTING, PENDIENTE RETEST FÍSICO (2026-09-06) — RECONCILIADO POR R12B ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_ROOT_CAUSE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
ANDROID_PUSH_STATUS=FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE
ROOT_CAUSE_STATUS=NOT_CONCLUSIVELY_PROVEN_LEADING_HYPOTHESIS_IDENTIFIED (sin cambio)
HEAD=085cc0b540f51a841115697eb25dbf98d3740023
ORIGIN_TESTING=085cc0b540f51a841115697eb25dbf98d3740023
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
TESTING_DEPLOYMENT_ID=13800b1d-7f00-44b7-8c42-e7b397446d2a
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=SI (diagnóstico puro, 0 cambio de comportamiento — ya desplegado)
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_R12_SINGLE_PHYSICAL_RETEST
```

**Corrección factual aplicada antes de este deploy**: R12 había afirmado
incorrectamente que la traza física no incluía el campo `actorFamily` de
`SUBSCRIBE_START`. La traza original de Leonardo SÍ lo incluye:
`actorFamily=cliente`, `authHasHydrated=true`. Auditoría de
`src/store/auth-store.ts` probó que `AuthUser.id`/`.type` se asignan
atómicamente en el mismo objeto literal en las 4 acciones de login —
estructuralmente imposible que `actorFamily=cliente` coexista con
`actorId=null`. Esto **descarta, para este incidente Android
específico**, la conexión que R12 había propuesto con el hallazgo
estructural `AUTH_HYDRATION_PUSH_RACE` (que no se reclasifica en sí,
sigue abierto para otros escenarios). La causa de por qué el registro
cross-remount de R2 no protegió este caso concreto queda genuinamente
sin resolver (`R2_REGISTRY_CAUSE_CURRENTLY=UNRESOLVED_PENDING_NEW_TRACE`)
— no se inventó una hipótesis de reemplazo. `ROOT_CAUSE_STATUS` se
mantiene exactamente como máximo, sin escalar ninguna hipótesis a
`CONFIRMED`.

Con la corrección aplicada, la instrumentación diagnóstica pura de R12
(`SUBSCRIBE_PHYSICAL_CREATE_START/RESULT/ERROR` bracketeando el único
`await` indocumentado; `MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/
WAIT_NOT_FOUND` en el registro cross-remount — cero cambio de
comportamiento, verificado) fue commiteada en un único commit
(`085cc0b...`, hijo directo de `70d3f826...`), pusheada a
`testing-codex` y desplegada en Railway TESTING (deployment `13800b1d`,
`SUCCESS`, commit exacto confirmado). Smokes HTTP/guard y logs en verde.
Production intacta. Cliente iPhone permanece `CERTIFIED_TESTING` sin
reabrirse; Android permanece `FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_
PENDING_ROOT_CAUSE`, no se marca PASS; P2-T31 no cierra. Se preparó (sin
ejecutar) el protocolo de un único retest físico Android para Leonardo:
cerrar la PWA, reabrir (carga el build nuevo), armar traza, borrar
historial, activar notificaciones una sola vez y reproducir el mismo
patrón que causó el fallo original (activar → navegar fuera de Perfil →
volver), sin toggles adicionales. Reporte completo:
`P2_T31_R12A_ANDROID_DIAGNOSTICS_TESTING_DEPLOY_PENDING_PHYSICAL_RETEST.md`.

## 0.9 ESTADO ANTERIOR — FALLO FÍSICO REAL EN ANDROID CAPTURADO Y AUDITADO, SIN FIX (CAUSA NO PROBADA) (2026-09-06) — CORREGIDO Y DESPLEGADO POR R12A ARRIBA

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_ROOT_CAUSE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
BUSINESS_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED_FORMALLY (Negocio, evidencia incidental positiva, no formal)
DELIVERY_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED (Repartidor)
ANDROID_PUSH_STATUS=FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios — R12 es LOCAL, sin commit/deploy)
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R12_FOCAL_PASS=574 / R12_FOCAL_FAIL=0
ROOT_CAUSE_STATUS=NOT_CONCLUSIVELY_PROVEN_LEADING_HYPOTHESIS_IDENTIFIED
FIX_IMPLEMENTED=NO (sólo instrumentación diagnóstica, cero cambio de comportamiento)
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=SI (diagnóstico puro)
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=P2-T31-R12-ANDROID-FIRST-SUBSCRIBE-PHYSICAL-CREATION-FAILURE-RETEST (deploy + único retest físico) — LEONARDO_IPHONE_BUSINESS_DELIVERY_PUSH_PHYSICAL_MATRIX sigue disponible en paralelo
```

Leonardo reprodujo un fallo físico REAL en Android: activó
notificaciones en Cliente/Perfil, cambió de pantalla y volvió — el
switch quedó OFF. Auditoría exhaustiva de código (no inferencia) probó
que el único punto de espera ejecutado en la ventana sin trace
(`registration.pushManager.subscribe(...)`, en `use-push-notifications.ts`)
nunca se asentó — ni éxito ni excepción — durante toda la captura: las
trazas incondicionales que ya existían para ambos desenlaces
(`SUBSCRIBE_NEW_PHYSICAL_RESULT`/`SUBSCRIBE_FINISH`) simplemente no
aparecieron, pese a que el mismo proceso JS siguió vivo en todo momento
(mismo `processInstanceId` antes y después del remount — descarta un
reload completo de página). Backend, el fix de rate-limit de R8 y el
fix de flicker de R7 quedaron descartados como causa con evidencia
directa (el fallo ocurre 100% antes de que el backend sea siquiera
contactado).

La causa raíz de fondo NO quedó probada de forma concluyente. La
hipótesis mejor sustentada es que Android suspendió o abandonó ese
`await` nativo específico al perder el foreground de la pestaña — un
comportamiento de plataforma fuera del control de DeliGO, no un bug de
código. Por qué el registro cross-remount de R2 no pudo proteger este
caso concreto queda por separado SIN RESOLVER — R12A corrigió que la
traza SÍ mostraba `actorFamily=cliente`/`authHasHydrated=true` en
`SUBSCRIBE_START`, lo que descarta (para este incidente específico,
auditando `auth-store.ts`) la conexión que se había propuesto con el
hallazgo estructural `AUTH_HYDRATION_PUSH_RACE`. Por
regla explícita de la tarea, no se inventó ningún fix sin causa probada
ni se agregaron hacks específicos de Android/delays artificiales. Se
agregó únicamente instrumentación de traza mínima —
`SUBSCRIBE_PHYSICAL_CREATE_START/RESULT/ERROR` bracketeando ese
`await` exacto, y `MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/WAIT_NOT_FOUND`
en el registro de mutaciones en vuelo — de forma local (sin commitear ni
desplegar), con cero cambio de comportamiento: 574/574 tests en verde,
ESLint limpio, 0 nuevos errores TypeScript.

Nota de secuencia (transparencia, sin reescribir historia): el prompt
de esta tarea daba a R11 por pendiente de ejecutar; en los hechos R11 ya
se había completado por entero en el turno anterior de esta misma
sesión (reabrió P2-T31 por Negocio/Repartidor faltantes en iPhone,
preservando Cliente C1-C8 intacto). Este hallazgo Android se suma como
un SEGUNDO blocker, distinto y cross-platform, sobre ese mismo estado ya
reabierto — no lo reemplaza ni lo revierte. Reporte completo:
`P2_T31_R12_ANDROID_FIRST_SUBSCRIBE_PHYSICAL_CREATION_FAILURE_DIAGNOSTIC.md`.

## 0.8 ESTADO ANTERIOR — P2-T31 REABIERTO: CLIENTE CERTIFICADO, NEGOCIO/REPARTIDOR PENDIENTES (2026-09-06)

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (Cliente C1-C8, preservado sin cambios)
BUSINESS_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED_FORMALLY (evidencia incidental positiva registrada, no formal)
DELIVERY_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
AUTH_HYDRATION_PUSH_RACE_STATUS=OPEN_STRUCTURAL_GAP_PROVEN_IMPACT_PLAUSIBLE_NOT_CONFIRMED
PUSH_LIMITER_DISTRIBUTION_MODEL=IN_MEMORY_PROCESS_LOCAL
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=LEONARDO_IPHONE_BUSINESS_DELIVERY_PUSH_PHYSICAL_MATRIX
```

R10 (turno anterior) había cerrado P2-T31 completo usando sólo la
certificación física de Cliente (C1-C8 PASS), razonando que Negocio y
Repartidor comparten hook/endpoints/tests con Cliente. Esta tarea
auditó la autoridad ORIGINAL que definió la matriz física
(`P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`) y
encontró lenguaje imperativo sin excepción: "para cada rol **debe**
cubrirse... Cliente C1–C8, Negocio N1–N7 y Repartidor R1–R7... ningún
pass por rol **ni cierre de P2-T31** sin evidencia física". Código y
tests compartidos demuestran cobertura técnica, no evidencia física por
rol — ninguna autoridad concedió esa equivalencia. El cierre global de
R10 fue, por tanto, **prematuro** y se corrige aquí, sin degradar en
absoluto la certificación de Cliente (que permanece PASS, íntegra y
trazable).

Evidencia incidental nueva, registrada tal cual sin sobre-interpretar:
antes de esta tarea Leonardo probó Negocio físicamente de forma informal
y encontró que las notificaciones — que antes fallaban — ahora funcionan
tras los fixes R7/R8 (`BUSINESS_PUSH_INCIDENTAL_EVIDENCE=PASS_OBSERVED`).
Es una señal positiva real, pero no cierra ningún caso `N#` individual
porque no tiene la estructura de diagnóstico (traza armada, snapshot,
verificación de duplicados/contenido) que los demás casos físicos de
T31 sí tienen.

Se preparó (sin ejecutar) una matriz física N1-N7/R1-R7 con
instrucciones exactas para Leonardo, reutilizando los diagnósticos
R6/R6A/R6B ya desplegados en TESTING sin necesidad de reinstalar la PWA.
Android permanece `UNKNOWN_NOT_CERTIFIED` sin cambios, y los
diagnósticos siguen retenidos por decisión del operador — ahora con una
segunda razón además de Android: sirven directamente para ese retest
Negocio/Repartidor. Reporte completo:
`P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md`.

## 0.7 ESTADO ANTERIOR — P2-T31 CERRADO (CORREGIDO POR R11 ARRIBA): IPHONE PUSH (CLIENTE) CERTIFICADO EN TESTING (2026-09-06)

```text
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
IPHONE_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING
IPHONE_CLIENT_PUSH_MATRIX=C1_THROUGH_C8_PASS
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R7_FLICKER_ROOT_CAUSE=UNRESOLVED_INITIAL_PUSH_STATE_RENDERED_AS_FALSE_OFF
R8_STRESS_FAILURE_ROOT_CAUSE=PUSH_API_RATE_LIMIT_429
PUSH_LIMITER_MODEL=pushStatus(60/min) + pushMutation(20/min), buckets independientes
STATUS_ERROR_SECURITY_MODEL=FAIL_CLOSED_WITHOUT_FALSE_OFF_REPRESENTATION
AUTH_HYDRATION_PUSH_RACE_STATUS=OPEN_STRUCTURAL_GAP_PROVEN_IMPACT_PLAUSIBLE_NOT_CONFIRMED (residual no bloqueante)
PUSH_LIMITER_DISTRIBUTION_MODEL=IN_MEMORY_PROCESS_LOCAL (residual no bloqueante)
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=P2-T27 (Order State DB-level CAS) — ver roadmap
```

Leonardo ejecutó el procedimiento de reset limpio en su iPhone (borrar +
reinstalar la instancia de la PWA en el Home Screen) y realizó la
primera activación real de notificaciones contra el build actual: el
diálogo nativo de permiso de iOS apareció, aceptó, la activación
terminó end-to-end en ON con feedback correcto, y el estado persistió
tras un cierre completo + reapertura de la PWA. Esto satisface el caso
C1 (primera activación limpia) que había quedado diferido desde el
inicio de la certificación física de T31. Con C1 resuelto y C2-C8 ya
certificados previamente (R9), la matriz completa de Cliente queda
`C1_THROUGH_C8_PASS` y **P2-T31 cierra formalmente** como
`CLOSED_TESTING_CERTIFIED`.

Esta certificación cubre específicamente **iPhone, Cliente, TESTING** —
no implica nada sobre Production (que permanece en `1de0d3c1...`, sin
los fixes R7/R8) ni sobre Android (`ANDROID_PUSH_STATUS` sigue
independientemente `UNKNOWN_NOT_CERTIFIED`, sin dispositivo físico
disponible). Tampoco implica una certificación física independiente de
Negocio o Repartidor — ambos comparten el mismo hook y los mismos fixes
R1/R7/R8 con cobertura de test estático que Cliente, pero nunca fueron
ejercidos físicamente por separado; esto queda documentado como
`F-P2-T31-R10-01` (no bloqueante) para una eventual tarea futura.

**Decisión explícita del operador**: pese al cierre de iPhone, los
diagnósticos R6/R6A/R6B (panel de debug, timeline de traza, snapshot,
bootstrap de cold-launch, guard TESTING) se retienen intactos —
NINGÚN cleanup se ejecuta ni se recomienda todavía — porque Android
sigue sin certificar y Leonardo quiere conservar esa instrumentación
para la certificación física Android futura. Son exclusivamente
TESTING; Production nunca tuvo acceso a ellos.

La siguiente acción recomendada NO es un cleanup: se derivó del
ROADMAP real excluyendo cualquier ítem bloqueado por el mismo
dispositivo Android ausente. `P2-T02` (Android GPS) sigue
`READY_TO_RESUME` pero bloqueado por hardware; `P2-T27` (Order State
DB-level CAS) es el siguiente ítem `QUEUED` ejecutable sin depender de
Android — su única dependencia (finding de P2-T28) ya está resuelta.
Reporte completo: `P2_T31_R10_IPHONE_CERTIFICATION_FINAL_CLOSEOUT.md`.

## 0.6 ESTADO ANTERIOR — EVIDENCIA FÍSICA RECONCILIADA: C2-C8 PASS, C1 PENDIENTE (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R9-IPHONE-PHYSICAL-CERTIFICATION-RECONCILIATION
P2_T31_STATUS=IN_PROGRESS_PENDING_C1_CLEAN_FIRST_ENABLE
IPHONE_PUSH_CERTIFICATION_STATUS=PARTIAL_PENDING_C1_CLEAN_FIRST_ENABLE
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios — tarea de audit puro)
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
C2_PHYSICAL_STATUS=PASS_COVERED_BY_R8_STRESS
C3_PHYSICAL_STATUS=PASS (5/5 remounts, 0 flicker, cold reopen final ON)
C4_R7_PHYSICAL_STATUS=PASS_USER_VISIBLE_CONTRACT
C5_BASIC_PHYSICAL_STATUS=PASS_5_PLUS_REPEATS
R8_STRESS_PHYSICAL_STATUS=PASS (8/8 ciclos, 0 429 reales)
C6_FOREGROUND_PUSH_STATUS=PASS
C7_CLOSED_PWA_PUSH_STATUS=PASS
C8_NOTIFICATION_TAP_STATUS=PASS
C1_CURRENT_BUILD_PHYSICAL_STATUS=NOT_RECERTIFIED_CLEAN_STATE
PRODUCT_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=LEONARDO_C1_CLEAN_FIRST_ENABLE_PHYSICAL_TEST
```

Tarea de auditoría pura (sin código, sin tests, sin commit/push/deploy)
que reconcilió toda la evidencia física reportada por Leonardo tras R7 y
R8. C2 a C8 quedan PASS con evidencia trazable a reportes concretos —
incluyendo el retest de stress de R8 (8/8 ciclos ON/OFF, 0 HTTP 429
reales, feedback correcto, estado final correcto tanto en OFF como en
ON). El único gate sin cerrar es **C1** — primera activación real de
notificaciones desde un estado de permiso `Notification.permission`
verdaderamente limpio: el iPhone de Leonardo ya tiene permiso concedido
y una `PushSubscription` física histórica desde etapas muy tempranas de
T31 (R1/R2), así que todo el ciclo OFF→ON certificado hasta ahora es un
re-enable, no un first-enable contra el build actual (`70d3f826...`, con
R7+R8 ya desplegados).

Este gap no es nuevo ni fue descubierto ahora por casualidad: el reporte
original que definió la matriz física de T31 ya había diferido
explícitamente este caso exacto el día que se preparó la certificación
(`PERMISSION_PROMPT_PHYSICAL_CASE=DEFERRED_NOT_SAFELY_REPRODUCIBLE`, en
`codex-reports/P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`),
precisamente porque el entorno físico compartido de Leonardo no permite
reproducirlo sin una acción deliberada (borrar y reinstalar la PWA). Esa
acción — documentada paso a paso en
`codex-reports/DECISIONS_AND_INVARIANTS.md` bajo
`IOS_PUSH_CLEAN_STATE_RESET_METHOD` — nunca fue solicitada ni ejecutada
en ningún punto de T31 hasta ahora. Por disciplina anti-invención, ni
`IPHONE_PUSH_CERTIFICATION_STATUS` ni `P2_T31_STATUS` se marcan como
cerrados: quedan `PARTIAL_PENDING_C1_CLEAN_FIRST_ENABLE` e
`IN_PROGRESS_PENDING_C1_CLEAN_FIRST_ENABLE` respectivamente. Android
permanece `UNKNOWN_NOT_CERTIFIED` sin cambios. Los diagnósticos R6/R6A/
R6B se mantienen desplegados hasta el cierre total de T31. Reporte
completo: `P2_T31_R9_IPHONE_PHYSICAL_CERTIFICATION_RECONCILIATION.md`.

## 0.5 ESTADO ANTERIOR — FIX R8 DESPLEGADO EN TESTING, PENDIENTE RETEST FÍSICO DE STRESS (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R8-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST
CURRENT_TASK_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
P2_T31_STATUS=IN_PROGRESS
P2_T31_R8_DEPLOY_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R8_STRESS_RETEST
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
COMMIT_HASH=70d3f826bef291f403f0e42e007187eb1b5d6688
COMMIT_PARENT=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
HEAD=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_TESTING=70d3f826bef291f403f0e42e007187eb1b5d6688
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambios)
TESTING_DEPLOYMENT_ID=58f4e0a3-e562-4527-928f-e6880fbb3c09
R8_FOCAL_PASS=551
TYPECHECK_BASELINE=24
ESLINT_ON_FILESET=CLEAN
ABUSE_RESISTANCE_PRESERVED=SI
PRODUCTION_TOUCHED=NO
STATUS_ERROR_SECURITY_MODEL=FAIL_CLOSED_WITHOUT_FALSE_OFF_REPRESENTATION (nuevo invariante permanente, ver codex-reports/DECISIONS_AND_INVARIANTS.md)
NEXT_ACTION=LEONARDO_R8_PUSH_STRESS_PHYSICAL_RETEST
NEXT_RECOMMENDED_TASK=NINGUNA — el propio prompt de esta tarea indica STOP hasta el retest físico de Leonardo
```

El fix local de R8 (bucket de rate limit dividido en `pushStatus`/
`pushMutation` + `applyStatusUnresolved` para nunca representar un error
de status como OFF autoritativo) fue commiteado como `70d3f826...` (15
archivos: 13 modificados + 2 nuevos, re-derivados directamente de `git`
antes de cada etapa, sin confiar en el reporte de implementación previo),
pusheado a `testing-codex` y desplegado en Railway TESTING
(`58f4e0a3-e562-4527-928f-e6880fbb3c09`), verificado corriendo
exactamente ese commit. Certificado localmente: 551 tests focales en
verde, TypeScript sin regresiones (24 baseline), ESLint limpio en el
fileset exacto, smokes HTTP (`/`, `/cliente`, `/negocio`, `/repartidor`)
y guard de debug (`/api/push/debug-guard` → `200 {"allowed":true}`) en
verde, logs de despliegue limpios sin errores. Producción (`origin/main`)
sin tocar.

Pendiente exclusivamente de Leonardo: el retest físico de stress en su
iPhone (protocolo de 8 ciclos ON/OFF con cooldown inicial de 65s,
documentado en el reporte de deploy) para certificar que el 429 real ya
no ocurre bajo uso humano normal y que, si ocurriera un error de
infraestructura genuino, el estado ya no se representa falsamente como
OFF. Esta tarea terminó con instrucción explícita de STOP — no se inicia
ninguna tarea Claude adicional hasta que Leonardo reporte el resultado
de ese retest.

## 0.4 ESTADO ANTERIOR — SEGUNDA CAUSA RAÍZ CONFIRMADA: 429 REAL EN STRESS DE NAVEGACIÓN, FIX LOCAL LISTO (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R8-PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX
CURRENT_TASK_STATUS=LOCAL_FIX_IMPLEMENTED_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
P2_T31_R8_STATUS=LOCAL_FIX_IMPLEMENTED_PENDING_REVIEW
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R8_RATE_LIMIT_FIX
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
PUSH_STRESS_FAILURE_ROOT_CAUSE=PUSH_API_RATE_LIMIT_429
STATUS_FALSE_MISREPRESENTATION_CAUSE=BACKEND_STATUS_NON_OK_MAPPED_TO_AUTHORITATIVE_FALSE
HEAD=6380ba2b77ffe6bee1b978ef1e2480da233e61c2 (sin cambios — el fix de R8 es SÓLO LOCAL)
ORIGIN_TESTING=6380ba2b77ffe6bee1b978ef1e2480da233e61c2 (todavía sirviendo R7, SIN el fix de R8)
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R8_FOCAL_PASS=551
TYPECHECK_BASELINE=24
ABUSE_RESISTANCE_PRESERVED=SI
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_TASK=P2-T31-R8-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST
```

Tras confirmar C5 básico (R7 desplegado, `6380ba2`), Leonardo hizo stress
de navegación + ON/OFF repetido en Cliente y la traza capturó un HTTP 429
REAL en el backend Push: un intento de desactivar fue rechazado por el
rate limiter (nunca se persistió) y el chequeo de estado posterior mapeó
ese mismo 429 a `false` autoritativo — mostrando "Desactivado" mientras
el backend seguía sabiendo `true` — hasta que el switch volvió solo a ON
al reabrir (el binding server-side nunca se había movido; esto NO es un
bug de estado, es la consecuencia correcta de un intento que nunca se
completó).

Causa raíz confirmada por auditoría de código + traza física: los 3
endpoints Push (`status`/`subscribe`/`unsubscribe`) compartían UN único
bucket de rate limit (10 req/min), misma clave `ip:userId` — y
superficies independientes (`permission-prompt.tsx`, el panel de
diagnóstico R6/R6A/R6B) consumían del MISMO presupuesto sin coordinarse,
así que una sesión de navegación + toggles normal (sin automatización)
agotaba el límite con facilidad.

Fix de dos partes: **(A)** el bucket se dividió en `pushStatus` (60/min,
sólo lectura, generoso a propósito para mounts/remounts/cold-launches/
refrescos del panel de diagnóstico) y `pushMutation` (20/min, subscribe+
unsubscribe combinados, subido de 10) — verificado que un stress humano
razonable (10 remounts + 10 ciclos ON/OFF completos) nunca produce 429
bajo el modelo nuevo, mientras un flood real (40+ mutaciones o 100+
lecturas) sigue bloqueado (`ABUSE_RESISTANCE_PRESERVED=SI`). **(B)**
`checkPersonalPushStatus` ya no mapea un backend no-ok (excepción de red
O HTTP no-2xx, incluido 429) a `false` autoritativo — nuevo
`applyStatusUnresolved` deja el estado genuinamente sin resolver en vez
de mentir; las 3 UI (Cliente/Negocio/Repartidor, certificadas
independientemente) muestran ahora "No se pudo comprobar" (ícono de
alerta quieto, ya importado en cada archivo) distinto de "Comprobando
estado..." (loader girando — un spinner que sigue girando tras un error
ya concluido sugeriría falsamente que el chequeo continúa en curso).
Mensaje de error de mutación también mejorado: un 429 en subscribe/
unsubscribe ahora dice específicamente "Demasiados intentos. Esperá
unos segundos e intentá nuevamente." en vez del genérico indistinguible
de antes.

`WOULD_NEW_FACT_HAVE_CHANGED_R7_PROMPT=SI` — R7 no estaba mal con la
evidencia disponible entonces (nunca se había observado un 429 real);
este hecho nuevo exige refinar su contrato de error, no revertirlo.
R2/R3/R5/R5A permanecen intactos — auditado explícitamente, sin cambios.

551/551 tests (512 baseline R7 + 39 nuevos), TypeScript 24/24 sin
errores nuevos. Sin commit, sin push, sin deploy, sin escritura en
Production. `32` no tocado. Ver
`P2_T31_R8_PUSH_RATE_LIMIT_429_STATE_CONSISTENCY_FIX.md` para el detalle
técnico completo (traza física, reconstrucción del presupuesto
consumido, rationale de los nuevos umbrales).

## 0.5 ESTADO ACTUAL — FIX R7 DESPLEGADO EN TESTING, PENDIENTE RETEST FÍSICO C4 (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R7-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST
CURRENT_TASK_STATUS=DEPLOYED_TESTING_PENDING_C4_PHYSICAL_RETEST
P2_T31_STATUS=IN_PROGRESS
P2_T31_R7_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
C4_FLICKER_ROOT_CAUSE=UNRESOLVED_INITIAL_PUSH_STATE_RENDERED_AS_FALSE_OFF
C4_FLICKER_FIX_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R7_PHYSICAL_RETEST
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
ORIGIN_TESTING=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
TESTING_DEPLOYMENT_ID=41124f04-f69b-4a51-8b9d-7da562c8b6e1
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
R7_FOCAL_PASS=512
TYPECHECK_BASELINE=24
PRODUCTION_TOUCHED=NO
NEXT_ACTION=LEONARDO_R7_C4_PHYSICAL_RETEST
```

El fix de R7 (`statusResolved` + loader neutral en Cliente/Negocio/
Repartidor + higiene de debug: `actorFingerprint` en vez de raw id,
`physicalStillMatches` en vez de `endpointStillMatches`) quedó
commiteado en UN único commit
(`6380ba2b77ffe6bee1b978ef1e2480da233e61c2`, parent exacto `925a860`) —
14 archivos re-derivados directamente de Git (12 tracked + 2 nuevos, sin
ningún reporte/documentación), stageados uno por uno, pusheados
exclusivamente a `testing-codex`, y desplegados por autodeploy en Railway
TESTING (`DeliGO Copy`, deployment `41124f04`, commit exacto confirmado
por polling directo — nunca `railway up`). Smokes en verde: HTTP 200 en
`/cliente`/`/negocio`/`/repartidor` (redirect 307 normal en `/`); `GET
/api/push/debug-guard` → `200 {"allowed":true}`; logs sin errores.

Nota de proceso: un polling en background iniciado para verificar el
deploy fue detenido explícitamente por el usuario
(`RAILWAY_WATCHER_POLICY=DISABLED_DUE_TO_REPEATED_STALE_WAITERS`) — la
confirmación final del deploy se hizo con `railway status`/`railway
status --json` directos, sin tareas de fondo.

Esta tarea desplegó el fix — NO certifica el comportamiento físico.
Próximo paso, exclusivamente de Leonardo: reproducir C4 (Perfil →
"Diagnóstico Push (TESTING)" → ARMAR TRAZA si no sigue armada → BORRAR
HISTORIAL → notificaciones ON → matar completamente la PWA → reabrir →
Perfil, SIN tocar el switch) al menos 10 veces, confirmando 0 falsos OFF
y 0 flickers. Si algún intento falla, capturar ACTUALIZAR ESTADO + COPIAR
DIAGNÓSTICO COMPLETO sin tocar el switch. C5 (ON→OFF→cerrar→reabrir→debe
seguir OFF) sólo se inicia después de que Leonardo confirme C4 estable.
Production permanece intacta (`1de0d3c1`). Ver
`P2_T31_R7_TESTING_DEPLOY_PENDING_C4_PHYSICAL_RETEST.md` para el detalle
completo.

## 0.6 ESTADO ACTUAL — CAUSA RAÍZ DEL FLICKER C4 CONFIRMADA, FIX LOCAL LISTO (2026-09-06)

```text
CURRENT_TASK_ID=P2-T31-R7-PUSH-INITIAL-UNKNOWN-STATE-FLICKER-FIX
CURRENT_TASK_STATUS=LOCAL_FIX_IMPLEMENTED_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R7_FIX_DEPLOY_AND_RETEST
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
C4_FLICKER_PHYSICAL_TRACE_CAPTURED=SI
C4_FLICKER_ROOT_CAUSE=UNRESOLVED_INITIAL_PUSH_STATE_RENDERED_AS_FALSE_OFF
C4_FLICKER_AUTH_HYDRATION_CAUSALITY=RULED_OUT_FOR_CAPTURED_FLICKER
HEAD=925a86017a5e7546f0a6f82245c9d5fc1d344776 (sin cambios — el fix de R7 es SÓLO LOCAL, no committeado)
ORIGIN_TESTING=925a86017a5e7546f0a6f82245c9d5fc1d344776 (todavía sirviendo R6/R6A/R6B, SIN el fix de R7)
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R7_FOCAL_PASS=512
TYPECHECK_BASELINE=24
PRODUCT_PUSH_ALGORITHM_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_TASK=P2-T31-R7-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST
```

Leonardo capturó, usando el panel de diagnóstico desplegado en R6B, la
PRIMERA evidencia física completa de un flicker C4 real en iPhone
(Cliente): notificaciones ON → cerrar completamente la PWA → reabrir →
Perfil muestra brevemente OFF y cambia solo a ON, en 3 cold launches
reales distintos (`8dykki` ~430ms, `og6h32` ~354ms, `tn5kvs` ~325ms
mount→UI-true). Causa raíz CONFIRMADA (no asumida):
`isSubscribed` arrancaba en `false`, y ese mismo valor servía tanto para
"confirmado no suscrito" como para "todavía sin verificar" — las 3 UI
(Cliente/Negocio/Repartidor) renderizaban esa ambigüedad como un OFF
real, que se autocorregía solo ~325-430ms después. La subscription NUNCA
desapareció (`physicalSubscription=true`, `backendSubscribed=true` en
toda la ventana) — el problema era puramente de representación.

La auth-hydration race dejada abierta por R6 (`AUTH_HYDRATION_PUSH_RACE`)
quedó EXPLÍCITAMENTE DESCARTADA como causa de ESTE flicker específico —
evidencia: en la captura `tn5kvs`, `AUTH_HYDRATED` ocurrió a las
03:00:29.922, 732ms ANTES de `PUSH_HOOK_MOUNT` (03:00:30.654). El gap
estructural general permanece abierto como hallazgo separado — sólo se
descarta como causal de esta reproducción puntual.

Fix implementado (SÓLO LOCAL, no committeado/desplegado): nuevo
`statusResolved: boolean` en `usePushNotifications()` — `false` hasta que
exista una conclusión autoritativa real (del chequeo inicial o de una
mutación completada), se resetea a `false` únicamente en cambio de actor,
y por construcción nunca puede marcarse `true` para una operación stale
(sólo se marca desde el mismo call site que ya verificó
`gate.isCurrent`). Cliente/Negocio/Repartidor ahora muestran un loader
neutral (`Loader2`, reutilizado de cada archivo) en vez del Switch
mientras `!statusResolved` — certificado independientemente por rol, sin
asumir que compartir el hook implica UI idéntica. Se corrigieron además 2
problemas de higiene de debug encontrados en la misma revisión: el panel
exponía el actor id crudo en `actorFamily` (reemplazado por el rol + un
`actorFingerprint` no reversible), y un booleano `endpointStillMatches`
se redactaba por error al contener "endpoint" en el NOMBRE (renombrado a
`physicalStillMatches`, sin debilitar la regla de sanitización real).

Cero cambio a subscribe/unsubscribe/VAPID/backend/DB/SW — únicamente
semántica de estado inicial de UI + higiene de debug. 512/512 tests (473
baseline + 39 nuevos), TypeScript 24/24 sin errores nuevos. Sin commit,
sin push, sin deploy, sin escritura en Production. `32` no tocado. Ver
`P2_T31_R7_PUSH_INITIAL_UNKNOWN_STATE_FLICKER_FIX.md` para el detalle
técnico completo.

## 0.7 ESTADO ACTUAL — DIAGNÓSTICO PUSH DESPLEGADO EN TESTING, PENDIENTE TRAZA FÍSICA (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-R6B-TESTING-DIAGNOSTIC-DEPLOY-AND-PHYSICAL-TRACE
CURRENT_TASK_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_TRACE
P2_T31_STATUS=IN_PROGRESS
P2_T31_R6_STATUS=DEPLOYED_WITH_R6A_R6B_DIAGNOSTICS_TESTING
P2_T31_R6A_STATUS=DEPLOYED_WITH_R6_R6B_DIAGNOSTICS_TESTING
P2_T31_R6B_STATUS=DEPLOYED_TESTING_PENDING_PHYSICAL_TRACE
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT_PENDING_TRACE
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
HEAD=925a86017a5e7546f0a6f82245c9d5fc1d344776
ORIGIN_TESTING=925a86017a5e7546f0a6f82245c9d5fc1d344776
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
TESTING_DEPLOYMENT_ID=85fc4026-3f92-446c-823d-e6dd00e1a611
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
LATEST_TEST=473_PASS_0_FAIL
TYPECHECK_BASELINE=24
PRODUCTION_TOUCHED=NO
NEXT_ACTION=LEONARDO_CAPTURE_IPHONE_PUSH_TRACE
```

R6+R6A+R6B (panel de diagnóstico con snapshot+timeline, entrada standalone
"Diagnóstico Push (TESTING)" y bootstrap de cold-launch) quedaron
commiteados en UN único commit (`925a86017a5e7546f0a6f82245c9d5fc1d344776`,
parent exacto `a8ac961b`) — 24 archivos product/test re-derivados
directamente de Git antes del stage (12 tracked modificados + 12 nuevos,
excluyendo explícitamente los 3 reportes/documentación de R6/R6A/R6B),
stageados uno por uno (nunca `-A`/`.`), pusheados exclusivamente a
`testing-codex`, y desplegados por autodeploy Git-triggered en Railway
TESTING (`DeliGO Copy`, deployment `85fc4026`, commit exacto confirmado
por polling — nunca `railway up`). Smokes en verde: HTTP 200 en
`/cliente`/`/negocio`/`/repartidor` (redirect 307 normal en `/`); `GET
/api/push/debug-guard` → `200 {"allowed":true}` en TESTING; logs del
deployment sin errores/crashes/fallos de hidratación. Ningún algoritmo de
subscribe/unsubscribe/status/VAPID/server-detach fue tocado — esta tarea
NO corrige el bug intermitente, sólo despliega la herramienta de captura.
Production permanece intacta (`1de0d3c1`, sin deploy/env/DB/VAPID/Resend).

Próximo paso, exclusivamente de Leonardo (Claude no ejecuta ni certifica
la prueba física): abrir la PWA TESTING de Cliente, Perfil → "Diagnóstico
Push (TESTING)" → ARMAR TRAZA → usar la app normalmente con
notificaciones ON → cerrar completamente la PWA → reabrir → observar el
switch sin tocarlo → si falla, ACTUALIZAR ESTADO + COPIAR DIAGNÓSTICO
COMPLETO (etiquetar FAIL TRACE) → repetir hasta obtener también una
ejecución sana (HEALTHY TRACE) del mismo escenario, preferentemente C4
(cierre completo + reapertura). Ver
`P2_T31_R6B_TESTING_DIAGNOSTIC_DEPLOY_PENDING_PHYSICAL_TRACE.md` para las
instrucciones físicas exactas paso a paso y el detalle completo del
deploy.

## 0.8 ESTADO ACTUAL — P2-T31-R6B ACCESO STANDALONE + COLD BOOTSTRAP (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-R6B-STANDALONE-PWA-DEBUG-ACCESS-AND-COLD-BOOTSTRAP
CURRENT_TASK_STATUS=LOCAL_STANDALONE_DEBUG_ACCESS_READY_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
GIT_HEAD=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_TESTING=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
STANDALONE_PWA_DEBUG_ENTRY_IMPLEMENTED=SI
QUERY_PARAM_REQUIRED_FOR_PHYSICAL_USE=NO
STANDALONE_DEBUG_ENTRY_PRODUCTION_EXPOSURE=NO
COLD_BOOTSTRAP_IMPLEMENTED=SI
TRACE_ARM_SURVIVES_FULL_REOPEN=SI
R6B_FOCAL_PASS=473
R6B_FOCAL_FAIL=0
TYPECHECK_BASELINE=24
TYPECHECK_FINAL=24
NEW_TYPECHECK_ERRORS=0
PRODUCT_PUSH_ALGORITHM_CHANGED=NO
USER_VISIBLE_PRODUCTION_BEHAVIOR_CHANGED=NO
R6_R6A_R6B_TRACKED_COUNT=12
R6_R6A_R6B_NEW_COUNT=15
R6_R6A_R6B_TOTAL_INTENDED_COUNT=27
NEXT_RECOMMENDED_TASK=P2-T31-R6B-TESTING-DIAGNOSTIC-COMMIT-DEPLOY-AND-PHYSICAL-TRACE
```

Cierra un blocker real de usabilidad de R6/R6A: una PWA Home-Screen de
iPhone en modo `standalone` no tiene barra de direcciones — la
certificación física no puede depender de que Leonardo edite
`?pushDebug=1` a mano. `push-debug-panel.tsx` se reestructuró para que el
ÚNICO gate de visibilidad sea la confirmación real del guard server-side
(`/api/push/debug-guard`, la MISMA autoridad única de R6, nunca duplicada),
verificada en cada montaje del componente — independiente de cualquier
query param. Confirmado TESTING, aparece una entrada discreta
"Diagnóstico Push (TESTING)" al final de Perfil/Configuración; tocarla
abre el panel completo (estado actual, timeline, armar/desarmar traza,
actualizar estado, copiar diagnóstico completo, borrar historial) sin
editar ninguna URL. `?pushDebug=1` se conserva como atajo alternativo,
nunca requerido. Production sigue sin mostrar absolutamente nada (guard
404 → `allowed` nunca `true` → `return null`, sin espacio residual),
verificado incluso con el query param presente.

Segundo hallazgo cerrado: auditado que `push-debug-trace.ts` (R6A) sólo se
cargaba antes dentro del chunk `dynamic()`-importado de Perfil/
Configuración — los 3 manifests PWA abren a `/cliente`/`/negocio`/
`/repartidor`, nunca directo a Perfil — así que el tracer no existía en
memoria durante el cold launch real, sólo desde el tap a Perfil
(`COLD_BOOTSTRAP_CURRENTLY_SUFFICIENT=NO`). Se agregó
`PushDebugTraceBootstrap` (siempre retorna `null`, jamás llama
subscribe/unsubscribe/status/fetch, jamás muta auth ni actor) montado en
los 3 `layout.tsx` de rol — el único punto compartido NO detrás de un
`dynamic()` de cada rol — garantizando que la traza se evalúa desde el
primer render del cold launch. Costo para un usuario real (traza
desarmada, caso normal): dos selectores Zustand + un efecto de un solo
chequeo booleano, sin fetch adicional.

Cero cambio de algoritmo — el único comportamiento visible nuevo en
cualquier entorno es la entrada TESTING-only. 473/473 tests focales (451
baseline R6A + 22 nuevos), 0 fail. TypeScript 24/24, cero errores nuevos.
Fileset acumulado R6+R6A+R6B derivado exclusivamente de `git status
--short` + `git diff --name-status` + `git ls-files --others
--exclude-standard` (nunca narrativo): 12 archivos tracked modificados, 15
nuevos intencionales, 27 total — corrigiendo además una pequeña
ambigüedad documental de R6A (afirmaba "3 archivos nuevos" cuando
`push-debug-panel.tsx` ya era nuevo desde R6, no R6A). Sin commit, sin
push, sin deploy, sin escritura en Production. `32` no tocado. Ver
`P2_T31_R6B_STANDALONE_PWA_DEBUG_ACCESS_AND_COLD_BOOTSTRAP.md` para el
detalle completo, incluido el flujo físico final paso a paso para
Leonardo.

## 0.9 ESTADO ACTUAL — P2-T31-R6A TIMELINE DE LIFECYCLE PUSH (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-R6A-PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC
CURRENT_TASK_STATUS=LOCAL_TIMELINE_DIAGNOSTIC_IMPLEMENTED_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
GIT_HEAD=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_TESTING=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R6A_FOCAL_PASS=451
R6A_FOCAL_FAIL=0
TYPECHECK_BASELINE=24
TYPECHECK_FINAL=24
NEW_TYPECHECK_ERRORS=0
PRODUCT_PUSH_ALGORITHM_CHANGED=NO
PRODUCTION_TRACE_EXPOSURE=NO
SECRET_DATA_PERSISTED=NO
NEXT_RECOMMENDED_TASK=P2-T31-R6A-TESTING-DIAGNOSTIC-DEPLOY-AND-PHYSICAL-TRACE
```

Extiende R6 (§1.0 abajo, aún sin commit/push/deploy) agregando una TIMELINE
cronológica (`src/lib/push-debug-trace.ts`) además del snapshot puntual — un
snapshot tomado a demanda no puede mostrar una carrera de TIMING que ya
resolvió antes de que Leonardo abra el panel (exactamente el caso de la
`AUTH_HYDRATION_PUSH_RACE` que R6 dejó `PLAUSIBLE_NOT_CONFIRMED`).

Diseño del tracer: pasivo, module-scoped, ring buffer acotado a 100
eventos, `processInstanceId` que se renueva en cada carga de módulo (para
distinguir eventos de antes/después de un cold reopen dentro de la MISMA
traza persistida), persistencia SINCRÓNICA por evento en `localStorage`
(deliberadamente NO batcheada — iOS no garantiza ningún evento de "voy a
morir", así que cualquier buffer diferido arriesgaría perder justo los
eventos finales antes de un kill, los más valiosos para C4/C5). Cuando la
traza está desarmada (el 100% de usuarios reales fuera de una sesión de
diagnóstico activa), `recordPushDebugEvent` es un único chequeo booleano
— sin costo. Instrumentados ~35 puntos reales del lifecycle: mount/unmount
del hook, auth hydration (lectura nueva pero puramente observacional —
nunca gatea ninguna decisión existente, verificado por test estático),
cambio de actor, el status check completo (con sus 5 puntos exactos de
`STATUS_APPLY`/`STATUS_DISCARDED_STALE`, respondiendo "quién dejó el hook
en OFF"), subscribe/unsubscribe completos (VAPID, physical, backend), y
cambios reales de UI en las 3 superficies (Cliente/Negocio ya tenían un
diff-check; Repartidor necesitó uno nuevo, puramente observacional).

Activación en dos capas para no exponer nada en Production sin verificar:
el panel exige los mismos dos gates de R6 (`?pushDebug=1` + guard
server-side confirmado) antes de ofrecer "ARMAR TRAZA"; una vez armada, un
marcador local permite que el SIGUIENTE cold-launch de ESE MISMO origin
TESTING grabe desde el primer instante, con una re-verificación
server-side automática que desarma y borra todo si el origin no confirma
TESTING. Cero secretos persistidos (8 tests dedicados; endpoint siempre
reducido a un fingerprint no reversible).

451/451 tests focales (393 baseline R6 + 58 nuevos), 0 fail. TypeScript
24/24, cero errores nuevos. Sin commit, sin push, sin deploy, sin
escritura en Production. `32` no tocado. Ver
`P2_T31_R6A_PUSH_LIFECYCLE_TIMELINE_DIAGNOSTIC.md` para el detalle
completo, incluidas las instrucciones de uso físico para Leonardo.

## 1.0 ESTADO ACTUAL — P2-T31-R6 DIAGNÓSTICO DE LIFECYCLE PUSH INTERMITENTE EN IPHONE (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-R6-INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC
CURRENT_TASK_STATUS=LOCAL_DIAGNOSTIC_IMPLEMENTED_PENDING_REVIEW
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
GIT_HEAD=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_TESTING=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_MAIN=1de0d3c153eaf3be068adeb004ea43feb42fc40e
R6_FOCAL_PASS=393
R6_FOCAL_FAIL=0
TYPECHECK_BASELINE=24
TYPECHECK_FINAL=24
NEW_TYPECHECK_ERRORS=0
PRODUCT_BEHAVIOR_CHANGED=NO
PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_TASK=P2-T31-R6-TESTING-DIAGNOSTIC-DEPLOY-AND-PHYSICAL-TRACE
```

Leonardo certificó físicamente R2+R3+R5+R5A en un iPhone Home-Screen PWA
real (ya desplegado en TESTING, `a8ac961b`) y encontró que la matriz
C1-C5 **no es determinística** — el mismo caso a veces certifica ON y a
veces OFF sin cambiar nada más (ejemplo C4: dejar ON, cerrar completamente
la PWA, reabrir, ver Perfil). `IPHONE_PHYSICAL_CERTIFICATION_STATUS` pasa
de `PENDING_LEONARDO` a `BLOCKED_FLAKY_INTERMITTENT` — un PASS individual
nunca certifica un caso flaky.

Esta ronda (R6) NO corrige el bug — construye instrumentación de
diagnóstico local: un panel oculto (`PushDebugPanel`), invisible salvo
`?pushDebug=1` en la URL Y confirmación server-side de que el entorno es
TESTING (`GET /api/push/debug-guard`, gateado por `RAILWAY_ENVIRONMENT_NAME`
— variable inyectada por Railway mismo, no definible desde este repo; 404
liso fuera de TESTING). El panel captura, sin secretos (el endpoint físico
se reduce a un fingerprint no reversible), un snapshot textual
`KEY=value` de cada capa: permission, SW registration, PushManager,
VAPID match, respuesta real del backend (`/api/push/status`), estado del
hook, mutación en vuelo, switch de UI — pensado para que Leonardo lo pegue
directamente en un chat de diagnóstico apenas observe una falla física.

Dos hallazgos estructurales, ninguno corregido todavía (ver
`codex-reports/FINDINGS.md`, F-P2-T31-MODULE-REGISTRY-FULL-REOPEN-01 y
F-P2-T31-AUTH-HYDRATION-RACE-01):

1. El registro de mutaciones en vuelo de R2 (`push-mutation-in-flight-registry.ts`)
   es module-scoped — protege remount/unmount de React dentro de la MISMA
   carga de página, pero se reinicia vacío en cualquier reevaluación
   completa del bundle JS, incluido un cierre total + reapertura de la
   PWA. El mandato original de R2 nunca prometió cubrir ese caso — límite
   de alcance real, no defecto introducido.
2. `usePushNotifications()` dispara su primer chequeo de estado sin
   esperar la hidratación asíncrona de `auth-store.ts` (`_hasHydrated`) —
   PROVEN a nivel de código; PLAUSIBLE pero NO confirmado como causa del
   parpadeo físico observado (existe un mecanismo de autocorrección vía
   cambio de `actorKey`, cuya cobertura completa no está probada).

Cero código de subscribe/unsubscribe/status fue modificado — sólo se
agregó una superficie de lectura opt-in (5 archivos tracked +93 líneas, 8
archivos nuevos). 393/393 tests focales (341 baseline R5A + 52 nuevos), 0
fail. TypeScript 24/24, sin errores nuevos. Sin commit, sin push, sin
deploy, sin escritura en Production. `32` no tocado. Ver
`P2_T31_R6_INTERMITTENT_IPHONE_PUSH_LIFECYCLE_DIAGNOSTIC.md` para el
detalle completo.

## 1.1 ESTADO ACTUAL — PRODUCTION EMAIL VERIFICATION BLOCKER CLOSURE (2026-09-05)

```text
CURRENT_TASK_ID=PRODUCTION-EMAIL-VERIFICATION-BLOCKER-CLOSURE
CURRENT_TASK_STATUS=CLOSED_OPERATOR_REMEDIATED
EMAIL_BLOCKER_STATUS=CLOSED_OPERATOR_REMEDIATED
PRODUCTION_EMAIL_VERIFICATION_BLOCKER=CLOSED_OPERATOR_REMEDIATED
EMAIL_DIAGNOSTIC_STATUS=CLOSED_ROOT_CAUSE_CONFIRMED_AND_REMEDIATED
PRODUCTION_EMAIL_LOG_CLASS=SEND_SUCCESS_PROVIDER_ACCEPTED
PRIOR_PRODUCTION_EMAIL_LOG_CLASS=SEND_FAILURE_RESEND_401
ROOT_CAUSE=PRODUCTION_STALE_DELETED_RESEND_API_KEY_AFTER_INCOMPLETE_KEY_ROTATION
REMEDIATION=OPERATOR_UPDATED_PRODUCTION_RESEND_API_KEY_AND_REDEPLOYED
OPERATOR_PRODUCTION_ENV_CHANGE_CONFIRMED=SI
OPERATOR_PRODUCTION_DEPLOY_CONFIRMED=SI
CURRENT_PRODUCTION_DEPLOYMENT_ID=bc4a94a9-8ee8-4ed8-8a41-e791b1911f16
CURRENT_PRODUCTION_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e
CURRENT_RUNTIME_RESEND_API_KEY_MATCH_TESTING=YES
PRODUCTION_TOUCHED=NO_THIS_TASK_ONLY_DOCUMENTED_OPERATOR_ACTION
ENV_MUTATED_BY_THIS_TASK=NO
CODE_CHANGED=NO
CODE_FIX_REQUIRED=NO
SCHEMA_FIX_REQUIRED=NO
SMTP_CONFIG_FIX_REQUIRED=NO
NEXT_RECOMMENDED_ACTION=P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION
P2_T31_TECHNICAL_NEXT=P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION
```

La evidencia del operador confirma una rotación incompleta: Testing recibió una
clave Resend nueva, Production retuvo la vieja y luego esa clave fue eliminada,
causando el HTTP 401. El operador actualizó Production y redeployó. El runtime
actual acepta el envío mediante Resend; esto no equivale a confirmación de
entrega final en el buzón. El endpoint `/api/auth/test-email` conserva una
deuda no bloqueante porque usa SMTP/Nodemailer, mientras el flujo real usa
Resend. Reporte: `codex-reports/PRODUCTION_EMAIL_VERIFICATION_BLOCKER_CLOSURE.md`.

## 1.2 ESTADO ACTUAL — P2-T31 DEPLOY TESTING (2026-09-05)

```text
CURRENT_TASK_ID=P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION
P2_T31_STATUS=IN_PROGRESS
P2_T31_TECHNICAL_STATUS=DEPLOYED_TESTING_PENDING_IPHONE_PHYSICAL_CERTIFICATION
COMMIT_HASH=a8ac961bd81ee505297f81787c1cf32e3f4cd161
TESTING_DEPLOYMENT_ID=e18111b1-fc25-4697-8ec5-475067ad3ab1
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_EXACT_COMMIT_MATCH=SI
IPHONE_PHYSICAL_CERTIFICATION_STATUS=PENDING_LEONARDO
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
PRODUCTION_EMAIL_VERIFICATION_BLOCKER=CLOSED_OPERATOR_REMEDIATED
NEXT_ACTION=LEONARDO_IPHONE_PHYSICAL_CERTIFICATION
```

R2+R3+R5+R5A quedó congelado en un commit único, pusheado exclusivamente a
`testing-codex` y desplegado por autodeploy en `DeliGO Copy`/TESTING. No se
ejecutó la certificación física iPhone; el siguiente paso corresponde a
Leonardo.

## 0. CÓMO LEER ESTE ARCHIVO (chat nuevo, empezar acá)

Este archivo se lee de arriba hacia abajo en orden de utilidad decreciente:
**ESTADO ACTUAL → TAREA ACTUAL → CADENA RECIENTE → ROADMAP → REGLAS
PERMANENTES → CONTEXTO HISTÓRICO** (todo lo anterior a 2026-09-05, sin
reescribir, preservado íntegro más abajo bajo `## CONTEXTO HISTÓRICO`).
Si necesitás evidencia detallada de cualquier afirmación de acá (comandos
exactos, logs, conteos de test), andá al reporte individual referenciado —
este archivo es una síntesis, no un reemplazo de los reportes.

## 1. ESTADO ACTUAL (2026-09-05)

```
PROJECT=DeliGO
REPO=C:\Leo Campos\Trabajo\deligo-main-limpio
BRANCH=testing-codex

GIT_HEAD=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_TESTING_CODEX=a8ac961bd81ee505297f81787c1cf32e3f4cd161
ORIGIN_MAIN_PRODUCTION=1de0d3c153eaf3be068adeb004ea43feb42fc40e
AHEAD_OF_ORIGIN_TESTING=0 (el commit R2+R3+R5+R5A está pusheado; sólo quedan untracked documentales/históricos)

P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
P3=NOT_STARTED

CURRENT_TASK=P2-T31 (Notification Switch Persistence + Web Push)
CURRENT_TASK_STATUS=IN_PROGRESS
CURRENT_SUBSTAGE=R2_R3_R5_R5A_COMMITTED_PUSHED_DEPLOYED_TESTING_PENDING_IPHONE_PHYSICAL_CERTIFICATION

ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED (cero PushSubscription FCM en TODA la base de TESTING; sin dispositivo físico disponible hoy)

LATEST_TEST_GATE=341_PASS_0_FAIL (P2-T31-R5A, el más reciente — ver §4)
TYPECHECK_BASELINE=24

PRODUCTION_CONTAINS=1de0d3c153eaf3be068adeb004ea43feb42fc40e (NO contiene P2-T25/T26/T28/T31 ni nada posterior)

NEXT_RECOMMENDED_TASK=LEONARDO_IPHONE_PHYSICAL_CERTIFICATION
```

**No-claims explícitos (para evitar que un chat nuevo asuma de más)**:
- Android Push: **NO** está arreglado ni certificado. `UNKNOWN_NOT_CERTIFIED`.
- P2-T31: **NO** está cerrado. `IN_PROGRESS`.
- R2/R3/R5/R5A de P2-T31: están commiteados en
  `a8ac961bd81ee505297f81787c1cf32e3f4cd161`, pusheados a `testing-codex` y
  desplegados en TESTING; la certificación física iPhone sigue pendiente.
- Production: **NO** contiene ninguna de las tareas P2-T25/T26/T28/T31.

## 2. TAREA ACTUAL — P2-T31 (Notification Switch Persistence + Web Push)

P2-T31 nació de un bug físico reportado por Leonardo (switch de
notificaciones de Cliente perdía sincronía al navegar) y se convirtió en
una investigación en capas de todo el sistema de Web Push de DeliGO.
Etapas, en orden:

```
R1  = PASS_SUBSTAGE, COMMITEADO/PUSHEADO/DESPLEGADO (commit 989785a3cb1613bcda3a6c67f96472058bc876b0)
      Fix real: stale seed (Cliente) + stale closure post-await (Negocio).
      Repartidor ya estaba sano.
      Reporte: codex-reports/P2_T31_NOTIFICATION_SWITCH_PERSISTENCE_STATE_SYNC_R1.md
      Deploy:  codex-reports/P2_T31_TESTING_DEPLOY_PENDING_ANDROID_CERTIFICATION.md

R2  = IMPLEMENTADO, INCLUIDO EN COMMIT a8ac961bd81ee505297f81787c1cf32e3f4cd161
      Root cause: MOUNT_STATUS_GENERATION_NOT_SHARED_WITH_MUTATION_ACROSS_COMPONENT_UNMOUNT.
      La primera activación real (única que hace SW register + VAPID
      fetch + handshake nuevo con el push service) es mucho más lenta que
      cualquier activación posterior — si el usuario navega fuera del
      componente ANTES de que termine, el remount (gate nuevo, sin
      memoria de la mutación huérfana) lee "no hay subscription" como
      definitivo. Fix: registro de mutación en vuelo module-scoped
      (push-mutation-in-flight-registry.ts) + esperar antes del readback
      autoritativo. El LatestOperationGate ya protegía races DENTRO de
      una instancia — nunca entre unmount/remount, que es justo lo que
      este registro nuevo cubre.
      Reporte: codex-reports/P2_T31_R2_FIRST_SUBSCRIBE_REMOUNT_STATE.md

R3  = AUDITORÍA + FIX (1 de 4 superficies), INCLUIDO EN COMMIT a8ac961bd81ee505297f81787c1cf32e3f4cd161
      Separó SWITCH STATE de PUSH DELIVERY REAL. Confirmó que el código
      Push es idéntico entre Production y TESTING (Android falla en
      ambos, no es una regresión de testing-codex). Hallazgo real
      reproducido EN VIVO contra TESTING: Apple Web Push devolvía 400
      VapidPkHashMismatch para una subscription física stale — root
      cause VAPID_ROTATION_STALE_SUBSCRIPTION_SILENTLY_REUSED_FOREVER
      (SERVER_DETACH_ONLY preserva la física, getSubscription() la
      reusa para siempre, nunca se validaba applicationServerKey). Fix
      aplicado sólo en use-push-notifications.ts. Además: CERO
      subscriptions FCM en TODA la base de TESTING (los 3 roles) — no se
      afirma "Android arreglado", se registra ANDROID_PUSH_STATUS=
      UNKNOWN_NOT_CERTIFIED.
      Reporte: codex-reports/P2_T31_R3_ANDROID_WEB_PUSH_DELIVERY_CROSS_ENV_AUDIT.md

R4  = AUDITORÍA DE ARQUITECTURA, SIN CAMBIOS DE CÓDIGO
      PUSH_SUBSCRIPTION_IMPLEMENTATION_COUNT=4: (1) use-push-notifications.ts
      (Cliente/Negocio/Repartidor, compartido), (2) permission-prompt.tsx,
      (3) use-operativo-salon-push.ts, (4) copia inline en Mozo. Un solo
      Service Worker (public/sw.js). Divergencias clasificadas: DIV-01
      (R3 sólo validó VAPID en 1/4 superficies), DIV-02 (4
      implementaciones independientes, deuda arquitectónica), DIV-03
      (Salón/Mozo sin protección de remount equivalente a R2), DIV-04
      (env var NEXT_PUBLIC_VAPID_PUBLIC_KEY muerta/distinta en TESTING),
      DIV-05 (?iosDebug=1 residual en manifest de Cliente), DIV-06
      (Android sin ninguna subscription, causa aún desconocida).
      PushLifecycleManager centralizado evaluado sólo como OPCIÓN FUTURA
      conceptual, no una decisión tomada.
      Reporte: codex-reports/P2_T31_R4_WEB_PUSH_REFERENCE_ARCHITECTURE_CONFORMANCE_AUDIT.md

R5  = FIX PORTADO A 4/4 SUPERFICIES, INCLUIDO EN COMMIT a8ac961bd81ee505297f81787c1cf32e3f4cd161
      Cerró DIV-01: portó la validación de VAPID key de R3 a
      permission-prompt.tsx, Salón y Mozo, reusando el mismo helper
      (push-subscription-key.ts::applicationServerKeyMatches). DIV-03 NO
      se tocó (fuera de alcance explícito).
      Reporte: codex-reports/P2_T31_R5_VAPID_STALE_SUBSCRIPTION_VALIDATION_EXTENSION.md

R5A = HARDENING DE CONTRATO DE FALLOS, INCLUIDO EN COMMIT a8ac961bd81ee505297f81787c1cf32e3f4cd161
      Cerró 3 gaps encontrados revisando R5 antes de deploy: (A)
      permission-prompt ahora ABORTA (sin reusar/destruir) si no puede
      obtener la VAPID vigente; (B) permission-prompt ahora exige ACK
      real de /api/push/subscribe (antes no verificaba res.ok); (C) las
      4 superficies confirman la remoción física de una subscription
      stale (booleano de unsubscribe() + re-lectura de getSubscription())
      antes de recrear — nuevo helper compartido
      unsubscribeStalePushSubscription(). Disable normal sigue
      SERVER_DETACH_ONLY sin cambio. VAPID_VALIDATION_SURFACES_AFTER=
      4/4_STRICT.
      Reporte: codex-reports/P2_T31_R5A_PUSH_SUBSCRIPTION_FAILURE_CONTRACT_HARDENING.md
```

**Diff P2-T31 incorporado al commit de deploy** (idéntico desde R2 hasta R5A;
ningún commit intermedio):

```
P2_T31_COMMITTED_FILESET (9 tracked modificados + 5 nuevos, 14 total):
  M  src/app/mozo/panel/[slug]/page.tsx
  M  src/components/shared/permission-prompt-static-contract.test.ts
  M  src/components/shared/permission-prompt.tsx
  M  src/hooks/push-personal-status-check.test.ts
  M  src/hooks/push-personal-status-check.ts
  M  src/hooks/use-operativo-salon-push.ts
  M  src/hooks/use-push-notifications-static-contract.test.ts
  M  src/hooks/use-push-notifications.ts
  M  src/lib/push-subscription-key.ts
  ?? src/app/mozo/panel/[slug]/push-static-contract.test.ts
  ?? src/hooks/push-mutation-in-flight-registry.ts
  ?? src/hooks/push-mutation-in-flight-registry.test.ts
  ?? src/hooks/use-operativo-salon-push.test.ts
  ?? src/lib/push-subscription-key.test.ts

HISTORICAL_UNTRACKED_PRESERVE (NO tocar, NO stagear — preexistentes, no relacionados con P2-T31):
  1)
  32                                          <- NUNCA leer/inspeccionar/modificar/borrar/stagear, bajo ninguna circunstancia
  DELIGO_FULL_CONTEXT_LATEST.md (este archivo — se actualiza pero no se stagea/commitea)
  codex-reports/
  prisma/migrations/migration_lock.toml
  public/ChatGPT Image 29 ago 2026, 06_46_41 p.m.png
  public/tarjetas.docx
  public/tarjetas.pdf
  tsconfig.tsbuildinfo
```

## 3. RESUMEN P2-T25 / P2-T26 / P2-T28 (cerradas, commiteadas, pusheadas, desplegadas)

```
P2-T25 (Order Creation Abuse Resistance) = CLOSED_TESTING_CERTIFIED
  commit 1b69ee878e540d537c1b3a14d79ad88ded8d16e9 "fix: harden order creation abuse controls"
  3 buckets independientes (cuenta 5/5min, IP 15/5min, negocio 30/5min);
  idempotency replay no consume bucket de negocio; concurrent same-key
  protegido por lock process-local; session rotation da 429 en runtime;
  idempotency 201->200 mismo id; conflict real da 409. LIMITACIONES
  documentadas (no bloqueantes para TESTING): rate limiter/locks son
  PROCESS-LOCAL (sin scaling horizontal seguro todavía); IP en runtime
  parcialmente limitada por confianza de proxy/XFF de Railway (pendiente
  de endurecer getClientIp); bucket de negocio 30/5min sólo smoke-test en
  runtime, requiere validación de producto/ops antes de Production; capa
  de "challenge" (CAPTCHA) no implementada.

P2-T26 (SuperAdmin Notifications End-to-End) = CLOSED_TESTING_CERTIFIED
  commit 642da152cbc29fb8880ef4dc7bd3a7c6d6ca42f7 "feat: complete superadmin in-app notifications"
  Catálogo canónico final = 6 triggers: negocio_pendiente, denuncia_nueva,
  destacado_solicitud, negocio_deuda, review_moderation nueva solicitud,
  review_moderation información adicional. `superadmin_identidad_nueva`
  RETIRADO del catálogo runtime — probado matemáticamente inerte
  (recipients siempre []) en el modelo de identidad actual, no un bug.
  6/6 implementados y 6/6 certificados con trigger runtime explícito
  contra TESTING desplegado. Aislamiento de rol, badge/read, payload sin
  PII sensible verificados. Sólo in-app — NO Web Push.

P2-T28 (Order State Lock Ownership Hardening) = CLOSED_TESTING_CERTIFIED_NO_BUG
  commit 913d20e7f88375675b870e2adf9216fe56edcee0 "test: certify order state lock ownership"
  La sospecha inicial (mismo patrón de foreign-lock-release que
  P2-T25-R2C) resultó FALSO POSITIVO — acquireLock en estado/route.ts
  vive fuera del try/finally, estructuralmente distinta y ya segura.
  Confirmado empíricamente (no sólo por lectura) con un seam de test
  dedicado; pruebas A/B/C/D determinísticas; sin cambio de comportamiento
  de producto; test permanente de regresión agregado. FINDING para
  P2-T27: las transiciones de estado NO-cancelación no tienen DB-level
  CAS — dependen sólo del lock process-local; sólo `cancelado` usa CAS;
  antes de >1 réplica de la app esto necesita concurrencia optimista
  real.
```

Detalle completo, incluidas todas las sub-etapas (R2A/R2B/R2C de T25,
R2A/R2B/R2C de T26), en `codex-reports/COMPLETED_TASKS.md` y
`codex-reports/GIT_DEPLOY_HISTORY.md` (entradas fechadas 2026-09-05).

## 4. TESTS — GATE MÁS RECIENTE

```
P2_T31_LATEST_FOCAL=341_PASS_0_FAIL (R5A — el gate vigente HOY; R1..R5 son ejecuciones solapadas anteriores del mismo conjunto creciente, no se suman)
TYPECHECK_CURRENT_BASELINE=24 (bajó de 26 por una mejora incidental de R5A, no buscada deliberadamente — ver codex-reports/P2_T31_R5A_PUSH_SUBSCRIPTION_FAILURE_CONTRACT_HARDENING.md)
ESLINT=limpio en toda la cadena P2-T31 (R1->R5A), sin excepciones
```

Detalle completo (comandos exactos por etapa) en
`codex-reports/TEST_AUTHORITY.md` (entrada 2026-09-05).

## 5. ROADMAP COMPLETO

```
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
  P2-T25=CLOSED_TESTING_CERTIFIED
  P2-T26=CLOSED_TESTING_CERTIFIED
  P2-T28=CLOSED_TESTING_CERTIFIED_NO_BUG
  P2-T31=IN_PROGRESS (ver §2 para el detalle de sub-etapas)
  P2-T02=READY_TO_RESUME (certificación Android depende de disponibilidad futura del dispositivo físico — mismo dispositivo cuya falta bloquea el diagnóstico de P2-T31, pero son hallazgos distintos: GPS de repartidor vs Web Push)
  P2-T27=QUEUED (depende del finding de P2-T28: DB-level CAS para transiciones no-cancelación)
  P2-T29=QUEUED
  P2-T30=QUEUED
  P2-T19=OPTIONAL_DEFERRED (fuera del orden de ejecución principal, sólo reabrir con métricas reales post-lanzamiento)
  P2-T23=FUTURE (después de P2-T02)
  P2-T24=FUTURE (después de P2-T23)
P3=NOT_STARTED
```

Historia completa de decisiones de ordenamiento del roadmap (por qué T25
antes que T28, por qué T02 depende de Android, etc.) preservada en
`codex-reports/ROADMAP.md` — no reescrita, sólo con una entrada de estado
actual agregada al tope (2026-09-05).

## 6. HALLAZGOS ABIERTOS ACTUALES (no cerrar sin nueva evidencia)

```
F-P2-T31-ANDROID-PUSH-DELIVERY-01     = UNKNOWN_NOT_CERTIFIED — requiere diagnóstico físico (instrucciones exactas en el reporte de R3, §24)
F-P2-T31-VAPID-STALE-SUBSCRIPTION-01  = CLOSED_FIX_IMPLEMENTED_LOCAL_PENDING_DEPLOY
DIV-02 (4 implementaciones independientes de lifecycle) = OPEN_ARCHITECTURAL_DEBT_NOT_BLOCKING
DIV-03 (Salón/Mozo sin remount-safety equivalente a R2) = OPEN_STRUCTURAL_RISK_NO_PHYSICAL_EVIDENCE
DIV-04 (NEXT_PUBLIC_VAPID_PUBLIC_KEY muerta/distinta en TESTING) = OPEN_LOW_SEVERITY_CONFIG_HYGIENE
DIV-05 (?iosDebug=1 residual en manifest Cliente) = OPEN_LOW_SEVERITY_COSMETIC
P2-T25: rate limiter/locks process-local, proxy/XFF, challenge layer     = OPEN_DOCUMENTED_LIMITATIONS (no bloqueante para TESTING)
P2-T28: transiciones no-cancelación sin DB CAS                          = OPEN_FOR_FUTURE_TASK (candidato P2-T27)
```

Findings previamente cerrados de otras cadenas (P2-IOS-DOCK-STATIC-CONTRACT-HYGIENE,
tracking static contract MODEL-G1 vs MODEL-E1, potencial cleanup de
`Empleado.token`/`Negocio.pushSubscriptionEmpleados`) **NO se reabrieron**
— siguen exactamente donde estaban, en `codex-reports/ROADMAP.md` y sus
reportes de tarea individuales. Detalle completo de los hallazgos de
arriba en `codex-reports/FINDINGS.md` (entrada 2026-09-05).

## 6.1 MATRIZ iPhone PARA LA PRÓXIMA CERTIFICACIÓN FÍSICA (contexto para el próximo chat/tarea)

Cuando se ejecute `P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION`
(commit único del bloque R2+R3+R5+R5A → push testing → deploy → certificación
física), la matriz de iPhone Home-Screen PWA debe cubrir, por CADA rol
(Cliente, Negocio, Repartidor):

```
1. permission-prompt first enable (banner automático)
2. switch first enable (desde Perfil/Configuración directamente)
3. disable / re-enable
4. rapid ON/OFF (ya certificado físicamente para el switch, re-confirmar tras R5A)
5. tab remount (Perfil<->Favoritos o equivalente por rol — escenario de R2)
6. cerrar/reabrir la PWA completamente
7. logout/login
8. Push real en foreground
9. Push real en background
10. notification click / deep-link
11. stale VAPID recovery — SÓLO si existe una forma SEGURA de probarlo sin
    rotar las VAPID keys COMPARTIDAS de TESTING (idealmente un entorno
    aislado con sus propias keys). NO declarar esto físicamente probado si
    no existe tal entorno aislado.
```

Android sigue `UNKNOWN_NOT_CERTIFIED` — la matriz de arriba es SÓLO para
iPhone. No certificar Android sin el dispositivo físico (ver §6,
`F-P2-T31-ANDROID-PUSH-DELIVERY-01`, instrucciones exactas de diagnóstico
remoto en `codex-reports/P2_T31_R3_ANDROID_WEB_PUSH_DELIVERY_CROSS_ENV_AUDIT.md` §24).

## 7. REGLAS PERMANENTES (resumen — texto completo preservado en `## 2. PERMANENT EXECUTION RULES` más abajo, sección histórica)

- Toda comunicación con el usuario y narrativa de reportes: **español**.
  Literales técnicos/hashes/rutas/comandos/marcadores: inglés.
- Archivo raíz **`32`**: NUNCA leer/inspeccionar/ejecutar/modificar/
  stagear/borrar, sin excepción, en ninguna tarea futura.
- **Archive-before-overwrite** para `codex-reports/CURRENT_TASK.md`
  específicamente (verificado por hash) — esta reconciliación NO lo tocó
  (no era necesario para el objetivo de reconciliar contexto).
- **`codex-reports/archive/LEGACY_FULL_REPORT_20260826.md` es
  permanentemente inmutable.**
- `git add` explícito por path, nunca `-A`/`.`; un commit por etapa de
  "commit exacto"; push único y explícito sólo con autorización expresa
  del usuario en el prompt de esa etapa, siempre
  `git push origin testing-codex` sin `--force`; nunca tocar `origin/main`
  sin instrucción explícita de promoción a Production.
- Fixtures de DB reales sólo en TESTING, siempre con prefijo identificable
  (para P2-T31: `TEST_T31_*`), siempre eliminadas al finalizar la etapa.
- Este archivo (`DELIGO_FULL_CONTEXT_LATEST.md`) se actualiza al finalizar
  cada tarea futura relevante, permanece sin trackear/sin stagear en Git,
  y se construye únicamente a partir de las autoridades de
  `codex-reports/` + el estado real de Git — nunca de la memoria del
  modelo.

## CONTEXTO HISTÓRICO (preservado íntegro desde antes de 2026-09-05 — cronológico, no reescrito)

## CURRENT TASK — PRODUCTION-PILOT-CATALOG-E2E-01-R1 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-PILOT-CATALOG-E2E-01-R1
CURRENT_TASK_STATUS=PASS_PRODUCTION_DEMO_CATALOG_IMAGES_HOURS_AND_REAL_BUSINESS_ONBOARDING_CERTIFIED
LAST_UPDATED_BY_TASK=PRODUCTION-PILOT-CATALOG-E2E-01-R1
LAST_UPDATED_DATE=2026-08-30
R1_REPORT=codex-reports/PRODUCTION_PILOT_CATALOG_E2E_01_R1.md
IMAGE_PIPELINE_PRODUCTION_BLOCKER=RESOLVED
PRODUCT_IMAGE_CLIENT_RENDER_PASS_COUNT=8
REAL_BUSINESS_CATALOG_ONBOARDING_READY=SI
PUBLIC_LAUNCH_AUTHORIZED=NO
DEMO_BUSINESS_PRESERVED=SI
```

Con las credenciales de Cloudinary ya corregidas por el operador, se
certificó primero con un canario real, y luego se re-subieron y
actualizaron las 8 imágenes rotas del negocio demo — 8/8 confirmadas
renderizando de verdad (fetch directo + inspección de DOM, desktop y
mobile). Se configuró un horario semanal completo por el contrato real;
el catálogo público pasó de "Local cerrado" a "Abierto". El bloqueador de
onboarding queda `RESOLVED`:
`REAL_BUSINESS_CATALOG_ONBOARDING_READY=SI`. `PUBLIC_LAUNCH_AUTHORIZED=NO`
sin cambio. Nota de transparencia: se usó una excepción acotada por
Prisma (solo el campo `password` del negocio demo, autorizada
explícitamente por el usuario) para recuperar el acceso de login perdido
— documentado en detalle, no oculto. Negocio demo conservado íntegro.

## CURRENT TASK — PRODUCTION-PILOT-CATALOG-E2E-01 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-PILOT-CATALOG-E2E-01
CURRENT_TASK_STATUS=PARTIAL_CATALOG_MECHANICS_CERTIFIED_IMAGE_PIPELINE_BLOCKED
LAST_UPDATED_BY_TASK=PRODUCTION-PILOT-CATALOG-E2E-01
LAST_UPDATED_DATE=2026-08-30
PILOT_REPORT=codex-reports/PRODUCTION_PILOT_CATALOG_E2E_01.md
DEMO_BUSINESS_ID=cmtgcfhep0009li0axg92s4tc
DEMO_BUSINESS_SLUG=deligo-demo-burger
DEMO_BUSINESS_PRESERVED=SI
DEMO_EMPLOYEE_COUNT_CREATED_BY_TASK=0
PRODUCT_IMAGE_UPLOAD_PASS_COUNT=8
PRODUCT_IMAGE_CLIENT_RENDER_PASS_COUNT=0
REAL_BUSINESS_CATALOG_ONBOARDING_READY=NO
PUBLIC_LAUNCH_AUTHORIZED=NO
REAL_PRODUCTION_BUSINESS_DATA_PROTECTED=SI
NEXT_PROJECT_TASK_ID=CLOUDINARY_PRODUCTION_CREDENTIAL_FIX
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Negocio demo real (`DeliGO Demo Burger`, `deligo-demo-burger`) creado de
punta a punta por los contratos reales de la app, sin ningún `Empleado`.
15 productos cubren toda la matriz de catálogo (simples, experto con
ingredientes removibles, agregados pagos/gratis, sección propia, un grupo
de opciones compartidas reutilizado en 2 productos, descuento % y monto
fijo, disponibilidad) — todo PASS con cálculos de precio exactos
verificados en vivo en navegador real. Bloqueador real encontrado: el
pipeline de imágenes está roto en Production (Cloudinary con API key
deshabilitada, fallback local también 404) — 0 de 8 imágenes subidas
renderizan. Por eso `REAL_BUSINESS_CATALOG_ONBOARDING_READY=NO` pese a que
el resto del catálogo certificó limpio. Negocio demo conservado íntegro.
`PUBLIC_LAUNCH_AUTHORIZED=NO` sin cambio. Invariante nueva congelada:
`REAL_PRODUCTION_BUSINESS_DATA_PROTECTED=SI` para toda tarea futura.

## CURRENT TASK — CHAT_SESSION_CHECK_URL_PRODUCTION_FIX-R1 (2026-08-30)

```
CURRENT_TASK_ID=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX-R1
CURRENT_TASK_STATUS=PASS_PRODUCTION_CHAT_SESSION_CHECK_CONFIGURATION_AND_ROUNDTRIP_CERTIFIED
LAST_UPDATED_BY_TASK=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX-R1
LAST_UPDATED_DATE=2026-08-30
FIX_REPORT=codex-reports/CHAT_SESSION_CHECK_URL_PRODUCTION_FIX.md
CHAT_SESSION_CHECK_URL_MISSING=NO
PRODUCTION_MISSING_REQUIRED_VARIABLE_COUNT=0
PRODUCTION_OPERATIONAL_READINESS=PASS
REALTIME_PRODUCTION_TO_PRODUCTION_ROUTING_PASS=SI
SESSION_CHECK_FIX_PASS_P2_T18_STILL_PAUSED=SI
NEXT_PROJECT_TASK_ID=P2_T06_OR_P2_T14_SELECTION
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Certificó en Production real la corrección manual del operador
(`DELIGO_MONOLITH_INTERNAL_URL=https://deligo.ar`, ya provisionada y
desplegada por él antes de esta tarea) con el roundtrip sintético exacto
de `P2-T11-STAGE4E`: caso activo autenticado `200 {"valid":false}`, HMAC
inválido/timestamp vencido `401`, gate de socket obligatorio ejecutando el
chequeo completo (`reason=inactive`). `F-PRODUCTION-CHAT-SESSION-CHECK-URL-01`
cerrado; `PRODUCTION_OPERATIONAL_READINESS=PASS` sin limitaciones. Cero
mutación de Railway/Git/DB por esta tarea. P2-T18 sigue en pausa, no
reabierto.

## CURRENT TASK — PRODUCTION-SYNC-R7 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R7
CURRENT_TASK_STATUS=CLOSED_WITH_DOCUMENTED_LIMITATIONS
PRODUCTION_SYNC_R7=PASS_PRODUCTION_FINAL_INFRASTRUCTURE_POLICY_AND_READINESS_CERTIFIED
PRODUCTION_SYNC_STATUS=CLOSED_WITH_DOCUMENTED_LIMITATIONS
PRODUCTION_OPERATIONAL_READINESS=PASS_WITH_LIMITATIONS
PRODUCTION_SYNC_COMPLETE=SI
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R7
LAST_UPDATED_DATE=2026-08-30
R7_REPORT=codex-reports/PRODUCTION_SYNC_R7.md
CHAT_SESSION_CHECK_URL_MISSING=SI
PRODUCTION_MISSING_REQUIRED_VARIABLE_COUNT=1
PRODUCTION_TESTING_DATABASE_CROSSOVER_COUNT=0
PREDEPLOY_POLICY_RECOMMENDATION=KEEP_MANUAL_MIGRATION_GATE
PRODUCTION_EXPAND_CONTRACT_POLICY_FROZEN=SI
PRODUCTION_BACKUP_POLICY_FROZEN=SI
AUXILIARY_JOB_READINESS_FINAL=PASS
KNOWN_PRODUCTION_SECRET_EXPOSURE_OPEN_COUNT=0
NEXT_PRODUCTION_SYNC_TASK_ID=NONE
NEXT_PROJECT_TASK_ID=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Production Sync (R1→R7) queda CERRADO como infraestructura de rollout
completa y segura, con una limitación documentada y acotada: `chat en
vivo`/production nunca recibió `DELIGO_MONOLITH_INTERNAL_URL`, por lo que
toda conexión de chat en tiempo real es rechazada hoy (fail-closed,
`internal-session-check-client.js`, sin bypass en el código) — refuerza,
no contradice, la pausa ya documentada de P2-T18. Fix de una variable
conocido, no aplicado (R7 fue 100% solo lectura). Políticas futuras
congeladas: migraciones manuales (`preDeployCommand` sigue `NONE` a
propósito), expand/contract, backup/recovery, runbook operativo, tabla de
titularidad de servicios. `NEXT_PROJECT_TASK_ID=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX`,
no autorizada.

## CURRENT TASK — PRODUCTION-SYNC-R6-R2 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R6-R2
CURRENT_TASK_STATUS=PASS_PRODUCTION_AUXILIARY_JOB_PARITY_CERTIFIED
PRODUCTION_SYNC_R6_R2=PASS_PRODUCTION_AUXILIARY_JOB_PARITY_CERTIFIED
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R6-R2
LAST_UPDATED_DATE=2026-08-30
R6_R2_REPORT=codex-reports/PRODUCTION_SYNC_R6_R2.md
REVIEW_PRODUCTION_INSTANCE_ID=c02e477e-a008-4358-9f9a-94add8fa381c
MESA_PRODUCTION_INSTANCE_ID=a232c84f-3062-4571-ae54-4473b64eb929
TESTING_DATABASE_CROSSOVER_DETECTED=NO
REVIEW_PRE_MAIN_EXECUTION_OCCURRED=NO
MESA_PRE_MAIN_EXECUTION_OCCURRED=NO
REVIEW_FIRST_PRODUCTION_RUN_STATUS=PASS
MESA_FIRST_PRODUCTION_RUN_STATUS=PASS
CHAT_CLEANUP_EXECUTION_COUNT_R6_R2=0
PRODUCTION_MIGRATIONS_FINAL_R6_R2=27
AUXILIARY_JOB_PARITY_PRODUCTION=PASS
R6_R2_FINAL_BACKUP_SHA256=63f0c9a1bb7c065526ca162e2cefc50dbbfa47bab608ee6f2b1024c0bcdb18d2
R6_R2_FINAL_BACKUP_RESTORABLE=SI
NEXT_TASK_ID=PRODUCTION-SYNC-R7
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

R6-R2 cerró la paridad de jobs auxiliares en Production con PASS: Review y
Mesa reutilizan sus objetos de proyecto existentes sin duplicados, ambos con
`branch=main`/commit exacto/`DATABASE_URL`→Production Postgres (nunca
TESTING), sin ninguna ejecución antes de que `main` estuviera configurado.
Mesa ya tenía una corrida real válida; Review necesitó un único redeploy
controlado (ejecutado manualmente por el operador tras el bloqueo del
clasificador del harness), cuya ejecución real llegó por el propio cron
horario. Ambas corridas `errors=0`. Backup final post-auxjobs creado,
restaurado y certificado. `NEXT_TASK_ID=PRODUCTION-SYNC-R7`, no autorizada.

## CURRENT TASK — PRODUCTION-SYNC-R6-R1 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R6-R1
CURRENT_TASK_STATUS=BLOCKED_REQUIRES_OPERATOR_ASSISTED_PRODUCTION_INSTANCE_CREATION
PRODUCTION_SYNC_R6_R1=BLOCKED_REQUIRES_OPERATOR_ASSISTED_PRODUCTION_INSTANCE_CREATION
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R6-R1
LAST_UPDATED_DATE=2026-08-30
R6_R1_REPORT=codex-reports/PRODUCTION_SYNC_R6_R1.md
OPERATOR_CHAT_CLEANUP_FIX_COMPLETED=SI
OPERATOR_CHAT_CLEANUP_REAL_EXECUTION_COUNT=1
DELIGO_POST_CLEANUP_CONFIG_DEPLOY_COMMIT_MATCH=SI
CHAT_POST_OPERATOR_CHANGE_HEALTH=PASS
PRODUCTION_RECORDED_MIGRATIONS_R6_R1=27
PRODUCTION_PENDING_MIGRATIONS_R6_R1=0
PRODUCTION_CLEANUP_SECRET_PRESENT=SI
LEGACY_X_CLEANUP_SECRET2_PRESENT=NO
R6_R1_BACKUP_SHA256=5537edc849f35f9bd1bea1ee7476bfd2a635ac2a5e9ccb5bde086438e1886dd1
R6_R1_CURRENT_BACKUP_RESTORABLE=SI
REVIEW_SAFE_PRODUCTION_INSTANCE_CREATION_PROVABLE=NO
MESA_SAFE_PRODUCTION_INSTANCE_CREATION_PROVABLE=NO
REVIEW_ELIGIBLE_NOW_COUNT=0
MESA_ACTIVE_OCCUPANCY_COUNT=0
MESA_ELIGIBLE_EXPIRY_COUNT=0
AUXILIARY_JOB_PARITY_PRODUCTION=BLOCKED_REQUIRES_OPERATOR_ASSISTED_INSTANCE_CREATION
NEXT_TASK_ID=PRODUCTION-SYNC-R6-R2
NEXT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR_UI_INSTANCE_CREATION
```

R6-R1 certificó con evidencia real el fix del operador sobre CLEANUP_SECRET/
x-cleanup-secret (redeploy no intencional de DeliGO, commit exacto, SUCCESS),
la salud de ambos servicios, la base en 27/0/0 y un backup lógico post-cleanup
fresco totalmente restaurado. La creación de instancias Production de Review/
Mesa quedó bloqueada: `serviceInstanceUpdate` no demostró semántica de
creación para un par (servicio, entorno) sin instancia previa, y crear un
servicio nuevo está prohibido por duplicar el objeto de proyecto. Hand-off
manual de UI documentado en `codex-reports/PRODUCTION_SYNC_R6_R1.md`; ambos
jobs en 0 candidatas elegibles ahora mismo (riesgo mínimo para R6-R2).

## CURRENT TASK — PRODUCTION-SYNC-R6-R0 (2026-08-30)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R6-R0
CURRENT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
PRODUCTION_SYNC_R6_R0=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R6-R0
LAST_UPDATED_DATE=2026-08-30
R6_R0_REPORT=codex-reports/PRODUCTION_SYNC_R6_R0.md
PRODUCTION_RECORDED_MIGRATIONS_R6_R0=27
PRODUCTION_SUCCESSFUL_MIGRATIONS_R6_R0=27
PRODUCTION_FAILED_MIGRATIONS_R6_R0=0
PRODUCTION_PENDING_MIGRATIONS_R6_R0=0
DATABASE_SCHEMA_UP_TO_DATE_R6_R0=SI
R6_BACKUP_RESTORABLE=SI
R6_R0_RAILWAY_MUTATION_COUNT=0
R6_R0_PRODUCTION_JOB_EXECUTION_COUNT=0
R6_R0_PRODUCTION_DB_WRITE=NO
R6_R0_GIT_PUSH_COUNT=0
R6_R0_CODE_DEPLOY_COUNT=0
NEXT_TASK_ID=PRODUCTION-SYNC-R6-R1
NEXT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
```

R6-R0 certificó el backup post-27/pre-jobs y auditó Review, Mesa y Chat
Cleanup sin mutaciones. Los dos objetos cron existen a nivel de proyecto y
solo tienen instancia TESTING; el scheduler externo de Chat Cleanup sigue
UNPROVEN_REQUIRES_OPERATOR_UI. Ver `codex-reports/PRODUCTION_SYNC_R6_R0.md`.

## CURRENT TASK — PRODUCTION-SYNC-R5 (2026-08-29)

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R5
CURRENT_TASK_STATUS=PASS_FINAL_CONTRACT_MIGRATION_27_APPLIED_PRODUCTION_SCHEMA_COMPLETE
PRODUCTION_SYNC_R5=PASS_FINAL_CONTRACT_MIGRATION_27_APPLIED_PRODUCTION_SCHEMA_COMPLETE
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R5
LAST_UPDATED_DATE=2026-08-29
R5_REPORT=codex-reports/PRODUCTION_SYNC_R5.md
R5_MIGRATION_NAME=20260826230000_drop_terminal_operativa_push_subscription
R5_MIGRATE_DEPLOY_ATTEMPT_COUNT=1
R5_MIGRATION_COMMAND_EXIT_CODE=0
PRODUCTION_RECORDED_MIGRATIONS_POST_R5=27
PRODUCTION_SUCCESSFUL_MIGRATIONS_POST_R5=27
PRODUCTION_FAILED_MIGRATIONS_POST_R5=0
PRODUCTION_PENDING_MIGRATIONS_POST_R5=0
TERMINALES_SALON_EXISTS_POST_R5=SI
PUSHSUBSCRIPTION_EXISTS_POST_R5=NO
PRODUCTION_SCHEMA_MATCHES_POST_27=SI
R5_PRIMARY_BACKUP_RESTORABLE=SI
PRODUCTION_DB_WRITE=SI
DATABASE_MIGRATION_EXECUTED_PRODUCTION=SI
R5_GIT_PUSH_COUNT=0
R5_CODE_DEPLOY_COUNT=0
R5_RAILWAY_SERVICE_RESTART_COUNT=0
NEXT_TASK_ID=PRODUCTION-SYNC-R6
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Migration #27 was applied exactly once in Production. The target column is
absent, the schema is up to date, reference aggregates are unchanged, and the
existing DeliGO and chat deployments remain healthy. No code or deployment
mutation occurred. Full evidence: `codex-reports/PRODUCTION_SYNC_R5.md`.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R5-R0-R1
CURRENT_TASK_STATUS=PASS_FRESH_POST26_PRE27_PRODUCTION_LOGICAL_BACKUP_RESTORABLE
PRODUCTION_SYNC_R5_R0_R1=PASS_FRESH_POST26_PRE27_PRODUCTION_LOGICAL_BACKUP_RESTORABLE
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R5-R0-R1
LAST_UPDATED_DATE=2026-08-29
R5_R0_R1_REPORT=codex-reports/PRODUCTION_SYNC_R5_R0_R1.md
PRODUCTION_DB_WRITE=NO
R5_R0_R1_GIT_PUSH_COUNT=0
R5_R0_R1_DATABASE_MIGRATION_COUNT=0
NEXT_TASK_ID=PRODUCTION-SYNC-R5
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

R5-R0 verificó Production PostgreSQL 18.6, el estado post-26/pre-27 y los
conteos de referencia, pero no pudo crear el backup porque sólo hay clientes
PostgreSQL 12 y no hay Docker/Podman. PostgreSQL 12 no se utilizó. No se creó
dump ni scratch restore, y no se ejecutó ninguna mutación. Ver
`codex-reports/PRODUCTION_SYNC_R5_R0.md`.

R5-R0-R1 obtuvo tooling oficial PostgreSQL 18.6, creó un dump custom fuera
del repo y lo restauró por completo en scratch 18.6. Production no cambió y
#27 no se ejecutó. Ver
`codex-reports/PRODUCTION_SYNC_R5_R0_R1.md`.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R4-R2-R2
CURRENT_TASK_STATUS=PASS_R4_DUAL_PRODUCTION_DEPLOY_CERTIFIED_27_PENDING
PRODUCTION_SYNC_R4_R2_R2=PASS_R4_DUAL_PRODUCTION_DEPLOY_CERTIFIED_27_PENDING
PRODUCTION_SYNC_R4=PASS_PRODUCTION_MAIN_FAST_FORWARDED_EXACT_CODE_DEPLOYED_HEALTHY_27_PENDING
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R4-R2-R2
LAST_UPDATED_DATE=2026-08-29
R4_R2_R2_REPORT=codex-reports/PRODUCTION_SYNC_R4_R2_R2.md
PRODUCTION_DB_WRITE=NO
DATABASE_MIGRATION_EXECUTED_PRODUCTION=NO
NEXT_TASK_ID=PRODUCTION-SYNC-R5
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

R4-R2-R2 certificó ambos deployments Production sobre el commit exacto
`c05525a5e0419922a484fbe6cb25c8604b8ca313`: DeliGO
`a3d7d7a4-3732-42d7-95b6-4ecbbeae6ca3` y chat
`94927d86-a16f-45cb-80b5-2637aace0a39`, ambos `SUCCESS`. Los dos servicios
están saludables; DeliGO y chat respondieron HTTP 200 en sus smokes seguros.
La DB permanece post-26/pre-27, con #27 como única pendiente y
`pushSubscription` presente. R5 queda listo, no ejecutado y requiere
autorización explícita.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R4-R2-R1
CURRENT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
PRODUCTION_SYNC_R4_R2_R1=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R4-R2-R1
LAST_UPDATED_DATE=2026-08-29
R4_R2_R1_REPORT=codex-reports/PRODUCTION_SYNC_R4_R2_R1.md
R4_R2_R1_MAIN_PUSH_COUNT=1
PRODUCTION_CODE_DEPLOY=SI
PRODUCTION_MAIN_MOVED=SI
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
```

R4-R2-R1 reverified all eight required Production variables, including the
three dedicated private-evidence Cloudinary variables, then passed the local
gate and executed exactly one fast-forward push. DeliGO deployed commit
`c05525a5e0419922a484fbe6cb25c8604b8ca313` successfully and
`https://deligo.ar/` returned HTTP 200. The task is blocked only because the
Railway CLI cannot safely perform the required branch-only change from
`testing` to `main` for Production `chat en vivo` while proving preservation
of repository, root and autodeploy. See
`codex-reports/PRODUCTION_SYNC_R4_R2_R1.md` for the manual UI handoff.

R4-R2 pasó los gates locales, pero la lectura directa de Railway Production
DeliGO contradijo la autoridad del operador: las tres variables exactas
`PRIVATE_EVIDENCE_CLOUDINARY_*` aparecen ausentes. Se detuvo antes del push y
no se intentó reparar la discrepancia automáticamente.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R4-R1
CURRENT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
PRODUCTION_SYNC_R4_R1=BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R4-R1
LAST_UPDATED_DATE=2026-08-29
R4_R1_REPORT=codex-reports/PRODUCTION_SYNC_R4_R1.md
R4_R1_MAIN_PUSH_COUNT=0
PRODUCTION_CODE_DEPLOY=NO
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
```

R4-R1 escribió y verificó sólo `REALTIME_INTERNAL_SERVICE_URL` para enrutar
Production→Production sin deploy. Las tres variables exactas de Cloudinary
de evidencia privada requieren acción manual con credenciales dedicadas de
Production; no se reutilizan las de TESTING. Chat Production mantiene repo
confirmado pero branch/root/autodeploy no expuestos por metadata.

```
CURRENT_TASK_ID=PRODUCTION-SYNC-R4
CURRENT_TASK_STATUS=BLOCKED_R4_REQUIRED_PRODUCTION_VARIABLES_UNCERTIFIED_AND_CHAT_SOURCE_BRANCH_UNPROVEN
PRODUCTION_SYNC_R4=BLOCKED_R4_REQUIRED_PRODUCTION_VARIABLES_UNCERTIFIED_AND_CHAT_SOURCE_BRANCH_UNPROVEN
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R4
LAST_UPDATED_DATE=2026-08-29
R4_REPORT=codex-reports/PRODUCTION_SYNC_R4.md
R4_MAIN_PUSH_COUNT=0
PRODUCTION_CODE_DEPLOY=NO
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_EXPLICIT_AUTHORIZATION_FOR_MISSING_PRODUCTION_DEPLOY_PREREQUISITES
```

R4 quedó bloqueada antes del push: faltan tres secretos exactos de evidencia
privada y la rama Production de `chat en vivo` no es demostrable desde su
metadata actual. La base conserva 26 migraciones exitosas, #27 pendiente y
`terminales_salon.pushSubscription` presente. No hubo mutaciones de Git,
Railway, código ni base.

```
DOCUMENT_ROLE=CROSS_CHAT_SECONDARY_CONTEXT (reconciliado en P2-T18-BLOCKER-AUTH2-R13-R2-R1 — este archivo ya NO es el primary handoff, para eliminar la ambigüedad de "a qué archivo enviar un chat nuevo")
PRIMARY_HANDOFF=CODEX_REPORT.md
THIS_FILE_ROLE=SECONDARY_CROSS_CHAT_CONTEXT
CURRENT_MASTER_TASK_HANDOFF=CODEX_REPORT.md (sin reemplazo — sigue siendo la autoridad de detalle por tarea)
DO_NOT_RECONSTRUCT_HISTORY_FROM_MEMORY=SI
SOURCED_FROM=codex-reports/archive/LEGACY_FULL_REPORT_20260826.md + CODEX_REPORT.md + codex-reports/ROADMAP.md + codex-reports/FINDINGS.md + codex-reports/DECISIONS_AND_INVARIANTS.md + codex-reports/TEST_AUTHORITY.md + codex-reports/GIT_DEPLOY_HISTORY.md + codex-reports/COMPLETED_TASKS.md + estado real de Git
LEGACY_FULL_REPORT_20260826_IMMUTABLE=SI (nunca se modifica, en ninguna tarea futura)
THIS_FILE_TRACKED_IN_GIT=NO (permanece sin trackear/sin stagear, nunca se commitea/pushea)
FULL_CONTEXT_UPDATE_REQUIRED_AFTER_EVERY_TASK=SI (actualizar al finalizar cada tarea futura, a partir de P2-T18-BLOCKER-AUTH2-R9)
LAST_UPDATED_BY_TASK=PRODUCTION-SYNC-R3-R3-R1
LAST_UPDATED_DATE=2026-08-29

CURRENT_TASK_ID=PRODUCTION-SYNC-R3-R3-R1
CURRENT_TASK_STATUS=PASS_PRODUCTION_BASELINED_AND_MIGRATED_THROUGH_26_DESTRUCTIVE_27_PENDING
PRODUCTION_SYNC_R3_R3_R1=PASS_PRODUCTION_BASELINED_AND_MIGRATED_THROUGH_26_DESTRUCTIVE_27_PENDING
NEXT_TASK_ID=PRODUCTION-SYNC-R4
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
R3_R2_R1_HISTORICAL_STATUS=PASS_SEMANTIC_0_INIT_COMPLETION_FULL_SCRATCH_REHEARSAL_CERTIFIED
R3_R3_STOP_REASON=psql ignoró el patch por orden inválido de argumentos; Production permanece intacta y no hubo reintento.
R3_R1_HISTORICAL_STATUS=BLOCKED_BASELINE_STATE_CANNOT_BE_PROVEN
R3_R2_R1_RESULT=completion semántica certificada en scratch; 26 migraciones exitosas y sólo #27 pendiente.
PRODUCTION_DB_WRITE=NO
DATABASE_MIGRATION_EXECUTED=NO
PRODUCTION_CODE_DEPLOY=NO
PRODUCTION_MAIN_MOVED=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_NEW_EXPLICIT_AUTHORIZATION
```

Este archivo existe para que un chat nuevo, sin memoria previa, pueda
entender el proyecto completo y continuar el trabajo sin necesidad de
leer los 123,000+ líneas del reporte legacy. Si algo aquí contradice
uno de los 8 archivos fuente listados arriba, ese archivo fuente gana
— este documento es una síntesis, nunca una autoridad independiente.

---

## 1. SNAPSHOT

```
PROJECT=DeliGO
REPO=C:\Leo Campos\Trabajo\deligo-main-limpio
BRANCH=testing-codex
HEAD=c05525a5e0419922a484fbe6cb25c8604b8ca313
ORIGIN_TESTING_CODEX=c05525a5e0419922a484fbe6cb25c8604b8ca313
AHEAD=0
BEHIND=0
INDEX_EMPTY=SI (sin nada staged)
WORKING_TREE=sin diferencias tracked; sólo archivos no rastreados (reportes/contexto, `32`, `1)` y un PNG público); 0 paths de `src/`, schema, migraciones o package modificados
R2_HISTORICAL_TASK_ID=PRODUCTION-SYNC-R2
R2_HISTORICAL_TASK_STATUS=PASS_PRODUCTION_VARIABLES_READY_PREDEPLOY_ACTIVATION_DEFERRED_TO_SAFE_DEPLOY_STAGE (ver codex-reports/PRODUCTION_SYNC_R2.md — primera mutación real de Production: 4/4 secretos (REALTIME_SOCKET_TOKEN_SECRET/REALTIME_SESSION_CHECK_SECRET/REALTIME_INTERNAL_PUBLISH_SECRET/REGISTRATION_LIMIT_SECRET) generados con CSPRNG por el usuario manualmente (mutación del agente bloqueada por el clasificador de permisos del harness) y verificados read-only vía fingerprint SHA-256 sin plaintext — compartidos correctamente, cero reutilización de TESTING; REALTIME_INTERNAL_SERVICE_URL cerrado como falso positivo de drift pero NO escrito; preDeployCommand diferido — no se pudo probar que serviceInstanceUpdate no dispare deploy; deploy NO disparado, confirmado por railway status --json; R2_HISTORICAL_NEXT_TASK_ID=PRODUCTION-SYNC-R3 READY_NOT_EXECUTED, requiere autorización explícita del usuario)
P2_T18_DISPOSITION=PAUSED_NOT_CLOSED_EXTERNAL_INFRA_DEPENDENCY (F-P1-02/F-P1-01/F-P2-T18-LIVE-PUSH-01 quedan abiertos; NO investigar más Railway sin nueva instrucción explícita; bloquea sólo el lanzamiento operativo completo de pedidos/chat en tiempo real, NO el onboarding de catálogo)
R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION (preservado íntegro a través de todas las etapas hasta R13-R6)
R13_R3=BLOCKED_AUTH02_PRECOMMIT_ADVERSARIAL_FINDING (histórico, no reescrito — TEST_COVERAGE_GAP aislado M9, no PRODUCT_DEFECT — ver §11.1)
R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED (cierre focal test-only del gap M9 — preservado, recertificado correcto por R13-R3-RETRY y RETRY-2 — ver §11.1)
R13_R3_RETRY=BLOCKED_AUTH02_TEST_COVERAGE_GAP (histórico, no reescrito — M9 recertificado correcto, pero encontró un SEGUNDO gap distinto M19-NEW — ver §11.1)
R13_R3_RETRY_R1=PASS_AUTH02_M19_TEST_COVERAGE_GAP_CLOSED (cierre focal test-only del gap M19-NEW — preservado, recertificado correcto por RETRY-2 — ver §11.1)
R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE (histórico, no reescrito — recertificación final desde cero: AUTH02 100% verde en cobertura/mutación/seguridad/aceptación/focal — BLOCK exclusivamente por 1 fallo de regresión en archivo ajeno — ver §11.1)
R13_R3_RETRY_2_R1=BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE (histórico, no reescrito — clasificación diagnóstica: 0 solapamiento con AUTH02 confirmado estructuralmente, D1 FAIL/D2 PASS/D3 PASS, clasificado INCONCLUSIVE_EXTERNAL_DB_INSTABILITY — ver §11.1)
R13_R3_RETRY_2_R2=BLOCKED_FRESH_TANDA_2_CERTIFICATION_FAILURE (gate de certificación: SEGUNDO fallo consecutivo del mismo caso SEC-BLOCK-1 exacto, misma latencia anómala; AUTH02 en sí sigue 100% verde por identidad de bytes — ver §11.1)
R13_R3_RETRY_2_R2_R1=PASS_REPEATED_SEC_BLOCK_1_FAILURE_DISPOSITION_FROZEN (disposición read-only: EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY, confianza MEDIA — E2/D1 aislado también falló, descartando contención entre archivos de TANDA_2; PASS = disposición determinada, NO autorización de commit — ver §11.1)
R13_R3_RETRY_2_R2_R1A=PASS_USER_PROCESS_DECISION_DEDICATED_DB_DEFERRED_AUTH02_PRECOMMIT_ACCEPTED_WITH_SINGLE_INFRA_EXCEPTION (el usuario decidió diferir la DB de TESTING dedicada y continuar con la infraestructura existente; verificados 6/6 gates A-F sobre la autoridad ya persistida; excepción acotada EX-P2-T18-SEC-BLOCK-1-P2028 aceptada; AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=SI, R13_R4_AUTHORIZED=SI — ver §11.1)
R13_R4=PASS_AUTH02_EXACT_LOCAL_COMMIT (commit fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f, parent a1579f11e79a41b90c6df4d2e8573ca9a669b856, subject "fix: scope shared auth requests by actor family"; 14/14 blobs commiteados verificados contra la autoridad certificada; sin push/deploy — ver §11.1)
R13_R5=PASS_AUTH02_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW (recertificación INDEPENDIENTE del commit fe0e11d0 leyendo objetos Git directamente desde HEAD, sin confiar en el resumen de R13-R4; fileset por 2 métodos Git + 14 blob IDs vía git ls-tree — 14/14 idénticos; contrato de proxy/Chat/Push y M9/M19 confirmados en los blobs commiteados; 0 tests ejecutados; R13_R6_AUTHORIZED=SI — ver §11.1)
R13_R6=PASS_AUTH02_TESTING_PUSH_DEPLOY_CERTIFIED (gate prepush fresco lean: focal 117/117 una corrida, ESLint/TSC(31/24 idéntico)/git show --check/build todos PASS; push único a1579f1..fe0e11d sin --force; autodeploy Git-triggered observado read-only — DeliGO Copy y chat en vivo ambos SUCCESS en fe0e11d0 exacto confirmado desde metadata real de Railway; health/logs postdeploy limpios; AUTH02 ahora DESPLEGADO en TESTING; R13_R7_AUTHORIZED=SI — ver §11.1)
R13_R7=PASS_AUTH01_AUTH02_FULL_REAL_BROWSER_REPLAY_18_OF_18 (matriz de 18 casos de R13 repetida desde cero con Chrome real, 0/18 crédito heredado; CASE_05 confirma que Cliente sobrevive sin recarga al login de Negocio, ataque directo a AUTH01; CASE_09 confirma que no-leidos/conversaciones/mensajes/realtime-token/realtime-authorize devuelven 200 para ambos actores coexistiendo, síntoma AUTH02 NO reproducido; 18/18 PASS, 2/2 correcciones de control documentadas, cleanup DB+navegador completo — ver §11.1)
F_P1_02_REAL_BROWSER_ACCEPTANCE=BLOCKED_REAL_BROWSER_TYPING_CONTROL_INVALID (intento con Chrome real, fixture fresca P2T18_F_P1_02_, topología X1/X2/Y1, baseline de chat PASS ambas direcciones — pero el indicador de typing nunca apareció en el receptor en ninguna dirección pese a room-grants recién renovados y sendTyping confirmado disparado por el emisor; CONTROL_INVALID, no PASS ni FAIL — ver §11.1)
F_P1_02_R1=PASS_DIAGNOSIS_GENUINE_TYPING_CHANNEL_DEFECT_ISOLATED (histórico, CORREGIDO por R1-R1 — el observador de WebSocket + read_network_requests compartían un punto ciego real para tráfico WS nativo; "cero evidencia" no era "cero conexión" — ver F_P1_02_R1_R1 abajo)
F_P1_02_R1_R1=PASS_FALSE_POSITIVE_IDENTIFIED_AND_CORRECTED (histórico — el navegador SÍ conecta, F-P2-T18-TYPING-CHANNEL-01 retirado; ver F_P1_02_R2 abajo para el bloqueador ACTUAL)
F_P1_02_R2=FAIL_NEW_LIVE_PUSH_DEFECT_ISOLATED (reintento de la matriz de 6 casos de typing con topología real X1/X2/Y1: 0/6 mostró indicador alguno, descartados metódicamente rate-limit/grant-expiry/timing/identidad/scopes; prueba decisiva — mensaje NUEVO enviado desde Y1 con el hilo de X1 ya montado y a la vista nunca apareció en vivo — aísla el defecto al push servidor→cliente EN GENERAL (new-message + user-typing), no sólo typing; el "baseline PASS" reflejaba HTTP+refetch-on-reopen, no push real; nuevo finding F-P2-T18-LIVE-PUSH-01 (OPEN_ROOT_CAUSE_NOT_INVESTIGATED, severidad MEDIUM_TO_HIGH); F_P1_02_CURRENT_STATUS=BLOCKED_BY_LIVE_PUSH_DEFECT; posible misma causa raíz que F-P1-01, no confirmado; NEXT_REQUIRES_USER_DISPOSITION=SI — ver §11.1)
F_P1_02_R3=PARTIAL_ROOT_CAUSE_NARROWING_NO_FIX_YET (histórico — descartadas multi-réplica, reconexión/expiración, wiring del relay; ver F_P1_02_R4 abajo)
F_P1_02_R4=PASS_SERVER_SIDE_RULED_OUT_GAP_IS_TRANSPORT_OR_CLIENT (histórico — instrumentación del chat-service confirmó join_ok + typing_received candidates=2 emitted=1, el servidor SÍ emite; ver F_P1_02_R5 abajo para la conclusión final)
F_P1_02_R5=PASS_CLIENT_HANDLER_NEVER_INVOKED_GAP_IS_TRANSPORT_DELIVERY (usuario autorizó instrumentación del código principal de la app; logging agregado a `attachEventRelay` en realtime-manager.ts — relay_fired en cada evento recibido del socket, excepciones de subscriber ya no silenciadas; commiteado, pusheado, desplegado a TESTING en DeliGO Copy Y chat en vivo; con fixture fresca, typing disparado, consola del receptor leída en tiempo real (verificado que console.log SÍ se captura y que el chunk desplegado SÍ contenía el código nuevo, vía fetch con cache:'no-store') — **relay_fired NUNCA se registró, para ningún evento, en ningún actor**; combinado con R4 (servidor confirmado emitiendo), esto es evidencia triple-convergente: UI nunca refleja push, servidor confirma que emite, cliente confirma que su handler nunca se invoca — TODA la lógica de aplicación (servidor y cliente) descartada con evidencia real; la brecha es de ENTREGA DE TRANSPORTE, candidato más plausible: infraestructura de red/proxy entre Railway y el navegador, fuera del alcance de instrumentación de código adicional; instrumentación revertida inmediatamente después (commit c05525a, realtime-manager.ts confirmado byte-idéntico al estado pre-diagnóstico) — ver §11.1)
F_P1_02_R6=CONFIRMED_NETWORK_INDEPENDENT_LIKELY_RAILWAY_INFRA (usuario eligió explorar infraestructura de Railway; antes de eso se descartó la sandbox de pruebas como confusor reproduciendo el mismo test en Chrome real sobre la red real del usuario — defecto idéntico, 0 indicador de typing; `railway logs --network --json` (read-only) no mostró paquetes descartados en una muestra, pero es a nivel TCP, no WebSocket-frame, limitando su valor diagnóstico; se agotaron las vías de código/CLI de sólo lectura disponibles — causa raíz exacta requeriría soporte/acceso a infraestructura de Railway, fuera del alcance de este flujo de trabajo — ver §11.1)
NEXT_TASK_ID=PENDING_USER_DISPOSITION
NEXT_TASK_STATUS=AWAITING_USER_INPUT (A: contactar soporte de Railway con la evidencia reunida, gestionado por el usuario; B: diferir y avanzar a otra prioridad post-T18; C: diferir y cerrar P2-T18 con residual aceptado)
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
P3=NOT_STARTED
PHASE1=DEPLOYED_TESTING_CERTIFIED
PHASE2=DEPLOYED_TESTING_REAL_BROWSER_CERTIFIED_18_OF_18
P2_T18_CURRENT=BLOCKED_ONLY_BY_REMAINING_CHAT_UI_REAL_BROWSER_ACCEPTANCE_F_P1_02_THEN_F_P1_01
F_P2_T18_AUTH01_STATUS=RESOLVED
F_P2_T18_AUTH01_CURRENT_STATUS=RESOLVED
F_P2_T18_AUTH02_STATUS=RESOLVED
F_P2_T18_AUTH02_CURRENT_STATUS=RESOLVED
AUTH01_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
AUTH02_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
R13_R7_ACCEPTANCE_MATRIX=18_OF_18_PASS
AUTH02_PRODUCT_ALLOWLIST_COUNT=7
AUTH02_TEST_ALLOWLIST_COUNT=7
AUTH02_CALLSITE_COUNT=11
AUTH02_NEW_SCOPE_PUSH_STATUS=SI
AUTH02_UNSUBSCRIBE_AFFECTED=SI
AUTH02_ROUTE_HANDLERS_CHANGED=NO
R13_R3_MUTANTS_ATTEMPTED=19
R13_R3_MUTANTS_DETECTED=17
R13_R3_MUTANTS_SURVIVED=2
R13_R3_BLOCKER_CLASS=TEST_COVERAGE_GAP
R13_R3_R1_TARGET_TEST_PATH=src/hooks/use-push-notifications-static-contract.test.ts
R13_R3_R1_PRODUCT_PATHS_CHANGED=0
R13_R3_R1_TEST_PATHS_CHANGED=1
R13_R3_R1_FOCAL_RESULT=117_OF_117_PASS
R13_R3_RETRY_MUTANTS_ATTEMPTED=20
R13_R3_RETRY_EQUIVALENT_MUTANTS=1 (M3)
R13_R3_RETRY_NON_EQUIVALENT_DETECTED=18
R13_R3_RETRY_VALID_SURVIVORS=1 (savePushSubscription fetch(url) consumption — permission-prompt.tsx, cerrado en RETRY-R1)
R13_R3_RETRY_TARGET_TEST_PATH=src/components/shared/permission-prompt-static-contract.test.ts
R13_R3_RETRY_R1_TARGET_TEST_PATH=src/components/shared/permission-prompt-static-contract.test.ts
R13_R3_RETRY_R1_PRODUCT_PATHS_CHANGED=0
R13_R3_RETRY_R1_TEST_PATHS_CHANGED=1
R13_R3_RETRY_R1_FOCAL_RESULT=117_OF_117_PASS
R13_R3_RETRY_2_MUTANTS_ATTEMPTED=20
R13_R3_RETRY_2_EQUIVALENT_MUTANTS=1 (M3)
R13_R3_RETRY_2_NON_EQUIVALENT_DETECTED=19
R13_R3_RETRY_2_VALID_SURVIVORS=0
R13_R3_RETRY_2_SECURITY_MATRIX=20_OF_20_PASS
R13_R3_RETRY_2_LOCAL_ACCEPTANCE_MATRIX=12_OF_12_PASS
R13_R3_RETRY_2_FOCAL_RESULT=117_OF_117_PASS
R13_R3_RETRY_2_REGRESSION_TANDA_1=163_OF_163_PASS
R13_R3_RETRY_2_REGRESSION_TANDA_2=30_OF_31_PASS_1_FAIL (client-block-security.integration.test.ts, SEC-BLOCK-1, ajeno a AUTH02)
R13_R3_RETRY_2_REGRESSION_TANDA_3=NO_EJECUTADA
R13_R3_RETRY_2_R1_D1=FAIL (P2028, resA, 25144ms, aislado)
R13_R3_RETRY_2_R1_D2=PASS (19/19, archivo completo)
R13_R3_RETRY_2_R1_D3=PASS (31/31, TANDA_2 exacta)
R13_R3_RETRY_2_R1_FAILURE_CLASS=INCONCLUSIVE_EXTERNAL_DB_INSTABILITY
R13_R3_RETRY_2_R1_AUTH02_OVERLAP=NO (proxy.ts nunca importado/invocado en el test, confirmado estructuralmente)
R13_R3_FULL_RETRY_REQUIRED=SI (cumplido por R13-R3-RETRY-2; el gate de regresión fresca falló de nuevo en R13-R3-RETRY-2-R2; disposición determinada en R13-R3-RETRY-2-R2-R1; usuario aceptó excepción acotada y autorizó R13-R4 en R13-R3-RETRY-2-R2-R1A)
R13_R4_AUTHORIZED_BY_R13_R3_RETRY=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_R1=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2_R1=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2_R2=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2_R2_R1=NO
R13_R4_AUTHORIZED_BY_R13_R3_RETRY_2_R2_R1A=SI
R13_R6_AUTHORIZED_BY_R13_R5=SI
R13_R7_AUTHORIZED_BY_R13_R6=SI
R13_REPLAY_REQUIRED_FROM_ZERO=SI
R13_REPLAY_REQUIRED_MATRIX=18_OF_18
CURRENT_HEAD=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
CURRENT_ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
CURRENT_AHEAD_OF_ORIGIN=0
LAST_PUSH_STAGE=P2-T18-BLOCKER-AUTH2-R13-R6
LAST_PUSH_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
LAST_TESTING_DEPLOY_STAGE=P2-T18-BLOCKER-AUTH2-R13-R6
LAST_REAL_BROWSER_STAGE=P2-T18-BLOCKER-AUTH2-R13-R7
LAST_RECONCILIATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R1
LAST_LOCAL_IMPLEMENTATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R2
LAST_DOC_RECONCILIATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R2-R1
LAST_ADVERSARIAL_REVIEW_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2
LAST_TEST_ONLY_CORRECTION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1
LAST_DIAGNOSTIC_CLASSIFICATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1
LAST_CERTIFICATION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2
LAST_DISPOSITION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1
LAST_USER_PROCESS_DECISION_STAGE=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A
LAST_LOCAL_COMMIT_STAGE=P2-T18-BLOCKER-AUTH2-R13-R4
LAST_POSTCOMMIT_REVIEW_STAGE=P2-T18-BLOCKER-AUTH2-R13-R5
LAST_TESTING_PUSH_DEPLOY_STAGE=P2-T18-BLOCKER-AUTH2-R13-R6
PRIMARY_HANDOFF=CODEX_REPORT.md
THIS_FILE_ROLE=SECONDARY_CROSS_CHAT_CONTEXT
```

**Regla de idioma (permanente, repetida en cada etapa)**: toda
comunicación dirigida al usuario, y toda narrativa agregada a los
reportes, se escribe en ESPAÑOL. Literales técnicos, hashes, rutas,
comandos y marcadores permanecen en inglés.

**Archivo raíz `32` (permanente, absoluto, repetido sin excepción en
cada prompt de etapa)**: NUNCA leer, inspeccionar, ejecutar, modificar,
stagear ni borrar. Aparece como `?? 32` en cada `git status` de este
proyecto — es intencional, no un artefacto a limpiar.

---

## 2. PERMANENT EXECUTION RULES

Reglas operativas acumuladas a lo largo de toda la sesión, vigentes
para cualquier tarea futura salvo que el usuario las revoque
explícitamente:

- **Idioma español + archivo `32` intocable** — ver §1, sin excepción.
- **`WOULD_NEW_FACT_HAVE_CHANGED_EXTERNAL_PROMPT`** (fuse rule,
  establecida tras el incidente "ALTO CONTROLADO" de AUTH2-R2): si
  durante la implementación se descubre un hecho arquitectónico nuevo
  que habría cambiado el encargo original de haberse conocido antes,
  se detiene todo trabajo sustantivo de inmediato — nunca se
  auto-adapta en silencio. Se reporta el hecho y se espera la próxima
  etapa/instrucción.
- **Stop-on-objective / anti-scope-creep**: al llegar a un veredicto
  PASS/BLOCK, se detiene inmediatamente — no se persigue causa raíz
  adicional ni se expande el alcance más allá de lo pedido por la
  etapa activa.
- **Archive-before-overwrite**: antes de sobrescribir
  `codex-reports/CURRENT_TASK.md` con el contenido de una nueva etapa,
  el contenido anterior se archiva primero en
  `codex-reports/archive/<TASK-ID>.md`, verificado por hash.
- **`git add --` explícito, nunca `-A` ni `.`** al preparar un commit
  de una etapa — sólo los paths exactos del allowlist congelado.
- **Un solo commit por etapa de "commit exacto"**, con subject
  pre-congelado en la etapa de diseño previa, nunca decidido en el
  momento del commit.
- **Push explícito y único** — sólo cuando el usuario lo autoriza
  expresamente en el propio prompt de la etapa (nunca por iniciativa
  propia), y siempre exactamente un `git push origin testing-codex`
  sin `--force`.
- **Autodeploy de Railway se observa pasivamente** (vía
  `railway status --json`, filtrando por `environmentId` de TESTING —
  el JSON completo incluye un nodo `production` no relacionado que se
  debe descartar) — nunca `railway up` ni redeploy manual.
- **Fixtures de DB reales sólo en TESTING**, vía
  `DELIGO_TEST_DATABASE_URL`, siempre con prefijo identificable en el
  nombre (p.ej. "P2T18 Stage7 R1"), y siempre eliminados por completo
  (0 remanentes) al finalizar la etapa. Nunca fallback silencioso a
  otra `DATABASE_URL`.
- **Byte-frozen neighbors**: cualquier archivo declarado "no debe
  cambiar" en una etapa se verifica con `git hash-object` antes Y
  después de cualquier trabajo con capacidad de mutación.
- **Mutation testing, cuando se pide, se ejecuta en un espejo AISLADO
  fuera del repo** (directorio temporal con `tsconfig.json` propio
  mapeando paquetes reales vía `paths`) — nunca se muta un archivo del
  repositorio real.
- **Un mutante sobreviviente bloquea la etapa**, salvo prueba
  independiente de que el arnés de mutación es inválido. En una etapa
  de revisión adversarial explícitamente marcada "no corregir", el
  hallazgo se reporta y se define un follow-up focal — nunca se
  corrige el test in situ, para preservar la separación entre "quien
  encuentra el defecto" y "quien lo corrige".
- **Un allowlist heredado de una etapa de diseño anterior se
  re-verifica contra el código actual en cada nueva etapa relevante,
  nunca se copia sin comprobar** — tanto para encontrar superficie no
  vista antes como para descartar superficie que ya no hace falta.
- **Un fallo de test se investiga por reproducibilidad antes de
  clasificarse** — ni se ignora silenciosamente, ni se trata como
  bloqueo automático, cuando hay evidencia de que es un flake
  transitorio de infraestructura externa (p.ej. una prueba de
  concurrencia real contra DB) y el código conmiteado no cambió entre
  intentos.
- **`codex-reports/archive/LEGACY_FULL_REPORT_20260826.md` es
  permanentemente inmutable** — nunca se modifica/reescribe/anexa, en
  ninguna tarea futura, para siempre.
- **Este archivo (`DELIGO_FULL_CONTEXT_LATEST.md`) se actualiza al
  finalizar cada tarea futura**, permanece sin trackear/sin stagear en
  Git, y se construye únicamente a partir de las 8 autoridades
  nombradas más el estado real de Git — nunca de la memoria del
  modelo.

---

## 3. SYSTEM / ARCHITECTURE SUMMARY

DeliGO es un monolito Next.js (`DeliGO Copy`, serviceId
`c6335604-063a-4a10-9c82-b0acb9e8ca7a`) más un microservicio de chat en
tiempo real separado (`chat en vivo`, serviceId
`bc071a6e-9ec1-46e4-99a9-e8ca0302a95e`), desplegados en Railway, proyecto
`amiable-rejoicing`. Tres tipos de actor con áreas propias bajo prefijo
de ruta: `/cliente`, `/negocio`, `/repartidor` (más `/admin` para
superadmin, fuera del sistema de familias). Autenticación por cookie de
sesión + fila `Sesion` en Postgres. Realtime vía WebSocket nativo
(`src/lib/realtime-manager.ts` en el cliente, chat-service en el
servidor) para chat y tracking de repartidor. Estado de auth en cliente
vía Zustand (`src/store/auth-store.ts`) con middleware `persist` sobre
`localStorage`.

**Infra Railway TESTING** (usada para toda certificación runtime real):
proyecto `amiable-rejoicing`, environment `TESTING`
(id `f37d0c49-b737-49e8-be89-a00c13734fae`), servicios `DeliGO Copy` y
`chat en vivo`, más Postgres y 2 cron jobs (`Review Moderation Expiry`,
`DeliGO Mesa Occupancy Cron`) que autodeployan incidentalmente en cada
push al monorepo.

---

## 4. ROADMAP (resumen — autoridad completa en `codex-reports/ROADMAP.md`)

```
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
  P2-T02=PAUSED_EXTERNAL_DEPENDENCY
  P2-T05=CLOSED (push notification hardening)
  P2-T11=CLOSED (native-socket revocation hardening, con 1 residual LOW aceptado)
  P2-T12=CLOSED (TerminalOperativa dead-column removal)
  P2-T13=CLOSED (Race-B stale-detach fix)
  P2-T18=BLOCKED_BY_AUTH_SESSION_COEXISTENCE_PHASE2_PRECOMMIT_TEST_GAPS_FOUND (Chat Cross-Tab UI Polish — activo)
P3=NOT_STARTED
```

Próxima tarea canónica una vez P2-T18 cierre por completo (incluido su
blocker AUTH2 y la certificación real de navegador): sin definir
todavía — P2-T18 sigue siendo el foco activo de todo el roadmap.

---

## 5. COMPLETED TASK HISTORY (índice — autoridad completa en `codex-reports/COMPLETED_TASKS.md`, 963 líneas, leído íntegro)

- **P0 / P1**: CLOSED, fundacional, fuera de esta ventana de contexto reciente.
- **P2-T02**: PAUSED_EXTERNAL_DEPENDENCY.
- **P2-T05** (hardening de push notifications): Stage1→FINAL-TESTING-CHECKPOINT, findings F15/F18–F23 todos RESOLVED, commit final `e172cd7ac8245d32db89f96cf6c86ca31bb43cf2`.
- **P2-T11** (hardening de revocación de socket nativo): Stage1→Stage5G, Phase A/B/C commits `d0ba59d`/`e8d2171`/`f6ca24f`, CLOSED con 1 residual LOW aceptado — ver §10 para el contexto completo.
- **P2-T12** (remoción de columna muerta TerminalOperativa, dos fases): Stage1→Stage5F, commits `bebd36c`/`7822d84`, CLOSED.
- **P2-T13** (fix de Race-B stale-detach): Stage1→Stage7, commit `44b9da0`, CLOSED.
- **P2-T18-STAGE1**: baseline freeze de F-P1-01/F-P1-02, ambos `REPRODUCED`/`UI_POLISH` — arranque de la tarea activa, ver §11.

Los 5 commits recientes en `git log` de esta rama, en orden:
`d0ba59d` (Phase A P2-T11) → `7822d84`/`bebd36c` (P2-T12) →
`44b9da0` (P2-T13) → `e172cd7` (P2-T05 checkpoint), todos anteriores a
la cadena AUTH2 de P2-T18 (que añade `1adcc01f...` y `c047e9eb...`
encima, ambos ya en `origin/testing-codex`).

---

## 6. ACTIVE / DEFERRED FINDINGS (autoridad completa en `codex-reports/FINDINGS.md`)

Todos los findings de P0/P1/P2-T05/P2-T11/P2-T12/P2-T13 están
`RESOLVED`/`CLOSED`. Activos o diferidos actualmente:

1. **`F-P2-T18-AUTH01`** — `SAME_BROWSER_MULTI_ACTOR_SESSION_COLLISION`.
   Status actual: `PHASE2_LOCAL_IMPLEMENTED_TEST_COVERAGE_GAPS_FOUND_AWAITING_R9_R1`.
   Ver §12 para el diseño completo y §15 para la próxima acción.
2. **`F-P1-01`** — chat cross-tab: `messages-read` entregado a la
   pestaña hermana pero ignorado por la UI (unread queda stale hasta
   el próximo poll). `REPRODUCED_CURRENT_ACCEPTANCE_CONTRACT_FROZEN`,
   severidad `COSMETIC`, `UI_POLISH`. Bloqueado detrás de
   F-P2-T18-AUTH01 (necesita coexistencia multi-actor para certificar
   con navegador real con topología completa).
3. **`F-P1-02`** — chat cross-tab: typing se auto-refleja en la
   pestaña hermana del mismo actor. Fix ya commiteado/desplegado
   (`1adcc01f`). Ya NO bloqueado por AUTH01/AUTH02 (`RESOLVED` desde
   R13-R7). La certificación real-browser
   (`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE`, 2026-08-29) confirmó
   baseline de chat sano pero `CONTROL_INVALID` en el canal de typing.
   El diagnóstico acotado subsiguiente
   (`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1`, 2026-08-29) aisló
   inicialmente como causa que el navegador nunca intentaba conectar
   al chat-service — nuevo finding `F-P2-T18-TYPING-CHANNEL-01`. La
   investigación de seguimiento (`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1-R1`,
   2026-08-29, disposición A del usuario "investigar/corregir ahora")
   **corrigió esa conclusión**: era un falso positivo de
   instrumentación (el observador de WebSocket y `read_network_requests`
   comparten un punto ciego real para tráfico WS nativo). Verificación
   decisiva con Chrome real contra el código sin modificar confirmó
   que **el navegador SÍ conecta correctamente** (`/realtime/token`+
   `/realtime/authorize`=200 gateados tras `ensureConnected()` exitoso,
   indicador UI "● Conectado"). `F-P2-T18-TYPING-CHANNEL-01` reclasificado
   `FALSE_POSITIVE_CORRECTED`, retirado como bloqueador. El reintento
   de aceptación (`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R2`,
   2026-08-29) ejecutó la matriz de 6 casos con topología real
   X1/X2/Y1: **0/6 mostró indicador de typing**, con rate-limit/
   grant-expiry/timing/identidad/scopes metódicamente descartados. Una
   prueba decisiva (mensaje nuevo enviado desde Y1 con el hilo de X1
   ya montado y a la vista) confirmó que el defecto es más amplio:
   **el push servidor→cliente no llega en absoluto** (ni `new-message`
   ni `user-typing`), pese a conexión/autorización correctas — el
   "baseline PASS" reflejaba HTTP+refetch-on-reopen, no push real.
   Nuevo finding `F-P2-T18-LIVE-PUSH-01` (`OPEN_ROOT_CAUSE_NOT_INVESTIGATED`,
   severidad MEDIUM_TO_HIGH, posible misma causa raíz que F-P1-01, no
   confirmado). `F_P1_02_CURRENT_STATUS=BLOCKED_BY_LIVE_PUSH_DEFECT`.
   Ver `codex-reports/CURRENT_TASK.md` y §11.1 más abajo.
4. **`NONBLOCKING_COSMETIC_DEBT`** (sin F-ID formal) — prefijo
   `"configuration_"` duplicado en
   `mini-services/chat-service/internal-session-check-client.js`'s
   `checkSessionActive()`. `SEVERITY=COSMETIC`,
   `SECURITY_IMPACT=NINGUNO`, `STATUS=OPEN_NONBLOCKING`, dispuesto para
   una futura tarea equivalente a P2-T15.

---

## 7. PERMANENT DECISIONS / INVARIANTS (índice — autoridad completa en `codex-reports/DECISIONS_AND_INVARIANTS.md`)

- La autoridad de proxy/middleware activa es `src/proxy.ts` — Next.js
  16 falla el build si coexiste con `middleware.ts`. Nunca reintroducir
  `middleware.ts`.
- `SESSION_LOGIN_ATOMICITY_DEBT` resolvió únicamente atomicidad de
  logins concurrentes del MISMO actor — nunca resolvió coexistencia de
  cookies entre actores DISTINTOS (eso es exactamente
  `F-P2-T18-AUTH01`).
- Cuando dos partes del sistema (cliente/servidor) implementan el mismo
  concepto (resolución de familia por prefijo de ruta), deben usar
  EXACTAMENTE el mismo patrón boundary-safe de comparación — nunca una
  aproximación "parecida".
- "Tests en verde" no es prueba de ausencia de gaps de cobertura —
  sólo prueba que los tests existentes pasan contra el código
  existente. Un contrato de test estático basado en
  `toContain`/`toMatch` tiene una debilidad estructural inherente
  (`STATIC_STRING_ONLY_WEAKNESS`): detecta presencia de un patrón
  correcto, no ausencia de una condición adicional insertada en otro
  lugar.
- El resto de invariantes históricos (P0/P1/P2-T05/P2-T11/P2-T12/P2-T13)
  están documentados en detalle en el archivo fuente — no repetidos
  aquí por no ser accionables para el trabajo activo.

---

## 8. TEST AUTHORITIES (índice — autoridad completa en `codex-reports/TEST_AUTHORITY.md`)

```
PHASE1_LOCAL_TEST_TOTAL=73/73 PASS (5 archivos: proxy.test.ts + 4 más)
PHASE2_LOCAL_TEST_TOTAL=130/130 PASS (33 mandatorios de Fase 2 + 97 de regresión de Fase 1/P2-T11)
R9_FRESH_RERUN=130/130 PASS (re-derivado independientemente, coincide exacto)
R9_MUTATION_TESTING=12 mutantes intentados fuera del repo, 10 detectados, 2 sobrevivientes (gaps de cobertura, no defectos)
P2_T18_PHASE2_SAFE_TO_COMMIT=NO_BLOCKED_AWAITING_R9_R1_TEST_COVERAGE_CLOSURE
```

Archivos de test de Fase 2 (los 4 relevantes para el trabajo activo):
`src/store/auth-store.test.ts` (9 tests, nuevo), `src/lib/realtime-client.test.ts`
(7 tests, nuevo), `src/hooks/use-auth-static-contract.test.ts` (11
tests, nuevo), `src/providers/realtime-provider-cross-tab-static-contract.test.ts`
(6 tests, sólo assertion #2 modificada — preexistente de P2-T11).

---

## 9. GIT / DEPLOY HISTORY (índice — autoridad completa en `codex-reports/GIT_DEPLOY_HISTORY.md`)

```
HEAD_ACTUAL=a1579f11e79a41b90c6df4d2e8573ca9a669b856
ORIGIN_TESTING_CODEX=a1579f11e79a41b90c6df4d2e8573ca9a669b856 (idéntico, sin drift)
ÚLTIMO PUSH=P2-T18-BLOCKER-AUTH2-R12 (c047e9eb..a1579f11)
ÚLTIMO DEPLOY TESTING CONFIRMADO=commitHash a1579f11 en ambos servicios (DeliGO Copy deployment 78625067, chat en vivo deployment 1916b7af), ambos SUCCESS
```

Cadena de commits recientes en `testing-codex` (más antiguo → más
reciente): `d0ba59d` (P2-T11 Phase A) → `7822d84`/`bebd36c` (P2-T12) →
`44b9da0` (P2-T13) → `e172cd7` (P2-T05 checkpoint) → `f6ca24f` (P2-T11
Phase C) → `1adcc01f` (P2-T18-STAGE4, F-P1-01/F-P1-02 local) →
`c047e9eb` (P2-T18-BLOCKER-AUTH2-R4, Fase 1 de la fundación de cookies
por familia de actor, desplegada en TESTING desde R6) →
`a1579f1` (P2-T18-BLOCKER-AUTH2-R10, Fase 2 activación cliente —
**HEAD actual, también en `origin/testing-codex`**, desplegada en
TESTING desde R12). Fase 2 (11 paths, ver §13) fue implementada
localmente (R8), revisada adversarialmente con mutation testing (R9,
R9-R1), commiteada localmente (R10), recertificada independientemente
dos veces (R11, R12), pusheada y desplegada en TESTING (R12) — sólo
falta la certificación con navegador real (R13, no ejecutada).

---

## 10. P2-T11 FULL CONTEXT (native-socket revocation hardening — CLOSED)

Objetivo: que revocar la sesión de un actor (ban, logout forzado,
expiración) corte también su conexión de socket en tiempo real, no
sólo el acceso HTTP futuro. Implementado en 3 fases aditivas:
**Phase A** (`d0ba59d`) — validación de sesión en tiempo real vía un
endpoint interno nuevo; **Phase B** (`e8d2171`) — el chat-service
consulta ese endpoint y cierra el socket si la sesión ya no es válida;
**Phase C** (`f6ca24f`) — reducción del TTL de gracia a 120s y
aislamiento cross-tab same-browser certificado con navegador real
(Chromium vía CDP, dos pestañas del mismo origin/contexto): el logout
real dispara un evento nativo `storage` en la pestaña receptora en
15-20ms, la pestaña emisora nunca recibe su propio evento, y ningún
escenario adversarial (incluida una topología de actor revocado)
logró resucitar una sesión ni conectar un socket no autorizado.

Cerrado formalmente en Stage5G: `F-P2-T11-01=RESOLVED`, `P2-T11=CLOSED`.
Un único residual de severidad baja (evento de logout tardío bajo
timing patológico de navegador, nunca reproducido con las herramientas
de navegador disponibles — sin control CDP de lifecycle genuino)
quedó dispuesto como `ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION`
— evaluado contra un modelo de amenaza de 4 preguntas (resurrección de
sesión, reautorización de actor revocado, acceso no autorizado a
socket, escalación de privilegio — las 4 `NO`), con política de
reapertura explícita si en el futuro surge una herramienta con control
genuino de lifecycle o evidencia de un efecto de seguridad real. La
terminación forzada instantánea cross-instance permanece
deliberadamente fuera de este cierre — mandato explícito de una tarea
anterior (P2-T09), nunca absorbida ni implementada aquí.

`realtime-manager.ts` y `realtime-types.ts` son la superficie pública
que Fase 2 de AUTH2 debe NUNCA tocar (ver §12) — son el corazón de este
sistema ya cerrado y certificado; cualquier cambio ahí reabriría el
riesgo que P2-T11 cerró.

---

## 11. P2-T18 FULL CONTEXT (Chat Cross-Tab UI Polish — tarea activa)

Objetivo original (complejidad estimada 2/10 al congelarse en Stage1):
corregir dos defectos cosméticos de UI cross-tab del chat — F-P1-01
(unread stale) y F-P1-02 (typing auto-reflejado) — ver §6.

Cadena de stages: **Stage1** (baseline freeze, ambos findings
recuperados y re-confirmados `REPRODUCED`) → **Stage2** (implementación
local del fix, 1 archivo de producto: `chat-sheet.tsx`) → **Stage3**
(revisión adversarial precommit) → **Stage4** (commit exacto,
`1adcc01f`) → **Stage5** (revisión post-commit de blobs) → **Stage6**
(push + deploy TESTING, certificado) → **Stage7** (intento de
certificación con navegador real) — **aquí surgió el blocker**: al
intentar establecer una topología de 3 pestañas (Cliente X1+X2, Negocio
Y1) en un mismo navegador, se descubrió que un segundo login
sobrescribe la cookie de sesión del primero (mismo nombre de cookie
`deligo_session` para todos los actores) — este es exactamente
`F-P2-T18-AUTH01` (ver §6/§12), que pasó a bloquear el resto de Stage7
y de toda la tarea.

Stage7 también produjo un hallazgo separado y todavía sin resolver: un
runtime defect en la ruta de typing X→Y (Cliente tipea → Negocio no ve
la actualización, pese a que el servidor emite correctamente y el
frame llega íntegro al WebSocket del receptor) — investigación
detenida por instrucción explícita del usuario, sin causa raíz
determinada, sin ningún fix intentado. Esto es independiente del
blocker AUTH2 y sigue pendiente si se retoma la certificación completa
de F-P1-02.

Desde entonces, toda la actividad de la tarea (R1 hasta la R9 actual)
ha sido resolver el blocker AUTH2 — ver §12 para el diseño y §15 para
el estado exacto.

---

## 12. P2-T18 CURRENT AUTH DESIGN (F-P2-T18-AUTH01 — same-browser multi-actor session coexistence)

**Problema**: `SESSION_COOKIE_NAME="deligo_session"` es global para
cliente/negocio/repartidor/superadmin (`src/lib/auth.ts:224`) — un
segundo login sobrescribe la cookie del primero en el navegador (mismo
nombre, mismo `path="/"`), aunque la fila `Sesion` en DB del primer
actor sigue siendo 100% válida. No es una vulnerabilidad de seguridad
(ninguna sesión ajena se lee/filtra; el peor caso es un re-login) pero
bloquea tanto la certificación de F-P1-02 con un solo navegador como
el caso de uso legítimo de operar Cliente y Negocio a la vez en el
mismo navegador.

**Diseño elegido**: `OPTION_A_ACTOR_FAMILY_SCOPED_SESSION_COOKIES`, sin
cambio de schema. Dos fases:

### Fase 1 — servidor (DONE, desplegada en TESTING, commit `c047e9eb`)

Cookies de sesión con nombre scoped por familia de actor
(`deligo_session_cliente`/`_negocio`/`_repartidor`), resueltas por
`resolveActorSession()` en `src/proxy.ts`, y presentadas a los route
handlers SIN modificar bajo el nombre de cookie legacy vía reescritura
de headers sólo-en-request. Archivos tocados:
`src/proxy.ts`, `src/lib/auth.ts`,
`src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
— más 5 archivos de test. Certificado con 16/16 casos de seguridad
contra el backend real desplegado en TESTING (login individual
compatible, coexistencia simultánea de ambas cookies de familia,
aislamiento por path, selector conflictivo/malformado fail-closed,
header spoofeado sin autoridad, logout acotado por familia, transición
legacy sin fuga).

### Fase 2 — cliente (implementada por R8, certificada precommit por R9-R1, commiteada por R10, recertificada por R11, PUSHEADA Y DESPLEGADA EN TESTING por R12 — ver §15)

Activación del lado cliente: namespacing por familia en el
`localStorage` del store Zustand `persist`, un selector `?actorFamily=`
enviado por cada caller de los 4 endpoints compartidos
(`/api/auth/me`, `/api/auth/logout`, `/api/realtime/token`,
`/api/realtime/authorize`), y un listener cross-tab de logout
consciente de familia.

**Piezas clave**:

- **`activeSessionFamily(pathname)`** (en `src/store/auth-store.ts`,
  exportada) — única fuente de verdad, mapea `window.location.pathname`
  a `"cliente"|"negocio"|"repartidor"|null` usando
  `matchesFamilyPrefix(pathname, prefix)` =
  `pathname === prefix || pathname.startsWith(prefix + "/")` —
  deliberadamente el mismo patrón boundary-safe que `pathFamily()` del
  servidor. Nunca se deriva de storage ni de query strings; nunca se
  trata como autoridad de seguridad (el servidor siempre re-valida).
- **`familyScopedStorage()`/`familyScopedKey()`** — adapter `StateStorage`
  custom para `createJSONStorage`, remapea la clave fija `"deligo-auth"`
  a `deligo-auth:<family>` en cada `getItem`/`setItem`/`removeItem`,
  derivando la familia fresca (nunca cacheada) del pathname actual en
  cada llamada. Para pathnames sin familia (p.ej. `/admin`), cae al
  comportamiento legacy sin namespacing.
- **`withActorFamily(path, family)`** — helper local (duplicado con
  firmas ligeramente distintas en `use-auth.ts` y
  `realtime-client.ts`) que agrega `?actorFamily=<family>` a una URL
  sólo si la familia no es null — reutiliza exactamente el transporte
  ya certificado en Fase 1 (query param, nunca header).
- **Forma pública del store sin cambio**: `user: AuthUser | null`
  intacto — cada pestaña tiene memoria JS/Zustand independiente; sólo
  `localStorage` es compartido entre pestañas, por eso sólo la CLAVE
  necesitaba namespacing, nunca la forma en memoria. 26/26 consumidores
  directos confirmados sin necesidad de cambio.

**Allowlist congelado de Fase 2 (7 archivos de producto, exacto, re-verificado
independientemente en R7, R9 Y R10 — ahora los 7 forman parte del
commit local `a1579f11e79a41b90c6df4d2e8573ca9a669b856`)**:

```
src/store/auth-store.ts
src/providers/realtime-provider.tsx
src/hooks/use-auth.ts
src/lib/realtime-client.ts
src/hooks/use-suspension-check.ts
src/app/login/page.tsx
src/components/auth/auth-modal.tsx
```

`src/lib/realtime-manager.ts` y `src/lib/realtime-types.ts` fueron
descartados del allowlist en R7 (no requieren cambio —
`realtime-client.ts` corre en el navegador y deriva la familia por sí
mismo) y deben permanecer byte-idénticos — verificado 3 veces
(R8 antes/después, R9 independientemente) contra hash
`06c857ce8b4e46e2df37ad92174771046b6cdb26` /
`93dd06e7bbe328fdc3262ecbc02d53715e53631a`.

**4 archivos de test relacionados** (ver §8, §13 para hashes):
`src/store/auth-store.test.ts` (nuevo en R8, +2 tests de rehidratación
en R9-R1), `src/lib/realtime-client.test.ts` (nuevo, sin cambio desde
R8), `src/hooks/use-auth-static-contract.test.ts` (nuevo, sin cambio
desde R8), `src/providers/realtime-provider-cross-tab-static-contract.test.ts`
(assertion #2 modificada en R8, +1 test de guard exacto en R9-R1).

**R9 (revisión adversarial) + R9-R1 (cierre de gaps)**: R9 encontró,
vía mutation testing aislado (12 mutantes fuera del repo), que 2
sobrevivían — un `getItem` hardcodeado a la familia Cliente (sin
cobertura de rehidratación), y un listener cross-tab que aceptaría la
clave legacy plana `deligo-auth` (el contrato estático de P2-T11 sólo
probaba presencia del patrón correcto, no ausencia de un bypass OR).
Ambos eran gaps de TEST, no defectos de producto (verificado por
lectura directa dos veces). R9-R1 cerró ambos exclusivamente con
tests nuevos — 2 en `auth-store.test.ts` (rehidratación real vía
`useAuthStore.persist.rehydrate()`), 1 en el contrato estático cross-tab
(guard exacto) — sin tocar ningún archivo de producto. Replay completo:
12/12 mutantes detectados. 133/133 tests, 20/20 seguridad, 10/10
aceptación.

**R10 (commit local exacto)**: convirtió esos 11 paths, ya
certificados dos veces, en un único commit local
(`a1579f11e79a41b90c6df4d2e8573ca9a669b856`, parent `c047e9eb`, subject
`feat: enable actor-family client auth coexistence`) — corrida
decisiva de 133/133 tests, fingerprint 11/11 idéntico antes/después de
los gates, staging explícito de sólo esos 11 paths, commit recertificado
directamente desde los objetos Git (11/11 blobs commiteados idénticos
a los staged/certificados, working tree limpio contra HEAD). **NO
pusheado** — `AHEAD=1`/`BEHIND=0` contra `origin/testing-codex`
(`c047e9eb`, sin cambio).

**R11 (recertificación postcommit/prepush independiente)**: repitió
toda la verificación de R10 pero SIN confiar en su narrativa — re-derivó
el fileset y los 11 blob IDs directamente de `git diff-tree`/`git
ls-tree HEAD` (11/11 idénticos), leyó los 11 blobs completos vía `git
show HEAD:<path>`, re-clasificó el diff `HEAD^..HEAD` completo (19
hunks, 0 sin clasificar), re-ejecutó standalone la lógica de
boundary-safety copiada literalmente del blob committed (18 casos),
confirmó los 6 vecinos congelados sin diff entre `HEAD^`/`HEAD`, y
declaró aplicable la autoridad de mutation testing 12/12 de R9-R1 por
identidad exacta de bytes (sin repetir la campaña completa).
Reconstruyó 20/20 seguridad y 10/10 aceptación, corrió 133/133 tests
frescos (corrida decisiva única), y confirmó lint/TSC/`git show
--check`/build limpios. Fase 2 quedó
`PHASE2_POSTCOMMIT_CERTIFIED_READY_FOR_FRESH_TESTING_PREPUSH` —
técnicamente lista para push, pero R11 NO otorgó un push futuro ciego:
R12 repitió gates decisivos frescos inmediatamente antes del push
real.

**R12 (push exacto + autodeploy certificado)**: repitió en fresco toda
la revalidación decisiva (11/11 fileset/blobs, vecinos congelados sin
drift, 133/133 tests a la primera, 20/20 seguridad, 10/10 aceptación,
mutation authority 12/12 por identidad de blobs, lint/TSC/build
limpios), confirmó Railway inequívocamente en TESTING sin deploy
concurrente y con health prepush limpio, y ejecutó **exactamente un**
`git push origin testing-codex` (`c047e9eb..a1579f11`, sin `--force`)
— `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`. Observó únicamente
(sin `railway up`/redeploy manual) el autodeploy Git-triggered:
`DeliGO Copy` (deployment `78625067`) y `chat en vivo` (deployment
`1916b7af`) ambos `SUCCESS` con `commitHash=a1579f11` exacto
confirmado desde metadata real de Railway. Logs sin error, health
postdeploy limpio, y un smoke de regresión de Fase 1 server sin
navegador (7 casos: selector válido/desconocido/malformado siempre
fail-closed, sin fuga de `Set-Cookie`, sin fallback cruzado, sin 5xx)
confirmó `PHASE1_POSTDEPLOY_SERVER_REGRESSION=PASS`.
`PHASE2_DEPLOYED_FROM_EXACT_COMMIT=SI`;
`PHASE2_BROWSER_BEHAVIOR_CERTIFIED=NO` — resultado esperado, la
certificación real de navegador queda íntegramente para
`P2-T18-BLOCKER-AUTH2-R13`. Fase 2 queda
`PHASE2_DEPLOYED_TESTING_AWAITING_SAME_BROWSER_REAL_ACCEPTANCE`.

---

## 13. CURRENT WORKING TREE (Fase 2 commiteada, recertificada 3 veces, PUSHEADA Y DESPLEGADA EN TESTING, HEAD=ORIGIN=`a1579f1`)

```
$ git status -sb
## testing-codex...origin/testing-codex
?? 32                                                                   <- NUNCA TOCAR
?? CODEX_REPORT.md
?? codex-reports/**
?? DELIGO_FULL_CONTEXT_LATEST.md                                        <- este archivo, sin trackear a propósito
```

Los 11 paths de Fase 2 (7 producto + 4 test) ya NO aparecen como
dirty — quedaron commiteados en `a1579f11e79a41b90c6df4d2e8573ca9a669b856`
(parent `c047e9eb`), y ese commit ya está también en
`origin/testing-codex` (pusheado en R12) y desplegado en TESTING. El
working tree de source/test está completamente limpio contra HEAD.
Blobs exactos commiteados (`git ls-tree HEAD -- <path>`, idénticos a
los certificados en R9-R1/R9/R10/R11):

```
src/store/auth-store.ts                                              = 16c87112cca52b15112e1c7cdda04e83b83573b4
src/providers/realtime-provider.tsx                                  = 4d0b534da3ab21a9a2a70723bd1014e9664562ab
src/hooks/use-auth.ts                                                = 599702c40e3f25b8e2a74dbb4e3496cb7530ed8f
src/lib/realtime-client.ts                                           = ffdeed213e36adf26e2884b2b10a7400516c362f
src/hooks/use-suspension-check.ts                                    = c5501aefca71d395d20b7c08034021b95ba43061
src/app/login/page.tsx                                               = 4341ebcaa10fe86128cf22e650551a7f20e92b59
src/components/auth/auth-modal.tsx                                   = 3b46364f4c1f439b6db37da73e7e7822df59ba4a
src/hooks/use-auth-static-contract.test.ts                           = ff089771a07d30fd61b705fb8a0ca480dd4e304c
src/lib/realtime-client.test.ts                                      = 3e9d6abbf8fc25df02bf02e3d6f54c2eb54add0d
src/store/auth-store.test.ts                                         = 7aeb0f3903c04746714ca42c83dd189f9fca062a
src/providers/realtime-provider-cross-tab-static-contract.test.ts    = 7e62fe8ed87848e7db50ebae85c2e1a5ea68c246
```

`CODEX_REPORT.md` y `codex-reports/**` siguen sin trackear — son parte
del sistema de reportes de esta sesión, nunca se commitean al repo del
producto (son metadata de proceso, no código).

---

## 14. CURRENT FROZEN CONTRACTS

```
PHASE2_RECONCILED_PRODUCT_ALLOWLIST_COUNT=7 (ver §12, congelado en R7, re-verificado en R9, R9-R1, R10, R11 y R12)
PHASE2_RECONCILED_TEST_ALLOWLIST_COUNT=4 archivos físicos (5 obligaciones consolidadas)
REALTIME_MANAGER_PUBLIC_API_CHANGE_REQUIRED=NO
R12_PHASE2_SECURITY_MATRIX=20_OF_20_PASS
R12_LOCAL_ACCEPTANCE_MATRIX=10_OF_10_PASS
R12_MUTATION_AUTHORITY=12_OF_12_BY_CERTIFIED_BLOB_IDENTITY (0 sobrevivientes)
COMMIT_SUBJECT=feat: enable actor-family client auth coexistence
COMMIT_HASH=a1579f11e79a41b90c6df4d2e8573ca9a669b856
COMMIT_PARENT=c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
PUSHED=SI (R12, c047e9eb..a1579f11)
DEPLOYED_TESTING=SI (R12, DeliGO Copy deployment 78625067, chat en vivo deployment 1916b7af, ambos commitHash=a1579f11)
PHASE2_BROWSER_BEHAVIOR_CERTIFIED=PARTIAL (R13, 9/18 puntos de la matriz confirmados con navegador real — ver §15)
R13_AUTH01_ACCEPTANCE_MATRIX=9_OF_18_CONFIRMED_1_OF_18_CLEANUP_8_OF_18_NOT_REACHED
F_P2_T18_AUTH01_STATUS=OPEN_BLOCKED_BY_AUTH02_CERTIFICATION_DEPLOY_AND_FULL_R13_REPLAY
AUTH02_PRODUCT_ALLOWLIST_COUNT=7 (congelado en R13-R1, implementado en R13-R2, ver §11.1)
AUTH02_TEST_ALLOWLIST_COUNT=7 (implementado en R13-R2)
AUTH02_FOCAL_TEST_RESULT=117_OF_117_PASS
AUTH02_REGRESSION_RESULT=294_OF_294_PASS
```

El commit exacto de Fase 2 fue recertificado TRES VECES desde los
objetos Git (R10 dentro de su propia etapa, R11 de forma
independiente, R12 en fresco inmediatamente antes del push), pusheado
exactamente una vez y desplegado en TESTING — server (Fase 1) y
cliente (Fase 2) ahora coexisten en el mismo commit desplegado. R13
certificó con navegador real el núcleo de la coexistencia (cookies,
storage, reload, realtime-connection) — confirmado funcionando — pero
descubrió un defecto real DISTINTO (`F-P2-T18-AUTH02`, ver §11.1) que
bloquea el cierre 18/18 de la matriz. R13-R1 (read-only) reconcilió
causa raíz/callers/allowlist exactos para ese defecto; R13-R2 lo
**implementó localmente** (sin commit/push) exactamente como fue
congelado — ver §11.1 para el detalle. Ver `codex-reports/CURRENT_TASK.md`
(reporte de R13-R2) para el detalle completo.

---

## 11.1. F-P2-T18-AUTH02 (descubierto en R13, reconciliado en R13-R1, implementado en R13-R2, auditado adversarialmente en R13-R3, gap M9 cerrado en R13-R3-R1, recertificado desde cero en R13-R3-RETRY — segundo gap M19-NEW encontrado y cerrado en R13-R3-RETRY-R1 — recertificación final desde cero en R13-R3-RETRY-2 BLOQUEADA por fallo de regresión ajeno — fallo clasificado INCONCLUSIVE en R13-R3-RETRY-2-R1 — gate de regresión fresca BLOQUEADO por SEGUNDO fallo consecutivo en R13-R3-RETRY-2-R2 — disposición determinada en R13-R3-RETRY-2-R2-R1 — usuario acepta excepción acotada y AUTORIZA R13-R4 en R13-R3-RETRY-2-R2-R1A — COMMIT LOCAL EXACTO ejecutado en R13-R4 — RECERTIFICADO INDEPENDIENTEMENTE desde objetos Git en R13-R5 — PUSHEADO Y DESPLEGADO EN TESTING en R13-R6 — RESUELTO con navegador real 18/18 en R13-R7)

```
FINDING_ID=F-P2-T18-AUTH02
TITLE=Endpoints compartidos de Chat/Push devuelven 401 para AMBOS actores bajo coexistencia real de 2+ cookies de familia
STATUS=RESOLVED
SEVERITY=FUNCIONAL (no seguridad — fail-closed en el 100% de los casos)
ROOT_CAUSE=el rewrite de cookie legacy en src/proxy.ts es incondicional a AUTH_REQUIRED_PREFIXES (depende sólo de si resolved.token es truthy) — así que cualquier endpoint que lea la cookie legacy directamente sufre la ambigüedad de resolveActorSession() bajo 2+ candidatas, esté o no en esa lista.
AUTH02_ENDPOINT_COUNT=6 (no-leidos, conversaciones, mensajes/[pedidoId], subscribe, unsubscribe, status)
AUTH02_PRODUCT_ALLOWLIST=src/proxy.ts + src/components/chat/{chat-fab,chat-sheet,chat-view,share-target-flow}.tsx + src/hooks/use-push-notifications.ts + src/components/shared/permission-prompt.tsx (7 archivos, CERO route handlers — commiteado, pusheado y desplegado byte-idéntico en fe0e11d0)
AUTH02_TRUSTED_FAMILY_SOURCE=useAuthStore().user?.type para 9 de los 11 call sites (NO pathname — ChatFab/ChatSheet/ChatView/PermissionPrompt están montados en el ROOT layout, activos en cualquier ruta); share-target-flow.tsx (2 call sites) usa su prop role explícito
AUTH02_TEST_RESULT_R13_R2=7 archivos (4 modificados + 3 nuevos), 117/117 PASS focal, 294/294 PASS regresión
AUTH02_MUTATION_CAMPAIGN_R13_R3_RETRY_2=20 mutantes (19 originales + M19-NEW), 19/19 no-equivalentes detectados, M3 reconfirmado equivalente, 0 sobrevivientes válidos — preservada por identidad de blob hasta el deploy (nunca repetida)
AUTH02_R13_R3_RETRY_2_REGRESSION_BLOCKER=1 fallo decisivo en client-block-security.integration.test.ts (SEC-BLOCK-1, dispositivo compartido) — investigado, repetido, dispuesto y aceptado por el usuario como excepción acotada en la cadena R13-R3-RETRY-2-R1→R2-R1A
AUTH02_R13_R3_RETRY_2_R2_R1_DISPOSITION=EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY (confianza MEDIA, técnica, preservada histórica)
AUTH02_R13_R3_RETRY_2_R2_R1A_USER_DECISION=USER_DEDICATED_TEST_DATABASE_DECISION=DEFERRED — el usuario decidió continuar con la infraestructura de TESTING existente, aceptando la excepción TEMP_TESTING_INFRA_EXCEPTION_ID=EX-P2-T18-SEC-BLOCK-1-P2028 (sólo este caso exacto, no permanente, sin tocar el test en código)
AUTH02_DB_REGRESSION_CERTIFICATION=PASS_WITH_ONE_USER_ACCEPTED_TESTING_INFRA_EXCEPTION
AUTH02_DEFERRED_FINDING=F-P2-TESTINFRA-01 (DEFERRED_BY_USER, revisit P2-T10)
AUTH02_R13_R4_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f (parent a1579f11e79a41b90c6df4d2e8573ca9a669b856, subject "fix: scope shared auth requests by actor family")
AUTH02_R13_R5_INDEPENDENT_VERIFICATION=fileset por 2 métodos Git + 14 blob IDs vía git ls-tree HEAD — 14/14 idénticos; contrato de proxy/Chat/Push y M9/M19 confirmados leyendo los blobs directamente de HEAD; 0 tests ejecutados
AUTH02_R13_R6_PUSH_DEPLOY=push único a1579f1..fe0e11d (sin --force); DeliGO Copy SUCCESS (deployment 4e6618dc) y chat en vivo SUCCESS (deployment 43abe272), ambos en commit fe0e11d0 exacto confirmado desde metadata real de Railway; health/logs postdeploy limpios, 0 errores materiales
AUTH02_COMMIT_STATUS=SI (pusheado y desplegado en TESTING)
AUTH02_PUSHED=SI
AUTH02_DEPLOYED_TESTING=SI
R13_R7_AUTHORIZED=SI
R13_R7_ACCEPTANCE_MATRIX=18_OF_18_PASS
AUTH02_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
NEXT_ACTION=P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE
```

Detalle completo en `codex-reports/CURRENT_TASK.md` (reporte de
R13-R7) y `codex-reports/FINDINGS.md` (incluye `F-P2-TESTINFRA-01`, la
deuda diferida separada). **Pusheado y desplegado en TESTING** — el
commit `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f` (parent `a1579f11`,
subject `fix: scope shared auth requests by actor family`) ya no es
sólo un commit local: `origin/testing-codex` apunta exactamente a él
(`HEAD=ORIGIN=fe0e11d0`, `AHEAD=0`/`BEHIND=0`), y tanto "DeliGO Copy"
como "chat en vivo" lo sirven en producción de TESTING con estado
`SUCCESS` confirmado desde la metadata real de Railway — nunca
inferido del éxito del `git push`. Técnicamente AUTH02 está 100%
certificado en todas las dimensiones (0 gaps de cobertura, 0 mutantes
sobrevivientes válidos, matriz de seguridad 20/20, aceptación 12/12,
focal 117/117, TANDA_1 163/163 — preservado por identidad de bytes/
blob a través de SIETE etapas independientes) más una excepción de
infraestructura de TESTING estrechamente acotada, explícitamente
aprobada por el usuario, que NO modifica ningún byte de source/test.
R13-R3, el primer R13-R3-RETRY, R13-R3-RETRY-2, R13-R3-RETRY-2-R1,
R13-R3-RETRY-2-R2, R13-R3-RETRY-2-R2-R1A, R13-R4 y R13-R5 permanecen
históricos exactamente como se cerraron, sin reescribir.
`AUTH02_LOCAL_COMMIT_COMPLETE=SI`, `AUTH02_PUSHED=SI`,
`AUTH02_DEPLOYED_TESTING=SI`, `R13_R7_AUTHORIZED=SI`. `R13-R7`
(2026-08-29) ejecutó el replay completo de navegador real desde cero
(18/18, el resultado parcial histórico 9/18 de R13 no contó) con
Chrome real contra el commit desplegado — **18/18 PASS**, incluyendo
la recreación directa del síntoma de este finding (CASE_09: chat del
Pedido abierto en ambas tabs, `no-leidos`/`conversaciones`/`mensajes`/
`realtime-token`/`realtime-authorize` todos `200`, no reproducido).
`F-P2-T18-AUTH01` y `F-P2-T18-AUTH02` pasan a `RESOLVED`
(`AUTH01_RESOLVED_COMMIT=AUTH02_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`).
P2-T18 en sí NO se cierra — queda bloqueado únicamente por la
aceptación con navegador real de la UI de Chat restante (`F-P1-02`,
luego `F-P1-01`).

---

## 15. CURRENT NEXT TASK

```
NEXT_TASK_ID=PENDING_USER_DISPOSITION
NEXT_TASK_TITLE=(depende de la disposición elegida por el usuario)
NEXT_TASK_STATUS=AWAITING_USER_INPUT
SCOPE_ESPERADO=
  No definido — requiere disposición explícita del usuario entre: (A)
  investigar/corregir ahora el defecto de conexión del socket
  (`F-P2-T18-TYPING-CHANNEL-01`), en una etapa de implementación nueva;
  (B) diferir F-P1-02/el nuevo finding y avanzar a la aceptación de
  F-P1-01 de todos modos (aunque probablemente tropiece con el mismo
  defecto, al depender también de push en vivo); (C) diferir ambos
  ítems de aceptación residual y cerrar P2-T18 con un residual MEDIUM
  aceptado explícitamente.
PRECONDITION=P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1 PASS_DIAGNOSIS_GENUINE_TYPING_CHANNEL_DEFECT_ISOLATED
  (cumplida, 2026-08-29) — diagnóstico acotado (3 observaciones máximo)
  aisló el primer tramo roto: Observation 1 (harness externo,
  socket.io-client real, dos actores reales) confirmó el chat-service
  100% sano en ambas direcciones; Observation 2 (Browser 2 real, espera
  deliberada de 5s antes de escribir) descartó timing/room-grant;
  Observation 3 (observador temporal de solo lectura de WebSocket,
  excepción puntual del prompt) confirmó, corroborado por
  `read_network_requests`, que el navegador nunca intenta conectar al
  chat-service pese a que `/realtime/token`+`/realtime/authorize`
  devuelven `200`. `FIRST_BROKEN_HOP=HOP_B`,
  `R1_CLASSIFICATION=SENDER_CLIENT_EGRESS_DEFECT`, nuevo finding
  `F-P2-T18-TYPING-CHANNEL-01` (no es el guard de auto-eco de F-P1-02
  en sí). Ningún fix intentado; cleanup DB+navegador+harness+observador
  completo, 0 residuales; Git final sin cambio,
  `HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`,
  `AHEAD=0`/`BEHIND=0`, índice vacío.
```

Con `R13-R7` (replay 18/18 fresco) en PASS: `F-P2-T18-AUTH01` y
`F-P2-T18-AUTH02` pasaron a `RESOLVED`. El intento de certificar
`F-P1-02` con navegador real
(`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE`, 2026-08-29) quedó
`BLOCKED_REAL_BROWSER_TYPING_CONTROL_INVALID`; el diagnóstico
subsiguiente (`...-R1`, 2026-08-29) aisló la causa en un defecto
DISTINTO (`F-P2-T18-TYPING-CHANNEL-01`, el navegador nunca conecta al
chat-service). `P2-T18` sigue bloqueada exactamente igual que antes de
esos dos intentos (`F-P1-02` seguido de `F-P1-01`) — el único cambio
es que ahora se sabe DÓNDE se rompe, no sólo que estaba roto. Por
política explícita de velocidad del usuario, no se define
automáticamente una etapa de implementación — se requiere su
disposición. **Sólo cuando F-P1-02 y F-P1-01 certifiquen** comienza la
prioridad post-P2-T18 del usuario: primero la auditoría de
sincronización Producción-vs-`testing-codex` (comparando
`https://github.com/LeoCampos2504/DeliGO` contra
`https://github.com/LeoCampos2504/DeliGO/tree/testing-codex`) y su
sincronización aprobada en etapas controladas — antes de que negocios
reales carguen catálogos de producto —, luego `P2-T06`, luego el gate
de dependencia inmediato de `P2-T14`. Ninguna de estas etapas
posteriores está definida en detalle todavía. La deuda diferida
`F-P2-TESTINFRA-01` (DB de TESTING dedicada) queda para
`P2-T10`/trabajo futuro de infraestructura, sin relación con este
cierre.

---

## 16. COLD-HANDOFF SELF-CHECK (validación obligatoria de esta etapa)

1. ¿Repo? → `C:\Leo Campos\Trabajo\deligo-main-limpio`. ✓ §1
2. ¿Rama? → `testing-codex`. ✓ §1
3. ¿HEAD actual? → `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, IDÉNTICO a `origin/testing-codex` (`AHEAD=0`/`BEHIND=0`) — pusheado en R13-R6 (`a1579f1..fe0e11d`) y desplegado con `SUCCESS` en TESTING (DeliGO Copy + chat en vivo, commit exacto confirmado desde metadata real de Railway); R13-R7 no generó ningún commit/push/deploy nuevo, sólo confirmó el mismo estado. ✓ §1/§9
4. ¿Tarea actual? → `P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R2`. ✓ §1
5. ¿Estado actual? → `FAIL_NEW_LIVE_PUSH_DEFECT_ISOLATED` (reintento de la matriz de 6 casos de typing con topología real X1/X2/Y1, tras confirmarse en R1-R1 que el canal de conexión SÍ funciona; 0/6 casos mostró indicador de typing en ninguna dirección, con rate-limiting/expiración de grant/latencia de render/identidad de actor/política de scopes descartados metódicamente uno por uno; prueba decisiva — un mensaje de chat NUEVO enviado desde Y1 mientras X1 ya tenía el hilo montado y a la vista nunca apareció en vivo, sólo los mensajes de baseline vistos tras reabrir el hilo — aísla el defecto al **push servidor→cliente en general** (`new-message` Y `user-typing`, no sólo typing), no a la conexión ni a la autorización (ambas confirmadas correctas); nuevo finding `F-P2-T18-LIVE-PUSH-01` (`OPEN_ROOT_CAUSE_NOT_INVESTIGATED`, severidad MEDIUM_TO_HIGH, causa raíz deliberadamente no investigada más allá del aislamiento — fuera de alcance de una etapa de aceptación); `F_P1_02_CURRENT_STATUS=BLOCKED_BY_LIVE_PUSH_DEFECT`; posible misma causa raíz que F-P1-01, no confirmado; cero mutación de producto, cleanup DB+navegador+scratchpad completo). ✓ §1/§11.1/§15
6. ¿Qué es P2-T18? → Chat Cross-Tab UI Polish, bloqueada por F-P2-T18-AUTH01 desde Stage7. ✓ §11
7. ¿Estado de Fase 1? → DONE, commiteada (`c047e9eb`), pusheada y desplegada en TESTING, certificada 16/16 runtime, y su núcleo re-confirmado con navegador real en R13. ✓ §12
8. ¿Estado de Fase 2? → Implementada (R8), revisada adversarialmente con mutation testing (R9 BLOCK, R9-R1 cierre de gaps), commiteada (R10), recertificada independientemente dos veces (R11, R12), pusheada y desplegada en TESTING (R12, `a1579f1`), certificada PARCIALMENTE con navegador real en R13 (9/18 — núcleo funcionando, defecto distinto aislado como F-P2-T18-AUTH02), ese defecto reconciliado, implementado, auditado adversarialmente (BLOCK por gaps M9/M19-NEW, ambos cerrados), recertificado desde cero dos veces, bloqueado por un fallo de regresión ajeno de infraestructura de TESTING (investigado, repetido, dispuesto), aceptado por el usuario como excepción acotada y AUTORIZANDO R13-R4, commiteado localmente (`fe0e11d0`), recertificado independientemente en R13-R5, PUSHEADO Y DESPLEGADO en TESTING en R13-R6, y ahora CERTIFICADA COMPLETA con navegador real en R13-R7 (18/18 fresco). `F_P2_T18_AUTH01_STATUS=RESOLVED`, `F_P2_T18_AUTH02_STATUS=RESOLVED`. ✓ §12/§15
9. ¿Los 11 paths de Fase 2 (commit `a1579f11`)? → Siguen sin dirty por sí mismos — commiteados, pusheados, re-verificado en R10/R11/R12/R13/R13-R1 sin cambio. **El working tree de AUTH02 ya NO tiene cambios** — los 14 paths (7 producto + 7 test) que estuvieron en el working tree desde R10 son ahora el commit `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f` (parent `a1579f11`), pusheado y desplegado, confirmado byte-idéntico al estado certificado en cada etapa previa incluyendo R13-R6 (sólo 2 test paths cambiaron en total desde R10 — M9 en R13-R3-R1, M19-NEW en R13-R3-RETRY-R1 —, ambos exactamente como autorizado). Blobs de `a1579f11` (Fase 2 R10) exactos en §13; blobs de `fe0e11d0` (AUTH02) verificados 14/14 en R13-R4 y de forma independiente en R13-R5, ahora servidos en TESTING.
10. ¿Por qué `realtime-manager.ts` no debe cambiar? → Ya certificado y cerrado por P2-T11; Fase 2 lo descartó del allowlist en R7 porque `realtime-client.ts` puede derivar la familia por sí mismo sin tocarlo — permanece byte-idéntico también dentro del commit desplegado, re-verificado sin diff entre `HEAD^` y `HEAD` en R11 y R12, y por fingerprint SHA-256 en cada etapa de AUTH02 hasta el commit desplegado `fe0e11d0`; su lógica de demand-gating (`acquireOrderRoom`/`hasGlobalRealtimeDemand`) fue la causa de que R13 necesitara ampliar el fixture con un Pedido real, no un defecto. AUTH02 tampoco lo toca. ✓ §10/§12
11. ¿Estado de P2-T11? → `CLOSED`, con 1 residual LOW `ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION`. ✓ §10
12. ¿Próxima tarea? → `PENDING_USER_DISPOSITION` (nuevo finding `F-P2-T18-LIVE-PUSH-01` — el push servidor→cliente no llega en el navegador real, bloqueando F-P1-02; se requiere que el usuario elija entre investigar/corregir ahora, diferir y avanzar a otra prioridad post-T18, o diferir y cerrar P2-T18 con residual aceptado — mismo patrón de disposición A/B/C que R1), alcance en §15. ✓
13. ¿Acciones prohibidas permanentes? → Ver §2 (idioma, archivo `32`, WOULD_NEW_FACT rule, stop-on-objective, archive-before-overwrite — **el commit `fe0e11d0` sólo incluyó exactamente los 14 paths de AUTH02, nunca reportes/root 32, re-confirmado en R13-R5 y R13-R6** —, el único push de esta cadena ya se ejecutó en R13-R6 (`a1579f1..fe0e11d`, sin `--force`) — cualquier push adicional futuro requiere nueva autorización explícita, fixtures TESTING only, byte-frozen neighbors, presupuesto diagnóstico fijo reafirmado en R13-R3-RETRY-2-R1, presupuesto de certificación fijo reafirmado en R13-R3-RETRY-2-R2/R13-R6 (máximo una corrida por gate, sin retry-to-green), no fix durante revisión/diagnóstico/certificación/disposición/reconciliación/commit/recertificación/push-deploy —**reafirmado en cada una de esas etapas: el test SEC-BLOCK-1 nunca fue corregido en código (sigue byte-idéntico dentro del commit desplegado, sin `.skip`, sin cambiar `expect(...).toBe(201)`), ninguna etapa histórica fue reescrita de BLOCKED a PASS**—, la excepción `EX-P2-T18-SEC-BLOCK-1-P2028` es estrechamente acotada (`GLOBAL_FLAKE_POLICY_WEAKENED=NO`), allowlist de AUTH02 (7 producto + 7 test) ya desplegado exacto, no ampliable sin nueva reconciliación explícita, LEGACY_FULL_REPORT inmutable, nunca `railway up`/deploy manual/`railway variables`/provisionar infraestructura sin autorización explícita del usuario, Production nunca tocada, prioridad post-P2-T18 del usuario (auditoría de sincronización Producción-vs-testing-codex PRIMERO, luego P2-T06, luego P2-T14 si dependency-safe) registrada pero NO iniciada — ninguna renumeración de posiciones del roadmap sin auditar dependencias primero). ✓

`COLD_HANDOFF_VALIDATION=PASS_13_OF_13_ANSWERABLE`

## Corrección de autoridad — BUSINESS-HOURS-TIMEZONE-PRODUCTION-PROMOTION-R1

La nota histórica anterior que indicaba Production no tocada queda supersedida por la promoción certificada del 2026-08-30: `origin/main` y `origin/testing-codex` están en `a178140ef5167dce1b596edeb58e17cc7029beaf`; Production DB está en `28/28/0`, con `Negocio.timezone` y horarios sin reescritura. No se autoriza lanzamiento público. Ver `codex-reports/BUSINESS_HOURS_TIMEZONE_PRODUCTION_PROMOTION_R1.md`.

## Cross-chat handoff — P2-T18 realtime diagnosis correction

HISTORICAL_CONCLUSION: `P2_T18=PAUSED_NOT_CLOSED_EXTERNAL_INFRA_DEPENDENCY` y `F_P2_T18_LIVE_PUSH_01_STATUS=PAUSED_EXTERNAL_INFRA_DEPENDENCY` se preservan como historia; PRODUCT-DUPLICATION-R1 no implementó P2-T18.

NEW_RUNTIME_COUNTEREVIDENCE: durante pruebas manuales reales, Negocio móvil con chat abierto sí recibió `new-message` y `user-typing` desde Cliente móvil. Cliente móvil, Negocio desktop y Cliente desktop no observaron realtime en los casos aportados; fuera del chat tampoco se observó entrega.

CURRENT_PROVISIONAL_CLASSIFICATION: `P2_T18=PAUSED_PENDING_REALTIME_ACTOR_DEVICE_MATRIX_REDIAGNOSIS`; `F_P2_T18_LIVE_PUSH_01_CURRENT_PROVISIONAL_STATUS=REOPEN_DIAGNOSIS_ACTOR_DEVICE_DEPENDENT_COUNTEREXAMPLE_FOUND`; `P2_T18_GLOBAL_RAILWAY_SERVER_TO_CLIENT_BLOCK_HYPOTHESIS=INVALIDATED_BY_COUNTEREXAMPLE`; `RAILWAY_GLOBAL_ROOT_CAUSE_CONFIRMED=NO`; `RAILWAY_GLOBAL_TRANSPORT_BLOCK_ASSUMPTION_ALLOWED=NO`.

NEXT_ACTION: `P2-T18-REALTIME-ACTOR-DEVICE-MATRIX-R1`, futura matriz Cliente/Negocio × móvil/desktop con ChatView mounted/unmounted, token/authorize/scopes, room lease, listeners/relay/subscribers y foreground/background. `P2_T18_OUTSIDE_CHAT_REALTIME_STATUS=NEEDS_CONTRACT_AUDIT_NOT_YET_CLASSIFIED_AS_BUG`. No investigar Railway primero.

P2-T46-R1 current state: implementation approved and locally built on `work/p2-t46-r1`; additive occupation-payment authority, strict occupation isolation and close guards are ready for Testing-only deployment. Manual operator certification remains pending.

## P2-T46 final certified state — 2026-09-11

P2-T46 (Table Account + Ticket + History Canonical Detail) está
`CLOSED_TESTING_CERTIFIED` y `P2_T46_RELEASE_ELIGIBLE=SI`. El operador certificó
R1 y R2 físicamente sobre `c3da04ef84dbd183956e78691a3b3da0f5dc2f68` (R1 7/7,
R2 5/5). Testing avanzó a `c826e796d33de5d00f8efddf4fa258fb86587c6` con un
único commit documental; no implica que ese SHA haya sido probado físicamente.
Production no fue tocada. Siguiente acción: `P2_T46_PRODUCTION_PROMOTION_EVALUATION`.

## P2-T46 Production checkpoint — 2026-09-11

T46 está cerrado en Production con el release curado
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, migración aplicada y checkpoint
`p2-t46-stable-2026-09-11`. La certificación física sigue anclada al runtime
`c3da04ef`; la descendencia documental `c826e79` no se presentó como runtime
probado. No se promovieron T02 ni el resto de Testing. El lanzamiento público
continúa sin autorización. Próxima prioridad recomendada, no iniciada:
`P2-T32` — Client Address UX Unification + Profile Deep-Link.

## P2-T23-R1 — estado vigente — 2026-09-13

T23 implementó interpolación client-side únicamente sobre el marker de
tracking. Testing ejecuta el commit
`2f4c8d1d8392668dfd3f89602b1e06a2297519bc` en el deployment
`6da4b52c-8886-4d52-b31a-ba2e0ba21311` (`SUCCESS/RUNNING`). El estado es
`P2_T23_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION`; aún no es un
closeout físico ni una autorización de Production. T02 conserva
`CLOSED_TESTING_CERTIFIED`/`RELEASE_ELIGIBLE=SI`; T54 conserva
`FUTURE_AFTER_T02_T23_T24`; la siguiente acción es la certificación física de
T23 R1.
