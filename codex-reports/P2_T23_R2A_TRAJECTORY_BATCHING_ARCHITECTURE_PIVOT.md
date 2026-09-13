# P2-T23-R2A — architecture pivot to bounded trajectory batching + client playback

Fecha: 2026-09-13. Tipo: audit / architecture redesign / documentation-only.

Esta tarea supersede la solución R2 no committeada. No se implementó el nuevo
payload, no se modificó producto, tests, Prisma, DB, realtime, Railway ni
Production.

## Estado del R2 abortado y preflight

```text
P2_T23_R2_PREVIOUS_FIX_STATUS=SUPERSEDED_BEFORE_COMMIT
R2_PREVIOUS_CODE_COMMITTED=NO
R2_PREVIOUS_CODE_PUSHED=NO
R2_PREVIOUS_CODE_DEPLOYED=NO
R2_ABORTED_LOCAL_FILES=src/components/tracking/delivery-tracking-map-stale-contract.test.ts;src/components/tracking/delivery-tracking-map.tsx;src/lib/tracking-consumer-static-contract.test.ts;src/lib/tracking-playback.test.ts;src/lib/tracking-playback.ts
R2_ABORTED_LOCAL_DIFF_AFTER_RESTORE=NONE
HEAD=7ce19d3d4a60db1b1bd2f86ab967001539e3ec20
CURRENT_BRANCH=work/p2-t43-r2
origin/testing-codex=7ce19d3d4a60db1b1bd2f86ab967001539e3ec20
origin/main=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
MAIN_EQUALS_PRODUCTION=SI
R2_PREVIOUS_FOCAL_TESTS=47_PASS_0_FAIL
R2_PREVIOUS_BUILD=PASS
R2_PREVIOUS_STATUS=SUPERSEDED_BEFORE_COMMIT
```

El diff rastreado local previo era exactamente el R2 abortado en los cinco
archivos indicados. Se restauraron únicamente esos cinco paths explícitos; los
archivos no versionados históricos del checkout se preservaron sin tocarlos.
Después de la limpieza no quedó diff rastreado local. No se creó commit ni se
hizo push/deploy de R2.

La evidencia R1 continúa siendo:

```text
R1_IMPLEMENTATION_COMMIT=2f4c8d1d8392668dfd3f89602b1e06a2297519bc
T23_R1_PHYSICAL_SMOOTHNESS=FAIL
T23_R1_CLIENT_MARKER_BEHAVIOR=STEPWISE_JUMPS
P2_T23_STATUS=PHYSICAL_FAIL_REQUIRES_DIAGNOSIS
```

## Aclaración de producto que cambia la decisión A0

A0 diseñó `CLIENT_INTERPOLATION_ONLY`, que suaviza A→E pero no conserva los
puntos B, C y D capturados por el GPS. El requisito ahora explícito es
preservar muestras físicas útiles y reproducir una trayectoria corta real:

```text
A → B → C → D → E
```

Por lo tanto, la aclaración de producto supera la recomendación de A0 para la
implementación futura, aunque A0 y R1 quedan preservados como trazabilidad.

```text
A0_ARCHITECTURE_SUPERSEDED_BY_PRODUCT_CLARIFICATION=SI
T23_BATCHING_REQUIRED=SI
T23_RECOMMENDED_ARCHITECTURE=BOUNDED_LOCAL_TRAJECTORY_BATCHING_PLUS_CLIENT_PLAYBACK
```

## Auditoría del pipeline vigente

El único watcher GPS productivo sigue siendo `useRepartidorTracking`:

```text
navigator.geolocation.watchPosition (1 call site)
  → handleWatchSuccess
  → buildSampleFromPosition(lat,lng,accuracy,capturedAt)
  → observeSample
  → isSignificantMovement(lastSentSample, sample)
  → MIN_SEND_INTERVAL_MS = 5000
  → pendingMeaningfulSample = latest only
  → POST /api/repartidor/ubicacion {pedidoId,lat,lng}
  → Pedido.repartidorLat/repartidorLng/repartidorLastUpdate
  → Pedido.locationRevision + 1
  → tracking.location.updated
  → shared RealtimeManager / repartidor-location
  → DeliveryTrackingMap freshness authority
  → Leaflet marker setLatLng
```

Existe además un único `getCurrentPosition` one-shot compartido para entrega
inicial, recovery y heartbeat; no es un watcher adicional ni un loop recurrente.
El mapa no usa geolocation. El servicio de navegación consume el estado
compartido y no registra otro watcher.

