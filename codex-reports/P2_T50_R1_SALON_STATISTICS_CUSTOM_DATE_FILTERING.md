# P2-T50-R1 — Salón Statistics Custom Date Filtering: Implementación

Fecha: 2026-09-20
Alcance: IMPLEMENTACIÓN + TESTS + QUALITY GATE + COMMIT + PUSH +
TESTING DEPLOY. Sin Production, sin certificación física, sin schema,
sin migración, sin backfill de DB.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=eefab9363ba80ea25f7bec6b5b86d08f8ec4515e
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md —
  ninguno ajeno, ninguno de código)
ORIGIN_TESTING_SHA=eefab9363ba80ea25f7bec6b5b86d08f8ec4515e
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Worktree T39 (`C:/Leo Campos/Trabajo/deligo-t39-admin`,
`work/p2-t39-admin-notifications`, HEAD `54d17d5`) confirmado intacto,
no tocado.

## 2. Scope real confirmado (idéntico a A0)

```text
T50_PRIMARY_UI_ROUTE=/negocio (SalonTab -> EstadisticasSubTab)
T50_PRIMARY_API=GET /api/negocio/salon/stats
```

No se tocó `/operaciones/salon/estadisticas` ni
`/operaciones/mi-panel/[slug]/salon`.

## 3. API — extensión aditiva

Archivo: `src/app/api/negocio/salon/stats/route.ts`.

Contrato preservado sin cambios: `periodo=hoy|semana|mes|todo` (misma
semántica exacta — ventanas rodantes, sin cambiar a calendario).

Nuevos parámetros opcionales, aditivos:

```text
API_CUSTOM_PARAMS=fecha=YYYY-MM-DD | mes=YYYY-MM | desde=YYYY-MM-DD&hasta=YYYY-MM-DD
API_CUSTOM_PRECEDENCE=1) fecha  2) mes  3) desde+hasta  4) periodo (fallback histórico)
AMBIGUOUS_CUSTOM_PARAMS_BEHAVIOR=400 genérico {"error":"Filtro de fecha inválido"}
  cuando llega más de un modo custom simultáneo (fecha+mes, fecha+desde,
  mes+hasta, etc.) — periodo no cuenta como "modo custom" para esta regla,
  así que puede coexistir sin disparar el 400 (los clientes actuales
  siempre lo envían); cuando existe un filtro custom válido, éste manda.
```

Parseo seguro (nunca `new Date(string)`): `parseIsoDateComponents` /
`parseIsoMonthComponents`, por regex + construcción con
`new Date(year, month-1, day)` + verificación de roundtrip contra los
componentes originales (rechaza 31/02, mes 13, "2026-9", etc. que el
constructor de `Date` normalizaría en silencio).

```text
CUSTOM_RANGE_FROM_INCLUSIVE=SI
CUSTOM_RANGE_TO_EXCLUSIVE=SI
```

Día `fecha=2026-09-20` → `gte` 20/09 00:00 local, `lt` 21/09 00:00 local.
Mes `mes=2026-08` → `gte` 01/08 00:00, `lt` 01/09 00:00. Rango
`desde=2026-09-01&hasta=2026-09-15` → `gte` 01/09 00:00, `lt` 16/09 00:00
(el día "hasta" queda incluido completo).

```text
INVALID_DATE_VALIDATION=400 (fecha/mes con formato o calendario inválido)
INCOMPLETE_RANGE_VALIDATION=400 (desde sin hasta, o hasta sin desde)
REVERSED_RANGE_VALIDATION=400 (desde > hasta); desde === hasta es válido
```

No se agregó ningún máximo de rango ni bloqueo de fechas futuras (no
pedido, no justificado por evidencia — fecha/mes/rango futuros son
válidos y devuelven ceros, igual que hoy con `periodo=todo` sin datos).

## 4. Modelo temporal — sin cambios de arquitectura

```text
TIMEZONE_MODEL_CHANGED=NO
CUSTOM_DATE_UTC_STRING_PARSE_USED=NO
CANONICAL_STATISTICS_DATE_FIELD=Pedido.fecha (sin cambios)
```

No se encontró evidencia real de que Railway corra en un timezone que
rompa "Hoy" — no se activó la cláusula de STOP de la sección 25 del
task spec.

## 5. Métricas — mismo dataset, mismo rango

