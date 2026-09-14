# P2-T24-R5 — Controlled Testing end-to-end hardening and visual certification

## Estado de esta etapa

R5 sigue sin certificación visual. El primer intento y el retry autorizado del
escenario TEST 1 atravesaron la ruta real con fail-open RAW, pero ambos
agotaron el timeout del provider antes de producir geometría matched.

```text
P2_T24_R5_STATUS=DIAGNOSTIC_HEADER_DELIVERY_AUDIT_COMPLETE_NO_LIVE_POST
R5_TEST_1_READY=SI
TEST_1_POST_EXECUTED=SI
FULL_END_TO_END_MATCHING_CERTIFIED=NO
R3_LIVE_SERVER_ROUTE_PROBE=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
```

## Baseline

```text
P2_T24_R3_STATUS=IMPLEMENTED_TESTING_SERVER_PRODUCER
R3_COMMIT_SHA=6d3fa9a2f4fe70e4e79ddc9db72ef34ba6f2310a
R4_COMMIT_SHA=477a11919381e9b3760a18e6a191b27c7a664ab4
R4_REPORT_COMMIT_SHA=788dec3d63c53e3992a2fe627cc7e3fccf235a07
DELIGO_TESTING_DEPLOYMENT_ID=62752655-16e3-4994-84f3-3839e42b2f99
DELIGO_TESTING_DEPLOYMENT_STATUS=SUCCESS
DELIGO_TESTING_DEPLOYMENT_COMMIT=477a11919381e9b3760a18e6a191b27c7a664ab4
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
```

La aplicación Testing es `https://deligo-copy-production.up.railway.app` y el
servicio realtime es `https://chat-en-vivo-testing.up.railway.app`. No se
realizó ningún deploy manual ni se tocó `origin/main`.

## Fixture TEST_T24

Se creó un único conjunto de datos sintéticos, marcado con el prefijo
`TEST_T24_`, en la base Testing pública de Railway. La preparación usó la
guardia `DATABASE_URL=DELIGO_TEST_DATABASE_URL`, ambiente exacto `TESTING`,
`NODE_ENV=test` y `--confirm-testing`. Se asignaron sólo los actores mínimos:
Negocio, Cliente, Repartidor, asociación y pedido a domicilio.

```text
TEST_FIXTURE_CREATED=SI
BUSINESS_NAME=TEST_T24_NEGOCIO_EF55A7B9
CLIENT_ID=cmu0kal5d0001rikcbvbtd58d
DRIVER_ID=cmu0kalja0002rikcd0gu3yag
ORDER_ID=cmu0kam9n0006rikc5q57hgcu
ORDER_STATE=en_camino
ORDER_METHOD=domicilio
DRIVER_ASSIGNED=SI
TRACKING_ENABLED=SI
BUSINESS_TRACKING_ACTIVE=SI
CURRENT_LOCATION_REVISION_AT_PREPARE=0
```

La credencial temporal del Cliente se entregó únicamente en la salida runtime
de preparación y no se persiste en este reporte. La contraseña se almacenó con
el hash vigente de DeliGO; no se usó cookie ni token para el acceso físico del
operador.

### Cleanup plan

El harness exige los cuatro IDs anteriores y vuelve a comprobar todos los
nombres con prefijo `TEST_T24_` antes de borrar. El orden de cleanup es pedido,
sesiones de los dos actores, asociación, repartidor, cliente y negocio. No se
usa delete masivo ni se borran datos fuera de este fixture.

```text
TEST_FIXTURE_CLEANED=PENDING_OPERATOR_CERTIFICATION
```

## R5.2 — DeliGO live runtime OSRM latency diagnosis

No se ejecutó un tercer POST de tracking ni se modificaron timeout, policy,
fixture o código de producto. La comparación queda separada de la evidencia
R5: R3G4 usó el worker temporal `a0fa2159aadb537b9e4c31a23ebc92ac049a56c6`
con la traza ACCEPT de Berlín; R5 usó el deployment live DeliGO Copy y una
traza sintética distinta de Buenos Aires. Por lo tanto, los resultados de R3G4
no son una medición del mismo input ni del mismo proceso HTTP.

