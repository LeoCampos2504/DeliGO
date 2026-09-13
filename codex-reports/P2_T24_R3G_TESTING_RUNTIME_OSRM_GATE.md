# P2-T24-R3G — Testing runtime OSRM Match capability and policy gate

## Alcance y autoridad

R3G.1 reparó únicamente la ruta operativa de ejecución y la sonda de testing.
No se integró tracking, no se emitió `matchedTrajectory`, no se modificó el
Cliente, DB, Prisma, migraciones ni Production.

La sonda utilizada fue exclusivamente:

```text
scripts/testing/t24-osrm-match-probe.ts
```

Guards y configuración efectiva:

```text
DELIGO_ENVIRONMENT=TESTING
NODE_ENV=test
MAP_MATCHING_PROVIDER=osrm
T24_OSRM_BASE_URL=https://router.project-osrm.org
PROFILE=driving
PROBE_TRACE_POINTS=3_SYNTHETIC
PROBE_PII_SENT=NO
```

El cambio de harness fue mínimo: se agregó `--timeout-ms`, con validación
estricta de rango `100..1000`. El default existente permanece en `250 ms`.

## Clasificación del bloqueo anterior

El intento previo no fue una petición OSRM observable. Railway SSH permitió
inspeccionar `/app`, pero la sesión no entregó stdout ni estado de terminación
para la sonda; una ejecución posterior mostró además que el contenedor
`DeliGO Copy` no tenía `bun` disponible en PATH. No se interpreta como
indisponibilidad de OSRM.

```text
PREVIOUS_RUNTIME_ATTEMPT_COUNT=0
PREVIOUS_FAILURE_OWNER=RUNTIME_EXECUTION_PATH
OSRM_FAILURE_CONFIRMED=NO
AVAILABLE_REMOTE_EXECUTION_METHODS=RAILWAY_SSH_COMMAND_EXECUTION
```

## Ruta controlada reparada

La CLI confirmó que `railway run` y `railway shell` ejecutan localmente. El
comando remoto soportado fue `railway ssh ... -- <command>`, pero se descartó
para este gate cuando no permitió observabilidad consistente. No existía en la
CLI un job one-off con comando arbitrario. Se creó un worker temporal
Testing-only desde el repo `LeoCampos2504/DeliGO`, branch `testing-codex`, con
start command exclusivo de la sonda y `restartPolicyType=NEVER`. Su proceso
terminó y sus logs finales fueron consultables con `railway logs`; no tuvo
listener HTTP ni dominio público.

```text
EXECUTION_PATH_TYPE=TEMP_TESTING_WORKER
PROBE_EXECUTION_ENVIRONMENT=TESTING_RAILWAY_RUNTIME
RAILWAY_PROJECT=amiable-rejoicing
RAILWAY_ENVIRONMENT=TESTING
RAILWAY_WORKER_COMMIT=a0fa2159aadb537b9e4c31a23ebc92ac049a56c6
REMOTE_STDOUT_OBSERVED=SI
REMOTE_STDERR_OBSERVED=SI
REMOTE_EXIT_STATUS_OBSERVED=SI
TEMP_RUNTIME_RESOURCE_CREATED=SI
TEMP_RUNTIME_RESOURCE_CLEANED=SI
```

La primera corrida observable fue rechazada por la guardia real con
`NODE_ENV=production`; se corrigió sólo la variable del worker a `NODE_ENV=test`.
No fue una falla OSRM.

## Capability y radiuses

Las tres corridas finales pasaron por la cadena completa:

```text
t24-osrm-match-probe
→ osrm-map-matching-provider
→ OSRM
→ parser
```

Evidencia común en los tres logs finales:

```text
OSRM_MATCH_RESULT_STATUS=matched
OSRM_MATCH_HTTP_AND_CODE=PASS
OSRM_MATCH_VALID_TRACE=PASS
OSRM_MATCH_RADIUSES=PASS
OSRM_MATCH_TRACEPOINTS=3
OSRM_MATCHINGS=1
OSRM_MATCH_CONFIDENCE=0.08696172159
OSRM_MATCH_GEOMETRY=FULL_GEOJSON
```

`OSRM_MATCH_HTTP_STATUS=2xx` se deduce de `Response.ok` en el adapter; el
provider code procesado fue `Ok`, condición necesaria para el resultado
`matched`. No se alteró el adapter productivo para exponer metadata adicional.

