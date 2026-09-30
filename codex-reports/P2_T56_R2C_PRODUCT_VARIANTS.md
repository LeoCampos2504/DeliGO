# P2-T56-R2C — Variantes de productos para negocio genérico

Date: 2026-09-28
Branch: `work/p2-t56-r2`
Branch base: `d38045eb3514eb7c13ecaff070164a3110fb073e` (== `origin/testing-codex` tip, the R2B-F1 deploy)

## 0. Auditoría previa (sección 2)

```text
CURRENT_VARIANT_ARCHITECTURE=
  No existía ningún modelo de variante real. `grep` de "Variante|Variant|Opcion"
  en schema.prisma sólo encontraba OpcionesCompartidas (grupo de opciones
  de Restaurante, JSON string[], sin precio/stock por opción) y
  ProductoAgregado/ProductoIngrediente (add-ons con precio propio pero SIN
  stock — conceptualmente distinto de una variante).

ROPA_VARIANT_ARCHITECTURE=
  Ropa guarda talles/colores como columnas planas en Producto:
  talles String @default("[]") / colores String @default("[]") (JSON
  array de strings), editadas en products-tab.tsx como una simple lista de
  chips. NINGÚN talle/color tiene precio propio, costo propio, stock propio,
  SKU ni código de barras — son sólo texto descriptivo. Confirmado leyendo
  el modelo completo y el editor de chips antes de decidir arquitectura,
  tal como exige la sección 2/3: forzar ese sistema para representar
  "500 ml → $2.000 → stock 6 / 1,5 L → $3.200 → stock 10" habría sido
  incorrecto — Ropa no fue tocado.
```

## 1. Decisión de arquitectura (sección 3/4)

```text
VARIANT_MODEL_STRATEGY=NEW_PRODUCT_VARIANT_MODEL_REQUIRED
```

No existía ninguna entidad reutilizable con precio+costo+stock propios.
`STOP CONDICIONAL` (sección 4) no se activó: la vía aditiva era clara y de
bajo riesgo —

- nueva tabla `ProductoVariante` (FK a Producto, `onDelete: Cascade`);
- columna nullable `productoVarianteId` en `VentaItem` y en
  `MovimientoInventario`;
- columna nullable `varianteNombre` (snapshot) en `VentaItem`;

sin alterar ninguna columna/tabla existente, sin DROP, sin migración de
datos, sin tocar Ropa/Restaurante/Pedidos/Salón/categorías (R2B). Producto
sigue siendo la entidad principal (sección 5): NO se crean N productos
ocultos por variante — una sola fila `Producto` ("Coca Cola") con N filas
`ProductoVariante` hijas.

## 2. Producto sin variantes — comportamiento (sección 6)

```text
BASE_PRODUCT_WITHOUT_VARIANTS_BEHAVIOR=PRESERVED
```

Un producto con `variantes.length === 0` usa exactamente su propio
`precio`/`costo`/`controlStock`/`stockCantidad`/`stockMinimo` — cero cambio
de comportamiento respecto de R1/R2A/R2B. No se obliga a crear una variante
"Default": esta es la rama de código INALTERADA en cada archivo tocado
(`if (p.variantes.length === 0) { ... }` en Caja, `if (!hasVariantes)` en
Inventario), verificada explícitamente por regresión (ver §10).

## 3. Stock por variante (sección 8/9)

```text
VARIANT_STOCK_AUTHORITY=ProductoVariante.stockCantidad/controlStock/stockMinimo
```

En cuanto un Producto tiene >=1 variante (activa o inactiva), sus propias
`stockCantidad`/`controlStock` quedan DORMIDAS para venta/ajuste — nunca se
leen ni se escriben por ese camino (confirmado en el código de
`/api/negocio/caja/ventas` y `/api/negocio/inventario/movimientos`: ambas
rutas ramifican explícitamente en `if (varianteId) { ... variante... } else { ... producto... }`).
Nunca compiten dos autoridades de stock: cada venta/movimiento toca
EXACTAMENTE una fila (la variante, o el producto base si no hay variantes),
nunca ambas.

## 4. Migración de producto existente a variantes (sección 10)

```text
BASE_TO_VARIANTS_STOCK_BEHAVIOR=
  Opción A (prefill), la más segura: al crear un producto NUEVO con
  variantes desde Inventario, si el precio base queda vacío el formulario
  usa el precio de la primera variante como fallback (nunca se pide
  re-escribir el mismo número dos veces). Para un producto YA EXISTENTE sin
  variantes, agregar la primera variante es un flujo separado y explícito
  (ProductoDetailDialog → "+ Agregar variante" → VarianteFormDialog) — el
  operador escribe conscientemente nombre/precio/costo/stock de esa
  variante; el precio/stock del producto base NUNCA se borra ni se pone en
  0 automáticamente, simplemente deja de leerse operacionalmente en cuanto
  existe al menos una variante. Nada se pierde silenciosamente: el valor
  histórico sigue en la fila Producto por si se remueven todas las
  variantes más adelante.
```

## 5. Modelo de variante (sección 7)

```text
VARIANT_FIELDS=
  OBLIGATORIO: nombre (String), precio (Float)
  OPCIONAL: costo (Float?), sku (String?), codigoBarras (String?),
    controlStock (Boolean, default false), stockCantidad (Float, default 0),
    stockMinimo (Float, default 0), activo (Boolean, default true)
```

Validado server-side por `validateVarianteMinimo` (nuevo, en
`src/lib/inventario.ts`, mismo contrato mínimo que `validateProductoMinimo`)
en los 3 puntos de entrada: creación inline (`POST /api/negocio/productos`),
creación posterior (`POST .../variantes`), edición
(`PUT .../variantes/[varianteId]`).

## 6. UX — Inventario (sección 11-17)

