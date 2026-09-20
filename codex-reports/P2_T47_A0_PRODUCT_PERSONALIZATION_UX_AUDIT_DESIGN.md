# P2-T47-A0 — Operations Product Personalization UX: Audit + Root Cause + UX Design

Fecha: 2026-09-20
Alcance: AUDITORÍA + DISEÑO + DOCUMENTACIÓN ÚNICAMENTE. Sin código de
producto, sin tests, sin DB, sin schema, sin migración, sin Production,
sin prueba física.

## 0. Objetivos de esta tarea (dos)

A. Reconciliar el backlog tras el cierre físico de P2-T50 — ver §1-3.
B. Auditar y diseñar P2-T47 antes de implementar nada — ver §4 en
   adelante.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=72657109016631a890d9bec504f34eb922aefcf2
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md —
  ninguno ajeno, ninguno de código)
ORIGIN_TESTING_SHA=72657109016631a890d9bec504f34eb922aefcf2
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Worktree T39 (`C:/Leo Campos/Trabajo/deligo-t39-admin`,
`work/p2-t39-admin-notifications`, HEAD `54d17d5`) confirmado intacto,
no tocado.

## 2. Reconciliación de ROADMAP tras el cierre de P2-T50

`codex-reports/ROADMAP.md` ya reflejaba `P2_T50_STATUS=
CLOSED_TESTING_CERTIFIED` desde el cierre físico anterior (commit
`7265710`) — verificado por lectura directa antes de tocar nada más:
Sección A (CLOSED/PRODUCTION) ya incluye la entrada
`P2_T50_STATUS=CLOSED_TESTING_CERTIFIED / RELEASE_ELIGIBLE=YES /
PRODUCTION_PROMOTED=NO`, Sección B (ACTIVE/ACTIONABLE) ya NO listaba
P2-T50, y el ítem narrativo #14 ya decía `CLOSED_TESTING_CERTIFIED,
RELEASE_ELIGIBLE=YES`. No quedaba ningún `READY_FUTURE`/`ACTIVE`/
`ACTIONABLE`/`IN_PROGRESS` residual para T50 en ese archivo.

Se revisaron además `codex-reports/CODEX_REPORT.md`,
`codex-reports/FINDINGS.md` y `codex-reports/COMPLETED_TASKS.md`
(existen los tres): `FINDINGS.md`/`COMPLETED_TASKS.md` no mencionan
P2-T50 en absoluto. `CODEX_REPORT.md` sólo lo menciona una vez, en una
nota histórica de cómo se agrupó el backlog original (2026-09-09,
"P2-T50 Salon Statistics Date Filtering, punto 9 (P2)") — es contexto
de origen, no una afirmación de estado vigente, y `CODEX_REPORT.md` no
ha sido la autoridad de estado mantenida en esta sesión (su propio
`CURRENT_TASK` en línea 4 sigue apuntando a una tarea de 2026-09-10,
muy anterior a T45/T49/T50 — un problema de mantenimiento preexistente,
no introducido ni agravado acá). Por instrucción explícita de esta
tarea ("no reescribir historia en reportes cerrados antiguos" / sólo
corregir si forma parte de "la autoridad vigente"), no se edita
`CODEX_REPORT.md` — no es la autoridad viva de este backlog en la
práctica de esta sesión (esa autoridad es `ROADMAP.md` +
`DELIGO_FULL_CONTEXT_LATEST.md`, ya reconciliados).

```text
ROADMAP_T50_RECONCILED=SI (ya estaba correcto; no requirió cambios
  adicionales en esta ronda)
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
P2_T50_RELEASE_ELIGIBLE=YES
```

## 3. Nueva tarea futura registrada — Salon History Custom Date Filtering

Búsqueda exhaustiva de colisión de IDs (`grep -r "P2-T55" codex-reports/
DELIGO_FULL_CONTEXT_LATEST.md`, recursivo): **0 coincidencias** — el ID
está libre. El ID más alto ya usado en todo el repo es `P2-T54`
(confirmado listando todos los `P2-T[0-9]+` únicos de
`codex-reports/*.md` y `DELIGO_FULL_CONTEXT_LATEST.md`).

```text
SALON_HISTORY_DATE_FILTER_TASK_ID=P2-T55
SALON_HISTORY_DATE_FILTER_TASK_STATUS=READY_FUTURE
SALON_HISTORY_DATE_FILTER_TASK_PRIORITY=P2
```

Registrada en `codex-reports/ROADMAP.md` Sección B con título
"Salon History Custom Date Filtering", scope inicial Panel Negocio →
Salón → Historial, objetivo futuro preservar filtros/paginación
actuales y agregar día específico/mes específico/rango Desde-Hasta,
usando como autoridad CONCEPTUAL el modelo FROM inclusivo/TO exclusivo
ya certificado en T50 — pero SIN asumir que Historial comparte endpoint
o campo de fecha con Estadísticas (T50). Esa auditoría queda para la
futura tarea, no se ejecuta acá. No implementada.

## 4. Preflight de git ya cubre §6 del task spec (ver §1 arriba) — sin
   product code dirty ajeno, T39 intacto, orígenes confirmados.

## 5. Metodología de la auditoría de T47

Se combinó lectura directa de código (schema, componentes, API routes)
con un agente de exploración de código de alcance muy amplio ("very
thorough"), y TODAS las afirmaciones cargadas de este reporte fueron
re-verificadas por lectura directa propia (no se confía ciegamente en
el agente) — específicamente: `prisma/schema.prisma` (modelos
`Producto`/`Agregado`/`Ingrediente`/`ProductoAgregado`/
`ProductoIngrediente`/`OpcionesCompartidas`), el archivo completo del
personalizador de Operaciones (`src/app/mozo/panel/[slug]/pedido/
[mesaId]/page.tsx`, incluyendo `QuantityStepper`/`ChoiceButton`/
`OptionGroup`), el bloque de agrupación por categoría en
`src/app/n/[slug]/page.tsx` (líneas 1704-1724 y 2395-2403), el dedup
case-sensitive en `src/components/business/agregados-section.tsx`
(líneas 405-428), y `src/lib/operaciones-terminal-permissions.ts`
(`OPERACIONES_AREAS`).

## 6. Inventario exhaustivo de superficies de personalización

| SURFACE | ROUTE | ACTOR | COMPONENT | DATA_SOURCE | SHARED_COMPONENT | IS_T47_TARGET |
|---|---|---|---|---|---|---|
| Mozo (cuenta personal) | `/mozo/panel/[slug]/pedido/[mesaId]` | Empleado mozo | `ProductConfigurator` (inline, `page.tsx:649-954`) | `GET/POST /api/operativo/mozo/panel/[slug]/pedidos` | Canónico | **SÍ — target primario** |
| Operaciones personal panel | `/operaciones/mi-panel/[slug]/pedido/[mesaId]` | Empleado mozo vía Operaciones | mismo `ProductConfigurator` | mismo `/api/operativo/...` | **Re-export literal** (`export { default } from ".../mozo/.../page"`) | **SÍ — mismo target, mismo archivo** |
| Operaciones Terminal Salón (kiosco) | `/operaciones/salon`, `/operaciones/terminal` | Terminal compartida | ninguno — sin flujo de creación/personalización de pedido | n/a | n/a | NO — el kiosco no tiene scope de pedidos de producto (`OPERACIONES_AREAS=["salon","pyr"]`, "NUNCA mozo") |
| Cliente storefront | `/n/[slug]` | Cliente | `ProductDetailSheet` (inline, `page.tsx:1647-2532`) | `GET /api/negocios/[slug]` | — | NO es "Operaciones", pero SÍ es donde se reproduce el síntoma "Aderezos/aderezos" — ver §10 |
| Cliente Mesa (pedido en mesa vía QR) | `/n/[slug]?mesa=X` | Cliente en mesa física | mismo `ProductDetailSheet` | mismo `/api/negocios/[slug]` | Mismo componente que Cliente storefront | NO es "Operaciones" en sentido estricto, pero es una de las superficies físicamente revisadas junto con Operaciones en el finding original (ver §7) |
| Negocio "Vista previa" | `/n/[slug]?preview=true&previewSource=business` | Dueño de negocio | mismo `ProductDetailSheet`, con `isPreview` | mismo `/api/negocios/[slug]` | Mismo componente | NO es "Operaciones" |

```text
OPERATIONS_PERSONALIZER_SHARED=SI
SHARED_BETWEEN_TERMINAL_AND_PERSONAL=NO (Terminal Salón kiosco no tiene
  ningún flujo de personalización de producto — confirmado por
  `OPERACIONES_AREAS=["salon","pyr"]`, sin scope de pedidos, comentario
  explícito "NUNCA mozo" en operaciones-terminal-permissions.ts)
SHARED_WITH_MOZO=SI (re-export literal, 100% el mismo archivo/componente)
SHARED_WITH_CLIENT=NO (Cliente usa `ProductDetailSheet`, una
  implementación completamente separada e independiente que consume el
  mismo modelo de datos pero con código propio)
```

## 7. Identificación del target real — reconciliación con el finding original

```text
T47_PRIMARY_ROUTE=/operaciones/mi-panel/[slug]/pedido/[mesaId]
  (re-export de /mozo/panel/[slug]/pedido/[mesaId]/page.tsx)
T47_PRIMARY_ACTOR=Empleado con rol mozo (cuenta operativa personal
  dentro de Operaciones; el mismo componente también sirve al actor
  Mozo legacy standalone)
T47_PRIMARY_COMPONENT=ProductConfigurator (inline en
  src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx:649-954)
T47_PRIMARY_PRODUCT_SOURCE=Producto + Agregado + Ingrediente +
  OpcionesCompartidas (Prisma), vía GET /api/operativo/mozo/panel/
  [slug]/pedidos
T47_PRIMARY_API=GET/POST /api/operativo/mozo/panel/[slug]/pedidos
```

**Hallazgo importante que reconcilia el finding original**: el finding
#5 se registró durante una revisión física que cubrió explícitamente
"Operaciones/Mozo/PyR/Salón/TerminalOperativa/panel Negocio(Salón)/
**Cliente Mesa**" en conjunto (ver
`P2_OPERACIONES_SALON_OPERATOR_MANUAL_REVIEW_BACKLOG_RECONCILIATION.md`,
encabezado de la sección de hallazgos) — no sólo "Operaciones" en
sentido estricto. Esto importa porque, con evidencia de código:

- `ProductConfigurator` (el personalizador REAL de Operaciones/Mozo)
  **no agrupa por categoría en absoluto** — todos los `agregados` caen
  bajo un único título hardcodeado literal `"Agregados"` (línea 900) y
  todos los `ingredientes` bajo `"Quitar ingredientes"` (línea 911).
  Estructuralmente **no puede** producir dos encabezados
  "Aderezos"/"aderezos" — el campo `categoria` de `Agregado`/
  `Ingrediente` ni siquiera se lee para agrupar acá.
- `ProductDetailSheet` (Cliente storefront, Cliente Mesa vía
  `/n/[slug]?mesa=X`, y la "Vista previa" del propio Negocio) **sí**
  agrupa por categoría, con una `Map` sin normalizar (ver §10) — este
  es el único componente de todo el repo que puede reproducir
  literalmente el síntoma "Aderezos"/"aderezos" como dos encabezados
  visibles.

Conclusión: el finding original mezcló DOS problemas reales pero
DISTINTOS, ambos legítimos, que comparten el mismo backlog item porque
se observaron en la misma sesión de revisión física:

1. Inconsistencia visual general de controles (+/-/trash/count, chips,
   extras con precio, quitar ingredientes, títulos/spacing) — esto SÍ
   es genuinamente `ProductConfigurator` (Operaciones/Mozo).
2. La duplicación específica "Aderezos/aderezos" — esto es
   `ProductDetailSheet`, alcanzado vía Cliente Mesa (que sí estuvo
   dentro del alcance de la revisión física original) o la Vista previa
   del Negocio, NO vía el personalizador de Operaciones propiamente
   dicho.

Ambos comparten la MISMA causa raíz de datos (ver §10), así que tiene
sentido seguir tratándolos como un solo backlog item (T47) — pero el
plan de R1 debe tocar ARCHIVOS DISTINTOS para cada uno, y eso se
documenta explícitamente en el plan (§20).

## 8. Mapeo del modelo de producto (schema real, sin cambios)

| UI_SECTION | SOURCE_MODEL | SOURCE_FIELD | CARDINALITY | REQUIRED/OPTIONAL | PRICE_MODEL | LIMIT_MODEL | CAN_REMOVE | NOTES |
|---|---|---|---|---|---|---|---|---|
| Talle/Color (ropa) | `Producto.talles`/`colores` | JSON string[] | 1 de N | opcional | sin precio | ninguno | n/a | sólo rubro ropa |
| Secciones propias | `Producto.secciones` | JSON (nombre, obligatorio, maximo, opciones[{nombre,precio}]) | 1 o N según `maximo` | ambos, por `obligatorio` | delta opcional vía `formatOptionalPriceDelta` | `maximo` (0 = sin límite superior, 1 = single-select) | no aplica (son elecciones, no remociones) | "propias" = configuradas por producto, no compartidas |
| Opciones compartidas | `OpcionesCompartidas` (vía `Producto.opcionesCompartidasIds`) | `nombre`, `opciones[]`, `obligatorio`, `maximo` | 1 o N | ambos, por `obligatorio` | precio por opción | `maximo` | no aplica | reutilizable entre productos del mismo negocio |
| Agregados (extras) | `Agregado` (vía `ProductoAgregado`) | `nombre`, `precio`, `categoria` | N (multi-toggle libre) | siempre opcional | precio fijo por unidad, sin cantidad | ninguno (sin `maximo`) | no aplica (son adiciones) | `categoria` existe en schema pero NO se usa para agrupar en `ProductConfigurator` |
| Ingredientes (quitar) | `Ingrediente` (vía `ProductoIngrediente`) | `nombre`, `categoria` | N (multi-toggle libre) | siempre opcional | sin precio (remover nunca cobra) | ninguno | SÍ — ésta es la única sección de remoción | `categoria` también sin usar en `ProductConfigurator` |
| Cantidad | n/a (estado local del formulario) | — | 1 pedido = N unidades | — | multiplica el total unitario | mínimo 1 dentro del configurador (nunca 0 mientras se está armando) | ver §18 | en el carrito ya armado, decrementar a 0 sí elimina la línea |

No se cambia ningún campo de schema en esta ronda.

## 9. Root cause — "Aderezos / aderezos"

Para cada string visible relevante:

```text
ADEREZOS_LABEL_1_SOURCE=Agregado.categoria o Ingrediente.categoria =
  "Aderezos" (fila de datos, negocio-específica — no hay ningún literal
  hardcodeado "Aderezos" en todo `src/`, confirmado por grep exhaustivo
  con 0 coincidencias)
ADEREZOS_LABEL_2_SOURCE=Agregado.categoria o Ingrediente.categoria =
  "aderezos" (otra fila de datos del MISMO negocio, distinta sólo en
  capitalización)
ADEREZOS_SAME_DATA=NO (son dos valores de string JS distintos —
  "Aderezos" !== "aderezos" — por lo tanto dos filas reales e
  independientes en Postgres, no la misma fila renderizada dos veces)
ADEREZOS_DUPLICATION_CLASSIFICATION=DATA_INCONSISTENCY
```

**Mecanismo exacto, extremo a extremo, con evidencia de código:**

1. **Origen de los datos** — `prisma/schema.prisma`: `Agregado.categoria`
   (línea 333) e `Ingrediente.categoria` (línea 349) son
   `String @default("")` — texto libre, sin enum, sin `@@unique`, sin
   `@@index`, sin ninguna restricción de unicidad case-insensitive en
   todo el schema (1400+ líneas, verificado).
2. **Cómo se crea el duplicado** — `src/components/business/
   agregados-section.tsx:410-428` (`handleAddCategoryInForm`): el
   formulario de catálogo del Negocio ofrece un `<Select>` con las
   categorías existentes MÁS un botón "+" que revela un `<Input
   placeholder="Nueva categoría...">` de texto libre. El chequeo de
   duplicado antes de crear una categoría "nueva" es
   `categories.includes(trimmed)` — un `Array.includes` **case-sensitive**.
   Si ya existe "Aderezos" y el dueño del negocio escribe "aderezos",
   `includes` devuelve `false`, así que se trata como una categoría
   genuinamente nueva y se persiste tal cual. El mismo patrón exacto
   existe en `src/components/business/ingredientes-section.tsx`
   (`handleAddCategory`, chequeo `allCategories.includes(trimmed)`).
   Ningún endpoint de servidor (`PATCH /api/negocio/config/categorias`,
   `PATCH /api/negocio/config`) normaliza mayúsculas/minúsculas tampoco
   — todo el pipeline de creación/renombrado es 100% case-sensitive.
3. **Cómo se hace VISIBLE el duplicado** — `src/app/n/[slug]/page.tsx:
   1704-1724` (`agregadosByCategory`/`ingredientesByCategory`): agrupa
   con un `Map<string, ...>` usando la key `a.categoria` **sin
   `.toLowerCase()`, sin `.trim()`, sin normalización de ningún tipo**.
   Dos categorías que difieren sólo en mayúsculas producen DOS entradas
   de `Map` distintas, y el render (`page.tsx:2396-2403` y el bloque
   análogo de ingredientes) crea un `<h4>` por cada entrada — dos
   encabezados visibles, uno por cada capitalización.
4. **Dónde NO se hace visible** — `ProductConfigurator`
   (Operaciones/Mozo) nunca lee `.categoria` para agrupar (§7) — ahí el
   mismo par de filas de datos simplemente aparece como dos ítems más
   dentro de la única lista "Agregados"/"Quitar ingredientes", sin
   ningún encabezado duplicado visible.

```text
DUPLICATE_VISIBLE_SECTION_IS_DATA_PROBLEM=SI (causa raíz real: campo de
  texto libre sin dedup case-insensitive en la UI de catálogo del
  Negocio — cualquier negocio puede reproducirlo hoy mismo con un solo
  typo de mayúscula)
DUPLICATE_VISIBLE_SECTION_IS_RENDER_PROBLEM=SI (contribuyente: el
  agrupamiento de `ProductDetailSheet` no normaliza antes de usar la
  categoría como key del Map — un fix de UI puro, sin tocar datos,
  eliminaría el síntoma visible sin resolver el dato subyacente)
DUPLICATE_VISIBLE_SECTION_IS_NAMING_PROBLEM=NO (no es sólo una
  coincidencia de nombres percibida por el operador — es un bug de
  datos reproducible con evidencia de código exacta, no una
  confusión visual entre dos conceptos distintos)
```

## 10. No mutar datos en A0

Confirmado: `PRODUCT_CODE_CHANGED=NO`, `DB_MUTATED=NO` en toda esta
ronda. Aunque la causa raíz es de datos, no se corrige ningún registro,
no se hace merge, no se renombra nada en Postgres, no hay migration ni
backfill.

Disposición recomendada para R1 (sin ejecutar todavía):

- **A. corregir UI** (SÍ, para el síntoma visible): normalizar la key de
  agrupamiento en `ProductDetailSheet` (`cat.trim().toLowerCase()`)
  preservando el primer texto-tal-cual-fue-escrito como label visible —
  cambio puro de presentación, cero mutación de datos, resuelve el
  síntoma reportado inmediatamente.
- **B. corregir configuración** (recomendado como seguimiento, NO en el
  R1 de T47): agregar un chequeo case-insensitive en
  `agregados-section.tsx`/`ingredientes-section.tsx` al crear/renombrar
  una categoría, para que el propio Negocio no pueda volver a crear el
  duplicado. Se documenta como hallazgo separado (§18) porque toca la
  UI de catálogo de Negocio, no el personalizador de Operaciones que da
  nombre a T47 — mezclarlo ahí sería expandir el alcance sin pedido
  explícito.
- **C. herramienta/admin de limpieza de datos existentes**: no
  necesaria de forma urgente — no hay evidencia de que existan hoy
  filas duplicadas reales en producción/testing (no se consultó la DB
  en esta ronda; la clasificación es por mecanismo de código, no por
  observación directa de filas — ver nota de alcance abajo). Si el
  operador confirma filas reales duplicadas al revisar R1, se evalúa
  ahí.
- **D. tarea separada de data cleanup**: no se abre en esta ronda — sin
  evidencia de volumen que lo justifique.

**Nota de alcance sobre evidencia de datos**: esta auditoría identificó
el mecanismo EXACTO por código (schema sin constraints + dedup
case-sensitive + agrupamiento sin normalizar) que permite y expone el
síntoma, pero NO se ejecutó ninguna consulta a la base de datos real
para confirmar cuántas filas duplicadas existen hoy — un intento de
consulta de sólo lectura fue bloqueado por el clasificador de
seguridad del entorno (por manejo de credenciales embebidas en el
comando) y no se insistió en eludirlo. La clasificación
`DATA_INCONSISTENCY` se sostiene igualmente porque el mecanismo de
código deja cero ambigüedad sobre CÓMO se produciría/produjo el
síntoma, con o sin confirmación directa de la fila específica que vio
el operador.

## 11. Comparación contra referencia — ProductDetailSheet (Cliente)

| CAPABILITY | T47_TARGET (ProductConfigurator) | BEST_EXISTING_REFERENCE (ProductDetailSheet) | REUSABLE_COMPONENT | GAP |
|---|---|---|---|---|
| Obligatorio/opcional | sufijo de texto `" *"` en el título | `<Badge>Obligatorio</Badge>` | Badge ya existe en el design system | ProductConfigurator no usa Badge para esto |
| Máximo/contador | texto plano `"Hasta N"` | badge numérico vivo `{n}/{maximo}` que cambia de color al llegar al tope | patrón replicable, no un componente aislado | falta el contador vivo |
| Selección activa | sólo color/borde (`ChoiceButton` ámbar) | checkbox cuadrado con check SVG (agregados) / círculo relleno (single-select) | iconografía ya usada en Cliente | ProductConfigurator depende 100% de color |
| Extras con precio | `+{formatPrice}` al lado del nombre | igual formato `+{formatPrice}` | ya consistente | sin gap |
| Quitar ingredientes | `ChoiceButton` con texto `"Sin {nombre}"`, mismo estilo que "agregar" | pastilla redonda que se tacha (`line-through`) y se pone roja al quitar — visualmente opuesta a "agregar" | patrón replicable | ProductConfigurator no diferencia visualmente agregar vs quitar |
| Cantidad | `QuantityStepper` compartido, trash reemplaza minus en 1 | +/- circulares, sin trash nunca | — | inconsistente entre ambos, no es necesariamente un bug — ver §16 |
| Total + CTA | precio aparte del botón, CTA fijo "Agregar al pedido" | precio integrado en el texto del botón (`"Agregar · $X"`) | patrón replicable | decisión de diseño, no bug |
| Mobile safe-area | el bottom bar de la CTA no tiene `env(safe-area-inset-bottom)` | (no auditado en detalle, misma pantalla completa `fixed inset-0`) | patrón ya usado en T49 (chat) | riesgo real en iOS con home indicator |
| Accesibilidad | `<button>` nativo, CERO `aria-*`/`role` en toda la pantalla | tampoco usa `aria-pressed` explícito (no confirmado) | — | ninguno de los dos declara `aria-pressed` en sus toggles |

## 12. Reglas funcionales — preservar (auditadas, no a cambiar)

```text
PRODUCT_RULES_CHANGE_REQUIRED=NO
```

Auditado en `ProductConfigurator`: obligatorio se exige en `canAdd`
(líneas ~707-722, no reproducido íntegro acá por brevedad — confirma
que exige selección en cada sección/grupo `obligatorio` antes de
habilitar "Agregar al pedido"); `maximo` se hace cumplir en el setter
`toggleShared`/`setSectionValue` (no en el render); extras pagos suman
al total unitario (`unitTotal`); quitar ingrediente nunca cobra (no
tiene campo de precio en `Ingrediente`); cantidad multiplica el total.
Ninguna de estas reglas se toca en el diseño de R1 — R1 es
exclusivamente presentación/UX, salvo el fix puntual de agrupamiento
(§10), que tampoco es una regla de producto sino de agrupamiento visual.

## 13. UX objetivo — jerarquía consistente

Diseño para R1 (no implementado):

- **Obligatorio**: usar `<Badge variant="secondary">Obligatorio</Badge>`
  junto al título del grupo, reemplazando el sufijo `" *"` — reutiliza
  el componente `Badge` ya presente en el design system y ya validado
  visualmente en `ProductDetailSheet`.
- **Límite ("Hasta N")**: agregar un contador vivo `{seleccionados}/{N}`
  que pase a un color de acento cuando se alcanza el máximo — mismo
  patrón que `ProductDetailSheet`, sin inventar copy nuevo (`"Elegí
  hasta N"` NO se impone porque no hay autoridad de copy previa en el
  repo que lo use — se prefiere el patrón numérico ya validado).
- **Extras pagos**: mantener `+{formatPrice(precio)}` (ya consistente
  entre ambos componentes) — no cambiar el formato.
- **Quitar ingrediente**: cambiar el estilo de `ChoiceButton` para este
  caso específico a un tratamiento visualmente opuesto a "agregar"
  (borde/fondo rojo + `line-through` cuando está activo, replicando la
  pastilla de `ProductDetailSheet`) — nunca el mismo componente visual
  sin distinción.

## 14. Selección activa

```text
CURRENT_SELECTION_FEEDBACK=únicamente color/borde (ámbar cuando
  `active`, gris cuando no) en `ChoiceButton` — sin ícono, sin
  `aria-pressed`, sin cambio de peso tipográfico
RECOMMENDED_SELECTION_FEEDBACK=agregar un ícono de check (reutilizando
  el patrón ya visto en `ProductDetailSheet` — check cuadrado para
  multi-selección, punto relleno para selección única) ADEMÁS del color
  existente (no en su reemplazo) + `aria-pressed={active}` en el
  `<button>` de `ChoiceButton` para que el estado sea perceptible sin
  depender sólo de color (WCAG 1.4.1) y sea anunciado por lectores de
  pantalla
```

## 15. Extras con precio

```text
CURRENT_EXTRA_PRICE_FORMATS=+{formatPrice(precio)} — ya consistente
  entre `ProductConfigurator` y `ProductDetailSheet` (ambos usan
  `formatOptionalPriceDelta`/inline `+{formatPrice(...)}`, formato
  final "+$500,00" vía Intl.NumberFormat es-AR)
RECOMMENDED_EXTRA_PRICE_FORMAT=sin cambios — ya es la convención
  correcta y reutiliza `formatPrice` existente en `src/lib/utils.ts`
```

## 16. Quitar ingredientes

Actualmente `ProductConfigurator` usa el MISMO componente (`ChoiceButton`)
y el MISMO tratamiento visual para "agregar un extra" y "quitar un
ingrediente" — la única diferencia es el texto ("Sin {nombre}" vs el
nombre solo). Semánticamente son opuestos (agregar vs remover) y deben
distinguirse. Diseño: mantener `ChoiceButton` como base (no crear un
componente nuevo — sólo una superficie real lo necesita) pero con una
variante visual (borde/fondo rojo + tachado cuando `active=true`,
replicando `ProductDetailSheet`) exclusiva para el grupo "Quitar
ingredientes". No se cambia la persistencia estructurada existente
(`removedIngredientes` → `ingredientesQuitados`).

## 17. Cantidad del producto

Auditado (`QuantityStepper`, `page.tsx:1025-1045`):

- El ícono cambia a `Trash2` cuando `value <= 1` (línea 1037).
- Dentro del configurador (producto aún no agregado), decrementar está
  clampeado a mínimo 1 (`Math.max(1, current - 1)`, línea 937) — el
  ícono de trash se muestra mas NO borra nada ahí (visualmente
  engañoso: el ícono promete una acción que el clamp no permite).
- En una línea YA agregada al pedido (`CartLine`), decrementar a 0 SÍ
  elimina la línea completa (`updateQuantity`, no reproducido acá).
- Cantidad nunca puede ser 0 dentro del configurador; sí puede
  "desaparecer" (quantity 0 = remove) una vez en el carrito.

No se modifica este comportamiento en A0. Diseño futuro: o bien ocultar
el ícono trash mientras `quantity===1` DENTRO del configurador (ya que
ahí no borra nada), reservándolo exclusivamente para `CartLine` donde sí
es una acción real — evita la promesa visual incumplida detectada arriba.

## 18. Total + CTA

Auditado: total unitario (`unitTotal * quantity`) se muestra en un
`<p>` separado del botón, dentro de un bottom bar `shrink-0` (no
sticky vía CSS `position: sticky`, pero SÍ fijo por estar dentro de un
contenedor `fixed inset-0 flex h-full flex-col` con el bottom bar como
último hijo `shrink-0` — efectivamente siempre visible, ya no requiere
scroll para verse). CTA `"Agregar al pedido"`, texto fijo, sin precio
integrado. `ProductDetailSheet` en cambio integra el precio en el
propio texto del botón (`"Agregar · $X"`). Ninguno de los dos hace
scroll-doble ni tiene el problema histórico de T49 (el layout
`min-h-0 flex-1 overflow-y-auto` ya está correctamente aplicado acá).

```text
MOBILE_PERSONALIZER_CURRENT_RISKS=
  1. Bottom bar del configurador (`page.tsx:933`) SIN
     `env(safe-area-inset-bottom)` — riesgo real en iPhones con home
     indicator (mismo tipo de gap que T49 corrigió en el chat de
     Terminal). Grep confirma 0 usos de "safe-area"/"env(safe" en todo
     el archivo.
  2. Touch targets pequeños: `ChoiceButton` usa `min-h-9` (36px) y los
     botones +/- de `QuantityStepper` son `h-8 w-8` (32px) — ambos por
     debajo de los ~44px recomendados para touch mobile.
  3. `OptionGroup` usa `flex flex-wrap gap-2` para las opciones — con
     muchas opciones cortas esto puede generar wrapping irregular en
     viewport angosto (no confirmado como bug real, sólo riesgo).
  4. Sin instrucción textual para el grupo "Quitar ingredientes" (a
     diferencia de `ProductDetailSheet`'s "Tocá para quitar los que no
     quieras") — en mobile, sin esa pista, el propósito del toggle
     puede no ser obvio al primer vistazo.
```

## 19. Accesibilidad (alcance acotado — no WCAG completo)

```text
- button semantics: OK — todos son `<button type="button">` nativos,
  focoeables y activables por teclado por defecto.
- aria: AUSENTE — 0 coincidencias de `aria-`/`role=`/`tabIndex` en todo
  `page.tsx` salvo un `aria-label` no relacionado en un `<Link>` de
  navegación. Ningún toggle declara `aria-pressed`; ningún grupo
  obligatorio declara `aria-required`.
- focus: heredado del navegador (sin `:focus-visible` custom ni trampas
  de foco problemáticas detectadas — tampoco se auditó en profundidad,
  fuera del alcance mínimo pedido).
- keyboard: funcional por ser `<button>` nativo (Tab/Enter/Space ya
  funcionan sin código adicional).
- touch targets: por debajo de 44px en `ChoiceButton`/`QuantityStepper`
  (ver §18).
- selected state: sólo color (ver §14) — el gap de accesibilidad más
  concreto de esta auditoría.
```

R1 no debe introducir una regresión de accesibilidad — como mínimo,
agregar `aria-pressed` a `ChoiceButton` es de costo casi nulo y cierra
el gap más señalado.

## 20. Separación datos/UI — conclusión explícita

Ver §9-10. Resumen:

```text
DUPLICATE_VISIBLE_SECTION_IS_DATA_PROBLEM=SI
DUPLICATE_VISIBLE_SECTION_IS_RENDER_PROBLEM=SI
DUPLICATE_VISIBLE_SECTION_IS_NAMING_PROBLEM=NO
```

## 21. API / Backend

```text
BACKEND_CHANGE_REQUIRED=NO
API_CHANGE_REQUIRED=NO
SCHEMA_CHANGE_REQUIRED=NO
MIGRATION_REQUIRED=NO
```

Todo el trabajo de R1 identificado (rediseño visual de
`ProductConfigurator` + normalización de agrupamiento en
`ProductDetailSheet`) es 100% frontend — ningún endpoint necesita
cambiar de forma, ningún campo nuevo, ninguna migración. La causa raíz
de datos (§9) se documenta pero no se corrige vía backend en esta
tarea (ver disposición en §10).

## 22. Plan de implementación R1 (diseño, NO ejecutado)

| PATH | CHANGE | WHY | RISK |
|---|---|---|---|
| `src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx` | PRODUCT — rediseño visual de `OptionGroup`/`ChoiceButton`/`QuantityStepper`: Badge "Obligatorio" en vez de sufijo `" *"`, contador vivo N/max, variante visual roja/tachada para "Quitar ingredientes", `aria-pressed` en `ChoiceButton`, `env(safe-area-inset-bottom)` en el bottom bar, aumentar touch targets a ~44px | Único archivo real del target primario de T47 (compartido con Operaciones vía re-export) | Medio — es el flujo real de creación de pedidos de Mozo/Operaciones, requiere cuidado de no romper `canAdd`/persistencia; mitigado por no tocar ninguna regla de producto, sólo presentación |
| `src/app/n/[slug]/page.tsx` | PRODUCT — normalizar `agregadosByCategory`/`ingredientesByCategory` a agrupar por `cat.trim().toLowerCase()` conservando el primer texto-tal-cual visto como label mostrado | Resuelve el síntoma "Aderezos/aderezos" visible sin tocar datos | Bajo — cambio puro de agrupamiento visual, no toca selección/precio/persistencia del pedido |
| `codex-reports/P2_T47_R1_...md` | DOC | Cierre de la ronda de implementación | Ninguno |

No se toca ningún archivo de `src/components/business/agregados-section.tsx`/
`ingredientes-section.tsx` en R1 (el fix de dedup case-insensitive en el
catálogo de Negocio queda como hallazgo separado, §10/§18 más abajo —
fuera del título "Operations Product Personalization UX").

```text
R1_PRODUCT_FILES_PLANNED=
  src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx
  src/app/n/[slug]/page.tsx
R1_TEST_FILES_PLANNED=
  posible extracción de un helper puro `groupByCategoryCaseInsensitive`
  desde n/[slug]/page.tsx (o test de contrato estático sobre el
  bloque, si extraerlo no se justifica por tamaño) + test focal/
  contrato estático nuevo o extendido para page.tsx de mozo/pedido
  (Badge/aria-pressed/safe-area presentes en el source)
```

## 23. Plan de tests (diseño, NO creado en A0)

```text
A. grupo obligatorio renderiza Badge "Obligatorio" (contrato estático o
   snapshot mínimo)
B. grupo opcional NO renderiza el Badge
C. contador N/max se actualiza y no excede el máximo declarado
D. extra pago muestra "+{formatPrice}" correctamente
E. "Quitar ingrediente" usa la variante visual roja/tachada, nunca la
   misma clase que "agregar"
F. selección activa expone `aria-pressed="true"` además del color
G. cantidad +/- se comporta igual que antes de R1 (sin regresión de
   `Math.max(1, ...)` dentro del configurador; sin regresión de
   remove-at-0 en `CartLine`)
H. total se mantiene correcto tras cualquier combinación de selección
I. CTA mantiene `disabled={!canAdd}` con las mismas reglas de
   obligatoriedad que hoy
J. caso "Aderezos/aderezos": dos categorías que difieren sólo en case
   se agrupan en UNA sola sección visible en `ProductDetailSheet`,
   usando el primer texto visto como label
K. mobile: bottom bar incluye `env(safe-area-inset-bottom)`; touch
   targets ≥ 44px (o el valor final que R1 adopte, documentado)
L. regresión en cada actor que consume el componente compartido: Mozo Y
   Operaciones (mismo archivo, mismo test cubre ambos por ser literal
   re-export)
```

No se implementa ningún test en A0.

## 24. Certificación física futura (preparar, NO ejecutar)

```text
R2_CASE_A_READY=SI — producto simple sin personalización
R2_CASE_B_READY=SI — producto con una elección obligatoria
R2_CASE_C_READY=SI — producto con varias opciones y máximo N
R2_CASE_D_READY=SI — extras pagos
R2_CASE_E_READY=SI — quitar ingredientes
R2_CASE_F_READY=CONDICIONAL — requiere un producto real del negocio de
  prueba que hoy tenga dos categorías "Aderezos"/"aderezos" (o crearlas
  manualmente vía el catálogo del Negocio, sin fabricar datos vía DB
  directa) para verificar el fix de agrupamiento en `ProductDetailSheet`
R2_CASE_G_READY=SI — cantidad +/-
R2_CASE_H_READY=SI — total y CTA
R2_CASE_I_READY=SI — mobile
R2_CASE_J_READY=SI — Mozo y Operaciones comparten el mismo archivo
  (re-export literal), así que un solo caso de regresión cubre ambos
  actores; no aplica a Terminal Salón (sin personalizador) ni a Cliente
  (componente distinto, cubierto por Case F)
```

## 25. No mezclar

Confirmado por diseño: T47 no toca `EstadisticasSubTab`/`salon/stats`
(T50), no es un rediseño del home de Operaciones (T51), no toca
manifest/branding/PWA identity (T52), no toca la futura tarea de
filtros de Historial (T55), no toca Push (T44) ni el worktree T39.

## 26. Salida de esta ronda — reconciliación de estados en ROADMAP

```text
P2-T50: CLOSED_TESTING_CERTIFIED, fuera del backlog activo (ya lo
  estaba antes de esta tarea, confirmado)
P2-T47: READY_FUTURE -> AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
P2-T55 (Salon History Custom Date Filtering): READY_FUTURE, registrada,
  NO iniciada
P2-T49: CLOSED_TESTING_CERTIFIED (sin tocar)
P2-T44: PAUSED_UNRESOLVED_AFTER_TIMEBOX (sin tocar)
```

## 27. Cierre

```text
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
PRODUCTION_TOUCHED=NO
T39_TOUCHED=NO
```

`P2_T47_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION` —
arquitectura concreta, causa raíz de "Aderezos/aderezos" identificada
con evidencia de código exacta (schema + UI de catálogo + agrupamiento
de render), plan de R1 por archivo, sin blockers identificados.
`NEXT_ACTION=P2_T47_R1_IMPLEMENTATION_AFTER_REVIEW`.
