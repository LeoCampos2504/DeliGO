# P2-T24-R5.12 — Raw sample density, playback and freeze root-cause audit

## Alcance y autoridad

Esta auditoría usa únicamente el run físico R5.11 ya terminado del pedido
`cmu1p548z0006riv8ntyibf0w`. No ejecuta otra prueba, no genera puntos, no
limpia el fixture y no cambia thresholds, tracking, provider policy,
playback ni realtime.

```text
P2_T24_R5_12_STATUS=TECHNICAL_AUDIT_COMPLETE_AWAITING_FUTURE_INSTRUMENTED_PROBE
P2_T24_STATUS=IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_NOT_RELEASE_ELIGIBLE
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
MATCHED_REALTIME_END_TO_END_SERVER_CLIENT=FAIL
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
DB_RAW_POSITION_ONLY=SI
PRODUCTION_TOUCHED=NO
```

## Observación humana R5.11

```text
OPERATOR_MOVEMENT=MUCHOS_SALTOS
OPERATOR_WRONG_ROAD_DEVIATIONS=0
OPERATOR_WRONG_ROAD_CONTEXT=NOT_APPLICABLE
OPERATOR_SELF_CORRECTION=NO_APLICA
OPERATOR_TRACKING_FREEZE_OR_DISAPPEAR=SI
OPERATOR_FREEZE_COUNT=1
OPERATOR_FREEZE_RECOVERY=close/reopen delivery map
OPERATOR_GENERAL_EXPERIENCE=BIEN
OPERATOR_FREE_TEXT=all jumps, never smooth
SMOOTH_MOVEMENT=NO
OPERATOR_JUMPS_OCCURRED_WHILE_RENDER_SOURCE=RAW
MATCHED_RAW_TRANSITIONS_CAUSED_OPERATOR_JUMPS=NO
PROVIDER_WRONG_BRANCH_CAUSED_OPERATOR_JUMPS_IN_THIS_RUN=NO_EVIDENCE
```

`BIEN` se conserva como experiencia general y no se interpreta como
movimiento fluido.

## Pipeline auditado

```text
GPS_CALLBACK_FREQUENCY=NOT_OBSERVABLE
TRACKING_POST_COUNT=41
GPS_CALLBACKS_PER_POST_MEDIAN=NOT_AVAILABLE
MOVEMENT_THRESHOLD_CONTRIBUTION=UNPROVEN
FIVE_SECOND_THROTTLE_CONTRIBUTION=UNPROVEN
```

El witness R5.11 sólo registraba POSTs server-side y eventos Cliente; no
registraba cada callback de `watchPosition`, cada descarte por movimiento ni
cada flush local. Por lo tanto no permite separar A/B/C con certeza.

El hook actual confirma:

```text
GPS_WATCH_OPTIONS=enableHighAccuracy:false, maximumAge:3000ms, timeout:4000ms
MOVEMENT_POLICY=max(15m, accuracy_new + accuracy_previous)
MIN_SEND_INTERVAL_MS=5000
STATIONARY_HEARTBEAT_MS=60000
MAX_MOVING_BATCH_AGE_MS=3000
MAX_BATCH_POINTS=12
MAX_BATCH_DURATION_MS=5000
MAX_BATCH_DISTANCE_METERS=150
```

`maximumAge=3000` permite reutilizar una posición de hasta 3 segundos. La
política filtra movimiento no significativo y aplica un mínimo de 5 segundos;
no existe evidencia suficiente para afirmar qué proporción de callbacks fue
descartada o throttled.

## Run server-side

```text
LOCATION_REVISION_BEFORE_RUN=48
LOCATION_REVISION_AFTER_RUN=89
FIRST_REAL_RUN_REVISION=49
LAST_REAL_RUN_REVISION=89
TOTAL_REAL_GPS_WRITES=41
RUN_START_TIMESTAMP=2026-09-15T01:35:21.878Z
RUN_END_TIMESTAMP=2026-09-15T01:46:45.829Z
SYNTHETIC_TRACKING_POSTS_DURING_RUN=0
```

### Contenido RAW por batch

```text
RAW_BATCH_POINT_COUNTS=0,0,1,1,1,1,3,2,1,1,2,0,0,3,1,5,5,3,2,6,2,1,0,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,2,2
BATCH_POINT_COUNT_MEDIAN=1
BATCH_POINT_COUNT_P95=5
BATCH_POINT_COUNT_MAX=6
RAW_BATCH_DENSITY=MIXED_BUT_PREDOMINANTLY_SPARSE
RAW_TRAJECTORY_POINTS_MEDIAN=1
RAW_TRAJECTORY_POINTS_P95=5
RAW_TRAJECTORY_POINTS_MAX=6
RAW_TRAJECTORY_DISTANCE_MEDIAN=NOT_AVAILABLE_PER_BATCH
```

