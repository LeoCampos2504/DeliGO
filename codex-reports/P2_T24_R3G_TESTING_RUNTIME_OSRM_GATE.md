# P2-T24-R3G — Testing runtime OSRM Match capability and latency gate

## Alcance y guardas

Esta etapa fue runtime-only. No se modificaron producto, harness, tracking,
bridge, Cliente, DB, Prisma, migraciones ni Production. No se enviaron datos
personales ni coordenadas reales; la sonda existente usa únicamente tres
coordenadas sintéticas y radiuses derivados de `accuracy=25`.

La referencia de código existente es `scripts/testing/t24-osrm-match-probe.ts`.
Se verificó que el artefacto está presente en el contenedor Testing de
`DeliGO Copy`, bajo `/app/scripts/testing/t24-osrm-match-probe.ts`, y que el
deployment activo corresponde a `testing-codex`.

```text
RAILWAY_PROJECT=amiable-rejoicing
RAILWAY_ENVIRONMENT=TESTING
RAILWAY_SERVICE=DeliGO Copy
RAILWAY_DEPLOYMENT_ID=594b7b7b-8905-45fa-8bb3-dbcce76519bb
RAILWAY_DEPLOYMENT_INSTANCE=6d84c430-a77f-4887-8207-03b9f7798740
RAILWAY_DEPLOYMENT_STATUS=SUCCESS
RAILWAY_DEPLOYMENT_COMMIT=3ff2287c87f46ae61b36231d84583c9806d3f6b3
PROBE_BASE_URL=https://router.project-osrm.org
PROBE_PROVIDER=osrm
PROBE_PROFILE=driving
PROBE_TRACE=3_SYNTHETIC_POINTS
PROBE_PII_SENT=NO
```

## Resultado de ejecución

Se intentó ejecutar la sonda existente dentro del deployment activo mediante
Railway SSH, con `DELIGO_ENVIRONMENT=TESTING`,
`MAP_MATCHING_PROVIDER=osrm`, `T24_OSRM_BASE_URL` público y
`--confirm-testing`. La conexión inicialmente permitió inspeccionar `/app` y
confirmar la presencia del script. Las ejecuciones de la sonda posteriores no
devolvieron stdout ni código HTTP; la sesión SSH permaneció abierta incluso
para comandos de control `echo`/`exit`. Por lo tanto, no existe evidencia
válida de que se haya emitido una petición OSRM, ni de su resultado o latencia.

No se cuenta esta conexión incompleta como un intento de match. No se ejecutó
la sonda localmente como sustituto del runtime Railway.

```text
PROBE_EXECUTION_ENVIRONMENT=UNAVAILABLE_TESTING_RAILWAY_RUNTIME
OSRM_MATCH_AVAILABLE_IN_TESTING=UNKNOWN
OSRM_MATCH_VALID_TRACE=UNKNOWN
OSRM_MATCH_RADIUSES=UNKNOWN
ATTEMPT_COUNT=0
MIN_LATENCY_MS=UNKNOWN
MEDIAN_LATENCY_MS=UNKNOWN
MAX_LATENCY_MS=UNKNOWN
OSRM_MATCH_HTTP_AND_CODE=UNKNOWN
OSRM_MATCH_TRACEPOINTS=UNKNOWN
OSRM_MATCHINGS=UNKNOWN
OSRM_MATCH_CONFIDENCE=UNKNOWN
OSRM_MATCH_GEOMETRY=UNKNOWN
OSRM_MATCH_NOMATCH_RUNTIME_PROBE=NOT_REQUIRED_FOR_R3_GATE
R1_ADAPTER_FAILURE_CLASSIFICATION_REGRESSION=UNKNOWN_NOT_EXECUTED
```

El probe existente configura `timeoutMs=250`; se conserva como referencia de
la configuración actual y no se recomienda promover ningún timeout a
Production a partir de esta ejecución incompleta.

```text
R3_MATCHING_TIMEOUT_INITIAL_TESTING_MS=250
R3_MATCHING_TIMEOUT_PRODUCTION=UNDECIDED
LATENCY_GATE_CRITERION=MAX_LATENCY_MS_LEQ_1000
```

## Gate y estado

El gate no puede pasar: falta una ejecución observable desde el runtime
Railway Testing con trace válido, radiuses aceptados y latencias medibles.
R1 no se clasifica como regresión porque el adaptador no produjo un resultado
runtime que pueda auditarse.

```text
P2_T24_R3G_STATUS=BLOCKED
R3_PROVIDER_RUNTIME_GATE=BLOCKED
P2_T24_READY_FOR_R3=NO
PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO
NEXT_ACTION=REPAIR_OR_PROVIDE_CONTROLLED_TESTING_RUNTIME_EXECUTION_PATH_THEN_RERUN_R3G
PRODUCTION_TOUCHED=NO
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```
