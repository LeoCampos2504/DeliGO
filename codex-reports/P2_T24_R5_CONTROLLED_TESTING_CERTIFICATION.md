# P2-T24-R5 — Controlled Testing end-to-end hardening and visual certification

## Estado de esta etapa

R5 sigue sin certificación visual. El primer intento y el retry autorizado del
escenario TEST 1 atravesaron la ruta real con fail-open RAW, pero ambos
agotaron el timeout del provider antes de producir geometría matched.

```text
P2_T24_R5_STATUS=IN_PROGRESS_OPERATOR_CERTIFICATION
R5_TEST_1_READY=SI
TEST_1_POST_EXECUTED=SI
FULL_END_TO_END_MATCHING_CERTIFIED=NO
R3_LIVE_SERVER_ROUTE_PROBE=NOT_RUN
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
SERVER_ACCEPT_EVIDENCE=BLOCKED_PROVIDER_TIMEOUT
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
SERVER_ACCEPT_EVIDENCE=BLOCKED_PROVIDER_TIMEOUT
CURRENT_LOCATION_REVISION=2
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
R5_ACCEPT_SERVER_PATH=BLOCKED_PROVIDER_TIMEOUT
R5_RAW_REALTIME_END_TO_END=PASS
R5_MATCHED_REALTIME_END_TO_END=BLOCKED_PROVIDER_TIMEOUT
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
NEXT_ACTION=REMEASURE_OSRM_LATENCY_FROM_DELIGO_LIVE_RUNTIME_CONTEXT
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