```text
INVENTORY_VARIANT_UX=
  - Listado (desktop tabla / mobile card): un producto con variantes
    colapsa en UNA fila — nunca N filas por variante (sección 15). Muestra
    "N variantes", "Desde $X" (mínimo precio activo, vía summarizeVariantes),
    "Stock total: N" (suma sólo de variantes activas+controladas — nunca
    autoridad, sólo resumen visual, sección 16), y un badge
    "N variante(s) con stock bajo" cuando corresponde (sección 17) — una
    variante agotada nunca marca el producto entero como agotado
    (todasSinStock sólo es true si TODAS las variantes controladas están en
    SIN_STOCK).
  - Creación (ProductoFormDialog, sólo producto NUEVO): switch
    "Este producto tiene variantes" revela un editor inline compacto — por
    fila: Nombre + Precio + Costo visibles, "Más opciones" colapsable para
    SKU/Código de barras/Controlar stock/Stock inicial/Stock mínimo
    (sección 12). Cada fila se valida con validateVarianteMinimo antes de
    enviar. Editar un producto YA EXISTENTE nunca muestra este switch — la
    gestión de variantes de un producto existente vive exclusivamente en el
    detalle (evita dos lugares que compiten por "crear variante").
  - Detalle (ProductoDetailDialog): sección "Variantes (N)" con cada
    variante (nombre, precio, stock, badge de estado), "+ Agregar variante",
    tap para editar (VarianteFormDialog), botón de inactivar/reactivar
    (nunca DELETE — sección 14). El precio/costo/stock BASE se ocultan del
    detalle en cuanto hay variantes (evita mostrar dos "precios" que
    confundan). "Ajustar stock" del producto base se oculta cuando hay
    variantes; cada variante controlada tiene su propio botón "Ajustar"
    (AjusteStockDialog extendido con un `variante` opcional, sección 25).
```

```text
VARIANT_DELETE_BEHAVIOR=
  Soft-toggle únicamente (`activo: false/true` vía PUT
  .../variantes/[varianteId]) — NO existe endpoint DELETE. Una variante
  inactiva desaparece del selector de Caja y dejar de contar para los
  resúmenes de Inventario, pero su fila permanece intacta (nunca se borra),
  preservando cualquier VentaItem/MovimientoInventario histórico que la
  referencie. Confirmado por test: "no hay handler DELETE exportado".
```

## 7. UX — Caja (sección 18-21)

```text
CAJA_VARIANT_UX=
  - Producto SIN variantes: tap → agrega directo (sin cambios, sección 18).
  - Producto CON variantes:
    - 0 variantes activas: card deshabilitada, "Sin variantes disponibles"
      (sección 40) — nunca vendible.
    - Exactamente 1 variante activa Y vendible: tap agrega esa variante
      directo — mismo one-tap que un producto simple (sección 20, sin
      ambigüedad real).
    - >1 variante activa: tap abre VarianteSelectorDialog ("Elegí una
      variante — {producto}"), cada opción muestra precio y, si está sin
      stock, aparece visible pero deshabilitada con "Sin stock" (sección 19)
      — nunca oculta.
  - Grid: precio mostrado como "Desde $X" (mínimo entre variantes activas)
    en vez de un precio fijo, más "N variantes".
```

```text
CART_LINE_IDENTITY=producto + variante
```

`CartLine` (src/lib/caja-venta.ts) ganó `varianteId?`/`varianteNombre?`
opcionales; `addCartLine`/`setCartLineQuantity`/`removeCartLine` comparan
por `(productoId, varianteId ?? null)` — dos variantes del mismo producto
son SIEMPRE dos líneas distintas, nunca se fusionan (sección 21). Cada
línea del carrito y del detalle de venta muestra
`{nombre}{varianteNombre ? " — " + varianteNombre : ""}`. Cambiar el filtro
de categoría de Caja nunca toca el carrito — el estado `cart` es
completamente independiente de `categoria`/`effectiveCategoria`, verificado
por regresión (ya lo era desde R2B-F1; no se tocó esa separación).

## 8. Precio autoritativo (sección 22) — CRÍTICO

```text
CLIENT_VARIANT_PRICE_TRUSTED=NO
```

El POST de venta recibe `{productoId, varianteId?, cantidad}` por línea —
nunca un precio. El servidor (`/api/negocio/caja/ventas`) hace
`tx.producto.findMany({..., include: {variantes: true}})` scoped a
`negocioId`, arma un mapa `productsById` con las variantes ACTIVAS de cada
producto, y `computeSaleFromAuthoritativeProducts` (extendida en
`src/lib/caja-venta.ts`) resuelve precio/nombre-snapshot EXCLUSIVAMENTE
desde ese mapa — nunca desde el request. Un `varianteId` inexistente,
inactivo, o de OTRO producto es rechazado (`"Una de las variantes ya no
está disponible"` o 400 si pertenece a otro producto). Confirmado con un
test que inyecta un precio falso en el body y verifica que el total server
usa el precio real de la variante.

## 9. Snapshot histórico (sección 23/38)

```text
SALE_VARIANT_SNAPSHOT_STRATEGY=
  VentaItem ganó dos columnas aditivas: productoVarianteId (String?, FK
  SetNull) y varianteNombre (String? — snapshot, nunca se reescribe).
  `nombre` sigue siendo el snapshot del PRODUCTO base. Un test verifica
  explícitamente: se renombra el producto Y la variante DESPUÉS de la
  venta, y la venta histórica sigue mostrando los nombres originales — igual
  principio que ya regía para producto/precio en R1.
```

## 10. Movimiento de inventario (sección 24/25)

```text
INVENTORY_MOVEMENT_VARIANT_STRATEGY=
  MovimientoInventario ganó productoVarianteId (String?, nullable, FK
  SetNull). POST /api/negocio/inventario/movimientos acepta un
  productoVarianteId opcional: si está presente, valida que la variante
  pertenezca al productoId dado, exige controlStock=true EN LA VARIANTE, y
  decrementa/ajusta ÚNICAMENTE stockCantidad de esa variante — el stock del
  Producto padre queda intacto (confirmado por test: "leaves the parent
  Producto's own stock untouched"). Ídem para la venta: cada línea con
  varianteId decrementa sólo esa variante, nunca el producto base ni una
  variante hermana (test dedicado).
```

