# DeliGO — authoritative context delta: P2-T43-R3

Fecha: 2026-09-12. Este archivo registra el snapshot documental solicitado
para el cierre de T43; no reemplaza ni copia el contexto histórico masivo
existente fuera de `codex-reports`.

## Estado

`P2_T43_STATUS=CLOSED_TESTING_CERTIFIED`

`P2_T43_RELEASE_ELIGIBLE=SI`

`P2_T43_RELEASE_STATUS=READY_FOR_PRODUCTION_PROMOTION_EVALUATION`

`P2_T43_OPERATOR_CERTIFICATION=PASS`

La evidencia física A/B/C/D/E/F y R2-1/R2-2/R2-3/R2-4 fue PASS. Los cuatro
findings T43 quedaron `RESOLVED_PHYSICALLY_CERTIFIED_TESTING`.

## Autoridades preservadas

Identidad personal: `CUENTA_OPERATIVA`. Membresía de negocio: `EMPLEADO`.
Nombre visible del empleado vinculado: `CUENTA_OPERATIVA_NOMBRE`. El campo
`Empleado.nombre` no es identidad personal. Rol/área y autorización de join
siguen bajo autoridad server-side.

Código interno: único entre empleados no eliminados por negocio; activo
duplicado DENY; código de eliminado ALLOW; fila histórica preservada. Constraint
certificado: `UNIQUE (negocioId, codigo) WHERE eliminado=false`.

## Alcance del cierre

R3 no modifica producto, tests, Prisma, migraciones, DB, Railway, main ni
Production. `FUNCTIONAL_TREE_CHANGED=NO` y `PUBLIC_RELEASE_AUTHORIZED=NO`.
Siguiente acción: `P2_T43_PRODUCTION_PROMOTION_EVALUATION`.

## P2-T02-R5 — normal flow certification and navigation handoff

```text
P2_T02_R4_STATUS=PHYSICALLY_CERTIFIED_NORMAL_FLOW
R4_NORMAL_DRIVER_ACCOUNT_USED=SI
R4_NORMAL_ORDER_FLOW_USED=SI
R4_FIXTURE_ACCOUNT_USED=NO
R4_NORMAL_ACCEPT_FLOW=PASS
R4_DRIVER_GPS_NOW_WORKS=PASS
R4_IN_APP_NAVIGATION_OPENS=PASS
R4_IN_APP_ROUTE_RENDERED=PASS
R4_FIXTURE_PARITY_FINDING=RESOLVED_FOR_NORMAL_ACCEPT_FLOW
NAVIGATION_GOOGLE_MAPS_LIKE_FOLLOW_MODE=NEW_PRODUCT_UX_REQUIREMENT
FOLLOW_CAMERA_REQUIRED=SI
RECENTER_REQUIRED=SI
DRIVER_HEADING_REQUIRED=SI
MAP_BEARING_DESIRED=SI
ONE_DEVICE_GEOLOCATION_WATCHER_AUTHORITY=SI
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
T23_NAVIGATION_FOLLOW_SCOPE=PARTIAL
T24_NAVIGATION_MAP_MATCHING_SCOPE=CONFIRMED_RELATED
DRIVER_NAVIGATION_UX_TASK_REQUIRED=SI
DRIVER_NAVIGATION_UX_TASK_ID=P2-T54
DRIVER_NAVIGATION_UX_TASK_TITLE=Driver Turn-by-Turn Follow Camera UX
P2_T02_STATUS=WAITING_FOR_REMAINING_EXTERIOR_AND_COMPLETION_PHYSICAL_EVIDENCE
NEXT_ACTION=COMPLETE_P2_T02_PHYSICAL_GATES
P2_T43_STATUS_UNCHANGED=SI
PRODUCT_FILES_CHANGED=0
TEST_FILES_CHANGED=0
FUNCTIONAL_TREE_CHANGED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

R4 queda certificado sólo para el flujo normal de aceptación. El requisito de
follow camera/bearing es nuevo, no una regresión de R4; T23 absorbe únicamente
el subalcance de trayectoria/interpolación, T24 queda relacionado por
map-matching y la UX completa se formaliza como P2-T54 sin implementación.