El producer actual tiene `accuracy`, `capturedAt` y callbacks ricos, pero no los
envía. Por entrega mantiene sólo `lastSentSample` y una única
`pendingMeaningfulSample`; por eso los callbacks B, C y D pueden ser
reemplazados por E antes de que se produzca el POST.

La validación actual de la ruta comprueba tipo y rangos, pero la implementación
futura debe usar `Number.isFinite` explícitamente: comparaciones de rango por sí
solas no rechazan `NaN`. Esta es una observación de diseño para el nuevo
contrato, no un cambio aplicado en R2A.

```text
ONE_DEVICE_GEOLOCATION_WATCHER_AUTHORITY=SI
GPS_WATCH_AUTHORITY=useRepartidorTracking
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
SECOND_GEOLOCATION_WATCHER_REQUIRED=NO
CURRENT_GPS_SAMPLE_FIELDS=lat,lng,accuracy,capturedAt
CURRENT_GPS_WATCH_OPTIONS=enableHighAccuracy:false;maximumAge:3000;timeout:4000
CURRENT_MOVEMENT_THRESHOLD=MAX(15m,accuracy_new+accuracy_previous)
CURRENT_NETWORK_MIN_INTERVAL_MS=5000
CURRENT_STATIONARY_HEARTBEAT_MS=60000
CURRENT_RATE_LIMIT=30_REQUESTS_PER_REPARTIDOR_PEDIDO_PER_MINUTE
```

No hay en el checkout telemetría de producción que permita fijar un número
final de metros: los tests controlan callbacks, pero no son una distribución
de cadence/accuracy real. Los valores de abajo son propuestas iniciales
tuneables, sujetas a replay y certificación; no deben presentarse como
calibración física definitiva.

## Arquitectura propuesta

### Buffer local por delivery

El callback ya existente alimentará un buffer bounded en memoria por pedido,
activo sólo mientras el pedido sea core-elegible y esté `en_camino`.

```text
LOCAL_TRAJECTORY_BUFFER_REQUIRED=SI
BUFFER_SCOPE=MEMORY_ONLY_PER_ACTIVE_DELIVERY
MAX_LOCAL_TRAJECTORY_POINTS=12
MAX_LOCAL_TRAJECTORY_AGE_MS=5000
```

El buffer se elimina al completar, cancelar, perder elegibilidad, desmontar el
hook o abandonar el pedido. No se comparte entre pedidos, no se persiste, no
se restaura desde localStorage y no crece por callbacks estacionarios.

### Separación de filtros y flush

La aceptación de un punto y el envío de un batch son decisiones separadas:

```text
MIN_DISTANCE_BETWEEN_BUFFERED_POINTS=5m_floor_with_accuracy_aware_effective_threshold
BATCH_ACCUMULATED_DISTANCE_FLUSH_THRESHOLD=30m_provisional
TRAJECTORY_FLUSH_MODEL=DISTANCE_OR_MAX_AGE_WHILE_MOVING
PERIODIC_SAME_POSITION_TRAJECTORY_POST=NO
MAX_MOVING_BATCH_AGE_MS=3000
```

Política propuesta de aceptación:

1. Rechazar coordenadas no finitas, fuera de rango o con `accuracy` inválida
   que supere un límite defensivo provisional de 100 m.
2. Rechazar una muestra con `capturedAt` no monotónico respecto del último
   sample aceptado, con edad imposible o con skew futuro; el reloj del
   dispositivo nunca decide autoridad.
3. Rechazar duplicados exactos y puntos cuyo desplazamiento no supere
   `max(5m, 0.75 * (accuracyAnterior + accuracyNueva))`. El piso evita que un
   GPS quieto genere una ruta; el componente accuracy-aware evita exigir 15 m
   para cada punto de una curva.
4. Aceptar movimiento que supere ese umbral y preservar el orden de captura.
   No usar map matching, nearest-road ni una restricción geométrica de calle.
5. Aplicar además límites de batch; ningún callback puede agregar puntos sin
   límite aunque el móvil permanezca activo horas.

El `BATCH_ACCUMULATED_DISTANCE_FLUSH_THRESHOLD` de 30 m es una propuesta
inicial, no una elección intuitiva final: es aproximadamente dos veces el piso
actual de 15 m, conserva varios puntos de una curva y, junto con 3 s de edad
máxima, evita demorar indefinidamente a un vehículo lento. La edad máxima
garantiza visibilidad para caminata lenta aunque no se alcancen 30 m. Antes de
promover se debe observar el replay con accuracy y cadence reales.

