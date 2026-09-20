# P2-T50-A0 — Salón Statistics Custom Date Filtering: Audit + Design

Fecha: 2026-09-20
Alcance: AUDITORÍA + DISEÑO ÚNICAMENTE. Sin implementación, sin DB, sin
schema, sin migración, sin Production.

## 0. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=d7e5018149183ddaf3eb0610b3a8f003e5adedf5
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md —
  ninguno ajeno, ninguno de código)
ORIGIN_TESTING_SHA=d7e5018149183ddaf3eb0610b3a8f003e5adedf5
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Worktree T39 confirmado intacto (`54d17d5`), no tocado. `P2_T49_STATUS=
CLOSED_TESTING_CERTIFIED` sin reabrir; `P2_T44_STATUS=
PAUSED_UNRESOLVED_AFTER_TIMEBOX` sin tocar.

## 1. Resumen ejecutivo

La pantalla con los filtros "Hoy/Semana/Mes/Todo" descritos en el finding
NO vive en Terminal Operativa ni en el panel personal — vive en el
**dashboard de Negocio** (`/negocio`, componente `SalonTab` →
`EstadisticasSubTab`), llamando a `GET /api/negocio/salon/stats`. Existe
una superficie de estadísticas de Salón COMPLETAMENTE DISTINTA en
Terminal Operativa (`/operaciones/salon/estadisticas`, filtros
`hoy/7d/30d`, sólo conteos, sin montos, sin empleados) que NO es el
objetivo de este finding y no debe tocarse. El panel personal de cuenta
operativa (`/operaciones/mi-panel/[slug]/salon`) no tiene ninguna
pantalla de estadísticas — es un tablero de ocupación en vivo, sin
relación con T50.

El backend actual (`/api/negocio/salon/stats`) acepta un único parámetro
`periodo` (enum `hoy|semana|mes|todo`, sin fechas libres) y calcula el
rango 100% en el servidor con `Date` nativo (sin librería de fechas, sin
timezone explícito). Es reutilizable de forma aditiva: añadir soporte
para `desde`/`hasta` junto al `periodo` existente, sin romper ningún
contrato actual.

## 2. Inventario de superficies

| SURFACE | ROUTE | ACTOR | COMPONENT | API | CURRENT_FILTERS | IS_T50_TARGET |
|---|---|---|---|---|---|---|
| Negocio — Salón → Estadísticas | `/negocio` (tab Salón → sub-tab Estadísticas) | Negocio (dashboard, cookie de sesión) | `EstadisticasSubTab` en `src/components/business/salon-tab.tsx:542-731` | `GET /api/negocio/salon/stats` | Hoy/Semana/Mes/Todo | **SÍ — objetivo primario** |
| Terminal Operativa — Salón → Estadísticas | `/operaciones/salon/estadisticas` | Terminal (kiosco, scope `salon.estadisticas.ver`) | `src/app/operaciones/salon/estadisticas/page.tsx` | `GET /api/operaciones/salon/estadisticas` | Hoy/7 días/30 días, sólo conteos (sin montos/empleados) | NO — superficie distinta, contrato distinto, no tocar |
| Panel personal cuenta operativa — Salón | `/operaciones/mi-panel/[slug]/salon` | Cuenta operativa personal (mozo) | `src/app/operaciones/mi-panel/[slug]/salon/page.tsx` | `GET /api/operativo/salon/panel/[slug]` | N/A — tablero de ocupación en vivo, sin estadísticas | NO — no existe pantalla de estadísticas acá en absoluto |

```text
T50_PRIMARY_UI_ROUTE=/negocio (SalonTab → EstadisticasSubTab)
T50_PRIMARY_UI_COMPONENT=EstadisticasSubTab
  (src/components/business/salon-tab.tsx:542-731)
T50_PRIMARY_ACTOR=Negocio (dueño del negocio, sesión por cookie)
T50_PRIMARY_API=GET /api/negocio/salon/stats
  (src/app/api/negocio/salon/stats/route.ts)

OTHER_STATISTICS_SURFACES_FOUND=
  /operaciones/salon/estadisticas (Terminal, hoy/7d/30d, sin montos/
    empleados — contrato y auth completamente distintos, NO tocar)
  Ninguna pantalla de estadísticas de Salón existe para el panel
    personal de cuenta operativa (`/operaciones/mi-panel/[slug]/salon`
    es sólo un tablero de ocupación, confirmado por grep — cero
    coincidencias de "estadisticas" en ese árbol)

SHARED_IMPLEMENTATION=NO (a diferencia del patrón de paridad Terminal/
  personal ya documentado para PyR en T44/T45, acá NO existe una
  segunda pantalla de estadísticas equivalente para el panel personal —
  sólo Negocio dashboard vs Terminal, con contratos ya divergentes por
  diseño)
SHARED_API_CONTRACT=NO
PARITY_EXPECTED=NO — T50 sólo debe tocar la superficie de Negocio
  dashboard; no hay evidencia de que el backlog pida extender el
  filtro custom a la pantalla de Terminal (que además es
  deliberadamente "sin fechas libres del cliente", ver §7)
```

