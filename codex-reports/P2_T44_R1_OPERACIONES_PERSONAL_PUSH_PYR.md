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
P2_T44_R1_STATUS=IMPLEMENTED_TESTING_AWAITING_COMMIT
P2_T44_R1_COMMIT_SHA=TO_BE_RECORDED_AFTER_COMMIT
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
P2_T44_R1_TESTING_DEPLOYMENT=TO_BE_RECORDED_AFTER_DEPLOY
P2_T44_R1_TESTING_DEPLOYMENT_STATUS=NOT_STARTED
TEST_T44_FIXTURE=NOT_PREPARED
OPERATOR_PHYSICAL_CONFIRMATION=PENDING
```

La preparación física queda pendiente del deploy Testing. No se cierra la
tarea con una observación humana inventada: el cierre requiere que el
operador confirme en teléfono que PyR Personal puede activar avisos y que la
navegación desde el aviso abre la pantalla de pedidos/reseñas correspondiente.

## Estado de salida esperado

```text
P2_T44_R1_STATUS=IMPLEMENTED_TESTING_DEPLOYED_AWAITING_OPERATOR
P2_T44_R1_OPERATOR_CERTIFICATION=PENDING
P2_T44_R1_RELEASE_ELIGIBLE=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=PREPARE_TEST_T44_FIXTURE_AND_WAIT_FOR_OPERATOR_VALIDATION
```
