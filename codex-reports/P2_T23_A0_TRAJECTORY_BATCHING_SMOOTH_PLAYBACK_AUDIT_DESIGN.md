# P2-T23-A0 — Delivery trajectory batching + smooth playback audit & design

Fecha: 2026-09-13. Tipo: audit / architecture design / no functional
implementation.

Esta tarea audita el HEAD vigente para convertir la reproducción visual del
Cliente desde `STEPWISE_JUMPS` a una reproducción suave y honesta. No se
implementó T23, no se modificó producto, tests, Prisma, DB, tracking, routing,
T24, T54 ni Production.

## Autoridad y preflight

```text
P2_T02_STATUS=CLOSED_TESTING_CERTIFIED
P2_T02_RELEASE_ELIGIBLE=SI
R6_COMMIT_SHA=f5e5afcce0f4f2a28725a8b0386d0c584c9e987b
HEAD=8d43cb0bc4f1b21db6f9643d4d5bcdc63150fcd3
CURRENT_BRANCH=work/p2-t43-r2
origin/testing-codex=8d43cb0bc4f1b21db6f9643d4d5bcdc63150fcd3
origin/main=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
POST_R6_DELTA=NONE
PREVIOUS_POST_R6_FUNCTIONAL_DELTA=NO
PREFLIGHT_DECISION=CONTINUE
```

La referencia remota no avanzó respecto del baseline esperado y `origin/main`
coincide con Production. El checkout contiene archivos untracked históricos,
pero no hay cambios tracked locales al iniciar la auditoría.

Se preservan las autoridades físicas de R6:

```text
T23_PHYSICAL_EVIDENCE=CONFIRMED
CLIENT_MARKER_MOVEMENT=STEPWISE_JUMPS
SMOOTH_INTERPOLATION=NO
REAL_ROUTE_100_300M=PASS
REAL_ROUTE_DISTANCE=>1km
CLIENT_UPDATES_OBSERVED=SI
T23_NAVIGATION_FOLLOW_SCOPE=PARTIAL
T24_NAVIGATION_MAP_MATCHING_SCOPE=CONFIRMED_RELATED
P2_T54=Driver Turn-by-Turn Follow Camera UX
P2_T54_STATUS=FUTURE_AFTER_T02_T23_T24
```

## Pipeline actual auditado

La cadena real del tracking es:

```text
GPS_SAMPLE
  → useRepartidorTracking.observeSample
  → isSignificantMovement / accuracy-aware local filter
  → per-delivery MIN_SEND_INTERVAL_MS throttle
  → latest-sample-only pending coalescing
  → POST /api/repartidor/ubicacion
  → atomic Pedido coordinate + locationRevision
  → tracking.location.updated internal publish
  → shared RealtimeManager socket relay as repartidor-location
  → DeliveryTrackingMap freshness guard
  → trackingData state
  → Leaflet repartidorMarker.setLatLng
```

HTTP fallback corre en paralelo al consumidor: cada 8 s cuando el socket no
está conectado y cada 20 s como heartbeat aun con socket conectado. El
`RealtimeManager` es el transporte compartido; el mapa sólo adquiere el lease
`tracking:watch` y se suscribe al registro, sin socket propio.

Archivos auditados:

```text
src/hooks/use-repartidor-tracking.ts
src/lib/tracking-movement.ts
src/lib/tracking-freshness.ts
src/app/api/repartidor/ubicacion/route.ts
src/lib/realtime-publish.ts
src/lib/realtime-types.ts
src/lib/realtime-manager.ts
src/providers/realtime-provider.tsx
src/app/api/pedidos/[id]/tracking/route.ts
src/components/tracking/delivery-tracking-map.tsx
src/components/client/client-orders-panel.tsx
```

El servidor de Socket.IO/bridge no está dentro de este checkout: el contrato
observable aquí es el publish interno versionado y el relay compartido
`repartidor-location`. No se inventa una cadencia interna del servicio remoto.

## Modelo actual de datos

