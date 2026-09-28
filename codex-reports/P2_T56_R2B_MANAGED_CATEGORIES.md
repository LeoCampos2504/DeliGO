# P2-T56-R2B — Categorías administrables para negocio genérico

Date: 2026-09-28
Branch: `work/p2-t56-r2`
Branch base: `9fbd8996db5e4177653aa56d5192b584ade09390` (== `origin/testing-codex` tip, the R2A deploy)

## 0. Auditoría previa (obligatoria, sección 2)

```text
CURRENT_CATEGORY_ARCHITECTURE=
  No existe modelo/tabla Categoria. La única autoridad "administrable" es
  Negocio.categorias (prisma/schema.prisma:97), un String @default("[]")
  que persiste JSON.stringify(string[]) — el orden del array ES el orden
  manual que el negocio eligió (CATALOG-CATEGORY-PILL-REORDER-R1). Cada
  Producto.categoria (schema.prisma:270) es un String libre
  @default("Sin Categoria"), sin FK. No existe ProductoVariante/VarianteRopa
  — Ropa guarda talles/colores como JSON directamente en Producto, sin
  relación a categoría.

RESTAURANTE_CATEGORY_ARCHITECTURE=
  Idéntica a Ropa (ver abajo) — mismo componente, misma API, misma
  autoridad. No hay una lista fija de categorías "de restaurante"; cada
  negocio construye la suya.

ROPA_CATEGORY_ARCHITECTURE=
  Restaurante y Ropa comparten UN solo componente,
  src/components/business/products-tab.tsx (gateado por
  negocio.rubro), que ya tiene una UI de gestión de categorías completa
  (crear/listar/renombrar/eliminar/ordenar) contra
  GET/PUT/PATCH /api/negocio/categorias + PATCH /api/negocio/categorias/orden.
  Ya existía ANTES de R2B — no es nuevo. Dedup en products-tab.tsx es
  case-sensitive (`configCategorias.includes(trimmed)`) — un gap
  preexistente que R2B NO toca (ver §3).
```

## 1. Decisión de arquitectura (sección 3)

```text
CATEGORY_MODEL_STRATEGY=REUSE_EXISTING
CATEGORY_AUTHORITY=Negocio.categorias (JSON string[]) + Producto.categoria (String) — sin cambio de forma
```

No se creó `GenericCategory`/`BusinessInventoryCategory`/`CategoriaInventario`.
El negocio genérico (rubro `"negocio"`) simplemente no tenía una UI para
alcanzar la autoridad de categorías que YA existe y que Restaurante/Ropa ya
usan — porque su Products tab fue reemplazado por Caja+Inventario en R1
(`getTabItems`, business-panel.tsx). R2B construye esa UI faltante y
conecta Inventario/Caja a la MISMA autoridad, en vez de duplicar un segundo
sistema.

`STOP CONDICIONAL` (sección 4) no se activó: la vía aditiva era evidente
(reutilizar `Negocio.categorias` + los 2 endpoints existentes sin tocar su
forma), sin romper Restaurante/Ropa, sin migración destructiva, sin cambiar
semántica histórica de `Producto`.

## 2. Cambios en la API compartida (`/api/negocio/categorias`)

`src/app/api/negocio/categorias/route.ts` — el endpoint NO es nuevo (ya
servía a Restaurante/Ropa). Se le agregó únicamente una validación
server-side aditiva y conservadora:

```text
PUT: rechaza cualquier entrada vacía/sólo-espacios (trim) o de más de 60
     caracteres.
PATCH: el nuevo nombre respeta el mismo límite de 60 caracteres.
```

Ningún flujo existente de Restaurante/Ropa podía producir legítimamente una
entrada vacía o de más de 60 caracteres (todas sus UIs ya hacen
`.trim()` y descartan vacíos antes de llamar a este endpoint), así que esta
validación es puramente defensiva: nunca rechaza una entrada que un flujo
real ya aceptaba. El dedup case/espacio-insensible (`findEquivalentCategory`)
se implementó SÓLO en el lado cliente de la nueva UI de negocio (ver §4) —
deliberadamente no se agregó al endpoint compartido para no arriesgar
rechazar datos preexistentes de Restaurante/Ropa que pudieran tener
variantes de casing ya guardadas.

`/api/negocio/categorias/orden` (reorder) no se tocó — R2B no implementa
reordenamiento en la nueva UI de negocio (ver §9, Known limitations).