## 11. Multi-tenant (sección 30)

```text
TENANT_ISOLATION_PASS=YES
```

`negocioId` se deriva exclusivamente de la sesión en las 3 rutas nuevas/
extendidas (creación de variante, edición de variante, movimientos,
ventas) — nunca aceptado del cliente. Cubierto por 6 tests DB dedicados:
A no puede crear/editar/ajustar/vender una variante de un producto de B; un
`varianteId` que pertenece a un producto DISTINTO (incluso del mismo
negocio) es rechazado explícitamente (evita que A mezcle variantes entre
sus propios productos por error).

## 12. Concurrencia (sección 31) — CRÍTICO

```text
CONCURRENCY_VARIANT_STOCK_PASS=YES
```

Reutiliza el mismo mecanismo `Prisma.TransactionIsolationLevel.Serializable`
que ya protegía la venta de un Producto simple — sin mecanismo nuevo. Test
`CONCURRENCY_VARIANT_STOCK_PASS`: dos ventas simultáneas de la ÚLTIMA unidad
de UNA variante (`stockCantidad=1`) vía `Promise.allSettled` contra la DB
real de TESTING → exactamente 1 éxito, 1 rechazo (409, conflicto de
serialización), stock final = 0, nunca -1. Ejecutado de verdad, no
simulado (ver §14).

## 13. Restaurante / Ropa (sección 29)

```text
RESTAURANTE_BEHAVIOR_CHANGED=NO
ROPA_BEHAVIOR_CHANGED=NO
```

Ningún archivo de Restaurante/Ropa (`products-tab.tsx`,
`agregados-section.tsx`, `ingredientes-section.tsx`) fue tocado en esta
ronda. Los nuevos campos (`ProductoVariante`, `productoVarianteId` en
VentaItem/MovimientoInventario) son técnicamente genéricos (cualquier
Producto podría tener variantes), pero ninguna UX nueva se activó fuera de
Inventario/Caja (rubro `"negocio"`) — `products-tab.tsx` nunca lee
`producto.variantes`.

## 14. Tests

```text
FOCAL_TESTS=PASS
  bun test src/lib/caja-venta.test.ts src/lib/inventario.test.ts
    src/lib/category-normalization.test.ts
    src/components/business/*-static-contract.test.ts
  = 164 pass / 0 fail / 296 expect() calls
  (incluye: 5 tests de identidad de línea de carrito por variante, 4 tests
  de precio-autoridad de variante en computeSaleFromAuthoritativeProducts,
  8 tests de validateVarianteMinimo/summarizeVariantes, 21 tests de
  contrato estático nuevo en product-variants-static-contract.test.ts)

DB_TESTS=PASS (ejecutados contra TESTING real — migración ya aplicada, ver
  abajo)
  bun test src/app/api/negocio/inventario/movimientos/route.test.ts
    src/app/api/negocio/caja/ventas/route.test.ts
    "src/app/api/negocio/productos/[id]/variantes/route.test.ts"
    "src/app/api/negocio/productos/[id]/variantes/[varianteId]/route.test.ts"
    src/app/api/negocio/categorias/route.test.ts
  = 60 pass / 0 fail / 124 expect() calls
  Desglose nuevo de esta ronda: 6 tests de movimientos por variante
  (entrada/salida/trazabilidad/sin-control/mismatch/tenant), 4 tests de
  creación de variante, 6 tests de edición/soft-delete/tenant de variante,
  11 tests de venta con variante (precio-autoridad, snapshot, dos líneas
  distintas, stock por variante, hermana intacta, sin-stock, inactiva,
  mismatch, sin varianteId = compatibilidad retro, tenant, CONCURRENCIA).
  category-normalization/categorias (R2B/R2B-F1) re-ejecutados sin cambios
  = 13 pass, confirmando cero regresión de backend en esa área.

REGRESSION_TESTS=PASS
  category-reorder + category-duplicate-prevention (Restaurante/Ropa,
  R2B): 18 pass — sin cambios de comportamiento.
```

## 15. Migración

```text
SCHEMA_CHANGED=YES
MIGRATION_CREATED=YES (20260928230000_add_producto_variantes_p2_t56_r2c)
MIGRATION_ADDITIVE=YES
DESTRUCTIVE_STATEMENTS=0
```

Generada con `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new> --script`
(sin necesitar DB viva) — auditada línea por línea antes de escribirla:
2× `ADD COLUMN` nullable, 1× `CREATE TABLE`, 2× `CREATE INDEX`, 3×
`ADD CONSTRAINT` (FK). Ningún `DROP`, ningún `RENAME`, ninguna reescritura
de datos. Aplicada a la DB real de TESTING vía `prisma migrate deploy`
(único mecanismo, credencial obtenida read-only de Railway, nunca impresa)
y verificada por consulta directa a `information_schema.columns` antes de
correr los tests DB.

## 16. Quality gates

```text
NEW_TYPESCRIPT_ERRORS=0 (baseline 33 preexistentes sin cambios)
ESLINT_GATE=PASS (0 errores/warnings en los 11 archivos cambiados/creados)
BUILD_GATE=PASS (npm run build, exit 0)
DIFF_CHECK=PASS
```

## 17. Archivos cambiados

