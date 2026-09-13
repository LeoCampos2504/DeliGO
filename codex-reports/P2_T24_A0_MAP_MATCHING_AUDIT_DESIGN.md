# P2-T24-A0 — Road-constrained visual positioning / map matching

Fecha: 2026-09-13
Proyecto: DeliGO
Alcance: auditoría y diseño únicamente. No se implementa T24 en A0.

## 1. Baseline autoritativo

    P2_T23_STATUS=CLOSED_TESTING_CERTIFIED
    P2_T23_RELEASE_ELIGIBLE=SI
    R3C_FINAL_COMMIT_SHA=26d83b57d9dca35b05f0e867c5b431c9dda15e2a
    REMOTE_TESTING_SHA=26d83b57d9dca35b05f0e867c5b431c9dda15e2a
    PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
    PRODUCTION_TOUCHED=NO
    PRODUCTION_PROMOTION_AUTHORIZED=NO

Preflight observado:

    HEAD=26d83b57d9dca35b05f0e867c5b431c9dda15e2a
    ORIGIN_TESTING=26d83b57d9dca35b05f0e867c5b431c9dda15e2a
    ORIGIN_MAIN=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763

El checkout contiene muchos archivos no trackeados preexistentes y ajenos a
T24. No fueron modificados, stageados ni incluidos en este reporte.

T23 ya demostró batching local acotado, POST autenticado real, persistencia del
último punto RAW, locationRevision monotónica, publicación realtime de la
trayectoria y playback confirmado en Cliente. R3C dejó explícito que T23 no
hace map matching ni route snapping.

## 2. Decisiones de producto preservadas

    GPS_RAW_IS_INTERNAL_AUTHORITY=SI
    DB_RAW_POSITION_ONLY=SI
    MAP_MATCHING_PURPOSE=CLIENT_VISUALIZATION
    ROUTE_LOCKING_ALLOWED=NO
    MATCHING_FAILURE_POLICY=FALLBACK_TO_RAW_T23
    CLIENT_DELIVERY_TRACKING_MAP=SI
    DRIVER_NAVIGATION_MAP=NO
    DESTINATION_MAP_MATCHING=NO
    ORDER_DESTINATION_AUTHORITY=Pedido.lat/lng

La coordenada RAW capturada por el teléfono no se reemplaza ni se corrige en la
autoridad interna. T24 sólo puede producir una representación visual derivada.
No puede alterar estado del pedido, entrega, distancia comercial, geofencing,
ownership, billing, destino ni la ubicación persistida.

El pin rojo conserva exactamente Pedido.lat/lng. El marcador visual puede
terminar sobre la calle cercana en los últimos metros, mientras el pin sigue
representando el domicilio exacto.

## 3. Pipeline actual auditado

| Etapa | Archivo | Responsabilidad actual |
|---|---|---|
| A. GPS producer | src/hooks/use-repartidor-tracking.ts | Un único navigator.geolocation.watchPosition() compartido por el hook; getCurrentPosition() sólo para recuperación puntual. |
| B. Buffer local | src/lib/tracking-trajectory.ts; use-repartidor-tracking.ts | Buffer efímero por delivery; spacing, accuracy, edad, timestamps, distancia, máximo 12 puntos y máximo 5 s/150 m. |
| C. Payload | use-repartidor-tracking.ts; src/lib/tracking-trajectory.ts | pedidoId, lat, lng y trajectory opcional; offsetMs monotónico, último punto igual al top-level y sin PII externa. |
| D. Tracking POST | src/app/api/repartidor/ubicacion/route.ts | Autentica Repartidor, comprueba asociación/asignación/elegibilidad, rate-limit y valida batch. |
| E. DB write | src/app/api/repartidor/ubicacion/route.ts | Actualización atómica de repartidorLat, repartidorLng, repartidorLastUpdate y locationRevision + 1; sólo persiste último punto. |
| F. Realtime event | src/lib/realtime-publish.ts; route de ubicación | Publica tracking.location.updated después del commit, con la misma revisión DB y trajectory RAW opcional. |
| G. Realtime bridge | mini-services/chat-service/internal-publish-schema.js, internal-publish-handler.js, index.js | Valida, deduplica/correlaciona y emite repartidor-location al room autorizado tracking:watch. |
| H. Cliente consumer | src/components/tracking/delivery-tracking-map.tsx; src/lib/realtime-types.ts | Suscribe el room, filtra por pedidoId, aplica autoridad de versión y recibe trajectory RAW. |
| I. Playback controller | src/lib/tracking-playback.ts | Cola bounded active+pending, orden por locationRevision, un rAF, interpolación, stale cancellation, recovery snap y completion cancellation. |
| J. Leaflet writer | src/lib/tracking-playback.ts; delivery-tracking-map.tsx | El controlador es el único escritor de repartidorMarker.setLatLng; origin/destination tienen writers separados. |
| K. HTTP fallback | delivery-tracking-map.tsx; src/app/api/pedidos/[id]/tracking/route.ts | Polling 8 s sin socket y heartbeat 20 s con socket; GET devuelve último punto RAW, timestamp y version, no trayectoria. |

