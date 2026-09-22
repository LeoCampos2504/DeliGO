# P2-T55-A0 — Salón History Custom Date Filtering: Audit + Contract Mapping + UX Design

Fecha: 2026-09-20
Alcance: AUDITORÍA + DISEÑO ÚNICAMENTE. Sin código de producto, sin
tests, sin DB, sin schema, sin migración, sin Production, sin prueba
física.

## 0. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=0e24000f8aad950580c082d398f8805811ee8507
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md —
  ninguno ajeno, ninguno de código)
ORIGIN_TESTING_SHA=0e24000f8aad950580c082d398f8805811ee8507
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Worktree T39 confirmado intacto, no tocado. Estados preservados sin
tocar: `P2-T47=CLOSED_TESTING_CERTIFIED`, `P2-T50=CLOSED_TESTING_CERTIFIED`,
`P2-T49=CLOSED_TESTING_CERTIFIED`, `P2-T45=CLOSED_TESTING_CERTIFIED`,
`P2-T43=CLOSED_TESTING_CERTIFIED`, `P2-T44=PAUSED_UNRESOLVED_AFTER_TIMEBOX`,
`P2-T46 original=CLOSED_PRODUCTION`,
`P2-T46-R2=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION`.

## 1. Superficie real identificada

```text
T55_PRIMARY_ROUTE=/negocio (Salón → sub-tab Historial)
T55_PRIMARY_COMPONENT=HistorialSubTab
  (src/components/business/salon-tab.tsx:2290-2520 — NO fue extraído a
  un archivo propio; sigue viviendo en el mismo archivo que
  EstadisticasSubTab de T50)
T55_PRIMARY_SUBTAB=historial (SubTab type: "mesas"|"mozos"|"estadisticas"|"historial")
T55_PRIMARY_API=GET /api/negocio/pedidos
  (src/app/api/negocio/pedidos/route.ts, params
  metodoEntrega=mesa&estado=historial&mesaNumero=N&periodo=X&limit=50)
T55_PRIMARY_QUERY_KEY=["mesa-history", negocio.id, selectedMesa?.numero, periodo]
```

**Hallazgo arquitectónico central, distinto de T50**: Historial NO es
una vista agregada a nivel negocio (como Estadísticas) — es **por
mesa**. El flujo real es: grilla de mesas (agrupadas por zona) → click
en una mesa → se abre un `Drawer` → ahí adentro se lista el historial
de ESA mesa específica, ya filtrado por el `periodo` elegido ANTES de
hacer click. El filtro de fecha custom que pide T55 debe integrarse en
ese mismo modelo mental (elegir ventana temporal → elegir mesa → ver su
historial en esa ventana), no como un dashboard global.

## 2. Todas las superficies "Historial" — matriz completa

| SURFACE | ROUTE | ACTOR | API | DATA_MODEL | IS_T55_TARGET |
|---|---|---|---|---|---|
| Negocio → Salón → Historial | `/negocio` | Negocio (dueño) | `GET /api/negocio/pedidos?estado=historial&metodoEntrega=mesa` | `Pedido` agrupado en `cuentas` (`CuentaMesaHistorialResult`) vía `buildMesaHistorialAccounts` | **SÍ — target único** |
| Terminal Salón → Historial | `/operaciones/salon/historial` | Terminal compartida (scope Salón) | `GET /api/operaciones/salon/historial` (archivo/ruta 100% separada) | `Pedido` plano, sin agrupar en cuentas, `periodo` propio (`hoy`/`7d`/`30d` estilo Terminal, "no se aceptan fechas libres del cliente" — comentario explícito en el código) | NO — implementación completamente independiente, no compartida |
| Panel personal Salón (cuenta operativa) | `/operaciones/mi-panel/[slug]/salon` | Empleado mozo | ninguno | n/a | NO — confirmado sin ningún historial (sólo tablero de ocupación en vivo, ya confirmado en auditorías de T47/T50) |
| Cliente → Mis pedidos | `/cliente` (`client-orders-panel.tsx`) | Cliente | `GET /api/cliente/pedidos` | Pedidos del CLIENTE across todos los negocios | NO — actor y modelo completamente distintos, ni siquiera es un historial "de negocio" |
| Terminal PyR → Historial | `/operaciones/pyr/historial` | Terminal compartida (scope PyR) | `GET /api/operaciones/pyr/historial` | Pedidos PyR (retiro/delivery), no mesa | NO — dominio distinto (PyR, no Salón) |

