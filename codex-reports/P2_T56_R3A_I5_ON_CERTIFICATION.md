# P2-T56-R3A-I5 — Activación ON y certificación técnica con reservas reales (TESTING)

```text
TASK=P2-T56-R3A-I5 (activación ON + pruebas reales)
DATE=2026-10-08
AUTHORIZATION=operador: activar ON sólo en TESTING, pruebas reales con fixtures, ciclo ON→DRAINING→OFF→ON, dejar TESTING en ON a la espera del smoke manual; NO Production, NO cerrar I5 antes del smoke
TESTING_CODEX_HEAD=7d29aa01a46544817154be2369e85a20b3005511 (funcional I5-P0 96a93b6; sin cambios de código en esta ronda)
TESTING_DEPLOY=22bf1264-2a7c-4eef-a8b4-8fe3740288b6 SUCCESS (sin redeploy funcional)
DB_FINGERPRINT=d64be28f676e (mecanismo I5-P0)
R3A_I5_STATUS=CLOSED_TESTING_CERTIFIED (§12; antes DEPLOYED_TESTING_MODE_ON_AWAITING_MANUAL_SMOKE)
FINAL_MODE=ON · FINAL_ACTIVE_RESERVATIONS=0 · CODE_CHANGED=NO · SCHEMA_CHANGED=NO · NEW_MIGRATIONS=0 · PRODUCTION_TOUCHED=NO
```

## 1. Preflight

- **Git:** `testing-codex` = `origin/testing-codex` = `7d29aa0`; `origin/main` = `42ca500`; árbol limpio, sin stash. Tags `r3a-i1-testing-verified`, `r3a-i4-pre-integration-testing-codex` y `r3a-i5p0-pre-integration-testing-codex` (los dos últimos locales).
- **Railway:** amiable-rejoicing (49d4d9c7-…) / TESTING (f37d0c49-…) / DeliGO Copy en `22bf1264` SUCCESS @ `7d29aa0`. Production/DeliGO en `6bf1ee84` @ `42ca500`. Credenciales y host de Production distintos de TESTING (comparación por hash).
- **Base de datos:**
  - huella real `d64be28f676e` (`system_identifier`);
  - modo OFF; 0 reservas en cualquier estado; 0 MovimientoInventario PEDIDO;
  - 130 pedidos abiertos (2 genéricos, ya en preparación desde antes);
  - 2 productos y 4 variantes controlados; sin stock negativo; 0 auditorías del controlador;
  - logs previos sin errores.
- **Actor:** TESTING tiene exactamente 1 SuperAdmin activo. Su email coincide con la cuenta del operador que autorizó esta ronda (comparación dentro del script, sin imprimir emails) → `superAdminId=cmsjkkvd40000mz0az8y5gn9s`. No se creó ni se eligió arbitrariamente ninguna cuenta.

## 2. Activación OFF → ON (comando real I5-P0)

- **Dry-run:** `currentMode=OFF`, `allowed=true`, `problems=[]`, `DRY_RUN_NO_CHANGES`; estado y auditoría sin cambios.
- **Ejecución:** `--execute --confirm=OFF->ON --operation-ref=i5-on-20261008-1` → `APPLIED`, `modeAfter=ON`.
- **Lectura independiente:** modo ON y una sola fila AuditLog `stock.reserva_modo_cambiado` (actor = SuperAdmin del operador, from OFF, to ON, motivo, referencia, `previousUpdatedAt`, `result: APPLIED`).

## 3. Pruebas reales — Phase A (modo ON)

Harness ad-hoc, no commiteado (`scratchpad/i5_realdb_A.test.ts`):
- routes y autoridades REALES, sin mocks;
- prefijo `test-i5a-`, negocios genéricos dedicados;
- cada cliente simulado con UNA IP simulada fija (el limitador es la memoria del proceso local, no la app desplegada; no hay falsificación por solicitud);
- invariantes por negocio en cada test: sin stock negativo, ACTIVA ≤ físico, y todo pedido controlado abierto con su reserva.

**Resultado: 14/14**, 0 P2028, 0 errores de init.

En la primera corrida, R4 falló porque el harness enviaba `metodoPago: "efectivo"` y Caja exige `"EFECTIVO"` (400 «Método de pago inválido»). Fue un error del harness, no del producto: se corrigió y **sólo R4** se re-ejecutó (2/2).