```text
OSRM_MATCH_HTTP_STATUS=2xx
OSRM_MATCH_PROVIDER_CODE=Ok
OSRM_MATCH_TRACEPOINT_COUNT=3
OSRM_MATCH_MATCHING_COUNT=1
OSRM_MATCH_CONFIDENCE=0.08696172159
OSRM_MATCH_GEOMETRY_PRESENT=SI
OSRM_MATCH_VALID_TRACE=PASS
OSRM_MATCH_RADIUSES=PASS
```

No se ejecutó un caso público de `NoMatch`; los caminos `NoMatch` y abort/
timeout ya están cubiertos por tests deterministas del adapter.

```text
OSRM_MATCH_NOMATCH_RUNTIME_PROBE=NOT_REQUIRED_FOR_R3_GATE
```

## Latencia

Se ejecutaron tres requests válidos secuenciales, sin paralelismo ni carga:

```text
CAPABILITY_PROBE_TIMEOUT_MS=1000
ATTEMPT_1_LATENCY_MS=635
ATTEMPT_2_LATENCY_MS=588
ATTEMPT_3_LATENCY_MS=609
ATTEMPT_COUNT=3
MIN_LATENCY_MS=588
MEDIAN_LATENCY_MS=609
MAX_LATENCY_MS=635
```

El timeout inicial de Testing recomendado es `1000 ms`: deja `365 ms` sobre
el máximo observado, permanece dentro del límite R3 y conserva el fallback
RAW si el matching best-effort expira. El `250 ms` sólo sigue siendo el
default actual de la sonda, no un timeout aprobado por esta medición.

```text
CURRENT_PROBE_DEFAULT_TIMEOUT_MS=250
R3_MATCHING_TIMEOUT_INITIAL_TESTING_MS=1000
R3_MATCHING_TIMEOUT_PRODUCTION=UNDECIDED
RUNTIME_FAILURE_LAYER=NONE_FINAL_PASS
```

## Gate R3G.1 histórico

El gate siguiente documenta únicamente el resultado provider-level de R3G.1;
queda supersedido como decisión de preparación para R3 por la reconciliación
R3G.2 al final de este reporte.

```text
P2_T24_R3G_1_STATUS=PASS
OSRM_MATCH_AVAILABLE_IN_TESTING=SI
R3_PROVIDER_CAPABILITY_GATE=PASS
P2_T24_R3G_1_READY_FOR_R3=SI
PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO
PRODUCTION_TOUCHED=NO
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
NEXT_ACTION=SUPERSEDED_BY_P2_T24_R3G_2_POLICY_GATE
```

Este PASS sólo certifica capability y latencia del provider en Testing. No
autoriza integración R3, cambios de tracking, matched trajectory en realtime,
pruebas físicas ni promoción a Production.

## R3G.2 — evaluación de política en runtime Testing

R3G.2 ejecutó como máximo las tres variantes sintéticas autorizadas usando la
sonda existente `scripts/testing/t24-osrm-match-probe.ts`. La sonda recorrió el
adapter OSRM, su parser, la geometría y `evaluateMapMatching`, con el umbral R1
sin cambios:

```text
P2_T24_R3G_2_STATUS=BLOCKED
PROVIDER_CAPABILITY_GATE=PASS
POLICY_ACCEPTANCE_GATE=BLOCKED
PREVIOUS_MATCH_CONFIDENCE=0.08696172159
PREVIOUS_POLICY_DECISION=REJECT_MATCH
PREVIOUS_POLICY_REJECTION_REASON=low_confidence
PROBE_CURRENT_POLICY_STAGE=ADAPTER_PARSER_GEOMETRY_AND_EVALUATE_MAP_MATCHING
RUNTIME_POLICY_ACCEPTED_MATCH_AVAILABLE=NO
INITIAL_CONFIDENCE_THRESHOLD=0.75
R3_MATCHING_TIMEOUT_INITIAL_TESTING_MS=1000
```

### Runtime y procedencia

