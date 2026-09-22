# P2-T55 — Cierre final: certificación física + visual en TESTING

Fecha: 2026-09-20
Alcance: DOCUMENTACIÓN / RECONCILIACIÓN DE ESTADO ÚNICAMENTE. Sin código
de producto, sin nueva implementación, sin prueba física por Claude, sin
mutación de DB, sin Production.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=b7fa2eeaf0ad1d52dbb72d0613dec3650d5ba36a
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión, ajenos a este cierre: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 confirmado intacto (`54d17d56f1781ab4d0fd4f1d808df194bdf76a9d`),
no tocado. `origin/main` reconfirmado en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` — Production sin cambios.

## 2. Línea de implementación certificada

```text
P2_T55_R1_COMMIT_SHA=da7d08b27ea15673ef42009fda996c2bd02b9b9a
P2_T55_R1_DEPLOY_ID=50da9aa4-81dc-4f60-a31f-9c4197907c8b

P2_T55_R1B_COMMIT_SHA=4f7b3355269768b9ef69ca650ac4faa6e1342bd2
P2_T55_R1B_DEPLOY_ID=7a3e8d12-66b4-4214-b963-6e5480a441df

P2_T55_CERTIFIED_RUNTIME_SHA=4f7b3355269768b9ef69ca650ac4faa6e1342bd2
P2_T55_CERTIFIED_DEPLOY_ID=7a3e8d12-66b4-4214-b963-6e5480a441df
```

R1 implementó el filtro de fecha personalizado (día/mes/rango) para
Historial de Salón, extrayendo el parseo seguro compartido con T50 a
`src/lib/date-range-filter.ts` y extendiendo aditivamente
`GET /api/negocio/pedidos` — ver
`codex-reports/P2_T55_R1_SALON_HISTORY_CUSTOM_DATE_FILTERING.md` para el
detalle completo. R1B ajustó únicamente los `className` de las pills
Hoy/Semana/Mes para dar paridad visual con Estadísticas, sin tocar
lógica — ver `codex-reports/P2_T55_R1B_HISTORY_FILTER_VISUAL_PARITY.md`.

## 3. Certificación física del operador

El operador probó físicamente el flujo real de Historial de Salón
(filtros rápidos, filtros custom, detalle de cuenta, ticket) y confirmó
explícitamente: *"quedó perfecto todo"*.

```text
P2_T55_PHYSICAL_CERTIFICATION=PASS
```

Funcionalidad confirmada por el operador: Hoy, Semana, Mes rápido, Día
específico, Mes específico, Rango Desde/Hasta, cambio entre filtros,
detalle de cuenta, ticket, comportamiento general de Historial.

## 4. Paridad visual R1B

El operador pidió únicamente paridad visual entre Salón → Estadísticas
y Salón → Historial para Hoy/Semana/Mes. R1B modificó solo los
`className` del segmented-control (contenedor + botón de las 3 pills),
sin tocar el botón "Elegir fecha" ni el Popover (ya eran idénticos desde
R1), sin tocar ningún handler ni el array de valores. El operador
confirmó después: *"quedó perfecto todo"*.

```text
P2_T55_R1B_VISUAL_CERTIFICATION=PASS
HISTORY_STATISTICS_FILTER_VISUAL_PARITY=PASS
```

## 5. Funcionalidad certificada

```text
QUICK_FILTER_HOY=PASS
QUICK_FILTER_SEMANA=PASS
QUICK_FILTER_MES=PASS

CUSTOM_DAY_FILTER=PASS
CUSTOM_MONTH_FILTER=PASS
CUSTOM_RANGE_FILTER=PASS
SAME_DAY_RANGE=PASS

CUSTOM_APPLY=PASS
CUSTOM_CANCEL=PASS
CUSTOM_CLEAR_TO_HOY=PASS

QUERY_KEY_FILTER_ISOLATION=PASS

DETAIL_ACCOUNT_PRESERVED=PASS
TICKET_PRESERVED=PASS
PAYMENT_METHOD_T46_PRESERVED=PASS

MOBILE_FILTER_LAYOUT=PASS
VISUAL_PARITY_WITH_STATISTICS=PASS
```

## 6. Contrato funcional preservado

```text
HISTORY_CANONICAL_DATE_FIELD=Pedido.fecha