El timer de 3 s sólo puede despertar cuando existe movimiento aceptado no
enviado. Si el repartidor está quieto y sólo llegan E1/E2/E3/E4 dentro del
umbral de ruido, el buffer no incorpora esos puntos y el timer no hace POST de
trayectoria:

```text
STATIONARY_90_SECONDS:
TRAJECTORY_BUFFER_NEW_POINTS=0
NO_TRAJECTORY_BATCH_POST=SI
HEARTBEAT_IS_TRAJECTORY_POINT=NO
HEARTBEAT_TRIGGERS_PLAYBACK=NO
HEARTBEAT_CREATES_ROUTE_SEGMENT=NO
```

El heartbeat existente puede seguir actualizando freshness con el último punto
actual sin `trajectory`; el Cliente debe actualizar la antigüedad/version, pero
no mover el marker por ese evento.

### Timing

El formato propuesto es relativo al batch:

```text
TRAJECTORY_POINT_TIMING_FORMAT=RELATIVE_OFFSET_MS
DEVICE_TIME_AUTHORITY=VISUAL_ONLY_NOT_SECURITY
```

El producer deriva `offsetMs` de `capturedAt` sólo para el orden/ritmo visual:
el primer punto es 0, los offsets son monotónicos, no negativos y quedan
acotados a `MAX_BATCH_DURATION_MS=5000`. El servidor valida y retransmite el
valor ya acotado; no lo usa para decidir qué escritura gana, autenticar al
actor ni comparar pedidos. `locationRevision` sigue siendo la única autoridad
de frescura y orden server-side. Si el timing es inválido, el servidor puede
aceptar el último punto sin trayectoria, o rechazar el batch de forma fail-closed
según el contrato implementado; nunca debe inventar offsets.

### Payload y revisión

Se propone extender el POST existente, no abrir un endpoint público nuevo:

```json
{
  "pedidoId": "...",
  "lat": -26.1004,
  "lng": -58.2004,
  "batchId": "opaque-client-batch-id",
  "trajectory": [
    {"lat": -26.1000, "lng": -58.2000, "offsetMs": 0},
    {"lat": -26.1001, "lng": -58.2001, "offsetMs": 850},
    {"lat": -26.1002, "lng": -58.2002, "offsetMs": 1700},
    {"lat": -26.1004, "lng": -58.2004, "offsetMs": 2550}
  ]
}
```

El `lat/lng` top-level debe ser exactamente el último punto del batch. El
servidor persiste sólo ese punto y aumenta `locationRevision` una vez:

```text
batch=A,B,C,D,E
DB_CURRENT_POINT=E
locationRevision=N+1
realtime.version=N+1
realtime.trajectory=[A,B,C,D,E]
```

Un heartbeat envía sólo la forma legacy/top-level, sin trayectoria; no crea un
segmento. El response exitoso debe incluir `ok`, `locationRevision`, el último
punto server-accepted, timestamp server-side y el conteo de puntos aceptados.
El Cliente no reproduce un batch antes de confirmar el 2xx y su revisión.

```text
REALTIME_CONTRACT_CHANGE_REQUIRED=SI
BACKWARD_COMPATIBLE_REALTIME_EXTENSION=SI
PROPOSED_TRACKING_PAYLOAD=existing_POST_plus_batchId_plus_trajectory[{lat,lng,offsetMs}],top-level_lat_lng_equals_last_point
```

El evento `repartidor-location` conserva `pedidoId`, `lat`, `lng`, `timestamp` y
`version`; `trajectory` es opcional. Los Clientes viejos ignoran el campo y
siguen usando el último punto. El bridge interno debe validar/tener un límite
de tamaño, pero no debe cambiar la autoridad de versión.

### Persistencia, seguridad y rate limit

```text
T23_TRAJECTORY_PERSISTENCE_REQUIRED=NO
T23_SCHEMA_CHANGE_REQUIRED=NO
T23_MIGRATION_REQUIRED=NO
TRACKING_SECURITY_GATES_PRESERVED=SI
```

No se requiere una tabla histórica: `Pedido.repartidorLat`/`Lng`,
`repartidorLastUpdate` y `locationRevision` siguen siendo suficientes para el
estado actual. La trayectoria es transporte efímero. La consecuencia explícita
es que GET fallback no puede reconstruir batches ya pasados.

