# P2-T56-R3A-I2 — Reserva / consumo / liberación de stock (runtime) + tag de seguridad previo

Fecha: 2026-10-05
Branch: `work/p2-t56-r3-stock-lifecycle-i2` (base `testing-codex` = `cc628e0c4cb374d4e99f1432db8887d89eec3b0b`)
Autoridad de arquitectura: `codex-reports/P2_T56_R3A_ORDER_STOCK_LIFECYCLE_DESIGN.md` § A0.1
Base I1: `codex-reports/P2_T56_R3A_I1_STOCK_FOUNDATION.md` (§13 = I1 CLOSED_TESTING_VERIFIED)

```text
R3A_I2_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
RESULT=READY_FOR_T56_R3A_I2_TESTING_INTEGRATION_REVIEW
MODE_ACTIVATED=NO (ConfigPlataforma.stockReservaModo no se escribe en ningún archivo; TESTING sigue en OFF)
R3A_I3_STARTED=NO
TESTING_DB_TOUCHED=NO · RAILWAY_TOUCHED=NO · PRODUCTION_TOUCHED=NO · TESTING_CODEX_TOUCHED=NO
```

## 1. Tag de seguridad previo

| Campo | Valor |
|---|---|
| Tag | `r3a-i1-testing-verified` (anotado) |
| Objeto del tag | `09d306e24bc046201eb3abfda494759adefdace7` |
| Apunta a (`^{}`) | `cc628e0c4cb374d4e99f1432db8887d89eec3b0b` (`docs: close T56 R3A I1 testing verification`) |
| Estado | `CREATED_AND_PUSHED` (no existía antes; no se movió ni se forzó) |
| Re-verificado al cierre | `git ls-remote` → `^{}` = `cc628e0…` → `SAFETY_TAG_STILL_CORRECT=YES` |

Es el punto de rollback de código si I2 se integra y hay que volver al estado I1 verificado.

## 2. Preflight

- Carpeta física única `C:\Leo Campos\Trabajo\deligo-main-limpio`, sin worktree.
- `origin/testing-codex` = `cc628e0…` (= tag), `origin/main` = `42ca5005d2ecd412de87e454b52820f38aaec5c0`.
- Árbol trackeado limpio, stash vacío, baseline untracked registrado antes de I2.
- Branch `work/p2-t56-r3-stock-lifecycle-i2` creada desde `testing-codex`.

## 3. Auditoría previa (sin contradicción material con A0.1)

| Superficie | Conteo confirmado en código | Notas |
|---|---|---|
| Creadores productivos de `Pedido` | **2** | `POST /api/pedidos` (Cliente/Mesa) y `POST /api/operativo/mozo/panel/[slug]/pedidos` (Mozo). Scripts = dev/legacy, fuera del runtime. |
| Escritores de `estado: "preparando"` | **6** | `negocio/pedidos` (PUT mesa), `negocio/pedidos/[id]/estado`, `operaciones/pyr/pedidos/[id]/estado`, `operaciones/salon/pedidos/[id]/estado`, `operativo/pyr/pedidos/[id]/preparar`, `operativo/salon/pedidos/[id]/preparar`. El resto de los `updateMany` sólo salen de `preparando` o tocan campos de chat/cliente. |
| Sitios de cancelación | **6** | `cliente/pedidos/[id]`, `negocio/pedidos/[id]/estado`, `negocio/pedidos` (PUT mesa), `operaciones/pyr/pedidos/[id]/estado`, `repartidor/pedidos/auto-cancel`, `src/lib/mesa-pedido-cancelacion.ts`. El route de estado de Operaciones Salón no puede cancelar (sus destinos salen de `ACTIVE_FORWARD_TRANSITIONS.mesa`). |
| Consumidores del formato de `PedidoItem.id` | 0 dependientes del formato | `UUID_COMPATIBILITY=YES` → ids pre-generados con `randomUUID()`. |

`SCHEMA_CHANGE_REQUIRED=NO`: todo lo necesario (ReservaStock, `MovimientoInventario.pedidoId`, `stockReservaModo`) ya existe desde I1.

## 4. Autoridad runtime — `src/lib/stock-lifecycle.ts` (nuevo)

Único archivo productivo que toca `db.reservaStock` (guard estático + allowlist I1).

- **Errores tipados** (`StockLifecycleError(code, status)`):
  - `StockInsufficientError` → 409 `STOCK_INSUFFICIENT` (con claves producto/variante);
  - `StockReservationsDrainingError` → 409 (no se crean reservas nuevas en DRAINING);
  - `StockReservationModeInvalidError` → **503** `STOCK_RESERVATION_MODE_INVALID` (fail-closed, nunca cae a OFF);
  - `StockReservationDeficitError` → 409 (físico < reservado al consumir);
  - `StockReservationIntegrityError` → 409 `STOCK_RESERVATION_CONFLICT`.
- **Serializable con retry acotado:**
  - `runStockSerializable(client, fn)` abre `$transaction` con `isolationLevel: Serializable`;
  - reintenta sólo ante P2034, con `STOCK_SERIALIZABLE_MAX_ATTEMPTS = 3`, y después relanza el último P2034;
  - `mapStockLifecycleError` traduce P2034 a 409 `STOCK_SERIALIZATION_CONFLICT`.