Diagrama actual:

    RAW_SAMPLE
      -> one watchPosition()
      -> bounded local trajectory buffer
      -> POST /api/repartidor/ubicacion
      -> server validation
      -> atomic Pedido current RAW point + locationRevision
      -> tracking.location.updated
      -> realtime bridge / repartidor-location
      -> freshness/version gate in Client
      -> T23 confirmed playback controller
      -> exclusive Leaflet marker writer
      -> VISUAL_MARKER

Punto de inserción recomendado: después del commit atómico RAW y antes de la
única publicación realtime. Allí el servidor puede consultar un
MapMatchingProvider con el batch RAW ya validado, conservar el resultado en
memoria de la request y publicar un único evento con matchedTrajectory
opcional. Un timeout o resultado no confiable publica el mismo evento con RAW,
sin bloquear la persistencia ni crear otra revisión.

## 4. Invariantes de T23 que no se pueden romper

    SOLE_GPS_WATCHER_PRESERVED=SI
    SECOND_GEOLOCATION_WATCHER_INTRODUCED=NO
    LOCATION_REVISION_INCREMENT_PER_BATCH=1
    DB_TRAJECTORY_PERSISTED=NO
    HEARTBEAT_IS_TRAJECTORY_POINT=NO
    FUTURE_POSITION_EXTRAPOLATION_ALLOWED=NO
    STALE_CANCELLATION_PRESERVED=SI
    COMPLETION_CANCELLATION_PRESERVED=SI
    RECOVERY_SNAP_PRESERVED=SI

No se añade un watcher, no se hace matching en el teléfono y no se hace
matching sobre la ruta planificada. El matching sólo consume una ventana
reciente del batch que T23 ya aceptó.

## 5. Opciones de arquitectura

### A. Matching en Repartidor

Preserva RAW sólo si el cliente lo envía separado y de forma confiable, pero
expone proveedor/credenciales o requiere lógica duplicada en cada cliente. Es
peor para seguridad, consumo, coherencia entre viewers, cambio de proveedor,
realtime y fallback. El teléfono tendría latencia, batería y disponibilidad
variables, y un cliente manipulado podría fabricar matched coordinates.

Decisión: no recomendado.

### B. Matching en Server/API

Preserva RAW en DB, centraliza autorización, privacidad, validación,
observabilidad y fallback, y permite que todos los Clientes reciban la misma
derivación versionada. Añade una llamada externa por batch y complejidad de
timeout/rate-limit, pero mantiene T23 intacto y deja cambiar proveedor detrás
de una interfaz. El proveedor nunca necesita recibir IDs, pedido, dirección o
datos de actor.

Decisión: recomendado.

### C. Matching en Cliente

Reduce trabajo del servidor, pero hace que cada Cliente pueda renderizar una
geometría distinta, expone el proveedor, dificulta privacidad y permite que
fallas o versiones de mapas diverjan. HTTP fallback y realtime dejarían de
tener una representación común.

Decisión: no recomendado.

### D. Servicio async/separado

Es bueno para preprocesamiento, proveedor aislado, escalado independiente y
cache futuro. No es adecuado como camino crítico inicial: si publica matched
después del RAW para la misma revisión se obtiene doble playback; si usa una
revisión nueva, rompe la semántica de una revisión por batch. Queda reservado
para una futura precomputación, no para la entrega visual inicial.

Decisión: reservado, no camino crítico de R1.

### Recomendación única

    T24_RECOMMENDED_MATCHING_LOCATION=SERVER_API_AFTER_RAW_COMMIT_BEFORE_SINGLE_REALTIME_PUBLISH

Orden recomendado:

    1. validar y persistir RAW + incrementar locationRevision;
    2. intentar matching best-effort con timeout corto;
    3. publicar una sola vez con la misma revisión;
    4. incluir matchedTrajectory sólo si el resultado pasa todas las guardas;
    5. si falla, publicar RAW T23 sin retraso adicional relevante.

## 6. Provider strategy y OSRM

Interfaz conceptual:

    MapMatchingProvider.matchTrajectory(rawPoints, context) ->
      status: matched | rejected | timeout | error
      matchedPoints
      confidence
      metadata

Context puede contener timestamps y accuracies, además de un profile de
transporte, pero no identidad ni dirección textual. Metadata no se expone al
Cliente sin una razón de producto.

El código actual sólo construye llamadas públicas a
https://router.project-osrm.org/route/v1/driving para la navegación del
Repartidor en src/lib/delivery-navigation.ts. No hay /match runtime, adapter
ni configuración de proveedor para T24. El harness T23 usa geometría congelada
derivada de OSRM y nunca llama OSRM durante el replay.

