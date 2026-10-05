# P2-T56-R3A — Order Stock Lifecycle — A0 Auditoría + Diseño · A0.1 Hardening

Date: 2026-09-30
Branch: `work/p2-t56-r3-stock-lifecycle`
Branch base: `1e14355c617cad33ab33c3fdda508c6a93830f4e` (== `origin/testing-codex` tip at start)
Fases: A0 — auditoría + diseño (§1–§34); **A0.1 — architecture hardening + product
decisions (sección final "A0.1 Architecture Hardening")**. Ninguna implementa nada.
Ningún archivo de source, schema, migración, DB, Railway ni Production fue tocado.

> **Autoridad vigente:** donde A0.1 cambia algo, **A0.1 reemplaza a A0**. Las
> secciones A0 se conservan como registro histórico; las que quedaron superadas
> están marcadas inline con "SUPERSEDED BY A0.1".

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

## 15. Punto de reserva — SUPERSEDED BY A0.1 (secuencia exacta: A0.1-3)

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

## 16. Punto de consumo — escritores corregidos por A0.1 (6, no 5: A0.1-11)

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

## 17. Matriz de liberación — SUPERSEDED BY A0.1 (decisiones resueltas + 6 sitios: A0.1-12)

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

## 19. Pedidos abiertos indefinidamente — RESUELTO EN A0.1 (decisión 2)

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

## 22. Caja vs Pedido — SUPERSEDED BY A0.1 (política SALIDA/AJUSTE decidida: A0.1-1, A0.1-10)

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

## 24. Modelo de datos propuesto (sólo diseño) — SUPERSEDED BY A0.1 (modelo final: A0.1-17)

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

## 29. Implicancias de UI — contrato de API pública fijado en A0.1-15

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

## 31. Rollback de la futura implementación — SUPERSEDED BY A0.1 (modos ON/DRAINING/OFF: A0.1-9)

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

## 32. Fases de implementación propuestas — SUPERSEDED BY A0.1 (A0.1-20)

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

## 33. Riesgos y decisiones de producto no resueltas — HISTÓRICO: las 6 decisiones quedaron resueltas en A0.1-1

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

## 34. Markers finales A0 — HISTÓRICOS (reemplazados por los markers de A0.1-23)

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

(Los dos markers de arriba son el estado al cierre de A0 — reemplazados por A0.1-23.)

---

## A0.1 Architecture Hardening

Fecha: 2026-09-30. Base: commit A0 `238ccade48dd686fb3d607a6100c98eea63aa59a`.
La estrategia de A0 (`RESERVE_ON_ORDER_CREATION_CONSUME_ON_PREPARANDO`) queda
**aceptada como dirección** por el operador; **la implementación sigue sin
autorizar**. A0.1 sólo endurece el diseño. Toda afirmación sobre código cita
archivo y línea del commit base (verificado read-only en esta ronda).

```text
A0_REPORT_READ=YES
CANONICAL_DOCS_READ=YES
PREFLIGHT=CURRENT_BRANCH work/p2-t56-r3-stock-lifecycle; LOCAL_HEAD 238ccade…;
  REMOTE_TESTING_CODEX 1e14355c… (leído, sin cambios); 0 archivos trackeados
  modificados; 0 staged; 0 stash
```

### A0.1-0 Correcciones a A0 encontradas en esta ronda

1. **Escritores de `→ preparando`: son 6, no 5.** A0 omitió
   `PUT /api/negocio/pedidos` (`src/app/api/negocio/pedidos/route.ts:239`), que usa
   la pestaña Salón de Negocio (`salon-tab.tsx`) sólo para pedidos de mesa
   (filtro `metodoEntrega: "mesa"` en servidor) con el grafo
   `ACTIVE_FORWARD_TRANSITIONS`. Verificación exhaustiva: los 4 routes genéricos
   que validan un estado pedido (`isValidForwardTransition` /
   `REQUIRED_CURRENT_BY_TARGET`) + los 2 fijos `operativo/{pyr,salon}/.../preparar`.
   Los otros hits de `estado: "preparando"` (`buscar-repartidor`, `listo-para-retiro`,
   `listo`) lo usan como **origen** en el WHERE, no como destino.
2. **Sitios de cancelación: son 6** — exactamente los llamadores de
   `revertirTarifaSiCorresponde` (`pedido-cancelacion-financiera.ts:58`): Cliente
   (`cliente/pedidos/[id]`), Negocio estado (`negocio/pedidos/[id]/estado`), Negocio
   Salón (`negocio/pedidos` PUT — también omitido en A0), Operaciones PyR
   (`operaciones/pyr/pedidos/[id]/estado`), auto-cancel (`repartidor/pedidos/auto-cancel`)
   y Mesa (`mesa-pedido-cancelacion.ts`, usado por `operaciones/pedidos/[id]/cancelar`).
3. **Hallazgo lateral (no se corrige en R3A):** ningún route de inventario chequea
   `rubro` en servidor (`negocio/productos` POST/PUT, `variantes` POST/PUT,
   `inventario/movimientos`, `caja/ventas`); el gate es sólo de UI
   (`business-panel.tsx` muestra Caja/Inventario sólo con `rubro === "negocio"`).
4. **Hallazgo lateral (comportamiento existente, no se cambia):**
   `DELETE /api/negocio/productos/[id]` hace **hard delete** incondicional
   (`route.ts:390`); por `onDelete: Cascade` en `MovimientoInventario.producto`, borra
   el historial de movimientos de ese producto.

### A0.1-1 Decisiones de producto adoptadas (aprobadas por el operador)

