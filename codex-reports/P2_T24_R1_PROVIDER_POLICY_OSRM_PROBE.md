# P2-T24-R1 — Map matching provider, pure policy and Testing OSRM probe

## Alcance y autoridad

R1 implementa únicamente la base desacoplada para evaluar map matching en un
entorno Testing. No se integró con tracking, realtime, bridge, Cliente,
Prisma, DB ni T54.

Baseline verificado:

```text
P2_T23_STATUS=CLOSED_TESTING_CERTIFIED
T23_FINAL_COMMIT=26d83b57d9dca35b05f0e867c5b431c9dda15e2a
P2_T24_A0_STATUS=AUDITED_DESIGNED
P2_T24_A0_1_STATUS=HARDENED_READY_FOR_R1
P2_T24_READY_FOR_R1=SI
HEAD=ba3928ed05990ff08646c2d6f5a1462e60872a8b
origin/testing-codex=ba3928ed05990ff08646c2d6f5a1462e60872a8b
origin/main=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
```

## Files R1

Se agregaron exclusivamente los artefactos de la base R1:

- `src/lib/map-matching-provider.ts`: contrato discriminado, tipos raw/matched, límites y helper de payload.
- `src/lib/map-matching-policy.ts`: policy pura `ACCEPT_MATCH`/`REJECT_MATCH`.
- `src/lib/map-matching-geometry.ts`: parseo GeoJSON, proyección de anchors, interpolación por arc-length y bounding determinista.
- `src/lib/osrm-map-matching-provider.ts`: adapter OSRM Match opt-in, Testing-only, con timeout/AbortController y clasificación de errores.
- `scripts/testing/t24-osrm-match-probe.ts`: probe manual con `--confirm-testing`, no importado por CI/build/lint.
- tests focales para provider, policy y geometría.

No se modificaron los archivos de ruta de tracking, productor, realtime,
bridge, Cliente, playback T23, Prisma, schema o migraciones.

Archivos operativos confirmados sin cambios:

```text
src/app/api/repartidor/ubicacion/route.ts = unchanged
use-repartidor-tracking.ts = unchanged
realtime = unchanged
bridge = unchanged
Cliente = unchanged
Prisma/schema = unchanged
```

## Contrato y policy

El provider recibe sólo `lat`, `lng`, `offsetMs` y `accuracy?`; no recibe IDs
de pedido, usuario, negocio o repartidor. `accuracy` se valida como finita y
en `[0,100]`, sin cambiar todavía el contrato GPS vivo.

La policy inicial de Testing exige al menos 3 puntos, dos segmentos con
movimiento, un único matching, confidence `>=0.75`, tracepoints no nulos,
orden consistente, `alternatives_count=0`, matching único y snap distance
dentro de:

```text
min(30m, max(15m, 2 * accuracy))
```

Sin accuracy se usa explícitamente el límite conservador de 15 m. Timeout,
error, NoMatch, split, ambigüedad o validación fallida se rechazan para que la
integración futura conserve fallback RAW T23. Heartbeats y puntos únicos o
dos puntos no son candidatos.

## Geometría y offsets

El adapter solicita `profile=driving`, `geometries=geojson`, `overview=full`,
`gaps=split` y `tidy=false`. Envía `radiuses` sólo cuando cada punto tiene
accuracy válida y no envía timestamps inicialmente.

La geometría completa del subtrace aceptado se proyecta sobre anchors
ordenados. Los anchors conservan exactamente su `offsetMs`; los puntos
intermedios reciben offsets por distancia acumulada, redondeados y no
decrecientes. No se usa duración, ETA ni velocidad OSRM para playback. La
reducción conserva primer punto, último punto, anchors y giros relevantes; si
no puede quedar dentro de 48 puntos sin perder invariantes, el resultado se
rechaza.

## Seguridad y privacidad

- Provider deshabilitado por defecto.
- Sólo se habilita con provider `osrm`, entorno exacto `TESTING`, base URL válida y no `NODE_ENV=production`.
- Se rechazan URLs con credenciales, query/hash o hosts `deligo.ar`.
- El probe es opt-in, no es endpoint público y no entra en CI normal.
- La ejecución usó 3 coordenadas sintéticas; `PROBE_PII_SENT=NO`.
- No hay matched trajectory publicada ni cambio de autoridad GPS/DB.

## Tests

Suite R1: `35 pass`, `0 fail`, `86 expect() calls`.

Cubre éxito matched, timeout, network failure, HTTP/provider error, JSON
inválido, NoMatch, tracepoint nulo, split/multiple matching, confidence bajo,
alternativas, thresholds de snap, accuracy ausente/inválida, elegibilidad de
1/2/3+ puntos, extracción de geometría completa, curvas/esquinas, anchors,
arc-length timing, D=0, duplicados, bounding <=48, payload bound, ausencia de
PII/IDs, profile driving y guard de Production.

Regresiones T23 ejecutadas: `33 pass`, `0 fail`:

- `src/lib/tracking-trajectory.test.ts`
- `src/lib/tracking-playback.test.ts`
- `scripts/testing/t23-trajectory-replay.test.ts`

