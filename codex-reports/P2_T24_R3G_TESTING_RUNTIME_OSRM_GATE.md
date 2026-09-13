# P2-T24-R3G — Testing runtime OSRM Match capability and latency gate

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
→ parser/policy
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

## Gate final

```text
P2_T24_R3G_STATUS=PASS
OSRM_MATCH_AVAILABLE_IN_TESTING=SI
R3_PROVIDER_RUNTIME_GATE=PASS
P2_T24_READY_FOR_R3=SI
PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO
PRODUCTION_TOUCHED=NO
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
NEXT_ACTION=P2_T24_R3_SERVER_PRODUCER_DESIGN_REVIEW
```

Este PASS sólo certifica capability y latencia del provider en Testing. No
autoriza integración R3, cambios de tracking, matched trajectory en realtime,
pruebas físicas ni promoción a Production.