```text
AUTO_CANCEL_POST_PREPARANDO_RESTOCK=NO
LATE_CANCELLATION_STOCK_POLICY=NO_AUTOMATIC_RESTOCK_AFTER_CONSUMPTION
ORDER_RESERVATION_EXPIRATION_INITIAL_POLICY=NO_AUTOMATIC_EXPIRATION_IN_FIRST_IMPLEMENTATION
  FOLLOW_UP=STALE_OPEN_ORDER_EXPIRATION_POLICY
PHYSICAL_BELOW_RESERVED_POLICY=available clamped at 0 + RESERVATION_DEFICIT reported;
  →preparando blocked with 409 STOCK_RESERVATION_DEFICIT when physical can't cover THAT
  order's reservation; physical never negative
MANUAL_MOVEMENT_POLICY=ENTRADA always; SALIDA rejected if physicalAfter < activeReserved;
  AJUSTE always allowed (physical truth), persists, reports deficit + warning, never
  touches reservations silently
MOZO_VARIANT_PARITY_SCOPE=R3A_P0_REQUIRED_PREREQUISITE (own certifiable sub-phase, own
  commit, closed before reservations are enabled)
PUBLIC_STOCK_AVAILABILITY_STRATEGY=EXPOSE_DERIVED_AVAILABLE_QUANTITY_NOT_PHYSICAL_STOCK
```

### A0.1-2 Scope por rubro

