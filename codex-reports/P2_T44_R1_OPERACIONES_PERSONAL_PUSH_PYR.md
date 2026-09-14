# P2-T44-R1 — Operaciones Personal Push UX + PyR Subscription

Fecha: 2026-09-14
Proyecto: DeliGO
Alcance: Testing únicamente; sin Production.

## Autoridad y baseline

```text
P2_T44_A0_STATUS=COMPLETED_AUDIT_READY_FOR_R1
P2_T44_R1_BASELINE_SHA=4988b49b4a78920148ab950efd94150b229844c8
P2_T44_R1_BRANCH=work/p2-t43-r2
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
```

## Implementación

```text
P2_T44_R1_STATUS=IMPLEMENTED_TESTING_DEPLOYED_AWAITING_OPERATOR
P2_T44_R1_COMMIT_SHA=cee754289a1a30302f7c3dcd1a749213a051344f
REMOTE_TESTING_SHA=cee754289a1a30302f7c3dcd1a749213a051344f
```

Se aplicó únicamente el alcance aprobado:

- La UI normal de Mozo ya no expone `Enviar prueba` ni llama al endpoint de
  prueba.
- El endpoint de diagnóstico legado queda fail-closed fuera de Testing y
  exige el header opt-in exacto `x-deligo-push-diagnostic: push-test`.
- Se agregó el endpoint normal de suscripción Push de PyR Personal,
  autenticado por la resolución existente de Empleado, negocio, cuenta y
  área `pyr`.
- PyR Personal permite activar y desactivar avisos desde
  `/operaciones/mi-panel/[slug]/pyr/pedidos`, conservando los estados de
  instalación, permiso, navegador no compatible, bloqueo y error.
- La suscripción PyR mantiene la escritura dual compatible entre el campo
  legado de `Empleado` y el repositorio normalizado de Push, sin aceptar
  identificadores de actor enviados por el cliente.

No se modificaron esquema Prisma, migraciones, productores normales PyR,
realtime, Service Worker, Drawer global ni el CSS del popover móvil.

```text
SEND_TEST_VISIBLE_AFTER_R1=NO
PUSH_TEST_ROUTE_PRESERVED=SI
PUSH_TEST_ROUTE_TESTING_GUARD=SI
PUSH_TEST_ROUTE_NORMAL_UI_ACCESSIBLE=NO
PYR_PUSH_ENABLE_UI_IMPLEMENTED=SI
PYR_PUSH_DISABLE_UI_IMPLEMENTED=SI
PYR_PUSH_STATUS_UI_IMPLEMENTED=SI
PYR_PUSH_ROUTE=/api/operativo/pyr/panel/[slug]/push-subscription
PYR_PUSH_AUTHORIZATION=PASS
PYR_PUSH_BUSINESS_ISOLATION=PASS
PYR_SUBSCRIPTION_STATUS_SOURCE=LEGACY_AND_NORMALIZED
LEGACY_NORMALIZED_STATUS_MISMATCH_HANDLED=SI
PYR_CANCELLATION_FANOUT_TEST=PASS
PUSH_NAVIGATION_REGRESSION=PASS
PUSH_ACTOR_BINDING=PASS
PUSH_BUSINESS_ISOLATION=PASS
PYR_PUSH_ARBITRARY_OWNER_ALLOWED=NO
PUSH_TEST_ROUTE_PRODUCTION_AVAILABLE=NO
DB_SCHEMA_CHANGED=NO
PRISMA_MIGRATION_CREATED=NO
REALTIME_CHANGED=NO
SERVICE_WORKER_CHANGED=NO
MOBILE_POPOVER_CHANGED=NO
```

## Validación automatizada

```text
P2_T44_R1_FOCAL_TESTS=18_PASS_0_FAIL
MOZO_REGRESSION=12_PASS_0_FAIL
SALON_REGRESSION=12_PASS_0_FAIL
PYR_MESSAGING_REGRESSION=20_PASS_0_FAIL
CANCELLATION_REGRESSION=10_PASS_0_FAIL
SERVICE_WORKER_REGRESSION=34_PASS_0_FAIL
PYR_INTEGRATION_OPERATIVO_SALON=6_PASS_0_FAIL
PYR_INTEGRATION_ORDER_WORKFLOW=6_PASS_0_FAIL
ESLINT_FOCAL=PASS
GIT_DIFF_CHECK=PASS
BUILD=PASS
```

El typecheck global (`bunx tsc --noEmit`) conserva errores preexistentes en
`prisma/seed.ts`, `scripts/migrate-sqlite-to-postgres.ts`, rutas/componentes
no relacionados, tests existentes y `src/lib/push.ts`; no reportó errores en
los archivos nuevos o modificados de T44-R1.

Las pruebas de integración se ejecutaron con `DATABASE_URL` asignado sólo al
valor ya configurado de `DELIGO_TEST_DATABASE_URL` en el proceso de pruebas;
el secreto no se imprimió ni se persistió.

## Deploy y fixture

```text
P2_T44_R1_TESTING_DEPLOYMENT_ID=bbf365fa-180c-4cbd-b03b-3c07edea2fba
P2_T44_R1_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
P2_T44_R1_TESTING_DEPLOYMENT_COMMIT=cee754289a1a30302f7c3dcd1a749213a051344f
TEST_T44_FIXTURE=TEST_T44_24B0A1FC_NEGOCIO
TEST_T44_BUSINESS_SLUG=test_t44_24b0a1fc-negocio
TEST_T44_FIXTURE_CREATED=SI
OPERATOR_PHYSICAL_CONFIRMATION=PENDING
```

El fixture contiene una cuenta Mozo y una cuenta PyR vinculadas al mismo
negocio Testing; no contiene pedidos ni suscripciones Push precreadas. Las
credenciales temporales se entregaron sólo en runtime y no se persisten aquí.
La validación física queda pendiente. No se cierra la tarea con una
observación humana inventada: el cierre requiere que el
operador confirme en teléfono que PyR Personal puede activar avisos y que la
navegación desde el aviso abre la pantalla de pedidos/reseñas correspondiente.

## Estado de salida esperado

```text
P2_T44_R1_STATUS=IMPLEMENTED_TESTING_DEPLOYED_AWAITING_OPERATOR
P2_T44_R1_OPERATOR_CERTIFICATION=PENDING
P2_T44_R1_RELEASE_ELIGIBLE=NO
PRODUCTION_TOUCHED=NO
REPORT_CREATED=SI
FULL_CONTEXT_UPDATED=SI
FULL_CONTEXT_CONSISTENCY_CHECK=PASS
NEXT_ACTION=PREPARE_TEST_T44_FIXTURE_AND_WAIT_FOR_OPERATOR_VALIDATION
```
