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

## 10. Markers

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
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_I3_TESTING_INTEGRATION_AUTHORIZATION
```
