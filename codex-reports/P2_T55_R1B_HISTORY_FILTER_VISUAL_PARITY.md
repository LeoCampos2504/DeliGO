# P2-T55-R1B — Salon History filter visual parity with Statistics

Fecha: 2026-09-20
Alcance: DISEÑO/UI ÚNICAMENTE. Sin cambio de lógica, sin cambio de API,
sin cambio de DB, sin Production.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=c28fdbd9d6a62eabc725bb1c524afdf5f31397d8 (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión, ajenos a este task: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 no tocado. `origin/main` reconfirmado en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` antes y después del deploy —
Production sin cambios.

## 2. Auditoría — diferencia visual real encontrada

Se comparó el JSX/Tailwind de la fila de filtros en:

- `EstadisticasSubTab` (`src/components/business/salon-tab.tsx`, fila
  "Period selector pills + custom date filter")
- `HistorialSubTab` (mismo archivo, fila "Period filter + custom date
  filter")

**El botón "Elegir fecha" (Popover trigger) y todo el contenido del
Popover (tabs Día/Mes/Rango, `StatsDatePicker`, `Select` de mes/año,
botones Cancelar/Aplicar) ya eran BYTE-IDÉNTICOS** entre ambos — T55-R1
ya los construyó reutilizando exactamente el mismo patrón visual de T50
(única diferencia funcional intencional: Historial además muestra un
botón "Limpiar" cuando hay un filtro custom aplicado, requerido por la
decisión de producto de T55-R1 de volver siempre a "Hoy").

**La diferencia real estaba en las pills Hoy/Semana/Mes**, que en
Historial habían quedado con el estilo visual PRE-T55 (pill individual
con borde) en lugar de heredar el patrón de segmented-control que
Estadísticas ya usa:

```text
Estadísticas (contenedor):
  "flex bg-muted/60 rounded-xl p-1 flex-1 min-w-0"
Historial (contenedor, ANTES):
  "flex gap-2 flex-1 min-w-0"                          ← sin track de fondo

Estadísticas (botón):
  "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
  activo:   "bg-background shadow-sm text-foreground"
  inactivo: "text-muted-foreground hover:text-foreground"
Historial (botón, ANTES):
  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
  activo:   "border-primary/30 bg-primary/10 text-primary"
  inactivo: "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
```

Diferencias concretas: contenedor sin track de fondo vs. segmented
control; pills individuales con `rounded-full`+borde vs. segmentos
`flex-1` de igual ancho con `rounded-lg` sin borde; estado activo con
color primario (borde+fondo `primary`) vs. estado activo neutro
(`bg-background` + `shadow-sm`, coherente con el resto del panel).

## 3. Cambio aplicado

Único archivo tocado: `src/components/business/salon-tab.tsx`
(`HistorialSubTab`). Se reemplazaron el `className` del contenedor y
del botón de las pills Hoy/Semana/Mes por los mismos exactos que usa
`EstadisticasSubTab`, sin tocar ningún otro elemento de la fila:

```diff
- <div className="flex gap-2 flex-1 min-w-0">
+ <div className="flex bg-muted/60 rounded-xl p-1 flex-1 min-w-0">
    ...
-   "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
-   isActive
-     ? "border-primary/30 bg-primary/10 text-primary"
-     : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
+   "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
+   isActive
+     ? "bg-background shadow-sm text-foreground"
+     : "text-muted-foreground hover:text-foreground"
```

Nada más cambió: el array de valores (`["hoy","semana","mes"]`), el
handler (`handleQuickFilterClick`), la condición `isActive`, las
etiquetas de texto, el botón "Elegir fecha", el Popover completo y el
botón "Limpiar" quedan exactamente como estaban.

## 4. Verificación de que NO hubo cambio de comportamiento

```text
HISTORY_TODO_ADDED=NO (el array de quick filters sigue siendo
  exactamente ["hoy","semana","mes"] — no se agregó ni un cuarto botón)
FILTER_LOGIC_CHANGED=NO (handleQuickFilterClick, isActive,
  handlePopoverOpenChange, handleApplyCustomFilter,
  handleClearCustomFilter — ningún handler tocado)
QUERY_CHANGED=NO (getHistorialFilterQueryKey, buildHistorialQuery — sin
  tocar)
API_CHANGED=NO (GET /api/negocio/pedidos, date-range-filter.ts — sin
  tocar, ni un solo archivo backend en este diff)
GROUPING_CHANGED=NO (mesa-historial.ts, buildMesaHistorialAccounts,
  accountKey, buildCuentaMesa, withCuentaMesaPayment — sin tocar)
PAYMENT_LOGIC_CHANGED=NO (autoridad de pago T46 intacta)
T50_BEHAVIOR_CHANGED=NO (EstadisticasSubTab no se tocó; sus classNames
  fueron sólo LEÍDOS como referencia)
```

## 5. Evidencia automatizada

```text
TESTS_RUN=98 PASS / 0 FAIL
  - src/components/business/salon-historial-filter.test.ts (contrato
    puro de HistorialFilter/buildHistorialQuery/getHistorialFilterLabel
    — sin cambios, sigue pasando: no testea className, sólo lógica)
  - src/components/business/salon-stats-filter.test.ts (T50, sin tocar)
  - src/app/api/negocio/salon/stats/route.test.ts (T50, sin tocar)
  - src/lib/date-range-filter.test.ts (helper compartido, sin tocar)
  - src/app/api/negocio/pedidos/historial-date-filter.test.ts (backend
    T55, sin tocar)

No se creó ni ajustó ningún test: no existe contrato estático que
verifique clases Tailwind (los tests de T50/T55 son sobre funciones
puras — parseo de fecha, query builders, labels — nunca sobre JSX/CSS),
y el task no pidió agregar cobertura visual automatizada nueva.

TSC_TOTAL_ERRORS=31 / BASELINE=31 / NEW=0
ESLINT=PASS (0 warnings/errors en salon-tab.tsx)
BUILD=PASS
DIFF_CHECK=PASS
```

## 6. Commit / push / deploy

```text
COMMIT_SHA=4f7b3355269768b9ef69ca650ac4faa6e1342bd2
COMMIT_PARENT=c28fdbd9d6a62eabc725bb1c524afdf5f31397d8 (== origin/testing-codex antes del push)
FILES_IN_COMMIT=1 (src/components/business/salon-tab.tsx, 7
  inserciones / 5 eliminaciones — sólo classNames)
PUSH_TARGET=origin/testing-codex
PUSH_RESULT=FAST_FORWARD (c28fdbd..4f7b335)

TESTING_SERVICE=DeliGO Copy
TESTING_DEPLOY_ID=7a3e8d12-66b4-4214-b963-6e5480a441df
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT_MATCH=SI (4f7b3355269768b9ef69ca650ac4faa6e1342bd2)
BOOT_LOGS_CLEAN=SI (sin errores/excepciones; "No pending migrations to
  apply" coherente con SCHEMA_CHANGED=NO; tráfico real 200 en
  /api/negocio/mesas y otros endpoints del panel de Negocio tras el boot)

PRODUCTION_TOUCHED=NO (origin/main sin cambios: ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763)
```

## 7. Estado final

```text
P2_T55_R1B_STATUS=IMPLEMENTATION_COMPLETE_TESTING_DEPLOYED_PENDING_OPERATOR_VISUAL_CONFIRMATION
VISUAL_PARITY_TARGET=SALON_HISTORY_WITH_STATISTICS
DESIGN_ONLY_CHANGE=SI
NEXT_ACTION=WAIT_FOR_OPERATOR_VISUAL_CONFIRMATION
```

No se toca Production, no se inicia P2-T51, no se promueve T46-R2, no
se corrige el finding de Cliente Mesa — todo fuera de alcance de este
ajuste puntual.