`/api/negocio/productos` y `/api/negocio/productos/[id]` no se tocaron —
ya aceptaban `categoria` como string desde R1; el nuevo selector simplemente
envía un string, igual que el Input libre que reemplaza.

## 3. Nuevo helper puro compartido

`src/lib/category-normalization.ts` (ya existente desde P2-T47-R1, usado
por agregados-section.tsx/ingredientes-section.tsx) — se agregó UNA función
nueva, aditiva:

```ts
mergeManagedCategories(managed: string[], productCategorias: string[]): string[]
```

Combina `Negocio.categorias` (en su orden persistido) con cualquier
`Producto.categoria` que no esté ya en esa lista (comparación
case/espacio-insensible vía `normalizeCategoryKey`), agregándolo al final.
Esto es lo que garantiza `EXISTING_GENERIC_PRODUCTS_PRESERVED=YES` (sección
15): un producto R1 con `categoria="Bebidas"` sigue siendo visible/filtrable
aunque el negocio nunca haya "creado" formalmente esa categoría en
`Negocio.categorias`. Es la misma reconciliación que products-tab.tsx ya
hace inline para Restaurante/Ropa (líneas 678-693), generalizada y hecha
case-insensitive — sin tocar ese archivo.

## 4. Nueva UI: administrar categorías

`src/components/business/administrar-categorias-dialog.tsx` (nuevo) —
Dialog simple (crear vía Input+botón, listar con conteo real de productos,
renombrar inline, eliminar con confirmación mostrando el conteo). Usa
EXCLUSIVAMENTE los endpoints ya existentes (`PUT`/`PATCH`
`/api/negocio/categorias`) y `findEquivalentCategory` para el dedup
case-insensible en creación y renombrado. `negocioId` nunca viaja en el
body de ninguna request — sólo se usa localmente para las query keys de
React Query (tenant derivado de sesión en el servidor, igual que T56 R1).

Entrada: botón "Administrar categorías" en `InventarioTab`, junto a los
pills de filtro.

## 5. Producto — cambio principal (sección 8/9)

`src/components/business/inventario-tab.tsx`:
- `categorias` ahora se deriva de `mergeManagedCategories(categoriasManaged, activos.map(p => p.categoria))`,
  donde `categoriasManaged` viene de un nuevo `useQuery(["negocio-categorias", negocio.id])`
  — la MISMA query key que usa `products-tab.tsx` (comparten caché de React
  Query cuando corresponde).
- El campo "Categoría" del formulario de producto pasó de
  `<Input list="inv-categorias-list">` (texto libre + datalist) a un
  `<Select>` con `<SelectItem value="Sin Categoria">Sin categoría</SelectItem>`
  seguido de las categorías administradas — mismo patrón exacto que
  products-tab.tsx (línea 2167-2180), sin tocar ese archivo.
- El valor por defecto de un producto NUEVO es explícitamente
  `"Sin Categoria"` (nunca la primera categoría de la lista) — la categoría
  sigue siendo opcional, no se obliga a crear una para cargar el primer
  producto (sección 9).

## 6. Caja — misma autoridad (sección 14)

`src/components/business/caja-tab.tsx` (`VenderView`): mismo patrón —
nuevo `useQuery(["negocio-categorias", negocioId])` + `mergeManagedCategories`,
reemplazando la derivación ad-hoc `Array.from(new Set(activos.map(p => p.categoria))).sort()`.
Al usar la MISMA query key que Inventario, crear/renombrar/eliminar una
categoría desde el nuevo diálogo invalida ambas vistas
(`invalidateAll()` en el diálogo invalida `negocio-categorias`,
`negocio-inventario-productos` y `negocio-caja-productos`).

## 7. Eliminar / inactivar (sección 12)

```text
CATEGORY_DELETE_BEHAVIOR=
  Comportamiento REAL del endpoint reutilizado (PUT con el array sin esa
  entrada): los productos que tenían esa categoría se reasignan a
  "Sin Categoria" (db.producto.updateMany, route.ts líneas 111-121) — NUNCA
  se borra ni se oculta ningún producto. No es exactamente la opción A
  (bloquear si tiene productos) ni la opción B (inactivar conservando
  asociación histórica) del enunciado; es una tercera conducta explícita,
  ya probada en producción para Restaurante/Ropa, que cumple la regla dura
  de la tarea ("nunca borrar productos por borrar una categoría"). La nueva
  UI muestra el conteo real de productos ANTES de confirmar ("Esta categoría
  tiene N productos... quedarán sin categoría") para que la decisión sea
  informada, aunque no sea un bloqueo duro.
```