- **`readStockReservationMode`** lee `configPlataforma.stockReservaModo` (clave `PLATFORM_CONFIG_KEY`) con `parseStockReservationMode` de I1. Fila ausente o valor inválido → 503.
- **Reserva** (`planificarReservaStockPedido` + `reservarStockPedido`):
  - modo OFF → `{reservar:false}`; modo DRAINING → error;
  - modo ON:
    1. agrega las líneas controladas por clave (productoId, productoVarianteId);
    2. recarga la autoridad fresca dentro de la tx: la variante se acota vía `producto.negocioId`, el base por `negocioId`;
    3. omite las claves cuyo `controlStock` fresco es false;
    4. suma las ACTIVA con `aggregate` y valida `físico − reservado ≥ pedido`;
    5. después del `pedido.create`, `createMany` de filas ACTIVA mapeadas a `PedidoItem.id`, verificando el conteo.
- **Consumo** (`transicionarAPreparandoConStock` → `consumirReservasPedido`):
  - CAS `updateMany` con `{...casWhere, id, negocioId}`; si pierde el CAS, `{won:false}` y no consume nada;
  - si gana, consume las ACTIVA del pedido:
    - reserva huérfana (`productoId` null) o autoridad faltante → LIBERADA `PRODUCTO_ELIMINADO`, sin movimiento;
    - `controlStock` desactivado después de reservar → CONSUMIDA sin descuento;
    - en el resto, por clave: chequeo de déficit, `resolveNextStock(..., PEDIDO, total)`, update de `stockCantidad` y un `MovimientoInventario` tipo `PEDIDO` con motivo `Pedido → preparando` y `pedidoId`;
  - las filas pasan a CONSUMIDA con `consumidaEn` (conteo verificado).
- **Liberación** (`aplicarEfectosCancelacion` → `revertirTarifaSiCorresponde` + `liberarReservasPedido`):
  - deuda y liberación siempre juntas, en la misma tx;
  - ACTIVA → LIBERADA con `motivoLiberacion` por actor: `CANCELADO_CLIENTE` / `CANCELADO_VENDEDOR` / `CANCELADO_SISTEMA` / `CANCELADO_MESA`;
  - las CONSUMIDA no se tocan (`NO_AUTOMATIC_RESTOCK_AFTER_CONSUMPTION`).
- **`contarReservasActivasProducto`** alimenta el guard de borrado de producto.

`src/lib/inventario.ts`: `resolveNextStock` acepta `MovimientoTipoPersistible` (PEDIDO resta). `MOVIMIENTO_TIPOS` (lista manual) no cambia: el POST manual de movimientos sigue rechazando PEDIDO.

## 5. Wiring

```text
ORDER_CREATION_WIRING=2/2
PREPARANDO_WIRING=6/6
CANCELLATION_WIRING=6/6
PRODUCT_DELETE_GUARD=IMPLEMENTED (409 PRODUCT_HAS_ACTIVE_RESERVATIONS antes de los deletes de junction y del hard delete)
```

- **`POST /api/pedidos`:**
  - `ValidatedPedidoItem` suma `id` (`randomUUID()`) y `stockControlled` (el de la variante si hay variante, si no el del producto); `items.create` persiste `id: item.id`.
  - El cuerpo transaccional se extrajo a `createPedidoInTx(tx)`. El orden es: idempotencia → ocupación/revalidación Salón → plan de stock → update cliente → `pedido.create` → `reservarStockPedido`.
  - El runner es `useStockTransaction ? runStockSerializable(db, createPedidoInTx) : db.$transaction(createPedidoInTx)`, con `useStockTransaction = isGenericBusinessStockScope(rubro) && hay líneas controladas && modo !== "OFF"`. **— SUPERSEDED por I2-F1 (§12):** la condición `&& modo !== "OFF"` (lectura exterior) se eliminó; ahora `useStockTransaction = isGenericBusinessStockScope(rubro) && hay líneas controladas`, y el modo se lee sólo dentro de la tx.
- **Mozo:**
  - el retry local `withSerializableRetry` / `SERIALIZATION_RETRY_LIMIT` se reemplazó por `runStockSerializable` (ya era Serializable);
  - items con `randomUUID()`; el select de negocio suma `rubro`;
  - el plan va después del heartbeat de ocupación; la reserva va después del create y antes del auditLog;
  - P2034 conserva su mensaje 409 previo.
- **Los 6 escritores de `preparando`:**
  - todos usan `runStockSerializable(db, (tx) => transicionarAPreparandoConStock(tx, {..., data: { estado: "preparando" }}))` y mapean los errores de stock;
  - los 4 genéricos ramifican `if (estado === "preparando")` antes del CAS plano;
  - los 2 `preparar` usan su CAS específico: PyR `{metodoEntrega: {not: "mesa"}, estado: CANONICAL_ACCEPTED_STATE}`, Salón `{metodoEntrega: "mesa", estado: "recibido"}`.
- **Los 6 sitios de cancelación** llaman `aplicarEfectosCancelacion(tx, …)`; ya no queda ningún `revertirTarifaSiCorresponde` directo fuera de la autoridad. `DeudaReversionError` se mantiene donde ya se manejaba.

## 6. Refinamientos de diseño (documentados, sin rediseño)