HISTORY_INCLUDED_STATES_UNCHANGED=SI
HISTORY_GROUPING_CHANGED=NO

HISTORIAL_QUICK_MES_SEMANTICS=30_DIAS_FIJOS
CUSTOM_MONTH_SEMANTICS=CALENDAR_MONTH

NEW_TODO_FILTER_ADDED=NO
CUSTOM_CLEAR_TARGET=hoy

PAGINATION_BEHAVIOR_CHANGED=NO
LOAD_MORE_ADDED=NO
HISTORY_PAGE_SIZE=50
```

## 7. T46 preservado

```text
T46_ACCOUNT_GROUPING_CHANGED=NO
T46_ACCOUNT_DETAIL_CHANGED=NO
T46_TICKET_CHANGED=NO
T46_PAYMENT_AUTHORITY_CHANGED=NO
```

`SesionOcupacionMesa` sigue siendo la autoridad exclusiva del pago de
cuenta. T55 sólo filtra qué `Pedido[]` entran al historial —
`mesa-historial.ts`/`buildMesaHistorialAccounts`/`accountKey`/
`buildCuentaMesa`/`withCuentaMesaPayment` nunca fueron tocados en R1 ni
en R1B.

## 8. T50 preservado

```text
P2_T50_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
T50_BEHAVIOR_CHANGED=NO
```

T50 quick filters (Hoy/Semana/Mes/Todo) y custom (Día/Mes/Rango) sin
regresión — certificado por la suite de T50 sin modificar (53/53 pass)
en R1, no re-ejecutada en R1B por no haberse tocado ningún archivo
compartido con T50 en esa ronda.

## 9. Evidencia automatizada (preservada, no re-ejecutada en este cierre)

Evidencia R1:

```text
FOCAL_TESTS_NEW=45 PASS / 0 FAIL
T50_REGRESSION_TESTS=53 PASS / 0 FAIL
T46_REGRESSION_TESTS=8 PASS / 0 FAIL

TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0

ESLINT=PASS
BUILD=PASS
DIFF_CHECK=PASS
```

Evidencia R1B:

```text
TESTS_RUN=98 PASS / 0 FAIL

TSC_TOTAL_ERRORS_R1B=31
TSC_BASELINE_ERRORS_R1B=31
TSC_NEW_ERRORS_R1B=0

ESLINT_R1B=PASS
BUILD_R1B=PASS
DIFF_CHECK_R1B=PASS
```

No se re-ejecutan suites en este cierre (documentación pura, cero
archivos de producto/test tocados).

## 10. Estado final

```text
P2_T55_IMPLEMENTATION_COMPLETE=SI
P2_T55_AUTOMATED_CERTIFICATION=PASS
P2_T55_PHYSICAL_CERTIFICATION=PASS
P2_T55_VISUAL_CERTIFICATION=PASS
P2_T55_STATUS=CLOSED_TESTING_CERTIFIED
P2_T55_RELEASE_ELIGIBLE=YES
P2_T55_PRODUCTION_PROMOTED=NO
```

## 11. Production

```text
PRODUCTION_TOUCHED=NO
```

No merge a `main`. No deploy Production. No tag Production. No
migraciones.

## 12. Otros estados — preservados sin cambios

```text
P2_T47_STATUS=CLOSED_TESTING_CERTIFIED
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
P2_T49_STATUS=CLOSED_TESTING_CERTIFIED
P2_T45_STATUS=CLOSED_TESTING_CERTIFIED
P2_T43_STATUS=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
P2_T46_ORIGINAL_STATUS=CLOSED_PRODUCTION
P2_T46_R2_STATUS=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING=OPEN
T39_TOUCHED=NO
```

## 13. Cierre

```text
PRODUCT_FILES_CHANGED_DURING_CLOSEOUT=0
API_FILES_CHANGED_DURING_CLOSEOUT=0
TEST_FILES_CHANGED_DURING_CLOSEOUT=0
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_MUTATED=NO
REALTIME_CHANGED=NO
PUSH_CHANGED=NO
PRODUCTION_TOUCHED=NO
```