```text
RUNTIME_DIFFERENCES_FOUND=SI_INPUT_TRACE_AND_EXECUTION_PATH
R3G4_RUNTIME=TEMP_TESTING_WORKER_CLEANED_COMMIT_a0fa2159aadb537b9e4c31a23ebc92ac049a56c6
LIVE_RUNTIME=DELIGO_COPY_DEPLOYMENT_COMMIT_9d3cfb7c345b0f1c80551446ed093a6c91d01a7b
LIVE_RUNTIME_REGION=SFO
LIVE_RUNTIME_REPLICAS=1_RUNNING
LIVE_RUNTIME_NODE=v22.23.2
LIVE_RUNTIME_BUILDER=RAILPACK_V3
LIVE_RUNTIME_START_COMMAND=bun_.next/standalone/server.js
LIVE_DELIGO_ENVIRONMENT=TESTING
LIVE_NODE_ENV=test
LIVE_MAP_MATCHING_PROVIDER=osrm
LIVE_T24_OSRM_BASE_URL=https://router.project-osrm.org
LIVE_CHAT_SERVICE=https://chat-en-vivo-testing.up.railway.app
```

Las variables efectivas de DeliGO Copy coinciden con las guardas de R3G4,
pero el worker temporal no dejó registrada una imagen/region comparable y fue
eliminado. No se asume equivalencia de runtime.

### Timeout efectivo

`POST /api/repartidor/ubicacion` usa exactamente `1000 ms`. El route crea el
provider con `R3_MATCHING_TIMEOUT_TESTING_MS=1000` y vuelve a pasar
`context.timeoutMs=1000`. En `fetchJsonWithTimeout`, el reloj se inicia al
crear el `AbortController` y el timer inmediatamente antes de invocar
`fetchImpl(url, { signal })`; incluye la espera de la respuesta y su
`response.json()` hasta entrar al `finally`.

```text
MATCHING_TIMEOUT_START_POINT=BEFORE_FETCH
LIVE_ROUTE_EFFECTIVE_TIMEOUT_MS=1000
R3_MATCHING_TIMEOUT_INITIAL_TESTING_MS=1000
```

No se agregó instrumentación al route porque ya no estaba autorizado otro
POST live. La clasificación `provider_timeout` de los dos POST previos se
mantiene; su elapsed-at-abort exacto no quedó loggeado.

### Probe desde el runtime live

Se usó SSH read-only contra el contenedor activo de DeliGO Copy, con Node
`v22.23.2`, la misma URL OSRM, la misma traza ACCEPT de R5 y timeout diagnóstico
de 3000 ms. Fueron requests secuenciales, sin concurrencia ni datos de DeliGO.
La medición fue un fetch equivalente de red desde el runtime live, no un
endpoint público ni un tercer POST.

```text
LIVE_EQUIVALENT_PROBE_RUNTIME=LIVE_DELIGO_COPY_SSH_NODE_22.23.2_SFO_ONE_REPLICA
DIAGNOSTIC_TIMEOUT_MS=3000
ATTEMPT_COUNT=3
ATTEMPT_1_LATENCY_MS=590
ATTEMPT_1_HTTP_STATUS=200
ATTEMPT_1_OSRM_CODE=Ok
ATTEMPT_2_LATENCY_MS=583
ATTEMPT_2_HTTP_STATUS=200
ATTEMPT_2_OSRM_CODE=Ok
ATTEMPT_3_LATENCY_MS=NOT_OBSERVED_SSH_NO_OUTPUT
MIN_LATENCY_MS=583
MEDIAN_LATENCY_MS=586.5_OBSERVED_SAMPLE
MAX_LATENCY_MS=590
LIVE_RUNTIME_OSRM_REACHABILITY=PASS_2_OF_2_OBSERVED_RAW_FETCHES
```

