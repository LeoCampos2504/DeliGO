# P2-T24-R3 — Server producer integration with fail-open RAW fallback

## Alcance

Se integró el primer productor server-side real del map matching en la ruta
`POST /api/repartidor/ubicacion`, sin cambiar el Cliente, el playback, el
bridge realtime, Prisma, el esquema, migraciones ni Production.

La autoridad sigue siendo el commit RAW de `pedidos`: la escritura de
coordenadas y el incremento atómico de `locationRevision` ocurren antes del
matching. El adapter OSRM y `evaluateMapMatching` sólo se intentan como
best-effort en Testing. El único evento realtime se construye después de esa
decisión, conservando RAW siempre; `matchedTrajectory` es opcional.

## Contrato de accuracy

`accuracy` es opcional en cada punto de la trayectoria live y se valida como
número finito entre 0 y 100 metros. Se transporta sólo desde el productor hasta
el provider/policy. No se persiste en DB y se elimina tanto de la trayectoria
RAW realtime como del payload `matchedTrajectory` antes del publish.

Los batches legacy sin `accuracy` siguen siendo válidos. En ese caso OSRM no
recibe `radiuses` y la policy usa su límite conservador sin accuracy.

## Guardas del productor

```text
P2_T24_R3_STATUS=IMPLEMENTED_TESTING_SERVER_PRODUCER
R3G4_BASELINE_COMMIT_SHA=124b4959b0935b79ef2d0d619dac5e3a9fdb41e7
R3_COMMIT_SHA=6d3fa9a2f4fe70e4e79ddc9db72ef34ba6f2310a
REMOTE_TESTING_SHA=6d3fa9a2f4fe70e4e79ddc9db72ef34ba6f2310a
LIVE_TRACKING_ACCURACY_CONTRACT_CHANGED=SI
RAW_ACCURACY_PERSISTED=NO
RAW_ACCURACY_REALTIME_REQUIRED=NO
R3_TRACKING_ROUTE_INTEGRATION=SI
R3_MATCHING_PROVIDER_RUNTIME_CALL=SI
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
DB_RAW_POSITION_ONLY=SI
MIN_RAW_POINTS_FOR_MATCH=3
R3_MATCHING_TIMEOUT_INITIAL_TESTING_MS=1000
MATCHING_EXCEPTION_CAN_SUPPRESS_RAW_REALTIME=NO
LOCATION_REVISION_INCREMENT_PER_BATCH=1
REALTIME_EVENT_COUNT_PER_BATCH=1
MATCHED_TRAJECTORY_OPTIONAL=SI
MATCHED_TRAJECTORY_VERSION_POLICY=SAME_LOCATION_REVISION_AS_RAW
MATCHED_TRAJECTORY_MAX_POINTS=48
MAX_MATCHED_REALTIME_PAYLOAD_BYTES=16384
```

El provider sólo se crea bajo `DELIGO_ENVIRONMENT=TESTING` y
`NODE_ENV!=production`. La configuración efectiva del deployment Testing es
`MAP_MATCHING_PROVIDER=osrm` y
`T24_OSRM_BASE_URL=https://router.project-osrm.org`. No se enviaron PII ni
identificadores de pedido al provider; sólo lat/lng/offsetMs/accuracy.

## Pruebas automatizadas

La ruta integra el adapter y la policy reales; las pruebas de ruta sustituyen
únicamente el provider externo, DB, auth y publish para aislar la conducta del
productor. Se verificó:

```text
ACCEPT_CASE_TEST=PASS
FALLBACK_CASE_TEST=PASS
MATCHED_TRAJECTORY_EMITTED_ON_ACCEPT=SI
RAW_REALTIME_EMITTED_ON_REJECT=SI
DB_MATCHED_DATA_PERSISTED=NO
R3_MATCHED_EMITTED_BUT_CLIENT_IGNORES=SI
PROVIDER_PII_SENT=NO
```

Los casos R3 cubren aceptación, rechazo de policy y excepción del provider
después del commit RAW. Todos mantienen HTTP 200, una escritura RAW, una
`locationRevision` y un publish. En aceptación el evento conserva el mismo
`eventId`, `version` y `locationRevision` RAW, agregando únicamente el campo
opcional matched sanitizado. En rechazo o excepción se publica sólo RAW.

Suites ejecutadas:

```text
bun test src/app/api/repartidor/ubicacion/route.test.ts src/lib/tracking-trajectory.test.ts src/lib/realtime-publish.test.ts src/lib/map-matching-policy.test.ts src/lib/osrm-map-matching-provider.test.ts
84 pass / 0 fail

bun test scripts/testing/t23-trajectory-replay.test.ts src/lib/tracking-trajectory.test.ts src/lib/tracking-playback.test.ts src/app/api/pedidos/[id]/tracking/route.test.ts src/lib/realtime-publish.test.ts src/lib/realtime-manager.test.ts
88 pass / 0 fail
T23_REGRESSION=PASS
```

El `tsc` global conserva errores preexistentes fuera de R3; no hubo error
nuevo en los archivos modificados por esta tarea. `git diff --check` pasó.

## Testing deployment

```text
DELIGO_TESTING_DEPLOYMENT_ID=7f3b4fb3-af3b-4238-b7af-f0fbf5f71ee6
DELIGO_TESTING_DEPLOYMENT_STATUS=SUCCESS
DELIGO_TESTING_DEPLOYMENT_COMMIT=6d3fa9a2f4fe70e4e79ddc9db72ef34ba6f2310a
TESTING_SERVICE=DeliGO Copy
TESTING_SERVICE_REPLICAS=1_RUNNING
TESTING_HEALTH_ROOT_HTTP=200
TEST_FIXTURE_CREATED=NO
TEST_FIXTURE_CLEANED=NO
R3_SERVER_RUNTIME_ROUTE_PROBE=NOT_RUN
```

No había un harness o fixture TEST_T24 seguro disponible en el repositorio.
No se creó un pedido ni se ejecutó una mutación de datos sólo para producir
evidencia live. La certificación de la ruta queda respaldada por las pruebas
de integración automatizadas y la salud del deployment Testing; la llamada
OSRM desde un pedido real de prueba queda expresamente pendiente de un fixture
controlado autorizado.

## Production y cierre

```text
PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
P2_T24_READY_FOR_R4=SI
NEXT_ACTION=STOP_AFTER_R3_PENDING_R4_AUTHORIZATION
```

No se inició R4, T54 ni ninguna promoción a Production.
