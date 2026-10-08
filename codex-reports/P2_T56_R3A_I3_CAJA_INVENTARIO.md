# P2-T56-R3A-I3 — Caja e Inventario respetan las reservas ACTIVA de pedidos

Fecha: 2026-10-08
Branch: `work/p2-t56-r3-stock-lifecycle-i3` (base `testing-codex` = `1334e67f8066be54ef504d27a1831b31c218b77d`)
Autoridad de arquitectura: `codex-reports/P2_T56_R3A_ORDER_STOCK_LIFECYCLE_DESIGN.md` § A0.1 (A0.1-1, A0.1-9, A0.1-10, A0.1-18, A0.1-20)
Base: I1 `CLOSED_TESTING_VERIFIED` · I2 `CLOSED_TESTING_CERTIFIED` (`codex-reports/P2_T56_R3A_I2_STOCK_LIFECYCLE_RUNTIME.md`)

```text
R3A_I3_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
RESULT=READY_FOR_T56_R3A_I3_TESTING_INTEGRATION_REVIEW
MODE_ACTIVATED=NO (stockReservaModo no se lee ni se escribe en I3; TESTING sigue en OFF)
TESTING_CODEX_TOUCHED=NO · TESTING_DB_TOUCHED=NO · RAILWAY_TOUCHED=NO · PRODUCTION_TOUCHED=NO
```

## 1. Preflight

- Carpeta física única, sin worktree.
- `testing-codex` = `origin/testing-codex` = `1334e67`; `origin/main` = `42ca500`.
- Árbol trackeado limpio, stash vacío, baseline untracked sin cambios.
- Sin cambios en `src/` desde la auditoría READ-ONLY de I3.
- Branch dedicada creada desde ese HEAD.

## 2. Decisiones del operador aplicadas

| Decisión | Contenido | Relación con A0.1 |
|---|---|---|
| **A** — confirmación PREVIA en AJUSTE | Si un AJUSTE deja el físico por debajo de las reservas ACTIVA, se advierte ANTES de guardar; el usuario cancela o confirma expresamente; mientras la advertencia está pendiente no se escribe nada | **Refinamiento aprobado de A0.1-1** (que decía "AJUSTE always allowed, persists, reports deficit + warning"). El AJUSTE deficitario sigue permitido, pero ahora con confirmación previa en lugar de un aviso posterior. El documento de diseño histórico no se modificó; el refinamiento queda trazado acá y en los handoffs. |
| **B** — venta de unidades reservadas | 409 con código `STOCK_RESERVED_FOR_ORDERS`; el mensaje dice cuántas quedan disponibles y por qué; distinto de la falta de físico sin reservas | Implementa A0.1-18 I9 (venta ≤ disponible) |
| **C** — líneas repetidas en Caja | Se suman por clave antes de validar; un descuento y un `MovimientoInventario` VENTA por clave agregada; los `VentaItem` se conservan tal como se pidieron | Cierra el defecto de A0 §6 |

## 3. Implementación

### Autoridad (`src/lib/stock-lifecycle.ts`)

Sigue siendo el único archivo que lee `ReservaStock`. **Nunca lee el modo.**

- **`leerDisponibilidadStock(tx, {negocioId, key})`:** reutiliza `loadStockAuthority` + `sumActiveReserved` (privadas, de I2) y `computeAvailableStock` / `computeReservationDeficit` (I1).
  - disponible = max(0, físico − ACTIVA); déficit = max(0, ACTIVA − físico).
  - CONSUMIDA y LIBERADA no cuentan.
- **`planificarStockVentaCaja`:**
  1. agrega por clave con `agregarCantidadesPorClave` (sólo claves controladas);
  2. relee la autoridad;
  3. lanza 409 `STOCK_RESERVED_FOR_ORDERS` si hay reservas y lo pedido supera el disponible, o 409 `STOCK_INSUFFICIENT` (mismo mensaje de antes de I3) si no hay reservas y el físico no alcanza.
- **`registrarStockVentaCaja`:** un descuento vía `resolveNextStock` y un `MovimientoInventario` VENTA por clave.
- **`planificarMovimientoManual` / `registrarMovimientoManual`:**
  - ENTRADA siempre;
  - SALIDA → 409 `STOCK_RESERVED_FOR_ORDERS` si el físico posterior < ACTIVA;
  - AJUSTE con déficit → `{kind:"confirm"}` sin escribir, salvo una huella vigente;
  - los errores de `resolveNextStock` siguen siendo 400 (`STOCK_MOVEMENT_INVALID`).
