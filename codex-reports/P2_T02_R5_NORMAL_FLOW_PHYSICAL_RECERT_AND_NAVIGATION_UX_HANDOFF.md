# P2-T02-R5 — normal flow physical recertification + navigation UX handoff

Fecha: 2026-09-12. Tipo: documentation-only. Esta entrada consolida la
evidencia física reportada por el operador después de R4 y reconcilia el
backlog sin modificar producto, tests, Prisma, DB, Railway ni Production.

## Autoridad de R4

La recertificación se realizó sobre el flujo real con una cuenta Repartidor
normal y un pedido normal. El runtime esperado es el commit R4 desplegado en
Testing:

```text
R4_COMMIT=b0112d53c0b8e0cf8db1868ccf6f666070b39b39
R4_TESTING_DEPLOYMENT_ID=97b0923a-5d9d-4bca-b23e-3465dc358817
R4_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
R4_TESTING_DEPLOYMENT_COMMIT_MATCH=YES
```

Evidencia física aceptada exactamente como reportada:

```text
R4_NORMAL_DRIVER_ACCOUNT_USED=SI
R4_NORMAL_ORDER_FLOW_USED=SI
R4_FIXTURE_ACCOUNT_USED=NO
R4_NORMAL_ACCEPT_FLOW=PASS
R4_DRIVER_GPS_NOW_WORKS=PASS
R4_IN_APP_NAVIGATION_OPENS=PASS
R4_IN_APP_ROUTE_RENDERED=PASS
R4_FIXTURE_PARITY_FINDING=RESOLVED_FOR_NORMAL_ACCEPT_FLOW
P2_T02_R4_STATUS=PHYSICALLY_CERTIFIED_NORMAL_FLOW
R4_NORMAL_FLOW_FIX=PASS
R4_ROOT_CAUSE=CLOSED_FOR_NORMAL_ACCEPT_FLOW
```

Google Maps externo no se usa como evidencia de GPS del Repartidor; la
certificación se basa en el flujo normal y la navegación in-app.

## Gates T02 que permanecen abiertos

No se inventa PASS para evidencia que no fue reportada como completada:

```text
BELOW_THRESHOLD_MOVEMENT=PENDING_EXTERIOR
ABOVE_THRESHOLD_MOVEMENT=PENDING_EXTERIOR
REAL_ROUTE_100_300M=PENDING_EXTERIOR
CLIENT_MARKER_MOVEMENT=PENDING_EXTERIOR
CURVE_CORNER_T24=PENDING_EXTERIOR
BACKGROUND_WITH_REAL_SIGNIFICANT_MOVEMENT=PENDING_EXTERIOR_CONFIRMATION
TRACKING_STOPS_AFTER_DELIVERY=NOT_TESTED_YET
POST_COMPLETION_TRACKING_EVENTS=NOT_TESTED_YET
ANDROID_B3_PHYSICAL=PENDING_DEVICE_AVAILABILITY
ANDROID_B4_PHYSICAL=PENDING_DEVICE_AVAILABILITY
TEST_T02_ORDER_LEFT_ACTIVE=SI
P2_T02_STATUS=WAITING_FOR_REMAINING_EXTERIOR_AND_COMPLETION_PHYSICAL_EVIDENCE
NEXT_ACTION=COMPLETE_P2_T02_PHYSICAL_GATES
```

El cierre físico de R4 es específico del flujo normal y no equivale al cierre
global de T02.

## Requisito UX nuevo

El estado actual observado es una vista de ruta completa/overview, con mapa
mayormente cenital y sin seguimiento continuo del vehículo. La ausencia de
follow camera, orientación hacia adelante y rotación útil por heading-up no es
un bug de R4; queda registrada como requisito de producto nuevo:

```text
CURRENT_REPARTIDOR_NAVIGATION=ROUTE_OVERVIEW
NAVIGATION_GOOGLE_MAPS_LIKE_FOLLOW_MODE=NEW_PRODUCT_UX_REQUIREMENT
DELIGO_DRIVER_NAVIGATION_TARGET=GOOGLE_MAPS_LIKE_IN_APP_FOLLOW_MODE
FOLLOW_CAMERA_REQUIRED=SI
RECENTER_REQUIRED=SI
DRIVER_HEADING_REQUIRED=SI
MAP_BEARING_DESIRED=SI
FALLBACK=SI
PRIMARY_NAVIGATION_TARGET=DELIGO_IN_APP
```