```text
SURFACES_AUDITED=5
```

Ninguna otra superficie con nombre "historial" comparte componente o
endpoint con el target — T55 sólo debe tocar
`src/components/business/salon-tab.tsx` (`HistorialSubTab`) y
`src/app/api/negocio/pedidos/route.ts`.

## 3. Contrato actual del Historial

```text
HISTORY_INCLUDED_STATES=cualquier estado que NO esté en ESTADOS_ACTIVOS
  (`where.estado = { notIn: ESTADOS_ACTIVOS }` — línea 64 de route.ts)
  = "entregado" y "cancelado" en la práctica actual (únicos estados
  terminales del modelo Pedido)
HISTORY_EXCLUDED_STATES=recibido, preparando, en_camino,
  listo_para_retirar, aceptado, esperando_repartidor (ESTADOS_ACTIVOS,
  compartida con la vista "activos" del mismo endpoint)
HISTORY_METHODS_OF_DELIVERY=mesa únicamente (metodoEntrega=mesa
  forzado por el frontend; el endpoint en sí no lo fuerza, pero el
  único caller de estado=historial siempre lo envía)
HISTORY_ONLY_TABLE_ORDERS=SI (para esta superficie — el endpoint es
  compartido pero esta vista SIEMPRE pasa metodoEntrega=mesa)
HISTORY_INCLUDES_CANCELLED=SI (cancelado NO está en ESTADOS_ACTIVOS,
  así que sí aparece en el historial — a diferencia de Estadísticas de
  T50, que filtra explícitamente sólo "entregado")
HISTORY_INCLUDES_OPEN_OCCUPATIONS=NO directamente — el filtro es por
  ESTADO DEL PEDIDO, no de la ocupación; en la práctica una ocupación
  con pedidos ya entregados/cancelados puede seguir "activa" y sus
  pedidos igual aparecen en el historial (el historial es por PEDIDO,
  la ocupación es sólo metadata de agrupamiento)
HISTORY_INCLUDES_CLOSED_OCCUPATIONS=SI
```

**Diferencia real y confirmada frente a T50/Estadísticas**: Historial
SÍ incluye pedidos `cancelado` (Estadísticas de T50 los excluye
explícitamente, sólo cuenta `entregado`). Esto es una divergencia de
negocio ya existente, no introducida por T55 — se preserva sin cambios.

## 4. Autoridad temporal

```text
HISTORY_CANONICAL_DATE_MODEL=Pedido
HISTORY_CANONICAL_DATE_FIELD=Pedido.fecha (mismo campo que usa T50 —
  pero ver diferencia de semántica del filtro "mes" abajo)
HISTORY_SORT_FIELD=fecha (con desempate por id)
HISTORY_SORT_DIRECTION=desc, desc (`orderBy: [{ fecha: "desc" }, { id: "desc" }]`
  — más reciente primero; el reordenamiento posterior de `cuentas` en
  `buildMesaHistorialAccounts` también ordena por `pedidos[0].fecha`
  descendente, consistente)
```

**Diferencia de semántica confirmada, NO asumida**: el filtro rápido
`"mes"` en Historial es una ventana rodante de **30 días fijos**
(`startDate.setDate(startDate.getDate() - 30)`, `route.ts:86-88`) — NO
un mes calendario ni la ventana de T50/Estadísticas
(`now.setMonth(now.getMonth() - 1)`, que varía 28-31 días según el
mes). "Hoy" y "Semana" sí coinciden en construcción con T50 (medianoche
local + resta de 7 días). El filtro custom "Mes específico" que pide
T55 (mes calendario real) es, por lo tanto, una capacidad NUEVA que NO
existe hoy en ninguna de las dos superficies con ese nombre — no debe
confundirse con el quick filter "Mes" existente de Historial (30 días
rodantes), que se preserva sin cambios.

