# P2-T24-R5 — Controlled Testing end-to-end hardening and visual certification

## Estado de esta etapa

R5 está preparado para el primer escenario visual, pero todavía no está
certificado. El operador debe abrir el Cliente Testing y dejar el mapa visible
antes de disparar el POST real; por eso el replay TEST 1 aún no fue enviado.

```text
P2_T24_R5_STATUS=IN_PROGRESS_OPERATOR_CERTIFICATION
R5_TEST_1_READY=SI
TEST_1_POST_EXECUTED=NO
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
CURRENT_LOCATION_REVISION=0
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
SERVER_ACCEPT_EVIDENCE=PENDING_OPERATOR_REPLAY
```

El primer escenario es `MATCHED_CURVE_CORNER_END_TO_END`. Su traza RAW contiene
cuatro puntos sintéticos válidos con `offsetMs` y `accuracy`; el harness no
acepta ni envía `matchedTrajectory`. Cuando se ejecute, el POST irá únicamente
a `POST /api/repartidor/ubicacion` de Testing y el witness realtime se unirá a
la sala del pedido mediante el token y capability reales. El matching OSRM y
`evaluateMapMatching` los ejecutará el servidor R3.

```text
R5_TEST_1_READY=SI
SERVER_ACCEPT_EVIDENCE=PENDING_OPERATOR_REPLAY
CURRENT_LOCATION_REVISION=0
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
R5_ACCEPT_SERVER_PATH=NOT_RUN
R5_REALTIME_END_TO_END=NOT_RUN
R5_REAL_RAW_FALLBACK=NOT_RUN
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
NEXT_ACTION=WAIT_FOR_OPERATOR_TO_OPEN_TESTING_CLIENT_AND_REPLY_LISTO
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