```text
PROBE_EXECUTION_ENVIRONMENT=TESTING_RAILWAY_RUNTIME
EXECUTION_PATH_TYPE=TEMP_TESTING_WORKER
DELIGO_ENVIRONMENT=TESTING
NODE_ENV=test
MAP_MATCHING_PROVIDER=osrm
T24_OSRM_BASE_URL=https://router.project-osrm.org
PROFILE=driving
POLICY_PROBE_TRACE_SOURCE=PUBLIC_OSRM_ROUTE_GEOMETRY_DERIVED_SYNTHETIC_BERLIN_COORDINATES
PROBE_PII_SENT=NO
REMOTE_STDOUT_OBSERVED=SI
REMOTE_STDERR_OBSERVED=SI
REMOTE_EXIT_STATUS_OBSERVED=SI
TEMP_RUNTIME_RESOURCE_CREATED=SI
TEMP_RUNTIME_RESOURCE_CLEANED=SI
```

El worker temporal no tuvo listener HTTP ni dominio público. Fue eliminado
después de consultar los logs de la tercera ejecución.

### Resultados de las tres variantes

```text
VARIANT_1_TRACE_POINTS=4
VARIANT_1_ACCURACY_METERS=10
VARIANT_1_OSRM_RESULT_STATUS=matched
VARIANT_1_OSRM_MATCH_TRACEPOINTS=4
VARIANT_1_OSRM_MATCHINGS=1
VARIANT_1_OSRM_MATCH_CONFIDENCE=0.7012156344
VARIANT_1_OSRM_MATCH_RADIUSES=PASS
VARIANT_1_POLICY_DECISION=REJECT_MATCH
VARIANT_1_POLICY_REJECTION_REASON=low_confidence
VARIANT_1_LATENCY_MS=524

VARIANT_2_TRACE_POINTS=3
VARIANT_2_ACCURACY_METERS=5
VARIANT_2_OSRM_RESULT_STATUS=matched
VARIANT_2_OSRM_MATCH_TRACEPOINTS=3
VARIANT_2_OSRM_MATCHINGS=1
VARIANT_2_OSRM_MATCH_CONFIDENCE=0.0005587724933
VARIANT_2_OSRM_MATCH_RADIUSES=PASS
VARIANT_2_POLICY_DECISION=REJECT_MATCH
VARIANT_2_POLICY_REJECTION_REASON=low_confidence
VARIANT_2_LATENCY_MS=496

VARIANT_3_TRACE_POINTS=6
VARIANT_3_ACCURACY_METERS=5
VARIANT_3_OSRM_RESULT_STATUS=matched
VARIANT_3_OSRM_HTTP_AND_CODE=PASS
VARIANT_3_OSRM_VALID_TRACE=PASS
VARIANT_3_OSRM_MATCH_RADIUSES=PASS
VARIANT_3_OSRM_MATCH_TRACEPOINTS=6
VARIANT_3_OSRM_MATCHINGS=1
VARIANT_3_OSRM_MATCH_CONFIDENCE=0.9787074735
VARIANT_3_OSRM_GEOMETRY=FULL_GEOJSON
VARIANT_3_POLICY_DECISION=REJECT_MATCH
VARIANT_3_POLICY_REJECTION_REASON=ambiguous_tracepoints
VARIANT_3_SNAP_DISTANCE_GUARDS=NOT_EVALUATED
VARIANT_3_TRACEPOINT_GUARDS=NOT_EVALUATED
VARIANT_3_CONFIDENCE_GUARD=NOT_EVALUATED
VARIANT_3_ALTERNATIVES_GUARD=FAIL
VARIANT_3_SINGLE_SUBTRACE_GUARD=NOT_EVALUATED
VARIANT_3_LATENCY_MS=515
VARIANT_3_TIMEOUT_MS=1000
```

La tercera variante superó el umbral de confianza, pero fue rechazada por la
guardia de alternativas/trazabilidad (`ambiguous_tracepoints`). Por lo tanto,
no existe un match aceptado por la política R1. No se ejecutaron más variantes.

### Capability y latencia observadas

