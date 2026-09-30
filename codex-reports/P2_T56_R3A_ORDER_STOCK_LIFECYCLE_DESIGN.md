# P2-T56-R3A — Order Stock Lifecycle — A0 Auditoría + Diseño

Date: 2026-09-30
Branch: `work/p2-t56-r3-stock-lifecycle`
Branch base: `1e14355c617cad33ab33c3fdda508c6a93830f4e` (== `origin/testing-codex` tip at start)
Fase: A0 — auditoría + diseño. **No implementa nada.** Ningún archivo de source,
schema, migración, DB, Railway ni Production fue tocado.

Toda afirmación sobre el comportamiento actual cita archivo y línea del repo real
en el commit base. Lo que es propuesta está marcado como propuesta.

---

## 1. Git / preflight

```text
CURRENT_BRANCH=work/p2-t56-r3-variant-search (al inicio)
LOCAL_HEAD=1e14355c617cad33ab33c3fdda508c6a93830f4e
REMOTE_TESTING_CODEX=1e14355c617cad33ab33c3fdda508c6a93830f4e
WORKTREE_CLEAN=YES (0 archivos trackeados modificados; los archivos untracked
  preexistentes — backlog de codex-reports/, .next-*, etc. — son ruido de base
  ajeno a esta tarea, idéntico en todas las rondas previas)
STAGED_FILES=0
STASH_COUNT=0
TASK_BRANCH=work/p2-t56-r3-stock-lifecycle
TASK_BRANCH_BASE=1e14355c617cad33ab33c3fdda508c6a93830f4e
TESTING_IS_ANCESTOR=YES
```

## 2. Auditoría de documentación canónica

Leídos: `CODEX_REPORT.md`, `DELIGO_FULL_CONTEXT_LATEST.md`, `codex-reports/ROADMAP.md`,
`codex-reports/P2_T56_R2C_PRODUCT_VARIANTS.md`, `codex-reports/P2_T56_R3B_VARIANT_SEARCH.md`.

```text
CANONICAL_DOCS_READ=YES
CURRENT_CANONICAL_R3A_STATUS=OPEN_BACKLOG_NOT_STARTED (valor leído en el preflight, ANTES
  de esta tarea; consistente en las 5 fuentes — al cierre de esta tarea pasa a
  DESIGN_COMPLETE_AWAITING_OPERATOR_ARCHITECTURE_DECISION, ver §34)
DOCUMENTATION_CONTRADICTION=NO (entre documentos)
```

**Discrepancia doc ↔ código (no entre documentos, pero material para este diseño):**
los cinco documentos describen el comportamiento actual como
`CUSTOMER_ORDERS_VALIDATE_VARIANT_STOCK_BUT_DO_NOT_RESERVE_OR_DECREMENT_IT`. El
código muestra que la validación es **más débil** de lo que esa frase sugiere —
ver §5. No se corrige en los documentos durante esta fase: el reporte de diseño
la registra, y la actualización canónica de esta ronda (ROADMAP/CODEX_REPORT) la
referencia.

## 3. State machine real de Pedido

`Pedido.estado` es `String` (no enum) — `prisma/schema.prisma:585`. El comentario del
schema (`recibido, preparando, en_camino, listo_para_retirar, entregado, cancelado`)
está desactualizado: no lista `aceptado` ni `esperando_repartidor`. La autoridad real
es `src/lib/order-transitions.ts`.

**Estados reales:** `recibido`, `aceptado`, `preparando`, `esperando_repartidor`,
`en_camino`, `listo_para_retirar`, `entregado`, `cancelado`. `confirmado` aparece sólo
como legacy en la lista cancelable de Cliente (`cliente/pedidos/[id]/route.ts:54`);
ningún flujo activo lo emite. **No existe estado `rechazado`**: un rechazo del negocio
es `estado="cancelado"` con `canceladoPor="vendedor"` (valores de `canceladoPor` escritos
en el repo: `cliente`, `vendedor`, `sistema`, más el actor de Mesa).

**Grafo vigente** = `NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS`
(`order-transitions.ts:119-136`), reutilizado sin copia por Negocio, Operaciones PyR
(Terminal) y los endpoints fijos de Empleado:

```text
domicilio: recibido→{aceptado | preparando(legacy)}; aceptado→preparando;
           preparando→{esperando_repartidor | en_camino(legacy)}
           (esperando_repartidor→en_camino y en_camino→entregado: sólo Repartidor)
retiro:    recibido→{aceptado | preparando(legacy)}; aceptado→preparando;
           preparando→listo_para_retirar; listo_para_retirar→entregado
mesa:      recibido→preparando; preparando→listo_para_retirar; listo_para_retirar→entregado
           (MESA_PASA_POR_ACEPTADO=false — order-transitions.ts:46)
```

**Propiedad estructural clave para el diseño:** en las tres modalidades, y tanto por
la arista nueva como por la legacy, **todo camino hacia `entregado` pasa por
`preparando`**. `aceptado` NO es un checkpoint universal (Mesa nunca lo atraviesa, y la
arista legacy `recibido→preparando` lo saltea en domicilio/retiro).

### Matriz de transiciones (escritores reales de `Pedido.estado`)