La extensión debe conservar exactamente las verificaciones existentes:
sesión Repartidor, cuenta activa, pedido existente, `en_camino`, domicilio,
relación con negocio, repartidor asignado, snapshot de tracking, kill switch
del negocio, Origin, rate limit y escritura server-authoritative con lock. Se
agregan validaciones de batch: array, máximo de puntos, tamaño JSON, lat/lng
finitos y rango, offsets ordenados/no negativos, edad máxima, duplicados,
saltos absurdos, consistencia del último punto con top-level y payload
malformado.

El rate limit 30/min queda sin cambios como primera hipótesis. Al agrupar varias
muestras en un request se espera menor presión de red; los heartbeats siguen
siendo una categoría separada. No se cambia el límite sin evidencia.

Propuestas de límites server-side:

```text
MAX_BATCH_POINTS=12
MAX_BATCH_JSON_BYTES≈8192
MAX_BATCH_DURATION_MS=5000
MAX_BATCH_DISTANCE_M=150
```

12 puntos cubren varios callbacks durante la ventana normal y son acotados para
el bridge; 8 KiB evita payloads desproporcionados; 5 s es una defensa por
encima del flush móvil de 3 s; 150 m evita que una ruta anómala sea aceptada
como una sola ventana. Son límites de seguridad, no sustituyen el filtro local.

### Falla de red y retry

Sin una nueva columna/idempotency store en DB no se puede prometer exactly-once
para una request cuyo response se perdió después de que la DB committeó. Para
mantener `T23_SCHEMA_CHANGE_REQUIRED=NO`, el diseño inicial es explícitamente
at-most-once ante fallas ambiguas:

```text
FAILED_BATCH_POLICY=retain_one_unconfirmed_bounded_batch;merge_new_samples_bounded;no_optimistic_playback;do_not_retry_ambiguous_commit;next_confirmed_batch_or_GET_recovers_latest_point
```

Un 4xx de validación descarta sólo el batch inválido y conserva un buffer
acotado de muestras posteriores para una nueva autorización. Un timeout/network
failure retiene como máximo un batch incierto y los nuevos puntos válidos; no
crea una cola offline infinita ni reproduce datos no confirmados. Un futuro
requisito exactly-once requeriría idempotencia persistida y deberá abrirse como
decisión de schema separada.

## Playback del Cliente

El Cliente consume `trajectory` sólo después de freshness/version authority y
reproduce puntos reales en orden:

```text
CLIENT_PLAYBACK_SOURCE=CONFIRMED_REAL_TRAJECTORY_POINTS
CLIENT_PLAYBACK_DURATION_POLICY=relative_offsets_clamped_to_80_750ms_with_bounded_catchup
TARGET_END_TO_END_VISUAL_LAG_MS=3000_proposed
CLIENT_BATCH_QUEUE_MAX=2_batches
CLIENT_CATCHUP_POLICY=one_active_batch_plus_one_pending;replace_only_pending_lower_fidelity_batch_with_newer_version;compress_segment_durations_to_minimum_80ms;never_extrapolate
```

Se permite interpolar sólo entre dos puntos consecutivos capturados. Si llega
otro batch durante playback, se mantiene una cola máxima de un batch activo y
uno pendiente; una versión nueva nunca se reordena detrás de una vieja. Si la
cola llega al límite, se descartan únicamente puntos visuales aún no iniciados
de la batch pendiente supersedida, conservando el último punto confirmado y
retargeteando desde la posición renderizada actual. No se agregan puntos
futuros ni se usa velocidad para extrapolar.

`T23_HTTP_FALLBACK_POLICY=LATEST_POINT_SNAP`: GET trae sólo el último punto y
puede hacer snap al recuperarse o al perder socket. Un heartbeat GET/realtime
sin trayectoria actualiza freshness/version pero no mueve. Al reconectar, el
Cliente resuelve el último versionado por GET y espera batches nuevos.

```text
FUTURE_POSITION_EXTRAPOLATION_ALLOWED=NO
STALE_STOPS_NEW_PLAYBACK=SI
STALE_EXTRAPOLATION=NO
```

Al agotarse los puntos recibidos, el marker queda exactamente en el último
punto. A los 120 s se conserva el estado `Pausado`. Completion/cancelación,
cambio de pedido, pérdida de elegibilidad y unmount cancelan playback, limpian
la cola y no permiten movimiento posterior.

## Comparación formal y recomendación