| Bloque | Verificado | Resultado |
|---|---|---|
| R1 reservar al confirmar | simple 5 → pedido 2: 201, físico 5, 1 reserva ACTIVA 2, catálogo disponible 3 · variante (reserva con productoVarianteId) · líneas repetidas (2 filas, total 3) · Mesa reserva · sin control: sin reservas · aislamiento (otro negocio intacto) · exceso respecto del disponible → 409 con detalle, sin pedido ni reservas nuevas · mixto → rollback total · replay idempotente: 200, mismo pedido, 1 sola reserva · Restaurante controlado con 0 → 201 sin reservas | PASS |
| R2 consumir al preparar | 5→3, CONSUMIDA, 1 movimiento PEDIDO (5→3) · segundo intento ≠ 200 sin descuento · dos preparaciones concurrentes → 200/409, un solo descuento y un solo movimiento · variante · **déficit provocado** (AJUSTE confirmado a 1 con reserva 3) → preparar = 409 `STOCK_RESERVATION_DEFICIT`, estado intacto, reserva ACTIVA, sin movimiento; resuelto con cancelación normal | PASS |
| R3 liberar al cancelar | cliente (`CANCELADO_CLIENTE`) · negocio (`CANCELADO_VENDEDOR`) · Mesa (`cancelarPedidoMesa`, `CANCELADO_MESA`) → LIBERADA, físico intacto · cancelación posterior a preparar: sin reposición ni movimiento nuevo (reserva CONSUMIDA) · dos cancelaciones concurrentes → 200/409, una sola liberación | PASS |
| R4 Caja | físico 5 / reservado 3: vender 2 → 201; 1 más → 409 `STOCK_RESERVED_FOR_ORDERS`, sin venta ni cambio de stock · variante con líneas repetidas agregadas → 409 / dentro del disponible → 201 · **Caja contra pedido por la última unidad (3 repeticiones): siempre exactamente uno gana** (201/409, 201/409, 409/201), sin sobreventa | PASS |
| R5 Inventario | SALIDA limitada por físico − reservado (409 / 201) · ENTRADA · variante · **AJUSTE con reserva ACTIVA real**: advertencia 409 con reservas/propuesto/déficit sin escribir → «cancelar» (no reenviar) no cambia el stock → la confirmación con huella vieja tras un cambio del físico se rechaza (`confirmacionVencida=true`, valores nuevos) → reconfirmación con la huella nueva aplicada → déficit resuelto cancelando | PASS |
| R6 catálogo | producto agotado por reservas oculto · variante totalmente reservada no se ofrece; la otra sigue (disponible 2) · respuesta sin datos internos de reservas · **una sola lectura agrupada** (sonda N+1 = 1) · pedido del producto oculto → 409 disponible 0 | PASS |
| R7 concurrencia | ver §5 | PASS (criterio de la decisión 3) |

## 4. R9 — regresiones dirigidas con modo ON

10 suites existentes de las superficies afectadas (no las 33 de I4; tampoco las 2 con timeouts conocidos, sin relación nueva con I5):

| Suite | Resultado |
|---|---|
| `pedidos/route` | 5/0 |
| `pedidos/route.variantes` | 9/0 |
| `order-rate-limit-buckets` (idempotencia) | 14/0 |
| `caja/ventas/route` | 21/0 |
| `inventario/movimientos/route` | 13/0 |
| `negocios/[slug]/route` | 3/0 |
| `repetir/route` | 5/0 |
| `mesa-pedido-cancelacion` | 72/0 |
| `order-transition-cas-concurrency` | 6/0 |
| `order-transition-t29b-flow` | 18/0 |

**Total 166/0**, 0 P2028, 0 init, y ninguna incompatibilidad con ON.

## 5. Concurrencia (R7 + carreras)