Las revisiones 60 y 61 fueron `location-only` (`rawPointCount=0`). No hay
evidencia de un batch acumulándose durante el hueco.

```text
REV_60_61_ROOT_CAUSE=UNKNOWN
REV_60_61_CLASSIFICATION=UNKNOWN
REV_60_61_EVIDENCE=location-only en ambas revisiones; no se registraron callbacks GPS, estado de visibilidad ni eventos de red del cliente
```

El server sí recibió ambos POSTs y no presentó un gap server-side oculto. La
evidencia disponible no permite distinguir `GPS_CALLBACK_GAP`,
`CLIENT_RUNTIME_SUSPEND`, `NETWORK_SEND_GAP` o `BATCH_FLUSH_GAP`.

### Densidad temporal y espacial

```text
RAW_POINT_INTERVAL_MEDIAN_MS=6865
RAW_POINT_INTERVAL_P95_MS=60374
RAW_POINT_INTERVAL_LONGEST_MS=62657
RAW_DISTANCE_MEDIAN_M=60.6
RAW_DISTANCE_P95_M=336.1
RAW_DISTANCE_LARGEST_M=2248
SAMPLE_DENSITY_STATUS=MIXED
MEDIAN_POINT_INTERVAL=6865ms
LONGEST_POINT_INTERVAL=62657ms
MEDIAN_POINT_DISTANCE=60.6m
LARGEST_POINT_DISTANCE=2248m
CORRELATION_WITH_TELEPORT_CANDIDATES=UNPROVEN
```

## Provider y realtime

```text
PROVIDER_ATTEMPTS=6
PROVIDER_HTTP_SUCCESS=6
PROVIDER_TIMEOUTS=0
PROVIDER_OTHER_FAILURES=0
PROVIDER_ACCEPTED=0
PROVIDER_POLICY_REJECTED=6
LOW_CONFIDENCE=1
SNAP_DISTANCE=0
INSUFFICIENT_POINTS=0
TIMEOUT=0
OTHER=5 (ambiguous_tracepoints)
T24_PROVIDER_PHYSICAL_ACCEPTANCE=FAIL
T24_PROVIDER_PRIMARY_BLOCKER=raw input físico escaso/ambiguo para la policy; relación causal completa no demostrada
```

```text
REALTIME_EVENTS_PUBLISHED=41
REALTIME_EVENTS_WITH_MATCHED_TRAJECTORY=0
REALTIME_EVENTS_RAW_ONLY=41
REVISION_GAPS_SERVER_TO_REALTIME=0
DUPLICATE_REALTIME_REVISIONS=0
OUT_OF_ORDER_REALTIME_REVISIONS=0
```

No hubo transiciones `MATCHED → RAW` ni `RAW → MATCHED`, porque no existió
ningún `ACCEPT_MATCH`.

## Cliente, playback y freeze

```text
CLIENT_HTTP_UPDATES_RECEIVED=31
CLIENT_REALTIME_UPDATES_RECEIVED=38
CLIENT_MATCHED_RENDER_EVENTS=0
CLIENT_RAW_RENDER_EVENTS=38
CLIENT_SNAPS=0
CLIENT_STALE_RECOVERIES=0
CLIENT_QUEUE_COMPRESSIONS=NOT_OBSERVABLE
CLIENT_DROPPED_OR_SUPERSEDED_UPDATES=0_OBSERVED
PUBLISHED_BUT_NOT_CLIENT_RECEIVED=49,52,85
CLIENT_REALTIME_MISSED_REVISIONS=49,52,85 (49 y 52 también observadas por HTTP)
CLIENT_RECEIVE_LONGEST_GAP_MS=62886
CLIENT_REVISION_GAPS_METRIC_MEANING=gap del subconjunto client_realtime_applied frente al rango server; no representa pérdida total porque HTTP puede cubrir revisiones
WITNESS_REVISION_GAP_METRIC_BUG=SI
CLOSE_REOPEN_RECOVERY=OPERATOR_REPORTED
HTTP_LATEST_AFTER_REOPEN=NOT_OBSERVABLE
RESUBSCRIBE_AFTER_REOPEN=NOT_OBSERVABLE
```