## 3. Semántica exacta de los filtros actuales — NO es lo que el nombre sugiere

Auditado en `src/app/api/negocio/salon/stats/route.ts:40-65` (código real,
no inferido del texto de UI):

```text
FILTER_HOY_SEMANTICS=medianoche local del SERVIDOR de hoy → ahora
  (gte: hoy 00:00, sin límite superior)
FILTER_SEMANA_SEMANTICS=ventana RODANTE de 7 días (hoy − 7 días, a las
  00:00) → ahora. NO es "semana calendario" (lunes-domingo).
FILTER_MES_SEMANTICS=ventana RODANTE de 1 mes calendario
  (`now.setMonth(now.getMonth() - 1)`, a las 00:00) → ahora. NO es "mes
  calendario actual" ni "últimos 30 días" exactos (depende de la
  duración real del mes).
FILTER_TODO_SEMANTICS=sin filtro de fecha en absoluto (`dateFilter =
  undefined`) — trae TODO el historial del negocio, sin cota inferior.

CURRENT_FILTER_CALCULATION_LOCATION=100% servidor
  (src/app/api/negocio/salon/stats/route.ts:40-65) — el cliente sólo
  envía el string `periodo`, nunca calcula ni envía fechas.
CLIENT_OR_SERVER=SERVER
```