La documentación oficial de OSRM describe
match/v1/{profile}/{coordinates} con timestamps, radiuses, gaps,
geometries=geojson, overview=full, tracepoints, matchings, confidence,
waypoint_index y alternatives_count. También advierte sobre splits por gaps
grandes o transiciones improbables, tracepoints null, outliers y NoMatch.
Fuente: https://project-osrm.org/docs/v5.24.0/api/

    OSRM_MATCH_AVAILABLE_IN_TESTING=UNKNOWN
    PUBLIC_OSRM_ACCEPTABLE_FOR_TESTING=SI_CON_GUARDAS_Y_SOLO_PARA_EVALUACION
    PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO

El endpoint público documentado es técnicamente compatible con el diseño, pero
la disponibilidad operativa desde el runtime de Testing debe validarse después
con timeout, rate-limit y una prueba no productiva. La sonda HTTPS de esta
auditoría no fue concluyente por un error TLS local; no se interpreta como PASS
ni como FAIL del proveedor.

No se debe reutilizar sin más route de navegación como matching: route resuelve
una ruta entre puntos; match intenta explicar una traza GPS y puede devolver
varias sub-traces. Production requiere una decisión separada sobre proveedor
privado, contrato, SLA, costo, límites y atribución.

## 7. Geometría visual y densidad

    RECOMMENDED_VISUAL_GEOMETRY_SOURCE=FULL_ROAD_GEOMETRY_FROM_ACCEPTED_OSRM_MATCHING_SUBTRACE
    MAX_MATCHED_VISUAL_POINTS_PER_BATCH=48_INITIAL_TESTING_LIMIT

No alcanza con usar sólo tracepoints snapped: eso preserva anchors, pero vuelve
a dibujar segmentos rectos entre esquinas. Para curvas y giros se debe usar la
geometría completa matchings[].geometry en GeoJSON LineString, segmentada por
matchings_index/waypoint_index y conservando extremos de la sub-trace elegida.

La reducción debe:

- eliminar duplicados y puntos por debajo de una distancia mínima inicial de
  3–5 m, salvo vértices relevantes;
- conservar inicio, fin, waypoint y vértices con ángulo de giro significativo;
- aplicar simplificación geométrica con tolerancia pequeña sólo entre puntos
  críticos;
- resamplear por longitud de arco cuando aún supere 48 puntos;
- nunca cruzar un gap/split ni unir dos matchings alternativos;
- mantener offsetMs monotónico y una duración total bounded para T23.

48 es un límite inicial de Testing, no una constante final: representa varios
giros en un batch de 12 anchors sin mandar cientos de coordenadas y sigue
siendo bounded para JSON, bridge y rAF. Debe calibrarse midiendo forma,
payload, latencia y playback antes de Production.

## 8. Confianza, snap distance y desvíos

    MAX_ACCEPTABLE_SNAP_DISTANCE_M=30_INITIAL_TESTING_HARD_CAP
    MATCH_ACCEPTANCE_POLICY=provider_ok + complete_single_subtrace + confidence>=0.75_initial + no_null_tracepoints + no_unresolved_alternatives + each_snap_distance<=min(30m,max(15m,2*gps_accuracy)) + plausible_geometry_and_continuity
    MATCH_REJECTION_POLICY=any_failed_guard_or_timeout_or_provider_error => discard_derived_geometry_and_publish_RAW_T23

30 m es sólo un punto de partida para Testing. Debe recalibrarse con GPS
accuracy, entorno urbano y semántica real del proveedor. No se acepta sólo
porque el proveedor respondió HTTP 200. Un punto 80 m dentro de una manzana
debe caer en RAW salvo evidencia futura y explícita que cambie la política.

Guardas mínimas por batch:

- status/code de proveedor y una única sub-trace utilizable;
- confidence inicialmente >= 0.75 y configurable;
- ningún tracepoint nulo u outlier descartado;
- alternatives_count igual a cero en anchors críticos, o rechazo conservador;
- distancia de cada RAW a su snapped candidate dentro de la política;
- accuracies disponibles y no excesivamente malas;
- timestamps monotónicos y sin gaps inesperados;
- geometría finita, ordenada, no vacía, con extremos compatibles;
- velocidad, distancia y dirección plausibles para el intervalo;
- continuidad con el final visual anterior, sin usar la ruta planificada.

Un cambio de calle se resuelve usando principalmente los últimos puntos RAW.
No existe old-route lock. Si la evidencia reciente favorece calle B aunque la
navegación sugiriera calle A, se acepta B sólo si pasa las mismas guardas; si
no, se publica RAW.

## 9. Realtime, versionado y latencia

Extensión propuesta, backward-compatible en semántica:

    {
      "pedidoId": "...",
      "lat": -34.6,
      "lng": -58.4,
      "timestamp": "...",
      "version": 17,
      "trajectory": [{"lat": -34.6, "lng": -58.4, "offsetMs": 0}],
      "matchedTrajectory": [{"lat": -34.6001, "lng": -58.4001, "offsetMs": 0}]
    }