| STATE | CAN_ENTER_FROM | ACTOR | ROUTE_OR_AUTHORITY | BUSINESS_MEANING | REVERSIBLE | CURRENT_SIDE_EFFECTS |
|---|---|---|---|---|---|---|
| recibido | (creación) | Cliente / Cliente Mesa / Mozo | `POST /api/pedidos` (`route.ts:1861`); `POST /api/operativo/mozo/panel/[slug]/pedidos` (`route.ts:1188`) | pedido recibido, sin compromiso del negocio | — | push, audit; ningún efecto de stock |
| aceptado | recibido | Negocio; Empleado PyR | `negocio/pedidos/[id]/estado` (CAS `:267`); `operativo/pyr/pedidos/[id]/aceptar` (`:89`); `operaciones/pyr/pedidos/[id]/estado` | el negocio acepta (sólo domicilio/retiro) | no (sólo avanza o se cancela) | ninguno de stock |
| preparando | recibido (legacy / mesa), aceptado | Negocio; PyR; Salón | `negocio/.../estado`; `operativo/pyr/.../preparar` (`:92`, exige origen `aceptado`); `operativo/salon/.../preparar` (`:60`); `operaciones/salon/.../estado` (`:102`); `operaciones/pyr/.../estado` | el negocio empieza a preparar / separar físicamente la mercadería | no | ninguno de stock |
| esperando_repartidor | preparando | Negocio; PyR | `negocio/.../estado`; `operativo/pyr/.../buscar-repartidor` (`:103`) | listo, esperando repartidor (domicilio) | no | ninguno de stock |
| en_camino | esperando_repartidor, preparando (legacy) | Repartidor (y Negocio vía legacy) | `repartidor/pedidos/[id]/aceptar` (CAS `:114`) | asignado, en viaje | no | ninguno de stock |
| listo_para_retirar | preparando | Negocio; PyR; Salón | `operativo/pyr/.../listo-para-retiro` (`:87`); `operativo/salon/.../listo` (`:64`); `negocio/.../estado` | listo para entregar (retiro/mesa) | no | ninguno de stock |
| entregado | en_camino (Repartidor); listo_para_retirar (Negocio/PyR/Mozo) | Repartidor; Negocio; PyR; Mozo | `repartidor/pedidos/[id]/entregar` (`:103`); `operativo/pyr/.../entregar` (`:96`); `operativo/mozo/pedidos/[id]/entregar` (`:157`); `negocio/.../estado` (exige `clienteConfirmaRecibido` salvo mesa, `:170-181`) | entregado | terminal | ninguno de stock |
| cancelado (cliente) | recibido, confirmado, aceptado — y sólo dentro de la tolerancia del negocio | Cliente | `cliente/pedidos/[id]/route.ts` (lista `:54`, CAS `:101`) | cancelación del cliente | terminal | **reversión de deuda** (`revertirTarifaSiCorresponde`) en la MISMA `$transaction` que el CAS; rollback total si falla |
| cancelado (vendedor = rechazo o cancelación tardía) | cualquier no-terminal (`canTransitionToCancelled(..., "rollout")`: recibido, aceptado, preparando, esperando_repartidor, en_camino, listo_para_retirar) | Negocio; PyR (Terminal) | `negocio/.../estado` (`:208-236`, motivo obligatorio); `operaciones/pyr/.../estado` | rechazo si ocurre en recibido/aceptado; cancelación tardía después | terminal | reversión de deuda en la misma `$transaction` |
| cancelado (Mesa) | `ESTADOS_PENDIENTES_MESA` = recibido, preparando, listo_para_retirar | Mozo / Salón / Terminal | `operaciones/pedidos/[id]/cancelar` → `cancelarPedidoMesa` (`mesa-pedido-cancelacion.ts:304`) | cancelación de pedido de mesa | terminal | reversión de deuda, PedidoEvento |
| cancelado (sistema) | esperando_repartidor / en_camino sin repartidor, domicilio, más viejo que N min (default 30, rango 5–180) | Repartidor (dispara la request) | `POST /api/repartidor/pedidos/auto-cancel` (`:134-166`), llamado desde `deliveries-tab.tsx` | sin repartidor disponible | terminal | reversión de deuda |

`clienteConfirmaRecibido` (Cliente, `cliente/pedidos/[id]/route.ts:196-262`) **no cambia
`estado`** — sólo marca un flag desde `listo_para_retirar`/`en_camino`.

**Mecanismo universal de exclusión:** todas las escrituras de `estado` usan CAS
`updateMany({ where: { id, negocioId, estado: <esperado> } })` y exigen `count === 1`.
Las cancelaciones lo hacen dentro de `$transaction` junto con un efecto secundario
(reversión de deuda) que hace rollback del CAS si falla. Las transiciones hacia
adelante de Negocio hoy son un CAS plano sin transacción (`negocio/.../estado:267`) —
no tienen efectos secundarios.

```text
CURRENT_ORDER_STATE_MACHINE=recibido→(aceptado, sólo domicilio/retiro; saltable por
  arista legacy)→preparando→{esperando_repartidor→en_camino | listo_para_retirar}→
  entregado; cancelado desde cualquier no-terminal según actor (cliente: sólo
  pre-preparando y dentro de tolerancia; vendedor/PyR: cualquier no-terminal; Mesa:
  recibido/preparando/listo; sistema: sólo domicilio esperando repartidor). Sin estado
  "rechazado". Todas las transiciones por CAS sobre estado.
```

## 4. Orígenes de Pedido

Sólo **dos** llamadas `pedido.create` productivas en todo `src/` (búsqueda exhaustiva
de `.pedido.create(`/`tx.pedido.create(`/`pedido.createMany(`, excluyendo tests):

```text
ORDER_CREATION_ENTRYPOINTS=
  1. POST /api/pedidos — src/app/api/pedidos/route.ts:1861
  2. POST /api/operativo/mozo/panel/[slug]/pedidos — route.ts:1188
NORMAL_CLIENT_ORDER_ENTRYPOINT=POST /api/pedidos (metodoEntrega retiro|domicilio)
MESA_ORDER_ENTRYPOINT=POST /api/pedidos (metodoEntrega=mesa) — convergen en el MISMO
  loop de validación por item (route.ts:930), que corre ANTES de la primera
  bifurcación de mesa (`const isMesaOrder`, route.ts:1338). Mismo tratamiento de stock.
OPERATIONS_ORDER_ENTRYPOINT=POST /api/operativo/mozo/panel/[slug]/pedidos (pedido
  manual de Mozo, siempre metodoEntrega=mesa, Serializable + retry)
OTHER_ORDER_ENTRYPOINTS=ninguno. "Repetir pedido" (PUT /api/cliente/pedidos/[id]/repetir)
  NO crea pedidos: revalida y devuelve datos; el cliente vuelve a pasar por POST /api/pedidos.
```

## 5. Comportamiento actual de stock en Pedidos

Búsqueda exhaustiva de `stockCantidad|controlStock|stockMinimo|MovimientoInventario|
increment|decrement|isolationLevel|Serializable|reserv` en `src/app/api/pedidos/route.ts`:
la **única** referencia de stock es `route.ts:990`.

- **Productos con variantes:** `if (variante.controlStock && variante.stockCantidad <= 0)`
  → 400 "Variante sin stock" (`route.ts:990`). **No compara contra la cantidad pedida**:
  pedir 5 unidades de una variante con stock 1 pasa. **No agrega** líneas repetidas del
  mismo producto/variante.
- **Productos sin variantes:** **no hay ningún chequeo de `controlStock`/`stockCantidad`.**
  Sólo `!producto.stock` (el toggle manual de visibilidad) en `route.ts:932`. Un producto
  base con `controlStock=true, stockCantidad=0` se puede pedir.
- **Dónde:** la validación corre en el loop de `route.ts:930`, **fuera** de la transacción
  de creación (`route.ts:1715`) → TOCTOU.
