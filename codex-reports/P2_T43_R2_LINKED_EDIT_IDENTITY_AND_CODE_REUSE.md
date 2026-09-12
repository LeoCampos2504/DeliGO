# P2-T43-R2 — Linked Edit Identity + Deleted Employee Code Reuse

## Resultado

Se corrigieron los dos hallazgos físicos confirmados después de R1, exclusivamente en Testing:

- El editor de empleados ya no muestra un input editable de identidad personal. Para un vínculo activo proyecta `CuentaOperativa.nombre` como sólo lectura; para una fila pendiente muestra `Pendiente de vinculación` como estado sólo lectura.
- El editor envía únicamente código interno y área/rol operativos. No muta `Empleado.nombre` ni `CuentaOperativa.nombre`.
- El código interno queda reutilizable sólo después de `eliminado=true`. Un empleado inactivo pero no eliminado sigue bloqueando el código.
- La fila histórica soft-deleted permanece intacta, incluyendo su código y referencias históricas por `empleadoId`.

T43-A y T43-B se preservan: alta sin nombre personal y join de CuentaOperativa existente siguen PASS.

## Causa raíz de code reuse

La base tenía el índice único global:

```text
empleados_negocioId_codigo_key UNIQUE (negocioId, codigo)
```

Ese índice no distinguía entre empleados activos y filas históricas soft-deleted. Además, había dos usos productivos del selector Prisma `negocioId_codigo`: alta y edición. Ambos fueron reemplazados por `findFirst` server-side con `negocioId`, `codigo` y `eliminado=false`. El endpoint público `by-codigo` ya usaba el filtro activo/no eliminado y quedó preservado.

La eliminación continúa siendo soft-delete (`activo=false`, `eliminado=true`); no se borra la fila ni se reescribe el código histórico. `Pedido.empleadoId` y `Pedido.empleadoNombre` permanecen intactos.

## Estrategia DB y migración

La política aprobada requiere una unicidad parcial PostgreSQL:

```sql
UNIQUE (negocioId, codigo) WHERE eliminado = false
```

Prisma 6.19.2 no representa índices únicos parciales en su DSL. Se retiró `@@unique([negocioId, codigo])` del schema y se agregó una migración manual, sin cambios de datos:

```sql
DROP INDEX IF EXISTS "empleados_negocioId_codigo_key";
CREATE UNIQUE INDEX "empleados_negocioId_codigo_active_key"
  ON "empleados" ("negocioId", "codigo")
  WHERE "eliminado" = false;
```

La migración `20260912090000_allow_deleted_employee_code_reuse` se aplicó mediante `prisma migrate deploy` en Testing. `prisma migrate status` confirmó el schema actualizado y 0 pendientes.

## Marcadores

