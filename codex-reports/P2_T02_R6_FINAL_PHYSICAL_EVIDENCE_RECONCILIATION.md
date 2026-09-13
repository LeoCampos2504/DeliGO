# P2-T02-R6 — final physical evidence reconciliation + T02 closeout decision

Fecha: 2026-09-13. Tipo: documentation-only final certification
reconciliation. No se implementó código ni se modificaron tests, tracking,
routing, UI, Prisma, DB, Railway o Production.

## Preflight y alcance

```text
HEAD_BEFORE=38eb7d4d8af1ec5dd8f0a7b0f1c73f52c9e01677
CURRENT_BRANCH=testing-codex
ORIGIN_TESTING_CODEX_BEFORE=38eb7d4d8af1ec5dd8f0a7b0f1c73f52c9e01677
ORIGIN_TESTING_CODEX_AFTER=38eb7d4d8af1ec5dd8f0a7b0f1c73f52c9e01677
ORIGIN_MAIN=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
ORIGIN_MAIN_EXPECTED=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
ORIGIN_MAIN_AUTHORITY_MATCH=YES
POST_R5B_UNAUDITED_FUNCTIONAL_DELTA=NO
PREFLIGHT_DECISION=CONTINUE_AUTHORITY_MATCH
R4_FUNCTIONAL_COMMIT=b0112d53c0b8e0cf8db1868ccf6f666070b39b39
R5A_FUNCTIONAL_COMMIT=ee7eea740aecfd70bc0718601a7fd077a015df98
R5B_DOC_COMMIT=cb29d0039aeb8a2d815e2f3ee3c3ba729f22b886
```

El checkout local inicial estaba en `testing`; se seleccionó la autoridad
`origin/testing-codex` en un árbol limpio. El avance observado de la referencia
local de `origin/main` al hacer fetch coincide exactamente con la Production
esperada indicada para esta tarea (`ff4cc2f`), no con un cambio funcional
inesperado posterior. El delta desde R5B es documental.

## Autoridades preservadas

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

R5A_IPHONE_TOP_SAFE_AREA=PASS
R5A_IPHONE_BOTTOM_SAFE_AREA=PASS
R5A_ANDROID_LAYOUT_SMOKE=PASS
P2_T02_R5A_OPERATOR_CERTIFICATION=PASS
P2_T02_R5A_STATUS=CLOSED_TESTING_CERTIFIED
```

R4 y R5A/R5B no se reabren.

## Nueva evidencia física

```text
BELOW_THRESHOLD_MOVEMENT=PASS
BELOW_THRESHOLD_PHYSICAL_DISTANCE_EST=~5m
BELOW_THRESHOLD_CLIENT_UPDATE=NO
BELOW_THRESHOLD_TEST_METHOD=REAL_PHYSICAL_WALKING
BELOW_THRESHOLD_HEARTBEAT_CONFOUND=NO
PREVIOUS_BELOW_THRESHOLD_ATTEMPT=INVALIDATED_BY_REAL_MOVEMENT_CONTEXT

ABOVE_THRESHOLD_MOVEMENT=PASS
SIGNIFICANT_REAL_MOVEMENT=SI
CLIENT_POSITION_UPDATED_AFTER_THRESHOLD=PASS
SIGNIFICANT_MOVEMENT_UPDATE_TIMING=IMMEDIATE_OR_NEAR_IMMEDIATE

STATIONARY_30S=PASS
CLIENT_MARKER_MOVED_WHILE_STATIONARY=NO
SHORT_TERM_GPS_JITTER_OBSERVED=NO