```text
CURRENT_GPS_SAMPLE_FIELDS=lat,lng,accuracy,capturedAt
CURRENT_GPS_SAMPLE_TIMESTAMP_AUTHORITY=GeolocationPosition.timestamp_WITH_Date.now_FALLBACK
CURRENT_POST_PAYLOAD_FIELDS=pedidoId,lat,lng
CURRENT_POST_PAYLOAD_MODE=CURRENT_POINT_ONLY
CURRENT_DB_TRACKING_FIELDS=repartidorLat,repartidorLng,repartidorLastUpdate,locationRevision
CURRENT_REALTIME_TRACKING_FIELDS=pedidoId,lat,lng,timestamp,version
CURRENT_GET_TRACKING_FIELDS=trackable,trackingDisabled,repartidorLat,repartidorLng,repartidorLastUpdate,version,destinoLat,destinoLng,destinoDireccion,negocioLat,negocioLng,negocioNombre,negocioLogoUrl,negocioColorPrincipal,estado
CURRENT_TRAJECTORY_HISTORY_AVAILABLE=NO
LOCATION_REVISION_AUTHORITY=DB_MONOTONIC_PER_PEDIDO
```

`accuracy` y `capturedAt` sólo se usan localmente para filtrar y decidir si un
sample puede reutilizarse. El POST no los envía. El servidor escribe un único
punto actual en `Pedido` y aumenta `locationRevision` atómicamente; no existe
una tabla ni un JSON de historial de trayectoria.

El evento realtime lleva `timestamp` server-side y `version` igual a la
revisión devuelta por la escritura DB. El GET lleva el mismo `version`. El
Cliente valida la revisión con `tracking-freshness.ts`; una revisión antigua no
puede mover la posición aunque llegue después. Una fuente sin versión sólo
puede mover la posición antes de que exista una versión confiable, según el
contrato legacy ya vigente.

## Cadencias y límites actuales

```text
GPS_SAMPLE_CADENCE_MODEL=BROWSER_WATCH_CALLBACK_DRIVEN
GPS_WATCH_MAXIMUM_AGE_MS=3000
GPS_WATCH_TIMEOUT_MS=4000
GPS_WATCH_HIGH_ACCURACY=NO
GPS_ONE_SHOT_MODEL=INITIAL_RECOVERY_HEARTBEAT_ONLY_SINGLE_FLIGHT

NETWORK_PUBLISH_CADENCE_MODEL=SIGNIFICANT_MOVEMENT_OR_FRESH_HEARTBEAT
MIN_SEND_INTERVAL_MS=5000
STATIONARY_HEARTBEAT_MS=60000
GPS_PENDING_QUEUE_MODEL=LATEST_SAMPLE_ONLY_PER_DELIVERY
POST_CONCURRENCY_PER_DELIVERY=1

CLIENT_REALTIME_CADENCE_MODEL=ONE_EVENT_PER_ACCEPTED_POST_EXTERNAL_TRANSPORT
CLIENT_HTTP_FALLBACK_CADENCE_MODEL=8000MS_WITHOUT_SOCKET_20000MS_SOCKET_HEARTBEAT
CLIENT_STALE_THRESHOLD_MS=120000
```

El productor puede recibir callbacks GPS más frecuentes que los POST, pero no
preserva una cola: reemplaza la muestra pendiente por la más nueva. El
heartbeat estacionario sólo reenvía un sample fresco y no rejuvenece una
coordenada vieja. Background no se corta voluntariamente; Android/Chromium
puede throttlear o congelar la ejecución. El Cliente ya expresa esa condición
como `Pausado` a partir de 120 s sin nueva ubicación.

## Causa confirmada de los saltos

En `DeliveryTrackingMap`, el efecto de posición compara el punto actual con el
nuevo y llama directamente a `repartidorMarkerRef.current.setLatLng(newPos)`.
No hay `requestAnimationFrame`, duración, cola, buffer de trayectoria ni reloj
de playback. `fitBounds(..., { animate: true })` sólo anima la cámara cuando se
ajustan bounds; no anima el marker.