## 5. Relación con T46 — modelo de agrupamiento

```text
HISTORY_GROUPING_MODEL=por Pedido.ocupacionMesaId (FK directa, nunca
  inferido por mesa/fecha — `accountKey()` en
  src/lib/mesa-historial.ts:45-47)
HISTORY_ACCOUNT_GROUPING=un pedido CON ocupacionMesaId se agrupa con
  todos los demás pedidos que compartan esa MISMA ocupación
  ("ocupacion:<id>"); un pedido SIN ocupacionMesaId nunca se agrupa con
  nadie, queda como su propia cuenta "legacy" (`legacy:<pedidoId>`)
HISTORY_TICKET_DETAIL_SOURCE=buildCuentaMesa/withCuentaMesaPayment
  (src/lib/mesa-cuenta.ts) — la MISMA autoridad canónica de T46,
  reutilizada tal cual por `buildMesaHistorialAccounts`
  (src/lib/mesa-historial.ts:65-71), nunca reimplementada
HISTORY_PAYMENT_SOURCE=ocupacionMesa.metodoPago /
  ocupacionMesa.pagoConfirmadoEn (SesionOcupacionMesa — autoridad T46,
  nunca Pedido.metodoPago — confirmado exactamente igual al hallazgo ya
  documentado en T46-R2 para el resto del panel Negocio)
```

T55 no debe tocar `buildMesaHistorialAccounts`, `buildCuentaMesa`,
`withCuentaMesaPayment`, `MesaAccountDetail` ni
`MesaAccountTicketDialog` — el filtro de fecha sólo decide qué
`Pedido[]` entran a esa función, nunca cómo se agrupan/presentan.

## 6. Filtros actuales — inventario completo

| FILTER | TYPE | CURRENT_DEFAULT | CLIENT/SERVER | QUERY_PARAM | PERSISTENCE | MOBILE_BEHAVIOR |
|---|---|---|---|---|---|---|
| Período (Hoy/Semana/Mes) | quick pills | `"hoy"` | Server (`periodo` param) | `periodo` | Estado local `useState`, se resetea al desmontar el sub-tab | 3 pills en fila, `flex gap-2`, sin overflow visible a priori |
| Selección de mesa | grid de mesas | ninguna seleccionada | n/a (client-side, decide qué Drawer abrir) | `mesaNumero` (recién al abrir el Drawer) | Estado local, se cierra el Drawer al deseleccionar | Grid responsive `grid-cols-3 sm:grid-cols-4 md:grid-cols-5` |
| — | — | — | — | — | — | — |

```text
HISTORY_CURRENT_FILTERS=periodo (Hoy/Semana/Mes) + selección de mesa (no es un "filtro" en sentido estricto, es la navegación primaria)
HISTORY_CURRENT_QUICK_FILTERS=Hoy, Semana, Mes (NO existe "Todo" — omitir periodo del lado del cliente no es alcanzable hoy desde la UI, aunque el backend lo soportaría con `periodo` ausente)
```

No hay filtro de búsqueda, ni de empleado, ni de estado explícito en
esta pantalla (a diferencia de `orders-tab.tsx`, que sí tiene otros
filtros pero es una superficie distinta).

## 7. Paginación / límites

```text
HISTORY_PAGINATION_MODEL=page+limit (skip/take de Prisma), SIN cursor,
  SIN infinite scroll, SIN botón "cargar más"
HISTORY_PAGE_SIZE=50 (hardcodeado en el frontend — `limit=50` en la URL;
  el backend por defecto usaría 20 si no se pasara `limit`)
HISTORY_HAS_LOAD_MORE=NO — si `pagination.total > 50` sólo se muestra un
  texto informativo ("Mostrando los últimos 50 de N pedidos"), sin
  forma de ver el resto
HISTORY_STABLE_ORDERING=SI (`orderBy: [{fecha:"desc"},{id:"desc"}]`,
  desempate determinista documentado explícitamente en el propio código
  como corrección P1-B)
```

