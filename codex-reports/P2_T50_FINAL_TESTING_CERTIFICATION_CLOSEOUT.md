# P2-T50 — Cierre final: certificación física completa en TESTING

Fecha: 2026-09-20
Alcance: DOCUMENTACIÓN / RECONCILIACIÓN DE ESTADO ÚNICAMENTE. Sin código
de producto, sin tests nuevos, sin API, sin mutación de DB, sin schema,
sin migración, sin Production.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=c76a79273c5314e2cb538cab5a051f4e823018a1
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md —
  ninguno ajeno, ninguno de código)
ORIGIN_TESTING_SHA=c76a79273c5314e2cb538cab5a051f4e823018a1
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Worktree T39 (`C:/Leo Campos/Trabajo/deligo-t39-admin`,
`work/p2-t39-admin-notifications`, HEAD `54d17d5`) confirmado intacto,
no tocado. Lineage confirmado por `git log` incluye el commit R1
`9f9f5c9299e801dd60a7eb0e342034521129e342` y el cierre documental R1
`c76a79273c5314e2cb538cab5a051f4e823018a1`, ambos ya en
`origin/testing-codex`.

## 2. Implementación certificada (R1)

```text
R1_COMMIT_SHA=9f9f5c9299e801dd60a7eb0e342034521129e342
LATEST_CERTIFIED_TESTING_DEPLOY_ID=b09e0acd-8aed-43d9-9942-35fc7e28546f
LATEST_CERTIFIED_TESTING_DEPLOY_STATUS=SUCCESS
LATEST_CERTIFIED_TESTING_DEPLOY_COMMIT=9f9f5c9299e801dd60a7eb0e342034521129e342
DEPLOY_COMMIT_MATCH=SI
```

Reconfirmado (read-only) contra Railway en este cierre: el commit
documental posterior `c76a792` (sin cambios de producto) generó un
nuevo deploy incidental `3ad4eb37-74ca-4a17-a489-15d600f14192` SUCCESS
sobre el mismo servicio `DeliGO Copy` — el deployment `b09e0acd` quedó
`REMOVED` por el ciclo de vida normal de Railway (reemplazado por el más
reciente), no por ninguna falla. El código de producto certificado
físicamente por el operador es exactamente el del commit
`9f9f5c9299e801dd60a7eb0e342034521129e342` (R1) — el commit documental
posterior no alteró ningún archivo de `src/`.

## 3. Scope real certificado

```text
T50_PRIMARY_UI_ROUTE=/negocio (SalonTab -> EstadisticasSubTab)
T50_PRIMARY_API=GET /api/negocio/salon/stats
```

No incluidos (confirmado sin cambios): `/operaciones/salon/estadisticas`,
`/operaciones/mi-panel/[slug]/salon`.

## 4. Certificación física — quick filters (R2 Case A)

```text
P2_T50_R2_CASE_A=PASS
QUICK_FILTERS_PHYSICAL=PASS
HOY_FUNCIONA=SI
SEMANA_FUNCIONA=SI
MES_FUNCIONA=SI
TODO_FUNCIONA=SI
```

Semántica preservada sin reinterpretación: Hoy = medianoche local →
ahora; Semana = ventana rodante de 7 días (no semana calendario); Mes =
ventana rodante de 1 mes (no mes calendario); Todo = historial completo
sin cota inferior.

## 5. Certificación física — filtros personalizados (R2 Cases B, C, D)

Confirmación literal del operador: *"funciona todo perfecto incluyendo
lo personalizado"*.

```text
P2_T50_R2_CASE_B=PASS
SPECIFIC_DAY_PHYSICAL=PASS

P2_T50_R2_CASE_C=PASS
SPECIFIC_MONTH_PHYSICAL=PASS

P2_T50_R2_CASE_D=PASS
CUSTOM_RANGE_PHYSICAL=PASS
```

Los tres modos custom (Día específico, Mes específico, Desde/Hasta)
verificados funcionalmente en TESTING sobre el commit `9f9f5c9`, sin
regresión de los quick filters existentes.

## 6. Certificación física — mobile (R2 Case F)

Confirmación literal del operador: *"quedó perfecto"*.

```text
P2_T50_R2_CASE_F=PASS
MOBILE_SELECTOR_PHYSICAL=PASS
```

Evidencia acumulada: selector usable desde teléfono, sin overflow/cortes
relevantes, los tres modos (Día/Mes/Rango) operables al tacto, controles
Aplicar/Cancelar visibles y utilizables, layout estable tras aplicar o
cancelar un filtro.

## 7. R2 Case E — boundary (condicional, no bloqueante)

