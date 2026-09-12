# CURRENT TEST AUTHORITY — POST-P2-T46-R1 (2026-09-11)

Esta cabecera es la autoridad vigente; los bloques históricos inferiores se
conservan sólo para trazabilidad.

```text
CURRENT_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
CURRENT_T46_STABLE_TAG=p2-t46-stable-2026-09-11
CURRENT_T46_STABLE_TAG_PEELED_COMMIT=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
P2_T46_STATUS=CLOSED_PRODUCTION
P2_T46_OPERATOR_CERTIFICATION=PASS
P2_T46_R1_PHYSICAL=7_OF_7_PASS
P2_T46_R2_PHYSICAL=5_OF_5_PASS
P2_T46_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T02_STATUS=WAITING_FOR_REMAINING_EXTERIOR_AND_COMPLETION_PHYSICAL_EVIDENCE
P2_T02_B4_IOS_STATUS=PASS
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
TEST_T02_ORDER_LEFT_ACTIVE=SI
P2_T02_R4_STATUS=PHYSICALLY_CERTIFIED_NORMAL_FLOW
T23_NAVIGATION_FOLLOW_SCOPE=PARTIAL
T24_NAVIGATION_MAP_MATCHING_SCOPE=CONFIRMED_RELATED
DRIVER_NAVIGATION_UX_TASK_ID=P2-T54
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_REFRESH_FIX_INCLUDED=NO
LEGACY_NULL_OCCUPATION_INFERENCE=NO
LEGACY_NULL_OCCUPATION_BACKFILL=NO
LEGACY_ACCOUNTING_RECONSTRUCTION=NO
FUNCTIONAL_TREE_CHANGED=NO
```

No se ejecutaron tests nuevos en esta reconciliación; no se convierte el
smoke de Production en una certificación funcional adicional.

## P2-T02-R5 — normal flow physical recertification authority (2026-09-12)

La autoridad de esta entrada es la evidencia física reportada por el operador
para el flujo normal R4. El runtime certificado es el deploy de Testing del
commit `b0112d53c0b8e0cf8db1868ccf6f666070b39b39`; no se ejecutó una nueva suite
porque R5 es documentation-only y no hubo cambio funcional.

```text
R4_COMMIT=b0112d53c0b8e0cf8db1868ccf6f666070b39b39
R4_TESTING_DEPLOYMENT_ID=97b0923a-5d9d-4bca-b23e-3465dc358817
R4_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
R4_TESTING_DEPLOYMENT_COMMIT_MATCH=YES
R4_NORMAL_DRIVER_ACCOUNT_USED=SI
R4_NORMAL_ORDER_FLOW_USED=SI
R4_FIXTURE_ACCOUNT_USED=NO
R4_NORMAL_ACCEPT_FLOW=PASS
R4_DRIVER_GPS_NOW_WORKS=PASS
R4_IN_APP_NAVIGATION_OPENS=PASS
R4_IN_APP_ROUTE_RENDERED=PASS
R4_FIXTURE_PARITY_FINDING=RESOLVED_FOR_NORMAL_ACCEPT_FLOW
P2_T02_R4_STATUS=PHYSICALLY_CERTIFIED_NORMAL_FLOW
P2_T02_STATUS=WAITING_FOR_REMAINING_EXTERIOR_AND_COMPLETION_PHYSICAL_EVIDENCE
PRODUCT_FILES_CHANGED=0
TEST_FILES_CHANGED=0
FUNCTIONAL_TREE_CHANGED=NO
```

La certificación no declara PASS para Android, movimiento exterior,
background con movimiento significativo, finalización ni cero eventos después
de finalizar. Esos gates continúan pendientes según los reportes históricos
T02/B3/B4.

# HISTORICAL TEST AUTHORITY — P2-T46 audit stop gate (2026-09-10)

```text
P2_T46_STATUS=STOPPED_AUDIT_GATE_WAITING_FOR_APPROVAL
T46_ARCHITECTURE_AUDIT_COMPLETE=SI
T46_CODE_CHANGED=NO
T46_TESTS_RUN=NO_AUDIT_ONLY
T46_DEPLOYED=NO
SCHEMA_CHANGE_REQUIRED=SI_FOR_ACCOUNT_PAYMENT_AUTHORITY
HISTORICAL_ORDER_OCCUPATION_BACKFILL=AMBIGUOUS
T41_AUTHORITY_PRESERVED=SI
TERMINAL_SALON_CLOSE_ACCOUNT=DENY
CLIENT_ACCOUNT_MUTATIONS=DENY
```

No se abrió una autoridad de certificación para T46 porque la tarea se detuvo
antes de implementación. Cualquier futura matriz debe cubrir la nueva
autoridad de pago de cuenta, aislamiento A/B, late delivery, historial y la
matriz T41 antes de Testing.

# TEST AUTHORITY — DeliGO

## P2-T48-R2 — promoción curada exacta a Production (2026-09-10)

```text
BASELINE_TESTING_SHA=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
BASELINE_MAIN_SHA=46a1d55634e8bd848e160302cdb64a32be241c89
SOURCE_T48_SHA=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
T48_PARENT=fb3e584259cb2c57605c783543c7fdb1dc845454
T48_FILESET=4
T48_PRODUCT_FILES=2
T48_TEST_FILES=2
T48_DOC_FILES=0
T48_SCHEMA_FILES=0
T48_MIGRATION_FILES=0
T48_DEPENDS_ON_T02=NO
T48_DEPENDS_ON_OTHER_NON_MAIN_COMMITS=NO
T48_CAN_CHERRY_PICK_DIRECTLY=SI
PROMOTION_STRATEGY=DIRECT_CHERRY_PICK
T02_FILES_IN_RELEASE_DIFF=0
T02_HUNKS_IN_RELEASE_DIFF=0
UNAUTHORIZED_POST_T48_DIFF=0
FINAL_RELEASE_DIFF_MATCHES_T48_APPROVED_SCOPE=SI
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATION=NO
DB_BACKFILL_REQUIRED=NO
FOCAL_TEST_PASS=13
FOCAL_TEST_FAIL=0
REGRESSION_TEST_PASS=51
REGRESSION_TEST_FAIL=0
NEW_FAIL=0
TYPECHECK_BASELINE=31
TYPECHECK_RELEASE=31
NEW_TYPECHECK_ERRORS=0
ESLINT_NEW_FINDINGS=0
DIFF_CHECK_PASS=SI
BUILD_PASS=SI
SERVER_SIDE_AUTHORITY_PRESERVED=SI
RELEASE_BRANCH=release/p2-t48-curated
RELEASE_BASE_SHA=46a1d55634e8bd848e160302cdb64a32be241c89
RELEASE_T48_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
PRE_PROMOTION_MAIN_SHA=46a1d55634e8bd848e160302cdb64a32be241c89
ROLLBACK_REFERENCE=p2-t42-stable-2026-09-10
MAIN_PROMOTION_PERFORMED=SI
MAIN_NEW_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
MAIN_PUSH_RESULT=FAST_FORWARD_NO_FORCE
PRODUCTION_DEPLOYMENT_ID=96ef5efc-4678-40cd-9a96-966c839201f1
PRODUCTION_DEPLOYMENT_STATUS=SUCCESS
PRODUCTION_DEPLOYMENT_BRANCH=main
PRODUCTION_DEPLOYMENT_COMMIT=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
PRODUCTION_DEPLOYMENT_COMMIT_MATCH=SI
PRODUCTION_INSTANCE=RUNNING
PRODUCTION_LOGS_CLEAN=SI
PRODUCTION_PENDING_MIGRATIONS=0
PRODUCTION_FATAL_ERRORS=0
PRODUCTION_HTTP_SMOKE=PASS_READ_ONLY
POST_PROMOTION_MINIMAL_SMOKE_REQUIRED=NO
POST_T48_STABLE_TAG=p2-t48-stable-2026-09-10
POST_T48_STABLE_TAG_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
P2_T48_OPERATOR_CERTIFICATION=PASS
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T46
PRODUCTION_TOUCHED=SI (sólo promoción exacta T48)
PUBLIC_RELEASE_AUTHORIZED=NO
```

La promoción usó sólo los cuatro paths T48 sobre `origin/main`; el parent
`fb3e584` contiene T02 en otros paths, que quedaron fuera del release. Los
findings físicos nuevos de T48-R1 permanecen abiertos y sin implementación.

## P2-T48-R1 — cierre de certificación física y nuevos findings (2026-09-10)

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
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_REFRESH_ROOT_CAUSE=UNKNOWN_PENDING_AUDIT
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION=CONFIRMED_PHYSICAL
OLD_ORDERS_COUNTED_IN_NEW_CURRENT_ACCOUNT=NO_OBSERVED
OLD_ORDERS_PRESERVED_IN_NEGOCIO_HISTORY=SI_OBSERVED
DATA_LOSS_OBSERVED=NO
ACCOUNTING_OF_OLD_ORDER_AGAINST_ORIGINAL_OCCUPATION=NOT_YET_VERIFIED
PREVIOUS_OCCUPATION_OPEN_ORDERS_PROVISIONAL_TARGET=P2-T46
TARGET_CONFIRMATION_REQUIRED_DURING_T46_AUDIT=SI
ORDER_OCCUPATION_AUTHORITY=UNKNOWN_PENDING_T46_AUDIT
CLOSE_OCCUPATION_WITH_OPEN_ORDERS_GUARD=REQUIRED_FOR_FUTURE_DESIGN_REVIEW
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DATABASE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
RAILWAY_MUTATION=NO
PRODUCTION_TOUCHED=NO
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
```

La autoridad de esta entrada es la certificación física comunicada por el
operador contra el deployment Testing exacto de T48. Los dos findings nuevos
son observaciones abiertas; no constituyen evidencia de una regresión en la
autoridad canónica de T48.

## P2-T48 — Salon Personal occupation state parity (2026-09-10)

```text
P2_T48_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_WAITING_OPERATOR
BASELINE_TESTING_SHA=fb3e584259cb2c57605c783543c7fdb1dc845454
BASELINE_MAIN_SHA=46a1d55634e8bd848e160302cdb64a32be241c89
FOCAL_TEST_PASS=13
FOCAL_TEST_FAIL=0
REGRESSION_TEST_PASS=51
REGRESSION_TEST_FAIL=0
NEW_FAIL=0
TYPECHECK_BASELINE=31_EFFECTIVE_33_RAW_WITH_2_STALE_NEXT_TYPES_REFS
TYPECHECK_AFTER=31
NEW_TYPECHECK_ERRORS=0
ESLINT_NEW_FINDINGS=0
DIFF_CHECK=PASS
BUILD=PASS
SERVER_SIDE_AUTHORITY_PRESERVED=SI
T48_PRISMA_SCHEMA_CHANGED=NO
T48_NEW_MIGRATION=NO
T48_DB_BACKFILL_REQUIRED=NO
TESTING_COMMIT=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
TESTING_DEPLOYMENT_ID=d5497cb8-34a0-4835-b2f8-4c117c23a325
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_COMMIT_MATCH=SI
TESTING_INSTANCE=RUNNING
TESTING_LOGS_CLEAN=SI
TESTING_PENDING_MIGRATIONS=0
TESTING_HTTP_SMOKE=PASS_READ_ONLY
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

La prueba focal cubre refresh de `MesaOccupancyControl`, independencia de la
presencia de pedidos y guard de 403. La integración cubre ocupación activa con
pedido, ocupación activa sin pedidos, histórico cerrado, pointer actual,
pointer inconsistente, cross-business, mozo en mesa ajena, PyR y aislamiento
de panel personal. La regresión adicional fue 51/51 en lifecycle, Negocio/Salón,
Terminal y sesiones operativas.

## P2-T42-R1 — formal closeout + Production exact-scope promotion (2026-09-10)

```text
T42_SOURCE_COMMIT=eb2af3a598bf4e91ccd48b06092fb892a7ac0f9b
T42_RELEASE_COMMIT=46a1d55634e8bd848e160302cdb64a32be241c89
T42_APPROVED_SCOPE_HASH=547e5281113088fc147d631ed172b61d83228cb3
FINAL_RELEASE_DIFF_MATCHES_T42_APPROVED_SCOPE=SI
T02_FILES_IN_PRODUCTION_DIFF=0
FOCAL_AND_REGRESSION_TEST_PASS=134
FOCAL_AND_REGRESSION_TEST_FAIL=0
NEW_FAIL=0
TYPECHECK_BASELINE=31_EFFECTIVE_33_RAW_WITH_2_STALE_NEXT_TYPES_REFS
TYPECHECK_RELEASE=31
NEW_TYPECHECK_ERRORS=0
ESLINT_NEW_FINDINGS=0
DIFF_CHECK=PASS
BUILD=PASS
SERVER_SIDE_AUTHORITY_PRESERVED=SI
PRODUCTION_DEPLOYMENT_ID=08a9bc74-67df-4935-adb6-7de8e1a30c91
PRODUCTION_DEPLOYMENT_STATUS=SUCCESS
PRODUCTION_DEPLOYMENT_COMMIT_MATCH=SI
PRODUCTION_INSTANCE=RUNNING
PRODUCTION_LOGS_CLEAN=SI
PRODUCTION_PENDING_MIGRATIONS=0
PRODUCTION_HTTP_SMOKE=PASS_READ_ONLY
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T42_OPERATOR_REVIEW=TODO_PASS
```

La corrida combinada inicial tuvo un `P2025` transitorio de fixture; el
rerun aislado y el rerun completo del archivo afectado pasaron. No se
observó una falla nueva de T42. El test de Production fue sólo lectura:
redirect raíz, página PyR y rechazo 401 sin sesión del panel API.

## P2-T02-B4-R3-R1 — iOS physical pass closeout (2026-09-10)

```text
R3_CERTIFIED_COMMIT=fb3e584259cb2c57605c783543c7fdb1dc845454
R3_RAILWAY_EXACT_DEPLOY=SUCCESS
R3_RAILWAY_COMMIT_MATCH=SI
R3_RAILWAY_INSTANCE=RUNNING
R3_RAILWAY_LOGS=CLEAN
IOS_ROUTE_INITIAL=PASS
IOS_GOOGLE_MAPS_OPEN=PASS
IOS_ROUTE_RECOVERY_ON_RETURN=PASS
IOS_ROUTE_RECOVERY_WITHOUT_PWA_RESTART=PASS
IOS_NAVIGATION_CLOSE_REOPEN=PASS
P2_T02_B4_IOS_STATUS=PASS
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
P2_T02_B4_CROSS_PLATFORM_STATUS=IOS_CERTIFIED_ANDROID_PHYSICAL_PENDING
P2_T02_IOS_INDOOR_STATUS=PASS_FOR_TESTED_SCENARIOS
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
```

La autoridad del cierre es el reporte físico explícito del operador sobre el
commit exacto de R3. Los datos B3 de background/lock permanecen sin cambios:
background `37→40`, 3 updates, 62.30 s, `THROTTLED`; lock `41→45`, 5
updates, máximo observado 29.65 s y gap final 90.64 s no atribuible;
unlock first rev 46, latencia `UNKNOWN`, recovery foreground PASS.

## P2-T02-B4-R3 — route recovery local gate (2026-09-10)

```text
R3_BASELINE_TESTING=0c362895656d389de73fd0dd94a124fe3aac8dd1
R3_PRODUCT_FILES=3
R3_TEST_FILES=2
R3_FOCAL_TEST_PASS=29
R3_FOCAL_TEST_FAIL=0
R3_FOCAL_TESTS_INCLUDE=helper_success_error_abort_timeout+foreground_recovery+retry+stale_response+real_unmount+OSRM_endpoint
R3_ESLINT_FOCAL=PASS_0_ERRORS
R3_DIFF_CHECK=PASS
R3_BUILD=PASS
TYPECHECK_RAW=31
NEW_TYPECHECK_ERRORS=0
R3_TESTING_DEPLOY=SUCCESS_EXACT_COMMIT_CONFIRMED
R3_TESTING_DEPLOYMENT_ID=b54f0214-69a0-4e93-8589-fc2f37054301
R3_TESTING_COMMIT=fb3e584259cb2c57605c783543c7fdb1dc845454
R3_HTTP_SMOKE=200
R3_PHYSICAL_IOS_RETEST=WAITING_FOR_OPERATOR
PRODUCTION_TOUCHED=NO
```

La autoridad física sigue separada de la autoridad local: ningún test estático
o unitario cierra el finding de retorno desde Google Maps. El retest requiere
el build exacto de R3 en `DeliGO Copy`/`TESTING` y se mantiene pendiente.

## P2-T02-B4-R2 — deploy exacto confirmado antes del gate físico (2026-09-10)

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
B4_TESTING_DEPLOY_CONFIRMED=SI
B4_TESTING_LOGS=CLEAN
B4_HTTP_SMOKE=200
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE (secondary only)
PRODUCTION_TOUCHED=NO
```

La consulta `railway status --json` se filtró exclusivamente a `DeliGO Copy`
en `TESTING`; no se alteró el environment ni se ejecutó redeploy.

## P2-T02-B4-R1 — verificación reproducible de software (2026-09-10)

```text
COMMIT_UNDER_TEST=0c362895656d389de73fd0dd94a124fe3aac8dd1
TYPECHECK_COMMAND=bunx tsc --noEmit --pretty false
TYPECHECK_RAW=31
NEW_TYPECHECK_ERRORS=0 (errores fuera de los archivos B4)
B4_FOCAL_TEST_COMMAND=bun test --run src/hooks/use-screen-wake-lock.test.ts src/lib/delivery-navigation-static-contract.test.ts src/lib/delivery-navigation.test.ts src/components/repartidor/deliveries-tab.test.tsx
B4_FOCAL_TEST_PASS=18
B4_FOCAL_TEST_FAIL=0
B4_TESTING_DEPLOY_CONFIRMED=NO
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE
PRODUCT_OR_TEST_CHANGES_IN_R1=NO
```

La confirmación del commit en Railway no fue observable porque el dashboard
requiere login; el smoke público `/repartidor` devolvió 200, pero los bundles
muestreados no permitieron distinguir la navegación B4. No se usa esta
respuesta como evidencia de deploy exacto ni se abre el gate físico.

## P2-T02-B3-PWA-BEST-EFFORT-BACKGROUND-DELIVERY-TRACKING — 2026-09-10 (262 pass/0 fail combinados, OPTION-V2 retirado, deuda estática MODEL-G1 resuelta)

```text
FOCAL_TEST_PASS=262 (use-repartidor-tracking.test.ts 90 [9 reescritas contra el nuevo comportamiento + 4 nuevas B01-B04] + tracking-freshness.test.ts 64 [11 nuevas, describe "Tracking Stale-Location Honesty"] + tracking-movement.test.ts 25 sin cambios + repartidor-tracking-static-contract.test.ts 12 [reescrito completo, MODEL-E1/B3] + tracking-consumer-static-contract.test.ts 18 [1 aserción sobre-amplia corregida] + delivery-tracking-map-stale-contract.test.ts 7 nuevo + repartidor/ubicacion route.test.ts 22 + pedidos/[id]/tracking route.test.ts 12 + deliveries-tab.test.tsx 6 + repartidor-post-login-navigation.test.ts 3 [T02-B1 focal] + negocio-post-login-navigation.test.ts 3 [patrón de referencia])
FOCAL_TEST_FAIL=0
NEW_FAIL=0
LEGACY_TRACKING_STATIC_TEST_DEBT_RESOLVED=SI (repartidor-tracking-static-contract.test.ts tenía 4 FAIL documentados desde P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R1.md por referenciar símbolos MODEL-G1 retirados [const sendLocation, const tick, setInterval(tick,5000)] — reescrito contra el contrato MODEL-E1/B3 actual, 0 asserts borrados, cada uno reemplazado por una verificación del comportamiento real)
TRACKING_CONSUMER_ASSERTION_CORRECTED=tracking-consumer-static-contract.test.ts's "not.toContain('Date.now()')" era más amplio de lo que su propio nombre declaraba (protegía la autoridad de versión específicamente, no prohibía cualquier lectura de reloj en el archivo) — P2-T02-B3 introdujo un Date.now() legítimo para isTrackingLocationStale (concern de UX, no de versión); corregido a verificar precisamente que applyTrackingServerVersion/canUntrustedTrackingSourceOverridePosition nunca reciban un argumento de timestamp — invariante real intacto
FULL_SUITE_CROSS_CHECK=bun test src/ (excluyendo *.integration.test.ts) corrido completo — 187 fallas preexistentes, TODAS DB-dependientes (login-throttle, session-atomicity, mesa/salon terminal, download routes, evidence storage) sin relación con tracking/repartidor, salvo la única corregida arriba
TYPECHECK_RAW=31 (idéntico baseline) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI (0 nuevos en los 11 archivos) / DIFF_CHECK_PASS=SI
```

## P2-T35-T36-PROMOTION-TO-MAIN-AND-PRODUCTION — 2026-09-10 (recontado fresco sobre el source exacto a promover: 46 focales T36 + 36 regresión push/SW/PWA + 242 T35, 0 fallas nuevas)

```text
T36_FOCAL_PASS=46 (pwa-role-icon-contract.test.ts 12 + sw-push-role-icon-routing.test.ts 28 + sw-icon-cache-bypass-static-contract.test.ts 6 — 12+28+6=46, recontado con bun test directo antes de promover)
T36_FOCAL_FAIL=0
PUSH_SW_REGRESSION_PASS=36 (pwa-canonical-scope, pwa-identity, featured-stores-pwa-scope-static-contract, sw-push-dedupe, sw-notificationclick-target-routing, ios-pwa-debug-launch-static-contract — 6 archivos vecinos, SIN solapar con los 3 focales de T36)
PUSH_SW_REGRESSION_FAIL=0
TOTAL_COMBINADO_T36=82 (46+36, coincide con el total histórico registrado en la certificación original de T36 — la cifra "47" focal de esa certificación fue un conteo manual impreciso, corregido aquí con el conteo real y reproducible)
T35_REGRESSION_PASS=242 (batería completa de 16 archivos iOS/PWA de P2-T35, re-ejecutada íntegra sobre el source exacto a promover — 0 fallas)
T35_REGRESSION_FAIL=0
TYPECHECK_RAW=24 (idéntico baseline) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
```

## P2-T36-PWA-BRANDING-HYGIENE — 2026-09-09 (47 tests focales + 82 regresión push/SW/PWA + 242 T35, 0 fallas nuevas)

```text
FOCAL_TEST_PASS=47 (pwa-role-icon-contract.test.ts 12 [4 preexistentes + 4 maskable safe-zone geométrico + 1 sanity + 3 badge nuevos] + sw-push-role-icon-routing.test.ts 28 [preexistentes con 5 aserciones de badge realineadas + 2 nuevos] + sw-icon-cache-bypass-static-contract.test.ts 6 nuevo) — CORREGIDO en la entrada de arriba (P2-T35-T36-PROMOTION): el conteo real reproducible es 46 (12+28+6), "47" fue un error de suma manual, nunca una falla real ni un test perdido
FOCAL_TEST_FAIL=0
REGRESSION_PUSH_SW_PWA_PASS=82 (pwa-canonical-scope, pwa-identity, featured-stores-pwa-scope-static-contract, sw-push-dedupe, sw-notificationclick-target-routing, ios-pwa-debug-launch-static-contract + los 3 focales de arriba) — la cifra combinada de 82 sigue siendo correcta (46+36)
REGRESSION_PUSH_SW_PWA_FAIL=0
T35_REGRESSION_PASS=242 (batería completa de 16 archivos iOS/PWA de P2-T35, re-ejecutada íntegra tras el cambio de sw.js — 0 fallas)
T35_REGRESSION_FAIL=0
TYPECHECK_RAW=24 (idéntico baseline) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
```

**Técnica de verificación geométrica (no sólo visual) para safe-zone
maskable**: `pwa-role-icon-contract.test.ts` usa `sharp` (ya dependencia
del proyecto, sin agregar ninguna nueva) para medir, contra el PNG real,
el radio máximo del contenido visual desde el centro (detectando dónde
el color deja de coincidir con el fondo muestreado en la esquina) y
compararlo contra el círculo de seguridad real de Android (radio = 40%
del ancho total). Incluye un test de sanity que corre el MISMO helper
contra el asset ORIGINAL (sin derivar) y confirma que falla el
criterio — prueba que el test principal no pasa trivialmente. **Cuidado
con la normalización de la fracción**: el helper devuelve
`radio/(ancho/2)` (fracción del MEDIO-ancho), así que el límite de
comparación correcto es `0.8`, no `0.4` — confundir ambas normalizaciones
produjo un falso fallo durante el desarrollo de este mismo test (0.4 es
el límite como fracción del ancho TOTAL).

**Técnica de verificación de SW real (no reimplementación)**:
`sw-icon-cache-bypass-static-contract.test.ts` carga `public/sw.js`
REAL en un sandbox `vm` (misma técnica que `sw-push-dedupe.test.ts` /
`sw-push-role-icon-routing.test.ts`) y dispara eventos `fetch`
sintéticos con un mock de `caches` que siempre "hit" (simula un ícono
viejo ya cacheado) y un mock de `fetch` que siempre resuelve — así se
observa directamente si el código real enruta por cache-first o
network-first para una URL dada, sin asumir nada por lectura de texto.
Requiere inyectar `URL`/`Response` en el contexto `vm` (no están
disponibles por defecto en un contexto aislado) — un test que sólo
dispara eventos `push` (como los 2 archivos previos) nunca lo necesitó
porque nunca ejercita la rama `fetch`.

## P2-T35-IOS-PWA-STATIC-CONTRACT-HYGIENE — 2026-09-09 (6 fallas estáticas preexistentes resueltas, test-only, 0 cambio de producto)

```text
BASELINE=16 archivos reales (ios/pwa/standalone/viewport/keyboard/dock/safe-area/nav-occlusion) → 236 pass / 6 fail (EXPECTED_HISTORICAL_FAILURE_COUNT=5, BASELINE_DRIFT=SI, documentado sin forzar el número)
FIX_RESULT=242 pass / 0 fail, mismos 16 archivos
FIX_CLASS=TEST_ONLY_CONTRACT_REALIGNMENT — 0 archivos de producto, 3 archivos de test
TYPECHECK_RAW=24 (idéntico baseline) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
```

**Lección de test hygiene (CRLF, aplicable a cualquier static-contract
regex-based futuro)**: 5 de las 6 fallas eran causadas por
`core.autocrlf=true` en este checkout — `ios-keyboard-fix.tsx` e
`ios-viewport-debug-panel.tsx` tienen terminadores `\r\n` reales en
disco, y varios regex de
`ios-standalone-degraded-viewport-dock-fallback-r8-static-contract.test.ts`
/`ios-standalone-post-keyboard-nav-occlusion-r6-static-contract.test.ts`
anclaban un salto de línea LITERAL (`\n`) inmediatamente después de una
llave de cierre, o usaban un presupuesto de caracteres fijo (`{0,1200}`)
sin margen para el byte `\r` extra por línea — ambos patrones se rompen
en un checkout CRLF sin que el código real haya cambiado. Fix: normalizar
la fuente leída a LF (`readFileSync(...).replace(/\r\n/g, "\n")`) una
vez, inmediatamente después de `readFileSync`, en vez de reescribir cada
regex individualmente. Verificado ANTES de editar (sanity-check
obligatorio) con un script Node desechable que corrió cada regex real
contra el string crudo (falla) y el mismo string normalizado (pasa) —
prueba que el fix distingue el estado roto del corregido sin debilitar
el invariante. La 6ta falla no era CRLF: era una ruta de archivo
obsoleta tras la extracción legítima de P2-T32 (mapa+GPS de Perfil movido
de `client-profile-panel.tsx` a `address-map-picker.tsx`) — ningún test
static-contract fue actualizado para seguir ese movimiento en su
momento. Ver `P2_T35_IOS_PWA_STATIC_CONTRACT_HYGIENE.md` para el detalle
completo.

## P2-T32-CLIENT-ADDRESS-UX-UNIFICATION-AND-PROFILE-DEEPLINK — 2026-09-09 (autoridad compartida de dirección: 26 tests focales nuevos + 42 de regresión, 0 fallas)

```text
FOCAL_TEST_PASS=26 (address-form.test.tsx: 8 render real happy-dom+react-dom/client — validación, payload POST/PUT exacto, modo edición, double-submit guard, error de servidor, cancelar; client-address-unification-static-contract.test.ts: 18 contrato estático — autoridad única, sin duplicación de fetch/geolocalización, paridad de campos, deep-link, autoselect)
FOCAL_TEST_FAIL=0
REGRESSION_TEST_PASS=42 (client-profile-panel-push-static-contract 18 + product-gallery-public-preview-static-contract 9 + mesa-checkout-transition 10 + cliente-catalog-navigation 5, todos archivos reales que leen los 2 archivos de producto modificados)
REGRESSION_TEST_FAIL=0
TYPECHECK_RAW=24 (idéntico baseline) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
```

`src/app/api/cliente/direcciones/route.ts` no tiene ningún test dedicado
preexistente (confirmado, sin resultados) — no modificado en esta tarea,
no se creó uno nuevo por estar fuera del alcance explícito (el endpoint
no cambió).

**Lección de test hygiene (self-caught, documentada para futuras
tareas)**: al renderizar un componente con múltiples `<button>` y un mock
que también renderiza uno, `host.querySelector("button")` devuelve el
PRIMERO en orden del DOM, no necesariamente el que se quiere accionar —
localizar siempre por texto/rol, nunca por posición. Además, un input
controlado de React no se actualiza asignando `.value` directamente y
disparando `"input"` — hace falta el setter nativo de
`HTMLInputElement.prototype` (React trackea el valor previo en una
propiedad oculta del nodo DOM). Ver
`codex-reports/DECISIONS_AND_INVARIANTS.md` para el registro formal de
ambos patrones.

## P2-T30-SUPERADMIN-AUTH-TEST-FIXTURE-HYGIENE — 2026-09-09 (superadmin-auth.test.ts reescrito: fixtures aislados, 48 pass + 4 skip explícito + 0 fail, repetible 3x)

```text
SUPERADMIN_AUTH_TEST_PASS=48
SUPERADMIN_AUTH_TEST_SKIP=4 (explícito, documentado — ver reporte §11; nunca silencioso, nunca forzado borrando datos reales)
SUPERADMIN_AUTH_TEST_FAIL=0
REPEATABILITY=SI (3 corridas consecutivas idénticas: 48/4/0 las 3 veces)
SUPERADMIN_NEIGHBOR_REGRESSION_PASS=77 (7 archivos: superadmin-identity, superadmin-google-oauth, superadmin-store, p2-t06-superadmin-hardening.integration, review-moderation-superadmin.integration, review-moderation-superadmin, superadmin-notifications.integration)
SUPERADMIN_NEIGHBOR_REGRESSION_FAIL=0
TYPECHECK_RAW=24 (idéntico baseline) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
```

Reemplazado el `deleteMany({})` sin scope (crasheaba contra 3 filas
SuperAdmin reales vinculadas en la DB compartida de TESTING, 2
referenciadas por FK `Restrict`) por fixtures con id/sub/email únicos
por corrida y cleanup exclusivamente por esos ids. 4 tests cuyo éxito
depende de que la tabla completa no tenga NINGUNA identidad vinculada
(regla de negocio real, no un bug) se marcan con `skipIf` explícito
cuando la DB compartida tiene hoy una identidad ajena — su cobertura se
preserva de forma permanente vía tests puros de la función de decisión
(`resolverIdentidadSuperadminGoogle`), inmunes al estado de la DB. Ver
`codex-reports/P2_T30_SUPERADMIN_AUTH_TEST_FIXTURE_HYGIENE.md`.

## P2-T29D-T29E-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-09 (batería focal de promoción — 163 tests, 0 fallas — release de main/Production)

```text
PROMOTION_TEST_PASS=163 (121 puro+mock-db: order-transitions 45 + client-timeline-t29b-r1 13 + available-query 4 + push unit 59 = 121 / 42 DB real: order-transition-t29b-flow + new-delivery-notification-boundary + aceptar-waiting-driver-cas [incluye concurrencia real 2 repartidores] + auto-cancel-waiting-driver + client-cancel-accepted)
PROMOTION_TEST_FAIL=0
PROMOTION_NEW_FAIL=0
RC_TYPECHECK_RAW=24 (idéntico al baseline) / NEW_TYPECHECK_ERRORS=0 / RC_BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
```

Batería construida en 2 grupos desde el inicio (pura+mock-db /
integración DB real), aplicando directamente la lección de
contaminación de `mock.module("@/lib/db")` descubierta en la tarea
T29E inmediatamente anterior — sin fallos de infraestructura ni
falsos negativos en esta corrida. Ver
`codex-reports/P2_T29D_T29E_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29E-AND-T29-FINAL-PHYSICAL-CERTIFICATION-CLOSEOUT — 2026-09-09 (certificación física final del epic completa, automática + física — cierre en TESTING)

```text
P2_T29_FINAL_AUTOMATED_TEST_PASS=218
P2_T29_FINAL_AUTOMATED_TEST_FAIL=0
P2_T29_FINAL_PHYSICAL_CERTIFICATION=PASS
DOMICILIO_FINAL=PASS
RETIRO_FINAL=PASS
MESA_FINAL=PASS
TWO_DRIVER_FINAL=PASS
NOTIFICATION_DUPLICATION_FINAL=PASS
```

Certificación puramente documental — no se reejecutó la batería de 218
tests (sin cambio trackeado que lo justifique); estos 218 son los
mismos ya producidos y verificados en la tarea T29E automática
inmediatamente anterior, ahora confirmados con evidencia física real
sobre el mismo commit `a5109b0`. Ver
`codex-reports/P2_T29E_AND_T29_FINAL_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## P2-T29E-FINAL-COMPATIBILITY-REGRESSION-AND-PHYSICAL-CERTIFICATION — 2026-09-09 (batería final del epic, alcance ampliado a Operaciones/PyR/Salón + security P2-T25/T08 — 218 tests reales, 0 fallas nuevas)

```text
FINAL_T29_TEST_PASS=218 (122 puros sin DB [order-transitions 45 + client-timeline-t29b-r1 13 + safe-render 5 + push unit 59, sin cambios respecto a T29D] + 24 unitarios mock-db [available-query 4 + repartidor-pedidos-route 8 + order-transitions-authority pyr+salon 12, primera vez incluidos explícitamente en la batería T29] + 72 integración DB real [33 históricos: client-cancel-accepted + cas-concurrency + cas-mesa + aceptar-waiting-driver-cas + auto-cancel-waiting-driver + new-delivery-notification-boundary — más 39 nuevos: order-rate-limit-buckets.integration + pedidos/route, suite P2-T25/T08 de seguridad, incluida por instrucción explícita de la tarea "si razonablemente relacionado"])
FINAL_T29_TEST_FAIL=0
NEW_FAIL=0
TYPECHECK_RAW=24 (idéntico al baseline) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI (fileset T29 completo) / DIFF_CHECK_PASS=SI
```

**Hallazgo de proceso (no de producto)**: 4 de los archivos de la
batería (`available-query-waiting-driver.test.ts`,
`order-transitions-authority.test.ts` ×2 pyr/salon,
`repartidor/pedidos/route.test.ts`) usan `mock.module("@/lib/db", ...)`
para aislar sus tests. Ese mock es global al proceso `bun test` y
contamina cualquier archivo posterior en la MISMA invocación que
necesite el `db` real. Un primer intento de correr toda la batería en
un solo comando produjo 20 fallos falsos (`db.negocio.findMany is not
a function`) en los archivos de integración real — corregido
separando la batería en 2 grupos por naturaleza de DB (mock vs. real).
Documentado para que futuras tareas no repitan la combinación.

**Infra flaky reproducido y descartado (recurrencia de
F-P2-TESTINFRA-01)**: `order-rate-limit-buckets.integration.test.ts`
(P2-T25, ajeno al diff de T29) falló 1 vez con `PrismaClientKnownRequestError
P2028` durante una ventana de carga sostenida del grupo de integración
real. Reproducido en aislamiento total: 14/14 PASS. Batería completa
del grupo reejecutada: 72/72 PASS. Ver
`codex-reports/FINDINGS.md#F-P2-TESTINFRA-01` (sección de recurrencia
2026-09-09).

Ver `codex-reports/P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION.md`.

## P2-T29D-RESIDUAL-CLIENT-NOTIFICATIONS-TIMELINE-AUDIT-AND-IMPLEMENTATION — 2026-09-09 (5 tests nuevos para el único residual real + 167 reverificados, 0 fallas nuevas)

```text
T29D_ACCEPTED_NOTIFICATION_PASS=5 (order-transition-t29b-flow.test.ts: domicilio 1 notificación [test existente actualizado] + retiro 1 notificación + mesa 0 + CAS-loser 0/double-tap 1 + legacy 0)
T29D_TEST_FAIL=0
PURE_REGRESSION_PASS=134 (order-transitions 45 + client-timeline-t29b-r1 13 + safe-render 5 [corregido, ver §2 del reporte T29D] + available-query 4 + repartidor-pedidos-route 8 + push unit 59)
DB_REGRESSION_PASS=33 (client-cancel-accepted + cas-concurrency + cas-mesa + aceptar-waiting-driver-cas + auto-cancel-waiting-driver + new-delivery-notification-boundary)
NEW_FAIL=0
TYPECHECK_RAW=24 (idéntico al baseline, ninguno en los 3 archivos tocados) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
```

**Corrección de conteo aplicada en esta tarea**: el subtotal de
`order-status-t29b-safe-render.test.ts` estaba transcrito como 8 desde
el reporte de T29B-R1 (real: 5, confirmado por conteo directo y
ejecución) — corregido en este documento (2 ocurrencias), en el reporte
de T29B-R1, en el de T29C y en el de la promoción. El total de 134
siempre fue correcto porque se midió ejecutando la batería completa.

**Infra flaky observado y descartado**: una corrida de
`order-transition-t29b-flow.test.ts` tuvo 1 fallo no-determinístico
("Negocio puede cancelar un pedido domicilio/retiro en aceptado",
colisión de email por `randomUUID().slice(0,2)` de baja entropía en un
test PRE-EXISTENTE sin relación con el fileset de esta tarea) —
reejecutado el archivo completo una segunda vez: 18/18 PASS, 0 fail,
confirmando no-determinismo.