```text
ATTEMPT_COUNT=3
MIN_LATENCY_MS=496
MEDIAN_LATENCY_MS=515
MAX_LATENCY_MS=524
OSRM_MATCH_HTTP_STATUS=2xx (INFERRED_FROM_RESPONSE_OK)
OSRM_MATCH_PROVIDER_CODE=Ok (INFERRED_FROM_MATCHED_ADAPTER_RESULT)
OSRM_MATCH_VALID_TRACE=PASS
OSRM_MATCH_RADIUSES=PASS
OSRM_MATCH_GEOMETRY_PRESENT=SI
CONFIDENCE_GUARD=FAIL_OR_NOT_EVALUATED_BY_VARIANT
SNAP_DISTANCE_GUARDS=NOT_EVALUATED_ON_FINAL_REJECT
TRACEPOINT_GUARDS=NOT_EVALUATED_ON_FINAL_REJECT
ALTERNATIVES_GUARD=FAIL_ON_FINAL_VARIANT
SINGLE_SUBTRACE_GUARD=NOT_EVALUATED_ON_FINAL_REJECT
```

El resultado final distingue correctamente capability provider PASS de
aceptación de política BLOCKED. No se modificó el umbral ni se realizó ninguna
integración R3.

### Estado final R3G.2

```text
P2_T24_R3G_2_STATUS=BLOCKED
PROVIDER_CAPABILITY_GATE=PASS
R3_PROVIDER_RUNTIME_GATE=BLOCKED
P2_T24_READY_FOR_R3=NO
RUNTIME_POLICY_ACCEPTED_MATCH_AVAILABLE=NO
PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO
PRODUCTION_TOUCHED=NO
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
NEXT_ACTION=STOP_BLOCKED_PENDING_POLICY_ACCEPTED_RUNTIME_MATCH
```

Este resultado no autoriza iniciar R3, modificar el productor server-side,
emitir trayectorias matched en realtime, cambiar el Cliente ni promover a
Production.

## R3G.3 — Alternatives policy calibration

### Semántica oficial auditada

La documentación oficial de OSRM define `tracepoints[].alternatives_count`
como el número de matchings alternativos probables para ese tracepoint. `0`
indica que ese punto fue matched inequívocamente; un valor mayor que `0`
indica ambigüedad local en ese punto. OSRM indica dividir la traza en esos
puntos para map matching incremental. La semántica no equivale a invalidar
automáticamente todo el matching ni a crear una segunda entrada en
`matchings`.

Fuente primaria auditada:

```text
OSRM_OFFICIAL_API_DOC=https://project-osrm.org/docs/v5.24.0/api/
OSRM_ALTERNATIVES_COUNT_SEMANTICS=LOCAL_PROBABLE_ALTERNATIVE_MATCHINGS_PER_TRACEPOINT; 0=UNAMBIGUOUS; >0=LOCAL_AMBIGUITY; OSRM_RECOMMENDS_SPLITTING_AT_THE_POINT_FOR_INCREMENTAL_MATCHING
```

`alternatives_count` es independiente de `matchings_index`: el primero
describe ambigüedad local del punto y el segundo identifica el sub-trace al
que pertenece. `matchings.length > 1` continúa siendo rechazo y cualquier
discontinuidad de `matchings_index` continúa siendo rechazo.

```text
MULTIPLE_SUBTRACE_REJECTION_PRESERVED=SI
ROUTE_LOCKING_ALLOWED=NO
```

### Regla R1 auditada y calibrada

La regla anterior del código era:

```text
CURRENT_ALTERNATIVES_POLICY_BEFORE_R3G3=ANY_TRACEPOINT_ALTERNATIVES_COUNT_GT_0 => REJECT_MATCH
```

El primer guard roto en la Variant 3 anterior era:

```text
FIRST_BROKEN_POLICY_GUARD=alternatives
```

La regla calibrada mantiene una postura acotada y conservadora:

```text
PROPOSED_ALTERNATIVES_ACCEPTANCE_POLICY=EXACTLY_ONE_MATCHING; ALL_TRACEPOINTS_NON_NULL; ORDERED_WAYPOINT_INDEX; FIRST_AND_LAST_ALTERNATIVES_COUNT=0; AT_MOST_ONE_ISOLATED_INTERMEDIATE_AMBIGUOUS_TRACEPOINT; MAX_CONSECUTIVE_AMBIGUOUS_TRACEPOINTS=1; MULTIPLE_OR_MAJORITY_AMBIGUITY=REJECT
CURRENT_ALTERNATIVES_POLICY=NO_AMBIGUITY_OR_EXACTLY_ONE_ISOLATED_INTERIOR_AMBIGUITY; AMBIGUOUS_ANCHORS_AND_BROADER_AMBIGUITY_REJECT
MAX_ACCEPTED_INTERMEDIATE_AMBIGUOUS_TRACEPOINTS=1
MAX_CONSECUTIVE_AMBIGUOUS_TRACEPOINTS=1
CURRENT_POLICY_CONFIRMED_CORRECT=NO
POLICY_CODE_CHANGED=SI
```