- **`StockLifecycleError.details`:** datos estructurados (solicitado, stock físico, reservas activas, disponible) incluidos en el body por `mapStockLifecycleError`.

### Caja (`POST /api/negocio/caja/ventas`)

- `runStockSerializable`: Serializable, maxWait 5000, timeout 15000, retry sólo ante P2034, 3 intentos.
- El plan (que lanza 409) se ejecuta **antes** de `venta.create`; después, `registrarStockVentaCaja` en la misma tx.
- Se conservan el mensaje de siempre ante P2034/40P01 agotado y el resto del contrato (precio del servidor, snapshot, tenant, variantes).

### Movimientos (`POST /api/negocio/inventario/movimientos`)

- `runStockSerializable`. Los checks de tenant, variante y `controlStock` son idénticos (404/400).
- Acepta `confirmacionAjuste: { huella }`; una huella malformada da 400.
- Con `{kind:"confirm"}` responde 409 `STOCK_ADJUSTMENT_CONFIRMATION_REQUIRED` con `confirmacion` (los 4 valores + huella) y `confirmacionVencida`.

### Protocolo de confirmación del AJUSTE deficitario (Decisión A)

1. AJUSTE sin confirmación → el servidor calcula, dentro de la tx Serializable, el físico, las reservas ACTIVA y el déficit.
2. Sin déficit → guarda. Con déficit (lo provoca o lo mantiene) → **no escribe** y devuelve:
   - `STOCK_ACTUAL`, `STOCK_PROPUESTO`, `RESERVAS_ACTIVAS`, `DEFICIT_RESULTANTE`;
   - `huella` = sha256(`P2-T56-R3A-I3|AJUSTE|negocio|producto|variante|físico|propuesto|reservado`).
3. La UI muestra la advertencia. Cancelar no envía nada. Confirmar reenvía sólo la huella.
4. El servidor **recalcula** la huella con el estado actual dentro de la tx:
   - si coincide exactamente (mismo negocio de la sesión, producto/variante, AJUSTE, propuesto, físico y reservado), guarda y registra el movimiento;
   - si algo cambió, devuelve una advertencia nueva con `confirmacionVencida: true` y no guarda.
5. Un P2034 durante la confirmación se reintenta y **revalida**; si la advertencia cambió, se pide confirmar otra vez.

```text
CONFIRMATION_PROTOCOL=SERVER_RECOMPUTED_STATE_FINGERPRINT (sin tablas nuevas, sin secretos nuevos)
```

- **Por qué no hace falta un HMAC con secreto:** la huella no da ningún poder. Los permisos siguen siendo los de la sesión (negocio del usuario, producto propio → si no, 404), y la huella sólo coincide si el cliente conoce el estado EXACTO actual. Eso equivale al consentimiento informado que se pide.
- **Lo que nunca se acepta:** `confirmado: true`, ni una huella de otro producto, cantidad o negocio.

### UI (`src/components/business/inventario-tab.tsx`)

- `AjusteStockDialog` maneja el 409 `STOCK_ADJUSTMENT_CONFIRMATION_REQUIRED` antes de tratarlo como error.
- **`AjusteDeficitWarningDialog`** reutiliza el `AlertDialog` de DeliGO (mismo patrón que `catalog-unsaved-changes-dialog`):
  - título "Advertencia de stock" y el texto pedido;
  - grilla Stock actual / Stock propuesto / Reservas activas / Faltante resultante;
  - botones Cancelar / Confirmar ajuste;
  - aviso de "valores actualizados" cuando la confirmación venció.
- SALIDA bloqueada y Caja con reservas muestran el `error` del servidor como hasta ahora (toast); su visualización ampliada es de I4.
- `AjusteStockDialog` se exporta sólo para el test de UI.

## 4. Concurrencia (matriz A0.1-10, todas las participantes Serializable)