- **Transacción:** `db.$transaction(async (tx) => {...})` sin objeto de opciones →
  aislamiento por defecto de Postgres (READ COMMITTED). Escribe sólo `tx.cliente.update`
  (`:1855`) y `tx.pedido.create` (`:1861`).
- **Mutación / movimiento:** ninguno.
- **Idempotencia de creación (existente, reutilizable):** índice único
  `@@unique([negocioId, idempotencyKey])` + fingerprint; un replay devuelve el Pedido
  existente, y la carrera P2002 se resuelve devolviendo el ganador (`route.ts:1877-1899`).

**Mozo (`operativo/mozo/panel/[slug]/pedidos/route.ts`):** **no conoce variantes** — su
`producto.findMany` no incluye `variantes` (`:999-1010`), sólo chequea `eliminado` y el
toggle `stock` (`:1056`), y precia con su propia copia de `calculateEffectiveProductPrice`
sobre el Producto base (`:353-369`). Para un producto con variantes, un pedido manual de
Mozo hoy se crea **sin variante y al precio base dormido**. Es una brecha preexistente
(R2C-F2 cubrió sólo el lado Cliente) — relevante aquí porque es el segundo punto de
creación que cualquier reserva debe cubrir.

```text
CURRENT_ORDER_STOCK_VALIDATION=PARTIAL — sólo variantes, sólo "stock <= 0" (no por
  cantidad, no agregado), fuera de transacción; productos base sin validación de stock;
  Mozo sin validación ni soporte de variantes.
CURRENT_ORDER_STOCK_MUTATION=NO
CURRENT_ORDER_STOCK_TRANSACTION=NO (la validación no está dentro de ninguna
  transacción; la transacción de creación es READ COMMITTED y no toca stock)
CURRENT_ORDER_STOCK_MOVEMENT=NO
```

## 6. Arquitectura de stock en Caja (referencia)

`src/app/api/negocio/caja/ventas/route.ts`:

- `db.$transaction(..., { isolationLevel: Serializable })` (`:103`, `:215`).
- Relee productos + **todas** las variantes **dentro** de la transacción, con scope de
  tenant (`:111-113`).
- Valida por cantidad: `stockCantidad < line.cantidad` → 409 (`:144`, `:147`).
- Decrementa por read-modify-write absoluto `update({ stockCantidad: nextStock })`
  (`:182`, `:200`) — seguro bajo Serializable porque la transacción concurrente aborta
  con P2034.
- Registra `MovimientoInventario` `tipo: "VENTA"` con `stockAntes`/`stockDespues`/`ventaId`
  (`:183-191`, `:201-208`).
- Variante vs Producto mutuamente excluyentes por `continue` (`:178-195`).
- P2034 → 409, sin retry (`:233-238`). (El route de Mozo sí tiene retry acotado:
  `withSerializableRetry`, 3 intentos, `mozo/.../route.ts:645`.)

**Defecto latente encontrado (Caja):** `computeSaleFromAuthoritativeProducts`
(`src/lib/caja-venta.ts`) emite un item por línea pedida **sin agregar**, y el route no
rechaza líneas duplicadas (`caja/ventas/route.ts:85-100`). Dos líneas de la misma
`(productoId, varianteId)` se validan cada una contra el mismo snapshot, y el segundo
`update` pisa al primero → decremento de menos. La UI de Caja fusiona líneas idénticas,
así que sólo es alcanzable con una request armada por el propio negocio — integridad de
datos, no aislamiento entre tenants. **No se corrige en A0**; la autoridad compartida
propuesta (§14) agrega por clave, lo que lo resuelve.

```text
POS_STOCK_TRANSACTION_PATTERN=SERIALIZABLE_TX_READ_INSIDE_VALIDATE_QTY_ABSOLUTE_WRITE
POS_STOCK_CONCURRENCY_PATTERN=POSTGRES_SSI_P2034_TO_409_NO_RETRY
POS_STOCK_MOVEMENT_PATTERN=MOVIMIENTO_INVENTARIO_TIPO_VENTA_WITH_STOCK_ANTES_DESPUES_VENTAID
```

**Reutilizable:** transacción Serializable, lectura dentro de la transacción,
validación por cantidad, `resolveNextStock` (nunca negativo — `inventario.ts:175`),
exclusión variante/producto, ledger con antes/después, y el retry acotado de Mozo.
**No reutilizable tal cual:** Caja decrementa en el mismo instante de la venta
porque la venta *es* la entrega física; un Pedido tiene un intervalo entre compromiso
y salida física, que Caja no modela.

## 7. Autoridades de stock

Escritores de `stockCantidad` en todo el repo: Caja (`caja/ventas:182,200`),
Movimientos de Inventario (`inventario/movimientos:110,138`, Serializable `:152`),
stock inicial al crear producto (`productos/route.ts:267,317`) y variante
(`productos/[id]/variantes/route.ts:63`).

```text
BASE_PRODUCT_STOCK_AUTHORITY=Producto.stockCantidad, sólo si Producto.controlStock=true
  y el producto no tiene variantes
VARIANT_PRODUCT_STOCK_AUTHORITY=ProductoVariante.stockCantidad, sólo si
  ProductoVariante.controlStock=true; el Producto padre queda dormido (nunca se tocan
  ambos — exclusión por `continue` en Caja y en Movimientos)
```

## 8. Escenarios — qué ocurre HOY

| Caso | Hoy |
|---|---|
| A — stock=1, dos pedidos | Ambos se crean. Variante: el chequeo `<= 0` pasa para ambos (y corre fuera de transacción). Producto base con control: ni siquiera se chequea. |
| B — stock=1, pedido y luego Caja vende | El pedido no toca stock; Caja vende la unidad (stock→0). El pedido queda activo por una unidad inexistente. |
| C — stock=2, pedido de 1, Caja vende 2 | No hay reserva: Caja puede vender las 2. El pedido queda sobrevendido. |
| D — rechazo del negocio | Cancelación `vendedor` desde recibido/aceptado. Sin efecto de stock (nunca se tomó nada). |
| E — cancelación del cliente | Sin efecto de stock. |
| F — pedido abierto horas/días | Nada se retiene. No hay expiración para recibido/aceptado. |
| G — misma request reintentada | Con Idempotency-Key: mismo Pedido. Sin key: pedido duplicado posible (modo legacy). Sin efecto de stock en ninguno. |
| H — misma transición dos veces | El CAS la bloquea (conflict/409). Sin efecto de stock. |
| I — producto sin controlStock | Sin chequeos (correcto). |
| J — producto con variantes | Sólo `stock <= 0`, no por cantidad, no agregado, fuera de transacción. |
| K — Mesa | Cliente Mesa = igual que J. Mozo: sin soporte de variantes, sin chequeo, precio base. |
| L — pedido histórico | Sin metadata de stock; nada que reconciliar. |

