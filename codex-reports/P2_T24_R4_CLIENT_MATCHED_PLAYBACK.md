# P2-T24-R4 — Client visual matched-trajectory playback

## Alcance

R4 habilita en el Cliente la selección defensiva de la trayectoria visual
opcional `matchedTrajectory` emitida por R3. La política es:

```text
validMatchedTrajectory ?? rawTrajectory
```

La validación exige entre 1 y 48 puntos, coordenadas finitas dentro de rango,
`offsetMs` finito/no negativo/no decreciente y ningún campo adicional. Un
matched válido también debe comenzar a no más de 150 m del punto ya renderizado;
si no, se usa RAW para evitar una discontinuidad visual controlada. Esto es
únicamente una decisión visual: no hay route locking ni mutación de la
autoridad GPS.

Se preservó el único controlador de playback existente, su `requestAnimationFrame`,
cola activa+pendiente, control de versiones, cancelación stale/completion,
recovery snap y ausencia de extrapolación. El punto top-level RAW del evento
sigue siendo la autoridad; el matched sólo se usa para interpolar visualmente.
El único escritor de posición del marker sigue siendo el controlador.

## Cambios versionados

```text
src/components/tracking/delivery-tracking-map.tsx
src/lib/tracking-playback.ts
src/lib/tracking-playback.test.ts
src/lib/tracking-consumer-static-contract.test.ts
scripts/testing/t24-client-trajectory-replay.ts
```

No se modificaron producer/provider/policy/server bridge, navegación, DB,
Prisma, migraciones ni archivos de Production. El harness nuevo es únicamente
determinista y client-side: no hace HTTP, DB, realtime ni llamadas OSRM.

## Evidencia

```text
R4_MATCHED_VISUAL_ENABLED=SI
CLIENT_VISUAL_TRAJECTORY_SELECTION_POLICY=matchedTrajectory_IF_VALID_ELSE_RAW_trajectory
MATCHED_TRAJECTORY_VISUAL_ONLY=SI
GPS_RAW_IS_INTERNAL_AUTHORITY=SI
MATCHED_TRAJECTORY_VERSION_POLICY=SAME_LOCATION_REVISION_AS_RAW
ONE_PLAYBACK_CONTROLLER_PRESERVED=SI
MARKER_WRITER_COUNT=1
RAW_TO_MATCHED_TRANSITION_TEST=PASS
MATCHED_TO_RAW_TRANSITION_TEST=PASS
MATCHED_TO_MATCHED_TRANSITION_TEST=PASS
STALE_MATCHED_PLAYBACK_TEST=PASS
RECOVERY_MATCHED_TEST=PASS
COMPLETION_MATCHED_TEST=PASS
HTTP_FALLBACK_RAW_TEST=PASS
CROSS_BATCH_CONTINUITY_TEST=PASS
T23_REGRESSION=PASS
R4_DETERMINISTIC_CLIENT_REPLAY=PASS
R4_NETWORK_OR_OSRM_CALLED=NO
R4_VISUAL_POST_DEPLOY_REPLAY=NOT_RUN
R3_LIVE_SERVER_ROUTE_PROBE=NOT_RUN
FULL_END_TO_END_MATCHING_CERTIFIED=NO
DESTINATION_MAP_MATCHING=NO
ROUTE_LOCKING_ALLOWED=NO
T54_ABSORBED=NO
```

Suites ejecutadas:

```text
bun test src/lib/tracking-playback.test.ts src/lib/tracking-consumer-static-contract.test.ts src/lib/realtime-manager.test.ts src/lib/realtime-publish.test.ts src/lib/map-matching-policy.test.ts scripts/testing/t23-trajectory-replay.test.ts src/app/api/pedidos/[id]/tracking/route.test.ts src/lib/tracking-trajectory.test.ts
143 pass / 0 fail

bun run scripts/testing/t24-client-trajectory-replay.ts --confirm-testing
R4_DETERMINISTIC_CLIENT_REPLAY=PASS
R4_MATCHED_CURVE=PASS
R4_MATCHED_TO_RAW=PASS
R4_STALE_RECOVERY=PASS
R4_COMPLETION_CANCELLATION=PASS
R4_NETWORK_OR_OSRM_CALLED=NO

bunx eslint src/components/tracking/delivery-tracking-map.tsx src/lib/tracking-playback.ts src/lib/tracking-playback.test.ts scripts/testing/t24-client-trajectory-replay.ts
PASS
git diff --check
PASS
```

El chequeo TypeScript global conserva errores preexistentes fuera de R4; no
aparecieron errores nuevos en los archivos de esta tarea.

## Commit y Testing

El código se publicó exclusivamente en `origin/testing-codex` y desplegó en
DeliGO Copy, entorno Testing:

```text
R4_COMMIT_SHA=477a11919381e9b3760a18e6a191b27c7a664ab4
REMOTE_TESTING_SHA=477a11919381e9b3760a18e6a191b27c7a664ab4
DELIGO_TESTING_DEPLOYMENT_ID=62752655-16e3-4994-84f3-3839e42b2f99
DELIGO_TESTING_DEPLOYMENT_STATUS=SUCCESS
DELIGO_TESTING_DEPLOYMENT_COMMIT=477a11919381e9b3760a18e6a191b27c7a664ab4
```

No se ejecutó replay visual físico post-deploy ni se declara PASS en nombre
del operador. La certificación visual queda pendiente de la siguiente fase
controlada.

## Cierre

```text
PUBLIC_OSRM_ACCEPTABLE_FOR_PRODUCTION=NO
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
P2_T24_READY_FOR_R5=SI
NEXT_ACTION=P2_T24_R5_CONTROLLED_TESTING_VISUAL_CERTIFICATION
```