| Criterio | R1 `CLIENT_INTERPOLATION_ONLY` | Nueva arquitectura bounded batching + playback |
|---|---|---|
| Fidelidad espacial | Suaviza una recta entre anclajes; descarta forma intermedia | Conserva puntos B/C/D reales y reproduce su forma |
| Curvas | No inventa curva, pero tampoco la conserva si no llega el anclaje | Mejora curvas sólo en la medida en que el GPS las capturó |
| Lag | Bajo; inicia al recibir cada anclaje | Propuesto ~3 s end-to-end por ventana acotada |
| Red/batería | Mantiene hasta 12 POST/min por pedido más heartbeat | Menos POST para varias muestras, payload/evento mayores |
| Complejidad | Baja-media, sin cambio de contrato | Alta: buffer, batch validation, realtime extension, queue/retry |
| DB/migración | Ninguna | Ninguna si se acepta at-most-once ambiguo |
| Fallback/recovery | Último punto con snap | Igual; fallback no reconstruye historia |
| Seguridad | Superficie actual | Superficie actual más validación de batch/tamaño/offsets |
| Evidencia física | Falló por `STEPWISE_JUMPS` | Debe certificarse con replay determinista y ruta real |

```text
T23_RECOMMENDED_ARCHITECTURE=BOUNDED_LOCAL_TRAJECTORY_BATCHING_PLUS_CLIENT_PLAYBACK
T23_BATCHING_REQUIRED=SI
T23_PRESERVES_CAPTURED_SHAPE=SI
T23_MAP_MATCHING=NO
T23_ROUTE_SNAPPING=NO
```

La recomendación única es la arquitectura B. La razón no es que R1 sea
técnicamente imposible, sino que ya no satisface el requisito aclarado de
conservar puntos físicos intermedios. T24 sigue siendo el lugar de map
matching/road constraint; T54 sigue siendo follow camera/turn-by-turn.

## Fileset mínimo de implementación futura

```text
PRODUCER_FILES=src/hooks/use-repartidor-tracking.ts;src/lib/tracking-movement.ts;src/lib/tracking-trajectory.ts(new_if_needed)
SERVER_FILES=src/app/api/repartidor/ubicacion/route.ts;src/lib/realtime-publish.ts;src/lib/realtime-types.ts
CLIENT_FILES=src/components/tracking/delivery-tracking-map.tsx;src/lib/tracking-playback.ts
TEST_FILES=src/hooks/use-repartidor-tracking.test.ts;src/lib/tracking-movement.test.ts;src/lib/tracking-trajectory.test.ts(new_if_needed);src/app/api/repartidor/ubicacion/route.test.ts;src/lib/realtime-publish.test.ts;src/lib/tracking-consumer-static-contract.test.ts;src/components/tracking/delivery-tracking-map-stale-contract.test.ts
HARNESS_FILES=script_local_autenticado_de_testing(new_file;no_public_debug_endpoint)
PRISMA_FILES=NONE
MIGRATION_FILES=NONE
```

El bridge realtime externo al checkout también requiere revisión de compatibilidad
del campo opcional `trajectory`; no se debe asumir que un cambio en el tipo
local actualiza el servicio remoto automáticamente.

## Harness controlado de Testing

```text
T23_TESTING_TRAJECTORY_REPLAY_HARNESS=RECOMMENDED
T23_HARNESS_MODE=local_authenticated_testing_only
T23_HARNESS_PUBLIC_DEBUG_ENDPOINT=NO
```

El harness recomendado prepara fixtures de Negocio, Cliente, Repartidor y
pedido; acepta negocio y repartidor, pone el pedido `en_camino`, autentica el
POST contra Testing y envía batches deterministas al endpoint real. No crea
una ruta debug pública ni bypassa authorization. El operador abre el Cliente
real y observa el marker.

Casos mínimos:

```text
CASE_1=recta_A_B_C_D
CASE_2=curva_esquina_A_B_C_D_E
CASE_3=stationary_90_seconds_no_visual_trajectory
CASE_4=moving_slow_below_distance_threshold_but_age_flush
CASE_5=lost_batch_recovery_and_latest_point_snap
CASE_6=stale_stops_after_received_points
CASE_7=completion_cancels_queue_and_marker
```

## Test plan antes de implementación