Ninguno de los tres filtros con nombre tiene un límite superior explícito
— todos son "desde X hasta ahora mismo", nunca "el mes de referencia
completo" en el sentido de un período cerrado. Esto es relevante para
diseñar "mes específico" (agosto 2026 completo, no "desde hace 1 mes
hasta ahora").

## 4. Contrato HTTP actual

```text
API_ACCEPTS_FROM=NO
API_ACCEPTS_TO=NO
API_ACCEPTS_SINGLE_DATE=NO
API_ACCEPTS_MONTH=NO
API_ACCEPTS_PERIOD_ENUM=SI (`periodo=hoy|semana|mes|todo`, default
  `"hoy"` si falta o es un valor no reconocido — fallback silencioso,
  sin error 400)

CURRENT_API_DATE_FORMAT=N/A (no hay parámetro de fecha hoy)
CURRENT_FROM_SEMANTICS=N/A
CURRENT_TO_SEMANTICS=N/A
```

Auth: cookie de sesión (`SESSION_COOKIE_NAME`) + `getUserFromToken` +
`user.type === "negocio"` (líneas 27-35) — `negocioId = user.id`,
derivado exclusivamente de la sesión, nunca de un parámetro del cliente.
Sin scope adicional (no usa `operaciones-terminal-access`, es el modelo
de auth de Negocio, distinto del de Terminal).

## 5. Todas las métricas — ¿comparten el mismo rango?

| METRIC | SOURCE_QUERY | DATE_FIELD | CURRENT_DATE_FILTER | SAME_RANGE_AS_OTHERS | NOTES |
|---|---|---|---|---|---|
| Total Salón (revenue + conteo) | `allDeliveredOrders` filtrado en JS por `metodoEntrega==="mesa"` | `Pedido.fecha` | `periodo` | SÍ | `resumen.totalMesaRevenue`/`totalMesaOrders` |
| Total Negocio (revenue + conteo) | `allDeliveredOrders` sin filtrar por método | `Pedido.fecha` | `periodo` | SÍ | `resumen.totalAllRevenue`/`totalAllOrders` |
| Proporción del salón (%) | derivada 100% client-side de las dos métricas de arriba | — | `periodo` (heredado) | SÍ | `Math.round((totalMesaRevenue/totalAllRevenue)*100)`, duplicado en label+barra |
| Estadísticas por empleado (pedidos + monto) | mismo `allDeliveredOrders`, agrupado por `empleadoId` en JS | `Pedido.fecha` | `periodo` | SÍ | — |
| **Mesas asignadas por mozo** (badge `mesasAsignadas`) | `db.mesa.groupBy` sobre `Mesa.activa===true` actuales | **ninguno — snapshot en vivo** | **NINGUNO** | **NO** | **Inconsistencia real, preexistente**: este número es "mesas asignadas ahora mismo", nunca respeta `periodo` — un mozo puede aparecer con "2 mesas" incluso mirando "Mes" o "Todo" de hace un año |

```text
CURRENT_ALL_METRICS_SHARE_RANGE=NO
```

**Inconsistencia preexistente confirmada** (no introducida por T50, ya
existe hoy): `mozo.mesasAsignadas` es el único dato de la pantalla que NO
depende del `periodo` seleccionado — es un conteo en tiempo real de
`Mesa` activas asignadas, sin ningún filtro de fecha. Todo lo demás
(revenue Salón, revenue Negocio, proporción, pedidos/monto por empleado)
usa consistentemente `allDeliveredOrders` con el mismo `dateFilter`. Esta
inconsistencia debe documentarse pero **no corregirse en T50** — no fue
reportada como bug por el operador, y "corregirla" cambiaría el
significado de un dato ya visible en producción sin pedido explícito
(fuera del alcance funcional de "agregar rango custom").

```text
VISIBLE_METRICS=
  1. Total Salón: revenue (formatPrice) + conteo de pedidos "en mesas"
  2. Total Negocio: revenue (formatPrice) + conteo de pedidos "totales"
  3. Proporción del salón (%): barra + porcentaje, derivado client-side
  4. Estadísticas por empleado: por mozo, conteo de pedidos + monto
     (`pedidosHoy`/`montoHoy`, nombres heredados de cuando sólo existía
     "hoy" — el campo YA es genérico, sólo el nombre quedó desactualizado)
  5. Badge "mesas asignadas" por mozo (NO depende del rango, ver arriba)
NO existe: promedio/ticket, desglose por mesa individual, tasa de
  cancelación (aunque el estado "cancelado" existe en el modelo, esta
  pantalla lo excluye por completo — ver §8).
```

## 6. Campo de fecha canónico

```text
CANONICAL_STATISTICS_DATE_FIELD=Pedido.fecha (DateTime @default(now()),
  prisma/schema.prisma:453) — el ÚNICO campo de fecha usado por esta
  pantalla, para las 4 métricas que sí respetan `periodo`. No hay
  divergencia de campo entre métricas (la única divergencia es de
  ALCANCE — el badge de mesas — no de campo de fecha).
```

No se usa `createdAt`, `updatedAt`, ni ningún timestamp de
entrega/cierre — `fecha` es el momento de creación del pedido y es lo
que este endpoint interpreta como "cuándo ocurrió la venta".

## 7. Timezone / riesgo off-by-one

```text
SERVER_TIMEZONE_ASSUMED_OR_EXPLICIT=IMPLÍCITO — sin ninguna referencia a
  Intl/date-fns-tz/TZ env var/getTimezoneOffset en todo el archivo ni en
  salon-tab.tsx. Los límites de "hoy"/"semana"/"mes" dependen
  enteramente del timezone del proceso Node/contenedor de Railway.
STATISTICS_BUSINESS_TIMEZONE=no declarado explícitamente en código —
  se asume implícitamente igual al timezone del servidor
CURRENT_DAY_BOUNDARY_METHOD=`new Date(now); startDate.setHours(0,0,0,0)`
  — muta la hora/minuto/segundo/ms de una copia de `now` en el timezone
  LOCAL del proceso, no en UTC explícito.
UTC_CONVERSION_PRESENT=NO
OFF_BY_ONE_DAY_RISK=BAJO para el `periodo` enum actual (no hay ningún
  `new Date("YYYY-MM-DD")` en este endpoint hoy — el riesgo clásico de
  interpretación UTC de un string `type=date` NO EXISTE todavía porque
  no hay ningún input de fecha libre). El riesgo se activa recién SI
  R1 introduce un input HTML `type="date"` (que entrega `"YYYY-MM-DD"`)
  y ese string se pasa directo a `new Date(...)` sin normalizar
  manualmente año/mes/día — ver recomendación en §11.
```

El mismo patrón (`setHours(0,0,0,0)` sobre el proceso local, sin TZ
explícito) ya es la convención vigente en TODO el código de estadísticas
de este repo (confirmado también en el endpoint de Terminal, que además
lo documenta explícitamente: *"Medianoche local del servidor (mismo
patrón que /api/operaciones/salon/historial)"*). T50 NO debe introducir
un manejo de timezone distinto sólo para esta pantalla — sería
inconsistente con el resto del sistema sin evidencia de que el timezone
del servidor Railway difiera del de Argentina de forma que ya esté
causando un bug reportado. Se recomienda simplemente EVITAR el patrón
`new Date("YYYY-MM-DD")` (interpretado como UTC medianoche, no local) al
recibir el input del selector — ver §11.

## 8. Estados de pedido incluidos

```text
STATISTICS_ORDER_STATUS_FILTERS=SOLO `estado: "entregado"` — ningún
  estado activo (recibido/preparando/etc.) ni `cancelado` entra en
  ninguna métrica de esta pantalla. Esto debe permanecer IDÉNTICO al
  agregar el rango custom — no es parte del alcance de T50 cambiarlo.
```

## 9. Total Salón vs Total Negocio — universos exactos

```text
SALON_TOTAL_POPULATION=Pedido.negocioId=<negocio de la sesión> AND
  Pedido.estado="entregado" AND Pedido.metodoEntrega="mesa" AND
  Pedido.fecha en el rango del período
BUSINESS_TOTAL_POPULATION=Pedido.negocioId=<negocio de la sesión> AND
  Pedido.estado="entregado" AND Pedido.fecha en el rango del período
  (SIN filtrar por metodoEntrega — incluye "mesa", "retiro",
  "domicilio", cualquier otro valor existente)
SALON_SHARE_FORMULA=Math.round((totalMesaRevenue / totalAllRevenue) *
  100) — client-side únicamente (salon-tab.tsx:640,647), NO viene
  calculado del servidor. Ambos numeradores/denominador ya comparten
  exactamente el mismo `dateFilter` (misma query `allDeliveredOrders`,
  filtrada dos veces en memoria) — confirmado SIN inconsistencia acá.
```

## 10. Empleados

```text
EMPLOYEE_STATS_RANGE_FILTERED=SI (pedidos/monto por empleado sí respetan
  `periodo` — ver §5; sólo el badge de mesas asignadas no lo hace)
EMPLOYEE_STATS_HISTORICAL_IDENTITY_MODEL=
  - Identificación: por `empleadoId` (no por nombre) en la agregación.
  - Empleados desactivados (`activo:false`) SÍ siguen apareciendo, con
    `estadoHistorico: "suspendido"`.
  - Empleados eliminados (`eliminado:true`) SÍ siguen apareciendo, con
    `estadoHistorico: "desvinculado"`.
  - Empleados que ya no existen como fila (`empleadoId` en pedidos pero
    sin `Empleado` correspondiente) aparecen como "Mozo histórico" con
    `estadoHistorico: "historico_sin_registro"`, usando el nombre
    denormalizado `Pedido.empleadoNombre` guardado en el momento del
    pedido.
  - Pedidos sin `empleadoId` (`if (!pedido.empleadoId) continue`, línea
    145) se EXCLUYEN por completo de la lista por empleado — no existe
    ningún bucket "Sin empleado". Sí siguen contando en los totales de
    Salón/Negocio (esos no filtran por `empleadoId`).
  - Empleado renombrado: se muestra el nombre ACTUAL (`empleado.nombre`)
    si el registro todavía existe, nunca el nombre histórico del
    momento del pedido — sólo se usa el nombre histórico cuando el
    registro del empleado ya no existe en absoluto.
```

Ninguno de estos comportamientos históricos se modifica en T50 — se
documentan tal cual están, sin resolver nada fuera de alcance.

## 11. Modelo de rango recomendado

```text
RECOMMENDED_RANGE_MODEL=FROM inclusivo + TO EXCLUSIVO (coincide con el
  estilo ya usado por la propia arquitectura de "medianoche local del
  servidor" del repo — evita el patrón frágil `23:59:59.999`)
RECOMMENDED_FROM_SEMANTICS=medianoche local del día seleccionado como
  inicio (00:00:00.000, hora/proceso local del servidor — mismo patrón
  ya vigente, sin introducir timezone nuevo)
RECOMMENDED_TO_SEMANTICS=medianoche local del día SIGUIENTE al último
  día incluido (00:00:00.000) — nunca `23:59:59.999`, que puede perder
  milisegundos válidos y es más frágil de razonar. Ejemplo: "Desde
  01/09 Hasta 15/09" → `from = 01/09 00:00`, `toExclusive = 16/09 00:00`.
```

Construcción segura recomendada para R1 (evita el riesgo UTC de
`new Date("YYYY-MM-DD")`): parsear el string `"YYYY-MM-DD"` manualmente
en sus 3 componentes numéricos y construir con
`new Date(year, month - 1, day)` (constructor de componentes = SIEMPRE
interpretado en timezone LOCAL, nunca UTC) — exactamente el mismo estilo
que el endpoint de Terminal ya usa
(`new Date(now.getFullYear(), now.getMonth(), now.getDate())`). **No**
usar `new Date("2026-09-20")` directo en el servidor para el string que
llegue del `<input type="date">`.

## 12. Diseño UX — convivencia con los filtros rápidos

Los 4 botones-pastilla existentes (`Hoy/Semana/Mes/Todo`,
`salon-tab.tsx:582-597`) se preservan sin cambios de posición ni estilo.
Se agrega un quinto control después de la fila de pastillas: un botón
"Elegir fecha" (icono calendario) que abre un `Popover` (ya existe en el
design system, `src/components/ui/popover.tsx`, sin uso previo relevante
a esto) con 3 sub-opciones (Día / Mes / Rango), cada una usando el
`Calendar` ya existente (`src/components/ui/calendar.tsx`, envoltorio
shadcn de `react-day-picker` v9 — **ya instalado, cero uso actual en
`src/`**, sería el primer consumidor real). `react-day-picker` v9 soporta
nativamente los 3 modos (`mode="single"`, `mode="range"`) necesarios sin
código adicional de selección.

Al elegir Día/Mes/Rango, el estado `periodo` deja de mostrar ninguna
pastilla como "activa" (visualmente similar a como ya se comporta
cualquier selector con estado exclusivo) y el label del botón "Elegir
fecha" pasa a mostrar el rango elegido (ej. "20 sep" / "Ago 2026" /
"1-15 sep"). No se propone ningún rediseño de las cards de métricas —
sólo la fila de filtros gana una opción más, sin alterar el resto del
layout (esto es T50, no T51).