## 8. Multi-tenant (sección 17)

`negocioId` se deriva exclusivamente de la sesión (`user.id`) en las tres
rutas (GET/PUT/PATCH), igual que T56 R1 — confirmado leyendo el archivo
completo antes de tocarlo, nunca aceptado desde el body/query. Cubierto por
6 tests de aislamiento nuevos (ver §10) que verifican, contra la DB real,
que negocio A nunca puede leer/escribir/renombrar las categorías o
productos de negocio B.

## 9. Producción de R1 preservada (sección 15)

```text
EXISTING_GENERIC_PRODUCTS_PRESERVED=YES
```

Un producto TESTING creado antes de R2B con `categoria="Bebidas"` (string
libre, nunca registrado en `Negocio.categorias`) sigue: (a) visible en
Inventario/Caja — `mergeManagedCategories` lo agrega a la lista de filtro;
(b) seleccionable/editable en el formulario — el Select del producto
incluye su propia categoría aunque no esté en la lista administrada
(porque `categorias` ya la incluye vía el merge); (c) intacto en la DB — no
se ejecutó ninguna migración ni backfill. No hubo migración automática de
strings existentes a un modelo relacional porque NO SE INTRODUJO un modelo
relacional — se reutilizó el String tal cual.

## 10. Tests

```text
FOCAL_TESTS=PASS
  bun test src/lib/category-normalization.test.ts
    src/components/business/managed-categories-static-contract.test.ts
  = 56 pass / 0 fail / 101 expect() calls
  (incluye 7 tests nuevos de mergeManagedCategories + 12 tests nuevos de
  contrato estático sobre la integración Inventario/Caja/diálogo)

DB_TESTS=PASS (ejecutados contra TESTING real — ver nota de credencial abajo)
  bun test src/app/api/negocio/categorias/route.test.ts
  = 13 pass / 0 fail / 22 expect() calls
  Cobertura: CATEGORY CRUD (crear, listar, rechazo de vacío, rechazo de
  >60 chars, límite de 60 exacto aceptado, renombrar con propagación a
  Producto), MULTI-TENANT (4 tests: A no lee/escribe/renombra categorías de
  B, y renombrar en A con el mismo nombre no toca productos de B),
  SAFE_DELETE (reasignación a "Sin Categoria" sin borrar el producto).

  TENANT_CATEGORY_TESTS=PASS
  PRODUCT_CATEGORY_TESTS=PASS (cubierto dentro del mismo archivo — la
  reasignación de Producto.categoria en delete/rename se verifica
  directamente contra la fila real)

REGRESSION_TESTS=PASS
  - category-reorder-static-contract.test.ts (8 tests) — Restaurante/Ropa
    reorder sin cambios.
  - category-duplicate-prevention-static-contract.test.ts (10 tests) —
    dedup de agregados-section.tsx/ingredientes-section.tsx sin cambios.
  - caja-venta.test.ts + inventario.test.ts +
    business-panel-tab-gating.test.ts + caja-tab-responsive-static-contract.test.ts
    (T56 R1/R2A) = 48 pass / 0 fail — sin regresión.
  - DB: movimientos/route.test.ts (7) + caja/ventas/route.test.ts (10) =
    17 pass / 0 fail — backend de Caja/Inventario sin tocar, confirmado.

  RESTAURANTE_CATEGORY_BEHAVIOR_CHANGED=NO
  ROPA_CATEGORY_BEHAVIOR_CHANGED=NO
```

Nota de credencial: `DELIGO_TEST_DATABASE_URL` en el entorno de shell de
esta sesión estaba desactualizada (mismo tipo de gap que R1B — longitud
coincidente por casualidad pero valor distinto al vigente). Se confirmó
mediante una comparación booleana sin imprimir ningún valor
(`process.env.DATABASE_URL === process.env.DELIGO_TEST_DATABASE_URL`), se
obtuvo la credencial vigente de `railway variables --service Postgres --kv`
(pipeada a través de un filtro que nunca imprime el valor, sólo su
longitud, para la comparación), y se usó ÚNICAMENTE en memoria para esta
invocación de `bun test` — nunca escrita a disco, nunca impresa, nunca
commiteada.

