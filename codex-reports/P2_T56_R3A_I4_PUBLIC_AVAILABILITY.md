# P2-T56-R3A-I4 — Disponibilidad pública y control del carrito

```text
TASK=P2-T56-R3A-I4 (implementación → integración y deploy TESTING §11)
DATE=2026-10-08
BRANCH=work/p2-t56-r3-stock-lifecycle-i4
BASE=testing-codex 7a6d0af6e9326634406b4daeda3da8f545403318 (cierre I3) + cherry-pick del discovery 6e47fcb → a9ed8a47fa97474a9b9ca1c6363f2fa0befc04a6
R3A_I4_STATUS=DEPLOYED_TESTING_MODE_OFF_AWAITING_MANUAL_SMOKE (§11; antes IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION)
SCHEMA_CHANGED=NO · NEW_MIGRATIONS=0
TESTING_CODEX=7a6d0af..dbf342b (fast-forward) · FUNCTIONAL_DEPLOY=6806139e-4348-4b1f-834d-62c3dbdc5934 SUCCESS (commit match)
TESTING_DB_TOUCHED=SI (sólo tests real-DB con fixtures + limpieza autorizada por ID exacto) · MODE_ACTIVATED=NO (OFF) · I5_STARTED=NO · PRODUCTION_TOUCHED=NO
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

## 10. Estado (al cierre de la implementación; superado por §11)

```text
R3A_I4_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION (histórico)
RESULT=READY_FOR_T56_R3A_I4_TESTING_INTEGRATION_REVIEW (histórico)
```

## 11. Integración y despliegue en TESTING (modo OFF) — 2026-10-08

Autorizado por el operador:
- real-DB contra TESTING;
- limpieza controlada de residuos por ID exacto;
- fast-forward de `testing-codex`;
- autodeploy TESTING;
- documentación.

No autorizado: ON/DRAINING, I5, Production.

### 11.1 Preflight y destino

```text
PREFLIGHT=PASS (árbol limpio, sin stash, FF posible 7a6d0af → dbf342b, prisma/ sin cambios)
RAILWAY_TARGET=amiable-rejoicing (49d4d9c7-…) / TESTING (f37d0c49-…) / DeliGO Copy (c6335604-…) / branch testing-codex
TESTING_DB_IDENTITY=verificada por huella (host + credencial): la URL de la app = Postgres TESTING; distinta de Production
DOMINIO_PÚBLICO_TESTING=deligo-copy-production.up.railway.app (el nombre contiene "production", pero es el servicio DeliGO Copy del entorno TESTING)
```

### 11.2 PostgreSQL real de TESTING

**Baseline previa:**
- `stockReservaModo=OFF` (única fila de config), `reservas_stock` = 0 en todos los estados, MovimientoInventario PEDIDO = 0;
- `promocionadosActivos=false`;
- 101 negocios y 19 clientes con prefijo `test-` ya existentes antes de esta ronda.

**A. Harness ad-hoc I4 (17/0).** Archivo del scratchpad, no commiteado. Usa las routes reales de `dbf342b` sin mocks, el prefijo propio `test-i4rdb-` y cleanup completo; no crea reservas y no toca la config. Deltas: 0 en todas las tablas contadas.

| Bloque | Cobertura | Resultado |
|---|---|---|
| A — catálogo | simple con stock / agotado / sin control / `stock=false` / variante con stock / variante agotada / variante inactiva / todas agotadas; `stockDisponible` exacto; contrato previo; aislamiento entre negocios; Restaurante sin cambios; **1 sola lectura `groupBy` por request** (sonda N+1) | 1/1 |
| B — pedidos OFF | dentro del disponible → 201 sin reservas ni descuento ni MovimientoInventario; superior → 409 con `details.lineas` exacto y sin Pedido; agotado → 409 (disponible 0); `stock=false` rechazado; variante (autoridad = variante); líneas repetidas sumadas; rollback completo de pedido mixto; **replay idempotente = mismo Pedido aunque luego el stock baje a 0**; aislamiento; Restaurante/Ropa sin cambios; orden vs. cambio de stock concurrente (resultado 409, sin 5xx ni escritura parcial); límite OFF documentado (3 + 3 sobre 5 → ambos 201) | 11/11 |
| C — Mesa/QR | suficiente → 201 asociado a la mesa; insuficiente → 409 sin Pedido; variante 4 → 409 / 3 → 201 | 3/3 |
| D — repetir | disponible / cantidad histórica > disponible (informa `stockDisponible`) / variante agotada / producto agotado; historial intacto | 1/1 |
| E — `/api/cliente/promociones` | agotados genéricos (base y todas las variantes) no ofrecidos; el negocio sigue visible; Restaurante sin cambios | 1/1 |

Observación lateral (no I4, no corregida): un pedido de Mesa rechazado (409) deja abierta la ocupación de la mesa. Proviene del flujo de ocupación previo, que la abre fuera de la transacción del pedido; el harness la limpió.

**B. Suites existentes (33 archivos, una por proceso, secuenciales): 416 pass / 2 fail.**

| Grupo | Resultado |
|---|---|
| I4 directas | `negocios/[slug]/route.test.ts` **3/0** (actualizada en I4, primera ejecución real) · `repetir/route.test.ts` 5/0 · `pedidos/route.test.ts` 5/0 · `pedidos/route.variantes.test.ts` 9/0 · `order-rate-limit-buckets` (idempotencia) 14/0 |
| Consumidores del catálogo público | `product-gallery-public-render` 1 · `discovery-solo-delivery-coverage` 18 (incluye `promocionados` con fixtures Restaurante) · `category-reorder` 9 · `product-duplication-section-position` 12 · `product-reorder` 7 · `section-product-reorder` 9 · `section-reorder` 6 · `review-moderation-final` 9 · `review-moderation-server` 10 — todas 0 fail |
| Regresiones | Caja 21 · Inventario 13 · endpoint de variantes 6 · CAS de estado 6 · lock ownership 2 · flujo t29b 18 · notificación de delivery 4 · CAS de mesa 3 · cancelación aceptada 4 · auto-cancel 4 · cancelación de mesa 72 · PyR 11 · Salón 30 · cierre de cuenta en terminal 7 · cuenta de cliente en mesa 45 · dark kitchen 16 · device identity 8 — todas 0 fail |
| **Fallas (2)** | `client-block-security` 18/1 · `superadmin-notifications` 11/1 |

```text
REAL_DB_TOTAL_PASS=433 (416 suites + 17 ad-hoc) · REAL_DB_TOTAL_FAIL=2 · P2028 en archivos de suite: 1 (el de denuncias) · errores de init: 0
```

### 11.3 Las dos fallas (clasificación aceptada por el operador)

```text
REGRESSION_TOTAL_FAILURES=2
FAILURES_CLASSIFICATION=NON_I4_TIMEOUTS_WITH_CODE_PATH_EVIDENCE
BASELINE_REPRODUCTION=NOT_RUN
FAILURES_RESOLVED=NO
```

- **SEC-BLOCK-1 (`client-block-security`) — P2028.**
  - La ruta `POST /api/denuncias` usa `db.$transaction` Serializable **sin `timeout`** (default de Prisma: 5 s).
  - La tercera denuncia entra a la rama de bloqueo y ejecuta unas 12 consultas secuenciales contra la base remota. La transacción expiró justo en la última sentencia (`notificacion.createMany` en `superadmin-notifications.ts`), y la respuesta fue 500 en lugar de 201.
- **Test 11 (`superadmin-notifications`) — timeout de 60 s** (`setDefaultTimeout(60_000)` del archivo).
  - Flujo secuencial: 4 creaciones de pedido Restaurante por la route completa, 4 confirmaciones y un abono de deuda.
  - La segunda alerta `negocio_deuda` quedó registrada a las 05:27:31.96, así que el flujo alcanzó su etapa final y sólo se agotó el tiempo; no hubo una aserción fallida.
- **Evidencia de no atribución a I4:**
  - Son idénticos byte a byte en `7a6d0af` y `dbf342b`: denuncias, confirmación del pedido, abono, solicitud de destacado, `superadmin-notifications`, `client-block-security` y `device-identity`.
  - Los imports de la ruta de denuncias no incluyen ningún módulo cambiado por I4.
  - El cuerpo de `aplicarEfectosCancelacion` (lo único que la confirmación usa de `stock-lifecycle`) tiene el mismo hash en ambos commits.
  - Las suites usan negocios Restaurante sin control de stock, así que `useStockTransaction=false` y la línea I4 de la route de pedidos es inerte.
  - Sin cambios de schema.
- No se declaran PASS ni preexistentes demostradas. Follow-ups abiertos:
  - `FOLLOWUP_DENUNCIAS_SERIALIZABLE_TX_DEFAULT_TIMEOUT_P2028`;
  - `FOLLOWUP_SUPERADMIN_NOTIFICATIONS_TEST11_TIMEOUT`;
  - `FOLLOWUP_REAL_DB_SUITES_AUXILIARY_TABLE_CLEANUP` (las suites no limpian `notificacion`, `sesion` ni `auditLog`).

### 11.4 Residuos y limpieza controlada

- **Tablas principales:** residuo 0 (negocio, producto, variante, pedido, ítem, evento, venta, movimientos, mesa, ocupaciones). Reservas 0 y PEDIDO 0 antes y después.
- **18 clientes de prueba eliminados por las suites** (35 → 17; `test-` 19 → 1; no-test 16 → 16). Las suites borran clientes sólo por su propio prefijo (`test-sec-block-1-`, `test-sec-device-1-`, …) o por los IDs que crearon; eran remanentes de corridas anteriores. Sus IDs ya no pueden listarse. El único cliente `test-` restante (section-reorder-atomicity) no se tocó.
- **Residuos en tablas auxiliares**, todos dentro de la ventana de una sola suite (04:41:14–05:27:46 UTC; 0 ambiguos, 0 fuera de ventana):
  - `notificacion` +121: 111 de dueños fixture inexistentes, más **10 del único superadmin existente** que apuntan a entidades de prueba inexistentes (6 `denuncia_nueva`, 2 `negocio_deuda`, 1 `negocio_pendiente`, 1 `destacado_solicitud`);
  - `sesion` +13 (dueños inexistentes);
  - `auditLog` +92 (dueños inexistentes).
- **Limpieza autorizada (2026-10-08):**
  - Validación READ-ONLY individual: el ID existe, figura en el listado, no cambió desde el diagnóstico, cae dentro de la ventana de una sola suite, y su dueño no existe (o, para el superadmin: tipo esperado, ventana de las dos suites de superadmin y entidad inexistente). Resultado: 121 + 13 elegibles, 0 problemas.
  - Una transacción revalidó todo adentro, borró **sólo esos IDs exactos** y verificó los conteos (cualquier diferencia = rollback).

```text
NOTIFICATION_IDS_VERIFIED=121 · NOTIFICATIONS_DELETED=121 · SUPERADMIN_TEST_NOTIFICATIONS_DELETED=10
SESSION_IDS_VERIFIED=13 · SESSIONS_DELETED=13
AUDIT_LOG_DELETED=0 (las 92 filas siguen presentes; auditLog 4430 = 4430)
POST_CLEANUP=notificacion 14245 y sesion 997 (= valores previos al batch); 0 de los IDs listados presentes; ninguna otra tabla cambió; modo OFF
UNAUTHORIZED_ROWS_CHANGED=0
EVIDENCIA (scratchpad de la sesión)=residue_ids_notificacion.tsv · residue_ids_sesion.tsv · residue_ids_auditlog.tsv · residue_listing_i4.json · suite_windows.tsv · cleanup_validation_i4.json · cleanup_result_i4.json · metrics_*.json
```

### 11.5 Integración y deploy

```text
SAFETY_REF=tag anotado local r3a-i4-pre-integration-testing-codex → 7a6d0af6e9326634406b4daeda3da8f545403318 (no publicado)
INTEGRATION_TYPE=FAST_FORWARD · testing-codex 7a6d0af..dbf342b (2 commits: a9ed8a4 discovery docs + dbf342b I4) · push sólo origin/testing-codex · origin/main sin cambios
FUNCTIONAL_DEPLOY=Railway TESTING / DeliGO Copy 6806139e-4348-4b1f-834d-62c3dbdc5934 SUCCESS · branch testing-codex · commit dbf342b2ef428c3730292428e9ca749757cd181e (COMMIT_MATCH=YES)
MIGRATIONS=38 encontradas · "No pending migrations to apply." · NEW_MIGRATIONS=0
BUILD_LOG="Compiled successfully" · RUNTIME_LOG="Ready"; 0 líneas de error/excepción/fatal (antes y después del smoke HTTP)
HTTP_SMOKE=PASS_NO_5XX (/ 307 · /cliente 200 · /login 200 · /api/negocios 200 · /api/negocios/promocionados 200 · slug inexistente 404 · APIs protegidas 401: /api/cliente/promociones, /api/negocio/caja/ventas, /api/negocio/inventario/movimientos, /api/cliente/pedidos, /api/negocio/pedidos · catálogo de un negocio genérico 200 con stockDisponible en todos los productos y sin stockCantidad base)
STOCK_MODE_AFTER=OFF · reservas 0 · MovimientoInventario PEDIDO 0
PRODUCTION=origin/main 42ca500 · production/DeliGO 6bf1ee84 SUCCESS @ 42ca500 (sin cambios)
ROLLBACK=git revert de dbf342b (y a9ed8a4 si corresponde) en testing-codex → autodeploy; sin schema ni datos que revertir. Referencia: r3a-i4-pre-integration-testing-codex
```

### 11.6 Gates

- **Re-ejecutado:** diff-check del rango `7a6d0af..dbf342b`.
- **Reutilizado** (árbol idéntico al de `dbf342b`, §6.2): Prisma, tsc 33 = baseline (0 nuevos), ESLint, build y barrido.

### 11.7 No realizado / limitaciones

- La resta de reservas ACTIVA no se probó contra filas reales: no se fabrican reservas y TESTING tiene 0. Queda cubierta por mocks y por el fake.
- El filtro de agotados genéricos en `promocionados` sólo está cubierto por mocks: el flag global `promocionadosActivos` está en false y no se cambió.
- Reproducción baseline de las 2 fallas: no ejecutada.
- OFF no impide la sobreventa acumulada entre pedidos (requiere ON, I5).

### 11.8 Smoke manual del operador (pendiente)

Negocio genérico de TESTING. Modo OFF: no cambiarlo.

**Datos a preparar** (Inventario):
- A: producto simple con control de stock y 2 unidades;
- B: producto con control de stock y 0 unidades;
- C: producto con dos variantes, una con 0 y otra con 2.

| # | Escenario | Qué hacer | Esperado |
|---|---|---|---|
| 1 | Producto agotado | Buscar B en el catálogo público (Cliente). | B no aparece en catálogo, búsqueda ni secciones; A sí. |
| 2 | Variantes | Abrir C. | Sólo se ofrece la variante con unidades. Con ambas en 0, C desaparece. |
| 3 | Límite del carrito | Subir A en el detalle y en el carrito, también con dos líneas de A con distintas opciones. | No se superan 2 en total. Mensaje «No hay suficientes unidades disponibles», sin mostrar cantidades. |
| 4 | Carrito desactualizado | Con A×2 en el carrito, bajar A a 1 desde Inventario y reabrir el carrito. | Aviso «Tu carrito necesita cambios» que nombra A; «Continuar» bloqueado; el carrito no se modifica solo. |
| 5 | Rechazo por stock | Con A×2 en el paso de confirmación, bajar A a 1 y confirmar. | No se crea el pedido. Mensaje que identifica A (revalidación previa al envío o 409 del servidor), vuelta a la lista, carrito intacto. |
| 6 | Mesa/QR o promociones | Pedido desde el QR de una mesa con la cantidad disponible; producto en promoción agotado. | El pedido de mesa se crea (y se rechaza si supera el disponible). El agotado no figura en promociones; el negocio sigue visible. |

Con OFF, dos pedidos distintos que individualmente caben pueden sumar más que el stock: es el límite conocido de OFF y no es un fallo del smoke.

## 12. Estado actual

```text
R3A_I4_STATUS=DEPLOYED_TESTING_MODE_OFF_AWAITING_MANUAL_SMOKE
RESULT=T56_R3A_I4_DEPLOYED_TESTING_AWAITING_MANUAL_SMOKE
MANUAL_SMOKE_STATUS=PENDING_OPERATOR
R3A_I5_STARTED=NO · MODE_ACTIVATED=NO · PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_I4_MANUAL_SMOKE
```