1. **Idempotencia antes del stock:** un replay idempotente válido nunca se rechaza por falta de stock. El precheck de idempotencia corre antes de planificar (orden A0.1-3 refinado).
2. ~~**OFF por pre-lectura en `POST /api/pedidos`:**~~ — **SUPERSEDED por I2-F1 (§12).** El texto original queda como historia:
   - ~~con OFF (detectado fuera de la tx), restaurante/ropa, o sin líneas controladas, la transacción y la isolation originales quedan idénticas;~~
   - ~~ON / DRAINING / inválido van al camino Serializable, que vuelve a leer el modo dentro de la tx y por eso no hay carrera con un cambio de modo;~~
   - Mozo lee el modo dentro de su transacción Serializable ya existente (sigue vigente).

   La afirmación "no hay carrera" era falsa para el caso OFF. Un OFF leído afuera elegía el runner legacy, y si otra tx activaba ON entre esa lectura y el commit, el pedido se confirmaba sin reserva. Desde I2-F1, negocio genérico + línea controlada corre siempre Serializable, y la única lectura del modo es la interior. Restaurante, ropa y los pedidos sin líneas controladas conservan la transacción original.
3. **`controlStock` desactivado tras reservar:** la reserva se consume sin descuento.
4. **Reserva huérfana o autoridad borrada:** se libera con `PRODUCTO_ELIMINADO`, sin movimiento.
5. **Modo inválido → 503 fail-closed** en creación, consumo y cancelación cuando se requiere la autoridad.

## 7. Tests y gates (ejecutados en esta ronda)

| Gate | Resultado |
|---|---|
| `src/lib/stock-lifecycle.test.ts` (nuevo; fake Prisma en memoria con rollback por snapshot y registro de isolation) | **35/35** — I2-A…I2-AF a nivel helper |
| `route.stock.test.ts` Mozo (nuevo; route real, db mockeada) | **8/8** — OFF / ON / variante / insuficiente / DRAINING / inválido / restaurante-ropa / sin líneas controladas; ids UUID + Serializable |
| `route.delete-guard.test.ts` producto (nuevo) | **3/3** — I2-AC / scope del conteo / I2-AD |
| `p2-t56-r3a-i2-wiring-static-contract.test.ts` (nuevo) | **22/22** — 2+6+6 positivos y detectores de bypass (creadores, `preparando`, `revertirTarifa`, `canceladoFecha`), guard, PEDIDO system-only, ningún escritor de `stockReservaModo`, ningún `.reservaStock.` fuera de la autoridad |
| `order-transitions-authority` PyR / Salón (mock + `reservaStock` y `$transaction`) | **13/13 · 6/6** |
| `negocio-salon-static-contract` (ancla → `createPedidoInTx`, ambos runners) | **26/26** |
| `p2-t56-r3a-i1-schema-migration-contract` (guards runtime → allowlist exacta I2) | **19/19** |
| Regresión: `stock-authority` 28, `inventario` 30, `caja-venta` 27, Mozo `route` 8 + `route.variantes` 26 + `payment-timing` 13, página Mozo 29 + 8 | PASS |
| **`MODE_OFF_BEHAVIOR_REGRESSION`** | **PASS** (I2-OFF en helper + route Mozo; en `POST /api/pedidos` el runner original quedaba con OFF — corregido por I2-F1 §12: OFF controlado = Serializable sin reserva) |
| Barrido completo (cada archivo en su propio proceso; 366 archivos) | 4206 pass / 209 fail. Las fallas: 72 archivos `DB_ENV` (requieren DB real, sin credenciales en esta ronda, así que no corrieron) más 8 archivos no-DB **ajenos a I2** (ver abajo) |
| ESLint (23 archivos nuevos/tocados) | PASS (exit 0) |
| TypeScript | 33 errores = baseline idéntico, **0 nuevos** |
| Prisma validate / generate | PASS; `PRISMA_DIFF_FILES=0`; `NEW_MIGRATIONS=0` (última migración sigue siendo la de I1) |
| Build (`npm run build`) | **PASS** en el 2.º intento: prisma generate, `Compiled successfully`, 160/160 páginas, copy-assets. El 1.er intento falló con 35 errores de descarga de Google Fonts (`next/font/google` → `fonts.gstatic.com`, `src/app/layout.tsx`): un problema de red/entorno, sin relación con I2, y corría en paralelo con el barrido de tests. |
| `git diff --check` | PASS |

**Fallas no-DB ajenas a I2:** `catalog-tutorial-static-contract`, `product-variant-editor-ux-static-contract`, `product-variants-static-contract`, `use-push-notifications-static-contract`, `operativo-logout-wiring-static-contract`, `password-hash-workfactor-wiring-static-contract`, `session-login-atomicity-wiring-static-contract` y `private-evidence-storage.integration`.
- Ninguno lee archivos del diff de I2 (componentes UI, hooks, auth y storage sin cambios: `git diff` sobre esas rutas = 0 archivos).
- Las aserciones inspeccionadas fallan sobre contenido CRLF del working copy Windows, una clase de portabilidad ya documentada en `CATALOG_PRODUCTION_PROMOTION_GATE_REVERIFY_R1.md`.
- No hay corrida baseline sobre `cc628e0` en esta ronda (sin stash, por regla). La clasificación sale del aislamiento del diff, no de una comparación ejecutada.
- Clasificación precisa (I2-F1): `OUTSIDE_I2_DIFF_CRLF_PORTABILITY_SUSPECTED_BASELINE_NOT_EXECUTED`. **No** se afirma que sean preexistentes.