Semántica:

    REALTIME_CONTRACT_EXTENSION_REQUIRED=SI
    BACKWARD_COMPATIBLE=SI_CON_DEPLOY_ORDENADO_DEL_BRIDGE
    MATCHED_TRAJECTORY_OPTIONAL=SI
    MATCHED_TRAJECTORY_DERIVED=SI
    MATCHED_TRAJECTORY_VISUAL_ONLY=SI
    MATCHED_TRAJECTORY_VERSION_POLICY=SAME_LOCATION_REVISION_AS_ACCEPTED_RAW_BATCH

El bridge actual usa validación estricta de campos y debe aceptar y reenviar el
nuevo campo antes de que el productor lo emita. Un Cliente viejo ignorará el
campo opcional y seguirá usando trajectory; no se debe actualizar el productor
antes que el bridge.

La estrategia recomendada es bloquear la publicación realtime sólo durante un
timeout corto después del commit RAW, no publicar RAW y luego matched para la
misma versión:

    MATCHING_TIMEOUT_MS=250_INITIAL_TESTING_VALUE
    LATENCY_STRATEGY=SHORT_BEST_EFFORT_WAIT_THEN_SINGLE_EVENT_RAW_OR_MATCHED

250 ms es inicial para proteger el lag visual certificado de T23; debe medirse
contra p95 del proveedor, cadencia de batches, payload y experiencia física. Si
el provider no responde, el evento RAW sale. Publicar RAW inmediatamente y
corregir después produciría doble playback o un salto; publicar matched tardío
con la misma revisión sería descartado, y con revisión nueva violaría T23.

## 10. Playback Cliente y transición matched/RAW

    CLIENT_VISUAL_TRAJECTORY_SELECTION_POLICY=matchedTrajectory_IF_ACCEPTED_ELSE_RAW_trajectory

El Cliente debe usar:

    visualTrajectory = matchedTrajectory ?? rawTrajectory

Se preservan active + pending bounded, latest-wins por locationRevision, un rAF
por mapa, no extrapolación, stale cancellation, completion cancellation y
recovery snap. El top-level lat/lng sigue siendo RAW; matchedTrajectory sólo
describe lo que se dibuja. El servidor debe asegurar extremos compatibles con
RAW para evitar una corrección visual grande.

Transiciones:

- matched a matched: encolar sólo si la versión es mayor; nunca reproducir dos
  veces el mismo batch;
- matched a RAW: reproducir RAW desde la posición realmente renderizada; si hay
  discontinuidad no plausible, usar recovery snap controlado, no teletransporte
  ordinario;
- RAW a matched: aceptar sólo si el primer punto visual es continuo con el
  final renderizado y todas las guardas pasan; de lo contrario usar RAW;
- stale durante matched: cancelar active y pending como T23; no continuar
  geometría vieja ni extrapolar;
- completion durante matched: cancelar rAF, active y pending; no queda
  movimiento posterior.

La fallback HTTP continúa devolviendo el último punto RAW y su version. No se
recomienda persistir ni recomputar una trayectoria matched histórica para GET.
En caso de realtime caído, Cliente muestra RAW current-point T23; la siguiente
publicación realtime puede retomar visualTrajectory.

    HTTP_FALLBACK_POLICY=LATEST_POINT_RAW_T23
    HTTP_MATCHED_TRAJECTORY_REQUIRED=NO

## 11. Cache

    MATCHING_CACHE_RECOMMENDED=NO_INITIAL_IMPLEMENTATION

No conviene cachear inicialmente: las trazas tienen accuracy, timestamps y
desvíos distintos; una ruta repetida no implica la misma trayectoria; un cache
público agrega riesgo de privacidad y de servir geometría obsoleta. Después de
medir costo, latencia y repetición, podría evaluarse cache privado por
proveedor/data-version y hash de coordenadas cuantizadas, en memoria bounded,
TTL corto y sin IDs/PII. Nunca sería requisito de corrección.

## 12. Seguridad, privacidad y resiliencia

El proveedor recibe únicamente coordenadas necesarias y, cuando el contrato lo
soporte, timestamps/accuracies. No recibe pedidoId, clienteId, negocioId,
nombres, dirección textual, token o cookie.

- La llamada es server-side; el browser no conoce endpoint ni API key.
- No se escriben matched points en Prisma ni en historial.
- Logs sólo registran status, latencia, conteos acotados, confianza y métricas
  agregadas; nunca una trayectoria completa por defecto.
- Se usan secretos de entorno, timeout, abort y rate limits separados.
- Se limita tamaño de input/output y se valida finitud, bounds, orden, distancia
  y número de puntos antes de emitir.
- Timeout, 4xx, 5xx, NoMatch, NoSegment, null tracepoints, split, baja
  confianza o geometría inválida hacen fail-open a RAW T23.
- Un proveedor público no es aprobación de Production: faltan SLA, privacidad,
  atribución, abuso y costo.

## 13. Failure modes y políticas