La evidencia disponible indica que el contenedor live puede alcanzar OSRM en
menos de 1000 ms, pero no demuestra todavía que el adapter completo siempre
termine antes de ese límite: las dos llamadas de la ruta real expiraron y el
tercer probe SSH no fue observable. La diferencia de traza y el posible
overhead/intermitencia de `fetch`+parse quedan abiertos; no se atribuye una
causa única sin instrumentación bounded del adapter o una nueva corrida
autorizada.

```text
R5_RECOMMENDED_LIVE_MATCH_TIMEOUT_MS=1000
TIMEOUT_CONFIGURATION_CHANGE_RECOMMENDED=NO
ROOT_CAUSE_CLASSIFICATION=UNPROVEN_RUNTIME_ROUTE_OR_ADAPTER_TIMING_DISCREPANCY
P2_T24_R5_2_STATUS=DIAGNOSIS_INCONCLUSIVE_BOUNDED
```

## R5.3 — live adapter timing instrumentation

Se agregó instrumentación bounded únicamente al adapter OSRM real. Queda
habilitada sólo cuando `DELIGO_ENVIRONMENT=TESTING` y `NODE_ENV` no es
`production`; Production no ejecuta el logger ni el request. El provider usa
un solo `AbortController` y un solo `setTimeout`; `context.timeoutMs` sólo
selecciona el valor efectivo frente al timeout de configuración. No se agregó
endpoint debug ni se modificó el límite de 1000 ms, la policy ni el route.

```text
R5_3_IMPLEMENTATION_COMMIT=385396992f460ae6364cb2e5da2f9d4fb878b48d
DELIGO_TESTING_DEPLOYMENT_ID=ffbfc242-28e5-4a74-83df-1d9df564450d
DELIGO_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
DELIGO_TESTING_DEPLOYMENT_COMMIT=385396992f460ae6364cb2e5da2f9d4fb878b48d
LIVE_ROUTE_EFFECTIVE_TIMEOUT_MS=1000
PROVIDER_TIMEOUT_LAYER_COUNT=1
TIMING_LOG_CONTAINS_COORDINATES=NO
TIMING_LOG_CONTAINS_PII=NO
```

Los tests focales del provider pasaron 15/15 y los tests focales de la ruta
28/28; ESLint focal y `git diff --check` también pasaron. El único POST válido
de esta etapa usó el fixture `TEST_T24` y el escenario ACCEPT. Dos intentos de
runner anteriores fueron bloqueados antes del harness (runner incompatible y
DB privada inaccesible) y no enviaron POST.

```text
TEST_1_ATTEMPT_3_DIAGNOSTIC=EXECUTED
MATCH_POINT_COUNT=4
MATCH_RADII_PRESENT=true
MATCH_PROFILE=driving
MATCH_GEOMETRIES_MODE=geojson
MATCH_OVERVIEW_MODE=full
MATCH_GAPS_MODE=split
MATCH_TIDY_MODE=false
SERIALIZED_REQUEST_LENGTH_BYTES=215
LOCATION_REVISION_BEFORE=2
LOCATION_REVISION_AFTER=3
TRACKING_POST_HTTP_STATUS=200
DB_RAW_POSITION_ONLY=SI
DB_MATCHED_DATA_PERSISTED=NO
RAW_TRAJECTORY_EMITTED=SI
MATCHED_TRAJECTORY_EMITTED=NO
REALTIME_EVENT_COUNT=1
ORDER_STATE_AFTER=en_camino
```

El access log live confirmó el POST `200`, pero Railway no entregó ninguno de
los eventos `[Tracking Matching Timing]` del proceso para este request. Sólo
se observó el access log de la ruta; por ello no se inventan headers, parse,
total ni abort elapsed, y no se selecciona artificialmente ninguno de los
casos A/B/C/D. El resultado RAW es compatible con fallback, pero la causa del
provider no quedó observable en esta corrida.