```text
REAL_DB_CONCURRENCY_TESTS=DEFERRED_TO_I2_TESTING_INTEGRATION
```

La concurrencia SSI real (dos pedidos compitiendo por la última unidad, la carrera CAS de `preparando` y la cancelación concurrente con el consumo) y las suites real-DB existentes (`pedidos/route.test.ts`, `auto-cancel`, `order-transition-cas-*`, etc.) requieren la TESTING DB, que esta ronda no autoriza. Corresponden a la integración I2 en TESTING, con el modo todavía OFF, y a una prueba ON controlada sólo si el operador la autoriza.

## 8. Archivos

**Nuevos (6):**
- `src/lib/stock-lifecycle.ts`
- `src/lib/stock-lifecycle.test.ts`
- `src/lib/stock-lifecycle-test-fake.ts`
- `src/lib/p2-t56-r3a-i2-wiring-static-contract.test.ts`
- `src/app/api/operativo/mozo/panel/[slug]/pedidos/route.stock.test.ts`
- `src/app/api/negocio/productos/[id]/route.delete-guard.test.ts`

**Modificados (17):**
- Creación (2): `api/pedidos/route.ts`, `api/operativo/mozo/panel/[slug]/pedidos/route.ts`
- Escritores de `preparando` (6): `api/negocio/pedidos/route.ts`, `api/negocio/pedidos/[id]/estado/route.ts`, `api/operaciones/pyr/pedidos/[id]/estado/route.ts`, `api/operaciones/salon/pedidos/[id]/estado/route.ts`, `api/operativo/pyr/pedidos/[id]/preparar/route.ts`, `api/operativo/salon/pedidos/[id]/preparar/route.ts`
- Cancelación (adicionales a los anteriores, 3): `api/cliente/pedidos/[id]/route.ts`, `api/repartidor/pedidos/auto-cancel/route.ts`, `src/lib/mesa-pedido-cancelacion.ts`
- Guard: `api/negocio/productos/[id]/route.ts`
- Autoridad compartida: `src/lib/inventario.ts`
- Tests (4): ambos `order-transitions-authority.test.ts`, `negocio-salon-static-contract.test.ts`, `p2-t56-r3a-i1-schema-migration-contract.test.ts`

**Docs:**
- este reporte;
- `CODEX_REPORT.md` y `codex-reports/ROADMAP.md`;
- `DELIGO_FULL_CONTEXT_LATEST.md`, actualizado y sin trackear.

`UNRELATED_FILES=0` · `prisma/` sin cambios · archivo `32` intacto.

## 9. Rollback

- **Código:** revertir el commit I2, o volver a `r3a-i1-testing-verified` (`cc628e0`).
- **Schema:** I2 no tiene migración, así que no hay nada que deshacer.
- **Mientras el modo esté OFF**, I2 es inerte para el stock:
  - no se crean ni consumen reservas;
  - lo único que cambia son los ids UUID pre-generados de `PedidoItem`;
  - la cancelación ejecuta `liberar`, que no actualiza ninguna fila si no hay ACTIVA.

## 10. Hallazgos laterales (abiertos, OUT_OF_SCOPE)

- El fingerprint de idempotencia de Cliente no incluye `varianteId`.
- El panel PyR no muestra variantes.
- El hard delete de producto arrastra en cascada el historial de `MovimientoInventario`.
- Las APIs de inventario no tienen gate de rubro server-side.

## 11. Markers (I2 inicial, commit 0e3b2a3 — markers current en §12)

```text
SAFETY_TAG=r3a-i1-testing-verified → cc628e0c4cb374d4e99f1432db8887d89eec3b0b (CREATED_AND_PUSHED; SAFETY_TAG_STILL_CORRECT=YES)
ORDER_CREATION_WIRING=2/2
PREPARANDO_WIRING=6/6
CANCELLATION_WIRING=6/6
MODE_OFF_BEHAVIOR_REGRESSION=PASS
MODE_ACTIVATED=NO
REAL_DB_CONCURRENCY_TESTS=DEFERRED_TO_I2_TESTING_INTEGRATION
SCHEMA_CHANGE_REQUIRED=NO
NEW_MIGRATIONS=0
NEW_TYPESCRIPT_ERRORS=0
ESLINT_GATE=PASS
BUILD_GATE=PASS (2nd attempt; 1st = Google Fonts network fetch failure, unrelated)
DIFF_CHECK=PASS
UNRELATED_FILES=0
R3A_I2_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
R3A_I3_STARTED=NO
TESTING_DB_TOUCHED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_R3A_I2_TESTING_INTEGRATION_AUTHORIZATION
```

TESTING **no** ejecuta I2: `testing-codex` sigue en `cc628e0`. I2 vive sólo en la branch dedicada.

## 12. I2-F1 — hardening de la carrera OFF→ON antes de integrar (2026-10-06)