`git diff --check` pasó. El typecheck global continúa teniendo errores
preexistentes fuera de R1; la salida filtrada no contiene errores en los
archivos `map-matching`/`osrm` nuevos.

## Probe OSRM

El probe manual se ejecutó con `--confirm-testing`, `DELIGO_ENVIRONMENT=TESTING`
y `T24_OSRM_BASE_URL=https://router.project-osrm.org`, desde el contexto local.
No fue posible ejecutar un one-off dentro del runtime Railway Testing con las
herramientas disponibles, por lo que no se simula ese resultado.

Resultado observado:

```text
T24_PROBE_STATUS=COMPLETED
PROBE_EXECUTION_ENVIRONMENT=LOCAL_TESTING_CONTEXT
PROBE_PII_SENT=NO
PROBE_TRACE_POINTS=3_SYNTHETIC
LATENCY_MS=271
TIMEOUT_MS=250
OSRM_MATCH_RESULT_STATUS=timeout
OSRM_MATCH_VALID_TRACE=FAIL
OSRM_MATCH_RADIUSES=FAIL
OSRM_MATCH_FAILURE_REASON=timeout
OSRM_MATCH_NOMATCH_RUNTIME_PROBE=NOT_RUN
```

Los casos NoMatch, timeout/abort y errores de red se validan de forma
determinista con mock fetch en tests; no se envió una solicitud pública
deliberadamente inadecuada. La disponibilidad real de OSRM Match dentro de
Testing queda `UNKNOWN`. La observación local de 271 ms hace que el límite de
250 ms sea `TOO_AGGRESSIVE` como gate inicial; R3 debe medir desde el runtime
Testing antes de elegir un timeout operativo. No se modifica todavía el
timeout y el valor final queda pendiente de esa medición.

El probe runtime no bloquea R2, que sólo prepara contrato realtime/bridge. R3
queda bloqueado hasta validar desde Testing runtime disponibilidad de `/match`,
latencia, timeout operativo, radiuses y respuesta válida.

## Estado final

```text
P2_T24_R1_STATUS=CLOSED_TESTING_FOUNDATION_READY_FOR_R2
R1_PROVIDER_ABSTRACTION_IMPLEMENTED=SI
R1_PURE_POLICY_IMPLEMENTED=SI
R1_OSRM_ADAPTER_IMPLEMENTED=SI
R1_PROVIDER_ACCEPTS_OPTIONAL_ACCURACY=SI
R1_TRACKING_ROUTE_INTEGRATION=NO
R1_REALTIME_EMISSION=NO
R1_CLIENT_BEHAVIOR_CHANGE=NO
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
DB_RAW_POSITION_ONLY=SI
SOLE_GPS_WATCHER_PRESERVED=SI
MATCHING_FAILURE_POLICY=FALLBACK_TO_RAW_T23
ROUTE_LOCKING_ALLOWED=NO
DESTINATION_MAP_MATCHING=NO
OSRM_MATCH_TIMESTAMPS_REQUIRED_INITIAL=NO
OSRM_ROUTE_DURATION_USED_FOR_PLAYBACK=NO
MATCHING_EXCEPTION_CAN_SUPPRESS_RAW_REALTIME=NO
LIVE_TRACKING_ACCURACY_CONTRACT_CHANGED=NO
OSRM_MATCH_AVAILABLE_IN_TESTING=UNKNOWN
PROBE_EXECUTION_ENVIRONMENT=LOCAL_TESTING_CONTEXT
PROBE_PII_SENT=NO
PUBLIC_PROVIDER_PROBE_IN_NORMAL_CI=NO
OSRM_MATCH_VALID_TRACE=FAIL
OSRM_MATCH_RADIUSES=FAIL
OSRM_MATCH_NOMATCH_AUTOMATED_TEST=PASS
OSRM_MATCH_NOMATCH_RUNTIME_PROBE=NOT_RUN
OBSERVED_MATCH_LATENCY_MS=271
PROBE_TIMEOUT_MS=250
MATCHING_TIMEOUT_250MS_ASSESSMENT=TOO_AGGRESSIVE
R3_PROVIDER_RUNTIME_GATE=BLOCKED_PENDING_TESTING_RUNTIME_PROBE
R3_MATCHING_TIMEOUT_FINAL=PENDING_TESTING_RUNTIME_MEASUREMENT
MATCHED_OFFSET_MAPPING_TESTS=PASS
POLICY_TESTS=PASS
T23_REGRESSION=PASS
R1_FOUNDATION_SOURCE_FILES_CHANGED=SI
R1_LIVE_TRACKING_INTEGRATION_FILES_CHANGED=0
R1_RUNTIME_PRODUCT_BEHAVIOR_CHANGED=NO
T24_SCHEMA_CHANGE_REQUIRED=NO
T24_MIGRATION_REQUIRED=NO
PRODUCTION_TOUCHED=NO
P2_T24_READY_FOR_R2=SI
NEXT_ACTION=P2_T24_R2_REALTIME_CONTRACT_AND_BRIDGE
```