## 9. Estrategia A — `DECREMENT_ON_ORDER_CREATION`

Decrementar `stockCantidad` físico dentro de la transacción de creación.

- **Pros:** evita la sobreventa en la creación; reutiliza el patrón de Caja casi tal
  cual; sin modelo nuevo de estado.
- **Contras:** registra una salida física que todavía no ocurrió (la mercadería sigue en
  el estante hasta prepararla) — contradice la semántica de `MovimientoInventario`
  (§23). Toda cancelación/rechazo requiere un movimiento inverso que se lee como una
  devolución física. El conteo físico deja de coincidir con el estante durante todo el
  intervalo abierto.
- **Cancelación/rechazo:** requiere restock automático con movimiento inverso,
  exactamente una vez.
- **Pedido abandonado:** stock ausente hasta que alguien cancele (no hay expiración).
- **Mesa/Caja:** Caja ve menos stock, correcto en disponibilidad pero incorrecto en
  "físico".
- **Idempotencia:** creación idempotente por la key existente; el restock necesita guard.
- **Concurrencia:** Serializable en la creación.
- **Históricos:** los pedidos viejos se cancelan sin restock → necesita distinguirlos.
- **UX Inventario:** "stock" baja al pedir, sube al cancelar — confuso para quien cuenta.

## 10. Estrategia B — `RESERVE_ON_ORDER_CREATION_CONSUME_LATER`

Separar stock **físico** (`stockCantidad`, sin cambios de semántica) de **reservado**
(compromisos de pedidos abiertos). `disponible = físico − reservado`.

- **Pros:** evita la sobreventa en la creación (la reserva es atómica con el Pedido); el
  físico sigue significando lo que hay en el local; liberar una reserva no genera ningún
  movimiento físico falso; el ledger sólo registra salidas reales.
- **Contras:** requiere modelo nuevo; Caja y Movimientos deben restar lo reservado; hay
  que elegir el punto de consumo y cubrir todos sus escritores.
- **Modelo:** tabla de reservas por línea de pedido (§24). Contador desnormalizado no
  recomendado como fuente de verdad (no idempotente, no auditable, sin forma de
  reconstruirlo).
- **Liberación:** cancelar antes del consumo marca la reserva LIBERADA; no toca físico.
- **Expiración:** una reserva de un pedido abierto no expira sola — igual que hoy el
  pedido no expira (§19).
- **Conversión reserva→consumo:** en el punto de consumo (§16): decrementar físico,
  marcar CONSUMIDA, registrar movimiento.
- **Caja/Inventario:** deben usar `disponible`.
- **Idempotencia:** creación por la key existente; consumo/liberación atados al CAS de
  `estado` + CAS propio de la fila de reserva.
- **Concurrencia:** Serializable (SSI) en creación, consumo y Caja.
- **Requiere:** modelo nuevo **y** un campo nuevo (`MovimientoInventario.pedidoId`).

## 11. Estrategia C — `DECREMENT_OR_RESERVE_ON_BUSINESS_ACCEPTANCE`

Nada en la creación; reservar/decrementar al aceptar.

- **Race creación→aceptación:** stock=1, dos pedidos creados, ambos visibles; el negocio
  acepta el primero (gana), el segundo falla al aceptar por falta de stock → el negocio
  tiene que cancelarlo. El cliente hizo un pedido que el sistema aceptó sin
  compromiso real. **No evita la sobreventa en la creación** — la traslada.
- **Descalificante por evidencia del código:** `aceptado` **no es un checkpoint
  universal**. Mesa nunca pasa por `aceptado` (`MESA_PASA_POR_ACEPTADO=false`,
  `order-transitions.ts:46`) y la arista legacy `recibido→preparando`
  (`order-transitions.ts:121,126`) lo saltea en domicilio/retiro. Un hook "al aceptar"
  dejaría caminos sin cobertura, o tendría que dispararse también en
  `recibido→preparando`, lo cual ya no es "al aceptar".

## 12. Estrategia D — no aplica como estrategia separada

La evidencia de §3 (todo camino pasa por `preparando`) no sugiere una cuarta estrategia
de *reserva*, sino un **punto de consumo** preciso para B. Se evaluó y descartó
"validar en la creación sin reservar + consumir en `preparando`": deja abierto el Caso A
(dos pedidos pasan la validación por la última unidad; el segundo falla recién al
preparar). Queda registrado como variante descartada de B, no como D.

## 13. Matriz de decisión

| STRATEGY | PREVENTS_OVERSELL_AT_CREATION | CANCEL_RELEASE_REQUIRED | SUPPORTS_CAJA_CONCURRENCY | DATA_MODEL_COMPLEXITY | IDEMPOTENCY_COMPLEXITY | OPEN_ORDER_RISK | UX_IMPACT | MIGRATION_IMPACT | HISTORICAL_COMPATIBILITY | NOTES |
|---|---|---|---|---|---|---|---|---|---|---|
| A — decrementar al crear | Sí | Sí, con movimiento físico inverso | Sí (ya comparten `stockCantidad`) | Baja | Media (restock exactly-once) | Stock "ausente" indefinido | Físico ≠ estante mientras el pedido esté abierto | Baja (campo `pedidoId` en movimiento) | Requiere distinguir pedidos sin decremento previo | Movimientos físicos falsos en cada cancelación |
| B — reservar al crear, consumir en `preparando` | Sí | Sí, sin movimiento físico (sólo estado de reserva) | Sí, si Caja lee reservas en su tx Serializable | Media (tabla nueva + 1 campo) | Media (CAS de estado + CAS de fila + unique por línea) | Reserva indefinida (igual que el pedido) | Físico = estante; UI debe mostrar reservado/disponible | Media, aditiva | Natural: sin filas de reserva → sin efecto | Ledger sólo registra salidas reales |
| C — al aceptar | **No** (traslada el conflicto) | Sí | Sí | Media | Media | Menor | El cliente pide cosas que después se cancelan | Media | Natural | **`aceptado` no es universal** (Mesa, arista legacy) |

## 14. Arquitectura recomendada

```text
RECOMMENDED_ORDER_STOCK_STRATEGY=
  RESERVE_ON_ORDER_CREATION_CONSUME_ON_PREPARANDO (Estrategia B)
```