```text
FETCH_HEADERS_MS=NOT_OBSERVED
JSON_BODY_PARSE_MS=NOT_OBSERVED
TOTAL_PROVIDER_MS=NOT_OBSERVED
ABORT_ELAPSED_MS=NOT_OBSERVED
PROVIDER_RESULT_STATUS=NOT_OBSERVED
OSRM_HTTP_STATUS=NOT_OBSERVED
OSRM_PROVIDER_CODE=NOT_OBSERVED
OSRM_MATCH_CONFIDENCE=NOT_OBSERVED
POLICY_DECISION=NOT_OBSERVED
POLICY_REJECTION_REASON=NOT_OBSERVED
ROOT_CAUSE_CLASSIFICATION=LIVE_ADAPTER_TIMING_LOG_UNAVAILABLE_AFTER_CONTROLLED_POST
R5_ACCEPT_SERVER_PATH=BLOCKED_TIMING_EVIDENCE_UNAVAILABLE
R5_MATCHED_REALTIME_END_TO_END=BLOCKED_TIMING_EVIDENCE_UNAVAILABLE
R3_LIVE_SERVER_ROUTE_PROBE=BLOCKED_TIMING_EVIDENCE_UNAVAILABLE
TIMEOUT_CONFIGURATION_CHANGE_RECOMMENDED=NO
P2_T24_R5_3_STATUS=CONTROLLED_POST_COMPLETE_TIMING_EVIDENCE_UNAVAILABLE
```

No se ejecutó un cuarto POST, no se pidió observación visual, no se ejecutaron
TEST 2, stale, recovery, completion o cleanup, y Production no fue tocada.

## R5.4 — observable live adapter timing via Testing response headers

Se agregó un canal efímero de response headers para el mismo POST, protegido
por las tres condiciones simultáneas: `DELIGO_ENVIRONMENT=TESTING`,
`NODE_ENV != production` y request header explícito `X-T24-Diagnostic: 1`.
El body normal, realtime, DB RAW y la policy no se modifican. El harness sólo
envía el opt-in con `--diagnostic`; el Cliente normal nunca lo envía.

```text
R5_4_IMPLEMENTATION_COMMIT=043abeb6dc5e0267eb9f01c5bb7614eb334b654f
DELIGO_TESTING_DEPLOYMENT_ID=2d168051-5c3c-4758-ba5a-1b3222826767
DELIGO_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
DELIGO_TESTING_DEPLOYMENT_COMMIT=043abeb6dc5e0267eb9f01c5bb7614eb334b654f
T24_DIAGNOSTIC_RESPONSE_PRODUCTION_AVAILABLE=NO
```

El único POST adicional se ejecutó sobre el fixture `TEST_T24` existente y el
dataset ACCEPT. La respuesta mantuvo el comportamiento de persistencia y
realtime esperado, pero no expuso ningún `X-T24-Match-*`; el harness recibió
`NOT_AVAILABLE` para todos los campos diagnósticos. Esto impide distinguir si
el provider llegó a headers, agotó el body/parse o fue clasificado por timeout.

```text
TEST_1_ATTEMPT_4_DIAGNOSTIC=EXECUTED
TRACKING_POST_HTTP_STATUS=200
LOCATION_REVISION_BEFORE=3
LOCATION_REVISION_AFTER=4
PROVIDER_RESULT_STATUS=NOT_AVAILABLE
FETCH_HEADERS_MS=NOT_AVAILABLE
JSON_BODY_PARSE_MS=NOT_AVAILABLE
TOTAL_PROVIDER_MS=NOT_AVAILABLE
ABORT_ELAPSED_MS=NOT_AVAILABLE
OSRM_HTTP_STATUS=NOT_AVAILABLE
OSRM_PROVIDER_CODE=NOT_AVAILABLE
OSRM_MATCH_CONFIDENCE=NOT_AVAILABLE
POLICY_DECISION=NOT_AVAILABLE
POLICY_REJECTION_REASON=NOT_AVAILABLE
MATCHED_TRAJECTORY_EMITTED=NO
RAW_TRAJECTORY_EMITTED=SI
REALTIME_EVENT_COUNT=1
LOCATION_REVISION_INCREMENT_PER_BATCH=1
DB_RAW_POSITION_ONLY=SI
DB_MATCHED_DATA_PERSISTED=NO
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
```