```text
P2_T50_R2_CASE_E=NOT_REQUIRED_CONDITIONAL
R2_CASE_E_BLOCKING_CLOSEOUT=NO
```

Case E era explícitamente condicional a la existencia de un pedido real
cercano a medianoche — no se fabricó ningún dato sólo para producir
evidencia física artificial (violaría la prohibición de mutar DB en
este cierre y el principio general de no fabricar evidencia). La
cobertura automatizada (`route.test.ts`, casos N/O) ya verifica
exactamente ese límite: un pedido exactamente a las 00:00:00.000 del
día de inicio queda incluido (`gte`), y un pedido exactamente a las
00:00:00.000 del día posterior al "hasta" queda excluido (`lt`) — misma
lógica FROM inclusivo / TO exclusivo que corre en TESTING.

## 8. Métricas certificadas — sin cambios de comportamiento

```text
SALON_TOTAL_RANGE_FILTERED=SI
BUSINESS_TOTAL_RANGE_FILTERED=SI
SALON_SHARE_RANGE_FILTERED=SI
EMPLOYEE_STATS_RANGE_FILTERED=SI
MESAS_ASIGNADAS_RANGE_BEHAVIOR=UNCHANGED_LIVE_SNAPSHOT
```

`mesasAsignadas` sigue representando las mesas actualmente asignadas al
empleado (snapshot en vivo) — no es ni se reinterpretó como una métrica
histórica en este cierre.

## 9. Quality evidence (última ronda con código — R1, no repetida)

```text
AUTOMATED_TESTS_LATEST=FOCAL_TESTS=53 PASS / 0 FAIL
  (30 backend + 23 frontend)
REGRESSION_FOCAL=3/3 PASS (salon-tab-employee-identity-feedback.test.ts)
TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS
BUILD=PASS
DIFF_CHECK=PASS
```

Las 20 fallas de tests dependientes de DB real mencionadas en el reporte
R1 (`negocio-salon.test.ts`, `salon-new-order-notification.test.ts`)
fueron demostradas preexistentes — reproducidas idénticas vía `git
stash` sobre el código sin las modificaciones de T50, antes de aplicar
cualquier cambio. No se atribuyen a T50. No se repitieron suites en este
cierre documental — no hay cambio de código que las invalide.

## 10. API final

```text
CONTRATO_HISTORICO_PRESERVADO=periodo=hoy|semana|mes|todo
CONTRATO_ADITIVO_CERTIFICADO=fecha=YYYY-MM-DD | mes=YYYY-MM | desde+hasta=YYYY-MM-DD
MODELO_RANGO=FROM inclusivo / TO exclusivo
ENDPOINT_NUEVO_CREADO=NO
```

## 11. Timezone e invariantes preservadas

```text
TIMEZONE_MODEL_CHANGED=NO
CUSTOM_DATE_UTC_STRING_PARSE_USED=NO
P2_T50_PERFORMANCE_INDEX_FOLLOWUP=CONSIDER_SEPARATE_HARDENING_IF_VOLUME_REQUIRES
P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX
P2_T49_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
TERMINAL_OPERATIVA_PUSH_INVARIANT_PRESERVED=SI (sin relación con T50, no tocada)
T39_TOUCHED=NO
PRODUCTION_TOUCHED=NO (origin/main = ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763,
  reconfirmado en este cierre)
```

No se creó ninguna tarea urgente de performance ni migración — no existe
evidencia de un problema real de rendimiento causado por T50.

## 12. Estado final

```text
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
P2_T50_IMPLEMENTATION_COMPLETE=SI
P2_T50_AUTOMATED_CERTIFICATION=PASS
P2_T50_PHYSICAL_CERTIFICATION=PASS

P2_T50_R2_CASE_A=PASS
P2_T50_R2_CASE_B=PASS
P2_T50_R2_CASE_C=PASS
P2_T50_R2_CASE_D=PASS
P2_T50_R2_CASE_E=NOT_REQUIRED_CONDITIONAL
P2_T50_R2_CASE_F=PASS

RELEASE_ELIGIBLE=YES
PRODUCTION_PROMOTED=NO
PRODUCTION_TOUCHED=NO
```

No se usa `CLOSED_PRODUCTION` — T50 queda certificada en TESTING,
release-eligible, pero no fue promovida a `main`/Production en esta
tarea ni en ninguna ronda anterior.

## 13. Cierre

```text
PRODUCT_FILES_CHANGED_DURING_CLOSEOUT=0
TEST_FILES_CHANGED_DURING_CLOSEOUT=0
API_FILES_CHANGED_DURING_CLOSEOUT=0
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_MUTATION=NO
REALTIME_CHANGED=NO
PUSH_CHANGED=NO
```