## 13. Día específico

```text
SPECIFIC_DAY_UI_CONTROL=Calendar en modo `mode="single"` dentro de un
  Popover, reutilizando el componente ya existente
SPECIFIC_DAY_API_MAPPING=nuevo query param `fecha=YYYY-MM-DD` (nombre
  distinto de `desde`/`hasta` para diferenciarlo semánticamente de un
  rango de 1 día — aunque internamente el servidor lo traduce
  exactamente igual: `from = fecha 00:00 local`, `toExclusive = fecha+1
  00:00 local`)
SPECIFIC_DAY_LABEL=formato corto local, ej. "20 sep" (usando
  `Intl.DateTimeFormat` o formato manual — decisión de implementación
  para R1, no bloqueante para el diseño)
```

## 14. Mes específico

```text
SPECIFIC_MONTH_UI_CONTROL=Calendar en modo `mode="single"` pero con
  `captionLayout="dropdown"` limitado a selección de mes/año (o un
  selector `<select>` año+mes más simple si el modo de `react-day-picker`
  resulta más complejo de lo necesario — decisión de implementación,
  ninguna opción rompe el contrato del backend)
SPECIFIC_MONTH_API_MAPPING=nuevo query param `mes=YYYY-MM` →
  `from = primer día del mes 00:00 local`, `toExclusive = primer día del
  mes SIGUIENTE 00:00 local` — usando aritmética nativa
  (`new Date(year, month - 1, 1)` / `new Date(year, month, 1)`), sin
  necesidad de calcular cuántos días tiene el mes manualmente.
SPECIFIC_MONTH_LABEL="Agosto 2026" (no "mes actual" — cualquier mes
  pasado debe poder elegirse, tal como pide el finding)
```