```text
STEPWISE_JUMPS_ROOT_CAUSE=CONFIRMED
DIRECT_SETLATLNG_CURRENT=SI
CLIENT_TRAJECTORY_BUFFER_CURRENT=NO
CLIENT_INTERPOLATION_CURRENT=NO
T23_PRIMARY_JUMP_CAUSE=BOTH
```

`BOTH` es la conclusión correcta para la evidencia física: los anclajes llegan
discretos por el filtro/throttle y, aun cuando existen dos anclajes válidos, el
Cliente salta directamente entre ellos. Client-side interpolation resuelve el
segundo componente y mejora la cadencia normal sin cambiar el productor. No
puede inventar continuidad durante un gap de red/background en el que no hay un
punto B confirmado; en ese caso debe detenerse o hacer snap al recuperar.

## Invariante GPS y límites de alcance

```text
ONE_DEVICE_GEOLOCATION_WATCHER_AUTHORITY=SI
GPS_WATCH_AUTHORITY=useRepartidorTracking
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
SECOND_GEOLOCATION_WATCHER_REQUIRED_FOR_T23=NO
T23_ROUTE_SNAPPING=NO
T23_MAP_MATCHING=NO
T23_MARKER_HEADING_ALLOWED=PARTIAL
T23_CAMERA_FOLLOW=NO
T23_CAMERA_BEARING=NO
T23_RECENTER=NO
```

T23 puede derivar opcionalmente el heading del marker a partir de dos puntos
confirmados consecutivos si la señal es suficientemente distinta; no puede
convertirlo en heading de cámara. Snapping, map matching, corrección de curvas
y nearest-road son T24. Follow camera, bearing, recenter, pitch y turn-by-turn
son T54.

## Opciones arquitectónicas

| Opción | Suavidad/fidelidad | Red y batería | API/schema/realtime | Fallback/reconnect/stale | Complejidad y decisión |
|---|---|---|---|---|---|
| A — `CLIENT_SIDE_INTERPOLATION_ONLY` | Alta entre anclajes confirmados; no cubre gaps sin evidencia | Sin cambios | Sin cambios | GET/realtime siguen entregando último punto; snap en inicio, reconnect, recovery o gap grande; stale detiene | Baja-media; recomendada |
| B — `SERVER_TRAJECTORY_BATCHING` | Potencialmente mayor si se conservan samples descartados | Payloads mayores y posible presión adicional | Requiere contrato de batch, ordering, límites, auth y soporte HTTP | Reconnect y completion deben limpiar/reconciliar batches; mixed versions más complejas | Alta; no justificada ahora |
| C — `REALTIME_TRAJECTORY_WINDOW` | Buena en socket; inconsistente por GET fallback si éste sólo trae latest | Más bytes por evento | Cambia el evento/bridge y su validación | Reconnect necesita resync de ventana; DB seguiría sin historial | Media-alta; no recomendada ahora |
| D — `HYBRID` | Máxima en teoría | Mayor coste y dos fuentes de complejidad | Cambios de productor + transporte + playback | Debe resolver simultáneamente fallback, replay, stale y completion | Alta; diferida hasta evidencia de insuficiencia de A |

La opción B no debe elegirse por el nombre histórico de T23. El cuello
observable actual es la ausencia de playback visual. Preservar el backend
current-point-only reduce superficie de seguridad, latencia, migración y
reconnect.

```text
T23_BATCHING_REQUIRED=NO
T23_BATCHING_JUSTIFICATION=La cadencia normal ya entrega anclajes suficientes para una primera reproducción; la interpolación cliente corrige el salto sin persistir historial ni ampliar el contrato. La coalescencia latest-only sólo se reconsideraría en una tarea posterior si la certificación R1 demuestra gaps normales demasiado grandes, nunca para ocultar background/stale.
T23_RECOMMENDED_ARCHITECTURE=CLIENT_INTERPOLATION_ONLY
T23_IMPLEMENTATION_SPLIT_REQUIRED=NO
```

