# P2-T56-R3A-I4 — Disponibilidad pública y control del carrito

```text
TASK=P2-T56-R3A-I4 (implementación)
DATE=2026-10-08
BRANCH=work/p2-t56-r3-stock-lifecycle-i4
BASE=testing-codex 7a6d0af6e9326634406b4daeda3da8f545403318 (cierre I3) + cherry-pick del discovery 6e47fcb → a9ed8a47fa97474a9b9ca1c6363f2fa0befc04a6
R3A_I4_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
SCHEMA_CHANGED=NO · NEW_MIGRATIONS=0
TESTING_DB_TOUCHED=NO · RAILWAY_TOUCHED=NO · DEPLOY=NO · MODE_ACTIVATED=NO (OFF) · I5_STARTED=NO · PRODUCTION_TOUCHED=NO
```

## 1. Objetivo y autorización

La ronda implementa I4 sobre la base del discovery del 2026-10-08 (commit `6e47fcb`, incorporado por cherry-pick) y de las seis decisiones de producto que el operador aprobó.

Autorizado:
- branch `work/p2-t56-r3-stock-lifecycle-i4` desde `testing-codex` `7a6d0af`;
- implementación, tests y documentación;
- commit y push **sólo** de esa branch.

No autorizado: integrar a `testing-codex`, desplegar, tocar Railway o la base TESTING, activar ON/DRAINING, empezar I5, tocar Production, implementar el escáner o las funcionalidades futuras, y cambiar el schema. No apareció ninguna necesidad de schema.

## 2. Decisiones del operador → implementación

| # | Decisión | Implementación |
|---|---|---|
| 1 | Validación del servidor en OFF | `POST /api/pedidos` pasa `validarDisponibleEnOff: true` al planner. En OFF, para un negocio genérico con línea controlada, valida por clave agregada contra el disponible (físico − ACTIVA) **dentro de la transacción Serializable**. Si no alcanza → 409 `STOCK_INSUFFICIENT` con detalle, sin Pedido, sin reservas y sin descuento. El replay idempotente sigue primero. **Mozo no pasa el flag** (OFF de I2 intacto). ON y DRAINING sin cambios. |
| 2 | Ocultar agotados y deshabilitados | En rubro `"negocio"`, `GET /api/negocios/[slug]` omite el producto si `stock=false`, o si controla stock y su disponible es ≤ 0. Aplica en `productos`, `productosSinSeccion` y `secciones[].productos`, así que la búsqueda y las secciones del cliente también lo pierden. |
| 3 | Ocultar variantes agotadas o inactivas | Sólo viajan las variantes activas con disponible > 0 (o sin control). Si no queda ninguna, el producto se omite. El stock del padre nunca se mezcla: con variantes, la autoridad es la variante. |
| 4 | Sin cantidades visibles | El servidor publica `stockDisponible`, pero la UI nunca lo muestra. Sólo bloquea el exceso con un mensaje simple: «No hay suficientes unidades disponibles». Un contrato estático lo fija. |
| 5 | Carrito desactualizado | Sin mutación silenciosa: el carrito persistido nunca se recorta ni se vacía por stock (`cart-store.ts` no cambia). `CartPanel` muestra un aviso con cada producto afectado y bloquea «Continuar» y la confirmación hasta corregir. Ante un 409 del servidor: refresca la disponibilidad, identifica los productos con el `details` del 409, vuelve a la lista y conserva todos los ítems. |
| 6 | Promociones | `GET /api/cliente/promociones` y `GET /api/negocios/promocionados` quitan los productos agotados de negocios genéricos. El negocio sigue visible aunque tenga alguno (o todos) agotados. |

## 3. Diseño

### 3.1 Autoridad

- **`src/lib/stock-authority.ts` (puro).** `resolvePublicProductAvailability(product, reservedByKey)` → `{ visible, stockDisponible, variantesVisibles }`. Usa la misma fórmula A0.1: `computeAvailableStock(físico, ACTIVA)`, con las claves de `stockKey`.
- **`src/lib/stock-lifecycle.ts`:**
  - `leerReservasActivasPorClave(reader, negocioIds)`: **un solo** `reservaStock.groupBy` por request (`estado: "ACTIVA"`, `productoId != null`), con un mapa por `stockKey`. Sin N+1, y no consulta nada si no hay negocios.
  - Re-exporta `isGenericBusinessStockScope` y `resolvePublicProductAvailability`. Así las lecturas públicas importan sólo de la autoridad transaccional, y la allowlist exacta de callers de `stock-authority` (contrato I1) no cambia.
  - `planificarReservaStockPedido(tx, { …, validarDisponibleEnOff? })`: el loop de validación se extrajo a `validarDisponibleLineas`, que ON sigue usando igual. En OFF con el flag sólo valida, sin crear reservas.
  - `StockInsufficientError(keys, lineas?)`: el 409 incluye `details.lineas: [{ productoId, productoVarianteId, solicitado, disponible }]`, sin reservas ni datos de otros pedidos. `keys` se conserva y sin `lineas` el body es idéntico al anterior.