```text
T43_PHYSICAL_A_PENDING_EMPLOYEE_NO_PERSONAL_NAME=PASS
T43_PHYSICAL_B_EXISTING_ACCOUNT_JOIN=PASS
T43_PHYSICAL_FINDING_LINKED_EDIT_IDENTITY=CONFIRMED
EDIT_LINKED_IDENTITY_DISPLAY_BEFORE=FAIL
LINKED_EMPLOYEE_EDIT_NAME_SOURCE=CUENTA_OPERATIVA_NOMBRE
LINKED_EMPLOYEE_EDIT_NAME_EDITABLE=NO
PENDING_EMPLOYEE_EDIT_IDENTITY_STATE=READ_ONLY_PENDING_LINK

T43_PHYSICAL_FINDING_DELETED_EMPLOYEE_CODE_REUSE=CONFIRMED
EMPLOYEE_INTERNAL_CODE_UNIQUENESS_POLICY=UNIQUE_AMONG_NON_DELETED_EMPLOYEES_PER_BUSINESS
INACTIVE_EMPLOYEE_CODE_REUSE=DENY
DELETED_EMPLOYEE_CODE_REUSE=ALLOW
HISTORICAL_EMPLOYEE_ROW_PRESERVED=YES
CURRENT_EMPLOYEE_CODE_DB_CONSTRAINT_BEFORE=UNIQUE empleados_negocioId_codigo_key (negocioId, codigo)
CURRENT_EMPLOYEE_CODE_DB_CONSTRAINT_AFTER=UNIQUE empleados_negocioId_codigo_active_key (negocioId, codigo) WHERE eliminado=false
CODE_REUSE_SCHEMA_CHANGE_REQUIRED=SI
CODE_REUSE_NEW_MIGRATION_REQUIRED=SI
CODE_REUSE_DATA_BACKFILL_REQUIRED=NO
MIGRATION_SQL_CLASSIFICATION=DROP_OLD_UNIQUE_INDEX_PLUS_CREATE_PARTIAL_UNIQUE_INDEX_NO_DATA_CHANGE
MIGRATION_DATA_UPDATE=NO
MIGRATION_DELETE=NO
MIGRATION_TRUNCATE=NO
MIGRATION_DROP_TABLE=NO
NEGOCIO_ID_CODIGO_UNIQUE_SELECTOR_USAGE_COUNT_BEFORE=2
NEGOCIO_ID_CODIGO_UNIQUE_SELECTOR_USAGE_COUNT_AFTER=0
PROJECTION_OVER_LEGACY_MUTATION=SI

JOIN_REGRESSION=PASS
T02_FILES_CHANGED=0
T02_HUNKS_CHANGED=0
T42_TOUCHED=NO
T46_TOUCHED=NO
T48_TOUCHED=NO
FOCAL_TEST_PASS=14
FOCAL_TEST_FAIL=0
REGRESSION_TEST_PASS=62
REGRESSION_TEST_FAIL=0
NEW_FAIL=NO
ESLINT_NEW_FINDINGS=0
DIFF_CHECK_PASS=PASS
BUILD_PASS=PASS
TYPECHECK=UNAVAILABLE_PREEXISTING_NO_TYPESCRIPT_BINARY

P2_T43_R2_STATUS=IMPLEMENTED_TESTED
P2_T43_R2_COMMIT=401fa5676607298f3b0ccf2eae0618cecac3b766
PUSH_TO_TESTING=YES
TESTING_DEPLOYMENT_ID=c09f5a6c-4261-4a76-b446-2c6aab4fe393
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_COMMIT_MATCH=YES
TESTING_PENDING_MIGRATIONS=0
TESTING_DB_ERRORS=0
TESTING_LOGS_CLEAN=YES
TESTING_HTTP_SMOKE=5/5_NO_MUTATING_REQUESTS

P2_T43_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_RECERTIFICATION
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
NEXT_ACTION=OPERATOR_P2_T43_R2_RECERTIFICATION
```

## Fileset R2

- `prisma/schema.prisma`
- `prisma/migrations/20260912090000_allow_deleted_employee_code_reuse/migration.sql`
- `src/app/api/negocio/empleados/route.ts`
- `src/app/api/negocio/empleados/[id]/route.ts`
- `src/app/api/negocio/empleados/route.test.ts`
- `src/components/business/salon-tab.tsx`
- `src/components/business/salon-tab-employee-identity-feedback.test.ts`

No se modificó `salon-config.tsx`: continúa fuera de la superficie activa alcanzable por el panel principal.

## Validación

R2 + R1 focal: 14 pass / 0 fail / 72 aserciones. Regresión dirigida de empleados, Salón, APIs legacy, join/invitaciones, T41, T42 y T48: 62 pass / 0 fail. Los tests T41/T42/T48 se ejecutaron con timeout ampliado para evitar falsos negativos por la latencia observada de la base TESTING.

ESLint focal, `git diff --check`, Prisma generate, Prisma migration status y build pasaron. El typecheck sigue no disponible por ausencia preexistente del binario TypeScript; el build compiló correctamente omitiendo la validación de tipos.

## Recertificación física pendiente

No repetir A/B. Ejecutar sólo:

1. Empleado vinculado → Editar: confirmar nombre real de CuentaOperativa visible y no editable.
2. Cambiar rol/área: confirmar que funciona sin alterar la identidad.
3. Empleado eliminado con código `ABC` → crear nuevo `ABC`: confirmar permitido.
4. Con un `ABC` no eliminado → crear otro `ABC`: confirmar rechazo.

Después continuar con los casos pendientes originales de refresh/feedback.
