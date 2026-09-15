# P2-T24-R5.13 — Raw pipeline instrumentation for controlled physical probe

## Alcance y autoridad

Esta fase agrega únicamente observabilidad Testing-only al flujo real del
Repartidor y del Cliente. No ejecuta el probe físico, no crea puntos GPS, no
modifica la decisión de tracking, no cambia thresholds, opciones de
`watchPosition`, batching, playback, matching, realtime ni Production.

```text
P2_T24_R5_13_STATUS=IMPLEMENTED_TESTING_DEPLOYED_READY_FOR_SHORT_INSTRUMENTED_PROBE
P2_T24_STATUS=IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_NOT_RELEASE_ELIGIBLE
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
P2_T23_FORMALLY_REOPENED=NO
P2_T23_DIAGNOSTIC_HARDENING_ACTIVE=SI
STEPWISE_BEHAVIOR_IS_T24_MATCHING_BUG=NO
STEPWISE_BEHAVIOR_OWNER=P2_T23_REGRESSION_OR_HARDENING
STEPWISE_ROOT_CAUSE=raw trajectory input predominante de 1 punto; etapa exacta upstream aún no observable
GPS_CALLBACK_FREQUENCY=NOT_OBSERVABLE
CLIENT_FREEZE_ROOT_CAUSE=UNKNOWN
PRODUCTION_TOUCHED=NO
```

## Instrumentación implementada

El witness Testing, gated por `DELIGO_ENVIRONMENT=TESTING` y por el pedido
físico exacto, registra sin persistir en DB:

```text
GPS_CALLBACK_WITNESS=SI
FILTER_DECISION_WITNESS=SI
THROTTLE_DECISION_WITNESS=SI
BUFFER_APPEND_AND_FLUSH_WITNESS=SI
POST_START_AND_COMPLETION_WITNESS=SI
CLIENT_LIFECYCLE_WITNESS=SI
CLIENT_REALTIME_CONNECTION_WITNESS=SI
CLIENT_MAP_LIFECYCLE_WITNESS=SI
CLIENT_PLAYBACK_SOURCE_WITNESS=SI
GPS_CALLBACK_WITNESS_IMPLEMENTED=SI
MOVEMENT_DECISION_WITNESS_IMPLEMENTED=SI
THROTTLE_WITNESS_IMPLEMENTED=SI
BUFFER_BATCH_WITNESS_IMPLEMENTED=SI
POST_CORRELATION_IMPLEMENTED=SI
VISIBILITY_LIFECYCLE_WITNESS_IMPLEMENTED=SI
CLIENT_REALTIME_CONNECTION_WITNESS_IMPLEMENTED=SI
CLIENT_MAP_LIFECYCLE_WITNESS_IMPLEMENTED=SI
CLIENT_PLAYBACK_WITNESS_IMPLEMENTED=SI
CLIENT_WITNESS_SOURCE_LABEL_FIXED=SI
WITNESS_REVISION_GAP_METRIC_FIXED=SI
```

Cada callback incluye secuencia, origen (`watchPosition` o
`getCurrentPosition`), timestamp relativo, precisión y estado de visibilidad y
red. La decisión registrada es la decisión efectiva del filtro actual; los
metadatos Testing-only no participan en ella. Los POST correlacionan batch,
cantidad de puntos y rango de callbacks mediante un header diagnóstico
Testing-only; el payload GPS conserva únicamente coordenadas, `offsetMs` y
`accuracy`.

El endpoint de witness acepta ahora el Repartidor del pedido físico además
del Cliente, siempre con la misma asociación real y el prefijo exacto
`TEST_T24_PHYSICAL_`. Continúa siendo side-channel de logs, sin escrituras de
DB.

## Métrica de revisiones y playback

```text
WITNESS_REVISION_GAP_METRIC_FIXED=SI
REVISION_OBSERVATION_CHANNELS=REALTIME,HTTP
REVISION_GAP_CLASSIFICATIONS=SERVER_REVISION_NOT_RECEIVED_REALTIME,SERVER_REVISION_RECEIVED_HTTP_ONLY,SERVER_REVISION_NOT_OBSERVED_BY_CLIENT
CLIENT_WITNESS_SOURCE_VALUES=MATCHED,RAW,LOCATION_ONLY
PLAYBACK_BEHAVIOR_CHANGED=NO
```

La clasificación requiere como autoridad el conjunto de revisiones publicadas
por el servidor y separa observación realtime de cobertura HTTP. No se vuelve
a contar una revisión sólo como “perdida” por no aparecer en el subconjunto
realtime.

## Guardas y verificación

```text
PRODUCTION_FAIL_CLOSED=SI
NON_TESTING_WITNESS_EMISSION=NO
TRACKING_BEHAVIOR_CHANGED=NO
THRESHOLDS_CHANGED=NO
WATCH_POSITION_OPTIONS_CHANGED=NO
WATCHPOSITION_OPTIONS_CHANGED=NO
BATCHING_CHANGED=NO
BATCH_POLICY_CHANGED=NO
PLAYBACK_CHANGED=NO
PLAYBACK_POLICY_CHANGED=NO
MATCHING_POLICY_CHANGED=NO
REALTIME_CONTRACT_CHANGED=NO
MOVEMENT_THRESHOLD_CHANGED=NO
MIN_SEND_INTERVAL_CHANGED=NO
REALTIME_BEHAVIOR_CHANGED=NO
DB_SCHEMA_CHANGED=NO
PRISMA_MIGRATION_CREATED=NO
PHYSICAL_PROBE_EXECUTED=NO
PHYSICAL_FIXTURE_CLEANUP=DEFERRED_FOR_FUTURE_INSTRUMENTED_PROBE
```

```text
TESTS=PASS_WITH_ONE_PREEXISTING_T24_SINGLE_FLIGHT_FAILURE
LINT=PASS
DIFF_CHECK=PASS
BUILD=PASS
```

La instrumentación queda desplegada en Testing y preparada para un único
probe corto de movimiento real. No se ejecuta ningún escenario, replay,
cleanup, R6, T54 ni promoción a Production en esta fase.

```text
NEXT_ACTION=PREPARE_SHORT_REAL_MOVEMENT_PROBE
P2_T24_R5_13_PROBE_EXECUTED=NO
P2_T24_R5_13_PRODUCTION_PROMOTION_AUTHORIZED=NO
```