Ver `codex-reports/P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md`.

## P2-T29B-T29C-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-09 (batería focal reverificada sobre el release tree — 181 tests, 0 fallas nuevas, 1 fallo no-determinístico reproducido y descartado)

```text
PROMOTION_TEST_PASS=181 (134 puros: order-transitions 45 + client-timeline-t29b-r1 13 + safe-render 5 + available-query 4 + repartidor-pedidos-route 8 + push unit 59 = 134, corregido P2-T29D 2026-09-09 — ver P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md §3; 47 DB tras protocolo de flaky)
PROMOTION_TEST_FLAKY_REPRODUCED=1 (order-transition-cas-concurrency.test.ts, PrismaClientKnownRequestError P2002 en Cliente.email — archivo NO tocado por el diff de promoción, reproducido en aislamiento 6/6 PASS, batería completa reejecutada 47/47 PASS)
PROMOTION_NEW_FAIL=0
RC_BUILD_PASS=SI / TYPECHECK_RAW=24 (idéntico al baseline documentado desde T29B, mismos 14 archivos preexistentes) / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI
```

**Protocolo de infra flaky aplicado exactamente como exige la tarea**:
ante el único fallo observado, se confirmó primero que el archivo no
formaba parte del diff de 22 archivos que se estaba promoviendo (`git
diff --name-status origin/main origin/testing-codex -- <archivo>`
vacío), luego se reprodujo en aislamiento contra el mismo commit exacto
(6/6 PASS) y finalmente se reejecutó la batería completa de 7 archivos
DB una segunda vez (47/47 PASS, el mismo test que había fallado pasó
limpio) — confirmando definitivamente que era una colisión de fixture
por concurrencia (mismo patrón de baja entropía que `F-PRE-T29-03`), no
una regresión determinística introducida por el bloque promovido.

Ver `codex-reports/P2_T29B_T29C_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29C-REPARTIDOR-WAITING-DRIVER-ACCEPTANCE-AND-CONCURRENCY — 2026-09-09 (cierra el GAP CRÍTICO de concurrencia real de la auditoría P2-T29 original, ~90 tests nuevos/extendidos + 142 reverificados, 0 fallas nuevas)

```text
ORDER_TRANSITIONS_AUTHORITY_PASS=45 (order-transitions.test.ts, +7 nuevos de isAvailableForDriverAcceptance)
AVAILABLE_QUERY_PASS=4 (available-query-waiting-driver.test.ts, NUEVO — captura el `where` real de findMany)
ACCEPT_CAS_PASS=12 (aceptar-waiting-driver-cas.test.ts, NUEVO — canónico, legacy, 6 rechazos explícitos, 2 tests de CONCURRENCIA REAL con Promise.all contra DB de TESTING, 1 cancel-vs-accept race)
AUTO_CANCEL_PASS=4 (auto-cancel-waiting-driver.test.ts, NUEVO — canónico, legacy, reciente no cancela, ya-asignado no cancela)
NEW_DELIVERY_NOTIFICATION_BOUNDARY_PASS=4 (new-delivery-notification-boundary.test.ts, NUEVO — canónico, repartidor inactivo excluido, legacy preservado, sin duplicación)
REPARTIDOR_PEDIDOS_ROUTE_PASS=8 (route.test.ts P2-T01, sin cambios, reverificado — el mock no inspecciona `where`, sin riesgo de regresión oculta gracias a available-query-waiting-driver.test.ts)
T29B_FLOW_REGRESSION_PASS=27 (order-transition-t29b-flow 14 + cas-concurrency+cas-mesa+client-cancel-accepted 13, sin cambios de comportamiento)
OPERACIONES_REGRESION_PASS=12 (pyr+salon order-transitions-authority, sin cambios de comportamiento)
CLIENT_TIMELINE_T29B_R1_PASS=13 / SAFE_RENDER_T29B_PASS=5 (corregido P2-T29D, era 8 por error de transcripción) / PUSH_UNIT_PASS=59 (sin cambios, reverificados)
NEW_FAIL=0
TYPECHECK_RAW=24 (idéntico al baseline, ninguno en los 10 archivos tocados) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI (focal, 10 archivos) / DIFF_CHECK_PASS=SI
```

**El gap cerrado**: la auditoría original de P2-T29
(`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`
§17) documentó explícitamente que "la aceptación atómica del
repartidor… no tiene NINGÚN test de concurrencia real que lo demuestre".
Esta tarea lo cierra con 2 tests de integración real: dos repartidores
(fixtures reales, sesiones reales) compitiendo por el MISMO pedido vía
`Promise.all` contra la base de TESTING — uno para el camino canónico
(`esperando_repartidor`), otro para el legacy (`en_camino`+null). Ambos
prueban 1 winner (200) + 1 loser (409), exactamente un `repartidorId`
final (nunca ambos, nunca null), y exactamente 1 `PedidoEvento`.

Un tercer patrón de concurrencia (cancelación de Negocio vs aceptación
de Repartidor, no cubierto por la auditoría original) también se prueba
con `Promise.all` real: el resultado final siempre es coherente, nunca
un estado híbrido.

**No se realizó verificación visual en navegador** en esta tarea (a
diferencia de T29B) — la evidencia de concurrencia real contra Postgres
se consideró más fuerte que un click manual de dos pestañas para el
riesgo específico de esta tarea. `PHYSICAL_TEST_REQUIRED=SI` y
`TWO_DRIVER_PHYSICAL_CERTIFICATION_REQUIRED=SI` — pendientes, sin
cambios de criterio; esta batería automatizada NO los sustituye. Ver
`codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md`.

## P2-T29B-R1-CLIENT-TIMELINE-CONTINUITY-WAITING-DRIVER-NOTIFICATION — 2026-09-09 (142 tests, fix focal de timeline Cliente + notificación dedicada, 0 fallas nuevas)

```text
CLIENT_TIMELINE_PURE_PASS=13 (client-timeline-t29b-r1.test.ts, NUEVO — mapping/labels de domicilio+retiro, dinámico primer nodo, legacy sin apagar, retiro sin "Buscando delivery")
CLIENT_SAFE_RENDER_PASS=8 (order-status-t29b-safe-render.test.ts, sin cambios, reverificado)
AUTHORITY_PASS=35 (order-transitions.test.ts, sin cambios, reverificado)
PUSH_UNIT_PASS=59 (push.test.ts — nueva factory waitingDriverNotification no rompe nada existente)
T29B_FLOW_INTEGRATION_PASS=14 (order-transition-t29b-flow.test.ts, DB real TESTING — incluye 3 tests NUEVOS de notificación: dedicado single-winner, aceptado=0, retiro=0)
CAS_CONCURRENCY_REGRESION_PASS=13 (order-transition-cas-concurrency.test.ts + order-transition-cas-mesa.test.ts + client-cancel-accepted.test.ts, DB real TESTING, sin cambios de comportamiento)
NEW_FAIL=0
TYPECHECK_RAW=24 (idéntico al baseline documentado en P2-T29B, mismos 14 archivos preexistentes) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI (focal, 5 archivos) / DIFF_CHECK_PASS=SI
```

Corrección focal descubierta en la certificación física de P2-T29B:
mapping explícito estado→índice reemplaza el `findIndex` que apagaba la
timeline en `aceptado`/`esperando_repartidor`; notificación dedicada
"Buscando delivery" agregada para `preparando -> esperando_repartidor`
real de domicilio, con single-winner reverificado bajo concurrencia
real. **No se realizó verificación visual en navegador con clicks
reales** en esta tarea (a diferencia de T29B) — la cobertura de tests
puros exhaustiva por estado (incluyendo saltos legacy) se consideró
suficiente para un fix acotado de mapping, dado que el gate
determinante sigue siendo la certificación física del operador.
`PHYSICAL_TEST_REQUIRED=SI` — pendiente, sin cambios de criterio. Ver
`codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md`.

## P2-T29B-NEGOCIO-ACCEPTED-PREPARING-WAITING-DRIVER-FLOW — 2026-09-09 (93 tests, flujo Negocio nuevo + verificación visual en vivo, 0 fallas nuevas)

```text
AUTHORITY_PASS=38 (order-transitions.test.ts, incluye 8 tests nuevos del rollout graph de Negocio)
NEGOCIO_API_PASS=11 (regresión T28/T29A, sin cambios)
DOMICILIO_FLOW_PASS=6 / RETIRO_FLOW_PASS=3 / MESA_FLOW_PASS=2 (order-transition-t29b-flow.test.ts)
CAS_CONCURRENCY_PASS=2 (recibido→aceptado, preparando→esperando_repartidor — single winner, 1 PedidoEvento cada una)
CLIENT_CANCEL_ACCEPTED_PASS=4 / NEGOCIO_CANCEL_ACCEPTED_PASS=1
CLIENT_SAFE_RENDER_PASS=5 (order-status-t29b-safe-render.test.ts)
ORDER_SECURITY_PASS=14 / OPERACIONES_PYR_REGRESION_PASS=6 / SALON_REGRESION_PASS=6 (todos regresión, sin relación con T29B)
NEW_FAIL=0
TYPECHECK_RAW=24 (idéntico al baseline) / NEW_TYPECHECK_ERRORS=0 / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
```

**Verificación adicional, más allá de tests automatizados**: se levantó
la app localmente (puerto separado, sin interferir con procesos del
operador), se creó un Negocio sintético + 3 pedidos directamente en la
base de TESTING, y se ejecutó el flujo domicilio y retiro completos con
CLICKS REALES sobre la UI renderizada (login real, botones reales,
confirmación de cada badge/label en cada paso) — evidencia más fuerte
que sólo lectura de código o tests de API. Fixtures, `.env.local` y
scripts temporales, todos borrados/nunca commiteados al finalizar.

Ver `codex-reports/P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW.md`
para el detalle completo. `PHYSICAL_TEST_REQUIRED=SI` — esta batería
automatizada + la verificación visual local NO sustituyen la
certificación física en dispositivo real que la tarea exige antes de
cerrar T29B (mismo criterio ya aplicado en P2-T31).

## P2-T29A-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-09 (batería focal reverificada sobre el release tree — 81 tests, 0 fallas nuevas, mismo resultado que la certificación TESTING original)

```text
PROMOTION_TEST_PASS=79 (30 authority + 23 CAS negocio/pyr/salon + 14 order-security + 12 de los 14 de cancelación)
PROMOTION_PREEXISTING_FAIL=2 (mesa-pedido-cancelacion.test.ts, "23-A1" — reproducido IDÉNTICO, mismo test, mismo error exacto "a beforeEach/afterEach hook timed out", corriendo tanto en el worktree de release como directamente contra testing-codex@4b199540 sin modificar — doble confirmación de que es preexistente)
PROMOTION_NEW_FAIL=0
RC_BUILD_PASS=SI / TYPECHECK_RAW=25 en worktree fresh-install (24 en checkout normal — mismo artefacto de entorno de scripts/migrate-sqlite-to-postgres.ts, ya documentado 2 veces) / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI
```

No se repitió la batería masiva de PRE-T29 (1177 tests) — se usó
deliberadamente sólo la batería focal de T29A, proporcional al tamaño
pequeño del bloque promovido, consistente con la nueva
`RELEASE_CADENCE_POLICY`. Ver
`codex-reports/P2_T29A_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29A-ORDER-TRANSITION-AUTHORITY-CAS-AND-CONCURRENCY-TESTS — 2026-09-09 (79 tests, autoridad de transición + CAS de concurrencia real, 0 fallas nuevas)

```text
AUTHORITY_UNIT_PASS=30 (src/lib/order-transitions.test.ts, puro, sin DB — target graph DOMICILIO/RETIRO/MESA, grafo activo, cancelación en aceptado, mesa sin aceptado)
NEGOCIO_STATE_PASS=11 (lock-ownership 2 + CAS concurrency 6 + mesa CAS 3)
OPERACIONES_PYR_PASS=6 / SALON_PASS=6 (mockeados, confirman cero cambio de comportamiento tras migrar a la autoridad compartida)
CANCELLATION_PASS=14 / CANCELLATION_FAIL=2 (mesa-pedido-cancelacion.test.ts, intermitente — errores DISTINTOS entre corridas idénticas, archivo sin ninguna dependencia de lo tocado por T29A — clasificado como la misma familia de fragilidad ya documentada en F-P2-TESTINFRA-01, no investigado más a fondo)
ORDER_SECURITY_PASS=14 (order-rate-limit-buckets.integration.test.ts, regresión, sin relación con T29A)
TYPECHECK_RAW=24 (idéntico al baseline de este checkout) / NEW_TYPECHECK_ERRORS=0
BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
NEW_FAIL=0
```

**Método de verificación de concurrencia real**: en vez de depender del
lock process-local (que serializa cualquier request concurrente dentro
del MISMO proceso, y por lo tanto nunca ejercería una carrera real a
nivel de DB dentro de un único proceso de test), se probó la primitiva
CAS (`db.pedido.updateMany` con `estado: currentEstado` en el WHERE)
DIRECTAMENTE vía `Promise.all`, sin pasar por el lock — esto simula el
escenario real que motiva el CAS (múltiples instancias/workers de
Railway, donde el lock in-memory de un proceso no protege). Combinado
con un test end-to-end a través del endpoint completo (lock + CAS
ambos activos), se cubrieron ambas capas de la garantía por separado.

**Hallazgo de proceso, reproducible**: el archivo `order-rate-limit-
buckets.integration.test.ts` (177s) NO está colgado — es legítimamente
lento por timers reales de rate-limiting. Confirmado dándole tiempo
explícito suficiente (280s) en vez de asumir un hang tras un timeout
corto — un `bun test` con timeout demasiado ajustado puede parecer
"colgado" sin estarlo; regla ya aplicada consistentemente desde la
tarea de promoción PRE-T29 anterior.

Ver `codex-reports/P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS.md`
para el detalle completo, incluida la comparación línea por línea de
las 4 tablas de reglas duplicadas eliminadas.

## PRE-T29-PRODUCTION-GOOGLE-OAUTH-PENDING-SECRET-PRECONDITION — 2026-09-08 (sin cambios de test — tarea puramente operacional de Railway)

```text
TEST_CODE_CHANGED=NO
```

Ningún test tracked se agregó, modificó ni ejecutó como parte de esta
tarea — mutación de una variable de entorno en Railway Production,
verificada con smoke tests HTTP no mutantes (ver
`PRE_T29_PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRECONDITION.md`), no
con la suite de `bun test`. El baseline de tests sigue siendo el
establecido por la auditoría anterior (1177 pass, 9 fallas
preexistentes, 0 nuevas).

## PRE-T29-PRODUCTION-PROMOTION-READINESS-AUDIT — 2026-09-08 (READ-ONLY — batería representativa de promoción: 1177 pass, 9 fallas preexistentes ya documentadas, 0 nuevas)

```text
PROMOTION_TEST_PASS=1177 (646 de Push+chat-deep-link+notificationclick+iOS-safe-area + 531 de auth/PWA/legal/tracking)
PROMOTION_PREEXISTING_FAIL=9 (5 en ios-standalone-post-keyboard-nav-occlusion-r6-static-contract.test.ts, 4 en repartidor-tracking-static-contract.test.ts MODEL-G1 vs MODEL-E1 de P2-T02)
PROMOTION_NEW_FAIL=0
RC_BUILD_PASS=SI / TYPECHECK_RAW=24 (0 nuevos) / DIFF_CHECK_PASS=SI
```

Nota de infraestructura de test descubierta en esta tarea:
`src/lib/superadmin-auth.test.ts` requiere una conexión PostgreSQL real
(`DELIGO_TEST_DATABASE_URL`) pese a NO llevar el sufijo
`.integration.test.ts` que el resto del repo usa consistentemente para
marcar esa dependencia — inconsistencia de nomenclatura menor, no un
bug de código. Se excluyó explícitamente de la batería de promoción
(mismo criterio que `TEST_AUTHORITY.md` ya aplica a los archivos
`*.integration.test.ts` reales) en vez de reportarlo como fallas
nuevas. Cualquier tarea futura que arme una batería amplia por patrón
de nombre de archivo (`*auth*.test.ts`, etc.) debe tener en cuenta este
caso específico. Ver
`PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md`.

## P2-T29-ESPERANDO-REPARTIDOR-ACCEPTANCE-REDESIGN-AUDIT-AND-DESIGN — 2026-09-08 (READ-ONLY — inventario de cobertura de tests del lifecycle de pedidos, sin tests nuevos)

```text
CURRENT_TEST_COVERAGE_MATRIX (transiciones de estado de Pedido)=
- negocio/pedidos/[id]/estado: SOLO order-estado-lock-ownership.test.ts (ownership del lock process-local — NO valida transiciones/CAS)
- repartidor/pedidos/[id]/aceptar: CERO tests (endpoint de mayor riesgo de concurrencia del sistema)
- repartidor/pedidos/[id]/entregar: CERO tests
- repartidor/pedidos/auto-cancel: CERO tests
- operaciones/pyr/pedidos/[id]/estado: CERO tests
- operativo/{pyr,salon,mozo}/pedidos/[id]/{preparar,en-camino,listo-para-retiro,entregar}: CERO tests
- cliente/pedidos/[id] (cancelar/confirmar): CERO tests
- P2-T25 (order abuse): cubre exclusivamente creación de pedidos (rate limiting/idempotencia), NO transiciones de estado
TEST_GAPS_FOR_T29=CRÍTICO en repartidor/pedidos/[id]/aceptar (cero cobertura de concurrencia ejecutable pese a ser, por lectura de código, un CAS correcto)
```

Inventario exhaustivo por `find`/lectura directa de cada directorio de
API relacionado a pedidos — no inferido de reportes anteriores. No se
escribió ningún test en esta tarea (read-only). El gap de
`repartidor/pedidos/[id]/aceptar` queda registrado como prioridad
obligatoria de la fase T29A de implementación (reproducir la
concurrencia real de dos repartidores compitiendo, mismo patrón ya
usado en `P2_T25_R2B_CONCURRENT_IDEMPOTENCY_BUSINESS_BUCKET_RACE.md`
para otra carrera real de este repo). Ver
`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`.

## P2-T31-R21-FINAL-DIAGNOSTICS-DISPOSITION-AND-CLOSEOUT — 2026-09-08 (READ-ONLY recheck de las suites focales — todo sin regresión, P2-T31 CERRADO)

```text
R21_READ_ONLY_TEST_RECHECK_PERFORMED=SI
chat-provider-deep-link-hydration.test.ts: 21/21 PASS (baseline preservado)
sw-notificationclick-target-routing.test.ts: 6/6 PASS (baseline preservado)
chat-ios-safe-area-static-contract.test.ts: 12/12 PASS (baseline preservado)
PUSH_TEST_BASELINE_PASS=607 / PUSH_TEST_FINAL_PASS=607 / PUSH_TEST_FINAL_FAIL=0 (34 archivos *push*.test.ts, sin regresión)
```

Recheck barato, sin agregar ni modificar ningún test tracked. `git
diff --name-status`/`--stat` vacíos antes y después de esta tarea.
Además, esta tarea auditó por lectura directa de código (no ejecución
de test) que el hardening permanente de R13A (fail-safe failure-state)/
R19 (retry acotado a 2 intentos)/R19R (gate.isCurrent() inmediato antes
del bind de backend)/R19R1 sigue intacto en
`src/hooks/use-push-notifications.ts` — sin cambios desde su última
verificación. Ver
`P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md`.

## P2-T31-R24-IOS-CHAT-SAFE-AREA-INTERACTIVE-CONTROLS-AUDIT-FIX-TESTING-DEPLOY — 2026-09-08 (12 tests nuevos, static/DOM contract, R23C/notificationclick/Push sin regresión, iOS/PWA proxy sin fallas nuevas, desplegado en TESTING)

```text
NEW_TEST_FILE=src/lib/chat-ios-safe-area-static-contract.test.ts (12 tests, mismo patrón que hero-safe-area-static-contract.test.ts)
IOS_CHAT_SAFE_AREA_TEST_PASS=12 / IOS_CHAT_SAFE_AREA_TEST_FAIL=0
CHAT_R23C_REGRESSION_PASS=21 / CHAT_R23C_REGRESSION_FAIL=0 (chat-provider-deep-link-hydration.test.ts, sin cambios)
NOTIFICATIONCLICK_TEST_PASS=6 / NOTIFICATIONCLICK_TEST_FAIL=0 (sw.js no tocado)
CHAT_EXISTING_STATIC_CONTRACTS=chat-sheet.test.tsx + chat-view.test.tsx + chat-fab.test.tsx, sin cambios (76/76 combinado con lo de arriba)
PUSH_TEST_BASELINE_PASS=607 / PUSH_TEST_FINAL_PASS=607 / PUSH_TEST_FINAL_FAIL=0 (34 archivos *push*.test.ts)
IOS_PWA_PROXY_PASS=303 / IOS_PWA_PROXY_PREEXISTING_FAIL=5 / IOS_PWA_PROXY_NEW_FAIL=0 (mismo archivo no tocado, ya documentado en R23C)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI / BUILD_PASS=SI
```

`chat-ios-safe-area-static-contract.test.ts` lee la fuente real de
`chat-sheet.tsx`, `chat-view.tsx`, `sheet.tsx`, `globals.css` y
`layout.tsx` (mismo patrón `readFileSync` + `toContain`/`toMatch` que
`hero-safe-area-static-contract.test.ts`) y cubre los 6 puntos
requeridos por la tarea: (1) header del listado safe-area-aware, ya no
`py-4` plano; (2) header de conversación safe-area-aware, ya no `py-3`
plano, con el botón `ArrowLeft`/`onBack` intacto; (3) el Sheet conserva
su full-bleed (`w-full sm:max-w-md p-0 flex flex-col overflow-hidden
h-dvh`); (4) `sheet.tsx` lleva `data-slot="sheet-close"`, `globals.css`
lo reposiciona SÓLO bajo `[data-ios-debug-role="chat-sheet"]`, y el
`top-4 right-4` por defecto sigue intacto para el resto de la app; (5)
todo `env(safe-area-inset-top)` nuevo lleva fallback `,0px)` explícito;
(6) ningún archivo tocado tiene `navigator.userAgent`/branching por
plataforma, `layout.tsx` conserva `viewportFit:"cover"` y no ganó
ningún `safe-area-inset-top` propio.

Nota de proceso: un primer intento de editar `sheet.tsx` dejó
temporalmente una etiqueta JSX sin cerrar — ESLint lo detectó como
error de parseo ANTES de cualquier stage/commit; se corrigió de
inmediato y se re-verificó ESLint/build limpios. Ver
`P2_T31_R24_IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_AUDIT_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23C-CHAT-ACTOR-RESET-FIRST-HYDRATION-GUARD-FIX-TESTING-DEPLOY — 2026-09-08 (11 tests nuevos cerrando el gap de modelo de R23A, before/after riguroso, matriz completa de actor-reset, suite Push 607/607 sin regresión, desplegado en TESTING)

```text
MODIFIED_TEST_FILE=src/providers/chat-provider-deep-link-hydration.test.ts (+186 líneas, nuevo describe "P2-T31-R23C", 10 tests originales sin tocar)
CHAT_ACTOR_RESET_TEST_PASS=11 / CHAT_ACTOR_RESET_TEST_FAIL=0
CHAT_DEEPLINK_HYDRATION_TEST_PASS=10 / CHAT_DEEPLINK_HYDRATION_TEST_FAIL=0 (describe original R23A, sin cambios, preservado)
COMBINED_FILE_PASS=21 / COMBINED_FILE_FAIL=0
NOTIFICATIONCLICK_TEST_PASS=6 / NOTIFICATIONCLICK_TEST_FAIL=0 (sin cambios, sw.js no tocado)
R23B_ROOT_CAUSE_REPRO_WITH_OLD_RESET=FAIL_EXPECTED (verificado: revirtiendo temporalmente sólo `previous !== null` del guard, exactamente 5/21 tests fallan)
R23C_ROOT_CAUSE_REPRO_WITH_NEW_RESET=PASS (21/21 con el fix restaurado de inmediato)
PUSH_TEST_BASELINE_PASS=607 / PUSH_TEST_FINAL_PASS=607 / PUSH_TEST_FINAL_FAIL=0 (34 archivos *push*.test.ts)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI / BUILD_PASS=SI
```

Cierra el gap de modelo de test que R23B documentó sobre la propia
suite de R23A: se agregó un `JointHarness` que monta `useChatDeepLink`
(ya exportado desde R23A) junto a `useChatActorReset` (exportado por
primera vez, sólo para test, sin cambio de comportamiento) EN EL MISMO
ORDEN que `ChatProvider` real. Cubre: el repro principal del escenario
same-commit de R23B, un test de persistencia FINAL (tras un ciclo
adicional de efectos, no sólo "se abrió en algún instante"), y la
matriz completa de 9 transiciones de actor (A-I: primer mount sin
usuario, primera hidratación, mismo actor, logout, cambio de actor,
cambio de rol, logout-exactamente-una-vez, post-logout sin reset
duplicado, mount ya hidratado). Cada caso de la matriz verifica el
estado OBSERVABLE del store (un sentinel en `conversations`) en vez de
espiar `reset()` directamente — más fiel al comportamiento real que
vería cualquier consumidor.

Verificación rigurosa before/after: se revirtió TEMPORALMENTE sólo la
condición `previous !== null` del guard (volviendo a la lógica
pre-R23C) y se confirmó que exactamente 5 de 21 tests fallan —
incluido el repro principal y un error no manejado de React
(`window is not defined`, artefacto del entorno de test al desmontar
tras estado inconsistente, sin relevancia para producción); se
restauró el fix de inmediato y se re-confirmaron los 21/21 verdes antes
de continuar.

**Nota sobre "PWA focal 52"**: el listado exacto de archivos de ese
gate histórico no está preservado literalmente (a diferencia del union
de 34 `*push*.test.ts`, que sí lo está) — no se re-derivó en R23C
porque el diff de esta tarea no toca ningún archivo PWA/iOS/manifest.
Como verificación adicional, se corrió un glob propio de 23 archivos
`*ios*`/`*pwa*`/`*manifest*`/`*viewport*`/`*install*`.test.ts*: 291
pass, 5 fail — las 5 fallas están todas en un único archivo
(`ios-standalone-post-keyboard-nav-occlusion-r6-static-contract.test.ts`)
no tocado por R23C ni de forma indirecta (`git diff --stat` confirma
sólo 2 archivos modificados en el commit); no son una regresión de esta
tarea. Ver
`P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23B-CHAT-PUSH-TAP-RUNTIME-URL-CONSUMPTION-ROOT-CAUSE-AUDIT — 2026-09-08 (READ-ONLY — ningún test tracked agregado; gap de modelo de test de R23A identificado y probado con un script fuera del repo)

```text
NEW_TRACKED_TEST_FILES=NONE (auditoría estrictamente read-only)
SCRATCHPAD_REPRO_SCRIPT=r23b_actor_reset_repro.ts (fuera del repo, nunca commiteado; happy-dom + react-dom/client real + act(); importa useChatDeepLink real y exportado de src/providers/chat-provider.tsx; redeclara useChatActorReset copiando su cuerpo exacto, no exportado)
REPRO_CASE_A_SAME_COMMIT=isSheetOpen:false,activePedidoId:null (pierde el deep-link — coincide con el auth-store.ts real)
REPRO_CASE_B_SEPARATE_COMMITS=isSheetOpen:true,activePedidoId:"pedido-r23b" (preserva el deep-link)
TEST_MODEL_GAP=chat-provider-deep-link-hydration.test.ts (R23A) monta SÓLO useChatDeepLink, nunca useChatActorReset junto a él — nunca ejercitó la interacción entre ambos hooks, por eso 10/10 verde ahí no detectó este bug
```

Gap de modelo de test identificado en el propio suite que R23A dejó
verde: ningún test existente monta `ChatProvider()` completo (ambos
hooks, en el orden real) contra una hidratación de `auth-store`
simulada, ni verifica que el chat SIGA abierto después de que la
hidratación termine (sólo que abriera). Se construyó una reproducción
con código real (no una reimplementación) fuera del repo para probar
la hipótesis derivada de lectura de código — confirmó el mecanismo
exacto. No se agregó ningún test tracked en esta tarea (read-only); el
diseño de test para R23C (extender la cobertura para cubrir el guard
correcto de `useChatActorReset`, incluyendo el caso legítimo de
logout→login de un actor distinto) queda documentado en el reporte,
no implementado. Ver
`P2_T31_R23B_CHAT_PUSH_TAP_RUNTIME_URL_CONSUMPTION_ROOT_CAUSE_AUDIT.md`.

## P2-T31-R23A-CHAT-NOTIFICATION-DEEPLINK-AUTH-HYDRATION-FIX-TESTING-DEPLOY — 2026-09-08 (gap de R23 cerrado — 16 tests nuevos, before/after de la carrera confirmado rigurosamente, suite Push 607/607 sin regresión, desplegado en TESTING)

```text
NEW_TEST_FILES=src/providers/chat-provider-deep-link-hydration.test.ts (10 tests, happy-dom + react-dom real), src/lib/sw-notificationclick-target-routing.test.ts (6 tests, sw.js real en VM sandbox)
CHAT_DEEPLINK_TEST_PASS=10 / CHAT_DEEPLINK_TEST_FAIL=0
NOTIFICATIONCLICK_TEST_PASS=6 / NOTIFICATIONCLICK_TEST_FAIL=0
R23_AUTH_HYDRATION_RACE_REPRO_BEFORE=FAIL_EXPECTED (verificado: revirtiendo temporalmente sólo la línea de dependencias del efecto, exactamente 3/10 tests fallan — restaurado de inmediato)
R23_AUTH_HYDRATION_RACE_REPRO_AFTER=PASS (10/10 con el fix)
PUSH_TEST_BASELINE_PASS=607 / PUSH_TEST_FINAL_PASS=607 / PUSH_TEST_FINAL_FAIL=0
PWA_FOCAL_TEST_PASS=52 / PWA_FOCAL_TEST_FAIL=0
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI / BUILD_PASS=SI
```

Cierra el gap total de cobertura que R23 documentó
(`notificationclick`/`buildPersonalNotificationTarget`/`ChatProvider`/
`useChatDeepLink` sin ningún test). `chat-provider-deep-link-hydration.
test.ts` usa el mismo patrón real de DOM ya establecido en el repo
(`happy-dom` + `react-dom/client` + `act()`, igual que
`src/store/auth-store.test.ts`/`src/hooks/use-repartidor-tracking.
test.ts`) — ningún harness nuevo inventado. `sw-notificationclick-
target-routing.test.ts` reutiliza la técnica de `sw-push-dedupe.
test.ts`/`sw-push-role-icon-routing.test.ts` (carga el `public/sw.js`
REAL en VM sandbox). Ver
`P2_T31_R23A_CHAT_NOTIFICATION_DEEPLINK_AUTH_HYDRATION_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23-CHAT-PUSH-NOTIFICATION-TAP-DEEPLINK-ROOT-CAUSE-AUDIT — 2026-09-08 (sin cambios de código/tests tracked — reproducción read-only de notificationclick en VM sandbox, gap total de cobertura documentado — GAP CERRADO POR R23A ARRIBA)

```text
REAL_SW_JS_NOTIFICATIONCLICK_EXECUTED_IN_VM_SANDBOX=SI (script temporal fuera del repo, misma técnica de R22/R22A, nunca dejado en el working tree)
REPRO_CASES_RUN=4 (negocio+chat app cerrada, negocio+chat app abierta, cliente+order_update control, repartidor+new_delivery control)
REPRO_RESULT=el sw.js calcula la URL/ventana EXACTA y correcta en los 4 casos — el bug NO está en sw.js
CHAT_NOTIFICATION_TEST_COVERAGE_STATUS=GAP_TOTAL (ningún test cubre notificationclick, buildPersonalNotificationTarget, ni ChatProvider/useChatDeepLink — ni siquiera para los casos que sí funcionan)
```

Se auditó exhaustivamente la cobertura existente de deep-linking de
notificaciones: `sw-push-dedupe.test.ts` y `sw-push-role-icon-
routing.test.ts` (R22A) sólo ejercitan el `push` event, nunca
`notificationclick`. Ningún test existe para `buildPersonalNotification
Target` (función pura, sin ningún test directo, ni para los tipos que
funcionan) ni para `src/providers/chat-provider.tsx`::`useChatDeepLink`
(el mecanismo exacto donde vive el bug de R23). Este gap total es el
insumo directo para el diseño de tests de la futura tarea de fix
(R23A). No se agregó ningún test tracked en esta tarea (read-only). Ver
`P2_T31_R23_CHAT_PUSH_NOTIFICATION_TAP_DEEPLINK_ROOT_CAUSE_AUDIT.md`.

## P2-T31-R22A-ANDROID-PUSH-NOTIFICATION-ROLE-ICON-ROUTING-FIX-TESTING-DEPLOY — 2026-09-08 (gap de R22 cerrado — 30 tests nuevos, suite Push 607/607, desplegado en TESTING)

```text
NEW_TEST_FILES=src/lib/sw-push-role-icon-routing.test.ts (26 tests, nuevo), src/lib/push.test.ts (4 tests nuevos, modificado)
PUSH_TEST_BASELINE_PASS=577 / PUSH_TEST_FINAL_PASS=607 / PUSH_TEST_FINAL_FAIL=0
PWA_FOCAL_TEST_PASS=52 / PWA_FOCAL_TEST_FAIL=0
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI / BUILD_PASS=SI
R22_BUG_REPRO_BEFORE=FAIL_EXPECTED / R22_BUG_REPRO_AFTER=PASS
POST_DEPLOY_SW_JS_CONTENT_VERIFIED_BYTE_IDENTICAL=SI (diff --strip-trailing-cr contra el archivo servido en TESTING)
```

Cierra el gap de cobertura que R22 documentó (`notifType→icon`/
`role→icon` sin tests): `sw-push-role-icon-routing.test.ts` carga el
`public/sw.js` REAL en un VM sandbox (misma técnica que
`sw-push-dedupe.test.ts`) y cubre los 3 roles core × sus notifType
compartidos, 11 casos de fallback legacy exactamente idénticos al
comportamiento pre-fix, role desconocido/null sin throw, y 2 tests de
precedencia de override explícito. `push.test.ts` se extendió con 4
tests que capturan el payload JSON real enviado a
`webpush.sendNotification` (reutilizando el mock existente de
`web-push`, sin fixture de DB nueva) para verificar `data.role`
directamente. Ver
`P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ROLE_ICON_ROUTING_FIX_TESTING_DEPLOY.md`.

## P2-T31-R22-ANDROID-PUSH-NOTIFICATION-ICON-ROUTING-ROOT-CAUSE-AUDIT — 2026-09-08 (sin cambios de código/tests tracked — reproducción read-only del sw.js real en VM sandbox, gap de cobertura documentado — GAP CERRADO POR R22A ARRIBA)

```text
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO (tracked)
REAL_SW_JS_EXECUTED_IN_VM_SANDBOX=SI (script temporal fuera del repo, misma técnica que src/lib/sw-push-dedupe.test.ts, nunca dejado en el working tree)
REPRO_CASES_RUN=8 (Cliente×order_update×2, Cliente×review, Cliente×chat, Negocio×new_order, Negocio×chat, Negocio×review, Repartidor×new_delivery)
REPRO_MISMATCHES_CONFIRMED=4 (Cliente+order_update ×2, Cliente+review, Negocio+chat) + 1 residual ya conocido (Repartidor+new_delivery)
TEST_COVERAGE_GAP=notifType→icon y role→icon: CERO tests existentes en todo el repo (confirmado por grep exhaustivo)
```

Se auditó exhaustivamente la cobertura existente: el único test que
carga el `sw.js` real (`src/lib/sw-push-dedupe.test.ts`) sólo cubre el
registro de dedupe D2 (chat foreground) — cero aserciones sobre
`icon`/`badge`. `src/lib/push.test.ts` no tiene ninguna aserción sobre
`.role`/`personalRoleFor`. Este gap total es el insumo directo para el
diseño de tests del futuro fix (R22A) — matriz completa en
`P2_T31_R22_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_ROOT_CAUSE_AUDIT.md`
§18. No se agregó ningún test tracked en esta tarea (read-only).

## DELIGO-BRANDING-R1A-REVIEW-COMMIT-PUSH-TESTING-DEPLOY — 2026-09-08 (gate re-ejecutado fresco antes de commitear, desplegado TESTING, 16 smokes HTTP no mutantes)

```text
FOCAL_TEST_PASS=52 / FOCAL_TEST_FAIL=0
PUSH_TEST_PASS=577 / PUSH_TEST_FAIL=0 (re-ejecutada por tocar sw.js)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI / BUILD_PASS=SI
ICON_BINARY_VALIDATION_PASS=SI (10/10, incluye verificación EN VIVO post-deploy: fetch real de icon-operaciones-192x192.png desde TESTING, firma PNG válida, dimensión 192x192 exacta)
SMOKES_HTTP_POST_DEPLOY_PASS=16/16 (GET / + 5 manifests + 10 íconos, todos con tamaño en bytes idéntico al archivo local commiteado)
```

Review independiente (no confiar en el reporte R1): se re-verificaron
los 10 PNG con firma/dimensión reales, la ausencia de `icon192`/
`icon512` compartido entre roles, `manifest-operaciones.json` sin
`icon-negocio`, y `sw.js` sirviendo `deligo-v15` — todo contra el
filesystem real antes de stagear. Tras el deploy, se repitió la
validación PNG contra el contenido SERVIDO en vivo por TESTING (no sólo
el archivo local), confirmando bytes idénticos. Ver
`DELIGO_BRANDING_R1A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## DELIGO-BRANDING-R1-PWA-ROLE-ICON-REFRESH — 2026-09-08 (nuevo test focal de contrato de íconos, suite Push completa re-ejecutada por tocar sw.js, build limpio — DESPLEGADO EN TESTING POR R1A ARRIBA)