| Falla | Resultado diseñado |
|---|---|
| Provider timeout / network | Persistencia RAW confirmada; publicación única RAW. |
| Provider 5xx / 4xx / NoMatch | RAW T23; métrica de rechazo/error. |
| Tracepoint null, outlier o split | Rechazar batch visual completo; no unir huecos. |
| Confianza baja o alternativas | RAW. |
| Snap demasiado lejos | RAW; no inventar calle. |
| Geometría no finita, densa o discontinua | RAW; no enviar parcial ambiguo. |
| Calle desviada | Recalcular sobre RAW reciente; no lock a ruta original. |
| Realtime caído | GET latest RAW; no matched histórico persistido. |
| Stale | T23 cancela playback; no matched viejo ni extrapolación. |
| Completion | T23 cancela playback y descarta movimiento posterior. |
| Bridge viejo | Rollout bloqueado hasta actualizar schema/relay. |

## 14. Schema y migraciones

    T24_SCHEMA_CHANGE_REQUIRED=NO
    T24_MIGRATION_REQUIRED=NO
    DB_RAW_POSITION_ONLY=SI

La trayectoria matched es derivada, efímera y visual. Pedido mantiene sólo
current/final RAW point y locationRevision; no se justifica una columna ni tabla
histórica. La extensión realtime es de contrato, no de Prisma.

## 15. Test plan automático futuro

Cada caso debe afirmar RAW preservado, revisión única, selección visual,
fallback y ausencia de IDs sensibles donde corresponda:

1. straight road match;
2. esquina de 90 grados;
3. curva;
4. RAW sparse;
5. GPS accuracy pobre;
6. punto RAW dentro de manzana;
7. timeout del proveedor;
8. provider 5xx;
9. tracepoints nulos;
10. confidence baja;
11. desvío de ruta;
12. múltiples matchings/gap;
13. transición matched a RAW;
14. transición RAW a matched;
15. stale durante matched playback;
16. completion durante matched playback;
17. recovery después de stale;
18. reorder de versiones;
19. HTTP fallback RAW;
20. guard de proveedor Production.

Además: límites de 48 puntos, simplificación que conserve esquinas, payload
bounded, un evento por revisión, timeout abortado, bridge backward-compatible,
privacidad del request y ausencia de persistencia matched.

## 16. Certificación física futura (no ejecutada en A0)

Una prueba por vez, en Testing y con Cliente real observado por el operador:

A. replay determinista de geometría con recta, curva y esquinas;
B. recorrido exterior real con varios giros;
C. desvío deliberado de la ruta planificada;
D. GPS pobre/fallback RAW reproducible de forma segura;
E. stale durante una geometría matched;
F. completion durante playback matched.

Cada fase debe separar evidencia server-side de resultado visual del operador.
No se certifica visualmente en nombre del operador ni se usan fixtures de
Production. Ninguna fase se ejecutó en A0.

## 17. Observabilidad sin datos sensibles

    MATCH_ATTEMPT=counter
    MATCH_ACCEPTED=counter
    MATCH_REJECTED=counter
    MATCH_TIMEOUT=counter
    FALLBACK_RAW=counter
    AVG_MATCH_LATENCY_MS=histogram
    SNAP_DISTANCE_M=histogram
    MATCH_CONFIDENCE=histogram

Etiquetas sólo con entorno, proveedor/version, resultado y motivo acotado. No
se loggea la trayectoria completa en Production ni se incluyen IDs de usuario,
negocio o pedido en labels de alta cardinalidad.

## 18. Archivos tentativos por etapa (no modificados en A0)

    SERVER:
      src/app/api/repartidor/ubicacion/route.ts
      src/lib/map-matching-provider.ts       (nuevo, si se aprueba)
      src/lib/map-matching-policy.ts         (nuevo, si se aprueba)

    REALTIME:
      src/lib/realtime-types.ts
      src/lib/realtime-publish.ts
      mini-services/chat-service/internal-publish-schema.js
      mini-services/chat-service/internal-publish-handler.js
      mini-services/chat-service/index.js

    CLIENT:
      src/components/tracking/delivery-tracking-map.tsx
      src/lib/tracking-playback.ts

    TESTS:
      tests focales de provider/policy/route/realtime/playback y bridge

    PROVIDER ADAPTER:
      adapter OSRM Testing inicialmente; adapter alternativo detrás de la
      misma interfaz, sin acoplar T23 al proveedor.

src/components/repartidor/delivery-navigation.tsx queda fuera del alcance
inicial: DRIVER_NAVIGATION_MAP=NO. Su uso actual de OSRM route no debe
convertirse silenciosamente en T24.

## 19. Split de implementación propuesto

    R1: provider abstraction + pure matching policy + OSRM Testing
        adapter/probe + privacy/contract tests. NO tracking route integration.
    R2: optional matchedTrajectory realtime contract + publisher/types +
        chat bridge schema/relay + backward-compatibility tests. NO producer
        emission yet.
    R3: tracking route server integration after RAW commit, same
        locationRevision, single realtime publish, RAW fallback and metrics.
    R4: Cliente visualTrajectory selection + matched geometry playback +
        matched/RAW transition policies.
    R5: timeout/failure/stale/completion/recovery hardening + full regression.
    R6: controlled replay + exterior physical certification, one phase at a time.