```text
SALON_TOTAL_RANGE_FILTERED=SI
BUSINESS_TOTAL_RANGE_FILTERED=SI
SALON_SHARE_RANGE_FILTERED=SI
EMPLOYEE_STATS_RANGE_FILTERED=SI
MESAS_ASIGNADAS_RANGE_BEHAVIOR=UNCHANGED_LIVE_SNAPSHOT
```

`mesasAsignadas` sigue siendo un `db.mesa.groupBy` sin filtro de fecha
(confirmado explícitamente por el nuevo test U — el `where` de esa
consulta nunca incluye una clave `fecha` bajo ningún modo de filtro). No
se tocó el tratamiento de empleados suspendidos/desvinculados/"Mozo
histórico"/pedidos sin empleado/nombres históricos.

```text
CROSS_BUSINESS_ISOLATION_PRESERVED=SI (negocioId deriva únicamente de la
  sesión — nunca de query params; test R lo cubre explícitamente)
```

## 6. UI

Archivo: `src/components/business/salon-tab.tsx`, dentro de
`EstadisticasSubTab`. Se preservó la fila de pastillas
Hoy/Semana/Mes/Todo sin cambios de posición/estilo, y se agregó un
control "Elegir fecha" (ícono calendario) a la derecha, que abre un
`Popover` con 3 modos (Día/Mes/Rango) — reutilizando `Calendar`
(`@/components/ui/calendar`, react-day-picker v9) para Día/Rango y un
selector `Select` de Mes+Año (más simple y mobile-friendly que forzar
`Calendar` en modo mes) para Mes específico, tal como permitía
explícitamente el §13 del task spec.

```text
FILTER_STATE_MODEL=discriminated union StatsFilter =
  {kind:"quick", periodo} | {kind:"day", fecha} | {kind:"month", mes} |
  {kind:"range", desde, hasta} — un único estado `appliedFilter`, nunca
  varios booleanos independientes.
FILTER_PERSISTENCE_CHANGED=NO (sigue siendo useState local, se resetea
  al desmontar el sub-tab, igual que los quick filters ya se comportaban)
```

Flujo Aplicar/Cancelar: la selección vive en estado "draft" separado
mientras el Popover está abierto; sólo el botón "Aplicar" (deshabilitado
hasta tener una selección válida) actualiza `appliedFilter` y dispara el
fetch — evitar múltiples requests mientras el usuario todavía elige un
rango. "Cancelar" cierra sin tocar el filtro vigente. Al reabrir el
Popover, el draft se inicializa reflejando el filtro custom actualmente
aplicado (o en blanco si el filtro activo es un quick filter).

Quick filter → custom y custom → quick: tocar cualquier pastilla
Hoy/Semana/Mes/Todo reemplaza por completo cualquier filtro custom
activo (ninguna pastilla ni el botón de fecha aparentan estar
seleccionados simultáneamente); aplicar un filtro custom desactiva la
selección visual de las 4 pastillas.

```text
TANSTACK_QUERY_KEY_INCLUDES_FULL_FILTER=SI
  (["salon-stats", negocioId, "quick"|"day"|"month"|"range", ...valores])
  — nunca reutiliza la misma key entre filtros distintos (test dedicado).
```

## 7. Mobile

`PopoverContent` usa `w-[min(320px,calc(100vw-2rem))]` — nunca excede el
viewport ni corta horizontalmente en pantallas angostas; los botones
Aplicar/Cancelar quedan siempre visibles al pie del popover; el
`Calendar` en modo rango usa `numberOfMonths={1}` para no exigir espacio
horizontal de dos meses. El selector de Mes usa `Select` (ya táctil por
diseño en el resto del proyecto) en vez de forzar precisión fina sobre
un calendario completo.

```text
MOBILE_SELECTOR_IMPLEMENTED=SI (revisión de código; sin certificación
  física en R1 — queda para R2 Case F)
```

## 8. Tests

```text
UI_TEST_STRATEGY=helpers puros extraídos y exportados desde
  salon-tab.tsx (buildStatsQuery, getStatsFilterQueryKey,
  getStatsFilterLabel, formatDayLabel, formatMonthLabel,
  dateToIsoDateString, isoDateStringToDate, validateStatsRangeDraft) +
  test focal que los importa sin montar ningún componente React ni el
  Calendar de react-day-picker — mismo patrón de "contrato estático
  puro" ya aceptado en T45/T49.
```