Evidencia: las rutas que pueden poner `controlStock=true` o crear variantes no
chequean `rubro` (A0.1-0 #3); en la práctica sólo el negocio genérico lo hace, porque
sólo `rubro === "negocio"` ve las pestañas Inventario/Caja (`business-panel.tsx`) y los
formularios de producto de Restaurante/Ropa no envían esos campos (comentario en
`negocio/productos/route.ts:218`). Pero **no hay garantía de servidor**: un Restaurante
podría tener `controlStock=true` vía API directa.

```text
R3A_RUBRO_SCOPE=GENERIC_BUSINESS_ONLY
R3A_RUBRO_GATE=explicit server-side predicate isGenericBusinessStockScope(negocio.rubro)
  (true only for "negocio"), evaluated in the order-creation route BEFORE any stock
  logic; pure and unit-tested. For any other rubro: no reservation, no new validation,
  no isolation change — POST /api/pedidos behaves exactly as today.
RESTAURANTE_ORDER_STOCK_BEHAVIOR_CHANGED=NO
ROPA_ORDER_STOCK_BEHAVIOR_CHANGED=NO
```

Caja/Movimientos no están gateados por rubro hoy (sólo por UI). Con R3A restan
reservas activas; para un negocio fuera de scope nunca existen reservas (el gate de
creación lo impide), así que restan 0 → sin cambio de comportamiento para ellos.

### A0.1-3 Secuencia de creación con reserva (resuelve la inconsistencia de A0)

Auditoría: `pedidoCreateData` se arma **antes** de la transacción
(`pedidos/route.ts:1660`) con `items: { create: validatedItems.map(...) }` anidado
(`:1692-1693`); se inserta con `tx.pedido.create({ data, include: { items: true } })`
(`:1861-1869`). Los IDs vienen de `@default(cuid())`; ningún código pre-genera IDs.
El `include` no tiene `orderBy`, así que mapear reservas por posición del array
retornado dependería de un orden accidental.

- **OPTION_A — pre-generar el ID de cada PedidoItem server-side** (`crypto.randomUUID()`,
  ya usado en `src/lib/auth.ts`) y pasarlo explícitamente en el `create` anidado.
- OPTION_B — crear Pedido sin items y luego cada PedidoItem con un `create` individual
  (N ≤ 50 inserts, `MAX_ITEMS_PER_ORDER`) — determinista, pero reestructura el
  `create` y el flujo de idempotencia existente.
- OPTION_C — mapear por contenido (producto/variante/cantidad) tras el `create`:
  ambiguo con líneas idénticas → descartada.

**Elegida: OPTION_A** — la más simple: conserva el `create` anidado, el
`include: { items: true }` y todo el manejo de idempotencia/P2002 sin cambios, y el
ID queda ligado al mismo objeto de línea que lleva producto/variante/cantidad.
Consecuencia a verificar en implementación: los PedidoItem nuevos tendrán IDs UUID
en vez de cuid (columna `String`, sin restricción de formato); auditar que ningún
consumidor parsee el formato.

```text
ORDER_CREATION_RESERVATION_SEQUENCE=
  1. validatePedidoPayload (sin cambios).
  2. Cargar productos+variantes y validar cada línea (sin cambios); construir
     validatedItems asignando a cada línea id = randomUUID().
  3. Gate de scope: si !isGenericBusinessStockScope(rubro) → flujo actual intacto.
  4. Determinar líneas controladas (autoridad = variante si la hay, si no Producto;
     controlStock=true) y agregar cantidad por clave (productoId, productoVarianteId).
     Si no hay líneas controladas → flujo actual intacto.
  5. Abrir transacción Serializable con retry acotado (runStockSerializable).
  6. Leer modo (ConfigPlataforma) dentro de la tx: OFF → sin reserva (comportamiento
     actual); DRAINING → 409 STOCK_RESERVATIONS_DRAINING; ON → continuar.
  7. Por cada clave: releer fila autoridad + SUM(ReservaStock ACTIVA) con scope de
     negocio; available = max(0, physical - reserved); si requestedTotal > available
     → throw → 409 STOCK_INSUFFICIENT (lista las claves).
  8. Pre-chequeo de idempotencia + tx.cliente.update (existentes, sin cambios).
  9. tx.pedido.create({ data: pedidoCreateData con ids explícitos, include: { items: true } }).
  10. tx.reservaStock.createMany: una fila por línea controlada, con pedidoId =
      created.id y pedidoItemId = id pre-generado de esa línea, estado ACTIVA.
  11. Commit. Cualquier excepción en 7–10 hace rollback de Pedido + items + reservas.
  12. Carrera P2002 de idempotencia (existente): la tx perdedora hace rollback
      completo (reservas incluidas) y se devuelve el Pedido ganador.
  13. P2034 agotado tras retry → 409, nunca 500.
RESERVATION_ATOMIC_WITH_ORDER_CREATION=YES (Pedido se inserta antes que ReservaStock
  dentro de la MISMA transacción; si ReservaStock falla, todo hace rollback)
```

### A0.1-4 Mapeo PedidoItem ↔ ReservaStock

```text
RESERVATION_PEDIDO_ITEM_MAPPING_STRATEGY=
  PRE_GENERATED_PEDIDO_ITEM_ID — el id se asigna server-side a cada línea validada
  antes del insert; la reserva usa ese mismo id. Una reserva por línea (una línea
  controlada → exactamente una fila; @@unique(pedidoItemId)). Líneas duplicadas del
  mismo producto/variante, o con distintas opciones, son líneas distintas con ids
  distintos — cada una con su reserva; la VALIDACIÓN usa el total agregado por clave
  (A0.1-5). Nunca depende del orden del array retornado por Prisma.
```

### A0.1-5 Agregación de cantidades

```text
ORDER_STOCK_QUANTITY_AGGREGATION=REQUIRED
  La validación de disponibilidad suma primero por (productoId, productoVarianteId).
  Ejemplo: variante A available=5; líneas de 3 y 3 → total 6 → 409.
  La misma agregación es obligatoria en Caja (cierra el defecto de A0 §6: líneas
  duplicadas de la misma variante hoy se validan contra el mismo snapshot y el último
  update pisa al anterior).
```

### A0.1-6 Fórmulas (una única autoridad pura)

```text
AVAILABLE_STOCK_FORMULA=available = max(0, physical - activeReserved)
RESERVATION_DEFICIT_FORMULA=deficit = max(0, activeReserved - physical)
  physical = stockCantidad de la autoridad (variante si existe, si no Producto),
  sólo con controlStock=true; activeReserved = SUM(cantidad) de ReservaStock ACTIVA
  de esa clave (scope negocio). Para controlStock=false: available = null (sin límite).
  Ambas fórmulas viven en un único módulo puro (propuesto: stock-authority.ts); Caja,
  Movimientos, creación de pedido, consumo, API pública e Inventario lo usan — nadie
  recalcula por su cuenta. Nunca se muestra disponible negativo.
```

### A0.1-7 Índices

Consultas reales previstas:
Q1 suma por producto base `(negocioId, productoId, productoVarianteId IS NULL, estado=ACTIVA)`;
Q2 suma por variante `(negocioId, productoVarianteId, estado=ACTIVA)`;
Q3 agregado por negocio para listados `(negocioId, estado=ACTIVA) GROUP BY productoId, productoVarianteId`;
Q4 consumo/liberación `(negocioId, pedidoId, estado=ACTIVA)`;
Q5 precondición de OFF `COUNT(*) WHERE estado=ACTIVA` (global, raro).

```text
RESERVATION_INDEX_STRATEGY=
  @@index([negocioId, estado, productoId, productoVarianteId])  // Q3 (rango por tenant) y Q1
  @@index([negocioId, productoVarianteId, estado])              // Q2
  @@index([pedidoId])                                           // Q4
  @@unique([pedidoItemId])                                      // idempotencia (también índice)
  Por qué incluir negocioId: Q3 es un rango por tenant y necesita negocioId al frente;
  en Q1/Q2 productoId/productoVarianteId ya son únicos globales, pero con negocioId al
  frente un mismo índice sirve listado + búsqueda por clave, y el rango de predicate
  locks de SSI queda acotado al tenant (menos conflictos falsos entre negocios).
  Mismo patrón que el índice existente MovimientoInventario(negocioId, productoId, createdAt).
  Por qué NO en Q4: pedidoId es un cuid único global — selectividad máxima; negocioId
  sólo agrega un filtro de corrección en el WHERE, no selectividad.
  Q5 sin índice dedicado: escaneo raro (sólo al cambiar de modo); escala a lock de
  relación, correcto y aceptable para una operación administrativa.
```

### A0.1-8 Claves foráneas y semántica de borrado

Borrados físicos reales (búsqueda de `.delete(`/`.deleteMany(` en `src/app/api`,
`src/lib`, `scripts`): **Negocio** — superadmin (`superadmin/negocios/[id]/route.ts:111`,
cascada total); **Producto** — `DELETE /api/negocio/productos/[id]` (`:390`, sin
condiciones); **Pedido / PedidoItem / ProductoVariante** — ningún borrado productivo
(sólo el script legacy `migrate-sqlite-to-postgres.ts`); las variantes nunca se borran
(sólo `activo`).

```text
RESERVATION_FK_DELETE_STRATEGY=
  negocioId → CASCADE — el único borrado de Negocio es la eliminación total por
    superadmin, que ya borra en cascada todos sus Pedidos/Productos/Movimientos; una
    reserva no puede sobrevivir a su tenant y no queda stock que proteger.
  pedidoId → NO ACTION (Prisma onDelete: NoAction, NO Restrict) — ningún código
    productivo borra Pedidos; NO ACTION bloquea borrar un Pedido suelto mientras tenga
    reservas (protege la traza), pero se verifica al FIN de la sentencia, así que la
    cascada de Negocio (que borra Pedidos y reservas en la misma sentencia) funciona.
    RESTRICT se verifica inmediatamente y podría romper esa cascada según el orden.
    (Prisma usa Restrict por defecto en relaciones requeridas: hay que declararlo.)
  pedidoItemId → NO ACTION — mismo razonamiento (PedidoItem sólo muere con su Pedido).
  productoId → SET NULL (columna nullable) + GUARD de aplicación obligatorio —
    DELETE /api/negocio/productos/[id] responde 409 si el producto tiene reservas
    ACTIVA ("hay pedidos abiertos que reservaron este producto"). Las filas históricas
    (CONSUMIDA/LIBERADA) sobreviven con productoId=null; la traza sigue por
    pedidoItemId (PedidoItem conserva nombre/varianteNombre). RESTRICT descartado:
    bloquearía para siempre borrar cualquier producto alguna vez reservado (cambio de
    UX: hoy el borrado siempre funciona). CASCADE descartado: una reserva ACTIVA podría
    desaparecer sin rastro.
  productoVarianteId → SET NULL — consistente con VentaItem, PedidoItem y
    MovimientoInventario; una variante sólo desaparece con su Producto (cubierto por el
    guard).
  Defensa en profundidad: si una fila ACTIVA queda con productoId=null (borrado que
    esquivó el guard), no suma a ninguna clave (no infla disponibilidad de nada
    existente) y el consumo la marca LIBERADA con motivo PRODUCTO_ELIMINADO sin
    movimiento físico.
  Inactivación (no borrado) con reservas ACTIVA — toggle Producto.stock=false o
    variante activo=false: bloquea reservas NUEVAS; las existentes se siguen
    consumiendo en preparando (el pedido ya estaba comprometido).
  MovimientoInventario.pedidoId → SET NULL (mismo criterio que ventaId).
```

### A0.1-9 Flag / modos / rollback seguro (corrige A0 §31)

A0 decía "apagar = no crear reservas nuevas, pero honrar las vivas". Es inseguro:
pedidos nuevos en modo legacy validarían contra el físico sin reservar y podrían
sobrevender sobre las reservas vivas.

```text
ORDER_STOCK_FEATURE_FLAG_STRATEGY=
  Modo persistido en DB, no en env var — nueva columna aditiva en ConfigPlataforma
  (que ya tiene un update auditado con CAS optimista sobre updatedAt + AuditLog en la
  misma tx: updatePlatformServiceFeeWithAudit, platform-settings.ts:55). Se lee DENTRO
  de cada tx de stock, para que un cambio de modo sea consistente con las reservas.
  ON — pedidos de negocio genérico con líneas controladas reservan; consumo y
    liberación activos.
  DRAINING — pedidos NUEVOS con alguna línea controlada de negocio genérico → 409
    STOCK_RESERVATIONS_DRAINING (fail-closed: el drenaje termina sí o sí); las reservas
    existentes se siguen consumiendo/liberando; líneas no controladas y otros rubros
    no se afectan.
  OFF — sin reservas; la creación vuelve exactamente al comportamiento actual.
  INDEPENDIENTE DEL MODO: Caja, Movimientos, API pública e Inventario SIEMPRE restan
    las reservas ACTIVA (con 0 reservas el resultado es idéntico al actual). Ningún
    modo deja de respetar reservas vivas.
  Rollback duro (explícito): sólo en DRAINING, un script auditable marca LIBERADA
    (motivo ROLLBACK) las reservas ACTIVA. Una reserva nunca cambió stockCantidad, así
    que esto no puede corromper el físico.
SAFE_ROLLBACK_PRECONDITION=
  ON → DRAINING: siempre permitido. DRAINING → OFF: sólo si COUNT(ReservaStock ACTIVA)=0,
  verificado en la MISMA tx Serializable que actualiza el modo (ver A0.1-10 #12).
  ON → OFF directo: prohibido. Así es imposible volver a legacy ignorando reservas vivas.
```

### A0.1-10 Concurrencia — matriz SSI concreta

Lecturas/escrituras por transacción (todas Serializable salvo REL):

- **RES** (reserva al crear): lee filas autoridad (R), predicado `SUM(ReservaStock ACTIVA)` por clave (R-pred), modo en ConfigPlataforma (R); inserta Pedido, PedidoItems y ReservaStock (W, dentro del predicado).
- **CON** (consumo en preparando): CAS sobre la fila Pedido (W); lee reservas ACTIVA de ese pedido (R); lee y escribe filas autoridad (R/W); actualiza ReservaStock (W); inserta MovimientoInventario.
- **REL** (liberación al cancelar): CAS sobre Pedido (W); actualiza ReservaStock ACTIVA→LIBERADA (W); reversión de deuda (W, existente). Se mantiene en el aislamiento actual (READ COMMITTED): sólo aumenta disponibilidad.
- **CAJA / SALIDA**: leen filas autoridad (R) y el predicado (R-pred); escriben filas autoridad (W); insertan movimiento.
- **AJUSTE**: lee fila autoridad (R) y el predicado (R-pred, para el déficit); escribe fila autoridad (W).
- **MODE** (cambio a OFF): lee predicado `COUNT ACTIVA` (R-pred); escribe ConfigPlataforma (W).

```text
SERIALIZABLE_CONFLICT_MATRIX=
  1  RES vs RES (misma clave, physical=1, reserved=0): ambas leen el predicado vacío e
     insertan dentro de él → antidependencia rw en ambos sentidos → estructura
     peligrosa SSI → Postgres aborta una (40001/P2034). La perdedora reintenta, ve
     reserved=1, available=0 → 409. PROTEGIDO.
  2  RES vs CAJA: RES lee la fila que CAJA escribe (rw RES→CAJA); CAJA lee el predicado
     donde RES inserta (rw CAJA→RES) → ciclo → aborta una. PROTEGIDO.
  3  RES vs SALIDA: idéntico a 2. PROTEGIDO.
  4  RES vs AJUSTE: ciclo igual a 2 (AJUSTE lee el predicado para el déficit) → aborta
     una. Aunque no hubiera ciclo, el resultado (déficit) está permitido por la
     decisión 4. PROTEGIDO / ACEPTADO.
  5  CON vs CAJA: ambas escriben la misma fila autoridad → conflicto w-w → aborta una.
     PROTEGIDO.
  6  CON vs SALIDA / AJUSTE: w-w sobre la fila autoridad. PROTEGIDO.
  7  CON vs RES: sólo rw RES→CON (CON escribe la fila que RES leyó y saca filas del
     predicado ACTIVA); sin ciclo → ambas confirman. Equivale a "RES y luego CON":
     available = (physical - q) - (reserved - q) no cambia, la decisión de RES sigue
     siendo válida. SEGURO.
  8  REL vs CAJA: REL cambia filas del predicado que CAJA leyó (rw CAJA→REL); sin
     ciclo → ambas confirman; CAJA pudo ver reservado de más → sólo un falso negativo
     (rechazó una venta que podía hacer). DIRECCIÓN SEGURA.
  9  REL vs RES: idem 8, falso negativo como peor caso. SEGURO.
  10 REL vs CON (mismo pedido): ambas hacen CAS sobre la misma fila Pedido (w-w + CAS de
     estado) → una sola gana. PROTEGIDO.
  11 CON vs CON (doble click): w-w sobre Pedido + CAS de estado → un solo consumo.
     PROTEGIDO.
  12 MODE→OFF vs RES: RES lee el modo que MODE escribe (rw RES→MODE); MODE lee el
     predicado COUNT donde RES inserta (rw MODE→RES) → ciclo → aborta una. Nunca se
     entra a OFF mientras una reserva concurrente confirma. PROTEGIDO.
  CONDICIÓN DE VALIDEZ: SSI sólo protege si TODA transacción que lee disponibilidad y
  escribe algo corre en SERIALIZABLE (RES, CON, CAJA, SALIDA, AJUSTE, MODE). Una
  participante en READ COMMITTED quedaría fuera de la detección. REL puede quedar en
  READ COMMITTED porque sólo libera.
  LOCK ADICIONAL: no requerido. Riesgo residual documentado: si el planner resuelve el
  predicado con seq scan, Postgres escala el SIRead lock a nivel relación → correcto,
  pero con más abortos falsos; mitigado por los índices de A0.1-7 + retry acotado en
  RES, CON, CAJA (hoy CAJA no reintenta) y MODE.
```

### A0.1-11 Autoridad compartida para `→ preparando`

```text
PREPARANDO_STOCK_SIDE_EFFECT_AUTHORITY=
  Una única función transaccional (propuesta: transicionarAPreparandoConStock(tx,
  { pedidoId, negocioId, casWhere, data })):
    1. CAS tx.pedido.updateMany({ where: { id, negocioId, ...casWhere }, data }); si
       count !== 1 → { won: false } (sin efectos).
    2. Leer ReservaStock ACTIVA del pedido (scope negocio). Sin filas → { won: true }
       (pedido histórico, sin líneas controladas, modo OFF).
    3. Agregar por clave; releer filas autoridad; si physical < total de ESE pedido
       para alguna clave → throw StockReservationDeficitError → 409
       STOCK_RESERVATION_DEFICIT; la tx entera (CAS incluido) hace rollback y el
       Pedido queda en su estado anterior.
    4. Por clave: resolveNextStock (tipo PEDIDO, nunca negativo), update de la fila
       autoridad, MovimientoInventario tipo PEDIDO.
    5. updateMany ReservaStock { id in ids, estado ACTIVA } → CONSUMIDA + consumidaEn;
       exige count === ids.length.
  Los routes conservan auth, actor y respuesta; ninguno recalcula stock. Corren el
  helper dentro de runStockSerializable (Serializable + retry acotado, extraído del
  withSerializableRetry existente del route de Mozo, mozo/.../route.ts:645).
  Llamadores (6): negocio/pedidos (PUT, mesa); negocio/pedidos/[id]/estado;
  operaciones/pyr/pedidos/[id]/estado; operaciones/salon/pedidos/[id]/estado;
  operativo/pyr/pedidos/[id]/preparar; operativo/salon/pedidos/[id]/preparar.
  Hoy 4 de ellos hacen un CAS plano sin transacción — pasan a la tx Serializable.
```

### A0.1-12 Autoridad compartida de cancelación

```text
CANCELLATION_RESERVATION_AUTHORITY=
  Una única función (propuesta: aplicarEfectosCancelacion(tx, { pedidoId, negocioId,
  motivo })) que envuelve los DOS efectos de cancelación: la reversión de deuda
  existente (revertirTarifaSiCorresponde, sin cambios) + liberarReservasPedido:
    updateMany ReservaStock { negocioId, pedidoId, estado ACTIVA } → LIBERADA +
    liberadaEn + motivoLiberacion. count puede ser 0 (post-consumo, sin control,
    histórico) y es correcto.
  Reemplaza la llamada directa a revertirTarifaSiCorresponde en los 6 sitios de
  cancelación, para que un futuro camino de cancelación no pueda olvidar uno de los
  dos efectos. Va dentro de las transacciones de cancelación existentes, inmediatamente
  después del CAS (mismo lugar que hoy la reversión).
  motivoLiberacion: CANCELADO_CLIENTE | CANCELADO_VENDEDOR | CANCELADO_MESA |
  CANCELADO_SISTEMA (+ ROLLBACK, PRODUCTO_ELIMINADO para los casos de A0.1-8/A0.1-9).
  Después de preparando: sin reservas ACTIVA → no libera nada → sin restock (decisión 1).
```

### A0.1-13 Movimiento de inventario del consumo

```text
PEDIDO_MOVEMENT_SCHEMA_STRATEGY=
  REUSE MovimientoInventario (sin segundo ledger). Una fila por clave consumida:
  negocioId; productoId; productoVarianteId (sólo si es variante, regla existente del
  schema); tipo="PEDIDO" (String, sin cambio de enum; se agrega a MOVIMIENTO_TIPOS);
  cantidad (positiva, total consumido de esa clave); stockAntes / stockDespues de la
  fila autoridad; motivo (p. ej. "Pedido → preparando"); ventaId=null; pedidoId (nueva
  columna nullable, SET NULL). Actor: MovimientoInventario no tiene campo actor; la
  transición ya queda auditada por el registro existente del cambio de estado
  (logPedidoEstadoChange / PedidoEvento), enlazable por pedidoId — no se agrega columna.
  La reserva NO crea movimiento (no cambia stock físico).
```

> **Refinamiento R3A-I1 (2026-10-05):** "se agrega a MOVIMIENTO_TIPOS" no se aplicó
> literalmente: esa lista es la validación del endpoint de movimientos MANUALES
> (`isValidMovimientoTipo`), y agregarlo permitiría registrar PEDIDO a mano. PEDIDO quedó como
> constante de sistema en la misma autoridad (`MOVIMIENTO_TIPO_PEDIDO`,
> `MOVIMIENTO_TIPOS_PERSISTIBLES` en `src/lib/inventario.ts`). Ver
> `codex-reports/P2_T56_R3A_I1_STOCK_FOUNDATION.md` §2.

### A0.1-14 R3A-P0 — paridad de variantes en Mozo (scope congelado)

Evidencia: UI única `src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx` (1226 líneas,
re-exportada por `operaciones/mi-panel/[slug]/pedido/[mesaId]/page.tsx`), sin ninguna
mención a variantes; el GET de `operativo/mozo/panel/[slug]/pedidos` devuelve
productos sin `variantes` (`:755-775`); el POST precia con el Producto base (`:353-369`).

```text
R3A_P0_SCOPE=
  - Producto sin variantes: sin cambios.
  - GET de Mozo: incluye variantes ACTIVAS (id, nombre, precio + disponibilidad según
    la fase vigente — en P0, la regla actual de R2C-F2: controlStock && stock <= 0 →
    no disponible).
  - UI de Mozo (página única): selector de variante obligatorio cuando el producto
    tiene variantes activas; variante sin stock visible pero deshabilitada; carrito
    identifica producto+variante (dos variantes = dos líneas).
  - POST de Mozo: acepta varianteId por línea; mismas reglas que POST /api/pedidos
    (variante requerida si el producto tiene variantes, debe pertenecer a ESE producto,
    activa, no agotada; varianteId en producto sin variantes → rechazo); precio
    autoritativo = precio de la variante; persiste productoVarianteId + varianteNombre.
  - Tenant isolation: variante resuelta sólo dentro de los productos del negocio ya
    validados (mismo patrón que POST /api/pedidos).
  - P0 NO implementa ReservaStock ni toca stock; su propio commit, certificable aparte.
R3A_P0_SCHEMA_CHANGE_REQUIRED=NO (PedidoItem ya tiene productoVarianteId/varianteNombre
  desde R2C-F2)
```

### A0.1-15 API pública — contrato congelado

```text
PUBLIC_API_CURRENT_STOCK_CONSUMERS=
  - GET /api/negocios/[slug]: expone por variante activa controlStock + stockCantidad
    (físico); productos base no exponen stock (sólo el toggle `stock`).
  - Consumidor cliente: src/lib/client-product-variants.ts (isVarianteDisponible:
    !controlStock || stockCantidad > 0), usado por src/app/n/[slug]/page.tsx.
  - Contrato fijado por test: src/app/api/negocios/[slug]/route.test.ts afirma la forma
    exacta con toEqual.
  - PUT /api/cliente/pedidos/[id]/repetir: lee controlStock/stockCantidad sólo en
    servidor y devuelve disponible/motivo (no expone físico).
PUBLIC_API_FUTURE_CONTRACT=
  Paso 1 (fase I4, sin breaking change): agregar stockDisponible: number | null por
    variante activa Y por producto sin variantes (null si controlStock=false; si no,
    available de A0.1-6). El cliente pasa a decidir con stockDisponible
    (null || > 0). Se mantienen controlStock y stockCantidad por un ciclo de deploy
    (bundles PWA viejos en caché); el servidor sigue siendo la autoridad (409).
    repetir usa available.
  Paso 2 (follow-up, tras un ciclo y re-auditoría de consumidores): quitar
    stockCantidad del payload público (deja de exponer el físico).
  Mientras el modo sea OFF, stockDisponible = physical (sin reservas) — mismo
  resultado visible que hoy.
```

### A0.1-16 Decisiones de producto — cierre

```text
UNRESOLVED_PRODUCT_DECISIONS_COUNT=0
  Las 6 de A0 §33 quedan resueltas por A0.1-1. No surgió ninguna decisión de producto
  nueva y bloqueante. Elecciones de diseño tomadas dentro de lo que el operador
  habilitó (no son decisiones nuevas): DRAINING rechaza pedidos controlados nuevos
  (fail-closed); guard 409 al borrar un producto con reservas ACTIVA (deriva del
  principio del operador de que una reserva ACTIVA no puede desaparecer en silencio).
```

### A0.1-17 Modelo final propuesto (no aplicado)

```prisma
model ReservaStock {
  id                 String    @id @default(cuid())
  negocioId          String
  pedidoId           String
  pedidoItemId       String
  productoId         String?   // nullable: SET NULL al borrar Producto (guard 409 si hay ACTIVA)
  productoVarianteId String?   // sólo si la autoridad es una variante
  cantidad           Float     // como stockCantidad (kg/litro)
  estado             String    // ACTIVA | CONSUMIDA | LIBERADA
  motivoLiberacion   String?   // CANCELADO_CLIENTE | CANCELADO_VENDEDOR | CANCELADO_MESA | CANCELADO_SISTEMA | ROLLBACK | PRODUCTO_ELIMINADO
  createdAt          DateTime  @default(now())
  consumidaEn        DateTime?
  liberadaEn         DateTime?

  negocio          Negocio           @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  pedido           Pedido            @relation(fields: [pedidoId], references: [id], onDelete: NoAction)
  pedidoItem       PedidoItem        @relation(fields: [pedidoItemId], references: [id], onDelete: NoAction)
  producto         Producto?         @relation(fields: [productoId], references: [id], onDelete: SetNull)
  productoVariante ProductoVariante? @relation(fields: [productoVarianteId], references: [id], onDelete: SetNull)

  @@unique([pedidoItemId])
  @@index([negocioId, estado, productoId, productoVarianteId])
  @@index([negocioId, productoVarianteId, estado])
  @@index([pedidoId])
  @@map("reservas_stock")
}

// MovimientoInventario — aditivo:
//   pedidoId String?  + pedido Pedido? @relation(fields: [pedidoId], references: [id], onDelete: SetNull)
//   @@index([pedidoId]);  tipo gana "PEDIDO" (String).
// ConfigPlataforma — aditivo:
//   stockReservaModo String @default("OFF")   // ON | DRAINING | OFF
// Relaciones inversas a agregar en Negocio, Pedido, PedidoItem, Producto, ProductoVariante.
```

```text
SCHEMA_CHANGE_REQUIRED=YES (en I1; nada en A0/A0.1)
MIGRATION_REQUIRED=YES (aditiva: 1 tabla + 2 columnas nullable/default + índices;
  DESTRUCTIVE_STATEMENTS=0 esperado)
HISTORICAL_ORDERS_BACKFILL_REQUIRED=NO
```

### A0.1-18 STOCK_INVARIANTS

```text
STOCK_INVARIANTS=
  I1  physical >= 0 (resolveNextStock rechaza negativos — inventario.ts:175).
  I2  activeReserved >= 0.
  I3  available = max(0, physical - activeReserved); deficit = max(0, activeReserved - physical).
  I4  un ítem controlado sólo puede reservarse si available >= requestedTotal (total
      agregado por clave dentro del pedido).
  I5  una reserva nunca cambia physical.
  I6  el consumo, atómicamente: physical -= cantidad, ACTIVA→CONSUMIDA, movimiento
      PEDIDO — sólo si el CAS de estado ganó; si physical no alcanza → 409 y nada cambia.
  I7  cancelación previa al consumo: ACTIVA→LIBERADA, physical sin cambios.
  I8  cancelación posterior al consumo: ningún aumento automático de physical.
  I9  Caja no puede dejar physical por debajo de activeReserved (venta ≤ available).
  I10 AJUSTE puede fijar physical por debajo de reservado (verdad física) → crea
      déficit; nunca altera reservas.
  I11 ninguna reserva cruza tenant (negocioId server-side; producto y variante validados
      contra ese negocio).
  I12 las autoridades de stock de producto base y de variante son mutuamente
      excluyentes (nunca se tocan ambas para una misma línea).
  I13 una falla de transacción no deja Pedido, reserva ni efecto de stock parcial.
  I14 ningún modo deja de restar reservas ACTIVA en Caja/Movimientos/API/Inventario;
      OFF sólo con 0 reservas ACTIVA.
  I15 fuera de scope (rubro != "negocio"), la creación de pedidos no cambia en nada.
```

### A0.1-19 Matriz de pruebas ampliada (A–P de A0 §30 + Q–Z)

```text
IMPLEMENTATION_TEST_MATRIX (agregados A0.1)=
  Q AJUSTE baja physical debajo de reservado → available=0, deficit>0, reservas intactas.
  R pedido reservado con déficit intenta →preparando → 409 STOCK_RESERVATION_DEFICIT,
    estado sin cambiar, sin movimiento, reserva sigue ACTIVA.
  S modo DRAINING con reservas activas → pedido controlado nuevo 409; consumo y
    liberación de las existentes siguen funcionando; Caja sigue respetándolas.
  T DRAINING→OFF con reservas ACTIVA → rechazado; con 0 → permitido; ON→OFF directo →
    rechazado; carrera MODE vs RES → una aborta (matriz #12).
  U borrar producto con reserva ACTIVA → 409; con sólo reservas históricas → borrado
    OK, filas quedan con productoId=null; inactivar variante con reserva ACTIVA →
    nuevas reservas bloqueadas, la existente se consume en preparando.
  V líneas duplicadas del mismo producto/variante en un pedido → validación por total.
  W líneas duplicadas en Caja → validación por total y decremento correcto.
  X regresión Restaurante/Ropa: POST /api/pedidos idéntico (sin reservas, sin 409
    nuevos, sin cambio de aislamiento), incluso con controlStock=true puesto por API.
  Y con modo ON, la API pública nunca reporta physical como disponible usable
    (stockDisponible = available; el cliente decide con stockDisponible).
  Z paridad de variantes en Mozo (P0): selección obligatoria, precio de variante,
    snapshot, rechazos de variante ajena/inactiva/agotada, cross-tenant.
```

### A0.1-20 Fases revisadas (reemplaza A0 §32)

```text
IMPLEMENTATION_PHASES=
  R3A-P0 — Paridad de variantes en Mozo (A0.1-14). Sin schema. Commit propio,
    certificación manual propia. Debe cerrarse antes de habilitar reservas.
  R3A-I1 — Schema aditivo (ReservaStock, MovimientoInventario.pedidoId,
    ConfigPlataforma.stockReservaModo default OFF) + autoridad pura (fórmulas,
    agregación, scope por rubro, semántica de modos) + tipo PEDIDO. Sin cambio de
    comportamiento (modo OFF, nadie la llama).
  R3A-I2 — Autoridades transaccionales (reservar, consumir, liberar,
    runStockSerializable) cableadas en los 2 puntos de creación, los 6 escritores de
    →preparando, los 6 sitios de cancelación y el guard de DELETE de producto. Modo
    sigue OFF → comportamiento actual.
  R3A-I3 — Caja y Movimientos restan reservas ACTIVA (siempre, independiente del
    modo), agregación por clave en Caja, política SALIDA/AJUSTE, retry acotado en Caja.
  R3A-I4 — Visibilidad: Inventario Físico/Reservado/Disponible/Déficit, mensajes de
    Caja, API pública paso 1 (stockDisponible), repetir con available, transición de
    modo auditada (ON/DRAINING/OFF con precondición).
  R3A-I5 — Modo ON en TESTING + regresión completa (A–Z) + certificación manual.
  El modo sólo puede pasar a ON cuando P0 e I1–I4 estén integradas.
  Follow-ups fuera de R3A: STALE_OPEN_ORDER_EXPIRATION_POLICY; API pública paso 2
  (quitar stockCantidad); gate de rubro en servidor para las APIs de inventario
  (A0.1-0 #3).
```

### A0.1-21 Stale / contradiction scan al cierre de A0.1 (2026-09-30, histórico desde P0)

Patrones buscados en CODEX_REPORT, FULL_CONTEXT, ROADMAP y este reporte:
`UNRESOLVED_PRODUCT_DECISIONS=6`, "decisiones de producto abiertas",
`RESERVATION_POINT`, `AVAILABLE`, `ROLLBACK`, `FEATURE_FLAG`, `R3A_STATUS`,
`OPEN_BACKLOG`, `DESIGN_COMPLETE`, `NEXT_ACTION`.

> **Nota (2026-10-01, R3A-P0):** este scan y su resultado corresponden al **cierre de
> A0.1** y se conservan sin cambios (eran correctos en ese momento). No representan el
> estado current posterior a P0: P0 fue implementado en el commit
> `489d55b342f5ffdc7be6b7bb3ae61750ca755260`, y el estado current (con su propio scan)
> está en `CODEX_REPORT.md`, `DELIGO_FULL_CONTEXT_LATEST.md`, `codex-reports/ROADMAP.md`
> y `codex-reports/P2_T56_R3A_P0_MOZO_VARIANT_PARITY.md`.

```text
CURRENT=estado R3A en las cabeceras vigentes de CODEX_REPORT, FULL_CONTEXT y ROADMAP
  (ARCHITECTURE_HARDENED_AWAITING_IMPLEMENTATION_AUTHORIZATION /
  RETURN_TO_OPERATOR_FOR_R3A_IMPLEMENTATION_AUTHORIZATION) + markers A0.1 de este reporte
HISTORICAL=handoff A0 de CODEX_REPORT (degradado a "HISTORICAL HANDOFF … A0": contiene
  UNRESOLVED_PRODUCT_DECISIONS=6, RESERVATION_POINT, DESIGN_COMPLETE, NEXT_ACTION=AWAIT_…);
  en este reporte: §1–§2 (preflight A0, OPEN_BACKLOG_NOT_STARTED), §15, §17, §19, §22, §24,
  §31–§34 (encabezados marcados SUPERSEDED BY A0.1 / HISTÓRICO); el resto de los hits
  (AVAILABLE/ROLLBACK/DESIGN_COMPLETE de T54, T40, T23, T39, Production sync, etc.)
  pertenecen a otras tareas y no a R3A
STALE_CURRENT_REFERENCES=0
```

### A0.1-22 Riesgos residuales

- I2 toca 14 sitios (2 creación + 6 preparando + 6 cancelación) — superficie grande;
  por eso queda detrás del modo OFF hasta I5.
- PedidoItem pasa a IDs UUID para pedidos nuevos (A0.1-3) — auditar consumidores.
- Más reintentos Serializable bajo carga sobre un mismo producto — mitigado con
  índices y retry acotado; agotado → 409 claro.
- El defecto latente de Caja (A0 §6) sigue presente hasta I3.

### A0.1-23 Markers al cierre de A0.1 (2026-09-30, históricos desde P0)

> **Nota (2026-10-01, R3A-P0):** el bloque de abajo es el estado **al cierre de A0.1**
> y se conserva sin cambios como evidencia histórica. Desde R3A-P0 ya **no** es el
> estado current: P0 (paridad de variantes en Mozo) fue implementado en el commit
> `489d55b342f5ffdc7be6b7bb3ae61750ca755260`. El estado current se lee en
> `CODEX_REPORT.md`, `DELIGO_FULL_CONTEXT_LATEST.md`, `codex-reports/ROADMAP.md` y
> `codex-reports/P2_T56_R3A_P0_MOZO_VARIANT_PARITY.md`. Los markers arquitectónicos de
> A0.1 (A0.1-1 … A0.1-22) siguen siendo la autoridad de diseño para I1–I5.

```text
A0_1_HARDENING_COMPLETE=YES
R3A_RUBRO_SCOPE=GENERIC_BUSINESS_ONLY (gate explícito isGenericBusinessStockScope)
ORDER_CREATION_RESERVATION_SEQUENCE=A0.1-3 (13 pasos; Pedido y reservas en la misma tx Serializable)
RESERVATION_ATOMIC_WITH_ORDER_CREATION=YES
RESERVATION_PEDIDO_ITEM_MAPPING_STRATEGY=PRE_GENERATED_PEDIDO_ITEM_ID
ORDER_STOCK_QUANTITY_AGGREGATION=REQUIRED (pedidos y Caja)
AVAILABLE_STOCK_FORMULA=max(0, physical - activeReserved)
RESERVATION_DEFICIT_FORMULA=max(0, activeReserved - physical)
RESERVATION_INDEX_STRATEGY=[negocioId,estado,productoId,productoVarianteId] + [negocioId,productoVarianteId,estado] + [pedidoId] + unique[pedidoItemId]
RESERVATION_FK_DELETE_STRATEGY=negocio CASCADE; pedido NO_ACTION; pedidoItem NO_ACTION; producto SET_NULL + guard 409; variante SET_NULL
ORDER_STOCK_FEATURE_FLAG_STRATEGY=DB_MODE_ON_DRAINING_OFF_IN_CONFIG_PLATAFORMA; reservations always respected
SAFE_ROLLBACK_PRECONDITION=OFF only when ACTIVE_RESERVATIONS=0, checked in the same Serializable tx; ON→OFF forbidden
SERIALIZABLE_CONFLICT_MATRIX=A0.1-10 (12 pares; todos protegidos o seguros; requiere SERIALIZABLE en RES/CON/CAJA/SALIDA/AJUSTE/MODE)
PREPARANDO_STOCK_SIDE_EFFECT_AUTHORITY=transicionarAPreparandoConStock (6 llamadores)
CANCELLATION_RESERVATION_AUTHORITY=aplicarEfectosCancelacion = deuda + liberación (6 sitios)
PEDIDO_MOVEMENT_SCHEMA_STRATEGY=REUSE_MOVIMIENTO_INVENTARIO_TIPO_PEDIDO_WITH_PEDIDO_ID
R3A_P0_SCOPE=A0.1-14
R3A_P0_SCHEMA_CHANGE_REQUIRED=NO
UNRESOLVED_PRODUCT_DECISIONS_COUNT=0
SCHEMA_CHANGE_REQUIRED=YES (I1)
MIGRATION_REQUIRED=YES (I1, aditiva)
HISTORICAL_ORDERS_BACKFILL_REQUIRED=NO
RESTAURANTE_ORDER_STOCK_BEHAVIOR_CHANGED=NO
ROPA_ORDER_STOCK_BEHAVIOR_CHANGED=NO
SOURCE_CODE_CHANGED=NO
PRODUCTION_TOUCHED=NO
P2_T56_R3A_STATUS=ARCHITECTURE_HARDENED_AWAITING_IMPLEMENTATION_AUTHORIZATION
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_R3A_IMPLEMENTATION_AUTHORIZATION (P0 e I1 no iniciadas)
```