- ReservaStock se sigue leyendo **sólo** en `stock-lifecycle.ts` (los contratos I1/I2 pasan sin cambios).

### 3.2 API pública

- **`GET /api/negocios/[slug]`:**
  - Selecciona `controlStock` y `stockCantidad` del producto base sólo del lado del servidor; el `stockCantidad` base nunca se publica.
  - Nuevo campo `stockDisponible: number | null` por producto y por variante (`null` = sin límite, o rubro fuera de alcance).
  - Las variantes conservan `stockCantidad` por ahora (A0.1-15 paso 1); el paso 2 queda como follow-up.
- **Promociones y promocionados:** una lectura agrupada limitada a los negocios genéricos del resultado.
- **`PUT /api/cliente/pedidos/[id]/repetir`:** usa la misma disponibilidad. Un ítem agotado (base o variante, también por reservas) queda `disponible=false` con `motivoIndisponibilidad="Sin stock"`. Cada ítem disponible informa `stockDisponible`, y el historial del pedido no se toca.
- **Restaurante y Ropa:** sin lectura de reservas, sin ocultar nada y `stockDisponible: null` (tests dedicados).

### 3.3 Cliente

- **`src/lib/cart-stock-availability.ts` (nuevo, puro).**
  - `buildCatalogAvailability(negocio)` devuelve `null` fuera del rubro `"negocio"`. Una clave ausente del catálogo vale 0 disponible.
  - `unidadesAgregables` y `puedeAgregarAlCarrito` **suman todas las líneas del carrito de la misma clave de stock**: distintos agregados o secciones comparten stock.
  - `validarCarritoDisponibilidad` devuelve `SIN_STOCK` o `EXCEDE_DISPONIBLE` con nombre e ítems, sin modificar el carrito.
  - `nombresDeLineasRechazadas` resuelve el 409.
- **`client-product-variants.ts`:** `isVarianteDisponible` prefiere el `stockDisponible` publicado.
- **`src/app/n/[slug]/page.tsx`** (Cliente y Mesa):
  - `handleAddToCart` devuelve boolean y aplica el tope por clave. La tarjeta (quick add) y el detalle muestran el toast de éxito sólo si se agregó, y el detalle se cierra sólo en éxito.
  - En el detalle, el tope de cantidad usa el **catálogo vigente** (no la copia del producto abierto) menos lo que ya está en el carrito. El «+» avisa con el mensaje simple sin deshabilitarse, así que en preview sigue interactivo.
  - La query del negocio usa `refetchOnWindowFocus: "always"`.
- **`src/components/cart/cart-panel.tsx`:**
  - `CartStockWarning` (exportado, con prueba de render).
  - Marca por ítem con «Sin stock» o el mensaje simple.
  - Tope en el «+» del carrito.
  - «Continuar» deshabilitado mientras haya problemas.
  - `onRefreshAvailability` (lo provee la página: `refetchQueries(["negocio", slug])` y devuelve la versión fresca) se llama al abrir el carrito, antes del checkout (revalida con el catálogo fresco y, si hay problemas, vuelve a la lista sin enviar) y tras un 409 `STOCK_INSUFFICIENT`.

### 3.4 Estrategia de caché

El catálogo se refresca:
- al volver a la pestaña (`refetchOnWindowFocus: "always"`);
- al abrir el carrito;
- antes del checkout (`await`);
- después de un 409.

El servidor sigue siendo la autoridad: la validación real ocurre dentro de la transacción del pedido.

## 4. Semántica de OFF y limitación explícita

En OFF ningún pedido descuenta físico, así que «disponible» = físico − ACTIVA residual, y sólo Caja e Inventario lo mueven. La validación OFF frena **un pedido individual** que supera el disponible. **No** evita la sobreventa acumulada entre varios pedidos: eso sólo lo da ON (I5).