```text
FILES_CHANGED=
  M prisma/schema.prisma (ProductoVariante nuevo; VentaItem/MovimientoInventario
    extendidos, aditivo)
  M src/lib/inventario.ts (validateVarianteMinimo, summarizeVariantes)
  M src/lib/inventario.test.ts
  M src/lib/caja-venta.ts (CartLine/ServerSaleLineInput/ResolvedSaleLine
    variant-aware; addCartLine/setCartLineQuantity/removeCartLine por
    producto+variante; computeSaleFromAuthoritativeProducts variant-aware)
  M src/lib/caja-venta.test.ts
  M src/app/api/negocio/productos/route.ts (GET incluye variantes; POST
    acepta variantes[] inline)
  M src/app/api/negocio/productos/[id]/route.ts (PUT incluye variantes)
  M src/app/api/negocio/inventario/movimientos/route.ts (productoVarianteId
    opcional, GET y POST)
  M src/app/api/negocio/caja/ventas/route.ts (varianteId opcional por línea,
    precio/stock/movimiento por variante)
  M src/lib/audit.ts (2 acciones nuevas)
  M src/components/business/inventario-tab.tsx (listado colapsado,
    creación con variantes, detalle con gestión de variantes, ajuste de
    stock por variante)
  M src/components/business/caja-tab.tsx (selector de variante, carrito
    variant-aware, detalle de venta con nombre de variante)
  M codex-reports/P2_T56_R2B_MANAGED_CATEGORIES.md (closeout: PASS +
    CLOSED_TESTING_CERTIFIED)
  A prisma/migrations/20260928230000_add_producto_variantes_p2_t56_r2c/migration.sql
  A src/app/api/negocio/productos/[id]/variantes/route.ts
  A src/app/api/negocio/productos/[id]/variantes/[varianteId]/route.ts
  A src/app/api/negocio/productos/[id]/variantes/route.test.ts
  A src/app/api/negocio/productos/[id]/variantes/[varianteId]/route.test.ts
  A src/components/business/product-variants-static-contract.test.ts
  A codex-reports/P2_T56_R2C_PRODUCT_VARIANTS.md (este reporte)
```

## 18. Known limitations (sección 41 — explícitamente fuera de scope, no implementado)

Matrices Color × Talle, generador de combinaciones, promociones/descuentos
por variante, imágenes por variante, proveedores, lotes, vencimientos,
números de serie, lector de código de barras, importación masiva, compras,
transferencias de depósito, variantes visibles en Cliente público, cambios
en Ropa/Restaurante — ninguno de estos se tocó, tal como exige la tarea.

```text
VARIANT_SEARCH_IMPLEMENTED=NO
```

El buscador de Inventario/Caja sigue buscando por nombre/SKU/código del
PRODUCTO base únicamente — no busca por SKU/nombre de variante todavía
(sección 27, explícitamente marcado "deseable pero no debe inflar scope").
Documentado para un follow-up, no requiere cambio de schema.

No se verificó visualmente en un navegador real en esta ronda — verificado
mediante 60 tests de integración DB reales (incluyendo la prueba de
concurrencia contra la base física), 21 tests de contrato estático nuevos,
y build/tsc/eslint limpios. La revisión manual del operador en TESTING
sigue siendo la confirmación real, especialmente crítica en esta ronda
porque toca stock/ventas/schema.

```text
PHYSICAL_REVIEW_REQUIRED=SI
```

## 19. R2C-F1 — hallazgos UX de la revisión manual del operador

Tres problemas concretos detectados al revisar R2C en TESTING, resueltos
sin tocar backend/schema (confirmado por auditoría antes de escribir
código — ver sección 18 del prompt R2C-F1).

```text
SCHEMA_CHANGE_REQUIRED=NO
MIGRATION_REQUIRED=NO
BACKEND_CHANGE_REQUIRED=NO
```

### Finding A — Producto base ambiguo al activar variantes

```text
BASE_PRODUCT_COMMERCIAL_FIELDS_WITH_VARIANTS=
  Antes de esta ronda, "Nuevo producto" mostraba el precio del Producto
  base SIEMPRE visible (incluso con "Este producto tiene variantes"
  activado), y "Detalles avanzados" mostraba SKU/código de
  barras/costo/control de stock también siempre visibles — sólo el switch
  "Controlar stock" y sus campos de stock ya estaban ocultos desde R2C.
  Auditado el formulario completo antes de tocar nada (sección 2 del
  prompt), campo por campo.

BASE_FIELDS_HIDDEN_WHEN_VARIANTS=
  precio, costo, SKU, código de barras, controlStock, stockCantidad
  (stock inicial), stockMinimo, unidadMedida — los 8 campos operativos del
  Producto base, ocultos con el mismo gate `!productoHasVariantes &&
  !hasVariantes` (edición y creación respectivamente).
  Permanecen SIEMPRE visibles (no son campos comerciales, son metadatos
  generales del producto): nombre, categoría, imagen, marca.
```

```text
BASE_PRICE_UI_WHEN_VARIANTS=HIDDEN_OR_DERIVED
```

El campo Precio de venta del Producto base desaparece del formulario en
cuanto "Este producto tiene variantes" está activo (creación) o el
producto ya tiene variantes (edición) — reemplazado por una nota explicando
que precio/costo/stock se gestionan por variante. Internamente, R2C ya
tenía el fallback "usa el precio de la primera variante si el precio base
queda vacío" — se mantiene sin cambios (sigue siendo necesario para la
columna `Producto.precio`, que es `NOT NULL` en el schema), pero el usuario
ya no ve ni completa ese campo dos veces.

### Finding B — stock de variante sin labels

```text
VARIANT_STOCK_LABELS_FIX=YES
```

