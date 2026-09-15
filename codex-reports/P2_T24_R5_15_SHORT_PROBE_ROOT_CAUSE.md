# P2-T24-R5.15 — Short probe root-cause analysis

## Resultado

El operador reportó `SALTOS` y un freeze recuperable mediante la acción de
recargar la ubicación. Esa observación queda aceptada como evidencia humana,
pero la ventana técnica posterior al baseline `89` no tiene witness server-side
observable para el pedido `cmu1p548z0006riv8ntyibf0w`.

```text
P2_T24_R5_14_STATUS=INVALID_TECHNICAL_PROBE_WRONG_OPERATOR_ACCOUNT
PROBE_BASELINE_REVISION=89
PROBE_LAST_REVISION=89
PROBE_TOTAL_SERVER_WRITES=0_OBSERVED_FOR_ORDER_AFTER_BASELINE
R5_14_WRONG_ACCOUNT_USED=SI
R5_14_TECHNICAL_PROBE_VALID=NO
R5_14_OBSERVATION_CORRELATED_TO_TEST_FIXTURE=NO
ROOT_CAUSE_OF_MISSING_R5_14_TECHNICAL_WITNESS=OPERATOR_USED_DIFFERENT_ACCOUNT_THAN_INSTRUMENTED_TEST_FIXTURE
OPERATOR_MOVEMENT=SALTOS
OPERATOR_FREEZE=SI
OPERATOR_FREEZE_COUNT=1
OPERATOR_FREEZE_RECOVERY=el operador tocó Recargar y desde ahí el seguimiento continuó normalmente
OPERATOR_POSSIBLE_NETWORK_TRANSITION=WiFi → datos móviles
NETWORK_TRANSITION_CAUSED_FREEZE=UNPROVEN
STEPWISE_BOTTLENECK_STAGE=UNPROVEN_NO_POST_BASELINE_WITNESS
STEPWISE_ROOT_CAUSE=UNPROVEN_NO_POST_BASELINE_WITNESS
CLIENT_FREEZE_ROOT_CAUSE=UNKNOWN
P2_T23_FORMALLY_REOPENED=NO
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
R5_14B_STATUS=READY_FOR_OPERATOR_CORRECT_ACCOUNT_PROBE
REPARTIDOR_TEST_IDENTITY_VERIFIED=SI
CLIENT_TEST_IDENTITY_VERIFIED=SI
TEST_ORDER_CONTEXT_VERIFIED=SI
PHYSICAL_PROBE_R5_14B_EXECUTED=NO
PRODUCTION_TOUCHED=NO
```

## Evidencia delimitada

La aclaración del operador explica la ausencia: R5.14 se ejecutó con una
cuenta distinta de la cuenta Repartidor del fixture instrumentado. La base
Testing conserva el pedido en `en_camino`, con repartidor asignado,
tracking habilitado y `locationRevision=89`. El deployment actual contiene
POST de ubicación de otros pedidos, pero no un evento identificable de este
pedido. Los logs históricos que sí contienen este pedido llegan hasta la
revisión 89 y pertenecen al recorrido anterior; quedan fuera del probe R5.14.

Por ese motivo no se inventan conteos de callbacks, intervalos, accuracy,
decisiones de filtro, throttle, buffer, batches, correlaciones POST, provider,
realtime, recepción HTTP/realtime ni playback. Todos esos indicadores se
mantienen como `NOT_OBSERVABLE` en el reporte de preparación.

## Acción de recarga

La implementación visible en `delivery-tracking-map.tsx` conecta el botón de
reintento a `fetchTracking`, que solicita nuevamente
`/api/pedidos/{pedidoId}/tracking`. Ese camino no cambia por sí mismo el lease
realtime, no inicia una resuscripción y no remonta el mapa. La recuperación
manual observada es compatible con un refresco HTTP, pero el witness de la
ventana no permite confirmar qué estado del cliente se corrigió.

## Ownership

No hay base para clasificar el freeze como transición de red, desconexión
realtime, falta de fallback HTTP, estado stale del componente, playback stall,
fuente GPS detenida o servidor detenido. La causa queda `UNKNOWN` y la
hipótesis WiFi→datos móviles `UNPROVEN`.

Se conserva la separación de dominios: T24 es map matching; la hipótesis
histórica de saltos en el camino RAW pertenece a T23, sin reabrir formalmente
T23. No se implementa fix ni se solicita una nueva caminata en esta fase.

```text
PHYSICAL_FIXTURE_CLEANUP_STATUS=DEFERRED_EVIDENCE_PRESERVATION
NEXT_ACTION=WAIT_FOR_OPERATOR_R5_14B_SHORT_WALK
```

## R5.14B readiness