Branch `work/p2-t56-r3-stock-lifecycle-i2`, sobre `0e3b2a3` (I2). Commit: `fix: serialize T56 R3A stock mode reads`. Sin integración, sin Railway, sin TESTING DB, sin Production, modo sin tocar.

### Hallazgo

```text
I2_F1_MODE_RACE_FOUND=OUTER_OFF_PREREAD_COULD_BYPASS_FUTURE_OFF_TO_ON_ACTIVATION
ROOT_CAUSE=OFF_MODE_WAS_USED_OUTSIDE_TRANSACTION_TO_SELECT_NON_SERIALIZABLE_RUNNER
```

La auditoría read-only del código real de `0e3b2a3` confirmó lo documentado en §5/§6:
- `useStockTransaction = needsStockAuthority && (await readStockReservationMode(db)) !== "OFF"`;
- con OFF, el runner era `db.$transaction(createPedidoInTx)`; con ON / DRAINING / inválido, `runStockSerializable`.

```text
CURRENT_GENERIC_CONTROLLED_RUNNER_SELECTION (pre-F1)=OUTER_MODE_PREREAD_OFF→LEGACY / ELSE→SERIALIZABLE
MODE_PREREAD_LOCATION (pre-F1)=src/app/api/pedidos/route.ts, fuera de la tx (readStockReservationMode(db))
MODE_AUTHORITATIVE_READ_LOCATION=planificarReservaStockPedido → readStockReservationMode(tx), dentro de la tx
```

El problema: una request lee OFF afuera, otra tx cambia el modo de OFF a ON, y la request original confirma un pedido sin reserva cuando ON ya está activo. Eso viola la atomicidad modo/reserva de A0.1 (pasos 1–6: abrir Serializable → leer el modo adentro → decidir).

### Corrección

En `src/app/api/pedidos/route.ts`:
- `useStockTransaction = isGenericBusinessStockScope(negocio.rubro) && stockLines.some((line) => line.controlStock)`;
- se eliminaron la prelectura exterior y el import de `readStockReservationMode`;
- `planificarReservaStockPedido(tx, …)`, sin cambios, ya leía el modo dentro de la tx y decide:
  - OFF → `{reservar:false}`;
  - DRAINING → 409;
  - ON → disponible + reserva;
  - inválido → 503.

```text
GENERIC_CONTROLLED_ALWAYS_SERIALIZABLE=YES
MODE_AUTHORITATIVE_READ=INSIDE_TRANSACTION
OUTER_MODE_READ_AUTHORITATIVE=NO (no queda ninguna lectura exterior: la única lectura productiva del modo en src/ es readStockReservationMode(tx) dentro de planificarReservaStockPedido)
OFF_CONTROLLED_ORDER_BEHAVIOR=SERIALIZABLE_NO_RESERVATION (sin validación nueva de disponible, sin MovimientoInventario al crear)
ON_CONTROLLED_ORDER_BEHAVIOR=SERIALIZABLE_WITH_RESERVATION
DRAINING_CONTROLLED_ORDER_BEHAVIOR=SERIALIZABLE_409 (STOCK_RESERVATIONS_DRAINING)
INVALID_MODE_BEHAVIOR=SERIALIZABLE_FAIL_CLOSED_503 (STOCK_RESERVATION_MODE_INVALID)
NON_GENERIC_RUNNER_UNCHANGED=YES (restaurante/ropa → db.$transaction original)
NO_CONTROLLED_LINES_RUNNER_UNCHANGED=YES
```

Mozo no cambió: ya planificaba con el `tx` de su transacción Serializable y no tenía ninguna lectura exterior.

**Idempotencia:** sin rediseño. El precheck dentro de la tx sigue antes del plan (un replay válido devuelve el Pedido existente sin crear otra reserva), y el manejo de P2002, el fingerprint, el rollback y `createPedidoInTx` quedan intactos. `CLIENT_IDEMPOTENCY_FINGERPRINT_MISSING_VARIANTE_ID` sigue OUT_OF_SCOPE: F1 no produce ningún problema de integridad nuevo.

**Efecto colateral aceptado (diseño A0.1):** un pedido de negocio genérico con línea controlada en modo OFF ahora puede recibir P2034. Se reintenta hasta 3 veces y después devuelve 409 `STOCK_SERIALIZATION_CONFLICT`.

### Tests (ejecutados)

`src/app/api/pedidos/route.stock-mode.test.ts` (nuevo, route real con db en memoria, `tx` ≠ `db`, modo exterior/hint vs. modo interior/autoridad): **11/11**.

| Caso | Qué prueba |
|---|---|
| F1-A | OFF → Serializable |
| F1-B | OFF → Pedido creado, 0 ReservaStock, stock intacto |
| F1-C | 1 lectura interior, 0 exteriores |
| F1-E | hint OFF + autoridad ON → reserva creada |
| F1-E inverso | autoridad ON sin disponible → 409 aunque el hint diga OFF |
| F1-F | DRAINING interior → 409 |
| F1-G | modo interior inválido → 503 |
| Idempotencia | replay con ON → 200, mismo Pedido, 1 sola reserva |
| F1-H / F1-I | restaurante / ropa con controlStock → legacy (sin isolationLevel), 0 lecturas de modo |
| F1-J | negocio sin líneas controladas → legacy |