El límite de una sola ambigüedad interior es una elección bounded de seguridad
para este batch, no una comparación contra una ruta planificada ni un valor
tomado de OSRM. La regla nunca acepta únicamente por confidence: continúa
exigiendo conjuntamente sub-trace único, tracepoints completos y ordenados,
alternatives policy, snap distances válidas y geometría/continuidad válidas.

### Variant 3: patrón y tabla resumida

La respuesta OSRM real de Variant 3 tuvo un único punto ambiguo en el extremo
final:

```text
VARIANT_3_AMBIGUITY_PATTERN=EDGE_AMBIGUITY
VARIANT_3_AMBIGUOUS_TRACEPOINT_COUNT=1
VARIANT_3_AMBIGUOUS_TRACEPOINT_INDEX=5
VARIANT_3_AMBIGUOUS_TRACEPOINT_ALTERNATIVES_COUNT=3
```

| index | matchings_index | waypoint_index | alternatives_count | snapped_distance_m | raw_accuracy_m |
|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 | 0 | 5 |
| 1 | 0 | 1 | 0 | 0 | 5 |
| 2 | 0 | 2 | 0 | 0 | 5 |
| 3 | 0 | 3 | 0 | 0 | 5 |
| 4 | 0 | 4 | 0 | 0 | 5 |
| 5 | 0 | 5 | 3 | 0 | 5 |

No se guardaron coordenadas completas en el reporte.

### Recertificación real posterior al cambio

Se reejecutó la misma Variant 3 desde el worker temporal `TESTING`, mediante
adapter + parser + policy reales, con timeout sin cambios:

```text
R3G3_PROBE_EXECUTION_ENVIRONMENT=TESTING_RAILWAY_RUNTIME
R3G3_PROBE_TRACE_SOURCE=PUBLIC_OSRM_ROUTE_GEOMETRY_DERIVED_SYNTHETIC_BERLIN_COORDINATES
OSRM_MATCH_CONFIDENCE=0.9787074735
OSRM_MATCH_HTTP_STATUS=2xx (INFERRED_FROM_RESPONSE_OK)
OSRM_MATCH_PROVIDER_CODE=Ok (INFERRED_FROM_MATCHED_ADAPTER_RESULT)
OSRM_MATCH_RESULT_STATUS=matched
OSRM_MATCH_TRACEPOINTS=6
OSRM_MATCHINGS=1
OSRM_MATCH_GEOMETRY=FULL_GEOJSON
POLICY_DECISION=REJECT_MATCH
POLICY_REJECTION_REASON=ambiguous_tracepoints
CONFIDENCE_GUARD=PASS
SNAP_DISTANCE_GUARDS=PASS
TRACEPOINT_GUARDS=PASS
ALTERNATIVES_GUARD=FAIL
SINGLE_SUBTRACE_GUARD=PASS
GEOMETRY_GUARD=PASS
VARIANT_3_RUNTIME_LATENCY_MS=505
R3_MATCHING_TIMEOUT_INITIAL_TESTING_MS=1000
```

La única guardia fallida es alternatives: el último punto es un ancla de
destino ambiguo. El resultado no es `ACCEPT_MATCH` bajo la política calibrada,
por lo que no se puede usar como evidencia de aceptación runtime.

### Resultado final R3G.3

```text
P2_T24_R3G_3_STATUS=BLOCKED
RUNTIME_POLICY_ACCEPTED_MATCH_AVAILABLE=NO
R3_PROVIDER_RUNTIME_GATE=BLOCKED
P2_T24_READY_FOR_R3=NO
PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO
R3_MATCHING_TIMEOUT_PRODUCTION=UNDECIDED
PRODUCTION_TOUCHED=NO
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
TEMP_RUNTIME_RESOURCE_CLEANED=SI
NEXT_ACTION=STOP_BLOCKED_SEEKING_POLICY_ACCEPTED_DATASET_OR_PROVIDER
```

No se ejecutó tracking, `matchedTrajectory` realtime, Cliente, prueba física,
T54 ni Production. Este bloqueo no autoriza iniciar R3.