```text
NEW_TEST_FILE=src/lib/pwa-role-icon-contract.test.ts (5 tests)
FOCAL_TEST_PASS=52 / FOCAL_TEST_FAIL=0 (incluye pwa-identity, pwa-canonical-scope, role-config, ios-pwa-debug-launch, ios-viewport-debug-panel, client-headers-safe-area, pwa-role-icon-contract)
PUSH_TEST_PASS=577 / PUSH_TEST_FAIL=0 (re-ejecutada completa por tocar public/sw.js — bump de CACHE_NAME, cero lógica de push tocada)
ESLINT_PASS=SI / TYPECHECK_RAW_FINAL=24 / NEW_TYPECHECK_ERRORS=0 / DIFF_CHECK_PASS=SI / BUILD_PASS=SI
GLOBAL_BUN_TEST_RUN=227 fallos/3 errores, 100% pre-existentes y ambientales (DATABASE_URL no configurado en este entorno local) — ninguno relacionado con icon/manifest/pwa-identity/role-config/sw.js/pwa-role-icon-contract
ICON_BINARY_VALIDATION_PASS=SI (10/10 PNG con firma válida y dimensiones IHDR exactas 192x192/512x512)
```

`pwa-role-icon-contract.test.ts` verifica: (1) `role-config.icon192/
icon512` existen en disco, son PNG válidos, con la dimensión exacta que
su nombre promete; (2) cada uno de los 5 roles objetivo apunta a SU
PROPIO asset, nunca al de otro (Operaciones ya no comparte valor con
Negocio); (3) ningún manifest de los 5 roles referencia un ícono
inexistente, y sus entradas `purpose: "any"` apuntan al ícono propio
del rol; (4) `manifest-operaciones.json` ya no contiene el substring
`icon-negocio`; (5) el fallback global de `layout.tsx` sigue siendo
Cliente. Ver `DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`.

## P2-T31-R20-ANDROID-PUSHMANAGER-PERSISTENT-ABORTERROR-ROOT-CAUSE-AND-DEVICE-DIAGNOSTIC — 2026-09-08 (sin cambios de código/tests — auditoría de causa raíz + validación en vivo de VAPID + investigación Chromium/Push API)

```text
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO
VAPID_LIVE_FETCH_VALIDATION=SI (GET /api/push/vapid-key en TESTING, lectura no-mutante: 87 chars b64url, 65 bytes decodificados, primer byte 0x04)
ALL_SOURCE_LEVEL_PRECONDITIONS_AUDITED=SI / ALL_SOURCE_LEVEL_PRECONDITIONS_STATUS=PASS
ABORTERROR_UNDERLYING_CAUSE_STATUS=STRONGLY_SUPPORTED_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
```

Sin ejecución de `bun test`/ESLint/TypeScript nuevos en esta tarea —
no hubo ningún cambio de código o test que gatee un gate fresco (el
gate vigente sigue siendo el de R19A: 577 focales en 0 fail, ESLint
limpio, TypeScript 24 raw/18 distintos, `NEW_TYPECHECK_ERRORS=0`,
inalterado). La única verificación nueva de esta tarea fue una
auditoría de precondiciones source-level (matriz completa, ver el
reporte) más un fetch de solo lectura, no-mutante, contra
`GET /api/push/vapid-key` en TESTING para validar en vivo el formato de
la VAPID key vigente (decodificada localmente sin imprimirla: longitud,
charset, byte-length, primer byte) — nunca `POST /api/push/subscribe`.
Ver `P2_T31_R20_ANDROID_PERSISTENT_ABORTERROR_ROOT_CAUSE_DEVICE_DIAGNOSTIC.md`.

## P2-T31-R19A-REVIEW-COMMIT-PUSH-TESTING-DEPLOY — 2026-09-08 (gate re-ejecutado fresco antes de commitear, desplegado TESTING)

Antes de stagear/commitear el diff acumulado de R19+R19R+R19R1, se
re-ejecutó el gate completo sobre el estado exacto a commitear (no
reutilizado de tareas anteriores): `bun test` sobre los 33 archivos
`*push*.test.ts` → **577 pass / 0 fail** (idéntico al resultado de
R19R1), `npx eslint` sobre los 4 archivos exactos del fileset →
limpio, `tsc --noEmit` → 24 raw / 18 distintos (idéntico a la baseline
vigente desde R15A, 0 nuevos), `git diff --check` limpio sobre
tracked. Commit único `39566e69647fd2b19453721214563a7b9a0ccc5e`
(parent `d7cc66d`), push a `testing-codex`, autodeploy TESTING
verificado `SUCCESS` con `commitHash` exacto (deployment
`425ff95a-5a2e-4d70-9dd1-fbae6df5ce19`). El contrato de tests descrito
abajo (R19R1/R19R/R19) es el que efectivamente llegó a TESTING. Ver
`P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## P2-T31-R19R1-EXPLICIT-MUTATION-REGISTRY-SET-RELEASE-COVERAGE — 2026-09-08 (TEST 8 ahora con evidencia de registry real, cero cambios de producto, 577 focales en 0 fail — DESPLEGADO EN TESTING POR R19A ARRIBA)

`use-push-notifications-stale-actor-backend-guard.test.ts` (bloque
abajo, sin archivos nuevos) se extendió con 2 tests deterministas
adicionales, describe `"MUTATION_REGISTRY_SET_RELEASE — explicit
real-registry coverage (R19R1, TEST 8 of the R19R mandate)"`:

- **Flujo compuesto stale-during-AbortError-retry** (el escenario
  exacto que faltaba): un harness TEST-ONLY
  (`runLikeSubscribeHighLevelOperation`) compone, en el mismo orden que
  `subscribe()` propio, las 3 funciones REALES ya exportadas —
  `createPhysicalPushSubscriptionWithAbortRecovery` (R19),
  `bindPhysicalPushSubscriptionToBackend` (R19R), y
  `registerInFlightPersonalPushMutation` (R2, el registry REAL de
  `push-mutation-in-flight-registry.ts`, **nunca mockeado**, importado
  directamente junto con `hasInFlightPersonalPushMutationForDebug` y
  `__resetInFlightPersonalPushMutationsForTests`, ambos ya exportados
  desde R2). Un `trace` contador (`countingRegistryTrace`) cuenta los
  eventos `MUTATION_REGISTRY_SET`/`MUTATION_REGISTRY_RELEASE` que el
  registry real emite. Secuencia: primer intento físico → `AbortError`
  → recheck → `null` → segundo intento físico queda GENUINAMENTE
  pendiente (confirmado con `hasInFlightPersonalPushMutationForDebug
  === true` en ese instante) → `gate.invalidate()` MIENTRAS sigue
  pendiente → el intento resuelve con éxito DESPUÉS → el bind se salta
  por stale. Resultado confirmado: `setCount() === 1`,
  `releaseCount() === 1`, `hasInFlightPersonalPushMutationForDebug ===
  false` (entrada final ausente), `backend.calls.length === 0`
  (preservado, sin cambios).
- **Camino normal exitoso** (mismo harness, sin `AbortError`): mismo
  contrato de limpieza — `setCount() === 1`, `releaseCount() === 1`,
  entrada final ausente.

```text
MUTATION_REGISTRY_SET_COUNT_STALE_ABORT_RETRY=1
MUTATION_REGISTRY_RELEASE_COUNT_STALE_ABORT_RETRY=1
MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_STALE_ABORT_RETRY=NO
MUTATION_REGISTRY_SET_COUNT_NORMAL_SUCCESS=1
MUTATION_REGISTRY_RELEASE_COUNT_NORMAL_SUCCESS=1
MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_NORMAL_SUCCESS=NO
R19_TEST8_EXPLICIT_REGISTRY_COVERAGE=SI
FOCAL_TEST_PASS=577
FOCAL_TEST_FAIL=0
ESLINT_PASS=SI
TYPECHECK_RAW_FINAL=24
TYPECHECK_DISTINCT_FINAL=18
NEW_TYPECHECK_ERRORS=0
DIFF_CHECK_PASS=SI (tracked — el archivo de test extendido sigue untracked, ver nota de R19R abajo, misma precisión aplica)
```

Ningún endpoint de backend, ninguna función de producto
(`createPhysicalPushSubscriptionWithAbortRecovery`,
`bindPhysicalPushSubscriptionToBackend`), ni el propio registry
(`push-mutation-in-flight-registry.ts`) fueron modificados — confirmado
por un `git diff --stat` de `use-push-notifications.ts` idéntico al de
R19R. `bun test` sobre los 33 archivos `*push*.test.ts` (mismo
conjunto que R19R, sin archivos nuevos): **577 pass / 0 fail** (575
previos + 2 nuevos). TypeScript idéntico a la baseline (24 raw/18
distintos, 0 nuevos).

Ver `P2_T31_R19R1_EXPLICIT_MUTATION_REGISTRY_COVERAGE.md`.

## P2-T31-R19R-ABORTERROR-RETRY-STALE-ACTOR-BACKEND-GUARD — 2026-09-08 (TEST 9 ahora determinista, gap stale-actor/backend cerrado, 575 focales en 0 fail — TEST 8 completado por R19R1 arriba)

`bindPhysicalPushSubscriptionToBackend` (nueva, en `src/hooks/
use-push-notifications.ts`, mismo patrón de dependencias inyectadas que
`checkPersonalPushStatus`) cubierta directamente por 10 tests
deterministas en el archivo nuevo `use-push-notifications-
stale-actor-backend-guard.test.ts`:

- 3 tests unitarios directos: operación current → postea 1 vez con
  trace correcto; operación ya stale → `postSubscribe` NUNCA se llama,
  trace `SUBSCRIBE_BACKEND_SKIPPED_STALE`; backend rechaza (`ok:false`)
  → `posted:true` para que el caller pueda lanzar con el status real.
- **TEST 9 del mandato original de R19, compuesto con el `Latest
  OperationGate` REAL + la función de retry REAL de R19**
  (`createPhysicalPushSubscriptionWithAbortRecovery`, sin mocks de
  ninguna de las dos): primer intento físico → `AbortError` → recheck
  confirma `null` → el SEGUNDO intento físico queda GENUINAMENTE
  pendiente (una promesa real que el test controla, no un `setTimeout`
  simulado) → el test invoca `gate.invalidate()` mientras sigue
  pendiente → el intento AHORA resuelve con una subscription física
  válida → se confirma `backend.calls.length === 0` y
  `bindResult === { posted: false, ok: false }`. Trace completo
  verificado evento por evento, terminando en `SUBSCRIBE_BACKEND_
  SKIPPED_STALE`, nunca `SUBSCRIBE_BACKEND_START`.
- Test dedicado (`spyOnGateBegin`): envuelve el gate real con un
  contador y prueba dinámicamente que `gate.begin()` se llama
  exactamente 1 vez en todo el flujo creación+bind — ninguna de las 2
  funciones minta una segunda operación de alto nivel
  (`MUTATION_REGISTRY_SINGLE_HIGH_LEVEL_OPERATION`, antes sólo probado
  por inspección en R19, ahora dinámico).
- Test paralelo, camino SIN `AbortError` (éxito inmediato en el primer
  intento, actor stale antes del backend): mismo resultado,
  `backend.calls.length === 0` — prueba que el guard no depende
  artificialmente de la ruta de retry, y expone honestamente que este
  gap ya existía ANTES de R19 (`PREEXISTING_STALE_BACKEND_BIND_GAP_
  EXPOSED_DURING_R19_REVIEW=SI`).
- 4 tests de conteo de llamadas a backend, cada escenario del mandato
  original afirmado explícitamente:
  `FIRST_SUCCESS_BACKEND_CALL_COUNT=1`,
  `ABORT_RECHECK_FOUND_VALID_BACKEND_CALL_COUNT=1`,
  `ABORT_RETRY_SUCCESS_BACKEND_CALL_COUNT=1`,
  `ABORT_RETRY_DOUBLE_FAIL_BACKEND_CALL_COUNT=0`.

```text
STALE_DURING_ABORT_RETRY_TEST=PASS
STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0
STALE_AFTER_FIRST_PHYSICAL_SUCCESS_BACKEND_CALL_COUNT=0
FOCAL_TEST_PASS=575
FOCAL_TEST_FAIL=0
ESLINT_PASS=SI
TYPECHECK_RAW_FINAL=24
TYPECHECK_DISTINCT_FINAL=18
NEW_TYPECHECK_ERRORS=0
DIFF_CHECK_PASS=SI (archivos TRACKED — el archivo de test nuevo es untracked; ver nota abajo)
UNTRACKED_TEST_FILE_VALIDATED=SI (ESLint limpio + ejecución real con éxito + revisión manual de whitespace — NUNCA declarado como cubierto por git diff --check, que no inspecciona contenido untracked)
```

Se actualizaron 2 assertions preexistentes en `use-push-notifications-
static-contract.test.ts` (`use-push-notifications-static-contract.
test.ts` describe `F-P2-T18-AUTH02` y `P2-T31-R8`) cuya ubicación
literal de código cambió por el refactor — la invariante que protegen
(URL de subscribe construida desde `actorType` con la misma forma
ternaria; `fetch` consume la variable calculada, nunca un literal
bare, guardia contra el mutante histórico M9; `PushMutationHttpError`
sigue llevando el status HTTP real) sigue exactamente igual, sólo
verificada en su nueva ubicación real dentro de
`bindPhysicalPushSubscriptionToBackend`. Se agregó además un test
nuevo confirmando que `subscribe()` sigue pasando su propio
`actorType`/`gateRef.current` reales a la función extraída (sin
selector desconectado).

`bun test` sobre los 33 archivos `*push*.test.ts` del repo completo —
incluye sin modificar R2/R3/R5/R7/R8/R13/R13A/R19, los 3 static-
contracts de rol, y todo `src/lib/push*.test.ts` (backend, sin cambios
— ningún endpoint tocado) — **575 pass / 0 fail**. TypeScript idéntico
a la baseline vigente desde R15A (24 raw / 18 distintos, 0 nuevos).

Ver `P2_T31_R19R_ABORTERROR_RETRY_STALE_ACTOR_BACKEND_GUARD.md`.

## P2-T31-R19-ANDROID-PUSHMANAGER-ABORTERROR-SINGLE-RETRY-HARDENING — 2026-09-08 (mitigación de retry único implementada, 564 focales en 0 fail — TEST 9 completado por R19R arriba)

`createPhysicalPushSubscriptionWithAbortRecovery` (nueva, en
`src/hooks/use-push-notifications.ts`) cubierta directamente por 10
tests deterministas en el archivo nuevo `use-push-notifications-
abort-retry.test.ts` (mismo patrón sin React/DOM que `use-push-
notifications-physical-subscribe-create-trace.test.ts`): éxito sin
retry (call count=1), AbortError+recheck-válido (call count=1, sin
2do subscribe), AbortError+recheck-null+2do-éxito (call count=2),
AbortError+recheck-null+2do-AbortError (call count=2, nunca un 3ro),
5 clases de error no-AbortError sin retry (parametrizado),
AbortError+recheck-lanza→fail-closed con el error ORIGINAL, y
AbortError+recheck-key-stale→fail-closed sin destruir la subscription
ambigua. Un test adicional de redacción confirma que el endpoint real
nunca aparece en ningún evento nuevo del trace.

```text
FOCAL_TEST_PASS=564
FOCAL_TEST_FAIL=0
ESLINT_PASS=SI
TYPECHECK_RAW_FINAL=24
TYPECHECK_DISTINCT_FINAL=18
NEW_TYPECHECK_ERRORS=0
DIFF_CHECK_PASS=SI
```

`bun test` sobre los 32 archivos `*push*.test.ts` del repo completo —
incluye sin modificaciones R2 (`push-mutation-in-flight-registry.
test.ts`, `push-operation-guard.test.ts`), R3/R5 (VAPID validation),
R7/R8 (`use-push-notifications-status-resolved.test.ts`, `use-push-
notifications-mutation-failure-message.test.ts`), R13/R13A
(`use-push-notifications-physical-subscribe-create-trace.test.ts`,
`use-push-notifications-report-mutation-failure-safely.test.ts`), los
3 static-contracts de rol (Cliente/Negocio/Repartidor), y todo
`src/lib/push*.test.ts` (backend) — **564 pass / 0 fail**, sin bajar
cobertura existente en ningún archivo. TypeScript idéntico a la
baseline vigente desde R15A (24 raw / 18 distintos, 0 nuevos); ningún
diagnóstico menciona `use-push-notifications*`. ESLint y `git diff
--check` limpios sobre el fileset exacto tocado (1 archivo de
producto + 1 test nuevo).

Ver `P2_T31_R19_ANDROID_PUSHMANAGER_ABORTERROR_SINGLE_RETRY_
HARDENING.md`.

## P2-T31-R18-ANDROID-ABORTERROR-CROSS-ROLE-RECURRENCE-AUDIT — 2026-09-08 (sin cambios de código — auditoría de recurrencia contra evidencia ya existente)

Tarea READ-ONLY — sin ningún cambio de código en `src/`. El gate de
tests de R13/R13A (que YA cubre exactamente este escenario:
`use-push-notifications-physical-subscribe-create-trace.test.ts`
reproduce el `AbortError` de `createPhysicalPushSubscription`, y
`use-push-notifications-report-mutation-failure-safely.test.ts` cubre
los 5 casos del contrato de failure-state) sigue vigente sin
modificaciones — la nueva evidencia física de R18 es exactamente el
escenario que esos tests ya verificaban de forma automatizada, ahora
confirmado también en runtime real de TESTING (Negocio, no sólo
Cliente) — Production nunca estuvo involucrada. No se agregó ningún
test nuevo porque no se identificó ningún caso no cubierto: el
contrato de failure-state se comportó exactamente como
sus tests predicen.

```text
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO
R13A_FAILURE_STATE_CONTRACT_CURRENT_PHYSICAL_RESULT=PASS (verificado contra la traza física real, coincide con lo que R13A §8 ya cubría con tests)
```

Ver `P2_T31_R18_ANDROID_ABORTERROR_CROSS_ROLE_RECURRENCE_AUDIT.md`.

## P2-T31-R17-ANDROID-CLIENT-PUSH-PHYSICAL-CERTIFICATION-AND-CONTEXT-RECONCILIATION — 2026-09-08 (sin cambios de código — certificación física, no gate automatizado)