Cada etapa debe conservar el diff exacto, ejecutar tests focales y verificar que
origin/main no se toque. El bridge capaz de aceptar matchedTrajectory debe estar
desplegado y verificado antes de que R3 pueda emitirlo.

## A0.1 Design Hardening

### Accuracy RAW

El contrato actual de trayectoria sólo transporta lat, lng y offsetMs. Para que
T24 pueda usar la precisión real del sensor sin hacerla autoridad, se adopta
esta extensión opcional en el POST de Repartidor:

    {
      lat,
      lng,
      offsetMs,
      accuracy?: number
    }

accuracy representa metros y es opcional para conservar clientes/productores
T23 existentes. Si aparece, el servidor debe exigir número finito, 0 <=
accuracy <= 100 metros, sin NaN, Infinity ni negativos. El máximo 100 m
reutiliza el límite de calidad ya presente en el productor T23 y evita rangos
absurdos; el umbral de aceptación T24 puede ser más conservador. Si falta,
el provider recibe precisión desconocida y la policy no debe fingir una
precisión favorable: ante evidencia insuficiente usa RAW.

La accuracy sólo sirve para policy/provider (por ejemplo, radiuses de OSRM).
No se persiste, no cambia lat/lng RAW y no necesita llegar al Cliente. Antes de
reenviar realtime se debe sanitizar el campo si el contrato visual no lo
requiere; matchedTrajectory nunca contiene accuracy.

    RAW_TRAJECTORY_ACCURACY_EXTENSION_REQUIRED=SI
    RAW_ACCURACY_PERSISTED=NO
    RAW_ACCURACY_REALTIME_REQUIRED=NO
    RAW_ACCURACY_VALIDATION=optional + finite + meters + range 0..100

La extensión es backward-compatible: la ausencia de accuracy mantiene la
semántica T23 y sólo reduce la confianza disponible para T24.

### Timestamps de OSRM Match

OSRM Match acepta timestamps, pero no los exige para poder solicitar matching;
timestamps y radiuses son opciones de la consulta. R1 no debe expandir el
contrato sólo para fabricar epoch a partir del reloj del dispositivo:

    OSRM_MATCH_TIMESTAMPS_REQUIRED_INITIAL=NO

R1 puede enviar radiuses cuando accuracy esté disponible. Si un proveedor
futuro exige epoch, se derivará un eje monotónico server-side con un único
serverReceivedAt del batch y los offsets RAW (serverReceivedAt - maxOffset +
offsetMs), únicamente como input técnico del provider. Nunca se usará para
ordenar, persistir o corregir RAW; locationRevision sigue siendo la autoridad.

### Mapeo temporal de geometría completa

    MATCHED_OFFSET_MAPPING_POLICY=MAP_ANCHORS_THEN_ARCLENGTH_INTERPOLATE_AND_ROUND_MONOTONICALLY
    MATCHED_ANCHOR_TIMES_PRESERVED=SI
    MATCHED_OFFSETS_MONOTONIC_REQUIRED=SI
    OSRM_ROUTE_DURATION_USED_FOR_PLAYBACK=NO

Algoritmo determinista:

1. seleccionar una sola sub-trace aceptada y asociar cada RAW anchor con su
   tracepoint/waypoint correspondiente en orden;
2. proyectar cada anchor sobre la polyline matched, conservando el índice y la
   fracción del segmento; si coincide con un vértice, elegir la ocurrencia
   ordenada que no retroceda;
3. copiar sin cambios el offsetMs de cada anchor RAW/matched;
4. dentro de cada intervalo de anchors, calcular distancia acumulada sobre la
   polyline y asignar a cada vértice intermedio
   round(t_i + (t_next - t_i) * d / D);
5. si D es cero, conservar el tiempo del intervalo y eliminar duplicados
   geométricos; no dividir por cero ni inventar duración;
6. simplificar/resamplear sólo después del mapeo, preservando todos los anchors
   y sus offsets; los puntos sintéticos vuelven a calcularse por distancia de
   arco;
7. deduplicar puntos consecutivos, mantener offsets no decrecientes y limitar
   el resultado a 48 puntos visuales, sin cruzar un split/gap.

Los extremos conservan el primer y último tiempo del batch original. El
redondeo puede producir offsets iguales para puntos distintos; eso es válido y
el playback defensivo de T23 aplica su duración mínima. No se usa duration,
speed ni ETA estimado por OSRM para cambiar la duración visual: el tiempo
visual proviene de los offsets capturados en RAW.

### Rollout y deploy order