## 15. Rango personalizado

```text
CUSTOM_RANGE_FROM_CONTROL=Calendar en modo `mode="range"`, campo "Desde"
CUSTOM_RANGE_TO_CONTROL=mismo Calendar range, campo "Hasta"
CUSTOM_RANGE_API_MAPPING=nuevos query params `desde=YYYY-MM-DD` +
  `hasta=YYYY-MM-DD`, ambos inclusive desde la perspectiva del usuario →
  `from = desde 00:00 local`, `toExclusive = hasta+1 00:00 local`
  (garantiza que el día "Hasta" completo quede incluido, sin depender
  de `23:59:59.999`)
```

## 16. Validación UX

```text
CURRENT_RANGE_VALIDATION=NINGUNA (no existe hoy ningún input de fecha
  libre que validar)
RECOMMENDED_RANGE_VALIDATION=
  - `desde` vacío o `hasta` vacío en modo rango: no disparar el fetch
    todavía (deshabilitar el botón "Aplicar" hasta que ambos estén
    completos) — UX, no error de servidor.
  - `desde > hasta`: rechazar en el cliente antes de enviar (mensaje
    breve), Y el servidor debe validarlo también de forma defensiva
    (400) por si el cliente lo permite igual.
  - Mismo día en modo rango: válido — equivale a "Día específico" con
    otro control, sin necesidad de bloquearlo.
  - Fecha futura: NO bloquear — el propio contrato actual ya permite
    "Hoy" (que técnicamente incluye "ahora, que avanza") sin problema;
    una fecha futura sin pedidos simplemente devuelve ceros, consistente
    con el comportamiento ya esperado de "Todo" cuando no hay datos.
  - Rango enorme (ej. 5 años): no bloquear por producto en R1 — no hay
    evidencia de que sea un problema real todavía (ver §23 performance);
    si se detecta un problema real de latencia en R2, se puede agregar
    un límite razonable en una ronda posterior, no ahora sin evidencia.
```