El login normal de Testing verificó server-side:

```text
EXPECTED_DRIVER_ID=cmu1p53gj0002riv8n87myyqz
EXPECTED_ORDER_ID=cmu1p548z0006riv8ntyibf0w
EXPECTED_CLIENT_ID=cmu1p53250001riv8mvgnmle1
ORDER_STATE=en_camino
TRACKING_ENABLED=SI
R5_13_DEPLOY_CONTAINS_INSTRUMENTATION=SI
GPS_CALLBACK_WITNESS_READY=SI
POST_CORRELATION_READY=SI
CLIENT_REALTIME_WITNESS_READY=SI
CLIENT_PLAYBACK_WITNESS_READY=SI
```

R5.14B queda preparado para una caminata corta con las dos cuentas Testing
correctas. No se inició tracking, no se generó GPS sintético y no se ejecutó
la caminata.

## R5.14B correct-account probe — final reconciliation

La caminata posterior sí utilizó las identidades Testing correctas y dejó una
ventana correlacionable para el pedido. Desde el baseline `89` se observaron
15 escrituras server-side, hasta la revisión `104`; el pedido terminó en
`en_camino` con repartidor asignado y tracking habilitado.

```text
R5_14B_STATUS=ANALYZED_OPERATOR_REPORT_CAPTURED_TECHNICAL_CORRELATION_COMPLETE
R5_14B_PROBE_FIRST_REVISION=90
R5_14B_PROBE_LAST_REVISION=104
R5_14B_TOTAL_SERVER_WRITES=15
R5_14B_GPS_CALLBACKS=84
R5_14B_WATCH_POSITION_CALLBACKS=81
R5_14B_GET_CURRENT_POSITION_CALLS=3
R5_14B_GPS_INTERVAL_MEDIAN_MS=4411
R5_14B_GPS_INTERVAL_P95_MS=15019
R5_14B_GPS_INTERVAL_MAX_MS=88580
R5_14B_MOVEMENT_ACCEPTED=19
R5_14B_MOVEMENT_REJECTED_BELOW_THRESHOLD=61
R5_14B_THROTTLE_DEFERRALS=9
R5_14B_BUFFER_APPENDS=10
R5_14B_BATCH_FLUSHES=10
R5_14B_BATCH_POINT_COUNT_MEDIAN=1
R5_14B_BATCH_POINT_COUNT_P95=1
R5_14B_BATCH_POINT_COUNT_MAX=1
R5_14B_RAW_BATCH_DENSITY=SPARSE
R5_14B_TRACKING_POSTS=15
R5_14B_REALTIME_PUBLISHED=15
R5_14B_CLIENT_REALTIME_RECEIVED=10
R5_14B_CLIENT_RAW_PLAYBACK_EVENTS=19
R5_14B_CLIENT_MATCHED_PLAYBACK_EVENTS=0
R5_14B_STEPWISE_BOTTLENECK_STAGE=BUFFER_BATCH
R5_14B_STEPWISE_ROOT_CAUSE=MULTIPLE_BUFFER_BATCH_PRIMARY_WITH_GPS_SOURCE_AND_MOVEMENT_FILTER_CONTRIBUTION
R5_14B_FREEZE_CANDIDATE_REVISION_RANGE=103_TO_104
R5_14B_SERVER_CONTINUED_DURING_FREEZE=SI
R5_14B_CLIENT_REALTIME_STOPPED_AFTER_103=SI
R5_14B_NETWORK_TRANSITION_OBSERVED=NOT_OBSERVABLE
R5_14B_WIFI_TO_CELLULAR_CAUSAL=UNPROVEN
R5_14B_CLIENT_FREEZE_ROOT_CAUSE=REALTIME_DISCONNECT_NO_AUTOMATIC_RECOVERY_CAUSE_UNPROVEN
R5_14B_MANUAL_RELOAD_REQUIRED=SI
R5_14B_PROVIDER_ATTEMPTS=0
P2_T23_FORMALLY_REOPENED=NO
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
PHYSICAL_FIXTURE_CLEANUP_STATUS=DEFERRED_EVIDENCE_PRESERVATION
PRODUCTION_TOUCHED=NO
NEXT_ACTION=P2_T23_HARDENING_CANDIDATE_AUDIT_BEFORE_T24_R6
```

El operador reportó `SALTOS` y un freeze recuperable mediante Recargar. El
witness mostró que el servidor continuó recibiendo y publicando, mientras el
Cliente dejó de observar realtime después de la revisión `103`; no existe un
evento explícito que demuestre la transición WiFi→datos móviles. La causa
exacta de la desconexión queda sin probar. No se implementa fix ni se cambian
thresholds, throttle, batching, realtime, fallback o policy de provider.