Backend: `src/app/api/negocio/salon/stats/route.test.ts` — 30 tests
(A-V + boundary N/O + cross-business R + estado S + dataset compartido T
+ mesasAsignadas U + combinaciones ambiguas V + auth 401/403), mock de
`@/lib/db` y `@/lib/auth`, sin DB real.

Frontend: `src/components/business/salon-stats-filter.test.ts` — 23
tests sobre los helpers puros (query building, query keys únicas por
filtro, labels, roundtrip de fechas sin desplazamiento UTC, validación
de rango).

```text
FOCAL_TESTS=53 (30 backend + 23 frontend), 0 fail
REGRESSION_TESTS=src/components/business/salon-tab-employee-identity-feedback.test.ts
  (3/3 pass, contrato estático sobre el mismo archivo modificado —
  confirma que el modelo de identidad histórica de empleados no se
  tocó)
```

Se detectaron 20 fallas preexistentes, no relacionadas, en
`src/lib/negocio-salon.test.ts` y `src/lib/salon-new-order-notification.test.ts`
(tests que requieren una conexión Prisma/DB real no disponible en este
entorno de test) — confirmado explícitamente reproduciendo las MISMAS
20 fallas con `git stash` sobre el código sin modificar de esta tarea,
antes de restaurar los cambios. No son una regresión de T50-R1.

## 9. Quality gate

```text
TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS (sin salida en los 4 archivos tocados/nuevos)
BUILD=PASS
DIFF_CHECK=PASS
```

## 10. Diff review

```text
PRODUCT_FILES_CHANGED=
  src/app/api/negocio/salon/stats/route.ts
  src/components/business/salon-tab.tsx
TEST_FILES_CHANGED=
  src/app/api/negocio/salon/stats/route.test.ts (nuevo)
  src/components/business/salon-stats-filter.test.ts (nuevo)
```

Sin tocar: `prisma/schema.prisma`, `prisma/migrations/**`,
`src/app/operaciones/**`, `src/lib/operaciones-terminal-*`, push,
realtime, Service Worker, manifest, assets — confirmado por
`git status --short` filtrado contra el resto del árbol.

## 11. Performance

```text
P2_T50_PERFORMANCE_INDEX_FOLLOWUP=CONSIDER_SEPARATE_HARDENING_IF_VOLUME_REQUIRES
```

Sin índice nuevo (prohibido en esta ronda). `Pedido` sigue sin índice
sobre `negocioId`/`estado`/`fecha` — el rango custom no introduce una
regresión estructural nueva: `periodo=todo` ya opera hoy sin ese índice
sobre el historial completo del negocio.

## 12. Commit / Push / Deploy

```text
P2_T50_R1_COMMIT_SHA=9f9f5c9299e801dd60a7eb0e342034521129e342
PUSH_TARGET=origin/testing-codex
PUSH_STATUS=SUCCESS
TESTING_DEPLOY_ID=b09e0acd-8aed-43d9-9942-35fc7e28546f
TESTING_DEPLOY_SERVICE=DeliGO Copy (servicio Next.js — no el microservicio
  "chat en vivo", que también hizo autodeploy del mismo push pero es un
  proceso Node/websocket separado sin relación con esta pantalla)
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=9f9f5c9299e801dd60a7eb0e342034521129e342
DEPLOY_COMMIT_MATCH=SI
```

Logs de arranque limpios: `33 migrations found`, `No pending migrations
to apply` (confirma cero cambio de schema), `Ready in 67ms`, sin
excepciones ni 500 en boot. Smoke manual:
`GET /api/negocio/salon/stats?fecha=2026-09-20` sin cookie de sesión →
`401` (esperado — el endpoint está vivo y el gate de auth sigue
funcionando; no se probó con una sesión real de Negocio en esta ronda,
eso queda para R2 físico). `origin/main` reconfirmado sin cambios
(`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`) antes y después del deploy.

## 13. Estado final

```text
P2_T50_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2_PHYSICAL_CERTIFICATION
P2_T50_STATUS=IN_PROGRESS_AWAITING_R2_PHYSICAL_CERTIFICATION
P2_T49_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_BACKFILL_REQUIRED=NO
DB_MUTATED=NO
REALTIME_CHANGED=NO
PUSH_CHANGED=NO
PRODUCTION_TOUCHED=NO
T39_TOUCHED=NO
```

NO se certificó físicamente esta ronda. NO se cierra T50. Pendiente:
R2 (Cases A-F) — ver preparación en el reporte A0 y en la salida final
de esta ronda.