| Escenario | Resultado |
|---|---|
| Última unidad, producto simple ×3 | siempre 1 éxito + 1 × 409 `STOCK_INSUFFICIENT`; reservado 1 = físico 1; 1 pedido; ~7–9 s |
| Última unidad, variante ×3 | ídem |
| Stock 5 × 10 concurrentes | 3 × 201 + 7 × 409 `STOCK_SERIALIZATION_CONFLICT`; reservado 3 ≤ 5; 3 pedidos; 0 5xx; 13,2 s |
| Stock 10 × 15 concurrentes | 5 × 201 + 10 × 409 `STOCK_SERIALIZATION_CONFLICT`; reservado 5 ≤ 10; 5 pedidos; 0 5xx; 20,4 s |
| Caja contra pedido (última unidad) ×3 | exactamente uno gana cada vez |
| Preparación contra cancelación ×3 | resultado único y consistente (en las 3 ganó la preparación: CONSUMIDA, físico 3, 1 movimiento) |
| Dos preparaciones / dos cancelaciones | 200/409, sin doble efecto |
| **Cambio de modo contra reservas** (comando real ON→DRAINING en paralelo con 8 pedidos) | la transición hizo commit tras un conflicto de serialización (P2034) **reintentado** por `runStockSerializable`; 1 pedido creado antes del cambio (con su reserva) y 7 × 409 `STOCK_RESERVATIONS_DRAINING`; 0 pedidos sin reserva; 1 sola auditoría |

```text
OVERSELL_DETECTED=NO · NEGATIVE_STOCK_DETECTED=NO · UNPROTECTED_ORDERS_DETECTED=NO · DOUBLE_CONSUMPTION_PREVENTED=YES · 5XX=0 · P2028=0
```

**Criterio aplicado (decisión 3 del plan I5):** bajo alta contención sobre una misma clave, los 409 `STOCK_SERIALIZATION_CONFLICT` se aceptan porque no producen sobreventa, reservas inconsistentes ni pedidos parciales. Se midieron y quedan registrados:
- **70 %** de rechazos con 10 solicitudes;
- **67 %** de rechazos con 15 solicitudes.

Es la consecuencia de SSI con 3 intentos sobre una misma fila caliente desde un cliente remoto (latencia de 7–20 s por solicitud).

- Follow-up de **disponibilidad bajo contención** (no de seguridad): `FOLLOWUP_STOCK_HIGH_CONTENTION_SERIALIZATION_CONFLICT_RATE`.
- Las pruebas corrieron con los route handlers reales en un proceso local contra PostgreSQL TESTING (misma autoridad transaccional). **No equivalen** a una prueba HTTP contra la app desplegada: por el rate limit por IP (15 cada 5 min) no se lanzaron ráfagas HTTP desde una sola IP, ni se falsificaron IPs.

## 6. R8 — ciclo completo de modos (comando real I5-P0)

| Paso | Resultado |
|---|---|
| ON→OFF directo (dry-run) | `TRANSITION_FORBIDDEN`, sin cambios |
| ON→DRAINING (dry-run → ejecución durante la carrera) | `APPLIED`, ref `i5-draining-20261008-1`, 3 ACTIVA al commit |
| Comportamiento en DRAINING | pedido controlado nuevo → 409 `STOCK_RESERVATIONS_DRAINING` · sin control → 201 sin reservas · Restaurante → 201 sin reservas · Caja por encima del disponible → 409, dentro → 201 |
| DRAINING→OFF con 3 ACTIVA | dry-run `ACTIVE_RESERVATIONS`; ejecución `REJECTED`; modo DRAINING y auditorías sin cambios |
| Estado desactualizado dentro de la tx real | `STOCK_MODE_STALE_EXPECTED`, sin escritura |
| Resolución por flujos normales | preparar X → CONSUMIDA (físico 10→7, contando una venta de Caja) · cancelar Y y el pedido de la carrera → LIBERADA (`CANCELADO_VENDEDOR`) · ACTIVA global = 0 |
| Recuperación extraordinaria (dry-run) | reserva ya liberada → `ALREADY_RELEASED` (no-op) · reserva consumida → `REJECT:RESERVA_CONSUMIDA` |
| DRAINING→OFF con 0 ACTIVA | dry-run OK → `APPLIED`, ref `i5-off-20261008-1` |
| Integridad + OFF→ON | stock negativo 0, ACTIVA 0 → `APPLIED`, ref `i5-on-20261008-2`, modo ON |

```text
STOCK_MODE_TRANSITIONS_AUDITED=YES (4 filas, todas con el actor del operador y result APPLIED: OFF→ON 17:08:42Z · ON→DRAINING 17:47:54Z · DRAINING→OFF 17:50:47Z · OFF→ON 17:51:09Z)
DRAINING_ACTIVE_GUARD=PASS · DRAINING_TO_OFF_REAL_DB=PASS · ON_TO_OFF_DIRECT=FORBIDDEN (dry-run)
HARD_ROLLBACK_REAL_DB=NOT_TESTED (no existió una reserva genuinamente elegible: la cancelación normal libera; no se fabricaron inconsistencias). Dry-runs verificados; la liberación real sigue cubierta por los tests automatizados de I5-P0
```

