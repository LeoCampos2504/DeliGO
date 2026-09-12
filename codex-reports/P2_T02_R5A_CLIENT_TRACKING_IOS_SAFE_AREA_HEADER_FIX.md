# P2-T02-R5A — Client tracking map iOS safe-area + header centering

Fecha: 2026-09-12. Tipo: audit + minimal UI fix + tests + Testing deploy.

## Preflight y delta

```text
HEAD_BEFORE=f749a7149a50a1c070d6e94e3166d595a84bae24
CURRENT_BRANCH=work/p2-t43-r2
ORIGIN_TESTING_BEFORE=f749a7149a50a1c070d6e94e3166d595a84bae24
ORIGIN_MAIN=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
POST_R4_DELTA_CLASSIFICATION=DOCS_ONLY_R5
POST_R4_UNAUDITED_FUNCTIONAL_DELTA=NO
P2_T54=Driver Turn-by-Turn Follow Camera UX
P2_T54_STATUS=FUTURE_AFTER_T02_T23_T24
```

El delta `b0112d53..origin/testing-codex` contenía únicamente la
documentación de R5. `origin/main` no cambió. Se preservaron T23/T24/P2-T54 y
no se reejecutó ni reescribió R5.

## Auditoría y root cause

La vista de tracking ya usaba un overlay `fixed inset-0` con un área Leaflet
flexible. El defecto estaba en el contenido del overlay:

```text
CLIENT_TRACKING_FULL_BLEED=SI
CLIENT_TRACKING_TOP_SAFE_AREA_BEFORE=NO
CLIENT_TRACKING_CLOSE_SAFE_AREA_BEFORE=NO
CLIENT_TRACKING_BOTTOM_SAFE_AREA_BEFORE=NO
ROOT_CAUSE=header fijo con px-4 py-3 y flex justify-between; el contenido interactivo ignoraba safe-area superior y el título dependía de los anchos laterales; footer sin safe-area inferior
VIEWPORT_FIT_COVER=SI_GLOBAL_PRESERVADO
```

Se tomó como referencia el patrón ya certificado de Chat. El root full-bleed no
se desplazó: sólo el contenido del header recibe
`calc(env(safe-area-inset-top,0px)+0.75rem)`, el header usa
`grid-template-columns: 1fr auto 1fr`, y el footer recibe
`calc(env(safe-area-inset-bottom,0px)+0.75rem)`.

## Fileset y resultado

```text
PRODUCT_FILES_CHANGED=1
PRODUCT_FILE=src/components/tracking/delivery-tracking-map.tsx
TEST_FILES_CHANGED=1
TEST_FILE=src/components/tracking/delivery-tracking-map-safe-area.test.ts
GLOBALS_CSS_CHANGED=0
CHAT_FILES_CHANGED=0
TRACKING_LOGIC_CHANGED=NO
GPS_LOGIC_CHANGED=NO
ROUTING_LOGIC_CHANGED=NO
LEAFLET_BEHAVIOR_CHANGED=NO
MAP_MARKER_LOGIC_CHANGED=NO
MAP_FIT_BOUNDS_LOGIC_CHANGED=NO
```

El contrato focal cubre full-bleed/flex map, safe-area top, ausencia del
`px-4 py-3` plano, cierre accesible, título presente y centrado independiente,
safe-area bottom y ausencia de segundo watcher GPS. No se implementó la UX
futura de follow camera.

## Quality y testing

```text
FOCAL_SAFE_AREA_TEST_PASS=5
FOCAL_SAFE_AREA_TEST_FAIL=0
REGRESSION_TEST_PASS=82
REGRESSION_TEST_FAIL=0
ESLINT=PASS
DIFF_CHECK=PASS
BUILD=PASS
TYPECHECK=PREEXISTING_BASELINE_ERRORS_NO_TOUCHED_FILE_ERROR
```

La regresión incluyó los contratos existentes del mapa/staleness, tracking
consumer y producer, navegación in-app, safe-area de Cliente y Chat. El
typecheck conserva errores preexistentes en otros archivos; no produjo errores
en el fileset R5A.

## Testing deploy

```text
R5A_COMMIT=ee7eea740aecfd70bc0718601a7fd077a015df98
PUSH_TARGET=testing-codex
PUSH_RESULT=SUCCESS
TESTING_DEPLOYMENT_ID=50e7649e-aa79-44f9-a860-214a713049bf
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_COMMIT=ee7eea740aecfd70bc0718601a7fd077a015df98
TESTING_DEPLOYMENT_COMMIT_MATCH=YES
TESTING_DEPLOYMENT_INSTANCE=RUNNING
TESTING_PENDING_MIGRATIONS=0
TESTING_DB_ERRORS=0
MANUAL_DEPLOY_PERFORMED=NO
```

## Estado y certificación física

```text
P2_T02_R5A_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
R4_NORMAL_FLOW_CERTIFICATION=PRESERVED
CLIENT_TRACKING_SAFE_AREA_FINDING=CONFIRMED_PHYSICAL
CLIENT_TRACKING_FULL_BLEED_PRESERVED=SI
CLIENT_TRACKING_TOP_SAFE_AREA_AFTER=SI
CLIENT_TRACKING_CLOSE_VISIBLE_CONTRACT=SI
CLIENT_TRACKING_HEADER_CENTERED=SI
CLIENT_TRACKING_BOTTOM_SAFE_AREA_AFTER=SI
MAP_LAYOUT_FLEX_REMAINS_VALID=SI
GOOGLE_MAPS_LIKE_NAVIGATION_IMPLEMENTED=NO
GOOGLE_MAPS_LIKE_NAVIGATION_SCOPE_CHANGED=NO
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATION=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ACTION=OPERATOR_CLIENT_TRACKING_IOS_LAYOUT_RECERTIFICATION
```

La certificación física iPhone/PWA y el smoke Android quedan pendientes. No se
cierra automáticamente R5A ni T02 global y no se inician T23, T24 ni P2-T54.
