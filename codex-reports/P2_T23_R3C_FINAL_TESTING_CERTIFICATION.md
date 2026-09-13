# P2-T23-R3C — Final Testing Certification

Fecha: 2026-09-13
Proyecto: DeliGO
Entorno certificado: Testing únicamente

## Autoridad y baseline

```text
R3A_IMPLEMENTATION_COMMIT=2811a94
R3B_IMPLEMENTATION_COMMIT=0f8875f1d285b15f09c788b2dbfba4cdfb21934c
R3B_LONG_ROUTE_HARNESS_COMMIT=5a95f3a8b22af375a83d0dea9a27a31fe93ec8cd
R3B_STATIONARY_FIX_COMMIT=1e431bee16057eb9e6d3d34ec4c4032dd2a5c5af
R3B_RECOVERY_HARNESS_COMMIT=1066bea2d216939022a1989545f636cf88b21fdb
R3B_COMPLETION_HARNESS_FIX_COMMIT=60f9347aad756bd2887a22ad39edf9541f73ecf9
PRE_R3C_TESTING_REMOTE_SHA=60f9347aad756bd2887a22ad39edf9541f73ecf9
R3C_REPORT_BASE_SHA=60f9347aad756bd2887a22ad39edf9541f73ecf9
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
```

El fixture `TEST_T23` se utilizó exclusivamente durante la certificación y fue
eliminado después de registrar toda la evidencia. No se modificó el esquema,
Prisma ni ninguna tabla de producción.

## Arquitectura final certificada

T23 implementa batching local acotado de puntos capturados, validación server-
side, persistencia únicamente del current/final point, una `locationRevision`
monotónica por batch aceptado, publicación realtime de la extensión trajectory,
playback confirmado en Cliente con una cola acotada, cancelación por stale,
recovery y completion.

```text
Repartidor GPS
  -> bounded trajectory producer
  -> POST /api/repartidor/ubicacion
  -> current point + locationRevision en DB
  -> realtime trajectory
  -> Cliente real
  -> confirmed playback
  -> marker Leaflet
```

`T23_SCHEMA_CHANGE_REQUIRED=NO`
`T23_MIGRATION_REQUIRED=NO`
`SOLE_GPS_WATCHER_PRESERVED=SI`

## Evidencia física reconciliada

### Primer smooth-route

```text
TOTAL_BATCHES=3
TOTAL_TRAJECTORY_POINTS=12
SMOOTH_ROUTE_VISUAL_PLAYBACK=PASS
SMOOTH_ROUTE_MOVEMENT_FLUID=SI
SMOOTH_ROUTE_DISTANCE_SUFFICIENT_FOR_DETAILED_EVALUATION=NO
SMOOTH_ROUTE_REACHED_DESTINATION=NO
```

La prueba fue válida para fluidez básica y quedó superseded para la forma y
llegada por `route-to-destination`; no se clasifica como fallo.

### Long route to destination

```text
HARNESS_ROUTE_SOURCE=OSRM_ROUTE_GEOMETRY
ROUTE_DISTANCE_M=1280
TOTAL_ROUTE_POINTS=36
TOTAL_BATCHES=9
NUMBER_OF_CLEAR_TURNS=5
FINAL_SERVER_DISTANCE_TO_DESTINATION_M=0
HTTP_FAILURES=0
VERSION_ORDER_ERRORS=0
T23_LONG_ROUTE_PLAYBACK=PASS
T23_SMOOTH_PLAYBACK=PASS
T23_CAPTURED_SHAPE=PASS
T23_MULTIPLE_TURNS_PLAYBACK=PASS
T23_DESTINATION_VISUAL_ARRIVAL=PASS
MINOR_PLAYBACK_PAUSES_OBSERVED=SI
PAUSES_SEVERITY=MINOR
PAUSES_BLOCK_T23=NO
ROOT_CAUSE_NOT_PROVEN=SI
```

La geometría OSRM sólo generó un dataset congelado de Testing. No se conectó
OSRM al tracking runtime y el producto no hizo map matching ni route snapping.

### Stationary

El primer intento reveló una anomalía del harness: `routeFor("stationary")[0]`
usaba el primer punto hardcodeado del recorrido, coincidente con el negocio.
No fue un defecto del producto. El fix `1e431bee` pasó a leer el punto actual
desde `GET /api/pedidos/:id/tracking` y reutilizarlo sin trajectory.

