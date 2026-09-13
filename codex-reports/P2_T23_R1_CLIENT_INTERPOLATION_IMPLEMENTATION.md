# P2-T23-R1 — Client-side smooth marker playback implementation

Fecha: 2026-09-13
Rama de trabajo: `work/p2-t43-r2`
Rama publicada: `testing-codex`

## Resultado

Se implementó el playback visual client-side sobre el marker Leaflet existente.
La autoridad continúa siendo el último punto autenticado y versionado aceptado
por `tracking-freshness`; el cliente sólo interpola entre dos puntos ya
confirmados. No se agregó batching, buffer deliberado, extrapolación, route
snapping, map matching, camera follow, cambio de renderer, persistencia ni
watcher GPS adicional.

El primer punto hace snap. Una revisión nueva con coordenadas distintas
retargetea desde la posición visual actual y cancela el rAF anterior. Una
revisión nueva con las mismas coordenadas es heartbeat y no anima. El marker
termina exactamente en B. Stale, trackingDisabled, estado terminal, cierre,
unmount y cambio de pedido cancelan el playback; la recuperación desde stale
hace snap al siguiente punto fresco autenticado.

## Política congelada

```text
T23_INTERPOLATION_MIN_DURATION_MS=250
T23_INTERPOLATION_MAX_DURATION_MS=1200
T23_LARGE_GAP_SNAP_THRESHOLD_MS=20000
T23_DURATION_POLICY=QUARTER_OF_ARRIVAL_GAP_CLAMPED_250_1200
T23_DELAY_BUFFER_MS=0
T23_HEADING_ROTATION_IMPLEMENTED=NO
```

El máximo de 1200 ms es deliberadamente menor que el intervalo de publicación
del productor (`MIN_SEND_INTERVAL_MS=5000`) y permite alcanzar rápidamente el
último punto confirmado sin convertir la reproducción en una cola visual.
El umbral de 20 s separa un hueco de llegada excepcional del stale de 120 s y
es suficientemente mayor que los ciclos normales de publicación/polling.

## Archivos

```text
src/lib/tracking-playback.ts                                      NEW
src/lib/tracking-playback.test.ts                                NEW
src/components/tracking/delivery-tracking-map.tsx                MODIFIED
src/lib/tracking-consumer-static-contract.test.ts                MODIFIED
src/components/tracking/delivery-tracking-map-stale-contract.test.ts MODIFIED
```

No se modificaron `use-repartidor-tracking`, `tracking-movement`, las APIs de
ubicación/tracking, realtime server, Prisma, migraciones, service worker ni
routing.

## Verificación local

```text
FOCAL_TESTS=PASS
FOCAL_TEST_COUNT=42
FOCAL_TEST_FAILURES=0
TRACKING_PLAYBACK_UNIT_TESTS=14_PASS_0_FAIL
TRACKING_REGRESSION_TESTS=FAIL_BASELINE_DATABASE_URL_MISSING
FULL_TEST_SUMMARY=3251_PASS_193_FAIL_8_ERRORS
FULL_TEST_FAILURE_CLASSIFICATION=INTEGRATION_ONLY_ENVIRONMENT_VARIABLE_DATABASE_URL_MISSING
ESLINT_FOCAL=PASS
ESLINT=FAIL_BASELINE_ONLY_8_ERRORS_3_WARNINGS_NO_R1_FINDINGS
TYPECHECK=FAIL_BASELINE_ONLY_NO_R1_ERRORS
BUILD=PASS
DIFF_CHECK=PASS
```

La batería focal cubre clamp/monotonicidad, endpoints exactos, heartbeat sin
animación, duración acotada, gap grande, stale cancellation, un único rAF,
retarget y ausencia de `fitBounds` por frame. El typecheck global y lint global
reproducen findings preexistentes fuera del fileset R1. La batería completa se
ejecutó sin `DATABASE_URL` local; sus 193 fallos son integraciones que no
pueden inicializar Prisma y no corresponden a una regresión de este cambio.

## Git y Testing

```text
PRE_R1_ORIGIN_TESTING=e79ec0c8af97ac41622db72e7334a1ff8917d98d
R1_IMPLEMENTATION_COMMIT=2f4c8d1d8392668dfd3f89602b1e06a2297519bc
R1_PUSH_RESULT=SUCCESS_ONLY_TESTING
ORIGIN_TESTING_AFTER=2f4c8d1d8392668dfd3f89602b1e06a2297519bc
ORIGIN_TESTING_CONTAINS_R1=SI
ORIGIN_MAIN=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
TESTING_DEPLOYMENT_ID=6da4b52c-8886-4d52-b31a-ba2e0ba21311
TESTING_DEPLOYMENT_COMMIT=2f4c8d1d8392668dfd3f89602b1e06a2297519bc
TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
TESTING_DEPLOYMENT_COMMIT_MATCH=SI
TESTING_PENDING_MIGRATIONS=0
TESTING_DB_ERRORS=0
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

El despliegue fue el autodeploy originado por el push a `testing-codex`; no se
ejecutó deploy manual. Production/main no fueron tocados.

## Estado y gate físico

```text
P2_T23_ARCHITECTURE=CLIENT_INTERPOLATION_ONLY
T23_BATCHING_REQUIRED=NO
SERVER_TRACKING_CONTRACT_CHANGED=NO
TRACKING_PAYLOAD_CHANGED=NO
REALTIME_CONTRACT_CHANGED=NO
DATABASE_CHANGED=NO
PRISMA_SCHEMA_CHANGED=NO
SECOND_GEOLOCATION_WATCHER_INTRODUCED=NO
T23_RENDERER_CHANGE_REQUIRED=NO
T23_MAP_MATCHING=NO
T23_ROUTE_SNAPPING=NO
T23_CAMERA_FOLLOW=NO
FUTURE_POSITION_EXTRAPOLATION_ALLOWED=NO
INTERPOLATION_ONLY_BETWEEN_CONFIRMED_POINTS=SI
ONE_ACTIVE_PLAYBACK_RAF_PER_MAP=SI
T23_INTERPOLATION_MIN_DURATION_MS=250
T23_INTERPOLATION_MAX_DURATION_MS=1200
T23_LARGE_GAP_SNAP_THRESHOLD_MS=20000
SAME_COORDINATE_HEARTBEAT_ANIMATES=NO
STALE_STOPS_PLAYBACK=SI
POST_STALE_RECOVERY_POLICY=SNAP_TO_FRESH_AUTHENTICATED_POINT
DELIVERY_COMPLETION_CANCELS_PLAYBACK=SI
POST_COMPLETION_VISUAL_MOVEMENT_ALLOWED=NO
PLAYBACK_TRIGGERS_FITBOUNDS_PER_FRAME=NO
FOCAL_TESTS=PASS
TRACKING_REGRESSION_TESTS=FAIL_BASELINE_DATABASE_URL_MISSING
ESLINT=FAIL_BASELINE_ONLY_NO_R1_FINDINGS
TYPECHECK=FAIL_BASELINE_ONLY_NO_R1_ERRORS
BUILD=PASS
P2_T23_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ACTION=OPERATOR_P2_T23_R1_PHYSICAL_CERTIFICATION
```

T23 no queda cerrado con esta implementación: requiere la certificación física
del operador sobre el deployment exacto de Testing. T02 conserva
`CLOSED_TESTING_CERTIFIED` y `RELEASE_ELIGIBLE=SI`; T54 conserva
`FUTURE_AFTER_T02_T23_T24`. No se inicia T24 ni T54.