**Riesgo preexistente, no introducido por T55**: la paginación limita
PEDIDOS (`take: limit`), no CUENTAS — si una ocupación con varios
pedidos queda partida exactamente en el borde de los 50 más recientes,
su "cuenta" reconstruida podría aparecer incompleta (menos pedidos de
los que realmente tiene). Esto ya existe hoy con los quick filters
actuales; un filtro de rango muy amplio (ej. varios meses) podría
exponerlo con más frecuencia que "Hoy", pero un filtro de "Día
específico" (naturalmente pocos pedidos) lo hace MENOS probable, no
más. No se corrige en T55 — se documenta como hallazgo preexistente.

Regla esperada para R1 (a confirmar en diseño, no implementada):
aplicar un nuevo filtro temporal debe resetear cualquier estado de
paginación — en la práctica actual esto es automático, porque no existe
"página 2" alcanzable desde la UI (siempre se pide `page` implícito = 1
en cada fetch nuevo por cambio de query key).

## 8. Cache / TanStack Query

```text
HISTORY_QUERY_KEY_CURRENT=["mesa-history", negocio.id, selectedMesa?.numero, periodo]
```

Diseño de la key futura (conceptual, siguiendo el patrón ya validado en
T50 pero adaptado a que Historial es por-mesa):

```text
["mesa-history", negocio.id, selectedMesa?.numero, filtro-completo]
```

donde `filtro-completo` sigue el mismo discriminante que T50
(`{kind:"quick",periodo}` | `{kind:"day",fecha}` | `{kind:"month",mes}` |
`{kind:"range",desde,hasta}`), serializado igual que
`getStatsFilterQueryKey` ya hace — nunca comparte cache entre "Hoy" y
"3 de septiembre", por ejemplo.

## 9. Referencia T50 — qué es reutilizable

```text
T50_REUSABLE_DATE_HELPER=SI — dateToIsoDateString / isoDateStringToDate
  (src/components/business/salon-tab.tsx, ya `export`adas por T50,
  MISMO ARCHIVO donde vive HistorialSubTab — cero fricción de import)
T50_REUSABLE_UI_PATTERN=SI — Popover + StatsDatePicker (Calendar) +
  Select(mes/año) + flujo Aplicar/Cancelar con estado "draft" separado
  del filtro aplicado — mismos componentes YA IMPORTADOS en este mismo
  archivo desde T50
T50_REUSABLE_QUERY_PATTERN=PARCIAL — el CONCEPTO de discriminated union
  + queryKey que incluye el filtro completo es reutilizable; el
  `buildStatsQuery`/`getStatsFilterQueryKey` concretos de T50 están
  hardcodeados a la forma de Estadísticas (`periodo=`, prefijo
  `"salon-stats"`) y no aplican literalmente — se necesita un
  `HistorialFilter`/`buildHistorialQuery`/`getHistorialFilterQueryKey`
  paralelo, mismo patrón, prefijo `"mesa-history"`
T50_REUSE_RECOMMENDED=SI, selectivo (helpers de fecha + patrón de UI +
  patrón de query-key; NO el tipo/funciones de Stats literalmente)
```

## 10. Decisión de reuso T50 (obligatoria)