La extensión de bridge debe preceder al productor:

    T24_IMPLEMENTATION_SPLIT_FINAL=R1_PROVIDER_POLICY_PROBE;R2_REALTIME_CONTRACT_BRIDGE;R3_SERVER_PRODUCER;R4_CLIENT_PLAYBACK;R5_HARDENING;R6_CONTROLLED_PHYSICAL_CERTIFICATION
    BRIDGE_READY_BEFORE_PRODUCER_EMITS=SI
    T24_SAFE_DEPLOY_ORDER=1 bridge accepts/relays optional matchedTrajectory; 2 verify legacy RAW events; 3 deploy producer that may emit optional field; 4 retain old/raw Client compatibility; 5 enable matched Client consumer

No se debe emitir el campo nuevo desde R3 hasta que el bridge de R2 haya
aceptado y reenviado el schema, y sus tests de eventos RAW legacy hayan pasado.
El Cliente matched se habilita después; un Cliente viejo debe seguir
ignorando el campo opcional.

### Mínimo de puntos RAW

    MIN_RAW_POINTS_FOR_MATCH=3_INITIAL
    SINGLE_POINT_MATCH_ALLOWED=NO
    HEARTBEAT_MATCH_ALLOWED=NO

Una trayectoria ausente nunca se matchea. Un punto es current-point/heartbeat
y queda RAW. Dos puntos tampoco se intentan inicialmente: no aportan evidencia
suficiente para distinguir snap correcto de una calle paralela, y conservar RAW
evita inventar una esquina con un solo segmento. Tres puntos válidos de
movimiento, con al menos dos segmentos no estacionarios, son candidatos; aun
así deben superar confidence, snap distance, continuidad y todas las demás
guardas. Este límite puede recalibrarse con evidencia de Testing, no por
respuesta HTTP 200.

### Independencia de batches y continuidad

    CROSS_BATCH_MATCH_CONTINUITY_POLICY=SERVER_VALIDATES_RAW_ENDPOINTS_AND_CLIENT_CONTINUES_FROM_ACTUAL_RENDERED_POSITION
    MATCHED_STATE_DB_PERSISTENCE_REQUIRED=NO

Cada batch se matchea independientemente sobre RAW reciente. El servidor valida
que los anchors y extremos matched correspondan a ese batch y rechaza una
sub-trace ambigua; no persiste un matched point ni crea una autoridad paralela.
El Cliente conserva la posición realmente renderizada y aplica la transición
matched/RAW ya definida por T23. Si batch 2 propone una calle paralela
incompatible, cae a RAW o a un recovery snap controlado; nunca se fuerza la
calle A previa, se hace route lock o se reproduce hacia atrás.

### Primer gate de R1: probe OSRM Match

    R1_FIRST_GATE=OSRM_TESTING_MATCH_CAPABILITY_PROBE

R1 debe ejecutar una prueba controlada en Testing, sin producto ni Production,
que confirme por separado:

- disponibilidad de /match/v1/driving;
- múltiples puntos y coordenadas lon,lat;
- geometries=geojson y overview=full;
- tracepoints y asociación ordenada;
- confidence y matchings;
- timeout/abort del cliente;
- respuesta NoMatch;
- radiuses derivados de accuracy;
- comportamiento de null tracepoints, gaps/splits y alternativas.

Si el gate falla o el resultado no permite una policy segura, R1 no integra
matching en la tracking route; el camino permanece RAW T23.

### Profile y bounds realtime

    INITIAL_TESTING_MATCH_PROFILE=driving
    MATCH_PROFILE_FUTURE_CONFIGURABLE=SI
    MAX_MATCHED_VISUAL_POINTS_PER_BATCH=48_INITIAL_TESTING_LIMIT
    MAX_MATCHED_REALTIME_PAYLOAD_BYTES=16384_INITIAL_TESTING_LIMIT

driving es sólo el profile inicial por compatibilidad con la navegación actual.
No implica que todos los futuros Repartidores sean auto. El límite de 16 KiB
se aplica al payload realtime serializado que contiene RAW,
matchedTrajectory y envelope; es independiente del límite inbound T23 de 8 KiB.
El provider y el publisher deben rechazar un evento que exceda ese límite antes
de enviarlo al bridge. El límite amplio del body del bridge sólo actúa como
techo de DoS y no reemplaza este límite semántico.

### Garantía de fallback frente a excepciones

    MATCHING_EXCEPTION_CAN_SUPPRESS_RAW_REALTIME=NO

R3 debe inicializar el evento con payload RAW y envolver sólo el intento de
matching en try/catch/finally. Excepción, timeout, JSON inválido, respuesta
malformada o excepción de policy descartan matched y dejan intacta la
publicación RAW. El matching ocurre después del commit RAW; por eso no puede
deshacer la escritura. Sólo el fallo realtime preexistente puede afectar la
entrega realtime, con la misma semántica T23 ya certificada.

## 20. Riesgos abiertos

- Calidad de confidence y radiuses depende del proveedor y su versión de datos;
  el umbral 0.75 es inicial, no probado.
- OSRM puede devolver sub-traces, alternativas, outliers o geometría que no
  corresponda a la intención real del conductor.
- 250 ms y 48 puntos requieren medición de p95, payload y playback físico.
- Geometría matched puede terminar a pocos metros del RAW; continuidad debe
  evitar correcciones visibles sin ocultar el RAW.