1. Varios callbacks útiles quedan en un buffer bounded por pedido.
2. Duplicados y jitter estacionario no agregan puntos.
3. Accuracy mala, coordenadas imposibles y future skew se rechazan.
4. Distance threshold hace flush una sola vez por batch.
5. Moving-age hace flush sólo si existe movimiento real.
6. Timer sin movimiento no hace POST de trayectoria.
7. Máximo de puntos, bytes, edad y distancia se aplican server-side.
8. `lat/lng` top-level coincide con el último punto del batch.
9. DB conserva sólo el último punto.
10. Una batch incrementa `locationRevision` exactamente una vez.
11. Realtime transporta `trajectory` opcional con la misma versión DB.
12. Cliente reproduce todos los puntos confirmados en orden.
13. Heartbeat no crea playback ni route segment.
14. Batches consecutivos tienen cola bounded y catch-up.
15. GET/reconnect hace latest-point snap sin historial inventado.
16. Falla de red no hace playback optimista ni cola infinita.
17. Stale detiene reproducción y recovery hace snap seguro.
18. Completion limpia buffer, queue y callbacks.
19. No aparece un segundo `watchPosition` ni loop GPS adicional.
20. No hay map matching, route snapping, camera follow ni bearing de T54.

## Plan de implementación y decisión de split

El cambio abarca dos superficies con riesgos independientes: producer/server/
realtime y client playback/harness. Dividirlo reduce riesgo real porque permite
probar primero el contrato de batch y su autoridad de versión, y luego conectar
el playback sin mezclar fallas de red/seguridad con percepción visual.

```text
T23_NEW_IMPLEMENTATION_SPLIT_REQUIRED=SI
P2_T23_R3A=bounded producer buffer + POST/server validation + DB/realtime contract
P2_T23_R3B=client confirmed-trajectory playback + bounded queue + Testing harness
NEXT_ACTION=IMPLEMENT_P2_T23_R3A_AFTER_OPERATOR_APPROVAL
```

R3A no debe introducir schema/migrations salvo que el diseño de idempotencia
exactly-once se vuelva un requisito explícito. R3B no debe abrir un segundo
watcher ni convertir la trayectoria en extrapolación.

## Estado final

```text
T23_R1_PHYSICAL_SMOOTHNESS=FAIL
P2_T23_R2_PREVIOUS_FIX_STATUS=SUPERSEDED_BEFORE_COMMIT
A0_ARCHITECTURE_SUPERSEDED_BY_PRODUCT_CLARIFICATION=SI
T23_BATCHING_REQUIRED=SI
T23_RECOMMENDED_ARCHITECTURE=BOUNDED_LOCAL_TRAJECTORY_BATCHING_PLUS_CLIENT_PLAYBACK
TRAJECTORY_FLUSH_MODEL=DISTANCE_OR_MAX_AGE_WHILE_MOVING
PERIODIC_SAME_POSITION_TRAJECTORY_POST=NO
LOCAL_TRAJECTORY_BUFFER_REQUIRED=SI
TRAJECTORY_POINT_ACCEPTANCE_POLICY=accuracy_aware_min_spacing_plus_freshness_plus_impossible_jump_rejection
TRAJECTORY_POINT_TIMING_FORMAT=RELATIVE_OFFSET_MS
TARGET_END_TO_END_VISUAL_LAG_MS=3000_PROPOSED
MAX_MOVING_BATCH_AGE_MS=3000
MAX_BATCH_POINTS=12
T23_TRAJECTORY_PERSISTENCE_REQUIRED=NO
T23_SCHEMA_CHANGE_REQUIRED=NO
T23_MIGRATION_REQUIRED=NO
REALTIME_CONTRACT_CHANGE_REQUIRED=SI
T23_HTTP_FALLBACK_POLICY=LATEST_POINT_SNAP
FUTURE_POSITION_EXTRAPOLATION_ALLOWED=NO
HEARTBEAT_IS_TRAJECTORY_POINT=NO
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
T23_MAP_MATCHING=NO
T23_ROUTE_SNAPPING=NO
TRACKING_SECURITY_GATES_PRESERVED=SI
T23_TESTING_TRAJECTORY_REPLAY_HARNESS=RECOMMENDED
T23_NEW_IMPLEMENTATION_SPLIT_REQUIRED=SI
P2_T23_STATUS=REDESIGNED_READY_FOR_IMPLEMENTATION
NEXT_ACTION=IMPLEMENT_P2_T23_R3A_AFTER_OPERATOR_APPROVAL
PRODUCT_FILES_CHANGED_FINAL=0
TEST_FILES_CHANGED_FINAL=0
PRISMA_FILES_CHANGED=0
MIGRATION_FILES_CHANGED=0
DATABASE_CHANGED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

T24, T54 y Production no se inician. El documento es la decisión de diseño
vigente hasta que el operador autorice la implementación R3A.
