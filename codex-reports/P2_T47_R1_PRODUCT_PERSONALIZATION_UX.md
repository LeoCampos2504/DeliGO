# P2-T47-R1 — Product Personalization UX + Category Normalization Hardening

Fecha: 2026-09-20
Alcance: IMPLEMENTACIÓN + TESTS + QUALITY GATE + COMMIT + PUSH +
TESTING DEPLOY. Sin Production, sin certificación física, sin backfill
de DB, sin schema, sin migración.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=da2dc8a380bfaa762e4b39359e7e84cbcbda3610
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md —
  ninguno ajeno, ninguno de código)
ORIGIN_TESTING_SHA=da2dc8a380bfaa762e4b39359e7e84cbcbda3610
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Worktree T39 confirmado intacto, no tocado.

## 2. Resumen de lo implementado

Tres targets, exactamente como los diseñó A0:

**A. ProductConfigurator** (`src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx`,
compartido verbatim con `/operaciones/mi-panel/[slug]/pedido/[mesaId]`
vía re-export literal — una sola corrección modifica ambos actores):
Badge "Obligatorio" reemplaza el sufijo `" *"`; contador vivo
`seleccionados/máximo` reemplaza el texto plano "Hasta N"; `ChoiceButton`
gana un ícono de check cuando está activo (además del color existente)
y `aria-pressed={active}`; nueva variante `variant="remove"` con
tratamiento rojo/tachado exclusivo para "Quitar ingredientes"; el
`QuantityStepper` del configurador ya no muestra una papelera que
prometía borrar algo que `Math.max(1, ...)` impedía — el botón de
decrecer queda deshabilitado en el mínimo salvo que se pase
`allowRemoveAtMin` (que `CartLine` sí pasa, preservando su
comportamiento real de "bajar a 0 elimina la línea"); bottom bar del
configurador gana `env(safe-area-inset-bottom)`; `ChoiceButton`
(36px→44px) y los botones del `QuantityStepper` (32px→44px) se
agrandaron para touch targets.

**B. ProductDetailSheet** (`src/app/n/[slug]/page.tsx`): el agrupamiento
de `agregadosByCategory`/`ingredientesByCategory` migró de un `Map`
case-sensitive a `groupByNormalizedCategory` (nuevo helper compartido) —
"Aderezos"/"aderezos"/" ADEREZOS " ahora colapsan en una sola sección
visible, conservando el primer label no vacío visto (trimmed) y sin
perder ningún item de ninguna de las variantes.

**C. Catálogo de Negocio** (`agregados-section.tsx`/
`ingredientes-section.tsx`): los 5 puntos de creación/renombrado de
categoría identificados en A0 (3 en Agregados, 2 en Ingredientes) ahora
usan `findEquivalentCategory` (mismo helper compartido) en vez de
`Array.includes` case-sensitive — un negocio ya no puede crear
"aderezos" si "Aderezos" existe (se reutiliza/avisa según el flujo
existente), pero SIGUE pudiendo recapitalizar su propia categoría única
(la comparación de renombrado excluye la entrada que se está editando).

**Autoridad compartida nueva**: `src/lib/category-normalization.ts` —
`normalizeCategoryKey`, `findEquivalentCategory`,
`groupByNormalizedCategory`. Usada por los tres archivos de arriba, sin
arquitectura nueva, sin dependencias circulares (los tres son
componentes cliente, el helper es una función pura sin imports).

## 3. Obligatorio / Opcional — detalle

```text
REQUIRED_BADGE_IMPLEMENTED=SI
```

`OptionGroup` ahora acepta `obligatorio?: boolean` y renderiza
`<Badge variant="secondary">Obligatorio</Badge>` sólo cuando es `true`.
Los grupos de secciones propias y de opciones compartidas pasan
`obligatorio={section.obligatorio}`/`obligatorio={group.obligatorio}` en
vez del sufijo `" *"` en el título. "Agregados" y "Quitar ingredientes"
nunca pasan `obligatorio` (siempre son opcionales — sin cambio de
regla). `canAdd` no se tocó: sigue leyendo `section.obligatorio`/
`option.obligatorio` directamente del producto, nunca del Badge.

## 4. Límites de selección — detalle

```text
SELECTION_COUNTER_IMPLEMENTED=SI
```

`description={section.maximo > 1 ? \`${selectedCount}/${section.maximo}\` : undefined}`
y el equivalente para `opcionesCompartidas`. `selectedCount` se calcula
con el MISMO criterio que ya usan `canAdd`/`toggleShared`
(`Object.values(selection).reduce(...)` para secciones,
`Object.keys(selectedShared).filter(startsWith(group.id::)).length`
para compartidas) — no se reimplementó ninguna regla, sólo se refleja
visualmente el estado que el estado de React ya mantiene. El límite
superior sigue enforced exactamente donde ya estaba (`toggleShared`,
`setSectionValue`), sin cambios.