Una **autoridad compartida de stock** en `src/lib/` (propuesta, nombre tentativo
`stock-authority.ts`), pura en su cálculo y con funciones transaccionales que reciben el
`tx`:

- `agregarCantidadesPorClave(items)` → total por `(productoId, productoVarianteId | null)`.
- `calcularDisponible(fisico, reservadoActivo)` → `fisico − reservado`, sólo con control.
- `reservarStockPedido(tx, { negocioId, pedidoId, items })`
- `consumirReservasPedido(tx, { negocioId, pedidoId })`
- `liberarReservasPedido(tx, { negocioId, pedidoId, motivo })`

Todos los escritores (creación, consumo, liberación, Caja, Movimientos) la usan; ningún
route vuelve a calcular disponibilidad por su cuenta — mismo principio de autoridad
única que `order-transitions.ts` y `product-variant-search.ts`.

## 15. Punto de reserva

```text
RESERVATION_POINT=
  POST /api/pedidos — dentro de la $transaction existente (route.ts:1715), antes de
  tx.pedido.create (:1861), con la transacción elevada a Serializable; y
  POST /api/operativo/mozo/panel/[slug]/pedidos — dentro de su transacción
  Serializable existente (:1265), una vez que el route tenga soporte de variantes (§27)
RESERVATION_ATOMIC_WITH_ORDER_CREATION=YES
```

Dentro de la transacción: agregar cantidades por clave, releer físico + reservado activo
de cada clave controlada, rechazar si `disponible < pedido` (409 con mensaje por
producto/variante), crear el Pedido y sus filas de reserva. Si cualquier item falla,
rollback de todo — ni Pedido ni reservas parciales. Esto también cierra dos brechas
actuales: la validación queda **por cantidad** y cubre **productos base** con control.

## 16. Punto de consumo

```text
CONSUMPTION_POINT=
  Transición a `preparando` (desde recibido, aceptado o el origen legacy), ejecutada
  en la MISMA transacción Serializable que el CAS de estado, y sólo si el CAS ganó
  (count === 1)
```

**Justificación por state machine:** `preparando` es el único estado por el que pasan
los tres modos y ambas aristas (nueva y legacy) antes de `entregado` (§3). Su significado
de negocio es "el negocio separa físicamente la mercadería" — el momento real en que la
unidad deja de estar disponible en el estante. Consumir en `entregado` se descartó: una
cancelación tardía (por ejemplo en `en_camino`) liberaría disponible de inmediato
mientras la mercadería está físicamente con el repartidor — Caja podría venderla.

Escritores de `→ preparando` que deben ejecutar el consumo:
`negocio/pedidos/[id]/estado`, `operaciones/pyr/pedidos/[id]/estado`,
`operativo/pyr/pedidos/[id]/preparar`, `operativo/salon/pedidos/[id]/preparar`,
`operaciones/salon/pedidos/[id]/estado`. Hoy los de Negocio son un CAS plano sin
transacción; deberán envolverse en `$transaction` Serializable.

## 17. Matriz de liberación

| EVENT | CURRENT_STATE | RESERVATION_EXISTS | RELEASE_REQUIRED | STOCK_RETURN_REQUIRED | IDEMPOTENCY_GUARD |
|---|---|---|---|---|---|
| Cancelación del cliente | recibido / confirmado / aceptado (únicos cancelables por cliente) | Sí (ACTIVA) | Sí | No (el físico nunca bajó) | CAS de estado + `updateMany where estado=ACTIVA` |
| Rechazo del negocio | recibido / aceptado | Sí (ACTIVA) | Sí | No | idem |
| Cancelación del negocio/PyR | preparando / esperando_repartidor / en_camino / listo_para_retirar | No (ya CONSUMIDA) | No | **No automático** (§18) | CAS de estado |
| Cancelación de Mesa | recibido | Sí (ACTIVA) | Sí | No | CAS de estado + CAS de fila |
| Cancelación de Mesa | preparando / listo_para_retirar | No (CONSUMIDA) | No | No automático | CAS de estado |
| Auto-cancel (sistema) | esperando_repartidor / en_camino sin repartidor | No (CONSUMIDA) | No | **Decisión de producto abierta** (§33) | CAS de estado |
| Timeout | — no existe hoy para recibido/aceptado (§19) | — | — | — | — |
| Transición fallida | cualquiera | sin cambios | No — la transacción entera hace rollback | No | atomicidad de la transacción |
| entregado | en_camino / listo_para_retirar | No (CONSUMIDA en preparando) | No | No | CAS de estado |

```text
RELEASE_POINTS=cancelación desde recibido/confirmado/aceptado por cualquier actor
  (cliente, vendedor = rechazo, PyR, Mesa) — dentro de la misma $transaction que el
  CAS de cancelación, junto a la reversión de deuda existente
```

## 18. Cancelación tardía

```text
LATE_CANCELLATION_STOCK_POLICY=
  NO_AUTOMATIC_RESTOCK_AFTER_CONSUMPTION — cancelar desde preparando o cualquier estado
  posterior no devuelve stock automáticamente. Si la mercadería vuelve al estante, el
  negocio lo registra con el flujo existente "Ajustar stock" (ENTRADA/AJUSTE), que ya
  deja un MovimientoInventario trazado.
```

Motivo: después de `preparando` la unidad puede estar empaquetada, en viaje, dañada o
consumida — sólo el negocio sabe si es revendible. Un restock automático inflaría el
stock en silencio. Cliente nunca llega a este caso (sólo cancela antes de `preparando`).

## 19. Pedidos abiertos indefinidamente

No existe expiración para pedidos en `recibido`/`aceptado`. El único auto-cancel
(`repartidor/pedidos/auto-cancel`) cubre sólo domicilio esperando repartidor, lo dispara
la app del Repartidor (no un cron), y ocurre **después** de `preparando`. Los únicos
crons del repo son de expiración de ocupación de mesa y de moderación de reseñas.

```text
ORDER_RESERVATION_EXPIRATION_SUPPORT=NO
```

**Política futura propuesta (no implementada):** en la primera implementación, sin TTL de
reserva — la reserva vive lo que vive el pedido, igual que hoy. Mitigación: Inventario
muestra "reservado" (§29) para que el negocio vea y cancele pedidos estancados. Si más
adelante hace falta, un cron opcional de auto-cancelación de `recibido` antiguo, con el
mismo patrón que `scripts/expire-mesa-occupancies.ts`. Umbral y existencia son decisión
de producto (§33).

## 20. Idempotencia