```text
STATIONARY_ANOMALY_OWNER=TESTING_HARNESS
PRODUCT_TRACKING_DEFECT_CONFIRMED=NO
POINT_BEFORE_STATIONARY=(-34.6037,-58.3816)
HEARTBEAT_SENT_POINT=(-34.6037,-58.3816)
POINT_AFTER_STATIONARY=(-34.6037,-58.3816)
HEARTBEAT_COORDINATES_UNCHANGED=SI
HEARTBEAT_CONTAINS_TRAJECTORY=NO
TRAJECTORY_BATCHES_SENT_DURING_STATIONARY=0
TRAJECTORY_POINTS_SENT_DURING_STATIONARY=0
T23_STATIONARY_RECERTIFICATION=PASS
T23_STATIONARY_VISUAL=PASS
STATIONARY_MARKER_MOVEMENT=NO
```

### Stale

El stale ocurrió naturalmente durante la inactividad real posterior al
heartbeat; no se ejecutó una rutina artificial `stale` ni se alteró reloj,
threshold, timestamp, DB o UI.

```text
CLIENT_STALE_UI_PHYSICAL=PASS
T23_STALE_VISUAL=PASS
CLIENT_STALE_STATE=PAUSADO
T23_STALE_CERTIFICATION=PASS
CLIENT_STALE_THRESHOLD_MS=120000
STALE_SCENARIO_EXECUTED=NO
```

### Recovery post-stale

El harness `recovery-once` leyó el current point por GET y envió exactamente un
batch trajectory fresco.

```text
RECOVERY_POST_COUNT=1
RECOVERY_POST_HTTP_STATUS=200
RECOVERY_TRAJECTORY_POINT_COUNT=4
RECOVERY_TOTAL_DISTANCE_M=57
LOCATION_REVISION_BEFORE_RECOVERY=15
RECOVERY_LOCATION_REVISION=16
HARNESS_OLD_TRAJECTORY_SENT=NO
HTTP_FAILURES=0
VERSION_ORDER_ERRORS=0
CLIENT_PAUSED_TO_LIVE=PASS
CLIENT_POSITION_REFRESHED=PASS
OLD_PENDING_TRAJECTORY_REPLAYED=NO
T23_POST_STALE_RECOVERY=PASS
RECOVERY_SNAPPED_BEHAVIOR=PASS
```

El snap `recovery_snapped` es la política esperada después de stale y no se
interpreta como fallo de interpolación.

### Completion

El primer CERT-8 falló en el proxy por falta de `Origin`; no fue un fallo del
flujo de producto. El fix `60f9347` conservó el orden real y agregó los
headers de origen a ambos PUT.

```text
ORDER_STATE_BEFORE=en_camino
LOCATION_REVISION_BEFORE=19
PRE_COMPLETE_TRAJECTORY_BATCHES=3
PRE_COMPLETE_TRAJECTORY_POINTS=12
BATCH_REVISIONS=20,21,22
CLIENT_CONFIRM_HTTP_STATUS=200
CLIENT_CONFIRM_RESULT=PASS
ORDER_STATE_AFTER_CLIENT_CONFIRM=en_camino
DRIVER_DELIVER_HTTP_STATUS=200
DRIVER_DELIVER_RESULT=PASS
ORDER_STATE_AFTER_DRIVER_DELIVER=entregado
COMPLETE_EXECUTED=SI
LAST_LOCATION_REVISION=22
POST_COMPLETION_OBSERVATION_SECONDS=9
POST_COMPLETION_TRACKING_POSTS_SENT=0
POST_COMPLETION_TRAJECTORY_BATCHES_SENT=0
FIXTURE_NOW_COMPLETED=SI
HTTP_FAILURES=0
VERSION_ORDER_ERRORS=0
```

El operador confirmó que el pedido salió del flujo activo, desapareció el
ícono del repartidor, no continuó el movimiento y no apareció backlog.

```text
OPERATOR_COMPLETION_VISUAL_RESULT=PASS
T23_COMPLETION_PLAYBACK_CANCELLATION=PASS
T23_POST_COMPLETION_VISUAL_MOVEMENT=NO
T23_POST_COMPLETION_DRIVER_MARKER_VISIBLE=NO
T23_POST_COMPLETION_TRACKING_VISIBLE=NO
T23_PENDING_PLAYBACK_AFTER_COMPLETION=NO
```