No se requiere un split técnico: un módulo puro de playback, el wiring del
mapa, tests deterministas y una certificación física forman una única R1
coherente. La certificación física sigue siendo un gate de entrega, no un
motivo para introducir un backend intermedio.

## Diseño propuesto de playback

La implementación futura debe mantener un estado acotado en memoria por mapa:

```text
renderedPoint      = posición exacta que actualmente muestra Leaflet
targetPoint        = último punto aceptado y confirmado
targetVersion      = locationRevision/version del target
animationFrame     = único requestAnimationFrame activo o null
lastAcceptedAt     = reloj monotónico local de recepción, sólo para duración
```

No se debe usar el reloj del dispositivo ni `timestamp` para decidir qué punto
gana; `locationRevision` sigue siendo la autoridad de orden. El reloj local
puede medir cuánto tiempo separar dos eventos para escoger una duración visual,
pero nunca valida una posición ni adelanta el marker.

Política recomendada:

1. Primer punto válido, recuperación posterior a stale, reconnect o gap grande:
   snap inmediato; no se anima desde un punto que puede tener minutos de edad.
2. Punto nuevo con revisión estrictamente mayor y distancia distinta: cancelar
   el frame anterior y retargetear desde la posición renderizada actual hacia
   el nuevo punto.
3. Cada frame calcula sólo `A + progress * (B - A)` con `progress <= 1` y
   termina exactamente en B. Sin punto nuevo, no continúa ningún movimiento.
4. Un heartbeat con mismas coordenadas sólo actualiza freshness/version; no
   rebota ni vuelve a animar el marker.
5. Una revisión menor se descarta. Una revisión igual es idempotente y no
   inicia una segunda animación.

```text
FUTURE_POSITION_EXTRAPOLATION_ALLOWED=NO
INTERPOLATION_ONLY_BETWEEN_CONFIRMED_POINTS=REQUIRED
SAME_COORDINATE_HEARTBEAT_ANIMATES=NO
OUT_OF_ORDER_VISUAL_UPDATE_POLICY=DISCARD_VERSION_OLDER_OR_DEDUPE_EQUAL
MID_ANIMATION_NEW_POINT_POLICY=RETARGET_FROM_CURRENT_RENDERED_POSITION
```

La duración debe ser proporcional al intervalo de recepción anterior, con
límites derivados del productor actual, no una promesa de velocidad real:

```text
T23_PLAYBACK_DELAY_TARGET_MS=0
T23_INTERPOLATION_MIN_DURATION_MS=250
T23_INTERPOLATION_MAX_DURATION_MS=5000
T23_LARGE_GAP_SNAP_THRESHOLD=20000
```

El target de delay cero evita introducir un buffer deliberado: la animación
empieza al recibir B. El mínimo de 250 ms evita parpadeos en puntos muy
cercanos; el máximo de 5 s evita que el Cliente quede permanentemente detrás de
la cadencia mínima de publicación. Un gap mayor a 20 s supera el intervalo de
heartbeat de socket de 20 s y debe hacer snap al nuevo punto; si además se
supera el stale threshold, primero se detiene y se muestra `Pausado`.
Estos valores son límites iniciales justificables por las cadencias auditadas,
no una estimación de la velocidad del Repartidor.

## Heartbeat, stale, background y completion

```text
STALE_STOPS_PLAYBACK=SI
STALE_EXTRAPOLATION=NO
POST_STALE_RECOVERY_POLICY=SNAP_TO_FRESH_AUTHENTICATED_POINT_AND_CLEAR_ANIMATION
DELIVERY_COMPLETION_CANCELS_PLAYBACK=REQUIRED
POST_COMPLETION_VISUAL_MOVEMENT_ALLOWED=NO
```