```text
ORDER_STOCK_IDEMPOTENCY_STRATEGY=
  (1) reservar: dentro de la transacción de creación → hereda la idempotencia existente
      del Pedido (unique negocioId+idempotencyKey + fingerprint; el perdedor de la
      carrera P2002 hace rollback completo, reservas incluidas);
  (2) una reserva por línea: @@unique(pedidoItemId) en la tabla de reservas — un
      segundo intento de reservar la misma línea falla a nivel DB;
  (3) consumir/liberar: sólo corren si el CAS de Pedido.estado ganó (count === 1) en la
      misma transacción, y además cada fila se transiciona con CAS propio
      `updateMany where { id, estado: "ACTIVA" }` — un segundo intento encuentra 0 filas;
  (4) estado observable: ReservaStock.estado ∈ {ACTIVA, CONSUMIDA, LIBERADA} +
      consumidaEn / liberadaEn.
```

¿Cómo se sabe que existe una reserva? Fila ACTIVA para ese `pedidoItemId`. ¿Que fue
liberada? `estado=LIBERADA` + `liberadaEn`. ¿Que fue consumida? `estado=CONSUMIDA` +
`consumidaEn` + un `MovimientoInventario` con ese `pedidoId`. Doble click, reintento,
endpoint llamado dos veces o cron repetido: todos colisionan en el CAS de estado o en el
CAS de fila. Ningún guard depende de la UI.

## 21. Concurrencia

```text
ORDER_STOCK_CONCURRENCY_STRATEGY=
  REUSE_PRISMA_SERIALIZABLE (Postgres SSI) en creación, consumo, Caja y Movimientos;
  bounded retry ante P2034 (patrón withSerializableRetry del route de Mozo, 3 intentos);
  agotado → 409 con mensaje de stock, nunca 500
```

Caso obligatorio: `disponible = 1`, dos requests simultáneas. Cada transacción lee el
físico de la clave y la suma de reservas ACTIVA (lectura de predicado), valida e inserta
una fila de reserva. Bajo SSI, las dos transacciones forman una dependencia
lectura-escritura sobre el mismo predicado → Postgres aborta una con 40001 (P2034). La
ganadora confirma; la perdedora reintenta, ahora ve `disponible = 0`, y responde 409.
**SUCCESS_COUNT <= 1**, reservado nunca supera al físico, físico nunca negativo
(`resolveNextStock`).

**Límites de transacción:** lectura → validación → escritura, todo dentro de la misma
transacción Serializable. Riesgo de contención medido en §5: la transacción de creación
sólo escribe la fila del propio cliente y el Pedido, así que elevarla a Serializable
agrega conflictos sobre todo donde se buscan (misma clave de stock).

## 22. Caja vs Pedido

```text
CAJA_VS_PEDIDO_INTERACTION=
  Caja y Movimientos validan contra DISPONIBLE (físico − reservado activo), leyendo las
  reservas dentro de su propia transacción Serializable, vía la autoridad compartida.
  Una venta de Caja nunca consume una unidad reservada para un pedido.
```

Ejemplo `físico=2, reservado=1`: Caja puede vender 1, no 2. Si Caja y la creación de un
pedido compiten por la última unidad disponible, SSI aborta una (§21). Movimientos:
**SALIDA** que dejaría `físico < reservado` → rechazar con mensaje (propuesta);
**AJUSTE** (reconteo físico) siempre permitido porque refleja la realidad, con aviso si
el resultado deja `físico < reservado` (decisión de producto, §33). Liberar una reserva
concurrente con Caja sólo puede producir un falso negativo en Caja (dirección segura).

## 23. Semántica de MovimientoInventario

Comentario del schema: "Traza cada cambio de `Producto.stockCantidad`… Nunca se escribe
`stockCantidad` a mano: todo cambio pasa por un movimiento acá"; `stockAntes`/`stockDespues`
describen `stockCantidad`; `tipo ∈ {ENTRADA, SALIDA, AJUSTE, VENTA}`; sólo `ventaId` como
referencia (`schema.prisma:374-396`). Es un **ledger de stock físico**.

```text
ORDER_INVENTORY_MOVEMENT_STRATEGY=
  EXTEND para el consumo (nuevo tipo "PEDIDO" + campo nullable pedidoId, porque el
  consumo SÍ cambia stock físico) + SEPARATE_RESERVATION_MODEL para la reserva (una
  reserva no cambia stockCantidad, así que no debe crear un MovimientoInventario)
```

## 24. Modelo de datos propuesto (sólo diseño)

```prisma
// Propuesta — NO aplicada. Nombres en español, consistentes con ProductoVariante,
// MovimientoInventario, VentaItem.
model ReservaStock {
  id                 String    @id @default(cuid())
  negocioId          String
  pedidoId           String
  pedidoItemId       String
  productoId         String
  productoVarianteId String?   // set sólo si el producto tiene variantes (misma regla que MovimientoInventario)
  cantidad           Float     // Float como stockCantidad (unidades kg/litro)
  estado             String    // ACTIVA | CONSUMIDA | LIBERADA
  motivoLiberacion   String?   // p. ej. CANCELADO_CLIENTE | CANCELADO_VENDEDOR | CANCELADO_MESA
  createdAt          DateTime  @default(now())
  consumidaEn        DateTime?
  liberadaEn         DateTime?

  negocio          Negocio           @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  pedido           Pedido            @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  pedidoItem       PedidoItem        @relation(fields: [pedidoItemId], references: [id], onDelete: Cascade)
  producto         Producto          @relation(fields: [productoId], references: [id], onDelete: Cascade)
  productoVariante ProductoVariante? @relation(fields: [productoVarianteId], references: [id], onDelete: SetNull)

  @@unique([pedidoItemId])                 // una reserva por línea → idempotencia a nivel DB
  @@index([productoId, estado])            // reservado activo de producto base
  @@index([productoVarianteId, estado])    // reservado activo de variante
  @@index([pedidoId])
  @@map("reservas_stock")
}

// MovimientoInventario — extensión aditiva:
//   pedidoId String?   + relación a Pedido (onDelete: SetNull) + @@index([pedidoId])
//   tipo gana el valor "PEDIDO" (es String, no requiere cambio de enum)
```

Reservado activo de una clave = `SUM(cantidad) WHERE estado='ACTIVA'` filtrado por
`productoVarianteId` (variante) o por `productoId AND productoVarianteId IS NULL`
(producto base). Soporta producto simple, variante, tenant, idempotencia, histórico,
múltiples líneas por producto (se suman), cancelación y consumo. No se propone contador
desnormalizado en esta etapa.