## 17. Estado / URL / persistencia del filtro

```text
CURRENT_FILTER_PERSISTENCE=sólo `useState` local dentro de
  `EstadisticasSubTab` — se resetea a `"hoy"` cada vez que el
  sub-tab se desmonta (cambio de sub-tab, o de tab de negocio) y se
  vuelve a montar, dado el `AnimatePresence mode="wait"` que envuelve
  el contenido del sub-tab por `key`.
```

Recomendación: preservar exactamente ese mismo modelo (estado local, sin
URL, sin localStorage) para el filtro custom nuevo — es coherente con
el comportamiento actual (los quick filters tampoco persisten hoy), y
agregar persistencia en URL/localStorage sería una expansión de alcance
no pedida por el finding. Si el operador quisiera persistencia entre
sesiones, eso sería una mejora de UX separada, a evaluar después de ver
el comportamiento real en R2.

## 18. Loading / race conditions

```text
CURRENT_STATS_REQUEST_RACE_PROTECTION=NINGUNA explícita en esta pantalla
  — TanStack Query (`useQuery`) con `queryKey: ["salon-stats",
  negocio.id, periodo]` deduplica/cachea por clave, así que cambiar
  rápido entre "Agosto" → "Septiembre" no puede hacer que la respuesta
  de Agosto pise el estado mostrado de Septiembre (cada `periodo`
  distinto tiene su propia entrada de caché/render), pero SÍ puede
  mostrar brevemente datos stale de una consulta anterior en la MISMA
  clave si el usuario re-consulta el mismo período muy rápido — riesgo
  bajo y preexistente, no se agrava por T50 (los nuevos filtros custom
  simplemente participan de la misma `queryKey` con el valor de fecha
  incluido, heredando la misma garantía de TanStack Query).
```

Recomendación: incluir el valor completo del filtro (período O fecha/mes/
rango) en el `queryKey`, exactamente como ya se hace con `periodo` —
suficiente, sin necesidad de agregar `AbortController` nuevo (el patrón
YA existe en el endpoint de Terminal si en el futuro hiciera falta, pero
no es necesario para esta pantalla dado que React Query ya lo resuelve).

## 19. Permisos / aislamiento

```text
BUSINESS_CONTEXT_SOURCE=exclusivamente la sesión (`user.id` del cookie,
  vía `getUserFromToken`) — nunca un parámetro del cliente.
DATE_FILTER_CAN_CHANGE_AUTH_SCOPE=NO
CROSS_BUSINESS_RANGE_QUERY_RISK=NINGUNO — agregar `desde`/`hasta`/
  `fecha`/`mes` como parámetros de fecha no introduce ningún vector
  IDOR/BOLA nuevo: el `where.negocioId` sigue derivándose 100% de la
  sesión, un rango de fechas arbitrario sólo puede ampliar o acotar
  CUÁNDO se buscan pedidos, nunca DE QUÉ negocio.
```