Esta ronda cambia deliberadamente el comportamiento OFF certificado en I2 para `POST /api/pedidos` (decisión 1). El test F1-B se actualizó y lo documenta.

## 5. Archivos (clasificación del diff)

```text
I4_RUNTIME=
  src/lib/stock-authority.ts (resolvePublicProductAvailability + tipos)
  src/lib/stock-lifecycle.ts (validarDisponibleEnOff, validarDisponibleLineas, detalle del 409, leerReservasActivasPorClave, re-exports)
  src/app/api/pedidos/route.ts (flag OFF, 1 línea)
  src/app/api/negocios/[slug]/route.ts
  src/app/api/cliente/promociones/route.ts
  src/app/api/negocios/promocionados/route.ts
  src/app/api/cliente/pedidos/[id]/repetir/route.ts
I4_UI=
  src/lib/cart-stock-availability.ts (nuevo)
  src/lib/client-product-variants.ts
  src/app/n/[slug]/page.tsx
  src/components/cart/cart-panel.tsx
I4_TESTS=
  src/lib/stock-lifecycle-i4.test.ts (nuevo, 20)
  src/lib/cart-stock-availability.test.ts (nuevo, 13)
  src/components/cart/cart-stock-warning.test.tsx (nuevo, 2)
  src/lib/p2-t56-r3a-i4-public-availability-static-contract.test.ts (nuevo, 15)
  src/app/api/negocios/[slug]/route.public-availability.test.ts (nuevo, 6)
  src/app/api/cliente/promociones/route.public-availability.test.ts (nuevo, 3)
  src/app/api/negocios/promocionados/route.public-availability.test.ts (nuevo, 3)
  src/app/api/cliente/pedidos/[id]/repetir/route.public-availability.test.ts (nuevo, 3)
  src/app/api/pedidos/route.stock-mode.test.ts (F1-B actualizado + bloque I4-OFF A–F)
  src/app/api/negocios/[slug]/route.test.ts (real-DB: forma con stockDisponible; producto sin variantes activas ya no se publica — actualizado estáticamente, NO ejecutado)
  src/app/n/[slug]/business-preview-static-contract.test.ts (2 patrones adaptados a la firma boolean y al «+» con tope; misma intención)
I4_DOCUMENTATION=
  codex-reports/P2_T56_R3A_I4_PUBLIC_AVAILABILITY.md (nuevo)
  codex-reports/ROADMAP.md · CODEX_REPORT.md · DELIGO_FULL_CONTEXT_LATEST.md
UNRELATED=0 · prisma/ sin cambios · cart-store.ts sin cambios · Mozo route sin cambios
```

## 6. Verificación

### 6.1 Tests (RUN_NOW, sin base de datos)

| Suite | Resultado |
|---|---|
| `stock-lifecycle-i4` (planner OFF/ON/DRAINING, detalle del 409, groupBy, resolvedor público) | 20/0 |
| `route.stock-mode` (POST /api/pedidos: F1-A…J + I4-OFF A–F, replay idempotente primero) | 17/0 |
| `negocios/[slug]` disponibilidad pública (mock db) | 6/0 |
| promociones / promocionados / repetir (mock db) | 3/0 · 3/0 · 3/0 |
| `cart-stock-availability` | 13/0 |
| `CartStockWarning` (render) | 2/0 |
| contrato estático I4 | 15/0 |
| business-preview (adaptado) | 23/0 |
| regresión R3A: `stock-lifecycle` 43 · `stock-lifecycle-i3` 32 · `stock-authority` 28 · contrato I1 19 · contrato I2 34 | todas en 0 fallas |
| Mozo: `route.stock` 8 (OFF 99 → 201 intacto) · `route` 8 · `route.variantes` 26 · page 29 | todas en 0 fallas |
| Caja/Inventario: reservations 14 · 19 · `caja-venta` 27 · `inventario` 30 · aviso de AJUSTE 4 | todas en 0 fallas |
| Mesa / Salón / PyR: suites no-DB de `mesa-*`, `negocio-salon-*`, `salon-*` y `pyr-*` | todas en 0 fallas |
| Cliente: `client-product-variants` 14 · contrato 19 · `mesa-checkout-transition` 28 | todas en 0 fallas |