**Notas operativas del harness (no del producto):**
- La primera ejecución de la Phase B se detuvo en B3 por un error de parseo del harness: la salida del comando traía antes del JSON una línea de log de Prisma («transaction failed to commit», el P2034 reintentado). El exit code era 0 y la transición estaba aplicada.
- Se verificó el estado real en sólo lectura (una sola auditoría `APPLIED`, modo DRAINING, 3 ACTIVA en pedidos fixture) y se continuó desde B4 con un parseo corregido.
- Ese script no termina solo (handles abiertos de los módulos importados). Lo cortó el `timeout` (exit 124) **después** de `DONE`, sin trabajo pendiente en la base.

## 7. Limpieza y residuos

- **Fixtures de la Phase A y la Phase B:** todas las reservas se resolvieron primero por el flujo normal (cancelación o preparación). Después se borraron sólo los datos propios: negocios `test-i5a-`/`test-i5b-`, sus productos, variantes, pedidos, sus reservas ya CONSUMIDA/LIBERADA, movimientos, ventas, mesas, ocupaciones, notificaciones y sesiones de esos dueños, y clientes `test-i5*`.
- **Sin cambios respecto de la baseline:** reservas 0, movimientos PEDIDO 0, pedidos abiertos 130 (2 genéricos), stock negativo 0, negocios, productos, variantes, pedidos, ventas, movimientos, clientes, mesas y ocupaciones.
- **Conservado:**
  - las **4 auditorías del controlador**;
  - el `auditLog` de las routes (+103 en total, por política);
  - **99 filas auxiliares de las suites R9**: 52 notificaciones, 5 sesiones y 42 auditorías, todas de dueños fixture inexistentes (ninguna del SuperAdmin), listadas en `scratchpad/i5_r9_residue.json`. No se borraron porque no son datos propios y no hubo autorización. Es la misma clase que `FOLLOWUP_REAL_DB_SUITES_AUXILIARY_TABLE_CLEANUP`.

```text
FIXTURE_CLEANUP=PASS · UNEXPECTED_RESIDUE=0 (los residuos auxiliares están identificados) · AUDIT_LOG_PRESERVED=YES
```

## 8. Estado final

```text
FINAL_MODE=ON (reactivado por la autoridad auditada, ref i5-on-20261008-2)
FINAL_ACTIVE_RESERVATIONS=0 · FINAL_STOCK_CONSISTENCY=PASS (sin stock negativo, sin reservas)
TESTING_LOGS=0 líneas de error/excepción/P20xx en la ventana 16:31–18:14Z (deployment 22bf1264)
PRODUCTION=origin/main 42ca500 · production/DeliGO 6bf1ee84 @ 42ca500 (sin cambios)
```

## 9. No ejecutado / limitaciones

- **Pedidos Mozo con ON contra la base real:** NOT_RUN (requiere cuenta operativa, empleado y asignación de mesa). Usa el mismo planner y la misma autoridad; cubierto por los tests de route (`route.stock` 8/0) y el contrato I2.
- **Cancelaciones PyR y automática (repartidor) contra la base real:** NOT_RUN (requieren sesiones de terminal o de repartidor; la automática sólo actúa después del consumo). Usan la misma `aplicarEfectosCancelacion`, cubierta por los tests automatizados.
- **Hard rollback real:** NOT_TESTED (sin fixture elegible genuino).
- **Concurrencia HTTP contra la app desplegada:** no realizada (rate limit por IP); se usó el harness local de integración.
- **La parte visual** (advertencia de AJUSTE, carrito) queda para el smoke manual. Inventario no muestra una columna de reservadas (decisión 2 del plan I5): durante el smoke, Claude informa las reservas con lecturas READ-ONLY.
- **Follow-ups nuevos:**
  - `FOLLOWUP_STOCK_HIGH_CONTENTION_SERIALIZATION_CONFLICT_RATE`;
  - `FOLLOWUP_STOCK_OPS_CLI_PRISMA_LOG_NOISE` (líneas de log de Prisma en la salida del comando, que es JSON);
  - visibilidad Físico/Reservado/Disponible en Inventario.
