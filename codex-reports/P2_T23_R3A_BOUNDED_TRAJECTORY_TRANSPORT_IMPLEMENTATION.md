# P2-T23-R3A — BOUNDED TRAJECTORY PRODUCER + SERVER/REALTIME CONTRACT

Fecha: 2026-09-13
Alcance: implementación funcional, tests focales y deploy de Testing. No incluye playback cliente R3B, harness físico, T24, T54 ni Production.

## Autoridad

```text
A0_ARCHITECTURE_SUPERSEDED_BY_PRODUCT_CLARIFICATION=SI
T23_BATCHING_REQUIRED=SI
T23_RECOMMENDED_ARCHITECTURE=BOUNDED_LOCAL_TRAJECTORY_BATCHING_PLUS_CLIENT_PLAYBACK
T23_NEW_IMPLEMENTATION_SPLIT_REQUIRED=SI
P2_T23_R3A=BOUNDED_PRODUCER_BUFFER_PLUS_POST_SERVER_VALIDATION_AND_DB_REALTIME_CONTRACT
P2_T23_R3B=CLIENT_CONFIRMED_TRAJECTORY_PLAYBACK_PLUS_BOUNDED_QUEUE_AND_TESTING_HARNESS
P2_T23_STATUS=IN_PROGRESS_R3A_COMPLETE_AWAITING_R3B
```

## Producer local y contrato

```text
LOCAL_TRAJECTORY_BUFFER_IMPLEMENTED=SI
TRAJECTORY_POINT_ACCEPTANCE_POLICY_FINAL=accept when distance >= max(5m, 0.5*(previousAccuracy+newAccuracy)); reject invalid/out-of-range/non-finite, duplicate/jitter and impossible-speed samples
MIN_DISTANCE_BETWEEN_BUFFERED_POINTS_FINAL=5
BATCH_ACCUMULATED_DISTANCE_FLUSH_THRESHOLD_M=30
MAX_MOVING_BATCH_AGE_MS=3000
MAX_LOCAL_TRAJECTORY_POINTS=12
MAX_BATCH_POINTS=12
MAX_BATCH_DURATION_MS=5000
MAX_BATCH_DISTANCE_M=150
MAX_BATCH_PAYLOAD_BYTES=8192
TRAJECTORY_POINT_TIMING_FORMAT=RELATIVE_OFFSET_MS
HEARTBEAT_IS_TRAJECTORY_POINT=NO
PERIODIC_SAME_POSITION_TRAJECTORY_POST=NO
SECOND_GEOLOCATION_WATCHER_INTRODUCED=NO
MAX_IN_FLIGHT_TRAJECTORY_POSTS_PER_DELIVERY=1
```

El buffer es por delivery, efímero y bounded; se limpia al perder elegibilidad,
completar/cancelar el delivery y desmontar el hook. La aceptación de muestras es
independiente del umbral histórico de movimiento significativo usado para la red.
El lote transporta puntos reales con `offsetMs`, conserva el punto actual legacy
en el nivel superior y no introduce `batchId` ni una cola offline ilimitada.

```text
TRACKING_PAYLOAD_CHANGED=SI
LEGACY_TRACKING_PAYLOAD_COMPATIBLE=SI
REALTIME_CONTRACT_CHANGE_REQUIRED=SI
BACKWARD_COMPATIBLE_REALTIME_EXTENSION=SI
REALTIME_BRIDGE_TRAJECTORY_COMPATIBILITY=PASS
DB_TRAJECTORY_PERSISTED=NO
LOCATION_REVISION_INCREMENT_PER_BATCH=1
T23_SCHEMA_CHANGE_REQUIRED=NO
T23_MIGRATION_REQUIRED=NO
CLIENT_TRAJECTORY_PLAYBACK_IMPLEMENTED=NO
R3A_CLIENT_VISIBLE_BEHAVIOR=LEGACY_CURRENT_POINT_COMPATIBILITY
TRACKING_SECURITY_GATES_PRESERVED=SI
```

El endpoint valida forma, rangos, offsets monotónicos, coincidencia del último
punto con `lat/lng`, distancia acumulada y tamaño UTF-8 antes del write. La
persistencia sigue siendo el último punto; el realtime se publica después del
commit con la misma `locationRevision`. El bridge interno permite y conserva la
extensión `trajectory` y mantiene rechazo de campos desconocidos.

```text
FAILED_BATCH_POLICY=network/5xx conserva como máximo un snapshot bounded no confirmado, bloquea reintento por timer y retoma sólo ante una nueva muestra física aceptada; 4xx mantiene fail-closed y limpia elegibilidad local
AMBIGUOUS_COMMIT_EXACTLY_ONCE=NO
BATCH_ID_INCLUDED=NO
BATCH_ID_PROVIDES_IDEMPOTENCY=NO
```

## Verificación

```text
FOCAL_TESTS=tracking-trajectory 5 tests / 32 expects; ubicacion route 25 / 433; realtime/static 25 / 118; chat bridge PASS
TRACKING_REGRESSION_TESTS=use-repartidor-tracking 90 / 90
ESLINT=PASS
TYPECHECK=R3A_FILES_NO_NEW_ERRORS_REPO_BASELINE_HAS_PREEXISTING_ERRORS
BUILD=PASS
GIT_DIFF_CHECK=PASS
```

La suite del hook y los focals se ejecutaron por separado para evitar la
interferencia global de fake timers observada al combinar suites no relacionadas.
El typecheck repo-wide conserva errores preexistentes fuera de R3A; no apareció
ningún error de trayectoria en los archivos del alcance.

## Git y Testing

```text
R3A_COMMIT=2811a94495cb093f6e8c721b58de44c983775c3d
R3A_COMMIT_SUBJECT=feat: add bounded tracking trajectory transport
R3A_PUSH_RESULT=SUCCESS origin/testing-codex
TESTING_DEPLOYMENT_ID_DELIGO=d32ecea3-350b-4c4a-8f73-724223998667
TESTING_DEPLOYMENT_ID_CHAT=c19602d4-843d-48fa-b854-a15a0a904529
TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
TESTING_MIGRATIONS=NO_PENDING_MIGRATIONS
TESTING_BRANCH=testing-codex
```

La imagen funcional desplegada corresponde exactamente al commit R3A en ambos
servicios. No se ejecutó deploy manual de Railway.

```text
PRODUCTION_TOUCHED=NO
ORIGIN_MAIN=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PUBLIC_RELEASE_AUTHORIZED=NO
```

## Estado final y stop

```text
P2_T23_R3A_STATUS=CLOSED_TESTING_IMPLEMENTED_CONTRACT_READY_FOR_R3B
P2_T23_STATUS=IN_PROGRESS_R3A_COMPLETE_AWAITING_R3B
P2_T02_STATUS=CLOSED_TESTING_CERTIFIED
P2_T02_RELEASE_ELIGIBLE=SI
P2_T54_STATUS=FUTURE_AFTER_T02_T23_T24
NEXT_ACTION=IMPLEMENT_P2_T23_R3B_CLIENT_PLAYBACK_AND_TESTING_REPLAY_HARNESS
NEXT_TASK_CHAIN_START=P2_T23_R3B
```

STOP: no se inicia R3B, T24, T54 ni Production en este cierre.