```text
CAN_REUSE_T50_DATE_PARSER=SI — dateToIsoDateString/isoDateStringToDate
  ya exportadas en salon-tab.tsx, mismo archivo, uso directo sin nuevo
  import
CAN_REUSE_T50_RANGE_BUILDER=PARCIAL — el patrón de parseo seguro por
  componentes (parseIsoDateComponents/parseIsoMonthComponents,
  actualmente privado dentro de
  src/app/api/negocio/salon/stats/route.ts) NO es importable
  cross-route hoy porque nunca se extrajo a un módulo compartido.
  Recomendación de R1: extraerlo a un helper pequeño y compartido
  (ej. src/lib/date-range-filter.ts) para que TANTO
  negocio/salon/stats/route.ts COMO negocio/pedidos/route.ts lo
  consuman — evita copy/paste sin ser un refactor global (es una
  extracción de ~20 líneas ya probadas en T50, sin cambiar su
  comportamiento)
CAN_REUSE_T50_FILTER_UI=SI — Popover/Calendar/Select ya importados en
  el mismo archivo; el JSX de T50 sirve como plantilla directa,
  adaptado a un `HistorialFilter` propio (ver §9)
CAN_REUSE_T50_TEST_CASES=SI, como PLANTILLA de categorías (quick
  filters sin regresión, día válido/inválido, mes válido/inválido,
  rango válido/same-day/invertido/incompleto, boundary FROM/TO,
  cross-business, combinaciones ambiguas) — no como código compartido
  literal, porque el mock de autenticación/transacción de
  `negocio/pedidos/route.ts` es distinto al de
  `negocio/salon/stats/route.ts`
```

## 11. UX deseada

Preservar la fila de 3 pills (Hoy/Semana/Mes) exactamente como está.
Agregar, en la MISMA fila (`flex items-center gap-2`, igual patrón que
T50), un botón "Elegir fecha" que abre un `Popover` con 3 modos (Día /
Mes / Rango), reutilizando `StatsDatePicker`/`Select`/`Popover` ya
importados. La selección de fecha custom actúa como un modificador
GLOBAL de esta pantalla (afecta la próxima mesa que se abra), exactamente
igual a como hoy actúan los 3 quick filters — sin inventar un
mecanismo nuevo de aplicación por mesa individual.

```text
DRAFT_APPLY_PATTERN_RECOMMENDED=SI — mismo patrón que T50 (draft
  separado del filtro aplicado, botones Aplicar/Cancelar, sin disparar
  fetch por cada click del calendario) — el Drawer de historial de una
  mesa ya abierta debe re-consultar sólo cuando el usuario presiona
  "Aplicar", nunca antes
```

## 12. Día / Mes / Rango — contrato propuesto

```text
Día:      fecha=YYYY-MM-DD  → gte medianoche local ese día, lt medianoche local día siguiente
Mes:      mes=YYYY-MM       → gte primer día del mes 00:00 local, lt primer día del mes siguiente 00:00 local
Rango:    desde=YYYY-MM-DD&hasta=YYYY-MM-DD → gte medianoche local "desde", lt medianoche local día siguiente a "hasta"
```

FROM inclusivo / TO exclusivo en los tres casos — idéntico al modelo ya
certificado en T50. Parseo por componentes (nunca
`new Date("YYYY-MM-DD")`), reutilizando el mismo patrón ya probado.
Same-day range (`desde === hasta`) válido, equivalente a "Día".

```text
PROPOSED_FILTER_PRECEDENCE=1) fecha  2) mes  3) desde+hasta  4) periodo
  (fallback histórico, sin cambiar su semántica) — idéntico a T50.
  Más de un modo custom simultáneo (ej. fecha+mes) → 400 genérico. Esto
  es una decisión NUEVA para este endpoint (el estilo actual de
  `/api/negocio/pedidos` es lento/permisivo con `periodo` — un valor
  no reconocido cae silenciosamente a "todo el tiempo", `route.ts:89-90`)
  — se documenta explícitamente como una introducción de validación
  estricta SÓLO para los parámetros NUEVOS, sin tocar el fallback
  permisivo ya existente de `periodo` (compatibilidad hacia atrás).
```

## 13. Timezone

```text
CURRENT_HISTORY_TIMEZONE_BEHAVIOR=Date nativo, hora local del proceso
  Node/Railway, sin conversión UTC explícita, mismo patrón que T50 y
  que el resto del repo
BUSINESS_TIMEZONE_MODEL_EXISTS=NO (ningún negocio declara su propio
  timezone para estadísticas/historial — sólo horarios de apertura
  usan un campo `timezone` en otro contexto, no relacionado)
GLOBAL_TIMEZONE_REFACTOR_REQUIRED=NO
```

T55 no introduce timezone nuevo — reutiliza exactamente la misma
construcción por componentes (`new Date(year, month-1, day)`) ya
validada en T50, evitando el bug de `new Date("YYYY-MM-DD")`.