## 20. Performance

```text
DATE_FILTERED_QUERIES=
  1. `db.pedido.findMany({ where: { negocioId, fecha, estado } })`
     (línea 70-83) — trae filas completas (no agregación DB), filtra
     "mesa" vs total en JS.
  2. `db.empleado.findMany` — sin filtro de fecha (por diseño, es
     metadata de empleados, no de pedidos).
  3. `db.mesa.groupBy` — sin filtro de fecha (snapshot en vivo, ver §5).
RELEVANT_EXISTING_INDEXES=NINGUNO — el modelo `Pedido`
  (prisma/schema.prisma:362-469) sólo tiene `@@unique([negocioId,
  idempotencyKey])` y `@@index([ocupacionMesaId])`. No existe ningún
  índice sobre `negocioId`, `fecha`, `estado` ni `metodoEntrega`, ni
  individual ni compuesto.
INDEX_CHANGE_EXPECTED=NO en A0 (explícitamente prohibido en esta
  ronda) — pero se documenta como hallazgo real para una ronda de
  implementación futura: un rango custom no empeora el costo actual
  (la query ya escanea todo el historial del negocio para "Todo" sin
  índice, hoy mismo, en producción) — no es una regresión nueva
  introducida por T50, es un costo preexistente. Se recomienda evaluar
  `@@index([negocioId, estado, fecha])` en una tarea de hardening
  separada si el volumen de pedidos por negocio lo justifica, NO como
  parte de T50-R1 (fuera de alcance: "NO schema, NO migration").
```

## 21. Decisión de reutilización de API

```text
T50_API_DECISION=B. EXISTING_API_REUSABLE_WITH_ADDITIVE_QUERY_PARAMS
T50_API_DECISION_REASON=El endpoint ya deriva el negocio de la sesión,
  ya calcula un `dateFilter` único reutilizado por las 4 métricas que
  importan, y ya tiene un `switch` fácilmente extensible. Agregar
  `fecha`/`mes`/`desde`+`hasta` como parámetros adicionales (evaluados
  ANTES del `switch` de `periodo`, o como un valor especial de
  `periodo`) es un cambio aditivo — ningún cliente existente deja de
  funcionar, no hace falta versionar ni crear un endpoint nuevo.
```

## 22. Plan de implementación R1 (diseño, NO ejecutado)

| PATH | CHANGE | WHY | RISK |
|---|---|---|---|
| `src/app/api/negocio/salon/stats/route.ts` | PRODUCT — leer `fecha`/`mes`/`desde`+`hasta` (nuevos params opcionales) además de `periodo`; construir `from`/`toExclusive` con aritmética nativa de componentes (nunca `new Date("YYYY-MM-DD")`); validar `desde<=hasta` con 400 si no; mantener el `switch` de `periodo` intacto como fallback cuando no se envía ningún parámetro custom | Único lugar donde se calcula el rango hoy; cambio aditivo, sin tocar el resto de la query | Bajo — misma query, mismo shape de respuesta, sólo cambia cómo se calculan `from`/`to` |
| `src/components/business/salon-tab.tsx` (`EstadisticasSubTab`) | PRODUCT — agregar el botón "Elegir fecha" + Popover con 3 sub-modos (Día/Mes/Rango) usando `Calendar`; extender el `queryKey`/`queryFn` para incluir el filtro custom cuando esté activo | Único componente que renderiza esta pantalla | Bajo-medio — es la única UI nueva real de esta tarea; usa componentes ya instalados (Calendar/Popover), primer uso real de ambos |
| `src/app/api/negocio/salon/stats/route.test.ts` (nuevo) | TEST — cobertura de los 9+ casos backend de §26 | No existe hoy ningún test para este endpoint | Ninguno |
| `codex-reports/P2_T50_R1_...md` | DOC | Cierre de la ronda de implementación | Ninguno |