La selección de playback es matched-first y RAW fallback. Para este run, al no
haber `matchedTrajectory`, la geometría visual disponible fue RAW. El
controlador genera segmentos por cada punto, con `80–750ms` por segmento, y
usa una cola activa más una pendiente; el límite de cola es 2. Sin embargo,
las trayectorias RAW llegaron predominantemente con un solo punto, por lo que
el controlador no recibió geometría suficiente para suavizar el recorrido.

```text
RAW_TRAJECTORY_USES_PLAYBACK_CONTROLLER=SI
RAW_TRAJECTORY_FULL_GEOMETRY_PLAYED=SI (cuando el batch contiene varios puntos)
RAW_PLAYBACK_SEGMENT_DURATION_POLICY=clamp(delta_offset_ms / speedFactor, 80ms..750ms); speedFactor 1 normal, 2 sólo con batch pendiente
CLIENT_FREEZE_ROOT_CAUSE=UNKNOWN
```

La congelación única fue recuperada cerrando y reabriendo el mapa. El witness
no registra un evento explícito de desconexión, lifecycle o remount que permita
atribuirla a websocket, estado stale, controlador, visibilidad o HTTP.

El source del evento `client_playback_acceptance` de R5.11 era ambiguo: decía
`MATCHED` ante cualquier trayectoria visual, incluso RAW. Se corrigió sólo esa
instrumentación para futuras pruebas:

```text
CLIENT_WITNESS_SOURCE_LABEL_FIXED=SI
CLIENT_WITNESS_SOURCE_VALUES=MATCHED,RAW,LOCATION_ONLY
CLIENT_WITNESS_FIX_SCOPE=TESTING_WITNESS_ONLY_NO_PLAYBACK_BEHAVIOR_CHANGE
```

El fix está local y aún no se desplegó; no se ejecutará otra prueba en esta
fase.

## Candidatos y diagnóstico provisional

```text
TELEPORT_CANDIDATES_DETECTED=1_UNPROVEN
TELEPORT_CANDIDATE_REVISION_RANGE=60-61
TELEPORT_CANDIDATE_RAW_DISTANCE_CHANGE=2248m
TELEPORT_CANDIDATE_SOURCE_TRANSITION=RAW_TO_RAW
TELEPORT_CANDIDATE_NETWORK_DELAY=NOT_OBSERVABLE
TELEPORT_CANDIDATE_CLASSIFICATION=UNPROVEN
INTERSECTION_ANOMALY_CANDIDATES=0_CONFIRMED / UNPROVEN
PROVIDER_WRONG_BRANCH_CANDIDATES=0_CONFIRMED / UNPROVEN
```

```text
STEPWISE_ROOT_CAUSE=raw trajectory input predominante de 1 punto; etapa exacta upstream aún no observable
PRIMARY_STEPWISE_CAUSE=LOW_SAMPLE_DENSITY_UPSTREAM_OR_BATCH_OUTPUT_UNPROVEN
PRIMARY_TELEPORT_CAUSE=UNPROVEN
INTERSECTION_WRONG_BRANCH_EVIDENCE=UNPROVEN
NETWORK_IS_PRIMARY_CAUSE=UNPROVEN
SAMPLE_DENSITY_IS_PRIMARY_CAUSE=SI_AS_TECHNICAL_CONTRIBUTOR
MATCHED_RAW_TRANSITIONS_CONTRIBUTE=NO
CLIENT_PLAYBACK_CONTRIBUTES=UNPROVEN
```

La evidencia permite afirmar que los saltos ocurrieron con render RAW y que
T24 map matching no los causó en este run. El propietario técnico probable es
T23 (productor RAW, batching o reproducción), pero no se reabre formalmente
hasta contar con callback/send instrumentation.

```text
STEPWISE_BEHAVIOR_IS_T24_MATCHING_BUG=NO
STEPWISE_BEHAVIOR_OWNER=P2_T23_REGRESSION_OR_HARDENING
```

## Estado y límites

```text
DB_LAST_POSITION_SOURCE=RAW
DB_MATCHED_DATA_PERSISTED=NO
DB_MATCHED_TRAJECTORY_COLUMN_OR_ROW_CREATED=NO
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
PHYSICAL_FIXTURE_CLEANUP=DEFERRED_FOR_FUTURE_INSTRUMENTED_PROBE
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
T44_TOUCHED_BY_T24_TEST=NO
PRODUCTION_TOUCHED=NO
```

No se modificaron thresholds, opciones de `watchPosition`, playback,
matching policy, tracking behavior ni el fixture. El siguiente paso requiere
autorización separada para desplegar la instrumentación Testing y realizar un
futuro probe controlado; no se ejecuta aquí.