```text
DIAGNOSTIC_RESPONSE_CONTAINS_COORDINATES=NO
DIAGNOSTIC_RESPONSE_CONTAINS_PII=NO
ROOT_CAUSE_CLASSIFICATION=DIAGNOSTIC_RESPONSE_HEADERS_NOT_OBSERVED
TIMEOUT_CONFIGURATION_CHANGE_RECOMMENDED=NO
R5_ACCEPT_SERVER_PATH=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
R5_MATCHED_REALTIME_END_TO_END=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
R3_LIVE_SERVER_ROUTE_PROBE=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
TESTING_DIAGNOSTIC_HEADERS_FUTURE_ACTION=KEEP_TESTING_ONLY_UNTIL_R5_COMPLETE
P2_T24_R5_4_STATUS=CONTROLLED_POST_COMPLETE_DIAGNOSTIC_HEADERS_UNAVAILABLE
```

No se ejecutará un quinto POST. No se hizo visual certification, TEST 2,
stale, recovery, completion, cleanup ni Production.

## R5.5 — auditoría de entrega del canal diagnóstico

Esta revisión fue sólo estática y de tests. No se ejecutó un quinto POST, no se
alteró el timeout, no se cambió la policy, no se modificó el fixture y no se
realizó deploy. El fixture conserva la revisión 4 producida por el POST R5.4.

### A — harness y request

El harness existente agrega el opt-in únicamente cuando se pasa
`--diagnostic`. La rama se ejecutó en el Attempt 4: la salida runtime registró
`DIAGNOSTIC_RESPONSE_REQUESTED=SI`. El POST usa `fetch` directo, sin wrapper de
retry; no hay retry explícito ni redirección configurada por el harness (queda
el comportamiento por defecto de `fetch`). La cabecera es exacta y el harness
no envía `matchedTrajectory`.

```text
HARNESS_DIAGNOSTIC_FLAG_USED_ATTEMPT_4=SI
HARNESS_REQUEST_HEADER_NAME=X-T24-Diagnostic
HARNESS_REQUEST_HEADER_VALUE=1
HARNESS_REQUEST_RETRY_WRAPPER=NO
HARNESS_REQUEST_REDIRECT_OVERRIDE=NO
```

### B — guards de la ruta

La ruta lee `req.headers.get("x-t24-diagnostic")`, cuya comparación de nombre
es case-insensitive en la API Headers, y exige el valor exacto `1`. La entrega
de headers sólo se habilita simultáneamente con
`DELIGO_ENVIRONMENT=TESTING` y `NODE_ENV != production`. El Cliente normal no
envía este opt-in; Production no lo acepta aunque el request lo incluya.

```text
DIAGNOSTIC_ENV_GUARD=DELIGO_ENVIRONMENT==TESTING_AND_NODE_ENV!=production
DIAGNOSTIC_REQUEST_GUARD=req.headers.get_CASE_INSENSITIVE_X-T24-Diagnostic==1
```

### C — supervivencia provider → route → response

El provider entrega los diagnósticos por callback observacional en el contexto
de matching; el resultado de matching sigue siendo el contrato normal. El
callback se invoca en timeout, error HTTP/network, parse inválido y respuesta
procesada. La ruta conserva el valor antes de evaluar la policy y, después del
RAW commit y del publish, usa `buildT24DiagnosticHeaders` en la respuesta
200. Por ello los caminos normales de timeout/fallback RAW y de rechazo
conservan el diagnóstico; el camino matched conserva también el resultado y
la policy ACCEPT.