## Realtime y cancelación

El GET fallback de tracking devuelve únicamente `repartidorLat`,
`repartidorLng`, timestamp y `version`; no devuelve `trajectory`. La
reproducción física de múltiples puntos y cinco giros no podía provenir sólo
de ese fallback. La evidencia converge con el evento realtime publicado por
el POST autenticado, cuya extensión contiene la trajectory confirmada.

```text
T23_REALTIME_TRAJECTORY_DELIVERY=PASS_BY_PHYSICAL_MULTIPOINT_PLAYBACK_EVIDENCE
```

La política de playback final es:

- stale cancela rAF, playback active y pending, y prepara recovery snap;
- un evento fresco después de stale usa `recovery_snapped` al último punto del
  batch fresco, sin backlog anterior ni extrapolación;
- cuando `estado !== "en_camino"` o tracking queda deshabilitado,
  `cancelForCompletion()` cancela rAF, elimina active/pending, marca completion
  y descarta eventos posteriores.

## Cambios harness-only

Los únicos cambios de código de esta línea fueron en:

```text
scripts/testing/t23-trajectory-replay.ts
scripts/testing/t23-trajectory-replay.test.ts
```

Incluyen la geometría determinista `route-to-destination`, la lectura del
current point para `stationary`, el escenario único `recovery-once`, headers de
origen requeridos por Testing y la secuencia real de completion. No se tocaron
componentes, hooks, APIs, realtime, playback, Prisma, schema o migraciones.

## Tests y seguridad

Suite focal final T23:

```text
TEST_FILES=9
TESTS=117
EXPECTATIONS=447
PASS=117
FAIL=0
ESLint_TOUCHED_FILES=PASS
GIT_DIFF_CHECK=PASS
```

Se verificó y preservó:

- autenticación server-side por actor;
- ownership del pedido para Cliente;
- asociación y asignación del Repartidor;
- kill switch de tracking del negocio;
- rate limit y límites de payload trajectory;
- orden y coherencia de `locationRevision`;
- guardas `TESTING`, `--confirm-testing` y rechazo de hosts Production;
- ausencia de endpoint debug público, tokens o cookies en este reporte.

## Cleanup

```text
CLEANUP_SCOPE=TEST_T23_ONLY
TEST_T23_ORDERS_REMOVED=1
TEST_T23_CLIENTS_REMOVED=1
TEST_T23_DRIVERS_REMOVED=1
TEST_T23_BUSINESSES_REMOVED=1
CLEANUP_EXECUTED=SI
```

El cleanup pasó las comprobaciones de ownership por prefijo `TEST_T23_` y no
forzó borrado de entidades fuera del fixture.

## Alcance y release assessment

```text
PRODUCT_MAP_MATCHING_USED=NO
PRODUCT_ROUTE_SNAPPING_USED=NO
TRACKING_COORDINATES_SNAPPED_TO_ROUTE=NO
T24_ABSORBED=NO
CAMERA_FOLLOW_TURN_BY_TURN=NO
T54_ABSORBED=NO
T23_SCHEMA_CHANGE_REQUIRED=NO
T23_MIGRATION_REQUIRED=NO
PRODUCTION_PROMOTION_AUTHORIZED=NO
PRODUCTION_TOUCHED=NO
```

T23 queda certificado en Testing. La certificación no convierte el dataset
OSRM en una garantía de que un GPS real permanezca sobre una calle; eso sigue
siendo P2-T24.

## Final markers

```text
P2_T23_OPERATOR_CERTIFICATION=PASS
P2_T23_CONTROLLED_REPLAY_CERTIFICATION=PASS
P2_T23_STATIONARY_CERTIFICATION=PASS
P2_T23_STALE_CERTIFICATION=PASS
P2_T23_RECOVERY_CERTIFICATION=PASS
P2_T23_COMPLETION_CERTIFICATION=PASS
P2_T23_STATUS=CLOSED_TESTING_CERTIFIED
P2_T23_RELEASE_ELIGIBLE=SI
NEXT_TASK=P2_T24
NEXT_TASK_STATUS=FUTURE_AFTER_T23
```

No iniciar T24, T54, release promotion ni Production en este cierre.