- Bridge estricto exige rollout coordinado antes del campo nuevo.
- Proveedor público no tiene aprobación Production ni SLA asumido.
- Últimos metros cerca del domicilio requieren UX física por separación marker/pin.
- Eventos matched no deben crear una segunda autoridad ni revisión paralela.

## 21. Límites T24/T54 y estado final

    T54_ABSORBED=NO
    CAMERA_FOLLOW=NO
    AUTO_RECENTER=NO
    TURN_BY_TURN_CAMERA=NO
    ZOOM_DYNAMIC=NO
    HEADING_DRIVEN_CAMERA=NO

Si en el futuro la geometría permite un heading del marker, queda como mejora
separada y no autoriza cámara, rotación ni navegación turn-by-turn.

    P2_T24_A0_STATUS=AUDITED_DESIGNED
    T24_RECOMMENDED_MATCHING_LOCATION=SERVER_API_AFTER_RAW_COMMIT_BEFORE_SINGLE_REALTIME_PUBLISH
    GPS_RAW_IS_INTERNAL_AUTHORITY=SI
    DB_RAW_POSITION_ONLY=SI
    REALTIME_CONTRACT_EXTENSION_REQUIRED=SI
    RECOMMENDED_VISUAL_GEOMETRY_SOURCE=FULL_ROAD_GEOMETRY_FROM_ACCEPTED_OSRM_MATCHING_SUBTRACE
    CLIENT_VISUAL_TRAJECTORY_SELECTION_POLICY=matchedTrajectory_IF_ACCEPTED_ELSE_RAW_trajectory
    MATCHING_FAILURE_POLICY=FALLBACK_TO_RAW_T23
    ROUTE_LOCKING_ALLOWED=NO
    DESTINATION_MAP_MATCHING=NO
    T24_SCHEMA_CHANGE_REQUIRED=NO
    T24_MIGRATION_REQUIRED=NO
    SOLE_GPS_WATCHER_PRESERVED=SI
    T23_BEHAVIOR_PRESERVED=SI
    T54_ABSORBED=NO
    PUBLIC_OSRM_ACCEPTABLE_FOR_TESTING=SI_CON_GUARDAS_Y_SOLO_PARA_EVALUACION
    PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO
    P2_T24_READY_FOR_IMPLEMENTATION=SI
    P2_T24_A0_1_STATUS=HARDENED_READY_FOR_R1
    RAW_TRAJECTORY_ACCURACY_EXTENSION_REQUIRED=SI
    RAW_ACCURACY_PERSISTED=NO
    OSRM_MATCH_TIMESTAMPS_REQUIRED_INITIAL=NO
    MATCHED_OFFSET_MAPPING_POLICY=MAP_ANCHORS_THEN_ARCLENGTH_INTERPOLATE_AND_ROUND_MONOTONICALLY
    MATCHED_ANCHOR_TIMES_PRESERVED=SI
    OSRM_ROUTE_DURATION_USED_FOR_PLAYBACK=NO
    MIN_RAW_POINTS_FOR_MATCH=3_INITIAL
    SINGLE_POINT_MATCH_ALLOWED=NO
    HEARTBEAT_MATCH_ALLOWED=NO
    CROSS_BATCH_MATCH_CONTINUITY_POLICY=SERVER_VALIDATES_RAW_ENDPOINTS_AND_CLIENT_CONTINUES_FROM_ACTUAL_RENDERED_POSITION
    MATCHED_STATE_DB_PERSISTENCE_REQUIRED=NO
    T24_IMPLEMENTATION_SPLIT_FINAL=R1_PROVIDER_POLICY_PROBE;R2_REALTIME_CONTRACT_BRIDGE;R3_SERVER_PRODUCER;R4_CLIENT_PLAYBACK;R5_HARDENING;R6_CONTROLLED_PHYSICAL_CERTIFICATION
    BRIDGE_READY_BEFORE_PRODUCER_EMITS=SI
    R1_FIRST_GATE=OSRM_TESTING_MATCH_CAPABILITY_PROBE
    INITIAL_TESTING_MATCH_PROFILE=driving
    MATCH_PROFILE_FUTURE_CONFIGURABLE=SI
    MAX_MATCHED_REALTIME_PAYLOAD_BYTES=16384_INITIAL_TESTING_LIMIT
    MATCHING_EXCEPTION_CAN_SUPPRESS_RAW_REALTIME=NO
    P2_T24_READY_FOR_R1=SI
    NEXT_ACTION=IMPLEMENT_P2_T24_R1_PROVIDER_ABSTRACTION_AND_TESTING_MATCH_CAPABILITY_PROBE
    PRODUCTION_TOUCHED=NO
    PRODUCTION_PROMOTION_AUTHORIZED=NO

T24 queda diseñado para implementación posterior, no implementado. No se
inicia T54 ni se realizan fixtures, deploy, pruebas físicas o cambios de
Production en A0.
