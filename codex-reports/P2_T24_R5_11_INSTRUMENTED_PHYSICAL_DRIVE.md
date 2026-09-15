# P2-T24-R5.11 — Instrumented real GPS physical drive preparation

Esta etapa prepara una segunda prueba física real en Testing. No ejecuta el
tracking, no genera movimiento sintético y no cambia el estado formal de T24.

## Estado formal preservado

```text
P2_T24_STATUS=IMPLEMENTED_PARTIALLY_TESTING_BLOCKED_NOT_RELEASE_ELIGIBLE
P2_T24_R5_STATUS=BLOCKED_TESTING_PROVIDER_DATASET
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
DB_RAW_POSITION_ONLY=SI
DB_MATCHED_DATA_PERSISTED=NO
PRODUCTION_TOUCHED=NO
```

## Reconciliación Testing

```text
TESTING_DEPLOYMENT_ID=35148f55-6240-4d4e-9b04-074492d18709
TESTING_DEPLOYMENT_COMMIT=e625846a58a14dd9635041ab27034b6ef44e1160
TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
T24_CODE_PRESENT_IN_DEPLOY=SI
T24_INSTRUMENTATION_SCOPE=TESTING_ONLY_PHYSICAL_FIXTURE_ORDER
TESTING_LOGIN_HTTP_STATUS=200
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
```

El commit contiene instrumentación observacional temporal para el producer
RAW/provider/policy/realtime y para el Cliente playback. El canal de witness
no escribe DB, no altera decisiones, no modifica coordenadas ni cambia la
política de playback. Se habilitó sólo en Testing para el pedido físico.

## Fixture físico reutilizado

```text
PHYSICAL_FIXTURE_PREFIX=TEST_T24_PHYSICAL_
PHYSICAL_FIXTURE_REUSED=SI
BUSINESS_NAME=TEST_T24_PHYSICAL_NEGOCIO_9E1BB8B9
BUSINESS_ID=cmu1p52mo0000riv85gocmeuz
CLIENT_ID=cmu1p53250001riv8mvgnmle1
DRIVER_ID=cmu1p53gj0002riv8n87myyqz
ORDER_ID=cmu1p548z0006riv8ntyibf0w
ORDER_STATE=en_camino
ORDER_METHOD=domicilio
DRIVER_ASSIGNED=SI
TRACKING_ENABLED=SI
BUSINESS_TRACKING_ACTIVE=SI
LOCATION_REVISION_BEFORE_RUN=48
```

El pedido, Cliente y Repartidor existentes están activos y el negocio está
aprobado, con delivery y seguimiento habilitados. Las credenciales renovadas
son runtime-only y no se persisten aquí.

## Witness preparado antes del movimiento

```text
SERVER_WITNESS_READY=SI
PROVIDER_WITNESS_READY=SI
REALTIME_WITNESS_READY=SI
CLIENT_WITNESS_READY=SI
CLIENT_WITNESS_CHANNEL=/api/testing/t24-physical-witness
CORRELATION_KEY=ORDER_ID_PLUS_LOCATION_REVISION
SYNTHETIC_TRACKING_POSTS=0
TRACKING_STARTED_BEFORE_WITNESS=NO
```

El server witness registra, sólo en logs Testing y sin cookies, tokens ni
credenciales: commit RAW, revisión, cantidad de puntos, intento/latencia/
resultado del provider, confidence, decisión/rechazo de policy, presencia y
cantidad de matchedTrajectory y publicación realtime. El Cliente reporta
recepción HTTP/realtime, fuente MATCHED/RAW, revisión, aceptación de playback,
estado de cola y snaps de recuperación.

## Destino y gate de seguridad

```text
ORDER_DESTINATION_ALIGNMENT=PENDING_OPERATOR_ROUTE_POINT
ORDER_DESTINATION_LAT=RUNTIME_ONLY_PENDING_ALIGNMENT
ORDER_DESTINATION_LNG=RUNTIME_ONLY_PENDING_ALIGNMENT
P2_T24_PHYSICAL2_STATUS=BLOCKED_PENDING_DESTINATION_ALIGNMENT
READY_TO_DRIVE=NO
```

No se inventa una alineación: el operador debe indicar un punto real y seguro
del trayecto que efectivamente recorrerá. Recién después se actualiza el
destino antes de activar tracking.

## Observación operativa pendiente

Cuando el destino esté alineado, la secuencia será: witness confirmado,
Cliente y Repartidor listos, activar tracking, dejar el teléfono fijo y no
interactuar mientras se conduce. Si hay acompañante, sólo observará si el
marker avanza suave, si se desvía en una recta/curva/intersección o detenido,
si se autocorrige y si el tracking desaparece o se congela.

```text
T44_TOUCHED_BY_T24_TEST=NO
NEXT_ACTION=PROVIDE_REAL_SAFE_ROUTE_DESTINATION_THEN_ALIGN_BEFORE_DRIVE
```