El editor inline de variantes (creación de producto nuevo) mostraba los
dos inputs de stock SOLAMENTE con `placeholder` ("Stock inicial"/"Stock
mínimo") — un placeholder desaparece en cuanto el campo tiene un valor, y
ambos ya arrancaban en "0", así que en la práctica el operador veía dos
inputs con "0" sin ninguna etiqueta visible. Se agregó un `<Label>` real
sobre cada input (mismo patrón ya usado correctamente en `VarianteFormDialog`,
que nunca tuvo este bug). Además, al EDITAR una variante existente con
stock controlado, ahora se muestra "Stock actual: N" de sólo lectura —
cambiarlo sigue requiriendo el flujo separado "Ajustar stock" (nunca se
habilitó edición directa que rompiera la trazabilidad de
MovimientoInventario, tal como exige la sección 8 del prompt).

### Finding C — variantes demasiado altas

```text
VARIANT_COLLAPSE_IMPLEMENTED=YES
VARIANT_COLLAPSE_INITIAL_BEHAVIOR=
  Cada fila de variante (editor inline de creación) tiene su propio
  `expanded: boolean` independiente — nunca un único toggle global. Una
  fila nueva (desde el switch "tiene variantes" o "+ Agregar variante")
  arranca expandida. Colapsada muestra un resumen compacto de una línea
  (nombre, precio, y "Stock N" o "Sin control de stock" + costo si
  corresponde) — nunca vacío. Colapsar/expandir sólo toca el flag
  `expanded`, nunca reescribe ni pierde el resto de los campos de esa fila.
  Si al guardar alguna variante falla validación (nombre vacío o precio
  inválido), esa fila se fuerza a expandirse automáticamente — nunca queda
  colapsada escondiendo el error.
  El detalle de un producto EXISTENTE (ProductoDetailDialog) ya mostraba
  sus variantes como una única línea compacta desde R2C — no se tocó ese
  componente (no hacía falta, sección 17 del prompt lo permite
  explícitamente).
```

### Tests y gates

```text
FOCAL_TESTS=17 pass / 0 fail (nuevo archivo
  product-variant-editor-ux-static-contract.test.ts)
REGRESSION_TESTS=181 pass / 0 fail (pure helpers + los 10 archivos de
  contrato estático existentes — category R2B, Caja responsive R2A, cart
  identity/price authority R2C, todos sin cambios de comportamiento)

NEW_TYPESCRIPT_ERRORS=0
ESLINT_GATE=PASS
BUILD_GATE=PASS
DIFF_CHECK=PASS
```

### Archivo cambiado

```text
FILES_CHANGED=
  M src/components/business/inventario-tab.tsx (únicamente — ningún
    archivo de backend/schema/Caja tocado esta ronda)
  A src/components/business/product-variant-editor-ux-static-contract.test.ts
  M codex-reports/P2_T56_R2C_PRODUCT_VARIANTS.md (esta sección)
```

R2C sigue sin cerrarse — esta ronda es un refinamiento UX dentro de la
misma tarea, pendiente de nueva revisión manual del operador.

```text
PHYSICAL_REVIEW_REQUIRED=SI
```

## 20. R2C_F2_CLIENT_VARIANTS — variantes en Cliente normal y Mesa

### Auditoría previa (sección 1 del prompt)

```text
CURRENT_NORMAL_CLIENT_BEHAVIOR=
  Un producto con variantes mostraba solo el precio/stock del Producto
  base (dormido desde R2C) — el cliente nunca veía ni podía elegir la
  variante. Detectado en revisión manual del operador tras R2C-F1.

CURRENT_MESA_CLIENT_BEHAVIOR=
  Idéntico a Cliente normal — ver hallazgo arquitectónico clave abajo.

HALLAZGO ARQUITECTÓNICO CLAVE (determina todo el resto de esta sección):
  "Cliente normal" y "Cliente Mesa" NO son dos flujos/árboles de
  componentes distintos. `src/app/n/[slug]/page.tsx` sirve ambos;
  `src/app/cliente/n/[slug]/page.tsx` es un re-export de una línea del
  mismo archivo. El modo Mesa es únicamente el query param `?mesa=N`
  (resuelto por `resolveEffectiveMesa()`), que cambia el comportamiento
  de carrito/checkout más abajo en el árbol — nunca el catálogo/detalle
  de producto. Por lo tanto, implementar el selector de variantes UNA
  sola vez en `ProductCard`/`ProductDetailSheet` cubre ambos flujos
  simultáneamente — confirmado por inspección de código, no supuesto.

NORMAL_CLIENT_PRODUCT_SOURCE=src/app/n/[slug]/page.tsx (ProductCard, CatalogSection, ProductDetailSheet)
MESA_CLIENT_PRODUCT_SOURCE=el mismo archivo — mismo componente, sin rama de código separada

PUBLIC_API_VARIANTS_AVAILABLE=NO (antes de esta ronda) — `productPublicSelect`
  en src/app/api/negocios/[slug]/route.ts no incluía `variantes` en absoluto.

ORDER_ITEM_MODEL=PedidoItem (prisma/schema.prisma) — sin campo de variante
  antes de esta ronda.

ORDER_VARIANT_STORAGE_AVAILABLE=NO — pero el modelo hermano `VentaItem`
  (Caja, P2-T56-R2C) ya usa exactamente el patrón
  `productoVarianteId String?` + `varianteNombre String?` (snapshot),
  reutilizado acá tal cual para PedidoItem.

EXISTING_PRODUCT_OPTIONS_UI_SOURCE=
  No existe un componente separado "product-options" — la selección de
  "Opciones del producto" real de DeliGO son las "secciones" propias del
  producto, dentro de `ProductDetailSheet` (mismo archivo), sección
  single-select: filas `<button>` con borde 2px + indicador circular
  (radio dibujado a mano, sin `RadioGroup`/`Dialog`/`Sheet` de shadcn para
  la selección en sí — solo el contenedor exterior usa `Drawer`).
```

### Decisión de arquitectura (sección 2)

```text
CLIENT_VARIANT_ORDER_STRATEGY=EXTEND_EXISTING_ADDITIVELY
  PedidoItem gana `productoVarianteId String?` + `varianteNombre String?`
  (nullable, mismo patrón que VentaItem) — ninguna columna existente
  tocada. Migración
  prisma/migrations/20260929120000_add_pedido_item_variante_p2_t56_r2c_f2/
  verificada byte-a-byte contra `prisma migrate diff` antes de escribirla
  a mano (mismo método que R2C, sección 39 de este reporte).
```

### Principio de producto / UX del listado (secciones 3/4)

```text
Producto CON variantes se muestra UNA sola vez en el listado (nunca una
card por variante). Precio de card:
  - >1 variante activa -> "Desde $X" (mínimo entre las activas) + texto
    "N variantes" debajo, mismo string literal `Desde ${formatPrice(...)}`
    ya usado en Inventario/Caja (src/components/business/inventario-tab.tsx,
    caja-tab.tsx) — mismo lenguaje, no una fórmula nueva.
  - =1 variante activa -> su precio directo (sección 4, "si existe
    exactamente una variante activa se puede mostrar directamente").
  - 0 variantes activas -> "Sin stock" (nunca un precio inventado).
```

### Disponibilidad general (sección 5)

```text
CLIENT_PRODUCT_VARIANT_AVAILABILITY_RULE=
  Producto sin variantes: sin cambios (product.stock, igual que siempre).
  Producto CON variantes: disponible = product.stock (toggle manual
  existente, sin cambios) Y existe >=1 variante activa Y esa variante
  cumple `!controlStock || stockCantidad > 0`. Una sola variante agotada
  entre varias disponibles NUNCA marca el producto entero como agotado —
  implementado en la autoridad pura y unit-testeada
  `isProductoConVariantesDisponible()` (src/lib/client-product-variants.ts),
  nunca reimplementado inline en el componente.
  Caso límite cubierto explícitamente: un producto cuyas variantes
  existen pero TODAS están inactivas expone `tieneVariantes=true` +
  `variantes=[]` desde la API pública — nunca cae de vuelta al
  precio/stock (dormido) del Producto base. Verificado con test de DB
  real (src/app/api/negocios/[slug]/route.test.ts).
```

### Selección de variante (secciones 6/7/8/9/10/11/12/26/27)

```text
NORMAL_CLIENT_VARIANT_UX=IMPLEMENTED
MESA_CLIENT_VARIANT_UX=IMPLEMENTED (mismo componente — ver hallazgo arquitectónico)

VARIANT_VISUAL_STYLE_SOURCE=EXISTING_PRODUCT_OPTIONS_UI
  El selector "Elegí una opción" (ProductDetailSheet, dentro del mismo
  Drawer que ya usa el detalle de producto) reutiliza LITERALMENTE las
  mismas clases Tailwind que el single-select radio de "secciones"
  ("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2
  text-left text-sm transition-all" + indicador circular w-5 h-5 border-2)
  — no un componente ni lógica nuevos, no un `<Dialog>`/`<Sheet>` extra.

VARIANT_AND_PRODUCT_OPTIONS_LOGIC_MERGED=NO
  selectedVarianteId es su propio useState, nunca escribe en
  selectedSecciones/CartItemSecciones. Verificado por contrato estático
  (src/app/n/[slug]/client-product-variants-static-contract.test.ts).
VARIANT_AND_PRODUCT_OPTIONS_VISUAL_LANGUAGE_SHARED=YES

NORMAL_CLIENT_VARIANT_VISUAL_STYLE=MATCH_EXISTING_PRODUCT_OPTIONS
MESA_CLIENT_VARIANT_VISUAL_STYLE=MATCH_EXISTING_PRODUCT_OPTIONS

CLIENT_PRODUCT_VARIANT_AVAILABILITY_RULE=(ver sección anterior)

SINGLE_ACTIVE_VARIANT_CLIENT_BEHAVIOR=
  Si existe exactamente 1 variante activa Y disponible (nunca una
  agotada), se auto-selecciona en el detalle (sigue visible/nombrada en
  el selector, fila única) y el quick-add de la card la agrega
  directamente sin abrir el detalle — el toast nombra la variante
  explícitamente ("Producto — Nombre variante agregado al carrito"),
  nunca un agregado silencioso. Si la única variante activa está agotada,
  NO se auto-selecciona (el producto queda no vendible).

Variante sin stock: visible, fila con `disabled`, opacidad reducida,
"Sin stock" a la derecha en vez del precio — nunca oculta (sección 12).
```

### Identidad de carrito y precio (secciones 15/16/17/18/19/20/21/22)

```text
CLIENT_CART_VARIANT_IDENTITY=
  CartItem gana `varianteId?`/`varianteNombre?` (opcionales, no rompen
  ningún call-site existente). `generateCartItemKey()` incorpora
  `item.varianteId ?? ""` — dos variantes del mismo producto son siempre
  líneas de carrito distintas.

CLIENT_VARIANT_PRICE_TRUSTED=NO
  El payload de POST /api/pedidos solo envía `productoId`/`varianteId`/
  `cantidad` (+ campos legítimos existentes) — nunca un precio. El
  servidor SIEMPRE re-fetchea Producto+variantes, valida
  pertenencia/activo/stock y calcula el precio desde la variante DB —
  igual principio que ya usa Caja (P2-T56-R2C).

ORDER_STOCK_DECREMENT_TIMING=
  Auditado antes de tocar nada (grep de stockCantidad/controlStock/
  MovimientoInventario en src/app/api/pedidos/route.ts): CERO
  ocurrencias. Un Pedido NUNCA decrementa inventario hoy — solo Venta
  (Caja) lo hace. Esta ronda preserva ese comportamiento exactamente:
  la variante se VALIDA (activa + `!controlStock || stockCantidad > 0`)
  mas NUNCA se decrementa desde /api/pedidos. No se introduce una
  segunda lógica de stock que compita con Caja (sección 18 del prompt).

ORDER_VARIANT_SNAPSHOT_STRATEGY=
  PedidoItem.productoVarianteId (nullable, ON DELETE SET NULL) +
  PedidoItem.varianteNombre (snapshot inmutable) — mismo patrón que
  VentaItem, nunca reconstruido por live-lookup. Verificado con un
  producto cuya variante se renombra/inactiva DESPUÉS del pedido: el
  pedido histórico sigue mostrando el nombre original (test de DB real).

NON_VARIANT_CLIENT_PRODUCTS_PRESERVED=YES
  `varianteId` es opcional en TODO el flujo (payload, CartItem,
  PedidoItem). Un producto sin variantes se comporta exactamente igual
  que antes — cubierto por test de regresión explícito (DB real) además
  de la suite completa de Pedidos ya existente (route.test.ts, 5/5 pass).
```

### Detalle de carrito y resumen de pedido (secciones 20/21)

```text
Carrito (CartPanel): la variante aparece como el primer "detail chip" de
la línea (mismo componente visual ya usado para talle/color/agregados/
secciones — src/components/cart/cart-panel.tsx), ej. "Coca Cola" +
chip "1,5 L".

Historial/detalle de pedido (ClientOrdersPanel, ItemsList): variante
mostrada junto a talle/color en la misma línea de detalle
(`[item.varianteNombre, item.talle, item.color].filter(Boolean).join(" · ")`).

Cuenta de mesa en vivo (MesaAccountDetail, compartido con el panel
Cliente Y el panel operativo/mozo): mismo tratamiento —
`[item.varianteNombre, item.talle, item.color]`. `mesa-cuenta.ts`
(`CuentaPedidoItemInput`/`buildItemLine`) extendido con
`varianteNombre?: string | null` OPCIONAL — todo caller existente
(mesa-historial, operaciones/ocupaciones/cuenta, thermal-print, fixtures
de test) sigue compilando sin tocarlos.
```

### Repetir pedido (hallazgo lateral, necesario para la corrección)

```text
"Repetir pedido" (PUT /api/cliente/pedidos/[id]/repetir) reconstruye un
CartItem directamente desde la respuesta de la API — si no se
extendía, repetir un pedido con variante habría agregado el producto
BASE sin variante al carrito (una regresión real introducida por esta
misma ronda, no preexistente, ya que antes de R2C-F2 ningún pedido
tenía variante). Corregido: la ruta ahora re-valida la variante ACTUAL
contra el catálogo vigente (nunca la snapshot histórica para
disponibilidad) — inactivada/sin stock -> `disponible=false` con motivo
explícito; producto migrado a variantes DESPUÉS del pedido histórico
(item sin varianteId, producto con variantes hoy) -> también
`disponible=false` (nunca usa el precio base dormido). Cubierto por 5
tests de DB real nuevos.
```

### Variantes + Opciones del producto (sección 33)

```text
No pueden coexistir hoy en la práctica: los productos con
`opcionesCompartidasIds`/`secciones` propias son de negocio
Restaurante/genérico-con-opciones, y las variantes (P2-T56-R2C) se
diseñaron para negocio genérico con inventario — nada en el schema
impide que un mismo Producto tenga ambos, así que el selector de
variante y las secciones de Opciones se renderizan en bloques
independientes, en ese orden (variante primero, opciones después),
compartiendo el mismo lenguaje visual pero NUNCA la misma sección/
estado. `handleAdd` valida ambos gates de forma independiente
(variante seleccionada Y secciones obligatorias) antes de agregar al
carrito — un test de contrato estático confirma que
`selectSectionOption`/`setSelectedSecciones` nunca referencian variante.
No se inventó compatibilidad "combo" adicional (fuera de scope, sección
37 del prompt).
```

### Restaurante / Ropa (sección 23)

```text
RESTAURANTE_CLIENT_BEHAVIOR_CHANGED=NO
ROPA_CLIENT_BEHAVIOR_CHANGED=NO
  El branch `if (isRopa) { ... }` de `ProductCard` (card estilo moda) no
  fue tocado — verificado por contrato estático (el bloque no contiene
  `variantesActivas`/`productoDisponible`, sigue usando `!product.stock`
  literal). `tieneVariantes` es estructuralmente `false` para todo
  producto que nunca tuvo una fila en `ProductoVariante` (Restaurante/
  Ropa hoy) — cero cambio de comportamiento observable. Confirmado
  además por la suite completa de contrato estático de `page.tsx`
  (business-preview, category-grouping, hero-safe-area, product-gallery
  — 38/38 pass sin modificar) y por 156/156 pass en la batería de
  regresión Caja/Inventario/R2C/R2C-F1/categorías/Opciones del producto.
```

### API pública (sección 29)

```text
PUBLIC_API_VARIANTS_AVAILABLE=YES (después de esta ronda)
PUBLIC_VARIANT_FIELDS_EXPOSED=id, nombre, precio, controlStock, stockCantidad
  (por variante activa) + tieneVariantes (booleano a nivel producto,
  calculado server-side, no una columna cruda). NUNCA expuestos:
  costo, sku, codigoBarras, ni las variantes inactivas (filtradas
  server-side antes de armar la respuesta — no solo ocultas en la UI).
```

### Schema / migración (sección 35)

```text
SCHEMA_CHANGE_REQUIRED=YES
MIGRATION_REQUIRED=YES
MIGRATION_ADDITIVE=YES
DESTRUCTIVE_STATEMENTS=0
  ALTER TABLE ... ADD COLUMN (x2, nullable) + CREATE INDEX + ADD
  CONSTRAINT (FK ON DELETE SET NULL) — ninguna columna existente
  modificada/eliminada. SQL verificado con `prisma migrate diff`
  ANTES de escribirlo a mano; aplicado a TESTING vía `prisma migrate
  deploy` (credencial fresca, nunca impresa/persistida) para poder
  ejecutar los tests de DB real de esta ronda — NO se tocó
  testing-codex (git) en este paso, solo el schema Postgres de TESTING.
```

### Tests

```text
FOCAL_TESTS=
  9 pass — src/app/api/pedidos/route.variantes.test.ts (DB real: sin
    variantes/regresión, exige varianteId, precio/nombre snapshot,
    variante de otro producto, variante de otro negocio/tenant,
    inactiva, sin stock, varianteId en producto sin variantes, dos
    variantes = líneas distintas)
  3 pass — src/app/api/negocios/[slug]/route.test.ts (DB real: sin
    variantes, con variantes activas/inactivas mezcladas — campos
    expuestos exactos, todas inactivas -> variantes=[])
  5 pass — src/app/api/cliente/pedidos/[id]/repetir/route.test.ts (DB
    real: variante vigente, inactivada después, sin stock después,
    producto migrado a variantes después del pedido histórico, sin
    variantes/regresión)
  19 pass — src/app/n/[slug]/client-product-variants-static-contract.test.ts
  14 pass — src/lib/client-product-variants.test.ts (unit, pure)
  TOTAL FOCAL = 50 pass / 0 fail

DB_TESTS=17 pass / 0 fail (los 3 archivos de DB real de arriba: 9+3+5)

REGRESSION_TESTS=
  5 pass — src/app/api/pedidos/route.test.ts (P2-T01 snapshot + P2-T08
    mesa auth — sin cambios de comportamiento)
  156 pass — batería Caja/Inventario/R2C/R2C-F1/categorías R2B/Opciones
    del producto (route.test.ts de caja/ventas e
    inventario/movimientos, product-variant-editor-ux-static-contract,
    product-variants-static-contract, caja-venta.test.ts,
    inventario.test.ts, product-own-sections.test.ts,
    negocio/categorias/route.test.ts)
  38 pass — el resto de contrato estático de src/app/n/[slug]/page.tsx
    (business-preview, category-grouping, hero-safe-area,
    product-gallery-public-preview) — Restaurante/Ropa/preview
  37 pass — mesa-cuenta puro (p2-t46-account-payment,
    thermal-print/mesa-account-ticket, mesa-cliente-cuenta-static-contract)
  28 pass — mesa-cliente-cuenta-client/ui + rate-limit-mesa-cuenta (puro)
  TOTAL REGRESSION = 264 pass / 0 fail

TRANSIENT_UNRELATED_FAILURES=
  src/lib/mesa-cliente-cuenta.test.ts (suite de concurrencia con
  timeouts de 5000ms y un patrón "rendezvous") mostró 7-8 fallos
  intermitentes por contención real contra la base TESTING en vivo —
  confirmado NO relacionado con esta ronda: se hizo `git stash` de los
  2 únicos archivos tocados de esa área (mesa-cuenta.ts,
  mesa-cliente-cuenta.ts) y se re-corrió el mismo archivo contra el
  código SIN modificar -> 8 fallos (mismo patrón, ligeramente peor).
  Documentado con transparencia en vez de ocultarlo, mismo criterio que
  R2C sección 14 de este reporte.

TENANT_ISOLATION_PASS=YES
  Variante de otro producto (mismo negocio) y variante de otro negocio
  (tenant) ambas rechazadas con "Variante invalida" — cubierto por test
  de DB real explícito para cada caso.
```

### Quality gates

```text
NEW_TYPESCRIPT_ERRORS=0 (baseline 33 errores preexistentes, ninguno en
  archivos tocados por esta ronda, confirmado antes y después de cada
  tanda de cambios)
ESLINT_GATE=PASS (0 errores; 1 warning esperado en prisma/schema.prisma
  por no tener config de ESLint para .prisma, no relacionado)
BUILD_GATE=PASS
DIFF_CHECK=PASS (git diff --check limpio en los 11 archivos modificados)
```

### Archivos cambiados

```text
R2C_F2_CLIENT_UI=
  M src/app/n/[slug]/page.tsx (ProductoAPI, ProductCard, ProductDetailSheet)
R2C_F2_MESA_UI=(mismo archivo — ver hallazgo arquitectónico, sección 0)
R2C_F2_CART=
  M src/store/cart-store.ts (CartItem.varianteId/varianteNombre, generateCartItemKey)
  M src/components/cart/cart-panel.tsx (payload + detail chip)
  M src/components/client/client-orders-panel.tsx (tipos + repetir + historial)
  M src/components/shared/mesa-account-detail.tsx (varianteNombre en el detalle)
R2C_F2_ORDER_BACKEND=
  M src/app/api/pedidos/route.ts (resolución/validación server-side de variante)
  M src/app/api/negocios/[slug]/route.ts (expone variantes públicas)
  M src/app/api/cliente/pedidos/[id]/repetir/route.ts (re-validación variant-aware)
  M src/lib/mesa-cuenta.ts (varianteNombre opcional)
  M src/lib/mesa-cliente-cuenta.ts (select + varianteNombre)
R2C_F2_SCHEMA=
  M prisma/schema.prisma (PedidoItem.productoVarianteId/varianteNombre)
R2C_F2_MIGRATION=
  A prisma/migrations/20260929120000_add_pedido_item_variante_p2_t56_r2c_f2/migration.sql
R2C_F2_TEST=
  A src/lib/client-product-variants.ts
  A src/lib/client-product-variants.test.ts
  A src/app/n/[slug]/client-product-variants-static-contract.test.ts
  A src/app/api/pedidos/route.variantes.test.ts
  A src/app/api/negocios/[slug]/route.test.ts
  A src/app/api/cliente/pedidos/[id]/repetir/route.test.ts
R2C_F2_DOCUMENTATION=
  M codex-reports/P2_T56_R2C_PRODUCT_VARIANTS.md (esta sección)
UNRELATED=0
```

R2C sigue sin cerrarse — R2C-F2 agregó variantes al lado Cliente, todavía
pendiente de autorización de integración a testing-codex y de revisión
manual del operador en TESTING.

```text
PHYSICAL_REVIEW_REQUIRED=SI
```