El objetivo futuro incluye cámara suave con el Repartidor por debajo del
centro, heading estable sin ruido, bearing/heading-up si es viable, recenter
después de interacción manual y prioridad visual para posición actual, tramo
inmediato, próxima maniobra, distancia, ETA y destino. Debe evitarse un
`fitBounds` permanente y minimizarse la interacción durante la conducción.

## Invariantes y renderer audit

```text
ONE_DEVICE_GEOLOCATION_WATCHER_AUTHORITY=SI
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
CURRENT_MAP_RENDERER=LEAFLET_1_9_4
CURRENT_TILE_PROVIDER=OPENSTREETMAP
CURRENT_ROUTING_PROVIDER_TESTING=OSRM_PUBLIC
CURRENT_ROUTE_SOURCE=OSRM_GEOJSON
CURRENT_ROUTE_RECALC_POLICY=INITIAL_THEN_AFTER_30S_AND_100M_OR_120S_MAX
NAV_RENDERER_DECISION_REQUIRED=SI
OPTION_A=KEEP_LEAFLET
OPTION_B=MAPLIBRE_GL_FOR_DRIVER_NAVIGATION
```

`useRepartidorTracking` sigue siendo la única autoridad GPS; la navegación
consume `latestPosition` de forma read-only. No se cambia el proveedor de
tiles, el routing ni la política de recálculo en esta tarea.

La recomendación técnica preliminar para T54 es evaluar primero MapLibre GL
para la navegación del Repartidor, porque ofrece primitivas nativas de
bearing, camera easing, heading-up, pitch y rotación de marker que reducen
workarounds para follow mode. Leaflet queda válido para el runtime actual y
no se migra ahora; la decisión final debe incluir bundle/performance móvil,
PWA Android+iOS, compatibilidad OSM y complejidad de migración.

## Ownership audit: T23, T24 y nueva tarea

T23 depende de T02 y cubre trayectoria, batching, playback suave e
interpolación del marcador. Por eso absorbe sólo el subalcance de movimiento
visual y derivación de heading asociada al marker, no la UX completa de cámara.

T24 depende de T23 y queda relacionado con map matching, posición restringida a
calle y comportamiento en curvas/esquinas. No se expande automáticamente.

La cámara follow/recenter/bearing, la interacción manual, el contrato de
seguridad y la decisión de renderer forman una superficie coherente pero más
amplia. La auditoría completa del backlog no encontró colisión para el
siguiente ID, por lo que se formaliza sin implementación:

```text
T23_NAVIGATION_FOLLOW_SCOPE=PARTIAL
T23_NAVIGATION_FOLLOW_SCOPE_JUSTIFICATION=T23 absorbe trayectoria, batching, playback e interpolación suave del marcador; la cámara follow/recenter/bearing y la UX de conducción requieren una tarea propia
T24_NAVIGATION_MAP_MATCHING_SCOPE=CONFIRMED_RELATED
DRIVER_NAVIGATION_UX_TASK_REQUIRED=SI
DRIVER_NAVIGATION_UX_TASK_ID=P2-T54
DRIVER_NAVIGATION_UX_TASK_TITLE=Driver Turn-by-Turn Follow Camera UX
NEXT_FREE_TASK_ID_AUDIT=P2-T54_VERIFIED_NO_COLLISION_FOUND
P2_T54_STATUS=FUTURE_AFTER_T02_T23_T24
```

T54 queda bloqueada por T02→T23→T24 y no se inicia en R5.

## Inmutabilidad y handoff

```text
P2_T43_STATUS_UNCHANGED=SI
PRODUCT_FILES_CHANGED=0
TEST_FILES_CHANGED=0
PRISMA_FILES_CHANGED=0
MIGRATION_FILES_CHANGED=0
DATABASE_CHANGED=NO
FUNCTIONAL_TREE_CHANGED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

Se actualizan únicamente las autoridades documentales y este reporte. No se
modifica `COMPLETED_TASKS.md`, porque T02 global continúa abierto.