Los retornos previos al matching (autenticación, autorización, elegibilidad,
rate limit, payload inválido o ausencia de filas) no llevan headers
diagnósticos. El retorno 500 del `catch` exterior tampoco los lleva si falla
el publish u otra operación posterior al commit; es un camino excepcional y
no el fallback normal del provider.

```text
DIAGNOSTIC_DATA_SURVIVES_TIMEOUT_PATH=SI
DIAGNOSTIC_DATA_SURVIVES_REJECT_PATH=SI
ROUTE_TIMEOUT_RESPONSE_HEADER_TEST=PASS
ROUTE_SUCCESS_RESPONSE_HEADER_TEST=PASS
TESTING_NO_OPTIN_HEADER_TEST=PASS
PRODUCTION_DIAGNOSTIC_HEADER_TEST=PASS
```

Los tests focales confirmaron 15/15 del provider y 33/33 de la ruta; ESLint
focal y `git diff --check` pasaron. El test de timeout comprueba HTTP 200,
fallback RAW, `X-T24-Match-Result=timeout`, ausencia de headers/parse,
`X-T24-Match-Total-Ms=1001`, `X-T24-Match-Abort-Ms=1000` y
`REJECT_MATCH/provider_timeout`. El test matched comprueba `matched`, HTTP 200,
provider `Ok`, confidence, `ACCEPT_MATCH` y ausencia de rechazo.

### D — deployed artifact y clasificación

El metadata de Railway confirma que el deployment live de DeliGO Copy se
construyó desde `d39274651b8f0976a3cbfe0f852b1169f94b938c`, descendiente del
commit R5.4 `043abeb6dc5e0267eb9f01c5bb7614eb334b654f`. La búsqueda read-only
dentro del contenedor no produjo salida observable; por eso no se afirma que
el bundle desplegado contenga el código, aunque el commit fuente sí lo
contiene. Con la respuesta live sin headers y el artefacto no verificable, el
origen exacto sigue sin estar probado entre bundle/runtime y entrega de
headers.

```text
DEPLOYED_BUILD_DIAGNOSTIC_CODE_PRESENT=UNVERIFIED
DIAGNOSTIC_CONTROL_HEADER_NEEDED=SI
ROOT_CAUSE_CLASSIFICATION=HEADER_DELIVERY_UNPROVEN_DEPLOYED_ARTIFACT_OR_PLATFORM_PATH
CODE_CHANGE_REQUIRED=NO
```

El control separado `X-T24-Diagnostic-Enabled: 1` queda como posible siguiente
instrumento para distinguir llegada del opt-in de propagación de datos; no se
implementa ni se despliega en esta etapa. No hay base para clasificar todavía
el problema como stripping de plataforma.

```text
P2_T24_R5_5_STATUS=STATIC_AND_ROUTE_TEST_AUDIT_COMPLETE_NO_LIVE_POST
CURRENT_LOCATION_REVISION=4
R5_ACCEPT_SERVER_PATH=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
R5_MATCHED_REALTIME_END_TO_END=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
FIFTH_LIVE_POST_AUTHORIZED=NO
TIMEOUT_CONFIGURATION_CHANGE_RECOMMENDED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=REQUIRE_EXPLICIT_DIAGNOSTIC_CONTROL_HEADER_DECISION_BEFORE_ANY_NEW_LIVE_POST
```

## Harness y TEST 1

El único harness R5 es:

```text
scripts/testing/t24-controlled-e2e.ts
```

La preparación validó el login real del Cliente mediante `POST /api/auth/login`
y luego consultó `GET /api/pedidos/{id}/tracking`, obteniendo:

```text
CLIENT_NORMAL_LOGIN=PASS
TRACKING_ELIGIBILITY=PASS
SERVER_ACCEPT_EVIDENCE=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
```

## Resultado técnico TEST 1 — intentos separados