| Caso | Protección |
|---|---|
| Venta vs venta (misma clave) | conflicto w-w sobre la fila autoridad → P2034 → retry; la perdedora relee y responde 409 si ya no alcanza |
| Venta vs reserva de pedido | Caja lee el predicado ACTIVA y escribe la fila; la reserva lee la fila e inserta en el predicado → ciclo → una aborta → retry (#2) |
| SALIDA vs reserva | ídem (#3) |
| AJUSTE vs cambios de reservas | el AJUSTE lee el predicado para el déficit → ciclo o revalidación de la huella → nunca guarda un déficit no consentido (#4 + Decisión A) |
| Venta vs consumo en `preparando` | w-w sobre la fila autoridad → una aborta → retry; el disponible no cambia (#5) |
| Líneas duplicadas | agregación por clave antes de validar y escribir (Decisión C) |
| Rollback | todo en una tx: Venta, VentaItem, stock y movimientos, o nada |

- P2028 (timeout) nunca se reintenta.
- 40P01 conserva su mapeo a 409 en ambos routes.
- La certificación con reservas reales (modo ON) corresponde a I5.

## 5. Compatibilidad con modo OFF y rubros

- **Caja y Movimientos no leen el modo.** Con 0 reservas ACTIVA (el estado de TESTING) el resultado es idéntico al previo, salvo los cambios aprobados: agregación de líneas duplicadas, retry de P2034, timeout explícito y confirmación del AJUSTE deficitario (que sin reservas nunca se dispara).
- **Respeta reservas ACTIVA existentes en cualquier modo** (OFF, ON, DRAINING): test "independiente del modo".
- **Restaurante / Ropa:** sin reservas por construcción (gate de creación de I2), así que restan 0 y no reciben restricciones nuevas. No se agregó gate de rubro en el servidor (follow-up separado).
- **La creación de pedidos y el paso a preparando de I2 no se tocaron.**

```text
RESTAURANTE_RESERVATION_SCOPE_CHANGED=NO · ROPA_RESERVATION_SCOPE_CHANGED=NO
SCHEMA_CHANGE_REQUIRED=NO (índice (negocioId, estado, productoId, productoVarianteId) de I1) · NEW_MIGRATIONS=0
```

## 6. Tests (RUN_NOW, sin TESTING DB)

| Suite | Resultado | Cobertura |
|---|---|---|
| `src/lib/stock-lifecycle-i3.test.ts` (nuevo, fake en memoria) | **32/32** | disponibilidad (CONSUMIDA/LIBERADA excluidas, claves exactas, tenant); Caja suficiente / insuficiente / con reservas (10−7 → vender 5 = 409, vender 2 = físico 8), todo reservado, líneas repetidas (producto y variante), un movimiento por clave, varias claves atómicas, rollback, independencia del modo, venta tras venta; ENTRADA, SALIDA 3 ok / 4 bloqueada, negativo = 400; AJUSTE sin déficit, con déficit sin escritura, cancelar sin cambios, confirmar, reservas cambiadas, físico cambiado, huella de otro producto / otra cantidad / otro negocio, déficit mantenido, variante, rollback; P2034 con retry |
| `caja/ventas/route.reservations.test.ts` (nuevo, route real + db mock) | **14/14** | política Serializable 5000/15000; 409 `STOCK_INSUFFICIENT` vs `STOCK_RESERVED_FOR_ORDERS`; sin venta parcial; x2+x3 = 1 movimiento de 5 y 2 VentaItem; variante; sin controlStock; rollback; P2034 reintentado; P2034 agotado (409, mensaje de siempre, 3 intentos); P2028 sin retry; Restaurante/Ropa |
| `inventario/movimientos/route.reservations.test.ts` (nuevo) | **19/19** | ENTRADA; SALIDA 3/4; negativo 400; sin controlStock 400; otro negocio 404; AJUSTE sin déficit; advertencia sin escritura; confirmar; reservas cambiadas; físico cambiado; huella de otro producto; huella de otro negocio; confirmación malformada (incl. `confirmado: true`) 400; variante; rollback; P2034 durante la confirmación; P2028; OFF sin reservas |
| `components/business/inventario-ajuste-deficit.test.tsx` (nuevo, render happy-dom) | **4/4** | advertencia con los 4 valores y sin guardar; Cancelar sin otra request; Confirmar ajuste reenvía la huella; confirmación vencida con valores nuevos; SALIDA bloqueada muestra el error |
| `p2-t56-r3a-i2-wiring-static-contract.test.ts` | **34/34** (+6 I3; el guard F2 pasa de "8 callers" a la lista exacta de 10) | Caja/Movimientos usan la autoridad; la huella se recalcula en la tx; nadie toca reservas ni lee el modo; escritores de stockCantidad = autoridad + alta de producto/variante; UI reenvía la huella, nunca un booleano |

- **Mutation check:** con `leerDisponibilidadStock` ignorando las reservas, fallan 20 + 3 + 10 tests de las suites I3. Restaurado y verificado con `cmp`.
- **Regresión (barrido completo, cada archivo en su propio proceso; 372 archivos):** 4314 pass.
  - Las fallas son exactamente las del baseline pre-I3: los mismos 8 archivos no-DB con los mismos conteos, clasificados `OUTSIDE_I2_DIFF_CRLF_PORTABILITY_SUSPECTED_BASELINE_NOT_EXECUTED`, más los mismos 72 `DB_ENV`.
  - Incluye I1 contract 19, `stock-lifecycle` 43, `route.stock-mode` 11, mesa timeout 8, `caja-venta` 27, `inventario` 30, `stock-authority` 28, Mozo, P0/F1 y transiciones, todo PASS.
- **Contratos de UI de Inventario** (`product-variants` 19/2, `editor-ux` 11/6): las fallas son idénticas, por nombre, al baseline pre-I3 con el mismo working copy CRLF; con contenido LF normalizado por git dan 19/2 y 17/0.
- **Real-DB** (suites existentes de Caja y Movimientos; concurrencia real venta/venta): `DEFERRED_TO_I3_TESTING_INTEGRATION`.
- **Concurrencia con reservas reales:** `DEFERRED_TO_R3A_I5_MODE_ON_CERTIFICATION`.

### Gates

| Gate | Resultado |
|---|---|
| Prisma validate (placeholder URL) / generate | PASS |
| TypeScript (tsc local) | 33 = baseline, **0 nuevos** |
| ESLint (9 archivos) | PASS |
| Build (`npm run build`) | PASS (160/160) |
| `git diff --check` | PASS |

## 7. Archivos

- `I3_RUNTIME`: `src/lib/stock-lifecycle.ts`, `src/app/api/negocio/caja/ventas/route.ts`, `src/app/api/negocio/inventario/movimientos/route.ts`
- `I3_UI_CONFIRMATION`: `src/components/business/inventario-tab.tsx`
- `I3_TESTS`: `src/lib/stock-lifecycle-i3.test.ts`, `src/app/api/negocio/caja/ventas/route.reservations.test.ts`, `src/app/api/negocio/inventario/movimientos/route.reservations.test.ts`, `src/components/business/inventario-ajuste-deficit.test.tsx`, `src/lib/p2-t56-r3a-i2-wiring-static-contract.test.ts`
- `I3_DOCUMENTATION`: este reporte, `CODEX_REPORT.md`, `codex-reports/ROADMAP.md`, `DELIGO_FULL_CONTEXT_LATEST.md`
- `UNRELATED_FILES=0`. Sin schema, sin migraciones, sin cambios en catálogo/carrito (I4), sin cambios en la creación ni la preparación de pedidos (I2).

## 8. Hallazgos laterales (no corregidos; follow-ups)

- **Caja acepta cantidades fraccionarias** (`computeSaleFromAuthoritativeProducts` valida > 0, no entero). Contra columnas Int termina en 500 y rollback, sin efecto parcial. No compromete un invariante de I3.
- **Vender o mover un producto CON variantes sin `varianteId`:** la auditoría lo listó como lateral, pero el test DB de Caja (línea 408) lo documenta como compatibilidad deliberada ("backward compatibility"). Opera sobre la clave del producto padre, que no tiene reservas propias, así que no afecta las reservas de las variantes. Se reclasifica como comportamiento intencional.
- **Falta un gate de rubro en el servidor** para Caja/Inventario (follow-up de A0.1, no se agregó).
- **Terminal Salón — Cerrar cuenta:** `OPEN_DEFERRED`, sin cambios.

## 9. Rollback

Revertir el commit de I3. Sin schema ni datos que deshacer: I3 no crea filas nuevas de ningún tipo nuevo, sólo cambia la validación y la forma del registro de Caja (un movimiento por clave).

## 10. Markers (implementación en branch — estado current en §11)

```text
CAJA_RESERVATION_AWARE=YES
CAJA_DUPLICATE_LINES_FIXED=YES
CAJA_MOVEMENTS_PER_AGGREGATED_KEY=YES
INVENTORY_ENTRADA=ALWAYS_ALLOWED_RESERVATIONS_UNCHANGED
INVENTORY_SALIDA_RESERVATION_GUARD=YES
AJUSTE_PRE_SAVE_WARNING=YES
AJUSTE_EXPLICIT_CONFIRMATION=YES
AJUSTE_SERVER_SIDE_REVALIDATION=YES
AJUSTE_STALE_CONFIRMATION_REJECTED=YES
AJUSTE_CANCEL_NO_WRITE=YES
AJUSTE_DEFICIT_REPORTED=YES
RESERVATION_AUTHORITY_REUSED=YES
SERIALIZABLE_RETRY_POLICY=runStockSerializable (Serializable, maxWait 5000, timeout 15000, P2034-only, 3 attempts; P2028 no retry; 40P01 → 409 kept)
MODE_OFF_COMPATIBILITY=PASS
R3A_I3_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
R3A_I4_STARTED=NO · R3A_I5_STARTED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_I3_TESTING_INTEGRATION_AUTHORIZATION (histórico — integrada, §11)
```

## 11. Integración en TESTING + verificación real-DB (modo OFF) (2026-10-08)

Autorizado por el operador: fast-forward a `testing-codex`, push sólo a `origin/testing-codex`, autodeploy TESTING / DeliGO Copy, suites real-DB con fixtures aislados y auto-limpiantes, lecturas READ ONLY y HTTP smoke. Sin ON/DRAINING, sin reservas artificiales, sin schema, sin código nuevo, sin I4/I5, sin main/Production.

### Integración y deploy

```text
REMOTE_TESTING_CODEX_BEFORE=1334e67f8066be54ef504d27a1831b31c218b77d · REMOTE_I3_HEAD=8ff7d0bc175666f47a3ea7fba055ade185471d25
COMMITS_TO_INTEGRATE=1 · UNRELATED_COMMITS=0 · UNRELATED_FILES=0 (13 = 3 runtime + 1 UI + 5 tests + 4 docs; sin prisma/) · TESTING_IS_ANCESTOR=YES · SAFETY_TAG_STILL_CORRECT=YES
INTEGRATION_METHOD=FAST_FORWARD · REMOTE_TESTING_CODEX_AFTER_PUSH=8ff7d0bc175666f47a3ea7fba055ade185471d25
PRE_PUSH_GATES=RUN_NOW: I3 32 · Caja route 14 · Movimientos route 19 · UI 4 · wiring 34 · I1 19 · stock-lifecycle 43 · route.stock-mode 11 · mesa timeout 8 · Mozo 8/8/26 · PyR 13 · Salón 6 · negocio-salon 26 · delete-guard 3 · stock-authority 28 · inventario 30 · caja-venta 27 · contratos UI de Caja 6/10 · P0/F1 19/6 — PASS; contratos UI de Inventario 19/2 y 11/6 = mismos 8 nombres que el baseline pre-I3 (CRLF); prisma PASS; tsc 33 = baseline (0 nuevos); ESLint PASS; build PASS; diff-check PASS
RAILWAY=amiable-rejoicing / TESTING / DeliGO Copy
FUNCTIONAL_DEPLOY_ID=d82631a2-c873-47f8-b1c8-fb0bcff11975 · STATUS=SUCCESS · BRANCH=testing-codex · COMMIT=8ff7d0bc175666f47a3ea7fba055ade185471d25 · COMMIT_MATCH=YES
NEW_MIGRATIONS=0 · MIGRATION_STATUS=UP_TO_DATE ("No pending migrations to apply."; migrate status "Database schema is up to date!", 38)
POSTDEPLOY_LOGS=PASS (Ready; 0 errores/P20xx/módulos/5xx en runtime; build remoto Compiled successfully, 160/160)
HTTP_SMOKE=PASS_NO_5XX (GET: 4 páginas 200; 8 APIs protegidas 401, incl. /api/negocio/caja/ventas; negocio inexistente 404)
```

### Real-DB (RUN_NOW contra TESTING, `--timeout 60000`, log completo por suite)

| Suite | Resultado | P2028 / init |
|---|---|---|
| `negocio/caja/ventas/route` | **21/21** | 0 / 0 |
| `negocio/inventario/movimientos/route` | **13/13** | 0 / 0 |
| Concurrencia venta/venta, re-corrida aislada: producto (`CASE concurrency`) | **1/1**: exactamente un 201, stock final 0; Postgres registró un conflicto de escritura real (P2034) | 0 / 0 |
| Concurrencia venta/venta, re-corrida aislada: variante (`CONCURRENCY_VARIANT_STOCK_PASS`) | **1/1**: ídem sobre la variante | 0 / 0 |
| Regresión I2 (15 suites): `pedidos/route.variantes` 9, `pedidos/route` 5, `order-rate-limit-buckets` 14, `estado/cas-concurrency` 6, `estado/lock-ownership` 2, `estado/t29b-flow` 18, `estado/new-delivery` 4, `cas-mesa` 3, `client-cancel-accepted` 4, `auto-cancel` 4, `mesa-pedido-cancelacion` 72, `p2-t42-pyr` 11, `negocio-salon` 30, `p2-t41-terminal-cierre-cuenta` 7, `mesa-cliente-cuenta` 45 | **234/0** | 0 / 0 |

**Total real-DB:** 270 pass, 0 fail (más las 2 re-corridas aisladas de concurrencia).

**Mapa de cobertura (sin inventar PASS):**

| Exigencia | Real-DB | Otra cobertura |
|---|---|---|
| Caja: venta suficiente, insuficiente, descuento, variante, rollback ante insuficiencia, tenant, precio del servidor | ✅ suite de Caja | — |
| Caja: concurrencia venta/venta (producto y variante) | ✅ real PostgreSQL, conflicto P2034 observado, un solo éxito, sin doble descuento | — |
| Caja: líneas repetidas / una actualización por clave / un movimiento por clave / VentaItem conservados con la misma clave | ❌ **no cubierto** por las suites existentes (no hay un test DB de líneas repetidas) | route real con db mock 14/14 + autoridad con fake 32/32 |
| Caja con Restaurante/Ropa | ❌ los fixtures DB usan `rubro: "negocio"` | Caja no ramifica por rubro (contrato estático) y fuera de "negocio" no existen reservas; route mock 14/14 |
| Movimientos: ENTRADA, SALIDA, SALIDA insuficiente (400), AJUSTE, producto/variante, ownership, tipos manuales no permitidos | ✅ suite de Movimientos | — |
| AJUSTE deficitario con reservas activas reales | ⏸ **diferido a I5** (con modo OFF y 0 reservas no se dispara; no se fabricaron reservas) | servidor 19/19 + autoridad 32/32 + UI 4/4 |
| Concurrencia contra reservas activas (venta/reserva, SALIDA/reserva, MODE/RES) | ⏸ **diferido a I5** | matriz A0.1-10 + fake |

```text
CAJA_REAL_DB_TESTS=PASS (21/21)
INVENTORY_REAL_DB_TESTS=PASS (13/13)
SALE_SALE_CONCURRENCY_REAL_DB=PASS (producto + variante; P2034 real observado; un solo éxito; stock final 0)
DUPLICATE_LINES_REAL_DB=NOT_COVERED_BY_EXISTING_SUITES (cubierto por route mock + fake; sin test DB propio)
CAJA_NON_GENERIC_RUBRO_REAL_DB=NOT_COVERED_BY_EXISTING_SUITES (fixtures rubro "negocio"; Caja sin rama de rubro)
I2_REGRESSION=PASS (234/0)
AJUSTE_CONFIRMATION_AUTOMATED_TESTS=PASS
AJUSTE_CONFIRMATION_REAL_ACTIVE_RESERVATIONS=DEFERRED_TO_I5
I3_ATTRIBUTABLE_REAL_DB_FAILURES=0 · UNKNOWN_MATERIAL_REAL_DB_FAILURES=0
SERIALIZABLE_POLICY_VERIFIED=Serializable · maxWait 5000 · timeout 15000 · P2034-only · 3 intentos · P2028 sin retry (route tests + contrato; P2034 real ejercitado en la concurrencia DB)
```

### Snapshot READ ONLY de TESTING

| Momento | Modo | Filas no-OFF | reservas_stock | ACTIVA | Movimientos PEDIDO | Conteo de filas núcleo |
|---|---|---|---|---|---|---|
| Antes | OFF | 0 | 0 | 0 | 0 | negocio 111 · producto 132 · variante 3 · pedido 165 · item 165 · cliente 35 · movimiento 5 · mesa 9 · empleado 19 · venta 3 |
| Después de todas las suites | OFF | 0 | 0 | 0 | 0 | **idénticos** → `TEST_RESIDUE=NONE` |

`pedido` pasó de 157 a 165 desde la ronda I2 por el smoke manual del operador (fuera de esta ronda).

```text
MODE_ACTIVATED=NO · STOCK_RESERVATION_MODE_CURRENT=OFF · RESERVAS_STOCK_ROW_COUNT=0
PRODUCTION_TOUCHED=NO (origin/main 42ca5005d2ecd412de87e454b52820f38aaec5c0; production/DeliGO 6bf1ee84-702e-41e1-80a8-d075e3ce9362 sin cambios)
```

### Estado

```text
R3A_I3_STATUS=DEPLOYED_TESTING_MODE_OFF_AWAITING_MANUAL_SMOKE (histórico — superseded por §12: CLOSED_TESTING_CERTIFIED)
TESTING_CODEX_FUNCTIONAL_HEAD=8ff7d0bc175666f47a3ea7fba055ade185471d25
R3A_I4_STARTED=NO · R3A_I5_STARTED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_I3_MODE_OFF_MANUAL_SMOKE (histórico — smoke realizado, §12)
```

### Checklist sugerido para el smoke manual (TESTING, modo OFF, sin reservas)

1. **Caja:** vender un producto con control de stock dentro del stock → se descuenta; vender por encima → "no tiene stock suficiente" (sin venta parcial).
2. **Caja con variante:** vender una variante → se descuenta sólo esa variante.
3. **Inventario ENTRADA / SALIDA / AJUSTE** en un producto y en una variante: con 0 reservas, AJUSTE a la baja se guarda directo, **sin** advertencia (la advertencia sólo aparece con reservas activas, que no existen con OFF).
4. **Inventario SALIDA mayor al stock** → error "dejaría el stock en negativo", como antes.
5. **Historial de movimientos:** cada venta o movimiento aparece una vez con stock antes/después correctos.
6. **Regresión rápida:** un pedido de Cliente y uno de Mozo en negocio genérico siguen funcionando como en I2 (sin cambios).

`AJUSTE_CONFIRMATION` y Caja con reservas activas reales: **no** se pueden certificar manualmente en OFF; corresponden a I5.

## 12. Closeout — Certificación manual TESTING MODE OFF (2026-10-08)

Ronda documental: sin código, sin tests nuevos, sin DB, sin cambios de modo.

### Smoke manual del operador (registrado tal como fue informado)

```text
MANUAL_SMOKE_ENVIRONMENT=TESTING
MANUAL_SMOKE_MODE=OFF
```

| # | Prueba | Resultado |
|---|---|---|
| 1 | Venta normal desde Caja: producto con control de stock dentro de lo disponible; el stock se descontó correctamente | PASS |
| 2 | Venta sin stock suficiente: rechazada, sin venta parcial y sin descontar stock | PASS |
| 3 | Venta de una variante, con el descuento correspondiente | PASS |
| 4 | Movimientos de Inventario ENTRADA, SALIDA y AJUSTE: stock e historial correctos; con modo OFF y sin reservas activas el ajuste no requirió advertencia por déficit | PASS |
| 5 | SALIDA superior al stock: rechazada, sin modificar el inventario | PASS |
| 6 | Producto repetido en Caja (dos líneas del mismo producto en una venta) | **NOT_AVAILABLE / NOT_EXECUTED**: la prueba no estuvo disponible para el operador desde la interfaz utilizada. No se registra PASS ni FAIL, y no se afirma ninguna causa: no quedó comprobado que la UI impida o agrupe duplicados. |

```text
MANUAL_SMOKE_PASS=5
MANUAL_SMOKE_FAIL=0
MANUAL_SMOKE_NOT_AVAILABLE=1
MANUAL_SMOKE_TOTAL=6
MANUAL_SMOKE_RESULT=PASS_WITH_DOCUMENTED_COVERAGE_LIMITATION
```

### Base de la certificación

Smoke manual representativo satisfactorio, combinado con la cobertura automática y la verificación real-DB, con limitaciones explícitas de cobertura. **No** se afirma que todos los caminos posibles fueron probados manualmente.

- **Implementación** (§6, branch): autoridad I3 32/32 · route de Caja 14/14 · route de Movimientos 19/19 · UI de la advertencia 4/4 · contrato estático 34/34. Mutation check: ignorar las reservas hizo fallar los tests diseñados para detectarlo.
- **Integración real-DB** (§11):
  - Caja 21/21 · Inventario 13/13;
  - concurrencia venta/venta con producto PASS y con variante PASS (PostgreSQL real, P2034 observado, un solo éxito, stock final 0);
  - regresión I2 234/234.
  - Sin fallas atribuibles a I3, sin P2028 y sin errores de conexión.
- **Gates:** Prisma PASS · 0 migraciones nuevas · TypeScript 0 errores nuevos (33 = baseline) · ESLint PASS · build PASS · diff-check PASS.
- **Contratos de UI de Inventario:** las 8 fallas observadas coinciden, por nombre, con el baseline previo de portabilidad CRLF. No se presentan como tests aprobados.
- **Invariantes:** modo OFF preservado (`MODE_ACTIVATED=NO`), `reservas_stock` = 0 y sin residuos de las suites. Production sin cambios.

### Limitaciones de cobertura (explícitas)

```text
DUPLICATE_LINES_REAL_DB=NOT_TESTED_FOLLOWUP
CAJA_NON_GENERIC_RUBRO_REAL_DB=NOT_TESTED_FOLLOWUP
AJUSTE_ACTIVE_RESERVATIONS_CERTIFICATION=DEFERRED_TO_I5
```

- **A. Líneas repetidas en Caja.**
  - La agregación por clave y el descuento único están implementados y cubiertos por tests automatizados (route real con db mock + fake de la autoridad).
  - No se completó la comprobación manual (smoke #6 NOT_AVAILABLE) ni hay una prueba equivalente con PostgreSQL real.
  - Follow-up: `FOLLOWUP_CAJA_DUPLICATE_LINES_REAL_DB_COVERAGE`, a resolver antes de una futura promoción a Production. No es un PASS real-DB.
- **B. Restaurante / Ropa.**
  - Las suites real-DB de Caja e Inventario usan negocios genéricos (`rubro: "negocio"`); la regresión específica de Restaurante/Ropa está cubierta por mocks y contratos, no por suites reales.
  - Follow-up: `FOLLOWUP_CAJA_INVENTARIO_NON_GENERIC_RUBRO_REAL_DB_COVERAGE`.
  - R3A sigue limitado a `rubro = "negocio"`; Ropa queda para una etapa futura.
- **C. Advertencia de AJUSTE con reservas activas.**
  - La confirmación previa, la cancelación y la revalidación del servidor tienen tests automatizados satisfactorios.
  - TESTING está en OFF con 0 reservas, así que no se certificó manualmente contra reservas reales. Queda para I5.
- **D. Follow-ups anteriores** (separados, no investigados ni corregidos):
  - Terminal Salón — Cerrar cuenta (`OPEN_DEFERRED`);
  - cantidades fraccionarias en Caja;
  - gate de rubro en el servidor;
  - incorporación futura de Ropa al sistema de reservas.

### Alcance de la certificación

Esta certificación **no** significa que las reservas en modo ON estén certificadas. La certificación con reservas activas (ON, concurrencia venta/reserva, SALIDA/reserva, MODE/RES, AJUSTE deficitario real) queda pendiente para I5.

### Estado final

```text
R3A_I3_STATUS=CLOSED_TESTING_CERTIFIED (TESTING, modo OFF)
TESTING_FUNCTIONAL_HEAD=8ff7d0bc175666f47a3ea7fba055ade185471d25 (deploy d82631a2-c873-47f8-b1c8-fb0bcff11975 SUCCESS)
MODE_ACTIVATED=NO · STOCK_RESERVATION_MODE_CURRENT=OFF
R3A_I4_STARTED=NO · R3A_I5_STARTED=NO
PRODUCTION_TOUCHED=NO
RESULT=T56_R3A_I3_CLOSED_TESTING_CERTIFIED
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_R3A_I4_DECISION
```