**Mutation check.** Cada mutación se restauró byte a byte desde una copia (`cmp` OK) y cada una hizo fallar los tests diseñados para detectarla:
- quitar el flag OFF de la route → stock-mode 4 fallas;
- publicar productos no visibles → test público 1 falla;
- variantes que ignoran reservas → test de autoridad 1 falla.

**Barrido completo por archivo** (un proceso por archivo, sin credenciales de base):
- 380 archivos, 4383 pass, 211 fail, 72 DB_ENV (igual que el baseline I3: 72).
- Fallas no-DB: las mismas 8 del baseline I3 (`all_tests_i3.tsv`), por nombre y cantidad (clase de portabilidad CRLF y evidencia privada). No se presentan como aprobadas.
- La única diferencia atribuible a I4 fue `business-preview-static-contract` (21/2): patrones literales de la firma vieja. Se adaptó manteniendo la intención (auth incondicional primero; «+» interactivo en preview) → 23/0.

### 6.2 Gates

```text
PRISMA_VALIDATE=PASS (URL placeholder) · PRISMA_SCHEMA_CHANGED=NO · NEW_MIGRATIONS=0
TYPESCRIPT=33 errores = baseline (mismos archivos; 0 nuevos)
ESLINT=PASS (archivos tocados, 0 problemas)
BUILD=PASS (npm run build: prisma generate + next build "Compiled successfully" + copy-standalone-assets)
DIFF_CHECK=PASS
```

### 6.3 No ejecutado (explícito)

```text
REAL_DB_TESTS=NOT_RUN (TESTING DB no autorizada en esta ronda)
  - negocios/[slug]/route.test.ts: expectativas actualizadas estáticamente (stockDisponible; producto sin variantes activas no publicado)
  - repetir/route.test.ts, pedidos/route.test.ts, pedidos/route.variantes.test.ts: sin cambios de expectativa necesarios según el análisis estático
    (ninguna suite real-DB afirma un pedido OFF de negocio genérico por encima del stock controlado); a ejecutar en la integración
MANUAL_SMOKE=NOT_RUN (pertenece al operador, tras la integración a TESTING)
```

## 7. ROADMAP

- Estado de I4 actualizado; las seis decisiones se registran como resueltas.
- **Corrección de alcance del lector de códigos de barras (F9):** el escáner sólo captura el número del código para completar o buscar `codigoBarras` en el catálogo del propio negocio. Quedan fuera de alcance Open Food Facts y cualquier catálogo externo, y el reconocimiento de imágenes. Se mantienen la investigación técnica, la certificación física obligatoria (iPhone Safari/PWA, Android Chrome/PWA) y las 10 funcionalidades futuras, sin implementar nada.
- **Aclaración sobre cantidades fraccionarias:** las columnas son Float, pero eso no alcanza para vender por peso. Faltan la unidad por producto, las conversiones, el precio por unidad de medida y el redondeo, `PedidoItem.cantidad` (Int) y la validación y UI.

## 8. Riesgos, límites y follow-ups

- Con OFF sólo se frena el pedido individual; la sobreventa acumulada necesita ON (I5).
- La lectura pública de disponibilidad es de visualización (fuera de la tx). Entre la carga del catálogo y el checkout puede quedar desactualizada; lo cubren la revalidación antes del checkout y el 409 del servidor.
- Cambio visible para negocios genéricos: un producto con `stock=false`, agotado o sin variantes disponibles **deja de aparecer** (antes se mostraba «Sin stock»). Un deep link `?productoId=` a un producto oculto simplemente no abre el detalle.
- `repetir` agrega al carrito la cantidad histórica de los ítems disponibles. Si supera el disponible, el aviso de carrito desactualizado lo marca y bloquea el checkout al abrir el carrito (sin recorte silencioso).
- Follow-up: A0.1-15 paso 2 (dejar de publicar `stockCantidad` de variantes).
- Hallazgo lateral, registrado y **no** corregido: `promociones` y `promocionados` no filtran `eliminado`.
- Siguen abiertos sin cambios: FOLLOWUP_SALON_TERMINAL_CLOSE_ACCOUNT, cobertura real-DB de líneas repetidas en Caja, rubros no genéricos y gate de rubro del servidor.

## 9. Rollback

`git revert` del commit funcional de I4. No hay schema ni datos que revertir.

## 10. Estado

```text
R3A_I4_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
RESULT=READY_FOR_T56_R3A_I4_TESTING_INTEGRATION_REVIEW
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_I4_TESTING_INTEGRATION_AUTHORIZATION
```