```text
SCHEMA_CHANGE_REQUIRED=YES (en implementación; nada en A0)
MIGRATION_REQUIRED=YES (aditiva: 1 tabla nueva + 1 columna nullable + índices;
  DESTRUCTIVE_STATEMENTS=0 esperado)
```

## 25. Compatibilidad histórica

Un pedido creado antes de la implementación no tiene filas de reserva. Regla: el consumo
y la liberación operan **sólo sobre filas ACTIVA existentes**; sin filas → sin efecto de
stock, exactamente como hoy. Productos sin control nunca generan filas.

```text
HISTORICAL_ORDERS_BACKFILL_REQUIRED=NO
```

## 26. Multi-tenant

```text
ORDER_STOCK_TENANT_STRATEGY=
  negocioId siempre derivado server-side (el Pedido y los Productos ya se validan contra
  el negocio autoritativo en route.ts:859-869); la fila de reserva copia ese negocioId;
  la variante debe pertenecer al producto (chequeo existente route.ts:986-988); consumo
  y liberación siempre filtran por { pedidoId, negocioId }; Caja/Movimientos suman
  reservas con scope de negocio. Nunca se acepta negocioId del cliente.
```

## 27. Mesa

```text
MESA_STOCK_BEHAVIOR_CURRENT=Cliente Mesa: igual que Cliente normal (validación parcial
  de variante, sin mutación). Mozo: sin soporte de variantes, sin validación de stock,
  precio base.
MESA_STOCK_BEHAVIOR_PROPOSED=Idéntico a Cliente normal: reserva en la creación (ambos
  entrypoints), consumo en recibido→preparando, liberación sólo al cancelar desde
  recibido, sin restock automático desde preparando/listo_para_retirar.
  PRERREQUISITO: el route de pedidos manuales de Mozo necesita soporte de variantes
  (selección, precio de variante, validación) antes de poder reservar correctamente
  — hoy crea pedidos de productos con variantes sin variante y al precio base.
```

## 28. Repetir pedido

```text
REPEAT_ORDER_STOCK_REQUIREMENT=
  Repetir nunca reutiliza reservas viejas ni precios históricos como autoridad (ya es
  así: PUT .../repetir sólo revalida, y el pedido nuevo pasa por POST /api/pedidos, que
  reserva de nuevo). Cambio necesario: su chequeo de disponibilidad debe usar
  DISPONIBLE (físico − reservado), no stockCantidad (hoy repetir/route.ts:77-117).
```

## 29. Implicancias de UI

```text
INVENTORY_UI_RESERVATION_VISIBILITY_REQUIRED=YES — Físico / Reservado / Disponible para
  productos y variantes con control. Sin esto, el negocio ve 10 en el estante y Caja le
  rechaza vender 10 con 3 reservadas, sin explicación.
CAJA_UI_RESERVATION_VISIBILITY_REQUIRED=YES (mínimo) — Caja usa disponible internamente;
  cuando rechaza por reservas, el mensaje debe decirlo ("N unidades reservadas para
  pedidos"). Una columna de "Reservado" en Caja es opcional.
```

Además (no UI de negocio): la API pública hoy expone `stockCantidad` crudo de variantes
(`negocios/[slug]/route.ts:274`) y el Cliente calcula "Sin stock" con él
(`client-product-variants.ts`). Con reservas, ese cálculo debe usar disponible — y
conviene exponer sólo disponible (o un booleano), no el físico.

## 30. Matriz de pruebas para la implementación

```text
IMPLEMENTATION_TEST_MATRIX=
  A. producto simple stock=1, dos POST /api/pedidos concurrentes → exactamente 1 éxito, 1×409
  B. variante stock=1, dos pedidos concurrentes → exactamente 1 éxito
  C. pedido vs Caja concurrentes por la última unidad → exactamente 1 éxito, nunca sobreventa
  D. cancelación del cliente libera exactamente una vez (fila LIBERADA, físico intacto)
  E. rechazo del negocio (cancelado desde recibido/aceptado) libera exactamente una vez
  F. doble cancelación concurrente → una sola liberación, disponible no se duplica
  G. doble transición a preparando concurrente → un solo consumo, un solo movimiento PEDIDO
  H. producto sin controlStock → ninguna fila de reserva, ningún bloqueo
  I. variante inactiva → rechazada, sin reserva
  J. variante con disponible 0 (o menor a la cantidad) → rechazada, sin reserva
  K. cross-tenant: producto/variante de otro negocio → rechazado, sin reserva
  L. Mesa: reserva al crear, consumo en recibido→preparando, cancelación desde recibido libera
  M. repetir pedido: disponibilidad usa disponible; el pedido nuevo reserva de nuevo
  N. pedido histórico sin filas → preparando y cancelación no tocan stock
  O. varios items, uno sin disponible → 409 y rollback completo (ni Pedido ni reservas)
  P. falla forzada a mitad de la transacción de consumo → rollback de CAS + filas + físico
  + cantidad agregada: dos líneas de la misma variante suman contra el disponible
  + cancelación tardía (desde preparando) → sin restock automático
  + Caja con líneas duplicadas de la misma variante → decremento correcto (cierra el defecto de §6)
  Todas como tests de DB real contra TESTING (convención actual), con las concurrentes
  vía Promise.all como en caja/ventas.
```

## 31. Rollback de la futura implementación

```text
FUTURE_ROLLBACK_STRATEGY=
  Schema aditivo → el código viejo convive sin tocarlo. Flag de servidor
  (p. ej. ORDER_STOCK_RESERVATION_ENABLED) para la creación de reservas. Desactivar =
  dejar de crear filas nuevas, pero seguir honrando las ACTIVA existentes (consumo,
  liberación y resta en Caja) hasta que se vacíen — nunca se ignoran reservas vivas.
  Rollback duro: script auditable que marca LIBERADA toda fila ACTIVA. Como una reserva
  nunca modificó stockCantidad, desactivar no puede corromper el stock físico; sólo el
  consumo lo modifica, y cada consumo ya dejó su MovimientoInventario trazado.
```

## 32. Fases de implementación propuestas

La reserva sin liberación (o sin que Caja la respete) degrada disponibilidad o
sobrevende. Por eso el flag permanece **apagado** hasta que I1–I4 estén todas
integradas, y recién ahí se enciende en TESTING para certificar.