Tarea de documentación/reconciliación de certificación física — sin
ningún cambio de código en `src/`. No hay diff que verificar; el gate
de 240 tests focales / ESLint / TypeScript de R15A/R15R sigue vigente
sin modificaciones. La "verificación" de esta tarea fue enteramente
evidencia FÍSICA entregada por el operador (foreground, closed-PWA,
notification tap, OFF+cold-reopen, los 4 en PASS tras habilitar
notificaciones de Chrome en Android) — un gate automatizado no puede
certificar entrega física real de push; ese es precisamente el tipo de
evidencia que ningún test unitario/E2E de este repo sustituye (ver
`deligo-safe-task`, invariante L: "Never substitute a required
physical test... with automated tests").

```text
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO
ANDROID_CLIENT_PUSH_MATRIX_STATUS=CERTIFIED_TESTING (evidencia física, no automatizada)
```

Ver
`P2_T31_R17_ANDROID_CLIENT_PUSH_PHYSICAL_CERTIFICATION_AND_CONTEXT_RECONCILIATION.md`.

## P2-T31-R16-ANDROID-PUSH-SUBSCRIPTION-PERSISTENCE-LOSS-ROOT-CAUSE-AUDIT — 2026-09-07/08 (sin cambios de código — no aplica gate)

Auditoría de causa raíz + inspección read-only de logs, sin ningún
cambio de código en `src/`. No hay diff que verificar — el gate de
240 tests focales / ESLint / TypeScript de R15A/R15R (bloque abajo)
sigue vigente sin modificaciones. La única "verificación" de esta
tarea fue de EVIDENCIA (logs reales de Railway TESTING, correlación de
timestamps), no de código:

```text
R16_FOCAL_PASS=N/A / R16_FOCAL_FAIL=N/A (sin diff que probar)
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO
```

Ver
`P2_T31_R16_ANDROID_PUSH_SUBSCRIPTION_PERSISTENCE_LOSS_ROOT_CAUSE_AUDIT.md`.

## P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST — 2026-09-07 (gate re-ejecutado fresco antes de commitear, desplegado TESTING — sigue vigente, sin cambios desde entonces)

Antes de stagear/commitear el fix R15R (bloque abajo), se re-ejecutó
el gate completo sobre el estado exacto a commitear (no reutilizado de
la tarea anterior): `bun test src/lib/push*.test.ts` → **240 pass / 0
fail** (idéntico al resultado de R15R), `npx eslint src/lib/push.ts
src/lib/push.test.ts` → limpio, `tsc --noEmit` → 24 raw / 18 distintos
(idéntico a la baseline de R15R, 0 nuevos), `git diff --check` limpio.
Commit único `d7cc66dcce6b2367cf52e5438741b02d5a2a2a84` (parent
`8b49756`), push a `testing-codex`, autodeploy TESTING verificado
`SUCCESS` con `commitHash` exacto (deployment
`906d7960-10f5-449b-a1bd-a492feb91bab`). El contrato de tests descrito
abajo (R15R) es el que efectivamente llegó a TESTING. Ver
`P2_T31_R15A_COMMIT_DEPLOY_AND_CLOSED_PWA_RETEST_READY.md`.

## P2-T31-R15R-PREDEPLOY-EVIDENCE-CORRECTION — 2026-09-07 (corrección pre-deploy del fix R15 — DESPLEGADO POR R15A ARRIBA)

Cambio de código LOCAL (sin commit/push/deploy) en `src/lib/push.ts`,
corrigiendo el fix de R15 (bloque abajo): `sendPushNotification` ahora
pasa `{ urgency: "high" }` como tercer argumento a
`webpush.sendNotification` SÓLO cuando `payload.data?.type` es uno de
los 8 `NotificationType` genuinamente time-sensitive
(`isTimeSensitivePushType` — `order_update`, `new_order`,
`new_delivery`, `chat`, `mesa_order_ready`, `salon_new_order`,
`operaciones_salon_new_order`, `operaciones_order_cancelled`); para el
resto (`review`, `review_request`, `account_update`, `general`, o sin
`data.type`) no se pasan `options` — se conserva el default `"normal"`
de la librería. El `TTL: 60*60*24` de R15 se removió por completo
(la librería ya aplica `DEFAULT_TTL=2419200`, 28 días, por default —
ver `web-push-lib.js`; no había ninguna decisión de producto que
autorizara acortar la retención a 24h). El log de éxito
`[Push] Enviado OK` (agregado por R15, sin gate) ahora está gateado
TESTING-only con `isPushDebugAllowedEnvironment()` (mismo guard que el
panel de diagnóstico de push, `RAILWAY_ENVIRONMENT_NAME`) y agrega el
`statusCode` real que devuelve `webpush.sendNotification()` en éxito.

8 tests nuevos/reescritos en `src/lib/push.test.ts`: describe
`sendPushNotification — R15R scoped delivery-priority options`
(R15R-1 a R15R-5: urgencia por tipo, TTL nunca forzado) y describe
`sendPushNotification — provider success observability (TESTING-only)`
(R15R-6/7/8: log aparece en TESTING con `providerStatus`, no aparece en
Production ni con la variable ausente).

```text
R15R_FOCAL_PASS=240 (8 archivos push*.test.ts)
R15R_FOCAL_FAIL=0
ESLINT_PASS=SI (0 issues en src/lib/push.ts y src/lib/push.test.ts)
TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0
```

Mismo único error de TypeScript preexistente que R15 (ver bloque
abajo) — sin cambios. Suite focal ejecutada con `bun test
src/lib/push*.test.ts` (no se repitió la corrida completa del repo;
sin cambios de código fuera de `push.ts`/`push.test.ts`, la limitación
de `DATABASE_URL` documentada por R15 sigue aplicando sin relación con
este cambio). Pendiente: `P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST`
hará el commit/deploy TESTING y coordinará el reintento físico. Ver
`P2_T31_R15R_PREDEPLOY_EVIDENCE_CORRECTION_AND_PUSH_PRIORITY_SCOPE.md`.

## P2-T31-R15-ANDROID-CLOSED-PWA-BACKGROUND-PUSH-ROOT-CAUSE-AUDIT — 2026-09-07 (fix local, sin deploy — CORREGIDO POR R15R ARRIBA)

Cambio de código LOCAL (sin commit/push/deploy) en `src/lib/push.ts`:
`sendPushNotification` ahora pasa `{ TTL: 60*60*24, urgency: "high" }`
como tercer argumento a `webpush.sendNotification` (antes: sin
`options`, causa `HIGH_CONFIDENCE_CODE_BUG` del fallo de entrega
closed-PWA en Android — ver `FINDINGS.md`), y loguea de forma segura un
envío exitoso (antes silencioso). 3 tests nuevos en
`src/lib/push.test.ts` (describe `sendPushNotification — R15
delivery-priority options`, tests R15-1/R15-2/R15-3):

```text
R15_FOCAL_PASS=235 (8 archivos push*.test.ts)
R15_FOCAL_FAIL=0
ESLINT_PASS=SI (0 issues en src/lib/push.ts y src/lib/push.test.ts)
TYPECHECK_RAW_FINAL=24 / TYPECHECK_DISTINCT_FINAL=18 / NEW_TYPECHECK_ERRORS=0
```

El único error de TypeScript dentro de `push.ts` es preexistente
(mismatch de tipos en el primer argumento de `webpush.sendNotification`,
sin relación con el cambio de esta tarea — confirmado línea por línea
contra el baseline). Suite completa del repo (`bun test`, sin filtro):
2915 pass / 227 fail / 3 errors — el 100% de las fallas se explica por
`DATABASE_URL` ausente en este sandbox local (tests
`*.integration.test.ts`), verificado que ninguna falla menciona
`push`. Pendiente: `P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST`
hará el commit/deploy TESTING y coordinará el reintento físico.

## P2-T31-ANDROID-CLOSED-PWA-DIAGNOSTIC-CONTEXT-CORRECTION — 2026-09-07 (documentación pura, sin cambios de gate)

Tarea de corrección de contexto — no ejecutó tests, no tocó código, no
cambió el gate automatizado vigente (commit `8b49756`, sin cambios).
Sólo actualiza la evidencia del hallazgo `F-PAYMENTS-PAUSE-ANDROID-
CLOSED-PWA-01` con el diagnóstico post-fallo que Leonardo entregó
(subscription/backend/VAPID sanos, `ANDROID_CLOSED_PWA_FAILURE_ROOT_
CAUSE_STATUS=UNRESOLVED_DELIVERY_PATH_REQUIRES_AUDIT`). Ningún test
nuevo requerido — la investigación de causa raíz (`P2-T31-ANDROID-
CLOSED-PWA-BACKGROUND-DELIVERY-ROOT-CAUSE-AUDIT`) no fue iniciada y
traerá su propio gate cuando se ejecute.

## DELIGO-PAYMENTS-MERCADOPAGO-DESIGN-CONTEXT-PERSISTENCE-AND-ANDROID-TEST-PAUSE — 2026-09-07 (documentación pura, sin cambios de gate)

Tarea de documentación/reconciliación — no ejecutó tests, no tocó
código, no cambió el gate automatizado vigente (581 pass / 0 fail,
commit `8b49756`, sin cambios). Registra evidencia física NUEVA
(post-R14) y la pausa operativa de las pruebas Android:

```text
ANDROID_FOREGROUND_PUSH_STATUS=PASS
ANDROID_CLOSED_PWA_PUSH_STATUS=FAIL_REPRODUCED (causa no auditada)
ANDROID_NOTIFICATION_TAP_STATUS=NOT_TESTABLE_DUE_TO_CLOSED_PWA_DELIVERY_FAILURE
ANDROID_OFF_COLD_REOPEN_STATUS=PENDING
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=SI
```

Ningún test nuevo requerido — Mercado Pago no tiene código todavía
(`MERCADOPAGO_INTEGRATION_CREATED=NO`). El diseño completo, con sus
propias categorías DECIDED/RESEARCHED/TO_VERIFY, vive en
`codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md` — cuando se implemente
cada etapa (`PAYMENTS-01`...`PAYMENTS-10`), esa implementación deberá
traer su propio gate de tests, certificado igual que cualquier otra
feature de este repositorio — no antes.

## P2-T31-R14-ANDROID-CREATE-RELIABILITY-CLOSEOUT-AND-REMAINING-PHYSICAL-MATRIX — 2026-09-06/07 (audit de evidencia física — evidencia posterior y pausa registradas arriba)

Tarea de auditoría física + reconciliación — no ejecutó tests, no
cambió el gate de 581 (vigente, desplegado en `8b49756`). Cierra
formalmente el reliability gate de creación física Android:

```text
ANDROID_POST_R13A_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
ANDROID_FIRST_SUBSCRIBE_RELIABILITY_STATUS=PASS_POST_R13A_3_CONSECUTIVE_CLEAN_CREATES
ABORTERROR_REPRODUCED_POST_R13A_3_OF_3=NO
ABORTERROR_FIXED_BY_DELIGO=NO_EVIDENCE
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE (sin cambios)
```

3 ejecuciones POST-fix consecutivas (ninguna reutiliza el Clean Create
1/3 anterior a R13A) ejercitaron creación física real
(`existingPresent=false` + `SUBSCRIBE_PHYSICAL_CREATE_RESULT` +
`reused=false` + backend 200) sin reproducir `AbortError`. El `PASS`
certifica estabilidad del camino de código bajo el criterio definido —
NO certifica que la causa del `AbortError` original haya sido
identificada ni neutralizada; no se agregó retry/hack alguno.

**F-P2-T31-R13-01 reclasificado**: de `OPEN_BLOCKING_FOR_ANDROID_
CERTIFICATION` a `OPEN_NON_BLOCKING_MONITORING` — el reliability gate
que se diseñó explícitamente para resolver el bloqueo se cumplió; la
causa de fondo permanece como residual de monitoreo, no como blocker
activo.

**Anomalía auditada, no un bug**: un capture mostró `permission=default`
con subscription/backend activos. Auditoría de código (`Notification.
requestPermission()`/`Notification.permission`, misma API) + spec
general de la Notifications API (ninguna API de JS puede revocar el
permiso ya concedido) + evidencia de plataforma (repos oficiales de
Google/PWABuilder documentando dos capas de permiso independientes en
Android: origen web vs. sistema operativo) — no se identificó como bug
de DeliGO ni se cambió código. No bloquea las pruebas de entrega
pendientes; se resuelve empíricamente al ejecutarlas.

**Matriz Android Cliente actualizada**:

```text
FIRST_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
ON_COLD_REOPEN=PASS (evidencia ya cubierta en Clean Create 1/3 y 2/3)
OFF_COLD_REOPEN=PENDING
FOREGROUND_PUSH=PENDING
CLOSED_PWA_PUSH=PENDING
NOTIFICATION_TAP=PENDING
ANDROID_NATIVE_PERMISSION_PROMPT_STATUS=NOT_EXPLICITLY_DOCUMENTED_IN_AVAILABLE_EVIDENCE
```

```text
ANDROID_PUSH_STATUS=PARTIAL_CREATE_RELIABILITY_CERTIFIED_PENDING_DELIVERY_AND_PERSISTENCE_MATRIX
```

No se certifica Android completo. Ver
`P2_T31_R14_ANDROID_CREATE_RELIABILITY_CLOSEOUT_AND_REMAINING_MATRIX.md`
para el detalle completo, incluida la clasificación PLATFORM_
DOCUMENTATION/INFERENCE de la anomalía de permiso y el orden mínimo
propuesto para las pruebas pendientes.

## P2-T31-R13A-PUSH-FAILURE-REPORTING-HARDENING-AND-TESTING-DEPLOY — 2026-09-06 (gate desplegado, vigente — creación física Android cerrada por R14 arriba)

El mismo gate de 581 tests (ver entrada de abajo) fue re-ejecutado
fresco inmediatamente antes de stagear/commitear, sin cambios de
resultado: **581 pass / 0 fail**. Este es el gate que corresponde al
código REALMENTE desplegado en TESTING — commit
`8b49756e76a32b2641bd1099c1e8382d3be32f25`, deployment `5de51131`,
confirmado `SUCCESS` con commit hash exacto. ESLint sobre los 4 archivos
exactos del commit: 0 errores. TypeScript: `24 raw / 19 distinct`,
idéntico a R12/R12A/R13 (estable), `NEW_TYPECHECK_ERRORS=0`.

**Corrección de wording de R13**: `SUBSCRIBE_FINISH_ON_PHYSICAL_CREATE_
ERROR_EXPECTED_BY_CODE` seguía siendo `SI` respecto al código escrito,
pero la formulación exacta de CUÁL llamada causó la excepción secundaria
se corrigió a `SECONDARY_FAILURE_EXACT_THROW_SITE=NOT_DIRECTLY_OBSERVED`
(el hecho de que ocurrió SÍ está probado por eliminación de todas las
demás expresiones evaluadas en esa ventana, todas funciones puras
auditadas — ver `DECISIONS_AND_INVARIANTS.md`). Se endureció además el
helper `reportMutationFailureSafely`: antes tenía un único `try/catch`
compartido para `console.error`+`toast.error`
(`LOG_AND_TOAST_SHARE_SINGLE_FAILURE_BOUNDARY=SI` en la versión previa)
— ahora cada llamada tiene su PROPIO boundary independiente
(`INDEPENDENT_LOG_FAILURE_BOUNDARY=SI`, `INDEPENDENT_TOAST_FAILURE_
BOUNDARY=SI`), garantizando que un fallo de logging NUNCA impida el
intento de mostrar el toast (contrato de failure-reporting A-F,
verificado con 5 tests directos: logger-throws-toast-still-attempted,
toast-throws-alone, ambos-lanzan, mensaje-null, camino-normal).

**Contrato de evaluación para el próximo capture físico** (registrado
explícitamente): si `AbortError` reaparece, el criterio NO es "¿se
arregló?" sino "¿el estado de fallo se mantuvo consistente?" — se espera
`physicalSubscription=false`, sin backend, `SUBSCRIBE_FINISH
subscribed=false`, registry `RELEASE`, `hookSubscribed=false`,
`uiSwitch=false`, feedback de error seguro, sin success feedback falso.
Ese resultado es `FAIL_DE_CREATE` + `PASS_DEL_FAILURE_STATE_CONTRACT` —
un resultado válido y esperado mientras la causa de plataforma del
`AbortError` (`NOT_PROVEN`) no se resuelva. `ABORTERROR_PLATFORM_RETRY_
IMPLEMENTED=NO` — sin retry/delay/hack Android agregado.

```text
ANDROID_RELIABILITY_GATE_POST_FIX_START=0_OF_3
```

Ver
`P2_T31_R13A_PUSH_FAILURE_REPORTING_HARDENING_TESTING_DEPLOY.md` para el
detalle completo.

## P2-T31-R13-ANDROID-PUSHMANAGER-ABORTERROR-AND-STALE-UI-ROOT-CAUSE — 2026-09-06 (fix desplegado y endurecido por R13A arriba — wording de causa secundaria corregido)

**Nota de lectura**: R13 encontró y corrigió un bug real de DeliGO (UI
stale tras un rechazo inesperado de `push.subscribe()`/`push.unsubscribe()`),
distinto del `AbortError` en sí (plausible, no probado, del lado del
navegador/servicio push). 580 pass / 0 fail — código LOCAL, no
commiteado/desplegado (TESTING sigue sirviendo `085cc0b`, sin este fix).

```
bun test <29 archivos del gate focal R12A/R12B + 1 archivo nuevo>

 580 pass / 0 fail / 1476 expect() calls / 30 files
```

`R13_FOCAL_PASS=580`, `R13_FOCAL_FAIL=0`. ESLint sobre los 4 archivos
exactos tocados: 0 errores. TypeScript: `24 raw / 19 distinct`, idéntico
a R12/R12A (estable), `NEW_TYPECHECK_ERRORS=0`.

**Corrección explícita de una afirmación de R12**: R12 (y R12A) habían
descrito `SUBSCRIBE_FINISH` como "unconditional" en ambas ramas
(éxito/error). Eso era cierto respecto al código TAL COMO ESTABA
ESCRITO (sin ningún `return`/`throw` temprano entre el rethrow de
`createPhysicalPushSubscription` y esa línea) — pero R13 probó, con una
traza física real donde `MUTATION_REGISTRY_RELEASE` aparece SIN que
`SUBSCRIBE_FINISH` aparezca nunca, que el código NO era realmente a
prueba de fallos: `console.error`/`toast.error`, sin ningún `try/catch`
propio, podían lanzar y romper esa garantía. Fix:
`reportMutationFailureSafely` — ver
`codex-reports/DECISIONS_AND_INVARIANTS.md` para el invariante
permanente registrado.

```text
ANDROID_PUSHMANAGER_SUBSCRIBE_RESULT=REJECTED
ANDROID_PUSHMANAGER_SUBSCRIBE_ERROR_CLASS=AbortError
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
STALE_UI_IS_DELIGO_BUG=SI
FIX_IMPLEMENTED=SI
ANDROID_PUSH_STATUS=FAIL_REPRODUCED_ABORTERROR_DURING_PHYSICAL_CREATE_PENDING_ROOT_CAUSE
P2_T31_R13_STATUS=ABORTERROR_ROOT_CAUSE_UNRESOLVED_UI_FAILURE_STATE_FIXED_LOCALLY
```

Ver
`P2_T31_R13_ANDROID_PUSHMANAGER_ABORTERROR_AND_STALE_UI_ROOT_CAUSE.md`
para el detalle completo, incluida la clasificación SOURCE_CODE_FACT vs
PLATFORM_DOCUMENTATION (W3C Push API spec) vs INFERENCE del `AbortError`.

## P2-T31-R12B-ANDROID-FAIL-PASS-RECONCILIATION-AND-RELIABILITY-GATE — 2026-09-06 (audit de evidencia física, sin cambios de gate automatizado — SUBSCRIBE_FINISH corregido por R13 arriba)

Tarea de auditoría física + reconciliación — no ejecutó tests, no
cambió el gate de 574 (vigente, desplegado en `085cc0b`). Reconcilia un
FAIL Android original con un PASS posterior sobre el MISMO build
(`085cc0b`, sin fix funcional entre ambos —
`FUNCTIONAL_FIX_BETWEEN_FAIL_AND_PASS=NO`). La nueva instrumentación de
R12 (`SUBSCRIBE_PHYSICAL_CREATE_START/RESULT`, `MUTATION_REGISTRY_SET/
RELEASE`) capturó por primera vez con evidencia directa que el contrato
de R2 (registro cross-remount) funciona exactamente como se diseñó en el
camino feliz — `MUTATION_REGISTRY_WAIT_NOT_FOUND` en el remount es
CORRECTO para esa captura porque la mutación ya se había liberado
~1169ms antes del remount, no un fallo de R2.

```text
ROOT_CAUSE_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
INTERMITTENCY_CONFIRMED=SI
UNDERLYING_CAUSE_CONFIRMED=NO
ANDROID_PUSH_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
ANDROID_RELIABILITY_REPEAT_COUNT_AUTHORITY=NINGUNA_ENCONTRADA (propuesto: 3 ciclos consecutivos de creación física genuina, ver reporte)
```

Auditoría de código (`unsubscribe()`) confirma
`ANDROID_OFF_REMOVES_PHYSICAL_SUBSCRIPTION=NO` —
`ANDROID_OFF_TOGGLE_IS_NOT_A_VALID_PHYSICAL_CREATE_REPEAT` queda
registrado como invariante permanente en `DECISIONS_AND_INVARIANTS.md`.
No se afirma `BUG_FIXED`/`ROOT_CAUSE_FIXED`/`FIX_VERIFIED` en ningún
registro — no hubo fix funcional. Android NO se certifica. Ver
`P2_T31_R12B_ANDROID_FAIL_PASS_RECONCILIATION_AND_RELIABILITY_GATE.md`
para el detalle completo, incluido el gate de repetibilidad propuesto y
el orden mínimo de casos Android pendientes tras resolverlo.

## P2-T31-R12A-ANDROID-PHYSICAL-SUBSCRIBE-DIAGNOSTICS-TESTING-DEPLOY — 2026-09-06 (gate desplegado, vigente — evidencia física reconciliada por R12B arriba)

El mismo gate de 574 tests (ver entrada de abajo) fue re-ejecutado
fresco inmediatamente antes de stagear/commitear, sin cambios de
resultado: **574 pass / 0 fail**. Este es el gate que corresponde al
código REALMENTE desplegado en TESTING — commit
`085cc0b540f51a841115697eb25dbf98d3740023`, deployment `13800b1d`,
confirmado `SUCCESS` con commit hash exacto. ESLint sobre los 5 archivos
exactos del commit: 0 errores. TypeScript: medición fresca `24 raw / 19
distinct`, idéntica a la de R12 (confirma estabilidad), `NEW_TYPECHECK_
ERRORS=0`.

Antes de commitear se corrigió una imprecisión factual de R12: la traza
física original SÍ incluía `actorFamily=cliente`/`authHasHydrated=true`
en `SUBSCRIBE_START`. Auditoría de `auth-store.ts` (`AuthUser.id`/`.type`
asignados atómicamente en el mismo objeto literal en las 4 acciones de
login) prueba que esto hace estructuralmente imposible que `actorKey`
fuera nulo por hidratación transitoria en este incidente —
`CAN_ACTOR_FAMILY_CLIENTE_COEXIST_WITH_NULL_ACTOR_KEY=NO`. La conexión
que R12 había propuesto entre este fallo Android y `AUTH_HYDRATION_
PUSH_RACE` queda descartada para este incidente específico (sin
reclasificar ese hallazgo en sí). `R2_REGISTRY_CAUSE_CURRENTLY=
UNRESOLVED_PENDING_NEW_TRACE` — no se inventó una hipótesis de
reemplazo. `ROOT_CAUSE_STATUS` se mantiene exactamente como máximo
`NOT_CONCLUSIVELY_PROVEN_LEADING_HYPOTHESIS_IDENTIFIED`. Ver
`P2_T31_R12A_ANDROID_DIAGNOSTICS_TESTING_DEPLOY_PENDING_PHYSICAL_RETEST.md`
para el detalle completo.

## P2-T31-R12-ANDROID-FIRST-SUBSCRIBE-PHYSICAL-CREATION-FAILURE-DIAGNOSTIC — 2026-09-06 (diagnóstico local — desplegado por R12A, corrección factual aplicada arriba)

**Nota de lectura**: R12 es diagnóstico puro — cero cambio de
comportamiento en subscribe()/unsubscribe()/status, sólo instrumentación
de traza adicional (`SUBSCRIBE_PHYSICAL_CREATE_START/RESULT/ERROR`,
`MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/WAIT_NOT_FOUND`) alrededor del
único punto que una traza física Android probó indocumentado. 551
(baseline R8, desplegado) + 23 (nuevos R12: 8 en
`push-mutation-in-flight-registry.test.ts`, 1 en
`use-push-notifications-static-contract.test.ts`, 8 en el archivo nuevo
`use-push-notifications-physical-subscribe-create-trace.test.ts`, resto
por reconteo de expects/describes) = **574 pass / 0 fail** — código LOCAL,
NO commiteado/desplegado (TESTING sigue sirviendo `70d3f826...`, sin R12).

```
bun test <25 archivos del gate focal R8 + 3 nuevos/modificados R12 relevantes>

 574 pass / 0 fail / 1468 expect() calls / 29 files
```

`R12_FOCAL_PASS=574`, `R12_FOCAL_FAIL=0`. ESLint sobre los 5 archivos
exactos tocados: 0 errores (exit 0). TypeScript: medición fresca de esta
tarea da `24 raw / 19 distinct` — ninguno de los diagnósticos actuales
menciona ningún archivo tocado por R12 (confirmado por inspección
directa de la lista completa), por lo que `NEW_TYPECHECK_ERRORS=0` es
una conclusión verificada por ausencia directa, no por comparación
numérica de totales (que difiere del histórico `31 raw/24 distinct`
registrado en tareas anteriores por razones no investigadas en esta
tarea — no causadas por ella). Ver
`P2_T31_R12_ANDROID_FIRST_SUBSCRIBE_PHYSICAL_CREATION_FAILURE_DIAGNOSTIC.md`
§17-18 para el detalle completo.

`ANDROID_PUSH_STATUS=FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE`
(ya no `UNKNOWN_NOT_CERTIFIED`) — causa raíz NO probada
concluyentemente (hipótesis líder: `PushManager.subscribe()` nunca se
asentó durante la ventana observada, más consistente con backgrounding
de Android suspendiendo ese await nativo); ningún fix de comportamiento
implementado, sólo instrumentación para el próximo capture.
`IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING` preservado
sin cambios.

## P2-T31-R11-MULTIROLE-PHYSICAL-SCOPE-AUTHORITY-CORRECTION — 2026-09-06 (corrección de autoridad, P2-T31 reabierto)

Auditoría de autoridad (sin tests nuevos, sin cambio al gate de 551).
Determina que `P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`
exigía en lenguaje imperativo evidencia física de los TRES roles
(Cliente C1-C8, Negocio N1-N7, Repartidor R1-R7) para el cierre de
P2-T31, sin ninguna cláusula de excepción por código/tests compartidos.
El cierre `CLOSED_TESTING_CERTIFIED` que R10 declaró usando sólo la
certificación de Cliente fue, por tanto, prematuro para el alcance
GLOBAL de P2-T31 (aunque válido y preservado para Cliente):

```text
ORIGINAL_T31_PHYSICAL_MATRIX_SCOPE=ALL_THREE_ROLES_CLIENTE_NEGOCIO_REPARTIDOR_MANDATORY
SHARED_IMPLEMENTATION_CAN_REPLACE_REQUIRED_PHYSICAL_ROLE_MATRIX=NO
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
BUSINESS_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED_FORMALLY
DELIVERY_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
```

Detalle completo, incluida la matriz N1-N7/R1-R7 propuesta y las
instrucciones exactas para Leonardo, en
`P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md`.

## P2-T31-R10-IPHONE-CERTIFICATION-FINAL-CLOSEOUT — 2026-09-06 (evidencia física final — cierre Cliente válido, cierre GLOBAL corregido por R11 arriba)

Tarea de audit final — no ejecutó tests, no cambió el gate de 551 tests
vigente (sigue siendo la autoridad correspondiente a `70d3f826...`).
Registra la evidencia física final que cierra el único gate que R9 había
dejado pendiente:

```text
C1_CLEAN_FIRST_ENABLE=PASS
C1_NATIVE_PERMISSION_PROMPT=SI
C1_PERMISSION_ACCEPTED=SI
C1_ACTIVATION=PASS
C1_FINAL_SWITCH=ON
C1_SUCCESS_FEEDBACK=PASS
C1_COLD_REOPEN=ON
IPHONE_CLIENT_PUSH_MATRIX=C1_THROUGH_C8_PASS
IPHONE_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (alcance: Cliente, TESTING)
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
```

Esta evidencia física NO fue convertida en ningún test automatizado
nuevo — sigue siendo evidencia de campo, registrada como tal, sin
alterar el gate de 551 tests. Detalle completo en
`P2_T31_R10_IPHONE_CERTIFICATION_FINAL_CLOSEOUT.md`.

## P2-T31-R9-IPHONE-PHYSICAL-CERTIFICATION-RECONCILIATION — 2026-09-06 (audit de evidencia, sin cambios de gate)

Tarea puramente de auditoría/reconciliación — no ejecutó tests, no
cambió código, no modificó el gate de 551 tests vigente (sigue siendo la
autoridad correspondiente a `70d3f826...`, ver entrada de abajo). Su
único aporte a esta autoridad es documental: confirma por auditoría
directa que `TEST_AUTHORITY.md` **nunca definió una forma exacta
obligatoria distinta** para C2 (permitiendo que la evidencia de stress
R8 física, más fuerte, cubra el caso de "toggle rápido simple") y que
**nunca existió, ni fue autorizada, ninguna equivalencia para C1**
(primera activación real desde estado limpio) — el caso fue diferido
explícitamente desde `P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`
(`PERMISSION_PROMPT_PHYSICAL_CASE=DEFERRED_NOT_SAFELY_REPRODUCIBLE`) y
nunca resuelto en ningún reporte posterior. Por tanto:

```text
C1_PHYSICAL_GATE_STATUS=REQUIRED_NOT_YET_SATISFIED_ON_CURRENT_BUILD
C2_PHYSICAL_GATE_EQUIVALENCE=STRONGER_EVIDENCE_ACCEPTED_R8_STRESS_COVERS_SIMPLE_TOGGLE
IPHONE_PUSH_CERTIFICATION_STATUS=PARTIAL_PENDING_C1_CLEAN_FIRST_ENABLE
P2_T31_STATUS=IN_PROGRESS_PENDING_C1_CLEAN_FIRST_ENABLE
```

Detalle completo del audit en
`P2_T31_R9_IPHONE_PHYSICAL_CERTIFICATION_RECONCILIATION.md`.

## P2-T31-R8-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST — 2026-09-06 (gate desplegado, vigente)

El mismo gate de 551 tests (ver entrada de abajo) fue re-ejecutado
inmediatamente antes de stagear/commitear, sin cambios de resultado:
**551 pass / 0 fail**. Este es el gate que corresponde al código
REALMENTE desplegado en TESTING — commit `70d3f826bef291f403f0e42e007187eb1b5d6688`,
deployment `58f4e0a3`, confirmado `SUCCESS` con commit hash exacto.
ESLint sobre los 15 archivos exactos del commit: 0 errores. TypeScript:
`24/24`, `NEW_TYPECHECK_ERRORS=0`.

## P2-T31-R8-PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX — 2026-09-06 (gate vigente, NO desplegado)

**Nota de lectura**: R8 es un FIX funcional de dos partes — (A) divide el
rate limiter Push en `pushStatus`/`pushMutation` independientes, (B)
corrige la semántica de error de status (un backend no-ok, incluido 429,
ya no se representa como OFF confirmado) + mensajes de mutación fallida
más claros. 512 (baseline R7, desplegado) + 39 (nuevos R8, SÓLO LOCAL) =
**551 pass / 0 fail** — código LOCAL, todavía no committeado/desplegado
(TESTING sigue sirviendo el commit `6380ba2`, sin el fix de R8).

```
bun test <25 archivos del gate focal R7 + 4 nuevos R8>

 551 pass / 0 fail / 1427 expect() calls / 27 files
```

`R8_FOCAL_PASS=551`, `R8_FOCAL_FAIL=0`. TypeScript: `24/24`,
`NEW_TYPECHECK_ERRORS=0`. Cobertura nueva destacada: `rate-limit-push.test.ts`
(12 tests contra el `checkRateLimit` REAL, sin mocks — human-stress vs
abuso, buckets independientes, Retry-After) y el describe "P2-T31-R8 —
status errors never resolve to a false conclusion" en
`push-personal-status-check.test.ts` (8 tests, reproduce la secuencia
exacta de la traza física). Ver
`P2_T31_R8_PUSH_RATE_LIMIT_429_STATE_CONSISTENCY_FIX.md` §11-13 para el
detalle completo.

## P2-T31-R7-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST — 2026-09-06 (gate desplegado, vigente)

**Nota de lectura**: R7 es un FIX funcional (no sólo instrumentación) —
agrega `statusResolved` al hook y lo consume en las 3 UI, más 2
correcciones de higiene de debug. 473 (baseline R6B) + 39 (nuevos R7) =
**512 pass / 0 fail** — este gate corresponde al código REALMENTE
desplegado en TESTING: commit `6380ba2b77ffe6bee1b978ef1e2480da233e61c2`,
deployment `41124f04-f69b-4a51-8b9d-7da562c8b6e1`, confirmado `SUCCESS`
con commit hash exacto. ESLint sobre los 14 archivos exactos del commit:
0 errores. TypeScript: `24/24`, `NEW_TYPECHECK_ERRORS=0`.

```
bun test \
  <23 archivos del gate focal R6B> \
  src/hooks/use-push-notifications-status-resolved.test.ts \
  src/components/shared/push-initial-unknown-state-contract.test.ts

 512 pass / 0 fail / 1141 expect() calls / 25 files
```

`R7_FOCAL_PASS=512`, `R7_FOCAL_FAIL=0`. TypeScript: `24/24`,
`NEW_TYPECHECK_ERRORS=0` (se detectó y corrigió 1 error nuevo transitorio
por un flag de regex no soportado en un test propio, antes de esta
medición final). Ver
`P2_T31_R7_PUSH_INITIAL_UNKNOWN_STATE_FLICKER_FIX.md` §13-14 para el
detalle completo de los 39 tests nuevos.

## P2-T31-R6B-TESTING-DIAGNOSTIC-DEPLOY — 2026-09-05 (gate desplegado, vigente)

El mismo gate de 473 tests (ver entrada de abajo) fue re-ejecutado
inmediatamente antes de stagear/commitear, sin cambios de resultado:
**473 pass / 0 fail**. Este es el gate que corresponde al código
REALMENTE desplegado en TESTING — commit `925a86017a5e7546f0a6f82245c9d5fc1d344776`,
deployment `85fc4026`, confirmado `SUCCESS` con commit hash exacto.
ESLint sobre los 24 archivos exactos del commit: 0 errores. TypeScript:
`24/24`, `NEW_TYPECHECK_ERRORS=0`.

## P2-T31-R6B-STANDALONE-PWA-DEBUG-ACCESS-AND-COLD-BOOTSTRAP — 2026-09-05 (gate vigente)

**Nota de lectura**: R6B reestructura la visibilidad del panel (gate único
= guard confirmado, independiente del query param) y agrega el bootstrap
de cold-launch — nunca toca el algoritmo de subscribe/unsubscribe/status.
393 (R6) + 58 (R6A) + 22 (R6B: 9 nuevos en `push-debug-panel-static-
contract.test.ts` + 13 nuevos en `push-debug-trace-bootstrap-static-
contract.test.ts`) = **473 pass / 0 fail**, el gate MÁS RECIENTE.

```
bun test \
  src/lib/push-subscription-key.test.ts \
  src/hooks/use-push-notifications-static-contract.test.ts \
  src/hooks/push-personal-status-check.test.ts \
  src/hooks/push-mutation-in-flight-registry.test.ts \
  src/hooks/use-operativo-salon-push.test.ts \
  "src/app/mozo/panel/[slug]/push-static-contract.test.ts" \
  src/components/shared/permission-prompt-static-contract.test.ts \
  src/components/client/client-profile-panel-push-static-contract.test.ts \
  src/components/business/config-tab-push-static-contract.test.ts \
  src/components/repartidor/profile-tab-push-static-contract.test.ts \
  src/components/business/config-tab.test.tsx \
  src/app/api/push/status/route.test.ts \
  src/app/api/push/subscribe/route.test.ts \
  src/app/api/push/unsubscribe/route.test.ts \
  src/lib/push.test.ts \
  src/lib/push-subscription-repository.test.ts \
  src/lib/push-subscription-http.test.ts \
  src/lib/push-testing-guard.test.ts \
  src/app/api/push/debug-guard/route.test.ts \
  src/lib/push-debug-snapshot.test.ts \
  src/components/shared/push-debug-panel-static-contract.test.ts \
  src/lib/push-debug-trace.test.ts \
  src/components/shared/push-debug-trace-bootstrap-static-contract.test.ts

 473 pass / 0 fail / 1052 expect() calls / 23 files
```

`R6B_FOCAL_PASS=473`, `R6B_FOCAL_FAIL=0`. TypeScript: `24/24`,
`NEW_TYPECHECK_ERRORS=0`. No desplegado — sólo local. Fileset acumulado
real (no narrativo): 12 tracked modificados, 15 nuevos intencionales, 27
total — ver `P2_T31_R6B_STANDALONE_PWA_DEBUG_ACCESS_AND_COLD_BOOTSTRAP.md`
§17 para el detalle exacto y §14-16 para el detalle de tests/tipos.

## P2-T31-R6A-PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC — 2026-09-05 (gate vigente)

**Nota de lectura**: R6A agrega instrumentación de timeline (nunca toca el
algoritmo de subscribe/unsubscribe/status) sobre el gate de R6 — 393
(baseline) + 58 (nuevos: `push-debug-trace.test.ts` completo, wiring de
`trace` en `push-personal-status-check.test.ts`, wiring en
`use-push-notifications-static-contract.test.ts`, timeline/arm/disarm en
`push-debug-panel-static-contract.test.ts`) = **451 pass / 0 fail**, el gate
MÁS RECIENTE.

```
bun test \
  src/lib/push-subscription-key.test.ts \
  src/hooks/use-push-notifications-static-contract.test.ts \
  src/hooks/push-personal-status-check.test.ts \
  src/hooks/push-mutation-in-flight-registry.test.ts \
  src/hooks/use-operativo-salon-push.test.ts \
  "src/app/mozo/panel/[slug]/push-static-contract.test.ts" \
  src/components/shared/permission-prompt-static-contract.test.ts \
  src/components/client/client-profile-panel-push-static-contract.test.ts \
  src/components/business/config-tab-push-static-contract.test.ts \
  src/components/repartidor/profile-tab-push-static-contract.test.ts \
  src/components/business/config-tab.test.tsx \
  src/app/api/push/status/route.test.ts \
  src/app/api/push/subscribe/route.test.ts \
  src/app/api/push/unsubscribe/route.test.ts \
  src/lib/push.test.ts \
  src/lib/push-subscription-repository.test.ts \
  src/lib/push-subscription-http.test.ts \
  src/lib/push-testing-guard.test.ts \
  src/app/api/push/debug-guard/route.test.ts \
  src/lib/push-debug-snapshot.test.ts \
  src/components/shared/push-debug-panel-static-contract.test.ts \
  src/lib/push-debug-trace.test.ts

 451 pass / 0 fail / 1002 expect() calls / 22 files
```

`R6A_FOCAL_PASS=451`, `R6A_FOCAL_FAIL=0`. TypeScript: `24/24`,
`NEW_TYPECHECK_ERRORS=0`. No desplegado — sólo local. Detalle completo en
`P2_T31_R6A_PUSH_LIFECYCLE_TIMELINE_DIAGNOSTIC.md` §14-16.

## P2-T31-R6-INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC — 2026-09-05 (gate vigente)

**Nota de lectura**: R6 agrega instrumentación de diagnóstico pura (nunca
toca el algoritmo de subscribe/unsubscribe/status) sobre el gate de R5A —
341 (baseline) + 52 (nuevos: guard TESTING, ruta debug-guard, accessor
read-only del registry, colector puro de snapshot, contrato estático del
panel) = **393 pass / 0 fail**, el gate MÁS RECIENTE.

```
bun test \
  src/lib/push-subscription-key.test.ts \
  src/hooks/use-push-notifications-static-contract.test.ts \
  src/hooks/push-personal-status-check.test.ts \
  src/hooks/push-mutation-in-flight-registry.test.ts \
  src/hooks/use-operativo-salon-push.test.ts \
  "src/app/mozo/panel/[slug]/push-static-contract.test.ts" \
  src/components/shared/permission-prompt-static-contract.test.ts \
  src/components/client/client-profile-panel-push-static-contract.test.ts \
  src/components/business/config-tab-push-static-contract.test.ts \
  src/components/repartidor/profile-tab-push-static-contract.test.ts \
  src/components/business/config-tab.test.tsx \
  src/app/api/push/status/route.test.ts \
  src/app/api/push/subscribe/route.test.ts \
  src/app/api/push/unsubscribe/route.test.ts \
  src/lib/push.test.ts \
  src/lib/push-subscription-repository.test.ts \
  src/lib/push-subscription-http.test.ts \
  src/lib/push-testing-guard.test.ts \
  src/app/api/push/debug-guard/route.test.ts \
  src/lib/push-debug-snapshot.test.ts \
  src/components/shared/push-debug-panel-static-contract.test.ts

 393 pass / 0 fail / 868 expect() calls / 21 files
```

`R6_FOCAL_PASS=393`, `R6_FOCAL_FAIL=0`. TypeScript: `24/24`, `NEW_TYPECHECK_ERRORS=0`.
No desplegado — sólo local. Detalle completo en
`P2_T31_R6_INTERMITTENT_IPHONE_PUSH_LIFECYCLE_DIAGNOSTIC.md` §14-16.

## Reconciliación 2026-09-05 — P2-T25/T26/T28/T31 (gate más reciente de cada cadena)

**Nota de lectura**: las ejecuciones de P2-T31 (R1/predeploy/R2/R3/R4/R5/R5A/deploy)
son corridas SOLAPADAS de un conjunto de tests creciente sobre el MISMO
código en evolución — no se suman entre sí como si fueran suites distintas.
El gate vigente hoy es el MÁS RECIENTE: **341 pass / 0 fail** (R5A).

```
P2-T25 (Order Creation Abuse Resistance):
  Autoridad final: codex-reports/P2_T25_R2_TESTING_DEPLOY_CERTIFICATION.md
  Gates relevantes: rate-limit buckets (3 independientes), idempotency
  replay, concurrent same-key lock, foreign-lock-release fix (R2C) —
  todos certificados contra TESTING desplegado (commit 1b69ee8).

P2-T28 (Order State Lock Ownership Hardening):
  Autoridad final: codex-reports/P2_T28_TESTING_DEPLOY_CERTIFICATION.md
  Tests A/B/C/D determinísticos vía seam PATCH_FOR_TESTS — NO_BUG
  confirmado empíricamente, test permanente de regresión agregado,
  certificado contra TESTING desplegado (commit 913d20e).

P2-T26 (SuperAdmin Notifications E2E):
  Autoridad final: codex-reports/P2_T26_TESTING_DEPLOY_CERTIFICATION.md
  6/6 categorías de notificación certificadas con trigger runtime
  explícito contra TESTING desplegado (commit 642da15) — incluida la
  certificación diferida de "review_moderation información adicional"
  en R2C.

P2-T31 (Notification Switch + Web Push):
  R1  (switch-state fix, commiteado 989785a):            60/60 focal + 253/253 push-regression predeploy
  R2  (cross-remount in-flight registry, commit a8ac961): 288/288
  R3  (VAPID stale audit, commit a8ac961):                 301/301
  R4  (architecture conformance audit, sin cambios de código): 67/67 (recheck de regresión, no una suite nueva)
  R5  (VAPID validation portada a 3 superficies más, commit a8ac961): 326/326
  R5A (failure-contract hardening, commit a8ac961, ACTUAL): 341/341
  Deploy TESTING (DeliGO Copy): SUCCESS, commit exacto a8ac961, pendiente iPhone físico

P2_T31_LATEST_FOCAL=341_PASS_0_FAIL
TYPECHECK_CURRENT_BASELINE=24 (bajó de 26 a 24 por una mejora incidental de R5A al castear un patrón ya usado en 2 archivos que antes no lo casteaban — no buscada deliberadamente, documentada en el reporte de R5A)
NEW_TYPECHECK_ERRORS_SINCE_R1=0 (en cada etapa R2->R5A)
ESLINT=limpio en todas las etapas R1->R5A y sobre el fileset de deploy, sin excepciones
P2_T31_TECHNICAL_STATUS=DEPLOYED_TESTING_PENDING_IPHONE_PHYSICAL_CERTIFICATION
IPHONE_PHYSICAL_CERTIFICATION_STATUS=PENDING_LEONARDO
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
TESTING_DEPLOYMENT_ID=e18111b1-fc25-4697-8ec5-475067ad3ab1
TESTING_DEPLOY_COMMIT=a8ac961bd81ee505297f81787c1cf32e3f4cd161
```

Detalle completo de cada gate (comandos exactos, archivos ejecutados,
mensajes de log de rutas de fallo simuladas deliberadas) en los reportes
individuales: `codex-reports/P2_T31_NOTIFICATION_SWITCH_PERSISTENCE_STATE_SYNC_R1.md`,
`.../P2_T31_R2_FIRST_SUBSCRIBE_REMOUNT_STATE.md`, `.../P2_T31_R3_ANDROID_WEB_PUSH_DELIVERY_CROSS_ENV_AUDIT.md`,
`.../P2_T31_R4_WEB_PUSH_REFERENCE_ARCHITECTURE_CONFORMANCE_AUDIT.md`,
`.../P2_T31_R5_VAPID_STALE_SUBSCRIPTION_VALIDATION_EXTENSION.md`,
`.../P2_T31_R5A_PUSH_SUBSCRIPTION_FAILURE_CONTRACT_HARDENING.md`.

## PRODUCTION-SYNC-R6-R0 — 2026-08-30

La autoridad de R6-R0 es `codex-reports/PRODUCTION_SYNC_R6_R0.md`. El backup
post-27 fue creado con `pg_dump` 18.6, pasó `pg_restore --list` y restore
completo en scratch 18.6: 27/27/0, target presente/columna ausente, schema
47/514/102/139 y agregados coincidentes. Scratch detenido y eliminado.

Production `prisma migrate status` quedó up to date en 27/27/0. Health checks
de DeliGO/chat pasaron; el probe POST no autenticado de cleanup dio 404 por
ausencia de `CLEANUP_SECRET`. Review/Mesa fueron auditados sin ejecutar sus
runners ni mutar Railway. Scheduler externo de cleanup: no probado.

## PRODUCTION-SYNC-R5 — 2026-08-29

La autoridad de certificación post-R5 es `codex-reports/PRODUCTION_SYNC_R5.md`.
La ejecución autorizada terminó con exit 0 y sin retry. `prisma migrate status`
reportó el schema actualizado; Production quedó en 27/27/0, con la tabla
`terminales_salon` presente y la columna `pushSubscription` ausente. El
fingerprint post-27 es 47/514/102/139 y los agregados 16/6/22/144/43 coinciden
con el estado pre-R5.

DeliGO y chat pasaron logs y smoke checks post-R5; no se observó error de
migración, unknown column ni boot loop. Git y deployments no cambiaron.

## PRODUCTION-SYNC-R5-R0-R1 — 2026-08-29

`pg_dump`, `pg_restore`, `initdb` y `postgres` 18.6 fueron verificados. El
dump custom pasó `pg_restore --list` y restore completo en scratch 18.6 con
exit 0: 26/26/0 migraciones, #27 única pendiente, target presente, schema
47/515/102/139 y agregados coincidentes. Scratch detenido y eliminado.

Production final: 18.6, 26/0/1, #27 pendiente, `pushSubscription` presente,
sin escritura, migración ni deployment. R5 queda listo, no ejecutado.

## PRODUCTION-SYNC-R5-R0 — 2026-08-29

Git mantiene HEAD, `origin/main` y `origin/testing-codex` en
`c05525a5e0419922a484fbe6cb25c8604b8ca313`, con tracked/staged clean. Production
es PostgreSQL 18.6 y conserva 26 migraciones exitosas, 0 fallidas, #27 única
pendiente y `pushSubscription` presente. Los conteos de referencia son
47/515/102/139 y los agregados fueron capturados sin PII.

El gate de tooling falla de forma explícita: no hay `pg_dump`/`pg_restore` 18
ni Docker/Podman; PostgreSQL 12 existe pero no fue usado. Por tanto no hay
backup, hash, restore ni scratch que certificar.

## PRODUCTION-SYNC-R4-R2-R2 — 2026-08-29

Git confirma HEAD, `origin/main` y `origin/testing-codex` iguales al commit
certificado, con worktree tracked/staged limpio. DeliGO y chat Production
reportan `SUCCESS` sobre ese commit. DeliGO build/deploy logs y smoke
`https://deligo.ar/` pasaron; chat logs y
`https://harmonious-empathy.up.railway.app/health` HTTP 200 pasaron.

La DB read-only final confirma 26 migraciones exitosas, 0 fallidas, exactamente
`20260826230000_drop_terminal_operativa_push_subscription` pendiente y
`terminales_salon.pushSubscription` presente. No hubo escritura, migración ni
activación de predeploy. R5 queda listo pero no ejecutado.

## PRODUCTION-SYNC-R4-R2-R1 — 2026-08-29

Pasaron `git diff --check`, `bun run build`, la suite `chat-service` 98/98 y
`npm start` con `/health` HTTP 200. Tras el único push, DeliGO desplegó el
commit exacto `c05525a5e0419922a484fbe6cb25c8604b8ca313` con estado `SUCCESS`;
los logs de build/deploy no muestran migración, DROP, boot loop ni error fatal,
y `https://deligo.ar/` respondió HTTP 200. El chat no llegó a deployment
porque su branch-only source mutation quedó bloqueada para UI manual.

La pre-verificación DB fue 26 exitosas, 0 fallidas, 1 pendiente
(`20260826230000_drop_terminal_operativa_push_subscription`) y
`pushSubscription=PRESENT`. La post-verificación conjunta no se ejecutó al no
alcanzarse el segundo servicio; no hubo escritura ni migración destructiva.

## PRODUCTION-SYNC-R4-R2 — 2026-08-29

`git diff --check`, `bun run build`, la suite de `chat-service` (98/98) y
`npm start` con `/health` 200 pasaron. El pre-push gate quedó bloqueado por
una discrepancia viva de variables: las tres `PRIVATE_EVIDENCE_CLOUDINARY_*`
aparecen ausentes en DeliGO Production. No se ejecutaron push, deploy, logs ni
smoke Production.

## PRODUCTION-SYNC-R4-R1 — 2026-08-29

La autoridad fresca confirma Git sin cambios, 26 migraciones Production
finalizadas, cero fallidas/revertidas, #27 pendiente y
`terminales_salon.pushSubscription` presente. El routing interno Production→Production
pasó y quedó escrito sin deploy. Cloudinary privado no está certificado porque
faltan las tres variables exactas y requieren acción manual; branch/root de
chat siguen limitados por metadata. No se ejecutaron build, push, deploy,
logs ni smoke Production.

## PRODUCTION-SYNC-R4 — 2026-08-29

La autoridad fresca confirma Production en 26 migraciones finalizadas, cero
fallidas/revertidas, #27 pendiente y `terminales_salon.pushSubscription`
presente. El gate de variables/fuente quedó bloqueado antes del push; no se
ejecutó build local, deploy, logs ni smoke porque el pre-push gate no pasó.
Detalle: `codex-reports/PRODUCTION_SYNC_R4.md`.

## PRODUCTION-SYNC-R3-R3-R1 — 2026-08-29

La autoridad de ejecución confirma patch certificado aplicado, baseline
`0_init`, bundle 26/26 exacto, historial 26/26 exitoso, único pendiente #27,
fingerprint post-26 47/515/102/139 y target `pushSubscription` preservado.
Detalle completo: `codex-reports/PRODUCTION_SYNC_R3_R3_R1.md`.

Autoridad vigente de pruebas para el workstream Push (P2-T05). Distingue
CURRENT (vigente, usar para cualquier gate futuro) de HISTORICAL (contexto,
nunca usar como autoridad de ejecución).

## PRODUCTION-SYNC-R3-R3 — 2026-08-29

Los gates read-only de identidad, backup aceptado, huella parcial, hash
certificado y precondiciones de datos pasaron. La Fase A no se ejecutó porque
la invocación de `psql` ignoró el archivo SQL; no existe resultado de migración
que certificar. Evidencia: `codex-reports/PRODUCTION_SYNC_R3_R3.md`.

## PRODUCTION-SYNC-R3-R2-R1 DATABASE AUTHORITY — 2026-08-29

La autoridad vigente de esta etapa es `codex-reports/PRODUCTION_SYNC_R3_R2_R1.md`:
completion scratch semánticamente exacta, baseline, 26 migraciones exitosas y
únicamente #27 pendiente. Ninguna de estas escrituras ocurrió en Production.

## PRODUCTION-SYNC-R3-R2 DATABASE AUTHORITY — 2026-08-29

La autoridad read-only de esta etapa es `codex-reports/PRODUCTION_SYNC_R3_R2.md`.
Confirma 36/399 en `0_init` frente a 31/352 en Production y bloquea la
completion exacta porque falta `empleados.cuentaOperativaId` en una tabla
existente. No se ejecutó ningún gate de migración sobre Production ni scratch
después de confirmar ese bloqueo.

## CURRENT AUTHORITY

## PRODUCTION-SYNC-R3 UPDATE — 2026-08-29

No product/test authority was changed. R3 stopped before database migration,
code deployment, or test/schema mutation; the blocker is the Production
Prisma baseline (`0_init`), not a test result.

R3-R1 tampoco modificó ninguna autoridad de producto o tests; el bloqueo se
confirmó mediante catálogo PostgreSQL de solo lectura.

### Modelo de regresión Push vigente

```
MODEL=CURRENT_SAFE_PUSH_UNION_34_FILES_ISOLATED_PER_PROCESS
FILE_COUNT=34
PASS_COUNT=523
FAIL_COUNT=0
ERROR_COUNT=0
CURRENT_CORRECTION=F22_RESET_ISOLATION_CORRECTION_POSTAMEND_CERTIFIED
HISTORICAL_PRE_CORRECTION_PASS_COUNT=522
CURRENT_POSTAMEND_PASS_COUNT=523
CURRENT_POSTAMEND_FAIL_COUNT=0
CURRENT_POSTAMEND_ERROR_COUNT=0
POST_AMEND_FULL_34_FILE_RECERTIFICATION=PASS
POST_AMEND_34_ISOLATED=523 pass / 0 fail / 0 error
POST_AMEND_34_COMBINED_NORMAL=523 pass / 0 fail / 0 error
POST_AMEND_34_COMBINED_REVERSED=523 pass / 0 fail / 0 error
```

Este modelo se mantiene vigente tras la corrección local H4/F22 — la
autoridad histórica pre-corrección de 522 se conserva explícitamente arriba.
La corrección agregó un regression test determinístico y demostró que los 34 pueden correr determinísticamente
en una sola invocación combinada (normal e invertida), pero el modelo de
"aislado por proceso" sigue siendo válido como sanity de cobertura de
referencia.

### Listado LITERAL vigente de los 34 archivos (orden canónico)

Reconstruido por criterio de contenido explícito (identificadores del
dominio Push, imports relativos a `./push`, carga de `public/sw.js`) más
revisión manual de falsos positivos/negativos — ver
`codex-reports/archive/LEGACY_FULL_REPORT_20260826.md` sección
`## H3B — PRE-COMMIT COMPLETION` para la derivación completa.

```
1.  src/app/api/chat/mensajes/[pedidoId]/route.test.ts
2.  src/app/api/mozo/push/subscribe/route.test.ts
3.  src/app/api/mozo/push/unsubscribe/route.test.ts
4.  src/app/api/operaciones/pyr/mensajes/[pedidoId]/adjunto/route.test.ts
5.  src/app/api/operaciones/pyr/mensajes/[pedidoId]/route.test.ts
6.  src/app/api/operativo/logout/route.test.ts
7.  src/app/api/operativo/mozo/panel/[slug]/push-subscription/route.test.ts
8.  src/app/api/operativo/pyr/pedidos/[id]/mensajes/route.test.ts
9.  src/app/api/operativo/salon/panel/[slug]/push-subscription/route.test.ts
10. src/app/api/push/status/route.test.ts
11. src/app/api/push/subscribe/route.test.ts
12. src/app/api/push/unsubscribe/route.test.ts
13. src/app/m/[token]/push-unsubscribe-static-contract.test.ts
14. src/components/client/client-profile-panel-push-static-contract.test.ts
15. src/components/shared/permission-prompt-static-contract.test.ts
16. src/hooks/push-operation-guard.test.ts
17. src/hooks/push-personal-status-check.test.ts
18. src/hooks/use-push-notifications-static-contract.test.ts
19. src/lib/chat-message-push-identity.test.ts
20. src/lib/chat-push-dedupe-bridge.test.ts
21. src/lib/chat-push-presentation.test.ts
22. src/lib/client-account-deletion.test.ts
23. src/lib/mesa-order-ready-notification.test.ts
24. src/lib/non-api-safe-error-logging-static-contract.test.ts
25. src/lib/operations-cancellation-notification.test.ts
26. src/lib/operations-cancellation-push.test.ts
27. src/lib/operativo-logout-wiring-static-contract.test.ts
28. src/lib/operativo-logout.test.ts
29. src/lib/push-log-sanitization.test.ts
30. src/lib/push-subscription-http.test.ts
31. src/lib/push-subscription-repository.test.ts
32. src/lib/push.test.ts
33. src/lib/salon-new-order-notification.test.ts
34. src/lib/sw-push-dedupe.test.ts
```

Excluye explícitamente cualquier `*.integration.test.ts` (requieren DB) —
nunca deben mezclarse en este union salvo tarea explícita que autorice DB
real.

### H4 (F22) — combined run authority

```
HISTORICAL_PRE_CORRECTION_H4_7_FILE_COMBINED_NORMAL=123 pass / 0 fail / 0 error
HISTORICAL_PRE_CORRECTION_H4_7_FILE_COMBINED_REVERSED=123 pass / 0 fail / 0 error
HISTORICAL_PRE_CORRECTION_H4_34_FILE_COMBINED_NORMAL=522 pass / 0 fail / 0 error
HISTORICAL_PRE_CORRECTION_H4_34_FILE_COMBINED_REVERSED=522 pass / 0 fail / 0 error
CURRENT_CORRECTION_H4_7_FILE_COMBINED_NORMAL=124 pass / 0 fail / 0 error
CURRENT_CORRECTION_H4_7_FILE_COMBINED_REVERSED=124 pass / 0 fail / 0 error
CURRENT_CORRECTION_H4_34_FILE_COMBINED_NORMAL=523 pass / 0 fail / 0 error
CURRENT_CORRECTION_H4_34_FILE_COMBINED_REVERSED=523 pass / 0 fail / 0 error
H4_CORRECTION_COMBINED_ORDER_INDEPENDENCE=PASS
```

Los 34 archivos ahora pueden ejecutarse tanto aislados por proceso COMO en
una sola invocación combinada (cualquier orden) sin exclusiones. Ambos
modelos son válidos; el combinado es el gate objetivo de F22 y demuestra
que la causa raíz (colisión process-global de `mock.module("@/lib/auth")`)
quedó eliminada, no sólo evitada por aislamiento.

### TSC baseline vigente

```
TSC_CURRENT_RAW_DIAGNOSTIC_COUNT=31
TSC_CURRENT_DISTINCT_DIAGNOSTIC_COUNT=24
TSC_BASELINE_IDENTITY_STATUS=UNRESOLVED_LIMITED
TSC_H4_CORRECTION_NEW_DIAGNOSTICS=0
POST_AMEND_FULL_34_FILE_RECERTIFICATION=PASS
POST_AMEND_QUICK_GATE_7_FILE_NORMAL=124 pass / 0 fail / 0 error
POST_AMEND_QUICK_GATE_7_FILE_REVERSED=124 pass / 0 fail / 0 error
```

Método: `bunx tsc --noEmit`, contar por identidad (`archivo` + `código TS`
+ `mensaje`), NUNCA por líneas crudas de output (un solo diagnóstico
multi-línea, como el overload-mismatch de `src/app/mozo/[slug]/page.tsx`,
puede ocupar >15 líneas de output). La cifra histórica "72" era un conteo
de líneas crudas, no de diagnósticos — ver
`DECISIONS_AND_INVARIANTS.md`.

Comparación de identidad: `sed -E 's/\([0-9]+,[0-9]+\)//' | sort` sobre la
salida de `grep "error TS"`, diff contra la misma extracción en un
worktree/checkout del commit base.

### Gates estáticos vigentes

```
ESLINT: debe correr limpio sobre el scope de cada tarea (mínimo los
  archivos tocados).
BUILD: `bun run build` debe pasar (exit 0). `prisma generate` local
  permitido como parte normal del build (no conecta a DB). Prohibido:
  `prisma migrate`/`db push`/introspection/seed contra DB real.
DIFF_CHECK: `git diff --check` debe estar limpio (sólo warnings CRLF de
  Windows son aceptables).
```

### Reglas de mezcla

- Nunca incluir `*.integration.test.ts` en el union de 34 (requieren DB
  real vía `DELIGO_TEST_DATABASE_URL`).
- Nunca usar el `bun test` combinado de TODO el repo como autoridad de
  regresión Push — arrastra ruido no relacionado (ver F22 history abajo).
- El archivo `32` en la raíz del repo nunca debe leerse/tocarse/ejecutarse.

## HISTORICAL AUTHORITY (no usar como gate — sólo contexto)

- Antes de Stage4D-R1: conteos de 366/379 tests en un supuesto "Push
  suite" cuyo listado literal nunca se preservó — reconciliado como
  artefacto de ambigüedad de criterio de grep, no una regresión real.
- H1 precommit (`c66df8d`): union histórico de 31 archivos,
  436 pass (425 baseline + 11 net-new F19/F20).
- H3B precommit completion: primera vez que el listado literal de 32/34
  archivos quedó persistido (antes de eso, sólo cifras agregadas).
- F-P2-T05-22 (mock.module collision): antes de H4, el archivo
  `src/app/api/chat/mensajes/[pedidoId]/route.test.ts` se perdía
  determinísticamente en cualquier combinación con los otros 6 archivos
  que registraban formas parciales incompatibles de `@/lib/auth` —
  modelo de regresión anterior:
  `CURRENT_SAFE_PUSH_UNION_34_FILES_ISOLATED_PER_PROCESS_UNTIL_H4`.
  Resuelto por H4; reset isolation correction local vigente (ver
  `FINDINGS.md`).
- TSC histórico "72": conteo de líneas crudas de `bunx tsc --noEmit`,
  reconciliado en la etapa `H3B — PRE-COMMIT COMPLETION` como
  `COUNTING_METHODOLOGY_CHANGED`, no un cambio real de diagnósticos.

## FINAL ACCUMULATED REGRESSION AUTHORITY — 2026-08-26

P2_T05_FINAL_ACCUMULATED_REGRESSION=PASS
FINAL_REGRESSION_HISTORICAL_SCOPE_MAPPED=SI
FINAL_REGRESSION_HISTORICAL_SCOPE_UNCOVERED_CATEGORY_COUNT=0
FINAL_REGRESSION_CURRENT_34_FILE_COUNT=34
FINAL_REGRESSION_CURRENT_34_FILE_LIST_LITERAL=SI
FINAL_REGRESSION_EXCLUDED_FILE_COUNT=0
FINAL_REGRESSION_34_ISOLATED=523 pass / 0 fail / 0 error
FINAL_REGRESSION_34_COMBINED_NORMAL=523 pass / 0 fail / 0 error
FINAL_REGRESSION_34_COMBINED_REVERSED=523 pass / 0 fail / 0 error
FINAL_REGRESSION_STAGE4_FOCALS=5 files / 65 pass / 0 fail / 0 error
FINAL_REGRESSION_REPOSITORY_HTTP_FOCALS=9 files / 225 pass / 0 fail / 0 error
FINAL_REGRESSION_PERSONAL_UI_FOCALS=6 files / 59 pass / 0 fail / 0 error
FINAL_F19_CROSS_CHANNEL_PROTECTION=PASS
FINAL_F20_FAIL_CLOSED_CONFLICT_POLICY=PASS
FINAL_F21_BATCH_LOOKUP=PASS
FINAL_F21_NO_N_PLUS_ONE=PASS
FINAL_WEBPUSH_CONFIGURED_CONCURRENCY_CAP=8
FINAL_WEBPUSH_MAX_OBSERVED_ACTIVE=8
FINAL_F21_BOUNDED_CONCURRENCY=PASS
FINAL_F21_FAILURE_ISOLATION=PASS
FINAL_404_410_CLEANUP_SEMANTICS=PASS
FINAL_NON_404_NO_CLEANUP=PASS
FINAL_LEGACY_FALLBACK=PASS
FINAL_ENDPOINT_DEDUPE=PASS
FINAL_F22_ORDER_INDEPENDENCE=PASS
CAN_COMBINED_RESULT_CHANGE_IF_FILE_LOAD_ORDER_REVERSES=NO
FINAL_REGRESSION_SKIP_FOUND=NO
FINAL_REGRESSION_ONLY_FOUND=NO
FINAL_REGRESSION_ASSERTION_SWALLOW_FOUND=NO
FINAL_REGRESSION_TEST_MASKING_FOUND=NO
FINAL_TSC_RAW=31
FINAL_TSC_DISTINCT=24
FINAL_TSC_NEW_DIAGNOSTICS_FROM_FINAL_HEAD=0
TSC_BASELINE_IDENTITY_STATUS=UNRESOLVED_LIMITED
ESLINT_FINAL_ACCUMULATED=PASS
BUILD_FINAL_ACCUMULATED=PASS
NEW_BLOCKING_FINDING_COUNT=0
READY_FOR_P2_T05_FINAL_TESTING_CHECKPOINT=SI
NEXT_TASK_ID=P2-T05-FINAL-TESTING-CHECKPOINT

## P2-T13 STAGE2 — local implementation authority

Esta sección es adicional y separada de la autoridad P2-T05 de 34 archivos;
no reemplaza ni reabre el cierre P2-T05.

```
TASK_ID=P2-T13-STAGE2
P2_T13_STAGE2_LOCAL_IMPLEMENTATION=PASS
P2_T13_STATUS=STAGE2_IMPLEMENTED_LOCAL_AWAITING_PRECOMMIT_REVIEW
P2_T13_FOCAL_FILES=6
P2_T13_FOCAL_PASS_COUNT=146
P2_T13_FOCAL_FAIL_COUNT=0
P2_T13_FOCAL_ERROR_COUNT=0
P2_T13_T13_02_03_04=PASS
P2_T13_34_FILE_COUNT=34
P2_T13_34_COMBINED_NORMAL=526 pass / 0 fail / 0 error
P2_T13_34_COMBINED_REVERSED=526 pass / 0 fail / 0 error
P2_T13_34_EXCLUDED_COUNT=0
P2_T13_REAL_DB_READ=NO
P2_T13_REAL_DB_WRITE=NO
P2_T13_SCHEMA_CHANGE=NO
P2_T13_MIGRATION_CHANGE=NO
P2_T13_RAILWAY_MUTATION=NO
P2_T13_GIT_MUTATION=NO
P2_T13_NEXT_TASK=P2-T13-STAGE3
```

El focal repository fue 58/58 y los cinco callers fueron 88/88. El test
T13-04 usa una intercalación controlada sin sleep; no pretende sustituir una
certificación multi-proceso contra PostgreSQL, que permanece fuera de Stage2.

## P2-T13 STAGE3 — pre-commit review authority

Esta sección es adicional y separada de la autoridad P2-T05; no reemplaza ni
reabre el cierre P2-T05.

```
TASK_ID=P2-T13-STAGE3
P2_T13_STAGE3_PRECOMMIT_REVIEW=PASS
P2_T13_STAGE3_FOCAL_FILES=6
P2_T13_STAGE3_FOCAL=146 pass / 0 fail / 0 error / 406 expect
P2_T13_STAGE3_34_FILE_COUNT=34
P2_T13_STAGE3_34_ISOLATED=526 pass / 0 fail / 0 error / 1427 expect
P2_T13_STAGE3_34_COMBINED_NORMAL=526 pass / 0 fail / 0 error / 1427 expect
P2_T13_STAGE3_34_COMBINED_REVERSED=526 pass / 0 fail / 0 error / 1427 expect
P2_T13_STAGE3_EXCLUDED_FILE_COUNT=0
P2_T13_STAGE3_NET_NEW_TESTS=3
P2_T13_STAGE3_TEST_NAME_REMOVALS=0
P2_T13_STAGE3_PRISMA_VALIDATE=PASS
P2_T13_STAGE3_PRISMA_NETWORK=NO
P2_T13_STAGE3_REAL_DB_READ=NO
P2_T13_STAGE3_REAL_DB_WRITE=NO
P2_T13_STAGE3_ESLINT=PASS
P2_T13_STAGE3_BUILD=PASS
P2_T13_STAGE3_TSC=31 raw / 24 historical distinct / 0 changed-path / 0 new
P2_T13_STAGE3_NEXT_TASK=P2-T13-STAGE4
```

La lista literal de los 34 archivos permanece la autoridad existente en este
documento; Stage 3 la ejecutó individualmente y en orden normal e invertido.

## P2-T13 STAGE4 — local commit (NO reemplaza la autoridad 526/526/526 de Stage 3)

```
TASK_ID=P2-T13-STAGE4
P2_T13_STAGE4_LOCAL_COMMIT=PASS
P2_T13_STAGE4_COMMIT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
P2_T13_STAGE4_QUICK_GATE_FOCAL_FILES=6
P2_T13_STAGE4_QUICK_GATE_FOCAL_PASS=146
P2_T13_STAGE4_QUICK_GATE_FOCAL_FAIL=0
P2_T13_STAGE4_QUICK_GATE_FOCAL_ERROR=0
POSTCOMMIT_RECERTIFICATION_REQUIRED=SI
```

Stage 4 no re-ejecutó la batería completa de 34 archivos × 3 órdenes: la
continuidad de bytes/diff desde Stage 3 se demostró por comparación de
contenido completo (no por hash persistido, que Stage 3 no guardó), y sólo
se re-corrió el gate focal de 6 archivos como sanity mínima antes de
stagear. La autoridad 526/526/526 de Stage 3 permanece vigente como última
ejecución completa de la batería de 34; queda marcada pendiente de
recertificación postcommit en Stage 5, antes de cualquier push.

## P2-T13 STAGE5 — postcommit/pre-push adversarial recertification (re-ejecución completa contra los blobs de HEAD)

```
TASK_ID=P2-T13-STAGE5
P2_T13_STAGE5_POSTCOMMIT_PREPUSH_RECERTIFICATION=PASS
T13_STAGE5_COMMIT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
T13_STAGE5_FOCAL_FILES=6
T13_STAGE5_FOCAL_PASS=146
T13_STAGE5_FOCAL_FAIL=0
T13_STAGE5_FOCAL_ERROR=0
T13_STAGE5_34_ISOLATED=526 pass / 0 fail / 0 error
T13_STAGE5_34_NORMAL=526 pass / 0 fail / 0 error / 1427 expect
T13_STAGE5_34_REVERSED=526 pass / 0 fail / 0 error / 1427 expect
T13_STAGE5_34_EXCLUDED=0
T13_STAGE5_PRISMA_VALIDATE=PASS
T13_STAGE5_PRISMA_GENERATE=PASS
T13_STAGE5_ESLINT=PASS
T13_STAGE5_BUILD=PASS
T13_STAGE5_TSC_RAW=31
T13_STAGE5_TSC_DISTINCT=24
T13_STAGE5_TSC_CHANGED_PATH_DIAGNOSTICS=0
T13_STAGE5_TSC_NEW_DIAGNOSTICS=0
T13_STAGE5_RED_REPRODUCED_AGAINST_PARENT=SI
```

Esta es la autoridad de Push MÁS RECIENTE — Stage 5 re-ejecutó la batería
completa de 34 archivos en los 3 órdenes (aislado, combinado normal,
combinado reverso) directamente contra el estado real de `HEAD`
(`44b9da0`, working tree limpio = HEAD), no reutilizó números de Stage 3.
El resultado coincide exactamente con la autoridad previa (526/526/526),
confirmando que no hubo drift ni regresión entre Stage 3 y Stage 5.
Adicionalmente, Stage 5 reprodujo el fallo del bug original (RED) contra el
código real del commit parent (`HEAD^`) en un worktree temporal aislado
fuera del repo, luego eliminado por completo — evidencia empírica directa
de la causa raíz, no sólo inferida del diff. La autoridad de P2-T05 (34
archivos) permanece la misma tabla y el mismo modelo; no se reemplaza el
histórico, sólo se re-certifica.

## P2-T13 STAGE6 — certificación runtime real (PostgreSQL + HTTP, TESTING)

```
TASK_ID=P2-T13-STAGE6
P2_T13_STAGE6_TESTING_RUNTIME_CERTIFICATION=PASS
PUSHED_COMMIT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
DB_T13_01_SEQUENTIAL_STALE=PASS (V1 no borra V2, row_count=1, payload exacto)
DB_T13_02_CURRENT_DETACH=PASS (row_count_after=0)
DB_T13_03_CONCURRENCY_ROUNDS=10
DB_T13_03_ROUNDS_PASS=10
DB_T13_03_REJECTIONS=0
DB_T13_03_ZERO_ROW_FINAL=0
DB_T13_03_V1_FINAL=0
DB_T13_03_TORN=0
DB_T13_03_V2_FINAL=10
DB_T13_04_CROSS_ACTOR=PASS
DB_T13_05_CHANNEL=PASS
DB_T13_06_MULTI_DEVICE=PASS
DB_T13_07_REGISTER_SANITY=PASS
DB_FIXTURE_CLEANUP=PASS (0 remanentes)
HTTP_T13_SUBSCRIBE_V1=PASS
HTTP_T13_SUBSCRIBE_V2_ROTATION=PASS
HTTP_T13_STALE_UNSUBSCRIBE=PASS (removed=false, V2 sobrevive)
HTTP_T13_CURRENT_UNSUBSCRIBE=PASS (removed=true, V2 eliminado)
HTTP_T13_MALFORMED_FAIL_CLOSED=PASS (400)
HTTP_T13_OWNER_CHANNEL_AUTHORITY=PASS
HTTP_FIXTURE_CLEANUP=PASS (0 remanentes)
REAL_WEBPUSH_SENT=NO
DATABASE_URL_FALLBACK_USED=NO
```

Esta es la primera certificación de P2-T13 contra infraestructura REAL
(PostgreSQL de TESTING vía `DELIGO_TEST_DATABASE_URL`, y HTTP real contra
el deploy desplegado) — no mockeada. Ejecutada mediante dos harnesses
temporales (`t13_stage6_db_harness.ts`, `t13_stage6_http_harness.ts`),
nunca stageados ni commiteados, eliminados tras su uso. No reemplaza la
autoridad de tests unitarios/mockeados de Stage3/Stage5 (526/526/526) — la
complementa con evidencia de motor real.

## P2-T13 STAGE7 — cierre final (autoridad reutilizada, sin re-ejecución)

```
TASK_ID=P2-T13-STAGE7
P2_T13_FINAL_TEST_AUTHORITY_COMPLETE=SI
P2_T13=CLOSED
```

Stage 7 fue read/audit-only: no re-ejecutó la batería de 34 archivos ni la
campaña de PostgreSQL/HTTP — reutilizó legítimamente la autoridad ya
persistida de Stage3 (146/526×3), Stage5 (recertificación completa
526/526/526 contra blobs de HEAD) y Stage6 (real Postgres 10/10 + HTTP
real). Confrontó esa autoridad contra Git real y los registros canónicos
sin encontrar contradicciones materiales. La autoridad de P2-T05 (34
archivos, 523 baseline + 3 net-new T13 = 526 vigente) permanece la misma
tabla; no se reemplaza ni se reabre.

## P2-T12 STAGE1 — hallazgo de cobertura (sin ejecución, sólo inventario)

```
TASK_ID=P2-T12-STAGE1
P2_T12_STAGE1_AUDIT_DESIGN=PASS
TERMINAL_LIFECYCLE_DEDICATED_TEST_FILE_COUNT=0
TERMINAL_FIXTURE_ONLY_TEST_FILE_COUNT=2 (mesa-pedido-cancelacion.test.ts, negocio-salon.test.ts — usan TerminalOperativa sólo como fixture de otra feature)
```

No existe hoy ningún archivo de test dedicado a las rutas de lifecycle de
terminal (`create`, `activacion`, `activar`, `revocar`, `contexto`). Esto
no es autoridad de regresión — es un inventario de ausencia, relevante
para que P2-T12-STAGE2 sepa que no hay batería previa que reutilizar para
certificar que el `DROP COLUMN` no rompe el lifecycle; deberá decidir si
agrega cobertura mínima nueva o se apoya en smoke manual/TESTING.

## P2-T12 STAGE2 — dead column local removal (sin autoridad Push nueva)

```
TASK_ID=P2-T12-STAGE2
P2_T12_STAGE2_LOCAL_IMPLEMENTATION=PASS
T12_STAGE2_TERMINAL_TEST_FILE_COUNT=3 (referencian TerminalOperativa)
T12_STAGE2_TERMINAL_TEST_DB_REQUIRED_FILE_COUNT=2 (mesa-pedido-cancelacion.test.ts, negocio-salon.test.ts — requieren DATABASE_URL real pese a no llevar sufijo .integration.test.ts; NO ejecutados, prohibido en esta tarea)
T12_STAGE2_TERMINAL_TEST_RUNNABLE_WITHOUT_DB=1 (negocio-salon-static-contract.test.ts)
T12_STAGE2_TERMINAL_TEST_PASS=26
T12_STAGE2_TERMINAL_TEST_FAIL=0
PRISMA_VALIDATE_T12_STAGE2=PASS
PRISMA_GENERATE_T12_STAGE2=PASS
T12_CHANGED_PATH_TSC_DIAGNOSTICS=0
T12_NEW_TSC_DIAGNOSTICS=0 (baseline 31 raw / 24 distinct sin cambio)
BUILD_T12_STAGE2=PASS
```

Se registra explícitamente que `mesa-pedido-cancelacion.test.ts` y
`negocio-salon.test.ts` son tests de integración real (dicen literalmente
"integración real" en su propio describe block) que requieren
`DATABASE_URL` real — pese a no seguir la convención de nombre
`.integration.test.ts` del resto del repo. No se cuentan como
fail/regresión de este diff (fallaron por precondición ambiental —
`DATABASE_URL` no provista — no por el cambio de schema). No reemplaza ni
altera la autoridad de 34 archivos de P2-T05/T13 (0 solapamiento, ver
`PUSH_REGRESSION_BOUNDARY` en `codex-reports/CURRENT_TASK.md`).

## P2-T12 STAGE3 — review-only, autoridad Stage2 reutilizada sin re-ejecución

```
TASK_ID=P2-T12-STAGE3
P2_T12_STAGE3_PRECOMMIT_ROLLOUT_REVIEW=PASS
T12_STAGE2_LOCAL_QUALITY_AUTHORITY_STILL_VALID=SI
```

Stage3 no re-ejecutó Prisma validate/generate/TSC/build/tests — confirmó
que el working tree es byte-idéntico al certificado por Stage2 (mismo
`git diff`, mismo archivo de migración) y reutilizó esa autoridad
legítimamente. No se agregó ningún test nuevo. El hallazgo de Stage3 es
puramente de análisis de rollout (compatibilidad Prisma-Client-viejo vs.
schema nuevo), no de calidad de código.

## P2-T12 STAGE4A — Phase1 schema-only, re-ejecución real tras retirar la migración

```
TASK_ID=P2-T12-STAGE4A
P2_T12_STAGE4A_PHASE1_LOCAL_PREPARATION=PASS
T12_PHASE1_TERMINAL_TEST_FILE_COUNT=3
T12_PHASE1_TERMINAL_TEST_PASS=26 (negocio-salon-static-contract.test.ts, único ejecutable sin DB real)
T12_PHASE1_TERMINAL_TEST_FAIL=0
PRISMA_VALIDATE_T12_PHASE1=PASS
PRISMA_GENERATE_T12_PHASE1=PASS
T12_PHASE1_CHANGED_PATH_TSC_DIAGNOSTICS=0
T12_PHASE1_NEW_TSC_DIAGNOSTICS=0 (baseline 31 raw / 24 distinct sin cambio)
BUILD_T12_PHASE1=PASS
```

A diferencia de Stage3 (review-only), Stage4A sí re-ejecutó Prisma
validate/generate, TSC, build y el test ejecutable sin DB, porque el
working tree cambió realmente (migración retirada + client regenerado
contra el schema de Phase1). Resultado idéntico en magnitud al de Stage2
(26/26, TSC 31/24, build PASS) — confirma que retirar la migración local y
regenerar el cliente no introdujo ninguna regresión.

## P2-T12 STAGE4B — re-ejecución adversarial, mismo resultado que Stage4A

```
TASK_ID=P2-T12-STAGE4B
P2_T12_STAGE4B_PHASE1_PRECOMMIT_REVIEW=PASS
T12_STAGE4B_TERMINAL_TEST_PASS=26 (negocio-salon-static-contract.test.ts)
PRISMA_VALIDATE_T12_STAGE4B=PASS
PRISMA_GENERATE_T12_STAGE4B=PASS
T12_STAGE4B_NEW_TSC_DIAGNOSTICS=0 (31/24 baseline sin cambio)
BUILD_T12_STAGE4B=PASS
T12_STAGE4B_TOOLING_DRIFT_FOUND=NO
```

No se confió en el resultado de Stage4A sin re-derivarlo: se re-ejecutó
Prisma validate/generate, TSC, build y el test de terminal ejecutable sin
DB de forma independiente, obteniendo exactamente el mismo resultado —
confirma que no hubo drift entre Stage4A y esta revisión adversarial.

## P2-T12 STAGE4C — Phase1 local commit authority

Stage4B authority fue preservada. Stage4C sólo agregó evidencia del commit
local schema-only y no reabrió ni modificó la autoridad histórica de tests.

```
TASK_ID=P2-T12-STAGE4C
P2_T12_STAGE4C_PHASE1_LOCAL_COMMIT=PASS
T12_STAGE4C_QUICK_TERMINAL_TEST_FILE=src/lib/negocio-salon-static-contract.test.ts
T12_STAGE4C_QUICK_TERMINAL_TEST_PASS=26
T12_STAGE4C_QUICK_TERMINAL_TEST_FAIL=0
T12_STAGE4C_QUICK_TERMINAL_TEST_ERROR=0
PRISMA_VALIDATE_T12_STAGE4C=PASS
PRISMA_VALIDATE_NETWORK_CONNECTION_ATTEMPTED=NO
T12_STAGE4C_COMMIT_FILE_COUNT=1
T12_STAGE4C_COMMIT_ONLY_PATH=prisma/schema.prisma
T12_STAGE4C_REPORT_FILES_COMMITTED=NO
T12_STAGE4C_MIGRATION_FILES_COMMITTED=NO
T12_STAGE4C_TS_FILES_COMMITTED=NO
T12_STAGE4C_NEXT_TASK=P2-T12-STAGE4D
```

## P2-T12 STAGE4D — exact-blob post-commit authority

```
TASK_ID=P2-T12-STAGE4D
P2_T12_STAGE4D_PHASE1_POSTCOMMIT_PREPUSH_REVIEW=PASS
T12_STAGE4D_COMMIT_IDENTITY=PASS
T12_STAGE4D_COMMIT_FILE_COUNT=1
T12_STAGE4D_COMMIT_ONLY_PATH=prisma/schema.prisma
T12_STAGE4D_PARENT_FIELD_PRESENT=SI
T12_STAGE4D_COMMIT_FIELD_ABSENT=SI
T12_STAGE4D_BLOB_TRANSITION_PROVED=SI
T12_STAGE4D_COMMIT_CONTAINS_T12_MIGRATION=NO
T12_STAGE4D_GENERATED_CLIENT_HAS_PUSH_SCALAR=NO
T12_STAGE4D_TERMINAL_QUERY_CALLSITE_COUNT=11
T12_STAGE4D_TERMINAL_TEST_PASS=26
T12_STAGE4D_TERMINAL_TEST_FAIL=0
T12_STAGE4D_TERMINAL_TEST_ERROR=0
PRISMA_VALIDATE_T12_STAGE4D=PASS
PRISMA_GENERATE_T12_STAGE4D=PASS
T12_STAGE4D_CHANGED_PATH_TSC_DIAGNOSTICS=0
T12_STAGE4D_NEW_TSC_DIAGNOSTICS=0
ESLINT_T12_STAGE4D=NOT_APPLICABLE_NO_TS_CHANGE
BUILD_T12_STAGE4D=PASS
T12_STAGE4D_TOOLING_DRIFT_FOUND=NO
T12_STAGE4D_PHASE1_EXTRA_DB_COLUMN_CONTRACT=PASS
T12_STAGE4D_PHASE1_CANNOT_APPLY_T12_DROP=SI
T12_STAGE4D_PHASE2_ALLOWED_NOW=NO
T12_STAGE4E_REQUIRED_PREPUSH_GATES_DEFINED=SI
T12_STAGE4E_TESTING_DB_READONLY_PREFLIGHT_REQUIRED=SI
T12_PHASE1_DRAIN_CERTIFICATION_PLAN_DEFINED=SI
PUSH=NO
DEPLOY=NO
```

La autoridad de Stage4B se conserva y Stage4D agrega sólo la auditoría de
blobs, generated client, call-sites, tests y gates post-commit.

## P2-T12 STAGE4E — exact push, TESTING deploy, runtime and drain authority

```
TASK_ID=P2-T12-STAGE4E
P2_T12_STAGE4E_PHASE1_TESTING_CERTIFICATION=PASS
PUSH_COUNT=1
PUSH_RESULT=PASS
COMMIT=bebd36c841f588fc9e4c74099e38a95d37d58982
ORIGIN_TESTING_CODEX=bebd36c841f588fc9e4c74099e38a95d37d58982
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_COMMIT_EXACT=SI
CHAT_DEPLOYMENT_STATUS=SUCCESS
PREDEPLOY_NO_PENDING_MIGRATIONS=SI
T12_DROP_APPLIED=NO
PHYSICAL_COLUMN_PRE=SI
PHYSICAL_COLUMN_POST=SI
FAILED_MIGRATION_COUNT_PRE=0
FAILED_MIGRATION_COUNT_POST=0
T12_MIGRATION_HISTORY_COUNT=0
TERMINAL_ROUTES_CERTIFIED=SI
TERMINAL_ACTIVATION_STATUS=200
TERMINAL_CONTEXT_AUTH_STATUS=200
TERMINAL_NEGATIVE_REUSE_STATUS=400
TERMINAL_NEGATIVE_REUSE_GENERIC=SI
TERMINAL_REVOCATION_STATUS=200
TERMINAL_POST_REVOCATION_CONTEXT_STATUS=401
TERMINAL_PUSH_SEND=NO
FIXTURE_PREFIX=TEST_T12_PHASE1_
FIXTURE_CLEANUP=PASS
FIXTURE_REMAINDER=0
T12_PHASE1_OLD_INSTANCE_DRAIN_CERTIFIED=SI
OLD_INSTANCE_STATE=REMOVED
CURRENT_INSTANCE_STATE=RUNNING
HTTP_HEALTH=PASS
P2_T12_CLOSED=NO
T12_PHASE2_ALLOWED_AFTER_STAGE4E=SI
NEXT_TASK_ID=P2-T12-STAGE5A
```

La URL requerida fue verificada por existencia antes de cada acceso DB y su
valor nunca fue expuesto. No se usó `DATABASE_URL` como fallback. La autoridad
de Phase2 continúa limitada a preparación futura: Stage4E no ejecutó ni
publicó la migración DROP.

## P2-T12 STAGE5A — local Phase2 migration authority

```
TASK_ID=P2-T12-STAGE5A
P2_T12_STAGE5A_PHASE2_LOCAL_MIGRATION_RECREATION=PASS
T12_STAGE5A_PHASE1_COMMIT_IDENTITY=PASS
T12_STAGE5A_PHASE1_SCHEMA_PUSH_FIELD_ABSENT=SI
T12_STAGE5A_BLUEPRINT_ARCHIVE_CHAIN_COMPLETE=SI
T12_STAGE5A_BLUEPRINT_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
T12_STAGE5A_RECREATED_MIGRATION_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
T12_STAGE5A_BLUEPRINT_HASH_MATCH=SI
T12_STAGE5A_BLUEPRINT_BYTE_REPRODUCTION=PASS_BY_SHA256
T12_PHYSICAL_TABLE_NAME=terminales_salon
T12_PHYSICAL_COLUMN_NAME=pushSubscription
T12_PHASE2_MIGRATION_DIRECTORY=20260826230000_drop_terminal_operativa_push_subscription
T12_STAGE5A_BLUEPRINT_DIRECTORY_REUSED=SI
T12_STAGE5A_TRACKED_MIGRATION_COUNT_BEFORE=26
T12_STAGE5A_NEW_MIGRATION_COUNT=1
T12_STAGE5A_MIGRATION_STATEMENT_COUNT=1
T12_STAGE5A_SCHEMA_MUTATION=NO
T12_STAGE5A_PRODUCT_SOURCE_MUTATION=NO
T12_STAGE5A_TEST_MUTATION=NO
PRISMA_VALIDATE_T12_STAGE5A=PASS
PRISMA_GENERATE_T12_STAGE5A=PASS
T12_STAGE5A_GENERATED_CLIENT_HAS_PUSH_SCALAR=NO
T12_STAGE5A_TSC_REQUIRED=NO_SQL_ONLY_DIFF
T12_STAGE5A_BUILD_REQUIRED=NO_SQL_ONLY_DIFF
DB_REAL_READ=NO
DB_REAL_WRITE=NO
MIGRATION_APPLIED_TO_TESTING=NO
MIGRATION_APPLIED_TO_PRODUCTION=NO
STAGE=NO
NEW_COMMIT=NO
AMEND=NO
PUSH=NO
DEPLOY=NO
```

La autoridad se basa en lectura completa del SQL local, inventario estático,
hash exacto, Prisma validate/generate y diff de alcance. No se accedió DB real.

## P2-T12 STAGE5C — exact Phase2 local commit authority

```
TASK_ID=P2-T12-STAGE5C
P2_T12_STAGE5C_PHASE2_LOCAL_COMMIT=PASS
COMMIT=7822d84ac5ac841978a77ebef76ad93630b69f42
PARENT=bebd36c841f588fc9e4c74099e38a95d37d58982
SUBJECT=chore: remove dead terminal push column
COMMIT_FILE_COUNT=1
COMMIT_PATH=prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
COMMITTED_BLOB=52501817c39ba4c3979ba0f77c687cd518c298ef
COMMITTED_BLOB_SIZE=2134
MIGRATION_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
MIGRATION_ENCODING=UTF8_NO_BOM_LF
MIGRATION_NUL_BYTE_COUNT=0
MIGRATION_TOTAL_LINES=35
MIGRATION_COMMENT_LINES=33
MIGRATION_EXECUTABLE_STATEMENTS=1
STAGING_FILESET=EXACT_SINGLE_FILE
COMMITTED_FILESET=EXACT_SINGLE_FILE
SCHEMA_TS_TESTS_OTHER_MIGRATIONS_COMMITTED=NO
TSC_BUILD_TEST_RERUN=NO_SQL_ONLY_DIFF
DB_REAL_READ=NO
DB_REAL_WRITE=NO
MIGRATION_APPLIED_TO_TESTING=NO
MIGRATION_APPLIED_TO_PRODUCTION=NO
PUSH=NO
DEPLOY=NO
RAILWAY_MUTATION=NO
PRODUCTION=NO
NEXT_TASK_ID=P2-T12-STAGE5D
```

La autoridad de commit se basa en validación byte-level, lectura completa del
SQL, `git diff --cached` exacto, blob committed y diff post-commit. No se
ejecutó ninguna operación de base de datos.

## P2-T12 STAGE5D — post-commit/pre-push exact-blob authority

```
TASK_ID=P2-T12-STAGE5D
P2_T12_STAGE5D_PHASE2_POSTCOMMIT_PREPUSH_REVIEW=PASS
COMMIT=7822d84ac5ac841978a77ebef76ad93630b69f42
PARENT=bebd36c841f588fc9e4c74099e38a95d37d58982
SUBJECT=chore: remove dead terminal push column
COMMIT_FILE_COUNT=1
COMMIT_PATH=prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
COMMITTED_BLOB_ID=52501817c39ba4c3979ba0f77c687cd518c298ef
COMMITTED_BYTE_LENGTH=2134
COMMITTED_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
FULL_COMMITTED_BLOB_READ=SI
ENCODING=UTF-8
BOM=NONE
LINE_ENDING=LF
NUL_BYTES=0
TOTAL_LINES=35
COMMENT_LINES=33
EXECUTABLE_SQL_STATEMENT_COUNT=1
ALL_COMMENTS_READ=SI
COMMENTS_DOCUMENTARY_ONLY=SI
COMMENT_SECURITY_ISSUE_COUNT=0
EXECUTABLE_SQL_EXACT_MATCH=SI
UNEXPECTED_EXECUTABLE_SQL_COUNT=0
PHYSICAL_TARGET_REDERIVED=PASS
PHASE1_PARENT_SCHEMA_FIELD_ABSENT=SI
PHASE2_SCHEMA_EQUALS_PHASE1_SCHEMA=SI
NEW_MIGRATION_COUNT=1
HISTORICAL_MIGRATION_MODIFICATION_COUNT=0
MIGRATION_ORDER=PASS
IF_EXISTS_POLICY=KEEP_IDEMPOTENT
TWO_PHASE_ROLLOUT_PROOF=PASS
FAILURE_CONTAINMENT=PASS
PRISMA_VALIDATE=PASS
DB_REAL_READ=NO
DB_REAL_WRITE=NO
MIGRATION_APPLIED=NO
PUSH=NO
DEPLOY=NO
RAILWAY_MUTATION=NO
PRODUCTION=NO
NEXT_TASK_ID=P2-T12-STAGE5E
```

La autoridad de Stage5D proviene directamente del commit/blob, no del working
tree. Stage5E requiere fresh DB gates con `DELIGO_TEST_DATABASE_URL` y sin
fallback a `DATABASE_URL` antes de cualquier push o aplicación.

## P2-T12 STAGE5E — fresh TESTING DB / runtime authority

```
TASK_ID=P2-T12-STAGE5E
P2_T12_STAGE5E=PASS
DB_TARGET=TESTING_ONLY
REQUIRED_ENV=DELIGO_TEST_DATABASE_URL
REQUIRED_ENV_EXISTENCE_GATE=PASS
REQUIRED_ENV_VALUE_PRINTED=NO
DATABASE_URL_FALLBACK=NO
PRE_FAILED_MIGRATIONS=0
PRE_PENDING_COUNT=1
PRE_PENDING_MIGRATION=20260826230000_drop_terminal_operativa_push_subscription
PRE_T12_HISTORY_COUNT=0
PRE_PHYSICAL_COLUMN_EXISTS=SI
PUSH_COUNT=1
DEPLOYMENT_ID=cf5cca9a-e5f3-4a35-8b56-d6b90ec0c2b9
DEPLOYMENT_COMMIT=7822d84ac5ac841978a77ebef76ad93630b69f42
DEPLOYMENT_STATUS=SUCCESS
PREDEPLOY_EXACT_MIGRATION_APPLIED=SI
POST_T12_HISTORY_COUNT=1
POST_T12_SUCCESSFUL_COUNT=1
POST_FAILED_MIGRATIONS=0
POST_PENDING_MIGRATIONS=0
POST_PHYSICAL_COLUMN_EXISTS=NO
HTTP_RUNTIME_SMOKE=PASS
HTTP_REPLAY_STATUS=400
HTTP_REVOKED_CONTEXT_STATUS=401
SALONACTIVO_EXPOSED=NO
TERMINAL_PUSH_SIDE_EFFECT=NO
WEBPUSH=NO
FIXTURE_CLEANUP=PASS
FIXTURE_ROWS_REMAINING=0
POSTDROP_LOG_GATE=PASS
PRODUCTION=NO
NEXT_TASK_ID=P2-T12-STAGE5F
```

La autoridad post-DROP combina `prisma migrate status`, metadata física/histórica
sin leer valores legacy, logs del preDeploy/deployment y un flujo HTTP real
autenticado contra el servicio TESTING. La fixture se creó con hash compatible
con el autenticador productivo y se eliminó antes del cierre.

## P2-T12 STAGE5F — final closeout authority

```
TASK_ID=P2-T12-STAGE5F
P2_T12_STAGE5F_FINAL_CLOSEOUT=PASS
PHASE1_SCHEMA_CLIENT_FIELD_REMOVED=SI
PHASE1_OLD_INSTANCE_REMOVED=SI
PHASE2_EXACT_ONE_FILE_MIGRATION=SI
PHASE2_MIGRATION_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
PRE_HISTORY_0_TO_POST_HISTORY_1=SI
PRE_COLUMN_YES_TO_POST_COLUMN_NO=SI
PRE_PENDING_1_TO_POST_PENDING_0=SI
FAILED_0_TO_FAILED_0=SI
ACTIVE_PHASE2_COMMIT=7822d84ac5ac841978a77ebef76ad93630b69f42
ACTIVE_PHASE2_HEALTH=PASS
HTTP_HEALTH=PASS
CHAT_HEALTH=PASS
RUNTIME_AUTHORITY_ACCEPTED=SI
CLEANUP_ZERO=SI
F_P0_05_STATUS=RESOLVED
P2_T12=CLOSED
P2_T12_CLOSED=SI
OPEN_T12_BLOCKERS=0
NEXT_MAIN_TASK=P2-T11
NEXT_MAIN_TASK_TITLE=Native Socket Post-Logout TTL Hardening
```

Stage5F es read-only respecto de producto, DB y Railway: no ejecutó fixtures,
migrations ni despliegues. Solo reconcilió la autoridad final y actualizó los
reportes fuera de commits.

## P2-T11 STAGE3A — Phase A local implementation authority

```
TASK_ID=P2-T11-STAGE3A
P2_T11_STAGE3A=PASS_PHASE_A_LOCAL_IMPLEMENTATION
NEW_TEST_FILE=src/app/api/internal/realtime/session/route.test.ts
NEW_TEST_FILE_COUNT=14
NEW_TEST_PASS=14
NEW_TEST_FAIL=0
NEW_TEST_SKIP=0
NEW_TEST_DURATION_MS=1404
RELATED_TESTS_RUN=src/lib/session-login-atomicity-wiring-static-contract.test.ts, src/lib/realtime-auth.test.ts
RELATED_TEST_COUNT=22
RELATED_TEST_PASS=22
RELATED_TEST_FAIL=0
DB_REQUIRED_SUITES_SKIPPED=superadmin-auth.test.ts, negocio-salon.test.ts, mesa-pedido-cancelacion.test.ts (fallan por DATABASE_URL ausente en el sandbox — baseline ambiental, no regresión: 0 referencias a mi código en los fallos)
TSC_RAW=31
TSC_BASELINE_MATCH=SI
TSC_NEW_ERRORS=0
ESLINT_NEW_ERRORS=0
BUILD=PASS (next build, exit 0, ruta /api/internal/realtime/session presente en el manifiesto)
DB_REAL_READ=NO
DB_REAL_WRITE=NO
```

Mocks de `@/lib/db` (mismo patrón que `src/app/api/operativo/logout/
route.test.ts`) — la lógica real de `isSesionActiveById` se ejercita a
través del mock, nunca se stubea el propio helper. Cache de replay HMAC
propia por archivo de test (no comparte estado con ningún otro test
existente). No reemplaza ni se mezcla con la autoridad de 34 archivos de
P2-T05/T13 — dominio completamente separado (realtime session validation,
no Push).

## P2-T11 STAGE3B — Phase A adversarial verification authority

```
TASK_ID=P2-T11-STAGE3B
P2_T11_STAGE3B=PASS_PHASE_A_PRECOMMIT_ADVERSARIAL_REVIEW
EXISTING_ROUTE_TEST_RECONFIRMED=14/14 PASS (re-ejecutado independientemente)
ADVERSARIAL_SCRIPT_CASES=19
ADVERSARIAL_SCRIPT_PASS=19
ADVERSARIAL_SCRIPT_FAIL=0
ADVERSARIAL_SCRIPT_LOCATION=temporal, nunca stageado, eliminado del repo inmediatamente tras su ejecución
INVALID_HMAC_DB_LOOKUP_COUNT=0 (confirmado empíricamente en 8 variantes distintas de request inválida)
EXCEPTION_FAIL_CLOSED=SI (lookup que lanza -> 500, nunca valid:true)
TSC_RECONFIRMED=31 raw, 0 nuevos en Phase A
LINT_RECONFIRMED=0 errores nuevos
BUILD_RECONFIRMED=PASS
```

El script adversarial cubrió casos que la suite de Stage3A no ejercitaba
directamente (secreto de firma incorrecto, bit-flip de una firma
genuina, conteo de invocaciones a `db.sesion.findUnique` en cada rama de
rechazo, excepción forzada del lookup, variantes de body malformado
incluyendo un intento de contaminación vía `__proto__`). Ningún caso
reveló auth bypass ni fail-open. No reemplaza la autoridad de 34 archivos
de P2-T05/T13 — dominio completamente separado.

## P2-T11 STAGE3C — Phase A exact local commit, focal re-run authority

```
TASK_ID=P2-T11-STAGE3C
P2_T11_STAGE3C=PASS_PHASE_A_EXACT_LOCAL_COMMIT
FOCAL_TEST_FILE=src/app/api/internal/realtime/session/route.test.ts
FOCAL_TEST_PASS=14
FOCAL_TEST_FAIL=0
FOCAL_TEST_DURATION_MS=152
COMMIT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
```

Re-ejecutado el test focal inmediatamente antes de stagear (no se
reutilizó ciegamente el número de Stage3B) — mismo resultado exacto.
Autoridad de Stage3B (14/14 + 19/19 adversarial) permanece vigente y sin
cambios, dado que el contenido de los 4 archivos fue confirmado
byte-idéntico (hashes reconfirmados) entre el cierre de Stage3B y el
commit de Stage3C.

## P2-T11 STAGE3D — Phase A exact-blob re-certification authority

```
TASK_ID=P2-T11-STAGE3D
P2_T11_STAGE3D=PASS_PHASE_A_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW
COMMIT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
FOCAL_TEST_RECONFIRMED=14/14 PASS (leído desde HEAD, no working tree)
ADVERSARIAL_RECHECK_RECONFIRMED=19/19 PASS (script temporal reutilizado, eliminado tras uso)
TSC_RECONFIRMED=31 raw, 0 nuevos
LINT_RECONFIRMED=0 errores nuevos
BUILD_RECONFIRMED=PASS
BLOB_IDS_DERIVED=SI (git ls-tree HEAD, no working tree hash)
GIT_GREP_INERTNESS_CHECK=PASS (0 referencias fuera de los 4 archivos de Phase A en todo el árbol de HEAD)
```

Toda la evidencia de esta re-certificación se derivó directamente de los
objetos Git del commit (`git show HEAD:<path>`, `git ls-tree HEAD`, `git
grep ... HEAD`), nunca del working tree como sustituto. No reemplaza la
autoridad de 34 archivos de P2-T05/T13 — dominio completamente separado.

## P2-T11 STAGE5G — final test authority (P2-T11 CLOSED, no re-ejecución)

```
TASK_ID=P2-T11-STAGE5G
P2_T11_STAGE5G_TEST_AUTHORITY_FINAL=SI
P2_T11=CLOSED
F_P2_T11_01_STATUS=RESOLVED
```

Agregado de la autoridad de tests ya persistida en cada fase, sin
re-ejecución (reutilización legítima, cross-referenciada contra
`GIT_DEPLOY_HISTORY.md`/`FINDINGS.md`/`COMPLETED_TASKS.md` sin
contradicción):

```
PHASE_A_ROUTE_TEST=14/14 PASS (Stage3A/3B/3D) + 19/19 adversarial temporal (Stage3B/3D)
PHASE_B_CHAT_SERVICE_SUITES=98/98 PASS (Stage4A/4B/4D) + 12/12 adversarial HMAC firmante-real<->verificador-real (Stage4B/4D)
PHASE_C_TOUCHED_FILES=9/9 PASS (Stage5A/5A-R1/5B/5C/5D)
PHASE_C_RELATED_TS_SUITE=47/47 PASS (Stage5A-R1/5B/5C/5D)
PHASE_C_CHAT_SERVICE_REGRESSION=98/98 PASS (sin regresión de Phase B, Stage5A-5D)
SERVER_RUNTIME_REAL=PASS (PostgreSQL real de TESTING + HTTP + socket, Stage4F + Stage5E)
BROWSER_RUNTIME_REAL=PASS (Chromium real vía CDP, Stage5F, 5 componentes primarios + 6 pruebas adversariales)
BUILD=PASS en cada re-ejecución (Stage5A-R1, 5B, 5C, 5D)
TSC_NEW_DIAGNOSTICS=0 en toda la historia de P2-T11
ESLINT_NEW_ERRORS=0 en toda la historia de P2-T11
FAIL_SKIP_ONLY_COUNT=0 en cualquier suite tocada por P2-T11
```

Ningún resultado FAIL, SKIP u ONLY residual en ninguna suite tocada por
P2-T11 en ninguna etapa de su historia. Esta autoridad es completamente
independiente de la autoridad de 34 archivos de P2-T05/T13 — dominio
separado, sin overlap de archivos.

## CONTRATO FUTURO — same-browser multi-actor session coexistence (P2-T18-BLOCKER-AUTH1, congelado, no ejecutado)

Ningún test de esta sección existe todavía — es el contrato de
aceptación congelado para `P2-T18-BLOCKER-AUTH2` (implementación
futura), no autoridad vigente de ningún suite actual.

```
TEST 1  — Cliente login -> Cliente session usable.
TEST 2  — Negocio login while Cliente remains logged in -> both remain usable.
TEST 3  — /api Cliente uses Cliente identity.
TEST 4  — /api Negocio uses Negocio identity.
TEST 5  — logout Cliente leaves Negocio active.
TEST 6  — logout Negocio leaves Cliente active.
TEST 7  — two Cliente tabs share Cliente actor.
TEST 8  — two Negocio tabs share Negocio actor.
TEST 9  — realtime token Cliente maps Cliente sid.
TEST 10 — realtime token Negocio maps Negocio sid.
TEST 11 — wrong actor cookie cannot authorize wrong API family.
TEST 12 — no auth token becomes JS-readable.
TEST 13 — existing concurrent DB sessions remain valid.
TEST 14 — P2-T11 connect-time validation still works for exact sid.
```

Los 14 son `PRODUCT_REQUIRED` y `TEST_REQUIRED` simultáneamente, sin
ningún `OPTIONAL_IF_PROVEN` identificado. Detalle completo del diseño
que estos tests certificarían en
`codex-reports/archive/P2-T18-BLOCKER-AUTH1.md` (una vez archivado) o
`codex-reports/CURRENT_TASK.md` mientras esté vigente.

## AUTORIDAD VIGENTE — Fase 1 de same-browser multi-actor session coexistence (P2-T18-BLOCKER-AUTH2-R2-R2, local, no commiteada)

Este bloque SÍ es autoridad vigente (a diferencia del contrato futuro
arriba, que sigue siendo el objetivo final de Fase 2) — los 5 archivos
de test siguientes existen, corren contra código real (`src/proxy.ts`,
`src/lib/auth.ts`, `login/route.ts`, `logout/route.ts`, sin modificar
salvo la corrección puntual del header en `proxy.ts`), y están 100%
PASS al cierre de esta etapa:

```
PHASE1_LOCAL_TEST_RESULTS (2026-08-28, AUTH2-R2-R2):
src/proxy.test.ts                                              = 23/23 PASS (19 originales de AUTH2-R2 + 4 adversariales nuevos de sanitización de x-resolved-actor-family)
src/lib/actor-family-session-coexistence.integration.test.ts   = 5/5 PASS (contra TESTING real, DELIGO_TEST_DATABASE_URL)
src/lib/session-login-atomicity.integration.test.ts            = 7/7 PASS (contra TESTING real, regresión)
src/lib/session-login-atomicity-wiring-static-contract.test.ts = 19/19 PASS (contrato estático, regresión)
src/lib/client-block-security.integration.test.ts              = 19/19 PASS (contra TESTING real, regresión)
TOTAL = 73/73 PASS
R2_R2_SECURITY_MATRIX = 12/12 PASS
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0 (en los 2 archivos corregidos; diagnósticos preexistentes en archivos ajenos confirmados baseline)
BUILD = PASS ("Compiled successfully in 24.9s", "ƒ Proxy (Middleware)" confirmado)
```

Sin commit todavía — esta autoridad es local, pendiente de
`P2-T18-BLOCKER-AUTH2-R4` (commit local exacto) antes de convertirse en
autoridad certificada post-commit/post-deploy.

`P2-T18-BLOCKER-AUTH2-R3-R1` (2026-08-28) re-ejecutó fresca la misma
autoridad de 5 archivos, tras la reconciliación de alcance precommit
(excepción única autorizada del hunk de tipos de `req()` en
`proxy.test.ts`, ver `codex-reports/CURRENT_TASK.md`):

```
PHASE1_LOCAL_TEST_RESULTS (2026-08-28, AUTH2-R3-R1, fresco):
src/proxy.test.ts                                              = 23/23 PASS
(los otros 4 archivos, ejecutados juntos)                      = 50/50 PASS
TOTAL = 73/73 PASS (coincide exactamente con AUTH2-R2-R2)
R3_R1_SECURITY_MATRIX = 16/16 PASS
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0 (único diagnóstico restante: src/lib/auth.ts:58, preexistente/ajeno)
BUILD = PASS ("Compiled successfully in 25.1s", "ƒ Proxy (Middleware)" confirmado)
FINGERPRINT_STABLE = SI (9/9 paths idénticos antes/después)
```

Fase 1 queda `PASS_PRECOMMIT_SCOPE_RECONCILED_SINGLE_TEST_ONLY_EXCEPTION_ACCEPTED`,
lista para `P2-T18-BLOCKER-AUTH2-R4` (commit local exacto).

`P2-T18-BLOCKER-AUTH2-R4` (2026-08-28) re-ejecutó fresca la misma
autoridad de 5 archivos una vez más, inmediatamente antes de stagear
(gate obligatorio pre-staging):

```
PHASE1_LOCAL_TEST_RESULTS (2026-08-28, AUTH2-R4, fresco):
src/proxy.test.ts                                              = 23/23 PASS
(los otros 4 archivos, ejecutados juntos)                      = 50/50 PASS
TOTAL = 73/73 PASS (tercera confirmación consecutiva del mismo total exacto)
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0 (único diagnóstico restante: src/lib/auth.ts:58, preexistente/ajeno)
BUILD = PASS ("Compiled successfully in 38.8s", "ƒ Proxy (Middleware)" confirmado)
FINGERPRINT_STABLE = SI (9/9 paths idénticos antes/después de tests/lint/tsc/build)
```

Esta autoridad quedó commiteada en
`c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb` (parent
`1adcc01f5380d896bed6e46dcd11bccb90d39e07`) — los 9 blobs commiteados
son idénticos a los certificados, verificado vía `git ls-tree HEAD`.
Sin push todavía; esta autoridad sigue siendo local hasta
`P2-T18-BLOCKER-AUTH2-R5` (revisión postcommit/prepush) y el push/deploy
subsiguiente.

`P2-T18-BLOCKER-AUTH2-R5` (2026-08-28) re-ejecutó fresca la misma
autoridad directamente desde el working tree (idéntico byte a byte al
commit `c047e9eb`, verificado):

```
PHASE1_LOCAL_TEST_RESULTS (2026-08-28, AUTH2-R5):
src/proxy.test.ts                                              = 23/23 PASS
(los otros 4 archivos, intento 1)                              = 49/50 PASS (1 fallo aislado, transitorio)
(los otros 4 archivos, aislado el test fallido)                = 1/1 PASS
(los otros 4 archivos, intento 2, grupo completo)               = 50/50 PASS
TOTAL FINAL REPRODUCIBLE = 73/73 PASS (cuarta confirmación consecutiva del mismo total exacto)
```

El único fallo observado fue en
`client-block-security.integration.test.ts`, test "misma IP,
dispositivos concurrentes: ningún login falla por P2002 (ip,
clienteId)" — un test que ejecuta 3 logins REALMENTE concurrentes
(`Promise.all`) contra PostgreSQL de TESTING, diseñado para ejercitar
una condición de carrera de infraestructura ya resuelta por una
migración anterior (índice único legacy eliminado). No forma parte del
diff de Fase 1. Dos re-ejecuciones limpias sin tocar código
confirmaron que fue un flake transitorio, no una regresión.

```
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0 (único diagnóstico restante: src/lib/auth.ts:58, preexistente/ajeno)
BUILD = PASS ("Compiled successfully in 25.2s", "ƒ Proxy (Middleware)" confirmado)
FINGERPRINT_STABLE = SI (9/9 paths idénticos en todo momento, incluidas ambas re-ejecuciones)
```

`P2-T18-BLOCKER-AUTH2-R7` (2026-08-28, sólo diseño, sin ejecutar
tests): congeló la autoridad de test futura de Fase 2 — ver
`codex-reports/CURRENT_TASK.md` §TEST_ALLOWLIST. Mandatorios nuevos/a
modificar: `src/providers/realtime-provider-cross-tab-static-contract.test.ts`
(actualizar sólo la assertion #2, que asume el literal fijo
`"deligo-auth"`), más 4 tests unitarios nuevos (helper
`activeSessionFamily`, storage adapter de `auth-store.ts`, selector en
`use-auth.ts`, selector en `realtime-client.ts`). Gate de regresión
sin cambio esperado: los 5 archivos de la autoridad de Fase 1 más
`src/lib/realtime-manager.test.ts` (confirmando que 0 cambios ahí
siguen siendo correctos, tras el hallazgo de que `realtime-manager.ts`
no requiere modificación). Ningún archivo de test fue creado ni
modificado en esta etapa — sólo diseño.

`P2-T18-BLOCKER-AUTH2-R8` (2026-08-28) implementó exactamente esa
autoridad congelada:

```
PHASE2_LOCAL_TEST_RESULTS (2026-08-28, AUTH2-R8):
MANDATORIOS (nuevos/modificados):
  src/store/auth-store.test.ts (nuevo)                                = 9/9 PASS (localStorage real vía happy-dom)
  src/lib/realtime-client.test.ts (nuevo)                             = 7/7 PASS (fetch mockeado)
  src/hooks/use-auth-static-contract.test.ts (nuevo)                  = 11/11 PASS (contrato estático)
  src/providers/realtime-provider-cross-tab-static-contract.test.ts (assertion #2 actualizada) = 6/6 PASS
  SUBTOTAL MANDATORIO = 33/33 PASS

REGRESIÓN (sin cambio, gate):
  src/proxy.test.ts + src/lib/realtime-manager.test.ts + src/lib/session-login-atomicity-wiring-static-contract.test.ts = 66/66 PASS
  src/lib/actor-family-session-coexistence.integration.test.ts + src/lib/session-login-atomicity.integration.test.ts + src/lib/client-block-security.integration.test.ts = 31/31 PASS
  SUBTOTAL REGRESIÓN = 97/97 PASS

TOTAL = 130/130 PASS, 0 fail
```

```
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0
BUILD = PASS ("Compiled successfully in 25.0s")
R8_PHASE2_SECURITY_MATRIX = 20/20 PASS
R8_LOCAL_ACCEPTANCE_MATRIX = 10/10 PASS
REALTIME_MANAGER_BYTE_IDENTICAL = SI
REALTIME_TYPES_BYTE_IDENTICAL = SI
PHASE1_SERVER_BYTE_IDENTICAL = SI
```

Hallazgo del propio proceso de testing: la primera versión de
`activeSessionFamily()` no era boundary-safe (`/clientevil` matcheaba
`/cliente`) — detectado por el nuevo test unitario, corregido dentro
del mismo archivo antes de considerarse terminado. Fase 2 queda
`PASS_PHASE2_CLIENT_ACTIVATION_LOCAL_IMPLEMENTED`, sin commit todavía
— autoridad local, pendiente de `P2-T18-BLOCKER-AUTH2-R9` (revisión
adversarial precommit).

9/9 blobs commiteados re-verificados idénticos vía `git show
HEAD:<path>` + hash recomputado de forma independiente. Fase 1 queda
`R5_PHASE1_COMMIT_TECHNICALLY_CERTIFIED=SI`,
`P2_T18_PHASE1_SAFE_TO_PUSH=YES_AFTER_FRESH_R6_PREPUSH_GATES` — R6 debe
repetir estos gates completamente frescos inmediatamente antes de
cualquier push.

`P2-T18-BLOCKER-AUTH2-R6` (2026-08-28) repitió la autoridad completa
como corrida DECISIVA ÚNICA (sin reintentos permitidos) inmediatamente
antes del push:

```
PHASE1_LOCAL_TEST_RESULTS (2026-08-28, AUTH2-R6, decisiva, primera y
única corrida):
src/proxy.test.ts                                              = 23/23 PASS
(los otros 4 archivos)                                          = 50/50 PASS
TOTAL = 73/73 PASS (quinta confirmación consecutiva del mismo total
  exacto, y la única que decide si se autoriza el push)
```

```
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0 (único diagnóstico restante: src/lib/auth.ts:58, preexistente/ajeno)
BUILD = PASS ("Compiled successfully in 25.4s", "ƒ Proxy (Middleware)" confirmado)
FINGERPRINT_STABLE = SI
```

Con todos los gates en verde, se ejecutó exactamente `git push origin
testing-codex` (`1adcc01f..c047e9eb`). Autodeploy Git-triggered de
`DeliGO Copy` y `chat en vivo` confirmados `SUCCESS` con
`commitHash=c047e9eb` exacto desde metadata real de Railway. Esta
autoridad de test PASA a ser considerada certificada en TESTING —
además re-certificada en runtime real contra el backend desplegado
(16/16 casos, ver `codex-reports/CURRENT_TASK.md` §RUNTIME_SECURITY_MATRIX),
no sólo localmente.

```
P2_T18_PHASE1_SAFE_TO_PUSH=DONE_PUSHED_AND_DEPLOYED_IN_R6
```

`P2-T18-BLOCKER-AUTH2-R9` (2026-08-28) re-ejecutó en fresco toda la
autoridad local de Fase 2 dejada por R8, sin confiar en su propio
resultado previo:

```
PHASE2_FRESH_TEST_RESULTS (2026-08-28, AUTH2-R9, independiente):
MANDATORIOS:
  src/store/auth-store.test.ts                                        = 9/9 PASS
  src/lib/realtime-client.test.ts                                     = 7/7 PASS
  src/hooks/use-auth-static-contract.test.ts                          = 11/11 PASS
  src/providers/realtime-provider-cross-tab-static-contract.test.ts   = 6/6 PASS
  SUBTOTAL MANDATORIO = 33/33 PASS

REGRESIÓN:
  src/proxy.test.ts + src/lib/realtime-manager.test.ts + src/lib/session-login-atomicity-wiring-static-contract.test.ts = 66/66 PASS
  src/lib/actor-family-session-coexistence.integration.test.ts + src/lib/session-login-atomicity.integration.test.ts + src/lib/client-block-security.integration.test.ts = 31/31 PASS
  SUBTOTAL REGRESIÓN = 97/97 PASS

TOTAL = 130/130 PASS, 0 fail (coincide exactamente con el total de R8, re-derivado no copiado)
```

```
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0
BUILD = PASS
```

Además de la corrida fresca, R9 ejecutó **mutation testing aislado**
fuera del repo (espejo de los archivos relevantes en un directorio
temporal ajeno al repositorio, con `tsconfig.json` propio mapeando
`@/*`/`zustand`/`@happy-dom/global-registrator` a las rutas reales vía
`paths` para poder correr `bun test` fielmente sin tocar el repo real
— la misma técnica ya usada en el contrafactual TypeScript de R3-R1):

```
R9_MUTANTS_ATTEMPTED=12
R9_MUTANTS_DETECTED=10
R9_MUTANTS_SURVIVED=2
```

Sobrevivientes: (5) `getItem` del storage adapter hardcodeado a la
familia Cliente — `auth-store.test.ts` no ejercita el camino de
rehidratación de una instancia fresca del store, sólo lo que queda
escrito en `localStorage` tras `loginX()`/`logout()`; (12) listener
cross-tab mutado para aceptar también la clave legacy plana
`deligo-auth` — la assertion #2 de
`realtime-provider-cross-tab-static-contract.test.ts` sólo detecta
PRESENCIA del patrón de comparación correcto vía `toContain`/`toMatch`,
no AUSENCIA de una condición OR adicional insertada en el mismo
bloque. Código real verificado correcto por lectura directa en ambos
casos — gap de cobertura de test, no defecto de producto. Por regla
explícita de la etapa, esto resulta en **BLOCK**
(`P2_T18_BLOCKER_AUTH2_R9=BLOCKED_PHASE2_PRECOMMIT_DEFECT_REQUIRES_FOCUSED_CORRECTION`),
sin ninguna corrección de test intentada en R9. `P2-T18-BLOCKER-AUTH2-R9-R1`
queda como la autoridad de test pendiente: agregar exactamente (a)
un test de rehidratación/`getItem` por familia en
`auth-store.test.ts`, y (b) una assertion que detecte la ausencia de
un bypass OR agregado a la clave legacy en
`realtime-provider-cross-tab-static-contract.test.ts` — sin ningún
cambio de código de producción, y volviendo a ejecutar el mutation
testing de los mutantes #5 y #12 contra la batería fortalecida para
confirmar que ahora sí los detecta.

```
P2_T18_PHASE2_SAFE_TO_COMMIT=NO_BLOCKED_AWAITING_R9_R1_TEST_COVERAGE_CLOSURE
```

`P2-T18-BLOCKER-AUTH2-R9-R1` (2026-08-28) cerró los 2 gaps
identificados, estrictamente sólo-test (7/7 archivos de producto
byte-idénticos a R9, re-verificados):

```
PHASE2_R9_R1_TEST_RESULTS (2026-08-28, AUTH2-R9-R1):
MANDATORIOS:
  src/store/auth-store.test.ts (2 tests nuevos: rehidratación Cliente/Negocio) = 11/11 PASS
  src/lib/realtime-client.test.ts (sin cambio)                                = 7/7 PASS
  src/hooks/use-auth-static-contract.test.ts (sin cambio)                     = 11/11 PASS
  src/providers/realtime-provider-cross-tab-static-contract.test.ts (1 test nuevo: guard exacto) = 7/7 PASS
  SUBTOTAL MANDATORIO = 36/36 PASS (33 preexistentes + 3 nuevos)

REGRESIÓN (sin cambio, gate):
  src/proxy.test.ts + src/lib/realtime-manager.test.ts + src/lib/session-login-atomicity-wiring-static-contract.test.ts = 66/66 PASS
  src/lib/actor-family-session-coexistence.integration.test.ts + src/lib/session-login-atomicity.integration.test.ts + src/lib/client-block-security.integration.test.ts = 31/31 PASS (primera corrida agotó timeout de 2min por latencia de red hacia la DB real de TESTING — investigado, no descartado; segunda corrida con más tiempo dio 31/31 en 209.9s)
  SUBTOTAL REGRESIÓN = 97/97 PASS

TOTAL = 133/133 PASS, 0 fail (130 preexistentes sin regresión + 3 nuevos)
```

```
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0
BUILD = PASS ("Compiled successfully in 25.5s")
R9_R1_PHASE2_SECURITY_MATRIX = 20/20 PASS (cierra los 3 casos que R9 dejaba como implementación-correcta/gap-de-test)
R9_R1_LOCAL_ACCEPTANCE_MATRIX = 10/10 PASS
```

**Mutation testing replay completo** (mismo espejo aislado fuera del
repo, misma metodología que R9): de los 12 mutantes de R9, los 2 que
sobrevivían (mutante #5 — `getItem` hardcodeado a la familia Cliente;
mutante #12 — listener cross-tab aceptando también la clave legacy
plana) ahora quedan detectados:

```
R9_R1_MUTANTS_ATTEMPTED=12
R9_R1_MUTANTS_DETECTED=12
R9_R1_MUTANTS_SURVIVED=0
R9_MUTANT_5_DETECTED=SI (1 fail — Escenario B de rehidratación, pathname=/negocio recibe user.id="cliente-fixture" en vez de "negocio-fixture")
R9_MUTANT_12_DETECTED=SI (1 fail — guardLine mutado a "if (event.key !== expectedKey && event.key !== \"deligo-auth\") return", no coincide con el toBe() exacto)
```

Mutantes #1–#4, #6–#11 siguen detectados con la misma o mayor cantidad
de fallos que en R9 (algunos +1 fallo adicional por incidencia
colateral de los 3 tests nuevos, sin cambiar su clasificación de
DETECTED). Ningún mutante nuevo, distinto de los 12 de R9, fue
necesario ni se introdujo.

Fase 2 pasa a `PHASE2_PRECOMMIT_CERTIFIED_AWAITING_EXACT_LOCAL_COMMIT` —
autoridad de test lista para `P2-T18-BLOCKER-AUTH2-R10` (commit exacto
local), no ejecutado en esta etapa.

```
P2_T18_PHASE2_SAFE_TO_COMMIT=YES_AFTER_FRESH_R10_PRECOMMIT_GATES
```

`P2-T18-BLOCKER-AUTH2-R10` (2026-08-28) ejecutó la corrida DECISIVA
ÚNICA inmediatamente antes del commit local:

```
PHASE2_R10_DECISIVE_TEST_RESULTS (2026-08-28, AUTH2-R10, primera y única corrida):
src/store/auth-store.test.ts + src/lib/realtime-client.test.ts + src/hooks/use-auth-static-contract.test.ts + src/providers/realtime-provider-cross-tab-static-contract.test.ts + src/proxy.test.ts + src/lib/realtime-manager.test.ts + src/lib/session-login-atomicity-wiring-static-contract.test.ts = 102/102 PASS
src/lib/actor-family-session-coexistence.integration.test.ts + src/lib/session-login-atomicity.integration.test.ts + src/lib/client-block-security.integration.test.ts = 31/31 PASS (208.26s, timeout ampliado desde el inicio por la lección de latencia de R9-R1)

TOTAL = 133/133 PASS, 0 fail
```

No se re-ejecutó la campaña de mutation testing de 12 mutantes en esta
etapa — el fingerprint byte-a-byte 11/11 idéntico al certificado por
R9-R1, sumado a esta corrida fresca, se consideró prueba suficiente de
identidad de la autoridad de test (regla explícita de la etapa: "no
rerun an unnecessary mutation campaign unless needed to verify
fingerprint/test-authority identity" — ya verificada por ambos medios).

```
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0
BUILD = PASS ("Compiled successfully in 24.3s")
R10_PHASE2_SECURITY_MATRIX = 20/20 PASS (reconfirmada, sin regresión)
R10_LOCAL_ACCEPTANCE_MATRIX = 10/10 PASS (reconfirmada, sin regresión)
```

Con esta autoridad certificada, se creó el commit local exacto
`a1579f11e79a41b90c6df4d2e8573ca9a669b856` (parent `c047e9eb`, sin
push) — ver `codex-reports/GIT_DEPLOY_HISTORY.md` para el detalle
completo de Git. La autoridad de test de Fase 2 queda commiteada
localmente, lista para `P2-T18-BLOCKER-AUTH2-R11` (revisión
postcommit/prepush) antes de cualquier push futuro.

```
P2_T18_PHASE2_COMMITTED_LOCALLY=SI
P2_T18_PHASE2_PUSHED=NO
```

`P2-T18-BLOCKER-AUTH2-R11` (2026-08-28) repitió, de forma
independiente y directamente desde los objetos Git del commit
`a1579f11e79a41b90c6df4d2e8573ca9a669b856`, la corrida DECISIVA única:

```
PHASE2_R11_DECISIVE_TEST_RESULTS (2026-08-28, AUTH2-R11, primera y única corrida):
src/store/auth-store.test.ts + src/lib/realtime-client.test.ts + src/hooks/use-auth-static-contract.test.ts + src/providers/realtime-provider-cross-tab-static-contract.test.ts + src/proxy.test.ts + src/lib/realtime-manager.test.ts + src/lib/session-login-atomicity-wiring-static-contract.test.ts = 102/102 PASS
src/lib/actor-family-session-coexistence.integration.test.ts + src/lib/session-login-atomicity.integration.test.ts + src/lib/client-block-security.integration.test.ts = 31/31 PASS (206.19s, DELIGO_TEST_DATABASE_URL exclusivamente)

TOTAL = 133/133 PASS, 0 fail
```

```
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0
GIT_SHOW_CHECK = PASS (git show --check HEAD, sin errores de whitespace)
GIT_DIFF_CHECK = PASS
BUILD = PASS ("Compiled successfully in 24.7s")
R11_PHASE2_SECURITY_MATRIX = 20/20 PASS (reconstruida independientemente desde los blobs committed)
R11_LOCAL_ACCEPTANCE_MATRIX = 10/10 PASS (reconstruida independientemente)
```

En vez de repetir la campaña completa de 12 mutantes, R11 probó
identidad exacta de bytes: los 11 blobs commiteados en `HEAD` son
byte-idénticos a los staged por R10, que a su vez son byte-idénticos a
los certificados por R9-R1 (incluida explícitamente la cobertura que
cerró los mutantes #5/#12 — confirmada presente por lectura directa
del texto de los blobs: el `describe` de rehidratación en
`auth-store.test.ts` y el test 7 de guard exacto en
`realtime-provider-cross-tab-static-contract.test.ts`). Por lo tanto:

```
R9_R1_MUTATION_AUTHORITY_APPLIES_TO_R11_COMMIT=SI
R11_MUTATION_COVERAGE=12_OF_12_BY_CERTIFIED_BLOB_IDENTITY
```

Fingerprint de los 11 paths estable antes y después de toda la
revisión (`R11_FINGERPRINT_STABLE=SI`, cero mutación de fuente/test).

```
P2_T18_PHASE2_COMMIT_TECHNICALLY_CERTIFIED=SI
P2_T18_PHASE2_SAFE_TO_PUSH=YES_AFTER_FRESH_R12_PREPUSH_GATES
```

Esta certificación NO exime a `P2-T18-BLOCKER-AUTH2-R12` de repetir
sus propios gates decisivos frescos inmediatamente antes del push
real — R11 certifica el commit, no otorga permiso ciego para pushear
más adelante sin reverificar.

`P2-T18-BLOCKER-AUTH2-R12` (2026-08-28) repitió la corrida DECISIVA
única inmediatamente antes del push:

```
PHASE2_R12_PREPUSH_DECISIVE_TEST_RESULTS (2026-08-28, AUTH2-R12, primera y única corrida):
src/store/auth-store.test.ts + src/lib/realtime-client.test.ts + src/hooks/use-auth-static-contract.test.ts + src/providers/realtime-provider-cross-tab-static-contract.test.ts + src/proxy.test.ts + src/lib/realtime-manager.test.ts + src/lib/session-login-atomicity-wiring-static-contract.test.ts = 102/102 PASS
src/lib/actor-family-session-coexistence.integration.test.ts + src/lib/session-login-atomicity.integration.test.ts + src/lib/client-block-security.integration.test.ts = 31/31 PASS (207.09s, DELIGO_TEST_DATABASE_URL exclusivamente)

TOTAL = 133/133 PASS, 0 fail (quinta confirmación consecutiva del mismo total exacto: R8, R9, R9-R1, R11, R12)
```

```
NEW_ESLINT_ERRORS = 0
NEW_TSC_ERRORS = 0
GIT_SHOW_CHECK = PASS
GIT_DIFF_CHECK = PASS
BUILD = PASS ("Compiled successfully in 30.3s", usando exactamente el source de a1579f11)
```

Con todos los gates en verde, se ejecutó exactamente `git push origin
testing-codex` (`c047e9eb..a1579f1`). Autodeploy Git-triggered de
`DeliGO Copy` y `chat en vivo` confirmados `SUCCESS` con
`commitHash=a1579f11` exacto desde metadata real de Railway. Esta
autoridad de test PASA a ser considerada certificada en TESTING —
además re-certificada en runtime real contra el backend desplegado
mediante un smoke de regresión de Fase 1 server sin navegador (7
casos, ver `codex-reports/CURRENT_TASK.md` §PHASE1_SERVER_REGRESSION_SMOKE),
no sólo localmente.

```
P2_T18_PHASE2_SAFE_TO_PUSH=DONE_PUSHED_AND_DEPLOYED_IN_R12
PHASE2_BROWSER_BEHAVIOR_CERTIFIED=NO
```

La certificación de comportamiento real en navegador (aceptación de
la coexistencia Cliente+Negocio) queda íntegramente para
`P2-T18-BLOCKER-AUTH2-R13`, no ejecutada todavía.

`P2-T18-BLOCKER-AUTH2-R13` (2026-08-28) no agrega autoridad de test
automatizado nueva — es exclusivamente una certificación de
comportamiento REAL en navegador contra TESTING ya desplegado en
`a1579f11`. No se ejecutó `bun test`/lint/TSC/build en esta etapa (no
hubo cambio de código que lo requiriera); la autoridad de 133/133
sigue siendo la vigente, sin alteración.

Evidencia de red real recogida durante R13 (no un test automatizado,
pero registrada aquí por su valor de autoridad empírica sobre el
comportamiento real del backend desplegado):

```
GET /api/auth/me?actorFamily=cliente      -> 200 (repetido, antes y después del login de Negocio, y en cada reload)
GET /api/auth/me?actorFamily=negocio      -> 200 (repetido, antes y después del login de Cliente, y en cada reload)
POST /api/realtime/token?actorFamily=cliente     -> 200 (al abrir el chat real de Cliente)
POST /api/realtime/authorize?actorFamily=cliente -> 200 (ídem)
GET /api/chat/no-leidos       -> 200 (antes del login de Negocio) / 401 (después, coexistencia real)
GET /api/chat/conversaciones  -> 200 (antes del login de Negocio) / 401 (después, coexistencia real)
```

La transición 200→401 de los dos últimos endpoints, reproducida de
forma determinística (no una sola vez) contra el backend real, es la
evidencia primaria del defecto `F-P2-T18-AUTH02` registrado en
`codex-reports/FINDINGS.md`. Ningún test unitario/integración mockeado
de la autoridad 133/133 cubre esta categoría de endpoint bajo
coexistencia real de 2+ cookies — gap de cobertura que
`P2-T18-BLOCKER-AUTH2-R13-R1` debe cerrar junto con la corrección.

```
P2_T18_PHASE2_REAL_BROWSER_CERTIFICATION=BLOCKED_REAL_BROWSER_PRODUCT_DEFECT
R13_AUTH01_ACCEPTANCE_MATRIX=9_OF_18_CONFIRMED_1_OF_18_CLEANUP_8_OF_18_NOT_REACHED
```

`P2-T18-BLOCKER-AUTH2-R13-R1` (2026-08-28, read-only) no ejecuta
ningún test — es reconciliación de causa raíz/callers/allowlist. No
agrega autoridad de test nueva; congela cuál autoridad de test
existente deberá modificarse/crearse en R13-R2:

```
AUTH02_RECONCILED_TEST_ALLOWLIST_COUNT=7
MANDATORY_MODIFIED=4 (src/proxy.test.ts, src/components/chat/chat-sheet.test.tsx, src/components/shared/permission-prompt-static-contract.test.ts, src/hooks/use-push-notifications-static-contract.test.ts)
MANDATORY_NEW=3 (chat-fab.tsx, chat-view.tsx, share-target-flow.tsx — CERO cobertura de test hoy, gap preexistente confirmado por búsqueda exhaustiva de archivos, no introducido por esta tarea)
REGRESSION_ONLY=src/app/api/chat/mensajes/[pedidoId]/route.test.ts + src/app/api/push/{subscribe,unsubscribe,status}/route.test.ts + toda la autoridad ya certificada de Fase 1/Fase 2 (133 tests) + P2-T13 (146+ focal) — ninguno debe cambiar de resultado, los route handlers quedan byte-frozen
```

Confirmado por lectura directa de `src/proxy.test.ts` (líneas 123-160)
que el patrón exacto de test necesario para los 6 prefijos nuevos ya
existe como plantilla reutilizable (cookies+selector válido/inválido/
ausente/desconocido, ya ejercido para `/api/auth/me`/`/api/auth/logout`).

```
P2_T18_BLOCKER_AUTH2_R13_R1=PASS_AUTH02_ROOT_CAUSE_SCOPE_AND_FIX_CONTRACT_REFROZEN
```

`P2-T18-BLOCKER-AUTH2-R13-R2` (2026-08-28) implementó localmente el
contrato de los 7 archivos de producto congelado por R13-R1, y
modificó/creó exactamente los 7 archivos de test también congelados
(4 modificados + 3 nuevos). Autoridad focal AUTH02 nueva:

```
PHASE2_R13_R2_AUTH02_FOCAL_TEST_RESULTS (2026-08-28, AUTH2-R13-R2, primera corrida):
src/proxy.test.ts + src/components/chat/chat-sheet.test.tsx + src/components/shared/permission-prompt-static-contract.test.ts + src/hooks/use-push-notifications-static-contract.test.ts + src/components/chat/chat-fab.test.tsx + src/components/chat/chat-view.test.tsx + src/components/chat/share-target-flow.test.tsx = 117/117 PASS
```

Regresión completa ejecutada en 3 tandas (nunca mezclada con la
autoridad focal, para poder atribuir cualquier fallo a la tanda
exacta):

```
TANDA_1_UNIT_Y_ROUTE (sin DB) = 163/163 PASS
  src/store/auth-store.test.ts + src/lib/realtime-client.test.ts +
  src/hooks/use-auth-static-contract.test.ts +
  src/providers/realtime-provider-cross-tab-static-contract.test.ts +
  src/lib/realtime-manager.test.ts +
  src/lib/session-login-atomicity-wiring-static-contract.test.ts +
  src/app/api/chat/mensajes/[pedidoId]/route.test.ts +
  src/app/api/push/subscribe/route.test.ts +
  src/app/api/push/unsubscribe/route.test.ts +
  src/app/api/push/status/route.test.ts

TANDA_2_INTEGRATION (DB real, DATABASE_URL=$DELIGO_TEST_DATABASE_URL, 216s) = 31/31 PASS
  src/lib/actor-family-session-coexistence.integration.test.ts +
  src/lib/session-login-atomicity.integration.test.ts +
  src/lib/client-block-security.integration.test.ts

TANDA_3_P2_T13_FOCAL (sin DB) = 100/100 PASS
  src/lib/push-subscription-repository.test.ts +
  src/lib/push-subscription-http.test.ts

TOTAL_REGRESION = 294/294 PASS, 0 fail
```

`DATABASE_URL_FALLBACK_USED=NO` — la Tanda 2 se ejecutó exportando
`DATABASE_URL` como el valor de `DELIGO_TEST_DATABASE_URL` únicamente
para esa invocación de `bun test` (Prisma sólo puede leer
`env("DATABASE_URL")` desde `schema.prisma`), nunca contra la base de
datos real de producción.

Corrección de aserciones literales en 3 de los 4 test files
existentes modificados — no una debilitación, una actualización
mecánica al texto exacto del código nuevo (ver
`codex-reports/DECISIONS_AND_INVARIANTS.md` para el detalle completo
de cada caso): `src/components/shared/permission-prompt-static-contract.test.ts`
(deps array `}, [isMozo])`→`}, [isMozo, uType])`, llamadas con 1 vs. 2
argumentos, `fetch("/api/push/status"` literal → `fetch(url` +
verificación del literal base por separado) y
`src/hooks/use-push-notifications-static-contract.test.ts` (idéntico
patrón para `unsubscribeUrl`/`statusUrl`, y el conteo exacto de
ocurrencias de `/api/push/unsubscribe` en el archivo, que pasó de 1 a
3 por el comentario nuevo + el template literal + el fallback de
string).

```
ESLINT_R13_R2 (14 paths mutados) = 0 errores
TSC_R13_R2 (proyecto completo) = 0 errores NUEVOS (2 diagnósticos TS2367 preexistentes en permission-prompt.tsx líneas 302/304, confirmados idénticos contra el blob a1579f11:src/components/shared/permission-prompt.tsx, no relacionados con el diff, no corregidos)
GIT_DIFF_CHECK_R13_R2 = PASS (exit 0; avisos de normalización CRLF del propio Git, no errores)
BUILD_R13_R2 = PASS ("Compiled successfully", ƒ Proxy (Middleware) confirmado sin conflicto)
FROZEN_NEIGHBOR_FINGERPRINT_R13_R2 = 17/17 archivos SHA-256 idénticos pre/post (6 route handlers + 11 vecinos congelados)
```

Esta autoridad de test NO fue commiteada — permanece en el working
tree, sin `git add`, esperando la revisión adversarial precommit de
`P2-T18-BLOCKER-AUTH2-R13-R3`.

`P2-T18-BLOCKER-AUTH2-R13-R3` (2026-08-28) auditó adversarialmente
esta autoridad, sin recertificarla ni ejecutarla en fresco (per la
regla stop-on-objective, el BLOCK quedó demostrado antes de llegar a
esa fase). En su lugar, la sometió a una **campaña de mutación de 19
mutantes** en un harness temporal fuera del repo (junction a
`node_modules` real + copia del `src/` con el diff de AUTH02
aplicado; verificado con una corrida baseline idéntica de 117/117
antes de mutar nada; eliminado al finalizar):

```
R13_R3_MUTATION_CAMPAIGN_RESULT:
mutantes intentados = 19
detectados = 17
sobrevivientes = 2
```

**Sobreviviente #1 — `/api/chat/cleanup` agregado por error a
`SELECTOR_ENDPOINT_PREFIXES`**: reclasificado `MUTANTE_EQUIVALENTE`
tras trazar `checkRouteProtection()` completo — el paso de rutas
públicas aprueba `cleanup` antes de que el selector importe, y su
handler (byte-frozen) nunca lee la cookie resuelta. Ningún test podría
detectarlo sin verificar un detalle de implementación sin consecuencia
observable. No es un gap de cobertura — no requiere corrección.

**Sobreviviente #2 — GAP REAL DE COBERTURA CONFIRMADO**: en
`src/hooks/use-push-notifications.ts`, el `fetch()` de `subscribe`
mutado para dejar de usar la variable `subscribeUrl` (revertido a un
literal bare) — `src/hooks/use-push-notifications-static-contract.test.ts`
NO lo detectó. El describe `"F-P2-T18-AUTH02 — use-push-notifications
actorFamily selector propagation"` (test: `"all three call sites...
build their URL from actorType..."`) sólo verifica que la línea
`const subscribeUrl = actorType ? ... : ...` exista como substring del
archivo — nunca que `fetch(subscribeUrl` sea el call site real
consumido. El mismo archivo SÍ tiene esa verificación explícita para
`unsubscribeUrl` (línea 25: `expect(src).toContain("fetch(unsubscribeUrl")`,
además confirmado por mutación — M10 detectado con 2 fallos) y, vía el
describe preexistente F-P2-T05-13 corregido en R13-R2, para
`statusUrl` (`expect(checkSubscriptionBody).toContain('fetch(statusUrl')`,
confirmado por mutación — M11 detectado con 1 fallo). Confirmado por
lectura directa del código real (mismo diff ya releído en R13-R3) que
el producto SÍ está correctamente implementado
(`const res = await fetch(subscribeUrl, {` en la línea real) — el gap
es exclusivamente de la aserción de test, aislado a este único call
site de los 11 totales.

```
R13_R3_TEST_STRENGTH_REVIEW=BLOCK (10/11 call sites con protección fuerte confirmada por mutación; 1/11 — subscribe en use-push-notifications.ts — con protección débil confirmada por mutación)
R13_R3_BLOCKER_CLASS=TEST_COVERAGE_GAP
```

La corrección exacta y aislada que cierra este gap (no aplicada en
R13-R3, tarea de `P2-T18-BLOCKER-AUTH2-R13-R3-R1`): agregar
`expect(...).toContain("fetch(subscribeUrl")` al mismo describe,
mismo patrón que ya protege `unsubscribeUrl`/`statusUrl`. Ningún otro
archivo de la autoridad de 7 requiere corrección — los otros 10 call
sites (`chat-fab.tsx`, `chat-sheet.tsx`, `chat-view.tsx`×2,
`share-target-flow.tsx`×2, `use-push-notifications.ts`
unsubscribe+status, `permission-prompt.tsx`×2) quedaron confirmados
con protección fuerte por al menos un mutante detectado cada uno.

## P2-T18-BLOCKER-AUTH2-R13-R3-R1 — cierre del gap M9 (test-only, PASS)

`P2-T18-BLOCKER-AUTH2-R13-R3-R1` (2026-08-28) cerró exactamente el
único gap real de cobertura confirmado por R13-R3 (sobreviviente #2 de
arriba), sin tocar producto ni ningún otro archivo de test.

**Reproducción previa a la corrección**: en un harness temporal fuera
del repo (junction a `node_modules` real + copia de `src/` con el diff
de AUTH02 aplicado, baseline confirmado 29 pass/0 fail sobre el test
objetivo antes de mutar), se aplicó exactamente la misma mutación M9
(`const res = await fetch(subscribeUrl, {` → `fetch("/api/push/subscribe", {`,
dejando intacta la declaración `const subscribeUrl = ...`). Corrida
contra el test SIN corregir: **29 pass/0 fail — mutante confirmado
sobreviviente**, replicando el hallazgo de R13-R3 antes de tocar
ningún archivo real.

**Corrección aplicada** (única mutación autorizada,
`src/hooks/use-push-notifications-static-contract.test.ts`): agregada
la línea `expect(src).toContain("fetch(subscribeUrl")` (+ comentario)
al final del test ya existente `"all three call sites (status,
subscribe, unsubscribe) build their URL from actorType with the same
ternary shape"`, dentro del describe `"F-P2-T18-AUTH02 —
use-push-notifications actorFamily selector propagation"` — mismo
patrón exacto que ya protege `unsubscribeUrl`/`statusUrl`. No se creó
ningún `test()`/`describe()` nuevo.

```
R13_R3_R1_TEST_CASE_COUNT_CHANGE=0 (29 tests antes y después del archivo)
R13_R3_R1_EXPECT_CALL_COUNT=99 -> 100 (+1 assertion)
R13_R3_R1_TARGET_TEST_FRESH_RUN=29 pass / 0 fail (contra el código real, sin mutar)
```

**Replay post-corrección** (mismo harness, mismo mutante M9 reaplicado,
test corregido copiado): **28 pass / 1 fail** — el único fallo es
exactamente la nueva assertion (`expect(src).toContain("fetch(subscribeUrl")`),
sin afectar ninguna de las otras 28 pruebas del archivo.
`M9_DETECTION_REASON=SUBSCRIBE_FETCH_NO_LONGER_CONSUMES_SUBSCRIBE_URL`.
Harness restaurado desde backup (SHA-256 idéntico a
`PRODUCT_PRE_FINGERPRINT` de `use-push-notifications.ts`) y eliminado
por completo antes de cerrar la etapa.

```
R13_R3_R1_AUTH02_FOCAL_RESULT=117_OF_117_PASS (7 archivos, idéntico al conteo de R13-R2)
ESLINT_R13_R3_R1 (1 path mutado) = 0 errores
TSC_R13_R3_R1 (proyecto completo) = 31 raw / 24 distinct — idéntico a la autoridad vigente arriba, 0 nuevos
GIT_DIFF_CHECK_R13_R3_R1 = PASS (exit 0; sólo avisos CRLF informativos)
PRODUCT_FINGERPRINT_R13_R3_R1 = 7/7 SHA-256 idénticos pre/post (sin mutación de producto)
NON_TARGET_TEST_FINGERPRINT_R13_R3_R1 = 6/6 SHA-256 idénticos pre/post
```

No se re-ejecutó la campaña completa de 19 mutantes ni la regresión de
294 — ambas corresponden a `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY`, la
repetición COMPLETA desde cero (no una continuación) requerida antes
de autorizar `P2-T18-BLOCKER-AUTH2-R13-R4` (commit local exacto). Esta
autoridad de test sigue sin commitear — permanece en el working tree,
sin `git add`.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY — recertificación adversarial completa desde cero (BLOCK, segundo gap aislado)

`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY` (2026-08-28) repitió DESDE CERO la
revisión adversarial precommit del diff local de AUTH02 tras el cierre
de M9 en R13-R3-R1, sin aceptar como prueba suficiente ningún
resultado histórico.

**Revisión de fuerza de test "desde cero"** — clasificación
declaración-vs-consumo de los 11 call sites productivos (no una
re-verificación de la sola assertion de M9):

```
proxy.test.ts: N/A — prueba comportamiento real vía proxy(), no texto estático
chat-fab.test.tsx: SI declaración + SI consumo (fetch(url,)
chat-sheet.test.tsx: SI declaración + SI consumo (fetch(url,)
chat-view.test.tsx: SI declaración + SI consumo, ambos call sites (fetch(historyUrl,/fetch(sendUrl,)
share-target-flow.test.tsx: SI (fetch inline, sin variable intermedia — declaración=consumo)
use-push-notifications-static-contract.test.ts: SI declaración + SI consumo en los 3 call sites (statusUrl/subscribeUrl — corregido por R13-R3-R1 — /unsubscribeUrl)
permission-prompt-static-contract.test.ts: SI declaración en ambas funciones + SI consumo SÓLO en checkExistingPushSubscriptionStatus (fetch(url, línea 52) — savePushSubscription: consumo NUNCA verificado
```

```
R13_R3_RETRY_TEST_STRENGTH_REVIEW=BLOCK (10/11 call sites con protección de consumo real confirmada; 1/11 — savePushSubscription en permission-prompt.tsx — sólo con protección de declaración)
```

**Campaña de mutación**: harness temporal NUEVO fuera del repo
(`.../scratchpad/r13r3retry_harness`, distinto de los usados en R13-R3
y R13-R3-R1, eliminado al cierre). Baseline confirmado idéntico a
R13-R2 (117/117) antes de mutar nada. Replay fiel de los 19 mutantes
originales de R13-R3 (recuperados verbatim de su tabla archivada) más
1 mutante nuevo, exigido por el gap encontrado en la revisión de
fuerza de test:

```
R13_R3_RETRY_MUTATION_CAMPAIGN_RESULT:
mutantes intentados = 20 (19 originales + 1 nuevo)
no-equivalentes detectados = 18/19
equivalentes = 1 (M3)
sobrevivientes válidos = 1 (mutante nuevo)
```

- Los 18 mutantes originales no-equivalentes (M1,M2,M4-M18 incl. M12b)
  fueron TODOS detectados, resultado idéntico a R13-R3.
- **M9 recertificado**: replay del mismo mutante de R13-R3
  (`use-push-notifications.ts`'s `subscribe()` deja de usar
  `subscribeUrl`) — antes 29 pass/0 fail sin detectar; ahora 1 fail
  exacto por la assertion agregada en R13-R3-R1. Confirma que esa
  corrección funciona genuinamente contra el mutante real, no sólo por
  inspección estática del texto.
- **M3 reconfirmado equivalente** de forma independiente: releída
  `checkRouteProtection()` completa (paso 1, `PUBLIC_API_PREFIXES`,
  aprueba `/api/chat/cleanup` antes de que el paso 4/selector importe),
  releído `cleanup/route.ts` completo (0 matches de lectura de cookie
  de sesión genérica), sin efecto de respuesta/sesión, producto real
  no contiene la mutación.
- **Mutante nuevo — GAP REAL CONFIRMADO**: en
  `src/components/shared/permission-prompt.tsx`, función
  `savePushSubscription(subscription, family)`, la línea
  `const url = family ? \`/api/push/subscribe?actorFamily=${family}\` : "/api/push/subscribe"`
  se dejó intacta; sólo `await fetch(url, {` se mutó a
  `await fetch("/api/push/subscribe", {`. Corrida contra
  `permission-prompt-static-contract.test.ts`: **11 pass / 0 fail —
  sobrevivió**. Confirmado por lectura directa que el producto real SÍ
  contiene `fetch(url, {` correctamente — el gap es exclusivamente de
  la aserción de test faltante, idéntico en naturaleza a M9 pero en un
  call site distinto (nunca atacado por los 19 mutantes originales,
  que para este archivo sólo probaron el caller vía M12/M12b).

```
R13_R3_RETRY_TEST_STRENGTH_REVIEW=BLOCK (ver arriba)
R13_R3_RETRY_BLOCKER_CLASS=TEST_COVERAGE_GAP
```

La corrección exacta y aislada que cierra este gap (no aplicada en
R13-R3-RETRY, tarea de `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1`):
agregar `expect(fnBody).toContain("fetch(url")` (o patrón equivalente)
al describe `"PermissionPrompt — F-P2-T18-AUTH02 actorFamily selector
propagation"`, mismo patrón que ya protege el consumo de
`checkExistingPushSubscriptionStatus`. Ningún otro archivo de la
autoridad de 7 requiere corrección.

Por regla stop-on-objective, no se reconstruyeron las matrices de
seguridad/aceptación 20/20 y 12/12 ni se re-ejecutó la autoridad
focal/regresión completa — el BLOCK ya quedó demostrado con evidencia
suficiente. Esta autoridad de test sigue sin commitear — permanece en
el working tree, sin `git add`.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1 — cierre del gap M19-NEW (test-only, PASS)

`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1` (2026-08-28) cerró exactamente
el segundo gap real de cobertura confirmado por R13-R3-RETRY
(sobreviviente M19-NEW), sin tocar producto ni ningún otro archivo de
test.

**Reproducción previa a la corrección**: en un harness temporal nuevo
fuera del repo (junction a `node_modules` real + copia de `src/`,
distinto del harness usado en R13-R3-RETRY, eliminado al cierre),
baseline confirmado 11 pass/0 fail sobre el test objetivo antes de
mutar. Se aplicó exactamente la mutación M19-NEW
(`await fetch(url, {` → `await fetch("/api/push/subscribe", {`,
dejando intacta `const url = family ? ... : "/api/push/subscribe"`).
Corrida contra el test SIN corregir: **11 pass/0 fail — mutante
confirmado sobreviviente**, replicando el hallazgo de R13-R3-RETRY
antes de tocar ningún archivo real.

**Corrección aplicada** (única mutación autorizada,
`src/components/shared/permission-prompt-static-contract.test.ts`):
agregada la línea `expect(fnBody).toContain("fetch(url")` (+
comentario) al test ya existente `"savePushSubscription accepts an
explicit family parameter and appends it as ?actorFamily= when
present"`, dentro del describe `"PermissionPrompt — F-P2-T18-AUTH02
actorFamily selector propagation"` — mismo patrón exacto que ya
protege `checkExistingPushSubscriptionStatus` (`fetch(url`, otro test
del mismo describe). No se creó ningún `test()`/`describe()` nuevo.

```
R13_R3_RETRY_R1_TEST_CASE_COUNT_CHANGE=0 (11 tests antes y después del archivo)
R13_R3_RETRY_R1_EXPECT_CALL_COUNT=22 -> 23 (+1 assertion)
R13_R3_RETRY_R1_TARGET_TEST_FRESH_RUN=11 pass / 0 fail (contra el código real, sin mutar)
```

**Replay post-corrección** (mismo harness, mismo mutante M19-NEW
reaplicado, test corregido copiado): **10 pass / 1 fail** — el único
fallo es exactamente la nueva assertion
(`expect(fnBody).toContain("fetch(url")`), sin afectar ninguna de las
otras 10 pruebas del archivo.
`M19_DETECTION_REASON=SAVE_PUSH_SUBSCRIPTION_FETCH_NO_LONGER_CONSUMES_URL`.
Harness restaurado desde backup (SHA-256 idéntico a
`PRODUCT_PRE_FINGERPRINT` de `permission-prompt.tsx`) y eliminado por
completo antes de cerrar la etapa.

```
R13_R3_RETRY_R1_AUTH02_FOCAL_RESULT=117_OF_117_PASS (7 archivos, idéntico al conteo previo)
ESLINT_R13_R3_RETRY_R1 (1 path mutado) = 0 errores
TSC_R13_R3_RETRY_R1 (proyecto completo) = 31 raw / 24 distinct — idéntico a la autoridad vigente, 0 nuevos
GIT_DIFF_CHECK_R13_R3_RETRY_R1 = PASS (exit 0; sólo avisos CRLF informativos)
PRODUCT_FINGERPRINT_R13_R3_RETRY_R1 = 7/7 SHA-256 idénticos pre/post (sin mutación de producto)
NON_TARGET_TEST_FINGERPRINT_R13_R3_RETRY_R1 = 6/6 SHA-256 idénticos pre/post (incluido el test de M9)
```

No se re-ejecutó la campaña completa de 20 mutantes ni la regresión de
294 — ambas corresponden a `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2`, la
repetición COMPLETA desde cero (no una continuación) requerida antes
de autorizar `P2-T18-BLOCKER-AUTH2-R13-R4` (commit local exacto). Esta
autoridad de test sigue sin commitear — permanece en el working tree,
sin `git add`.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2 — recertificación adversarial final desde cero (BLOCK, fallo de regresión ajeno)

`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2` (2026-08-29) repitió DESDE CERO,
por última vez antes del commit local, la revisión adversarial
precommit del diff local de AUTH02 tras el cierre de M9 (R13-R3-R1) y
M19-NEW (R13-R3-RETRY-R1).

**Gate crítico 11/11 declaración+consumo** (construido antes de mutar
nada): tabla explícita de los 11 call sites productivos, confirmando
para cada uno que su test correspondiente verifica tanto la
declaración de la URL/selector como su consumo real en el `fetch()` —
ver tabla completa en `codex-reports/CURRENT_TASK.md`. 11/11 verde,
incluidos los dos call sites recién corregidos (`subscribeUrl`/M9,
`url` en `savePushSubscription`/M19-NEW).

**Campaña de mutación**: harness temporal NUEVO fuera del repo
(`.../scratchpad/r13r3retry2_harness`, nunca reutilizado, eliminado al
cierre). Baseline confirmado idéntico (117/117) antes de mutar. Replay
fiel de los 19 mutantes originales + M19-NEW:

```
RETRY_2_MUTATION_CAMPAIGN_RESULT:
mutantes intentados = 20
no-equivalentes detectados = 19/19
equivalentes = 1 (M3)
sobrevivientes válidos = 0
```

M9 y M19-NEW ambos recertificados **detectados** — confirma que ambas
correcciones test-only funcionan genuinamente contra el mutante real.
M3 reconfirmado independientemente equivalente por los 5 puntos
exigidos (releído `checkRouteProtection()`, releído `cleanup/route.ts`
completo — 0 matches de lectura de cookie de sesión).

```
R13_R3_RETRY_2_SECURITY_MATRIX=20_OF_20_PASS
R13_R3_RETRY_2_LOCAL_ACCEPTANCE_MATRIX=12_OF_12_PASS
R13_R3_RETRY_2_FOCAL_FIRST_RUN=117 pass / 0 fail / 280 expect() calls
```

**Corrida de regresión decisiva fresca** — 3 tandas, listado literal
recuperado de este mismo documento (líneas 1459-1478), nunca
reconstruido de memoria:

```
TANDA_1_UNIT_Y_ROUTE (sin DB, 10 archivos) = 163 pass / 0 fail / 547 expect() calls
TANDA_2_INTEGRATION (DB real, DATABASE_URL=$DELIGO_TEST_DATABASE_URL, 3 archivos) = 30 pass / 1 fail / 141 expect() calls
  ÚNICO FALLO: client-block-security.integration.test.ts:406
  "SEC-BLOCK-1 — Auto-bloqueo por evasión de dispositivo > dispositivo
  compartido pero SIN ninguna fila ClienteBloqueado previa: ninguna de
  las dos cuentas se bloquea" — Expected: 201, Received: 500 (12878ms)
TANDA_3_P2_T13_FOCAL = NO EJECUTADA (stop-on-objective tras el fallo de TANDA_2)
```

```
R13_R3_RETRY_2_REGRESSION_FIRST_RUN_PASS=NO
R13_R3_RETRY_2_REGRESSION_PASS=193 (163+30, TANDA_3 no corrida)
R13_R3_RETRY_2_REGRESSION_FAIL=1
DATABASE_URL_FALLBACK_USED=NO
```

**Clasificación preliminar, NO confirmada** (ningún re-run permitido
por regla explícita de esta etapa — "no retry-to-green"):
`client-block-security.integration.test.ts` tiene precedente histórico
documentado de flake transitorio aislado en corridas multi-archivo
contra Postgres real — ver `P2-T18-BLOCKER-AUTH2-R5` arriba en este
mismo documento ("en la primera corrida fresca un test de concurrencia
real contra Postgres... falló de forma aislada... confirmando un flake
transitorio de infraestructura, no una regresión"), mismo archivo,
mismo tipo de síntoma (fallo aislado en corrida multi-archivo). El
test que falló pertenece al dominio de auto-bloqueo por dispositivo
compartido — sin relación textual ni funcional con el selector
`actorFamily` de AUTH02. La clasificación definitiva (flake vs.
regresión real) queda para `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1`.

Por regla stop-on-objective, no se ejecutaron ESLint/TSC/diff-check/
build ni se corrió TANDA_3 — el BLOCK ya quedó demostrado con
evidencia suficiente en la primera corrida decisiva de TANDA_2. Esta
autoridad de test sigue sin commitear — permanece en el working tree,
sin `git add`.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1 — clasificación diagnóstica de SEC-BLOCK-1 (INCONCLUSIVE, sin corrección)

`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1` (2026-08-29) investigó,
dentro de un presupuesto diagnóstico fijo de 3 corridas (ninguna
repetida, sin retry-to-green), el único fallo que bloqueó
`R13-R3-RETRY-2`: `src/lib/client-block-security.integration.test.ts`,
caso SEC-BLOCK-1 "dispositivo compartido pero SIN ninguna fila
ClienteBloqueado previa" (esperado 201, recibido 500, ~12878ms en la
corrida original).

```
D1_RUN (caso aislado, `-t "dispositivo compartido..."`, comando: `DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test src/lib/client-block-security.integration.test.ts -t "..."`)
  RESULT=FAIL
  EXPECTED=201, ACTUAL=500
  PRISMA_ERROR_CODE=P2028 (Transaction API error)
  DURATION=25144ms (anómalamente larga)
  FAILED_ASSERTION=línea 401 (resA — distinto del fallo original en resB, línea 406)

D2_RUN (archivo completo, comando: `DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test src/lib/client-block-security.integration.test.ts`)
  RESULT=19 pass / 0 fail / 90 expect() calls, 197.58s

D3_RUN (autoridad exacta de TANDA_2, comando: `DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test src/lib/actor-family-session-coexistence.integration.test.ts src/lib/session-login-atomicity.integration.test.ts src/lib/client-block-security.integration.test.ts`)
  RESULT=31 pass / 0 fail / 143 expect() calls, 270.41s
```

**Solapamiento con AUTH02 — descartado por evidencia estructural de
código**: `client-block-security.integration.test.ts` importa
`POST_FOR_TESTS as crearPedido` desde `@/app/api/pedidos/route` y lo
invoca directamente con un `NextRequest` construido a mano —
confirmado por grep exhaustivo del archivo completo: **0 matches** de
`proxy`/`middleware`/`resolveActorSession`/`SELECTOR_ENDPOINT_PREFIXES`.
`src/proxy.ts` (el único archivo de AUTH02 con alcance global sobre
requests HTTP reales) nunca se ejecuta en este test — es Edge
Middleware, y este test nunca hace una petición HTTP real que pase por
él.

**Comparación con el precedente de R5** (`client-block-security.integration.test.ts`,
test "misma IP, dispositivos concurrentes... P2002", ver sección R5 de
este documento arriba): mismo archivo, pero test title distinto,
mecanismo distinto (R5 usa `Promise.all` de 3 logins realmente
concurrentes diseñado para forzar una carrera de unique constraint;
SEC-BLOCK-1 usa awaits secuenciales, sin concurrencia diseñada por el
test), código de error distinto (P2002 histórico vs. P2028 reproducido
en D1). `R5_SAME_FILE=SI`, `R5_SAME_EXACT_TEST_CASE=NO`,
`R5_SAME_ERROR_CODE=NO`, `R5_SAME_ROOT_CAUSE_PROVEN=NO`.

**Clasificación**: D1 FALLÓ (aislado), D2 y D3 PASARON limpio
(incluyendo el mismo test case) — patrón que no encaja en ningún Caso
A/B/C de la matriz de interpretación (Caso A exige los 3 PASS; Caso B
exige que el aislado PASE y sólo el multi-archivo falle — patrón
inverso al observado; Caso C exige fallo determinístico en los 3).
Clasificado **Caso E — `INCONCLUSIVE_EXTERNAL_DB_INSTABILITY`**:
evidencia circunstancial fuerte (código transaccional `P2028`,
latencia anómala de 25s en un único request) apunta hacia
inestabilidad transitoria de la conexión/motor de TESTING durante esa
ventana específica — pero sin forzar una clasificación PASS limpia
que la matriz no autoriza con evidencia mixta.

```
R13_R3_RETRY_2_R1_FAILURE_CLASS=INCONCLUSIVE_EXTERNAL_DB_INSTABILITY
AUTH02_CAUSED_SEC_BLOCK_1_FAILURE=NO
PRODUCT_FIX_REQUIRED=NO
TEST_FIX_REQUIRED=NO
```

`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE`
permanece históricamente preservado — su evidencia (20 mutantes,
19/19 no-equivalentes, 0 sobrevivientes válidos, 11/11 cobertura,
20/20 seguridad, 12/12 aceptación, 117/117 focal, TANDA_1 163/163)
sigue técnicamente reutilizable, confirmada idéntica por fingerprint
antes/después de esta etapa (14/14, 17/17, y el propio archivo de
test objetivo). Ninguna assertion de producto ni de test fue tocada.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2` — gate de
regresión fresca de certificación (no diagnóstica): TANDA_2 una vez,
si PASA TANDA_3 una vez, sin retry-to-green, sin repetir la campaña de
20 mutantes ni las matrices ya certificadas.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2 — gate de regresión fresca de certificación (BLOCK, segundo fallo consecutivo)

`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2` (2026-08-29) ejecutó el gate
de certificación (no diagnóstico) definido tras la clasificación
`INCONCLUSIVE_EXTERNAL_DB_INSTABILITY` de R1, sin retry-to-green.

**Gate de continuidad de bytes**: 14/14 paths de AUTH02, 17/17 vecinos
congelados, y `src/lib/client-block-security.integration.test.ts`
confirmados idénticos byte a byte respecto de los fingerprints
post-diagnóstico de R1
(`a88468552f2099f3d80b667ef4848f93c1c17ea955df56c004a5fc087911cf7d`).
Toda la evidencia de RETRY-2 (11/11, 20 mutantes/19 no-equivalentes/0
sobrevivientes válidos, 20/20, 12/12, 117/117, TANDA_1 163/163)
preservada por identidad de bytes — nada re-ejecutado.

```
C1_TANDA_2_RUN (comando exacto: DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test src/lib/actor-family-session-coexistence.integration.test.ts src/lib/session-login-atomicity.integration.test.ts src/lib/client-block-security.integration.test.ts)
  RESULT=30 pass / 1 fail / 141 expect() calls, 282.00s
  ÚNICO FALLO: client-block-security.integration.test.ts:406 — "SEC-BLOCK-1... dispositivo compartido pero SIN ninguna fila ClienteBloqueado previa" — Expected: 201, Received: 500, 26786.71ms
```

Este es el MISMO caso exacto que falló en la corrida original de
RETRY-2 y en D1/D3 de R1 — segunda vez consecutiva de falla en un
intento de certificación (no diagnóstico), con la misma forma de
latencia anómala (12878ms original, 25144ms en D1, 26786ms aquí — las
tres muy por encima de lo esperado para este pipeline).

Por regla explícita de la etapa ("no retry-to-green", "Do NOT run
TANDA_2 again. Do NOT run TANDA_3. Do NOT isolate the failed test."),
se detuvo de inmediato — C2 (TANDA_3) no se ejecutó, ESLint/TSC/
diff-check/build no se corrieron (per stop-on-objective, el BLOCK ya
quedó demostrado en la primera corrida decisiva de C1).

```
R13_R3_RETRY_2_R2_FAILURE=segundo fallo consecutivo del mismo caso SEC-BLOCK-1
AUTH02_CAUSED_FAILURE=NO (gate de continuidad de bytes confirma que ni el test ni proxy.ts cambiaron desde R1, donde ya se demostró 0 solapamiento estructural)
PRODUCT_FIX_REQUIRED=NO
TEST_FIX_REQUIRED=NO
```

`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE` y
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R1=BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE`
permanecen históricamente preservados — esta etapa NO reclasifica el
incidente a `TRANSIENT_DB_TEST_FLAKE` confirmado, pese a que el
segundo fallo consecutivo del mismo caso exacto es evidencia adicional
compatible con esa hipótesis. `P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2=BLOCKED_FRESH_TANDA_2_CERTIFICATION_FAILURE`.
Ninguna assertion de producto ni de test fue tocada. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1` — disposición aislada de
este segundo fallo consecutivo (probablemente una decisión de
producto/proceso con el usuario, dado que dos intentos de
certificación ya fallaron el mismo caso exacto).

---

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1 — ROOT-CAUSE/DISPOSITION RECONCILIATION — 2026-08-29

Tarea de disposición read-only (0 mutación de source/test, 0 ejecución
de tests nueva — prohibido explícitamente por el prompt de esta etapa).
Evidencia técnica nueva, obtenida exclusivamente por lectura de código
y de documentación/instrumentación ya existente en el repo:

```
TRANSACTION_T1=src/app/api/pedidos/route.ts:1493 (db.$transaction), única alcanzada por SEC-BLOCK-1 "dispositivo compartido..." (sin bloqueo, sin mesa, sin Idempotency-Key)
T1_DB_AWAITS_FOR_THIS_TEST=3 (getPlatformServiceFee lectura, tx.cliente.update, tx.pedido.create)
T1_NON_DB_WORK_INSIDE=0
T1_MAX_WAIT_DEFAULT=2000 (confirmado en node_modules/@prisma/client/runtime/library.d.ts:2654, Prisma 6, nunca sobreescrito en este código)
T1_TIMEOUT_DEFAULT=5000 (mismo archivo, línea 2655, nunca sobreescrito)
P2028_HANDLED=NO (catch-all genérico → 500, sin retry, sin clasificación especial)
```

Comparación de los 3 fallos frescos conocidos + 2 controles limpios,
todos ya documentados en etapas previas, releídos y tabulados en un
único cuadro comparativo por primera vez en esta etapa:

```
E1=RETRY-2 original, TANDA_2 (3 archivos), resB, 500, 12878ms
E2=R1/D1, AISLADO (0 archivos concurrentes), resA, 500, P2028, 25144ms
E3=R2-R2/C1, TANDA_2 exacta (3 archivos), resB, 500, 26786.71ms
S1=R1/D2, archivo completo (19 tests), PASS 19/19
S2=R1/D3, TANDA_2 exacta (3 archivos), PASS 31/31
```

**E2 (aislado, sin ningún otro archivo/proceso concurrente) también
falló** — esto descarta la contención ENTRE archivos de TANDA_2 como
causa NECESARIA del fallo, dato que no había sido puesto explícitamente
en el centro del análisis en ninguna etapa previa.

Contexto adicional recuperado de documentación/instrumentación YA
EXISTENTE en el repo (sin ejecutar nada nuevo):

```
LOAD_TEST_HARNESS_EXISTS=SI (load-tests/runner/pg-metrics.ts — instrumenta pg_stat_activity/max_connections/xact_commit/xact_rollback contra $DELIGO_TEST_DATABASE_URL, ya construido por el proyecto antes de esta etapa)
LATEST_LOAD_TEST_RESULT=load-tests/results/loadcert-1786679286337-0ce216d5/human-report.md (2026-08-14, contra deligo-copy-production.up.railway.app, NO contra TESTING)
LATEST_LOAD_TEST_LATENCY=p50=279.54ms/p95=389.41ms/p99=611.07ms, 0 http_5xx, 0 request_timeouts, 20 min sostenidos
```

```
TANDA_2_EXECUTION_MODEL=DEFAULT_UNPINNED (sin bunfig.toml, sin script "test" en package.json, sin flags de concurrencia en el comando documentado)
PRISMA_POOL_CONFIG_EXPLICIT=NO (schema.prisma: url = env("DATABASE_URL"), sin connection_limit/pool_timeout visibles en código; valor real de la URL nunca leído/impreso)
```

Hallazgo secundario, NO causal para este síntoma:
`session-login-atomicity.integration.test.ts` registra
`mock.module("@/lib/client-block-security", () => ({
ensureClienteBloqueadoRecordForDevice: ... }))` a nivel de módulo, sin
re-exportar `findForeignDeviceBlockMatch`/`applyDeviceEvasionAutoBlock`
— documentado para revisión futura separada, descartado como causa de
ESTE síntoma porque un módulo mockeado incompleto produciría un
`TypeError` síncrono casi instantáneo, no un `P2028` con latencia de
segundos.

```
SELECTED_DISPOSITION=EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY
CONFIDENCE=MEDIUM
DEDICATED_TEST_DB_REQUIRED=SI
TEST_EXECUTION_CHANGE_REQUIRED=NO (E2/D1 aislado también falló)
PRODUCT_FIX_REQUIRED=NO
TEST_FIX_REQUIRED=NO
FORMAL_FLAKE_EXCEPTION_RECOMMENDED=NO
```

`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE`,
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R1=BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE`
y `P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2=BLOCKED_FRESH_TANDA_2_CERTIFICATION_FAILURE`
permanecen históricamente preservados — esta etapa no los reescribe;
determina la disposición del segundo fallo, no lo revierte a PASS.
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2_R1=PASS_REPEATED_SEC_BLOCK_1_FAILURE_DISPOSITION_FROZEN`
— "PASS" significa "disposición determinada", no "AUTH02 puede
commitearse" (`AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=NO`,
`R13_R4_AUTHORIZED=NO`). Fingerprint 14/14+17/17+test-objetivo
confirmado idéntico antes/después; 0 mutación de source/test.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A` — decisión
de producto/proceso del usuario sobre una base de TESTING dedicada
(características congeladas, sin provisionar nada).

---

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A — RECONCILIACIÓN DE AUTORIDAD TRAS DECISIÓN DEL USUARIO — 2026-08-29

```
TEST_RUNS_EXECUTED=0
```

Tarea de reconciliación de reportes/autoridad únicamente — el prompt
de esta etapa prohibió explícitamente ejecutar SEC-BLOCK-1, TANDA_2,
TANDA_3, el focal de 117, TANDA_1 de 163, la campaña de mutación, la
matriz de seguridad, la matriz de aceptación o el build; toda cifra
citada abajo es autoridad ya persistida, releída sin re-derivar nada.

Verificación de los 6 gates A-F requeridos para aceptar la excepción,
recuperados de `DELIGO_FULL_CONTEXT_LATEST.md` y
`codex-reports/TEST_AUTHORITY.md` (líneas de la sección
R13-R3-RETRY-2 de este mismo archivo, arriba):

```
A_CANDIDATE_14_PATHS=SI (7 producto + 7 test)
B_ADVERSARIAL_AUTHORITY=SI (11/11 declaración+consumo; 20 mutantes, 1 equivalente M3, 19 no-equivalentes detectados, 0 sobrevivientes válidos; seguridad 20/20; aceptación 12/12; focal 117/117; TANDA_1 163/163)
C_AUTH02_CAUSAL=NO (confirmado estructuralmente en R13-R3-RETRY-2-R1: SEC-BLOCK-1 invoca POST_FOR_TESTS/crearPedido directamente, nunca ejecuta src/proxy.ts)
D_MIXED_PASS_FAIL_SAME_BYTES=SI (D2 19/19, D3 31/31, TANDA_1 163/163 histórico vs. RETRY-2 original/D1/C1 fallando, mismos bytes AUTH02 en todos los casos)
E_ISOLATED_FAILURE_REPRODUCED=SI (D1, sin ningún archivo/proceso concurrente, también falló — descarta AUTH02 como causa del código nuevo)
F_NO_FIX_IDENTIFIED=SI (R13-R3-RETRY-2-R2-R1: PRODUCT_FIX_REQUIRED=NO, TEST_FIX_REQUIRED=NO)
```

Los 6 PASS — la excepción se acepta sobre evidencia real, no se
fabrica. Gate de continuidad de bytes reconfirmado por rehash directo
de los 14 paths de AUTH02 + `client-block-security.integration.test.ts`:
idénticos byte a byte a los tomados en R13-R3-RETRY-2-R2-R1 (mismos 15
hashes SHA-256, sin ninguna discrepancia).

```
TEMP_TESTING_INFRA_EXCEPTION_ID=EX-P2-T18-SEC-BLOCK-1-P2028
EXCEPTION_SCOPE=ONLY_SEC_BLOCK_1_P2028_TESTING_DB_INSTABILITY
EXCEPTION_PERMANENT=NO
EXCEPTION_REQUIRES_SOURCE_TEST_SKIP=NO
GLOBAL_FLAKE_POLICY_WEAKENED=NO
NO_FALSE_GREEN_TEST_CLAIM=SI
```

Formulación explícita, tal como exigía el prompt: **no** se afirma
"TANDA_2 31/31 PASS" ni "294/294 PASS". La autoridad de regresión de
AUTH02 se ACEPTA para el avance precommit actual por: TANDA_1 163/163
PASS (real, histórico) + autoridad específica de AUTH02 100% PASS
(real, histórica) + una exclusión explícita y acotada de SEC-BLOCK-1
por decisión del usuario — nunca una afirmación de que la ejecución
que falló haya pasado.

```
AUTH02_PRODUCT_SECURITY_CERTIFICATION=PASS
AUTH02_ADVERSARIAL_CERTIFICATION=PASS
AUTH02_FOCAL_CERTIFICATION=PASS
AUTH02_DB_REGRESSION_CERTIFICATION=PASS_WITH_ONE_USER_ACCEPTED_TESTING_INFRA_EXCEPTION
AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=SI
R13_R4_AUTHORIZED=SI
```

`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE`,
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R1=BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE`,
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2=BLOCKED_FRESH_TANDA_2_CERTIFICATION_FAILURE`
y
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2_R1=PASS_REPEATED_SEC_BLOCK_1_FAILURE_DISPOSITION_FROZEN`
permanecen históricamente preservados, sin reescribir. Contrato de
commit de R13-R4 congelado: exactamente los 14 paths de AUTH02, subject
`fix: scope shared auth requests by actor family`, 0 paths de
reportes/ajenos. Fingerprint 14/14+1 idéntico antes/después; 0
mutación de source/test. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R13-R4` — commit local exacto, no ejecutada.

---

## P2-T18-BLOCKER-AUTH2-R13-R5 — POSTCOMMIT PREPUSH EXACT BLOB REVIEW — 2026-08-29

```
R13_R5_TEST_RUNS_EXECUTED=0
R13_R5_FRESH_117_EXECUTED=NO
R13_R5_FRESH_294_EXECUTED=NO
R13_R5_SEC_BLOCK_EXECUTED=NO
R13_R5_MUTANTS_EXECUTED=0
R13_R5_DB_ACCESS=NO
NO_FALSE_GREEN_TEST_CLAIM=SI
```

Etapa deliberadamente lean por prioridad explícita del usuario (evitar
gastar prompts en baterías ya certificadas). Ningún test se ejecutó —
toda la evidencia de esta etapa es integridad de objetos Git, no
resultado de test:

```
R13_R5_GIT_DERIVED_FILESET_METHODS=2 (git diff-tree --name-status, git show --name-only)
R13_R5_FILESET_DERIVATIONS_AGREE=SI
R13_R5_COMMITTED_PATH_COUNT=14 (7 producto + 7 test)
R13_R5_FILESET_MATCHES_R13_R4=14_OF_14_PASS
R13_R5_HEAD_BLOB_COUNT=14 (derivados vía git ls-tree HEAD)
R13_R5_BLOB_MATCH_R13_R4=14_OF_14_PASS
```

Lectura directa de los 14 blobs desde `git show HEAD:<path>` (nunca el
working tree como autoridad primaria) confirmó: `SELECTOR_ENDPOINT_PREFIXES`
en `src/proxy.ts` con exactamente las 10 entradas certificadas, sin
ningún prefijo genérico nuevo; los callers de Chat
(`chat-fab.tsx`/`chat-view.tsx`/`share-target-flow.tsx`) y Push
(`use-push-notifications.ts`/`permission-prompt.tsx`) preservando el
selector `?actorFamily=` certificado; y las protecciones M9/M19
presentes en los archivos de test commiteados (`grep` directo sobre
los blobs, no sobre archivos de disco).

```
R13_R5_COMMITTED_PROXY_CONTRACT_PRESENT=SI
R13_R5_COMMITTED_CHAT_CONTRACT_PRESENT=SI
R13_R5_COMMITTED_PUSH_CONTRACT_PRESENT=SI
R13_R5_M9_ASSERTION_COMMITTED=SI
R13_R5_M19_ASSERTION_COMMITTED=SI
R13_R5_UNCLASSIFIED_HUNK_COUNT=0
R13_R5_INCIDENTAL_HUNK_COUNT=0
R13_R5_WORKTREE_MATCHES_HEAD=14_OF_14_PASS
```

Como `R13_R5_BLOB_MATCH_R13_R4=14_OF_14_PASS`, toda la autoridad de
producto/seguridad/mutación/aceptación/focal de AUTH02 —y la excepción
temporal `EX-P2-T18-SEC-BLOCK-1-P2028`— se preserva por identidad de
blob, sin re-ejecutar nada. `P2_T18_BLOCKER_AUTH2_R13_R5=PASS_AUTH02_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW`,
`R13_R6_AUTHORIZED=SI`. Git final idéntico
`HEAD=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`,
`ORIGIN=a1579f11e79a41b90c6df4d2e8573ca9a669b856` (sin cambio),
`AHEAD=1`/`BEHIND=0`. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R13-R6` — fresh prepush + TESTING push/deploy
certification, no ejecutada.

---

## P2-T18-BLOCKER-AUTH2-R13-R6 — FRESH PREPUSH + TESTING PUSH/DEPLOY CERTIFICATION — 2026-08-29

```
R13_R6_HEAD_BLOB_COUNT=14
R13_R6_BLOB_MATCH_R13_R5=14_OF_14_PASS
R13_R6_AUTH02_WORKTREE_DIFF_PREPUSH=EMPTY
R13_R6_FOCAL_RUN_COUNT=1
R13_R6_FOCAL_TOTAL=117
R13_R6_FOCAL_PASS=117
R13_R6_FOCAL_FAIL=0
```

Comando exacto (7 paths de test certificados, recuperados del
allowlist de AUTH02 re-verificado en R13-R5, nunca reconstruidos de
memoria):

```bash
bun test src/proxy.test.ts src/components/chat/chat-fab.test.tsx src/components/chat/chat-sheet.test.tsx src/components/chat/chat-view.test.tsx src/components/chat/share-target-flow.test.tsx src/hooks/use-push-notifications-static-contract.test.ts src/components/shared/permission-prompt-static-contract.test.ts
```

117 pass / 0 fail / 280 expect() calls — idéntico byte a byte al
histórico. Sin DB, sin retries.

```
R13_R6_MUTATION_CAMPAIGN_REEXECUTED=NO
R13_R6_SECURITY_MATRIX_REEXECUTED=NO
R13_R6_ACCEPTANCE_MATRIX_REEXECUTED=NO
```

**Gates estáticos/build (una corrida cada uno)**:

```
R13_R6_NEW_ESLINT_ERRORS=0
R13_R6_NEW_TSC_ERRORS=0 (bunx tsc --noEmit: 31 crudos/24 distintos, idéntico byte a byte a TSC_CURRENT_RAW_DIAGNOSTIC_COUNT=31/TSC_CURRENT_DISTINCT_DIAGNOSTIC_COUNT=24; filtrado a los 14 paths de AUTH02, únicamente los 2 TS2367 preexistentes ya documentados en permission-prompt.tsx líneas 302/304, mismo blob, 0 nuevos)
R13_R6_GIT_SHOW_CHECK=PASS
R13_R6_BUILD=PASS
R13_R6_GENERATED_ARTIFACTS_REMAINING=0 (tsconfig.tsbuildinfo generado por tsc, eliminado)
```

**Identidad de Railway y despliegue (read-only, sin `railway variables`/
`up`/`redeploy`)**:

```
RAILWAY_PROJECT_CONFIRMED=amiable-rejoicing
RAILWAY_ENVIRONMENT_CONFIRMED=TESTING (f37d0c49-b737-49e8-be89-a00c13734fae)
CONFLICTING_DEPLOYMENT_PREPUSH=NO
DELIGO_PREPUSH_HEALTH=PASS (/login=200, /=307)
CHAT_PREPUSH_HEALTH=PASS (/health=200)
FRESH_PUSH_GATE=PASS
```

**Push único**:

```
R13_R6_PUSH_COUNT=1
R13_R6_PUSH_COMMAND=git push origin testing-codex
R13_R6_FORCE_PUSH=NO
R13_R6_PUSH_MOVEMENT=a1579f11e79a41b90c6df4d2e8573ca9a669b856..fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
HEAD_POST_PUSH=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
ORIGIN_POST_PUSH=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
AHEAD_POST_PUSH=0
BEHIND_POST_PUSH=0
```

**Deploy Git-triggered observado (read-only, polling `railway status
--json` cada 15s, ~90s hasta estado terminal)**:

```
DELIGO_DEPLOYMENT_ID=4e6618dc-4910-4b94-9da1-0f1d1fa60e5e
DELIGO_DEPLOYMENT_STATUS=SUCCESS
DELIGO_DEPLOYMENT_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
DELIGO_DEPLOY_COMMIT_EXACT=SI

CHAT_AUTODEPLOY_TRIGGERED=SI (pese a CHAT_DEPLOY_REQUIRED_BY_AUTH02_CODE_CHANGE=NO — Railway dispara ambos servicios por push, sin filtro por path, mismo patrón que R6/R12)
CHAT_DEPLOYMENT_ID=43abe272-4fb2-474f-a55a-5d9389ead83c
CHAT_DEPLOYMENT_STATUS=SUCCESS
CHAT_DEPLOYMENT_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f

DELIGO_POSTDEPLOY_HEALTH=PASS
CHAT_POSTDEPLOY_HEALTH=PASS
DELIGO_NEW_MATERIAL_DEPLOY_ERRORS=0
CHAT_NEW_MATERIAL_DEPLOY_ERRORS=0
```

`P2_T18_BLOCKER_AUTH2_R13_R6=PASS_AUTH02_TESTING_PUSH_DEPLOY_CERTIFIED`,
`AUTH02_PUSHED=SI`, `AUTH02_DEPLOYED_TESTING=SI`, `R13_R7_AUTHORIZED=SI`.
0 DB real, 0 navegador real, 0 fixtures manuales. Git final idéntico
`HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, `AHEAD=0`/
`BEHIND=0`, índice vacío. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R13-R7` — full real-browser replay from zero,
no ejecutada.

---

## P2-T18-BLOCKER-AUTH2-R13-R7 — matriz de aceptación real-browser (18/18) — 2026-08-29

Autoridad de aceptación con navegador real (no autoridad de test
automatizado) para F-P2-T18-AUTH01 + F-P2-T18-AUTH02, sustituyendo por
completo el resultado parcial histórico de R13 (`9_OF_18_CONFIRMED_1_OF_18_CLEANUP_8_OF_18_NOT_REACHED`,
`R13_R7_HISTORICAL_CASES_REUSED_AS_PASS=0`).

```
R13_R7_ACCEPTANCE_MATRIX=18_OF_18_PASS
R13_R7_REAL_BROWSER_KIND=CLAUDE_IN_CHROME
R13_R7_REAL_BROWSER_DEVICE=Browser 2
R13_R7_TARGET_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
R13_R7_FIXTURE_PREFIX=P2T18_AUTH2_R13_R7_
R13_R7_CONTROL_CORRECTIONS_USED=2_OF_2_MAX
```

18/18 casos con evidencia real de red/UI/storage por caso (nunca
sintética, nunca reutilizada de R13). CASE_09 es la autoridad
definitiva de que el síntoma AUTH02 (401 en `no-leidos`/
`conversaciones`/`mensajes`/`push/*` bajo coexistencia real de 2+
familias) no se reproduce contra el commit desplegado: los 5 endpoints
relevantes (`no-leidos`, `conversaciones`, `mensajes/[pedidoId]`,
`realtime/token`, `realtime/authorize`) devolvieron `200` para ambos
actores. No sustituye ni invalida la autoridad de tests automatizados
ya certificada (`AUTH02_FOCAL_TEST_FILES=7`, 117/117; mutation
campaign 20/20; TANDA_1 163/163) — es una capa de evidencia distinta,
de aceptación end-to-end con navegador real, no re-ejecutada aquí.

---

## P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE — intento de aceptación real-browser (CONTROL_INVALID) — 2026-08-29

No es autoridad de resultado — documenta un intento sin control
válido, no un PASS ni un FAIL.

```
F_P1_02_REAL_BROWSER_ACCEPTANCE=BLOCKED_CONTROL_INVALID
CHAT_BASELINE_X_TO_Y=PASS
CHAT_BASELINE_Y_TO_X=PASS
CASE_1..CASE_3=BLOCKED_CONTROL_INVALID
CASE_4..CASE_6=NOT_REACHED
```

Baseline de mensajes (HTTP-backed, con refetch al reabrir el panel)
confirmado sano en ambas direcciones. El canal de typing (exclusivo
socket, sin fallback) nunca mostró el indicador en el receptor en
ninguna dirección, pese a room-grants recién renovados y confirmación
por lectura de código de que el emisor sí disparaba `sendTyping` en
cada intento. No constituye evidencia de que el fix de `F-P1-02`
(commit `1adcc01f`) esté roto ni de que funcione — sólo que el canal
de transporte no se pudo observar funcionando en esta sesión de
Chrome real. Ver `codex-reports/FINDINGS.md` (`F-P1-02`) y
`codex-reports/CURRENT_TASK.md` para el detalle completo.

---

## P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1 — diagnóstico acotado del canal de typing (3 observaciones) — 2026-08-29

Autoridad de diagnóstico, no de aceptación final — aísla el primer
tramo roto sin certificar ni descartar F-P1-02.

```
SERVER_TYPING_CHANNEL=PASS (Observation 1, harness externo con socket.io-client real, ambas direcciones)
D2_BROWSER_TYPING_FRAME_SENT=NO (Observation 2, espera deliberada de 5s)
D3_SENDER_FRAME_SENT=NO / D3_RECEIVER_FRAME_RECEIVED=NO (Observation 3, observador temporal)
FIRST_BROKEN_HOP=HOP_B
DIAGNOSTIC_OBSERVATION_COUNT=3_OF_3_MAX
```

Observation 1 certifica de forma independiente que el chat-service
desplegado relaya `typing`/`user-typing` correctamente entre dos
actores reales cuando la conexión y el join se realizan
correctamente — esta autoridad permanece válida para futuras etapas
sin necesidad de re-ejecutarla, salvo que cambie el código del
chat-service. Observation 2 y 3 en conjunto establecen que, en el
navegador real actual, el cliente nunca llega a intentar la conexión
de socket hacia el chat-service — confirmado por dos señales
independientes (observador WS de solo lectura + `read_network_requests`
mostrando cero actividad de red hacia ese origen). Ver
`codex-reports/FINDINGS.md` (`F-P2-T18-TYPING-CHANNEL-01`) y
`codex-reports/CURRENT_TASK.md` para el detalle completo.

## BUSINESS-HOURS-TIMEZONE-PRODUCTION-PROMOTION-R1 — autoridad de certificación

Gates certificados: suite de business-hours 13/13 bajo TZ del host, UTC y `America/Argentina/Buenos_Aires`; lint focalizado PASS; build PASS; backup pre y post restaurados con PostgreSQL 18.6; Production `28/28/0`; API y catálogo públicos PASS. No hubo pedido/pago de Production.

## P2-T41-TERMINAL-READ-ONLY-ACTION-AUTHORIZATION — 2026-09-10 (gate desplegado, vigente)

**Corrección de baseline de TypeScript**: el número `24` documentado en
reportes previos como "baseline conocido" estaba desactualizado. Medido
fresco en esta tarea (`bunx tsc --noEmit --pretty false`, aislado con
`git stash`/`git stash pop` para comparar antes/después de esta tarea
sin contaminar el árbol): `TYPECHECK_RAW=31` tanto ANTES como DESPUÉS
de los cambios de P2-T41 — `NEW_TYPECHECK_ERRORS=0`. Ninguno de los 31
errores pertenece a un archivo tocado por esta tarea (verificado
grepeando los paths de los 8 archivos modificados contra la salida
completa de `tsc`). Registrar `TYPECHECK_BASELINE_REAL=31` para
futuras tareas — no reusar el `24` de reportes anteriores a esta.

```
DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 src/lib/mesa-pedido-cancelacion.test.ts
 72 pass / 0 fail / 166 expect() calls

DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 src/lib/p2-t41-terminal-cierre-cuenta.test.ts
 7 pass / 0 fail / 22 expect() calls

DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 \
  src/lib/mesa-pedido-cancelacion-ui-contract.test.ts \
  src/lib/mesa-pedido-cancelacion-client.test.ts \
  src/lib/mesa-pedido-cancelacion-contract.test.ts
 61 pass / 0 fail / 141 expect() calls

DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 \
  src/lib/p2-t08-operational-account-lifecycle.integration.test.ts \
  src/lib/p2-t06-terminal-hardening.integration.test.ts \
  src/lib/p2-t07-terminal-pairing.integration.test.ts
 14 pass / 0 fail / 67 expect() calls

DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 \
  src/lib/negocio-salon.test.ts src/lib/negocio-salon-contract.test.ts \
  src/lib/negocio-salon-static-contract.test.ts src/lib/operativo-pyr-salon.test.ts \
  src/lib/rate-limit-mesa-cuenta.test.ts \
  "src/app/api/operaciones/pyr/pedidos/[id]/estado/order-transitions-authority.test.ts" \
  "src/app/api/operaciones/salon/pedidos/[id]/estado/order-transitions-authority.test.ts"
 89 pass / 0 fail / 1106 expect() calls
```

`P2_T41_FOCAL_PASS=229` (72+61+7+89), `P2_T41_FOCAL_FAIL=0`. Ningún
`fail` real — las líneas `prisma:error ... Transaction failed due to a
write conflict or a deadlock` que aparecen en varios de estos runs son
esperadas: pertenecen a tests de concurrencia real (`Promise.all`
directo, CAS) que fuerzan ese conflicto a propósito, ya documentadas
como parte del diseño de esos tests, no fallas nuevas. ESLint sobre los
8 archivos exactos: 0 errores nuevos (1 preexistente en
`operaciones/salon/page.tsx`, línea ~918, `react-hooks/set-state-in-effect`,
confirmado preexistente vía `git stash` — fuera de todos los hunks de
este diff). `BUILD_PASS=SI`, `DIFF_CHECK_PASS=SI`.

Nota de infraestructura de test (refuerza la ya documentada para
`superadmin-auth.test.ts`): `bun test` sin `DATABASE_URL` falla con
`PrismaClientInitializationError` para cualquier archivo que use `db`
real — no es un fallo de este código. Además, el timeout default de
`bun test` (5000ms) es insuficiente para los `beforeAll`/`afterAll` de
estos archivos (múltiples round-trips reales a Postgres de Railway) —
confirmado reproduciendo el mismo timeout sobre
`mesa-pedido-cancelacion.test.ts` SIN modificar antes de asumir una
regresión real (ver regla ya establecida arriba: "un `bun test` con
timeout demasiado ajustado puede parecer colgado sin estarlo"). Usar
siempre `--timeout 30000` (o mayor) para estos archivos.

Ver `codex-reports/P2_T41_TERMINAL_READ_ONLY_ACTION_AUTHORIZATION.md`
para el detalle completo, incluida la matriz de capacidades y el
checklist de certificación del operador.

## P2-T41-OPERATOR-CERTIFICATION-CLOSEOUT — 2026-09-10 (REVIEWED_NO_CHANGE — autoridad preservada, sin re-ejecución)

Tarea puramente documental (registro de certificación del operador) —
ningún test se ejecutó de nuevo. La autoridad vigente sigue siendo
exactamente la de la entrada de arriba (`P2-T41-TERMINAL-READ-ONLY-
ACTION-AUTHORIZATION`): `TOTAL_TASK_TEST_PASS=229`,
`TOTAL_TASK_TEST_FAIL=0`, `TYPECHECK_BASELINE_REAL=31`,
`NEW_TYPECHECK_ERRORS=0`, `ESLINT_NEW_FINDINGS=0` (1 preexistente fuera
de alcance en `operaciones/salon/page.tsx`), `DIFF_CHECK_PASS=SI`,
`BUILD_PASS=SI`. Esta autoridad, sumada al `OPERATOR_CERTIFICATION_
RESULT=PASS` (5/5 pasos, ver `P2_T41_OPERATOR_CERTIFICATION_CLOSEOUT.md`),
es la base evidencial de `P2_T41_STATUS=CLOSED_TESTING_CERTIFIED`. No
reabrir el baseline histórico `TYPECHECK_RAW=24` — la cifra real
vigente sigue siendo `31`.

## P2-T41-PROMOTION-TO-MAIN-AND-PRODUCTION — 2026-09-10 (gate desplegado a Production, vigente — CORRIGE el total de arriba)

**Corrección de aritmética**: la entrada de implementación original
(arriba) declaró `TOTAL_TASK_TEST_PASS=229` — cifra incorrecta. `72
(mesa-pedido-cancelacion) + 61 (ui-contract+client+contract) + 7
(p2-t41-terminal-cierre-cuenta) + 89 (regresión)` suma 229 sólo si se
ignora que la regresión en realidad fueron DOS corridas separadas: 14
(`p2-t08`+`p2-t06`+`p2-t07`) y 89 (`negocio-salon`x3+`operativo-pyr-
salon`+`rate-limit-mesa-cuenta`+`order-transitions-authority`x2). El
total real es `243`, confirmado por re-ejecución fresca en esta tarea
sobre el source exacto a promover:

```
DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 \
  src/lib/mesa-pedido-cancelacion.test.ts \
  src/lib/mesa-pedido-cancelacion-ui-contract.test.ts \
  src/lib/mesa-pedido-cancelacion-client.test.ts \
  src/lib/mesa-pedido-cancelacion-contract.test.ts \
  src/lib/p2-t41-terminal-cierre-cuenta.test.ts
 140 pass / 0 fail / 329 expect() calls

DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 \
  src/lib/p2-t08-operational-account-lifecycle.integration.test.ts \
  src/lib/p2-t06-terminal-hardening.integration.test.ts \
  src/lib/p2-t07-terminal-pairing.integration.test.ts \
  src/lib/negocio-salon.test.ts src/lib/negocio-salon-contract.test.ts \
  src/lib/negocio-salon-static-contract.test.ts src/lib/operativo-pyr-salon.test.ts \
  src/lib/rate-limit-mesa-cuenta.test.ts \
  "src/app/api/operaciones/pyr/pedidos/[id]/estado/order-transitions-authority.test.ts" \
  "src/app/api/operaciones/salon/pedidos/[id]/estado/order-transitions-authority.test.ts"
 103 pass / 0 fail / 1173 expect() calls
```

`P2_T41_TOTAL_FOCAL_PLUS_REGRESSION_PASS=243` (140+103),
`P2_T41_TOTAL_FAIL=0` — **registrar `243` como la cifra correcta desde
esta tarea en adelante; no reabrir el `229` de la entrada anterior**.
`TYPECHECK_RAW=31` re-medido fresco, idéntico (0 nuevos). ESLint
re-ejecutado sobre los 8 archivos exactos: 0 nuevos, 1 preexistente sin
cambios (`react-hooks/set-state-in-effect`,
`operaciones/salon/page.tsx`). `DIFF_CHECK_PASS=SI`, `BUILD_PASS=SI`.
Esta autoridad fue la base para promover P2-T41 a `main`/Production —
ver `codex-reports/P2_T41_PROMOTION_TO_MAIN_AND_PRODUCTION.md`.

## P2-T42-PYR-EMPLOYEE-TERMINAL-ORDER-WORKFLOW-PARITY — 2026-09-10 (gate desplegado en TESTING, vigente)

```
DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 src/lib/p2-t42-pyr-order-workflow-parity.test.ts
 11 pass / 0 fail / 38 expect() calls

bun test "src/app/api/operaciones/pyr/pedidos/[id]/estado/order-transitions-authority.test.ts"
 13 pass / 0 fail / 15 expect() calls (6 preexistentes preservados sin cambio de resultado + 7 nuevos P2-T42)

bun test src/lib/order-transitions.test.ts
 45 pass / 0 fail / 106 expect() calls (sin cambios de comportamiento — sólo se agregó un export puro nuevo, `PYR_ACTIVE_ESTADOS_NO_MESA`)

DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 \
  src/lib/operativo-pyr-salon.test.ts \
  "src/app/api/operaciones/pyr/mensajes/[pedidoId]/route.test.ts" \
  "src/app/api/operaciones/pyr/mensajes/[pedidoId]/adjunto/route.test.ts" \
  "src/app/api/operativo/pyr/pedidos/[id]/mensajes/route.test.ts"
 26 pass / 0 fail / 113 expect() calls

DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 \
  src/app/api/negocio/pedidos/order-transition-cas-mesa.test.ts \
  "src/app/api/negocio/pedidos/[id]/estado/new-delivery-notification-boundary.test.ts" \
  "src/app/api/negocio/pedidos/[id]/estado/order-estado-lock-ownership.test.ts" \
  "src/app/api/negocio/pedidos/[id]/estado/order-transition-cas-concurrency.test.ts" \
  "src/app/api/negocio/pedidos/[id]/estado/order-transition-t29b-flow.test.ts" \
  "src/app/api/operaciones/salon/pedidos/[id]/estado/order-transitions-authority.test.ts"
 39 pass / 0 fail / 135 expect() calls
```

`P2_T42_TOTAL_PASS=134` (11+13+45+26+39), `P2_T42_TOTAL_FAIL=0`. El
mock-based `order-transitions-authority.test.ts` de PyR Terminal se
extendió con 7 tests nuevos (aceptado/esperando_repartidor, incluyendo
retiro→aceptado, cross-modalidad inválida, y cancelación desde ambos
estados nuevos vía el grafo `"rollout"`) sin romper ninguno de los 6
preexistentes (las aristas legacy `recibido→preparando` y
`preparando→en_camino` siguen aceptadas — el grafo de rollout compartido
con Negocio preserva ambos caminos a propósito).

`TYPECHECK_RAW=31` (idéntico al baseline vigente, 0 nuevos) — nota de
proceso: una medición intermedia mostró 32/33 por dos entradas de
`.next/dev/types/validator.ts`/`.next/types/validator.ts` (caché de un
`next dev` en background que seguía apuntando al endpoint
`en-camino` recién retirado) — confirmado NO-real: `.next/` está
gitignored (no es código fuente), y tras `rm -rf .next/dev` + `next
build` fresco el conteo volvió a `31` limpio. ESLint sobre los 19
archivos exactos del commit: 0 nuevos (1 preexistente ya documentado,
sin relación — `operaciones/salon/page.tsx`, archivo no tocado por esta
tarea). `DIFF_CHECK_PASS=SI`, `BUILD_PASS=SI`.

Nota de regresión T41: no se re-ejecutó la suite completa de T41 —
ningún archivo de esa tarea (`mesa-*.ts`, `mesa-cuenta-dialog.tsx`,
`ocupaciones/[id]/cuenta`, `operaciones/salon/page.tsx`) aparece en el
fileset de T42, y la autoridad que Salón sí comparte con esta tarea
(`ACTIVE_FORWARD_TRANSITIONS.mesa`, usada por
`operaciones/salon/pedidos/[id]/estado`, un endpoint DISTINTO del que
tocó T41) se reverificó explícitamente arriba (última corrida, 39
pass/0 fail) sin cambios de comportamiento.

Ver `codex-reports/P2_T42_PYR_EMPLOYEE_TERMINAL_ORDER_WORKFLOW_PARITY.md`
para el detalle completo, incluida la matriz de transición canónica y
el checklist de certificación del operador.

## P2-T02-B1-REPARTIDOR-PWA-POST-LOGIN-ROUTING — 2026-09-10 (gate desplegado en TESTING, vigente)

```
bun test src/lib/repartidor-post-login-navigation.test.ts src/lib/negocio-post-login-navigation.test.ts
 6 pass / 0 fail / 20 expect() calls

bun test src/lib/repartidor-oauth-callback.test.ts src/lib/p2-t07-repartidor-active-gate-static-contract.test.ts
 9 pass / 0 fail / 37 expect() calls

DATABASE_URL=$DELIGO_TEST_DATABASE_URL bun test --timeout 30000 \
  src/lib/p2-t07-repartidor-active-gate.integration.test.ts \
  src/hooks/use-repartidor-tracking.test.ts \
  src/lib/repartidor-tracking-static-contract.test.ts
 88 pass / 4 fail / 302 expect() calls
```

`P2_T02_B1_TOTAL_PASS=103` (6+9+88), `P2_T02_B1_TOTAL_FAIL=4`. Los 4
fallos son EXACTAMENTE los mismos 4 documentados desde
`P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R1.md`
(`repartidor-tracking-static-contract.test.ts`, contrato estático de la
arquitectura MODEL-G1 ya retirada, busca literalmente `const
sendLocation`/`const tick`) — cero archivos de tracking fueron tocados
en esta tarea, mismo resultado antes y después. `NEW_FAIL=0`.

`TYPECHECK_RAW=31` (idéntico al baseline vigente, 0 nuevos). ESLint
sobre los 3 archivos exactos del commit: 0 nuevos. `DIFF_CHECK_PASS=SI`,
`BUILD_PASS=SI` (`next build` directo, sin `prisma generate` — el
cliente ya estaba generado y sin cambios de schema; evitó un lock de
archivo transitorio de Windows sobre `query_engine-windows.dll.node`
de un proceso en background, no relacionado con el código).

Ver `codex-reports/P2_T02_B1_REPARTIDOR_PWA_POST_LOGIN_ROUTING.md` para
el detalle completo, incluida la comparación de patrones de login entre
roles y el checklist de certificación del operador.

P2-T46-R1: pruebas focales 26/26, build PASS y diff-check PASS. Integraciones PostgreSQL pendientes de Railway Testing por ausencia local de `DATABASE_URL`.

## P2-T46-R3 — final Testing certification authority — 2026-09-11

La autoridad física está anclada a `CERTIFIED_RUNTIME_SHA=c3da04ef84dbd183956e78691a3b3da0f5dc2f68`.
`c826e796d33de5d00f8efddf4fa258fb86587c6` es sólo su descendiente documental;
no se presenta como runtime probado físicamente. R1=7/7 y R2=5/5 PASS.

FOCAL_TEST_PASS=4; FOCAL_TEST_FAIL=0; REGRESSION_TEST_PASS=197;
REGRESSION_TEST_FAIL=41_ENV_DATABASE_URL_MISSING_BASELINE; NEW_FAIL=0;
TYPECHECK_AFTER=31_EXPECTED_EXISTING_ERRORS; NEW_TYPECHECK_ERRORS=0;
ESLINT_NEW_FINDINGS=0; DIFF_CHECK_PASS=PASS; BUILD_PASS=PASS.
TESTING_PENDING_MIGRATIONS=0; TESTING_DB_ERRORS=0.

`P2_T46_STATUS=CLOSED_TESTING_CERTIFIED`; `P2_T46_RELEASE_ELIGIBLE=SI`.

## P2-T46-R4 — Production release authority — 2026-09-11

La release curada `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` conserva el árbol
byte-identical al runtime certificado en los 25 archivos funcionales/tests.
Focal T46: `30/30 PASS`. La batería DB-backed relevante contra Testing terminó
`244/244 PASS` después de repetir los timeouts de 5s con timeout ampliado;
los 41 fallos locales históricos por `DATABASE_URL` ausente siguen siendo
baseline y no se reinterpretan como regresiones. Typecheck conserva 31 errores
preexistentes, 0 nuevos; lint conserva un finding conocido, 0 nuevos; diff y
build PASS.

Production: migración aplicada, Prisma up to date, deployment exacto
SUCCESS/RUNNING, smoke read-only PASS y sin errores/5xx observados. Checkpoint:
`p2-t46-stable-2026-09-11`. No se autoriza lanzamiento público.

## P2-T43-R3 — Testing physical certification authority — 2026-09-12

La certificación física del operador es PASS y queda anclada al runtime R2 ya
desplegado en Testing. No se reejecutaron suites porque no hubo drift funcional.
Se preservan los resultados R2:

`FOCAL_TEST_PASS=14`, `FOCAL_TEST_FAIL=0`,
`REGRESSION_TEST_PASS=62`, `REGRESSION_TEST_FAIL=0`, `NEW_FAIL=NO`,
`ESLINT_NEW_FINDINGS=0`, `DIFF_CHECK_PASS=PASS`, `BUILD_PASS=PASS`,
`TYPECHECK=UNAVAILABLE_PREEXISTING_NO_TYPESCRIPT_BINARY`.

La migración R2 está aplicada en Testing con pending=0 y sin errores DB. El
post-certification delta de R3 es documentation-only; no representa un nuevo
runtime funcional ni requiere recertificación adicional.

`P2_T43_STATUS=CLOSED_TESTING_CERTIFIED`;
`P2_T43_RELEASE_ELIGIBLE=SI`;
`P2_T43_RELEASE_STATUS=READY_FOR_PRODUCTION_PROMOTION_EVALUATION`.