- **Mutation check:** el mismo archivo corrido contra el route pre-F1 (copiado temporalmente desde `HEAD` y vuelto a dejar idéntico, verificado con `cmp`) da **7 fail**: F1-A, F1-C, F1-E ×2, F1-F, F1-G e idempotencia. Los tests detectan el bug.
- **F1-K:** Mozo `route.stock` 8/8, `route` 8/8, `route.variantes` 26/26, `payment-timing` 13/13.
- **F1-D / contrato estático** (`p2-t56-r3a-i2-wiring-static-contract.test.ts`, 23/23):
  - se reemplazó la aserción vieja (`needsStockAuthority && … !== "OFF"`) por `GENERIC_CONTROLLED_ALWAYS_SERIALIZABLE`: el runner depende sólo de rubro + líneas controladas, y el route no contiene `=== "OFF"` / `!== "OFF"`, ni `readStockReservationMode`, `stockReservaModo` o `configPlataforma`;
  - se agregó `MODE_READ_INSIDE_STOCK_TX`: el único lector productivo es la autoridad, la única llamada es `readStockReservationMode(tx)` dentro de `planificarReservaStockPedido`, y ambos creadores planifican con `tx`.
- **Regresión:**
  - `stock-lifecycle` 35, I1 contract 19, `order-transitions-authority` PyR 13 / Salón 6, `negocio-salon` contract 26;
  - `stock-authority` 28, `inventario` 30, `caja-venta` 27, delete-guard 3;
  - P0/F1: página Mozo 29 + `variantes-static` 8, `mozo-order-item-key` 6, F1 display contract 19, `pedido-item-variante` 6, ticket variante 6;
  - otros que leen el route sin DB: `client-account-deletion` 43, `platform-settings` 5, `product-own-sections-pricing` 10.
  - Todo PASS.
- **Suites de `POST /api/pedidos` que requieren DB** (`route.test`, `route.variantes`, `order-rate-limit-buckets.integration`, `negocio-salon.test`, etc.): `DB_ENV`, no corridas.

```text
REAL_DB_CONCURRENCY_TESTS=DEFERRED_TO_I2_TESTING_INTEGRATION
FULL_SWEEP_NON_DB_FAILURE_CLASSIFICATION=OUTSIDE_I2_DIFF_CRLF_PORTABILITY_SUSPECTED_BASELINE_NOT_EXECUTED (barrido de la ronda I2; F1 no toca esos archivos)
```

### Gates (ejecutados)