```text
R1_PRODUCT_FILES_PLANNED=
  src/app/api/negocio/salon/stats/route.ts
  src/components/business/salon-tab.tsx
R1_TEST_FILES_PLANNED=
  src/app/api/negocio/salon/stats/route.test.ts (nuevo)
  posible test focal pequeño de UI si el patrón de contrato estático
  (ya usado en T45/T49) resulta suficiente para la lógica de mapeo
  fecha→params sin necesitar un harness de Calendar/Popover completo
```

No se toca `salon.estadisticas.ver` (Terminal), ni ningún archivo de
`operaciones-terminal-access.ts`, ni schema, ni migración.

## 23. Plan de tests (diseño, NO creado en A0)

```text
BACKEND (route.test.ts nuevo):
  A. periodo=hoy (comportamiento actual, sin regresión)
  B. periodo=semana (comportamiento actual, sin regresión)
  C. periodo=mes (comportamiento actual, sin regresión)
  D. periodo=todo (comportamiento actual, sin regresión)
  E. fecha=YYYY-MM-DD (día específico) → from=medianoche ese día,
     toExclusive=medianoche día siguiente
  F. mes=YYYY-MM (mes específico) → from=primer día del mes,
     toExclusive=primer día del mes siguiente
  G. desde+hasta mismo día → equivalente a un solo día
  H. desde+hasta varios días → from=desde 00:00, toExclusive=hasta+1 00:00
  I. desde > hasta → 400
  J. boundary: pedido exactamente a las 00:00:00.000 del primer día
     incluido en el conteo; pedido exactamente a las 00:00:00.000 del
     día siguiente al último EXCLUIDO
  K. cambio de mes (ej. mes=2026-08 no confunde pedidos de septiembre)
  L. cambio de año (ej. mes=2025-12 no confunde con 2026-12)
  M. cross-business: pedido de otro negocio nunca aparece pese a
     cualquier rango de fecha
  N. todas las métricas (Salón/Negocio/empleados) usan el MISMO rango
     dado cualquiera de los filtros nuevos, igual que hoy
FRONTEND:
  - quick filters (Hoy/Semana/Mes/Todo) siguen funcionando sin cambios
  - selector Día abre Calendar en modo single y dispara la query correcta
  - selector Mes permite elegir un mes PASADO, no sólo el actual
  - Desde/Hasta valida desde<=hasta antes de disparar el fetch
  - labels correctos para cada modo
  - loading/error se preservan (mismo patrón `isLoading` ya existente)
  - cambio rápido entre filtros no deja stale overwrite (React Query
    por queryKey, ver §18)
  - usable en mobile (Popover no debe desbordar la pantalla — revisar
    breakpoint del componente Popover ya existente)
```

No se crea ningún test en A0 — sólo diseño, per instrucción explícita.

## 24. Certificación física futura R2 (preparar, NO ejecutar)

```text
R2_CASE_A_READY=SI — Regresión de quick filters: Hoy/Semana/Mes/Todo
  siguen funcionando exactamente igual que hoy.
R2_CASE_B_READY=SI — Día específico: elegir un día con datos conocidos,
  confirmar las 4 métricas relevantes (Salón/Negocio/proporción/
  empleados).
R2_CASE_C_READY=SI — Mes específico: elegir un mes anterior con datos
  conocidos (no el actual).
R2_CASE_D_READY=SI — Rango personalizado: Desde/Hasta con varios días,
  confirmar que el último día queda incluido completo.
R2_CASE_E_READY=CONDICIONAL — Boundary (pedido cerca de medianoche):
  sólo si existe evidencia de un pedido real ya registrado exactamente
  en ese límite; no se fabrica un pedido nuevo sólo para probar esto
  (fuera de alcance de A0 y de la certificación sin mutar datos).
R2_CASE_F_READY=SI — Mobile: selector usable sin overflow/cortes,
  revisar el Popover en viewport angosto.
```

## 25. No confundir con T47/T51/T52

Confirmado por alcance: T50 no toca productos/opciones/aderezos (T47),
no es un rediseño visual general de Operaciones (T51 — sólo se agrega un
control de filtro adicional a una fila ya existente, sin tocar el resto
del layout), y no toca branding/manifest/iconos/legacy identity (T52).

## 26. Cierre

```text
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
API_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_MUTATED=NO
PRODUCTION_TOUCHED=NO
T39_TOUCHED=NO
```

`P2_T50_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION` — arquitectura
concreta, evidencia por archivo/línea, decisión de API tomada (extensión
aditiva), sin blockers identificados.