El operador confirmó que el Cliente tenía el mapa abierto y respondió
`LISTO`. El harness no envió `matchedTrajectory` en ninguno de los dos POST.

### Intento 1

```text
TEST_1_ATTEMPT_1=PROVIDER_TIMEOUT_RAW_FAILOPEN
R5_TEST_1_EXECUTED=SI
ORDER_STATE_BEFORE=en_camino
TRACKING_ENABLED_BEFORE=SI
DRIVER_ASSIGNED_BEFORE=SI
LOCATION_REVISION_BEFORE=0
TRACKING_POST_HTTP_STATUS=200
LOCATION_REVISION_AFTER=1
LOCATION_REVISION_INCREMENT_PER_BATCH=1
PROVIDER_ATTEMPTED=SI
PROVIDER_RESULT_STATUS=TIMEOUT
OSRM_MATCH_CONFIDENCE=NOT_AVAILABLE
POLICY_DECISION=REJECT_MATCH
POLICY_REJECTION_REASON=provider_timeout
MATCHED_TRAJECTORY_EMITTED=NO
MATCHED_TRAJECTORY_POINT_COUNT=0
RAW_TRAJECTORY_EMITTED=SI
REALTIME_EVENT_COUNT=1
DB_RAW_POSITION_ONLY=SI
DB_MATCHED_DATA_PERSISTED=NO
R5_RAW_REALTIME_END_TO_END=PASS
R5_PROVIDER_TIMEOUT_FAILOPEN=PASS
R5_REAL_RAW_FALLBACK_SERVER=PASS
R5_REAL_RAW_FALLBACK_VISUAL=PENDING_OPERATOR_CERTIFICATION
```

El timeout es el timeout Testing vigente de R3 (`1000 ms`) frente al OSRM
público; la respuesta HTTP y la escritura RAW no fallaron. El witness real sí
recibió el evento `repartidor-location` por el Chat bridge, pero fue el evento
RAW de fallback, sin geometría matched.

### Intento 2 — retry único autorizado

Se ejecutó exactamente un retry live del mismo dataset ACCEPT mediante el
harness existente y la ruta real de Testing. El resultado fue nuevamente un
timeout del provider.

```text
TEST_1_ATTEMPT_2=PROVIDER_TIMEOUT_RAW_FAILOPEN
RETRY_COUNT=1
LOCATION_REVISION_BEFORE=1
LOCATION_REVISION_AFTER=2
TRACKING_POST_HTTP_STATUS=200
PROVIDER_ATTEMPTED=SI
PROVIDER_RESULT_STATUS=TIMEOUT
PROVIDER_LATENCY_MS=NOT_AVAILABLE
OSRM_MATCH_CONFIDENCE=NOT_AVAILABLE
POLICY_DECISION=REJECT_MATCH
POLICY_REJECTION_REASON=provider_timeout
MATCHED_TRAJECTORY_EMITTED=NO
MATCHED_TRAJECTORY_POINT_COUNT=0
RAW_TRAJECTORY_EMITTED=SI
REALTIME_EVENT_COUNT=1
DB_RAW_POSITION_ONLY=SI
DB_MATCHED_DATA_PERSISTED=NO
R5_RAW_REALTIME_END_TO_END=PASS
R5_PROVIDER_TIMEOUT_FAILOPEN=PASS
R5_REAL_RAW_FALLBACK_SERVER=PASS
R5_MATCHED_REALTIME_END_TO_END=BLOCKED_PROVIDER_TIMEOUT
R5_ACCEPT_SERVER_PATH=BLOCKED_PROVIDER_TIMEOUT
LIVE_ROUTE_PROVIDER_TIMEOUT_COUNT=2
R5_TIMEOUT_1000MS_LIVE_ROUTE_ASSESSMENT=NEEDS_REMEASUREMENT
OPERATOR_VISUAL_CONFIRMATION=NOT_REQUESTED_FOR_RETRY
```