- **Siguen abiertos:** los follow-ups de I4 (timeouts de denuncias y superadmin-notifications, limpieza auxiliar de las suites, ocupación de mesa tras pedido rechazado, promocionados sin real-DB, A0.1-15 paso 2, promociones sin filtro de eliminado) y `STALE_OPEN_ORDER_EXPIRATION_POLICY`.

## 10. Smoke manual del operador (pendiente)

Modo **ON** en TESTING. Negocio genérico de prueba del operador. Preparar en Inventario un producto A con control de stock y 2 unidades. Claude informa físico, reservado y disponible con lecturas READ-ONLY cuando haga falta.

| # | Prueba | Qué hacer | Esperado |
|---|---|---|---|
| 1 | Reservar al confirmar | Pedir A×1 como cliente. | El pedido se crea. Físico sigue en 2 y reservado pasa a 1 (lectura de Claude). Catálogo y carrito permiten como máximo 1 más. |
| 2 | Consumir al preparar | Pasar ese pedido a preparando. | Físico 1, reserva consumida, un solo descuento. |
| 3 | Liberar al cancelar | Nuevo pedido A×1 y cancelarlo antes de preparar. | Reserva liberada, físico sin cambio. |
| 4 | Última unidad | Con A en 1 disponible, dos clientes/dispositivos confirman A×1 casi a la vez. | Sólo uno se crea; el otro ve el aviso de stock y conserva su carrito. |
| 5 | Caja con reservas | Con 1 unidad reservada por un pedido, intentar vender en Caja más que el disponible. | Rechazo con el mensaje de reservas; dentro del disponible, la venta se registra. |
| 6 | AJUSTE con reservas activas | Con una reserva activa, AJUSTE del físico por debajo de lo reservado. | Advertencia antes de guardar; «Cancelar» no cambia nada; confirmar aplica el ajuste. Luego cancelar el pedido para resolver el déficit. |

No hace falta cambiar el modo. No cerrar I5 hasta registrar este resultado.

## 11. Estado al cierre técnico (histórico; superado por §12)

```text
RESULT=T56_R3A_I5_TECHNICALLY_VERIFIED_TESTING_ON_AWAITING_MANUAL_SMOKE (histórico)
R3A_I5_STATUS=DEPLOYED_TESTING_MODE_ON_AWAITING_MANUAL_SMOKE (histórico)
MANUAL_SMOKE_STATUS=PENDING_OPERATOR (histórico → resuelto en §12: PASS 6/6)
```

## 12. Closeout — Certificación manual TESTING MODE ON (2026-10-08)

Ronda documental y de verificación READ-ONLY: sin código, sin escrituras en la base, sin cambios de modo ni de Railway.

### Smoke manual del operador (registrado tal como fue informado)

| # | Prueba | Resultado |
|---|---|---|
| 1 | Reserva al confirmar: el pedido confirmó y la reserva redujo la disponibilidad sin descontar el físico | PASS |
| 2 | Descuento al preparar: el pedido pasó a preparación y el físico se descontó | PASS |
| 3 | Liberación por cancelación antes de preparar | PASS |
| 4 | Dos clientes, última unidad: ambos no pudieron confirmar la misma unidad | PASS |
| 5 | Caja respeta las unidades reservadas | PASS |
| 6 | AJUSTE con reserva activa: la advertencia previa funcionó | PASS |

```text
MANUAL_SMOKE_ENVIRONMENT=TESTING
MANUAL_SMOKE_MODE=ON
MANUAL_SMOKE_TOTAL=6
MANUAL_SMOKE_PASS=6
MANUAL_SMOKE_FAIL=0
MANUAL_SMOKE_NOT_AVAILABLE=0
MANUAL_SMOKE_RESULT=PASS
```

### Verificación posterior al smoke (READ-ONLY, huella d64be28f676e)

- **Git:** `testing-codex` = `origin/testing-codex` = `d691063`, árbol limpio. **Railway TESTING:** DeliGO Copy `349017fc` SUCCESS @ `d691063` (commit match). **Production:** `6bf1ee84` @ `42ca500`, sin cambios.
- **Modo:** ON. `updatedAt` de config 17:51:08Z: no hubo cambios de modo después de la reactivación auditada.
- **Auditoría del controlador:** 4 filas `APPLIED` con el actor del operador (OFF→ON, ON→DRAINING, DRAINING→OFF, OFF→ON) y ninguna recuperación ejecutada.
- **Reservas actuales:** ACTIVA **0** · CONSUMIDA **1** (cantidad 1) · LIBERADA **3** (cantidad 5, todas `CANCELADO_VENDEDOR`).
- **Pedidos de negocios genéricos creados con ON** (los 4 del smoke, `paola-vinal`, 19:01–19:10Z; los fixtures del harness ya se habían limpiado):

