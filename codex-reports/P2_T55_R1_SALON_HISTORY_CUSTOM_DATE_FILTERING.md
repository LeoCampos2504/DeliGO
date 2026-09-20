# P2-T55-R1 — Salon History Custom Date Filtering: implementación + tests + deploy TESTING

Fecha: 2026-09-20
Alcance: código de producto (backend + UI) + tests. Sin Production, sin
prueba física por Claude, sin mutación de DB, sin cambio de schema.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=345ab110c8e3b498b3fc80419ac4a4592c17c944 (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión, ajenos a este task: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 confirmado intacto, no tocado. `origin/main` reconfirmado
en `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` antes y después del deploy
— Production sin cambios.

## 2. Diseño de referencia

Implementa exactamente lo diseñado en
`codex-reports/P2_T55_A0_SALON_HISTORY_CUSTOM_DATE_FILTERING_AUDIT_DESIGN.md`,
con la corrección de producto explícita del task R1: **NO se agrega un
quick filter "Todo" a Historial** — la acción "Limpiar" del selector
custom vuelve siempre a "Hoy".

## 3. Archivos modificados/creados

```text
src/lib/date-range-filter.ts                              (NUEVO)
src/lib/date-range-filter.test.ts                          (NUEVO)
src/app/api/negocio/salon/stats/route.ts                   (refactor — sin cambio de comportamiento)
src/app/api/negocio/pedidos/route.ts                        (extensión aditiva de GET)
src/app/api/negocio/pedidos/historial-date-filter.test.ts  (NUEVO)
src/components/business/salon-tab.tsx                       (HistorialSubTab + helpers)
src/components/business/salon-historial-filter.test.ts     (NUEVO)
```

### 3.1 `src/lib/date-range-filter.ts`

Autoridad pequeña y pura, extraída verbatim de la lógica de P2-T50-R1:
`parseIsoDateComponents`, `parseIsoMonthComponents` y
`resolveCustomDateFilter(params)` — resuelve fecha/mes/desde+hasta con
precedencia `fecha > mes > rango > none`, devolviendo `{status:"none"}`
(el caller cae a su propio quick filter), `{status:"invalid"}` (400) o
`{status:"custom", from, toExclusive, periodo}`. No contiene lógica de
quick filters — esa semántica sigue siendo local a cada route.ts porque
diverge entre superficies (ver §3.3).

### 3.2 `src/app/api/negocio/salon/stats/route.ts`

Refactor puro: se elimina la definición local de
`parseIsoDateComponents`/`parseIsoMonthComponents` y el bloque de
resolución de precedencia, reemplazados por una llamada a
`resolveCustomDateFilter`. La rama de quick filters (hoy/semana/mes/todo,
mes = mes calendario) queda intacta, sin tocar. Cero cambio de
comportamiento externo — certificado por la suite existente de T50
(53/53 pass, sin modificar ni un solo test).

### 3.3 `src/app/api/negocio/pedidos/route.ts`

Extensión aditiva del `GET`: se agregan los mismos 4 query params
(`fecha`, `mes`, `desde`, `hasta`) resueltos por el mismo helper
compartido, con la misma precedencia sobre el `periodo` existente. La
rama de quick filters de ESTE endpoint permanece intacta y sin tocar:
`"mes"` acá sigue siendo 30 días fijos (no mes calendario) — divergencia
intencional preexistente frente a `salon/stats`, documentada en el A0 y
preservada. Los otros dos llamadores del endpoint
(`orders-tab.tsx` vista general, `salon-tab.tsx` superficie "activos")
nunca envían estos 4 params nuevos, así que su comportamiento es
idéntico a antes (`customOutcome.status === "none"` siempre para ellos).
Nada se tocó en `mesa-historial.ts` / `buildMesaHistorialAccounts` /
`accountKey` / `buildCuentaMesa` / `withCuentaMesaPayment` — sólo cambia
QUÉ conjunto de `Pedido[]` entra a esas funciones, nunca cómo agrupan.

### 3.4 `src/components/business/salon-tab.tsx` — `HistorialSubTab`

Se agrega el tipo `HistorialFilter` (mismo patrón discriminado que
`StatsFilter` de T50, pero sin el kind "todo"):

```ts
export type HistorialQuickPeriodo = "hoy" | "semana" | "mes"
export type HistorialFilter =
  | { kind: "quick"; periodo: HistorialQuickPeriodo }
  | { kind: "day"; fecha: string }
  | { kind: "month"; mes: string }
  | { kind: "range"; desde: string; hasta: string }
```

Junto con `buildHistorialQuery`, `getHistorialFilterQueryKey`,
`getHistorialFilterLabel` (exportados, testeados por contrato estático).
Reutiliza sin duplicar los helpers genéricos ya exportados por T50:
`dateToIsoDateString`, `isoDateStringToDate`, `formatDayLabel`,
`formatMonthLabel`, `validateStatsRangeDraft` — ninguno es específico de
Estadísticas, son utilidades de fecha puras.

UI: el estado local `periodo` se reemplaza por `appliedFilter:
HistorialFilter` (`{kind:"quick", periodo:"hoy"}` por defecto). Se
agrega un botón "Elegir fecha" (Popover) idéntico visualmente al de
Estadísticas — Día/Mes/Rango con `StatsDatePicker`/`Select` — con una
acción **"Limpiar"** visible sólo cuando hay un filtro custom aplicado,
que vuelve siempre a `{kind:"quick", periodo:"hoy"}` (nunca a "ausencia
total de periodo"). Tocar cualquier pill Hoy/Semana/Mes reemplaza
automáticamente cualquier filtro custom activo (mismo mecanismo de
discriminated union que T50: sólo un `kind` puede estar activo).

La query de React Query pasa de
`["mesa-history", negocio.id, selectedMesa?.numero, periodo]` a
`getHistorialFilterQueryKey(negocio.id, selectedMesa?.numero,
appliedFilter)`, y el fetch de `?periodo=${periodo}` a
`?${buildHistorialQuery(appliedFilter)}` — nunca colisiona entre mesas
ni entre modos de filtro distintos (certificado por contrato estático).

## 4. Preservado sin cambios (verificado)

```text
MESA_HISTORIAL_GROUPING_LOGIC_TOUCHED=NO
BUILD_CUENTA_MESA_TOUCHED=NO
ACCOUNT_KEY_TOUCHED=NO
MESA_ACCOUNT_DETAIL_TOUCHED=NO
MESA_ACCOUNT_TICKET_DIALOG_TOUCHED=NO
HISTORIAL_QUICK_MES_SEMANTICS=30_DIAS_FIJOS (sin cambio, diverge de T50 por diseño)
HISTORIAL_INCLUYE_CANCELADO=SI (sin cambio, diverge de T50 por diseño)
HISTORIAL_PAGINACION=page+limit fijo 50, sin cursor (riesgo preexistente documentado, no corregido)
NEW_TODO_FILTER_ADDED=NO
CUSTOM_CLEAR_TARGET=hoy
T50_STATS_EXTERNAL_BEHAVIOR_CHANGED=NO
```

## 5. Evidencia automatizada

```text
FOCAL_TESTS_NUEVOS=45 PASS / 0 FAIL
  - src/lib/date-range-filter.test.ts (helper compartido, 18 tests)
  - src/components/business/salon-historial-filter.test.ts (contrato UI, 12 tests)
  - src/app/api/negocio/pedidos/historial-date-filter.test.ts (backend, 15 tests)

T50_REGRESSION_TESTS=53 PASS / 0 FAIL
  - src/app/api/negocio/salon/stats/route.test.ts
  - src/components/business/salon-stats-filter.test.ts
  (ejecutados TAL CUAL, sin modificar un solo assert, contra el route.ts
  refactorizado — confirma cero regresión del helper compartido)

T46_REGRESSION_TESTS=8 PASS / 0 FAIL
  - src/app/api/operativo/mozo/panel/[slug]/pedidos/route.test.ts
  (ejecutado en invocación aislada — bun:test comparte mocks de módulo
  a nivel de proceso; correrlo junto a los otros archivos de este mismo
  gate produce una colisión de mocks de "@/lib/auth" preexistente,
  reproducida IDÉNTICA contra el baseline sin el diff de esta tarea vía
  git stash — no atribuible a T55-R1)

TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS (0 warnings/errors en los 7 archivos tocados/creados)
BUILD=PASS
DIFF_CHECK=PASS
```

## 6. Commit / push / deploy

```text
P2_T55_R1_COMMIT_SHA=da7d08b27ea15673ef42009fda996c2bd02b9b9a
COMMIT_PARENT=345ab110c8e3b498b3fc80419ac4a4592c17c944 (== origin/testing-codex antes del push)
PUSH_TARGET=origin/testing-codex
PUSH_RESULT=FAST_FORWARD (345ab11..da7d08b)

TESTING_SERVICE=DeliGO Copy
TESTING_DEPLOY_ID=50da9aa4-81dc-4f60-a31f-9c4197907c8b
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT_HASH_MATCH=SI (da7d08b27ea15673ef42009fda996c2bd02b9b9a)
BOOT_LOGS_CLEAN=SI (sin errores/excepciones/500s; "No pending migrations
  to apply" — coherente con SCHEMA_CHANGED=NO; servidor "Ready" normal)

PRODUCTION_TOUCHED=NO (origin/main sin cambios: ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763)
```

## 7. Fixture candidata para certificación física R2 (read-only, sin fabricar)

Se consultó, en modo READ-ONLY (sin escritura, sin mutación), la base de
TESTING vía `railway run --service Postgres` con `DATABASE_PUBLIC_URL`
(nunca se materializó la contraseña en un comando tipeado), buscando
negocios con `salonActivo=true`, `aprobado=true`, `suspendido=false`,
con mesas creadas y pedidos históricos de mesa con fechas dispersas
(útil para probar día/mes/rango de verdad, no sólo "hoy"):

```text
CANDIDATA_RECOMENDADA=burgerking
  negocioId=cmsgzkpo70000pf0ac5pk9zff
  slug=burgerking
  mesasCount=1
  pedidosHistorial=15 (entregado+cancelado)
  fechaMin=2026-08-06T15:04:36.781Z
  fechaMax=2026-09-11T02:01:49.172Z
  → rango real de más de un mes, suficiente para ejercitar Día
    específico, Mes específico (agosto vs septiembre) y Rango
    personalizado sin necesitar fixtures sintéticas nuevas.

Otras candidatas descartadas para R2 (sin datos históricos de mesa
todavía, requerirían generar pedidos primero):
  - Fase2 Test a1db0c1f (2 mesas, sólo 2 pedidos, mismo día)
  - Test T20 ba3873ca... (2 mesas, 0 pedidos históricos)
  - TEST_T44_R1D_NEGOCIO_A_4135EA7A (1 mesa, 0 pedidos históricos)
  - TEST_T44_R1D_NEGOCIO_C_4135EA7A (1 mesa, 0 pedidos históricos)
```

El script de sondeo temporal (`.t55_fixture_probe.mjs`, sólo lecturas
`findMany`/`count`) fue borrado inmediatamente después de usarse — nunca
staged, nunca commiteado, ninguna escritura a la DB.

## 8. Estados preservados sin cambio

```text
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
P2_T47_STATUS=CLOSED_TESTING_CERTIFIED
P2_T46_R2_STATUS=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
T39_TOUCHED=NO
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING=OPEN (sin cambios, fuera de scope)
```

## 9. Estado final de esta ronda

```text
P2_T55_R1_STATUS=IMPLEMENTATION_COMPLETE_TESTING_CERTIFIED_AUTOMATED
P2_T55_R1_AUTOMATED_CERTIFICATION=PASS
P2_T55_R1_PHYSICAL_CERTIFICATION=PENDING (no realizada por Claude — gate físico)
RELEASE_ELIGIBLE_FOR_PHYSICAL_TEST=YES
PRODUCTION_PROMOTED=NO
NEXT_ACTION_RECOMMENDED=Operador certifica físicamente Historial en
  TESTING (idealmente usando el negocio "burgerking" identificado en §7)
  antes de cualquier cierre final o promoción.
```

## 10. Cierre de esta ronda

```text
PRODUCT_FILES_CHANGED=3 (route.ts x2, salon-tab.tsx)
NEW_FILES_CREATED=4 (date-range-filter.ts + 3 archivos de test)
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_MUTATION=NO
REALTIME_CHANGED=NO
PUSH_CHANGED=NO
PHYSICAL_CERTIFICATION_BY_CLAUDE=NO
PRODUCTION_TOUCHED=NO
P2_T51_STARTED=NO
```