Al pasar a stale se cancela el único `requestAnimationFrame`, se conserva el
último punto confirmado y se mantiene el disclosure existente `Pausado`. No se
consume el tiempo restante de un segmento ni se extrapola velocidad. Cuando
llega un punto fresco posterior a recovery, se limpia cualquier target viejo y
se hace snap al punto fresco; no se intenta reproducir lo ocurrido durante el
gap.

Al desmontar/cerrar/cambiar de pedido o al dejar de estar en `en_camino`, la
implementación debe cancelar `requestAnimationFrame`, timers de playback,
targets, refs y cualquier callback tardío. El estado terminal de Entregado no
puede generar movimiento visual aunque el Repartidor continúe enviando otra
cosa por fuera del pedido.

## HTTP fallback, socket y resync

```text
T23_HTTP_FALLBACK_PLAYBACK_POLICY=LATEST_VERSIONED_POINT_ONLY
T23_RECONNECT_POLICY=RESYNC_GET_LATEST_THEN_SNAP_OR_SHORT_ANIMATE_BY_GAP
T23_INITIAL_OPEN_POLICY=FIRST_VALID_POINT_SNAP
```

GET y realtime comparten `version`; el primer punto que gana la freshness
authority se muestra con snap. Un GET que llega tarde no puede retroceder un
evento realtime más nuevo. Al perder/reconectar socket, el GET aporta sólo el
último punto y nunca se exige historial completo. Las fuentes legacy sin
versión que todavía sean aceptables por el guard existente se muestran por
snap, sin alimentar una cola de playback, hasta que una versión confiable
establezca la autoridad.

El buffer visual no puede ser ilimitado:

```text
MAX_TRAJECTORY_POINTS=2
MAX_TRAJECTORY_AGE_MS=20000
TRAJECTORY_PERSISTENCE=MEMORY_ONLY
```

En realidad el diseño preferido no mantiene una cola: sólo posición renderizada
y target. El límite de dos puntos expresa el máximo lógico A→B y evita que una
animación de un delivery consuma memoria de forma indefinida.

## Timestamp, accuracy y heading

```text
DEVICE_TIMESTAMP_REQUIRED=NO
ACCURACY_SERVER_PAYLOAD_REQUIRED=NO
HEADING_SERVER_PAYLOAD_REQUIRED=NO
SPEED_SERVER_PAYLOAD_REQUIRED=NO
SERVER_TIME_REMAINS_PERSISTENCE_AUTHORITY=SI
```

La precisión ya participa correctamente en el filtro local de movimiento. No
es necesaria para interpolar una línea entre dos puntos confirmados y enviarla
al servidor ampliaría el trust boundary sin beneficio probado. Heading y
speed no son necesarios para la primera solución; el heading visual del marker
puede derivarse localmente de dos puntos consecutivos válidos, con umbral de
distancia y sin afectar cámara, routing ni autorización. Si una futura tarea
necesita batching real, deberá introducir timestamp de sample explícito,
ordering y límites como un diseño separado.

## Seguridad y almacenamiento

```text
TRACKING_AUTH_MODEL_CHANGE_REQUIRED=NO
TRACKING_SECURITY_GATES_PRESERVED=SI
T23_SCHEMA_CHANGE_REQUIRED=NO
T23_MIGRATION_REQUIRED=NO
T23_TRAJECTORY_PERSISTENCE_REQUIRED=NO
```

La opción recomendada reutiliza GET/realtime actuales y no abre endpoints. Se
preservan autenticación de Cliente/Repartidor, asociación al negocio, pedido
asignado, estado `en_camino`, domicilio, snapshot de tracking, kill switch del
negocio, rate limit, protección Origin y autoridad server-side. La trayectoria
visual es derivada temporalmente en el browser y no se convierte en historial
de negocio ni fuente de auditoría.

## Estrategia de pruebas para R1

El módulo puro propuesto debe ser determinista con reloj inyectado y cubrir
unit tests para:

```text
A  A→B produce progreso monotónico hasta B
B  ningún frame supera B
C  heartbeat con mismas coordenadas no anima
D  punto out-of-order se rechaza
E  revisión vieja no retrocede marker
F  C durante A→B hace retarget desde la posición renderizada actual
G  gap grande hace snap
H  stale cancela playback y congela en el último punto
I  recovery posterior a stale hace snap al punto fresco
J  completion cancela toda animación
K  unmount cancela rAF/timers
L  HTTP fallback latest-only
M  realtime versionado
N  reconnect/resync
O  stationary no produce movimiento artificial
P  cadencia Android no se convierte en extrapolación
Q  no second geolocation watcher
R  no route snapping/map matching
S  no camera follow/bearing/recenter de T54
```

Clasificación:

```text
UNIT=algoritmo de interpolación, version ordering, dedupe, gap/stale/cleanup
STATIC_CONTRACT=un solo watcher, POST actual, freshness guard, Leaflet sin renderer migration
INTEGRATION=mapa acepta GET/realtime y sólo actualiza target tras version authority
PHYSICAL=recorrido real; marker suave entre updates, quieto no se mueve, stale honesto, recovery y completion
```

Protocolo físico futuro: una persona observa el Cliente desde otro dispositivo
mientras otra realiza caminata/auto segura; no se mira el teléfono mientras se
conduce. Comparar R6 baseline contra R1: suavidad entre puntos, ausencia de
saltos normales, quieto sin movimiento, stop en stale, snap de recovery y cero
movimiento después de Entregado.

## Fileset propuesto para T23-R1

Sin cambios en A0:

```text
PRODUCT_FILES_EXPECTED=src/lib/tracking-playback.ts; src/components/tracking/delivery-tracking-map.tsx
TEST_FILES_EXPECTED=src/lib/tracking-playback.test.ts; src/lib/tracking-consumer-static-contract.test.ts; src/components/tracking/delivery-tracking-map-stale-contract.test.ts
SCHEMA_FILES_EXPECTED=NONE
```

No se incluyen `use-repartidor-tracking.ts`, las rutas API, realtime publish,
Prisma ni migraciones porque la arquitectura recomendada no cambia el
productor ni el contrato de transporte.

## Decisión y estado final

```text
P2_T02_STATUS=CLOSED_TESTING_CERTIFIED
T23_PHYSICAL_EVIDENCE=CONFIRMED
CURRENT_CLIENT_RENDER_BEHAVIOR=STEPWISE_JUMPS
T23_PRIMARY_JUMP_CAUSE=BOTH
T23_BATCHING_REQUIRED=NO
T23_RECOMMENDED_ARCHITECTURE=CLIENT_INTERPOLATION_ONLY
T23_IMPLEMENTATION_SPLIT_REQUIRED=NO
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
FUTURE_POSITION_EXTRAPOLATION_ALLOWED=NO
INTERPOLATION_ONLY_BETWEEN_CONFIRMED_POINTS=REQUIRED
STALE_STOPS_PLAYBACK=SI
POST_COMPLETION_VISUAL_MOVEMENT_ALLOWED=NO
T23_ROUTE_SNAPPING=NO
T23_MAP_MATCHING=NO
T23_CAMERA_FOLLOW=NO
T23_RENDERER_CHANGE_REQUIRED=NO
T23_SCHEMA_CHANGE_REQUIRED=NO
T23_MIGRATION_REQUIRED=NO
TRACKING_SECURITY_GATES_PRESERVED=SI
P2_T23_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
NEXT_ACTION=IMPLEMENT_P2_T23_R1_CLIENT_INTERPOLATION_ONLY
PRODUCT_FILES_CHANGED=0
TEST_FILES_CHANGED=0
PRISMA_FILES_CHANGED=0
MIGRATION_FILES_CHANGED=0
FUNCTIONAL_TREE_CHANGED=NO
DATABASE_CHANGED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

T23 queda diseñada y lista para implementación R1, pero no cerrada ni
iniciada. T24 y T54 permanecen fuera de alcance.