El retry mantuvo `LOCATION_REVISION_INCREMENT_PER_BATCH=1`, publicó un único
evento RAW y no persistió matched en DB. No se hizo un tercer intento, no se
modificó el timeout de 1000 ms y no se modificó la policy.

El primer escenario es `MATCHED_CURVE_CORNER_END_TO_END`. Su traza RAW contiene
cuatro puntos sintéticos válidos con `offsetMs` y `accuracy`; el harness no
acepta ni envía `matchedTrajectory`. El POST se envió únicamente a
`POST /api/repartidor/ubicacion` de Testing y el witness realtime se unió a la
sala del pedido mediante el token y capability reales. El matching OSRM y
`evaluateMapMatching` fueron ejecutados por el servidor R3.

```text
R5_TEST_1_READY=SI
SERVER_ACCEPT_EVIDENCE=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
CURRENT_LOCATION_REVISION=4
EXPECTED_VISUAL_BEHAVIOR=marker follows the matched street-shaped curve and corner continuously; no diagonal cut
```

## Alcance preservado

```text
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
DB_RAW_POSITION_ONLY=SI
MATCHED_TRAJECTORY_VISUAL_ONLY=SI
MATCHED_TRAJECTORY_VERSION_POLICY=SAME_LOCATION_REVISION_AS_RAW
LOCATION_REVISION_INCREMENT_PER_BATCH=1
REALTIME_EVENT_COUNT_PER_BATCH=1
CLIENT_VISUAL_TRAJECTORY_SELECTION_POLICY=matchedTrajectory_IF_VALID_ELSE_RAW_trajectory
CURRENT_CLIENT_CONTINUITY_THRESHOLD_M=150
CONTINUITY_THRESHOLD_CALIBRATED_FOR_PRODUCTION=NO
T54_ABSORBED=NO
```

No se modificaron navegación del Repartidor, camera follow, auto recenter,
turn-by-turn, provider, policy, DB, Prisma, migraciones, bridge ni Production.

## Evidencia pendiente

Los siguientes escenarios se ejecutarán de a uno y requieren confirmación del
operador entre cada uno: curva/esquina, matched→RAW, RAW→matched, stale,
recovery y completion. Hasta completar esa secuencia no se declarará evidencia
visual ni certificación end-to-end.

```text
R5_ACCEPT_SERVER_PATH=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
R5_RAW_REALTIME_END_TO_END=PASS
R5_MATCHED_REALTIME_END_TO_END=BLOCKED_DIAGNOSTIC_RESPONSE_UNAVAILABLE
R5_REAL_RAW_FALLBACK=PASS
R5_MATCHED_CURVE_VISUAL=NOT_RUN
R5_MATCHED_TO_RAW_VISUAL=NOT_RUN
R5_RAW_TO_MATCHED_VISUAL=NOT_RUN
R5_STALE_VISUAL=NOT_RUN
R5_RECOVERY_VISUAL=NOT_RUN
R5_COMPLETION_VISUAL=NOT_RUN
DB_MATCHED_DATA_PERSISTED=NO
PROVIDER_PII_SENT=NOT_RUN
MATCHED_CLIENT_METADATA_EXPOSED=NO
T23_REGRESSION=PASS
P2_T24_READY_FOR_R6=NO
OPERATOR_VISUAL_CONFIRMATION=PENDING
NEXT_ACTION=REQUIRE_EXPLICIT_DIAGNOSTIC_CONTROL_HEADER_DECISION_BEFORE_ANY_NEW_LIVE_POST
```

## Instrucciones para el operador

Abrir:

```text
https://deligo-copy-production.up.railway.app/login?redirect=/cliente
```

Iniciar sesión con el identificador y contraseña entregados en la respuesta
runtime, abrir el pedido activo `TEST_T24`, tocar `Rastrear envío`, dejar el
mapa abierto y responder `LISTO`. No se debe ejecutar ningún escenario antes
de esa respuesta.