## 14. Backend — extender vs crear

```text
NEW_ENDPOINT_REQUIRED=NO
EXISTING_ENDPOINT_CAN_EXTEND=SI (GET /api/negocio/pedidos)
```

Se recomienda extender el mismo bloque `if (periodo) {...}` (líneas
78-93 de `route.ts`) para leer PRIMERO `fecha`/`mes`/`desde`+`hasta`
(con la precedencia de §12) y sólo caer al `periodo` existente si
ninguno de los nuevos parámetros llegó — exactamente el mismo patrón
aditivo que T50 aplicó sobre `negocio/salon/stats/route.ts`. Esta
extensión es segura para los otros dos callers de este mismo endpoint
(`orders-tab.tsx`, y el `estado=activos` de `salon-tab.tsx`) porque
ninguno de los dos envía hoy `periodo` ni enviaría los nuevos
parámetros — la extensión es inerte para ellos.

## 15. Aislamiento por negocio

```text
SERVER_SIDE_BUSINESS_AUTHORITY=SI — `negocioId = user.id` derivado
  exclusivamente de la sesión (`getUserFromToken`), nunca del query
  string. Confirmado además que `orders-tab.tsx` envía
  `?negocioId=${negocio.id}` en la URL y el servidor lo IGNORA por
  completo — ese parámetro no se lee en ningún lugar de `route.ts`.
CROSS_BUSINESS_FILTER_LEAK_RISK=NINGUNO — un rango de fechas arbitrario
  sólo puede ampliar/acotar CUÁNDO se buscan pedidos, nunca DE QUÉ
  negocio (mismo argumento ya usado en T50).
```

## 16. Performance

```text
HISTORY_CURRENT_INDEXES=@@unique([negocioId, idempotencyKey]),
  @@index([ocupacionMesaId]) — únicos índices de Pedido (confirmado por
  lectura directa del schema)
DATE_FILTER_INDEX_PRESENT=NO (ningún índice cubre
  negocioId+estado+metodoEntrega+mesaNumero+fecha juntos)
PERFORMANCE_RISK=BAJO-MEDIO, preexistente — el mismo hallazgo ya
  documentado en T50 para `Producto`/`Pedido`: los quick filters
  actuales YA escanean sin índice compuesto; un rango custom no es una
  regresión nueva. No se crea índice en A0 ni se recomienda uno
  urgente — si el volumen de pedidos por mesa lo justifica en el
  futuro, `@@index([negocioId, metodoEntrega, mesaNumero, fecha])` sería
  el candidato natural, evaluado en una tarea de hardening separada.
```

## 17. Historial + detalle — contrato de detalle sin cambios

```text
DETAIL_CONTRACT_CHANGE_REQUIRED=NO
```

El filtro sólo decide qué `cuentas` aparecen en la lista del Drawer.
`MesaAccountDetail` (items, cantidades, notas, subtotales, total,
método de pago, actor) y `MesaAccountTicketDialog` (ticket) se abren
exactamente con el mismo objeto `CuentaMesaHistorialResult` que hoy —
cero cambios de forma.

## 18. Estado vacío

Actualmente: `"No hay pedidos anteriores"` genérico, sin distinguir
"nunca hubo historial" de "no hay resultados en este período". Se
recomienda (R1, bajo riesgo): cuando hay un filtro custom activo,
ajustar el copy a algo como `"No hay pedidos en el período
seleccionado"` — cambio de texto condicional, sin nueva arquitectura.
No implementado en A0.

## 19. Mobile

```text
HISTORY_MOBILE_CURRENT_LAYOUT=Drawer (bottom-sheet, ya mobile-first vía
  el componente `Drawer` compartido) + Dialog de detalle con
  `max-h-[90dvh] max-w-lg overflow-y-auto` (ya usa `dvh`, ya tiene scroll
  interno) + grid de mesas responsive (`grid-cols-3 sm:grid-cols-4 md:grid-cols-5`)
HISTORY_MOBILE_FILTER_RISKS=el nuevo botón "Elegir fecha" debe caber en
  la misma fila que las 3 pills existentes sin overflow horizontal en
  viewport angosto — mismo riesgo ya resuelto en T50 con
  `w-[min(320px,calc(100vw-2rem))]` en el `PopoverContent`; se reutiliza
  esa misma clase
```

