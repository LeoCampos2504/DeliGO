# P2-T24-R5.15 — Short probe root-cause analysis

## Resultado

El operador reportó `SALTOS` y un freeze recuperable mediante la acción de
recargar la ubicación. Esa observación queda aceptada como evidencia humana,
pero la ventana técnica posterior al baseline `89` no tiene witness server-side
observable para el pedido `cmu1p548z0006riv8ntyibf0w`.

```text
P2_T24_R5_14_STATUS=ANALYZED_OPERATOR_REPORT_TECHNICAL_WITNESS_UNAVAILABLE
PROBE_BASELINE_REVISION=89
PROBE_LAST_REVISION=89
PROBE_TOTAL_SERVER_WRITES=0_OBSERVED_FOR_ORDER_AFTER_BASELINE
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
PRODUCTION_TOUCHED=NO
```

## Evidencia delimitada

La base Testing conserva el pedido en `en_camino`, con repartidor asignado,
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
NEXT_ACTION=ROOT_CAUSE_FIX_DESIGN_REQUIRES_NEW_INSTRUMENTED_PROBE_OR_PERSISTED_WITNESS
```
