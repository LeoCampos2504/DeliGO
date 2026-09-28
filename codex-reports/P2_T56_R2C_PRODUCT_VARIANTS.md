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