## 20. Persistencia del filtro

```text
FILTER_PERSISTENCE_CURRENT=estado local (`useState`), se resetea al
  desmontar `HistorialSubTab` (cambio de sub-tab o de tab de negocio) —
  mismo comportamiento que T50 tenía antes de su propio R1
FILTER_PERSISTENCE_RECOMMENDED=preservar el mismo modelo (estado local,
  sin URL/localStorage) — consistente con el resto del panel y sin
  evidencia de que el operador necesite persistencia entre sesiones
```

## 21. Quick filters

```text
HISTORY_CURRENT_QUICK_FILTERS=Hoy, Semana, Mes (NO existe "Todo")
NEW_QUICK_FILTERS_REQUIRED=NO
```

T55 no agrega "Todo" ni ningún otro quick filter nuevo sólo porque T50
lo tiene — el pedido explícito es únicamente Día/Mes específico/Rango.

## 22. Reset / Todo

Diseño: agregar un botón/opción "Todo" dentro del mismo Popover (o como
una 4ta pill) que limpia cualquier filtro custom y vuelve al
comportamiento de "ningún periodo" (backend ya lo soporta: `periodo`
ausente → `where.fecha` no se aplica, todo el historial de esa mesa).
Alternativa más simple y de menor riesgo: reutilizar el label "Mes" ya
existente como el "más amplio" disponible hoy, y agregar "Todo" como
una opción real nueva sólo si el operador confirma que la necesita —
se dinamiza como cuestión abierta a decidir en el review de R1, no
bloqueante para el diseño.

## 23. Validaciones — plan de tests backend (no implementado en A0)

```text
A. día válido            → 200, rango correcto
B. día inválido          → 400
C. mes válido            → 200, rango correcto (mes calendario real)
D. mes inválido          → 400
E. rango válido          → 200
F. rango same-day        → 200 (válido)
G. rango invertido       → 400
H. rango incompleto      → 400 (sólo desde o sólo hasta)
I. combinaciones custom simultáneas → 400 genérico
J. FROM inclusive        → boundary exacto incluido
K. TO exclusive          → boundary exacto excluido
L. cross-business isolation → negocioId siempre de sesión
M. orden/paginación preservados → mismo orderBy, mismo limit/skip
```

## 24. Plan de tests UI (no implementado en A0)

```text
A. abre selector (Popover)
B. modo Día aplica fecha=YYYY-MM-DD
C. modo Mes aplica mes=YYYY-MM (mes calendario, no confundir con quick "Mes")
D. modo Rango aplica desde+hasta
E. Aplicar dispara el fetch; Cancelar no
F. Cancelar descarta el draft sin tocar el filtro vigente
G. Limpiar/Todo vuelve al estado sin filtro custom
H. queryKey cambia por cada filtro distinto (nunca comparte cache)
I. abrir detalle/ticket dentro de un resultado filtrado sigue funcionando
J. mobile: sin overflow horizontal, Aplicar/Cancelar visibles
K. quick filters existentes (Hoy/Semana/Mes) sin regresión
```

## 25. Certificación física futura — preparar, no ejecutar

