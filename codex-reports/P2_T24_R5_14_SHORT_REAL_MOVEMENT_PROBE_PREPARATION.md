# P2-T24-R5.14 — Short real movement probe preparation

## Alcance

Preparación Testing-only para un probe físico corto en foreground. Esta fase
no inicia tracking, no genera GPS sintético, no ejecuta replay, no hace
cleanup y no cambia el comportamiento del producto.

```text
P2_T24_R5_14_STATUS=READY_FOR_OPERATOR_SHORT_PROBE
P2_T24_R5_13_STATUS=IMPLEMENTED_TESTING_DEPLOYED_READY_FOR_SHORT_INSTRUMENTED_PROBE
P2_T24_READY_FOR_R6=NO
P2_T24_RELEASE_ELIGIBLE=NO
P2_T23_FORMALLY_REOPENED=NO
P2_T23_DIAGNOSTIC_HARDENING_ACTIVE=SI
STEPWISE_BEHAVIOR_IS_T24_MATCHING_BUG=NO
PRODUCTION_TOUCHED=NO
```

## Testing deployment

```text
CURRENT_HEAD=b4c851e3d9f302c9543bb47d9726db8f012c2e65
REMOTE_TESTING_SHA=b4c851e3d9f302c9543bb47d9726db8f012c2e65
R5_13_COMMIT_SHA=b4c851e3d9f302c9543bb47d9726db8f012c2e65
DELIGO_TESTING_DEPLOYMENT_ID=e7d3881f-e89f-4e44-8173-2ec3643466e1
DELIGO_TESTING_DEPLOYMENT_COMMIT=b4c851e3d9f302c9543bb47d9726db8f012c2e65
DELIGO_TESTING_DEPLOYMENT_STATUS=SUCCESS
R5_13_DEPLOY_CONTAINS_INSTRUMENTATION=SI
```

## Single-flight disposition

El test preexistente es `T24 — HTTP single-flight > T24: a newer sample
arriving while a POST is in flight is queued as pending, not a second
concurrent POST — sent automatically once the first resolves`, en
`src/hooks/use-repartidor-tracking.test.ts:750`. La ejecución actual fue
`90 pass / 1 fail`; el fallo fue `pendingSendTimerCount()` esperado 1 y
recibido 0. La línea y el escenario pertenecen al contrato de scheduler
preexistente; R5.13 sólo agrega side-channel witness y preserva la lógica de
tracking. No se modifica en R5.14.

```text
SINGLE_FLIGHT_FAILING_TEST=T24 — HTTP single-flight — pending timer after first POST resolves
SINGLE_FLIGHT_FAILURE_PREEXISTING_EVIDENCE=src/hooks/use-repartidor-tracking.test.ts:750; 90 pass / 1 fail
SINGLE_FLIGHT_FAILURE_RELATED_TO_R5_13=NO
SINGLE_FLIGHT_FAILURE_PROBE_BLOCKER=NO
```

## Fixture y baseline

```text
FIXTURE_PREFIX=TEST_T24_PHYSICAL_
ORDER_ID=cmu1p548z0006riv8ntyibf0w
BUSINESS_NAME=TEST_T24_PHYSICAL_NEGOCIO_9E1BB8B9
CLIENT_ID=cmu1p53250001riv8mvgnmle1
DRIVER_ID=cmu1p53gj0002riv8n87myyqz
FIXTURE_PRESENT=SI
ORDER_STATE=en_camino
ORDER_METHOD=domicilio
DRIVER_ASSIGNED=SI
TRACKING_ENABLED=SI
BUSINESS_TRACKING_ACTIVE=SI
PROBE_BASELINE_REVISION=89
PROBE_WITNESS_WINDOW_READY=SI
WITNESS_WINDOW_BOUNDARY=POST_PREPARATION_EVENTS_UNTIL_OPERATOR_FINALIZADO
```

La revisión 89 y el pedido se preservan. No se resetearon `locationRevision`,
la posición RAW, el pedido ni el estado de tracking. Las contraseñas de las
dos cuentas existentes fueron renovadas en Testing con el mismo formato de
hash PBKDF2 v2 del producto y validadas mediante el login HTTP normal; los
valores se entregan únicamente en runtime y no se almacenan aquí.

## Witness disponible

```text
GPS_CALLBACK_WITNESS_READY=SI
MOVEMENT_DECISION_WITNESS_READY=SI
THROTTLE_WITNESS_READY=SI
BUFFER_BATCH_WITNESS_READY=SI
POST_CORRELATION_READY=SI
CLIENT_LIFECYCLE_WITNESS_READY=SI
CLIENT_REALTIME_WITNESS_READY=SI
CLIENT_PLAYBACK_WITNESS_READY=SI
SOURCE_LABEL_VALUES=MATCHED,RAW,LOCATION_ONLY
```

## Comportamiento preservado

```text
WATCHPOSITION_OPTIONS_CHANGED=NO
MOVEMENT_THRESHOLD_CHANGED=NO
MIN_SEND_INTERVAL_CHANGED=NO
BATCH_POLICY_CHANGED=NO
PLAYBACK_POLICY_CHANGED=NO
REALTIME_BEHAVIOR_CHANGED=NO
MATCHING_POLICY_CHANGED=NO
DB_SCHEMA_CHANGED=NO
PRISMA_MIGRATION_CREATED=NO
PHYSICAL_PROBE_EXECUTED=NO
BACKGROUND_TEST_EXECUTED=NO
PHYSICAL_FIXTURE_CLEANUP=DEFERRED_FOR_FUTURE_INSTRUMENTED_PROBE
```

## Instrucciones al operador

1. Abrir el Cliente Testing y dejar el mapa del pedido activo visible en otro
   dispositivo si está disponible.
2. Abrir el Repartidor Testing e iniciar tracking manualmente.
3. Permanecer detenido 30–60 segundos.
4. Caminar de forma continua 3–5 minutos, sin zigzag artificial ni correr.
5. Permanecer detenido 30–60 segundos más.
6. Responder `FINALIZADO` sin cerrar tracking antes de esa respuesta.

No bloquear pantalla, no cambiar de aplicación intencionalmente, no iniciar
background test y no realizar ninguna acción adicional sobre el pedido.

```text
NEXT_ACTION=WAIT_FOR_OPERATOR_SHORT_WALK
```