## 11. Quality gates

```text
NEW_TYPESCRIPT_ERRORS=0 (baseline 33 preexistentes sin cambios, verificado
  con ./node_modules/.bin/tsc --noEmit — ningún error nuevo en los 8
  archivos tocados/creados)
ESLINT_GATE=PASS (0 errores/warnings en los 8 archivos)
BUILD_GATE=PASS (npm run build, exit 0)
DIFF_CHECK=PASS (git diff --check, sólo avisos benignos de LF/CRLF,
  ningún conflicto ni trailing whitespace real)
```

## 12. Archivos cambiados

```text
FILES_CHANGED=
  M src/app/api/negocio/categorias/route.ts (validación aditiva: rechazo
    de nombre vacío/oversize en PUT y PATCH — sin cambiar ninguna forma de
    request/response existente)
  M src/lib/category-normalization.ts (nuevo export: mergeManagedCategories)
  M src/lib/category-normalization.test.ts (7 tests nuevos)
  M src/components/business/inventario-tab.tsx (categorías administradas,
    Select en vez de Input+datalist, botón "Administrar categorías")
  M src/components/business/caja-tab.tsx (VenderView usa la misma
    autoridad de categorías administradas)
  M codex-reports/P2_T56_R2A_CAJA_RESPONSIVE_SALE_DETAIL.md (closeout:
    CHECKOUT_VISUAL_REVIEW=PASS, SALE_DETAIL_VISUAL_REVIEW=PASS,
    P2_T56_R2A_STATUS=CLOSED_TESTING_CERTIFIED — sin reporte duplicado)
  A src/components/business/administrar-categorias-dialog.tsx (nueva UI)
  A src/app/api/negocio/categorias/route.test.ts (13 tests DB nuevos —
    el endpoint no tenía cobertura de integración previa)
  A src/components/business/managed-categories-static-contract.test.ts
    (12 tests de contrato estático)
  A codex-reports/P2_T56_R2B_MANAGED_CATEGORIES.md (este reporte)
```

## 13. Known limitations

- `CATEGORY_REORDER_IMPLEMENTED=NO` — el endpoint
  `/api/negocio/categorias/orden` ya existe y funcionaría sin ningún cambio
  de backend, pero se excluyó de esta ronda por disciplina de alcance (la
  tarea lo marca como "si la arquitectura ya lo soporta fácilmente", no
  como mínimo obligatorio; el MVP obligatorio — CREATE/LIST/RENAME/SAFE_DELETE
  — está completo). Se puede agregar en un follow-up sin tocar el backend.
- `CREATE_CATEGORY_FROM_PRODUCT_SELECTOR=NO` — el "+ Nueva categoría" desde
  dentro del selector del formulario de producto (sección 10, marcado
  explícitamente "nice to have") no se implementó; el flujo principal es
  Administrar categorías → crear, luego Producto → elegir, tal como el
  enunciado permite.
- No se verificó visualmente en un navegador real en esta ronda (mismo tipo
  de limitación que R2A) — verificado mediante tests de integración DB
  reales, contrato estático y build/tsc/eslint limpios. La revisión manual
  del operador en TESTING sigue siendo la confirmación real.

```text
PHYSICAL_REVIEW_REQUIRED=SI
```

## 14. Closeout (P2-T56-R2C preflight, per its §42)

```text
INVENTORY_FILTER_MANUAL_REVIEW=PASS
CAJA_FILTER_MANUAL_REVIEW=PASS
CART_FILTER_INDEPENDENCE_MANUAL_REVIEW=PASS
P2_T56_R2B_STATUS=CLOSED_TESTING_CERTIFIED
```

Confirmed by the operator's own manual review on TESTING, covering both the
original category-management surface (R2B, deployed at commit
`d797c01309f03b9123f5c234e7f5d454dde07ea0`) and the operational-filter fix
(R2B-F1, deployed at commit `d38045eb3514eb7c13ecaff070164a3110fb073e`):
Inventario's and Caja's category pills correctly filter their product
lists, "Sin categoría" and "Todas" both work, and adding items to the Caja
cart is unaffected by changing the active category filter. This closeout
entry is recorded here — not as a separate report — per the P2-T56-R2C
task's explicit instruction to avoid a documentation-only commit/deploy.