```text
R2_CASE_A_READY=SI  — Historial sin filtro (comportamiento actual)
R2_CASE_B_READY=CONDICIONAL — día específico con registros conocidos (requiere mesa/fecha real con pedidos)
R2_CASE_C_READY=SI  — día específico sin resultados
R2_CASE_D_READY=CONDICIONAL — mes específico (requiere datos de un mes pasado real)
R2_CASE_E_READY=CONDICIONAL — rango de varios días (requiere datos reales)
R2_CASE_F_READY=SI  — rango same-day
R2_CASE_G_READY=SI  — limpiar filtro y volver a Todo/estado inicial
R2_CASE_H_READY=SI  — abrir detalle dentro de resultado filtrado
R2_CASE_I_READY=SI  — ver ticket dentro de resultado filtrado
R2_CASE_J_READY=SI  — método de pago correcto preservado (autoridad T46)
R2_CASE_K_READY=SI  — mobile
R2_CASE_L_READY=NO_APLICA — no existe paginación/load-more alcanzable
  hoy desde la UI (ver §7) — caso no ejecutable tal como está diseñado
  el R1 propuesto, a menos que R1 decida agregar paginación real
R2_CASE_M_READY=SI  — cambio entre filtros sin resultados stale (mismo
  mecanismo de queryKey que T50 ya certificó)
```

## 26. No mezclar

Confirmado por diseño: T55 no toca T50 (Estadísticas), T47 (Product
Personalization), T51 (Home Redesign), T52 (PWA Identity), T44 (Push),
T39 (Admin/SuperAdmin), la promoción a Production de T46-R2, ni el
finding abierto de Cliente Mesa (`CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING=OPEN`,
permanece bajo autoridad T46, ajeno a T55).

## 27. Plan de implementación R1 (diseño, NO ejecutado)

| PATH | CHANGE | WHY | RISK |
|---|---|---|---|
| `src/lib/date-range-filter.ts` (nuevo) | PRODUCT — extraer `parseIsoDateComponents`/`parseIsoMonthComponents` (hoy privados en `negocio/salon/stats/route.ts`) a un módulo compartido | Evita duplicar el parseo seguro por componentes en un segundo endpoint | Bajo — extracción de ~20 líneas ya probadas, sin cambiar comportamiento |
| `src/app/api/negocio/salon/stats/route.ts` | PRODUCT — importar los parsers desde el nuevo módulo en vez de definirlos localmente | Consistencia, una sola fuente de verdad | Bajo — refactor interno, mismo comportamiento externo, cubierto por los tests ya existentes de T50 |
| `src/app/api/negocio/pedidos/route.ts` | PRODUCT — leer `fecha`/`mes`/`desde`+`hasta` con la precedencia de §12 antes de caer al `periodo` existente | Extensión aditiva del endpoint ya responsable de Historial | Medio — endpoint compartido por 3 callers; mitigado porque los otros 2 nunca envían estos parámetros |
| `src/components/business/salon-tab.tsx` (`HistorialSubTab`) | PRODUCT — nuevo control "Elegir fecha" (Popover Día/Mes/Rango) junto a las 3 pills existentes, nuevo tipo `HistorialFilter`, nuevas `buildHistorialQuery`/`getHistorialFilterQueryKey`, reutilizando `dateToIsoDateString`/`isoDateStringToDate`/`StatsDatePicker`/`Select`/`Popover` ya presentes en el archivo | Único componente real del target | Medio-bajo — mismo archivo ya modificado 2 veces (T50, T47) sin regresión; patrón ya validado |
| `codex-reports/P2_T55_R1_...md` | DOC | Cierre de la ronda de implementación | Ninguno |

```text
R1_PRODUCT_FILES_PLANNED=
  src/lib/date-range-filter.ts (nuevo, compartido)
  src/app/api/negocio/salon/stats/route.ts (refactor interno menor)
  src/app/api/negocio/pedidos/route.ts
  src/components/business/salon-tab.tsx
R1_TEST_FILES_PLANNED=
  src/lib/date-range-filter.test.ts (nuevo, helper puro)
  src/app/api/negocio/pedidos/route.test.ts (nuevo o extendido)
  test focal/contrato estático para HistorialSubTab (mismo patrón T50)
```

## 28. Cierre

```text
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
API_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
PRODUCTION_TOUCHED=NO
T39_TOUCHED=NO
```

`P2_T55_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION` — target real
identificado (modelo por-mesa, distinto de T50), contrato de datos
mapeado con evidencia exacta de código, reuso de T50 acotado y
explícito, plan de R1 por archivo, sin blockers identificados.
`NEXT_ACTION=P2_T55_R1_IMPLEMENTATION_AFTER_REVIEW`.