REAL_ROUTE_100_300M=PASS
REAL_ROUTE_DISTANCE=>1km
REAL_ROUTE_DISTANCE_CLASS=KILOMETERS
REAL_ROUTE_SIGNIFICANT_MOVEMENT=SI
CLIENT_UPDATES_OBSERVED=SI
```

No se registra una cantidad exacta de metros para el recorrido en automóvil.

El marcador se observó saltando entre posiciones discretas, sin interpolación
visual. Esto confirma la evidencia física de T23 y caracteriza el alcance
relacionado de T24, pero no introduce un bug nuevo de T02:

```text
CLIENT_MARKER_MOVEMENT=STEPWISE_JUMPS
SMOOTH_INTERPOLATION=NO
CLIENT_MARKER_MOVEMENT_PHYSICAL=PASS
T23_PHYSICAL_EVIDENCE=CONFIRMED
CURVE_CORNER_VISUAL=POINT_TO_POINT_JUMPS
CLIENT_PATH_BETWEEN_UPDATES=NOT_VISIBLE
ROAD_FOLLOWING_ANIMATION=NO
T24_CURVE_EVIDENCE=PARTIAL
CURVE_CORNER_BLOCKS_T02=NO
CURVE_CORNER_BLOCKS_T02_JUSTIFICATION=R5/R5B clasifican esta superficie como handoff relacionado a T23/T24; T02 exige entrega de posiciones y honestidad del estado, no interpolación visual ni map matching
```

## Background, stale UI y completion

El recorrido real continuó inicialmente al pasar DeliGO a segundo plano. Después
Android/Chromium suspendió el proceso: dejaron de llegar coordenadas, aumentó
la edad de “Última actualización” y el Cliente pasó de “En vivo” a “Pausado”.
Esto es el comportamiento best-effort de Option C, no una regresión de B3.

```text
BACKGROUND_WITH_REAL_SIGNIFICANT_MOVEMENT=TESTED
BACKGROUND_INITIAL_UPDATES=PASS
BACKGROUND_CONTINUOUS_TRACKING=NO
BACKGROUND_PLATFORM_LIMITATION_OBSERVED=SI
BACKGROUND_RESULT=LIMITED_BY_CURRENT_PWA_PLATFORM
CLIENT_LAST_UPDATE_AGE_INCREASES=PASS
CLIENT_STALE_UI_PHYSICAL=PASS
CLIENT_STALE_STATE=PAUSADO
CLIENT_FALSE_LIVE_STATE_OBSERVED=NO
CLIENT_STALE_THRESHOLD_MS=120000
CLIENT_STALE_LOCATION_HONEST=SI
ANDROID_B3_PHYSICAL_FINAL=PASS
```

Al marcar Entregado, el pedido salió de activos, pasó al historial del Cliente,
quedaron disponibles reseña/repetir y el tracking dejó de mostrarse. El
Repartidor siguió moviéndose sin que el Cliente reanudara eventos:

```text
TRACKING_STOPS_AFTER_DELIVERY=PASS
POST_COMPLETION_TRACKING_EVENTS=PASS
POST_COMPLETION_MOVEMENT_OBSERVED=SI
POST_COMPLETION_CLIENT_TRACKING_RESUMED=NO
CLIENT_ACTIVE_ORDER_REMOVED_AFTER_DELIVERY=PASS
CLIENT_HISTORY_TRANSITION_AFTER_DELIVERY=PASS
```

## Reconciliación de gates

| GATE | PREVIOUS_STATUS | NEW_EVIDENCE | FINAL_STATUS | BLOCKS_T02 |
|---|---|---|---|---|
| BELOW_THRESHOLD_MOVEMENT | PENDING_EXTERIOR | Caminata física de aproximadamente 5 m; sin update inmediato | PASS | NO |
| ABOVE_THRESHOLD_MOVEMENT | PENDING_EXTERIOR | Desplazamiento real significativo en automóvil; update inmediato o casi inmediato | PASS | NO |
| REAL_ROUTE_100_300M | PENDING_EXTERIOR | Recorrido real de kilómetros; Cliente siguió recibiendo updates | PASS | NO |
| CLIENT_MARKER_MOVEMENT | PENDING_EXTERIOR | Saltos punto a punto, sin interpolación | PASS — comportamiento caracterizado | NO |
| CURVE_CORNER_T24 | PENDING_EXTERIOR | No se observó animación de curva ni seguimiento de calle | PARTIAL — T24 | NO |
| BACKGROUND_WITH_REAL_SIGNIFICANT_MOVEMENT | PENDING_EXTERIOR_CONFIRMATION | Updates iniciales, suspensión posterior, stale UI honesta | PASS — Option C best-effort | NO |
| TRACKING_STOPS_AFTER_DELIVERY | NOT_TESTED_YET | Tracking desaparece tras Entregado | PASS | NO |
| POST_COMPLETION_TRACKING_EVENTS | NOT_TESTED_YET | Movimiento posterior sin tracking reanudado ni eventos del Cliente | PASS | NO |

## Android B3 / B4

```text
ANDROID_B3_PHYSICAL=PASS
ANDROID_B3_PHYSICAL_FINAL=PASS
ANDROID_B3_CONTRACT_COVERAGE=REAL_MOVEMENT_BACKGROUND_BEST_EFFORT_STALE_HONESTY

ANDROID_B4_PHYSICAL=PASS
ANDROID_B4_PHYSICAL_FINAL=PASS
ANDROID_B4_CONTRACT_COVERAGE=IN_APP_NAVIGATION_OPENS_ROUTE_RENDERED_REAL_EXTERIOR_ROUTE_CURRENT_DRIVER_POSITION_UPDATES_DURING_MOVEMENT
ANDROID_B4_REMAINING_SPECIFIC_CHECK=NONE_REPORTED
```

B4 queda reconciliado con la navegación in-app y ruta renderizada certificadas
en R4, más la posición actualizada durante el recorrido exterior real. No se
usa navegación externa como sustituto de la navegación in-app. La evidencia no
declara interpolación ni follow camera; esas superficies quedan en T23/T24/T54.

## Decisión de cierre T02

No queda un gate físico bloqueante de T02. El comportamiento visual del marcador
está correctamente separado como alcance futuro de T23/T24, y la limitación de
background está explícitamente dentro del contrato best-effort de B3.

```text
P2_T02_OPERATOR_CERTIFICATION=PASS
P2_T02_EXTERIOR_CERTIFICATION=PASS
P2_T02_COMPLETION_CERTIFICATION=PASS
P2_T02_STATUS=CLOSED_TESTING_CERTIFIED
P2_T02_RELEASE_ELIGIBLE=SI
TEST_T02_ORDER_LEFT_ACTIVE=NO
```

Se preservan los handoffs sin iniciar trabajo futuro:

```text
T23_NAVIGATION_FOLLOW_SCOPE=PARTIAL
T23_PHYSICAL_EVIDENCE=CONFIRMED
T24_NAVIGATION_MAP_MATCHING_SCOPE=CONFIRMED_RELATED
T24_CURVE_EVIDENCE=PARTIAL
P2_T54=Driver Turn-by-Turn Follow Camera UX
P2_T54_STATUS=FUTURE_AFTER_T02_T23_T24
NEXT_TASK_CHAIN_START=P2_T23_AUDIT_AND_DESIGN
```

## Release y mutaciones

```text
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
PRODUCT_FILES_CHANGED=0
TEST_FILES_CHANGED=0
PRISMA_FILES_CHANGED=0
MIGRATION_FILES_CHANGED=0
FUNCTIONAL_TREE_CHANGED=NO
DATABASE_CHANGED=NO
RAILWAY_MUTATION=NO
```

Este cierre sólo actualiza documentación canónica y `COMPLETED_TASKS.md`; no
inicia T23, T24, T54 ni Production.