| Gate | Resultado |
|---|---|
| Prisma validate | PASS ("schema is valid", con un `DATABASE_URL` placeholder sólo para el parseo, sin conexión; sin él falla P1012 por la variable ausente) |
| Prisma generate | PASS |
| Schema / migraciones | `PRISMA_DIFF_FILES=0`; untracked de `prisma/` = sólo `migration_lock.toml` del baseline → `SCHEMA_CHANGE_REQUIRED=NO`, `NEW_MIGRATIONS=0` |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit`: 33 errores = mismo set que I2 → 0 nuevos. `npx tsc` resolvía un paquete equivocado: ese intento se descartó, no se contó |
| ESLint (3 archivos tocados) | PASS |
| `npm run build` | PASS en el 1.er intento: compilación correcta, 160/160 páginas, copy-assets |
| `git diff --check` | PASS |

### Archivos

- `I2_F1_ORDER_CREATION`: `src/app/api/pedidos/route.ts`
- `I2_F1_TEST`: `src/app/api/pedidos/route.stock-mode.test.ts` (nuevo) y `src/lib/p2-t56-r3a-i2-wiring-static-contract.test.ts`
- `I2_F1_DOCUMENTATION`: este reporte, `CODEX_REPORT.md`, `codex-reports/ROADMAP.md` y `DELIGO_FULL_CONTEXT_LATEST.md` (trackeado según la práctica vigente)
- `UNRELATED_FILES=0`. Sin cambios en schema, migraciones, Caja, Inventario, UI ni I3.

### Markers (I2-F1, branch — estado current en §13)

```text
R3A_I2_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
GENERIC_CONTROLLED_ALWAYS_SERIALIZABLE=YES
MODE_AUTHORITATIVE_READ=INSIDE_TRANSACTION
OUTER_MODE_READ_AUTHORITATIVE=NO
MODE_ACTIVATED=NO
SCHEMA_CHANGE_REQUIRED=NO
NEW_MIGRATIONS=0
NEW_TYPESCRIPT_ERRORS=0
ESLINT_GATE=PASS
BUILD_GATE=PASS
DIFF_CHECK=PASS
UNRELATED_FILES=0
SAFETY_TAG=r3a-i1-testing-verified → cc628e0c4cb374d4e99f1432db8887d89eec3b0b (unchanged)
TESTING_DB_TOUCHED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
R3A_I3_STARTED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_R3A_I2_TESTING_INTEGRATION_AUTHORIZATION
```

## 13. Integración + deploy en TESTING (modo OFF) + verificación real-DB (2026-10-06)

Autorizado por el operador: fast-forward a `testing-codex`, push sólo a `origin/testing-codex`, autodeploy TESTING / DeliGO Copy, suites real-DB auto-limpiantes sobre TESTING, HTTP smoke. No autorizado: cambiar `stockReservaModo`, ON/DRAINING, schema/migraciones, código, I3, main/Production, ni el closeout final de I2.

### Integración y deploy

```text
REMOTE_TESTING_CODEX_BEFORE=cc628e0c4cb374d4e99f1432db8887d89eec3b0b · REMOTE_I2_HEAD_FRESH=8c436616e72f52d2f000e49c05198c9655efee4a
COMMITS_TO_INTEGRATE=2 (0e3b2a3 I2, 8c43661 I2-F1) · UNRELATED_COMMITS=0 · UNRELATED_FILES=0 (28 archivos, sin prisma/) · TESTING_IS_ANCESTOR=YES
SAFETY_TAG_STILL_CORRECT=YES (r3a-i1-testing-verified → cc628e0)
INTEGRATION_METHOD=FAST_FORWARD (git merge --ff-only) · REMOTE_TESTING_CODEX_AFTER_PUSH=8c436616e72f52d2f000e49c05198c9655efee4a
PRE_PUSH_TESTS=RUN_NOW sobre el HEAD integrado: 21 suites focales PASS (I2-F1 11, stock-lifecycle 35, Mozo 8/8/26/13, delete-guard 3, wiring 23, I1 19, PyR 13, Salón 6, negocio-salon contract 26, stock-authority 28, inventario 30, caja-venta 27, P0/F1 29/8/6/19/6/6); prisma validate/generate PASS; tsc 33 = baseline (0 nuevos); ESLint PASS; build PASS; diff-check PASS
RAILWAY_PROJECT=amiable-rejoicing · RAILWAY_ENVIRONMENT=TESTING · RAILWAY_SERVICE=DeliGO Copy
FUNCTIONAL_DEPLOY_ID=ca6bfc4e-0d96-4f68-b9bc-7739d3162a23 · STATUS=SUCCESS · BRANCH=testing-codex · COMMIT=8c436616e72f52d2f000e49c05198c9655efee4a · COMMIT_MATCH=YES
NEW_MIGRATIONS=0 · MIGRATION_STATUS=UP_TO_DATE (deploy: "No pending migrations to apply."; prisma migrate status: "Database schema is up to date!", 38) · UNEXPECTED_MIGRATION_APPLIED=NO
POSTDEPLOY_LOGS=PASS (Next.js Ready, 0 errores/excepciones/P2034/módulos en runtime; build remoto Compiled successfully, 160/160)
HTTP_SMOKE=PASS_NO_5XX (GET): /cliente 200 · /operaciones/salon 200 · /mozo/panel/…/pedido/… 200 · /operaciones/mi-panel/…/salon 200 · /api/operaciones/salon/panel 401 · /api/operativo/mozo/panel/…/pedidos 401 · /api/negocio/inventario/movimientos 401 · /api/negocio/pedidos 401 · /api/cliente/pedidos/… 401 · /api/pedidos 401 · /api/negocio/productos/… 401 · /api/negocios/<inexistente> 404
```

### Invariante de modo / reservas (lecturas READ ONLY)

| Momento | Modo | Filas no-OFF | reservas_stock | ACTIVA | Movimientos PEDIDO | Conteo de filas núcleo |
|---|---|---|---|---|---|---|
| Antes del deploy | OFF | 0 | 0 | 0 | 0 | — |
| Antes de las suites | OFF | 0 | 0 | 0 | 0 | negocio 111 · producto 132 · variante 3 · pedido 157 · item 157 · cliente 35 · movimiento 5 · mesa 9 · empleado 19 · venta 3 |
| Después de las suites | OFF | 0 | 0 | 0 | 0 | **idénticos** → sin residuos |

`MODE_ACTIVATED=NO` · `STOCK_RESERVATION_MODE_CURRENT=OFF` · ninguna suite escribe `stockReservaModo`, `reservaStock` ni `configPlataforma` (verificado por grep antes de correr).

### Suites real-DB (RUN_NOW contra TESTING, desde esta máquina, `--timeout 60000`)

| Suite | Pass/Fail | Causa de las fallas |
|---|---|---|
| `pedidos/route.variantes` (negocio genérico + controlStock → camino OFF Serializable) | 7/2 | timeout de transacción interactiva 5000 ms (6034 ms) |
| `pedidos/route` | 0/1 | `PrismaClientInitializationError` a los ~5,02 s (conexión) |
| `pedidos/order-rate-limit-buckets.integration` | 14/0 | — |
| `lib/negocio-salon` | 27/3 | init (conexión), "Unable to start a transaction in the given time", "Transaction not found" — **código no tocado por I2** (Tarea 20, desactivar Salón) |
| `negocio/pedidos/[id]/estado/order-transition-cas-concurrency` | 4/2 | timeout de transacción 5000 ms (5358 ms) |
| `…/estado/order-estado-lock-ownership` | 1/1 | timeout de transacción 5000 ms (5376 ms) |
| `…/estado/order-transition-t29b-flow` | 0/1 | `PrismaClientInitializationError` (conexión) |
| `…/estado/new-delivery-notification-boundary` | 3/1 | timeout de transacción 5000 ms (5359 ms) |
| `negocio/pedidos/order-transition-cas-mesa` | 3/0 | — |
| `lib/p2-t42-pyr-order-workflow-parity` | 11/0 | — |
| `cliente/pedidos/[id]/client-cancel-accepted` | 4/0 | — |
| `repartidor/pedidos/auto-cancel/auto-cancel-waiting-driver` | 4/0 | — |
| `lib/mesa-pedido-cancelacion` | 68/4 | timeout de transacción 5000 ms (5361 ms) + "Transaction not found" |
| `negocio/inventario/movimientos/route` (PEDIDO rechazado en el POST manual) | 13/0 | — |
| `lib/p2-t41-terminal-cierre-cuenta` | 7/0 | — |
| `lib/mesa-cliente-cuenta` | 45/0 | — |

**Total:** 211 pass, 15 fail.

```text
REAL_DB_OFF_PATH_TESTS=FAIL_PARTIAL (211 pass / 15 fail; ver clasificación)
REAL_DB_ON_RESERVATION_CONCURRENCY_TESTS=DEFERRED_TO_R3A_I5_MODE_ON_CERTIFICATION
MODE_VS_RES_CONCURRENCY_TEST=DEFERRED_TO_R3A_I5_MODE_ON_CERTIFICATION
```

### Clasificación (con evidencia)

**Latencia medida desde esta máquina al proxy público de TESTING** (`rtt_probe`, READ ONLY): la primera consulta, conexión incluida, tardó 5528 ms, y el RTT fue de min 353 / mediana 359 / max 1502 ms. Dentro de la red de Railway el RTT es de ~1 ms.

1. **`ENVIRONMENT_LATENCY_CONNECT`:** 4 fallas (`route` 1, `t29b` 1 y `negocio-salon` 2: init + "Unable to start a transaction"). La conexión superó los 5 s del connect timeout de Prisma antes de ejecutar código de I2. Las de `negocio-salon` ocurren en código que I2 no toca.
2. **`I2_INTERACTIVE_TX_DEFAULT_TIMEOUT_EXPOSURE`:** 11 fallas en `route.variantes`, `cas-concurrency`, `lock-ownership`, `new-delivery` y `mesa-pedido-cancelacion`, más el "Transaction not found" de `negocio-salon` Caso 2, que corresponde a la misma clase de expiración.
   - **Qué cambió con I2:** antes, →preparando en Negocio estado era un `updateMany` plano (línea 267 de `cc628e0`) y `operativo/pyr/.../preparar` no tenía transacción. Ahora los 6 escritores, la creación genérica controlada (I2-F1) y la cancelación corren en una transacción interactiva Serializable con el timeout default de Prisma: 5000 ms, porque `runStockSerializable` no pasa `timeout`/`maxWait`. La cancelación de mesa ya era interactiva y ahora suma la liberación.
   - **Qué se observó:** con ~360 ms por round trip, esas transacciones de ~15 consultas tardan 5,3–6,0 s y Prisma las expira.
   - **Qué implica:** en la red interna de Railway esa latencia no existe. Aun así, I2 agregó una dependencia real del timeout default de 5 s en caminos que antes no la tenían; con una DB lenta o cargada, esos caminos fallarían con 500.
   - Corregirlo (p. ej. un `timeout`/`maxWait` explícito en `runStockSerializable`, o menos round trips) es un **cambio de código no autorizado** en esta ronda.

```text
I2_TESTING_FINDING=I2_INTERACTIVE_TX_DEFAULT_TIMEOUT_EXPOSURE (runStockSerializable sin timeout explícito → 5000 ms default de Prisma en caminos que antes no eran interactivos)
REAL_DB_FAILURE_CLASSIFICATION=ENVIRONMENT_LATENCY_CONNECT 4 + I2_INTERACTIVE_TX_DEFAULT_TIMEOUT_EXPOSURE 11 (amplificada por RTT ~360 ms desde el cliente local)
CODE_FIX_APPLIED=NO (no autorizado)
```

### Estado

```text
R3A_I2_STATUS=DEPLOYED_TESTING_MODE_OFF_REAL_DB_VERIFICATION_BLOCKED (NO AWAITING_MANUAL_SMOKE, NO CLOSED, NO CERTIFIED)
TESTING_CODEX_FUNCTIONAL_HEAD=8c436616e72f52d2f000e49c05198c9655efee4a (TESTING ejecuta I2 + I2-F1 con modo OFF)
MODE_ACTIVATED=NO · STOCK_RESERVATION_MODE_CURRENT=OFF · RESERVAS_STOCK_ROW_COUNT=0
ROLLBACK_AVAILABLE=r3a-i1-testing-verified → cc628e0 (sin schema que deshacer)
R3A_I3_STARTED=NO · PRODUCTION_TOUCHED=NO (origin/main 42ca5005d2ecd412de87e454b52820f38aaec5c0; production/DeliGO 6bf1ee84-702e-41e1-80a8-d075e3ce9362 SUCCESS, sin cambios)
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_I2_INTERACTIVE_TX_TIMEOUT_DECISION
```

**Opciones para el operador** (no se ejecutó ninguna):
- **(a)** Autorizar un I2-F2 acotado: un `timeout`/`maxWait` explícito en `runStockSerializable`, con regresión, y después re-verificar real-DB.
- **(b)** Aceptar la clasificación como latencia del cliente local y re-verificar desde un entorno con latencia baja.
- **(c)** Revertir a `r3a-i1-testing-verified`.