| Pedido | Estado | Reserva | Movimientos PEDIDO |
|---|---|---|---|
| `cmuzwjnc30007sd0akgo36jxq` | cancelado (después de preparar) | CONSUMIDA 1 | 1 (sin reposición) |
| `cmuzwsgjk000psd0ats03y4nj` | cancelado antes de preparar | LIBERADA 2 | 0 |
| `cmuzwuc430011sd0ap260uf92` | cancelado antes de preparar | LIBERADA 2 | 0 |
| `cmuzwvodc001gsd0alin8a1ka` | cancelado antes de preparar | LIBERADA 1 | 0 |

- **Integridad:**
  - cada línea controlada tiene exactamente una reserva;
  - ningún pedido pendiente con reserva no ACTIVA;
  - ningún pedido preparado o cancelado con ACTIVA;
  - ninguna CONSUMIDA sin movimiento ni movimiento sin consumo;
  - 0 movimientos PEDIDO duplicados (1 en total);
  - ninguna liberación con descuento;
  - 0 stock negativo → `problemas = []`.
- **Stock controlado de negocios genéricos** (`paola-vinal`): papas 0/0, Chisitos 0/0, Coca 1L 2/0, Coca 500 0/0 (físico/reservado). **Déficit: 0 en todas las claves.** El déficit provocado en la prueba 6 quedó resuelto por el flujo normal (no hay reservas ACTIVA ni déficit).
- **Pedidos abiertos de negocios genéricos:** 2, ambos en `preparando` desde antes de I5 (sin reservas; creados en OFF). Pedidos genéricos cancelados: 7.
- No quedan pedidos de prueba por resolver.

```text
POST_SMOKE_DB_CHECK=PASS · OPEN_TEST_ORDERS=0 · INCONSISTENT_RESERVATIONS=0 · NEGATIVE_STOCK=0 · DOUBLE_CONSUMPTION=0 · UNPROTECTED_ORDERS=0 · PENDING_MANUAL_CLEANUP=NONE
```

### Logs del período del smoke

Deployment `349017fc`, ventana 18:20–19:16Z, 601 líneas:
- "38 migrations found", "No pending migrations to apply", "Ready";
- requests R3A en la ventana: 6 `POST /api/pedidos`, 6 `PATCH .../estado`, 1 `POST /api/negocio/caja/ventas`, 5 `POST .../inventario/movimientos`;
- **0 errores 5xx reales detectables**, 0 P2028, 0 fallas de inicialización.

Dos líneas de clase error:
- `DeprecationWarning url.parse()` de Node: ajena a R3A.
- Un `prisma:error` «Transaction failed due to a write conflict or a deadlock» en `cliente.update` dentro de la transacción de `POST /api/pedidos` a las 19:09:19Z. Es un **conflicto de serialización controlado y reintentado**: el pedido `cmuzwuc43…` se creó a las 19:09:19.443Z y en la base hay un solo pedido de ese momento, coherente con la prueba 4 (última unidad: sólo uno confirma).

**Límite de la evidencia:** el logger de `src/proxy.ts` registra un status 200 provisorio, así que los logs no prueban el status final de cada handler (un 409 de stock no se ve como 409). Los logs no corroboran por sí solos el detalle de cada prueba manual; el resultado se apoya en el informe del operador.

```text
POST_SMOKE_LOG_CHECK=PASS_WITH_DOCUMENTED_LOGGING_LIMITATIONS
```

### Base de la certificación

- **Smoke manual 6/6** con modo ON.
- **Real-DB** (§3–§6): Phase A 14/14 (con la re-ejecución sólo de R4 tras corregir `efectivo` → `EFECTIVO` en el harness, que no es una falla funcional de Caja) · Phase B: ciclo completo con 4 transiciones auditadas, guarda DRAINING, estado desactualizado en tx y carrera modo/reserva · R9 166/0 con ON.
- **Concurrencia:** sin sobreventa, sin stock negativo y sin pedidos sin reserva.
- **Controlador I5-P0:** tests 57/0 y verificación real.