## 5. Selección activa — detalle

```text
ARIA_PRESSED_IMPLEMENTED=SI
```

`ChoiceButton` ahora declara `aria-pressed={active}` y renderiza
`{active && <Check className="h-3.5 w-3.5 shrink-0" />}` antes de sus
children, sin quitar el tratamiento de color/borde existente (se suma,
no reemplaza). Aplica uniformemente a selección única y múltiple — se
prefirió un único ícono de check consistente en vez de forkear el
componente en variantes "single"/"multi" (ninguna de las dos formas es
hoy visualmente un radio/checkbox nativo; introducir esa distinción
sería un rediseño mayor, fuera del alcance de "mejorar claridad visual
sin cambiar reglas del producto").

## 6. Extras con precio — sin cambios

```text
PRICE_CALCULATION_CHANGED=NO
```

`+{formatPrice(precio)}` y `formatOptionalPriceDelta(opt.precio,
formatPrice)` se preservaron literalmente — confirmado por test estático
(§10).

## 7. Quitar ingredientes — detalle

```text
REMOVED_INGREDIENT_VISUAL_VARIANT_IMPLEMENTED=SI
```

`ChoiceButton` gana `variant?: "default" | "remove"`. El grupo "Quitar
ingredientes" pasa `variant="remove"`: activo se ve
`border-red-300 bg-red-50 text-red-600 line-through` (mismo lenguaje
visual ya validado en `ProductDetailSheet`), inactivo se ve igual que
cualquier `ChoiceButton` disponible. El texto `"Sin {nombre}"` y el
estado `removedIngredientes` no cambiaron.

## 8. QuantityStepper — papelera falsa corregida

```text
CONFIGURATOR_FAKE_TRASH_REMOVED=SI
CARTLINE_REAL_REMOVE_PRESERVED=SI
```

Nuevo prop `allowRemoveAtMin` (default `false`). Dentro del
configurador (`quantity`/`setQuantity`, clamp `Math.max(1, ...)`) el
stepper NO pasa `allowRemoveAtMin` → en el mínimo, el botón de decrecer
queda `disabled` mostrando `Minus` (nunca una papelera inactiva). En
`CartLine` (`item.cantidad`, `onQuantityChange`) el stepper SÍ pasa
`allowRemoveAtMin` → conserva exactamente el comportamiento anterior:
`Trash2` visible y activo en cantidad 1, y al presionar
`onQuantityChange(item.key, item.cantidad - 1)` con `cantidad=1` baja a
0, lo cual elimina la línea (sin cambios en `onQuantityChange`/
`updateQuantity`). El botón de papelera dedicado por línea (borrado
directo, independiente de la cantidad) tampoco se tocó.

## 9. Touch targets + Safe area

```text
TOUCH_TARGETS_HARDENED=SI
SAFE_AREA_IMPLEMENTED=SI
```

`ChoiceButton`: `min-h-9` (36px) → `min-h-11` (44px). Botones del
`QuantityStepper`: `h-8 w-8` (32px) → `h-11 w-11` (44px), en AMBOS usos
(configurador y `CartLine`) — sin romper el layout desktop (son
controles pequeños dentro de filas flex, el aumento de 8px no fuerza
wrapping nuevo en ningún contenedor). Bottom bar del configurador:
`p-4` → `px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]`,
mismo patrón Tailwind arbitrario ya validado en T49 para el composer de
chat de Terminal. `min-h-0`/`overflow-y-auto`/bottom bar `shrink-0` del
shell no se tocaron.

## 10. Total + CTA — sin cambios

```text
TOTAL_LOGIC_CHANGED=NO
CTA_VALIDATION_CHANGED=NO
```

`{formatPrice(unitTotal * quantity)}` y `disabled={!canAdd}` se
preservaron literalmente — confirmado por test estático.

## 11. Category grouping (ProductDetailSheet) — detalle

```text
CATEGORY_GROUPING_CASE_INSENSITIVE=SI
CATEGORY_FIRST_LABEL_PRESERVED=SI
CATEGORY_ITEMS_PRESERVED=SI
```

`groupByNormalizedCategory(items, getCategoria, fallbackLabel)`: agrupa
por `normalizeCategoryKey` (`value.trim().toLocaleLowerCase()`),
preserva el PRIMER label no vacío (trimmed) visto para cada grupo como
texto visible, y nunca descarta items — todos los tests A-F del §21 del
task spec están cubiertos exhaustivamente en
`src/lib/category-normalization.test.ts` (16/16 pass) con datos
puramente sintéticos (sin DB real). `ProductDetailSheet` migró su
`useMemo` de un `Map` propio a este helper sin cambiar ninguna otra
lógica (selección, precio, remoción, CTA, Vista previa) — confirmado
por `category-grouping-static-contract.test.ts` (9/9 pass).

## 12. Catálogo de Negocio — prevención de nuevos duplicados

```text
BUSINESS_CATEGORY_CREATION_CASE_INSENSITIVE_GUARD=SI
AGREGADOS_DUPLICATE_CATEGORY_PREVENTED=SI
INGREDIENTES_DUPLICATE_CATEGORY_PREVENTED=SI
```

`findEquivalentCategory(categories, candidate)` reemplaza
`Array.includes` en los 5 puntos identificados (3 en
`agregados-section.tsx`: renombrar, agregar desde la barra de pills,
agregar inline en el formulario; 2 en `ingredientes-section.tsx`:
renombrar, agregar desde la barra de pills — este archivo no tiene una
variante "agregar inline en el formulario"). En el flujo de renombrado,
la comparación EXCLUYE la propia categoría que se está editando, para
no bloquear el caso legítimo de corregir la propia capitalización
(`"Aderezos"` → `"ADEREZOS"` de la MISMA categoría sigue permitido). En
el flujo "agregar inline en el formulario", si se encuentra una
categoría equivalente existente, se reutiliza esa grafía EXACTA
(`existing`, nunca el texto recién tipeado) — evita crear una nueva
variante de casing en el propio agregado/ingrediente que se está
guardando.

## 13. No backfill

```text
DB_MUTATED=NO
```

Ninguna categoría existente fue renombrada, fusionada ni tocada en
Postgres. `groupedAgregados`/filtrado por categoría dentro del propio
panel de administración de Negocio (vista de EDICIÓN, distinta de
`ProductDetailSheet`) se dejó sin tocar deliberadamente — un dueño de
negocio administrando su catálogo se beneficia de ver la inconsistencia
real tal cual está en sus propios datos, para poder corregirla
manualmente; sólo la vista de CLIENTE (`ProductDetailSheet`) debe
ocultar el ruido de datos. Si el operador confirma filas duplicadas
reales que ameriten limpieza, es una tarea/acción explícita separada,
no ejecutada acá.

## 14. Normalización compartida — decisión de arquitectura

```text
NORMALIZATION_HELPER_PATH=src/lib/category-normalization.ts
NORMALIZATION_HELPER_SHARED_BY=
  src/app/n/[slug]/page.tsx (groupByNormalizedCategory)
  src/components/business/agregados-section.tsx (findEquivalentCategory, 3 sitios)
  src/components/business/ingredientes-section.tsx (findEquivalentCategory, 2 sitios)
```

Una sola autoridad pequeña y pura (60 líneas, sin dependencias), usada
por los 3 consumidores sin duplicación ni fork — los tres son
componentes cliente (`"use client"`), así que no hay riesgo de frontera
server/client ni de bundle. No se creó ninguna arquitectura nueva
(sin clase, sin contexto, sin hook) — sólo funciones puras.

## 15. Reglas funcionales — confirmadas sin cambios

```text
PRODUCT_RULES_CHANGED=NO
ORDER_PAYLOAD_CHANGED=NO
PRICE_CALCULATION_CHANGED=NO
```

`canAdd` (sectionsOk/sharedOk), `setSectionValue`, `toggleShared`,
`toggleAgregado`, `unitTotal`, el payload de `secciones`/`agregados`/
`ingredientesQuitados` enviado al crear el pedido — todos verificados
sin cambios por lectura directa y por test estático dedicado.

## 16. API / Backend

```text
BACKEND_CHANGED=NO
API_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_BACKFILL_REQUIRED=NO
```

No surgió ninguna necesidad de backend durante la implementación — todo
el trabajo fue frontend puro, tal como diseñó A0.

## 17. Tests

```text
FOCAL_TESTS=65 pass / 0 fail
  16 — src/lib/category-normalization.test.ts (helper puro:
       normalizeCategoryKey, groupByNormalizedCategory casos A-F,
       findEquivalentCategory casos A-C + edge cases)
  29 — src/app/mozo/panel/[slug]/pedido/[mesaId]/page.test.ts (contrato
       estático nuevo: Badge, contador N/max, aria-pressed+check,
       variant=remove, precio sin cambios, fake-trash removido,
       CartLine preservado, safe-area, touch targets 44px, canAdd/total
       sin cambios, re-export de Operaciones intacto)
  9  — src/app/n/[slug]/category-grouping-static-contract.test.ts
       (ProductDetailSheet usa el helper compartido, sin Map propio;
       selección/precio/remoción/Vista previa sin cambios)
  11 — src/components/business/category-duplicate-prevention-static-contract.test.ts
       (5 sitios de dedup en agregados/ingredientes usan
       findEquivalentCategory; recapitalizar la propia categoría sigue
       permitido; guardado de categoría genuinamente nueva sin cambios)

REGRESSION_TESTS=99 pass / 0 fail
  29 — src/app/n/[slug]/{business-preview,hero-safe-area,
       product-gallery-public-preview}-static-contract.test.ts
       (Vista previa/safe-area/galería de ProductDetailSheet, no
       relacionados con el fix de agrupamiento, confirmados intactos)
  3  — src/components/business/salon-tab-employee-identity-feedback.test.ts
       (contrato de identidad de empleados de Salón, archivo distinto,
       confirmado sin colateral)
  67 — src/components/business/catalog-tutorial/catalog-tutorial-r3-guide-static-contract.test.ts
       + src/hooks/use-unsaved-changes-guard.test.ts
       + src/lib/negocio-salon-static-contract.test.ts
       (suites que referencian agregados-section.tsx/
       ingredientes-section.tsx desde otros ángulos — tutorial guiado,
       guard de cambios sin guardar — confirmadas sin regresión)
```

No se ejecutaron las 20 fallas preexistentes documentadas en
`P2_T50_R1_...md`/`P2_T47_A0_...md` (dependen de una conexión Prisma/DB
real no disponible en este entorno de test) — no relacionadas con T47,
no reproducidas de nuevo en esta ronda por no ser pertinentes.

## 18. Quality gate

```text
TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS (sin salida en los 9 archivos tocados/nuevos)
BUILD=PASS (incluye /mozo/panel/[slug]/pedido/[mesaId],
  /operaciones/mi-panel/[slug]/pedido/[mesaId] y /n/[slug])
DIFF_CHECK=PASS
```

## 19. Diff review

```text
PRODUCT_FILES_CHANGED=
  src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx
  src/app/n/[slug]/page.tsx
  src/components/business/agregados-section.tsx
  src/components/business/ingredientes-section.tsx
  src/lib/category-normalization.ts (nuevo, helper compartido)
TEST_FILES_CHANGED=
  src/app/mozo/panel/[slug]/pedido/[mesaId]/page.test.ts (nuevo)
  src/app/n/[slug]/category-grouping-static-contract.test.ts (nuevo)
  src/components/business/category-duplicate-prevention-static-contract.test.ts (nuevo)
  src/lib/category-normalization.test.ts (nuevo)
```

Confirmado por `git status --short` filtrado: sin tocar
`prisma/**`, `src/app/api/**`, push, realtime, Service Worker, manifest,
branding — exactamente lo esperado por §27 del task spec.

## 20. Performance

Sin impacto — `groupByNormalizedCategory`/`findEquivalentCategory` son
O(n) sobre colecciones de personalización de un solo producto (decenas
de agregados/ingredientes/categorías como máximo), igual complejidad
que el `Map`/`Array.includes` que reemplazan.

## 21. Commit / Push / Deploy

```text
P2_T47_R1_COMMIT_SHA=8994bc304ef7ad5c057acf1deeb83fd9354ad051
PUSH_TARGET=origin/testing-codex
PUSH_STATUS=SUCCESS
TESTING_DEPLOY_ID=0677ae36-c49e-4d42-9001-b5f6282c18d0
TESTING_DEPLOY_SERVICE=DeliGO Copy
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=8994bc304ef7ad5c057acf1deeb83fd9354ad051
DEPLOY_COMMIT_MATCH=SI
```

Logs de arranque limpios: `33 migrations found`, `No pending migrations
to apply` (confirma cero cambio de schema), `Ready in 62ms`, sin
excepciones ni 500 en boot. Smoke manual: `GET /n/<slug-inexistente>`
→ `200` (la página del storefront responde; no se probó con un negocio/
producto real en esta ronda, eso queda para R2 físico). `origin/main`
reconfirmado sin cambios (`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`)
antes y después del deploy.

## 22. Estado final

```text
P2_T47_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2_PHYSICAL_CERTIFICATION
P2_T47_STATUS=IN_PROGRESS_AWAITING_R2_PHYSICAL_CERTIFICATION
P2_T50_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T55_STATUS_UNCHANGED=READY_FUTURE
P2_T49_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX
PRODUCTION_TOUCHED=NO
T39_TOUCHED=NO
```

NO se certificó físicamente esta ronda. NO se cierra T47. NO se inicia
T55. Pendiente: R2 (Cases A-K) — ver preparación en el reporte A0 y en
la salida final de esta ronda.
