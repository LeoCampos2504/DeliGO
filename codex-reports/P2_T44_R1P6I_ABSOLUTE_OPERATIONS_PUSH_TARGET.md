# P2-T44-R1P6I — Operations notificationclick con target absoluto

Fecha: 2026-09-18  
Alcance: implementación mínima, pruebas y deploy únicamente a Railway TESTING.  
Prueba física R1P6J: no ejecutada.

## Resultado

El control físico R1P6H en el mismo iPhone confirmó que Cliente con un
WindowClient existente en background recibe el Push y navega correctamente al
deep link de pedido. Por eso la hipótesis global de fallo de
`notificationclick`, de `WindowClient` o de `navigate()` queda refutada para
este dispositivo. La diferencia Operations-relative vs Personal-absolute gana
relevancia, pero la URL relativa sigue siendo una causa soportada, no probada.

La rama compartida de Operations mantiene `targetUrl` como path interno
validado y ahora deriva `absoluteTarget = self.location.origin + targetUrl`.
Sólo ese valor absoluto se entrega a `navigate()` y `openWindow()` en los cinco
tipos de Operations. Se preservaron validación, selección de clients, orden
`await navigate → focus`, fallback y catch.

## Auditoría del cambio

```text
DEVICE_PLATFORM=iOS
P2_T44_R1P6H_PHYSICAL_CONTROL=PASS
IOS_NOTIFICATIONCLICK_GLOBALLY_BROKEN_ON_THIS_DEVICE=REFUTED
EXISTING_WINDOWCLIENT_ALONE_CAUSES_FAILURE=REFUTED
WINDOWCLIENT_NAVIGATE_GLOBALLY_BROKEN_ON_THIS_DEVICE=REFUTED
SHARED_SW_GLOBALLY_BROKEN=REFUTED
OPERATIONS_SPECIFIC_DIFFERENCE_RELEVANCE=INCREASED
RELATIVE_URL_ROOT_CAUSE=SUPPORTED_BUT_UNPROVEN

TRACE_VERSION=P2_T44_R1P6E_SW_TRACE_V2
ROUTING_VERSION=P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET
OPERATIONS_TARGET_PATH_FORM=RELATIVE_VALIDATED_PATH_PRESERVED
OPERATIONS_NAVIGATION_ARGUMENT_FORM=self.location.origin + targetUrl
OPERATIONS_OPENWINDOW_ARGUMENT_FORM=self.location.origin + targetUrl
TARGET_VALIDATION_CHANGED=NO
CLIENT_MATCH_POLICY_CHANGED=NO
FOCUS_ORDER_CHANGED=NO
FALLBACK_SEMANTICS_CHANGED=NO
PUSH_PRODUCER_CHANGED=NO
AUTH_CHANGED=NO
DB_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
MANIFEST_CHANGED=NO
```

No personal, legacy salon, mesa, Mozo, producer G4/G5, G6 or G1 branch was
changed. No workaround iOS was added. No order was created or accepted, no
Push was sent, no phone was touched and no subscription switch was changed.

## Tests

Focused validation passed:

```text
sw-notificationclick-target-routing.test.ts: 40 pass / 0 fail
sw-push-role-icon-routing.test.ts: 32 pass / 0 fail
debug-sw-trace/route.test.ts: 15 pass / 0 fail
node --check public/sw.js: PASS
ESLint touched files: PASS
bun run build: PASS
git diff --check: PASS
```

The complete `bun test` run is not a valid green gate in this local checkout:
it produced `3487 pass / 200 fail / 8 errors` across 304 files because database
integration suites run without `DATABASE_URL` and some chat-service hooks time
out. These failures are pre-existing environment/integration limitations and
are unrelated to the touched Service Worker/tests. No database command,
migration or `db push` was run.

`bunx tsc --noEmit` reports the known baseline of 31 pre-existing errors; no
new error was introduced in the touched files (`TSC_NEW_ERRORS=0`).

## Commit and TESTING deployment

```text
R1P6I_COMMIT_SHA=PENDING_COMMIT
TESTING_DEPLOY_ID=PENDING_DEPLOY
TESTING_DEPLOY_STATUS=PENDING_DEPLOY
TESTING_DEPLOY_COMMIT=PENDING_DEPLOY
```

The intended target is Railway project `amiable-rejoicing`, environment
`TESTING`, service `DeliGO Copy` only. Production is out of scope.

## Live check and next action

After the TESTING deployment, verify the served `public/sw.js` contains the
trace version, the new routing version and the absolute Operations calls, with
no relative Operations `navigate`/`openWindow` call and the durable R1P6E trace
code still present.

```text
LIVE_TRACE_VERSION=PENDING_LIVE_CHECK
LIVE_ROUTING_VERSION=PENDING_LIVE_CHECK
LIVE_ABSOLUTE_OPERATIONS_TARGET_CODE=PENDING_LIVE_CHECK
LIVE_RELATIVE_OPERATIONS_NAVIGATE_CALL=PENDING_LIVE_CHECK
LIVE_RELATIVE_OPERATIONS_OPENWINDOW_CALL=PENDING_LIVE_CHECK
R1P6E_DURABLE_TRACE_STILL_PRESENT=PENDING_LIVE_CHECK
G3_PHYSICAL_CERTIFIED=NO
R1P6J_PREPARATION_READY=SI
NEXT_ACTION=P2_T44_R1P6J_SINGLE_PHYSICAL_ABSOLUTE_URL_PROBE
```

R1P6J queda solamente preparado: una única sonda con Operations Home abierta
o recargada, luego background, un pedido retiro ya existente del fixture,
un Push y un tap. No ejecutar la sonda en esta tarea.
