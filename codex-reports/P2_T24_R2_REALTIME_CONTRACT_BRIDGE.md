# P2-T24-R2 — Optional matched trajectory realtime contract and Chat bridge

## Baseline y alcance

```text
P2_T23_STATUS=CLOSED_TESTING_CERTIFIED
T23_FINAL_COMMIT=26d83b57d9dca35b05f0e867c5b431c9dda15e2a
R1_FINAL_COMMIT=dd65ac34fd17759e300c4156b9fdaa901d39c0ff
P2_T24_R1_STATUS=CLOSED_TESTING_FOUNDATION_READY_FOR_R2
R3_PROVIDER_RUNTIME_GATE=BLOCKED_PENDING_TESTING_RUNTIME_PROBE
origin/main=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
```

R2 agrega únicamente transporte y validación backward-compatible para el
campo opcional `matchedTrajectory`. No llama al provider OSRM, no modifica el
producer GPS, no integra la tracking route, no cambia playback/Cliente y no
toca DB, Prisma, schema o migraciones.

## Files changed

- `src/lib/realtime-types.ts`: tipo mínimo matched y validación bounded.
- `src/lib/realtime-publish.ts`: soporte caller-supplied y validación del envelope serializado.
- `mini-services/chat-service/internal-publish-schema.js`: allowlist y validación estricta del campo.
- `mini-services/chat-service/test/internal-publish.test.js`: schema y relay Socket.IO.
- `src/lib/realtime-publish.test.ts`: publisher, bounds, privacidad y compatibilidad.
- `codex-reports/P2_T24_R2_REALTIME_CONTRACT_BRIDGE.md`: este cierre.

No se modificaron `src/app/api/repartidor/ubicacion/route.ts`,
`use-repartidor-tracking.ts`, `delivery-tracking-map.tsx`,
`tracking-playback.ts`, `mini-services/chat-service/index.js`,
`internal-publish-handler.js`, Prisma/schema ni migraciones.

## Contrato

El evento conserva sus campos RAW y admite:

```json
{
  "pedidoId": "…",
  "lat": -34.6,
  "lng": -58.4,
  "timestamp": "…",
  "version": 7,
  "trajectory": [],
  "matchedTrajectory": [
    { "lat": -34.6001, "lng": -58.4001, "offsetMs": 0 }
  ]
}
```

`matchedTrajectory` es opcional, visual-only, no contiene accuracy, IDs,
provider metadata, confidence ni snap distances. Tiene entre 1 y 48 puntos;
cada punto sólo contiene `lat`, `lng` y `offsetMs`, con coordenadas finitas en
rango y offsets finitos, no negativos y no decrecientes.

La trayectoria matched corresponde a la misma `version/locationRevision` del
RAW. No se introduce una segunda versión ni autoridad visual. El top-level
`lat/lng`, timestamp, estado y elegibilidad siguen siendo RAW.

El publisher valida el campo antes de hacer HTTP y rechaza de forma controlada
un matched malformado o un envelope serializado mayor a 16 KiB. El bridge
aplica la misma allowlist y bound; después emite `envelope.payload` sin
recalcular, simplificar, ordenar ni alterar offsets.

## Compatibilidad, seguridad y no integración

- Evento RAW sin `matchedTrajectory`: válido y relayed con semántica previa.
- Evento RAW con `trajectory`: preservado sin cambios.
- Campo matched ausente: válido.
- `accuracy` no se agrega al realtime: `RAW_ACCURACY_REALTIME_REQUIRED=NO`.
- El campo matched no cambia DB, `locationRevision`, timestamp ni estado.
- No se importa ni ejecuta `MapMatchingProvider`/OSRM desde tracking o bridge.
- El Cliente actual sigue consumiendo RAW: no se modificó ningún consumer.

## Tests

Publisher R2: `13 pass`, `0 fail`.

Chat-service completo: `99 pass`, `0 fail`. Incluye validación de legacy,
matched de 1 y 48 puntos, 49/empty, rangos, NaN/Infinity, offsets,
malformed fields, y relay real:

```text
internal publish payload
→ internal schema validation
→ internal publish handler
→ repartidor-location Socket.IO emitted payload
```

El test de relay confirma preservación exacta de count, lat/lng, offsetMs,
version y trayectoria RAW. No expone metadata de provider.

Regresión realtime/T23: `127 pass`, `0 fail`, incluyendo publisher,
realtime manager/client/policy, tracking trajectory/playback, static contracts
y T23 replay harness.

`git diff --check` y lint focal pasan. El typecheck global conserva errores
preexistentes ajenos a R2; no aparecen errores nuevos en los archivos R2.

## Deploy y smoke Testing

El push de este commit debe disparar el autodeploy del servicio Chat Testing,
sin redeploy manual y sin Production. Se completará aquí el deployment ID,
commit observado y `/health` después de que Railway termine.

El smoke sintético matched post-deploy no se ejecuta si no existe un camino
interno seguro ya disponible. No se crea endpoint debug. El contrato
automatizado y el health del bridge son suficientes para R2.

## Estado final

```text
P2_T24_R2_STATUS=IMPLEMENTED_TESTING_BRIDGE_READY
REALTIME_MATCHED_TRAJECTORY_CONTRACT_IMPLEMENTED=SI
MATCHED_TRAJECTORY_OPTIONAL=SI
MATCHED_TRAJECTORY_VISUAL_ONLY=SI
MAX_MATCHED_VISUAL_POINTS_PER_BATCH=48
MAX_MATCHED_REALTIME_PAYLOAD_BYTES=16384
MATCHED_TRAJECTORY_VERSION_POLICY=SAME_LOCATION_REVISION_AS_RAW
LEGACY_RAW_EVENT_COMPATIBILITY=PASS
MATCHED_TRAJECTORY_RELAY_PRESERVATION=PASS
REALTIME_BRIDGE_MATCHED_TRAJECTORY_TEST=PASS
R2_TRACKING_ROUTE_INTEGRATION=NO
R2_MATCHING_PROVIDER_RUNTIME_CALL=NO
R2_MATCHED_PRODUCER_EMISSION=NO
R2_CLIENT_MATCHED_PLAYBACK=NO
RAW_ACCURACY_REALTIME_REQUIRED=NO
T23_REGRESSION=PASS
CHAT_TESTING_DEPLOYMENT_ID=PENDING_AUTODEPLOY
CHAT_TESTING_DEPLOYMENT_STATUS=PENDING_AUTODEPLOY
POST_DEPLOY_RAW_BRIDGE_SMOKE=PENDING_AUTODEPLOY
MATCHED_POST_DEPLOY_RELAY_PROBE=NOT_RUN_NO_SAFE_PATH
R2_PRODUCT_BEHAVIOR_VISIBLE_CHANGE=NO
OSRM_MATCH_AVAILABLE_IN_TESTING=UNKNOWN
R3_PROVIDER_RUNTIME_GATE=BLOCKED_PENDING_TESTING_RUNTIME_PROBE
PRODUCTION_TOUCHED=NO
P2_T24_READY_FOR_R3=NO
NEXT_ACTION=P2_T24_R3_RUNTIME_GATE_THEN_SERVER_PRODUCER
```