### Concurrencia — limitación de disponibilidad (abierta)

```text
LAST_UNIT_SIMPLE=PASS · LAST_UNIT_VARIANT=PASS
STOCK_5_REQUESTS_10: SUCCESS=3 · SERIALIZATION_409=7
STOCK_10_REQUESTS_15: SUCCESS=5 · SERIALIZATION_409=10
OVERSELL_DETECTED=NO · NEGATIVE_STOCK_DETECTED=NO · UNPROTECTED_ORDERS_DETECTED=NO
HIGH_CONTENTION_LIMITATION=OPEN_FOLLOWUP (FOLLOWUP_STOCK_HIGH_CONTENTION_SERIALIZATION_CONFLICT_RATE: mejorar el comportamiento bajo contención sin comprometer la seguridad transaccional; retries/timeouts sin cambios en este cierre)
```

R7 **no** demuestra un rendimiento óptimo: es seguro, pero rechaza muchas solicitudes bajo alta contención.

### Coberturas pendientes (explícitas)

```text
HARD_ROLLBACK_REAL_DB=NOT_TESTED (sin reserva genuinamente elegible; dry-runs y tests automatizados ejecutados)
MOZO_REAL_DB_ON=NOT_RUN · PYR_CANCEL_REAL_DB_ON=NOT_RUN · AUTO_CANCEL_REAL_DB_ON=NOT_RUN (misma autoridad, cubierta por tests automatizados)
HTTP_CONCURRENCY_REAL_DB=NOT_RUN (concurrencia con handlers reales locales contra PostgreSQL TESTING, no tráfico HTTP contra la app desplegada)
AUXILIARY_ROWS_PRESERVED=99 (filas auxiliares de las suites R9: 52 notificaciones, 5 sesiones, 42 auditorías de fixtures eliminados; no borradas por falta de autorización; no son inconsistencias de reservas)
```

**Follow-ups preservados:**
- P2028 de denuncias;
- timeout de `superadmin-notifications` test 11;
- limpieza de tablas auxiliares de las suites;
- ocupación de Mesa tras un pedido rechazado;
- Terminal Salón: cierre de cuenta;
- líneas repetidas en Caja sin real-DB específica;
- gate de rubro en el servidor;
- reservas para Ropa (futuro);
- deprecación de `stockCantidad` público (A0.1-15 paso 2);
- filtro de `eliminado` en promociones;
- real-DB de `promocionados` genérico;
- vencimiento de pedidos abiertos con reservas (`STALE_OPEN_ORDER_EXPIRATION_POLICY`);
- columnas Físico/Reservado/Disponible/Déficit en Inventario;
- contención alta;
- ruido de logs de Prisma en la salida del comando.

### Alcance de la certificación

Certifica el ciclo de reservas de stock (R3A I1–I5) **en TESTING**, para **negocios genéricos** (`rubro = "negocio"`) y productos o variantes con control de stock, en los comportamientos efectivamente comprobados.

**No** certifica:
- Production (que no se tocó);
- Ropa ni Restaurante (fuera del sistema de reservas);
- la resolución de los follow-ups;
- una regresión completa sin fallas (los 2 timeouts de I4 siguen abiertos);
- un rendimiento optimizado bajo alta concurrencia.

### Estado final

```text
R3A_I1_STATUS=CLOSED_TESTING_VERIFIED · R3A_I2_STATUS=CLOSED_TESTING_CERTIFIED · R3A_I3_STATUS=CLOSED_TESTING_CERTIFIED · R3A_I4_STATUS=CLOSED_TESTING_CERTIFIED
R3A_I5_P0_STATUS=REAL_DB_VERIFIED_IN_I5 (entrega histórica: DEPLOYED_TESTING_MODE_OFF_AWAITING_ACTIVATION)
R3A_I5_STATUS=CLOSED_TESTING_CERTIFIED (TESTING, modo ON)
R3A_OVERALL_STATUS=CLOSED_TESTING_CERTIFIED_WITH_DOCUMENTED_LIMITATIONS
STOCK_RESERVATION_MODE=ON (TESTING) · ACTIVE_RESERVATIONS=0
PRODUCTION_TOUCHED=NO
RESULT=T56_R3A_I5_CLOSED_TESTING_CERTIFIED
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_NEXT_GENERIC_BUSINESS_FEATURE_DECISION
```