```text
IMPLEMENTATION_PHASES=
  R3A-P0 — Paridad de variantes en pedidos manuales de Mozo (selección, precio,
    validación). Prerrequisito de Mesa; también corrige un bug de precio
    independiente. Schema: probablemente ninguno (PedidoItem ya tiene
    productoVarianteId/varianteNombre). Riesgo: bajo-medio. Tests: DB real del route
    de Mozo. Rollback: revert. Revisión manual: sí.
  R3A-I1 — Modelo + autoridad pura: ReservaStock, MovimientoInventario.pedidoId,
    helpers puros (agregación por clave, disponible). Sin cambios de comportamiento.
    Schema: sí (migración aditiva). Riesgo: bajo. Tests: unitarios + migración.
    Rollback: revert (tabla sin uso). Revisión manual: no.
  R3A-I2 — Reserva atómica en la creación (POST /api/pedidos Serializable + retry),
    liberación en todas las cancelaciones pre-preparando, consumo en todos los
    escritores de →preparando. Todo detrás del flag, APAGADO. Schema: no. Riesgo:
    alto (toca ~10 routes de transición). Tests: A, B, D–J, L, N–P. Rollback: flag
    apagado = comportamiento actual. Revisión manual: no hasta encender.
  R3A-I3 — Caja y Movimientos respetan disponible (vía la autoridad compartida);
    agregación de líneas duplicadas en Caja; política de SALIDA/AJUSTE. Schema: no.
    Riesgo: medio. Tests: C, agregación, SALIDA. Rollback: revert. Revisión manual: sí.
  R3A-I4 — Visibilidad: Inventario (Físico/Reservado/Disponible), mensajes de Caja,
    API pública y repetir usan disponible. Schema: no. Riesgo: bajo. Tests: estáticos +
    M. Rollback: revert. Revisión manual: sí.
  R3A-I5 — Encender el flag en TESTING + regresión completa (Cliente normal, Mesa,
    Mozo, Caja, Inventario, repetir, históricos) + certificación manual del operador.
    Schema: no. Riesgo: medio. Rollback: apagar el flag (§31). Revisión manual: sí.
```

## 33. Riesgos y decisiones de producto no resueltas

```text
UNRESOLVED_PRODUCT_DECISIONS=
  1. Auto-cancel del sistema (domicilio sin repartidor, post-preparando): ¿restock
     automático? La mercadería suele seguir en el local, pero la política general
     propuesta es no reponer automáticamente. Requiere decisión explícita.
  2. Expiración de pedidos recibido/aceptado estancados: ¿existe? ¿umbral? (hoy no hay).
  3. Consumo cuando el físico ya no alcanza (p. ej. tras un AJUSTE a la baja):
     propuesto bloquear →preparando con 409 explícito (resolveNextStock ya prohíbe
     negativos); alternativa: permitir y registrar faltante.
  4. Movimientos de Inventario: ¿rechazar SALIDA que deje físico < reservado? ¿permitir
     AJUSTE siempre con aviso? (propuesta: sí y sí).
  5. Mozo: aprobar R3A-P0 (paridad de variantes) como parte de R3A o como tarea separada.
  6. Qué exponer en la API pública: disponible numérico o sólo booleano.
```

Riesgos técnicos: la fase I2 toca todos los escritores de transición (~10 routes) —
superficie grande, por eso va detrás del flag; elevar la creación de pedidos a
Serializable puede aumentar reintentos bajo carga en el mismo producto (mitigado con
retry acotado y 409 claro); el defecto latente de Caja (§6) sigue presente hasta I3.

## 34. Markers finales

```text
CURRENT_ORDER_STOCK_BEHAVIOR=PARTIAL_VARIANT_ONLY_VALIDATION_NO_RESERVATION_NO_DECREMENT
  (variante: sólo stock<=0, no por cantidad, fuera de transacción; producto base: sin
  validación de stock; Mozo: sin soporte de variantes ni validación)

RECOMMENDED_ORDER_STOCK_STRATEGY=RESERVE_ON_ORDER_CREATION_CONSUME_ON_PREPARANDO

RESERVATION_POINT=POST /api/pedidos transacción de creación (route.ts:1715, elevada a
  Serializable) + transacción Serializable de pedidos manuales de Mozo (tras R3A-P0)

CONSUMPTION_POINT=transición a preparando, en la misma transacción Serializable que el
  CAS de estado

RELEASE_POINTS=cancelación desde recibido/confirmado/aceptado por cualquier actor, en la
  misma transacción que el CAS de cancelación

ORDER_STOCK_CONCURRENCY_STRATEGY=REUSE_PRISMA_SERIALIZABLE_SSI_WITH_BOUNDED_RETRY_THEN_409

ORDER_STOCK_IDEMPOTENCY_STRATEGY=CREATION_IDEMPOTENCY_KEY_INHERITED + UNIQUE_RESERVATION_PER_PEDIDO_ITEM
  + STATE_CAS_GATES_SIDE_EFFECTS + ROW_CAS_ON_RESERVATION_ESTADO

ORDER_INVENTORY_MOVEMENT_STRATEGY=EXTEND_FOR_CONSUMPTION_TIPO_PEDIDO_PLUS_SEPARATE_RESERVATION_MODEL

CAJA_VS_PEDIDO_INTERACTION=CAJA_AND_MOVIMIENTOS_VALIDATE_AGAINST_AVAILABLE_READING_RESERVATIONS_IN_SERIALIZABLE_TX

SCHEMA_CHANGE_REQUIRED=YES

MIGRATION_REQUIRED=YES

HISTORICAL_ORDERS_BACKFILL_REQUIRED=NO

INVENTORY_UI_RESERVATION_VISIBILITY_REQUIRED=YES

CAJA_UI_RESERVATION_VISIBILITY_REQUIRED=YES

MESA_STOCK_BEHAVIOR_PROPOSED=SAME_AS_NORMAL_CLIENT_REQUIRES_MOZO_VARIANT_PARITY_FIRST

IMPLEMENTATION_PHASES=R3A-P0 (Mozo variant parity) → I1 (model) → I2 (reserve/consume/release,
  flag OFF) → I3 (Caja/Movimientos available) → I4 (visibility) → I5 (flag ON in TESTING +
  manual certification)

UNRESOLVED_PRODUCT_DECISIONS=6 (ver §33)

SOURCE_CODE_CHANGED=NO

PRODUCTION_TOUCHED=NO

P2_T56_R3A_STATUS=DESIGN_COMPLETE_AWAITING_OPERATOR_ARCHITECTURE_DECISION

NEXT_ACTION=RETURN_TO_OPERATOR_FOR_STOCK_LIFECYCLE_DECISION (no implementation is
  authorized by this design; R3A-P0/I1 are not started)
```
